// =======================
// Better Bestiary
// =======================
(function () {
  if (window.__betterBestiaryLoaded) return;
  window.__betterBestiaryLoaded = true;

  // Cross-mod contract consumed by Cyclopedia.js (close/prepareClose/isOpen) and
  // Depot_Manager.js (showDepotCreatures) - one namespaced object instead of four
  // separate bare globals (__betterBestiaryClose/PrepareClose/IsOpen/ShowDepotCreatures).
  window.BetterBestiary = window.BetterBestiary || {};

  const defaultConfig = { enabled: true };
  const config = Object.assign({}, defaultConfig, context?.config);

  const NS = 'better-bestiary';
  const ENHANCED_ATTR = 'data-better-bestiary-enhanced';
  const AWAKEN_TIER = 6;
  const MOD_SETTINGS_STORAGE_KEY = 'better-ui-config';
  const BTN_CLASS =
    'focus-style-visible flex w-full items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 h-[21px] min-h-[21px] max-h-[21px] py-0 pixel-font-14 [&_svg]:size-[11px] [&_svg]:mb-[1px] [&_svg]:mt-[2px]';

  const PRESET_KEYS = ['shiny', 'awakened', 'both'];

  let observer = null;
  let gridObserver = null;
  let gridObserverTarget = null;
  let layoutObserver = null;
  let layoutObserverDetailsCol = null;
  let debounceTimer = null;
  let stylingTimer = null;
  let layoutSyncTimer = null;
  let modalSetupRetryId = null;
  let heightRafId = null;
  let scrollStylingRaf = null;
  let scrollStylingTarget = null;
  let fullStylingTimer = null;
  let isApplyingSelection = false;
  let isSyncingLayout = false;
  let activeModal = null;
  let onCosmeticsChanged = null;

  const GRID_STYLING_DEBOUNCE_MS = 200;
  const MODAL_CLOSE_DEBOUNCE_MS = 80;
  const LAYOUT_SYNC_DEBOUNCE_MS = 80;
  const FULL_STYLING_DEBOUNCE_MS = 48;
  const MODAL_HEIGHT_EXPAND_PX = 20;
  const INITIAL_STYLED_ATTR = `data-${NS}-initial-styled`;
  const SIZED_ATTR = `data-${NS}-sized`;
  const LAYOUT_SIZED_ATTR = `data-${NS}-layout-sized`;
  const DETAILS_LAYOUT_ATTR = `data-${NS}-details-layout`;
  const DETAILS_TITLE_ATTR = `data-${NS}-details-title`;
  const DETAILS_TITLE_BLOCK_ATTR = `data-${NS}-details-title-block`;
  const HEADER_LABEL_SUPPRESSED_ATTR = `data-${NS}-header-label-suppressed`;
  const ORIGINAL_LABEL_ATTR = `data-${NS}-original-label`;
  const TITLE_TEXT_ATTR = `data-${NS}-title-text`;
  const CREATURE_DETAILS_LABEL_RE = /creature\s*details|detalhes\s*(da\s*)?criatura/i;
  const FILTERS_ATTR = `data-${NS}-filters`;
  const PRESET_ATTR = `data-${NS}-preset`;
  const DEPOT_MULTISELECTOR_ATTR = `data-${NS}-depot-multiselector`;
  const DEPOT_CUSTOM_SELECTED_ATTR = `data-${NS}-depot-selected`;
  const COSMETIC_TOGGLE_ATTR = `data-${NS}-cosmetic-toggle`;
  const SESSION_OVERLAY_ATTR = `data-${NS}-session-overlay`;
  const DEPOT_SEND_TO_ATTR = `data-${NS}-depot-send-to`;
  const DEPOT_REMOVE_FROM_ATTR = `data-${NS}-depot-remove-from`;
  const DEPOT_SELECTED_CLASS = `${NS}-depot-selected`;
  const DEPOT_GREEN_BACKGROUND_URL =
    'https://bestiaryarena.com/_next/static/media/background-green.be515334.png';
  const FOOTER_BTN_CLASS =
    'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14 [&_svg]:size-[11px] [&_svg]:mb-[1px] [&_svg]:mt-[2px]';
  const FOOTER_BTN_SEND_CLASS =
    'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-14 [&_svg]:size-[11px] [&_svg]:mb-[1px] [&_svg]:mt-[2px]';
  const ACTIVATED_TITLE_COLOR = 'rgb(50, 205, 50)';
  const BTN_TOGGLE_BASE =
    'focus-style-visible flex w-full items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 gap-1 px-1 h-[21px] min-h-[21px] max-h-[21px] py-0 pixel-font-14 whitespace-nowrap';

  const COSMETIC_TOGGLES = [
    {
      key: 'enableMaxCreatures',
      labelKey: 'mods.betterBestiary.cosmetics.maxed.label',
      tooltipKey: 'mods.betterUI.enableMaxCreatures',
    },
    {
      key: 'enableSealed',
      labelKey: 'mods.betterBestiary.cosmetics.sealed.label',
      tooltipKey: 'mods.betterUI.enableSealed',
    },
    {
      key: 'enableMaxShinies',
      labelKey: 'mods.betterBestiary.cosmetics.shinies.label',
      tooltipKey: 'mods.betterUI.enableShinies',
    },
  ];

  const SESSION_OVERLAY_TOGGLES = [
    {
      key: 'showDepot',
      labelKey: 'mods.betterBestiary.cosmetics.depot.label',
      tooltipKey: 'mods.betterBestiary.cosmetics.depot.tooltip',
    },
  ];

  function isDepotCreatureFeaturesEnabled() {
    return window.depotManager?.isCreatureDepotEnabled?.() === true;
  }

  function filtersHasDepotControls(filters) {
    if (!filters) return false;
    return !!filters.querySelector(`[${DEPOT_MULTISELECTOR_ATTR}]`)
      || !!filters.querySelector(`[${SESSION_OVERLAY_ATTR}="showDepot"]`);
  }

  function filtersHasAllDepotControls(filters) {
    if (!filters) return false;
    return !!filters.querySelector(`[${DEPOT_MULTISELECTOR_ATTR}]`)
      && !!filters.querySelector(`[${SESSION_OVERLAY_ATTR}="showDepot"]`);
  }

  function ensureDepotFiltersUpToDate(modal = findBestiaryModal()) {
    const detailsCol = findBestiaryDetailsColumn(modal);
    if (!detailsCol) return;

    const filters = detailsCol.querySelector(`[${FILTERS_ATTR}="true"]`);
    if (!filters) return;

    const shouldHaveDepot = isDepotCreatureFeaturesEnabled();
    if (shouldHaveDepot && !filtersHasAllDepotControls(filters)) {
      ensureFiltersPanel(detailsCol);
      return;
    }
    if (!shouldHaveDepot && filtersHasDepotControls(filters)) {
      ensureFiltersPanel(detailsCol);
    }
  }

  let sessionOverlayState = { showDepot: false };
  let sessionOverlaySessionActive = false;
  let depotMultiselectorActive = false;
  let depotMultiselectListener = null;
  const depotCustomSelectedIds = new Set();

  let savedCosmeticSnapshot = null;

  const tick = (ms = 16) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitFrame = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  function resetDepotMultiselectorSession() {
    depotMultiselectorActive = false;
    depotCustomSelectedIds.clear();
    detachDepotMultiselectClickHandler();
  }

  function clearDepotGreyscaleOnButton(button) {
    if (!button) return;
    window.depotManager?.clearBetterBestiaryDepotGreyscale?.(button);
    const slot = button.querySelector('.container-slot');
    const img = button.querySelector('img[alt="creature"]');
    if (slot) window.depotManager?.clearBetterBestiaryDepotGreyscale?.(slot);
    if (img) img.style.removeProperty('filter');
  }

  function applyDepotCustomSelectionVisual(button, selected, { refreshGreyscale = true } = {}) {
    if (!button) return;
    const modal = findBestiaryModal();
    const slot = button.querySelector('.container-slot');

    if (selected) {
      button.setAttribute(DEPOT_CUSTOM_SELECTED_ATTR, 'true');
      button.classList.add(DEPOT_SELECTED_CLASS);
      button.setAttribute('data-state', 'selected');
      clearDepotGreyscaleOnButton(button);
      if (slot) {
        slot.setAttribute(DEPOT_CUSTOM_SELECTED_ATTR, 'true');
        slot.style.background = `url("${DEPOT_GREEN_BACKGROUND_URL}") repeat`;
        slot.style.boxShadow = 'inset 0 0 0 1px rgba(255, 255, 255, 0.95)';
        slot.style.outline = '1px solid rgba(255, 255, 255, 0.85)';
        slot.style.outlineOffset = '-1px';
      }
      return;
    }

    button.removeAttribute(DEPOT_CUSTOM_SELECTED_ATTR);
    button.classList.remove(DEPOT_SELECTED_CLASS);
    if (button.getAttribute('data-state') === 'selected') {
      button.setAttribute('data-state', 'closed');
    }
    if (slot?.getAttribute(DEPOT_CUSTOM_SELECTED_ATTR) === 'true') {
      slot.removeAttribute(DEPOT_CUSTOM_SELECTED_ATTR);
      slot.style.background = '';
      slot.style.boxShadow = '';
      slot.style.outline = '';
      slot.style.outlineOffset = '';
    }
    if (refreshGreyscale && modal) {
      refreshDepotOverlayLayout(modal);
    }
  }

  function isDepotCustomSelected(button) {
    return button?.classList.contains(DEPOT_SELECTED_CLASS);
  }

  function clearDepotCustomSelection(modal = findBestiaryModal()) {
    depotCustomSelectedIds.clear();
    if (!modal) return;
    for (const button of getCreatureButtons(modal)) {
      applyDepotCustomSelectionVisual(button, false, { refreshGreyscale: false });
    }
    refreshDepotOverlayLayout(modal);
  }

  function syncDepotCustomSelectionVisuals(modal = findBestiaryModal()) {
    if (!modal || !depotMultiselectorActive) return;

    const depotMap = getBestiaryCreatureIdMap();
    for (const button of getCreatureButtons(modal)) {
      const id = resolveMonsterIdFromButton(button, depotMap);
      const shouldSelect = id != null && depotCustomSelectedIds.has(id);
      if (isDepotCustomSelected(button) !== shouldSelect) {
        applyDepotCustomSelectionVisual(button, shouldSelect);
        continue;
      }
      if (shouldSelect && !button.classList.contains(DEPOT_SELECTED_CLASS)) {
        applyDepotCustomSelectionVisual(button, true, { refreshGreyscale: false });
      } else if (shouldSelect) {
        clearDepotGreyscaleOnButton(button);
      }
    }
  }

  function toggleDepotCustomSelection(button, modal = findBestiaryModal()) {
    const id = resolveMonsterIdFromButton(button, getBestiaryCreatureIdMap());
    if (!id) return;

    if (depotCustomSelectedIds.has(id)) {
      depotCustomSelectedIds.delete(id);
      applyDepotCustomSelectionVisual(button, false);
    } else {
      depotCustomSelectedIds.add(id);
      applyDepotCustomSelectionVisual(button, true);
    }

    updateDepotFooterButtons(modal);
  }

  function scheduleDepotFooterEnsure(modal) {
    if (!modal || !depotMultiselectorActive) return;

    let attempts = 0;
    const retry = () => {
      if (!depotMultiselectorActive || findBestiaryModal() !== modal) return;
      ensureDepotFooterButtons(modal);
      if (!modal.querySelector(`[${DEPOT_SEND_TO_ATTR}]`) && attempts < 24) {
        attempts += 1;
        requestAnimationFrame(retry);
      }
    };
    retry();
  }

  function detachDepotMultiselectClickHandler() {
    if (!depotMultiselectListener) return;
    depotMultiselectListener.grid.removeEventListener('click', depotMultiselectListener.handler, true);
    depotMultiselectListener = null;
  }

  function attachDepotMultiselectClickHandler(modal) {
    const grid = getCreatureGrid(modal);
    if (!grid) return;

    if (depotMultiselectListener?.grid === grid) return;
    detachDepotMultiselectClickHandler();

    const handler = (event) => {
      if (!depotMultiselectorActive) return;

      const button = event.target.closest('button');
      if (!button || !grid.contains(button)) return;
      if (!button.querySelector('img[alt="creature"]')) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleDepotCustomSelection(button, modal);
    };

    grid.addEventListener('click', handler, true);
    depotMultiselectListener = { grid, handler };
  }

  function resetSessionOverlayState() {
    resetDepotMultiselectorSession();
    sessionOverlaySessionActive = false;
    sessionOverlayState = { showDepot: false };
    delete window.BetterBestiary?.showDepotCreatures;
  }

  function beginSessionOverlaySession() {
    if (sessionOverlaySessionActive) return;
    sessionOverlaySessionActive = true;
    sessionOverlayState = { showDepot: false };
    syncBetterBestiaryShowDepotFlag();
  }

  function syncBetterBestiaryShowDepotFlag() {
    window.BetterBestiary.showDepotCreatures = () => sessionOverlayState.showDepot === true;
  }

  function refreshDepotOverlayLayout(modal = findBestiaryModal()) {
    if (!modal) return;
    window.depotManager?.applyBetterBestiaryDepotLayout?.(modal)
      ?? window.depotManager?.applyDepotLayout?.();
    syncDepotCustomSelectionVisuals(modal);
  }

  function getBestiaryCreatureIdMap() {
    try {
      return window.depotManager?.getBestiaryCreatureIdMap?.() ?? null;
    } catch {
      return null;
    }
  }

  function hasModSettingsCreatureStylingEnabled() {
    const uiConfig = window.betterUIConfig;
    if (uiConfig) {
      return !!(uiConfig.enableMaxCreatures || uiConfig.enableMaxShinies || uiConfig.enableSealed);
    }
    try {
      const saved = localStorage.getItem(MOD_SETTINGS_STORAGE_KEY);
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      return !!(parsed.enableMaxCreatures || parsed.enableMaxShinies || parsed.enableSealed);
    } catch {
      return false;
    }
  }

  function applyCreatureStyling(modal, { incremental = false } = {}) {
    if (!modal || !config.enabled) return;
    if (!hasModSettingsCreatureStylingEnabled()) {
      window.BetterUIRemoveCreatureCosmeticsIn?.(modal);
      return;
    }
    if (incremental) {
      window.BetterUIApplyCreatureCosmeticsIncrementalIn?.(modal);
      return;
    }
    window.BetterUIApplyCreatureCosmeticsIn?.(modal);
  }

  function scheduleIncrementalStyling(modal) {
    if (!modal || isApplyingSelection || !hasModSettingsCreatureStylingEnabled()) return;
    clearTimeout(stylingTimer);
    stylingTimer = setTimeout(() => {
      stylingTimer = null;
      if (findBestiaryModal() !== modal) return;
      applyCreatureStyling(modal, { incremental: true });
    }, GRID_STYLING_DEBOUNCE_MS);
  }

  function scheduleFullCreatureStyling(modal) {
    if (!modal) return;
    clearTimeout(fullStylingTimer);
    fullStylingTimer = setTimeout(() => {
      fullStylingTimer = null;
      if (findBestiaryModal() !== modal) return;
      modal.removeAttribute(INITIAL_STYLED_ATTR);
      applyCreatureStyling(modal);
      modal.setAttribute(INITIAL_STYLED_ATTR, 'true');
      window.depotManager?.scheduleFavoriteHeartsUpdate?.(250);
    }, FULL_STYLING_DEBOUNCE_MS);
  }

  function onCreatureGridScroll() {
    const modal = findBestiaryModal();
    if (!modal || isApplyingSelection || scrollStylingRaf != null) return;
    scrollStylingRaf = requestAnimationFrame(() => {
      scrollStylingRaf = null;
      scheduleIncrementalStyling(modal);
    });
  }

  function detachScrollStylingListener() {
    if (scrollStylingTarget) {
      scrollStylingTarget.removeEventListener('scroll', onCreatureGridScroll);
      scrollStylingTarget = null;
    }
    if (scrollStylingRaf != null) {
      cancelAnimationFrame(scrollStylingRaf);
      scrollStylingRaf = null;
    }
  }

  function attachScrollStylingListener(modal) {
    const scrollArea = getCreatureScrollArea(modal);
    const viewport = scrollArea?.querySelector('[data-radix-scroll-area-viewport]') ?? scrollArea;
    if (!viewport) return;
    if (scrollStylingTarget === viewport) return;

    detachScrollStylingListener();
    scrollStylingTarget = viewport;
    viewport.addEventListener('scroll', onCreatureGridScroll, { passive: true });
  }

  function cancelModalSetupRetry() {
    if (modalSetupRetryId == null) return;
    cancelAnimationFrame(modalSetupRetryId);
    clearTimeout(modalSetupRetryId);
    modalSetupRetryId = null;
  }

  function clearAllTimers() {
    clearTimeout(debounceTimer);
    debounceTimer = null;
    clearTimeout(stylingTimer);
    stylingTimer = null;
    clearTimeout(layoutSyncTimer);
    layoutSyncTimer = null;
    clearTimeout(fullStylingTimer);
    fullStylingTimer = null;
    cancelModalSetupRetry();
    if (heightRafId != null) {
      cancelAnimationFrame(heightRafId);
      heightRafId = null;
    }
  }

  function detachGridObserver() {
    gridObserver?.disconnect();
    gridObserver = null;
    gridObserverTarget = null;
    detachScrollStylingListener();
  }

  function detachLayoutObserver() {
    layoutObserver?.disconnect();
    layoutObserver = null;
    layoutObserverDetailsCol = null;
    clearTimeout(layoutSyncTimer);
    layoutSyncTimer = null;
  }

  function detachAllModalObservers() {
    detachGridObserver();
    detachLayoutObserver();
    detachCombatObserver();
  }

  function prepareForExternalClose() {
    detachCombatScene();
    clearAllTimers();
    detachAllModalObservers();
    isSyncingLayout = false;
    restoreTemporaryCosmeticSettings();
    resetSessionOverlayState();
    detachDepotMultiselectClickHandler();
  }

  function teardownModalSession({ full = false, resetDom = false } = {}) {
    prepareForExternalClose();

    const modal = activeModal;
    activeModal = null;

    // React owns dialog teardown after ESC — only reset injected DOM if still open (mod disable).
    if (resetDom && modal?.isConnected && modal.getAttribute('data-state') === 'open') {
      window.BetterUIRemoveCreatureCosmeticsIn?.(modal);
      resetModalEnhancement(modal);
    }

    window.depotManager?.scheduleFavoriteHeartsUpdate?.(300);

    if (!full) return;

    if (onCosmeticsChanged) {
      window.removeEventListener('betterUICreatureCosmeticsChanged', onCosmeticsChanged);
      onCosmeticsChanged = null;
    }
    observer?.disconnect();
    observer = null;
    isApplyingSelection = false;
    window.__betterBestiaryLoaded = false;
  }

  function scheduleRetryAttempt(callback, attempt) {
    const delay = attempt <= 3 ? 0 : attempt <= 12 ? 16 : 50;
    modalSetupRetryId = delay === 0
      ? requestAnimationFrame(callback)
      : setTimeout(callback, delay);
  }

  function attachGridObserver(modal) {
    const grid = getCreatureGrid(modal);
    if (!grid) return false;
    if (gridObserver && gridObserverTarget === grid && grid.isConnected) {
      attachScrollStylingListener(modal);
      return true;
    }

    gridObserver?.disconnect();
    gridObserverTarget = grid;
    gridObserver = new MutationObserver(() => {
      scheduleIncrementalStyling(modal);
      syncDepotCustomSelectionVisuals(modal);
      checkNativeSelectionDisablesDepot(modal);
      updateDepotFooterButtons(modal);
    });
    gridObserver.observe(grid, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-multiselected', 'data-highlighted', DEPOT_CUSTOM_SELECTED_ATTR],
    });
    attachScrollStylingListener(modal);
    return true;
  }

  function isModalEnhancementReady(modal) {
    return modal.hasAttribute(ENHANCED_ATTR)
      && modal.hasAttribute(SIZED_ATTR)
      && modal.hasAttribute(LAYOUT_SIZED_ATTR)
      && !!layoutObserver
      && gridObserverTarget?.isConnected;
  }

  function ensureModalObservers(modal) {
    ensureLayoutObserver(modal);
    attachGridObserver(modal);
    ensureDepotFiltersUpToDate(modal);
    if (depotMultiselectorActive) {
      attachDepotMultiselectClickHandler(modal);
      syncDepotCustomSelectionVisuals(modal);
      ensureDepotFooterButtons(modal);
    }
  }

  function isModalSetupComplete(modal) {
    return modal.hasAttribute(ENHANCED_ATTR) && !!getCreatureGrid(modal);
  }

  function scheduleModalSetupRetry(modal = null) {
    cancelModalSetupRetry();

    let attempt = 0;
    const retry = () => {
      modalSetupRetryId = null;
      const currentModal = modal ?? findBestiaryModal();
      if (!currentModal) {
        attempt += 1;
        if (attempt > 40) return;
        scheduleRetryAttempt(retry, attempt);
        return;
      }

      enhanceModal(currentModal);
      if (isModalSetupComplete(currentModal)) return;

      attempt += 1;
      if (attempt > 40) return;

      scheduleRetryAttempt(retry, attempt);
    };

    retry();
  }

  function restoreModalInlineStyles(modal) {
    if (!modal) return;

    modal.style.height = '';
    modal.style.minHeight = '';
    modal.style.maxHeight = '';

    const rootWrapper = modal.querySelector(':scope > div');
    if (rootWrapper) {
      rootWrapper.style.height = '';
      rootWrapper.style.display = '';
      rootWrapper.style.flexDirection = '';
      rootWrapper.style.minHeight = '';
      rootWrapper.style.flex = '';
    }

    const widgetBottom = modal.querySelector('.widget-bottom');
    if (widgetBottom) {
      widgetBottom.style.display = '';
      widgetBottom.style.flexDirection = '';
      widgetBottom.style.flex = '';
      widgetBottom.style.minHeight = '';
    }

    const contentGrid = getBestiaryContentGrid(modal);
    if (contentGrid) {
      contentGrid.style.flex = '';
      contentGrid.style.minHeight = '';
      contentGrid.style.height = '';
      contentGrid.style.gridTemplateRows = '';
      contentGrid.style.alignContent = '';
    }

    const scrollArea = getCreatureScrollArea(modal);
    if (scrollArea) {
      scrollArea.style.height = '';
      scrollArea.style.minHeight = '';
      scrollArea.style.maxHeight = '';
      scrollArea.style.alignSelf = '';
      scrollArea.querySelector('[data-radix-scroll-area-viewport]')?.style.removeProperty('height');
    }
  }

  function isBetterBestiaryModalOpen() {
    return Boolean(findBestiaryModal());
  }

  function simulateEscapePresses(count = 3, intervalMs = 100) {
    return new Promise((resolve) => {
      let presses = 0;
      const press = () => {
        const init = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true };
        document.dispatchEvent(new KeyboardEvent('keydown', init));
        document.dispatchEvent(new KeyboardEvent('keyup', init));
        presses += 1;
        if (presses >= count) {
          resolve();
          return;
        }
        setTimeout(press, intervalMs);
      };
      press();
    });
  }

  function closeForExternalNavigation() {
    if (!isBetterBestiaryModalOpen()) return Promise.resolve(false);
    prepareForExternalClose();
    return simulateEscapePresses(3, 100).then(() => {
      activeModal = null;
      return true;
    });
  }

  function resetModalEnhancement(modal) {
    if (!modal) return;
    restoreModalInlineStyles(modal);
    modal.removeAttribute(ENHANCED_ATTR);
    modal.removeAttribute(INITIAL_STYLED_ATTR);
    modal.removeAttribute(SIZED_ATTR);
    modal.removeAttribute(LAYOUT_SIZED_ATTR);
    modal.querySelector(`[${FILTERS_ATTR}="true"]`)?.remove();
    removeCombatSection(modal);
    removeAdvancedFooterButton(modal);
    removeDepotFooterButtons(modal);
    modal.querySelector(`[${DETAILS_TITLE_BLOCK_ATTR}="true"]`)?.remove();
    restoreHeaderDetailsLabels(modal);
    resetDetailsColumnLayout(modal);
    for (const label of modal.querySelectorAll(`[${DETAILS_TITLE_ATTR}="true"]`)) {
      const original = label.getAttribute(ORIGINAL_LABEL_ATTR);
      label.removeAttribute(DETAILS_TITLE_ATTR);
      label.removeAttribute(ORIGINAL_LABEL_ATTR);
      label.style.color = '';
      label.style.textAlign = '';
      label.classList.remove('text-center', 'w-full');
      label.querySelector(`[${TITLE_TEXT_ATTR}]`)?.remove();
      label.querySelector(`[data-${NS}-title-credit]`)?.remove();
      if (original) label.textContent = original;
    }
  }

  function t(key, params) {
    let text = key;
    if (typeof api !== 'undefined' && api.i18n?.t) {
      text = api.i18n.t(key);
    } else if (typeof context !== 'undefined' && context.api?.i18n?.t) {
      text = context.api.i18n.t(key);
    }
    if (params && typeof text === 'string') {
      for (const [paramKey, value] of Object.entries(params)) {
        text = text.replaceAll(`{${paramKey}}`, String(value));
      }
    }
    return text;
  }

  function getPresetLabel(presetKey) {
    return t(`mods.betterBestiary.presets.${presetKey}.label`);
  }

  function getPresetTooltip(presetKey) {
    return t(`mods.betterBestiary.presets.${presetKey}.tooltip`);
  }

  function readBetterUIConfigValue(key) {
    const cfg = window.betterUIConfig;
    if (cfg && key in cfg) return !!cfg[key];
    try {
      const saved = localStorage.getItem(MOD_SETTINGS_STORAGE_KEY);
      if (saved) return !!JSON.parse(saved)[key];
    } catch {
      // ignore
    }
    return false;
  }

  function beginTemporaryCosmeticSession() {
    if (savedCosmeticSnapshot) return;
    savedCosmeticSnapshot = Object.fromEntries(
      COSMETIC_TOGGLES.map(({ key }) => [key, readBetterUIConfigValue(key)]),
    );
  }

  function restoreTemporaryCosmeticSettings() {
    if (!savedCosmeticSnapshot) return;

    const uiConfig = window.betterUIConfig;
    let changed = false;
    if (uiConfig) {
      for (const { key } of COSMETIC_TOGGLES) {
        if (uiConfig[key] !== savedCosmeticSnapshot[key]) {
          uiConfig[key] = savedCosmeticSnapshot[key];
          changed = true;
        }
      }
    }
    savedCosmeticSnapshot = null;
    if (changed) {
      window.dispatchEvent(new CustomEvent('betterUICreatureCosmeticsChanged'));
    }
  }

  function getCosmeticSetting(configKey) {
    return readBetterUIConfigValue(configKey);
  }

  function getCosmeticToggleBtnClass(enabled) {
    return enabled
      ? `${BTN_TOGGLE_BASE} frame-1-green active:frame-pressed-1-green surface-green`
      : `${BTN_TOGGLE_BASE} frame-1 active:frame-pressed-1 surface-regular opacity-70`;
  }

  function getCosmeticToggleTooltip(configKey) {
    const settingLabel = t(COSMETIC_TOGGLES.find((entry) => entry.key === configKey)?.tooltipKey ?? configKey);
    return `${settingLabel} ${t('mods.betterBestiary.cosmeticToggleHint')}`;
  }

  function toggleTemporaryCosmeticSetting(configKey) {
    if (!window.betterUIConfig) window.betterUIConfig = {};
    beginTemporaryCosmeticSession();
    window.betterUIConfig[configKey] = !getCosmeticSetting(configKey);

    const modal = findBestiaryModal();
    if (modal) {
      modal.removeAttribute(INITIAL_STYLED_ATTR);
      scheduleFullCreatureStyling(modal);
      refreshCosmeticToggleButtons(modal);
    }
  }

  function isMonsterAwakened(m) {
    const tier = Number(m?.tier);
    if (tier === AWAKEN_TIER) return true;
    if (m?.awaken === true || m?.awakened === true) return true;
    return false;
  }

  function getMonsterLevel(m) {
    if (Number.isFinite(m?.level) && m.level > 0) return Math.floor(m.level);
    const exp = Number(m?.exp);
    if (!Number.isFinite(exp) || exp <= 0) return 1;
    const expToLevel = globalThis.state?.utils?.expToCurrentLevel;
    if (typeof expToLevel === 'function') {
      const level = Number(expToLevel(exp));
      if (Number.isFinite(level) && level > 0) return Math.floor(level);
    }
    return 1;
  }

  /** Awaken milestone: tier 6 or high-level (pre-awaken cap). */
  function isAwakenByTierOrLevel(m) {
    return isMonsterAwakened(m) || getMonsterLevel(m) > 50;
  }

  /** Shiny copy that counts as awaken (tier 6 or level > 50). */
  function isShinyAwakenKeeper(m) {
    return m?.shiny === true && isAwakenByTierOrLevel(m);
  }

  function isMonsterLocked(m) {
    return m?.locked === true;
  }

  function getPlayerMonsters() {
    return globalThis.state?.player?.getSnapshot()?.context?.monsters ?? [];
  }

  /** Per gameId: species milestones for bulk-sell presets. */
  function buildSpeciesIndex(monsters) {
    const shiny = new Set();
    const awakened = new Set();
    const both = new Set();
    for (const m of monsters) {
      const gid = Number(m?.gameId);
      if (!Number.isFinite(gid)) continue;
      if (m.shiny === true) shiny.add(gid);
      if (isMonsterAwakened(m)) awakened.add(gid);
      if (isShinyAwakenKeeper(m)) both.add(gid);
    }
    return { shiny, awakened, both };
  }

  /**
   * Duplicates safe to bulk-sell: unlocked copies of a species where we already
   * own the milestone (shiny / awaken / both), excluding the keeper copies.
   */
  function isSellableDuplicate(m, presetKey, index) {
    if (isMonsterLocked(m)) return false;
    const gid = Number(m?.gameId);
    if (!Number.isFinite(gid)) return false;

    switch (presetKey) {
      case 'shiny':
        return index.shiny.has(gid) && m.shiny !== true;
      case 'awakened':
        return index.awakened.has(gid) && !isMonsterAwakened(m);
      case 'both':
        return index.both.has(gid) && m.shiny !== true && !isMonsterAwakened(m);
      default:
        return false;
    }
  }

  function filterIdsByPreset(presetKey) {
    if (!PRESET_KEYS.includes(presetKey)) return [];
    const monsters = getPlayerMonsters();
    const index = buildSpeciesIndex(monsters);
    const ids = [];
    for (const m of monsters) {
      if (m?.id && isSellableDuplicate(m, presetKey, index)) {
        ids.push(String(m.id));
      }
    }
    return ids;
  }

  function isBestiaryModal(dialog) {
    if (!dialog || dialog.getAttribute('role') !== 'dialog') return false;
    const title = dialog.querySelector('.widget-top-text, h2.widget-top, .widget-top');
    const text = title?.textContent ?? dialog.textContent ?? '';
    return /Besti[aá]rio|Bestiary/i.test(text) && /\(\s*\d+\s*\/\s*\d+\s*\)/.test(text);
  }

  function findBestiaryModal() {
    return [...document.querySelectorAll('[role="dialog"][data-state="open"]')].find(isBestiaryModal) ?? null;
  }

  function getCreatureGrid(modal) {
    return modal?.querySelector('[class*="container-inventory"]') ?? null;
  }

  function getCreatureButtons(modal) {
    const grid = getCreatureGrid(modal);
    if (!grid) return [];
    return [...grid.querySelectorAll('button')].filter((btn) => btn.querySelector('img[alt="creature"]'));
  }

  function getReactFiberNode(el) {
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    return key ? el[key] : null;
  }

  function walkReactFiber(element, visitor, maxHops = 45) {
    let node = getReactFiberNode(element);
    for (let hops = 0; node && hops < maxHops; hops++) {
      const props = node.memoizedProps || node.pendingProps || null;
      const result = visitor(props, node);
      if (result !== undefined) return result;
      node = node.return || null;
    }
    return undefined;
  }

  function findFiberPropCallback(element, propName) {
    return walkReactFiber(element, (props) => {
      if (props?.[propName] && typeof props[propName] === 'function') {
        return props[propName];
      }
    }) ?? null;
  }

  function resolveMonsterIdFromButton(button, depotMap = null) {
    if (!button) return null;
    try {
      const monster = walkReactFiber(button, (props) => {
        const candidate = props?.monster;
        return candidate?.id != null ? candidate : undefined;
      });
      if (monster?.id != null) return String(monster.id);
    } catch {
      // fall through to depot map
    }

    const img = button.querySelector('img[alt="creature"]');
    const map = depotMap ?? getBestiaryCreatureIdMap();
    if (img && map) {
      const uid = map.get(img);
      if (uid != null) return String(uid);
    }
    return null;
  }

  function findPresetTargetButtons(modal, idSet) {
    const depotMap = getBestiaryCreatureIdMap();
    const targets = [];
    for (const btn of getCreatureButtons(modal)) {
      const mid = resolveMonsterIdFromButton(btn, depotMap);
      if (mid != null && idSet.has(mid)) targets.push(btn);
    }
    return targets;
  }

  function isSlotSelected(btn) {
    return btn.querySelector('.container-slot')?.getAttribute('data-multiselected') === 'true';
  }

  function findClearSelectionButton(modal) {
    return [...modal.querySelectorAll('button')].find((btn) =>
      /Limpar sele|Clear selection|Cancelar sele|Cancel selection/i.test(btn.textContent),
    );
  }

  async function clearSelection(modal) {
    const clearBtn = findClearSelectionButton(modal);
    if (clearBtn) {
      clearBtn.click();
      await tick(50);
      return;
    }

    let toggled = false;
    for (const btn of getCreatureButtons(modal)) {
      if (!isSlotSelected(btn)) continue;
      const onSelectId = findFiberPropCallback(btn, 'onSelectId');
      if (onSelectId) onSelectId();
      else btn.click();
      toggled = true;
    }
    if (toggled) await waitFrame();
  }

  function openContextMenu(button) {
    const rect = button.getBoundingClientRect();
    button.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 2,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      }),
    );
  }

  function findSelectMenuItem() {
    return [...document.querySelectorAll('[role="menuitem"]')].find((el) => {
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      return (
        /^Selecionar \.\.\.$/i.test(text) ||
        /^Select \.\.\.$/i.test(text) ||
        (/^Selecionar$/i.test(text) && !/todos|all/i.test(text)) ||
        (/^Select$/i.test(text) && !/all/i.test(text))
      );
    });
  }

  async function waitForSelectMenuItem(timeout = 800) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const item = findSelectMenuItem();
      if (item) return item;
      await tick(25);
    }
    return null;
  }

  async function enableMultiselectViaContextMenu(button) {
    openContextMenu(button);
    const menuItem = await waitForSelectMenuItem();
    if (!menuItem) return false;
    menuItem.click();
    await tick(80);
    return isSlotSelected(button);
  }

  async function ensureMultiselectMode(sampleButton) {
    if (findFiberPropCallback(sampleButton, 'onSelectId')) return true;
    return enableMultiselectViaContextMenu(sampleButton);
  }

  async function batchSelectButtons(buttons) {
    const toSelect = buttons.filter((btn) => !isSlotSelected(btn));
    if (toSelect.length === 0) return buttons.length;

    if (!(await ensureMultiselectMode(toSelect[0]))) {
      return buttons.filter(isSlotSelected).length;
    }

    let usedCallback = false;
    const leftovers = [];
    for (const btn of toSelect) {
      const onSelectId = findFiberPropCallback(btn, 'onSelectId');
      if (onSelectId) {
        onSelectId();
        usedCallback = true;
      } else {
        leftovers.push(btn);
      }
    }

    if (usedCallback) await waitFrame();

    for (const btn of leftovers) {
      if (isSlotSelected(btn)) continue;
      if (await enableMultiselectViaContextMenu(btn)) {
        usedCallback = true;
      }
    }

    if (leftovers.length > 0 && usedCallback) await waitFrame();

    return buttons.filter(isSlotSelected).length;
  }

  async function applyPresetSelection(presetKey) {
    if (!config.enabled || isApplyingSelection) return;

    const modal = findBestiaryModal();
    if (!modal) {
      console.warn('[Better Bestiary] Bestiary modal not open');
      return;
    }

    if (depotMultiselectorActive) {
      await deactivateDepotMultiselector(modal);
    }

    const ids = filterIdsByPreset(presetKey);
    if (ids.length === 0) {
      console.info(
        `[Better Bestiary] No sellable duplicates for preset "${presetKey}" (need unlocked extras of species that already have that milestone)`,
      );
      await clearSelection(modal);
      return;
    }

    const idSet = new Set(ids);
    isApplyingSelection = true;
    try {
      await clearSelection(modal);

      const targetButtons = findPresetTargetButtons(modal, idSet);

      if (targetButtons.length === 0) {
        console.warn(
          `[Better Bestiary] ${ids.length} inventory match(es) for "${presetKey}" but none visible in modal grid`,
        );
        return;
      }

      const selectedCount = await batchSelectButtons(targetButtons);

      if (selectedCount === 0) {
        console.warn('[Better Bestiary] Could not select any creatures — try right-clicking one manually first');
      } else {
        console.info(`[Better Bestiary] Selected ${selectedCount}/${targetButtons.length} for preset "${presetKey}"`);
      }

      applyCreatureStyling(modal);
    } finally {
      isApplyingSelection = false;
    }
  }

  function updatePresetButton(btn, presetKey) {
    btn.textContent = getPresetLabel(presetKey);
    btn.title = getPresetTooltip(presetKey);
  }

  function makePresetButton(presetKey) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BTN_CLASS;
    btn.setAttribute(PRESET_ATTR, presetKey);
    updatePresetButton(btn, presetKey);
    btn.addEventListener('click', () => applyPresetSelection(presetKey));
    return btn;
  }

  function updateDepotMultiselectorButton(btn) {
    btn.className = depotMultiselectorActive
      ? `${BTN_TOGGLE_BASE} frame-1-green active:frame-pressed-1-green surface-green`
      : `${BTN_TOGGLE_BASE} frame-1 active:frame-pressed-1 surface-regular opacity-70`;
    btn.textContent = t('mods.betterBestiary.depotMultiselector.label');
    btn.title = `${t('mods.betterBestiary.depotMultiselector.tooltip')} ${t('mods.betterBestiary.cosmeticToggleHint')}`;
    btn.setAttribute('aria-pressed', depotMultiselectorActive ? 'true' : 'false');
  }

  function refreshDepotMultiselectorButton(modal = findBestiaryModal()) {
    if (!modal) return;
    for (const btn of modal.querySelectorAll(`[${DEPOT_MULTISELECTOR_ATTR}]`)) {
      updateDepotMultiselectorButton(btn);
    }
  }

  function hasGameNativeSelection(modal) {
    for (const btn of getCreatureButtons(modal)) {
      if (isDepotCustomSelected(btn)) continue;
      if (isSlotSelected(btn)) return true;
    }
    return false;
  }

  async function checkNativeSelectionDisablesDepot(modal = findBestiaryModal()) {
    if (!modal || !depotMultiselectorActive || isApplyingSelection) return;
    if (!hasGameNativeSelection(modal)) return;
    await deactivateDepotMultiselector(modal);
  }

  async function deactivateDepotMultiselector(modal = findBestiaryModal()) {
    depotMultiselectorActive = false;
    detachDepotMultiselectClickHandler();
    if (modal) {
      refreshDepotMultiselectorButton(modal);
      removeDepotFooterButtons(modal);
      clearDepotCustomSelection(modal);
    }
  }

  async function activateDepotMultiselector(modal = findBestiaryModal()) {
    if (!modal || !isDepotCreatureFeaturesEnabled()) return;

    depotCustomSelectedIds.clear();
    depotMultiselectorActive = true;
    await clearSelection(modal);
    refreshDepotMultiselectorButton(modal);
    attachDepotMultiselectClickHandler(modal);

    ensureDepotFooterButtons(modal);
    updateDepotFooterButtons(modal);
    scheduleDepotFooterEnsure(modal);
  }

  async function toggleDepotMultiselector() {
    const modal = findBestiaryModal();
    if (!modal) return;

    if (depotMultiselectorActive) {
      await deactivateDepotMultiselector(modal);
      return;
    }

    await activateDepotMultiselector(modal);
  }

  function makeDepotMultiselectorButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute(DEPOT_MULTISELECTOR_ATTR, 'true');
    updateDepotMultiselectorButton(btn);
    btn.addEventListener('click', () => {
      toggleDepotMultiselector();
    });
    return btn;
  }

  function updateCosmeticToggleButton(btn, configKey) {
    const enabled = getCosmeticSetting(configKey);
    btn.className = getCosmeticToggleBtnClass(enabled);
    btn.title = getCosmeticToggleTooltip(configKey);
    btn.textContent = t(COSMETIC_TOGGLES.find((entry) => entry.key === configKey)?.labelKey ?? configKey);
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }

  function makeCosmeticToggleButton(configKey) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute(COSMETIC_TOGGLE_ATTR, configKey);
    updateCosmeticToggleButton(btn, configKey);
    btn.addEventListener('click', () => toggleTemporaryCosmeticSetting(configKey));
    return btn;
  }

  function refreshCosmeticToggleButtons(modal = findBestiaryModal()) {
    if (!modal) return;
    for (const btn of modal.querySelectorAll(`[${COSMETIC_TOGGLE_ATTR}]`)) {
      updateCosmeticToggleButton(btn, btn.getAttribute(COSMETIC_TOGGLE_ATTR));
    }
  }

  function getSessionOverlaySetting(overlayKey) {
    return sessionOverlayState[overlayKey] === true;
  }

  function getSessionOverlayTooltip(overlayKey) {
    const entry = SESSION_OVERLAY_TOGGLES.find((item) => item.key === overlayKey);
    const settingLabel = t(entry?.tooltipKey ?? overlayKey);
    return `${settingLabel} ${t('mods.betterBestiary.cosmeticToggleHint')}`;
  }

  function updateSessionOverlayToggleButton(btn, overlayKey) {
    const enabled = getSessionOverlaySetting(overlayKey);
    btn.className = getCosmeticToggleBtnClass(enabled);
    btn.title = getSessionOverlayTooltip(overlayKey);
    btn.textContent = t(SESSION_OVERLAY_TOGGLES.find((entry) => entry.key === overlayKey)?.labelKey ?? overlayKey);
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }

  function toggleSessionOverlaySetting(overlayKey) {
    sessionOverlayState[overlayKey] = !getSessionOverlaySetting(overlayKey);
    syncBetterBestiaryShowDepotFlag();

    const modal = findBestiaryModal();
    if (modal) {
      refreshSessionOverlayToggleButtons(modal);
      if (overlayKey === 'showDepot') {
        refreshDepotOverlayLayout(modal);
      }
    }
  }

  function makeSessionOverlayToggleButton(overlayKey) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute(SESSION_OVERLAY_ATTR, overlayKey);
    updateSessionOverlayToggleButton(btn, overlayKey);
    btn.addEventListener('click', () => toggleSessionOverlaySetting(overlayKey));
    return btn;
  }

  function refreshSessionOverlayToggleButtons(modal = findBestiaryModal()) {
    if (!modal) return;
    for (const btn of modal.querySelectorAll(`[${SESSION_OVERLAY_ATTR}]`)) {
      updateSessionOverlayToggleButton(btn, btn.getAttribute(SESSION_OVERLAY_ATTR));
    }
  }

  function findModalFooterCloseButton(modal) {
    if (!modal) return null;
    const widgetBottom = modal.querySelector('.widget-bottom');
    const scope = widgetBottom ?? modal;
    return [...scope.querySelectorAll('div.flex.justify-end.gap-2 button')]
      .find((btn) => /^(Close|Fechar)$/i.test(btn.textContent.trim())) ?? null;
  }

  function findModalFooterRow(modal) {
    if (!modal) return null;

    const clearBtn = findClearSelectionButton(modal);
    const clearRow = clearBtn?.closest('div.flex.justify-end.gap-2');
    if (clearRow) return clearRow;

    const closeBtn = findModalFooterCloseButton(modal);
    const closeRow = closeBtn?.closest('div.flex.justify-end.gap-2');
    if (closeRow) return closeRow;

    return modal.querySelector('.widget-bottom div.flex.justify-end.gap-2')
      ?? modal.querySelector('div.flex.justify-end.gap-2');
  }

  function removeDepotFooterButtons(modal) {
    if (!modal) return;
    modal.querySelector(`[${DEPOT_SEND_TO_ATTR}]`)?.remove();
    modal.querySelector(`[${DEPOT_REMOVE_FROM_ATTR}]`)?.remove();
  }

  function getSelectedDepotTransferPlan(modal) {
    const depotMap = getBestiaryCreatureIdMap();
    const depotSet = window.depotManager?.getDepotCreatureIdSet?.() ?? new Set();
    const toDepot = [];
    const toBestiary = [];

    for (const btn of getCreatureButtons(modal)) {
      if (!isDepotCustomSelected(btn)) continue;
      const id = resolveMonsterIdFromButton(btn, depotMap);
      if (!id) continue;
      const entry = { id, img: btn.querySelector('img[alt="creature"]') };
      if (depotSet.has(id)) toBestiary.push(entry);
      else toDepot.push(entry);
    }

    return {
      toDepot,
      toBestiary,
      total: toDepot.length + toBestiary.length,
    };
  }

  function updateDepotFooterButtons(modal = findBestiaryModal()) {
    if (!modal) return;

    const sendBtn = modal.querySelector(`[${DEPOT_SEND_TO_ATTR}]`);
    const removeBtn = modal.querySelector(`[${DEPOT_REMOVE_FROM_ATTR}]`);
    if (!sendBtn && !removeBtn) return;

    const { toDepot, toBestiary } = getSelectedDepotTransferPlan(modal);
    const enabled = isDepotCreatureFeaturesEnabled() && depotMultiselectorActive;

    if (sendBtn) {
      sendBtn.disabled = !enabled || toDepot.length === 0;
      sendBtn.textContent = t('mods.betterBestiary.sendCreaturesToDepot', { count: toDepot.length });
      sendBtn.title = t('mods.betterBestiary.sendCreaturesToDepotTooltip');
    }

    if (removeBtn) {
      removeBtn.disabled = !enabled || toBestiary.length === 0;
      removeBtn.textContent = t('mods.betterBestiary.removeCreaturesFromDepot', { count: toBestiary.length });
      removeBtn.title = t('mods.betterBestiary.removeCreaturesFromDepotTooltip');
    }
  }

  async function transferDepotSelection(modal = findBestiaryModal(), mode = 'all') {
    const depotManager = window.depotManager;
    if (!modal || !depotManager?.transferCreaturesDepot || !isDepotCreatureFeaturesEnabled()) return;

    const { toDepot, toBestiary } = getSelectedDepotTransferPlan(modal);
    const entries = mode === 'toDepot'
      ? toDepot
      : mode === 'fromDepot'
        ? toBestiary
        : [...toDepot, ...toBestiary];

    if (entries.length === 0) return;

    const result = depotManager.transferCreaturesDepot(entries);
    console.info(
      `[Better Bestiary] Depot transfer: ${result.toDepot} to depot, ${result.toBestiary} to bestiary`,
    );

    await deactivateDepotMultiselector(modal);
    refreshDepotOverlayLayout(modal);
  }

  function ensureDepotFooterButtons(modal) {
    if (!modal) return;

    if (!depotMultiselectorActive || !isDepotCreatureFeaturesEnabled()) {
      removeDepotFooterButtons(modal);
      return;
    }

    const row = findModalFooterRow(modal);
    if (!row) return;

    let sendBtn = row.querySelector(`[${DEPOT_SEND_TO_ATTR}]`);
    let removeBtn = row.querySelector(`[${DEPOT_REMOVE_FROM_ATTR}]`);
    const closeBtn = findModalFooterCloseButton(modal);
    const insertBefore = closeBtn ?? null;

    if (!removeBtn) {
      removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = FOOTER_BTN_CLASS;
      removeBtn.setAttribute(DEPOT_REMOVE_FROM_ATTR, 'true');
      removeBtn.addEventListener('click', () => {
        transferDepotSelection(modal, 'fromDepot');
      });
      if (insertBefore) insertBefore.insertAdjacentElement('beforebegin', removeBtn);
      else row.appendChild(removeBtn);
    }

    if (!sendBtn) {
      sendBtn = document.createElement('button');
      sendBtn.type = 'button';
      sendBtn.className = FOOTER_BTN_SEND_CLASS;
      sendBtn.setAttribute(DEPOT_SEND_TO_ATTR, 'true');
      sendBtn.addEventListener('click', () => {
        transferDepotSelection(modal, 'toDepot');
      });
      removeBtn.insertAdjacentElement('beforebegin', sendBtn);
    }

    if (sendBtn.nextElementSibling !== removeBtn) {
      removeBtn.insertAdjacentElement('beforebegin', sendBtn);
    }

    updateDepotFooterButtons(modal);
  }

  function createFiltersColumn(titleKey, buttonFactory) {
    const column = document.createElement('div');
    column.className = 'flex min-w-0 flex-col gap-1';

    const title = document.createElement('p');
    title.className = 'pixel-font-14 text-center text-whiteDarker';
    title.textContent = t(titleKey);
    column.appendChild(title);

    for (const button of buttonFactory()) {
      column.appendChild(button);
    }

    return column;
  }

  function buildFiltersPanel() {
    const panel = document.createElement('div');
    panel.className = 'grid w-full grid-cols-2 gap-2';
    panel.setAttribute(FILTERS_ATTR, 'true');
    panel.appendChild(createFiltersColumn('mods.betterBestiary.presetsColumnTitle', () => {
      const buttons = PRESET_KEYS.map((presetKey) => makePresetButton(presetKey));
      if (isDepotCreatureFeaturesEnabled()) {
        buttons.push(makeDepotMultiselectorButton());
      }
      return buttons;
    }));
    panel.appendChild(createFiltersColumn('mods.betterBestiary.cosmeticsColumnTitle', () => [
      ...COSMETIC_TOGGLES.map(({ key }) => makeCosmeticToggleButton(key)),
      ...SESSION_OVERLAY_TOGGLES
        .filter(({ key }) => key !== 'showDepot' || isDepotCreatureFeaturesEnabled())
        .map(({ key }) => makeSessionOverlayToggleButton(key)),
    ]));
    return panel;
  }

  function syncFiltersPanel(filters) {
    for (const btn of filters.querySelectorAll(`[${PRESET_ATTR}]`)) {
      btn.className = BTN_CLASS;
      updatePresetButton(btn, btn.getAttribute(PRESET_ATTR));
    }
    refreshCosmeticToggleButtons(filters.closest('[role="dialog"]') ?? findBestiaryModal());
    refreshSessionOverlayToggleButtons(filters.closest('[role="dialog"]') ?? findBestiaryModal());
    refreshDepotMultiselectorButton(filters.closest('[role="dialog"]') ?? findBestiaryModal());
    return filters;
  }

  function ensureFiltersPanel(detailsCol) {
    let filters = detailsCol.querySelector(`[${FILTERS_ATTR}="true"]`);
    const depotEnabled = isDepotCreatureFeaturesEnabled();
    const needsRebuild = !filters
      || !filters.classList.contains('grid-cols-2')
      || !filters.querySelector(`[${COSMETIC_TOGGLE_ATTR}]`)
      || PRESET_KEYS.some((presetKey) => !filters.querySelector(`[${PRESET_ATTR}="${presetKey}"]`))
      || (depotEnabled && !filtersHasAllDepotControls(filters))
      || (!depotEnabled && filtersHasDepotControls(filters));

    if (needsRebuild) {
      const next = buildFiltersPanel();
      if (filters) filters.replaceWith(next);
      return next;
    }

    return syncFiltersPanel(filters);
  }

  function findBestiaryDetailsColumn(modal) {
    const contentGrid = getBestiaryContentGrid(modal);
    if (!contentGrid) return null;

    const scrollArea = getCreatureScrollArea(modal);
    for (const child of contentGrid.children) {
      if (child === scrollArea) continue;
      if (child.classList.contains('col-span-full')) continue;
      if (child.classList.contains('separator')) continue;
      if (
        child.classList.contains('grid') &&
        child.className.includes('grid-rows-[min-content_1fr]')
      ) {
        return child;
      }
    }
    return null;
  }

  function getBestiaryContentGrid(modal) {
    const widgetBottom = modal.querySelector('.widget-bottom');
    return widgetBottom?.querySelector(':scope > .grid') ?? null;
  }

  function getBestiaryHeaderRow(modal) {
    return getBestiaryContentGrid(modal)?.querySelector(':scope > .col-span-full') ?? null;
  }

  function findHeaderCreatureDetailsLabel(headerRow) {
    if (!headerRow) return null;
    const labels = [...headerRow.querySelectorAll('p[data-empty]')];
    return labels.find((label) => CREATURE_DETAILS_LABEL_RE.test(label.textContent))
      ?? labels.at(-1)
      ?? null;
  }

  function enhanceHeaderCreatureDetailsLabel(modal) {
    const headerRow = getBestiaryHeaderRow(modal);
    if (!headerRow) return;

    const activatedText = t('mods.betterBestiary.activated');
    const detailsLabel = findHeaderCreatureDetailsLabel(headerRow);

    for (const label of headerRow.querySelectorAll('p[data-empty]')) {
      if (label !== detailsLabel) continue;

      label.classList.remove('!hidden', 'hidden');
      label.removeAttribute(HEADER_LABEL_SUPPRESSED_ATTR);
      if (needsDetailsTitleEnhancement(label, activatedText)) {
        applyDetailsTitleEnhancement(label, activatedText);
      }
    }
  }

  function restoreHeaderDetailsLabels(modal) {
    for (const label of modal.querySelectorAll(`[${HEADER_LABEL_SUPPRESSED_ATTR}="true"]`)) {
      label.classList.remove('!hidden');
      label.removeAttribute(HEADER_LABEL_SUPPRESSED_ATTR);
    }
  }

  function needsDetailsTitleEnhancement(label, activatedText) {
    const titleSpan = label.querySelector(`[${TITLE_TEXT_ATTR}]`);
    return label.getAttribute(DETAILS_TITLE_ATTR) !== 'true'
      || titleSpan?.textContent !== activatedText
      || !!label.querySelector(`[data-${NS}-title-credit]`);
  }

  function applyDetailsTitleEnhancement(label, activatedText) {
    if (!label.hasAttribute(ORIGINAL_LABEL_ATTR)) {
      const original = label.textContent.trim();
      if (original) label.setAttribute(ORIGINAL_LABEL_ATTR, original);
    }

    label.classList.remove('!hidden', 'hidden');
    label.style.textAlign = 'center';
    label.classList.add('text-center', 'w-full');
    label.setAttribute(DETAILS_TITLE_ATTR, 'true');

    let titleSpan = label.querySelector(`[${TITLE_TEXT_ATTR}]`);
    if (!titleSpan) {
      label.replaceChildren();
      titleSpan = document.createElement('span');
      titleSpan.setAttribute(TITLE_TEXT_ATTR, 'true');
      titleSpan.className = 'block';
      label.appendChild(titleSpan);
    }

    label.querySelector(`[data-${NS}-title-credit]`)?.remove();
    titleSpan.textContent = activatedText;
    titleSpan.style.color = ACTIVATED_TITLE_COLOR;
  }

  function enhanceDetailsTitle(modal) {
    enhanceHeaderCreatureDetailsLabel(modal);
    findBestiaryDetailsColumn(modal)
      ?.querySelector(`[${DETAILS_TITLE_BLOCK_ATTR}="true"]`)
      ?.remove();
  }

  function syncDepotAvailability(modal = findBestiaryModal()) {
    if (isDepotCreatureFeaturesEnabled()) return;

    if (depotMultiselectorActive) {
      void deactivateDepotMultiselector(modal);
    } else if (modal) {
      removeDepotFooterButtons(modal);
    }

    if (sessionOverlayState.showDepot) {
      sessionOverlayState.showDepot = false;
      syncBetterBestiaryShowDepotFlag();
      if (modal) refreshDepotOverlayLayout(modal);
    }
  }

  function syncModalLayout(modal) {
    if (!modal || isSyncingLayout) return;
    isSyncingLayout = true;
    try {
      syncDepotAvailability(modal);
      if (ensurePresetButtons(modal)) {
        refreshCosmeticToggleButtons(modal);
        refreshSessionOverlayToggleButtons(modal);
        refreshDepotMultiselectorButton(modal);
      }
      ensureDepotFooterButtons(modal);
      ensureAdvancedFooterButton(modal);
    } finally {
      isSyncingLayout = false;
    }
  }

  function scheduleLayoutSync(modal) {
    if (!modal || isSyncingLayout) return;
    clearTimeout(layoutSyncTimer);
    layoutSyncTimer = setTimeout(() => {
      layoutSyncTimer = null;
      if (findBestiaryModal() !== modal) return;
      syncModalLayout(modal);
    }, LAYOUT_SYNC_DEBOUNCE_MS);
  }

  function ensureLayoutObserver(modal) {
    const detailsCol = findBestiaryDetailsColumn(modal);
    if (!detailsCol) return;

    if (layoutObserver
      && layoutObserverDetailsCol === detailsCol
      && detailsCol.isConnected) {
      return;
    }

    layoutObserver?.disconnect();
    layoutObserverDetailsCol = detailsCol;
    layoutObserver = new MutationObserver(() => scheduleLayoutSync(modal));
    layoutObserver.observe(detailsCol, { childList: true });
  }

  // ---- Combat details + ability scene for the selected creature -------------------------------------------------
  // Drawn by the Cyclopedia mod (`window.CyclopediaCombatUI`). That object exists only while Cyclopedia runs, so with it
  // disabled nothing is added here: this mod never turns Cyclopedia on for it. Native nodes are React's, so this adds only
  // listeners to the game's own ability icon (the scene) and to its stats box (AD / Armor / Attack Speed / AP / MR / Speed),
  // plus ONE overlay node inside that box that holds the combat panel while the pointer is over the box. The footer's
  // "Advanced details" toggle switches both on and off.
  const COMBAT_ATTR = `data-${NS}-combat`;
  const ADVANCED_ATTR = `data-${NS}-advanced-details`;
  const ADVANCED_STORAGE_KEY = 'better-bestiary-advanced-details';
  const COMBAT_TOOLTIP_DELAY_MS = 150; // the game's tooltip wrapper: delayDuration 150 ...
  const COMBAT_TOOLTIP_FADE_MS = 150; // ... and animate-in (fade-in-0 zoom-in-95 slide-in-from-bottom-2)
  let statsBoxEl = null;
  let statsBoxPosition = '';
  let statsBoxDetach = null;
  let combatObserver = null;
  let combatObserverTarget = null;
  let combatRaf = null;
  let sceneDetach = null;
  let sceneIcon = null;
  // ON unless the player switched it off: the choice is saved and survives a refresh.
  let advancedDetailsOn = true;
  try {
    advancedDetailsOn = localStorage.getItem(ADVANCED_STORAGE_KEY) !== 'off';
  } catch {
    // private window / blocked storage: stay on
  }

  function getCombatUi() {
    return window.CyclopediaCombatUI ?? null;
  }

  /** The monster the native details block shows: its React component carries it as the `monster` prop. */
  function getDetailsMonster(detailsCol) {
    const block = getDetailsContentBlock(detailsCol);
    if (!block) return null;
    return walkReactFiber(block, (props) => (props?.monster?.gameId != null ? props.monster : undefined), 12) ?? null;
  }

  /** The native stats box: the grid around the "Attack Damage" stat. */
  function findStatsBox(detailsCol) {
    return getDetailsContentBlock(detailsCol)?.querySelector('span[title="Attack Damage"]')?.parentElement ?? null;
  }

  /** The game's ability icon box in the details card (the tooltip trigger around `img[alt="ability"]`). */
  function findNativeAbilityIcon(detailsCol) {
    const img = getDetailsContentBlock(detailsCol)?.querySelector('img[alt="ability"]');
    return img?.closest('[data-state]') ?? img?.parentElement ?? null;
  }

  function detachCombatScene() {
    sceneDetach?.();
    sceneDetach = null;
    sceneIcon = null;
  }

  function removeCombatSection(modal) {
    detachCombatScene();
    statsBoxDetach?.();
    statsBoxDetach = null;
    modal?.querySelector(`[${COMBAT_ATTR}]`)?.remove();
    if (statsBoxEl) {
      statsBoxEl.style.position = statsBoxPosition;
      statsBoxEl = null;
    }
  }

  /**
   * The overlay inside the stats box. The combat panel is built when the pointer enters the box (a tap toggles it on touch
   * screens) and dropped when it leaves; the panel is a child of the box, so moving onto it keeps it open and its
   * seconds / ticks switch can be clicked. Returns { overlay, detach }.
   */
  function buildCombatOverlay(ui, monster, key, box) {
    const overlay = document.createElement('div');
    overlay.setAttribute(COMBAT_ATTR, key);
    overlay.style.cssText = 'position:absolute;inset:0;z-index:30;pointer-events:none;';
    // The game's info icon in the corner: there is more to see on hover.
    const hint = document.createElement('img');
    hint.src = 'https://bestiaryarena.com/assets/icons/info.png';
    hint.alt = '';
    hint.style.cssText = 'position:absolute;right:2px;top:2px;width:11px;height:11px;image-rendering:pixelated;';
    overlay.appendChild(hint);
    let holder = null;
    let openTimer = null;
    const hide = () => {
      clearTimeout(openTimer);
      openTimer = null;
      holder?.remove();
      holder = null;
    };
    // Above the box, like the game's own tooltips (side top, 4px off): drawn after the pointer has rested for the game's
    // 150ms tooltip delay, then fading in with a small zoom and slide. The holder reaches down to the box (padding-bottom
    // carries the 4px) so the pointer never leaves the box and its panel on the way up.
    const buildPanel = () => {
      const panel = ui.renderCombatDetails(monster.gameId, monster.metadata?.baseStats, refresh);
      if (!panel) return null;
      // Cyclopedia's panel is a fixed 160px frame that scrolls; here it grows to the size of its content, no scrollbar.
      panel.style.height = 'auto';
      panel.style.flex = 'none';
      panel.style.overflow = 'visible';
      panel.style.width = 'max-content';
      return panel;
    };
    // Categories are never split: they are packed into columns, a new column starting when the next whole category would
    // not fit under the max height (what the room above the box allows, at most 260px). Needs the panel in the page to measure.
    const packColumns = (panel) => {
      const groups = [...panel.querySelectorAll(':scope > [data-combat-section]')];
      if (!groups.length) return;
      const maxHeight = Math.min(260, Math.max(160, box.getBoundingClientRect().top - 16));
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';
      const newColumn = () => {
        if (row.children.length) {
          // a thin line between columns, in the panel's heading colour
          const line = document.createElement('div');
          line.style.cssText = 'align-self:stretch;width:1px;background:rgba(255,224,102,0.3);';
          row.appendChild(line);
        }
        const col = document.createElement('div');
        col.style.cssText = 'display:flex;flex-direction:column;width:max-content;';
        row.appendChild(col);
        return col;
      };
      panel.replaceChildren(row);
      let col = newColumn();
      for (const group of groups) {
        // A spreadsheet-style grid without cell borders: every line is a label cell and a value cell, labels sized to their
        // text (a long one like Stone damage scaling cannot run into its value), and the groups of one column stretch to
        // the column's width so all the value cells line up on the same edge.
        group.style.minWidth = '190px';
        [...group.children].slice(1).forEach((line, i) => {
          line.style.cssText = `display:grid;grid-template-columns:1fr auto;gap:0;padding:0;`
            + (i % 2 ? 'background:rgba(255,255,255,0.05);' : '');
          const [label, value] = [line.children[0], line.children[1]];
          if (label) Object.assign(label.style, { whiteSpace: 'nowrap', minWidth: 'auto', padding: '1px 6px' });
          if (value) Object.assign(value.style, { padding: '1px 6px', minWidth: '60px', textAlign: 'right' });
        });
        col.appendChild(group);
        if (col.children.length > 1 && col.offsetHeight > maxHeight) {
          col.removeChild(group);
          col = newColumn();
          col.appendChild(group);
        }
      }
    };
    // Centred over the stats box, like the game's own tooltips (and kept inside the window sideways: more columns make the panel
    // wider than the box).
    const fitSideways = () => {
      const centred = (box.clientWidth - holder.offsetWidth) / 2;
      holder.style.left = `${centred}px`;
      const rect = holder.getBoundingClientRect();
      const overRight = rect.right - (window.innerWidth - 8);
      const overLeft = 8 - rect.left;
      if (overRight > 0) holder.style.left = `${centred - overRight}px`;
      else if (overLeft > 0) holder.style.left = `${centred + overLeft}px`;
    };
    // The seconds / ticks switch: swap the rows in place (no close, no new fade) so the numbers just change.
    const refresh = () => {
      const frame = holder?.firstElementChild;
      const panel = frame ? buildPanel() : null;
      if (!panel) return;
      frame.replaceChildren(panel);
      packColumns(panel);
      fitSideways();
    };
    const reveal = () => {
      holder?.remove();
      holder = null;
      const panel = buildPanel();
      if (!panel) return;
      holder = document.createElement('div');
      holder.style.cssText = 'position:absolute;left:0;bottom:100%;width:max-content;padding-bottom:4px;'
        + 'pointer-events:auto;transform-origin:bottom center;';
      const frame = document.createElement('div');
      frame.style.cssText = 'padding:2px;background:rgba(20,20,20,0.98);outline:1px solid rgba(255,255,255,0.25);'
        + 'box-shadow:0 4px 18px rgba(0,0,0,0.6);';
      frame.appendChild(panel);
      holder.appendChild(frame);
      overlay.appendChild(holder);
      packColumns(panel);
      fitSideways();
      holder.animate(
        [{ opacity: 0, translate: '0 8px', scale: '0.95' }, { opacity: 1, translate: '0 0', scale: '1' }],
        { duration: COMBAT_TOOLTIP_FADE_MS, easing: 'ease-out' }
      );
    };
    const show = () => {
      if (holder || openTimer) return;
      openTimer = setTimeout(() => {
        openTimer = null;
        reveal();
      }, COMBAT_TOOLTIP_DELAY_MS);
    };
    const onTouch = (e) => {
      if (holder?.contains(e.target)) return;
      if (holder) hide();
      else show();
    };
    box.addEventListener('mouseenter', show);
    box.addEventListener('mouseleave', hide);
    box.addEventListener('touchstart', onTouch, { passive: true });
    const detach = () => {
      box.removeEventListener('mouseenter', show);
      box.removeEventListener('mouseleave', hide);
      box.removeEventListener('touchstart', onTouch);
      hide();
    };
    return { overlay, detach };
  }

  /** Builds, rebuilds (another creature) or removes the overlay and the scene binding so they match the selected creature. */
  function ensureCombatSection(modal, detailsCol) {
    const ui = advancedDetailsOn ? getCombatUi() : null;
    const monster = ui ? getDetailsMonster(detailsCol) : null;
    const box = monster ? findStatsBox(detailsCol) : null;
    if (!ui || !monster || !box || !ui.hasCombatData(monster.gameId)) {
      if (statsBoxEl || sceneDetach || modal.querySelector(`[${COMBAT_ATTR}]`)) removeCombatSection(modal);
      return;
    }
    // The scene follows the creature's state, as the game's own tooltip does: awakened by tier, or by the Hat of the Mad.
    const awakened = Number(monster.tier) >= AWAKEN_TIER || /hat of the mad/i.test(monster.equip?.metadata?.name ?? '');
    const key = `${monster.gameId}|${awakened}`;
    const nativeIcon = ui.hasAbilityScene(monster.gameId, awakened) ? findNativeAbilityIcon(detailsCol) : null;
    const current = box.querySelector(`:scope > [${COMBAT_ATTR}]`);
    // Same creature, same stats box, same icon node: nothing to do. (The game updates its card in place, so these nodes
    // usually survive a creature change: then the overlay and the scene are rebuilt for the new creature below.)
    if (current?.getAttribute(COMBAT_ATTR) === key && statsBoxEl === box && sceneIcon === nativeIcon) return;
    removeCombatSection(modal);

    if (nativeIcon) {
      sceneDetach = ui.attachAbilityScene(nativeIcon, monster.gameId, () => awakened, { decorate: false, hint: true });
      sceneIcon = nativeIcon;
    }
    statsBoxEl = box;
    statsBoxPosition = box.style.position;
    box.style.position = 'relative';
    const { overlay, detach } = buildCombatOverlay(ui, monster, key, box);
    statsBoxDetach = detach;
    box.appendChild(overlay);
  }

  // ---- "Advanced details" footer toggle ------------------------------------------------------------------------
  function removeAdvancedFooterButton(modal) {
    modal?.querySelector(`[${ADVANCED_ATTR}]`)?.remove();
  }

  function updateAdvancedFooterButton(btn) {
    // Green when on, red when off (the game's own button colours); `mr-auto` pushes it to the left end of the footer row.
    const color = advancedDetailsOn
      ? 'frame-1-green active:frame-pressed-1-green surface-green'
      : 'frame-1-red active:frame-pressed-1-red surface-red';
    btn.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular mr-auto '
      + `${color} gap-1 px-2 py-0.5 pb-[3px] pixel-font-14`;
    btn.textContent = t('mods.betterBestiary.advancedDetails');
    btn.title = t('mods.betterBestiary.advancedDetailsTooltip');
    btn.setAttribute('aria-pressed', advancedDetailsOn ? 'true' : 'false');
  }

  function toggleAdvancedDetails(modal = findBestiaryModal()) {
    advancedDetailsOn = !advancedDetailsOn;
    try {
      localStorage.setItem(ADVANCED_STORAGE_KEY, advancedDetailsOn ? 'on' : 'off');
    } catch {
      // not saved: it still applies until the page reloads
    }
    if (!modal) return;
    const btn = modal.querySelector(`[${ADVANCED_ATTR}]`);
    if (btn) updateAdvancedFooterButton(btn);
    const detailsCol = findBestiaryDetailsColumn(modal);
    if (detailsCol) ensureCombatSection(modal, detailsCol);
  }

  /** The toggle sits left of Close in the footer; it is only offered while Cyclopedia provides the combat UI. */
  function ensureAdvancedFooterButton(modal) {
    if (!modal) return;
    if (!getCombatUi()) {
      removeAdvancedFooterButton(modal);
      return;
    }
    const row = findModalFooterRow(modal);
    if (!row) return;
    let btn = row.querySelector(`[${ADVANCED_ATTR}]`);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute(ADVANCED_ATTR, 'true');
      btn.addEventListener('click', () => toggleAdvancedDetails());
      const closeBtn = findModalFooterCloseButton(modal);
      if (closeBtn) closeBtn.insertAdjacentElement('beforebegin', btn);
      else row.appendChild(btn);
    }
    updateAdvancedFooterButton(btn);
  }

  function detachCombatObserver() {
    combatObserver?.disconnect();
    combatObserver = null;
    combatObserverTarget = null;
    if (combatRaf != null) cancelAnimationFrame(combatRaf);
    combatRaf = null;
  }

  /** The native details component updates in place when another creature is picked: watch it (not our own nodes) to follow. */
  function ensureCombatObserver(modal) {
    const detailsCol = findBestiaryDetailsColumn(modal);
    if (!detailsCol) return;
    if (combatObserver && combatObserverTarget === detailsCol && detailsCol.isConnected) return;
    detachCombatObserver();
    combatObserverTarget = detailsCol;
    combatObserver = new MutationObserver((mutations) => {
      const own = (m) => {
        const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        return !!el?.closest?.(`[${COMBAT_ATTR}],[${FILTERS_ATTR}]`);
      };
      if (mutations.every(own) || combatRaf != null) return;
      combatRaf = requestAnimationFrame(() => {
        combatRaf = null;
        if (findBestiaryModal() === modal && detailsCol.isConnected) ensureCombatSection(modal, detailsCol);
      });
    });
    combatObserver.observe(detailsCol, { childList: true, subtree: true, characterData: true });
  }

  function ensurePresetButtons(modal) {
    const detailsCol = findBestiaryDetailsColumn(modal);
    if (!detailsCol) return null;

    beginTemporaryCosmeticSession();
    beginSessionOverlaySession();

    const misplaced = modal.querySelector(`[${FILTERS_ATTR}="true"]`);
    if (misplaced && !detailsCol.contains(misplaced)) {
      misplaced.remove();
    }

    enhanceDetailsTitle(modal);
    const filters = ensureFiltersPanel(detailsCol);
    placeDetailsColumnLayout(detailsCol, filters);
    ensureCombatSection(modal, detailsCol);
    ensureCombatObserver(modal);
    ensureAdvancedFooterButton(modal);
    modal.setAttribute(ENHANCED_ATTR, 'true');
    window.depotManager?.scheduleFavoriteHeartsUpdate?.(250);
    return detailsCol;
  }

  function getDetailsContentBlock(detailsCol) {
    return [...detailsCol.children].find((el) => {
      if (el.getAttribute(FILTERS_ATTR) === 'true') return false;
      if (el.getAttribute(DETAILS_TITLE_BLOCK_ATTR) === 'true') return false;
      return el.classList.contains('grid') && el.className.includes('grid-cols-');
    }) ?? null;
  }

  function resetDetailsColumnLayout(modal) {
    const detailsCol = findBestiaryDetailsColumn(modal);
    if (!detailsCol?.hasAttribute(DETAILS_LAYOUT_ATTR)) return;
    detailsCol.style.gridTemplateRows = '';
    detailsCol.style.alignContent = '';
    detailsCol.style.alignItems = '';
    detailsCol.removeAttribute(DETAILS_LAYOUT_ATTR);
  }

  function applyDetailsColumnGridSizing(detailsCol) {
    const children = [...detailsCol.children];
    const contentBlock = getDetailsContentBlock(detailsCol);
    const contentIndex = contentBlock ? children.indexOf(contentBlock) : -1;

    if (contentIndex >= 0) {
      const rows = children.map((_, index) => (index === contentIndex ? '1fr' : 'min-content'));
      detailsCol.style.gridTemplateRows = rows.join(' ');
    } else {
      detailsCol.style.gridTemplateRows = `repeat(${children.length}, min-content)`;
    }

    detailsCol.style.alignContent = 'start';
    detailsCol.style.alignItems = 'stretch';
    detailsCol.setAttribute(DETAILS_LAYOUT_ATTR, 'true');
  }

  function placeDetailsColumnLayout(detailsCol, filters = null) {
    const panel = filters ?? detailsCol.querySelector(`[${FILTERS_ATTR}="true"]`);
    if (!panel) return;

    const contentBlock = getDetailsContentBlock(detailsCol);

    if (contentBlock) {
      if (panel.nextElementSibling !== contentBlock) {
        contentBlock.insertAdjacentElement('beforebegin', panel);
      }
      applyDetailsColumnGridSizing(detailsCol);
      return;
    }

    if (!detailsCol.contains(panel)) {
      detailsCol.prepend(panel);
    }

    applyDetailsColumnGridSizing(detailsCol);
  }

  function getCreatureScrollArea(modal) {
    const grid = getCreatureGrid(modal);
    return grid?.closest('[dir="ltr"]') ?? null;
  }

  function applyBestiaryInnerLayout(modal) {
    if (!modal || modal.hasAttribute(LAYOUT_SIZED_ATTR)) return true;

    const widgetBottom = modal.querySelector('.widget-bottom');
    const contentGrid = getBestiaryContentGrid(modal);
    const scrollArea = getCreatureScrollArea(modal);
    if (!widgetBottom || !contentGrid || !scrollArea) return false;

    widgetBottom.style.display = 'flex';
    widgetBottom.style.flexDirection = 'column';
    widgetBottom.style.flex = '1 1 0';
    widgetBottom.style.minHeight = '0';

    contentGrid.style.flex = '1 1 0';
    contentGrid.style.minHeight = '0';
    contentGrid.style.height = '100%';
    contentGrid.style.gridTemplateRows = 'auto 1fr';
    contentGrid.style.alignContent = 'stretch';

    scrollArea.style.height = '100%';
    scrollArea.style.minHeight = '0';
    scrollArea.style.maxHeight = 'none';
    scrollArea.style.alignSelf = 'stretch';

    const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.style.height = '100%';
    }

    modal.setAttribute(LAYOUT_SIZED_ATTR, 'true');
    return true;
  }

  function expandModalHeight(modal) {
    if (!modal) return;
    if (modal.hasAttribute(SIZED_ATTR) && modal.hasAttribute(LAYOUT_SIZED_ATTR)) return;

    if (heightRafId != null) {
      cancelAnimationFrame(heightRafId);
      heightRafId = null;
    }

    heightRafId = requestAnimationFrame(() => {
      heightRafId = null;
      if (!modal.isConnected || findBestiaryModal() !== modal) return;
      if (modal.hasAttribute(SIZED_ATTR) && modal.hasAttribute(LAYOUT_SIZED_ATTR)) return;

      if (!modal.hasAttribute(SIZED_ATTR)) {
        const baseHeight = Math.ceil(modal.getBoundingClientRect().height);
        if (baseHeight <= 0) return;

        const heightPx = `${baseHeight + MODAL_HEIGHT_EXPAND_PX}px`;
        modal.style.height = heightPx;
        modal.style.minHeight = heightPx;
        modal.style.maxHeight = heightPx;

        const rootWrapper = modal.querySelector(':scope > div');
        if (rootWrapper) {
          rootWrapper.style.height = '100%';
          rootWrapper.style.display = 'flex';
          rootWrapper.style.flexDirection = 'column';
          rootWrapper.style.minHeight = '0';
          rootWrapper.style.flex = '1 1 0';
        }

        modal.setAttribute(SIZED_ATTR, 'true');
      }

      applyBestiaryInnerLayout(modal);
    });
  }

  function onBestiaryModalClosed() {
    teardownModalSession();
  }

  function enhanceModal(modal) {
    if (!config.enabled || !modal) return;
    activeModal = modal;

    if (isModalEnhancementReady(modal)) {
      ensureModalObservers(modal);
      ensureDepotFiltersUpToDate(modal);
      if (!modal.hasAttribute(INITIAL_STYLED_ATTR) && hasModSettingsCreatureStylingEnabled()) {
        scheduleFullCreatureStyling(modal);
      }
      return;
    }

    syncModalLayout(modal);
    ensureModalObservers(modal);

    if (!modal.hasAttribute(SIZED_ATTR) || !modal.hasAttribute(LAYOUT_SIZED_ATTR)) {
      expandModalHeight(modal);
    }

    if (!isModalSetupComplete(modal)) {
      scheduleModalSetupRetry(modal);
      return;
    }

    if (!modal.hasAttribute(INITIAL_STYLED_ATTR)) {
      scheduleFullCreatureStyling(modal);
    }
  }

  function isDialogOpeningMutation(mutation) {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
      const target = mutation.target;
      return target?.getAttribute?.('role') === 'dialog' && target.getAttribute('data-state') === 'open';
    }

    if (mutation.type !== 'childList') return false;

    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches?.('[role="dialog"][data-state="open"]')) return true;
      if (node.querySelector?.('[role="dialog"][data-state="open"]')) return true;
    }

    return false;
  }

  function processMutations() {
    if (isApplyingSelection) return;
    const modal = findBestiaryModal();
    if (!modal) {
      if (activeModal) onBestiaryModalClosed();
      return;
    }
    if (activeModal === modal && isModalEnhancementReady(modal)) {
      ensureModalObservers(modal);
      ensureAdvancedFooterButton(modal);
      return;
    }
    enhanceModal(modal);
  }

  function handleMutations(mutations) {
    if (isApplyingSelection) return;
    if (mutations.some(isDialogOpeningMutation)) {
      clearTimeout(debounceTimer);
      const modal = findBestiaryModal();
      if (modal) {
        enhanceModal(modal);
      } else {
        scheduleModalSetupRetry();
      }
      return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processMutations, MODAL_CLOSE_DEBOUNCE_MS);
  }

  function initialize() {
    if (!config.enabled) return;
    onCosmeticsChanged = () => {
      const modal = findBestiaryModal();
      if (!modal) return;
      scheduleFullCreatureStyling(modal);
    };
    window.addEventListener('betterUICreatureCosmeticsChanged', onCosmeticsChanged);
    observer = new MutationObserver(handleMutations);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });
    processMutations();
    console.log('[Better Bestiary] initialized');
  }

  function cleanup() {
    const modal = activeModal ?? findBestiaryModal();
    teardownModalSession({
      full: true,
      resetDom: Boolean(modal?.isConnected && modal.getAttribute('data-state') === 'open'),
    });
    console.log('[Better Bestiary] cleaned up');
  }

  function updateConfig(newConfig) {
    Object.assign(config, newConfig);
    if (!config.enabled) cleanup();
    else if (!observer) initialize();
    else processMutations();
  }

  initialize();

  window.BetterBestiary.close = closeForExternalNavigation;
  window.BetterBestiary.prepareClose = prepareForExternalClose;
  window.BetterBestiary.isOpen = isBetterBestiaryModalOpen;

  exports = {
    cleanup,
    updateConfig,
    applyPresetSelection,
    refresh: processMutations,
    closeForExternalNavigation,
    isOpen: isBetterBestiaryModalOpen,
  };
})();
