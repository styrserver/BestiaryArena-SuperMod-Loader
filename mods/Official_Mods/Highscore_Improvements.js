/**
 * Highscore Improvements — personal WR gaps vs world records for Bestiary Arena.
 *
 * Required globals: mapsDatabase, globalThis.state, context.api
 *
 * Lifecycle: module load registers toolbar button → showImprovementsModal() → exports.cleanup()
 *
 * SECTION INDEX (line numbers shift as code moves):
 *   1. Configuration & Constants
 *   2. Global State
 *   3. Modal Layout & Shell
 *   4. Data Fetching & Map Classification
 *   5. Sorting & Ordering
 *   6. Player Stat Normalization
 *   7. Record Formatting & Display HTML
 *   8. Summary & Improvement Data
 *   9. Map Search
 *  10. Styles & List UI
 *  11. Tab Content Builders
 *  12. Tab Shell
 *  13. Modal Orchestration
 *  14. Entry Point & Exports
 */
// =======================
// 1. Configuration
// =======================

const HIGHSCORES_MODAL_CONFIG = {
  width: 550,
  height: 636,
  viewportPadding: 16,
  minWidth: 280,
  minHeight: 320
};
const HIGHSCORES_MODAL_ID = 'highscores-modal';
const HIGHSCORE_BUTTON_ID = 'highscore-button';

// 10 minutes at 16 ticks/second — game timeout / no speedrun clear
const SPEEDRUN_TIMEOUT_TICKS = 9600;
const MAP_MAX_FLOOR_INDEX = 15;

// Display placeholders for maps with no personal record (never played / never cleared)
const UNPLAYED_YOUR_TICKS = SPEEDRUN_TIMEOUT_TICKS;
const UNPLAYED_YOUR_RANK = 0;
const UNPLAYED_YOUR_FLOOR = 0;

const MAX_INDICATOR_COLOR_AT_MAX = '#8f8';
const MAX_INDICATOR_COLOR_BELOW_MAX = '#f88';

const HIGHSCORE_LIST_ITEM_CLASS = 'highscores-item';
const HIGHSCORE_LIST_EMPTY_CLASS = 'highscores-empty';
const HIGHSCORE_LIST_NO_RESULTS_CLASS = 'highscores-no-results';
const HIGHSCORE_LIST_UNPLAYED_CLASS = 'highscores-item--unplayed';
const HIGHSCORES_STYLE_ID = 'highscores-styles';

const HIGHSCORE_SEARCH_TOOLTIP =
  'Map search:\n• Matches map name, region, and raid maps\n• Combine: rook AND raid, venore OR carlin\n• Operators: AND, OR (spaces required, case insensitive)';

const HIGHSCORE_RAID_ICON = '/assets/icons/raid.png';

const HIGHSCORE_TAB_ICON_SIZE = 12;
const HIGHSCORE_TAB_ICONS = {
  // Same icon paths as Cyclopedia.js profile stats / explored maps
  summary: { src: '/assets/icons/map.png', alt: 'Summary' },
  ticks: { src: '/assets/icons/speed.png', alt: 'Ticks' },
  rank: { src: '/assets/icons/star-tier.png', alt: 'Rank' },
  floor: { src: '/assets/UI/floor-15.png', alt: 'Floor' }
};

// =======================
// 2. Global State
// =======================

const t = (key) => api.i18n.t(key);

let ROOM_NAMES;
let activeHighscoresModal = null;
let highscoresModalLayoutCleanup = null;
let highscoresModalTabsCleanup = null;
let highscoresOpenContextMenu = null;
let highscoresCyclopediaNavigatePollId = null;

// =======================
// 3. Modal Layout & Shell
// =======================

function tagHighscoresModalElement(modalRef) {
  const dialog = getHighscoresDialog(modalRef);
  if (dialog) {
    dialog.id = HIGHSCORES_MODAL_ID;
  }
  return dialog;
}

function removeHighscoresModalElement(modalEl) {
  if (!modalEl?.parentNode) return;
  const prev = modalEl.previousElementSibling;
  if (prev instanceof HTMLElement && prev.style.zIndex === '9998') {
    prev.remove();
  }
  modalEl.remove();
}

function closeHighscoresModal() {
  if (activeHighscoresModal?.close) {
    activeHighscoresModal.close();
  } else {
    removeHighscoresModalElement(document.getElementById(HIGHSCORES_MODAL_ID));
  }
  clearHighscoresModalCleanup();
}

function getHighscoresModalDimensions() {
  const pad = HIGHSCORES_MODAL_CONFIG.viewportPadding * 2;
  return {
    width: Math.max(
      HIGHSCORES_MODAL_CONFIG.minWidth,
      Math.min(HIGHSCORES_MODAL_CONFIG.width, window.innerWidth - pad)
    ),
    height: Math.max(
      HIGHSCORES_MODAL_CONFIG.minHeight,
      Math.min(HIGHSCORES_MODAL_CONFIG.height, window.innerHeight - pad)
    )
  };
}

function getHighscoresDialog(modalRef) {
  if (modalRef?.element) return modalRef.element;
  if (modalRef instanceof HTMLElement) return modalRef;
  return document.querySelector('div[role="dialog"][data-state="open"]');
}

function clearHighscoresModalLayoutCleanup() {
  if (highscoresModalLayoutCleanup) {
    highscoresModalLayoutCleanup();
    highscoresModalLayoutCleanup = null;
  }
}

function clearHighscoresModalTabsCleanup() {
  if (highscoresModalTabsCleanup) {
    highscoresModalTabsCleanup();
    highscoresModalTabsCleanup = null;
  }
}

function clearHighscoresModalCleanup() {
  closeHighscoresMapContextMenu();
  if (highscoresCyclopediaNavigatePollId) {
    clearTimeout(highscoresCyclopediaNavigatePollId);
    highscoresCyclopediaNavigatePollId = null;
  }
  clearHighscoresModalTabsCleanup();
  clearHighscoresModalLayoutCleanup();
}

function attachHighscoresModalCloseCleanup(modalRef) {
  if (!modalRef) return;

  const runCleanup = () => clearHighscoresModalCleanup();

  if (typeof modalRef.onClose === 'function') {
    modalRef.onClose(runCleanup);
  }

  const originalClose = modalRef.close?.bind(modalRef);
  if (originalClose) {
    modalRef.close = () => {
      runCleanup();
      originalClose();
    };
  }
}

function applyHighscoresModalLayout(modalRef, contentRoot, dimensions) {
  const dialog = getHighscoresDialog(modalRef);
  if (!dialog) return;

  const { width, height } = dimensions;

  dialog.style.width = `${width}px`;
  dialog.style.minWidth = '0';
  dialog.style.maxWidth = `${width}px`;
  dialog.style.height = `${height}px`;
  dialog.style.minHeight = '0';
  dialog.style.maxHeight = `${height}px`;
  dialog.style.boxSizing = 'border-box';
  dialog.classList.remove('max-w-[300px]', 'w-full');

  const rootWrapper = dialog.querySelector(':scope > div');
  if (rootWrapper) {
    Object.assign(rootWrapper.style, {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      minHeight: '0'
    });
  }

  const widgetBottom = dialog.querySelector('.widget-bottom');
  if (widgetBottom) {
    Object.assign(widgetBottom.style, {
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 auto',
      minHeight: '0',
      overflowY: 'hidden',
      overflowX: 'hidden'
    });
  }

  if (contentRoot) {
    Object.assign(contentRoot.style, {
      flex: '1 1 auto',
      minHeight: '0',
      height: '100%',
      maxHeight: 'none',
      width: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });
  }
}

function setupHighscoresModalResponsiveLayout(modalRef, contentRoot) {
  clearHighscoresModalLayoutCleanup();
  activeHighscoresModal = modalRef;
  const apply = () => applyHighscoresModalLayout(
    modalRef,
    contentRoot,
    getHighscoresModalDimensions()
  );
  requestAnimationFrame(() => apply());
  const onResize = () => apply();
  window.addEventListener('resize', onResize);
  highscoresModalLayoutCleanup = () => {
    window.removeEventListener('resize', onResize);
    if (activeHighscoresModal === modalRef) {
      activeHighscoresModal = null;
    }
  };
}

// =======================
// 4. Data Fetching & Map Classification
// =======================

// Helper function to fetch data from TRPC API
async function fetchTRPC(method) {
  try {
    const inp = encodeURIComponent(JSON.stringify({ 0: { json: null, meta: { values: ["undefined"] } } }));
    const res = await fetch(`/pt/api/trpc/${method}?batch=1&input=${inp}`, {
      headers: { 
        'Accept': '*/*', 
        'Content-Type': 'application/json', 
        'X-Game-Version': '1' 
      }
    });
    
    if (!res.ok) {
      throw new Error(`${method} → ${res.status}`);
    }
    
    const json = await res.json();
    return json[0].result.data.json;
  } catch (error) {
    console.error('Error fetching from TRPC:', error);
    throw error;
  }
}

function isMapRaid(mapId) {
  const classify = globalThis.mapsDatabase?.isMapRaidComprehensive;
  return typeof classify === 'function' ? classify(mapId) : false;
}

function isDynamicEventMap(mapId) {
  try {
    const classify = globalThis.mapsDatabase?.isDynamicEventMap;
    return typeof classify === 'function' ? classify(mapId) : false;
  } catch (error) {
    console.warn('[Highscores] Failed to classify event map:', mapId, error);
    return false;
  }
}

// Event maps (dynamic raids) should not count in time/rank improvement stats.
function isCountedRoomForImprovements(roomCode) {
  return !isDynamicEventMap(roomCode);
}

function getImprovementRoomCodes(rooms, extraCodes = []) {
  const codes = new Set();
  for (const code of Object.keys(rooms || {})) {
    if (isCountedRoomForImprovements(code)) codes.add(code);
  }
  for (const code of extraCodes) {
    if (isCountedRoomForImprovements(code)) codes.add(code);
  }
  return [...codes];
}

function getRoomDataByCode(code) {
  const fromDb = globalThis.mapsDatabase?.getMapById?.(code);
  if (fromDb) return fromDb;
  const rooms = globalThis.state?.utils?.ROOMS;
  if (Array.isArray(rooms)) return rooms.find((room) => room?.id === code) || null;
  if (rooms && typeof rooms === 'object') return rooms[code] || null;
  return null;
}

function getMapMaxRankPoints(code) {
  const room = getRoomDataByCode(code);
  const maxTeamSize = Number(room?.maxTeamSize);
  if (!Number.isFinite(maxTeamSize) || maxTeamSize < 1) return null;
  return (2 * maxTeamSize) - 1;
}

// =======================
// 5. Sorting & Ordering
// =======================

function compareImprovementsByMapOrder(a, b) {
  const compare = globalThis.mapsDatabase?.compareMapsByGameOrder;
  if (typeof compare === 'function') {
    return compare(a.code, b.code);
  }
  return String(a.code).localeCompare(String(b.code));
}

function isMapUnlocked(code, rooms) {
  if (!rooms || code == null) return false;
  return Object.prototype.hasOwnProperty.call(rooms, code);
}

function compareImprovementsByUnlockStatus(a, b) {
  const aUnlocked = Boolean(a.isUnlocked);
  const bUnlocked = Boolean(b.isUnlocked);
  if (aUnlocked === bUnlocked) return 0;
  return aUnlocked ? -1 : 1;
}

function sortImprovementOpportunities(entries, withinGroupCompare) {
  return entries.slice().sort((a, b) => {
    const unlockOrder = compareImprovementsByUnlockStatus(a, b);
    if (unlockOrder !== 0) return unlockOrder;
    const ownOrder = compareOwnWrAtBottom(a, b);
    if (ownOrder !== 0) return ownOrder;
    if (typeof withinGroupCompare === 'function') {
      const groupOrder = withinGroupCompare(a, b);
      if (groupOrder !== 0) return groupOrder;
    }
    return compareImprovementsByMapOrder(a, b);
  });
}

function compareOwnWrAtBottom(a, b) {
  if (a.ownsWr !== b.ownsWr) return a.ownsWr ? 1 : -1;
  return 0;
}

// =======================
// 6. Player Stat Normalization
// =======================

function isOwnHighscoreRecord(record, you, yourName) {
  if (!record) return false;
  const recordName = (record.userName || '').trim().toLowerCase();
  return (record.userId !== undefined && record.userId !== null && record.userId === you) ||
    (recordName && yourName && recordName === yourName);
}

function normalizeYourFloorTicks(roomData) {
  if (Number.isFinite(Number(roomData.floorTicks))) return Number(roomData.floorTicks);
  if (Number.isFinite(Number(roomData.ticks))) return Number(roomData.ticks);
  return null;
}

function normalizeBestFloorTicks(floorRecord) {
  if (!floorRecord) return null;
  if (Number.isFinite(Number(floorRecord.floorTicks))) return Number(floorRecord.floorTicks);
  if (Number.isFinite(Number(floorRecord.ticks))) return Number(floorRecord.ticks);
  return null;
}

function readYourTicks(roomData) {
  const ticks = roomData?.ticks;
  if (ticks === null || ticks === undefined) return null;
  const n = Number(ticks);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Valid speedrun time only (excludes timeout placeholder). */
function normalizeYourTicks(roomData) {
  const n = readYourTicks(roomData);
  if (n === null || n >= SPEEDRUN_TIMEOUT_TICKS) return null;
  return n;
}

function normalizeYourRank(roomData) {
  const rank = roomData?.rank;
  if (rank === null || rank === undefined) return null;
  const n = Number(rank);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function normalizeYourRankTicks(roomData) {
  const rankTicks = roomData?.rankTicks;
  if (rankTicks === null || rankTicks === undefined) return null;
  const n = Number(rankTicks);
  return Number.isFinite(n) ? n : null;
}

function normalizeYourFloor(roomData) {
  const floor = roomData?.floor;
  if (floor === null || floor === undefined) return null;
  const n = Number(floor);
  return Number.isFinite(n) ? n : null;
}

function normalizeYourFloorTicksForSummary(roomData) {
  if (roomData?.floor === null || roomData?.floor === undefined) return null;
  if (Number.isFinite(Number(roomData.floorTicks))) return Number(roomData.floorTicks);
  return null;
}

/** Floor index 0 = 100% ascension; implied by any valid speedrun time on the map. */
function getEffectiveYourFloor(roomData) {
  const floor = normalizeYourFloor(roomData);
  if (floor !== null) return floor;
  if (normalizeYourTicks(roomData) !== null) return 0;
  return null;
}

function getEffectiveYourFloorTicks(roomData) {
  const fromFloorField = normalizeYourFloorTicksForSummary(roomData);
  if (fromFloorField !== null) return fromFloorField;
  if (normalizeYourFloor(roomData) !== null) return null;
  const speedrunTicks = normalizeYourTicks(roomData);
  return speedrunTicks !== null ? speedrunTicks : null;
}

function hasAnyPersonalMapData(roomData) {
  return readYourTicks(roomData) !== null
    || normalizeYourRank(roomData) !== null
    || normalizeYourFloor(roomData) !== null;
}

/** Your ticks for display/comparisons; 9600 when never played. */
function getDisplayYourTicks(roomData) {
  const n = readYourTicks(roomData);
  return n !== null ? n : UNPLAYED_YOUR_TICKS;
}

/** Your rank for display/comparisons; 0 when never played. */
function getDisplayYourRank(roomData) {
  const n = normalizeYourRank(roomData);
  return n !== null ? n : UNPLAYED_YOUR_RANK;
}

/** Your floor for display/comparisons; 0 when never played. */
function getDisplayYourFloor(roomData) {
  const n = getEffectiveYourFloor(roomData);
  return n !== null ? n : UNPLAYED_YOUR_FLOOR;
}

// =======================
// 7. Record Formatting & Display HTML
// =======================

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function floorIndexToAscensionPercent(floorIndex) {
  if (floorIndex === null || floorIndex === undefined || !Number.isFinite(Number(floorIndex))) {
    return null;
  }
  return 100 + Number(floorIndex) * 20;
}

function formatNoWrStatHtml(unit, youValue, youSubTicks) {
  const yours = formatRecordValue(unit, youValue, unit !== 'ticks' ? youSubTicks : null);
  return `<span style="color:#ccc">${yours}</span> <span style="color:#888">· No WR</span>`;
}

function formatOwnWrStatHtml(unit, youValue, youSubTicks) {
  return `<span style="color:#8f8;">${formatRecordValue(unit, youValue, unit !== 'ticks' ? youSubTicks : null)} (You)</span>`;
}

function buildWorldRecordOnlyHtml(unit, playerName, theirValue, theirTicks) {
  const showSubTicks = unit !== 'ticks' && theirTicks !== null && theirTicks !== undefined;
  const safeName = escapeHtml(playerName || 'Unknown');
  const profileUrl = `https://bestiaryarena.com/profile/${encodeURIComponent((playerName || '').trim())}`;
  const nameLink = `<a href="${profileUrl}" target="_blank" rel="noopener noreferrer" style="color: #ff8; text-decoration: underline; cursor: pointer;">${safeName}</a>`;
  return `<span style="color:#888">—</span> → ${formatRecordValue(unit, theirValue, showSubTicks ? theirTicks : null)} (${nameLink})`;
}

function formatSummaryStatHtml(unit, youValue, youSubTicks, bestRecord, you, yourName) {
  const missingYou = youValue === null || youValue === undefined;

  if (!bestRecord) {
    if (missingYou) {
      return '<span style="color:#888">—</span>';
    }
    return formatNoWrStatHtml(unit, youValue, youSubTicks);
  }

  const theirValue = unit === 'ticks'
    ? bestRecord.ticks
    : unit === 'rank'
      ? bestRecord.rank
      : bestRecord.floor;
  const theirTicks = unit === 'ticks'
    ? null
    : unit === 'rank'
      ? (Number.isFinite(Number(bestRecord.ticks)) ? Number(bestRecord.ticks) : null)
      : normalizeBestFloorTicks(bestRecord);

  if (missingYou) {
    if (isOwnHighscoreRecord(bestRecord, you, yourName)) {
      return `<span style="color:#8f8;">${formatRecordValue(unit, theirValue, unit !== 'ticks' ? theirTicks : null)} (You)</span>`;
    }
    return buildWorldRecordOnlyHtml(unit, bestRecord.userName, theirValue, theirTicks);
  }

  if (isOwnHighscoreRecord(bestRecord, you, yourName)) {
    return `<span style="color:#8f8;">${formatRecordValue(unit, youValue, unit !== 'ticks' ? youSubTicks : null)} (You)</span>`;
  }

  return buildRecordComparisonHtml(
    unit,
    youValue,
    unit !== 'ticks' ? youSubTicks : null,
    bestRecord.userName,
    theirValue,
    theirTicks
  );
}

function getMaxIndicatorColor(bestValue, maxValue) {
  if (maxValue === null || maxValue === undefined) return MAX_INDICATOR_COLOR_AT_MAX;
  return Number(bestValue) === Number(maxValue)
    ? MAX_INDICATOR_COLOR_AT_MAX
    : MAX_INDICATOR_COLOR_BELOW_MAX;
}

function formatMapMaxComparisonSuffix(unit, bestValue, maxValue) {
  if (maxValue === null || maxValue === undefined) return '';
  const color = getMaxIndicatorColor(bestValue, maxValue);
  if (Number(bestValue) === Number(maxValue)) {
    return ` <span style="color:${color};">(max)</span>`;
  }
  const maxLabel = unit === 'floor'
    ? `${floorIndexToAscensionPercent(maxValue)}%`
    : formatRecordValue(unit, maxValue, null);
  return ` <span style="color:${color};">(max ${maxLabel})</span>`;
}

function buildRecordComparisonWithMaxHtml(unit, youValue, youTicks, playerName, theirValue, theirTicks, maxValue) {
  return buildRecordComparisonHtml(unit, youValue, youTicks, playerName, theirValue, theirTicks) +
    formatMapMaxComparisonSuffix(unit, theirValue, maxValue);
}

function buildOwnWrWithMaxHtml(unit, youValue, youSubTicks, maxValue) {
  return formatOwnWrStatHtml(unit, youValue, youSubTicks) +
    formatMapMaxComparisonSuffix(unit, youValue, maxValue);
}

function formatRecordValue(unit, value, subTicks) {
  if (unit === 'ticks') {
    return `${value} ticks`;
  }
  const subPart = subTicks !== null && subTicks !== undefined ? ` (${subTicks} ticks)` : '';
  if (unit === 'rank') {
    return `${value} points${subPart}`;
  }
  if (unit === 'floor') {
    const pct = floorIndexToAscensionPercent(value);
    if (pct === null) return `—${subPart}`;
    return `${pct}%${subPart}`;
  }
  return `${value} ${unit}${subPart}`;
}

function buildRecordComparisonHtml(unit, youValue, youTicks, playerName, theirValue, theirTicks) {
  const missingYou = youValue === null || youValue === undefined;
  const showSubTicks = !missingYou && unit !== 'ticks' && youValue === theirValue;
  const safeName = escapeHtml(playerName || 'Unknown');
  const profileUrl = `https://bestiaryarena.com/profile/${encodeURIComponent((playerName || '').trim())}`;
  const nameLink = `<a href="${profileUrl}" target="_blank" rel="noopener noreferrer" style="color: #ff8; text-decoration: underline; cursor: pointer;">${safeName}</a>`;
  const youPart = missingYou
    ? '<span style="color:#888">—</span>'
    : formatRecordValue(unit, youValue, showSubTicks ? youTicks : null);
  return `${youPart} → ${formatRecordValue(unit, theirValue, showSubTicks ? theirTicks : null)} (${nameLink})`;
}

// =======================
// 8. Summary & Improvement Data
// =======================

function getSummaryMapCodesInOrder(rooms) {
  const codes = [];
  const seen = new Set();
  const index = globalThis.mapsDatabase?.buildMapOrderIndex?.();

  if (index instanceof Map && index.size > 0) {
    const sortedCodes = [...index.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([code]) => code);
    for (const code of sortedCodes) {
      if (!isCountedRoomForImprovements(code)) continue;
      codes.push(code);
      seen.add(code);
    }
  }

  const roomNames = ROOM_NAMES || globalThis.state?.utils?.ROOM_NAME || {};
  for (const code of Object.keys(roomNames)) {
    if (!seen.has(code) && isCountedRoomForImprovements(code)) {
      codes.push(code);
      seen.add(code);
    }
  }

  for (const code of Object.keys(rooms || {})) {
    if (!seen.has(code) && isCountedRoomForImprovements(code)) {
      codes.push(code);
    }
  }

  return codes;
}

function buildSummaryEntries(mapCodes, rooms, best, roomsHighscores, you, yourName) {
  const entries = mapCodes.map((code) => {
    const roomData = rooms?.[code] || {};
    const tickBest = best[code];
    const rankBest = roomsHighscores?.rank?.[code];
    const floorBest = roomsHighscores?.floor?.[code];

    const yourTicks = getDisplayYourTicks(roomData);
    const yourRank = getDisplayYourRank(roomData);
    const yourRankTicks = normalizeYourRankTicks(roomData);
    const yourFloor = getDisplayYourFloor(roomData);
    const yourFloorTicks = getEffectiveYourFloorTicks(roomData);
    const hasPersonalData = hasAnyPersonalMapData(roomData);

    const ownsTickWr = isOwnHighscoreRecord(tickBest, you, yourName);
    const ownsRankWr = isOwnHighscoreRecord(rankBest, you, yourName);
    const ownsFloorWr = isOwnHighscoreRecord(floorBest, you, yourName);

    const tickBehind = tickBest && !ownsTickWr && yourTicks > tickBest.ticks;
    const rankBehind = rankBest && !ownsRankWr && yourRank < rankBest.rank;
    const floorBehind = floorBest && !ownsFloorWr && yourFloor < floorBest.floor;
    const sameFloorBehind = floorBest && !ownsFloorWr &&
      yourFloor === floorBest.floor &&
      yourFloorTicks !== null &&
      normalizeBestFloorTicks(floorBest) !== null &&
      yourFloorTicks > normalizeBestFloorTicks(floorBest);

    return {
      code,
      name: ROOM_NAMES[code] || code,
      yourTicks,
      yourRank,
      yourRankTicks,
      yourFloor,
      yourFloorTicks,
      tickBest,
      rankBest,
      floorBest,
      ownsTickWr,
      ownsRankWr,
      ownsFloorWr,
      hasImprovement: tickBehind || rankBehind || floorBehind || sameFloorBehind,
      hasPersonalData,
      isUnlocked: isMapUnlocked(code, rooms)
    };
  });
  return sortImprovementOpportunities(entries);
}

function formatTickImprovementText(tickDelta, yourTicks) {
  if (tickDelta === null) return 'Ticks unavailable';
  if (tickDelta > 0) {
    const pct = yourTicks > 0 ? ((tickDelta / yourTicks) * 100).toFixed(1) : '0.0';
    return `+${tickDelta} ticks (${pct}%)`;
  }
  if (tickDelta < 0) {
    return `${Math.abs(tickDelta)} ticks ahead`;
  }
  return 'Tied ticks';
}

function buildImprovementSummaryStats(tickOpportunities, rankOpportunities, floorOpportunities) {
  const mapsWithRoom = new Set();

  const tickGain = tickOpportunities.reduce((sum, o) => {
    if (o.ownsWr || o.hasWr === false || o.diff <= 0) return sum;
    mapsWithRoom.add(o.code);
    return sum + o.diff;
  }, 0);

  const rankGain = rankOpportunities.reduce((sum, o) => {
    if (o.ownsWr || o.hasWr === false) return sum;
    const points = Math.max(0, Number(o.diff) || 0);
    if (points > 0) mapsWithRoom.add(o.code);
    return sum + points;
  }, 0);

  const floorGain = floorOpportunities.reduce((sum, o) => {
    if (o.ownsWr || o.hasWr === false) return sum;
    const floors = Math.max(0, Number(o.floorDiff) || 0);
    if (floors > 0) mapsWithRoom.add(o.code);
    return sum + floors;
  }, 0);

  return {
    mapsWithRoomToImprove: mapsWithRoom.size,
    tickImprovement: -tickGain,
    rankImprovement: rankGain,
    floorImprovement: floorGain
  };
}

function formatImprovementSummaryLine(stats) {
  const ticksText = stats.tickImprovement === 0 ? '0' : String(stats.tickImprovement);
  return `Improvements — Ticks: ${ticksText} · Rank: +${stats.rankImprovement} · Floor: +${stats.floorImprovement}`;
}

// =======================
// 9. Map Search
// =======================

function normalizeHighscoreSearchText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function parseHighscoreSearchQuery(query) {
  const raw = String(query ?? '').trim();
  const hasBoolean = /\s+(and|or)\s+/i.test(raw);
  if (hasBoolean) {
    return {
      qNorm: normalizeHighscoreSearchText(raw),
      booleanExpression: raw,
      isBooleanMode: true
    };
  }
  return {
    qNorm: normalizeHighscoreSearchText(raw),
    booleanExpression: '',
    isBooleanMode: false
  };
}

function highscoreMatchesSingleSearchCondition(haystack, condition) {
  if (!condition || !String(condition).trim()) return true;
  const q = normalizeHighscoreSearchText(condition);
  if (!q || q.length < 2) return false;
  return haystack.includes(q);
}

/** AND/OR parsing (Cyclopedia / Dice_Roller SearchMatcher-style). OR splits before AND. */
function highscoreParseSearchExpression(matchCondition, expression) {
  const expr = String(expression ?? '').trim();
  if (!expr) return true;

  const handleIncompleteOperator = (conditions, operator, isAnd) => {
    const hasEmpty = conditions.some((c) => c === '');
    const endsWith =
      expr.endsWith(` ${operator}`) ||
      expr.endsWith(` ${operator} `) ||
      expr.toLowerCase().endsWith(` ${operator}`);
    if (hasEmpty || endsWith) {
      const valid = conditions.filter((c) => c !== '');
      if (valid.length === 0) return true;
      const check = isAnd ? valid.every.bind(valid) : valid.some.bind(valid);
      return check((c) => !c.trim() || highscoreParseSearchExpression(matchCondition, c));
    }
    return null;
  };

  if (/\s+or\s+/i.test(expr)) {
    const parts = expr.split(/\s+or\s+/i).map((s) => s.trim());
    const incomplete = handleIncompleteOperator(parts, 'or', false);
    if (incomplete !== null) return incomplete;
    return parts.some((p) => highscoreParseSearchExpression(matchCondition, p));
  }
  if (/\s+and\s+/i.test(expr)) {
    const parts = expr.split(/\s+and\s+/i).map((s) => s.trim());
    const incomplete = handleIncompleteOperator(parts, 'and', true);
    if (incomplete !== null) return incomplete;
    return parts.every((p) => highscoreParseSearchExpression(matchCondition, p));
  }
  return matchCondition(expr);
}

function highscoreHaystackMatchesQuery(haystack, parsed) {
  if (parsed?.isBooleanMode && parsed.booleanExpression) {
    return highscoreParseSearchExpression(
      (cond) => highscoreMatchesSingleSearchCondition(haystack, cond),
      parsed.booleanExpression
    );
  }
  const q = parsed?.qNorm || '';
  return !q || haystack.includes(q);
}

function hasActiveHighscoreSearchQuery(parsed) {
  if (parsed?.isBooleanMode) return Boolean(parsed.booleanExpression?.trim());
  return Boolean(parsed?.qNorm);
}

function getMapRegionSearchLabel(code) {
  try {
    const regions = globalThis.state?.utils?.REGIONS;
    if (!Array.isArray(regions)) return '';
    for (const region of regions) {
      if (!Array.isArray(region?.rooms)) continue;
      if (region.rooms.some((room) => room?.id === code)) {
        return globalThis.mapsDatabase?.getRegionDisplayName?.(region.id) || region.name || region.id || '';
      }
    }
  } catch (_) { /* ignore */ }
  return '';
}

function getMapRegionId(code) {
  try {
    const regions = globalThis.state?.utils?.REGIONS;
    if (!Array.isArray(regions)) return '';
    for (const region of regions) {
      if (!Array.isArray(region?.rooms)) continue;
      if (region.rooms.some((room) => room?.id === code)) {
        return region.id || '';
      }
    }
  } catch (_) { /* ignore */ }
  return '';
}

function isCyclopediaModEnabled() {
  return typeof window.__cyclopediaOpen === 'function'
    || typeof window.Cyclopedia?.show === 'function'
    || !!document.querySelector('.cyclopedia-header-btn');
}

function getViewInCyclopediaLabel() {
  const localized = t('mods.highscore.viewInCyclopedia');
  return localized === 'mods.highscore.viewInCyclopedia' ? 'View in Cyclopedia' : localized;
}

function buildCyclopediaMapNavigateTarget(code, name) {
  return {
    type: 'map',
    regionId: getMapRegionId(code),
    regionName: getMapRegionSearchLabel(code),
    mapId: code,
    mapName: name || globalThis.state?.utils?.ROOM_NAME?.[code] || code
  };
}

function navigateToMapInCyclopedia(code, name) {
  if (!isCyclopediaModEnabled()) return false;

  const target = buildCyclopediaMapNavigateTarget(code, name);
  const tryNavigate = () => {
    if (typeof window.cyclopediaHomeSearchNavigate !== 'function') return false;
    window.cyclopediaHomeSearchNavigate(target);
    return true;
  };

  if (tryNavigate()) return true;

  if (highscoresCyclopediaNavigatePollId) {
    clearTimeout(highscoresCyclopediaNavigatePollId);
    highscoresCyclopediaNavigatePollId = null;
  }

  try {
    if (typeof window.__cyclopediaOpen === 'function') {
      window.__cyclopediaOpen({ fromHomeSearch: true, force: true });
    } else if (typeof window.Cyclopedia?.show === 'function') {
      window.Cyclopedia.show({ fromHomeSearch: true, force: true });
    } else {
      const cyclopediaButton = document.querySelector('.cyclopedia-header-btn');
      if (!cyclopediaButton) return false;
      cyclopediaButton.click();
    }
  } catch {
    return false;
  }

  const startedAt = Date.now();
  const poll = () => {
    highscoresCyclopediaNavigatePollId = null;
    if (tryNavigate()) return;
    if (Date.now() - startedAt > 5000) return;
    highscoresCyclopediaNavigatePollId = setTimeout(poll, 50);
  };
  highscoresCyclopediaNavigatePollId = setTimeout(poll, 50);
  return true;
}

function closeHighscoresMapContextMenu() {
  if (highscoresOpenContextMenu?.closeMenu) {
    highscoresOpenContextMenu.closeMenu();
  }
}

function createHighscoresMapContextMenu(x, y, code, name) {
  closeHighscoresMapContextMenu();

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000000;background:transparent;pointer-events:auto;cursor:default;';

  const menu = document.createElement('div');
  menu.style.cssText = `
    position: fixed;
    left: 0;
    top: 0;
    z-index: 10000001;
    min-width: 180px;
    background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
    border: 4px solid transparent;
    border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch;
    border-radius: 6px;
    padding: 10px 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  `;

  const viewBtn = document.createElement('button');
  viewBtn.className = 'pixel-font-14';
  viewBtn.textContent = getViewInCyclopediaLabel();
  viewBtn.style.cssText = 'display:block;width:100%;padding:8px 12px;text-align:center;background:#1a1a1a;color:#e5c07b;border:1px solid #555;border-radius:3px;cursor:pointer;font-size:13px;font-weight:bold;box-sizing:border-box;';
  viewBtn.addEventListener('mouseenter', () => {
    viewBtn.style.backgroundColor = '#2a2a2a';
    viewBtn.style.borderColor = '#e5c07b';
  });
  viewBtn.addEventListener('mouseleave', () => {
    viewBtn.style.backgroundColor = '#1a1a1a';
    viewBtn.style.borderColor = '#555';
  });

  const documentClickHandler = (e) => {
    if (!menu.contains(e.target)) closeMenu();
  };

  function closeMenu() {
    overlay.removeEventListener('mousedown', overlayClickHandler);
    overlay.removeEventListener('click', overlayClickHandler);
    document.removeEventListener('keydown', escHandler);
    document.removeEventListener('mousedown', documentClickHandler, true);
    menu.remove();
    overlay.remove();
    if (highscoresOpenContextMenu?.overlay === overlay || highscoresOpenContextMenu?.menu === menu) {
      highscoresOpenContextMenu = null;
    }
  }

  viewBtn.addEventListener('click', () => {
    closeMenu();
    closeHighscoresModal();
    navigateToMapInCyclopedia(code, name);
  });

  const overlayClickHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
  };
  const escHandler = (e) => {
    if (e.key === 'Escape') closeMenu();
  };

  menu.appendChild(viewBtn);
  document.body.appendChild(overlay);
  document.body.appendChild(menu);

  const padding = 8;
  const menuRect = menu.getBoundingClientRect();
  const left = Math.max(padding, Math.min(x, window.innerWidth - menuRect.width - padding));
  const top = Math.max(padding, Math.min(y, window.innerHeight - menuRect.height - padding));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  overlay.addEventListener('mousedown', overlayClickHandler);
  overlay.addEventListener('click', overlayClickHandler);
  document.addEventListener('keydown', escHandler);
  document.addEventListener('mousedown', documentClickHandler, true);
  menu.addEventListener('mousedown', (e) => e.stopPropagation());
  menu.addEventListener('click', (e) => e.stopPropagation());

  highscoresOpenContextMenu = { overlay, menu, closeMenu };
}

function attachMapCardContextMenu(itemEl, code, name) {
  if (!isCyclopediaModEnabled() || !itemEl || !code) return;

  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    createHighscoresMapContextMenu(e.clientX, e.clientY, code, name);
  };
  itemEl.addEventListener('contextmenu', handler);
  itemEl._highscoresContextMenuHandler = handler;
}

function getMapTypeSearchMeta(code) {
  return isMapRaid(code) ? 'raid raids' : '';
}

function buildMapNameSearchText(code, name) {
  return normalizeHighscoreSearchText(`${name} ${code} ${getMapRegionSearchLabel(code)} ${getMapTypeSearchMeta(code)}`);
}

function decorateImprovementMapName(itemEl, code) {
  if (!code || !isMapRaid(code)) return;
  const nameEl = itemEl.querySelector('.text-whiteExp');
  if (!nameEl) return;

  const icon = document.createElement('img');
  icon.src = HIGHSCORE_RAID_ICON;
  icon.alt = 'raid';
  icon.title = 'Raid map';
  icon.className = 'pixelated';
  icon.style.cssText = 'width:11px;height:11px;flex-shrink:0;';

  Object.assign(nameEl.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px'
  });
  nameEl.insertBefore(icon, nameEl.firstChild);
}

function tagImprovementListItem(itemEl, { code, name, hasPersonalData } = {}) {
  itemEl.classList.add(HIGHSCORE_LIST_ITEM_CLASS);
  if (hasPersonalData === false) {
    itemEl.classList.add(HIGHSCORE_LIST_UNPLAYED_CLASS);
  }
  itemEl.dataset.searchText = buildMapNameSearchText(code, name);
  decorateImprovementMapName(itemEl, code);
  attachMapCardContextMenu(itemEl, code, name);
  return itemEl;
}

function tagImprovementEmptyState(emptyEl) {
  emptyEl.classList.add(HIGHSCORE_LIST_EMPTY_CLASS);
  return emptyEl;
}

function createHighscoreSearchBar(placeholder) {
  const searchContainer = document.createElement('div');
  searchContainer.title = HIGHSCORE_SEARCH_TOOLTIP;
  searchContainer.style.cssText = 'display: flex; align-items: center; gap: 4px; padding: 4px 6px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 3px; margin: 0; width: 100%; margin-left: 0; margin-right: 0; box-sizing: border-box; min-width: 0;';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = placeholder;
  searchInput.title = HIGHSCORE_SEARCH_TOOLTIP;
  searchInput.autocomplete = 'off';
  searchInput.style.cssText = 'background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); padding: 3px 6px; border-radius: 2px; font-size: 12px; flex: 1 1 0%; min-width: 0; font-family: inherit; outline: none; box-sizing: border-box; width: 100%;';

  searchInput.addEventListener('focus', () => {
    searchInput.style.borderColor = 'rgba(255, 255, 255, 0.4)';
  });
  searchInput.addEventListener('blur', () => {
    searchInput.style.borderColor = 'rgba(255, 255, 255, 0.2)';
  });

  searchContainer.appendChild(searchInput);
  return { searchContainer, searchInput };
}

function getImprovementListGrid(panel) {
  return panel?.querySelector('.highscores-list');
}

function ensureImprovementNoResultsMessage(grid) {
  let noResultsEl = grid.querySelector(`.${HIGHSCORE_LIST_NO_RESULTS_CLASS}`);
  if (!noResultsEl) {
    noResultsEl = document.createElement('div');
    noResultsEl.className = `${HIGHSCORE_LIST_NO_RESULTS_CLASS} pixel-font-14`;
    noResultsEl.textContent = 'No maps match your search.';
    noResultsEl.style.cssText = 'display:none; text-align:center; color:#aaa; font-style:italic; padding:12px 8px;';
    grid.appendChild(noResultsEl);
  }
  return noResultsEl;
}

function filterImprovementTabPanel(panel, query) {
  const grid = getImprovementListGrid(panel);
  if (!grid) return;

  const parsed = parseHighscoreSearchQuery(query);
  const hasQuery = hasActiveHighscoreSearchQuery(parsed);
  const items = grid.querySelectorAll(`.${HIGHSCORE_LIST_ITEM_CLASS}`);
  const emptyState = grid.querySelector(`.${HIGHSCORE_LIST_EMPTY_CLASS}`);
  const noResultsEl = ensureImprovementNoResultsMessage(grid);
  let visibleCount = 0;

  items.forEach((item) => {
    const haystack = item.dataset.searchText || '';
    const matches = highscoreHaystackMatchesQuery(haystack, parsed);
    item.style.display = matches ? '' : 'none';
    if (matches) visibleCount += 1;
  });

  if (emptyState) {
    emptyState.style.display = hasQuery ? 'none' : '';
  }

  noResultsEl.style.display = hasQuery && visibleCount === 0 ? 'block' : 'none';
}

// =======================
// 10. Styles & List UI
// =======================

function ensureHighscoresStyles() {
  if (document.getElementById(HIGHSCORES_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HIGHSCORES_STYLE_ID;
  style.textContent = `
    .highscores-item--unplayed {
      opacity: 0.5;
      filter: grayscale(0.4);
    }
  `;
  document.head.appendChild(style);
}

function createImprovementsScrollContainer() {
  const scrollContainer = api.ui.components.createScrollContainer({
    height: '100%',
    padding: true,
    content: ''
  });
  Object.assign(scrollContainer.element.style, {
    flex: '1 1 0',
    minHeight: '0',
    height: 'auto'
  });
  scrollContainer.contentContainer.classList.add('highscores-list');
  return scrollContainer;
}

// =======================
// 11. Tab Content Builders
// =======================

function createSummaryContent(entries, you, yourName, improvementStats) {
  const scrollContainer = createImprovementsScrollContainer();

  if (entries.length > 0) {
    entries.forEach((entry) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'frame-1 surface-regular flex items-center gap-2 p-1';
      itemEl.innerHTML = `
        <div class="frame-pressed-1 shrink-0 cursor-pointer" style="width: 48px; height: 48px;">
          <img
            alt="${escapeHtml(entry.name)}"
            class="pixelated size-full object-cover"
            src="/assets/room-thumbnails/${entry.code}.png"
            onclick="globalThis.state.board.send({ type: 'selectRoomById', roomId: '${entry.code}' });" />
        </div>
        <div class="highscore-summary-card-body w-full" style="display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 8px; min-width: 0;">
          <div
            class="text-whiteExp cursor-pointer"
            style="grid-column: 1 / -1;"
            onclick="globalThis.state.board.send({ type: 'selectRoomById', roomId: '${entry.code}' });">
              ${escapeHtml(entry.name)}
            </div>
          <span class="pixel-font-14" style="color:#aaa;">Ticks</span>
          <span class="pixel-font-14" style="min-width: 0; word-break: break-word;">${formatSummaryStatHtml('ticks', entry.yourTicks, null, entry.tickBest, you, yourName)}</span>
          <span class="pixel-font-14" style="color:#aaa;">Rank</span>
          <span class="pixel-font-14" style="min-width: 0; word-break: break-word;">${formatSummaryStatHtml('rank', entry.yourRank, entry.yourRankTicks, entry.rankBest, you, yourName)}</span>
          <span class="pixel-font-14" style="color:#aaa;">Floor</span>
          <span class="pixel-font-14" style="min-width: 0; word-break: break-word;">${formatSummaryStatHtml('floor', entry.yourFloor, entry.yourFloorTicks, entry.floorBest, you, yourName)}</span>
        </div>
      `;
      tagImprovementListItem(itemEl, { code: entry.code, name: entry.name, hasPersonalData: entry.hasPersonalData });
      scrollContainer.addContent(itemEl);
    });
  } else {
    const emptyEl = document.createElement('div');
    emptyEl.style.cssText = 'text-align: center; color: #eee; padding: 20px;';
    emptyEl.textContent = 'No map records found.';
    scrollContainer.addContent(tagImprovementEmptyState(emptyEl));
  }

  const statsContainer = document.createElement('div');
  statsContainer.className = 'frame-pressed-1 surface-dark p-2 pixel-font-14';
  const tickWrCount = entries.filter((e) => e.ownsTickWr).length;
  const rankWrCount = entries.filter((e) => e.ownsRankWr).length;
  const floorWrCount = entries.filter((e) => e.ownsFloorWr).length;
  statsContainer.innerHTML = `
    <div>Maps with room to improve: ${improvementStats.mapsWithRoomToImprove}</div>
    <div>${formatImprovementSummaryLine(improvementStats)}</div>
    <div>Your WRs — Ticks: ${tickWrCount} · Rank: ${rankWrCount} · Floor: ${floorWrCount}</div>
  `;

  return {
    scrollContainer,
    statsContainer
  };
}

// Helper function to create an item sprite element
function createItemSprite(itemId) {
  // Create the sprite container
  const spriteContainer = document.createElement('div');
  spriteContainer.className = `sprite item relative id-${itemId}`;
  
  // Create the viewport
  const viewport = document.createElement('div');
  viewport.className = 'viewport';
  
  // Create the image
  const img = document.createElement('img');
  img.alt = itemId;
  img.setAttribute('data-cropped', 'false');
  img.className = 'spritesheet';
  img.style.cssText = '--cropX: 0; --cropY: 0';
  
  // Assemble the structure
  viewport.appendChild(img);
  spriteContainer.appendChild(viewport);
  
  return spriteContainer;
}

// Helper function to create HTML content for tick improvements
function createTickContent(opportunities, minTheo, hasTickWrData) {
  // Create scrollable container using the API
  const scrollContainer = createImprovementsScrollContainer();
  
  // Add opportunities list
  if (opportunities.length > 0) {
    opportunities.forEach(o => {
      const itemEl = document.createElement('div');
      itemEl.className = 'frame-1 surface-regular flex items-center gap-2 p-1';
      itemEl.innerHTML = `
        <div class="frame-pressed-1 shrink-0" style="width: 48px; height: 48px;">
          <img 
            alt="${o.name}" 
            class="pixelated size-full object-cover cursor-pointer" 
            src="/assets/room-thumbnails/${o.code}.png" 
            onclick="globalThis.state.board.send({ type: 'selectRoomById', roomId: '${o.code}' });" />
        </div>
        <div class="grid w-full gap-1">
          <div 
            class="text-whiteExp 
            cursor-pointer" 
            onclick="globalThis.state.board.send({ type: 'selectRoomById', roomId: '${o.code}' });">
              ${o.name}
            </div>
          <div class="pixel-font-14">${o.ownsWr
            ? formatOwnWrStatHtml('ticks', o.yours ?? o.best, null)
            : o.hasWr === false
              ? formatNoWrStatHtml('ticks', o.yours, null)
              : buildRecordComparisonHtml('ticks', o.yours, null, o.player, o.best, null)}</div>
          <div class="pixel-font-14" style="color: #8f8;">${o.ownsWr
            ? 'You hold the WR'
            : o.hasWr === false
              ? 'No WR yet'
              : `+${o.diff} ticks (${o.pct}%)`}</div>
        </div>
      `;
      tagImprovementListItem(itemEl, { code: o.code, name: o.name, hasPersonalData: o.hasPersonalData });
      scrollContainer.addContent(itemEl);
    });
  } else {
    const emptyEl = document.createElement('div');
    emptyEl.style.cssText = 'text-align: center; color: #eee; padding: 20px;';
    emptyEl.textContent = hasTickWrData
      ? 'You are already at the top in all rooms!'
      : 'No tick highscores available yet.';
    scrollContainer.addContent(tagImprovementEmptyState(emptyEl));
  }
  
  // Add stats footer
  const statsContainer = document.createElement('div');
  statsContainer.className = 'frame-pressed-1 surface-dark p-2 pixel-font-14';
  const totalTicksImprovement = opportunities.reduce((sum, o) => sum + (o.ownsWr || o.hasWr === false ? 0 : o.diff), 0);
  const tickImprovementRooms = opportunities.filter((o) => !o.ownsWr && o.hasWr !== false).length;
  statsContainer.innerHTML = `
    <div>Rooms with ticks improvement: ${tickImprovementRooms}</div>
    <div>Total ticks improvement: ${totalTicksImprovement}</div>
    <div>Theoretical minimum: ${minTheo}</div>
  `;
  
  return {
    scrollContainer,
    statsContainer
  };
}

// Helper function to create HTML content for rank improvements
function createRankContent(opportunities, hasRankWrData) {
  // Create scrollable container using the API
  const scrollContainer = createImprovementsScrollContainer();
  
  // Add opportunities list
  if (opportunities.length > 0) {
    opportunities.forEach(o => {
      const itemEl = document.createElement('div');
      itemEl.className = 'frame-1 surface-regular flex items-center gap-2 p-1';
      itemEl.innerHTML = `
        <div class="frame-pressed-1 shrink-0 cursor-pointer" style="width: 48px; height: 48px;">
          <img 
            alt="${o.name}" 
            class="pixelated size-full object-cover" 
            src="/assets/room-thumbnails/${o.code}.png" 
            onclick="globalThis.state.board.send({ type: 'selectRoomById', roomId: '${o.code}' });" />
        </div>
        <div class="grid w-full gap-1">
          <div 
            class="text-whiteExp cursor-pointer"
            onclick="globalThis.state.board.send({ type: 'selectRoomById', roomId: '${o.code}' });" >
              ${o.name}
            </div>
          <div class="pixel-font-14">${o.ownsWr
            ? buildOwnWrWithMaxHtml('rank', o.yourScore ?? o.bestScore, o.yourRankTicks ?? o.bestRankTicks, getMapMaxRankPoints(o.code))
            : o.hasWr === false
              ? formatNoWrStatHtml('rank', o.yourScore, o.yourRankTicks)
              : buildRecordComparisonWithMaxHtml('rank', o.yourScore, o.yourRankTicks, o.player, o.bestScore, o.bestRankTicks, getMapMaxRankPoints(o.code))}</div>
          <div class="pixel-font-14" style="color: #8f8;">${o.improvementText}</div>
        </div>
      `;
      tagImprovementListItem(itemEl, { code: o.code, name: o.name, hasPersonalData: o.hasPersonalData });
      scrollContainer.addContent(itemEl);
    });
  } else {
    const emptyEl = document.createElement('div');
    emptyEl.style.cssText = 'text-align: center; color: #eee; padding: 20px;';
    emptyEl.textContent = hasRankWrData
      ? 'You already have the maximum rank score in all rooms!'
      : 'No rank highscores available yet.';
    scrollContainer.addContent(tagImprovementEmptyState(emptyEl));
  }
  
  // Add stats footer
  const statsContainer = document.createElement('div');
  statsContainer.className = 'frame-pressed-1 surface-dark p-2 pixel-font-14';
  const rankPointGain = opportunities.reduce((sum, o) => sum + (o.ownsWr || o.hasWr === false ? 0 : Math.max(0, Number(o.diff) || 0)), 0);
  const tickGain = opportunities.reduce((sum, o) => sum + (o.ownsWr || o.hasWr === false ? 0 : Math.max(0, Number(o.tickDiff) || 0)), 0);
  const rankImprovementRooms = opportunities.filter((o) => !o.ownsWr && o.hasWr !== false).length;
  statsContainer.innerHTML = `
    <div>Rooms with rank improvement: ${rankImprovementRooms}</div>
    <div>Total rank points to gain: ${rankPointGain}</div>
    <div>Same-rank tick gain: ${tickGain} ticks</div>
  `;
  
  return {
    scrollContainer,
    statsContainer
  };
}

// Helper function to create HTML content for floor improvements
function createFloorContent(opportunities, hasFloorWrData) {
  const scrollContainer = createImprovementsScrollContainer();
  
  if (opportunities.length > 0) {
    opportunities.forEach(o => {
      const itemEl = document.createElement('div');
      itemEl.className = 'frame-1 surface-regular flex items-center gap-2 p-1';
      itemEl.innerHTML = `
        <div class="frame-pressed-1 shrink-0 cursor-pointer" style="width: 48px; height: 48px;">
          <img 
            alt="${o.name}" 
            class="pixelated size-full object-cover" 
            src="/assets/room-thumbnails/${o.code}.png" 
            onclick="globalThis.state.board.send({ type: 'selectRoomById', roomId: '${o.code}' });" />
        </div>
        <div class="grid w-full gap-1">
          <div 
            class="text-whiteExp cursor-pointer"
            onclick="globalThis.state.board.send({ type: 'selectRoomById', roomId: '${o.code}' });" >
              ${o.name}
            </div>
          <div class="pixel-font-14">${o.ownsWr
            ? buildOwnWrWithMaxHtml('floor', o.yourFloor ?? o.bestFloor, o.yourFloorTicks ?? o.bestFloorTicks, MAP_MAX_FLOOR_INDEX)
            : o.hasWr === false
              ? formatNoWrStatHtml('floor', o.yourFloor, o.yourFloorTicks)
              : buildRecordComparisonWithMaxHtml('floor', o.yourFloor, o.yourFloorTicks, o.player, o.bestFloor, o.bestFloorTicks, MAP_MAX_FLOOR_INDEX)}</div>
          <div class="pixel-font-14" style="color: #8f8;">${o.improvementText}</div>
        </div>
      `;
      tagImprovementListItem(itemEl, { code: o.code, name: o.name, hasPersonalData: o.hasPersonalData });
      scrollContainer.addContent(itemEl);
    });
  } else {
    const emptyEl = document.createElement('div');
    emptyEl.style.cssText = 'text-align: center; color: #eee; padding: 20px;';
    emptyEl.textContent = hasFloorWrData
      ? 'You already have the best floor clear in all rooms!'
      : 'No floor highscores available yet.';
    scrollContainer.addContent(tagImprovementEmptyState(emptyEl));
  }
  
  const statsContainer = document.createElement('div');
  statsContainer.className = 'frame-pressed-1 surface-dark p-2 pixel-font-14';
  const floorGain = opportunities.reduce((sum, o) => sum + (o.ownsWr || o.hasWr === false ? 0 : o.floorDiff), 0);
  const tickGain = opportunities.reduce((sum, o) => sum + (o.ownsWr || o.hasWr === false ? 0 : Math.max(0, Number(o.tickDiff) || 0)), 0);
  const floorImprovementRooms = opportunities.filter((o) => !o.ownsWr && o.hasWr !== false).length;
  statsContainer.innerHTML = `
    <div>Rooms with floor improvement: ${floorImprovementRooms}</div>
    <div>Total floor gain: +${floorGain}</div>
    <div>Same-floor tick gain: ${tickGain} ticks</div>
  `;
  
  return {
    scrollContainer,
    statsContainer
  };
}

// =======================
// 12. Tab Shell
// =======================

function getTabButtonClassName(isActive) {
  return isActive
    ? 'frame-pressed-1 surface-regular px-2 py-1 flex-1 tab-active pixel-font-14'
    : 'frame-pressed-1 surface-dark px-2 py-1 flex-1 pixel-font-14';
}

function setTabButtonLabel(button, iconDef, label) {
  button.replaceChildren();

  const iconWrap = document.createElement('span');
  iconWrap.style.display = 'inline-flex';
  iconWrap.style.alignItems = 'center';
  iconWrap.style.justifyContent = 'center';
  iconWrap.style.width = `${HIGHSCORE_TAB_ICON_SIZE}px`;
  iconWrap.style.height = `${HIGHSCORE_TAB_ICON_SIZE}px`;
  iconWrap.style.flexShrink = '0';

  const img = document.createElement('img');
  img.src = iconDef.src;
  img.alt = iconDef.alt || label;
  img.className = 'pixelated';
  img.style.width = `${HIGHSCORE_TAB_ICON_SIZE}px`;
  img.style.height = `${HIGHSCORE_TAB_ICON_SIZE}px`;
  img.style.objectFit = 'contain';
  img.style.display = 'block';
  iconWrap.appendChild(img);
  button.appendChild(iconWrap);

  const text = document.createElement('span');
  text.textContent = label;
  text.style.lineHeight = '1';
  button.appendChild(text);
}

function createTabButton(iconDef, label, isActive) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = getTabButtonClassName(isActive);
  button.style.display = 'inline-flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.gap = '4px';
  setTabButtonLabel(button, iconDef, label);
  return button;
}

// Function to create tabs
function createTabPanel(content) {
  const panel = document.createElement('div');
  panel.style.display = 'none';
  panel.style.flexDirection = 'column';
  panel.style.flex = '1 1 0';
  panel.style.minHeight = '0';
  panel.appendChild(content.scrollContainer.element);

  const separator = document.createElement('div');
  separator.setAttribute('role', 'none');
  separator.className = 'separator my-2.5';
  panel.appendChild(separator);
  content.statsContainer.style.flexShrink = '0';
  panel.appendChild(content.statsContainer);

  return panel;
}

function createTabs(summaryContent, tickContent, rankContent, floorContent) {
  const container = document.createElement('div');
  container.className = 'flex flex-col highscores-modal-content';
  container.style.height = '100%';
  container.style.minHeight = '0';

  const tabButtons = document.createElement('div');
  tabButtons.className = 'flex mb-2';

  const tabDefs = [
    { label: 'Summary', icon: HIGHSCORE_TAB_ICONS.summary, content: summaryContent },
    { label: 'Ticks', icon: HIGHSCORE_TAB_ICONS.ticks, content: tickContent },
    { label: 'Rank', icon: HIGHSCORE_TAB_ICONS.rank, content: rankContent },
    { label: 'Floor', icon: HIGHSCORE_TAB_ICONS.floor, content: floorContent }
  ];

  const buttons = tabDefs.map((tab, index) => {
    const button = createTabButton(tab.icon, tab.label, index === 0);
    tabButtons.appendChild(button);
    return button;
  });

  const panels = tabDefs.map((tab, index) => {
    const panel = createTabPanel(tab.content);
    if (index === 0) panel.style.display = 'flex';
    return panel;
  });

  const { searchContainer, searchInput } = createHighscoreSearchBar('Search maps...');
  searchContainer.style.flexShrink = '0';
  searchContainer.style.marginBottom = '8px';

  let activeTabIndex = 0;
  let searchDebounceTimer = null;

  const applySearch = () => {
    filterImprovementTabPanel(panels[activeTabIndex], searchInput.value);
  };

  const activateTab = (index) => {
    activeTabIndex = index;
    buttons.forEach((button, i) => {
      button.className = getTabButtonClassName(i === index);
      panels[i].style.display = i === index ? 'flex' : 'none';
    });
    applySearch();
  };

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => activateTab(index));
  });

  searchInput.addEventListener('input', () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(applySearch, 150);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      applySearch();
      searchInput.blur();
    }
  });

  container.appendChild(tabButtons);
  container.appendChild(searchContainer);
  panels.forEach((panel) => container.appendChild(panel));

  return {
    element: container,
    cleanup: () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
      }
    }
  };
}

// =======================
// 13. Modal Orchestration
// =======================

async function showImprovementsModal() {
  console.log('Showing Highscores modal...');
  ensureHighscoresStyles();

  let dismissLoading = null;

  try {
    clearHighscoresModalCleanup();
    ROOM_NAMES = globalThis.state.utils.ROOM_NAME;

    dismissLoading = api.showModal({
      title: t('mods.highscore.title'),
      content: '<div style="text-align: center; padding: 20px;">Loading data...</div>',
      buttons: []
    });
    
    // Get player context and fetch highscores data
    const ctx = globalThis.state.player.getSnapshot().context;
    const rooms = ctx.rooms;
    const you = ctx.userId;
    const yourName = (ctx.name || '').trim().toLowerCase();
    
    // Fetch data from API
    const [best, lbs, roomsHighscores] = await Promise.all([
      fetchTRPC('game.getTickHighscores'),
      fetchTRPC('game.getTickLeaderboards'),
      fetchTRPC('game.getRoomsHighscores')
    ]);
    
    const summaryMapCodes = getSummaryMapCodesInOrder(rooms);
    const summaryEntries = buildSummaryEntries(summaryMapCodes, rooms, best, roomsHighscores, you, yourName);

    const tickRoomCodes = getImprovementRoomCodes(rooms, [...summaryMapCodes, ...Object.keys(best || {})]);
    const hasTickWrData = tickRoomCodes.some((code) => best[code]);

    // Process tick opportunities
    const tickOpportunities = sortImprovementOpportunities(
      tickRoomCodes.flatMap((code) => {
      const r = rooms?.[code] || {};
      const hasPersonalData = hasAnyPersonalMapData(r);
      const isUnlocked = isMapUnlocked(code, rooms);
      const yourTicks = getDisplayYourTicks(r);
      const b = best[code];

      if (!b) {
        return [{
          code,
          name: ROOM_NAMES[code] || code,
          yours: yourTicks,
          best: null,
          diff: 0,
          pct: '0.0',
          player: null,
          ownsWr: false,
          hasWr: false,
          hasPersonalData,
          isUnlocked
        }];
      }

      const ownsWr = isOwnHighscoreRecord(b, you, yourName);
      const d = yourTicks - b.ticks;
      if (!ownsWr && d <= 0) return [];
      return [{
        code,
        name: ROOM_NAMES[code] || code,
        yours: yourTicks,
        best: b.ticks,
        diff: ownsWr ? 0 : d,
        pct: ownsWr ? '0.0' : ((d / yourTicks) * 100).toFixed(1),
        player: b.userName,
        ownsWr,
        hasWr: true,
        hasPersonalData,
        isUnlocked
      }];
    }),
      (a, b) => (b.diff - a.diff)
    );
    
    const minTheo = tickRoomCodes.reduce((s, code) => {
      const r = rooms?.[code] || {};
      const yourTicks = getDisplayYourTicks(r);
      const wrTicks = best[code]?.ticks;
      if (!wrTicks) return s;
      return s + Math.min(yourTicks, wrTicks);
    }, 0);
    
    const rankRoomCodes = getImprovementRoomCodes(rooms, [...summaryMapCodes, ...Object.keys(roomsHighscores?.rank || {})]);
    const hasRankWrData = rankRoomCodes.some((code) => roomsHighscores?.rank?.[code]);

    // Process rank opportunities (higher rank is better; same-rank entries are always shown)
    const rankOpportunities = sortImprovementOpportunities(
      rankRoomCodes.flatMap((code) => {
      const r = rooms?.[code] || {};
      const hasPersonalData = hasAnyPersonalMapData(r);
      const isUnlocked = isMapUnlocked(code, rooms);
      const yourRank = getDisplayYourRank(r);
      const yourRankTicks = normalizeYourRankTicks(r);
      const topRank = roomsHighscores?.rank?.[code];

      if (!topRank) {
        return [{
          code,
          name: ROOM_NAMES[code] || code,
          yourScore: yourRank,
          bestScore: null,
          diff: 0,
          yourRankTicks,
          bestRankTicks: null,
          tickDiff: 0,
          improvementText: 'No WR yet',
          player: null,
          ownsWr: false,
          hasWr: false,
          hasPersonalData,
          isUnlocked
        }];
      }

      const ownsWr = isOwnHighscoreRecord(topRank, you, yourName);
      const bestRank = Number.isFinite(Number(topRank.rank)) ? Number(topRank.rank) : 0;
      const bestRankTicks = Number.isFinite(Number(topRank.ticks)) ? Number(topRank.ticks) : null;

      const rankDiff = bestRank - yourRank;
      const sameRankTickDelta = (
        rankDiff === 0 &&
        bestRankTicks !== null &&
        yourRankTicks !== null
      ) ? (yourRankTicks - bestRankTicks) : null;
      const sameRankTickGain = sameRankTickDelta !== null && sameRankTickDelta > 0
        ? sameRankTickDelta
        : 0;

      if (!ownsWr && rankDiff < 0) return [];

      const improvementText = ownsWr
        ? 'You hold the WR'
        : rankDiff > 0
          ? `+${rankDiff} rank point${rankDiff > 1 ? 's' : ''}`
          : formatTickImprovementText(sameRankTickDelta, yourRankTicks);

      return [{
        code,
        name: ROOM_NAMES[code] || code,
        yourScore: yourRank,
        bestScore: bestRank,
        diff: rankDiff,
        yourRankTicks,
        bestRankTicks,
        tickDiff: sameRankTickGain,
        improvementText,
        player: topRank.userName,
        ownsWr,
        hasWr: true,
        hasPersonalData,
        isUnlocked
      }];
    }),
      (a, b) => {
        if (b.diff !== a.diff) return b.diff - a.diff;
        return b.tickDiff - a.tickDiff;
      }
    );
    
    console.log('[Highscores][Floor Debug] Starting floor opportunity processing');
    console.log('[Highscores][Floor Debug] roomsHighscores.floor keys:', Object.keys(roomsHighscores?.floor || {}).length);
    
    const floorRoomCodes = getImprovementRoomCodes(rooms, [...summaryMapCodes, ...Object.keys(roomsHighscores?.floor || {})]);
    const hasFloorWrData = floorRoomCodes.some((code) => roomsHighscores?.floor?.[code]);

    // Process floor opportunities (higher floor is better; same-floor entries are always shown)
    const floorOpportunities = sortImprovementOpportunities(
      floorRoomCodes.flatMap((code) => {
      const r = rooms?.[code] || {};
      const hasPersonalData = hasAnyPersonalMapData(r);
      const isUnlocked = isMapUnlocked(code, rooms);
      const yourFloor = getDisplayYourFloor(r);
      const yourFloorTicks = getEffectiveYourFloorTicks(r);
      const topFloor = roomsHighscores?.floor?.[code];

      if (!topFloor) {
        return [{
          code,
          name: ROOM_NAMES[code] || code,
          yourFloor,
          yourFloorTicks,
          bestFloor: null,
          bestFloorTicks: null,
          floorDiff: 0,
          tickDiff: 0,
          improvementText: 'No WR yet',
          player: null,
          ownsWr: false,
          hasWr: false,
          hasPersonalData,
          isUnlocked
        }];
      }

      const ownsWr = isOwnHighscoreRecord(topFloor, you, yourName);
      const bestFloor = Number.isFinite(Number(topFloor.floor)) ? Number(topFloor.floor) : 0;
      const bestFloorTicks = Number.isFinite(Number(topFloor.floorTicks))
        ? Number(topFloor.floorTicks)
        : (Number.isFinite(Number(topFloor.ticks)) ? Number(topFloor.ticks) : null);

      const floorDiff = bestFloor - yourFloor;
      const sameFloorTickDelta = (
        floorDiff === 0 &&
        bestFloorTicks !== null &&
        yourFloorTicks !== null
      ) ? (yourFloorTicks - bestFloorTicks) : null;
      const sameFloorTickGain = sameFloorTickDelta !== null && sameFloorTickDelta > 0
        ? sameFloorTickDelta
        : 0;

      if (!ownsWr && floorDiff < 0) {
        console.log('[Highscores][Floor Debug] Skipping room (your floor higher than WR floor):', code, {
          yourFloor,
          bestFloor
        });
        return [];
      }

      if (floorDiff === 0) {
        console.log('[Highscores][Floor Debug] Same-floor room:', code, {
          yourFloor,
          bestFloor,
          yourFloorTicks,
          bestFloorTicks,
          sameFloorTickDelta,
          userRoomRaw: {
            floor: r.floor,
            floorTicks: r.floorTicks,
            ticks: r.ticks
          },
          topFloorRaw: {
            floor: topFloor.floor,
            floorTicks: topFloor.floorTicks
          },
          tickWRRaw: best[code] ? {
            ticks: best[code].ticks,
            userName: best[code].userName
          } : null
        });
      }

      const improvementText = ownsWr
        ? 'You hold the WR'
        : floorDiff > 0
          ? `+${floorDiff} floor${floorDiff > 1 ? 's' : ''}`
          : formatTickImprovementText(sameFloorTickDelta, yourFloorTicks);

      return [{
        code,
        name: ROOM_NAMES[code] || code,
        yourFloor,
        yourFloorTicks,
        bestFloor,
        bestFloorTicks,
        floorDiff,
        tickDiff: sameFloorTickGain,
        improvementText,
        player: topFloor.userName,
        ownsWr,
        hasWr: true,
        hasPersonalData,
        isUnlocked
      }];
    }),
      (a, b) => {
        if (b.floorDiff !== a.floorDiff) return b.floorDiff - a.floorDiff;
        return b.tickDiff - a.tickDiff;
      }
    );
    
    console.log('[Highscores][Floor Debug] Final floor opportunities:', floorOpportunities.length);
    console.log(
      '[Highscores][Floor Debug] Same-floor entries:',
      floorOpportunities.filter(o => o.floorDiff === 0).length
    );
    
    const improvementStats = buildImprovementSummaryStats(
      tickOpportunities,
      rankOpportunities,
      floorOpportunities
    );

    if (typeof dismissLoading === 'function') {
      dismissLoading();
      dismissLoading = null;
    }

    const summaryContent = createSummaryContent(summaryEntries, you, yourName, improvementStats);
    const tickContent = createTickContent(tickOpportunities, minTheo, hasTickWrData);
    const rankContent = createRankContent(rankOpportunities, hasRankWrData);
    const floorContent = createFloorContent(floorOpportunities, hasFloorWrData);
    
    // Create tabbed interface
    const tabbedContent = createTabs(summaryContent, tickContent, rankContent, floorContent);

    const modalDimensions = getHighscoresModalDimensions();
    const modalRef = api.ui.components.createModal({
      title: t('mods.highscore.title'),
      width: modalDimensions.width,
      content: tabbedContent.element,
      buttons: [
        {
          text: 'Close',
          primary: true,
          onClick: () => clearHighscoresModalCleanup()
        }
      ]
    });

    tagHighscoresModalElement(modalRef);
    highscoresModalTabsCleanup = tabbedContent.cleanup;
    setupHighscoresModalResponsiveLayout(modalRef, tabbedContent.element);
    attachHighscoresModalCloseCleanup(modalRef);
    
    console.log('Highscores modal displayed successfully');
  } catch (error) {
    console.error('Error showing Highscores modal:', error);

    api.showModal({
      title: 'Error',
      content: '<p>Failed to load Highscores. Please try again later.</p><p style="color: #999; font-size: 12px;">Error: ' + error.message + '</p>',
      buttons: [
        {
          text: 'OK',
          primary: true
        }
      ]
    });
  } finally {
    if (typeof dismissLoading === 'function') {
      dismissLoading();
    }
  }
}

// =======================
// 14. Entry Point & Exports
// =======================

console.log('Highscores mod initializing...');

if (api) {
  console.log('BestiaryModAPI available in Highscores mod');

  window.highscoreButton = api.ui.addButton({
    id: HIGHSCORE_BUTTON_ID,
    text: t('mods.highscore.buttonText'),
    tooltip: t('mods.highscore.buttonTooltip'),
    primary: false,
    onClick: showImprovementsModal
  });

  console.log('Highscores button added');
} else {
  console.error('BestiaryModAPI not available in Highscores mod');
}

console.log('Highscores mod initialization complete');

exports = {
  showImprovements: showImprovementsModal
};

exports.cleanup = function() {
  console.log('[Highscores] Running cleanup...');

  closeHighscoresModal();

  if (api?.ui?.removeButton) {
    api.ui.removeButton(HIGHSCORE_BUTTON_ID);
  }
  if (typeof window.highscoreButton !== 'undefined') {
    delete window.highscoreButton;
  }

  if (typeof ROOM_NAMES !== 'undefined') {
    ROOM_NAMES = null;
  }

  console.log('[Highscores] Cleanup completed');
}; 