// Shared platform detection for desktop vs mobile WebExtension loader behavior.
(function() {
  'use strict';
  if (window.BestiaryPlatform) return;

  const RELAXED_LOADER_KEY = 'ba-relaxed-loader';
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

  window.BestiaryPlatform = {
    isMobileWebExtension,
    prefersRelaxedLoader,
    useStrictLoaderCompletion,
    setPageExtensionFetchWorks,
    getPageExtensionFetchWorks: () => pageExtensionFetchWorks
  };
})();
