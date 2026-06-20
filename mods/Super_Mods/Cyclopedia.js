// =======================
// 1. Configuration
// =======================
'use strict';

function formatFloorsClearedReplayComment(uniqueFloors, floorSeeds) {
  const seeds = floorSeeds && typeof floorSeeds === 'object' ? floorSeeds : {};
  return `Floors cleared with this setup: ${uniqueFloors.map((floor) => {
    const pct = 100 + Number(floor) * 20;
    const raw = seeds[floor] ?? seeds[String(floor)];
    const sn = Number(raw);
    return Number.isFinite(sn) ? `${pct}% (${sn})` : `${pct}%`;
  }).join(', ')}`;
}

function formatCyclopediaMilliseconds(ms) {
  if (!ms || isNaN(ms) || ms < 0) return '--:--.---';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

function parseCommaSeparatedInt(text) {
  const n = parseInt(String(text ?? '').replace(/,/g, ''), 10);
  return Number.isFinite(n) && !isNaN(n) ? n : null;
}

function getFirstNumericGameStateValue(context, paths) {
  if (!context || !Array.isArray(paths)) return null;
  for (const path of paths) {
    const value = path.split('?.').reduce((obj, key) => obj?.[key], context);
    if (typeof value === 'number' && !isNaN(value) && value >= 0) return value;
  }
  return null;
}

function getCyclopediaListItemBaseName(el) {
  const labeledSpan = el?.querySelector?.('span[data-base-label]');
  if (labeledSpan?.dataset?.baseLabel) return labeledSpan.dataset.baseLabel;
  const plainSpan = el?.querySelector?.('span');
  const raw = String((plainSpan?.textContent || el?.textContent || '')).trim();
  return raw.replace(/^\d+%\s+/, '');
}

function injectCyclopediaStyle(styleId, cssText) {
  if (!DOMCache.get(`#${styleId}`)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = cssText;
    document.head.appendChild(style);
  }
}

function buildLocalRunReplayFields(run) {
  const fields = {};
  fields.floor = (run.floor !== undefined && run.floor !== null) ? run.floor : 0;
  const replayTimestamp = Number(run?.timestamp);
  fields.timestamp = Number.isFinite(replayTimestamp) && replayTimestamp > 0 ? replayTimestamp : Date.now();

  const snap = globalThis.state?.player?.getSnapshot?.();
  const ctx = snap?.context;
  const replayCredits = (
    (typeof run.credits === 'string' && run.credits.trim())
    || (typeof run.player === 'string' && run.player.trim() && !/^you$/i.test(run.player.trim()) && run.player.trim())
    || (typeof run.userName === 'string' && run.userName.trim())
    || (typeof ctx?.playerName === 'string' && ctx.playerName.trim())
    || (typeof ctx?.name === 'string' && ctx.name.trim())
  );
  if (replayCredits) fields.credits = replayCredits;

  if (typeof run.comments === 'string' && run.comments.trim()) {
    fields.comments = run.comments.trim();
  } else {
    const floorHistoryValues = Array.isArray(run?.floorHistory) ? run.floorHistory : [];
    const normalizedFloors = floorHistoryValues
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    const runFloorValue = Number(run?.floor);
    if (Number.isFinite(runFloorValue) && runFloorValue > 0) {
      normalizedFloors.push(runFloorValue);
    }
    const uniqueFloors = Array.from(new Set(normalizedFloors)).sort((a, b) => a - b);
    if (uniqueFloors.length > 1) {
      fields.comments = formatFloorsClearedReplayComment(uniqueFloors, run.floorSeeds);
    }
  }

  if (run.setup?.pieces?.length > 0) {
    fields.board = run.setup.pieces.map((piece) => {
      const boardPiece = {
        tile: piece.tile,
        monster: {
          name: piece.monsterName || piece.monsterId || 'unknown monster',
          level: piece.level || 1,
          hp: piece.monsterStats?.hp || 20,
          ad: piece.monsterStats?.ad || 20,
          ap: piece.monsterStats?.ap || 20,
          armor: piece.monsterStats?.armor || 20,
          magicResist: piece.monsterStats?.magicResist || 20
        }
      };
      if (piece.equipmentName || piece.equipId) {
        boardPiece.equipment = {
          name: piece.equipmentName || piece.equipId || 'unknown equipment',
          stat: piece.equipmentStat || 'ap',
          tier: piece.equipmentTier || 5
        };
      }
      return boardPiece;
    });
  }

  return fields;
}

const START_PAGE_CONFIG = {
  API_TIMEOUT: 10000,
  COLUMN_WIDTHS: { PROFILE: '35%', SEARCH: '65%' },
  COLUMN_GAP: 10,
  API_BASE_URL: 'https://bestiaryarena.com/api/trpc/serverSide.profilePageData',
  RANKINGS_API_URL: 'https://bestiary-arena-ranking.vercel.app/api/v1/rankings',
  RANKINGS_PAGE_SIZE: 50,
  RANKINGS_PREFETCH_LIMIT: 500,
  FRAME_IMAGE_URL: 'https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png'
};
const inventoryTooltips = (typeof window !== 'undefined' && window.inventoryTooltips) || {};
const inventoryDatabase = (typeof window !== 'undefined' && window.inventoryDatabase) || {};

// RunTracker integration
let runTrackerAPI = null;

// Layout dimensions and spacing constants
const LAYOUT_CONSTANTS = {
  COLUMN_WIDTH: '247px',
  LEFT_COLUMN_WIDTH: '200px',
  MODAL_WIDTH: 900,
  MODAL_HEIGHT: 600,
  CHROME_HEIGHT: 70
};

// Color scheme constants for UI theming
const COLOR_CONSTANTS = {
  PRIMARY: '#ffe066',
  SECONDARY: '#e6d7b0',
  BACKGROUND: '#232323',
  TEXT: '#fff',
  ERROR: '#ff6b6b',
  WARNING: '#888',
  PERFECT: '#FFD700',
  MAX_AWAKENED: '#D8B4FF',
  HUNDO: '#A4D8FF',
  AWAKENED: '#FFB347',
  UNOWNED: '#666',
  HOVER: '#888'
};

// pixel-font classes for in-modal game panels; Trebuchet lives in cyclopedia-box/subnav injected CSS
const FONT_BODY_CLASS = 'pixel-font-16';
const FONT_SMALL_CLASS = 'pixel-font-14';
const FONT_CONSTANTS = {
  PRIMARY: 'pixel-font',
  BODY: FONT_BODY_CLASS,
  SMALL: FONT_SMALL_CLASS,
  MEDIUM: FONT_BODY_CLASS,
  LARGE: FONT_BODY_CLASS,
  SIZES: {
    TITLE: FONT_BODY_CLASS,
    BODY: FONT_BODY_CLASS,
    SMALL: FONT_SMALL_CLASS,
    TINY: FONT_SMALL_CLASS
  }
};

/** Standard Cyclopedia column/box header (matches Bestiary "Creatures" title). */
const CYCLOPEDIA_WIDGET_TITLE_CLASS = 'widget-top widget-top-text pixel-font-16';
const CYCLOPEDIA_WIDGET_TITLE_STYLE = {
  margin: '0',
  padding: '2px 8px',
  textAlign: 'center',
  color: COLOR_CONSTANTS.TEXT,
  boxSizing: 'border-box'
};
/** Title beside a narrow toggle button (Creatures shiny / Ability awakened). */
const CYCLOPEDIA_WIDGET_TITLE_SPLIT_STYLE = {
  width: '83%',
  flex: '0 0 83%'
};
const CYCLOPEDIA_WIDGET_TITLE_TOGGLE_STYLE = {
  width: '15%',
  flex: '0 0 15%',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '16px',
  height: '100%',
  alignSelf: 'stretch',
  outline: 'none'
};

function createCyclopediaWidgetTitle(text, extraStyle = {}) {
  const titleEl = document.createElement('h2');
  titleEl.className = CYCLOPEDIA_WIDGET_TITLE_CLASS;
  Object.assign(titleEl.style, CYCLOPEDIA_WIDGET_TITLE_STYLE, extraStyle);
  if (text != null && text !== '') titleEl.textContent = text;
  return titleEl;
}

function applyCyclopediaWidgetTitleChrome(element, extraStyle = {}) {
  element.className = CYCLOPEDIA_WIDGET_TITLE_CLASS;
  Object.assign(element.style, CYCLOPEDIA_WIDGET_TITLE_STYLE, extraStyle);
}

/** English UI copy (Cyclopedia modal is English-only). */
const CYCLOPEDIA_UI = {
  loadingTitle: 'Loading Cyclopedia...',
  loadingSubtitle: 'Fetching your profile data',
  errorTitle: 'Failed to Load Profile Data',
  retry: 'Retry',
  errorAbort: 'Request timed out. Please check your internet connection and try again.',
  errorPlayerName: 'Player name not available. Please ensure you are logged into the game.',
  errorHttp: 'Failed to fetch profile data. Please try again.',
  errorUnexpected: 'An unexpected error occurred while loading the profile data.',
  errorConnectionHint: 'Please check your internet connection and try again.',
  welcome: 'Welcome!',
  welcomeName: (name) => `Welcome ${name}!`,
  seasonStatsTitle: 'Season stats',
  seasonStatsSeason: (n) => `Season ${n}`,
  viewFullSeasonsLeaderboard: 'View full seasons leaderboard',
  notAvailable: 'N/A',
  welcomeFallback: 'Welcome to Cyclopedia!',
  searchTitle: 'Search',
  searchPlaceholder: 'Search Cyclopedia',
  searchTooltip:
    'Cyclopedia search:\n• Find: creatures, equipment, maps, regions, inventory, abilities\n• Matches names, roles, map spawns, equipment drops & boosted maps\n• Ability and equipment effect text (e.g. stun)\n• Exact match: "Goblin" (not Hobgoblin)\n• Combine: goblin OR demon, "Fire Axe" AND stun\n• Operators: AND, OR (spaces required, case insensitive)\n• Use the type filter to narrow results',
  emptyStateMinChars: 'Type at least 2 characters to search.',
  indexingAbility: 'Indexing ability text... Results will appear shortly.',
  noResults: 'No results found.',
  resultBadge: 'Result',
  noProfileData: 'No profile data found.',
  playerInformation: 'Player information',
  accountAlt: 'Account',
  playerFallback: 'Player',
  level: 'Level',
  loyaltyPoints: 'Loyalty Points',
  playerStats: 'Player stats',
  currentTotal: 'Current total',
  progress: 'Progress',
  rankings: 'Rankings',
  rankingsSeason: (n) => `Rankings - Season ${n}`,
  premiumPassAlt: 'Premium pass',
  playerIconAlt: 'Player Icon',
  statusPremium: 'Premium',
  statusFree: 'Free',
  statisticsSeason: (n) => `Statistics Season ${n}`,
  mapInfoSeason: (n) => `Map Information Season ${n}`,
  stats: {
    shell: 'Daily Seashell',
    tasks: 'Hunting tasks',
    playCount: 'Total runs',
    perfectCreatures: 'Perfect Creatures',
    shinyCreatures: 'Shiny Creatures',
    bisEquipments: 'BIS Equipments',
    raids: 'Completed raids',
    exploredMaps: 'Explored maps',
    bagOutfits: 'Bag Outfits',
    rankPoints: 'Rank points',
    timeSum: 'Time sum',
    floorsSum: 'Floors sum',
    createdAt: 'Created at',
    xp: 'XP',
    name: 'Player',
    premium: 'Status'
  }
};

/** Centralized Cyclopedia settings for easy future tuning. */
const CYCLOPEDIA_SETTINGS = {
  playerStatCaps: {
    perfectCreatures: 75,
    bisEquipments: 126,
    exploredMaps: 73,
    bagOutfits: 202,
    raids: 16
  }
};

function renderCyclopediaProfileLoadingHtml() {
  return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.TEXT}; text-align: center; padding: 20px;">
        <div style="font-size: 24px; margin-bottom: 16px;">📚</div>
        <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">${CYCLOPEDIA_UI.loadingTitle}</div>
        <div style="font-size: 14px; color: #888;">${CYCLOPEDIA_UI.loadingSubtitle}</div>
      </div>`;
}

function renderCyclopediaProfileErrorHtml(message, options = {}) {
  const { showRetry = false, showConnectionHint = false } = options;
  const retryBtn = showRetry
    ? `<button id="retry-profile-load" class="${FONT_CONSTANTS.PRIMARY} ${FONT_CONSTANTS.SIZES.BODY}" style="padding: 8px 16px; background: #444; border: 1px solid #666; border-radius: 4px; color: white; cursor: pointer;">${CYCLOPEDIA_UI.retry}</button>`
    : '';
  const hint = showConnectionHint
    ? `<div style="font-size: 12px; color: #666;">${CYCLOPEDIA_UI.errorConnectionHint}</div>`
    : '';
  return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">${CYCLOPEDIA_UI.errorTitle}</div>
        <div style="font-size: 14px; margin-bottom: 16px; color: #888;">${message}</div>
        ${hint}
        ${retryBtn}
      </div>`;
}

// Maps Tab DOM Optimization System
const MapsTabDOMOptimizer = {
  // Cache for reusable DOM elements
  elementCache: new Map(),
  
  // Track current state to avoid unnecessary updates
  currentState: {
    selectedMap: null,
    selectedCategory: null,
    roomData: null,
    roomName: null,
    season: null
  },
  
  // Get or create cached element
  getCachedElement(key, createFn) {
    if (!this.elementCache.has(key)) {
      this.elementCache.set(key, createFn());
    }
    return this.elementCache.get(key);
  },
  
  // Update element content without recreating
  updateElementContent(element, newContent) {
    if (element.innerHTML !== newContent) {
      element.innerHTML = newContent;
    }
  },
  
  // Safe element removal with cleanup
  safeRemoveElement(element) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  },
  
  // Clear cache when needed
  clearCache() {
    this.elementCache.clear();
  }
};

// Configuration constants - inventory data now imported from inventory-database.js
const INVENTORY_CONFIG = inventoryDatabase || {};
const CURRENCY_CONFIG = {};

const HUNTING_MARKS_PATHS = [
  'questLog?.task?.points',
  'questLog?.task?.marks',
  'questLog?.hunting?.marks',
  'huntingMarks',
  'player?.huntingMarks'
];

const HUNTING_MARKS_UI_SELECTORS = [
  '.sprite.item.relative.id-35572', '.sprite.item.relative[class*="id-35572"]',
  'img[src*="huntingmarks.png"]', '[data-item*="hunting"]', '[data-item*="mark"]'
];

const creatureDbRef = (typeof window !== 'undefined' && window.creatureDatabase) || {};
const mapsDbRef = (typeof globalThis !== 'undefined' && globalThis.mapsDatabase) || {};
const itemKeyGroups = inventoryDatabase.itemKeyGroups || {};

const MONSTER_STATS_CONFIG = creatureDbRef.MONSTER_STAT_DISPLAY_CONFIG || [];
const HARDCODED_MONSTER_STATS = creatureDbRef.HARDCODED_MAP_MONSTER_STATS || {};
const HIDE_FROM_CYCLOPEDIA = creatureDbRef.CYCLOPEDIA_HIDDEN_CREATURES || ['Tentugly', 'Dwarf Henchman'];

const UNOBTAINABLE_CREATURES = (creatureDbRef.UNOBTAINABLE_CREATURES || [])
  .filter(name => !HIDE_FROM_CYCLOPEDIA.includes(name));

const ALL_CREATURES = (creatureDbRef.ALL_CREATURES || [])
  .filter(name => !HIDE_FROM_CYCLOPEDIA.includes(name));

/** Obtainable species + Cyclopedia-only entries (e.g. Albino Gazer = shiny Mystic Gazer). */
function getCyclopediaAllCreatures() {
  const db = window.creatureDatabase;
  if (typeof db?.getCyclopediaCreatureNames === 'function') {
    return db.getCyclopediaCreatureNames(db.ALL_CREATURES);
  }
  const base = (db?.ALL_CREATURES?.length ? db.ALL_CREATURES : ALL_CREATURES)
    .filter((name) => !HIDE_FROM_CYCLOPEDIA.includes(name));
  const extra = db?.CYCLOPEDIA_EXTRA_CREATURES ?? ['Albino Gazer'];
  return [...new Set([...base, ...extra])].sort((a, b) => a.localeCompare(b));
}

const CYCLOPEDIA_GAZERS_CATEGORY = 'Gazers';

function isCyclopediaGazerCreatureName(creatureName) {
  const db = window.creatureDatabase;
  if (typeof db?.isGazerCreatureName === 'function') {
    return db.isGazerCreatureName(creatureName);
  }
  return String(creatureName || '').toLowerCase().includes('gazer');
}

function isCyclopediaCreatureAwakenable(creatureName) {
  const db = window.creatureDatabase;
  if (typeof db?.isCreatureAwakenableName === 'function') {
    return db.isCreatureAwakenableName(creatureName);
  }
  return !isCyclopediaGazerCreatureName(creatureName);
}

/** Gazer species shown in the Inventory tab (not Bestiary). */
function getCyclopediaGazerNames() {
  const db = window.creatureDatabase;
  if (typeof db?.getGazerCreatureNames === 'function') {
    return db.getGazerCreatureNames(db.ALL_CREATURES);
  }
  return getCyclopediaAllCreatures().filter((name) => isCyclopediaGazerCreatureName(name));
}

/** Bestiary tab creature list (excludes gazers). */
function getCyclopediaBestiaryCreatures() {
  return getCyclopediaAllCreatures().filter((name) => !isCyclopediaGazerCreatureName(name));
}

function getCyclopediaInventoryCategories() {
  const categories = { ...(INVENTORY_CONFIG?.categories || {}) };
  categories[CYCLOPEDIA_GAZERS_CATEGORY] = getCyclopediaGazerNames();
  return categories;
}

/** Daily Seashell streak days that reward gazers (matches in-game shell tooltip). */
const CYCLOPEDIA_GAZER_SEASHELL_REWARDS = {
  'Albino Gazer': [{ day: 27, rewardLabel: 'Albino Gazer' }],
  default: [
    { day: 13, rewardLabel: 'Random Gazer' },
    { day: 20, rewardLabel: 'Random Gazer' }
  ]
};

function getCyclopediaGazerSeashellRewards(creatureName) {
  const norm = String(creatureName || '').trim().toLowerCase();
  if (norm === 'albino gazer') return CYCLOPEDIA_GAZER_SEASHELL_REWARDS['Albino Gazer'];
  return CYCLOPEDIA_GAZER_SEASHELL_REWARDS.default;
}

function appendCyclopediaGazerObtainSourceHeader(dropsList, { label, iconSrc, iconAlt }) {
  const sourceDiv = document.createElement('div');
  sourceDiv.style.fontWeight = '700';
  sourceDiv.className = FONT_CONSTANTS.SIZES.BODY;
  sourceDiv.style.color = COLOR_CONSTANTS.TEXT;
  sourceDiv.style.background = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat";
  sourceDiv.style.border = '6px solid transparent';
  sourceDiv.style.borderColor = '#ffe066';
  sourceDiv.style.borderImage = "url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch";
  sourceDiv.style.borderRadius = '0';
  sourceDiv.style.boxSizing = 'border-box';
  sourceDiv.style.textAlign = 'center';
  sourceDiv.style.padding = '1px 4px';
  sourceDiv.style.margin = '1px 0 0 0';
  sourceDiv.style.display = 'flex';
  sourceDiv.style.alignItems = 'center';
  sourceDiv.style.justifyContent = 'center';
  sourceDiv.style.gap = '6px';
  if (iconSrc) {
    const icon = document.createElement('img');
    icon.src = iconSrc;
    icon.alt = iconAlt || label;
    icon.style.width = '16px';
    icon.style.height = '16px';
    icon.style.flexShrink = '0';
    if (iconAlt === 'Chromatic Scroll') {
      icon.style.filter = 'drop-shadow(rgb(240, 240, 0) 0px 0px 2px)';
    }
    sourceDiv.appendChild(icon);
  }
  const sourceText = document.createElement('span');
  sourceText.textContent = label;
  sourceDiv.appendChild(sourceText);
  dropsList.appendChild(sourceDiv);
}

function appendCyclopediaGazerObtainRow(dropsList, text) {
  const row = document.createElement('div');
  row.style.fontWeight = 'bold';
  row.className = FONT_CONSTANTS.SIZES.SMALL;
  row.style.lineHeight = '1';
  row.style.letterSpacing = '.0625rem';
  row.style.wordSpacing = '-.1875rem';
  row.style.margin = '0';
  row.style.padding = '2px 6px';
  row.style.borderRadius = '4px';
  row.style.display = 'flex';
  row.style.justifyContent = 'space-between';
  row.style.alignItems = 'center';
  row.style.textAlign = 'left';

  const nameSpan = document.createElement('span');
  nameSpan.textContent = text;
  nameSpan.style.flex = '1 1 auto';
  nameSpan.style.overflow = 'hidden';
  nameSpan.style.textOverflow = 'ellipsis';
  nameSpan.style.whiteSpace = 'nowrap';
  row.appendChild(nameSpan);
  dropsList.appendChild(row);
}

function appendCyclopediaGazerObtainSeparator(dropsList) {
  const separator = document.createElement('div');
  separator.className = 'separator my-2.5';
  separator.setAttribute('role', 'none');
  separator.style.margin = '6px 0';
  dropsList.appendChild(separator);
}

function appendCyclopediaGazerObtainLocations(dropsList, creatureName) {
  const shellName = CYCLOPEDIA_UI.stats?.shell || 'Daily Seashell';
  const rewards = getCyclopediaGazerSeashellRewards(creatureName);

  appendCyclopediaGazerObtainSourceHeader(dropsList, {
    label: shellName,
    iconSrc: '/assets/icons/shell-count.png',
    iconAlt: 'Daily Seashell'
  });
  rewards.forEach(({ day, rewardLabel }, index) => {
    appendCyclopediaGazerObtainRow(dropsList, `Day ${day} — ${rewardLabel}`);
    if (index < rewards.length - 1) appendCyclopediaGazerObtainSeparator(dropsList);
  });

  appendCyclopediaGazerObtainSeparator(dropsList);
  const chromaticLabel = cyclopediaGetInventoryDisplayName('summonScroll6') || 'Chromatic Scroll';
  appendCyclopediaGazerObtainSourceHeader(dropsList, {
    label: chromaticLabel,
    iconSrc: '/assets/icons/summonscroll6.png',
    iconAlt: 'Chromatic Scroll'
  });
  appendCyclopediaGazerObtainRow(dropsList, 'Random Gazer');
}

function cyclopediaResolveCreatureQuery(creatureName) {
  const db = window.creatureDatabase;
  if (typeof db?.resolveCreatureDisplay === 'function') {
    return db.resolveCreatureDisplay(creatureName);
  }
  return {
    displayName: creatureName,
    gameId: null,
    baseSpecies: creatureName,
    forceShiny: false,
    shinyOnly: false,
    nonShinyOnly: false
  };
}

const HARDCODED_BOOSTED_MAP = window.equipmentDatabase?.HARDCODED_BOOSTED_MAP || {};

/** Full equipment catalog (filled by equipment-database.js after game state is ready). */
function getCyclopediaAllEquipmentNames() {
  const db = window.equipmentDatabase;
  if (Array.isArray(db?.ALL_EQUIPMENT) && db.ALL_EQUIPMENT.length > 0) {
    return db.ALL_EQUIPMENT;
  }
  return [];
}

const GAME_KEYS = {
  NO_RARITY: itemKeyGroups.noRarity || ['nicknameChange', 'nicknameMonster', 'hunterOutfitBag', 'outfitBag1'],
  CURRENCY: itemKeyGroups.currency || ['gold', 'dust', 'beastCoins', 'huntingMarks'],
  UPGRADE: itemKeyGroups.upgrade || ['babyDragonPlant', 'creatureAwakening', 'dailyBoostedMap', 'daycare', 'dungeonAscension', 'dragonPlant', 'drMephistopheles', 'hygenie', 'monsterCauldron', 'monsterRaids', 'monsterSqueezer', 'mountainFortress', 'premium', 'forge', 'yasirTradingContract']
};

const MAP_INTERACTION_CONFIG = {
  cursor: 'pointer',
  textDecoration: 'underline',
  tooltip: 'Click to go to this map',
  hoverBackground: 'rgba(255,255,255,0.08)',
  hoverTextColor: '#4a9eff',
  defaultBackground: 'transparent',
  defaultTextColor: COLOR_CONSTANTS.TEXT,
  padding: '2px 6px',
  borderRadius: '4px',
  boxSizing: 'border-box'
};

// Centralized Navigation Handler
const NavigationHandler = {
  // Navigate to a map by display name
  navigateToMapByName(mapName) {
    const roomNames = globalThis.state?.utils?.ROOM_NAME;
    if (!roomNames) return false;
    
    for (const [roomId, displayName] of Object.entries(roomNames)) {
      if (displayName === mapName) {
        return this.navigateToMapByRoomId(roomId);
      }
    }
    return false;
  },

  // Navigate to a map by room ID/code
  navigateToMapByRoomId(roomId) {
    if (!globalThis.state?.board) return false;
    
    globalThis.state.board.send({
      type: 'selectRoomById',
      roomId: roomId
    });
    
    // Try to close modal if present
    const closeBtn = Array.from(DOMCache.getAll('button.pixel-font-14')).find(
      btn => btn.textContent.trim() === 'Close'
    );
    if (closeBtn) {
      closeBtn.click();
    }
    return true;
  },

  // Navigate to a player profile
  navigateToProfile(playerName) {
    const profileUrl = `https://bestiaryarena.com/profile/${encodeURIComponent(playerName)}`;
    window.open(profileUrl, '_blank');
  },

  // Attach map navigation handler with hover effects to an element
  attachMapNavigation(element, mapName, config = {}) {
    const cfg = { ...MAP_INTERACTION_CONFIG, ...config };
    
    element.style.cursor = cfg.cursor;
    element.style.textDecoration = cfg.textDecoration;
    element.title = cfg.tooltip;
    element.style.padding = cfg.padding;
    element.style.borderRadius = cfg.borderRadius;
    element.style.boxSizing = cfg.boxSizing;
    
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateToMapByName(mapName);
    });
    
    element.addEventListener('mouseenter', () => {
      element.style.background = cfg.hoverBackground;
      element.style.color = cfg.hoverTextColor;
    });
    
    element.addEventListener('mouseleave', () => {
      element.style.background = cfg.defaultBackground;
      element.style.color = cfg.defaultTextColor;
    });
  },

  // Attach profile navigation handler to an element
  attachProfileNavigation(element, playerName, hoverStyles = {}) {
    element.style.cursor = 'pointer';
    element.style.textDecoration = 'underline';
    element.style.color = COLOR_CONSTANTS.PRIMARY;
    
    element.addEventListener('click', () => {
      this.navigateToProfile(playerName);
    });
    
    if (Object.keys(hoverStyles).length > 0) {
      const defaultColor = element.style.color;
      element.addEventListener('mouseenter', () => {
        Object.assign(element.style, hoverStyles);
      });
      element.addEventListener('mouseleave', () => {
        element.style.color = defaultColor;
      });
    }
  }
};

const REGION_NAME_MAP = mapsDbRef.REGION_NAME_MAP || {};

function cyclopediaGetRegionDisplayName(regionId) {
  if (typeof mapsDbRef.getRegionDisplayName === 'function') {
    return mapsDbRef.getRegionDisplayName(regionId);
  }
  const key = String(regionId ?? '').toLowerCase();
  if (REGION_NAME_MAP[key]) return REGION_NAME_MAP[key];
  const raw = String(regionId ?? '').trim();
  if (!raw) return 'Unknown Region';
  return raw.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

const GAME_DATA = {
  MONSTER_STATS_CONFIG,
  UNOBTAINABLE_CREATURES,
  ALL_CREATURES,
  get ALL_EQUIPMENT() {
    return getCyclopediaAllEquipmentNames();
  },
  HARDCODED_BOOSTED_MAP,
  NO_RARITY_KEYS: GAME_KEYS.NO_RARITY,
  CURRENCY_KEYS: GAME_KEYS.CURRENCY,
  UPGRADE_KEYS: GAME_KEYS.UPGRADE,
  RARITY_COLORS: inventoryDatabase.rarityColors || {},
  REGION_NAME_MAP
};

function cyclopediaNormalizeSearchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function cyclopediaExtractQuotedString(condition) {
  const c = String(condition ?? '').trim();
  if ((c.startsWith('"') && c.endsWith('"')) || (c.startsWith("'") && c.endsWith("'"))) {
    return { isExact: true, value: cyclopediaNormalizeSearchText(c.slice(1, -1)) };
  }
  return { isExact: false, value: cyclopediaNormalizeSearchText(c) };
}

function cyclopediaCollectBooleanLeaves(expression) {
  const expr = String(expression ?? '').trim();
  if (!expr) return [];
  if (/\s+or\s+/i.test(expr)) {
    return expr.split(/\s+or\s+/i).flatMap((part) => cyclopediaCollectBooleanLeaves(part));
  }
  if (/\s+and\s+/i.test(expr)) {
    return expr.split(/\s+and\s+/i).flatMap((part) => cyclopediaCollectBooleanLeaves(part));
  }
  return [expr.trim()].filter(Boolean);
}

function cyclopediaBooleanExpressionHasValidTerm(expression) {
  const leaves = cyclopediaCollectBooleanLeaves(expression);
  if (leaves.length === 0) return cyclopediaNormalizeSearchText(expression).length >= 2;
  return leaves.some((leaf) => {
    const { value } = cyclopediaExtractQuotedString(leaf);
    return (value || '').length >= 2;
  });
}

/** AND/OR parsing (Dice_Roller SearchMatcher-style). OR splits before AND. */
function cyclopediaParseSearchExpression(matchCondition, expression) {
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
      return check((c) => !c.trim() || cyclopediaParseSearchExpression(matchCondition, c));
    }
    return null;
  };

  if (/\s+or\s+/i.test(expr)) {
    const parts = expr.split(/\s+or\s+/i).map((s) => s.trim());
    const incomplete = handleIncompleteOperator(parts, 'or', false);
    if (incomplete !== null) return incomplete;
    return parts.some((p) => cyclopediaParseSearchExpression(matchCondition, p));
  }

  if (/\s+and\s+/i.test(expr)) {
    const parts = expr.split(/\s+and\s+/i).map((s) => s.trim());
    const incomplete = handleIncompleteOperator(parts, 'and', true);
    if (incomplete !== null) return incomplete;
    return parts.every((p) => cyclopediaParseSearchExpression(matchCondition, p));
  }

  return matchCondition(expr);
}

function cyclopediaMatchesSingleSearchCondition(searchBlob, labelNorm, condition) {
  if (!condition || !String(condition).trim()) return true;
  const blob = searchBlob || '';
  const label = labelNorm || '';
  const { isExact, value } = cyclopediaExtractQuotedString(condition);
  const q = isExact ? value : cyclopediaNormalizeSearchText(condition);
  if (!q || q.length < 2) return false;
  if (isExact) return label === q || blob === q;
  return label.includes(q) || blob.includes(q);
}

function cyclopediaTextMatchesSearchQuery(text, parsed) {
  const blob = cyclopediaNormalizeSearchText(text);
  if (!blob) return false;
  if (parsed?.isBooleanMode && parsed.booleanExpression) {
    return cyclopediaParseSearchExpression(
      (cond) => cyclopediaMatchesSingleSearchCondition(blob, blob, cond),
      parsed.booleanExpression
    );
  }
  if (parsed?.isExactMode && parsed.exactPhrases?.length) {
    return parsed.exactPhrases.some((p) => blob === p);
  }
  const q = parsed?.qNorm || '';
  return q.length >= 2 && blob.includes(q);
}

function cyclopediaFirstMatchingLeafForSnippet(parsed) {
  if (parsed?.isBooleanMode) {
    for (const leaf of cyclopediaCollectBooleanLeaves(parsed.booleanExpression)) {
      const { value } = cyclopediaExtractQuotedString(leaf);
      const q = cyclopediaNormalizeSearchText(value);
      if (q.length >= 2) return q;
    }
    return cyclopediaNormalizeSearchText(parsed.booleanExpression);
  }
  return parsed?.qNorm || '';
}

/** `"goblin"` → exact phrase mode; `foo AND bar` / `foo OR bar` → boolean mode (Dice_Roller-style). */
function parseCyclopediaHomeSearchQuery(query) {
  const raw = String(query ?? '').trim();
  const hasBoolean = /\s+(and|or)\s+/i.test(raw);

  if (hasBoolean) {
    return {
      qNorm: cyclopediaNormalizeSearchText(raw),
      booleanExpression: raw,
      isBooleanMode: true,
      isExactMode: false,
      exactPhrases: [],
      remainder: cyclopediaNormalizeSearchText(raw)
    };
  }

  const exactPhrases = [];
  const quotePattern = /"([^"]*)"/g;
  let match;
  while ((match = quotePattern.exec(raw)) !== null) {
    const phrase = cyclopediaNormalizeSearchText(match[1]);
    if (phrase.length >= 2) exactPhrases.push(phrase);
  }
  const remainder = cyclopediaNormalizeSearchText(raw.replace(quotePattern, ' ').replace(/"/g, ' '));
  const isExactMode = exactPhrases.length > 0;
  return {
    qNorm: isExactMode ? exactPhrases[0] : remainder,
    exactPhrases,
    isExactMode,
    isBooleanMode: false,
    booleanExpression: '',
    remainder
  };
}

function cyclopediaGetInventoryDisplayName(itemKey) {
  if (!itemKey) return 'Unknown Item';

  // Prefer explicit tooltips mapping
  if (inventoryTooltips?.[itemKey]?.displayName) return inventoryTooltips[itemKey].displayName;

  // Prefer static database (if present)
  const staticItem = INVENTORY_CONFIG?.staticItems?.[itemKey];
  if (staticItem?.name) return staticItem.name;

  // Fallback: convert camelCase/keys into a readable label
  return String(itemKey)
    .replace(/^item_/, 'Item ')
    .replace(/^custom_/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

function cyclopediaGetInventoryObtainText(itemKey, displayName) {
  if (!itemKey) return '';
  const dn = displayName || cyclopediaGetInventoryDisplayName(itemKey);
  return (
    inventoryTooltips?.[dn]?.obtain ||
    inventoryTooltips?.[itemKey]?.obtain ||
    inventoryTooltips?.[dn]?.text ||
    inventoryTooltips?.[itemKey]?.text ||
    ''
  );
}

const CyclopediaHomeSearch = (() => {
  const MAX_RESULTS = 40;
  const MAX_META_CREATURES = 25;
  const MAX_META_MAPS = 30;
  const MAX_META_CREATURE_EQUIPS = 40;
  const MAX_META_EQUIP_EFFECT = 20;
  const ABILITY_TEXT_CACHE_VERSION = 2;

  let baseEntries = null;
  let creatureEntries = null; // cached: baseEntries filtered to creatures
  let equipmentEntries = null; // cached: baseEntries filtered to equipment
  let roomCreatureIndex = null; // Map<roomId, Set<creatureName>> (board index built flag)
  let creatureToRoomIds = null; // Map<normalizedCreatureName, Set<roomId>>
  let equipmentToRoomIds = null; // Map<normalizedEquipmentName, Set<roomId>>
  let creatureToEquipmentNames = null; // Map<normalizedCreatureName, Set<equipmentDisplayName>>
  let creatureAbilityTextCache = null; // Map<creatureNameLower, { v: number, text: string } | string>
  let equipmentEffectTextCache = null; // Map<normalizedEquipmentName, { v: number, text: string }>
  const EQUIPMENT_EFFECT_TEXT_CACHE_VERSION = 5;
  let equipmentEffectIndexState = {
    abortToken: 0,
    running: false,
    done: 0,
    total: 0,
    queue: [],
    listeners: new Set(),
    tickTimer: null,
    lastNotifyAt: 0,
    lastNotifyDone: 0,
    lastNotifySignature: ''
  };
  let equipmentEffectIndexPromise = null;
  let abilityIndexState = {
    abortToken: 0,
    running: false,
    done: 0,
    total: 0,
    queue: [],
    listeners: new Set(),
    tickTimer: null,
    lastNotifyAt: 0,
    lastNotifyDone: 0,
    lastNotifySignature: ''
  };

  function getRegionDisplayName(regionId) {
    return cyclopediaGetRegionDisplayName(regionId);
  }

  function safeGetRegions() {
    const regions = globalThis.state?.utils?.REGIONS;
    return Array.isArray(regions) ? regions : [];
  }

  function buildRoomIdToRegionId(regions) {
    const map = new Map();
    regions.forEach((region) => {
      const regionId = region?.id;
      if (!regionId || !Array.isArray(region.rooms)) return;
      region.rooms.forEach((room) => {
        if (room?.id) map.set(room.id, regionId);
      });
    });
    return map;
  }

  /** Playable map codes only (ROOM_NAME keys). Excludes numeric ROOMS object keys. */
  function isPlayableRoomId(roomId, roomNameMap) {
    if (!roomId || typeof roomId !== 'string') return false;
    if (/^\d+$/.test(roomId)) return false;
    return !!roomNameMap?.[roomId];
  }

  function addCreatureToRoomIndex(roomId, creatureName, roomNameMap) {
    if (!roomId || !creatureName) return;
    if (!isPlayableRoomId(roomId, roomNameMap)) return;

    let roomSet = roomCreatureIndex.get(roomId);
    if (!roomSet) {
      roomSet = new Set();
      roomCreatureIndex.set(roomId, roomSet);
    }
    roomSet.add(creatureName);

    const key = cyclopediaNormalizeSearchText(creatureName);
    if (!key) return;
    let roomsForCreature = creatureToRoomIds.get(key);
    if (!roomsForCreature) {
      roomsForCreature = new Set();
      creatureToRoomIds.set(key, roomsForCreature);
    }
    roomsForCreature.add(roomId);
  }

  function addEquipmentToRoomIndex(roomId, equipmentName, roomNameMap) {
    if (!roomId || !equipmentName) return;
    if (!isPlayableRoomId(roomId, roomNameMap)) return;

    const key = cyclopediaNormalizeSearchText(equipmentName);
    if (!key) return;
    let roomsForEquipment = equipmentToRoomIds.get(key);
    if (!roomsForEquipment) {
      roomsForEquipment = new Set();
      equipmentToRoomIds.set(key, roomsForEquipment);
    }
    roomsForEquipment.add(roomId);
  }

  function addCreatureEquipmentLink(creatureName, equipmentName) {
    if (!creatureName || !equipmentName) return;
    const creatureKey = cyclopediaNormalizeSearchText(creatureName);
    if (!creatureKey) return;
    let equipSet = creatureToEquipmentNames.get(creatureKey);
    if (!equipSet) {
      equipSet = new Set();
      creatureToEquipmentNames.set(creatureKey, equipSet);
    }
    equipSet.add(equipmentName);
  }

  function ensureRoomCreatureIndex() {
    if (roomCreatureIndex) return roomCreatureIndex;
    roomCreatureIndex = new Map();
    creatureToRoomIds = new Map();
    equipmentToRoomIds = new Map();
    creatureToEquipmentNames = new Map();

    const utils = globalThis.state?.utils;
    if (!utils?.getMonster) return roomCreatureIndex;

    const getMonster = utils.getMonster;
    const getEquipment = utils.getEquipment;
    const getBoard = utils.getBoardMonstersFromRoomId;
    const regions = safeGetRegions();
    const roomNameMap = utils.ROOM_NAME || {};

    try {
      // Board villains on playable maps only (same source as Room Hopper; no ROOMS numeric keys)
      if (typeof getBoard === 'function') {
        const roomIds = regions.length > 0
          ? regions.flatMap((region) =>
              (Array.isArray(region.rooms) ? region.rooms : [])
                .map((room) => room?.id)
                .filter(Boolean)
            )
          : Object.keys(roomNameMap);

        for (const roomId of roomIds) {
          if (!isPlayableRoomId(roomId, roomNameMap)) continue;
          try {
            const board = getBoard(roomId);
            if (!Array.isArray(board)) continue;
            board.filter((p) => p?.villain === true).forEach((v) => {
              let creatureName = null;
              const monsterId = v?.gameId;
              if (monsterId) {
                try {
                  const monster = getMonster(monsterId);
                  creatureName = monster?.metadata?.name || null;
                  if (creatureName) addCreatureToRoomIndex(roomId, creatureName, roomNameMap);
                } catch {
                  // ignore
                }
              }

              const equipId = Number(v?.equip?.gameId);
              if (Number.isFinite(equipId) && typeof getEquipment === 'function') {
                try {
                  const eq = getEquipment(equipId);
                  const equipName = eq?.metadata?.name;
                  if (equipName) {
                    addEquipmentToRoomIndex(roomId, equipName, roomNameMap);
                    if (creatureName) addCreatureEquipmentLink(creatureName, equipName);
                  }
                } catch {
                  // ignore
                }
              }
            });
          } catch {
            // ignore
          }
        }
      }
    } catch (error) {
      console.warn('[Cyclopedia] HomeSearch: error building room creature index:', error);
    }

    return roomCreatureIndex;
  }

  function ensureCreatureAbilityTextCache() {
    if (!creatureAbilityTextCache) creatureAbilityTextCache = new Map();
    return creatureAbilityTextCache;
  }

  function isAbilityTextCacheEntryUpToDate(value) {
    return (
      value &&
      typeof value === 'object' &&
      value.v === ABILITY_TEXT_CACHE_VERSION &&
      typeof value.text === 'string'
    );
  }

  function getAbilityTextFromCacheValue(value) {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && typeof value.text === 'string') return value.text;
    return '';
  }

  function notifyAbilityIndexUpdate() {
    try {
      const progress = getAbilityIndexProgress();
      const now = Date.now();
      const isDone = progress.total > 0 && progress.done >= progress.total && !progress.running;
      const signature = `${progress.running ? 1 : 0}:${progress.done}:${progress.total}`;

      // If nothing changed since last emit, don't spam listeners (prevents UI refresh loops).
      if (!isDone && signature === (abilityIndexState.lastNotifySignature || '')) return;

      // Throttle notifications to avoid UI constantly re-rendering while indexing.
      // Always notify at completion, otherwise notify at most every 300ms or every 25 items.
      const timeOk = now - (abilityIndexState.lastNotifyAt || 0) >= 300;
      const stepOk = (progress.done - (abilityIndexState.lastNotifyDone || 0)) >= 25;
      if (!isDone && !timeOk && !stepOk) return;

      abilityIndexState.lastNotifyAt = now;
      abilityIndexState.lastNotifyDone = progress.done;
      abilityIndexState.lastNotifySignature = signature;

      abilityIndexState.listeners.forEach((fn) => {
        try { fn(progress); } catch { /* ignore */ }
      });
    } catch {
      // ignore
    }
  }

  function getAbilityIndexProgress() {
    return {
      running: !!abilityIndexState.running,
      done: Number(abilityIndexState.done) || 0,
      total: Number(abilityIndexState.total) || 0
    };
  }

  function abortAbilityIndexing() {
    try {
      abilityIndexState.abortToken = (Number(abilityIndexState.abortToken) || 0) + 1;
      abilityIndexState.running = false;
      abilityIndexState.queue = [];
      if (abilityIndexState.tickTimer) clearTimeout(abilityIndexState.tickTimer);
      abilityIndexState.tickTimer = null;
      notifyAbilityIndexUpdate();
      return true;
    } catch {
      return false;
    }
  }

  function subscribeAbilityIndex(listener) {
    if (typeof listener !== 'function') return () => {};
    abilityIndexState.listeners.add(listener);
    // Send initial state immediately
    try { listener(getAbilityIndexProgress()); } catch { /* ignore */ }
    return () => {
      abilityIndexState.listeners.delete(listener);
    };
  }

  // One-shot ability indexing promise (used by the Home search UI).
  // This allows: index ability text once -> refresh results once -> stop.
  let abilityIndexPromise = null;

  function isAbilityIndexReady() {
    try {
      if (!baseEntries) baseEntries = buildBaseEntries();
      const cache = ensureCreatureAbilityTextCache();
      const creatureEntries = baseEntries.filter(e => e.kind === 'creature');
      for (const entry of creatureEntries) {
        const key = cyclopediaNormalizeSearchText(entry.label);
        if (!key) continue;
        const cached = cache.get(key);
        if (!isAbilityTextCacheEntryUpToDate(cached)) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  function ensureAbilityIndexReady() {
    try {
      // If UI components aren't available, we can't render TooltipContent -> no ability indexing.
      if (typeof globalThis.state?.utils?.createUIComponent !== 'function') return Promise.resolve(false);
      if (isAbilityIndexReady()) return Promise.resolve(true);

      if (abilityIndexPromise) return abilityIndexPromise;

      abilityIndexPromise = new Promise((resolve) => {
        let resolved = false;
        let timeoutId = null;
        const abortTokenAtStart = Number(abilityIndexState.abortToken) || 0;

        const cleanupAndResolve = (value) => {
          if (resolved) return;
          resolved = true;
          abilityIndexPromise = null;
          if (timeoutId) clearTimeout(timeoutId);
          resolve(value);
        };

        const unsubscribe = subscribeAbilityIndex((progress) => {
          // If something (like a priority navigation) aborts indexing, resolve quickly.
          if ((Number(abilityIndexState.abortToken) || 0) !== abortTokenAtStart) {
            try { unsubscribe(); } catch { /* ignore */ }
            cleanupAndResolve(false);
            return;
          }
          const done = !progress?.running && (progress?.total || 0) > 0 && (progress?.done || 0) >= (progress?.total || 0);
          if (done || isAbilityIndexReady()) {
            try { unsubscribe(); } catch { /* ignore */ }
            cleanupAndResolve(true);
          }
        });

        // Safety timeout: if something prevents completion, don't hang forever.
        timeoutId = setTimeout(() => {
          try { unsubscribe(); } catch { /* ignore */ }
          cleanupAndResolve(false);
        }, 20000);
        try { TimerManager.addTimeout(timeoutId, 'homeSearchAbilityIndexWait'); } catch { /* ignore */ }

        startAbilityIndexing();
      });

      return abilityIndexPromise;
    } catch {
      abilityIndexPromise = null;
      return Promise.resolve(false);
    }
  }

  function stripHtmlToPlainText(html) {
    try {
      const div = document.createElement('div');
      div.innerHTML = String(html ?? '');
      return div.textContent || '';
    } catch {
      return String(html ?? '');
    }
  }

  function resolveEquipmentIdByName(equipmentName) {
    try {
      if (!equipmentName || typeof equipmentName !== 'string') return null;
      const key = equipmentName.toLowerCase();
      const fromApi = window.BestiaryModAPI?.utility?.maps?.equipmentNamesToGameIds?.get?.(key);
      if (fromApi != null) return fromApi;

      const getEquipment = globalThis.state?.utils?.getEquipment;
      if (typeof getEquipment !== 'function') return null;
      for (let i = 1; i < 1000; i++) {
        try {
          const eq = getEquipment(i);
          if (eq?.metadata?.name?.toLowerCase() === key) return i;
        } catch {
          // ignore missing ids
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  function ensureEquipmentEffectTextCache() {
    if (!equipmentEffectTextCache) equipmentEffectTextCache = new Map();
    return equipmentEffectTextCache;
  }

  function getEquipmentMetaByName(equipmentName) {
    try {
      const equipId = resolveEquipmentIdByName(equipmentName);
      if (equipId == null) return null;
      return globalThis.state?.utils?.getEquipment?.(equipId)?.metadata ?? null;
    } catch {
      return null;
    }
  }

  function equipmentHasRenderedEffectMeta(meta) {
    return !!(meta?.EffectComponent || meta?.skill?.TooltipContent);
  }

  function buildEquipmentEffectTextPrefix(meta) {
    let text = '';
    if (!meta) return text;
    if (meta.description) {
      text += `${stripHtmlToPlainText(meta.description)}\n`;
    }
    const leaves = [];
    collectStringLeaves(meta, leaves);
    if (leaves.length) text += `${leaves.join('\n')}\n`;
    return text;
  }

  function isEquipmentEffectCacheEntryUpToDate(equipmentName, cached) {
    if (
      !cached ||
      cached.v !== EQUIPMENT_EFFECT_TEXT_CACHE_VERSION ||
      cached.indexed !== true ||
      typeof cached.text !== 'string'
    ) {
      return false;
    }
    const meta = getEquipmentMetaByName(equipmentName);
    if (equipmentHasRenderedEffectMeta(meta) && !cached.text.trim()) return false;
    return true;
  }

  function effectTextMatchesQuery(effectText, parsedOrNorm) {
    if (!effectText) return false;
    if (typeof parsedOrNorm === 'object' && parsedOrNorm !== null) {
      return cyclopediaTextMatchesSearchQuery(effectText, parsedOrNorm);
    }
    const qNorm = parsedOrNorm;
    return Boolean(qNorm && effectText.includes(qNorm));
  }

  function cyclopediaEntryMatchesBoolean(entry, booleanExpression) {
    const labelNorm = entry.labelNorm ?? cyclopediaNormalizeSearchText(entry.label);
    const searchBlob = entry.search || labelNorm;
    return cyclopediaParseSearchExpression(
      (cond) => cyclopediaMatchesSingleSearchCondition(searchBlob, labelNorm, cond),
      booleanExpression
    );
  }

  function entryAlreadyMatchesQuery(entry, parsed) {
    if (parsed.isBooleanMode) {
      return cyclopediaEntryMatchesBoolean(entry, parsed.booleanExpression);
    }
    const q = parsed.qNorm;
    return Boolean(q && entry.search && entry.search.includes(q));
  }

  function extractEquipmentEffectTextAsync(equipmentName, onDone) {
    try {
      const createUIComponent = globalThis.state?.utils?.createUIComponent;
      const meta = getEquipmentMetaByName(equipmentName);
      let prefixText = buildEquipmentEffectTextPrefix(meta);
      const effectComponent = meta?.EffectComponent;
      const skillTooltip = meta?.skill?.TooltipContent;

      const mountAndRead = (UIComponent, cb, tier) => {
        if (!UIComponent || typeof createUIComponent !== 'function') {
          cb('');
          return;
        }

        const host = document.createElement('div');
        host.style.cssText =
          'position:fixed;left:-99999px;top:0;width:520px;max-width:520px;height:auto;overflow:visible;opacity:0;pointer-events:none;z-index:-1;';
        const root = document.createElement('div');
        root.classList.add('tooltip-prose');
        root.classList.add(FONT_CONSTANTS.SIZES.SMALL);
        root.style.width = '100%';
        root.style.height = 'auto';
        root.style.color = COLOR_CONSTANTS.TEXT;
        root.style.lineHeight = '1.1';
        host.appendChild(root);
        document.body.appendChild(host);

        let component = null;
        try {
          if (tier != null) {
            const mountEffect = window.equipmentDatabase?.mountEquipmentEffectComponent;
            component = typeof mountEffect === 'function'
              ? mountEffect(root, UIComponent, tier)
              : null;
          } else {
            component = createUIComponent(root, UIComponent);
            if (component && typeof component.mount === 'function') component.mount();
          }
          if (!component) {
            try { host.remove(); } catch { /* ignore */ }
            cb('');
            return;
          }
        } catch {
          try { host.remove(); } catch { /* ignore */ }
          cb('');
          return;
        }

        const finishRead = () => {
          let text = '';
          try {
            text = root.textContent || '';
          } catch {
            text = '';
          }
          try {
            if (component && typeof component.unmount === 'function') component.unmount();
          } catch {
            // ignore
          }
          try { host.remove(); } catch { /* ignore */ }
          cb(text);
        };

        // EffectComponent tooltips often paint after the first frame (same as creature abilities).
        requestAnimationFrame(() => {
          requestAnimationFrame(finishRead);
        });
      };

      mountAndRead(
        effectComponent,
        (effectText) => {
          if (effectText) prefixText += `${effectText}\n`;
          mountAndRead(skillTooltip, (skillText) => {
            if (skillText) prefixText += `${skillText}\n`;
            onDone(cyclopediaNormalizeSearchText(prefixText));
          });
        },
        window.equipmentDatabase?.DEFAULT_EQUIPMENT_EFFECT_TIER ?? 5
      );
    } catch {
      onDone('');
    }
  }

  function getEquipmentEffectText(equipmentName) {
    const cache = ensureEquipmentEffectTextCache();
    const key = cyclopediaNormalizeSearchText(equipmentName);
    if (!key) return '';
    const cached = cache.get(key);
    if (isEquipmentEffectCacheEntryUpToDate(equipmentName, cached)) return cached.text;

    const meta = getEquipmentMetaByName(equipmentName);
    const text = cyclopediaNormalizeSearchText(buildEquipmentEffectTextPrefix(meta));
    if (!equipmentHasRenderedEffectMeta(meta)) {
      cache.set(key, { v: EQUIPMENT_EFFECT_TEXT_CACHE_VERSION, text, indexed: true });
    }
    return text;
  }

  function notifyEquipmentEffectIndexUpdate() {
    try {
      const progress = getEquipmentEffectIndexProgress();
      const now = Date.now();
      const isDone = progress.total > 0 && progress.done >= progress.total && !progress.running;
      const signature = `${progress.running ? 1 : 0}:${progress.done}:${progress.total}`;
      if (!isDone && signature === (equipmentEffectIndexState.lastNotifySignature || '')) return;

      const timeOk = now - (equipmentEffectIndexState.lastNotifyAt || 0) >= 300;
      const stepOk = (progress.done - (equipmentEffectIndexState.lastNotifyDone || 0)) >= 10;
      if (!isDone && !timeOk && !stepOk) return;

      equipmentEffectIndexState.lastNotifyAt = now;
      equipmentEffectIndexState.lastNotifyDone = progress.done;
      equipmentEffectIndexState.lastNotifySignature = signature;

      equipmentEffectIndexState.listeners.forEach((fn) => {
        try { fn(progress); } catch { /* ignore */ }
      });
    } catch {
      // ignore
    }
  }

  function getEquipmentEffectIndexProgress() {
    return {
      running: !!equipmentEffectIndexState.running,
      done: Number(equipmentEffectIndexState.done) || 0,
      total: Number(equipmentEffectIndexState.total) || 0
    };
  }

  function abortEquipmentEffectIndexing() {
    try {
      equipmentEffectIndexState.abortToken = (Number(equipmentEffectIndexState.abortToken) || 0) + 1;
      equipmentEffectIndexState.running = false;
      equipmentEffectIndexState.queue = [];
      if (equipmentEffectIndexState.tickTimer) clearTimeout(equipmentEffectIndexState.tickTimer);
      equipmentEffectIndexState.tickTimer = null;
      notifyEquipmentEffectIndexUpdate();
      return true;
    } catch {
      return false;
    }
  }

  function isEquipmentEffectIndexReady() {
    try {
      if (!baseEntries) baseEntries = buildBaseEntries();
      const list = baseEntries.filter((e) => e.kind === 'equipment');
      for (const entry of list) {
        const key = cyclopediaNormalizeSearchText(entry.label);
        if (!key) continue;
        const cached = ensureEquipmentEffectTextCache().get(key);
        if (!isEquipmentEffectCacheEntryUpToDate(entry.label, cached)) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  function startEquipmentEffectIndexing() {
    try {
      if (typeof globalThis.state?.utils?.createUIComponent !== 'function') return;
      if (equipmentEffectIndexState.running) return;

      if (!baseEntries) baseEntries = buildBaseEntries();
      const list = baseEntries.filter((e) => e.kind === 'equipment');
      const cache = ensureEquipmentEffectTextCache();
      const missing = list
        .map((e) => e.label)
        .filter((name) => {
          const key = cyclopediaNormalizeSearchText(name);
          if (!key) return false;
          return !isEquipmentEffectCacheEntryUpToDate(name, cache.get(key));
        });

      if (missing.length === 0) {
        equipmentEffectIndexState.queue = [];
        equipmentEffectIndexState.total = list.length;
        equipmentEffectIndexState.done = list.length;
        equipmentEffectIndexState.running = false;
        notifyEquipmentEffectIndexUpdate();
        return;
      }

      equipmentEffectIndexState.queue = missing;
      equipmentEffectIndexState.total = list.length;
      equipmentEffectIndexState.done = list.length - missing.length;
      equipmentEffectIndexState.running = true;
      notifyEquipmentEffectIndexUpdate();

      const tick = () => {
        if (!equipmentEffectIndexState.running) return;

        const next = equipmentEffectIndexState.queue.shift();
        if (!next) {
          equipmentEffectIndexState.running = false;
          equipmentEffectIndexState.done = equipmentEffectIndexState.total;
          notifyEquipmentEffectIndexUpdate();
          return;
        }

        const key = cyclopediaNormalizeSearchText(next);
        if (key && isEquipmentEffectCacheEntryUpToDate(next, cache.get(key))) {
          equipmentEffectIndexState.done++;
          notifyEquipmentEffectIndexUpdate();
          equipmentEffectIndexState.tickTimer = setTimeout(tick, 5);
          return;
        }

        extractEquipmentEffectTextAsync(next, (rawText) => {
          try {
            if (key) {
              const meta = getEquipmentMetaByName(next);
              const needsRender = equipmentHasRenderedEffectMeta(meta);
              const prefixOnly = cyclopediaNormalizeSearchText(buildEquipmentEffectTextPrefix(meta));
              const text = rawText || prefixOnly || '';
              const prior = cache.get(key);
              const retries = Number(prior?.retries) || 0;

              if (needsRender && !text.trim() && retries < 2) {
                cache.set(key, {
                  v: EQUIPMENT_EFFECT_TEXT_CACHE_VERSION,
                  text: '',
                  indexed: false,
                  retries: retries + 1
                });
                equipmentEffectIndexState.queue.push(next);
              } else {
                cache.set(key, {
                  v: EQUIPMENT_EFFECT_TEXT_CACHE_VERSION,
                  text,
                  indexed: true,
                  retries
                });
              }
            }
          } catch {
            // ignore
          }
          equipmentEffectIndexState.done++;
          notifyEquipmentEffectIndexUpdate();
          equipmentEffectIndexState.tickTimer = setTimeout(tick, 5);
        });
      };

      equipmentEffectIndexState.tickTimer = setTimeout(tick, 5);
    } catch {
      // ignore
    }
  }

  function ensureEquipmentEffectIndexReady() {
    try {
      if (typeof globalThis.state?.utils?.createUIComponent !== 'function') return Promise.resolve(false);
      if (isEquipmentEffectIndexReady()) return Promise.resolve(true);
      if (equipmentEffectIndexPromise) return equipmentEffectIndexPromise;

      equipmentEffectIndexPromise = new Promise((resolve) => {
        let resolved = false;
        let timeoutId = null;
        const abortTokenAtStart = Number(equipmentEffectIndexState.abortToken) || 0;

        const cleanupAndResolve = (value) => {
          if (resolved) return;
          resolved = true;
          equipmentEffectIndexPromise = null;
          if (timeoutId) clearTimeout(timeoutId);
          resolve(value);
        };

        const unsubscribe = (() => {
          const listener = (progress) => {
            if ((Number(equipmentEffectIndexState.abortToken) || 0) !== abortTokenAtStart) {
              try { equipmentEffectIndexState.listeners.delete(listener); } catch { /* ignore */ }
              cleanupAndResolve(false);
              return;
            }
            const done =
              !progress?.running &&
              (progress?.total || 0) > 0 &&
              (progress?.done || 0) >= (progress?.total || 0);
            if (done || isEquipmentEffectIndexReady()) {
              try { equipmentEffectIndexState.listeners.delete(listener); } catch { /* ignore */ }
              cleanupAndResolve(true);
            }
          };
          equipmentEffectIndexState.listeners.add(listener);
          try { listener(getEquipmentEffectIndexProgress()); } catch { /* ignore */ }
          return () => equipmentEffectIndexState.listeners.delete(listener);
        })();

        timeoutId = setTimeout(() => {
          try { unsubscribe(); } catch { /* ignore */ }
          cleanupAndResolve(false);
        }, 20000);
        try { TimerManager.addTimeout(timeoutId, 'homeSearchEquipEffectIndexWait'); } catch { /* ignore */ }

        startEquipmentEffectIndexing();
      });

      return equipmentEffectIndexPromise;
    } catch {
      equipmentEffectIndexPromise = null;
      return Promise.resolve(false);
    }
  }

  function resolveMonsterIdByName(creatureName) {
    try {
      if (!creatureName || typeof creatureName !== 'string') return null;
      const key = creatureName.toLowerCase();
      try {
        // Ensure name map is built (safe; function is hoisted)
        if (typeof buildCyclopediaMonsterNameMap === 'function') buildCyclopediaMonsterNameMap();
      } catch {
        // ignore
      }

      const entry = cyclopediaState?.monsterNameMap?.get?.(key);
      if (entry) {
        const m = entry.monster;
        if (m?.gameId !== undefined) return m.gameId;
        if (entry.index !== undefined) return entry.index;
      }

      const maps = window.BestiaryModAPI?.utility?.maps;
      const gameId = maps?.monsterNamesToGameIds?.get?.(key);
      return gameId ?? null;
    } catch {
      return null;
    }
  }

  function collectStringLeaves(value, out, depth = 0) {
    if (!value || depth > 3) return;
    if (typeof value === 'string') {
      // Skip obvious URLs/paths that don't help search
      if (value.startsWith('http://') || value.startsWith('https://')) return;
      out.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.slice(0, 20).forEach((v) => collectStringLeaves(v, out, depth + 1));
      return;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value).slice(0, 30);
      for (const [, v] of entries) collectStringLeaves(v, out, depth + 1);
    }
  }

  function tryRenderTooltipContentToText(TooltipContent, props) {
    try {
      const createUIComponent = globalThis.state?.utils?.createUIComponent;
      if (typeof createUIComponent !== 'function') return '';
      if (!TooltipContent) return '';

      const host = document.createElement('div');
      // Off-screen but with real size so components that depend on layout still render.
      host.style.cssText = 'position:fixed;left:-99999px;top:0;width:520px;max-width:520px;height:auto;overflow:visible;opacity:0;pointer-events:none;z-index:-1;';
      const root = document.createElement('div');
      root.classList.add('tooltip-prose');
      root.classList.add(FONT_CONSTANTS.SIZES.SMALL);
      root.style.width = '100%';
      root.style.height = '100%';
      root.style.color = COLOR_CONSTANTS.TEXT;
      root.style.lineHeight = '1.1';
      host.appendChild(root);
      document.body.appendChild(host);

      const component = props ? createUIComponent(root, TooltipContent, props) : createUIComponent(root, TooltipContent);
      if (component && typeof component.mount === 'function') component.mount();

      const text = root.textContent || '';

      if (component && typeof component.unmount === 'function') component.unmount();
      host.remove();
      return text;
    } catch {
      return '';
    }
  }

  function extractAbilityTextAsync(creatureName, onDone) {
    try {
      const monsterId = resolveMonsterIdByName(creatureName);
      const monsterData = monsterId ? safeGetMonsterData(monsterId) : null;
      const skill = monsterData?.metadata?.skill;
      const TooltipContent = skill?.TooltipContent;
      const createUIComponent = globalThis.state?.utils?.createUIComponent;
      let prefixText = '';
      try {
        if (skill) {
          // Best-effort: include any string metadata in skill object (cheap, helps search).
          const leaves = [];
          collectStringLeaves(skill, leaves);
          const leafText = leaves.join('\n');
          if (leafText) prefixText += leafText + '\n';
        }
      } catch {
        // ignore
      }

      if (!TooltipContent || typeof createUIComponent !== 'function') {
        onDone(prefixText);
        return;
      }

      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-99999px;top:0;width:520px;max-width:520px;height:auto;overflow:visible;opacity:0;pointer-events:none;z-index:-1;';
      const root = document.createElement('div');
      root.classList.add('tooltip-prose');
      root.classList.add(FONT_CONSTANTS.SIZES.SMALL);
      root.style.width = '100%';
      root.style.height = 'auto';
      root.style.color = COLOR_CONSTANTS.TEXT;
      root.style.lineHeight = '1.1';
      host.appendChild(root);
      document.body.appendChild(host);

      // Render -> flush -> read (normal), then render awakened -> flush -> read.
      const mountAndRead = (props, cb) => {
        let component = null;
        try {
          root.textContent = '';
          component = props ? createUIComponent(root, TooltipContent, props) : createUIComponent(root, TooltipContent);
          if (component && typeof component.mount === 'function') component.mount();
        } catch {
          cb('', component);
          return;
        }

        requestAnimationFrame(() => {
          let text = '';
          try {
            text = root.textContent || '';
          } catch {
            text = '';
          }
          cb(text, component);
        });
      };

      mountAndRead(null, (normalText, normalComponent) => {
        try {
          if (normalComponent && typeof normalComponent.unmount === 'function') normalComponent.unmount();
        } catch {
          // ignore
        }

        mountAndRead({ awaken: true }, (awakenedText, awakenedComponent) => {
          try {
            if (awakenedComponent && typeof awakenedComponent.unmount === 'function') awakenedComponent.unmount();
          } catch {
            // ignore
          }
          try { host.remove(); } catch { /* ignore */ }

          const combined = `${prefixText || ''}${normalText || ''}\n${awakenedText || ''}`.trim();
          onDone(combined);
        });
      });
    } catch {
      onDone('');
    }
  }

  function getCreatureAbilityText(creatureName) {
    const cache = ensureCreatureAbilityTextCache();
    const key = cyclopediaNormalizeSearchText(creatureName);
    if (!key) return '';
    if (cache.has(key)) {
      const cached = cache.get(key);
      if (isAbilityTextCacheEntryUpToDate(cached)) return cached.text;
      if (typeof cached === 'string') return cached;
    }

    let text = '';
    try {
      const monsterId = resolveMonsterIdByName(creatureName);
      const monsterData = monsterId ? safeGetMonsterData(monsterId) : null;
      const skill = monsterData?.metadata?.skill;

      if (skill) {
        // Fast path: collect any string fields that might exist in skill metadata
        const leaves = [];
        collectStringLeaves(skill, leaves);
        const leafText = leaves.join('\n');
        if (leafText) text += leafText + '\n';

        // TooltipContent is what renders the actual ability description in the UI
        const TooltipContent = skill.TooltipContent;
        if (TooltipContent) {
          const normal = tryRenderTooltipContentToText(TooltipContent, null);
          if (normal) text += normal + '\n';

          // Also include awakened mode text (if supported)
          const awakened = tryRenderTooltipContentToText(TooltipContent, { awaken: true });
          if (awakened) text += awakened + '\n';
        }
      }
    } catch {
      text = text || '';
    }

    text = cyclopediaNormalizeSearchText(text);
    cache.set(key, { v: ABILITY_TEXT_CACHE_VERSION, text });
    return text;
  }

  function startAbilityIndexing() {
    try {
      const createUIComponent = globalThis.state?.utils?.createUIComponent;
      if (typeof createUIComponent !== 'function') return;
      if (abilityIndexState.running) return;

      if (!baseEntries) baseEntries = buildBaseEntries();
      const creatureEntries = baseEntries.filter(e => e.kind === 'creature');
      const cache = ensureCreatureAbilityTextCache();
      const allNames = creatureEntries.map(e => e.label);
      const missing = allNames.filter((name) => {
        const key = cyclopediaNormalizeSearchText(name);
        // If entry is missing or stale, (re)index it.
        if (!key) return false;
        const cached = cache.get(key);
        return !isAbilityTextCacheEntryUpToDate(cached);
      });

      // If everything is already indexed, do NOT restart indexing (prevents constant UI refresh).
      if (missing.length === 0) {
        abilityIndexState.queue = [];
        abilityIndexState.total = allNames.length;
        abilityIndexState.done = allNames.length;
        abilityIndexState.running = false;
        notifyAbilityIndexUpdate();
        return;
      }

      abilityIndexState.queue = missing;
      abilityIndexState.total = allNames.length;
      abilityIndexState.done = allNames.length - missing.length;
      abilityIndexState.running = true;
      notifyAbilityIndexUpdate();

      const tick = () => {
        // Stop if reset/finished
        if (!abilityIndexState.running) return;

        const next = abilityIndexState.queue.shift();
        if (!next) {
          abilityIndexState.running = false;
          // Ensure we report full completion once.
          abilityIndexState.done = abilityIndexState.total;
          notifyAbilityIndexUpdate();
          return;
        }

        const key = cyclopediaNormalizeSearchText(next);
        if (key && isAbilityTextCacheEntryUpToDate(cache.get(key))) {
          abilityIndexState.done++;
          notifyAbilityIndexUpdate();
          abilityIndexState.tickTimer = setTimeout(tick, 5);
          return;
        }

        extractAbilityTextAsync(next, (rawText) => {
          try {
            const normalized = cyclopediaNormalizeSearchText(rawText);
            if (key) cache.set(key, { v: ABILITY_TEXT_CACHE_VERSION, text: normalized });
          } catch {
            // ignore
          }
          abilityIndexState.done++;
          notifyAbilityIndexUpdate();
          abilityIndexState.tickTimer = setTimeout(tick, 5);
        });
      };

      abilityIndexState.tickTimer = setTimeout(tick, 5);
    } catch {
      // ignore
    }
  }

  function snippetAroundMatch(fullText, qNorm) {
    if (!fullText || !qNorm) return '';
    const idx = fullText.indexOf(qNorm);
    if (idx < 0) return '';
    const start = Math.max(0, idx - 40);
    const end = Math.min(fullText.length, idx + qNorm.length + 60);
    const raw = fullText.slice(start, end).trim();
    return raw ? `…${raw}…` : '';
  }

  function buildBaseEntries() {
    const entries = [];

    // Creatures (name + roles) — gazers live under Inventory → Gazers
    const creatureNames = [
      ...getCyclopediaBestiaryCreatures(),
      ...(Array.isArray(GAME_DATA.UNOBTAINABLE_CREATURES) ? GAME_DATA.UNOBTAINABLE_CREATURES : [])
    ];
    creatureNames.forEach((name) => {
      const roles = (() => {
        try {
          return getCreatureRoles(name) || [];
        } catch {
          return [];
        }
      })();
      const roleText = Array.isArray(roles) ? roles.join(' ') : '';

      entries.push({
        kind: 'creature',
        label: name,
        search: cyclopediaNormalizeSearchText(`${name} ${roleText}`),
        target: { type: 'creature', name }
      });
    });

    // Equipment (name + light metadata)
    const equipmentNames = Array.isArray(GAME_DATA.ALL_EQUIPMENT) ? GAME_DATA.ALL_EQUIPMENT : [];
    equipmentNames.forEach((name) => {
      let statusText = '';
      try {
        const st = getEquipmentStatus(name);
        statusText = `${st?.owned ? 'owned' : 'unowned'} ${st?.isT5 ? 't5' : ''}`;
      } catch {
        statusText = '';
      }

      const boostedWiki = GAME_DATA.HARDCODED_BOOSTED_MAP?.[name];
      const boostedText = typeof boostedWiki === 'string' ? boostedWiki : '';

      entries.push({
        kind: 'equipment',
        label: name,
        search: cyclopediaNormalizeSearchText(`${name} ${statusText} ${boostedText}`),
        target: { type: 'equipment', name }
      });
    });

    getCyclopediaGazerNames().forEach((name) => {
      let roleText = '';
      try {
        roleText = (getCreatureRoles(name) || []).join(' ');
      } catch {
        roleText = '';
      }
      entries.push({
        kind: 'inventoryItem',
        label: name,
        search: cyclopediaNormalizeSearchText(`${name} ${roleText} gazer creature`),
        subtitle: CYCLOPEDIA_GAZERS_CATEGORY,
        target: {
          type: 'inventoryItem',
          categoryName: CYCLOPEDIA_GAZERS_CATEGORY,
          catalogLabel: name,
          itemDisplayName: name,
          itemKey: name
        }
      });
    });

    // Inventory categories + items
    const categories = getCyclopediaInventoryCategories();
    Object.entries(categories).forEach(([categoryName, itemKeys]) => {
      entries.push({
        kind: 'inventoryCategory',
        label: categoryName,
        search: cyclopediaNormalizeSearchText(`${categoryName} inventory`),
        target: { type: 'inventoryCategory', categoryName }
      });

      if (categoryName === CYCLOPEDIA_GAZERS_CATEGORY) return;

      if (!Array.isArray(itemKeys)) return;
      itemKeys.forEach((catalogLabel) => {
        cyclopediaGetInventoryKeysForCatalogLabel(catalogLabel).forEach((itemKey) => {
          const displayName = cyclopediaGetInventoryDisplayName(itemKey);
          const obtainText = cyclopediaGetInventoryObtainText(itemKey, displayName);
          entries.push({
            kind: 'inventoryItem',
            label: displayName,
            itemKey,
            search: cyclopediaNormalizeSearchText(`${displayName} ${catalogLabel} ${categoryName} ${obtainText}`),
            subtitle: categoryName,
            target: {
              type: 'inventoryItem',
              categoryName,
              catalogLabel,
              itemDisplayName: displayName,
              itemKey
            }
          });
        });
      });
    });

    // Regions + maps (from game state)
    const regions = safeGetRegions();
    const roomNameMap = globalThis.state?.utils?.ROOM_NAME || {};
    const roomIdToRegionId = buildRoomIdToRegionId(regions);

    regions.forEach((region) => {
      const regionId = region?.id;
      if (!regionId) return;

      const regionName = getRegionDisplayName(regionId);
      entries.push({
        kind: 'map',
        label: regionName,
        search: cyclopediaNormalizeSearchText(`${regionName} ${regionId} region`),
        subtitle: 'Region',
        target: { type: 'region', regionId, regionName }
      });

      const rooms = Array.isArray(region.rooms) ? region.rooms : [];
      rooms.forEach((room) => {
        const roomId = room?.id;
        if (!roomId) return;
        const mapName = roomNameMap[roomId] || roomId;

        let meta = '';
        try {
          const raid = isMapRaid(roomId);
          const dynamic = isDynamicEventMap(roomId);
          const diff = globalThis.state?.utils?.ROOMS?.[roomId]?.difficulty;
          meta = `${raid ? 'raid' : ''} ${dynamic ? 'event' : ''} ${diff ? `difficulty ${diff}` : ''}`;
        } catch {
          meta = '';
        }

        entries.push({
          kind: 'map',
          label: mapName,
          search: cyclopediaNormalizeSearchText(`${mapName} ${regionName} ${meta}`),
          subtitle: regionName,
          target: {
            type: 'map',
            regionId: roomIdToRegionId.get(roomId) || regionId,
            regionName,
            mapId: roomId,
            mapName
          }
        });
      });
    });

    // Also include maps that are not present in REGIONS (fallback)
    Object.entries(roomNameMap).forEach(([roomId, mapName]) => {
      const alreadyIncluded = entries.some((e) => e.kind === 'map' && e.target?.mapId === roomId);
      if (alreadyIncluded) return;

      const regionId = roomIdToRegionId.get(roomId);
      const regionName = regionId ? getRegionDisplayName(regionId) : 'Other Maps';

      entries.push({
        kind: 'map',
        label: mapName || roomId,
        search: cyclopediaNormalizeSearchText(`${mapName || roomId} ${regionName}`),
        subtitle: regionName,
        target: { type: 'map', regionId, regionName, mapId: roomId, mapName: mapName || roomId }
      });
    });

    return entries;
  }

  function scoreSingleSearchCondition(entry, condition) {
    const labelNorm = entry.labelNorm ?? cyclopediaNormalizeSearchText(entry.label);
    const searchBlob = entry.search || labelNorm;
    const { isExact, value } = cyclopediaExtractQuotedString(condition);
    const q = isExact ? value : cyclopediaNormalizeSearchText(condition);
    if (!q || q.length < 2) return 0;
    if (isExact) {
      if (labelNorm === q) return 100;
      if (searchBlob === q) return 90;
      return 0;
    }
    if (labelNorm === q) return 100;
    if (labelNorm.startsWith(q)) return 80;
    if (labelNorm.includes(q)) return 60;
    if (searchBlob.includes(q)) return 40;
    return 0;
  }

  function scoreEntry(entry, qNorm, scoreOpts = null) {
    // Cache label normalization on the entry to avoid re-normalizing on every keystroke.
    const labelNorm = entry.labelNorm ?? (entry.labelNorm = cyclopediaNormalizeSearchText(entry.label));
    if (!labelNorm) return 0;

    const exactPhrases = scoreOpts?.exactPhrases;
    if (scoreOpts?.isExactMode && Array.isArray(exactPhrases) && exactPhrases.length > 0) {
      return exactPhrases.some((phrase) => labelNorm === phrase) ? 100 : 0;
    }

    if (scoreOpts?.isBooleanMode && scoreOpts.booleanExpression) {
      if (!cyclopediaEntryMatchesBoolean(entry, scoreOpts.booleanExpression)) return 0;
      const leaves = cyclopediaCollectBooleanLeaves(scoreOpts.booleanExpression);
      let best = 0;
      for (const leaf of leaves) {
        best = Math.max(best, scoreSingleSearchCondition(entry, leaf));
      }
      return best || 40;
    }

    if (labelNorm === qNorm) return 100;
    if (labelNorm.startsWith(qNorm)) return 80;
    if (labelNorm.includes(qNorm)) return 60;
    if (entry.search?.includes(qNorm)) return 40;
    return 0;
  }

  function kindLabel(kind) {
    switch (kind) {
      case 'creature': return 'Creature';
      case 'ability': return 'Ability';
      case 'equipment': return 'Equipment';
      case 'inventoryCategory': return 'Inventory';
      case 'inventoryItem': return 'Item';
      case 'map': return 'Map';
      case 'region': return 'Region';
      default: return 'Result';
    }
  }

  function appendMapResultsForMatchedSpawns(results, existingMapIds, matchedLabels, labelToRoomIds, spawnVerb) {
    if (!matchedLabels?.size || !labelToRoomIds) return;

    ensureRoomCreatureIndex();
    const roomNameMap = globalThis.state?.utils?.ROOM_NAME || {};
    const regions = safeGetRegions();
    const roomIdToRegionId = buildRoomIdToRegionId(regions);
    const mapCandidates = [];

    for (const label of matchedLabels) {
      const key = cyclopediaNormalizeSearchText(label);
      const roomIds = labelToRoomIds.get(key);
      if (!roomIds) continue;
      for (const roomId of roomIds) {
        if (!isPlayableRoomId(roomId, roomNameMap)) continue;
        if (existingMapIds.has(roomId)) continue;
        mapCandidates.push({ roomId, label });
        existingMapIds.add(roomId);
      }
    }

    mapCandidates
      .sort((a, b) => {
        const nameA = roomNameMap[a.roomId] || a.roomId;
        const nameB = roomNameMap[b.roomId] || b.roomId;
        return nameA.localeCompare(nameB);
      })
      .slice(0, MAX_META_MAPS)
      .forEach(({ roomId, label }) => {
        const mapName = roomNameMap[roomId] || roomId;
        const regionId = roomIdToRegionId.get(roomId);
        const regionName = regionId ? getRegionDisplayName(regionId) : 'Other Maps';
        results.push({
          kind: 'map',
          kindLabel: 'Map',
          label: mapName,
          subtitle: `${regionName} · ${spawnVerb} ${label}`,
          target: {
            type: 'map',
            regionId: regionId || null,
            regionName,
            mapId: roomId,
            mapName
          }
        });
      });
  }

  function appendEquipmentWornByCreatures(results, matchedCreatureNames) {
    if (!matchedCreatureNames?.size) return;

    ensureRoomCreatureIndex();
    const existingEquipKeys = new Set(
      results
        .filter((r) => r.kind === 'equipment')
        .map((r) => cyclopediaNormalizeSearchText(r.label))
    );
    const rows = [];

    for (const creatureName of matchedCreatureNames) {
      const key = cyclopediaNormalizeSearchText(creatureName);
      const equips = creatureToEquipmentNames?.get(key);
      if (!equips) continue;
      for (const equipName of equips) {
        const equipKey = cyclopediaNormalizeSearchText(equipName);
        if (existingEquipKeys.has(equipKey)) continue;
        existingEquipKeys.add(equipKey);
        rows.push({ equipName, creatureName });
      }
    }

    rows
      .sort((a, b) => a.equipName.localeCompare(b.equipName) || a.creatureName.localeCompare(b.creatureName))
      .slice(0, MAX_META_CREATURE_EQUIPS)
      .forEach(({ equipName, creatureName }) => {
        results.push({
          kind: 'equipment',
          kindLabel: 'Equipment',
          label: equipName,
          subtitle: `On ${creatureName}`,
          target: { type: 'equipment', name: equipName }
        });
      });
  }

  function buildMapNameToRoomId() {
    const roomNameMap = globalThis.state?.utils?.ROOM_NAME || {};
    const nameToRoomId = new Map();
    Object.entries(roomNameMap).forEach(([roomId, mapName]) => {
      if (!nameToRoomId.has(mapName)) nameToRoomId.set(mapName, roomId);
    });
    return { roomNameMap, nameToRoomId };
  }

  function getBoostedRoomEntriesForEquipment(equipmentName) {
    const wiki = GAME_DATA.HARDCODED_BOOSTED_MAP?.[equipmentName];
    if (wiki === false || typeof wiki !== 'string' || !wiki.trim()) return [];

    const { roomNameMap, nameToRoomId } = buildMapNameToRoomId();
    const regions = safeGetRegions();
    const roomIdToRegionId = buildRoomIdToRegionId(regions);
    const entries = [];

    wiki
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((mapName) => {
        const roomId = nameToRoomId.get(mapName);
        if (!roomId || !isPlayableRoomId(roomId, roomNameMap)) return;
        const regionId = roomIdToRegionId.get(roomId);
        entries.push({
          roomId,
          mapName,
          regionId: regionId || null,
          regionName: regionId ? getRegionDisplayName(regionId) : 'Other Maps'
        });
      });

    return entries;
  }

  function appendBoostedMapResultsForEquipment(results, existingMapIds, matchedEquipmentNames) {
    if (!matchedEquipmentNames?.size) return;

    const mapCandidates = [];
    for (const equipmentName of matchedEquipmentNames) {
      for (const entry of getBoostedRoomEntriesForEquipment(equipmentName)) {
        if (existingMapIds.has(entry.roomId)) continue;
        mapCandidates.push({ ...entry, equipmentName });
        existingMapIds.add(entry.roomId);
      }
    }

    mapCandidates
      .sort((a, b) => a.mapName.localeCompare(b.mapName) || a.equipmentName.localeCompare(b.equipmentName))
      .slice(0, MAX_META_MAPS)
      .forEach(({ roomId, mapName, regionId, regionName, equipmentName }) => {
        results.push({
          kind: 'map',
          kindLabel: 'Map',
          label: mapName,
          subtitle: `${regionName} · Boosted: ${equipmentName}`,
          target: {
            type: 'map',
            regionId,
            regionName,
            mapId: roomId,
            mapName
          }
        });
      });
  }

  function appendEquipmentMentionedInAbilityText(results, parsed, existingEquipKeys) {
    if (!equipmentEntries?.length) return;
    if (parsed.isBooleanMode) {
      if (!cyclopediaBooleanExpressionHasValidTerm(parsed.booleanExpression)) return;
    } else if (!parsed.qNorm) {
      return;
    }

    const abilityCreatures = results.filter((r) => r.kind === 'ability' && r.label).map((r) => r.label);
    for (const creatureName of abilityCreatures) {
      const abilityText = getCreatureAbilityText(creatureName);
      if (!effectTextMatchesQuery(abilityText, parsed)) continue;

      for (const eqEntry of equipmentEntries) {
        const eqKey = eqEntry.labelNorm ?? cyclopediaNormalizeSearchText(eqEntry.label);
        if (!eqKey || eqKey.length < 2) continue;
        if (!abilityText.includes(eqKey)) continue;
        if (existingEquipKeys.has(eqKey)) continue;

        existingEquipKeys.add(eqKey);
        results.push({
          kind: 'equipment',
          kindLabel: 'Equipment',
          label: eqEntry.label,
          subtitle: `Referenced in ${creatureName} ability`,
          target: { type: 'equipment', name: eqEntry.label }
        });
      }
    }
  }

  function appendEquipmentEffectSearchResults(results, parsed, existingEquipKeys) {
    const wantsEffectPass = parsed.isBooleanMode
      ? cyclopediaBooleanExpressionHasValidTerm(parsed.booleanExpression)
      : (parsed.qNorm || '').length >= 3;
    if (!wantsEffectPass) return;

    const qSnippet = cyclopediaFirstMatchingLeafForSnippet(parsed);
    const equipEffectRows = [];
    for (const entry of equipmentEntries) {
      if (entryAlreadyMatchesQuery(entry, parsed)) continue;

      const nameKey = entry.labelNorm ?? cyclopediaNormalizeSearchText(entry.label);
      if (existingEquipKeys.has(nameKey)) continue;

      const effectText = getEquipmentEffectText(entry.label);
      if (effectText && effectTextMatchesQuery(effectText, parsed)) {
        equipEffectRows.push({ entry, effectText, nameKey });
      }
    }

    equipEffectRows
      .sort((a, b) => a.entry.label.localeCompare(b.entry.label))
      .slice(0, MAX_META_EQUIP_EFFECT)
      .forEach(({ entry, effectText, nameKey }) => {
        results.push({
          kind: 'equipment',
          kindLabel: 'Equipment',
          label: entry.label,
          subtitle: snippetAroundMatch(effectText, qSnippet) || 'Effect match',
          target: { type: 'equipment', name: entry.label }
        });
        existingEquipKeys.add(nameKey);
      });
  }

  function collectMatchedEquipmentNames(results, qNorm, scoreOpts) {
    const names = new Set();
    for (const entry of equipmentEntries) {
      if (scoreEntry(entry, qNorm, scoreOpts) > 0) names.add(entry.label);
    }
    results.forEach((r) => {
      if (r.kind === 'equipment' && r.label) names.add(r.label);
      if (r.target?.type === 'equipment' && r.label) names.add(r.label);
    });
    return names;
  }

  function resolveExactModePrimaryKind(exactPhrases) {
    if (!Array.isArray(exactPhrases) || exactPhrases.length === 0) return null;
    if (!equipmentEntries || !creatureEntries) {
      if (!baseEntries) baseEntries = buildBaseEntries();
      if (!equipmentEntries) equipmentEntries = baseEntries.filter((e) => e.kind === 'equipment');
      if (!creatureEntries) creatureEntries = baseEntries.filter((e) => e.kind === 'creature');
    }
    for (const phrase of exactPhrases) {
      if (equipmentEntries.some((e) => (e.labelNorm ?? cyclopediaNormalizeSearchText(e.label)) === phrase)) {
        return 'equipment';
      }
    }
    for (const phrase of exactPhrases) {
      if (creatureEntries.some((e) => (e.labelNorm ?? cyclopediaNormalizeSearchText(e.label)) === phrase)) {
        return 'creature';
      }
    }
    return null;
  }

  function sortExactModeResults(results, parsed) {
    const primaryKind = resolveExactModePrimaryKind(parsed?.exactPhrases);
    const kindOrder =
      primaryKind === 'equipment'
        ? { equipment: 0, map: 1, creature: 2, ability: 3 }
        : primaryKind === 'creature'
          ? { creature: 0, map: 1, equipment: 2, ability: 3 }
          : { creature: 0, map: 1, equipment: 2, ability: 3 };
    results.sort(
      (a, b) =>
        (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9) ||
        a.label.localeCompare(b.label)
    );
  }

  function search(query) {
    const parsed = parseCyclopediaHomeSearchQuery(query);
    const scoreOpts = parsed.isExactMode
      ? { isExactMode: true, exactPhrases: parsed.exactPhrases }
      : parsed.isBooleanMode
        ? { isBooleanMode: true, booleanExpression: parsed.booleanExpression }
        : null;

    if (parsed.isExactMode) {
      if (!parsed.exactPhrases.some((p) => p.length >= 2)) {
        return { query: parsed.exactPhrases[0] || '', results: [], isExactMode: true };
      }
    } else if (parsed.isBooleanMode) {
      if (!cyclopediaBooleanExpressionHasValidTerm(parsed.booleanExpression)) {
        return { query: parsed.booleanExpression || '', results: [], isBooleanMode: true };
      }
    } else if (!parsed.qNorm || parsed.qNorm.length < 2) {
      return { query: parsed.qNorm, results: [] };
    }

    const qNorm = parsed.qNorm;

    if (!baseEntries) baseEntries = buildBaseEntries();
    if (!creatureEntries) creatureEntries = baseEntries.filter(e => e.kind === 'creature');
    if (!equipmentEntries) equipmentEntries = baseEntries.filter(e => e.kind === 'equipment');

    // Top-N selection without sorting the full scored list.
    // Heap holds the current "worst" of the best-N so we can evict quickly.
    const bestHeap = [];

    const isWorse = (a, b) => {
      // a worse than b:
      // - lower score is worse
      // - when score ties, later label is worse (since earlier label sorts first)
      if (a.score !== b.score) return a.score < b.score;
      return a.entry.label.localeCompare(b.entry.label) > 0;
    };

    const heapSiftUp = (idx) => {
      while (idx > 0) {
        const parent = (idx - 1) >> 1;
        // If current is worse than parent, swap to keep the worst at the top.
        if (!isWorse(bestHeap[idx], bestHeap[parent])) break;
        const tmp = bestHeap[parent];
        bestHeap[parent] = bestHeap[idx];
        bestHeap[idx] = tmp;
        idx = parent;
      }
    };

    const heapSiftDown = (idx) => {
      const n = bestHeap.length;
      while (true) {
        const left = idx * 2 + 1;
        if (left >= n) break;
        const right = left + 1;
        let worstChild = left;
        if (right < n && isWorse(bestHeap[right], bestHeap[left])) worstChild = right;
        // If child is worse than current, swap.
        if (!isWorse(bestHeap[worstChild], bestHeap[idx])) break;
        const tmp = bestHeap[idx];
        bestHeap[idx] = bestHeap[worstChild];
        bestHeap[worstChild] = tmp;
        idx = worstChild;
      }
    };

    for (const entry of baseEntries) {
      const score = scoreEntry(entry, qNorm, scoreOpts);
      if (score <= 0) continue;

      const item = { entry, score };
      if (bestHeap.length < MAX_RESULTS) {
        bestHeap.push(item);
        heapSiftUp(bestHeap.length - 1);
        continue;
      }

      // Root is the current "worst" among the best-N. If the new item is better,
      // replace root and restore heap property.
      if (isWorse(bestHeap[0], item)) {
        bestHeap[0] = item;
        heapSiftDown(0);
      }
    }

    bestHeap.sort((a, b) => (b.score - a.score) || a.entry.label.localeCompare(b.entry.label));
    const results = bestHeap.map(({ entry }) => ({
      kind: entry.kind,
      kindLabel: kindLabel(entry.kind),
      label: entry.label,
      subtitle: entry.subtitle || '',
      itemKey: entry.itemKey,
      target: entry.target
    }));

    // Metadata: if query matches a map/region name, also include creatures present there (not in "exact" mode)
    if (!parsed.isExactMode) try {
      const extraCreatureKeys = new Set(results.filter(r => r.kind === 'creature').map(r => cyclopediaNormalizeSearchText(r.label)));
      const roomNameMap = globalThis.state?.utils?.ROOM_NAME || {};
      const regions = safeGetRegions();

      const matchedRoomIds = Object.entries(roomNameMap)
        .filter(([, name]) => cyclopediaTextMatchesSearchQuery(name, parsed))
        .slice(0, 3)
        .map(([roomId]) => roomId);

      const matchedRegionIds = regions
        .filter((r) => cyclopediaTextMatchesSearchQuery(getRegionDisplayName(r.id), parsed))
        .slice(0, 2)
        .map((r) => r.id);

      if (matchedRoomIds.length > 0 || matchedRegionIds.length > 0) {
        const idx = ensureRoomCreatureIndex();
        const creatureCounts = new Map(); // name -> count
        const roomContext = new Map(); // name -> one mapName

        matchedRoomIds.forEach((roomId) => {
          const set = idx.get(roomId);
          if (!set) return;
          const mapName = roomNameMap[roomId] || roomId;
          for (const creatureName of set) {
            creatureCounts.set(creatureName, (creatureCounts.get(creatureName) || 0) + 1);
            if (!roomContext.has(creatureName)) roomContext.set(creatureName, mapName);
          }
        });

        matchedRegionIds.forEach((regionId) => {
          const region = regions.find((r) => r.id === regionId);
          if (!region?.rooms) return;
          region.rooms.slice(0, 30).forEach((room) => {
            const roomId = room?.id;
            if (!roomId) return;
            const set = idx.get(roomId);
            if (!set) return;
            const mapName = roomNameMap[roomId] || roomId;
            for (const creatureName of set) {
              creatureCounts.set(creatureName, (creatureCounts.get(creatureName) || 0) + 1);
              if (!roomContext.has(creatureName)) roomContext.set(creatureName, mapName);
            }
          });
        });

        const extra = Array.from(creatureCounts.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, MAX_META_CREATURES)
          .map(([name]) => ({ name, where: roomContext.get(name) }));

        extra.forEach(({ name, where }) => {
          const key = cyclopediaNormalizeSearchText(name);
          if (extraCreatureKeys.has(key)) return;
          results.push({
            kind: 'creature',
            kindLabel: 'Creature',
            label: name,
            subtitle: where ? `Spawns in: ${where}` : 'Spawns in matching map/region',
            target: { type: 'creature', name }
          });
          extraCreatureKeys.add(key);
        });
      }
    } catch (error) {
      // Best-effort only
      console.warn('[Cyclopedia] HomeSearch: metadata expansion failed:', error);
    }

    // Creature / equipment query: maps where matched spawns appear (Room Hopper board data)
    try {
      const existingMapIds = new Set(
        results.filter((r) => r.kind === 'map' && r.target?.mapId).map((r) => r.target.mapId)
      );

      const matchedCreatureNames = new Set();
      for (const entry of creatureEntries) {
        if (scoreEntry(entry, qNorm, scoreOpts) > 0) matchedCreatureNames.add(entry.label);
      }
      if (!parsed.isExactMode) {
        results.forEach((r) => {
          if (r.kind === 'ability' && r.target?.type === 'creature' && r.label) {
            matchedCreatureNames.add(r.label);
          }
        });
      }
      appendMapResultsForMatchedSpawns(
        results,
        existingMapIds,
        matchedCreatureNames,
        creatureToRoomIds,
        'Contains'
      );

      appendEquipmentWornByCreatures(results, matchedCreatureNames);
    } catch (error) {
      console.warn('[Cyclopedia] HomeSearch: spawn-to-map expansion failed:', error);
    }

    // Equipment + ability text matching (3+ chars, or boolean; skip quoted exact mode)
    const wantsTextExpansion = !parsed.isExactMode && (
      parsed.isBooleanMode
        ? cyclopediaBooleanExpressionHasValidTerm(parsed.booleanExpression)
        : (parsed.qNorm || '').length >= 3
    );
    if (wantsTextExpansion) {
      try {
        const qSnippet = cyclopediaFirstMatchingLeafForSnippet(parsed);
        const existingEquipKeys = new Set(
          results
            .filter((r) => r.kind === 'equipment' || r.target?.type === 'equipment')
            .map((r) => cyclopediaNormalizeSearchText(r.label))
        );

        // Equipment tooltips first (e.g. Cranial Basher "stuns…")
        appendEquipmentEffectSearchResults(results, parsed, existingEquipKeys);

        const existingCreatureKeys = new Set(
          results.filter((r) => r.target?.type === 'creature').map((r) => cyclopediaNormalizeSearchText(r.label))
        );

        for (const entry of creatureEntries) {
          if (results.length >= MAX_RESULTS) break;

          if (entryAlreadyMatchesQuery(entry, parsed)) continue;

          const nameKey = entry.labelNorm ?? cyclopediaNormalizeSearchText(entry.label);
          if (existingCreatureKeys.has(nameKey)) continue;

          const cache = ensureCreatureAbilityTextCache();
          const cached = cache.get(nameKey);
          const abilityText = getAbilityTextFromCacheValue(cached);
          if (abilityText && effectTextMatchesQuery(abilityText, parsed)) {
            results.push({
              kind: 'ability',
              kindLabel: kindLabel('ability'),
              label: entry.label,
              subtitle: snippetAroundMatch(abilityText, qSnippet),
              target: { type: 'creature', name: entry.label }
            });
            existingCreatureKeys.add(nameKey);
          }
        }

        // e.g. Knight ability mentions "cranial basher" + stun
        appendEquipmentMentionedInAbilityText(results, parsed, existingEquipKeys);
      } catch (error) {
        console.warn('[Cyclopedia] HomeSearch: ability/equipment text matching failed:', error);
      }
    }

    // Board drops + wiki boosted maps for every equipment hit (name, effect, etc.)
    try {
      const existingMapIds = new Set(
        results.filter((r) => r.kind === 'map' && r.target?.mapId).map((r) => r.target.mapId)
      );
      const matchedEquipmentNames = collectMatchedEquipmentNames(results, qNorm, scoreOpts);
      appendMapResultsForMatchedSpawns(
        results,
        existingMapIds,
        matchedEquipmentNames,
        equipmentToRoomIds,
        'Has'
      );
      appendBoostedMapResultsForEquipment(results, existingMapIds, matchedEquipmentNames);
    } catch (error) {
      console.warn('[Cyclopedia] HomeSearch: equipment map expansion failed:', error);
    }

    if (parsed.isExactMode) {
      sortExactModeResults(results, parsed);
      if (resolveExactModePrimaryKind(parsed.exactPhrases) === 'equipment') {
        ensureRoomCreatureIndex();
        for (const r of results) {
          if (r.kind !== 'equipment' || !r.label) continue;
          if (r.subtitle) continue;
          const boosted = getBoostedRoomEntriesForEquipment(r.label);
          const hasCount = equipmentToRoomIds?.get(cyclopediaNormalizeSearchText(r.label))?.size || 0;
          const parts = [];
          if (hasCount > 0) parts.push(`${hasCount} map${hasCount === 1 ? '' : 's'} with drop`);
          if (boosted.length > 0) parts.push(`${boosted.length} boosted map${boosted.length === 1 ? '' : 's'}`);
          if (parts.length) r.subtitle = parts.join(' · ');
        }
      }
    }

    return {
      query: parsed.isBooleanMode ? parsed.booleanExpression : qNorm,
      results,
      isExactMode: parsed.isExactMode,
      isBooleanMode: parsed.isBooleanMode
    };
  }

  function reset() {
    baseEntries = null;
    creatureEntries = null;
    equipmentEntries = null;
    roomCreatureIndex = null;
    creatureToRoomIds = null;
    equipmentToRoomIds = null;
    creatureToEquipmentNames = null;
    creatureAbilityTextCache = null;
    equipmentEffectTextCache = null;
    equipmentEffectIndexPromise = null;
    abilityIndexPromise = null;
    try {
      abilityIndexState.abortToken = (Number(abilityIndexState.abortToken) || 0) + 1;
      abilityIndexState.running = false;
      abilityIndexState.queue = [];
      abilityIndexState.done = 0;
      abilityIndexState.total = 0;
      if (abilityIndexState.tickTimer) clearTimeout(abilityIndexState.tickTimer);
      abilityIndexState.tickTimer = null;
      abilityIndexState.listeners.clear();
      equipmentEffectIndexState.abortToken = (Number(equipmentEffectIndexState.abortToken) || 0) + 1;
      equipmentEffectIndexState.running = false;
      equipmentEffectIndexState.queue = [];
      equipmentEffectIndexState.done = 0;
      equipmentEffectIndexState.total = 0;
      if (equipmentEffectIndexState.tickTimer) clearTimeout(equipmentEffectIndexState.tickTimer);
      equipmentEffectIndexState.tickTimer = null;
      equipmentEffectIndexState.listeners.clear();
    } catch {
      // ignore
    }
  }

  return {
    search,
    reset,
    // Ability / equipment effect indexing (used by Home search UI)
    ensureAbilityIndexReady,
    isAbilityIndexReady,
    abortAbilityIndexing,
    ensureEquipmentEffectIndexReady,
    isEquipmentEffectIndexReady,
    abortEquipmentEffectIndexing,
    startEquipmentEffectIndexing,
    getEquipmentEffectIndexProgress,
    // Existing exports (kept for compatibility/debug)
    startAbilityIndexing,
    getAbilityIndexProgress,
    subscribeAbilityIndex
  };
})();

// =======================
// 2. Global State & Configuration
// =======================
if (typeof window.cyclopediaGlobalObserver === 'undefined') {
  window.cyclopediaGlobalObserver = null;
}

const cyclopediaState = {
  observer: null, modalOpen: false, currentModal: null,
  profileData: null, lastFetch: 0, fetchInProgress: false,
  /** 1 or 2 — filters profilePageData season stats and season-scoped rooms/highscores in Cyclopedia. */
  profileSeason: 2,
  /** Latest raw JSON from serverSide.profilePageData (start page) for season-scoped leaderboard rows. */
  lastStartupProfileData: null,
  /** Last selected map/region in Maps tab; prevents empty first render. */
  mapsLastSelectedMapId: null, mapsLastSelectedRegionId: null,
  monsterNameMap: null, monsterNameMapBuilt: false, monsterLocationCache: new Map(),
  /** When true, creature detail shows awakened ability text until toggled off. */
  creatureDetailShowAwakenedAbility: false,
  searchDebounceTimer: null, searchedUsername: null,
  lazyLoadQueue: [], isProcessingQueue: false,
  cache: {
    profileData: new Map(), leaderboardData: new Map(), lastFetch: new Map(), roomThumbnails: new Map(),
    maxSize: { profileData: 50, leaderboardData: 20, roomThumbnails: 100 },
    defaultTTL: { profileData: 900000, leaderboardData: 600000, roomThumbnails: 3600000 }
  },
  pendingRequests: new Map(), timers: new Map(),
  requestQueue: { pending: new Map(), queue: [], processing: false },
  
  setProfileData: function(playerName, data) {
    this.cache.profileData.set(playerName, { data, timestamp: Date.now() });
    if (this.cache.profileData.size > this.cache.maxSize.profileData) {
      const firstKey = this.cache.profileData.keys().next().value;
      this.cache.profileData.delete(firstKey);
    }
  },
  
  getProfileData: function(playerName, ttl = null) {
    const cached = this.cache.profileData.get(playerName);
    if (!cached) return null;
    const effectiveTTL = ttl || this.cache.defaultTTL.profileData;
    if (Date.now() - cached.timestamp < effectiveTTL) return cached.data;
    this.cache.profileData.delete(playerName);
    return null;
  },
  
  setLeaderboardData: function(category, data) {
    this.cache.leaderboardData.set(category, { data, timestamp: Date.now() });
    if (this.cache.leaderboardData.size > this.cache.maxSize.leaderboardData) {
      const firstKey = this.cache.leaderboardData.keys().next().value;
      this.cache.leaderboardData.delete(firstKey);
    }
  },
  
  getLeaderboardData: function(category, ttl = null) {
    const cached = this.cache.leaderboardData.get(category);
    if (!cached) return null;
    const effectiveTTL = ttl || this.cache.defaultTTL.leaderboardData;
    if (Date.now() - cached.timestamp < effectiveTTL) return cached.data;
    this.cache.leaderboardData.delete(category);
    return null;
  },
  
  clearCache: function(type = 'all') {
    if (type === 'all') {
      this.cache.profileData.clear(); this.cache.leaderboardData.clear();
      this.cache.lastFetch.clear(); this.cache.roomThumbnails.clear(); this.pendingRequests.clear();
    } else if (this.cache[type]) this.cache[type].clear();
  },
  
  cleanupExpiredCache: function() {
    const now = Date.now(); let cleanedCount = 0;
    for (const [key, value] of this.cache.profileData.entries()) {
      if (now - value.timestamp > this.cache.defaultTTL.profileData) {
        this.cache.profileData.delete(key); cleanedCount++;
      }
    }
    for (const [key, value] of this.cache.leaderboardData.entries()) {
      if (now - value.timestamp > this.cache.defaultTTL.leaderboardData) {
        this.cache.leaderboardData.delete(key); cleanedCount++;
      }
    }
    for (const [key, value] of this.cache.roomThumbnails.entries()) {
      if (now - value.timestamp > this.cache.defaultTTL.roomThumbnails) {
        this.cache.roomThumbnails.delete(key); cleanedCount++;
      }
    }
    return cleanedCount;
  },
  
  getCacheStats: function() {
    return {
      profileData: this.cache.profileData.size,
      leaderboardData: this.cache.leaderboardData.size,
      roomThumbnails: this.cache.roomThumbnails.size,
      pendingRequests: this.pendingRequests.size,
      queueStatus: typeof RequestQueue !== 'undefined' ? RequestQueue.getStatus() : { pending: 0, queued: 0, processing: false },
      memoryInfo: typeof MemoryUtils !== 'undefined' ? MemoryUtils.getMemoryInfo() : { used: 0, total: 0 }
    };
  },
  
  cleanup: function() {
    this.clearCache();
    // Use TimerManager for centralized timer cleanup
    TimerManager.cleanup();
    this.timers.clear();
    this.observer = null; this.modalOpen = false; this.currentModal = null;
    this.profileData = null; this.lastFetch = 0; this.fetchInProgress = false;
    this.searchDebounceTimer = null; this.lazyLoadQueue = []; this.isProcessingQueue = false;
    this.searchedUsername = null;
    this.refreshRankingsTable = null;
    const cacheStats = this.getCacheStats();
  }
};

const CYCLOPEDIA_PROFILE_SEASONS = [1, 2];

const CYCLOPEDIA_ASSETS = {
  seasonIcon: 'https://bestiaryarena.com/assets/icons/season.png',
  bracketSilver: 'https://bestiaryarena.com/assets/icons/bracket-silver.png',
  bracketGold: 'https://bestiaryarena.com/assets/icons/bracket-gold.png',
  bracketPlatinum: 'https://bestiaryarena.com/assets/icons/bracket-platinum.png',
  bracketDiamond: 'https://bestiaryarena.com/assets/icons/bracket-diamond.png',
  bracketChallenger: 'https://bestiaryarena.com/assets/icons/bracket-challenger.png'
};

function cyclopediaBracketIconUrl(bracketName) {
  if (bracketName == null || bracketName === '') return null;
  const u = String(bracketName).trim().toUpperCase();
  if (u.includes('CHALLENGER')) return CYCLOPEDIA_ASSETS.bracketChallenger;
  if (u.includes('DIAMOND')) return CYCLOPEDIA_ASSETS.bracketDiamond;
  if (u.includes('PLATINUM')) return CYCLOPEDIA_ASSETS.bracketPlatinum;
  if (u.includes('GOLD')) return CYCLOPEDIA_ASSETS.bracketGold;
  if (u.includes('SILVER')) return CYCLOPEDIA_ASSETS.bracketSilver;
  return null;
}

function getSeason2RankBracketFromPosition(positionRaw, totalRaw) {
  const rankPos = Number(positionRaw);
  if (!Number.isFinite(rankPos) || rankPos <= 0) return null;
  if (rankPos <= 20) return 'CHALLENGER';

  const totalPlayers = Number(totalRaw);
  if (!Number.isFinite(totalPlayers) || totalPlayers <= 0) return null;

  const percentile = (rankPos / totalPlayers) * 100;
  if (percentile <= 5) return 'DIAMOND';
  if (percentile <= 15) return 'PLATINUM';
  if (percentile <= 30) return 'GOLD';
  if (percentile <= 60) return 'SILVER';
  return null;
}

function getSeason2RankBracket(profileData, seasonEntry, seasonNum) {
  return getSeason2MetricBracket(profileData, seasonEntry, seasonNum, 'rank');
}

function getSeason2MetricBracket(profileData, seasonEntry, seasonNum, metricKey) {
  if (Number(seasonNum) !== 2) return null;
  const metric = String(metricKey || '').trim().toLowerCase();
  if (!metric) return null;

  const explicitBracket = seasonEntry?.[`${metric}Bracket`];
  if (explicitBracket !== undefined && explicitBracket !== null && String(explicitBracket).trim() !== '') {
    return String(explicitBracket).trim().toUpperCase();
  }

  const positionCandidate = seasonEntry?.[`${metric}Position`]
    ?? seasonEntry?.[`${metric}Pos`]
    ?? (metric === 'rank'
      ? (seasonEntry?.rankPosition ?? seasonEntry?.position)
      : undefined)
    ?? (metric === 'rank'
      ? (profileData?.rankPointsPosition ?? profileData?.rankPosition ?? profileData?.position)
      : (profileData?.[`${metric}Position`] ?? profileData?.[`${metric}Pos`]));

  const totalPlayersCandidate = seasonEntry?.totalPlayers
    ?? seasonEntry?.playersCount
    ?? seasonEntry?.playerCount
    ?? profileData?.totalPlayers
    ?? profileData?.playersCount
    ?? profileData?.playerCount;

  return getSeason2RankBracketFromPosition(positionCandidate, totalPlayersCandidate);
}

function unwrapProfilePageJson(profileData) {
  if (!profileData) return null;
  return profileData.json !== undefined ? profileData.json : profileData;
}

function getLatestProfileSeason(profileData, fallbackSeason = 2) {
  const pd = unwrapProfilePageJson(profileData);
  const list = Array.isArray(pd?.seasons) ? pd.seasons : [];
  let latest = Number(fallbackSeason) || 2;
  list.forEach((entry) => {
    const sn = Number(entry?.season);
    if (Number.isFinite(sn) && sn > latest) latest = sn;
  });
  return latest;
}

function cyclopediaSeasonNA() {
  return CYCLOPEDIA_UI.notAvailable;
}

function getActiveProfileSeasonNumber() {
  return cyclopediaState.profileSeason || 1;
}

function getMapsTabStatisticsHeading() {
  return CYCLOPEDIA_UI.statisticsSeason(getActiveProfileSeasonNumber());
}

function getMapsTabMapInfoHeading() {
  return CYCLOPEDIA_UI.mapInfoSeason(getActiveProfileSeasonNumber());
}

function filterProfileArrayBySeason(arr, seasonNum) {
  if (!Array.isArray(arr)) return [];
  const hasSeasonTaggedEntries = arr.some(
    (item) => item && item.season !== undefined && item.season !== null
  );
  return arr.filter((item) => {
    // Some payloads omit `season` on all rows (current-season-only snapshots).
    // In that case, allow untagged rows for the selected season instead of hiding them.
    if (!item || item.season === undefined || item.season === null) return !hasSeasonTaggedEntries || Number(seasonNum) === 1;
    return Number(item.season) === Number(seasonNum);
  });
}

function findProfileSeasonEntry(profileData, seasonNum) {
  const pd = unwrapProfilePageJson(profileData);
  const list = pd?.seasons;
  if (!Array.isArray(list)) return null;
  return list.find((s) => Number(s?.season) === Number(seasonNum)) || null;
}

/** Apply selected season aggregates to profile copy for Player stats table (rankings rows). */
function patchProfileDataForActiveSeason(profileData, seasonNum) {
  const pd = unwrapProfilePageJson(profileData);
  if (!pd) return profileData;
  const next = { ...pd };
  const s = findProfileSeasonEntry(pd, seasonNum);
  if (s) {
    next.rankPoints = s.rank;
    next.ticks = s.ticks;
    next.floors = s.floors;
    const season2RankBracket = getSeason2MetricBracket(pd, s, seasonNum, 'rank');
    const season2TicksBracket = getSeason2MetricBracket(pd, s, seasonNum, 'ticks');
    const season2FloorsBracket = getSeason2MetricBracket(pd, s, seasonNum, 'floors');
    if (season2RankBracket) {
      next.rankPointsPosition = season2RankBracket;
    } else if (s.rankBracket !== undefined && s.rankBracket !== null && s.rankBracket !== '') {
      next.rankPointsPosition = String(s.rankBracket);
    }
    if (season2TicksBracket) {
      next.ticksPosition = season2TicksBracket;
    } else if (s.ticksBracket !== undefined && s.ticksBracket !== null && s.ticksBracket !== '') {
      next.ticksPosition = String(s.ticksBracket);
    }
    if (season2FloorsBracket) {
      next.floorsPosition = season2FloorsBracket;
    } else if (s.floorsBracket !== undefined && s.floorsBracket !== null && s.floorsBracket !== '') {
      next.floorsPosition = String(s.floorsBracket);
    }
  }
  return next;
}

function filterRoomsMapBySeason(rooms, seasonNum) {
  if (!rooms || typeof rooms !== 'object') return {};
  const hasSeasonTaggedRooms = Object.values(rooms).some(
    (roomData) => roomData && typeof roomData === 'object' && roomData.season !== undefined && roomData.season !== null
  );
  const out = {};
  for (const [roomId, roomData] of Object.entries(rooms)) {
    if (!roomData || typeof roomData !== 'object') continue;
    if (roomData.season !== undefined && roomData.season !== null) {
      if (Number(roomData.season) === Number(seasonNum)) out[roomId] = roomData;
    } else if (!hasSeasonTaggedRooms || Number(seasonNum) === 1) {
      out[roomId] = roomData;
    }
  }
  return out;
}

/**
 * Build per-room stats from profilePageData for a season (speedrun/rank/floor rows in leaderboards).
 * Merges `rooms`, `highscores`, and `floorHighscores` when entries carry `season`.
 */
function mergeProfileRoomsForSeason(profileData, seasonNum) {
  const pd = unwrapProfilePageJson(profileData);
  if (!pd) return {};
  const merged = { ...filterRoomsMapBySeason(pd.rooms || {}, seasonNum) };

  const highscores = filterProfileArrayBySeason(pd.highscores || [], seasonNum);
  highscores.forEach((score) => {
    if (!score?.roomId) return;
    const rid = score.roomId;
    if (!merged[rid]) merged[rid] = {};
    const m = merged[rid];
    if (score.rank === -1) {
      if (score.ticks != null && (m.ticks === undefined || score.ticks < m.ticks)) {
        m.ticks = score.ticks;
      }
    } else if (score.rank != null && score.rank > 0) {
      if (m.rank === undefined || score.rank < m.rank) {
        m.rank = score.rank;
        if (score.rankTicks !== undefined) m.rankTicks = score.rankTicks;
      }
    }
  });

  filterProfileArrayBySeason(pd.floorHighscores || [], seasonNum).forEach((fh) => {
    if (!fh || fh.softDeleted || !fh.roomId) return;
    const rid = fh.roomId;
    if (!merged[rid]) merged[rid] = {};
    const m = merged[rid];
    if (fh.floor !== undefined && fh.floor !== null) m.floor = fh.floor;
    if (fh.ticks !== undefined && fh.ticks !== null) {
      m.floorTicks = fh.ticks;
      if (m.ticks === undefined) m.ticks = fh.ticks;
    }
  });

  return merged;
}

/** Shallow copy of profile JSON with season-filtered rooms / highscores / floorHighscores for search UI. */
function narrowProfilePageDataForSeason(profileData, seasonNum) {
  const pd = unwrapProfilePageJson(profileData);
  if (!pd) return profileData;
  return {
    ...pd,
    rooms: mergeProfileRoomsForSeason(pd, seasonNum),
    highscores: filterProfileArrayBySeason(pd.highscores || [], seasonNum),
    floorHighscores: filterProfileArrayBySeason(pd.floorHighscores || [], seasonNum)
  };
}

function getYourRoomsForCyclopediaSeason(liveRooms) {
  const season = cyclopediaState.profileSeason || 1;
  const cached = cyclopediaState.lastStartupProfileData;
  if (!cached) {
    // Bootstrap fallback: first render can happen before profilePageData is cached.
    // Show live room stats immediately, then refresh to season-scoped data once cache arrives.
    return liveRooms || {};
  }
  const fromProfile = mergeProfileRoomsForSeason(cached, season);
  if (Object.keys(fromProfile).length > 0) return fromProfile;
  if (Number(season) === 1) return liveRooms || {};
  return {};
}

function refreshLeaderboardCacheYourRoomsForSeason() {
  const w = typeof window !== 'undefined' ? window.currentSpeedrunRankData : null;
  if (!w || typeof w !== 'object') return;
  const live = globalThis.state?.player?.getSnapshot?.()?.context?.rooms;
  w.yourRooms = getYourRoomsForCyclopediaSeason(live);
}

// =======================
// 3. Utility Functions
// =======================

// Centralized Observer Management
const ObserverManager = {
  observers: new Set(),
  
  add: function(observer, name = 'unnamed') {
    if (observer) {
      observer._cyclopediaName = name;
      this.observers.add(observer);
      
    }
  },
  
  remove: function(observer) {
    if (observer && this.observers.has(observer)) {
      try {
        observer.disconnect();
        this.observers.delete(observer);
        
      } catch (error) {
        console.warn(`[Cyclopedia] Error removing observer:`, error);
      }
    }
  },
  
  cleanup: function() {
    
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
        
      } catch (error) {
        console.warn(`[Cyclopedia] Error disconnecting observer:`, error);
      }
    });
    this.observers.clear();
  },
  
  getCount: function() {
    return this.observers.size;
  }
};

// Centralized Timer Management
const TimerManager = {
  timers: new Set(),
  
  addTimeout: function(timer, name = 'unnamed') {
    if (timer) {
      timer._cyclopediaName = name;
      timer._cyclopediaType = 'timeout';
      this.timers.add(timer);
      
    }
  },
  
  addInterval: function(timer, name = 'unnamed') {
    if (timer) {
      timer._cyclopediaName = name;
      timer._cyclopediaType = 'interval';
      this.timers.add(timer);
      
    }
  },
  
  remove: function(timer) {
    if (timer && this.timers.has(timer)) {
      try {
        if (timer._cyclopediaType === 'interval') {
          clearInterval(timer);
        } else {
          clearTimeout(timer);
        }
        this.timers.delete(timer);
        
      } catch (error) {
        console.warn(`[Cyclopedia] Error removing timer:`, error);
      }
    }
  },
  
  cleanup: function() {
    
    this.timers.forEach(timer => {
      try {
        if (timer._cyclopediaType === 'interval') {
          clearInterval(timer);
        } else {
          clearTimeout(timer);
        }
        
      } catch (error) {
        console.warn(`[Cyclopedia] Error clearing timer:`, error);
      }
    });
    this.timers.clear();
  },
  
  getCount: function() {
    return this.timers.size;
  }
};

const MemoryUtils = {
  clearLargeObjects: function() {
    // Clean up global observers
    if (window.cyclopediaMenuObserver) {
      ObserverManager.remove(window.cyclopediaMenuObserver);
      window.cyclopediaMenuObserver = null;
    }
    if (window.cyclopediaGlobalObserver) {
      ObserverManager.remove(window.cyclopediaGlobalObserver);
      window.cyclopediaGlobalObserver = null;
    }
  },
  
  getMemoryInfo: function() {
    return {
      eventHandlers: EventHandlerManager.getHandlerCount(),
      observers: ObserverManager.getCount(),
      timers: TimerManager.getCount(),
      cacheSize: cyclopediaState.cache.profileData.size + cyclopediaState.cache.leaderboardData.size + cyclopediaState.cache.roomThumbnails.size,
      pendingRequests: cyclopediaState.pendingRequests.size
    };
  }
};

const DOMUtils = {
  createElement: function(tag, className = '', textContent = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
  },
  
  createStyledElement: function(tag, styles = {}, className = '', textContent = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    if (typeof styles === 'string') {
      element.style.cssText = styles;
    } else if (styles && typeof styles === 'object') {
      Object.assign(element.style, styles);
    }
    return element;
  },
  
  createButton: function(text, styles = {}, hoverStyles = {}, clickHandler = null) {
    const button = this.createStyledElement('button', styles, '', text);
    if (clickHandler) button.addEventListener('click', clickHandler);
    
    if (hoverStyles && Object.keys(hoverStyles).length > 0) {
      const originalStyles = { ...styles };
      button.addEventListener('mouseenter', () => Object.assign(button.style, hoverStyles));
      button.addEventListener('mouseleave', () => Object.assign(button.style, originalStyles));
    }
    
    return button;
  },
  
  createSection: function(styles = {}, className = '') {
    const defaultSectionStyles = {
      marginBottom: '20px',
      padding: '16px',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    };
    return this.createStyledElement('div', { ...defaultSectionStyles, ...styles }, className);
  },
  
  createTableCell: function(content, styles = {}, className = '') {
    const defaultCellStyles = {
      padding: '6px 2px',
      borderRight: '1px solid #444',
      textAlign: 'center'
    };
    const cell = this.createStyledElement('div', { ...defaultCellStyles, ...styles }, className);
    if (typeof content === 'string') {
      cell.textContent = content;
    } else if (content && content.innerHTML) {
      cell.innerHTML = content.innerHTML;
    }
    return cell;
  },
  
  applyCommonStyles: function(element, styles = {}) {
    const defaultStyles = { display: 'flex', flexDirection: 'column', margin: '0', padding: '0', minHeight: '0', height: '100%', ...styles };
    Object.assign(element.style, defaultStyles);
    return element;
  },
  
  createColumn: function(width, content, extraStyles = {}) {
    const wrapper = document.createElement('div');
    const widthCss = typeof width === 'number' ? `${width}px` : String(width);
    Object.assign(wrapper.style, {
      width: widthCss,
      flex: `0 0 ${widthCss}`,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minWidth: '0',
      boxSizing: 'border-box',
      ...extraStyles
    });
    if (content) wrapper.appendChild(content);
    return wrapper;
  },
  
  createTitle: function(text, extraStyle) {
    const style = typeof extraStyle === 'object' && extraStyle !== null
      ? extraStyle
      : { width: '100%' };
    return createCyclopediaWidgetTitle(text, style);
  },
  
  createScrollContainer: function(height = '100%', padding = false) {
    if (!api || !api.ui || !api.ui.components || typeof api.ui.components.createScrollContainer !== 'function') {
      console.error('[Cyclopedia] createScrollContainer: api.ui.components.createScrollContainer is not available.');
      const fallback = document.createElement('div');
      fallback.textContent = 'Cyclopedia UI error: scroll container unavailable.';
      fallback.style.color = 'red';
      return fallback;
    }
    const scrollContainer = api.ui.components.createScrollContainer({ height, padding, content: null });
    if (scrollContainer && scrollContainer.element) {
      Object.assign(scrollContainer.element.style, { flex: '1 1 0', minHeight: '0', overflowY: 'scroll' });
    }
    return scrollContainer;
  },
  
  createListItem: function(text, className = FONT_CONSTANTS.SIZES.BODY, isOwned = true, isPerfect = false, isT5 = false, hasShiny = false, hasAwakened = false, hasShinyTier = false, hasHundoTier = false) {
    const item = document.createElement('div');
    item.className = className;
    
    // Create container for text and shiny star
    const contentContainer = document.createElement('div');
    contentContainer.style.display = 'flex';
    contentContainer.style.alignItems = 'center';
    contentContainer.style.gap = '4px';
    
    // Add shiny star if creature has shiny variants
    if (hasShiny) {
      const shinyIcon = document.createElement('img');
      shinyIcon.src = 'https://bestiaryarena.com/assets/icons/shiny-star.png';
      shinyIcon.alt = 'shiny';
      shinyIcon.title = 'Has shiny variant';
      shinyIcon.style.width = '10px';
      shinyIcon.style.height = '10px';
      shinyIcon.style.flexShrink = '0';
      contentContainer.appendChild(shinyIcon);
    }

    // Add awakened / hundo / shiny-tier icon.
    // Priority: shiny-tier > hundo-tier > awakened when multiple are present.
    if (hasAwakened || hasShinyTier || hasHundoTier) {
      const awakenedIcon = document.createElement('img');
      if (hasShinyTier) {
        awakenedIcon.src = 'https://bestiaryarena.com/assets/icons/star-tier-shiny.png';
        awakenedIcon.alt = 'shiny-tier';
        awakenedIcon.title = 'Has level 99 max-genes shiny creature';
      } else if (hasHundoTier) {
        awakenedIcon.src = 'https://bestiaryarena.com/assets/icons/star-tier-hundo.png';
        awakenedIcon.alt = 'hundo-tier';
        awakenedIcon.title = 'Has level 99 max-genes creature';
      } else {
        awakenedIcon.src = 'https://bestiaryarena.com/assets/icons/star-tier-awaken.png';
        awakenedIcon.alt = 'awakened';
        awakenedIcon.title = 'Has awakened creature';
      }
      awakenedIcon.style.width = '10px';
      awakenedIcon.style.height = '10px';
      awakenedIcon.style.flexShrink = '0';
      contentContainer.appendChild(awakenedIcon);
    }
    
    // Add text content
    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    contentContainer.appendChild(textSpan);
    
    item.appendChild(contentContainer);
    
    // Apply styling based on item status
    Object.assign(item.style, {
      cursor: 'pointer',
      padding: '2px 4px',
      borderRadius: '2px',
      textAlign: 'left',
      ...resolveCreatureListItemColors(
        { owned: isOwned, perfect: isPerfect, shinyTier: hasShinyTier, hundoTier: hasHundoTier, awakened: hasAwakened },
        { isT5 }
      )
    });
    
    return item;
  }
};

// =======================
// 4. Utility Functions
// =======================

/** Resolve display query + gameId for a creature name (Albino Gazer → Mystic Gazer / 97). */
function resolveCreatureGameId(creatureName) {
  const displayQuery = cyclopediaResolveCreatureQuery(creatureName);
  let gameId = displayQuery.gameId ?? null;
  const lookupName = (displayQuery.baseSpecies || creatureName).trim().toLowerCase();

  if (gameId == null) {
    const db = window.creatureDatabase;
    if (typeof buildCyclopediaMonsterNameMap === 'function') {
      buildCyclopediaMonsterNameMap();
    }
    const nameMap = typeof db?.getMonsterNameMap === 'function' ? db.getMonsterNameMap() : cyclopediaState.monsterNameMap;
    const entry = nameMap?.get?.(lookupName);
    if (entry) gameId = entry.index ?? entry.gameId;
  }

  if (gameId == null && window.BestiaryModAPI?.utility?.maps) {
    gameId = window.BestiaryModAPI.utility.maps.monsterNamesToGameIds?.get(lookupName);
  }

  return { gameId, displayQuery, lookupName };
}

function refreshRankingsTableIfReady() {
  if (typeof cyclopediaState.refreshRankingsTable === 'function') {
    cyclopediaState.refreshRankingsTable();
    return true;
  }
  return false;
}

// Unified function to get all creature status information
function getCreatureStatus(creatureName) {
  try {
    const snap = globalThis.state?.player?.getSnapshot?.();
    const playerContext = snap?.context;
    if (!playerContext?.monsters) {
      return { owned: false, shiny: false, perfect: false, awakened: false, shinyTier: false, hundoTier: false };
    }

    const ownedMonsters = playerContext.monsters || [];
    const db = window.creatureDatabase;
    let matchingMonsters = typeof db?.filterMonstersForCreatureDisplay === 'function'
      ? db.filterMonstersForCreatureDisplay(creatureName, ownedMonsters)
      : [];

    if (matchingMonsters.length === 0) {
      const { gameId: creatureGameId, displayQuery } = resolveCreatureGameId(creatureName);

      matchingMonsters = ownedMonsters.filter((monster) => monster.gameId === creatureGameId);
      if (displayQuery.shinyOnly) {
        matchingMonsters = matchingMonsters.filter((monster) => monster.shiny === true);
      } else if (displayQuery.nonShinyOnly) {
        matchingMonsters = matchingMonsters.filter((monster) => monster.shiny !== true);
      }
    }
    
    if (matchingMonsters.length === 0) {
      return { owned: false, shiny: false, perfect: false, awakened: false, shinyTier: false, hundoTier: false };
    }

    const getMonsterLevel = (monster) => {
      if (globalThis.state?.utils?.expToCurrentLevel && monster.exp) {
        return globalThis.state.utils.expToCurrentLevel(monster.exp);
      }
      return Number(monster.level) || 1;
    };

    const getGeneValues = (monster) => ([
      Number(monster.hp) || 0,
      Number(monster.ad) || 0,
      Number(monster.ap) || 0,
      Number(monster.armor) || 0,
      Number(monster.magicResist) || 0
    ]);
    
    // Check for shiny variants
    const hasShiny = matchingMonsters.some(monster => monster.shiny === true);

    // Check for awakened creatures (gazers and other non-awakenable species excluded)
    const hasAwakened = isCyclopediaCreatureAwakenable(creatureName) && matchingMonsters.some(monster =>
      monster.awaken === true ||
      monster.awakened === true ||
      monster.isAwakened === true ||
      Number(monster.starTier) >= 6 ||
      Number(monster.tier) >= 6
    );

    // Shiny tier: a SHINY creature at level 99 with max genes (100 total).
    const hasShinyTier = matchingMonsters.some(monster => {
      if (monster.shiny !== true) return false;
      const level = getMonsterLevel(monster);
      const totalGenes = getGeneValues(monster).reduce((sum, value) => sum + value, 0);
      return level >= 99 && totalGenes >= 100;
    });

    // Hundo tier: a NON-shiny creature at level 99 with max genes (100 total).
    const hasHundoTier = matchingMonsters.some(monster => {
      if (monster.shiny === true) return false;
      const level = getMonsterLevel(monster);
      const totalGenes = getGeneValues(monster).reduce((sum, value) => sum + value, 0);
      return level >= 99 && totalGenes >= 100;
    });
    
    // Check for perfect creatures (level 50 with 100 total genes)
    const isPerfect = matchingMonsters.some(monster => {
      const totalGenes = getGeneValues(monster).reduce((sum, value) => sum + value, 0);
      
      // Calculate level from experience using the game's utility function
      const level = getMonsterLevel(monster);
      
      // Debug logging for troubleshooting
      if (totalGenes >= 90) { // Log creatures close to perfect for debugging
        
      }
      
      return level >= 50 && totalGenes >= 100;
    });
    
    return {
      owned: true,
      shiny: hasShiny,
      perfect: isPerfect,
      awakened: hasAwakened,
      shinyTier: hasShinyTier,
      hundoTier: hasHundoTier
    };
  } catch (error) {
    console.warn('[Cyclopedia] Error checking creature status:', error);
    return { owned: false, shiny: false, perfect: false, awakened: false, shinyTier: false, hundoTier: false };
  }
}

// Function to check if user owns a creature
function isCreatureOwned(creatureName) {
  return getCreatureStatus(creatureName).owned;
}

// Function to check if user has any shiny variants of a creature
function hasShinyCreature(creatureName) {
  const db = window.creatureDatabase;
  if (typeof db?.creatureHasShinyVariant === 'function' && !db.creatureHasShinyVariant(creatureName)) {
    return false;
  }
  return getCreatureStatus(creatureName).shiny;
}

// Function to check if user has any awakened variants of a creature
function hasAwakenedCreature(creatureName) {
  return getCreatureStatus(creatureName).awakened;
}

// Function to check if user has any level 99 max-gene SHINY variants of a creature
function hasShinyTierCreature(creatureName) {
  return getCreatureStatus(creatureName).shinyTier;
}

// Function to check if user has any level 99 max-gene NON-shiny variants of a creature
function hasHundoTierCreature(creatureName) {
  return getCreatureStatus(creatureName).hundoTier;
}

// Function to check if user has a perfect creature (level 50 with 100 total genes)
function isCreaturePerfect(creatureName) {
  return getCreatureStatus(creatureName).perfect;
}

/** Same ordering signals as Awaken Tracker overview (`renderOverview` groups.sort + per-monster rank). */
const AWAKEN_TRACKER_SORT_TIER = 6;
const AWAKEN_TRACKER_SORT_CAP = 20;
const AWAKEN_TRACKER_SORT_STATS = ['hp', 'ad', 'ap', 'armor', 'magicResist'];
/** Larger than max sum*100 (10_000): shiny awakened always ranks above non-shiny awakened (matches Awaken Tracker). */
const AWAKEN_TRACKER_SHINY_AWAKENED_RANK_BOOST = 50_000;

function getAwakenTrackerBestiarySortKey(creatureName) {
  const empty = {
    categoryRank: 3,
    anyAwakened: false,
    anyAwakenedShiny: false,
    bestSum: 0,
    bestRank: 0,
    topTierGenePct: 0,
    topTierLevel: 0
  };
  try {
    const snap = globalThis.state?.player?.getSnapshot?.();
    const playerContext = snap?.context;
    if (!playerContext?.monsters) return empty;
    const ownedMonsters = playerContext.monsters || [];
    const norm = String(creatureName || '').trim().toLowerCase();
    if (!norm) return empty;

    const { gameId: creatureGameId, displayQuery } = resolveCreatureGameId(creatureName);
    if (creatureGameId == null) return empty;

    let matching = ownedMonsters.filter((m) => m && m.gameId === creatureGameId);
    if (displayQuery.shinyOnly) {
      matching = matching.filter((m) => m.shiny === true);
    } else if (displayQuery.nonShinyOnly) {
      matching = matching.filter((m) => m.shiny !== true);
    }
    if (matching.length === 0) return empty;

    const expToLevel = globalThis.state?.utils?.expToCurrentLevel;
    const monsterLevel = (m) => {
      if (typeof expToLevel === 'function' && m.exp) {
        const lv = Number(expToLevel(m.exp));
        return Number.isFinite(lv) ? lv : 0;
      }
      return Number(m.level) || 0;
    };

    const rankMon = (i) =>
      (i.awakened && i.capped && i.level >= 99 ? 10_000_000 : 0)
      + (i.awakened && i.capped ? 1_000_000 : 0)
      + (i.awakened ? 100_000 : 0)
      + (i.awakened && i.shiny ? AWAKEN_TRACKER_SHINY_AWAKENED_RANK_BOOST : 0)
      + i.sum * 100
      + (i.shiny ? 10 : 0)
      + i.tier;

    let anyAwakened = false;
    let anyAwakenedShiny = false;
    let anyCapped = false;
    let anyPerfect = false;
    let best = null;

    for (const m of matching) {
      let sum = 0;
      let allCapped = true;
      for (const s of AWAKEN_TRACKER_SORT_STATS) {
        const v = Number(m[s] ?? 0);
        sum += v;
        if (v !== AWAKEN_TRACKER_SORT_CAP) allCapped = false;
      }
      const tier = Number(m.tier ?? 0);
      const level = monsterLevel(m);
      const awakened = tier === AWAKEN_TRACKER_SORT_TIER;
      const mon = { tier, level, sum, awakened, capped: allCapped, shiny: m.shiny === true };

      if (mon.awakened) anyAwakened = true;
      if (mon.awakened && mon.shiny) anyAwakenedShiny = true;
      if (mon.awakened && mon.capped) anyCapped = true;
      if (mon.awakened && mon.capped && mon.level >= 99) anyPerfect = true;

      if (!best || rankMon(mon) > rankMon(best)) best = mon;
    }

    let categoryRank = 3;
    if (anyPerfect) categoryRank = 0;
    else if (anyCapped) categoryRank = 1;
    else if (anyAwakened) categoryRank = 2;

    return {
      categoryRank,
      anyAwakened,
      anyAwakenedShiny,
      bestSum: best ? best.sum : 0,
      bestRank: best ? rankMon(best) : 0,
      topTierGenePct: best ? Math.min(100, Math.max(0, Math.floor(best.sum))) : 0,
      topTierLevel: best ? best.level : 0
    };
  } catch (e) {
    console.warn('[Cyclopedia] getAwakenTrackerBestiarySortKey:', e);
    return empty;
  }
}

// Unified function to get all equipment status information
function getEquipmentStatus(equipmentName) {
  try {
    const snap = globalThis.state?.player?.getSnapshot?.();
    const playerContext = snap?.context;
    if (!playerContext?.equips) {
      return { owned: false, isT5: false };
    }

    const ownedEquips = playerContext.equips || [];

    let equipmentGameId = null;

    if (window.BestiaryModAPI?.utility?.maps) {
      equipmentGameId = window.BestiaryModAPI.utility.maps.equipmentNamesToGameIds?.get(equipmentName.toLowerCase());
    }

    if (equipmentGameId === null) {
      const eqMap = window.equipmentDatabase?.getEquipmentNameMap?.();
      const entry = eqMap?.get?.(equipmentName.toLowerCase());
      if (entry) equipmentGameId = entry.gameId;
    }
    
    // Find all matching equipment for this item
    const matchingEquips = ownedEquips.filter(equip => equip.gameId === equipmentGameId);
    
    if (matchingEquips.length === 0) {
      return { owned: false, isT5: false };
    }
    
    // Check if user has equipment with ALL 3 stats at tier 5
    let t5Stats = 0;
    const totalStats = 3; // hp, ad, ap
    
    // Check each stat type for tier 5 equipment
    const statTypes = ['hp', 'ad', 'ap'];
    statTypes.forEach(statType => {
      const statEquips = ownedEquips.filter(e => 
        e.gameId === equipmentGameId && 
        e.stat === statType && 
        e.tier >= 5
      );
      if (statEquips.length > 0) {
        t5Stats++;
      }
    });
    
    // Debug logging for troubleshooting
    if (t5Stats >= 2) { // Log equipment close to T5 for debugging
      
    }
    
    return {
      owned: true,
      isT5: t5Stats >= totalStats
    };
  } catch (error) {
    console.warn('[Cyclopedia] Error checking equipment status:', error);
    return { owned: false, isT5: false };
  }
}

// Function to check if user owns equipment
function isEquipmentOwned(equipmentName) {
  return getEquipmentStatus(equipmentName).owned;
}

// Function to check if user has T5 equipment (ALL 3 stats: hp, ad, ap at tier 5)
function isEquipmentT5(equipmentName) {
  return getEquipmentStatus(equipmentName).isT5;
}

function resolveCanonicalCreatureName(creatureNameRaw) {
  const creatureName = String(creatureNameRaw || '').trim();
  if (!creatureName) return '';
  const normalizedCreatureName = creatureName.toLowerCase();
  return getCyclopediaAllCreatures().find((c) => c.toLowerCase() === normalizedCreatureName)
    || getCyclopediaGazerNames().find((c) => c.toLowerCase() === normalizedCreatureName)
    || GAME_DATA.UNOBTAINABLE_CREATURES.find((c) => c.toLowerCase() === normalizedCreatureName)
    || creatureName;
}

function openCreatureInBestiaryTab(creatureNameRaw, {
  setActiveTabFn,
  clickListItemFn,
  tabPage,
  inventoryTabPage = null,
  findBoxByTitleFn = null,
  timerLabel = 'cyclopediaCreatureSelect'
} = {}) {
  const canonicalCreatureName = resolveCanonicalCreatureName(creatureNameRaw);
  if (!canonicalCreatureName) return;

  if (isCyclopediaGazerCreatureName(canonicalCreatureName)) {
    if (typeof setActiveTabFn === 'function') setActiveTabFn(3);
    const clickGazerTimeout = setTimeout(() => {
      const inventoryTab = inventoryTabPage || tabPage;
      if (typeof clickListItemFn !== 'function' || !inventoryTab) return;
      const topBox = typeof findBoxByTitleFn === 'function'
        ? findBoxByTitleFn(inventoryTab, 'Inventory')
        : null;
      clickListItemFn(topBox || inventoryTab, CYCLOPEDIA_GAZERS_CATEGORY);
      const clickGazerItemTimeout = setTimeout(() => {
        const bottomBox = typeof findBoxByTitleFn === 'function'
          ? findBoxByTitleFn(inventoryTab, CYCLOPEDIA_GAZERS_CATEGORY)
          : inventoryTab;
        clickListItemFn(bottomBox || inventoryTab, canonicalCreatureName);
      }, 0);
      TimerManager.addTimeout(clickGazerItemTimeout, `${timerLabel}GazerItem`);
    }, 0);
    TimerManager.addTimeout(clickGazerTimeout, timerLabel);
    return;
  }

  if (typeof setActiveTabFn === 'function') setActiveTabFn(1);
  const clickBestiaryTimeout = setTimeout(() => {
    if (typeof clickListItemFn === 'function' && tabPage) {
      clickListItemFn(tabPage, canonicalCreatureName);
    }
  }, 0);
  TimerManager.addTimeout(clickBestiaryTimeout, timerLabel);
}

function getCreatureDisplayStatus(creatureName) {
  const db = window.creatureDatabase;
  if (typeof db?.creatureHasShinyVariant === 'function' && !db.creatureHasShinyVariant(creatureName)) {
    return { ...getCreatureStatus(creatureName), shiny: false };
  }
  return getCreatureStatus(creatureName);
}

function resolveCreatureListItemColors(status, { isUnobtainable = false, isT5 = false } = {}) {
  if (isUnobtainable) {
    return { color: COLOR_CONSTANTS.TEXT, filter: 'none' };
  }
  if (status.shinyTier) {
    return { color: COLOR_CONSTANTS.MAX_AWAKENED, filter: 'none' };
  }
  if (status.hundoTier) {
    return { color: COLOR_CONSTANTS.HUNDO, filter: 'none' };
  }
  if (status.awakened) {
    return { color: COLOR_CONSTANTS.AWAKENED, filter: 'none' };
  }
  if (status.perfect || isT5) {
    return { color: COLOR_CONSTANTS.PERFECT, filter: 'none' };
  }
  if (!status.owned) {
    return { color: COLOR_CONSTANTS.UNOWNED, filter: 'grayscale(0.7)' };
  }
  return { color: COLOR_CONSTANTS.TEXT, filter: 'none' };
}

function applyCreatureListItemStyle(el, status, options = {}) {
  const { color, filter } = resolveCreatureListItemColors(status, options);
  el.style.color = color;
  el.style.filter = filter;
}

// Function to get creature roles from monster data
function getCreatureRoles(creatureName) {
  try {
    if (typeof creatureName !== 'string') {
      return null;
    }

    const { gameId, lookupName } = resolveCreatureGameId(creatureName);

    if (typeof buildCyclopediaMonsterNameMap === 'function') {
      buildCyclopediaMonsterNameMap();
    }

    const nameMap = window.creatureDatabase?.getMonsterNameMap?.() || cyclopediaState.monsterNameMap;
    const entry = nameMap?.get?.(lookupName);
    if (entry?.monster?.metadata?.roles) {
      return entry.monster.metadata.roles;
    }

    if (gameId != null) {
      const fromDbById = window.creatureDatabase?.findMonsterByGameId?.(gameId);
      if (fromDbById?.metadata?.roles) {
        return fromDbById.metadata.roles;
      }
    }

    const fromDb = window.creatureDatabase?.findMonsterByName?.(creatureName);
    if (fromDb?.metadata?.roles) {
      return fromDb.metadata.roles;
    }

    return null;
  } catch (error) {
    console.warn('[Cyclopedia] Error getting creature roles:', error);
    return null;
  }
}

// =======================
// 5. Event Handler Management
// =======================
const EventHandlerManager = {
  handlers: new Map(),
  
  addHandler: function(element, eventType, handler, options = {}) {
    const key = `${eventType}_${Date.now()}_${Math.random()}`;
    const handlerInfo = { element, eventType, handler, options, key };
    element.addEventListener(eventType, handler, options);
    this.handlers.set(key, handlerInfo);
    return key;
  },
  
  removeHandler: function(key) {
    const handlerInfo = this.handlers.get(key);
    if (handlerInfo) {
      handlerInfo.element.removeEventListener(handlerInfo.eventType, handlerInfo.handler, handlerInfo.options);
      this.handlers.delete(key);
    }
  },
  
  removeElementHandlers: function(element) {
    for (const [key, handlerInfo] of this.handlers.entries()) {
      if (handlerInfo.element === element) this.removeHandler(key);
    }
  },
  
  cleanup: function() {
    for (const [key, handlerInfo] of this.handlers.entries()) this.removeHandler(key);
  },
  
  getHandlerCount: function() { return this.handlers.size; }
};

function safeRemoveChild(parent, child) {
  try {
    if (!parent || !child) return false;
    if (!parent.contains(child)) return false;
    if (child.parentNode !== parent) return false;
    parent.removeChild(child);
    return true;
  } catch (error) {
    console.error('[Cyclopedia] safeRemoveChild error:', error);
    return false;
  }
}

function debounce(func, wait) {
  return function executedFunction(...args) {
    const later = () => {
      if (cyclopediaState.searchDebounceTimer) {
        TimerManager.remove(cyclopediaState.searchDebounceTimer);
      }
      func(...args);
    };
    if (cyclopediaState.searchDebounceTimer) {
      TimerManager.remove(cyclopediaState.searchDebounceTimer);
    }
    cyclopediaState.searchDebounceTimer = setTimeout(later, wait);
    TimerManager.addTimeout(cyclopediaState.searchDebounceTimer, 'searchDebounce');
  };
}

function createCyclopediaSearchBar(placeholder) {
  const searchContainer = document.createElement('div');
  searchContainer.style.cssText = 'display: flex; align-items: center; gap: 4px; padding: 4px 6px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 3px; margin: 0; width: 100%; margin-left: 0; margin-right: 0; box-sizing: border-box; min-width: 0;';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = placeholder;
  searchInput.style.cssText = 'background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); padding: 3px 6px; border-radius: 2px; font-size: 12px; flex: 1 1 0%; min-width: 0; font-family: inherit; outline: none; box-sizing: border-box;';

  searchInput.addEventListener('focus', () => {
    searchInput.style.borderColor = 'rgba(255, 255, 255, 0.4)';
  });
  searchInput.addEventListener('blur', () => {
    searchInput.style.borderColor = 'rgba(255, 255, 255, 0.2)';
  });

  const filterBtn = document.createElement('button');
  filterBtn.textContent = 'Name';
  filterBtn.style.cssText = 'background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); padding: 3px 8px; border-radius: 2px; font-size: 12px; cursor: pointer; font-family: inherit; outline: none; white-space: nowrap; min-width: 56px; flex-shrink: 0;';
  filterBtn.addEventListener('mouseenter', () => {
    filterBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    filterBtn.style.borderColor = 'rgba(255, 255, 255, 0.4)';
  });
  filterBtn.addEventListener('mouseleave', () => {
    filterBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    filterBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
  });

  searchContainer.appendChild(searchInput);
  searchContainer.appendChild(filterBtn);
  return { searchContainer, searchInput, filterBtn };
}

function createNoResultsMessage(text) {
  const msg = document.createElement('div');
  msg.className = FONT_CONSTANTS.SIZES.SMALL;
  msg.textContent = text;
  msg.style.cssText = 'display:none; text-align:center; color:#aaa; font-style:italic; padding:6px 4px;';
  return msg;
}

function mountNoResultsInsideList(box, noResultsEl) {
  const listGrid = box.querySelector('div[data-nopadding="true"]');
  if (listGrid) {
    listGrid.appendChild(noResultsEl);
    return;
  }
  box.appendChild(noResultsEl);
}

const DOMCache = {
  cache: new Map(),
  cacheTimeout: 5000, // Increased timeout for better performance

  get: function(selector, context = document) {
    const key = `${selector}_${context === document ? 'doc' : context.id || 'ctx'}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) return cached.element;
    const element = context.querySelector(selector);
    if (element) {
      this.cache.set(key, { element, timestamp: Date.now() });
    }
    return element;
  },

  getAll: function(selector, context = document) {
    const key = `all_${selector}_${context === document ? 'doc' : context.id || 'ctx'}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) return cached.elements;
    const elements = Array.from(context.querySelectorAll(selector));
    if (elements.length > 0) {
      this.cache.set(key, { elements, timestamp: Date.now() });
    }
    return elements;
  },

  clear: function() { this.cache.clear(); },

  clearSelector: function(selector) {
    for (const key of this.cache.keys()) {
      if (key.includes(selector)) this.cache.delete(key);
    }
  },

  // Enhanced methods for better performance
  getModalElement: function(selector) {
    const modal = this.get('div[role="dialog"][data-state="open"]');
    if (!modal) return null;
    return modal.querySelector(selector);
  },

  getModalElements: function(selector) {
    const modal = this.get('div[role="dialog"][data-state="open"]');
    if (!modal) return [];
    return Array.from(modal.querySelectorAll(selector));
  }
};

const MemoizationUtils = {
  memoize: function(fn, keyFn = (...args) => JSON.stringify(args)) {
    const cache = new Map();
    return function(...args) {
      const key = keyFn(...args);
      if (cache.has(key)) return cache.get(key);
      const result = fn.apply(this, args);
      cache.set(key, result);
      return result;
    };
  },

  memoizeWithTTL: function(fn, ttl, keyFn = (...args) => JSON.stringify(args)) {
    const cache = new Map();
    return function(...args) {
      const key = keyFn(...args);
      const now = Date.now();
      if (cache.has(key)) {
        const { result, timestamp } = cache.get(key);
        if (now - timestamp < ttl) return result;
        cache.delete(key);
      }
      const result = fn.apply(this, args);
      cache.set(key, { result, timestamp: now });
      return result;
    };
  }
};

const FormatUtils = {
  time: function(ms) {
    if (!ms || isNaN(ms) || ms < 0) return '--:--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60) % 60;
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
  },

  currency: function(n) {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.00$/, '') + 'KKK';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'KK';
    if (n >= 1_000) return (n / 1_000).toFixed(2).replace(/\.00$/, '') + 'K';
    return n.toLocaleString();
  },

  number: function(n) { return n !== undefined ? n.toLocaleString() : '-'; },

  date: function(ts) {
    if (!ts) return '-';
    try {
      const date = new Date(Number(ts));
      return date.toISOString().split('T')[0];
    } catch (e) { return '-'; }
  },

  tilePosition: function(tileIndex) {
    const gridSize = 10;
    const row = Math.floor(tileIndex / gridSize) + 1;
    const col = (tileIndex % gridSize) + 1;
    return `${row},${col}`;
  },

  direction: function(direction) {
    if (!direction) return '';
    
    const directionMap = {
      'north': '↑', 'south': '↓', 'east': '→', 'west': '←',
      'northeast': '↗', 'northwest': '↖', 'southeast': '↘', 'southwest': '↙'
    };
    
    return directionMap[direction.toLowerCase()] || direction;
  }
};

const CURRENCY_UI_SELECTORS = { gold: { button: true, title: 'Gold', alt: 'Player gold' }, beastCoins: { button: true, title: 'Beast Coins', alt: 'Player Beast Coins' }, dust: { div: true, title: 'Dust', alt: 'Dust' } };
const CURRENCY_GAME_STATE_PATHS = { dust: ['inventory?.dust', 'inventory?.dust?.count', 'resources?.dust', 'player?.dust', 'dust'], huntingMarks: ['inventory?.huntingMarks', 'inventory?.huntingMarks?.count', 'resources?.huntingMarks', 'player?.huntingMarks', 'huntingMarks', 'hunting?.marks', 'marks', 'huntingMarks?.count', 'huntingMarks?.amount', 'huntingMarks?.quantity', 'hunting?.huntingMarks', 'hunting?.huntingMarks?.count', 'player?.hunting?.marks', 'player?.hunting?.huntingMarks', 'player?.huntingMarks', 'player?.marks', 'inventory?.marks', 'inventory?.marks?.count', 'player?.inventory?.huntingMarks', 'player?.inventory?.huntingMarks?.count', 'player?.resources?.huntingMarks', 'player?.resources?.huntingMarks?.count', 'context?.inventory?.huntingMarks', 'context?.inventory?.huntingMarks?.count', 'context?.player?.huntingMarks', 'context?.player?.huntingMarks?.count', 'context?.huntingMarks', 'context?.huntingMarks?.count', 'context?.hunting?.marks', 'context?.hunting?.marks?.count', 'questLog?.hunting?.marks', 'questLog?.hunting?.huntingMarks', 'questLog?.task?.huntingMarks', 'questLog?.task?.marks', 'questLog?.task?.points', 'questLog?.seashell?.huntingMarks', 'questLog?.seashell?.marks', 'huntingMarks', 'huntingMarksCount', 'huntingMarksAmount', 'huntingMarksQuantity', 'huntingMarksTotal', 'totalHuntingMarks', 'huntingMarksEarned', 'huntingMarksCollected'] };
function getCurrencyFromUI(currencyType) { 
  try { 
    const config = CURRENCY_UI_SELECTORS[currencyType]; 
    if (!config) return null; 
    
    const selector = config.button ? 'button' : 'div'; 
    const elements = DOMCache.getAll(selector);
    
    // Use for...of loop instead of Array.from().find() for better performance
    for (const el of elements) {
      const div = el.querySelector(`.frame-pressed-1[title="${config.title}"]`);
      const img = el.querySelector(`img[alt="${config.alt}"]`);
      if (div || img) {
        const span = el.querySelector('span');
        if (span) {
          return parseCommaSeparatedInt(span.textContent);
        }
      }
    }
    return null;
  } catch (error) { 
    console.warn(`[Cyclopedia] Error getting ${currencyType} from UI:`, error); 
    return null; 
  } 
}
function getCurrencyFromGameState(currencyType) {
  try {
    const gameState = globalThis.state?.player?.getSnapshot()?.context;
    if (!gameState) return null;
    const paths = CURRENCY_GAME_STATE_PATHS[currencyType];
    return getFirstNumericGameStateValue(gameState, paths);
  } catch (error) {
    return null;
  }
}
function getGoldFromUI() { return getCurrencyFromUI('gold'); }

function getBeastCoinsFromUI() { return getCurrencyFromUI('beastCoins'); }
function getDustFromUI() { return getCurrencyFromUI('dust'); }
function getDustFromGameState() { return getCurrencyFromGameState('dust'); }

function getHuntingMarksFromUI() {
  try {
    let huntingMarksSprite = null;
    // Use for...of loop instead of reduce for better performance
    for (const selector of HUNTING_MARKS_UI_SELECTORS) {
      const element = DOMCache.get(selector);
      if (element) {
        huntingMarksSprite = element?.tagName === 'IMG' ? element.closest('.sprite.item.relative') : element;
        break;
      }
    }
    
    if (!huntingMarksSprite) {
      const allElements = DOMCache.getAll('*');
      let huntingMarksText = null;
      // Use for...of loop instead of Array.from().find() for better performance
      for (const el of allElements) {
        if (el.textContent?.includes('Hunting Marks')) {
          huntingMarksText = el;
          break;
        }
      }
      huntingMarksSprite = huntingMarksText?.closest('.sprite.item.relative') || huntingMarksText;
    }
    
    if (!huntingMarksSprite) return null;
    
    let span = huntingMarksSprite.querySelector('.font-outlined-fill') || 
               Array.from(huntingMarksSprite.querySelectorAll('span')).find(s => 
                 /^\d+$/.test(s.textContent.trim().replace(/,/g, ''))
               );
    
    const textContent = span?.textContent || huntingMarksSprite.textContent;
      const numberMatch = textContent.match(/(\d{1,3}(?:,\d{3})*)/);
      if (numberMatch) {
      const parsedValue = parseCommaSeparatedInt(numberMatch[1]);
        if (parsedValue !== null) return parsedValue;
    }
    
    return null;
  } catch (error) { 
      return null;
    }
}

function getHuntingMarksFromGameState() {
  try {
    const gameState = globalThis.state?.player?.getSnapshot()?.context;
    if (!gameState) return null;
    
    for (const path of HUNTING_MARKS_PATHS) {
      const value = path.split('?.').reduce((obj, key) => obj?.[key], gameState);
          if (typeof value === 'number' && !isNaN(value) && value >= 0) return value;
        }
        
      return null;
  } catch (error) { 
    return null; 
  }
}

async function getHuntingMarksFromProfileAPI() {
  try {
    let playerName = globalThis.state?.player?.getSnapshot()?.context?.player?.name;
    if (!playerName) playerName = globalThis.state?.player?.getSnapshot()?.context?.name;
    if (!playerName) return null;
    
    const apiUrl = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(playerName)}%22%7D%7D`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    
    const searchForHuntingMarks = (obj) => {
      if (!obj || typeof obj !== 'object') return null;
      
      for (const [key, value] of Object.entries(obj)) {
        if (key.toLowerCase().includes('hunting') && key.toLowerCase().includes('mark')) {
          if (typeof value === 'number' && !isNaN(value) && value >= 0) return value;
        }
        if (typeof value === 'object' && value !== null) {
          const result = searchForHuntingMarks(value);
          if (result !== null) return result;
        }
      }
      return null;
    };
    
    const huntingMarks = searchForHuntingMarks(data);
    if (huntingMarks !== null) return huntingMarks;
    return null;
  } catch (error) {
    console.error('[Cyclopedia] Error fetching hunting marks from API:', error);
    
    if (typeof context !== 'undefined' && context.api && context.api.ui) {
      try {
        context.api.ui.components.createModal({
          title: 'Connection Error',
          content: '<p>Failed to fetch hunting marks data. Please check your internet connection and try again.</p>',
          buttons: [{ text: 'OK', primary: true }]
        });
      } catch (modalError) {
        console.error('[Cyclopedia] Error showing error modal:', modalError);
      }
    }
    
    return null;
  }
}

Object.assign(CURRENCY_CONFIG, {
  gold: { uiGetter: getGoldFromUI, gameStatePath: 'gold', name: 'Gold', icon: '/assets/icons/goldpile.png', rarity: '1' },
  beastCoins: { uiGetter: getBeastCoinsFromUI, gameStatePath: 'coin', name: 'Beast Coins', icon: '/assets/icons/beastcoin.png', rarity: '2' },
  dust: { gameStateGetter: getDustFromGameState, gameStatePath: 'dust', name: 'Dust', icon: '/assets/icons/dust.png', rarity: '3' },
  huntingMarks: { uiGetter: getHuntingMarksFromUI, gameStateGetter: getHuntingMarksFromGameState, apiGetter: getHuntingMarksFromProfileAPI, gameStatePath: 'questLog.task.points', name: 'Hunting Marks', icon: 'sprite://35572', rarity: '3' }
});

async function processLazyLoadQueue() {
  if (cyclopediaState.isProcessingQueue || cyclopediaState.lazyLoadQueue.length === 0) return;
  
  cyclopediaState.isProcessingQueue = true;
  
  try {
    while (cyclopediaState.lazyLoadQueue.length > 0) {
      const { monsterId, callback } = cyclopediaState.lazyLoadQueue.shift();
      
      try {
        const monsterData = safeGetMonsterData(monsterId);
        if (callback && typeof callback === 'function') callback(monsterData);
      } catch (error) {
        console.error(`[Cyclopedia] Error loading monster ${monsterId}:`, error);
        if (callback && typeof callback === 'function') callback(null);
      }
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  } finally {
    cyclopediaState.isProcessingQueue = false;
  }
}

function queueMonsterDataLoad(monsterId, callback) {
  cyclopediaState.lazyLoadQueue.push({ monsterId, callback });
  if (!cyclopediaState.isProcessingQueue) processLazyLoadQueue();
}

function safeGetMonsterData(monsterId) {
  try {
    if (!globalThis.state?.utils?.getMonster) throw new Error('Monster API not available');
    const monsterData = globalThis.state.utils.getMonster(monsterId);
    if (!monsterData?.metadata) throw new Error('Invalid monster data');
    return monsterData;
  } catch (error) {
    console.error(`[Cyclopedia] Error getting monster data for ID ${monsterId}:`, error);
    return null;
  }
}

// =======================
// 6. Characters Tab Caching Utilities
// =======================
function getCachedProfileData(playerName, ttl = 300000) { return cyclopediaState.getProfileData(playerName, ttl); }
function setCachedProfileData(playerName, data) { cyclopediaState.setProfileData(playerName, data); }
function getCachedLeaderboardData(category, ttl = 300000) { return cyclopediaState.getLeaderboardData(category, ttl); }
function setCachedLeaderboardData(category, data) { cyclopediaState.setLeaderboardData(category, data); }
function getRankingsCacheKey(options = {}) {
  const seasonNum = Number(options.season);
  const effectiveSeason = Number.isFinite(seasonNum) && seasonNum >= 0 ? seasonNum : 2;
  const qualified = options.qualified !== false;
  const limit = Number(options.limit) || START_PAGE_CONFIG.RANKINGS_PAGE_SIZE;
  const offset = Number(options.offset) || 0;
  const sort = options.sort || 'level';
  const order = options.order === 'asc' ? 'asc' : 'desc';
  return `rankings-v4-s${effectiveSeason}-q${qualified ? '1' : '0'}-l${limit}-o${offset}-s${sort}-${order}`;
}
function getRankingsListCacheKey(options = {}) {
  const seasonNum = Number(options.season);
  const effectiveSeason = Number.isFinite(seasonNum) && seasonNum >= 0 ? seasonNum : 2;
  const qualified = options.qualified !== false;
  return `rankings-list-v3-s${effectiveSeason}-q${qualified ? '1' : '0'}`;
}
function compareRankingsRows(a, b, sortKey, order) {
  let aVal = a[sortKey];
  let bVal = b[sortKey];
  if (typeof aVal === 'string') {
    aVal = aVal.toLowerCase();
    bVal = bVal.toLowerCase();
  }
  let primarySort = 0;
  if (sortKey === 'timeSum') {
    primarySort = order === 'desc' ? aVal - bVal : bVal - aVal;
  } else if (typeof aVal === 'string') {
    primarySort = order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
  } else {
    primarySort = order === 'desc' ? bVal - aVal : aVal - bVal;
  }
  if (primarySort === 0) return b.level - a.level;
  return primarySort;
}
function applyClientRankingsQuery(rankings, { sort, order, limit, offset, timestamp }) {
  let list = Array.isArray(rankings) ? [...rankings] : [];
  const sortKey = sort || 'level';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';
  list.sort((a, b) => compareRankingsRows(a, b, sortKey, sortOrder));
  const total = list.length;
  const page = list.slice(offset, offset + limit).map((row, index) => ({
    ...row,
    rank: offset + index + 1
  }));
  return {
    rankings: page,
    total,
    limit,
    offset,
    timestamp: timestamp || null,
    serverPaginated: false
  };
}
/** Apply limit/offset when the API returns a full list without pagination metadata. */
function normalizeRankingsApiResponse(data, queryOptions) {
  const {
    limit = START_PAGE_CONFIG.RANKINGS_PAGE_SIZE,
    offset = 0,
    sort = 'level',
    order = 'desc'
  } = queryOptions || {};
  const rankings = Array.isArray(data?.rankings) ? data.rankings : [];
  const timestamp = data?.timestamp || null;
  const hasServerPagination = typeof data?.total === 'number';

  if (hasServerPagination) {
    return {
      rankings,
      total: data.total,
      limit: data.limit ?? limit,
      offset: typeof data.offset === 'number' ? data.offset : offset,
      timestamp,
      serverPaginated: true
    };
  }

  return applyClientRankingsQuery(rankings, { sort, order, limit, offset, timestamp });
}
function getCachedRankingsData(options, ttl = 300000) {
  return cyclopediaState.getLeaderboardData(getRankingsCacheKey(options), ttl);
}
function setCachedRankingsData(options, data) {
  cyclopediaState.setLeaderboardData(getRankingsCacheKey(options), data);
}
function clearCharactersTabCache() { cyclopediaState.clearCache('all'); }
function clearLeaderboardCache() { cyclopediaState.clearCache('leaderboardData'); }
function clearNonRankingsLeaderboardCache() {
  for (const key of [...cyclopediaState.cache.leaderboardData.keys()]) {
    if (!String(key).startsWith('rankings')) {
      cyclopediaState.cache.leaderboardData.delete(key);
    }
  }
}
function clearSearchedUsername() { cyclopediaState.searchedUsername = null; }
function refreshCyclopediaRecordsOnOpen() {
  // Always refresh WR + personal records when Cyclopedia opens (keep rankings cache).
  cyclopediaState.cache.profileData.clear();
  clearNonRankingsLeaderboardCache();
  cyclopediaState.cache.roomThumbnails.clear();
  cyclopediaState.cache.lastFetch.clear();
  cyclopediaState.pendingRequests.clear();
  cyclopediaState.lastStartupProfileData = null;
  if (typeof MapsDataFetcher !== 'undefined' && MapsDataFetcher && typeof MapsDataFetcher.clearCache === 'function') {
    MapsDataFetcher.clearCache();
  }
}
function truncatePlayerName(name) {
  if (!name || typeof name !== 'string') return name || '';
  return name.length > 8 ? name.substring(0, 8) + '...' : name;
}

function truncateListPlayerName(name) {
  if (!name || typeof name !== 'string') return name || '';
  return name.length > 6 ? name.substring(0, 6) + '...' : name;
}

function appendStatsWorldRecordPlayerLink(container, playerName, truncateStyle) {
  const slot = container.querySelector('[data-stats-player-slot]');
  if (!slot) return;
  if (playerName) {
    slot.replaceWith(createStatsWorldRecordPlayerLink(playerName, truncateStyle));
  } else {
    slot.remove();
  }
}

function createStatsWorldRecordPlayerLink(playerName, truncateStyle) {
  const line = document.createElement('div');
  line.style.cssText = `margin-bottom: 6px; font-size: 10px; color: #888; ${truncateStyle}`;
  line.title = playerName;
  line.textContent = playerName;

  if (playerName && playerName !== 'Unknown') {
    NavigationHandler.attachProfileNavigation(line, playerName);
    line.style.color = '#888';
  }

  return line;
}

// RunTracker integration functions
// Helper function to resolve map ID to map name (same as RunTracker)
function resolveMapName(mapId) {
  try {
    if (!mapId) return null;
    
    // Try to get the name from the API utility maps
    if (window.mapIdsToNames && window.mapIdsToNames.has(mapId)) {
      return window.mapIdsToNames.get(mapId);
    }
    
    // Fallback to the game state utils
    if (globalThis.state?.utils?.ROOM_NAME && globalThis.state.utils.ROOM_NAME[mapId]) {
      return globalThis.state.utils.ROOM_NAME[mapId];
    }
    
    // If all else fails, return the ID
    return mapId;
  } catch (error) {
    console.warn('[Cyclopedia] Error resolving map name:', error);
    return mapId;
  }
}

function getLocalRunData() {
  try {
    
    if (window.RunTrackerAPI) {
      
      const data = window.RunTrackerAPI.getAllRuns();
      
      return Promise.resolve(data);
    }
    // Fallback to direct storage access
    if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
      
      return new Promise(resolve => {
        window.browserAPI.storage.local.get('ba_local_runs', result => {
          
          resolve(result.ba_local_runs || null);
        });
      });
    }
    
    return Promise.resolve(null);
  } catch (error) {
    console.warn('[Cyclopedia] Error getting local run data:', error);
    return Promise.resolve(null);
  }
}

function filterLocalRunsByActiveSeason(runs) {
  const activeSeason = Number(cyclopediaState.profileSeason || 1);
  if (!Array.isArray(runs)) return [];
  return runs.filter((run) => {
    if (!run || run.season === undefined || run.season === null) return activeSeason === 1;
    return Number(run.season) === activeSeason;
  });
}

// RunTracker prunes empty setup.pieces on load; Cyclopedia only warns on remaining data issues.
function shouldShowCyclopediaRunWarnings() {
  return Number(cyclopediaState.profileSeason || 1) === 2;
}

function runSetupHasLevel1Creature(run) {
  return Boolean(run?.setup?.pieces?.some((piece) => piece?.level === 1));
}

function getCyclopediaRunWarningReasons(run, options = {}) {
  const reasons = [];
  if (options.isTimeInvalid) reasons.push('faster than your best time');
  if (options.isWorldRecordInvalid) reasons.push('faster than world record');
  if (options.isRankInvalid) reasons.push('worse rank than your best');
  if (runSetupHasLevel1Creature(run)) reasons.push('has level 1 creatures');
  return reasons;
}

function getCyclopediaRunWarningState(run, options = {}) {
  if (!shouldShowCyclopediaRunWarnings()) {
    return { shouldWarn: false, reasons: [] };
  }
  const reasons = getCyclopediaRunWarningReasons(run, options);
  return { shouldWarn: reasons.length > 0, reasons };
}

function decorateCyclopediaRunWarningCell(cell, textElement, row, warningState) {
  const warningIcon = document.createElement('span');
  warningIcon.innerHTML = '⚠️';
  warningIcon.title = `This run might be invalid (${warningState.reasons.join(', ')})`;
  warningIcon.style.cursor = 'help';
  warningIcon.style.position = 'absolute';
  warningIcon.style.left = '1px';
  warningIcon.style.fontSize = '10px';
  warningIcon.style.zIndex = '1';

  textElement.style.textAlign = 'center';
  textElement.style.flex = '1';
  textElement.style.marginLeft = '12px';

  cell.appendChild(warningIcon);
  cell.appendChild(textElement);
  row.style.color = '#ff6b6b';
}

function getLocalRunsForMap(mapKey, category = null) {
  try {
    
    if (window.RunTrackerAPI) {
      
      const data = window.RunTrackerAPI.getRuns(mapKey, category);
      if (category) {
        return Promise.resolve(filterLocalRunsByActiveSeason(Array.isArray(data) ? data : []));
      }
      return Promise.resolve({
        speedrun: filterLocalRunsByActiveSeason(data?.speedrun || []),
        rank: filterLocalRunsByActiveSeason(data?.rank || []),
        floor: filterLocalRunsByActiveSeason(data?.floor || [])
      });
    }
    // Fallback to direct storage access
    
    return getLocalRunData().then(runData => {
      
      if (!runData || !runData.runs || !runData.runs[mapKey]) {
        
        return category ? [] : { speedrun: [], rank: [] };
      }
      
      if (category) {
        const categoryData = runData.runs[mapKey][category] || [];
        
        return filterLocalRunsByActiveSeason(categoryData);
      }
      
      const mapData = runData.runs[mapKey];
      
      return {
        speedrun: filterLocalRunsByActiveSeason(mapData?.speedrun || []),
        rank: filterLocalRunsByActiveSeason(mapData?.rank || []),
        floor: filterLocalRunsByActiveSeason(mapData?.floor || [])
      };
    });
  } catch (error) {
    console.warn('[Cyclopedia] Error getting local runs for map:', error);
    return Promise.resolve(category ? [] : { speedrun: [], rank: [] });
  }
}

function formatLocalRunTime(ticks) {
  if (!ticks || isNaN(ticks)) return 'N/A';
  // Display ticks with "ticks" suffix
  return `${ticks.toString()} ticks`;
}

// Helper function to normalize user's floor data with fallback
// If both floor and floorTicks are missing, defaults to floor 0 and uses room's ticks
function normalizeUserFloorData(room) {
  if (!room) {
    return { floor: null, floorTicks: null };
  }

  let floor = room?.floor;
  let floorTicks = room?.floorTicks;
  
  if ((floor === undefined || floor === null) && (floorTicks === undefined || floorTicks === null)) {
    floor = 0;
    floorTicks = room?.ticks || 0;
  }
  
  return { floor, floorTicks };
}

// Helper function to normalize best/highscore floor data with fallback
// If both floor and floorTicks are missing, defaults to floor 0 and uses speedrun ticks
function normalizeBestFloorData(roomCode, roomsHighscores, best) {
  const bestFloorData = roomsHighscores?.floor?.[roomCode];
  let floor = bestFloorData?.floor;
  let floorTicks = bestFloorData?.floorTicks || bestFloorData?.ticks;
  let playerName = bestFloorData?.userName || 'Unknown';
  
  if ((floor === undefined || floor === null) && (floorTicks === undefined || floorTicks === null)) {
    floor = 0;
    floorTicks = best?.[roomCode]?.ticks || 0;
    playerName = best?.[roomCode]?.userName || 'Unknown';
  }
  
  return { floor, floorTicks, playerName };
}

// Optimized data fetching system for Maps Tab
const MapsDataFetcher = {
  // Cache for different data types with individual TTLs
  cache: new Map(),
  pendingRequests: new Map(),
  
  // Rate limiting protection
  rateLimit: {
    lastRequestTime: 0,
    requestCount: 0,
    windowStart: 0,
    maxRequests: 25, // Conservative limit (30 per 10s, but leave buffer)
    windowMs: 10000  // 10 seconds
  },
  
  // Cache TTLs in milliseconds
  TTL: {
    LEADERBOARDS: 5 * 60 * 1000, // 5 minutes
    ROOM_DATA: 10 * 60 * 1000,   // 10 minutes
    PLAYER_DATA: 2 * 60 * 1000   // 2 minutes
  },
  
  // Get cached data with TTL check and error handling
  getCached(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    const ttl = this.TTL[key.split('-')[0].toUpperCase()] || this.TTL.LEADERBOARDS;
    
    // Check if cached data has an error
    if (cached.data && cached.data.error) {
      // For rate limit errors, use shorter TTL (30 seconds)
      const errorTTL = cached.data.error === 'rate_limited' ? 30000 : 60000;
      if (now - cached.timestamp < errorTTL) {
        return cached.data; // Return error data to prevent repeated requests
      }
      this.cache.delete(key);
      return null;
    }
    
    // Normal TTL check
    if (now - cached.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  },
  
  // Set cached data with timestamp
  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (this.cache.size > 20) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  },
  
  // Check rate limit before making request
  checkRateLimit() {
    const now = Date.now();
    
    // Reset window if needed
    if (now - this.rateLimit.windowStart > this.rateLimit.windowMs) {
      this.rateLimit.requestCount = 0;
      this.rateLimit.windowStart = now;
    }
    
    // Check if we're at the limit
    if (this.rateLimit.requestCount >= this.rateLimit.maxRequests) {
      const timeToWait = this.rateLimit.windowMs - (now - this.rateLimit.windowStart);
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(timeToWait / 1000)} seconds.`);
    }
    
    // Update rate limit counters
    this.rateLimit.requestCount++;
    this.rateLimit.lastRequestTime = now;
  },
  
  // Optimized TRPC fetch with request deduplication and rate limiting
  async fetchTRPC(method) {
    // Check if request is already pending
    if (this.pendingRequests.has(method)) {
      return await this.pendingRequests.get(method);
    }
    
    // Check cache first
    const cached = this.getCached(method);
    if (cached) {
      return cached;
    }
    
    // Check rate limit before making request
    this.checkRateLimit();
    
    // Create new request
    const requestPromise = this._makeTRPCRequest(method);
    this.pendingRequests.set(method, requestPromise);
    
    try {
      const result = await requestPromise;
      this.setCached(method, result);
      return result;
    } finally {
      this.pendingRequests.delete(method);
    }
  },
  
  // Actual TRPC request implementation with graceful error handling
  async _makeTRPCRequest(method) {
    const inp = encodeURIComponent(JSON.stringify({ 0: { json: null, meta: { values: ["undefined"] } } }));
    const url = `/api/trpc/${method}?batch=1&input=${inp}`;
    
    try {
      const response = await fetch(url, {
        headers: { 
          'Accept': '*/*', 
          'Content-Type': 'application/json', 
          'X-Game-Version': '1' 
        }
      });
      
      if (response.status === 429) {
        // Rate limited - cache this as a temporary failure
        this.setCached(method, { error: 'rate_limited', timestamp: Date.now() });
        throw new Error(`Rate limited. Please wait before trying again.`);
      }
      
      if (!response.ok) {
        throw new Error(`${method} → ${response.status}`);
      }
      
      const json = await response.json();
      return json[0].result.data.json;
    } catch (error) {
      // If it's a rate limit error, don't cache it
      if (error.message.includes('Rate limited')) {
        throw error;
      }
      
      // For other errors, cache a temporary failure to prevent repeated requests
      this.setCached(method, { error: 'request_failed', timestamp: Date.now() });
      throw error;
    }
  },
  
  // Batch fetch all leaderboard data
  async fetchAllLeaderboardData() {
    const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
    if (!playerState?.name) return null;

    // Check for cached combined data (recompute yourRooms — season can change without refetch)
    const cachedData = this.getCached('combined-leaderboards');
    if (cachedData) {
      return {
        ...cachedData,
        yourRooms: getYourRoomsForCyclopediaSeason(playerState.rooms || {})
      };
    }

    try {
      console.log('[Cyclopedia] Fetching maps leaderboard batch: game.getTickHighscores, game.getTickLeaderboards, game.getRoomsHighscores');
      // Fetch all data in parallel with individual caching
      const [best, lbs, roomsHighscores] = await Promise.all([
        this.fetchTRPC('game.getTickHighscores'),
        this.fetchTRPC('game.getTickLeaderboards'),
        this.fetchTRPC('game.getRoomsHighscores')
      ]);

      const data = {
        best,
        lbs,
        roomsHighscores,
        yourRooms: getYourRoomsForCyclopediaSeason(playerState.rooms || {}),
        ROOM_NAMES: globalThis.state.utils.ROOM_NAME
      };

      this.setCached('combined-leaderboards', data);
      return data;
    } catch (error) {
      console.error('[Cyclopedia] Error fetching maps leaderboard data:', error);
      return null;
    }
  },
  
  // Clear cache
  clearCache() {
    this.cache.clear();
    this.pendingRequests.clear();
  }
};

// Global function to fetch leaderboard data for Maps Tab (now uses optimized fetcher)
async function fetchMapsLeaderboardData() {
  return await MapsDataFetcher.fetchAllLeaderboardData();
}

// Optimized room thumbnail caching system
const RoomThumbnailCache = {
  cache: new Map(),
  maxSize: 50,
  
  // Get cached thumbnail
  get(roomCode) {
    return this.cache.get(roomCode);
  },
  
  // Set cached thumbnail with size info
  set(roomCode, imgElement, size = 32) {
    this.cache.set(roomCode, {
      element: imgElement,
      size: size,
      timestamp: Date.now()
    });
    
    // Enforce cache size limit
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  },
  
  // Create or get cached thumbnail
  createThumbnail(roomCode, roomName, size = 32) {
    const cached = this.get(roomCode);
    
    if (cached && cached.size === size) {
      // Return cached element if same size
      return cached.element.cloneNode(true);
    }
    
    // Create new thumbnail
    const thumbnail = document.createElement('img');
    thumbnail.src = `/assets/room-thumbnails/${roomCode}.png`;
    thumbnail.alt = roomName;
    thumbnail.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      border-radius: 4px;
      object-fit: cover;
      border: 1px solid #666;
    `;
    
    // Cache the thumbnail
    this.set(roomCode, thumbnail, size);
    
    return thumbnail;
  },
  
  // Clear cache
  clear() {
    this.cache.clear();
  }
};

// Optimized creature list management system
const CreatureListManager = {
  // Element pool for reusing DOM elements
  elementPool: {
    creatureRows: [],
    creatureIcons: [],
    infoContainers: [],
    equipmentContainers: []
  },
  
  // Cache for creature data to avoid repeated lookups
  creatureDataCache: new Map(),
  
  // Get element from pool or create new one
  getPooledElement(type, createFn) {
    if (this.elementPool[type].length > 0) {
      const element = this.elementPool[type].pop();
      // Reset element state
      element.innerHTML = '';
      element.className = '';
      element.removeAttribute('data-highlighted');
      element.removeAttribute('data-recent');
      element.removeAttribute('data-multiselected');
      return element;
    }
    return createFn();
  },
  
  // Return element to pool
  returnToPool(type, element) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
    // Clean up event listeners and references
    if (element.removeEventListener) {
      element.removeEventListener('click', null);
      element.removeEventListener('mouseenter', null);
      element.removeEventListener('mouseleave', null);
    }
    // Reset element
    element.innerHTML = '';
    element.className = '';
    element.removeAttribute('data-highlighted');
    element.removeAttribute('data-recent');
    element.removeAttribute('data-multiselected');
    
    this.elementPool[type].push(element);
  },
  
  // Get cached creature data
  getCachedCreatureData(actorId) {
    return this.creatureDataCache.get(actorId);
  },
  
  // Cache creature data
  cacheCreatureData(actorId, data) {
    this.creatureDataCache.set(actorId, {
      data,
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (this.creatureDataCache.size > 100) {
      const firstKey = this.creatureDataCache.keys().next().value;
      this.creatureDataCache.delete(firstKey);
    }
  },
  
  // Simplified creature icon creation
  createSimplifiedCreatureIcon(actor) {
    const iconContainer = this.getPooledElement('creatureIcons', () => {
      const div = document.createElement('div');
      div.style.cssText = `
        width: 40px;
        height: 40px;
        position: relative;
        border-radius: 4px;
        overflow: hidden;
        background: url('https://bestiaryarena.com/_next/static/media/background-darker.2679c837.png') repeat;
        border: 1px solid #666;
      `;
      return div;
    });
    
    // Create portrait image
    const img = document.createElement('img');
    img.src = actor.shiny === true ? `/assets/portraits/${actor.id}-shiny.png` : `/assets/portraits/${actor.id}.png`;
    img.alt = 'creature';
    img.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
    `;
    
    // Create level badge
    const levelBadge = document.createElement('div');
    levelBadge.textContent = actor.level || 1;
    levelBadge.style.cssText = `
      position: absolute;
      bottom: 2px;
      left: 2px;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      font-size: 10px;
      padding: 1px 3px;
      border-radius: 2px;
      font-weight: bold;
    `;
    
    iconContainer.appendChild(img);
    iconContainer.appendChild(levelBadge);
    
    return iconContainer;
  },
  
  // Clean up all pooled elements
  cleanup() {
    Object.keys(this.elementPool).forEach(type => {
      this.elementPool[type].forEach(element => {
        if (element && element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
      this.elementPool[type] = [];
    });
    this.creatureDataCache.clear();
  }
};

const MONSTER_MAP_CONFIG = { maxSearchId: 1000, maxConsecutiveFailures: 10, fallbackMaxId: 200 };
const buildCyclopediaMonsterNameMap = MemoizationUtils.memoize(function() {
  const db = window.creatureDatabase;
  if (typeof db?.getMonsterNameMap === 'function') {
    cyclopediaState.monsterNameMap = db.getMonsterNameMap();
    cyclopediaState.monsterNameMapBuilt = true;
    return cyclopediaState.monsterNameMap;
  }
  if (cyclopediaState.monsterNameMapBuilt && cyclopediaState.monsterNameMap) return cyclopediaState.monsterNameMap;
  cyclopediaState.monsterNameMap = new Map();
  const utils = globalThis.state.utils;
  if (!utils?.getMonster) return;
  
  let maxId = MONSTER_MAP_CONFIG.fallbackMaxId, consecutiveFailures = 0;
  try {
    for (let i = 1; i < MONSTER_MAP_CONFIG.maxSearchId; i++) {
      try {
        const monster = utils.getMonster(i);
        if (!monster?.metadata?.name) {
          if (++consecutiveFailures >= MONSTER_MAP_CONFIG.maxConsecutiveFailures) {
            maxId = Math.max(1, i - MONSTER_MAP_CONFIG.maxConsecutiveFailures); break;
          }
        } else { consecutiveFailures = 0; maxId = i; }
      } catch (error) {
        if (++consecutiveFailures >= MONSTER_MAP_CONFIG.maxConsecutiveFailures) {
          maxId = Math.max(1, i - MONSTER_MAP_CONFIG.maxConsecutiveFailures); break;
        }
      }
    }
  } catch (error) {
    console.warn('[Cyclopedia] Error in monster location cache:', error);
  }
  
  for (let i = 1; i <= maxId; i++) {
    try {
      const monster = utils.getMonster(i);
      if (monster?.metadata?.name) {
        cyclopediaState.monsterNameMap.set(monster.metadata.name.toLowerCase(), { monster, index: i });
      }
    } catch (error) { continue; }
  }
  cyclopediaState.monsterNameMapBuilt = true;
  
  return cyclopediaState.monsterNameMap;
});

// Regex patterns for item detection
const ITEM_PATTERNS = {
  MONSTER: /^(.*?)\s*\(\d+%\)/,
  EQUIPMENT: /^(.*?)\s*\(Tier: \d+\)/
};

// Inject CSS rules for cyclopedia button visibility (one-time setup)
if (!document.getElementById('cyclopedia-force-visible')) {
  const style = document.createElement('style');
  style.id = 'cyclopedia-force-visible';
  style.textContent = `
    .dropdown-menu-item[data-radix-collection-item] {
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    
    .dropdown-menu-item[data-radix-collection-item]:hover {
      background-color: rgba(255, 255, 255, 0.1) !important;
    }
    
    .dropdown-menu-item[data-radix-collection-item]:focus {
      background-color: rgba(255, 255, 255, 0.15) !important;
      outline: none !important;
    }
  `;
  document.head.appendChild(style);
}

const MENU_UTILS = {
  getGroup: (menuElem) => menuElem.querySelector('div[role="group"]'),
  getFirstItem: (group) => group?.querySelector('.dropdown-menu-item')
};

function getItemNameFromMenu(menuElem) {
  const group = MENU_UTILS.getGroup(menuElem);
  const firstItem = MENU_UTILS.getFirstItem(group);
  if (!firstItem) return null;
  
  const text = firstItem.textContent;
  
  // Check for monster pattern first (X%)
  const monsterMatch = text.match(ITEM_PATTERNS.MONSTER);
  if (monsterMatch) {
    return { type: 'monster', name: monsterMatch[1] };
  }
  
  // Check for equipment pattern (Tier: X)
  const equipmentMatch = text.match(ITEM_PATTERNS.EQUIPMENT);
  if (equipmentMatch) {
    return { type: 'equipment', name: equipmentMatch[1] };
  }
  
  return null;
}

const LOCATION_UTILS = {
  getMonsterGameId: (monsterName) => {
    const entry = cyclopediaState.monsterNameMap?.get(monsterName.toLowerCase());
    if (entry) return entry.index;
    const maps = window.BestiaryModAPI?.utility?.maps;
    return maps?.monsterNamesToGameIds?.get(monsterName.toLowerCase());
  },
  createLocationData: (actor, index) => ({
    tileIndex: null, direction: actor.direction || 'unknown', level: actor.level || 1,
    tier: 0, villain: true, equipment: null, actorIndex: index
  })
};

function findMonsterLocations(monsterName) {
  const cacheKey = monsterName.toLowerCase();
  if (cyclopediaState.monsterLocationCache.has(cacheKey)) return cyclopediaState.monsterLocationCache.get(cacheKey);
  
  const locations = [];
  try {
    const monsterGameId = LOCATION_UTILS.getMonsterGameId(monsterName);
    if (!monsterGameId) {
      cyclopediaState.monsterLocationCache.set(cacheKey, locations);
      return locations;
    }
    
    const rooms = globalThis.state.utils.ROOMS;
    const roomNames = globalThis.state.utils.ROOM_NAME;
    Object.entries(rooms).forEach(([roomId, room]) => {
      try {
        const actors = room.file?.data?.actors;
        if (!actors) return;
        
        const monsterInRoom = actors.filter(actor => actor?.id === monsterGameId);
        if (monsterInRoom.length > 0) {
          const roomName = roomNames[roomId] || roomId;
          const roomLocations = monsterInRoom.map((actor, index) => LOCATION_UTILS.createLocationData(actor, index));
          locations.push({ roomId, roomName, positions: roomLocations });
        }
      } catch (error) {
    console.warn('[Cyclopedia] Error in monster location cache:', error);
  }
    });
  } catch (error) {
    console.warn('[Cyclopedia] Error in monster location cache:', error);
  }
  
  cyclopediaState.monsterLocationCache.set(cacheKey, locations);
  return locations;
}

function getLevelFromExp(exp) {
  const expValue = Number(exp);
  if (!Number.isFinite(expValue) || expValue <= 0) return 1;

  // Use live game conversion so newer level caps (e.g. 99) stay accurate.
  const expToCurrentLevel = globalThis.state?.utils?.expToCurrentLevel;
  if (typeof expToCurrentLevel === 'function') {
    const liveLevel = Number(expToCurrentLevel(expValue));
    if (Number.isFinite(liveLevel) && liveLevel > 0) return Math.floor(liveLevel);
  }
  return 1;
}

// =======================
// 7. DOM/CSS Injection Helpers
// =======================
const CYCLOPEDIA_BUTTON_CSS = `.cyclopedia-subnav { display: flex; gap: 0; margin-bottom: 0; width: 100%; } nav.cyclopedia-subnav > button.cyclopedia-btn, nav.cyclopedia-subnav > button.cyclopedia-btn:hover, nav.cyclopedia-subnav > button.cyclopedia-btn:focus { background: url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat !important; border: 6px solid transparent !important; border-color: #ffe066 !important; border-image: url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch !important; color: var(--theme-text, #e6d7b0) !important; font-weight: 700 !important; border-radius: 0 !important; box-sizing: border-box !important; transition: color 0.2s, border-image 0.1s !important; font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif !important; outline: none !important; position: relative !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; font-size: 16px !important; padding: 7px 24px !important; cursor: pointer; flex: 1 1 0; min-width: 0; } nav.cyclopedia-subnav > button.cyclopedia-btn.pressed, nav.cyclopedia-subnav > button.cyclopedia-btn:active { border-image: url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 6 fill stretch !important; } nav.cyclopedia-subnav > button.cyclopedia-btn.active { border-image: url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 6 fill stretch !important; } nav.cyclopedia-subnav > button.cyclopedia-btn[data-tab="home"], nav.cyclopedia-subnav > button.cyclopedia-btn[data-tab="wiki"] { width: 42px !important; height: 42px !important; min-width: 42px !important; min-height: 42px !important; max-width: 42px !important; max-height: 42px !important; flex: 0 0 42px !important; padding: 0 !important; font-size: 12px !important; }`;
function injectCyclopediaButtonStyles() { injectCyclopediaStyle('cyclopedia-btn-css', CYCLOPEDIA_BUTTON_CSS); }

const CYCLOPEDIA_BOX_CSS = `.cyclopedia-box { display: flex; flex-direction: column; border: none; background: none; margin-bottom: 16px; min-height: 120px; box-sizing: border-box; } .cyclopedia-box-title { border: 6px solid transparent; border-image: url('https://bestiaryarena.com/_next/static/media/4-frame-top.b7a55115.png') 6 6 0 6 stretch; border-bottom: none; background: #232323; color: #ffe066; font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif; font-size: 15px; font-weight: bold; padding: 4px 12px; text-align: left; letter-spacing: 1px; } .cyclopedia-box-content { flex: 1 1 0; overflow-y: auto; background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat; padding: 8px 12px; color: #e6d7b0; font-size: 14px; font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif; min-height: 0; max-height: none; scrollbar-width: thin !important; scrollbar-color: #444 #222 !important; } .cyclopedia-box-content::-webkit-scrollbar { width: 12px !important; background: transparent !important; } .cyclopedia-box-content::-webkit-scrollbar-thumb { background: url('https://bestiaryarena.com/_next/static/media/scrollbar-handle-vertical.962972d4.png') repeat-y !important; border-radius: 4px !important; } .cyclopedia-box-content::-webkit-scrollbar-corner { background: transparent !important; }`;
function injectCyclopediaBoxStyles() { injectCyclopediaStyle('cyclopedia-box-css', CYCLOPEDIA_BOX_CSS); }

const CYCLOPEDIA_SELECTED_CSS = `.cyclopedia-selected { background: rgba(255,255,255,0.18) !important; color: inherit !important; } .cyclopedia-box .equipment-portrait .absolute { background: none !important; } .cyclopedia-box .equipment-portrait[data-highlighted="true"] .absolute { background: none !important; } .cyclopedia-box .equipment-portrait .absolute[style*="radial-gradient"] { background: none !important; } .cyclopedia-box .equipment-portrait .absolute[style*="background: radial-gradient"] { background: none !important; } .cyclopedia-box .equipment-portrait .absolute[style*="rgba(0, 0, 0, 0.5)"] { background: none !important; } .cyclopedia-box .equipment-portrait .absolute.bottom-0.left-0 { background: none !important; }`;
function injectCyclopediaSelectedCss() { injectCyclopediaStyle('cyclopedia-selected-css', CYCLOPEDIA_SELECTED_CSS); }

function removeCyclopediaFromMenus() {
  // Generic DOM traversal helper
  const traverseParents = (el, condition) => {
    let parent = el.parentElement;
    while (parent) {
      if (condition(parent)) return true;
      parent = parent.parentElement;
    }
    return false;
  };
  
  // Check if element is in a specific menu
  const isInMenu = (el, menuLabel) => traverseParents(el, parent => 
    parent.textContent?.includes(menuLabel) && 
    (parent.getAttribute('role') === 'menu' || parent.classList.contains('dropdown-menu'))
  );
  
  // Check if element is a header button
  const isHeaderButton = (el) => {
    if (el.classList?.contains('cyclopedia-header-btn') || 
        (el.tagName === 'LI' && el.querySelector('.cyclopedia-header-btn'))) return true;
    return traverseParents(el, parent => 
      parent.classList?.contains('cyclopedia-header-btn') || 
      (parent.tagName === 'LI' && parent.querySelector('.cyclopedia-header-btn'))
    );
  };
  
  // Check if element is in header
  const isInHeader = (el) => traverseParents(el, parent => 
    parent.tagName === 'NAV' || parent.classList?.contains('w-full')
  );
  
  // Enhanced menu detection
  const isInAccountMenu = (el) => {
    const menuText = el.textContent?.toLowerCase() || '';
    return menuText.includes('my account') || menuText.includes('logout') || menuText.includes('profile') || 
           menuText.includes('outfit') || menuText.includes('history') || menuText.includes('redeem code') || 
           menuText.includes('rewards') || menuText.includes('language');
  };
  
  const isInGameModeMenu = (el) => {
    const menuText = el.textContent?.toLowerCase() || '';
    return menuText.includes('game mode') || menuText.includes('cyclopedia') || menuText.includes('manual') || 
           menuText.includes('autoplay') || menuText.includes('sandbox');
  };
  
  // Process all cyclopedia elements
  document.querySelectorAll('div, li').forEach(el => {
    if (el.textContent.trim().toLowerCase() === 'cyclopedia') {
      // Skip elements that should be excluded (e.g., from VIP List)
      if (el.hasAttribute('data-cyclopedia-exclude') || el.hasAttribute('data-vip-list-item')) {
        return;
      }
      
      const inMyAccount = isInMenu(el, 'My account') || isInAccountMenu(el);
      const inGameMode = isInMenu(el, 'Game mode') || isInGameModeMenu(el);
      const isHeader = isHeaderButton(el);
      const inHeader = isInHeader(el);
      
      if ((inMyAccount || inGameMode) && !isHeader && !inHeader) el.style.display = 'none';
    }
  });
}

const menuTimeout = setTimeout(removeCyclopediaFromMenus, 500);
TimerManager.addTimeout(menuTimeout, 'removeCyclopediaFromMenus');

const cyclopediaMenuObserver = new MutationObserver(removeCyclopediaFromMenus);
cyclopediaMenuObserver.observe(document.body, { childList: true, subtree: true });
ObserverManager.add(cyclopediaMenuObserver, 'cyclopediaMenuObserver');
window.cyclopediaMenuObserver = cyclopediaMenuObserver;

// =======================
// 8. UI Creation Functions
// =======================

// Creates a custom confirmation modal for deleting runs
function showDeleteConfirmationModal(runType, runData, onConfirm) {
  // Create modal overlay
  const overlay = DOMUtils.createStyledElement('div', {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: '10000',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  });
  
  // Create modal container
  const modal = DOMUtils.createStyledElement('div', {
    backgroundColor: '#232323',
    border: '3px solid #444',
    borderRadius: '8px',
    padding: '25px',
    maxWidth: '450px',
    width: '90%',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
    fontFamily: "'Trebuchet MS', 'Arial Black', Arial, sans-serif",
    position: 'relative'
  });
  
  // Create title
  const titleElement = DOMUtils.createStyledElement('div', {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#ffe066',
    marginBottom: '20px',
    textAlign: 'center',
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)'
  }, '', `Delete ${runType} Run`);
  
  // Create message
  const messageElement = DOMUtils.createStyledElement('div', {
    fontSize: '16px',
    color: '#fff',
    marginBottom: '25px',
    textAlign: 'center',
    lineHeight: '1.5'
  });
  
  // Create run details
  const detailsElement = DOMUtils.createStyledElement('div', {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid #555',
    borderRadius: '6px',
    padding: '15px',
    marginBottom: '25px',
    fontSize: '14px',
    color: '#ccc'
  });
  
  let detailsHtml = '';
  if (runData.time) {
    detailsHtml += `<div style="margin-bottom: 8px;"><strong>Time:</strong> ${runData.time} ticks</div>`;
  }
  if (runData.points) {
    detailsHtml += `<div style="margin-bottom: 8px;"><strong>Rank Points:</strong> ${runData.points}</div>`;
  }
  if (runData.mapName) {
    detailsHtml += `<div style="margin-bottom: 8px;"><strong>Map:</strong> ${runData.mapName}</div>`;
  }
  if (runData.seed) {
    detailsHtml += `<div><strong>Seed:</strong> ${runData.seed}</div>`;
  }
  
  detailsElement.innerHTML = detailsHtml;
  
  // Create warning message
  const warningElement = DOMUtils.createStyledElement('div', {
    fontSize: '14px',
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: '25px',
    fontStyle: 'italic'
  }, '', 'This action cannot be undone.');
  
  // Create button container
  const buttonContainer = DOMUtils.createStyledElement('div', {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px'
  });
  
  // Create cancel button
  const cancelButton = DOMUtils.createButton('Cancel', {
    backgroundColor: '#555',
    color: '#fff',
    border: '2px solid #666',
    borderRadius: '6px',
    padding: '12px 24px',
    cursor: 'pointer',
    fontSize: '16px',
    fontFamily: "'Trebuchet MS', 'Arial Black', Arial, sans-serif",
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
    minWidth: '100px'
  }, {
    backgroundColor: '#666',
    borderColor: '#777',
    transform: 'translateY(-2px)'
  });
  
  // Create delete button
  const deleteButton = DOMUtils.createButton('Delete', {
    backgroundColor: '#d32f2f',
    color: '#fff',
    border: '2px solid #f44336',
    borderRadius: '6px',
    padding: '12px 24px',
    cursor: 'pointer',
    fontSize: '16px',
    fontFamily: "'Trebuchet MS', 'Arial Black', Arial, sans-serif",
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
    minWidth: '100px'
  }, {
    backgroundColor: '#f44336',
    borderColor: '#ff5252',
    transform: 'translateY(-2px)'
  });
  
  // Add event listeners
  const closeModal = () => {
    if (overlay?.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };
  
  cancelButton.addEventListener('click', closeModal);
  deleteButton.addEventListener('click', () => {
    closeModal();
    if (onConfirm) onConfirm();
  });
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
  
  // Assemble modal
  messageElement.textContent = `Are you sure you want to delete this ${runType.toLowerCase()} run?`;
  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(deleteButton);
  modal.appendChild(titleElement);
  modal.appendChild(messageElement);
  modal.appendChild(detailsElement);
  modal.appendChild(warningElement);
  modal.appendChild(buttonContainer);
  overlay.appendChild(modal);
  
  // Show modal
  document.body.appendChild(overlay);
  
  // Focus cancel button for safety
  cancelButton.focus();
}

// Helper function to check if a map is a raid (uses maps-database comprehensive check)
function isMapRaid(mapId) {
  const classify = globalThis.mapsDatabase?.isMapRaidComprehensive;
  if (typeof classify === 'function') return classify(mapId);
  return false;
}

// Helper function to check if a map is a dynamic event.
// Uses mapsDatabase as the single source of truth for event classification.
function isDynamicEventMap(mapId) {
  try {
    const classify = globalThis.mapsDatabase?.isDynamicEventMap;
    if (typeof classify === 'function') {
      return classify(mapId);
    }
  } catch (error) {
    console.warn('[Cyclopedia] Error checking dynamic event map:', error);
  }
  return false;
}

function createBox({
  title, items, extraBoxStyles = {}, type = 'creature', selectedCreature, selectedEquipment, selectedInventory,
  setSelectedCreature, setSelectedEquipment, setSelectedInventory, updateRightCol, clearAllSelections = null, mapIds = null, regionIds = null
}) {
  if (!Array.isArray(items)) items = [];
  
  const box = DOMUtils.createElement('div');
  DOMUtils.applyCommonStyles(box, extraBoxStyles);
  
  const titleEl = DOMUtils.createTitle(title);
  box.appendChild(titleEl);
  
  const scrollContainer = DOMUtils.createScrollContainer();
  
  if (!scrollContainer || !scrollContainer.element) {
    console.error('[Cyclopedia] createBox: scrollContainer creation failed');
    const fallback = document.createElement('div');
    fallback.textContent = 'Scroll container error';
    fallback.style.color = 'red';
    return fallback;
  }

  const getListItemBaseName = getCyclopediaListItemBaseName;

  const ownedRooms = (type === 'map' || type === 'region')
    ? (globalThis.state?.player?.getSnapshot()?.context?.rooms ?? {})
    : null;

    items.forEach((name, itemIndex) => {
      // Check item status based on type
      let isOwned = true;
      let isPerfect = false;
      let isT5 = false;

      let hasShiny = false;
      let hasAwakened = false;
      let hasShinyTier = false;
      let hasHundoTier = false;

      if (type === 'creature') {
        const isUnobtainable = UNOBTAINABLE_CREATURES.some(c => c.toLowerCase() === name.toLowerCase());
        if (!isUnobtainable) {
          const status = getCreatureDisplayStatus(name);
          isOwned = status.owned;
          isPerfect = status.perfect;
          hasShiny = status.shiny;
          hasAwakened = status.awakened;
          hasShinyTier = status.shinyTier;
          hasHundoTier = status.hundoTier;
        }
      } else if (type === 'equipment') {
        const eqStatus = getEquipmentStatus(name);
        isOwned = eqStatus.owned;
        isT5 = eqStatus.isT5;
      } else if (type === 'map') {
        const mapId = mapIds?.[itemIndex];
        isOwned = mapId ? ownedRooms[mapId] !== undefined : false;
      } else if (type === 'region') {
        const regionId = regionIds?.[itemIndex];
        if (regionId && globalThis.state?.utils?.REGIONS) {
          const region = globalThis.state.utils.REGIONS.find(r => r.id === regionId);
          if (region && region.rooms) {
            isOwned = region.rooms.some(room => ownedRooms[room.id] !== undefined);
          } else {
            isOwned = false;
          }
        } else {
          isOwned = false;
        }
      }
      
      const item = DOMUtils.createListItem(name, FONT_CONSTANTS.SIZES.BODY, isOwned, isPerfect, isT5, hasShiny, hasAwakened, hasShinyTier, hasHundoTier);
      
      // Add raid icon for static raids, or event icon for dynamic event maps
      if (type === 'map') {
        const mapId = mapIds?.[itemIndex];
        if (mapId && isMapRaid(mapId)) {
          // Find the contentContainer (first child div created by createListItem)
          const contentContainer = item.firstElementChild;
          if (contentContainer && contentContainer.tagName === 'DIV') {
            // Check if it's a dynamic event or static raid
            const isDynamicEvent = isDynamicEventMap(mapId);
            
            // Create icon
            const icon = document.createElement('img');
            if (isDynamicEvent) {
              // Use plinko icon for dynamic event maps
              icon.src = 'https://bestiaryarena.com/assets/icons/plinko.png';
              icon.alt = 'event';
              icon.title = 'Event map';
            } else {
              // Use raid icon for static raids
              icon.src = 'https://bestiaryarena.com/assets/icons/raid.png';
              icon.alt = 'raid';
              icon.title = 'Raid map';
            }
            icon.style.width = '11px';
            icon.style.height = '11px';
            icon.style.flexShrink = '0';
            // Insert before the text span (or any existing icons)
            const textSpan = contentContainer.querySelector('span');
            if (textSpan) {
              contentContainer.insertBefore(icon, textSpan);
            } else {
              contentContainer.appendChild(icon);
            }
          }
        }
      }
      
      const clickHandler = () => {
        if (clearAllSelections) {
          clearAllSelections();
        } else if (box.clearAllSelections) {
          box.clearAllSelections();
        } else {
          box.querySelectorAll('.cyclopedia-selected').forEach(el => {
            el.classList.remove('cyclopedia-selected');
            el.style.background = 'none';
            // Check item status and restore appropriate styling
            const itemName = getListItemBaseName(el);
            if (type === 'creature') {
              const isUnobtainable = UNOBTAINABLE_CREATURES.some(c => c.toLowerCase() === itemName.toLowerCase());
              if (!isUnobtainable) {
                applyCreatureListItemStyle(el, getCreatureDisplayStatus(itemName), { isUnobtainable });
              } else {
                el.style.color = COLOR_CONSTANTS.TEXT;
                el.style.filter = 'none';
              }
            } else if (type === 'equipment') {
              const isOwned = isEquipmentOwned(itemName);
              const isT5 = isEquipmentT5(itemName);
              if (isT5) {
                el.style.color = COLOR_CONSTANTS.PERFECT;
                el.style.filter = 'none';
              } else if (!isOwned) {
                el.style.color = COLOR_CONSTANTS.UNOWNED;
                el.style.filter = 'grayscale(0.7)';
              } else {
                el.style.color = COLOR_CONSTANTS.TEXT;
                el.style.filter = 'none';
              }
            } else if (type === 'map') {
              // Check if map is explored using game state
              const mapIndex = items.indexOf(itemName);
              const mapId = mapIds?.[mapIndex];
              const isOwned = mapId ? globalThis.state?.player?.getSnapshot()?.context?.rooms?.[mapId] !== undefined : false;
              if (!isOwned) {
                el.style.color = COLOR_CONSTANTS.UNOWNED;
                el.style.filter = 'grayscale(0.7)';
              } else {
                el.style.color = COLOR_CONSTANTS.TEXT;
                el.style.filter = 'none';
              }
            } else if (type === 'region') {
              // Check if region has any explored maps
              const regionIndex = items.indexOf(itemName);
              const regionId = regionIds?.[regionIndex];
              let isOwned = false;
              if (regionId && globalThis.state?.utils?.REGIONS) {
                const region = globalThis.state.utils.REGIONS.find(r => r.id === regionId);
                if (region && region.rooms) {
                  isOwned = region.rooms.some(room => 
                    globalThis.state?.player?.getSnapshot()?.context?.rooms?.[room.id] !== undefined
                  );
                }
              }
              if (!isOwned) {
                el.style.color = COLOR_CONSTANTS.UNOWNED;
                el.style.filter = 'grayscale(0.7)';
              } else {
                el.style.color = COLOR_CONSTANTS.TEXT;
                el.style.filter = 'none';
              }
            } else {
              el.style.color = COLOR_CONSTANTS.TEXT;
              el.style.filter = 'none';
            }
          });
        }
        
        item.classList.add('cyclopedia-selected');
        item.style.background = 'rgba(255,255,255,0.18)';
        if (hasShinyTier) {
          item.style.color = COLOR_CONSTANTS.MAX_AWAKENED;
          item.style.filter = 'none';
        } else if (hasHundoTier) {
          item.style.color = COLOR_CONSTANTS.HUNDO;
          item.style.filter = 'none';
        } else if (hasAwakened) {
          item.style.color = COLOR_CONSTANTS.AWAKENED;
          item.style.filter = 'none';
        } else if (isPerfect) {
          item.style.color = COLOR_CONSTANTS.PERFECT;
          item.style.filter = 'none';
        } else if (isT5) {
          item.style.color = COLOR_CONSTANTS.PERFECT;
          item.style.filter = 'none';
        } else if (isOwned) {
          item.style.color = COLOR_CONSTANTS.PRIMARY;
          item.style.filter = 'none';
        } else {
          item.style.color = COLOR_CONSTANTS.HOVER;
          item.style.filter = 'grayscale(0.7)';
        }
        
          if (type === 'creature') {
            setSelectedCreature(name);
            setSelectedEquipment(null);
            setSelectedInventory(null);
            updateRightCol();
          } else if (type === 'equipment') {
            setSelectedCreature(null);
            setSelectedEquipment(name);
            setSelectedInventory(null);
            updateRightCol();
          } else if (type === 'inventory' || type === 'map' || type === 'region') {
            setSelectedCreature(null);
            setSelectedEquipment(null);
            setSelectedInventory(name);
            updateRightCol();
        }
      };
      
      const mouseEnterHandler = () => { 
        item.style.background = 'rgba(255,255,255,0.08)';
        // Maintain styling based on item status on hover
        if (hasShinyTier) {
          item.style.color = COLOR_CONSTANTS.MAX_AWAKENED;
          item.style.filter = 'none';
        } else if (hasHundoTier) {
          item.style.color = COLOR_CONSTANTS.HUNDO;
          item.style.filter = 'none';
        } else if (hasAwakened) {
          item.style.color = COLOR_CONSTANTS.AWAKENED;
          item.style.filter = 'none';
        } else if (isPerfect) {
          item.style.color = COLOR_CONSTANTS.PERFECT;
          item.style.filter = 'none';
        } else if (isT5) {
          item.style.color = COLOR_CONSTANTS.PERFECT;
          item.style.filter = 'none';
        } else if (!isOwned) {
          item.style.color = COLOR_CONSTANTS.HOVER;
          item.style.filter = 'grayscale(0.7)';
        }
      };
      const mouseLeaveHandler = () => {
        if (!item.classList.contains('cyclopedia-selected')) item.style.background = 'none';
        // Restore original styling based on item status
        if (hasShinyTier) {
          item.style.color = COLOR_CONSTANTS.MAX_AWAKENED;
          item.style.filter = 'none';
        } else if (hasHundoTier) {
          item.style.color = COLOR_CONSTANTS.HUNDO;
          item.style.filter = 'none';
        } else if (hasAwakened) {
          item.style.color = COLOR_CONSTANTS.AWAKENED;
          item.style.filter = 'none';
        } else if (isPerfect) {
          item.style.color = COLOR_CONSTANTS.PERFECT;
          item.style.filter = 'none';
        } else if (isT5) {
          item.style.color = COLOR_CONSTANTS.PERFECT;
          item.style.filter = 'none';
        } else if (!isOwned) {
          item.style.color = COLOR_CONSTANTS.UNOWNED;
          item.style.filter = 'grayscale(0.7)';
        }
      };
      const mouseDownHandler = () => { 
        item.style.background = 'rgba(255,255,255,0.18)';
        // Maintain styling based on item status on click
        if (hasShinyTier) {
          item.style.color = COLOR_CONSTANTS.MAX_AWAKENED;
          item.style.filter = 'none';
        } else if (hasHundoTier) {
          item.style.color = COLOR_CONSTANTS.HUNDO;
          item.style.filter = 'none';
        } else if (hasAwakened) {
          item.style.color = COLOR_CONSTANTS.AWAKENED;
          item.style.filter = 'none';
        } else if (isPerfect) {
          item.style.color = COLOR_CONSTANTS.PERFECT;
          item.style.filter = 'none';
        } else if (isT5) {
          item.style.color = COLOR_CONSTANTS.PERFECT;
          item.style.filter = 'none';
        } else if (!isOwned) {
          item.style.color = COLOR_CONSTANTS.HOVER;
          item.style.filter = 'grayscale(0.7)';
        }
      };
      const mouseUpHandler = () => {
        if (!item.classList.contains('cyclopedia-selected')) item.style.background = 'rgba(255,255,255,0.08)';
        // Restore original styling based on item status
        if (hasShinyTier) {
          item.style.color = COLOR_CONSTANTS.MAX_AWAKENED;
          item.style.filter = 'none';
        } else if (hasHundoTier) {
          item.style.color = COLOR_CONSTANTS.HUNDO;
          item.style.filter = 'none';
        } else if (hasAwakened) {
          item.style.color = COLOR_CONSTANTS.AWAKENED;
          item.style.filter = 'none';
        } else if (isPerfect) {
          item.style.color = COLOR_CONSTANTS.PERFECT;
          item.style.filter = 'none';
        } else if (isT5) {
          item.style.color = COLOR_CONSTANTS.PERFECT;
          item.style.filter = 'none';
        } else if (!isOwned) {
          item.style.color = COLOR_CONSTANTS.UNOWNED;
          item.style.filter = 'grayscale(0.7)';
        }
      };
      
      EventHandlerManager.addHandler(item, 'click', clickHandler);
      EventHandlerManager.addHandler(item, 'mouseenter', mouseEnterHandler);
      EventHandlerManager.addHandler(item, 'mouseleave', mouseLeaveHandler);
      EventHandlerManager.addHandler(item, 'mousedown', mouseDownHandler);
      EventHandlerManager.addHandler(item, 'mouseup', mouseUpHandler);
      
      if (type === 'equipment' && selectedEquipment && name === selectedEquipment) {
        item.classList.add('cyclopedia-selected');
        item.style.background = 'rgba(255,255,255,0.18)';
        item.style.color = COLOR_CONSTANTS.PRIMARY;
      }
      
      if ((type === 'inventory' || type === 'map' || type === 'region') && selectedInventory && name === selectedInventory) {
        item.classList.add('cyclopedia-selected');
        item.style.background = 'rgba(255,255,255,0.18)';
        item.style.color = COLOR_CONSTANTS.PRIMARY;
      }
      
      if (scrollContainer.contentContainer) {
        scrollContainer.contentContainer.appendChild(item);
      } else {
        console.error('[Cyclopedia] createBox: contentContainer not found');
      }
    });
  
  box.appendChild(scrollContainer.element);
  return box;
}

// Waits for data-scroll-locked to be 0 or empty before running callback.

function addCyclopediaHeaderButton() {
  try {
    let retryCount = 0;
    const maxRetries = 20;
    const tryInsert = () => {
      try {
        const headerUl = DOMCache.get('header ul.pixel-font-16.flex.items-center');
        if (!headerUl) {
          retryCount++;
          if (retryCount > maxRetries) return;
          const retryTimeout = setTimeout(tryInsert, 500);
          TimerManager.addTimeout(retryTimeout, 'headerButtonRetry');
          return;
        }
        if (headerUl.querySelector('.cyclopedia-header-btn')) return;
        
        const li = document.createElement('li');
        li.className = 'hover:text-whiteExp';
        const btn = document.createElement('button');
        btn.textContent = 'Cyclopedia';
        btn.className = 'cyclopedia-header-btn';
        btn.onclick = () => {
          try {
            openCyclopediaModal({ fromHeader: true });
          } catch (clickError) {
            console.error('[Cyclopedia] Error in header button click:', clickError);
          }
        };
        li.appendChild(btn);
        const settingsLi = Array.from(headerUl.children).find(
          el => el.querySelector('button.mod-settings-header-btn')
        );
        if (settingsLi && settingsLi.nextSibling) {
          headerUl.insertBefore(li, settingsLi.nextSibling);
        } else {
          // Fallback: Insert after Trophy Room (English) or Sala de Troféus (Portuguese) if Settings not found
          const trophyRoomLi = Array.from(headerUl.children).find(
            el => el.querySelector('button') && (el.textContent.includes('Trophy Room') || el.textContent.includes('Sala de Trof'))
          );
          if (trophyRoomLi && trophyRoomLi.nextSibling) {
            headerUl.insertBefore(li, trophyRoomLi.nextSibling);
          } else {
            headerUl.appendChild(li);
          }
        }
      } catch (insertError) {
        console.error('[Cyclopedia] Error inserting header button:', insertError);
      }
    };
    tryInsert();
  } catch (error) {
    console.error('[Cyclopedia] Error adding header button:', error);
  }
}

function findOpenBetterBestiaryModal() {
  return document.querySelector('[role="dialog"][data-state="open"][data-better-bestiary-enhanced]');
}

function injectCyclopediaButton(menuElem) {
  const body = document.body;
  const scrollLocked = body.getAttribute('data-scroll-locked');
  if (scrollLocked >= '2') {
    const creatureMenu = getItemNameFromMenu(menuElem)?.type === 'monster';
    if (!(findOpenBetterBestiaryModal() && creatureMenu)) {
      return false;
    }
  }
  
        const existingButtons = Array.from(menuElem.querySelectorAll('.cyclopedia-menu-item'));
  existingButtons.forEach(btn => {
    try {
      if (btn.parentNode) btn.parentNode.removeChild(btn);
    } catch (error) {
    console.warn('[Cyclopedia] Error in monster location cache:', error);
  }
  });
  
  if (existingButtons.length > 0) {
    
    return false;
  }
  
  // Check if this menu contains creature or equipment items
  const itemInfo = getItemNameFromMenu(menuElem);
  const monsterName = itemInfo?.type === 'monster' ? itemInfo.name : null;
  const equipmentName = itemInfo?.type === 'equipment' ? itemInfo.name : null;
  
  
  
  // Additional check: ensure we're not in "My Account" or "Game Mode" menus
  const menuText = menuElem.textContent?.toLowerCase() || '';
  const isAccountMenu = menuText.includes('my account') || menuText.includes('logout') || menuText.includes('profile');
  const isGameModeMenu = menuText.includes('game mode') || menuText.includes('cyclopedia') || menuText.includes('manual') || menuText.includes('autoplay') || menuText.includes('sandbox');
  
  // Only inject Cyclopedia button if we found a valid creature or equipment AND we're not in account/game mode menus
  if ((!monsterName && !equipmentName) || isAccountMenu || isGameModeMenu) {
    
    return false; // Don't add Cyclopedia button to menus that don't contain creatures or equipment, or are account/game mode menus
  }
  
  const allEquipment = GAME_DATA.ALL_EQUIPMENT;
  let matchedEquipment = null;
  let normalizedEquipmentName = null;
  if (equipmentName) {
    normalizedEquipmentName = equipmentName.replace(/\s*\(Tier: \d+\)/i, '').trim();
    matchedEquipment = allEquipment.find(e => e.toLowerCase() === normalizedEquipmentName.toLowerCase());
  }
  const cyclopediaItem = document.createElement('div');
  cyclopediaItem.className = 'dropdown-menu-item relative flex cursor-default select-none items-center gap-2 outline-none text-whiteHighlight';
  cyclopediaItem.setAttribute('role', 'menuitem');
  cyclopediaItem.setAttribute('tabindex', '-1');
  cyclopediaItem.setAttribute('data-orientation', 'vertical');
  cyclopediaItem.setAttribute('data-radix-collection-item', '');
  
  // Add styling to match in-game appearance
  cyclopediaItem.style.color = 'white';
  cyclopediaItem.style.background = 'transparent';
  cyclopediaItem.style.padding = '4px 8px';
  cyclopediaItem.style.borderRadius = '0';
  cyclopediaItem.style.margin = '0';
  cyclopediaItem.style.border = 'none';
  cyclopediaItem.style.fontFamily = 'inherit';
  cyclopediaItem.style.fontSize = '16px';
  cyclopediaItem.style.fontWeight = '400';
  cyclopediaItem.style.lineHeight = '1';
  
  // Force visibility through multiple methods
  cyclopediaItem.style.setProperty('display', 'flex', 'important');
  cyclopediaItem.style.setProperty('visibility', 'visible', 'important');
  cyclopediaItem.style.setProperty('opacity', '1', 'important');
  

  cyclopediaItem.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open"><path d="M2 19V6a2 2 0 0 1 2-2h7"></path><path d="M22 19V6a2 2 0 0 0-2-2h-7"></path><path d="M2 19a2 2 0 0 0 2 2h7"></path><path d="M22 19a2 2 0 0 1-2 2h-7"></path></svg>Cyclopedia`;
  cyclopediaItem.addEventListener('click', (e) => {
    e.stopPropagation();

    const openCyclopedia = () => {
      const equipmentToOpen = matchedEquipment;
      const creatureToOpen = monsterName;
      if (equipmentToOpen) {
        openCyclopediaModal({ equipment: equipmentToOpen });
      } else if (creatureToOpen && typeof creatureToOpen === 'string') {
        openCyclopediaModal({ creature: creatureToOpen });
      } else {
        openCyclopediaModal({});
      }
    };

    const escTimeout = setTimeout(() => {
      dispatchEscapePress();
      const openTimeout = setTimeout(openCyclopedia, 10);
      TimerManager.addTimeout(openTimeout, 'cyclopediaOpen');
    }, 10);
    TimerManager.addTimeout(escTimeout, 'cyclopediaEsc');
  });
  const separator = menuElem.querySelector('.separator');
  if (separator) {
    separator.parentNode.insertBefore(cyclopediaItem, separator);
    
  } else {
    menuElem.appendChild(cyclopediaItem);
    
  }
  
  // Verify the button is actually in the DOM
  const buttonInDOM = menuElem.querySelector('[data-radix-collection-item]');
  
  
  
  
  return true; // Return true to indicate successful injection
}

function addCyclopediaPressedStateListeners(btn) {
  btn.addEventListener('mousedown', () => btn.classList.add('pressed'));
  btn.addEventListener('mouseup', () => btn.classList.remove('pressed'));
  btn.addEventListener('mouseleave', () => btn.classList.remove('pressed'));
  btn.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') btn.classList.add('pressed');
  });
  btn.addEventListener('keyup', e => {
    if (e.key === ' ' || e.key === 'Enter') btn.classList.remove('pressed');
  });
}

// =======================
// 9. Data/Model Functions
// =======================
function startContextMenuObserver() {
  if (cyclopediaState.observer && window.cyclopediaGlobalObserver) {
    return;
  }
  
  if (window.cyclopediaGlobalObserver) {
    try {
      window.cyclopediaGlobalObserver.disconnect();
    } catch (error) {
    console.warn('[Cyclopedia] Error in monster location cache:', error);
  }
    window.cyclopediaGlobalObserver = null;
  }
  
  if (cyclopediaState.observer) {
    try {
      cyclopediaState.observer.disconnect();
    } catch (error) {
    console.warn('[Cyclopedia] Error in monster location cache:', error);
  }
    cyclopediaState.observer = null;
  }
  
  cyclopediaState.observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          if (node.matches && node.matches('div[data-radix-popper-content-wrapper]')) {
            const menu = node.querySelector('[role="menu"]');
            if (menu) {
              
              const injectionTimeout = setTimeout(() => {
                if (!injectCyclopediaButton(menu)) {
                  
                  const retryTimeout = setTimeout(() => {
                    const retryResult = injectCyclopediaButton(menu);
                    
                  }, 75);
                  TimerManager.addTimeout(retryTimeout, 'contextMenuRetry');
                }
              }, 10);
              TimerManager.addTimeout(injectionTimeout, 'contextMenuInjection');
            }
          } else if (node.querySelector) {
            const wrapper = node.querySelector('div[data-radix-popper-content-wrapper]');
            if (wrapper) {
              const menu = wrapper.querySelector('[role="menu"]');
              if (menu) {
                
                const nestedTimeout = setTimeout(() => {
                  if (!injectCyclopediaButton(menu)) {
                    
                    const nestedRetryTimeout = setTimeout(() => {
                      const retryResult = injectCyclopediaButton(menu);
                      
                    }, 75);
                    TimerManager.addTimeout(nestedRetryTimeout, 'contextMenuNestedRetry');
                  }
                }, 25);
                TimerManager.addTimeout(nestedTimeout, 'contextMenuNested');
              }
            }
          }
        }
      }
    }
  });
  
  cyclopediaState.observer.observe(document.body, { childList: true, subtree: true });
  ObserverManager.add(cyclopediaState.observer, 'contextMenuObserver');
  window.cyclopediaGlobalObserver = cyclopediaState.observer;
}

function stopContextMenuObserver() {
  if (cyclopediaState.observer) {
    try {
    cyclopediaState.observer.disconnect();
    } catch (error) {
    console.warn('[Cyclopedia] Error in monster location cache:', error);
  }
    cyclopediaState.observer = null;
  }
  
  if (window.cyclopediaGlobalObserver) {
    try {
      window.cyclopediaGlobalObserver.disconnect();
    } catch (error) {
    console.warn('[Cyclopedia] Error in monster location cache:', error);
  }
    window.cyclopediaGlobalObserver = null;
  }
}

// =======================
// 10. Modal & Template Rendering
// =======================

let activeCyclopediaModal = null;
let cyclopediaModalInProgress = false;
let lastModalCall = 0;
/** Set when opening on Home tab; cleared after start-page search input is focused or modal closes. */
let cyclopediaPendingHomeSearchFocus = false;

function createStartPageManager() {
  const HTML_TEMPLATES = {
    loading: () => renderCyclopediaProfileLoadingHtml(),
    error: (message) => renderCyclopediaProfileErrorHtml(message, { showRetry: true })
  };

  const ERROR_MESSAGES = {
    'AbortError': CYCLOPEDIA_UI.errorAbort,
    'Player name not available': CYCLOPEDIA_UI.errorPlayerName,
    'HTTP': CYCLOPEDIA_UI.errorHttp
  };

  class StartPageManager {
    constructor() {
      this.container = this.createContainer();
      this.timerElements = {};
      this.isInitialized = false;
      this.lastPlayerName = null;
      this.lastProfileData = null;
    }

    refreshLayout() {
      if (this.lastPlayerName && this.lastProfileData) {
        this.renderLayout(this.lastPlayerName, this.lastProfileData);
        this.setupTimers();
      }
    }

    createContainer() {
      const container = document.createElement('div');
      Object.assign(container.style, {
        display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
        padding: '10px', boxSizing: 'border-box', overflowX: 'hidden', overflowY: 'auto', minWidth: '0'
      });
      return container;
    }

    showLoading() {
      this.container.innerHTML = HTML_TEMPLATES.loading();
    }

    async fetchProfileData(playerName) {
        if (!playerName || typeof playerName !== 'string') throw new Error('Invalid player name provided');

        const cachedData = cyclopediaState.getProfileData(playerName);
        if (cachedData) return cachedData;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), START_PAGE_CONFIG.API_TIMEOUT);
        TimerManager.addTimeout(timeoutId, 'apiTimeout');

        try {
          const apiUrl = `${START_PAGE_CONFIG.API_BASE_URL}?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(playerName)}%22%7D%7D`;
          const response = await fetch(apiUrl, { 
            signal: controller.signal, headers: { 'Accept': 'application/json' }
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) throw new Error(`Failed to fetch profile data (HTTP ${response.status})`);
          
          const data = await response.json();
          if (!data || typeof data !== 'object') throw new Error('Invalid response format from API');
          
          cyclopediaState.setProfileData(playerName, data);
          return data;
          
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error('Request timed out. Please check your internet connection and try again.');
          }
          throw fetchError;
        }
    }

    getErrorMessage(error) {
      for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
        if (error.name === key || error.message.includes(key)) return message;
      }
      return CYCLOPEDIA_UI.errorUnexpected;
    }

    showError(message, retryFunction) {
      cyclopediaPendingHomeSearchFocus = false;
      this.container.innerHTML = HTML_TEMPLATES.error(message);
      const retryButton = this.container.querySelector('#retry-profile-load');
      if (retryButton && retryFunction) retryButton.addEventListener('click', retryFunction);
    }

    async initialize() {
      try {
        this.showLoading();
        
        const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
        if (!playerState?.name) throw new Error('Player name not available. Please ensure you are logged into the game.');
        
        const data = await this.fetchProfileData(playerState.name);
        const profileData = Array.isArray(data) && data[0]?.result?.data?.json 
          ? data[0].result.data.json : data;
        cyclopediaState.profileSeason = getLatestProfileSeason(profileData, 2);
        
        this.renderLayout(playerState.name, profileData);
        this.setupTimers();
        this.isInitialized = true;
      } catch (error) {
        this.showError(this.getErrorMessage(error), () => this.initialize());
      }
    }

    renderLayout(playerName, profileData) {
        this.lastPlayerName = playerName;
        this.lastProfileData = profileData;
        cyclopediaState.lastStartupProfileData = unwrapProfilePageJson(profileData);
        refreshLeaderboardCacheYourRoomsForSeason();

        this.container.innerHTML = '';
        
        const { PROFILE, SEARCH } = START_PAGE_CONFIG.COLUMN_WIDTHS;
        const columnGap = START_PAGE_CONFIG.COLUMN_GAP ?? 10;
        const profileFr = parseFloat(PROFILE) || 35;
        const searchFr = parseFloat(SEARCH) || 65;
        const mainFlexRow = document.createElement('div');
        Object.assign(mainFlexRow.style, {
          display: 'grid',
          gridTemplateColumns: `${profileFr}fr ${searchFr}fr`,
          width: '100%',
          height: '100%',
          margin: '0',
          columnGap: `${columnGap}px`,
          minWidth: '0',
          boxSizing: 'border-box'
        });

      const startPageColStyles = { flex: 'none', width: '100%', minWidth: '0', overflow: 'hidden' };

      const leftCol = DOMUtils.createColumn(
        '100%',
        renderCyclopediaProfileColumn(profileData),
        { ...startPageColStyles, justifyContent: 'flex-start', alignItems: 'stretch', minHeight: '0', padding: '0', margin: '0' }
      );
        mainFlexRow.appendChild(leftCol);

      const searchCol = DOMUtils.createColumn(
        '100%',
        renderCyclopediaSearchColumn(),
        { ...startPageColStyles, justifyContent: 'stretch', alignItems: 'stretch', minHeight: '0', padding: '0', margin: '0' }
      );
      mainFlexRow.appendChild(searchCol);
        
        this.container.appendChild(mainFlexRow);

        if (cyclopediaPendingHomeSearchFocus) {
          cyclopediaPendingHomeSearchFocus = false;
          focusCyclopediaHomeSearchInput();
        }
    }

    setupTimers() {
        this.timerElements.yasir = this.container.querySelector('.yasir-timer');
        this.timerElements.boosted = this.container.querySelector('.boosted-timer');
        
        if (this.timerElements.yasir || this.timerElements.boosted) this.startTimer();
    }

    startTimer() {
        if (cyclopediaState.timers.has(this.container)) {
          clearInterval(cyclopediaState.timers.get(this.container));
        }
        
        const dailyContext = globalThis.state?.daily?.getSnapshot?.()?.context || {};
        let ms = dailyContext.msUntilNextEpochDay || 0;
        let lastUpdate = Date.now();
        let errorCount = 0;
        const MAX_ERRORS = 3;
        
        const updateTimers = () => {
          try {
            const now = Date.now();
            ms -= (now - lastUpdate);
            lastUpdate = now;
            errorCount = 0;
            
            const timeString = FormatUtils.time(ms) + 'h';
            if (this.timerElements.yasir) this.timerElements.yasir.textContent = timeString;
            if (this.timerElements.boosted) this.timerElements.boosted.textContent = timeString;
            
          } catch (error) {
            errorCount++;
            if (errorCount >= MAX_ERRORS) this.stopTimer();
          }
        };
        
        const timerId = setInterval(updateTimers, 1000);
        cyclopediaState.timers.set(this.container, timerId);
    }

    stopTimer() {
        if (cyclopediaState.timers.has(this.container)) {
          clearInterval(cyclopediaState.timers.get(this.container));
          cyclopediaState.timers.delete(this.container);
      }
    }

    cleanup() {
        this.stopTimer();
        this.timerElements = {};
        this.isInitialized = false;
    }
  }

  return StartPageManager;
}

function createStartPage() {
  const StartPageManager = createStartPageManager();
  const startPage = new StartPageManager();
  startPage.initialize();
  return startPage.container;
}

function isBodyScrollLocked() {
  const raw = document.body.getAttribute('data-scroll-locked');
  return raw != null && raw !== '' && raw >= '2';
}

function dispatchEscapePress() {
  const init = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
  document.dispatchEvent(new KeyboardEvent('keydown', init));
  document.dispatchEvent(new KeyboardEvent('keyup', init));
}

function waitForDialogsCleared(maxMs = 2500) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const bestiaryGone = !document.querySelector('[role="dialog"][data-state="open"][data-better-bestiary-enhanced]')
        && !(typeof window.__betterBestiaryIsOpen === 'function' && window.__betterBestiaryIsOpen());
      if ((bestiaryGone && !isBodyScrollLocked()) || Date.now() - start > maxMs) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

function simulateEscapePresses(count = 3, intervalMs = 100) {
  return new Promise((resolve) => {
    let presses = 0;
    const press = () => {
      dispatchEscapePress();
      presses += 1;
      if (presses >= count) {
        waitForDialogsCleared().then(resolve);
        return;
      }
      setTimeout(press, intervalMs);
    };
    press();
  });
}

function closeDialogsForCyclopedia() {
  window.__betterBestiaryPrepareClose?.();
  return simulateEscapePresses(3, 100);
}

function openCyclopediaModal(options) {
  try {
    const now = Date.now();
    options = options || {};
    const betterBestiaryOpen = typeof window.__betterBestiaryIsOpen === 'function'
      ? window.__betterBestiaryIsOpen()
      : Boolean(document.querySelector('[role="dialog"][data-state="open"][data-better-bestiary-enhanced]'));
    const scrollLocked = isBodyScrollLocked();
    if ((betterBestiaryOpen || scrollLocked) && !options._closedDialogs) {
      closeDialogsForCyclopedia().then(() => {
        openCyclopediaModal({ ...options, _closedDialogs: true });
      });
      return;
    }
    const forceOpen = options.force === true || options.priority === true || options.fromHomeSearch === true;
    if (cyclopediaModalInProgress) return;
    if (!forceOpen && now - lastModalCall < 1000) return;
    refreshCyclopediaRecordsOnOpen();
    
    lastModalCall = now;
    cyclopediaModalInProgress = true;
    const creatureToSelect = options.creature;
    const equipmentToSelect = options.equipment;
    const isFromHeader = options.fromHeader === true;
  
  (() => {
    try {
      if (!cyclopediaModalInProgress) return;
      
      if (!document.querySelector('.cyclopedia-styles-injected')) {
        injectCyclopediaButtonStyles();
        injectCyclopediaBoxStyles();
        injectCyclopediaSelectedCss();
        document.body.classList.add('cyclopedia-styles-injected');
      }
      
      if (!document.querySelector('.cyclopedia-header-btn')) addCyclopediaHeaderButton();
      
          if (!cyclopediaState.observer || !window.cyclopediaGlobalObserver) {
      startContextMenuObserver();
    }
    
    buildCyclopediaMonsterNameMap();

    const content = document.createElement('div');
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.height = '100%';
    content.style.width = '100%';

    let activeTab = 0;
    let selectedCreature = null;
    let selectedEquipment = null;
    let selectedInventory = null;

    const allCreatures = getCyclopediaAllCreatures();
    let pendingGazerSelection = null;

    let normalizedCreature = creatureToSelect && typeof creatureToSelect === 'string' ? creatureToSelect.trim().toLowerCase() : null;
    let foundCreature = null;
    if (normalizedCreature) {
      foundCreature = allCreatures.find(c => c.toLowerCase() === normalizedCreature) ||
                     GAME_DATA.UNOBTAINABLE_CREATURES.find(c => c.toLowerCase() === normalizedCreature);
    }
    if (foundCreature) {
      if (isCyclopediaGazerCreatureName(foundCreature)) {
        pendingGazerSelection = foundCreature;
        activeTab = 3;
      } else {
        selectedCreature = foundCreature;
        activeTab = 1;
      }
    }

    let normalizedEquipment = equipmentToSelect && typeof equipmentToSelect === 'string' ? equipmentToSelect.trim().toLowerCase() : null;
    const allEquipment = GAME_DATA.ALL_EQUIPMENT;
    let foundEquipment = null;
    if (normalizedEquipment) {
      foundEquipment = allEquipment.find(e => e.toLowerCase() === normalizedEquipment);
    }
    if (foundEquipment) {
      selectedEquipment = foundEquipment;
      if (typeof window !== 'undefined') {
        window.cyclopediaSelectedEquipment = foundEquipment;
      }
      activeTab = 2;
    }

    let setActiveTab;
    function defineSetActiveTab(tabButtons, mainContent, tabPages) {
      tabPages.forEach((page, i) => {
        if (page) {
          page.style.display = i === 0 ? 'flex' : 'none';
          page.style.width = '100%';
          page.style.height = '100%';
          page.style.minWidth = '0';
          page.style.boxSizing = 'border-box';
          try {
            mainContent.appendChild(page);
          } catch (error) {
    console.warn('[Cyclopedia] Error in monster location cache:', error);
  }
        }
      });
      
      setActiveTab = function(idx) {
        activeTab = idx;
        tabButtons.forEach((btn, i) => {
          btn.classList.toggle('active', i === idx);
        });
        
        tabPages.forEach((page, i) => {
          if (page) {
            try {
              page.style.display = i === idx ? 'flex' : 'none';
              
              // If this is the equipment tab (index 2) and it's becoming active, update the display
              if (i === 2 && i === idx && page.updateRightCol) {
                // Update the global variable to ensure the updateRightCol function sees the current value
                if (typeof window !== 'undefined' && window.cyclopediaSelectedEquipment) {
                  // Force a small delay to ensure the tab is fully visible
                  const updateTimeout = setTimeout(() => {
                    page.updateRightCol();
                  }, 10);
                  TimerManager.addTimeout(updateTimeout, 'tabUpdate');
                }
              }
            } catch (error) {
    console.warn('[Cyclopedia] Error in monster location cache:', error);
  }
          }
        });
      };
    }

    function createBestiaryTabPage(selectedCreature, selectedEquipment, selectedInventory, setSelectedCreature, setSelectedEquipment, setSelectedInventory, updateRightCol) {
      // Shiny portrait toggle state
      let showShinyPortraits = false;
      
      // Common layout styles
      const LAYOUT_STYLES = {
        container: {
        display: 'flex', flexDirection: 'row', width: '100%', height: '100%', minWidth: '0',
        alignItems: 'stretch', justifyContent: 'flex-start', gap: '0', overflow: 'hidden'
        },
        rightCol: {
          flex: '1 1 0', minWidth: '0', padding: '0', margin: '0', height: '100%',
          borderImage: 'none', overflow: 'hidden'
        },
        leftCol: {
          width: LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH, minWidth: LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH,
          maxWidth: LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH, flex: '0 0 auto', padding: '0', margin: '0', height: '100%',
          display: 'flex', flexDirection: 'column', borderRight: '6px solid transparent',
          borderImage: `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`,
          boxSizing: 'border-box', overflowX: 'hidden', overflowY: 'hidden', minHeight: '0'
        },
        box: {
          flex: '1 1 0', minHeight: '0'
        }
      };

      const d = DOMUtils.createElement('div');
      Object.assign(d.style, LAYOUT_STYLES.container);
      
      const rightCol = DOMUtils.createElement('div');
      Object.assign(rightCol.style, LAYOUT_STYLES.rightCol);
      
      function updateRightColInternal() {
        rightCol.innerHTML = '';
        if (selectedCreature) {
          rightCol.appendChild(renderCreatureTemplate(selectedCreature, showShinyPortraits));
        } else {
          const msg = DOMUtils.createElement('div', FONT_CONSTANTS.SIZES.BODY, 'Select a creature from the left column to view.');
          Object.assign(msg.style, {
            display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%',
            color: COLOR_CONSTANTS.TEXT, fontWeight: 'bold', textAlign: 'center'
          });
          rightCol.appendChild(msg);
        }
      }
      
      const leftCol = DOMUtils.createElement('div');
      Object.assign(leftCol.style, LAYOUT_STYLES.leftCol);

      // Create boxes with common configuration
      const createCreatureBox = (title, items) => {
        const box = createBox({
          title, items, type: 'creature',
          selectedCreature, selectedEquipment, selectedInventory,
        setSelectedCreature: v => { selectedCreature = v; updateRightColInternal(); },
          setSelectedEquipment, setSelectedInventory,
        updateRightCol: updateRightColInternal
      });
        Object.assign(box.style, LAYOUT_STYLES.box);
        
        // Add shiny toggle button to the "Creatures" box title
        if (title === 'Creatures') {
          const titleEl = box.querySelector('h2.widget-top');
          if (titleEl) {
            // Create a flex container for title and button
            const titleContainer = document.createElement('div');
            titleContainer.style.cssText = `
              display: flex;
              align-items: center;
              justify-content: space-between;
              width: 100%;
              padding: 0;
              gap: 1px;
            `;
            
            const creaturesTitle = createCyclopediaWidgetTitle('Creatures', CYCLOPEDIA_WIDGET_TITLE_SPLIT_STYLE);
            titleContainer.appendChild(creaturesTitle);

            const toggleButton = document.createElement('button');
            applyCyclopediaWidgetTitleChrome(toggleButton, CYCLOPEDIA_WIDGET_TITLE_TOGGLE_STYLE);
            toggleButton.title = showShinyPortraits ? 'Shiny Mode' : 'Normal Mode';
            
            const buttonImg = document.createElement('img');
            buttonImg.src = 'https://bestiaryarena.com/assets/icons/shiny-star.png';
            buttonImg.alt = 'shiny';
            buttonImg.style.cssText = 'width: 10px; height: 10px;';
            toggleButton.appendChild(buttonImg);
            
            toggleButton.addEventListener('click', (e) => {
              e.stopPropagation(); // Prevent title click event
              showShinyPortraits = !showShinyPortraits;
              toggleButton.title = showShinyPortraits ? 'Shiny Mode' : 'Normal Mode';
              
              // Update background and border color to show toggle state
              if (showShinyPortraits) {
                toggleButton.style.background = 'url("https://bestiaryarena.com/_next/static/media/background-green.be515334.png") repeat';
                toggleButton.style.border = '1px solid #4CAF50';
              } else {
                // Reset to default widget-top styling (remove custom background/border to let CSS take over)
                toggleButton.style.background = '';
                toggleButton.style.border = '';
              }
              
              
              
              // Update the right column to reflect the new mode
              updateRightColInternal();
            });
            
            titleContainer.appendChild(toggleButton);
            
            // Replace the original title with our new structure
            titleEl.parentNode.replaceChild(titleContainer, titleEl);
          }
        }
        
        return box;
      };

      const { searchContainer: bestiarySearchContainer, searchInput: bestiarySearchInput, filterBtn: bestiaryFilterBtn } = createCyclopediaSearchBar('Search creatures');
      let bestiaryFilterMode = 'name';
      const creaturesBox = createCreatureBox('Creatures', getCyclopediaBestiaryCreatures());
      const unobtainableBox = createCreatureBox('Unobtainable', GAME_DATA.UNOBTAINABLE_CREATURES);

      const creatureUsageByMapStats = (() => {
        const usageMap = new Map();
        let totalMaps = 0;
        try {
          const playerContext = globalThis.state?.player?.getSnapshot?.().context;
          const monsters = Array.isArray(playerContext?.monsters) ? playerContext.monsters : [];
          const boardConfigs = playerContext?.boardConfigs && typeof playerContext.boardConfigs === 'object'
            ? playerContext.boardConfigs
            : {};
          const monsterLookup = new Map(monsters.map((m) => [m.id, m.gameId]));

          Object.values(boardConfigs).forEach((cfgs) => {
            if (!Array.isArray(cfgs)) return;
            totalMaps++;
            const seenOnMap = new Set();
            cfgs.forEach((cfg) => {
              const monsterId = cfg?.monsterId;
              if (monsterId == null) return;
              const gid = monsterLookup.get(monsterId);
              if (gid == null) return;
              seenOnMap.add(gid);
            });
            seenOnMap.forEach((gid) => {
              usageMap.set(gid, (usageMap.get(gid) || 0) + 1);
            });
          });
        } catch (e) {
          console.warn('[Cyclopedia] Failed building creature usage map:', e);
        }
        return { usageMap, totalMaps };
      })();

      const getCreatureUsageCountByName = (creatureName) => {
        const normalized = String(creatureName || '').trim().toLowerCase();
        if (!normalized) return 0;
        const maps = window.BestiaryModAPI?.utility?.maps;
        let gameId = maps?.monsterNamesToGameIds?.get(normalized);
        if (gameId == null) {
          const entry = cyclopediaState.monsterNameMap?.get?.(normalized);
          gameId = entry?.monster?.gameId ?? entry?.index;
        }
        if (gameId == null) return 0;
        return creatureUsageByMapStats.usageMap.get(gameId) || 0;
      };

      // Set custom flex values for height proportions: Creatures 60%, Unobtainable 40%
      creaturesBox.style.flex = '3 1 0';      // 3/5 = 60%
      unobtainableBox.style.flex = '2 1 0';   // 2/5 = 40%

      // Shared selection clearing
      const getBestiaryListItemBaseName = getCyclopediaListItemBaseName;

      const clearAllBestiarySelections = () => {
        [creaturesBox, unobtainableBox].forEach(box => {
          box.querySelectorAll('.cyclopedia-selected').forEach(el => {
            el.classList.remove('cyclopedia-selected');
            el.style.background = 'none';
            const creatureName = getBestiaryListItemBaseName(el);
            if (box === creaturesBox) {
              const isUnobtainable = UNOBTAINABLE_CREATURES.some(c => c.toLowerCase() === creatureName.toLowerCase());
              if (!isUnobtainable) {
                applyCreatureListItemStyle(el, getCreatureDisplayStatus(creatureName));
              } else {
                el.style.color = COLOR_CONSTANTS.TEXT;
                el.style.filter = 'none';
              }
            } else {
              el.style.color = COLOR_CONSTANTS.TEXT;
              el.style.filter = 'none';
            }
          });
        });
      };

      creaturesBox.clearAllSelections = clearAllBestiarySelections;
      unobtainableBox.clearAllSelections = clearAllBestiarySelections;

      function buildBestiaryRowMeta(box) {
        const rows = Array.from(box.querySelectorAll('div.pixel-font-16'))
          .filter((el) => !!el.querySelector('span'));
        return rows.map((row, idx) => {
          if (!row.dataset.originalOrder) {
            row.dataset.originalOrder = String(idx);
          }
          const span = row.querySelector('span');
          if (span && !span.dataset.baseLabel) {
            const raw = (span.textContent || '').trim();
            span.dataset.baseLabel = raw.replace(/^\d+%\s+/, '');
          }
          const label = (span?.dataset.baseLabel || span?.textContent || row.textContent || '').trim();
          const labelClean = label.replace(/^\d+%\s+/, '');
          const awakenKey = getAwakenTrackerBestiarySortKey(labelClean);
          return {
            row,
            idx,
            span,
            label: labelClean,
            labelNorm: labelClean.toLowerCase(),
            usageCount: getCreatureUsageCountByName(labelClean),
            genePct: awakenKey.topTierGenePct,
            awakenKey
          };
        });
      }

      let creaturesRowMetaCache = null;
      let unobtainableRowMetaCache = null;

      function filterBoxItems(box, searchTerm, mode = 'name', cachedRowMeta = null) {
        const q = (searchTerm || '').toLowerCase();
        const rowMeta = cachedRowMeta || buildBestiaryRowMeta(box);

        const listGrid = box.querySelector('div[data-nopadding="true"]');
        if (mode === 'usage' && listGrid) {
          rowMeta
            .slice()
            .sort((a, b) => {
              if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
              const ka = a.awakenKey;
              const kb = b.awakenKey;
              if (ka.categoryRank !== kb.categoryRank) return ka.categoryRank - kb.categoryRank;
              if (ka.anyAwakened && kb.anyAwakened) {
                const pa = ka.anyAwakenedShiny ? 0 : 1;
                const pb = kb.anyAwakenedShiny ? 0 : 1;
                if (pa !== pb) return pa - pb;
              }
              if (kb.bestSum !== ka.bestSum) return kb.bestSum - ka.bestSum;
              if (kb.bestRank !== ka.bestRank) return kb.bestRank - ka.bestRank;
              return a.labelNorm.localeCompare(b.labelNorm);
            })
            .forEach((m) => listGrid.appendChild(m.row));
        } else if (mode === 'tier' && listGrid) {
          rowMeta
            .slice()
            .sort((a, b) => {
              const ka = a.awakenKey;
              const kb = b.awakenKey;
              if (ka.categoryRank !== kb.categoryRank) return ka.categoryRank - kb.categoryRank;
              if (ka.anyAwakened && kb.anyAwakened) {
                const pa = ka.anyAwakenedShiny ? 0 : 1;
                const pb = kb.anyAwakenedShiny ? 0 : 1;
                if (pa !== pb) return pa - pb;
              }
              if (b.genePct !== a.genePct) return b.genePct - a.genePct;
              if (a.genePct === 100) {
                if (kb.bestRank !== ka.bestRank) return kb.bestRank - ka.bestRank;
                if (kb.topTierLevel !== ka.topTierLevel) return kb.topTierLevel - ka.topTierLevel;
              } else if (kb.bestRank !== ka.bestRank) {
                return kb.bestRank - ka.bestRank;
              }
              return a.labelNorm.localeCompare(b.labelNorm);
            })
            .forEach((m) => listGrid.appendChild(m.row));
        } else if (mode === 'name' && listGrid) {
          rowMeta
            .slice()
            .sort((a, b) => Number(a.row.dataset.originalOrder) - Number(b.row.dataset.originalOrder))
            .forEach((m) => listGrid.appendChild(m.row));
        }

        let visibleCount = 0;
        rowMeta.forEach((meta) => {
          if (meta.span) {
            const pct = creatureUsageByMapStats.totalMaps > 0 ? Math.floor((meta.usageCount / creatureUsageByMapStats.totalMaps) * 100) : 0;
            if (mode === 'usage') {
              meta.span.textContent = `${pct}% ${meta.label}`;
            } else if (mode === 'tier') {
              meta.span.textContent = `${meta.genePct}% ${meta.label}`;
            } else {
              meta.span.textContent = meta.label;
            }
          }
          const nameMatch = !q || meta.labelNorm.includes(q);
          const usageMatch = true;
          const isVisible = nameMatch && usageMatch;
          meta.row.style.display = isVisible ? '' : 'none';
          if (isVisible) visibleCount++;
        });
        return visibleCount;
      }

      const noResultsCreatures = createNoResultsMessage('No results in Creatures');
      const noResultsUnobtainable = createNoResultsMessage('No results in Unobtainable');
      mountNoResultsInsideList(creaturesBox, noResultsCreatures);
      mountNoResultsInsideList(unobtainableBox, noResultsUnobtainable);

      const applyBestiarySearch = debounce(() => {
        const searchTerm = (bestiarySearchInput.value || '').trim();
        if (!creaturesRowMetaCache) creaturesRowMetaCache = buildBestiaryRowMeta(creaturesBox);
        if (!unobtainableRowMetaCache) unobtainableRowMetaCache = buildBestiaryRowMeta(unobtainableBox);
        const creaturesVisible = filterBoxItems(creaturesBox, searchTerm, bestiaryFilterMode, creaturesRowMetaCache);
        const unobtainableVisible = filterBoxItems(unobtainableBox, searchTerm, 'name', unobtainableRowMetaCache);
        const showNoResults = !!searchTerm;
        noResultsCreatures.style.display = showNoResults && creaturesVisible === 0 ? 'block' : 'none';
        noResultsUnobtainable.style.display = showNoResults && unobtainableVisible === 0 ? 'block' : 'none';
      }, 150);
      bestiarySearchInput.addEventListener('input', applyBestiarySearch);
      bestiaryFilterBtn.addEventListener('click', () => {
        bestiaryFilterMode = bestiaryFilterMode === 'name' ? 'tier' : bestiaryFilterMode === 'tier' ? 'usage' : 'name';
        bestiaryFilterBtn.textContent = bestiaryFilterMode === 'name' ? 'Name' : bestiaryFilterMode === 'tier' ? 'Tier' : 'Usage';
        applyBestiarySearch();
      });

      const creaturesTitle = creaturesBox.querySelector('h2.widget-top');
      if (creaturesTitle && creaturesTitle.parentNode) {
        const titleHost = creaturesTitle.parentElement;
        if (titleHost && titleHost !== creaturesBox) {
          titleHost.insertAdjacentElement('afterend', bestiarySearchContainer);
        } else {
          creaturesTitle.insertAdjacentElement('afterend', bestiarySearchContainer);
        }
      } else {
        creaturesBox.prepend(bestiarySearchContainer);
      }

      leftCol.appendChild(creaturesBox);
      leftCol.appendChild(unobtainableBox);
      d.appendChild(leftCol);
      d.appendChild(rightCol);
      updateRightColInternal();
      return d;
    }

    function createEquipmentTabPage(selectedCreature, selectedEquipment, selectedInventory, setSelectedCreature, setSelectedEquipment, setSelectedInventory, updateRightCol) {
      let equipmentPreviewTier = window.equipmentDatabase?.DEFAULT_EQUIPMENT_EFFECT_TIER ?? 5;
      const EQUIPMENT_PREVIEW_TIER_COLORS = ['#9e9e9e', '#4caf50', '#42a5f5', '#ab47bc', '#ffc107', '#ff5722'];
      const EQUIPMENT_PREVIEW_TIER_MAX = 6;
      const EQUIPMENT_PREVIEW_CYCLOPS_RARITY = 'AWAKEN-CYCLOPS-TIER';

      const clampEquipmentPreviewTier = (value) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) return 5;
        return Math.min(EQUIPMENT_PREVIEW_TIER_MAX, Math.max(1, parsed));
      };

      const applyEquipmentPreviewPortraitTier = (portraitRoot, tier) => {
        if (!portraitRoot) return;
        const portrait = portraitRoot.classList?.contains('equipment-portrait')
          ? portraitRoot
          : portraitRoot.querySelector?.('.equipment-portrait');
        if (!portrait) return;
        const rarityEl = portrait.querySelector('.has-rarity, [data-rarity]');
        if (!rarityEl) return;
        if (tier >= EQUIPMENT_PREVIEW_TIER_MAX) {
          rarityEl.setAttribute('data-rarity', EQUIPMENT_PREVIEW_CYCLOPS_RARITY);
        } else {
          rarityEl.setAttribute('data-rarity', String(tier));
        }
      };

      const getEquipmentPreviewEffectProps = (previewTier) => {
        if (previewTier < EQUIPMENT_PREVIEW_TIER_MAX) {
          return { tier: previewTier };
        }
        // In-battle Cyclops awaken upgrade — not numeric tier 6 (player equips stay T1–T5).
        return { tier: EQUIPMENT_PREVIEW_CYCLOPS_RARITY };
      };

      const resolveEquipmentPreviewSpriteId = (metadata, previewTier) => {
        if (!metadata) return null;
        if (previewTier < EQUIPMENT_PREVIEW_TIER_MAX) return metadata.spriteId ?? null;
        for (const key of ['awakenCyclopsSpriteId', 'cyclopsSpriteId', 'upgradedSpriteId', 'spriteId']) {
          const id = Number(metadata[key]);
          if (Number.isFinite(id)) return id;
        }
        return metadata.spriteId ?? null;
      };

      const mountEquipmentPreviewEffect = (root, effectComponent, tier, effectHost) => {
        const createUIComponent = globalThis.state?.utils?.createUIComponent;
        if (!root || !effectComponent || typeof createUIComponent !== 'function') return null;
        const previewTier = clampEquipmentPreviewTier(tier);

        const cyclopsFallbackProps = [
          { tier: EQUIPMENT_PREVIEW_CYCLOPS_RARITY },
          { tier: 5, awakenCyclops: true },
          { tier: 5, cyclopsUpgrade: true },
          { tier: 5 }
        ];

        const mountWithProps = (props) => {
          try {
            const component = createUIComponent(root, effectComponent, props);
            if (component && typeof component.mount === 'function') component.mount();
            return component || null;
          } catch {
            return null;
          }
        };

        const initialProps = getEquipmentPreviewEffectProps(previewTier);
        let component = mountWithProps(initialProps);
        if (!component) return null;

        if (previewTier >= EQUIPMENT_PREVIEW_TIER_MAX) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const text = root.textContent || '';
              if (!/\bNaN\b/.test(text)) return;

              try {
                if (component && typeof component.unmount === 'function') component.unmount();
              } catch {
                // ignore
              }
              root.replaceChildren();

              for (let i = 1; i < cyclopsFallbackProps.length; i++) {
                const alt = mountWithProps(cyclopsFallbackProps[i]);
                if (!alt) continue;
                const altText = root.textContent || '';
                if (!/\bNaN\b/.test(altText)) {
                  if (effectHost) effectHost._effectTooltipComponent = alt;
                  return;
                }
                try {
                  if (typeof alt.unmount === 'function') alt.unmount();
                } catch {
                  // ignore
                }
                root.replaceChildren();
              }
            });
          });
        }

        return component;
      };

      const createEquipmentTierSelector = (onTierChange) => {
        const row = document.createElement('div');
        row.style.cssText =
          'display:flex; flex-direction:row; gap:3px; justify-content:center; align-items:center; margin:0 auto 8px; width:100%; flex-wrap:nowrap;';

        for (let tier = 1; tier <= EQUIPMENT_PREVIEW_TIER_MAX; tier++) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = `T${tier}`;
          btn.title = tier === EQUIPMENT_PREVIEW_TIER_MAX
            ? 'Awaken Cyclops upgrade (in-battle)'
            : `Tier ${tier}`;
          const isActive = tier === equipmentPreviewTier;
          const accent = EQUIPMENT_PREVIEW_TIER_COLORS[tier - 1];
          btn.style.cssText =
            `background:${isActive ? accent : 'rgba(255,255,255,0.1)'};` +
            `color:${isActive ? '#1a1a1a' : '#e6d7b0'};` +
            `border:1px solid ${isActive ? accent : 'rgba(255,255,255,0.2)'};` +
            'padding:2px 6px; border-radius:2px; font-size:11px; cursor:pointer; font-family:inherit; outline:none; min-width:24px; line-height:1.2;';
          btn.addEventListener('mouseenter', () => {
            if (equipmentPreviewTier !== tier) {
              btn.style.background = 'rgba(255,255,255,0.2)';
              btn.style.borderColor = accent;
            }
          });
          btn.addEventListener('mouseleave', () => {
            if (equipmentPreviewTier !== tier) {
              btn.style.background = 'rgba(255,255,255,0.1)';
              btn.style.borderColor = 'rgba(255,255,255,0.2)';
              btn.style.color = '#e6d7b0';
            }
          });
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const clamped = clampEquipmentPreviewTier(tier);
            if (equipmentPreviewTier === clamped) return;
            equipmentPreviewTier = clamped;
            onTierChange();
          });
          row.appendChild(btn);
        }
        return row;
      };

      // Common styles for equipment tab
      const EQUIPMENT_STYLES = {
        container: {
          display: 'flex', flexDirection: 'row', width: '100%', height: '100%',
          alignItems: 'flex-start', justifyContent: 'center', gap: '0'
        },
        column: {
          flex: '1 1 0', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'flex-start', fontSize: '16px',
          fontWeight: 'bold', color: COLOR_CONSTANTS.TEXT,
          borderRight: '6px solid transparent',
          borderImage: `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`
        },
      };

      const createTitleElement = (titleText, updateFunction) => {
        const title = createCyclopediaWidgetTitle(titleText, { width: '100%', marginBottom: '10px' });
        if (updateFunction) updateFunction(title);
        return { title, titleP: title };
      };

      const d = document.createElement('div');
      Object.assign(d.style, EQUIPMENT_STYLES.container);

      const equipDetailsCol = document.createElement('div');
      Object.assign(equipDetailsCol.style, EQUIPMENT_STYLES.column, {
        flex: '0 0 450px',
        width: '450px',
        minWidth: '450px',
        maxWidth: '450px'
      });
      equipDetailsCol.classList.add('text-whiteHighlight');

      // Create top section for equipment details
      const equipDetailsTop = document.createElement('div');
      Object.assign(equipDetailsTop.style, {
        flex: '0 0 40%', minHeight: '0', width: '100%', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start'
      });

      const updateEquipDetailsTitle = (titleP) => {
        titleP.textContent = 'Equipment Details';
      };
      const { title: equipDetailsTitle, titleP: equipDetailsTitleP } = createTitleElement('Equipment Details', updateEquipDetailsTitle);
      equipDetailsTop.appendChild(equipDetailsTitle);

      // Create bottom section for creature usage info
      const equipDetailsBottom = document.createElement('div');
      Object.assign(equipDetailsBottom.style, {
        flex: '0 0 55%', minHeight: '0', width: '100%', display: 'flex',
        flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start',
        borderTop: '2px solid #444', marginTop: '2px', paddingTop: '2px', boxSizing: 'border-box'
      });

      const updateCreatureUsageTitle = (titleP) => {
        titleP.textContent = 'Found in:';
      };
      const { title: creatureUsageTitle, titleP: creatureUsageTitleP } = createTitleElement('Found in:', updateCreatureUsageTitle);
      creatureUsageTitle.style.marginBottom = '4px';
      equipDetailsBottom.appendChild(creatureUsageTitle);

      equipDetailsCol.appendChild(equipDetailsTop);
      equipDetailsCol.appendChild(equipDetailsBottom);

      const ownedEquipCol = document.createElement('div');
      Object.assign(ownedEquipCol.style, EQUIPMENT_STYLES.column, {
        flex: '1 1 0',
        minWidth: '0',
        borderRight: 'none',
        borderImage: 'none'
      });
      ownedEquipCol.classList.add('text-whiteHighlight');

      const updateOwnedEquipTitle = (titleP) => {
        titleP.textContent = 'Owned Equipment';
      };
      const { title: ownedEquipTitle, titleP: ownedEquipTitleP } = createTitleElement('Owned Equipment', updateOwnedEquipTitle);
      ownedEquipCol.appendChild(ownedEquipTitle);

      // Equipment-to-creature mapping cache for faster lookups
      let equipmentCreatureCache = null;
      
      function buildEquipmentCreatureCache() {
        if (equipmentCreatureCache) return equipmentCreatureCache;
        
        const cache = new Map(); // Map<equipId, Map<roomName, Set<creatureName>>>
        const rooms = globalThis.state?.utils?.ROOMS;
        const roomNames = globalThis.state?.utils?.ROOM_NAME;
        
        if (!rooms || !roomNames) {
          console.warn('[Cyclopedia] Missing room data for cache');
          return cache;
        }
        
        
        let totalActors = 0;
        let actorsWithEquipment = 0;
        
        // Use the working approach: iterate through all rooms
        Object.entries(rooms).forEach(([roomIndex, room]) => {
          try {
            const actors = room.file?.data?.actors;
            if (!actors || !Array.isArray(actors)) return;
            
            const roomCode = room.id;
            const roomName = roomNames[roomCode] || roomCode;
            
            actors.forEach(actor => {
              totalActors++;
              if (actor?.equip?.gameId) {
                actorsWithEquipment++;
                const equipId = actor.equip.gameId;
                const creatureId = actor.id;
                
                // Get creature name
                let creatureName = 'Unknown Creature';
                try {
                  if (globalThis.state?.utils?.getMonster) {
                    const monsterData = globalThis.state.utils.getMonster(creatureId);
                    creatureName = monsterData?.metadata?.name || creatureName;
                  }
                } catch (error) {
                  // Skip if can't get creature name
                }
                
                if (!cache.has(equipId)) {
                  cache.set(equipId, new Map());
                }
                
                const equipData = cache.get(equipId);
                if (!equipData.has(roomCode)) {
                  equipData.set(roomCode, new Set());
                }
                equipData.get(roomCode).add(creatureName);
              }
            });
          } catch (error) {
            console.warn('[Cyclopedia] Error building cache for room:', roomIndex, error);
          }
        });
        
        equipmentCreatureCache = cache;
        return cache;
      }

      // Helper function to navigate to a map by name (uses centralized NavigationHandler)
      function navigateToMap(mapName) {
        return NavigationHandler.navigateToMapByName(mapName);
      }

      // Function to get creature usage data for equipment (optimized with cache)
      function getCreatureUsageForEquipment(equipId) {
        const usageData = [];
        
        try {
          // Use cached data for instant lookup
          const cache = buildEquipmentCreatureCache();
          const equipData = cache.get(equipId);
          
          if (!equipData) {
            return usageData; // No creatures found using this equipment
          }
          
          // Get region data for proper ordering
          const regions = globalThis.state?.utils?.REGIONS;
          if (!regions) {
            // Fallback: just return all rooms in cache order
            const roomNames = globalThis.state?.utils?.ROOM_NAME;
            equipData.forEach((creatures, roomCode) => {
              const displayName = roomNames?.[roomCode] || roomCode;
              usageData.push({
                mapName: displayName,
                creatures: Array.from(creatures).sort(),
                regionName: 'Other Maps'
              });
            });
            return usageData;
          }
          
          // Build ordered list using region room order
          const orderedUsage = [];
          regions.forEach(region => {
            if (!region.rooms) return;
            
            const regionName = cyclopediaGetRegionDisplayName(region.id);
            let regionHasMaps = false;
            
            region.rooms.forEach(room => {
              const roomCode = room.id;
              
              if (equipData.has(roomCode)) {
                const creatures = Array.from(equipData.get(roomCode)).sort();
                if (creatures.length > 0) {
                  // Use the room name from ROOM_NAME mapping, fallback to room code if no name
                  const roomNames = globalThis.state?.utils?.ROOM_NAME;
                  const displayName = roomNames?.[roomCode] || roomCode;
                  orderedUsage.push({
                    mapName: displayName,
                    creatures: creatures,
                    regionName: regionName
                  });
                  regionHasMaps = true;
                }
              }
            });
          });
          
          return orderedUsage;
          
        } catch (error) {
          console.warn('[Cyclopedia] Error getting creature usage data:', error);
        }
        
        return usageData;
      }

      function resolveConfigEquipmentGameId(cfg, equipLookup, equipGameIdSet) {
        if (!cfg || typeof cfg !== 'object') return null;
        const rawCandidates = [
          cfg.equipId,
          cfg.equipmentId,
          cfg.itemId,
          cfg?.piece?.equipId,
          cfg?.piece?.equipmentId,
          cfg?.piece?.itemId
        ].filter((v) => v != null);

        for (const raw of rawCandidates) {
          if (equipLookup.has(raw)) return equipLookup.get(raw);
          const rawStr = String(raw);
          for (const [equipKey, gameId] of equipLookup.entries()) {
            if (String(equipKey) === rawStr) return gameId;
          }
          // Some payloads may already carry gameId directly
          if (equipGameIdSet.has(raw)) return raw;
          if (equipGameIdSet.has(rawStr)) {
            for (const gid of equipGameIdSet) {
              if (String(gid) === rawStr) return gid;
            }
          }
        }
        return null;
      }

      function getBoardConfigUsageStatsForEquipment(equipGameId) {
        const emptyStats = {
          itemCount: 0,
          totalUsage: 0,
          percentage: 0,
          statUsage: { ad: 0, ap: 0, hp: 0 },
          mostUsedStat: 'ad'
        };

        try {
          const playerContext = globalThis.state?.player?.getSnapshot?.()?.context;
          const equips = Array.isArray(playerContext?.equips) ? playerContext.equips : [];
          const boardConfigs = playerContext?.boardConfigs && typeof playerContext.boardConfigs === 'object'
            ? playerContext.boardConfigs
            : {};

          if (!equips.length) return emptyStats;

          const equipLookup = new Map(equips.map((e) => [e.id, e.gameId]));
          const equipById = new Map(equips.map((e) => [e.id, e]));
          const equipByIdStr = new Map(equips.map((e) => [String(e.id), e]));
          const equipGameIdSet = new Set(equips.map((e) => e.gameId));

          let totalUsage = 0;
          let itemCount = 0;
          const statUsage = { ad: 0, ap: 0, hp: 0 };

          Object.values(boardConfigs).forEach((cfgs) => {
            if (!Array.isArray(cfgs)) return;
            cfgs.forEach((cfg) => {
              const gameId = resolveConfigEquipmentGameId(cfg, equipLookup, equipGameIdSet);
              if (gameId == null) return;

              totalUsage++;
              if (gameId !== equipGameId) return;

              itemCount++;
              const rawEquipId = cfg?.equipId ?? cfg?.equipmentId ?? cfg?.itemId ?? cfg?.piece?.equipId ?? cfg?.piece?.equipmentId ?? cfg?.piece?.itemId;
              const equip = equipById.get(rawEquipId) || equipByIdStr.get(String(rawEquipId));
              const stat = equip?.stat;
              if (stat === 'ad' || stat === 'ap' || stat === 'hp') {
                statUsage[stat]++;
              }
            });
          });

          const percentage = totalUsage > 0 ? Math.floor((itemCount / totalUsage) * 100) : 0;
          const mostUsedStat = [
            { stat: 'ad', count: statUsage.ad },
            { stat: 'ap', count: statUsage.ap },
            { stat: 'hp', count: statUsage.hp }
          ].sort((a, b) => b.count - a.count)[0].stat;

          return { itemCount, totalUsage, percentage, statUsage, mostUsedStat };
        } catch (error) {
          console.warn('[Cyclopedia] Error reading board config usage stats:', error);
          return emptyStats;
        }
      }

      function updateRightCol() {
        if (equipDetailsTop._effectTooltipComponent) {
          try {
            equipDetailsTop._effectTooltipComponent.unmount?.();
          } catch {
            // ignore
          }
          equipDetailsTop._effectTooltipComponent = null;
        }

        equipDetailsTop.innerHTML = '';
        equipDetailsTop.appendChild(equipDetailsTitle);
        equipDetailsBottom.innerHTML = '';
        equipDetailsBottom.appendChild(creatureUsageTitle);

        // Get the current selectedEquipment value from the outer scope
        // We need to access the updated value, not the captured one
        let currentSelectedEquipment = null;
        
        // Try to get the current value from the outer scope
        try {
          // Access the global selectedEquipment variable
          if (typeof window !== 'undefined' && window.cyclopediaSelectedEquipment !== undefined) {
            currentSelectedEquipment = window.cyclopediaSelectedEquipment;
          } else {
            // Fallback to the captured value
            currentSelectedEquipment = selectedEquipment;
          }
        } catch (e) {
          currentSelectedEquipment = selectedEquipment;
        }
        
        if (!currentSelectedEquipment) {
          equipDetailsTitleP.textContent = 'Equipment Details';
          equipDetailsTop.innerHTML += '<div class="' + FONT_CONSTANTS.SIZES.BODY + '" style="text-align:center;">Select equipment item to view details</div>';
          creatureUsageTitleP.textContent = 'Found in:';
          equipDetailsBottom.innerHTML += '<div class="' + FONT_CONSTANTS.SIZES.BODY + '" style="text-align:center;">Select equipment item to view locations</div>';
        } else {
          equipDetailsTitleP.textContent = currentSelectedEquipment;
          creatureUsageTitleP.textContent = 'Found in:';
          
          // Find equipment ID by name
          let equipId = null;
          
          // Try BestiaryModAPI first (faster)
          if (window.BestiaryModAPI?.utility?.maps) {
            equipId = window.BestiaryModAPI.utility.maps.equipmentNamesToGameIds.get(currentSelectedEquipment.toLowerCase());
          }
          
          // Fallback to brute force search
          if (equipId == null && globalThis.state?.utils?.getEquipment) {
            const utils = globalThis.state.utils;
            const searchName = currentSelectedEquipment.toLowerCase();
            for (let i = 1; i < 1000; i++) {
              try {
                const eq = utils.getEquipment(i);
                if (eq?.metadata?.name?.toLowerCase() === searchName) {
                  equipId = i;
                  break;
                }
              } catch (e) {
                // Equipment ID doesn't exist, continue
              }
            }
          }

          if (equipId == null) {
            equipDetailsTop.innerHTML += '<div class="' + FONT_CONSTANTS.SIZES.BODY + '" style="text-align:center;">Equipment item not found</div>';
            equipDetailsBottom.innerHTML += '<div class="' + FONT_CONSTANTS.SIZES.BODY + '" style="text-align:center;">Equipment item not found</div>';
          } else {
            const equipData = globalThis.state.utils.getEquipment(equipId);
            
            // Equipment details + usage stats section (split top area in two columns)
            const topRow = document.createElement('div');
            topRow.style.cssText = 'display:flex; flex-direction:row; gap:8px; width:100%; max-width:100%; align-items:stretch; min-height:0; flex:1 1 auto; box-sizing:border-box;';

            const detailsWrap = document.createElement('div');
            detailsWrap.style.cssText = 'display:flex; flex-direction:column; align-items:center; justify-content:flex-start; width:50%; min-width:0;';

            const previewTier = clampEquipmentPreviewTier(equipmentPreviewTier);

            const previewSpriteId = resolveEquipmentPreviewSpriteId(equipData?.metadata, previewTier);

            let portrait = api.ui.components.createItemPortrait({
              itemId: previewSpriteId ?? equipData?.metadata?.spriteId,
              tier: previewTier >= EQUIPMENT_PREVIEW_TIER_MAX ? 5 : previewTier
            });

            if (portrait.tagName === 'BUTTON' && portrait.firstChild) {
              portrait = portrait.firstChild;
            }

            applyEquipmentPreviewPortraitTier(portrait, previewTier);

            portrait.style.display = 'block';
            portrait.style.margin = '0 auto 8px auto';

            const tooltipDiv = document.createElement('div');
            tooltipDiv.className = FONT_CONSTANTS.SIZES.SMALL;
            tooltipDiv.style.textAlign = 'left';
            tooltipDiv.style.color = '#e6d7b0';
            tooltipDiv.style.margin = '0 auto';
            tooltipDiv.style.maxWidth = '90%';
            tooltipDiv.style.overflowY = 'auto';
            tooltipDiv.style.maxHeight = '80px';
            tooltipDiv.style.padding = '4px 0 0 0';
            tooltipDiv.style.wordBreak = 'break-word';
            tooltipDiv.style.width = '100%';
            tooltipDiv.style.boxSizing = 'border-box';

            if (equipData?.metadata?.description) {
              tooltipDiv.innerHTML = equipData.metadata.description;
            } else if (equipData?.metadata?.EffectComponent) {
              const tooltipComponent = mountEquipmentPreviewEffect(
                tooltipDiv,
                equipData.metadata.EffectComponent,
                previewTier,
                equipDetailsTop
              );
              if (!tooltipComponent) {
                tooltipDiv.textContent = 'No description available.';
              } else {
                equipDetailsTop._effectTooltipComponent = tooltipComponent;
              }
            } else {
              tooltipDiv.textContent = 'No description available.';
            }

            detailsWrap.appendChild(createEquipmentTierSelector(updateRightCol));

            const tierSeparator = document.createElement('div');
            tierSeparator.className = 'separator my-2.5';
            tierSeparator.setAttribute('role', 'none');
            tierSeparator.style.margin = '0 0 4px 0';
            detailsWrap.appendChild(tierSeparator);

            detailsWrap.appendChild(portrait);
            detailsWrap.appendChild(tooltipDiv);

            const usageWrap = document.createElement('div');
            usageWrap.className = FONT_CONSTANTS.SIZES.SMALL;
            usageWrap.style.cssText = 'width:50%; min-width:0; text-align:left; color:#e6d7b0; display:flex; flex-direction:column; justify-content:flex-start; border-left:1px solid #444; padding-left:8px; box-sizing:border-box; overflow-y:auto; max-height:130px; line-height:1.15;';

            const usage = getBoardConfigUsageStatsForEquipment(equipId);
            const usageTitle = document.createElement('div');
            usageTitle.className = FONT_CONSTANTS.SIZES.SMALL;
            usageTitle.style.cssText = 'font-weight:700; margin-bottom:4px; color:#ffe066; letter-spacing:0.02em;';
            usageTitle.textContent = 'Player usage';
            usageWrap.appendChild(usageTitle);

            const usageSeparator = document.createElement('div');
            usageSeparator.className = 'separator my-2.5';
            usageSeparator.setAttribute('role', 'none');
            usageSeparator.style.margin = '0 0 4px 0';
            usageWrap.appendChild(usageSeparator);

            if (usage.totalUsage <= 0) {
              const noData = document.createElement('div');
              noData.textContent = 'No saved configurations found.';
              noData.style.fontStyle = 'italic';
              noData.style.color = '#aaa';
              noData.style.fontSize = '12px';
              usageWrap.appendChild(noData);
            } else {
              const usageCount = document.createElement('div');
              usageCount.textContent = `Used ${usage.itemCount} times`;
              usageCount.style.marginBottom = '1px';
              usageWrap.appendChild(usageCount);

              const usagePct = document.createElement('div');
              usagePct.textContent = `Usage percentage: ${usage.percentage}%`;
              usagePct.style.marginBottom = '3px';
              usageWrap.appendChild(usagePct);

              const usageDist = document.createElement('div');
              usageDist.textContent = 'Stats distribution:';
              usageDist.style.marginTop = '1px';
              usageDist.style.marginBottom = '1px';
              usageWrap.appendChild(usageDist);

              const statRows = document.createElement('div');
              statRows.style.cssText = 'display:flex; flex-direction:row; gap:10px; margin-top:1px; align-items:center; flex-wrap:wrap;';

              const makeStatRow = (iconPath, label, count) => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; align-items:center; gap:6px;';
                const icon = document.createElement('img');
                icon.src = iconPath;
                icon.alt = label;
                icon.style.cssText = 'width:14px; height:14px; image-rendering:pixelated; flex:0 0 auto;';
                const text = document.createElement('span');
                text.textContent = `${count}`;
                row.appendChild(icon);
                row.appendChild(text);
                return row;
              };

              statRows.appendChild(makeStatRow('/assets/icons/attackdamage.png', 'Attack Damage', usage.statUsage.ad));
              statRows.appendChild(makeStatRow('/assets/icons/abilitypower.png', 'Ability Power', usage.statUsage.ap));
              statRows.appendChild(makeStatRow('/assets/icons/heal.png', 'Health Points', usage.statUsage.hp));
              usageWrap.appendChild(statRows);
            }

            topRow.appendChild(detailsWrap);
            topRow.appendChild(usageWrap);
            equipDetailsTop.appendChild(topRow);

            const foundInRow = document.createElement('div');
            foundInRow.style.cssText =
              'display: flex; flex-direction: row; flex: 1 1 auto; min-height: 0; width: 100%; gap: 6px; align-items: stretch; box-sizing: border-box;';

            const mapsColumn = document.createElement('div');
            mapsColumn.style.cssText =
              'flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 3px; overflow: hidden;';
            const mapsColTitle = document.createElement('div');
            mapsColTitle.className = FONT_CONSTANTS.SIZES.SMALL;
            mapsColTitle.textContent = 'Maps';
            mapsColTitle.style.cssText =
              'font-weight: 700; color: #ffe066; text-align: center; width: 100%; padding: 2px 4px 3px; border-bottom: 1px solid #555; box-sizing: border-box;';

            const creatureUsageContainer = document.createElement('div');
            creatureUsageContainer.style.cssText = `
              width: 100%; flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 3px; box-sizing: border-box;
              display: flex; flex-direction: column; gap: 2px;
            `;

            const creatureUsageData = getCreatureUsageForEquipment(equipId);

            function openCreatureInBestiary(creatureNameRaw) {
              openCreatureInBestiaryTab(creatureNameRaw, {
                setActiveTabFn: setActiveTab,
                clickListItemFn: typeof _cyclopediaClickListItem === 'function' ? _cyclopediaClickListItem : null,
                tabPage: typeof tabPages !== 'undefined' ? tabPages[1] : null,
                inventoryTabPage: typeof tabPages !== 'undefined' ? tabPages[3] : null,
                findBoxByTitleFn: typeof _cyclopediaFindBoxByTitle === 'function' ? _cyclopediaFindBoxByTitle : null,
                timerLabel: 'equipmentMapCreatureSelect'
              });
            }

            function appendStyledMapRow(parentEl, mapName, creaturesLabel) {
              const usageDiv = document.createElement('div');
              usageDiv.style.cssText = `
                    padding: 2px 4px; display: flex; flex-direction: column; gap: 2px;
                    margin-top: 1px; margin-bottom: 1px; line-height: 1;
                    letter-spacing: 0.0625rem; word-spacing: -0.1875rem;
                    color: rgb(255, 255, 255);
                  `;
              usageDiv.className = FONT_CONSTANTS.SIZES.BODY;

              const mapNameDiv = document.createElement('div');
              mapNameDiv.className = FONT_CONSTANTS.SIZES.SMALL;
              mapNameDiv.style.cssText = `
                    font-weight: bold; line-height: 1; letter-spacing: 0.0625rem;
                    word-spacing: -0.1875rem; margin: 0px; padding: 1px 4px;
                    border-radius: 4px; display: flex; justify-content: space-between;
                    align-items: center; text-align: left; cursor: pointer;
                    text-decoration: underline; background: transparent;
                    color: rgb(255, 255, 255);
                  `;
              mapNameDiv.title = 'Click to go to this map';

              const mapNameSpan = document.createElement('span');
              mapNameSpan.style.cssText = `
                    flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis;
                    white-space: nowrap;
                  `;
              mapNameSpan.textContent = mapName;

              NavigationHandler.attachMapNavigation(mapNameDiv, mapName);

              mapNameDiv.appendChild(mapNameSpan);
              usageDiv.appendChild(mapNameDiv);

              if (creaturesLabel) {
                const creatureInfoDiv = document.createElement('div');
                creatureInfoDiv.className = FONT_CONSTANTS.SIZES.SMALL;
                creatureInfoDiv.style.cssText = `
                    color: rgb(170, 170, 170); line-height: 1;
                    letter-spacing: 0.0625rem; word-spacing: -0.1875rem;
                    margin-left: 6px; margin-top: 0px; font-style: italic;
                  `;
                const names = String(creaturesLabel)
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                names.forEach((name, i) => {
                  if (i > 0) {
                    creatureInfoDiv.appendChild(document.createTextNode(', '));
                  }
                  const nameSpan = document.createElement('span');
                  nameSpan.textContent = name;
                  nameSpan.style.cursor = 'pointer';
                  nameSpan.style.textDecoration = 'underline';
                  nameSpan.style.textDecorationStyle = 'solid';
                  nameSpan.style.color = 'rgb(170, 170, 170)';
                  nameSpan.title = `Open ${name} in Bestiary`;
                  nameSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openCreatureInBestiary(name);
                  });
                  nameSpan.addEventListener('mouseenter', () => {
                    nameSpan.style.color = 'rgb(255, 255, 255)';
                  });
                  nameSpan.addEventListener('mouseleave', () => {
                    nameSpan.style.color = 'rgb(170, 170, 170)';
                  });
                  creatureInfoDiv.appendChild(nameSpan);
                });
                usageDiv.appendChild(creatureInfoDiv);
              }

              const separator = document.createElement('div');
              separator.className = 'separator my-2.5';
              separator.setAttribute('role', 'none');
              separator.style.cssText = 'margin: 1px 0px;';
              usageDiv.appendChild(separator);

              parentEl.appendChild(usageDiv);
            }

            function appendRegionHeader(parentEl, regionName) {
              const regionHeader = document.createElement('div');
              regionHeader.className = FONT_CONSTANTS.SIZES.BODY;
              regionHeader.style.cssText = `
                  font-weight: 700; color: var(--theme-text, #e6d7b0);
                  background: url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png");
                  border-width: 6px; border-style: solid; border-color: rgb(255, 224, 102);
                  border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill;
                  border-radius: 0px; box-sizing: border-box; text-align: center;
                  padding: 0px 4px; margin: 0px; display: block;
                `;
              regionHeader.textContent = regionName;
              parentEl.appendChild(regionHeader);
            }

            function buildMapNameToRegionMeta() {
              const roomNames = globalThis.state?.utils?.ROOM_NAME || {};
              const regions = globalThis.state?.utils?.REGIONS || [];
              const map = new Map();
              const indexByRegion = new Map();
              let idx = 0;
              regions.forEach((region) => {
                if (!region?.rooms || !Array.isArray(region.rooms)) return;
                const regionName = cyclopediaGetRegionDisplayName(region.id);
                if (!indexByRegion.has(regionName)) {
                  indexByRegion.set(regionName, idx++);
                }
                region.rooms.forEach((room) => {
                  const roomCode = room?.id;
                  if (!roomCode) return;
                  const mapName = roomNames[roomCode] || roomCode;
                  map.set(mapName, { regionName, regionIndex: indexByRegion.get(regionName) });
                });
              });
              return map;
            }

            if (creatureUsageData.length === 0) {
              const noUsageDiv = document.createElement('div');
              noUsageDiv.className = FONT_CONSTANTS.SIZES.SMALL;
              noUsageDiv.style.textAlign = 'center';
              noUsageDiv.style.color = '#888';
              noUsageDiv.style.padding = '6px';
              noUsageDiv.style.fontStyle = 'italic';
              noUsageDiv.textContent = 'No map data';
              creatureUsageContainer.appendChild(noUsageDiv);
            } else {
              const mapsByRegion = {};
              creatureUsageData.forEach((usage) => {
                const regionName = usage.regionName || 'Other Maps';
                if (!mapsByRegion[regionName]) {
                  mapsByRegion[regionName] = [];
                }
                mapsByRegion[regionName].push(usage);
              });

              Object.entries(mapsByRegion).forEach(([regionName, maps]) => {
                appendRegionHeader(creatureUsageContainer, regionName);

                maps.forEach((usage) => {
                  appendStyledMapRow(creatureUsageContainer, usage.mapName, usage.creatures.join(', '));
                });
              });
            }

            mapsColumn.appendChild(mapsColTitle);
            mapsColumn.appendChild(creatureUsageContainer);

            const boostedColumn = document.createElement('div');
            boostedColumn.style.cssText =
              'flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 3px; overflow: hidden; border-left: 1px solid #444; padding-left: 6px; box-sizing: border-box;';
            const boostedColTitle = document.createElement('div');
            boostedColTitle.className = FONT_CONSTANTS.SIZES.SMALL;
            boostedColTitle.textContent = 'Boosted Maps';
            boostedColTitle.style.cssText =
              'font-weight: 700; color: #ffe066; text-align: center; width: 100%; padding: 2px 4px 3px; border-bottom: 1px solid #555; box-sizing: border-box;';

            const boostedScroll = document.createElement('div');
            boostedScroll.style.cssText = `
              width: 100%; flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 3px; box-sizing: border-box;
              display: flex; flex-direction: column; gap: 2px;
            `;

            const boostedWiki = GAME_DATA.HARDCODED_BOOSTED_MAP[currentSelectedEquipment];
            if (boostedWiki === false) {
              const noBoosted = document.createElement('div');
              noBoosted.className = FONT_CONSTANTS.SIZES.SMALL;
              noBoosted.style.textAlign = 'center';
              noBoosted.style.color = '#888';
              noBoosted.style.padding = '6px';
              noBoosted.style.fontStyle = 'italic';
              noBoosted.textContent = '—';
              boostedScroll.appendChild(noBoosted);
            } else if (typeof boostedWiki === 'string') {
              const mapToRegionMeta = buildMapNameToRegionMeta();
              const boostedByRegion = new Map();
              boostedWiki
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .forEach((mapName) => {
                  const meta = mapToRegionMeta.get(mapName) || { regionName: 'Other Maps', regionIndex: Number.MAX_SAFE_INTEGER };
                  if (!boostedByRegion.has(meta.regionName)) {
                    boostedByRegion.set(meta.regionName, { regionIndex: meta.regionIndex, maps: [] });
                  }
                  boostedByRegion.get(meta.regionName).maps.push(mapName);
                });
              [...boostedByRegion.entries()]
                .sort((a, b) => {
                  if (a[1].regionIndex !== b[1].regionIndex) {
                    return a[1].regionIndex - b[1].regionIndex;
                  }
                  return a[0].localeCompare(b[0]);
                })
                .forEach(([regionName, meta]) => {
                  appendRegionHeader(boostedScroll, regionName);
                  meta.maps.forEach((mapName) => {
                    appendStyledMapRow(boostedScroll, mapName, null);
                  });
                });
            } else {
              const unk = document.createElement('div');
              unk.className = FONT_CONSTANTS.SIZES.SMALL;
              unk.style.textAlign = 'center';
              unk.style.color = '#888';
              unk.style.padding = '12px';
              unk.style.fontStyle = 'italic';
              unk.textContent = '—';
              unk.title = 'Not in wiki boosted map list';
              boostedScroll.appendChild(unk);
            }

            boostedColumn.appendChild(boostedColTitle);
            boostedColumn.appendChild(boostedScroll);

            foundInRow.appendChild(mapsColumn);
            foundInRow.appendChild(boostedColumn);
            equipDetailsBottom.appendChild(foundInRow);
          }
        }

        ownedEquipCol.innerHTML = '';
        ownedEquipCol.appendChild(ownedEquipTitle);

        if (!currentSelectedEquipment) {
          ownedEquipTitleP.textContent = 'Owned Equipment';
          ownedEquipCol.innerHTML += '<div class="' + FONT_CONSTANTS.SIZES.BODY + '" style="text-align:center;">Select equipment item to view owned</div>';
        } else {
          let equipId = null;

          if (window.BestiaryModAPI?.utility?.maps) {
            equipId = window.BestiaryModAPI.utility.maps.equipmentNamesToGameIds.get(currentSelectedEquipment.toLowerCase());
          }

          if (equipId == null && globalThis.state?.utils?.getEquipment) {
            const utils = globalThis.state.utils;
            for (let i = 1; i < 1000; i++) {
              try {
                const eq = utils.getEquipment(i);
                if (eq?.metadata?.name?.toLowerCase() === currentSelectedEquipment.toLowerCase()) {
                  equipId = i;
                  break;
                }
              } catch (e) {
          console.warn('[Cyclopedia] Error in creature ownership check:', e);
        }
            }
          }

          const playerEquips = globalThis.state?.player?.getSnapshot?.().context?.equips || [];
          let owned = playerEquips.filter(e => e.gameId === equipId);
          owned = owned.sort((a, b) => {
            if ((b.tier || 0) !== (a.tier || 0)) return (b.tier || 0) - (a.tier || 0);
            if ((a.stat || '').toLowerCase() < (b.stat || '').toLowerCase()) return -1;
            if ((a.stat || '').toLowerCase() > (b.stat || '').toLowerCase()) return 1;
            return 0;
          });

          ownedEquipTitleP.textContent = `Owned ${currentSelectedEquipment} (${owned.length})`;

          if (owned.length === 0) {
            const noEquipmentDiv = document.createElement('div');
            noEquipmentDiv.className = FONT_CONSTANTS.SIZES.BODY;
            noEquipmentDiv.textContent = 'You do not own this equipment item.';
            // Center the text both horizontally and vertically
            noEquipmentDiv.style.textAlign = 'center';
            noEquipmentDiv.style.padding = '20px';
            noEquipmentDiv.style.display = 'flex';
            noEquipmentDiv.style.alignItems = 'center';
            noEquipmentDiv.style.justifyContent = 'center';
            noEquipmentDiv.style.height = '100%';
            ownedEquipCol.appendChild(noEquipmentDiv);
          } else {
            const statTypes = ['hp', 'ad', 'ap'];
            const statIcons = {
              hp: '/assets/icons/heal.png',
              ad: '/assets/icons/attackdamage.png',
              ap: '/assets/icons/abilitypower.png'
            };

            const tierGroups = { hp: {}, ad: {}, ap: {} };
            owned.forEach(eq => {
              if (statTypes.includes(eq.stat)) {
                const tier = eq.tier || 1;
                if (!tierGroups[eq.stat][tier]) {
                  tierGroups[eq.stat][tier] = [];
                }
                tierGroups[eq.stat][tier].push(eq);
              }
            });

            const headerRow = document.createElement('div');
            Object.assign(headerRow.style, {
              display: 'flex', flexDirection: 'row', width: '100%', gap: '0'
            });

            statTypes.forEach(stat => {
              const col = document.createElement('div');
              col.style.flex = '1 1 0';
              col.style.display = 'flex';
              col.style.flexDirection = 'column';
              col.style.alignItems = 'center';
              col.style.justifyContent = 'flex-start';

              const labelWrap = document.createElement('div');
              Object.assign(labelWrap.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: '2px', marginBottom: '2px'
              });

              const icon = document.createElement('img');
              icon.src = statIcons[stat];
              icon.alt = stat.toUpperCase();
              Object.assign(icon.style, {
                width: '22px', height: '22px', display: 'inline-block', marginRight: '4px'
              });
              labelWrap.appendChild(icon);

              const countSpan = document.createElement('span');
              countSpan.className = FONT_CONSTANTS.SIZES.BODY;
              countSpan.textContent = `(${Object.values(tierGroups[stat]).reduce((sum, group) => sum + group.length, 0)})`;
              labelWrap.appendChild(countSpan);

              col.appendChild(labelWrap);

              const sep = document.createElement('div');
              sep.className = 'separator my-2.5';
              sep.setAttribute('role', 'none');
              sep.style.margin = '0px 0px';
              col.appendChild(sep);

              headerRow.appendChild(col);
            });

            ownedEquipCol.appendChild(headerRow);

            const grid = document.createElement('div');
            Object.assign(grid.style, {
              display: 'flex', flexDirection: 'row', width: '100%', gap: '0',
              overflowY: 'auto', flex: '1 1 0', minHeight: '0', height: 'auto'
            });

            statTypes.forEach(stat => {
              const col = document.createElement('div');
              col.style.flex = '1 1 0';
              col.style.display = 'flex';
              col.style.flexDirection = 'column';
              col.style.alignItems = 'center';
              col.style.justifyContent = 'flex-start';
              col.style.gap = '4px';

              for (let tier = 5; tier >= 1; tier--) {
                const tierGroup = tierGroups[stat][tier] || [];
                const count = tierGroup.length;

                const tierRow = document.createElement('div');
                Object.assign(tierRow.style, {
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', margin: '2px 0'
                });

                let eqData = null;
                try {
                  if (equipId != null && globalThis.state?.utils?.getEquipment) {
                    eqData = globalThis.state.utils.getEquipment(equipId);
                  }
                } catch (e) {
          console.warn('[Cyclopedia] Error in creature ownership check:', e);
        }

                let portrait = api.ui.components.createItemPortrait({
                  itemId: eqData?.metadata?.spriteId,
                  stat: stat,
                  tier: tier
                });

                if (portrait.tagName === 'BUTTON' && portrait.firstChild) {
                  portrait = portrait.firstChild;
                }

                Object.assign(portrait.style, { margin: '0', display: 'block' });
                tierRow.appendChild(portrait);

                const countLabel = document.createElement('span');
                countLabel.className = count === 0 ? FONT_CONSTANTS.SIZES.TINY : FONT_CONSTANTS.SIZES.SMALL;
                countLabel.textContent = `x${count}`;

                if (count === 0) {
                  Object.assign(countLabel.style, { color: '#888', opacity: '0.7' });
                } else {
                  countLabel.style.color = COLOR_CONSTANTS.TEXT;
                }

                tierRow.appendChild(countLabel);
                col.appendChild(tierRow);
              }

              grid.appendChild(col);
            });

            ownedEquipCol.appendChild(grid);
          }
        }
      }

      const allEquipment = GAME_DATA.ALL_EQUIPMENT;

      const createEquipmentBox = ({ title, items }) => {
        return createBox({
          title, items, type: 'equipment', selectedCreature, selectedEquipment, selectedInventory,
          setSelectedCreature, setSelectedEquipment, setSelectedInventory, updateRightCol: () => {
            if (d.updateRightCol) {
              d.updateRightCol();
            }
          }
        });
      };

      const leftCol = document.createElement('div');
      Object.assign(leftCol.style, {
        width: LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH, minWidth: LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH,
        maxWidth: LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH, height: '100%', display: 'flex',
        flexDirection: 'column', borderRight: '6px solid transparent',
        borderImage: `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`,
        overflowY: 'hidden', minHeight: '0'
      });

      const { searchContainer: equipmentSearchContainer, searchInput: equipmentSearchInput, filterBtn: equipmentFilterBtn } = createCyclopediaSearchBar('Search equipment...');
      let equipmentFilterMode = 'name';

      const getEquipmentUsageSnapshot = () => {
        const byGameId = new Map();
        const byName = new Map();
        let total = 0;
        try {
          const playerContext = globalThis.state?.player?.getSnapshot?.().context;
          const equips = Array.isArray(playerContext?.equips) ? playerContext.equips : [];
          const boardConfigs = playerContext?.boardConfigs && typeof playerContext.boardConfigs === 'object'
            ? playerContext.boardConfigs
            : {};
          const equipLookup = new Map(equips.map((e) => [e.id, e.gameId]));
          const equipGameIdSet = new Set(equips.map((e) => e.gameId));
          Object.values(boardConfigs).forEach((cfgs) => {
            if (!Array.isArray(cfgs)) return;
            cfgs.forEach((cfg) => {
              const gid = resolveConfigEquipmentGameId(cfg, equipLookup, equipGameIdSet);
              if (gid == null) return;
              byGameId.set(gid, (byGameId.get(gid) || 0) + 1);
              total++;
            });
          });
          byGameId.forEach((count, gameId) => {
            try {
              const equipData = globalThis.state?.utils?.getEquipment?.(gameId);
              const name = String(equipData?.metadata?.name || '').trim().toLowerCase();
              if (!name) return;
              byName.set(name, (byName.get(name) || 0) + count);
            } catch (e) {
              // Ignore invalid ids from partial payloads
            }
          });
        } catch (e) {
          console.warn('[Cyclopedia] Failed building equipment usage map:', e);
        }
        return { byGameId, byName, total };
      };

      const getEquipmentUsageCountByName = (equipmentName, usageSnapshot) => {
        const normalized = String(equipmentName || '').trim().toLowerCase();
        if (!normalized) return 0;
        if (usageSnapshot?.byName?.has(normalized)) {
          return usageSnapshot.byName.get(normalized) || 0;
        }
        const maps = window.BestiaryModAPI?.utility?.maps;
        const gid = maps?.equipmentNamesToGameIds?.get(normalized);
        if (gid == null) return 0;
        return usageSnapshot?.byGameId?.get(gid) || 0;
      };

      const equipmentBox = createEquipmentBox({
        title: 'Equipment',
        items: allEquipment
      });
      const equipmentTitle = equipmentBox.querySelector('h2.widget-top');
      if (equipmentTitle && equipmentTitle.parentNode) {
        equipmentTitle.insertAdjacentElement('afterend', equipmentSearchContainer);
      } else {
        equipmentBox.prepend(equipmentSearchContainer);
      }

      const equipmentUsageSnapshot = getEquipmentUsageSnapshot();

      function buildEquipmentRowMeta(box, usageSnapshot) {
        const rows = Array.from(box.querySelectorAll('div.pixel-font-16'))
          .filter((el) => !!el.querySelector('span'));
        return rows.map((row, idx) => {
          if (!row.dataset.originalOrder) {
            row.dataset.originalOrder = String(idx);
          }
          const span = row.querySelector('span');
          if (span && !span.dataset.baseLabel) {
            span.dataset.baseLabel = (span.textContent || '').trim();
          }
          const label = (span?.dataset.baseLabel || span?.textContent || row.textContent || '').trim();
          return {
            row,
            idx,
            span,
            label,
            labelNorm: label.toLowerCase(),
            usageCount: getEquipmentUsageCountByName(label, usageSnapshot)
          };
        });
      }

      let equipmentRowMetaCache = null;

      function filterEquipmentBoxItems(searchTerm, mode = 'name') {
        const q = (searchTerm || '').toLowerCase();
        if (!equipmentRowMetaCache) {
          equipmentRowMetaCache = buildEquipmentRowMeta(equipmentBox, equipmentUsageSnapshot);
        }
        const rowMeta = equipmentRowMetaCache;

        const listGrid = equipmentBox.querySelector('div[data-nopadding="true"]');
        if (mode === 'usage' && listGrid) {
          rowMeta
            .slice()
            .sort((a, b) => {
              if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
              return a.labelNorm.localeCompare(b.labelNorm);
            })
            .forEach((m) => listGrid.appendChild(m.row));
        } else if (mode === 'name' && listGrid) {
          rowMeta
            .slice()
            .sort((a, b) => Number(a.row.dataset.originalOrder) - Number(b.row.dataset.originalOrder))
            .forEach((m) => listGrid.appendChild(m.row));
        }

        let visibleCount = 0;
        rowMeta.forEach((meta) => {
          if (meta.span) {
            const pct = equipmentUsageSnapshot.total > 0 ? Math.floor((meta.usageCount / equipmentUsageSnapshot.total) * 100) : 0;
            meta.span.textContent = mode === 'usage' ? `${pct}% ${meta.label}` : meta.label;
          }
          const nameMatch = !q || meta.labelNorm.includes(q);
          const usageMatch = true;
          const isVisible = nameMatch && usageMatch;
          meta.row.style.display = isVisible ? '' : 'none';
          if (isVisible) visibleCount++;
        });
        return visibleCount;
      }

      const noResultsEquipment = createNoResultsMessage('No results in Equipment');
      mountNoResultsInsideList(equipmentBox, noResultsEquipment);

      const applyEquipmentSearch = debounce(() => {
        const searchTerm = (equipmentSearchInput.value || '').trim();
        const visibleCount = filterEquipmentBoxItems(searchTerm, equipmentFilterMode);
        noResultsEquipment.style.display = searchTerm && visibleCount === 0 ? 'block' : 'none';
      }, 150);
      equipmentSearchInput.addEventListener('input', applyEquipmentSearch);
      equipmentFilterBtn.addEventListener('click', () => {
        equipmentFilterMode = equipmentFilterMode === 'name' ? 'usage' : 'name';
        equipmentFilterBtn.textContent = equipmentFilterMode === 'name' ? 'Name' : 'Usage';
        applyEquipmentSearch();
      });

      leftCol.appendChild(equipmentBox);

      d.appendChild(leftCol);
      d.appendChild(equipDetailsCol);
      d.appendChild(ownedEquipCol);
      
      // Store the updateRightCol function on the returned element so it can be called externally
      d.updateRightCol = updateRightCol;
      
      updateRightCol();
      return d;
    }

    // Helper functions for creating Characters tab components
    function createCharactersTabColumns() {
      const col1 = DOMUtils.createElement('div');
      Object.assign(col1.style, {
        width: LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH, minWidth: LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH,
        maxWidth: LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH, height: '100%', display: 'flex',
        flexDirection: 'column', borderRight: '6px solid transparent',
        borderImage: `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`,
        overflowY: 'hidden', minHeight: '0'
      });

      const sharedScrollContainer = DOMUtils.createElement('div');
      sharedScrollContainer.style.cssText = `
        flex: 1 1 0; display: flex; flex-direction: row; height: 100%; overflow-y: auto;
        min-width: 0;
      `;

      const col2 = DOMUtils.createElement('div');
      Object.assign(col2.style, {
        flex: '1 1 0', minWidth: '0', maxWidth: '50%', height: '100%', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        borderRight: '6px solid transparent',
        borderImage: `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`
      });
      col2.className = 'pixel-font-16 text-whiteHighlight';

      const col3 = DOMUtils.createElement('div');
      Object.assign(col3.style, {
        flex: '1 1 0', minWidth: '0', maxWidth: '50%', height: '100%', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
      });
      col3.className = 'pixel-font-16 text-whiteHighlight';

      sharedScrollContainer.appendChild(col2);
      sharedScrollContainer.appendChild(col3);

      return { col1, col2, col3, sharedScrollContainer };
    }

    function createPlayerSearchBox(selectedCreature, selectedEquipment, selectedInventory, setSelectedCreature, setSelectedEquipment, setSelectedInventory) {
      const playerSearchBox = createBox({
        title: 'Player search', items: [], type: 'inventory', selectedCreature, selectedEquipment, selectedInventory,
        setSelectedCreature, setSelectedEquipment, setSelectedInventory, updateRightCol: () => {}
      });
      Object.assign(playerSearchBox.style, { flex: '0.2 1 0', minHeight: '0' });
      return playerSearchBox;
    }

    function createCharactersTabPage(selectedCreature, selectedEquipment, selectedInventory, setSelectedCreature, setSelectedEquipment, setSelectedInventory, updateRightCol) {
      const d = DOMUtils.createElement('div');
      Object.assign(d.style, {
        display: 'flex', flexDirection: 'row', width: '100%', height: '100%',
        alignItems: 'flex-start', justifyContent: 'center', gap: '0'
      });

      const { col1, col2, col3, sharedScrollContainer } = createCharactersTabColumns();
      const charactersColFrameBorder = {
        borderRight: '6px solid transparent',
        borderImage: `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`
      };

      function applyCharactersSplitColumnLayout() {
        col3.style.display = 'flex';
        col2.style.flex = '1 1 0';
        col2.style.maxWidth = '50%';
        col2.style.borderRight = charactersColFrameBorder.borderRight;
        col2.style.borderImage = charactersColFrameBorder.borderImage;
        col2.style.justifyContent = 'center';
        col2.style.alignItems = 'center';
        col2.style.overflow = '';
        col2.style.minHeight = '';
      }

      function applyCharactersRankingsColumnLayout() {
        col3.style.display = 'none';
        col2.style.flex = '1 1 0';
        col2.style.maxWidth = '100%';
        col2.style.borderRight = 'none';
        col2.style.borderImage = 'none';
        col2.style.justifyContent = 'flex-start';
        col2.style.alignItems = 'stretch';
        col2.style.overflow = 'hidden';
        col2.style.minHeight = '0';
      }

      const playerSearchBox = createPlayerSearchBox(selectedCreature, selectedEquipment, selectedInventory, setSelectedCreature, setSelectedEquipment, setSelectedInventory);

      function showLoadingState(col2) {
        col2.innerHTML = renderCyclopediaProfileLoadingHtml();
      }

      function showErrorState(col2, message) {
        col2.innerHTML = renderCyclopediaProfileErrorHtml(message, { showConnectionHint: true });
      }

      function createUserStatsContainer(profileData) {
        const container = DOMUtils.createElement('div');
        Object.assign(container.style, {
          display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
          padding: '20px', boxSizing: 'border-box', overflowY: 'hidden'
        });

        const patched = patchProfileDataForActiveSeason(profileData, cyclopediaState.profileSeason || 1);
        const userInfoContent = renderCyclopediaPlayerInfo(patched, { showShinyCreatures: false });
        const centeredContent = DOMUtils.createElement('div');
        Object.assign(centeredContent.style, {
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%', height: '100%'
        });
        
        centeredContent.appendChild(userInfoContent);
        container.appendChild(centeredContent);
        return container;
      }

      let currentUserStatsRequest = null;

      async function displayUserStats(selectedCategory) {
        // Request management helper
        const createRequest = () => {
          if (currentUserStatsRequest?.category === selectedCategory) {
            currentUserStatsRequest.cancel = true;
          }
          const requestId = Date.now();
          currentUserStatsRequest = { category: selectedCategory, cancel: false, id: requestId };
          return requestId;
        };

        const isCancelled = (requestId) => currentUserStatsRequest?.cancel || currentUserStatsRequest?.id !== requestId;

        try {
          const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
          if (!playerState?.name) {
            col2.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">User data not available</div>';
            return;
          }

          const requestId = createRequest();
          if (selectedCategory !== 'Rankings') {
            const rankingsPrefetchOptions = {
              season: cyclopediaState.profileSeason ?? 2,
              qualified: true,
              limit: START_PAGE_CONFIG.RANKINGS_PAGE_SIZE,
              offset: 0,
              sort: 'level',
              order: 'desc'
            };
            fetchRankingsFromApi(rankingsPrefetchOptions).catch(() => {});
          }
          if (selectedCategory !== 'Rankings') {
            showLoadingState(col2);
          }

          if (selectedCategory !== 'Rankings') {
            cyclopediaState.refreshRankingsTable = null;
          }

          // Handle special categories
          if (selectedCategory === 'Speedrun' || selectedCategory === 'Rank Points') {
            await displaySpeedrunOrRankData(selectedCategory, playerState);
            return;
          }
          
          if (selectedCategory === 'Leaderboards') {
            await displayCombinedLeaderboardsData(playerState);
            return;
          }

          if (selectedCategory === 'Rankings') {
            await displayRankingsData(playerState);
            return;
          }

          if (isCancelled(requestId)) return;

          // Validate player name
          if (!playerState.name.trim()) {
            col2.innerHTML = `<div style="color: #ff6b6b; text-align: center; padding: 20px;">Invalid player name</div>`;
            return;
          }

          // Get or fetch profile data
          let profileData = getCachedProfileData(playerState.name);
          
          if (!profileData?.name) {
            const apiUrl = `${START_PAGE_CONFIG.API_BASE_URL}?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(playerState.name)}%22%7D%7D`;
            const data = await fetchWithDeduplication(apiUrl, `profile-${playerState.name}`, 1);
            
            if (isCancelled(requestId)) return;
            
            profileData = Array.isArray(data) && data[0]?.result?.data?.json 
              ? data[0].result.data.json : data;
            
            if (profileData?.name) {
            setCachedProfileData(playerState.name, profileData);
            }
          }

          if (isCancelled(requestId)) return;

          if (profileData?.name) {
            cyclopediaState.lastStartupProfileData = unwrapProfilePageJson(profileData);
            refreshLeaderboardCacheYourRoomsForSeason();
          }

          // Update UI
          const container = createUserStatsContainer(profileData);
          col2.innerHTML = '';
          col2.appendChild(container);
          
          if (currentUserStatsRequest?.id === requestId) {
            currentUserStatsRequest = null;
          }
        } catch (error) {
          console.error('[Cyclopedia] Error displaying user stats:', error);
          
          col2.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.TEXT}; text-align: center; padding: 20px;">
              <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
              <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load Stats</div>
              <div style="font-size: 14px; margin-bottom: 16px; color: #888;">Click to retry</div>
              <button onclick="displayUserStats('${selectedCategory}')" style="background: #ffe066; color: #232323; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">Retry</button>
            </div>
          `;
        }
      }

      async function fetchTRPC(method) {
        try {
          if (cyclopediaState.pendingRequests.has(method)) return await cyclopediaState.pendingRequests.get(method);

          const inp = encodeURIComponent(JSON.stringify({ 0: { json: null, meta: { values: ["undefined"] } } }));
          const url = `/api/trpc/${method}?batch=1&input=${inp}`;
          
          const requestPromise = fetch(url, {
            headers: { 'Accept': '*/*', 'Content-Type': 'application/json', 'X-Game-Version': '1' }
          }).then(async (res) => {
            if (!res.ok) throw new Error(`${method} → ${res.status}`);
            const json = await res.json();
            return json[0].result.data.json;
          }).finally(() => cyclopediaState.pendingRequests.delete(method));

          cyclopediaState.pendingRequests.set(method, requestPromise);
          return await requestPromise;
        } catch (error) {
          console.error('Error fetching from TRPC:', error);
          throw error;
        }
      }

      async function fetchRankingsFromApi(options = {}) {
        const seasonNum = Number(options.season);
        const effectiveSeason = Number.isFinite(seasonNum) && seasonNum >= 0 ? seasonNum : 2;
        const qualified = options.qualified !== false;
        const limit = Number(options.limit) || START_PAGE_CONFIG.RANKINGS_PAGE_SIZE;
        const offset = Number(options.offset) || 0;
        const sort = options.sort || 'level';
        const order = options.order === 'asc' ? 'asc' : 'desc';

        const queryOptions = { season: effectiveSeason, qualified, limit, offset, sort, order };
        const listCacheKey = getRankingsListCacheKey(queryOptions);

        const cachedPage = getCachedRankingsData(queryOptions);
        if (cachedPage) return cachedPage;

        const cachedList = cyclopediaState.getLeaderboardData(listCacheKey);
        if (cachedList?.data?.rankings) {
          const normalized = normalizeRankingsApiResponse(cachedList.data, queryOptions);
          setCachedRankingsData(queryOptions, normalized);
          return { ...normalized, season: effectiveSeason, sort, order };
        }

        if (qualified) {
          const fullListLimit = Math.max(limit, START_PAGE_CONFIG.RANKINGS_PREFETCH_LIMIT || 500);
          const fullListParams = new URLSearchParams();
          fullListParams.set('season', String(effectiveSeason));
          fullListParams.set('qualified', 'true');
          fullListParams.set('limit', String(fullListLimit));
          fullListParams.set('offset', '0');
          fullListParams.set('sort', sort);
          fullListParams.set('order', order);

          const fullListUrl = `${START_PAGE_CONFIG.RANKINGS_API_URL}?${fullListParams}`;
          const fullListData = await fetchWithDeduplication(
            fullListUrl,
            `rankings-fetch-full-s${effectiveSeason}-${sort}-${order}`,
            1
          );

          if (!fullListData || !Array.isArray(fullListData.rankings)) {
            throw new Error('Invalid response format from rankings API');
          }

          const fullListTotal = Number(fullListData.total);
          if (Number.isFinite(fullListTotal) && fullListTotal > 0 && fullListData.rankings.length >= fullListTotal) {
            cyclopediaState.setLeaderboardData(listCacheKey, {
              data: { rankings: fullListData.rankings, timestamp: fullListData.timestamp || null },
              timestamp: Date.now()
            });
            const normalizedFromList = applyClientRankingsQuery(fullListData.rankings, {
              sort,
              order,
              limit,
              offset,
              timestamp: fullListData.timestamp || null
            });
            setCachedRankingsData(queryOptions, normalizedFromList);
            return {
              ...normalizedFromList,
              season: effectiveSeason,
              sort,
              order
            };
          }
        }

        const params = new URLSearchParams();
        params.set('season', String(effectiveSeason));
        params.set('qualified', String(qualified));
        params.set('limit', String(limit));
        params.set('offset', String(offset));
        params.set('sort', sort);
        params.set('order', order);

        const apiUrl = `${START_PAGE_CONFIG.RANKINGS_API_URL}?${params}`;
        const data = await fetchWithDeduplication(
          apiUrl,
          `rankings-fetch-${getRankingsCacheKey(queryOptions)}`,
          1
        );

        if (!data || !Array.isArray(data.rankings)) {
          throw new Error('Invalid response format from rankings API');
        }

        const normalized = normalizeRankingsApiResponse(data, queryOptions);
        if (!normalized.serverPaginated) {
          cyclopediaState.setLeaderboardData(listCacheKey, {
            data: { rankings: data.rankings, timestamp: data.timestamp || null },
            timestamp: Date.now()
          });
        }
        setCachedRankingsData(queryOptions, normalized);

        return {
          ...normalized,
          season: effectiveSeason,
          sort,
          order
        };
      }

// =======================
// 11. API Call Optimization
// =======================

const RATE_LIMIT_CONFIG = {
  maxRequests: 30, timeWindow: 10000, requests: [], backoffMultiplier: 1.5,
  maxBackoff: 60000, currentBackoff: 0
};

function checkRateLimit() {
  const now = Date.now();
  
  if (RATE_LIMIT_CONFIG.currentBackoff > 0) {
    if (now < RATE_LIMIT_CONFIG.currentBackoff) {
      const waitTime = Math.ceil((RATE_LIMIT_CONFIG.currentBackoff - now) / 1000);
      throw new Error(`Rate limit backoff active. Please wait ${waitTime} seconds.`);
    }
    RATE_LIMIT_CONFIG.currentBackoff = 0;
  }
  
  RATE_LIMIT_CONFIG.requests = RATE_LIMIT_CONFIG.requests.filter(
    timestamp => now - timestamp < RATE_LIMIT_CONFIG.timeWindow
  );
  
  if (RATE_LIMIT_CONFIG.requests.length >= RATE_LIMIT_CONFIG.maxRequests) {
    const oldestRequest = RATE_LIMIT_CONFIG.requests[0];
    const waitTime = Math.ceil((RATE_LIMIT_CONFIG.timeWindow - (now - oldestRequest)) / 1000);
    
    RATE_LIMIT_CONFIG.currentBackoff = now + Math.min(
      RATE_LIMIT_CONFIG.currentBackoff * RATE_LIMIT_CONFIG.backoffMultiplier,
      RATE_LIMIT_CONFIG.maxBackoff
    );
    
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds.`);
  }
  
  RATE_LIMIT_CONFIG.requests.push(now);
}

const RequestQueue = {
  pending: new Map(), queue: [], processing: false,
  
  add: function(key, requestPromise, priority = 0) {
    if (this.pending.has(key)) return this.pending.get(key);
    
    this.queue.push({ key, requestPromise, priority, timestamp: Date.now() });
    this.queue.sort((a, b) => b.priority - a.priority);
    this.pending.set(key, requestPromise);
    
    if (!this.processing) this.process();
    return requestPromise;
  },
  
  process: async function() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      
      try {
        await item.requestPromise;
      } catch (error) {
        console.error(`[Cyclopedia] Request failed for ${item.key}:`, error);
      } finally {
        this.pending.delete(item.key);
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    this.processing = false;
  },
  
  getStatus: function() {
    return { pending: this.pending.size, queued: this.queue.length, processing: this.processing };
  }
};

async function fetchWithDeduplication(url, key, priority = 0) {
  try {
    checkRateLimit();
    
    if (cyclopediaState.pendingRequests.has(key)) return await cyclopediaState.pendingRequests.get(key);
    
    const requestPromise = fetch(url, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      timeout: 10000
    }).then(async (res) => {
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      return await res.json();
    }).catch(error => {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server');
      }
      throw error;
    }).finally(() => cyclopediaState.pendingRequests.delete(key));

    cyclopediaState.pendingRequests.set(key, requestPromise);
    return await RequestQueue.add(key, requestPromise, priority);
  } catch (error) {
    console.error(`[Cyclopedia] Error in fetchWithDeduplication for ${key}:`, error);
    throw error;
  }
}

      async function displaySpeedrunOrRankData(category, playerState) {
        try {
          const ROOM_NAMES = globalThis.state.utils.ROOM_NAME;
          const roomsScoped = getYourRoomsForCyclopediaSeason(playerState.rooms || {});
          const you = playerState.userId;

          let best, lbs, roomsHighscores;
          
          const cachedData = getCachedLeaderboardData('speedrun-rank');
          if (cachedData) {
            ({ best, lbs, roomsHighscores } = cachedData);
          } else {
            [best, lbs, roomsHighscores] = await Promise.all([
              fetchTRPC('game.getTickHighscores'),
              fetchTRPC('game.getTickLeaderboards'),
              fetchTRPC('game.getRoomsHighscores')
            ]);
            
            setCachedLeaderboardData('speedrun-rank', { best, lbs, roomsHighscores });
          }

          displayUserSpeedrunOrRankData(category, playerState.name, roomsScoped, ROOM_NAMES, best, roomsHighscores, col2);
          updateSearchForSpeedrunOrRank(category, playerState.rooms || {}, ROOM_NAMES, best, roomsHighscores);

        } catch (error) {
          console.error('[Cyclopedia] Error displaying speedrun/rank data:', error);
          col2.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;"><div style="font-size: 48px; margin-bottom: 16px;">⚠️</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load ${category} Data</div><div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not fetch game data</div><div style="font-size: 12px; color: #666;">Please check your internet connection and try again.</div></div>`;
        }
      }

      async function displayCombinedLeaderboardsData(playerState) {
        try {
          const ROOM_NAMES = globalThis.state.utils.ROOM_NAME;
          const roomsScoped = getYourRoomsForCyclopediaSeason(playerState.rooms || {});
          const you = playerState.userId;

          let best, lbs, roomsHighscores;
          
          const cachedData = getCachedLeaderboardData('combined-leaderboards');
          if (cachedData) {
            ({ best, lbs, roomsHighscores } = cachedData);
          } else {
            [best, lbs, roomsHighscores] = await Promise.all([
              fetchTRPC('game.getTickHighscores'),
              fetchTRPC('game.getTickLeaderboards'),
              fetchTRPC('game.getRoomsHighscores')
            ]);
            
            setCachedLeaderboardData('combined-leaderboards', { best, lbs, roomsHighscores });
          }

          displayUserCombinedLeaderboardsData(playerState.name, roomsScoped, ROOM_NAMES, best, roomsHighscores, col2);
          updateSearchForCombinedLeaderboards(playerState.rooms || {}, ROOM_NAMES, best, roomsHighscores);

        } catch (error) {
          console.error('[Cyclopedia] Error displaying combined leaderboards data:', error);
          col2.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;"><div style="font-size: 48px; margin-bottom: 16px;">⚠️</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load Leaderboards Data</div><div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not fetch game data</div><div style="font-size: 12px; color: #666;">Please check your internet connection and try again.</div></div>`;
        }
      }

      async function displayRankingsData(playerState) {
        applyCharactersRankingsColumnLayout();
        try {
          const activeSeason = cyclopediaState.profileSeason ?? 2;
          const rankingsState = cyclopediaState.rankingsState?.season === activeSeason
            ? cyclopediaState.rankingsState
            : {
                season: activeSeason,
                sort: 'level',
                order: 'desc',
                offset: 0,
                limit: START_PAGE_CONFIG.RANKINGS_PAGE_SIZE,
                qualified: true
              };
          cyclopediaState.rankingsState = rankingsState;
          const initialQueryOptions = {
            season: activeSeason,
            qualified: rankingsState.qualified,
            limit: rankingsState.limit,
            offset: rankingsState.offset,
            sort: rankingsState.sort,
            order: rankingsState.order
          };
          const initialQueryCacheKey = getRankingsCacheKey(initialQueryOptions);
          let initialRankingsPromise = getCachedRankingsData(initialQueryOptions)
            ? null
            : fetchRankingsFromApi(initialQueryOptions);

          let currentRankings = [];
          let rankingsTotal = 0;
          let rankingsTimestamp = null;
          let isLoadingRankings = false;

          const rankingsPanelFrame = 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill';
          const rankingsSectionFrame = 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch';
          const rankingsCellFrame = 'url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 4 fill';
          const rankingsGridColumns = '48px 150px 53px 53px 40px 48px 40px 40px 40px 40px 40px 40px 40px';

          const containerDiv = document.createElement('div');
          Object.assign(containerDiv.style, {
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            minHeight: '0', padding: '10px 0', boxSizing: 'border-box'
          });

          const contentContainer = document.createElement('div');
          contentContainer.style.cssText = `
            flex: 1;
            min-height: 0;
            padding: 0;
            overflow: hidden;
            position: relative;
            background: rgba(20, 20, 20, 0.7);
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
          `;

          const tableContainer = document.createElement('div');
          tableContainer.className = FONT_CONSTANTS.SIZES.SMALL;
          tableContainer.style.cssText = `
            background: rgba(34, 34, 34, 0.9);
            border: 6px solid transparent;
            border-image: ${rankingsPanelFrame};
            border-radius: 6px;
            box-shadow: 0 0 15px rgba(0, 0, 0, 0.45);
            overflow: hidden;
            font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
            font-size: 10px;
            position: relative;
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
            width: fit-content;
            max-width: 100%;
            min-width: fit-content;
            margin: 0 auto;
          `;

          const headerRow = document.createElement('div');
          headerRow.style.cssText = `
            display: grid;
            grid-template-columns: ${rankingsGridColumns};
            gap: 1px;
            background: rgba(255, 224, 102, 0.08);
            border-bottom: 6px solid transparent;
            border-image: ${rankingsSectionFrame};
            flex-shrink: 0;
            width: fit-content;
          `;

          const headerData = [
            { type: 'text', content: 'Rank', key: 'rank', sortable: false },
            { type: 'text', content: 'Player', key: 'name', sortable: true },
            { type: 'text', content: 'Level', key: 'level', sortable: true },
            { type: 'icon', src: '/assets/icons/match-count.png', alt: 'Total runs', key: 'successfulRuns', sortable: true },
            { type: 'icon', src: '/assets/icons/star-tier.png', alt: 'Rank points', key: 'rankPoints', sortable: true },
            { type: 'icon', src: '/assets/icons/speed.png', alt: 'Time sum', key: 'timeSum', sortable: true },
            { type: 'icon', src: 'https://bestiaryarena.com/assets/UI/floor-15.png', alt: 'Floors', key: 'floors', sortable: true },
            { type: 'icon', src: '/assets/icons/shell-count.png', alt: 'Daily seashell', key: 'dailySeashell', sortable: true },
            { type: 'icon', src: '/assets/icons/task-count.png', alt: 'Hunting tasks', key: 'huntingTasks', sortable: true },
            { type: 'icon', src: 'https://bestiaryarena.com/assets/icons/raid.png', alt: 'Raids', key: 'raids', sortable: true },
            { type: 'icon', src: '/assets/icons/enemy.png', alt: 'Perfect creatures', key: 'perfectCreatures', sortable: true },
            { type: 'icon', src: '/assets/icons/equips.png', alt: 'BIS equipments', key: 'bisEquipment', sortable: true },
            { type: 'icon', src: '/assets/icons/mini-outfitbag.png', alt: 'Bag outfits', key: 'bagOutfits', sortable: true }
          ];

          const scrollableContainer = document.createElement('div');
          scrollableContainer.style.cssText = `
            overflow: auto;
            flex: 1;
            min-height: 0;
            display: block;
            box-sizing: border-box;
          `;

          const dataRowsContainer = document.createElement('div');
          dataRowsContainer.style.cssText = `
            display: grid;
            grid-template-columns: ${rankingsGridColumns};
            gap: 1px;
            min-height: fit-content;
            width: fit-content;
            padding-bottom: 8px;
            box-sizing: border-box;
          `;
          const baseRankingsCellStyle = `
            padding: 6px 4px;
            color: #fff;
            border-right: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
            font-size: 10px;
          `;
          const escapeRankingsText = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => {
            if (char === '&') return '&amp;';
            if (char === '<') return '&lt;';
            if (char === '>') return '&gt;';
            if (char === '"') return '&quot;';
            return '&#39;';
          });

          dataRowsContainer.addEventListener('click', (event) => {
            const playerCell = event.target?.closest?.('[data-rankings-player]');
            if (!playerCell) return;
            const encodedName = playerCell.getAttribute('data-rankings-player');
            if (!encodedName) return;
            NavigationHandler.navigateToProfile(decodeURIComponent(encodedName));
          });
          dataRowsContainer.addEventListener('mouseover', (event) => {
            const playerCell = event.target?.closest?.('[data-rankings-player]');
            if (!playerCell || !dataRowsContainer.contains(playerCell)) return;
            const fromNode = event.relatedTarget;
            if (fromNode && playerCell.contains(fromNode)) return;
            playerCell.style.color = '#fff';
          });
          dataRowsContainer.addEventListener('mouseout', (event) => {
            const playerCell = event.target?.closest?.('[data-rankings-player]');
            if (!playerCell || !dataRowsContainer.contains(playerCell)) return;
            const toNode = event.relatedTarget;
            if (toNode && playerCell.contains(toNode)) return;
            playerCell.style.color = COLOR_CONSTANTS.PRIMARY;
          });

          const paginationBar = document.createElement('div');
          paginationBar.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 8px 10px;
            border-top: 1px solid rgba(255, 224, 102, 0.25);
            background: rgba(0, 0, 0, 0.25);
            font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
            font-size: 11px;
            color: #ccc;
            flex-shrink: 0;
          `;

          const paginationInfo = document.createElement('span');
          const prevPageBtn = document.createElement('button');
          prevPageBtn.textContent = '◀ Prev';
          prevPageBtn.style.cssText = `
            background: rgba(255, 224, 102, 0.15);
            color: ${COLOR_CONSTANTS.PRIMARY};
            border: 1px solid rgba(255, 224, 102, 0.35);
            padding: 4px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-family: inherit;
            font-size: 11px;
          `;
          const nextPageBtn = document.createElement('button');
          nextPageBtn.textContent = 'Next ▶';
          nextPageBtn.style.cssText = prevPageBtn.style.cssText;

          const paginationControls = document.createElement('div');
          paginationControls.style.cssText = 'display: flex; align-items: center; gap: 6px;';
          paginationControls.appendChild(prevPageBtn);
          paginationControls.appendChild(nextPageBtn);

          paginationBar.appendChild(paginationInfo);
          paginationBar.appendChild(paginationControls);

          const tooltip = document.createElement('div');
          tooltip.style.cssText = `
            position: absolute;
            top: 100%;
            right: 0;
            width: 280px;
            background: rgba(35, 35, 35, 0.95);
            border: 6px solid transparent;
            border-image: ${rankingsSectionFrame};
            border-radius: 8px;
            padding: 12px;
            color: #fff;
            font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            opacity: 0;
            visibility: hidden;
            transition: all 0.2s ease;
            z-index: 30;
            backdrop-filter: blur(4px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          `;

          function getRankingsQueryOptions() {
            return {
              season: activeSeason,
              qualified: rankingsState.qualified,
              limit: rankingsState.limit,
              offset: rankingsState.offset,
              sort: rankingsState.sort,
              order: rankingsState.order
            };
          }

          function updateTooltipContent() {
            const formattedTimestamp = rankingsTimestamp
              ? new Date(rankingsTimestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
              : null;
            tooltip.innerHTML = `
              <div style="font-size: 16px; margin-bottom: 8px; color: ${COLOR_CONSTANTS.PRIMARY}; font-weight: bold;">📊 Data Source</div>
              <div style="margin-bottom: 6px;">Rankings fetched from <a href="https://bestiary-arena-ranking.vercel.app/api/v1/rankings" target="_blank" style="color: #ffe066; text-decoration: underline;">Bestiary Arena Rankings API</a></div>
              <div style="margin-bottom: 6px; font-size: 11px; color: #ccc;">${getCyclopediaRankingsSectionLabel(activeSeason)} — qualified players (≥${CYCLOPEDIA_SETTINGS.playerStatCaps.exploredMaps} maps), sorted by ${rankingsState.sort} (${rankingsState.order})</div>
              <div style="font-size: 10px; color: #888;">${formattedTimestamp ? `Updated: ${formattedTimestamp}` : 'No timestamp available'}</div>
            `;
          }

          function updatePaginationControls() {
            const total = rankingsTotal;
            const limit = rankingsState.limit;
            const offset = rankingsState.offset;
            const start = total === 0 ? 0 : offset + 1;
            const end = Math.min(offset + currentRankings.length, total);
            paginationInfo.textContent = total === 0
              ? 'No results'
              : `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`;

            const atFirstPage = offset <= 0;
            const atLastPage = offset + limit >= total || currentRankings.length === 0;
            prevPageBtn.disabled = atFirstPage || isLoadingRankings;
            nextPageBtn.disabled = atLastPage || isLoadingRankings;
            prevPageBtn.style.opacity = prevPageBtn.disabled ? '0.45' : '1';
            nextPageBtn.style.opacity = nextPageBtn.disabled ? '0.45' : '1';
            prevPageBtn.style.cursor = prevPageBtn.disabled ? 'default' : 'pointer';
            nextPageBtn.style.cursor = nextPageBtn.disabled ? 'default' : 'pointer';
          }

          function renderRankingsLoadingRows() {
            dataRowsContainer.innerHTML = '';
            const loadingCell = document.createElement('div');
            loadingCell.style.cssText = `
              grid-column: 1 / -1;
              padding: 24px;
              text-align: center;
              color: #888;
              font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
              font-size: 12px;
            `;
            loadingCell.textContent = 'Loading rankings...';
            dataRowsContainer.appendChild(loadingCell);
          }

          function renderRankingsTable() {
            dataRowsContainer.innerHTML = '';
            if (currentRankings.length === 0) {
              const emptyCell = document.createElement('div');
              emptyCell.style.cssText = `
                grid-column: 1 / -1;
                padding: 24px;
                text-align: center;
                color: #888;
                font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
                font-size: 12px;
              `;
              emptyCell.textContent = isLoadingRankings ? 'Loading rankings...' : 'No rankings available';
              dataRowsContainer.appendChild(emptyCell);
              return;
            }

            const rowsHtml = currentRankings.map((ranking, index) => {
              const isCurrentPlayer = ranking.name.toLowerCase() === playerState.name.toLowerCase();
              const isSearchedPlayer = cyclopediaState.searchedUsername && ranking.name.toLowerCase() === cyclopediaState.searchedUsername.toLowerCase();

              let rowBackground;
              if (isSearchedPlayer) {
                rowBackground = 'rgba(66, 165, 245, 0.22)';
              } else if (isCurrentPlayer) {
                rowBackground = 'rgba(67, 160, 71, 0.22)';
              } else {
                rowBackground = index % 2 === 0 ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.045)';
              }
              const rowBorder = isCurrentPlayer || isSearchedPlayer ? '1px solid rgba(255, 224, 102, 0.45)' : '1px solid rgba(255, 255, 255, 0.06)';

              const displayRank = ranking.rank ?? (rankingsState.offset + index + 1);
              let rankIcon = '🥉';
              if (displayRank === 1) rankIcon = '🥇';
              else if (displayRank === 2) rankIcon = '🥈';
              else if (displayRank <= 10) rankIcon = '🏅';

              const cellData = [
                `${rankIcon} #${displayRank}`,
                ranking.name,
                ranking.level.toLocaleString(),
                ranking.successfulRuns.toLocaleString(),
                ranking.rankPoints.toLocaleString(),
                ranking.timeSum.toLocaleString(),
                (ranking.floors !== undefined ? ranking.floors.toLocaleString() : '0'),
                ranking.dailySeashell.toLocaleString(),
                ranking.huntingTasks.toLocaleString(),
                ranking.raids.toLocaleString(),
                ranking.perfectCreatures.toLocaleString(),
                ranking.bisEquipment.toLocaleString(),
                ranking.bagOutfits.toLocaleString()
              ];

              return cellData.map((text, cellIndex) => {
                const isPlayerCell = cellIndex === 1;
                const textAlign = (cellIndex === 0 || isPlayerCell) ? 'left' : 'center';
                const justifyContent = (cellIndex === 0 || isPlayerCell) ? 'flex-start' : 'center';
                const playerAttrs = isPlayerCell
                  ? ` data-rankings-player="${encodeURIComponent(ranking.name)}" title="${escapeRankingsText(ranking.name)}"`
                  : '';
                const playerStyle = isPlayerCell
                  ? `cursor:pointer;text-decoration:underline;color:${COLOR_CONSTANTS.PRIMARY};transition:color 0.15s ease;`
                  : '';
                return `<div class="${FONT_CONSTANTS.SIZES.SMALL}"${playerAttrs} style="${baseRankingsCellStyle}background:${rowBackground};font-weight:${isCurrentPlayer || isSearchedPlayer ? 'bold' : 'normal'};text-align:${textAlign};justify-content:${justifyContent};border:${rowBorder};${playerStyle}">${escapeRankingsText(text)}</div>`;
              }).join('');
            }).join('');
            dataRowsContainer.innerHTML = rowsHtml;
          }

          function updateHeaderHighlighting() {
            const headerCells = headerRow.querySelectorAll('div');
            headerCells.forEach((cell, index) => {
              const item = headerData[index];
              if (!item) return;

              cell.style.background = 'transparent';
              cell.style.border = 'none';

              const existingIndicator = cell.querySelector('span');
              if (existingIndicator) {
                existingIndicator.remove();
              }

              if (item.key === rankingsState.sort) {
                cell.style.background = 'rgba(255, 224, 102, 0.2)';

                const sortIndicator = document.createElement('span');
                sortIndicator.textContent = rankingsState.order === 'desc' ? ' ▼' : ' ▲';
                sortIndicator.style.cssText = `
                  margin-left: 4px;
                  font-size: 8px;
                  color: ${COLOR_CONSTANTS.PRIMARY};
                `;
                cell.appendChild(sortIndicator);
              }
            });
          }

          async function loadRankings() {
            if (isLoadingRankings) return;
            isLoadingRankings = true;
            renderRankingsLoadingRows();
            updatePaginationControls();

            const queryOptions = getRankingsQueryOptions();
            const queryCacheKey = getRankingsCacheKey(queryOptions);

            try {
              let rankingsData = getCachedRankingsData(queryOptions);
              if (!rankingsData) {
                if (initialRankingsPromise && queryCacheKey === initialQueryCacheKey) {
                  rankingsData = await initialRankingsPromise;
                  initialRankingsPromise = null;
                } else {
                  rankingsData = await fetchRankingsFromApi(queryOptions);
                }
                setCachedRankingsData(queryOptions, rankingsData);
              }

              currentRankings = rankingsData.rankings || [];
              rankingsTotal = rankingsData.total ?? currentRankings.length;
              rankingsTimestamp = rankingsData.timestamp || null;
              rankingsState.offset = rankingsData.offset ?? rankingsState.offset;

              renderRankingsTable();
              scrollableContainer.scrollTop = 0;
              updateHeaderHighlighting();
              updatePaginationControls();
              updateTooltipContent();
            } catch (error) {
              console.error('[Cyclopedia] Error loading rankings page:', error);
              dataRowsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: ${COLOR_CONSTANTS.ERROR}; font-size: 12px;">
                  Failed to load rankings. Please try again.
                </div>
              `;
              rankingsTotal = 0;
              updatePaginationControls();
            } finally {
              isLoadingRankings = false;
              updatePaginationControls();
            }
          }

          headerData.forEach((item) => {
            const headerCell = document.createElement('div');
            headerCell.className = FONT_CONSTANTS.SIZES.SMALL;
            headerCell.style.cssText = `
              padding: 8px 4px;
              color: ${COLOR_CONSTANTS.PRIMARY};
              font-weight: bold;
              text-align: center;
              border: 4px solid transparent;
              border-image: ${rankingsCellFrame};
              background: rgba(0, 0, 0, 0.2);
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
              font-size: 10px;
              ${item.sortable ? 'cursor: pointer;' : 'cursor: default;'}
              transition: all 0.2s ease;
            `;

            if (item.key === rankingsState.sort) {
              headerCell.style.background = 'rgba(255, 224, 102, 0.2)';
            }

            if (item.type === 'icon') {
              const icon = document.createElement('img');
              icon.src = item.src;
              icon.alt = item.alt;
              icon.title = item.alt;
              icon.style.cssText = `
                width: 16px;
                height: 16px;
                object-fit: contain;
              `;
              headerCell.appendChild(icon);
            } else {
              headerCell.textContent = item.content;
            }

            if (item.key === rankingsState.sort) {
              const sortIndicator = document.createElement('span');
              sortIndicator.textContent = rankingsState.order === 'desc' ? ' ▼' : ' ▲';
              sortIndicator.style.cssText = `
                margin-left: 4px;
                font-size: 8px;
                color: ${COLOR_CONSTANTS.PRIMARY};
              `;
              headerCell.appendChild(sortIndicator);
            }

            if (item.sortable) {
              headerCell.addEventListener('click', () => {
                const sortKey = item.key;
                if (sortKey === rankingsState.sort) {
                  rankingsState.order = rankingsState.order === 'desc' ? 'asc' : 'desc';
                } else {
                  rankingsState.sort = sortKey;
                  rankingsState.order = 'desc';
                }
                rankingsState.offset = 0;
                loadRankings();
              });

              headerCell.addEventListener('mouseenter', () => {
                if (item.key !== rankingsState.sort) {
                  headerCell.style.background = 'rgba(255, 224, 102, 0.1)';
                }
              });

              headerCell.addEventListener('mouseleave', () => {
                if (item.key !== rankingsState.sort) {
                  headerCell.style.background = 'transparent';
                }
              });
            }

            headerRow.appendChild(headerCell);
          });

          prevPageBtn.addEventListener('click', () => {
            if (prevPageBtn.disabled) return;
            rankingsState.offset = Math.max(0, rankingsState.offset - rankingsState.limit);
            loadRankings();
          });

          nextPageBtn.addEventListener('click', () => {
            if (nextPageBtn.disabled) return;
            rankingsState.offset += rankingsState.limit;
            loadRankings();
          });

          tableContainer.appendChild(headerRow);
          scrollableContainer.appendChild(dataRowsContainer);
          tableContainer.appendChild(scrollableContainer);
          tableContainer.appendChild(paginationBar);

          renderRankingsLoadingRows();
          contentContainer.appendChild(tableContainer);
          containerDiv.appendChild(contentContainer);
          col2.innerHTML = '';
          col2.appendChild(containerDiv);

          cyclopediaState.refreshRankingsTable = () => {
            renderRankingsTable();
            updateHeaderHighlighting();
          };

          const infoContainer = document.createElement('div');
          infoContainer.style.cssText = `
            position: absolute;
            top: 8px;
            right: -3px;
            z-index: 20;
          `;

          const infoIcon = document.createElement('div');
          infoIcon.innerHTML = 'ℹ️';
          infoIcon.style.cssText = `
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
            color: ${COLOR_CONSTANTS.PRIMARY};
          `;

          let isTooltipPersistent = false;

          infoIcon.addEventListener('mouseenter', () => {
            if (!isTooltipPersistent) {
              tooltip.style.opacity = '1';
              tooltip.style.visibility = 'visible';
              infoIcon.style.color = '#fff';
            }
          });

          infoIcon.addEventListener('mouseleave', () => {
            if (!isTooltipPersistent) {
              tooltip.style.opacity = '0';
              tooltip.style.visibility = 'hidden';
              infoIcon.style.color = COLOR_CONSTANTS.PRIMARY;
            }
          });

          infoIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            isTooltipPersistent = !isTooltipPersistent;
            if (isTooltipPersistent) {
              tooltip.style.opacity = '1';
              tooltip.style.visibility = 'visible';
              infoIcon.style.color = '#fff';
            } else {
              tooltip.style.opacity = '0';
              tooltip.style.visibility = 'hidden';
              infoIcon.style.color = COLOR_CONSTANTS.PRIMARY;
            }
          });

          document.addEventListener('click', (e) => {
            if (isTooltipPersistent && !infoContainer.contains(e.target)) {
              isTooltipPersistent = false;
              tooltip.style.opacity = '0';
              tooltip.style.visibility = 'hidden';
              infoIcon.style.color = COLOR_CONSTANTS.PRIMARY;
            }
          });

          infoContainer.appendChild(infoIcon);
          infoContainer.appendChild(tooltip);
          tableContainer.appendChild(infoContainer);

          await loadRankings();

        } catch (error) {
          console.error('[Cyclopedia] Error displaying rankings data:', error);
          col2.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;"><div style="font-size: 48px; margin-bottom: 16px;">⚠️</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load Rankings</div><div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not fetch rankings from server</div><div style="font-size: 12px; color: #666;">Please check your internet connection and try again.</div></div>`;
        }
      }

      function displayUserSpeedrunOrRankData(category, playerName, rooms, ROOM_NAMES, best, roomsHighscores, container, isTemplate = false) {
        const formatTime = formatCyclopediaMilliseconds;
        const containerDiv = document.createElement('div');
        Object.assign(containerDiv.style, {
          display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
          padding: '20px', boxSizing: 'border-box'
        });

        const header = document.createElement('div');
        header.style.cssText = `font-size: 18px; font-weight: bold; color: ${COLOR_CONSTANTS.PRIMARY}; margin-bottom: 20px; text-align: center; padding: 10px; background: rgba(255, 224, 102, 0.1); border-radius: 8px;`;
        header.textContent = isTemplate ? 'Search Results' : `Your ${category} Data`;
        containerDiv.appendChild(header);

        // Add local runs section for non-template displays
        if (!isTemplate) {
          const localRunsSection = document.createElement('div');
          localRunsSection.style.cssText = 'margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px; border-left: 3px solid #ffe066;';
          
          const localTitle = document.createElement('h4');
          localTitle.textContent = 'Your Local Runs';
          localTitle.style.cssText = 'margin: 0 0 10px 0; color: #ffe066; font-size: 14px;';
          localRunsSection.appendChild(localTitle);
          
          // Get local runs for current map (if available)
          const mapName = selectedMap ? (globalThis.state?.utils?.ROOM_NAME?.[selectedMap] || selectedMap) : null;
          const currentMapKey = mapName ? `map_${mapName.toLowerCase().replace(/\s+/g, '_')}` : null;
          if (currentMapKey) {
            getLocalRunsForMap(currentMapKey, category).then(localRuns => {
              if (localRuns && localRuns.length > 0) {
                const localTable = document.createElement('table');
                localTable.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 12px;';
                
                // Header
                const headerRow = document.createElement('tr');
                headerRow.innerHTML = `
                  <th style="text-align: left; padding: 4px; color: #ffe066;">Rank</th>
                  <th style="text-align: left; padding: 4px; color: #ffe066;">${category === 'speedrun' ? 'Time' : 'Points'}</th>
                  <th style="text-align: left; padding: 4px; color: #ffe066;">Date</th>
                `;
                localTable.appendChild(headerRow);
                
                // Local runs
                localRuns.slice(0, 5).forEach((run, index) => {
                  const row = document.createElement('tr');
                  const value = category === 'speedrun' ? formatLocalRunTime(run.time) : run.points;
                  row.innerHTML = `
                    <td style="padding: 4px; color: #fff;">${index + 1}</td>
                    <td style="padding: 4px; color: #fff; font-weight: bold;">${value}</td>
                    <td style="padding: 4px; color: #ccc;">${run.date}</td>
                  `;
                  localTable.appendChild(row);
                });
                
                // Fill remaining slots with dashes if less than 5 runs
                for (let i = localRuns.length; i < 5; i++) {
                  const row = document.createElement('tr');
                  row.innerHTML = `
                    <td style="padding: 4px; color: #888;">${i + 1}</td>
                    <td style="padding: 4px; color: #888;">-</td>
                    <td style="padding: 4px; color: #888;">-</td>
                  `;
                  localTable.appendChild(row);
                }
                
                localRunsSection.appendChild(localTable);
              } else {
                // Create table with dashes for all 5 slots
                const localTable = document.createElement('table');
                localTable.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 12px;';
                
                // Header
                const headerRow = document.createElement('tr');
                headerRow.innerHTML = `
                  <th style="text-align: left; padding: 4px; color: #ffe066;">Rank</th>
                  <th style="text-align: left; padding: 4px; color: #ffe066;">${category === 'speedrun' ? 'Time' : 'Points'}</th>
                  <th style="text-align: left; padding: 4px; color: #ffe066;">Date</th>
                `;
                localTable.appendChild(headerRow);
                
                // Empty slots with dashes
                for (let i = 0; i < 5; i++) {
                  const row = document.createElement('tr');
                  row.innerHTML = `
                    <td style="padding: 4px; color: #888;">${i + 1}</td>
                    <td style="padding: 4px; color: #888;">-</td>
                    <td style="padding: 4px; color: #888;">-</td>
                  `;
                  localTable.appendChild(row);
                }
                
                localRunsSection.appendChild(localTable);
              }
            });
          } else {
            const noMapText = document.createElement('p');
            noMapText.textContent = 'Select a map to view your local runs.';
            noMapText.style.cssText = 'margin: 0; color: #888; font-size: 12px;';
            localRunsSection.appendChild(noMapText);
          }
          
          containerDiv.appendChild(localRunsSection);
        }

        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `flex: 1; padding: 10px;`;

        if (isTemplate) {
          const organizedRooms = {
            'Rookgaard': [
              { roomCode: 'rookgaard', roomName: 'Rookgaard' },
              { roomCode: 'sewers', roomName: 'Sewers' },
              { roomCode: 'wheatfield', roomName: 'Wheat Field' },
              { roomCode: 'evergreen', roomName: 'Evergreen Fields' },
              { roomCode: 'wolfsden', roomName: 'Wolf\'s Den' },
              { roomCode: 'honeyflower', roomName: 'Honeyflower Tower' }
            ]
          };

          Object.entries(organizedRooms).forEach(([regionName, regionRooms]) => {
            const regionHeader = document.createElement('div');
            regionHeader.style.cssText = `font-size: 14px; font-weight: bold; color: ${COLOR_CONSTANTS.PRIMARY}; margin: 8px 0 4px 0; padding: 4px 6px; background: rgba(255, 224, 102, 0.15); border-radius: 4px; border-left: 3px solid ${COLOR_CONSTANTS.PRIMARY};`;
            regionHeader.textContent = regionName;
            contentContainer.appendChild(regionHeader);

            regionRooms.forEach(({ roomCode, roomName }) => {
              const roomEntry = document.createElement('div');
              roomEntry.style.cssText = `margin-bottom: 12px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);`;

              const roomHeader = document.createElement('div');
              roomHeader.style.cssText = `display: flex; align-items: center; gap: 10px; margin-bottom: 8px;`;

              const thumbnail = RoomThumbnailCache.createThumbnail(roomCode, roomName, 32);

              const roomTitle = document.createElement('div');
              roomTitle.style.cssText = `font-weight: bold; color: ${COLOR_CONSTANTS.TEXT}; font-size: 14px;`;
              roomTitle.textContent = roomName;

              roomHeader.appendChild(thumbnail);
              roomHeader.appendChild(roomTitle);
              roomEntry.appendChild(roomHeader);

              const dataRow = document.createElement('div');
              dataRow.style.cssText = `display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #ccc;`;

              const yourData = document.createElement('div');
              yourData.innerHTML = `<div style="color: #8f8; font-weight: bold;">You:</div><div style="color: #888;">[ticks] ticks</div>`;

              const bestData = document.createElement('div');
              bestData.innerHTML = `<div style="color: #ff8; font-weight: bold;">Best:</div><div style="color: #888;">[ticks] ticks</div><div style="font-size: 10px; color: #888;">by [Player]</div>`;

              dataRow.appendChild(yourData);
              dataRow.appendChild(bestData);
              roomEntry.appendChild(dataRow);

              contentContainer.appendChild(roomEntry);
            });
          });

          const searchInstruction = document.createElement('div');
          searchInstruction.style.cssText = `text-align: center; padding: 20px; color: ${COLOR_CONSTANTS.WARNING}; font-size: 14px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); margin-top: 16px;`;
          searchInstruction.innerHTML = `<div style="font-size: 24px; margin-bottom: 8px;">🔍</div><div style="font-weight: bold; margin-bottom: 4px;">Search for a Player</div><div style="color: #888;">Use the search box to compare leaderboard data</div>`;
          contentContainer.appendChild(searchInstruction);
        } else {
          const allRoomCodes = Object.keys(ROOM_NAMES).sort();

          allRoomCodes.forEach(roomCode => {
            const roomName = ROOM_NAMES[roomCode];
            const yourRoom = rooms[roomCode];

            if (!yourRoom) return;

            const roomEntry = document.createElement('div');
            roomEntry.style.cssText = `margin-bottom: 12px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);`;

            const roomHeader = document.createElement('div');
            roomHeader.style.cssText = `display: flex; align-items: center; gap: 10px; margin-bottom: 8px;`;

            const thumbnail = RoomThumbnailCache.createThumbnail(roomCode, roomName, 32);

            const roomTitle = document.createElement('div');
            roomTitle.style.cssText = `font-weight: bold; color: ${COLOR_CONSTANTS.TEXT}; font-size: 14px;`;
            roomTitle.textContent = roomName;

            roomHeader.appendChild(thumbnail);
            roomHeader.appendChild(roomTitle);
            roomEntry.appendChild(roomHeader);

            if (category === 'Speedrun') {
              const yourTicks = yourRoom.ticks || 0;
              const bestTicks = best[roomCode]?.ticks || 0;
              const bestPlayer = best[roomCode]?.userName || 'Unknown';
              
              const dataRow = document.createElement('div');
              dataRow.style.cssText = `display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #ccc;`;

              const yourData = document.createElement('div');
              yourData.innerHTML = `<div style="color: #8f8; font-weight: bold;">You:</div><div>${yourTicks} ticks</div>`;

              const bestData = document.createElement('div');
              bestData.innerHTML = `<div style="color: #ff8; font-weight: bold;">Best:</div><div>${bestTicks} ticks</div><div style="font-size: 10px; color: #888;">by ${bestPlayer}</div>`;

              dataRow.appendChild(yourData);
              dataRow.appendChild(bestData);
              roomEntry.appendChild(dataRow);

            } else if (category === 'Rank Points') {
              const yourRank = yourRoom.rank || 0;
              const topRank = roomsHighscores?.rank?.[roomCode]?.rank || 0;
              const topPlayer = roomsHighscores?.rank?.[roomCode]?.userName || 'Unknown';

              const dataRow = document.createElement('div');
              dataRow.style.cssText = `display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #ccc;`;

              const yourData = document.createElement('div');
              yourData.innerHTML = `<div style="color: #8f8; font-weight: bold;">You:</div><div>${yourRank} points</div>`;

              const topData = document.createElement('div');
              topData.innerHTML = `<div style="color: #ff8; font-weight: bold;">Top:</div><div>${topRank} points</div><div style="font-size: 10px; color: #888;">by ${topPlayer}</div>`;

              dataRow.appendChild(yourData);
              dataRow.appendChild(topData);
              roomEntry.appendChild(dataRow);

            } else if (category === 'Floors') {
              const { floor: yourFloor, floorTicks: yourFloorTicks } = normalizeUserFloorData(yourRoom);
              const { floor: bestFloor, floorTicks: bestFloorTicks, playerName: bestFloorPlayer } = normalizeBestFloorData(roomCode, roomsHighscores, best);

              const dataRow = document.createElement('div');
              dataRow.style.cssText = `display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #ccc;`;

              const yourData = document.createElement('div');
              yourData.innerHTML = `<div style="color: #8f8; font-weight: bold;">You:</div><div>Floor ${yourFloor !== undefined && yourFloor !== null ? yourFloor : '-'}${yourFloorTicks !== undefined && yourFloorTicks !== null ? ` <i style="color: #aaa;">(${yourFloorTicks} ticks)</i>` : ''}</div>`;

              const bestData = document.createElement('div');
              bestData.innerHTML = `<div style="color: #ff8; font-weight: bold;">Best:</div><div>Floor ${bestFloor !== undefined && bestFloor !== null ? bestFloor : '-'}${bestFloorTicks !== undefined && bestFloorTicks !== null ? ` <i style="color: #aaa;">(${bestFloorTicks} ticks)</i>` : ''}</div><div style="font-size: 10px; color: #888;">by ${bestFloorPlayer}</div>`;

              dataRow.appendChild(yourData);
              dataRow.appendChild(bestData);
              roomEntry.appendChild(dataRow);
            }

            contentContainer.appendChild(roomEntry);
          });
        }

        containerDiv.appendChild(contentContainer);

        container.innerHTML = '';
        container.appendChild(containerDiv);
      }

      function updateSearchForSpeedrunOrRank(category, yourRooms, ROOM_NAMES, best, roomsHighscores) {
        window.currentSpeedrunRankCategory = category;
        window.currentSpeedrunRankData = { yourRooms: getYourRoomsForCyclopediaSeason(yourRooms), ROOM_NAMES, best, roomsHighscores };
      }

      function updateSearchForCombinedLeaderboards(yourRooms, ROOM_NAMES, best, roomsHighscores) {
        window.currentSpeedrunRankCategory = 'Combined';
        window.currentSpeedrunRankData = { yourRooms: getYourRoomsForCyclopediaSeason(yourRooms), ROOM_NAMES, best, roomsHighscores };
        
        col3.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.TEXT}; text-align: center; padding: 20px;"><div style="font-size: 24px; margin-bottom: 16px;">🔍</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Search Results</div><div style="font-size: 14px; color: #888; margin-bottom: 16px;">Use the search box above to compare leaderboard data</div><div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 16px; margin-top: 16px; border: 1px solid rgba(255, 255, 255, 0.1);"><div style="font-size: 14px; font-weight: bold; color: ${COLOR_CONSTANTS.PRIMARY}; margin-bottom: 8px;">How to use:</div><div style="font-size: 12px; color: #ccc; text-align: left; line-height: 1.4;">• Enter a player name in the search box<br>• View their leaderboard data compared to yours</div></div></div>`;
      }

      function showPlayerProfileTemplate(container) {
        const containerDiv = document.createElement('div');
        Object.assign(containerDiv.style, {
          display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
          padding: '20px', boxSizing: 'border-box'
        });

        const centeredContent = document.createElement('div');
        Object.assign(centeredContent.style, {
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%', height: '100%'
        });

        const profileContainer = document.createElement('div');
        Object.assign(profileContainer.style, {
          display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '400px'
        });

        const playerInfoSection = DOMUtils.createSection();

        const playerInfoHeader = DOMUtils.createStyledElement('div', {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          fontSize: '16px',
          fontWeight: 'bold',
          color: COLOR_CONSTANTS.PRIMARY
        }, '', '');
        playerInfoHeader.innerHTML = `<span>📄</span><span>Player information</span>`;
        playerInfoSection.appendChild(playerInfoHeader);

        const playerName = DOMUtils.createStyledElement('div', {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
          fontSize: '14px',
          color: '#ccc'
        }, '', '');
        playerName.innerHTML = `<span style="color: #4CAF50;">🛡️</span><span style="color: #888;">[Player Name]</span>`;
        playerInfoSection.appendChild(playerName);

        const level = DOMUtils.createStyledElement('div', {
          marginBottom: '8px',
          fontSize: '14px',
          color: '#ccc'
        }, '', '');
        level.innerHTML = `<span>Level</span><div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;"><div style="flex: 1; height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px;"><div style="width: 50%; height: 100%; background: #FFD700; border-radius: 4px;"></div></div><span style="color: #888;">[Level]</span></div>`;
        playerInfoSection.appendChild(level);

        const createdAt = DOMUtils.createStyledElement('div', {
          marginBottom: '8px',
          fontSize: '14px',
          color: '#ccc'
        }, '', '');
        createdAt.innerHTML = `
          <span>Created at</span>
          <div style="color: #888; margin-top: 2px;">[Date]</div>
        `;
        playerInfoSection.appendChild(createdAt);

        const status = DOMUtils.createStyledElement('div', {
          marginBottom: '8px',
          fontSize: '14px',
          color: '#ccc'
        }, '', '');
        status.innerHTML = `
          <span>Status</span>
          <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
            <span style="color: #888;">[Status]</span>
            <span style="color: #FFD700;">🔥</span>
          </div>
        `;
        playerInfoSection.appendChild(status);

        const loyaltyPoints = DOMUtils.createStyledElement('div', {
          fontSize: '14px',
          color: '#ccc'
        }, '', '');
        loyaltyPoints.innerHTML = `
          <span>Loyalty Points</span>
          <div style="color: #888; margin-top: 2px;">[Points]</div>
        `;
        playerInfoSection.appendChild(loyaltyPoints);

        profileContainer.appendChild(playerInfoSection);

        const playerStatsSection = DOMUtils.createSection();

        const playerStatsHeader = DOMUtils.createStyledElement('div', {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          fontSize: '16px',
          fontWeight: 'bold',
          color: COLOR_CONSTANTS.PRIMARY
        }, '', '');
        playerStatsHeader.innerHTML = `
          <span>📊</span>
          <span>Player stats</span>
        `;
        playerStatsSection.appendChild(playerStatsHeader);

        const currentTotal = DOMUtils.createStyledElement('div', {
          marginBottom: '12px'
        }, '', '');
        currentTotal.innerHTML = `
          <div style="font-size: 14px; font-weight: bold; color: #ccc; margin-bottom: 8px;">Current total</div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #ccc;">
              <span style="color: #FF9800;">🐚</span>
              <span>Daily Seashell</span>
              <span style="color: #888;">[Count]x</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #ccc;">
              <span style="color: #8BC34A;">🎯</span>
              <span>Hunting tasks</span>
              <span style="color: #888;">[Count]x</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #ccc;">
              <span style="color: #2196F3;">🔄</span>
              <span>Total runs</span>
              <span style="color: #888;">[Count]x</span>
            </div>
          </div>
        `;
        playerStatsSection.appendChild(currentTotal);

        const progress = document.createElement('div');
        progress.style.cssText = `
          margin-bottom: 12px;
        `;
        progress.innerHTML = `
          <div style="font-size: 14px; font-weight: bold; color: #ccc; margin-bottom: 8px;">Progress</div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #ccc;">
              <span style="color: #4CAF50;">✅</span>
              <span>Perfect Creatures</span>
              <span style="color: #888;">[Progress]</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #ccc;">
              <span style="color: #4CAF50;">✅</span>
              <span>BIS Equipments</span>
              <span style="color: #888;">[Progress]</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #ccc;">
              <span style="color: #4CAF50;">✅</span>
              <span>Explored maps</span>
              <span style="color: #888;">[Progress]</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #ccc;">
              <span style="color: #4CAF50;">✅</span>
              <span>Bag Outfits</span>
              <span style="color: #888;">[Progress]</span>
            </div>
          </div>
        `;
        playerStatsSection.appendChild(progress);

        const rankings = document.createElement('div');
        rankings.innerHTML = `
          <div style="font-size: 14px; font-weight: bold; color: #ccc; margin-bottom: 8px;">Rankings</div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #ccc;">
              <span style="color: #FFD700;">⭐</span>
              <span>Rank points</span>
              <span style="color: #888;">[Points]</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #ccc;">
              <span style="color: #FFD700;">⏱️</span>
              <span>Time sum</span>
              <span style="color: #888;">[Time]</span>
            </div>
          </div>
        `;
        playerStatsSection.appendChild(rankings);

        profileContainer.appendChild(playerStatsSection);

        const searchInstruction = document.createElement('div');
        searchInstruction.style.cssText = `
          text-align: center;
          padding: 20px;
          color: ${COLOR_CONSTANTS.WARNING};
          font-size: 14px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        `;
        searchInstruction.innerHTML = `
          <div style="font-size: 24px; margin-bottom: 8px;">🔍</div>
          <div style="font-weight: bold; margin-bottom: 4px;">Search for a Player</div>
          <div style="color: #888;">Use the search box to compare profiles</div>
        `;
        profileContainer.appendChild(searchInstruction);

        centeredContent.appendChild(profileContainer);
        containerDiv.appendChild(centeredContent);

        container.innerHTML = '';
        container.appendChild(containerDiv);
      }

      function organizeRoomsByRegion(rooms, ROOM_NAMES) {
        const regions = globalThis.state.utils.REGIONS;
        const roomsData = globalThis.state.utils.ROOMS;
        
        if (!regions || !roomsData) {
          return {
            'All Maps': Object.keys(ROOM_NAMES)
              .filter(roomCode => rooms[roomCode])
              .sort()
              .map(roomCode => ({ roomCode, roomName: ROOM_NAMES[roomCode] }))
          };
        }

        const organizedRooms = {};
        
        regions.forEach(region => {
          if (!region.rooms || !Array.isArray(region.rooms)) return;
          
          const regionRooms = [];
          
          region.rooms.forEach(room => {
            const roomCode = room.id;
            if (rooms[roomCode] && ROOM_NAMES[roomCode]) {
              regionRooms.push({
                roomCode,
                roomName: ROOM_NAMES[roomCode]
              });
            }
          });
          
          if (regionRooms.length > 0) {
            const regionName = getRealRegionName(region);
            organizedRooms[regionName] = regionRooms;
          }
        });
        
        const allRoomCodes = Object.keys(ROOM_NAMES);
        const processedRoomCodes = new Set();
        
        Object.values(organizedRooms).forEach(regionRooms => {
          regionRooms.forEach(room => processedRoomCodes.add(room.roomCode));
        });
        
        const remainingRooms = allRoomCodes
          .filter(roomCode => rooms[roomCode] && !processedRoomCodes.has(roomCode))
          .sort()
          .map(roomCode => ({ roomCode, roomName: ROOM_NAMES[roomCode] }));
        
        if (remainingRooms.length > 0) {
          organizedRooms['Other Maps'] = remainingRooms;
        }
        
        return organizedRooms;
      }

      function getRealRegionName(region) {
        if (!region) return 'Unknown Region';
        if (typeof mapsDbRef.getRegionDisplayNameFromRegion === 'function') {
          return mapsDbRef.getRegionDisplayNameFromRegion(region);
        }
        if (region.name) return region.name;
        return cyclopediaGetRegionDisplayName(region.id);
      }

      // Helper function to create allRooms object from ROOM_NAMES
      function createAllRoomsObject(ROOM_NAMES) {
        const allRooms = {};
        Object.keys(ROOM_NAMES).forEach(roomCode => {
          allRooms[roomCode] = true;
        });
        return allRooms;
      }

      // Helper function to create completion count element
      function createCompletionCountElement(count) {
        const defeatCount = document.createElement('div');
        const actualCount = count || 0;
        defeatCount.style.cssText = `
          font-size: 10px;
          color: ${actualCount === 0 ? '#ff4444' : '#aaa'};
          text-align: center;
          width: 100%;
          margin-top: 2px;
        `;
        const formattedCount = actualCount >= 1000 ? `${(actualCount / 1000).toFixed(1)}k` : actualCount;
        defeatCount.textContent = `${formattedCount} completions`;
        return defeatCount;
      }

      // Helper function to create map column (icon + name + completion count)
      function createMapColumn(roomCode, roomName, completionCount) {
        const mapColumn = document.createElement('div');
        mapColumn.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          width: 80px;
          min-width: 80px;
          max-width: 80px;
        `;

        const mapIcon = document.createElement('div');
        mapIcon.style.cssText = `
          width: 32px;
          height: 32px;
          border-radius: 4px;
          overflow: hidden;
        `;
        const thumbnail = RoomThumbnailCache.createThumbnail(roomCode, roomName, 32);
        thumbnail.style.width = '100%';
        thumbnail.style.height = '100%';
        mapIcon.appendChild(thumbnail);

        const mapName = document.createElement('div');
        mapName.style.cssText = `
          font-size: 12px;
          font-weight: bold;
          color: ${COLOR_CONSTANTS.PRIMARY};
          text-align: center;
          width: 100%;
          word-wrap: break-word;
        `;
        mapName.textContent = roomName;

        mapColumn.appendChild(mapIcon);
        mapColumn.appendChild(mapName);
        mapColumn.appendChild(createCompletionCountElement(completionCount));

        return mapColumn;
      }

      function displayUserCombinedLeaderboardsData(playerName, rooms, ROOM_NAMES, best, roomsHighscores, container) {
        const formatTime = formatCyclopediaMilliseconds;

        const containerDiv = document.createElement('div');
        Object.assign(containerDiv.style, {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '8px',
          boxSizing: 'border-box',
          minWidth: '0',
          maxWidth: '100%'
        });

        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `
          flex: 1;
          padding: 2px;
          min-width: 0;
          max-width: 100%;
        `;

        // Organize rooms by region (show all maps)
        const organizedRooms = organizeRoomsByRegion(createAllRoomsObject(ROOM_NAMES), ROOM_NAMES);

        Object.entries(organizedRooms).forEach(([regionName, regionRooms]) => {
          const regionHeader = DOMUtils.createTitle(`${regionName} (${regionRooms.length} maps)`, FONT_CONSTANTS.SIZES.SMALL);
          Object.assign(regionHeader.style, {
            margin: '8px 0 4px 0',
            width: '100%',
            position: 'sticky',
            top: '0',
            zIndex: '10',
            backgroundColor: '#232323'
          });
          contentContainer.appendChild(regionHeader);

          regionRooms.forEach(({ roomCode, roomName }) => {
            const yourRoom = rooms[roomCode];

          const roomEntry = document.createElement('div');
          roomEntry.style.cssText = `
            display: grid;
            grid-template-columns: 80px 1fr;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
            padding: 6px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            min-width: 0;
            max-width: 100%;
          `;

          // Column 1: Map Icon + Map Name + Completion Count
          const mapColumn = createMapColumn(roomCode, roomName, yourRoom?.count);

          const dataColumn = document.createElement('div');
          dataColumn.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 4px;
            width: 100%;
            min-width: 0;
            max-width: 100%;
          `;

          const speedrunRow = document.createElement('div');
          const isSpeedrunTop = yourRoom?.ticks && best?.[roomCode]?.ticks && yourRoom?.ticks === best[roomCode].ticks;
          speedrunRow.style.cssText = `
            display: grid;
            grid-template-columns: 120px 120px;
            align-items: center;
            gap: 6px;
            padding: 4px;
            background: ${isSpeedrunTop ? 'url("https://bestiaryarena.com/_next/static/media/background-green.be515334.png")' : 'rgba(255, 255, 255, 0.03)'};
            border-radius: 3px;
            border-left: 3px solid #4CAF50;
            min-width: 0;
            max-width: 100%;
          `;

          const yourTicks = yourRoom?.ticks || 0;
          const topTicks = best?.[roomCode]?.ticks || 0;
          const topPlayer = best?.[roomCode]?.userName || 'Unknown';

          const yourSpeedrun = document.createElement('div');
          yourSpeedrun.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #ccc;
            width: 120px;
            font-weight: ${isSpeedrunTop ? 'bold' : 'normal'};
          `;
          yourSpeedrun.innerHTML = `
            <span style="color: #8f8; font-weight: bold;">You:</span>
            <span>${yourTicks} ticks</span>
          `;

          const topSpeedrun = document.createElement('div');
          topSpeedrun.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #ccc;
            width: 120px;
            font-weight: ${isSpeedrunTop ? 'bold' : 'normal'};
          `;
          topSpeedrun.innerHTML = `
            <span style="color: #ff8; font-weight: bold;">Top:</span>
            <span>${topTicks} ticks</span>
          `;

          speedrunRow.appendChild(yourSpeedrun);
          speedrunRow.appendChild(topSpeedrun);

          const yourRank = yourRoom?.rank || 0;
          const yourRankTicks = yourRoom?.rankTicks;
          const topRank = roomsHighscores?.rank?.[roomCode]?.rank || 0;
          const topRankTicks = roomsHighscores?.rank?.[roomCode]?.ticks;
          const topRankPlayer = roomsHighscores?.rank?.[roomCode]?.userName || 'Unknown';

          const isRankTop = yourRank && topRank && yourRank === topRank && 
            (yourRankTicks === topRankTicks || 
             ((yourRankTicks === undefined || yourRankTicks === null) && (topRankTicks === undefined || topRankTicks === null)));

          const rankRow = document.createElement('div');
          rankRow.style.cssText = `
            display: grid;
            grid-template-columns: 120px 120px;
            align-items: center;
            min-width: 0;
            max-width: 100%;
            gap: 6px;
            padding: 4px;
            background: ${isRankTop ? 'url("https://bestiaryarena.com/_next/static/media/background-green.be515334.png")' : 'rgba(255, 255, 255, 0.03)'};
            border-radius: 3px;
            border-left: 3px solid #FF9800;
          `;

          const yourRankData = document.createElement('div');
          yourRankData.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #ccc;
            width: 120px;
            font-weight: ${isRankTop ? 'bold' : 'normal'};
          `;
          yourRankData.innerHTML = `
            <span style="color: #8f8; font-weight: bold;">You:</span>
            <span style="white-space: nowrap;"><img src="https://bestiaryarena.com/assets/icons/star-tier.png" alt="Rank" style="width: 9px; height: 10px; vertical-align: middle; margin-right: 2px; display: inline-block;">${yourRank}${yourRankTicks !== undefined && yourRankTicks !== null ? ` <i style="color: #aaa;">(${yourRankTicks})</i>` : ' (null)'}</span>
          `;

          const topRankData = document.createElement('div');
          topRankData.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #ccc;
            width: 120px;
            font-weight: ${isRankTop ? 'bold' : 'normal'};
          `;
          topRankData.innerHTML = `
            <span style="color: #ff8; font-weight: bold;">Top:</span>
            <span style="white-space: nowrap;"><img src="https://bestiaryarena.com/assets/icons/star-tier.png" alt="Rank" style="width: 9px; height: 10px; vertical-align: middle; margin-right: 2px; display: inline-block;">${topRank}${topRankTicks !== undefined && topRankTicks !== null ? ` <i style="color: #aaa;">(${topRankTicks})</i>` : ' (null)'}</span>
          `;

          rankRow.appendChild(yourRankData);
          rankRow.appendChild(topRankData);

          // Floor row
          const { floor: yourFloor, floorTicks: yourFloorTicks } = normalizeUserFloorData(yourRoom);
          const { floor: bestFloor, floorTicks: bestFloorTicks, playerName: bestFloorPlayer } = normalizeBestFloorData(roomCode, roomsHighscores, best);

          const isFloorTop = yourFloor !== null && bestFloor !== null && yourFloor === bestFloor &&
            (yourFloorTicks === bestFloorTicks ||
             ((yourFloorTicks === undefined || yourFloorTicks === null) && (bestFloorTicks === undefined || bestFloorTicks === null)));

          const floorRow = document.createElement('div');
          floorRow.style.cssText = `
            display: grid;
            grid-template-columns: 120px 120px;
            align-items: center;
            min-width: 0;
            max-width: 100%;
            gap: 6px;
            padding: 4px;
            background: ${isFloorTop ? 'url("https://bestiaryarena.com/_next/static/media/background-green.be515334.png")' : 'rgba(255, 255, 255, 0.03)'};
            border-radius: 3px;
            border-left: 3px solid #9C27B0;
          `;

          const yourFloorData = document.createElement('div');
          yourFloorData.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #ccc;
            width: 120px;
            font-weight: ${isFloorTop ? 'bold' : 'normal'};
          `;
          yourFloorData.innerHTML = `
            <span style="color: #8f8; font-weight: bold;">You:</span>
            <span style="white-space: nowrap;"><img src="https://bestiaryarena.com/assets/UI/floor-15.png" alt="Floor" style="width: 14px; height: 7px; vertical-align: middle; margin-right: 2px; display: inline-block;">${yourFloor !== null && yourFloor >= 0 ? yourFloor : '-'}${yourFloorTicks !== undefined && yourFloorTicks !== null ? ` <i style="color: #aaa;">(${yourFloorTicks})</i>` : ''}</span>
          `;

          const topFloorData = document.createElement('div');
          topFloorData.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #ccc;
            width: 120px;
            font-weight: ${isFloorTop ? 'bold' : 'normal'};
          `;
          topFloorData.innerHTML = `
            <span style="color: #ff8; font-weight: bold;">Top:</span>
            <span style="white-space: nowrap;"><img src="https://bestiaryarena.com/assets/UI/floor-15.png" alt="Floor" style="width: 14px; height: 7px; vertical-align: middle; margin-right: 2px; display: inline-block;">${bestFloor !== null ? bestFloor : '-'}${bestFloorTicks !== undefined && bestFloorTicks !== null ? ` <i style="color: #aaa;">(${bestFloorTicks})</i>` : ''}</span>
          `;

          floorRow.appendChild(yourFloorData);
          floorRow.appendChild(topFloorData);

          dataColumn.appendChild(speedrunRow);
          dataColumn.appendChild(rankRow);
          dataColumn.appendChild(floorRow);

          roomEntry.appendChild(mapColumn);
          roomEntry.appendChild(dataColumn);
          contentContainer.appendChild(roomEntry);
          });
        });

        containerDiv.appendChild(contentContainer);

        container.innerHTML = '';
        container.appendChild(containerDiv);
      }

      function displaySpeedrunRankSearchResults(category, playerName, searchedRooms, yourRooms, ROOM_NAMES, best, roomsHighscores, container) {
        const containerDiv = document.createElement('div');
        Object.assign(containerDiv.style, {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '20px',
          boxSizing: 'border-box'
        });

        const header = document.createElement('div');
        header.style.cssText = `
          font-size: 18px;
          font-weight: bold;
          color: ${COLOR_CONSTANTS.PRIMARY};
          margin-bottom: 20px;
          text-align: center;
          padding: 10px;
          background: rgba(255, 224, 102, 0.1);
          border-radius: 8px;
        `;
        header.textContent = `${truncatePlayerName(playerName)}'s ${category} Data`;
        containerDiv.appendChild(header);

        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `
          flex: 1;
          padding: 10px;
        `;

        const allRoomCodes = Object.keys(ROOM_NAMES).sort();

        allRoomCodes.forEach(roomCode => {
          const roomName = ROOM_NAMES[roomCode];
          const searchedRoom = searchedRooms[roomCode];
          const yourRoom = yourRooms[roomCode];

          const roomEntry = document.createElement('div');
          roomEntry.style.cssText = `
            margin-bottom: 12px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
          `;

          // Room header
          const roomHeader = document.createElement('div');
          roomHeader.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
          `;

          const thumbnail = createRoomThumbnail(roomCode, roomName, 32);

          const roomTitle = document.createElement('div');
          roomTitle.style.cssText = `
            font-weight: bold;
            color: ${COLOR_CONSTANTS.TEXT};
            font-size: 14px;
          `;
          roomTitle.textContent = roomName;

          roomHeader.appendChild(thumbnail);
          roomHeader.appendChild(roomTitle);
          roomEntry.appendChild(roomHeader);

          if (category === 'Speedrun') {
            const searchedTicks = searchedRoom.ticks || 0;
            const yourTicks = yourRoom?.ticks || 0;
            const bestTicks = best[roomCode]?.ticks || 0;
            const bestPlayer = best[roomCode]?.userName || 'Unknown';

            const dataRow = document.createElement('div');
            dataRow.style.cssText = `
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 12px;
              color: #ccc;
            `;

            const searchedData = document.createElement('div');
            searchedData.innerHTML = `
              <div style="color: ${COLOR_CONSTANTS.PRIMARY}; font-weight: bold;">${truncatePlayerName(playerName)}:</div>
              <div>${searchedTicks} ticks</div>
            `;

            const yourData = document.createElement('div');
            yourData.innerHTML = `
              <div style="color: #8f8; font-weight: bold;">You:</div>
              <div>${yourTicks} ticks</div>
            `;

            const bestData = document.createElement('div');
            bestData.innerHTML = `
              <div style="color: #ff8; font-weight: bold;">Best:</div>
              <div>${bestTicks} ticks</div>
              <div style="font-size: 10px; color: #888;">by ${truncatePlayerName(bestPlayer)}</div>
            `;

            dataRow.appendChild(searchedData);
            dataRow.appendChild(yourData);
            dataRow.appendChild(bestData);
            roomEntry.appendChild(dataRow);

          } else if (category === 'Rank Points') {
            const searchedRank = searchedRoom.rank || 0;
            const searchedRankTicks = searchedRoom.rankTicks;
            const yourRank = yourRoom?.rank || 0;
            const yourRankTicks = yourRoom?.rankTicks;
            const topRank = roomsHighscores?.rank?.[roomCode]?.rank || 0;
            const topRankTicks = roomsHighscores?.rank?.[roomCode]?.ticks;
            const topPlayer = roomsHighscores?.rank?.[roomCode]?.userName || 'Unknown';

            const dataRow = document.createElement('div');
            dataRow.style.cssText = `
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 12px;
              color: #ccc;
            `;

            const searchedData = document.createElement('div');
            searchedData.innerHTML = `
              <div style="color: ${COLOR_CONSTANTS.PRIMARY}; font-weight: bold;">${truncatePlayerName(playerName)}:</div>
              <div>${searchedRank}${searchedRankTicks !== undefined && searchedRankTicks !== null ? ` <i style="color: #aaa;">(${searchedRankTicks})</i>` : ' (null)'}</div>
            `;

            const yourData = document.createElement('div');
            yourData.innerHTML = `
              <div style="color: #8f8; font-weight: bold;">You:</div>
              <div>${yourRank}${yourRankTicks !== undefined && yourRankTicks !== null ? ` <i style="color: #aaa;">(${yourRankTicks})</i>` : ' (null)'}</div>
            `;

            const topData = document.createElement('div');
            topData.innerHTML = `
              <div style="color: #ff8; font-weight: bold;">Top:</div>
              <div>${topRank}${topRankTicks !== undefined && topRankTicks !== null ? ` <i style="color: #aaa;">(${topRankTicks})</i>` : ' (null)'}</div>
              <div style="font-size: 10px; color: #888;">by ${truncatePlayerName(topPlayer)}</div>
            `;

            dataRow.appendChild(searchedData);
            dataRow.appendChild(yourData);
            dataRow.appendChild(topData);
            roomEntry.appendChild(dataRow);

          } else if (category === 'Floors') {
            const { floor: searchedFloor, floorTicks: searchedFloorTicks } = normalizeUserFloorData(searchedRoom);
            const { floor: yourFloor, floorTicks: yourFloorTicks } = normalizeUserFloorData(yourRoom);
            const { floor: bestFloor, floorTicks: bestFloorTicks, playerName: bestFloorPlayer } = normalizeBestFloorData(roomCode, roomsHighscores, best);

            const dataRow = document.createElement('div');
            dataRow.style.cssText = `
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 12px;
              color: #ccc;
            `;

            const searchedData = document.createElement('div');
            searchedData.innerHTML = `
              <div style="color: ${COLOR_CONSTANTS.PRIMARY}; font-weight: bold;">${truncatePlayerName(playerName)}:</div>
              <div>Floor ${searchedFloor !== undefined && searchedFloor !== null ? searchedFloor : '-'}${searchedFloorTicks !== undefined && searchedFloorTicks !== null ? ` <i style="color: #aaa;">(${searchedFloorTicks} ticks)</i>` : ''}</div>
            `;

            const yourData = document.createElement('div');
            yourData.innerHTML = `
              <div style="color: #8f8; font-weight: bold;">You:</div>
              <div>Floor ${yourFloor !== undefined && yourFloor !== null ? yourFloor : '-'}${yourFloorTicks !== undefined && yourFloorTicks !== null ? ` <i style="color: #aaa;">(${yourFloorTicks} ticks)</i>` : ''}</div>
            `;

            const bestData = document.createElement('div');
            bestData.innerHTML = `
              <div style="color: #ff8; font-weight: bold;">Best:</div>
              <div>Floor ${bestFloor !== undefined && bestFloor !== null ? bestFloor : '-'}${bestFloorTicks !== undefined && bestFloorTicks !== null ? ` <i style="color: #aaa;">(${bestFloorTicks} ticks)</i>` : ''}</div>
              <div style="font-size: 10px; color: #888;">by ${truncatePlayerName(bestFloorPlayer)}</div>
            `;

            dataRow.appendChild(searchedData);
            dataRow.appendChild(yourData);
            dataRow.appendChild(bestData);
            roomEntry.appendChild(dataRow);
          }

          contentContainer.appendChild(roomEntry);
        });

        containerDiv.appendChild(contentContainer);

        container.innerHTML = '';
        container.appendChild(containerDiv);
      }

      function displaySearchResults(category, playerName, searchedRooms, yourRooms, ROOM_NAMES, best, roomsHighscores, container) {
        displaySpeedrunRankSearchResults(category, playerName, searchedRooms, yourRooms, ROOM_NAMES, best, roomsHighscores, container);
      }

      function displayCombinedLeaderboardsSearchResults(playerName, searchedProfileData, yourRooms, ROOM_NAMES, best, roomsHighscores, container) {
        if (!playerName || !searchedProfileData || !yourRooms || !ROOM_NAMES || !best || !roomsHighscores || !container) {
          console.error('[Cyclopedia] displayCombinedLeaderboardsSearchResults: Missing required parameters:', {
            playerName: !!playerName,
            searchedProfileData: !!searchedProfileData,
            yourRooms: !!yourRooms,
            ROOM_NAMES: !!ROOM_NAMES,
            best: !!best,
            roomsHighscores: !!roomsHighscores,
            container: !!container
          });
          
          if (container) {
            container.innerHTML = `
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Data Error</div>
                <div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not load leaderboard data</div>
                <div style="font-size: 12px; color: #666;">Please try searching again.</div>
              </div>
            `;
          }
          return;
        }
        
        const season = cyclopediaState.profileSeason || 1;
        const scopedProfile = narrowProfilePageDataForSeason(searchedProfileData, season);
        // Use new rooms data from profilePageData if available, otherwise fall back to highscores
        const searchedRooms = scopedProfile.rooms || {};
        const searchedHighscores = scopedProfile.highscores || [];
        const yourRoomsScoped = getYourRoomsForCyclopediaSeason(yourRooms);
        
        const searchedHighscoresMap = {};
        const searchedRankPointsMap = {};
        
        // First, try to use the new rooms data structure
        if (Object.keys(searchedRooms).length > 0) {
          Object.entries(searchedRooms).forEach(([roomId, roomData]) => {
            if (roomData.ticks !== undefined && roomData.ticks >= 0) {
              searchedHighscoresMap[roomId] = { roomId, ticks: roomData.ticks };
            }
            if (roomData.rank !== undefined && roomData.rank > 0) {
              searchedRankPointsMap[roomId] = { roomId, rank: roomData.rank };
            }
          });
        } else {
          // Fall back to the old highscores data structure
          searchedHighscores.forEach(score => {
            if (score.roomId) {
              if (score.rank === -1) {
                if (score.ticks && (!searchedHighscoresMap[score.roomId] || score.ticks < searchedHighscoresMap[score.roomId].ticks)) {
                  searchedHighscoresMap[score.roomId] = score;
                }
              } else if (score.rank > 0) {
                if (!searchedRankPointsMap[score.roomId] || score.rank < searchedRankPointsMap[score.roomId].rank) {
                  searchedRankPointsMap[score.roomId] = score;
                }
              }
            }
          });
        }
        const formatTime = formatCyclopediaMilliseconds;

        const containerDiv = document.createElement('div');
        Object.assign(containerDiv.style, {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '8px',
          boxSizing: 'border-box',
          minWidth: '0',
          maxWidth: '100%'
        });

        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `
          flex: 1;
          padding: 2px;
          min-width: 0;
          max-width: 100%;
        `;

        // Organize rooms by region (show all maps)
        const organizedRooms = organizeRoomsByRegion(createAllRoomsObject(ROOM_NAMES), ROOM_NAMES);

        // Create room entries organized by region
        Object.entries(organizedRooms).forEach(([regionName, regionRooms]) => {
          // Create region header using the title system with sticky positioning
          const regionHeader = DOMUtils.createTitle(`${regionName} (${regionRooms.length} maps)`, FONT_CONSTANTS.SIZES.SMALL);
          Object.assign(regionHeader.style, {
            margin: '8px 0 4px 0',
            width: '100%',
            position: 'sticky',
            top: '0',
            zIndex: '10',
            backgroundColor: '#232323'
          });
          contentContainer.appendChild(regionHeader);

          regionRooms.forEach(({ roomCode, roomName }) => {
            const searchedScore = searchedHighscoresMap[roomCode];
            const yourRoom = yourRoomsScoped[roomCode];
            const searchedRoom = searchedRooms[roomCode];

            const hasSearchedScore = searchedScore && searchedScore.ticks;
            const hasSearchedRankScore = searchedRankPointsMap[roomCode];

            const roomEntry = document.createElement('div');
            roomEntry.style.cssText = `
              display: grid;
              grid-template-columns: 80px 1fr;
              align-items: center;
              gap: 8px;
              margin-bottom: 4px;
              padding: 6px;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 4px;
              border: 1px solid rgba(255, 255, 255, 0.1);
              min-width: 0;
              max-width: 100%;
            `;

          const mapColumn = createMapColumn(roomCode, roomName, searchedRoom?.count);

          const dataColumn = document.createElement('div');
          dataColumn.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 4px;
            width: 100%;
            min-width: 0;
            max-width: 100%;
          `;

          const searchedTicks = hasSearchedScore ? searchedScore.ticks : null;
          const topTicks = best?.[roomCode]?.ticks || null;

          const speedrunRow = document.createElement('div');
          const isSpeedrunTop = searchedTicks !== null && topTicks !== null && searchedTicks === topTicks;
          speedrunRow.style.cssText = `
            display: grid;
            grid-template-columns: 120px 120px;
            align-items: center;
            gap: 6px;
            padding: 4px;
            background: ${isSpeedrunTop ? 'url("https://bestiaryarena.com/_next/static/media/background-green.be515334.png")' : 'rgba(255, 255, 255, 0.03)'};
            border-radius: 3px;
            border-left: 3px solid #4CAF50;
            min-width: 0;
            max-width: 100%;
          `;

          const searchedSpeedrun = document.createElement('div');
          searchedSpeedrun.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #ccc;
            width: 120px;
            font-weight: ${isSpeedrunTop ? 'bold' : 'normal'};
          `;
          searchedSpeedrun.innerHTML = `
            <span style="color: ${COLOR_CONSTANTS.PRIMARY}; font-weight: bold;">${truncateListPlayerName(playerName)}:</span>
            <span>${searchedTicks !== null && searchedTicks >= 0 ? searchedTicks + ' ticks' : '-'}</span>
          `;

          const topSpeedrun = document.createElement('div');
          topSpeedrun.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #ccc;
            width: 120px;
            font-weight: ${isSpeedrunTop ? 'bold' : 'normal'};
          `;
          topSpeedrun.innerHTML = `
            <span style="color: #ff8; font-weight: bold;">Top:</span>
            <span>${topTicks !== null ? topTicks + ' ticks' : '-'}</span>
          `;

          speedrunRow.appendChild(searchedSpeedrun);
          speedrunRow.appendChild(topSpeedrun);

          const searchedRankScore = searchedRankPointsMap[roomCode];
          const searchedRank = searchedRankScore ? searchedRankScore.rank : null;
          const searchedRankTicks = searchedRankScore?.rankTicks || searchedRooms[roomCode]?.rankTicks;
          const topRank = roomsHighscores?.rank?.[roomCode]?.rank || null;
          const topRankTicks = roomsHighscores?.rank?.[roomCode]?.ticks;

          const isRankTop = searchedRank !== null && topRank !== null && searchedRank === topRank &&
            (searchedRankTicks === topRankTicks ||
             ((searchedRankTicks === undefined || searchedRankTicks === null) && (topRankTicks === undefined || topRankTicks === null)));

          const rankRow = document.createElement('div');
          rankRow.style.cssText = `
            display: grid;
            grid-template-columns: 120px 120px;
            align-items: center;
            min-width: 0;
            max-width: 100%;
            gap: 6px;
            padding: 4px;
            background: ${isRankTop ? 'url("https://bestiaryarena.com/_next/static/media/background-green.be515334.png")' : 'rgba(255, 255, 255, 0.03)'};
            border-radius: 3px;
            border-left: 3px solid #FF9800;
          `;

          const searchedRankData = document.createElement('div');
          searchedRankData.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #ccc;
            width: 120px;
            font-weight: ${isRankTop ? 'bold' : 'normal'};
          `;
          searchedRankData.innerHTML = `
            <span style="color: ${COLOR_CONSTANTS.PRIMARY}; font-weight: bold;">${truncateListPlayerName(playerName)}:</span>
            <span style="white-space: nowrap;"><img src="https://bestiaryarena.com/assets/icons/star-tier.png" alt="Rank" style="width: 9px; height: 10px; vertical-align: middle; margin-right: 2px; display: inline-block;">${searchedRank !== null && searchedRank >= 0 ? searchedRank + (searchedRankTicks !== undefined && searchedRankTicks !== null ? ` <i style="color: #aaa;">(${searchedRankTicks})</i>` : ' (null)') : '-'}</span>
          `;

          const topRankData = document.createElement('div');
          topRankData.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #ccc;
            width: 120px;
            font-weight: ${isRankTop ? 'bold' : 'normal'};
          `;
          topRankData.innerHTML = `
            <span style="color: #ff8; font-weight: bold;">Top:</span>
            <span style="white-space: nowrap;"><img src="https://bestiaryarena.com/assets/icons/star-tier.png" alt="Rank" style="width: 9px; height: 10px; vertical-align: middle; margin-right: 2px; display: inline-block;">${topRank !== null ? topRank + (topRankTicks !== undefined && topRankTicks !== null ? ` <i style="color: #aaa;">(${topRankTicks})</i>` : ' (null)') : '-'}</span>
          `;

          rankRow.appendChild(searchedRankData);
          rankRow.appendChild(topRankData);

          // Floor row
          const { floor: searchedFloor, floorTicks: searchedFloorTicks } = normalizeUserFloorData(searchedRoom);
          const { floor: yourFloor, floorTicks: yourFloorTicks } = normalizeUserFloorData(yourRoom);
          const { floor: bestFloor, floorTicks: bestFloorTicks } = normalizeBestFloorData(roomCode, roomsHighscores, best);

          const isFloorTop = searchedFloor !== null && bestFloor !== null && searchedFloor === bestFloor &&
            (searchedFloorTicks === bestFloorTicks ||
             ((searchedFloorTicks === undefined || searchedFloorTicks === null) && (bestFloorTicks === undefined || bestFloorTicks === null)));

          const floorRow = document.createElement('div');
          floorRow.style.cssText = `
            display: grid;
            grid-template-columns: 120px 120px;
            align-items: center;
            min-width: 0;
            max-width: 100%;
            gap: 6px;
            padding: 4px;
            background: ${isFloorTop ? 'url("https://bestiaryarena.com/_next/static/media/background-green.be515334.png")' : 'rgba(255, 255, 255, 0.03)'};
            border-radius: 3px;
            border-left: 3px solid #9C27B0;
          `;

          const searchedFloorData = document.createElement('div');
          searchedFloorData.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #ccc;
            width: 120px;
            font-weight: ${isFloorTop ? 'bold' : 'normal'};
          `;
          searchedFloorData.innerHTML = `
            <span style="color: ${COLOR_CONSTANTS.PRIMARY}; font-weight: bold;">${truncateListPlayerName(playerName)}:</span>
            <span style="white-space: nowrap;">${searchedFloor !== null && searchedFloor >= 0 ? `<img src="https://bestiaryarena.com/assets/UI/floor-15.png" alt="Floor" style="width: 14px; height: 7px; vertical-align: middle; margin-right: 2px; display: inline-block;">${searchedFloor}${searchedFloorTicks !== undefined && searchedFloorTicks !== null ? ` <i style="color: #aaa;">(${searchedFloorTicks})</i>` : ''}` : '-'}</span>
          `;

          const topFloorData = document.createElement('div');
          topFloorData.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #ccc;
            width: 120px;
            font-weight: ${isFloorTop ? 'bold' : 'normal'};
          `;
          topFloorData.innerHTML = `
            <span style="color: #ff8; font-weight: bold;">Top:</span>
            <span style="white-space: nowrap;">${bestFloor !== null ? `<img src="https://bestiaryarena.com/assets/UI/floor-15.png" alt="Floor" style="width: 14px; height: 7px; vertical-align: middle; margin-right: 2px; display: inline-block;">${bestFloor}${bestFloorTicks !== undefined && bestFloorTicks !== null ? ` <i style="color: #aaa;">(${bestFloorTicks})</i>` : ''}` : '-'}</span>
          `;

          floorRow.appendChild(searchedFloorData);
          floorRow.appendChild(topFloorData);

          dataColumn.appendChild(speedrunRow);
          dataColumn.appendChild(rankRow);
          dataColumn.appendChild(floorRow);

          roomEntry.appendChild(mapColumn);
          roomEntry.appendChild(dataColumn);
          contentContainer.appendChild(roomEntry);
          });
        });

        containerDiv.appendChild(contentContainer);

        container.innerHTML = '';
        container.appendChild(containerDiv);
      }

      // Function to display searched player's stats in col3
      const displaySearchedPlayerStats = (playerName, profileData, targetColumn = col3) => {
        // Check if we're in Speedrun, Rank Points, or Combined Leaderboards mode
        if (window.currentSpeedrunRankCategory && window.currentSpeedrunRankData) {
          if (window.currentSpeedrunRankCategory === 'Combined') {
            // Handle Combined Leaderboards search
            displayCombinedLeaderboardsSearchResults(
              playerName,
              profileData,
              window.currentSpeedrunRankData.yourRooms,
              window.currentSpeedrunRankData.ROOM_NAMES,
              window.currentSpeedrunRankData.best,
              window.currentSpeedrunRankData.roomsHighscores,
              targetColumn
            );
          } else {
            // Handle Speedrun/Rank Points search
            displaySpeedrunRankSearchResults(
              window.currentSpeedrunRankCategory,
              playerName,
              profileData.rooms,
              window.currentSpeedrunRankData.yourRooms,
              window.currentSpeedrunRankData.ROOM_NAMES,
              window.currentSpeedrunRankData.best,
              window.currentSpeedrunRankData.roomsHighscores,
              targetColumn
            );
          }
          return;
        }

        // Default behavior for Player Information
        // Create a container for searched player info
        const container = document.createElement('div');
        Object.assign(container.style, {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '20px',
          boxSizing: 'border-box'
        });

        // Check if profileData is null (player not found)
        if (profileData === null) {
          // Create template content with "Player not found" in the name slot with red text
          const templateContent = renderCyclopediaPlayerInfo({
            name: 'Player not found',
            level: '-',
            createdAt: '-',
            status: '-',
            loyaltyPoints: '-',
            dailySeashell: '-',
            huntingTasks: '-',
            totalRuns: '-',
            perfectCreatures: '-',
            bisEquipments: '-',
            exploredMaps: '-',
            bagOutfits: '-',
            rankPoints: '-',
            timeSum: '-'
          }, { showShinyCreatures: false });
          
          // Find the name element and make it red
          const nameElement = templateContent.querySelector('p.line-clamp-1.text-whiteExp.animate-in.fade-in');
          
          if (nameElement) {
            nameElement.textContent = 'Player not found';
            nameElement.style.color = COLOR_CONSTANTS.ERROR;
            nameElement.style.fontWeight = 'bold';
          }
          
          // Center the content
          const centeredContent = document.createElement('div');
          Object.assign(centeredContent.style, {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            width: '100%',
            height: '100%'
          });
          
          centeredContent.appendChild(templateContent);
          container.appendChild(centeredContent);
        } else {
          // Create the player info content for valid player data
          const playerInfoContent = renderCyclopediaPlayerInfo(
            patchProfileDataForActiveSeason(profileData, cyclopediaState.profileSeason || 1),
            { showShinyCreatures: false }
          );
          
          // Add profile button after the player name
          const nameElement = playerInfoContent.querySelector('p.line-clamp-1.text-whiteExp.animate-in.fade-in');
          if (nameElement && playerName) {
            // Create a container for name and button
            const nameContainer = document.createElement('div');
            Object.assign(nameContainer.style, {
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap'
            });
            
            // Move the name to the container
            nameElement.parentNode.insertBefore(nameContainer, nameElement);
            nameContainer.appendChild(nameElement);
            
            // Create profile button
            const profileButton = document.createElement('button');
            Object.assign(profileButton.style, {
              background: 'url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png") repeat',
              border: '1px solid transparent',
              borderImage: 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 1 fill stretch',
              color: '#e6d7b0',
              cursor: 'pointer',
              borderRadius: '0',
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '16px',
              height: '16px',
              padding: '1px',
              marginLeft: '4px',
              transition: 'border-image 0.1s'
            });
            
            // Add button content - just the icon
            profileButton.innerHTML = `
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 7h10v10"/>
                <path d="M7 17 17 7"/>
              </svg>
            `;
            
            // Add title for accessibility
            profileButton.title = 'View Profile';
            profileButton.setAttribute('aria-label', 'View Profile');
            
            // Add hover effects
            profileButton.addEventListener('mouseenter', () => {
              profileButton.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png") 1 fill stretch';
            });
            
            profileButton.addEventListener('mouseleave', () => {
              profileButton.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 1 fill stretch';
            });
            
            // Add click handler
            profileButton.addEventListener('click', () => {
              NavigationHandler.navigateToProfile(playerName);
            });
            
            // Add pressed state
            profileButton.addEventListener('mousedown', () => {
              profileButton.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png") 1 fill stretch';
            });
            
            profileButton.addEventListener('mouseup', () => {
              profileButton.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 1 fill stretch';
            });
            
            // Add to container
            nameContainer.appendChild(profileButton);
          }
          
          // Center the content
          const centeredContent = document.createElement('div');
          Object.assign(centeredContent.style, {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            width: '100%',
            height: '100%'
          });
          
          centeredContent.appendChild(playerInfoContent);
          container.appendChild(centeredContent);
        }

        // Clear col3 and append searched player info
        col3.innerHTML = '';
        col3.appendChild(container);
      };

      // Add the search input and button to the content area
      function setupSearchInterface() {
        const searchSetupTimeout = setTimeout(() => {
          // Find the correct container - the one with the grid layout
          const contentContainer = playerSearchBox.querySelector('[data-nopadding="true"]') ||
                                  playerSearchBox.querySelector('[style*="grid-template-rows"]') ||
                                  playerSearchBox.querySelector('[style*="overflow-y"]');
          
          if (contentContainer) {
            // Clear any existing content
            contentContainer.innerHTML = '';
            
            // Set container styles to ensure content is at the top
            Object.assign(contentContainer.style, {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'stretch',
              padding: '8px',
              height: 'auto',
              minHeight: '0',
              overflow: 'visible'
            });
            
            // Get current user's username
            let currentUsername = '';
            try {
              const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
              if (playerState?.name) {
                currentUsername = playerState.name;
              }
            } catch (error) {
          
            }

            // Create a container for the search input and status indicator
            const searchInputContainer = DOMUtils.createElement('div');
            Object.assign(searchInputContainer.style, {
              position: 'relative',
              width: '100%',
              marginBottom: '4px'
            });

            const playerSearchInput = DOMUtils.createElement('input');
            playerSearchInput.type = 'text';
            playerSearchInput.placeholder = 'Compare with...';
            playerSearchInput.value = cyclopediaState.searchedUsername || ''; // Persist searched username
            Object.assign(playerSearchInput.style, {
              width: '100%',
              padding: '4px 8px',
              paddingRight: '24px', // Make room for the status indicator
              border: '1px solid #444',
              borderRadius: '2px',
              backgroundColor: '#232323',
              color: COLOR_CONSTANTS.TEXT,
              fontFamily: FONT_CONSTANTS.PRIMARY,
              fontSize: '12px',
              boxSizing: 'border-box'
            });

            // Create status indicator element
            const statusIndicator = DOMUtils.createElement('div');
            Object.assign(statusIndicator.style, {
              position: 'absolute',
              right: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '14px',
              pointerEvents: 'none',
              display: 'none'
            });

            searchInputContainer.appendChild(playerSearchInput);
            searchInputContainer.appendChild(statusIndicator);
            
            // Show status indicator if there's already a searched username
            if (cyclopediaState.searchedUsername) {
              // Check if we have cached data for the searched user
              const cachedData = getCachedProfileData(cyclopediaState.searchedUsername);
              if (cachedData === null) {
                // Show red cross for null result
                statusIndicator.innerHTML = '❌';
                statusIndicator.style.color = '#ff6b6b';
                statusIndicator.style.display = 'block';
              } else if (cachedData && cachedData.name) {
                // Show green checkmark for successful cached result
                statusIndicator.innerHTML = '✓';
                statusIndicator.style.color = '#51cf66';
                statusIndicator.style.display = 'block';
              }
            }

            const searchButton = DOMUtils.createElement('button', '', 'Search');
            Object.assign(searchButton.style, {
              width: '100%',
              padding: '4px 8px',
              border: '1px solid #444',
              borderRadius: '2px',
              backgroundColor: '#232323',
              color: COLOR_CONSTANTS.TEXT,
              fontFamily: FONT_CONSTANTS.PRIMARY,
              fontSize: '12px',
              cursor: 'pointer',
              boxSizing: 'border-box'
            });

            // Add hover effect using EventHandlerManager
            EventHandlerManager.addHandler(searchButton, 'mouseenter', () => {
              searchButton.style.backgroundColor = '#444';
            });
            EventHandlerManager.addHandler(searchButton, 'mouseleave', () => {
              searchButton.style.backgroundColor = '#232323';
            });

            // Add search functionality with caching and debouncing
            const performSearch = async () => {
              const searchTerm = playerSearchInput.value.trim();
              if (!searchTerm) {
                // Hide status indicator when search is cleared
                statusIndicator.style.display = 'none';
                
                // Reset searched player state
                cyclopediaState.searchedUsername = null;
                cyclopediaState.previousTabState = null;
                
                // Refresh the current tab to show default content
                if (window.selectedCharacterItem === 'Rankings') {
                  if (!refreshRankingsTableIfReady()) {
                    displayUserStats('Rankings').catch(error => {
                      console.error('[Cyclopedia] Error refreshing rankings after reset:', error);
                    });
                  }
                } else if (window.selectedCharacterItem === 'Leaderboards') {
                  // Refresh leaderboards to show default search functionality
                  const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
                  if (playerState?.name) {
                    displayCombinedLeaderboardsData(playerState).then(() => {
                      const cachedData = getCachedLeaderboardData('combined-leaderboards');
                      if (cachedData) {
                        updateSearchForCombinedLeaderboards(playerState.rooms, globalThis.state.utils.ROOM_NAME, cachedData.best, cachedData.roomsHighscores);
                      } else {
                        updateSearchForCombinedLeaderboards(playerState.rooms, globalThis.state.utils.ROOM_NAME, null, null);
                      }
                    }).catch(error => {
                      console.error('[Cyclopedia] Error refreshing leaderboards after reset:', error);
                    });
                  }
                } else {
                  // For other tabs, clear col3 to show default content
                  col3.innerHTML = '';
                }
                
                return;
              }
              
              // Clear previous search and refresh rankings if we're in Rankings tab
              if (cyclopediaState.searchedUsername && cyclopediaState.searchedUsername !== searchTerm && window.selectedCharacterItem === 'Rankings') {
                // Store the new search term before clearing the old one
                const newSearchTerm = searchTerm;
                cyclopediaState.searchedUsername = null;
                if (!refreshRankingsTableIfReady()) {
                  displayUserStats('Rankings').catch(error => {
                    console.error('[Cyclopedia] Error clearing previous search from rankings:', error);
                  });
                }
                // Restore the new search term after clearing
                cyclopediaState.searchedUsername = newSearchTerm;
              }
              
              // Store the searched username globally
              cyclopediaState.searchedUsername = searchTerm;
              
              // If we're in Rankings tab, update the previousTabState to preserve the search for other tabs
              if (window.selectedCharacterItem === 'Rankings') {
                cyclopediaState.previousTabState = {
                  searchedUsername: searchTerm,
                  hasSearchedData: true
                };
              }
              
              // If we're currently in the Rankings tab, refresh the rankings display immediately
              if (window.selectedCharacterItem === 'Rankings') {
                if (!refreshRankingsTableIfReady()) {
                  displayUserStats('Rankings').catch(error => {
                    console.error('[Cyclopedia] Error refreshing rankings after search:', error);
                  });
                }
              }
              
              // Show loading state only in col3 (col2 keeps user's stats)
              col3.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.TEXT}; text-align: center; padding: 20px;">
                  <div style="font-size: 24px; margin-bottom: 16px;">🔍</div>
                  <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Searching...</div>
                  <div style="font-size: 14px; color: #888;">Looking for player: ${searchTerm}</div>
                </div>
              `;
              
              try {
                // Check cache first for the searched player's profile data
                let searchedProfileData = getCachedProfileData(searchTerm);
                
                if (!searchedProfileData) {
                  // Fetch player data from API with deduplication
                  const apiUrl = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(searchTerm)}%22%7D%7D`;
                  
                  const data = await fetchWithDeduplication(apiUrl, `search-${searchTerm}`);
                  
                  // Extract profile data from the response
                  if (Array.isArray(data) && data[0]?.result?.data?.json !== undefined) {
                    searchedProfileData = data[0].result.data.json;
                  } else {
                    searchedProfileData = data;
                  }
                  
                  // Cache the result if valid
                  if (searchedProfileData && searchedProfileData !== null) {
                    setCachedProfileData(searchTerm, searchedProfileData);
                  }
                } else {
                  // Using cached profile data for search
                }
                
                // Check if player doesn't exist (API returns json: null)
                if (searchedProfileData === null) {
                  // Show red cross status indicator
                  statusIndicator.innerHTML = '❌';
                  statusIndicator.style.color = '#ff6b6b';
                  statusIndicator.style.display = 'block';
                  
                  // Show "Player doesn't exist" message only in col3
                  col3.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;">
                      <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                      <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Player doesn't exist</div>
                      <div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not find player: ${truncatePlayerName(searchTerm)}</div>
                      <div style="font-size: 12px; color: #666;">Please check the spelling and try again.</div>
                    </div>
                  `;
                  return;
                }
                
                // Always populate col3 with searched player's data for current tab mode
                
                if (window.selectedCharacterItem === 'Leaderboards' && window.currentSpeedrunRankData) {
                  // Handle leaderboard search - populate col3 with Leaderboards data
                  try {
                    const { yourRooms, ROOM_NAMES, best, roomsHighscores } = window.currentSpeedrunRankData;
                    const searchedRooms = searchedProfileData.rooms || {};
                    
                    displayCombinedLeaderboardsSearchResults(searchTerm, searchedProfileData, yourRooms, ROOM_NAMES, best, roomsHighscores, col3);
                    
                    // Show green checkmark for successful leaderboard search
                    statusIndicator.innerHTML = '✓';
                    statusIndicator.style.color = '#51cf66';
                    statusIndicator.style.display = 'block';
                    
                  } catch (error) {
                    console.error('[Cyclopedia] Error displaying leaderboard search results:', error);
                    col3.innerHTML = `
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                        <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Search Error</div>
                        <div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not search for: ${truncatePlayerName(searchTerm)}</div>
                        <div style="font-size: 12px; color: #666;">Please try again later.</div>
                      </div>
                    `;
                    
                    // Show red cross for search error
                    statusIndicator.innerHTML = '❌';
                    statusIndicator.style.color = '#ff6b6b';
                    statusIndicator.style.display = 'block';
                  }
                } else {
                  // Default: Player Information mode - populate col3 with searched player's Player Information
                  displaySearchedPlayerStats(searchTerm, searchedProfileData, col3);
                }
                
                // Show green checkmark for successful search
                statusIndicator.innerHTML = '✓';
                statusIndicator.style.color = '#51cf66';
                statusIndicator.style.display = 'block';
                
              } catch (error) {
                console.error('[Cyclopedia] Error searching for player:', error);
                
                // Show red cross for search error
                statusIndicator.innerHTML = '❌';
                statusIndicator.style.color = '#ff6b6b';
                statusIndicator.style.display = 'block';
                
                let errorMessage = 'Could not find player';
                let errorDetails = 'Please check the spelling and try again.';
                
                // Handle rate limiting specifically
                if (error.message.includes('Rate limit exceeded')) {
                  errorMessage = 'Rate limit exceeded';
                  errorDetails = error.message;
                } else if (error.message.includes('HTTP error')) {
                  errorMessage = 'Network error';
                  errorDetails = 'Please check your internet connection and try again.';
                }
                
                // Show error state only in col3
                col3.innerHTML = `
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                    <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">${errorMessage}</div>
                    <div style="font-size: 14px; margin-bottom: 16px; color: #888;">${errorDetails}</div>
                    <div style="font-size: 12px; color: #666;">Search term: ${searchTerm}</div>
                  </div>
                `;
              }
            };

            // Add click handler to search button using EventHandlerManager
            EventHandlerManager.addHandler(searchButton, 'click', performSearch);
            
            // Add Enter key functionality to input using EventHandlerManager
            EventHandlerManager.addHandler(playerSearchInput, 'keydown', (event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                performSearch();
              }
            });

            contentContainer.appendChild(searchInputContainer);
            contentContainer.appendChild(searchButton);
          }
        }, 10);
        TimerManager.addTimeout(searchSetupTimeout, 'searchSetup');
      }
      
      setupSearchInterface();

      col1.appendChild(playerSearchBox);

      // Create the Characters box (80% of col1) - now second
      const charactersBox = createBox({
        title: 'Statistics',
        items: ['Player Information', 'Leaderboards', 'Rankings'],
        type: 'inventory',
        selectedCreature,
        selectedEquipment,
        selectedInventory,
        setSelectedCreature,
        setSelectedEquipment,
        setSelectedInventory,
        updateRightCol: () => {}
      });
      charactersBox.style.flex = '0.8 1 0';
      charactersBox.style.minHeight = '0';
      col1.appendChild(charactersBox);

      // Set default selection and add click handlers, plus show player's own profile
      const characterSetupTimeout = setTimeout(() => {
        // Only select divs that are actual character items (not titles or other elements)
        const items = DOMCache.getAll('div', charactersBox);
        const characterItems = Array.from(items).filter(item => {
          const text = item.textContent.trim();
          return text === 'Player Information' || text === 'Leaderboards' || text === 'Rankings';
        });
        
        characterItems.forEach(item => {
          
          if (item.textContent === 'Player Information') {
            item.classList.add('cyclopedia-selected');
            item.style.background = 'rgba(255,255,255,0.18)';
            item.style.color = COLOR_CONSTANTS.PRIMARY;
          }
          
          // Add click handler for character items only
          item.addEventListener('click', async (event) => {
            event.stopPropagation(); // Prevent event bubbling
            
            // Remove selection from all character items
            characterItems.forEach(otherItem => {
              otherItem.classList.remove('cyclopedia-selected');
              otherItem.style.background = 'none';
              otherItem.style.color = COLOR_CONSTANTS.TEXT;
            });
            
            // Add selection to clicked item
            item.classList.add('cyclopedia-selected');
            item.style.background = 'rgba(255,255,255,0.18)';
            item.style.color = COLOR_CONSTANTS.PRIMARY;
            
            // Update the selected character item and refresh both col2 and col3
            selectedCharacterItem = item.textContent;
            window.selectedCharacterItem = selectedCharacterItem; // Update global variable
            
            // Handle tab switching with remembered searched username
            if (selectedCharacterItem === 'Player Information') {
              window.currentSpeedrunRankCategory = null;
              window.currentSpeedrunRankData = null;
              
              // Show col3 again and reset col2 styling
              applyCharactersSplitColumnLayout();
              
              // Simple, robust display of user stats
              displayUserStats('Player Information');
              
              // Check if we're returning from Rankings and need to restore search state
              if (cyclopediaState.previousTabState && cyclopediaState.previousTabState.hasSearchedData) {
                cyclopediaState.searchedUsername = cyclopediaState.previousTabState.searchedUsername;
                // Clear the previous state since we've restored it
                cyclopediaState.previousTabState = null;
              }
              
              // Always show searched player's data in col3 for current tab mode
              if (cyclopediaState.searchedUsername) {
                // Get cached profile data for the searched user
                let searchedProfileData = getCachedProfileData(cyclopediaState.searchedUsername);
                
                if (searchedProfileData) {
                  // Populate col3 with the searched user's Player Information
                  displaySearchedPlayerStats(cyclopediaState.searchedUsername, searchedProfileData, col3);
                } else {
                  // Show player profile template in col3 (same layout as col2)
                  const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
                  if (playerState?.name) {
                    // Get cached profile data or fetch it
                    let profileData = getCachedProfileData(playerState.name);
                    if (!profileData) {
                      // Show loading state
                      col3.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.TEXT}; text-align: center; padding: 20px;">
                          <div style="font-size: 24px; margin-bottom: 16px;">📚</div>
                          <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Loading...</div>
                          <div style="font-size: 14px; color: #888;">Fetching profile data</div>
                        </div>
                      `;
                      
                      // Fetch profile data
                      const apiUrl = `${START_PAGE_CONFIG.API_BASE_URL}?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(playerState.name)}%22%7D%7D`;
                      try {
                        const data = await fetchWithDeduplication(apiUrl, `profile-${playerState.name}`);
                        profileData = Array.isArray(data) && data[0]?.result?.data?.json 
                          ? data[0].result.data.json 
                          : data;
                        setCachedProfileData(playerState.name, profileData);
                      } catch (error) {
                        console.error('[Cyclopedia] Error fetching profile data for template:', error);
                        profileData = null;
                      }
                    }
                    
                    // Show template with same layout as col2
                    if (profileData) {
                      const container = document.createElement('div');
                      Object.assign(container.style, {
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        height: '100%',
                        padding: '20px',
                        boxSizing: 'border-box',
                        overflowY: 'scroll'
                      });
                      
                      // Center the content
                      const centeredContent = document.createElement('div');
                      Object.assign(centeredContent.style, {
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        width: '100%',
                        height: '100%'
                      });
                      
                      // Create template content with same structure as col2 but with placeholder data
                      const templateContent = renderCyclopediaPlayerInfo({
                        name: '[Player Name]',
                      exp: 0,
                      premium: false,
                      shell: 0,
                      tasks: 0,
                      playCount: 0,
                      perfectMonsters: 0,
                      bisEquips: 0,
                      maps: 0,
                      ownedOutfits: 0,
                      rankPoints: 0,
                      ticks: 0
                      }, { showShinyCreatures: false });
                      
                      centeredContent.appendChild(templateContent);
                      container.appendChild(centeredContent);
                      
                      // Clear col3 and append template
                      col3.innerHTML = '';
                      col3.appendChild(container);
                    } else {
                      showPlayerProfileTemplate(col3);
                    }
                  } else {
                    showPlayerProfileTemplate(col3);
                  }
                }
              } else {
                // No searched username, show default behavior
                // Show player profile template in col3 (same layout as col2)
                const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
                if (playerState?.name) {
                  // Get cached profile data or fetch it
                  let profileData = getCachedProfileData(playerState.name);
                  if (!profileData) {
                    // Show loading state
                    col3.innerHTML = `
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.TEXT}; text-align: center; padding: 20px;">
                        <div style="font-size: 24px; margin-bottom: 16px;">📚</div>
                        <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Loading...</div>
                        <div style="font-size: 14px; color: #888;">Fetching profile data</div>
                      </div>
                    `;
                    
                    // Fetch profile data
                    const apiUrl = `${START_PAGE_CONFIG.API_BASE_URL}?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(playerState.name)}%22%7D%7D`;
                    try {
                      const data = await fetchWithDeduplication(apiUrl, `profile-${playerState.name}`);
                      profileData = Array.isArray(data) && data[0]?.result?.data?.json 
                        ? data[0].result.data.json 
                        : data;
                      setCachedProfileData(playerState.name, profileData);
                    } catch (error) {
                      console.error('[Cyclopedia] Error fetching profile data for template:', error);
                      profileData = null;
                    }
                  }
                  
                  // Show template with same layout as col2
                  if (profileData) {
                    const container = document.createElement('div');
                    Object.assign(container.style, {
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                      height: '100%',
                      padding: '20px',
                      boxSizing: 'border-box',
                      overflowY: 'scroll'
                    });
                    
                    // Center the content
                    const centeredContent = document.createElement('div');
                    Object.assign(centeredContent.style, {
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      width: '100%',
                      height: '100%'
                    });
                    
                    // Create template content with same structure as col2 but with placeholder data
                    const templateContent = renderCyclopediaPlayerInfo({
                      name: '[Player Name]',
                      exp: 0,
                      premium: false,
                      shell: 0,
                      tasks: 0,
                      playCount: 0,
                      perfectMonsters: 0,
                      bisEquips: 0,
                      maps: 0,
                      ownedOutfits: 0,
                      rankPoints: 0,
                      ticks: 0
                    }, { showShinyCreatures: false });
                    
                    centeredContent.appendChild(templateContent);
                    container.appendChild(centeredContent);
                    
                    // Clear col3 and append template
                    col3.innerHTML = '';
                    col3.appendChild(container);
                  } else {
                    showPlayerProfileTemplate(col3);
                  }
                } else {
                  showPlayerProfileTemplate(col3);
                }
              }
            } else if (selectedCharacterItem === 'Leaderboards') {
              // Always show user's leaderboard data in col2
              const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
              if (playerState?.name) {
                displayCombinedLeaderboardsData(playerState).catch(error => {
                  console.error('[Cyclopedia] Error updating leaderboard data:', error);
                });
              }
              
              // Show col3 again and reset col2 styling
              applyCharactersSplitColumnLayout();
              
              // Check if we're returning from Rankings and need to restore search state
              if (cyclopediaState.previousTabState && cyclopediaState.previousTabState.hasSearchedData) {
                cyclopediaState.searchedUsername = cyclopediaState.previousTabState.searchedUsername;
                // Clear the previous state since we've restored it
                cyclopediaState.previousTabState = null;
              }
              
              // Always show searched player's data in col3 for current tab mode
              if (cyclopediaState.searchedUsername) {
                // Get cached profile data for the searched user
                let searchedProfileData = getCachedProfileData(cyclopediaState.searchedUsername);
                
                if (searchedProfileData) {
                  // Check if we have leaderboard data available
                  if (window.currentSpeedrunRankData) {
                    // Populate col3 with Leaderboards data for the searched user
                    const { yourRooms, ROOM_NAMES, best, roomsHighscores } = window.currentSpeedrunRankData;
                    const searchedRooms = searchedProfileData.rooms || {};
                    
                    // Always show all rooms, even if player has no highscores
                    displayCombinedLeaderboardsSearchResults(cyclopediaState.searchedUsername, searchedProfileData, yourRooms, ROOM_NAMES, best, roomsHighscores, col3);
                  } else {
                    // Load leaderboard data first, then populate col3
                    if (playerState?.name) {
                      // Show loading state in col3
                      col3.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.TEXT}; text-align: center; padding: 20px;">
                          <div style="font-size: 24px; margin-bottom: 16px;">📊</div>
                          <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Loading Leaderboards...</div>
                          <div style="font-size: 14px; color: #888;">Preparing ${truncatePlayerName(cyclopediaState.searchedUsername)}'s data</div>
                        </div>
                      `;
                      
                      // Load leaderboard data
                      displayCombinedLeaderboardsData(playerState).then(() => {
                        // After leaderboard data is loaded, populate col3 with searched player's data
                        const cachedData = getCachedLeaderboardData('combined-leaderboards');
                        if (cachedData && searchedProfileData) {
                          // Ensure we have the correct data structure
                          const yourRooms = cachedData.yourRooms || playerState.rooms || {};
                          const ROOM_NAMES = cachedData.ROOM_NAMES || globalThis.state.utils.ROOM_NAME || {};
                          const best = cachedData.best || {};
                          const roomsHighscores = cachedData.roomsHighscores || {};
                          const searchedRooms = searchedProfileData.rooms || {};
                          
                          // Always show all rooms, even if player has no highscores
                          displayCombinedLeaderboardsSearchResults(cyclopediaState.searchedUsername, searchedProfileData, yourRooms, ROOM_NAMES, best, roomsHighscores, col3);
                        }
                      }).catch(error => {
                        console.error('[Cyclopedia] Error loading leaderboard data for searched player:', error);
                        col3.innerHTML = `
                          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;">
                            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                            <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Load Error</div>
                            <div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not load leaderboard data</div>
                            <div style="font-size: 12px; color: #666;">Please try again later.</div>
                          </div>
                        `;
                      });
                    }
                  }
                } else {
                  // No searched profile data, but we have a username - try to fetch it
                  if (playerState?.name) {
                    // Show loading state in col3
                    col3.innerHTML = `
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.TEXT}; text-align: center; padding: 20px;">
                        <div style="font-size: 24px; margin-bottom: 16px;">📊</div>
                        <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Loading Leaderboards...</div>
                        <div style="font-size: 14px; color: #888;">Preparing ${cyclopediaState.searchedUsername}'s data</div>
                      </div>
                    `;
                    
                    // Load leaderboard data first, then fetch and display searched player's data
                    displayCombinedLeaderboardsData(playerState).then(() => {
                      // After leaderboard data is loaded, fetch the searched player's profile data
                      const apiUrl = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(cyclopediaState.searchedUsername)}%22%7D%7D`;
                      
                      fetchWithDeduplication(apiUrl, `search-${cyclopediaState.searchedUsername}`).then(data => {
                        let searchedProfileData = Array.isArray(data) && data[0]?.result?.data?.json !== undefined
                          ? data[0].result.data.json
                          : data;
                        
                        if (searchedProfileData && searchedProfileData !== null) {
                          setCachedProfileData(cyclopediaState.searchedUsername, searchedProfileData);
                          
                          // Now display the searched player's leaderboard data
                          const cachedData = getCachedLeaderboardData('combined-leaderboards');
                          if (cachedData) {
                            const yourRooms = cachedData.yourRooms || playerState.rooms || {};
                            const ROOM_NAMES = cachedData.ROOM_NAMES || globalThis.state.utils.ROOM_NAME || {};
                            const best = cachedData.best || {};
                            const roomsHighscores = cachedData.roomsHighscores || {};
                            
                            // Always show all rooms, even if player has no highscores
                            displayCombinedLeaderboardsSearchResults(cyclopediaState.searchedUsername, searchedProfileData, yourRooms, ROOM_NAMES, best, roomsHighscores, col3);
                          }
                        } else {
                          // Player doesn't exist
                          col3.innerHTML = `
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;">
                              <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                              <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Player doesn't exist</div>
                              <div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not find player: ${truncatePlayerName(cyclopediaState.searchedUsername)}</div>
                              <div style="font-size: 12px; color: #666;">Please check the spelling and try again.</div>
                            </div>
                          `;
                        }
                      }).catch(error => {
                        console.error('[Cyclopedia] Error fetching searched player data:', error);
                        col3.innerHTML = `
                          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;">
                            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                            <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Search Error</div>
                            <div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not search for: ${truncatePlayerName(cyclopediaState.searchedUsername)}</div>
                            <div style="font-size: 12px; color: #666;">Please try again later.</div>
                          </div>
                        `;
                      });
                    }).catch(error => {
                      console.error('[Cyclopedia] Error loading leaderboard data:', error);
                      col3.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;">
                          <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                          <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Load Error</div>
                          <div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not load leaderboard data</div>
                          <div style="font-size: 12px; color: #666;">Please try again later.</div>
                        </div>
                      `;
                    });
                  } else {
                    // Show loading state in col3
                    col3.innerHTML = `
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.TEXT}; text-align: center; padding: 20px;">
                        <div style="font-size: 24px; margin-bottom: 16px;">📊</div>
                        <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Loading Leaderboards...</div>
                        <div style="font-size: 14px; color: #888;">Preparing search functionality</div>
                      </div>
                    `;
                  }
                }
              } else {
                // No searched username, show default behavior
                if (playerState?.name) {
                  // Show loading state in col3
                  col3.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.TEXT}; text-align: center; padding: 20px;">
                      <div style="font-size: 24px; margin-bottom: 16px;">📊</div>
                      <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Loading Leaderboards...</div>
                      <div style="font-size: 14px; color: #888;">Preparing search functionality</div>
                    </div>
                  `;
                
                  // Update search functionality for Leaderboards
                  displayCombinedLeaderboardsData(playerState).then(() => {
                    // After col2 is updated, update col3 with search functionality
                    // Get the actual data that was fetched
                    const cachedData = getCachedLeaderboardData('combined-leaderboards');
                    if (cachedData) {
                      updateSearchForCombinedLeaderboards(playerState.rooms, globalThis.state.utils.ROOM_NAME, cachedData.best, cachedData.roomsHighscores);
                    } else {
                      updateSearchForCombinedLeaderboards(playerState.rooms, globalThis.state.utils.ROOM_NAME, null, null);
                    }
                  }).catch(error => {
                    console.error('[Cyclopedia] Error updating leaderboards data:', error);
                  });
                }
              }
            } else if (selectedCharacterItem === 'Rankings') {
              // Show rankings in col2 and hide col3
              displayUserStats('Rankings').catch(error => {
                console.error('[Cyclopedia] Error updating rankings:', error);
              });
              
              // Hide col3 for rankings
              applyCharactersRankingsColumnLayout();
              
              // Store the current state for when we return from Rankings
              // This ensures search persistence when switching back to other tabs
              if (cyclopediaState.searchedUsername) {
                // Store the current tab state to restore later
                cyclopediaState.previousTabState = {
                  searchedUsername: cyclopediaState.searchedUsername,
                  hasSearchedData: true
                };
              } else if (cyclopediaState.previousTabState && cyclopediaState.previousTabState.hasSearchedData) {
                // If we don't have a current search but have a previous one, restore it
                cyclopediaState.searchedUsername = cyclopediaState.previousTabState.searchedUsername;
              }
            }
          });
        });

        // Show player's own stats by default in col2 and col3
        (async () => {
          try {
            await displayUserStats('Player Information');
            
            // Show template/placeholder data in col3 (not actual user data)
            const container = document.createElement('div');
            Object.assign(container.style, {
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              height: '100%',
              padding: '20px',
              boxSizing: 'border-box',
              overflowY: 'hidden'
            });
            
            // Center the content
            const centeredContent = document.createElement('div');
            Object.assign(centeredContent.style, {
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              width: '100%',
              height: '100%'
            });
            
            // Create template content with placeholder data (simulating null/empty JSON)
            const templateContent = renderCyclopediaPlayerInfo({
              name: '[Player Name]',
              exp: 0,
              premium: false,
              shell: 0,
              tasks: 0,
              playCount: 0,
              perfectMonsters: 0,
              bisEquips: 0,
              maps: 0,
              ownedOutfits: 0,
              rankPoints: 0,
              ticks: 0
            }, { showShinyCreatures: false });
            
            centeredContent.appendChild(templateContent);
            container.appendChild(centeredContent);
            
            // Clear col3 and append template
            col3.innerHTML = '';
            col3.appendChild(container);
          } catch (error) {
            // Could not get player state for default profile
          }
        })();
      }, 10);
      TimerManager.addTimeout(characterSetupTimeout, 'characterSetup');

      // Content for col2 and col3
      let selectedCharacterItem = 'Player Information';
      
      // Make selectedCharacterItem accessible to the search function
      window.selectedCharacterItem = selectedCharacterItem;

      // Show player's own stats by default in col2
      displayUserStats('Player Information');

      d.characterEventListeners = [];
      const onSeasonChangedForRankings = () => {
        if (window.selectedCharacterItem !== 'Rankings') return;
        displayUserStats('Rankings').catch((error) => {
          console.error('[Cyclopedia] Error refreshing rankings after season change:', error);
        });
      };
      document.addEventListener('cyclopedia-season-changed', onSeasonChangedForRankings);
      d.characterEventListeners.push({
        element: document,
        event: 'cyclopedia-season-changed',
        handler: onSeasonChangedForRankings
      });

      d.appendChild(col1);
      d.appendChild(sharedScrollContainer);
      
      // Add cleanup function to the returned element
      d.cleanupCharactersTab = () => {
        try {
          // Clear only leaderboard cache and DOM references, preserve profile data cache
          clearLeaderboardCache();
          
          // Clear DOM references
          col1.innerHTML = '';
          col2.innerHTML = '';
          col3.innerHTML = '';
          
          // Remove event listeners (if any were stored)
          if (d.characterEventListeners) {
            d.characterEventListeners.forEach(({ element, event, handler }) => {
              element?.removeEventListener(event, handler);
            });
            d.characterEventListeners = [];
          }
          
  
        } catch (error) {
          console.error('[Cyclopedia] Error during Characters tab cleanup:', error);
        }
      };
      
      return d;
    }

    function createInventoryTabPage(selectedCreature, selectedEquipment, selectedInventory, setSelectedCreature, setSelectedEquipment, setSelectedInventory, updateRightCol) {
      const d = document.createElement('div');
      d.style.display = 'flex';
      d.style.flexDirection = 'row';
      d.style.width = '100%';
      d.style.height = '100%';
      d.style.alignItems = 'flex-start';
      d.style.justifyContent = 'center';
      d.style.gap = '0';

      let selectedCategory = pendingGazerSelection ? CYCLOPEDIA_GAZERS_CATEGORY : 'Consumables';
      let selectedInventoryItem = pendingGazerSelection || null;

      const getItemInfo = (itemKey) => {
        if (!itemKey) return { displayName: 'Unknown Item', rarity: '1' };

        const staticItem = INVENTORY_CONFIG.staticItems[itemKey];
        if (staticItem) {
          return {
            displayName: staticItem.name,
            rarity: staticItem.rarity
          };
        }

        if (itemKey.startsWith('item_')) {
          const itemId = itemKey.replace('item_', '');
          return { displayName: `Item ${itemId}`, rarity: '3' };
        }

        if (itemKey.startsWith('custom_')) {
          const customName = itemKey.replace('custom_', '').replace(/_/g, ' ');
          return {
            displayName: customName.replace(/\b\w/g, l => l.toUpperCase()),
            rarity: '1'
          };
        }

        return {
          displayName: itemKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          rarity: '1'
        };
      };

      const memoize = MemoizationUtils.memoize;
      const inventoryCategories = getCyclopediaInventoryCategories();
      const allInventoryCategories = Object.keys(inventoryCategories);

      const parseInventoryItem = (button) => {
        try {
          const slot = button.querySelector('.container-slot');
          if (!slot) return null;

          const countElement = slot.querySelector('.font-outlined-fill');
          if (!countElement) return null;

          const count = parseItemCount(countElement.textContent.trim());
          const { key, name, icon, rarity } = parseItemMetadata(slot);
          return key ? { count, name, icon, rarity, key } : null;
        } catch (error) {
  
          return null;
        }
      };

      const parseItemCount = (countText) => {
        if (countText.includes('k')) {
          const numPart = countText.replace(',', '.').replace('k', '');
          return parseFloat(numPart) * 1000;
        } else if (countText.includes('m')) {
          const numPart = countText.replace(',', '.').replace('m', '');
          return parseFloat(numPart) * 1000000;
        } else if (countText.includes(',')) {
          return parseCommaSeparatedInt(countText) ?? 0;
        }
        return parseInt(countText) || 0;
      };

      const parseItemMetadata = (slot) => {
        const spriteElement = slot.querySelector('.sprite.item');
        const imgElement = slot.querySelector('img[src]');

        if (spriteElement) {
          return parseSpriteItem(spriteElement);
        } else if (imgElement) {
          return parseImageItem(imgElement);
        }

        return { key: null, name: null, icon: null, rarity: null };
      };

      const parseSpriteItem = (spriteElement) => {
        const itemId = spriteElement.className.match(/id-(\d+)/)?.[1];
        if (!itemId) return { key: null, name: null, icon: null, rarity: null };

        const spriteMapping = {
          '35909': { key: 'diceManipulator1', name: 'Dice Manipulator (Common)' },
          '653': { key: 'outfitBag1', name: 'Outfit Bag' },
          '21383': { key: 'insightStone1', name: 'Stone of Insight (Glimpse)' },
          '43672': { key: 'monsterCauldron', name: 'Monstrous Cauldron' },
          '42363': { key: 'hygenie', name: 'Hy\'genie' }
        };

        const mapped = spriteMapping[itemId];
        if (mapped) {
          return {
            key: mapped.key,
            name: mapped.name,
            icon: getItemIcon(mapped.key),
            rarity: getItemRarity(mapped.key)
          };
        }

        return {
          key: `item_${itemId}`,
          name: spriteElement.querySelector('img')?.alt || `Item ${itemId}`,
          icon: `/assets/icons/item_${itemId}.png`,
          rarity: '3'
        };
      };

      const parseImageItem = (imgElement) => {
        const src = imgElement.src;
        const alt = imgElement.alt;

        const imageMapping = {
          'stamina': (tier) => ({ key: `stamina${tier}`, name: `Stamina Potion (Tier ${tier})` }),
          'summonscroll': (tier) => ({ key: `summonScroll${tier}`, name: `Summon Scroll (Tier ${tier})` }),
          'player-nickname': () => ({ key: 'nicknamePlayer', name: 'Player Nickname' }),
          'nickname-change': () => ({ key: 'nicknameChange', name: 'Change Nickname' }),
          'exaltation-chest': () => ({ key: 'equipChest', name: 'Exaltation Chest' }),
          'hunteroutfitbag': () => ({ key: 'hunterOutfitBag', name: 'Hunter Outfit Bag' }),
          'daycare': () => ({ key: 'daycare', name: 'Daycare' }),
          'mountainfortress': () => ({ key: 'mountainFortress', name: 'Mountain Fortress' }),
          'monster-squeezer': () => ({ key: 'monsterSqueezer', name: 'Monster Squeezer' }),
          'forge-mini': () => ({ key: 'forge', name: 'The Forge' }),
          'equipment-container': () => ({ key: 'equipmentContainer', name: 'Equipment Container' }),
          'insight-stone': (tier) => ({ key: `insightStone${tier}`, name: `Stone of Insight (Tier ${tier})` }),
          'dice': (tier) => ({ key: `diceManipulator${tier}`, name: `Dice Manipulator (Tier ${tier})` }),
          'cube': (tier) => ({ key: `surpriseCube${tier}`, name: `Surprise Cube (Tier ${tier})` }),
          'beast-coins': () => ({ key: 'beastCoins', name: 'Beast Coins' }),
          'dust': () => ({ key: 'dust', name: 'Dust' }),
          'gold': () => ({ key: 'gold', name: 'Gold' }),
          'hunting-marks': () => ({ key: 'huntingMarks', name: 'Hunting Marks' }),
          'premium': () => ({ key: 'premium', name: 'Premium' }),
          'yasir-contract': () => ({ key: 'yasirTradingContract', name: 'Yasir\'s Trading Contract' }),
          'hygenie': () => ({ key: 'hygenie', name: 'Hy\'genie' }),
          'monster-cauldron': () => ({ key: 'monsterCauldron', name: 'Monstrous Cauldron' }),
          'yasir-trading-contract': () => ({ key: 'yasirTradingContract', name: 'Yasir\'s Trading Contract' }),
          'boosted-map': () => ({ key: 'dailyBoostedMap', name: 'Daily Boosted Map' }),
          'outfit-bag': () => ({ key: 'outfitBag1', name: 'Outfit Bag' }),
          'nickname-monster': () => ({ key: 'nicknameMonster', name: 'Nickname Creature' }),
          'rune-blank': () => ({ key: 'runeBlank', name: 'Blank Rune' }),
          'rune-hp': () => ({ key: 'runeHp', name: 'Hitpoints Rune' }),
          'rune-ap': () => ({ key: 'runeAp', name: 'Ability Power Rune' }),
          'rune-ad': () => ({ key: 'runeAd', name: 'Attack Damage Rune' }),
          'rune-ar': () => ({ key: 'runeAr', name: 'Armor Rune' }),
          'rune-mr': () => ({ key: 'runeMr', name: 'Magic Resist Rune' })
        };

        for (const [pattern, mapper] of Object.entries(imageMapping)) {
          if (src.includes(pattern)) {
            const tier = src.match(new RegExp(`${pattern}(\\d+)\\.png`))?.[1];
            const mapped = mapper(tier);
            return {
              key: mapped.key,
              name: mapped.name,
              icon: src,
              rarity: getItemRarity(mapped.key)
            };
          }
        }

        const fileName = src.split('/').pop().replace('.png', '');
        return {
          key: `custom_${fileName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
          name: alt || fileName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          icon: src,
          rarity: '1'
        };
      };

      const parseRealInventory = () => {
        try {
          const inventoryContainer = DOMCache.get('.container-inventory-4');
          if (!inventoryContainer) {
            return {};
          }

          const itemButtons = Array.from(DOMCache.getAll('button', inventoryContainer));
          const inventory = {};

          itemButtons.forEach(button => {
            const itemData = parseInventoryItem(button);
            if (itemData) {
              inventory[itemData.key] = {
                count: itemData.count,
                name: itemData.name || getItemDisplayName(itemData.key),
                icon: itemData.icon || getItemIcon(itemData.key),
                rarity: itemData.rarity || getItemRarity(itemData.key),
                key: itemData.key
              };
            }
          });

          return inventory;
        } catch (error) {
          console.error('[Cyclopedia] Error parsing inventory:', error);
          return {};
        }
      };

      let inventoryCache = new WeakMap();
      const CACHE_DURATION = 5000;

      const getPlayerInventory = () => {
        try {
          const gameState = globalThis.state?.player?.getSnapshot()?.context;
          if (!gameState) return parseRealInventory();

          if (inventoryCache.has(gameState)) {
            const cached = inventoryCache.get(gameState);
            if (Date.now() - cached.timestamp < CACHE_DURATION) {
              return cached.data;
            }
          }

          const gameInventory = gameState.inventory;
          let inventory;

          if (gameInventory && Object.keys(gameInventory).length > 0) {
            inventory = gameInventory;
          } else {
            inventory = parseRealInventory();
          }

          inventoryCache.set(gameState, { data: inventory, timestamp: Date.now() });
          return inventory;
        } catch (error) {
          return parseRealInventory();
        }
      };

      const clearInventoryCache = () => {
        try {
          if (inventoryCache && typeof inventoryCache.clear === 'function') {
            inventoryCache.clear();
          } else {
            inventoryCache = new WeakMap();
          }
        } catch (error) {
  
          inventoryCache = new WeakMap();
        }
      };

      const inventory = getPlayerInventory();

      const mainItemCategories = INVENTORY_CONFIG.categories || {};

      const getItemDisplayName = memoize((itemKey) => {
        if (!itemKey) return 'Unknown Item';
        if (inventoryTooltips[itemKey]?.displayName) return inventoryTooltips[itemKey].displayName;
        return getItemInfo(itemKey).displayName;
      });

      const getItemDescription = memoize((itemKey) => {
        const displayName = getItemDisplayName(itemKey);
        if (inventoryTooltips[itemKey]?.text) return inventoryTooltips[itemKey].text;
        if (inventoryTooltips[displayName]?.text) return inventoryTooltips[displayName].text;

        return 'A mysterious item with unknown properties.';
      });

      const getItemRarity = memoize((itemKey) => {
        if (!itemKey) return '1';
        if (inventoryTooltips[itemKey]?.rarity) return inventoryTooltips[itemKey].rarity;
        return getItemInfo(itemKey).rarity;
      });

      const getRarityDisplayText = memoize((rarity) => {
        return INVENTORY_CONFIG.rarityText[rarity] || 'Common';
      });

      const getItemIcon = memoize((itemKey) => {
        const displayName = getItemDisplayName(itemKey);
        let icon = inventoryTooltips[itemKey]?.icon || inventoryTooltips[displayName]?.icon;

        if (!icon) {
          // No icon available
        }

        if (icon && !icon.startsWith('/assets/icons/') && !icon.startsWith('/assets/misc/') && !icon.startsWith('sprite://')) {
          // Icon path validation - could add fallback logic here
        }

        return icon;
      });

      const fetchCurrency = async (currencyKey, config) => {
        if (inventory[currencyKey] && inventory[currencyKey].count > 0) {
          return;
        }

        let value = null;

        if (config.uiGetter && typeof config.uiGetter === 'function') {
          value = config.uiGetter();
          if (typeof value === 'number' && !isNaN(value) && value >= 0) {
            // Value found from UI getter
          }
        }

        if ((!value || value === 0) && config.gameStateGetter && typeof config.gameStateGetter === 'function') {
          value = config.gameStateGetter();
          if (typeof value === 'number' && !isNaN(value) && value >= 0) {
            // Value found from game state getter
          }
        }

        if ((!value || value === 0) && config.gameStatePath) {
          const gameState = globalThis.state?.player?.getSnapshot()?.context;
          if (gameState) {
            const pathParts = config.gameStatePath.split('.');
            let current = gameState;

            for (const part of pathParts) {
              if (current && typeof current === 'object' && part in current) {
                current = current[part];
              } else {
                current = null;
                break;
              }
            }

            if (typeof current === 'number' && !isNaN(current) && current >= 0) {
              value = current;
            }
          }
        }

        if ((!value || value === 0) && config.apiGetter && typeof config.apiGetter === 'function') {
          try {
            const apiValue = await config.apiGetter();
            if (typeof apiValue === 'number' && !isNaN(apiValue) && apiValue >= 0) {
              value = apiValue;
            }
          } catch (error) {
            // API getter failed, continue to next method
          }
        }

        if (typeof value === 'number' && !isNaN(value) && value >= 0) {
          inventory[currencyKey] = {
            count: value,
            name: config.name,
            icon: config.icon,
            rarity: config.rarity,
            key: currencyKey
          };
        }
      };

      const currencyPromises = Object.entries(CURRENCY_CONFIG).map(([key, config]) => 
        fetchCurrency(key, config)
      );

      Promise.all(currencyPromises).then(() => {
        if (typeof updateBottomBox === 'function') {
          updateBottomBox();
        }
        if (typeof updateRightCol === 'function') {
          updateRightCol();
        }
      }).catch(error => {
        // Currency fetching failed, continue without updates
      });

      const renderSpriteIcon = (spriteId, rarity = '', size = 28) => {
        if (!spriteId.startsWith('sprite://')) return null;

        const id = spriteId.replace('sprite://', '');

        if (id === '23488') {
          return `
            <div class="container-slot surface-darker" style="width: ${size}px; height: ${size}px; overflow: visible;">
              <div class="has-rarity relative grid h-full place-items-center" data-rarity="${rarity}">
                <img src="https://bestiaryarena.com/assets/ITEM/23488.png" alt="Surprise Cube" class="pixelated" width="${size}" height="${size}" style="image-rendering: pixelated; width: ${size}px; height: ${size}px;">
              </div>
            </div>
          `;
        }

        return `
          <div class="container-slot surface-darker" style="overflow: visible;">
            <div class="has-rarity relative grid h-full place-items-center" data-rarity="${rarity}">
              <div class="relative size-sprite" style="overflow: visible;">
                <div class="sprite item id-${id} absolute bottom-0 right-0">
                  <div class="viewport">
                    <img alt="${id}" data-cropped="false" class="spritesheet" style="--cropX: 0; --cropY: 0;">
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      };

      const renderStyledImgPortrait = (iconSrc, displayName, rarity, size = 28, count = 0, itemKey = '') => {
        const noRarityKeys = GAME_DATA.NO_RARITY_KEYS;
        if (noRarityKeys.includes(itemKey)) rarity = '';

        if (!iconSrc) {
          return `<div style="width: ${size}px; height: ${size}px; background: #333; border-radius: 4px; color: #666; font-size: 10px; display: flex; align-items: center; justify-content: center;">?</div>`;
        }

        return `
          <div class="container-slot surface-darker" style="overflow: visible;">
            <div class="has-rarity relative grid h-full place-items-center" data-rarity="${rarity || ''}">
              <img src="${iconSrc}" class="pixelated" width="32" height="32" alt="${displayName || ''}">
            </div>
          </div>
        `;
      };

      const renderItemVariants = (categoryName) => {
        const variants = INVENTORY_CONFIG.variants[categoryName] || [];
        const currencyKeys = GAME_DATA.CURRENCY_KEYS;
        
        if (variants.length === 0) {
          return `
            <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: ${COLOR_CONSTANTS.TEXT}; font-weight: bold; text-align: center;">
              No variants found for ${categoryName}
            </div>
          `;
        }

        const noRarityKeys = GAME_DATA.NO_RARITY_KEYS;
        const inventory = getPlayerInventory();

        const variantsHtml = variants.map(itemKey => {
          try {
            const displayName = getItemDisplayName(itemKey);
            const description = getItemDescription(itemKey);
            const rarity = getItemRarity(itemKey);
            const icon = getItemIcon(itemKey);
            
            const itemData = inventory[itemKey];
            let count = inventoryDatabase.getInventoryItemCount
              ? inventoryDatabase.getInventoryItemCount(inventory, itemKey)
              : (inventory[itemKey] || 0);
            let realIcon = icon;
            let realRarity = rarity;
            
            if (itemData && typeof itemData === 'object') {
              realIcon = itemData.icon || icon;
              realRarity = itemData.rarity || rarity;
            }
            
            const obtainMethod = getItemObtainMethod(itemKey);
            const rarityColors = INVENTORY_CONFIG.rarityColors;
            const isNoRarity = noRarityKeys.includes(itemKey);
            const nameColor = isNoRarity ? COLOR_CONSTANTS.TEXT : (rarityColors[realRarity] || '#fff');
            const raritySpan = isNoRarity ? '' : `<span style="color: ${rarityColors[realRarity] || '#666'}; font-size: 11px;">${getRarityDisplayText(realRarity)}</span>`;

            const upgradeKeys = GAME_DATA.UPGRADE_KEYS;
            const upgradeableItems = (inventoryDatabase && inventoryDatabase.upgradeableItems) || [];
            const isUpgradeable = upgradeableItems.includes(itemKey);
            const formattedCount = currencyKeys.includes(itemKey)
              ? `<span style=\"color: #ffe066; font-weight: bold; cursor: help;\" title=\"${count.toLocaleString()}\">${FormatUtils.currency(count)}</span>`
              : upgradeKeys.includes(itemKey)
              ? `<span style=\"color: #888; font-style: italic;\">${isUpgradeable ? 'Upgradeable' : 'One-time purchase'}</span>`
              : `<span style=\"color: #ffe066; font-weight: bold;\">${count}</span>`;

            return `
              <div style="background: rgba(255,255,255,0.03); border: 1px solid #333; border-radius: 6px; padding: 16px; margin-bottom: 12px; cursor: pointer;" 
                   onclick="window.cyclopediaSelectVariant && window.cyclopediaSelectVariant('${itemKey}')"
                   onmouseenter="this.style.background='rgba(255,255,255,0.08)'"
                   onmouseleave="this.style.background='rgba(255,255,255,0.03)'">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                  <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                    ${realIcon && realIcon.startsWith('sprite://') ? renderSpriteIcon(realIcon, realRarity, 28) : renderStyledImgPortrait(realIcon || '', displayName, realRarity, 28, count, itemKey)}
                  </div>
                  <div style="flex: 1;">
                    <h4 style="margin: 0; color: ${nameColor}; font-size: 16px; font-weight: bold;">${displayName}</h4>
                    ${raritySpan}
                  </div>
                </div>
                <div style="color: #e6d7b0; font-size: 12px; line-height: 1.3; margin-bottom: 8px;">${description}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                  <span style="color: #888;">${obtainMethod || 'Unknown source'}</span>
                  ${formattedCount}
                </div>
              </div>
            `;
          } catch (error) {
    
            return `
              <div style="background: rgba(255,0,0,0.1); border: 1px solid #f00; border-radius: 6px; padding: 16px; margin-bottom: 12px;">
                <div style="color: #f00; font-size: 12px;">Error loading ${itemKey}</div>
              </div>
            `;
          }
        }).join('');

        return `
          <div style="display: flex; flex-direction: column; min-height: 0;">
            <div style="padding: 16px; border-bottom: 1px solid #333; background: rgba(255,255,255,0.02);">
              <h3 style="margin: 0; color: ${COLOR_CONSTANTS.TEXT}; font-size: 18px; font-weight: bold;">
                ${categoryName}
              </h3>
              <span style="color: #888; font-size: 12px;">(${variants.length} variants)</span>
            </div>
            <div style="flex: 1; overflow-y: auto; padding: 16px; min-height: 0;">
              ${variantsHtml}
            </div>
          </div>
        `;
      };

      function renderItemDetails(itemKey) {
        try {
          const inventoryTooltips = window.inventoryTooltips;
          if (inventoryTooltips && inventoryTooltips[itemKey] && inventoryTooltips[itemKey].html) {
            return `<div class="cyclopedia-tooltip-html">${inventoryTooltips[itemKey].html}</div>`;
          }

          const displayName = getItemDisplayName(itemKey);
          const description = getItemDescription(itemKey);
          const rarity = getItemRarity(itemKey);
          const rarityText = getRarityDisplayText(rarity);
          const icon = getItemIcon(itemKey);
          
          const itemData = inventory[itemKey];
          let count = inventoryDatabase.getInventoryItemCount
            ? inventoryDatabase.getInventoryItemCount(inventory, itemKey)
            : (inventory[itemKey] || 0);
          let realIcon = icon;
          let realRarity = rarity;
          
          if (itemData && typeof itemData === 'object') {
            realIcon = itemData.icon || icon;
            realRarity = itemData.rarity || rarity;
          }

          const rarityColors = GAME_DATA.RARITY_COLORS;

          let category = 'Unknown';
                  if (Object.keys(INVENTORY_CONFIG.variants).some(cat => INVENTORY_CONFIG.variants[cat].includes(itemKey))) {
          category = Object.keys(INVENTORY_CONFIG.variants).find(cat => INVENTORY_CONFIG.variants[cat].includes(itemKey));
          }

          const obtainMethod = getItemObtainMethod(itemKey);

          const noRarityKeys = GAME_DATA.NO_RARITY_KEYS;
          const isNoRarity = noRarityKeys.includes(itemKey);
          const nameColor = isNoRarity ? COLOR_CONSTANTS.TEXT : (rarityColors[realRarity] || '#fff');
          const raritySpan = isNoRarity ? '' : `<span style="color: ${rarityColors[realRarity] || '#666'}; font-size: 12px;">${getRarityDisplayText(realRarity)}</span>`;

          const currencyKeys = GAME_DATA.CURRENCY_KEYS;
          const upgradeKeys = GAME_DATA.UPGRADE_KEYS;
          const upgradeableItems = (inventoryDatabase && inventoryDatabase.upgradeableItems) || [];
          const isUpgradeable = upgradeableItems.includes(itemKey);
          const formattedCount = currencyKeys.includes(itemKey)
            ? FormatUtils.currency(count)
            : upgradeKeys.includes(itemKey)
            ? (isUpgradeable ? 'Upgradeable' : 'One-time purchase')
            : count;

          return `
            <div style="display: flex; flex-direction: column; gap: 16px; padding: 16px; min-height: 0; overflow-y: auto;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                  ${realIcon && realIcon.startsWith('sprite://') ? renderSpriteIcon(realIcon, realRarity, 28) : renderStyledImgPortrait(realIcon || '', displayName, realRarity, 28, count, itemKey)}
                </div>
                <div>
                  <h3 style="margin: 0; color: ${nameColor}; font-size: 18px; font-weight: bold;">${displayName}</h3>
                  ${raritySpan}
                </div>
              </div>
              <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 4px; border-left: 3px solid ${rarityColors[realRarity] || '#666'};">
                <p style="margin: 0; color: #e6d7b0; line-height: 1.4; font-size: 14px;">${description}</p>
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #333;">
                  <span style="color: #888; font-size: 12px;">Category:</span>
                  <span style="color: #e6d7b0; font-size: 12px;">${category}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #333;">
                  <span style="color: #888; font-size: 12px;">Obtain:</span>
                  <span style="color: #e6d7b0; font-size: 12px;">${obtainMethod}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #333;">
                  <span style="color: #888; font-size: 12px;">${upgradeKeys.includes(itemKey) ? 'Status:' : 'In Your Inventory:'}</span>
                  <span 
                    style="color: #ffe066; font-size: 16px; font-weight: bold;"
                  >
                    ${formattedCount}
                  </span>
                </div>
              </div>
            </div>
          `;
        } catch (error) {
          console.error('[Cyclopedia] Error rendering item details:', error);
          return `
            <div style="display: flex; flex-direction: column; gap: 16px; padding: 16px; min-height: 0; overflow-y: auto;">
              <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: ${COLOR_CONSTANTS.TEXT}; font-weight: bold; text-align: center;">
                Error loading item details for ${itemKey}.<br>Inventory tooltips not available.
              </div>
            </div>
          `;
        }
      }

      const getItemObtainMethod = (itemKey) => {
        const displayName = getItemDisplayName(itemKey);
        if (inventoryTooltips[displayName]?.obtain) return inventoryTooltips[displayName].obtain;
        if (inventoryTooltips[itemKey]?.obtain) return inventoryTooltips[itemKey].obtain;

        return '';
      };

      function getPlayerInventoryCount(itemKey) {
        try {
          if (!itemKey) return 0;
          const playerInventory = getPlayerInventory();
          if (inventoryDatabase.getInventoryItemCount) {
            return inventoryDatabase.getInventoryItemCount(playerInventory, itemKey);
          }
          const itemData = playerInventory[itemKey];
          if (itemData && typeof itemData === 'object') {
            return itemData.count || 0;
          }
          return playerInventory[itemKey] || 0;
        } catch (error) {
          console.error('[Cyclopedia] Error getting inventory count:', error);
          return 0;
        }
      }

      const debouncedRefreshInventory = debounce(() => {
        try {
          clearInventoryCache();
          const newInventory = getPlayerInventory();
          return newInventory;
        } catch (error) {
          console.error('[Cyclopedia] Error refreshing inventory:', error);
          return {};
        }
      }, 1000);

      function refreshInventoryData() {
        return debouncedRefreshInventory();
      }

      const leftCol = document.createElement('div');
      leftCol.style.width = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.minWidth = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.maxWidth = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.height = '100%';
      leftCol.style.display = 'flex';
      leftCol.style.flexDirection = 'column';
      leftCol.style.borderRight = '6px solid transparent';
      leftCol.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
      leftCol.style.overflowY = 'hidden';
      leftCol.style.minHeight = '0';

      function updateBottomBox() {
        try {
          if (leftCol._bottomBox && leftCol._bottomBox.parentNode) {
            safeRemoveChild(leftCol._bottomBox.parentNode, leftCol._bottomBox);
          }
          
          const rawItems = inventoryCategories[selectedCategory] || [];
          const isGazersCategory = selectedCategory === CYCLOPEDIA_GAZERS_CATEGORY;
          const items = isGazersCategory
            ? rawItems
            : rawItems.map(itemKey => getItemDisplayName(itemKey));

          const box = createBox({
            title: selectedCategory,
            items: items,
            type: isGazersCategory ? 'creature' : 'inventory',
            selectedCreature: isGazersCategory ? selectedInventoryItem : null,
            selectedEquipment: null,
            selectedInventory: isGazersCategory
              ? null
              : (selectedInventoryItem ? getItemDisplayName(selectedInventoryItem) : null),
            setSelectedCreature: isGazersCategory
              ? (creatureName) => {
                selectedInventoryItem = creatureName;
                updateRightCol();
              }
              : () => {},
            setSelectedEquipment: () => {},
            setSelectedInventory: isGazersCategory
              ? () => {}
              : (itemDisplayName) => {
                const itemKey = rawItems.find(key => getItemDisplayName(key) === itemDisplayName);
                selectedInventoryItem = itemKey || itemDisplayName;
                updateRightCol();
              },
            updateRightCol: () => {}
          });

          box.style.flex = '1 1 0';
          box.style.minHeight = '0';
          box.style.marginTop = '8px';
          leftCol._bottomBox = box;
          leftCol.appendChild(box);
        } catch (error) {
          console.error('[Cyclopedia] Error updating bottom box:', error);
          
          if (leftCol._bottomBox && leftCol._bottomBox.parentNode) {
            safeRemoveChild(leftCol._bottomBox.parentNode, leftCol._bottomBox);
          }

          const errorBox = document.createElement('div');
          errorBox.style.flex = '1 1 0';
          errorBox.style.minHeight = '0';
          errorBox.style.marginTop = '8px';
          errorBox.style.display = 'flex';
          errorBox.style.justifyContent = 'center';
          errorBox.style.alignItems = 'center';
          errorBox.style.color = COLOR_CONSTANTS.TEXT;
          errorBox.style.fontWeight = 'bold';
          errorBox.style.textAlign = 'center';
          errorBox.innerHTML = 'Error loading inventory items.';
          leftCol._bottomBox = errorBox;
          leftCol.appendChild(errorBox);
        }
      }

      const topBox = createBox({
        title: 'Inventory',
        items: allInventoryCategories,
        type: 'inventory',
        selectedCreature: null,
        selectedEquipment: null,
        selectedInventory: selectedCategory,
        setSelectedCreature: () => {},
        setSelectedEquipment: () => {},
        setSelectedInventory: (cat) => {
          selectedCategory = cat;
          selectedInventoryItem = null;
          updateBottomBox();
          updateRightCol();
        },
        updateRightCol: () => {}
      });

      topBox.style.flex = '0 0 40%';
      topBox.style.maxHeight = '40%';
      topBox.style.minHeight = '0';
      leftCol.appendChild(topBox);
      updateBottomBox();

      const rightCol = document.createElement('div');
      rightCol.style.flex = '1';
      rightCol.style.padding = '0';
      rightCol.style.margin = '0';
      rightCol.style.height = '100%';
      rightCol.style.borderImage = 'none';
      rightCol.style.overflowY = 'auto';
      
      function updateRightCol() {
        try {
          if (selectedInventoryItem && selectedCategory === CYCLOPEDIA_GAZERS_CATEGORY) {
            rightCol.innerHTML = '';
            rightCol.appendChild(renderCreatureTemplate(selectedInventoryItem, false));
            return;
          }
          if (selectedInventoryItem) {
            if (INVENTORY_CONFIG.variants[selectedInventoryItem]) {
              rightCol.innerHTML = renderItemVariants(selectedInventoryItem);
            } else {
              rightCol.innerHTML = renderItemDetails(selectedInventoryItem);
            }
          } else {
            const emptyMessage = selectedCategory === CYCLOPEDIA_GAZERS_CATEGORY
              ? 'Select a gazer to view details.'
              : 'Select an item category to view variants.';
            rightCol.innerHTML = '<div class="' + FONT_CONSTANTS.SIZES.BODY + '" style="display:flex;justify-content:center;align-items:center;height:100%;width:100%;color:' + COLOR_CONSTANTS.TEXT + ';font-weight:bold;text-align:center;">' + emptyMessage + '</div>';
          }
        } catch (error) {
          console.error('[Cyclopedia] Error updating right column:', error);
          rightCol.innerHTML = '<div class="' + FONT_CONSTANTS.SIZES.BODY + '" style="display:flex;justify-content:center;align-items:center;height:100%;width:100%;color:' + COLOR_CONSTANTS.TEXT + ';font-weight:bold;text-align:center;">Error loading content.</div>';
        }
      }

      window.cyclopediaSelectVariant = function(itemKey) {
        selectedInventoryItem = itemKey;
        updateRightCol();
      };

      let gameStateSubscription = null;
      try {
        if (globalThis.state?.player?.subscribe) {
          gameStateSubscription = globalThis.state.player.subscribe((snapshot) => {
            const newInventory = snapshot?.context?.inventory;
            if (newInventory) {
              clearInventoryCache();
              debouncedRefreshInventory();
              updateBottomBox();
              updateRightCol();
            }
          });
        }
      } catch (error) {

      }

      clearInventoryCache();
      updateRightCol();
      
      const cleanupSubscription = () => {
        if (gameStateSubscription && typeof gameStateSubscription === 'function') {
          try {
            gameStateSubscription();
          } catch (error) {
    
          }
        }
      };

      d._cleanupSubscription = cleanupSubscription;

      d.appendChild(leftCol);
      d.appendChild(rightCol);
      return d;
    }

    // Helper function to get local runs for a map from RunTracker
    async function getLocalRunsForMap(mapKey, category) {
      try {
        if (window.RunTrackerAPI && window.RunTrackerAPI.getRuns) {
          const runs = window.RunTrackerAPI.getRuns(mapKey, category);
          return filterLocalRunsByActiveSeason(Array.isArray(runs) ? runs : []);
        }
        return [];
      } catch (error) {
        console.error('[Cyclopedia] Error getting local runs:', error);
        return [];
      }
    }

    // Helper function to create statistics section
    function createStatisticsSection(selectedMap) {
      const statsLineTruncate = 'width: 100%; max-width: 100%; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; box-sizing: border-box;';
      const statsContainer = document.createElement('div');
      statsContainer.style.display = 'flex';
      statsContainer.style.flexDirection = 'column';
      statsContainer.style.width = '100%';
      statsContainer.style.height = '100%';
      statsContainer.style.boxSizing = 'border-box';
      
      // Row 1: 30% height, split into 2 columns
      const row1 = document.createElement('div');
      row1.style.display = 'flex';
      row1.style.flexDirection = 'row';
      row1.style.height = '30%';
      row1.style.minHeight = '30%';
      row1.style.maxHeight = '30%';
      row1.style.borderBottom = '6px solid transparent';
      row1.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
      
      // Column 1: Speedrun
      const speedrunCol = document.createElement('div');
      speedrunCol.style.flex = '1 1 0';
      speedrunCol.style.maxWidth = '160px';
      speedrunCol.style.minWidth = '0';
      speedrunCol.style.display = 'flex';
      speedrunCol.style.flexDirection = 'column';
      speedrunCol.style.padding = '5px';
      speedrunCol.style.borderRight = '3px solid transparent';
      speedrunCol.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
      speedrunCol.style.borderLeft = 'none';
      
      const speedrunTitle = document.createElement('h3');
      speedrunTitle.style.margin = '0 0 10px 0';
      speedrunTitle.style.fontSize = '16px';
      speedrunTitle.style.fontWeight = 'bold';
      speedrunTitle.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
      speedrunTitle.style.textAlign = 'center';
      speedrunTitle.style.color = COLOR_CONSTANTS.TEXT;
      speedrunTitle.style.display = 'flex';
      speedrunTitle.style.alignItems = 'center';
      speedrunTitle.style.justifyContent = 'center';
      speedrunTitle.style.gap = '6px';
      
      const speedIcon = document.createElement('img');
      speedIcon.src = 'https://bestiaryarena.com/assets/icons/speed.png';
      speedIcon.alt = 'Speed';
      speedIcon.style.width = '16px';
      speedIcon.style.height = '16px';
      
      const speedrunText = document.createElement('span');
      speedrunText.textContent = 'Speedrun';
      
      speedrunTitle.appendChild(speedIcon);
      speedrunTitle.appendChild(speedrunText);
      speedrunCol.appendChild(speedrunTitle);
      
      const speedrunContent = document.createElement('div');
      speedrunContent.style.flex = '1';
      speedrunContent.style.display = 'flex';
      speedrunContent.style.flexDirection = 'column';
      speedrunContent.style.justifyContent = 'center';
      speedrunContent.style.alignItems = 'center';
      speedrunContent.style.color = '#888';
      speedrunContent.style.fontSize = '14px';
      speedrunContent.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
      speedrunContent.style.textAlign = 'center';
      speedrunContent.style.padding = '2px';
      speedrunContent.style.width = '100%';
      speedrunContent.style.minWidth = '0';
      speedrunContent.style.boxSizing = 'border-box';
      speedrunContent.innerHTML = '<div style="margin-bottom: 10px;">Loading...</div>';
      speedrunCol.appendChild(speedrunContent);
      
      // Column 2: Rank Points
      const rankPointsCol = document.createElement('div');
      rankPointsCol.style.flex = '1 1 0';
      rankPointsCol.style.maxWidth = '160px';
      rankPointsCol.style.minWidth = '0';
      rankPointsCol.style.display = 'flex';
      rankPointsCol.style.flexDirection = 'column';
      rankPointsCol.style.padding = '5px';
      rankPointsCol.style.borderRight = '3px solid transparent';
      rankPointsCol.style.borderLeft = '3px solid transparent';
      rankPointsCol.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
      
      const rankPointsTitle = document.createElement('h3');
      rankPointsTitle.style.margin = '0 0 10px 0';
      rankPointsTitle.style.fontSize = '16px';
      rankPointsTitle.style.fontWeight = 'bold';
      rankPointsTitle.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
      rankPointsTitle.style.textAlign = 'center';
      rankPointsTitle.style.color = COLOR_CONSTANTS.TEXT;
      rankPointsTitle.style.display = 'flex';
      rankPointsTitle.style.alignItems = 'center';
      rankPointsTitle.style.justifyContent = 'center';
      rankPointsTitle.style.gap = '6px';
      
      const gradeIcon = document.createElement('img');
      gradeIcon.src = 'https://bestiaryarena.com/assets/icons/grade.png';
      gradeIcon.alt = 'Grade';
      gradeIcon.style.width = '16px';
      gradeIcon.style.height = '16px';
      
      const rankPointsText = document.createElement('span');
      rankPointsText.textContent = 'Rank Points';
      
      rankPointsTitle.appendChild(gradeIcon);
      rankPointsTitle.appendChild(rankPointsText);
      rankPointsCol.appendChild(rankPointsTitle);
      
      const rankPointsContent = document.createElement('div');
      rankPointsContent.style.flex = '1';
      rankPointsContent.style.display = 'flex';
      rankPointsContent.style.flexDirection = 'column';
      rankPointsContent.style.justifyContent = 'center';
      rankPointsContent.style.alignItems = 'center';
      rankPointsContent.style.color = '#888';
      rankPointsContent.style.fontSize = '14px';
      rankPointsContent.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
      rankPointsContent.style.textAlign = 'center';
      rankPointsContent.style.padding = '2px';
      rankPointsContent.style.width = '100%';
      rankPointsContent.style.minWidth = '0';
      rankPointsContent.style.boxSizing = 'border-box';
      rankPointsContent.innerHTML = '<div style="margin-bottom: 10px;">Loading...</div>';
      rankPointsCol.appendChild(rankPointsContent);
      
      // Column 3: Floors
      const floorsCol = document.createElement('div');
      floorsCol.style.flex = '1 1 0';
      floorsCol.style.maxWidth = '180px';
      floorsCol.style.minWidth = '0';
      floorsCol.style.display = 'flex';
      floorsCol.style.flexDirection = 'column';
      floorsCol.style.padding = '5px';
      floorsCol.style.borderLeft = '3px solid transparent';
      floorsCol.style.borderRight = 'none';
      floorsCol.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
      
      const floorsTitle = document.createElement('h3');
      floorsTitle.style.margin = '0 0 10px 0';
      floorsTitle.style.fontSize = '16px';
      floorsTitle.style.fontWeight = 'bold';
      floorsTitle.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
      floorsTitle.style.textAlign = 'center';
      floorsTitle.style.color = COLOR_CONSTANTS.TEXT;
      floorsTitle.style.display = 'flex';
      floorsTitle.style.alignItems = 'center';
      floorsTitle.style.justifyContent = 'center';
      floorsTitle.style.gap = '6px';
      
      const floorsIcon = document.createElement('img');
      floorsIcon.src = 'https://bestiaryarena.com/assets/icons/floors.png';
      floorsIcon.alt = 'Floors';
      floorsIcon.style.width = '16px';
      floorsIcon.style.height = '16px';
      
      const floorsText = document.createElement('span');
      floorsText.textContent = 'Floors';
      
      floorsTitle.appendChild(floorsIcon);
      floorsTitle.appendChild(floorsText);
      floorsCol.appendChild(floorsTitle);
      
      const floorsContent = document.createElement('div');
      floorsContent.style.flex = '1';
      floorsContent.style.display = 'flex';
      floorsContent.style.flexDirection = 'column';
      floorsContent.style.justifyContent = 'center';
      floorsContent.style.alignItems = 'center';
      floorsContent.style.color = '#888';
      floorsContent.style.fontSize = '14px';
      floorsContent.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
      floorsContent.style.textAlign = 'center';
      floorsContent.style.padding = '2px';
      floorsContent.style.width = '100%';
      floorsContent.style.minWidth = '0';
      floorsContent.style.boxSizing = 'border-box';
      floorsContent.innerHTML = '<div style="margin-bottom: 10px;">Loading...</div>';
      floorsCol.appendChild(floorsContent);
      
      // Add columns to row1
      row1.appendChild(speedrunCol);
      row1.appendChild(rankPointsCol);
      row1.appendChild(floorsCol);
      
      // Row 2: Top 5 tables (max 180px height)
      const row2 = document.createElement('div');
      row2.style.maxHeight = '180px';
      row2.style.height = '180px';
      row2.style.display = 'flex';
      row2.style.flexDirection = 'row';
      row2.style.alignItems = 'center';
      row2.style.justifyContent = 'center';
      
      // Left column: Top 5 Speedruns
      const speedrunTableCol = document.createElement('div');
      speedrunTableCol.setAttribute('data-table-type', 'speedrun');
      speedrunTableCol.style.flex = '1 1 0';
      speedrunTableCol.style.maxWidth = '160px';
      speedrunTableCol.style.display = 'flex';
      speedrunTableCol.style.flexDirection = 'column';
      speedrunTableCol.style.padding = '2px';
      speedrunTableCol.style.borderRight = '3px solid transparent';
      speedrunTableCol.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
      
      const speedrunTableTitle = document.createElement('div');
      speedrunTableTitle.style.fontSize = '16px';
      speedrunTableTitle.style.fontWeight = 'bold';
      speedrunTableTitle.style.color = COLOR_CONSTANTS.TEXT;
      speedrunTableTitle.style.marginBottom = '10px';
      speedrunTableTitle.style.textAlign = 'center';
      speedrunTableTitle.textContent = 'Top 5 Speedruns';
      speedrunTableCol.appendChild(speedrunTableTitle);
      
      const speedrunTable = DOMUtils.createStyledElement('div', {
        border: '6px solid transparent',
        borderImage: 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch',
        borderRadius: '0',
        overflow: 'hidden',
        overflowY: 'auto',
        boxSizing: 'border-box',
        height: '130px',
        maxHeight: '130px',
        background: 'url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png") repeat'
      });
      
      // Table header
      const speedrunHeader = DOMUtils.createStyledElement('div', {
        display: 'grid',
        gridTemplateColumns: '1fr 20px 20px',
        background: 'url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png") repeat',
        borderBottom: '1px solid #444',
        position: 'sticky',
        top: '0',
        zIndex: '2',
        fontWeight: 'bold',
        fontSize: '11px',
        fontFamily: "'Trebuchet MS', 'Arial Black', Arial, sans-serif",
        color: COLOR_CONSTANTS.TEXT
      });
      
      const timeHeader = DOMUtils.createTableCell('Time', { padding: '6px 4px' });
      speedrunHeader.appendChild(timeHeader);
      
      const copyHeader = DOMUtils.createTableCell('', { padding: '4px 2px' });
      speedrunHeader.appendChild(copyHeader);
      
      const deleteHeader = DOMUtils.createTableCell('', { padding: '4px 2px', borderRight: 'none' });
      speedrunHeader.appendChild(deleteHeader);
      
      speedrunTable.appendChild(speedrunHeader);
      
      // Store yourRooms and WR data for warning icon comparisons
      let currentYourRooms = null;
      let currentWorldRecordTicks = 0;
      
      // Function to populate speedrun table with local data
      async function populateSpeedrunTable() {
        try {
          
          // Resolve the map name to ensure consistency with RunTracker
          const resolvedMapName = resolveMapName(selectedMap);
          const mapKey = `map_${resolvedMapName.toLowerCase().replace(/\s+/g, '_')}`;
          
          
          let localRuns = await getLocalRunsForMap(mapKey, 'speedrun');
          
          
          // Ensure currentYourRooms is populated for warning icon comparisons
          if (!currentYourRooms) {
            const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
            currentYourRooms = getYourRoomsForCyclopediaSeason(playerState?.rooms || {});
          }
          
          // Filter out defeated runs with 0 rank points (for consistency)
          if (localRuns && localRuns.length > 0) {
            const originalCount = localRuns.length;
            localRuns = localRuns.filter(run => !run.points || run.points > 0);
            const filteredCount = localRuns.length;
            if (originalCount !== filteredCount) {
              
            }
          }
          
          // Sort speedrun data: 1. Ticks (ascending), 2. Date (newest first)
          if (localRuns && localRuns.length > 0) {
            localRuns.sort((a, b) => {
              // First priority: Ticks (lower is better)
              if (a.time !== b.time) {
                return (a.time || Infinity) - (b.time || Infinity);
              }
              // Second priority: Date (newer is better)
              const dateA = a.date || a.timestamp || 0;
              const dateB = b.date || b.timestamp || 0;
              return dateB - dateA;
            });
            
          }
          
          if (!localRuns || localRuns.length === 0) {
            // Show empty state
            for (let i = 1; i <= 5; i++) {
              const row = document.createElement('div');
              row.style.display = 'grid';
              row.style.gridTemplateColumns = '1fr 20px 20px';
              row.style.borderBottom = i < 5 ? '1px solid #333' : 'none';
              row.style.fontSize = '10px';
              row.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
              row.style.color = '#666';
              
              const timeCell = document.createElement('div');
              timeCell.style.padding = '4px 2px';
              timeCell.style.borderRight = '1px solid #333';
              timeCell.style.textAlign = 'center';
              timeCell.textContent = '-';
              row.appendChild(timeCell);
              
              const copyCell = document.createElement('div');
              copyCell.style.padding = '2px 1px';
              copyCell.style.borderRight = '1px solid #333';
              copyCell.style.textAlign = 'center';
              copyCell.innerHTML = '';
              row.appendChild(copyCell);
              
              const deleteCell = document.createElement('div');
              deleteCell.style.padding = '2px 1px';
              deleteCell.style.textAlign = 'center';
              deleteCell.innerHTML = '';
              row.appendChild(deleteCell);
              
              speedrunTable.appendChild(row);
            }
            return;
          }
          
          // Populate with actual data
          for (let i = 0; i < 5; i++) {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '1fr 20px 20px';
            row.style.borderBottom = i < 4 ? '1px solid #333' : 'none';
            row.style.fontSize = '10px';
            row.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
            
            const run = localRuns[i];
            
            if (!run) {
              // No run for this slot - show "No runs" without buttons
              row.style.color = '#666';
              
              const timeCell = document.createElement('div');
              timeCell.style.padding = '4px 2px';
              timeCell.style.borderRight = '1px solid #333';
              timeCell.style.textAlign = 'center';
              timeCell.textContent = '-';
              row.appendChild(timeCell);
              
              const copyCell = document.createElement('div');
              copyCell.style.padding = '2px 1px';
              copyCell.style.borderRight = '1px solid #333';
              copyCell.style.textAlign = 'center';
              copyCell.innerHTML = '';
              row.appendChild(copyCell);
              
              const deleteCell = document.createElement('div');
              deleteCell.style.padding = '2px 1px';
              deleteCell.style.textAlign = 'center';
              deleteCell.innerHTML = '';
              row.appendChild(deleteCell);
              
              speedrunTable.appendChild(row);
              continue;
            }
            
            // Has run data - show with buttons
            row.style.color = '#ccc';
            
            const timeCell = document.createElement('div');
            timeCell.style.padding = '4px 2px';
            timeCell.style.borderRight = '1px solid #333';
            timeCell.style.textAlign = 'center';
            timeCell.style.display = 'flex';
            timeCell.style.alignItems = 'center';
            timeCell.style.justifyContent = 'center';
            timeCell.style.gap = '4px';
            timeCell.style.position = 'relative';
            
            if (run.time) {
              const timeText = document.createElement('span');
              
              
              const yourTicks = currentYourRooms?.[selectedMap]?.ticks || 0;
              const wrTicks = currentWorldRecordTicks || 0;
              const warningState = getCyclopediaRunWarningState(run, {
                isTimeInvalid: yourTicks > 0 && run.time < yourTicks,
                isWorldRecordInvalid: wrTicks > 0 && run.time < wrTicks
              });

              timeText.textContent = formatLocalRunTime(run.time);
              if (warningState.shouldWarn) {
                decorateCyclopediaRunWarningCell(timeCell, timeText, row, warningState);
              } else {
                timeCell.appendChild(timeText);
              }
            } else {
              timeCell.textContent = 'N/A';
              
            }
            
            row.appendChild(timeCell);
            
            const copyCell = document.createElement('div');
            copyCell.style.padding = '2px 1px';
            copyCell.style.borderRight = '1px solid #333';
            copyCell.style.textAlign = 'center';
            copyCell.style.cursor = 'pointer';
            copyCell.style.color = '#4CAF50';
            copyCell.style.fontSize = '14px';
            copyCell.innerHTML = '🔗';
            copyCell.title = 'Copy $replay command';
            
            if (run.seed) {
              // Add click animation styles
              copyCell.style.transition = 'all 0.1s ease';
              copyCell.style.userSelect = 'none';
              
              copyCell.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Click animation
                copyCell.style.transform = 'scale(0.9)';
                copyCell.style.opacity = '0.7';
                setTimeout(() => {
                  copyCell.style.transform = 'scale(1)';
                  copyCell.style.opacity = '1';
                }, 100);
                
                
                
                // Generate replay command with board configuration if available
                let replayData = {};
                
                // Get proper region and map names
                let regionName = 'Unknown Region';
                let mapName = resolveMapName(selectedMap); // Use resolved map name
                
                // First, try to use the region name that RunTracker already resolved and saved
                if (run.regionName) {
                  regionName = run.regionName;
                  
                } else {
                  // Try to determine region from the map name/ID using game state utils
                  try {
                    const mapId = selectedMap;
                    let foundRegion = null;
                    
                    // Search through all regions to find which one contains this map
                    if (globalThis.state?.utils?.REGIONS) {
                      for (const region of globalThis.state.utils.REGIONS) {
                        if (region.rooms && region.rooms.some(room => room.id === mapId)) {
                          foundRegion = region;
                          break;
                        }
                      }
                    }
                    
                    if (foundRegion) {
                      regionName = cyclopediaGetRegionDisplayName(foundRegion.id);
                      
                    } else {
                      // Fallback: try to get region from current game state (this is the problematic part)
                      const boardSnapshot = globalThis.state?.board?.getSnapshot();
                      if (boardSnapshot?.context?.selectedMap?.selectedRegion?.name) {
                        regionName = boardSnapshot.context.selectedMap.selectedRegion.name;
                        
                      } else if (boardSnapshot?.context?.selectedMap?.selectedRegion?.id) {
                        regionName = boardSnapshot.context.selectedMap.selectedRegion.id;
                        // Capitalize region name
                        regionName = cyclopediaGetRegionDisplayName(regionName);
                        
                      }
                    }
                  } catch (e) {
                    console.warn('[Cyclopedia] Error getting region from game state:', e);
                  }
                }
                
                replayData.region = regionName;
                replayData.map = mapName;
                
                Object.assign(replayData, buildLocalRunReplayFields(run));
                
                // Add seed at the end
                replayData.seed = run.seed;
                
                const replayCommand = `$replay(${JSON.stringify(replayData)})`;
                
                navigator.clipboard.writeText(replayCommand).then(() => {
                  
                  // Update status bar with success message
                  if (row3 && row3.statusBar) {
                    // Check if there's an active delete confirmation
                    const hasActiveDeleteConfirmation = DOMCache.get('[data-confirming="true"]');
                    if (hasActiveDeleteConfirmation) {
                      // Don't change the status bar if there's an active delete confirmation
                      return;
                    }
                    
                    // Clear any existing timeout
                    if (row3.statusBarTimeout) {
                      clearTimeout(row3.statusBarTimeout);
                    }
                    row3.statusBar.textContent = 'Successfully copied run!';
                    row3.statusBar.style.color = '#4CAF50';
                    // Reset status bar after 3 seconds
                    row3.statusBarTimeout = setTimeout(() => {
                      row3.statusBar.textContent = 'These are your saved top records.';
                      row3.statusBar.style.color = '#ccc';
                      row3.statusBarTimeout = null;
                    }, 3000);
                  }
                }).catch(err => {
                  console.error('[Cyclopedia] Failed to copy speedrun replay command:', err);
                  // Update status bar with error message
                  if (row3 && row3.statusBar) {
                    // Check if there's an active delete confirmation
                    const hasActiveDeleteConfirmation = DOMCache.get('[data-confirming="true"]');
                    if (hasActiveDeleteConfirmation) {
                      // Don't change the status bar if there's an active delete confirmation
                      return;
                    }
                    
                    // Clear any existing timeout
                    if (row3.statusBarTimeout) {
                      clearTimeout(row3.statusBarTimeout);
                    }
                    row3.statusBar.textContent = 'Failed to copy run!';
                    row3.statusBar.style.color = '#f44336';
                    // Reset status bar after 3 seconds
                    row3.statusBarTimeout = setTimeout(() => {
                      row3.statusBar.textContent = 'These are your saved top records.';
                      row3.statusBar.style.color = '#ccc';
                      row3.statusBarTimeout = null;
                    }, 3000);
                  }
                });
              });
            }
            row.appendChild(copyCell);
            
            const deleteCell = document.createElement('div');
            deleteCell.style.padding = '2px 1px';
            deleteCell.style.textAlign = 'center';
            deleteCell.style.cursor = 'pointer';
            deleteCell.style.color = '#f44336';
            deleteCell.style.fontSize = '14px';
            deleteCell.innerHTML = '🗑️';
            deleteCell.title = 'Delete this run';
            if (run) {
              // Add click animation styles
              deleteCell.style.transition = 'all 0.1s ease';
              deleteCell.style.userSelect = 'none';
              
              deleteCell.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Click animation
                deleteCell.style.transform = 'scale(0.9)';
                deleteCell.style.opacity = '0.7';
                setTimeout(() => {
                  deleteCell.style.transform = 'scale(1)';
                  deleteCell.style.opacity = '1';
                }, 100);
                
                
                
                // Check if delete cell is already in "confirm" state
                if (deleteCell.getAttribute('data-confirming') === 'true') {
                  // User confirmed deletion
                  
                  // Remove from local storage
                  if (window.RunTrackerAPI && (window.RunTrackerAPI.deleteRunByIdentity || window.RunTrackerAPI.deleteRun)) {
                    const identity = {
                      seed: run.seed,
                      timestamp: run.timestamp,
                      season: run.season,
                      time: run.time,
                      setup: run.setup
                    };
                    const deletionPromise = window.RunTrackerAPI.deleteRunByIdentity
                      ? window.RunTrackerAPI.deleteRunByIdentity(mapKey, 'speedrun', identity)
                      : window.RunTrackerAPI.deleteRun(mapKey, 'speedrun', i);
                    
                    deletionPromise.then(success => {
                      
                      if (success) {
                        // Update status bar
                        if (row3 && row3.statusBar) {
                          // Clear any existing timeout
                          if (row3.statusBarTimeout) {
                            clearTimeout(row3.statusBarTimeout);
                          }
                          row3.statusBar.textContent = 'Run deleted successfully!';
                          row3.statusBar.style.color = '#4CAF50';
                          row3.statusBarTimeout = setTimeout(() => {
                            row3.statusBar.textContent = 'These are your saved top records.';
                            row3.statusBar.style.color = '#ccc';
                            row3.statusBarTimeout = null;
                          }, 3000);
                        }
                        // Refresh the table
                        speedrunTable.innerHTML = '';
                        speedrunTable.appendChild(speedrunHeader);
                        if (populateSpeedrunTable) {
                          populateSpeedrunTable();
                        }
                      }
                    });
                  }
                  // Reset delete cell
                  deleteCell.innerHTML = '🗑️';
                  deleteCell.style.color = '#f44336';
                  deleteCell.removeAttribute('data-confirming');
                } else {
                  // First click - reset any other confirming delete cells first
                  const allConfirmingCells = document.querySelectorAll('[data-confirming="true"]');
                  allConfirmingCells.forEach(cell => {
                    cell.innerHTML = '🗑️';
                    cell.style.color = '#f44336';
                    cell.removeAttribute('data-confirming');
                    cell.title = 'Delete this run';
                  });
                  
                  // Show confirmation for this cell
                  deleteCell.innerHTML = '✓';
                  deleteCell.style.color = '#ff0000';
                  deleteCell.setAttribute('data-confirming', 'true');
                  deleteCell.title = 'Click again to confirm deletion';
                  
                  // Clear any existing timeout before showing delete confirmation
                  if (row3 && row3.statusBar && row3.statusBarTimeout) {
                    clearTimeout(row3.statusBarTimeout);
                    row3.statusBarTimeout = null;
                  }
                  
                  // Update status bar
                  if (row3 && row3.statusBar) {
                    row3.statusBar.textContent = 'Are you sure you want to delete this run?';
                    row3.statusBar.style.color = '#ff6b6b';
                  }
                  
                  // Confirmation mode - no timer, user must click again to confirm or click elsewhere to cancel
                }
              });
            }
            row.appendChild(deleteCell);
            
            speedrunTable.appendChild(row);
          }
        } catch (error) {
          console.error('[Cyclopedia] Error populating speedrun table:', error);
        }
      }
      
      // Populate the speedrun table
      populateSpeedrunTable();
      
      // Make the populate function accessible for refresh
      speedrunTableCol.populateSpeedrunTable = populateSpeedrunTable;
      
      speedrunTableCol.appendChild(speedrunTable);
      
      // Right column: Floors
      const floorsTableCol = document.createElement('div');
      floorsTableCol.setAttribute('data-table-type', 'floors');
      floorsTableCol.style.flex = '1 1 0';
      floorsTableCol.style.maxWidth = '180px';
      floorsTableCol.style.display = 'flex';
      floorsTableCol.style.flexDirection = 'column';
      floorsTableCol.style.padding = '2px';
      floorsTableCol.style.borderLeft = '3px solid transparent';
      floorsTableCol.style.borderRight = 'none';
      floorsTableCol.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
      
      const floorsTableTitle = document.createElement('div');
      floorsTableTitle.style.fontSize = '16px';
      floorsTableTitle.style.fontWeight = 'bold';
      floorsTableTitle.style.color = COLOR_CONSTANTS.TEXT;
      floorsTableTitle.style.marginBottom = '10px';
      floorsTableTitle.style.textAlign = 'center';
      floorsTableTitle.textContent = 'Top Floors';
      floorsTableCol.appendChild(floorsTableTitle);
      
      const floorsTable = DOMUtils.createStyledElement('div', {
        border: '6px solid transparent',
        borderImage: 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch',
        borderRadius: '0',
        overflow: 'hidden',
        overflowY: 'auto',
        boxSizing: 'border-box',
        height: '130px',
        maxHeight: '130px',
        background: 'url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png") repeat'
      });
      
      // Table header
      const floorsHeader = DOMUtils.createStyledElement('div', {
        display: 'grid',
        gridTemplateColumns: '1fr 50px 20px 20px',
        background: 'url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png") repeat',
        borderBottom: '1px solid #444',
        position: 'sticky',
        top: '0',
        zIndex: '2',
        fontWeight: 'bold',
        fontSize: '11px',
        fontFamily: "'Trebuchet MS', 'Arial Black', Arial, sans-serif",
        color: COLOR_CONSTANTS.TEXT
      });
      
      const floorsFloorHeader = DOMUtils.createTableCell('Floor', { padding: '6px 4px' });
      floorsHeader.appendChild(floorsFloorHeader);
      
      const floorsTimeHeader = DOMUtils.createTableCell('Time', { padding: '6px 4px' });
      floorsHeader.appendChild(floorsTimeHeader);
      
      const floorsCopyHeader = DOMUtils.createTableCell('', { padding: '4px 2px' });
      floorsHeader.appendChild(floorsCopyHeader);
      
      const floorsDeleteHeader = DOMUtils.createTableCell('', { padding: '4px 2px', borderRight: 'none' });
      floorsHeader.appendChild(floorsDeleteHeader);
      
      floorsTable.appendChild(floorsHeader);
      
      // Function to populate floors table with local data
      async function populateFloorsTable() {
        try {
          // Clear previously rendered data rows, keep sticky header as first child.
          while (floorsTable.children.length > 1) {
            floorsTable.removeChild(floorsTable.lastChild);
          }
          
          // Resolve the map name to ensure consistency with RunTracker
          const resolvedMapName = resolveMapName(selectedMap);
          const mapKey = `map_${resolvedMapName.toLowerCase().replace(/\s+/g, '_')}`;
          
          
          let localRuns = await getLocalRunsForMap(mapKey, 'floor');
          
          
          // Ensure currentYourRooms is populated for warning icon comparisons
          if (!currentYourRooms) {
            const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
            currentYourRooms = getYourRoomsForCyclopediaSeason(playerState?.rooms || {});
          }
          
          const getFloorCoverageLabel = (run) => {
            const history = Array.isArray(run?.floorHistory) ? run.floorHistory : [];
            const numericFloors = history
              .map((value) => Number(value))
              .filter((value) => Number.isFinite(value) && value > 0);
            if (run?.floor !== undefined && run?.floor !== null) {
              const floorValue = Number(run.floor);
              if (Number.isFinite(floorValue) && floorValue > 0) numericFloors.push(floorValue);
            }
            const uniqueSorted = Array.from(new Set(numericFloors)).sort((a, b) => a - b);
            if (uniqueSorted.length === 0) return 'N/A';
            if (uniqueSorted.length === 1) return String(uniqueSorted[0]);
            const segments = [];
            let start = uniqueSorted[0];
            let previous = uniqueSorted[0];
            for (let idx = 1; idx < uniqueSorted.length; idx++) {
              const current = uniqueSorted[idx];
              if (current === previous + 1) {
                previous = current;
                continue;
              }
              segments.push(start === previous ? String(start) : `${start}-${previous}`);
              start = current;
              previous = current;
            }
            segments.push(start === previous ? String(start) : `${start}-${previous}`);
            return segments.join(',');
          };

          // Sort floor data: 1. Floor (descending), 2. FloorTicks (ascending), 3. Date (newest first)
          if (localRuns && localRuns.length > 0) {
            localRuns.sort((a, b) => {
              // First priority: Floor (higher is better)
              if (a.floor !== b.floor) {
                return (b.floor || 0) - (a.floor || 0);
              }
              // Second priority: FloorTicks (lower is better)
              if (a.floorTicks !== b.floorTicks) {
                return (a.floorTicks || Infinity) - (b.floorTicks || Infinity);
              }
              // Third priority: Date (newer is better)
              const dateA = a.date || a.timestamp || 0;
              const dateB = b.date || b.timestamp || 0;
              return dateB - dateA;
            });
            
          }
          
          if (!localRuns || localRuns.length === 0) {
            // Show empty state
            for (let i = 1; i <= 5; i++) {
              const row = document.createElement('div');
              row.style.display = 'grid';
              row.style.gridTemplateColumns = '1fr 50px 20px 20px';
              row.style.borderBottom = i < 5 ? '1px solid #333' : 'none';
              row.style.fontSize = '10px';
              row.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
              row.style.color = '#666';
              
              const floorCell = document.createElement('div');
              floorCell.style.padding = '4px 2px';
              floorCell.style.borderRight = '1px solid #333';
              floorCell.style.textAlign = 'center';
              floorCell.textContent = '-';
              row.appendChild(floorCell);
              
              const ticksCell = document.createElement('div');
              ticksCell.style.padding = '4px 2px';
              ticksCell.style.borderRight = '1px solid #333';
              ticksCell.style.textAlign = 'center';
              ticksCell.textContent = '-';
              row.appendChild(ticksCell);
              
              const copyCell = document.createElement('div');
              copyCell.style.padding = '2px 1px';
              copyCell.style.borderRight = '1px solid #333';
              copyCell.style.textAlign = 'center';
              copyCell.innerHTML = '';
              row.appendChild(copyCell);
              
              const deleteCell = document.createElement('div');
              deleteCell.style.padding = '2px 1px';
              deleteCell.style.textAlign = 'center';
              deleteCell.innerHTML = '';
              row.appendChild(deleteCell);
              
              floorsTable.appendChild(row);
            }
            return;
          }
          
          // Populate with actual data (show all saved runs, keep at least 5 rows for consistent table height)
          const rowCount = Math.max(localRuns.length, 5);
          for (let i = 0; i < rowCount; i++) {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '1fr 50px 20px 20px';
            row.style.borderBottom = i < rowCount - 1 ? '1px solid #333' : 'none';
            row.style.fontSize = '10px';
            row.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
            
            const run = localRuns[i];
            
            if (!run) {
              // No run for this slot - show "No runs" without buttons
              row.style.color = '#666';
              
              const floorCell = document.createElement('div');
              floorCell.style.padding = '4px 2px';
              floorCell.style.borderRight = '1px solid #333';
              floorCell.style.textAlign = 'center';
              floorCell.textContent = '-';
              row.appendChild(floorCell);
              
              const timeCell = document.createElement('div');
              timeCell.style.padding = '4px 2px';
              timeCell.style.borderRight = '1px solid #333';
              timeCell.style.textAlign = 'center';
              timeCell.textContent = '-';
              row.appendChild(timeCell);
              
              const copyCell = document.createElement('div');
              copyCell.style.padding = '2px 1px';
              copyCell.style.borderRight = '1px solid #333';
              copyCell.style.textAlign = 'center';
              copyCell.innerHTML = '';
              row.appendChild(copyCell);
              
              const deleteCell = document.createElement('div');
              deleteCell.style.padding = '2px 1px';
              deleteCell.style.textAlign = 'center';
              deleteCell.innerHTML = '';
              row.appendChild(deleteCell);
              
              floorsTable.appendChild(row);
              continue;
            }
            
            // Has run data - show with buttons
            row.style.color = '#ccc';
            
            const floorCell = document.createElement('div');
            floorCell.style.padding = '4px 2px';
            floorCell.style.borderRight = '1px solid #333';
            floorCell.style.textAlign = 'center';
            floorCell.style.display = 'flex';
            floorCell.style.alignItems = 'center';
            floorCell.style.justifyContent = 'center';
            floorCell.style.gap = '4px';
            floorCell.style.position = 'relative';
            
            const warningState = getCyclopediaRunWarningState(run);

            if (run.floor !== undefined && run.floor !== null) {
              const floorText = document.createElement('span');
              floorText.textContent = getFloorCoverageLabel(run);
              if (Array.isArray(run.floorHistory) && run.floorHistory.length > 1) {
                floorText.title = `Floors cleared with this setup: ${getFloorCoverageLabel(run)}`;
              }

              if (warningState.shouldWarn) {
                decorateCyclopediaRunWarningCell(floorCell, floorText, row, warningState);
              } else {
                floorCell.appendChild(floorText);
              }
            } else {
              floorCell.textContent = 'N/A';
              
            }
            row.appendChild(floorCell);
            
            const timeCell = document.createElement('div');
            timeCell.style.padding = '4px 2px';
            timeCell.style.borderRight = '1px solid #333';
            timeCell.style.textAlign = 'center';
            timeCell.style.display = 'flex';
            timeCell.style.alignItems = 'center';
            timeCell.style.justifyContent = 'center';
            if (run.time !== undefined && run.time !== null) {
              const timeValue = formatLocalRunTime(run.time).replace(/\s*ticks?\s*/i, '');
              timeCell.textContent = timeValue;
              
            } else {
              timeCell.textContent = '-';
              
            }
            row.appendChild(timeCell);
            
            const copyCell = document.createElement('div');
            copyCell.style.padding = '2px 1px';
            copyCell.style.borderRight = '1px solid #333';
            copyCell.style.textAlign = 'center';
            copyCell.style.cursor = 'pointer';
            copyCell.style.color = '#4CAF50';
            copyCell.style.fontSize = '14px';
            copyCell.innerHTML = '🔗';
            copyCell.title = 'Copy $replay command';
            
            if (run.seed) {
              // Add click animation styles
              copyCell.style.transition = 'all 0.1s ease';
              copyCell.style.userSelect = 'none';
              
              copyCell.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Click animation
                copyCell.style.transform = 'scale(0.9)';
                copyCell.style.opacity = '0.7';
                setTimeout(() => {
                  copyCell.style.transform = 'scale(1)';
                  copyCell.style.opacity = '1';
                }, 100);
                
                
                
                // Generate replay command with board configuration if available
                let replayData = {};
                
                // Get proper region and map names
                let regionName = 'Unknown Region';
                let mapName = resolveMapName(selectedMap); // Use resolved map name
                
                // First, try to use the region name that RunTracker already resolved and saved
                if (run.regionName) {
                  regionName = run.regionName;
                  
                } else {
                  // Try to determine region from the map name/ID using game state utils
                  try {
                    const mapId = selectedMap;
                    let foundRegion = null;
                    
                    // Search through all regions to find which one contains this map
                    if (globalThis.state?.utils?.REGIONS) {
                      for (const region of globalThis.state.utils.REGIONS) {
                        if (region.rooms && region.rooms.some(room => room.id === mapId)) {
                          foundRegion = region;
                          break;
                        }
                      }
                    }
                    
                    if (foundRegion) {
                      regionName = cyclopediaGetRegionDisplayName(foundRegion.id);
                      
                    } else {
                      // Fallback: try to get region from current game state
                      const boardSnapshot = globalThis.state?.board?.getSnapshot();
                      if (boardSnapshot?.context?.selectedMap?.selectedRegion?.name) {
                        regionName = boardSnapshot.context.selectedMap.selectedRegion.name;
                        
                      } else if (boardSnapshot?.context?.selectedMap?.selectedRegion?.id) {
                        regionName = boardSnapshot.context.selectedMap.selectedRegion.id;
                        // Capitalize region name
                        regionName = cyclopediaGetRegionDisplayName(regionName);
                        
                      }
                    }
                  } catch (e) {
                    console.warn('[Cyclopedia] Error getting region from game state:', e);
                  }
                }
                
                replayData.region = regionName;
                replayData.map = mapName;
                
                Object.assign(replayData, buildLocalRunReplayFields(run));
                
                // Add seed at the end
                replayData.seed = run.seed;
                
                const replayCommand = `$replay(${JSON.stringify(replayData)})`;
                
                navigator.clipboard.writeText(replayCommand).then(() => {
                  
                  // Update status bar with success message
                  if (row3 && row3.statusBar) {
                    row3.statusBar.textContent = 'Successfully copied run!';
                    row3.statusBar.style.color = '#4CAF50';
                    // Reset status bar after 3 seconds
                    setTimeout(() => {
                      row3.statusBar.textContent = 'Select to copy or delete run.';
                      row3.statusBar.style.color = '#ccc';
                    }, 3000);
                  }
                }).catch(err => {
                  console.error('[Cyclopedia] Error copying floor replay command:', err);
                  if (row3 && row3.statusBar) {
                    row3.statusBar.textContent = 'Error copying run.';
                    row3.statusBar.style.color = '#ff6b6b';
                    setTimeout(() => {
                      row3.statusBar.textContent = 'Select to copy or delete run.';
                      row3.statusBar.style.color = '#ccc';
                    }, 3000);
                  }
                });
              });
            }
            row.appendChild(copyCell);
            
            const deleteCell = document.createElement('div');
            deleteCell.style.padding = '2px 1px';
            deleteCell.style.textAlign = 'center';
            deleteCell.style.cursor = 'pointer';
            deleteCell.style.color = '#f44336';
            deleteCell.style.fontSize = '14px';
            deleteCell.innerHTML = '🗑️';
            deleteCell.title = 'Delete this run';
            deleteCell.setAttribute('data-map-key', mapKey);
            deleteCell.setAttribute('data-category', 'floor');
            deleteCell.setAttribute('data-index', i);
            if (run.seed) {
              deleteCell.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Check if already in confirmation mode
                if (deleteCell.getAttribute('data-confirming') === 'true') {
                  // Confirm deletion
                  
                  
                  // Call RunTracker API to delete the run
                  if (window.RunTrackerAPI && (window.RunTrackerAPI.deleteRunByIdentity || window.RunTrackerAPI.deleteRun)) {
                    const identity = {
                      seed: run.seed,
                      timestamp: run.timestamp,
                      season: run.season,
                      time: run.time,
                      floor: run.floor,
                      setup: run.setup
                    };
                    const deletionPromise = window.RunTrackerAPI.deleteRunByIdentity
                      ? window.RunTrackerAPI.deleteRunByIdentity(mapKey, 'floor', identity)
                      : window.RunTrackerAPI.deleteRun(mapKey, 'floor', i);

                    deletionPromise.then(success => {
                      if (success) {
                        
                        // Refresh the table
                        populateFloorsTable();
                        // Update status bar
                        if (row3 && row3.statusBar) {
                          row3.statusBar.textContent = 'Run deleted successfully!';
                          row3.statusBar.style.color = '#4CAF50';
                          setTimeout(() => {
                            row3.statusBar.textContent = 'Select to copy or delete run.';
                            row3.statusBar.style.color = '#ccc';
                          }, 3000);
                        }
                      } else {
                        console.error(`[Cyclopedia] Failed to delete floor run at index ${i} for ${mapKey}`);
                        if (row3 && row3.statusBar) {
                          row3.statusBar.textContent = 'Error deleting run.';
                          row3.statusBar.style.color = '#ff6b6b';
                          setTimeout(() => {
                            row3.statusBar.textContent = 'Select to copy or delete run.';
                            row3.statusBar.style.color = '#ccc';
                          }, 3000);
                        }
                      }
                    });
                  }
                  
                  // Reset confirmation state
                  deleteCell.innerHTML = '🗑️';
                  deleteCell.style.color = '#f44336';
                  deleteCell.removeAttribute('data-confirming');
                  deleteCell.title = 'Delete this run';
                  
                  // Reset status bar
                  if (row3 && row3.statusBar) {
                    row3.statusBar.textContent = 'Select to copy or delete run.';
                    row3.statusBar.style.color = '#ccc';
                  }
                } else {
                  // Enter confirmation mode
                  deleteCell.innerHTML = '❌';
                  deleteCell.style.color = '#ff6b6b';
                  deleteCell.setAttribute('data-confirming', 'true');
                  deleteCell.title = 'Click again to confirm deletion';
                  
                  // Clear any existing timeout
                  if (row3.statusBarTimeout) {
                    clearTimeout(row3.statusBarTimeout);
                    row3.statusBarTimeout = null;
                  }
                  
                  // Update status bar
                  if (row3 && row3.statusBar) {
                    row3.statusBar.textContent = 'Are you sure you want to delete this run?';
                    row3.statusBar.style.color = '#ff6b6b';
                  }
                  
                  // Confirmation mode - no timer, user must click again to confirm or click elsewhere to cancel
                }
              });
            }
            row.appendChild(deleteCell);
            
            floorsTable.appendChild(row);
          }
        } catch (error) {
          console.error('[Cyclopedia] Error populating floors table:', error);
        }
      }
      
      // Populate the floors table
      populateFloorsTable();
      
      // Make the populate function accessible for refresh
      floorsTableCol.populateFloorsTable = populateFloorsTable;
      
      floorsTableCol.appendChild(floorsTable);
      
      // Middle column: Top 5 Ranks
      const ranksTableCol = document.createElement('div');
      ranksTableCol.setAttribute('data-table-type', 'ranks');
      ranksTableCol.style.flex = '1 1 0';
      ranksTableCol.style.maxWidth = '160px';
      ranksTableCol.style.display = 'flex';
      ranksTableCol.style.flexDirection = 'column';
      ranksTableCol.style.padding = '2px';
      ranksTableCol.style.borderLeft = '3px solid transparent';
      ranksTableCol.style.borderRight = '3px solid transparent';
      ranksTableCol.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
      
      const ranksTableTitle = document.createElement('div');
      ranksTableTitle.style.fontSize = '16px';
      ranksTableTitle.style.fontWeight = 'bold';
      ranksTableTitle.style.color = COLOR_CONSTANTS.TEXT;
      ranksTableTitle.style.marginBottom = '10px';
      ranksTableTitle.style.textAlign = 'center';
      ranksTableTitle.textContent = 'Top 5 Ranks';
      ranksTableCol.appendChild(ranksTableTitle);
      
      const ranksTable = document.createElement('div');
      ranksTable.style.border = '6px solid transparent';
      ranksTable.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch';
      ranksTable.style.borderRadius = '0';
      ranksTable.style.overflow = 'hidden';
      ranksTable.style.overflowY = 'auto';
      ranksTable.style.boxSizing = 'border-box';
      ranksTable.style.height = '130px';
      ranksTable.style.maxHeight = '130px';
      ranksTable.style.background = 'url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png") repeat';
      
      // Table header
      const ranksHeader = document.createElement('div');
      ranksHeader.style.display = 'grid';
      ranksHeader.style.gridTemplateColumns = '1fr 50px 20px 20px';
      ranksHeader.style.background = 'url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png") repeat';
      ranksHeader.style.borderBottom = '1px solid #444';
      ranksHeader.style.position = 'sticky';
      ranksHeader.style.top = '0';
      ranksHeader.style.zIndex = '2';
      ranksHeader.style.fontWeight = 'bold';
      ranksHeader.style.fontSize = '11px';
      ranksHeader.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
      ranksHeader.style.color = COLOR_CONSTANTS.TEXT;
      
      const ranksRankHeader = document.createElement('div');
      ranksRankHeader.style.padding = '6px 4px';
      ranksRankHeader.style.borderRight = '1px solid #444';
      ranksRankHeader.style.textAlign = 'center';
      ranksRankHeader.textContent = 'Rank';
      ranksHeader.appendChild(ranksRankHeader);
      
      const ranksTimeHeader = document.createElement('div');
      ranksTimeHeader.style.padding = '6px 4px';
      ranksTimeHeader.style.borderRight = '1px solid #444';
      ranksTimeHeader.style.textAlign = 'center';
      ranksTimeHeader.textContent = 'Time';
      ranksHeader.appendChild(ranksTimeHeader);
      
      const ranksCopyHeader = document.createElement('div');
      ranksCopyHeader.style.padding = '4px 2px';
      ranksCopyHeader.style.borderRight = '1px solid #444';
      ranksCopyHeader.style.textAlign = 'center';
      ranksCopyHeader.textContent = '';
      ranksHeader.appendChild(ranksCopyHeader);
      
      const ranksDeleteHeader = document.createElement('div');
      ranksDeleteHeader.style.padding = '4px 2px';
      ranksDeleteHeader.style.textAlign = 'center';
      ranksDeleteHeader.textContent = '';
      ranksHeader.appendChild(ranksDeleteHeader);
      
      ranksTable.appendChild(ranksHeader);
      
      // Function to populate rank points table with local data
      async function populateRankPointsTable() {
        try {
          
          // Resolve the map name to ensure consistency with RunTracker
          const resolvedMapName = resolveMapName(selectedMap);
          const mapKey = `map_${resolvedMapName.toLowerCase().replace(/\s+/g, '_')}`;
          
          
          let localRuns = await getLocalRunsForMap(mapKey, 'rank');
          
          
          // Ensure currentYourRooms is populated for warning icon comparisons
          if (!currentYourRooms) {
            const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
            currentYourRooms = getYourRoomsForCyclopediaSeason(playerState?.rooms || {});
          }
          
          // Filter out defeated runs with 0 rank points and ascension-floor rank entries
          if (localRuns && localRuns.length > 0) {
            const originalCount = localRuns.length;
            localRuns = localRuns.filter(run => {
              if (!(run.points > 0)) return false;
              const floor = Number(run.floor ?? 0);
              return Number.isFinite(floor) && floor <= 0;
            });
            const filteredCount = localRuns.length;
            if (originalCount !== filteredCount) {
              
            }
          }
          
          // Sort rank data: 1. Rank (ascending), 2. Ticks (ascending), 3. Date (newest first)
          if (localRuns && localRuns.length > 0) {
            localRuns.sort((a, b) => {
              // First priority: Rank (lower is better)
              if (a.points !== b.points) {
                return (b.points || 0) - (a.points || 0); // Higher points = better rank
              }
              // Second priority: Ticks (lower is better)
              if (a.time !== b.time) {
                return (a.time || Infinity) - (b.time || Infinity);
              }
              // Third priority: Date (newer is better)
              const dateA = a.date || a.timestamp || 0;
              const dateB = b.date || b.timestamp || 0;
              return dateB - dateA;
            });
            
          }
          
          if (localRuns && localRuns.length > 0) {
            
            
          }
          
          if (!localRuns || localRuns.length === 0) {
            // Show empty state
            for (let i = 1; i <= 5; i++) {
              const row = document.createElement('div');
              row.style.display = 'grid';
              row.style.gridTemplateColumns = '1fr 50px 20px 20px';
              row.style.borderBottom = i < 5 ? '1px solid #333' : 'none';
              row.style.fontSize = '10px';
              row.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
              row.style.color = '#666';
              
              const rankCell = document.createElement('div');
              rankCell.style.padding = '4px 2px';
              rankCell.style.borderRight = '1px solid #333';
              rankCell.style.textAlign = 'center';
              rankCell.textContent = '-';
              row.appendChild(rankCell);
              
              const timeCell = document.createElement('div');
              timeCell.style.padding = '4px 2px';
              timeCell.style.borderRight = '1px solid #333';
              timeCell.style.textAlign = 'center';
              timeCell.textContent = '-';
              row.appendChild(timeCell);
              
              const copyCell = document.createElement('div');
              copyCell.style.padding = '2px 1px';
              copyCell.style.borderRight = '1px solid #333';
              copyCell.style.textAlign = 'center';
              copyCell.innerHTML = '';
              row.appendChild(copyCell);
              
              const deleteCell = document.createElement('div');
              deleteCell.style.padding = '2px 1px';
              deleteCell.style.textAlign = 'center';
              deleteCell.innerHTML = '';
              row.appendChild(deleteCell);
              
              ranksTable.appendChild(row);
            }
            return;
          }
          
          // Populate with actual data
          for (let i = 0; i < 5; i++) {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '1fr 50px 20px 20px';
            row.style.borderBottom = i < 4 ? '1px solid #333' : 'none';
            row.style.fontSize = '10px';
            row.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
            
            const run = localRuns[i];
            
            if (!run) {
              // No run for this slot - show "No runs" without buttons
              row.style.color = '#666';
              
              const rankCell = document.createElement('div');
              rankCell.style.padding = '4px 2px';
              rankCell.style.borderRight = '1px solid #333';
              rankCell.style.textAlign = 'center';
              rankCell.textContent = '-';
              row.appendChild(rankCell);
              
              const timeCell = document.createElement('div');
              timeCell.style.padding = '4px 2px';
              timeCell.style.borderRight = '1px solid #333';
              timeCell.style.textAlign = 'center';
              timeCell.textContent = '-';
              row.appendChild(timeCell);
              
              const copyCell = document.createElement('div');
              copyCell.style.padding = '2px 1px';
              copyCell.style.borderRight = '1px solid #333';
              copyCell.style.textAlign = 'center';
              copyCell.innerHTML = '';
              row.appendChild(copyCell);
              
              const deleteCell = document.createElement('div');
              deleteCell.style.padding = '2px 1px';
              deleteCell.style.textAlign = 'center';
              deleteCell.innerHTML = '';
              row.appendChild(deleteCell);
              
              ranksTable.appendChild(row);
              continue;
            }
            
            // Has run data - show with buttons
            row.style.color = '#ccc';
            
            const rankCell = document.createElement('div');
            rankCell.style.padding = '4px 2px';
            rankCell.style.borderRight = '1px solid #333';
            rankCell.style.textAlign = 'center';
            rankCell.style.display = 'flex';
            rankCell.style.alignItems = 'center';
            rankCell.style.justifyContent = 'center';
            rankCell.style.position = 'relative';
            if (run.points) {
              rankCell.textContent = run.points.toLocaleString();
              
            } else {
              rankCell.textContent = 'N/A';
              
            }
            row.appendChild(rankCell);
            
            const timeCell = document.createElement('div');
            timeCell.style.padding = '4px 2px';
            timeCell.style.borderRight = '1px solid #333';
            timeCell.style.textAlign = 'center';
            timeCell.style.display = 'flex';
            timeCell.style.alignItems = 'center';
            timeCell.style.justifyContent = 'center';
            timeCell.style.gap = '4px';
            timeCell.style.position = 'relative';
            
            if (run.time) {
              const timeText = document.createElement('span');
              
              
              const yourTicks = currentYourRooms?.[selectedMap]?.ticks || 0;
              const yourBestRank = currentYourRooms?.[selectedMap]?.rank || 0;
              const wrTicks = currentWorldRecordTicks || 0;
              const warningState = getCyclopediaRunWarningState(run, {
                isTimeInvalid: yourTicks > 0 && run.time < yourTicks,
                isWorldRecordInvalid: wrTicks > 0 && run.time < wrTicks,
                isRankInvalid: yourBestRank > 0 && run.points > yourBestRank
              });

              const timeValue = formatLocalRunTime(run.time).replace(/\s*ticks?\s*/i, '');
              timeText.textContent = timeValue;
              if (warningState.shouldWarn) {
                decorateCyclopediaRunWarningCell(timeCell, timeText, row, warningState);
              } else {
                timeCell.appendChild(timeText);
              }
            } else {
              timeCell.textContent = 'N/A';
              
            }
            
            row.appendChild(timeCell);
            
            const copyCell = document.createElement('div');
            copyCell.style.padding = '2px 1px';
            copyCell.style.borderRight = '1px solid #333';
            copyCell.style.textAlign = 'center';
            copyCell.style.cursor = 'pointer';
            copyCell.style.color = '#4CAF50';
            copyCell.style.fontSize = '14px';
            copyCell.innerHTML = '🔗';
            copyCell.title = 'Copy $replay command';
            
            if (run.seed) {
              // Add click animation styles
              copyCell.style.transition = 'all 0.1s ease';
              copyCell.style.userSelect = 'none';
              
              copyCell.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Click animation
                copyCell.style.transform = 'scale(0.9)';
                copyCell.style.opacity = '0.7';
                setTimeout(() => {
                  copyCell.style.transform = 'scale(1)';
                  copyCell.style.opacity = '1';
                }, 100);
                
                
                
                // Generate replay command with board configuration if available
                let replayData = {};
                
                // Get proper region and map names
                let regionName = 'Unknown Region';
                let mapName = resolveMapName(selectedMap); // Use resolved map name
                
                // First, try to use the region name that RunTracker already resolved and saved
                if (run.regionName) {
                  regionName = run.regionName;
                  
                } else {
                  // Try to determine region from the map name/ID using game state utils
                  try {
                    const mapId = selectedMap;
                    let foundRegion = null;
                    
                    // Search through all regions to find which one contains this map
                    if (globalThis.state?.utils?.REGIONS) {
                      for (const region of globalThis.state.utils.REGIONS) {
                        if (region.rooms && region.rooms.some(room => room.id === mapId)) {
                          foundRegion = region;
                          break;
                        }
                      }
                    }
                    
                    if (foundRegion) {
                      regionName = cyclopediaGetRegionDisplayName(foundRegion.id);
                      
                    } else {
                      // Fallback: try to get region from current game state (this is the problematic part)
                      const boardSnapshot = globalThis.state?.board?.getSnapshot();
                      if (boardSnapshot?.context?.selectedMap?.selectedRegion?.name) {
                        regionName = boardSnapshot.context.selectedMap.selectedRegion.name;
                        
                      } else if (boardSnapshot?.context?.selectedMap?.selectedRegion?.id) {
                        regionName = boardSnapshot.context.selectedMap.selectedRegion.id;
                        // Capitalize region name
                        regionName = cyclopediaGetRegionDisplayName(regionName);
                        
                      }
                    }
                  } catch (e) {
                    console.warn('[Cyclopedia] Error getting region from game state:', e);
                  }
                }
                
                replayData.region = regionName;
                replayData.map = mapName;
                
                Object.assign(replayData, buildLocalRunReplayFields(run));
                
                // Add seed at the end
                replayData.seed = run.seed;
                
                const replayCommand = `$replay(${JSON.stringify(replayData)})`;
                
                navigator.clipboard.writeText(replayCommand).then(() => {
                  
                  // Update status bar with success message
                  if (row3 && row3.statusBar) {
                    row3.statusBar.textContent = 'Successfully copied run!';
                    row3.statusBar.style.color = '#4CAF50';
                    // Reset status bar after 3 seconds
                    setTimeout(() => {
                      row3.statusBar.textContent = 'Select to copy or delete run.';
                      row3.statusBar.style.color = '#ccc';
                    }, 3000);
                  }
                }).catch(err => {
                  console.error('[Cyclopedia] Failed to copy rank replay command:', err);
                  // Update status bar with error message
                  if (row3 && row3.statusBar) {
                    row3.statusBar.textContent = 'Failed to copy run!';
                    row3.statusBar.style.color = '#f44336';
                    // Reset status bar after 3 seconds
                    setTimeout(() => {
                      row3.statusBar.textContent = 'Select to copy or delete run.';
                      row3.statusBar.style.color = '#ccc';
                    }, 3000);
                  }
                });
              });
            }
            row.appendChild(copyCell);
            
            const deleteCell = document.createElement('div');
            deleteCell.style.padding = '2px 1px';
            deleteCell.style.textAlign = 'center';
            deleteCell.style.cursor = 'pointer';
            deleteCell.style.color = '#f44336';
            deleteCell.style.fontSize = '14px';
            deleteCell.innerHTML = '🗑️';
            deleteCell.title = 'Delete this run';
            if (run) {
              // Add click animation styles
              deleteCell.style.transition = 'all 0.1s ease';
              deleteCell.style.userSelect = 'none';
              
              deleteCell.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Click animation
                deleteCell.style.transform = 'scale(0.9)';
                deleteCell.style.opacity = '0.7';
                setTimeout(() => {
                  deleteCell.style.transform = 'scale(1)';
                  deleteCell.style.opacity = '1';
                }, 100);
                
                
                
                // Check if delete cell is already in "confirm" state
                if (deleteCell.getAttribute('data-confirming') === 'true') {
                  // User confirmed deletion
                  
                  // Remove from local storage
                  if (window.RunTrackerAPI && (window.RunTrackerAPI.deleteRunByIdentity || window.RunTrackerAPI.deleteRun)) {
                    const identity = {
                      seed: run.seed,
                      timestamp: run.timestamp,
                      season: run.season,
                      time: run.time,
                      points: run.points,
                      setup: run.setup
                    };
                    const deletionPromise = window.RunTrackerAPI.deleteRunByIdentity
                      ? window.RunTrackerAPI.deleteRunByIdentity(mapKey, 'rank', identity)
                      : window.RunTrackerAPI.deleteRun(mapKey, 'rank', i);
                    
                    deletionPromise.then(success => {
                      
                      if (success) {
                        // Update status bar
                        if (row3 && row3.statusBar) {
                          // Clear any existing timeout
                          if (row3.statusBarTimeout) {
                            clearTimeout(row3.statusBarTimeout);
                          }
                          row3.statusBar.textContent = 'Run deleted successfully!';
                          row3.statusBar.style.color = '#4CAF50';
                          row3.statusBarTimeout = setTimeout(() => {
                            row3.statusBar.textContent = 'These are your saved top records.';
                            row3.statusBar.style.color = '#ccc';
                            row3.statusBarTimeout = null;
                          }, 3000);
                        }
                        // Refresh the table
                        ranksTable.innerHTML = '';
                        ranksTable.appendChild(ranksHeader);
                        if (populateRankPointsTable) {
                          populateRankPointsTable();
                        }
                      }
                    });
                  }
                  // Reset delete cell
                  deleteCell.innerHTML = '🗑️';
                  deleteCell.style.color = '#f44336';
                  deleteCell.removeAttribute('data-confirming');
                } else {
                  // First click - reset any other confirming delete cells first
                  const allConfirmingCells = document.querySelectorAll('[data-confirming="true"]');
                  allConfirmingCells.forEach(cell => {
                    cell.innerHTML = '🗑️';
                    cell.style.color = '#f44336';
                    cell.removeAttribute('data-confirming');
                    cell.title = 'Delete this run';
                  });
                  
                  // Show confirmation for this cell
                  deleteCell.innerHTML = '✓';
                  deleteCell.style.color = '#ff0000';
                  deleteCell.setAttribute('data-confirming', 'true');
                  deleteCell.title = 'Click again to confirm deletion';
                  
                  // Clear any existing timeout before showing delete confirmation
                  if (row3 && row3.statusBar && row3.statusBarTimeout) {
                    clearTimeout(row3.statusBarTimeout);
                    row3.statusBarTimeout = null;
                  }
                  
                  // Update status bar
                  if (row3 && row3.statusBar) {
                    row3.statusBar.textContent = 'Are you sure you want to delete this run?';
                    row3.statusBar.style.color = '#ff6b6b';
                  }
                  
                  // Confirmation mode - no timer, user must click again to confirm or click elsewhere to cancel
                }
              });
            }
            row.appendChild(deleteCell);
            
            ranksTable.appendChild(row);
          }
        } catch (error) {
          console.error('[Cyclopedia] Error populating rank points table:', error);
        }
      }
      
      // Populate the rank points table
      populateRankPointsTable();
      
      // Make the populate function accessible for refresh
      ranksTableCol.populateRankPointsTable = populateRankPointsTable;
      
      ranksTableCol.appendChild(ranksTable);
      
      // Add columns to row2
      row2.appendChild(speedrunTableCol);
      row2.appendChild(ranksTableCol);
      row2.appendChild(floorsTableCol);
      
      // Row 3: Additional content area
      const row3 = document.createElement('div');
      row3.style.flex = '1 1 0';
      row3.style.display = 'flex';
      row3.style.flexDirection = 'column';
      row3.style.padding = '10px';
      row3.style.borderTop = '3px solid transparent';
      row3.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
      row3.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
      row3.style.marginTop = '10px';
      

      
      // Descriptive bullet points
      const bulletPoints = document.createElement('div');
      bulletPoints.style.marginBottom = '15px';
      bulletPoints.style.fontSize = '11px';
      bulletPoints.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
      bulletPoints.style.color = '#ccc';
      bulletPoints.style.lineHeight = '1.4';
      bulletPoints.innerHTML = `
        <div style="margin-bottom: 8px;">• All runs made in Autoplay and manual mode will automatically be added here.</div>
        <div>• If it's the same creatures, equipment and placement, the run will be overwritten with the better run, else it will be copied to a new row.</div>
      `;
      row3.appendChild(bulletPoints);
      
      // Status bar
      const statusBar = document.createElement('div');
      statusBar.style.padding = '8px 12px';
      statusBar.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
      statusBar.style.border = '1px solid #444';
      statusBar.style.borderRadius = '4px';
      statusBar.style.fontSize = '11px';
      statusBar.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
      statusBar.style.color = '#ccc';
      statusBar.style.textAlign = 'center';
      statusBar.style.minHeight = '20px';
      statusBar.style.display = 'flex';
      statusBar.style.alignItems = 'center';
      statusBar.style.justifyContent = 'center';
      statusBar.textContent = 'These are your saved top records.';
      row3.appendChild(statusBar);
      
      // Store status bar reference for later use
      row3.statusBar = statusBar;
      
      // Global click listener to reset delete confirmation states
      const resetDeleteStates = () => {
        // Reset all delete cells in both tables
        const allDeleteCells = DOMCache.getAll('[data-confirming="true"]');
        allDeleteCells.forEach(cell => {
          cell.innerHTML = '🗑️';
          cell.style.color = '#f44336';
          cell.removeAttribute('data-confirming');
          cell.title = 'Delete this run';
        });
        
        // Reset status bar
        if (row3 && row3.statusBar) {
          // Clear any existing timeout
          if (row3.statusBarTimeout) {
            clearTimeout(row3.statusBarTimeout);
            row3.statusBarTimeout = null;
          }
          row3.statusBar.textContent = 'These are your saved top records.';
          row3.statusBar.style.color = '#ccc';
        }
      };
      
      // Add global click listener with event delegation
      document.addEventListener('click', (e) => {
        // Only reset if the click is not on a delete cell that's in confirming state
        const clickedDeleteCell = e.target.closest('[data-confirming="true"]');
        if (!clickedDeleteCell) {
          resetDeleteStates();
        }
      }, { passive: true }); // Use passive listener for better performance
      
      // Store the reset function for potential cleanup
      row3.resetDeleteStates = resetDeleteStates;
      
      // Add rows to statsContainer
      statsContainer.appendChild(row1);
      statsContainer.appendChild(row2);
      statsContainer.appendChild(row3);
      
      // Fetch and populate leaderboard data with error handling
      fetchMapsLeaderboardData().then(data => {
        if (data && selectedMap) {
          // Check if data contains error information
          if (data.error) {
            if (data.error === 'rate_limited') {
              speedrunContent.innerHTML = '<div style="color: #ff6b6b; font-size: 12px;">Rate limited. Please wait.</div>';
              rankPointsContent.innerHTML = '<div style="color: #ff6b6b; font-size: 12px;">Rate limited. Please wait.</div>';
              floorsContent.innerHTML = '<div style="color: #ff6b6b; font-size: 12px;">Rate limited. Please wait.</div>';
            } else {
              speedrunContent.innerHTML = '<div style="color: #888; font-size: 12px;">Data temporarily unavailable</div>';
              rankPointsContent.innerHTML = '<div style="color: #888; font-size: 12px;">Data temporarily unavailable</div>';
              floorsContent.innerHTML = '<div style="color: #888; font-size: 12px;">Data temporarily unavailable</div>';
            }
            return;
          }
          
          const { best, roomsHighscores } = data;
          const activeSeason = Number(cyclopediaState.profileSeason || 1);
          // Temporary Season 2 rollout behavior: enable WR only for Season 2.
          const allowGlobalWorldRecords = activeSeason === 2;
          console.log(
            '[Cyclopedia] Leaderboard data for map',
            selectedMap,
            '| Cyclopedia season toggle:',
            activeSeason,
            '| game.getTickHighscores / getRoomsHighscores are global room WRs (no season in API payload).',
            '| world record rendering enabled:',
            allowGlobalWorldRecords,
            {
              best: best?.[selectedMap],
              rank: roomsHighscores?.rank?.[selectedMap],
              floor: roomsHighscores?.floor?.[selectedMap],
              ticks: roomsHighscores?.ticks?.[selectedMap]
            }
          );
          const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
          const yourRooms = getYourRoomsForCyclopediaSeason(playerState?.rooms || {});

          // Store yourRooms data for warning icon comparisons (season-scoped when profile is loaded)
          currentYourRooms = yourRooms;
          currentWorldRecordTicks = allowGlobalWorldRecords ? (best?.[selectedMap]?.ticks || 0) : 0;
          // Re-render tables so warning icons can use fetched WR data.
          speedrunTable.innerHTML = '';
          speedrunTable.appendChild(speedrunHeader);
          populateSpeedrunTable();
          ranksTable.innerHTML = '';
          ranksTable.appendChild(ranksHeader);
          populateRankPointsTable();
          
          // Update speedrun content
          const yourTicks = yourRooms?.[selectedMap]?.ticks || 0;
          const bestTicks = best?.[selectedMap]?.ticks || 0;
          const bestPlayer = best?.[selectedMap]?.userName || 'Unknown';
          
          let speedrunHtml = '';
          if (allowGlobalWorldRecords && bestTicks > 0) {
            speedrunHtml = `
              <div style="margin-bottom: 4px; color: #ff8; font-weight: bold; font-size: 12px;">World Record</div>
              <div style="margin-bottom: 2px; font-size: 12px; color: #fff; ${statsLineTruncate}" title="${bestTicks} ticks">${bestTicks} ticks</div>
              <div data-stats-player-slot></div>
            `;
            if (yourTicks > 0) {
              speedrunHtml += `
                <div style="margin-bottom: 4px; color: #8f8; font-weight: bold; font-size: 12px;">Your Best</div>
                <div style="font-size: 12px; color: #ccc; ${statsLineTruncate}" title="${yourTicks} ticks">${yourTicks} ticks</div>
              `;
            }
          } else if (yourTicks > 0) {
            speedrunHtml = `
              <div style="margin-bottom: 4px; color: #8f8; font-weight: bold; font-size: 12px;">Your Best</div>
              <div style="font-size: 12px; color: #ccc; ${statsLineTruncate}" title="${yourTicks} ticks">${yourTicks} ticks</div>
            `;
          } else {
            speedrunHtml = '<div style="color: #666; font-size: 12px;">No records yet</div>';
          }
          speedrunContent.innerHTML = speedrunHtml;
          if (allowGlobalWorldRecords && bestTicks > 0) {
            appendStatsWorldRecordPlayerLink(speedrunContent, bestPlayer, statsLineTruncate);
          }
          
          // Update rank points content
          const yourRankRoom = yourRooms?.[selectedMap];
          const yourRankPoints = yourRankRoom?.rank || 0;
          const yourRankTicks = yourRankRoom?.rankTicks;
          const hasYourRankData = !!yourRankRoom && (
            yourRankRoom.rank !== undefined ||
            yourRankRoom.rankTicks !== undefined
          );
          const bestRankPoints = roomsHighscores?.rank?.[selectedMap]?.rank || 0;
          const bestRankTicks = roomsHighscores?.rank?.[selectedMap]?.ticks;
          const bestRankPlayer = roomsHighscores?.rank?.[selectedMap]?.userName || 'Unknown';
          
          let rankPointsHtml = '';
          if (allowGlobalWorldRecords && bestRankPoints > 0) {
            const bestRankDisplay = `${bestRankPoints.toLocaleString()}${bestRankTicks !== undefined && bestRankTicks !== null ? ` (${bestRankTicks} ticks)` : ' (null)'}`;
            rankPointsHtml = `
              <div style="margin-bottom: 4px; color: #ff8; font-weight: bold; font-size: 12px;">World Record</div>
              <div style="margin-bottom: 2px; font-size: 12px; color: #fff; ${statsLineTruncate}" title="${bestRankDisplay}">${bestRankPoints.toLocaleString()}${bestRankTicks !== undefined && bestRankTicks !== null ? ` <i style="color: #aaa;">(${bestRankTicks} ticks)</i>` : ' (null)'}</div>
              <div data-stats-player-slot></div>
            `;
            if (hasYourRankData) {
              const yourRankDisplay = `${yourRankPoints.toLocaleString()}${yourRankTicks !== undefined && yourRankTicks !== null ? ` (${yourRankTicks} ticks)` : ' (null)'}`;
              rankPointsHtml += `
                <div style="margin-bottom: 4px; color: #8f8; font-weight: bold; font-size: 12px;">Your Best</div>
                <div style="font-size: 12px; color: #ccc; ${statsLineTruncate}" title="${yourRankDisplay}">${yourRankPoints.toLocaleString()}${yourRankTicks !== undefined && yourRankTicks !== null ? ` <i style="color: #aaa;">(${yourRankTicks} ticks)</i>` : ' (null)'}</div>
              `;
            }
          } else if (hasYourRankData) {
            const yourRankDisplay = `${yourRankPoints.toLocaleString()}${yourRankTicks !== undefined && yourRankTicks !== null ? ` (${yourRankTicks} ticks)` : ''}`;
            rankPointsHtml = `
              <div style="margin-bottom: 4px; color: #8f8; font-weight: bold; font-size: 12px;">Your Best</div>
              <div style="font-size: 12px; color: #ccc; ${statsLineTruncate}" title="${yourRankDisplay}">${yourRankPoints.toLocaleString()}${yourRankTicks !== undefined && yourRankTicks !== null ? ` <i style="color: #aaa;">(${yourRankTicks} ticks)</i>` : ''}</div>
            `;
          } else {
            rankPointsHtml = '<div style="color: #666; font-size: 12px;">No records yet</div>';
          }
          rankPointsContent.innerHTML = rankPointsHtml;
          if (allowGlobalWorldRecords && bestRankPoints > 0) {
            appendStatsWorldRecordPlayerLink(rankPointsContent, bestRankPlayer, statsLineTruncate);
          }
          
          // Update floors content
          const yourRoom = yourRooms?.[selectedMap];
          const { floor: yourFloor, floorTicks: yourFloorTicks } = normalizeUserFloorData(yourRoom);
          const { floor: bestFloor, floorTicks: bestFloorTicks, playerName: bestFloorPlayer } = normalizeBestFloorData(selectedMap, roomsHighscores, best);
          
          let floorsHtml = '';
          // Check if we have world record data (best floor or fallback to ticks)
          if (allowGlobalWorldRecords && bestFloorTicks > 0) {
            const bestFloorDisplay = `Floor ${bestFloor}${bestFloorTicks !== undefined && bestFloorTicks !== null ? ` (${bestFloorTicks} ticks)` : ''}`;
            floorsHtml = `
              <div style="margin-bottom: 4px; color: #ff8; font-weight: bold; font-size: 12px;">World Record</div>
              <div style="margin-bottom: 2px; font-size: 12px; color: #fff; ${statsLineTruncate}" title="${bestFloorDisplay}">Floor ${bestFloor}${bestFloorTicks !== undefined && bestFloorTicks !== null ? ` <i style="color: #aaa;">(${bestFloorTicks} ticks)</i>` : ''}</div>
              <div data-stats-player-slot></div>
            `;
            // Add "Your Best" if user has floor data
            if (yourFloor !== undefined && yourFloor !== null) {
              const yourFloorDisplay = `Floor ${yourFloor}${yourFloorTicks !== undefined && yourFloorTicks !== null ? ` (${yourFloorTicks} ticks)` : ''}`;
              floorsHtml += `
                <div style="margin-bottom: 4px; color: #8f8; font-weight: bold; font-size: 12px;">Your Best</div>
                <div style="font-size: 12px; color: #ccc; ${statsLineTruncate}" title="${yourFloorDisplay}">Floor ${yourFloor}${yourFloorTicks !== undefined && yourFloorTicks !== null ? ` <i style="color: #aaa;">(${yourFloorTicks} ticks)</i>` : ''}</div>
              `;
            }
          } else if (yourFloor !== undefined && yourFloor !== null) {
            const yourFloorDisplay = `Floor ${yourFloor}${yourFloorTicks !== undefined && yourFloorTicks !== null ? ` (${yourFloorTicks} ticks)` : ''}`;
            // Only show "Your Best" if no world record but user has data
            floorsHtml = `
              <div style="margin-bottom: 4px; color: #8f8; font-weight: bold; font-size: 12px;">Your Best</div>
              <div style="font-size: 12px; color: #ccc; ${statsLineTruncate}" title="${yourFloorDisplay}">Floor ${yourFloor}${yourFloorTicks !== undefined && yourFloorTicks !== null ? ` <i style="color: #aaa;">(${yourFloorTicks} ticks)</i>` : ''}</div>
            `;
          } else {
            floorsHtml = '<div style="color: #666; font-size: 12px;">No records yet</div>';
          }
          floorsContent.innerHTML = floorsHtml;
          if (allowGlobalWorldRecords && bestFloorTicks > 0) {
            appendStatsWorldRecordPlayerLink(floorsContent, bestFloorPlayer, statsLineTruncate);
          }
        } else {
          speedrunContent.innerHTML = '<div style="color: #666;">Unable to load data</div>';
          rankPointsContent.innerHTML = '<div style="color: #666;">Unable to load data</div>';
          floorsContent.innerHTML = '<div style="color: #666;">Unable to load data</div>';
        }
      }).catch(error => {
        console.error('[Cyclopedia] Error loading maps leaderboard data:', error);
        
        // Handle different types of errors gracefully
        if (error.message.includes('Rate limited')) {
          speedrunContent.innerHTML = '<div style="color: #ff6b6b; font-size: 12px;">Rate limited. Please wait.</div>';
          rankPointsContent.innerHTML = '<div style="color: #ff6b6b; font-size: 12px;">Rate limited. Please wait.</div>';
          floorsContent.innerHTML = '<div style="color: #ff6b6b; font-size: 12px;">Rate limited. Please wait.</div>';
        } else {
          speedrunContent.innerHTML = '<div style="color: #888; font-size: 12px;">Data temporarily unavailable</div>';
          rankPointsContent.innerHTML = '<div style="color: #888; font-size: 12px;">Data temporarily unavailable</div>';
          floorsContent.innerHTML = '<div style="color: #888; font-size: 12px;">Data temporarily unavailable</div>';
        }
      });
      
      return statsContainer;
    }

    // Optimized creature list section with memory management
    function createCreatureListSection(roomActors, selectedMap) {
      const creaturesContainer = document.createElement('div');
      creaturesContainer.style.marginTop = '4px';
      creaturesContainer.style.textAlign = 'center';

      if (roomActors && roomActors.length > 0) {
        // Filter and sort actors efficiently
        const validActors = roomActors.filter(actor => actor && actor.id);
        const sortedActors = validActors.sort((a, b) => {
          const levelA = a.level || 1;
          const levelB = b.level || 1;
          if (levelA !== levelB) return levelB - levelA;
          
          // Use cached creature data for name comparison
          const nameA = CreatureListManager.getCachedCreatureData(a.id)?.data?.name || 'Unknown';
          const nameB = CreatureListManager.getCachedCreatureData(b.id)?.data?.name || 'Unknown';
          return nameA.localeCompare(nameB);
        });
        
        const creaturesGrid = document.createElement('div');
        creaturesGrid.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 4px;
          width: 100%;
          max-width: 100%;
        `;
        
        sortedActors.forEach((actor) => {
          if (!actor || !actor.id) return;
          
          try {
            // Get or create creature row from pool
            const creatureRow = CreatureListManager.getPooledElement('creatureRows', () => {
              const row = document.createElement('div');
              row.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
                padding: 4px 8px;
                margin-bottom: 4px;
                background-color: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
              `;
              return row;
            });
            
            // Left: Creature icon
            const iconContainer = document.createElement('div');
            iconContainer.style.cssText = `
              flex: 0 0 50px;
              display: flex;
              justify-content: center;
              align-items: center;
            `;
            
            const creatureIcon = CreatureListManager.createSimplifiedCreatureIcon(actor);
            iconContainer.appendChild(creatureIcon);
            
            // Middle: Name and level
            const infoContainer = CreatureListManager.getPooledElement('infoContainers', () => {
              const container = document.createElement('div');
              container.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 0 8px;
              `;
              return container;
            });
            
            // Get creature name from cache or fetch
            let creatureName = 'Unknown';
            const cachedData = CreatureListManager.getCachedCreatureData(actor.id);
            if (cachedData) {
              creatureName = cachedData.data.name;
            } else {
              try {
                if (globalThis.state?.utils?.getMonster) {
                  const monsterData = globalThis.state.utils.getMonster(actor.id);
                  if (monsterData?.metadata?.name) {
                    creatureName = monsterData.metadata.name;
                    // Cache the data
                    CreatureListManager.cacheCreatureData(actor.id, {
                      name: creatureName,
                      data: monsterData
                    });
                  }
                }
              } catch (error) {
                console.warn('[Cyclopedia] Could not get creature name for ID:', actor.id);
              }
            }
            
            const nameElement = document.createElement('div');
            nameElement.textContent = creatureName;
            nameElement.style.cssText = `
              font-weight: bold;
              font-size: 14px;
              color: ${COLOR_CONSTANTS.TEXT};
              text-align: center;
              cursor: pointer;
              text-decoration: underline;
              text-decoration-style: solid;
            `;
            nameElement.title = `Open ${creatureName} in Cyclopedia`;
            nameElement.addEventListener('click', () => {
              if (!creatureName || creatureName === 'Unknown') return;
              openCreatureInBestiaryTab(creatureName, {
                setActiveTabFn: setActiveTab,
                clickListItemFn: typeof _cyclopediaClickListItem === 'function' ? _cyclopediaClickListItem : null,
                tabPage: typeof tabPages !== 'undefined' ? tabPages[1] : null,
                inventoryTabPage: typeof tabPages !== 'undefined' ? tabPages[3] : null,
                findBoxByTitleFn: typeof _cyclopediaFindBoxByTitle === 'function' ? _cyclopediaFindBoxByTitle : null,
                timerLabel: 'mapsCreatureSelect'
              });
            });
            
            const levelElement = document.createElement('div');
            levelElement.textContent = `Level ${actor.level || 1}`;
            levelElement.style.cssText = `
              font-size: 12px;
              color: #888;
              text-align: center;
            `;
            
            infoContainer.appendChild(nameElement);
            infoContainer.appendChild(levelElement);
            
            // Right: Equipment (simplified)
            const equipmentContainer = CreatureListManager.getPooledElement('equipmentContainers', () => {
              const container = document.createElement('div');
              container.style.cssText = `
                flex: 0 0 60px;
                display: flex;
                justify-content: center;
                align-items: center;
              `;
              return container;
            });
            
            // Clear any previous content
            equipmentContainer.innerHTML = '';
            equipmentContainer.textContent = '';
            if (equipmentContainer._cyclopediaEquipClickHandler) {
              equipmentContainer.removeEventListener('click', equipmentContainer._cyclopediaEquipClickHandler);
              delete equipmentContainer._cyclopediaEquipClickHandler;
            }
            equipmentContainer.style.cursor = 'default';
            equipmentContainer.title = '';
            
            if (actor.equip && actor.equip.gameId) {
              let equipmentName = null;
              // Create equipment icon using the game's UI components
              try {
                if (api && api.ui && api.ui.components && api.ui.components.createItemPortrait) {
                  // Get equipment data to get the correct spriteId
                  let eqData = null;
                  try {
                    if (actor.equip.gameId && globalThis.state?.utils?.getEquipment) {
                      eqData = globalThis.state.utils.getEquipment(actor.equip.gameId);
                      equipmentName = eqData?.metadata?.name || null;
                    }
                  } catch (e) {
                    console.warn('[Cyclopedia] Error getting equipment data:', e);
                  }
                  
                  const equipmentPortrait = api.ui.components.createItemPortrait({
                    itemId: eqData?.metadata?.spriteId || actor.equip.gameId,
                    tier: actor.equip.tier || 1
                  });
                  
                  // Check if we got a valid DOM element
                  if (equipmentPortrait && equipmentPortrait.nodeType) {
                    let portraitElement = null;
                    
                    // If it's a button, get the first child (the actual portrait)
                    if (equipmentPortrait.tagName === 'BUTTON' && equipmentPortrait.firstChild) {
                      const firstChild = equipmentPortrait.firstChild;
                      if (firstChild && firstChild.nodeType) {
                        equipmentPortrait.removeChild(firstChild);
                        equipmentContainer.appendChild(firstChild);
                        portraitElement = firstChild;
                      } else {
                        // Invalid first child, fallback to text
                        equipmentContainer.textContent = `T${actor.equip.tier || 1}`;
                      }
                    } else {
                      // Direct append if it's not a button
                      equipmentContainer.appendChild(equipmentPortrait);
                      portraitElement = equipmentPortrait;
                    }
                    
                    // Style the equipment container
                    equipmentContainer.style.cssText += `
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      width: 40px;
                      height: 40px;
                    `;
                    
                    // Add stat icon overlay inside the portrait element
                    if (portraitElement) {
                      // Ensure portrait has position: relative for absolute positioning of icon
                      portraitElement.style.position = 'relative';
                      
                      const equipStat = actor.equip.stat || eqData?.metadata?.stat;
                      if (equipStat && ['hp', 'ad', 'ap'].includes(equipStat)) {
                        const statIcons = {
                          hp: '/assets/icons/heal.png',
                          ad: '/assets/icons/attackdamage.png',
                          ap: '/assets/icons/abilitypower.png'
                        };
                        const statIcon = document.createElement('img');
                        statIcon.src = statIcons[equipStat];
                        statIcon.alt = equipStat.toUpperCase();
                        statIcon.style.cssText = `
                          position: absolute;
                          bottom: 2px;
                          left: 2px;
                          width: 14px;
                          height: 14px;
                          pointer-events: none;
                          z-index: 10;
                        `;
                        portraitElement.appendChild(statIcon);
                      }
                    }
                  } else {
                    // Invalid portrait returned, fallback to text
                    equipmentContainer.textContent = `T${actor.equip.tier || 1}`;
                    equipmentContainer.style.cssText += `
                      font-size: 12px;
                      color: #888;
                      font-weight: bold;
                    `;
                  }
                } else {
                  // Fallback to text if UI components not available
                  equipmentContainer.textContent = `T${actor.equip.tier || 1}`;
                  equipmentContainer.style.cssText += `
                    font-size: 12px;
                    color: #888;
                    font-weight: bold;
                  `;
                }
              } catch (error) {
                console.warn('[Cyclopedia] Error creating equipment portrait:', error);
                // Fallback to text
                equipmentContainer.textContent = `T${actor.equip.tier || 1}`;
                equipmentContainer.style.cssText += `
                  font-size: 12px;
                  color: #888;
                  font-weight: bold;
                `;
              }

              if (equipmentName) {
                equipmentContainer.style.cursor = 'pointer';
                equipmentContainer.title = `Open ${equipmentName} in Equipment`;
                const handleEquipmentClick = () => {
                  if (typeof setActiveTab === 'function') {
                    setActiveTab(2);
                  }
                  const clickEquipmentTimeout = setTimeout(() => {
                    if (typeof _cyclopediaClickListItem === 'function' && typeof tabPages !== 'undefined' && tabPages[2]) {
                      _cyclopediaClickListItem(tabPages[2], equipmentName);
                    }
                  }, 0);
                  TimerManager.addTimeout(clickEquipmentTimeout, 'mapsEquipSelect');
                };
                equipmentContainer.addEventListener('click', handleEquipmentClick);
                equipmentContainer._cyclopediaEquipClickHandler = handleEquipmentClick;
              }
            } else {
              equipmentContainer.textContent = '—';
              equipmentContainer.style.cssText += `
                font-size: 14px;
                color: #666;
              `;
            }
            
            // Assemble the row
            creatureRow.appendChild(iconContainer);
            creatureRow.appendChild(infoContainer);
            creatureRow.appendChild(equipmentContainer);
            
            creaturesGrid.appendChild(creatureRow);
          } catch (error) {
            console.error('[Cyclopedia] Error creating creature row for actor:', actor, error);
          }
        });
        
        creaturesContainer.appendChild(creaturesGrid);
      } else {
        const noCreaturesMsg = document.createElement('p');
        noCreaturesMsg.textContent = `No creatures found on this map. (Room ID: ${selectedMap})`;
        noCreaturesMsg.style.cssText = `
          color: #888;
          font-style: italic;
        `;
        creaturesContainer.appendChild(noCreaturesMsg);
      }
      
      return creaturesContainer;
    }

    // Helper function to create a compact stat column (like Statistics section)
    function createCompactStatColumn(iconSrc, iconAlt, mapId, mapData, leaderboardData) {
      const statCol = document.createElement('div');
      statCol.style.display = 'flex';
      statCol.style.flexDirection = 'column';
      statCol.style.alignItems = 'center';
      statCol.style.justifyContent = 'center';
      statCol.style.padding = '4px';
      statCol.style.minWidth = '80px';
      statCol.style.maxWidth = '100px';
      statCol.style.fontSize = '9px';
      statCol.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
      statCol.style.textAlign = 'center';
      
      // Icon
      const icon = document.createElement('img');
      icon.src = iconSrc;
      icon.alt = iconAlt;
      icon.style.width = '12px';
      icon.style.height = '12px';
      icon.style.marginBottom = '4px';
      statCol.appendChild(icon);
      
      // Content container
      const content = document.createElement('div');
      content.style.display = 'flex';
      content.style.flexDirection = 'column';
      content.style.gap = '2px';
      content.style.width = '100%';
      
      // Determine stat type and get data
      const isSpeedrun = iconAlt === 'Speed';
      const isRankPoints = iconAlt === 'Grade';
      const isFloors = iconAlt === 'Floors';
      const activeSeason = Number(cyclopediaState.profileSeason || 1);
      const allowGlobalWorldRecords = activeSeason === 2;
      
      if (isSpeedrun) {
        const yourTicks = mapData?.ticks || 0;
        const bestTicks = leaderboardData?.best?.[mapId]?.ticks || 0;
        const bestPlayer = leaderboardData?.best?.[mapId]?.userName || '';
        
        // Check if personal equals world record
        const isPersonalWR = yourTicks > 0 && bestTicks > 0 && yourTicks === bestTicks;
        
        if (allowGlobalWorldRecords && bestTicks > 0) {
          const wrDiv = document.createElement('div');
          wrDiv.style.color = '#ff8';
          wrDiv.style.fontWeight = 'bold';
          wrDiv.style.fontSize = '8px';
          wrDiv.textContent = 'WR';
          content.appendChild(wrDiv);
          
          const wrValue = document.createElement('div');
          wrValue.style.color = '#fff';
          wrValue.style.fontSize = '9px';
          wrValue.textContent = `${bestTicks}`;
          content.appendChild(wrValue);
        }
        
        if (yourTicks > 0) {
          const yourDiv = document.createElement('div');
          yourDiv.style.color = '#8f8';
          yourDiv.style.fontWeight = 'bold';
          yourDiv.style.fontSize = '8px';
          yourDiv.textContent = 'You';
          content.appendChild(yourDiv);
          
          const yourValue = document.createElement('div');
          yourValue.style.color = isPersonalWR ? '#8f8' : '#ccc';
          yourValue.style.fontSize = '9px';
          yourValue.style.fontWeight = isPersonalWR ? 'bold' : 'normal';
          yourValue.style.textDecoration = isPersonalWR ? 'underline' : 'none';
          yourValue.textContent = `${yourTicks}`;
          content.appendChild(yourValue);
        }
        
        if (bestTicks === 0 && yourTicks === 0) {
          const noData = document.createElement('div');
          noData.style.color = '#666';
          noData.style.fontSize = '8px';
          noData.textContent = '—';
          content.appendChild(noData);
        }
      } else if (isRankPoints) {
        const yourRank = mapData?.rank || 0;
        const yourRankTicks = mapData?.rankTicks;
        const bestRank = leaderboardData?.roomsHighscores?.rank?.[mapId]?.rank || 0;
        const bestRankTicks = leaderboardData?.roomsHighscores?.rank?.[mapId]?.ticks;
        const bestPlayer = leaderboardData?.roomsHighscores?.rank?.[mapId]?.userName || '';
        
        // Check if personal rank equals world record (excluding ticks)
        const isPersonalWR = yourRank > 0 && bestRank > 0 && yourRank === bestRank;
        
        if (allowGlobalWorldRecords && bestRank > 0) {
          const wrDiv = document.createElement('div');
          wrDiv.style.color = '#ff8';
          wrDiv.style.fontWeight = 'bold';
          wrDiv.style.fontSize = '8px';
          wrDiv.textContent = 'WR';
          content.appendChild(wrDiv);
          
          const wrValue = document.createElement('div');
          wrValue.style.color = '#fff';
          wrValue.style.fontSize = '9px';
          wrValue.innerHTML = `${bestRank}${bestRankTicks !== undefined && bestRankTicks !== null ? ` <i style="color: #aaa; font-size: 7px;">(${bestRankTicks})</i>` : ''}`;
          content.appendChild(wrValue);
        }
        
        if (yourRank > 0) {
          const yourDiv = document.createElement('div');
          yourDiv.style.color = '#8f8';
          yourDiv.style.fontWeight = 'bold';
          yourDiv.style.fontSize = '8px';
          yourDiv.textContent = 'You';
          content.appendChild(yourDiv);
          
          const yourValue = document.createElement('div');
          yourValue.style.color = isPersonalWR ? '#8f8' : '#ccc';
          yourValue.style.fontSize = '9px';
          yourValue.style.fontWeight = isPersonalWR ? 'bold' : 'normal';
          yourValue.style.textDecoration = isPersonalWR ? 'underline' : 'none';
          yourValue.innerHTML = `${yourRank}${yourRankTicks !== undefined && yourRankTicks !== null ? ` <i style="color: #aaa; font-size: 7px;">(${yourRankTicks})</i>` : ''}`;
          content.appendChild(yourValue);
        }
        
        if (bestRank === 0 && yourRank === 0) {
          const noData = document.createElement('div');
          noData.style.color = '#666';
          noData.style.fontSize = '8px';
          noData.textContent = '—';
          content.appendChild(noData);
        }
      } else if (isFloors) {
        const yourRoom = mapData;
        const { floor: yourFloor, floorTicks: yourFloorTicks } = normalizeUserFloorData(yourRoom);
        
        // Get best floor data using normalizeBestFloorData
        let bestFloor = 0;
        let bestFloorTicks = null;
        if (leaderboardData) {
          const bestFloorData = normalizeBestFloorData(mapId, leaderboardData.roomsHighscores, leaderboardData.best);
          bestFloor = bestFloorData.floor !== undefined && bestFloorData.floor !== null ? bestFloorData.floor : 0;
          bestFloorTicks = bestFloorData.floorTicks;
        }
        
        if (allowGlobalWorldRecords && (bestFloorTicks > 0 || bestFloor > 0)) {
          const wrDiv = document.createElement('div');
          wrDiv.style.color = '#ff8';
          wrDiv.style.fontWeight = 'bold';
          wrDiv.style.fontSize = '8px';
          wrDiv.textContent = 'WR';
          content.appendChild(wrDiv);
          
          const wrValue = document.createElement('div');
          wrValue.style.color = '#fff';
          wrValue.style.fontSize = '9px';
          wrValue.innerHTML = `Floor ${bestFloor}${bestFloorTicks !== undefined && bestFloorTicks !== null ? ` <i style="color: #aaa; font-size: 7px;">(${bestFloorTicks})</i>` : ''}`;
          content.appendChild(wrValue);
        }
        
        if (yourFloor !== undefined && yourFloor !== null) {
          const yourDiv = document.createElement('div');
          yourDiv.style.color = '#8f8';
          yourDiv.style.fontWeight = 'bold';
          yourDiv.style.fontSize = '8px';
          yourDiv.textContent = 'You';
          content.appendChild(yourDiv);
          
          // Check if floor is 15 (max floor)
          const isMaxFloor = yourFloor === 15;
          
          const yourValue = document.createElement('div');
          yourValue.style.color = isMaxFloor ? '#8f8' : '#ccc';
          yourValue.style.fontSize = '9px';
          yourValue.style.fontWeight = isMaxFloor ? 'bold' : 'normal';
          yourValue.style.textDecoration = isMaxFloor ? 'underline' : 'none';
          yourValue.innerHTML = `Floor ${yourFloor}${yourFloorTicks !== undefined && yourFloorTicks !== null ? ` <i style="color: #aaa; font-size: 7px;">(${yourFloorTicks})</i>` : ''}`;
          content.appendChild(yourValue);
        }
        
        if ((bestFloorTicks === 0 || bestFloor === 0) && (yourFloor === undefined || yourFloor === null)) {
          const noData = document.createElement('div');
          noData.style.color = '#666';
          noData.style.fontSize = '8px';
          noData.textContent = '—';
          content.appendChild(noData);
        }
      }
      
      statCol.appendChild(content);
      return statCol;
    }

    // Helper function to create region maps section (shows all maps in a region)
    function createRegionMapsSection(mapsInRegion, regionId, onMapSelect) {
      function addSoftHyphensToLongWords(text) {
        if (!text) return text;
        return String(text).replace(/[A-Za-zÀ-ÿ']{12,}/g, (word) => {
          const chunks = word.match(/.{1,8}/g);
          return chunks ? chunks.join('\u00AD') : word;
        });
      }

      const regionMapsDiv = document.createElement('div');
      regionMapsDiv.style.padding = '0 20px 20px 20px';
      regionMapsDiv.style.color = COLOR_CONSTANTS.TEXT;
      regionMapsDiv.style.width = '100%';
      regionMapsDiv.style.boxSizing = 'border-box';
      regionMapsDiv.style.marginBottom = '0';
      
      // Region title
      const regionTitle = document.createElement('h3');
      const regionName = cyclopediaGetRegionDisplayName(regionId);
      regionTitle.textContent = regionName;
      regionTitle.style.margin = '0 0 15px 0';
      regionTitle.style.fontSize = '18px';
      regionTitle.style.fontWeight = 'bold';
      regionTitle.style.textAlign = 'center';
      regionMapsDiv.appendChild(regionTitle);

      // Maps container (no scroll - parent handles scrolling)
      const mapsContainer = document.createElement('div');
      mapsContainer.style.display = 'flex';
      mapsContainer.style.flexDirection = 'column';
      mapsContainer.style.gap = '10px';
      mapsContainer.style.paddingRight = '8px';
      
      const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
      const playerRooms = getYourRoomsForCyclopediaSeason(playerState?.rooms || {});
      
      // Filter out dynamic event maps from display
      const mapsToDisplay = mapsInRegion.filter(map => !isDynamicEventMap(map.id));
      
      // Fetch leaderboard data for all maps
      fetchMapsLeaderboardData().then(leaderboardData => {
        mapsToDisplay.forEach(map => {
          const mapItem = document.createElement('div');
          mapItem.style.display = 'grid';
          mapItem.style.gridTemplateColumns = '64px 1fr auto auto auto';
          mapItem.style.alignItems = 'center';
          mapItem.style.gap = '8px';
          mapItem.style.padding = '8px';
          mapItem.style.border = '2px solid #666';
          mapItem.style.borderRadius = '4px';
          mapItem.style.cursor = 'pointer';
          mapItem.style.transition = 'background-color 0.2s';
          
          // Check if map is explored
          const isExplored = playerRooms[map.id] !== undefined;
          if (!isExplored) {
            mapItem.style.opacity = '0.6';
            mapItem.style.filter = 'grayscale(0.7)';
          }
          
          // Thumbnail (Column 1)
          const thumbnail = document.createElement('img');
          thumbnail.src = `/assets/room-thumbnails/${map.id}.png`;
          thumbnail.alt = map.name;
          thumbnail.className = 'pixelated';
          thumbnail.style.width = '64px';
          thumbnail.style.height = '64px';
          thumbnail.style.objectFit = 'cover';
          thumbnail.style.border = '1px solid #666';
          thumbnail.style.borderRadius = '4px';
          mapItem.appendChild(thumbnail);
          
          // Map name (Column 2)
          const mapName = document.createElement('div');
          mapName.textContent = addSoftHyphensToLongWords(map.name);
          mapName.style.fontSize = '14px';
          mapName.style.fontWeight = 'bold';
          mapName.style.hyphens = 'auto';
          mapName.style.wordBreak = 'break-word';
          mapName.style.overflowWrap = 'anywhere';
          mapItem.appendChild(mapName);
          
          // Get map data
          const mapData = isExplored ? playerRooms[map.id] : null;
          
          // Speedrun column (Column 3)
          const speedrunCol = createCompactStatColumn(
            'https://bestiaryarena.com/assets/icons/speed.png',
            'Speed',
            map.id,
            mapData,
            leaderboardData
          );
          speedrunCol.style.minWidth = '60px';
          speedrunCol.style.maxWidth = '60px';
          mapItem.appendChild(speedrunCol);
          
          // Rank Points column (Column 4)
          const rankPointsCol = createCompactStatColumn(
            'https://bestiaryarena.com/assets/icons/grade.png',
            'Grade',
            map.id,
            mapData,
            leaderboardData
          );
          rankPointsCol.style.minWidth = '60px';
          rankPointsCol.style.maxWidth = '60px';
          mapItem.appendChild(rankPointsCol);
          
          // Floors column (Column 5)
          const floorsCol = createCompactStatColumn(
            'https://bestiaryarena.com/assets/icons/floors.png',
            'Floors',
            map.id,
            mapData,
            leaderboardData
          );
          mapItem.appendChild(floorsCol);
          
          // Hover effect
          mapItem.addEventListener('mouseenter', () => {
            mapItem.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          });
          mapItem.addEventListener('mouseleave', () => {
            mapItem.style.backgroundColor = 'transparent';
          });
          
          // Click to select map
          mapItem.addEventListener('click', () => {
            if (onMapSelect) {
              onMapSelect(map.id);
            }
          });
          
          mapsContainer.appendChild(mapItem);
        });
      }).catch(error => {
        console.error('[Cyclopedia] Error fetching leaderboard data for region maps:', error);
        // Still show maps without leaderboard data
        mapsToDisplay.forEach(map => {
          const mapItem = document.createElement('div');
          mapItem.style.display = 'grid';
          mapItem.style.gridTemplateColumns = '64px 1fr auto auto auto';
          mapItem.style.alignItems = 'center';
          mapItem.style.gap = '8px';
          mapItem.style.padding = '8px';
          mapItem.style.border = '2px solid #666';
          mapItem.style.borderRadius = '4px';
          mapItem.style.cursor = 'pointer';
          
          const isExplored = playerRooms[map.id] !== undefined;
          if (!isExplored) {
            mapItem.style.opacity = '0.6';
            mapItem.style.filter = 'grayscale(0.7)';
          }
          
          const thumbnail = document.createElement('img');
          thumbnail.src = `/assets/room-thumbnails/${map.id}.png`;
          thumbnail.alt = map.name;
          thumbnail.className = 'pixelated';
          thumbnail.style.width = '64px';
          thumbnail.style.height = '64px';
          thumbnail.style.objectFit = 'cover';
          thumbnail.style.border = '1px solid #666';
          thumbnail.style.borderRadius = '4px';
          mapItem.appendChild(thumbnail);
          
          const mapName = document.createElement('div');
          mapName.textContent = addSoftHyphensToLongWords(map.name);
          mapName.style.fontSize = '14px';
          mapName.style.fontWeight = 'bold';
          mapName.style.hyphens = 'auto';
          mapName.style.wordBreak = 'break-word';
          mapName.style.overflowWrap = 'anywhere';
          mapItem.appendChild(mapName);
          
          const mapData = isExplored ? playerRooms[map.id] : null;
          const speedrunCol = createCompactStatColumn('https://bestiaryarena.com/assets/icons/speed.png', 'Speed', map.id, mapData, null);
          const rankPointsCol = createCompactStatColumn('https://bestiaryarena.com/assets/icons/grade.png', 'Grade', map.id, mapData, null);
          const floorsCol = createCompactStatColumn('https://bestiaryarena.com/assets/icons/floors.png', 'Floors', map.id, mapData, null);
          speedrunCol.style.minWidth = '60px';
          speedrunCol.style.maxWidth = '60px';
          rankPointsCol.style.minWidth = '60px';
          rankPointsCol.style.maxWidth = '60px';
          mapItem.appendChild(speedrunCol);
          mapItem.appendChild(rankPointsCol);
          mapItem.appendChild(floorsCol);
          
          mapItem.addEventListener('click', () => {
            if (onMapSelect) {
              onMapSelect(map.id);
            }
          });
          
          mapsContainer.appendChild(mapItem);
        });
      });
      
      regionMapsDiv.appendChild(mapsContainer);
      return regionMapsDiv;
    }

    // Helper function to create region statistics section
    function createRegionStatisticsSection(regionId, mapsInRegion) {
      const statsContainer = document.createElement('div');
      statsContainer.style.display = 'flex';
      statsContainer.style.flexDirection = 'column';
      statsContainer.style.width = '100%';
      statsContainer.style.flex = '1 1 0';
      statsContainer.style.minHeight = '0';
      statsContainer.style.overflowY = 'auto';
      statsContainer.style.boxSizing = 'border-box';
      statsContainer.style.padding = '15px';
      
      // Get player state
      const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
      const activeSeason = Number(cyclopediaState.profileSeason || 1);
      const allowGlobalWorldRecords = activeSeason === 2;
      const playerRooms = getYourRoomsForCyclopediaSeason(playerState?.rooms || {});
      const roomsArray = globalThis.state?.utils?.ROOMS || [];
      
      // Calculate statistics
      // Filter out raid maps and dynamic event maps from the count
      // Dynamic events (raids not in STATIC_RAID_EVENTS) should be excluded from statistics
      const nonRaidMaps = mapsInRegion.filter(map => !isMapRaid(map.id));
      const staticRaidMaps = mapsInRegion.filter(map => isMapRaid(map.id) && !isDynamicEventMap(map.id));
      const dynamicEventMaps = mapsInRegion.filter(map => isDynamicEventMap(map.id));
      const raidMaps = mapsInRegion.filter(map => isMapRaid(map.id)); // All raids (static + dynamic) for display
      const totalNonRaidMaps = nonRaidMaps.length;
      const totalRaidMaps = staticRaidMaps.length; // Only count static raids for statistics
      
      let exploredCount = 0;
      let exploredRaidsCount = 0;
      let totalRankPoints = 0;
      let totalRaidRankPoints = 0;
      let maxRankPoints = 0;
      let maxRaidRankPoints = 0;
      let totalFloors = 0;
      let totalRaidFloors = 0;
      let maxFloors = 0;
      let maxRaidFloors = 0;
      let totalTicks = 0; // Personal total ticks (non-raid)
      let totalRaidTicks = 0; // Personal total ticks (raids)
      let totalWRTicks = 0; // World record total ticks (non-raid)
      let totalWRRaidTicks = 0; // World record total ticks (raids)
      
      // Only count non-raid maps for explored count and rank points/floors
      nonRaidMaps.forEach(map => {
        const isExplored = playerRooms[map.id] !== undefined;
        if (isExplored) {
          exploredCount++;
          
          const mapData = playerRooms[map.id];
          if (mapData.rank !== undefined && mapData.rank !== null) {
            totalRankPoints += mapData.rank;
          }
          if (mapData.floor !== undefined && mapData.floor !== null) {
            totalFloors += mapData.floor;
          }
          if (mapData.ticks !== undefined && mapData.ticks !== null) {
            totalTicks += mapData.ticks;
          }
        }
      });
      
      // Count explored static raids and their rank points/floors (exclude dynamic events)
      staticRaidMaps.forEach(map => {
        const isExplored = playerRooms[map.id] !== undefined;
        if (isExplored) {
          exploredRaidsCount++;
          
          const mapData = playerRooms[map.id];
          if (mapData.rank !== undefined && mapData.rank !== null) {
            totalRaidRankPoints += mapData.rank;
          }
          if (mapData.floor !== undefined && mapData.floor !== null) {
            totalRaidFloors += mapData.floor;
          }
          if (mapData.ticks !== undefined && mapData.ticks !== null) {
            totalRaidTicks += mapData.ticks;
          }
        }
      });
      
      // Calculate max possible values for non-raid maps
      nonRaidMaps.forEach(map => {
        // Find room data from ROOMS array (ROOMS is an array, not an object)
        const roomData = roomsArray.find(room => room.id === map.id);
        if (roomData && roomData.maxTeamSize) {
          // Calculate max rank points = (2 * maxTeamSize) - 1 per map
          const mapMaxRankPoints = (2 * roomData.maxTeamSize) - 1;
          maxRankPoints += mapMaxRankPoints;
        } else {
          // Fallback: if no room data found, assume maxTeamSize of 1
          maxRankPoints += 1; // (2 * 1) - 1 = 1
        }
        
        // Max floor is always 15 per map
        maxFloors += 15;
      });
      
      // Calculate max possible values for static raid maps (exclude dynamic events)
      staticRaidMaps.forEach(map => {
        // Find room data from ROOMS array (ROOMS is an array, not an object)
        const roomData = roomsArray.find(room => room.id === map.id);
        if (roomData && roomData.maxTeamSize) {
          // Calculate max rank points = (2 * maxTeamSize) - 1 per map
          const mapMaxRankPoints = (2 * roomData.maxTeamSize) - 1;
          maxRaidRankPoints += mapMaxRankPoints;
        } else {
          // Fallback: if no room data found, assume maxTeamSize of 1
          maxRaidRankPoints += 1; // (2 * 1) - 1 = 1
        }
        
        // Max floor is always 15 per map (for raids too)
        maxRaidFloors += 15;
      });
      
      // Fetch leaderboard data to calculate WR total ticks (season 2 only).
      if (allowGlobalWorldRecords) {
        fetchMapsLeaderboardData().then(leaderboardData => {
          // Calculate WR total ticks for non-raid maps
          nonRaidMaps.forEach(map => {
            const bestTicks = leaderboardData?.best?.[map.id]?.ticks || 0;
            if (bestTicks > 0) {
              totalWRTicks += bestTicks;
            }
          });
          
          // Calculate WR total ticks for static raid maps
          staticRaidMaps.forEach(map => {
            const bestTicks = leaderboardData?.best?.[map.id]?.ticks || 0;
            if (bestTicks > 0) {
              totalWRRaidTicks += bestTicks;
            }
          });
          
          // Update Speedrun display with calculated values
          updateSpeedrunDisplay();
        }).catch(error => {
          console.error('[Cyclopedia] Error fetching leaderboard data for region statistics:', error);
          // Still show stats without WR data
          updateSpeedrunDisplay();
        });
      } else {
        // WR display disabled for non-Season-2 modes.
        updateSpeedrunDisplay();
      }
      
      // Function to update speedrun display (called after leaderboard data is fetched)
      function updateSpeedrunDisplay() {
        const speedrunValue = statsContainer.querySelector('.speedrun-total-ticks');
        if (speedrunValue) {
          speedrunValue.textContent = `${totalTicks.toLocaleString()} / ${totalWRTicks > 0 ? totalWRTicks.toLocaleString() : '—'} ticks`;
          speedrunValue.style.color = totalWRTicks > 0 && totalTicks <= totalWRTicks ? '#8f8' : '#ff8';
        }
        
        // Update raid speedrun display if it exists
        const raidSpeedrunValue = statsContainer.querySelector('.speedrun-raid-ticks');
        if (raidSpeedrunValue) {
          raidSpeedrunValue.textContent = `Raids: ${totalRaidTicks.toLocaleString()} / ${totalWRRaidTicks > 0 ? totalWRRaidTicks.toLocaleString() : '—'} ticks`;
          raidSpeedrunValue.style.color = totalWRRaidTicks > 0 && totalRaidTicks <= totalWRRaidTicks ? '#8f8' : '#ff8';
        }
      }
      
      // Title
      const title = document.createElement('h3');
      const regionName = cyclopediaGetRegionDisplayName(regionId);
      // Header already contains season; avoid repeating "Region · Season N" inside the card.
      title.textContent = regionName;
      title.style.margin = '0 0 12px 0';
      title.style.fontSize = '16px';
      title.style.fontWeight = 'bold';
      title.style.textAlign = 'center';
      title.style.color = COLOR_CONSTANTS.TEXT;
      statsContainer.appendChild(title);
      
      // Statistics grid
      const statsGrid = document.createElement('div');
      statsGrid.style.display = 'flex';
      statsGrid.style.flexDirection = 'column';
      statsGrid.style.gap = '12px';
      
      // Explored maps
      const exploredDiv = document.createElement('div');
      exploredDiv.style.padding = '10px';
      exploredDiv.style.border = '2px solid #666';
      exploredDiv.style.borderRadius = '4px';
      exploredDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
      
      const exploredLabel = document.createElement('div');
      exploredLabel.textContent = 'Explored Maps';
      exploredLabel.style.fontSize = '13px';
      exploredLabel.style.fontWeight = 'bold';
      exploredLabel.style.marginBottom = '6px';
      exploredLabel.style.color = COLOR_CONSTANTS.TEXT;
      exploredDiv.appendChild(exploredLabel);
      
      const exploredValue = document.createElement('div');
      exploredValue.textContent = `${exploredCount} / ${totalNonRaidMaps} maps`;
      exploredValue.style.fontSize = '18px';
      exploredValue.style.fontWeight = 'bold';
      exploredValue.style.color = exploredCount === totalNonRaidMaps ? '#8f8' : '#ff8';
      exploredDiv.appendChild(exploredValue);
      
      // Show explored raids if there are any raids in the region
      if (totalRaidMaps > 0) {
        const exploredRaidsValue = document.createElement('div');
        exploredRaidsValue.textContent = `Raids: ${exploredRaidsCount} / ${totalRaidMaps} maps`;
        exploredRaidsValue.style.fontSize = '12px';
        exploredRaidsValue.style.fontWeight = 'normal';
        exploredRaidsValue.style.color = exploredRaidsCount === totalRaidMaps ? '#8f8' : '#ff8';
        exploredRaidsValue.style.marginTop = '6px';
        exploredDiv.appendChild(exploredRaidsValue);
      }
      
      statsGrid.appendChild(exploredDiv);
      
      // Speedrun
      const speedrunDiv = document.createElement('div');
      speedrunDiv.style.padding = '10px';
      speedrunDiv.style.border = '2px solid #666';
      speedrunDiv.style.borderRadius = '4px';
      speedrunDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
      
      const speedrunLabel = document.createElement('div');
      speedrunLabel.textContent = 'Speedrun';
      speedrunLabel.style.fontSize = '13px';
      speedrunLabel.style.fontWeight = 'bold';
      speedrunLabel.style.marginBottom = '6px';
      speedrunLabel.style.color = COLOR_CONSTANTS.TEXT;
      speedrunDiv.appendChild(speedrunLabel);
      
      const speedrunValue = document.createElement('div');
      speedrunValue.className = 'speedrun-total-ticks';
      speedrunValue.textContent = `${totalTicks.toLocaleString()} / — ticks`;
      speedrunValue.style.fontSize = '18px';
      speedrunValue.style.fontWeight = 'bold';
      speedrunValue.style.color = '#ff8';
      speedrunDiv.appendChild(speedrunValue);
      
      // Show raid speedrun if there are any raids in the region
      if (totalRaidMaps > 0) {
        const raidSpeedrunValue = document.createElement('div');
        raidSpeedrunValue.className = 'speedrun-raid-ticks';
        raidSpeedrunValue.textContent = `Raids: ${totalRaidTicks.toLocaleString()} / — ticks`;
        raidSpeedrunValue.style.fontSize = '12px';
        raidSpeedrunValue.style.fontWeight = 'normal';
        raidSpeedrunValue.style.color = '#ff8';
        raidSpeedrunValue.style.marginTop = '6px';
        speedrunDiv.appendChild(raidSpeedrunValue);
      }
      
      statsGrid.appendChild(speedrunDiv);
      
      // Rank Points
      const rankPointsDiv = document.createElement('div');
      rankPointsDiv.style.padding = '10px';
      rankPointsDiv.style.border = '2px solid #666';
      rankPointsDiv.style.borderRadius = '4px';
      rankPointsDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
      
      const rankPointsLabel = document.createElement('div');
      rankPointsLabel.textContent = 'Rank Points';
      rankPointsLabel.style.fontSize = '13px';
      rankPointsLabel.style.fontWeight = 'bold';
      rankPointsLabel.style.marginBottom = '6px';
      rankPointsLabel.style.color = COLOR_CONSTANTS.TEXT;
      rankPointsDiv.appendChild(rankPointsLabel);
      
      const rankPointsValue = document.createElement('div');
      rankPointsValue.textContent = `${totalRankPoints.toLocaleString()} / ${maxRankPoints.toLocaleString()} points`;
      rankPointsValue.style.fontSize = '18px';
      rankPointsValue.style.fontWeight = 'bold';
      rankPointsValue.style.color = totalRankPoints === maxRankPoints ? '#8f8' : '#ff8';
      rankPointsDiv.appendChild(rankPointsValue);
      
      // Show raid rank points if there are any raids in the region
      if (totalRaidMaps > 0) {
        const raidRankPointsValue = document.createElement('div');
        raidRankPointsValue.textContent = `Raids: ${totalRaidRankPoints.toLocaleString()} / ${maxRaidRankPoints.toLocaleString()} points`;
        raidRankPointsValue.style.fontSize = '12px';
        raidRankPointsValue.style.fontWeight = 'normal';
        raidRankPointsValue.style.color = totalRaidRankPoints === maxRaidRankPoints ? '#8f8' : '#ff8';
        raidRankPointsValue.style.marginTop = '6px';
        rankPointsDiv.appendChild(raidRankPointsValue);
      }
      
      statsGrid.appendChild(rankPointsDiv);
      
      // Floors
      const floorsDiv = document.createElement('div');
      floorsDiv.style.padding = '10px';
      floorsDiv.style.border = '2px solid #666';
      floorsDiv.style.borderRadius = '4px';
      floorsDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
      
      const floorsLabel = document.createElement('div');
      floorsLabel.textContent = 'Floors';
      floorsLabel.style.fontSize = '13px';
      floorsLabel.style.fontWeight = 'bold';
      floorsLabel.style.marginBottom = '6px';
      floorsLabel.style.color = COLOR_CONSTANTS.TEXT;
      floorsDiv.appendChild(floorsLabel);
      
      const floorsValue = document.createElement('div');
      floorsValue.textContent = `${totalFloors.toLocaleString()} / ${maxFloors.toLocaleString()} floors`;
      floorsValue.style.fontSize = '18px';
      floorsValue.style.fontWeight = 'bold';
      floorsValue.style.color = totalFloors === maxFloors ? '#8f8' : '#ff8';
      floorsDiv.appendChild(floorsValue);
      
      // Show raid floors if there are any raids in the region
      if (totalRaidMaps > 0) {
        const raidFloorsValue = document.createElement('div');
        raidFloorsValue.textContent = `Raids: ${totalRaidFloors.toLocaleString()} / ${maxRaidFloors.toLocaleString()} floors`;
        raidFloorsValue.style.fontSize = '12px';
        raidFloorsValue.style.fontWeight = 'normal';
        raidFloorsValue.style.color = totalRaidFloors === maxRaidFloors ? '#8f8' : '#ff8';
        raidFloorsValue.style.marginTop = '6px';
        floorsDiv.appendChild(raidFloorsValue);
      }
      
      statsGrid.appendChild(floorsDiv);
      
      statsContainer.appendChild(statsGrid);
      return statsContainer;
    }

    // Helper function to create map information section
    function createMapInfoSection(selectedMap, roomName) {
      const mapInfoDiv = document.createElement('div');
      mapInfoDiv.style.padding = '0 20px 20px 20px';
      mapInfoDiv.style.color = COLOR_CONSTANTS.TEXT;
      mapInfoDiv.style.width = '100%';
      mapInfoDiv.style.boxSizing = 'border-box';
      mapInfoDiv.style.marginBottom = '0';
      mapInfoDiv.style.flex = '0 0 auto';
      
      // Add room thumbnail with overlay container
      const thumbnailContainer = document.createElement('div');
      thumbnailContainer.style.position = 'relative';
      thumbnailContainer.style.width = '192px';
      thumbnailContainer.style.height = '192px';
      thumbnailContainer.style.margin = '0 auto';
      thumbnailContainer.style.display = 'block';
      
      const thumbnail = document.createElement('img');
      thumbnail.alt = roomName;
      thumbnail.className = 'pixelated';
      thumbnail.style.width = '100%';
      thumbnail.style.height = '100%';
      thumbnail.style.objectFit = 'cover';
      thumbnail.style.border = '2px solid #666';
      thumbnail.style.borderRadius = '4px';
      thumbnail.src = `/assets/room-thumbnails/${selectedMap}.png`;
      
      thumbnailContainer.appendChild(thumbnail);
      appendCyclopediaBoostedEquipmentOverlay(thumbnailContainer, selectedMap, roomName, {
        paddingPx: 6
      });
      mapInfoDiv.appendChild(thumbnailContainer);
      
      // Add map name with click interaction
      const title = document.createElement('h3');
      title.textContent = roomName;
      title.style.margin = '10px 0 0 0';
      title.style.fontSize = '16px';
      title.style.fontWeight = 'bold';
      title.style.textAlign = 'center';
      title.style.cursor = MAP_INTERACTION_CONFIG.cursor;
      title.title = MAP_INTERACTION_CONFIG.tooltip;
      title.style.textDecoration = MAP_INTERACTION_CONFIG.textDecoration;
      title.style.padding = MAP_INTERACTION_CONFIG.padding;
      title.style.whiteSpace = 'nowrap';
      title.style.overflow = 'hidden';
      title.style.textOverflow = 'ellipsis';
      title.style.maxWidth = '100%';
      title.style.borderRadius = MAP_INTERACTION_CONFIG.borderRadius;
      title.style.boxSizing = MAP_INTERACTION_CONFIG.boxSizing;
      
      // Add interaction handlers
      title.addEventListener('mouseenter', () => {
        title.style.background = MAP_INTERACTION_CONFIG.hoverBackground;
        title.style.color = MAP_INTERACTION_CONFIG.hoverTextColor;
      });
      
      title.addEventListener('mouseleave', () => {
        title.style.background = MAP_INTERACTION_CONFIG.defaultBackground;
        title.style.color = MAP_INTERACTION_CONFIG.defaultTextColor;
      });
      
      title.addEventListener('click', (e) => {
        e.stopPropagation();
        NavigationHandler.navigateToMapByRoomId(selectedMap);
      });
      mapInfoDiv.appendChild(title);
      
      // Add defeat count overlay on thumbnail
      try {
        const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
        if (playerState?.rooms?.[selectedMap]?.count) {
          const defeatCount = playerState.rooms[selectedMap].count;
          const countOverlay = document.createElement('div');
          countOverlay.style.position = 'absolute';
          countOverlay.style.bottom = '8px';
          countOverlay.style.left = '8px';
          countOverlay.style.right = '8px';
          countOverlay.style.backgroundImage = 'url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png")';
          countOverlay.style.backgroundRepeat = 'repeat';
          countOverlay.style.backgroundPosition = 'center';
          countOverlay.style.color = '#fff7da';
          countOverlay.style.fontSize = '11px';
          countOverlay.style.fontWeight = 'bold';
          countOverlay.style.fontFamily = 'Arial, Helvetica, sans-serif';
          countOverlay.style.textAlign = 'center';
          countOverlay.style.display = 'flex';
          countOverlay.style.alignItems = 'center';
          countOverlay.style.justifyContent = 'center';
          countOverlay.style.gap = '4px';
          countOverlay.style.letterSpacing = '0';
          countOverlay.style.wordSpacing = 'normal';
          countOverlay.style.lineHeight = '1.2';
          countOverlay.style.textShadow = '0 1px 1px #000';
          countOverlay.style.padding = '5px 6px';
          countOverlay.style.borderRadius = '4px';
          countOverlay.style.border = '3px solid transparent';
          countOverlay.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 3 fill';
          const formattedDefeatCount = defeatCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
          countOverlay.innerHTML = `<span>Defeated</span><span>${formattedDefeatCount}</span><span>times</span>`;
          thumbnailContainer.appendChild(countOverlay);
        }
      } catch (error) {
        console.warn('[Cyclopedia] Error accessing defeat count:', error);
      }
      
      return mapInfoDiv;
    }

    function createMapsTabPage(selectedCreature, selectedEquipment, selectedInventory, setSelectedCreature, setSelectedEquipment, setSelectedInventory, updateRightCol) {
      const d = document.createElement('div');
      d.style.display = 'flex';
      d.style.flexDirection = 'row';
      d.style.width = '100%';
      d.style.height = '100%';
      d.style.minWidth = '0';
      d.style.boxSizing = 'border-box';
      d.style.alignItems = 'stretch';
      d.style.justifyContent = 'flex-start';
      d.style.gap = '0';
      d.style.overflow = 'hidden';

      // Fresh tab instance: reset Maps DOM diff state so first paint cannot be skipped.
      MapsTabDOMOptimizer.currentState.selectedMap = null;
      MapsTabDOMOptimizer.currentState.selectedCategory = null;
      MapsTabDOMOptimizer.currentState.roomData = null;
      MapsTabDOMOptimizer.currentState.roomName = null;
      MapsTabDOMOptimizer.currentState.season = null;

      let selectedCategory = '';
      let selectedMap = null;

      const leftCol = document.createElement('div');
      leftCol.style.width = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.minWidth = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.maxWidth = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.flex = '0 0 auto';
      leftCol.style.height = '100%';
      leftCol.style.display = 'flex';
      leftCol.style.flexDirection = 'column';
      leftCol.style.borderRight = '6px solid transparent';
      leftCol.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
      leftCol.style.boxSizing = 'border-box';
      leftCol.style.overflowX = 'hidden';
      leftCol.style.overflowY = 'hidden';
      leftCol.style.minHeight = '0';

      function updateBottomBox() {
        try {
          if (leftCol._bottomBox && leftCol._bottomBox.parentNode) {
            safeRemoveChild(leftCol._bottomBox.parentNode, leftCol._bottomBox);
          }
          
          // Get maps for selected region from game state
          let mapsInRegion = [];
          
          if (selectedCategory && globalThis.state?.utils?.REGIONS) {
            // Show maps from specific region
            const region = globalThis.state.utils.REGIONS.find(r => r.id === selectedCategory);
            
            if (region && region.rooms) {
              
              mapsInRegion = region.rooms.map(room => ({
                id: room.id,
                name: globalThis.state.utils.ROOM_NAME[room.id] || room.id,
                region: region.id
              }));
              
            }
          }
          
          // Keep existing map only if it belongs to the currently selected region.
          if (mapsInRegion.length > 0) {
            const currentMapInRegion = mapsInRegion.find(map => map.id === selectedMap);
            if (!currentMapInRegion) {
              selectedMap = null;
            }
          } else {
            selectedMap = null;
          }

          // Find the map name for selectedMap (if selectedMap is an ID, convert to name)
          let selectedMapName = null;
          if (selectedMap) {
            const selectedMapData = mapsInRegion.find(map => map.id === selectedMap);
            selectedMapName = selectedMapData ? selectedMapData.name : selectedMap;
          }
          
          const box = createBox({
            title: 'Maps',
            items: mapsInRegion.map(map => map.name),
            mapIds: mapsInRegion.map(map => map.id),
            type: 'map',
            selectedCreature: null,
            selectedEquipment: null,
            selectedInventory: selectedMapName,
            setSelectedCreature: () => {},
            setSelectedEquipment: () => {},
            setSelectedInventory: (mapName) => {
              const mapData = mapsInRegion.find(map => map.name === mapName);
              selectedMap = mapData ? mapData.id : mapName;
              cyclopediaState.mapsLastSelectedMapId = selectedMap;
              cyclopediaState.mapsLastSelectedRegionId = selectedCategory || null;
              
              updateRightCol();
            },
            updateRightCol: () => {}
          });

          box.style.flex = '1 1 0';
          box.style.minHeight = '0';
          box.style.marginTop = '8px';
          leftCol._bottomBox = box;
          leftCol.appendChild(box);
        } catch (error) {
          console.error('[Cyclopedia] Error updating bottom box:', error);
          
          if (leftCol._bottomBox && leftCol._bottomBox.parentNode) {
            safeRemoveChild(leftCol._bottomBox.parentNode, leftCol._bottomBox);
          }

          const errorBox = document.createElement('div');
          errorBox.style.flex = '1 1 0';
          errorBox.style.minHeight = '0';
          errorBox.style.marginTop = '8px';
          errorBox.style.display = 'flex';
          errorBox.style.justifyContent = 'center';
          errorBox.style.alignItems = 'center';
          errorBox.style.color = COLOR_CONSTANTS.TEXT;
          errorBox.style.fontWeight = 'bold';
          errorBox.style.textAlign = 'center';
          errorBox.innerHTML = 'Error loading maps.';
          leftCol._bottomBox = errorBox;
          leftCol.appendChild(errorBox);
        }
      }

      // Get regions from game state with proper names
      let regions = [];
      if (globalThis.state?.utils?.REGIONS) {
        regions = globalThis.state.utils.REGIONS.map(region => region.id);
      }
      
      // Prefer Rookgaard when opening Maps tab (fallback: remembered region, then first region).
      if (regions.length > 0 && !selectedCategory) {
        const rookgaardRegion = regions.find((regionId) => {
          const id = String(regionId).toLowerCase();
          const displayName = cyclopediaGetRegionDisplayName(regionId).toLowerCase();
          return id === 'rook' || id === 'rookgaard' || displayName === 'rookgaard';
        });
        const rememberedRegion = cyclopediaState.mapsLastSelectedRegionId;
        selectedCategory = rookgaardRegion || (regions.includes(rememberedRegion) ? rememberedRegion : regions[0]);
      }

      const topBox = createBox({
        title: 'Regions',
        items: regions.map((regionId) => cyclopediaGetRegionDisplayName(regionId)),
        regionIds: regions,
        type: 'region',
        selectedCreature: null,
        selectedEquipment: null,
        selectedInventory: selectedCategory ? cyclopediaGetRegionDisplayName(selectedCategory) : null,
        setSelectedCreature: () => {},
        setSelectedEquipment: () => {},
        setSelectedInventory: (cat) => {
          // Find the region ID from the display name
          const regionId = regions.find((id) => cyclopediaGetRegionDisplayName(id) === cat) || cat;
          selectedCategory = regionId;
          cyclopediaState.mapsLastSelectedRegionId = selectedCategory || null;
          selectedMap = null;
          updateBottomBox();
          updateRightCol();
        },
        updateRightCol: () => {}
      });

      topBox.style.flex = '0 0 40%';
      topBox.style.maxHeight = '40%';
      topBox.style.minHeight = '0';
      leftCol.appendChild(topBox);
      updateBottomBox();

      // Create two columns for the right side like Equipment Tab
      const col2 = document.createElement('div');
      Object.assign(col2.style, {
        width: '250px', minWidth: '250px', maxWidth: '250px', flex: '0 0 250px', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start', fontSize: '16px',
        fontWeight: 'bold', color: COLOR_CONSTANTS.TEXT,
        borderRight: '6px solid transparent',
        borderImage: `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`,
        boxSizing: 'border-box', overflowX: 'hidden', minHeight: '0'
      });
      col2.classList.add('text-whiteHighlight');

      const col3 = document.createElement('div');
      Object.assign(col3.style, {
        flex: '1 1 0', minWidth: '0', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start', fontSize: '16px',
        fontWeight: 'bold', color: COLOR_CONSTANTS.TEXT,
        boxSizing: 'border-box', overflowX: 'auto', overflowY: 'hidden', minHeight: '0'
      });
      col3.classList.add('text-whiteHighlight');
      
      // Add content areas for optimized updates
      const col2Content = document.createElement('div');
      col2Content.className = 'maps-content-area';
      col2Content.style.flex = '1 1 0';
      col2Content.style.minHeight = '0';
      col2Content.style.width = '100%';
      col2Content.style.display = 'flex';
      col2Content.style.flexDirection = 'column';
      col2Content.style.overflow = 'hidden';
      col2Content.style.boxSizing = 'border-box';
      
      const col3Content = document.createElement('div');
      col3Content.className = 'maps-content-area';
      col3Content.style.flex = '1 1 0';
      col3Content.style.minHeight = '0';
      col3Content.style.width = '100%';
      col3Content.style.overflowY = 'auto';

      // Create titles for the columns
      const col2Title = createCyclopediaWidgetTitle(getMapsTabMapInfoHeading(), { width: '100%', marginBottom: '10px' });
      const col2TitleP = col2Title;
      col2.appendChild(col2Title);
      col2.appendChild(col2Content);

      const col3Title = createCyclopediaWidgetTitle(getMapsTabStatisticsHeading(), { width: '100%', marginBottom: '10px' });
      const col3TitleP = col3Title;
      col3.appendChild(col3Title);
      col3.appendChild(col3Content);

      let mapsTabStatsOnCol2 = false;

      function syncMapsTabStatisticsHeadings() {
        const label = getMapsTabStatisticsHeading();
        const mapLabel = getMapsTabMapInfoHeading();
        if (mapsTabStatsOnCol2) {
          col2TitleP.textContent = label;
          col3TitleP.textContent = mapLabel;
        } else {
          col3TitleP.textContent = label;
          col2TitleP.textContent = mapLabel;
        }
        updateRightCol();
      }

      document.addEventListener('cyclopedia-season-changed', syncMapsTabStatisticsHeadings);
      
      // Function to update column layout based on selection
      function updateColumnLayout(isRegionSelected) {
        const statsLabel = getMapsTabStatisticsHeading();
        if (isRegionSelected) {
          mapsTabStatsOnCol2 = true;
          // Region selected: Statistics (small) on left (col2), Map Information (large) on right (col3)
          Object.assign(col2.style, {
            width: '250px', minWidth: '250px', maxWidth: '250px', flex: '0 0 250px'
          });
          col2TitleP.textContent = statsLabel;
          
          Object.assign(col3.style, {
            flex: '1 1 0', width: 'auto', minWidth: '0', maxWidth: 'none'
          });
          col3TitleP.textContent = getMapsTabMapInfoHeading();
        } else {
          mapsTabStatsOnCol2 = false;
          // Map selected: Map Information (small) on left (col2), Statistics (large) on right (col3)
          // col2 = Map Information (small, left)
          Object.assign(col2.style, {
            width: '250px', minWidth: '250px', maxWidth: '250px', flex: '0 0 250px'
          });
          col2TitleP.textContent = getMapsTabMapInfoHeading();
          
          // col3 = Statistics (large, right)
          Object.assign(col3.style, {
            flex: '1 1 0', width: 'auto', minWidth: '0', maxWidth: 'none'
          });
          col3TitleP.textContent = statsLabel;
        }
      }

      
      function updateRightCol() {
        try {
          // Check if we actually need to update
          const roomData = globalThis.state?.utils?.ROOMS?.[selectedMap];
          const roomName = globalThis.state?.utils?.ROOM_NAME?.[selectedMap] || selectedMap;
          const activeSeason = cyclopediaState.profileSeason || 1;
          
          // Only update if state actually changed
          if (MapsTabDOMOptimizer.currentState.selectedMap === selectedMap && 
              MapsTabDOMOptimizer.currentState.selectedCategory === selectedCategory &&
              MapsTabDOMOptimizer.currentState.roomData === roomData &&
              MapsTabDOMOptimizer.currentState.roomName === roomName &&
              MapsTabDOMOptimizer.currentState.season === activeSeason) {
            return; // No change needed
          }
          
          // Update current state
          MapsTabDOMOptimizer.currentState.selectedMap = selectedMap;
          MapsTabDOMOptimizer.currentState.selectedCategory = selectedCategory;
          MapsTabDOMOptimizer.currentState.roomData = roomData;
          MapsTabDOMOptimizer.currentState.roomName = roomName;
          MapsTabDOMOptimizer.currentState.season = activeSeason;
          
          // Clear only content areas, preserve structure
          const col2Content = col2.querySelector('.maps-content-area');
          const col3Content = col3.querySelector('.maps-content-area');
          
          if (col2Content) col2Content.innerHTML = '';
          if (col3Content) col3Content.innerHTML = '';
          
          // Check if region is selected but no map is selected
          if (selectedCategory && !selectedMap && globalThis.state?.utils?.REGIONS) {
            const region = globalThis.state.utils.REGIONS.find(r => r.id === selectedCategory);
            if (region && region.rooms) {
              // Update column layout for region view
              updateColumnLayout(true);
              
              // Show all maps for the region in Map Information (col3 = right column, large)
              const mapsInRegion = region.rooms.map(room => ({
                id: room.id,
                name: globalThis.state.utils.ROOM_NAME[room.id] || room.id
              }));
              
              const regionMapsDiv = createRegionMapsSection(mapsInRegion, selectedCategory, (mapId) => {
                selectedMap = mapId;
                cyclopediaState.mapsLastSelectedMapId = selectedMap;
                cyclopediaState.mapsLastSelectedRegionId = selectedCategory || null;
                updateBottomBox();
                updateRightCol();
              });
              col3Content.appendChild(regionMapsDiv);
              
              // Show region statistics (col2 = left column, small)
              const statsContainer = createRegionStatisticsSection(selectedCategory, mapsInRegion);
              col2Content.appendChild(statsContainer);
              
              return;
            }
          }
          
          // Update column layout for map view
          updateColumnLayout(false);
          
          if (selectedMap) {
            // Column 2: Two separate divs - Map Information and Creature Information
            
            // First div: Map Information
            const mapInfoDiv = createMapInfoSection(selectedMap, roomName);
            
            // Second div: Creature Information
            const creatureInfoDiv = document.createElement('div');
            creatureInfoDiv.style.padding = '0';
            creatureInfoDiv.style.color = COLOR_CONSTANTS.TEXT;
            creatureInfoDiv.style.width = '100%';
            creatureInfoDiv.style.boxSizing = 'border-box';
            creatureInfoDiv.style.flex = '1 1 0';
            creatureInfoDiv.style.minHeight = '0';
            creatureInfoDiv.style.display = 'flex';
            creatureInfoDiv.style.flexDirection = 'column';
            creatureInfoDiv.style.overflow = 'hidden';
            
            const creatureInfoTitle = createCyclopediaWidgetTitle('Creature Information', {
              width: '100%',
              marginBottom: '5px',
              flex: '0 0 auto',
              display: 'block',
              position: 'relative'
            });
            const creatureInfoTitleP = creatureInfoTitle;
            creatureInfoDiv.appendChild(creatureInfoTitle);
            
            // Scrollable creature list — fills remaining space below map thumbnail
            const contentContainer = document.createElement('div');
            contentContainer.style.flex = '1 1 0';
            contentContainer.style.minHeight = '0';
            contentContainer.style.overflowY = 'auto';
            contentContainer.style.paddingRight = '8px';
            contentContainer.style.width = '100%';
            contentContainer.style.boxSizing = 'border-box';
            
            if (roomData) {
              // Map difficulty
              if (roomData.difficulty) {
                const difficultyDiv = document.createElement('div');
                difficultyDiv.style.marginBottom = '10px';
                difficultyDiv.innerHTML = `<strong>Difficulty:</strong> ${'★'.repeat(roomData.difficulty)}`;
                difficultyDiv.style.color = '#ffd700';
                contentContainer.appendChild(difficultyDiv);
              }
              
              // Team size
              if (roomData.maxTeamSize) {
                const teamSizeDiv = document.createElement('div');
                teamSizeDiv.style.marginBottom = '10px';
                teamSizeDiv.style.textAlign = 'center';
                teamSizeDiv.innerHTML = `<strong>Max Team Size:</strong> ${roomData.maxTeamSize}`;
                contentContainer.appendChild(teamSizeDiv);
              }
              
              // Stamina cost
              if (roomData.staminaCost) {
                const staminaDiv = document.createElement('div');
                staminaDiv.style.marginBottom = '10px';
                staminaDiv.style.textAlign = 'center';
                staminaDiv.innerHTML = `<strong>Stamina Cost:</strong> ${roomData.staminaCost}`;
                contentContainer.appendChild(staminaDiv);
              }
              
              // Region info
              if (globalThis.state?.utils?.REGIONS) {
                const region = globalThis.state.utils.REGIONS.find(r => r.rooms.some(room => room.id === selectedMap));
                if (region) {
                  const regionDiv = document.createElement('div');
                  regionDiv.style.marginBottom = '10px';
                  regionDiv.style.textAlign = 'center';
                  regionDiv.innerHTML = `<strong>Region:</strong> ${region.id}`;
                  contentContainer.appendChild(regionDiv);
                }
              }
              
            } else {
              // Show creatures that spawn on this map instead of "Map data not available"
              // Get creatures from room actors - try multiple approaches
              let roomActors = null;
              let roomData = null;
              
              // Try to get room data directly
              if (globalThis.state?.utils?.ROOMS?.[selectedMap]) {
                roomData = globalThis.state.utils.ROOMS[selectedMap];
                roomActors = roomData.file?.data?.actors;
              }
              
              // If no actors found, try to get from the region data
              if (!roomActors && globalThis.state?.utils?.REGIONS) {
                for (const region of globalThis.state.utils.REGIONS) {
                  if (region.rooms) {
                    const roomInRegion = region.rooms.find(r => r.id === selectedMap);
                    if (roomInRegion && roomInRegion.file?.data?.actors) {
                      roomActors = roomInRegion.file.data.actors;
                      roomData = roomInRegion;
                      break;
                    }
                  }
                }
              }
              
              // Debug logging
              
              
              
              
              const creaturesContainer = createCreatureListSection(roomActors, selectedMap);
              contentContainer.appendChild(creaturesContainer);
            }
            
            // Add both divs to col2 content area (Map Information - left column, small)
            col2Content.appendChild(mapInfoDiv);
            col2Content.appendChild(creatureInfoDiv);
            
            // Add the content container to the creature info div
            creatureInfoDiv.appendChild(contentContainer);
            
            // Column 3: Statistics (right column, large)
            const statsContainer = createStatisticsSection(selectedMap);
            col3Content.appendChild(statsContainer);
            
            // Tables are populated automatically when createStatisticsSection is called
          } else {
            // No map selected - show placeholder messages
            const col2Msg = document.createElement('div');
            col2Msg.style.display = 'flex';
            col2Msg.style.justifyContent = 'center';
            col2Msg.style.alignItems = 'center';
            col2Msg.style.height = '100%';
            col2Msg.style.width = '100%';
            col2Msg.style.color = COLOR_CONSTANTS.TEXT;
            col2Msg.style.fontWeight = 'bold';
            col2Msg.style.textAlign = 'center';
            col2Msg.textContent = 'Select a map to view information.';
            col2Content.appendChild(col2Msg);
            
            const col3Msg = document.createElement('div');
            col3Msg.style.display = 'flex';
            col3Msg.style.justifyContent = 'center';
            col3Msg.style.alignItems = 'center';
            col3Msg.style.height = '100%';
            col3Msg.style.width = '100%';
            col3Msg.style.color = COLOR_CONSTANTS.TEXT;
            col3Msg.style.fontWeight = 'bold';
            col3Msg.style.textAlign = 'center';
            col3Msg.textContent = 'Select a map to view statistics.';
            col3Content.appendChild(col3Msg);
          }
        } catch (error) {
          console.error('[Cyclopedia] Error updating right columns:', error);
          col2Content.innerHTML = '<div style="padding: 20px; color: #ccc; text-align: center;">Error loading map information.</div>';
          col3Content.innerHTML = '<div style="padding: 20px; color: #ccc; text-align: center;">Error loading statistics.</div>';
        }
      }

      // Set initial column layout (map view by default)
      updateColumnLayout(false);
      
      updateRightCol();

      d.appendChild(leftCol);
      d.appendChild(col2);
      d.appendChild(col3);
      return d;
    }

    // Create equipment tab page
    const equipmentTabPage = createEquipmentTabPage(
      selectedCreature, selectedEquipment, selectedInventory, 
      v => { selectedCreature = v; }, 
      v => { 
        selectedEquipment = v; 
        // Also update the global variable for the updateRightCol function
        if (typeof window !== 'undefined') {
          window.cyclopediaSelectedEquipment = v;
        }
      }, 
      v => { selectedInventory = v; }, 
      () => {} // Placeholder - will be replaced
    );
    
    // Create the tab pages
    const tabPages = [
      (() => createStartPage())(),
      (() => createBestiaryTabPage(selectedCreature, selectedEquipment, selectedInventory, v => { selectedCreature = v; }, v => { selectedEquipment = v; }, v => { selectedInventory = v; }, () => {}))(),
      equipmentTabPage,
      (() => createInventoryTabPage(selectedCreature, selectedEquipment, selectedInventory, v => { selectedCreature = v; }, v => { selectedEquipment = v; }, v => { selectedInventory = v; }, () => {}))(),
      (() => createMapsTabPage(selectedCreature, selectedEquipment, selectedInventory, v => { selectedCreature = v; }, v => { selectedEquipment = v; }, v => { selectedInventory = v; }, () => {}))(),
      (() => createCharactersTabPage(selectedCreature, selectedEquipment, selectedInventory, v => { selectedCreature = v; }, v => { selectedEquipment = v; }, v => { selectedInventory = v; }, () => {}))()
    ];

    const tabNames = ['Home', 'Bestiary', 'Arsenal', 'Inventory', 'Maps', 'Characters'];
    const tabButtons = [];
    const tabNav = document.createElement('nav');
    tabNav.className = 'cyclopedia-subnav';

    tabNames.forEach((tab, i) => {
      const btn = document.createElement('button');
      btn.className = 'cyclopedia-btn';
      if (i === 0) btn.classList.add('active');
      btn.type = 'button';

      if (tab === 'Home') {
        btn.setAttribute('data-tab', 'home');
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>`;
      } else {
        btn.textContent = tab;
      }

      btn.addEventListener('click', () => setActiveTab(i));
      addCyclopediaPressedStateListeners(btn);
      tabButtons.push(btn);
      tabNav.appendChild(btn);
    });
    
    const wikiBtn = document.createElement('button');
    wikiBtn.className = 'cyclopedia-btn';
    wikiBtn.setAttribute('data-tab', 'wiki');
    wikiBtn.type = 'button';
    wikiBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>`;
    wikiBtn.addEventListener('click', () => {
      window.open('https://bestiaryarena.wiki.gg/', '_blank');
    });
    addCyclopediaPressedStateListeners(wikiBtn);
    wikiBtn.style.marginLeft = '20px';
    tabNav.appendChild(wikiBtn);
    content.appendChild(tabNav);

    const separator = document.createElement('div');
    separator.className = 'separator my-2.5';
    separator.setAttribute('role', 'none');
    separator.style.margin = '10px 0';
    content.appendChild(separator);

    const flexRow = document.createElement('div');
    flexRow.style.display = 'flex';
    flexRow.style.flexDirection = 'row';
    flexRow.style.height = '500px';
    flexRow.style.minHeight = '500px';
    flexRow.style.maxHeight = '500px';
    flexRow.style.boxSizing = 'border-box';
    flexRow.style.border = '6px solid transparent';
    flexRow.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch';
    flexRow.style.overflow = 'hidden';

    const mainContent = document.createElement('div');
    mainContent.style.flex = '1 1 0';
    mainContent.style.padding = '0';
    mainContent.style.display = 'flex';
    mainContent.style.flexDirection = 'column';
    mainContent.style.minHeight = '0';
    mainContent.style.background = "url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat";
    mainContent.style.justifyContent = 'flex-start';
    mainContent.style.alignItems = 'stretch';
    mainContent.style.height = '100%';
    mainContent.style.width = '100%';
    mainContent.style.minWidth = '0';
    mainContent.style.overflow = 'hidden';

    defineSetActiveTab(tabButtons, mainContent, tabPages);

    // Home search navigation bridge (used by the Home tab search box)
    function _cyclopediaFindBoxByTitle(tabRoot, titleText) {
      if (!tabRoot) return null;
      const titles = Array.from(tabRoot.querySelectorAll('h2.widget-top'));
      const h2 = titles.find(el => (el.textContent || '').trim() === titleText);
      return h2 ? h2.closest('div') : null;
    }

    function _cyclopediaFindClickableListItems(root) {
      if (!root) return [];
      return Array.from(root.querySelectorAll('div.pixel-font-16'));
    }

    function _cyclopediaClickListItem(root, desiredText) {
      const want = cyclopediaNormalizeSearchText(desiredText);
      if (!want) return false;

      const items = _cyclopediaFindClickableListItems(root);
      for (const item of items) {
        const span = item.querySelector('span');
        const text = cyclopediaNormalizeSearchText(span ? span.textContent : item.textContent);
        if (text === want) {
          item.click();
          return true;
        }
      }
      // Fallback: contains
      for (const item of items) {
        const span = item.querySelector('span');
        const text = cyclopediaNormalizeSearchText(span ? span.textContent : item.textContent);
        if (text.includes(want)) {
          item.click();
          return true;
        }
      }
      return false;
    }

    function _cyclopediaNavigateFromHome(target) {
      if (!target || typeof target !== 'object') return false;

      try {
        if (target.type === 'creature') {
          setActiveTab(1);
          return _cyclopediaClickListItem(tabPages[1], target.name);
        }

        if (target.type === 'equipment') {
          setActiveTab(2);
          if (typeof window !== 'undefined') window.cyclopediaSelectedEquipment = target.name;
          return _cyclopediaClickListItem(tabPages[2], target.name);
        }

        if (target.type === 'inventoryCategory') {
          setActiveTab(3);
          const inventoryTab = tabPages[3];
          const topBox = _cyclopediaFindBoxByTitle(inventoryTab, 'Inventory');
          return _cyclopediaClickListItem(topBox || inventoryTab, target.categoryName);
        }

        if (target.type === 'inventoryItem') {
          setActiveTab(3);
          const inventoryTab = tabPages[3];
          const topBox = _cyclopediaFindBoxByTitle(inventoryTab, 'Inventory');
          const catalogLabel =
            target.catalogLabel ||
            cyclopediaGetInventoryCatalogLabelForItemKey(target.itemKey) ||
            target.itemDisplayName;

          const ok = _cyclopediaClickListItem(topBox || inventoryTab, target.categoryName);
          const clickItemTimeout = setTimeout(() => {
            const bottomBox = _cyclopediaFindBoxByTitle(inventoryTab, target.categoryName) || inventoryTab;
            _cyclopediaClickListItem(bottomBox, catalogLabel);
            const variantKeys = INVENTORY_CONFIG?.variants?.[catalogLabel];
            if (target.itemKey && Array.isArray(variantKeys) && variantKeys.includes(target.itemKey)) {
              const selectVariantTimeout = setTimeout(() => {
                if (typeof window.cyclopediaSelectVariant === 'function') {
                  window.cyclopediaSelectVariant(target.itemKey);
                }
              }, 100);
              TimerManager.addTimeout(selectVariantTimeout, 'homeSearchInvVariant');
            }
          }, 0);
          TimerManager.addTimeout(clickItemTimeout, 'homeSearchInvSelect');
          return ok;
        }

        if (target.type === 'region') {
          setActiveTab(4);
          const mapsTab = tabPages[4];
          const regionsBox = _cyclopediaFindBoxByTitle(mapsTab, 'Regions');
          return _cyclopediaClickListItem(regionsBox || mapsTab, target.regionName);
        }

        if (target.type === 'map') {
          setActiveTab(4);
          const mapsTab = tabPages[4];
          const regionsBox = _cyclopediaFindBoxByTitle(mapsTab, 'Regions');
          const ok = _cyclopediaClickListItem(regionsBox || mapsTab, target.regionName);
          const clickMapTimeout = setTimeout(() => {
            const mapsBox = _cyclopediaFindBoxByTitle(mapsTab, 'Maps') || mapsTab;
            _cyclopediaClickListItem(mapsBox, target.mapName);
          }, 0);
          TimerManager.addTimeout(clickMapTimeout, 'homeSearchMapSelect');
          return ok;
        }
      } catch (error) {
        console.warn('[Cyclopedia] HomeSearch: navigation failed:', error);
      }

      return false;
    }

    if (typeof window !== 'undefined') {
      window.cyclopediaHomeSearchNavigate = _cyclopediaNavigateFromHome;
    }

    flexRow.appendChild(mainContent);
    content.appendChild(flexRow);

    try {
  
      
      activeCyclopediaModal = api.ui.components.createModal({
        title: 'Cyclopedia',
        width: LAYOUT_CONSTANTS.MODAL_WIDTH,
        height: LAYOUT_CONSTANTS.MODAL_HEIGHT,
        content: content,
        buttons: [],
        onClose: () => {
          // Clean up creature list manager
          CreatureListManager.cleanup();
          
          cleanupCyclopediaModal();
        }
      });
      
      // Fallback cleanup for when onClose doesn't work
      
      const modalCleanupTimeout = setTimeout(() => {
        const modalElement = DOMCache.get('div[role="dialog"][data-state="open"]');
        if (modalElement) {
  
          
          // Watch for modal removal
          const cleanupObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'childList') {
                mutation.removedNodes.forEach((node) => {
                  if (node === modalElement || node.contains?.(modalElement)) {
            
                    // Immediately disable ALL cleanup triggers
                    cleanupObserver.disconnect();
                    document.removeEventListener('keydown', handleKeyDown);
                    // Remove the cleanup reference
                    delete modalElement._cyclopediaCleanup;
                    // Now run cleanup
                    cleanupCyclopediaModal();
                  }
                });
              }
            });
          });
          
          cleanupObserver.observe(document.body, { childList: true, subtree: true });
          
          // Also watch for ESC key and clicks outside
          const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
      
              // Immediately disable ALL cleanup triggers
              cleanupObserver.disconnect();
              document.removeEventListener('keydown', handleKeyDown);
              // Remove the cleanup reference
              delete modalElement._cyclopediaCleanup;
              // Now run cleanup
              cleanupCyclopediaModal();
            }
          };
          
          document.addEventListener('keydown', handleKeyDown);
          
          // Store cleanup functions for later removal
          modalElement._cyclopediaCleanup = {
            observer: cleanupObserver,
            keyHandler: handleKeyDown
          };
        }
      }, 100);
      TimerManager.addTimeout(modalCleanupTimeout, 'modalCleanup');
      
      setActiveTab(activeTab);
      cyclopediaPendingHomeSearchFocus = activeTab === 0;
      
    } catch (modalError) {
      console.error('[Cyclopedia] Error creating modal with API:', modalError);
      throw modalError;
    }
      } catch (error) {
        console.error('[Cyclopedia] Error creating modal:', error);
        try {
          alert('Failed to open Cyclopedia. Please try again.');
        } catch (alertError) {
          console.error('[Cyclopedia] Even fallback alert failed:', alertError);
        }
      } finally {
        cyclopediaModalInProgress = false;
      }
    })();
  } catch (error) {
    console.error('[Cyclopedia] Error opening modal:', error);
    
    if (typeof context !== 'undefined' && context.api && context.api.ui) {
      try {
        context.api.ui.components.createModal({
          title: 'Error',
          content: '<p>Failed to open Cyclopedia. Please try again later.</p>',
          buttons: [{ text: 'OK', primary: true }]
        });
      } catch (modalError) {
        console.error('[Cyclopedia] Error showing error modal:', modalError);
      }
    }
    
    cyclopediaModalInProgress = false;
  }
}

function renderMonsterStats(monsterData) {
  try {
    if (!monsterData || typeof monsterData !== 'object') {
      throw new Error('Invalid monster data provided');
    }

    const statsDiv = document.createElement('div');
    statsDiv.className = 'frame-pressed-1 surface-dark flex shrink-0 flex-col gap-1.5 px-2 py-1 pb-2 revert-pixel-font-spacing whitespace-nowrap';
    Object.assign(statsDiv.style, {
      flex: '1 1 0',
      textAlign: 'left',
      margin: '2px',
      width: '160px',
      height: '160px',
      alignSelf: 'center',
      padding: '4px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      boxSizing: 'border-box'
    });

    if (!monsterData.metadata?.baseStats || typeof monsterData.metadata.baseStats !== 'object') {
      statsDiv.textContent = 'Stats not available';
      return statsDiv;
    }

    const baseStats = monsterData.metadata.baseStats;
    statsDiv.innerHTML = '';

    if (!Array.isArray(GAME_DATA.MONSTER_STATS_CONFIG)) {
      console.error('[Cyclopedia] MONSTER_STATS_CONFIG is not available');
      statsDiv.textContent = 'Stats configuration not available';
      return statsDiv;
    }

    GAME_DATA.MONSTER_STATS_CONFIG.forEach(stat => {
      try {
        if (!stat || typeof stat !== 'object' || !stat.key || !stat.label || !stat.icon) {
  
          return;
        }

        const value = baseStats[stat.key] !== undefined ? baseStats[stat.key] : 0;
        const maxValue = stat.max || 100;
        const percent = Math.max(0, Math.min(1, value / maxValue));
        const barWidth = Math.round(percent * 100);

        const createStatRow = () => {
          const statRow = document.createElement('div');
          statRow.setAttribute('data-transparent', 'false');
          statRow.className = 'pixel-font-16 whitespace-nowrap text-whiteRegular data-[transparent=\'true\']:opacity-25';

          const topRow = document.createElement('div');
          topRow.className = 'flex justify-between items-center';

          const left = document.createElement('span');
          left.className = 'flex items-center';
          left.style.gap = '2px';

          const icon = document.createElement('img');
          icon.src = stat.icon;
          icon.alt = stat.label;
          Object.assign(icon.style, {
            width: '12px',
            height: '12px',
            marginRight: '2px'
          });
          
          icon.onerror = () => {
            icon.style.display = 'none';
    
          };

          left.appendChild(icon);

          const nameSpan = document.createElement('span');
          nameSpan.textContent = stat.label;
          left.appendChild(nameSpan);

          const valueSpan = document.createElement('span');
          valueSpan.textContent = value;
          valueSpan.className = 'text-right text-whiteExp';
          Object.assign(valueSpan.style, {
            textAlign: 'right',
            minWidth: '3.5ch',
            maxWidth: '5ch',
            marginLeft: '6px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            display: 'inline-block'
          });

          topRow.appendChild(left);
          topRow.appendChild(valueSpan);

          const barRow = document.createElement('div');
          barRow.className = 'relative';

          const barOuter = document.createElement('div');
          barOuter.className = 'h-1 w-full border border-solid border-black bg-black frame-pressed-1 relative overflow-hidden duration-300 fill-mode-forwards gene-stats-bar-filled';
          barOuter.style.animationDelay = '700ms';

          const barFillWrap = document.createElement('div');
          barFillWrap.className = 'absolute left-0 top-0 flex h-full w-full';

          const barFill = document.createElement('div');
          barFill.className = 'h-full shrink-0';
          barFill.style.width = barWidth + '%';
          barFill.style.background = stat.barColor || '#666';

          barFillWrap.appendChild(barFill);
          barOuter.appendChild(barFillWrap);

          const barRight = document.createElement('div');
          barRight.className = 'absolute left-full top-1/2 -translate-y-1/2';
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

          statRow.appendChild(topRow);
          statRow.appendChild(barRow);

          return statRow;
        };

        const statRow = createStatRow();
        statsDiv.appendChild(statRow);

      } catch (statError) {
        console.error('[Cyclopedia] Error rendering stat:', stat, statError);
      }
    });

    return statsDiv;

  } catch (error) {
    console.error('[Cyclopedia] Error rendering monster stats:', error);
    
    const fallbackDiv = document.createElement('div');
    fallbackDiv.className = 'frame-pressed-1 surface-dark flex shrink-0 flex-col gap-1.5 px-2 py-1 pb-2';
    Object.assign(fallbackDiv.style, {
      flex: '1 1 0',
      textAlign: 'center',
      margin: '2px',
      width: '160px',
      height: '150px',
      alignSelf: 'center',
      padding: '4px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      boxSizing: 'border-box',
      color: '#999'
    });
    fallbackDiv.textContent = 'Stats unavailable';
    return fallbackDiv;
  }
}

function renderCreatureTemplate(name, showShinyPortraits = false) {
  let monstersArr = null;
  if (
    globalThis.state &&
    globalThis.state.player &&
    typeof globalThis.state.player.getSnapshot === 'function'
  ) {
    const playerContext = globalThis.state.player.getSnapshot().context;
    if (playerContext && Array.isArray(playerContext.monsters)) {
      monstersArr = playerContext.monsters;
    }
  }
  if (!monstersArr || monstersArr.length === 0) {
    setTimeout(() => {
      const flexRows = DOMCache.getAll('div[role="dialog"] .modal-content > div');
      let rightCol = null;
      if (flexRows && flexRows.length > 0) {
        for (const flexRow of flexRows) {
          if (flexRow.childNodes.length > 1) {
            rightCol = flexRow.childNodes[1];
            break;
          }
        }
      }
      if (rightCol) {
        rightCol.innerHTML = '';
        rightCol.appendChild(renderCreatureTemplate(name));
      } else {
        renderCreatureTemplate(name);
      }
    }, 200);

    const waitingDiv = document.createElement('div');
    waitingDiv.textContent = 'Loading creature data...';
    waitingDiv.className = FONT_CONSTANTS.SIZES.BODY;
    waitingDiv.style.textAlign = 'center';
    waitingDiv.style.color = COLOR_CONSTANTS.TEXT;
    waitingDiv.style.padding = '32px';
    return waitingDiv;
  }

  buildCyclopediaMonsterNameMap();
  const creatureCanAwaken = isCyclopediaCreatureAwakenable(name);
  if (!creatureCanAwaken) {
    cyclopediaState.creatureDetailShowAwakenedAbility = false;
  }
  const isUnobtainable = UNOBTAINABLE_CREATURES.some(c => c.toLowerCase() === (name || '').toLowerCase());
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'row';
  container.style.width = '100%';
  container.style.maxWidth = '100%';
  container.style.minWidth = '0';
  container.style.height = '100%';
  container.style.gap = '0';
  container.style.overflow = 'hidden';
  container.style.boxSizing = 'border-box';

  const creatureTemplateColStyle = {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    minWidth: '0',
    width: 'auto',
    maxWidth: 'none',
    height: '100%',
    minHeight: '0',
    boxSizing: 'border-box',
    overflowX: 'hidden'
  };

  const col1 = document.createElement('div');
  Object.assign(col1.style, creatureTemplateColStyle);
  col1.style.borderRight = '6px solid transparent';
  col1.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
  col1.style.marginRight = '0';
  col1.style.paddingRight = '0';
  col1.style.overflowY = 'hidden';
  const col1Title = createCyclopediaWidgetTitle(name || 'Creature Information', {
    width: '100%',
    marginBottom: '5px',
    display: 'block',
    position: 'relative'
  });
  const col1TitleP = col1Title;
  
  const col1Picture = document.createElement('div');
  col1Picture.style.textAlign = 'center';
  col1Picture.style.color = COLOR_CONSTANTS.TEXT;
  col1Picture.className = FONT_CONSTANTS.SIZES.SMALL;
  col1Picture.style.padding = '8px 0';
  col1Picture.style.display = 'flex';
  col1Picture.style.justifyContent = 'center';
  col1Picture.style.alignItems = 'center';
  col1Picture.style.height = '110px';
  let monsterId = null;
  let monster = null;

  const displayQuery = cyclopediaResolveCreatureQuery(name);
  const lookupName = (displayQuery.baseSpecies || name).toLowerCase();
  const canUseShinySprite = window.creatureDatabase?.creatureHasShinyVariant?.(name) !== false;
  const effectiveShinyPortraits = displayQuery.forceShiny === true
    || (showShinyPortraits && canUseShinySprite);

  if (cyclopediaState.monsterNameMap && typeof name === 'string') {
    const entry = cyclopediaState.monsterNameMap.get(lookupName);
    if (entry) {
      monster = entry.monster;
      monsterId = displayQuery.gameId ?? (monster.gameId !== undefined ? monster.gameId : entry.index);
      if (monsterId === undefined) {
        // Monster ID not found
      }
      let monsterSprite;
      if (monster && monster.metadata && monster.metadata.lookType === 'item') {
        monsterSprite = api.ui.components.createItemPortrait({
          itemId: monster.metadata.spriteId,
          size: 'large'
        });
        
        // Remove button wrapper if present
        if (monsterSprite.tagName === 'BUTTON' && monsterSprite.firstChild) {
          monsterSprite = monsterSprite.firstChild;
        }
        
        [monsterSprite.style.width,
         monsterSprite.style.height,
         monsterSprite.style.minWidth,
         monsterSprite.style.minHeight,
         monsterSprite.style.maxWidth,
         monsterSprite.style.maxHeight] =
         ['70px', '70px', '70px', '70px', '70px', '70px'];
        const portrait = monsterSprite.querySelector('.equipment-portrait');
        if (portrait) {
          ['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight'].forEach(
            prop => portrait.style[prop] = '70px'
          );
        }
      } else {
        monsterSprite = api.ui.components.createFullMonster({
          monsterId: monsterId,
          tier: 1,
          starTier: 1,
          level: 1,
          size: 'small'
        });
        
        // Override portrait for shiny mode using the same approach as inventory
        // Check if creature is unobtainable - if so, don't apply shiny mode
        if (effectiveShinyPortraits && !isUnobtainable) {
          const spriteImg = monsterSprite.querySelector('img.actor.spritesheet');
          if (spriteImg) {
            spriteImg.setAttribute('data-shiny', 'true');
            
          }
          
          // Add shiny star overlay like in inventory (same size as owned section)
          const shinyIcon = document.createElement('img');
          shinyIcon.src = 'https://bestiaryarena.com/assets/icons/shiny-star.png';
          shinyIcon.alt = 'shiny';
          shinyIcon.title = displayQuery.forceShiny ? 'Albino (shiny Mystic Gazer)' : 'Shiny';
          shinyIcon.style.position = 'absolute';
          shinyIcon.style.top = '4px';
          shinyIcon.style.left = '4px';
          shinyIcon.style.width = '10px';
          shinyIcon.style.height = '10px';
          shinyIcon.style.zIndex = '10';
          monsterSprite.appendChild(shinyIcon);
        } else if (!isUnobtainable) {
          // Remove shiny attribute when switching back to normal mode (only for obtainable creatures)
          const spriteImg = monsterSprite.querySelector('img.actor.spritesheet');
          if (spriteImg) {
            spriteImg.removeAttribute('data-shiny');
            
          }
          
          // Remove any existing shiny star icons
          const existingShinyIcons = monsterSprite.querySelectorAll('img[alt="shiny"]');
          existingShinyIcons.forEach(icon => icon.remove());
        }
      }
      [monsterSprite.style.width,
       monsterSprite.style.height,
       monsterSprite.style.minWidth,
       monsterSprite.style.minHeight,
       monsterSprite.style.maxWidth,
       monsterSprite.style.maxHeight] =
       ['70px', '70px', '70px', '70px', '70px', '70px'];
      const levelBadge = monsterSprite.querySelector('span.pixel-font-16');
      if (levelBadge) levelBadge.remove();
      const starTierIcon = monsterSprite.querySelector('img[alt="star tier"]');
      if (starTierIcon) starTierIcon.remove();
      col1Picture.innerHTML = '';
      // Wrap portrait to allow overlays (e.g., shiny star)
      const portraitWrap = document.createElement('div');
      portraitWrap.style.position = 'relative';
      portraitWrap.style.width = '110px';
      portraitWrap.style.height = '110px';
      portraitWrap.style.display = 'inline-block';
      portraitWrap.appendChild(monsterSprite);
      
      
      col1Picture.appendChild(portraitWrap);
      const allDivs = Array.from(monsterSprite.querySelectorAll('div'));
      let firstFixedDiv = null;
      allDivs.forEach((div, idx) => {
        const style = div.getAttribute('style') || '';
        if (style.includes('max-width: 34px') || style.includes('max-height: 34px')) {
          div.style.width = '110px';
          div.style.height = '110px';
          div.style.maxWidth = '110px';
          div.style.maxHeight = '110px';
          if (!firstFixedDiv) firstFixedDiv = div;
        }
      });
      if (firstFixedDiv) {
        let parent = firstFixedDiv.parentElement;
        let step = 0;
        while (parent && step < 3) {
          parent.style.width = '110px';
          parent.style.maxWidth = '110px';
          parent = parent.parentElement;
          step++;
        }
      }
    } else {
      col1Picture.textContent = 'Picture Placeholder';
    }
  } else {
    col1Picture.textContent = 'Picture Placeholder';
  }
  const col1FlexRows = document.createElement('div');
  col1FlexRows.style.display = 'flex';
  col1FlexRows.style.flexDirection = 'column';
  col1FlexRows.style.height = '100%';
  col1FlexRows.style.flex = '1 1 0';
  col1FlexRows.style.justifyContent = 'flex-start';

  const col1TopArea = document.createElement('div');
  col1TopArea.style.display = 'flex';
  col1TopArea.style.flexDirection = 'row';
  col1TopArea.style.alignItems = 'flex-start';
  col1TopArea.style.justifyContent = 'flex-start';
  col1TopArea.style.height = '40%';
  col1TopArea.style.marginLeft = '0';
  col1TopArea.style.paddingLeft = '0';
  col1TopArea.style.marginBottom = '5px';
  col1Picture.style.marginRight = '4px';
  col1Picture.style.flex = '0 0 auto';
  col1Picture.style.height = 'auto';
  col1Picture.style.width = '72px';
  col1Picture.style.minWidth = '72px';
  col1Picture.style.maxWidth = '72px';
  col1Picture.style.display = 'flex';
  col1Picture.style.flexDirection = 'column';
  col1Picture.style.alignItems = 'center';
  col1Picture.style.justifyContent = 'flex-start';
  col1Picture.style.margin = '0';
  col1Picture.style.padding = '0';
  if (col1Picture.firstChild && col1Picture.firstChild.style) {
    col1Picture.firstChild.style.width = '72px';
    col1Picture.firstChild.style.height = '72px';
    col1Picture.firstChild.style.maxWidth = '72px';
    col1Picture.firstChild.style.maxHeight = '72px';
    col1Picture.firstChild.style.minWidth = '72px';
    col1Picture.firstChild.style.minHeight = '72px';
    col1Picture.firstChild.style.margin = '0';
  }

  const abilitySpacer = document.createElement('div');
  abilitySpacer.style.height = '10px';
  abilitySpacer.style.width = '100%';
  col1Picture.appendChild(abilitySpacer);

  const abilityIconFrame = document.createElement('div');
  abilityIconFrame.style.width = '70px';
  abilityIconFrame.style.height = '70px';
  abilityIconFrame.style.display = 'flex';
  abilityIconFrame.style.alignItems = 'center';
  abilityIconFrame.style.justifyContent = 'center';
  abilityIconFrame.style.backgroundImage = "url('https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png')";
  abilityIconFrame.style.backgroundSize = 'cover';
  abilityIconFrame.style.backgroundRepeat = 'no-repeat';
  abilityIconFrame.style.backgroundPosition = 'center';
  abilityIconFrame.style.margin = '0';

  let abilityIconPath = null;
  try {
    const monsterData = monsterId ? safeGetMonsterData(monsterId) : null;
    if (
      monsterData &&
      monsterData.metadata &&
      monsterData.metadata.skill
    ) {
      if (monsterData.metadata.skill.icon) {
        abilityIconPath = monsterData.metadata.skill.icon;
      } else if (monsterData.metadata.skill.src) {
        abilityIconPath = `https://bestiaryarena.com/assets/spells/${monsterData.metadata.skill.src}.png`;
      } else {
      }
    }
  } catch (err) {
    // Silently continue if ability icon extraction fails
  }

  if (abilityIconPath) {
    const abilityImg = document.createElement('img');
    abilityImg.src = abilityIconPath;
    abilityImg.alt = 'Ability Icon';
    abilityImg.width = 48;
    abilityImg.height = 48;
    abilityImg.style.width = '48px';
    abilityImg.style.height = '48px';
    abilityImg.className = 'pixelated'; // for retro look, optional
    abilityIconFrame.appendChild(abilityImg);
  } else {
    abilityIconFrame.textContent = 'No ability icon';
  }

  col1Picture.appendChild(abilityIconFrame);

  const statsDiv = document.createElement('div');
  statsDiv.textContent = 'Loading stats...';
  statsDiv.style.textAlign = 'center';
  statsDiv.style.color = COLOR_CONSTANTS.TEXT;
  statsDiv.style.padding = '0';
  statsDiv.style.margin = '0';
  statsDiv.style.alignSelf = 'unset';
  let currentStatsMonsterData = null;

  const getDisplayMonsterDataForStats = (monsterData, useAwakenedScaling = false) => {
    if (!monsterData || !monsterData.metadata?.baseStats) return monsterData;

    let displayMonsterData = monsterData;

    // Check if this creature has hardcoded stats (for unobtainable creatures with different map stats)
    const creatureNameLower = monsterData?.metadata?.name?.toLowerCase();
    if (creatureNameLower && HARDCODED_MONSTER_STATS[creatureNameLower] && monsterData?.metadata?.baseStats) {
      // Clone only the baseStats object using spread to avoid mutating internal game state
      const clonedBaseStats = { ...monsterData.metadata.baseStats };

      // Preserve speed from original data since hardcoded stats don't include it
      const originalSpeed = clonedBaseStats?.speed;

      // Replace baseStats with hardcoded values
      Object.assign(clonedBaseStats, HARDCODED_MONSTER_STATS[creatureNameLower].baseStats);

      // Restore speed from original data
      if (originalSpeed !== undefined) {
        clonedBaseStats.speed = originalSpeed;
      }

      // Create a new object with cloned baseStats without cloning the entire monsterData
      displayMonsterData = {
        ...monsterData,
        metadata: {
          ...monsterData.metadata,
          baseStats: clonedBaseStats
        }
      };
    }

    if (!useAwakenedScaling) return displayMonsterData;

    const scaleStatFn = globalThis.state?.utils?.scaleStat;
    const baseStats = displayMonsterData?.metadata?.baseStats;
    if (typeof scaleStatFn !== 'function' || !baseStats || typeof baseStats !== 'object') {
      return displayMonsterData;
    }

    const scaledBaseStats = { ...baseStats };
    const scalableStats = new Set(['hp', 'ad', 'ap', 'armor', 'magicResist']);
    Object.keys(scaledBaseStats).forEach((statKey) => {
      if (!scalableStats.has(statKey)) return;
      const baseValue = scaledBaseStats[statKey];
      if (typeof baseValue !== 'number' || !Number.isFinite(baseValue)) return;

      try {
        scaledBaseStats[statKey] = scaleStatFn({
          level: 99,
          geneValue: 20,
          stat: baseValue
        });
      } catch (scaleError) {
        console.error(`[Cyclopedia] Failed to scale "${statKey}" stat:`, scaleError);
      }
    });

    return {
      ...displayMonsterData,
      metadata: {
        ...displayMonsterData.metadata,
        baseStats: scaledBaseStats
      }
    };
  };

  const rerenderCreatureStats = (showAwakenedMode = false) => {
    if (!currentStatsMonsterData) return;
    const displayMonsterData = getDisplayMonsterDataForStats(currentStatsMonsterData, showAwakenedMode);
    const actualStatsDiv = renderMonsterStats(displayMonsterData);
    statsDiv.innerHTML = '';
    statsDiv.appendChild(actualStatsDiv);
  };

  if (monsterId) {
    queueMonsterDataLoad(monsterId, (monsterData) => {
      currentStatsMonsterData = monsterData;
      rerenderCreatureStats(cyclopediaState.creatureDetailShowAwakenedAbility);
    });
  } else {
    statsDiv.textContent = 'Stats not available';
  }
  
  col1TopArea.appendChild(col1Picture);
  col1TopArea.appendChild(statsDiv);

  const abilitySection = document.createElement('div');
  abilitySection.setAttribute('data-ability-section', 'true');
  abilitySection.style.marginTop = '0';
  abilitySection.style.width = '100%';

  // Store references for the click handler (declared early so they're in scope)
  let currentTooltipComponent = null;
  let currentAbilityContainer = null;
  let normalTooltipComponent = null;
  let awakenTooltipComponent = null;

  // Create a flex container for title and button (matching Creatures title style)
  const abilityTitleContainer = document.createElement('div');
  abilityTitleContainer.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0;
    gap: 1px;
  `;
  
  const abilityTitle = createCyclopediaWidgetTitle('Ability', {
    ...(creatureCanAwaken ? CYCLOPEDIA_WIDGET_TITLE_SPLIT_STYLE : { width: '100%', flex: '1 1 auto' }),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '16px',
    height: '100%',
    alignSelf: 'stretch'
  });
  abilityTitleContainer.appendChild(abilityTitle);

  let awakenIconButton = null;
  if (creatureCanAwaken) {
  awakenIconButton = document.createElement('button');
  applyCyclopediaWidgetTitleChrome(awakenIconButton, {
    ...CYCLOPEDIA_WIDGET_TITLE_TOGGLE_STYLE,
    height: '23px'
  });
  awakenIconButton.title = 'Normal Mode';
  
  const awakenIconImg = document.createElement('img');
  awakenIconImg.src = 'https://bestiaryarena.com/assets/icons/star-tier-awaken.png';
  awakenIconImg.alt = 'Awakened Ability';
  awakenIconImg.style.cssText = 'width: 10px; height: 10px;';
  awakenIconButton.appendChild(awakenIconImg);

  if (cyclopediaState.creatureDetailShowAwakenedAbility) {
    awakenIconButton.title = 'Awakened Mode';
    awakenIconButton.style.background = 'url("https://bestiaryarena.com/_next/static/media/background-green.be515334.png") repeat';
    awakenIconButton.style.border = '1px solid #4CAF50';
  }
  
  // Add click handler to toggle between normal and awakened ability
  awakenIconButton.addEventListener('click', (e) => {
    e.stopPropagation();
    cyclopediaState.creatureDetailShowAwakenedAbility = !cyclopediaState.creatureDetailShowAwakenedAbility;
    const showAwakenedAbility = cyclopediaState.creatureDetailShowAwakenedAbility;
    awakenIconButton.title = showAwakenedAbility ? 'Awakened Mode' : 'Normal Mode';
    rerenderCreatureStats(showAwakenedAbility);
    
    // Update background and border color to show toggle state
    if (showAwakenedAbility) {
      awakenIconButton.style.background = 'url("https://bestiaryarena.com/_next/static/media/background-green.be515334.png") repeat';
      awakenIconButton.style.border = '1px solid #4CAF50';
    } else {
      // Reset to default widget-top styling
      awakenIconButton.style.background = '';
      awakenIconButton.style.border = '';
    }
    
    try {
      const abilityMonsterData = monsterId ? safeGetMonsterData(monsterId) : null;
      if (abilityMonsterData && abilityMonsterData.metadata && abilityMonsterData.metadata.skill && abilityMonsterData.metadata.skill.TooltipContent) {
        // Unmount current tooltip component if it exists
        if (currentTooltipComponent && typeof currentTooltipComponent.unmount === 'function') {
          currentTooltipComponent.unmount();
        }
        
        // Clear the ability container - must create fresh DOM elements for React
        if (currentAbilityContainer) {
          currentAbilityContainer.innerHTML = '';
        }
        
        // Always create a fresh root element and component to avoid React mounting issues
        // React components are tied to their DOM root, so we must create fresh ones each time
        const rootElement = document.createElement('div');
        rootElement.classList.add('tooltip-prose');
        rootElement.classList.add(FONT_CONSTANTS.SIZES.SMALL);
        rootElement.style.width = '100%';
        rootElement.style.height = '100%';
        rootElement.style.color = COLOR_CONSTANTS.TEXT;
        rootElement.style.lineHeight = '1.1';
        
        const AbilityTooltip = abilityMonsterData.metadata.skill.TooltipContent;
        
        if (typeof globalThis.state.utils.createUIComponent === 'function') {
          // Create a fresh component each time - React components can't be reused with new DOM
          const tooltipComponent = showAwakenedAbility 
            ? globalThis.state.utils.createUIComponent(rootElement, AbilityTooltip, { awaken: true })
            : globalThis.state.utils.createUIComponent(rootElement, AbilityTooltip);
          
          // Store references for potential cleanup
          if (showAwakenedAbility) {
            awakenTooltipComponent = tooltipComponent;
          } else {
            normalTooltipComponent = tooltipComponent;
          }
          
          if (tooltipComponent && typeof tooltipComponent.mount === 'function') {
            tooltipComponent.mount();
            currentAbilityContainer.appendChild(rootElement);
            currentTooltipComponent = tooltipComponent;
            
            const blockquotes = rootElement.querySelectorAll('blockquote');
            blockquotes.forEach(bq => {
              bq.style.setProperty('font-size', '10px', 'important');
            });
            
            setTimeout(() => {
              let fontSize = 12;
              const minFontSize = 9;
              while ((rootElement.scrollHeight > rootElement.clientHeight || rootElement.scrollWidth > rootElement.clientWidth) && fontSize > minFontSize) {
                fontSize--;
                rootElement.style.fontSize = fontSize + 'px';
              }
            }, 0);
          }
          
          // Update stored tooltip component in ability section
          if (abilitySection) {
            abilitySection._tooltipComponent = tooltipComponent;
          }
        }
      }
    } catch (error) {
      console.error('[Cyclopedia] Error toggling awakened ability:', error);
    }
  });
  abilityTitleContainer.appendChild(awakenIconButton);
  }
  abilitySection.appendChild(abilityTitleContainer);

  // Create scrollable container for ability content
  const abilityScrollContainer = document.createElement('div');
  abilityScrollContainer.style.height = '250px';
  abilityScrollContainer.style.overflowY = 'auto';
  abilityScrollContainer.style.overflowX = 'hidden';

  const abilityList = document.createElement('ul');
  abilityList.style.listStyle = 'none';
  abilityList.style.padding = '0';
  abilityList.style.margin = '0';
  abilityList.style.color = COLOR_CONSTANTS.TEXT;
  abilityList.className = FONT_CONSTANTS.SIZES.SMALL;
  
  const abilityContainer = document.createElement('li');
  abilityContainer.style.padding = '4px 6px';
  abilityContainer.style.margin = '0';
  abilityContainer.style.width = '100%';
  abilityContainer.style.boxSizing = 'border-box';
  currentAbilityContainer = abilityContainer; // Store reference
  
  let tooltipComponent = null;
  try {
    const abilityMonsterData = monsterId ? safeGetMonsterData(monsterId) : null;
    if (abilityMonsterData && abilityMonsterData.metadata && abilityMonsterData.metadata.skill && abilityMonsterData.metadata.skill.TooltipContent) {
      const rootElement = document.createElement('div');
      rootElement.classList.add('tooltip-prose');
      rootElement.classList.add(FONT_CONSTANTS.SIZES.SMALL);
      rootElement.style.width = '100%';
      rootElement.style.height = '100%';
      rootElement.style.color = COLOR_CONSTANTS.TEXT;
      rootElement.style.lineHeight = '1.1';
      
      const AbilityTooltip = abilityMonsterData.metadata.skill.TooltipContent;
      
      if (typeof globalThis.state.utils.createUIComponent === 'function') {
        const useAwakened = creatureCanAwaken && cyclopediaState.creatureDetailShowAwakenedAbility;
        tooltipComponent = useAwakened
          ? globalThis.state.utils.createUIComponent(rootElement, AbilityTooltip, { awaken: true })
          : globalThis.state.utils.createUIComponent(rootElement, AbilityTooltip);
        currentTooltipComponent = tooltipComponent; // Store reference
        if (useAwakened) {
          awakenTooltipComponent = tooltipComponent;
        } else {
          normalTooltipComponent = tooltipComponent; // Store normal reference for toggling
          normalRootElement = rootElement; // Store normal root element for toggling
        }
        
        if (tooltipComponent && typeof tooltipComponent.mount === 'function') {
          tooltipComponent.mount();
          abilityContainer.appendChild(rootElement);
          
          const blockquotes = rootElement.querySelectorAll('blockquote');
          blockquotes.forEach(bq => {
            bq.style.setProperty('font-size', '10px', 'important');
          });
          
          setTimeout(() => {
            let fontSize = 12;
            const minFontSize = 9;
            while ((rootElement.scrollHeight > rootElement.clientHeight || rootElement.scrollWidth > rootElement.clientWidth) && fontSize > minFontSize) {
              fontSize--;
              rootElement.style.fontSize = fontSize + 'px';
            }
          }, 0);
        } else {
          abilityContainer.textContent = 'Ability data available but could not render tooltip';
        }
      } else {
        abilityContainer.textContent = 'Ability tooltip system not available';
      }
    } else {
      abilityContainer.textContent = 'No ability data available';
      abilityContainer.style.fontStyle = 'italic';
      abilityContainer.style.color = '#888';
    }
  } catch (error) {
    console.error('[Cyclopedia] Error rendering ability tooltip:', error);
    abilityContainer.textContent = 'Error loading ability data';
    abilityContainer.style.fontStyle = 'italic';
    abilityContainer.style.color = COLOR_CONSTANTS.ERROR;
  }
  
  abilityList.appendChild(abilityContainer);
  abilityScrollContainer.appendChild(abilityList);
  abilitySection.appendChild(abilityScrollContainer);
  
  if (tooltipComponent) {
    abilitySection._tooltipComponent = tooltipComponent;
  }

  col1FlexRows.appendChild(col1TopArea);
  col1FlexRows.appendChild(abilitySection);
  col1.appendChild(col1Title);
  
  // Add creature roles if available - positioned directly under the title
  const roles = getCreatureRoles(name);
  if (roles && roles.length > 0) {
    const rolesContainer = document.createElement('div');
    rolesContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      justify-content: center;
      margin: 8px 0;
      padding: 0 8px;
    `;
    
    roles.forEach(role => {
      const roleBadge = document.createElement('span');
      roleBadge.textContent = role;
      roleBadge.className = 'frame-pressed-1 surface-dark';
      roleBadge.style.cssText = `
        padding: 2px 6px;
        font-size: 11px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
        color: #ffe066;
        margin: 0;
        border-radius: 0;
        display: inline-block;
      `;
      rolesContainer.appendChild(roleBadge);
    });
    
    col1.appendChild(rolesContainer);
  }
  
  col1.appendChild(col1FlexRows);
  const col2 = document.createElement('div');
  Object.assign(col2.style, creatureTemplateColStyle);
  col2.style.padding = '0';
  col2.style.margin = '0';
  col2.style.marginLeft = '0';
  col2.style.paddingLeft = '0';
  col2.style.borderRight = '6px solid transparent';
  col2.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
  col2.style.overflowY = 'hidden';

  const dropsSection = document.createElement('div');
  dropsSection.style.flex = '1 1 0';
  dropsSection.style.minHeight = '0';
  dropsSection.style.display = 'flex';
  dropsSection.style.flexDirection = 'column';
  dropsSection.style.overflow = 'hidden';
  dropsSection.className = FONT_CONSTANTS.SIZES.SMALL;

  const dropsTitle = createCyclopediaWidgetTitle('Location', { width: '100%' });
  const dropsTitleP = dropsTitle;
  const isGazerCreatureDetail = isCyclopediaGazerCreatureName(name);
  if (!isGazerCreatureDetail && !isUnobtainable) {
    const usageSection = document.createElement('div');
    usageSection.style.display = 'flex';
    usageSection.style.flexDirection = 'column';
    usageSection.style.flex = '0 0 auto';

    const usageTitle = createCyclopediaWidgetTitle('Player usage', { width: '100%' });
    const usageTitleP = usageTitle;

    const usageContent = document.createElement('div');
    usageContent.className = FONT_CONSTANTS.SIZES.SMALL;
    usageContent.style.cssText = 'padding: 6px 8px 8px 8px; color:#e6d7b0; display:flex; flex-direction:column; gap:2px; line-height:1.15;';
    const usageStats = getBoardConfigUsageStatsForCreature(monsterId);
    const usedRow = document.createElement('div');
    usedRow.textContent = `Used ${usageStats.count} times`;
    const pctRow = document.createElement('div');
    pctRow.textContent = `Usage percentage: ${usageStats.percentage}%`;
    usageContent.appendChild(usedRow);
    usageContent.appendChild(pctRow);
    usageSection.appendChild(usageTitle);
    usageSection.appendChild(usageContent);

    const usageSeparator = document.createElement('div');
    usageSeparator.className = 'separator my-2.5';
    usageSeparator.setAttribute('role', 'none');
    usageSeparator.style.margin = '2px 0';

    dropsSection.appendChild(usageSection);
    dropsSection.appendChild(usageSeparator);
  }
  dropsSection.appendChild(dropsTitle);
  const dropsList = document.createElement('div');
  dropsList.style.padding = '8px 10px 8px 10px';
  dropsList.style.display = 'flex';
  dropsList.style.flexDirection = 'column';
  dropsList.style.gap = '6px';
  dropsList.style.marginTop = '4px';
  dropsList.style.marginBottom = '4px';
  dropsList.className = FONT_CONSTANTS.SIZES.BODY;
  dropsList.style.lineHeight = '1';
  dropsList.style.letterSpacing = '.0625rem';
  dropsList.style.wordSpacing = '-.1875rem';
  dropsList.style.color = COLOR_CONSTANTS.TEXT;
  dropsList.style.flex = '1 1 0';
  dropsList.style.minHeight = '0';
  dropsList.style.overflowY = 'auto';
  dropsList.style.maxHeight = 'none';

  let monsterLocations = [];
  const isGazerCreature = isGazerCreatureDetail;
  if (!isGazerCreature) {
    try {
      monsterLocations = findMonsterLocations(name);
    } catch (error) {
    }
  }
  if (isGazerCreature) {
    appendCyclopediaGazerObtainLocations(dropsList, name);
  } else if (monsterLocations.length > 0) {
    function capitalizeRegionName(name) {
      if (!name) return '';
      return cyclopediaGetRegionDisplayName(name);
    }
    const regionMap = new Map();
    monsterLocations.forEach((location) => {
      let translatedRoomName = location.roomId;
      let regionName = 'Unknown Region';
      let regionEntry = null;
      try {
        const rooms = globalThis.state.utils.ROOMS;
        const regions = globalThis.state.utils.REGIONS;
        const roomEntry = rooms[location.roomId];
        if (roomEntry && globalThis.state.utils.ROOM_NAME[roomEntry.id]) {
          translatedRoomName = globalThis.state.utils.ROOM_NAME[roomEntry.id];
        }
        if (roomEntry && roomEntry.region) {
          if (regions && typeof regions === 'object' && !Array.isArray(regions)) {
            regionEntry = regions[roomEntry.region];
          }
          if (!regionEntry && Array.isArray(regions)) {
            regionEntry = regions.find(r => r.id === roomEntry.region);
          }
          if (regionEntry && regionEntry.name) {
            regionName = regionEntry.name;
          } else if (regionEntry && regionEntry.id) {
            regionName = regionEntry.id;
          }
        } else if (Array.isArray(regions) && roomEntry && roomEntry.id) {
          for (const reg of regions) {
            if (Array.isArray(reg.rooms)) {
              if (reg.rooms.some(r => r.id === roomEntry.id)) {
                regionEntry = reg;
                break;
              }
            }
          }
          if (regionEntry) {
            regionName = regionEntry.name || regionEntry.id;
          }
        }
      } catch (e) {}
      regionName = capitalizeRegionName(regionName);
      if (!regionMap.has(regionName)) {
        regionMap.set(regionName, []);
      }
      regionMap.get(regionName).push({ roomName: translatedRoomName, positions: location.positions });
    });
    if (regionMap.size > 0) {
      for (const [regionName, rooms] of regionMap.entries()) {
        const regionDiv = document.createElement('div');
        regionDiv.style.fontWeight = '700'; // Match cyclopedia-subnav
        regionDiv.className = FONT_CONSTANTS.SIZES.BODY;
        regionDiv.style.color = COLOR_CONSTANTS.TEXT;
        regionDiv.style.background = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat";
        regionDiv.style.border = '6px solid transparent';
        regionDiv.style.borderColor = '#ffe066';
        regionDiv.style.borderImage = "url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch";
        regionDiv.style.color = 'var(--theme-text, #e6d7b0)';
        regionDiv.style.fontWeight = '700';
        regionDiv.style.borderRadius = '0';
        regionDiv.style.boxSizing = 'border-box';
        regionDiv.style.textAlign = 'center';
        regionDiv.style.padding = '1px 4px';
        regionDiv.style.margin = '1px 0 0 0';
        regionDiv.style.display = 'block';
        regionDiv.style.textAlign = 'center';
        regionDiv.textContent = regionName;
        dropsList.appendChild(regionDiv);
        rooms.forEach(({ roomName, positions }) => {
          const roomDiv = document.createElement('div');
          roomDiv.style.fontWeight = 'bold';
          roomDiv.className = FONT_CONSTANTS.SIZES.SMALL;
          roomDiv.style.lineHeight = '1';
          roomDiv.style.letterSpacing = '.0625rem';
          roomDiv.style.wordSpacing = '-.1875rem';
          roomDiv.style.margin = '0';
          roomDiv.style.padding = '2px 6px';
          roomDiv.style.borderRadius = '4px';
          roomDiv.style.display = 'flex';
          roomDiv.style.justifyContent = 'space-between';
          roomDiv.style.alignItems = 'center';
          roomDiv.style.textAlign = 'left';
          roomDiv.textContent = '';
          const nameSpan = document.createElement('span');
          nameSpan.textContent = roomName;
          nameSpan.style.flex = '1 1 auto';
          nameSpan.style.overflow = 'hidden';
          nameSpan.style.textOverflow = 'ellipsis';
          nameSpan.style.whiteSpace = 'nowrap';
          const rightSpan = document.createElement('span');
          rightSpan.style.display = 'flex';
          rightSpan.style.alignItems = 'center';
          rightSpan.style.gap = '2px';
          rightSpan.style.marginLeft = '8px';
          const foundLocation = monsterLocations.find(loc => {
            let translatedRoomName = loc.roomId;
            const roomsObj = globalThis.state.utils.ROOMS;
            if (roomsObj && roomsObj[loc.roomId] && globalThis.state.utils.ROOM_NAME[roomsObj[loc.roomId].id]) {
              translatedRoomName = globalThis.state.utils.ROOM_NAME[roomsObj[loc.roomId].id];
            }
            return translatedRoomName === roomName;
          });
          let staminaCost = null;
          if (foundLocation && globalThis.state.utils.ROOMS && globalThis.state.utils.ROOMS[foundLocation.roomId]) {
            staminaCost = globalThis.state.utils.ROOMS[foundLocation.roomId].staminaCost;
          }
          if (staminaCost != null) {
            const icon = document.createElement('img');
            icon.src = 'https://bestiaryarena.com/assets/icons/stamina.png';
            icon.alt = 'Stamina';
            icon.style.width = '18px';
            icon.style.height = '18px';
            icon.style.marginLeft = '2px';
            icon.style.display = 'inline-block';
            const costSpan = document.createElement('span');
            costSpan.textContent = staminaCost;
            costSpan.style.fontWeight = 'bold';
            costSpan.style.color = '#ffe066';
            costSpan.style.marginLeft = '2px';
            rightSpan.appendChild(costSpan);
            rightSpan.appendChild(icon);
          }
          roomDiv.appendChild(nameSpan);
          roomDiv.appendChild(rightSpan);
          roomDiv.style.cursor = MAP_INTERACTION_CONFIG.cursor;
          roomDiv.style.textDecoration = MAP_INTERACTION_CONFIG.textDecoration;
          roomDiv.title = MAP_INTERACTION_CONFIG.tooltip;
          let foundLoc = foundLocation;
          if (foundLoc) {
            roomDiv.addEventListener('mouseenter', () => {
              roomDiv.style.background = MAP_INTERACTION_CONFIG.hoverBackground;
              roomDiv.style.color = MAP_INTERACTION_CONFIG.hoverTextColor;
            });
            roomDiv.addEventListener('mouseleave', () => {
              roomDiv.style.background = MAP_INTERACTION_CONFIG.defaultBackground;
              roomDiv.style.color = MAP_INTERACTION_CONFIG.defaultTextColor;
            });
            roomDiv.addEventListener('click', () => {
              const roomCode = globalThis.state.utils.ROOMS[foundLoc.roomId]?.id;
              if (roomCode) {
                NavigationHandler.navigateToMapByRoomId(roomCode);
              }
            });
          }
          dropsList.appendChild(roomDiv);
          positions.forEach((pos) => {
            const detail = document.createElement('div');
            detail.textContent = `Lv: ${pos.level}`;
            detail.style.color = COLOR_CONSTANTS.TEXT;
            detail.className = FONT_CONSTANTS.SIZES.TINY;
            detail.style.lineHeight = '1';
            detail.style.letterSpacing = '.0625rem';
            detail.style.wordSpacing = '-.1875rem';
            detail.style.marginLeft = '6px';
            detail.style.marginTop = '0px';
            dropsList.appendChild(detail);
          });
          const separator = document.createElement('div');
          separator.className = 'separator my-2.5';
          separator.setAttribute('role', 'none');
          separator.style.margin = '6px 0';
          dropsList.appendChild(separator);
        });
      }
    } else {
      const noLocationItem = document.createElement('div');
      noLocationItem.textContent = 'No locations found';
      noLocationItem.style.color = COLOR_CONSTANTS.TEXT;
      noLocationItem.className = FONT_CONSTANTS.SIZES.BODY;
      noLocationItem.style.lineHeight = '1';
      noLocationItem.style.letterSpacing = '.0625rem';
      noLocationItem.style.wordSpacing = '-.1875rem';
      noLocationItem.style.fontStyle = 'italic';
      dropsList.appendChild(noLocationItem);
    }
  } else {
    // No locations found
    const noLocationItem = document.createElement('div');
    noLocationItem.textContent = 'No locations found';
    noLocationItem.style.color = COLOR_CONSTANTS.TEXT;
    noLocationItem.style.fontFamily = 'var(--font-filled)';
    noLocationItem.style.fontSize = '16px';
    noLocationItem.style.lineHeight = '1';
    noLocationItem.style.letterSpacing = '.0625rem';
    noLocationItem.style.wordSpacing = '-.1875rem';
    noLocationItem.style.fontStyle = 'italic';
    noLocationItem.className = FONT_CONSTANTS.SIZES.BODY;
    dropsList.appendChild(noLocationItem);
  }
  dropsSection.appendChild(dropsList);

  col2.appendChild(dropsSection);

  const col3 = document.createElement('div');
  Object.assign(col3.style, creatureTemplateColStyle);
  col3.style.maxHeight = '100%';
  col3.style.overflowY = 'hidden';

  function getBoardConfigUsageStatsForCreature(targetMonsterGameId) {
    const emptyStats = { count: 0, total: 0, percentage: 0 };
    try {
      const playerContext = globalThis.state?.player?.getSnapshot?.().context;
      const monsters = Array.isArray(playerContext?.monsters) ? playerContext.monsters : [];
      const boardConfigs = playerContext?.boardConfigs && typeof playerContext.boardConfigs === 'object'
        ? playerContext.boardConfigs
        : {};
      if (!monsters.length) return emptyStats;

      const monsterLookup = new Map(monsters.map((m) => [m.id, m.gameId]));
      let total = 0; // total maps with config arrays
      let count = 0;
      Object.values(boardConfigs).forEach((cfgs) => {
        if (!Array.isArray(cfgs)) return;
        total++;
        let foundOnMap = false;
        cfgs.forEach((cfg) => {
          const monsterId = cfg?.monsterId;
          if (monsterId == null) return;
          const gid = monsterLookup.get(monsterId);
          if (gid == null) return;
          if (gid === targetMonsterGameId) foundOnMap = true;
        });
        if (foundOnMap) count++;
      });

      return {
        count,
        total,
        percentage: total > 0 ? Math.floor((count / total) * 100) : 0
      };
    } catch (e) {
      console.warn('[Cyclopedia] Error calculating creature config usage:', e);
      return emptyStats;
    }
  }

  let ownedMonsters = [];
  try {
    const playerContext = globalThis.state?.player?.getSnapshot?.().context;
    if (playerContext && Array.isArray(playerContext.monsters) && monsterId != null) {
      const db = window.creatureDatabase;
      if (typeof db?.filterMonstersForCreatureDisplay === 'function') {
        ownedMonsters = db.filterMonstersForCreatureDisplay(name, playerContext.monsters);
      } else {
        const displayQuery = cyclopediaResolveCreatureQuery(name);
        ownedMonsters = playerContext.monsters.filter((m) => m.gameId === monsterId);
        if (displayQuery.shinyOnly) {
          ownedMonsters = ownedMonsters.filter((m) => m.shiny === true);
        } else if (displayQuery.nonShinyOnly) {
          ownedMonsters = ownedMonsters.filter((m) => m.shiny !== true);
        }
      }
    }
  } catch (e) {}
  const ownedName = name || '';
  const ownedCount = ownedMonsters.length;
  let pluralName = ownedName;
  if (ownedCount > 1 && ownedName) {
    pluralName = ownedName + 's';
  }

  const col3Title = createCyclopediaWidgetTitle('', { width: '100%' });
  const col3TitleP = col3Title;
  if (isUnobtainable) {
    col3Title.textContent = ownedName;
  } else {
    col3Title.textContent = `Owned ${pluralName}${pluralName ? ` (${ownedCount})` : ''}`;
  }

  const col3Content = document.createElement('div');
  col3Content.style.display = 'flex';
  col3Content.style.flexDirection = 'column';
  col3Content.style.flex = '1 1 0';
  col3Content.style.minHeight = '0';
  col3Content.style.height = '100%';
  col3Content.style.maxHeight = '100%';
  col3Content.style.overflowY = 'auto';
  col3Content.style.overflowX = 'hidden';
  col3Content.style.scrollbarWidth = 'thin';
  col3Content.style.scrollbarColor = '#444 #222';
  col3Content.style.marginTop = '0';
  if (ownedMonsters.length > 0) {
    ownedMonsters.sort((a, b) => {
      const levelA = getLevelFromExp(a.exp);
      const levelB = getLevelFromExp(b.exp);
      if (levelB !== levelA) return levelB - levelA;

      const tierA = a.tier || 1;
      const tierB = b.tier || 1;
      if (tierB !== tierA) return tierB - tierA;

      const statSumA = (a.hp || 0) + (a.ad || 0) + (a.ap || 0) + (a.armor || 0) + (a.magicResist || 0);
      const statSumB = (b.hp || 0) + (b.ad || 0) + (b.ap || 0) + (b.armor || 0) + (b.magicResist || 0);

      let rarityA = 1;
      let rarityB = 1;
      if (statSumA >= 80) rarityA = 5;
      else if (statSumA >= 70) rarityA = 4;
      else if (statSumA >= 60) rarityA = 3;
      else if (statSumA >= 50) rarityA = 2;
      if (statSumB >= 80) rarityB = 5;
      else if (statSumB >= 70) rarityB = 4;
      else if (statSumB >= 60) rarityB = 3;
      else if (statSumB >= 50) rarityB = 2;

      return rarityB - rarityA;
    });
    
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    ownedMonsters.forEach(monster => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'flex-start';
      row.style.gap = '20px';
      row.style.height = '82px';
      row.style.margin = '8px 20px 0 20px';

      const level = getLevelFromExp(monster.exp);
      const totalGenes = (Number(monster.hp) || 0) + (Number(monster.ad) || 0) + (Number(monster.ap) || 0) + (Number(monster.armor) || 0) + (Number(monster.magicResist) || 0);
      const isAwakened = creatureCanAwaken && (
        monster.awaken === true || monster.awakened === true || monster.isAwakened === true
        || Number(monster.tier) >= 6 || Number(monster.starTier) >= 6 || level > 50
      );
      const isMaxAwakened = creatureCanAwaken && level >= 99 && totalGenes >= 100;

      const portrait = api.ui.components.createFullMonster({
        monsterId: monster.gameId || monster.id,
        tier: 1,
        starTier: monster.tier ?? 0,
        level,
        size: 'small'
      });
      portrait.style.margin = '0';
      
      // Set shiny attribute on the sprite if creature is shiny
      if (monster.shiny === true) {
        
        const spriteImg = portrait.querySelector('img.actor.spritesheet');
        if (spriteImg) {
          spriteImg.setAttribute('data-shiny', 'true');
        }
        
        // Add shiny star overlay
        const shinyIcon = document.createElement('img');
        shinyIcon.src = 'https://bestiaryarena.com/assets/icons/shiny-star.png';
        shinyIcon.alt = 'shiny';
        shinyIcon.title = 'Shiny';
        shinyIcon.style.position = 'absolute';
        shinyIcon.style.top = '4px';
        shinyIcon.style.left = '4px';
        shinyIcon.style.width = '10px';
        shinyIcon.style.height = '10px';
        shinyIcon.style.pointerEvents = 'none';
        shinyIcon.style.zIndex = '10';
        portrait.appendChild(shinyIcon);
      }

      if (isMaxAwakened) {
        // Replace existing awakened/star-tier icon instead of stacking another icon.
        // Match getCreatureStatus: shiny max → shiny star; non-shiny max → hundo star.
        const starTierIcon = portrait.querySelector('img[alt="star tier"]');
        if (starTierIcon) {
          if (monster.shiny === true) {
            starTierIcon.src = 'https://bestiaryarena.com/assets/icons/star-tier-shiny.png';
            starTierIcon.alt = 'shiny-tier';
            starTierIcon.title = 'Has level 99 max-genes shiny creature';
          } else {
            starTierIcon.src = 'https://bestiaryarena.com/assets/icons/star-tier-hundo.png';
            starTierIcon.alt = 'hundo-tier';
            starTierIcon.title = 'Has level 99 max-genes creature';
          }
        }
      }

      const levelBadge = portrait.querySelector('span.pixel-font-16');
      if (levelBadge) levelBadge.remove();
      const statsGrid = document.createElement('div');
      statsGrid.style.display = 'grid';
      statsGrid.style.gridTemplateColumns = 'auto auto';
      statsGrid.style.gridTemplateRows = 'repeat(3, auto)';
      statsGrid.style.gap = '2px 12px';
      statsGrid.style.alignSelf = 'center';
      statsGrid.className = FONT_CONSTANTS.SIZES.SMALL;
      statsGrid.style.color = COLOR_CONSTANTS.TEXT;
      statsGrid.style.fontWeight = 'bold';
      statsGrid.style.overflow = 'hidden';
      statsGrid.style.textOverflow = 'ellipsis';
      statsGrid.style.whiteSpace = 'nowrap';
      statsGrid.style.maxWidth = '120px';
      function statCell(icon, value, isLabel) {
        const cell = document.createElement('div');
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.gap = '4px';
        cell.style.overflow = 'hidden';
        cell.style.textOverflow = 'ellipsis';
        cell.style.whiteSpace = 'nowrap';

        if (isLabel) {
          const label = document.createElement('span');
          label.textContent = icon;
          label.style.fontWeight = 'bold';
          label.className = FONT_CONSTANTS.SIZES.TINY;
          cell.appendChild(label);
        } else {
          const img = document.createElement('img');
          img.src = icon;
          img.style.width = '18px';
          img.style.height = '18px';
          img.style.display = 'inline-block';
          img.style.verticalAlign = 'middle';
          cell.appendChild(img);
        }

        const num = document.createElement('span');
        num.textContent = value;
        num.style.fontWeight = 'bold';
        num.className = FONT_CONSTANTS.SIZES.TINY;
        cell.appendChild(num);
        return cell;
      }
      statsGrid.appendChild(statCell('Lv.', level, true));
      statsGrid.appendChild(statCell('/assets/icons/abilitypower.png', monster.ap));
      statsGrid.appendChild(statCell('/assets/icons/heal.png', monster.hp));
      statsGrid.appendChild(statCell('/assets/icons/armor.png', monster.armor));
      statsGrid.appendChild(statCell('/assets/icons/attackdamage.png', monster.ad));
      statsGrid.appendChild(statCell('/assets/icons/magicresist.png', monster.magicResist));

      row.appendChild(portrait);
      row.appendChild(statsGrid);
      fragment.appendChild(row);
      const statSum = (monster.hp || 0) + (monster.ad || 0) + (monster.ap || 0) + (monster.armor || 0) + (monster.magicResist || 0);
      let rarity = 1;
      if (statSum >= 80) rarity = 5;
      else if (statSum >= 70) rarity = 4;
      else if (statSum >= 60) rarity = 3;
      else if (statSum >= 50) rarity = 2;

      // Use requestAnimationFrame for smoother DOM updates
      requestAnimationFrame(() => {
        const borderElem = portrait.querySelector('.has-rarity, .rarity-awaken, .rarity-shiny, .rarity-hundo');
        if (borderElem) {
          if (isMaxAwakened && monster.shiny === true) {
            borderElem.className = 'absolute inset-0 z-2 opacity-80 rarity-shiny';
            borderElem.removeAttribute('data-rarity');
          } else if (isMaxAwakened) {
            borderElem.className = 'absolute inset-0 z-1 opacity-80 rarity-hundo';
            borderElem.removeAttribute('data-rarity');
          } else if (isAwakened) {
            borderElem.className = 'absolute inset-0 z-2 opacity-80 rarity-awaken';
            borderElem.removeAttribute('data-rarity');
          } else {
            borderElem.className = 'has-rarity absolute inset-0 z-2';
            borderElem.setAttribute('data-rarity', rarity);
          }
        }
      });
    });
    
    // Append all rows at once for better performance
    col3Content.appendChild(fragment);
  } else {
    if (isUnobtainable) {
      col3Content.className = FONT_CONSTANTS.SIZES.BODY;
      col3Content.textContent = 'This creature is unobtainable.';
      // Center the text and add padding for unobtainable creatures
      col3Content.style.textAlign = 'center';
      col3Content.style.padding = '20px';
      col3Content.style.display = 'flex';
      col3Content.style.alignItems = 'center';
      col3Content.style.justifyContent = 'center';
    } else {
      col3Content.className = FONT_CONSTANTS.SIZES.BODY;
      col3Content.textContent = 'You do not own this creature.';
      // Center the text both horizontally and vertically
      col3Content.style.textAlign = 'center';
      col3Content.style.padding = '20px';
      col3Content.style.display = 'flex';
      col3Content.style.alignItems = 'center';
      col3Content.style.justifyContent = 'center';
      col3Content.style.height = '100%';
    }
  }
  col3.appendChild(col3Title);
  col3.appendChild(col3Content);
  container.appendChild(col1);
  container.appendChild(col2);
  container.appendChild(col3);

  col3Content.id = 'cyclopedia-owned-scroll';

  if (!DOMCache.get('#cyclopedia-owned-scrollbar-style')) {
    const style = document.createElement('style');
    style.id = 'cyclopedia-owned-scrollbar-style';
    style.textContent = `
      #cyclopedia-owned-scroll::-webkit-scrollbar {
        width: 12px !important;
        background: transparent !important;
      }
      #cyclopedia-owned-scroll::-webkit-scrollbar-thumb {
        background: url('https://bestiaryarena.com/_next/static/media/scrollbar-handle-vertical.962972d4.png') repeat-y !important;
        border-radius: 4px !important;
      }
      #cyclopedia-owned-scroll::-webkit-scrollbar-corner {
        background: transparent !important;
      }
    `;
    document.head.appendChild(style);
  }

  return container;
}

const CYCLOPEDIA_RANKING_ROW_KEYS = ['rankPoints', 'timeSum', 'floorsSum'];
const CYCLOPEDIA_RANKING_POSITION_KEYS = {
  rankPoints: 'rankPointsPosition',
  timeSum: 'ticksPosition',
  floorsSum: 'floorsPosition'
};

function createCyclopediaSeasonsLeaderboardLink() {
  const seasonLink = document.createElement('a');
  seasonLink.href = 'https://bestiaryarena.com/seasons';
  seasonLink.target = '_blank';
  seasonLink.rel = 'noopener noreferrer';
  seasonLink.textContent = CYCLOPEDIA_UI.viewFullSeasonsLeaderboard;
  Object.assign(seasonLink.style, {
    display: 'inline-flex',
    alignSelf: 'center',
    marginTop: '8px',
    marginBottom: '2px',
    fontSize: '12px',
    color: '#ffe066',
    textDecoration: 'underline',
    cursor: 'pointer',
    flexShrink: '0'
  });
  seasonLink.addEventListener('mouseover', () => {
    seasonLink.style.color = '#fff2b2';
  });
  seasonLink.addEventListener('mouseout', () => {
    seasonLink.style.color = '#ffe066';
  });
  return seasonLink;
}

const CYCLOPEDIA_SEASON_TAB_BTN_CLASS =
  'focus-style-visible console-frame-inactive pixel-font-16 surface-dark relative whitespace-nowrap px-3.5 text-center text-whiteRegular disabled:dithered data-[state=active]:console-frame-active data-[state=active]:surface-regular disabled:pointer-events-none disabled:text-whiteBrightest data-[state=active]:z-2 data-[state=active]:text-whiteBrightest';

function setCyclopediaSeasonTabLabel(btn, seasonNum, currentSeason) {
  btn.textContent = '';
  btn.appendChild(document.createTextNode(`#${seasonNum} `));
  btn.appendChild(document.createTextNode('Season'));
  if (Number(seasonNum) === Number(currentSeason)) {
    btn.appendChild(document.createTextNode(' '));
    const currentTag = document.createElement('span');
    currentTag.className = 'text-whiteDark';
    currentTag.textContent = '(current)';
    btn.appendChild(currentTag);
  }
}

function getCyclopediaRankingsSectionLabel(seasonNum) {
  const season = Number(seasonNum);
  return Number.isFinite(season) && season > 0
    ? CYCLOPEDIA_UI.rankingsSeason(season)
    : CYCLOPEDIA_UI.rankings;
}

function syncCyclopediaSeasonToggleStyles(tablist) {
  if (!tablist) return;
  const activeSeason = Number(cyclopediaState.profileSeason || 1);
  tablist.querySelectorAll('button[role="tab"]').forEach((btn) => {
    const sn = Number(btn.dataset.cyclopediaSeason);
    const selected = activeSeason === sn;
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
    btn.dataset.state = selected ? 'active' : 'inactive';
    btn.setAttribute('tabindex', selected ? '0' : '-1');
  });
}

function getCyclopediaRankingRowDisplay(profileData, rankingKey) {
  const entry = CYCLOPEDIA_PROFILE_VALUE[rankingKey];
  const raw = entry && typeof entry.value === 'function' ? entry.value(profileData) : profileData[rankingKey];
  const positionKey = CYCLOPEDIA_RANKING_POSITION_KEYS[rankingKey];
  const position = positionKey ? profileData[positionKey] : undefined;
  return {
    value: raw !== undefined && raw !== null ? FormatUtils.number(raw) : cyclopediaSeasonNA(),
    title: position !== undefined && position !== null ? String(position) : undefined
  };
}

function updateCyclopediaStartpageRankings(root, profileData) {
  if (!root || !profileData) return;
  const activeSeason = cyclopediaState.profileSeason || 1;
  const headerTr = root.querySelector('tr[data-cyclopedia-section-header="rankings"]');
  if (headerTr) {
    const td = headerTr.querySelector('td');
    if (td) td.textContent = getCyclopediaRankingsSectionLabel(activeSeason);
  }
  const patched = patchProfileDataForActiveSeason(profileData, activeSeason);
  const highscoreIcon = { alt: 'Highscore', src: '/assets/icons/highscore.png', width: 11, height: 11, className: 'pixelated inline-block -translate-y-0.5' };
  CYCLOPEDIA_RANKING_ROW_KEYS.forEach((rankingKey) => {
    const tr = root.querySelector(`tr[data-cyclopedia-ranking-row="${rankingKey}"]`);
    if (!tr) return;
    const td = tr.querySelector('td:last-child');
    if (!td) return;
    const { value, title } = getCyclopediaRankingRowDisplay(patched, rankingKey);
    if (title) td.title = title;
    else td.removeAttribute('title');
    td.textContent = value;
    const extraImg = document.createElement('img');
    extraImg.alt = highscoreIcon.alt;
    extraImg.src = highscoreIcon.src;
    extraImg.width = highscoreIcon.width;
    extraImg.height = highscoreIcon.height;
    extraImg.className = highscoreIcon.className;
    td.appendChild(extraImg);
  });
}

function renderCyclopediaSeasonToggleRow(onSeasonChange) {
  const currentSeason = getLatestProfileSeason(cyclopediaState.lastStartupProfileData, 2);
  const tablist = document.createElement('div');
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-orientation', 'horizontal');
  tablist.className = 'flex';
  tablist.style.outline = 'none';
  tablist.style.width = '100%';
  tablist.style.flexShrink = '0';
  tablist.style.marginBottom = '0';

  CYCLOPEDIA_PROFILE_SEASONS.forEach((sn) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.dataset.cyclopediaSeason = String(sn);
    btn.className = CYCLOPEDIA_SEASON_TAB_BTN_CLASS;
    btn.style.flex = '1 1 0';
    btn.style.cursor = 'pointer';
    setCyclopediaSeasonTabLabel(btn, sn, currentSeason);
    btn.addEventListener('click', () => {
      if (Number(cyclopediaState.profileSeason) === sn) return;
      cyclopediaState.profileSeason = sn;
      if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('cyclopedia-season-changed', { detail: { season: sn } }));
      }
      if (typeof onSeasonChange === 'function') onSeasonChange();
    });
    tablist.appendChild(btn);
  });
  syncCyclopediaSeasonToggleStyles(tablist);
  return tablist;
}

function renderCyclopediaProfileColumn(profileData) {
  const wrapper = document.createElement('div');
  wrapper.dataset.cyclopediaStartpageProfile = 'true';
  Object.assign(wrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '0',
    width: '100%',
    boxSizing: 'border-box',
    gap: '0'
  });

  const handleStartpageSeasonChange = () => {
    syncCyclopediaSeasonToggleStyles(seasonTablist);
    updateCyclopediaStartpageRankings(wrapper, profileData);
    refreshLeaderboardCacheYourRoomsForSeason();
  };

  const seasonTablist = renderCyclopediaSeasonToggleRow(handleStartpageSeasonChange);
  wrapper.appendChild(seasonTablist);

  const scrollArea = document.createElement('div');
  Object.assign(scrollArea.style, {
    flex: '1 1 0',
    minHeight: '0',
    overflowY: 'auto',
    overflowX: 'hidden',
    width: '100%',
    marginTop: '0',
    paddingTop: '0'
  });

  const patchedProfile = patchProfileDataForActiveSeason(profileData, cyclopediaState.profileSeason || 1);
  scrollArea.appendChild(renderCyclopediaPlayerInfo(patchedProfile, {
    compact: true,
    season: cyclopediaState.profileSeason || 1
  }));
  wrapper.appendChild(scrollArea);
  wrapper.appendChild(createCyclopediaSeasonsLeaderboardLink());
  return wrapper;
}

function renderCyclopediaWelcomeColumn(playerName, profileData, onSeasonChange, options = {}) {
  const { showSeasonToggle = true } = options;
  try {
    const activeSeason = cyclopediaState.profileSeason || 1;
    const pd = unwrapProfilePageJson(profileData) || {};
    const s = findProfileSeasonEntry(pd, activeSeason);
    const season2RankBracket = getSeason2MetricBracket(pd, s, activeSeason, 'rank');
    const season2TicksBracket = getSeason2MetricBracket(pd, s, activeSeason, 'ticks');
    const season2FloorsBracket = getSeason2MetricBracket(pd, s, activeSeason, 'floors');
    const pickPlacement = (...candidates) => {
      for (const c of candidates) {
        const n = Number(c);
        if (Number.isFinite(n) && n > 0) return n;
      }
      return null;
    };
    const seasonStats = {
      // For current season, profile payload can expose live aggregates only at top level.
      ticks: s?.ticks ?? pd.ticks,
      rank: s?.rank ?? pd.rankPoints,
      floors: s?.floors ?? pd.floors,
      ticksPlacement: pickPlacement(s?.ticksPosition, s?.ticksPos, pd?.ticksPosition, pd?.ticksPos),
      rankPlacement: pickPlacement(s?.rankPosition, s?.position, s?.rankPos, pd?.rankPosition, pd?.position, pd?.rankPointsPosition),
      floorsPlacement: pickPlacement(s?.floorsPosition, s?.floorsPos, pd?.floorsPosition, pd?.floorsPos),
      ticksBracket: season2TicksBracket || s?.ticksBracket,
      rankBracket: season2RankBracket || s?.rankBracket,
      floorsBracket: season2FloorsBracket || s?.floorsBracket
    };

    const div = document.createElement('div');
    div.style.flex = '0 1 auto';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.justifyContent = 'flex-start';
    div.style.alignItems = 'center';
    div.style.padding = '24px';
    div.style.width = '100%';
    div.style.maxHeight = '100%';
    div.style.minHeight = '0';
    div.style.overflowY = 'auto';
    div.style.boxSizing = 'border-box';

    const headline = document.createElement('h2');
    headline.style.color = '#ffe066';
    headline.style.fontSize = '22px';
    headline.style.marginBottom = '12px';
    headline.style.marginTop = '0';
    headline.style.textAlign = 'center';
    headline.style.width = '100%';
    headline.textContent = playerName
      ? CYCLOPEDIA_UI.welcomeName(playerName)
      : CYCLOPEDIA_UI.welcome;
    div.appendChild(headline);

    if (showSeasonToggle) {
      div.appendChild(renderCyclopediaSeasonToggleRow(onSeasonChange));
    }

    const statsWrap = document.createElement('div');
    statsWrap.style.width = '100%';
    statsWrap.style.flex = '0 0 auto';
    statsWrap.style.display = 'flex';
    statsWrap.style.flexDirection = 'column';
    statsWrap.style.gap = '10px';

    const title = document.createElement('div');
    title.style.color = '#ffe066';
    title.style.fontSize = '16px';
    title.style.fontWeight = 'bold';
    title.style.textAlign = 'center';
    title.style.width = '100%';
    title.style.display = 'flex';
    title.style.alignItems = 'center';
    title.style.justifyContent = 'center';
    title.style.gap = '6px';
    const titleIcon = document.createElement('img');
    titleIcon.src = CYCLOPEDIA_ASSETS.seasonIcon;
    titleIcon.alt = '';
    titleIcon.width = 18;
    titleIcon.height = 18;
    titleIcon.className = 'pixelated';
    Object.assign(titleIcon.style, { width: '18px', height: '18px', flexShrink: '0' });
    const titleLabel = document.createElement('span');
    titleLabel.textContent = CYCLOPEDIA_UI.seasonStatsTitle;
    title.appendChild(titleIcon);
    title.appendChild(titleLabel);
    statsWrap.appendChild(title);

    const appendStatRow = (parent, labelKey, rawValue, bracket, placement) => {
      const na = cyclopediaSeasonNA();
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.fontSize = '13px';
      row.style.color = '#e6d7b0';
      row.style.height = '20px';
      row.style.minHeight = '20px';
      row.style.maxHeight = '20px';
      row.style.boxSizing = 'border-box';
      const tooltipParts = [];
      if (placement != null) tooltipParts.push(`Placement: #${FormatUtils.number(placement)}`);
      if (bracket != null && bracket !== '') tooltipParts.push(`Bracket: ${String(bracket)}`);
      if (tooltipParts.length > 0) row.title = tooltipParts.join(' | ');
      const lab = document.createElement('span');
      lab.style.flexShrink = '0';
      lab.textContent = String(labelKey);
      const val = document.createElement('span');
      val.style.display = 'flex';
      val.style.flex = '1 1 auto';
      val.style.minWidth = '0';
      val.style.justifyContent = 'flex-end';
      val.style.alignItems = 'center';
      val.style.textAlign = 'right';
      const inner = document.createElement('span');
      inner.style.display = 'inline-flex';
      inner.style.flexDirection = 'row';
      inner.style.flexWrap = 'nowrap';
      inner.style.alignItems = 'center';
      inner.style.gap = '4px';
      inner.style.maxWidth = '100%';
      const hasVal = rawValue !== undefined && rawValue !== null;
      const numSpan = document.createElement('span');
      numSpan.style.flexShrink = '0';
      numSpan.textContent = hasVal ? (typeof rawValue === 'number' ? FormatUtils.number(rawValue) : String(rawValue)) : na;
      inner.appendChild(numSpan);
      if (hasVal && bracket != null && bracket !== '') {
        const iconUrl = cyclopediaBracketIconUrl(bracket);
        const brOuter = document.createElement('span');
        brOuter.style.display = 'inline-flex';
        brOuter.style.alignItems = 'center';
        brOuter.style.gap = '3px';
        brOuter.style.flexShrink = '0';
        if (iconUrl) {
          const img = document.createElement('img');
          img.src = iconUrl;
          img.alt = String(bracket);
          img.width = 18;
          img.height = 18;
          img.className = 'pixelated';
          Object.assign(img.style, { width: '18px', height: '18px', verticalAlign: 'middle' });
          brOuter.appendChild(img);
        }
        const brTxt = document.createElement('span');
        brTxt.style.fontSize = '11px';
        brTxt.style.color = '#c9b896';
        brTxt.textContent = `(${bracket})`;
        brOuter.appendChild(brTxt);
        inner.appendChild(brOuter);
      }
      val.appendChild(inner);
      row.appendChild(lab);
      row.appendChild(val);
      parent.appendChild(row);
    };

    const block = document.createElement('div');
    block.style.border = '1px solid #444';
    block.style.borderRadius = '4px';
    block.style.padding = '8px 10px';
    block.style.background = 'rgba(0,0,0,0.25)';
    block.style.boxSizing = 'border-box';
    block.style.height = '100px';
    block.style.minHeight = '100px';
    block.style.maxHeight = '100px';
    block.style.overflowY = 'auto';

    const sn = document.createElement('div');
    sn.style.color = '#ffe066';
    sn.style.fontSize = '14px';
    sn.style.fontWeight = 'bold';
    sn.style.marginBottom = '6px';
    sn.style.display = 'flex';
    sn.style.alignItems = 'center';
    sn.style.justifyContent = 'center';
    sn.style.gap = '6px';
    const snIcon = document.createElement('img');
    snIcon.src = CYCLOPEDIA_ASSETS.seasonIcon;
    snIcon.alt = '';
    snIcon.width = 16;
    snIcon.height = 16;
    snIcon.className = 'pixelated';
    Object.assign(snIcon.style, { width: '16px', height: '16px', flexShrink: '0' });
    const snText = document.createElement('span');
    snText.textContent = CYCLOPEDIA_UI.seasonStatsSeason(activeSeason);
    sn.appendChild(snIcon);
    sn.appendChild(snText);
    block.appendChild(sn);

    appendStatRow(block, 'Speedrun', seasonStats.ticks, seasonStats.ticksBracket, seasonStats.ticksPlacement);
    appendStatRow(block, 'Rank Points', seasonStats.rank, seasonStats.rankBracket, seasonStats.rankPlacement);
    appendStatRow(block, 'Difficulty', seasonStats.floors, seasonStats.floorsBracket, seasonStats.floorsPlacement);

    statsWrap.appendChild(block);

    const seasonLink = document.createElement('a');
    seasonLink.href = 'https://bestiaryarena.com/seasons';
    seasonLink.target = '_blank';
    seasonLink.rel = 'noopener noreferrer';
    seasonLink.textContent = CYCLOPEDIA_UI.viewFullSeasonsLeaderboard;
    Object.assign(seasonLink.style, {
      display: 'inline-flex',
      alignSelf: 'center',
      marginTop: '2px',
      fontSize: '12px',
      color: '#ffe066',
      textDecoration: 'underline',
      cursor: 'pointer'
    });
    seasonLink.addEventListener('mouseover', () => {
      seasonLink.style.color = '#fff2b2';
    });
    seasonLink.addEventListener('mouseout', () => {
      seasonLink.style.color = '#ffe066';
    });
    statsWrap.appendChild(seasonLink);

    div.appendChild(statsWrap);
    return div;
  } catch (error) {
    console.error('[Cyclopedia] Error rendering welcome column:', error);
    const fallbackDiv = document.createElement('div');
    fallbackDiv.style.padding = '24px';
    fallbackDiv.style.color = '#e6d7b0';
    fallbackDiv.textContent = CYCLOPEDIA_UI.welcomeFallback;
    return fallbackDiv;
  }
}

const CYCLOPEDIA_HOME_SEARCH_INPUT_ID = 'cyclopedia-home-search-input';

function focusCyclopediaHomeSearchInput() {
  const attemptFocus = (triesLeft) => {
    const input = document.getElementById(CYCLOPEDIA_HOME_SEARCH_INPUT_ID);
    if (input && input.isConnected && !input.disabled) {
      try {
        input.focus({ preventScroll: true });
      } catch (_) {}
      return;
    }
    if (triesLeft > 0) {
      setTimeout(() => attemptFocus(triesLeft - 1), 50);
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(() => attemptFocus(24)));
}

const CYCLOPEDIA_HOME_SEARCH_FILTER_CONTROL_CLASS = `${FONT_SMALL_CLASS} bg-grayDark text-whiteHighlight`;
const CYCLOPEDIA_HOME_SEARCH_FILTER_INPUT_STYLE =
  'flex: 1; min-width: 0; padding: 4px 8px; border: none; border-radius: 3px; outline: none;';
const CYCLOPEDIA_HOME_SEARCH_FILTER_SELECT_STYLE =
  'padding: 4px 8px; border: none; border-radius: 3px; outline: none;';
/** Fixed column widths (% of table) for start-page search table. */
const CYCLOPEDIA_HOME_SEARCH_COL_WIDTHS = {
  entry: '50%',
  type: '20%',
  details: '30%'
};

/** Type filter options: "All types" first, then alphabetical by label. */
const CYCLOPEDIA_HOME_SEARCH_TYPE_OPTIONS = [
  ['', 'All types'],
  ['ability', 'Abilities'],
  ['creature', 'Creatures'],
  ['equipment', 'Equipment'],
  ['inventory', 'Inventory'],
  ['map', 'Maps']
];

function applyCyclopediaHomeSearchFilters(results, filters = {}) {
  const { kindFilter } = filters;
  return (results || []).filter((r) => {
    if (kindFilter) {
      if (kindFilter === 'inventory') {
        if (r.kind !== 'inventoryCategory' && r.kind !== 'inventoryItem') return false;
      } else if (kindFilter === 'map') {
        if (r.kind !== 'map') return false;
      } else if (r.kind !== kindFilter) return false;
    }
    return true;
  });
}

function resolveInventoryCatalogKey(catalogLabel) {
  const keys = cyclopediaGetInventoryKeysForCatalogLabel(catalogLabel);
  return keys[0] ?? null;
}

/** Catalog group label for an item key (e.g. summonScroll6 → "Summon Scrolls"). */
function cyclopediaGetInventoryCatalogLabelForItemKey(itemKey) {
  if (!itemKey) return null;
  const variants = INVENTORY_CONFIG?.variants || {};
  for (const [catalogLabel, keys] of Object.entries(variants)) {
    if (Array.isArray(keys) && keys.includes(itemKey)) return catalogLabel;
  }
  return null;
}

/** All item keys for a category catalog label (e.g. "Summon Scrolls" → summonScroll1…6). */
function cyclopediaGetInventoryKeysForCatalogLabel(catalogLabel) {
  if (!catalogLabel) return [];
  const label = String(catalogLabel).trim();
  const variants = INVENTORY_CONFIG?.variants || {};
  if (Array.isArray(variants[label]) && variants[label].length) {
    return variants[label].filter(Boolean);
  }
  if (INVENTORY_CONFIG?.staticItems?.[label] || inventoryTooltips?.[label]) return [label];
  return label ? [label] : [];
}

function resolveInventoryItemKeyByDisplayName(displayName) {
  if (!displayName) return null;
  const normalized = String(displayName).trim();
  if (INVENTORY_CONFIG?.staticItems?.[normalized]) return normalized;
  if (inventoryTooltips && typeof inventoryTooltips === 'object') {
    for (const [key, meta] of Object.entries(inventoryTooltips)) {
      if (meta?.displayName === normalized) return key;
    }
  }
  const categories = INVENTORY_CONFIG?.categories || {};
  for (const catalogLabels of Object.values(categories)) {
    if (!Array.isArray(catalogLabels)) continue;
    for (const catalogLabel of catalogLabels) {
      for (const key of cyclopediaGetInventoryKeysForCatalogLabel(catalogLabel)) {
        if (cyclopediaGetInventoryDisplayName(key) === normalized) return key;
      }
    }
  }
  for (const key of GAME_KEYS.CURRENCY) {
    if (cyclopediaGetInventoryDisplayName(key) === normalized) return key;
  }
  return null;
}

function getCyclopediaInventoryIconUrl(itemKey) {
  if (!itemKey) return null;
  const displayName = cyclopediaGetInventoryDisplayName(itemKey);
  let icon =
    inventoryTooltips?.[itemKey]?.icon ||
    inventoryTooltips?.[displayName]?.icon ||
    INVENTORY_CONFIG?.staticItems?.[itemKey]?.icon;
  if (!icon && CURRENCY_CONFIG?.[itemKey]?.icon) icon = CURRENCY_CONFIG[itemKey].icon;
  return icon || null;
}

function resolveCyclopediaEquipmentSpriteId(equipmentName) {
  if (!equipmentName) return null;
  let gameId = window.BestiaryModAPI?.utility?.maps?.equipmentNamesToGameIds?.get?.(
    String(equipmentName).toLowerCase()
  );
  if (gameId == null && globalThis.state?.utils?.getEquipment) {
    const utils = globalThis.state.utils;
    for (let i = 1; i < 1000; i++) {
      try {
        const eq = utils.getEquipment(i);
        if (eq?.metadata?.name?.toLowerCase() === String(equipmentName).toLowerCase()) {
          gameId = i;
          break;
        }
      } catch {
        // ignore
      }
    }
  }
  if (gameId == null) return null;
  try {
    const eqData = globalThis.state?.utils?.getEquipment?.(gameId);
    const spriteId = Number(eqData?.metadata?.spriteId ?? gameId);
    return Number.isFinite(spriteId) ? spriteId : gameId;
  } catch {
    return gameId;
  }
}

const CYCLOPEDIA_HOME_SEARCH_ICON_PX = 32;

/** Unwrap portrait button wrappers (Equipment / Inventory tabs). */
function cyclopediaUnwrapPortrait(el) {
  if (!el?.nodeType) return null;
  if (el.tagName === 'BUTTON' && el.firstChild?.nodeType) return el.firstChild;
  return el;
}

/** Spritesheets in modals need explicit ITEM background (Equipment tab / Room Hopper). */
function cyclopediaApplyItemSpriteBackground(root, spriteId, sizePx = CYCLOPEDIA_HOME_SEARCH_ICON_PX) {
  const id = Number(spriteId);
  if (!root || !Number.isFinite(id)) return;
  const spriteImg = root.querySelector?.('img.spritesheet');
  const viewport = spriteImg?.parentElement;
  const px = `${sizePx}px`;
  if (viewport) {
    viewport.style.backgroundImage = `url(/assets/ITEM/${id}.png)`;
    viewport.style.backgroundSize = 'auto';
    viewport.style.backgroundPosition = '0 0';
    viewport.style.backgroundRepeat = 'no-repeat';
    viewport.style.width = px;
    viewport.style.height = px;
    viewport.style.imageRendering = 'pixelated';
    viewport.style.flexShrink = '0';
  }
  if (spriteImg) spriteImg.style.display = 'none';
}

function cyclopediaFitPortraitBox(el, sizePx = CYCLOPEDIA_HOME_SEARCH_ICON_PX) {
  if (!el) return;
  const px = `${sizePx}px`;
  Object.assign(el.style, {
    width: px,
    height: px,
    minWidth: px,
    minHeight: px,
    maxWidth: px,
    maxHeight: px,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
    margin: '0'
  });
  const portrait = el.querySelector?.('.equipment-portrait');
  if (portrait) {
    ['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight'].forEach((prop) => {
      portrait.style[prop] = px;
    });
  }
}

function cyclopediaStripCreaturePortraitChrome(el) {
  if (!el) return;
  el.querySelector?.('span.pixel-font-16')?.remove();
  el.querySelector?.('img[alt="star tier"]')?.remove();
}

/** Remove stat icon only (keeps frame and rarity border). */
function cyclopediaStripEquipmentPortraitStat(root) {
  if (!root) return;
  const portrait = root.classList?.contains('equipment-portrait')
    ? root
    : root.querySelector?.('.equipment-portrait');
  if (!portrait) return;
  portrait.querySelector?.('img[alt="stat type"]')?.parentElement?.remove();
}

/** Remove rarity overlay and stat icon (keeps equipment frame). */
function cyclopediaStripEquipmentPortraitRarityAndStat(root) {
  if (!root) return;
  cyclopediaStripEquipmentPortraitStat(root);
  root.querySelectorAll?.('.has-rarity, [data-rarity]').forEach((el) => el.remove());
  const portrait = root.classList?.contains('equipment-portrait')
    ? root
    : root.querySelector?.('.equipment-portrait');
  if (!portrait) return;
  portrait.querySelector?.('.has-rarity')?.remove();
  portrait.querySelector?.('[data-rarity]')?.remove();
}

/** Remove stat, rarity bg, frame/slot chrome from createItemPortrait (home search). */
function cyclopediaStripEquipmentPortraitChrome(root) {
  if (!root) return;
  root.querySelectorAll?.('.container-slot').forEach((el) => {
    el.classList.remove('surface-darker', 'frame-pressed-1');
    el.style.background = 'none';
    el.style.border = 'none';
    el.style.borderImage = 'none';
  });
  cyclopediaStripEquipmentPortraitRarityAndStat(root);
  const portrait = root.classList?.contains('equipment-portrait')
    ? root
    : root.querySelector?.('.equipment-portrait');
  if (!portrait) return;
  portrait.classList.remove('frame-pressed-1', 'surface-darker');
  portrait.style.background = 'none';
  portrait.style.border = 'none';
  portrait.style.borderImage = 'none';
  portrait.setAttribute('data-noframes', 'true');
}

function cyclopediaResolveMonsterByName(creatureName) {
  if (!creatureName || typeof buildCyclopediaMonsterNameMap !== 'function') return null;
  const displayQuery = cyclopediaResolveCreatureQuery(creatureName);
  buildCyclopediaMonsterNameMap();
  const lookupName = (displayQuery.baseSpecies || creatureName).toLowerCase();
  const entry = cyclopediaState.monsterNameMap?.get?.(lookupName);
  if (!entry?.monster) {
    const fromDb = window.creatureDatabase?.findMonsterByName?.(lookupName);
    if (!fromDb) return null;
    const monsterId = displayQuery.gameId ?? fromDb.gameId;
    if (monsterId == null) return null;
    return { monster: fromDb, monsterId, forceShiny: displayQuery.forceShiny === true };
  }
  const monster = entry.monster;
  const monsterId = displayQuery.gameId ?? (monster.gameId !== undefined ? monster.gameId : entry.index);
  if (monsterId === undefined) return null;
  return { monster, monsterId, forceShiny: displayQuery.forceShiny === true };
}

/** gameId for /assets/portraits/{gameId}.png (all creatures, incl. bosses & unobtainables). */
function cyclopediaResolveMonsterGameId(creatureName) {
  const displayQuery = cyclopediaResolveCreatureQuery(creatureName);
  if (displayQuery.gameId != null) return displayQuery.gameId;
  const resolved = cyclopediaResolveMonsterByName(creatureName);
  if (resolved?.monsterId != null) return resolved.monsterId;
  const fromDb = window.creatureDatabase?.findMonsterByName?.(creatureName);
  return fromDb?.gameId ?? null;
}

/** Item sprite via createItemPortrait + metadata.spriteId (Equipment tab, item-type creatures). */
function cyclopediaCreateItemPortrait(spriteId, options = {}) {
  const { stat = 'ad', tier = 1, sizePx = CYCLOPEDIA_HOME_SEARCH_ICON_PX } = options;
  const id = Number(spriteId);
  if (!Number.isFinite(id) || !api?.ui?.components?.createItemPortrait) return null;
  try {
    let portrait = api.ui.components.createItemPortrait({ itemId: id, stat, tier });
    portrait = cyclopediaUnwrapPortrait(portrait);
    if (!portrait) return null;
    cyclopediaApplyItemSpriteBackground(portrait, id, sizePx);
    cyclopediaFitPortraitBox(portrait, sizePx);
    return portrait;
  } catch {
    return null;
  }
}

/** Creature portrait: always /assets/portraits/{gameId}.png (game dialog / Room Hopper). */
function cyclopediaCreateCreaturePortrait(creatureName, sizePx = CYCLOPEDIA_HOME_SEARCH_ICON_PX) {
  const gameId = cyclopediaResolveMonsterGameId(creatureName);
  if (gameId == null) return null;
  const displayQuery = cyclopediaResolveCreatureQuery(creatureName);
  const useShinyPortrait = displayQuery.forceShiny === true;
  try {
    const wrap = document.createElement('div');
    const px = `${sizePx}px`;
    wrap.style.cssText = `position: relative; width: ${px}; height: ${px}; flex: none; display: inline-block; overflow: hidden;`;
    const img = document.createElement('img');
    if (window.creatureDatabase?.getMonsterPortraitUrl) {
      img.src = window.creatureDatabase.getMonsterPortraitUrl(gameId, useShinyPortrait);
    } else {
      img.src = `/assets/portraits/${gameId}${useShinyPortrait ? '-shiny' : ''}.png`;
    }
    img.alt = creatureName || 'creature';
    img.title = creatureName || '';
    img.className = 'pixelated';
    img.width = sizePx;
    img.height = sizePx;
    img.style.cssText = 'width: 100%; height: 100%; display: block; object-fit: contain; image-rendering: pixelated;';
    img.onerror = () => { img.style.visibility = 'hidden'; };
    wrap.appendChild(img);
    return wrap;
  } catch {
    return null;
  }
}

/** Equipment in home search — same as Equipment tab (createItemPortrait), minus stat/frame/rarity. */
function cyclopediaCreateEquipmentPortrait(equipmentName, sizePx = CYCLOPEDIA_HOME_SEARCH_ICON_PX) {
  const spriteId = resolveCyclopediaEquipmentSpriteId(equipmentName);
  if (spriteId == null) return null;
  let stat = 'ad';
  try {
    const gameId = window.BestiaryModAPI?.utility?.maps?.equipmentNamesToGameIds?.get?.(
      String(equipmentName).toLowerCase()
    );
    const eqData = gameId != null ? globalThis.state?.utils?.getEquipment?.(gameId) : null;
    if (eqData?.metadata?.stat) stat = eqData.metadata.stat;
  } catch {
    // ignore
  }
  const portrait = cyclopediaCreateItemPortrait(spriteId, { stat, tier: 1, sizePx });
  if (!portrait) return null;
  cyclopediaStripEquipmentPortraitChrome(portrait);
  return portrait;
}

/** Equipment-portrait for boosted-map overlays (32×32, tier-5 rarity border, no stat). */
function cyclopediaCreateBoostedMapEquipmentPortrait(
  equipmentName,
  sizePx = CYCLOPEDIA_HOME_SEARCH_ICON_PX
) {
  const spriteId = resolveCyclopediaEquipmentSpriteId(equipmentName);
  if (spriteId == null) return null;

  const portrait = cyclopediaCreateItemPortrait(spriteId, { stat: 'ad', tier: 5, sizePx });
  if (!portrait) return null;

  cyclopediaStripEquipmentPortraitStat(portrait);

  const equipmentPortrait = portrait.classList?.contains('equipment-portrait')
    ? portrait
    : portrait.querySelector?.('.equipment-portrait');

  if (equipmentPortrait) {
    equipmentPortrait.setAttribute('data-highlighted', 'true');
    equipmentPortrait.setAttribute('data-alive', 'false');
    equipmentPortrait.setAttribute('data-noframes', 'false');
    const px = `${sizePx}px`;
    Object.assign(equipmentPortrait.style, {
      width: px,
      height: px,
      maxWidth: px,
      maxHeight: px,
      display: 'block',
      margin: '0'
    });

    let rarityEl = equipmentPortrait.querySelector('.has-rarity, [data-rarity]');
    if (!rarityEl) {
      rarityEl = document.createElement('div');
      rarityEl.className = 'has-rarity absolute inset-0 z-1 opacity-80';
      equipmentPortrait.insertBefore(rarityEl, equipmentPortrait.firstChild);
    }
    rarityEl.setAttribute('data-rarity', '5');
  }

  return portrait;
}

/** Inventory in home search — createItemPortrait (Inventory tab), minus stat/frame/rarity/slot. */
function cyclopediaCreateInventoryPortrait(itemKey, sizePx = CYCLOPEDIA_HOME_SEARCH_ICON_PX) {
  const icon = getCyclopediaInventoryIconUrl(itemKey);
  if (!icon) return null;
  if (icon.startsWith('sprite://')) {
    const spriteId = icon.replace('sprite://', '');
    if (spriteId === '23488') {
      const px = `${sizePx}px`;
      const wrap = document.createElement('div');
      wrap.style.cssText = `width: ${px}; height: ${px}; flex: none; display: inline-flex; align-items: center; justify-content: center;`;
      const img = document.createElement('img');
      img.src = '/assets/ITEM/23488.png';
      img.alt = 'Surprise Cube';
      img.className = 'pixelated';
      img.width = sizePx;
      img.height = sizePx;
      img.style.cssText = `width: ${px}; height: ${px}; image-rendering: pixelated;`;
      wrap.appendChild(img);
      return wrap;
    }
    const portrait = cyclopediaCreateItemPortrait(spriteId, { tier: 1, sizePx });
    if (!portrait) return null;
    cyclopediaStripEquipmentPortraitChrome(portrait);
    return portrait;
  }
  const img = document.createElement('img');
  img.src = icon;
  img.alt = '';
  img.className = 'pixelated';
  const px = `${sizePx}px`;
  img.style.cssText = `width: ${px}; height: ${px}; object-fit: contain; image-rendering: pixelated; flex-shrink: 0;`;
  img.onerror = () => { img.style.visibility = 'hidden'; };
  return img;
}

/** Map list thumbnails (Maps tab). */
function cyclopediaCreateMapThumbnail(mapId, alt = '', sizePx = CYCLOPEDIA_HOME_SEARCH_ICON_PX) {
  if (!mapId) return null;
  const img = document.createElement('img');
  img.src = `/assets/room-thumbnails/${mapId}.png`;
  img.alt = alt;
  img.className = 'pixelated';
  const px = `${sizePx}px`;
  img.style.cssText = `width: ${px}; height: ${px}; object-fit: cover; flex-shrink: 0;`;
  img.onerror = () => { img.style.visibility = 'hidden'; };
  return img;
}

let _cyclopediaBoostedMapToEquipment = null;

function getCyclopediaBoostedMapToEquipmentIndex() {
  if (_cyclopediaBoostedMapToEquipment) return _cyclopediaBoostedMapToEquipment;

  const byRoomId = new Map();
  const byMapName = new Map();
  const roomNameMap = globalThis.state?.utils?.ROOM_NAME || {};
  const nameToRoomId = new Map();
  Object.entries(roomNameMap).forEach(([roomId, mapName]) => {
    if (!nameToRoomId.has(mapName)) nameToRoomId.set(mapName, roomId);
  });

  for (const [equipmentName, wiki] of Object.entries(HARDCODED_BOOSTED_MAP)) {
    if (wiki === false || typeof wiki !== 'string' || !wiki.trim()) continue;
    wiki
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((mapName) => {
        if (!byMapName.has(mapName)) byMapName.set(mapName, []);
        const byNameList = byMapName.get(mapName);
        if (!byNameList.includes(equipmentName)) byNameList.push(equipmentName);

        const roomId = nameToRoomId.get(mapName);
        if (roomId) {
          if (!byRoomId.has(roomId)) byRoomId.set(roomId, []);
          const byRoomList = byRoomId.get(roomId);
          if (!byRoomList.includes(equipmentName)) byRoomList.push(equipmentName);
        }
      });
  }

  for (const list of byMapName.values()) list.sort((a, b) => a.localeCompare(b));
  for (const list of byRoomId.values()) list.sort((a, b) => a.localeCompare(b));

  _cyclopediaBoostedMapToEquipment = { byRoomId, byMapName };
  return _cyclopediaBoostedMapToEquipment;
}

function getBoostedEquipmentForRoom(roomId, roomName) {
  const idx = getCyclopediaBoostedMapToEquipmentIndex();
  if (roomId && idx.byRoomId.has(roomId)) return idx.byRoomId.get(roomId);
  if (roomName && idx.byMapName.has(roomName)) return idx.byMapName.get(roomName);
  return [];
}

function cyclopediaNavigateToEquipmentPage(equipmentName) {
  const name = String(equipmentName || '').trim();
  if (!name) return;
  if (typeof window !== 'undefined') {
    window.cyclopediaSelectedEquipment = name;
    if (typeof window.cyclopediaHomeSearchNavigate === 'function') {
      window.cyclopediaHomeSearchNavigate({ type: 'equipment', name });
      return;
    }
    if (typeof window.__cyclopediaOpen === 'function') {
      window.__cyclopediaOpen({ equipment: name });
    }
  }
}

function appendCyclopediaBoostedEquipmentOverlay(
  thumbnailContainer,
  roomId,
  roomName,
  { iconSizePx = CYCLOPEDIA_HOME_SEARCH_ICON_PX, gapPx = 2, paddingPx = 4 } = {}
) {
  const equipmentNames = getBoostedEquipmentForRoom(roomId, roomName);
  if (!equipmentNames.length || !thumbnailContainer) return;

  const px = `${iconSizePx}px`;
  const overlay = document.createElement('div');
  overlay.className = 'cyclopedia-boosted-map-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: ${paddingPx}px;
    right: ${paddingPx}px;
    display: flex;
    flex-wrap: wrap;
    flex-direction: row-reverse;
    justify-content: flex-start;
    align-items: flex-start;
    gap: ${gapPx}px;
    max-width: calc(100% - ${paddingPx * 2}px);
    z-index: 2;
    pointer-events: none;
  `;

  equipmentNames.forEach((equipmentName) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = `Boosted map item: ${equipmentName}`;
    btn.style.cssText = `
      pointer-events: auto;
      padding: 0;
      margin: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      line-height: 0;
      width: ${px};
      height: ${px};
      min-width: ${px};
      min-height: ${px};
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: transform 0.1s;
    `;

    const portrait = cyclopediaCreateBoostedMapEquipmentPortrait(equipmentName, iconSizePx);
    if (portrait) {
      btn.appendChild(portrait);
    } else {
      btn.textContent = '?';
      btn.style.fontSize = '10px';
      btn.style.color = '#ffe066';
      btn.style.background = 'rgba(0, 0, 0, 0.65)';
      btn.style.border = '1px solid #555';
      btn.style.borderRadius = '2px';
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      cyclopediaNavigateToEquipmentPage(equipmentName);
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.08)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
    overlay.appendChild(btn);
  });

  thumbnailContainer.appendChild(overlay);
}

function cyclopediaMountSearchEntryPortrait(iconSlot, result) {
  const sizePx = CYCLOPEDIA_HOME_SEARCH_ICON_PX;
  let portrait = null;
  switch (result.kind) {
    case 'map':
      portrait = cyclopediaCreateMapThumbnail(result.target?.mapId, result.label, sizePx);
      break;
    case 'ability':
    case 'creature':
      portrait = cyclopediaCreateCreaturePortrait(result.label, sizePx);
      break;
    case 'equipment':
      portrait = cyclopediaCreateEquipmentPortrait(result.label, sizePx);
      break;
    case 'inventoryItem': {
      const itemKey =
        result.itemKey ||
        result.target?.itemKey ||
        resolveInventoryItemKeyByDisplayName(result.label);
      if (itemKey) portrait = cyclopediaCreateInventoryPortrait(itemKey, sizePx);
      break;
    }
    case 'inventoryCategory':
      portrait = cyclopediaCreateInventoryPortrait('outfitBag1', sizePx);
      break;
    default:
      break;
  }
  if (portrait) iconSlot.appendChild(portrait);
  return !!portrait;
}

function appendCyclopediaHomeSearchEntryCell(tdEntry, result) {
  const wrap = document.createElement('span');
  wrap.style.cssText = 'display: inline-flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%;';
  const iconSlot = document.createElement('span');
  iconSlot.style.cssText =
    'flex-shrink: 0; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden;';

  cyclopediaMountSearchEntryPortrait(iconSlot, result);

  wrap.appendChild(iconSlot);
  const nameSpan = document.createElement('span');
  nameSpan.textContent = result.label;
  nameSpan.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
  wrap.appendChild(nameSpan);
  tdEntry.appendChild(wrap);
}

function renderCyclopediaSearchColumn() {
  const container = document.createElement('div');
  Object.assign(container.style, {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'stretch',
    alignItems: 'stretch',
    padding: '0',
    width: '100%',
    minHeight: '0',
    height: '100%'
  });

  const title = DOMUtils.createTitle(CYCLOPEDIA_UI.searchTitle);
  container.appendChild(title);

  const panel = document.createElement('div');
  panel.className = 'frame-pressed-1 surface-dark';
  Object.assign(panel.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: '1 1 0',
    minHeight: '0',
    padding: '10px',
    boxSizing: 'border-box'
  });

  const filterBar = document.createElement('div');
  filterBar.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; align-items: center;';

  const searchInput = document.createElement('input');
  searchInput.id = CYCLOPEDIA_HOME_SEARCH_INPUT_ID;
  searchInput.type = 'text';
  searchInput.placeholder = CYCLOPEDIA_UI.searchPlaceholder;
  searchInput.title = CYCLOPEDIA_UI.searchTooltip;
  searchInput.autocomplete = 'off';
  searchInput.autocapitalize = 'off';
  searchInput.spellcheck = false;
  searchInput.setAttribute('autocomplete', 'off');
  searchInput.setAttribute('name', `cyclopedia-home-search-${Date.now()}`);
  searchInput.className = CYCLOPEDIA_HOME_SEARCH_FILTER_CONTROL_CLASS;
  searchInput.style.cssText = CYCLOPEDIA_HOME_SEARCH_FILTER_INPUT_STYLE;
  filterBar.appendChild(searchInput);

  const kindSelect = document.createElement('select');
  kindSelect.className = CYCLOPEDIA_HOME_SEARCH_FILTER_CONTROL_CLASS;
  kindSelect.style.cssText = CYCLOPEDIA_HOME_SEARCH_FILTER_SELECT_STYLE;
  CYCLOPEDIA_HOME_SEARCH_TYPE_OPTIONS.forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    kindSelect.appendChild(opt);
  });
  filterBar.appendChild(kindSelect);

  panel.appendChild(filterBar);

  const tableWrap = document.createElement('div');
  tableWrap.style.cssText = `
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #555 #1a1a1a;
  `;

  const table = document.createElement('table');
  table.className =
    'pixel-font-16 frame-pressed-1 w-full caption-bottom border-separate border-spacing-0 text-whiteRegular';
  Object.assign(table.style, {
    width: '100%',
    tableLayout: 'fixed'
  });
  const thClass =
    'bg-grayDark px-1 text-whiteHighlight table-frame-bottom sticky top-0 z-10 font-normal';
  const { entry: colEntry, type: colType, details: colDetails } = CYCLOPEDIA_HOME_SEARCH_COL_WIDTHS;
  table.innerHTML = `
    <colgroup>
      <col style="width: ${colEntry}">
      <col style="width: ${colType}">
      <col style="width: ${colDetails}">
    </colgroup>
    <thead class="${FONT_SMALL_CLASS}">
      <tr>
        <th class="${thClass}" style="text-align: left; width: ${colEntry};">Entry</th>
        <th class="${thClass}" style="text-align: left; width: ${colType};">Type</th>
        <th class="${thClass}" style="text-align: left; width: ${colDetails};">Details</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  tableWrap.appendChild(table);
  panel.appendChild(tableWrap);
  container.appendChild(panel);

  const tbody = table.querySelector('tbody');

  let abilityRefreshToken = 0;
  let pendingNavigateTarget = null;
  let pendingNavigatePollId = null;
  let searchDebounceTimer = null;

  function abortBackgroundWorkForPriorityNavigation() {
    try { abilityRefreshToken++; } catch { /* ignore */ }
    try {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    } catch { /* ignore */ }
    try {
      if (CyclopediaHomeSearch?.abortAbilityIndexing) CyclopediaHomeSearch.abortAbilityIndexing();
      if (CyclopediaHomeSearch?.abortEquipmentEffectIndexing) CyclopediaHomeSearch.abortEquipmentEffectIndexing();
    } catch { /* ignore */ }
  }

  function requestPriorityNavigate(target) {
    abortBackgroundWorkForPriorityNavigation();
    pendingNavigateTarget = target;
    try {
      const navNow = typeof window !== 'undefined' ? window.cyclopediaHomeSearchNavigate : null;
      if (typeof navNow === 'function') {
        pendingNavigateTarget = null;
        navNow(target);
        return;
      }
    } catch { /* ignore */ }
    try { openCyclopediaModal({ fromHomeSearch: true, force: true }); } catch { /* ignore */ }
    if (pendingNavigatePollId) return;
    const startedAt = Date.now();
    const poll = () => {
      pendingNavigatePollId = null;
      if (!pendingNavigateTarget) return;
      let nav = null;
      try { nav = typeof window !== 'undefined' ? window.cyclopediaHomeSearchNavigate : null; } catch { nav = null; }
      if (typeof nav === 'function') {
        const t = pendingNavigateTarget;
        pendingNavigateTarget = null;
        try { nav(t); } catch (e) { console.warn('[Cyclopedia] HomeSearch: error navigating:', e); }
        return;
      }
      if (Date.now() - startedAt > 5000) {
        pendingNavigateTarget = null;
        return;
      }
      pendingNavigatePollId = setTimeout(poll, 50);
    };
    pendingNavigatePollId = setTimeout(poll, 50);
  }

  const CYCLOPEDIA_HOME_SEARCH_ROW_CLASS =
    'group/row odd:bg-grayBrightest even:bg-grayHighlight hover:bg-whiteDarkest hover:text-whiteBrightest';

  function styleHomeSearchRow(tr, { clickable = false } = {}) {
    tr.className = clickable
      ? `${CYCLOPEDIA_HOME_SEARCH_ROW_CLASS} cursor-pointer`
      : CYCLOPEDIA_HOME_SEARCH_ROW_CLASS;
  }

  function setTableMessage(text) {
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    styleHomeSearchRow(tr);
    const td = document.createElement('td');
    td.colSpan = 3;
    td.className = 'px-1 text-whiteRegular';
    td.textContent = text;
    td.style.textAlign = 'center';
    td.style.padding = '16px 8px';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function renderTableRows(results) {
    if (!results || results.length === 0) {
      setTableMessage('No results match the current filters.');
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const r of results) {
      const tr = document.createElement('tr');
      tr.dataset.homeSearchResult = 'true';
      styleHomeSearchRow(tr, { clickable: true });
      tr.addEventListener('click', (e) => {
        e.stopPropagation();
        try { requestPriorityNavigate(r.target); } catch (err) {
          console.warn('[Cyclopedia] HomeSearch: error navigating:', err);
        }
      });

      const tdEntry = document.createElement('td');
      tdEntry.className = 'px-1 text-whiteRegular align-middle';
      Object.assign(tdEntry.style, {
        width: CYCLOPEDIA_HOME_SEARCH_COL_WIDTHS.entry,
        maxWidth: CYCLOPEDIA_HOME_SEARCH_COL_WIDTHS.entry,
        overflow: 'hidden'
      });
      appendCyclopediaHomeSearchEntryCell(tdEntry, r);
      tr.appendChild(tdEntry);

      const tdType = document.createElement('td');
      tdType.className =
        'px-1 text-whiteRegular pixel-font-14 align-middle table-frame-left whitespace-nowrap';
      Object.assign(tdType.style, {
        width: CYCLOPEDIA_HOME_SEARCH_COL_WIDTHS.type,
        maxWidth: CYCLOPEDIA_HOME_SEARCH_COL_WIDTHS.type,
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      });
      tdType.textContent = r.kindLabel || CYCLOPEDIA_UI.resultBadge;
      tr.appendChild(tdType);

      const tdDetails = document.createElement('td');
      tdDetails.className =
        'px-1 text-whiteRegular pixel-font-14 align-middle table-frame-left';
      Object.assign(tdDetails.style, {
        width: CYCLOPEDIA_HOME_SEARCH_COL_WIDTHS.details,
        maxWidth: CYCLOPEDIA_HOME_SEARCH_COL_WIDTHS.details,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      });
      tdDetails.textContent = r.subtitle || '—';
      tdDetails.title = r.subtitle || '';
      tr.appendChild(tdDetails);

      fragment.appendChild(tr);
    }
    tbody.replaceChildren(fragment);
  }

  function renderResults(query) {
    const qTrim = (query || '').trim();
    const wantsEffectIndexing = qTrim.length >= 3;
    const abilityReady = wantsEffectIndexing
      ? (typeof CyclopediaHomeSearch.isAbilityIndexReady === 'function' ? CyclopediaHomeSearch.isAbilityIndexReady() : true)
      : true;
    const equipmentEffectReady = wantsEffectIndexing
      ? (typeof CyclopediaHomeSearch.isEquipmentEffectIndexReady === 'function'
          ? CyclopediaHomeSearch.isEquipmentEffectIndexReady()
          : true)
      : true;

    if (wantsEffectIndexing && (!abilityReady || !equipmentEffectReady)) {
      const token = ++abilityRefreshToken;
      const waits = [];
      if (!abilityReady && CyclopediaHomeSearch.ensureAbilityIndexReady) {
        waits.push(CyclopediaHomeSearch.ensureAbilityIndexReady());
      }
      if (!equipmentEffectReady && CyclopediaHomeSearch.ensureEquipmentEffectIndexReady) {
        waits.push(CyclopediaHomeSearch.ensureEquipmentEffectIndexReady());
      }
      Promise.all(waits).then(() => {
        if (token !== abilityRefreshToken) return;
        if ((searchInput.value || '') !== query) return;
        renderResults(query);
      });
    }

    if (!query || qTrim.length < 2) {
      setTableMessage(CYCLOPEDIA_UI.emptyStateMinChars);
      return;
    }

    let { results } = CyclopediaHomeSearch.search(query);
    results = applyCyclopediaHomeSearchFilters(results, {
      kindFilter: kindSelect.value || null
    });

    if (!results.length) {
      if (wantsEffectIndexing && (!abilityReady || !equipmentEffectReady)) {
        setTableMessage(CYCLOPEDIA_UI.indexingAbility);
      } else setTableMessage(CYCLOPEDIA_UI.noResults);
      return;
    }

    renderTableRows(results);
  }

  const recompute = () => renderResults(searchInput.value || '');

  searchInput.addEventListener('input', () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(recompute, 150);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      recompute();
      searchInput.blur();
    } else if (e.key === 'Enter') {
      const first = tbody.querySelector('tr[data-home-search-result="true"]');
      if (first) first.click();
    }
  });
  kindSelect.addEventListener('change', recompute);
  setTableMessage(CYCLOPEDIA_UI.emptyStateMinChars);

  try {
    if (CyclopediaHomeSearch.startEquipmentEffectIndexing) CyclopediaHomeSearch.startEquipmentEffectIndexing();
  } catch { /* ignore */ }

  return container;
}

/** BIS equipment max: one tier-5 roll per stat (hp, ad, ap) for each non-event equipment in the catalog. */
function getBisEquipmentMaxFromDatabase() {
  const db = window.equipmentDatabase;
  const progressNames = typeof db?.getBisProgressEquipmentNames === 'function'
    ? db.getBisProgressEquipmentNames(getCyclopediaAllEquipmentNames())
    : getCyclopediaAllEquipmentNames().filter((name) => !db?.isEventEquipmentName?.(name));
  if (progressNames.length > 0) {
    return progressNames.length * 3;
  }
  return CYCLOPEDIA_SETTINGS.playerStatCaps.bisEquipments;
}

/** Obtainable creature count for shiny progress (excludes event/gazer species; see creature-database getShinyProgressCreatureNames). */
function getObtainableCreatureCountFromDatabase() {
  const db = window.creatureDatabase;
  if (typeof db?.getShinyProgressCreatureNames === 'function') {
    return db.getShinyProgressCreatureNames().length;
  }
  return (db?.ALL_CREATURES || []).filter((name) => {
    if (!name || HIDE_FROM_CYCLOPEDIA.includes(name)) return false;
    if (typeof db?.isEventCreatureName === 'function' && db.isEventCreatureName(name)) return false;
    if (typeof db?.isGazerCreatureName === 'function' && db.isGazerCreatureName(name)) return false;
    if (typeof db?.creatureHasShinyVariant === 'function' && !db.creatureHasShinyVariant(name)) return false;
    return true;
  }).length;
}

/** Unique obtainable species (gameId) with at least one shiny owned; event/gazer shinies excluded. */
function countUniqueObtainableShinyCreatureGameIds(monsters) {
  if (!Array.isArray(monsters)) return 0;
  const db = window.creatureDatabase;
  const progressNames = typeof db?.getShinyProgressCreatureNames === 'function'
    ? db.getShinyProgressCreatureNames()
    : (db?.ALL_CREATURES || []).filter((name) => {
      if (!name || HIDE_FROM_CYCLOPEDIA.includes(name)) return false;
      if (typeof db?.isEventCreatureName === 'function' && db.isEventCreatureName(name)) return false;
      if (typeof db?.isGazerCreatureName === 'function' && db.isGazerCreatureName(name)) return false;
      if (typeof db?.creatureHasShinyVariant === 'function' && !db.creatureHasShinyVariant(name)) return false;
      return true;
    });
  const obtainableLower = new Set(progressNames.map((n) => n.toLowerCase()));
  const ids = new Set();
  for (const m of monsters) {
    if (!m || m.shiny !== true || m.gameId == null) continue;
    let name = null;
    if (db?.findMonsterByGameId) {
      const monster = db.findMonsterByGameId(m.gameId);
      name = monster?.metadata?.name;
    } else if (globalThis.state?.utils?.getMonster) {
      try {
        const monster = globalThis.state.utils.getMonster(m.gameId);
        name = monster?.metadata?.name;
      } catch (e) {}
    }
    if (name && obtainableLower.has(name.toLowerCase())) {
      ids.add(m.gameId);
    }
  }
  return ids.size;
}

/** Unique event species names with at least one shiny owned; excluded from shiny progress total. */
function getUniqueOwnedEventShinyCreatureNames(monsters) {
  if (!Array.isArray(monsters)) return [];
  const db = window.creatureDatabase;
  const namesByGameId = new Map();
  for (const m of monsters) {
    if (!m || m.shiny !== true || m.gameId == null) continue;
    let name = null;
    if (typeof db?.getDisplayNameForOwnedMonster === 'function') {
      name = db.getDisplayNameForOwnedMonster(m);
    }
    if (!name && db?.findMonsterByGameId) {
      const monster = db.findMonsterByGameId(m.gameId);
      name = monster?.metadata?.name;
    } else if (!name && globalThis.state?.utils?.getMonster) {
      try {
        const monster = globalThis.state.utils.getMonster(m.gameId);
        name = monster?.metadata?.name;
      } catch (e) {}
    }
    if (name && typeof db?.isEventCreatureName === 'function' && db.isEventCreatureName(name)) {
      namesByGameId.set(m.gameId, name);
    }
  }
  return [...namesByGameId.values()].sort((a, b) => a.localeCompare(b));
}

/** Unique event species (gameId) with at least one shiny owned; excluded from shiny progress total. */
function countUniqueEventShinyCreatureGameIds(monsters) {
  return getUniqueOwnedEventShinyCreatureNames(monsters).length;
}

const CYCLOPEDIA_MAX_VALUES = CYCLOPEDIA_SETTINGS.playerStatCaps;

const CYCLOPEDIA_PROGRESS_STATS = [
  { key: 'perfectCreatures', icon: '/assets/icons/enemy.png', max: CYCLOPEDIA_MAX_VALUES.perfectCreatures },
  { key: 'shinyCreatures', icon: 'https://bestiaryarena.com/assets/icons/shiny-star.png', max: getObtainableCreatureCountFromDatabase },
  { key: 'bisEquipments', icon: '/assets/icons/equips.png', max: getBisEquipmentMaxFromDatabase },
  { key: 'raids', icon: '/assets/icons/raid.png', max: CYCLOPEDIA_MAX_VALUES.raids },
  { key: 'exploredMaps', icon: '/assets/icons/map.png', max: CYCLOPEDIA_MAX_VALUES.exploredMaps },
  { key: 'bagOutfits', icon: '/assets/icons/mini-outfitbag.png', max: CYCLOPEDIA_MAX_VALUES.bagOutfits }
];

const CYCLOPEDIA_PROFILE_VALUE = {
  shell: { value: d => d.shell },
  tasks: { value: d => d.tasks },
  playCount: { value: d => d.playCount },
  perfectCreatures: { value: d => d.perfectMonsters },
  shinyCreatures: {
    value: (d) => {
      const ctx = globalThis.state?.player?.getSnapshot?.()?.context;
      if (d?.name && ctx?.name && d.name === ctx.name && Array.isArray(ctx.monsters)) {
        return countUniqueObtainableShinyCreatureGameIds(ctx.monsters);
      }
      if (typeof d.uniqueShinyCreatures === 'number') return d.uniqueShinyCreatures;
      return null;
    }
  },
  shinyEventCreatures: {
    value: (d) => {
      const ctx = globalThis.state?.player?.getSnapshot?.()?.context;
      if (d?.name && ctx?.name && d.name === ctx.name && Array.isArray(ctx.monsters)) {
        return countUniqueEventShinyCreatureGameIds(ctx.monsters);
      }
      return null;
    }
  },
  shinyEventCreatureNames: {
    value: (d) => {
      const ctx = globalThis.state?.player?.getSnapshot?.()?.context;
      if (d?.name && ctx?.name && d.name === ctx.name && Array.isArray(ctx.monsters)) {
        return getUniqueOwnedEventShinyCreatureNames(ctx.monsters);
      }
      return null;
    }
  },
  bisEquipments: { value: d => d.bisEquips },
  raids: { value: d => d.raids },
  exploredMaps: { value: d => d.maps },
  bagOutfits: { value: d => d.ownedOutfits },
  rankPoints: { value: d => d.rankPoints },
  timeSum: { value: d => d.ticks },
  floorsSum: { value: d => d.floors },
  createdAt: { value: d => FormatUtils.date(d.createdAt) },
  level: { value: d => (typeof d.exp === 'number' ? Math.floor(d.exp / 400) + 1 : '?') },
  xp: { value: d => d.exp },
  name: { value: d => d.name },
  premium: { value: d => (d.premium ? CYCLOPEDIA_UI.statusPremium : CYCLOPEDIA_UI.statusFree) },
  loyaltyPoints: { value: d => d.loyaltyPoints }
};

  if (!DOMCache.get('#cyclopedia-maxed-style')) {
    const style = document.createElement('style');
    style.id = 'cyclopedia-maxed-style';
  style.textContent = `.stat-maxed { color: #3ecf4a !important; }`;
  document.head.appendChild(style);
}

function renderCyclopediaPlayerInfo(profileData, options = {}) {
  try {
    const { showShinyCreatures = true, compact = false, season } = options;
    if (profileData && profileData.json) profileData = profileData.json;
    if (!profileData) {
      const div = document.createElement('div');
      div.innerHTML = `<span style="color: #ff6b6b;">${CYCLOPEDIA_UI.noProfileData}</span>`;
      return div;
    }

  function getProfileValue(key) {
    if (CYCLOPEDIA_PROFILE_VALUE[key] && typeof CYCLOPEDIA_PROFILE_VALUE[key].value === 'function') {
      return CYCLOPEDIA_PROFILE_VALUE[key].value(profileData);
    }
    return profileData[key] !== undefined ? profileData[key] : '-';
  }

  function addRow({ label, icon, iconConfig, value, highlight, colspan, title, extraIcon, tooltip, valueClass, rankingKey, sectionHeader, valueSuffix }) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-highlight', highlight ? 'true' : 'false');
    if (rankingKey) tr.dataset.cyclopediaRankingRow = rankingKey;
    if (sectionHeader) tr.dataset.cyclopediaSectionHeader = sectionHeader;
    tr.className = 'group/row odd:bg-grayBrightest even:bg-grayHighlight hover:bg-whiteDarkest hover:text-whiteBrightest data-[highlight=\'true\']:bg-whiteDarkest data-[highlight=\'true\']:text-whiteBrightest';
    if (colspan) {
      const td = document.createElement('td');
      td.className = highlight ? 'bg-grayDark px-1 text-whiteHighlight table-frame-bottom' : 'bg-grayDark px-1 text-whiteHighlight table-frame-y';
      td.colSpan = colspan;
      td.textContent = label;
      tr.appendChild(td);
    } else {
      const td1 = document.createElement('td');
      td1.className = 'bg-grayRegular px-1 text-whiteRegular group-hover/row:bg-grayHighlight';
      if (icon) {
        const img = document.createElement('img');
        img.alt = label;
        img.src = typeof icon === 'string' ? icon : icon.src;
        img.className = iconConfig?.className || (typeof icon === 'object' && icon.className) || 'pixelated mr-1 inline-block -translate-y-0.5';
        img.width = iconConfig?.width || (typeof icon === 'object' && icon.width) || 11;
        img.height = iconConfig?.height || (typeof icon === 'object' && icon.height) || 11;
        td1.appendChild(img);
      }
      td1.appendChild(document.createTextNode(label));
      const td2 = document.createElement('td');
      td2.className = 'px-1 align-middle [&:not(:first-child)]:table-frame-left text-center';
      if (title) td2.title = title;
      if (valueSuffix) {
        td2.appendChild(document.createTextNode(value));
        const suffixEl = document.createElement('span');
        suffixEl.textContent = valueSuffix.text;
        if (valueSuffix.title) suffixEl.title = valueSuffix.title;
        td2.appendChild(suffixEl);
      } else {
        td2.textContent = value;
      }
      if (valueClass) td2.classList.add(valueClass);
      if (extraIcon) {
        const extraImg = document.createElement('img');
        extraImg.alt = extraIcon.alt;
        extraImg.src = extraIcon.src;
        extraImg.width = extraIcon.width || 11;
        extraImg.height = extraIcon.height || 11;
        extraImg.className = extraIcon.className || 'pixelated inline-block -translate-y-0.5';
        td2.appendChild(extraImg);
      }
      if (tooltip) {
        td2.title = tooltip;
      }
      tr.appendChild(td1);
      tr.appendChild(td2);
    }
    tbody.appendChild(tr);
  }

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '0';
  container.style.width = '100%';
  if (compact) {
    container.style.boxSizing = 'border-box';
    container.style.marginTop = '0';
  }

  const infoBox = document.createElement('div');
  infoBox.className = 'widget-top widget-top-text flex items-center gap-1';
  infoBox.style.marginBottom = '0';
  if (compact) infoBox.style.marginTop = '0';
  const infoIcon = document.createElement('img');
  infoIcon.alt = CYCLOPEDIA_UI.accountAlt;
  infoIcon.src = '/assets/icons/migrate.png';
  infoIcon.className = 'pixelated inline-block translate-y-px';
  infoIcon.width = 13;
  infoIcon.height = 13;
  infoBox.appendChild(infoIcon);
  const infoTitle = document.createElement('span');
  infoTitle.textContent = CYCLOPEDIA_UI.playerInformation;
  infoBox.appendChild(infoTitle);
  container.appendChild(infoBox);

  const infoContent = document.createElement('div');
  infoContent.className = 'widget-bottom';
  const topGrid = document.createElement('div');
  topGrid.className = 'grid grid-cols-[min-content_1fr] items-center gap-2';
  const avatarSlot = document.createElement('div');
  avatarSlot.className = 'container-slot surface-darker relative p-0.5';
  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'relative z-1 h-sprite w-sprite';
  const avatarImg = document.createElement('img');
  avatarImg.src = 'https://bestiaryarena.com/assets/logo.png';
  avatarImg.alt = CYCLOPEDIA_UI.playerIconAlt;
  const avatarSize = compact ? 28 : 32;
  avatarImg.width = avatarSize;
  avatarImg.height = avatarSize;
  avatarImg.style.width = avatarSize + 'px';
  avatarImg.style.height = avatarSize + 'px';
  avatarImg.style.display = 'block';
  avatarImg.style.margin = 'auto';
  avatarImg.className = 'pixelated';
  avatarWrap.appendChild(avatarImg);
  avatarSlot.appendChild(avatarWrap);
  topGrid.appendChild(avatarSlot);
  const nameCol = document.createElement('div');
  nameCol.className = 'truncate pb-px pr-0.5';
  const nameP = document.createElement('p');
  nameP.className = 'line-clamp-1 text-whiteExp animate-in fade-in';
  nameP.textContent = getProfileValue('name') || CYCLOPEDIA_UI.playerFallback;
  nameCol.appendChild(nameP);
  const levelRow = document.createElement('div');
  levelRow.className = 'flex justify-between gap-2';
      levelRow.title = FormatUtils.number(getProfileValue('xp')) + ' exp';
  const levelLabel = document.createElement('span');
  levelLabel.className = 'pixel-font-14 text-whiteRegular';
  levelLabel.textContent = CYCLOPEDIA_UI.level;
  const levelValue = document.createElement('span');
  levelValue.className = 'text-whiteExp animate-in fade-in';
      levelValue.textContent = FormatUtils.number(getProfileValue('level'));
  levelRow.appendChild(levelLabel);
  levelRow.appendChild(levelValue);
  nameCol.appendChild(levelRow);
  const expBarWrap = document.createElement('div');
  expBarWrap.className = 'frame-pressed-1';
  const expBarOuter = document.createElement('div');
  expBarOuter.className = 'relative h-1 w-full bg-black';
  const expBarInnerWrap = document.createElement('div');
  expBarInnerWrap.className = 'absolute left-0 top-0 flex h-full w-full';
  const expBarFill = document.createElement('div');
  expBarFill.className = 'h-full shrink-0 bg-expBar';
  let exp = getProfileValue('xp');
  let expBarWidth = 0;
  if (typeof exp === 'number' && exp > 0) {
    expBarWidth = Math.min(100, Math.round((exp % 400) / 400 * 100));
  }
  expBarFill.style.width = expBarWidth + '%';
  expBarInnerWrap.appendChild(expBarFill);
  expBarOuter.appendChild(expBarInnerWrap);
  expBarWrap.appendChild(expBarOuter);
  nameCol.appendChild(expBarWrap);
  topGrid.appendChild(nameCol);
  infoContent.appendChild(topGrid);
  const sep1 = document.createElement('div');
  sep1.setAttribute('role', 'none');
  sep1.className = 'separator mb-1';
  infoContent.appendChild(sep1);
  const grid2 = document.createElement('div');
  grid2.className = 'grid grid-cols-3 gap-1';
  const createdDiv = document.createElement('div');
  const createdLabel = document.createElement('div');
  createdLabel.className = FONT_CONSTANTS.SIZES.SMALL;
  createdLabel.textContent = CYCLOPEDIA_UI.stats.createdAt;
  const createdValue = document.createElement('div');
  createdValue.className = 'text-whiteHighlight';
  createdValue.textContent = getProfileValue('createdAt');
  createdDiv.appendChild(createdLabel);
  createdDiv.appendChild(createdValue);
  createdDiv.style.textAlign = 'center';
  grid2.appendChild(createdDiv);
  const statusDiv = document.createElement('div');
  const statusLabel = document.createElement('div');
  statusLabel.className = FONT_CONSTANTS.SIZES.SMALL;
  statusLabel.textContent = CYCLOPEDIA_UI.stats.premium;
  const statusGrid = document.createElement('div');
  statusGrid.className = 'grid grid-cols-[min-content_1fr] gap-1 text-whiteHighlight';
  const statusIconWrap = document.createElement('div');
  statusIconWrap.className = 'relative h-full w-[22px]';
  const statusIcon = document.createElement('img');
  statusIcon.alt = CYCLOPEDIA_UI.premiumPassAlt;
  statusIcon.src = profileData.premium ? '/assets/icons/premium-yes.png' : '/assets/icons/premium-no.png';
  statusIcon.className = 'pixelated absolute -bottom-0.5 left-0';
  statusIcon.width = 22;
  statusIcon.height = 19;
  statusIconWrap.appendChild(statusIcon);
  statusGrid.appendChild(statusIconWrap);
  const statusText = document.createElement('span');
  statusText.className = profileData.premium ? 'text-ally' : 'text-villain';
  statusText.textContent = profileData.premium ? CYCLOPEDIA_UI.statusPremium : CYCLOPEDIA_UI.statusFree;
  statusGrid.appendChild(statusText);
  statusDiv.appendChild(statusLabel);
  statusDiv.appendChild(statusGrid);
  statusLabel.style.textAlign = 'center';
  statusGrid.style.justifyItems = 'start';
  grid2.appendChild(statusDiv);
  const loyaltyDiv = document.createElement('div');
  const loyaltyLabel = document.createElement('div');
  loyaltyLabel.className = FONT_CONSTANTS.SIZES.SMALL;
  loyaltyLabel.textContent = CYCLOPEDIA_UI.loyaltyPoints;
  const loyaltyValue = document.createElement('div');
  loyaltyValue.className = 'text-whiteHighlight';
  let loyaltyPoints = getProfileValue('loyaltyPoints');
  // Only fallback to current user's game state if we're displaying the current user's own profile
  // For searched players, we should only show what's available from the API
  if ((loyaltyPoints === '-' || loyaltyPoints === undefined) && profileData.name === globalThis.state?.player?.getSnapshot?.()?.context?.name) {
    loyaltyPoints = globalThis.state?.player?.getSnapshot?.()?.context?.loyaltyPoints ?? '-';
  }
  loyaltyValue.textContent = FormatUtils.number(loyaltyPoints);
  loyaltyDiv.appendChild(loyaltyLabel);
  loyaltyDiv.appendChild(loyaltyValue);
  loyaltyDiv.style.textAlign = 'center';
  grid2.appendChild(loyaltyDiv);
  infoContent.appendChild(grid2);
  container.appendChild(infoContent);

  const statsBox = document.createElement('div');
  statsBox.className = 'widget-top widget-top-text flex items-center gap-1 whitespace-nowrap';
  const statsIcon = document.createElement('img');
  statsIcon.alt = CYCLOPEDIA_UI.accountAlt;
  statsIcon.src = '/assets/icons/progress.png';
  statsIcon.className = 'pixelated inline-block translate-y-px';
  statsIcon.width = 12;
  statsIcon.height = 12;
  statsBox.appendChild(statsIcon);
  const statsTitle = document.createElement('span');
  statsTitle.textContent = CYCLOPEDIA_UI.playerStats;
  statsBox.appendChild(statsTitle);
  container.appendChild(statsBox);

  const statsTableWrap = document.createElement('div');
  statsTableWrap.className = 'widget-bottom';
  const statsTable = document.createElement('table');
  statsTable.className = (compact ? FONT_CONSTANTS.SIZES.SMALL : FONT_CONSTANTS.SIZES.BODY) + ' frame-pressed-1 w-full caption-bottom border-separate border-spacing-0 text-whiteRegular';
  const tbody = document.createElement('tbody');
  if (!compact) tbody.className = 'whitespace-nowrap';

  addRow({ label: CYCLOPEDIA_UI.currentTotal, highlight: true, colspan: 2 });
  addRow({ label: CYCLOPEDIA_UI.stats.shell, icon: '/assets/icons/shell-count.png', value: (getProfileValue('shell') !== undefined ? FormatUtils.number(getProfileValue('shell')) + 'x' : '-') });
  addRow({ label: CYCLOPEDIA_UI.stats.tasks, icon: '/assets/icons/task-count.png', value: (getProfileValue('tasks') !== undefined ? FormatUtils.number(getProfileValue('tasks')) + 'x' : '-') });
  addRow({ label: CYCLOPEDIA_UI.stats.playCount, icon: '/assets/icons/match-count.png', value: (getProfileValue('playCount') !== undefined ? FormatUtils.number(getProfileValue('playCount')) + 'x' : '-') });

  addRow({ label: CYCLOPEDIA_UI.progress, highlight: true, colspan: 2 });
  const progressStats = showShinyCreatures
    ? CYCLOPEDIA_PROGRESS_STATS
    : CYCLOPEDIA_PROGRESS_STATS.filter((stat) => stat.key !== 'shinyCreatures');

  progressStats.forEach(stat => {
    const val = getProfileValue(stat.key);
    const maxVal = typeof stat.max === 'function' ? stat.max() : stat.max;
    const isMax = typeof val === 'number' && val === maxVal;
    let valueStr = (val === null || val === undefined || val === '-')
      ? `-/${maxVal}`
      : `${FormatUtils.number(val)}/${maxVal}`;
    let valueSuffix;
    if (stat.key === 'shinyCreatures' && typeof val === 'number') {
      const eventShinyNames = getProfileValue('shinyEventCreatureNames');
      const eventShinyCount = Array.isArray(eventShinyNames)
        ? eventShinyNames.length
        : getProfileValue('shinyEventCreatures');
      if (typeof eventShinyCount === 'number' && eventShinyCount > 0) {
        valueSuffix = {
          text: ` (+${FormatUtils.number(eventShinyCount)})`,
          title: Array.isArray(eventShinyNames) && eventShinyNames.length
            ? eventShinyNames.join('\n')
            : undefined
        };
      }
    }
    addRow({
      label: CYCLOPEDIA_UI.stats[stat.key] ?? stat.key,
      icon: stat.icon,
      value: valueStr,
      valueSuffix,
      valueClass: isMax ? 'stat-maxed' : undefined
    });
  });

  addRow({
    label: getCyclopediaRankingsSectionLabel(season),
    highlight: true,
    colspan: 2,
    sectionHeader: season != null ? 'rankings' : undefined
  });
  addRow({
    label: CYCLOPEDIA_UI.stats.rankPoints,
    icon: '/assets/icons/star-tier.png',
    rankingKey: 'rankPoints',
    value: (() => {
      const v = getProfileValue('rankPoints');
      return v !== undefined && v !== null ? FormatUtils.number(v) : cyclopediaSeasonNA();
    })(),
    title: profileData.rankPointsPosition !== undefined ? String(profileData.rankPointsPosition) : undefined,
    extraIcon: { alt: 'Highscore', src: '/assets/icons/highscore.png' }
  });
  addRow({
    label: CYCLOPEDIA_UI.stats.timeSum,
    icon: '/assets/icons/speed.png',
    rankingKey: 'timeSum',
    value: (() => {
      const v = getProfileValue('timeSum');
      return v !== undefined && v !== null ? FormatUtils.number(v) : cyclopediaSeasonNA();
    })(),
    title: profileData.ticksPosition !== undefined ? String(profileData.ticksPosition) : undefined,
    extraIcon: { alt: 'Highscore', src: '/assets/icons/highscore.png' }
  });
  addRow({
    label: CYCLOPEDIA_UI.stats.floorsSum,
    icon: '/assets/UI/floor-15.png',
    iconConfig: { width: 14, height: 7, className: 'pixelated -ml-px mr-0.5 inline-block -translate-y-0.5' },
    rankingKey: 'floorsSum',
    value: (() => {
      const v = getProfileValue('floorsSum');
      return v !== undefined && v !== null ? FormatUtils.number(v) : cyclopediaSeasonNA();
    })(),
    title: profileData.floorsPosition !== undefined ? String(profileData.floorsPosition) : undefined,
    extraIcon: { alt: 'Highscore', src: '/assets/icons/highscore.png' }
  });
  statsTable.appendChild(tbody);
  statsTableWrap.appendChild(statsTable);
  container.appendChild(statsTableWrap);
  return container;
  } catch (error) {
    console.error('[Cyclopedia] Error rendering player info:', error);
    const fallbackDiv = document.createElement('div');
    fallbackDiv.style.padding = '24px';
    fallbackDiv.style.color = '#ff6b6b';
    fallbackDiv.textContent = CYCLOPEDIA_UI.noProfileData;
    return fallbackDiv;
  }
}

function renderYasirBox(yasir, utils, msUntilNextEpochDay, formatTime) {
  let yasirLoc = yasir.location;
  if (utils?.ROOM_NAME && yasirLoc && utils.ROOM_NAME[yasirLoc]) {
    yasirLoc = utils.ROOM_NAME[yasirLoc];
  } else if (yasirLoc) {
    yasirLoc = yasirLoc.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }

  const yasirDiv = document.createElement('div');
  yasirDiv.style.display = 'flex';
  yasirDiv.style.alignItems = 'center';
  yasirDiv.style.justifyContent = 'center';
  yasirDiv.style.height = '60px';
  yasirDiv.style.maxHeight = '60px';
  yasirDiv.style.width = '100%';
  yasirDiv.style.overflow = 'hidden';

  const yasirFrame = document.createElement('div');
  yasirFrame.className = 'frame-1 surface-regular grid gap-2 p-1.5 text-left';
  yasirFrame.style.width = '100%';
  yasirFrame.style.height = '60px';
  yasirFrame.style.maxHeight = '60px';

  const yasirRow = document.createElement('div');
  yasirRow.className = 'flex justify-between gap-2';

  const yasirIconWrap = document.createElement('div');
  yasirIconWrap.className = 'container-slot surface-darker grid place-items-center px-3.5 py-0.5';
  const yasirIconRel = document.createElement('div');
  yasirIconRel.className = 'relative size-sprite';
  const yasirImg = document.createElement('img');
  yasirImg.alt = 'Yasir';
  yasirImg.className = 'pixelated absolute -bottom-0.5 -right-0.5';
  yasirImg.width = 34;
  yasirImg.height = 37;
  yasirImg.src = '/assets/icons/yasir.png';
  yasirIconRel.appendChild(yasirImg);
  yasirIconWrap.appendChild(yasirIconRel);

  const yasirInfo = document.createElement('div');
  yasirInfo.className = 'flex w-full flex-col';

  const yasirTitle = document.createElement('p');
  yasirTitle.className = 'text-whiteHighlight';
  yasirTitle.textContent = 'Yasir';

  const yasirLocP = document.createElement('p');
  yasirLocP.className = FONT_CONSTANTS.SIZES.SMALL;
  yasirLocP.textContent = 'Current location: ';
  const yasirLocSpan = document.createElement('span');
  yasirLocSpan.className = 'focus-within:focused-highlight whitespace-nowrap';
  yasirLocSpan.style.color = '#4a9eff';
  yasirLocSpan.textContent = yasirLoc || '-';

  const mapPinSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mapPinSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  mapPinSvg.setAttribute('width', '24');
  mapPinSvg.setAttribute('height', '24');
  mapPinSvg.setAttribute('viewBox', '0 0 24 24');
  mapPinSvg.setAttribute('fill', 'none');
  mapPinSvg.setAttribute('stroke', 'currentColor');
  mapPinSvg.setAttribute('stroke-width', '2');
  mapPinSvg.setAttribute('stroke-linecap', 'round');
  mapPinSvg.setAttribute('stroke-linejoin', 'round');
  mapPinSvg.classList.add('lucide', 'lucide-map-pin', 'ml-0.5', 'inline-block', 'size-3', '-translate-y-0.5');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '10');
  circle.setAttribute('r', '3');
  mapPinSvg.appendChild(path);
  mapPinSvg.appendChild(circle);
  yasirLocSpan.appendChild(mapPinSvg);
  yasirLocP.appendChild(yasirLocSpan);

  const yasirTimeP = document.createElement('p');
  yasirTimeP.className = 'pixel-font-14 text-right';

  const clockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  clockSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clockSvg.setAttribute('width', '24');
  clockSvg.setAttribute('height', '24');
  clockSvg.setAttribute('viewBox', '0 0 24 24');
  clockSvg.setAttribute('fill', 'none');
  clockSvg.setAttribute('stroke', 'currentColor');
  clockSvg.setAttribute('stroke-width', '2');
  clockSvg.setAttribute('stroke-linecap', 'round');
  clockSvg.setAttribute('stroke-linejoin', 'round');
  clockSvg.classList.add('lucide', 'lucide-clock', 'mr-1', 'inline-block', 'size-2', '-translate-y-px');
  const clockCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  clockCircle.setAttribute('cx', '12');
  clockCircle.setAttribute('cy', '12');
  clockCircle.setAttribute('r', '10');
  const clockPolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  clockPolyline.setAttribute('points', '12 6 12 12 16 14');
  clockSvg.appendChild(clockCircle);
  clockSvg.appendChild(clockPolyline);
  yasirTimeP.appendChild(clockSvg);

  const yasirTimerSpan = document.createElement('span');
  yasirTimerSpan.className = 'yasir-timer';
  yasirTimerSpan.textContent = formatTime(msUntilNextEpochDay) + 'h';
  yasirTimeP.appendChild(yasirTimerSpan);

  yasirInfo.appendChild(yasirTitle);
  yasirInfo.appendChild(yasirLocP);
  yasirInfo.appendChild(yasirTimeP);
  yasirRow.appendChild(yasirIconWrap);
  yasirRow.appendChild(yasirInfo);
  yasirFrame.appendChild(yasirRow);
  yasirDiv.appendChild(yasirFrame);
  return yasirDiv;
}

function renderBoostedBox(boosted, utils, formatTime, msUntilNextEpochDay) {
  let boostedRoomName = boosted.roomId;
  if (utils?.ROOM_NAME && boostedRoomName && utils.ROOM_NAME[boostedRoomName]) {
    boostedRoomName = utils.ROOM_NAME[boostedRoomName];
  } else if (boostedRoomName) {
    boostedRoomName = boostedRoomName.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }

  const boostedDiv = document.createElement('div');
  boostedDiv.style.display = 'flex';
  boostedDiv.style.alignItems = 'center';
  boostedDiv.style.justifyContent = 'center';
  boostedDiv.style.height = '60px';
  boostedDiv.style.maxHeight = '60px';
  boostedDiv.style.width = '100%';
  boostedDiv.style.overflow = 'hidden';

  const boostedFrame = document.createElement('div');
  boostedFrame.className = 'frame-1 surface-regular grid gap-2 p-1.5 text-left';
  boostedFrame.style.width = '100%';
  boostedFrame.style.height = '60px';
  boostedFrame.style.maxHeight = '60px';

  const boostedRow = document.createElement('div');
  boostedRow.className = 'flex justify-between gap-2';

  const boostedIconWrap = document.createElement('div');
  boostedIconWrap.className = 'container-slot surface-darker grid place-items-center px-3.5 py-0.5 equipment-portrait relative';
  boostedIconWrap.innerHTML = '';

  if (boosted.equipId && api?.ui?.components?.createItemPortrait) {
    let spriteId = boosted.equipId;
    try {
      const equipData = globalThis.state.utils.getEquipment(boosted.equipId);
      if (equipData && equipData.metadata && equipData.metadata.spriteId) {
        spriteId = equipData.metadata.spriteId;
      }
    } catch (e) {}

    let equipPortrait = api.ui.components.createItemPortrait({
      itemId: spriteId,
      stat: boosted.equipStat,
      tier: boosted.equipTier || 1,
    });
    equipPortrait.style.background = 'unset';

    if (equipPortrait.tagName === 'BUTTON' && equipPortrait.firstChild) {
      equipPortrait = equipPortrait.firstChild;
    }
    boostedIconWrap.appendChild(equipPortrait);
  }

  const boostedInfo = document.createElement('div');
  boostedInfo.className = 'flex w-full flex-col';

  const boostedTitle = document.createElement('p');
  boostedTitle.className = 'text-whiteHighlight';
  boostedTitle.textContent = 'Daily boosted map';

  const boostedRoomP = document.createElement('span');
  boostedRoomP.className = 'action-link focus-within:focused-highlight pixel-font-14 mt-1 !text-boosted no-underline';
  boostedRoomP.textContent = boostedRoomName || '-';

  const mapPinSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mapPinSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  mapPinSvg.setAttribute('width', '24');
  mapPinSvg.setAttribute('height', '24');
  mapPinSvg.setAttribute('viewBox', '0 0 24 24');
  mapPinSvg.setAttribute('fill', 'none');
  mapPinSvg.setAttribute('stroke', 'currentColor');
  mapPinSvg.setAttribute('stroke-width', '2');
  mapPinSvg.setAttribute('stroke-linecap', 'round');
  mapPinSvg.setAttribute('stroke-linejoin', 'round');
  mapPinSvg.classList.add('lucide', 'lucide-map-pin', 'ml-0.5', 'inline-block', 'size-3', '-translate-y-0.5');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '10');
  circle.setAttribute('r', '3');
  mapPinSvg.appendChild(path);
  mapPinSvg.appendChild(circle);
  boostedRoomP.appendChild(mapPinSvg);

  const boostedTimeP = document.createElement('p');
  boostedTimeP.className = 'pixel-font-14 text-right';

  const clockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  clockSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clockSvg.setAttribute('width', '24');
  clockSvg.setAttribute('height', '24');
  clockSvg.setAttribute('viewBox', '0 0 24 24');
  clockSvg.setAttribute('fill', 'none');
  clockSvg.setAttribute('stroke', 'currentColor');
  clockSvg.setAttribute('stroke-width', '2');
  clockSvg.setAttribute('stroke-linecap', 'round');
  clockSvg.setAttribute('stroke-linejoin', 'round');
  clockSvg.classList.add('lucide', 'lucide-clock', 'mr-1', 'inline-block', 'size-2', '-translate-y-px');
  const clockCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  clockCircle.setAttribute('cx', '12');
  clockCircle.setAttribute('cy', '12');
  clockCircle.setAttribute('r', '10');
  const clockPolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  clockPolyline.setAttribute('points', '12 6 12 12 16 14');
  clockSvg.appendChild(clockCircle);
  clockSvg.appendChild(clockPolyline);
  boostedTimeP.appendChild(clockSvg);

  const boostedTimerSpan = document.createElement('span');
  boostedTimerSpan.className = 'boosted-timer';
  boostedTimerSpan.textContent = formatTime(msUntilNextEpochDay) + 'h';
  boostedTimeP.appendChild(boostedTimerSpan);

  if (boosted.roomId) {
    boostedRoomP.style.cursor = 'pointer';
    boostedRoomP.title = 'Go to this map';
    boostedRoomP.addEventListener('click', (e) => {
      e.stopPropagation();
      NavigationHandler.navigateToMapByRoomId(boosted.roomId);
    });
  }

  boostedInfo.appendChild(boostedTitle);
  boostedInfo.appendChild(boostedRoomP);
  boostedInfo.appendChild(boostedTimeP);

  boostedRow.appendChild(boostedIconWrap);
  boostedRow.appendChild(boostedInfo);
  boostedFrame.appendChild(boostedRow);
  boostedDiv.appendChild(boostedFrame);

  boostedIconWrap.querySelectorAll('.has-rarity[data-rarity="1"]').forEach(el => el.remove());
  
  // Use requestAnimationFrame for smoother DOM updates
  requestAnimationFrame(() => {
    const gradientElements = boostedDiv.querySelectorAll('.absolute[style*="radial-gradient"]');
    gradientElements.forEach(el => {
      el.style.background = 'none';
    });
  });
  
  return boostedDiv;
}

function renderDailyContextColumn() {
  const dailyContext = globalThis.state?.daily?.getSnapshot?.().context || {};
  const utils = globalThis.state?.utils;
  const yasir = dailyContext.yasir || {};
  const boosted = dailyContext.boostedMap || {};
  const initialMsUntilNextEpochDay = dailyContext.msUntilNextEpochDay;

  function formatTime(ms) {
    if (!ms || isNaN(ms) || ms < 0) return '--:--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60) % 60;
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
  }

  const col = document.createElement('div');
  col.style.display = 'flex';
  col.style.flexDirection = 'column';
  col.style.height = '100%';
  col.style.width = '300px';
  col.style.minWidth = '300px';
  col.style.maxWidth = '300px';
  col.style.padding = '0 12px';
  col.style.boxSizing = 'border-box';
  col.style.justifyContent = 'center';
  col.style.alignItems = 'center';

  const yasirDiv = renderYasirBox(yasir, utils, initialMsUntilNextEpochDay, formatTime);
  const boostedDiv = renderBoostedBox(boosted, utils, formatTime, initialMsUntilNextEpochDay);

  const separator = document.createElement('div');
  separator.className = 'separator my-2.5';
  separator.setAttribute('role', 'none');
  separator.style.margin = '10px 0';

  let ms = initialMsUntilNextEpochDay;
  let lastUpdate = Date.now();
  let timerInterval = setInterval(() => {
    const now = Date.now();
    ms -= (now - lastUpdate);
    lastUpdate = now;
    const t = formatTime(ms);
    const yasirTimer = col.querySelector('.yasir-timer');
    const boostedTimer = col.querySelector('.boosted-timer');
    if (yasirTimer) yasirTimer.textContent = t + 'h';
    if (boostedTimer) boostedTimer.textContent = t + 'h';
  }, 1000);
  col._cleanup = () => clearInterval(timerInterval);

  col.appendChild(yasirDiv);
  col.appendChild(separator);
  col.appendChild(boostedDiv);

  return col;
}

const cyclopediaEventHandlers = [];

function initCyclopedia() {
  try {

    addCyclopediaHeaderButton();
    injectCyclopediaSelectedCss();
    
    startContextMenuObserver();
    
    setupEventHandlers();
    
    // Set up periodic cache cleanup (every 5 minutes)
    const cacheCleanupInterval = setInterval(() => {
      try {
        const cleanedCount = cyclopediaState.cleanupExpiredCache();
        if (cleanedCount > 0) {
          // Periodic cache cleanup completed
        }
      } catch (error) {
        console.error('[Cyclopedia] Error during periodic cache cleanup:', error);
      }
    }, 300000); // 5 minutes
    
    // Store interval ID for cleanup
    cyclopediaState.timers.set('cacheCleanup', cacheCleanupInterval);
    
    // Set up periodic DOM cache cleanup (every 2 minutes)
    const domCacheCleanupInterval = setInterval(() => {
      try {
        DOMCache.clear();
        // DOM cache cleanup completed
      } catch (error) {
        console.error('[Cyclopedia] Error during DOM cache cleanup:', error);
      }
    }, 120000); // 2 minutes
    
    // Store interval ID for cleanup
    cyclopediaState.timers.set('domCacheCleanup', domCacheCleanupInterval);
    

    return true;
  } catch (error) {
    console.error('[Cyclopedia] Initialization failed:', error);
    return false;
  }
}

function setupEventHandlers() {
  const headerClickHandler = function (e) {
    if (e.target && e.target.classList.contains('cyclopedia-header-btn')) {
      openCyclopediaModal();
    }
  };
  document.addEventListener('click', headerClickHandler);
  cyclopediaEventHandlers.push({ type: 'click', handler: headerClickHandler });
}

function removeCyclopediaEventListeners() {
  cyclopediaEventHandlers.forEach(({ type, handler }) => {
    document.removeEventListener(type, handler);
  });
  cyclopediaEventHandlers.length = 0;
}

function cleanupAbilityTooltips() {
  const abilitySections = document.querySelectorAll('.cyclopedia-box, [role="dialog"]');
  abilitySections.forEach(section => {
    if (section._tooltipComponent && typeof section._tooltipComponent.unmount === 'function') {
      try {
        section._tooltipComponent.unmount();
      } catch (error) {
        console.error('[Cyclopedia] Error unmounting tooltip component:', error);
      }
      section._tooltipComponent = null;
    }
  });
}

function cleanupCyclopediaModal() {
  cyclopediaPendingHomeSearchFocus = false;
  // Note: This function is safe to call multiple times (idempotent)
  // Only clean up modal-specific resources, preserve global context menu observer
  
  // Don't stop the global context menu observer - it's needed for future right-click menus
  // cyclopediaState.observer and window.cyclopediaGlobalObserver handle context menu injection
  
  if (window.cyclopediaMenuObserver) {
    try {
      window.cyclopediaMenuObserver.disconnect();
      window.cyclopediaMenuObserver = null;

    } catch (error) {
    console.warn('[Cyclopedia] Error in monster location cache:', error);
  }
  }
  
  // Clear all caches
  clearCharactersTabCache();
  clearLeaderboardCache();
  clearSearchedUsername();
  
  // Clear additional caches
  // Preserve monster data cache - it's expensive to rebuild and doesn't change
  // cyclopediaState.monsterLocationCache.clear();
  // if (cyclopediaState.monsterNameMap) {
  //   cyclopediaState.monsterNameMap.clear();
  //   console.warn('[Cyclopedia] ✅ Cleared monsterNameMap');
  // }
  // cyclopediaState.monsterNameMapBuilt = false;
  cyclopediaState.lazyLoadQueue.length = 0;
  cyclopediaState.isProcessingQueue = false;
  
  // Clear utility caches
  DOMCache.clear();
  
  // Clear all timers using TimerManager
  TimerManager.cleanup();
  cyclopediaState.timers.clear();
  
  // Reset state
  cyclopediaState.modalOpen = false;
  cyclopediaState.currentModal = null;
  cyclopediaState.lastFetch = 0;
  cyclopediaState.fetchInProgress = false;
  
  // Clear global variables
  if (activeCyclopediaModal) {
    activeCyclopediaModal = null;
  }
  
  // Clear equipment selection global variable
  if (typeof window !== 'undefined') {
    window.cyclopediaSelectedEquipment = null;
    window.cyclopediaHomeSearchNavigate = null;
  }
  
  // Reset home search caches (safe, best-effort)
  try {
    if (CyclopediaHomeSearch && typeof CyclopediaHomeSearch.reset === 'function') {
      CyclopediaHomeSearch.reset();
    }
  } catch (e) {
    // ignore
  }
  
  // Simple memory cleanup
  MemoryUtils.clearLargeObjects();
  
  // Ensure context menu observer is still running for future right-click menus
  if (!cyclopediaState.observer || !window.cyclopediaGlobalObserver) {
    startContextMenuObserver();
  }
}

function cleanupCyclopedia() {
  try {
    
    
    // Clean up all event handlers
    EventHandlerManager.cleanup();
    
    // Clean up all timers
    TimerManager.cleanup();
    
    // Clean up all observers
    ObserverManager.cleanup();
    
    // Remove event listeners
    removeCyclopediaEventListeners();
    
    // Clean up ability tooltips
    cleanupAbilityTooltips();
    
    // Clean up modal
    if (activeCyclopediaModal) {
      cleanupCyclopediaModal();
      activeCyclopediaModal = null;
    }
    
    // Remove header button
    const headerUl = DOMCache.get('header ul.pixel-font-16.flex.items-center');
    if (headerUl) {
      const btnLi = headerUl.querySelector('li:has(.cyclopedia-header-btn)');
      if (btnLi) btnLi.remove();
    }
    
    // Clear global DOM references
    window.selectedCharacterItem = null;
    window.cyclopediaSelectedEquipment = null;
    
    // Simple memory cleanup
    MemoryUtils.clearLargeObjects();
    
    // Use centralized cleanup
    cyclopediaState.cleanup();
    
    // Clear DOM cache
    DOMCache.clear();
    
    
  } catch (error) {
    console.error('[Cyclopedia] Error during cleanup:', error);
  }
}

// =======================
// 12. Exports & Lifecycle Management
// =======================

// Proper exports following mod development guide
exports = {
  init: function() {
    try {
      initCyclopedia();
      return true;
    } catch (error) {
      console.error('[Cyclopedia] Initialization error:', error);
      return false;
    }
  },
  
  cleanup: function() {
    try {
      
      
      // Comprehensive cleanup per mod development guide
      cleanupCyclopedia();
      
      // Additional cleanup for mod disable
      // Clear all global references
      if (typeof window !== 'undefined') {
        window.selectedCharacterItem = null;
        window.cyclopediaSelectedEquipment = null;
        window.cyclopediaMenuObserver = null;
        window.cyclopediaGlobalObserver = null;
        delete window.__cyclopediaOpen;
      }
      
      // Clear all caches
      if (cyclopediaState) {
        cyclopediaState.cleanup();
      }
      
      
      return true;
    } catch (error) {
      console.error('[Cyclopedia] Cleanup error:', error);
      return false;
    }
  },
  
  show: function(options) {
    try {
      return openCyclopediaModal(options);
    } catch (error) {
      console.error('[Cyclopedia] Error opening modal:', error);
      return null;
    }
  },
  
  updateConfig: function(newConfig) {
    try {
      // Update any configurable settings here
      Object.assign(START_PAGE_CONFIG, newConfig);
      return true;
    } catch (error) {
      console.error('[Cyclopedia] Config update error:', error);
      return false;
    }
  }
};

// Legacy window object for backward compatibility
if (typeof window !== 'undefined') {
  window.__cyclopediaOpen = (options) => openCyclopediaModal({ fromHeader: true, ...(options || {}) });
  window.Cyclopedia = {
    init: exports.init,
    cleanup: exports.cleanup,
    show: exports.show,
    close: exports.cleanup
  };
}

// Auto-initialize if running in mod context
if (typeof context !== 'undefined' && context.api) {
  exports.init();
}

