// =======================
// Better Bestiary
// =======================
(function () {
  if (window.__betterBestiaryLoaded) return;
  window.__betterBestiaryLoaded = true;

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
  const TITLE_TEXT_ATTR = `data-${NS}-title-text`;
  const TITLE_CREDIT_ATTR = `data-${NS}-title-credit`;
  const AUTHOR_PROFILE_URL = 'https://bestiaryarena.com/profile/megafuji';
  const FILTERS_ATTR = `data-${NS}-filters`;
  const PRESET_ATTR = `data-${NS}-preset`;
  const COSMETIC_TOGGLE_ATTR = `data-${NS}-cosmetic-toggle`;
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

  let savedCosmeticSnapshot = null;

  const tick = (ms = 16) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitFrame = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

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
  }

  function teardownModalSession({ full = false } = {}) {
    clearAllTimers();
    detachAllModalObservers();
    isSyncingLayout = false;
    restoreTemporaryCosmeticSettings();

    if (activeModal) {
      window.BetterUIRemoveCreatureCosmeticsIn?.(activeModal);
      resetModalEnhancement(activeModal);
    }
    activeModal = null;

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
    gridObserver = new MutationObserver(() => scheduleIncrementalStyling(modal));
    gridObserver.observe(grid, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-multiselected'],
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

  function resetModalEnhancement(modal) {
    if (!modal) return;
    modal.removeAttribute(ENHANCED_ATTR);
    modal.removeAttribute(INITIAL_STYLED_ATTR);
    modal.removeAttribute(SIZED_ATTR);
    modal.removeAttribute(LAYOUT_SIZED_ATTR);
    modal.querySelector(`[${FILTERS_ATTR}="true"]`)?.remove();
    modal.querySelector(`[${DETAILS_TITLE_BLOCK_ATTR}="true"]`)?.remove();
    restoreHeaderDetailsLabels(modal);
    resetDetailsColumnLayout(modal);
    for (const label of modal.querySelectorAll(`[${DETAILS_TITLE_ATTR}="true"]`)) {
      label.removeAttribute(DETAILS_TITLE_ATTR);
      label.style.color = '';
      label.style.textAlign = '';
      label.classList.remove('text-center', 'w-full');
      label.querySelector(`[${TITLE_TEXT_ATTR}]`)?.remove();
      label.querySelector(`[${TITLE_CREDIT_ATTR}]`)?.remove();
    }
  }

  function t(key) {
    if (typeof api !== 'undefined' && api.i18n?.t) {
      return api.i18n.t(key);
    }
    if (typeof context !== 'undefined' && context.api?.i18n?.t) {
      return context.api.i18n.t(key);
    }
    return key;
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
    panel.appendChild(createFiltersColumn('mods.betterBestiary.presetsColumnTitle', () =>
      PRESET_KEYS.map((presetKey) => makePresetButton(presetKey)),
    ));
    panel.appendChild(createFiltersColumn('mods.betterBestiary.cosmeticsColumnTitle', () =>
      COSMETIC_TOGGLES.map(({ key }) => makeCosmeticToggleButton(key)),
    ));
    return panel;
  }

  function syncFiltersPanel(filters) {
    for (const btn of filters.querySelectorAll(`[${PRESET_ATTR}]`)) {
      btn.className = BTN_CLASS;
      updatePresetButton(btn, btn.getAttribute(PRESET_ATTR));
    }
    refreshCosmeticToggleButtons(filters.closest('[role="dialog"]') ?? findBestiaryModal());
    return filters;
  }

  function ensureFiltersPanel(detailsCol) {
    let filters = detailsCol.querySelector(`[${FILTERS_ATTR}="true"]`);
    const needsRebuild = !filters
      || !filters.classList.contains('grid-cols-2')
      || !filters.querySelector(`[${COSMETIC_TOGGLE_ATTR}]`);

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

  function suppressHeaderDetailsLabels(modal) {
    const headerRow = getBestiaryHeaderRow(modal);
    if (!headerRow) return;

    for (const label of headerRow.querySelectorAll('p[data-empty]')) {
      if (label.getAttribute(DETAILS_TITLE_ATTR) === 'true') {
        label.removeAttribute(DETAILS_TITLE_ATTR);
        label.style.color = '';
        label.style.textAlign = '';
        label.classList.remove('text-center', 'w-full');
        label.querySelector(`[${TITLE_TEXT_ATTR}]`)?.remove();
        label.querySelector(`[${TITLE_CREDIT_ATTR}]`)?.remove();
      }
      if (!label.hasAttribute(HEADER_LABEL_SUPPRESSED_ATTR)) {
        label.classList.add('!hidden');
        label.setAttribute(HEADER_LABEL_SUPPRESSED_ATTR, 'true');
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
    const creditText = t('mods.betterBestiary.authorCredit');
    const titleSpan = label.querySelector(`[${TITLE_TEXT_ATTR}]`);
    const credit = label.querySelector(`[${TITLE_CREDIT_ATTR}]`);
    return label.getAttribute(DETAILS_TITLE_ATTR) !== 'true'
      || titleSpan?.textContent !== activatedText
      || credit?.textContent !== creditText
      || credit?.getAttribute('href') !== AUTHOR_PROFILE_URL;
  }

  function applyDetailsTitleEnhancement(label, activatedText) {
    label.style.textAlign = 'center';
    label.classList.add('text-center', 'w-full');
    label.setAttribute(DETAILS_TITLE_ATTR, 'true');

    let titleSpan = label.querySelector(`[${TITLE_TEXT_ATTR}]`);
    let credit = label.querySelector(`[${TITLE_CREDIT_ATTR}]`);
    if (!titleSpan || !credit) {
      label.replaceChildren();
      titleSpan = document.createElement('span');
      titleSpan.setAttribute(TITLE_TEXT_ATTR, 'true');
      titleSpan.className = 'block';
      credit = document.createElement('a');
      credit.setAttribute(TITLE_CREDIT_ATTR, 'true');
      credit.href = AUTHOR_PROFILE_URL;
      credit.target = '_blank';
      credit.rel = 'noopener noreferrer';
      credit.className = 'pixel-font-14 text-whiteDarker hover:text-whiteHighlight';
      label.appendChild(titleSpan);
      label.appendChild(credit);
    }

    titleSpan.textContent = activatedText;
    titleSpan.style.color = ACTIVATED_TITLE_COLOR;
    credit.textContent = t('mods.betterBestiary.authorCredit');
    credit.href = AUTHOR_PROFILE_URL;
  }

  function ensureDetailsTitleBlock(detailsCol) {
    let titleBlock = detailsCol.querySelector(`[${DETAILS_TITLE_BLOCK_ATTR}="true"]`);
    if (!titleBlock) {
      titleBlock = document.createElement('p');
      titleBlock.setAttribute(DETAILS_TITLE_BLOCK_ATTR, 'true');
      titleBlock.className = 'w-full text-center';
    }

    const activatedText = t('mods.betterBestiary.activated');
    if (needsDetailsTitleEnhancement(titleBlock, activatedText)) {
      applyDetailsTitleEnhancement(titleBlock, activatedText);
    }

    return titleBlock;
  }

  function enhanceDetailsTitle(modal) {
    suppressHeaderDetailsLabels(modal);
    const detailsCol = findBestiaryDetailsColumn(modal);
    if (!detailsCol) return;
    ensureDetailsTitleBlock(detailsCol);
  }

  function syncModalLayout(modal) {
    if (!modal || isSyncingLayout) return;
    isSyncingLayout = true;
    try {
      if (ensurePresetButtons(modal)) {
        refreshCosmeticToggleButtons(modal);
      }
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

  function ensurePresetButtons(modal) {
    const detailsCol = findBestiaryDetailsColumn(modal);
    if (!detailsCol) return null;

    beginTemporaryCosmeticSession();

    const misplaced = modal.querySelector(`[${FILTERS_ATTR}="true"]`);
    if (misplaced && !detailsCol.contains(misplaced)) {
      misplaced.remove();
    }

    enhanceDetailsTitle(modal);
    const filters = ensureFiltersPanel(detailsCol);
    placeDetailsColumnLayout(detailsCol, filters);
    modal.setAttribute(ENHANCED_ATTR, 'true');
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
    const titleBlock = ensureDetailsTitleBlock(detailsCol);
    const panel = filters ?? detailsCol.querySelector(`[${FILTERS_ATTR}="true"]`);
    if (!panel) return;

    const contentBlock = getDetailsContentBlock(detailsCol);

    if (contentBlock) {
      if (panel.nextElementSibling !== contentBlock) {
        contentBlock.insertAdjacentElement('beforebegin', panel);
      }
      if (titleBlock.nextElementSibling !== panel) {
        panel.insertAdjacentElement('beforebegin', titleBlock);
      }
      applyDetailsColumnGridSizing(detailsCol);
      return;
    }

    if (!detailsCol.contains(titleBlock)) {
      detailsCol.prepend(titleBlock);
    }
    if (!detailsCol.contains(panel)) {
      titleBlock.insertAdjacentElement('afterend', panel);
    } else if (titleBlock.nextElementSibling !== panel) {
      panel.insertAdjacentElement('beforebegin', titleBlock);
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
    teardownModalSession({ full: true });
    console.log('[Better Bestiary] cleaned up');
  }

  function updateConfig(newConfig) {
    Object.assign(config, newConfig);
    if (!config.enabled) cleanup();
    else if (!observer) initialize();
    else processMutations();
  }

  initialize();

  exports = {
    cleanup,
    updateConfig,
    applyPresetSelection,
    refresh: processMutations,
  };
})();
