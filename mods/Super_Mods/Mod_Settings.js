// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[Mod Settings] initializing...');

// Default configuration
const defaultConfig = {
  enabled: true,
  showStaminaTimer: false,
  showSettingsButton: true,
  enableMaxCreatures: false,
  enableSealed: false,
  maxCreaturesColor: 'prismatic',
  sealedCreaturesColor: 'prismatic',
  enableMaxShinies: false,
  maxShiniesColor: 'prismatic',
  showAdvancedStatsOnHover: false,
  showAbilityOnHover: false,
  showSetupLabels: false,
  enableSetupShortcutsAndHover: true,
  hotkeySetupSource: 'betterSetups', // 'betterSetups' | 'setupManager'
  enableShinyEnemies: false,
  enableAutoplayRefresh: false,
  alwaysNavigateMaxFloor: false,
  autoplayRefreshMinutes: 30,
  autoplayRefreshTimerMode: 'autoplay', // 'autoplay', 'internal', or 'both'
  disableAutoReload: false,
  disableQuestHelpers: false,
  enableAntiIdleSounds: false,
  removeWebsiteFooter: false,
  hideStopAfterDefeat: false,
  hidePowerSavingMode: false,
  persistPowerSavingMode: false,
  powerSavingModeEnabled: false,
  compactNavBar: false,
  showLastVisitedMapButton: false,
  alwaysOpenHuntAnalyzer: false,
  enablePlayercount: true,
  includeRunDataByDefault: true,
  includeHuntDataByDefault: true,
  persistentInventory: false,
  inventoryWidgetPinned: null,
  inventoryWidgetLeft: null,
  inventoryWidgetTop: null,
  inventoryHorizontalLayout: false,
  inventoryWidgetLocked: false,
  inventoryItemsPerColumn: 4, // 4 | 2 | 1 — vertical columns / horizontal strip height
  inventoryBorderStyle: 'Original',
  modButtonDisplay: 'text', // 'text' or 'icon'
  modButtonBarLayout: 'horizontal', // 'horizontal', 'vertical', or 'hidden'
  vipListInterface: 'modal', // 'modal' or 'panel'
  enableVipListChat: false, // Enable messaging/chat feature in VIP List (controls both VIP List chat and Global Chat)
  vipListMessageFilter: 'all', // 'all' or 'friends' - who can send messages
  autoHideNonShinyNonAwakenedMonsters: false,
  enableFirebaseRunsUpload: false, // Enable uploading best runs to Firebase
  firebaseRunsPassword: '', // Encryption password for Firebase runs (stored encrypted)
  autoUploadRuns: false, // Automatically upload when new best run is recorded
  firebaseUploadRegions: {}, // regionId -> false when disabled; missing keys = enabled (all ON by default)
  lastFirebaseUploadedMapHashes: {}, // mapKey -> payload hash for delta Firebase uploads (v2)
  hotkeyOpenInventory: 'i', // KeyboardEvent.key id: letter/digit, or e.g. f1, insert, home, pageup
  hotkeyOpenQuestLog: 'q',
  hotkeyOpenStore: 's',
  hotkeyOpenTrophyRoom: 't',
  hotkeyOpenDaycare: 'd',
  hotkeyOpenBestiary: 'b',
  hotkeyOpenDrMephistopheles: 'e',
  hotkeyOpenForge: 'f',
  hotkeyOpenHygenie: 'h',
  hotkeyOpenMountainFortress: 'm',
  hotkeyOpenArsenal: 'a',
  hotkeyOpenMonstrousCauldron: 'o',
  hotkeyOpenCyclopedia: 'c',
  hotkeyOpenMonsterSqueezer: 'x',
  hotkeyOpenRunes: 'n',
  hotkeyOpenDragonPlant: 'l',
  hotkeyOpenPawAndFurSociety: 'w',
  hotkeyReturnToMap: 'g',
  hotkeyFloorUp: 'pageup',
  hotkeyFloorDown: 'pagedown',
  hotkeyCycleBestiaryEquipmentTab: 'tab',
  hotkeyResetCurrentMapDefault: 'r',
  hotkeyCycleBattleStyle: 'v',
  hotkeyPreviousMap: 'j',
  hotkeyNextMap: 'k',
  hotkeyStartOrSkip: 'z',
  hotkeyToggleTurboMode: 'y',
  hotkeyOpenBetterTeleporter: 'p',
  hotkeyAutoSetup: 'u',
  hotkeySetupSlot1: 'f1',
  hotkeySetupSlot2: 'f2',
  hotkeySetupSlot3: 'f3',
  hotkeySetupSlot4: 'f4',
  hotkeySetupSlot5: 'f5',
  hotkeySetupSlot6: 'f6',
  hotkeySetupSlot7: 'f7',
  hotkeySetupSlot8: 'f8',
  enableHotkeys: false
};

// Storage key for this mod
const STORAGE_KEY = 'better-ui-config';

// Load config from localStorage
let config;
try {
  const savedConfig = localStorage.getItem(STORAGE_KEY);
  if (savedConfig) {
    config = Object.assign({}, defaultConfig, JSON.parse(savedConfig));
    console.log('[Mod Settings] Config loaded from localStorage:', config);
  } else {
    config = Object.assign({}, defaultConfig);
    console.log('[Mod Settings] No saved config, using defaults:', config);
  }
} catch (error) {
  console.error('[Mod Settings] Error loading config from localStorage:', error);
  config = Object.assign({}, defaultConfig);
}
window.betterUIConfig = config;
delete config.enableFavorites;
delete config.favoriteSymbol;
config.hotkeyOpenInventory = sanitizeStoredHotkey(config.hotkeyOpenInventory, '');
if (config.hotkeyOpenQuestLog === undefined) config.hotkeyOpenQuestLog = 'q';
if (config.hotkeyOpenStore === undefined) config.hotkeyOpenStore = 's';
if (config.hotkeyOpenTrophyRoom === undefined) config.hotkeyOpenTrophyRoom = 't';
if (config.hotkeyOpenDaycare === undefined) config.hotkeyOpenDaycare = 'd';
if (config.hotkeyOpenBestiary === undefined) config.hotkeyOpenBestiary = 'b';
if (config.hotkeyOpenDrMephistopheles === undefined) config.hotkeyOpenDrMephistopheles = 'e';
if (config.hotkeyOpenHygenie === undefined) config.hotkeyOpenHygenie = 'h';
if (config.hotkeyOpenForge === undefined) config.hotkeyOpenForge = 'f';
if (config.hotkeyOpenMountainFortress === undefined) config.hotkeyOpenMountainFortress = 'm';
if (config.hotkeyOpenArsenal === undefined) config.hotkeyOpenArsenal = 'a';
if (config.hotkeyOpenMonstrousCauldron === undefined) config.hotkeyOpenMonstrousCauldron = 'o';
if (config.hotkeyOpenCyclopedia === undefined) {
  config.hotkeyOpenCyclopedia = 'c';
  if (config.hotkeyOpenMonstrousCauldron === 'c') {
    config.hotkeyOpenMonstrousCauldron = 'o';
  }
}
if (config.hotkeyOpenMonsterSqueezer === undefined) config.hotkeyOpenMonsterSqueezer = 'x';
// One-shot: earlier builds left these unbound (''). Apply mnemonic defaults once.
if (config.hotkeyOpenRunesPlantPawDefaultsApplied !== true) {
  if (config.hotkeyOpenRunes === undefined || config.hotkeyOpenRunes === '') config.hotkeyOpenRunes = 'n';
  if (config.hotkeyOpenDragonPlant === undefined || config.hotkeyOpenDragonPlant === '') {
    config.hotkeyOpenDragonPlant = 'l';
  }
  if (config.hotkeyOpenPawAndFurSociety === undefined || config.hotkeyOpenPawAndFurSociety === '') {
    config.hotkeyOpenPawAndFurSociety = 'w';
  }
  config.hotkeyOpenRunesPlantPawDefaultsApplied = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (_) {
    // Best effort; in-memory values still drive this session.
  }
}
if (config.hotkeyOpenRunes === undefined) config.hotkeyOpenRunes = 'n';
if (config.hotkeyOpenDragonPlant === undefined) config.hotkeyOpenDragonPlant = 'l';
if (config.hotkeyOpenPawAndFurSociety === undefined) config.hotkeyOpenPawAndFurSociety = 'w';
config.hotkeyOpenQuestLog = sanitizeStoredHotkey(config.hotkeyOpenQuestLog, '');
config.hotkeyOpenStore = sanitizeStoredHotkey(config.hotkeyOpenStore, '');
config.hotkeyOpenTrophyRoom = sanitizeStoredHotkey(config.hotkeyOpenTrophyRoom, '');
config.hotkeyOpenDaycare = sanitizeStoredHotkey(config.hotkeyOpenDaycare, '');
config.hotkeyOpenBestiary = sanitizeStoredHotkey(config.hotkeyOpenBestiary, '');
config.hotkeyOpenDrMephistopheles = sanitizeStoredHotkey(config.hotkeyOpenDrMephistopheles, '');
config.hotkeyOpenForge = sanitizeStoredHotkey(config.hotkeyOpenForge, '');
config.hotkeyOpenHygenie = sanitizeStoredHotkey(config.hotkeyOpenHygenie, '');
config.hotkeyOpenMountainFortress = sanitizeStoredHotkey(config.hotkeyOpenMountainFortress, '');
config.hotkeyOpenArsenal = sanitizeStoredHotkey(config.hotkeyOpenArsenal, '');
config.hotkeyOpenMonstrousCauldron = sanitizeStoredHotkey(config.hotkeyOpenMonstrousCauldron, '');
config.hotkeyOpenMonsterSqueezer = sanitizeStoredHotkey(config.hotkeyOpenMonsterSqueezer, '');
config.hotkeyOpenRunes = sanitizeStoredHotkey(config.hotkeyOpenRunes, 'n');
config.hotkeyOpenDragonPlant = sanitizeStoredHotkey(config.hotkeyOpenDragonPlant, 'l');
config.hotkeyOpenPawAndFurSociety = sanitizeStoredHotkey(config.hotkeyOpenPawAndFurSociety, 'w');
if (config.hotkeyReturnToMap === undefined) config.hotkeyReturnToMap = 'g';
config.hotkeyReturnToMap = sanitizeStoredHotkey(config.hotkeyReturnToMap, '');
if (config.hotkeyFloorUp === undefined) config.hotkeyFloorUp = 'pageup';
if (config.hotkeyFloorDown === undefined) config.hotkeyFloorDown = 'pagedown';
if (config.hotkeyCycleBestiaryEquipmentTab === undefined) config.hotkeyCycleBestiaryEquipmentTab = 'tab';
if (config.hotkeyResetCurrentMapDefault === undefined) config.hotkeyResetCurrentMapDefault = 'r';
if (config.hotkeyCycleBattleStyle === undefined) config.hotkeyCycleBattleStyle = 'v';
if (config.hotkeyPreviousMap === undefined) config.hotkeyPreviousMap = 'j';
if (config.hotkeyNextMap === undefined) config.hotkeyNextMap = 'k';
if (config.hotkeyStartOrSkip === undefined) config.hotkeyStartOrSkip = 'z';
if (config.hotkeyToggleTurboMode === undefined) config.hotkeyToggleTurboMode = 'y';
config.hotkeyFloorUp = sanitizeStoredHotkey(config.hotkeyFloorUp, '');
config.hotkeyFloorDown = sanitizeStoredHotkey(config.hotkeyFloorDown, '');
config.hotkeyCycleBestiaryEquipmentTab = sanitizeStoredHotkey(config.hotkeyCycleBestiaryEquipmentTab, '');
config.hotkeyResetCurrentMapDefault = sanitizeStoredHotkey(config.hotkeyResetCurrentMapDefault, '');
config.hotkeyCycleBattleStyle = sanitizeStoredHotkey(config.hotkeyCycleBattleStyle, '');
config.hotkeyPreviousMap = sanitizeStoredHotkey(config.hotkeyPreviousMap, '');
config.hotkeyNextMap = sanitizeStoredHotkey(config.hotkeyNextMap, '');
config.hotkeyStartOrSkip = sanitizeStoredHotkey(config.hotkeyStartOrSkip, '');
config.hotkeyToggleTurboMode = sanitizeStoredHotkey(config.hotkeyToggleTurboMode, '');
if (config.hotkeyOpenBetterTeleporter === undefined) {
  config.hotkeyOpenBetterTeleporter = config.hotkeyOpenRoomHopper ?? 'p';
}
config.hotkeyOpenBetterTeleporter = sanitizeStoredHotkey(config.hotkeyOpenBetterTeleporter, '');
delete config.hotkeyOpenRoomHopper;
config.hotkeyOpenCyclopedia = sanitizeStoredHotkey(config.hotkeyOpenCyclopedia, '');
if (config.hotkeyAutoSetup === undefined) config.hotkeyAutoSetup = 'u';
config.hotkeyAutoSetup = sanitizeStoredHotkey(config.hotkeyAutoSetup, '');
for (let setupSlot = 1; setupSlot <= 8; setupSlot++) {
  const setupKey = `hotkeySetupSlot${setupSlot}`;
  if (config[setupKey] === undefined) config[setupKey] = `f${setupSlot}`;
  config[setupKey] = sanitizeStoredHotkey(config[setupKey], '');
}
if (config.enableHotkeys === undefined) config.enableHotkeys = false;
if (config.enableSetupShortcutsAndHover === undefined) config.enableSetupShortcutsAndHover = true;
if (config.hotkeySetupSource !== 'setupManager') config.hotkeySetupSource = 'betterSetups';
if (config.persistentInventory === undefined) {
  config.persistentInventory = config.defaultInventorySticky === true;
}
if (config.inventoryWidgetPinned === undefined) {
  // Old Sticky Inventory always forced pin; otherwise leave unset until the user pins.
  config.inventoryWidgetPinned = config.defaultInventorySticky === true ? true : null;
}
// Repair: a prior bug saved pinned=false whenever inventory was open unpinned, wiping sticky intent.
if (
  config.persistentInventory &&
  config.inventoryWidgetPinned === false &&
  config.defaultInventorySticky === true
) {
  config.inventoryWidgetPinned = true;
}
// Persistent Inventory implies restore-on-init; null pinned was never written on drag-save.
if (config.persistentInventory && config.inventoryWidgetPinned == null) {
  config.inventoryWidgetPinned = true;
}
if (!Number.isFinite(config.inventoryWidgetLeft)) config.inventoryWidgetLeft = null;
if (!Number.isFinite(config.inventoryWidgetTop)) config.inventoryWidgetTop = null;
if (config.inventoryHorizontalLayout !== true) config.inventoryHorizontalLayout = false;
if (config.inventoryWidgetLocked !== true) config.inventoryWidgetLocked = false;
{
  const cols = Number(config.inventoryItemsPerColumn);
  config.inventoryItemsPerColumn = cols === 1 || cols === 2 || cols === 4 ? cols : 4;
}
if (config.persistentInventory && config.inventoryWidgetPinned === true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (_) {
    // Best effort; in-memory values still drive this session.
  }
}
// Legacy translate storage is wiped (do not convert — values were often corrupted).
delete config.inventoryWidgetTranslateX;
delete config.inventoryWidgetTranslateY;
if (config.alwaysNavigateMaxFloor === undefined) config.alwaysNavigateMaxFloor = false;
if (config.autoHideNonShinyNonAwakenedMonsters === undefined) config.autoHideNonShinyNonAwakenedMonsters = false;
if (config.disableQuestHelpers === undefined) config.disableQuestHelpers = false;
ensureFirebaseUploadRegionsConfig();

// Last visited map feature globals
const LAST_MAP_STORAGE_KEY = 'mod-settings-map-history';
let mapHistory = []; // Array of {roomId, roomName} objects, most recent first
let lastMapButton = null;
let mapChangeUnsubscribe = null;
let isNavigatingViaButton = false;
let mapFloorSyncLastRoomId = null;
let mapFloorSyncTimeoutId = null;
const REPLAY_MAX_FLOOR_GUARD_MS = 5000;
const PROGRAMMATIC_NAV_FLOOR_GUARD_MS = 5000;
let replayMaxFloorGuardUntil = 0;
let programmaticNavFloorGuardUntil = 0;
let replayFloorGuardHookInstalled = false;
let autoHideMonstersInProgress = false;
let antiIdlePlayPromise = null;
const initState = {
  inProgress: false,
  initialized: false
};

// =======================
// 2. Helper Functions
// =======================

// Check if blocking mods (Board Analyzer or Autoscroller) are active
function isBlockedByAnalysisMods() {
  return window.ModCoordination?.isModActive('Board Analyzer') || 
         window.ModCoordination?.isModActive('Autoscroller');
}

// =======================
// 3. DOM Selectors & Constants
// =======================

// DOM selectors
const SELECTORS = {
  STAMINA_DIV: 'div[title="Stamina"]',
  STAMINA_PARENT_SPAN: 'span[data-full]',
  STAMINA_CHILD_SPANS: 'span',
  HEADER_SLOT: '#header-slot',
  CREATURE_IMG: 'img[alt="creature"]',
  STAR_TIER_4: 'img[src*="star-tier-4.png"], img[src*="star-tier-shiny.png"], img[src*="star-tier-hundo.png"], img.tier-stars[alt="star tier"]',
  RARITY_DIV: '.has-rarity, .rarity-shiny, .rarity-hundo, .rarity-awaken',
  RARITY_TEXT: '.has-rarity-text',
  LEVEL_SPAN: '.pixel-font-16.text-whiteExp span'
};

/** Resolves the main game nav <ul> (matches Autoseller: layout uses nav.grow / floating HUD on some viewports). */
function getPrimaryGameNavUl() {
  const headerSlot = document.getElementById('header-slot');
  const nav =
    headerSlot?.querySelector('nav') ||
    document.querySelector('nav.shrink-0') ||
    document.querySelector('nav.grow') ||
    document.querySelector('div.z-floatingHud nav');
  if (!nav) return null;
  const ul = nav.querySelector('ul.flex.items-center');
  return ul || null;
}

/** Responsive label spans inside nav buttons (Tailwind sm:inline and/or @[…]:inline). */
function isNavBarLabelSpan(span) {
  if (!span.classList.contains('hidden')) return false;
  const cn = typeof span.className === 'string' ? span.className : String(span.className);
  if (cn.includes('sm:inline')) return true;
  if (/\[[^\]]+\]:inline/.test(cn)) return true;
  return false;
}

/** All nav roots that may host the main bar (header vs mobile floating HUD can differ). */
function getNavElementsForCompactBar() {
  const navs = new Set();
  const headerSlot = document.getElementById('header-slot');
  const hNav = headerSlot?.querySelector('nav');
  if (hNav) navs.add(hNav);
  const nShrink = document.querySelector('nav.shrink-0');
  if (nShrink) navs.add(nShrink);
  const nGrow = document.querySelector('nav.grow');
  if (nGrow) navs.add(nGrow);
  document.querySelectorAll('div.z-floatingHud nav').forEach(n => navs.add(n));
  return [...navs];
}

/**
 * Elements to search for header/nav buttons (inventory, Trophy Room, etc.).
 * Layouts vary: `<nav>`, `#header-slot` only, or `<header>` with `ul.pixel-font-16.flex.items-center` (see createSettingsButton).
 */
function getNavButtonSearchRoots() {
  const roots = [];
  const seen = new Set();
  const add = (el) => {
    if (!el || seen.has(el)) return;
    if (el.nodeType !== 1) return;
    seen.add(el);
    roots.push(el);
  };
  for (const nav of getNavElementsForCompactBar()) {
    add(nav);
  }
  const headerSlot = document.getElementById('header-slot');
  if (headerSlot) {
    add(headerSlot.querySelector('ul.flex.items-center'));
    headerSlot.querySelectorAll('ul').forEach((ul) => add(ul));
  }
  const headerEl = document.querySelector('header');
  if (headerEl) {
    add(headerEl.querySelector('ul.pixel-font-16.flex.items-center'));
    add(headerEl.querySelector('ul.flex.items-center'));
    headerEl.querySelectorAll('ul').forEach((ul) => add(ul));
  }
  add(document.querySelector('header ul.pixel-font-16.flex.items-center'));
  const banner = document.querySelector('[role="banner"]');
  if (banner && banner !== headerEl) {
    banner.querySelectorAll('ul').forEach((ul) => add(ul));
  }
  return roots;
}

// Game constants
const GAME_CONSTANTS = {
  MAX_STAT_VALUE: 20,
  MAX_LEVEL: 50,
  AWAKENED_MAX_LEVEL: 99,
  MAX_TOTAL_GENES: 100,
  MAX_TIER: 4,
  ELITE_RARITY_LEVEL: 6,
  STAMINA_REGEN_MINUTES: 1
};

// Modal dimensions
const MODAL_CONFIG = {
  width: 600,
  maxWidth: 600,
  height: 500,
  leftColumnWidth: 140,
  rightColumnWidth: 400,
  viewportPadding: 16,
  minWidth: 280,
  minHeight: 280
};

function getModSettingsModalDimensions() {
  const pad = MODAL_CONFIG.viewportPadding * 2;
  const maxW = MODAL_CONFIG.maxWidth;
  return {
    width: Math.max(
      MODAL_CONFIG.minWidth,
      Math.min(MODAL_CONFIG.width, maxW, window.innerWidth - pad)
    ),
    height: Math.max(
      MODAL_CONFIG.minHeight,
      Math.min(MODAL_CONFIG.height, window.innerHeight - pad)
    )
  };
}

function getModSettingsColumnWidths(modalWidth) {
  const cappedWidth = Math.min(modalWidth, MODAL_CONFIG.maxWidth);
  const contentWidth = cappedWidth - 30;
  if (cappedWidth >= MODAL_CONFIG.width) {
    return {
      contentWidth: MODAL_CONFIG.width - 30,
      leftWidth: MODAL_CONFIG.leftColumnWidth,
      rightWidth: MODAL_CONFIG.rightColumnWidth
    };
  }
  const leftWidth = Math.min(
    MODAL_CONFIG.leftColumnWidth,
    Math.max(90, Math.floor(contentWidth * 0.32))
  );
  const rightWidth = Math.max(120, contentWidth - leftWidth - 18);
  return { contentWidth, leftWidth, rightWidth };
}

function applyModSettingsModalLayout(dialog, elements, dimensions) {
  if (!dialog) return;

  const width = Math.min(dimensions.width, MODAL_CONFIG.maxWidth);
  const height = dimensions.height;
  const { leftWidth, rightWidth } = getModSettingsColumnWidths(width);

  dialog.style.width = `${width}px`;
  dialog.style.minWidth = '0';
  dialog.style.maxWidth = `${MODAL_CONFIG.maxWidth}px`;
  dialog.style.height = `${height}px`;
  dialog.style.minHeight = '0';
  dialog.style.maxHeight = `${height}px`;
  dialog.style.boxSizing = 'border-box';
  dialog.style.overflow = 'hidden';
  dialog.classList.remove('max-w-[300px]');

  let contentWrapper = null;
  const children = Array.from(dialog.children);
  for (const child of children) {
    if (child !== dialog.firstChild && child.tagName === 'DIV') {
      contentWrapper = child;
      break;
    }
  }
  if (!contentWrapper) {
    contentWrapper = dialog.querySelector(':scope > div');
  }
  if (contentWrapper) {
    contentWrapper.style.height = '100%';
    contentWrapper.style.display = 'flex';
    contentWrapper.style.flexDirection = 'column';
    contentWrapper.style.flex = '1 1 0';
    contentWrapper.style.minHeight = '0';
    contentWrapper.style.minWidth = '0';
    contentWrapper.style.maxWidth = '100%';
    contentWrapper.style.overflow = 'hidden';
  }

  const contentContainer = dialog.querySelector('.widget-bottom');
  if (contentContainer) {
    Object.assign(contentContainer.style, {
      flex: '1 1 auto',
      minHeight: '0',
      overflowY: 'hidden',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });
  }

  if (elements?.content) {
    Object.assign(elements.content.style, {
      flex: '1 1 auto',
      minHeight: '0',
      height: '100%',
      maxHeight: 'none',
      width: '100%',
      minWidth: '0',
      maxWidth: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden'
    });
  }

  if (elements?.mainContent) {
    Object.assign(elements.mainContent.style, {
      flex: '1 1 0',
      minHeight: '0',
      height: 'auto',
      maxHeight: 'none',
      overflow: 'hidden'
    });
  }

  if (elements?.leftColumn) {
    Object.assign(elements.leftColumn.style, {
      width: `${leftWidth}px`,
      minWidth: `${leftWidth}px`,
      maxWidth: `${leftWidth}px`,
      flex: `0 0 ${leftWidth}px`
    });
  }

  if (elements?.rightColumn) {
    Object.assign(elements.rightColumn.style, {
      width: `${rightWidth}px`,
      minWidth: '0',
      maxWidth: `${rightWidth}px`,
      flex: `1 1 0`,
      overflowX: 'hidden'
    });
  }
}

function clearModSettingsModalLayoutCleanup() {
  if (modSettingsModalLayoutCleanup) {
    modSettingsModalLayoutCleanup();
    modSettingsModalLayoutCleanup = null;
  }
}

function clearModSettingsModalWatchers() {
  for (const cleanup of modSettingsModalWatchCleanups) {
    try {
      cleanup();
    } catch (_) { /* ignore */ }
  }
  modSettingsModalWatchCleanups = [];
}

function clearModSettingsModalCoordinationSubs() {
  for (const unsub of modSettingsModalCoordinationUnsubscribers) {
    try {
      unsub?.();
    } catch (_) { /* ignore */ }
  }
  modSettingsModalCoordinationUnsubscribers = [];
}

/** Tear down settings-modal timers, bus subscriptions, resize, and capture mode. Idempotent. */
function teardownSettingsModal() {
  clearModSettingsModalWatchers();
  clearModSettingsModalCoordinationSubs();
  clearModSettingsModalLayoutCleanup();
  if (typeof hotkeysState.detachHotkeyCapture === 'function') {
    try {
      hotkeysState.detachHotkeyCapture();
    } catch (_) { /* ignore */ }
  }
  modSettingsSelectCategoryHandler = null;
  modSettingsFirebaseUploadStateUpdater = null;
  modSettingsModalInstance = null;
}

function getModSettingsDialog(modalRef) {
  if (modalRef?.element) return modalRef.element;
  if (modalRef instanceof HTMLElement) return modalRef;
  return document.querySelector('div[role="dialog"][data-state="open"]');
}

function setupModSettingsModalResponsiveLayout(modalRef, elements) {
  clearModSettingsModalLayoutCleanup();
  const apply = () => applyModSettingsModalLayout(getModSettingsDialog(modalRef), elements, getModSettingsModalDimensions());
  requestAnimationFrame(() => apply());
  const onResize = () => apply();
  window.addEventListener('resize', onResize);
  modSettingsModalLayoutCleanup = () => {
    window.removeEventListener('resize', onResize);
  };
}

// Timer element styles
const TIMER_STYLES = {
  opacity: '0.7',
  fontSize: '0.75em',
  display: 'inline',
  whiteSpace: 'nowrap',
  verticalAlign: 'baseline',
  marginLeft: '2px'
};

// Throttle settings
const THROTTLE_SETTINGS = {
  DOM_CHECK: 1000,  // 1 second for DOM mutation throttle
  UPDATE: 10000     // 10 seconds for update throttle
};

/** Region display name via maps-database (static map / game REGION_NAME / REGIONS.name). */
function resolveRegionDisplayName(region) {
  if (!region) return 'Unknown Region';
  if (typeof globalThis.mapsDatabase?.getRegionDisplayNameFromRegion === 'function') {
    return globalThis.mapsDatabase.getRegionDisplayNameFromRegion(region);
  }
  const id = region.id;
  if (!id) return region.name || 'Unknown Region';
  if (typeof globalThis.mapsDatabase?.getRegionDisplayName === 'function') {
    return globalThis.mapsDatabase.getRegionDisplayName(id);
  }
  const mapped = globalThis.mapsDatabase?.REGION_NAME_MAP?.[String(id).toLowerCase()];
  if (mapped) return mapped;
  if (region.name) return region.name;
  return String(id).replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

const FIREBASE_UPLOAD_OTHER_REGION_ID = '__other__';

function getRunTrackerOtherMapKeys(allRuns) {
  const runEntries = allRuns?.runs;
  if (!runEntries || typeof runEntries !== 'object') return [];

  const processedMapKeys = new Set();
  try {
    const regions = globalThis.state?.utils?.REGIONS;
    const roomNames = globalThis.state?.utils?.ROOM_NAME;

    if (regions && Array.isArray(regions) && roomNames) {
      regions.forEach((region) => {
        if (!region.rooms) return;
        region.rooms.forEach((room) => {
          const roomId = room.id;
          const roomName = roomNames[roomId] || roomId;
          const mapKey = `map_${roomName.toLowerCase().replace(/\s+/g, '_')}`;

          if (runEntries[mapKey]) {
            processedMapKeys.add(mapKey);
            return;
          }

          for (const [key, mapData] of Object.entries(runEntries)) {
            if (processedMapKeys.has(key)) continue;
            const allRunsInMap = [
              ...(mapData.speedrun || []),
              ...(mapData.rank || []),
              ...(mapData.floor || [])
            ];
            if (allRunsInMap.some((run) => run.mapId === roomId || run.mapId === room.id)) {
              processedMapKeys.add(key);
              break;
            }
          }
        });
      });
    }
  } catch (error) {
    console.warn('[Mod Settings] Error resolving run map regions:', error);
  }

  return Object.keys(runEntries).filter((mapKey) => !processedMapKeys.has(mapKey));
}

function hasFirebaseUploadOtherMapsRuns() {
  if (!window.RunTrackerAPI?.getAllRuns) return false;
  return getRunTrackerOtherMapKeys(window.RunTrackerAPI.getAllRuns()).length > 0;
}

function getFirebaseUploadRegionEntries() {
  const entries = [];
  const seen = new Set();

  if (typeof globalThis.mapsDatabase?.getRegionsInOrder === 'function') {
    for (const region of globalThis.mapsDatabase.getRegionsInOrder()) {
      if (!region?.id || seen.has(region.id)) continue;
      seen.add(region.id);
      entries.push({
        id: region.id,
        name: resolveRegionDisplayName(region)
      });
    }
  } else {
    const regions = globalThis.state?.utils?.REGIONS;
    if (Array.isArray(regions)) {
      regions.forEach((region) => {
        if (!region?.id || seen.has(region.id)) return;
        seen.add(region.id);
        entries.push({
          id: region.id,
          name: resolveRegionDisplayName(region)
        });
      });
    }
  }

  if (hasFirebaseUploadOtherMapsRuns()) {
    entries.push({
      id: FIREBASE_UPLOAD_OTHER_REGION_ID,
      name: t('mods.betterUI.firebaseUploadOtherMapsRegion')
    });
  }
  return entries;
}

function isFirebaseUploadRegionEnabled(regionId) {
  const regions = config.firebaseUploadRegions;
  if (!regions || typeof regions !== 'object') return true;
  return regions[regionId] !== false;
}

function ensureFirebaseUploadRegionsConfig() {
  if (!config.firebaseUploadRegions || typeof config.firebaseUploadRegions !== 'object') {
    config.firebaseUploadRegions = {};
  }
}

function initFirebaseUploadRegionToggles(container) {
  const listEl = container?.querySelector('#firebase-upload-regions-list');
  const headerBtn = container?.querySelector('#firebase-upload-regions-header');
  const panelEl = container?.querySelector('#firebase-upload-regions-panel');
  const chevronEl = container?.querySelector('#firebase-upload-regions-chevron');
  const hintEl = container?.querySelector('#firebase-upload-regions-expand-hint');
  if (!listEl) return;

  const setRegionsPanelExpanded = (expanded) => {
    if (!panelEl || !headerBtn) return;
    panelEl.hidden = !expanded;
    headerBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (chevronEl) {
      chevronEl.textContent = expanded ? '▾' : '▸';
    }
    if (hintEl) {
      hintEl.textContent = expanded
        ? t('mods.betterUI.firebaseUploadRegionsCollapseHint')
        : t('mods.betterUI.firebaseUploadRegionsExpandHint');
    }
    headerBtn.title = expanded
      ? t('mods.betterUI.firebaseUploadRegionsCollapseHint')
      : t('mods.betterUI.firebaseUploadRegionsExpandHint');
  };

  if (headerBtn && panelEl && !headerBtn.dataset.collapsibleBound) {
    headerBtn.dataset.collapsibleBound = '1';
    setRegionsPanelExpanded(false);
    headerBtn.addEventListener('mouseenter', () => {
      headerBtn.style.borderColor = 'rgba(255, 170, 0, 0.65)';
      headerBtn.style.background = 'rgba(255, 170, 0, 0.1)';
    });
    headerBtn.addEventListener('mouseleave', () => {
      headerBtn.style.borderColor = 'rgba(255, 170, 0, 0.35)';
      headerBtn.style.background = 'rgba(255, 255, 255, 0.05)';
    });
    headerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setRegionsPanelExpanded(panelEl.hidden);
    });
  }

  ensureFirebaseUploadRegionsConfig();
  listEl.innerHTML = '';

  for (const { id, name } of getFirebaseUploadRegionEntries()) {
    const label = document.createElement('label');
    label.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer;';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'firebase-upload-region-toggle';
    checkbox.dataset.regionId = id;
    checkbox.checked = isFirebaseUploadRegionEnabled(id);
    checkbox.style.cursor = 'pointer';

    const span = document.createElement('span');
    span.style.fontSize = '13px';
    span.style.color = '#ccc';
    span.textContent = name;
    if (id === FIREBASE_UPLOAD_OTHER_REGION_ID) {
      span.title = t('mods.betterUI.firebaseUploadOtherMapsRegionTooltip');
      span.style.cursor = 'help';
    }

    label.appendChild(checkbox);
    label.appendChild(span);
    listEl.appendChild(label);

    checkbox.addEventListener('change', () => {
      ensureFirebaseUploadRegionsConfig();
      if (checkbox.checked) {
        delete config.firebaseUploadRegions[id];
      } else {
        config.firebaseUploadRegions[id] = false;
      }
      saveConfig();
      console.log('[Mod Settings] Firebase upload region', id, checkbox.checked ? 'enabled' : 'disabled');
    });
  }
}

// Timeout/Delay settings (in milliseconds)
const TIMEOUT_DELAYS = {
  TAB_REAPPLY: 100,
  INIT_RETRY: 500,
  OBSERVER_RETRY: 1000,
  CONTAINER_DEBOUNCE: 200,
  BROWSER_REFRESH: 1000,
  /** Creature stat / advanced hover tooltip delay (matches Depot Manager). */
  HOVER_TOOLTIP_SHOW: 150
};

/** Vanilla bestiary filter input — same id as Depot Manager. */
const BESTIARY_SEARCH_INPUT_ID = 'monster-input-id';

// Use shared translation system via API
const t = (key) => api.i18n.t(key);

// Helper for dynamic translation with placeholders
const tReplace = (key, replacements) => {
  let text = t(key);
  Object.entries(replacements).forEach(([placeholder, value]) => {
    text = text.replace(`{${placeholder}}`, value);
  });
  return text;
};

// =======================
// 3. Global State
// =======================

// Track timeouts for cleanup
const activeTimeouts = new Set();

let bestiarySearchStyleListeners = null;
let bestiarySearchStylePendingTimeout = null;

// Observer state
const observers = {
  stamina: null,
  tab: null,
  creature: null,
  setupLabels: null,
  scrollLock: null,
  compactNavBar: null,
  autoplaySessionCheckboxes: null,
  inventoryModButtons: null,
  persistentInventory: null
};

// Timer state
const timerState = {
  element: null,
  lastValue: null,
  updateThrottle: null,
  lastUpdateTime: 0
};

// UI state
const uiState = {
  settingsButton: null
};

const persistentInventoryState = {
  restoreStarted: false,
  restoreComplete: false,
  restoring: false,
  dragActive: false,
  positionApplied: false,
  savePositionTimeout: null,
  restoreTimeouts: [],
  boundDragRoot: null,
  onPointerDown: null,
  onPointerMove: null,
  onPointerUp: null,
  dragOrigin: null,
  restoreStartedAt: 0,
  lastRestoreStepAt: 0,
  openedInventory: false,
  clickedPin: false,
  lastPinClickAt: 0,
  lastOpenAttemptAt: 0,
  pinClickAttempts: 0,
  horizontalLayoutCss: null,
  positionStyleCss: null
};

const PERSISTENT_INVENTORY_STYLE_ID = 'mod-settings-persistent-inventory-style';
const PERSISTENT_INVENTORY_RESTORE_STYLE_ID = 'mod-settings-persistent-inventory-restore-style';
const PERSISTENT_INVENTORY_ATTR = 'data-ba-persistent-inventory';
const PERSISTENT_INVENTORY_RESTORING_ATTR = 'data-ba-persistent-inventory-restoring';
const INVENTORY_HORIZONTAL_ATTR = 'data-ba-inventory-horizontal';
const INVENTORY_HORIZONTAL_STYLE_ID = 'mod-settings-inventory-horizontal-style';
const INVENTORY_COLUMNS_STYLE_ID = 'mod-settings-inventory-columns-style';
const INVENTORY_COLUMNS_ATTR = 'data-ba-inventory-columns';
const INVENTORY_NARROW_ATTR = 'data-ba-inventory-narrow';
const INVENTORY_LAYOUT_TOGGLE_CLASS = 'ba-inventory-layout-toggle';
const INVENTORY_LOCK_TOGGLE_CLASS = 'ba-inventory-lock-toggle';
const INVENTORY_HEADER_ACTIONS_CLASS = 'ba-inventory-header-actions';
const INVENTORY_TITLE_CLASS = 'ba-inventory-title';
const INVENTORY_HOTKEY_BADGE_CLASS = 'ba-inventory-hotkey-badge';
const INVENTORY_HOTKEY_BADGE_STYLE_ID = 'mod-settings-inventory-hotkey-badge-style';
const INVENTORY_SLOT_PX = 34;

function getInventoryItemsPerColumn() {
  const cols = Number(config.inventoryItemsPerColumn);
  return cols === 1 || cols === 2 || cols === 4 ? cols : 4;
}

function logPersistentInventory(message, details) {
  if (details !== undefined) {
    console.log(`[Mod Settings] Persistent inventory: ${message}`, details);
    return;
  }
  console.log(`[Mod Settings] Persistent inventory: ${message}`);
}

const EXPECTED_INVENTORY_MOD_BUTTON_CLASSES = [
  'auto-inventory-button',
  'autoscroller-inventory-button',
  'better-forge-inventory-button',
  'better-rune-recycler-inventory-button',
  'depot-manager-inventory-button'
];

const inventoryModButtonsState = {
  knownClasses: new Set(),
  verifyDebounceTimeout: null,
  lastRecoveryAt: 0,
  missingRetryCount: new Map()
};

// Hotkeys state
const hotkeysState = {
  keydownListener: null,
  /** Which config key is being rebound (nav + setup slots) or null */
  hotkeyCaptureMode: null,
  /** Removes active hotkey capture listeners (keydown + outside click). */
  detachHotkeyCapture: null
};

/** Stable id from KeyboardEvent.key (letters/digits, F1–F24, Insert, Home, PageUp, …). */
function normalizeHotkeyIdentifierFromKey(key) {
  if (key == null || key === '') return '';
  if (key === ' ') return 'space';
  return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
}

function sanitizeStoredHotkey(raw, fallback = 'i') {
  if (raw == null || typeof raw !== 'string') return fallback;
  const s = raw.trim();
  if (!s) return fallback;
  return s.length === 1 ? s.toLowerCase() : s.toLowerCase();
}

function isBattleActiveForHotkeys() {
  try {
    const boardContext = globalThis.state?.board?.getSnapshot?.().context;
    const gameStarted = boardContext?.gameStarted === true;
    const mode = typeof boardContext?.mode === 'string' ? boardContext.mode.toLowerCase() : '';
    const isSupportedMode = mode === 'manual' || mode === 'autoplay';
    return gameStarted && isSupportedMode;
  } catch {
    return false;
  }
}

/** Short label for the hotkey button (syncs visually with Reset-sized control). */
function formatHotkeyForDisplay(id, fallbackWhenEmpty = 'i') {
  const safe = sanitizeStoredHotkey(id, fallbackWhenEmpty);
  if (safe === '') return '—';
  if (safe.length === 1) return safe.toUpperCase();
  const fn = safe.match(/^f(\d{1,2})$/);
  if (fn) return `F${fn[1]}`;
  const map = {
    insert: 'Ins',
    delete: 'Del',
    home: 'Home',
    end: 'End',
    pageup: 'PgUp',
    pagedown: 'PgDn',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    space: 'Spc',
    escape: 'Esc',
    enter: 'Ent',
    tab: 'Tab',
    backspace: 'BS'
  };
  return map[safe] || (safe.length <= 4 ? safe.toUpperCase() : safe.slice(0, 4).toUpperCase());
}

const IGNORED_HOTKEY_IDS = new Set(['control', 'shift', 'alt', 'meta', 'os', 'contextmenu', 'dead', 'help']);

function isTypingIntoInput(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  if (typeof target.closest === 'function' && target.closest('[contenteditable="true"]')) return true;
  return false;
}

function normalizeForLabelMatch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function findGameNavButtonByLabel(label) {
  const normalizedLabel = normalizeForLabelMatch(label);
  if (!normalizedLabel) return null;

  for (const root of getNavButtonSearchRoots()) {
    const buttons = root.querySelectorAll('button');
    for (const button of buttons) {
      const aria = normalizeForLabelMatch(button.getAttribute('aria-label'));
      const title = normalizeForLabelMatch(button.getAttribute('title'));
      const text = normalizeForLabelMatch((button.textContent || '').replace(/\s+/g, ' ').trim());
      if (aria.includes(normalizedLabel) || title.includes(normalizedLabel) || text.includes(normalizedLabel)) {
        return button;
      }
    }
  }

  return null;
}

/** First nav button matching any of the search substrings (aria / title / text). */
function findGameNavButtonBySearchTerms(terms) {
  if (!Array.isArray(terms)) return null;
  for (const term of terms) {
    const btn = findGameNavButtonByLabel(term);
    if (btn) return btn;
  }
  return null;
}

function getInventoryNavSearchTerms() {
  const terms = ['inventory', 'inventario', 'inventário'];
  try {
    const localized = t('mods.betterUI.inventory');
    if (localized) terms.push(String(localized));
  } catch (_) {
    // Locale helper may be unavailable during early boot.
  }
  return terms;
}

function findInventoryNavButton() {
  const byLabel = findGameNavButtonBySearchTerms(getInventoryNavSearchTerms());
  if (byLabel) return byLabel;

  for (const root of getNavButtonSearchRoots()) {
    const img =
      root.querySelector('img[src*="inventory.png"]') ||
      root.querySelector('img[alt="inventory" i]') ||
      root.querySelector('img[alt="Inventário" i]') ||
      root.querySelector('img[alt="Inventario" i]');
    const button = img?.closest?.('button');
    if (button) return button;
  }

  const fallbackImg = document.querySelector(
    'header img[src*="inventory.png"], #header-slot img[src*="inventory.png"], [role="banner"] img[src*="inventory.png"], nav img[src*="inventory.png"]'
  );
  return fallbackImg?.closest?.('button') || null;
}

function openInventoryFromHotkey() {
  // Locale-independent path used by other mods (e.g. Autoseller).
  try {
    const currentMode = globalThis.state?.menu?.getSnapshot?.()?.context?.mode;
    if (currentMode === 'inventory') {
      return;
    }
    if (globalThis.state?.menu?.send) {
      globalThis.state.menu.send({
        type: 'setState',
        fn: (prev) => ({ ...prev, mode: 'inventory' })
      });
      return;
    }
  } catch (_) {
    // Fall through to DOM click.
  }

  const inventoryButton = findInventoryNavButton();
  if (!inventoryButton) {
    console.warn('[Mod Settings] Inventory hotkey pressed but inventory button was not found');
    return;
  }

  inventoryButton.click();
}

function openQuestLogFromHotkey() {
  const btn = findGameNavButtonBySearchTerms(['quest', 'quests', 'quest log']);
  if (!btn) {
    console.warn('[Mod Settings] Quest log hotkey pressed but no matching nav button was found');
    return;
  }
  btn.click();
}

function openStoreFromHotkey() {
  const btn = findGameNavButtonBySearchTerms(['store', 'shop']);
  if (!btn) {
    console.warn('[Mod Settings] Store hotkey pressed but no matching nav button was found');
    return;
  }
  btn.click();
}

function findTrophyRoomNavButton() {
  const terms = ['trophy room', 'sala de trof'];
  let btn = findGameNavButtonBySearchTerms(terms);
  if (btn) return btn;
  const candidates = document.querySelectorAll('header button, #header-slot button, [role="banner"] button');
  for (const b of candidates) {
    const text = (b.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    for (const t of terms) {
      if (text.includes(t)) return b;
    }
  }
  return null;
}

function openTrophyRoomFromHotkey() {
  const btn = findTrophyRoomNavButton();
  if (!btn) {
    console.warn('[Mod Settings] Trophy Room hotkey pressed but no matching nav button was found');
    return;
  }
  btn.click();
}

/** Milliseconds to wait after opening Inventory before sub-tab slot buttons are queryable. */
const INVENTORY_SUBTAB_HOTKEY_SETTLE_MS = 200;

/**
 * Tab in the inventory ribbon: prefer `.container-inventory-4`, then fallbacks via `querySelector` + `closest('button')`.
 * @param {string} innerSelector - `button.querySelector` argument (comma = OR in CSS).
 * @param {string[]} fallbackSelectors - Element selectors; first match with an ancestor `button` wins.
 */
function findInventorySubtabButton(innerSelector, fallbackSelectors) {
  const container = document.querySelector('.container-inventory-4');
  if (container) {
    const inGrid = Array.from(container.querySelectorAll('button')).find((btn) => btn.querySelector(innerSelector));
    if (inGrid) return inGrid;
  }
  for (const sel of fallbackSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const btn = el.closest('button');
      if (btn) return btn;
    }
  }
  return null;
}

/**
 * Opens an inventory sub-tab; if missing from the DOM, opens inventory first and retries after {@link INVENTORY_SUBTAB_HOTKEY_SETTLE_MS}.
 */
function openInventorySubtabFromHotkey(findTab, warnMessage) {
  let tab = findTab();
  if (tab) {
    tab.click();
    return;
  }
  openInventoryFromHotkey();
  scheduleTimeout(() => {
    tab = findTab();
    if (tab) {
      tab.click();
      return;
    }
    console.warn(warnMessage);
  }, INVENTORY_SUBTAB_HOTKEY_SETTLE_MS);
}

/** Daycare tab inside Inventory (same selector as Bestiary_Automator.js auto-daycare flow). */
function findDaycareInventoryTabButton() {
  return document.querySelector('button:has(img[alt="daycare"]), button:has(img[alt="Daycare"])');
}

function openDaycareFromHotkey() {
  // Inventory must be open for the daycare icon tab to exist (see Bestiary_Automator: inventory click, then daycare click).
  openInventorySubtabFromHotkey(
    findDaycareInventoryTabButton,
    '[Mod Settings] Daycare hotkey: daycare tab button not found after opening inventory'
  );
}

/** Arsenal tab: equipment container icon (img[src*="equipment-container"] or alt "equipments"). */
function findArsenalInventoryTabButton() {
  return findInventorySubtabButton(
    'img[src*="equipment-container"], img[alt="equipments"]',
    ['img[src*="equipment-container"]', 'img[alt="equipments"]']
  );
}

function openArsenalFromHotkey() {
  openInventorySubtabFromHotkey(
    findArsenalInventoryTabButton,
    '[Mod Settings] Arsenal hotkey: tab button not found after opening inventory'
  );
}

/** Monstrous Cauldron tab: sprite item id 43672. */
function findMonstrousCauldronInventoryTabButton() {
  return findInventorySubtabButton('.sprite.item.id-43672, img[alt="43672"]', [
    '.sprite.item.id-43672',
    'img[alt="43672"]'
  ]);
}

function openMonstrousCauldronFromHotkey() {
  openInventorySubtabFromHotkey(
    findMonstrousCauldronInventoryTabButton,
    '[Mod Settings] Monstrous Cauldron hotkey: tab button not found after opening inventory'
  );
}

/** Monster Squeezer tab (img[src*="monster-squeezer-portrait-mini"] or alt "monster squeezer"). */
function findMonsterSqueezerInventoryTabButton() {
  return findInventorySubtabButton(
    'img[src*="monster-squeezer-portrait-mini"], img[alt="monster squeezer"]',
    ['img[src*="monster-squeezer-portrait-mini"]', 'img[alt="monster squeezer"]']
  );
}

function openMonsterSqueezerFromHotkey() {
  openInventorySubtabFromHotkey(
    findMonsterSqueezerInventoryTabButton,
    '[Mod Settings] Monster Squeezer hotkey: tab button not found after opening inventory'
  );
}

/**
 * Bestiary tab inside Inventory: sprite item id 10327 (same as Depot Manager.getInventoryAnchorButton / Challenges.js).
 */
function findBestiaryInventoryTabButton() {
  return findInventorySubtabButton('.sprite.item.id-10327, img[alt="10327"]', [
    '.sprite.item.id-10327',
    'img[alt="10327"]'
  ]);
}

function openBestiaryFromHotkey() {
  openInventorySubtabFromHotkey(
    findBestiaryInventoryTabButton,
    '[Mod Settings] Bestiary hotkey: Bestiary tab button not found after opening inventory'
  );
}

/** Forge tab inside Inventory: forge-mini icon (img[src*="forge-mini"] or alt "the forge"). */
function findForgeInventoryTabButton() {
  return findInventorySubtabButton('img[src*="forge-mini"], img[alt="the forge"]', [
    'img[src*="forge-mini"]',
    'img[alt="the forge"]'
  ]);
}

function openForgeFromHotkey() {
  openInventorySubtabFromHotkey(
    findForgeInventoryTabButton,
    '[Mod Settings] Forge hotkey: Forge tab button not found after opening inventory'
  );
}

/** Mountain Fortress tab inside Inventory (img[src*="mountainfortress"] or alt "mountain fortress"). */
function findMountainFortressInventoryTabButton() {
  return findInventorySubtabButton('img[src*="mountainfortress"], img[alt="mountain fortress"]', [
    'img[src*="mountainfortress"]',
    'img[alt="mountain fortress"]'
  ]);
}

function openMountainFortressFromHotkey() {
  openInventorySubtabFromHotkey(
    findMountainFortressInventoryTabButton,
    '[Mod Settings] Mountain Fortress hotkey: tab button not found after opening inventory'
  );
}

/** Hy'genie tab inside Inventory: sprite item id 42363 (inventory slot button with .sprite.item.id-42363). */
function findHygenieInventoryTabButton() {
  return findInventorySubtabButton('.sprite.item.id-42363, img[alt="42363"]', [
    '.sprite.item.id-42363',
    'img[alt="42363"]'
  ]);
}

function openHygenieFromHotkey() {
  openInventorySubtabFromHotkey(
    findHygenieInventoryTabButton,
    "[Mod Settings] Hy'genie hotkey: tab button not found after opening inventory"
  );
}

/** Dr. Mephistopheles tab inside Inventory: doctor portrait (img[src*="doctor"] / alt "doctor"). */
function findDrMephistophelesInventoryTabButton() {
  return findInventorySubtabButton(
    'img[src*="doctor"], img[alt="doctor"], .sprite.item.id-50241, img[alt="50241"]',
    [
      'img[src*="/assets/misc/doctor.png"]',
      'img[alt="doctor"]',
      'img[src*="doctor"]',
      '.sprite.item.id-50241',
      'img[alt="50241"]'
    ]
  );
}

function openDrMephistophelesFromHotkey() {
  openInventorySubtabFromHotkey(
    findDrMephistophelesInventoryTabButton,
    '[Mod Settings] Dr. Mephistopheles hotkey: tab button not found after opening inventory'
  );
}

/** Runes tab inside Inventory: sprite item id 21445. */
function findRunesInventoryTabButton() {
  return findInventorySubtabButton('.sprite.item.id-21445, img[alt="21445"]', [
    '.sprite.item.id-21445',
    'img[alt="21445"]'
  ]);
}

function openRunesFromHotkey() {
  openInventorySubtabFromHotkey(
    findRunesInventoryTabButton,
    '[Mod Settings] Runes hotkey: tab button not found after opening inventory'
  );
}

/** Dragon Plant tab inside Inventory: sprite item id 37021. */
function findDragonPlantInventoryTabButton() {
  return findInventorySubtabButton('.sprite.item.id-37021, img[alt="37021"]', [
    '.sprite.item.id-37021',
    'img[alt="37021"]'
  ]);
}

function openDragonPlantFromHotkey() {
  openInventorySubtabFromHotkey(
    findDragonPlantInventoryTabButton,
    '[Mod Settings] Dragon Plant hotkey: tab button not found after opening inventory'
  );
}

/** Paw and Fur Society tab inside Inventory: sprite item id 35572. */
function findPawAndFurSocietyInventoryTabButton() {
  return findInventorySubtabButton('.sprite.item.id-35572, img[alt="35572"]', [
    '.sprite.item.id-35572',
    'img[alt="35572"]'
  ]);
}

function openPawAndFurSocietyFromHotkey() {
  openInventorySubtabFromHotkey(
    findPawAndFurSocietyInventoryTabButton,
    '[Mod Settings] Paw and Fur Society hotkey: tab button not found after opening inventory'
  );
}

/** Inventory ribbon portraits that have a matching Mod Settings hotkey (shown top-left on the slot). */
const INVENTORY_HOTKEY_BADGE_ENTRIES = [
  { configKey: 'hotkeyOpenArsenal', find: findArsenalInventoryTabButton },
  { configKey: 'hotkeyOpenBestiary', find: findBestiaryInventoryTabButton },
  { configKey: 'hotkeyOpenDaycare', find: findDaycareInventoryTabButton },
  { configKey: 'hotkeyOpenDragonPlant', find: findDragonPlantInventoryTabButton },
  { configKey: 'hotkeyOpenDrMephistopheles', find: findDrMephistophelesInventoryTabButton },
  { configKey: 'hotkeyOpenForge', find: findForgeInventoryTabButton },
  { configKey: 'hotkeyOpenHygenie', find: findHygenieInventoryTabButton },
  { configKey: 'hotkeyOpenMonsterSqueezer', find: findMonsterSqueezerInventoryTabButton },
  { configKey: 'hotkeyOpenMonstrousCauldron', find: findMonstrousCauldronInventoryTabButton },
  { configKey: 'hotkeyOpenMountainFortress', find: findMountainFortressInventoryTabButton },
  { configKey: 'hotkeyOpenPawAndFurSociety', find: findPawAndFurSocietyInventoryTabButton },
  { configKey: 'hotkeyOpenRunes', find: findRunesInventoryTabButton }
];

function ensureInventoryHotkeyBadgeStyle() {
  let styleEl = document.getElementById(INVENTORY_HOTKEY_BADGE_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = INVENTORY_HOTKEY_BADGE_STYLE_ID;
    document.documentElement.appendChild(styleEl);
  }
  const css =
    `.${INVENTORY_HOTKEY_BADGE_CLASS}{` +
    `position:absolute;top:1px;left:1px;z-index:4;pointer-events:none;` +
    `box-sizing:border-box;min-width:10px;padding:0 2px;` +
    `line-height:1.1;font-size:9px;font-weight:700;color:#fff;` +
    `font-family:'Yalla','Trebuchet MS',Arial,sans-serif;letter-spacing:0;` +
    `text-align:center;` +
    `background:rgba(0,0,0,0.72);border:1px solid rgba(0,0,0,0.9);` +
    `text-shadow:-1px 0 0 #000,1px 0 0 #000,0 -1px 0 #000,0 1px 0 #000;}`;
  if (styleEl.textContent !== css) styleEl.textContent = css;
}

function getInventorySlotHotkeyBadgeHost(button) {
  if (!(button instanceof HTMLElement)) return null;
  const slot =
    button.querySelector(':scope > .container-slot') || button.querySelector('.container-slot');
  if (!slot) return null;
  return (
    slot.querySelector(':scope > .has-rarity') ||
    slot.querySelector(':scope > .relative.grid') ||
    slot.querySelector(':scope > .relative') ||
    slot
  );
}

function clearInventoryHotkeyBadges(scope = document) {
  scope.querySelectorAll?.(`.${INVENTORY_HOTKEY_BADGE_CLASS}`)?.forEach((el) => el.remove());
}

/**
 * Show bound nav hotkeys on matching inventory portraits (top-left), when Hotkeys are enabled.
 */
function refreshInventoryHotkeyBadges() {
  ensureInventoryHotkeyBadgeStyle();
  const container = document.querySelector('.container-inventory-4');
  if (!container) return;

  if (!config.enableHotkeys) {
    clearInventoryHotkeyBadges(container);
    return;
  }

  const keptBadges = new Set();

  for (const { configKey, find } of INVENTORY_HOTKEY_BADGE_ENTRIES) {
    const boundId = sanitizeStoredHotkey(config[configKey], '');
    if (!boundId) continue;

    const label = formatHotkeyForDisplay(boundId, '');
    if (!label || label === '—') continue;

    let button = null;
    try {
      button = typeof find === 'function' ? find() : null;
    } catch (_) {
      button = null;
    }
    if (!(button instanceof HTMLElement) || !container.contains(button)) continue;

    const host = getInventorySlotHotkeyBadgeHost(button);
    if (!host) continue;

    if (host.style.position !== 'relative' && host.style.position !== 'absolute') {
      const computed = window.getComputedStyle?.(host)?.position;
      if (!computed || computed === 'static') {
        host.style.position = 'relative';
      }
    }

    let badge = host.querySelector(`:scope > .${INVENTORY_HOTKEY_BADGE_CLASS}`);
    if (!badge) {
      badge = document.createElement('span');
      badge.className = INVENTORY_HOTKEY_BADGE_CLASS;
      badge.setAttribute('translate', 'no');
      badge.setAttribute('aria-hidden', 'true');
      host.appendChild(badge);
    }
    if (badge.textContent !== label) badge.textContent = label;
    keptBadges.add(badge);
  }

  container.querySelectorAll(`.${INVENTORY_HOTKEY_BADGE_CLASS}`).forEach((el) => {
    if (!keptBadges.has(el)) el.remove();
  });
}

/** Same action as the Last Visited Map / Return to Map nav button (caller must gate on `showLastVisitedMapButton`). */
function triggerReturnToMapFromHotkey() {
  try {
    navigateToLastMap();
  } catch (error) {
    console.warn('[Mod Settings] Return to map hotkey failed:', error);
  }
}

function getCurrentRoomIdForHotkey() {
  try {
    const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
    const selectedRoom = boardContext?.selectedMap?.selectedRoom;
    const roomId = selectedRoom?.id;
    return typeof roomId === 'string' && roomId.length > 0 ? roomId : null;
  } catch (error) {
    console.warn('[Mod Settings] Could not read current room id for hotkey:', error);
    return null;
  }
}

function resetCurrentMapToDefaultFromHotkey() {
  const roomId = getCurrentRoomIdForHotkey();
  if (!roomId) {
    console.warn('[Mod Settings] Reset current map hotkey: current room id not found');
    return;
  }
  try {
    globalThis.state?.board?.send?.({
      type: 'selectRoomById',
      roomId
    });
  } catch (error) {
    console.warn('[Mod Settings] Reset current map hotkey failed:', error);
  }
}

function getCurrentBoardFloorForHotkey() {
  try {
    const floor = Number(globalThis.state?.board?.get?.()?.context?.floor);
    if (!Number.isFinite(floor)) return null;
    return Math.max(0, Math.min(15, Math.floor(floor)));
  } catch (error) {
    console.warn('[Mod Settings] Could not read current floor for hotkey:', error);
    return null;
  }
}

function setBoardFloorFromHotkey(nextFloor) {
  try {
    globalThis.state?.board?.trigger?.setState?.({
      fn: (prev) => ({ ...prev, floor: nextFloor })
    });
    return true;
  } catch (error) {
    console.warn('[Mod Settings] Could not set floor for hotkey:', error);
    return false;
  }
}

function changeFloorFromHotkey(delta) {
  const currentFloor = getCurrentBoardFloorForHotkey();
  if (currentFloor === null) return;
  const boundedFloor = Math.max(0, Math.min(15, currentFloor + delta));
  if (boundedFloor === currentFloor) return;
  setBoardFloorFromHotkey(boundedFloor);
}

function isInventorySubtabButtonActive(button) {
  if (!button) return false;
  if (button.getAttribute('aria-selected') === 'true') return true;
  if (button.getAttribute('aria-pressed') === 'true') return true;
  if (button.getAttribute('data-state') === 'open' || button.getAttribute('data-state') === 'active') return true;
  const className = typeof button.className === 'string' ? button.className : String(button.className || '');
  return className.includes('frame-pressed') || className.includes('surface-pressed');
}

function isElementVisibleForHotkey(element) {
  if (!element) return false;
  if (element.hidden) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (element.getClientRects().length === 0) return false;
  return true;
}

function findBestiaryEquipmentTabsForCycling() {
  const tabLists = Array.from(document.querySelectorAll('[role="tablist"]'))
    .filter((tabList) => isElementVisibleForHotkey(tabList));

  for (const tabList of tabLists) {
    const tabs = Array.from(tabList.querySelectorAll('button[role="tab"]'));
    const bestiaryTab =
      tabs.find((btn) => /-trigger-monster$/.test(btn.id || '')) ||
      tabs.find((btn) => (btn.textContent || '').trim().toLowerCase().includes('bestiary'));
    const equipmentTab =
      tabs.find((btn) => /-trigger-equip$/.test(btn.id || '')) ||
      tabs.find((btn) => {
        const label = (btn.textContent || '').trim().toLowerCase();
        return label.includes('arsenal') || label.includes('equipment');
      });
    if (!bestiaryTab || !equipmentTab) continue;
    if (!isElementVisibleForHotkey(bestiaryTab) || !isElementVisibleForHotkey(equipmentTab)) continue;
    return { bestiaryTab, equipmentTab };
  }

  return { bestiaryTab: null, equipmentTab: null };
}

function cycleBestiaryEquipmentTabFromHotkey() {
  const { bestiaryTab, equipmentTab } = findBestiaryEquipmentTabsForCycling();
  const bestiaryButton = bestiaryTab;
  const equipmentButton = equipmentTab;
  if (!bestiaryButton && !equipmentButton) {
    console.warn('[Mod Settings] Cycle Bestiary/Equipment hotkey: visible Bestiary/Arsenal tab pair not found');
    return;
  }
  const bestiaryActive = isInventorySubtabButtonActive(bestiaryButton);
  const equipmentActive = isInventorySubtabButtonActive(equipmentButton);
  const activeButton = bestiaryActive ? bestiaryButton : equipmentActive ? equipmentButton : bestiaryButton;
  const nextButton = activeButton === bestiaryButton ? equipmentButton : bestiaryButton;
  if (!nextButton) {
    console.warn('[Mod Settings] Cycle Bestiary/Equipment hotkey: next tab button missing');
    return;
  }
  activateTabButtonFromHotkey(nextButton);
}

function activateTabButtonFromHotkey(button) {
  if (!button) return;
  try {
    button.focus?.({ preventScroll: true });
  } catch (error) {
    // Focus is best effort only.
  }

  const pointerPayload = { bubbles: true, cancelable: true, composed: true };
  const mousePayload = { bubbles: true, cancelable: true, composed: true, button: 0 };

  // Some tab implementations react to pointer/mouse down rather than plain click.
  button.dispatchEvent(new PointerEvent('pointerdown', pointerPayload));
  button.dispatchEvent(new MouseEvent('mousedown', mousePayload));
  button.dispatchEvent(new PointerEvent('pointerup', pointerPayload));
  button.dispatchEvent(new MouseEvent('mouseup', mousePayload));
  button.dispatchEvent(new MouseEvent('click', mousePayload));

  if (button.getAttribute('aria-selected') === 'true') return;

  // Keyboard fallback for tab widgets that only switch on key interaction.
  // Keep events non-bubbling so global game hotkeys don't react to synthetic keys.
  button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: false, cancelable: true }));
  button.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: false, cancelable: true }));
  if (button.getAttribute('aria-selected') === 'true') return;

  button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: false, cancelable: true }));
  button.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: false, cancelable: true }));
}

const BATTLE_MODE_CYCLE_ORDER = ['manual', 'autoplay', 'sandbox'];

function cycleBattleStyleFromHotkey() {
  try {
    const board = globalThis.state?.board;
    const currentMode = board?.getSnapshot?.()?.context?.mode;
    const currentIdx = BATTLE_MODE_CYCLE_ORDER.indexOf(currentMode);
    const nextMode = BATTLE_MODE_CYCLE_ORDER[(currentIdx + 1) % BATTLE_MODE_CYCLE_ORDER.length];
    board?.send?.({ type: 'setPlayMode', mode: nextMode });
  } catch (error) {
    console.warn('[Mod Settings] Cycle battle style hotkey failed:', error);
  }
}

function getMapCycleRoomIdsForHotkey() {
  try {
    const roomsFromDatabase = globalThis.mapsDatabase?.getAllMaps?.();
    const roomsFromState = globalThis.state?.utils?.ROOMS;
    const rooms = Array.isArray(roomsFromDatabase) ? roomsFromDatabase : (Array.isArray(roomsFromState) ? roomsFromState : []);
    return rooms
      .map((room) => room?.id)
      .filter((roomId) => typeof roomId === 'string' && roomId.length > 0);
  } catch (error) {
    console.warn('[Mod Settings] Could not build ordered map list for hotkeys:', error);
    return [];
  }
}

function cycleMapFromHotkey(direction) {
  const roomIds = getMapCycleRoomIdsForHotkey();
  if (roomIds.length === 0) {
    console.warn('[Mod Settings] Map cycle hotkey: no maps available');
    return;
  }
  const currentRoomId = getCurrentRoomIdForHotkey();
  if (!currentRoomId) {
    console.warn('[Mod Settings] Map cycle hotkey: current room id not found');
    return;
  }
  const currentIndex = roomIds.indexOf(currentRoomId);
  if (currentIndex === -1) {
    console.warn('[Mod Settings] Map cycle hotkey: current room is not in ordered map list:', currentRoomId);
    return;
  }
  const step = direction === 'previous' ? -1 : 1;
  const targetIndex = (currentIndex + step + roomIds.length) % roomIds.length;
  const targetRoomId = roomIds[targetIndex];
  if (!targetRoomId || targetRoomId === currentRoomId) return;
  try {
    globalThis.state?.board?.send?.({
      type: 'selectRoomById',
      roomId: targetRoomId
    });
  } catch (error) {
    console.warn(`[Mod Settings] ${direction === 'previous' ? 'Previous' : 'Next'} map hotkey failed:`, error);
  }
}

function goToPreviousMapFromHotkey() {
  cycleMapFromHotkey('previous');
}

function goToNextMapFromHotkey() {
  cycleMapFromHotkey('next');
}

function findBoardControlButtonFromHotkey({
  texts,
  candidateSelector,
  requireManualSibling = false
}) {
  const candidates = document.querySelectorAll(candidateSelector);
  const matches = (button) => {
    if (!button || button.disabled) return false;
    const text = (button.textContent || '').trim().toLowerCase();
    if (!texts.some((t) => text === t || text.includes(t))) return false;
    let node = button.parentElement;
    while (node) {
      if (node.classList && node.classList.contains('sm:order-3')) return true;
      node = node.parentElement;
    }
    if (requireManualSibling) {
      const container = button.parentElement;
      return !!(container && container.querySelector('img[alt="Manual"]'));
    }
    return false;
  };
  for (const button of candidates) {
    if (matches(button)) return button;
  }
  for (const button of document.querySelectorAll('button')) {
    if (matches(button)) return button;
  }
  return null;
}

function findBoardStartButtonFromHotkey() {
  return findBoardControlButtonFromHotkey({
    texts: ['start', 'fight', 'iniciar', 'lutar', 'jogar', 'começar'],
    candidateSelector: 'button[data-full="false"][data-state="closed"]',
    requireManualSibling: true
  });
}

function findBoardSkipButtonFromHotkey() {
  return findBoardControlButtonFromHotkey({
    texts: ['skip', 'pular'],
    candidateSelector: 'button[data-full="false"][data-state="closed"]',
    requireManualSibling: false
  });
}

function findBoardStopButtonFromHotkey() {
  return findBoardControlButtonFromHotkey({
    texts: ['stop', 'parar'],
    candidateSelector: 'button[data-state="closed"]',
    requireManualSibling: false
  });
}

function triggerStartOrSkipFromHotkey() {
  const stopButton = findBoardStopButtonFromHotkey();
  if (stopButton) {
    stopButton.click();
    return;
  }
  const skipButton = findBoardSkipButtonFromHotkey();
  if (skipButton) {
    skipButton.click();
    return;
  }
  const startButton = findBoardStartButtonFromHotkey();
  if (startButton) {
    startButton.click();
    return;
  }
  console.warn('[Mod Settings] Start/Skip hotkey pressed but no matching board button was found');
}

const TURBO_MODE_MOD_NAME = 'Official Mods/Turbo Mode.js';
const BETTER_TELEPORTER_MOD_NAME = 'Super Mods/Better Teleporter.js';
const RUN_TRACKER_MOD_NAME = 'Super Mods/RunTracker.js';
const HUNT_ANALYZER_MOD_NAME = 'Super Mods/Hunt Analyzer.js';
const VIP_LIST_MOD_NAME = 'OT Mods/VIP List.js';
const DEPOT_MANAGER_MOD_NAME = 'Super Mods/Depot Manager.js';
const OT_MOD_REGISTRY_NAMES = [
  'OT Mods/Challenges.js',
  'OT Mods/Quests.js',
  'OT Mods/Guilds.js',
  'OT Mods/VIP List.js'
];
const QUESTS_MOD_NAME = 'OT Mods/Quests.js';

/** @type {((categoryId: string) => void) | null} */
let modSettingsSelectCategoryHandler = null;
/** @type {(() => void) | null} */
let modSettingsFirebaseUploadStateUpdater = null;
/** @type {(() => void) | null} */
let modSettingsModalLayoutCleanup = null;
/** @type {Array<() => void>} */
let modSettingsModalWatchCleanups = [];
/** @type {Array<() => void>} */
let modSettingsModalCoordinationUnsubscribers = [];
/** @type {{ close: () => void, element?: HTMLElement } | null} */
let modSettingsModalInstance = null;

function getLocalModByName(modName) {
  return Array.isArray(window.localMods)
    ? window.localMods.find((mod) => mod && mod.name === modName)
    : null;
}

function isLocalModEnabledInRegistry(modName) {
  return getLocalModByName(modName)?.enabled === true;
}

function isTurboModeModEnabled() {
  return isLocalModEnabledInRegistry(TURBO_MODE_MOD_NAME)
    || !!document.getElementById('turbo-mod-button');
}

function isRunTrackerModEnabled() {
  return isLocalModEnabledInRegistry(RUN_TRACKER_MOD_NAME)
    || (window.RunTrackerAPI && window.RunTrackerAPI._initialized === true);
}

function isHuntAnalyzerModEnabled() {
  return isLocalModEnabledInRegistry(HUNT_ANALYZER_MOD_NAME)
    || !!window.HuntAnalyzerState
    || !!window.HuntAnalyzerAPI;
}

function isVipListModEnabled() {
  return isLocalModEnabledInRegistry(VIP_LIST_MOD_NAME)
    || !!window.VIPList;
}

function isDepotManagerModEnabled() {
  return isLocalModEnabledInRegistry(DEPOT_MANAGER_MOD_NAME)
    || !!window.depotManager;
}

function isQuestsModEnabled() {
  return isLocalModEnabledInRegistry(QUESTS_MOD_NAME)
    || typeof window.resetAllQuests === 'function';
}

function isAnyOtModEnabled() {
  if (OT_MOD_REGISTRY_NAMES.some(isLocalModEnabledInRegistry)) {
    return true;
  }
  return !!(window.Challenges || window.Guilds || window.VIPList || isQuestsModEnabled());
}

function applyModDependentCheckboxRow({ disabledTitle, disabled, warningEl, labelEl, checkboxEl }) {
  if (warningEl) {
    warningEl.hidden = !disabled;
    warningEl.title = disabled ? disabledTitle : '';
    warningEl.style.display = disabled ? 'inline-flex' : 'none';
  }
  if (labelEl) {
    labelEl.style.opacity = disabled ? '0.5' : '1';
    labelEl.style.cursor = disabled ? 'not-allowed' : 'pointer';
    labelEl.title = disabled ? disabledTitle : '';
  }
  if (checkboxEl) {
    checkboxEl.disabled = disabled;
  }
}

function applyModDependentSection({ disabledTitle, disabled, sectionEl, warningEl, controlEls = [] }) {
  if (warningEl) {
    warningEl.hidden = !disabled;
    warningEl.title = disabled ? disabledTitle : '';
    warningEl.style.display = disabled ? 'inline-flex' : 'none';
  }
  if (sectionEl) {
    sectionEl.style.opacity = disabled ? '0.5' : '1';
    sectionEl.title = disabled ? disabledTitle : '';
  }
  for (const controlEl of controlEls) {
    if (!controlEl) continue;
    controlEl.disabled = disabled;
    controlEl.style.pointerEvents = disabled ? 'none' : 'auto';
    controlEl.title = disabled ? disabledTitle : '';
  }
}

const RUN_TRACKER_SETTINGS_DISABLED_TITLE =
  'Enable the Run Tracker mod for this setting to work.';
const FIREBASE_RUNS_SETTINGS_DISABLED_TITLE =
  'Enable the Run Tracker mod to upload or download best runs.';
const BACKUP_RUN_DATA_DISABLED_TITLE =
  'Enable the Run Tracker mod to include run data in backups.';
const BACKUP_HUNT_DATA_DISABLED_TITLE =
  'Enable the Hunt Analyzer mod to include hunt data in backups.';
const QUESTS_RESET_DISABLED_TITLE =
  'Enable the Quests mod to reset quest progress.';

function updateOtModsSettingsAvailability() {
  const disabled = !isQuestsModEnabled();
  applyModDependentSection({
    disabledTitle: QUESTS_RESET_DISABLED_TITLE,
    disabled,
    sectionEl: document.getElementById('ot-mods-quests-section'),
    warningEl: document.getElementById('reset-all-quests-unavailable-warning'),
    controlEls: [document.getElementById('reset-all-quests-btn')]
  });
}

function updateModSettingsMenuVisibility() {
  const leftMenu = document.getElementById('mod-settings-left-menu');
  if (!leftMenu) return;

  const modAvailabilityByCategory = {
    'depot-manager': isDepotManagerModEnabled(),
    'hunt-analyzer': isHuntAnalyzerModEnabled(),
    'vip-list': isVipListModEnabled(),
    'ot-mods': isAnyOtModEnabled()
  };

  let selectedCategory = leftMenu.dataset.selectedCategory || 'creatures';
  let needsReselect = false;

  leftMenu.querySelectorAll('[data-mod-settings-category]').forEach((menuItem) => {
    const categoryId = menuItem.dataset.modSettingsCategory;
    const requiresMod = menuItem.dataset.requiresMod === 'true';
    const available = !requiresMod || modAvailabilityByCategory[categoryId] === true;
    menuItem.hidden = !available;
    if (!available && categoryId === selectedCategory) {
      needsReselect = true;
    }
  });

  if (needsReselect && typeof modSettingsSelectCategoryHandler === 'function') {
    leftMenu.dataset.selectedCategory = 'creatures';
    modSettingsSelectCategoryHandler('creatures');
  }
}

function updateRunTrackerSettingsAvailability() {
  const disabled = !isRunTrackerModEnabled();
  applyModDependentCheckboxRow({
    disabledTitle: RUN_TRACKER_SETTINGS_DISABLED_TITLE,
    disabled,
    warningEl: document.getElementById('run-tracker-unavailable-warning'),
    labelEl: document.getElementById('run-tracker-toggle-label'),
    checkboxEl: document.getElementById('run-tracker-toggle')
  });
}

function updateFirebaseRunsSettingsAvailability() {
  const section = document.getElementById('firebase-runs-settings-section');
  const warning = document.getElementById('firebase-runs-unavailable-warning');
  const disabled = !isRunTrackerModEnabled();
  const controlEls = [
    document.getElementById('firebase-runs-upload-toggle'),
    document.getElementById('auto-upload-runs-toggle'),
    document.getElementById('firebase-runs-password'),
    document.getElementById('upload-runs-btn'),
    document.getElementById('download-runs-btn'),
    document.getElementById('delete-runs-btn'),
    ...(section ? Array.from(section.querySelectorAll('.firebase-upload-region-toggle')) : [])
  ];

  applyModDependentSection({
    disabledTitle: FIREBASE_RUNS_SETTINGS_DISABLED_TITLE,
    disabled,
    sectionEl: section,
    warningEl: warning,
    controlEls
  });

  if (!disabled && typeof modSettingsFirebaseUploadStateUpdater === 'function') {
    modSettingsFirebaseUploadStateUpdater();
  }
}

function updateBackupModExportAvailability() {
  const runTrackerDisabled = !isRunTrackerModEnabled();
  applyModDependentCheckboxRow({
    disabledTitle: BACKUP_RUN_DATA_DISABLED_TITLE,
    disabled: runTrackerDisabled,
    warningEl: document.getElementById('export-run-data-unavailable-warning'),
    labelEl: document.getElementById('export-run-data-label'),
    checkboxEl: document.getElementById('export-run-data')
  });

  const huntAnalyzerDisabled = !isHuntAnalyzerModEnabled();
  applyModDependentCheckboxRow({
    disabledTitle: BACKUP_HUNT_DATA_DISABLED_TITLE,
    disabled: huntAnalyzerDisabled,
    warningEl: document.getElementById('export-hunt-analyzer-unavailable-warning'),
    labelEl: document.getElementById('export-hunt-analyzer-label'),
    checkboxEl: document.getElementById('export-hunt-analyzer')
  });
}

function syncModDependentSettingsAvailability() {
  updateModSettingsMenuVisibility();
  updateReturnToMapHotkeyAvailability();
  updateTurboModeHotkeyAvailability();
  updateTurboSpeedSettingsAvailability();
  updateCyclopediaHotkeyAvailability();
  updateBetterTeleporterHotkeyAvailability();
  updateRunTrackerSettingsAvailability();
  updateFirebaseRunsSettingsAvailability();
  updateBackupModExportAvailability();
  updateOtModsSettingsAvailability();
}

const TURBO_SCRIPT_CONFIG_HASH = 'local_Official Mods/Turbo Mode.js';
const TURBO_DEFAULT_TICK_INTERVAL_MS = 62.5;
const TURBO_SPEED_SETTINGS_DISABLED_TITLE =
  'Enable the Turbo Mode mod to change turbo speed.';

function getTurboSpeedupFactor() {
  if (window.turboMode && typeof window.turboMode.getSpeed === 'function') {
    return Math.max(window.turboMode.getSpeed(), 2);
  }
  return Math.max(window.__turboState?.speedupFactor ?? 5, 2);
}

function setTurboSpeedupFactor(newFactor) {
  const value = Math.max(2, Math.min(10, parseInt(newFactor, 10) || 5));
  if (window.turboMode && typeof window.turboMode.setSpeed === 'function') {
    window.turboMode.setSpeed(value);
    return;
  }
  if (window.__turboState) {
    window.__turboState.speedupFactor = value;
  }
  const speedLabel = document.getElementById('turbo-speed-value');
  if (speedLabel) {
    speedLabel.textContent = `${value}x`;
  }
  if (typeof api !== 'undefined' && api?.service?.updateScriptConfig) {
    api.service.updateScriptConfig(TURBO_SCRIPT_CONFIG_HASH, {
      active: window.__turboState?.active ?? false,
      speedupFactor: value
    });
  }
}

function updateTurboSpeedSettingsAvailability() {
  const section = document.getElementById('turbo-speed-settings-section');
  const warning = document.getElementById('turbo-speed-settings-unavailable-warning');
  const slider = document.getElementById('turbo-speed-slider');
  const disabled = !isTurboModeModEnabled();

  if (warning) {
    warning.hidden = !disabled;
    warning.title = disabled ? TURBO_SPEED_SETTINGS_DISABLED_TITLE : '';
  }
  if (section) {
    section.style.opacity = disabled ? '0.5' : '1';
    section.title = disabled ? TURBO_SPEED_SETTINGS_DISABLED_TITLE : '';
  }
  if (slider) {
    slider.disabled = disabled;
    slider.style.pointerEvents = disabled ? 'none' : 'auto';
    slider.title = disabled ? TURBO_SPEED_SETTINGS_DISABLED_TITLE : '';
  }
}

function triggerToggleTurboModeFromHotkey() {
  if (!isTurboModeModEnabled()) {
    console.warn('[Mod Settings] Turbo Mode toggle hotkey pressed but Turbo Mode mod is disabled');
    return;
  }

  const turboButton = document.getElementById('turbo-mod-button');
  if (turboButton && typeof turboButton.click === 'function' && !turboButton.disabled) {
    turboButton.click();
    return;
  }

  console.warn('[Mod Settings] Turbo Mode toggle hotkey pressed but Turbo Mode button was not available');
}

function isCyclopediaModEnabled() {
  return typeof window.__cyclopediaOpen === 'function'
    || !!document.querySelector('.cyclopedia-header-btn');
}

function openCyclopediaFromHotkey() {
  if (!isCyclopediaModEnabled()) {
    console.warn('[Mod Settings] Cyclopedia hotkey pressed but Cyclopedia mod is disabled');
    return;
  }
  if (typeof window.__cyclopediaOpen === 'function') {
    window.__cyclopediaOpen();
    return;
  }
  const cyclopediaButton = document.querySelector('.cyclopedia-header-btn');
  if (cyclopediaButton && typeof cyclopediaButton.click === 'function' && !cyclopediaButton.disabled) {
    cyclopediaButton.click();
    return;
  }
  console.warn('[Mod Settings] Cyclopedia hotkey pressed but Cyclopedia button was not available');
}

function isBetterTeleporterModEnabled() {
  return isLocalModEnabledInRegistry(BETTER_TELEPORTER_MOD_NAME)
    || typeof window.__betterTeleporterOpen === 'function';
}

function openBetterTeleporterFromHotkey() {
  if (isBetterTeleporterModEnabled()) {
    if (typeof window.__betterTeleporterOpen === 'function') {
      window.__betterTeleporterOpen();
      return;
    }
    console.warn('[Mod Settings] Better Teleporter hotkey pressed but teleporter open handler was not available');
    return;
  }
  openGnomishTeleporterFromHotkey();
}

/** Native board Manual (goto) buttons used by the in-game Gnomish Teleporter. */
function findGnomishTeleporterGotoButtons() {
  const buttons = [];
  const seen = new Set();
  for (const img of document.querySelectorAll('button img[src*="goto.png"][alt="Manual"]')) {
    const btn = img.closest('button');
    if (!btn || btn.closest('[role="dialog"]') || seen.has(btn)) continue;
    seen.add(btn);
    buttons.push(btn);
  }
  return buttons;
}

function openGnomishTeleporterFromHotkey() {
  const buttons = findGnomishTeleporterGotoButtons();
  for (const button of buttons) {
    try {
      button.click();
      return;
    } catch (error) {
      console.warn('[Mod Settings] Gnomish Teleport hotkey: failed to click goto button:', error);
    }
  }
  console.warn('[Mod Settings] Gnomish Teleport hotkey: goto button not found');
}

/**
 * Ordered Setup/Save buttons from the stored-setups bar (same detection as Better Setups.js).
 * @returns {HTMLButtonElement[]}
 */
function findBetterSetupMainActionButtonsInOrder() {
  const setupContainer = document.querySelector('.mb-2.flex.items-center.gap-2');
  if (!setupContainer) return [];
  const out = [];
  for (const btn of setupContainer.querySelectorAll('button')) {
    const label = (btn.textContent || '').trim();
    if (!label.includes('Setup (') && !label.includes('Save (')) continue;
    if (btn.classList.contains('edit-label-btn')) continue;
    out.push(btn);
  }
  return out;
}

function clickBetterSetupSlotFromHotkey(zeroBasedSlotIndex) {
  const buttons = findBetterSetupMainActionButtonsInOrder();
  const btn = buttons[zeroBasedSlotIndex];
  if (!btn) {
    console.warn(
      `[Mod Settings] Setup hotkey slot ${zeroBasedSlotIndex + 1}: no matching button (found ${buttons.length} setup/save button(s))`
    );
    return;
  }
  const setupName = getBetterSetupSlotDisplayName(btn, zeroBasedSlotIndex);
  btn.click();
  showSetupLoadedFromHotkeyToast(setupName);
}

/**
 * Setup Manager map shortcut buttons for non-auto-setup saved setups only.
 * Skips Auto-Setup and any saved setup that matches Auto-setup (those stay on hotkeyAutoSetup / U).
 * @returns {HTMLButtonElement[]}
 */
function findSetupManagerSavedSetupButtonsInOrder() {
  const buttons = document.querySelectorAll('button.setup-manager-map-shortcut-btn');
  const out = [];
  for (const btn of buttons) {
    if ((btn.dataset.setupName || '') === 'Auto-Setup') continue;
    if (btn.dataset.matchesAutoSetup === 'true') continue;
    out.push(btn);
  }
  return out;
}

function clickSetupManagerSlotFromHotkey(zeroBasedSlotIndex) {
  const buttons = findSetupManagerSavedSetupButtonsInOrder();
  const btn = buttons[zeroBasedSlotIndex];
  if (!btn) {
    console.warn(
      `[Mod Settings] Setup Manager hotkey slot ${zeroBasedSlotIndex + 1}: no matching saved setup button (found ${buttons.length})`
    );
    return;
  }
  // Setup Manager's own click handler already toasts "Successfully loaded {name}".
  btn.click();
}

function clickSetupSlotFromHotkey(zeroBasedSlotIndex) {
  if (config.hotkeySetupSource === 'setupManager') {
    clickSetupManagerSlotFromHotkey(zeroBasedSlotIndex);
    return;
  }
  clickBetterSetupSlotFromHotkey(zeroBasedSlotIndex);
}

function escapeHtmlForToast(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getBetterSetupSlotDisplayName(btn, zeroBasedSlotIndex) {
  const label = ((btn && btn.textContent) || '').replace(/\s+/g, ' ').trim();
  const match = label.match(/(?:Setup|Save)\s*\(([^)]*)\)/i);
  if (match) {
    const inner = (match[1] || '').trim();
    if (inner) return inner;
  }
  if (label) return label;
  return `Setup ${zeroBasedSlotIndex + 1}`;
}

function showSetupLoadedFromHotkeyToast(setupName) {
  const name = String(setupName || '').trim();
  if (!name) return;
  try {
    createToast({
      message: `<span class="text-success">${tReplace('mods.betterUI.hotkeySetupLoaded', {
        name: escapeHtmlForToast(name)
      })}</span>`,
      type: 'success',
      duration: 3000
    });
  } catch (error) {
    console.warn('[Mod Settings] Could not show setup loaded toast:', error);
  }
}

/**
 * Find the game Auto-setup button (same detection as Stamina Optimizer's findAutoSetupButton).
 * @returns {HTMLButtonElement|null}
 */
function findAutoSetupButtonFromHotkey() {
  const autoSetupTexts = [
    t('mods.betterTasker.autoSetup'),
    t('mods.betterBoostedMaps.autoSetup'),
    t('mods.raidHunter.autoSetup'),
    'Auto-setup',
    'Auto setup',
    'Autosetup',
    'Autoconfigurar'
  ]
    .filter((text) => typeof text === 'string' && text.trim() && !text.includes('.'))
    .map((text) => text.trim().toLowerCase());

  for (const button of document.querySelectorAll('button')) {
    const buttonText = (button.textContent || '').trim();
    const normalizedText = buttonText.toLowerCase();
    const hasAutoSetupText = autoSetupTexts.some((candidate) => normalizedText.includes(candidate));
    const hasWandIcon = !!button.querySelector('svg.lucide-wand-sparkles');
    if (hasAutoSetupText || (hasWandIcon && normalizedText.includes('auto'))) {
      return button;
    }
  }
  return null;
}

function clickAutoSetupFromHotkey() {
  const btn = findAutoSetupButtonFromHotkey();
  if (!btn) {
    console.warn('[Mod Settings] Auto-setup hotkey pressed but Auto-setup button was not found');
    return;
  }
  btn.click();
  showSetupLoadedFromHotkeyToast(t('mods.betterUI.hotkeyLabelAutoSetup'));
}

/**
 * General navigation hotkeys: single source for English UI order, `config` keys, modal capture button IDs, and keydown dispatch.
 */
const NAV_HOTKEY_ENTRIES = [
  {
    configKey: 'hotkeyOpenArsenal',
    captureId: 'hotkey-open-arsenal-capture-btn',
    resetId: 'hotkey-open-arsenal-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelArsenal',
    initialDisplay: 'A',
    open: openArsenalFromHotkey
  },
  {
    configKey: 'hotkeyOpenBestiary',
    captureId: 'hotkey-open-bestiary-capture-btn',
    resetId: 'hotkey-open-bestiary-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelBestiary',
    initialDisplay: 'B',
    open: openBestiaryFromHotkey
  },
  {
    configKey: 'hotkeyOpenDaycare',
    captureId: 'hotkey-open-daycare-capture-btn',
    resetId: 'hotkey-open-daycare-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelDaycare',
    initialDisplay: 'D',
    open: openDaycareFromHotkey
  },
  {
    configKey: 'hotkeyOpenDragonPlant',
    captureId: 'hotkey-open-dragon-plant-capture-btn',
    resetId: 'hotkey-open-dragon-plant-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelDragonPlant',
    initialDisplay: 'L',
    open: openDragonPlantFromHotkey
  },
  {
    configKey: 'hotkeyOpenDrMephistopheles',
    captureId: 'hotkey-open-dr-mephistopheles-capture-btn',
    resetId: 'hotkey-open-dr-mephistopheles-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelDrMephistopheles',
    initialDisplay: 'E',
    open: openDrMephistophelesFromHotkey
  },
  {
    configKey: 'hotkeyOpenForge',
    captureId: 'hotkey-open-forge-capture-btn',
    resetId: 'hotkey-open-forge-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelForge',
    initialDisplay: 'F',
    open: openForgeFromHotkey
  },
  {
    configKey: 'hotkeyOpenHygenie',
    captureId: 'hotkey-open-hygenie-capture-btn',
    resetId: 'hotkey-open-hygenie-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelHygenie',
    initialDisplay: 'H',
    open: openHygenieFromHotkey
  },
  {
    configKey: 'hotkeyOpenInventory',
    captureId: 'hotkey-open-inventory-capture-btn',
    resetId: 'hotkey-open-inventory-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelOpenInventory',
    initialDisplay: 'I',
    open: openInventoryFromHotkey
  },
  {
    configKey: 'hotkeyOpenMonsterSqueezer',
    captureId: 'hotkey-open-monster-squeezer-capture-btn',
    resetId: 'hotkey-open-monster-squeezer-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelMonsterSqueezer',
    initialDisplay: 'X',
    open: openMonsterSqueezerFromHotkey
  },
  {
    configKey: 'hotkeyOpenMonstrousCauldron',
    captureId: 'hotkey-open-monstrous-cauldron-capture-btn',
    resetId: 'hotkey-open-monstrous-cauldron-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelMonstrousCauldron',
    initialDisplay: 'O',
    open: openMonstrousCauldronFromHotkey
  },
  {
    configKey: 'hotkeyOpenMountainFortress',
    captureId: 'hotkey-open-mountain-fortress-capture-btn',
    resetId: 'hotkey-open-mountain-fortress-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelMountainFortress',
    initialDisplay: 'M',
    open: openMountainFortressFromHotkey
  },
  {
    configKey: 'hotkeyOpenPawAndFurSociety',
    captureId: 'hotkey-open-paw-and-fur-society-capture-btn',
    resetId: 'hotkey-open-paw-and-fur-society-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelPawAndFurSociety',
    initialDisplay: 'W',
    open: openPawAndFurSocietyFromHotkey
  },
  {
    configKey: 'hotkeyOpenQuestLog',
    captureId: 'hotkey-open-quest-log-capture-btn',
    resetId: 'hotkey-open-quest-log-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelOpenQuestLog',
    initialDisplay: 'Q',
    open: openQuestLogFromHotkey
  },
  {
    configKey: 'hotkeyOpenRunes',
    captureId: 'hotkey-open-runes-capture-btn',
    resetId: 'hotkey-open-runes-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelRunes',
    initialDisplay: 'N',
    open: openRunesFromHotkey
  },
  {
    configKey: 'hotkeyOpenStore',
    captureId: 'hotkey-open-store-capture-btn',
    resetId: 'hotkey-open-store-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelOpenStore',
    initialDisplay: 'S',
    open: openStoreFromHotkey
  },
  {
    configKey: 'hotkeyOpenTrophyRoom',
    captureId: 'hotkey-open-trophy-room-capture-btn',
    resetId: 'hotkey-open-trophy-room-reset-btn',
    labelKey: 'mods.betterUI.hotkeyLabelTrophyRoom',
    initialDisplay: 'T',
    open: openTrophyRoomFromHotkey
  }
];

const NAV_HOTKEY_BINDING_KEYS = NAV_HOTKEY_ENTRIES.map((e) => e.configKey);
const HOTKEY_ALLOWLIST_DURING_BATTLE_KEYS = [
  ...NAV_HOTKEY_BINDING_KEYS,
  'hotkeyCycleBestiaryEquipmentTab',
  'hotkeyStartOrSkip'
];
const NAV_HOTKEY_UI_ROWS = NAV_HOTKEY_ENTRIES.map(({ configKey, captureId, resetId, labelKey, initialDisplay }) => ({
  configKey,
  captureId,
  resetId,
  labelKey,
  initialDisplay,
  displayFallback: ''
}));

const MODAL_HOTKEY_WHITELIST = Object.freeze([
  {
    modPath: 'mods/Super Mods/Better Analytics.js',
    isActive: () => {
      // Better Analytics piggybacks on the Impact Analyzer open panel.
      return Boolean(document.querySelector('div[data-state="open"] button[aria-controls*="ally"]'));
    }
  }
]);

function isHotkeyAllowlistedDuringBattle(pressedId) {
  if (!pressedId) return false;
  for (const configKey of HOTKEY_ALLOWLIST_DURING_BATTLE_KEYS) {
    const boundId = sanitizeStoredHotkey(config[configKey], '');
    if (boundId && pressedId === boundId) return true;
  }
  return false;
}

function isAnyModalOpenForHotkeyBlocking() {
  const candidates = document.querySelectorAll(
    [
      '[role="dialog"][data-state="open"]',
      '[role="alertdialog"][data-state="open"]',
      '.modal[data-state="open"]',
      '.modal-overlay',
      '.modal-bg'
    ].join(', ')
  );
  for (const node of candidates) {
    if (!node || !(node instanceof Element)) continue;
    const style = window.getComputedStyle(node);
    if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
      return true;
    }
  }
  return false;
}

function isWhitelistedModalContextActive() {
  for (const entry of MODAL_HOTKEY_WHITELIST) {
    try {
      if (typeof entry?.isActive === 'function' && entry.isActive() === true) {
        return true;
      }
    } catch (error) {
      console.warn('[Mod Settings] Modal whitelist check failed for', entry?.modPath || 'unknown mod', error);
    }
  }
  return false;
}

function handleGlobalHotkeys(event) {
  if (!event || event.repeat) return;
  // Ignore synthetic keyboard events dispatched by mods/scripts.
  // This prevents tab-activation fallback key events from re-triggering global hotkeys.
  if (event.isTrusted === false) return;
  if (!config.enableHotkeys) return;
  if (hotkeysState.hotkeyCaptureMode !== null) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTypingIntoInput(event.target)) return;
  if (isAnyModalOpenForHotkeyBlocking() && !isWhitelistedModalContextActive()) return;

  const pressedId = normalizeHotkeyIdentifierFromKey(event.key);
  if (!pressedId) return;
  if (isBattleActiveForHotkeys() && !isHotkeyAllowlistedDuringBattle(pressedId)) return;

  for (const { configKey, open } of NAV_HOTKEY_ENTRIES) {
    const boundId = sanitizeStoredHotkey(config[configKey], '');
    if (boundId && pressedId === boundId) {
      event.preventDefault();
      event.stopPropagation();
      open();
      return;
    }
  }
  const returnMapId = sanitizeStoredHotkey(config.hotkeyReturnToMap, '');
  if (returnMapId && pressedId === returnMapId) {
    if (!config.showLastVisitedMapButton) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey) {
      goToNextMapFromHotkey();
    } else {
      triggerReturnToMapFromHotkey();
    }
    return;
  }
  const floorUpId = sanitizeStoredHotkey(config.hotkeyFloorUp, '');
  if (floorUpId && pressedId === floorUpId) {
    event.preventDefault();
    event.stopPropagation();
    changeFloorFromHotkey(1);
    return;
  }
  const floorDownId = sanitizeStoredHotkey(config.hotkeyFloorDown, '');
  if (floorDownId && pressedId === floorDownId) {
    event.preventDefault();
    event.stopPropagation();
    changeFloorFromHotkey(-1);
    return;
  }
  const cycleBestiaryEquipmentId = sanitizeStoredHotkey(config.hotkeyCycleBestiaryEquipmentTab, '');
  if (cycleBestiaryEquipmentId && pressedId === cycleBestiaryEquipmentId) {
    event.preventDefault();
    event.stopPropagation();
    cycleBestiaryEquipmentTabFromHotkey();
    return;
  }
  const resetCurrentMapId = sanitizeStoredHotkey(config.hotkeyResetCurrentMapDefault, '');
  if (resetCurrentMapId && pressedId === resetCurrentMapId) {
    event.preventDefault();
    event.stopPropagation();
    resetCurrentMapToDefaultFromHotkey();
    return;
  }
  const cycleBattleStyleId = sanitizeStoredHotkey(config.hotkeyCycleBattleStyle, '');
  if (cycleBattleStyleId && pressedId === cycleBattleStyleId) {
    event.preventDefault();
    event.stopPropagation();
    cycleBattleStyleFromHotkey();
    return;
  }
  const previousMapId = sanitizeStoredHotkey(config.hotkeyPreviousMap, '');
  if (previousMapId && pressedId === previousMapId) {
    event.preventDefault();
    event.stopPropagation();
    goToPreviousMapFromHotkey();
    return;
  }
  const nextMapId = sanitizeStoredHotkey(config.hotkeyNextMap, '');
  if (nextMapId && pressedId === nextMapId) {
    event.preventDefault();
    event.stopPropagation();
    goToNextMapFromHotkey();
    return;
  }
  const startOrSkipId = sanitizeStoredHotkey(config.hotkeyStartOrSkip, '');
  if (startOrSkipId && pressedId === startOrSkipId) {
    event.preventDefault();
    event.stopPropagation();
    triggerStartOrSkipFromHotkey();
    return;
  }
  const toggleTurboModeId = sanitizeStoredHotkey(config.hotkeyToggleTurboMode, '');
  if (toggleTurboModeId && pressedId === toggleTurboModeId) {
    event.preventDefault();
    event.stopPropagation();
    triggerToggleTurboModeFromHotkey();
    return;
  }
  const openCyclopediaId = sanitizeStoredHotkey(config.hotkeyOpenCyclopedia, '');
  if (openCyclopediaId && pressedId === openCyclopediaId) {
    event.preventDefault();
    event.stopPropagation();
    openCyclopediaFromHotkey();
    return;
  }
  const openBetterTeleporterId = sanitizeStoredHotkey(config.hotkeyOpenBetterTeleporter, '');
  if (openBetterTeleporterId && pressedId === openBetterTeleporterId) {
    event.preventDefault();
    event.stopPropagation();
    openBetterTeleporterFromHotkey();
    return;
  }
  const autoSetupId = sanitizeStoredHotkey(config.hotkeyAutoSetup, '');
  if (autoSetupId && pressedId === autoSetupId) {
    event.preventDefault();
    event.stopPropagation();
    clickAutoSetupFromHotkey();
    return;
  }
  for (let i = 0; i < 8; i++) {
    const setupCfgKey = `hotkeySetupSlot${i + 1}`;
    const setupKeyId = sanitizeStoredHotkey(config[setupCfgKey], '');
    if (setupKeyId && pressedId === setupKeyId) {
      event.preventDefault();
      event.stopPropagation();
      clickSetupSlotFromHotkey(i);
      return;
    }
  }
}

function initHotkeys() {
  if (hotkeysState.keydownListener) {
    window.removeEventListener('keydown', hotkeysState.keydownListener, true);
  }

  hotkeysState.keydownListener = handleGlobalHotkeys;
  window.addEventListener('keydown', hotkeysState.keydownListener, true);
}

function cleanupHotkeys() {
  if (typeof hotkeysState.detachHotkeyCapture === 'function') {
    hotkeysState.detachHotkeyCapture();
  }
  if (!hotkeysState.keydownListener) return;
  window.removeEventListener('keydown', hotkeysState.keydownListener, true);
  hotkeysState.keydownListener = null;
}

const HOTKEY_CAPTURE_IDLE_CLASS =
  'focus-style-visible hotkey-capture-btn pixel-font-14 flex shrink-0 cursor-pointer items-center justify-center tracking-wide text-whiteRegular frame-1 surface-regular px-2 py-0.5 pb-[3px]';
const HOTKEY_CAPTURE_ACTIVE_CLASS =
  'focus-style-visible hotkey-capture-btn pixel-font-14 flex shrink-0 cursor-pointer items-center justify-center tracking-wide text-whiteExp frame-pressed-1 surface-regular px-2 py-0.5 pb-[3px]';
const HOTKEY_RESET_BUTTON_CLASS =
  'focus-style-visible hotkey-reset-btn pixel-font-14 frame-1 active:frame-pressed-1 surface-regular px-2 py-0.5 pb-[3px] text-whiteRegular';
const RETURN_TO_MAP_HOTKEY_DISABLED_TITLE =
  'Enable "Show Return to Map Button" in Interface for this hotkey to work.';
const TURBO_MODE_HOTKEY_DISABLED_TITLE =
  'Enable the Turbo Mode mod for this hotkey to work.';
const CYCLOPEDIA_HOTKEY_DISABLED_TITLE =
  'Enable the Cyclopedia mod for this hotkey to work.';

const HOTKEY_BATTLE_UI_ROWS = [
  {
    configKey: 'hotkeyFloorUp',
    captureId: 'hotkey-floor-up-capture-btn',
    resetId: 'hotkey-floor-up-reset-btn',
    displayFallback: '',
    labelText: 'Floor up',
    initialDisplay: 'PageUp',
    marginTop: true
  },
  {
    configKey: 'hotkeyFloorDown',
    captureId: 'hotkey-floor-down-capture-btn',
    resetId: 'hotkey-floor-down-reset-btn',
    displayFallback: '',
    labelText: 'Floor down',
    initialDisplay: 'PageDown',
    marginTop: true
  },
  {
    configKey: 'hotkeyCycleBestiaryEquipmentTab',
    captureId: 'hotkey-cycle-bestiary-equipment-capture-btn',
    resetId: 'hotkey-cycle-bestiary-equipment-reset-btn',
    displayFallback: '',
    labelText: 'Cycle Bestiary/Equipment tab',
    initialDisplay: 'Tab',
    marginTop: true
  },
  {
    configKey: 'hotkeyCycleBattleStyle',
    captureId: 'hotkey-cycle-battle-style-capture-btn',
    resetId: 'hotkey-cycle-battle-style-reset-btn',
    displayFallback: '',
    labelText: 'Cycle battle style',
    initialDisplay: 'V',
    marginTop: true
  },
  {
    configKey: 'hotkeyPreviousMap',
    captureId: 'hotkey-previous-map-capture-btn',
    resetId: 'hotkey-previous-map-reset-btn',
    displayFallback: '',
    labelText: 'Previous map',
    initialDisplay: 'J',
    marginTop: true
  },
  {
    configKey: 'hotkeyNextMap',
    captureId: 'hotkey-next-map-capture-btn',
    resetId: 'hotkey-next-map-reset-btn',
    displayFallback: '',
    labelText: 'Next map',
    initialDisplay: 'K',
    marginTop: true
  },
  {
    configKey: 'hotkeyStartOrSkip',
    captureId: 'hotkey-start-or-skip-capture-btn',
    resetId: 'hotkey-start-or-skip-reset-btn',
    displayFallback: '',
    labelText: 'Start/Skip button',
    initialDisplay: 'Z',
    marginTop: true
  },
  {
    configKey: 'hotkeyResetCurrentMapDefault',
    captureId: 'hotkey-reset-current-map-capture-btn',
    resetId: 'hotkey-reset-current-map-reset-btn',
    displayFallback: '',
    labelKey: 'mods.betterUI.hotkeyLabelResetCurrentMapDefault',
    initialDisplay: 'R',
    marginTop: true
  }
];

const HOTKEY_MODS_GATED_UI_ROWS = [
  {
    configKey: 'hotkeyReturnToMap',
    captureId: 'hotkey-return-to-map-capture-btn',
    resetId: 'hotkey-return-to-map-reset-btn',
    displayFallback: '',
    initialDisplay: 'G',
    marginTop: false,
    rowId: 'hotkey-return-to-map-row',
    labelId: 'hotkey-return-to-map-label'
  },
  {
    configKey: 'hotkeyToggleTurboMode',
    captureId: 'hotkey-toggle-turbo-mode-capture-btn',
    resetId: 'hotkey-toggle-turbo-mode-reset-btn',
    displayFallback: '',
    initialDisplay: 'Y',
    marginTop: true,
    rowId: 'hotkey-toggle-turbo-mode-row',
    labelId: 'hotkey-toggle-turbo-mode-label'
  },
  {
    configKey: 'hotkeyOpenCyclopedia',
    captureId: 'hotkey-open-cyclopedia-capture-btn',
    resetId: 'hotkey-open-cyclopedia-reset-btn',
    displayFallback: '',
    initialDisplay: 'C',
    marginTop: true,
    rowId: 'hotkey-open-cyclopedia-row',
    labelId: 'hotkey-open-cyclopedia-label'
  },
  {
    configKey: 'hotkeyOpenBetterTeleporter',
    captureId: 'hotkey-open-better-teleporter-capture-btn',
    resetId: 'hotkey-open-better-teleporter-reset-btn',
    displayFallback: '',
    initialDisplay: 'P',
    marginTop: true,
    rowId: 'hotkey-open-better-teleporter-row',
    labelId: 'hotkey-open-better-teleporter-label'
  }
];

function getModsGatedHotkeyLabelHtml(row) {
  switch (row.configKey) {
    case 'hotkeyReturnToMap':
      return `
                  <span id="hotkey-return-to-map-unavailable-warning" hidden style="cursor: help; margin-right: 6px; color: #f0c36d; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">⚠️</span>
                  ${t('mods.betterUI.hotkeyLabelReturnToMap')}
                  <span style="cursor: help; margin-left: 6px; color: #ffffff; font-size: 10px; display: inline-flex; align-items: center; justify-content: center; width: 12px; height: 12px; border: 1px solid #ffffff; border-radius: 50%; line-height: 1;" title="Shift + hotkey goes forward in map history">i</span>
                `;
    case 'hotkeyToggleTurboMode':
      return `
                  <span id="hotkey-toggle-turbo-mode-unavailable-warning" hidden style="cursor: help; margin-right: 6px; color: #f0c36d; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">⚠️</span>
                  Toggle Turbo Mode
                `;
    case 'hotkeyOpenCyclopedia':
      return `
                  <span id="hotkey-open-cyclopedia-unavailable-warning" hidden style="cursor: help; margin-right: 6px; color: #f0c36d; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">⚠️</span>
                  ${t('mods.betterUI.hotkeyLabelCyclopedia')}
                `;
    case 'hotkeyOpenBetterTeleporter':
      return `
                  <span id="hotkey-open-better-teleporter-unavailable-warning" hidden style="cursor: help; margin-right: 6px; color: #f0c36d; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">⚠️</span>
                  <span id="hotkey-open-better-teleporter-name">${t('mods.betterUI.hotkeyLabelBetterTeleporter')}</span>
                `;
    default:
      return '';
  }
}

const MODS_HOTKEY_UI_ROWS = HOTKEY_BATTLE_UI_ROWS.concat(HOTKEY_MODS_GATED_UI_ROWS);

const SETUP_HOTKEY_UI_ROWS = [
  { configKey: 'hotkeyAutoSetup', captureId: 'hotkey-auto-setup-capture-btn', resetId: 'hotkey-auto-setup-reset-btn', displayFallback: '' },
  { configKey: 'hotkeySetupSlot1', captureId: 'hotkey-setup-slot-1-capture-btn', resetId: 'hotkey-setup-slot-1-reset-btn', displayFallback: '' },
  { configKey: 'hotkeySetupSlot2', captureId: 'hotkey-setup-slot-2-capture-btn', resetId: 'hotkey-setup-slot-2-reset-btn', displayFallback: '' },
  { configKey: 'hotkeySetupSlot3', captureId: 'hotkey-setup-slot-3-capture-btn', resetId: 'hotkey-setup-slot-3-reset-btn', displayFallback: '' },
  { configKey: 'hotkeySetupSlot4', captureId: 'hotkey-setup-slot-4-capture-btn', resetId: 'hotkey-setup-slot-4-reset-btn', displayFallback: '' },
  { configKey: 'hotkeySetupSlot5', captureId: 'hotkey-setup-slot-5-capture-btn', resetId: 'hotkey-setup-slot-5-reset-btn', displayFallback: '' },
  { configKey: 'hotkeySetupSlot6', captureId: 'hotkey-setup-slot-6-capture-btn', resetId: 'hotkey-setup-slot-6-reset-btn', displayFallback: '' },
  { configKey: 'hotkeySetupSlot7', captureId: 'hotkey-setup-slot-7-capture-btn', resetId: 'hotkey-setup-slot-7-reset-btn', displayFallback: '' },
  { configKey: 'hotkeySetupSlot8', captureId: 'hotkey-setup-slot-8-capture-btn', resetId: 'hotkey-setup-slot-8-reset-btn', displayFallback: '' }
];

const MODS_HOTKEY_BINDING_KEYS = MODS_HOTKEY_UI_ROWS.map((r) => r.configKey);
const SETUP_HOTKEY_BINDING_KEYS = SETUP_HOTKEY_UI_ROWS.map((r) => r.configKey);
const ALL_HOTKEY_BINDING_KEYS = NAV_HOTKEY_BINDING_KEYS.concat(MODS_HOTKEY_BINDING_KEYS).concat(SETUP_HOTKEY_BINDING_KEYS);

const ALL_HOTKEY_UI_ROWS = NAV_HOTKEY_UI_ROWS.concat(MODS_HOTKEY_UI_ROWS).concat(SETUP_HOTKEY_UI_ROWS);

function hotkeyConfigRowHtml({
  captureId,
  resetId,
  labelHtml,
  initialDisplay,
  rowClass = 'hotkey-inventory-row',
  rowId,
  rowStyle,
  labelStyle,
  marginTop = true,
  labelId
}) {
  const margin = marginTop ? ' margin-top: 12px;' : '';
  const idAttr = rowId ? ` id="${rowId}"` : '';
  const labelAttrs = labelId ? ` id="${labelId}"` : '';
  return `
            <div${idAttr} class="${rowClass}" style="${rowStyle}${margin}">
              <span${labelAttrs} style="${labelStyle}">${labelHtml}</span>
              <button type="button" id="${captureId}" title="${t('mods.betterUI.hotkeyCaptureTitle')}" style="pointer-events: auto;">
                ${initialDisplay}
              </button>
              <button type="button" id="${resetId}" style="pointer-events: auto;">
                ${t('mods.betterUI.hotkeyResetBinding')}
              </button>
            </div>`;
}

function bindAllHotkeyUiRowsInModal(content, rows = ALL_HOTKEY_UI_ROWS) {
  for (const row of rows) {
    bindHotkeyConfigRowInModal(
      content.querySelector(`#${row.captureId}`),
      content.querySelector(`#${row.resetId}`),
      row.configKey,
      defaultConfig[row.configKey] ?? '',
      row.displayFallback ?? ''
    );
  }
}

function effectiveNavHotkeyBinding(configKey) {
  return sanitizeStoredHotkey(config[configKey], '');
}

/** Clears the same key from other hotkey rows (nav + mods + setups) so only one row owns it. */
function clearConflictingNavHotkeys(boundId, exceptConfigKey) {
  for (const k of ALL_HOTKEY_BINDING_KEYS) {
    if (k === exceptConfigKey) continue;
    if (effectiveNavHotkeyBinding(k) === boundId) config[k] = '';
  }
}

function clearHotkeyCaptureForcedSize(captureButton) {
  if (!captureButton) return;
  ['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height'].forEach((prop) => {
    captureButton.style.removeProperty(prop);
  });
}

function sizeHotkeyCaptureToResetButton(captureButton, resetButton) {
  if (!captureButton || !resetButton) return;
  const r = resetButton.getBoundingClientRect();
  // While #hotkeys-bindings-container is [hidden], layout is suppressed and rect is ~0; Math.max(1,0) locked 1×1px buttons.
  if (r.width < 4 || r.height < 4) {
    clearHotkeyCaptureForcedSize(captureButton);
    return;
  }
  const w = Math.round(r.width);
  const h = Math.round(r.height);
  const wPx = `${w}px`;
  const hPx = `${h}px`;
  captureButton.style.setProperty('width', wPx, 'important');
  captureButton.style.setProperty('height', hPx, 'important');
  captureButton.style.setProperty('min-width', wPx, 'important');
  captureButton.style.setProperty('max-width', wPx, 'important');
  captureButton.style.setProperty('min-height', hPx, 'important');
  captureButton.style.setProperty('max-height', hPx, 'important');
  captureButton.style.setProperty('box-sizing', 'border-box', 'important');
  captureButton.style.setProperty('flex-shrink', '0', 'important');
}

function updateHotkeyRowAvailability({
  labelId,
  warningId,
  captureId,
  resetId,
  disabled,
  disabledTitle
}) {
  const label = document.getElementById(labelId);
  const warning = document.getElementById(warningId);
  const captureButton = document.getElementById(captureId);
  const resetButton = document.getElementById(resetId);

  if (label) {
    label.style.color = disabled ? '#888' : '#ccc';
    label.title = disabled ? disabledTitle : '';
  }
  if (warning) {
    warning.hidden = !disabled;
    warning.title = disabledTitle;
    warning.style.display = disabled ? 'inline-flex' : 'none';
    warning.style.color = '#f0c36d';
    warning.style.opacity = '1';
    warning.style.filter = 'none';
  }
  if (captureButton) {
    captureButton.disabled = false;
    captureButton.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    captureButton.title = disabled ? disabledTitle : t('mods.betterUI.hotkeyCaptureTitle');
    captureButton.style.cursor = disabled ? 'not-allowed' : '';
    captureButton.style.opacity = disabled ? '0.65' : '';
  }
  if (resetButton) {
    resetButton.disabled = false;
    resetButton.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    resetButton.title = disabled ? disabledTitle : '';
    resetButton.style.cursor = disabled ? 'not-allowed' : '';
    resetButton.style.opacity = disabled ? '0.65' : '';
  }
}

function updateReturnToMapHotkeyAvailability() {
  updateHotkeyRowAvailability({
    labelId: 'hotkey-return-to-map-label',
    warningId: 'hotkey-return-to-map-unavailable-warning',
    captureId: 'hotkey-return-to-map-capture-btn',
    resetId: 'hotkey-return-to-map-reset-btn',
    disabled: !config.showLastVisitedMapButton,
    disabledTitle: RETURN_TO_MAP_HOTKEY_DISABLED_TITLE
  });
}

function updateTurboModeHotkeyAvailability() {
  updateHotkeyRowAvailability({
    labelId: 'hotkey-toggle-turbo-mode-label',
    warningId: 'hotkey-toggle-turbo-mode-unavailable-warning',
    captureId: 'hotkey-toggle-turbo-mode-capture-btn',
    resetId: 'hotkey-toggle-turbo-mode-reset-btn',
    disabled: !isTurboModeModEnabled(),
    disabledTitle: TURBO_MODE_HOTKEY_DISABLED_TITLE
  });
}

function updateCyclopediaHotkeyAvailability() {
  updateHotkeyRowAvailability({
    labelId: 'hotkey-open-cyclopedia-label',
    warningId: 'hotkey-open-cyclopedia-unavailable-warning',
    captureId: 'hotkey-open-cyclopedia-capture-btn',
    resetId: 'hotkey-open-cyclopedia-reset-btn',
    disabled: !isCyclopediaModEnabled(),
    disabledTitle: CYCLOPEDIA_HOTKEY_DISABLED_TITLE
  });
}

function updateBetterTeleporterHotkeyAvailability() {
  const row = document.getElementById('hotkey-open-better-teleporter-row');
  const nameEl = document.getElementById('hotkey-open-better-teleporter-name');
  const label = document.getElementById('hotkey-open-better-teleporter-label');
  const warning = document.getElementById('hotkey-open-better-teleporter-unavailable-warning');
  const captureButton = document.getElementById('hotkey-open-better-teleporter-capture-btn');
  const resetButton = document.getElementById('hotkey-open-better-teleporter-reset-btn');
  if (!row) {
    return;
  }

  const betterEnabled = isBetterTeleporterModEnabled();

  if (nameEl) {
    nameEl.textContent = betterEnabled
      ? t('mods.betterUI.hotkeyLabelBetterTeleporter')
      : t('mods.betterUI.hotkeyLabelGnomishTeleport');
  }

  // Usable in both modes: Better Teleporter (Mods) or native Gnomish Teleport (General).
  if (warning) {
    warning.hidden = true;
    warning.style.display = 'none';
  }
  if (label) {
    label.style.color = '#ccc';
    label.title = '';
  }
  if (captureButton) {
    captureButton.disabled = false;
    captureButton.setAttribute('aria-disabled', 'false');
    captureButton.title = t('mods.betterUI.hotkeyCaptureTitle');
    captureButton.style.cursor = '';
    captureButton.style.opacity = '';
  }
  if (resetButton) {
    resetButton.disabled = false;
    resetButton.setAttribute('aria-disabled', 'false');
    resetButton.title = '';
    resetButton.style.cursor = '';
    resetButton.style.opacity = '';
  }

  if (betterEnabled) {
    const modsSection = document.getElementById('hotkeys-mods-section');
    if (modsSection && (row.parentElement !== modsSection || modsSection.lastElementChild !== row)) {
      modsSection.appendChild(row);
    }
    return;
  }

  const hygenieRow = document.getElementById('hotkey-open-hygenie-capture-btn')
    ?.closest('.hotkey-inventory-row');
  if (hygenieRow?.parentElement && row.nextElementSibling !== hygenieRow) {
    hygenieRow.parentElement.insertBefore(row, hygenieRow);
  }
}

function syncAllNavHotkeyCaptureDisplays() {
  for (const row of ALL_HOTKEY_UI_ROWS) {
    const cap = document.getElementById(row.captureId);
    const res = document.getElementById(row.resetId);
    if (cap) {
      cap.textContent = formatHotkeyForDisplay(config[row.configKey], row.displayFallback);
      cap.className = HOTKEY_CAPTURE_IDLE_CLASS;
    }
    if (res) res.className = HOTKEY_RESET_BUTTON_CLASS;
    if (cap && res) sizeHotkeyCaptureToResetButton(cap, res);
  }
  syncModDependentSettingsAvailability();
  refreshInventoryHotkeyBadges();
  scheduleTimeout(() => {
    for (const row of ALL_HOTKEY_UI_ROWS) {
      const cap = document.getElementById(row.captureId);
      const res = document.getElementById(row.resetId);
      if (cap && res) sizeHotkeyCaptureToResetButton(cap, res);
    }
    syncModDependentSettingsAvailability();
    refreshInventoryHotkeyBadges();
  }, 0);
}

/**
 * Hotkeys tab: capture + reset row. configKey is e.g. hotkeyOpenInventory; defaultKeyForReset is the key restored by Reset (e.g. 'i', 'q', 's').
 */
function bindHotkeyConfigRowInModal(captureButton, resetButton, configKey, defaultKeyForReset, displayFallback) {
  if (!captureButton) return;

  const syncHotkeyCaptureSizeToReset = () => {
    sizeHotkeyCaptureToResetButton(captureButton, resetButton);
  };

  const applyCaptureLook = (mode) => {
    captureButton.className = mode === 'capture' ? HOTKEY_CAPTURE_ACTIVE_CLASS : HOTKEY_CAPTURE_IDLE_CLASS;
    syncHotkeyCaptureSizeToReset();
  };

  const applyCaptureLabel = () => {
    captureButton.textContent = formatHotkeyForDisplay(config[configKey], displayFallback);
    applyCaptureLook('idle');
  };

  captureButton.style.pointerEvents = 'auto';
  if (resetButton) {
    resetButton.className = HOTKEY_RESET_BUTTON_CLASS;
    resetButton.style.pointerEvents = 'auto';
    resetButton.style.marginLeft = '14px';
  }

  applyCaptureLabel();
  scheduleTimeout(syncHotkeyCaptureSizeToReset, 0);

  captureButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (captureButton.getAttribute('aria-disabled') === 'true') return;
    if (hotkeysState.hotkeyCaptureMode !== null) return;

    hotkeysState.hotkeyCaptureMode = configKey;
    captureButton.textContent = '…';
    applyCaptureLook('capture');

    const detachHotkeyCapture = () => {
      window.removeEventListener('keydown', onCaptureKeydown, true);
      document.removeEventListener('pointerdown', onCapturePointerDown, true);
      hotkeysState.hotkeyCaptureMode = null;
      if (hotkeysState.detachHotkeyCapture === detachHotkeyCapture) {
        hotkeysState.detachHotkeyCapture = null;
      }
    };

    const onCaptureKeydown = (keydownEvent) => {
      keydownEvent.preventDefault();
      keydownEvent.stopPropagation();
      detachHotkeyCapture();

      if (keydownEvent.key === 'Escape') {
        applyCaptureLabel();
        return;
      }

      if (keydownEvent.key === 'Delete' || keydownEvent.key === 'Backspace') {
        config[configKey] = '';
        saveConfig();
        syncAllNavHotkeyCaptureDisplays();
        return;
      }

      const boundId = normalizeHotkeyIdentifierFromKey(keydownEvent.key);
      if (!boundId || IGNORED_HOTKEY_IDS.has(boundId)) {
        applyCaptureLabel();
        return;
      }

      clearConflictingNavHotkeys(boundId, configKey);
      config[configKey] = boundId;
      saveConfig();
      syncAllNavHotkeyCaptureDisplays();
    };

    const onCapturePointerDown = (pointerEvent) => {
      if (captureButton.contains(pointerEvent.target) || resetButton?.contains(pointerEvent.target)) return;
      detachHotkeyCapture();
      applyCaptureLabel();
    };

    hotkeysState.detachHotkeyCapture = detachHotkeyCapture;
    window.addEventListener('keydown', onCaptureKeydown, true);
    scheduleTimeout(() => {
      document.addEventListener('pointerdown', onCapturePointerDown, true);
    }, 0);
  });

  if (resetButton) {
    resetButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (resetButton.getAttribute('aria-disabled') === 'true') return;
      if (typeof hotkeysState.detachHotkeyCapture === 'function') {
        hotkeysState.detachHotkeyCapture();
      }
      config[configKey] = defaultKeyForReset;
      clearConflictingNavHotkeys(defaultKeyForReset, configKey);
      saveConfig();
      syncAllNavHotkeyCaptureDisplays();
    });
  }
}

// Subscriptions state
const subscriptions = {
  autoplayRefreshGame: null,
  autoplayRefreshSetPlayMode: null
};

// Anti-idle sounds state
let antiIdleAudioElement = null;

// Playercount state
const PLAYER_COUNT_POLL_MS = 60000;
const PLAYER_ONLINE_RECORD_CHECK_MS = 15 * 60 * 1000;
const PLAYER_ONLINE_RECORD_TOAST_COOLDOWN_MS = 2 * 60 * 1000;

const playercountState = {
  currentPlayerCount: null,
  lastUpdateTime: null,
  onlineRecord: null,
  onlineRecordFetchSucceeded: false,
  recordToastBaselineReady: false,
  lastRecordToastAt: 0,
  updateInterval: null,
  recordCheckInterval: null
};

// Global update tracking
let lastGlobalUpdate = 0; // Track last global update across all observers
const GLOBAL_UPDATE_DEBOUNCE = 300; // Global debounce for all styling updates (ms)

// Pending async callbacks that need cancellation
const pendingAsyncCallbacks = {
  creatureObserver: null,
  battleBoardObserver: null
};

// Color options for max creatures (Tibia-themed)
const COLOR_OPTIONS = {
  prismatic: {
    name: 'Prismatic',
    textColor: 'rgb(255 128 255)',
    borderGradient: 'linear-gradient(135deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff80, #0080ff, #8000ff, #ff0080)',
    starColor: 'linear-gradient(135deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff80, #0080ff, #8000ff, #ff0080)'
  },
  demon: {
    name: 'Demonic',
    textColor: 'rgb(220 20 60)',
    borderGradient: 'linear-gradient(135deg, #8b0000, #dc143c, #ff1744, #b71c1c)',
    starColor: 'linear-gradient(135deg, #5a0000, #8b0000, #dc143c, #ff1744)'
  },
  ice: {
    name: 'Frosty',
    textColor: 'rgb(100 200 255)',
    borderGradient: 'linear-gradient(135deg, #0d47a1, #1976d2, #42a5f5, #80d8ff)',
    starColor: 'linear-gradient(135deg, #01579b, #0277bd, #29b6f6, #b3e5fc)'
  },
  poison: {
    name: 'Venomous',
    textColor: 'rgb(0 255 0)',
    borderGradient: 'linear-gradient(135deg, #1b5e20, #2e7d32, #43a047, #66bb6a)',
    starColor: 'linear-gradient(135deg, #0d3d0d, #1b5e20, #388e3c, #81c784)'
  },
  gold: {
    name: 'Divine',
    textColor: 'rgb(255 215 0)',
    borderGradient: 'linear-gradient(135deg, #f57f17, #fbc02d, #ffd54f, #fff59d)',
    starColor: 'linear-gradient(135deg, #f9a825, #fdd835, #ffee58, #fff9c4)'
  },
  undead: {
    name: 'Undead',
    textColor: 'rgb(200 150 255)',
    borderGradient: 'linear-gradient(135deg, #4a148c, #6a1b9a, #8e24aa, #ab47bc)',
    starColor: 'linear-gradient(135deg, #311b92, #512da8, #673ab7, #9575cd)'
  }
};

// =======================
// 4. Utility Functions
// =======================

// Calculate level from experience points
function getLevelFromExp(exp) {
  const expValue = Number(exp);
  if (!Number.isFinite(expValue) || expValue <= 0) return 1;
  const expToCurrentLevel = globalThis.state?.utils?.expToCurrentLevel;
  if (typeof expToCurrentLevel === 'function') {
    const level = Number(expToCurrentLevel(expValue));
    if (Number.isFinite(level) && level > 0) return Math.floor(level);
  }
  return 1;
}

// Chrome flexbox fix helper
function applyChromeFlex() {
  const headerSlot = document.querySelector(SELECTORS.HEADER_SLOT);
  if (!headerSlot) return;
  
  const headerContainer = headerSlot.querySelector('div');
  if (!headerContainer || !headerContainer.classList.contains('flex')) return;
  
  // Prevent flex wrapping
  headerContainer.style.flexWrap = 'nowrap';
  
  // Fix stamina button to prevent timer wrapping
  const staminaButton = headerContainer.querySelector('button[title="Stamina"]');
  if (!staminaButton) return;
  
  const staminaDiv = staminaButton.querySelector('div');
  if (staminaDiv) {
    staminaDiv.style.flexWrap = 'nowrap';
    staminaDiv.style.whiteSpace = 'nowrap';
    staminaDiv.style.minWidth = '0';
    staminaDiv.style.flexShrink = '0';
    staminaDiv.style.overflow = 'hidden';
  }
  
  console.log('[Mod Settings] Applied flex-nowrap fix for Chrome compatibility');
}

// Monster utility functions
function isEliteMonster(monster) {
  return monster.ad === GAME_CONSTANTS.MAX_STAT_VALUE && 
         monster.ap === GAME_CONSTANTS.MAX_STAT_VALUE && 
         monster.armor === GAME_CONSTANTS.MAX_STAT_VALUE && 
         monster.hp === GAME_CONSTANTS.MAX_STAT_VALUE && 
         monster.magicResist === GAME_CONSTANTS.MAX_STAT_VALUE && 
         monster.tier === GAME_CONSTANTS.MAX_TIER;
}

function getCreatureGameId(imgElement) {
  // Match both regular and shiny portraits: /46.png or /46-shiny.png
  const match = imgElement.src.match(/\/(\d+)(?:-shiny)?\.png$/);
  return match ? parseInt(match[1], 10) : null;
}

function isShinyCreature(imgElement) {
  return imgElement.src.includes('-shiny.png');
}

/** Max-creatures star (mod) or game elite overlay (`data-rarity="6"`). */
function inferWantsEliteFromCreatureSlot(containerSlot) {
  if (!containerSlot) return false;
  if (containerSlot.querySelector('img[data-max-creatures="true"]')) return true;
  const rarityEl = containerSlot.querySelector('.has-rarity');
  const r = parseInt(rarityEl?.getAttribute('data-rarity') || '', 10);
  if (r === GAME_CONSTANTS.ELITE_RARITY_LEVEL) return true;
  const textRarityEl = containerSlot.querySelector('.has-rarity-text');
  const r2 = parseInt(textRarityEl?.getAttribute('data-rarity') || '', 10);
  return r2 === GAME_CONSTANTS.ELITE_RARITY_LEVEL;
}

/**
 * Keep in sync with Depot Manager `bestiaryDuplicateDomAmbiguous` (same predicate).
 * @param {boolean} wantsElite
 * @param {number} rarityOverlay - parsed `data-rarity` (NaN if missing)
 */
function bestiaryDuplicateDomAmbiguous(wantsElite, rarityOverlay) {
  if (wantsElite) return false;
  if (rarityOverlay === GAME_CONSTANTS.ELITE_RARITY_LEVEL) return false;
  return !Number.isFinite(rarityOverlay) || rarityOverlay < GAME_CONSTANTS.ELITE_RARITY_LEVEL;
}

/**
 * When the slot shows no elite signal and overlay rarity is not 6, max-tier and elite often look identical
 * (same data-rarity). Match duplicates by game list order only (exp → name → createdAt).
 */
function creatureSlotDomAmbiguousDuplicates(containerSlot) {
  if (!containerSlot) return true;
  const wantsElite = inferWantsEliteFromCreatureSlot(containerSlot);
  const rarityEl = containerSlot.querySelector('.has-rarity');
  const r = parseInt(rarityEl?.getAttribute('data-rarity') || '', 10);
  return bestiaryDuplicateDomAmbiguous(wantsElite, r);
}

/**
 * Portrait src and level are authoritative for duplicate disambiguation (shiny path, level span).
 * Prevents picking a shiny save instance when the cell shows a non-shiny portrait (or vice versa).
 */
function filterMonstersForCreaturePortrait(monsters, creatureImg, displayedLevel) {
  if (!Array.isArray(monsters) || !creatureImg) return monsters;
  const wantsShiny = creatureImg.src.includes('-shiny');
  let out = monsters.filter((m) => Boolean(m.shiny) === wantsShiny);
  if (out.length === 0) out = monsters;
  if (displayedLevel != null && Number.isFinite(displayedLevel)) {
    const byLevel = out.filter((m) => getLevelFromExp(m.exp || 0) === displayedLevel);
    if (byLevel.length > 0) out = byLevel;
  }
  return out;
}

function getPlayerMonsters() {
  return globalThis.state?.player?.getSnapshot()?.context?.monsters || [];
}

// DOM utility functions
function getVisibleCreatures() {
  return document.querySelectorAll(SELECTORS.CREATURE_IMG);
}

function getCreatureElements(parentElement) {
  return {
    starImg: parentElement.querySelector(SELECTORS.STAR_TIER_4),
    rarityDiv: parentElement.querySelector(SELECTORS.RARITY_DIV),
    textRarityEl: parentElement.querySelector(SELECTORS.RARITY_TEXT),
    levelEl: parentElement.querySelector(SELECTORS.LEVEL_SPAN)
  };
}

function getCreatureLevel(levelElement) {
  return levelElement?.textContent.trim();
}

// Check if scroll is locked at level 2 or above (modals/dialogs)
// Level 1 (context menus) still get styling; higher locks block bulk portrait updates
// When unlocked, the attribute is removed (returns null), which evaluates to false
function isScrollLocked() {
  const scrollLocked = document.body.getAttribute('data-scroll-locked');
  return scrollLocked >= '2';
}

function shouldSkipScrollLocked(options) {
  return !options?.ignoreScrollLock && isScrollLocked();
}

// CSS template system
const CSS_TEMPLATES = {
  maxCreatures: (colorOption, colorKey) => `
    .has-rarity[data-rarity="${GAME_CONSTANTS.ELITE_RARITY_LEVEL}"][data-max-creatures="true"][data-max-creatures-color="${colorKey}"] {
      border: 2px solid;
      border-image: ${colorOption.borderGradient} 1;
      background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
      box-shadow: 0 0 6px ${colorOption.textColor}30, inset 0 0 6px ${colorOption.textColor}15;
    }
    .rarity-shiny[data-max-creatures="true"][data-max-creatures-color="${colorKey}"],
    .rarity-hundo[data-max-creatures="true"][data-max-creatures-color="${colorKey}"],
    .rarity-awaken[data-max-creatures="true"][data-max-creatures-color="${colorKey}"] {
      border: 2px solid;
      border-image: ${colorOption.borderGradient} 1;
      box-shadow: 0 0 6px ${colorOption.textColor}30, inset 0 0 6px ${colorOption.textColor}15;
    }
    .has-rarity-text[data-rarity="${GAME_CONSTANTS.ELITE_RARITY_LEVEL}"][data-max-creatures="true"][data-max-creatures-color="${colorKey}"] {
      --tw-text-opacity: 1;
      color: ${colorOption.textColor};
      text-shadow: 0 0 8px ${colorOption.textColor}, 0 0 16px ${colorOption.textColor}80;
    }
    img[data-max-creatures="true"][data-max-creatures-color="${colorKey}"] {
      background: ${colorOption.starColor};
      background-clip: content-box;
      border-radius: 2px;
      box-shadow: 0 0 6px ${colorOption.textColor}60;
      filter: brightness(1.2) saturate(1.3);
    }
  `,
  maxShinies: (colorOption, colorKey) => `
    .has-rarity[data-max-shinies="true"][data-max-shinies-color="${colorKey}"] {
      border: 2px solid;
      border-image: ${colorOption.borderGradient} 1;
      background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
      box-shadow: 0 0 6px ${colorOption.textColor}30, inset 0 0 6px ${colorOption.textColor}15;
    }
    .rarity-shiny[data-max-shinies="true"][data-max-shinies-color="${colorKey}"],
    .rarity-hundo[data-max-shinies="true"][data-max-shinies-color="${colorKey}"],
    .rarity-awaken[data-max-shinies="true"][data-max-shinies-color="${colorKey}"] {
      border: 2px solid;
      border-image: ${colorOption.borderGradient} 1;
      box-shadow: 0 0 6px ${colorOption.textColor}30, inset 0 0 6px ${colorOption.textColor}15;
    }
    .has-rarity-text[data-max-shinies="true"][data-max-shinies-color="${colorKey}"] {
      --tw-text-opacity: 1;
      color: ${colorOption.textColor};
      text-shadow: 0 0 8px ${colorOption.textColor}, 0 0 16px ${colorOption.textColor}80;
    }
    img[alt="creature"][data-max-shinies="true"][data-max-shinies-color="${colorKey}"] {
      filter: brightness(1.2) saturate(1.3);
      box-shadow: 0 0 6px ${colorOption.textColor}60;
    }
  `
};

function generateMaxCreaturesCSS(colorOption, colorKey) {
  return CSS_TEMPLATES.maxCreatures(colorOption, colorKey);
}

function generateMaxShiniesCSS(colorOption, colorKey) {
  return CSS_TEMPLATES.maxShinies(colorOption, colorKey);
}

function generateSealedCreaturesCSS(colorOption, colorKey) {
  return `
    .rarity-sealed[data-sealed-creatures="true"][data-sealed-creatures-color="${colorKey}"] {
      border: 2px solid;
      border-image: ${colorOption.borderGradient} 1;
      background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
      box-shadow: 0 0 6px ${colorOption.textColor}30, inset 0 0 6px ${colorOption.textColor}15;
      opacity: 0.8;
    }
  `;
}

function upsertFeatureStyle({ idPrefix, colorKey, cssText, replaceAllColors = false }) {
  if (replaceAllColors) {
    Object.keys(COLOR_OPTIONS).forEach((color) => {
      document.getElementById(`${idPrefix}-${color}-style`)?.remove();
    });
  } else if (document.getElementById(`${idPrefix}-${colorKey}-style`)) {
    return;
  }
  const styleId = `${idPrefix}-${colorKey}-style`;
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = cssText;
}

// Helper function to get inventory border style HTML based on setting
function getInventoryBorderStyle(borderStyleName) {
  if (!borderStyleName || borderStyleName === 'Original') {
    return '';
  }
  
  // Map display names to COLOR_OPTIONS keys
  const styleMap = {
    'Demonic': 'demon',
    'Frosty': 'ice',
    'Venomous': 'poison',
    'Divine': 'gold',
    'Undead': 'undead',
    'Prismatic': 'prismatic'
  };
  
  const colorKey = styleMap[borderStyleName];
  if (!colorKey || !COLOR_OPTIONS[colorKey]) {
    return '';
  }
  
  const colorOption = COLOR_OPTIONS[colorKey];
  const borderStyle = [
    'border: 2px solid',
    `border-image: ${colorOption.borderGradient} 1`,
    'background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
    `box-shadow: 0 0 6px ${colorOption.textColor}30, inset 0 0 6px ${colorOption.textColor}15`
  ].join('; ');
  
  return `<div class="has-rarity absolute inset-0 z-1 opacity-80 pointer-events-none" data-rarity="5" data-max-shinies="true" data-max-shinies-color="${colorKey}" data-mod-inventory-border="true" style="${borderStyle}"></div>`;
}

// Must match native inventory slot utilities (quoted attribute variants) or hover border never applies.
const INVENTORY_MOD_SLOT_CLASS =
  "container-slot surface-darker data-[disabled='true']:dithered data-[highlighted='true']:unset-border-image data-[hoverable='true']:hover:unset-border-image";

function normalizeInventoryModSlotHoverClasses(slot) {
  if (!(slot instanceof HTMLElement)) return;
  let className = slot.className || '';
  className = className
    .replace(/data-\[disabled=true\]/g, "data-[disabled='true']")
    .replace(/data-\[highlighted=true\]/g, "data-[highlighted='true']")
    .replace(/data-\[hoverable=true\]/g, "data-[hoverable='true']");
  if (className !== slot.className) {
    slot.className = className;
  }
}

// Expose globally for other mods
window.getInventoryBorderStyle = getInventoryBorderStyle;
window.INVENTORY_MOD_SLOT_CLASS = INVENTORY_MOD_SLOT_CLASS;

function refreshInventoryModButtonBorderStyle(options = {}) {
  const forceBorderRebuild = options.forceBorderRebuild === true;
  const borderHtml = getInventoryBorderStyle(config.inventoryBorderStyle);
  const wantsCustomBorder = Boolean(borderHtml);

  const inventoryModButtons = Array.from(document.querySelectorAll('button')).filter((button) => {
    if (!(button instanceof HTMLElement)) return false;
    return Array.from(button.classList).some((className) => className.endsWith('-inventory-button'));
  });

  inventoryModButtons.forEach((button) => {
    const slot = button.querySelector(':scope > .container-slot');
    if (!slot) return;
    normalizeInventoryModSlotHoverClasses(slot);

    const existingBorder = slot.querySelector(':scope > [data-mod-inventory-border="true"]');
    if (!wantsCustomBorder) {
      existingBorder?.remove();
      // Original: do not clip the native white hover border.
      if (slot.style.overflow === 'hidden') {
        slot.style.removeProperty('overflow');
      }
      return;
    }

    if (slot.style.position !== 'relative') {
      slot.style.position = 'relative';
    }
    if (slot.style.overflow !== 'hidden') {
      slot.style.overflow = 'hidden';
    }
    if (forceBorderRebuild || !existingBorder) {
      existingBorder?.remove();
      slot.insertAdjacentHTML('beforeend', borderHtml);
    }
  });
}

function refreshModBarButtonLabels() {
  if (window.BestiaryModAPI?.ui?.refreshModButtonLabels) {
    window.BestiaryModAPI.ui.refreshModButtonLabels();
  }
}

function getInventoryModButtonClassesInDom() {
  const classes = new Set();
  document.querySelectorAll('button').forEach((button) => {
    if (!(button instanceof HTMLElement)) return;
    button.classList.forEach((className) => {
      if (className.endsWith('-inventory-button')) {
        classes.add(className);
      }
    });
  });
  return classes;
}

function trackInventoryModButtons() {
  const classesInDom = getInventoryModButtonClassesInDom();
  classesInDom.forEach((className) => inventoryModButtonsState.knownClasses.add(className));
  return classesInDom;
}

function triggerInventoryModButtonsRecovery() {
  const inventoryContainer = document.querySelector('.container-inventory-4');
  if (!inventoryContainer) return false;

  // Use a hidden button-shaped probe so mods that specifically watch for
  // "button.focus-style-visible" insertions (like Autoscroller) are nudged.
  const probe = document.createElement('button');
  probe.type = 'button';
  probe.className = 'focus-style-visible active:opacity-70';
  probe.setAttribute('data-mod-settings-inventory-refresh', 'true');
  probe.tabIndex = -1;
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'display:none !important; width:0; height:0; padding:0; margin:0; border:0;';
  inventoryContainer.appendChild(probe);
  scheduleTimeout(() => probe.remove(), 0);
  return true;
}

function verifyInventoryModButtonsIntegrity(source = 'unknown') {
  // Keep mod inventory slot hover/border styles in sync (independent of Persistent Inventory).
  refreshInventoryModButtonBorderStyle();
  refreshInventoryHotkeyBadges();
  applyInventoryColumnsStyle();

  if (!config.persistentInventory) return;
  if (!findInventoryWidgetRoot()) return;

  const classesInDom = trackInventoryModButtons();
  const baselineClasses = Array.from(inventoryModButtonsState.knownClasses).filter((className) =>
    EXPECTED_INVENTORY_MOD_BUTTON_CLASSES.includes(className)
  );
  const missingClasses = baselineClasses.filter((className) => !classesInDom.has(className));
  if (missingClasses.length === 0) {
    inventoryModButtonsState.missingRetryCount.clear();
    return;
  }

  const recoverableMissingClasses = missingClasses.filter((className) => {
    const retries = inventoryModButtonsState.missingRetryCount.get(className) || 0;
    return retries < 4;
  });
  if (recoverableMissingClasses.length === 0) return;

  if (recoverableMissingClasses.includes('autoscroller-inventory-button')) {
    try {
      window.Autoscroller?.reinjectButton?.('mod-settings-missing-check');
      window.dispatchEvent(new CustomEvent('autoscroller:reinject-button'));
    } catch (error) {
      console.warn('[Mod Settings] Persistent inventory: autoscroller reinject hook failed', error);
    }
  }

  if (recoverableMissingClasses.includes('auto-inventory-button')) {
    try {
      window.DiceRoller?.reinjectButton?.('mod-settings-missing-check');
      window.dispatchEvent(new CustomEvent('dice-roller:reinject-button'));
    } catch (error) {
      console.warn('[Mod Settings] Persistent inventory: dice roller reinject hook failed', error);
    }
  }

  if (recoverableMissingClasses.includes('better-forge-inventory-button')) {
    try {
      window.BetterForge?.reinjectButton?.('mod-settings-missing-check');
      window.dispatchEvent(new CustomEvent('better-forge:reinject-button'));
    } catch (error) {
      console.warn('[Mod Settings] Persistent inventory: better forge reinject hook failed', error);
    }
  }

  const now = Date.now();
  if (now - inventoryModButtonsState.lastRecoveryAt < 1500) return;
  inventoryModButtonsState.lastRecoveryAt = now;

  console.log('[Mod Settings] Persistent inventory: missing mod inventory buttons, forcing refresh', {
    source,
    missingClasses: recoverableMissingClasses
  });

  const triggered = triggerInventoryModButtonsRecovery();
  if (!triggered) return;

  recoverableMissingClasses.forEach((className) => {
    const retries = inventoryModButtonsState.missingRetryCount.get(className) || 0;
    inventoryModButtonsState.missingRetryCount.set(className, retries + 1);
  });

  scheduleTimeout(() => {
    refreshInventoryModButtonBorderStyle();
    const updatedClasses = trackInventoryModButtons();
    recoverableMissingClasses.forEach((className) => {
      if (updatedClasses.has(className)) {
        inventoryModButtonsState.missingRetryCount.delete(className);
      }
    });
  }, 120);
}

function startInventoryModButtonsObserver() {
  if (observers.inventoryModButtons) return observers.inventoryModButtons;

  const observer = new MutationObserver(() => {
    if (inventoryModButtonsState.verifyDebounceTimeout) {
      clearTimeout(inventoryModButtonsState.verifyDebounceTimeout);
      activeTimeouts.delete(inventoryModButtonsState.verifyDebounceTimeout);
    }

    inventoryModButtonsState.verifyDebounceTimeout = scheduleTimeout(() => {
      inventoryModButtonsState.verifyDebounceTimeout = null;
      verifyInventoryModButtonsIntegrity('mutation-observer');
    }, 120);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  trackInventoryModButtons();
  scheduleTimeout(() => verifyInventoryModButtonsIntegrity('observer-start'), 250);
  return observer;
}

// Parse stamina values from DOM elements
function parseStaminaValues(parentSpan) {
  const staminaSpans = parentSpan.querySelectorAll(SELECTORS.STAMINA_CHILD_SPANS);
  if (staminaSpans.length < 2) {
    return null;
  }
  
  const currentStamina = parseInt(staminaSpans[0].textContent.trim());
  const maxStaminaText = staminaSpans[1].textContent.trim();
  const maxStamina = parseInt(maxStaminaText.replace('/', ''));
  
  if (isNaN(currentStamina) || isNaN(maxStamina)) {
    return null;
  }
  
  return { current: currentStamina, max: maxStamina };
}

// Calculate time until stamina is full
function calculateStaminaReadyTime(current, max) {
  if (current >= max) {
    return t('mods.betterUI.staminaFullText');
  }
  
  const minutesRemaining = max - current;
  if (minutesRemaining <= 0) {
    return t('mods.betterUI.staminaFullText');
  }
  
  const readyTime = new Date(Date.now() + minutesRemaining * GAME_CONSTANTS.STAMINA_REGEN_MINUTES * 60000);
  
  const hours = readyTime.getHours().toString().padStart(2, '0');
  const minutes = readyTime.getMinutes().toString().padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

// Check if update should be throttled
function shouldThrottleUpdate() {
  const now = Date.now();
  if (now - timerState.lastUpdateTime < THROTTLE_SETTINGS.UPDATE) {
    console.log('[Mod Settings] Update throttled (less than 10s since last update)');
    return true;
  }
  timerState.lastUpdateTime = now;
  return false;
}

// Check if global styling update should be skipped (prevents redundant observer triggers)
function shouldSkipGlobalUpdate(source = 'unknown') {
  const now = Date.now();
  const timeSinceLastUpdate = now - lastGlobalUpdate;
  
  if (timeSinceLastUpdate < GLOBAL_UPDATE_DEBOUNCE) {
    console.log(`[Mod Settings] Skipping ${source} update - recent global update ${timeSinceLastUpdate}ms ago`);
    return true;
  }
  
  lastGlobalUpdate = now;
  return false;
}

// Schedule timeout and track it for cleanup
function scheduleTimeout(callback, delay) {
  const timeoutId = setTimeout(callback, delay);
  activeTimeouts.add(timeoutId);
  return timeoutId;
}

// Disconnect observer helper for cleanup
function disconnectObserver(observer, name) {
  if (observer) {
    try {
      observer.disconnect();
      console.log(`[Mod Settings] ${name} observer disconnected`);
    } catch (error) {
      console.warn(`[Mod Settings] Error disconnecting ${name} observer:`, error);
    }
  }
  return null;
}

// Create throttled MutationObserver with leading+trailing execution
function createThrottledObserver(processCallback, throttleDelay = 50) {
  let lastProcessTime = 0;
  let pendingTimer = null;
  let pendingMutations = [];
  
  return new MutationObserver((mutations) => {
    const now = Date.now();
    
    pendingMutations.push(...mutations);
    
    // Leading edge: Execute immediately if enough time has passed
    if (now - lastProcessTime >= throttleDelay) {
      const mutationsToProcess = [...pendingMutations];
      pendingMutations = [];
      processCallback(mutationsToProcess);
      lastProcessTime = now;
    } else {
      // Trailing edge: Schedule for later to catch final mutations
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        activeTimeouts.delete(pendingTimer);
      }
      
      pendingTimer = scheduleTimeout(() => {
        const mutationsToProcess = [...pendingMutations];
        pendingMutations = [];
        processCallback(mutationsToProcess);
        lastProcessTime = Date.now();
        activeTimeouts.delete(pendingTimer);
        pendingTimer = null;
      }, throttleDelay - (now - lastProcessTime));
    }
  });
}

function saveConfig() {
  try {
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    // Update global exposure
    window.betterUIConfig = config;
    console.log('[Mod Settings] Configuration saved to localStorage:', config);
  } catch (error) {
    console.error('[Mod Settings] Error saving config:', error);
  }
}

function notifySetupShortcutsAndHoverChanged(enabled) {
  window.dispatchEvent(new CustomEvent('betterUISetupShortcutsAndHoverChanged', {
    detail: { enabled: enabled === true }
  }));
}

function notifyQuestHelpersChanged(disabled) {
  window.dispatchEvent(new CustomEvent('betterUIQuestHelpersChanged', {
    detail: { disabled: disabled === true }
  }));
}

const DEPOT_CONFIG_STORAGE_KEY = 'depot-manager-config';
const DEPOT_DEFAULT_CONFIG = {
  enableFavorites: false,
  favoriteSymbol: 'heart',
  enableCreatureDepot: true
};

function readDepotConfigFromStorage() {
  try {
    const raw = localStorage.getItem(DEPOT_CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEPOT_DEFAULT_CONFIG };
    return Object.assign({}, DEPOT_DEFAULT_CONFIG, JSON.parse(raw));
  } catch (e) {
    return { ...DEPOT_DEFAULT_CONFIG };
  }
}

function writeDepotConfigToStorage(next) {
  try {
    localStorage.setItem(DEPOT_CONFIG_STORAGE_KEY, JSON.stringify(next));
    if (typeof window !== 'undefined') {
      window.depotManagerConfig = next;
    }
    if (window.depotManager && typeof window.depotManager.reloadDepotConfigFromStorage === 'function') {
      window.depotManager.reloadDepotConfigFromStorage();
    }
  } catch (e) {
    console.error('[Mod Settings] Error saving Depot config:', e);
  }
}

// =======================
// 4.5. Firebase Best Runs Upload Functions
// =======================

// Firebase configuration
const FIREBASE_RUNS_CONFIG = {
  firebaseUrl: 'https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app'
};

// Get current player name
function getCurrentPlayerName() {
  try {
    const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
    if (playerState?.name) {
      return playerState.name;
    }
    // Fallback methods
    if (window.gameState && window.gameState.player && window.gameState.player.name) {
      return window.gameState.player.name;
    }
    if (window.api && window.api.gameState && window.api.gameState.getPlayerName) {
      return window.api.gameState.getPlayerName();
    }
  } catch (error) {
    console.error('[Mod Settings] Error getting current player name:', error);
  }
  return null;
}

// Hash username for Firebase key
async function hashUsername(username) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(username.toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('[Mod Settings] Error hashing username:', error);
    throw error;
  }
}

// Derive encryption key from password
async function deriveEncryptionKey(password) {
  try {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const salt = encoder.encode('firebase-runs-salt');
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    return key;
  } catch (error) {
    console.error('[Mod Settings] Error deriving encryption key:', error);
    throw error;
  }
}

// Sanitize data to remove circular references and limit depth
function sanitizeRunsData(data, maxDepth = 10, currentDepth = 0) {
  if (currentDepth > maxDepth) {
    return null;
  }
  
  if (data === null || data === undefined) {
    return data;
  }
  
  if (typeof data !== 'object') {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeRunsData(item, maxDepth, currentDepth + 1));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    // Skip functions and undefined values
    if (typeof value === 'function' || value === undefined) {
      continue;
    }
    
    // Recursively sanitize nested objects
    sanitized[key] = sanitizeRunsData(value, maxDepth, currentDepth + 1);
  }
  
  return sanitized;
}

// Encrypt runs data
async function encryptRunsData(data, password) {
  try {
    // Sanitize data to remove circular references
    const sanitizedData = sanitizeRunsData(data);
    
    // Stringify with error handling
    let jsonString;
    try {
      jsonString = JSON.stringify(sanitizedData);
    } catch (stringifyError) {
      console.error('[Mod Settings] Error stringifying data:', stringifyError);
      throw new Error('Failed to serialize run data. Data may contain circular references or be too large.');
    }
    
    const key = await deriveEncryptionKey(password);
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(jsonString);
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      dataBytes
    );
    
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Use a safer base64 encoding method for large arrays
    // Convert Uint8Array to base64 without spreading
    let binary = '';
    const len = combined.length;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    
    return btoa(binary);
  } catch (error) {
    console.error('[Mod Settings] Error encrypting runs data:', error);
    throw error;
  }
}

// Decrypt runs data
async function decryptRunsData(encryptedText, password) {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') {
      return null;
    }
    
    let combined;
    try {
      combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    } catch (e) {
      console.error('[Mod Settings] Error decoding base64:', e);
      return null;
    }
    
    if (combined.length < 13) {
      console.error('[Mod Settings] Encrypted data too short');
      return null;
    }
    
    const key = await deriveEncryptionKey(password);
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decrypted);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('[Mod Settings] Error decrypting runs data:', error);
    return null;
  }
}

// Firebase service functions
const FirebaseRunsService = {
  async get(path, errorContext, defaultReturn = null) {
    try {
      const response = await fetch(`${path}.json`);
      if (!response.ok) {
        if (response.status === 404) {
          return defaultReturn;
        }
        throw new Error(`Failed to ${errorContext}: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`[Mod Settings] Error ${errorContext}:`, error);
      return defaultReturn;
    }
  },

  async put(path, data, errorContext) {
    const options = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
    const response = await fetch(`${path}.json`, options);
    if (!response.ok) {
      throw new Error(`Failed to ${errorContext}: ${response.status}`);
    }
    return await response.json();
  },

  async delete(path, errorContext) {
    const options = {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    };
    const response = await fetch(`${path}.json`, options);
    if (!response.ok) {
      throw new Error(`Failed to ${errorContext}: ${response.status}`);
    }
    return true;
  },

  async patch(path, data, errorContext) {
    const options = {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
    const response = await fetch(`${path}.json`, options);
    if (!response.ok) {
      throw new Error(`Failed to ${errorContext}: ${response.status}`);
    }
    return await response.json();
  }
};

const FIREBASE_RUNS_VERSION_V2 = '2.0';

function hashMapRunsPayload(mapData) {
  try {
    return JSON.stringify(mapData);
  } catch (e) {
    return String(Date.now());
  }
}

async function decryptBestRunsFromFirebaseRecord(remoteData, password) {
  if (!remoteData || !password) {
    return null;
  }

  if (remoteData.version === FIREBASE_RUNS_VERSION_V2 && remoteData.maps && typeof remoteData.maps === 'object') {
    const merged = {
      runs: {},
      metadata: remoteData.metadata || {},
      playerName: remoteData.playerName,
      uploadedAt: remoteData.lastUpdated
    };
    for (const [mapKey, entry] of Object.entries(remoteData.maps)) {
      if (!entry || !entry.encrypted) {
        continue;
      }
      const chunk = await decryptRunsData(entry.encrypted, password);
      if (!chunk) {
        continue;
      }
      if (chunk.runs && chunk.runs[mapKey]) {
        merged.runs[mapKey] = chunk.runs[mapKey];
      } else if (chunk.runs && typeof chunk.runs === 'object') {
        Object.assign(merged.runs, chunk.runs);
      }
    }
    return merged;
  }

  if (remoteData.encrypted) {
    return decryptRunsData(remoteData.encrypted, password);
  }

  return null;
}

async function uploadBestRunsToFirebase(playerName, bestRuns, password, options = {}) {
  const forceFull = options.forceFull === true;
  try {
    const path = await getBestRunsFirebasePath(playerName);
    const remote = await FirebaseRunsService.get(path, 'fetch runs for delta upload', null);
    const now = Date.now();
    const mapHashes = { ...(config.lastFirebaseUploadedMapHashes || {}) };
    const isLegacyV1 = remote && remote.encrypted && remote.version !== FIREBASE_RUNS_VERSION_V2;
    const needsFullUpload = forceFull || !remote || isLegacyV1 || remote.version !== FIREBASE_RUNS_VERSION_V2;

    if (needsFullUpload) {
      const maps = {};
      for (const [mapKey, mapData] of Object.entries(bestRuns.runs || {})) {
        const encrypted = await encryptRunsData({ runs: { [mapKey]: mapData } }, password);
        maps[mapKey] = { encrypted, lastUpdated: now };
        mapHashes[mapKey] = hashMapRunsPayload(mapData);
      }
      await FirebaseRunsService.put(path, {
        version: FIREBASE_RUNS_VERSION_V2,
        lastUpdated: now,
        metadata: bestRuns.metadata || {},
        playerName: bestRuns.playerName || playerName,
        maps
      }, 'upload runs to Firebase (v2 full)');
      config.lastFirebaseUploadedMapHashes = mapHashes;
      console.log('[Mod Settings] Full v2 upload to Firebase:', Object.keys(maps).length, 'map(s)');
      return true;
    }

    let changedCount = 0;
    for (const [mapKey, mapData] of Object.entries(bestRuns.runs || {})) {
      const payloadHash = hashMapRunsPayload(mapData);
      if (mapHashes[mapKey] === payloadHash) {
        continue;
      }
      const encrypted = await encryptRunsData({ runs: { [mapKey]: mapData } }, password);
      await FirebaseRunsService.patch(
        `${path}/maps/${mapKey}`,
        { encrypted, lastUpdated: now },
        `upload map ${mapKey} to Firebase`
      );
      mapHashes[mapKey] = payloadHash;
      changedCount++;
    }

    if (changedCount > 0) {
      await FirebaseRunsService.patch(path, {
        version: FIREBASE_RUNS_VERSION_V2,
        lastUpdated: now,
        metadata: bestRuns.metadata || {},
        playerName: bestRuns.playerName || playerName
      }, 'update runs metadata on Firebase');
      config.lastFirebaseUploadedMapHashes = mapHashes;
      console.log('[Mod Settings] Delta upload to Firebase:', changedCount, 'map(s) changed');
    } else {
      console.log('[Mod Settings] Delta upload skipped — no map changes');
    }
    return true;
  } catch (error) {
    console.error('[Mod Settings] Error uploading runs to Firebase:', error);
    return false;
  }
}

// Get Firebase path for best runs
async function getBestRunsFirebasePath(playerName) {
  const hashedName = await hashUsername(playerName);
  return `${FIREBASE_RUNS_CONFIG.firebaseUrl}/best-runs/${hashedName}`;
}

// Fetch runs from Firebase
async function fetchRunsFromFirebase(playerName) {
  try {
    const path = await getBestRunsFirebasePath(playerName);
    const data = await FirebaseRunsService.get(path, 'fetch runs from Firebase', null);
    return data;
  } catch (error) {
    console.error('[Mod Settings] Error fetching runs from Firebase:', error);
    return null;
  }
}

// Delete runs from Firebase
async function deleteRunsFromFirebase(playerName) {
  try {
    const path = await getBestRunsFirebasePath(playerName);
    await FirebaseRunsService.delete(path, 'delete runs from Firebase');
    config.lastFirebaseUploadedMapHashes = {};
    console.log('[Mod Settings] Successfully deleted runs from Firebase');
    return true;
  } catch (error) {
    console.error('[Mod Settings] Error deleting runs from Firebase:', error);
    return false;
  }
}

function isGazerMonsterForHide(monster) {
  const db = window.creatureDatabase;
  if (typeof db?.isGazerMonster === 'function') return db.isGazerMonster(monster);
  const name = monster?.metadata?.name ?? '';
  return String(name).toLowerCase().includes('gazer');
}

async function hideNonShinyAndNonAwakenedMonsters(onProgress = null) {
  const monsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters;
  if (!Array.isArray(monsters)) {
    throw new Error('Player monsters not available');
  }

  const monstersToHide = monsters.filter((monster) => {
    if (monster?.hidden === true) return false;
    if (isGazerMonsterForHide(monster)) return true;
    const isAwakened = Number(monster?.tier) === 6;
    const isShiny = monster?.shiny === true;
    return !isAwakened && !isShiny;
  });

  let hiddenCount = 0;
  const totalToHide = monstersToHide.length;
  if (typeof onProgress === 'function') {
    onProgress({
      hiddenCount: 0,
      totalToHide,
      currentMonsterId: null
    });
  }

  for (const monster of monstersToHide) {
    if (typeof onProgress === 'function') {
      onProgress({
        hiddenCount,
        totalToHide,
        currentMonsterId: monster.id
      });
    }

    const response = await fetch('https://bestiaryarena.com/api/trpc/game.hideMonster?batch=1', {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-game-version': '1'
      },
      body: JSON.stringify({
        0: {
          json: {
            hidden: true,
            monsterId: monster.id
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Hide request failed (${response.status})`);
    }

    hiddenCount++;
    if (typeof onProgress === 'function') {
      onProgress({
        hiddenCount,
        totalToHide,
        currentMonsterId: monster.id
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return {
    hiddenCount,
    totalToHide,
    skippedCount: monsters.length - totalToHide,
    totalCount: monsters.length
  };
}

async function runAutoHideNonShinyAndNonAwakenedMonsters(source = 'manual') {
  if (autoHideMonstersInProgress) {
    console.log('[Mod Settings] Auto-hide already in progress, skipping:', source);
    return null;
  }

  autoHideMonstersInProgress = true;
  try {
    const result = await hideNonShinyAndNonAwakenedMonsters();
    console.log('[Mod Settings] Auto-hide finished:', { source, result });

    if (result && result.totalToHide > 0) {
      createToast({
        message: `Auto-hide complete (${result.hiddenCount}/${result.totalToHide})`,
        type: 'success',
        duration: 2500
      });
    }

    return result;
  } catch (error) {
    console.error('[Mod Settings] Auto-hide failed:', error);
    createToast({
      message: 'Auto-hide failed (check console)',
      type: 'error',
      duration: 2500
    });
    return null;
  } finally {
    autoHideMonstersInProgress = false;
  }
}

// Extract seed from replayLink string
function extractSeedFromReplayLink(replayLink) {
  if (!replayLink) return 'N/A';
  try {
    const replayMatch = replayLink.match(/"seed":(-?\d+)/);
    return replayMatch ? replayMatch[1] : 'N/A';
  } catch (e) {
    return 'N/A';
  }
}

function formatFloorsClearedReplayComment(uniqueFloors, floorSeeds) {
  const seeds = floorSeeds && typeof floorSeeds === 'object' ? floorSeeds : {};
  return `Floors cleared with this setup: ${uniqueFloors.map((floor) => {
    const pct = 100 + Number(floor) * 20;
    const raw = seeds[floor] ?? seeds[String(floor)];
    const sn = Number(raw);
    return Number.isFinite(sn) ? `${pct}% (${sn})` : `${pct}%`;
  }).join(', ')}`;
}

function enrichReplayLinkForExport(replayLink, runData = {}, fallbackCredits = '') {
  if (!replayLink || typeof replayLink !== 'string') return replayLink;
  try {
    const match = replayLink.match(/\$replay\((\{.*\})\)/);
    if (!match || !match[1]) return replayLink;
    const replayJson = JSON.parse(match[1]);

    const resolvedCredits = (
      (typeof replayJson.credits === 'string' && replayJson.credits.trim())
      || (typeof runData.credits === 'string' && runData.credits.trim())
      || (typeof runData.player === 'string' && runData.player.trim() && !/^you$/i.test(runData.player.trim()) && runData.player.trim())
      || (typeof runData.userName === 'string' && runData.userName.trim())
      || (typeof fallbackCredits === 'string' && fallbackCredits.trim() && !/^local$/i.test(fallbackCredits.trim()) && fallbackCredits.trim())
    );
    const creditsValue = resolvedCredits || undefined;

    let commentsValue = (typeof replayJson.comments === 'string' && replayJson.comments.trim())
      ? replayJson.comments.trim()
      : undefined;
    if (!commentsValue) {
      if (typeof runData.comments === 'string' && runData.comments.trim()) {
        commentsValue = runData.comments.trim();
      } else {
        const floorHistoryValues = Array.isArray(runData.floorHistory) ? runData.floorHistory : [];
        const normalizedFloors = floorHistoryValues
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0);
        const runFloorValue = Number(runData.floor);
        if (Number.isFinite(runFloorValue) && runFloorValue > 0) normalizedFloors.push(runFloorValue);
        const replayFloorValue = Number(replayJson.floor);
        if (Number.isFinite(replayFloorValue) && replayFloorValue > 0) normalizedFloors.push(replayFloorValue);
        const uniqueFloors = Array.from(new Set(normalizedFloors)).sort((a, b) => a - b);
        if (uniqueFloors.length > 1) {
          commentsValue = formatFloorsClearedReplayComment(uniqueFloors, runData.floorSeeds);
        }
      }
    }

    // Keep replay key order aligned with Cyclopedia exports.
    const orderedReplay = {};
    if (replayJson.region !== undefined && replayJson.region !== null) orderedReplay.region = replayJson.region;
    if (replayJson.map !== undefined && replayJson.map !== null) orderedReplay.map = replayJson.map;
    orderedReplay.floor = replayJson.floor !== undefined && replayJson.floor !== null ? replayJson.floor : 0;
    orderedReplay.season = String(getRunSeasonValue({
      ...runData,
      season: replayJson.season,
      timestamp: replayJson.timestamp !== undefined ? replayJson.timestamp : runData.timestamp,
      date: replayJson.date !== undefined ? replayJson.date : runData.date
    }));
    if (creditsValue) orderedReplay.credits = creditsValue;
    if (commentsValue) orderedReplay.comments = commentsValue;
    const replayTimestamp = Number(replayJson.timestamp);
    orderedReplay.timestamp = Number.isFinite(replayTimestamp) && replayTimestamp > 0 ? replayTimestamp : Date.now();
    const boardForNormalization = Array.isArray(replayJson.board) ? replayJson.board : [];
    const normalizedReplay = (typeof window.$normalizeReplayConfig === 'function')
      ? window.$normalizeReplayConfig({ board: boardForNormalization })
      : null;
    orderedReplay.board = Array.isArray(normalizedReplay?.board)
      ? normalizedReplay.board
      : boardForNormalization;
    orderedReplay.seed = replayJson.seed;

    return `$replay(${JSON.stringify(orderedReplay)})`;
  } catch (error) {
    return replayLink;
  }
}

// Helper function to build temp run object for replayLink generation
function buildTempRunForReplayLink(run, contextRegionName) {
  return {
    seed: run.seed,
    timestamp: run.timestamp,
    mapName: run.mapName,
    mapId: run.mapId,
    regionName: contextRegionName || run.regionName,
    floor: run.floor !== undefined && run.floor !== null ? run.floor : 0,
    credits: run.credits,
    comments: run.comments,
    player: run.player,
    userName: run.userName,
    floorHistory: Array.isArray(run.floorHistory) ? [...run.floorHistory] : undefined,
    floorSeeds: run.floorSeeds && typeof run.floorSeeds === 'object' ? { ...run.floorSeeds } : undefined,
    setup: run.setup ? {
      pieces: (run.setup.pieces || []).map(piece => ({
        tile: piece.tile,
        monsterName: piece.monsterName,
        monsterId: piece.monsterId,
        equipmentName: piece.equipmentName,
        equipId: piece.equipId,
        level: piece.level,
        equipmentStat: piece.equipmentStat,
        equipmentTier: piece.equipmentTier,
        monsterStats: piece.monsterStats
      }))
    } : null
  };
}

// Helper function to clean and prepare a run for upload
function cleanRunForUpload(bestRun, contextRegionName, baseFields) {
  const tempRun = buildTempRunForReplayLink(bestRun, contextRegionName);
  const replayLink = generateReplayLink(tempRun);
  
  const cleanRun = {
    ...baseFields,
    season: getRunSeasonValue(bestRun),
    date: bestRun.date,
    mapName: bestRun.mapName,
    replayLink: replayLink
  };
  
  // Add floorTicks if available
  if (bestRun.floorTicks !== undefined && bestRun.floorTicks !== null) {
    cleanRun.floorTicks = bestRun.floorTicks;
  }
  
  // Preserve grouped floor coverage for floor exports when available.
  if (Array.isArray(bestRun.floorHistory) && bestRun.floorHistory.length > 0) {
    cleanRun.floorHistory = [...bestRun.floorHistory];
  }
  if (bestRun.floorSeeds && typeof bestRun.floorSeeds === 'object' && Object.keys(bestRun.floorSeeds).length > 0) {
    cleanRun.floorSeeds = { ...bestRun.floorSeeds };
  }
  
  return cleanRun;
}

const SEASON_2_START_UTC_MS = Date.UTC(2026, 3, 30, 12, 0, 0); // 2026-04-30 12:00:00 UTC

function getRunSeasonValue(run) {
  // Trust explicit season first; timestamps can be rewritten by imports/exports.
  const season = Number(run?.season);
  if (Number.isFinite(season) && season > 0) {
    return season;
  }

  const timestamp = Number(run?.timestamp);
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return timestamp >= SEASON_2_START_UTC_MS ? 2 : 1;
  }

  // Fallback when only date (YYYY-MM-DD) exists; no time granularity for cutoff day.
  const runDate = typeof run?.date === 'string' ? run.date.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(runDate)) {
    const parsedDate = Date.parse(`${runDate}T00:00:00Z`);
    if (Number.isFinite(parsedDate)) {
      return parsedDate >= SEASON_2_START_UTC_MS ? 2 : 1;
    }
  }

  return 1;
}

function detectCurrentSeasonFromRuns(allRuns) {
  let latestSeason = 1;
  try {
    for (const mapData of Object.values(allRuns?.runs || {})) {
      const categories = [mapData?.speedrun, mapData?.rank, mapData?.floor];
      for (const runs of categories) {
        if (!Array.isArray(runs)) continue;
        for (const run of runs) {
          const season = getRunSeasonValue(run);
          if (season > latestSeason) {
            latestSeason = season;
          }
        }
      }
    }
  } catch (error) {
    console.warn('[Mod Settings] Failed to detect current season, using season 1:', error);
  }
  return latestSeason;
}

function getRunsForSeason(runs, targetSeason) {
  if (!Array.isArray(runs)) return [];
  return runs.filter(run => getRunSeasonValue(run) === targetSeason);
}

let uploadValidationLeaderboardCache = null;
let uploadValidationLeaderboardCacheTime = 0;
const UPLOAD_VALIDATION_LEADERBOARD_TTL = 5 * 60 * 1000;

function getYourRoomsForUploadValidation() {
  if (window.currentSpeedrunRankData?.yourRooms) {
    return window.currentSpeedrunRankData.yourRooms;
  }
  return globalThis.state?.player?.getSnapshot?.()?.context?.rooms || {};
}

async function fetchUploadValidationLeaderboardData() {
  const now = Date.now();
  if (uploadValidationLeaderboardCache && now - uploadValidationLeaderboardCacheTime < UPLOAD_VALIDATION_LEADERBOARD_TTL) {
    return uploadValidationLeaderboardCache;
  }

  if (window.currentSpeedrunRankData?.best) {
    uploadValidationLeaderboardCache = {
      best: window.currentSpeedrunRankData.best,
      yourRooms: window.currentSpeedrunRankData.yourRooms || getYourRoomsForUploadValidation(),
      roomsHighscores: window.currentSpeedrunRankData.roomsHighscores || null
    };
    uploadValidationLeaderboardCacheTime = now;
    return uploadValidationLeaderboardCache;
  }

  try {
    const inp = encodeURIComponent(JSON.stringify({ 0: { json: null, meta: { values: ['undefined'] } } }));
    const headers = { Accept: '*/*', 'Content-Type': 'application/json', 'X-Game-Version': '1' };
    const [tickResponse, roomsResponse] = await Promise.all([
      fetch(`/api/trpc/game.getTickHighscores?batch=1&input=${inp}`, { headers }),
      fetch(`/api/trpc/game.getRoomsHighscores?batch=1&input=${inp}`, { headers })
    ]);
    if (!tickResponse.ok) {
      console.warn('[Mod Settings] Could not fetch tick highscores for run validation');
      return { best: {}, yourRooms: getYourRoomsForUploadValidation(), roomsHighscores: null };
    }
    const tickJson = await tickResponse.json();
    const best = tickJson[0]?.result?.data?.json || {};
    let roomsHighscores = null;
    if (roomsResponse.ok) {
      const roomsJson = await roomsResponse.json();
      roomsHighscores = roomsJson[0]?.result?.data?.json || null;
    }
    uploadValidationLeaderboardCache = {
      best,
      yourRooms: getYourRoomsForUploadValidation(),
      roomsHighscores
    };
    uploadValidationLeaderboardCacheTime = now;
    return uploadValidationLeaderboardCache;
  } catch (error) {
    console.warn('[Mod Settings] Error fetching tick highscores for run validation:', error);
    return { best: {}, yourRooms: getYourRoomsForUploadValidation(), roomsHighscores: null };
  }
}

function runSetupHasLevel1Creature(run) {
  return Boolean(run?.setup?.pieces?.some((piece) => piece?.level === 1));
}

function normalizeUserFloorDataForUploadValidation(room) {
  if (!room) return { floor: null, floorTicks: null };
  let floor = room?.floor;
  let floorTicks = room?.floorTicks;
  if ((floor === undefined || floor === null) && (floorTicks === undefined || floorTicks === null)) {
    floor = 0;
    floorTicks = room?.ticks || 0;
  }
  return { floor, floorTicks };
}

function normalizeBestFloorDataForUploadValidation(roomKey, roomsHighscores, best) {
  const bestFloorData = roomsHighscores?.floor?.[roomKey];
  let floor = bestFloorData?.floor;
  let floorTicks = bestFloorData?.floorTicks || bestFloorData?.ticks;
  if ((floor === undefined || floor === null) && (floorTicks === undefined || floorTicks === null)) {
    floor = 0;
    floorTicks = best?.[roomKey]?.ticks || 0;
  }
  return { floor, floorTicks };
}

function getRunFloorCompareTicksForUploadValidation(run) {
  if (!run) return null;
  if (run.floorTicks !== undefined && run.floorTicks !== null) {
    const floorTicks = Number(run.floorTicks);
    if (Number.isFinite(floorTicks) && floorTicks > 0) return floorTicks;
  }
  if (run.time !== undefined && run.time !== null) {
    const time = Number(run.time);
    if (Number.isFinite(time) && time > 0) return time;
  }
  return null;
}

function shouldCompareFloorRunTicksForUploadValidation(run, benchmarkFloor) {
  const runFloor = Number(run?.floor);
  const bench = Number(benchmarkFloor);
  if (!Number.isFinite(bench) || bench <= 0) return false;
  if (!Number.isFinite(runFloor) || runFloor <= 0) return false;
  return runFloor >= bench;
}

function resolveLeaderboardRoomKey(mapKey, mapName, mapData) {
  const runs = [
    ...(mapData?.speedrun || []),
    ...(mapData?.rank || []),
    ...(mapData?.floor || [])
  ];
  const mapId = runs.find((run) => run?.mapId)?.mapId;
  if (mapId) return mapId;

  const roomNames = globalThis.state?.utils?.ROOM_NAME;
  if (roomNames) {
    const target = (mapName || mapKey.replace(/^map_/, '').replace(/_/g, ' ')).toLowerCase();
    for (const [roomId, name] of Object.entries(roomNames)) {
      if (String(name).toLowerCase() === target) return roomId;
    }
  }
  return mapKey;
}

function buildMapRunValidationContext(mapKey, mapName, mapData, leaderboardData, season) {
  const roomKey = resolveLeaderboardRoomKey(mapKey, mapName, mapData);
  const yourRooms = leaderboardData?.yourRooms || {};
  const best = leaderboardData?.best || {};
  const yourRoom = yourRooms?.[roomKey];
  const { floor: yourFloor, floorTicks: yourFloorTicks } = normalizeUserFloorDataForUploadValidation(yourRoom);
  const { floor: wrFloor, floorTicks: wrFloorTicks } = normalizeBestFloorDataForUploadValidation(
    roomKey,
    leaderboardData?.roomsHighscores,
    best
  );
  return {
    season,
    yourTicks: yourRooms?.[roomKey]?.ticks || 0,
    yourBestRank: yourRooms?.[roomKey]?.rank || 0,
    wrTicks: season >= 2 ? (best?.[roomKey]?.ticks || 0) : 0,
    yourFloor: Number(yourFloor) || 0,
    yourFloorTicks: Number(yourFloorTicks) || 0,
    wrFloor: Number(wrFloor) || 0,
    wrFloorTicks: season >= 2 ? (Number(wrFloorTicks) || 0) : 0
  };
}

function getRunMightBeInvalidReasons(run, {
  season,
  category,
  yourTicks,
  wrTicks,
  yourBestRank,
  yourFloor,
  yourFloorTicks,
  wrFloor,
  wrFloorTicks
}) {
  if (season < 2) return [];

  const reasons = [];
  if (category === 'speedrun' || category === 'rank') {
    if (yourTicks > 0 && run.time < yourTicks) reasons.push('faster than your best time');
    if (wrTicks > 0 && run.time < wrTicks) reasons.push('faster than world record');
  }
  if (category === 'rank' && yourBestRank > 0 && run.points > yourBestRank) {
    reasons.push('worse rank than your best');
  }
  if (category === 'floor') {
    const runTicks = getRunFloorCompareTicksForUploadValidation(run);
    if (runTicks !== null) {
      if (shouldCompareFloorRunTicksForUploadValidation(run, yourFloor)
        && yourFloorTicks > 0
        && runTicks < yourFloorTicks) {
        reasons.push('faster than your best floor time');
      }
      if (shouldCompareFloorRunTicksForUploadValidation(run, wrFloor)
        && wrFloorTicks > 0
        && runTicks < wrFloorTicks) {
        reasons.push('faster than floor world record');
      }
    }
  }
  if (runSetupHasLevel1Creature(run)) reasons.push('has level 1 creatures');
  return reasons;
}

function isRunMightBeInvalid(run, context, category) {
  return getRunMightBeInvalidReasons(run, { ...context, category }).length > 0;
}

function findFirstValidRunForUpload(runs, context, category) {
  if (!Array.isArray(runs)) return null;
  for (const run of runs) {
    if (!isRunMightBeInvalid(run, context, category)) {
      return run;
    }
  }
  return null;
}

// Helper function to update Firebase status display
function updateFirebaseStatus(statusDiv, message, color = '#7f8fa4') {
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.style.color = color;
  }
}

function normalizeReplayEntityName(name, id, idToNameMap, lookupFromGameState) {
  if (typeof name === 'string' && name.trim()) {
    return name.trim().toLowerCase();
  }

  const lookupId = id ?? (typeof name === 'number' && Number.isFinite(name) ? name : null);
  if (lookupId != null) {
    const mappedName = idToNameMap?.get?.(Number(lookupId)) ?? idToNameMap?.get?.(lookupId);
    if (typeof mappedName === 'string' && mappedName.trim()) {
      return mappedName.trim().toLowerCase();
    }

    const resolvedName = lookupFromGameState?.(lookupId);
    if (typeof resolvedName === 'string' && resolvedName.trim()) {
      return resolvedName.trim().toLowerCase();
    }
  }

  return null;
}

function resolveReplayMonsterName(piece) {
  return normalizeReplayEntityName(
    piece.monsterName,
    piece.monsterId,
    window.monsterGameIdsToNames,
    (monsterId) => globalThis.state?.utils?.getMonster?.(monsterId)?.metadata?.name
  ) || 'unknown monster';
}

function resolveReplayEquipmentName(piece) {
  return normalizeReplayEntityName(
    piece.equipmentName,
    piece.equipId,
    window.equipmentGameIdsToNames,
    (equipId) => globalThis.state?.utils?.getEquipment?.(equipId)?.metadata?.name
  ) || 'unknown equipment';
}

// Generate $replay link from run data
function generateReplayLink(runData) {
  try {
    if (!runData || !runData.seed) {
      return null;
    }
    
    const board = [];
    const normalizeMonster = (monster) => {
      if (typeof window.$normalizeReplayMonster === 'function') {
        return window.$normalizeReplayMonster(monster);
      }
      if (!monster || typeof monster !== 'object') return monster;
      const level = Number(monster.level);
      const awakened = monster.awakened === true || (Number.isFinite(level) && level > 50);
      return { ...monster, awakened };
    };
    if (runData.setup && runData.setup.pieces) {
      runData.setup.pieces.forEach(piece => {
        const boardPiece = {
          tile: piece.tile || 0
        };
        
        // Add monster as object with name and stats
        const monsterName = resolveReplayMonsterName(piece);
        boardPiece.monster = normalizeMonster({
          name: monsterName,
          level: piece.level || 1,
          hp: piece.monsterStats?.hp || 20,
          ad: piece.monsterStats?.ad || 20,
          ap: piece.monsterStats?.ap || 20,
          armor: piece.monsterStats?.armor || 20,
          magicResist: piece.monsterStats?.magicResist || 20
        });
        
        // Add equipment as object if available
        if (piece.equipmentName || piece.equipId) {
          const equipmentName = resolveReplayEquipmentName(piece);
          boardPiece.equipment = {
            name: equipmentName,
            stat: piece.equipmentStat || 'ap',
            tier: piece.equipmentTier || 5
          };
        }
        
        board.push(boardPiece);
      });
    }
    
    // Build replayData in the correct order: region, map, floor, season, board, seed
    const replayData = {};
    
    // Add region if available
    if (runData.regionName) {
      replayData.region = runData.regionName;
    }
    
    // Add map
    replayData.map = runData.mapName || runData.mapId || '';
    
    // Add floor (default to 0 if not specified)
    if (runData.floor !== undefined && runData.floor !== null) {
      replayData.floor = runData.floor;
    } else {
      replayData.floor = 0; // Default to 0 if floor not specified
    }
    replayData.season = String(getRunSeasonValue(runData));
    const replayTimestamp = Number(runData.timestamp);
    replayData.timestamp = Number.isFinite(replayTimestamp) && replayTimestamp > 0 ? replayTimestamp : Date.now();

    // Preserve run credits if available.
    const replayCredits = (
      (typeof runData.credits === 'string' && runData.credits.trim())
      || (typeof runData.player === 'string' && runData.player.trim() && !/^you$/i.test(runData.player.trim()) && runData.player.trim())
      || (typeof runData.userName === 'string' && runData.userName.trim())
    );
    const creditsValue = replayCredits || undefined;

    // Add floor-history comment when this setup has multiple cleared floors.
    let commentsValue;
    if (typeof runData.comments === 'string' && runData.comments.trim()) {
      commentsValue = runData.comments.trim();
    } else {
      const floorHistoryValues = Array.isArray(runData.floorHistory) ? runData.floorHistory : [];
      const normalizedFloors = floorHistoryValues
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);
      const runFloorValue = Number(runData.floor);
      if (Number.isFinite(runFloorValue) && runFloorValue > 0) {
        normalizedFloors.push(runFloorValue);
      }
      const uniqueFloors = Array.from(new Set(normalizedFloors)).sort((a, b) => a - b);
      if (uniqueFloors.length > 1) {
        commentsValue = formatFloorsClearedReplayComment(uniqueFloors, runData.floorSeeds);
      }
    }

    // Keep replay key order aligned with Cyclopedia exports.
    const orderedReplayData = {};
    if (replayData.region !== undefined && replayData.region !== null) orderedReplayData.region = replayData.region;
    orderedReplayData.map = replayData.map;
    orderedReplayData.floor = replayData.floor;
    orderedReplayData.season = replayData.season;
    if (creditsValue) orderedReplayData.credits = creditsValue;
    if (commentsValue) orderedReplayData.comments = commentsValue;
    orderedReplayData.timestamp = replayData.timestamp;
    orderedReplayData.board = board;
    orderedReplayData.seed = runData.seed;

    return `$replay(${JSON.stringify(orderedReplayData)})`;
  } catch (error) {
    console.error('[Mod Settings] Error generating replay link:', error);
    return null;
  }
}

// Format runs as text with $replay links
// Helper function to format date in EU format: YYYY/M/D HH:mm
function formatEUDateTime(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${year}/${month}/${day} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function formatRunsAsText(runsData) {
  try {
    const playerName = runsData.playerName || 'Unknown Player';
    const currentPlayerName = getCurrentPlayerName();
    const exportCreditsFallback = (
      (typeof currentPlayerName === 'string' && currentPlayerName.trim() && currentPlayerName.trim())
      || (typeof runsData.playerName === 'string' && runsData.playerName.trim() && !/^local$/i.test(runsData.playerName.trim()) && runsData.playerName.trim())
      || ''
    );
    const timestamp = formatEUDateTime(Date.now());
    
    let text = `========================================\n`;
    text += `Best Runs - ${playerName}\n`;
    text += `Generated: ${timestamp}\n`;
    text += `========================================\n\n`;
    
    if (!runsData.runs || Object.keys(runsData.runs).length === 0) {
      text += `No runs available.\n`;
      return text;
    }
    
    // Runs are already sorted by region when uploaded, so just iterate through them in order
    // Group by region for display (if we can determine regions)
    const regionGroups = {};
    let lastRegionName = null;
    
    try {
      const regions = globalThis.state?.utils?.REGIONS;
      const roomNames = globalThis.state?.utils?.ROOM_NAME;
      
      if (regions && Array.isArray(regions) && roomNames) {
        // Create a map of mapKey -> region name
        const mapKeyToRegion = {};
        
        regions.forEach(region => {
          if (!region.rooms) return;
          
          const regionName = resolveRegionDisplayName(region);
          
          region.rooms.forEach(room => {
            const roomId = room.id;
            const roomName = roomNames[roomId] || roomId;
            const mapKey = `map_${roomName.toLowerCase().replace(/\s+/g, '_')}`;
            mapKeyToRegion[mapKey] = regionName;
            
            // Also check by mapId
            for (const [key, mapData] of Object.entries(runsData.runs)) {
              if (mapKeyToRegion[key]) continue;
              
              const allRunsInMap = [
                ...(mapData.speedrun || []),
                ...(mapData.rank || []),
                ...(mapData.floor || [])
              ];
              
              const hasMatchingRoomId = allRunsInMap.some(run => {
                return run.mapId === roomId || run.mapId === room.id;
              });
              
              if (hasMatchingRoomId) {
                mapKeyToRegion[key] = regionName;
              }
            }
          });
        });
        
        // Create maps with region and room order for sorting
        const mapKeyToRegionOrder = {};
        const mapKeyToRoomOrder = {};
        
        regions.forEach((region, regionIndex) => {
          if (!region.rooms) return;
          
          region.rooms.forEach((room, roomIndex) => {
            const roomId = room.id;
            const roomName = roomNames[roomId] || roomId;
            const mapKey = `map_${roomName.toLowerCase().replace(/\s+/g, '_')}`;
            
            // Check if this mapKey exists in runs
            if (runsData.runs[mapKey]) {
              mapKeyToRegionOrder[mapKey] = regionIndex;
              mapKeyToRoomOrder[mapKey] = roomIndex;
            } else {
              // Also check by mapId
              for (const [key, mapData] of Object.entries(runsData.runs)) {
                if (mapKeyToRegionOrder[key] !== undefined) continue; // Already assigned
                
                const allRunsInMap = [
                  ...(mapData.speedrun || []),
                  ...(mapData.rank || []),
                  ...(mapData.floor || [])
                ];
                
                const hasMatchingRoomId = allRunsInMap.some(run => {
                  return run.mapId === roomId || run.mapId === room.id;
                });
                
                if (hasMatchingRoomId) {
                  mapKeyToRegionOrder[key] = regionIndex;
                  mapKeyToRoomOrder[key] = roomIndex;
                  break;
                }
              }
            }
          });
        });
        
        // Iterate through runs and group by region
        for (const [mapKey, mapData] of Object.entries(runsData.runs)) {
          const regionName = mapKeyToRegion[mapKey] || 'Other Maps';
          
          if (!regionGroups[regionName]) {
            regionGroups[regionName] = [];
          }
          
          // Get map name
          const allRuns = [
            ...(mapData.speedrun || []),
            ...(mapData.rank || []),
            ...(mapData.floor || [])
          ];
          
          let mapName = mapKey.replace('map_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          if (allRuns.length > 0 && allRuns[0].mapName) {
            mapName = allRuns[0].mapName;
          } else if (allRuns.length > 0 && allRuns[0].mapId && roomNames) {
            mapName = roomNames[allRuns[0].mapId] || mapName;
          }
          
          regionGroups[regionName].push({
            mapKey: mapKey,
            mapName: mapName,
            data: mapData,
            regionOrder: mapKeyToRegionOrder[mapKey] !== undefined ? mapKeyToRegionOrder[mapKey] : 9999,
            roomOrder: mapKeyToRoomOrder[mapKey] !== undefined ? mapKeyToRoomOrder[mapKey] : 9999
          });
        }
        
        // Sort maps within each region by room order
        for (const regionName of Object.keys(regionGroups)) {
          regionGroups[regionName].sort((a, b) => {
            if (a.regionOrder !== b.regionOrder) {
              return a.regionOrder - b.regionOrder;
            }
            return a.roomOrder - b.roomOrder;
          });
        }
      } else {
        // Fallback: no region grouping, just iterate
        for (const [mapKey, mapData] of Object.entries(runsData.runs)) {
          const allRuns = [
            ...(mapData.speedrun || []),
            ...(mapData.rank || []),
            ...(mapData.floor || [])
          ];
          
          let mapName = mapKey.replace('map_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          if (allRuns.length > 0 && allRuns[0].mapName) {
            mapName = allRuns[0].mapName;
          }
          
          if (!regionGroups['All Maps']) {
            regionGroups['All Maps'] = [];
          }
          
          regionGroups['All Maps'].push({
            mapKey: mapKey,
            mapName: mapName,
            data: mapData
          });
        }
      }
    } catch (error) {
      console.warn('[Mod Settings] Error grouping maps by region, using simple iteration:', error);
      // Fallback: just iterate through runs
      for (const [mapKey, mapData] of Object.entries(runsData.runs)) {
        const allRuns = [
          ...(mapData.speedrun || []),
          ...(mapData.rank || []),
          ...(mapData.floor || [])
        ];
        
        let mapName = mapKey.replace('map_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        if (allRuns.length > 0 && allRuns[0].mapName) {
          mapName = allRuns[0].mapName;
        }
        
        if (!regionGroups['All Maps']) {
          regionGroups['All Maps'] = [];
        }
        
        regionGroups['All Maps'].push({
          mapKey: mapKey,
          mapName: mapName,
          data: mapData
        });
      }
    }
    
    // Sort regions by their order in REGIONS, then display
    const sortedRegionEntries = Object.entries(regionGroups).sort((a, b) => {
      const regionNameA = a[0];
      const regionNameB = b[0];
      
      // Get region order from REGIONS
      let regionOrderA = 9999;
      let regionOrderB = 9999;
      
      try {
        const regions = globalThis.state?.utils?.REGIONS;
        if (regions && Array.isArray(regions)) {
        regions.forEach((region, index) => {
          const regionId = resolveRegionDisplayName(region);
            if (regionId === regionNameA) {
              regionOrderA = index;
            }
            if (regionId === regionNameB) {
              regionOrderB = index;
            }
          });
        }
      } catch (error) {
        // Silently fail
      }
      
      return regionOrderA - regionOrderB;
    });
    
    // Display by region (maps are sorted within each region)
    for (const [regionName, maps] of sortedRegionEntries) {
      if (Object.keys(regionGroups).length > 1) {
        text += `REGION: ${regionName}\n`;
        text += `========================================\n\n`;
      }
      
      for (const map of maps) {
        const mapData = map.data;
        const mapName = map.mapName;
      
      text += `MAP: ${mapName}\n`;
      text += `----------------------------------------\n`;
      
      // Speedrun category
      if (mapData.speedrun && mapData.speedrun.length > 0) {
        const bestSpeedrun = mapData.speedrun[0];
        const speedrunReplayLink = enrichReplayLinkForExport(bestSpeedrun.replayLink, bestSpeedrun, exportCreditsFallback);
        text += `SPEEDRUN:\n`;
        text += `  Time: ${bestSpeedrun.time || 'N/A'} ticks\n`;
        text += `  Seed: ${extractSeedFromReplayLink(speedrunReplayLink)}\n`;
        text += `  Date: ${bestSpeedrun.date || 'N/A'}\n`;
        if (speedrunReplayLink) {
          text += `  ${speedrunReplayLink}\n`;
        }
        text += `\n`;
      }
      
      // Rank category
      if (mapData.rank && mapData.rank.length > 0) {
        const bestRank = mapData.rank[0];
        const rankReplayLink = enrichReplayLinkForExport(bestRank.replayLink, bestRank, exportCreditsFallback);
        text += `RANK:\n`;
        text += `  Points: ${bestRank.points || 'N/A'}\n`;
        text += `  Time: ${bestRank.time || 'N/A'} ticks\n`;
        text += `  Seed: ${extractSeedFromReplayLink(rankReplayLink)}\n`;
        text += `  Date: ${bestRank.date || 'N/A'}\n`;
        if (rankReplayLink) {
          text += `  ${rankReplayLink}\n`;
        }
        text += `\n`;
      }
      
      // Floor category (all setups per map — multiple distinct clears to floor 15)
      if (mapData.floor && mapData.floor.length > 0) {
        const floorRuns = mapData.floor;
        text += `FLOOR${floorRuns.length > 1 ? ` (${floorRuns.length} setups)` : ''}:\n`;
        floorRuns.forEach((floorRun, floorIdx) => {
          if (floorRuns.length > 1) {
            text += `  --- Setup ${floorIdx + 1} ---\n`;
          }
          const floorReplayLink = enrichReplayLinkForExport(floorRun.replayLink, floorRun, exportCreditsFallback);
          const hist = Array.isArray(floorRun.floorHistory)
            ? floorRun.floorHistory.filter((n) => Number.isFinite(Number(n)) && Number(n) > 0)
            : [];
          const peak = floorRun.floor !== undefined && floorRun.floor !== null && Number(floorRun.floor) > 0
            ? Number(floorRun.floor)
            : null;
          const floorsDisplay = hist.length > 0
            ? [...hist].sort((a, b) => Number(b) - Number(a)).join(', ')
            : (peak != null ? String(peak) : 'N/A');
          text += `  Floors: ${floorsDisplay}\n`;
          if (floorRun.floorTicks) {
            text += `  Floor Ticks: ${floorRun.floorTicks} ticks\n`;
          }
          text += `  Seed: ${extractSeedFromReplayLink(floorReplayLink)}\n`;
          text += `  Date: ${floorRun.date || 'N/A'}\n`;
          if (floorReplayLink) {
            text += `  ${floorReplayLink}\n`;
          }
        });
        text += `\n`;
      }
      
        text += `========================================\n\n`;
      }
      
      text += `\n`;
    }
    
    return text;
  } catch (error) {
    console.error('[Mod Settings] Error formatting runs as text:', error);
    return 'Error formatting runs data.';
  }
}

// Upload best runs to Firebase (options.forceFull: true for manual full rebuild)
async function uploadBestRuns(options = {}) {
  try {
    // Rate limiting: prevent uploads more than once every 3 seconds
    const now = Date.now();
    const lastUpload = config.lastFirebaseRunsUpload || 0;
    const timeSinceLastUpload = now - lastUpload;
    const minUploadInterval = 3000; // 3 seconds in milliseconds
    
    if (timeSinceLastUpload < minUploadInterval) {
      const remainingSeconds = ((minUploadInterval - timeSinceLastUpload) / 1000).toFixed(1);
      return { success: false, error: `Please wait ${remainingSeconds} seconds before uploading again` };
    }
    
    const playerName = getCurrentPlayerName();
    if (!playerName) {
      console.error('[Mod Settings] Cannot upload runs: Player name not found');
      return { success: false, error: 'Player name not found' };
    }
    
    if (!config.firebaseRunsPassword) {
      console.error('[Mod Settings] Cannot upload runs: Password not set');
      return { success: false, error: 'Password not set' };
    }

    const enabledRegionCount = getFirebaseUploadRegionEntries().filter((entry) => isFirebaseUploadRegionEnabled(entry.id)).length;
    if (enabledRegionCount === 0) {
      return { success: false, error: t('mods.betterUI.firebaseRunsNoRegionsSelected') };
    }
    
    if (!window.RunTrackerAPI || !window.RunTrackerAPI.getAllRuns) {
      console.error('[Mod Settings] Cannot upload runs: RunTracker not available');
      return { success: false, error: 'RunTracker not available' };
    }

    if (typeof window.RunTrackerAPI.pruneInvalidEmptySetupRuns === 'function') {
      await window.RunTrackerAPI.pruneInvalidEmptySetupRuns();
    }
    
    // Get all runs from RunTracker
    const allRuns = window.RunTrackerAPI.getAllRuns();
    const currentSeason = detectCurrentSeasonFromRuns(allRuns);
    const leaderboardData = currentSeason >= 2
      ? await fetchUploadValidationLeaderboardData()
      : { best: {}, yourRooms: getYourRoomsForUploadValidation() };
    
    // Best speedrun + rank per map; all floor setups per map for current season (multiple clears to floor 15)
    // Sort by region and map order before storing. Floor runs: dedupe by replay hash within this upload only
    // (full Firebase PUT must include each setup every time; cross-upload Set would drop them on re-upload).
    const pendingFloorReplayConfigHashes = new Set();
    const isDuplicateFloorReplayUpload = async (replayLink) => {
      const hashReplay = window.RunTrackerAPI?.hashReplayLinkForUpload;
      if (typeof hashReplay !== 'function') {
        return false;
      }
      const h = await hashReplay(replayLink);
      if (!h) return false;
      if (pendingFloorReplayConfigHashes.has(h)) {
        return true;
      }
      pendingFloorReplayConfigHashes.add(h);
      return false;
    };

    const bestRuns = {
      runs: {},
      metadata: {
        ...(allRuns.metadata || {}),
        season: currentSeason
      },
      playerName: playerName,
      uploadedAt: Date.now()
    };
    
    // First, collect all best runs with their region info
    const runsWithRegion = [];
    const processedMapKeys = new Set();
    
    try {
      const regions = globalThis.state?.utils?.REGIONS;
      const roomNames = globalThis.state?.utils?.ROOM_NAME;
      
      if (regions && Array.isArray(regions) && roomNames) {
        // Create a reverse lookup: mapKey -> roomId
        const mapKeyToRoomId = {};
        Object.keys(roomNames).forEach(roomId => {
          const roomName = roomNames[roomId];
          const mapKey = `map_${roomName.toLowerCase().replace(/\s+/g, '_')}`;
          mapKeyToRoomId[mapKey] = roomId;
        });
        
        // Iterate through regions in order
        regions.forEach(region => {
          if (!region.rooms) return;
          
          const regionName = resolveRegionDisplayName(region);
          
          region.rooms.forEach(room => {
            const roomId = room.id;
            const roomName = roomNames[roomId] || roomId;
            const mapKey = `map_${roomName.toLowerCase().replace(/\s+/g, '_')}`;
            
            if (allRuns.runs[mapKey]) {
              runsWithRegion.push({
                mapKey: mapKey,
                mapName: roomName,
                regionName: regionName,
                regionId: region.id,
                regionOrder: regions.indexOf(region),
                roomOrder: region.rooms.indexOf(room),
                mapData: allRuns.runs[mapKey]
              });
              processedMapKeys.add(mapKey);
            } else {
              // Also try matching by roomId if we have mapId in run data
              for (const [key, mapData] of Object.entries(allRuns.runs || {})) {
                if (processedMapKeys.has(key)) continue;
                
                const allRunsInMap = [
                  ...(mapData.speedrun || []),
                  ...(mapData.rank || []),
                  ...(mapData.floor || [])
                ];
                
                const hasMatchingRoomId = allRunsInMap.some(run => {
                  return run.mapId === roomId || run.mapId === room.id;
                });
                
                if (hasMatchingRoomId) {
                  runsWithRegion.push({
                    mapKey: key,
                    mapName: roomName,
                    regionName: regionName,
                    regionId: region.id,
                    regionOrder: regions.indexOf(region),
                    roomOrder: region.rooms.indexOf(room),
                    mapData: mapData
                  });
                  processedMapKeys.add(key);
                  break;
                }
              }
            }
          });
        });
        
        // Add any maps that weren't found in regions
        for (const [mapKey, mapData] of Object.entries(allRuns.runs || {})) {
          if (!processedMapKeys.has(mapKey)) {
            const allRunsInMap = [
              ...(mapData.speedrun || []),
              ...(mapData.rank || []),
              ...(mapData.floor || [])
            ];
            
            let mapName = mapKey.replace('map_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (allRunsInMap.length > 0 && allRunsInMap[0].mapName) {
              mapName = allRunsInMap[0].mapName;
            } else if (allRunsInMap.length > 0 && allRunsInMap[0].mapId && roomNames) {
              mapName = roomNames[allRunsInMap[0].mapId] || mapName;
            }
            
            runsWithRegion.push({
              mapKey: mapKey,
              mapName: mapName,
              regionName: 'Other Maps',
              regionId: FIREBASE_UPLOAD_OTHER_REGION_ID,
              regionOrder: 9999, // Put at the end
              roomOrder: 9999,
              mapData: mapData
            });
          }
        }
        
        // Sort by region order, then by room order
        runsWithRegion.sort((a, b) => {
          if (a.regionOrder !== b.regionOrder) {
            return a.regionOrder - b.regionOrder;
          }
          return a.roomOrder - b.roomOrder;
        });
      } else {
        // Fallback: just use all runs in original order
        for (const [mapKey, mapData] of Object.entries(allRuns.runs || {})) {
          runsWithRegion.push({
            mapKey: mapKey,
            mapName: mapKey.replace('map_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            regionName: 'Unknown Region',
            regionId: FIREBASE_UPLOAD_OTHER_REGION_ID,
            regionOrder: 0,
            roomOrder: 0,
            mapData: mapData
          });
        }
      }
    } catch (error) {
      console.warn('[Mod Settings] Error sorting runs by region, using original order:', error);
      // Fallback: just use all runs in original order
      for (const [mapKey, mapData] of Object.entries(allRuns.runs || {})) {
        runsWithRegion.push({
          mapKey: mapKey,
          mapName: mapKey.replace('map_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          regionName: 'Unknown Region',
          regionId: FIREBASE_UPLOAD_OTHER_REGION_ID,
          regionOrder: 0,
          roomOrder: 0,
          mapData: mapData
        });
      }
    }
    
    // Extract best speedrun/rank per map; all floor setups for current season (now in sorted order)
    for (const { mapKey, mapData, regionName: contextRegionName, regionId, mapName } of runsWithRegion) {
      if (!isFirebaseUploadRegionEnabled(regionId)) {
        continue;
      }
      const validationContext = buildMapRunValidationContext(
        mapKey,
        mapName,
        mapData,
        leaderboardData,
        currentSeason
      );
      const cleanMapData = {
        speedrun: [],
        rank: [],
        floor: []
      };
      
      // Clean speedrun runs - skip "might be invalid" entries, use next valid run
      const currentSeasonSpeedruns = getRunsForSeason(mapData.speedrun, currentSeason);
      const bestSpeedrun = findFirstValidRunForUpload(currentSeasonSpeedruns, validationContext, 'speedrun');
      if (bestSpeedrun) {
        const cleanSpeedrun = cleanRunForUpload(bestSpeedrun, contextRegionName, {
          time: bestSpeedrun.time
        });
        cleanMapData.speedrun = [cleanSpeedrun];
      }
      
      // Clean rank runs - skip "might be invalid" entries, use next valid run
      const currentSeasonRankRuns = getRunsForSeason(mapData.rank, currentSeason);
      const bestRank = findFirstValidRunForUpload(currentSeasonRankRuns, validationContext, 'rank');
      if (bestRank) {
        const cleanRank = cleanRunForUpload(bestRank, contextRegionName, {
          points: bestRank.points,
          time: bestRank.time
        });
        cleanMapData.rank = [cleanRank];
      }
      
      // Clean floor runs — upload every setup for this season (RunTracker keeps one row per setup)
      const currentSeasonFloorRuns = getRunsForSeason(mapData.floor, currentSeason);
      if (currentSeasonFloorRuns.length > 0) {
        cleanMapData.floor = [];
        const floorCandidates = currentSeasonFloorRuns.filter(
          (run) => run.floor !== undefined && run.floor !== null && run.floor > 0
        );
        for (const floorRun of floorCandidates) {
          if (isRunMightBeInvalid(floorRun, validationContext, 'floor')) {
            continue;
          }
          const cleanFloor = cleanRunForUpload(floorRun, contextRegionName, {
            floor: floorRun.floor,
            floorTicks: floorRun.floorTicks
          });
          if (await isDuplicateFloorReplayUpload(cleanFloor.replayLink)) {
            continue;
          }
          cleanMapData.floor.push(cleanFloor);
        }
      }
      
      bestRuns.runs[mapKey] = cleanMapData;
    }
    
    // Sort runs by region order before storing
    // JavaScript objects maintain insertion order, so we'll create a new ordered object
    let orderedRuns = {};
    
    try {
      const regions = globalThis.state?.utils?.REGIONS;
      const roomNames = globalThis.state?.utils?.ROOM_NAME;
      
      if (regions && Array.isArray(regions) && roomNames) {
        // Create a map of mapKey -> region order for sorting
        const mapKeyToRegionOrder = {};
        const mapKeyToRoomOrder = {};
        
        regions.forEach((region, regionIndex) => {
          if (!region.rooms) return;
          
          region.rooms.forEach((room, roomIndex) => {
            const roomId = room.id;
            const roomName = roomNames[roomId] || roomId;
            const mapKey = `map_${roomName.toLowerCase().replace(/\s+/g, '_')}`;
            
            if (bestRuns.runs[mapKey]) {
              mapKeyToRegionOrder[mapKey] = regionIndex;
              mapKeyToRoomOrder[mapKey] = roomIndex;
            } else {
              // Also check by mapId
              for (const [key, mapData] of Object.entries(bestRuns.runs)) {
                if (mapKeyToRegionOrder[key] !== undefined) continue; // Already assigned
                
                const allRunsInMap = [
                  ...(mapData.speedrun || []),
                  ...(mapData.rank || []),
                  ...(mapData.floor || [])
                ];
                
                const hasMatchingRoomId = allRunsInMap.some(run => {
                  return run.mapId === roomId || run.mapId === room.id;
                });
                
                if (hasMatchingRoomId) {
                  mapKeyToRegionOrder[key] = regionIndex;
                  mapKeyToRoomOrder[key] = roomIndex;
                  break;
                }
              }
            }
          });
        });
        
        // Sort map keys by region order, then by room order
        const sortedMapKeys = Object.keys(bestRuns.runs).sort((a, b) => {
          const regionOrderA = mapKeyToRegionOrder[a] !== undefined ? mapKeyToRegionOrder[a] : 9999;
          const regionOrderB = mapKeyToRegionOrder[b] !== undefined ? mapKeyToRegionOrder[b] : 9999;
          
          if (regionOrderA !== regionOrderB) {
            return regionOrderA - regionOrderB;
          }
          
          const roomOrderA = mapKeyToRoomOrder[a] !== undefined ? mapKeyToRoomOrder[a] : 9999;
          const roomOrderB = mapKeyToRoomOrder[b] !== undefined ? mapKeyToRoomOrder[b] : 9999;
          
          return roomOrderA - roomOrderB;
        });
        
        // Build ordered runs object (maintains insertion order in modern JS)
        sortedMapKeys.forEach(mapKey => {
          orderedRuns[mapKey] = bestRuns.runs[mapKey];
        });
      } else {
        // Fallback: keep original order
        orderedRuns = bestRuns.runs;
      }
    } catch (error) {
      console.warn('[Mod Settings] Error sorting runs by region during upload, using original order:', error);
      orderedRuns = bestRuns.runs;
    }
    
    // Replace runs with ordered version
    bestRuns.runs = orderedRuns;
    
    const success = await uploadBestRunsToFirebase(
      playerName,
      bestRuns,
      config.firebaseRunsPassword,
      { forceFull: options?.forceFull === true }
    );
    
    if (success) {
      config.lastFirebaseRunsUpload = Date.now();
      saveConfig();
      return { success: true };
    } else {
      return { success: false, error: 'Upload failed' };
    }
  } catch (error) {
    console.error('[Mod Settings] Error uploading best runs:', error);
    return { success: false, error: error.message };
  }
}

// Fetch player runs from Firebase
async function fetchPlayerRuns(playerName, password) {
  try {
    if (!playerName || !password) {
      return null;
    }
    
    const remoteData = await fetchRunsFromFirebase(playerName);
    if (!remoteData) {
      return null;
    }
    
    const decryptedData = await decryptBestRunsFromFirebaseRecord(remoteData, password);
    return decryptedData;
  } catch (error) {
    console.error('[Mod Settings] Error fetching player runs:', error);
    return null;
  }
}

// Download runs as .txt file
async function downloadRunsAsTxt(playerName, password, source = 'local') {
  try {
    let runsData = null;
    
    if (source === 'firebase') {
      if (!playerName || !password) {
        console.error('[Mod Settings] Player name and password required for Firebase source');
        return { success: false, error: 'Player name and password required' };
      }
      runsData = await fetchPlayerRuns(playerName, password);
      if (!runsData) {
        return { success: false, error: 'Failed to fetch or decrypt runs' };
      }
    } else {
      // Local source - same export rules as Firebase upload (best speedrun/rank; all floor setups)
      if (!window.RunTrackerAPI || !window.RunTrackerAPI.getAllRuns) {
        return { success: false, error: 'RunTracker not available' };
      }

      if (typeof window.RunTrackerAPI.pruneInvalidEmptySetupRuns === 'function') {
        await window.RunTrackerAPI.pruneInvalidEmptySetupRuns();
      }

      const allRuns = window.RunTrackerAPI.getAllRuns();
      const currentSeason = detectCurrentSeasonFromRuns(allRuns);
      const leaderboardData = currentSeason >= 2
        ? await fetchUploadValidationLeaderboardData()
        : { best: {}, yourRooms: getYourRoomsForUploadValidation() };
      
      // Best per map for speedrun/rank; all floor setups per map for current season
      const bestRuns = {
        runs: {},
        metadata: {
          ...(allRuns.metadata || {}),
          season: currentSeason
        },
        playerName: 'local', // Use 'local' for local downloads since it's the user's own data
        uploadedAt: Date.now()
      };
      
      // Extract runs per map (same logic as upload)
      // First, build a map of mapKey -> regionName (same as upload logic)
      const mapKeyToRegionName = {};
      
      try {
        const regions = globalThis.state?.utils?.REGIONS;
        const roomNames = globalThis.state?.utils?.ROOM_NAME;
        
        if (regions && Array.isArray(regions) && roomNames) {
          // Create a reverse lookup: mapKey -> roomId
          const mapKeyToRoomId = {};
          Object.keys(roomNames).forEach(roomId => {
            const roomName = roomNames[roomId];
            const mapKey = `map_${roomName.toLowerCase().replace(/\s+/g, '_')}`;
            mapKeyToRoomId[mapKey] = roomId;
          });
          
          // Iterate through regions to find which region each map belongs to
          regions.forEach(region => {
            if (!region.rooms) return;
            
            const regionName = resolveRegionDisplayName(region);
            
            region.rooms.forEach(room => {
              const roomId = room.id;
              const roomName = roomNames[roomId] || roomId;
              const mapKey = `map_${roomName.toLowerCase().replace(/\s+/g, '_')}`;
              
              if (allRuns.runs[mapKey]) {
                mapKeyToRegionName[mapKey] = regionName;
              } else {
                // Also try matching by roomId if we have mapId in run data
                for (const [key, mapData] of Object.entries(allRuns.runs || {})) {
                  if (mapKeyToRegionName[key]) continue; // Already assigned
                  
                  const allRunsInMap = [
                    ...(mapData.speedrun || []),
                    ...(mapData.rank || []),
                    ...(mapData.floor || [])
                  ];
                  
                  const hasMatchingRoomId = allRunsInMap.some(run => {
                    return run.mapId === roomId || run.mapId === room.id;
                  });
                  
                  if (hasMatchingRoomId) {
                    mapKeyToRegionName[key] = regionName;
                    break;
                  }
                }
              }
            });
          });
        }
      } catch (error) {
        console.warn('[Mod Settings] Error determining regions for local download:', error);
      }
      
      for (const [mapKey, mapData] of Object.entries(allRuns.runs || {})) {
        const cleanMapData = {
          speedrun: [],
          rank: [],
          floor: []
        };
        
        // Get the correct region name for this map
        const contextRegionName = mapKeyToRegionName[mapKey] || null;
        const mapName = mapKey.replace('map_', '').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        const validationContext = buildMapRunValidationContext(
          mapKey,
          mapName,
          mapData,
          leaderboardData,
          currentSeason
        );
        
        // Best valid speedrun — skip "might be invalid" entries
        const currentSeasonSpeedruns = getRunsForSeason(mapData.speedrun, currentSeason);
        const bestSpeedrun = findFirstValidRunForUpload(currentSeasonSpeedruns, validationContext, 'speedrun');
        if (bestSpeedrun && bestSpeedrun.time !== undefined && bestSpeedrun.time !== null) {
          const cleanSpeedrun = cleanRunForUpload(bestSpeedrun, contextRegionName, {
            time: bestSpeedrun.time
          });
          cleanMapData.speedrun = [cleanSpeedrun];
        }
        
        // Best valid rank — skip "might be invalid" entries
        const currentSeasonRankRuns = getRunsForSeason(mapData.rank, currentSeason);
        const bestRank = findFirstValidRunForUpload(currentSeasonRankRuns, validationContext, 'rank');
        if (bestRank && bestRank.points !== undefined && bestRank.points !== null) {
          const cleanRank = cleanRunForUpload(bestRank, contextRegionName, {
            points: bestRank.points,
            time: bestRank.time
          });
          cleanMapData.rank = [cleanRank];
        }
        
        // All floor setups for current season — same as upload
        const currentSeasonFloorRuns = getRunsForSeason(mapData.floor, currentSeason);
        if (currentSeasonFloorRuns.length > 0) {
          cleanMapData.floor = currentSeasonFloorRuns
            .filter((run) => run.floor !== undefined && run.floor !== null && run.floor > 0)
            .filter((run) => !isRunMightBeInvalid(run, validationContext, 'floor'))
            .map((floorRun) =>
              cleanRunForUpload(floorRun, contextRegionName, {
                floor: floorRun.floor,
                floorTicks: floorRun.floorTicks
              })
            );
        }
        
        // Only add map if it has at least one run
        if (cleanMapData.speedrun.length > 0 || cleanMapData.rank.length > 0 || cleanMapData.floor.length > 0) {
          bestRuns.runs[mapKey] = cleanMapData;
        }
      }
      
      runsData = bestRuns;
    }
    
    // Format as text
    const textContent = formatRunsAsText(runsData);
    
    // Create blob and download
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // For local downloads, use 'local' as filename; for Firebase, use the actual player name
    const safePlayerName = (source === 'local') 
      ? 'local'
      : ((runsData.playerName && typeof runsData.playerName === 'string' && runsData.playerName.trim()) 
          ? runsData.playerName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') 
          : 'unknown');
    a.download = `best-runs-${safePlayerName}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
    URL.revokeObjectURL(url);
    
    console.log('[Mod Settings] Successfully downloaded runs as .txt');
    return { success: true };
  } catch (error) {
    console.error('[Mod Settings] Error downloading runs as .txt:', error);
    return { success: false, error: error.message };
  }
}

// Expose fetch function globally
if (typeof window !== 'undefined') {
  window.fetchPlayerRuns = fetchPlayerRuns;
  window.downloadRunsAsTxt = downloadRunsAsTxt;
}

// Auto-upload hook for RunTracker
let lastUploadedRunCount = 0;
let autoUploadCheckInterval = null;

function startAutoUploadMonitor() {
  if (autoUploadCheckInterval) {
    clearInterval(autoUploadCheckInterval);
  }
  
  if (!config.autoUploadRuns || !config.enableFirebaseRunsUpload) {
    return;
  }
  
  // Initialize last count
  if (window.RunTrackerAPI && window.RunTrackerAPI.getRunStats) {
    const stats = window.RunTrackerAPI.getRunStats();
    lastUploadedRunCount = stats.totalRuns || 0;
  }
  
  // Check every 10 seconds for new runs
  autoUploadCheckInterval = setInterval(async () => {
    if (!config.autoUploadRuns || !config.enableFirebaseRunsUpload || !config.firebaseRunsPassword) {
      return;
    }
    
    if (!window.RunTrackerAPI || !window.RunTrackerAPI.getRunStats) {
      return;
    }
    
    const stats = window.RunTrackerAPI.getRunStats();
    const currentRunCount = stats.totalRuns || 0;
    
    // If run count increased, upload
    if (currentRunCount > lastUploadedRunCount) {
      console.log('[Mod Settings] New runs detected, auto-uploading...');
      const result = await uploadBestRuns();
      if (result.success) {
        lastUploadedRunCount = currentRunCount;
        console.log('[Mod Settings] Auto-upload successful');
      } else {
        console.error('[Mod Settings] Auto-upload failed:', result.error);
      }
    }
  }, 60000); // Check every 60 seconds
}

function stopAutoUploadMonitor() {
  if (autoUploadCheckInterval) {
    clearInterval(autoUploadCheckInterval);
    autoUploadCheckInterval = null;
  }
}

// Start monitor if enabled
if (config.autoUploadRuns && config.enableFirebaseRunsUpload) {
  // Wait a bit for RunTracker to initialize
  scheduleTimeout(() => {
    startAutoUploadMonitor();
  }, 5000);
}

// =======================
// 5. Backup Functions
// =======================

// Safe DOM element removal helper
function safeRemoveElement(element) {
  if (element && element.parentNode && element.parentNode.contains(element)) {
    element.parentNode.removeChild(element);
  } else if (element && element.remove) {
    element.remove();
  }
}

// Toast creation function
function createToast({ message, type = 'info', duration = 5000, icon = null }) {
  // Get or create the main toast container
  let mainContainer = document.getElementById('better-ui-toast-container');
  if (!mainContainer) {
    mainContainer = document.createElement('div');
    mainContainer.id = 'better-ui-toast-container';
    mainContainer.style.cssText = `
      position: fixed;
      z-index: 9999;
      inset: 16px 16px 64px;
      pointer-events: none;
    `;
    mainContainer.setAttribute('data-aria-hidden', 'true');
    mainContainer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(mainContainer);
  }
  
  // Count existing toasts to calculate stacking position
  const existingToasts = mainContainer.querySelectorAll('.toast-item');
  const stackOffset = existingToasts.length * 46; // 46px per toast
  
  // Create the flex container for this specific toast
  const flexContainer = document.createElement('div');
  flexContainer.className = 'toast-item';
  flexContainer.style.cssText = `
    left: 0px;
    right: 0px;
    display: flex;
    position: absolute;
    transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1);
    transform: translateY(-${stackOffset}px);
    bottom: 0px;
    justify-content: flex-end;
  `;
  
  // Create toast button with proper animation classes
  const toast = document.createElement('button');
  toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
  
  // Create widget structure to match game's toast style
  const widgetTop = document.createElement('div');
  widgetTop.className = 'widget-top h-2.5';
  
  const widgetBottom = document.createElement('div');
  widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';
  
  // Add icon if provided
  if (icon) {
    const iconImg = document.createElement('img');
    iconImg.alt = type;
    iconImg.src = icon;
    iconImg.className = 'pixelated';
    iconImg.style.cssText = 'width: 20px; height: 20px;';
    widgetBottom.appendChild(iconImg);
  }
  
  // Add message
  const messageDiv = document.createElement('div');
  messageDiv.className = 'text-left';
  messageDiv.innerHTML = message; // Use innerHTML to support HTML content
  widgetBottom.appendChild(messageDiv);
  
  // Assemble toast
  toast.appendChild(widgetTop);
  toast.appendChild(widgetBottom);
  flexContainer.appendChild(toast);
  mainContainer.appendChild(flexContainer);
  
  // Auto-remove after duration
  const timeoutId = setTimeout(() => {
    if (flexContainer && flexContainer.parentNode) {
      flexContainer.parentNode.removeChild(flexContainer);
      updateToastPositions(mainContainer);
    }
    activeTimeouts.delete(timeoutId);
  }, duration);
  activeTimeouts.add(timeoutId);
  
  return {
    element: flexContainer,
    remove: () => {
      if (flexContainer && flexContainer.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        updateToastPositions(mainContainer);
      }
    }
  };
}

// Update positions of remaining toasts when one is removed
function updateToastPositions(container) {
  const toasts = container.querySelectorAll('.toast-item');
  toasts.forEach((toast, index) => {
    const offset = index * 46;
    toast.style.transform = `translateY(-${offset}px)`;
  });
}

// Format storage size (KB to MB conversion when >= 1000 KB)
function formatStorageSize(kb) {
  if (kb >= 1000) {
    const mb = (kb / 1024).toFixed(2);
    return `${mb} MB`;
  }
  return `${kb} KB`;
}

// Utility function to generate user-friendly summary
function generateConfigSummary(data, isImport = false) {
  const summary = [];
  
  // Count enabled/disabled mods
  if (data.localMods && data.localMods.length > 0) {
    const enabledMods = data.localMods.filter(mod => mod.enabled).length;
    const disabledMods = data.localMods.length - enabledMods;
    summary.push(`${data.localMods.length} mods (${enabledMods} enabled, ${disabledMods} disabled)`);
  }
  
  // Add manual mods if any
  if (data.manualMods && data.manualMods.length > 0) {
    summary.push(`${data.manualMods.length} custom mods`);
  }
  
  // Add game data info
  if (data.gameLocalStorage && Object.keys(data.gameLocalStorage).length > 0) {
    const gameDataItems = [];
    if (data.gameLocalStorage['stored-setup-labels']) {
      try {
        const setupLabels = JSON.parse(data.gameLocalStorage['stored-setup-labels']);
        gameDataItems.push(`${setupLabels.length} setup labels`);
      } catch (e) {
        gameDataItems.push('setup labels');
      }
    }
    if (data.gameLocalStorage['stored-setups']) {
      gameDataItems.push('saved setups');
    }
    if (data.gameLocalStorage['autoseller-settings']) {
      gameDataItems.push('autoseller settings');
    }
    if (data.gameLocalStorage['bestiary-automator-config']) {
      gameDataItems.push('automator config');
    }
    
    if (gameDataItems.length > 0) {
      summary.push(`Game data: ${gameDataItems.join(', ')}`);
    } else {
      summary.push(`${Object.keys(data.gameLocalStorage).length} game settings`);
    }
  }
  
  // Add run data info
  if (data.runData && data.runData.metadata) {
    const runStats = data.runData.metadata;
    if (runStats.totalRuns > 0) {
      const estimatedSizeKB = Math.round((runStats.totalRuns * 1115) / 1024);
      summary.push(`Run data: ${runStats.totalRuns} runs across ${runStats.totalMaps} maps (~${formatStorageSize(estimatedSizeKB)})`);
    }
  }
  
  // Add Hunt Analyzer data info (stored sessions may be pruned; prefer lifetime battle count)
  if (data.huntAnalyzerData && data.huntAnalyzerData.data) {
    const huntData = data.huntAnalyzerData.data;
    const storedSessions = huntData.sessions ? huntData.sessions.length : 0;
    const lifetimeBattles = Math.max(
      storedSessions,
      huntData.session?.count || 0,
      (huntData.totals?.wins || 0) + (huntData.totals?.losses || 0)
    );
    if (lifetimeBattles > 0 || storedSessions > 0) {
      const estimatedSizeKB = Math.round((JSON.stringify(huntData).length) / 1024);
      const detail = storedSessions > 0 && storedSessions < lifetimeBattles
        ? `${lifetimeBattles} battles (${storedSessions} recent in storage)`
        : `${lifetimeBattles} battles`;
      summary.push(`Hunt Analyzer: ${detail} (~${formatStorageSize(estimatedSizeKB)})`);
    }
  }
  
  // Add settings info
  const settings = [];
  if (data.locale && data.locale !== 'en-US') {
    settings.push(`language: ${data.locale}`);
  }
  if (settings.length > 0) {
    summary.push(`Settings: ${settings.join(', ')}`);
  }
  
  return summary;
}

// Ask Hunt Analyzer to flush in-memory state into localStorage before export.
async function flushHuntAnalyzerBeforeExport() {
  const saveCandidates = [
    window.HuntAnalyzerAPI?.saveData,
    window.saveHuntAnalyzerData,
    window.HuntAnalyzerState?.saveData
  ];

  for (const candidate of saveCandidates) {
    if (typeof candidate !== 'function') continue;
    try {
      await candidate();
      console.log('[Mod Settings] Hunt Analyzer data flush completed before export');
      return true;
    } catch (error) {
      console.warn('[Mod Settings] Hunt Analyzer flush attempt failed:', error);
    }
  }

  return false;
}

async function readHuntAnalyzerDataForExport() {
  if (typeof window.HuntAnalyzerAPI?.exportAll === 'function') {
    try {
      return await window.HuntAnalyzerAPI.exportAll();
    } catch (error) {
      console.warn('[Mod Settings] Hunt Analyzer exportAll failed, falling back to localStorage:', error);
    }
  }

  const huntData = localStorage.getItem('huntAnalyzerData');
  const huntState = localStorage.getItem('huntAnalyzerState');
  const huntSettings = localStorage.getItem('huntAnalyzerSettings');
  if (!huntData && !huntState && !huntSettings) return null;

  return {
    data: huntData ? JSON.parse(huntData) : null,
    state: huntState ? JSON.parse(huntState) : null,
    settings: huntSettings ? JSON.parse(huntSettings) : null
  };
}

// Export configuration function
async function exportConfiguration(modal) {
  try {
    // Show loading state
    const exportBtn = document.getElementById('export-config-btn');
    if (exportBtn) {
      exportBtn.textContent = '⏳ Exporting...';
      exportBtn.disabled = true;
    }
    
    // Get all active scripts and their configs
    const activeScripts = await api.service.getActiveScripts();
    
    // Get local mods from background script with fallback to page context
    const localModsData = await new Promise(resolve => {
      // Use postMessage bridge to avoid chrome.runtime.sendMessage() error from webpage context
      const messageId = 'getLocalMods_' + Date.now() + '_' + Math.random();
      let responseHandler = null;
      let timeoutId = null;
      
      // Set up response listener
      responseHandler = (event) => {
        if (event.source !== window) return;
        if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.id === messageId) {
          clearTimeout(timeoutId);
          window.removeEventListener('message', responseHandler);
          
          if (event.data.response && event.data.response.success && event.data.response.mods && event.data.response.mods.length > 0) {
            resolve(event.data.response.mods);
          } else {
            // Fallback: try to get mods from current page context
            if (window.localMods && Array.isArray(window.localMods) && window.localMods.length > 0) {
              resolve(window.localMods);
            } else {
              resolve([]);
            }
          }
        }
      };
      
      // Set up timeout fallback
      timeoutId = setTimeout(() => {
        window.removeEventListener('message', responseHandler);
        // Fallback: try to get mods from current page context
        if (window.localMods && Array.isArray(window.localMods) && window.localMods.length > 0) {
          resolve(window.localMods);
        } else {
          resolve([]);
        }
      }, 5000);
      
      window.addEventListener('message', responseHandler);
      
      // Send request via postMessage bridge
      window.postMessage({
        from: 'BESTIARY_CLIENT',
        id: messageId,
        message: {
          action: 'getLocalMods'
        }
      }, '*');
    });
    
    // Get all storage data in one batch operation
    const storageData = await new Promise(resolve => {
      if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
        window.browserAPI.storage.local.get([
          'manualMods',
          'localModsConfig', 
          'locale',
          'utility_script_cache',
          'utility_script_timestamp',
          'ba_local_runs'
        ], result => {
          resolve(result || {});
        });
      } else {
        resolve({});
      }
    });
    
    // Extract individual values from batch result
    const manualModsData = storageData.manualMods || [];
    const localModsConfigData = storageData.localModsConfig || {};
    const localeData = storageData.locale || 'en-US';
    const utilityScriptCacheData = {
      cache: storageData.utility_script_cache || null,
      timestamp: storageData.utility_script_timestamp || null
    };
     
    // Get run data if checkbox is checked
    let runData = null;
    const runDataCheckbox = document.getElementById('export-run-data');
    
    if (runDataCheckbox && runDataCheckbox.checked) {
      try {
        if (window.RunTrackerAPI) {
          runData = window.RunTrackerAPI.getAllRuns();
        } else if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
          const runDataResult = await new Promise(resolve => {
            window.browserAPI.storage.local.get('ba_local_runs', result => {
              resolve(result?.ba_local_runs || null);
            });
          });
          runData = runDataResult;
        }
        if (runData) {
          console.log('[Mod Settings] Including Run Tracker data in export');
        }
      } catch (error) {
        console.warn('[Mod Settings] Could not read Run Tracker data:', error);
      }
    }
    
    // Get all script caches from storage
    const allStorageData = await new Promise(resolve => {
      if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
        window.browserAPI.storage.local.get(null, result => {
          resolve(result || {});
        });
      } else {
        resolve({});
      }
    });
     
    const scriptCaches = {};
    const modLocalStorage = {};
     
    Object.keys(allStorageData).forEach(key => {
      if (key.startsWith('script_')) {
        scriptCaches[key] = allStorageData[key];
      } else {
        modLocalStorage[key] = allStorageData[key];
      }
    });
    
    // Get game localStorage data (setup labels, mod data, etc.)
    let gameLocalStorage = {};
    try {
      // Access the game page's localStorage directly
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try {
            // Skip Hunt Analyzer data - it's handled separately
            if (key === 'huntAnalyzerData' || key === 'huntAnalyzerState' || key === 'huntAnalyzerSettings') {
              continue;
            }
            const value = localStorage.getItem(key);
            gameLocalStorage[key] = value;
          } catch (e) {
            console.warn('Could not read localStorage key:', key, e);
          }
        }
      }
      
      console.log(`[Mod Settings] Captured ${Object.keys(gameLocalStorage).length} localStorage items from game`);
    } catch (error) {
      console.log('[Mod Settings] Could not access game localStorage:', error);
    }
    
    // Get Hunt Analyzer data if checkbox is checked
    let huntAnalyzerData = null;
    const huntAnalyzerCheckbox = document.getElementById('export-hunt-analyzer');
    
    if (huntAnalyzerCheckbox && huntAnalyzerCheckbox.checked) {
      try {
        await flushHuntAnalyzerBeforeExport();
        huntAnalyzerData = await readHuntAnalyzerDataForExport();
        if (huntAnalyzerData) {
          console.log('[Mod Settings] Including Hunt Analyzer data in export');
        }
      } catch (error) {
        console.warn('[Mod Settings] Could not read Hunt Analyzer data:', error);
      }
    }
    
    // Create export data
    const exportData = {
      timestamp: new Date().toISOString(),
      activeScripts: activeScripts || [],
      localMods: localModsData || [],
      manualMods: manualModsData || [],
      localModsConfig: localModsConfigData || {},
      locale: localeData || 'en-US',
      utilityScriptCache: utilityScriptCacheData.cache || null,
      utilityScriptTimestamp: utilityScriptCacheData.timestamp || null,
      runData: runData,
      scriptCaches: scriptCaches,
      modLocalStorage: modLocalStorage,
      gameLocalStorage: gameLocalStorage,
      huntAnalyzerData: huntAnalyzerData,
      exportInfo: {
        totalActiveScripts: (activeScripts || []).length,
        totalLocalMods: (localModsData || []).length,
        totalManualMods: (manualModsData || []).length,
        hasUtilityCache: !!utilityScriptCacheData.cache,
        hasRunData: !!runData,
        hasScriptCaches: Object.keys(scriptCaches).length > 0,
        hasModLocalStorage: Object.keys(modLocalStorage).length > 0,
        hasGameLocalStorage: Object.keys(gameLocalStorage).length > 0,
        hasHuntAnalyzerData: !!huntAnalyzerData
      }
    };
    
    // Create and download file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bestiary-arena-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
    URL.revokeObjectURL(url);
    
    // Create user-friendly export summary
    const summary = generateConfigSummary(exportData);
    
    // Reset button state
    if (exportBtn) {
      exportBtn.textContent = '📤 Export Configuration';
      exportBtn.disabled = false;
    }
    
    // Show success message using toast
    try {
      createToast({
        message: `<span class="text-success">✅ Configuration exported successfully!</span><br><span class="text-whiteHighlight">📦 What was saved:</span><br>• ${summary.join('<br>• ')}`,
        type: 'success',
        duration: 8000
      });
    } catch (toastError) {
      console.error('[Mod Settings] Could not show export success toast:', toastError);
    }
    
    // Close the modal after successful export
    try {
      if (modal && typeof modal.close === 'function') {
        modal.close();
      } else {
        // Fallback: remove modal elements from DOM
        document.querySelectorAll('.modal-bg, .modal-content, .modal-overlay, [role="dialog"]').forEach(el => {
          safeRemoveElement(el);
        });
      }
    } catch (closeError) {
      console.warn('[Mod Settings] Could not close modal after export:', closeError);
    }
    
  } catch (error) {
    console.error('[Mod Settings] Error exporting configuration:', error);
    
    // Reset button state
    const exportBtn = document.getElementById('export-config-btn');
    if (exportBtn) {
      exportBtn.textContent = '📤 Export Configuration';
      exportBtn.disabled = false;
    }
    
    // Show error message using toast
    try {
      createToast({
        message: `<span class="text-error">❌ Export Failed</span><br><span class="text-whiteHighlight">Failed to export configuration: ${error.message}</span>`,
        type: 'error',
        duration: 6000
      });
    } catch (toastError) {
      console.error('[Mod Settings] Could not show export error toast:', toastError);
    }
  }
}

// Import configuration function
async function importConfiguration(modal) {
  try {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        // Validate import data
        if (!importData.activeScripts) {
          throw new Error('Invalid configuration file format');
        }
        
        // Create user-friendly confirmation info
        const confirmInfo = generateConfigSummary(importData, true);
        
        const confirmMessage = confirmInfo.length > 0 
          ? `This will replace your current configuration. Are you sure you want to continue?\n\n📦 What will be imported:\n• ${confirmInfo.join('\n• ')}`
          : 'This will replace your current configuration. Are you sure you want to continue?\n\n📦 Basic configuration will be imported.';
        
        // Show confirmation modal
        const confirmed = await new Promise(resolve => {
          const confirmModal = api.ui.components.createModal({
            title: 'Confirm Import',
            width: 450,
            content: `
              <div style="padding: 20px;">
                <p style="color: #a6adc8; margin-bottom: 20px; white-space: pre-line;">${confirmMessage}</p>
                <div style="background: rgba(255, 0, 0, 0.1); border: 1px solid rgba(255, 0, 0, 0.3); border-radius: 8px; padding: 12px; margin-top: 15px;">
                  <p style="color: #e78284; margin: 0; font-size: 14px;">
                    <strong>⚠️ Warning:</strong> This will overwrite your current configuration and game data.
                  </p>
                </div>
              </div>
            `,
            buttons: [
              {
                text: 'Cancel',
                primary: false,
                onClick: () => {
                  document.querySelectorAll('.modal-bg, .modal-content, .modal-overlay, [role="dialog"]').forEach(el => {
                    safeRemoveElement(el);
                  });
                  resolve(false);
                }
              },
              {
                text: 'Import Configuration',
                primary: true,
                onClick: () => {
                  document.querySelectorAll('.modal-bg, .modal-content, .modal-overlay, [role="dialog"]').forEach(el => {
                    safeRemoveElement(el);
                  });
                  resolve(true);
                }
              }
            ]
          });
        });
        
        if (!confirmed) return;
       
        // Show loading state
        const importBtn = document.getElementById('import-config-btn');
        if (importBtn) {
          importBtn.textContent = '⏳ Importing...';
          importBtn.disabled = true;
        }
        
        // Import the data using browser storage API
        if (window.browserAPI && window.browserAPI.storage) {
          // Import active scripts to sync storage
          if (window.browserAPI.storage.sync) {
            await new Promise(resolve => {
              window.browserAPI.storage.sync.set({ activeScripts: importData.activeScripts }, resolve);
            });
          }
          
          // Save localMods using background script via postMessage bridge
          if (importData.localMods && importData.localMods.length > 0) {
            await new Promise(resolve => {
              const messageId = 'registerLocalMods_' + Date.now() + '_' + Math.random();
              let responseHandler = null;
              let timeoutId = null;
              
              // Set up response listener
              responseHandler = (event) => {
                if (event.source !== window) return;
                if (event.data && event.data.from === 'BESTIARY_EXTENSION' && 
                    event.data.message && event.data.message.action === 'registerLocalMods') {
                  clearTimeout(timeoutId);
                  window.removeEventListener('message', responseHandler);
                  resolve();
                }
              };
              
              // Set up timeout fallback
              timeoutId = setTimeout(() => {
                window.removeEventListener('message', responseHandler);
                resolve(); // Resolve anyway to continue import
              }, 5000);
              
              window.addEventListener('message', responseHandler);
              
              // Send request via postMessage bridge
              window.postMessage({
                from: 'BESTIARY_CLIENT',
                id: messageId,
                message: {
                  action: 'registerLocalMods',
                  mods: importData.localMods
                }
              }, '*');
            });
          }
          
          if (window.browserAPI.storage.local) {
            // Batch import basic settings
            const basicSettings = {
              manualMods: importData.manualMods,
              localModsConfig: importData.localModsConfig
            };
            
            // Add optional settings if they exist
            if (importData.locale) {
              basicSettings.locale = importData.locale;
            }
            if (importData.utilityScriptCache && importData.utilityScriptTimestamp) {
              basicSettings['utility_script_cache'] = importData.utilityScriptCache;
              basicSettings['utility_script_timestamp'] = importData.utilityScriptTimestamp;
            }
            
            await new Promise(resolve => {
              window.browserAPI.storage.local.set(basicSettings, resolve);
            });
          }
          
          // Import script caches if available
          if (importData.scriptCaches && Object.keys(importData.scriptCaches).length > 0 && window.browserAPI.storage.local) {
            await new Promise(resolve => {
              window.browserAPI.storage.local.set(importData.scriptCaches, resolve);
            });
          }
          
          // Import mod localStorage data if available
          if (importData.modLocalStorage && Object.keys(importData.modLocalStorage).length > 0 && window.browserAPI.storage.local) {
            await new Promise(resolve => {
              window.browserAPI.storage.local.set(importData.modLocalStorage, resolve);
            });
          }
           
          // Import run data if available
          if (importData.runData) {
            if (window.RunTrackerAPI) {
              await window.RunTrackerAPI.importRuns(importData.runData);
            } else if (window.browserAPI.storage.local) {
              await new Promise(resolve => {
                window.browserAPI.storage.local.set({ ba_local_runs: importData.runData }, resolve);
              });
            }
          }
        }
        
        // Import game localStorage data if available
        if (importData.gameLocalStorage && Object.keys(importData.gameLocalStorage).length > 0) {
          try {
            // Backup current localStorage before clearing
            const currentLocalStorage = {};
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key) {
                currentLocalStorage[key] = localStorage.getItem(key);
              }
            }
            
            // Clear existing localStorage
            localStorage.clear();
            
            // Set new localStorage data
            Object.keys(importData.gameLocalStorage).forEach(key => {
              try {
                localStorage.setItem(key, importData.gameLocalStorage[key]);
              } catch (e) {
                console.warn('[Mod Settings] Could not set localStorage key:', key, e);
                // Restore backup on failure
                Object.keys(currentLocalStorage).forEach(backupKey => {
                  try {
                    localStorage.setItem(backupKey, currentLocalStorage[backupKey]);
                  } catch (restoreError) {
                    console.error('[Mod Settings] Failed to restore localStorage backup:', restoreError);
                  }
                });
                throw new Error(`Failed to set localStorage key: ${key}`);
              }
            });
            
            console.log(`[Mod Settings] Restored ${Object.keys(importData.gameLocalStorage).length} game localStorage items`);
          } catch (error) {
            console.log('[Mod Settings] Could not restore game localStorage:', error);
            alert('Warning: Failed to restore game localStorage data: ' + error.message);
          }
        }
        
        // Import Hunt Analyzer data if available
        if (importData.huntAnalyzerData) {
          try {
            if (typeof window.HuntAnalyzerAPI?.importAll === 'function') {
              await window.HuntAnalyzerAPI.importAll(importData.huntAnalyzerData);
            } else {
              if (importData.huntAnalyzerData.data) {
                localStorage.setItem('huntAnalyzerData', JSON.stringify(importData.huntAnalyzerData.data));
              }
              if (importData.huntAnalyzerData.state) {
                localStorage.setItem('huntAnalyzerState', JSON.stringify(importData.huntAnalyzerData.state));
              }
              if (importData.huntAnalyzerData.settings) {
                localStorage.setItem('huntAnalyzerSettings', JSON.stringify(importData.huntAnalyzerData.settings));
              }
            }
          } catch (error) {
            console.warn('[Mod Settings] Could not import Hunt Analyzer data:', error);
          }
        }
        
        // Reset button state
        if (importBtn) {
          importBtn.textContent = '📥 Import Configuration';
          importBtn.disabled = false;
        }
        
        // Create user-friendly import summary
        const importSummary = generateConfigSummary(importData, true);
        
        // Show success message using toast
        try {
          createToast({
            message: `<span class="text-success">✅ Configuration imported successfully!</span><br><span class="text-whiteHighlight">📦 What was restored:</span><br>• ${importSummary.join('<br>• ')}<br><br><span class="text-warning">🔄 Refreshing browser in 1 second...</span>`,
            type: 'success',
            duration: 10000
          });
        } catch (toastError) {
          console.error('[Mod Settings] Could not show import success toast:', toastError);
          alert(`✅ Configuration imported successfully!\n\n📦 What was restored:\n• ${importSummary.join('\n• ')}\n\n🔄 Refreshing browser in 1 second...`);
        }
       
        // Close the configurator modal
        try {
          if (modal && typeof modal.close === 'function') {
            modal.close();
          } else {
            document.querySelectorAll('.modal-bg, .modal-content, .modal-overlay, [role="dialog"]').forEach(el => {
              safeRemoveElement(el);
            });
          }
        } catch (closeError) {
          console.warn('[Mod Settings] Could not close modal:', closeError);
        }
        
        // Auto-refresh after 1 second
        setTimeout(() => {
          window.location.reload();
        }, 1000);
       
      } catch (error) {
        console.error('[Mod Settings] Error importing configuration:', error);
        
        // Reset button state
        const importBtn = document.getElementById('import-config-btn');
        if (importBtn) {
          importBtn.textContent = '📥 Import Configuration';
          importBtn.disabled = false;
        }
        
        // Show error message using toast
        try {
          createToast({
            message: `<span class="text-error">❌ Import Failed</span><br><span class="text-whiteHighlight">Failed to import configuration: ${error.message}</span>`,
            type: 'error',
            duration: 6000
          });
        } catch (toastError) {
          console.error('[Mod Settings] Could not show error toast:', toastError);
          alert(`Failed to import configuration: ${error.message}`);
        }
      }
     
      // Clean up
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };
    
    document.body.appendChild(input);
    input.click();
  } catch (error) {
    console.error('[Mod Settings] Error setting up import:', error);
    try {
      createToast({
        message: `<span class="text-error">❌ Import Setup Error</span><br><span class="text-whiteHighlight">Failed to set up import: ${error.message}</span>`,
        type: 'error',
        duration: 6000
      });
    } catch (toastError) {
      console.error('[Mod Settings] Could not show setup error toast:', toastError);
      alert(`Failed to set up import: ${error.message}`);
    }
  }
}

// Reset all settings function
async function resetAllSettings(modal) {
  try {
    // Show confirmation modal
    const confirmed = await new Promise(resolve => {
      const confirmModal = api.ui.components.createModal({
        title: 'Reset All Settings',
        width: 450,
        content: `
          <div style="padding: 20px;">
            <p style="color: #a6adc8; margin-bottom: 20px;">
              This will reset all localStorage and extension settings to default (like a fresh installation).
            </p>
            <div style="background: rgba(0, 123, 255, 0.1); border: 1px solid rgba(0, 123, 255, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 15px;">
              <p style="color: #4dabf7; margin: 0; font-size: 14px;">
                <strong>💾 Recommendation:</strong> Make a backup using the Export button before resetting.
              </p>
            </div>
            <div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 15px;">
              <p style="color: #ffc107; margin: 0; font-size: 14px;">
                <strong>⚠️ Note:</strong> This does not reset the mods in popup (needs to be handled manually).
              </p>
            </div>
            <div style="background: rgba(255, 0, 0, 0.1); border: 1px solid rgba(255, 0, 0, 0.3); border-radius: 8px; padding: 12px;">
              <p style="color: #e78284; margin: 0; font-size: 14px;">
                <strong>⚠️ Warning:</strong> This action cannot be undone. All settings and game data will be lost.
              </p>
            </div>
          </div>
        `,
        buttons: [
          {
            text: 'Cancel',
            primary: false,
            onClick: () => {
              document.querySelectorAll('.modal-bg, .modal-content, .modal-overlay, [role="dialog"]').forEach(el => {
                safeRemoveElement(el);
              });
              resolve(false);
            }
          },
          {
            text: 'Reset All Settings',
            primary: true,
            onClick: () => {
              document.querySelectorAll('.modal-bg, .modal-content, .modal-overlay, [role="dialog"]').forEach(el => {
                safeRemoveElement(el);
              });
              resolve(true);
            }
          }
        ]
      });
    });
    
    if (!confirmed) return;
    
    // Show loading state
    const resetBtn = document.getElementById('reset-all-settings-btn');
    if (resetBtn) {
      resetBtn.textContent = `⏳ ${t('mods.betterUI.resetting')}`;
      resetBtn.disabled = true;
    }
    
    // Preserve mods in popup (manualMods and localMods)
    let preservedManualMods = [];
    let preservedLocalMods = [];
    
    if (window.browserAPI && window.browserAPI.storage) {
      // Get manualMods and localMods before clearing
      if (window.browserAPI.storage.local) {
        const localData = await new Promise(resolve => {
          window.browserAPI.storage.local.get(['manualMods', 'localMods'], result => {
            resolve(result);
          });
        });
        preservedManualMods = localData.manualMods || [];
        preservedLocalMods = localData.localMods || [];
      }
      
      // Clear all extension storage
      if (window.browserAPI.storage.local) {
        await new Promise(resolve => {
          window.browserAPI.storage.local.clear(resolve);
        });
      }
      
      if (window.browserAPI.storage.sync) {
        await new Promise(resolve => {
          window.browserAPI.storage.sync.clear(resolve);
        });
      }
      
      // Restore preserved mods
      if (preservedManualMods.length > 0 || preservedLocalMods.length > 0) {
        const restoreData = {};
        if (preservedManualMods.length > 0) {
          restoreData.manualMods = preservedManualMods;
        }
        if (preservedLocalMods.length > 0) {
          restoreData.localMods = preservedLocalMods;
        }
        
        if (window.browserAPI.storage.local) {
          await new Promise(resolve => {
            window.browserAPI.storage.local.set(restoreData, resolve);
          });
        }
        
        if (window.browserAPI.storage.sync && preservedLocalMods.length > 0) {
          await new Promise(resolve => {
            window.browserAPI.storage.sync.set({ localMods: preservedLocalMods }, resolve);
          });
        }
      }
    }
    
    // Clear localStorage (game data)
    try {
      localStorage.clear();
      console.log('[Mod Settings] Cleared localStorage');
    } catch (error) {
      console.warn('[Mod Settings] Could not clear localStorage:', error);
    }
    
    // Reset button state
    if (resetBtn) {
      resetBtn.textContent = `🔄 ${t('mods.betterUI.resetAllSettings')}`;
      resetBtn.disabled = false;
    }
    
    // Show success message
    try {
      createToast({
        message: `<span class="text-success">✅ All settings reset successfully!</span><br><span class="text-whiteHighlight">All localStorage and extension settings have been reset to default.</span><br><span class="text-warning">⚠️ Mods in popup were preserved (${preservedManualMods.length + preservedLocalMods.length} mods).</span><br><br><span class="text-warning">🔄 Refreshing browser in 1 second...</span>`,
        type: 'success',
        duration: 10000
      });
    } catch (toastError) {
      console.error('[Mod Settings] Could not show reset success toast:', toastError);
      alert(`✅ All settings reset successfully!\n\nAll localStorage and extension settings have been reset to default.\n\n⚠️ Mods in popup were preserved (${preservedManualMods.length + preservedLocalMods.length} mods).\n\n🔄 Refreshing browser in 1 second...`);
    }
    
    // Close the configurator modal
    try {
      if (modal && typeof modal.close === 'function') {
        modal.close();
      } else {
        document.querySelectorAll('.modal-bg, .modal-content, .modal-overlay, [role="dialog"]').forEach(el => {
          safeRemoveElement(el);
        });
      }
    } catch (closeError) {
      console.warn('[Mod Settings] Could not close modal:', closeError);
    }
    
    // Auto-refresh after 1 second
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.error('[Mod Settings] Error resetting settings:', error);
    
    // Reset button state
    const resetBtn = document.getElementById('reset-all-settings-btn');
    if (resetBtn) {
      resetBtn.textContent = `🔄 ${t('mods.betterUI.resetAllSettings')}`;
      resetBtn.disabled = false;
    }
    
    // Show error message
    try {
      createToast({
        message: `<span class="text-error">❌ Reset Failed</span><br><span class="text-whiteHighlight">Failed to reset settings: ${error.message}</span>`,
        type: 'error',
        duration: 6000
      });
    } catch (toastError) {
      console.error('[Mod Settings] Could not show reset error toast:', toastError);
      alert(`Failed to reset settings: ${error.message}`);
    }
  }
}

// Create settings event handler for checkboxes
function createSettingsCheckboxHandler(configKey, onEnable, onDisable) {
  return (checkbox) => {
    // Set initial state from config
    checkbox.checked = config[configKey];
    if (checkbox.dataset.modSettingsBound === 'true') return;
    checkbox.dataset.modSettingsBound = 'true';
    
    checkbox.addEventListener('change', () => {
      config[configKey] = checkbox.checked;
      saveConfig();
      
      if (config[configKey]) {
        onEnable?.();
      } else {
        onDisable?.();
      }

      // Keep border priority consistent immediately after toggles:
      // Maxed > Shiny > Sealed.
      if (configKey === 'enableMaxCreatures' || configKey === 'enableMaxShinies' || configKey === 'enableSealed') {
        reapplyCreatureCosmeticPriority();
      }
      
      console.log('[Mod Settings] Setting updated:', { [configKey]: config[configKey] });
    });
  };
}

/** Shared reader for Bestiary Automator localStorage config. */
function getAutomatorConfigFromStorage() {
  try {
    const raw = localStorage.getItem('bestiary-automator-config');
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function readHuntAnalyzerSettings() {
  try {
    const raw = localStorage.getItem('huntAnalyzerSettings');
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error('[Mod Settings] Error reading Hunt Analyzer settings:', error);
    return {};
  }
}

function updateHuntAnalyzerSettings(mutator) {
  try {
    const settings = readHuntAnalyzerSettings();
    mutator(settings);
    localStorage.setItem('huntAnalyzerSettings', JSON.stringify(settings));
    return settings;
  } catch (error) {
    console.error('[Mod Settings] Error updating Hunt Analyzer settings:', error);
    return null;
  }
}

function syncHuntAnalyzerRuntimeSetting(key, value) {
  if (window.HuntAnalyzerState?.settings) {
    window.HuntAnalyzerState.settings[key] = value;
  }
}

function bindHuntAnalyzerCheckbox(checkbox, {
  settingsKey,
  defaultChecked = false,
  onAfterWrite
}) {
  if (!checkbox) return;
  const settings = readHuntAnalyzerSettings();
  const stored = settings[settingsKey];
  checkbox.checked = stored === undefined ? defaultChecked : !!stored;
  checkbox.addEventListener('change', () => {
    const newValue = checkbox.checked;
    updateHuntAnalyzerSettings((s) => { s[settingsKey] = newValue; });
    syncHuntAnalyzerRuntimeSetting(settingsKey, newValue);
    onAfterWrite?.(newValue);
    console.log(`[Mod Settings] Updated Hunt Analyzer ${settingsKey}:`, newValue);
  });
}

function isAutomatorSeamlessAutoplayEnabled() {
  return getAutomatorConfigFromStorage().autoPlayAfterDefeat === true;
}

function isAutomatorThresholdsEnabled() {
  return getAutomatorConfigFromStorage().thresholdsEnabled !== false;
}

const WARNING_LABEL_COLOR = '#ffaa00';
const WARNING_LABEL_EMOJI = '⚠️';

/** Strip a leading warning emoji so we can re-apply it consistently. */
function stripLeadingWarningEmoji(text) {
  return String(text ?? '').replace(/^\s*⚠️\s*/u, '').trim();
}

/** Always prefix label text with ⚠️ (idempotent if already present). */
function withLeadingWarningEmoji(text) {
  const cleaned = stripLeadingWarningEmoji(text);
  return cleaned ? `${WARNING_LABEL_EMOJI} ${cleaned}` : WARNING_LABEL_EMOJI;
}

/**
 * Yellow warning option label with leading ⚠️.
 * Use for Mod Settings checkboxes/titles that carry a caution tooltip.
 */
function warningLabelSpanHtml(labelText, { title = '', extraStyle = '', extraAttrs = '' } = {}) {
  const text = withLeadingWarningEmoji(labelText);
  const titleAttr = title ? ` title="${title}"` : '';
  const attrs = extraAttrs ? ` ${extraAttrs}` : '';
  const style = `cursor: help; font-size: 16px; color: ${WARNING_LABEL_COLOR};${extraStyle ? ` ${extraStyle}` : ''}`;
  return `<span style="${style}"${titleAttr}${attrs}>${text}</span>`;
}

/**
 * Grey-out / disable visual for exclusive settings checkboxes
 * (Hide Stop, Persistent Powersaver, stamina API, etc.).
 */
function applyExclusiveCheckboxLock(checkbox, {
  locked,
  lockedChecked,
  unlockedChecked,
  lockMessage,
  unlockedTitle = '',
}) {
  if (!checkbox) return;
  const label = checkbox.closest('label');
  const span = label?.querySelector('span');

  if (locked) {
    checkbox.disabled = true;
    checkbox.checked = !!lockedChecked;
    checkbox.title = lockMessage || '';
    if (label) {
      label.style.cursor = 'not-allowed';
      label.style.opacity = '0.5';
    }
    if (span) {
      span.style.cursor = 'help';
      span.title = lockMessage || '';
    }
    return;
  }

  checkbox.disabled = false;
  checkbox.checked = !!unlockedChecked;
  checkbox.title = '';
  if (label) {
    label.style.cursor = 'pointer';
    label.style.opacity = '1';
  }
  if (span) {
    if (unlockedTitle) {
      span.style.cursor = 'help';
      span.title = unlockedTitle;
    } else {
      span.style.cursor = '';
      span.removeAttribute('title');
    }
  }
}

/** HTML attrs for exclusive checkbox labels rendered into settings templates. */
function getExclusiveCheckboxHtmlState({ locked, checked, lockMessage, unlockedTitle = '' }) {
  const labelStyle = locked ? 'cursor: not-allowed; opacity: 0.5;' : 'cursor: pointer;';
  const inputExtra = locked
    ? `disabled title="${lockMessage}"`
    : '';
  const spanTitle = locked ? lockMessage : unlockedTitle;
  return { labelStyle, inputExtra, spanTitle, checked: !!checked };
}

/** Poll while the settings modal containing `content` is open. */
function watchSettingsModalWhileOpen(content, onTick, intervalMs = 1000) {
  if (!content || typeof onTick !== 'function') return null;

  let observer = null;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(timer);
    if (observer) {
      try {
        observer.disconnect();
      } catch (_) { /* ignore */ }
      observer = null;
    }
    const idx = modSettingsModalWatchCleanups.indexOf(cleanup);
    if (idx >= 0) modSettingsModalWatchCleanups.splice(idx, 1);
  };

  const timer = setInterval(() => {
    if (!document.contains(content)) {
      cleanup();
      return;
    }
    onTick();
  }, intervalMs);

  // createModal uses role="dialog" (no .modal class). Fall back to content root.
  const modal =
    content.closest('[role="dialog"]') ||
    content.closest('.mod-settings-modal-root') ||
    content;
  observer = new MutationObserver(() => {
    if (!document.contains(modal) || !document.contains(content)) {
      cleanup();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  modSettingsModalWatchCleanups.push(cleanup);
  return timer;
}

/**
 * Bind a settings checkbox that can be locked by an exclusivity rule.
 * @param {object} opts
 * @param {HTMLInputElement} opts.checkbox
 * @param {HTMLElement} [opts.content] - modal content root (enables poll while open)
 * @param {() => boolean} opts.isLocked
 * @param {() => boolean} opts.getLockedChecked
 * @param {() => boolean} opts.getUnlockedChecked
 * @param {() => string} opts.getLockMessage
 * @param {() => string} [opts.getUnlockedTitle]
 * @param {(checked: boolean) => void} opts.onUnlockedChange
 * @param {() => void} [opts.onBeforeRefresh] - e.g. enforce forced config
 */
function bindExclusiveSettingsCheckbox({
  checkbox,
  content,
  isLocked,
  getLockedChecked,
  getUnlockedChecked,
  getLockMessage,
  getUnlockedTitle,
  onUnlockedChange,
  onBeforeRefresh,
}) {
  if (!checkbox) return;

  const refresh = () => {
    onBeforeRefresh?.();
    applyExclusiveCheckboxLock(checkbox, {
      locked: !!isLocked(),
      lockedChecked: !!getLockedChecked(),
      unlockedChecked: !!getUnlockedChecked(),
      lockMessage: getLockMessage() || '',
      unlockedTitle: getUnlockedTitle?.() || '',
    });
  };

  refresh();

  if (checkbox.dataset.modSettingsExclusiveBound !== 'true') {
    checkbox.dataset.modSettingsExclusiveBound = 'true';
    checkbox.addEventListener('change', () => {
      if (isLocked()) {
        refresh();
        return;
      }
      onUnlockedChange(!!checkbox.checked);
      refresh();
    });
  }

  if (content) {
    watchSettingsModalWhileOpen(content, refresh);
  }
}

// Create settings event handler for dropdowns
function createSettingsDropdownHandler(configKey, onChangeCallback) {
  return (dropdown) => {
    // Set initial state from config
    dropdown.value = config[configKey];
    
    dropdown.addEventListener('change', () => {
      config[configKey] = dropdown.value;
      saveConfig();
      onChangeCallback?.();
      console.log('[Mod Settings] Setting updated:', { [configKey]: config[configKey] });
    });
  };
}

// Show settings modal
function showSettingsModal() {
  try {
    if (document.querySelector('.mod-settings-modal-root')) {
      return;
    }

    teardownSettingsModal();

    const modalDimensions = getModSettingsModalDimensions();
    const columnWidths = getModSettingsColumnWidths(modalDimensions.width);

    // Create main content container with tabs
    const content = document.createElement('div');
    content.className = 'mod-settings-modal-root';
    
    // Apply sizing and layout styles to content (matching Autoscroller pattern)
    Object.assign(content.style, {
      width: '100%',
      height: '100%',
      minWidth: '0',
      maxWidth: '100%',
      minHeight: '0',
      maxHeight: 'none',
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 auto',
      border: '6px solid transparent',
      borderImage: 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill',
      backgroundImage: 'url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png")',
      padding: '8px'
    });
    
    // Create main content container with 2-column layout
    const mainContent = document.createElement('div');
    mainContent.className = 'mod-settings-main-panel';
    Object.assign(mainContent.style, {
      display: 'flex',
      flexDirection: 'row',
      gap: '8px',
      height: 'auto',
      flex: '1 1 0',
      minHeight: '0',
      maxHeight: 'none',
      overflow: 'hidden'
    });
    
    // Left column - Options
    const leftColumn = document.createElement('div');
    leftColumn.id = 'mod-settings-left-menu';
    leftColumn.dataset.selectedCategory = 'creatures';
    Object.assign(leftColumn.style, {
      width: `${columnWidths.leftWidth}px`,
      minWidth: `${columnWidths.leftWidth}px`,
      maxWidth: `${columnWidths.leftWidth}px`,
      height: '100%',
      flex: `0 0 ${columnWidths.leftWidth}px`,
      display: 'flex',
      flexDirection: 'column',
      padding: '0px',
      margin: '0px 10px 0px 0px',
      borderRight: '6px solid transparent',
      borderImage: 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill',
      overflowY: 'auto',
      minHeight: '0px'
    });
    
    // Right column - Checkboxes
    const rightColumn = document.createElement('div');
    Object.assign(rightColumn.style, {
      width: `${columnWidths.rightWidth}px`,
      minWidth: '0',
      maxWidth: `${columnWidths.rightWidth}px`,
      flex: '1 1 0',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '2px 12px 2px 2px',
      boxSizing: 'border-box'
    });
    
    // Helper function to apply menu item styling
    function applyMenuItemStyle(element, selected) {
      if (selected) {
        element.style.border = '6px solid transparent';
        element.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png") 6 fill';
        element.style.backgroundColor = 'transparent';
      } else {
        element.style.border = '6px solid transparent';
        element.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 6 fill';
        element.style.backgroundColor = 'transparent';
      }
    }

    function applyAdvancedActionButtonStyle(button, options = {}) {
      if (!button) return;
      const { fullWidth = false, variant = 'gray' } = options;
      const variantClassMap = {
        gray: ['frame-1', 'surface-regular', 'text-whiteRegular'],
        blue: ['frame-1-blue', 'surface-blue', 'text-whiteHighlight'],
        green: ['frame-1-green', 'surface-green', 'text-whiteHighlight'],
        red: ['frame-1-red', 'surface-red', 'text-whiteHighlight']
      };

      button.classList.add(
        'focus-style-visible',
        'pixel-font-16',
        'flex',
        'items-center',
        'justify-center',
        'tracking-wide'
      );
      (variantClassMap[variant] || variantClassMap.gray).forEach((className) => button.classList.add(className));

      Object.assign(button.style, {
        pointerEvents: 'auto',
        borderRadius: '2px',
        border: 'none',
        borderImage: '',
        background: '',
        color: '',
        fontSize: '13px',
        lineHeight: '1.2',
        padding: '2px 6px 3px 6px',
        minHeight: '24px',
        filter: 'none',
        transition: 'filter 0.15s ease, opacity 0.15s ease',
        fontFamily: '"Yalla", "Trebuchet MS", Arial, sans-serif',
        fontWeight: 'normal',
        textAlign: 'center'
      });

      if (fullWidth) {
        button.style.width = '100%';
      }

      if (button.dataset.advancedFramedStyleBound === 'true') return;
      button.dataset.advancedFramedStyleBound = 'true';

      button.addEventListener('mouseenter', () => {
        if (button.disabled) return;
        button.style.filter = 'brightness(1.15)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.filter = 'none';
      });
      button.addEventListener('mousedown', () => {
        if (button.disabled) return;
        button.style.filter = 'brightness(0.95)';
      });
      button.addEventListener('mouseup', () => {
        if (button.disabled) return;
        button.style.filter = 'brightness(1.15)';
      });
    }
    
    // Create menu items for left column
    let menuItems = [
      { id: 'creatures', label: t('mods.betterUI.menuCreatures'), selected: true },
      { id: 'depot-manager', label: t('mods.depot.title'), selected: false, requiresMod: true },
      { id: 'ui', label: t('mods.betterUI.menuUI'), selected: false },
      { id: 'gameplay', label: t('mods.betterUI.menuGameplay'), selected: false },
      { id: 'hotkeys', label: t('mods.betterUI.menuHotkeys'), selected: false },
      { id: 'hunt-analyzer', label: t('mods.betterUI.menuHuntAnalyzer'), selected: false, requiresMod: true },
      { id: 'vip-list', label: t('mods.betterUI.menuVipList'), selected: false, requiresMod: true },
      { id: 'ot-mods', label: t('mods.betterUI.menuOtMods'), selected: false, requiresMod: true },
      { id: 'mod-coordination', label: t('mods.betterUI.menuModCoordination'), selected: false },
      { id: 'advanced', label: t('mods.betterUI.menuAdvanced'), selected: false },
      { id: 'backup', label: t('mods.betterUI.menuBackup'), selected: false }
    ];

    const selectModSettingsCategory = (categoryId) => {
      leftColumn.dataset.selectedCategory = categoryId;
      menuItems.forEach((mi) => {
        const miElement = leftColumn.querySelector(`[data-mod-settings-category="${mi.id}"]`);
        if (miElement) {
          applyMenuItemStyle(miElement, mi.id === categoryId);
        }
      });
      updateRightColumn(categoryId);
    };

    modSettingsSelectCategoryHandler = selectModSettingsCategory;
    
    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'menu-item pixel-font-16';
      menuItem.dataset.modSettingsCategory = item.id;
      if (item.requiresMod) {
        menuItem.dataset.requiresMod = 'true';
      }
      Object.assign(menuItem.style, {
        cursor: 'pointer',
        padding: '2px 4px',
        borderRadius: '2px',
        textAlign: 'left',
        color: 'rgb(255, 255, 255)',
        background: 'none',
        filter: 'none'
      });
      
      // Create inner flex container
      const innerDiv = document.createElement('div');
      Object.assign(innerDiv.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      });
      
      const span = document.createElement('span');
      span.textContent = item.label;
      innerDiv.appendChild(span);
      menuItem.appendChild(innerDiv);
      
      applyMenuItemStyle(menuItem, item.selected);
      
      menuItem.addEventListener('click', () => {
        if (item.requiresMod) {
          const modAvailabilityByCategory = {
            'depot-manager': isDepotManagerModEnabled(),
            'hunt-analyzer': isHuntAnalyzerModEnabled(),
            'vip-list': isVipListModEnabled(),
            'ot-mods': isAnyOtModEnabled()
          };
          if (!modAvailabilityByCategory[item.id]) return;
        }
        selectModSettingsCategory(item.id);
      });
      
      // Add hover effect
      menuItem.addEventListener('mouseenter', () => {
        const isSelected = menuItem.style.borderImage && menuItem.style.borderImage.includes('pressed');
        if (!isSelected) {
          menuItem.style.background = 'rgba(255,255,255,0.08)';
        }
      });
      menuItem.addEventListener('mouseleave', () => {
        const isSelected = menuItem.style.borderImage && menuItem.style.borderImage.includes('pressed');
        if (!isSelected) {
          menuItem.style.background = 'none';
        }
      });
      
      leftColumn.appendChild(menuItem);
    });

    updateModSettingsMenuVisibility();
    
    // Function to update right column content based on selected category
    function updateRightColumn(categoryId) {
      clearModSettingsModalWatchers();
      clearModSettingsModalCoordinationSubs();
      rightColumn.innerHTML = '';
      
      if (categoryId === 'ui') {
        const uiContent = document.createElement('div');
        const uiSectionWrapperStyle =
          'margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.12); margin-bottom: 15px;';
        const uiSectionTitleStyle =
          'margin: 0 0 12px 0; color: #e8e8e8; font-size: 16px; font-weight: 600; text-align: left; padding-left: 8px;';
        const uiOptionStyle = 'margin-bottom: 15px;';
        const hideStopLocked = isAutomatorSeamlessAutoplayEnabled();
        const hideStopUi = getExclusiveCheckboxHtmlState({
          locked: hideStopLocked,
          checked: hideStopLocked || !!config.hideStopAfterDefeat,
          lockMessage: t('mods.betterUI.hideStopAfterDefeatSeamlessLock'),
        });
        uiContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <h4 style="${uiSectionTitleStyle}">${t('mods.betterUI.interfaceSectionModBar')}</h4>
            <div style="${uiOptionStyle} display: flex; align-items: center; gap: 10px;">
              <span style="color: #ccc;">${t('mods.betterUI.modButtonDisplay')}</span>
              <select id="mod-button-display-selector" style="width: fit-content; background: #333; color: #ccc; border: 1px solid #555; padding: 4px 20px 4px 10px; border-radius: 4px; pointer-events: auto;">
                <option value="text">${t('mods.betterUI.modButtonDisplayText')}</option>
                <option value="icon">${t('mods.betterUI.modButtonDisplayIcon')}</option>
              </select>
            </div>
            <div style="${uiOptionStyle} display: flex; align-items: center; gap: 10px;">
              <span style="color: #ccc;">${t('mods.betterUI.inventoryBorderStyle')}</span>
              <select id="inventory-border-style-selector" style="width: fit-content; background: #333; color: #ccc; border: 1px solid #555; padding: 4px 20px 4px 10px; border-radius: 4px; pointer-events: auto;">
                <option value="Original">Original</option>
                <option value="Demonic">Demonic</option>
                <option value="Frosty">Frosty</option>
                <option value="Venomous">Venomous</option>
                <option value="Divine">Divine</option>
                <option value="Undead">Undead</option>
                <option value="Prismatic">Prismatic</option>
              </select>
            </div>
            <div style="${uiOptionStyle} display: flex; align-items: center; gap: 10px;">
              <span style="color: #ccc;">${t('mods.betterUI.inventoryItemsPerColumn')}</span>
              <select id="inventory-items-per-column-selector" style="width: fit-content; background: #333; color: #ccc; border: 1px solid #555; padding: 4px 20px 4px 10px; border-radius: 4px; pointer-events: auto;">
                <option value="4">4</option>
                <option value="2">2</option>
                <option value="1">1</option>
              </select>
            </div>
            <div style="${uiOptionStyle}">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="persistent-inventory-toggle" style="transform: scale(1.2);">
                <span>${t('mods.betterUI.persistentInventory')}</span>
              </label>
            </div>
          </div>
          <div style="${uiSectionWrapperStyle}">
            <h4 style="${uiSectionTitleStyle}">${t('mods.betterUI.interfaceSectionNavigation')}</h4>
            <div style="${uiOptionStyle}">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="compact-nav-bar-toggle" style="transform: scale(1.2);">
                <span>${t('mods.betterUI.compactNavBar')}</span>
              </label>
            </div>
            <div style="${uiOptionStyle}">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="last-visited-map-toggle" style="transform: scale(1.2);">
                <span>${t('mods.betterUI.showReturnToMapButton')}</span>
              </label>
            </div>
            <div style="${uiOptionStyle}">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="stamina-timer-toggle" checked="" style="transform: scale(1.2);">
                <span>${t('mods.betterUI.showStaminaTimer')}</span>
              </label>
            </div>
            <div style="${uiOptionStyle}">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="playercount-toggle" style="transform: scale(1.2);">
                <span>${t('mods.betterUI.showPlayersOnline')}</span>
              </label>
            </div>
          </div>
          <div style="${uiSectionWrapperStyle}">
            <h4 style="${uiSectionTitleStyle}">${t('mods.betterUI.interfaceSectionSetup')}</h4>
            <div style="${uiOptionStyle}">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="setup-labels-toggle" checked="" style="transform: scale(1.2);">
                <span>${t('mods.betterUI.showSetupLabels')}</span>
              </label>
            </div>
            <div style="${uiOptionStyle}">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="setup-shortcuts-hover-toggle" checked="" style="transform: scale(1.2);">
                <span>${t('mods.betterUI.enableSetupShortcutsAndHover')}</span>
              </label>
            </div>
          </div>
          <div style="${uiSectionWrapperStyle}">
            <h4 style="${uiSectionTitleStyle}">${t('mods.betterUI.interfaceSectionAutoplaySession')}</h4>
            <div style="${uiOptionStyle}">
              <label style="display: flex; align-items: center; gap: 10px; ${hideStopUi.labelStyle}">
                <input type="checkbox" id="hide-stop-after-defeat-toggle" ${hideStopUi.checked ? 'checked' : ''} ${hideStopUi.inputExtra} style="transform: scale(1.2);">
                <span style="${hideStopUi.spanStyle}" ${hideStopUi.spanTitleAttr}>${t('mods.betterUI.hideStopAfterDefeat')}</span>
              </label>
            </div>
            <div style="${uiOptionStyle}">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="hide-power-saving-mode-toggle" style="transform: scale(1.2);">
                <span>${t('mods.betterUI.hidePowerSavingMode')}</span>
              </label>
            </div>
          </div>
          <div style="${uiSectionWrapperStyle}">
            <h4 style="${uiSectionTitleStyle}">${t('mods.betterUI.interfaceSectionPageLayout')}</h4>
            <div style="${uiOptionStyle}">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="remove-footer-toggle" style="transform: scale(1.2);">
                <span>${t('mods.betterUI.hideWebsiteFooter')}</span>
              </label>
            </div>
          </div>
        `;
        rightColumn.appendChild(uiContent);
      } else if (categoryId === 'creatures') {
        const creaturesContent = document.createElement('div');
        creaturesContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="rainbow-tiers-toggle" checked="" style="transform: scale(1.2);">
              <span>${t('mods.betterUI.enableMaxCreatures')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
            <span style="color: #ccc;">${t('common.color')}</span>
            <select id="color-picker" style="width: fit-content; background: #333; color: #ccc; border: 1px solid #555; padding: 4px 20px 4px 10px; border-radius: 4px; pointer-events: auto;">
              <option value="prismatic">Prismatic</option>
              <option value="demon" selected="">Demonic</option>
              <option value="ice">Frosty</option>
              <option value="poison">Venomous</option>
              <option value="gold">Divine</option>
              <option value="undead">Undead</option>
            </select>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="sealed-toggle" style="transform: scale(1.2);">
              <span>${t('mods.betterUI.enableSealed')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
            <span style="color: #ccc;">${t('common.color')}</span>
            <select id="sealed-color-picker" style="width: fit-content; background: #333; color: #ccc; border: 1px solid #555; padding: 4px 20px 4px 10px; border-radius: 4px; pointer-events: auto;">
              <option value="prismatic">Prismatic</option>
              <option value="demon">Demonic</option>
              <option value="ice">Frosty</option>
              <option value="poison">Venomous</option>
              <option value="gold">Divine</option>
              <option value="undead">Undead</option>
            </select>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="shinies-toggle" checked="" style="transform: scale(1.2);">
              <span>${t('mods.betterUI.enableShinies')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
            <span style="color: #ccc;">${t('common.color')}</span>
            <select id="shiny-color-picker" style="width: fit-content; background: #333; color: #ccc; border: 1px solid #555; padding: 4px 20px 4px 10px; border-radius: 4px; pointer-events: auto;">
              <option value="prismatic">Prismatic</option>
              <option value="demon">Demonic</option>
              <option value="ice">Frosty</option>
              <option value="poison">Venomous</option>
              <option value="gold" selected="">Divine</option>
              <option value="undead">Undead</option>
            </select>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="shiny-enemies-toggle" checked="" style="transform: scale(1.2);">
              ${warningLabelSpanHtml(t('mods.betterUI.shinyEnemies'), { title: t('mods.betterUI.shinyEnemiesWarning') })}
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="auto-hide-non-shiny-awakened-monsters-toggle" style="transform: scale(1.2);">
              ${warningLabelSpanHtml(t('mods.betterUI.autoHideNonShinyNonAwakenedMonsters'), { title: t('mods.betterUI.autoHideNonShinyNonAwakenedMonstersWarning') })}
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="advanced-stats-hover-toggle" style="transform: scale(1.2);">
              <span>${t('mods.betterUI.showAdvancedStatsOnHover')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="ability-hover-toggle" style="transform: scale(1.2);">
              <span>${t('mods.betterUI.showAbilityOnHover')}</span>
            </label>
          </div>
        `;
        rightColumn.appendChild(creaturesContent);
      } else if (categoryId === 'depot-manager') {
        const depotContent = document.createElement('div');
        depotContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="depot-enable-favorites-toggle" style="transform: scale(1.2);">
              <span>${t('mods.betterUI.enableFavorites')}</span>
            </label>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span style="color: #ccc;">${t('mods.depot.defaultFavoriteSymbol')}</span>
            <select id="depot-favorite-symbol-select" style="width: fit-content; background: #333; color: #ccc; border: 1px solid #555; padding: 4px 20px 4px 10px; border-radius: 4px; pointer-events: auto;">
              <option value="heart">Heart</option>
              <option value="hp">HP</option>
              <option value="attackdamage">AD</option>
              <option value="abilitypower">AP</option>
              <option value="attackspeed">APS</option>
              <option value="armor">ARM</option>
              <option value="magicresist">MR</option>
              <option value="speed">SPD</option>
              <option value="shinystar">Shiny</option>
            </select>
          </div>
          <div style="margin-top: 14px;">
            <button id="depot-reset-manager-btn" class="btn btn-secondary" style="color: #dc3545;">
              ${t('mods.betterUI.resetDepotManager')}
            </button>
          </div>
        `;
        rightColumn.appendChild(depotContent);
      } else if (categoryId === 'hotkeys') {
        const hotkeyRowStyle =
          'display: flex; align-items: center; gap: 10px; flex-wrap: nowrap; width: 100%; min-width: 0; box-sizing: border-box;';
        const hotkeyLabelStyle =
          'color: #ccc; flex: 1 1 auto; min-width: 0; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        const autoSetupHotkeyRowHtml = `
            <div class="hotkey-setup-row" style="${hotkeyRowStyle}">
              <span style="${hotkeyLabelStyle}">${t('mods.betterUI.hotkeyLabelAutoSetup')}</span>
              <button type="button" id="hotkey-auto-setup-capture-btn" title="${t('mods.betterUI.hotkeyCaptureTitle')}" style="pointer-events: auto;">
                U
              </button>
              <button type="button" id="hotkey-auto-setup-reset-btn" style="pointer-events: auto;">
                ${t('mods.betterUI.hotkeyResetBinding')}
              </button>
            </div>`;
        const setupHotkeyRowsHtml = [1, 2, 3, 4, 5, 6, 7, 8]
          .map(
            (i) => `
            <div class="hotkey-setup-row" style="${hotkeyRowStyle} margin-top: ${i === 1 ? '0' : '12px'};">
              <span style="${hotkeyLabelStyle}">${t('mods.betterUI.hotkeySetupLabel').replace('{n}', String(i))}</span>
              <button type="button" id="hotkey-setup-slot-${i}-capture-btn" title="${t('mods.betterUI.hotkeyCaptureTitle')}" style="pointer-events: auto;">
                F${i}
              </button>
              <button type="button" id="hotkey-setup-slot-${i}-reset-btn" style="pointer-events: auto;">
                ${t('mods.betterUI.hotkeyResetBinding')}
              </button>
            </div>`
          )
          .join('');
        const generalHotkeyRowsHtml = NAV_HOTKEY_ENTRIES.map((entry, index) =>
          hotkeyConfigRowHtml({
            captureId: entry.captureId,
            resetId: entry.resetId,
            labelHtml: t(entry.labelKey),
            initialDisplay: entry.initialDisplay,
            rowStyle: hotkeyRowStyle,
            labelStyle: hotkeyLabelStyle,
            marginTop: index > 0
          })
        ).join('');
        const battleHotkeyRowsHtml = HOTKEY_BATTLE_UI_ROWS.map((row) =>
          hotkeyConfigRowHtml({
            captureId: row.captureId,
            resetId: row.resetId,
            labelHtml: row.labelKey ? t(row.labelKey) : row.labelText,
            initialDisplay: row.initialDisplay,
            rowStyle: hotkeyRowStyle,
            labelStyle: hotkeyLabelStyle,
            marginTop: row.marginTop !== false
          })
        ).join('');
        const modsGatedHotkeyRowsHtml = HOTKEY_MODS_GATED_UI_ROWS.map((row) =>
          hotkeyConfigRowHtml({
            captureId: row.captureId,
            resetId: row.resetId,
            labelHtml: getModsGatedHotkeyLabelHtml(row),
            initialDisplay: row.initialDisplay,
            rowStyle: hotkeyRowStyle,
            labelStyle: hotkeyLabelStyle,
            marginTop: row.marginTop,
            rowId: row.rowId,
            labelId: row.labelId
          })
        ).join('');
        const hotkeysContent = document.createElement('div');
        hotkeysContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="enable-hotkeys-toggle" style="transform: scale(1.2);">
              <span style="color: #ccc;">${t('mods.betterUI.enableHotkeys')}</span>
            </label>
          </div>
          <div id="hotkeys-bindings-container">
          <div id="hotkeys-general-section-wrapper" style="margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.12); margin-bottom: 15px;">
            <h4 style="margin: 0 0 12px 0; color: #e8e8e8; font-size: 16px; font-weight: 600; text-align: left; padding-left: 8px;">${t('mods.betterUI.hotkeysSectionGeneral')}</h4>
            ${generalHotkeyRowsHtml}
          </div>
          <div id="hotkeys-battle-section-wrapper" style="margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.12); margin-bottom: 15px;">
            <div>
            <h4 style="margin: 0 0 12px 0; color: #e8e8e8; font-size: 16px; font-weight: 600; text-align: left; padding-left: 8px;">Battle</h4>
            </div>
            ${battleHotkeyRowsHtml}
          </div>
          <div id="hotkeys-mods-section-wrapper" style="margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.12);">
            <h4 style="margin: 0 0 12px 0; color: #e8e8e8; font-size: 16px; font-weight: 600; text-align: left; padding-left: 8px;">${t('mods.betterUI.hotkeysSectionMods')}</h4>
            <div id="hotkeys-mods-section">
              ${modsGatedHotkeyRowsHtml}
            </div>
          </div>
          <div id="hotkeys-setups-section-wrapper" style="margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.12);">
            <h4 style="margin: 0 0 12px 0; color: #e8e8e8; font-size: 16px; font-weight: 600; text-align: left; padding-left: 8px;">${t('mods.betterUI.hotkeysSectionSetups')}</h4>
            ${autoSetupHotkeyRowHtml}
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 12px 0;">
              <span style="color: #ccc;">${t('mods.betterUI.hotkeySetupSource')}</span>
              <select id="hotkey-setup-source-select" style="width: fit-content; background: #333; color: #ccc; border: 1px solid #555; padding: 4px 20px 4px 10px; border-radius: 4px; pointer-events: auto;">
                <option value="betterSetups">${t('mods.betterUI.hotkeySetupSourceBetterSetups')}</option>
                <option value="setupManager">${t('mods.betterUI.hotkeySetupSourceSetupManager')}</option>
              </select>
            </div>
            <div id="hotkeys-setups-section">${setupHotkeyRowsHtml}</div>
          </div>
          </div>
        `;
        rightColumn.appendChild(hotkeysContent);
      } else if (categoryId === 'gameplay') {
        // Read Bestiary Automator config values BEFORE creating HTML to ensure correct initial state
        const parsedAutomatorConfig = getAutomatorConfigFromStorage();
        const useApiForStaminaRefill = !!parsedAutomatorConfig.useApiForStaminaRefill;
        const persistAutoRefill = !!parsedAutomatorConfig.persistAutoRefillOnRefresh;
        const thresholdsEnabled = parsedAutomatorConfig.thresholdsEnabled !== false;
        const persistPowerUi = getExclusiveCheckboxHtmlState({
          locked: !!config.hidePowerSavingMode,
          checked: !!config.persistPowerSavingMode && !config.hidePowerSavingMode,
          lockMessage: t('mods.betterUI.persistPowerSavingModeHideLock'),
          unlockedTitle: t('mods.betterUI.persistPowerSavingModeWarning'),
        });
        const staminaApiUi = getExclusiveCheckboxHtmlState({
          locked: thresholdsEnabled,
          checked: thresholdsEnabled ? true : useApiForStaminaRefill,
          lockMessage: t('mods.betterUI.useApiForStaminaRefillThresholdsLock'),
          unlockedTitle: t('mods.betterUI.useApiForStaminaRefillWarning'),
        });

        const turboSpeedupFactor = getTurboSpeedupFactor();

        const gameplayContent = document.createElement('div');
        gameplayContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; cursor: pointer;">
              <input type="checkbox" id="autoplay-refresh-toggle" checked="" style="transform: scale(1.2);">
              ${warningLabelSpanHtml('', { title: t('mods.betterUI.autoplayRefreshWarning') })}
              <select id="autoplay-refresh-timer-mode" style="width: fit-content; background: #333; color: #ccc; border: 1px solid #555; padding: 4px 30px 4px 10px; border-radius: 4px; pointer-events: auto;" title="${t('mods.betterUI.autoplayRefreshTimerModeWarning')}" onclick="event.stopPropagation();">
                <option value="autoplay">${t('mods.betterUI.autoplaySessionText')}</option>
                <option value="internal">${t('mods.betterUI.internalTimer')}</option>
                <option value="both">${t('mods.betterUI.bothTimers')}</option>
              </select>
              <span style="color: #ccc;">${t('mods.betterUI.refreshesBrowserEvery')}</span>
              <input type="number" id="autoplay-refresh-minutes" value="30" min="1" max="120" style="width: 50px; padding: 4px 4px; border: 1px solid #555; background: #2a2a2a; color: #fff; border-radius: 4px; text-align: center; pointer-events: auto;" onclick="event.stopPropagation();">
              <span style="color: #ccc;">${t('mods.betterUI.autoplayRefreshMinutesText')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="persist-automator-autorefill-toggle" ${persistAutoRefill ? 'checked' : ''} style="transform: scale(1.2);">
              ${warningLabelSpanHtml(t('mods.betterUI.persistAutomatorAutoRefill'), { title: t('mods.betterUI.persistAutomatorAutoRefillWarning') })}
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; ${persistPowerUi.labelStyle}">
              <input type="checkbox" id="persist-power-saving-mode-toggle" ${persistPowerUi.checked ? 'checked' : ''} ${persistPowerUi.inputExtra} style="transform: scale(1.2);">
              ${warningLabelSpanHtml(t('mods.betterUI.persistPowerSavingMode'), { title: persistPowerUi.spanTitle })}
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; ${staminaApiUi.labelStyle}">
              <input type="checkbox" id="automator-api-stamina-refill-toggle" ${staminaApiUi.checked ? 'checked' : ''} ${staminaApiUi.inputExtra} style="transform: scale(1.2);">
              ${warningLabelSpanHtml(t('mods.betterUI.useApiForStaminaRefill'), { title: staminaApiUi.spanTitle })}
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="disable-auto-reload-toggle" style="transform: scale(1.2);">
              ${warningLabelSpanHtml(t('mods.betterUI.disableAutoReload'), { title: t('mods.betterUI.disableAutoReloadWarning') })}
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="anti-idle-sounds-toggle" style="transform: scale(1.2);">
              ${warningLabelSpanHtml(t('mods.betterUI.antiIdleLabel'), { title: t('mods.betterUI.antiIdleTooltip') })}
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label id="run-tracker-toggle-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <span id="run-tracker-unavailable-warning" hidden style="cursor: help; color: #f0c36d; font-size: 12px; display: inline-flex; align-items: center;">⚠️</span>
              <input type="checkbox" id="run-tracker-toggle" style="transform: scale(1.2);">
              ${warningLabelSpanHtml(t('mods.betterUI.disableRunTracker'), { title: t('mods.betterUI.disableRunTrackerWarning') })}
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="always-navigate-max-floor-toggle" style="transform: scale(1.2);">
              ${warningLabelSpanHtml(t('mods.betterUI.alwaysNavigateMaxFloor'), { title: t('mods.betterUI.alwaysNavigateMaxFloorWarning') })}
            </label>
          </div>
          <div id="turbo-speed-settings-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px;">
            <h4 style="margin: 0 0 12px 0; color: #ffaa00; font-size: 14px; display: flex; align-items: center; gap: 6px;">
              <span id="turbo-speed-settings-unavailable-warning" hidden style="cursor: help; color: #f0c36d; font-size: 12px;">⚠️</span>
              ${t('mods.turbo.configTitle')}
              ${warningLabelSpanHtml('', { title: `Adjust the slider to control how much faster the game runs when Turbo is enabled. Higher values make the game run faster but may cause performance issues on some devices. Default game speed is 1x (${TURBO_DEFAULT_TICK_INTERVAL_MS}ms per tick). Turbo speeds range from 2x to 10x with performance optimizations.` })}
            </h4>
            <div style="display: flex; flex-direction: column; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #ccc;">
                <span>${t('mods.turbo.speedFactor')}</span>
                <span id="turbo-speed-value">${turboSpeedupFactor}x</span>
              </div>
              <input type="range" id="turbo-speed-slider" min="2" max="10" step="1" value="${turboSpeedupFactor}" style="width: 100%; pointer-events: auto;" onclick="event.stopPropagation();">
            </div>
          </div>
        `;
        rightColumn.appendChild(gameplayContent);
      } else if (categoryId === 'advanced') {
        const advancedContent = document.createElement('div');
        advancedContent.innerHTML = `
          <div id="firebase-runs-settings-section" style="margin-top: 0; padding-top: 0;">
            <div style="margin-bottom: 15px; text-align: center;">
              <h4 style="margin: 0 0 15px 0; color: #ffaa00; font-size: 14px; cursor: help; display: inline-flex; align-items: center; gap: 6px; justify-content: center;" title="${t('mods.betterUI.firebaseBestRunsUploadTooltip')}">
                <span id="firebase-runs-unavailable-warning" hidden style="cursor: help; color: #f0c36d; font-size: 12px;">⚠️</span>
                ${withLeadingWarningEmoji(t('mods.betterUI.firebaseBestRunsUploadTitle'))}
              </h4>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="firebase-runs-upload-toggle" style="transform: scale(1.2);">
                <span style="color: #ccc;">${t('mods.betterUI.firebaseBestRunsUploadLabel')}</span>
              </label>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="auto-upload-runs-toggle" style="transform: scale(1.2);">
                <span style="color: #ccc;">${t('mods.betterUI.firebaseAutoUploadRunsLabel')}</span>
              </label>
            </div>
            <div id="firebase-upload-regions-section" style="margin-bottom: 15px;">
              <button type="button" id="firebase-upload-regions-header" aria-expanded="false" title="${t('mods.betterUI.firebaseUploadRegionsExpandHint')}" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 170, 0, 0.35); border-radius: 4px; padding: 8px 10px; margin: 0; color: #eee; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; text-align: left; pointer-events: auto; transition: background 0.15s ease, border-color 0.15s ease;" onclick="event.stopPropagation();">
                <span style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                  <span id="firebase-upload-regions-chevron" aria-hidden="true" style="color: #ffaa00; font-size: 13px; width: 14px; display: inline-block; flex-shrink: 0;">▸</span>
                  <span style="font-weight: 600; color: #ffaa00;">${t('mods.betterUI.firebaseUploadRegionsLabel')}</span>
                </span>
                <span id="firebase-upload-regions-expand-hint" style="color: #9aa5b5; font-size: 11px; white-space: nowrap; flex-shrink: 0;">${t('mods.betterUI.firebaseUploadRegionsExpandHint')}</span>
              </button>
              <div id="firebase-upload-regions-panel" hidden style="margin-top: 8px; padding: 10px 10px 4px 14px; border-left: 2px solid rgba(255, 170, 0, 0.25);">
                <p style="color: #7f8fa4; font-size: 11px; margin: 0 0 8px 0;">${t('mods.betterUI.firebaseUploadRegionsDesc')}</p>
                <div id="firebase-upload-regions-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 180px; overflow-y: auto; padding-right: 4px;">
                </div>
              </div>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: flex; flex-direction: column; gap: 5px;">
                <span style="color: #ccc; font-size: 13px;">${t('mods.betterUI.firebaseRunsPasswordLabel')}</span>
                <input type="password" id="firebase-runs-password" placeholder="${t('mods.betterUI.firebaseRunsPasswordPlaceholder')}" maxlength="20" style="width: 100%; padding: 6px; border: 1px solid #555; background: #2a2a2a; color: #fff; border-radius: 4px; pointer-events: auto;" onclick="event.stopPropagation();">
              </label>
            </div>
            <div style="margin-bottom: 15px; display: flex; gap: 8px; flex-wrap: nowrap;">
              <button id="upload-runs-btn" class="btn btn-primary" style="flex: 1; min-width: 0; pointer-events: auto; opacity: 0.5; cursor: not-allowed;" disabled onclick="event.stopPropagation();">
                ${t('mods.betterUI.firebaseRunsUploadButton')}
              </button>
              <button id="download-runs-btn" class="btn btn-secondary" style="flex: 1; min-width: 0; pointer-events: auto;" onclick="event.stopPropagation();">
                ${t('mods.betterUI.firebaseRunsDownloadButton')}
              </button>
              <button id="delete-runs-btn" class="btn btn-secondary" style="flex: 1; min-width: 0; pointer-events: auto;" onclick="event.stopPropagation();">
                ${t('mods.betterUI.firebaseRunsDeleteButton')}
              </button>
            </div>
            <div id="firebase-runs-status" style="margin-top: 10px; font-size: 12px; color: #7f8fa4; min-height: 20px;">
            </div>
          </div>
          <div id="guild-skill-admin-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); display: none;">
            <h4 style="margin: 0 0 10px 0; color: #ff6b6b; font-size: 14px;">Guild skill admin</h4>
            <p style="margin: 0 0 12px 0; font-size: 11px; color: #888;">Only names in Firebase <code>config/admins</code>. Deletes <strong>skill-progress</strong>, <strong>player-skills</strong>, and <strong>player-equipment</strong> for <strong>all players</strong>.</p>
            <div style="margin-bottom: 12px;">
              <button type="button" id="guild-skill-reset-btn" class="btn btn-secondary" style="width: 100%; pointer-events: auto; color: #ffb4b4;">Reset all players — skills, progress &amp; equipment</button>
            </div>
            <div id="guild-skill-reset-status" style="font-size: 12px; color: #7f8fa4; min-height: 18px;"></div>
          </div>
          <div id="challenges-admin-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); display: none;">
            <h4 style="margin: 0 0 10px 0; color: #ff6b6b; font-size: 14px;">Challenges admin</h4>
            <p style="margin: 0 0 12px 0; font-size: 11px; color: #888;">Only names in Firebase <code>config/admins</code>. Clears Firebase challenge data for <strong>all players</strong>. Solo personal runs in localStorage are not affected.</p>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px;">
              <button type="button" id="challenges-clear-solo-btn" class="btn btn-secondary" style="width: 100%; pointer-events: auto; color: #ffb4b4;">Clear solo global leaderboard</button>
              <button type="button" id="challenges-clear-multiplayer-btn" class="btn btn-secondary" style="width: 100%; pointer-events: auto; color: #ffb4b4;">Clear multiplayer queue, matches &amp; ratings</button>
            </div>
            <div id="challenges-admin-status" style="font-size: 12px; color: #7f8fa4; min-height: 18px;"></div>
          </div>
        `;
        rightColumn.appendChild(advancedContent);
      } else if (categoryId === 'hunt-analyzer') {
        const huntAnalyzerContent = document.createElement('div');
        huntAnalyzerContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="hunt-analyzer-persist-toggle" style="transform: scale(1.2);">
              ${warningLabelSpanHtml(t('mods.betterUI.huntPersistLabel'), { title: t('mods.betterUI.huntPersistTooltip') })}
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="hunt-analyzer-creature-sell-value-toggle" style="transform: scale(1.2);">
              <span style="cursor: help; font-size: 16px; color: #fff;" title="${t('mods.betterUI.huntIncludeCreatureSellTooltip')}">${t('mods.betterUI.huntIncludeCreatureSellLabel')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="hunt-analyzer-dragon-plant-collect-toggle" style="transform: scale(1.2);">
              <span style="cursor: help; font-size: 16px; color: #fff;" title="${t('mods.betterUI.huntIncludeDragonPlantCollectTooltip')}">${t('mods.betterUI.huntIncludeDragonPlantCollectLabel')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="hunt-analyzer-disenchant-value-toggle" style="transform: scale(1.2);">
              <span style="cursor: help; font-size: 16px; color: #fff;" title="${t('mods.betterUI.huntIncludeDisenchantedEquipmentsTooltip')}">${t('mods.betterUI.huntIncludeDisenchantedEquipmentsLabel')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
            <span style="color: #ccc;">${t('mods.betterUI.huntThemeLabel')}</span>
            <select id="hunt-analyzer-theme-selector" style="width: fit-content; background: #333; color: #ccc; border: 1px solid #555; padding: 4px 20px 4px 10px; border-radius: 4px; pointer-events: auto;">
              ${(() => {
                // Dynamically get available themes from Hunt Analyzer if available
                let themeOptions = '<option value="original" selected="">Original</option>';
                try {
                  // Try to access HUNT_ANALYZER_THEMES from window if exposed, or use default
                  if (window.HuntAnalyzerState && window.HuntAnalyzerState.settings) {
                    // Themes are defined in Hunt Analyzer.js - if we can access them, list all
                    // For now, we'll dynamically populate when the selector is initialized
                  }
                } catch (e) {}
                return themeOptions;
              })()}
            </select>
          </div>

          <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; margin-top: 5px;">
            <span style="color: #fff; font-size: 14px; font-weight: bold;">${t('mods.betterUI.huntVisibilityTitle')}</span>
            <p style="color: #7f8fa4; font-size: 12px; margin: 4px 0 10px 0;">${t('mods.betterUI.huntVisibilityDesc')}</p>
            
            <div style="margin-bottom: 10px;">
              <span style="color: #aaa; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${t('mods.betterUI.huntVisInfoSection')}</span>
              <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="sessions" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisSessions')}</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="playtime" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisPlaytime')}</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="stamina" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisStamina')}</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="winLoss" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisWinLoss')}</span>
                </label>
              </div>
            </div>

            <div style="margin-bottom: 10px;">
              <span style="color: #aaa; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${t('mods.betterUI.huntVisRatesSection')}</span>
              <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="goldRate" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisGoldRate')}</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="creatureRate" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisCreatureRate')}</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="equipmentRate" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisEquipmentRate')}</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="runeRate" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisRuneRate')}</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="expRate" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisExpRate')}</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="staminaRate" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisStaminaRate')}</span>
                </label>
              </div>
            </div>

            <div style="margin-bottom: 10px;">
              <span style="color: #aaa; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${t('mods.betterUI.huntVisTotalsSection')}</span>
              <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="goldTotal" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisGoldTotal')}</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="dustTotal" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisDustTotal')}</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="shinyTotal" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisShinyTotal')}</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="sealedTotal" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisSealedTotal')}</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" class="ha-visibility-toggle" data-vis-key="runesTotal" checked style="cursor: pointer;">
                  <span style="font-size: 13px;">${t('mods.betterUI.huntVisRunesTotal')}</span>
                </label>
              </div>
            </div>
          </div>
        `;
        rightColumn.appendChild(huntAnalyzerContent);
      } else if (categoryId === 'vip-list') {
        const vipListContent = document.createElement('div');
        vipListContent.innerHTML = `
          <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
            <span style="color: #ccc;">${t('mods.betterUI.vipListInterface')}</span>
            <select id="vip-list-interface-selector" style="width: fit-content; background: #333; color: #ccc; border: 1px solid #555; padding: 4px 20px 4px 10px; border-radius: 4px; pointer-events: auto;">
              <option value="modal">${t('mods.betterUI.vipListInterfaceModal')}</option>
              <option value="panel">${t('mods.betterUI.vipListInterfacePanel')}</option>
            </select>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="enable-vip-list-chat-toggle" style="transform: scale(1.2);">
              <span>${t('mods.betterUI.enableVipListChat')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
            <span style="color: #ccc;">${t('mods.betterUI.vipListMessageFilter')}</span>
            <select id="vip-list-message-filter-selector" style="width: fit-content; background: #333; color: #ccc; border: 1px solid #555; padding: 4px 20px 4px 10px; border-radius: 4px; pointer-events: auto;">
              <option value="all">${t('mods.betterUI.vipListMessageFilterAll')}</option>
              <option value="friends">${t('mods.betterUI.vipListMessageFilterFriends')}</option>
            </select>
          </div>
        `;
        rightColumn.appendChild(vipListContent);
        
        // Add footer at the bottom
        const vipListFooter = document.createElement('div');
        vipListFooter.style.cssText = 'margin-top: auto; padding-top: 10px;';
        vipListFooter.innerHTML = `
          <a href="https://github.com/styrserver/BestiaryArena-SuperMod-Loader/blob/main/docs/chat_documentation.md" target="_blank" rel="noopener noreferrer" style="color: #4a9eff; text-decoration: none; font-size: 13px;">📖 ${t('mods.betterUI.vipListChatDocumentation')}</a>
        `;
        rightColumn.appendChild(vipListFooter);
      } else if (categoryId === 'ot-mods') {
        const otModsContent = document.createElement('div');
        otModsContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="disable-quest-helpers-toggle" style="transform: scale(1.2);">
              ${warningLabelSpanHtml(t('mods.betterUI.disableQuestHelpers'), { title: t('mods.betterUI.disableQuestHelpersWarning') })}
            </label>
          </div>
          <div id="ot-mods-quests-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
            <h4 style="margin: 0 0 12px 0; color: #ffaa00; font-size: 14px; display: flex; align-items: center; gap: 6px;">
              <span id="reset-all-quests-unavailable-warning" hidden style="cursor: help; color: #f0c36d; font-size: 12px;">⚠️</span>
              ${t('mods.betterUI.otModsQuestsSectionTitle')}
            </h4>
            <p style="margin: 0 0 12px 0; color: #9aa5b5; font-size: 12px; line-height: 1.4;">
              ${t('mods.betterUI.resetAllQuestsWarning')}
            </p>
            <button type="button" id="reset-all-quests-btn" class="btn btn-secondary" style="color: #dc3545;">
              ${t('mods.betterUI.resetAllQuests')}
            </button>
            <p id="reset-all-quests-status" style="margin: 10px 0 0 0; color: #9aa5b5; font-size: 12px; min-height: 16px;"></p>
          </div>
        `;
        rightColumn.appendChild(otModsContent);
      } else if (categoryId === 'mod-coordination') {
        const modCoordinationContent = document.createElement('div');
        modCoordinationContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <div style="display: flex; align-items: flex-start; gap: 8px; padding: 10px; background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 4px; margin-bottom: 15px;">
              <span style="font-size: 18px; color: #ffc107; flex-shrink: 0;">⚠️</span>
              <p style="color: #ffc107; margin: 0; font-size: 13px; line-height: 1.4;">
                ${t('mods.betterUI.modCoordinationWarning')}
              </p>
            </div>
            <p style="color: #a6adc8; margin: 0 0 10px 0; font-size: 13px;">
              ${t('mods.betterUI.modCoordinationDescription')}
            </p>
            <div id="mod-coordination-list" style="display: flex; flex-direction: column; gap: 4px;">
              <!-- Mod priority inputs will be dynamically generated here -->
            </div>
          </div>
        `;
        rightColumn.appendChild(modCoordinationContent);
        
        // Load and display mod priorities
        scheduleTimeout(() => {
          const statusMap = loadAndDisplayModPriorities(modCoordinationContent);
          
          // Subscribe to mod state changes to update status dynamically
          if (window.ModCoordination) {
            // Listen for enabled state changes
            const unsubscribeEnabled = window.ModCoordination.on('modEnabledChanged', (data) => {
              const statusSpan = statusMap[data.modName];
              if (statusSpan) {
                // Get current mod state
                const modState = window.ModCoordination.getModState(data.modName);
                if (modState) {
                  const priorityInput = statusSpan.parentElement.querySelector('input[data-mod-name="' + data.modName + '"]');
                  const currentPriority = priorityInput ? parseInt(priorityInput.value) : modState.priority;
                  updatePriorityStatus(statusSpan, modState, currentPriority);
                }
              }
            });
            
            // Listen for active state changes
            const unsubscribeActive = window.ModCoordination.on('modActiveChanged', (data) => {
              const statusSpan = statusMap[data.modName];
              if (statusSpan) {
                // Get current mod state
                const modState = window.ModCoordination.getModState(data.modName);
                if (modState) {
                  const priorityInput = statusSpan.parentElement.querySelector('input[data-mod-name="' + data.modName + '"]');
                  const currentPriority = priorityInput ? parseInt(priorityInput.value) : modState.priority;
                  updatePriorityStatus(statusSpan, modState, currentPriority);
                }
              }
            });
            
            // Store unsubscribe functions for cleanup on category leave / modal close
            modSettingsModalCoordinationUnsubscribers = [unsubscribeEnabled, unsubscribeActive];
          }
        }, 0);
      } else if (categoryId === 'backup') {
        const backupContent = document.createElement('div');
        backupContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <h3 style="margin-bottom: 10px; color: #fff; font-size: 14px;">${t('mods.betterUI.backupExportOptions')}</h3>
            
            <label id="export-run-data-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;">
              <span id="export-run-data-unavailable-warning" hidden style="cursor: help; color: #f0c36d; font-size: 12px; display: inline-flex; align-items: center;">⚠️</span>
              <input type="checkbox" id="export-run-data" checked style="cursor: pointer; transform: scale(1.2);">
              <span>${t('mods.betterUI.backupIncludeRunData')}</span>
            </label>
            <div id="run-data-info" style="margin-left: 28px; margin-bottom: 10px; font-size: 12px; color: #7f8fa4; display: none;">
            </div>
            
            <label id="export-hunt-analyzer-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;">
              <span id="export-hunt-analyzer-unavailable-warning" hidden style="cursor: help; color: #f0c36d; font-size: 12px; display: inline-flex; align-items: center;">⚠️</span>
              <input type="checkbox" id="export-hunt-analyzer" checked style="cursor: pointer; transform: scale(1.2);">
              <span>${t('mods.betterUI.backupIncludeHuntData')}</span>
            </label>
            <div id="hunt-analyzer-info" style="margin-left: 28px; margin-bottom: 15px; font-size: 12px; color: #7f8fa4; display: none;">
            </div>
          </div>
          
          <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; margin-top: 15px;">
            <h4 style="margin-bottom: 10px; color: #fff; font-size: 14px;">${t('mods.betterUI.backupActions')}</h4>
            <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-start;">
              <button id="export-config-btn" class="btn btn-primary">
                📤 ${t('mods.betterUI.backupExportButton')}
              </button>
              <button id="import-config-btn" class="btn btn-secondary">
                📥 ${t('mods.betterUI.backupImportButton')}
              </button>
              <button id="reset-all-settings-btn" class="btn btn-secondary" style="color: #dc3545; margin-top: 8px;">
                🔄 ${t('mods.betterUI.resetAllSettings')}
              </button>
            </div>
          </div>
        `;
        rightColumn.appendChild(backupContent);
      }
      
      // Re-attach event handlers for the new content
      scheduleTimeout(() => {
        attachEventHandlers(content);
      }, 0);
    }
    
    // Initialize with Creatures category selected
    updateRightColumn('creatures');
    
    // Add columns to main content
    mainContent.appendChild(leftColumn);
    mainContent.appendChild(rightColumn);
    
    // Add main content to content
    content.appendChild(mainContent);
    
    // Function to attach event handlers to dynamically loaded content
    function attachEventHandlers(content) {
      const staminaCheckbox = content.querySelector('#stamina-timer-toggle');
      if (staminaCheckbox) {
        createSettingsCheckboxHandler('showStaminaTimer',
          () => {
            if (timerState.element) {
              timerState.element.style.display = 'inline';
            } else {
              updateStaminaTimer();
            }
          },
          () => {
            if (timerState.element) {
              timerState.element.style.display = 'none';
            }
          }
        )(staminaCheckbox);
      }
    
      const depotFavoritesToggle = content.querySelector('#depot-enable-favorites-toggle');
      const depotSymbolSelect = content.querySelector('#depot-favorite-symbol-select');
      const depotResetButton = content.querySelector('#depot-reset-manager-btn');
      if (depotFavoritesToggle && depotSymbolSelect) {
        const depotCfg = readDepotConfigFromStorage();
        depotFavoritesToggle.checked = !!depotCfg.enableFavorites;
        const sym = depotCfg.favoriteSymbol || 'heart';
        depotSymbolSelect.value = depotSymbolSelect.querySelector(`option[value="${sym}"]`) ? sym : 'heart';
        depotFavoritesToggle.addEventListener('change', () => {
          const d = readDepotConfigFromStorage();
          d.enableCreatureDepot = true;
          d.enableFavorites = depotFavoritesToggle.checked;
          writeDepotConfigToStorage(d);
        });
        depotSymbolSelect.addEventListener('change', () => {
          const d = readDepotConfigFromStorage();
          d.enableCreatureDepot = true;
          d.favoriteSymbol = depotSymbolSelect.value;
          writeDepotConfigToStorage(d);
        });
      }
      if (depotResetButton) {
        let depotResetConfirmArmed = false;
        let depotResetConfirmTimeout = null;
        depotResetButton.addEventListener('click', () => {
          if (!depotResetConfirmArmed) {
            depotResetConfirmArmed = true;
            depotResetButton.textContent = t('mods.betterUI.depotResetConfirmClick');
            depotResetButton.style.borderColor = '#dc3545';
            depotResetButton.style.background = 'rgba(220, 53, 69, 0.2)';
            if (depotResetConfirmTimeout) clearTimeout(depotResetConfirmTimeout);
            depotResetConfirmTimeout = setTimeout(() => {
              depotResetConfirmArmed = false;
              depotResetButton.textContent = t('mods.betterUI.resetDepotManager');
              depotResetButton.style.borderColor = '';
              depotResetButton.style.background = '';
              depotResetConfirmTimeout = null;
            }, 5000);
            return;
          }

          depotResetConfirmArmed = false;
          if (depotResetConfirmTimeout) {
            clearTimeout(depotResetConfirmTimeout);
            depotResetConfirmTimeout = null;
          }
          depotResetButton.textContent = t('mods.betterUI.resetDepotManager');
          depotResetButton.style.borderColor = '';
          depotResetButton.style.background = '';
          try {
            if (window.depotManager?.resetDepotCreatureIds) {
              window.depotManager.resetDepotCreatureIds();
            } else {
              localStorage.removeItem('depot-manager-depot-creature-ids');
              localStorage.removeItem('depot-manager-depot-equipment-ids-v1');
            }
            createToast({
              message: `<span class="text-success">✅ ${t('mods.betterUI.depotResetToastSuccess')}</span>`,
              type: 'success',
              duration: 2500
            });
          } catch (error) {
            console.error('[Mod Settings] Failed to reset Depot Manager:', error);
          }
        });
      }

      const rainbowCheckbox = content.querySelector('#rainbow-tiers-toggle');
      if (rainbowCheckbox) {
        createSettingsCheckboxHandler('enableMaxCreatures', applyMaxCreatures, removeMaxCreatures)(rainbowCheckbox);
      }

      const sealedCheckbox = content.querySelector('#sealed-toggle');
      if (sealedCheckbox) {
        createSettingsCheckboxHandler('enableSealed', applySealedCreatures, removeSealedCreatures)(sealedCheckbox);
      }

      const sealedColorPicker = content.querySelector('#sealed-color-picker');
      if (sealedColorPicker) {
        createSettingsDropdownHandler('sealedCreaturesColor', () => {
          if (config.enableSealed) applySealedCreatures();
          notifyBetterUICreatureCosmeticsChanged();
        })(sealedColorPicker);
      }
      
      const colorPicker = content.querySelector('#color-picker');
      if (colorPicker) {
        createSettingsDropdownHandler('maxCreaturesColor', () => {
          if (config.enableMaxCreatures) applyMaxCreatures();
          notifyBetterUICreatureCosmeticsChanged();
        })(colorPicker);
      }
      
      const shiniesCheckbox = content.querySelector('#shinies-toggle');
      if (shiniesCheckbox) {
        createSettingsCheckboxHandler('enableMaxShinies', applyMaxShinies, removeMaxShinies)(shiniesCheckbox);
      }
      
      const shinyColorPicker = content.querySelector('#shiny-color-picker');
      if (shinyColorPicker) {
        createSettingsDropdownHandler('maxShiniesColor', () => {
          if (config.enableMaxShinies) applyMaxShinies();
          notifyBetterUICreatureCosmeticsChanged();
        })(shinyColorPicker);
      }
      
      const setupLabelsCheckbox = content.querySelector('#setup-labels-toggle');
      if (setupLabelsCheckbox) {
        createSettingsCheckboxHandler('showSetupLabels',
          () => {
            applySetupLabelsVisibility(true);
            console.log('[Mod Settings] Setup labels shown');
          },
          () => {
            applySetupLabelsVisibility(false);
            console.log('[Mod Settings] Setup labels hidden');
          }
        )(setupLabelsCheckbox);
      }

      const setupShortcutsHoverCheckbox = content.querySelector('#setup-shortcuts-hover-toggle');
      if (setupShortcutsHoverCheckbox) {
        createSettingsCheckboxHandler('enableSetupShortcutsAndHover',
          () => notifySetupShortcutsAndHoverChanged(true),
          () => notifySetupShortcutsAndHoverChanged(false)
        )(setupShortcutsHoverCheckbox);
      }
      
      const shinyEnemiesCheckbox = content.querySelector('#shiny-enemies-toggle');
      if (shinyEnemiesCheckbox) {
        createSettingsCheckboxHandler('enableShinyEnemies',
          () => {
            startBattleBoardObserver();
            applyShinyEnemies();
          },
          removeShinyEnemies
        )(shinyEnemiesCheckbox);
      }

      const advancedStatsHoverCheckbox = content.querySelector('#advanced-stats-hover-toggle');
      if (advancedStatsHoverCheckbox) {
        createSettingsCheckboxHandler(
          'showAdvancedStatsOnHover',
          applyAdvancedStatsOnHover,
          () => {
            if (isCreatureHoverTooltipEnabled()) {
              removeAdvancedStatsOnHover();
              applyAdvancedStatsOnHover();
            } else {
              removeAdvancedStatsOnHover();
            }
          }
        )(advancedStatsHoverCheckbox);
      }

      const abilityHoverCheckbox = content.querySelector('#ability-hover-toggle');
      if (abilityHoverCheckbox) {
        createSettingsCheckboxHandler(
          'showAbilityOnHover',
          applyAdvancedStatsOnHover,
          () => {
            if (isCreatureHoverTooltipEnabled()) {
              removeAdvancedStatsOnHover();
              applyAdvancedStatsOnHover();
            } else {
              removeAdvancedStatsOnHover();
            }
          }
        )(abilityHoverCheckbox);
      }
      
      const lastVisitedMapCheckbox = content.querySelector('#last-visited-map-toggle');
      if (lastVisitedMapCheckbox) {
        createSettingsCheckboxHandler('showLastVisitedMapButton',
          () => {
            console.log('[Mod Settings] Last visited map button enabled');
            loadLastVisitedMap();
            subscribeToMapChanges();
            addLastMapNavButton();
            updateReturnToMapHotkeyAvailability();
          },
          () => {
            console.log('[Mod Settings] Last visited map button disabled');
            if (!config.alwaysNavigateMaxFloor) {
              unsubscribeFromMapChanges();
            }
            removeLastMapNavButton();
            updateReturnToMapHotkeyAvailability();
          }
        )(lastVisitedMapCheckbox);
      }
      
      const compactNavBarCheckbox = content.querySelector('#compact-nav-bar-toggle');
      if (compactNavBarCheckbox) {
        createSettingsCheckboxHandler('compactNavBar',
          applyCompactNavBar,
          removeCompactNavBar
        )(compactNavBarCheckbox);
      }
      
      const removeFooterCheckbox = content.querySelector('#remove-footer-toggle');
      if (removeFooterCheckbox) {
        createSettingsCheckboxHandler('removeWebsiteFooter',
          hideWebsiteFooter,
          showWebsiteFooter
        )(removeFooterCheckbox);
      }

      const hideStopAfterDefeatCheckbox = content.querySelector('#hide-stop-after-defeat-toggle');
      if (hideStopAfterDefeatCheckbox) {
        bindExclusiveSettingsCheckbox({
          checkbox: hideStopAfterDefeatCheckbox,
          content,
          isLocked: isAutomatorSeamlessAutoplayEnabled,
          getLockedChecked: () => true,
          getUnlockedChecked: () => !!config.hideStopAfterDefeat,
          getLockMessage: () => t('mods.betterUI.hideStopAfterDefeatSeamlessLock'),
          onBeforeRefresh: enforceHideStopAfterDefeatForSeamlessAutoplay,
          onUnlockedChange: (checked) => {
            config.hideStopAfterDefeat = checked;
            saveConfig();
            applyAutoplaySessionCheckboxVisibility();
          },
        });
      }

      const hidePowerSavingModeCheckbox = content.querySelector('#hide-power-saving-mode-toggle');
      if (hidePowerSavingModeCheckbox) {
        createSettingsCheckboxHandler(
          'hidePowerSavingMode',
          disableAndWipePowerSavingMode,
          () => {
            applyAutoplaySessionCheckboxVisibility();
            updatePersistPowerSavingModeCheckboxState();
          }
        )(hidePowerSavingModeCheckbox);
      }

      const persistentInventoryCheckbox = content.querySelector('#persistent-inventory-toggle');
      if (persistentInventoryCheckbox) {
        createSettingsCheckboxHandler(
          'persistentInventory',
          () => {
            initializePersistentInventoryConfigForEnable();
            applyPersistentInventory();
          },
          () => disablePersistentInventory()
        )(persistentInventoryCheckbox);
      }
      
      const inventoryBorderStyleSelector = content.querySelector('#inventory-border-style-selector');
      if (inventoryBorderStyleSelector) {
        createSettingsDropdownHandler('inventoryBorderStyle', () =>
          refreshInventoryModButtonBorderStyle({ forceBorderRebuild: true })
        )(inventoryBorderStyleSelector);
      }

      const inventoryItemsPerColumnSelector = content.querySelector('#inventory-items-per-column-selector');
      if (inventoryItemsPerColumnSelector) {
        inventoryItemsPerColumnSelector.value = String(getInventoryItemsPerColumn());
        createSettingsDropdownHandler('inventoryItemsPerColumn', () => {
          config.inventoryItemsPerColumn = getInventoryItemsPerColumn();
          saveConfig();
          applyInventoryColumnsStyle();
          // Rebuild horizontal CSS (row count follows this setting).
          persistentInventoryState.horizontalLayoutCss = null;
          const root = findInventoryWidgetRoot();
          if (root && config.persistentInventory) {
            applyInventoryHorizontalLayout(root);
            void root.offsetHeight;
            if (
              config.inventoryWidgetPinned === true &&
              getSavedInventoryWidgetPosition().left != null
            ) {
              applyInventoryWidgetPosition(root);
            }
          }
        })(inventoryItemsPerColumnSelector);
      }

      const modButtonDisplaySelector = content.querySelector('#mod-button-display-selector');
      if (modButtonDisplaySelector) {
        createSettingsDropdownHandler('modButtonDisplay', refreshModBarButtonLabels)(modButtonDisplaySelector);
      }

      const enableHotkeysCheckbox = content.querySelector('#enable-hotkeys-toggle');
      const hotkeysBindingsContainer = content.querySelector('#hotkeys-bindings-container');
      const updateHotkeysBindingsVisibility = () => {
        if (hotkeysBindingsContainer) {
          hotkeysBindingsContainer.hidden = !config.enableHotkeys;
        }
        if (config.enableHotkeys) {
          scheduleTimeout(() => syncAllNavHotkeyCaptureDisplays(), 0);
        } else {
          refreshInventoryHotkeyBadges();
        }
      };
      if (enableHotkeysCheckbox) {
        createSettingsCheckboxHandler(
          'enableHotkeys',
          updateHotkeysBindingsVisibility,
          updateHotkeysBindingsVisibility
        )(enableHotkeysCheckbox);
      }
      updateHotkeysBindingsVisibility();

      bindAllHotkeyUiRowsInModal(content);
      const hotkeySetupSourceSelect = content.querySelector('#hotkey-setup-source-select');
      if (hotkeySetupSourceSelect) {
        createSettingsDropdownHandler('hotkeySetupSource')(hotkeySetupSourceSelect);
      }
      syncModDependentSettingsAvailability();

      const vipListInterfaceSelector = content.querySelector('#vip-list-interface-selector');
      if (vipListInterfaceSelector) {
        createSettingsDropdownHandler('vipListInterface')(vipListInterfaceSelector);
      }
      
      const vipListMessageFilterSelector = content.querySelector('#vip-list-message-filter-selector');
      if (vipListMessageFilterSelector) {
        createSettingsDropdownHandler('vipListMessageFilter')(vipListMessageFilterSelector);
      }
      
      const enableVipListChatCheckbox = content.querySelector('#enable-vip-list-chat-toggle');
      if (enableVipListChatCheckbox) {
        enableVipListChatCheckbox.checked = config.enableVipListChat;
        
        enableVipListChatCheckbox.addEventListener('change', () => {
          config.enableVipListChat = enableVipListChatCheckbox.checked;
          saveConfig();
          
          // Update VIP List mod's messaging config if available
          if (window.VIPList && window.VIPList.updateMessagingConfig) {
            window.VIPList.updateMessagingConfig({ enabled: enableVipListChatCheckbox.checked });
          } else if (window.VIPList && window.VIPList.test) {
            // Fallback: try to access MESSAGING_CONFIG directly if exposed
            console.log('[Mod Settings] VIP List mod messaging config update attempted');
          }
          
          // Update VIP List mod's Global Chat state (now controlled by enableVipListChat)
          if (window.VIPList && typeof window.VIPList.updateGlobalChatState === 'function') {
            window.VIPList.updateGlobalChatState(enableVipListChatCheckbox.checked);
          }
          
          console.log('[Mod Settings] Chat', enableVipListChatCheckbox.checked ? 'enabled' : 'disabled');
        });
      }

    const turboSpeedSlider = content.querySelector('#turbo-speed-slider');
    const turboSpeedValue = content.querySelector('#turbo-speed-value');
    if (turboSpeedSlider) {
      const initialTurboSpeed = getTurboSpeedupFactor();
      turboSpeedSlider.value = String(initialTurboSpeed);
      if (turboSpeedValue) {
        turboSpeedValue.textContent = `${initialTurboSpeed}x`;
      }
      turboSpeedSlider.addEventListener('input', () => {
        const value = parseInt(turboSpeedSlider.value, 10);
        setTurboSpeedupFactor(value);
        if (turboSpeedValue) {
          turboSpeedValue.textContent = `${value}x`;
        }
      });
    }

    const autoplayRefreshCheckbox = content.querySelector('#autoplay-refresh-toggle');
    if (autoplayRefreshCheckbox) {
      autoplayRefreshCheckbox.checked = config.enableAutoplayRefresh;
      
      autoplayRefreshCheckbox.addEventListener('change', () => {
        config.enableAutoplayRefresh = autoplayRefreshCheckbox.checked;
        saveConfig();
        
        if (autoplayRefreshCheckbox.checked) {
          console.log('[Mod Settings] Autoplay refresh enabled via settings');
          startAutoplayRefreshMonitor();
        } else {
          console.log('[Mod Settings] Autoplay refresh disabled via settings');
          stopAutoplayRefreshMonitor();
        }
      });
    }
    
    const autoplayRefreshMinutesInput = content.querySelector('#autoplay-refresh-minutes');
    if (autoplayRefreshMinutesInput) {
      autoplayRefreshMinutesInput.value = config.autoplayRefreshMinutes;
      
      autoplayRefreshMinutesInput.addEventListener('input', () => {
        const minutes = parseInt(autoplayRefreshMinutesInput.value) || 30;
        config.autoplayRefreshMinutes = Math.max(1, Math.min(120, minutes));
        saveConfig();
        if (config.enableAutoplayRefresh) {
          stopAutoplayRefreshMonitor();
          startAutoplayRefreshMonitor();
        }
      });
    }
    
    const autoplayRefreshTimerModeSelect = content.querySelector('#autoplay-refresh-timer-mode');
    if (autoplayRefreshTimerModeSelect) {
      // Set initial value based on config (backward compatibility)
      if (config.autoplayRefreshTimerMode) {
        autoplayRefreshTimerModeSelect.value = config.autoplayRefreshTimerMode;
      } else {
        // Migrate old boolean config
        autoplayRefreshTimerModeSelect.value = config.useInternalTimer ? 'internal' : 'autoplay';
        config.autoplayRefreshTimerMode = autoplayRefreshTimerModeSelect.value;
        delete config.useInternalTimer;
        saveConfig();
      }
      
      autoplayRefreshTimerModeSelect.addEventListener('change', () => {
        const selectedMode = autoplayRefreshTimerModeSelect.value;
        config.autoplayRefreshTimerMode = selectedMode;
        saveConfig();
        
        if (config.enableAutoplayRefresh) {
          // Restart monitor to apply the new timer mode
          stopAutoplayRefreshMonitor();
          startAutoplayRefreshMonitor();
        }
      });
    }
    
    const persistAutomatorAutoRefillCheckbox = content.querySelector('#persist-automator-autorefill-toggle');
    if (persistAutomatorAutoRefillCheckbox) {
      // Set initial state from Bestiary Automator's config
      try {
        const automatorConfig = localStorage.getItem('bestiary-automator-config');
        const parsedConfig = automatorConfig ? JSON.parse(automatorConfig) : {};
        persistAutomatorAutoRefillCheckbox.checked = parsedConfig.persistAutoRefillOnRefresh || false;
      } catch (error) {
        console.error('[Mod Settings] Error reading Bestiary Automator config:', error);
      }
      
      persistAutomatorAutoRefillCheckbox.addEventListener('change', () => {
        const newValue = persistAutomatorAutoRefillCheckbox.checked;
        
        // Write directly to Bestiary Automator's localStorage
        try {
          const automatorConfig = localStorage.getItem('bestiary-automator-config');
          const config = automatorConfig ? JSON.parse(automatorConfig) : {};
          config.persistAutoRefillOnRefresh = newValue;
          localStorage.setItem('bestiary-automator-config', JSON.stringify(config));
          console.log('[Mod Settings] Updated Bestiary Automator localStorage persistAutoRefillOnRefresh:', newValue);
        } catch (error) {
          console.error('[Mod Settings] Error updating Bestiary Automator config:', error);
        }
        
        // Also update runtime if Bestiary Automator is loaded
        if (window.bestiaryAutomator && typeof window.bestiaryAutomator.updateConfig === 'function') {
          window.bestiaryAutomator.updateConfig({
            persistAutoRefillOnRefresh: newValue
          });
          console.log('[Mod Settings] Updated Bestiary Automator runtime config');
        }
      });
      }

    const persistPowerSavingModeCheckbox = content.querySelector('#persist-power-saving-mode-toggle');
    if (persistPowerSavingModeCheckbox) {
      bindExclusiveSettingsCheckbox({
        checkbox: persistPowerSavingModeCheckbox,
        content,
        isLocked: () => !!config.hidePowerSavingMode,
        getLockedChecked: () => false,
        getUnlockedChecked: () => !!config.persistPowerSavingMode,
        getLockMessage: () => t('mods.betterUI.persistPowerSavingModeHideLock'),
        getUnlockedTitle: () => t('mods.betterUI.persistPowerSavingModeWarning'),
        onUnlockedChange: (checked) => {
          config.persistPowerSavingMode = checked;
          if (config.persistPowerSavingMode) {
            // Session gating keeps the live box off while idle — enabling Persistent
            // Powersaver means the user wants it on during fights, not "remember unchecked".
            config.powerSavingModeEnabled = true;
          }
          saveConfig();
          applyAutoplaySessionCheckboxFeatures();
        },
      });
    }
      
      const automatorApiStaminaRefillCheckbox = content.querySelector('#automator-api-stamina-refill-toggle');
      if (automatorApiStaminaRefillCheckbox) {
        bindExclusiveSettingsCheckbox({
          checkbox: automatorApiStaminaRefillCheckbox,
          content,
          isLocked: isAutomatorThresholdsEnabled,
          getLockedChecked: () => true,
          getUnlockedChecked: () => !!getAutomatorConfigFromStorage().useApiForStaminaRefill,
          getLockMessage: () => t('mods.betterUI.useApiForStaminaRefillThresholdsLock'),
          getUnlockedTitle: () => t('mods.betterUI.useApiForStaminaRefillWarning'),
          onUnlockedChange: (newValue) => {
            try {
              const automatorConfig = getAutomatorConfigFromStorage();
              automatorConfig.useApiForStaminaRefill = newValue;
              localStorage.setItem('bestiary-automator-config', JSON.stringify(automatorConfig));
              console.log('[Mod Settings] Updated Bestiary Automator localStorage useApiForStaminaRefill:', newValue);
            } catch (error) {
              console.error('[Mod Settings] Error updating Bestiary Automator config:', error);
            }

            if (window.bestiaryAutomator && typeof window.bestiaryAutomator.updateConfig === 'function') {
              window.bestiaryAutomator.updateConfig({
                useApiForStaminaRefill: newValue
              });
              console.log('[Mod Settings] Updated Bestiary Automator runtime config');
            }
          },
        });
      }
      
      const disableAutoReloadCheckbox = content.querySelector('#disable-auto-reload-toggle');
      if (disableAutoReloadCheckbox) {
        disableAutoReloadCheckbox.checked = config.disableAutoReload;
        
        disableAutoReloadCheckbox.addEventListener('change', () => {
          config.disableAutoReload = disableAutoReloadCheckbox.checked;
          saveConfig();
          console.log('[Mod Settings] Auto-reload disabled:', config.disableAutoReload);
        });
      }
      
      const antiIdleSoundsCheckbox = content.querySelector('#anti-idle-sounds-toggle');
      if (antiIdleSoundsCheckbox) {
        antiIdleSoundsCheckbox.checked = config.enableAntiIdleSounds;
        
        antiIdleSoundsCheckbox.addEventListener('change', () => {
          config.enableAntiIdleSounds = antiIdleSoundsCheckbox.checked;
          saveConfig();
          
          if (antiIdleSoundsCheckbox.checked) {
            enableAntiIdleSounds();
          } else {
            disableAntiIdleSounds();
          }
        });
      }

      const disableQuestHelpersCheckbox = content.querySelector('#disable-quest-helpers-toggle');
      if (disableQuestHelpersCheckbox) {
        disableQuestHelpersCheckbox.checked = config.disableQuestHelpers;

        disableQuestHelpersCheckbox.addEventListener('change', () => {
          config.disableQuestHelpers = disableQuestHelpersCheckbox.checked;
          saveConfig();
          notifyQuestHelpersChanged(config.disableQuestHelpers);
          console.log('[Mod Settings] Quest helpers disabled:', config.disableQuestHelpers);
        });
      }

      const resetAllQuestsBtn = content.querySelector('#reset-all-quests-btn');
      const resetAllQuestsStatus = content.querySelector('#reset-all-quests-status');
      if (resetAllQuestsBtn) {
        applyAdvancedActionButtonStyle(resetAllQuestsBtn, { variant: 'red' });
        let resetAllQuestsConfirmArmed = false;
        let resetAllQuestsConfirmTimeout = null;
        const defaultResetAllQuestsLabel = t('mods.betterUI.resetAllQuests');

        resetAllQuestsBtn.addEventListener('click', async () => {
          if (!isQuestsModEnabled() || typeof window.resetAllQuests !== 'function') {
            if (resetAllQuestsStatus) {
              resetAllQuestsStatus.textContent = t('mods.betterUI.resetAllQuestsUnavailable');
            }
            return;
          }

          if (!resetAllQuestsConfirmArmed) {
            resetAllQuestsConfirmArmed = true;
            resetAllQuestsBtn.textContent = t('mods.betterUI.resetAllQuestsConfirmClick');
            if (resetAllQuestsStatus) {
              resetAllQuestsStatus.textContent = t('mods.betterUI.resetAllQuestsWarning');
              resetAllQuestsStatus.style.color = '#f0c36d';
            }
            if (resetAllQuestsConfirmTimeout) clearTimeout(resetAllQuestsConfirmTimeout);
            resetAllQuestsConfirmTimeout = setTimeout(() => {
              resetAllQuestsConfirmArmed = false;
              resetAllQuestsBtn.textContent = defaultResetAllQuestsLabel;
              if (resetAllQuestsStatus) {
                resetAllQuestsStatus.textContent = '';
                resetAllQuestsStatus.style.color = '#9aa5b5';
              }
              resetAllQuestsConfirmTimeout = null;
            }, 5000);
            return;
          }

          resetAllQuestsConfirmArmed = false;
          if (resetAllQuestsConfirmTimeout) {
            clearTimeout(resetAllQuestsConfirmTimeout);
            resetAllQuestsConfirmTimeout = null;
          }
          resetAllQuestsBtn.textContent = defaultResetAllQuestsLabel;
          resetAllQuestsBtn.disabled = true;
          if (resetAllQuestsStatus) {
            resetAllQuestsStatus.textContent = t('mods.betterUI.resetAllQuestsRunning');
            resetAllQuestsStatus.style.color = '#9aa5b5';
          }

          try {
            await window.resetAllQuests();
            if (resetAllQuestsStatus) {
              resetAllQuestsStatus.textContent = t('mods.betterUI.resetAllQuestsSuccess');
              resetAllQuestsStatus.style.color = '#7dcea0';
            }
            createToast({
              message: `<span class="text-success">✅ ${t('mods.betterUI.resetAllQuestsSuccess')}</span>`,
              type: 'success',
              duration: 3000
            });
          } catch (error) {
            console.error('[Mod Settings] Failed to reset all quests:', error);
            if (resetAllQuestsStatus) {
              resetAllQuestsStatus.textContent = t('mods.betterUI.resetAllQuestsFailed');
              resetAllQuestsStatus.style.color = '#dc3545';
            }
          } finally {
            resetAllQuestsBtn.disabled = false;
            updateOtModsSettingsAvailability();
          }
        });
      }
      updateOtModsSettingsAvailability();
      
      const runTrackerCheckbox = content.querySelector('#run-tracker-toggle');
      if (runTrackerCheckbox) {
        // Checkbox is reversed: checked = disabled, unchecked = enabled
        // Default to enabled (false = not disabled) if not set
        runTrackerCheckbox.checked = config.enableRunTracker === false;
        
        runTrackerCheckbox.addEventListener('change', async () => {
          // Checked means disabled, so enableRunTracker should be false
          config.enableRunTracker = !runTrackerCheckbox.checked;
          saveConfig();
          
          if (window.RunTrackerAPI) {
            if (runTrackerCheckbox.checked) {
              // Checkbox is checked = disabled
              await window.RunTrackerAPI.disable();
              console.log('[Mod Settings] Run Tracker disabled');
            } else {
              // Checkbox is unchecked = enabled
              await window.RunTrackerAPI.enable();
              console.log('[Mod Settings] Run Tracker enabled');
            }
          } else {
            console.warn('[Mod Settings] RunTracker API not available');
          }
        });
      }

      const alwaysNavigateMaxFloorCheckbox = content.querySelector('#always-navigate-max-floor-toggle');
      if (alwaysNavigateMaxFloorCheckbox) {
        alwaysNavigateMaxFloorCheckbox.checked = !!config.alwaysNavigateMaxFloor;

        alwaysNavigateMaxFloorCheckbox.addEventListener('change', () => {
          config.alwaysNavigateMaxFloor = alwaysNavigateMaxFloorCheckbox.checked;
          saveConfig();

          if (config.alwaysNavigateMaxFloor || config.showLastVisitedMapButton) {
            installReplayFloorGuardHook();
            subscribeToMapChanges();
          } else {
            unsubscribeFromMapChanges();
          }

          if (config.alwaysNavigateMaxFloor) {
            applyBestCompletedFloorForCurrentMap('settings-toggle');
          }
        });
      }

      const autoHideMonstersCheckbox = content.querySelector('#auto-hide-non-shiny-awakened-monsters-toggle');
      if (autoHideMonstersCheckbox) {
        autoHideMonstersCheckbox.checked = !!config.autoHideNonShinyNonAwakenedMonsters;
        autoHideMonstersCheckbox.addEventListener('change', () => {
          config.autoHideNonShinyNonAwakenedMonsters = autoHideMonstersCheckbox.checked;
          saveConfig();
          if (config.autoHideNonShinyNonAwakenedMonsters) {
            runAutoHideNonShinyAndNonAwakenedMonsters('settings-toggle');
          }
        });
      }
      
      // Firebase Best Runs Upload handlers
      const firebaseRunsUploadToggle = content.querySelector('#firebase-runs-upload-toggle');
      if (firebaseRunsUploadToggle) {
        firebaseRunsUploadToggle.checked = config.enableFirebaseRunsUpload || false;
        
        firebaseRunsUploadToggle.addEventListener('change', () => {
          config.enableFirebaseRunsUpload = firebaseRunsUploadToggle.checked;
          saveConfig();
          console.log('[Mod Settings] Firebase runs upload:', firebaseRunsUploadToggle.checked ? 'enabled' : 'disabled');
          
          // Start/stop auto-upload monitor
          if (firebaseRunsUploadToggle.checked && config.autoUploadRuns) {
            startAutoUploadMonitor();
          } else {
            stopAutoUploadMonitor();
          }
        });
      }
      
      const autoUploadRunsToggle = content.querySelector('#auto-upload-runs-toggle');
      if (autoUploadRunsToggle) {
        autoUploadRunsToggle.checked = config.autoUploadRuns || false;
        
        autoUploadRunsToggle.addEventListener('change', () => {
          config.autoUploadRuns = autoUploadRunsToggle.checked;
          saveConfig();
          console.log('[Mod Settings] Auto-upload runs:', autoUploadRunsToggle.checked ? 'enabled' : 'disabled');
          
          // Start/stop auto-upload monitor
          if (autoUploadRunsToggle.checked && config.enableFirebaseRunsUpload) {
            startAutoUploadMonitor();
          } else {
            stopAutoUploadMonitor();
          }
        });
      }

      initFirebaseUploadRegionToggles(content);
      
      const firebaseRunsPasswordInput = content.querySelector('#firebase-runs-password');
      const uploadRunsBtn = content.querySelector('#upload-runs-btn');
      if (uploadRunsBtn) applyAdvancedActionButtonStyle(uploadRunsBtn, { variant: 'blue' });
      const downloadRunsBtn = content.querySelector('#download-runs-btn');
      if (downloadRunsBtn) applyAdvancedActionButtonStyle(downloadRunsBtn, { variant: 'green' });
      const deleteRunsBtn = content.querySelector('#delete-runs-btn');
      if (deleteRunsBtn) applyAdvancedActionButtonStyle(deleteRunsBtn, { variant: 'red' });
      const statusDiv = content.querySelector('#firebase-runs-status');
      
      // Function to update upload button and checkbox states
      const updateUploadButtonState = () => {
        if (!isRunTrackerModEnabled()) {
          updateFirebaseRunsSettingsAvailability();
          return;
        }

        const hasPassword = config.firebaseRunsPassword && config.firebaseRunsPassword.length >= 5;
        
        if (uploadRunsBtn) {
          uploadRunsBtn.disabled = !hasPassword;
          uploadRunsBtn.style.opacity = hasPassword ? '1' : '0.5';
          uploadRunsBtn.style.cursor = hasPassword ? 'pointer' : 'not-allowed';
          uploadRunsBtn.style.filter = 'none';
          uploadRunsBtn.title = hasPassword ? '' : t('mods.betterUI.firebaseRunsPasswordRequiredTooltip');
        }
        
        // Update checkbox states
        if (firebaseRunsUploadToggle) {
          firebaseRunsUploadToggle.disabled = !hasPassword;
          const label = firebaseRunsUploadToggle.closest('label');
          if (label) {
            label.style.opacity = hasPassword ? '1' : '0.5';
            label.style.cursor = hasPassword ? 'pointer' : 'not-allowed';
          }
          if (!hasPassword && firebaseRunsUploadToggle.checked) {
            firebaseRunsUploadToggle.checked = false;
            config.enableFirebaseRunsUpload = false;
            saveConfig();
            stopAutoUploadMonitor();
          }
        }
        
        if (autoUploadRunsToggle) {
          autoUploadRunsToggle.disabled = !hasPassword;
          const label = autoUploadRunsToggle.closest('label');
          if (label) {
            label.style.opacity = hasPassword ? '1' : '0.5';
            label.style.cursor = hasPassword ? 'pointer' : 'not-allowed';
          }
          if (!hasPassword && autoUploadRunsToggle.checked) {
            autoUploadRunsToggle.checked = false;
            config.autoUploadRuns = false;
            saveConfig();
            stopAutoUploadMonitor();
          }
        }

        const regionSection = content.querySelector('#firebase-upload-regions-section');
        const regionPanel = content.querySelector('#firebase-upload-regions-panel');
        const regionHeader = content.querySelector('#firebase-upload-regions-header');
        const regionToggles = content.querySelectorAll('.firebase-upload-region-toggle');
        if (regionSection) {
          regionSection.style.opacity = hasPassword ? '1' : '0.5';
        }
        if (regionPanel) {
          regionPanel.style.pointerEvents = hasPassword ? 'auto' : 'none';
        }
        if (regionHeader) {
          regionHeader.style.pointerEvents = 'auto';
          regionHeader.style.cursor = 'pointer';
        }
        regionToggles.forEach((toggle) => {
          toggle.disabled = !hasPassword;
        });
      };
      modSettingsFirebaseUploadStateUpdater = updateUploadButtonState;
      
      if (firebaseRunsPasswordInput) {
        // Don't show the actual password, but show if one is set
        if (config.firebaseRunsPassword) {
          firebaseRunsPasswordInput.placeholder = t('mods.betterUI.firebaseRunsPasswordSetPlaceholder');
        } else {
          firebaseRunsPasswordInput.placeholder = t('mods.betterUI.firebaseRunsPasswordPlaceholder');
        }
        
        // Track if password was just saved to prevent double-saving on blur
        let passwordJustSaved = false;
        
        // Function to save password with validation
        const savePassword = () => {
          // Skip if we just saved (prevents double-saving when Enter triggers blur)
          if (passwordJustSaved) {
            passwordJustSaved = false;
            return;
          }
          
          const password = firebaseRunsPasswordInput.value.trim();
          
          // Don't save if password is empty (user just clicked away without entering anything)
          if (!password) {
            return;
          }
          
          // Validate password length
          if (password.length < 5) {
            updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsPasswordMinLength'), '#dc3545');
            firebaseRunsPasswordInput.focus();
            return;
          }
          
          if (password.length > 20) {
            updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsPasswordMaxLength'), '#dc3545');
            firebaseRunsPasswordInput.focus();
            return;
          }
          
          // Check if password is changing (not first time setting)
          const passwordChanged = config.firebaseRunsPassword && config.firebaseRunsPassword !== password;
          
          // Password is valid, save it
          config.firebaseRunsPassword = password;
          saveConfig();
          firebaseRunsPasswordInput.placeholder = t('mods.betterUI.firebaseRunsPasswordSetPlaceholder');
          firebaseRunsPasswordInput.value = '';
          
          // Update upload button state
          updateUploadButtonState();
          
          // If password changed and upload is enabled, re-upload to Firebase with new password
          if (passwordChanged && config.enableFirebaseRunsUpload) {
            updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsPasswordChanged'), '#7f8fa4');
            
            // Re-upload with new password
            uploadBestRuns({ forceFull: true }).then(result => {
              if (result.success) {
                const date = formatEUDateTime(config.lastFirebaseRunsUpload);
                updateFirebaseStatus(statusDiv, tReplace('mods.betterUI.firebaseRunsPasswordChangedReuploaded', { date }), '#4ade80');
              } else {
                updateFirebaseStatus(statusDiv, tReplace('mods.betterUI.firebaseRunsPasswordSavedReuploadFailed', { error: result.error || t('mods.betterUI.firebaseRunsUploadFailed') }), '#ffaa00');
              }
            }).catch(error => {
              console.error('[Mod Settings] Error re-uploading after password change:', error);
              updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsPasswordSavedReuploadFailedUnknown'), '#ffaa00');
            });
          } else {
            // Clear status or show success
            updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsPasswordSaved'), '#4ade80');
            setTimeout(() => {
              if (statusDiv && statusDiv.textContent === t('mods.betterUI.firebaseRunsPasswordSaved')) {
                statusDiv.textContent = '';
              }
            }, 2000);
          }
          
          console.log('[Mod Settings] Firebase runs password updated' + (passwordChanged ? ' (password changed, re-uploading)' : ''));
        };
        
        // Save on blur
        firebaseRunsPasswordInput.addEventListener('blur', savePassword);
        
        // Save on Enter key press
        firebaseRunsPasswordInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            passwordJustSaved = true; // Mark that we're about to save
            savePassword();
            firebaseRunsPasswordInput.blur(); // Remove focus after saving
          }
        });
      }
      
      // Initialize upload button state
      updateUploadButtonState();
      
      // uploadRunsBtn is already defined above, just add the click handler
      if (uploadRunsBtn) {
        uploadRunsBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Double-check password before uploading
          if (!config.firebaseRunsPassword || config.firebaseRunsPassword.length < 5) {
            updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsPasswordNotSet'), '#dc3545');
            return;
          }
          
          updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsUploading'), '#7f8fa4');
          
          const result = await uploadBestRuns({ forceFull: true });
          if (result.success) {
            const date = formatEUDateTime(config.lastFirebaseRunsUpload);
            updateFirebaseStatus(statusDiv, tReplace('mods.betterUI.firebaseRunsLastUploaded', { date }), '#4ade80');
          } else {
            updateFirebaseStatus(statusDiv, tReplace('mods.betterUI.firebaseRunsUploadError', { error: result.error || t('mods.betterUI.firebaseRunsUploadFailed') }), '#dc3545');
          }
        });
      }
      
      // downloadRunsBtn is already defined above, just add the click handler
      if (downloadRunsBtn) {
        downloadRunsBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Ask user for source
          const source = confirm(t('mods.betterUI.firebaseRunsDownloadFromFirebase')) ? 'firebase' : 'local';
          
          if (source === 'firebase') {
            // Single prompt for both username and password
            const input = prompt(t('mods.betterUI.firebaseRunsEnterPlayerPassword'));
            
            if (!input) {
              updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsDownloadCancelled'), '#7f8fa4');
              return;
            }
            
            // Parse input (format: PlayerName:Password)
            const parts = input.split(':');
            if (parts.length !== 2) {
              updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsInvalidFormat'), '#dc3545');
              return;
            }
            
            const playerName = parts[0].trim();
            const password = parts[1].trim();
            
            if (!playerName || !password) {
              updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsPlayerPasswordRequired'), '#dc3545');
              return;
            }
            
            updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsDownloadingFromFirebase'), '#7f8fa4');
            
            const result = await downloadRunsAsTxt(playerName, password, 'firebase');
            if (result.success) {
              updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsDownloadedSuccessfully'), '#4ade80');
            } else {
              updateFirebaseStatus(statusDiv, tReplace('mods.betterUI.firebaseRunsDownloadError', { error: result.error || t('mods.betterUI.firebaseRunsDownloadFailed') }), '#dc3545');
            }
          } else {
            updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsDownloadingLocal'), '#7f8fa4');
            
            const result = await downloadRunsAsTxt(null, null, 'local');
            if (result.success) {
              updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsDownloadedSuccessfully'), '#4ade80');
            } else {
              updateFirebaseStatus(statusDiv, tReplace('mods.betterUI.firebaseRunsDownloadError', { error: result.error || t('mods.betterUI.firebaseRunsDownloadFailed') }), '#dc3545');
            }
          }
        });
      }
      
      // deleteRunsBtn is already defined above, just add the click handler
      if (deleteRunsBtn) {
        deleteRunsBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const playerName = getCurrentPlayerName();
          if (!playerName) {
            updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsPlayerNameNotFound'), '#dc3545');
            return;
          }
          
          updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsDeleting'), '#7f8fa4');
          
          const success = await deleteRunsFromFirebase(playerName);
          if (success) {
            // Clear last upload time
            config.lastFirebaseRunsUpload = null;
            
            // Disable checkboxes and clear password
            config.enableFirebaseRunsUpload = false;
            config.autoUploadRuns = false;
            config.firebaseRunsPassword = '';
            saveConfig();
            
            // Stop auto-upload monitor
            stopAutoUploadMonitor();
            
            // Update UI elements
            if (firebaseRunsUploadToggle) {
              firebaseRunsUploadToggle.checked = false;
            }
            if (autoUploadRunsToggle) {
              autoUploadRunsToggle.checked = false;
            }
            if (firebaseRunsPasswordInput) {
              firebaseRunsPasswordInput.placeholder = t('mods.betterUI.firebaseRunsPasswordPlaceholder');
              firebaseRunsPasswordInput.value = '';
            }
            
            // Update button states
            updateUploadButtonState();
            
            updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsDeletedSuccessfully'), '#4ade80');
          } else {
            updateFirebaseStatus(statusDiv, t('mods.betterUI.firebaseRunsDeleteFailed'), '#dc3545');
          }
        });
      }
      
      // Update status on load
      if (statusDiv && config.lastFirebaseRunsUpload) {
        const date = formatEUDateTime(config.lastFirebaseRunsUpload);
        updateFirebaseStatus(statusDiv, tReplace('mods.betterUI.firebaseRunsLastUploaded', { date }), '#4ade80');
      }

      const guildSkillAdminSection = content.querySelector('#guild-skill-admin-section');
      const guildSkillResetBtn = content.querySelector('#guild-skill-reset-btn');
      const guildSkillResetStatus = content.querySelector('#guild-skill-reset-status');
      const showGuildSkillAdminTools = async () => {
        if (!guildSkillAdminSection) return;
        let allowed = false;
        if (typeof window.Guilds?.canRunGuildAdminToolsAsync === 'function') {
          allowed = await window.Guilds.canRunGuildAdminToolsAsync();
        } else if (typeof window.Guilds?.canRunGuildAdminTools === 'function') {
          allowed = window.Guilds.canRunGuildAdminTools();
        }
        guildSkillAdminSection.style.display = allowed ? 'block' : 'none';
      };
      showGuildSkillAdminTools();
      if (guildSkillResetBtn) applyAdvancedActionButtonStyle(guildSkillResetBtn, { variant: 'red' });
      if (guildSkillResetBtn) {
        guildSkillResetBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!window.Guilds || typeof window.Guilds.runGlobalSkillResetIfAllowed !== 'function') {
            if (guildSkillResetStatus) guildSkillResetStatus.textContent = 'Guilds mod not loaded.';
            return;
          }
          const label = 'DELETE skill-progress, player-skills, and player-equipment for ALL players';
          if (!confirm(`${label}?\n\nThis cannot be undone.`)) return;
          const typed = prompt('Type RESET to confirm:');
          if (typed !== 'RESET') {
            if (guildSkillResetStatus) guildSkillResetStatus.textContent = 'Cancelled.';
            return;
          }
          guildSkillResetBtn.disabled = true;
          if (guildSkillResetStatus) guildSkillResetStatus.textContent = 'Running global reset...';
          try {
            const result = await window.Guilds.runGlobalSkillResetIfAllowed();
            if (guildSkillResetStatus) {
              guildSkillResetStatus.textContent = result.error
                ? `Reset failed: ${result.error}`
                : `Reset OK (${result.deleted}/3 Firebase trees deleted). Reload the game.`;
            }
          } catch (err) {
            if (guildSkillResetStatus) guildSkillResetStatus.textContent = `Reset error: ${err.message}`;
          } finally {
            guildSkillResetBtn.disabled = false;
          }
        });
      }

      const challengesAdminSection = content.querySelector('#challenges-admin-section');
      const challengesClearSoloBtn = content.querySelector('#challenges-clear-solo-btn');
      const challengesClearMultiplayerBtn = content.querySelector('#challenges-clear-multiplayer-btn');
      const challengesAdminStatus = content.querySelector('#challenges-admin-status');
      const showChallengesAdminTools = async () => {
        if (!challengesAdminSection) return;
        let allowed = false;
        if (typeof window.Challenges?.canRunChallengesAdminToolsAsync === 'function') {
          allowed = await window.Challenges.canRunChallengesAdminToolsAsync();
        } else if (typeof window.Challenges?.canRunChallengesAdminTools === 'function') {
          allowed = window.Challenges.canRunChallengesAdminTools();
        }
        challengesAdminSection.style.display = allowed ? 'block' : 'none';
      };
      showChallengesAdminTools();
      if (challengesClearSoloBtn) applyAdvancedActionButtonStyle(challengesClearSoloBtn, { variant: 'red' });
      if (challengesClearMultiplayerBtn) applyAdvancedActionButtonStyle(challengesClearMultiplayerBtn, { variant: 'red' });
      const runChallengesAdminClear = async (btn, label, runFn, successTotal) => {
        if (!window.Challenges || typeof runFn !== 'function') {
          if (challengesAdminStatus) challengesAdminStatus.textContent = 'Challenges mod not loaded.';
          return;
        }
        if (!confirm(`${label}?\n\nThis cannot be undone.`)) return;
        const typed = prompt('Type RESET to confirm:');
        if (typed !== 'RESET') {
          if (challengesAdminStatus) challengesAdminStatus.textContent = 'Cancelled.';
          return;
        }
        btn.disabled = true;
        if (challengesAdminStatus) challengesAdminStatus.textContent = 'Running clear...';
        try {
          const result = await runFn.call(window.Challenges);
          if (challengesAdminStatus) {
            challengesAdminStatus.textContent = result.error
              ? `Clear failed: ${result.error}`
              : `Clear OK (${result.deleted}/${successTotal} Firebase trees deleted). Reload the game.`;
          }
        } catch (err) {
          if (challengesAdminStatus) challengesAdminStatus.textContent = `Clear error: ${err.message}`;
        } finally {
          btn.disabled = false;
        }
      };
      if (challengesClearSoloBtn) {
        challengesClearSoloBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await runChallengesAdminClear(
            challengesClearSoloBtn,
            'DELETE the solo challenges global leaderboard for ALL players',
            window.Challenges?.runClearSoloRecordsIfAllowed,
            1
          );
        });
      }
      if (challengesClearMultiplayerBtn) {
        challengesClearMultiplayerBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await runChallengesAdminClear(
            challengesClearMultiplayerBtn,
            'DELETE multiplayer queue, matches, player-match links, and ratings for ALL players',
            window.Challenges?.runClearMultiplayerRecordsIfAllowed,
            4
          );
        });
      }
      
      const playercountCheckbox = content.querySelector('#playercount-toggle');
      if (playercountCheckbox) {
        playercountCheckbox.checked = config.enablePlayercount;
        
        playercountCheckbox.addEventListener('change', () => {
          config.enablePlayercount = playercountCheckbox.checked;
          saveConfig();
          
          if (playercountCheckbox.checked) {
            removeHeaderLinks();
            addPlayercountHeaderButton();
          } else {
            clearPlayerCountIntervals();
            // Remove button
            const btn = document.querySelector('.playercount-header-btn');
            if (btn && btn.parentNode) {
              btn.parentNode.remove();
            }
          }
        });
      }
      
      // Hunt Analyzer settings
      bindHuntAnalyzerCheckbox(content.querySelector('#hunt-analyzer-persist-toggle'), {
        settingsKey: 'persistData',
        defaultChecked: false,
        onAfterWrite: (newValue) => {
          if (!newValue) {
            localStorage.removeItem('huntAnalyzerData');
            if (typeof window.HuntAnalyzerAPI?.clearPersistedStorage === 'function') {
              window.HuntAnalyzerAPI.clearPersistedStorage().catch((err) => {
                console.warn('[Mod Settings] Could not clear Hunt Analyzer IndexedDB:', err);
              });
            }
          }
        }
      });

      bindHuntAnalyzerCheckbox(content.querySelector('#hunt-analyzer-creature-sell-value-toggle'), {
        settingsKey: 'includeCreatureSellValue',
        defaultChecked: true
      });

      bindHuntAnalyzerCheckbox(content.querySelector('#hunt-analyzer-dragon-plant-collect-toggle'), {
        settingsKey: 'includeDragonPlantCollect',
        defaultChecked: true
      });

      bindHuntAnalyzerCheckbox(content.querySelector('#hunt-analyzer-disenchant-value-toggle'), {
        settingsKey: 'includeDisenchantedEquipments',
        defaultChecked: true
      });
      
      const huntAnalyzerThemeSelector = content.querySelector('#hunt-analyzer-theme-selector');
      if (huntAnalyzerThemeSelector) {
        // Dynamically populate theme options from Hunt Analyzer if available
        try {
          let availableThemes = ['original']; // Default fallback
          
          // Get available themes from Hunt Analyzer if exposed
          if (window.HUNT_ANALYZER_THEMES) {
            availableThemes = Object.keys(window.HUNT_ANALYZER_THEMES);
          }
          
          // Clear existing options and add available themes
          huntAnalyzerThemeSelector.innerHTML = '';
          availableThemes.forEach(themeKey => {
            const option = document.createElement('option');
            option.value = themeKey;
            // Use theme name if available, otherwise capitalize key
            const themeName = window.HUNT_ANALYZER_THEMES?.[themeKey]?.name || 
                             themeKey.charAt(0).toUpperCase() + themeKey.slice(1);
            option.textContent = themeName;
            huntAnalyzerThemeSelector.appendChild(option);
          });
        } catch (error) {
          console.error('[Mod Settings] Error populating Hunt Analyzer themes:', error);
        }
        
        // Load current Hunt Analyzer theme
        huntAnalyzerThemeSelector.value = readHuntAnalyzerSettings().theme || 'original';
        
        huntAnalyzerThemeSelector.addEventListener('change', () => {
          const newTheme = huntAnalyzerThemeSelector.value;
          
          updateHuntAnalyzerSettings((s) => { s.theme = newTheme; });
          console.log('[Mod Settings] Updated Hunt Analyzer theme:', newTheme);
          
          // Also update runtime if Hunt Analyzer is loaded
          if (window.HuntAnalyzerState && window.HuntAnalyzerState.settings) {
            syncHuntAnalyzerRuntimeSetting('theme', newTheme);
            console.log('[Mod Settings] Updated Hunt Analyzer runtime theme');
            
            // Call applyTheme function if available for immediate update
            if (window.applyHuntAnalyzerTheme && typeof window.applyHuntAnalyzerTheme === 'function') {
              window.applyHuntAnalyzerTheme(newTheme, true);
              console.log('[Mod Settings] Applied Hunt Analyzer theme immediately');
            }
          }
        });
      }
      
      // Hunt Analyzer visibility toggles
      const visibilityToggles = content.querySelectorAll('.ha-visibility-toggle');
      if (visibilityToggles.length > 0) {
        // Load current visibility settings from localStorage
        const currentVisibility = readHuntAnalyzerSettings().visibility || {};

        visibilityToggles.forEach(toggle => {
          const visKey = toggle.getAttribute('data-vis-key');
          if (!visKey) return;

          // Set initial checked state (default true if not explicitly set to false)
          toggle.checked = currentVisibility[visKey] !== false;

          toggle.addEventListener('change', () => {
            updateHuntAnalyzerSettings((s) => {
              if (!s.visibility) s.visibility = {};
              s.visibility[visKey] = toggle.checked;
            });

            // Update runtime state if Hunt Analyzer is loaded
            if (window.HuntAnalyzerState && window.HuntAnalyzerState.settings) {
              if (!window.HuntAnalyzerState.settings.visibility) {
                window.HuntAnalyzerState.settings.visibility = {};
              }
              window.HuntAnalyzerState.settings.visibility[visKey] = toggle.checked;
            }

            // Apply immediately if the function is exposed
            if (typeof window.applyHuntAnalyzerVisibility === 'function') {
              window.applyHuntAnalyzerVisibility();
            }
          });
        });
      }
      
      // Backup settings
      const exportRunDataCheckbox = content.querySelector('#export-run-data');
      const runDataInfo = content.querySelector('#run-data-info');
      if (exportRunDataCheckbox && runDataInfo) {
        // Set default from config
        exportRunDataCheckbox.checked = config.includeRunDataByDefault;
        
        // Save preference when changed
        exportRunDataCheckbox.addEventListener('change', () => {
          config.includeRunDataByDefault = exportRunDataCheckbox.checked;
          saveConfig();
        });
        
        // Check for Run Data and update info
        try {
          let runData = null;
          let hasData = false;
          if (window.RunTrackerAPI) {
            runData = window.RunTrackerAPI.getAllRuns();
            if (runData && runData.metadata) {
              const runStats = runData.metadata;
              if (runStats.totalRuns > 0) {
                const estimatedSizeKB = Math.round((runStats.totalRuns * 1115) / 1024);
                runDataInfo.style.display = 'block';
                runDataInfo.textContent = tReplace('mods.betterUI.backupFoundRuns', {
                  runs: runStats.totalRuns,
                  maps: runStats.totalMaps,
                  size: formatStorageSize(estimatedSizeKB)
                });
                hasData = true;
              }
            }
          } else if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
            window.browserAPI.storage.local.get('ba_local_runs', result => {
              const storedRunData = result?.ba_local_runs || null;
              if (storedRunData && storedRunData.metadata) {
                const runStats = storedRunData.metadata;
                if (runStats.totalRuns > 0) {
                  const estimatedSizeKB = Math.round((runStats.totalRuns * 1115) / 1024);
                  runDataInfo.style.display = 'block';
                  runDataInfo.textContent = tReplace('mods.betterUI.backupFoundRuns', {
                    runs: runStats.totalRuns,
                    maps: runStats.totalMaps,
                    size: formatStorageSize(estimatedSizeKB)
                  });
                } else {
                  runDataInfo.style.display = 'block';
                  runDataInfo.textContent = t('mods.betterUI.backupNoDataFound');
                }
              } else {
                runDataInfo.style.display = 'block';
                runDataInfo.textContent = t('mods.betterUI.backupNoDataFound');
              }
            });
            return; // Early return for async case
          }
          
          // Show "No data found" if no data was found
          if (!hasData) {
            runDataInfo.style.display = 'block';
            runDataInfo.textContent = t('mods.betterUI.backupNoDataFound');
          }
        } catch (e) {
          console.log('[Mod Settings] Could not check for Run Data:', e);
          runDataInfo.style.display = 'block';
          runDataInfo.textContent = t('mods.betterUI.backupNoDataFound');
        }
      }
      
      const exportHuntAnalyzerCheckbox = content.querySelector('#export-hunt-analyzer');
      const huntAnalyzerInfo = content.querySelector('#hunt-analyzer-info');
      if (exportHuntAnalyzerCheckbox && huntAnalyzerInfo) {
        // Set default from config
        exportHuntAnalyzerCheckbox.checked = config.includeHuntDataByDefault;
        
        // Save preference when changed
        exportHuntAnalyzerCheckbox.addEventListener('change', () => {
          config.includeHuntDataByDefault = exportHuntAnalyzerCheckbox.checked;
          saveConfig();
        });
        
        // Check for Hunt Analyzer data and update info
        try {
          const huntData = localStorage.getItem('huntAnalyzerData');
          if (huntData) {
            try {
              const parsed = JSON.parse(huntData);
              const storedSessions = parsed.sessions ? parsed.sessions.length : 0;
              const lifetimeBattles = Math.max(
                storedSessions,
                parsed.session?.count || 0,
                (parsed.totals?.wins || 0) + (parsed.totals?.losses || 0)
              );
              const hasTotals = parsed.totals && (
                parsed.totals.gold > 0 || parsed.totals.experience > 0 || parsed.totals.staminaSpent > 0
              );
              const hasTime = parsed.timeTracking?.accumulatedTimeMs > 0;
              if (lifetimeBattles > 0 || hasTotals || hasTime) {
                const estimatedSizeKB = Math.round(huntData.length / 1024);
                huntAnalyzerInfo.style.display = 'block';
                huntAnalyzerInfo.textContent = tReplace('mods.betterUI.backupFoundSessions', {
                  sessions: lifetimeBattles,
                  size: formatStorageSize(estimatedSizeKB)
                });
              } else {
                huntAnalyzerInfo.style.display = 'block';
                huntAnalyzerInfo.textContent = t('mods.betterUI.backupNoSessionsFound');
              }
            } catch (e) {
              console.log('[Mod Settings] Could not parse Hunt Analyzer data:', e);
              huntAnalyzerInfo.style.display = 'block';
              huntAnalyzerInfo.textContent = t('mods.betterUI.backupNoDataFound');
            }
          } else {
            huntAnalyzerInfo.style.display = 'block';
            huntAnalyzerInfo.textContent = t('mods.betterUI.backupNoDataFound');
          }
        } catch (e) {
          console.log('[Mod Settings] Could not check for Hunt Analyzer data:', e);
          huntAnalyzerInfo.style.display = 'block';
          huntAnalyzerInfo.textContent = t('mods.betterUI.backupNoDataFound');
        }
      }
      
      const exportBtn = content.querySelector('#export-config-btn');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          exportConfiguration(modalRef);
        });
      }
      
      const importBtn = content.querySelector('#import-config-btn');
      if (importBtn) {
        importBtn.addEventListener('click', () => {
          importConfiguration(modalRef);
        });
      }
      
      const resetBtn = content.querySelector('#reset-all-settings-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          resetAllSettings(modalRef);
        });
      }

      syncModDependentSettingsAvailability();
    }
    
    // Attach event handlers to the initial content
    attachEventHandlers(content);
    
    // Store modal reference for button handlers
    let modalRef = null;
    
    // Create modal using the API
    modalRef = api.ui.components.createModal({
      title: t('mods.betterUI.settingsTitle'),
      width: modalDimensions.width,
      height: modalDimensions.height,
      content: content,
      buttons: [
        {
          text: t('common.close'),
          primary: true,
          closeOnClick: true,
          onClick: () => {
            console.log('[Mod Settings] Settings modal closed');
            teardownSettingsModal();
          }
        }
      ]
    });

    // Overlay dismiss only calls close() — wrap so teardown always runs.
    if (modalRef && typeof modalRef.close === 'function') {
      const nativeClose = modalRef.close.bind(modalRef);
      modalRef.close = () => {
        teardownSettingsModal();
        nativeClose();
      };
    }
    modSettingsModalInstance = modalRef;
    
    if (modalRef?.element) {
      modalRef.element.style.maxWidth = `${MODAL_CONFIG.maxWidth}px`;
      modalRef.element.style.overflow = 'hidden';
    }
    
    const modalLayoutElements = { content, mainContent, leftColumn, rightColumn };
    setupModSettingsModalResponsiveLayout(modalRef, modalLayoutElements);
    
    // Inject auto-save indicator into the modal footer
    scheduleTimeout(() => {
      const modalElement = document.querySelector('div[role="dialog"][data-state="open"]');
      if (modalElement) {
        const footer = modalElement.querySelector('.flex.justify-end.gap-2');
        if (footer) {
          // Create auto-save indicator
          const autoSaveIndicator = document.createElement('div');
          autoSaveIndicator.className = 'pixel-font-16';
          autoSaveIndicator.style.cssText = `
            font-size: 11px;
            color: rgb(74, 222, 128);
            font-style: italic;
            margin-right: auto;
          `;
          autoSaveIndicator.textContent = t('mods.betterUI.settingsAutoSave');
          
          // Modify footer to use space-between layout
          footer.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 2px;
          `;
          
          // Insert auto-save indicator at the beginning
          footer.insertBefore(autoSaveIndicator, footer.firstChild);
        }
      }
    }, 100);
    
  } catch (error) {
    console.error('[Mod Settings] Error showing settings modal:', error);
  }
}

// Create settings button in header
function createSettingsButton() {
  const tryInsert = () => {
    // Find the header <ul> by its class
    const headerUl = document.querySelector('header ul.pixel-font-16.flex.items-center');
    if (!headerUl) {
      const timeoutId = scheduleTimeout(tryInsert, 500);
      return;
    }
    
    // Prevent duplicate button
    if (headerUl.querySelector('.mod-settings-header-btn')) {
      console.log('[Mod Settings] Settings header button already exists, skipping insert.');
      return;
    }

    // Create the <li> and <button>
    const li = document.createElement('li');
    li.className = 'hover:text-whiteExp';
    const btn = document.createElement('button');
    btn.textContent = t('mods.betterUI.settingsHeaderButton');
    btn.className = 'mod-settings-header-btn';
    btn.onclick = showSettingsModal;
    li.appendChild(btn);

    // Insert before Cyclopedia (English) or Ciclopédia (Portuguese)
    const cyclopediaLi = Array.from(headerUl.children).find(
      el => el.querySelector('button.cyclopedia-header-btn')
    );

    if (cyclopediaLi) {
      headerUl.insertBefore(li, cyclopediaLi);
      console.log('[Mod Settings] Settings header button inserted before Cyclopedia');
    } else {
      // Fallback: Insert after Trophy Room
      const trophyRoomLi = Array.from(headerUl.children).find(
        el => el.querySelector('button') && (el.textContent.includes('Trophy Room') || el.textContent.includes('Sala de Trof'))
      );
      
      if (trophyRoomLi) {
        if (trophyRoomLi.nextSibling) {
          headerUl.insertBefore(li, trophyRoomLi.nextSibling);
        } else {
          headerUl.appendChild(li);
        }
        console.log('[Mod Settings] Settings header button inserted after Trophy Room (fallback)');
      } else {
        // Final fallback: append to header
        headerUl.appendChild(li);
        console.log('[Mod Settings] Settings header button appended to header (final fallback)');
      }
    }
    
    // Store reference for cleanup
    uiState.settingsButton = btn;
  };
  tryInsert();
}
// 7. Rainbow Tiers Functions
// =======================

// Apply data attributes to elements for styling
function applyDataAttributes(elements, prefix, colorKey, extraAttributes = {}) {
  Object.entries(elements).forEach(([key, element]) => {
    if (!element) return;
    
    element.setAttribute(`data-${prefix}`, 'true');
    element.setAttribute(`data-${prefix}-color`, colorKey);
    
    // Apply any extra attributes specific to this element
    if (extraAttributes[key]) {
      Object.entries(extraAttributes[key]).forEach(([attr, value]) => {
        element.setAttribute(attr, value);
      });
    }
  });
}

// Generic styling helper to reduce duplication
function applySpecialStyling(options) {
  const {
    name,
    configKey,
    configColorKey,
    getEligibleFn,
    applyStylingFn,
    injectCSSFn,
    removeFn
  } = options;
  
  try {
    removeFn();
    const visibleCreatures = getVisibleCreatures();
    const eligible = getEligibleFn(visibleCreatures);
    const colorKey = config[configColorKey];
    const colorOption = COLOR_OPTIONS[colorKey] || COLOR_OPTIONS.prismatic;
    
    eligible.forEach(item => applyStylingFn(item, colorKey));
    injectCSSFn(colorOption, colorKey);
  } catch (error) {
    console.error(`[Mod Settings] Error applying ${name}:`, error);
  }
}

function reapplyCreatureCosmeticPriority() {
  if (isBlockedByAnalysisMods()) return;
  removeMaxCreatures();
  removeMaxShinies();
  removeSealedCreatures();
  if (config.enableMaxCreatures) applyMaxCreatures();
  if (config.enableMaxShinies) applyMaxShinies();
  if (config.enableSealed) applySealedCreatures();
  notifyBetterUICreatureCosmeticsChanged();
}

function ensureMaxCreaturesCSS(colorOption, colorKey) {
  upsertFeatureStyle({
    idPrefix: 'max-creatures',
    colorKey,
    cssText: generateMaxCreaturesCSS(colorOption, colorKey)
  });
}

function ensureMaxShiniesCSS(colorOption, colorKey) {
  upsertFeatureStyle({
    idPrefix: 'max-shinies',
    colorKey,
    cssText: generateMaxShiniesCSS(colorOption, colorKey)
  });
}

function ensureSealedCreaturesCSS(colorOption, colorKey) {
  upsertFeatureStyle({
    idPrefix: 'sealed-creatures',
    colorKey,
    cssText: generateSealedCreaturesCSS(colorOption, colorKey)
  });
}

function removeCreatureCosmeticsInRoot(root) {
  if (!root) return;
  clearCreatureCosmeticsCheckedMarks(root);

  root.querySelectorAll('img[alt="creature"][data-max-creatures="true"]').forEach((img) => {
    img.removeAttribute('data-max-creatures');
    img.removeAttribute('data-max-creatures-color');
  });
  root.querySelectorAll('img[data-max-creatures="true"]').forEach((starImg) => {
    const originalSrc = starImg.getAttribute('data-original-src');
    if (originalSrc) {
      starImg.src = originalSrc;
      starImg.removeAttribute('data-original-src');
    }
    starImg.removeAttribute('data-max-creatures');
    starImg.removeAttribute('data-max-creatures-color');
  });
  root.querySelectorAll(
    '.has-rarity[data-max-creatures="true"], .rarity-shiny[data-max-creatures="true"], .rarity-hundo[data-max-creatures="true"], .rarity-awaken[data-max-creatures="true"]'
  ).forEach((rarityDiv) => {
    if (rarityDiv.classList.contains('has-rarity')) {
      rarityDiv.setAttribute('data-rarity', '5');
    } else {
      rarityDiv.removeAttribute('data-rarity');
    }
    rarityDiv.removeAttribute('data-max-creatures');
    rarityDiv.removeAttribute('data-max-creatures-color');
  });
  root.querySelectorAll('.has-rarity-text[data-max-creatures="true"]').forEach((textRarityEl) => {
    textRarityEl.setAttribute('data-rarity', '5');
    textRarityEl.removeAttribute('data-max-creatures');
    textRarityEl.removeAttribute('data-max-creatures-color');
  });

  root.querySelectorAll('img[alt="creature"][data-max-shinies="true"]').forEach((img) => {
    img.removeAttribute('data-max-shinies');
    img.removeAttribute('data-max-shinies-color');
  });
  root.querySelectorAll(
    '.has-rarity[data-max-shinies="true"], .rarity-shiny[data-max-shinies="true"], .rarity-hundo[data-max-shinies="true"], .rarity-awaken[data-max-shinies="true"]'
  ).forEach((rarityDiv) => {
    if (rarityDiv.hasAttribute('data-dynamic-created')) {
      rarityDiv.remove();
      return;
    }
    if (rarityDiv.classList.contains('has-rarity')) {
      const originalRarity = rarityDiv.getAttribute('data-original-rarity') || '5';
      rarityDiv.setAttribute('data-rarity', originalRarity);
    } else {
      rarityDiv.removeAttribute('data-rarity');
    }
    rarityDiv.removeAttribute('data-max-shinies');
    rarityDiv.removeAttribute('data-max-shinies-color');
    rarityDiv.removeAttribute('data-original-rarity');
  });
  root.querySelectorAll('.has-rarity-text[data-max-shinies="true"]').forEach((textRarityEl) => {
    textRarityEl.removeAttribute('data-max-shinies');
    textRarityEl.removeAttribute('data-max-shinies-color');
  });

  root.querySelectorAll('.rarity-sealed[data-sealed-creatures="true"]').forEach((sealedOverlay) => {
    sealedOverlay.removeAttribute('data-sealed-creatures');
    sealedOverlay.removeAttribute('data-sealed-creatures-color');
  });
}

function notifyBetterUICreatureCosmeticsChanged() {
  window.dispatchEvent(new CustomEvent('betterUICreatureCosmeticsChanged'));
}

function clearCreatureCosmeticsCheckedMarks(root) {
  if (!root) return;
  root.querySelectorAll('button[data-better-ui-cosmetics-checked="true"]').forEach((button) => {
    button.removeAttribute('data-better-ui-cosmetics-checked');
  });
}

function markCreatureCosmeticsChecked(imgEl) {
  imgEl?.closest('button')?.setAttribute('data-better-ui-cosmetics-checked', 'true');
}

function getUnprocessedCreatureImages(root) {
  if (!root) return [];
  return [...root.querySelectorAll('img[alt="creature"]')].filter((imgEl) => {
    const button = imgEl.closest('button');
    return button && !button.hasAttribute('data-better-ui-cosmetics-checked');
  });
}

function applyCreatureCosmeticsIncrementalIn(root) {
  if (!root || isBlockedByAnalysisMods()) return;

  const filterOptions = { ignoreScrollLock: true };
  let pending = getUnprocessedCreatureImages(root);
  if (!pending.length) return;

  if (config.enableMaxCreatures) {
    const colorKey = config.maxCreaturesColor;
    const colorOption = COLOR_OPTIONS[colorKey] || COLOR_OPTIONS.prismatic;
    filterEligibleCreatures(pending, filterOptions).forEach((item) => {
      applyStylingToCreature(item, colorKey);
      markCreatureCosmeticsChecked(item.imgEl);
    });
    ensureMaxCreaturesCSS(colorOption, colorKey);
    pending = getUnprocessedCreatureImages(root);
  }

  if (config.enableMaxShinies && pending.length) {
    const colorKey = config.maxShiniesColor;
    const colorOption = COLOR_OPTIONS[colorKey] || COLOR_OPTIONS.prismatic;
    filterEligibleShinies(pending, filterOptions).forEach((item) => {
      applyShinyStyling(item, colorKey);
      markCreatureCosmeticsChecked(item.imgEl);
    });
    ensureMaxShiniesCSS(colorOption, colorKey);
    pending = getUnprocessedCreatureImages(root);
  }

  if (config.enableSealed && pending.length) {
    const colorKey = config.sealedCreaturesColor;
    const colorOption = COLOR_OPTIONS[colorKey] || COLOR_OPTIONS.prismatic;
    filterEligibleSealedCreatures(pending, filterOptions).forEach((item) => {
      applySealedStyling(item, colorKey);
      markCreatureCosmeticsChecked(item.imgEl);
    });
    ensureSealedCreaturesCSS(colorOption, colorKey);
    pending = getUnprocessedCreatureImages(root);
  }

  pending.forEach((imgEl) => markCreatureCosmeticsChecked(imgEl));
}

function applyCreatureCosmeticsInRoot(root) {
  if (!root || isBlockedByAnalysisMods()) return;

  const visibleCreatures = root.querySelectorAll('img[alt="creature"]');
  if (!visibleCreatures.length) return;

  clearCreatureCosmeticsCheckedMarks(root);
  removeCreatureCosmeticsInRoot(root);

  const filterOptions = { ignoreScrollLock: true };

  if (config.enableMaxCreatures) {
    const colorKey = config.maxCreaturesColor;
    const colorOption = COLOR_OPTIONS[colorKey] || COLOR_OPTIONS.prismatic;
    filterEligibleCreatures(visibleCreatures, filterOptions).forEach((item) => {
      applyStylingToCreature(item, colorKey);
    });
    ensureMaxCreaturesCSS(colorOption, colorKey);
  }
  if (config.enableMaxShinies) {
    const colorKey = config.maxShiniesColor;
    const colorOption = COLOR_OPTIONS[colorKey] || COLOR_OPTIONS.prismatic;
    filterEligibleShinies(visibleCreatures, filterOptions).forEach((item) => {
      applyShinyStyling(item, colorKey);
    });
    ensureMaxShiniesCSS(colorOption, colorKey);
  }
  if (config.enableSealed) {
    const colorKey = config.sealedCreaturesColor;
    const colorOption = COLOR_OPTIONS[colorKey] || COLOR_OPTIONS.prismatic;
    filterEligibleSealedCreatures(visibleCreatures, filterOptions).forEach((item) => {
      applySealedStyling(item, colorKey);
    });
    ensureSealedCreaturesCSS(colorOption, colorKey);
  }

  visibleCreatures.forEach((imgEl) => markCreatureCosmeticsChecked(imgEl));
}

window.BetterUIApplyCreatureCosmeticsIn = applyCreatureCosmeticsInRoot;
window.BetterUIApplyCreatureCosmeticsIncrementalIn = applyCreatureCosmeticsIncrementalIn;
window.BetterUIRemoveCreatureCosmeticsIn = removeCreatureCosmeticsInRoot;

// Apply max creatures styling to elite monsters
// Helper functions for applyMaxCreatures
function filterEligibleCreatures(visibleCreatures, options = {}) {
  if (shouldSkipScrollLocked(options)) return [];

  const allMonsters = getPlayerMonsters();
  const depotIdMap =
    typeof window !== 'undefined' && typeof window.depotManager?.getBestiaryCreatureIdMap === 'function'
      ? window.depotManager.getBestiaryCreatureIdMap()
      : null;
  const monstersById = new Map((Array.isArray(allMonsters) ? allMonsters : []).map((m) => [String(m.id), m]));

  const eligibleCreatures = [];

  visibleCreatures.forEach((imgEl) => {
    const gameId = getCreatureGameId(imgEl);
    if (!gameId) return;

    const button = imgEl.closest('button');
    if (!button) return;
    const elements = getCreatureElements(imgEl.parentElement);
    const starSrc = typeof elements.starImg?.src === 'string' ? elements.starImg.src : '';
    const hasGameMaxStar =
      starSrc.includes('star-tier-shiny.png') || starSrc.includes('star-tier-hundo.png');

    // Game max stars: shiny (shiny lvl 99 + genes) or hundo (non-shiny lvl 99 + genes).
    if (hasGameMaxStar && elements.starImg && elements.rarityDiv) {
      eligibleCreatures.push({
        imgEl,
        gameId,
        monster: null,
        elements
      });
      return;
    }

    let monster = null;
    if (button.closest('#monster-scroll') && depotIdMap) {
      const uid = depotIdMap.get(imgEl);
      if (uid != null) monster = monstersById.get(String(uid)) || null;
      if (!monster) monster = scoreMatchMonsterForCreatureButton(button, allMonsters);
    } else {
      monster = resolveMonsterForButtonOnDemand(button);
    }

    if (!monster || monster.tier !== GAME_CONSTANTS.MAX_TIER) return;
    const levelText = getCreatureLevel(elements.levelEl);
    let level = Number(monster.level);
    if (!Number.isFinite(level)) {
      level = getLevelFromExp(monster.exp || 0);
    }
    if (!Number.isFinite(level)) {
      level = Number(levelText);
    }

    let totalGenes = Number(monster.totalgenes ?? monster.totalGenes ?? monster.genesTotal);
    if (!Number.isFinite(totalGenes) && monster.genes && typeof monster.genes === 'object') {
      totalGenes = Number(monster.genes.hp || 0) +
        Number(monster.genes.ad || 0) +
        Number(monster.genes.ap || 0) +
        Number(monster.genes.armor || 0) +
        Number(monster.genes.magicResist || 0);
    }
    if (!Number.isFinite(totalGenes)) {
      totalGenes = Number(monster.hp || 0) +
        Number(monster.ad || 0) +
        Number(monster.ap || 0) +
        Number(monster.armor || 0) +
        Number(monster.magicResist || 0);
    }
    const isMaxCreature =
      Number.isFinite(level) &&
      Number.isFinite(totalGenes) &&
      totalGenes >= GAME_CONSTANTS.MAX_TOTAL_GENES &&
      (level === GAME_CONSTANTS.MAX_LEVEL || level === GAME_CONSTANTS.AWAKENED_MAX_LEVEL);

    if (isMaxCreature && elements.starImg && elements.rarityDiv) {
      eligibleCreatures.push({
        imgEl,
        gameId,
        monster,
        elements
      });
    }
  });

  return eligibleCreatures;
}

function applyStylingToCreature(creature, colorKey) {
  const { elements } = creature;
  
  // Store original src before changing
  if (!elements.starImg.hasAttribute('data-original-src')) {
    elements.starImg.setAttribute('data-original-src', elements.starImg.src);
  }

  const extraAttributes = {};
  if (elements.rarityDiv?.classList.contains('has-rarity')) {
    extraAttributes.rarityDiv = { 'data-rarity': GAME_CONSTANTS.ELITE_RARITY_LEVEL.toString() };
  }
  if (elements.textRarityEl) {
    extraAttributes.textRarityEl = { 'data-rarity': GAME_CONSTANTS.ELITE_RARITY_LEVEL.toString() };
  }
  
  // Apply styling with data attributes
  applyDataAttributes(
    { starImg: elements.starImg, rarityDiv: elements.rarityDiv, textRarityEl: elements.textRarityEl },
    'max-creatures',
    colorKey,
    extraAttributes
  );
}

function injectMaxCreaturesCSS(colorOption, colorKey) {
  upsertFeatureStyle({
    idPrefix: 'max-creatures',
    colorKey,
    cssText: generateMaxCreaturesCSS(colorOption, colorKey),
    replaceAllColors: true
  });
}

function filterEligibleSealedCreatures(visibleCreatures, options = {}) {
  if (shouldSkipScrollLocked(options)) return [];
  const eligibleCreatures = [];

  visibleCreatures.forEach((imgEl) => {
    const containerSlot = imgEl.closest('.container-slot');
    if (!containerSlot) return;
    const sealedOverlay = containerSlot.querySelector('.rarity-sealed');
    if (!sealedOverlay) return;
    if (config.enableMaxCreatures && containerSlot.querySelector('[data-max-creatures="true"]')) return;
    if (config.enableMaxShinies && isShinyCreature(imgEl)) return;
    eligibleCreatures.push({ imgEl, sealedOverlay });
  });

  return eligibleCreatures;
}

function applySealedStyling(sealedCreature, colorKey) {
  const { sealedOverlay } = sealedCreature;
  applyDataAttributes(
    { sealedOverlay },
    'sealed-creatures',
    colorKey
  );
}

function injectSealedCreaturesCSS(colorOption, colorKey) {
  upsertFeatureStyle({
    idPrefix: 'sealed-creatures',
    colorKey,
    cssText: generateSealedCreaturesCSS(colorOption, colorKey),
    replaceAllColors: true
  });
}

function applySealedCreatures() {
  if (isBlockedByAnalysisMods()) return;

  applySpecialStyling({
    name: 'sealed creatures',
    configColorKey: 'sealedCreaturesColor',
    getEligibleFn: filterEligibleSealedCreatures,
    applyStylingFn: applySealedStyling,
    injectCSSFn: injectSealedCreaturesCSS,
    removeFn: removeSealedCreatures
  });
}

function removeSealedCreatures() {
  try {
    document.querySelectorAll('.rarity-sealed[data-sealed-creatures="true"]').forEach((sealedOverlay) => {
      sealedOverlay.removeAttribute('data-sealed-creatures');
      sealedOverlay.removeAttribute('data-sealed-creatures-color');
    });
  } catch (error) {
    console.error('[Mod Settings] Error removing sealed creatures styling:', error);
  }
}

function applyMaxCreatures() {
  // Skip if Board Analyzer or Autoscroller is running
  if (isBlockedByAnalysisMods()) {
    return;
  }
  
  applySpecialStyling({
    name: 'max creatures',
    configColorKey: 'maxCreaturesColor',
    getEligibleFn: filterEligibleCreatures,
    applyStylingFn: applyStylingToCreature,
    injectCSSFn: injectMaxCreaturesCSS,
    removeFn: removeMaxCreatures
  });
}

// Remove max creatures styling from all monsters
function removeMaxCreatures() {
  try {
    // Reset max creatures stars back to original state
    getVisibleCreatures().forEach((imgEl) => {
      const starImg = imgEl.parentElement.querySelector('img[data-max-creatures="true"]');
      if (starImg) {
        // Restore original src if stored
        const originalSrc = starImg.getAttribute('data-original-src');
        if (originalSrc) {
          starImg.src = originalSrc;
          starImg.removeAttribute('data-original-src');
        }
        // Remove all max creatures attributes
        starImg.removeAttribute('data-max-creatures');
        starImg.removeAttribute('data-max-creatures-color');
      }
    });

    // Reset all max creatures borders (regular + shiny overlays)
    document.querySelectorAll(
      '.has-rarity[data-max-creatures="true"], .rarity-shiny[data-max-creatures="true"], .rarity-hundo[data-max-creatures="true"], .rarity-awaken[data-max-creatures="true"]'
    ).forEach((rarityDiv) => {
      if (rarityDiv.classList.contains('has-rarity')) {
        rarityDiv.setAttribute('data-rarity', '5');
      } else {
        rarityDiv.removeAttribute('data-rarity');
      }
      rarityDiv.removeAttribute('data-max-creatures');
      rarityDiv.removeAttribute('data-max-creatures-color');
    });

    // Reset all max creatures text colors
    document.querySelectorAll('.has-rarity-text[data-max-creatures="true"]').forEach((textRarityEl) => {
      textRarityEl.setAttribute('data-rarity', '5');
      textRarityEl.removeAttribute('data-max-creatures');
      textRarityEl.removeAttribute('data-max-creatures-color');
    });
  } catch (error) {
    console.error('[Mod Settings] Error removing max creatures styling:', error);
  }
}

// =======================
// 8. Max Shinies Functions
// =======================

// Apply max shinies styling to shiny creatures
function filterEligibleShinies(visibleCreatures, options = {}) {
  if (shouldSkipScrollLocked(options)) return [];
  
  const eligibleShinies = [];
  
  visibleCreatures.forEach((imgEl) => {
    if (!isShinyCreature(imgEl)) return;
    const containerSlot = imgEl.closest('.container-slot');
    const starImg = containerSlot?.querySelector('img[alt="star tier"]');
    const starSrc = typeof starImg?.src === 'string' ? starImg.src : '';
    const hasGameMaxStar =
      starSrc.includes('star-tier-shiny.png') || starSrc.includes('star-tier-hundo.png');
    const alreadyMaxStyled = Boolean(containerSlot?.querySelector('[data-max-creatures="true"]'));
    if (config.enableMaxCreatures && (hasGameMaxStar || alreadyMaxStyled)) return;
    
    const elements = getCreatureElements(imgEl.parentElement);
    
    // All shinies qualify, regardless of stats or level or DOM structure
    eligibleShinies.push({
      imgEl,
      elements
    });
  });
  
  return eligibleShinies;
}

function applyShinyStyling(shiny, colorKey) {
  const { elements, imgEl } = shiny;
  
  // Create .has-rarity element if missing
  if (!elements.rarityDiv) {
    const rarityDiv = document.createElement('div');
    rarityDiv.className = 'has-rarity absolute inset-0 z-1 opacity-80';
    rarityDiv.setAttribute('data-rarity', '5');
    rarityDiv.setAttribute('data-dynamic-created', 'true'); // Mark as dynamically created
    imgEl.parentElement.appendChild(rarityDiv);
    elements.rarityDiv = rarityDiv;
  }
  
  const extraAttributes = {};
  if (elements.rarityDiv.classList.contains('has-rarity')) {
    extraAttributes.rarityDiv = {
      'data-original-rarity': elements.rarityDiv.getAttribute('data-rarity') || '5'
    };
  }
  
  // Apply styling with data attributes
  applyDataAttributes(
    { imgEl, rarityDiv: elements.rarityDiv, textRarityEl: elements.textRarityEl },
    'max-shinies',
    colorKey,
    extraAttributes
  );
}

function injectMaxShiniesCSS(colorOption, colorKey) {
  upsertFeatureStyle({
    idPrefix: 'max-shinies',
    colorKey,
    cssText: generateMaxShiniesCSS(colorOption, colorKey),
    replaceAllColors: true
  });
}

function applyMaxShinies() {
  // Skip if Board Analyzer or Autoscroller is running
  if (isBlockedByAnalysisMods()) {
    return;
  }
  
  applySpecialStyling({
    name: 'max shinies',
    configColorKey: 'maxShiniesColor',
    getEligibleFn: filterEligibleShinies,
    applyStylingFn: applyShinyStyling,
    injectCSSFn: injectMaxShiniesCSS,
    removeFn: removeMaxShinies
  });
}

function removeMaxShinies() {
  try {
    // Reset all shiny creature images
    document.querySelectorAll('img[alt="creature"][data-max-shinies="true"]').forEach((img) => {
      img.removeAttribute('data-max-shinies');
      img.removeAttribute('data-max-shinies-color');
    });
    
    // Reset all shiny borders (regular + shiny overlays)
    document.querySelectorAll(
      '.has-rarity[data-max-shinies="true"], .rarity-shiny[data-max-shinies="true"], .rarity-hundo[data-max-shinies="true"], .rarity-awaken[data-max-shinies="true"]'
    ).forEach((rarityDiv) => {
      // If this was dynamically created, remove it completely
      if (rarityDiv.hasAttribute('data-dynamic-created')) {
        rarityDiv.remove();
        return;
      }
      
      // Otherwise, restore original state
      if (rarityDiv.classList.contains('has-rarity')) {
        const originalRarity = rarityDiv.getAttribute('data-original-rarity') || '5';
        rarityDiv.setAttribute('data-rarity', originalRarity);
      } else {
        rarityDiv.removeAttribute('data-rarity');
      }
      rarityDiv.removeAttribute('data-max-shinies');
      rarityDiv.removeAttribute('data-max-shinies-color');
      rarityDiv.removeAttribute('data-original-rarity');
    });
    
    // Reset all shiny text colors
    document.querySelectorAll('.has-rarity-text[data-max-shinies="true"]').forEach((textRarityEl) => {
      textRarityEl.removeAttribute('data-max-shinies');
      textRarityEl.removeAttribute('data-max-shinies-color');
    });
  } catch (error) {
    console.error('[Mod Settings] Error removing max shinies styling:', error);
  }
}

// =======================
// 9. Advanced Creature Hover
// =======================

function getCreatureHoverTargetButtons() {
  const images = document.querySelectorAll('img[alt="creature"]');
  const buttons = new Set();

  images.forEach((img) => {
    const button = img.closest('button');
    if (button) {
      buttons.add(button);
    }
  });

  return [...buttons];
}

function isInventoryCreatureButton(button) {
  if (!button) return false;
  if (!button.querySelector('img[alt="creature"]')) return false;
  if (button.closest('[role="menu"]') || button.closest('[role="dialog"]')) return false;
  return Boolean(
    button.closest('#monster-scroll') ||
    button.closest('.tab-picker-scroll') ||
    button.closest('[id*="monster-scroll"]')
  );
}

// Equipment arsenal hover (Show ability on hover) — grid resolution mirrors Depot Manager;
// effect text mirrors Cyclopedia (description HTML or EffectComponent).
function resolveEquipmentHoverGrid() {
  const isInsideDialog = (node) => !!node?.closest?.('[role="dialog"], [data-radix-dialog-content]');
  const directScroll =
    document.getElementById('equip-scroll') ||
    document.querySelector('[id*="equip"][id*="scroll"]') ||
    document.querySelector('[id*="arsenal"][id*="scroll"]');
  if (directScroll && !isInsideDialog(directScroll)) {
    const viewport = directScroll.querySelector('[data-radix-scroll-area-viewport]');
    const grid =
      viewport?.querySelector('div.flex.flex-wrap') || directScroll.querySelector('div.flex.flex-wrap');
    if (grid) return grid;
  }
  const viewports = Array.from(document.querySelectorAll('[data-radix-scroll-area-viewport]'));
  let bestGrid = null;
  let bestCount = 0;
  for (const viewport of viewports) {
    if (isInsideDialog(viewport)) continue;
    const grid = viewport.querySelector('div.flex.flex-wrap');
    if (!grid) continue;
    const count = grid.querySelectorAll('button .sprite.item, button img[alt="stat type"]').length;
    if (count > bestCount) {
      bestCount = count;
      bestGrid = grid;
    }
  }
  return bestCount > 0 ? bestGrid : null;
}

function getPlayerEquipmentRowsForHover() {
  try {
    const playerSnapshot = globalThis.state?.player?.getSnapshot?.();
    const equips = playerSnapshot?.context?.equips || [];
    if (!Array.isArray(equips) || equips.length === 0) return [];
    return equips
      .filter((equip) => equip && equip.gameId != null)
      .map((equip, index) => {
        let equipData = null;
        try {
          equipData = globalThis.state?.utils?.getEquipment?.(equip.gameId) || null;
        } catch (e) {
          /* ignore */
        }
        const name = equipData?.metadata?.name || `Equipment ${equip.gameId}`;
        const spriteId =
          equipData?.metadata?.spriteId != null ? String(equipData.metadata.spriteId) : '';
        return {
          id: String(equip.id || `equip_${index}`),
          gameId: equip.gameId,
          name,
          spriteId,
          stat: String(equip.stat || 'unknown'),
          tier: Number(equip.tier || 1)
        };
      });
  } catch (error) {
    return [];
  }
}

function normalizeEquipmentStatForHover(statRaw) {
  const s = String(statRaw || '').toLowerCase().trim();
  const map = {
    hp: 'heal',
    heal: 'heal',
    ad: 'attackdamage',
    attackdamage: 'attackdamage',
    ap: 'abilitypower',
    abilitypower: 'abilitypower',
    arm: 'armor',
    armor: 'armor',
    mr: 'magicresist',
    magicresist: 'magicresist',
    aps: 'attackspeed',
    attackspeed: 'attackspeed',
    spd: 'speed',
    speed: 'speed'
  };
  return map[s] || s;
}

function getEquipmentSpriteIdFromInventoryButton(button) {
  const sprite = button?.querySelector?.('.sprite.item');
  if (!sprite) return '';
  for (const cls of Array.from(sprite.classList)) {
    const m = /^id-(\d+)$/.exec(cls);
    if (m) return m[1];
  }
  return '';
}

function getEquipmentTierFromInventoryButton(button) {
  const directTierRaw = button?.getAttribute?.('data-tier') || '';
  const directTier = Number.parseInt(directTierRaw, 10);
  if (Number.isFinite(directTier) && directTier > 0) return directTier;

  const rarityRaw = button?.querySelector?.('.has-rarity')?.getAttribute?.('data-rarity') || '';
  const rarityTier = Number.parseInt(rarityRaw, 10);
  if (Number.isFinite(rarityTier) && rarityTier > 0) return rarityTier;

  const buttonRarityRaw = button?.getAttribute?.('data-rarity') || '';
  const buttonRarityTier = Number.parseInt(buttonRarityRaw, 10);
  if (Number.isFinite(buttonRarityTier) && buttonRarityTier > 0) return buttonRarityTier;

  return 1;
}

function getEquipmentStatFromInventoryButton(button) {
  const src = button?.querySelector('img[alt="stat type"]')?.getAttribute('src') || '';
  const filename = src.split('/').pop() || '';
  const key = filename.replace('.png', '').trim().toLowerCase();
  return normalizeEquipmentStatForHover(key);
}

function resolveEquipmentGameIdFromInventoryButton(button) {
  const directId = button?.getAttribute?.('data-equipment-id');
  if (directId) {
    const rows = getPlayerEquipmentRowsForHover();
    const row = rows.find((r) => String(r.id) === String(directId));
    if (row?.gameId != null) return row.gameId;
  }

  const spriteId = getEquipmentSpriteIdFromInventoryButton(button);
  const tier = getEquipmentTierFromInventoryButton(button);
  const statNorm = getEquipmentStatFromInventoryButton(button);
  const depotEquipSet = getDepotEquipmentIdSetForHover();
  const rows = getPlayerEquipmentRowsForHover().filter(
    (r) => !depotEquipSet || !depotEquipSet.has(String(r.id))
  );

  if (spriteId) {
    const matches = rows.filter(
      (r) =>
        String(r.spriteId) === String(spriteId) &&
        Number(r.tier) === Number(tier) &&
        normalizeEquipmentStatForHover(r.stat) === statNorm
    );
    if (matches.length === 1) return matches[0].gameId;
    if (matches.length > 1) {
      const visibleButtons = getVisibleArsenalEquipmentButtonsForHover();
      let sameVisualBefore = 0;
      for (const btn of visibleButtons) {
        if (btn === button) break;
        if (
          getEquipmentSpriteIdFromInventoryButton(btn) === spriteId &&
          getEquipmentTierFromInventoryButton(btn) === tier &&
          getEquipmentStatFromInventoryButton(btn) === statNorm
        ) {
          sameVisualBefore += 1;
        }
      }
      const pick = matches[Math.min(sameVisualBefore, matches.length - 1)];
      if (pick?.gameId != null) return pick.gameId;
    }
  }

  const nameFromAttr = button?.getAttribute?.('data-equipment')?.trim() || '';
  const title = String(button?.getAttribute?.('title') || '');
  const nameFromTitle = title.includes('|') ? title.split('|')[0].trim() : title.trim();
  const name = nameFromAttr || nameFromTitle;

  if (name) {
    const map = window.BestiaryModAPI?.utility?.maps?.equipmentNamesToGameIds;
    if (map?.get) {
      const gid = map.get(name.toLowerCase());
      if (gid != null) return gid;
    }
    const byNameTier = rows.filter(
      (r) => r.name === name && Number(r.tier) === Number(tier)
    );
    if (byNameTier.length > 0) return byNameTier[0].gameId;
  }

  if (spriteId && typeof globalThis.state?.utils?.getEquipment === 'function') {
    const utils = globalThis.state.utils;
    let emptyStreak = 0;
    for (let i = 0; i < 20000; i++) {
      try {
        const eq = utils.getEquipment(i);
        if (!eq) {
          emptyStreak++;
          if (emptyStreak > 80) break;
          continue;
        }
        emptyStreak = 0;
        if (eq?.metadata?.spriteId != null && String(eq.metadata.spriteId) === String(spriteId)) {
          return i;
        }
      } catch (e) {
        emptyStreak++;
        if (emptyStreak > 80) break;
      }
    }
  }

  return null;
}

function isEquipmentHoverCandidateButton(button) {
  if (!button) return false;
  if (button.querySelector('img[alt="creature"]')) return false;
  if (!(button.querySelector('.sprite.item') || button.querySelector('img[alt="stat type"]'))) return false;
  if (
    button.closest('[role="menu"]') ||
    button.closest('[role="dialog"]') ||
    button.closest('[data-radix-dialog-content]')
  ) {
    return false;
  }
  return true;
}

function getDepotCreatureIdSetForHover() {
  return typeof window !== 'undefined' && typeof window.depotManager?.getDepotCreatureIdSet === 'function'
    ? window.depotManager.getDepotCreatureIdSet()
    : null;
}

function getDepotEquipmentIdSetForHover() {
  return typeof window !== 'undefined' && typeof window.depotManager?.getDepotEquipmentIdSet === 'function'
    ? window.depotManager.getDepotEquipmentIdSet()
    : null;
}

function isArsenalEquipmentButtonVisibleForHover(button) {
  if (!button) return false;
  const slot = button.closest('div.flex[data-state]') || button;
  if (slot.getAttribute('data-depot-equipment-hidden') === 'true') return false;
  return window.getComputedStyle(slot).display !== 'none';
}

function getEquipmentHoverTargetButtons() {
  const grid = resolveEquipmentHoverGrid();
  if (!grid) return [];
  return Array.from(grid.querySelectorAll(':scope button')).filter(
    (btn) => isEquipmentHoverCandidateButton(btn) && grid.contains(btn)
  );
}

function getVisibleArsenalEquipmentButtonsForHover() {
  return getEquipmentHoverTargetButtons().filter(isArsenalEquipmentButtonVisibleForHover);
}

/**
 * Hover resolution traces (depot vs fiber vs sequential). Enabled when any of:
 * - Extension popup **Mod debug** (`bestiary-debug` in localStorage → `window.BESTIARY_DEBUG`)
 * - `localStorage.setItem('mod-settings-debug-hover','1')` (Mod Settings–only override)
 * - `window.__MOD_SETTINGS_DEBUG_HOVER__ = true`
 */
function isAdvancedHoverDebugEnabled() {
  try {
    if (typeof window !== 'undefined' && window.__MOD_SETTINGS_DEBUG_HOVER__ === true) return true;
    // Injected by local_mods `with (context)` (same flag as Depot Manager uses).
    if (typeof BESTIARY_DEBUG !== 'undefined' && BESTIARY_DEBUG === true) return true;
    if (typeof window !== 'undefined' && window.BESTIARY_DEBUG === true) return true;
    if (localStorage.getItem('bestiary-debug') === 'true') return true;
    return localStorage.getItem('mod-settings-debug-hover') === '1';
  } catch (e) {
    return false;
  }
}

/**
 * Grid slot position under #monster-scroll (for comparing DOM order vs resolvers).
 */
function getBestiaryHoverSlotDomContext(button) {
  const slot = button?.closest?.('#monster-scroll .flex.flex-wrap.gap-1 > div.flex');
  if (!slot || !slot.parentElement) return null;
  const grid = slot.parentElement;
  const siblings = Array.from(grid.children).filter((el) => el.classList?.contains?.('flex'));
  const domIndex = siblings.indexOf(slot);
  return {
    domIndex: domIndex >= 0 ? domIndex : null,
    siblingSlotCount: siblings.length,
    dataDepotCreatureId: slot.getAttribute('data-depot-creature-id'),
    dataDepotHidden: slot.getAttribute('data-depot-hidden'),
    slotDisplay: window.getComputedStyle(slot).display
  };
}

/**
 * Player monsters that match the portrait cell's obvious visuals (same species / level / shiny / rarity band).
 */
function listHoverVisualTwinCandidates(creatureImg, button, monsters) {
  if (!creatureImg || !button || !Array.isArray(monsters)) return [];
  const gameId = getCreatureGameId(creatureImg);
  if (!gameId) return [];
  const levelSpan = button.querySelector('span[translate="no"]');
  const displayedLevel = levelSpan ? parseInt(levelSpan.textContent, 10) : NaN;
  const slot = creatureImg.closest('.container-slot');
  const wantsElite = inferWantsEliteFromCreatureSlot(slot);
  const wantsShiny = creatureImg.src.includes('-shiny');
  const rarityEl = slot?.querySelector('.has-rarity');
  const wantsRarity = parseInt(rarityEl?.getAttribute('data-rarity') || '', 10);
  const rarityFromMonster = (m) => {
    if (isEliteMonster(m)) return 6;
    const tier = Number(m?.tier || 1);
    return Math.max(1, Math.min(5, tier + 1));
  };
  return monsters
    .filter((m) => {
      if (m.gameId !== gameId) return false;
      if (Number.isFinite(displayedLevel) && getLevelFromExp(m.exp || 0) !== displayedLevel) return false;
      if (Boolean(m.shiny) !== wantsShiny) return false;
      if (isEliteMonster(m) !== wantsElite) return false;
      if (Number.isFinite(wantsRarity) && rarityFromMonster(m) !== wantsRarity) return false;
      return true;
    })
    .map((m) => monsterHoverDebugSnapshot(m));
}

/**
 * When debug is on, one grouped log per hover: compares depot UID → monster, React fiber, weak map,
 * onDemand, and visible-only sequential (duplicate-safe baseline for filtered grids).
 */
function logHoveredCreatureResolutionCompare(button) {
  if (!isAdvancedHoverDebugEnabled() || !button) return;
  const creatureImg = button.querySelector('img[alt="creature"]');
  if (!creatureImg) return;
  const monsters = getPlayerMonsters();
  if (!Array.isArray(monsters)) return;

  const gameId = getCreatureGameId(creatureImg);
  const portrait = (creatureImg.src || '').split('/').pop() || '';
  const inMonsterScroll = Boolean(button.closest('#monster-scroll'));
  const domCtx = inMonsterScroll ? getBestiaryHoverSlotDomContext(button) : null;

  const depotMap =
    typeof window !== 'undefined' && typeof window.depotManager?.getBestiaryCreatureIdMap === 'function'
      ? window.depotManager.getBestiaryCreatureIdMap()
      : null;
  const depotUidRaw = depotMap?.get(creatureImg);
  const depotUid = depotUidRaw != null ? String(depotUidRaw) : null;
  const monsterFromDepotUid = depotUid ? monsters.find((m) => String(m.id) === depotUid) : null;

  const taggedSlot = button.closest('div.flex[data-depot-creature-id]');
  const taggedAttrId = taggedSlot?.getAttribute('data-depot-creature-id');
  const monsterFromTaggedSlot =
    taggedAttrId && Array.isArray(monsters)
      ? monsters.find((m) => String(m.id) === String(taggedAttrId))
      : null;

  const fiberM = resolveMonsterFromReactFiber(button);
  const weakM = advancedHoverState.resolvedByImg.get(creatureImg);
  const onDemandM = resolveMonsterForButtonOnDemand(button);

  let sequentialVisibleM = null;
  if (inMonsterScroll) {
    const visibleScrollImgs = getVisibleInventoryCreatureImgsForHover().filter((img) =>
      img.closest('#monster-scroll')
    );
    const resolved = resolveHoverCreaturesSequentially(visibleScrollImgs, monsters);
    const hit = resolved.find((r) => r.imgEl === creatureImg);
    sequentialVisibleM = hit?.monster || null;
  }

  // Mirror getMonsterInfoFromButton: DOM slot tag beats scroll weakMap/fiber ordering.
  const chosenForTooltip = monsterFromTaggedSlot
    ? monsterFromTaggedSlot
    : inMonsterScroll
      ? onDemandM || weakM || fiberM
      : fiberM || weakM || onDemandM;
  const chosenId = chosenForTooltip ? String(chosenForTooltip.id) : null;

  const summary = {
    depotMapUid: depotUid,
    monsterIfDepotUidHonored: monsterFromDepotUid ? String(monsterFromDepotUid.id) : null,
    slotDataDepotCreatureId: taggedAttrId || null,
    monsterIfSlotTagHonored: monsterFromTaggedSlot ? String(monsterFromTaggedSlot.id) : null,
    reactFiber: fiberM ? String(fiberM.id) : null,
    rebuildWeakMap: weakM ? String(weakM.id) : null,
    onDemand: onDemandM ? String(onDemandM.id) : null,
    visibleOnlySequential: sequentialVisibleM ? String(sequentialVisibleM.id) : null,
    tooltipChosen: chosenId
  };

  const referenceIds = [
    summary.monsterIfDepotUidHonored,
    summary.monsterIfSlotTagHonored,
    summary.reactFiber,
    summary.visibleOnlySequential
  ].filter(Boolean);
  const mismatch =
    referenceIds.length > 0 && chosenId && referenceIds.some((rid) => rid !== chosenId);

  const label = `[Mod Settings][hover-compare] ${portrait} gameId=${gameId}${mismatch ? ' ⚠ ID MISMATCH' : ''}`;
  console.groupCollapsed(label);
  // Use console.info (not .log): local_mods.js silences console.log unless bestiary-debug is on — but when
  // hover debug is enabled via mod-settings-debug-hover alone, info still prints.
  console.info(
    'enable',
    'Extension: Mod debug in popup sets bestiary-debug / BESTIARY_DEBUG; optional: mod-settings-debug-hover=1'
  );
  console.info('domSlot', domCtx);
  console.info('idSummary (what each resolver says)', summary);
  console.info('statSnapshots', {
    tooltipShows: monsterHoverDebugSnapshot(chosenForTooltip),
    ifSlotDataDepotIdWereUsed: monsterHoverDebugSnapshot(monsterFromTaggedSlot),
    ifPortraitDepotMapUidWereUsed: monsterHoverDebugSnapshot(monsterFromDepotUid),
    reactFiber: monsterHoverDebugSnapshot(fiberM),
    visibleOnlySequential: monsterHoverDebugSnapshot(sequentialVisibleM)
  });
  const twins = listHoverVisualTwinCandidates(creatureImg, button, monsters);
  if (twins.length > 1) {
    console.info(`visualTwinCandidates (${twins.length} instances match this cell's portrait/level/shiny/rarity)`, twins);
  }
  const seqDbg = advancedHoverState.debugByImg.get(creatureImg);
  if (seqDbg) console.info('visibleSequentialInternal', seqDbg);

  if (
    depotUid &&
    monsterFromDepotUid &&
    chosenId &&
    String(monsterFromDepotUid.id) !== chosenId &&
    !monsterFromTaggedSlot
  ) {
    console.warn('Tooltip creature ≠ depot map UID on this portrait img (tagged slot not overriding)', {
      depotUid,
      expectedMonsterId: String(monsterFromDepotUid.id),
      tooltipMonsterId: chosenId
    });
  }
  if (
    inMonsterScroll &&
    sequentialVisibleM &&
    chosenId &&
    String(sequentialVisibleM.id) !== chosenId
  ) {
    console.warn(
      'Tooltip creature ≠ visible-only sequential (duplicate order: depot map vs visible DOM order)',
      { sequentialId: String(sequentialVisibleM.id), tooltipId: chosenId }
    );
  }
  if (fiberM && chosenId && String(fiberM.id) !== chosenId) {
    console.info('React fiber id ≠ tooltip (expected when #monster-scroll prefers depot map over fiber)', {
      fiberId: String(fiberM.id),
      tooltipId: chosenId
    });
  }
  if (
    depotUid &&
    taggedAttrId &&
    String(depotUid) !== String(taggedAttrId) &&
    monsterFromDepotUid &&
    monsterFromTaggedSlot &&
    String(monsterFromDepotUid.id) !== String(monsterFromTaggedSlot.id)
  ) {
    console.warn('Portrait depot map UID ≠ slot data-depot-creature-id (two sources of truth disagree)', {
      depotMapUid: depotUid,
      slotAttrId: taggedAttrId
    });
  }
  console.groupEnd();
}

function monsterHoverDebugSnapshot(m) {
  if (!m) return null;
  const hp = m.hp || 0;
  const ad = m.ad || 0;
  const ap = m.ap || 0;
  const armor = m.armor || 0;
  const magicResist = m.magicResist || 0;
  const barMax = 20;
  return {
    id: m.id,
    gameId: m.gameId,
    level: getLevelFromExp(m.exp || 0),
    hp,
    ad,
    ap,
    armor,
    magicResist,
    barPctVs20: {
      hp: Math.round(Math.min(100, Math.max(0, (hp / barMax) * 100))),
      ad: Math.round(Math.min(100, Math.max(0, (ad / barMax) * 100))),
      ap: Math.round(Math.min(100, Math.max(0, (ap / barMax) * 100))),
      armor: Math.round(Math.min(100, Math.max(0, (armor / barMax) * 100))),
      magicResist: Math.round(Math.min(100, Math.max(0, (magicResist / barMax) * 100)))
    }
  };
}

const advancedHoverState = {
  resolvedByImg: new WeakMap(),
  debugByImg: new WeakMap(),
  sequence: 0,
  delegatedBound: false,
  delegatedHandler: null,
  activeTooltip: null,
  activeCleanup: null,
  activeButton: null,
  activeToken: 0
};

const equipmentHoverDelegationState = {
  delegatedBound: false,
  delegatedHandler: null
};

function destroyActiveAdvancedHoverTooltip() {
  if (advancedHoverState.activeTooltip) {
    advancedHoverState.activeTooltip.remove();
    advancedHoverState.activeTooltip = null;
  }
  if (advancedHoverState.activeCleanup) {
    try {
      advancedHoverState.activeCleanup();
    } catch (error) {
      // Best effort cleanup.
    }
    advancedHoverState.activeCleanup = null;
  }
  advancedHoverState.activeButton = null;
}

function getVisibleInventoryCreatureImgsForHover() {
  return Array.from(document.querySelectorAll('img[alt="creature"]')).filter((img) => {
    const button = img.closest('button');
    if (!isInventoryCreatureButton(button)) return false;
    const slot = img.closest('div.flex');
    if (!slot) return true;
    const style = window.getComputedStyle(slot);
    return style.display !== 'none';
  });
}

/** Visible #monster-scroll order: how many same gameId portraits appear strictly before this img. */
function countSameGameIdPrecedingInMonsterScroll(creatureImg, gameId) {
  if (!creatureImg || !gameId) return 0;
  const imgs = getVisibleInventoryCreatureImgsForHover().filter((img) => img.closest('#monster-scroll'));
  let before = 0;
  for (const img of imgs) {
    if (img === creatureImg) return before;
    if (getCreatureGameId(img) === gameId) before++;
  }
  return before;
}

function sortMonstersByVisualOrder(monsters) {
  return monsters.slice().sort((a, b) => {
    if ((b.exp || 0) !== (a.exp || 0)) return (b.exp || 0) - (a.exp || 0);
    const aName = a?.metadata?.name || '';
    const bName = b?.metadata?.name || '';
    const nameCompare = aName.localeCompare(bName);
    if (nameCompare !== 0) return nameCompare;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

function resolveHoverCreaturesSequentially(creatures, monsters) {
  const gameIdBuckets = new Map();
  const gameIdIndexMap = new Map();
  const resolved = [];

  for (const creatureImg of creatures) {
    const gameId = getCreatureGameId(creatureImg);
    if (!gameId) {
      const seq = advancedHoverState.sequence++;
      resolved.push({ imgEl: creatureImg, monster: null });
      advancedHoverState.debugByImg.set(creatureImg, {
        sequence: seq,
        gameId: null,
        displayedLevel: null,
        wantsElite: false,
        baseIdx: null,
        finalIdx: null,
        bucketLength: 0,
        chosenMonsterId: null,
        chosenStats: null,
        candidates: []
      });
      continue;
    }

    if (!gameIdBuckets.has(gameId)) {
      const matching = monsters.filter((m) => m.gameId === gameId);
      gameIdBuckets.set(gameId, sortMonstersByVisualOrder(matching));
      gameIdIndexMap.set(gameId, 0);
    }

    const bucket = gameIdBuckets.get(gameId) || [];
    let idx = gameIdIndexMap.get(gameId) || 0;
    let selected = bucket[idx] || null;

    // If duplicates exist, use visible level + elite marker as tie-breakers,
    // but only within the unconsumed tail of the bucket.
    const button = creatureImg.closest('button');
    const levelSpan = button?.querySelector('span[translate="no"]');
    const displayedLevel = levelSpan ? parseInt(levelSpan.textContent, 10) : null;
    const slot = creatureImg.closest('.container-slot');
    const wantsElite = inferWantsEliteFromCreatureSlot(slot);
    const wantsShiny = creatureImg.src.includes('-shiny');
    const rarityEl = slot?.querySelector('.has-rarity');
    const wantsRarity = parseInt(rarityEl?.getAttribute('data-rarity') || '', 10);
    const baseIdx = idx;
    const ambiguousDom = creatureSlotDomAmbiguousDuplicates(slot);

    if (bucket.length > 1) {
      const tail = bucket.slice(idx);
      const tailOrFull = tail.length > 0 ? tail : bucket;
      const narrowed = filterMonstersForCreaturePortrait(tailOrFull, creatureImg, displayedLevel);
      const scoredCandidates = narrowed.length > 0 ? narrowed : tailOrFull;

      if (ambiguousDom && scoredCandidates.length > 1) {
        const inTail = scoredCandidates.filter((m) => bucket.indexOf(m) >= idx);
        if (inTail.length > 0) {
          inTail.sort((a, b) => bucket.indexOf(a) - bucket.indexOf(b));
          const pick = inTail[0];
          idx = bucket.indexOf(pick);
          selected = pick;
        }
      } else {
        const rarityFromMonster = (m) => {
          if (isEliteMonster(m)) return 6;
          const tier = Number(m?.tier || 1);
          return Math.max(1, Math.min(5, tier + 1));
        };

        let bestGlobalIdx = -1;
        let bestScore = -Infinity;
        for (let i = 0; i < scoredCandidates.length; i++) {
          const m = scoredCandidates[i];
          const globalIdx = bucket.indexOf(m);
          if (globalIdx < idx) continue;
          let score = 0;
          if (displayedLevel && getLevelFromExp(m.exp || 0) === displayedLevel) score += 100;
          if (isEliteMonster(m) === wantsElite) score += 40;
          if (Boolean(m.shiny) === wantsShiny) score += 20;
          if (Number.isFinite(wantsRarity) && rarityFromMonster(m) === wantsRarity) score += 15;
          score -= (globalIdx - idx) * 0.001;
          if (score > bestScore) {
            bestScore = score;
            bestGlobalIdx = globalIdx;
          }
        }
        if (bestGlobalIdx >= 0) {
          idx = bestGlobalIdx;
          selected = bucket[idx];
        }
      }
    }

    gameIdIndexMap.set(gameId, idx + 1);
    const seq = advancedHoverState.sequence++;
    resolved.push({ imgEl: creatureImg, monster: selected });
    advancedHoverState.debugByImg.set(creatureImg, {
      sequence: seq,
      gameId,
      displayedLevel,
      wantsElite,
      wantsShiny,
      wantsRarity: Number.isFinite(wantsRarity) ? wantsRarity : null,
      ambiguousDom,
      baseIdx,
      finalIdx: idx,
      bucketLength: bucket.length,
      chosenMonsterId: selected?.id || null,
      chosenStats: selected ? {
        hp: selected.hp || 0,
        ad: selected.ad || 0,
        ap: selected.ap || 0,
        armor: selected.armor || 0,
        magicResist: selected.magicResist || 0
      } : null,
      candidates: bucket.map((m, i) => ({
        i,
        id: m.id,
        level: getLevelFromExp(m.exp || 0),
        elite: isEliteMonster(m),
        shiny: Boolean(m.shiny),
        rarity: isEliteMonster(m) ? 6 : Math.max(1, Math.min(5, Number(m?.tier || 1) + 1)),
        hp: m.hp || 0,
        ad: m.ad || 0,
        ap: m.ap || 0,
        armor: m.armor || 0,
        magicResist: m.magicResist || 0
      }))
    });
  }

  return resolved;
}

function rebuildAdvancedHoverResolvedMap() {
  const monsters = getPlayerMonsters();
  const byId = new Map((Array.isArray(monsters) ? monsters : []).map((m) => [String(m.id), m]));
  const visibleImgs = getVisibleInventoryCreatureImgsForHover();

  const depotIdMap =
    typeof window !== 'undefined' && typeof window.depotManager?.getBestiaryCreatureIdMap === 'function'
      ? window.depotManager.getBestiaryCreatureIdMap()
      : null;

  const monsterScrollImgs = [];
  const otherInventoryImgs = [];
  for (const img of visibleImgs) {
    if (img.closest('#monster-scroll')) monsterScrollImgs.push(img);
    else otherInventoryImgs.push(img);
  }

  advancedHoverState.resolvedByImg = new WeakMap();

  for (const img of monsterScrollImgs) {
    const uid = depotIdMap?.get(img);
    let monster = uid != null ? byId.get(String(uid)) : null;
    if (!monster) {
      const button = img.closest('button');
      monster = scoreMatchMonsterForCreatureButton(button, monsters);
    }
    if (monster) advancedHoverState.resolvedByImg.set(img, monster);
  }

  if (otherInventoryImgs.length > 0) {
    const resolved = resolveHoverCreaturesSequentially(otherInventoryImgs, monsters);
    resolved.forEach(({ imgEl, monster }) => {
      if (monster) advancedHoverState.resolvedByImg.set(imgEl, monster);
    });
  }
}

function scoreMatchMonsterForCreatureButton(button, monstersArg) {
  const creatureImg = button?.querySelector?.('img[alt="creature"]');
  if (!creatureImg) return null;
  const gameId = getCreatureGameId(creatureImg);
  if (!gameId) return null;
  let pool = Array.isArray(monstersArg) ? monstersArg.filter((m) => m.gameId === gameId) : [];
  if (pool.length === 0) return null;

  const depotSet = button.closest('#monster-scroll') ? getDepotCreatureIdSetForHover() : null;
  if (depotSet && depotSet.size > 0) {
    pool = pool.filter((m) => !depotSet.has(String(m.id)));
    if (pool.length === 0) return null;
  }

  const levelSpan = button.querySelector('span[translate="no"]');
  const displayedLevel = levelSpan ? parseInt(levelSpan.textContent, 10) : null;
  const slot = creatureImg.closest('.container-slot');
  const wantsElite = inferWantsEliteFromCreatureSlot(slot);
  const wantsShiny = creatureImg.src.includes('-shiny');
  const rarityEl = slot?.querySelector('.has-rarity');
  const wantsRarity = parseInt(rarityEl?.getAttribute('data-rarity') || '', 10);

  const rarityFromMonster = (m) => {
    if (isEliteMonster(m)) return 6;
    const tier = Number(m?.tier || 1);
    return Math.max(1, Math.min(5, tier + 1));
  };

  let poolUse = filterMonstersForCreaturePortrait(pool, creatureImg, displayedLevel);
  if (poolUse.length === 0) poolUse = pool;

  if (
    poolUse.length > 1 &&
    creatureSlotDomAmbiguousDuplicates(slot) &&
    button.closest('#monster-scroll')
  ) {
    const sorted = sortMonstersByVisualOrder(poolUse);
    const k = countSameGameIdPrecedingInMonsterScroll(creatureImg, gameId);
    return sorted[Math.min(k, sorted.length - 1)] || null;
  }

  let best = null;
  let bestScore = -Infinity;
  for (const m of poolUse) {
    let score = 0;
    if (displayedLevel && getLevelFromExp(m.exp || 0) === displayedLevel) score += 100;
    if (isEliteMonster(m) === wantsElite) score += 40;
    if (Boolean(m.shiny) === wantsShiny) score += 20;
    if (Number.isFinite(wantsRarity) && rarityFromMonster(m) === wantsRarity) score += 15;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

/**
 * #monster-scroll: Depot Manager full-grid id map (depot + visual match) — not visible-only sequential,
 * which breaks after search/hidden depot. Other inventory UIs keep sequential over their visible imgs.
 */
function resolveMonsterForButtonOnDemand(button) {
  const creatureImg = button?.querySelector?.('img[alt="creature"]');
  if (!creatureImg) return null;
  const monsters = getPlayerMonsters();

  if (button.closest('#monster-scroll')) {
    const depotMap =
      typeof window !== 'undefined' && typeof window.depotManager?.getBestiaryCreatureIdMap === 'function'
        ? window.depotManager.getBestiaryCreatureIdMap()
        : null;
    if (depotMap) {
      const uid = depotMap.get(creatureImg);
      if (uid != null && Array.isArray(monsters)) {
        const tagged = monsters.find((m) => String(m.id) === String(uid));
        if (tagged) return tagged;
      }
    }
    return scoreMatchMonsterForCreatureButton(button, monsters);
  }

  const visibleImgs = getVisibleInventoryCreatureImgsForHover().filter(
    (img) => !img.closest('#monster-scroll')
  );
  if (visibleImgs.length > 0) {
    const resolved = resolveHoverCreaturesSequentially(visibleImgs, monsters);
    const hit = resolved.find((r) => r.imgEl === creatureImg);
    if (hit?.monster) return hit.monster;
  }

  return scoreMatchMonsterForCreatureButton(button, monsters);
}

function getReactFiberNode(el) {
  if (!el) return null;
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
  return key ? el[key] : null;
}

function findMonsterIdInObject(value, seen = new Set(), depth = 0) {
  if (!value || typeof value !== 'object' || seen.has(value) || depth > 4) return null;
  seen.add(value);

  // Direct keys commonly used in board/setup objects
  if (typeof value.monsterId === 'string' || typeof value.monsterId === 'number') return value.monsterId;
  if (typeof value.databaseId === 'string' || typeof value.databaseId === 'number') return value.databaseId;
  if (value.piece && (typeof value.piece.monsterId === 'string' || typeof value.piece.monsterId === 'number')) return value.piece.monsterId;

  for (const child of Object.values(value)) {
    const found = findMonsterIdInObject(child, seen, depth + 1);
    if (found != null) return found;
  }
  return null;
}

function resolveMonsterFromReactFiber(button) {
  try {
    const fiber = getReactFiberNode(button);
    if (!fiber) return null;
    const monsters = getPlayerMonsters();
    if (!Array.isArray(monsters) || monsters.length === 0) return null;

    let node = fiber;
    let hops = 0;
    while (node && hops < 35) {
      const props = node.memoizedProps || node.pendingProps || null;
      const maybeId = props ? findMonsterIdInObject(props) : null;
      if (maybeId != null) {
        const match = monsters.find((m) => String(m.id) === String(maybeId));
        if (match) {
          return match;
        }
      }
      node = node.return || null;
      hops += 1;
    }
  } catch (error) {
    // Silent fallback to heuristic resolver.
  }
  return null;
}

function getEquipmentForMonster(monster) {
  if (!monster) return null;
  const equipId = monster.equipId ?? monster.equip?.gameId;
  if (!equipId) return null;

  const equipment = {
    id: equipId,
    name: `Equipment ${equipId}`,
    stat: monster.equip?.stat || null,
    tier: monster.equip?.tier || null
  };

  try {
    const equips = globalThis.state?.player?.getSnapshot?.()?.context?.equips || [];
    const matchedById = equips.find((e) => String(e?.id) === String(equipId));
    const matchedByGameId = equips.find((e) => String(e?.gameId) === String(equipId));
    const matched = matchedById || matchedByGameId;
    if (matched) {
      equipment.stat = equipment.stat || matched.stat || null;
      equipment.tier = equipment.tier || matched.tier || null;
      equipment.id = matched.gameId || equipId;
    }
  } catch (error) {
    // Best effort lookup only.
  }

  try {
    const equipData = globalThis.state?.utils?.getEquipment?.(equipment.id);
    if (equipData?.metadata?.name) {
      equipment.name = equipData.metadata.name;
    }
    if (equipData?.metadata?.spriteId) {
      equipment.spriteId = equipData.metadata.spriteId;
    }
  } catch (error) {
    // Name fallback is good enough.
  }

  return equipment;
}

function getMonsterInfoFromButton(button) {
  const creatureImg = button.querySelector('img[alt="creature"]');
  if (!creatureImg) return null;

  // Best source when Depot Manager tagged a hidden depot slot with unique creature id.
  const slotWithId = button.closest('div.flex[data-depot-creature-id]');
  const taggedId = slotWithId?.getAttribute('data-depot-creature-id');
  const slotIsDepotHidden =
    slotWithId?.getAttribute('data-depot-hidden') === 'true' ||
    (slotWithId && window.getComputedStyle(slotWithId).display === 'none');
  const monsters = getPlayerMonsters();
  if (taggedId && slotIsDepotHidden && Array.isArray(monsters)) {
    const taggedMonster = monsters.find((m) => String(m.id) === String(taggedId));
    if (taggedMonster) {
      const gameIdTagged = getCreatureGameId(creatureImg);
      return {
        gameId: gameIdTagged,
        creatureName: (() => {
          try {
            return globalThis.state?.utils?.getMonster?.(gameIdTagged)?.metadata?.name || `Creature ${gameIdTagged}`;
          } catch (error) {
            return `Creature ${gameIdTagged}`;
          }
        })(),
        level: getLevelFromExp(taggedMonster.exp || 0),
        hp: taggedMonster.hp || 0,
        ad: taggedMonster.ad || 0,
        ap: taggedMonster.ap || 0,
        armor: taggedMonster.armor || 0,
        magicResist: taggedMonster.magicResist || 0,
        equipment: getEquipmentForMonster(taggedMonster)
      };
    }
  }

  const gameId = getCreatureGameId(creatureImg);
  const inMonsterScroll = Boolean(button.closest('#monster-scroll'));
  const monsterFromFiber = resolveMonsterFromReactFiber(button);
  const monsterFromMap = advancedHoverState.resolvedByImg.get(creatureImg);
  const monsterFromOnDemand = resolveMonsterForButtonOnDemand(button);

  // Bestiary grid: depot / visual map must beat React fiber — fiber often points at the wrong duplicate.
  let monster = null;
  if (inMonsterScroll) {
    monster = monsterFromOnDemand || monsterFromMap || monsterFromFiber;
  } else {
    monster = monsterFromFiber || monsterFromMap || monsterFromOnDemand;
  }

  if (!monster) return null;

  const level = (() => {
    try {
      return globalThis.state?.utils?.expToCurrentLevel ? globalThis.state.utils.expToCurrentLevel(monster.exp || 0) : 1;
    } catch (error) {
      return 1;
    }
  })();

  return {
    gameId,
    creatureName: (() => {
      try {
        return globalThis.state?.utils?.getMonster?.(gameId)?.metadata?.name || `Creature ${gameId}`;
      } catch (error) {
        return `Creature ${gameId}`;
      }
    })(),
    level,
    hp: monster.hp || 0,
    ad: monster.ad || 0,
    ap: monster.ap || 0,
    armor: monster.armor || 0,
    magicResist: monster.magicResist || 0,
    equipment: getEquipmentForMonster(monster)
  };
}

function getAbilityInfoForGameId(gameId) {
  if (!gameId) return null;
  try {
    const monsterData = globalThis.state?.utils?.getMonster?.(gameId);
    const skill = monsterData?.metadata?.skill;
    if (!skill) return null;
    const icon = skill.icon || (skill.src ? `https://bestiaryarena.com/assets/spells/${skill.src}.png` : null);
    return {
      name: skill.name || 'Ability',
      icon,
      TooltipContent: skill.TooltipContent || null
    };
  } catch (error) {
    return null;
  }
}

function createAdvancedHoverStatRow(label, value, maxValue, barColor = 'rgb(96, 192, 96)') {
  const statRow = document.createElement('div');
  statRow.setAttribute('data-transparent', 'false');
  statRow.className = 'pixel-font-16 whitespace-nowrap text-whiteRegular';

  const topRow = document.createElement('div');
  topRow.className = 'flex justify-between';

  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  topRow.appendChild(labelSpan);

  const valueSpan = document.createElement('span');
  valueSpan.className = 'text-right text-whiteExp';
  valueSpan.style.width = '3ch';
  valueSpan.textContent = value.toString();
  topRow.appendChild(valueSpan);

  statRow.appendChild(topRow);

  const barRow = document.createElement('div');
  barRow.className = 'relative';

  const barOuter = document.createElement('div');
  barOuter.className = 'frame-pressed-1 relative h-1 w-full overflow-hidden border border-solid border-black bg-black gene-stats-bar-filled';
  barOuter.style.animationDelay = '700ms';

  const barFillWrap = document.createElement('div');
  barFillWrap.className = 'absolute left-0 top-0 flex h-full w-full';

  const barFill = document.createElement('div');
  barFill.className = 'h-full shrink-0';
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));
  barFill.style.width = `${percentage}%`;
  barFill.style.background = barColor;

  barFillWrap.appendChild(barFill);
  barOuter.appendChild(barFillWrap);

  const barRight = document.createElement('div');
  barRight.className = 'absolute left-full top-1/2 z-[201] -translate-y-1/2';
  barRight.style.display = 'block';

  const skillBar = document.createElement('div');
  skillBar.className = 'relative text-skillBar';

  const spill1 = document.createElement('div');
  spill1.className = 'spill-particles absolute left-full h-px w-0.5 bg-current';
  const spill2 = document.createElement('div');
  spill2.className = 'spill-particles-2 absolute left-full h-px w-0.5 bg-current';

  skillBar.appendChild(spill1);
  skillBar.appendChild(spill2);
  barRight.appendChild(skillBar);

  barRow.appendChild(barOuter);
  barRow.appendChild(barRight);
  statRow.appendChild(barRow);

  return statRow;
}

function createEquipmentIconForTooltip(equipment) {
  if (!equipment?.spriteId || !api?.ui?.components?.createItemPortrait) {
    return null;
  }
  try {
    return api.ui.components.createItemPortrait({
      itemId: equipment.spriteId,
      stat: equipment.stat || 'ad',
      tier: equipment.tier || 1,
      onClick: () => {}
    });
  } catch (error) {
    return null;
  }
}

function buildAdvancedStatsTooltip(info) {
  const mountedComponents = [];
  const tooltip = document.createElement('div');
  tooltip.className = 'mod-settings-advanced-hover-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    display: none;
    z-index: 10000;
    pointer-events: none;
  `;

  const tooltipContent = document.createElement('div');
  tooltipContent.className = 'frame-pressed-1 surface-dark flex shrink-0 flex-col gap-1.5 px-2 py-1 pb-2';

  if (config.showAdvancedStatsOnHover) {
    tooltipContent.appendChild(createAdvancedHoverStatRow('Hitpoints', info.hp, 20));
    tooltipContent.appendChild(createAdvancedHoverStatRow('Attack', info.ad, 20));
    tooltipContent.appendChild(createAdvancedHoverStatRow('Ability Power', info.ap, 20));
    tooltipContent.appendChild(createAdvancedHoverStatRow('Armor', info.armor, 20));
    tooltipContent.appendChild(createAdvancedHoverStatRow('Magic Resist', info.magicResist, 20));

    const equipmentRow = document.createElement('div');
    equipmentRow.className = 'flex items-center gap-2 pt-1';
    const equipmentLabel = document.createElement('span');
    equipmentLabel.className = 'pixel-font-16 text-whiteRegular';
    equipmentLabel.textContent = 'Equipment:';
    equipmentRow.appendChild(equipmentLabel);

    const equipIcon = createEquipmentIconForTooltip(info.equipment);
    if (equipIcon) {
      equipmentRow.appendChild(equipIcon);
    } else {
      const noEquip = document.createElement('span');
      noEquip.className = 'pixel-font-16 text-whiteDark';
      noEquip.textContent = 'none';
      equipmentRow.appendChild(noEquip);
    }
    tooltipContent.appendChild(equipmentRow);
  }

  if (config.showAbilityOnHover) {
    const abilityInfo = getAbilityInfoForGameId(info.gameId);
    if (abilityInfo) {
      if (config.showAdvancedStatsOnHover) {
        const divider = document.createElement('div');
        divider.style.cssText = 'height: 1px; background: rgba(255,255,255,0.2); margin: 2px 0;';
        tooltipContent.appendChild(divider);
      }

      const abilityHeader = document.createElement('div');
      abilityHeader.className = 'flex items-center gap-2 pt-1';
      const abilityLabel = document.createElement('span');
      abilityLabel.className = 'pixel-font-16 text-whiteExp';
      abilityLabel.textContent = abilityInfo.name || 'Ability';
      abilityHeader.appendChild(abilityLabel);
      tooltipContent.appendChild(abilityHeader);

      const pushAbilityBlock = (title, awaken) => {
        const root = document.createElement('div');
        root.classList.add('tooltip-prose');
        root.classList.add('pixel-font-14');
        root.style.cssText = 'max-width: 200px; color: #fff; line-height: 1.1;';
        tooltipContent.appendChild(root);

        if (typeof globalThis.state?.utils?.createUIComponent === 'function' && abilityInfo.TooltipContent) {
          try {
            const component = awaken
              ? globalThis.state.utils.createUIComponent(root, abilityInfo.TooltipContent, { awaken: true })
              : globalThis.state.utils.createUIComponent(root, abilityInfo.TooltipContent);
            if (component && typeof component.mount === 'function') {
              component.mount();
              mountedComponents.push(component);
              const blockquotes = root.querySelectorAll('blockquote');
              blockquotes.forEach((bq) => {
                bq.style.setProperty('font-size', '10px', 'important');
              });
            } else {
              root.textContent = 'Ability details unavailable';
              root.className = 'pixel-font-14 text-whiteDark';
            }
          } catch (error) {
            root.textContent = 'Ability details unavailable';
            root.className = 'pixel-font-14 text-whiteDark';
          }
        } else {
          root.textContent = 'Ability details unavailable';
          root.className = 'pixel-font-14 text-whiteDark';
        }
      };

      pushAbilityBlock('Awakened', true);
    }
  }

  tooltip.appendChild(tooltipContent);

  return {
    tooltip,
    cleanup: () => {
      mountedComponents.forEach((component) => {
        try {
          component?.unmount?.();
        } catch (error) {
          // Best effort cleanup.
        }
      });
    }
  };
}

function buildEquipmentEffectTooltip(gameId, tier = 1) {
  if (gameId == null) return null;
  let equipData = null;
  try {
    equipData = globalThis.state?.utils?.getEquipment?.(gameId);
  } catch (error) {
    return null;
  }
  if (!equipData) return null;

  const effectTier =
    window.equipmentDatabase?.clampEquipmentTier?.(tier) ??
    (Number.isFinite(Number(tier)) ? Math.min(5, Math.max(1, Number(tier))) : 1);

  const mountedComponents = [];
  const tooltip = document.createElement('div');
  tooltip.className = 'mod-settings-advanced-hover-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    display: none;
    z-index: 10000;
    pointer-events: none;
  `;

  const tooltipContent = document.createElement('div');
  tooltipContent.className = 'frame-pressed-1 surface-dark flex shrink-0 flex-col gap-1.5 px-2 py-1 pb-2';

  const abilityHeader = document.createElement('div');
  abilityHeader.className = 'flex items-center gap-2 pt-1';
  const abilityLabel = document.createElement('span');
  abilityLabel.className = 'pixel-font-16 text-whiteExp';
  abilityLabel.textContent = equipData?.metadata?.name || 'Equipment';
  abilityHeader.appendChild(abilityLabel);
  tooltipContent.appendChild(abilityHeader);

  const root = document.createElement('div');
  root.classList.add('tooltip-prose');
  root.classList.add('pixel-font-14');
  root.style.cssText = 'max-width: 200px; color: #e6d7b0; line-height: 1.1;';
  tooltipContent.appendChild(root);

  if (equipData?.metadata?.description) {
    root.innerHTML = equipData.metadata.description;
  } else if (equipData?.metadata?.EffectComponent) {
    const component = window.equipmentDatabase?.mountEquipmentEffectComponent?.(
      root,
      equipData.metadata.EffectComponent,
      effectTier
    );
    if (component) {
      mountedComponents.push(component);
      root.querySelectorAll('blockquote').forEach((bq) => {
        bq.style.setProperty('font-size', '10px', 'important');
      });
    } else {
      root.textContent = 'Effect details unavailable';
      root.className = 'pixel-font-14 text-whiteDark';
    }
  } else {
    root.textContent = 'No description available.';
    root.className = 'pixel-font-14 text-whiteDark';
  }

  tooltip.appendChild(tooltipContent);

  return {
    tooltip,
    cleanup: () => {
      mountedComponents.forEach((component) => {
        try {
          component?.unmount?.();
        } catch (error) {
          // Best effort cleanup.
        }
      });
    }
  };
}

function attachEquipmentAbilityHoverTooltip(button) {
  if (!button || button.dataset.equipmentEffectHoverAttached === 'true') return;
  if (!config.showAbilityOnHover) return;
  const grid = resolveEquipmentHoverGrid();
  if (!grid || !grid.contains(button) || !isEquipmentHoverCandidateButton(button)) return;

  /** @type {ReturnType<typeof setTimeout> | null} */
  let showTimeout = null;

  const destroyTooltip = () => {
    if (showTimeout) {
      clearTimeout(showTimeout);
      showTimeout = null;
    }
    if (advancedHoverState.activeButton === button) {
      destroyActiveAdvancedHoverTooltip();
    }
  };

  const show = () => {
    if (showTimeout) clearTimeout(showTimeout);
    const token = ++advancedHoverState.activeToken;
    destroyActiveAdvancedHoverTooltip();
    showTimeout = setTimeout(() => {
      showTimeout = null;
      if (token !== advancedHoverState.activeToken) return;
      destroyTooltip();
      const equipGameId = resolveEquipmentGameIdFromInventoryButton(button);
      if (equipGameId == null) return;
      const tier = getEquipmentTierFromInventoryButton(button);
      const built = buildEquipmentEffectTooltip(equipGameId, tier);
      if (!built) return;
      advancedHoverState.activeTooltip = built.tooltip;
      advancedHoverState.activeCleanup = built.cleanup;
      advancedHoverState.activeButton = button;
      document.body.appendChild(advancedHoverState.activeTooltip);
      advancedHoverState.activeTooltip.style.display = 'block';
      positionAdvancedStatsTooltip(advancedHoverState.activeTooltip, button);
    }, TIMEOUT_DELAYS.HOVER_TOOLTIP_SHOW);
  };
  const hide = () => {
    destroyTooltip();
  };
  const move = () => {
    if (advancedHoverState.activeButton === button && advancedHoverState.activeTooltip && advancedHoverState.activeTooltip.style.display === 'block') {
      positionAdvancedStatsTooltip(advancedHoverState.activeTooltip, button);
    }
  };

  button.addEventListener('mouseenter', show);
  button.addEventListener('mouseleave', hide);
  button.addEventListener('mousemove', move);

  button.dataset.equipmentEffectHoverAttached = 'true';
  button._equipmentEffectHover = {
    get tooltip() {
      return advancedHoverState.activeButton === button ? advancedHoverState.activeTooltip : null;
    },
    show,
    hide,
    move,
    cleanup: destroyTooltip
  };
}

function ensureEquipmentHoverDelegation() {
  if (equipmentHoverDelegationState.delegatedBound || !config.showAbilityOnHover) return;
  const handler = (event) => {
    if (!config.showAbilityOnHover) return;
    const grid = resolveEquipmentHoverGrid();
    if (!grid) return;
    const button = event.target?.closest?.('button');
    if (!button || !grid.contains(button)) return;
    if (!isEquipmentHoverCandidateButton(button)) return;
    if (button.dataset.equipmentEffectHoverAttached === 'true') return;
    attachEquipmentAbilityHoverTooltip(button);
  };
  document.addEventListener('mouseover', handler, true);
  equipmentHoverDelegationState.delegatedHandler = handler;
  equipmentHoverDelegationState.delegatedBound = true;
}

function teardownEquipmentHoverDelegation() {
  if (!equipmentHoverDelegationState.delegatedBound || !equipmentHoverDelegationState.delegatedHandler) return;
  document.removeEventListener('mouseover', equipmentHoverDelegationState.delegatedHandler, true);
  equipmentHoverDelegationState.delegatedHandler = null;
  equipmentHoverDelegationState.delegatedBound = false;
}

function positionAdvancedStatsTooltip(tooltip, button) {
  const rect = button.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();

  let left = rect.right + 8;
  let top = rect.top;

  if (left + tooltipRect.width > window.innerWidth - 8) {
    left = rect.left - tooltipRect.width - 8;
  }
  if (top + tooltipRect.height > window.innerHeight - 8) {
    top = window.innerHeight - tooltipRect.height - 8;
  }
  if (top < 8) top = 8;

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function attachAdvancedStatsTooltip(button) {
  if (!button || button.dataset.advancedStatsHoverAttached === 'true') return;
  if (!isInventoryCreatureButton(button)) return;

  /** @type {ReturnType<typeof setTimeout> | null} */
  let showTimeout = null;

  const destroyTooltip = () => {
    if (showTimeout) {
      clearTimeout(showTimeout);
      showTimeout = null;
    }
    if (advancedHoverState.activeButton === button) {
      destroyActiveAdvancedHoverTooltip();
    }
  };

  const show = () => {
    if (showTimeout) clearTimeout(showTimeout);
    const token = ++advancedHoverState.activeToken;
    // Ensure only one tooltip can ever exist while hovering between slots.
    destroyActiveAdvancedHoverTooltip();
    showTimeout = setTimeout(() => {
      showTimeout = null;
      if (token !== advancedHoverState.activeToken) return;
      // Always rebuild fresh so stats are up to date when hovering.
      destroyTooltip();
      rebuildAdvancedHoverResolvedMap();
      logHoveredCreatureResolutionCompare(button);
      const info = getMonsterInfoFromButton(button);
      if (!info) return;
      const built = buildAdvancedStatsTooltip(info);
      advancedHoverState.activeTooltip = built.tooltip;
      advancedHoverState.activeCleanup = built.cleanup;
      advancedHoverState.activeButton = button;
      document.body.appendChild(advancedHoverState.activeTooltip);
      advancedHoverState.activeTooltip.style.display = 'block';
      positionAdvancedStatsTooltip(advancedHoverState.activeTooltip, button);
    }, TIMEOUT_DELAYS.HOVER_TOOLTIP_SHOW);
  };
  const hide = () => {
    destroyTooltip();
  };
  const move = () => {
    if (advancedHoverState.activeButton === button && advancedHoverState.activeTooltip && advancedHoverState.activeTooltip.style.display === 'block') {
      positionAdvancedStatsTooltip(advancedHoverState.activeTooltip, button);
    }
  };

  button.addEventListener('mouseenter', show);
  button.addEventListener('mouseleave', hide);
  button.addEventListener('mousemove', move);

  button.dataset.advancedStatsHoverAttached = 'true';
  button._advancedStatsHover = {
    get tooltip() { return advancedHoverState.activeButton === button ? advancedHoverState.activeTooltip : null; },
    show,
    hide,
    move,
    cleanup: destroyTooltip
  };
}

function isCreatureHoverTooltipEnabled() {
  return Boolean(config.showAdvancedStatsOnHover || config.showAbilityOnHover);
}

function ensureAdvancedHoverDelegation() {
  if (advancedHoverState.delegatedBound) return;
  const handler = (event) => {
    if (!isCreatureHoverTooltipEnabled()) return;
    const button = event.target?.closest?.('button[data-picked]');
    if (!button || !isInventoryCreatureButton(button)) return;
    if (button.dataset.advancedStatsHoverAttached === 'true') return;
    rebuildAdvancedHoverResolvedMap();
    attachAdvancedStatsTooltip(button);
  };
  document.addEventListener('mouseover', handler, true);
  advancedHoverState.delegatedHandler = handler;
  advancedHoverState.delegatedBound = true;
}

function teardownAdvancedHoverDelegation() {
  if (!advancedHoverState.delegatedBound || !advancedHoverState.delegatedHandler) return;
  document.removeEventListener('mouseover', advancedHoverState.delegatedHandler, true);
  advancedHoverState.delegatedHandler = null;
  advancedHoverState.delegatedBound = false;
}

function applyAdvancedStatsOnHover() {
  if (isCreatureHoverTooltipEnabled()) {
    rebuildAdvancedHoverResolvedMap();
    getCreatureHoverTargetButtons().forEach(attachAdvancedStatsTooltip);
    ensureAdvancedHoverDelegation();
  }
  if (config.showAbilityOnHover) {
    getEquipmentHoverTargetButtons().forEach(attachEquipmentAbilityHoverTooltip);
    ensureEquipmentHoverDelegation();
  }
}

function removeAdvancedStatsOnHover() {
  teardownAdvancedHoverDelegation();
  teardownEquipmentHoverDelegation();
  destroyActiveAdvancedHoverTooltip();
  document.querySelectorAll('button[data-advanced-stats-hover-attached="true"]').forEach((button) => {
    const refs = button._advancedStatsHover;
    if (refs) {
      button.removeEventListener('mouseenter', refs.show);
      button.removeEventListener('mouseleave', refs.hide);
      button.removeEventListener('mousemove', refs.move);
      refs.cleanup?.();
      refs.tooltip?.remove();
      delete button._advancedStatsHover;
    }
    button.removeAttribute('data-advanced-stats-hover-attached');
  });
  document.querySelectorAll('button[data-equipment-effect-hover-attached="true"]').forEach((button) => {
    const refs = button._equipmentEffectHover;
    if (refs) {
      button.removeEventListener('mouseenter', refs.show);
      button.removeEventListener('mouseleave', refs.hide);
      button.removeEventListener('mousemove', refs.move);
      refs.cleanup?.();
      refs.tooltip?.remove();
      delete button._equipmentEffectHover;
    }
    button.removeAttribute('data-equipment-effect-hover-attached');
  });
}

// =======================
// 10. Shiny Enemies
// =======================

// Helper: Get sprite ID from monster metadata (handles item-type monsters)
function getSpriteIdForEnemy(enemy) {
  let spriteId = enemy.gameId;
  if (globalThis.state?.utils?.getMonster) {
    const monster = globalThis.state.utils.getMonster(enemy.gameId);
    if (monster?.metadata?.spriteId) {
      spriteId = monster.metadata.spriteId;
    }
  }
  return spriteId;
}

// Helper: Extract sprite ID from DOM element's class list
function extractSpriteIdFromClasses(element) {
  const classList = Array.from(element.classList);
  const idClass = classList.find(cls => cls.startsWith('id-'));
  return idClass ? idClass.replace('id-', '') : null;
}

// Helper: Check if creature is in the unobtainable list
// Handles numbered variants like "Dwarf Henchman 4" only — not distinct species that share a prefix (e.g. "Orc" vs "Orc Spearman")
function isCreatureUnobtainable(creatureName) {
  if (!creatureName) return false;
  const UNOBTAINABLE_CREATURES = window.creatureDatabase?.UNOBTAINABLE_CREATURES || [];
  const creatureNameLower = creatureName.toLowerCase();
  return UNOBTAINABLE_CREATURES.some(c => {
    const unobtainableLower = c.toLowerCase();
    if (unobtainableLower === creatureNameLower) return true;
    if (!creatureNameLower.startsWith(unobtainableLower + ' ')) return false;
    const suffix = creatureNameLower.slice(unobtainableLower.length + 1);
    return /^\d+$/.test(suffix);
  });
}

// Helper: Skip shiny enemy overlay when the creature has no shiny sprite assets
function shouldSkipShinyEnemy(creatureName) {
  if (!creatureName) return false;
  if (isCreatureUnobtainable(creatureName)) return true;
  return window.creatureDatabase?.creatureHasShinyVariant?.(creatureName) === false;
}

// Helper: Check if a battle container is an enemy (red health bar)
function isEnemyByHealthBar(battleContainer) {
  const healthBar = battleContainer.querySelector('.h-full.shrink-0');
  return healthBar && healthBar.style.background && 
         healthBar.style.background.includes('rgb(255, 102, 102)');
}

function applyShinyEnemies() {
  // Skip if Board Analyzer or Autoscroller is running
  if (isBlockedByAnalysisMods()) {
    return;
  }
  
  try {
    // Get board configuration from game state
    const boardSnapshot = globalThis.state?.board?.getSnapshot();
    const boardConfig = boardSnapshot?.context?.boardConfig;
    
    if (!boardConfig || !Array.isArray(boardConfig)) {
      console.log('[Mod Settings] No board configuration available yet (not in a game)');
      return;
    }
    
    
    // Filter for enemies (villain: true)
    const enemies = boardConfig.filter(entity => entity.villain === true);
    
    if (enemies.length === 0) {
      console.log('[Mod Settings] No enemies found on board - start a battle to see shiny enemies!');
      return;
    }
    
    let appliedCount = 0;
    let skippedCount = 0;
    
    // Group enemies by spriteId to handle cases where multiple enemies or allies share the same sprite
    const enemySpriteCount = new Map();
    enemies.forEach(enemy => {
      const spriteId = getSpriteIdForEnemy(enemy);
      enemySpriteCount.set(spriteId, (enemySpriteCount.get(spriteId) || 0) + 1);
    });
    
    enemies.forEach(enemy => {
      // Get monster metadata and sprite ID
      let creatureName = null;
      let spriteId = getSpriteIdForEnemy(enemy);
      
      if (globalThis.state?.utils?.getMonster) {
        const monster = globalThis.state.utils.getMonster(enemy.gameId);
        creatureName = monster?.metadata?.name;
      }
      
      if (shouldSkipShinyEnemy(creatureName)) {
        skippedCount++;
        return;
      }
      
      // Find the DOM element for this enemy using spriteId
      const selector = `.sprite.id-${spriteId}`;
      const allSprites = document.querySelectorAll(selector);
      
      // Only apply to the first N sprites where N = number of enemies with this spriteId
      const numEnemiesWithThisSprite = enemySpriteCount.get(spriteId) || 0;
      const spritesToMakeShiny = Array.from(allSprites).slice(0, numEnemiesWithThisSprite);
      
      spritesToMakeShiny.forEach(spriteDiv => {
        // Skip sprites inside modals/dialogs (e.g., Bestiary)
        if (spriteDiv.closest('[role="dialog"]')) return;
        
        const spriteImg = spriteDiv.querySelector('img.spritesheet[data-shiny]');
        if (spriteImg && spriteImg.getAttribute('data-shiny') === 'false') {
          spriteImg.setAttribute('data-shiny', 'true');
          appliedCount++;
        }
      });
    });
    
    // Also apply shiny to all item sprites in battle (e.g., sleeping Bear uses item sprite 7175)
    // These are state-based sprite variations that don't match the creature's main spriteId
    const itemSprites = document.querySelectorAll('.sprite.item img.spritesheet[data-shiny]');
    itemSprites.forEach(img => {
      // Skip sprites inside modals/dialogs (e.g., Bestiary)
      if (img.closest('[role="dialog"]')) return;
      
      const battleContainer = img.closest('[data-name]');
      if (battleContainer && isEnemyByHealthBar(battleContainer)) {
        const creatureName = battleContainer.getAttribute('data-name');
        if (shouldSkipShinyEnemy(creatureName)) {
          return;
        }
        if (img.getAttribute('data-shiny') === 'false') {
          img.setAttribute('data-shiny', 'true');
          appliedCount++;
        }
      }
    });
    
    // Apply shiny to visual-only summons (e.g., War Wolf) not in boardConfig
    const allBattleContainers = document.querySelectorAll('[data-name]');
    
    allBattleContainers.forEach(container => {
      // Skip containers inside modals/dialogs (e.g., Bestiary)
      if (container.closest('[role="dialog"]')) return;
      
      const creatureName = container.getAttribute('data-name');
      
      if (isEnemyByHealthBar(container)) {
        if (shouldSkipShinyEnemy(creatureName)) {
          return;
        }
        
        const outfitSprites = container.querySelectorAll('.sprite.outfit img.spritesheet[data-shiny]');
        
        outfitSprites.forEach(spriteImg => {
          if (spriteImg.getAttribute('data-shiny') === 'false') {
            spriteImg.setAttribute('data-shiny', 'true');
            appliedCount++;
          }
        });
      }
    });
    
    // Only log when something actually happened and result is different from last time
    if (appliedCount > 0) {
      const currentResult = `${appliedCount}-${skippedCount}`;
      if (lastShinyEnemiesLogResult !== currentResult) {
        console.log(`[Mod Settings] Shiny enemies applied to ${appliedCount} creatures (skipped ${skippedCount} unobtainable)`);
        lastShinyEnemiesLogResult = currentResult;
      }
    }
  } catch (error) {
    console.error('[Mod Settings] Error applying shiny enemies:', error);
  }
}

function removeShinyEnemies() {
  try {
    // Reset all actor sprites to non-shiny (simpler approach for removal)
    const allActorSprites = document.querySelectorAll('img.actor.spritesheet[data-shiny="true"]');
    
    allActorSprites.forEach(spriteImg => {
      spriteImg.setAttribute('data-shiny', 'false');
    });
    
    console.log('[Mod Settings] Shiny enemies removed from', allActorSprites.length, 'sprites');
    
    // Stop the battle board observer
    stopBattleBoardObserver();
  } catch (error) {
    console.error('[Mod Settings] Error removing shiny enemies:', error);
  }
}

// =======================
// 10. Setup Labels Visibility Functions
// =======================

// Apply setup labels visibility
function applySetupLabelsVisibility(show) {
  const setupContainer = document.querySelector('.mb-2.flex.items-center.gap-2');
  if (setupContainer) {
    setupContainer.style.display = show ? '' : 'none';
    console.log('[Mod Settings] Setup labels container visibility:', show ? 'visible' : 'hidden');
  }
}

// Start observer for setup labels container
function startSetupLabelsObserver() {
  console.log('[Mod Settings] Starting setup labels observer');
  
  const observer = new MutationObserver(() => {
    // Reapply visibility whenever DOM changes
    const setupContainer = document.querySelector('.mb-2.flex.items-center.gap-2');
    if (setupContainer) {
      const shouldBeVisible = config.showSetupLabels;
      const currentlyVisible = setupContainer.style.display !== 'none';
      
      if (shouldBeVisible !== currentlyVisible) {
        applySetupLabelsVisibility(shouldBeVisible);
      }
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  return observer;
}

// =======================
// 11. Autoplay Session Checkbox Visibility
// =======================

const STOP_AFTER_DEFEAT_LABEL_MARKERS = [
  'stop after a defeat',
  'parar apos uma derrota',
  'parar depois de uma derrota',
];

const POWER_SAVING_MODE_LABEL_MARKERS = [
  'power saving mode',
  // Current pt-BR game string (not "modo de…")
  'economia de energia',
  'modo de economia de energia',
  'modo economia de energia',
  // Legacy rename (text-node approach); CSS ::after keeps the original game text in the DOM
  'persistent powersaver',
  'powersaver persistente',
];

const PERSIST_PS_IN_GAME_LABEL_ATTR = 'data-mod-settings-persist-ps-label';
const PERSIST_PS_IN_GAME_TITLE_ATTR = 'data-mod-settings-persist-ps-title';
const PERSIST_PS_IN_GAME_ORIG_TEXT_ATTR = 'data-mod-settings-persist-ps-orig-text';
const PERSIST_PS_PREF_CHECKBOX_ATTR = 'data-mod-settings-persist-ps-pref-checkbox';
const PERSIST_PS_IN_GAME_STYLE_ID = 'mod-settings-persist-ps-label-style';
/** Keeps React from restoring the game label text (which would re-open a wide flex gap). */
let persistPsLabelTextObserver = null;
let persistPsLabelTextObserved = null;

function labelTextMatchesMarkers(labelText, markers) {
  const normalized = normalizeForLabelMatch(labelText).replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return markers.some((marker) => normalized.includes(normalizeForLabelMatch(marker)));
}

function ensurePersistentPowersaverInGameLabelStyle() {
  let style = document.getElementById(PERSIST_PS_IN_GAME_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = PERSIST_PS_IN_GAME_STYLE_ID;
    document.head.appendChild(style);
  }
  // Title via ::after. Game text cleared in JS. Real game checkbox hidden; custom
  // preference checkbox shown. gap:0 + pref margin = one normal gap.
  style.textContent = `
label[${PERSIST_PS_IN_GAME_LABEL_ATTR}="true"] {
  gap: 0 !important;
  cursor: help;
  position: relative;
}
/* Real game checkbox sits under the custom one (real hit box for synthetic clicks). */
label[${PERSIST_PS_IN_GAME_LABEL_ATTR}="true"] > button[role="checkbox"]:not([${PERSIST_PS_PREF_CHECKBOX_ATTR}]) {
  position: absolute !important;
  left: 0 !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  width: 12px !important;
  height: 12px !important;
  margin: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
  z-index: 0 !important;
}
label[${PERSIST_PS_IN_GAME_LABEL_ATTR}="true"] > button[${PERSIST_PS_PREF_CHECKBOX_ATTR}="true"] {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  margin-right: 0.375rem;
  cursor: pointer;
  pointer-events: auto;
  position: relative;
  z-index: 1;
}
label[${PERSIST_PS_IN_GAME_LABEL_ATTR}="true"]::after {
  content: attr(${PERSIST_PS_IN_GAME_TITLE_ATTR});
  font-size: 16px;
  line-height: normal;
  color: #fff;
}
`;
}

function getNativePowerSavingModeLabelText() {
  const renamed = normalizeForLabelMatch(t('mods.betterUI.persistPowerSavingMode'));
  if (renamed.includes('powersaver persistente') || renamed.includes('persistente')) {
    return 'Economia de energia';
  }
  return 'Power saving mode';
}

function stopPersistentPowersaverLabelTextObserver() {
  if (persistPsLabelTextObserver) {
    try {
      persistPsLabelTextObserver.disconnect();
    } catch (_) { /* ignore */ }
    persistPsLabelTextObserver = null;
  }
  persistPsLabelTextObserved = null;
}

function isPersistentPowersaverInGameActive() {
  return !!config.persistPowerSavingMode && !config.hidePowerSavingMode;
}

function clearPersistPsLabelTextNodes(label, { saveOriginal = false } = {}) {
  if (!label) return;
  for (const child of label.childNodes) {
    if (child.nodeType !== Node.TEXT_NODE) continue;
    const raw = child.textContent || '';
    if (!raw.trim()) continue;
    if (saveOriginal && !label.getAttribute(PERSIST_PS_IN_GAME_ORIG_TEXT_ATTR)) {
      label.setAttribute(PERSIST_PS_IN_GAME_ORIG_TEXT_ATTR, raw);
    }
    child.textContent = '';
  }
}

/**
 * Empty the game’s trailing text node in place (same node — does not remount the checkbox).
 * React may restore the string; the observer clears it again so no flex-width gap returns.
 */
function suppressPersistentPowersaverGameLabelText(label) {
  if (!label) return;
  clearPersistPsLabelTextNodes(label, { saveOriginal: true });

  if (persistPsLabelTextObserved === label && persistPsLabelTextObserver) return;

  stopPersistentPowersaverLabelTextObserver();
  persistPsLabelTextObserved = label;
  persistPsLabelTextObserver = new MutationObserver(() => {
    if (!label.isConnected || label.getAttribute(PERSIST_PS_IN_GAME_LABEL_ATTR) !== 'true') {
      stopPersistentPowersaverLabelTextObserver();
      return;
    }
    clearPersistPsLabelTextNodes(label, { saveOriginal: true });
  });
  persistPsLabelTextObserver.observe(label, {
    characterData: true,
    childList: true,
    subtree: true,
  });
}

function restorePersistentPowersaverGameLabelText(label) {
  stopPersistentPowersaverLabelTextObserver();
  if (!label) return;
  removePersistPsPrefCheckbox(label);
  const original =
    label.getAttribute(PERSIST_PS_IN_GAME_ORIG_TEXT_ATTR) || getNativePowerSavingModeLabelText();
  let hasText = false;
  for (const child of label.childNodes) {
    if (child.nodeType !== Node.TEXT_NODE) continue;
    child.textContent = original;
    hasText = true;
    break;
  }
  if (!hasText) {
    const button = findGamePowerSavingModeCheckboxInLabel(label);
    const textNode = document.createTextNode(original);
    if (button) button.after(textNode);
    else label.appendChild(textNode);
  }
  label.removeAttribute(PERSIST_PS_IN_GAME_ORIG_TEXT_ATTR);
}

function findGamePowerSavingModeCheckboxInLabel(label) {
  if (!label) return null;
  for (const btn of label.querySelectorAll('button[role="checkbox"]')) {
    if (btn.getAttribute(PERSIST_PS_PREF_CHECKBOX_ATTR) === 'true') continue;
    return btn;
  }
  return null;
}

function removePersistPsPrefCheckbox(label) {
  if (!label) return;
  for (const btn of label.querySelectorAll(`[${PERSIST_PS_PREF_CHECKBOX_ATTR}="true"]`)) {
    btn.remove();
  }
}

function syncPersistPsPrefCheckboxUI(button) {
  if (!button) return;
  const checked = config.powerSavingModeEnabled === true;
  button.setAttribute('aria-checked', checked ? 'true' : 'false');
  button.dataset.state = checked ? 'checked' : 'unchecked';
  let mark = button.querySelector('[data-mod-settings-persist-ps-check-mark]');
  if (checked) {
    if (!mark) {
      mark = document.createElement('span');
      mark.dataset.modSettingsPersistPsCheckMark = 'true';
      mark.dataset.state = 'checked';
      mark.style.pointerEvents = 'none';
      mark.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check size-full stroke-3" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>';
      button.appendChild(mark);
    } else {
      mark.dataset.state = 'checked';
    }
  } else if (mark) {
    mark.remove();
  }
}

function togglePowerSavingModePreferenceFromInGame(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (!isPersistentPowersaverInGameActive()) return;

  config.powerSavingModeEnabled = !config.powerSavingModeEnabled;
  saveConfig();

  console.log('[Mod Settings] Power saving: preference checkbox', {
    checked: config.powerSavingModeEnabled === true,
  });

  const label = findPowerSavingModeCheckboxLabel();
  const prefBtn = label?.querySelector(`[${PERSIST_PS_PREF_CHECKBOX_ATTR}="true"]`);
  syncPersistPsPrefCheckboxUI(prefBtn);

  // Preference off → drop live Power saving immediately; on → re-apply session gating.
  if (!config.powerSavingModeEnabled) {
    clearPowerSavingOffDebounce();
    uncheckPowerSavingModeCheckboxPreservingPreference();
  }
  schedulePersistedPowerSavingModeRestore(0);
}

function ensurePersistPsPrefCheckbox(label) {
  if (!label) return null;
  let prefBtn = label.querySelector(`[${PERSIST_PS_PREF_CHECKBOX_ATTR}="true"]`);
  const gameBtn = findGamePowerSavingModeCheckboxInLabel(label);

  if (!prefBtn) {
    prefBtn = document.createElement('button');
    prefBtn.type = 'button';
    prefBtn.setAttribute('role', 'checkbox');
    prefBtn.setAttribute(PERSIST_PS_PREF_CHECKBOX_ATTR, 'true');
    prefBtn.value = 'on';
    prefBtn.className =
      gameBtn?.className ||
      'shrink-0 disabled:text-whiteDark/60 bg-grayRegular focus-style-visible frame-pressed-1 size-3 text-whiteRegular disabled:dithered-background disabled:cursor-not-allowed disabled:bg-grayBrightest';
    prefBtn.addEventListener('click', togglePowerSavingModePreferenceFromInGame);
    if (gameBtn) gameBtn.after(prefBtn);
    else label.insertBefore(prefBtn, label.firstChild);
  }

  if (label.dataset.modSettingsPersistPsLabelClickBound !== 'true') {
    label.dataset.modSettingsPersistPsLabelClickBound = 'true';
    // Title clicks toggle preference. Ignore any checkbox (real or custom) —
    // synthetic game-checkbox clicks must not flip powerSavingModeEnabled.
    label.addEventListener(
      'click',
      (e) => {
        if (label.getAttribute(PERSIST_PS_IN_GAME_LABEL_ATTR) !== 'true') return;
        if (powerSavingModeRestorePending) return;
        if (e.target.closest('button[role="checkbox"]')) return;
        togglePowerSavingModePreferenceFromInGame(e);
      },
      true
    );
  }

  syncPersistPsPrefCheckboxUI(prefBtn);
  return prefBtn;
}

function findPowerSavingModeCheckboxLabel() {
  for (const label of findAutoplaySessionCheckboxLabels()) {
    if (label.getAttribute(PERSIST_PS_IN_GAME_LABEL_ATTR) === 'true') return label;
    if (labelTextMatchesMarkers(label.textContent, POWER_SAVING_MODE_LABEL_MARKERS)) {
      return label;
    }
  }
  const byAttr = document.querySelector(`label[${PERSIST_PS_IN_GAME_LABEL_ATTR}="true"]`);
  if (byAttr) return byAttr;
  for (const label of document.querySelectorAll('label')) {
    if (!findGamePowerSavingModeCheckboxInLabel(label)) continue;
    if (labelTextMatchesMarkers(label.textContent, POWER_SAVING_MODE_LABEL_MARKERS)) {
      return label;
    }
  }
  return null;
}

/**
 * While Persistent Powersaver is on: white title, custom preference checkbox
 * (powerSavingModeEnabled), real game checkbox hidden but still session-driven.
 */
function applyPersistentPowersaverInGameLabel() {
  const label = findPowerSavingModeCheckboxLabel();
  if (!label) return;

  const shouldRename = isPersistentPowersaverInGameActive();
  if (!shouldRename) {
    if (label.hasAttribute(PERSIST_PS_IN_GAME_LABEL_ATTR)) {
      label.removeAttribute(PERSIST_PS_IN_GAME_LABEL_ATTR);
      label.removeAttribute(PERSIST_PS_IN_GAME_TITLE_ATTR);
      label.removeAttribute('title');
      label.style.removeProperty('color');
      label.style.removeProperty('cursor');
      restorePersistentPowersaverGameLabelText(label);
    } else {
      stopPersistentPowersaverLabelTextObserver();
      removePersistPsPrefCheckbox(label);
    }
    label.removeAttribute('data-mod-settings-persist-ps-orig-color');
    return;
  }

  ensurePersistentPowersaverInGameLabelStyle();
  const renamed = t('mods.betterUI.persistPowerSavingMode');
  const tooltip = t('mods.betterUI.persistPowerSavingModeInGameTooltip');
  if (label.getAttribute(PERSIST_PS_IN_GAME_TITLE_ATTR) !== renamed) {
    label.setAttribute(PERSIST_PS_IN_GAME_TITLE_ATTR, renamed);
  }
  if (label.getAttribute('title') !== tooltip) {
    label.setAttribute('title', tooltip);
  }
  if (label.getAttribute(PERSIST_PS_IN_GAME_LABEL_ATTR) !== 'true') {
    label.setAttribute(PERSIST_PS_IN_GAME_LABEL_ATTR, 'true');
  }
  suppressPersistentPowersaverGameLabelText(label);
  ensurePersistPsPrefCheckbox(label);
  label.removeAttribute('data-mod-settings-persist-ps-orig-color');
}

function findAutoplaySessionWidgetBottom() {
  const autoplaySessions = document.querySelectorAll('div[data-autosetup]');
  for (const session of autoplaySessions) {
    const widgetBottom = session.querySelector('.widget-bottom[data-minimized="false"]');
    if (widgetBottom) return widgetBottom;
  }

  const autoplayButtons = Array.from(document.querySelectorAll('button.widget-top, button.widget-top-text'));
  for (const button of autoplayButtons) {
    if (!button.querySelector('img[alt="Autoplay"]')) continue;
    const widgetBottom = button.parentElement?.querySelector('.widget-bottom[data-minimized="false"]');
    if (widgetBottom) return widgetBottom;
  }

  for (const widgetBottom of document.querySelectorAll('.widget-bottom[data-minimized="false"]')) {
    let parent = widgetBottom.parentElement;
    while (parent && parent !== document.body) {
      for (const btn of parent.querySelectorAll('button')) {
        if (btn.querySelector('img[alt="Autoplay"]')) {
          return widgetBottom;
        }
      }
      parent = parent.parentElement;
    }
  }

  return null;
}

function findAutoplaySessionCheckboxLabels() {
  const widgetBottom = findAutoplaySessionWidgetBottom();
  if (!widgetBottom) return [];

  const searchRoot = widgetBottom.parentElement || widgetBottom;
  return Array.from(searchRoot.querySelectorAll('label')).filter(
    (label) => label.querySelector('button[role="checkbox"]')
  );
}

function setSessionCheckboxLabelHidden(label, hidden, markerKey) {
  if (!label) return;
  const attr = `data-mod-settings-hidden-${markerKey}`;
  if (hidden) {
    label.style.display = 'none';
    label.setAttribute(attr, 'true');
    return;
  }
  if (label.getAttribute(attr) === 'true') {
    label.style.display = '';
    label.removeAttribute(attr);
  }
}

function findPowerSavingModeCheckboxButton() {
  const label = findPowerSavingModeCheckboxLabel();
  return findGamePowerSavingModeCheckboxInLabel(label);
}

function isPowerSavingModeCheckboxChecked(button) {
  if (!button) return false;
  return button.getAttribute('aria-checked') === 'true' || button.dataset.state === 'checked';
}

/**
 * Turn off the in-game Power saving mode checkbox if it is currently checked.
 */
function forceDisableGamePowerSavingMode() {
  const result = uncheckPowerSavingModeCheckboxPreservingPreference();
  if (result === 'missing') {
    setLivePowerSavingModeEnabled(false);
    return;
  }
  if (result === 'off') return;
  // Retry once if the first synthetic click did not take.
  setTimeout(() => {
    if (isPowerSavingModeCheckboxChecked(findPowerSavingModeCheckboxButton())) {
      uncheckPowerSavingModeCheckboxPreservingPreference();
    }
  }, 120);
}

/**
 * When Seamless autoplay is on, force Hide Stop after a defeat so the session
 * checkbox stays hidden (Automator owns defeat handling).
 */
function enforceHideStopAfterDefeatForSeamlessAutoplay() {
  if (!isAutomatorSeamlessAutoplayEnabled()) return false;
  if (config.hideStopAfterDefeat) return false;
  config.hideStopAfterDefeat = true;
  saveConfig();
  applyAutoplaySessionCheckboxVisibility();
  console.log('[Mod Settings] Seamless autoplay on — enabled Hide Stop after a defeat');
  return true;
}

function updateHideStopAfterDefeatCheckboxState(checkboxEl = null) {
  const checkbox = checkboxEl || document.querySelector('#hide-stop-after-defeat-toggle');
  applyExclusiveCheckboxLock(checkbox, {
    locked: isAutomatorSeamlessAutoplayEnabled(),
    lockedChecked: true,
    unlockedChecked: !!config.hideStopAfterDefeat,
    lockMessage: t('mods.betterUI.hideStopAfterDefeatSeamlessLock'),
  });
}

function updatePersistPowerSavingModeCheckboxState(checkboxEl = null) {
  const checkbox = checkboxEl || document.querySelector('#persist-power-saving-mode-toggle');
  const baseWarning = t('mods.betterUI.persistPowerSavingModeWarning');
  const lockMessage = t('mods.betterUI.persistPowerSavingModeHideLock');
  applyExclusiveCheckboxLock(checkbox, {
    locked: !!config.hidePowerSavingMode,
    lockedChecked: false,
    unlockedChecked: !!config.persistPowerSavingMode,
    lockMessage,
    unlockedTitle: baseWarning,
  });
}

/**
 * Used when enabling Hide Power saving mode: hide the checkbox, force Power saving off,
 * and wipe Persistent Powersaver + its saved on/off state.
 */
function disableAndWipePowerSavingMode() {
  config.persistPowerSavingMode = false;
  config.powerSavingModeEnabled = false;
  saveConfig();

  // Clear persist before clicking off so restore logic cannot turn it back on.
  forceDisableGamePowerSavingMode();
  applyAutoplaySessionCheckboxVisibility();
  updatePersistPowerSavingModeCheckboxState();
  console.log('[Mod Settings] Hide Power saving mode: disabled Power saving and wiped Persistent Powersaver config');
}

let powerSavingModeRestorePending = false;
let powerSavingRestoreDebounceTimer = null;
let powerSavingStateObserver = null;
let powerSavingObservedButton = null;
let livePowerSavingModeEnabled = false;
let powerSavingOverlaysSuppressed = false;
let powerSavingOverlayRestoreObserver = null;
let powerSavingOverlayRestoreTimer = null;
let powerSavingSessionUnsubscribe = null;
let lastPowerSavingSessionActive = null;
let powerSavingTrackedRoomId = null;
/** After a map switch, force Power saving off until a new fight. */
let powerSavingSuspendedAfterMapChange = false;
let powerSavingSuspendSeenIdle = false;
let powerSavingLastGameStarted = null;
let powerSavingLastResumeVisible = false;
let powerSavingMapChangeOffTimers = [];
/**
 * When we leave an active fight, wait this long before turning Power saving off.
 * If a new fight starts in time, cancel — never force ON/OFF mid-window (stops flicker).
 * Duration = Automator fasterAutoplayMs + 1s (covers the between-fight gap).
 */
let powerSavingOffDebounceTimer = null;
const POWER_SAVING_OFF_DEBOUNCE_EXTRA_MS = 1000;
const POWER_SAVING_FASTER_AUTOPLAY_MS_DEFAULT = 100;
const POWER_SAVING_FASTER_AUTOPLAY_MS_MIN = 10;
const POWER_SAVING_FASTER_AUTOPLAY_MS_MAX = 180000;
/** Re-arms while waiting between fights (defeat gaps); caps so pause can't loop forever. */
let powerSavingGapHoldCount = 0;
const POWER_SAVING_GAP_HOLD_MAX = 3;

function getPowerSavingOffDebounceMs() {
  const raw = Number(getAutomatorConfigFromStorage().fasterAutoplayMs);
  const fasterMs = Number.isFinite(raw)
    ? Math.max(
        POWER_SAVING_FASTER_AUTOPLAY_MS_MIN,
        Math.min(POWER_SAVING_FASTER_AUTOPLAY_MS_MAX, raw)
      )
    : POWER_SAVING_FASTER_AUTOPLAY_MS_DEFAULT;
  return fasterMs + POWER_SAVING_OFF_DEBOUNCE_EXTRA_MS;
}

/**
 * Autoplay control row: [Start|Pause|Resume] + Autoplay menu (or pause in slot 1).
 * Scoped like Better Tasker / Hunt Analyzer — never scan the whole page for "Start".
 */
function findAutoplayControlRowForPowerSaving() {
  for (const flexContainer of document.querySelectorAll('div.flex')) {
    const buttons = flexContainer.querySelectorAll('button');
    if (buttons.length < 2) continue;
    const second = buttons[1];
    if (second.querySelector('img[alt="Autoplay"], img[src*="autoplay.png"]')) {
      return { primary: buttons[0], secondary: second };
    }
    if (second.querySelector('svg.lucide-pause')) {
      return { primary: buttons[0], secondary: second, pauseInSecondary: true };
    }
  }
  return null;
}

function getAutoplayPrimaryButtonTextForPowerSaving() {
  const row = findAutoplayControlRowForPowerSaving();
  return (row?.primary?.textContent || '').trim();
}

function normalizeAutoplayControlLabel(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isAutoplayPauseButtonVisibleForPowerSaving() {
  const row = findAutoplayControlRowForPowerSaving();
  if (!row) return false;
  if (row.pauseInSecondary) return true;
  return !!row.primary?.querySelector('svg.lucide-pause');
}

/** True when autoplay row shows Resume/Retomar (session paused, not running). */
function isAutoplayPausedInDomForPowerSaving() {
  const row = findAutoplayControlRowForPowerSaving();
  if (!row) return false;
  if (isAutoplayPauseButtonVisibleForPowerSaving()) return false;
  const text = normalizeAutoplayControlLabel(row.primary?.textContent);
  return (
    text === 'resume' ||
    text === 'retomar' ||
    text.includes('resume') ||
    text.includes('retomar')
  );
}

/** True only when the autoplay row itself shows Start/Iniciar (session fully stopped). */
function isAutoplayFullyStoppedInDomForPowerSaving() {
  const row = findAutoplayControlRowForPowerSaving();
  if (!row) return false;
  if (isAutoplayPauseButtonVisibleForPowerSaving()) return false;
  if (isAutoplayPausedInDomForPowerSaving()) return false;
  const text = normalizeAutoplayControlLabel(row.primary?.textContent);
  return (
    text === 'start' ||
    text === 'iniciar' ||
    text.includes('start') ||
    text.includes('iniciar')
  );
}

function getPowerSavingBoardRoomId(ctx) {
  const roomId = ctx?.selectedMap?.selectedRoom?.id;
  return typeof roomId === 'string' && roomId.length > 0 ? roomId : null;
}

/** Force the live checkbox off after a map switch; retry while the session widget remounts. */
function clearPowerSavingMapChangeOffRetries() {
  for (const id of powerSavingMapChangeOffTimers) {
    try {
      clearTimeout(id);
    } catch (_) { /* ignore */ }
  }
  powerSavingMapChangeOffTimers = [];
}

/**
 * Uncheck the in-game Power saving checkbox without touching saved preference.
 * Uses full pointer/mouse events (plain click() is often ignored while the goblin screen is up).
 * @returns {'off'|'on'|'missing'}
 */
function uncheckPowerSavingModeCheckboxPreservingPreference() {
  const button = findPowerSavingModeCheckboxButton();
  if (!button) return 'missing';
  if (!isPowerSavingModeCheckboxChecked(button)) {
    setLivePowerSavingModeEnabled(false);
    return 'off';
  }

  clickPowerSavingModeCheckbox(button, () => {
    const stillOn = isPowerSavingModeCheckboxChecked(button);
    setLivePowerSavingModeEnabled(stillOn);
  });
  return 'on';
}

/**
 * Synthetic activate for the (visually hidden) game Power saving checkbox.
 * Single activation only (dispatch+click() would toggle twice → stuck off).
 * Label preference handler ignores checkbox targets / restorePending.
 */
function clickPowerSavingModeCheckbox(button, afterMs = null) {
  if (!button) return;
  powerSavingModeRestorePending = true;
  // Real 12×12 under the custom checkbox — briefly enable hit-testing for Radix.
  button.style.setProperty('pointer-events', 'auto', 'important');
  button.style.setProperty('opacity', '0.01', 'important');
  try {
    const pointerPayload = { bubbles: true, cancelable: true, composed: true };
    const mousePayload = { bubbles: true, cancelable: true, composed: true, button: 0 };
    try {
      button.focus?.({ preventScroll: true });
    } catch (_) { /* ignore */ }
    button.dispatchEvent(new PointerEvent('pointerdown', pointerPayload));
    button.dispatchEvent(new MouseEvent('mousedown', mousePayload));
    button.dispatchEvent(new PointerEvent('pointerup', { ...pointerPayload, buttons: 0 }));
    button.dispatchEvent(new MouseEvent('mouseup', { ...mousePayload, buttons: 0 }));
    // One click only — a second click() would immediately undo the toggle.
    button.dispatchEvent(new MouseEvent('click', { ...mousePayload, buttons: 0 }));
  } finally {
    setTimeout(() => {
      powerSavingModeRestorePending = false;
      button.style.removeProperty('pointer-events');
      button.style.removeProperty('opacity');
      if (typeof afterMs === 'function') afterMs();
    }, 100);
  }
}

function queuePowerSavingOffAfterMapChange() {
  if (!config.persistPowerSavingMode) return;
  clearPowerSavingOffDebounce();
  clearPowerSavingMapChangeOffRetries();

  let attempts = 0;
  const maxAttempts = 15;

  const attempt = () => {
    attempts += 1;
    const result = uncheckPowerSavingModeCheckboxPreservingPreference();
    const goblinUp = !!document.getElementById('autoplay-goblin');
    // missing + no goblin = already off / widget gone — treat as success
    const done = (result === 'off' || result === 'missing') && !goblinUp;

    if (done || attempts >= maxAttempts) {
      if (!done && attempts >= maxAttempts) {
        console.warn(
          '[Mod Settings] Map change: could not uncheck Power saving mode after retries',
          { result, goblinUp }
        );
      }
      return;
    }

    const id = setTimeout(() => {
      powerSavingMapChangeOffTimers = powerSavingMapChangeOffTimers.filter((t) => t !== id);
      attempt();
    }, 200);
    powerSavingMapChangeOffTimers.push(id);
  };

  attempt();
}

/**
 * Map switches should drop live Power saving immediately (preference unchanged).
 * Stays off until we've seen gameStarted clear, then a new battle — or fully stopped.
 */
function syncPowerSavingTrackedRoom(ctx) {
  const roomId = getPowerSavingBoardRoomId(ctx);
  if (!roomId) return false;
  if (!powerSavingTrackedRoomId) {
    powerSavingTrackedRoomId = roomId;
    return false;
  }
  if (roomId === powerSavingTrackedRoomId) return false;

  powerSavingTrackedRoomId = roomId;
  powerSavingSuspendedAfterMapChange = true;
  powerSavingSuspendSeenIdle = ctx?.gameStarted !== true;
  clearPowerSavingOffDebounce();
  lastPowerSavingSessionActive = false;
  queuePowerSavingOffAfterMapChange();
  return true;
}

/**
 * True only while a fight is actually running (not between fights, not paused).
 * Between-fight / pause gaps use OFF debounce instead of faking "still active".
 * @see docs/game_state_api.md board context (gameStarted, mode)
 */
function isPowerSavingActiveSession() {
  try {
    const ctx = globalThis.state?.board?.getSnapshot?.().context;
    if (!ctx) return false;
    syncPowerSavingTrackedRoom(ctx);

    const mode = typeof ctx.mode === 'string' ? ctx.mode.toLowerCase() : '';
    const gameStarted = ctx.gameStarted === true;
    if (powerSavingLastGameStarted === null) {
      powerSavingLastGameStarted = gameStarted;
    } else if (gameStarted !== powerSavingLastGameStarted) {
      console.log(
        gameStarted
          ? '[Mod Settings] Power saving: battle started'
          : '[Mod Settings] Power saving: battle stopped',
        { mode: ctx.mode }
      );
      powerSavingLastGameStarted = gameStarted;
    }

    if (powerSavingSuspendedAfterMapChange) {
      if (!gameStarted) {
        powerSavingSuspendSeenIdle = true;
      }
      if (isAutoplayFullyStoppedInDomForPowerSaving()) {
        powerSavingSuspendedAfterMapChange = false;
        powerSavingSuspendSeenIdle = false;
        return false;
      }
      if (powerSavingSuspendSeenIdle && gameStarted) {
        powerSavingSuspendedAfterMapChange = false;
        powerSavingSuspendSeenIdle = false;
      } else {
        return false;
      }
    }

    if (mode === 'autoplay') {
      const resumeVisible = isAutoplayPausedInDomForPowerSaving();
      if (resumeVisible && !powerSavingLastResumeVisible) {
        console.log('[Mod Settings] Power saving: autoplay paused (Resume visible)', {
          button: getAutoplayPrimaryButtonTextForPowerSaving(),
          gameStarted,
        });
      } else if (!resumeVisible && powerSavingLastResumeVisible) {
        console.log('[Mod Settings] Power saving: autoplay unpaused (Resume gone)', {
          button: getAutoplayPrimaryButtonTextForPowerSaving(),
        });
      }
      powerSavingLastResumeVisible = resumeVisible;

      // Paused or fully stopped → not an active fight (OFF debounce decides later).
      if (resumeVisible || isAutoplayFullyStoppedInDomForPowerSaving()) {
        return false;
      }
      return gameStarted;
    }

    powerSavingLastResumeVisible = false;
    return gameStarted;
  } catch (_) {
    return false;
  }
}

/**
 * Preference (`powerSavingModeEnabled`) stays saved while Persistent Powersaver is on;
 * the live game checkbox only targets ON during an active fight.
 * While OFF debounce is pending we do not sync at all (see restorePersistedPowerSavingMode).
 */
function getEffectivePowerSavingModeDesired() {
  if (!config.persistPowerSavingMode) return false;
  if (!config.powerSavingModeEnabled) return false;
  if (powerSavingSuspendedAfterMapChange) return false;
  return isPowerSavingActiveSession();
}

function unsubscribePowerSavingHandle(sub) {
  if (!sub) return;
  try {
    if (typeof sub === 'function') sub();
    else if (typeof sub.unsubscribe === 'function') sub.unsubscribe();
  } catch (_) { /* ignore */ }
}

function clearPowerSavingOffDebounce() {
  if (powerSavingOffDebounceTimer) {
    clearTimeout(powerSavingOffDebounceTimer);
    powerSavingOffDebounceTimer = null;
  }
  powerSavingGapHoldCount = 0;
}

function isPowerSavingOffDebouncePending() {
  return powerSavingOffDebounceTimer != null;
}

/**
 * Autoplay still mid-session (not Start, not Resume). Defeat gaps often hide Pause
 * briefly, so we do not require it — gapHold cap limits how long we wait.
 */
function shouldHoldPowerSavingThroughAutoplayGap() {
  try {
    const ctx = globalThis.state?.board?.getSnapshot?.().context;
    const mode = typeof ctx?.mode === 'string' ? ctx.mode.toLowerCase() : '';
    if (mode !== 'autoplay') return false;
    if (isAutoplayPausedInDomForPowerSaving()) return false;
    if (isAutoplayFullyStoppedInDomForPowerSaving()) return false;
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Keep the game Power saving checkbox ON through a defeat/between-fight gap.
 * Overlay hold alone is not enough — when the game unchecks, the goblin screen drops
 * and the battlefield flashes even if Highscores stay suppressed.
 */
function ensurePowerSavingCheckboxOnDuringGap() {
  if (!config.persistPowerSavingMode || !config.powerSavingModeEnabled) return;
  if (powerSavingModeRestorePending) return;
  const button = findPowerSavingModeCheckboxButton();
  if (!button) return;
  if (isPowerSavingModeCheckboxChecked(button)) {
    setLivePowerSavingModeEnabled(true);
    return;
  }
  console.log('[Mod Settings] Power saving: re-assert ON during gap (goblin dropped)');
  clickPowerSavingModeCheckbox(button, () => {
    setLivePowerSavingModeEnabled(true);
  });
}

/**
 * After leaving a fight: wait, then decide.
 * Keep goblin/checkbox ON through the gap (game often unchecks on defeat).
 * Overlays stay suppressed until we decide to disable.
 */
function schedulePowerSavingOffDebounce() {
  if (powerSavingOffDebounceTimer) return;
  if (config.powerSavingModeEnabled) {
    setLivePowerSavingModeEnabled(true);
    ensurePowerSavingCheckboxOnDuringGap();
  }
  const debounceMs = getPowerSavingOffDebounceMs();
  console.log('[Mod Settings] Power saving: OFF debounce armed', {
    ms: debounceMs,
    fasterAutoplayMs: debounceMs - POWER_SAVING_OFF_DEBOUNCE_EXTRA_MS,
    gapHold: powerSavingGapHoldCount,
  });
  powerSavingOffDebounceTimer = setTimeout(() => {
    powerSavingOffDebounceTimer = null;
    if (!config.persistPowerSavingMode) return;
    if (isPowerSavingActiveSession()) {
      lastPowerSavingSessionActive = true;
      powerSavingGapHoldCount = 0;
      console.log('[Mod Settings] Power saving: OFF debounce ended — fight active, keeping/enabling');
      schedulePersistedPowerSavingModeRestore(0);
      return;
    }
    // Defeat gap: keep holding a few times (Pause often missing). Cap at 3 (~4s total after first wait).
    if (config.powerSavingModeEnabled && shouldHoldPowerSavingThroughAutoplayGap()) {
      powerSavingGapHoldCount += 1;
      if (powerSavingGapHoldCount <= POWER_SAVING_GAP_HOLD_MAX) {
        console.log('[Mod Settings] Power saving: OFF debounce ended — autoplay gap, holding', {
          gapHold: powerSavingGapHoldCount,
          max: POWER_SAVING_GAP_HOLD_MAX,
        });
        setLivePowerSavingModeEnabled(true);
        ensurePowerSavingCheckboxOnDuringGap();
        schedulePowerSavingOffDebounce();
        return;
      }
      console.log('[Mod Settings] Power saving: OFF debounce ended — gap hold cap, disabling', {
        gapHold: powerSavingGapHoldCount,
      });
    }
    powerSavingGapHoldCount = 0;
    lastPowerSavingSessionActive = false;
    console.log('[Mod Settings] Power saving: OFF debounce ended — disabling');
    uncheckPowerSavingModeCheckboxPreservingPreference();
    setLivePowerSavingModeEnabled(false);
  }, debounceMs);
}

function stopPowerSavingSessionListener() {
  clearPowerSavingOffDebounce();
  clearPowerSavingMapChangeOffRetries();
  if (powerSavingSessionUnsubscribe) {
    try {
      powerSavingSessionUnsubscribe();
    } catch (_) { /* ignore */ }
    powerSavingSessionUnsubscribe = null;
  }
  lastPowerSavingSessionActive = null;
  powerSavingTrackedRoomId = null;
  powerSavingSuspendedAfterMapChange = false;
  powerSavingSuspendSeenIdle = false;
  powerSavingLastGameStarted = null;
  powerSavingLastResumeVisible = false;
}

function ensurePowerSavingSessionListener() {
  if (powerSavingSessionUnsubscribe) return;
  const board = globalThis.state?.board;
  if (!board) return;

  const onSessionMaybeChanged = () => {
    if (!config.persistPowerSavingMode) return;

    try {
      const ctx = board.getSnapshot?.().context;
      // syncPowerSavingTrackedRoom queues OFF retries itself when the room changes.
      if (syncPowerSavingTrackedRoom(ctx)) {
        console.log('[Mod Settings] Power saving: map changed — forcing off');
        return;
      }
    } catch (_) { /* ignore */ }

    const active = isPowerSavingActiveSession();

    if (active) {
      // Fight running: cancel pending OFF and apply ON immediately.
      clearPowerSavingOffDebounce();
      if (lastPowerSavingSessionActive === true) return;
      lastPowerSavingSessionActive = true;
      console.log('[Mod Settings] Power saving: enabling (session active)');
      schedulePersistedPowerSavingModeRestore(50);
      return;
    }

    // Not in a fight: arm OFF debounce once, then leave the checkbox alone until it fires.
    if (lastPowerSavingSessionActive === true || isPowerSavingOffDebouncePending()) {
      if (lastPowerSavingSessionActive === true) {
        lastPowerSavingSessionActive = false;
      }
      // Hold overlays through the gap (defeat often unchecks the game box immediately).
      if (config.powerSavingModeEnabled) {
        setLivePowerSavingModeEnabled(true);
      }
      schedulePowerSavingOffDebounce();
      return;
    }

    // Already idle with no pending debounce — nothing to do.
  };

  const subs = [];
  try {
    if (typeof board.subscribe === 'function') {
      const sub = board.subscribe(onSessionMaybeChanged);
      if (sub) subs.push(sub);
    }
  } catch (_) { /* ignore */ }

  if (typeof board.on === 'function') {
    for (const evt of ['emitNewGame', 'emitEndGame', 'setPlayMode', 'newGame', 'selectRoomById']) {
      try {
        const sub = board.on(evt, () => {
          onSessionMaybeChanged();
        });
        if (sub) subs.push(sub);
      } catch (_) { /* ignore */ }
    }
  }

  if (!subs.length) return;

  powerSavingSessionUnsubscribe = () => {
    for (const sub of subs) unsubscribePowerSavingHandle(sub);
  };
  try {
    syncPowerSavingTrackedRoom(board.getSnapshot?.().context);
  } catch (_) { /* ignore */ }
  lastPowerSavingSessionActive = isPowerSavingActiveSession();
}

function getLivePowerSavingModeEnabled() {
  return livePowerSavingModeEnabled === true;
}

function isPowerSavingAutoplayScreenActive() {
  return !!document.getElementById('autoplay-goblin');
}

function isNormalBattlefieldReady() {
  // Power saving replaces the board with the goblin screen — #tiles only exists on the real battlefield
  return !isPowerSavingAutoplayScreenActive() && !!document.getElementById('tiles');
}

function cancelPendingPowerSavingOverlayRestore() {
  if (powerSavingOverlayRestoreObserver) {
    try {
      powerSavingOverlayRestoreObserver.disconnect();
    } catch (_) {}
    powerSavingOverlayRestoreObserver = null;
  }
  if (powerSavingOverlayRestoreTimer) {
    clearTimeout(powerSavingOverlayRestoreTimer);
    powerSavingOverlayRestoreTimer = null;
  }
}

function dispatchPowerSavingModeChanged(enabled) {
  try {
    window.dispatchEvent(
      new CustomEvent('ba-power-saving-mode-changed', {
        detail: { enabled: enabled === true },
      })
    );
  } catch (error) {
    console.warn('[Mod Settings] Failed to dispatch power saving event:', error);
  }
  if (window.ModCoordination && typeof window.ModCoordination.emit === 'function') {
    try {
      window.ModCoordination.emit('powerSavingModeChanged', { enabled: enabled === true });
    } catch (_) {}
  }
}

/** Apply overlay suppress/restore + notify mods. `suppressed=true` means hide battle overlays. */
function setPowerSavingOverlaysSuppressed(suppressed) {
  const next = suppressed === true;
  if (powerSavingOverlaysSuppressed === next) {
    return;
  }
  powerSavingOverlaysSuppressed = next;
  applyPowerSavingBattleOverlayVisibility(next);
  dispatchPowerSavingModeChanged(next);
}

function schedulePowerSavingOverlayRestoreWhenBattlefieldReady() {
  cancelPendingPowerSavingOverlayRestore();

  if (isNormalBattlefieldReady()) {
    setPowerSavingOverlaysSuppressed(false);
    return;
  }

  // Keep overlays suppressed while the "Autoplaying..." goblin screen is still up
  // ("will resume after this battle"), or until #tiles is back on the real board.
  console.log('[Mod Settings] Power saving off — waiting for battlefield before restoring overlays');

  const watchRoot = document.getElementById('viewport') || document.body;
  powerSavingOverlayRestoreObserver = new MutationObserver(() => {
    if (livePowerSavingModeEnabled) {
      cancelPendingPowerSavingOverlayRestore();
      return;
    }
    if (!isNormalBattlefieldReady()) {
      return;
    }
    cancelPendingPowerSavingOverlayRestore();
    // Brief settle so the normal board can mount before Custom Display re-applies
    powerSavingOverlayRestoreTimer = setTimeout(() => {
      powerSavingOverlayRestoreTimer = null;
      if (livePowerSavingModeEnabled) return;
      if (!isNormalBattlefieldReady()) {
        schedulePowerSavingOverlayRestoreWhenBattlefieldReady();
        return;
      }
      console.log('[Mod Settings] Battlefield restored — re-enabling power-saving-suppressed overlays');
      setPowerSavingOverlaysSuppressed(false);
    }, 200);
  });
  powerSavingOverlayRestoreObserver.observe(watchRoot, {
    childList: true,
    subtree: true,
  });
}

function setLivePowerSavingModeEnabled(enabled, { force = false } = {}) {
  const next = enabled === true;
  if (!force && livePowerSavingModeEnabled === next) {
    return;
  }
  livePowerSavingModeEnabled = next;

  if (next) {
    cancelPendingPowerSavingOverlayRestore();
    setPowerSavingOverlaysSuppressed(true);
    return;
  }

  // Unchecking: defer restore until #autoplay-goblin / Autoplaying screen is gone
  schedulePowerSavingOverlayRestoreWhenBattlefieldReady();
}

function applyPowerSavingBattleOverlayVisibility(enabled) {
  // Better Highscores leaderboard overlay
  try {
    if (typeof window.BetterHighscores?.setPowerSavingSuppressed === 'function') {
      window.BetterHighscores.setPowerSavingSuppressed(enabled);
    } else {
      document
        .querySelectorAll('.better-highscores-container, .better-highscores-restore-btn')
        .forEach((el) => {
          if (enabled) {
            if (el.dataset.powerSavingPrevDisplay == null) {
              el.dataset.powerSavingPrevDisplay = el.style.display || '';
            }
            el.style.display = 'none';
          } else if (el.dataset.powerSavingPrevDisplay != null) {
            el.style.display = el.dataset.powerSavingPrevDisplay;
            delete el.dataset.powerSavingPrevDisplay;
          }
        });
    }
  } catch (error) {
    console.warn('[Mod Settings] Error toggling Better Highscores for power saving:', error);
  }

  // Setup Manager map shortcuts overlay
  try {
    const setupContext =
      window.modLoader?.getModContext?.('setup-manager') ||
      window.modLoader?.getModContext?.('Setup Manager');
    const setupExports = setupContext?.exports;
    if (typeof setupExports?.setPowerSavingSuppressed === 'function') {
      setupExports.setPowerSavingSuppressed(enabled);
    } else {
      document.querySelectorAll('.setup-manager-map-shortcuts, .setup-manager-map-shortcut-preview').forEach((el) => {
        if (enabled) {
          if (el.dataset.powerSavingPrevDisplay == null) {
            el.dataset.powerSavingPrevDisplay = el.style.display || '';
          }
          el.style.display = 'none';
        } else if (el.dataset.powerSavingPrevDisplay != null) {
          el.style.display = el.dataset.powerSavingPrevDisplay;
          delete el.dataset.powerSavingPrevDisplay;
        }
      });
    }
  } catch (error) {
    console.warn('[Mod Settings] Error toggling Setup Manager shortcuts for power saving:', error);
  }

  // Custom Display performance/grid overlays
  try {
    const customDisplayContext =
      window.modLoader?.getModContext?.('custom-display') ||
      window.modLoader?.getModContext?.('Custom Display');
    const customDisplayExports = customDisplayContext?.exports;
    if (typeof customDisplayExports?.setPowerSavingSuppressed === 'function') {
      customDisplayExports.setPowerSavingSuppressed(enabled);
    } else {
      document
        .querySelectorAll(
          '#custom-display-hitbox-overlay, #custom-display-grid-overlay, #custom-display-perf-styles, .custom-display-tile-overlay'
        )
        .forEach((el) => {
          if (enabled) {
            if (el.tagName === 'STYLE') {
              el.remove();
              return;
            }
            if (el.dataset.powerSavingPrevDisplay == null) {
              el.dataset.powerSavingPrevDisplay = el.style.display || '';
            }
            el.style.display = 'none';
          } else if (el.dataset.powerSavingPrevDisplay != null) {
            el.style.display = el.dataset.powerSavingPrevDisplay;
            delete el.dataset.powerSavingPrevDisplay;
          }
        });
    }
  } catch (error) {
    console.warn('[Mod Settings] Error toggling Custom Display for power saving:', error);
  }
}

let missingPowerSavingButtonSince = null;

function syncLivePowerSavingModeFromDom() {
  // During OFF debounce, ignore DOM (defeat often unchecks; overlays must stay held).
  if (isPowerSavingOffDebouncePending()) return;

  const button = findPowerSavingModeCheckboxButton();
  if (!button) {
    // Goblin screen still up means Power saving is still on — don't fake "off" on remount.
    if (document.getElementById('autoplay-goblin')) {
      missingPowerSavingButtonSince = null;
      if (!livePowerSavingModeEnabled) {
        setLivePowerSavingModeEnabled(true);
      }
      return;
    }
    // Session widget may briefly remount — only clear after it's gone for a bit.
    if (!livePowerSavingModeEnabled) {
      missingPowerSavingButtonSince = null;
      return;
    }
    if (!missingPowerSavingButtonSince) {
      missingPowerSavingButtonSince = Date.now();
      return;
    }
    if (Date.now() - missingPowerSavingButtonSince < 500) return;
    missingPowerSavingButtonSince = null;
    setLivePowerSavingModeEnabled(false);
    return;
  }
  missingPowerSavingButtonSince = null;
  setLivePowerSavingModeEnabled(isPowerSavingModeCheckboxChecked(button));
}

window.baPowerSavingMode = {
  isEnabled: getLivePowerSavingModeEnabled,
  areOverlaysSuppressed: () => powerSavingOverlaysSuppressed === true,
  setEnabled: setLivePowerSavingModeEnabled,
};

function schedulePowerSavingMismatchRetry(button, delayMs = 150) {
  setTimeout(() => {
    if (!config.persistPowerSavingMode) return;
    if (isPowerSavingOffDebouncePending()) return;
    if (!button?.isConnected) return;
    if (isPowerSavingModeCheckboxChecked(button) === getEffectivePowerSavingModeDesired()) return;
    schedulePersistedPowerSavingModeRestore(delayMs);
  }, delayMs);
}

function restorePersistedPowerSavingMode() {
  if (!config.persistPowerSavingMode) return;
  // During OFF debounce: leave the live checkbox alone — decide only when the timer fires.
  if (isPowerSavingOffDebouncePending()) return;

  const button = findPowerSavingModeCheckboxButton();
  if (!button) {
    if (powerSavingSuspendedAfterMapChange && config.powerSavingModeEnabled) {
      schedulePersistedPowerSavingModeRestore(200);
    }
    return;
  }

  ensurePowerSavingModePersistListener();
  ensurePowerSavingSessionListener();

  const desired = getEffectivePowerSavingModeDesired();
  const checked = isPowerSavingModeCheckboxChecked(button);
  if (checked === desired) return;

  console.log('[Mod Settings] Power saving: sync checkbox', {
    desired,
    checked,
    goblinUp: !!document.getElementById('autoplay-goblin'),
  });

  if (!desired) {
    // Preference off or map switch: force OFF now. Otherwise debounce, then decide.
    if (!config.powerSavingModeEnabled || powerSavingSuspendedAfterMapChange) {
      uncheckPowerSavingModeCheckboxPreservingPreference();
      schedulePowerSavingMismatchRetry(button, 150);
      return;
    }
    schedulePowerSavingOffDebounce();
    return;
  }

  clickPowerSavingModeCheckbox(button, () => {
    setLivePowerSavingModeEnabled(isPowerSavingModeCheckboxChecked(button));
    schedulePowerSavingMismatchRetry(button, 150);
  });
}

function schedulePersistedPowerSavingModeRestore(delayMs = 75) {
  if (powerSavingRestoreDebounceTimer) {
    clearTimeout(powerSavingRestoreDebounceTimer);
  }
  powerSavingRestoreDebounceTimer = setTimeout(() => {
    powerSavingRestoreDebounceTimer = null;
    restorePersistedPowerSavingMode();
  }, delayMs);
}

function ensurePowerSavingModePersistListener() {
  const button = findPowerSavingModeCheckboxButton();
  if (!button) return;

  if (button.dataset.modSettingsPowerSavingPersistBound !== 'true') {
    button.dataset.modSettingsPowerSavingPersistBound = 'true';
    button.addEventListener('click', () => {
      if (powerSavingModeRestorePending) return;
      // Live checkbox is session-gated; preference is controlled by the custom checkbox.
      setLivePowerSavingModeEnabled(isPowerSavingModeCheckboxChecked(button));
    });
  }

  if (powerSavingObservedButton !== button) {
    if (powerSavingStateObserver) {
      powerSavingStateObserver.disconnect();
      powerSavingStateObserver = null;
    }
    powerSavingObservedButton = button;
    powerSavingStateObserver = new MutationObserver(() => {
      if (powerSavingModeRestorePending) return;
      // Defeat / end-of-fight: game often unchecks Power saving. Keep goblin ON while
      // OFF debounce is pending; don't restore battlefield overlays mid-gap.
      if (isPowerSavingOffDebouncePending()) {
        if (config.powerSavingModeEnabled) {
          ensurePowerSavingCheckboxOnDuringGap();
        }
        return;
      }

      const checked = isPowerSavingModeCheckboxChecked(button);

      // Observer can fire before board session events on defeat — hold overlays and
      // arm OFF debounce instead of flashing the battlefield.
      if (
        !checked &&
        config.persistPowerSavingMode &&
        config.powerSavingModeEnabled &&
        livePowerSavingModeEnabled &&
        !isPowerSavingActiveSession()
      ) {
        lastPowerSavingSessionActive = false;
        setLivePowerSavingModeEnabled(true);
        ensurePowerSavingCheckboxOnDuringGap();
        schedulePowerSavingOffDebounce();
        return;
      }

      setLivePowerSavingModeEnabled(checked);
      // Game remounted/reset the checkbox — re-apply session-gated persisted state.
      if (
        config.persistPowerSavingMode &&
        checked !== getEffectivePowerSavingModeDesired()
      ) {
        schedulePersistedPowerSavingModeRestore(50);
      }
    });
    powerSavingStateObserver.observe(button, {
      attributes: true,
      attributeFilter: ['aria-checked', 'data-state'],
    });
  }
}

function applyAutoplaySessionCheckboxVisibility() {
  for (const label of findAutoplaySessionCheckboxLabels()) {
    if (labelTextMatchesMarkers(label.textContent, STOP_AFTER_DEFEAT_LABEL_MARKERS)) {
      setSessionCheckboxLabelHidden(label, !!config.hideStopAfterDefeat, 'stopAfterDefeat');
      continue;
    }

    if (labelTextMatchesMarkers(label.textContent, POWER_SAVING_MODE_LABEL_MARKERS)) {
      setSessionCheckboxLabelHidden(label, !!config.hidePowerSavingMode, 'powerSavingMode');
    }
  }
  applyPersistentPowersaverInGameLabel();
}

function applyAutoplaySessionCheckboxFeatures() {
  enforceHideStopAfterDefeatForSeamlessAutoplay();
  applyAutoplaySessionCheckboxVisibility();
  updateHideStopAfterDefeatCheckboxState();
  ensurePowerSavingModePersistListener();
  ensurePowerSavingSessionListener();
  schedulePersistedPowerSavingModeRestore(0);
  syncLivePowerSavingModeFromDom();
}

let autoplaySessionFeaturesDebounceTimer = null;

function scheduleAutoplaySessionCheckboxFeatures() {
  if (autoplaySessionFeaturesDebounceTimer) {
    clearTimeout(autoplaySessionFeaturesDebounceTimer);
  }
  autoplaySessionFeaturesDebounceTimer = setTimeout(() => {
    autoplaySessionFeaturesDebounceTimer = null;
    applyAutoplaySessionCheckboxFeatures();
  }, 50);
}

function startAutoplaySessionCheckboxObserver() {
  console.log('[Mod Settings] Starting autoplay session checkbox observer');

  const observer = new MutationObserver(() => {
    scheduleAutoplaySessionCheckboxFeatures();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}

// =======================
// 12. Website Footer Functions
// =======================

// Hide website footer
function hideWebsiteFooter() {
  const footer = document.querySelector('footer.mt-5');
  if (footer) {
    footer.style.display = 'none';
    console.log('[Mod Settings] Website footer hidden');
  }
}

// Show website footer
function showWebsiteFooter() {
  const footer = document.querySelector('footer.mt-5');
  if (footer) {
    footer.style.display = '';
    console.log('[Mod Settings] Website footer shown');
  }
}

// =======================
// 11. Compact Nav Bar Functions
// =======================

// Apply compact nav bar (hide text, show only icons)
function applyCompactNavBar() {
  const navs = getNavElementsForCompactBar();
  if (navs.length === 0) {
    console.log('[Mod Settings] No nav elements found for compact bar');
    return;
  }

  navs.forEach(nav => {
    nav.querySelectorAll('button').forEach(button => {
      button.querySelectorAll('span').forEach(span => {
        if (isNavBarLabelSpan(span)) {
          span.style.display = 'none';
          span.setAttribute('data-compact-nav-hidden', 'true');
        }
      });
    });
  });

  console.log('[Mod Settings] Compact nav bar applied - text hidden');
}

function isInventoryWidgetHeader(header) {
  if (!header) return false;
  if (header.querySelector('img[alt="inventory" i], img[alt="Inventário" i], img[alt="Inventario" i], img[src*="inventory.png"]')) {
    return true;
  }
  const labelText = normalizeForLabelMatch(header.textContent);
  return labelText.includes('inventory') || labelText.includes('inventario');
}

function isInventoryWidgetPinned() {
  const root = findInventoryWidgetRoot();
  // Prefer icons inside the inventory widget — after pinning, aria-label/button may remount away.
  if (root?.querySelector('svg.lucide-pin-off')) return true;
  if (root?.querySelector('svg.lucide-pin')) return false;

  const pinButton = getInventoryWidgetPinButton();
  if (!pinButton) return null;
  const icon = pinButton.querySelector('svg');
  if (!icon) return null;
  if (icon.classList.contains('lucide-pin-off')) return true;
  if (icon.classList.contains('lucide-pin')) return false;
  return null;
}

function getInventoryWidgetPinButton() {
  const root = findInventoryWidgetRoot();
  if (root) {
    const inRoot =
      root.querySelector('button[aria-label="Pin widget"]') ||
      root.querySelector('button[aria-label="Unpin widget"]') ||
      root.querySelector('button[aria-label*="Pin" i]') ||
      root.querySelector('button[aria-label*="Fixar" i]') ||
      root.querySelector('button[aria-label*="Desafixar" i]') ||
      root.querySelector('button:has(svg.lucide-pin-off), button:has(svg.lucide-pin)');
    if (inRoot) return inRoot;
  }

  const inventoryHeaders = Array.from(
    document.querySelectorAll(
      '#game-sidebar-id h2.widget-top-text, #game-sidebar-id .widget-top.widget-top-text, [role="dialog"] h2.widget-top-text, [role="dialog"] .widget-top.widget-top-text, h2.widget-top-text, .widget-top.widget-top-text'
    )
  );
  for (const header of inventoryHeaders) {
    if (!isInventoryWidgetHeader(header)) continue;
    const pinBtn =
      header.querySelector('button[aria-label="Pin widget"], button[aria-label="Unpin widget"]') ||
      header.parentElement?.querySelector?.('button[aria-label="Pin widget"], button[aria-label="Unpin widget"]') ||
      header.querySelector('button[aria-label*="Fixar" i], button[aria-label*="Desafixar" i]') ||
      header.parentElement?.querySelector?.('button[aria-label*="Fixar" i], button[aria-label*="Desafixar" i]') ||
      header.querySelector('button:has(svg.lucide-pin-off), button:has(svg.lucide-pin)') ||
      header.parentElement?.querySelector?.('button:has(svg.lucide-pin-off), button:has(svg.lucide-pin)');
    if (pinBtn) return pinBtn;
  }
  return null;
}

function findInventoryWidgetRoot() {
  const grid = document.querySelector('.container-inventory-4');
  if (grid) {
    let el = grid.parentElement;
    while (el && el !== document.body) {
      if (el.classList?.contains('fixed')) {
        return el;
      }
      el = el.parentElement;
    }
  }

  const headers = document.querySelectorAll(
    '.widget-top.widget-top-text[aria-roledescription="draggable"], .widget-top.widget-top-text'
  );
  for (const header of headers) {
    if (!isInventoryWidgetHeader(header)) continue;
    let el = header.parentElement;
    while (el && el !== document.body) {
      if (el.classList?.contains('fixed')) {
        return el;
      }
      el = el.parentElement;
    }
  }
  return null;
}

function getInventoryWidgetDragHandle(root = findInventoryWidgetRoot()) {
  if (!root) return null;
  return root.querySelector(
    '.widget-top[aria-roledescription="draggable"], .widget-top.widget-top-text[role="button"], .widget-top.widget-top-text'
  );
}

function clampInventoryLeftTop(root, left, top) {
  const rect = root.getBoundingClientRect();
  const width = Math.max(40, root.offsetWidth || Math.round(rect.width) || 280);
  const height = Math.max(40, root.offsetHeight || Math.round(rect.height) || 200);
  const margin = 8;
  const minLeft = margin;
  const minTop = margin;
  const maxLeft = Math.max(minLeft, Math.round(window.innerWidth - width - margin));
  const maxTop = Math.max(minTop, Math.round(window.innerHeight - height - margin));
  const clamped = {
    left: Math.min(maxLeft, Math.max(minLeft, Math.round(left))),
    top: Math.min(maxTop, Math.max(minTop, Math.round(top)))
  };
  if (clamped.left !== Math.round(left) || clamped.top !== Math.round(top)) {
    logPersistentInventory('clamped off-screen position', {
      requested: { left, top },
      clamped,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      size: { width, height }
    });
  }
  return clamped;
}

function getSavedInventoryWidgetPosition() {
  const left = config.inventoryWidgetLeft;
  const top = config.inventoryWidgetTop;
  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    return { left: null, top: null };
  }
  return { left: Math.round(left), top: Math.round(top) };
}

function buildPersistentInventoryPositionStyleCss(left, top) {
  return (
    `[${PERSISTENT_INVENTORY_ATTR}="1"]{` +
    `left:${left}px!important;top:${top}px!important;right:auto!important;bottom:auto!important;` +
    `transform:none!important;}`
  );
}

function ensurePersistentInventoryPositionStyle(left, top) {
  const css = buildPersistentInventoryPositionStyleCss(left, top);
  if (persistentInventoryState.positionStyleCss === css) {
    return;
  }
  let styleEl = document.getElementById(PERSISTENT_INVENTORY_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = PERSISTENT_INVENTORY_STYLE_ID;
    document.documentElement.appendChild(styleEl);
  }
  styleEl.textContent = css;
  persistentInventoryState.positionStyleCss = css;
}

function clearPersistentInventoryPositionStyle() {
  document.getElementById(PERSISTENT_INVENTORY_STYLE_ID)?.remove();
  persistentInventoryState.positionStyleCss = null;
  document.querySelectorAll(`[${PERSISTENT_INVENTORY_ATTR}]`).forEach((el) => {
    el.removeAttribute(PERSISTENT_INVENTORY_ATTR);
    el.style.removeProperty('left');
    el.style.removeProperty('top');
    el.style.removeProperty('right');
    el.style.removeProperty('bottom');
    el.style.removeProperty('transform');
  });
}

function buildInventoryHorizontalLayoutStyleCss() {
  const colWidth = INVENTORY_SLOT_PX;
  const itemsPerColumn = getInventoryItemsPerColumn();
  return (
    `.${INVENTORY_HEADER_ACTIONS_CLASS}{` +
    `margin-left:auto;flex-shrink:0;display:inline-flex;align-items:center;gap:0;}` +
    `.${INVENTORY_LAYOUT_TOGGLE_CLASS},.${INVENTORY_LOCK_TOGGLE_CLASS}{` +
    `display:inline-flex;align-items:center;justify-content:center;` +
    `width:16px;height:16px;padding:0;box-sizing:border-box;color:#c0c0c0;` +
    `background:transparent;border:0;cursor:pointer;position:relative;z-index:2;line-height:0;}` +
    `.${INVENTORY_LAYOUT_TOGGLE_CLASS}:hover{color:#e8e8e8;}` +
    `.${INVENTORY_LAYOUT_TOGGLE_CLASS}:disabled,.${INVENTORY_LAYOUT_TOGGLE_CLASS}[aria-disabled="true"]{` +
    `color:#666;cursor:not-allowed;opacity:0.55;}` +
    `.${INVENTORY_LAYOUT_TOGGLE_CLASS}:disabled:hover,` +
    `.${INVENTORY_LAYOUT_TOGGLE_CLASS}[aria-disabled="true"]:hover{color:#666;}` +
    `.${INVENTORY_LOCK_TOGGLE_CLASS}[aria-pressed="false"]{color:#a0e0a0;}` +
    `.${INVENTORY_LOCK_TOGGLE_CLASS}[aria-pressed="false"]:hover{color:#b8f0b8;}` +
    `.${INVENTORY_LOCK_TOGGLE_CLASS}[aria-pressed="true"]{color:#f0a0a0;}` +
    `.${INVENTORY_LOCK_TOGGLE_CLASS}[aria-pressed="true"]:hover{color:#ffb3b3;}` +
    `.${INVENTORY_LAYOUT_TOGGLE_CLASS} svg,.${INVENTORY_LOCK_TOGGLE_CLASS} svg{` +
    `width:12px;height:12px;display:block;pointer-events:none;}` +
    `.widget-top.widget-top-text:has(.${INVENTORY_HEADER_ACTIONS_CLASS}){` +
    `height:19px!important;min-height:19px!important;max-height:19px!important;` +
    `box-sizing:border-box;overflow:hidden;}` +
    `[${INVENTORY_HORIZONTAL_ATTR}="1"]{` +
    `max-width:calc(100vw - 16px)!important;height:auto!important;}` +
    `[${INVENTORY_HORIZONTAL_ATTR}="1"] .widget-bottom{` +
    `height:auto!important;max-height:none!important;overflow:visible!important;}` +
    `[${INVENTORY_HORIZONTAL_ATTR}="1"] .widget-bottom > div{` +
    `height:auto!important;max-height:none!important;overflow:visible!important;}` +
    `[${INVENTORY_HORIZONTAL_ATTR}="1"] [data-radix-scroll-area-viewport]{` +
    `overflow-x:auto!important;overflow-y:hidden!important;` +
    `height:auto!important;max-height:none!important;width:100%!important;}` +
    `[${INVENTORY_HORIZONTAL_ATTR}="1"] [data-radix-scroll-area-viewport] > div{` +
    `display:block!important;min-width:max-content!important;width:max-content!important;` +
    `height:auto!important;}` +
    `[${INVENTORY_HORIZONTAL_ATTR}="1"] .container-inventory-4{` +
    `display:grid!important;grid-template-columns:none!important;` +
    `grid-template-rows:repeat(${itemsPerColumn},auto)!important;` +
    `grid-auto-flow:column!important;grid-auto-columns:${colWidth}px!important;` +
    `width:max-content!important;min-width:0!important;height:auto!important;}` +
    `[${INVENTORY_HORIZONTAL_ATTR}="1"] .scrollbar-element[data-orientation="vertical"]{` +
    `display:none!important;}`
  );
}

function buildInventoryColumnsStyleCss() {
  const cols = getInventoryItemsPerColumn();
  const colWidth = INVENTORY_SLOT_PX;
  // Extra chrome: scrollbar gutter + frame padding so 1/2-col grids aren't clipped.
  const chromeX = 20;
  const fitWidth = cols * colWidth + chromeX;
  // Vertical (default) inventory: N columns. Horizontal strip overrides rows separately.
  let css =
    `.container-inventory-4{` +
    `display:grid!important;` +
    `grid-template-columns:repeat(${cols},${colWidth}px)!important;` +
    `width:max-content!important;max-width:100%!important;}` +
    `.${INVENTORY_TITLE_CLASS}{` +
    `min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;` +
    `flex:1 1 0%;line-height:1;}`;

  // Narrower than default 4-col: shrink widget to the grid and ellipsis the title.
  // Uses INVENTORY_NARROW_ATTR (not persistent-inventory) so width survives drag
  // when data-ba-persistent-inventory is temporarily removed.
  if (cols === 1 || cols === 2) {
    css +=
      `[${INVENTORY_NARROW_ATTR}="${cols}"]{` +
      `width:${fitWidth}px!important;min-width:0!important;max-width:calc(100vw - 16px)!important;}` +
      `[${INVENTORY_NARROW_ATTR}="${cols}"] ` +
      `.widget-top.widget-top-text:has(.${INVENTORY_HEADER_ACTIONS_CLASS}){` +
      `width:100%!important;min-width:0!important;max-width:100%!important;` +
      `box-sizing:border-box;overflow:hidden;gap:0!important;column-gap:0!important;}` +
      `[${INVENTORY_NARROW_ATTR}="${cols}"] .${INVENTORY_HEADER_ACTIONS_CLASS}{` +
      `margin-left:0;gap:0;}` +
      `[${INVENTORY_NARROW_ATTR}="${cols}"] ` +
      `.widget-bottom{width:100%!important;min-width:0!important;max-width:100%!important;}` +
      `[${INVENTORY_NARROW_ATTR}="${cols}"] ` +
      `[data-radix-scroll-area-viewport]{width:100%!important;}`;
  }

  // 1-col header is too tight for "Inventory" + two toggles; drop the label so both icons fit.
  if (cols === 1) {
    css +=
      `[${INVENTORY_NARROW_ATTR}="1"] .${INVENTORY_TITLE_CLASS}{` +
      `display:none!important;}`;
  }

  return css;
}

function applyInventoryColumnsStyle() {
  const cols = getInventoryItemsPerColumn();
  config.inventoryItemsPerColumn = cols;
  const css = buildInventoryColumnsStyleCss();
  let styleEl = document.getElementById(INVENTORY_COLUMNS_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = INVENTORY_COLUMNS_STYLE_ID;
    document.documentElement.appendChild(styleEl);
  }
  if (styleEl.textContent !== css) {
    styleEl.textContent = css;
  }
  const colsAttr = String(cols);
  document.querySelectorAll('.container-inventory-4').forEach((grid) => {
    if (grid.getAttribute(INVENTORY_COLUMNS_ATTR) !== colsAttr) {
      grid.setAttribute(INVENTORY_COLUMNS_ATTR, colsAttr);
    }
  });
  const root = findInventoryWidgetRoot();
  if (root) {
    if (root.getAttribute(INVENTORY_COLUMNS_ATTR) !== colsAttr) {
      root.setAttribute(INVENTORY_COLUMNS_ATTR, colsAttr);
    }
    const wantsNarrow =
      (cols === 1 || cols === 2) &&
      config.inventoryHorizontalLayout !== true &&
      !root.hasAttribute(INVENTORY_HORIZONTAL_ATTR);
    if (wantsNarrow) {
      if (root.getAttribute(INVENTORY_NARROW_ATTR) !== colsAttr) {
        root.setAttribute(INVENTORY_NARROW_ATTR, colsAttr);
      }
    } else if (root.hasAttribute(INVENTORY_NARROW_ATTR)) {
      root.removeAttribute(INVENTORY_NARROW_ATTR);
    }
    ensureInventoryTitleEllipsisSpan(getInventoryWidgetDragHandle(root));
  }
}

function clearInventoryColumnsStyle() {
  document.getElementById(INVENTORY_COLUMNS_STYLE_ID)?.remove();
  document.querySelectorAll(`[${INVENTORY_COLUMNS_ATTR}]`).forEach((el) => {
    el.removeAttribute(INVENTORY_COLUMNS_ATTR);
  });
  document.querySelectorAll(`[${INVENTORY_NARROW_ATTR}]`).forEach((el) => {
    el.removeAttribute(INVENTORY_NARROW_ATTR);
  });
  document.querySelectorAll(`.${INVENTORY_TITLE_CLASS}`).forEach((el) => {
    const parent = el.parentNode;
    if (!parent) {
      el.remove();
      return;
    }
    parent.insertBefore(document.createTextNode(el.textContent || ''), el);
    el.remove();
  });
}

function ensureInventoryTitleEllipsisSpan(handle) {
  if (!handle || handle.querySelector(`.${INVENTORY_TITLE_CLASS}`)) return;
  for (const node of Array.from(handle.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const text = node.textContent || '';
    if (!text.trim()) continue;
    const span = document.createElement('span');
    span.className = INVENTORY_TITLE_CLASS;
    span.textContent = text;
    handle.replaceChild(span, node);
    return;
  }
}

function ensureInventoryHorizontalLayoutStyle() {
  applyInventoryColumnsStyle();
  const css = buildInventoryHorizontalLayoutStyleCss();
  if (persistentInventoryState.horizontalLayoutCss === css) {
    return;
  }
  let styleEl = document.getElementById(INVENTORY_HORIZONTAL_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = INVENTORY_HORIZONTAL_STYLE_ID;
    document.documentElement.appendChild(styleEl);
  }
  styleEl.textContent = css;
  persistentInventoryState.horizontalLayoutCss = css;
}

function clearInventoryHorizontalLayoutStyle() {
  document.getElementById(INVENTORY_HORIZONTAL_STYLE_ID)?.remove();
  persistentInventoryState.horizontalLayoutCss = null;
  document.querySelectorAll(`[${INVENTORY_HORIZONTAL_ATTR}]`).forEach((el) => {
    el.removeAttribute(INVENTORY_HORIZONTAL_ATTR);
  });
}

function getInventoryLayoutToggleIconSvg(horizontal) {
  // Vertical layout → columns icon (switch to horizontal). Horizontal → rows icon.
  if (horizontal) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'class="lucide lucide-rows-2" aria-hidden="true">' +
      '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 12h18"/></svg>'
    );
  }
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'class="lucide lucide-columns-2" aria-hidden="true">' +
    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/></svg>'
  );
}

function getInventoryLockToggleIconSvg(locked) {
  if (locked) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'class="lucide lucide-lock" aria-hidden="true">' +
      '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
    );
  }
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'class="lucide lucide-lock-open" aria-hidden="true">' +
    '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>'
  );
}

function updateInventoryLayoutToggleLabel(button) {
  if (!button) return;
  const horizontal = config.inventoryHorizontalLayout === true;
  const locked = config.inventoryWidgetLocked === true;
  const pressed = horizontal ? 'true' : 'false';
  if (button.getAttribute('aria-pressed') !== pressed) {
    button.innerHTML = getInventoryLayoutToggleIconSvg(horizontal);
    button.setAttribute('aria-pressed', pressed);
  }
  if (locked) {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    button.title = 'Unlock inventory position to change layout';
  } else {
    button.disabled = false;
    button.removeAttribute('aria-disabled');
    button.title = horizontal ? 'Vertical inventory layout' : 'Horizontal inventory layout';
  }
  button.setAttribute('aria-label', button.title);
}

function updateInventoryLockToggleLabel(button) {
  if (!button) return;
  const locked = config.inventoryWidgetLocked === true;
  const pressed = locked ? 'true' : 'false';
  if (button.getAttribute('aria-pressed') !== pressed) {
    button.innerHTML = getInventoryLockToggleIconSvg(locked);
    button.title = locked
      ? 'Unlock inventory position (also allows depot item moves)'
      : 'Lock inventory position (also blocks depot item moves)';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', pressed);
  }
}

function stopInventoryHeaderControlDrag(event) {
  // Do not preventDefault — that can suppress the following click.
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
  }
}

function ensureInventoryHeaderActions(handle) {
  if (!handle) return null;
  ensureInventoryTitleEllipsisSpan(handle);
  let actions = handle.querySelector(`.${INVENTORY_HEADER_ACTIONS_CLASS}`);
  if (!actions) {
    actions = document.createElement('span');
    actions.className = INVENTORY_HEADER_ACTIONS_CLASS;
    handle.appendChild(actions);
  }
  return actions;
}

function inventoryHorizontalLayoutNeedsSync(root = findInventoryWidgetRoot()) {
  if (!root) return false;
  const handle = getInventoryWidgetDragHandle(root);
  if (!handle) return false;
  const wantsHorizontal = config.inventoryHorizontalLayout === true;
  const hasHorizontalAttr = root.hasAttribute(INVENTORY_HORIZONTAL_ATTR);
  const actions = handle.querySelector(`.${INVENTORY_HEADER_ACTIONS_CLASS}`);
  const hasLayoutToggle = !!actions?.querySelector(`.${INVENTORY_LAYOUT_TOGGLE_CLASS}`);
  const hasLockToggle = !!actions?.querySelector(`.${INVENTORY_LOCK_TOGGLE_CLASS}`);
  return !hasLayoutToggle || !hasLockToggle || wantsHorizontal !== hasHorizontalAttr;
}

function injectInventoryLayoutToggle(root = findInventoryWidgetRoot()) {
  if (!config.persistentInventory) return;
  const handle = getInventoryWidgetDragHandle(root);
  if (!handle) return;

  ensureInventoryHorizontalLayoutStyle();
  const actions = ensureInventoryHeaderActions(handle);
  if (!actions) return;

  let lockButton = actions.querySelector(`.${INVENTORY_LOCK_TOGGLE_CLASS}`);
  if (!lockButton) {
    lockButton = document.createElement('button');
    lockButton.type = 'button';
    lockButton.className = INVENTORY_LOCK_TOGGLE_CLASS;
    lockButton.addEventListener('pointerdown', stopInventoryHeaderControlDrag, true);
    lockButton.addEventListener('mousedown', stopInventoryHeaderControlDrag, true);
    lockButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      config.inventoryWidgetLocked = !config.inventoryWidgetLocked;
      saveConfig();
      updateInventoryLockToggleLabel(lockButton);
      updateInventoryLayoutToggleLabel(actions.querySelector(`.${INVENTORY_LAYOUT_TOGGLE_CLASS}`));
      logPersistentInventory('position lock', { locked: config.inventoryWidgetLocked === true });
    });
    actions.appendChild(lockButton);
  }
  updateInventoryLockToggleLabel(lockButton);

  let button = actions.querySelector(`.${INVENTORY_LAYOUT_TOGGLE_CLASS}`);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = INVENTORY_LAYOUT_TOGGLE_CLASS;
    button.addEventListener('pointerdown', stopInventoryHeaderControlDrag, true);
    button.addEventListener('mousedown', stopInventoryHeaderControlDrag, true);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      if (config.inventoryWidgetLocked === true || button.disabled) return;
      config.inventoryHorizontalLayout = !config.inventoryHorizontalLayout;
      saveConfig();
      const liveRoot = findInventoryWidgetRoot() || root;
      applyInventoryHorizontalLayout(liveRoot);
      void liveRoot?.offsetHeight;
      // Re-place with final size so clamp matches the new layout.
      if (
        liveRoot &&
        Number.isFinite(config.inventoryWidgetLeft) &&
        Number.isFinite(config.inventoryWidgetTop)
      ) {
        applyInventoryWidgetPosition(liveRoot);
      }
      updateInventoryLayoutToggleLabel(button);
    });
    actions.appendChild(button);
  }
  updateInventoryLayoutToggleLabel(button);
}

function removeInventoryLayoutToggle(root = findInventoryWidgetRoot()) {
  const scope = root || document;
  scope.querySelectorAll?.(`.${INVENTORY_HEADER_ACTIONS_CLASS}`).forEach((el) => el.remove());
  document.querySelectorAll(`.${INVENTORY_HEADER_ACTIONS_CLASS}`).forEach((el) => el.remove());
  scope.querySelectorAll?.(`.${INVENTORY_LAYOUT_TOGGLE_CLASS}`).forEach((el) => el.remove());
  document.querySelectorAll(`.${INVENTORY_LAYOUT_TOGGLE_CLASS}`).forEach((el) => el.remove());
  scope.querySelectorAll?.(`.${INVENTORY_LOCK_TOGGLE_CLASS}`).forEach((el) => el.remove());
  document.querySelectorAll(`.${INVENTORY_LOCK_TOGGLE_CLASS}`).forEach((el) => el.remove());
}

function applyInventoryHorizontalLayout(root = findInventoryWidgetRoot()) {
  if (!config.persistentInventory) {
    clearInventoryHorizontalLayoutStyle();
    removeInventoryLayoutToggle();
    return false;
  }
  if (!root) return false;

  ensureInventoryHorizontalLayoutStyle();
  injectInventoryLayoutToggle(root);

  const wantsHorizontal = config.inventoryHorizontalLayout === true;
  if (wantsHorizontal) {
    if (!root.hasAttribute(INVENTORY_HORIZONTAL_ATTR)) {
      root.setAttribute(INVENTORY_HORIZONTAL_ATTR, '1');
    }
  } else if (root.hasAttribute(INVENTORY_HORIZONTAL_ATTR)) {
    root.removeAttribute(INVENTORY_HORIZONTAL_ATTR);
  }
  // Narrow fit depends on horizontal vs vertical.
  applyInventoryColumnsStyle();

  return true;
}

function applyInventoryWidgetPosition(root = findInventoryWidgetRoot()) {
  if (!config.persistentInventory || !root || persistentInventoryState.dragActive) {
    return false;
  }
  const saved = getSavedInventoryWidgetPosition();
  if (saved.left == null || saved.top == null) {
    logPersistentInventory('skip apply (no saved left/top)');
    return true; // nothing to place — count as done
  }
  const measuredWidth = root.offsetWidth || Math.round(root.getBoundingClientRect().width) || 0;
  if (measuredWidth < 40) {
    logPersistentInventory('skip apply (widget not laid out yet)', { measuredWidth });
    return false;
  }

  const { left, top } = clampInventoryLeftTop(root, saved.left, saved.top);
  ensurePersistentInventoryPositionStyle(left, top);
  if (!root.hasAttribute(PERSISTENT_INVENTORY_ATTR)) {
    root.setAttribute(PERSISTENT_INVENTORY_ATTR, '1');
  }
  const leftPx = `${left}px`;
  const topPx = `${top}px`;
  if (root.style.left !== leftPx) root.style.left = leftPx;
  if (root.style.top !== topPx) root.style.top = topPx;
  if (root.style.right !== 'auto') root.style.right = 'auto';
  if (root.style.bottom !== 'auto') root.style.bottom = 'auto';
  if (root.style.transform !== 'none') root.style.transform = 'none';
  logPersistentInventory('applied position', {
    left,
    top,
    elapsedMs: persistentInventoryState.restoreStartedAt
      ? Date.now() - persistentInventoryState.restoreStartedAt
      : null
  });
  return true;
}

function saveInventoryWidgetPinnedFromDom() {
  if (!config.persistentInventory || persistentInventoryState.restoring) {
    return false;
  }
  const pinned = isInventoryWidgetPinned();
  // Only persist real pin reads; never treat "inventory closed" / unknown as unpinned.
  if (pinned !== true && pinned !== false) {
    return false;
  }
  if (config.inventoryWidgetPinned === pinned) {
    return false;
  }
  config.inventoryWidgetPinned = pinned;
  saveConfig();
  logPersistentInventory('saved pin state', { pinned });
  return true;
}

function bindPersistentInventoryPinButtonListener(root = findInventoryWidgetRoot()) {
  if (!config.persistentInventory) return;
  const scope = root || document;
  const pinButton = scope.querySelector?.('button[aria-label="Pin widget"]') || getInventoryWidgetPinButton();
  if (!pinButton || pinButton.dataset.baPersistentPinBound === '1') return;
  pinButton.dataset.baPersistentPinBound = '1';
  pinButton.addEventListener('click', () => {
    scheduleTimeout(() => {
      if (!config.persistentInventory || persistentInventoryState.restoring) return;
      saveInventoryWidgetPinnedFromDom();
    }, 60);
  });
}

function capturePersistentInventoryStateFromDom() {
  if (!config.persistentInventory) {
    return;
  }
  // Prefer live pin state when readable; otherwise keep intent to restore pinned.
  const pinned = isInventoryWidgetPinned();
  if (pinned === true || pinned === false) {
    config.inventoryWidgetPinned = pinned;
  } else if (config.inventoryWidgetPinned == null) {
    config.inventoryWidgetPinned = true;
  }
  const root = findInventoryWidgetRoot();
  if (root) {
    const measuredWidth = root.offsetWidth || Math.round(root.getBoundingClientRect().width) || 0;
    if (measuredWidth >= 40) {
      const rect = root.getBoundingClientRect();
      const clamped = clampInventoryLeftTop(root, rect.left, rect.top);
      config.inventoryWidgetLeft = clamped.left;
      config.inventoryWidgetTop = clamped.top;
    }
  }
  saveConfig();
  logPersistentInventory('captured state from DOM', {
    pinned: config.inventoryWidgetPinned,
    left: config.inventoryWidgetLeft,
    top: config.inventoryWidgetTop
  });
}

function setPersistentInventoryRestoringVisual(active, root = findInventoryWidgetRoot()) {
  const styleEl = document.getElementById(PERSISTENT_INVENTORY_RESTORE_STYLE_ID);
  if (active) {
    let el = styleEl;
    if (!el) {
      el = document.createElement('style');
      el.id = PERSISTENT_INVENTORY_RESTORE_STYLE_ID;
      document.documentElement.appendChild(el);
    }
    el.textContent =
      `[${PERSISTENT_INVENTORY_RESTORING_ATTR}="1"] button.widget-top-button,` +
      `[${PERSISTENT_INVENTORY_RESTORING_ATTR}="1"] button[aria-label="Pin widget"],` +
      `[${PERSISTENT_INVENTORY_RESTORING_ATTR}="1"] button[aria-label="Unpin widget"],` +
      `[${PERSISTENT_INVENTORY_RESTORING_ATTR}="1"] button[aria-label*="Fixar" i],` +
      `[${PERSISTENT_INVENTORY_RESTORING_ATTR}="1"] button[aria-label*="Desafixar" i]{` +
      'display:block!important;visibility:visible!important;pointer-events:all!important;opacity:1!important;}';
    if (root) {
      root.setAttribute(PERSISTENT_INVENTORY_RESTORING_ATTR, '1');
    }
    return;
  }
  styleEl?.remove();
  document.querySelectorAll(`[${PERSISTENT_INVENTORY_RESTORING_ATTR}]`).forEach((node) => {
    node.removeAttribute(PERSISTENT_INVENTORY_RESTORING_ATTR);
  });
}

function isInventoryWidgetReadyForPin(root = findInventoryWidgetRoot()) {
  if (!root) return false;
  const dialogState = root.getAttribute('data-state');
  if (dialogState && dialogState !== 'open') return false;
  const grid = root.querySelector('.container-inventory-4');
  if (!grid) return false;
  const width = grid.offsetWidth || Math.round(grid.getBoundingClientRect().width) || 0;
  return width >= 40;
}

function withProgrammaticClickTarget(button, fn) {
  if (!button || typeof fn !== 'function') return false;
  const hadHidden = button.classList.contains('hidden');
  const prevDisplay = button.style.display;
  const prevVisibility = button.style.visibility;
  const prevPointerEvents = button.style.pointerEvents;
  const prevOpacity = button.style.opacity;
  if (hadHidden) button.classList.remove('hidden');
  button.style.display = 'block';
  button.style.visibility = 'visible';
  button.style.pointerEvents = 'all';
  button.style.opacity = '1';
  try {
    button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return fn(button) === true;
  } finally {
    if (hadHidden) button.classList.add('hidden');
    button.style.display = prevDisplay;
    button.style.visibility = prevVisibility;
    button.style.pointerEvents = prevPointerEvents;
    button.style.opacity = prevOpacity;
  }
}

function triggerWidgetPinButton(button) {
  return withProgrammaticClickTarget(button, (target) => {
    const rect = target.getBoundingClientRect();
    const clientX = Math.round(rect.left + Math.max(1, rect.width) / 2);
    const clientY = Math.round(rect.top + Math.max(1, rect.height) / 2);
    const pointerBase = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX,
      clientY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true
    };
    const mouseBase = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX,
      clientY,
      button: 0,
      buttons: 1
    };
    try {
      target.focus?.({ preventScroll: true });
    } catch (_) {
      // Focus is best effort only.
    }
    const clickTarget = target.querySelector('svg') || target;
    const targets = clickTarget === target ? [target] : [target, clickTarget];
    for (const el of targets) {
      el.dispatchEvent(new PointerEvent('pointerover', pointerBase));
      el.dispatchEvent(new PointerEvent('pointerenter', pointerBase));
      el.dispatchEvent(new MouseEvent('mouseover', mouseBase));
      el.dispatchEvent(new MouseEvent('mouseenter', mouseBase));
      el.dispatchEvent(new PointerEvent('pointerdown', pointerBase));
      el.dispatchEvent(new MouseEvent('mousedown', mouseBase));
      el.dispatchEvent(new PointerEvent('pointerup', { ...pointerBase, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('mouseup', { ...mouseBase, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('click', { ...mouseBase, buttons: 0 }));
    }
    try {
      target.click();
    } catch (_) {
      // Native click is best effort after synthetic events.
    }
    return true;
  });
}

function clearPersistentInventoryRestoreTimeouts() {
  persistentInventoryState.restoreTimeouts.forEach((timeoutId) => {
    clearTimeout(timeoutId);
    activeTimeouts.delete(timeoutId);
  });
  persistentInventoryState.restoreTimeouts = [];
}

function schedulePersistentInventoryRestoreStep(fn, delay) {
  const timeoutId = scheduleTimeout(fn, delay);
  persistentInventoryState.restoreTimeouts.push(timeoutId);
  return timeoutId;
}

/**
 * Pinned restore only: open inventory → pin if needed → place at saved left/top once.
 * If left/top are null, still open+pin but skip position apply.
 */
function runPersistentInventoryRestoreAttempt() {
  const elapsedMs = persistentInventoryState.restoreStartedAt
    ? Date.now() - persistentInventoryState.restoreStartedAt
    : 0;

  if (!config.persistentInventory) {
    logPersistentInventory('restore attempt skipped (feature off)', { elapsedMs });
    return true;
  }

  // Not pinned → leave the game alone. Only listen so a later pin/drag can be saved.
  if (config.inventoryWidgetPinned !== true) {
    const root = findInventoryWidgetRoot();
    logPersistentInventory('restore idle (not pinned in config)', {
      elapsedMs,
      inventoryOpen: Boolean(root),
      configPinned: config.inventoryWidgetPinned
    });
    if (root) {
      bindPersistentInventoryDragListeners();
      bindPersistentInventoryPinButtonListener(root);
    }
    return true;
  }

  const root = findInventoryWidgetRoot();
  if (!root) {
    const shouldRetryOpen =
      !persistentInventoryState.openedInventory ||
      elapsedMs - (persistentInventoryState.lastOpenAttemptAt || 0) > 700;
    if (shouldRetryOpen) {
      logPersistentInventory(
        persistentInventoryState.openedInventory
          ? 'inventory still closed → retry open'
          : 'inventory closed → opening',
        { elapsedMs }
      );
      persistentInventoryState.openedInventory = true;
      persistentInventoryState.lastOpenAttemptAt = elapsedMs;
      openInventoryFromHotkey();
    } else {
      logPersistentInventory('waiting for inventory root after open', { elapsedMs });
    }
    return false;
  }

  setPersistentInventoryRestoringVisual(true, root);

  if (!isInventoryWidgetReadyForPin(root)) {
    logPersistentInventory('waiting for inventory widget ready', { elapsedMs });
    return false;
  }

  const pinned = isInventoryWidgetPinned();
  const hasPinButton = Boolean(getInventoryWidgetPinButton());
  const saved = getSavedInventoryWidgetPosition();
  logPersistentInventory('inventory open', {
    elapsedMs,
    pinned,
    hasPinButton,
    clickedPin: persistentInventoryState.clickedPin,
    saved
  });

  if (pinned === false) {
    const pinButton = getInventoryWidgetPinButton();
    if (!pinButton) {
      logPersistentInventory('pin button missing', { elapsedMs });
      return false;
    }
    const attempts = persistentInventoryState.pinClickAttempts || 0;
    const canClickPin =
      attempts < 10 &&
      (!persistentInventoryState.lastPinClickAt ||
        elapsedMs - persistentInventoryState.lastPinClickAt > 350);
    if (canClickPin) {
      persistentInventoryState.pinClickAttempts = attempts + 1;
      persistentInventoryState.clickedPin = true;
      persistentInventoryState.lastPinClickAt = elapsedMs;
      const clicked = triggerWidgetPinButton(pinButton);
      logPersistentInventory('clicking pin', {
        elapsedMs,
        attempt: persistentInventoryState.pinClickAttempts,
        clicked,
        rect: pinButton.getBoundingClientRect()
      });
    } else {
      logPersistentInventory('waiting for pin to stick', {
        elapsedMs,
        attempts: persistentInventoryState.pinClickAttempts
      });
    }
    return false;
  }

  persistentInventoryState.pinClickAttempts = 0;

  // After pin click the control often remounts/disappears briefly — treat as done
  // only when the pin control is gone (not when it still shows unpinned).
  if (pinned !== true) {
    if (persistentInventoryState.clickedPin && pinned == null && !hasPinButton) {
      logPersistentInventory('pin control unavailable after click → treating as pinned', {
        elapsedMs,
        hasPinButton
      });
    } else {
      logPersistentInventory('pin state unknown', { elapsedMs, pinned, hasPinButton });
      return false;
    }
  }

  // Layout first (horizontal vs vertical changes height/width). Clamping while tall
  // pushes top upward; then switching to a short strip leaves it too high.
  applyInventoryHorizontalLayout(root);
  void root.offsetHeight; // force reflow so clamp uses final size

  if (!persistentInventoryState.positionApplied) {
    const applied = applyInventoryWidgetPosition(root);
    if (!applied) {
      return false;
    }
    persistentInventoryState.positionApplied = true;
  }

  bindPersistentInventoryDragListeners();
  bindPersistentInventoryPinButtonListener(root);
  setPersistentInventoryRestoringVisual(false, root);
  logPersistentInventory('restore complete', {
    elapsedMs,
    pinned: pinned === true ? true : 'assumed-after-click',
    saved: getSavedInventoryWidgetPosition()
  });
  return true;
}

function applyPersistentInventory() {
  if (!config.persistentInventory) return;

  startPersistentInventoryObserver();
  applyInventoryHorizontalLayout(findInventoryWidgetRoot());

  // Feature on but not pinned: do not open, close, pin, or move the inventory.
  if (config.inventoryWidgetPinned !== true) {
    logPersistentInventory('apply skipped (config not pinned)', {
      configPinned: config.inventoryWidgetPinned,
      saved: getSavedInventoryWidgetPosition()
    });
    clearPersistentInventoryRestoreTimeouts();
    persistentInventoryState.restoreStarted = false;
    persistentInventoryState.restoreComplete = true;
    persistentInventoryState.restoring = false;
    persistentInventoryState.positionApplied = false;
    bindPersistentInventoryDragListeners();
    applyInventoryHorizontalLayout(findInventoryWidgetRoot());
    return;
  }

  clearPersistentInventoryRestoreTimeouts();
  persistentInventoryState.restoreStarted = true;
  persistentInventoryState.restoreComplete = false;
  persistentInventoryState.restoring = true;
  persistentInventoryState.positionApplied = false;
  persistentInventoryState.restoreStartedAt = Date.now();
  persistentInventoryState.openedInventory = false;
  persistentInventoryState.clickedPin = false;
  persistentInventoryState.lastPinClickAt = 0;
  persistentInventoryState.lastOpenAttemptAt = 0;
  persistentInventoryState.pinClickAttempts = 0;

  logPersistentInventory('restore started', {
    saved: getSavedInventoryWidgetPosition(),
    configPinned: config.inventoryWidgetPinned
  });

  const attemptDelays = [0, 50, 100, 200, 350, 550, 800, 1200, 1800, 2500, 3200, 4000];
  attemptDelays.forEach((delay, index) => {
    schedulePersistentInventoryRestoreStep(() => {
      if (!config.persistentInventory) return;
      if (config.inventoryWidgetPinned !== true) {
        persistentInventoryState.restoreComplete = true;
        persistentInventoryState.restoring = false;
        setPersistentInventoryRestoringVisual(false);
        logPersistentInventory('restore aborted (config unpinned mid-run)');
        return;
      }
      persistentInventoryState.lastRestoreStepAt = Date.now();
      logPersistentInventory(`restore step #${index + 1}`, {
        delayMs: delay,
        elapsedMs: Date.now() - persistentInventoryState.restoreStartedAt
      });
      const done = runPersistentInventoryRestoreAttempt();
      if (done || index === attemptDelays.length - 1) {
        persistentInventoryState.restoreComplete = done;
        persistentInventoryState.restoring = false;
        setPersistentInventoryRestoringVisual(false);
        if (done) {
          clearPersistentInventoryRestoreTimeouts();
        }
        if (config.inventoryWidgetPinned === true) {
          bindPersistentInventoryDragListeners();
        }
        logPersistentInventory('restore finished', {
          success: done,
          elapsedMs: Date.now() - persistentInventoryState.restoreStartedAt,
          saved: getSavedInventoryWidgetPosition()
        });
      }
    }, delay);
  });
}

function unbindPersistentInventoryDragListeners() {
  const root = persistentInventoryState.boundDragRoot;
  if (root && persistentInventoryState.onPointerDown) {
    root.removeEventListener('pointerdown', persistentInventoryState.onPointerDown, true);
  }
  if (persistentInventoryState.onPointerMove) {
    window.removeEventListener('pointermove', persistentInventoryState.onPointerMove, true);
  }
  if (persistentInventoryState.onPointerUp) {
    window.removeEventListener('pointerup', persistentInventoryState.onPointerUp, true);
    window.removeEventListener('pointercancel', persistentInventoryState.onPointerUp, true);
  }
  persistentInventoryState.boundDragRoot = null;
  persistentInventoryState.onPointerDown = null;
  persistentInventoryState.onPointerMove = null;
  persistentInventoryState.onPointerUp = null;
  persistentInventoryState.dragOrigin = null;
  persistentInventoryState.dragActive = false;
}

/**
 * Own the drag with left/top. The game uses dnd-kit transforms; mixing that with a
 * restored left/top makes the panel snap back (transform clears, left/top stay).
 */
function bindPersistentInventoryDragListeners() {
  if (!config.persistentInventory) return;
  const root = findInventoryWidgetRoot();
  if (!root) return;
  if (persistentInventoryState.boundDragRoot === root && persistentInventoryState.onPointerDown) {
    return;
  }
  unbindPersistentInventoryDragListeners();

  persistentInventoryState.onPointerMove = (event) => {
    if (!persistentInventoryState.dragActive || !persistentInventoryState.dragOrigin) return;
    const liveRoot = findInventoryWidgetRoot() || root;
    const { startClientX, startClientY, originLeft, originTop } = persistentInventoryState.dragOrigin;
    const nextLeft = originLeft + (event.clientX - startClientX);
    const nextTop = originTop + (event.clientY - startClientY);
    const clamped = clampInventoryLeftTop(liveRoot, nextLeft, nextTop);
    liveRoot.style.left = `${clamped.left}px`;
    liveRoot.style.top = `${clamped.top}px`;
    liveRoot.style.right = 'auto';
    liveRoot.style.bottom = 'auto';
    liveRoot.style.transform = 'none';
  };

  persistentInventoryState.onPointerUp = () => {
    if (!persistentInventoryState.dragActive) return;
    window.removeEventListener('pointermove', persistentInventoryState.onPointerMove, true);
    const liveRoot = findInventoryWidgetRoot() || root;
    const rect = liveRoot.getBoundingClientRect();
    const clamped = clampInventoryLeftTop(liveRoot, rect.left, rect.top);
    liveRoot.style.left = `${clamped.left}px`;
    liveRoot.style.top = `${clamped.top}px`;
    liveRoot.style.right = 'auto';
    liveRoot.style.bottom = 'auto';
    liveRoot.style.transform = 'none';
    // Re-lock at the drop spot so a React re-render cannot snap it away.
    ensurePersistentInventoryPositionStyle(clamped.left, clamped.top);
    liveRoot.setAttribute(PERSISTENT_INVENTORY_ATTR, '1');
    config.inventoryWidgetLeft = clamped.left;
    config.inventoryWidgetTop = clamped.top;
    // Dragging a persistent inventory means we should restore it pinned next load.
    config.inventoryWidgetPinned = true;
    saveConfig();
    logPersistentInventory('saved position', clamped);
    persistentInventoryState.dragOrigin = null;
    persistentInventoryState.dragActive = false;
    bindPersistentInventoryPinButtonListener(liveRoot);
  };

  persistentInventoryState.onPointerDown = (event) => {
    if (event.button != null && event.button !== 0) return;
    const handle = getInventoryWidgetDragHandle(root);
    if (!handle || !handle.contains(event.target)) return;
    if (event.target.closest?.('button[aria-label="Pin widget"], button[aria-label="Unpin widget"]')) return;
    if (event.target.closest?.('button:has(svg.lucide-pin), button:has(svg.lucide-pin-off)')) return;
    if (event.target.closest?.(`.${INVENTORY_LAYOUT_TOGGLE_CLASS}`)) return;
    if (event.target.closest?.(`.${INVENTORY_LOCK_TOGGLE_CLASS}`)) return;
    if (event.target.closest?.(`.${INVENTORY_HEADER_ACTIONS_CLASS}`)) return;

    // Locked: block game dnd-kit drag without starting our own move.
    if (config.inventoryWidgetLocked === true) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Stop dnd-kit from starting a transform drag.
    event.preventDefault();
    event.stopPropagation();

    const liveRoot = findInventoryWidgetRoot() || root;
    const rect = liveRoot.getBoundingClientRect();
    const startLeft = Math.round(rect.left);
    const startTop = Math.round(rect.top);

    document.getElementById(PERSISTENT_INVENTORY_STYLE_ID)?.remove();
    persistentInventoryState.positionStyleCss = null;
    liveRoot.removeAttribute(PERSISTENT_INVENTORY_ATTR);
    liveRoot.style.left = `${startLeft}px`;
    liveRoot.style.top = `${startTop}px`;
    liveRoot.style.right = 'auto';
    liveRoot.style.bottom = 'auto';
    liveRoot.style.transform = 'none';

    persistentInventoryState.dragActive = true;
    persistentInventoryState.dragOrigin = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      originLeft: startLeft,
      originTop: startTop
    };

    window.addEventListener('pointermove', persistentInventoryState.onPointerMove, true);
    logPersistentInventory('drag begin (mod-owned left/top)', {
      left: startLeft,
      top: startTop
    });
  };

  root.addEventListener('pointerdown', persistentInventoryState.onPointerDown, true);
  window.addEventListener('pointerup', persistentInventoryState.onPointerUp, true);
  window.addEventListener('pointercancel', persistentInventoryState.onPointerUp, true);
  persistentInventoryState.boundDragRoot = root;
}

function startPersistentInventoryObserver() {
  if (!config.persistentInventory) return null;
  if (observers.persistentInventory) return observers.persistentInventory;

  let debounceTimeout = null;
  const observer = new MutationObserver(() => {
    if (!config.persistentInventory || persistentInventoryState.dragActive) return;
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      activeTimeouts.delete(debounceTimeout);
    }
    debounceTimeout = scheduleTimeout(() => {
      debounceTimeout = null;
      if (!config.persistentInventory || persistentInventoryState.dragActive) return;
      const root = findInventoryWidgetRoot();
      if (!root) return;
      // During restore: help drive open/pin/place attempts.
      if (persistentInventoryState.restoring) {
        runPersistentInventoryRestoreAttempt();
        return;
      }
      // After restore: rebind listeners. Re-place only if the widget remounted
      // (e.g. inventory refresh) — never fight a live drag or post-drop settle.
      const remounted =
        !persistentInventoryState.boundDragRoot ||
        persistentInventoryState.boundDragRoot !== root ||
        !document.contains(persistentInventoryState.boundDragRoot);
      if (
        remounted &&
        config.inventoryWidgetPinned === true
      ) {
        if (isInventoryWidgetPinned() === false) {
          const pinButton = getInventoryWidgetPinButton();
          if (pinButton) triggerWidgetPinButton(pinButton);
        }
        // Layout before position so clamp uses the final widget size.
        applyInventoryHorizontalLayout(root);
        void root.offsetHeight;
        if (getSavedInventoryWidgetPosition().left != null) {
          applyInventoryWidgetPosition(root);
        }
      }
      bindPersistentInventoryPinButtonListener(root);
      bindPersistentInventoryDragListeners();
      if (inventoryHorizontalLayoutNeedsSync(root)) {
        applyInventoryHorizontalLayout(root);
        void root.offsetHeight;
        if (
          config.inventoryWidgetPinned === true &&
          getSavedInventoryWidgetPosition().left != null &&
          !persistentInventoryState.dragActive
        ) {
          applyInventoryWidgetPosition(root);
        }
      } else if (!document.getElementById(INVENTORY_HORIZONTAL_STYLE_ID)) {
        ensureInventoryHorizontalLayoutStyle();
      }
    }, 120);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  observers.persistentInventory = observer;
  return observer;
}

function stopPersistentInventoryObserver() {
  clearPersistentInventoryRestoreTimeouts();
  if (observers.persistentInventory) {
    observers.persistentInventory.disconnect();
    observers.persistentInventory = null;
  }
  unbindPersistentInventoryDragListeners();
  clearPersistentInventoryPositionStyle();
  clearInventoryHorizontalLayoutStyle();
  removeInventoryLayoutToggle();
  setPersistentInventoryRestoringVisual(false);
  persistentInventoryState.restoreStarted = false;
  persistentInventoryState.restoreComplete = false;
  persistentInventoryState.restoring = false;
  persistentInventoryState.positionApplied = false;
  persistentInventoryState.openedInventory = false;
  persistentInventoryState.clickedPin = false;
  persistentInventoryState.lastPinClickAt = 0;
  persistentInventoryState.lastOpenAttemptAt = 0;
  persistentInventoryState.pinClickAttempts = 0;
  persistentInventoryState.restoreStartedAt = 0;
  if (persistentInventoryState.savePositionTimeout) {
    clearTimeout(persistentInventoryState.savePositionTimeout);
    activeTimeouts.delete(persistentInventoryState.savePositionTimeout);
    persistentInventoryState.savePositionTimeout = null;
  }
}

function clearPersistentInventorySavedConfig() {
  config.persistentInventory = false;
  config.inventoryWidgetPinned = null;
  config.inventoryWidgetLeft = null;
  config.inventoryWidgetTop = null;
  config.inventoryHorizontalLayout = false;
  config.inventoryWidgetLocked = false;
  // Prevent sticky→pinned repair from reviving state on next load.
  if (config.defaultInventorySticky !== undefined) {
    config.defaultInventorySticky = false;
  }
  delete config.inventoryWidgetTranslateX;
  delete config.inventoryWidgetTranslateY;
  saveConfig();
  logPersistentInventory('cleared saved config (feature disabled)');
}

function initializePersistentInventoryConfigForEnable() {
  config.inventoryWidgetPinned = true;
  config.inventoryWidgetLeft = null;
  config.inventoryWidgetTop = null;
  config.inventoryHorizontalLayout = false;
  config.inventoryWidgetLocked = false;
  delete config.inventoryWidgetTranslateX;
  delete config.inventoryWidgetTranslateY;
  saveConfig();
}

function disablePersistentInventory() {
  stopPersistentInventoryObserver();
  clearPersistentInventorySavedConfig();
}

// Remove compact nav bar (show text again)
function removeCompactNavBar() {
  document.querySelectorAll('[data-compact-nav-hidden="true"]').forEach(span => {
    span.style.display = '';
    span.removeAttribute('data-compact-nav-hidden');
  });
  console.log('[Mod Settings] Compact nav bar removed - text shown');
}

// Start observer for compact nav bar
function startCompactNavBarObserver() {
  console.log('[Mod Settings] Starting compact nav bar observer');

  const observer = new MutationObserver(() => {
    if (!config.compactNavBar) return;

    let needsUpdate = false;
    outer: for (const nav of getNavElementsForCompactBar()) {
      for (const button of nav.querySelectorAll('button')) {
        for (const span of button.querySelectorAll('span')) {
          if (isNavBarLabelSpan(span) && span.style.display !== 'none') {
            needsUpdate = true;
            break outer;
          }
        }
      }
    }
    if (needsUpdate) {
      applyCompactNavBar();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  return observer;
}

// =======================
// 12. Stamina Timer Functions
// =======================

// Update stamina timer display
function updateStaminaTimer() {
  const staminaDiv = document.querySelector(SELECTORS.STAMINA_DIV);
  if (!staminaDiv) {
    console.log('[Mod Settings] Stamina button not found');
    return;
  }
  
  try {
    // Find the parent span that contains the stamina values
    const parentSpan = staminaDiv.querySelector(SELECTORS.STAMINA_PARENT_SPAN);
    if (!parentSpan) {
      console.log('[Mod Settings] Parent stamina span not found');
      return;
    }
    
    // Parse stamina values
    const staminaValues = parseStaminaValues(parentSpan);
    if (!staminaValues) {
      console.log('[Mod Settings] Invalid stamina values');
      return;
    }
    
    const { current: currentStamina, max: maxStamina } = staminaValues;
    
    // Check if stamina value changed
    const staminaChanged = timerState.lastValue !== currentStamina;
    if (staminaChanged) {
      const oldValue = timerState.lastValue;
      timerState.lastValue = currentStamina;
      
      // Check throttle
      if (shouldThrottleUpdate()) {
        return;
      }
      
      // Calculate ready time
      const readyTime = calculateStaminaReadyTime(currentStamina, maxStamina);
      console.log(`[Mod Settings] Stamina: ${oldValue || 'init'}→${currentStamina}/${maxStamina}, Status: ${readyTime}`);
      
      // Update timer only if stamina changed
      updateTimerDisplay(readyTime);
    } else {
      // No stamina change, exit early
      return;
    }
  } catch (error) {
    console.error('[Mod Settings] Error updating stamina timer:', error);
  }
}

// Helper function to update timer display
function updateTimerDisplay(readyTime) {
  // Check if timer should be shown based on config
  if (!config.showStaminaTimer) {
    console.log('[Mod Settings] Timer display skipped (disabled in config)');
    return;
  }
  
  // Find or create timer element
  if (!timerState.element) {
    console.log('[Mod Settings] Creating stamina timer element');
    
    // Create timer element with styles
    timerState.element = document.createElement('span');
    timerState.element.className = 'better-ui-stamina-timer';
    Object.assign(timerState.element.style, TIMER_STYLES);
    
    // Insert within the parent span to keep it inline
    const staminaDiv = document.querySelector(SELECTORS.STAMINA_DIV);
    if (staminaDiv) {
      const parentSpan = staminaDiv.querySelector(SELECTORS.STAMINA_PARENT_SPAN);
      if (parentSpan) {
        // Fix Chrome wrapping: ensure parent span stays inline
        parentSpan.style.display = 'inline-flex';
        parentSpan.style.flexWrap = 'nowrap';
        parentSpan.style.whiteSpace = 'nowrap';
        parentSpan.style.alignItems = 'baseline';
        
        // Insert at the end of the parent span to keep it inline with stamina values
        parentSpan.appendChild(timerState.element);
      }
    }
  }
  
  // Update timer text
  if (readyTime === t('mods.betterUI.staminaFullText')) {
    timerState.element.textContent = ` 🕐${t('mods.betterUI.staminaFullText')}`;
  } else {
    timerState.element.textContent = ` 🕐${readyTime}`;
  }
}

// Initialize stamina timer with retry logic
function initStaminaTimer() {
  console.log('[Mod Settings] Initializing stamina timer');
  
  const tryInit = () => {
    const staminaDiv = document.querySelector(SELECTORS.STAMINA_DIV);
    if (!staminaDiv) {
      console.log('[Mod Settings] Stamina button not found, retrying in 500ms');
      scheduleTimeout(tryInit, TIMEOUT_DELAYS.INIT_RETRY);
      return;
    }
    
    // Fix Chrome flexbox wrapping
    applyChromeFlex();
    
    const staminaButton = staminaDiv.closest('button');
    console.log('[Mod Settings] Stamina button found, setting up timer');
    
    // Initial update
    updateStaminaTimer();
    
    // Also update when stamina changes (observe only the stamina values span)
    console.log('[Mod Settings] Setting up MutationObserver for stamina changes');
    const staminaSpan = staminaDiv.querySelector(SELECTORS.STAMINA_PARENT_SPAN);
    if (staminaSpan) {
      observers.stamina = new MutationObserver((mutations) => {
        // Throttle updates to prevent spam
        if (timerState.updateThrottle) return;
        timerState.updateThrottle = setTimeout(() => {
          activeTimeouts.delete(timerState.updateThrottle);
          timerState.updateThrottle = null;
          updateStaminaTimer();
        }, THROTTLE_SETTINGS.DOM_CHECK);
        activeTimeouts.add(timerState.updateThrottle);
      });
      
      observers.stamina.observe(staminaSpan, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    
    console.log('[Mod Settings] Stamina timer initialization complete');
  };
  
  tryInit();
}

// Setup tab observer to reapply max creatures when switching tabs
function initTabObserver() {
  try {
    // Disconnect existing observer if any
    if (observers.tab) {
      observers.tab.disconnect();
    }
    
    // Find the tab list
    const tabList = document.querySelector('div[role="tablist"]');
    if (!tabList) {
      console.warn('[Mod Settings] Tab list not found, tab observer not initialized');
      return;
    }
    
    // Create observer to watch for tab changes
    observers.tab = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Check if a tab's state changed
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
          const target = mutation.target;
          const newState = target.getAttribute('data-state');
          const tabId = target.getAttribute('id');
          
          // If Bestiary tab became active, check if we need to reapply
          if (newState === 'active' && tabId && tabId.includes('monster')) {
            console.log('[Mod Settings] Bestiary tab activated, checking if update needed...');
            
            // Check global debounce to prevent redundant updates
            if (shouldSkipGlobalUpdate('tab-change')) {
              return;
            }
            
            if (config.enableMaxCreatures) {
              console.log('[Mod Settings] Reapplying max creatures');
              scheduleTimeout(() => {
                applyMaxCreatures();
              }, TIMEOUT_DELAYS.TAB_REAPPLY);
            } else {
              console.log('[Mod Settings] Max creatures disabled, skipping');
            }
            if (config.enableSealed) {
              console.log('[Mod Settings] Reapplying sealed creatures');
              scheduleTimeout(() => {
                applySealedCreatures();
              }, TIMEOUT_DELAYS.TAB_REAPPLY);
            } else {
              console.log('[Mod Settings] Sealed creatures disabled, skipping');
            }
            if (config.enableMaxShinies) {
              console.log('[Mod Settings] Reapplying max shinies');
              scheduleTimeout(() => {
                applyMaxShinies();
              }, TIMEOUT_DELAYS.TAB_REAPPLY);
            } else {
              console.log('[Mod Settings] Max shinies disabled, skipping');
            }
            if (config.enableShinyEnemies) {
              console.log('[Mod Settings] Reapplying shiny enemies');
              scheduleTimeout(() => {
                applyShinyEnemies();
              }, TIMEOUT_DELAYS.TAB_REAPPLY);
            }
            window.depotManager?.notifyFavoriteGridRefresh?.('tab');
          }
        }
      });
    });
    
    // Observe all tab buttons for attribute changes
    const tabButtons = tabList.querySelectorAll('button[role="tab"]');
    tabButtons.forEach((button) => {
      observers.tab.observe(button, {
        attributes: true,
        attributeFilter: ['data-state']
      });
    });
    
    console.log(`[Mod Settings] Tab observer initialized, watching ${tabButtons.length} tabs`);
  } catch (error) {
    console.error('[Mod Settings] Error initializing tab observer:', error);
  }
}

// Start observer for creature container changes (search filtering)
function startCreatureContainerObserver() {
  // Find the creature container
  const creatureContainer = document.querySelector('[data-testid="monster-grid"]') || 
                           document.querySelector('.grid') ||
                           document.querySelector('[class*="grid"]');
  
  if (!creatureContainer) {
    console.log('[Mod Settings] Creature container not found, retrying in 1 second...');
    scheduleTimeout(startCreatureContainerObserver, TIMEOUT_DELAYS.OBSERVER_RETRY);
    return;
  }
  
  // Disconnect existing observer if any
  if (observers.creature) {
    observers.creature.disconnect();
  }
  
  observers.creature = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    
    mutations.forEach(mutation => {
      // Check for child list changes (creatures being added/removed/filtered)
      if (mutation.type === 'childList') {
        shouldUpdate = true;
      }
    });
    
    if (shouldUpdate) {
      
      // Debounce the updates to avoid excessive calls
      if (observers.creature.updateTimeout) {
        clearTimeout(observers.creature.updateTimeout);
        activeTimeouts.delete(observers.creature.updateTimeout);
      }
      observers.creature.updateTimeout = setTimeout(() => {
        // Check global debounce to prevent redundant updates from other observers
        if (shouldSkipGlobalUpdate('creature-observer')) {
          // Reconnect observer even if skipping
          if (observers.creature && creatureContainer) {
            observers.creature.observe(creatureContainer, {
              childList: true,
              subtree: true
            });
          }
          activeTimeouts.delete(observers.creature.updateTimeout);
          observers.creature.updateTimeout = null;
          return;
        }
        
        // Temporarily disconnect observer to prevent infinite loop
        if (observers.creature) {
          observers.creature.disconnect();
        }
        
        // Use requestIdleCallback for non-critical cosmetic updates (with fallback)
        const scheduleUpdate = window.requestIdleCallback || requestAnimationFrame;
        
        // Store the callback ID for cleanup
        pendingAsyncCallbacks.creatureObserver = scheduleUpdate(() => {
          // Clear the reference when it runs
          pendingAsyncCallbacks.creatureObserver = null;
          
          // Re-apply max creatures styling if enabled
          if (config.enableMaxCreatures) {
            applyMaxCreatures();
          }

          if (config.enableSealed) {
            applySealedCreatures();
          }
          
          // Re-apply max shinies styling if enabled
          if (config.enableMaxShinies) {
            applyMaxShinies();
          }
          
          // Re-apply shiny enemies if enabled
          if (config.enableShinyEnemies) {
            applyShinyEnemies();
          }

          if (isCreatureHoverTooltipEnabled()) {
            applyAdvancedStatsOnHover();
          }
          
          window.depotManager?.notifyFavoriteGridRefresh?.('creature');
          
          // Reconnect observer
          if (observers.creature && creatureContainer) {
            observers.creature.observe(creatureContainer, {
              childList: true,
              subtree: true
            });
          }
        }, { timeout: 1000 }); // Fallback timeout for requestIdleCallback
        
        // Clean up the timeout reference
        activeTimeouts.delete(observers.creature.updateTimeout);
        observers.creature.updateTimeout = null;
      }, TIMEOUT_DELAYS.CONTAINER_DEBOUNCE);
      activeTimeouts.add(observers.creature.updateTimeout);
    }
  });
  
  // Start observing (only childList changes, no attributes)
  observers.creature.observe(creatureContainer, {
    childList: true,
    subtree: true
  });
  
  console.log('[Mod Settings] Creature container observer started');
}

/**
 * Bestiary search often toggles visibility without childList mutations, so max creatures / shinies /
 * hover never refresh. Mirror Depot Manager: debounce reapply on search input + focusout.
 */
function scheduleInventoryCosmeticsAfterBestiarySearch() {
  if (bestiarySearchStylePendingTimeout !== null) {
    clearTimeout(bestiarySearchStylePendingTimeout);
    activeTimeouts.delete(bestiarySearchStylePendingTimeout);
  }
  bestiarySearchStylePendingTimeout = setTimeout(() => {
    bestiarySearchStylePendingTimeout = null;
    if (isBlockedByAnalysisMods()) return;
    if (config.enableMaxCreatures) applyMaxCreatures();
    if (config.enableSealed) applySealedCreatures();
    if (config.enableMaxShinies) applyMaxShinies();
    if (isCreatureHoverTooltipEnabled()) applyAdvancedStatsOnHover();
  }, TIMEOUT_DELAYS.CONTAINER_DEBOUNCE);
  activeTimeouts.add(bestiarySearchStylePendingTimeout);
}

function onBestiarySearchInputForCosmetics(event) {
  if (event.target?.id !== BESTIARY_SEARCH_INPUT_ID) return;
  scheduleInventoryCosmeticsAfterBestiarySearch();
}

function startMonsterBestiarySearchCosmeticsListener() {
  if (bestiarySearchStyleListeners) return;
  bestiarySearchStyleListeners = {
    input: onBestiarySearchInputForCosmetics,
    focusout: onBestiarySearchInputForCosmetics
  };
  document.addEventListener('input', bestiarySearchStyleListeners.input, true);
  document.addEventListener('focusout', bestiarySearchStyleListeners.focusout, true);
}

function stopMonsterBestiarySearchCosmeticsListener() {
  if (!bestiarySearchStyleListeners) return;
  document.removeEventListener('input', bestiarySearchStyleListeners.input, true);
  document.removeEventListener('focusout', bestiarySearchStyleListeners.focusout, true);
  bestiarySearchStyleListeners = null;
  if (bestiarySearchStylePendingTimeout !== null) {
    clearTimeout(bestiarySearchStylePendingTimeout);
    activeTimeouts.delete(bestiarySearchStylePendingTimeout);
    bestiarySearchStylePendingTimeout = null;
  }
}

// Start observer for scroll lock state changes
function initScrollLockObserver() {
  // Track previous scroll lock state
  let previouslyLocked = isScrollLocked();
  let scrollUnlockDebounce = null;
  
  observers.scrollLock = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-scroll-locked') {
        const currentlyLocked = isScrollLocked();
        
        // Detect transition from locked to unlocked (attribute is removed when unlocked)
        if (previouslyLocked && !currentlyLocked) {
          // Clear any pending update
          if (scrollUnlockDebounce) {
            clearTimeout(scrollUnlockDebounce);
            activeTimeouts.delete(scrollUnlockDebounce);
          }
          
          // Debounce the update to handle multiple rapid unlock events
          scrollUnlockDebounce = scheduleTimeout(() => {
            // Re-apply all enabled features
            if (config.enableMaxCreatures) {
              applyMaxCreatures();
            }

            if (config.enableSealed) {
              applySealedCreatures();
            }
            
            if (config.enableMaxShinies) {
              applyMaxShinies();
            }
            
            if (config.enableShinyEnemies) {
              applyShinyEnemies();
            }

            if (isCreatureHoverTooltipEnabled()) {
              applyAdvancedStatsOnHover();
            }
            
            window.depotManager?.notifyFavoriteGridRefresh?.('scroll');
            
            scrollUnlockDebounce = null;
          }, GLOBAL_UPDATE_DEBOUNCE);
        }
        
        previouslyLocked = currentlyLocked;
      }
    });
  });
  
  // Observe document.body for data-scroll-locked attribute changes
  observers.scrollLock.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-scroll-locked']
  });
  
  console.log('[Mod Settings] Scroll lock observer started');
}

// Start observer for battle board changes (for shiny enemies)
let battleBoardObserver = null;
let boardStateUnsubscribe = null;

function startBattleBoardObserver() {
  if (!config.enableShinyEnemies) return;
  
  console.log('[Mod Settings] Starting battle board observer...');
  
  // Disconnect existing observer if any
  if (battleBoardObserver) {
    battleBoardObserver.disconnect();
  }
  
  // Unsubscribe from existing board state listeners to prevent duplicates
  if (boardStateUnsubscribe) {
    try {
      boardStateUnsubscribe();
      boardStateUnsubscribe = null;
    } catch (error) {
      console.warn('[Mod Settings] Error unsubscribing previous board state listeners:', error);
    }
  }
  
  let shinyUpdateDebounce = null;
  let attributeChangeDebounce = null;
  
  const processBattleMutations = (mutations) => {
    // Skip if Board Analyzer or Autoscroller is running
    if (window.ModCoordination?.isModActive('Board Analyzer') || window.ModCoordination?.isModActive('Autoscroller')) {
      return;
    }
    
    let spritesChanged = false;
    let attributesChanged = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Track removed nodes for sprite change detection
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const spriteImg = node.querySelector?.('img.spritesheet[data-shiny="true"]');
            if (spriteImg) {
              spritesChanged = true;
            }
          }
        });
        
        // Check if any added nodes contain actor sprites
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            // Check if node has data-name attribute (battle creature container)
            const isCreatureContainer = node.getAttribute && node.getAttribute('data-name');
            
            // Also check if node contains a container with data-name (nested)
            const nestedContainer = node.querySelector ? node.querySelector('[data-name]') : null;
            
            if (isCreatureContainer || nestedContainer) {
              const containerNode = isCreatureContainer ? node : nestedContainer;
              const creatureName = containerNode.getAttribute('data-name');
              
              // Wait for sprite to be added (they're added asynchronously)
              const checkForSprite = (attempts = 0) => {
                const spriteImg = containerNode.querySelector('img.spritesheet[data-shiny]');
                
                if (spriteImg) {
                  // Skip sprites inside modals/dialogs (e.g., Bestiary)
                  if (spriteImg.closest('[role="dialog"]')) {
                    return;
                  }
                  
                  const dataShiny = spriteImg.getAttribute('data-shiny');
                  const spriteContainer = spriteImg.closest('.sprite');
                  const spriteId = spriteContainer ? parseInt(extractSpriteIdFromClasses(spriteContainer), 10) : null;
                  
                  if (shouldSkipShinyEnemy(creatureName)) {
                    return;
                  }
                  
                  // Check if this sprite belongs to an enemy by checking boardConfig
                  const boardConfig = globalThis.state?.board?.getSnapshot()?.context?.boardConfig;
                  let isEnemy = false;
                  
                  if (boardConfig && spriteId) {
                    isEnemy = boardConfig.some(entity => {
                      if (!entity.villain) return false;
                      const entitySpriteId = getSpriteIdForEnemy(entity);
                      return entitySpriteId === spriteId;
                    });
                  }
                  
                  if (isEnemy && dataShiny === 'false' && !shouldSkipShinyEnemy(creatureName)) {
                    spriteImg.setAttribute('data-shiny', 'true');
                  } else if (!isEnemy) {
                    // NOT in boardConfig as enemy - check if it's a visual summon by health bar
                    const isVisualEnemy = isEnemyByHealthBar(containerNode);
                    
                    if (isVisualEnemy && dataShiny === 'false' && !shouldSkipShinyEnemy(creatureName)) {
                      spriteImg.setAttribute('data-shiny', 'true');
                    }
                  }
                  
                  spritesChanged = true;
                } else if (attempts < 3) {
                  // Sprite not found yet - retry after delay
                  setTimeout(() => checkForSprite(attempts + 1), 50);
                }
              };
              
              // Start checking for sprite
              checkForSprite();
            }
            // Also check if it's a sprite or contains sprites (for other battle updates)
            else if (node.matches && (node.matches('.sprite.outfit') || node.matches('.sprite.item') || node.matches('img.spritesheet'))) {
              spritesChanged = true;
            } else if (node.querySelectorAll) {
              const sprites = node.querySelectorAll('.sprite.outfit, .sprite.item, img.spritesheet');
              if (sprites.length > 0) {
                spritesChanged = true;
              }
            }
          }
        });
      } else if (mutation.type === 'attributes' && mutation.attributeName === 'data-shiny') {
        // Detect when data-shiny attribute changes from true to false
        const target = mutation.target;
        const oldValue = mutation.oldAttributeValue;
        const newValue = target.getAttribute('data-shiny');
        
        if (oldValue === 'true' && newValue === 'false') {
          // Skip sprites inside modals/dialogs (e.g., Bestiary) - even during transformations
          if (target.closest('[role="dialog"]')) {
            return;
          }
          
          // Find the sprite outfit to get creature info
          const spriteOutfit = target.closest('.sprite.outfit');
          const classList = spriteOutfit ? Array.from(spriteOutfit.classList) : [];
          const idClass = classList.find(cls => cls.startsWith('id-'));
          const spriteId = idClass ? parseInt(idClass.replace('id-', ''), 10) : null;
          
          if (!spriteId) return;
          
          // Check if this sprite belongs to an enemy (villain)
          const boardConfig = globalThis.state?.board?.getSnapshot()?.context?.boardConfig;
          if (boardConfig) {
            // Find the enemy entity that matches this spriteId
            let matchedEnemy = null;
            for (const entity of boardConfig) {
              if (!entity.villain) continue;
              
              // Get spriteId from monster metadata
              let entitySpriteId = entity.gameId;
              if (globalThis.state?.utils?.getMonster) {
                const monster = globalThis.state.utils.getMonster(entity.gameId);
                if (monster?.metadata?.spriteId) {
                  entitySpriteId = monster.metadata.spriteId;
                }
              }
              
              if (entitySpriteId === spriteId) {
                matchedEnemy = entity;
                break;
              }
            }
            
            if (matchedEnemy) {
              let creatureName = null;
              
              if (globalThis.state?.utils?.getMonster) {
                const monster = globalThis.state.utils.getMonster(matchedEnemy.gameId);
                creatureName = monster?.metadata?.name;
              }
              
              if (!shouldSkipShinyEnemy(creatureName)) {
                // Re-apply shiny immediately to enemy
                target.setAttribute('data-shiny', 'true');
                attributesChanged = true;
              }
            }
          }
        }
      }
    }
    
    // Handle attribute changes with minimal delay (fast re-injection)
    if (attributesChanged) {
      if (attributeChangeDebounce) {
        clearTimeout(attributeChangeDebounce);
        activeTimeouts.delete(attributeChangeDebounce);
      }
      
      attributeChangeDebounce = scheduleTimeout(() => {
        applyShinyEnemies();
        attributeChangeDebounce = null;
      }, 20); // Fast 20ms for attribute changes
    }
    
    // Handle sprite/DOM changes with longer delay (batch new summons)
    if (spritesChanged && !attributesChanged) {
      if (shinyUpdateDebounce) {
        clearTimeout(shinyUpdateDebounce);
        activeTimeouts.delete(shinyUpdateDebounce);
      }
      
      shinyUpdateDebounce = scheduleTimeout(() => {
        const scheduleUpdate = window.requestIdleCallback || requestAnimationFrame;
        
        // Store the callback ID for cleanup
        pendingAsyncCallbacks.battleBoardObserver = scheduleUpdate(() => {
          // Clear the reference when it runs
          pendingAsyncCallbacks.battleBoardObserver = null;
          
          applyShinyEnemies();
        }, { timeout: 500 });
        shinyUpdateDebounce = null;
      }, 100); // Reduced from 200ms to 100ms
    }
  };
  
  battleBoardObserver = createThrottledObserver(processBattleMutations, 100);
  
  // Observe the entire document body for changes
  battleBoardObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-shiny'],
    attributeOldValue: true
  });
  
  console.log('[Mod Settings] Battle board observer started');
  
  // Variables to store unsubscribe functions
  let newGameUnsubscribe, endGameUnsubscribe, autoSetupUnsubscribe, boardConfigUnsubscribe;
  
  // Listen for board state changes (new games, game end, and auto-setup)
  if (globalThis.state?.board?.on) {
    try {
      newGameUnsubscribe = globalThis.state.board.on('emitNewGame', (event) => {
        if (window.ModCoordination?.isModActive('Board Analyzer') || window.ModCoordination?.isModActive('Autoscroller')) return;
        console.log('[Mod Settings] New game started, re-applying shiny enemies...');
        scheduleTimeout(() => {
          applyShinyEnemies();
        }, 100);
      });
      
      // Listen for game end event
      endGameUnsubscribe = globalThis.state.board.on('emitEndGame', (event) => {
        if (window.ModCoordination?.isModActive('Board Analyzer') || window.ModCoordination?.isModActive('Autoscroller')) return;
        console.log('[Mod Settings] Game ended, re-applying shiny enemies...');
        scheduleTimeout(() => {
          applyShinyEnemies();
        }, 100);
      });
      
      // Listen for auto-setup board event
      autoSetupUnsubscribe = globalThis.state.board.on('autoSetupBoard', (event) => {
        if (window.ModCoordination?.isModActive('Board Analyzer') || window.ModCoordination?.isModActive('Autoscroller')) return;
        console.log('[Mod Settings] Auto-setup detected, re-applying shiny enemies...');
        scheduleTimeout(() => {
          applyShinyEnemies();
        }, 150);
      });
      
      console.log('[Mod Settings] Board state listeners added');
    } catch (error) {
      console.error('[Mod Settings] Error setting up board state listeners:', error);
    }
  }
  
  // Subscribe to boardConfig changes to catch dynamically summoned enemies
  if (globalThis.state?.board?.subscribe) {
    try {
      let lastEnemyCount = 0;
      
      boardConfigUnsubscribe = globalThis.state.board.subscribe((state) => {
        if (window.ModCoordination?.isModActive('Board Analyzer') || window.ModCoordination?.isModActive('Autoscroller')) return;
        
        const boardConfig = state.context?.boardConfig;
        if (!boardConfig || !Array.isArray(boardConfig)) return;
        
        const enemies = boardConfig.filter(entity => entity.villain === true);
        const currentEnemyCount = enemies.length;
        
        // Detect when new enemies are added (e.g., summoned by Trolls or Orc Riders)
        if (currentEnemyCount > lastEnemyCount && lastEnemyCount > 0) {
          scheduleTimeout(() => {
            applyShinyEnemies();
          }, 20);
        }
        
        lastEnemyCount = currentEnemyCount;
      });
      
      console.log('[Mod Settings] Board config subscription added for summoned enemies');
    } catch (error) {
      console.error('[Mod Settings] Error setting up board config subscription:', error);
    }
  }
  
  // Store all unsubscribe functions
  boardStateUnsubscribe = () => {
    if (typeof newGameUnsubscribe === 'function') newGameUnsubscribe();
    if (typeof endGameUnsubscribe === 'function') endGameUnsubscribe();
    if (typeof autoSetupUnsubscribe === 'function') autoSetupUnsubscribe();
    if (typeof boardConfigUnsubscribe === 'function') boardConfigUnsubscribe();
  };
}

function stopBattleBoardObserver() {
  try {
    if (battleBoardObserver) {
      battleBoardObserver.disconnect();
      battleBoardObserver = null;
      console.log('[Mod Settings] Battle board observer stopped');
    }
    
    if (boardStateUnsubscribe) {
      boardStateUnsubscribe();
      boardStateUnsubscribe = null;
      console.log('[Mod Settings] Board state listener removed');
    }
  } catch (error) {
    console.error('[Mod Settings] Error stopping battle board observer:', error);
  }
}

// =======================
// 13. Autoplay Refresh Monitor
// =======================

// Parse autoplay time from text content (supports English and Portuguese)
function parseAutoplayTime(textContent) {
  // Build regex pattern using translation strings for both languages
  const enText = "Autoplay session";
  const ptText = "Sessão autoplay";
  // Match both mm:ss and hh:mm:ss formats
  const pattern = new RegExp(`(?:${enText}|${ptText}) \\((\\d+):(\\d+)(?::(\\d+))?\\)`);
  
  const match = textContent.match(pattern);
  if (match) {
    // If third group exists, it's hh:mm:ss format
    if (match[3] !== undefined) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const seconds = parseInt(match[3]);
      return (hours * 60) + minutes + (seconds / 60);
    } else {
      // Otherwise it's mm:ss format
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      return minutes + (seconds / 60);
    }
  }
  return null;
}

// Board inactivity tracking variables
let lastBoardActivityTime = Date.now();
let boardInactivityTimer = null;

// Internal timer tracking for refresh monitor (independent of autoplay session time)
let internalTimerStartTime = null;

// Periodic check interval for refresh monitor
let autoplayRefreshCheckInterval = null;

// Track last logged shiny enemies result to prevent duplicate logs
let lastShinyEnemiesLogResult = null;

// Reset board activity timer when board state changes
function resetBoardActivityTimer() {
  lastBoardActivityTime = Date.now();
}

// Reset internal timer when a new game starts
function resetInternalTimer() {
  internalTimerStartTime = Date.now();
  console.log('[Mod Settings] Internal timer reset');
}

// Get the autoplay session timer from the DOM
function getAutoplaySessionTime() {
  try {
    // Look for the autoplay session button directly
    const autoplayButton = document.querySelector('button.widget-top-text img[alt="Autoplay"]');
    if (autoplayButton) {
      const button = autoplayButton.closest('button');
      if (button) {
        const time = parseAutoplayTime(button.textContent);
        if (time !== null) return time;
      }
    }
    
    // Fallback: Look for the autoplay session button in the widget-top area
    const autoplaySessions = document.querySelectorAll('div[data-autosetup]');
    for (const session of autoplaySessions) {
      const widgetTop = session.querySelector('.widget-top');
      if (widgetTop) {
        const time = parseAutoplayTime(widgetTop.textContent);
        if (time !== null) return time;
      }
    }
    return 0;
  } catch (error) {
    console.error('[Mod Settings] Error getting autoplay session time:', error);
    return 0;
  }
}

// Start monitoring the autoplay session timer
function startAutoplayRefreshMonitor() {
  try {
    console.log('[Mod Settings] Starting autoplay refresh monitor');
    
    // Clear any existing monitoring
    stopAutoplayRefreshMonitor();
    
    // Check if game state is available
    if (!globalThis.state) {
      console.log('[Mod Settings] Game state not available, cannot start autoplay refresh monitor');
      return;
    }
    
    console.log('[Mod Settings] Game state available:', !!globalThis.state);
    console.log('[Mod Settings] Board state available:', !!globalThis.state.board);
    console.log('[Mod Settings] Game timer available:', !!globalThis.state.gameTimer);
    
    // Listen for new game events to start monitoring autoplay session
    if (globalThis.state.board) {
      // Listen for newGame event as documented in game_state_api.md
      subscriptions.autoplayRefreshGame = globalThis.state.board.on('newGame', (event) => {
        if (isBlockedByAnalysisMods()) return;

        console.log('[Mod Settings] New game event:', event);
        
        // Reset board activity timer on new game
        resetBoardActivityTimer();
        
        // Reset internal timer on new game if using internal timer mode or both mode
        const timerMode = config.autoplayRefreshTimerMode || (config.useInternalTimer ? 'internal' : 'autoplay');
        if (timerMode === 'internal' || timerMode === 'both') {
          resetInternalTimer();
        }
        
        // Check autoplay session timer and refresh if needed on each new game
        checkAutoplayRefreshThreshold();
        
        // Check if Hunt Analyzer should be opened (with a small delay to ensure button is created)
        scheduleTimeout(() => {
          checkAndOpenHuntAnalyzer();
        }, 100);
      });
      
      // Also listen for setPlayMode when switching to autoplay
      subscriptions.autoplayRefreshSetPlayMode = globalThis.state.board.on('setPlayMode', (event) => {
        if (isBlockedByAnalysisMods()) return;

        console.log(`[Mod Settings] setPlayMode event - mode: ${event.mode}`);
        if (event.mode === 'autoplay') {
          console.log('[Mod Settings] Autoplay mode set - checking refresh threshold');
          // Reset internal timer when switching to autoplay if using internal timer mode or both mode
          const timerMode = config.autoplayRefreshTimerMode || (config.useInternalTimer ? 'internal' : 'autoplay');
          if (timerMode === 'internal' || timerMode === 'both') {
            resetInternalTimer();
          }
          checkAutoplayRefreshThreshold();
        }
      });
      
      // Subscribe to board state changes to track activity
      subscriptions.autoplayRefreshBoardState = globalThis.state.board.subscribe((state) => {
        if (isBlockedByAnalysisMods()) return;
        resetBoardActivityTimer();
      });
      
      console.log('[Mod Settings] Game event listeners set up for newGame, setPlayMode, and board state changes');
    }
    
    // Also check immediately if a game is already running
    if (globalThis.state.gameTimer) {
      const gameTimerState = globalThis.state.gameTimer.getSnapshot();
      console.log('[Mod Settings] Current game timer state:', gameTimerState.context.state);
      if (gameTimerState.context.state === 'playing') {
        console.log('[Mod Settings] Game already running, checking autoplay refresh threshold');
        checkAutoplayRefreshThreshold();
      }
    }
    
    // Initialize board activity timer
    resetBoardActivityTimer();
    
    // Initialize internal timer if using internal timer mode or both mode
    const timerMode = config.autoplayRefreshTimerMode || (config.useInternalTimer ? 'internal' : 'autoplay');
    if (timerMode === 'internal' || timerMode === 'both') {
      resetInternalTimer();
    }
    
    // Set up periodic check interval (check every 10 seconds)
    autoplayRefreshCheckInterval = setInterval(() => {
      checkAutoplayRefreshThreshold();
    }, 10000); // Check every 10 seconds
    
    console.log('[Mod Settings] Autoplay refresh monitor started - waiting for new game or monitoring current game');
    
    // Test the autoplay session timer detection
    const testTime = getAutoplaySessionTime();
    console.log(`[Mod Settings] Test autoplay session time: ${testTime.toFixed(1)} minutes`);
  } catch (error) {
    console.error('[Mod Settings] Error starting autoplay refresh monitor:', error);
  }
}

// Check if Hunt Analyzer should be opened and open it if needed
function checkAndOpenHuntAnalyzer() {
  try {
    if (!config.alwaysOpenHuntAnalyzer) {
      return;
    }
    
    // Check if Hunt Analyzer panel is already open
    const huntAnalyzerPanel = document.getElementById('mod-autoplay-analyzer-panel');
    if (huntAnalyzerPanel) {
      console.log('[Mod Settings] Hunt Analyzer is already open, skipping auto-open');
      return;
    }
    
    // Check if Hunt Analyzer button exists - try multiple selectors
    let huntAnalyzerButton = document.querySelector('[data-mod-id="mod-autoplay-button"]');
    if (!huntAnalyzerButton) {
      // Try alternative selector for the button
      huntAnalyzerButton = document.querySelector('button[title*="Hunt Analyzer"], button[title*="Analisador"]');
    }
    if (!huntAnalyzerButton) {
      // Try finding by text content
      const buttons = document.querySelectorAll('button');
      huntAnalyzerButton = Array.from(buttons).find(btn => 
        btn.textContent.includes('Hunt Analyzer') || 
        btn.textContent.includes('Analisador') ||
        btn.textContent.includes('Analyzer')
      );
    }
    if (!huntAnalyzerButton) {
      console.log('[Mod Settings] Hunt Analyzer button not found, cannot auto-open');
      // Debug: Log available buttons for troubleshooting
      const allButtons = document.querySelectorAll('button');
      console.log('[Mod Settings] Available buttons:', Array.from(allButtons).map(btn => ({
        text: btn.textContent,
        title: btn.title,
        id: btn.id,
        className: btn.className
      })));
      return;
    }
    
    // Open Hunt Analyzer by clicking the button
    console.log('[Mod Settings] Auto-opening Hunt Analyzer on new game');
    huntAnalyzerButton.click();
  } catch (error) {
    console.error('[Mod Settings] Error checking/opening Hunt Analyzer:', error);
  }
}

// Check autoplay session timer and refresh if needed
function checkAutoplayRefreshThreshold() {
  try {
    if (isBlockedByAnalysisMods()) return;

    let thresholdReached = false;
    let reason = '';
    
    // Get timer mode (backward compatibility)
    const timerMode = config.autoplayRefreshTimerMode || (config.useInternalTimer ? 'internal' : 'autoplay');
    
    if (timerMode === 'both') {
      // Combined mode - check both timers and refresh when whichever comes first
      if (internalTimerStartTime === null) {
        resetInternalTimer();
      }
      
      const internalMinutes = (Date.now() - internalTimerStartTime) / (1000 * 60);
      const sessionMinutes = getAutoplaySessionTime();
      const inactivityMinutes = (Date.now() - lastBoardActivityTime) / (1000 * 60);
      
      console.log(`[Mod Settings] Autoplay refresh check (both timers): internal=${internalMinutes.toFixed(1)}/${config.autoplayRefreshMinutes} minutes, session=${sessionMinutes.toFixed(1)}/${config.autoplayRefreshMinutes} minutes, inactivity=${inactivityMinutes.toFixed(1)}/${config.autoplayRefreshMinutes} minutes`);
      
      // Check internal timer threshold
      const internalThresholdReached = internalMinutes >= config.autoplayRefreshMinutes;
      
      // Check session time threshold
      const sessionThresholdReached = sessionMinutes > 0 && sessionMinutes >= config.autoplayRefreshMinutes;
      
      // Check board inactivity threshold
      const inactivityThresholdReached = inactivityMinutes >= config.autoplayRefreshMinutes;
      
      thresholdReached = internalThresholdReached || sessionThresholdReached || inactivityThresholdReached;
      
      if (internalThresholdReached) {
        reason = 'internal timer';
      } else if (sessionThresholdReached) {
        reason = 'session time';
      } else {
        reason = 'board inactivity';
      }
    } else if (timerMode === 'internal') {
      // Use internal timer mode - track time independently
      if (internalTimerStartTime === null) {
        // Initialize timer if not already set
        resetInternalTimer();
      }
      
      const internalMinutes = (Date.now() - internalTimerStartTime) / (1000 * 60);
      const inactivityMinutes = (Date.now() - lastBoardActivityTime) / (1000 * 60);
      
      console.log(`[Mod Settings] Autoplay refresh check (internal timer): internal=${internalMinutes.toFixed(1)}/${config.autoplayRefreshMinutes} minutes, inactivity=${inactivityMinutes.toFixed(1)}/${config.autoplayRefreshMinutes} minutes`);
      
      // Check internal timer threshold
      const internalThresholdReached = internalMinutes >= config.autoplayRefreshMinutes;
      
      // Check board inactivity threshold
      const inactivityThresholdReached = inactivityMinutes >= config.autoplayRefreshMinutes;
      
      thresholdReached = internalThresholdReached || inactivityThresholdReached;
      reason = internalThresholdReached ? 'internal timer' : 'board inactivity';
    } else {
      // Use autoplay session time mode (original behavior)
      const currentMinutes = getAutoplaySessionTime();
      const inactivityMinutes = (Date.now() - lastBoardActivityTime) / (1000 * 60);
      
      console.log(`[Mod Settings] Autoplay refresh check (session timer): session=${currentMinutes.toFixed(1)}/${config.autoplayRefreshMinutes} minutes, inactivity=${inactivityMinutes.toFixed(1)}/${config.autoplayRefreshMinutes} minutes`);
      
      // Check session time threshold
      const sessionThresholdReached = currentMinutes > 0 && currentMinutes >= config.autoplayRefreshMinutes;
      
      // Check board inactivity threshold
      const inactivityThresholdReached = inactivityMinutes >= config.autoplayRefreshMinutes;
      
      thresholdReached = sessionThresholdReached || inactivityThresholdReached;
      reason = sessionThresholdReached ? 'session time' : 'board inactivity';
    }
    
    if (thresholdReached) {
      console.log(`[Mod Settings] Autoplay refresh threshold reached (${reason}). Refreshing page in 1 second...`);
      
      // Wait 1 second before refreshing
      scheduleTimeout(() => {
        // Check if auto-reload is disabled
        if (config.disableAutoReload) {
          console.log('[Mod Settings] Auto-reload disabled - skipping autoplay refresh');
          return;
        }
        console.log('[Mod Settings] Refreshing browser...');
        location.reload();
      }, TIMEOUT_DELAYS.BROWSER_REFRESH);
    }
  } catch (error) {
    console.error('[Mod Settings] Error checking autoplay refresh threshold:', error);
  }
}

// Stop monitoring the autoplay session timer
function stopAutoplayRefreshMonitor() {
  try {
    if (subscriptions.autoplayRefreshGame && typeof subscriptions.autoplayRefreshGame === 'function') {
      subscriptions.autoplayRefreshGame();
      subscriptions.autoplayRefreshGame = null;
      console.log('[Mod Settings] Autoplay refresh game subscription stopped');
    }
    
    if (subscriptions.autoplayRefreshSetPlayMode && typeof subscriptions.autoplayRefreshSetPlayMode === 'function') {
      subscriptions.autoplayRefreshSetPlayMode();
      subscriptions.autoplayRefreshSetPlayMode = null;
      console.log('[Mod Settings] Autoplay refresh setPlayMode subscription stopped');
    }
    
    if (subscriptions.autoplayRefreshBoardState && typeof subscriptions.autoplayRefreshBoardState === 'function') {
      subscriptions.autoplayRefreshBoardState();
      subscriptions.autoplayRefreshBoardState = null;
      console.log('[Mod Settings] Autoplay refresh board state subscription stopped');
    }
    
    // Clear board inactivity timer
    if (boardInactivityTimer) {
      clearTimeout(boardInactivityTimer);
      boardInactivityTimer = null;
    }
    
    // Clear periodic check interval
    if (autoplayRefreshCheckInterval) {
      clearInterval(autoplayRefreshCheckInterval);
      autoplayRefreshCheckInterval = null;
    }
    
    // Clear internal timer
    internalTimerStartTime = null;
    
    console.log('[Mod Settings] Autoplay refresh monitor stopped');
  } catch (error) {
    console.error('[Mod Settings] Error stopping autoplay refresh monitor:', error);
  }
}

// Enable anti-idle sounds
function enableAntiIdleSounds() {
  try {
    // Clear any existing audio element
    disableAntiIdleSounds();
    
    const el = document.createElement("audio");
    document.body.append(el);
    el.loop = true;
    el.src = '/swoosh.mp3';
    
    const playPromise = el.play();
    antiIdlePlayPromise = playPromise;
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise
        .catch((error) => {
          // Expected when quickly re-initializing and pausing/removing the element.
          if (error?.name === 'AbortError') {
            console.log('[Mod Settings] Anti-idle sounds play interrupted during lifecycle change');
            return;
          }
          console.warn('[Mod Settings] Anti-idle sounds play failed (may require user interaction):', error);
        })
        .finally(() => {
          if (antiIdlePlayPromise === playPromise) {
            antiIdlePlayPromise = null;
          }
        });
    }
    
    antiIdleAudioElement = el;
    console.log('[Mod Settings] Anti-idle sounds enabled - tab should show speaker icon');
  } catch (error) {
    console.error('[Mod Settings] Error enabling anti-idle sounds:', error);
  }
}

// Disable anti-idle sounds
function disableAntiIdleSounds() {
  try {
    if (antiIdleAudioElement) {
      antiIdleAudioElement.pause();
      if (antiIdleAudioElement.parentNode) {
        antiIdleAudioElement.parentNode.removeChild(antiIdleAudioElement);
      }
      antiIdleAudioElement = null;
      console.log('[Mod Settings] Anti-idle sounds disabled');
    }
    antiIdlePlayPromise = null;
  } catch (error) {
    console.error('[Mod Settings] Error disabling anti-idle sounds:', error);
  }
}

// =======================
// 14. Playercount Functions
// =======================

function getPlayerOnlineHighscorePath() {
  return `${FIREBASE_RUNS_CONFIG.firebaseUrl}/player-online-highscore`;
}

function normalizePlayerOnlineHighscore(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const peak = Number(data.peak);
  if (!Number.isFinite(peak) || peak < 0) {
    return null;
  }
  const achievedAt = Number(data.achievedAt);
  return {
    peak: Math.floor(peak),
    achievedAt: Number.isFinite(achievedAt) && achievedAt > 0 ? achievedAt : null
  };
}

async function fetchPlayerOnlineHighscore() {
  try {
    const data = await FirebaseRunsService.get(
      getPlayerOnlineHighscorePath(),
      'fetch player online highscore',
      null
    );
    playercountState.onlineRecordFetchSucceeded = true;
    const normalized = normalizePlayerOnlineHighscore(data);
    if (normalized) {
      playercountState.onlineRecord = normalized;
    }
    return normalized;
  } catch (error) {
    playercountState.onlineRecordFetchSucceeded = false;
    console.error('[Mod Settings] Error fetching player online highscore:', error);
    return playercountState.onlineRecord;
  }
}

async function updatePlayerOnlineHighscoreIfHigher(count) {
  if (!Number.isFinite(count) || count < 0) {
    return playercountState.onlineRecord;
  }

  const latestRecord = await fetchPlayerOnlineHighscore();
  const fetchSucceeded = playercountState.onlineRecordFetchSucceeded;
  if (!fetchSucceeded && latestRecord == null) {
    console.warn('[Mod Settings] Skipping player online highscore update because latest record could not be fetched');
    return playercountState.onlineRecord;
  }

  const newPeak = Math.max(count, latestRecord?.peak ?? 0);
  if (latestRecord && newPeak <= latestRecord.peak) {
    return latestRecord;
  }

  const now = Date.now();
  const nextRecord = { peak: Math.floor(newPeak), achievedAt: now };

  try {
    await FirebaseRunsService.put(
      getPlayerOnlineHighscorePath(),
      nextRecord,
      'update player online highscore'
    );
    playercountState.onlineRecord = nextRecord;
    console.log(`[Mod Settings] Player online highscore updated: ${nextRecord.peak}`);
    return nextRecord;
  } catch (error) {
    console.error('[Mod Settings] Error updating player online highscore:', error);
    return latestRecord;
  }
}

function shouldSyncPlayerOnlineHighscore(count) {
  if (!Number.isFinite(count) || count < 0) {
    return false;
  }
  const cachedPeak = playercountState.onlineRecord?.peak;
  if (cachedPeak == null || !Number.isFinite(cachedPeak)) {
    return true;
  }
  return count >= cachedPeak;
}

async function syncPlayerOnlineHighscore(count) {
  if (!shouldSyncPlayerOnlineHighscore(count)) {
    return playercountState.onlineRecord;
  }
  return updatePlayerOnlineHighscoreIfHigher(count);
}

async function fetchLivePlayerCount() {
  try {
    const response = await fetch("/api/player-count");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const countText = await response.text();
    const count = parseInt(countText, 10);

    if (isNaN(count)) {
      throw new Error('Invalid player count data received');
    }

    playercountState.currentPlayerCount = count;
    playercountState.lastUpdateTime = new Date();
    console.log(`[Mod Settings] Player count updated: ${count}`);
    return count;
  } catch (error) {
    console.error('[Mod Settings] Error fetching player count:', error);
    return null;
  }
}

function maybeShowPlayerOnlineRecordToast(count) {
  if (!playercountState.recordToastBaselineReady) {
    return;
  }
  if (!Number.isFinite(count) || count < 0) {
    return;
  }

  const knownPeak = playercountState.onlineRecord?.peak;
  if (knownPeak == null || !Number.isFinite(knownPeak) || count <= knownPeak) {
    return;
  }

  const now = Date.now();
  if (now - playercountState.lastRecordToastAt < PLAYER_ONLINE_RECORD_TOAST_COOLDOWN_MS) {
    return;
  }

  playercountState.lastRecordToastAt = now;
  playercountState.onlineRecord = {
    peak: Math.floor(count),
    achievedAt: now
  };

  try {
    createToast({
      message: `<span class="text-success">${tReplace('mods.betterUI.playerOnlineRecordToast', {
        record: formatPlayerOnlineRecordPeak(count)
      })}</span>`,
      type: 'success',
      duration: 5000
    });
  } catch (toastError) {
    console.warn('[Mod Settings] Could not show player online record toast:', toastError);
  }
}

async function runPlayerOnlineRecordCheck() {
  let count = playercountState.currentPlayerCount;
  if (count === null) {
    count = await fetchLivePlayerCount();
    if (count === null) {
      return;
    }
  }

  // Toast before sync so a successful write does not raise the local peak first.
  maybeShowPlayerOnlineRecordToast(count);
  await syncPlayerOnlineHighscore(count);
  updatePlayerCountDisplay(count);
}

function formatPlayerOnlineRecordPeak(peak) {
  return Number(peak).toLocaleString('en-US');
}

function formatPlayerOnlineRecordTimestamp(timestampMs) {
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    }).formatToParts(date).map(({ type, value }) => [type, value])
  );

  return `${parts.month} ${parts.day} ${parts.year}, ${parts.hour}:${parts.minute}:${parts.second} CET`;
}

function buildPlayerCountTooltip() {
  const record = playercountState.onlineRecord;
  if (!record || !Number.isFinite(record.peak)) {
    return '';
  }

  const when = record.achievedAt
    ? formatPlayerOnlineRecordTimestamp(record.achievedAt)
    : null;

  return tReplace('mods.betterUI.playerOnlineRecordTooltip', {
    record: formatPlayerOnlineRecordPeak(record.peak),
    when: when || t('mods.betterUI.playerOnlineRecordUnknownTime')
  });
}

function updatePlayerCountDisplay(count) {
  const playerCountBtn = document.querySelector('.playercount-header-btn');
  if (!playerCountBtn) return;

  if (count !== null) {
    playerCountBtn.innerHTML = `<span class="pixel-font-16 text-white animate-in fade-in">Online: <span class="text-ally/80">${count}</span></span>`;
    playerCountBtn.title = buildPlayerCountTooltip();
    playerCountBtn.style.color = 'inherit';
  } else {
    playerCountBtn.innerHTML = `<span class="pixel-font-16 text-white animate-in fade-in">Online: <span class="text-error">?</span></span>`;
    playerCountBtn.title = buildPlayerCountTooltip();
    playerCountBtn.style.color = 'inherit';
  }
}

function clearPlayerCountIntervals() {
  if (playercountState.updateInterval) {
    clearInterval(playercountState.updateInterval);
    activeTimeouts.delete(playercountState.updateInterval);
    playercountState.updateInterval = null;
  }
  if (playercountState.recordCheckInterval) {
    clearInterval(playercountState.recordCheckInterval);
    activeTimeouts.delete(playercountState.recordCheckInterval);
    playercountState.recordCheckInterval = null;
  }
}

// Start periodic updates
function startPlayerCountUpdates() {
  clearPlayerCountIntervals();
  playercountState.recordToastBaselineReady = false;
  playercountState.lastRecordToastAt = 0;

  fetchPlayerOnlineHighscore().finally(async () => {
    const count = await fetchLivePlayerCount();
    updatePlayerCountDisplay(count);
    if (count !== null) {
      await syncPlayerOnlineHighscore(count);
      updatePlayerCountDisplay(count);
    }
    // Enable toasts only after init so the first sync never notifies.
    playercountState.recordToastBaselineReady = true;
  });

  playercountState.updateInterval = setInterval(async () => {
    const count = await fetchLivePlayerCount();
    maybeShowPlayerOnlineRecordToast(count);
    updatePlayerCountDisplay(count);
  }, PLAYER_COUNT_POLL_MS);

  playercountState.recordCheckInterval = setInterval(() => {
    runPlayerOnlineRecordCheck();
  }, PLAYER_ONLINE_RECORD_CHECK_MS);

  activeTimeouts.add(playercountState.updateInterval);
  activeTimeouts.add(playercountState.recordCheckInterval);
}

// Remove Wiki and Discord links from header
function removeHeaderLinks() {
  const tryRemove = () => {
    const headerUl = document.querySelector('header ul.pixel-font-16.flex.items-center');
    if (!headerUl) {
      const timeoutId = setTimeout(tryRemove, 500);
      activeTimeouts.add(timeoutId);
      return;
    }
    
    // Remove Wiki link
    const wikiLi = Array.from(headerUl.children).find(
      el => el.querySelector('a') && el.querySelector('a').href && el.querySelector('a').href.includes('bestiaryarena.wiki.gg')
    );
    if (wikiLi) {
      safeRemoveElement(wikiLi);
      console.log('[Mod Settings] Wiki link removed from header');
    }
    
    // Remove Discord link
    const discordLi = Array.from(headerUl.children).find(
      el => el.querySelector('a') && el.querySelector('a').href && el.querySelector('a').href.includes('discord.gg')
    );
    if (discordLi) {
      safeRemoveElement(discordLi);
      console.log('[Mod Settings] Discord link removed from header');
    }
  };
  tryRemove();
}

// Add Playercount button to the header
function addPlayercountHeaderButton() {
  const tryInsert = () => {
    // Find the header <ul> by its class
    const headerUl = document.querySelector('header ul.pixel-font-16.flex.items-center');
    if (!headerUl) {
      const timeoutId = setTimeout(tryInsert, 500);
      activeTimeouts.add(timeoutId);
      return;
    }
    
    // Prevent duplicate button
    if (headerUl.querySelector('.playercount-header-btn')) {
      console.log('[Mod Settings] Playercount header button already exists, skipping insert.');
      return;
    }

    // Create the <li> and <span> (non-clickable)
    const li = document.createElement('li');
    const btn = document.createElement('span');
    btn.innerHTML = '<span class="pixel-font-16 text-white animate-in fade-in">Online: <span class="text-error">?</span></span>';
    btn.className = 'playercount-header-btn';
    btn.title = 'Loading player count...';
    
    li.appendChild(btn);

    // Insert after Challenges, else after Cyclopedia
    const challengesLi = Array.from(headerUl.children).find(
      el => el.querySelector('.challenges-header-btn')
    );
    const cyclopediaLi = Array.from(headerUl.children).find(
      el => el.querySelector('.cyclopedia-header-btn')
    );

    if (challengesLi) {
      if (challengesLi.nextSibling) {
        headerUl.insertBefore(li, challengesLi.nextSibling);
      } else {
        headerUl.appendChild(li);
      }
      console.log('[Mod Settings] Playercount header button inserted after Challenges.');
    } else if (cyclopediaLi) {
      if (cyclopediaLi.nextSibling) {
        headerUl.insertBefore(li, cyclopediaLi.nextSibling);
      } else {
        headerUl.appendChild(li);
      }
      console.log('[Mod Settings] Playercount header button inserted after Cyclopedia.');
    } else {
      // Fallback: Insert after Settings
      const settingsLi = Array.from(headerUl.children).find(
        el => el.querySelector('.mod-settings-header-btn')
      );
      if (settingsLi && settingsLi.nextSibling) {
        headerUl.insertBefore(li, settingsLi.nextSibling);
      } else {
        headerUl.appendChild(li);
      }
      console.log('[Mod Settings] Playercount header button inserted after Settings.');
    }
    
    // Start the periodic updates
    startPlayerCountUpdates();
  };
  tryInsert();
}

// =======================
// 15. Mod Coordination Priority Management
// =======================

const MOD_COORDINATION_STORAGE_KEY = 'mod-coordination-priorities';

// Load saved priority overrides from localStorage
function loadModPriorities() {
  try {
    const saved = localStorage.getItem(MOD_COORDINATION_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('[Mod Settings] Error loading mod priorities:', error);
    return {};
  }
}

// Save priority overrides to localStorage
function saveModPriorities(priorities) {
  try {
    localStorage.setItem(MOD_COORDINATION_STORAGE_KEY, JSON.stringify(priorities));
    console.log('[Mod Settings] Mod priorities saved:', priorities);
  } catch (error) {
    console.error('[Mod Settings] Error saving mod priorities:', error);
  }
}

// Load and display mod priorities in the UI
function loadAndDisplayModPriorities(container) {
  const listContainer = container.querySelector('#mod-coordination-list');
  if (!listContainer) return {};
  
  // Clear existing content (but preserve info text)
  const infoText = listContainer.querySelector('p');
  listContainer.innerHTML = '';
  
  // Get all registered mods from ModCoordination
  if (!window.ModCoordination) {
    listContainer.innerHTML = `<p style="color: #888; font-size: 13px;">${t('mods.betterUI.modCoordinationNotAvailable')}</p>`;
    return {};
  }
  
  const allMods = window.ModCoordination.getAllMods();
  if (allMods.length === 0) {
    listContainer.innerHTML = `<p style="color: #888; font-size: 13px;">${t('mods.betterUI.modCoordinationNoMods')}</p>`;
    return {};
  }
  
  // Load saved priorities
  const savedPriorities = loadModPriorities();
  
  // Map to store status spans for dynamic updates (modName -> statusSpan)
  const statusMap = {};
  
  // Create input for each mod
  allMods.forEach(mod => {
    const modRow = document.createElement('div');
    modRow.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.1);';
    
    // Mod name label
    const nameLabel = document.createElement('span');
    nameLabel.textContent = mod.name;
    nameLabel.style.cssText = 'flex: 1; color: #ccc; font-size: 12px; min-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    
    // Priority input
    const priorityInput = document.createElement('input');
    priorityInput.type = 'number';
    priorityInput.min = '0';
    priorityInput.max = '255';
    priorityInput.step = '1';
    const currentPriority = savedPriorities[mod.name] !== undefined ? savedPriorities[mod.name] : mod.priority;
    priorityInput.value = currentPriority;
    priorityInput.style.cssText = 'width: 50px; padding: 3px 4px; border: 1px solid #555; background: #2a2a2a; color: #fff; border-radius: 4px; text-align: center; font-size: 12px;';
    priorityInput.setAttribute('data-mod-name', mod.name);
    priorityInput.setAttribute('data-original-priority', mod.priority);
    priorityInput.setAttribute('data-current-priority', currentPriority);
    
    // Status indicator
    const statusSpan = document.createElement('span');
    statusSpan.style.cssText = 'font-size: 10px; color: #888; min-width: 70px; text-align: right;';
    updatePriorityStatus(statusSpan, mod, parseInt(priorityInput.value));
    
    // Store status span in map for dynamic updates
    statusMap[mod.name] = statusSpan;
    
    // Reset button (only show if priority is modified)
    const resetBtn = document.createElement('button');
    resetBtn.textContent = t('mods.betterUI.modCoordinationReset');
    resetBtn.style.cssText = 'padding: 2px 6px; font-size: 10px; background: #333; color: #ccc; border: 1px solid #555; border-radius: 3px; cursor: pointer; opacity: 0.7;';
    resetBtn.title = t('mods.betterUI.modCoordinationResetTooltip');
    if (currentPriority === mod.priority) {
      resetBtn.style.display = 'none';
    }
    
    // Handle input change
    priorityInput.addEventListener('change', () => {
      const newPriority = Math.max(0, Math.min(255, parseInt(priorityInput.value) || 0));
      priorityInput.value = newPriority;
      
      // Update ModCoordination
      if (window.ModCoordination) {
        const oldPriority = parseInt(priorityInput.getAttribute('data-current-priority') || currentPriority);
        const success = window.ModCoordination.updateModPriority(mod.name, newPriority);
        if (success) {
          console.log(`[Mod Settings] Updated priority for ${mod.name}: ${oldPriority} → ${newPriority}`);
          
          // Update the current priority attribute
          priorityInput.setAttribute('data-current-priority', newPriority);
          
          // Save to localStorage
          const updatedPriorities = loadModPriorities();
          const originalPriority = parseInt(priorityInput.getAttribute('data-original-priority'));
          if (newPriority === originalPriority) {
            delete updatedPriorities[mod.name];
          } else {
            updatedPriorities[mod.name] = newPriority;
          }
          saveModPriorities(updatedPriorities);
          
          // Update status and reset button visibility
          updatePriorityStatus(statusSpan, mod, newPriority);
          resetBtn.style.display = newPriority === originalPriority ? 'none' : 'block';
        } else {
          console.error(`[Mod Settings] Failed to update priority for ${mod.name}`);
          priorityInput.value = currentPriority; // Revert to current value
        }
      }
    });
    
    // Handle reset button
    resetBtn.addEventListener('click', () => {
      // Get the original priority from the mod's default (stored in data attribute)
      const originalPriority = parseInt(priorityInput.getAttribute('data-original-priority'));
      priorityInput.value = originalPriority;
      
      // Update ModCoordination
      if (window.ModCoordination) {
        const currentPriority = parseInt(priorityInput.getAttribute('data-current-priority') || priorityInput.value);
        const success = window.ModCoordination.updateModPriority(mod.name, originalPriority);
        if (success) {
          // Update the current priority attribute
          priorityInput.setAttribute('data-current-priority', originalPriority);
          
          // Remove from saved priorities
          const updatedPriorities = loadModPriorities();
          delete updatedPriorities[mod.name];
          saveModPriorities(updatedPriorities);
          
          // Update status and hide reset button
          updatePriorityStatus(statusSpan, mod, originalPriority);
          resetBtn.style.display = 'none';
          
          console.log(`[Mod Settings] Reset priority for ${mod.name}: ${currentPriority} → ${originalPriority}`);
        } else {
          console.error(`[Mod Settings] Failed to reset priority for ${mod.name}`);
        }
      }
    });
    
    modRow.appendChild(nameLabel);
    modRow.appendChild(priorityInput);
    modRow.appendChild(statusSpan);
    modRow.appendChild(resetBtn);
    
    listContainer.appendChild(modRow);
  });
  
  // Add info text at bottom
  const infoTextElement = document.createElement('p');
  infoTextElement.style.cssText = 'margin-top: 15px; color: #888; font-size: 12px; font-style: italic;';
  infoTextElement.textContent = t('mods.betterUI.modCoordinationChangesInfo');
  listContainer.appendChild(infoTextElement);
  
  // Add reset all button at bottom
  const resetAllContainer = document.createElement('div');
  resetAllContainer.style.cssText = 'margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);';
  
  const resetAllBtn = document.createElement('button');
  resetAllBtn.textContent = t('mods.betterUI.modCoordinationResetAll') || 'Reset All';
  resetAllBtn.style.cssText = 'padding: 6px 12px; font-size: 12px; background: #333; color: #ccc; border: 1px solid #555; border-radius: 4px; cursor: pointer; width: 100%; transition: transform 120ms ease, background-color 180ms ease, border-color 180ms ease, color 180ms ease, box-shadow 180ms ease;';
  resetAllBtn.title = t('mods.betterUI.modCoordinationResetAllTooltip') || 'Reset all mod priorities to their default values';
  const resetAllDefaultText = resetAllBtn.textContent;
  const resetAllDefaultStyle = {
    background: '#333',
    color: '#ccc',
    borderColor: '#555',
    boxShadow: 'none',
    transform: 'translateY(0)'
  };
  let resetAllFeedbackTimeout = null;
  
  resetAllBtn.addEventListener('click', () => {
    if (!window.ModCoordination) return;
    
    const allMods = window.ModCoordination.getAllMods();
    let resetCount = 0;
    
    // Reset each mod to its original priority
    allMods.forEach(mod => {
      const priorityInput = listContainer.querySelector(`input[data-mod-name="${mod.name}"]`);
      if (!priorityInput) return;
      
      const originalPriority = parseInt(priorityInput.getAttribute('data-original-priority'));
      const currentPriority = parseInt(priorityInput.getAttribute('data-current-priority') || priorityInput.value);
      
      // Only reset if it's been modified
      if (currentPriority !== originalPriority) {
        priorityInput.value = originalPriority;
        priorityInput.setAttribute('data-current-priority', originalPriority);
        
        // Update ModCoordination
        const success = window.ModCoordination.updateModPriority(mod.name, originalPriority);
        if (success) {
          resetCount++;
          
          // Update status and reset button visibility
          const statusSpan = statusMap[mod.name];
          if (statusSpan) {
            updatePriorityStatus(statusSpan, mod, originalPriority);
          }
          
          const resetBtn = priorityInput.parentElement.querySelector('button');
          if (resetBtn && resetBtn !== resetAllBtn) {
            resetBtn.style.display = 'none';
          }
        }
      }
    });
    
    // Clear saved priorities from localStorage
    if (resetCount > 0) {
      saveModPriorities({});
      console.log(`[Mod Settings] Reset ${resetCount} mod priority(ies) to default`);
      
      // Visual success feedback so users know their click worked.
      resetAllBtn.textContent = `\u2713 ${t('mods.betterUI.modCoordinationResetAll') || 'Reset All'} (${resetCount})`;
      resetAllBtn.style.background = '#14532d';
      resetAllBtn.style.color = '#dcfce7';
      resetAllBtn.style.borderColor = '#22c55e';
      resetAllBtn.style.boxShadow = '0 0 0 1px rgba(34,197,94,0.35), 0 0 10px rgba(34,197,94,0.25)';
    } else {
      console.log('[Mod Settings] No mod priorities to reset');
      resetAllBtn.textContent = t('mods.betterUI.modCoordinationNoChanges') || 'No changes';
      resetAllBtn.style.background = '#374151';
      resetAllBtn.style.color = '#e5e7eb';
      resetAllBtn.style.borderColor = '#6b7280';
      resetAllBtn.style.boxShadow = '0 0 0 1px rgba(156,163,175,0.25)';
    }
    
    // Press/click animation.
    resetAllBtn.style.transform = 'scale(0.97)';
    scheduleTimeout(() => {
      resetAllBtn.style.transform = 'translateY(0)';
    }, 120);
    
    // Restore default button look/text after a short delay.
    if (resetAllFeedbackTimeout) {
      clearTimeout(resetAllFeedbackTimeout);
    }
    resetAllFeedbackTimeout = scheduleTimeout(() => {
      resetAllBtn.textContent = resetAllDefaultText;
      resetAllBtn.style.background = resetAllDefaultStyle.background;
      resetAllBtn.style.color = resetAllDefaultStyle.color;
      resetAllBtn.style.borderColor = resetAllDefaultStyle.borderColor;
      resetAllBtn.style.boxShadow = resetAllDefaultStyle.boxShadow;
      resetAllBtn.style.transform = resetAllDefaultStyle.transform;
      resetAllFeedbackTimeout = null;
    }, 1200);
  });
  
  resetAllContainer.appendChild(resetAllBtn);
  listContainer.appendChild(resetAllContainer);
  
  // Return status map for dynamic updates
  return statusMap;
}

// Update priority status indicator
function updatePriorityStatus(statusSpan, mod, currentPriority) {
  const originalPriority = mod.priority;
  const isModified = currentPriority !== originalPriority;
  
  if (mod.active) {
    statusSpan.textContent = t('mods.betterUI.modCoordinationStatusActive');
    statusSpan.style.color = '#4ade80';
  } else if (mod.enabled) {
    statusSpan.textContent = t('mods.betterUI.modCoordinationStatusEnabled');
    statusSpan.style.color = '#60a5fa';
  } else {
    statusSpan.textContent = t('mods.betterUI.modCoordinationStatusDisabled');
    statusSpan.style.color = '#888';
  }
  
  if (isModified) {
    statusSpan.textContent += t('mods.betterUI.modCoordinationStatusModified');
    statusSpan.style.color = '#fbbf24';
  }
}

// =======================
// 16. Initialization
// =======================

function initBetterUI() {
  if (initState.inProgress) {
    console.log('[Mod Settings] Initialization already in progress, skipping duplicate call');
    return;
  }
  if (initState.initialized) {
    console.log('[Mod Settings] Already initialized, skipping duplicate call');
    return;
  }

  initState.inProgress = true;
  try {
    console.log('[Mod Settings] Starting initialization');
    
    const features = [
      { name: 'Stamina Timer', enabled: config.showStaminaTimer, init: initStaminaTimer },
      { name: 'Settings Button', enabled: config.showSettingsButton, init: createSettingsButton }
    ];
    
    features.forEach(feature => {
      if (feature.enabled) {
        console.log(`[Mod Settings] Initializing ${feature.name}`);
        feature.init();
      } else {
        console.log(`[Mod Settings] ${feature.name} disabled in config`);
      }
    });
    
    if (config.enableMaxCreatures || config.enableMaxShinies || config.enableSealed) {
      console.log('[Mod Settings] Applying creature cosmetic borders by priority');
      reapplyCreatureCosmeticPriority();
    }
    
    if (config.enableShinyEnemies) {
      console.log('[Mod Settings] Applying shiny enemies');
      startBattleBoardObserver();
      applyShinyEnemies();
    }

    if (isCreatureHoverTooltipEnabled()) {
      console.log('[Mod Settings] Applying creature hover tooltip');
      applyAdvancedStatsOnHover();
    }
    
    if (config.enableAutoplayRefresh) {
      console.log('[Mod Settings] Autoplay refresh enabled in config, starting monitor');
      startAutoplayRefreshMonitor();
    } else {
      console.log('[Mod Settings] Autoplay refresh disabled in config');
    }
    
    if (config.enableAntiIdleSounds) {
      console.log('[Mod Settings] Anti-idle sounds enabled in config, starting audio');
      enableAntiIdleSounds();
    } else {
      console.log('[Mod Settings] Anti-idle sounds disabled in config');
    }

    if (config.autoHideNonShinyNonAwakenedMonsters) {
      scheduleTimeout(() => {
        runAutoHideNonShinyAndNonAwakenedMonsters('init');
      }, 1200);
    }
    
    if (config.enablePlayercount) {
      console.log('[Mod Settings] Playercount enabled in config, initializing');
      removeHeaderLinks();
      addPlayercountHeaderButton();
    } else {
      console.log('[Mod Settings] Playercount disabled in config');
    }
    
    initTabObserver();
    startCreatureContainerObserver();
    startMonsterBestiarySearchCosmeticsListener();
    initScrollLockObserver();
    
    // Apply initial setup labels visibility and start observer
    scheduleTimeout(() => {
      applySetupLabelsVisibility(config.showSetupLabels);
      observers.setupLabels = startSetupLabelsObserver();
      console.log('[Mod Settings] Setup labels visibility applied:', config.showSetupLabels);
    }, 1000); // Delay to ensure DOM is ready

    // Subscribe once for map-dependent features
    if (config.showLastVisitedMapButton || config.alwaysNavigateMaxFloor) {
      scheduleTimeout(() => {
        installReplayFloorGuardHook();
        subscribeToMapChanges();
        if (config.showLastVisitedMapButton) {
          loadLastVisitedMap();
          addLastMapNavButton();
          console.log('[Mod Settings] Last visited map button enabled');
        }
        if (config.alwaysNavigateMaxFloor) {
          applyBestCompletedFloorForCurrentMap('init');
        }
      }, 2000); // Delay to ensure navigation bar is loaded
    }
    
    // Apply compact nav bar if enabled and start observer
    if (config.compactNavBar) {
      scheduleTimeout(() => {
        applyCompactNavBar();
        observers.compactNavBar = startCompactNavBarObserver();
        console.log('[Mod Settings] Compact nav bar applied:', config.compactNavBar);
      }, 1000); // Delay to ensure DOM is ready
    } else {
      // Start observer even if disabled, so it can react if enabled later
      scheduleTimeout(() => {
        observers.compactNavBar = startCompactNavBarObserver();
      }, 1000);
    }
    
    // Hide website footer if enabled
    if (config.removeWebsiteFooter) {
      scheduleTimeout(() => {
        hideWebsiteFooter();
      }, 1000); // Delay to ensure DOM is ready
    }

    scheduleTimeout(() => {
      applyAutoplaySessionCheckboxFeatures();
      observers.autoplaySessionCheckboxes = startAutoplaySessionCheckboxObserver();
    }, 1000);

    applyPersistentInventory();
    applyInventoryColumnsStyle();
    observers.inventoryModButtons = startInventoryModButtonsObserver();
    scheduleTimeout(() => {
      refreshModBarButtonLabels();
    }, 500);

    initHotkeys();
    
    console.log('[Mod Settings] Initialization completed');
    
    // Check if Hunt Analyzer should be opened on initialization
    scheduleTimeout(() => {
      checkAndOpenHuntAnalyzer();
    }, 500); // Small delay to ensure all mods are loaded
    initState.initialized = true;
  } catch (error) {
    console.error('[Mod Settings] Initialization error:', error);
  } finally {
    initState.inProgress = false;
  }
}

// Initialize the mod immediately
initBetterUI();

// Expose config globally for other mods to access
window.betterUIConfig = config;

// =======================
// 16. Cleanup
// =======================

function cleanupBetterUI() {
  console.log('[Mod Settings] Cleanup called');
  try {
    const openModal = modSettingsModalInstance;
    if (openModal && typeof openModal.close === 'function') {
      try {
        openModal.close();
      } catch (_) { /* ignore */ }
    } else {
      teardownSettingsModal();
    }
    stopAutoUploadMonitor();

    if (powerSavingRestoreDebounceTimer) {
      clearTimeout(powerSavingRestoreDebounceTimer);
      powerSavingRestoreDebounceTimer = null;
    }
    if (autoplaySessionFeaturesDebounceTimer) {
      clearTimeout(autoplaySessionFeaturesDebounceTimer);
      autoplaySessionFeaturesDebounceTimer = null;
    }
    if (powerSavingStateObserver) {
      try {
        powerSavingStateObserver.disconnect();
      } catch (_) { /* ignore */ }
      powerSavingStateObserver = null;
      powerSavingObservedButton = null;
    }
    stopPowerSavingSessionListener();
    stopPersistentPowersaverLabelTextObserver();
    cancelPendingPowerSavingOverlayRestore();

    // Cancel pending async callbacks
    const cancelIdleCallback = window.cancelIdleCallback || cancelAnimationFrame;
    if (pendingAsyncCallbacks.creatureObserver) {
      try {
        cancelIdleCallback(pendingAsyncCallbacks.creatureObserver);
        pendingAsyncCallbacks.creatureObserver = null;
        console.log('[Mod Settings] Creature observer callback cancelled');
      } catch (error) {
        console.warn('[Mod Settings] Error canceling creature observer callback:', error);
      }
    }
    if (pendingAsyncCallbacks.battleBoardObserver) {
      try {
        cancelIdleCallback(pendingAsyncCallbacks.battleBoardObserver);
        pendingAsyncCallbacks.battleBoardObserver = null;
        console.log('[Mod Settings] Battle board observer callback cancelled');
      } catch (error) {
        console.warn('[Mod Settings] Error canceling battle board observer callback:', error);
      }
    }
    
    activeTimeouts.forEach(timeoutId => {
      try {
        clearTimeout(timeoutId);
        clearInterval(timeoutId);
      } catch (error) {
        console.warn('[Mod Settings] Error clearing timeout/interval:', error);
      }
    });
    activeTimeouts.clear();
    
    if (timerState.updateThrottle) {
      clearTimeout(timerState.updateThrottle);
      timerState.updateThrottle = null;
    }
    
    observers.stamina = disconnectObserver(observers.stamina, 'Stamina');
    observers.tab = disconnectObserver(observers.tab, 'Tab');
    observers.creature = disconnectObserver(observers.creature, 'Creature container');
    observers.setupLabels = disconnectObserver(observers.setupLabels, 'Setup labels');
    observers.scrollLock = disconnectObserver(observers.scrollLock, 'Scroll lock');
    observers.compactNavBar = disconnectObserver(observers.compactNavBar, 'Compact nav bar');
    observers.autoplaySessionCheckboxes = disconnectObserver(
      observers.autoplaySessionCheckboxes,
      'Autoplay session checkboxes'
    );
    observers.inventoryModButtons = disconnectObserver(observers.inventoryModButtons, 'Inventory mod buttons');
    clearInventoryColumnsStyle();
    stopPersistentInventoryObserver();
    inventoryModButtonsState.missingRetryCount.clear();
    inventoryModButtonsState.knownClasses.clear();
    stopMonsterBestiarySearchCosmeticsListener();
    battleBoardObserver = disconnectObserver(battleBoardObserver, 'Battle board');
    
    // Unsubscribe from board state events
    if (boardStateUnsubscribe) {
      try {
        boardStateUnsubscribe();
        console.log('[Mod Settings] Board state listeners unsubscribed');
      } catch (error) {
        console.warn('[Mod Settings] Error unsubscribing board state listeners:', error);
      }
      boardStateUnsubscribe = null;
    }
    
    stopAutoplayRefreshMonitor();
    disableAntiIdleSounds();
    unsubscribeFromMapChanges();
    removeLastMapNavButton();
    cleanupHotkeys();
    
    // Cleanup playercount
    clearPlayerCountIntervals();
    const playercountBtn = document.querySelector('.playercount-header-btn');
    if (playercountBtn && playercountBtn.parentNode) {
      try {
        playercountBtn.parentNode.remove();
        console.log('[Mod Settings] Playercount button removed');
      } catch (error) {
        console.warn('[Mod Settings] Error removing playercount button:', error);
      }
    }
    
    // Clean up toast container
    const toastContainer = document.getElementById('better-ui-toast-container');
    if (toastContainer && toastContainer.parentNode) {
      toastContainer.parentNode.removeChild(toastContainer);
    }
    
    // Clean up any remaining modals
    try {
      document.querySelectorAll('[role="dialog"][data-state="open"]').forEach(modal => {
        safeRemoveElement(modal);
      });
      document.querySelectorAll('.modal-bg, .modal-overlay').forEach(el => {
        safeRemoveElement(el);
      });
      console.log('[Mod Settings] Remaining modals cleaned up');
    } catch (error) {
      console.warn('[Mod Settings] Error cleaning up modals:', error);
    }
    
    if (timerState.element && timerState.element.parentNode) {
      try {
        timerState.element.parentNode.removeChild(timerState.element);
      } catch (error) {
        console.warn('[Mod Settings] Error removing stamina timer:', error);
      }
    }
    timerState.element = null;
    
    if (uiState.settingsButton && uiState.settingsButton.parentNode) {
      try {
        // Remove the li parent element (which contains the button)
        const liParent = uiState.settingsButton.closest('li');
        if (liParent && liParent.parentNode) {
          liParent.parentNode.removeChild(liParent);
        }
        console.log('[Mod Settings] Settings button removed from header');
      } catch (error) {
        console.warn('[Mod Settings] Error removing settings button:', error);
      }
    }
    uiState.settingsButton = null;
    
    try {
      removeMaxCreatures();
      
      Object.keys(COLOR_OPTIONS).forEach(color => {
        const style = document.getElementById(`max-creatures-${color}-style`);
        if (style && style.parentNode) {
          style.parentNode.removeChild(style);
        }
      });
      console.log('[Mod Settings] Max creatures styles removed');
    } catch (error) {
      console.warn('[Mod Settings] Error cleaning up max creatures:', error);
    }
    
    try {
      removeSealedCreatures();
      
      Object.keys(COLOR_OPTIONS).forEach(color => {
        const style = document.getElementById(`sealed-creatures-${color}-style`);
        if (style && style.parentNode) {
          style.parentNode.removeChild(style);
        }
      });
      console.log('[Mod Settings] Sealed creatures styles removed');
    } catch (error) {
      console.warn('[Mod Settings] Error cleaning up sealed creatures:', error);
    }
    
    try {
      removeMaxShinies();
      
      Object.keys(COLOR_OPTIONS).forEach(color => {
        const style = document.getElementById(`max-shinies-${color}-style`);
        if (style && style.parentNode) {
          style.parentNode.removeChild(style);
        }
      });
      console.log('[Mod Settings] Max shinies styles removed');
    } catch (error) {
      console.warn('[Mod Settings] Error cleaning up max shinies:', error);
    }
    
    try {
      showWebsiteFooter();
      console.log('[Mod Settings] Website footer restored');
    } catch (error) {
      console.warn('[Mod Settings] Error restoring website footer:', error);
    }
    
    // Reset header container styles
    const headerSlot = document.querySelector(SELECTORS.HEADER_SLOT);
    if (headerSlot) {
      const headerContainer = headerSlot.querySelector('div');
      if (headerContainer && headerContainer.classList.contains('flex')) {
        // Remove inline flex-wrap style to restore original behavior
        headerContainer.style.flexWrap = '';
        
        // Reset stamina button styles
        const staminaButton = headerContainer.querySelector('button[title="Stamina"]');
        if (staminaButton) {
          const staminaDiv = staminaButton.querySelector('div');
          if (staminaDiv) {
            staminaDiv.style.flexWrap = '';
            staminaDiv.style.whiteSpace = '';
            staminaDiv.style.minWidth = '';
            staminaDiv.style.flexShrink = '';
            staminaDiv.style.overflow = '';
            
            // Reset parent span styles
            const parentSpan = staminaDiv.querySelector(SELECTORS.STAMINA_PARENT_SPAN);
            if (parentSpan) {
              parentSpan.style.display = '';
              parentSpan.style.flexWrap = '';
              parentSpan.style.whiteSpace = '';
              parentSpan.style.alignItems = '';
            }
          }
        }
        
        console.log('[Mod Settings] Header container and stamina button styles reset');
      }
    }
    
    // Reset state variables
    timerState.element = null;
    timerState.lastValue = null;
    timerState.updateThrottle = null;
    timerState.lastUpdateTime = 0;
    
    // Reset UI state
    uiState.settingsButton = null;
    
    // Reset subscriptions
    subscriptions.autoplayRefreshGame = null;
    subscriptions.autoplayRefreshSetPlayMode = null;
    
    // Reset anti-idle sounds
    antiIdleAudioElement = null;
    
    // Reset playercount state
    playercountState.currentPlayerCount = null;
    playercountState.lastUpdateTime = null;
    playercountState.onlineRecord = null;
    playercountState.onlineRecordFetchSucceeded = false;
    playercountState.recordToastBaselineReady = false;
    playercountState.lastRecordToastAt = 0;
    playercountState.updateInterval = null;
    playercountState.recordCheckInterval = null;
    
    // Reset global update tracking
    lastGlobalUpdate = 0;
    
    // Clean up global exposure
    if (window.betterUIConfig) {
      delete window.betterUIConfig;
      console.log('[Mod Settings] Global config reference removed');
    }
    if (window.markModSettingsProgrammaticNavFloorGuard) {
      delete window.markModSettingsProgrammaticNavFloorGuard;
    }
    programmaticNavFloorGuardUntil = 0;
    initState.initialized = false;
    initState.inProgress = false;
    
    console.log('[Mod Settings] Cleanup completed');
  } catch (error) {
    console.error('[Mod Settings] Cleanup error:', error);
    initState.inProgress = false;
  }
}

// =======================
// Last Visited Map Functions
// =======================

function clampAscensionFloor(floor) {
  if (typeof floor !== 'number' || Number.isNaN(floor)) return 0;
  if (floor < 0) return 0;
  if (floor > 15) return 15;
  return Math.floor(floor);
}

function markReplayFloorGuard(replayConfig) {
  try {
    if (!replayConfig || typeof replayConfig !== 'object') return;
    if (!Object.prototype.hasOwnProperty.call(replayConfig, 'floor')) return;
    replayMaxFloorGuardUntil = Date.now() + REPLAY_MAX_FLOOR_GUARD_MS;
  } catch (error) {
    console.warn('[Mod Settings] Could not mark replay floor guard:', error);
  }
}

function markProgrammaticNavFloorGuard(source = 'programmatic-navigation') {
  try {
    programmaticNavFloorGuardUntil = Date.now() + PROGRAMMATIC_NAV_FLOOR_GUARD_MS;
    console.log(`[Mod Settings] Programmatic nav floor guard active (${source})`);
  } catch (error) {
    console.warn('[Mod Settings] Could not mark programmatic nav floor guard:', error);
  }
}

function shouldSkipMaxFloorSync(source = 'unknown') {
  if (Date.now() <= replayMaxFloorGuardUntil) {
    console.log(`[Mod Settings] Skipping max-floor sync during replay (${source})`);
    return true;
  }
  if (Date.now() <= programmaticNavFloorGuardUntil) {
    console.log(`[Mod Settings] Skipping max-floor sync during programmatic navigation (${source})`);
    return true;
  }
  return false;
}

function installReplayFloorGuardHook() {
  try {
    if (replayFloorGuardHookInstalled) return;
    replayFloorGuardHookInstalled = true;

    const wrapReplayFn = (target, key) => {
      if (!target || typeof target[key] !== 'function' || target[key].__modSettingsReplayGuardWrapped) return;
      const original = target[key];
      const wrapped = function wrappedReplayWithFloorGuard(config) {
        markReplayFloorGuard(config);
        return original.apply(this, arguments);
      };
      wrapped.__modSettingsReplayGuardWrapped = true;
      target[key] = wrapped;
    };

    wrapReplayFn(window, '$replay');
    if (window.BestiaryModAPI?.utility) {
      wrapReplayFn(window.BestiaryModAPI.utility, 'replay');
    }
  } catch (error) {
    console.warn('[Mod Settings] Could not install replay floor guard hook:', error);
  }
}

function getBestCompletedFloorForRoom(roomId) {
  try {
    if (!roomId) return 0;
    const playerRooms = globalThis.state?.player?.getSnapshot?.()?.context?.rooms;
    const roomStats = playerRooms?.[roomId];
    return clampAscensionFloor(roomStats?.floor);
  } catch (error) {
    console.error('[Mod Settings] Error reading best completed floor:', error);
    return 0;
  }
}

function applyBestCompletedFloorForRoom(roomId, source = 'unknown') {
  try {
    if (!roomId) return;
    if (shouldSkipMaxFloorSync(source)) return;

    const targetFloor = getBestCompletedFloorForRoom(roomId);
    const currentFloor = clampAscensionFloor(globalThis.state?.board?.getSnapshot?.()?.context?.floor);
    if (currentFloor === targetFloor) return;

    if (mapFloorSyncTimeoutId) {
      clearTimeout(mapFloorSyncTimeoutId);
      mapFloorSyncTimeoutId = null;
    }

    mapFloorSyncTimeoutId = setTimeout(() => {
      mapFloorSyncTimeoutId = null;
      if (shouldSkipMaxFloorSync(source)) return;
      try {
        globalThis.state.board.trigger.setState({ fn: (prev) => ({ ...prev, floor: targetFloor }) });
        console.log(`[Mod Settings] Applied max floor ${targetFloor} for ${roomId} (${source})`);
      } catch (error) {
        console.error('[Mod Settings] Failed applying max floor:', error);
      }
    }, 120);
  } catch (error) {
    console.error('[Mod Settings] Error applying max floor for room:', error);
  }
}

function applyBestCompletedFloorForCurrentMap(source = 'unknown') {
  try {
    const roomId = globalThis.state?.board?.getSnapshot?.()?.context?.selectedMap?.selectedRoom?.id;
    if (!roomId) return;
    applyBestCompletedFloorForRoom(roomId, source);
  } catch (error) {
    console.error('[Mod Settings] Error applying max floor for current map:', error);
  }
}

window.markModSettingsProgrammaticNavFloorGuard = markProgrammaticNavFloorGuard;

// Load map history from localStorage
const loadLastVisitedMap = () => {
  try {
    const saved = localStorage.getItem(LAST_MAP_STORAGE_KEY);
    if (saved) {
      mapHistory = JSON.parse(saved);
      console.log('[Mod Settings] Loaded map history:', mapHistory);
    }
  } catch (error) {
    console.error('[Mod Settings] Error loading map history:', error);
  }
};

// Save map to history
const saveLastVisitedMap = (roomId, roomName) => {
  try {
    // Remove this map if it already exists in history
    mapHistory = mapHistory.filter(map => map.roomId !== roomId);

    // Add to beginning of history
    mapHistory.unshift({ roomId, roomName });

    // Keep only last 5 maps to avoid excessive storage
    if (mapHistory.length > 5) {
      mapHistory = mapHistory.slice(0, 5);
    }

    localStorage.setItem(LAST_MAP_STORAGE_KEY, JSON.stringify(mapHistory));
    console.log('[Mod Settings] Saved map to history:', { roomId, roomName }, 'History:', mapHistory);
    updateLastMapButton();
  } catch (error) {
    console.error('[Mod Settings] Error saving map to history:', error);
  }
};

// Navigate to previous map in history
const navigateToLastMap = () => {
  if (!mapHistory || mapHistory.length === 0) {
    createToast({
      message: 'No maps in history. Visit some maps first!',
      type: 'info',
      duration: 3000
    });
    return;
  }

  // Get current map
  let currentMapId = null;
  try {
    const boardContext = globalThis.state?.board?.getSnapshot()?.context;
    if (boardContext?.selectedMap?.selectedRoom?.id) {
      currentMapId = boardContext.selectedMap.selectedRoom.id;
    }
  } catch (error) {
    console.error('[Mod Settings] Error getting current map:', error);
  }

  // Find the current map's index in history
  let currentIndex = -1;
  for (let i = 0; i < mapHistory.length; i++) {
    if (mapHistory[i].roomId === currentMapId) {
      currentIndex = i;
      break;
    }
  }

  // Determine next map to navigate to
  let targetMap = null;
  if (currentIndex >= 0) {
    // Current map is in history - go to next one (wrap around)
    const nextIndex = (currentIndex + 1) % mapHistory.length;
    targetMap = mapHistory[nextIndex];
  } else {
    // Current map not in history - go to first map
    targetMap = mapHistory[0];
  }

  // If somehow we still don't have a target (shouldn't happen), use first map
  if (!targetMap) {
    targetMap = mapHistory[0];
  }

  // Don't navigate if target is the same as current (only one map in history)
  if (targetMap.roomId === currentMapId) {
    createToast({
      message: 'No other maps in history. Visit a different map first!',
      type: 'info',
      duration: 3000
    });
    return;
  }

  try {
    console.log('[Mod Settings] Navigating to previous map:', targetMap, 'Current:', currentMapId);
    isNavigatingViaButton = true; // Set flag to prevent saving this navigation
    globalThis.state.board.send({
      type: 'selectRoomById',
      roomId: targetMap.roomId
    });
    // Reset flag after a short delay to allow navigation to complete
    setTimeout(() => { isNavigatingViaButton = false; }, 1000);
  } catch (error) {
    console.error('[Mod Settings] Error navigating to previous map:', error);
    isNavigatingViaButton = false; // Reset flag on error
    createToast({
      message: 'Failed to navigate to map',
      type: 'error',
      duration: 2000
    });
  }
};

// Update the last map button appearance
const updateLastMapButton = () => {
  if (!lastMapButton) return;

  // Get current map
  let currentMapId = null;
  try {
    const boardContext = globalThis.state?.board?.getSnapshot()?.context;
    if (boardContext?.selectedMap?.selectedRoom?.id) {
      currentMapId = boardContext.selectedMap.selectedRoom.id;
    }
  } catch (error) {
    // Ignore errors when getting current map
  }

  // Find the current map's index in history
  let currentIndex = -1;
  for (let i = 0; i < mapHistory.length; i++) {
    if (mapHistory[i].roomId === currentMapId) {
      currentIndex = i;
      break;
    }
  }

  // Determine next map to navigate to (same logic as navigateToLastMap)
  let targetMap = null;
  if (currentIndex >= 0) {
    // Current map is in history - go to next one (wrap around)
    const nextIndex = (currentIndex + 1) % mapHistory.length;
    targetMap = mapHistory[nextIndex];
  } else {
    // Current map not in history - go to first map
    targetMap = mapHistory[0];
  }

  if (targetMap && targetMap.roomId !== currentMapId) {
    // Get room name from utils if not stored
    let roomName = targetMap.roomName;
    if (!roomName) {
      const roomNames = globalThis.state?.utils?.ROOM_NAME || {};
      roomName = roomNames[targetMap.roomId] || targetMap.roomId;
    }
    lastMapButton.title = `Return to ${roomName}`;
    lastMapButton.style.opacity = '1';
  } else {
    lastMapButton.title = 'No other maps in history';
    lastMapButton.style.opacity = '0.5'; // Dim the button but keep it visible
  }
};

// Add last map button to navigation bar
const addLastMapNavButton = () => {
  if (!config.showLastVisitedMapButton) {
    console.log('[Mod Settings] Last map button disabled in config');
    return;
  }

  function tryInsert() {
    const ul = getPrimaryGameNavUl();
    if (!ul) {
      setTimeout(tryInsert, 500);
      return;
    }

    // Check if button already exists
    if (ul.querySelector('.last-map-nav-btn')) {
      console.log('[Mod Settings] Last map button already exists');
      return;
    }

    const li = document.createElement('li');
    li.className = 'hover:text-whiteExp';

    const btn = document.createElement('button');
    btn.className = 'last-map-nav-btn focus-style-visible pixel-font-16 relative my-px flex items-center gap-1.5 border border-solid border-transparent px-1 py-0.5 active:frame-pressed-1 data-[selected="true"]:frame-pressed-1 hover:text-whiteExp data-[selected="true"]:text-whiteExp sm:px-2 sm:py-0.5';
    btn.setAttribute('data-selected', 'false');
    btn.innerHTML = '<div class="relative flex"><img alt="into" src="/assets/icons/into.png" width="5" height="7" class="pixelated"><img alt="into" src="/assets/icons/into.png" width="5" height="7" class="pixelated"><img alt="into" src="/assets/icons/into.png" width="5" height="7" class="pixelated"></div>';

    // Get proper tooltip text
    let tooltipText = 'No maps in history';
    if (mapHistory && mapHistory.length > 0) {
      // Get current map
      let currentMapId = null;
      try {
        const boardContext = globalThis.state?.board?.getSnapshot()?.context;
        if (boardContext?.selectedMap?.selectedRoom?.id) {
          currentMapId = boardContext.selectedMap.selectedRoom.id;
        }
      } catch (error) {
        // Ignore errors
      }

      // Find the current map's index in history
      let currentIndex = -1;
      for (let i = 0; i < mapHistory.length; i++) {
        if (mapHistory[i].roomId === currentMapId) {
          currentIndex = i;
          break;
        }
      }

      // Determine next map to navigate to (same logic as navigateToLastMap)
      let targetMap = null;
      if (currentIndex >= 0) {
        // Current map is in history - go to next one (wrap around)
        const nextIndex = (currentIndex + 1) % mapHistory.length;
        targetMap = mapHistory[nextIndex];
      } else {
        // Current map not in history - go to first map
        targetMap = mapHistory[0];
      }

      if (targetMap && targetMap.roomId !== currentMapId) {
        let roomName = targetMap.roomName;
        if (!roomName) {
          const roomNames = globalThis.state?.utils?.ROOM_NAME || {};
          roomName = roomNames[targetMap.roomId] || targetMap.roomId;
        }
        tooltipText = `Return to ${roomName}`;
      } else {
        tooltipText = 'No other maps in history';
      }
    }
    btn.title = tooltipText;

    btn.style.color = '#3b82f6'; // Blue color

    // Check if there are any maps in history besides current
    let hasTargetMap = false;
    if (mapHistory && mapHistory.length > 0) {
      let currentMapId = null;
      try {
        const boardContext = globalThis.state?.board?.getSnapshot()?.context;
        if (boardContext?.selectedMap?.selectedRoom?.id) {
          currentMapId = boardContext.selectedMap.selectedRoom.id;
        }
      } catch (error) {
        // Ignore errors
      }

      // Find the current map's index in history
      let currentIndex = -1;
      for (let i = 0; i < mapHistory.length; i++) {
        if (mapHistory[i].roomId === currentMapId) {
          currentIndex = i;
          break;
        }
      }

      // Determine next map to navigate to
      let targetMap = null;
      if (currentIndex >= 0) {
        const nextIndex = (currentIndex + 1) % mapHistory.length;
        targetMap = mapHistory[nextIndex];
      } else {
        targetMap = mapHistory[0];
      }

      hasTargetMap = targetMap && targetMap.roomId !== currentMapId;
    }
    btn.style.opacity = hasTargetMap ? '1' : '0.5'; // Dim if no target map available
    btn.onclick = navigateToLastMap;

    lastMapButton = btn;

    li.appendChild(btn);
    ul.appendChild(li);

    // Update button state
    updateLastMapButton();

    console.log('[Mod Settings] Last map navigation button added');
  }
  tryInsert();
};

// Remove last map button
const removeLastMapNavButton = () => {
  const existingButton = document.querySelector('.last-map-nav-btn');
  if (existingButton) {
    existingButton.parentElement?.remove();
    lastMapButton = null;
    console.log('[Mod Settings] Last map button removed');
  }
};

// Subscribe to map changes
const subscribeToMapChanges = () => {
  try {
    if (globalThis.state && globalThis.state.board) {
      if (typeof mapChangeUnsubscribe === 'function') return;
      const handleBoardChange = (state) => {
        try {
          const boardContext = state.context;
          const selectedMap = boardContext?.selectedMap;

          if (selectedMap && selectedMap.selectedRoom) {
            const roomId = selectedMap.selectedRoom.id;
            const roomChanged = roomId && roomId !== mapFloorSyncLastRoomId;
            if (roomChanged) {
              mapFloorSyncLastRoomId = roomId;
              if (config.alwaysNavigateMaxFloor) {
                applyBestCompletedFloorForRoom(roomId, 'map-navigation');
              }
            }

            // Skip saving if we're navigating via the button
            if (isNavigatingViaButton) {
              console.log('[Mod Settings] Skipping map save - navigating via button');
            } else {
              // Get room name from utils if not in selectedRoom
              let roomName = selectedMap.selectedRoom.name;
              if (!roomName) {
                const roomNames = globalThis.state?.utils?.ROOM_NAME || {};
                roomName = roomNames[roomId] || roomId;
              }

              // Skip sewers (default map) and save any other map
              if (roomId && roomId !== 'rkswrs') {
                // Only save if it's not already the most recent in history
                if (mapHistory.length === 0 || mapHistory[0].roomId !== roomId) {
                  console.log('[Mod Settings] Saving new map:', roomId, roomName);
                  saveLastVisitedMap(roomId, roomName);
                }
              }
            }
          }
        } catch (error) {
          console.error('[Mod Settings] Error in map tracking:', error);
        }
      };

      // Subscribe using .subscribe()
      mapChangeUnsubscribe = globalThis.state.board.subscribe(handleBoardChange);
      console.log('[Mod Settings] Subscribed to map changes');
    }
  } catch (error) {
    console.error('[Mod Settings] Error subscribing to map changes:', error);
  }
};

// Unsubscribe from map changes
const unsubscribeFromMapChanges = () => {
  if (mapChangeUnsubscribe && typeof mapChangeUnsubscribe === 'function') {
    mapChangeUnsubscribe();
    mapChangeUnsubscribe = null;
    console.log('[Mod Settings] Unsubscribed from map changes');
  }
  mapFloorSyncLastRoomId = null;
  if (mapFloorSyncTimeoutId) {
    clearTimeout(mapFloorSyncTimeoutId);
    mapFloorSyncTimeoutId = null;
  }
};

// =======================
// 18. Exports & Lifecycle Management
// =======================

// Proper exports following mod development guide
exports = {
  init: function() {
    try {
      initBetterUI();
      return true;
    } catch (error) {
      console.error('[Mod Settings] Initialization error:', error);
      return false;
    }
  },
  
  cleanup: function() {
    try {
      cleanupBetterUI();
      return true;
    } catch (error) {
      console.error('[Mod Settings] Cleanup error:', error);
      return false;
    }
  },
  
  updateConfig: function(newConfig) {
    try {
      Object.assign(config, newConfig);
      return true;
    } catch (error) {
      console.error('[Mod Settings] Config update error:', error);
      return false;
    }
  }
};

// Auto-initialize if running in mod context
if (typeof context !== 'undefined' && context.api) {
  exports.init();
}
