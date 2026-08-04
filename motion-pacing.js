(() => {
  'use strict';

  const SCALE = 1.8;
  const originalSetTimeout = window.setTimeout.bind(window);
  const originalAnimate = Element.prototype.animate;
  let active = false;
  let resetTimer = 0;

  function scaleTiming(value) {
    return typeof value === 'number' ? Math.round(value * SCALE) : value;
  }

  window.setTimeout = function scaledSetTimeout(callback, delay = 0, ...args) {
    return originalSetTimeout(callback, active ? scaleTiming(delay) : delay, ...args);
  };

  Element.prototype.animate = function scaledAnimate(keyframes, options) {
    if (!active) return originalAnimate.call(this, keyframes, options);

    if (typeof options === 'number') {
      return originalAnimate.call(this, keyframes, scaleTiming(options));
    }

    const nextOptions = { ...(options || {}) };
    if (typeof nextOptions.delay === 'number') nextOptions.delay = scaleTiming(nextOptions.delay);
    if (typeof nextOptions.duration === 'number') nextOptions.duration = scaleTiming(nextOptions.duration);
    if (typeof nextOptions.endDelay === 'number') nextOptions.endDelay = scaleTiming(nextOptions.endDelay);
    return originalAnimate.call(this, keyframes, nextOptions);
  };

  window.addEventListener('fv:specimen-captured', () => {
    active = true;
    if (resetTimer) window.clearTimeout(resetTimer);
    resetTimer = originalSetTimeout(() => {
      active = false;
      resetTimer = 0;
    }, 4200);
  }, { capture: true });

  window.addEventListener('pageshow', () => {
    active = false;
    if (resetTimer) window.clearTimeout(resetTimer);
    resetTimer = 0;
  });
})();
