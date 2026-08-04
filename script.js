(() => {
  'use strict';

  const portal = document.querySelector('.portal');
  const specimen = document.querySelector('[data-specimen]');
  const actuator = document.querySelector('[data-actuator]');
  const flipButton = document.querySelector('[data-flip]');
  const controls = document.querySelector('[data-artifact-controls]');
  const statusLine = document.querySelector('[data-status-line]');
  const accepted = document.querySelector('[data-accepted]');
  const replayButton = document.querySelector('[data-replay]');

  if (!portal || !specimen || !actuator || !flipButton || !statusLine || !accepted || !replayButton) {
    return;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let face = 'front';
  let pointerStart = null;
  let activationTimer = null;

  function setFace(nextFace) {
    face = nextFace;
    specimen.dataset.face = face;
    specimen.style.removeProperty('--drag-rotation');
    statusLine.textContent = face === 'front'
      ? 'Specimen Pass received · actuator available'
      : 'Reverse field inspected · return to front to activate';
    actuator.disabled = face !== 'front';
    actuator.setAttribute(
      'aria-label',
      face === 'front' ? 'Activate Specimen Pass' : 'Flip to the front before activating',
    );
  }

  function flip() {
    if (portal.dataset.stage !== 'receiving') return;
    setFace(face === 'front' ? 'back' : 'front');
    if ('vibrate' in navigator) navigator.vibrate(8);
  }

  function setActuatorState(state) {
    actuator.dataset.actuatorState = state;
    const miniActuators = document.querySelectorAll('.actuator--mini, .actuator--tiny');
    miniActuators.forEach((item) => { item.dataset.actuatorState = state; });
  }

  function activate() {
    if (portal.dataset.stage !== 'receiving' || face !== 'front') return;

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
    accepted.classList.remove('is-visible');
    accepted.hidden = true;
    portal.dataset.stage = 'receiving';
    controls.removeAttribute('aria-hidden');
    setActuatorState('rest');
    setFace('front');
    statusLine.textContent = 'Receiving Specimen Pass · FV–01';
    specimen.focus({ preventScroll: true });
  }

  specimen.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button, a')) return;
    if (portal.dataset.stage !== 'receiving') return;
    pointerStart = { x: event.clientX, y: event.clientY };
    specimen.setPointerCapture?.(event.pointerId);
  });

  specimen.addEventListener('pointermove', (event) => {
    if (!pointerStart || portal.dataset.stage !== 'receiving') return;
    const deltaX = event.clientX - pointerStart.x;
    specimen.style.setProperty('--drag-rotation', `${Math.max(-16, Math.min(16, deltaX / 9))}deg`);
  });

  specimen.addEventListener('pointerup', (event) => {
    if (!pointerStart) return;
    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    pointerStart = null;
    specimen.style.removeProperty('--drag-rotation');
    if (Math.abs(deltaX) > 54 && Math.abs(deltaX) > Math.abs(deltaY)) flip();
  });

  specimen.addEventListener('pointercancel', () => {
    pointerStart = null;
    specimen.style.removeProperty('--drag-rotation');
  });

  specimen.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key.toLowerCase() === 'f') {
      event.preventDefault();
      flip();
    }
  });

  flipButton.addEventListener('click', flip);
  actuator.addEventListener('click', (event) => {
    event.stopPropagation();
    activate();
  });
  replayButton.addEventListener('click', replay);

  window.setTimeout(() => {
    if (portal.dataset.stage === 'receiving') {
      statusLine.textContent = 'Specimen Pass received · inspect or activate';
      setActuatorState('ready');
    }
  }, prefersReducedMotion.matches ? 20 : 1250);
})();
