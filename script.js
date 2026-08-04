(() => {
  'use strict';

  const portal = document.querySelector('.portal');
  const stage = document.querySelector('.artifact-stage');
  const specimen = document.querySelector('[data-specimen]');
  const card = specimen?.querySelector('.specimen__card');
  const actuator = document.querySelector('[data-actuator]');
  const flipButton = document.querySelector('[data-flip]');
  const controls = document.querySelector('[data-artifact-controls]');
  const instruction = document.querySelector('[data-instruction]');
  const statusLine = document.querySelector('[data-status-line]');
  const reader = document.querySelector('[data-reader]');
  const readerSlot = document.querySelector('[data-reader-slot]');
  const readerMouth = readerSlot?.querySelector('.reader__mouth');
  const readerPrompt = document.querySelector('[data-reader-prompt]');
  const readerHint = document.querySelector('[data-reader-hint]');
  const handoff = document.querySelector('[data-handoff]');
  const handoffLink = document.querySelector('[data-handoff-link]');

  if (
    !portal || !stage || !specimen || !card || !actuator || !flipButton
    || !controls || !instruction || !statusLine || !reader || !readerSlot
    || !readerMouth || !readerPrompt || !readerHint || !handoff || !handoffLink
  ) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (start, end, amount) => start + (end - start) * amount;

  let face = 'front';
  let pointerStart = null;
  let motionFallbackTimer = null;
  let flipRotation = 0;
  let dragRotation = 0;
  let isFlipping = false;
  let isPresenting = false;
  let sequenceTimers = [];
  let springFrame = 0;
  let world = { x: 0, y: 0, scale: 1 };
  let worldVelocity = { x: 0, y: 0, scale: 0 };

  function setCss(name, value) {
    specimen.style.setProperty(name, value);
  }

  function setWorld(next) {
    world = { ...world, ...next };
    setCss('--world-x', `${world.x}px`);
    setCss('--world-y', `${world.y}px`);
    setCss('--world-scale', `${world.scale}`);
  }

  function later(callback, delay) {
    const timer = window.setTimeout(callback, delay);
    sequenceTimers.push(timer);
    return timer;
  }

  function clearSequenceTimers() {
    sequenceTimers.forEach((timer) => window.clearTimeout(timer));
    sequenceTimers = [];
  }

  function clearMotionFallback() {
    if (motionFallbackTimer) window.clearTimeout(motionFallbackTimer);
    motionFallbackTimer = null;
  }

  function cancelSpring() {
    if (springFrame) cancelAnimationFrame(springFrame);
    springFrame = 0;
  }

  function setReaderState(state) {
    reader.dataset.readerState = state;
  }

  function syncReaderGeometry() {
    const available = Math.max(280, stage.clientWidth - 4);
    const cardWidth = specimen.offsetWidth;
    const shellWidth = Math.min(available, cardWidth * 1.16);
    const mouthWidth = Math.min(shellWidth - 8, cardWidth * 1.04);
    reader.style.width = `${shellWidth}px`;
    reader.style.setProperty('--reader-mouth-width', `${mouthWidth}px`);
  }

  function updateIdleCopy() {
    if (face === 'front') {
      instruction.textContent = 'Swipe horizontally to inspect';
      readerPrompt.textContent = 'READER STANDBY · INSPECT FV–01';
      readerHint.textContent = 'FLIP TO REVERSE · THEN DRAG DOWN';
      return;
    }
    instruction.textContent = 'Drag down to present';
    readerPrompt.textContent = 'READER AVAILABLE · PRESENT FV–01';
    readerHint.textContent = 'DRAG CARD DOWN OR PRESS READER';
  }

  function setFace(nextFace, announce = true) {
    face = nextFace;
    specimen.dataset.face = face;
    actuator.disabled = face !== 'front';
    actuator.setAttribute(
      'aria-label',
      face === 'front'
        ? 'Present Specimen Pass to the instrument'
        : 'Specimen Pass actuator is on the front face',
    );
    updateIdleCopy();
    if (announce) {
      statusLine.textContent = face === 'front'
        ? 'Specimen Pass received · inspect or activate'
        : 'Reverse field inspected · present FV–01 to reader';
    }
  }

  function resetMaterial(delay = 0) {
    later(() => {
      setCss('--drag-shift-x', '0px');
      setCss('--drag-shift-y', '0px');
      setCss('--drag-lift', '0px');
      setCss('--tilt-x', '0deg');
      setCss('--tilt-z', '0deg');
      setCss('--shadow-shift-x', '0px');
      setCss('--shadow-scale', '1');
      setCss('--shadow-opacity', '0.42');
      setCss('--glint-x', face === 'front' ? '24%' : '34%');
      setCss('--glint-y', '18%');
      setCss('--glint-opacity', face === 'front' ? '0.16' : '0.24');
      setCss('--reader-progress', '0');
    }, delay);
  }

  function setDragging(active) {
    if (active) {
      specimen.dataset.dragging = 'true';
      specimen.dataset.motion = 'dragging';
    } else {
      delete specimen.dataset.dragging;
    }
  }

  function clearPresentingState() {
    delete specimen.dataset.presenting;
    setCss('--reader-progress', '0');
    if (!isPresenting) setReaderState('idle');
    updateIdleCopy();
  }

  function finishFlip(nextFace = null) {
    clearMotionFallback();
    isFlipping = false;
    dragRotation = 0;
    setCss('--drag-rotation', '0deg');
    setCss('--settle-duration', '680ms');
    delete specimen.dataset.motion;
    if (nextFace) setFace(nextFace);
    clearPresentingState();
    resetMaterial();
  }

  function waitForCardTransform(duration, onDone) {
    clearMotionFallback();
    let completed = false;
    const complete = () => {
      if (completed) return;
      completed = true;
      card.removeEventListener('transitionend', handleTransitionEnd);
      clearMotionFallback();
      onDone();
    };
    const handleTransitionEnd = (event) => {
      if (event.target !== card) return;
      if (event.propertyName !== 'transform' && event.propertyName !== '-webkit-transform') return;
      complete();
    };
    card.addEventListener('transitionend', handleTransitionEnd);
    motionFallbackTimer = window.setTimeout(complete, duration + 120);
  }

  function animateFlip(direction = -1, speed = 0.8) {
    if (portal.dataset.stage !== 'receiving' || isFlipping || isPresenting) return;
    const normalizedDirection = direction < 0 ? -1 : 1;
    const nextFace = face === 'front' ? 'back' : 'front';
    const reduced = prefersReducedMotion.matches;
    const currentRotation = flipRotation + dragRotation;
    const targetRotation = flipRotation + normalizedDirection * 180;
    const remainingAngle = Math.abs(targetRotation - currentRotation);
    const distanceRatio = clamp(remainingAngle / 180, 0.24, 1);
    const baseDuration = clamp(540 - speed * 105, 390, 540);
    const duration = reduced ? 20 : Math.round(baseDuration * distanceRatio);

    isFlipping = true;
    setDragging(false);
    clearPresentingState();
    specimen.dataset.motion = 'flipping';
    statusLine.textContent = nextFace === 'front'
      ? 'Returning specimen · front field'
      : 'Turning specimen · reverse field';

    setCss('--settle-duration', `${duration}ms`);
    setCss('--drag-lift', reduced ? '0px' : '8px');
    setCss('--shadow-scale', '0.9');
    setCss('--shadow-opacity', '0.26');
    setCss('--glint-opacity', face === 'front' ? '0.34' : '0.42');

    void card.offsetWidth;
    dragRotation = 0;
    flipRotation = targetRotation;
    setCss('--drag-rotation', '0deg');
    setCss('--flip-rotation', `${targetRotation}deg`);
    waitForCardTransform(duration, () => finishFlip(nextFace));
    navigator.vibrate?.([6, 24, 9]);
  }

  function springFlipBack() {
    if (isFlipping || isPresenting) return;
    const reduced = prefersReducedMotion.matches;
    const distanceRatio = clamp(Math.abs(dragRotation) / 82, 0.2, 1);
    const duration = reduced ? 20 : Math.round(180 + 150 * distanceRatio);
    isFlipping = true;
    setDragging(false);
    specimen.dataset.motion = 'settling';
    setCss('--settle-duration', `${duration}ms`);
    void card.offsetWidth;
    dragRotation = 0;
    setCss('--drag-rotation', '0deg');
    clearPresentingState();
    resetMaterial();
    waitForCardTransform(duration, () => finishFlip());
  }

  function setActuatorState(state) {
    actuator.dataset.actuatorState = state;
    document.querySelectorAll('.actuator--mini, .actuator--tiny')
      .forEach((item) => { item.dataset.actuatorState = state; });
  }

  function geometryFor(baseRect, origin, scale, x = world.x, y = world.y) {
    const mouthRect = readerMouth.getBoundingClientRect();
    const centerX = baseRect.left + x + origin.x + (baseRect.width / 2 - origin.x) * scale;
    const bottomY = baseRect.top + y + origin.y + (baseRect.height - origin.y) * scale;
    const targetX = mouthRect.left + mouthRect.width / 2;
    const targetY = mouthRect.top + 8;
    return {
      centerX,
      bottomY,
      targetX,
      targetY,
      distance: Math.hypot(targetX - centerX, targetY - bottomY),
    };
  }

  function captureTarget(baseRect, origin, scale = 0.82) {
    const mouthRect = readerMouth.getBoundingClientRect();
    const targetCenterX = mouthRect.left + mouthRect.width / 2;
    const targetBottomY = mouthRect.top + 8;
    const x = targetCenterX - (
      baseRect.left + origin.x + (baseRect.width / 2 - origin.x) * scale
    );
    const y = targetBottomY - (
      baseRect.top + origin.y + (baseRect.height - origin.y) * scale
    );
    return { x, y, scale };
  }

  function springWorldTo(target, config, onDone) {
    cancelSpring();
    if (prefersReducedMotion.matches) {
      setWorld(target);
      worldVelocity = { x: 0, y: 0, scale: 0 };
      onDone?.();
      return;
    }

    const mass = config.mass ?? 1;
    const stiffness = config.stiffness ?? 320;
    const damping = config.damping ?? 31;
    let previous = performance.now();

    const tick = (now) => {
      const dt = Math.min((now - previous) / 1000, 1 / 30);
      previous = now;
      const next = { ...world };
      let settled = true;

      for (const key of ['x', 'y', 'scale']) {
        const displacement = world[key] - target[key];
        const acceleration = (-stiffness * displacement - damping * worldVelocity[key]) / mass;
        worldVelocity[key] += acceleration * dt;
        next[key] = world[key] + worldVelocity[key] * dt;
        const positionTolerance = key === 'scale' ? 0.0015 : 0.35;
        const velocityTolerance = key === 'scale' ? 0.004 : 5;
        if (Math.abs(next[key] - target[key]) > positionTolerance
          || Math.abs(worldVelocity[key]) > velocityTolerance) settled = false;
      }

      setWorld(next);
      if (settled) {
        setWorld(target);
        worldVelocity = { x: 0, y: 0, scale: 0 };
        springFrame = 0;
        onDone?.();
        return;
      }
      springFrame = requestAnimationFrame(tick);
    };

    springFrame = requestAnimationFrame(tick);
  }

  function springPresentationBack() {
    if (isPresenting) return;
    setDragging(false);
    specimen.dataset.motion = 'returning';
    delete specimen.dataset.presenting;
    setReaderState('idle');
    springWorldTo(
      { x: 0, y: 0, scale: 1 },
      { mass: 1, stiffness: 220, damping: 27 },
      () => {
        delete specimen.dataset.motion;
        setCss('--grab-x', '50%');
        setCss('--grab-y', '50%');
        resetMaterial();
        updateIdleCopy();
      },
    );
  }

  function presentSpecimen(source = 'reader', snapshot = null) {
    if (portal.dataset.stage !== 'receiving' || isFlipping || isPresenting) return;
    isPresenting = true;
    pointerStart = null;
    clearSequenceTimers();
    clearMotionFallback();
    cancelSpring();
    setDragging(false);
    delete specimen.dataset.presenting;
    specimen.dataset.motion = 'capturing';

    syncReaderGeometry();
    const baseRect = snapshot?.baseRect ?? specimen.getBoundingClientRect();
    const origin = snapshot?.origin ?? { x: baseRect.width / 2, y: baseRect.height / 2 };
    const velocity = snapshot?.velocity ?? { x: 0, y: 0 };
    worldVelocity = {
      x: clamp(velocity.x, -900, 900),
      y: clamp(velocity.y, -900, 1100),
      scale: 0,
    };
    setCss('--grab-x', `${(origin.x / baseRect.width) * 100}%`);
    setCss('--grab-y', `${(origin.y / baseRect.height) * 100}%`);

    controls.setAttribute('aria-hidden', 'true');
    readerSlot.disabled = true;
    actuator.disabled = true;
    portal.dataset.stage = 'aligning';
    specimen.dataset.intake = 'aligning';
    setReaderState('aligning');
    setActuatorState('ready');
    statusLine.textContent = 'Magnetic capture · aligning FV–01';
    readerPrompt.textContent = 'MAGNETIC CAPTURE · ALIGNING FV–01';
    readerHint.textContent = source === 'drag' ? 'OBJECT CAPTURED' : 'READER COMMAND ACCEPTED';
    navigator.vibrate?.(8);

    const target = captureTarget(baseRect, origin, 0.82);
    springWorldTo(
      target,
      { mass: 1, stiffness: 320, damping: 31 },
      () => {
        setReaderState('scanning');
        setActuatorState('scanning');
        portal.dataset.stage = 'verifying';
        specimen.dataset.motion = 'verified-position';
        statusLine.textContent = 'Object aligned · registering matrix';
        readerPrompt.textContent = 'OBJECT ALIGNED · REGISTERING FV–01';
        readerHint.textContent = 'DO NOT REMOVE';
        navigator.vibrate?.([7, 34, 7]);
        window.dispatchEvent(new CustomEvent('fv:specimen-captured', {
          detail: { source, target },
        }));
      },
    );
  }

  function resetPortal() {
    clearSequenceTimers();
    clearMotionFallback();
    cancelSpring();
    pointerStart = null;
    isFlipping = false;
    isPresenting = false;
    flipRotation = 0;
    dragRotation = 0;
    worldVelocity = { x: 0, y: 0, scale: 0 };
    setWorld({ x: 0, y: 0, scale: 1 });

    portal.dataset.stage = 'receiving';
    portal.removeAttribute('data-redemption-motion');
    controls.removeAttribute('aria-hidden');
    readerSlot.disabled = false;
    handoff.classList.remove('is-visible');
    handoff.hidden = true;
    specimen.removeAttribute('data-intake');
    specimen.removeAttribute('data-presenting');
    setCss('--flip-rotation', '0deg');
    setCss('--drag-rotation', '0deg');
    setCss('--settle-duration', '0ms');
    setCss('--grab-x', '50%');
    setCss('--grab-y', '50%');
    delete specimen.dataset.motion;
    delete specimen.dataset.dragging;
    setReaderState('idle');
    setActuatorState('rest');
    setFace('front', false);
    resetMaterial();
    syncReaderGeometry();
    statusLine.textContent = 'Receiving Specimen Pass · FV–01';
    later(() => {
      if (portal.dataset.stage === 'receiving') {
        statusLine.textContent = 'Specimen Pass received · inspect or activate';
        setActuatorState('ready');
      }
    }, prefersReducedMotion.matches ? 20 : 900);
  }

  specimen.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button, a')) return;
    if (portal.dataset.stage !== 'receiving' || isFlipping || isPresenting) return;
    cancelSpring();
    const rect = specimen.getBoundingClientRect();
    pointerStart = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocityX: 0,
      velocityY: 0,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      baseRect: rect,
      origin: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      axis: null,
      readerProgress: 0,
      captureEligible: false,
    };
    setCss('--grab-x', `${(pointerStart.origin.x / rect.width) * 100}%`);
    setCss('--grab-y', `${(pointerStart.origin.y / rect.height) * 100}%`);
    dragRotation = 0;
    setDragging(true);
    setCss('--settle-duration', '0ms');
    setCss('--drag-lift', '8px');
    setCss('--shadow-scale', '0.9');
    setCss('--shadow-opacity', '0.28');
    specimen.setPointerCapture?.(event.pointerId);
  });

  specimen.addEventListener('pointermove', (event) => {
    if (!pointerStart || portal.dataset.stage !== 'receiving' || isFlipping || isPresenting) return;
    const now = performance.now();
    const dt = Math.max(8, now - pointerStart.lastTime);
    const instantVx = ((event.clientX - pointerStart.lastX) / dt) * 1000;
    const instantVy = ((event.clientY - pointerStart.lastY) / dt) * 1000;
    pointerStart.velocityX = lerp(pointerStart.velocityX, instantVx, 0.28);
    pointerStart.velocityY = lerp(pointerStart.velocityY, instantVy, 0.28);
    pointerStart.lastX = event.clientX;
    pointerStart.lastY = event.clientY;
    pointerStart.lastTime = now;

    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!pointerStart.axis && Math.max(absX, absY) > 18) {
      if (face === 'back' && deltaY > 0 && absY > absX * 1.12) pointerStart.axis = 'present';
      else if (absX > absY * 1.04) pointerStart.axis = 'flip';
    }

    if (pointerStart.axis === 'present') {
      event.preventDefault();
      dragRotation = 0;
      specimen.dataset.presenting = 'true';
      const rawX = deltaX;
      const rawY = Math.max(0, deltaY);
      const rawGeometry = geometryFor(pointerStart.baseRect, pointerStart.origin, 1, rawX, rawY);
      const magneticProgress = clamp((120 - rawGeometry.distance) / 75, 0, 1);
      const assist = magneticProgress * magneticProgress;
      const scale = lerp(1, 0.82, magneticProgress);
      const target = captureTarget(pointerStart.baseRect, pointerStart.origin, scale);
      const x = lerp(rawX, target.x, assist * 0.42);
      const y = lerp(rawY, target.y, assist * 0.28);
      const geometry = geometryFor(pointerStart.baseRect, pointerStart.origin, scale, x, y);
      const progress = clamp(1 - geometry.distance / 120, 0, 1);

      pointerStart.readerProgress = progress;
      pointerStart.captureEligible = geometry.distance <= 45;
      setWorld({ x, y, scale });
      setCss('--drag-rotation', '0deg');
      setCss('--drag-lift', `${8 + progress * 7}px`);
      setCss('--tilt-x', `${progress * 2.5}deg`);
      setCss('--tilt-z', `${clamp(deltaX / 180, -1.3, 1.3)}deg`);
      setCss('--shadow-shift-x', `${x * 0.12}px`);
      setCss('--shadow-scale', `${lerp(0.92, 0.72, progress)}`);
      setCss('--shadow-opacity', `${lerp(0.3, 0.18, progress)}`);
      setCss('--reader-progress', `${progress}`);
      setCss('--glint-y', `${clamp(20 + progress * 48, 20, 68)}%`);
      setCss('--glint-opacity', `${0.26 + progress * 0.18}`);

      if (geometry.distance < 120) {
        setReaderState(pointerStart.captureEligible ? 'capture-ready' : 'magnetic');
        readerPrompt.textContent = pointerStart.captureEligible
          ? 'MAGNETIC LOCK · RELEASE TO PRESENT'
          : 'READER FIELD DETECTED · CONTINUE';
        readerHint.textContent = `${Math.round(geometry.distance)} PX TO SLOT`;
      } else {
        setReaderState('idle');
        readerPrompt.textContent = 'READER AVAILABLE · PRESENT FV–01';
        readerHint.textContent = 'DRAG CARD TO THE SLOT';
      }
      return;
    }

    if (pointerStart.axis !== 'flip') return;
    dragRotation = clamp(deltaX * 0.43, -82, 82);
    const localX = clamp(((event.clientX - pointerStart.left) / pointerStart.width) * 100, 8, 92);
    const localY = clamp(((event.clientY - pointerStart.top) / pointerStart.height) * 100, 8, 92);
    const shiftX = clamp(deltaX * 0.14, -20, 20);
    const shiftY = clamp(deltaY * 0.08, -8, 8);
    const lift = 8 + Math.min(absX / 18, 7);
    setCss('--drag-rotation', `${dragRotation}deg`);
    setCss('--drag-shift-x', `${shiftX}px`);
    setCss('--drag-shift-y', `${shiftY}px`);
    setCss('--drag-lift', `${lift}px`);
    setCss('--tilt-x', `${clamp(-deltaY / 18, -5.5, 5.5)}deg`);
    setCss('--tilt-z', `${clamp(deltaX / 90, -2.6, 2.6)}deg`);
    setCss('--shadow-shift-x', `${shiftX * 0.45}px`);
    setCss('--shadow-scale', `${1 - Math.min(Math.abs(dragRotation) / 520, 0.14)}`);
    setCss('--glint-x', `${face === 'front' ? localX : 100 - localX}%`);
    setCss('--glint-y', `${localY}%`);
    setCss('--glint-opacity', `${0.25 + Math.min(absX / 420, 0.2)}`);
  });

  specimen.addEventListener('pointerup', (event) => {
    if (!pointerStart) return;
    const start = pointerStart;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const elapsed = Math.max(16, performance.now() - start.time);
    const horizontalSpeed = Math.abs(deltaX) / elapsed;
    pointerStart = null;

    if (start.axis === 'present') {
      if (start.captureEligible) {
        presentSpecimen('drag', {
          baseRect: start.baseRect,
          origin: start.origin,
          velocity: { x: start.velocityX, y: start.velocityY },
        });
      } else {
        worldVelocity = { x: start.velocityX, y: start.velocityY, scale: 0 };
        springPresentationBack();
      }
      return;
    }

    if (start.axis === 'flip') {
      const committed = (
        Math.abs(deltaX) > 46 && Math.abs(deltaX) > Math.abs(deltaY)
      ) || horizontalSpeed > 0.62;
      if (committed) animateFlip(deltaX < 0 ? -1 : 1, horizontalSpeed);
      else springFlipBack();
      return;
    }

    springPresentationBack();
  });

  specimen.addEventListener('pointercancel', () => {
    if (!pointerStart) return;
    worldVelocity = { x: pointerStart.velocityX, y: pointerStart.velocityY, scale: 0 };
    pointerStart = null;
    springPresentationBack();
  });

  specimen.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); animateFlip(-1, 0.8); return; }
    if (event.key === 'ArrowRight') { event.preventDefault(); animateFlip(1, 0.8); return; }
    if (event.key === 'ArrowDown' && face === 'back') {
      event.preventDefault(); presentSpecimen('keyboard'); return;
    }
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); animateFlip(-1, 0.8); }
  });

  flipButton.addEventListener('click', () => animateFlip(-1, 0.8));
  readerSlot.addEventListener('click', () => presentSpecimen('reader'));
  actuator.addEventListener('click', (event) => {
    event.stopPropagation();
    presentSpecimen('actuator');
  });
  handoffLink.addEventListener('click', () => clearSequenceTimers());
  window.addEventListener('resize', () => {
    if (portal.dataset.stage === 'receiving') syncReaderGeometry();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted || portal.dataset.stage !== 'receiving') resetPortal();
  });

  resetPortal();
})();
