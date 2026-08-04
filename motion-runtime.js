(() => {
  'use strict';

  const INSTRUMENT_URL = 'https://face-value-seven.vercel.app/?source=specimen-pass';
  const DURATION = 1650;
  const CELL_STARTS = [340, 380, 420, 460, 500, 540, 580];
  const CELL_POSITIONS = [[1, 1], [3, 1], [1, 3], [2, 2], [4, 2], [2, 3], [3, 3]];

  const portal = document.querySelector('.portal');
  const field = document.querySelector('.field');
  const specimen = document.querySelector('[data-specimen]');
  const matrix = document.querySelector('.card-face--back .matrix-code');
  const reader = document.querySelector('[data-reader]');
  const readerHardware = document.querySelector('[data-reader-slot]');
  const readerPrompt = document.querySelector('[data-reader-prompt]');
  const readerHint = document.querySelector('[data-reader-hint]');
  const statusLine = document.querySelector('[data-status-line]');
  const handoff = document.querySelector('[data-handoff]');
  const handoffEyebrow = handoff?.querySelector('.handoff__eyebrow');
  const handoffTitle = handoff?.querySelector('h1');
  const handoffLink = handoff?.querySelector('[data-handoff-link]');

  if (
    !portal || !field || !specimen || !matrix || !reader || !readerHardware
    || !readerPrompt || !readerHint || !statusLine || !handoff
    || !handoffEyebrow || !handoffTitle || !handoffLink
  ) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new Set();
  const animations = new Set();
  let active = false;
  let sequenceToken = 0;

  function later(callback, delay, token = sequenceToken) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (token !== sequenceToken) return;
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function animate(node, keyframes, options) {
    if (!node || typeof node.animate !== 'function') return null;
    const animation = node.animate(keyframes, { fill: 'both', ...options });
    animations.add(animation);
    const cleanup = () => animations.delete(animation);
    animation.addEventListener?.('finish', cleanup, { once: true });
    animation.addEventListener?.('cancel', cleanup, { once: true });
    return animation;
  }

  function clearTimeline() {
    sequenceToken += 1;
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
    animations.forEach((animation) => animation.cancel());
    animations.clear();
  }

  function actuatorMarkup() {
    return '<span class="actuator__bezel"></span><span class="actuator__recess"></span><span class="actuator__ring"></span><span class="actuator__cap"></span><span class="actuator__gloss"></span>';
  }

  function buildRedemptionLayer() {
    const existing = matrix.querySelector('.matrix-redemption');
    if (existing) return existing;
    const overlay = document.createElement('span');
    overlay.className = 'matrix-redemption';
    overlay.setAttribute('aria-hidden', 'true');

    const halo = document.createElement('span');
    halo.className = 'matrix-redemption__halo';
    overlay.append(halo);

    const cellsLayer = document.createElement('span');
    cellsLayer.className = 'matrix-redemption__cells';
    CELL_POSITIONS.forEach(([column, row], index) => {
      const cell = document.createElement('span');
      cell.className = 'matrix-redemption__cell';
      cell.dataset.redemptionCell = String(index + 1);
      cell.style.gridColumn = String(column);
      cell.style.gridRow = String(row);
      cellsLayer.append(cell);
    });
    overlay.append(cellsLayer);

    const wellLayer = document.createElement('span');
    wellLayer.className = 'matrix-redemption__well-layer';
    const well = document.createElement('span');
    well.className = 'matrix-redemption__well';
    wellLayer.append(well);
    overlay.append(wellLayer);

    const label = document.createElement('span');
    label.className = 'matrix-redemption__label';
    label.textContent = 'FV–01 / REDEEMED';
    overlay.append(label);
    matrix.append(overlay);
    return overlay;
  }

  function buildReaderSweep() {
    let viewport = readerHardware.querySelector('.reader__verification-viewport');
    if (viewport) return viewport;
    viewport = document.createElement('span');
    viewport.className = 'reader__verification-viewport';
    viewport.setAttribute('aria-hidden', 'true');
    const sweep = document.createElement('span');
    sweep.className = 'reader__verification-sweep';
    viewport.append(sweep);
    readerHardware.append(viewport);
    return viewport;
  }

  function buildContinuityObjects() {
    let chip = field.querySelector('.redemption-chip');
    if (!chip) {
      chip = document.createElement('span');
      chip.className = 'redemption-chip';
      chip.setAttribute('aria-hidden', 'true');
      field.append(chip);
    }
    let actuator = field.querySelector('.redemption-actuator');
    if (!actuator) {
      actuator = document.createElement('span');
      actuator.className = 'actuator redemption-actuator';
      actuator.dataset.actuatorState = 'captured';
      actuator.setAttribute('aria-hidden', 'true');
      actuator.innerHTML = actuatorMarkup();
      field.append(actuator);
    }
    return { chip, actuator };
  }

  const redemption = buildRedemptionLayer();
  const halo = redemption.querySelector('.matrix-redemption__halo');
  const cells = [...redemption.querySelectorAll('.matrix-redemption__cell')];
  const well = redemption.querySelector('.matrix-redemption__well');
  const label = redemption.querySelector('.matrix-redemption__label');
  const sweep = buildReaderSweep().querySelector('.reader__verification-sweep');
  const { chip, actuator: continuityActuator } = buildContinuityObjects();

  function setCopy(status, prompt, hint) {
    statusLine.textContent = status;
    readerPrompt.textContent = prompt;
    readerHint.textContent = hint;
  }

  function setHandoffCopy() {
    handoffEyebrow.textContent = 'MATRIX REDEEMED · FV–01';
    handoffTitle.textContent = 'Instrument access granted.';
  }

  function continuityTarget() {
    const fieldRect = field.getBoundingClientRect();
    const size = 54;
    const x = fieldRect.width / 2;
    const y = Math.max(138, fieldRect.height * 0.25);
    chip.style.left = `${x - 8}px`;
    chip.style.top = `${y - 8}px`;
    continuityActuator.style.left = `${x - size / 2}px`;
    continuityActuator.style.top = `${y - size / 2}px`;
    return { x: fieldRect.left + x, y: fieldRect.top + y };
  }

  function punchCellCenter() {
    const sourceCell = matrix.querySelector(':scope > i:nth-child(11)');
    const rect = sourceCell?.getBoundingClientRect() ?? matrix.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function forceReverseForContinuity() {
    if (specimen.dataset.face === 'back') return;
    specimen.dataset.face = 'back';
    specimen.style.setProperty('--settle-duration', '240ms');
    specimen.style.setProperty('--flip-rotation', '-180deg');
  }

  function revealHandoff() {
    portal.dataset.stage = 'handoff';
    reader.dataset.readerState = 'accepted';
    handoff.hidden = false;
    requestAnimationFrame(() => handoff.classList.add('is-visible'));
    handoffTitle.focus?.({ preventScroll: true });
  }

  function resetRedemption() {
    clearTimeline();
    active = false;
    portal.removeAttribute('data-redemption-motion');
    matrix.classList.remove('is-punched');
    [halo, well, label, chip, continuityActuator, sweep, ...cells].forEach((node) => {
      node.getAnimations?.().forEach((animation) => animation.cancel());
      node.style.removeProperty('opacity');
      node.style.removeProperty('transform');
    });
    chip.style.opacity = '0';
    continuityActuator.style.opacity = '0';
    continuityActuator.style.transform = 'scale(.35)';
    sweep.style.opacity = '0';
    handoff.classList.remove('is-visible');
    handoff.hidden = true;
    setHandoffCopy();
  }

  function runReducedSequence(token) {
    portal.dataset.redemptionMotion = 'active';
    forceReverseForContinuity();
    matrix.classList.add('is-punched');
    halo.style.opacity = '1';
    cells.forEach((cell) => { cell.style.opacity = '1'; cell.style.transform = 'scale(1)'; });
    well.style.opacity = '1';
    well.style.transform = 'scale(1)';
    label.style.opacity = '1';
    continuityTarget();
    continuityActuator.style.opacity = '1';
    continuityActuator.style.transform = 'scale(1)';
    portal.dataset.stage = 'intake';
    reader.dataset.readerState = 'intake';
    specimen.dataset.intake = 'consuming';
    setCopy('Matrix redeemed · FV–01', 'MATRIX REDEEMED · FV–01', 'OBJECT INTAKE');
    later(revealHandoff, 80, token);
    later(() => globalThis.location.assign(INSTRUMENT_URL), 420, token);
  }

  function runSequence() {
    if (active) return;
    clearTimeline();
    active = true;
    const token = sequenceToken;

    if (reducedMotion.matches) {
      runReducedSequence(token);
      return;
    }

    portal.dataset.redemptionMotion = 'active';
    forceReverseForContinuity();
    continuityTarget();
    setHandoffCopy();
    reader.dataset.readerState = 'scanning';
    setCopy('Registering matrix · FV–01', 'AMBER VERIFICATION · REGISTERING MATRIX', 'DO NOT REMOVE');

    animate(halo, [
      { opacity: 0, offset: 0 },
      { opacity: 0, offset: 0.19 },
      { opacity: 1, offset: 0.27 },
      { opacity: 1, offset: 1 },
    ], { duration: DURATION, easing: 'linear' });

    cells.forEach((cell, index) => {
      animate(cell, [
        { opacity: 0, transform: 'scale(.72)' },
        { opacity: 1, transform: 'scale(1)' },
      ], {
        delay: CELL_STARTS[index],
        duration: 80,
        easing: 'cubic-bezier(0, 0, 0.58, 1)',
      });
    });

    animate(sweep, [
      { opacity: 1, transform: 'translateX(-230px)' },
      { opacity: 1, transform: 'translateX(230px)' },
    ], { delay: 270, duration: 420, easing: 'ease-in-out' });

    later(() => {
      matrix.classList.add('is-punched');
      animate(well, [
        { opacity: 0, transform: 'scale(.38)' },
        { opacity: 1, transform: 'scale(1)' },
      ], { duration: 100, easing: 'cubic-bezier(0, 0, 0.58, 1)' });
      navigator.vibrate?.(9);
    }, 700, token);

    later(() => {
      animate(label, [{ opacity: 0 }, { opacity: 1 }], {
        duration: 100,
        easing: 'cubic-bezier(0, 0, 0.58, 1)',
      });
      setCopy('Matrix redeemed · FV–01', 'MATRIX REDEEMED · ACCESS CHIP RELEASED', 'OBJECT INTAKE');
    }, 780, token);

    later(() => {
      const start = punchCellCenter();
      const target = continuityTarget();
      const translateX = start.x - target.x;
      const translateY = start.y - target.y;
      animate(chip, [
        { opacity: 0, transform: `translate(${translateX}px, ${translateY}px) scale(.42)` },
        { opacity: 1, transform: `translate(${translateX}px, ${translateY}px) scale(.42)`, offset: 0.12 },
        { opacity: 1, transform: 'translate(0, 0) scale(1)' },
      ], { duration: 460, easing: 'cubic-bezier(0, 0, 0.58, 1)' });
    }, 780, token);

    later(() => {
      portal.dataset.stage = 'intake';
      reader.dataset.readerState = 'intake';
      specimen.dataset.intake = 'consuming';
      setCopy('Object intake · FV–01 redeemed', 'OBJECT INTAKE · FV–01 REDEEMED', 'DO NOT REMOVE');
      navigator.vibrate?.([12, 42, 18]);
    }, 860, token);

    later(() => {
      animate(continuityActuator, [
        { opacity: 0, transform: 'scale(.35)' },
        { opacity: 1, transform: 'scale(1)' },
      ], { duration: 240, easing: 'cubic-bezier(0, 0, 0.58, 1)' });
      animate(chip, [{ opacity: 1 }, { opacity: 0 }], {
        duration: 180,
        easing: 'ease-out',
      });
    }, 1120, token);

    later(() => {
      setCopy('Instrument access granted', 'MATRIX REDEEMED · FV–01', 'OPENING FACE VALUE');
      revealHandoff();
    }, 1320, token);

    later(() => globalThis.location.assign(INSTRUMENT_URL), DURATION, token);
  }

  window.addEventListener('fv:specimen-captured', runSequence);

  const fallbackObserver = new MutationObserver(() => {
    if (portal.dataset.stage === 'verifying' && !active) queueMicrotask(runSequence);
    if (portal.dataset.stage === 'receiving' && active) resetRedemption();
  });
  fallbackObserver.observe(portal, { attributes: true, attributeFilter: ['data-stage'] });

  handoffLink.addEventListener('click', clearTimeline);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted || portal.dataset.stage === 'receiving') resetRedemption();
  });

  setHandoffCopy();
  resetRedemption();
})();
