(() => {
  'use strict';

  const INSTRUMENT_URL = 'https://face-value-seven.vercel.app/?source=specimen-pass';

  const portal = document.querySelector('.portal');
  const specimen = document.querySelector('[data-specimen]');
  const card = specimen?.querySelector('.specimen__card');
  const actuator = document.querySelector('[data-actuator]');
  const flipButton = document.querySelector('[data-flip]');
  const controls = document.querySelector('[data-artifact-controls]');
  const instruction = document.querySelector('[data-instruction]');
  const statusLine = document.querySelector('[data-status-line]');
  const reader = document.querySelector('[data-reader]');
  const readerSlot = document.querySelector('[data-reader-slot]');
  const readerPrompt = document.querySelector('[data-reader-prompt]');
  const readerHint = document.querySelector('[data-reader-hint]');
  const handoff = document.querySelector('[data-handoff]');
  const handoffLink = document.querySelector('[data-handoff-link]');

  if (
    !portal
    || !specimen
    || !card
    || !actuator
    || !flipButton
    || !controls
    || !instruction
    || !statusLine
    || !reader
    || !readerSlot
    || !readerPrompt
    || !readerHint
    || !handoff
    || !handoffLink
  ) {
    return;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let face = 'front';
  let pointerStart = null;
  let motionFallbackTimer = null;
  let flipRotation = 0;
  let dragRotation = 0;
  let isFlipping = false;
  let isPresenting = false;
  let sequenceTimers = [];

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function setCss(name, value) {
    specimen.style.setProperty(name, value);
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

  function setReaderState(state) {
    reader.dataset.readerState = state;
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
      return;
    }
    delete specimen.dataset.dragging;
  }

  function clearPresentingState() {
    delete specimen.dataset.presenting;
    setCss('--reader-progress', '0');
    if (!isPresenting) setReaderState('idle');
    updateIdleCopy();
  }

  function finishMotion(nextFace = null) {
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

  function waitForTransform(duration, onDone) {
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

    waitForTransform(duration, () => finishMotion(nextFace));

    if ('vibrate' in navigator) navigator.vibrate([6, 24, 9]);
  }

  function springBack() {
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

    waitForTransform(duration, () => finishMotion());
  }

  function setActuatorState(state) {
    actuator.dataset.actuatorState = state;
    const miniActuators = document.querySelectorAll('.actuator--mini, .actuator--tiny');
    miniActuators.forEach((item) => { item.dataset.actuatorState = state; });
  }

  function calculateReaderAlignment() {
    const specimenRect = specimen.getBoundingClientRect();
    const slotRect = readerSlot.getBoundingClientRect();
    const specimenCenterX = specimenRect.left + specimenRect.width / 2;
    const slotCenterX = slotRect.left + slotRect.width / 2;
    const targetBottom = slotRect.top + 10;

    return {
      x: slotCenterX - specimenCenterX,
      y: targetBottom - specimenRect.bottom,
    };
  }

  function presentSpecimen(source = 'reader') {
    if (portal.dataset.stage !== 'receiving' || isFlipping || isPresenting) return;

    isPresenting = true;
    pointerStart = null;
    clearSequenceTimers();
    clearMotionFallback();
    setDragging(false);
    delete specimen.dataset.motion;
    delete specimen.dataset.presenting;

    const reduced = prefersReducedMotion.matches;
    const alignDuration = reduced ? 20 : 290;
    const verifyDuration = reduced ? 60 : 430;
    const acceptHold = reduced ? 50 : 170;
    const intakeDuration = reduced ? 60 : 430;
    const handoffHold = reduced ? 120 : 620;
    const alignment = calculateReaderAlignment();

    setCss('--intake-x', `${alignment.x}px`);
    setCss('--intake-y', `${alignment.y}px`);
    specimen.style.setProperty('--intake-duration', `${alignDuration}ms`);
    setCss('--settle-duration', `${alignDuration}ms`);
    setCss('--drag-rotation', '0deg');
    setCss('--drag-shift-x', '0px');
    setCss('--drag-shift-y', '0px');
    setCss('--drag-lift', '0px');
    setCss('--tilt-x', '0deg');
    setCss('--tilt-z', '0deg');
    setCss('--shadow-opacity', '0.22');
    setCss('--shadow-scale', '0.84');

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

    if ('vibrate' in navigator) navigator.vibrate(8);

    later(() => {
      portal.dataset.stage = 'verifying';
      setReaderState('scanning');
      setActuatorState('scanning');
      statusLine.textContent = 'Registering access object · FV–01';
      readerPrompt.textContent = 'AMBER VERIFICATION · READING OBJECT';
      readerHint.textContent = 'DO NOT REMOVE';
      if ('vibrate' in navigator) navigator.vibrate([7, 34, 7]);
    }, alignDuration);

    later(() => {
      setReaderState('accepted');
      setActuatorState('captured');
      statusLine.textContent = 'FV–01 verified · instrument access granted';
      readerPrompt.textContent = 'FV–01 VERIFIED · ACCESS GRANTED';
      readerHint.textContent = 'OBJECT INTAKE';
      if ('vibrate' in navigator) navigator.vibrate([12, 42, 18]);
    }, alignDuration + verifyDuration);

    later(() => {
      portal.dataset.stage = 'intake';
      setReaderState('intake');
      specimen.style.setProperty('--intake-duration', `${intakeDuration}ms`);
      specimen.dataset.intake = 'consuming';
      statusLine.textContent = 'Access object accepted · opening instrument';
    }, alignDuration + verifyDuration + acceptHold);

    later(() => {
      portal.dataset.stage = 'handoff';
      handoff.hidden = false;
      requestAnimationFrame(() => handoff.classList.add('is-visible'));
      handoff.querySelector('h1')?.focus?.({ preventScroll: true });
    }, alignDuration + verifyDuration + acceptHold + intakeDuration);

    later(() => {
      globalThis.location.assign(INSTRUMENT_URL);
    }, alignDuration + verifyDuration + acceptHold + intakeDuration + handoffHold);
  }

  function resetPortal() {
    clearSequenceTimers();
    clearMotionFallback();
    pointerStart = null;
    isFlipping = false;
    isPresenting = false;
    flipRotation = 0;
    dragRotation = 0;

    portal.dataset.stage = 'receiving';
    controls.removeAttribute('aria-hidden');
    readerSlot.disabled = false;
    handoff.classList.remove('is-visible');
    handoff.hidden = true;
    specimen.removeAttribute('data-intake');
    specimen.removeAttribute('data-presenting');
    specimen.style.removeProperty('--intake-x');
    specimen.style.removeProperty('--intake-y');
    specimen.style.removeProperty('--intake-duration');
    setCss('--flip-rotation', '0deg');
    setCss('--drag-rotation', '0deg');
    setCss('--settle-duration', '0ms');
    delete specimen.dataset.motion;
    delete specimen.dataset.dragging;
    setReaderState('idle');
    setActuatorState('rest');
    setFace('front', false);
    resetMaterial();
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

    const rect = specimen.getBoundingClientRect();
    pointerStart = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      axis: null,
      readerProgress: 0,
    };

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

    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!pointerStart.axis && Math.max(absX, absY) > 8) {
      if (face === 'back' && deltaY > 0 && absY > absX * 1.12) {
        pointerStart.axis = 'present';
      } else if (absX > absY * 1.04) {
        pointerStart.axis = 'flip';
      }
    }

    if (pointerStart.axis === 'present') {
      const progress = clamp(deltaY / 120, 0, 1);
      const shiftY = clamp(deltaY * 0.76, 0, 116);
      const shiftX = clamp(deltaX * 0.08, -10, 10);
      pointerStart.readerProgress = progress;
      dragRotation = 0;
      specimen.dataset.presenting = 'true';

      setCss('--drag-rotation', '0deg');
      setCss('--drag-shift-x', `${shiftX}px`);
      setCss('--drag-shift-y', `${shiftY}px`);
      setCss('--drag-lift', `${10 + progress * 5}px`);
      setCss('--tilt-x', `${progress * 3.5}deg`);
      setCss('--tilt-z', `${clamp(deltaX / 120, -1.6, 1.6)}deg`);
      setCss('--shadow-shift-x', `${shiftX * 0.4}px`);
      setCss('--reader-progress', `${progress}`);
      setCss('--glint-y', `${clamp(20 + progress * 54, 20, 74)}%`);
      setCss('--glint-opacity', `${0.26 + progress * 0.2}`);

      if (progress > 0.35) {
        setReaderState('magnetic');
        readerPrompt.textContent = progress > 0.72
          ? 'MAGNETIC CAPTURE · RELEASE TO PRESENT'
          : 'READER FIELD DETECTED · CONTINUE';
        readerHint.textContent = `${Math.round(progress * 100)}% ALIGNMENT`;
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
      if (start.readerProgress > 0.56 || deltaY > 70) {
        presentSpecimen('drag');
        return;
      }
      springBack();
      return;
    }

    if (start.axis === 'flip') {
      const committed = (
        Math.abs(deltaX) > 46
        && Math.abs(deltaX) > Math.abs(deltaY)
      ) || horizontalSpeed > 0.62;

      if (committed) {
        animateFlip(deltaX < 0 ? -1 : 1, horizontalSpeed);
        return;
      }
    }

    springBack();
  });

  specimen.addEventListener('pointercancel', () => {
    if (!pointerStart) return;
    pointerStart = null;
    springBack();
  });

  specimen.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      animateFlip(-1, 0.8);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      animateFlip(1, 0.8);
      return;
    }
    if (event.key === 'ArrowDown' && face === 'back') {
      event.preventDefault();
      presentSpecimen('keyboard');
      return;
    }
    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      animateFlip(-1, 0.8);
    }
  });

  flipButton.addEventListener('click', () => animateFlip(-1, 0.8));
  readerSlot.addEventListener('click', () => presentSpecimen('reader'));
  actuator.addEventListener('click', (event) => {
    event.stopPropagation();
    presentSpecimen('actuator');
  });
  handoffLink.addEventListener('click', () => clearSequenceTimers());

  window.addEventListener('pageshow', (event) => {
    if (event.persisted || portal.dataset.stage !== 'receiving') resetPortal();
  });

  resetPortal();
})();
