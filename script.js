(() => {
  'use strict';

  const portal = document.querySelector('.portal');
  const specimen = document.querySelector('[data-specimen]');
  const card = specimen?.querySelector('.specimen__card');
  const actuator = document.querySelector('[data-actuator]');
  const flipButton = document.querySelector('[data-flip]');
  const controls = document.querySelector('[data-artifact-controls]');
  const statusLine = document.querySelector('[data-status-line]');
  const accepted = document.querySelector('[data-accepted]');
  const replayButton = document.querySelector('[data-replay]');

  if (
    !portal
    || !specimen
    || !card
    || !actuator
    || !flipButton
    || !controls
    || !statusLine
    || !accepted
    || !replayButton
  ) {
    return;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let face = 'front';
  let pointerStart = null;
  let activationTimer = null;
  let motionFallbackTimer = null;
  let flipRotation = 0;
  let dragRotation = 0;
  let isFlipping = false;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function setCss(name, value) {
    specimen.style.setProperty(name, value);
  }

  function clearMotionFallback() {
    if (motionFallbackTimer) window.clearTimeout(motionFallbackTimer);
    motionFallbackTimer = null;
  }

  function setFace(nextFace, announce = true) {
    face = nextFace;
    specimen.dataset.face = face;
    actuator.disabled = face !== 'front';
    actuator.setAttribute(
      'aria-label',
      face === 'front' ? 'Activate Specimen Pass' : 'Flip to the front before activating',
    );

    if (announce) {
      statusLine.textContent = face === 'front'
        ? 'Specimen Pass received · actuator available'
        : 'Reverse field inspected · return to front to activate';
    }
  }

  function resetMaterial(delay = 0) {
    window.setTimeout(() => {
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

  function finishMotion(nextFace = null) {
    clearMotionFallback();
    isFlipping = false;
    dragRotation = 0;
    setCss('--drag-rotation', '0deg');
    setCss('--settle-duration', '680ms');
    delete specimen.dataset.motion;

    if (nextFace) setFace(nextFace);
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
    if (portal.dataset.stage !== 'receiving' || isFlipping) return;

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
    specimen.dataset.motion = 'flipping';
    statusLine.textContent = nextFace === 'front'
      ? 'Returning specimen · front field'
      : 'Turning specimen · reverse field';

    setCss('--settle-duration', `${duration}ms`);
    setCss('--drag-lift', reduced ? '0px' : '8px');
    setCss('--shadow-scale', '0.9');
    setCss('--shadow-opacity', '0.26');
    setCss('--glint-opacity', face === 'front' ? '0.34' : '0.42');

    // Enable transitions before committing one continuous transform from the
    // exact dragged angle to the exact next face angle.
    void card.offsetWidth;
    dragRotation = 0;
    flipRotation = targetRotation;
    setCss('--drag-rotation', '0deg');
    setCss('--flip-rotation', `${targetRotation}deg`);

    waitForTransform(duration, () => finishMotion(nextFace));

    if ('vibrate' in navigator) navigator.vibrate([6, 24, 9]);
  }

  function springBack() {
    if (isFlipping) return;

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
    resetMaterial();

    waitForTransform(duration, () => finishMotion());
  }

  function setActuatorState(state) {
    actuator.dataset.actuatorState = state;
    const miniActuators = document.querySelectorAll('.actuator--mini, .actuator--tiny');
    miniActuators.forEach((item) => { item.dataset.actuatorState = state; });
  }

  function activate() {
    if (portal.dataset.stage !== 'receiving' || face !== 'front' || isFlipping) return;

    portal.dataset.stage = 'activating';
    controls.setAttribute('aria-hidden', 'true');
    actuator.disabled = true;
    setActuatorState('ready');
    statusLine.textContent = 'Object recognized · preparing intake';
    if ('vibrate' in navigator) navigator.vibrate([10, 42, 12]);

    const scanDelay = prefersReducedMotion.matches ? 30 : 360;
    const captureDelay = prefersReducedMotion.matches ? 70 : 1080;
    const acceptDelay = prefersReducedMotion.matches ? 110 : 1550;

    window.setTimeout(() => {
      setActuatorState('scanning');
      statusLine.textContent = 'Registering access object · FV–01';
    }, scanDelay);

    window.setTimeout(() => {
      setActuatorState('captured');
      statusLine.textContent = 'Access object accepted';
    }, captureDelay);

    activationTimer = window.setTimeout(() => {
      portal.dataset.stage = 'accepted';
      accepted.hidden = false;
      requestAnimationFrame(() => accepted.classList.add('is-visible'));
      accepted.querySelector('h1')?.focus?.();
    }, acceptDelay);
  }

  function replay() {
    if (activationTimer) window.clearTimeout(activationTimer);
    clearMotionFallback();
    isFlipping = false;
    pointerStart = null;
    flipRotation = 0;
    dragRotation = 0;
    setCss('--flip-rotation', '0deg');
    setCss('--drag-rotation', '0deg');
    setCss('--settle-duration', '0ms');
    delete specimen.dataset.motion;
    delete specimen.dataset.dragging;
    accepted.classList.remove('is-visible');
    accepted.hidden = true;
    portal.dataset.stage = 'receiving';
    controls.removeAttribute('aria-hidden');
    setActuatorState('rest');
    setFace('front');
    resetMaterial();
    statusLine.textContent = 'Receiving Specimen Pass · FV–01';
    specimen.focus({ preventScroll: true });
  }

  specimen.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button, a')) return;
    if (portal.dataset.stage !== 'receiving' || isFlipping) return;

    const rect = specimen.getBoundingClientRect();
    pointerStart = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
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
    if (!pointerStart || portal.dataset.stage !== 'receiving' || isFlipping) return;

    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    dragRotation = clamp(deltaX * 0.43, -82, 82);

    const localX = clamp(((event.clientX - pointerStart.left) / pointerStart.width) * 100, 8, 92);
    const localY = clamp(((event.clientY - pointerStart.top) / pointerStart.height) * 100, 8, 92);
    const shiftX = clamp(deltaX * 0.14, -20, 20);
    const shiftY = clamp(deltaY * 0.08, -8, 8);
    const lift = 8 + Math.min(Math.abs(deltaX) / 18, 7);

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
    setCss('--glint-opacity', `${0.25 + Math.min(Math.abs(deltaX) / 420, 0.2)}`);
  });

  specimen.addEventListener('pointerup', (event) => {
    if (!pointerStart) return;

    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    const elapsed = Math.max(16, performance.now() - pointerStart.time);
    const speed = Math.abs(deltaX) / elapsed;
    pointerStart = null;

    const committed = (
      Math.abs(deltaX) > 46
      && Math.abs(deltaX) > Math.abs(deltaY)
    ) || speed > 0.62;

    if (committed) {
      animateFlip(deltaX < 0 ? -1 : 1, speed);
      return;
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
    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      animateFlip(-1, 0.8);
    }
  });

  flipButton.addEventListener('click', () => animateFlip(-1, 0.8));
  actuator.addEventListener('click', (event) => {
    event.stopPropagation();
    activate();
  });
  replayButton.addEventListener('click', replay);

  resetMaterial();

  window.setTimeout(() => {
    if (portal.dataset.stage === 'receiving') {
      statusLine.textContent = 'Specimen Pass received · inspect or activate';
      setActuatorState('ready');
    }
  }, prefersReducedMotion.matches ? 20 : 1250);
})();
