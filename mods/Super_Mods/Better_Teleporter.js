// Better Teleporter Mod for Bestiary Arena

(function () {
  if (window.__betterTeleporterLoaded) return;
  window.__betterTeleporterLoaded = true;

  // ============================================================================
  // 1. CONSTANTS
  // ============================================================================

  const NS = 'better-teleporter';
  const ENHANCED_ATTR = `data-${NS}-enhanced`;
  const XP_STAM_ATTR = `data-${NS}-xp-stam`;
  const REGION_ENHANCED_ATTR = `data-${NS}-region-enhanced`;
  const LAYOUT_ENHANCED_ATTR = `data-${NS}-layout-enhanced`;
  const TARGET_ATTR = `data-${NS}-target`;
  const STYLE_ID = `${NS}-layout-styles`;
  const SORT_BOUND_ATTR = `data-${NS}-sort-bound`;
  const SORT_HEADER_ATTR = `data-${NS}-sort-header`;
  const SORT_ARROW_ATTR = `data-${NS}-sort-arrow`;
  const REGION_HEADER_ATTR = `data-${NS}-region-header`;
  const TABLE_STYLE_ID = `${NS}-table-styles`;
  const THEAD_HEIGHT_VAR = `--${NS}-thead-height`;
  const MAP_COLUMN_WIDTH_PX = 180;
  const ROOM_TYPE_ATTR = `data-${NS}-room-type`;
  const TOOLTIP_ATTR = `data-${NS}-tooltip`;
  const FILTERS_ATTR = `data-${NS}-filters`;
  const REGION_SELECT_ATTR = `data-${NS}-region-select`;
  const HIDE_RAIDS_ATTR = `data-${NS}-hide-raids`;
  const RESET_FILTERS_ATTR = `data-${NS}-reset-filters`;
  const FILTERS_BOUND_ATTR = `data-${NS}-filters-bound`;
  const FILTER_ROW_ATTR = `data-${NS}-filter-row`;
  const SEARCH_SYNC_ATTR = `data-${NS}-search-sync`;
  const SEARCH_RESET_ATTR = `data-${NS}-search-reset`;
  const ROW_CONTEXT_BOUND_ATTR = `data-${NS}-row-context-bound`;
  const KEYBOARD_NAV_BOUND_ATTR = `data-${NS}-keyboard-nav-bound`;
  const CONTEXT_MENU_ID = `${NS}-context-menu`;
  const CONTEXT_MENU_OVERLAY_ID = `${NS}-context-menu-overlay`;
  const CONTEXT_MENU_HOST_ATTR = `data-${NS}-context-menu-host`;
  const SEARCH_INPUT_CAPTURE = true;
  const RAID_TEXT_COLOR = '#ff6b6b';
  const EVENT_TEXT_COLOR = 'rgb(50, 205, 50)';
  const ACTIVATED_TITLE_COLOR = 'rgb(50, 205, 50)';
  const ORIGINAL_TITLE_ATTR = `data-${NS}-original-title`;
  const NATIVE_TELEPORTER_TITLES = new Set(['Select a map', 'Escolher mapa']);
  const TELEPORTER_OPEN_ANIMATION_CLASSES = [
    'animate-in',
    'fade-in',
    'zoom-in-95',
    'slide-in-from-top',
    'slide-in-from-bottom',
    'max-w-lg',
    'max-w-md',
    'max-w-sm',
    'max-w-xl',
    'max-w-[300px]',
    'w-full',
    'w-screen',
  ];
  const TELEPORTER_GRAY_CONTROL_CLASS = 'pixel-font-14 frame-1 surface-regular bg-grayRegular px-2 py-0.5 text-whiteRegular';
  const TELEPORTER_TOGGLE_BUTTON_CLASS = 'focus-style-visible frame-1 active:frame-pressed-1 surface-regular px-2 py-0.5 pb-[3px] pixel-font-14 text-whiteRegular';
  const CONTEXT_MENU_PANEL_MEDIA = {
    BACKGROUND: 'https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png',
    FRAME: 'https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png',
  };
  const CONTEXT_MENU_SHIELD_EVENTS = ['mousedown', 'click', 'pointerdown'];
  const CONTEXT_MENU_BUTTON_LAYOUT = {
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    lineHeight: '1.25',
    minHeight: '24px',
    boxSizing: 'border-box',
    display: 'block',
  };
  const CONTEXT_MENU_UI = {
    OVERLAY_Z: 9998,
    MENU_Z: 9999,
    MAX_WIDTH: 200,
    ITEM_BASE_CLASS: 'focus-style-visible tracking-wide px-2 py-0.5 pb-[3px] pixel-font-14',
    ENTRY_CLASSES: {
      map: 'frame-1-red active:frame-pressed-1-red surface-red text-whiteHighlight',
      creature: 'frame-1-green active:frame-pressed-1-green surface-green text-whiteHighlight',
      equipment: 'frame-1-blue active:frame-pressed-1-blue surface-blue text-whiteHighlight',
    },
    CANCEL_CLASS: `focus-style-visible active:frame-pressed-1 ${TELEPORTER_GRAY_CONTROL_CLASS}`,
  };
  const MODAL_CONFIG = {
    width: 750,
    height: 550,
    viewportPadding: 16,
    minWidth: 280,
    minHeight: 280,
  };
  const UNOBTAINABLE_FOR_XP = new Set(['beer barrel', 'orc', 'sweaty cyclops']);
  const BUILD_RETRY_MS = 500;
  const BUILD_MAX_DURATION_MS = 30000;
  const TELEPORTER_CENTERED_TRANSFORM = 'translate(-50%, -50%) scale(1)';
  const TELEPORTER_TITLE_SELECTOR = 'h2.widget-top-text p, .widget-top.widget-top-text p, h2.widget-top:not(.sr-only) p';
  const ROOM_NAME_SELECTOR = 'p.hidden.sm\\:line-clamp-2, p.sm\\:line-clamp-2';
  const DIALOG_LAYOUT_REVERT_PROPS = [
    'width', 'minWidth', 'maxWidth', 'height', 'minHeight', 'maxHeight',
    'boxSizing', 'animation', 'transform', 'transition', 'willChange',
  ];
  const LAYOUT_CHILD_REVERT_PROPS = [
    'animation', 'transform', 'transition', 'width', 'minWidth', 'maxWidth',
    'height', 'display', 'flex', 'flexDirection', 'minHeight',
    'overflowY', 'overflowX', 'maxHeight',
  ];

  // ============================================================================
  // 2. STATE
  // ============================================================================

  let observer = null;
  let buildRetryTimer = null;
  let roomIndexById = null;
  let modalLayoutCleanup = null;
  let activeDialog = null;
  let suppressMutations = false;
  const tableSortState = new WeakMap();
  const tableSortHandlers = new WeakMap();
  const dialogFilterState = new WeakMap();
  const filterControlHandlers = new WeakMap();
  const rowContextHandlers = new WeakMap();
  const dialogKeyboardNavState = new WeakMap();
  const roomBoardMetaCache = new Map();
  let openRowContextMenu = null;
  let teleporterKeyboardHandler = null;
  let processModalsRaf = null;

  const DEFAULT_SESSION_PREFERENCES = {
    regionId: '',
    hideRaids: false,
    searchType: null,
    searchValue: '',
    sortKey: null,
    sortDir: 'asc',
  };

  let sessionPreferences = { ...DEFAULT_SESSION_PREFERENCES };

  function resetSessionPreferences() {
    sessionPreferences = { ...DEFAULT_SESSION_PREFERENCES };
  }

  function captureSessionPreferences(dialog) {
    if (!dialog || dialog.getAttribute(FILTERS_BOUND_ATTR) !== 'true') return;

    const filterState = dialogFilterState.get(dialog);
    const searchInput = getTeleporterSearchInput(dialog)
      || filterControlHandlers.get(dialog)?.searchInput;
    const table = dialog.querySelector('table');
    const sortState = table ? getTableSortState(table) : null;

    sessionPreferences = {
      regionId: filterState?.regionId || '',
      hideRaids: Boolean(filterState?.hideRaids),
      searchType: filterState?.searchType ?? null,
      searchValue: searchInput?.value || '',
      sortKey: sortState?.sortKey ?? null,
      sortDir: sortState?.sortDir || 'asc',
    };
  }

  function tf(key, fallback) {
    const value = t(key);
    return value === key ? fallback : value;
  }

  function t(key) {
    return window.BestiaryModAPI?.i18n?.t?.(key) ?? key;
  }

  function getActivatedTitle() {
    return t('mods.betterTeleporter.activated');
  }

  function getSearchKeywords(type) {
    const key = type === 'raid'
      ? 'mods.betterTeleporter.searchKeywordsRaid'
      : 'mods.betterTeleporter.searchKeywordsEvent';
    const raw = t(key);
    const fallback = type === 'raid' ? 'raid,raids' : 'event,events';
    const source = raw === key ? fallback : raw;
    return source.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  }

  // ============================================================================
  // 3. DIALOG DETECTION & MODAL LAYOUT
  // ============================================================================

  function getTeleporterTitleElement(dialog) {
    return dialog?.querySelector(TELEPORTER_TITLE_SELECTOR) || null;
  }

  function getRegionHeaderCell(tr) {
    return tr?.querySelector('td[colspan]') || null;
  }

  function isRegionHeaderRow(tr) {
    return Boolean(tr && (tr.getAttribute(REGION_HEADER_ATTR) === 'true' || getRegionHeaderCell(tr)));
  }

  function getRowSnapshotKey(tr) {
    if (!tr) return null;
    if (isRegionHeaderRow(tr)) {
      const regionId = getRegionIdByDisplayName(getRegionNameFromHeaderRow(tr));
      if (regionId) return `region:${regionId}`;
      const name = getRegionNameFromHeaderRow(tr);
      return name ? `region-name:${name}` : null;
    }
    const roomId = extractRoomIdFromRow(tr);
    return roomId ? `room:${roomId}` : null;
  }

  function captureTableRowOrder(tbody) {
    if (!tbody) return [];
    return [...tbody.querySelectorAll(':scope > tr')]
      .map(getRowSnapshotKey)
      .filter(Boolean);
  }

  function restoreTableRowOrder(table, orderKeys) {
    const tbody = table?.querySelector('tbody');
    if (!tbody || !orderKeys?.length) return false;

    const rowByKey = new Map();
    for (const tr of tbody.querySelectorAll(':scope > tr')) {
      const key = getRowSnapshotKey(tr);
      if (key && !rowByKey.has(key)) rowByKey.set(key, tr);
    }

    const fragment = document.createDocumentFragment();
    const placed = new Set();
    let missing = false;

    for (const key of orderKeys) {
      const tr = rowByKey.get(key);
      if (!tr) {
        missing = true;
        continue;
      }
      fragment.appendChild(tr);
      placed.add(tr);
    }

    for (const tr of tbody.querySelectorAll(':scope > tr')) {
      if (!placed.has(tr)) fragment.appendChild(tr);
    }

    tbody.appendChild(fragment);
    return !missing;
  }

  function syncSessionSortFromTable(table) {
    const state = getTableSortState(table);
    sessionPreferences.sortKey = state.sortKey;
    sessionPreferences.sortDir = state.sortDir;
  }

  function regionHeaderHasFollowingVisibleRooms(tr, filterState) {
    let sibling = tr.nextElementSibling;
    while (sibling) {
      if (isRegionHeaderRow(sibling)) return false;
      const roomId = extractRoomIdFromRow(sibling);
      if (roomId && isRowShownInDom(sibling) && isRoomRowVisible(roomId, filterState)) {
        return true;
      }
      sibling = sibling.nextElementSibling;
    }
    return false;
  }

  function isRegionLayoutBroken(tbody) {
    if (!tbody) return false;

    const rows = [...tbody.querySelectorAll(':scope > tr')];
    let consecutiveHeaders = 0;
    let sawRoom = false;

    for (const tr of rows) {
      if (!isRegionHeaderRow(tr)) {
        if (extractRoomIdFromRow(tr)) sawRoom = true;
        consecutiveHeaders = 0;
        continue;
      }

      if (sawRoom) return true;
      consecutiveHeaders += 1;
      if (consecutiveHeaders > 1) return true;
    }

    return false;
  }

  function isValidNativeLayout(tbody) {
    if (!tbody || isRegionLayoutBroken(tbody)) return false;

    let currentRegionId = null;
    for (const tr of tbody.querySelectorAll(':scope > tr')) {
      if (isRegionHeaderRow(tr)) {
        currentRegionId = getRegionIdByDisplayName(getRegionNameFromHeaderRow(tr));
        continue;
      }

      const roomId = extractRoomIdFromRow(tr);
      if (!roomId || !currentRegionId) continue;

      const { regionId } = getRoomRegion(roomId);
      if (regionId && regionId !== currentRegionId) return false;
    }

    return true;
  }

  function buildNativeOrderFromRegions() {
    const canonical = globalThis.mapsDatabase?.getCanonicalTableRowOrder?.();
    if (canonical?.length) return canonical;

    const keys = [];
    const regions = globalThis.mapsDatabase?.getRegionsInOrder?.()
      || globalThis.state?.utils?.REGIONS
      || [];

    for (const region of regions) {
      const regionId = region?.id;
      if (!regionId) continue;
      keys.push(`region:${regionId}`);
      for (const room of region.rooms || []) {
        if (room?.id) keys.push(`room:${room.id}`);
      }
    }

    return keys.length ? keys : null;
  }

  function unhideAllTableRows(tbody) {
    if (!tbody) return;
    for (const tr of tbody.querySelectorAll(':scope > tr')) {
      tr.style.removeProperty('display');
      tr.hidden = false;
      tr.removeAttribute('hidden');
    }
  }

  function showRoomRow(tr) {
    if (!tr || isRegionHeaderRow(tr)) return;
    tr.style.removeProperty('display');
    tr.hidden = false;
    tr.removeAttribute('hidden');
  }

  function syncNativeOrderState(table, order) {
    const tbody = table?.querySelector('tbody');
    const state = getTableSortState(table);
    if (!tbody || !order?.length) return;

    state.nativeOrder = order;
    state.snapshotOrder = order;
    state.snapshot = [...tbody.querySelectorAll(':scope > tr')];
  }

  function captureNativeOrder(table) {
    const tbody = table?.querySelector('tbody');
    const state = getTableSortState(table);
    if (!tbody || state.sortKey || !isValidNativeLayout(tbody)) return false;

    const order = captureTableRowOrder(tbody);
    if (!order.length) return false;

    syncNativeOrderState(table, order);
    return true;
  }

  function ensureNativeOrder(table) {
    const state = getTableSortState(table);
    if (state.nativeOrder?.length) return true;

    const order = buildNativeOrderFromRegions();
    if (order?.length) {
      state.nativeOrder = order;
      return true;
    }

    return captureNativeOrder(table);
  }

  function restoreToNativeOrder(table, { canonical = false } = {}) {
    const tbody = table?.querySelector('tbody');
    const state = getTableSortState(table);
    if (!tbody) return false;

    const canonicalOrder = buildNativeOrderFromRegions();
    const orders = canonical
      ? [canonicalOrder].filter((order) => order?.length)
      : [
        canonicalOrder,
        state.nativeOrder,
        state.snapshotOrder,
      ].filter((order) => order?.length);

    let restored = false;
    runWithoutMutationObserver(() => {
      for (const order of orders) {
        restoreTableRowOrder(table, order);
        unhideAllTableRows(tbody);
        if (canonical || isValidNativeLayout(tbody)) {
          syncNativeOrderState(table, order);
          restored = true;
          break;
        }
      }
    });

    return restored;
  }

  function getDialogRootWrapper(dialog) {
    return dialog?.querySelector(':scope > div') || null;
  }

  function getDialogScrollArea(dialog) {
    return dialog?.querySelector('[data-radix-scroll-area-viewport]')?.parentElement || null;
  }

  function getDialogContentContainer(dialog) {
    return dialog?.querySelector('.widget-bottom') || null;
  }

  function setImportantStyles(el, styles) {
    if (!el) return;
    for (const [prop, value] of styles) {
      el.style.setProperty(prop, value, 'important');
    }
  }

  function clearInlineStyles(el, props) {
    if (!el) return;
    for (const prop of props) {
      el.style.removeProperty(prop);
    }
  }

  function removeAnimationClasses(...elements) {
    for (const el of elements) {
      if (!el) continue;
      for (const cls of TELEPORTER_OPEN_ANIMATION_CLASSES) {
        el.classList.remove(cls);
      }
    }
  }

  function buildModalWidthStyles(width) {
    return [
      ['width', `${width}px`],
      ['min-width', '0'],
      ['max-width', `${width}px`],
    ];
  }

  function buildModalHeightStyles(height) {
    return [
      ['height', `${height}px`],
      ['min-height', '0'],
      ['max-height', `${height}px`],
    ];
  }

  function isTeleporterTitle(dialog) {
    const titleEl = getTeleporterTitleElement(dialog);
    if (!titleEl) return false;

    const trimmed = String(titleEl.textContent || '').trim();
    if (trimmed && (NATIVE_TELEPORTER_TITLES.has(trimmed) || trimmed === getActivatedTitle())) {
      return true;
    }
    return titleEl.hasAttribute(ORIGINAL_TITLE_ATTR);
  }

  function scheduleProcessTeleporterModals() {
    if (processModalsRaf != null) return;
    processModalsRaf = requestAnimationFrame(() => {
      processModalsRaf = null;
      processTeleporterModals();
    });
  }

  function matchesTeleporterForLayout(dialog) {
    if (!dialog || dialog.getAttribute('role') !== 'dialog') return false;
    if (isForeignModDialog(dialog)) return false;
    if (!isTeleporterTitle(dialog)) return false;

    const state = dialog.getAttribute('data-state');
    if (state === 'closed') return false;
    return true;
  }

  function matchesTeleporterContent(dialog) {
    if (!matchesTeleporterForLayout(dialog)) return false;
    return dialog.getAttribute('data-state') === 'open';
  }

  function isForeignModDialog(dialog) {
    if (!dialog) return true;
    if (dialog.hasAttribute('data-cyclopedia-dialog')) return true;
    if (dialog.hasAttribute('data-challenges-dialog')) return true;
    if (dialog.hasAttribute('data-better-bestiary-enhanced')) return true;
    if (dialog.querySelector('.cyclopedia-modal-root')) return true;
    return false;
  }

  function injectLayoutStyles() {
    const { width, height, viewportPadding } = MODAL_CONFIG;
    const pad = viewportPadding * 2;
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      div[role="dialog"][${TARGET_ATTR}] {
        width: min(${width}px, calc(100vw - ${pad}px)) !important;
        max-width: min(${width}px, calc(100vw - ${pad}px)) !important;
        height: min(${height}px, calc(100vh - ${pad}px)) !important;
        max-height: min(${height}px, calc(100vh - ${pad}px)) !important;
        min-width: 0 !important;
        animation: none !important;
        transform: ${TELEPORTER_CENTERED_TRANSFORM} !important;
        transition: none !important;
      }
      div[role="dialog"][${TARGET_ATTR}] > div:not(#${CONTEXT_MENU_ID}):not(#${CONTEXT_MENU_OVERLAY_ID}) {
        width: min(${width}px, calc(100vw - ${pad}px)) !important;
        max-width: min(${width}px, calc(100vw - ${pad}px)) !important;
        min-width: 0 !important;
        animation: none !important;
        transform: none !important;
        transition: none !important;
      }
      #${CONTEXT_MENU_ID} {
        width: ${CONTEXT_MENU_UI.MAX_WIDTH}px !important;
        max-width: ${CONTEXT_MENU_UI.MAX_WIDTH}px !important;
        min-width: 0 !important;
        height: auto !important;
        max-height: none !important;
        transform: none !important;
      }
      #${CONTEXT_MENU_ID} button {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        transform: none !important;
        box-sizing: border-box !important;
        border-radius: 2px !important;
      }
      #${CONTEXT_MENU_OVERLAY_ID} {
        width: auto !important;
        max-width: none !important;
        height: auto !important;
        max-height: none !important;
        transform: none !important;
      }
    `;
  }

  function injectTableStyles() {
    if (document.getElementById(TABLE_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = TABLE_STYLE_ID;
    style.textContent = `
      div[role="dialog"][${TARGET_ATTR}] table thead tr > th:first-child,
      div[role="dialog"][${TARGET_ATTR}] table tbody tr > td:first-child {
        width: ${MAP_COLUMN_WIDTH_PX}px !important;
        min-width: ${MAP_COLUMN_WIDTH_PX}px !important;
        max-width: ${MAP_COLUMN_WIDTH_PX}px !important;
      }
      div[role="dialog"][${TARGET_ATTR}] tr[${REGION_HEADER_ATTR}] > td[colspan] {
        position: sticky;
        top: var(${THEAD_HEIGHT_VAR}, 24px);
        z-index: 2;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
      }
    `;
    document.head.appendChild(style);
  }

  function updateStickyRegionOffset(table) {
    const theadRow = table.querySelector('thead tr');
    const height = theadRow?.getBoundingClientRect().height;
    table.style.setProperty(THEAD_HEIGHT_VAR, `${Math.ceil(height || 24)}px`);
  }

  function findTeleporterSearchInputCandidate(dialog) {
    if (!dialog) return null;

    for (const input of dialog.querySelectorAll('.widget-bottom input')) {
      if (input.closest('[data-radix-scroll-area-viewport]')) continue;
      return input;
    }

    return null;
  }

  function getTeleporterSearchInput(dialog) {
    const candidate = findTeleporterSearchInputCandidate(dialog);
    if (candidate?.hasAttribute('placeholder')) return candidate;

    for (const input of dialog?.querySelectorAll('.widget-bottom input[placeholder]') || []) {
      if (input.closest('[data-radix-scroll-area-viewport]')) continue;
      return input;
    }

    return dialog?.querySelector('.widget-bottom input[placeholder]') || null;
  }

  function isTeleporterProcessingComplete(dialog) {
    if (!dialog?.hasAttribute(LAYOUT_ENHANCED_ATTR)) return false;
    if (!matchesTeleporterContent(dialog)) return true;

    const titleEl = getTeleporterTitleElement(dialog);
    if (titleEl?.getAttribute(ENHANCED_ATTR) !== 'true') return false;

    const searchInput = findTeleporterSearchInputCandidate(dialog);
    if (searchInput && dialog.getAttribute(FILTERS_BOUND_ATTR) !== 'true') return false;

    const table = dialog.querySelector('table');
    if (!table) return true;
    if (table.getAttribute(SORT_BOUND_ATTR) !== 'true') return false;
    if (tableNeedsEnhancement(table)) return false;

    return true;
  }

  function markAndEnhanceTeleporterDialog(dialog) {
    if (!matchesTeleporterForLayout(dialog)) return false;
    if (isTeleporterProcessingComplete(dialog)) return true;

    const needsLayoutSetup = !dialog.hasAttribute(LAYOUT_ENHANCED_ATTR);

    if (needsLayoutSetup) {
      runWithoutMutationObserver(() => {
        dialog.setAttribute(TARGET_ATTR, '');
        applyTeleporterModalLayout(dialog);
      });
      setupTeleporterModalLayout(dialog);
    }

    if (!matchesTeleporterContent(dialog)) return true;

    enhanceTeleporterTitle(dialog);
    ensureTeleporterFilters(dialog);

    return true;
  }

  function collectTeleporterDialogsFromNode(node) {
    const dialogs = new Set();
    if (!(node instanceof Element)) return dialogs;

    if (node.matches?.('div[role="dialog"]')) dialogs.add(node);

    for (const dialog of node.querySelectorAll?.('div[role="dialog"]') || []) {
      dialogs.add(dialog);
    }

    const hostDialog = node.closest?.('div[role="dialog"]');
    if (hostDialog) dialogs.add(hostDialog);

    return dialogs;
  }

  function scanNodeForTeleporter(node) {
    for (const dialog of collectTeleporterDialogsFromNode(node)) {
      if (dialog.hasAttribute(LAYOUT_ENHANCED_ATTR)) continue;
      markAndEnhanceTeleporterDialog(dialog);
    }
  }

  function getModalDimensions() {
    const pad = MODAL_CONFIG.viewportPadding * 2;
    return {
      width: Math.max(
        MODAL_CONFIG.minWidth,
        Math.min(MODAL_CONFIG.width, window.innerWidth - pad)
      ),
      height: Math.max(
        MODAL_CONFIG.minHeight,
        Math.min(MODAL_CONFIG.height, window.innerHeight - pad)
      ),
    };
  }

  function clearModalLayoutCleanup() {
    if (modalLayoutCleanup) {
      modalLayoutCleanup();
      modalLayoutCleanup = null;
    }
    activeDialog = null;
  }

  function clearTeleporterWidthConstraints(dialog) {
    removeAnimationClasses(dialog, getDialogRootWrapper(dialog));
  }

  function applyTeleporterModalLayout(dialog) {
    if (!dialog || isForeignModDialog(dialog) || !matchesTeleporterForLayout(dialog)) return;

    const { width, height } = getModalDimensions();
    const rootWrapper = getDialogRootWrapper(dialog);

    clearTeleporterWidthConstraints(dialog);

    runWithoutMutationObserver(() => {
      dialog.setAttribute(TARGET_ATTR, '');
      setImportantStyles(dialog, [
        ...buildModalWidthStyles(width),
        ...buildModalHeightStyles(height),
        ['box-sizing', 'border-box'],
        ['animation', 'none'],
        ['transform', TELEPORTER_CENTERED_TRANSFORM],
        ['transition', 'none'],
        ['will-change', 'auto'],
      ]);
      dialog.setAttribute(LAYOUT_ENHANCED_ATTR, 'true');

      if (rootWrapper) {
        setImportantStyles(rootWrapper, [
          ...buildModalWidthStyles(width),
          ['animation', 'none'],
          ['transform', 'none'],
          ['transition', 'none'],
        ]);
        Object.assign(rootWrapper.style, {
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 0',
          minHeight: '0',
        });
      }
    });

    const contentContainer = getDialogContentContainer(dialog);
    if (contentContainer) {
      Object.assign(contentContainer.style, {
        flex: '1 1 auto',
        minHeight: '0',
        overflowY: 'hidden',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      });
    }

    const scrollArea = getDialogScrollArea(dialog);
    if (scrollArea) {
      Object.assign(scrollArea.style, {
        flex: '1 1 0',
        minHeight: '0',
        height: 'auto',
        maxHeight: 'none',
      });
    }
  }

  function setupTeleporterModalLayout(dialog) {
    const apply = () => {
      if (!dialog.isConnected || !matchesTeleporterForLayout(dialog)) {
        if (activeDialog === dialog) clearModalLayoutCleanup();
        return;
      }
      applyTeleporterModalLayout(dialog);
    };

    if (activeDialog === dialog && modalLayoutCleanup) {
      apply();
      return;
    }

    clearModalLayoutCleanup();
    activeDialog = dialog;

    apply();
    let burstFrames = 0;
    const burstApply = () => {
      apply();
      burstFrames += 1;
      if (burstFrames < 4) requestAnimationFrame(burstApply);
    };
    requestAnimationFrame(burstApply);

    const onResize = () => apply();
    window.addEventListener('resize', onResize);
    modalLayoutCleanup = () => {
      window.removeEventListener('resize', onResize);
      activeDialog = null;
    };
  }

  function revertTeleporterModalLayout(dialog) {
    if (!dialog) return;
    if (dialog.getAttribute(LAYOUT_ENHANCED_ATTR) !== 'true' && !dialog.hasAttribute(TARGET_ATTR)) return;

    clearInlineStyles(dialog, DIALOG_LAYOUT_REVERT_PROPS);
    dialog.removeAttribute(LAYOUT_ENHANCED_ATTR);
    dialog.removeAttribute(TARGET_ATTR);

    for (const el of [getDialogRootWrapper(dialog), getDialogContentContainer(dialog), getDialogScrollArea(dialog)]) {
      clearInlineStyles(el, LAYOUT_CHILD_REVERT_PROPS);
    }
  }

  function teardownTeleporterTableEnhancements(dialog) {
    const table = dialog?.querySelector('table');
    if (!table) return;

    for (const tr of table.querySelectorAll('tbody tr')) {
      teardownRowContextMenu(tr);
      clearRoomRowAccent(tr);
    }

    teardownSortableHeaders(table);
    releaseTableSortState(table);
  }

  function releaseTableSortState(table) {
    const state = tableSortState.get(table);
    if (!state) return;

    state.sortKey = null;
    state.sortDir = 'asc';
    state.snapshot = null;
    state.snapshotOrder = null;
    state.tbody = null;
  }

  function teardownTeleporterDialogEnhancements(dialog) {
    if (!dialog) return;

    if (openRowContextMenu?.host === dialog) {
      closeRowContextMenu();
    } else if (dialog.hasAttribute(CONTEXT_MENU_HOST_ATTR)) {
      document.getElementById(CONTEXT_MENU_OVERLAY_ID)?.remove();
      document.getElementById(CONTEXT_MENU_ID)?.remove();
      dialog.removeAttribute(CONTEXT_MENU_HOST_ATTR);
    }

    teardownTeleporterFilters(dialog);
    unbindTeleporterKeyboardNav(dialog);
    if (activeDialog === dialog) clearModalLayoutCleanup();
    revertTeleporterModalLayout(dialog);
  }

  function handleTeleporterDialogStateChange(dialog) {
    if (dialog.getAttribute('data-state') === 'closed') {
      teardownTeleporterDialogEnhancements(dialog);
      return;
    }
    markAndEnhanceTeleporterDialog(dialog);
  }

  function findOpenTeleporterDialog() {
    for (const dialog of document.querySelectorAll('div[role="dialog"]')) {
      if (matchesTeleporterContent(dialog)) return dialog;
    }
    return null;
  }

  function findTeleporterDialogs() {
    return [...document.querySelectorAll('div[role="dialog"]')].filter(matchesTeleporterForLayout);
  }

  function focusTeleporterSearchInput(dialog = findOpenTeleporterDialog()) {
    const searchInput = getTeleporterSearchInput(dialog);
    if (!searchInput) return false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          searchInput.focus({ preventScroll: true });
        } catch (_) {}
      });
    });
    return true;
  }

  function findTeleporterGotoButton() {
    for (const img of document.querySelectorAll('button img[src*="goto.png"]')) {
      const btn = img.closest('button');
      if (!btn || btn.disabled || btn.closest('[role="dialog"]')) continue;
      return btn;
    }
    return null;
  }

  function scheduleFocusTeleporterSearchAfterOpen() {
    let attempts = 24;
    const tick = () => {
      const dialog = findOpenTeleporterDialog();
      if (dialog && focusTeleporterSearchInput(dialog)) return;
      attempts -= 1;
      if (attempts <= 0) return;
      setTimeout(tick, 50);
    };
    requestAnimationFrame(tick);
  }

  function openNativeTeleporter() {
    const existing = findOpenTeleporterDialog();
    if (existing) {
      focusTeleporterSearchInput(existing);
      return;
    }

    const gotoButton = findTeleporterGotoButton();
    if (gotoButton && typeof gotoButton.click === 'function') {
      gotoButton.click();
      scheduleFocusTeleporterSearchAfterOpen();
      return;
    }

    console.warn('[Better Teleporter] Native teleporter open failed: goto button not found');
  }

  function getDialogKeyboardNavState(dialog) {
    if (!dialogKeyboardNavState.has(dialog)) {
      dialogKeyboardNavState.set(dialog, { selectedRoomId: null });
    }
    return dialogKeyboardNavState.get(dialog);
  }

  function getKeyboardSelectedRoomId(dialog) {
    return getDialogKeyboardNavState(dialog).selectedRoomId;
  }

  function isKeyboardNavTargetBlocked(target, { forEnter = false } = {}) {
    if (!target || !(target instanceof Element)) return false;
    const tag = target.tagName;
    if (tag === 'SELECT' || tag === 'TEXTAREA') return true;
    if (forEnter && tag === 'BUTTON') return true;
    if (target.closest(`#${CONTEXT_MENU_ID}, #${CONTEXT_MENU_OVERLAY_ID}`)) return true;
    return false;
  }

  function getVisibleRoomRowsFromTable(table) {
    const tbody = table?.querySelector('tbody');
    if (!tbody) return [];

    const rows = [];
    for (const tr of tbody.querySelectorAll(':scope > tr')) {
      if (isRegionHeaderRow(tr)) continue;
      if (!isRowShownInDom(tr)) continue;
      const roomId = extractRoomIdFromRow(tr);
      if (roomId) rows.push({ tr, roomId });
    }
    return rows;
  }

  function getTableScrollContainer(table) {
    return table.closest('[data-radix-scroll-area-viewport]')
      || table.closest('.scroll-view')
      || table.parentElement;
  }

  function scrollRoomRowIntoView(tr, table) {
    const container = getTableScrollContainer(table);
    if (container && typeof container.scrollTop === 'number') {
      const rowTop = tr.offsetTop;
      const rowBottom = rowTop + tr.offsetHeight;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;
      if (rowTop < viewTop) {
        container.scrollTop = rowTop;
      } else if (rowBottom > viewBottom) {
        container.scrollTop = rowBottom - container.clientHeight;
      }
      return;
    }
    tr.scrollIntoView({ block: 'nearest' });
  }

  function setKeyboardSelectedRoom(dialog, roomId) {
    const state = getDialogKeyboardNavState(dialog);
    state.selectedRoomId = roomId || null;

    const table = dialog.querySelector('table');
    if (table) syncTeleporterRowHighlights(table, dialog);
    if (!roomId || !table) return;

    const match = getVisibleRoomRowsFromTable(table).find((row) => row.roomId === roomId);
    if (match) scrollRoomRowIntoView(match.tr, table);
  }

  function moveKeyboardSelection(dialog, direction) {
    const table = dialog.querySelector('table');
    if (!table) return;

    const visible = getVisibleRoomRowsFromTable(table);
    if (!visible.length) return;

    const state = getDialogKeyboardNavState(dialog);
    let idx = state.selectedRoomId
      ? visible.findIndex((row) => row.roomId === state.selectedRoomId)
      : -1;

    if (direction === 'down') {
      idx = idx < visible.length - 1 ? idx + 1 : 0;
    } else {
      idx = idx > 0 ? idx - 1 : visible.length - 1;
    }

    setKeyboardSelectedRoom(dialog, visible[idx].roomId);
  }

  function travelToKeyboardSelectedRoom(dialog) {
    const table = dialog.querySelector('table');
    if (!table) return;

    const visible = getVisibleRoomRowsFromTable(table);
    if (!visible.length) return;

    const state = getDialogKeyboardNavState(dialog);
    const roomId = state.selectedRoomId || visible[0].roomId;
    const match = visible.find((row) => row.roomId === roomId) || visible[0];
    if (!match?.tr) return;

    match.tr.click();
  }

  function ensureKeyboardSelectionStillVisible(dialog) {
    if (dialog.getAttribute(KEYBOARD_NAV_BOUND_ATTR) !== 'true') return;

    const table = dialog.querySelector('table');
    if (!table) return;

    const state = getDialogKeyboardNavState(dialog);
    const visible = getVisibleRoomRowsFromTable(table);
    if (!visible.length) {
      state.selectedRoomId = null;
      syncTeleporterRowHighlights(table, dialog);
      return;
    }

    const currentRoomId = getCurrentRoomId();
    if (!state.selectedRoomId) {
      const preferredRoomId = currentRoomId && visible.some((row) => row.roomId === currentRoomId)
        ? currentRoomId
        : visible[0].roomId;
      setKeyboardSelectedRoom(dialog, preferredRoomId);
      return;
    }

    if (!visible.some((row) => row.roomId === state.selectedRoomId)) {
      setKeyboardSelectedRoom(dialog, visible[0].roomId);
      return;
    }

    syncTeleporterRowHighlights(table, dialog);
  }

  function handleTeleporterKeyboardNav(event) {
    const dialog = findOpenTeleporterDialog();
    if (!dialog || dialog.getAttribute('data-state') !== 'open') return;
    if (openRowContextMenu) return;
    if (event.repeat) return;
    if (event.isTrusted === false) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (isKeyboardNavTargetBlocked(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      moveKeyboardSelection(dialog, event.key === 'ArrowDown' ? 'down' : 'up');
      return;
    }

    if (event.key === 'Enter') {
      if (isKeyboardNavTargetBlocked(event.target, { forEnter: true })) return;
      event.preventDefault();
      event.stopPropagation();
      travelToKeyboardSelectedRoom(dialog);
    }
  }

  function bindTeleporterKeyboardNav(dialog) {
    if (dialog.getAttribute(KEYBOARD_NAV_BOUND_ATTR) === 'true') {
      ensureKeyboardSelectionStillVisible(dialog);
      return;
    }

    dialog.setAttribute(KEYBOARD_NAV_BOUND_ATTR, 'true');
    if (!teleporterKeyboardHandler) {
      teleporterKeyboardHandler = handleTeleporterKeyboardNav;
      document.addEventListener('keydown', teleporterKeyboardHandler, true);
    }
    ensureKeyboardSelectionStillVisible(dialog);
  }

  function unbindTeleporterKeyboardNav(dialog) {
    if (!dialog) return;
    dialog.removeAttribute(KEYBOARD_NAV_BOUND_ATTR);
    dialogKeyboardNavState.delete(dialog);

    const anyBound = document.querySelector(`div[role="dialog"][${KEYBOARD_NAV_BOUND_ATTR}="true"]`);
    if (!anyBound && teleporterKeyboardHandler) {
      document.removeEventListener('keydown', teleporterKeyboardHandler, true);
      teleporterKeyboardHandler = null;
    }
  }

  function detachTeleporterKeyboardNavListener() {
    if (!teleporterKeyboardHandler) return;
    document.removeEventListener('keydown', teleporterKeyboardHandler, true);
    teleporterKeyboardHandler = null;
  }

  // ============================================================================
  // 4. INDEX BUILD
  // ============================================================================

  function resolveRegionName(regionId) {
    if (!regionId) return 'Unknown';
    if (typeof globalThis.mapsDatabase?.getRegionDisplayName === 'function') {
      return globalThis.mapsDatabase.getRegionDisplayName(regionId);
    }
    const fromGame = globalThis.state?.utils?.REGION_NAME?.[regionId]
      || globalThis.state?.utils?.regionIdsToNames?.[regionId];
    if (fromGame) return fromGame;
    const key = String(regionId).toLowerCase();
    const mapped = globalThis.mapsDatabase?.REGION_NAME_MAP?.[key];
    if (mapped) return mapped;
    return String(regionId).replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  function buildRoomIndex() {
    const utils = globalThis.state?.utils;
    if (!utils?.REGIONS || typeof utils.getBoardMonstersFromRoomId !== 'function') {
      return null;
    }

    const regions = utils.REGIONS || [];
    const roomNames = utils.ROOM_NAME || {};
    const getMonster = utils.getMonster;
    const getBoard = utils.getBoardMonstersFromRoomId;

    const monsterMetaCache = new Map();
    const resolveMonsterName = (gameId) => {
      if (monsterMetaCache.has(gameId)) return monsterMetaCache.get(gameId);
      let name = `#${gameId}`;
      try {
        const m = typeof getMonster === 'function' ? getMonster(gameId) : null;
        if (m?.metadata?.name) name = m.metadata.name;
      } catch (_) {}
      monsterMetaCache.set(gameId, name);
      return name;
    };

    const byId = new Map();
    for (const region of regions) {
      const regionId = region?.id;
      if (!regionId) continue;

      for (const room of (region?.rooms || [])) {
        const roomId = room?.id;
        if (!roomId) continue;

        let villains = [];
        try {
          const board = getBoard(roomId);
          if (Array.isArray(board)) villains = board.filter((p) => p?.villain === true);
        } catch (_) {}

        let levelSumCapped = 0;
        for (const v of villains) {
          const gid = Number(v.gameId);
          const lvl = Number(v.level || 0);
          if (!Number.isFinite(gid)) continue;
          const lowerName = String(resolveMonsterName(gid)).toLowerCase();
          if (!UNOBTAINABLE_FOR_XP.has(lowerName)) {
            levelSumCapped += Math.min(lvl, 50);
          }
        }

        const staminaCost = Number(room.staminaCost ?? 0);
        const expAvg = Math.round(levelSumCapped * 562.5);
        const expPerStamina = staminaCost > 0 ? expAvg / staminaCost : 0;

        byId.set(roomId, {
          id: roomId,
          name: roomNames[roomId] || roomId,
          regionId,
          regionName: resolveRegionName(regionId),
          staminaCost,
          expAvg,
          expPerStamina,
          raid: room.raid === true,
          dynamicEvent: globalThis.mapsDatabase?.isDynamicEventMap?.(roomId) === true,
        });
      }
    }

    return byId.size > 0 ? byId : null;
  }

  function tryBuildIndex(startedAt = Date.now()) {
    const index = buildRoomIndex();
    if (index) {
      roomIndexById = index;
      return;
    }

    if (Date.now() - startedAt > BUILD_MAX_DURATION_MS) {
      console.warn('[Better Teleporter] Gave up building room index — state.utils never became ready');
      return;
    }

    buildRetryTimer = setTimeout(() => tryBuildIndex(startedAt), BUILD_RETRY_MS);
  }

  function getRoomById(roomId) {
    if (!roomId) return null;
    return roomIndexById?.get(roomId) || null;
  }

  function getMapsDatabase() {
    return globalThis.mapsDatabase || window.mapsDatabase || null;
  }

  function getRoomFlags(roomId) {
    const mapsDb = getMapsDatabase();
    const fromDb = {
      raid: mapsDb?.isRaid?.(roomId) === true,
      dynamicEvent: mapsDb?.isDynamicEventMap?.(roomId) === true,
    };
    if (fromDb.raid || fromDb.dynamicEvent) return fromDb;

    const room = getRoomById(roomId);
    if (room) {
      return {
        raid: room.raid === true,
        dynamicEvent: room.dynamicEvent === true,
      };
    }

    for (const region of globalThis.state?.utils?.REGIONS || []) {
      const match = region?.rooms?.find((entry) => entry?.id === roomId);
      if (!match) continue;
      return {
        raid: match.raid === true,
        dynamicEvent: mapsDb?.isDynamicEventMap?.(roomId) === true,
      };
    }

    return { raid: false, dynamicEvent: false };
  }

  function getRoomRegion(roomId) {
    const room = getRoomById(roomId);
    if (room?.regionId) {
      return { regionId: room.regionId, regionName: room.regionName || resolveRegionName(room.regionId) };
    }

    for (const region of globalThis.state?.utils?.REGIONS || []) {
      const regionId = region?.id;
      if (!regionId) continue;
      if (region.rooms?.some((entry) => entry?.id === roomId)) {
        return { regionId, regionName: resolveRegionName(regionId) };
      }
    }

    return { regionId: null, regionName: null };
  }

  // ============================================================================
  // 5. FILTERS
  // ============================================================================

  function getFilterState(dialog) {
    if (!dialogFilterState.has(dialog)) {
      dialogFilterState.set(dialog, {
        regionId: sessionPreferences.regionId,
        hideRaids: sessionPreferences.hideRaids,
        searchType: sessionPreferences.searchType,
      });
    }
    return dialogFilterState.get(dialog);
  }

  function parseSearchType(value) {
    const lower = String(value || '').trim().toLowerCase();
    if (getSearchKeywords('raid').includes(lower)) return 'raid';
    if (getSearchKeywords('event').includes(lower)) return 'event';
    return null;
  }

  function setNativeInputValue(input, value) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (descriptor?.set) descriptor.set.call(input, value);
    else input.value = value;
  }

  function setRowFilterVisibility(tr, visible) {
    if (visible) {
      tr.hidden = false;
      tr.removeAttribute('hidden');
      tr.style.display = 'table-row';
    } else {
      tr.style.display = 'none';
    }
  }

  function syncFilterStateFromSearch(dialog) {
    const searchInput = getTeleporterSearchInput(dialog);
    if (!searchInput) return;
    getFilterState(dialog).searchType = parseSearchType(searchInput.value);
  }

  function countRoomRowsInTable(dialog) {
    const tbody = dialog.querySelector('tbody');
    if (!tbody) return 0;
    return [...tbody.querySelectorAll(':scope > tr')].filter(
      (tr) => !isRegionHeaderRow(tr) && extractRoomIdFromRow(tr),
    ).length;
  }

  function countVisibleRoomRowsInTable(dialog) {
    const tbody = dialog.querySelector('tbody');
    if (!tbody) return 0;
    return [...tbody.querySelectorAll(':scope > tr')].filter(
      (tr) => extractRoomIdFromRow(tr) && isRowShownInDom(tr),
    ).length;
  }

  function getExpectedRoomRowCount() {
    if (roomIndexById?.size) return roomIndexById.size;
    let count = 0;
    for (const region of globalThis.state?.utils?.REGIONS || []) {
      count += region?.rooms?.length || 0;
    }
    return count;
  }

  function needsNativeSearchReset(dialog) {
    const expected = getExpectedRoomRowCount();
    if (!expected) return false;
    const threshold = Math.max(8, Math.floor(expected * 0.75));
    return countVisibleRoomRowsInTable(dialog) < threshold
      || countRoomRowsInTable(dialog) < threshold;
  }

  function getTeleporterSearchClearButton(dialog) {
    const searchInput = getTeleporterSearchInput(dialog);
    if (!searchInput) return null;
    const frame = searchInput.closest('.frame-pressed-1');
    const button = frame?.querySelector('button');
    if (!button || button.disabled) return null;
    return button;
  }

  function dispatchNativeSearchInput(searchInput, value, inputType) {
    searchInput.setAttribute(SEARCH_RESET_ATTR, 'true');
    setNativeInputValue(searchInput, value);
    searchInput.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType,
      data: value,
    }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    searchInput.removeAttribute(SEARCH_RESET_ATTR);
  }

  function pulseNativeSearchRefresh(searchInput) {
    searchInput.setAttribute(SEARCH_RESET_ATTR, 'true');
    setNativeInputValue(searchInput, ' ');
    searchInput.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: ' ',
    }));

    requestAnimationFrame(() => {
      setNativeInputValue(searchInput, '');
      searchInput.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'deleteContentBackward',
      }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      searchInput.removeAttribute(SEARCH_RESET_ATTR);
    });
  }

  function waitForNativeSearchCleared(dialog, maxFrames = 40) {
    return new Promise((resolve) => {
      let frames = 0;
      let retried = false;

      const step = () => {
        if (!document.contains(dialog)) {
          resolve(false);
          return;
        }

        if (!needsNativeSearchReset(dialog)) {
          resolve(true);
          return;
        }

        frames += 1;
        if (!retried && frames >= Math.floor(maxFrames / 2)) {
          retried = true;
          const searchInput = getTeleporterSearchInput(dialog);
          if (searchInput) pulseNativeSearchRefresh(searchInput);
        }

        if (frames >= maxFrames) {
          resolve(false);
          return;
        }

        requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    });
  }

  function restoreNativeSearchResults(dialogOrInput) {
    const searchInput = dialogOrInput?.tagName === 'INPUT'
      ? dialogOrInput
      : getTeleporterSearchInput(dialogOrInput);
    const dialog = searchInput?.closest('div[role="dialog"]') || dialogOrInput;
    if (!searchInput || !dialog) return Promise.resolve(false);

    searchInput.removeAttribute(SEARCH_SYNC_ATTR);

    const staleFilteredTable = needsNativeSearchReset(dialog);
    const clearButton = getTeleporterSearchClearButton(dialog);

    if (clearButton && searchInput.value.trim()) {
      searchInput.setAttribute(SEARCH_RESET_ATTR, 'true');
      clearButton.click();
      searchInput.removeAttribute(SEARCH_RESET_ATTR);
    } else if (staleFilteredTable && !searchInput.value.trim()) {
      pulseNativeSearchRefresh(searchInput);
    } else {
      dispatchNativeSearchInput(searchInput, '', 'deleteContentBackward');
    }

    return waitForNativeSearchCleared(dialog);
  }

  function scheduleKeywordFilterApply(dialog, searchInput, displayValue, resetNative) {
    requestAnimationFrame(() => {
      if (resetNative) {
        setNativeInputValue(searchInput, displayValue);
      }
      applyTeleporterFilters(dialog);
    });
  }

  function isTableSearchActive(dialog) {
    const searchInput = getTeleporterSearchInput(dialog);
    const value = searchInput?.value?.trim();
    if (!value) return false;
    return true;
  }

  function prepareTableForNativeSearch(dialog) {
    const table = dialog.querySelector('table');
    if (!table) return false;

    const sortState = getTableSortState(table);
    if (!sortState.sortKey) return false;

    sortState.sortKey = null;
    sortState.sortDir = 'asc';
    sessionPreferences.sortKey = null;
    sessionPreferences.sortDir = 'asc';
    applyTableSort(table);
    return true;
  }

  function handleSearchInput(event, dialog, searchInput) {
    if (searchInput.getAttribute(SEARCH_RESET_ATTR) === 'true') return;

    const keyword = String(searchInput.value || '').trim().toLowerCase();
    const searchType = parseSearchType(keyword);
    const state = getFilterState(dialog);
    const prevSearchType = state.searchType;
    const prevKeyword = searchInput.getAttribute(SEARCH_SYNC_ATTR) || '';

    if (!searchType) {
      prepareTableForNativeSearch(dialog);
      searchInput.removeAttribute(SEARCH_SYNC_ATTR);
      state.searchType = null;
      if (prevSearchType !== null || state.regionId || state.hideRaids) {
        applyTeleporterFilters(dialog);
      } else if (searchInput.value.trim()) {
        scheduleRegionHeaderSync(dialog);
      } else {
        applyTeleporterFilters(dialog);
      }
      return;
    }

    event?.stopImmediatePropagation?.();
    event?.stopPropagation?.();

    state.searchType = searchType;

    if (prevKeyword === keyword) {
      scheduleKeywordFilterApply(dialog, searchInput, searchInput.value, false);
      return;
    }

    const displayValue = searchInput.value;
    searchInput.setAttribute(SEARCH_SYNC_ATTR, keyword);
    prepareTableForNativeSearch(dialog);
    const resetNative = needsNativeSearchReset(dialog);
    if (resetNative) {
      restoreNativeSearchResults(dialog).then(() => {
        scheduleKeywordFilterApply(dialog, searchInput, displayValue, resetNative);
      });
      return;
    }
    scheduleKeywordFilterApply(dialog, searchInput, displayValue, resetNative);
  }

  function getRegionOptions() {
    const seen = new Map();
    const rooms = [...(roomIndexById?.values() || [])];

    for (const room of rooms) {
      if (room?.regionId && !seen.has(room.regionId)) {
        seen.set(room.regionId, room.regionName || resolveRegionName(room.regionId));
      }
    }

    const sorted = [];
    const ordered = globalThis.mapsDatabase?.getRegionsInOrder?.();
    if (Array.isArray(ordered)) {
      for (const region of ordered) {
        const label = seen.get(region.id);
        if (label !== undefined) {
          sorted.push([region.id, label]);
          seen.delete(region.id);
        }
      }
    }
    for (const [id, label] of seen.entries()) sorted.push([id, label]);
    return sorted;
  }

  function getRegionNameFromHeaderRow(tr) {
    const td = getRegionHeaderCell(tr);
    if (!td) return '';
    const clone = td.cloneNode(true);
    clone.querySelectorAll('img').forEach((img) => img.remove());
    return clone.textContent.trim();
  }

  function getRegionIdByDisplayName(name) {
    if (!name) return null;
    for (const room of [...(roomIndexById?.values() || [])]) {
      if (room.regionName === name) return room.regionId;
    }

    const regionNames = globalThis.state?.utils?.REGION_NAME || {};
    for (const [id, label] of Object.entries(regionNames)) {
      if (label === name) return id;
    }
    return null;
  }

  function isRoomRowVisible(roomId, filterState) {
    const flags = getRoomFlags(roomId);

    if (filterState.searchType === 'raid') {
      if (!flags.raid || flags.dynamicEvent) return false;
    } else if (filterState.searchType === 'event') {
      if (!flags.dynamicEvent) return false;
    } else if (filterState.hideRaids && (flags.raid || flags.dynamicEvent)) {
      return false;
    }

    const { regionId } = getRoomRegion(roomId);
    if (filterState.regionId && regionId !== filterState.regionId) return false;
    return true;
  }

  function restoreSessionSearchInput(dialog) {
    const searchInput = getTeleporterSearchInput(dialog);
    if (!searchInput) return;

    const { searchValue, searchType } = sessionPreferences;
    const state = getFilterState(dialog);
    state.searchType = searchType;

    if (!searchValue) return;

    prepareTableForNativeSearch(dialog);

    if (searchType) {
      const keyword = searchValue.trim().toLowerCase();
      searchInput.setAttribute(SEARCH_SYNC_ATTR, keyword);
      const resetNative = needsNativeSearchReset(dialog);
      if (resetNative) {
        restoreNativeSearchResults(dialog).then(() => {
          setNativeInputValue(searchInput, searchValue);
          applyTeleporterFilters(dialog);
        });
        return;
      }
      setNativeInputValue(searchInput, searchValue);
      return;
    }

    searchInput.removeAttribute(SEARCH_SYNC_ATTR);
    setNativeInputValue(searchInput, searchValue);
    searchInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  function restoreSessionSort(table) {
    const dialog = table.closest('div[role="dialog"]');
    if (isTableSearchActive(dialog)) return;

    const { sortKey, sortDir } = sessionPreferences;
    const state = getTableSortState(table);

    if (!sortKey) {
      if (state.sortKey) {
        state.sortKey = null;
        state.sortDir = 'asc';
        applyTableSort(table);
      }
      return;
    }

    if (state.sortKey === sortKey && state.sortDir === sortDir) {
      if (state.sortKey) applyTableSort(table);
      return;
    }

    state.sortKey = sortKey;
    state.sortDir = sortDir;
    applyTableSort(table);
  }

  function clearTeleporterSearchInput(dialog, { force = false } = {}) {
    const searchInput = getTeleporterSearchInput(dialog);
    if (!searchInput) return Promise.resolve(false);

    searchInput.removeAttribute(SEARCH_SYNC_ATTR);
    prepareTableForNativeSearch(dialog);

    if (force || searchInput.value.trim() || needsNativeSearchReset(dialog)) {
      return restoreNativeSearchResults(dialog);
    }

    return Promise.resolve(true);
  }

  function resetTeleporterFilterSettings(dialog) {
    resetSessionPreferences();

    const state = getFilterState(dialog);
    state.regionId = '';
    state.hideRaids = false;
    state.searchType = null;

    const handlers = filterControlHandlers.get(dialog);
    if (handlers?.regionSelect) handlers.regionSelect.value = '';
    if (handlers?.hideRaidsBtn) styleHideRaidsButton(handlers.hideRaidsBtn, false);

    const table = dialog.querySelector('table');
    if (table) {
      const sortState = getTableSortState(table);
      sortState.sortKey = null;
      sortState.sortDir = 'asc';
      sessionPreferences.sortKey = null;
      sessionPreferences.sortDir = 'asc';
    }

    clearTeleporterSearchInput(dialog, { force: true }).then(() => {
      if (table) {
        restoreToNativeOrder(table, { canonical: true });
        updateSortArrows(table);
      }
      applyTeleporterFilters(dialog);
    });
  }

  function isRowShownInDom(tr) {
    if (!tr || tr.hidden) return false;
    if (tr.hasAttribute('hidden')) return false;
    if (tr.style.display === 'none') return false;
    return true;
  }

  function syncRegionHeaderVisibility(table, dialog) {
    const tbody = table?.querySelector('tbody');
    if (!tbody) return;

    const sortState = getTableSortState(table);
    if (sortState.sortKey) {
      runWithoutMutationObserver(() => {
        for (const tr of tbody.querySelectorAll(':scope > tr')) {
          if (!isRegionHeaderRow(tr)) continue;
          tr.style.display = 'none';
          tr.hidden = true;
        }
      });
      return;
    }

    const filterState = getFilterState(dialog);

    runWithoutMutationObserver(() => {
      for (const tr of tbody.querySelectorAll(':scope > tr')) {
        if (!isRegionHeaderRow(tr)) continue;

        const hasFollowingRooms = regionHeaderHasFollowingVisibleRooms(tr, filterState);

        if (hasFollowingRooms) {
          tr.style.removeProperty('display');
          tr.hidden = false;
          tr.removeAttribute('hidden');
        } else {
          tr.style.display = 'none';
          tr.hidden = true;
          tr.setAttribute('hidden', '');
        }
      }
    });
  }

  function scheduleRegionHeaderSync(dialog) {
    requestAnimationFrame(() => {
      const table = dialog.querySelector('table');
      if (!table) return;
      syncRegionHeaderVisibility(table, dialog);
      syncTeleporterRowHighlights(table, dialog);
      ensureKeyboardSelectionStillVisible(dialog);
    });
  }

  function applyTeleporterFilters(dialog) {
    syncFilterStateFromSearch(dialog);
    const table = dialog.querySelector('table');
    const tbody = table?.querySelector('tbody');
    if (!tbody) return;

    const filterState = getFilterState(dialog);
    const hasKeywordSearch = Boolean(filterState.searchType);
    const hasModFilters = Boolean(filterState.regionId || filterState.hideRaids);
    const sortState = getTableSortState(table);

    if (!hasKeywordSearch && !hasModFilters && !sortState.sortKey) {
      if (!isValidNativeLayout(tbody)) {
        runWithoutMutationObserver(() => {
          restoreToNativeOrder(table);
        });
      }
    }

    runWithoutMutationObserver(() => {
      for (const tr of tbody.querySelectorAll(':scope > tr')) {
        if (getRegionHeaderCell(tr)) continue;

        const roomId = extractRoomIdFromRow(tr);
        if (!roomId) continue;

        if (hasKeywordSearch || hasModFilters) {
          const visible = isRoomRowVisible(roomId, filterState);
          if (hasKeywordSearch) {
            setRowFilterVisibility(tr, visible);
          } else if (!visible) {
            tr.style.display = 'none';
          } else {
            showRoomRow(tr);
          }
        } else {
          showRoomRow(tr);
        }
      }
    });

    syncRegionHeaderVisibility(table, dialog);
    syncTeleporterRowHighlights(table, dialog);
    ensureKeyboardSelectionStillVisible(dialog);
  }

  function styleHideRaidsButton(button, active) {
    button.dataset.active = active ? 'true' : 'false';
    button.style.background = active ? '#3a3a4a' : '';
    button.style.color = active ? '#fff' : '';
    button.style.borderColor = active ? '#5a5a7a' : '';
  }

  function populateRegionSelect(select, selectedRegionId = '') {
    const current = selectedRegionId || select.value || '';
    select.replaceChildren();

    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = t('mods.betterTeleporter.allRegions');
    select.appendChild(optAll);

    for (const [id, label] of getRegionOptions()) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = label;
      select.appendChild(opt);
    }

    select.value = [...select.options].some((opt) => opt.value === current) ? current : '';
  }

  function ensureRegionSelectOptions(select, selectedRegionId = '') {
    const regions = getRegionOptions();
    if (regions.length === 0) return;

    const optionsKey = `${regions.length}|${regions.map(([id]) => id).join('\0')}`;
    if (select.dataset.regionOptionsKey === optionsKey) {
      const current = selectedRegionId || select.value || '';
      if ([...select.options].some((opt) => opt.value === current)) {
        select.value = current;
      }
      return;
    }

    populateRegionSelect(select, selectedRegionId);
    select.dataset.regionOptionsKey = optionsKey;
  }

  function getFilterInsertAnchor(searchInput) {
    if (!searchInput) return null;
    return searchInput.closest('.frame-pressed-1') || searchInput.parentElement;
  }

  function clearFilterGridChildStyles(parent, searchFrame, filters) {
    if (!parent) return;
    for (const child of parent.children) {
      if (child === searchFrame || child === filters) continue;
      child.style.removeProperty('grid-column');
      child.style.removeProperty('grid-row');
    }
    searchFrame?.style.removeProperty('grid-column');
    searchFrame?.style.removeProperty('grid-row');
    searchFrame?.style.removeProperty('flex');
    searchFrame?.style.removeProperty('minWidth');
    searchFrame?.style.removeProperty('width');
    filters?.style.removeProperty('grid-column');
    filters?.style.removeProperty('grid-row');
  }

  function restoreBrokenWidgetBottomFilterHost(widgetBottom, searchFrame, filters) {
    if (!widgetBottom) return;

    const restoreStyle = (prop, datasetKey) => {
      const prev = widgetBottom.dataset[datasetKey];
      if (prev) widgetBottom.style.setProperty(prop, prev);
      else widgetBottom.style.removeProperty(prop);
      delete widgetBottom.dataset[datasetKey];
    };

    clearFilterGridChildStyles(widgetBottom, searchFrame, filters);
    restoreStyle('display', 'betterTeleporterPrevDisplay');
    restoreStyle('grid-template-columns', 'betterTeleporterPrevGridTemplateColumns');
    restoreStyle('column-gap', 'betterTeleporterPrevColumnGap');
    restoreStyle('align-items', 'betterTeleporterPrevAlignItems');
    restoreStyle('gap', 'betterTeleporterPrevGap');
    restoreStyle('width', 'betterTeleporterPrevWidth');
    restoreStyle('min-width', 'betterTeleporterPrevMinWidth');
    widgetBottom.removeAttribute(FILTER_ROW_ATTR);
  }

  function mountTeleporterFilters(searchFrame, filters) {
    if (!searchFrame?.isConnected || !filters) return false;

    const parent = searchFrame.parentElement;
    if (!parent?.isConnected) return false;

    const widgetBottom = searchFrame.closest('.widget-bottom');
    if (widgetBottom?.getAttribute(FILTER_ROW_ATTR) === 'true') {
      restoreBrokenWidgetBottomFilterHost(widgetBottom, searchFrame, filters);
    }

    let toolbar = searchFrame.closest(`[${FILTER_ROW_ATTR}]`);
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.setAttribute(FILTER_ROW_ATTR, 'true');
      toolbar.style.cssText = 'display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; flex: 0 0 auto;';
      parent.insertBefore(toolbar, searchFrame);
      toolbar.appendChild(searchFrame);
    }

    searchFrame.style.flex = '1 1 0';
    searchFrame.style.minWidth = '0';
    searchFrame.style.width = 'auto';

    filters.style.cssText = 'display: flex; gap: 8px; align-items: center; flex: 0 0 auto; flex-wrap: nowrap; margin: 0; width: auto;';
    if (filters.parentElement !== toolbar) {
      toolbar.appendChild(filters);
    }

    return true;
  }

  function unmountTeleporterFilterRow(dialog, { preserveDom = false } = {}) {
    if (preserveDom) return;

    dialog.querySelector(`[${FILTERS_ATTR}]`)?.remove();

    const handlers = filterControlHandlers.get(dialog);
    const searchInput = getTeleporterSearchInput(dialog) || handlers?.searchInput;
    const searchFrame = getFilterInsertAnchor(searchInput);

    const widgetBottom = dialog.querySelector('.widget-bottom');
    if (widgetBottom?.getAttribute(FILTER_ROW_ATTR) === 'true') {
      restoreBrokenWidgetBottomFilterHost(widgetBottom, searchFrame, dialog.querySelector(`[${FILTERS_ATTR}]`));
    }

    const toolbar = dialog.querySelector(`[${FILTER_ROW_ATTR}]`);
    if (!toolbar?.parentElement) return;

    if (searchFrame?.isConnected && toolbar.contains(searchFrame)) {
      toolbar.parentElement.insertBefore(searchFrame, toolbar);
      searchFrame.style.removeProperty('flex');
      searchFrame.style.removeProperty('minWidth');
      searchFrame.style.removeProperty('width');
      searchFrame.style.removeProperty('grid-column');
      searchFrame.style.removeProperty('grid-row');
    }

    toolbar.remove();
  }

  function resetTeleporterFilterBinding(dialog, { preserveDom = false } = {}) {
    const handlers = filterControlHandlers.get(dialog);
    if (handlers) {
      handlers.regionSelect?.removeEventListener('change', handlers.onRegionChange);
      handlers.hideRaidsBtn?.removeEventListener('click', handlers.onHideRaidsClick);
      handlers.resetBtn?.removeEventListener('click', handlers.onResetClick);
      handlers.searchInput?.removeEventListener('input', handlers.onSearchInput, SEARCH_INPUT_CAPTURE);
      filterControlHandlers.delete(dialog);
    }
    dialog.removeAttribute(FILTERS_BOUND_ATTR);
    unmountTeleporterFilterRow(dialog, { preserveDom });
    (getTeleporterSearchInput(dialog) || handlers?.searchInput)?.removeAttribute(SEARCH_SYNC_ATTR);
  }

  function ensureTeleporterFilters(dialog) {
    const searchInput = getTeleporterSearchInput(dialog);
    if (!searchInput) return;

    const existingFilters = dialog.querySelector(`[${FILTERS_ATTR}]`);
    const handlers = filterControlHandlers.get(dialog);

    if (dialog.getAttribute(FILTERS_BOUND_ATTR) === 'true') {
      if (handlers?.searchInput && !handlers.searchInput.isConnected) {
        resetTeleporterFilterBinding(dialog);
      } else if (existingFilters && handlers?.searchInput === searchInput) {
        mountTeleporterFilters(getFilterInsertAnchor(searchInput), existingFilters);
        const regionSelect = existingFilters.querySelector(`[${REGION_SELECT_ATTR}]`);
        const hideRaidsBtn = existingFilters.querySelector(`[${HIDE_RAIDS_ATTR}]`);
        const state = getFilterState(dialog);
        if (regionSelect) ensureRegionSelectOptions(regionSelect, state.regionId);
        if (hideRaidsBtn) styleHideRaidsButton(hideRaidsBtn, state.hideRaids);
        return;
      } else {
        resetTeleporterFilterBinding(dialog);
      }
    }

    if (dialog.querySelector(`[${FILTERS_ATTR}]`)) return;

    const anchor = getFilterInsertAnchor(searchInput);
    if (!anchor?.isConnected) return;

    const filters = document.createElement('div');
    filters.setAttribute(FILTERS_ATTR, 'true');

    const regionSelect = document.createElement('select');
    regionSelect.setAttribute(REGION_SELECT_ATTR, 'true');
    regionSelect.className = TELEPORTER_GRAY_CONTROL_CLASS;
    regionSelect.style.minWidth = '120px';

    const hideRaidsBtn = document.createElement('button');
    hideRaidsBtn.type = 'button';
    hideRaidsBtn.setAttribute(HIDE_RAIDS_ATTR, 'true');
    hideRaidsBtn.textContent = t('mods.betterTeleporter.hideRaidsAndEvents');
    hideRaidsBtn.className = TELEPORTER_TOGGLE_BUTTON_CLASS;
    styleHideRaidsButton(hideRaidsBtn, sessionPreferences.hideRaids);

    filters.appendChild(regionSelect);
    filters.appendChild(hideRaidsBtn);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.setAttribute(RESET_FILTERS_ATTR, 'true');
    resetBtn.textContent = t('mods.betterTeleporter.reset');
    resetBtn.className = TELEPORTER_TOGGLE_BUTTON_CLASS;

    filters.appendChild(resetBtn);

    const onRegionChange = () => {
      getFilterState(dialog).regionId = regionSelect.value || '';
      applyTeleporterFilters(dialog);
    };
    const onHideRaidsClick = () => {
      const state = getFilterState(dialog);
      state.hideRaids = !state.hideRaids;
      styleHideRaidsButton(hideRaidsBtn, state.hideRaids);
      applyTeleporterFilters(dialog);
    };
    const onResetClick = () => resetTeleporterFilterSettings(dialog);
    const onSearchInput = (event) => handleSearchInput(event, dialog, searchInput);

    regionSelect.addEventListener('change', onRegionChange);
    hideRaidsBtn.addEventListener('click', onHideRaidsClick);
    resetBtn.addEventListener('click', onResetClick);
    searchInput.addEventListener('input', onSearchInput, SEARCH_INPUT_CAPTURE);
    filterControlHandlers.set(dialog, {
      onRegionChange,
      onHideRaidsClick,
      onResetClick,
      onSearchInput,
      regionSelect,
      hideRaidsBtn,
      resetBtn,
      searchInput,
    });

    runWithoutMutationObserver(() => {
      mountTeleporterFilters(anchor, filters);
      ensureRegionSelectOptions(regionSelect, sessionPreferences.regionId);
    });

    dialog.setAttribute(FILTERS_BOUND_ATTR, 'true');
    restoreSessionSearchInput(dialog);
    applyTeleporterFilters(dialog);
  }

  function teardownTeleporterFilters(dialog) {
    captureSessionPreferences(dialog);
    resetTeleporterFilterBinding(dialog, { preserveDom: true });
    dialogFilterState.delete(dialog);

    if (dialog.isConnected && dialog.getAttribute('data-state') !== 'closed') {
      const tbody = dialog.querySelector('tbody');
      if (tbody) unhideAllTableRows(tbody);
    }
  }

  // ============================================================================
  // 6. TABLE ENHANCEMENT
  // ============================================================================

  function clearRoomRowAccent(tr) {
    tr.removeAttribute(ROOM_TYPE_ATTR);
    for (const el of tr.querySelectorAll(ROOM_NAME_SELECTOR)) {
      el.style.removeProperty('color');
    }
    const xpCell = tr.querySelector(`td[${XP_STAM_ATTR}]`);
    if (xpCell) xpCell.style.removeProperty('color');
  }

  function applyRoomRowAccent(tr, roomId) {
    const { raid, dynamicEvent } = getRoomFlags(roomId);
    let type = null;
    let color = null;

    if (dynamicEvent) {
      type = 'event';
      color = EVENT_TEXT_COLOR;
    } else if (raid) {
      type = 'raid';
      color = RAID_TEXT_COLOR;
    }

    if (!type) {
      clearRoomRowAccent(tr);
      return;
    }

    tr.setAttribute(ROOM_TYPE_ATTR, type);
    for (const el of tr.querySelectorAll(ROOM_NAME_SELECTOR)) {
      el.style.color = color;
    }

    const xpCell = tr.querySelector(`td[${XP_STAM_ATTR}]`);
    if (xpCell) xpCell.style.color = color;
  }

  function extractRoomIdFromRow(tr) {
    const img = tr.querySelector('img[src*="/assets/room-thumbnails/"]');
    if (!img) return null;
    const match = String(img.getAttribute('src') || img.src || '').match(/\/assets\/room-thumbnails\/([^.?]+)\.png/);
    return match ? match[1] : null;
  }

  function getCurrentRoomId() {
    try {
      const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
      return boardContext?.selectedMap?.selectedRoom?.id
        || boardContext?.selectedMap?.roomId
        || null;
    } catch (_) {
      return null;
    }
  }

  function syncTeleporterRowHighlights(table, dialog = table?.closest?.('div[role="dialog"]') || null) {
    if (!table) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const currentRoomId = getCurrentRoomId();
    const keyboardRoomId = dialog?.getAttribute(KEYBOARD_NAV_BOUND_ATTR) === 'true'
      ? getKeyboardSelectedRoomId(dialog)
      : null;

    runWithoutMutationObserver(() => {
      for (const tr of tbody.querySelectorAll(':scope > tr')) {
        if (getRegionHeaderCell(tr)) continue;

        const roomId = extractRoomIdFromRow(tr);
        if (!roomId) continue;

        const highlight = keyboardRoomId
          ? roomId === keyboardRoomId
          : Boolean(currentRoomId && roomId === currentRoomId);
        tr.setAttribute('data-highlight', highlight ? 'true' : 'false');
      }
    });
  }

  function parsePortraitGameId(src) {
    const match = String(src || '').match(/\/assets\/portraits\/(\d+)(?:-shiny)?\.png/i);
    return match ? Number(match[1]) : null;
  }

  function parseEquipmentSpriteId(root) {
    if (!root) return null;

    const imgAlt = root.querySelector('img[alt]')?.getAttribute('alt');
    if (imgAlt && /^\d+$/.test(imgAlt)) return Number(imgAlt);

    const nodes = [root, ...root.querySelectorAll('[class*="id-"]')];
    for (const node of nodes) {
      for (const cls of node.classList || []) {
        const match = String(cls).match(/^id-(\d+)$/);
        if (match) return Number(match[1]);
      }
    }

    return null;
  }

  function resolveCreatureName(gameId) {
    if (!Number.isFinite(gameId)) return null;
    try {
      const monster = globalThis.state?.utils?.getMonster?.(gameId);
      if (monster?.metadata?.name) return monster.metadata.name;
    } catch (_) {}
    return window.creatureDatabase?.findMonsterByGameId?.(gameId)?.metadata?.name || null;
  }

  function resolveEquipmentMeta(gameId) {
    if (!Number.isFinite(gameId)) return null;
    try {
      const equip = globalThis.state?.utils?.getEquipment?.(gameId);
      if (equip?.metadata) {
        return {
          gameId,
          spriteId: Number(equip.metadata.spriteId ?? gameId),
          name: equip.metadata.name || `#${gameId}`,
        };
      }
    } catch (_) {}
    return { gameId, spriteId: gameId, name: `#${gameId}` };
  }

  function getRoomBoardMeta(roomId) {
    if (roomBoardMetaCache.has(roomId)) return roomBoardMetaCache.get(roomId);

    const meta = { creatures: [], equips: [] };
    try {
      const board = globalThis.state?.utils?.getBoardMonstersFromRoomId?.(roomId) || [];
      const creatureMap = new Map();
      const equipMap = new Map();

      for (const piece of board) {
        const gameId = Number(piece?.gameId);
        if (Number.isFinite(gameId)) {
          if (!creatureMap.has(gameId)) {
            creatureMap.set(gameId, {
              gameId,
              name: resolveCreatureName(gameId) || `#${gameId}`,
            });
          }
        }

        const equipGameId = Number(piece?.equip?.gameId);
        if (Number.isFinite(equipGameId)) {
          const stat = String(piece.equip.stat || '');
          const tier = Number(piece.equip.tier || 0);
          const key = `${equipGameId}|${stat}|${tier}`;
          if (!equipMap.has(key)) {
            const equipMeta = resolveEquipmentMeta(equipGameId);
            equipMap.set(key, {
              gameId: equipGameId,
              spriteId: equipMeta.spriteId,
              name: equipMeta.name,
              stat,
              tier,
            });
          }
        }
      }

      meta.creatures = [...creatureMap.values()];
      meta.equips = [...equipMap.values()];
    } catch (_) {}

    roomBoardMetaCache.set(roomId, meta);
    return meta;
  }

  function setTooltipTarget(el, title) {
    if (!el || !title) return;
    el.title = title;
    el.setAttribute(TOOLTIP_ATTR, 'true');
  }

  function enhanceRowPortraitTooltips(tr, roomId) {
    if (!roomId) return;

    const meta = getRoomBoardMeta(roomId);

    for (const img of tr.querySelectorAll('img[src*="/assets/portraits/"]')) {
      const target = img.closest('.container-slot') || img;
      if (target.getAttribute(TOOLTIP_ATTR) === 'true') continue;

      const gameId = parsePortraitGameId(img.getAttribute('src') || img.src);
      const creature = meta.creatures?.find((entry) => entry.gameId === gameId);
      const title = creature?.name || resolveCreatureName(gameId);
      setTooltipTarget(target, title);
      if (target !== img && title) img.title = title;
    }

    for (const portrait of tr.querySelectorAll('.equipment-portrait')) {
      if (portrait.getAttribute(TOOLTIP_ATTR) === 'true') continue;

      const spriteId = parseEquipmentSpriteId(portrait);
      const equip = meta.equips?.find((entry) => entry.spriteId === spriteId || entry.gameId === spriteId);
      let title = equip?.name || null;
      if (!title && Number.isFinite(spriteId)) {
        title = resolveEquipmentMeta(spriteId)?.name || null;
      }
      setTooltipTarget(portrait, title);
    }
  }

  function getRoomNameFromRow(tr) {
    const nameEl = tr.querySelector(ROOM_NAME_SELECTOR);
    const text = nameEl?.textContent?.trim();
    if (text) return text;
    const roomId = extractRoomIdFromRow(tr);
    return getRoomById(roomId)?.name || roomId || '';
  }

  function getTableSortState(table) {
    if (!tableSortState.has(table)) {
      tableSortState.set(table, {
        sortKey: null,
        sortDir: 'asc',
        snapshot: null,
        snapshotOrder: null,
        nativeOrder: null,
        tbody: null,
      });
    }
    return tableSortState.get(table);
  }

  function updateSortArrows(table) {
    const state = getTableSortState(table);
    for (const th of table.querySelectorAll('th[data-sort]')) {
      const arrow = th.querySelector(`[${SORT_ARROW_ATTR}]`);
      if (!arrow) continue;
      const next = state.sortKey && th.dataset.sort === state.sortKey
        ? (state.sortDir === 'desc' ? '↓' : '↑')
        : '';
      if (arrow.textContent === next) continue;
      arrow.textContent = next;
      if (next) arrow.style.color = '#fff';
      else arrow.style.removeProperty('color');
    }
  }

  function runWithoutMutationObserver(fn) {
    suppressMutations = true;
    try {
      fn();
    } finally {
      suppressMutations = false;
    }
  }

  function applyTableSort(table) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const dialog = table.closest('div[role="dialog"]');
    const state = getTableSortState(table);

    runWithoutMutationObserver(() => {
      if (!state.sortKey) {
        restoreToNativeOrder(table);
        updateSortArrows(table);
        return;
      }

      if (!state.nativeOrder) {
        ensureNativeOrder(table);
      }

      if (!state.snapshotOrder?.length) {
        if (!state.snapshot?.length) {
          state.snapshot = [...tbody.querySelectorAll(':scope > tr')];
        }
        state.snapshotOrder = state.snapshot.map(getRowSnapshotKey).filter(Boolean);
      }

      const headerFragment = document.createDocumentFragment();
      const roomRows = [];
      for (const tr of [...tbody.querySelectorAll(':scope > tr')]) {
        if (isRegionHeaderRow(tr)) {
          tr.style.display = 'none';
          tr.hidden = true;
          headerFragment.appendChild(tr);
          continue;
        }

        const roomId = extractRoomIdFromRow(tr);
        if (!roomId) continue;

        const room = getRoomById(roomId);
        roomRows.push({
          tr,
          name: room?.name || getRoomNameFromRow(tr) || roomId,
          expPerStamina: room?.expPerStamina ?? 0,
        });
      }

      const mul = state.sortDir === 'desc' ? -1 : 1;
      roomRows.sort((a, b) => {
        if (state.sortKey === 'name') {
          return a.name.localeCompare(b.name) * mul;
        }
        return (a.expPerStamina - b.expPerStamina) * mul;
      });

      if (headerFragment.childNodes.length) {
        tbody.insertBefore(headerFragment, tbody.firstChild);
      }

      const fragment = document.createDocumentFragment();
      for (const { tr } of roomRows) fragment.appendChild(tr);
      tbody.appendChild(fragment);
      updateSortArrows(table);
    });

    syncTeleporterRowHighlights(table, dialog);
    if (dialog) applyTeleporterFilters(dialog);
  }

  function restoreTableBeforeSort(table) {
    const state = getTableSortState(table);
    if (state.sortKey) {
      state.sortKey = null;
      state.sortDir = 'asc';
      syncSessionSortFromTable(table);
    }

    restoreToNativeOrder(table);
    const dialog = table.closest('div[role="dialog"]');
    if (dialog) syncRegionHeaderVisibility(table, dialog);
  }

  function clearSearchWithoutSortClear(dialog) {
    const searchInput = getTeleporterSearchInput(dialog);
    if (!searchInput) return;

    const state = getFilterState(dialog);
    searchInput.removeAttribute(SEARCH_SYNC_ATTR);
    state.searchType = null;
    if (!searchInput.value) return;

    if (needsNativeSearchReset(dialog)) {
      restoreNativeSearchResults(dialog);
      return;
    }

    dispatchNativeSearchInput(searchInput, '', 'deleteContentBackward');
  }

  function handleSortClick(table, sortKey) {
    const state = getTableSortState(table);
    const dialog = table.closest('div[role="dialog"]');
    const initialDir = sortKey === 'expPerStamina' ? 'desc' : 'asc';

    let nextSortKey = state.sortKey;
    let nextSortDir = state.sortDir;

    if (state.sortKey !== sortKey) {
      nextSortKey = sortKey;
      nextSortDir = initialDir;
    } else if (state.sortDir === initialDir) {
      nextSortKey = sortKey;
      nextSortDir = initialDir === 'asc' ? 'desc' : 'asc';
    } else {
      nextSortKey = null;
      nextSortDir = 'asc';
    }

    if (nextSortKey && isTableSearchActive(dialog)) {
      restoreTableBeforeSort(table);
      clearSearchWithoutSortClear(dialog);
    }

    state.sortKey = nextSortKey;
    state.sortDir = nextSortDir;
    syncSessionSortFromTable(table);
    applyTableSort(table);
  }

  function prepareSortableHeader(th, sortKey) {
    if (th.getAttribute(SORT_HEADER_ATTR) === 'true') {
      th.dataset.sort = sortKey;
      return;
    }

    const label = th.textContent.trim();
    th.textContent = '';
    th.append(document.createTextNode(`${label} `));

    const arrow = document.createElement('span');
    arrow.setAttribute(SORT_ARROW_ATTR, 'true');
    th.appendChild(arrow);

    th.dataset.sort = sortKey;
    th.setAttribute(SORT_HEADER_ATTR, 'true');
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
  }

  function setupSortableHeaders(table) {
    if (table.getAttribute(SORT_BOUND_ATTR) === 'true') return;

    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;

    const mapTh = headerRow.querySelector('th:not([' + XP_STAM_ATTR + '])');
    const xpTh = headerRow.querySelector(`th[${XP_STAM_ATTR}]`);
    if (mapTh) prepareSortableHeader(mapTh, 'name');
    if (xpTh) prepareSortableHeader(xpTh, 'expPerStamina');

    const onClick = (event) => {
      const th = event.target.closest('th[data-sort]');
      if (!th || !table.contains(th)) return;
      event.preventDefault();
      event.stopPropagation();
      handleSortClick(table, th.dataset.sort);
    };

    table.addEventListener('click', onClick);
    tableSortHandlers.set(table, onClick);
    table.setAttribute(SORT_BOUND_ATTR, 'true');
    updateSortArrows(table);
  }

  function teardownSortableHeaders(table) {
    const handler = tableSortHandlers.get(table);
    if (handler) {
      table.removeEventListener('click', handler);
      tableSortHandlers.delete(table);
    }
    table.removeAttribute(SORT_BOUND_ATTR);

    for (const th of table.querySelectorAll(`th[${SORT_HEADER_ATTR}]`)) {
      const label = th.textContent.replace(/[↑↓]\s*$/, '').trim();
      th.textContent = label;
      th.removeAttribute(SORT_HEADER_ATTR);
      th.removeAttribute('data-sort');
      th.style.removeProperty('cursor');
      th.style.removeProperty('user-select');
    }
  }

  function createXpStamCell(room) {
    const td = document.createElement('td');
    td.className = 'px-1 align-middle pixel-font-14 [&:not(:first-child)]:table-frame-left py-0 pl-1 pr-0 sm:pl-0';
    td.setAttribute(XP_STAM_ATTR, 'true');
    td.style.cssText = 'text-align: left; padding-left: 6px; color: #ccc; white-space: nowrap; line-height: 1.3; vertical-align: middle;';

    if (room?.expAvg > 0) {
      const xpFmt = room.expAvg.toLocaleString('pt-BR');
      const effFmt = Math.round(room.expPerStamina).toLocaleString('pt-BR');
      const xpLabel = t('mods.betterTeleporter.xpLabel');
      const stamSuffix = t('mods.betterTeleporter.stamSuffix');
      td.innerHTML = `
        <div>${xpFmt} <span style="color:#888;">${xpLabel}</span></div>
        <div>${effFmt} <span style="color:#888;">${stamSuffix}</span></div>
      `;
    } else {
      td.innerHTML = '<span style="color:#666;">—</span>';
    }

    return td;
  }

  function ensureXpStamHeader(table) {
    const headerRow = table.querySelector('thead tr');
    if (!headerRow || headerRow.querySelector(`th[${XP_STAM_ATTR}]`)) return;

    const sampleTh = headerRow.querySelector('th');
    const th = document.createElement('th');
    th.className = sampleTh?.className
      || 'bg-grayRegular px-1 font-normal first:table-frame-bottom [&:not(:first-child)]:table-frame-bottom-left sticky shadow-top-line top-0 z-1 text-left';
    th.setAttribute(XP_STAM_ATTR, 'true');
    th.style.textAlign = 'left';
    th.style.paddingLeft = '6px';
    th.style.whiteSpace = 'nowrap';
    th.textContent = t('mods.betterTeleporter.xpStam');
    prepareSortableHeader(th, 'expPerStamina');
    headerRow.appendChild(th);
  }

  function enhanceRegionHeaderRow(tr, table) {
    const regionCell = getRegionHeaderCell(tr);
    if (!regionCell) return;

    if (regionCell.getAttribute(REGION_ENHANCED_ATTR) !== 'true') {
      const currentColspan = Number(regionCell.getAttribute('colspan') || regionCell.colSpan || 2);
      if (currentColspan < 3) {
        regionCell.colSpan = currentColspan + 1;
      }
      regionCell.setAttribute(REGION_ENHANCED_ATTR, 'true');
    }

    if (tr.getAttribute(REGION_HEADER_ATTR) === 'true') return;
    tr.setAttribute(REGION_HEADER_ATTR, 'true');
    if (table) updateStickyRegionOffset(table);
  }

  function refreshTableSnapshot(table) {
    const tbody = table.querySelector('tbody');
    const state = getTableSortState(table);
    if (!tbody) return;

    if (state.tbody !== tbody) {
      state.sortKey = null;
      state.sortDir = 'asc';
      state.snapshot = null;
      state.snapshotOrder = null;
      state.nativeOrder = null;
      state.tbody = tbody;
      updateSortArrows(table);
    }

    if (!state.sortKey) {
      ensureNativeOrder(table);
    }
  }

  function rowNeedsEnhancement(tr) {
    const regionCell = getRegionHeaderCell(tr);
    if (regionCell) {
      return regionCell.getAttribute(REGION_ENHANCED_ATTR) !== 'true'
        || tr.getAttribute(REGION_HEADER_ATTR) !== 'true';
    }

    const roomId = extractRoomIdFromRow(tr);
    return Boolean(roomId && !tr.querySelector(`td[${XP_STAM_ATTR}]`));
  }

  function tableNeedsEnhancement(table) {
    if (!table.querySelector(`th[${XP_STAM_ATTR}]`)) return true;
    for (const tr of table.querySelectorAll('tbody tr')) {
      if (rowNeedsEnhancement(tr)) return true;
    }
    return false;
  }

  function enhanceTeleporterTable(dialog) {
    const table = dialog.querySelector('table');
    if (!table) return;

    const structureComplete = !tableNeedsEnhancement(table) && table.getAttribute(SORT_BOUND_ATTR) === 'true';

    if (!structureComplete) {
      ensureXpStamHeader(table);
      setupSortableHeaders(table);
      updateStickyRegionOffset(table);

      let addedRows = false;
      for (const tr of table.querySelectorAll('tbody tr')) {
        if (getRegionHeaderCell(tr)) {
          enhanceRegionHeaderRow(tr, table);
          continue;
        }

        const roomId = extractRoomIdFromRow(tr);
        if (!roomId) continue;
        if (tr.querySelector(`td[${XP_STAM_ATTR}]`)) continue;

        tr.appendChild(createXpStamCell(getRoomById(roomId)));
        applyRoomRowAccent(tr, roomId);
        addedRows = true;
      }

      refreshTableSnapshot(table);

      if (addedRows && getTableSortState(table).sortKey) {
        applyTableSort(table);
      }

      if (addedRows) {
        applyTeleporterFilters(dialog);
      }
    }

    for (const tr of table.querySelectorAll('tbody tr')) {
      if (getRegionHeaderCell(tr)) continue;
      const roomId = extractRoomIdFromRow(tr);
      if (roomId) {
        enhanceRowPortraitTooltips(tr, roomId);
        bindRowContextMenu(tr, roomId);
      }
    }

    syncTeleporterRowHighlights(table, dialog);
    restoreSessionSort(table);
    bindTeleporterKeyboardNav(dialog);
  }

  // ============================================================================
  // 6b. ROW CONTEXT MENU & CYCLOPEDIA
  // ============================================================================

  function dispatchEscapePress() {
    const init = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
    document.dispatchEvent(new KeyboardEvent('keydown', init));
    document.dispatchEvent(new KeyboardEvent('keyup', init));
  }

  function isCyclopediaModEnabled() {
    return typeof window.__cyclopediaOpen === 'function'
      || typeof window.Cyclopedia?.show === 'function'
      || !!document.querySelector('.cyclopedia-header-btn');
  }

  function isCyclopediaOpen() {
    return Boolean(document.querySelector('.cyclopedia-modal-root')?.closest('[role="dialog"][data-state="open"]'));
  }

  function openCyclopediaModal(options = {}) {
    if (typeof window.__cyclopediaOpen === 'function') {
      window.__cyclopediaOpen({ fromHeader: true, force: true, ...options });
      return;
    }
    window.Cyclopedia?.show?.({ force: true, ...options });
  }

  function runWhenCyclopediaReady(callback, attempts = 12) {
    if (typeof window.cyclopediaHomeSearchNavigate === 'function') {
      callback();
      return;
    }
    if (attempts <= 0) {
      callback();
      return;
    }
    setTimeout(() => runWhenCyclopediaReady(callback, attempts - 1), 50);
  }

  function closeTeleporterIfOpen(run) {
    if (findOpenTeleporterDialog()) {
      dispatchEscapePress();
      setTimeout(run, 50);
      return;
    }
    run();
  }

  function getRoomMapNavigationTarget(roomId) {
    const room = getRoomById(roomId);
    const region = getRoomRegion(roomId);
    return {
      mapName: room?.name || globalThis.state?.utils?.ROOM_NAME?.[roomId] || roomId || '',
      regionName: room?.regionName || resolveRegionName(region.regionId),
    };
  }

  function getBoardEntryNames(roomId, kind) {
    const list = getRoomBoardMeta(roomId)[kind === 'creature' ? 'creatures' : 'equips'] || [];
    const seen = new Set();
    const names = [];
    for (const entry of [...list].sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.name || seen.has(entry.name)) continue;
      seen.add(entry.name);
      names.push(entry.name);
    }
    return names;
  }

  function navigateCyclopediaFromRoom(roomId, mode, entryName = null) {
    debugContextMenu('navigate', { roomId, mode, entryName });
    closeTeleporterIfOpen(() => {
      if (mode === 'map') {
        const { mapName, regionName } = getRoomMapNavigationTarget(roomId);
        if (!mapName || !regionName) return;
        if (!isCyclopediaOpen()) {
          openCyclopediaModal({ map: mapName, region: regionName });
          return;
        }
        runWhenCyclopediaReady(() => {
          window.cyclopediaHomeSearchNavigate?.({ type: 'map', mapName, regionName });
        });
        return;
      }

      const name = entryName || getBoardEntryNames(roomId, mode)[0];
      if (!name) return;

      if (isCyclopediaOpen()) {
        window.cyclopediaHomeSearchNavigate?.({ type: mode, name });
        return;
      }
      openCyclopediaModal(mode === 'creature' ? { creature: name } : { equipment: name });
    });
  }

  function debugContextMenu(event, data = {}) {
    console.log(`[Better Teleporter] context menu ${event}`, data);
  }

  function stopContextMenuEvent(event) {
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function restoreContextMenuHost(host, hostPosition, hostOverflow) {
    if (!host?.isConnected) return;
    host.style.position = hostPosition;
    host.style.overflow = hostOverflow;
    host.removeAttribute(CONTEXT_MENU_HOST_ATTR);
  }

  function prepareContextMenuHost(host) {
    const hostPosition = host.style.position;
    const hostOverflow = host.style.overflow;
    if (getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }
    host.style.overflow = 'visible';
    host.setAttribute(CONTEXT_MENU_HOST_ATTR, 'true');
    return { hostPosition, hostOverflow };
  }

  function getContextMenuButtonClassName(kind) {
    const entryClass = CONTEXT_MENU_UI.ENTRY_CLASSES[kind] || 'frame-1 surface-regular text-whiteRegular';
    return `${CONTEXT_MENU_UI.ITEM_BASE_CLASS} ${entryClass}`;
  }

  function applyContextMenuEntryChrome(button) {
    Object.assign(button.style, {
      border: 'none',
      borderImage: '',
      background: '',
      backgroundImage: '',
      backgroundColor: '',
      color: '',
    });
  }

  function bindContextMenuHoverBrightness(button, { activeColor, idleColor } = {}) {
    button.addEventListener('mouseenter', () => {
      if (activeColor) button.style.color = activeColor;
      button.style.filter = 'brightness(1.12)';
    });
    button.addEventListener('mouseleave', () => {
      if (idleColor) button.style.color = idleColor;
      button.style.filter = '';
    });
  }

  function bindContextMenuActivation(button, onActivate) {
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      stopContextMenuEvent(event);
      onActivate();
    });
    button.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  }

  function createContextMenuSeparator() {
    const separator = document.createElement('div');
    separator.setAttribute('aria-hidden', 'true');
    separator.style.height = '1px';
    separator.style.background = '#555';
    separator.style.margin = '2px 0';
    separator.style.opacity = '0.75';
    separator.style.flexShrink = '0';
    return separator;
  }

  function createContextMenuActionButton(label, { kind, roomId = null, onClick = null } = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = getContextMenuButtonClassName(kind);
    button.textContent = label;
    applyContextMenuEntryChrome(button);
    Object.assign(button.style, CONTEXT_MENU_BUTTON_LAYOUT);
    bindContextMenuHoverBrightness(button);
    bindContextMenuActivation(button, () => {
      debugContextMenu('item selected', { label, roomId, kind });
      closeRowContextMenu();
      onClick?.();
    });
    return button;
  }

  function createContextMenuText(className, text, style = {}) {
    const el = document.createElement('div');
    el.className = className;
    el.textContent = text;
    Object.assign(el.style, style);
    return el;
  }

  function createContextMenuOverlay() {
    const overlay = document.createElement('div');
    overlay.id = CONTEXT_MENU_OVERLAY_ID;
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.zIndex = String(CONTEXT_MENU_UI.OVERLAY_Z);
    overlay.style.backgroundColor = 'transparent';
    overlay.style.pointerEvents = 'auto';
    overlay.style.cursor = 'default';
    setImportantStyles(overlay, [
      ['width', 'auto'],
      ['max-width', 'none'],
      ['height', 'auto'],
      ['max-height', 'none'],
      ['transform', 'none'],
    ]);
    return overlay;
  }

  function createContextMenuPanel() {
    const menu = document.createElement('div');
    menu.id = CONTEXT_MENU_ID;
    menu.style.zIndex = String(CONTEXT_MENU_UI.MENU_Z);
    menu.style.pointerEvents = 'auto';
    menu.style.boxSizing = 'border-box';
    setImportantStyles(menu, [
      ['width', `${CONTEXT_MENU_UI.MAX_WIDTH}px`],
      ['max-width', `${CONTEXT_MENU_UI.MAX_WIDTH}px`],
      ['min-width', '0'],
      ['height', 'auto'],
      ['max-height', 'none'],
      ['transform', 'none'],
    ]);
    menu.style.background = `url('${CONTEXT_MENU_PANEL_MEDIA.BACKGROUND}') repeat`;
    menu.style.border = '4px solid transparent';
    menu.style.borderImage = `url("${CONTEXT_MENU_PANEL_MEDIA.FRAME}") 6 fill stretch`;
    menu.style.borderRadius = '6px';
    menu.style.padding = '12px';
    menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
    return menu;
  }

  function createContextMenuActionsContainer() {
    const actionsContainer = document.createElement('div');
    actionsContainer.style.display = 'flex';
    actionsContainer.style.flexDirection = 'column';
    actionsContainer.style.gap = '8px';
    actionsContainer.style.marginBottom = '12px';
    actionsContainer.style.width = '100%';
    actionsContainer.style.maxWidth = '100%';
    actionsContainer.style.boxSizing = 'border-box';
    return actionsContainer;
  }

  function populateContextMenuActions(container, { roomId, mapEnabled, mapName, creatureNames, equipmentNames }) {
    let hasSection = false;
    const appendSeparatorIfNeeded = () => {
      if (!hasSection) return;
      container.appendChild(createContextMenuSeparator());
    };

    if (mapEnabled) {
      container.appendChild(createContextMenuActionButton(mapName, {
        kind: 'map',
        roomId,
        onClick: () => navigateCyclopediaFromRoom(roomId, 'map'),
      }));
      hasSection = true;
    }

    if (creatureNames.length) {
      appendSeparatorIfNeeded();
      for (const creatureName of creatureNames) {
        container.appendChild(createContextMenuActionButton(creatureName, {
          kind: 'creature',
          roomId,
          onClick: () => navigateCyclopediaFromRoom(roomId, 'creature', creatureName),
        }));
      }
      hasSection = true;
    }

    if (equipmentNames.length) {
      appendSeparatorIfNeeded();
      for (const equipmentName of equipmentNames) {
        container.appendChild(createContextMenuActionButton(equipmentName, {
          kind: 'equipment',
          roomId,
          onClick: () => navigateCyclopediaFromRoom(roomId, 'equipment', equipmentName),
        }));
      }
      hasSection = true;
    }

    if (!hasSection) {
      container.appendChild(createContextMenuText('pixel-font-14', '—', {
        color: '#888',
        fontSize: '11px',
        textAlign: 'center',
      }));
    }
  }

  function createContextMenuCancelButton(roomId, onCancel) {
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = CONTEXT_MENU_UI.CANCEL_CLASS;
    cancelButton.textContent = tf('mods.betterTeleporter.contextMenuCancel', 'Cancel');
    cancelButton.style.width = '70px';
    cancelButton.style.minHeight = '24px';
    cancelButton.style.textAlign = 'center';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.color = '#888';
    bindContextMenuHoverBrightness(cancelButton, { activeColor: '#ccc', idleColor: '#888' });
    bindContextMenuActivation(cancelButton, () => {
      debugContextMenu('dismiss cancel', { roomId });
      onCancel();
    });
    return cancelButton;
  }

  function detachContextMenuListeners(menuState) {
    if (!menuState) return;

    const {
      overlay,
      escHandler,
      overlayClickHandler,
      modalClickHandler,
      modalContent,
    } = menuState;

    overlay?.removeEventListener('mousedown', overlayClickHandler);
    overlay?.removeEventListener('click', overlayClickHandler);
    if (escHandler) document.removeEventListener('keydown', escHandler);
    if (modalClickHandler && modalContent) {
      modalContent.removeEventListener('mousedown', modalClickHandler);
      modalContent.removeEventListener('click', modalClickHandler);
    }
  }

  function closeRowContextMenu() {
    const menuState = openRowContextMenu;
    if (menuState?.closeMenu) {
      menuState.closeMenu();
      return;
    }

    detachContextMenuListeners(menuState);
    menuState?.overlay?.remove();
    menuState?.menu?.remove();
    if (menuState) {
      restoreContextMenuHost(menuState.host, menuState.hostPosition, menuState.hostOverflow);
      openRowContextMenu = null;
    }

    document.getElementById(CONTEXT_MENU_ID)?.remove();
    document.getElementById(CONTEXT_MENU_OVERLAY_ID)?.remove();
  }

  function positionContextMenuInHost(menu, host, x, y) {
    const hostRect = host.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.left = `${x - hostRect.left}px`;
    menu.style.top = `${y - hostRect.top}px`;

    const rect = menu.getBoundingClientRect();
    const pad = 10;
    let left = parseFloat(menu.style.left);
    let top = parseFloat(menu.style.top);

    if (rect.right > window.innerWidth - pad) {
      left -= rect.right - (window.innerWidth - pad);
    }
    if (rect.bottom > window.innerHeight - pad) {
      top -= rect.bottom - (window.innerHeight - pad);
    }
    if (rect.left < pad) {
      left += pad - rect.left;
    }
    if (rect.top < pad) {
      top += pad - rect.top;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function shieldContextMenuEvents(menu) {
    for (const eventName of CONTEXT_MENU_SHIELD_EVENTS) {
      menu.addEventListener(eventName, (event) => {
        event.stopPropagation();
      });
    }
  }

  function showRowContextMenu(x, y, roomId) {
    if (!isCyclopediaModEnabled()) {
      debugContextMenu('open failed', { roomId, reason: 'cyclopedia mod disabled' });
      return;
    }

    closeRowContextMenu();

    const host = findOpenTeleporterDialog();
    if (!host) {
      debugContextMenu('open failed', { roomId, reason: 'no teleporter dialog' });
      return;
    }

    const creatureNames = getBoardEntryNames(roomId, 'creature');
    const equipmentNames = getBoardEntryNames(roomId, 'equipment');
    const { mapName, regionName } = getRoomMapNavigationTarget(roomId);
    const mapEnabled = Boolean(mapName && regionName);

    debugContextMenu('open', {
      roomId,
      x,
      y,
      mapName,
      regionName,
      creatureNames,
      equipmentNames,
      mapEnabled,
      hostTag: host.tagName,
    });

    const { hostPosition, hostOverflow } = prepareContextMenuHost(host);
    const overlay = createContextMenuOverlay();
    const menu = createContextMenuPanel();

    menu.appendChild(createContextMenuText('pixel-font-16', mapName || roomId, {
      color: '#ffe066',
      fontWeight: 'bold',
      marginBottom: '4px',
      textAlign: 'center',
      wordBreak: 'break-word',
      lineHeight: '1.25',
    }));
    menu.appendChild(createContextMenuText('pixel-font-14', tf('mods.betterTeleporter.contextMenuSubtitle', 'Open in Cyclopedia:'), {
      color: '#cccccc',
      fontSize: '11px',
      marginBottom: '12px',
      textAlign: 'center',
    }));

    const actionsContainer = createContextMenuActionsContainer();
    populateContextMenuActions(actionsContainer, {
      roomId,
      mapEnabled,
      mapName,
      creatureNames,
      equipmentNames,
    });
    menu.appendChild(actionsContainer);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.gap = '8px';

    const menuState = {
      host,
      overlay,
      menu,
      hostPosition,
      hostOverflow,
      escHandler: null,
      overlayClickHandler: null,
      modalClickHandler: null,
      modalContent: host,
      closeMenu: null,
    };

    function closeMenu() {
      detachContextMenuListeners(menuState);
      overlay.remove();
      menu.remove();
      restoreContextMenuHost(host, hostPosition, hostOverflow);
      if (openRowContextMenu === menuState) {
        openRowContextMenu = null;
      }
    }

    menuState.closeMenu = closeMenu;
    menuState.overlayClickHandler = (event) => {
      if (event.target !== overlay) return;
      stopContextMenuEvent(event);
      debugContextMenu('dismiss overlay', { roomId });
      closeMenu();
    };
    menuState.escHandler = (event) => {
      if (event.key === 'Escape') {
        debugContextMenu('dismiss escape', { roomId });
        closeMenu();
      }
    };
    menuState.modalClickHandler = (event) => {
      if (menu.contains(event.target) || overlay.contains(event.target)) return;
      debugContextMenu('dismiss modal click', { roomId, target: event.target?.tagName });
      closeMenu();
    };

    buttonContainer.appendChild(createContextMenuCancelButton(roomId, closeMenu));
    menu.appendChild(buttonContainer);

    host.appendChild(overlay);
    host.appendChild(menu);
    positionContextMenuInHost(menu, host, x, y);
    shieldContextMenuEvents(menu);

    overlay.addEventListener('mousedown', menuState.overlayClickHandler);
    overlay.addEventListener('click', menuState.overlayClickHandler);
    document.addEventListener('keydown', menuState.escHandler);
    host.addEventListener('mousedown', menuState.modalClickHandler);
    host.addEventListener('click', menuState.modalClickHandler);

    openRowContextMenu = menuState;

    debugContextMenu('mounted', {
      roomId,
      mountedIn: 'teleporter-dialog',
      menuRect: {
        x: Math.round(menu.getBoundingClientRect().x),
        y: Math.round(menu.getBoundingClientRect().y),
        w: Math.round(menu.getBoundingClientRect().width),
        h: Math.round(menu.getBoundingClientRect().height),
      },
    });
  }

  function bindRowContextMenu(tr, roomId) {
    if (!roomId || tr.getAttribute(ROW_CONTEXT_BOUND_ATTR) === 'true') return;
    if (!isCyclopediaModEnabled()) return;

    const onContextMenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      debugContextMenu('row contextmenu', { roomId, x: event.clientX, y: event.clientY });
      showRowContextMenu(event.clientX, event.clientY, roomId);
    };

    tr.addEventListener('contextmenu', onContextMenu);
    rowContextHandlers.set(tr, onContextMenu);
    tr.setAttribute(ROW_CONTEXT_BOUND_ATTR, 'true');
  }

  function teardownRowContextMenu(tr) {
    const handler = rowContextHandlers.get(tr);
    if (handler) {
      tr.removeEventListener('contextmenu', handler);
      rowContextHandlers.delete(tr);
    }
    tr.removeAttribute(ROW_CONTEXT_BOUND_ATTR);
  }

  // ============================================================================
  // 7. MODAL PROCESSING
  // ============================================================================

  function revertTeleporterTitle(dialog) {
    const titleEl = getTeleporterTitleElement(dialog);
    if (!titleEl?.hasAttribute(ORIGINAL_TITLE_ATTR)) return;
    titleEl.textContent = titleEl.getAttribute(ORIGINAL_TITLE_ATTR);
    titleEl.removeAttribute(ORIGINAL_TITLE_ATTR);
    titleEl.removeAttribute(ENHANCED_ATTR);
    titleEl.style.removeProperty('color');
  }

  function enhanceTeleporterTitle(dialog) {
    const titleEl = getTeleporterTitleElement(dialog);
    if (!titleEl || titleEl.getAttribute(ENHANCED_ATTR) === 'true') return;

    const current = titleEl.textContent.trim();
    const activatedTitle = getActivatedTitle();
    if (current === activatedTitle) {
      titleEl.setAttribute(ENHANCED_ATTR, 'true');
      return;
    }

    if (!titleEl.hasAttribute(ORIGINAL_TITLE_ATTR)) {
      titleEl.setAttribute(ORIGINAL_TITLE_ATTR, current);
    }

    titleEl.textContent = activatedTitle;
    titleEl.style.color = ACTIVATED_TITLE_COLOR;
    titleEl.setAttribute(ENHANCED_ATTR, 'true');
  }

  function revertMisTaggedTeleporterDialogs() {
    for (const dialog of document.querySelectorAll(`div[role="dialog"][${TARGET_ATTR}], div[role="dialog"][${LAYOUT_ENHANCED_ATTR}]`)) {
      if (matchesTeleporterForLayout(dialog)) continue;
      teardownTeleporterDialogEnhancements(dialog);

      const titleEl = getTeleporterTitleElement(dialog);
      if (!titleEl?.hasAttribute(ORIGINAL_TITLE_ATTR)) continue;
      if (NATIVE_TELEPORTER_TITLES.has(titleEl.getAttribute(ORIGINAL_TITLE_ATTR))) continue;
      revertTeleporterTitle(dialog);
    }
  }

  function processTeleporterModals() {
    revertMisTaggedTeleporterDialogs();
    const dialogs = findTeleporterDialogs();
    if (dialogs.length === 0) {
      clearModalLayoutCleanup();
      return;
    }

    for (const dialog of dialogs) {
      if (isTeleporterProcessingComplete(dialog)) continue;

      markAndEnhanceTeleporterDialog(dialog);
      if (matchesTeleporterContent(dialog)) {
        enhanceTeleporterTable(dialog);
      }
    }
  }

  function onDocumentMutation(mutations) {
    if (suppressMutations) return;

    let shouldSchedule = false;

    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        if (mutation.target.matches('div[role="dialog"]') && mutation.attributeName === 'data-state') {
          handleTeleporterDialogStateChange(mutation.target);
          shouldSchedule = mutation.target.getAttribute('data-state') !== 'closed';
        }
        continue;
      }

      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;

        const hostDialog = node.closest?.('div[role="dialog"]');
        if (hostDialog?.hasAttribute(TARGET_ATTR)) {
          if (!isTeleporterProcessingComplete(hostDialog)) {
            shouldSchedule = true;
          }
          continue;
        }

        scanNodeForTeleporter(node);
        shouldSchedule = true;
      }
    }

    if (shouldSchedule) scheduleProcessTeleporterModals();
  }

  // ============================================================================
  // 8. INITIALIZATION & CLEANUP
  // ============================================================================

  function initialize() {
    if (observer) return;
    resetSessionPreferences();
    injectLayoutStyles();
    injectTableStyles();
    revertMisTaggedTeleporterDialogs();
    tryBuildIndex();
    observer = new MutationObserver(onDocumentMutation);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });
    processTeleporterModals();
    window.__betterTeleporterOpen = openNativeTeleporter;
    console.log('[Better Teleporter] initialized');
  }

  function cleanup() {
    if (buildRetryTimer) {
      clearTimeout(buildRetryTimer);
      buildRetryTimer = null;
    }

    closeRowContextMenu();
    detachTeleporterKeyboardNavListener();
    if (processModalsRaf != null) {
      cancelAnimationFrame(processModalsRaf);
      processModalsRaf = null;
    }
    clearModalLayoutCleanup();
    observer?.disconnect();
    observer = null;
    roomIndexById = null;
    roomBoardMetaCache.clear();

    for (const dialog of document.querySelectorAll(`div[role="dialog"][${TARGET_ATTR}], div[role="dialog"][${LAYOUT_ENHANCED_ATTR}]`)) {
      teardownTeleporterTableEnhancements(dialog);
      teardownTeleporterDialogEnhancements(dialog);
    }

    resetSessionPreferences();

    for (const dialog of document.querySelectorAll('div[role="dialog"]')) {
      if (!matchesTeleporterForLayout(dialog) && !dialog.hasAttribute(TARGET_ATTR)) continue;
      revertTeleporterTitle(dialog);
    }

    for (const td of document.querySelectorAll(`td[${XP_STAM_ATTR}]`)) td.remove();
    for (const th of document.querySelectorAll(`th[${XP_STAM_ATTR}]`)) th.remove();

    for (const regionCell of document.querySelectorAll(`td[${REGION_ENHANCED_ATTR}="true"]`)) {
      const currentColspan = Number(regionCell.getAttribute('colspan') || regionCell.colSpan || 3);
      if (currentColspan > 2) regionCell.colSpan = currentColspan - 1;
      regionCell.removeAttribute(REGION_ENHANCED_ATTR);
    }

    for (const tr of document.querySelectorAll(`tr[${REGION_HEADER_ATTR}]`)) {
      tr.removeAttribute(REGION_HEADER_ATTR);
    }

    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(TABLE_STYLE_ID)?.remove();

    delete window.__betterTeleporterOpen;
    console.log('[Better Teleporter] cleaned up');
  }

  initialize();

  exports = {
    cleanup,
  };
})();
