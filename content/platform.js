// Shared platform detection for desktop vs mobile WebExtension loader behavior.
(function() {
  'use strict';
  if (window.BestiaryPlatform) return;

  const RELAXED_LOADER_KEY = 'ba-relaxed-loader';
  const LONG_PRESS_CONTEXT_KEY = 'ba-long-press-context';
  let pageExtensionFetchWorks = null;

  function isMobileWebExtension() {
    const ua = navigator.userAgent || '';
    const touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return /iPhone|iPad|iPod|Android|Orion/i.test(ua) || touchMac;
  }

  function getSessionRelaxedOverride() {
    try {
      const value = sessionStorage.getItem(RELAXED_LOADER_KEY);
      if (value === '1') return true;
      if (value === '0') return false;
    } catch {
      // ignore storage failures
    }
    return null;
  }

  function getSessionLongPressOverride() {
    try {
      const value = sessionStorage.getItem(LONG_PRESS_CONTEXT_KEY);
      if (value === '1') return true;
      if (value === '0') return false;
    } catch {
      // ignore storage failures
    }
    return null;
  }

  function setPageExtensionFetchWorks(works) {
    pageExtensionFetchWorks = works;
  }

  function prefersRelaxedLoader() {
    const override = getSessionRelaxedOverride();
    if (override !== null) return override;
    if (pageExtensionFetchWorks === false) return true;
    return isMobileWebExtension();
  }

  function useStrictLoaderCompletion() {
    return !prefersRelaxedLoader();
  }

  // Mobile WebExtensions: content-script bridge fetch first; page/background fetch may fail on WebKit.
  function prefersDirectModFetchFirst() {
    return false;
  }

  function prefersLongPressContextMenu() {
    const override = getSessionLongPressOverride();
    if (override !== null) return override;
    return isMobileWebExtension();
  }

  /**
   * Touch hold → synthetic contextmenu so mod right-click handlers work on mobile.
   * Installed automatically on mobile; desktop test: sessionStorage.setItem('ba-long-press-context', '1')
   */
  function installLongPressContextMenu(options = {}) {
    if (window.__baLongPressContextInstalled) return;

    const HOLD_MS = options.holdMs ?? 500;
    const MOVE_THRESHOLD_PX = options.moveThresholdPx ?? 10;
    const SUPPRESS_CLICK_MS = options.suppressClickMs ?? 500;
    const DEBOUNCE_MS = options.debounceMs ?? 300;

    let active = null;
    let suppressClickUntil = 0;
    let lastSyntheticAt = 0;

    function clearActive() {
      if (!active) return;
      if (active.timerId) clearTimeout(active.timerId);
      active = null;
    }

    function fireContextMenu(clientX, clientY, screenX, screenY, fallbackTarget) {
      const now = Date.now();
      if (now - lastSyntheticAt < DEBOUNCE_MS) return;
      lastSyntheticAt = now;
      suppressClickUntil = now + SUPPRESS_CLICK_MS;

      const target = document.elementFromPoint(clientX, clientY) || fallbackTarget;
      if (!target) return;

      const menuEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 2,
        buttons: 2,
        clientX,
        clientY,
        screenX,
        screenY
      });

      target.dispatchEvent(menuEvent);

      if (typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(10);
        } catch {
          // ignore vibration failures
        }
      }
    }

    function onPointerDown(event) {
      if (event.pointerType !== 'touch') return;
      if (event.isPrimary === false) return;

      clearActive();

      const pointerId = event.pointerId;
      active = {
        pointerId,
        startX: event.clientX,
        startY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
        target: event.target,
        timerId: setTimeout(() => {
          if (!active || active.pointerId !== pointerId) return;
          const { clientX, clientY, screenX, screenY, target } = active;
          fireContextMenu(clientX, clientY, screenX, screenY, target);
          clearActive();
        }, HOLD_MS)
      };
    }

    function onPointerMove(event) {
      if (!active || event.pointerId !== active.pointerId) return;

      active.clientX = event.clientX;
      active.clientY = event.clientY;
      active.screenX = event.screenX;
      active.screenY = event.screenY;

      const dx = event.clientX - active.startX;
      const dy = event.clientY - active.startY;
      if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) clearActive();
    }

    function onPointerEnd(event) {
      if (!active || event.pointerId !== active.pointerId) return;
      clearActive();
    }

    function suppressGhostClick(event) {
      if (Date.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
    }

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerEnd, true);
    document.addEventListener('pointercancel', onPointerEnd, true);
    document.addEventListener('click', suppressGhostClick, true);

    window.__baLongPressContextInstalled = true;
  }

  window.BestiaryPlatform = {
    isMobileWebExtension,
    prefersRelaxedLoader,
    prefersDirectModFetchFirst,
    useStrictLoaderCompletion,
    setPageExtensionFetchWorks,
    getPageExtensionFetchWorks: () => pageExtensionFetchWorks,
    prefersLongPressContextMenu,
    installLongPressContextMenu,
    LONG_PRESS_CONTEXT_KEY
  };

  if (prefersLongPressContextMenu()) {
    installLongPressContextMenu();
  }
})();
