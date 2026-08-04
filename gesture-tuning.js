(() => {
  'use strict';

  const portal = document.querySelector('.portal');
  const specimen = document.querySelector('[data-specimen]');
  const readerSlot = document.querySelector('[data-reader-slot]');
  const readerMouth = readerSlot?.querySelector('.reader__mouth');

  if (!portal || !specimen || !readerSlot || !readerMouth) return;

  let gesture = null;

  function resetGesture() {
    gesture = null;
  }

  specimen.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button, a')) return;
    if (portal.dataset.stage !== 'receiving') return;

    gesture = {
      x: event.clientX,
      y: event.clientY,
      downward: false,
    };
  }, { capture: true });

  specimen.addEventListener('pointermove', (event) => {
    if (!gesture || portal.dataset.stage !== 'receiving') return;

    const deltaX = event.clientX - gesture.x;
    const deltaY = event.clientY - gesture.y;
    gesture.downward = (
      specimen.dataset.face === 'back'
      && deltaY > 24
      && Math.abs(deltaY) > Math.abs(deltaX) * 1.04
    );
  }, { capture: true });

  specimen.addEventListener('pointerup', (event) => {
    if (!gesture || portal.dataset.stage !== 'receiving') {
      resetGesture();
      return;
    }

    const deltaX = event.clientX - gesture.x;
    const deltaY = event.clientY - gesture.y;
    const cardRect = specimen.getBoundingClientRect();
    const mouthRect = readerMouth.getBoundingClientRect();
    const horizontalOffset = Math.abs(
      (cardRect.left + cardRect.width / 2)
      - (mouthRect.left + mouthRect.width / 2)
    );
    const verticalGap = mouthRect.top - cardRect.bottom;

    const intentionalDownwardDrag = (
      gesture.downward
      && deltaY >= 68
      && Math.abs(deltaY) > Math.abs(deltaX) * 1.04
    );
    const physicallyNearReader = (
      verticalGap <= 118
      && verticalGap >= -72
      && horizontalOffset <= cardRect.width * 0.54
    );
    const committed = intentionalDownwardDrag && (
      physicallyNearReader
      || deltaY >= 108
    );

    resetGesture();

    if (!committed) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    readerSlot.click();
  }, { capture: true });

  specimen.addEventListener('pointercancel', resetGesture, { capture: true });
  window.addEventListener('pageshow', resetGesture);
})();
