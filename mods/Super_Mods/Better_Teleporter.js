// Better Teleporter Mod for Bestiary Arena

(function () {
  if (window.__betterTeleporterLoaded) return;
  window.__betterTeleporterLoaded = true;

  // ============================================================================
  // 1. CONSTANTS
  // ============================================================================

  const NS = 'better-teleporter';
  const ENHANCED_ATTR = `data-${NS}-enhanced`;
  const TABLE_ENHANCED_ATTR = `data-${NS}-table-enhanced`;
  const ROW_ENHANCED_ATTR = `data-${NS}-row-enhanced`;
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
  const ROOM_TYPE_ATTR = `data-${NS}-room-type`;
  const TOOLTIP_ATTR = `data-${NS}-tooltip`;
  const FILTERS_ATTR = `data-${NS}-filters`;
  const REGION_SELECT_ATTR = `data-${NS}-region-select`;
  const HIDE_RAIDS_ATTR = `data-${NS}-hide-raids`;
  const FILTERS_BOUND_ATTR = `data-${NS}-filters-bound`;
  const FILTER_ROW_ATTR = `data-${NS}-filter-row`;
  const SEARCH_SYNC_ATTR = `data-${NS}-search-sync`;
  const SEARCH_RESET_ATTR = `data-${NS}-search-reset`;
  const SEARCH_INPUT_CAPTURE = true;
  const RAID_TEXT_COLOR = '#ff6b6b';
  const EVENT_TEXT_COLOR = 'rgb(50, 205, 50)';
  const ACTIVATED_TITLE_COLOR = 'rgb(50, 205, 50)';
  const ORIGINAL_TITLE_ATTR = `data-${NS}-original-title`;
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
  const roomBoardMetaCache = new Map();

  function t(key, params) {
    let text = window.BestiaryModAPI?.i18n?.t?.(key) ?? key;
    if (params && typeof text === 'string') {
      for (const [paramKey, value] of Object.entries(params)) {
        text = text.replaceAll(`{${paramKey}}`, String(value));
      }
    }
    return text;
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

  function injectLayoutStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const { width, height, viewportPadding } = MODAL_CONFIG;
    const pad = viewportPadding * 2;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      div[role="dialog"][${TARGET_ATTR}] {
        width: min(${width}px, calc(100vw - ${pad}px)) !important;
        max-width: min(${width}px, calc(100vw - ${pad}px)) !important;
        height: min(${height}px, calc(100vh - ${pad}px)) !important;
        max-height: min(${height}px, calc(100vh - ${pad}px)) !important;
        min-width: 0 !important;
        animation: none !important;
      }
      div[role="dialog"][${TARGET_ATTR}] > div {
        animation: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function injectTableStyles() {
    if (document.getElementById(TABLE_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = TABLE_STYLE_ID;
    style.textContent = `
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

  function isRegionHeaderRow(tr) {
    const regionCell = tr.querySelector('td[colspan]');
    if (!regionCell) return false;
    return regionCell.querySelector('img[src*="/assets/icons/map.png"]') != null;
  }

  function hasTeleporterTableStructure(dialog) {
    const table = dialog?.querySelector('table');
    if (!table) return false;

    const headerCells = table.querySelectorAll('thead tr th');
    if (headerCells.length < 2) return false;

    const tbody = table.querySelector('tbody');
    if (!tbody) return false;

    let hasRegionHeader = false;
    let hasRoomRow = false;
    for (const tr of tbody.querySelectorAll(':scope > tr')) {
      if (isRegionHeaderRow(tr)) hasRegionHeader = true;
      else if (extractRoomIdFromRow(tr)) hasRoomRow = true;
      if (hasRegionHeader && hasRoomRow) return true;
    }
    return false;
  }

  function findTeleporterSearchInput(dialog) {
    if (!dialog) return null;

    for (const input of dialog.querySelectorAll('.widget-bottom input[placeholder]')) {
      if (input.closest('[data-radix-scroll-area-viewport]')) continue;
      return input;
    }

    return dialog.querySelector('.widget-bottom input[placeholder]');
  }

  function matchesTeleporterContent(dialog) {
    if (!dialog || dialog.getAttribute('role') !== 'dialog') return false;
    if (dialog.hasAttribute(TARGET_ATTR) || dialog.getAttribute(LAYOUT_ENHANCED_ATTR) === 'true') {
      return true;
    }

    const titleEl = dialog.querySelector('h2.widget-top-text p, .widget-top.widget-top-text p');
    if (titleEl?.textContent?.trim() === getActivatedTitle()) return true;

    return hasTeleporterTableStructure(dialog) && Boolean(findTeleporterSearchInput(dialog));
  }

  function isTeleporterDialogOpen(dialog) {
    return matchesTeleporterContent(dialog) && dialog.getAttribute('data-state') === 'open';
  }

  function scanNodeForTeleporter(node) {
    if (!(node instanceof Element)) return;

    if (node.matches?.('div[role="dialog"]') && matchesTeleporterContent(node)) {
      node.setAttribute(TARGET_ATTR, '');
      applyTeleporterModalLayout(node);
      setupTeleporterModalLayout(node);
      enhanceTeleporterTitle(node);
      ensureTeleporterFilters(node);
      return;
    }

    for (const dialog of node.querySelectorAll?.('div[role="dialog"]') || []) {
      if (!matchesTeleporterContent(dialog)) continue;
      dialog.setAttribute(TARGET_ATTR, '');
      applyTeleporterModalLayout(dialog);
      setupTeleporterModalLayout(dialog);
      enhanceTeleporterTitle(dialog);
      ensureTeleporterFilters(dialog);
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

  function applyTeleporterModalLayout(dialog) {
    if (!dialog || !matchesTeleporterContent(dialog)) return;

    dialog.setAttribute(TARGET_ATTR, '');
    const { width, height } = getModalDimensions();

    dialog.style.width = `${width}px`;
    dialog.style.minWidth = '0';
    dialog.style.maxWidth = `${width}px`;
    dialog.style.height = `${height}px`;
    dialog.style.minHeight = '0';
    dialog.style.maxHeight = `${height}px`;
    dialog.style.boxSizing = 'border-box';
    dialog.style.animation = 'none';
    dialog.classList.remove('max-w-lg', 'max-w-[300px]');
    dialog.setAttribute(LAYOUT_ENHANCED_ATTR, 'true');

    const rootWrapper = dialog.querySelector(':scope > div');
    if (rootWrapper) {
      rootWrapper.style.animation = 'none';
      Object.assign(rootWrapper.style, {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        minHeight: '0',
      });
    }

    const contentContainer = dialog.querySelector('.widget-bottom');
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

    const scrollArea = contentContainer?.querySelector('[data-radix-scroll-area-viewport]')?.parentElement;
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
      if (!dialog.isConnected || !matchesTeleporterContent(dialog)) {
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
    requestAnimationFrame(apply);

    const onResize = () => apply();
    window.addEventListener('resize', onResize);
    modalLayoutCleanup = () => {
      window.removeEventListener('resize', onResize);
      activeDialog = null;
    };
  }

  function revertTeleporterModalLayout(dialog) {
    if (!dialog || dialog.getAttribute(LAYOUT_ENHANCED_ATTR) !== 'true') return;

    for (const prop of ['width', 'minWidth', 'maxWidth', 'height', 'minHeight', 'maxHeight', 'boxSizing', 'animation']) {
      dialog.style.removeProperty(prop);
    }
    dialog.removeAttribute(LAYOUT_ENHANCED_ATTR);
    dialog.removeAttribute(TARGET_ATTR);

    for (const el of [
      dialog.querySelector(':scope > div'),
      dialog.querySelector('.widget-bottom'),
      dialog.querySelector('[data-radix-scroll-area-viewport]')?.parentElement,
    ]) {
      if (!el) continue;
      el.style.removeProperty('animation');
      el.style.removeProperty('height');
      el.style.removeProperty('display');
      el.style.removeProperty('flex');
      el.style.removeProperty('flexDirection');
      el.style.removeProperty('minHeight');
      el.style.removeProperty('overflowY');
      el.style.removeProperty('overflowX');
      el.style.removeProperty('maxHeight');
    }
  }

  function findOpenTeleporterDialog(root = document) {
    const dialogs = root.querySelectorAll('div[role="dialog"]');
    for (const dialog of dialogs) {
      if (isTeleporterDialogOpen(dialog)) return dialog;
    }
    return null;
  }

  function findTeleporterDialogs(root = document) {
    return [...root.querySelectorAll('div[role="dialog"]')].filter(matchesTeleporterContent);
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
      dialogFilterState.set(dialog, { regionId: '', hideRaids: false, searchType: null });
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
      (tr) => !tr.querySelector('td[colspan]') && extractRoomIdFromRow(tr)
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
    return countRoomRowsInTable(dialog) < Math.max(8, Math.floor(expected * 0.75));
  }

  function restoreNativeSearchResults(searchInput) {
    searchInput.setAttribute(SEARCH_RESET_ATTR, 'true');
    setNativeInputValue(searchInput, '');
    searchInput.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'deleteContentBackward',
    }));
    searchInput.removeAttribute(SEARCH_RESET_ATTR);
  }

  function scheduleKeywordFilterApply(dialog, searchInput, displayValue, resetNative) {
    requestAnimationFrame(() => {
      if (resetNative) {
        setNativeInputValue(searchInput, displayValue);
      }
      applyTeleporterFilters(dialog);
    });
  }

  function handleSearchInput(event, dialog, searchInput) {
    if (searchInput.getAttribute(SEARCH_RESET_ATTR) === 'true') return;

    const keyword = String(searchInput.value || '').trim().toLowerCase();
    const searchType = parseSearchType(keyword);
    const state = getFilterState(dialog);
    const prevSearchType = state.searchType;
    const prevKeyword = searchInput.getAttribute(SEARCH_SYNC_ATTR) || '';

    if (!searchType) {
      searchInput.removeAttribute(SEARCH_SYNC_ATTR);
      state.searchType = null;
      if (prevSearchType !== null || state.regionId || state.hideRaids) {
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
    const resetNative = needsNativeSearchReset(dialog);
    if (resetNative) {
      restoreNativeSearchResults(searchInput);
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
    const td = tr.querySelector('td[colspan]');
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

  function applyTeleporterFilters(dialog) {
    syncFilterStateFromSearch(dialog);
    const table = dialog.querySelector('table');
    const tbody = table?.querySelector('tbody');
    if (!tbody) return;

    const filterState = getFilterState(dialog);
    const hasKeywordSearch = Boolean(filterState.searchType);
    const hasModFilters = Boolean(filterState.regionId || filterState.hideRaids);
    const isSorted = Boolean(getTableSortState(table).sortKey);

    if (!hasKeywordSearch && !hasModFilters) {
      runWithoutMutationObserver(() => {
        for (const tr of tbody.querySelectorAll(':scope > tr')) {
          tr.style.removeProperty('display');
          tr.hidden = false;
          tr.removeAttribute('hidden');
        }
      });
      return;
    }

    runWithoutMutationObserver(() => {
      let pendingRegionHeader = null;
      let visibleRoomsInRegion = 0;

      const finishRegionHeader = () => {
        if (!pendingRegionHeader) return;
        pendingRegionHeader.style.display = visibleRoomsInRegion > 0 ? '' : 'none';
        pendingRegionHeader = null;
        visibleRoomsInRegion = 0;
      };

      for (const tr of tbody.querySelectorAll(':scope > tr')) {
        if (tr.querySelector('td[colspan]')) {
          if (isSorted) {
            tr.style.display = 'none';
            continue;
          }

          finishRegionHeader();
          const regionId = getRegionIdByDisplayName(getRegionNameFromHeaderRow(tr));
          pendingRegionHeader = tr;

          if (filterState.regionId && regionId !== filterState.regionId) {
            tr.style.display = 'none';
            pendingRegionHeader = null;
          } else {
            tr.style.display = '';
          }
          continue;
        }

        const roomId = extractRoomIdFromRow(tr);
        if (!roomId) continue;

        const visible = isRoomRowVisible(roomId, filterState);
        if (hasKeywordSearch) {
          setRowFilterVisibility(tr, visible);
        } else if (!visible) {
          tr.style.display = 'none';
        } else {
          tr.style.removeProperty('display');
        }

        if (visible && pendingRegionHeader) visibleRoomsInRegion += 1;
      }

      finishRegionHeader();
    });
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

  function getTeleporterSearchInput(dialog) {
    return findTeleporterSearchInput(dialog);
  }

  function getFilterInsertAnchor(searchInput) {
    return searchInput.closest('.frame-pressed-1') || searchInput.parentElement;
  }

  function mountTeleporterFilters(searchFrame, filters) {
    if (!searchFrame?.isConnected || !filters) return false;

    let row = searchFrame.closest(`[${FILTER_ROW_ATTR}]`);
    if (!row) {
      const parent = searchFrame.parentElement;
      if (!parent) return false;

      row = document.createElement('div');
      row.setAttribute(FILTER_ROW_ATTR, 'true');
      row.style.cssText = 'display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0;';

      parent.insertBefore(row, searchFrame);
      row.appendChild(searchFrame);

      searchFrame.style.flex = '1 1 0';
      searchFrame.style.minWidth = '0';
      searchFrame.style.width = 'auto';
    }

    filters.style.cssText = 'display: flex; gap: 8px; align-items: center; flex: 0 0 auto; flex-wrap: nowrap; margin: 0; width: auto;';
    if (filters.parentElement !== row) {
      row.appendChild(filters);
    }

    return true;
  }

  function unmountTeleporterFilterRow(dialog) {
    const searchFrame = getFilterInsertAnchor(getTeleporterSearchInput(dialog));
    const row = searchFrame?.closest(`[${FILTER_ROW_ATTR}]`);
    if (!row?.parentElement || !searchFrame) return;

    row.parentElement.insertBefore(searchFrame, row);
    row.remove();

    searchFrame.style.removeProperty('flex');
    searchFrame.style.removeProperty('minWidth');
    searchFrame.style.removeProperty('width');
  }

  function resetTeleporterFilterBinding(dialog) {
    const handlers = filterControlHandlers.get(dialog);
    if (handlers) {
      handlers.regionSelect?.removeEventListener('change', handlers.onRegionChange);
      handlers.hideRaidsBtn?.removeEventListener('click', handlers.onHideRaidsClick);
      handlers.searchInput?.removeEventListener('input', handlers.onSearchInput, SEARCH_INPUT_CAPTURE);
      filterControlHandlers.delete(dialog);
    }
    dialog.removeAttribute(FILTERS_BOUND_ATTR);
    dialog.querySelector(`[${FILTERS_ATTR}]`)?.remove();
    unmountTeleporterFilterRow(dialog);
    getTeleporterSearchInput(dialog)?.removeAttribute(SEARCH_SYNC_ATTR);
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
    regionSelect.className = 'pixel-font-14 frame-1 surface-regular bg-grayRegular px-2 py-0.5 text-whiteRegular';
    regionSelect.style.minWidth = '140px';

    const hideRaidsBtn = document.createElement('button');
    hideRaidsBtn.type = 'button';
    hideRaidsBtn.setAttribute(HIDE_RAIDS_ATTR, 'true');
    hideRaidsBtn.textContent = t('mods.betterTeleporter.hideRaidsAndEvents');
    hideRaidsBtn.className = 'focus-style-visible frame-1 active:frame-pressed-1 surface-regular px-2 py-0.5 pb-[3px] pixel-font-14 text-whiteRegular';
    styleHideRaidsButton(hideRaidsBtn, false);

    filters.appendChild(regionSelect);
    filters.appendChild(hideRaidsBtn);

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
    const onSearchInput = (event) => handleSearchInput(event, dialog, searchInput);

    regionSelect.addEventListener('change', onRegionChange);
    hideRaidsBtn.addEventListener('click', onHideRaidsClick);
    searchInput.addEventListener('input', onSearchInput, SEARCH_INPUT_CAPTURE);
    filterControlHandlers.set(dialog, {
      onRegionChange,
      onHideRaidsClick,
      onSearchInput,
      regionSelect,
      hideRaidsBtn,
      searchInput,
    });

    runWithoutMutationObserver(() => {
      mountTeleporterFilters(anchor, filters);
      ensureRegionSelectOptions(regionSelect, '');
    });

    dialog.setAttribute(FILTERS_BOUND_ATTR, 'true');
    applyTeleporterFilters(dialog);
  }

  function teardownTeleporterFilters(dialog) {
    resetTeleporterFilterBinding(dialog);
    dialogFilterState.delete(dialog);

    for (const tr of dialog.querySelectorAll('tbody tr')) {
      tr.style.removeProperty('display');
    }
  }

  // ============================================================================
  // 6. TABLE ENHANCEMENT
  // ============================================================================

  function clearRoomRowAccent(tr) {
    tr.removeAttribute(ROOM_TYPE_ATTR);
    for (const el of tr.querySelectorAll('p.hidden.sm\\:line-clamp-2, p.sm\\:line-clamp-2')) {
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
    for (const el of tr.querySelectorAll('p.hidden.sm\\:line-clamp-2, p.sm\\:line-clamp-2')) {
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

  function formatEquipTitle(equip) {
    if (!equip?.name) return null;
    if (equip.stat) {
      return `${equip.name} (${String(equip.stat).toUpperCase()} T${equip.tier ?? 1})`;
    }
    return equip.name;
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
      let title = equip ? formatEquipTitle(equip) : null;
      if (!title && Number.isFinite(spriteId)) {
        title = resolveEquipmentMeta(spriteId)?.name || null;
      }
      setTooltipTarget(portrait, title);
    }
  }

  function getRoomNameFromRow(tr) {
    const nameEl = tr.querySelector('p.hidden.sm\\:line-clamp-2, p.sm\\:line-clamp-2');
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

  function rowsMatchSnapshot(tbody, snapshot) {
    if (!tbody || !snapshot?.length) return false;
    const current = tbody.querySelectorAll(':scope > tr');
    if (current.length !== snapshot.length) return false;
    return [...current].every((tr, index) => tr === snapshot[index]);
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

    const state = getTableSortState(table);

    runWithoutMutationObserver(() => {
      if (!state.sortKey) {
        if (state.snapshot?.length && !rowsMatchSnapshot(tbody, state.snapshot)) {
          for (const tr of state.snapshot) tbody.appendChild(tr);
        }
        updateSortArrows(table);
        return;
      }

      if (!state.snapshot) {
        state.snapshot = [...tbody.querySelectorAll(':scope > tr')];
      }

      const roomRows = [];
      for (const tr of [...tbody.querySelectorAll(':scope > tr')]) {
        if (tr.querySelector('td[colspan]')) {
          tr.remove();
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

      const fragment = document.createDocumentFragment();
      for (const { tr } of roomRows) fragment.appendChild(tr);
      tbody.appendChild(fragment);
      updateSortArrows(table);
    });
  }

  function handleSortClick(table, sortKey) {
    const state = getTableSortState(table);
    const initialDir = sortKey === 'expPerStamina' ? 'desc' : 'asc';

    if (state.sortKey !== sortKey) {
      state.sortKey = sortKey;
      state.sortDir = initialDir;
    } else if (state.sortDir === initialDir) {
      state.sortDir = initialDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = null;
      state.sortDir = 'asc';
    }

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
    table.setAttribute(TABLE_ENHANCED_ATTR, 'true');
  }

  function enhanceRegionHeaderRow(tr, table) {
    const regionCell = tr.querySelector('td[colspan]');
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
      state.tbody = tbody;
      updateSortArrows(table);
    }

    if (!state.sortKey) {
      state.snapshot = [...tbody.querySelectorAll(':scope > tr')];
    }
  }

  function rowNeedsEnhancement(tr) {
    const regionCell = tr.querySelector('td[colspan]');
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
        if (tr.querySelector('td[colspan]')) {
          enhanceRegionHeaderRow(tr, table);
          continue;
        }

        const roomId = extractRoomIdFromRow(tr);
        if (!roomId) continue;
        if (tr.querySelector(`td[${XP_STAM_ATTR}]`)) continue;

        tr.appendChild(createXpStamCell(getRoomById(roomId)));
        tr.setAttribute(ROW_ENHANCED_ATTR, 'true');
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
      if (tr.querySelector('td[colspan]')) continue;
      const roomId = extractRoomIdFromRow(tr);
      if (roomId) enhanceRowPortraitTooltips(tr, roomId);
    }
  }

  // ============================================================================
  // 7. MODAL PROCESSING
  // ============================================================================

  function enhanceTeleporterTitle(dialog) {
    const titleEl = dialog.querySelector('h2.widget-top-text p, .widget-top.widget-top-text p');
    if (!titleEl) return false;
    if (titleEl.getAttribute(ENHANCED_ATTR) === 'true') return true;

    const current = titleEl.textContent.trim();
    const activatedTitle = getActivatedTitle();
    if (current === activatedTitle) {
      titleEl.setAttribute(ENHANCED_ATTR, 'true');
      return true;
    }

    if (!titleEl.hasAttribute(ORIGINAL_TITLE_ATTR)) {
      titleEl.setAttribute(ORIGINAL_TITLE_ATTR, current);
    }

    titleEl.textContent = activatedTitle;
    titleEl.style.color = ACTIVATED_TITLE_COLOR;
    titleEl.setAttribute(ENHANCED_ATTR, 'true');
    return true;
  }

  function processTeleporterModals() {
    const dialogs = findTeleporterDialogs();
    if (dialogs.length === 0) {
      clearModalLayoutCleanup();
      return;
    }

    for (const dialog of dialogs) {
      dialog.setAttribute(TARGET_ATTR, '');
      applyTeleporterModalLayout(dialog);
      setupTeleporterModalLayout(dialog);
      enhanceTeleporterTitle(dialog);
      ensureTeleporterFilters(dialog);
      enhanceTeleporterTable(dialog);
    }
  }

  function onDocumentMutation(mutations) {
    if (suppressMutations) return;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        scanNodeForTeleporter(node);
      }
    }
    processTeleporterModals();
  }

  // ============================================================================
  // 8. INITIALIZATION & CLEANUP
  // ============================================================================

  function initialize() {
    if (observer) return;
    injectLayoutStyles();
    injectTableStyles();
    tryBuildIndex();
    observer = new MutationObserver(onDocumentMutation);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'colspan', 'placeholder'],
    });
    processTeleporterModals();
    console.log('[Better Teleporter] initialized');
  }

  function cleanup() {
    if (buildRetryTimer) {
      clearTimeout(buildRetryTimer);
      buildRetryTimer = null;
    }

    clearModalLayoutCleanup();
    observer?.disconnect();
    observer = null;
    roomIndexById = null;
    roomBoardMetaCache.clear();

    for (const dialog of document.querySelectorAll(`div[role="dialog"][${TARGET_ATTR}], div[role="dialog"][${LAYOUT_ENHANCED_ATTR}]`)) {
      teardownTeleporterFilters(dialog);
      revertTeleporterModalLayout(dialog);
    }

    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(TABLE_STYLE_ID)?.remove();

    for (const titleEl of document.querySelectorAll(`p[${ENHANCED_ATTR}="true"]`)) {
      const dialog = titleEl.closest('div[role="dialog"]');
      if (!dialog || !matchesTeleporterContent(dialog)) continue;
      titleEl.textContent = titleEl.getAttribute(ORIGINAL_TITLE_ATTR) || titleEl.textContent;
      titleEl.removeAttribute(ORIGINAL_TITLE_ATTR);
      titleEl.style.removeProperty('color');
      titleEl.removeAttribute(ENHANCED_ATTR);
    }

    for (const td of document.querySelectorAll(`td[${XP_STAM_ATTR}]`)) td.remove();
    for (const th of document.querySelectorAll(`th[${XP_STAM_ATTR}]`)) th.remove();

    for (const regionCell of document.querySelectorAll(`td[${REGION_ENHANCED_ATTR}="true"]`)) {
      const currentColspan = Number(regionCell.getAttribute('colspan') || regionCell.colSpan || 3);
      if (currentColspan > 2) regionCell.colSpan = currentColspan - 1;
      regionCell.removeAttribute(REGION_ENHANCED_ATTR);
    }

    for (const tr of document.querySelectorAll(`tr[${ROW_ENHANCED_ATTR}]`)) {
      clearRoomRowAccent(tr);
      tr.removeAttribute(ROW_ENHANCED_ATTR);
    }

    for (const tr of document.querySelectorAll(`tr[${REGION_HEADER_ATTR}]`)) {
      tr.removeAttribute(REGION_HEADER_ATTR);
    }

    for (const table of document.querySelectorAll(`table[${TABLE_ENHANCED_ATTR}], table[${SORT_BOUND_ATTR}]`)) {
      teardownSortableHeaders(table);
      table.removeAttribute(TABLE_ENHANCED_ATTR);
    }

    console.log('[Better Teleporter] cleaned up');
  }

  initialize();

  exports = {
    cleanup,
    refresh: processTeleporterModals,
  };
})();
