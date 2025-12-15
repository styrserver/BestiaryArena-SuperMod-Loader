// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[Cyclopedia] initializing...');
const START_PAGE_CONFIG = { API_TIMEOUT: 10000, COLUMN_WIDTHS: { LEFT: 300, MIDDLE: 300, RIGHT: 300 }, API_BASE_URL: 'https://bestiaryarena.com/api/trpc/serverSide.profilePageData', FRAME_IMAGE_URL: 'https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png' };
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
  UNOWNED: '#666',
  HOVER: '#888'
};

// Font family and size constants
const FONT_CONSTANTS = {
  PRIMARY: 'pixel-font',
  SMALL: 'pixel-font-14',
  MEDIUM: 'pixel-font-16',
  LARGE: 'pixel-font-16',
  SIZES: {
    TITLE: 'pixel-font-16',
    BODY: 'pixel-font-16',
    SMALL: 'pixel-font-14',
    TINY: 'pixel-font-14'
  }
};

// Maps Tab DOM Optimization System
const MapsTabDOMOptimizer = {
  // Cache for reusable DOM elements
  elementCache: new Map(),
  
  // Track current state to avoid unnecessary updates
  currentState: {
    selectedMap: null,
    selectedCategory: null,
    roomData: null,
    roomName: null
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
// Monster stats configuration for display in UI
const MONSTER_STATS_CONFIG = [
    { key: 'hp', label: 'Hitpoints', icon: '/assets/icons/heal.png', max: 700, barColor: 'rgb(96, 192, 96)' },
    { key: 'ad', label: 'Attack Damage', icon: '/assets/icons/attackdamage.png', max: 80, barColor: 'rgb(255, 128, 96)' },
    { key: 'ap', label: 'Ability Power', icon: '/assets/icons/abilitypower.png', max: 60, barColor: 'rgb(128, 128, 255)' },
    { key: 'armor', label: 'Armor', icon: '/assets/icons/armor.png', max: 60, barColor: 'rgb(224, 224, 128)' },
    { key: 'magicResist', label: 'Magic Resist', icon: '/assets/icons/magicresist.png', max: 60, barColor: 'rgb(192, 128, 255)' },
    { key: 'speed', label: 'Speed', icon: '/assets/icons/speed.png', max: 200, barColor: 'rgb(255, 200, 100)' }
];

// Hardcoded monster stats for unobtainable creatures that have different stats on maps
const HARDCODED_MONSTER_STATS = {
  'old giant spider': { baseStats: { hp: 1140, ad: 108, ap: 30, armor: 30, magicResist: 30 }, level: 300 },
  'willi wasp': { baseStats: { hp: 924, ad: 0, ap: 0, armor: 26, magicResist: 45 }, level: 100 },
  'black knight': { baseStats: { hp: 4800, ad: 66, ap: 0, armor: 975, magicResist: 975 }, level: 300 },
  'dharalion': { baseStats: { hp: 2200, ad: 33, ap: 25, armor: 60, magicResist: 66 }, level: 200 },
  'dead tree': { baseStats: { hp: 7000, ad: 0, ap: 0, armor: 700, magicResist: 700 }, level: 100 },
  'earth crystal': { baseStats: { hp: 350, ad: 0, ap: 0, armor: 350, magicResist: 350 }, level: 50 },
  'energy crystal': { baseStats: { hp: 350, ad: 0, ap: 0, armor: 150, magicResist: 30 }, level: 50 },
  'magma crystal': { baseStats: { hp: 350, ad: 0, ap: 0, armor: 350, magicResist: 350 }, level: 50 },
  'regeneration tank': { baseStats: { hp: 8352, ad: 0, ap: 0, armor: 126, magicResist: 696 }, level: 99 },
  'monster cauldron': { baseStats: { hp: 1114, ad: 92, ap: 112, armor: 45, magicResist: 42 }, level: 99 }
};

// Get creature data from centralized database
const HIDE_FROM_CYCLOPEDIA = ['Tentugly', 'Dwarf Henchman'];
const UNOBTAINABLE_CREATURES = (window.creatureDatabase?.UNOBTAINABLE_CREATURES || [])
  .filter(name => !HIDE_FROM_CYCLOPEDIA.includes(name));

const ALL_CREATURES = (window.creatureDatabase?.ALL_CREATURES || [])
  .filter(name => !HIDE_FROM_CYCLOPEDIA.includes(name));

// Debug logging for creature database integration
console.log('[Cyclopedia] Creature database integration:', {
  hasDatabase: !!window.creatureDatabase,
  allCreaturesFromDB: window.creatureDatabase?.ALL_CREATURES?.length || 0,
  unobtainableFromDB: window.creatureDatabase?.UNOBTAINABLE_CREATURES?.length || 0,
  usingFallback: !window.creatureDatabase
});

// Debug logging for equipment database integration
console.log('[Cyclopedia] Equipment database integration:', {
  hasDatabase: !!window.equipmentDatabase,
  allEquipmentFromDB: window.equipmentDatabase?.ALL_EQUIPMENT?.length || 0,
  usingFallback: !window.equipmentDatabase
});

// Get equipment data from centralized database
const ALL_EQUIPMENT = window.equipmentDatabase?.ALL_EQUIPMENT || [];

const GAME_KEYS = {
  NO_RARITY: ['nicknameChange', 'nicknameMonster', 'hunterOutfitBag', 'outfitBag1'],
  CURRENCY: ['gold', 'dust', 'beastCoins', 'huntingMarks'],
  UPGRADE: ['babyDragonPlant', 'dailyBoostedMap', 'daycare', 'dungeonAscension', 'dragonPlant', 'hygenie', 'monsterCauldron', 'monsterRaids', 'monsterSqueezer', 'mountainFortress', 'premium', 'forge', 'yasirTradingContract']
};

const EXP_TABLE = [
  [5, 11250], [6, 17000], [7, 24000], [8, 32250], [9, 41750], [10, 52250],
  [11, 64250], [12, 77750], [13, 92250], [14, 108500], [15, 126250], [16, 145750],
  [17, 167000], [18, 190000], [19, 215250], [20, 242750], [21, 272750], [22, 305750],
  [23, 342000], [24, 382000], [25, 426250], [26, 475250], [27, 530000], [28, 591500],
  [29, 660500], [30, 738500], [31, 827000], [32, 928000], [33, 1043500], [34, 1176000],
  [35, 1329000], [36, 1505750], [37, 1710500], [38, 1948750], [39, 2226500], [40, 2550500],
  [41, 2929500], [42, 3373500], [43, 3894000], [44, 4504750], [45, 5222500], [46, 6066000],
  [47, 7058000], [48, 8225000], [49, 9598500], [50, 11214750]
];


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

const REGION_NAME_MAP = {
  'rook': 'Rookgaard',
  'carlin': 'Carlin',
  'folda': 'Folda',
  'abdendriel': 'Ab\'Dendriel',
  'kazordoon': 'Kazordoon',
  'venore': 'Venore'
};

const GAME_DATA = {
  MONSTER_STATS_CONFIG,
  UNOBTAINABLE_CREATURES,
  ALL_CREATURES,
  ALL_EQUIPMENT,
  NO_RARITY_KEYS: GAME_KEYS.NO_RARITY,
  CURRENCY_KEYS: GAME_KEYS.CURRENCY,
  UPGRADE_KEYS: GAME_KEYS.UPGRADE,
  RARITY_COLORS: inventoryDatabase.rarityColors || {},
  EXP_TABLE,
  REGION_NAME_MAP
};

// =======================
// 2. Global State & Configuration
// =======================
if (typeof window.cyclopediaGlobalObserver === 'undefined') {
  window.cyclopediaGlobalObserver = null;
}

const cyclopediaState = {
  observer: null, modalOpen: false, currentModal: null,
  profileData: null, lastFetch: 0, fetchInProgress: false,
  monsterNameMap: null, monsterNameMapBuilt: false, monsterLocationCache: new Map(),
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
    const cacheStats = this.getCacheStats();
  }
};

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
      console.log(`[Cyclopedia] Observer added: ${name}`);
    }
  },
  
  remove: function(observer) {
    if (observer && this.observers.has(observer)) {
      try {
        observer.disconnect();
        this.observers.delete(observer);
        console.log(`[Cyclopedia] Observer removed: ${observer._cyclopediaName || 'unnamed'}`);
      } catch (error) {
        console.warn(`[Cyclopedia] Error removing observer:`, error);
      }
    }
  },
  
  cleanup: function() {
    console.log(`[Cyclopedia] Cleaning up ${this.observers.size} observers`);
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
        console.log(`[Cyclopedia] Observer disconnected: ${observer._cyclopediaName || 'unnamed'}`);
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
      console.log(`[Cyclopedia] Timeout added: ${name}`);
    }
  },
  
  addInterval: function(timer, name = 'unnamed') {
    if (timer) {
      timer._cyclopediaName = name;
      timer._cyclopediaType = 'interval';
      this.timers.add(timer);
      console.log(`[Cyclopedia] Interval added: ${name}`);
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
        console.log(`[Cyclopedia] Timer removed: ${timer._cyclopediaName || 'unnamed'}`);
      } catch (error) {
        console.warn(`[Cyclopedia] Error removing timer:`, error);
      }
    }
  },
  
  cleanup: function() {
    console.log(`[Cyclopedia] Cleaning up ${this.timers.size} timers`);
    this.timers.forEach(timer => {
      try {
        if (timer._cyclopediaType === 'interval') {
          clearInterval(timer);
        } else {
          clearTimeout(timer);
        }
        console.log(`[Cyclopedia] Timer cleared: ${timer._cyclopediaName || 'unnamed'}`);
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
    Object.assign(wrapper.style, { width: width + 'px', flex: `0 0 ${width}px`, display: 'flex', flexDirection: 'column', height: '100%', ...extraStyles });
    if (content) wrapper.appendChild(content);
    return wrapper;
  },
  
  createTitle: function(text, className = FONT_CONSTANTS.SIZES.TITLE) {
    const titleEl = document.createElement('h2');
    titleEl.className = 'widget-top widget-top-text ' + className;
    Object.assign(titleEl.style, { margin: '0', padding: '2px 8px', textAlign: 'center', color: COLOR_CONSTANTS.TEXT });
    const p = document.createElement('p');
    p.textContent = text; p.className = className;
    Object.assign(p.style, { margin: '0', padding: '0', textAlign: 'center', color: COLOR_CONSTANTS.TEXT });
    titleEl.appendChild(p);
    return titleEl;
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
  
  createListItem: function(text, className = FONT_CONSTANTS.SIZES.BODY, isOwned = true, isPerfect = false, isT5 = false, hasShiny = false) {
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
    
    // Add text content
    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    contentContainer.appendChild(textSpan);
    
    item.appendChild(contentContainer);
    
    // Apply styling based on item status
    const baseStyle = { cursor: 'pointer', padding: '2px 4px', borderRadius: '2px', textAlign: 'left' };
    if (isPerfect) {
      // Gold color for perfect creatures - clean and distinct
      Object.assign(item.style, { 
        ...baseStyle, 
        color: COLOR_CONSTANTS.PERFECT
      });
    } else if (isT5) {
      // Gold color for T5 equipment - same as perfect creatures
      Object.assign(item.style, { 
        ...baseStyle, 
        color: COLOR_CONSTANTS.PERFECT
      });
    } else if (isOwned) {
      Object.assign(item.style, { ...baseStyle, color: COLOR_CONSTANTS.TEXT });
    } else {
      Object.assign(item.style, { ...baseStyle, color: COLOR_CONSTANTS.UNOWNED, filter: 'grayscale(0.7)' });
    }
    
    return item;
  }
};

// =======================
// 4. Utility Functions
// =======================

// Unified function to get all creature status information
function getCreatureStatus(creatureName) {
  try {
    if (!globalThis.state?.player?.getSnapshot?.()?.context?.monsters) {
      return { owned: false, shiny: false, perfect: false };
    }
    
    const playerContext = globalThis.state.player.getSnapshot().context;
    const ownedMonsters = playerContext.monsters || [];
    
    // Get the gameId for this creature name
    let creatureGameId = null;
    
    // Try to get gameId from monsterNameMap first
    if (cyclopediaState.monsterNameMap) {
      const entry = cyclopediaState.monsterNameMap.get(creatureName.toLowerCase());
      if (entry) {
        creatureGameId = entry.index;
      }
    }
    
    // Fallback to BestiaryModAPI utility
    if (creatureGameId === null && window.BestiaryModAPI?.utility?.maps) {
      creatureGameId = window.BestiaryModAPI.utility.maps.monsterNamesToGameIds?.get(creatureName.toLowerCase());
    }
    
    // Find all matching monsters for this creature
    const matchingMonsters = ownedMonsters.filter(monster => monster.gameId === creatureGameId);
    
    if (matchingMonsters.length === 0) {
      return { owned: false, shiny: false, perfect: false };
    }
    
    // Check for shiny variants
    const hasShiny = matchingMonsters.some(monster => monster.shiny === true);
    
    // Check for perfect creatures (level 50 with 100 total genes)
    const isPerfect = matchingMonsters.some(monster => {
      const totalGenes = (monster.hp || 0) + (monster.ad || 0) + (monster.ap || 0) + (monster.armor || 0) + (monster.magicResist || 0);
      
      // Calculate level from experience using the game's utility function
      let level = 1;
      if (globalThis.state?.utils?.expToCurrentLevel && monster.exp) {
        level = globalThis.state.utils.expToCurrentLevel(monster.exp);
      }
      
      // Debug logging for troubleshooting
      if (totalGenes >= 90) { // Log creatures close to perfect for debugging
        console.log(`[Cyclopedia] ${creatureName} (gameId: ${monster.gameId}): level=${level}, genes=${totalGenes}, exp=${monster.exp}`);
      }
      
      return level >= 50 && totalGenes >= 100;
    });
    
    return {
      owned: true,
      shiny: hasShiny,
      perfect: isPerfect
    };
  } catch (error) {
    console.warn('[Cyclopedia] Error checking creature status:', error);
    return { owned: false, shiny: false, perfect: false };
  }
}

// Function to check if user owns a creature
function isCreatureOwned(creatureName) {
  return getCreatureStatus(creatureName).owned;
}

// Function to check if user has any shiny variants of a creature
function hasShinyCreature(creatureName) {
  return getCreatureStatus(creatureName).shiny;
}

// Function to check if user has a perfect creature (level 50 with 100 total genes)
function isCreaturePerfect(creatureName) {
  return getCreatureStatus(creatureName).perfect;
}

// Unified function to get all equipment status information
function getEquipmentStatus(equipmentName) {
  try {
    if (!globalThis.state?.player?.getSnapshot?.()?.context?.equips) {
      return { owned: false, isT5: false };
    }
    
    const playerContext = globalThis.state.player.getSnapshot().context;
    const ownedEquips = playerContext.equips || [];
    
    // Get the gameId for this equipment name
    let equipmentGameId = null;
    
    // Try to get gameId from BestiaryModAPI utility
    if (window.BestiaryModAPI?.utility?.maps) {
      equipmentGameId = window.BestiaryModAPI.utility.maps.equipmentNamesToGameIds?.get(equipmentName.toLowerCase());
    }
    
    // Fallback to global state utils
    if (equipmentGameId === null && globalThis.state?.utils?.getEquipment) {
      const utils = globalThis.state.utils;
      for (let i = 1; i < 1000; i++) {
        try {
          const eq = utils.getEquipment(i);
          if (eq?.metadata?.name?.toLowerCase() === equipmentName.toLowerCase()) {
            equipmentGameId = i;
            break;
          }
        } catch (e) {
          console.log('[Cyclopedia] Error in equipment ownership check:', e);
        }
      }
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
      console.log(`[Cyclopedia] ${equipmentName} (gameId: ${equipmentGameId}): T5 stats=${t5Stats}/${totalStats}`);
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

// Function to get creature roles from monster data
function getCreatureRoles(creatureName) {
  try {
    if (!cyclopediaState.monsterNameMap || typeof creatureName !== 'string') {
      return null;
    }
    
    const entry = cyclopediaState.monsterNameMap.get(creatureName.toLowerCase());
    if (entry && entry.monster && entry.monster.metadata && entry.monster.metadata.roles) {
      return entry.monster.metadata.roles;
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
          const value = span.textContent.replace(/,/g, '');
          const parsedValue = parseInt(value, 10);
          return isNaN(parsedValue) ? null : parsedValue;
        }
      }
    }
    return null;
  } catch (error) { 
    console.warn(`[Cyclopedia] Error getting ${currencyType} from UI:`, error); 
    return null; 
  } 
}
function getCurrencyFromGameState(currencyType) { try { const gameState = globalThis.state?.player?.getSnapshot()?.context; if (!gameState) return null; const paths = CURRENCY_GAME_STATE_PATHS[currencyType]; if (!paths) return null; for (const path of paths) { const value = path.split('?.').reduce((obj, key) => obj?.[key], gameState); if (typeof value === 'number' && !isNaN(value) && value >= 0) return value; } return null; } catch (error) { return null; } }
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
      const parsedValue = parseInt(numberMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(parsedValue)) return parsedValue;
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
function getCachedRankingsData(ttl = 600000) { return cyclopediaState.getLeaderboardData('rankings', ttl); }
function setCachedRankingsData(data) { cyclopediaState.setLeaderboardData('rankings', data); }
function clearCharactersTabCache() { cyclopediaState.clearCache('all'); }
function clearLeaderboardCache() { cyclopediaState.clearCache('leaderboardData'); }
function clearSearchedUsername() { cyclopediaState.searchedUsername = null; }
function truncatePlayerName(name) {
  if (!name || typeof name !== 'string') return name || '';
  return name.length > 8 ? name.substring(0, 8) + '...' : name;
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
    console.log('[Cyclopedia] Getting local run data...');
    if (window.RunTrackerAPI) {
      console.log('[Cyclopedia] Using RunTrackerAPI.getAllRuns()');
      const data = window.RunTrackerAPI.getAllRuns();
      console.log('[Cyclopedia] RunTrackerAPI.getAllRuns() returned:', data);
      return Promise.resolve(data);
    }
    // Fallback to direct storage access
    if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
      console.log('[Cyclopedia] Using browserAPI.storage.local fallback');
      return new Promise(resolve => {
        window.browserAPI.storage.local.get('ba_local_runs', result => {
          console.log('[Cyclopedia] browserAPI.storage.local.get result:', result);
          resolve(result.ba_local_runs || null);
        });
      });
    }
    console.log('[Cyclopedia] No RunTrackerAPI or browserAPI available, returning null');
    return Promise.resolve(null);
  } catch (error) {
    console.warn('[Cyclopedia] Error getting local run data:', error);
    return Promise.resolve(null);
  }
}

function getLocalRunsForMap(mapKey, category = null) {
  try {
    console.log(`[Cyclopedia] Getting local runs for map: ${mapKey}, category: ${category}`);
    if (window.RunTrackerAPI) {
      console.log(`[Cyclopedia] Using RunTrackerAPI.getRuns(${mapKey}, ${category})`);
      const data = window.RunTrackerAPI.getRuns(mapKey, category);
      console.log(`[Cyclopedia] RunTrackerAPI.getRuns(${mapKey}, ${category}) returned:`, data);
      return Promise.resolve(data);
    }
    // Fallback to direct storage access
    console.log('[Cyclopedia] Using getLocalRunData() fallback');
    return getLocalRunData().then(runData => {
      console.log('[Cyclopedia] getLocalRunData() returned:', runData);
      if (!runData || !runData.runs || !runData.runs[mapKey]) {
        console.log(`[Cyclopedia] No data found for mapKey: ${mapKey}`);
        return category ? [] : { speedrun: [], rank: [] };
      }
      
      if (category) {
        const categoryData = runData.runs[mapKey][category] || [];
        console.log(`[Cyclopedia] Found ${categoryData.length} runs for ${mapKey}/${category}:`, categoryData);
        return categoryData;
      }
      
      const mapData = runData.runs[mapKey];
      console.log(`[Cyclopedia] Found data for ${mapKey}:`, mapData);
      return mapData;
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

    // Check for cached combined data
    const cachedData = this.getCached('combined-leaderboards');
    if (cachedData) {
      return cachedData;
    }

    try {
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
        yourRooms: playerState.rooms,
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
    console.log('[Cyclopedia] Error in monster location cache:', error);
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
    console.log('[Cyclopedia] Error in monster location cache:', error);
  }
    });
  } catch (error) {
    console.log('[Cyclopedia] Error in monster location cache:', error);
  }
  
  cyclopediaState.monsterLocationCache.set(cacheKey, locations);
  return locations;
}

function getLevelFromExp(exp) {
  const expTable = GAME_DATA.EXP_TABLE;
  if (typeof exp !== 'number' || exp < expTable[0][1]) return 1;
  for (let i = expTable.length - 1; i >= 0; i--) {
    if (exp >= expTable[i][1]) return expTable[i][0];
  }
  return 1;
}

// =======================
// 7. DOM/CSS Injection Helpers
// =======================
const CYCLOPEDIA_BUTTON_CSS = `.cyclopedia-subnav { display: flex; gap: 0; margin-bottom: 0; width: 100%; } nav.cyclopedia-subnav > button.cyclopedia-btn, nav.cyclopedia-subnav > button.cyclopedia-btn:hover, nav.cyclopedia-subnav > button.cyclopedia-btn:focus { background: url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat !important; border: 6px solid transparent !important; border-color: #ffe066 !important; border-image: url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch !important; color: var(--theme-text, #e6d7b0) !important; font-weight: 700 !important; border-radius: 0 !important; box-sizing: border-box !important; transition: color 0.2s, border-image 0.1s !important; font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif !important; outline: none !important; position: relative !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; font-size: 16px !important; padding: 7px 24px !important; cursor: pointer; flex: 1 1 0; min-width: 0; } nav.cyclopedia-subnav > button.cyclopedia-btn.pressed, nav.cyclopedia-subnav > button.cyclopedia-btn:active { border-image: url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 6 fill stretch !important; } nav.cyclopedia-subnav > button.cyclopedia-btn.active { border-image: url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 6 fill stretch !important; } nav.cyclopedia-subnav > button.cyclopedia-btn[data-tab="home"], nav.cyclopedia-subnav > button.cyclopedia-btn[data-tab="wiki"] { width: 42px !important; height: 42px !important; min-width: 42px !important; min-height: 42px !important; max-width: 42px !important; max-height: 42px !important; flex: 0 0 42px !important; padding: 0 !important; font-size: 12px !important; }`;
function injectCyclopediaButtonStyles() { if (!DOMCache.get('#cyclopedia-btn-css')) { const style = document.createElement('style'); style.id = 'cyclopedia-btn-css'; style.textContent = CYCLOPEDIA_BUTTON_CSS; document.head.appendChild(style); } }

const CYCLOPEDIA_BOX_CSS = `.cyclopedia-box { display: flex; flex-direction: column; border: none; background: none; margin-bottom: 16px; min-height: 120px; box-sizing: border-box; } .cyclopedia-box-title { border: 6px solid transparent; border-image: url('https://bestiaryarena.com/_next/static/media/4-frame-top.b7a55115.png') 6 6 0 6 stretch; border-bottom: none; background: #232323; color: #ffe066; font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif; font-size: 15px; font-weight: bold; padding: 4px 12px; text-align: left; letter-spacing: 1px; } .cyclopedia-box-content { flex: 1 1 0; overflow-y: auto; background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat; padding: 8px 12px; color: #e6d7b0; font-size: 14px; font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif; min-height: 0; max-height: none; scrollbar-width: thin !important; scrollbar-color: #444 #222 !important; } .cyclopedia-box-content::-webkit-scrollbar { width: 12px !important; background: transparent !important; } .cyclopedia-box-content::-webkit-scrollbar-thumb { background: url('https://bestiaryarena.com/_next/static/media/scrollbar-handle-vertical.962972d4.png') repeat-y !important; border-radius: 4px !important; } .cyclopedia-box-content::-webkit-scrollbar-corner { background: transparent !important; }`;
function injectCyclopediaBoxStyles() { if (!DOMCache.get('#cyclopedia-box-css')) { const style = document.createElement('style'); style.id = 'cyclopedia-box-css'; style.textContent = CYCLOPEDIA_BOX_CSS; document.head.appendChild(style); } }

const CYCLOPEDIA_SELECTED_CSS = `.cyclopedia-selected { background: rgba(255,255,255,0.18) !important; color: #ffe066 !important; } .cyclopedia-box .equipment-portrait .absolute { background: none !important; } .cyclopedia-box .equipment-portrait[data-highlighted="true"] .absolute { background: none !important; } .cyclopedia-box .equipment-portrait .absolute[style*="radial-gradient"] { background: none !important; } .cyclopedia-box .equipment-portrait .absolute[style*="background: radial-gradient"] { background: none !important; } .cyclopedia-box .equipment-portrait .absolute[style*="rgba(0, 0, 0, 0.5)"] { background: none !important; } .cyclopedia-box .equipment-portrait .absolute.bottom-0.left-0 { background: none !important; }`;
function injectCyclopediaSelectedCss() { if (!DOMCache.get('#cyclopedia-selected-css')) { const style = document.createElement('style'); style.id = 'cyclopedia-selected-css'; style.textContent = CYCLOPEDIA_SELECTED_CSS; document.head.appendChild(style); } }

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
      // Skip elements that should be excluded
      if (el.hasAttribute('data-cyclopedia-exclude')) {
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
    document.body.removeChild(overlay);
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
  
    items.forEach(name => {
      // Check item status based on type
      let isOwned = true;
      let isPerfect = false;
      let isT5 = false;
      
      let hasShiny = false;
      
      if (type === 'creature') {
        // Check if this is an unobtainable creature - if so, keep default styling
        const isUnobtainable = UNOBTAINABLE_CREATURES.some(c => c.toLowerCase() === name.toLowerCase());
        if (!isUnobtainable) {
          isOwned = isCreatureOwned(name);
          isPerfect = isCreaturePerfect(name);
          hasShiny = hasShinyCreature(name);
        }
      } else if (type === 'equipment') {
        isOwned = isEquipmentOwned(name);
        isT5 = isEquipmentT5(name);
      } else if (type === 'map') {
        // Check if map is explored using game state
        const mapIndex = items.indexOf(name);
        const mapId = mapIds?.[mapIndex];
        isOwned = mapId ? globalThis.state?.player?.getSnapshot()?.context?.rooms?.[mapId] !== undefined : false;
      } else if (type === 'region') {
        // Check if region has any explored maps
        const regionIndex = items.indexOf(name);
        const regionId = regionIds?.[regionIndex];
        if (regionId && globalThis.state?.utils?.REGIONS) {
          const region = globalThis.state.utils.REGIONS.find(r => r.id === regionId);
          if (region && region.rooms) {
            // Check if any map in this region is explored
            isOwned = region.rooms.some(room => 
              globalThis.state?.player?.getSnapshot()?.context?.rooms?.[room.id] !== undefined
            );
          } else {
            isOwned = false;
          }
        } else {
          isOwned = false;
        }
      }
      
      const item = DOMUtils.createListItem(name, FONT_CONSTANTS.SIZES.BODY, isOwned, isPerfect, isT5, hasShiny);
      
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
            const itemName = el.textContent;
            if (type === 'creature') {
              const isUnobtainable = UNOBTAINABLE_CREATURES.some(c => c.toLowerCase() === itemName.toLowerCase());
              if (!isUnobtainable) {
                const isPerfect = isCreaturePerfect(itemName);
                const isOwned = isCreatureOwned(itemName);
                if (isPerfect) {
                  el.style.color = COLOR_CONSTANTS.PERFECT;
                  el.style.filter = 'none';
                } else if (!isOwned) {
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
        if (isPerfect) {
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
        if (isPerfect) {
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
        if (isPerfect) {
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
        if (isPerfect) {
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
        if (isPerfect) {
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



function injectCyclopediaButton(menuElem) {
  const body = document.body;
  const scrollLocked = body.getAttribute('data-scroll-locked');
  if (scrollLocked >= '2') {
    console.log('[Cyclopedia] Button injection blocked: scroll locked (level:', scrollLocked, ')');
    return false;
  }
  
        const existingButtons = Array.from(menuElem.querySelectorAll('.cyclopedia-menu-item'));
  existingButtons.forEach(btn => {
    try {
      if (btn.parentNode) btn.parentNode.removeChild(btn);
    } catch (error) {
    console.log('[Cyclopedia] Error in monster location cache:', error);
  }
  });
  
  if (existingButtons.length > 0) {
    console.log('[Cyclopedia] Button injection skipped: existing buttons found (count:', existingButtons.length, ')');
    return false;
  }
  
  // Check if this menu contains creature or equipment items
  const itemInfo = getItemNameFromMenu(menuElem);
  const monsterName = itemInfo?.type === 'monster' ? itemInfo.name : null;
  const equipmentName = itemInfo?.type === 'equipment' ? itemInfo.name : null;
  
  console.log('[Cyclopedia] Content detection:', {
    itemInfo: itemInfo,
    monsterName: monsterName || 'null',
    equipmentName: equipmentName || 'null',
    itemType: itemInfo?.type || 'null',
    menuText: menuElem.textContent?.substring(0, 200) || 'null'
  });
  
  // Additional check: ensure we're not in "My Account" or "Game Mode" menus
  const menuText = menuElem.textContent?.toLowerCase() || '';
  const isAccountMenu = menuText.includes('my account') || menuText.includes('logout') || menuText.includes('profile');
  const isGameModeMenu = menuText.includes('game mode') || menuText.includes('cyclopedia') || menuText.includes('manual') || menuText.includes('autoplay') || menuText.includes('sandbox');
  
  // Only inject Cyclopedia button if we found a valid creature or equipment AND we're not in account/game mode menus
  if ((!monsterName && !equipmentName) || isAccountMenu || isGameModeMenu) {
    console.log('[Cyclopedia] Button injection failed:', {
      monsterName: monsterName || 'null',
      equipmentName: equipmentName || 'null',
      isAccountMenu,
      isGameModeMenu,
      menuText: menuText.substring(0, 100) + (menuText.length > 100 ? '...' : '')
    });
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
    
    // Sequence: 10ms delay, press ESC, 10ms delay, then open cyclopedia
    const escTimeout = setTimeout(() => {
      // Press ESC to close context menu
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
      
      const openTimeout = setTimeout(() => {
        // Open cyclopedia
        const equipmentToOpen = matchedEquipment;
        const creatureToOpen = monsterName;
        if (equipmentToOpen) {
          openCyclopediaModal({ equipment: equipmentToOpen });
        } else if (creatureToOpen && typeof creatureToOpen === 'string') {
          openCyclopediaModal({ creature: creatureToOpen });
        } else {
          openCyclopediaModal({});
        }
      }, 10);
      TimerManager.addTimeout(openTimeout, 'cyclopediaOpen');
    }, 10);
    TimerManager.addTimeout(escTimeout, 'cyclopediaEsc');
  });
  const separator = menuElem.querySelector('.separator');
  if (separator) {
    separator.parentNode.insertBefore(cyclopediaItem, separator);
    console.log('[Cyclopedia] Button inserted before separator');
  } else {
    menuElem.appendChild(cyclopediaItem);
    console.log('[Cyclopedia] Button appended to menu end');
  }
  
  // Verify the button is actually in the DOM
  const buttonInDOM = menuElem.querySelector('[data-radix-collection-item]');
  console.log('[Cyclopedia] Button verification:', {
    buttonInDOM: !!buttonInDOM,
    buttonText: buttonInDOM?.textContent || 'null',
    buttonClasses: buttonInDOM?.className || 'null',
    menuChildren: menuElem.children.length,
    menuHTML: menuElem.innerHTML.substring(0, 300) + '...'
  });
  
  console.log('[Cyclopedia] Button injected successfully:', {
    monsterName: monsterName || 'null',
    equipmentName: equipmentName || 'null',
    hasSeparator: !!separator
  });
  
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
    console.log('[Cyclopedia] Error in monster location cache:', error);
  }
    window.cyclopediaGlobalObserver = null;
  }
  
  if (cyclopediaState.observer) {
    try {
      cyclopediaState.observer.disconnect();
    } catch (error) {
    console.log('[Cyclopedia] Error in monster location cache:', error);
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
              console.log('[Cyclopedia] Menu detected, attempting injection...');
              const injectionTimeout = setTimeout(() => {
                if (!injectCyclopediaButton(menu)) {
                  console.log('[Cyclopedia] First injection failed, retrying in 75ms...');
                  const retryTimeout = setTimeout(() => {
                    const retryResult = injectCyclopediaButton(menu);
                    console.log('[Cyclopedia] Retry result:', retryResult ? 'SUCCESS' : 'FAILED');
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
                console.log('[Cyclopedia] Menu detected (nested), attempting injection...');
                const nestedTimeout = setTimeout(() => {
                  if (!injectCyclopediaButton(menu)) {
                    console.log('[Cyclopedia] First injection failed (nested), retrying in 75ms...');
                    const nestedRetryTimeout = setTimeout(() => {
                      const retryResult = injectCyclopediaButton(menu);
                      console.log('[Cyclopedia] Retry result (nested):', retryResult ? 'SUCCESS' : 'FAILED');
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
    console.log('[Cyclopedia] Error in monster location cache:', error);
  }
    cyclopediaState.observer = null;
  }
  
  if (window.cyclopediaGlobalObserver) {
    try {
      window.cyclopediaGlobalObserver.disconnect();
    } catch (error) {
    console.log('[Cyclopedia] Error in monster location cache:', error);
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

function createStartPageManager() {
  const HTML_TEMPLATES = {
    loading: () => `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.TEXT};">
        <div style="font-size: 24px; margin-bottom: 16px;">📚</div>
        <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Loading Cyclopedia...</div>
        <div style="font-size: 14px; color: #888;">Fetching your profile data</div>
      </div>
    `,
    error: (message) => `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load Profile Data</div>
        <div style="font-size: 14px; margin-bottom: 16px; color: #888;">${message}</div>
        <button id="retry-profile-load" style="padding: 8px 16px; background: #444; border: 1px solid #666; border-radius: 4px; color: white; cursor: pointer; font-family: ${FONT_CONSTANTS.PRIMARY};">Retry</button>
      </div>
    `
  };

  const ERROR_MESSAGES = {
    'AbortError': 'Request timed out. Please check your internet connection and try again.',
    'Player name not available': 'Player name not available. Please ensure you are logged into the game.',
    'HTTP': 'Failed to fetch profile data. Please try again.'
  };

  class StartPageManager {
    constructor() {
      this.container = this.createContainer();
      this.timerElements = {};
      this.isInitialized = false;
    }

    createContainer() {
      const container = document.createElement('div');
      Object.assign(container.style, {
        display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
        padding: '20px', boxSizing: 'border-box', overflowY: 'scroll'
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
      return 'An unexpected error occurred while loading the profile data.';
    }

    showError(message, retryFunction) {
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
        
        this.renderLayout(playerState.name, profileData);
        this.setupTimers();
        this.isInitialized = true;
      } catch (error) {
        this.showError(this.getErrorMessage(error), () => this.initialize());
      }
    }

    renderLayout(playerName, profileData) {
        this.container.innerHTML = '';
        
        const mainFlexRow = document.createElement('div');
        Object.assign(mainFlexRow.style, {
          display: 'flex', flexDirection: 'row', width: '900px', height: '100%',
          margin: '0 auto', gap: '0', alignItems: 'center'
        });
        
      const leftCol = DOMUtils.createColumn(START_PAGE_CONFIG.COLUMN_WIDTHS.LEFT, renderCyclopediaWelcomeColumn(playerName));
        mainFlexRow.appendChild(leftCol);
        
      const middleCol = DOMUtils.createColumn(START_PAGE_CONFIG.COLUMN_WIDTHS.MIDDLE, renderCyclopediaPlayerInfo(profileData));
        Object.assign(middleCol.style, { justifyContent: 'center', padding: '0 12px' });
        mainFlexRow.appendChild(middleCol);
        
        const rightCol = renderDailyContextColumn();
        mainFlexRow.appendChild(rightCol);
        
        this.container.appendChild(mainFlexRow);
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

function openCyclopediaModal(options) {
  try {
    const now = Date.now();
    if (cyclopediaModalInProgress) return;
    if (now - lastModalCall < 1000) return;
    
    lastModalCall = now;
    cyclopediaModalInProgress = true;
    options = options || {};
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

    const allCreatures = GAME_DATA.ALL_CREATURES;

    let normalizedCreature = creatureToSelect && typeof creatureToSelect === 'string' ? creatureToSelect.trim().toLowerCase() : null;
    let foundCreature = null;
    if (normalizedCreature) {
      foundCreature = allCreatures.find(c => c.toLowerCase() === normalizedCreature) ||
                     GAME_DATA.UNOBTAINABLE_CREATURES.find(c => c.toLowerCase() === normalizedCreature);
    }
    if (foundCreature) {
      selectedCreature = foundCreature;
      activeTab = 1;
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
          try {
            mainContent.appendChild(page);
          } catch (error) {
    console.log('[Cyclopedia] Error in monster location cache:', error);
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
    console.log('[Cyclopedia] Error in monster location cache:', error);
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
        display: 'flex', flexDirection: 'row', width: '100%', height: '100%',
        alignItems: 'flex-start', justifyContent: 'center', gap: '0'
        },
        rightCol: {
          flex: '1', padding: '0', margin: '0', height: '100%', borderImage: 'none'
        },
        leftCol: {
          width: LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH, minWidth: LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH,
          maxWidth: LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH, padding: '0', margin: '0', height: '100%',
          display: 'flex', flexDirection: 'column', borderRight: '6px solid transparent',
          borderImage: `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`,
          overflowY: 'scroll', minHeight: '0'
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
            
            // Create first title: "Creatures" (80% width)
            const creaturesTitle = document.createElement('h2');
            creaturesTitle.className = 'widget-top widget-top-text pixel-font-16';
            creaturesTitle.style.cssText = `
              margin: 0px;
              padding: 2px 8px;
              text-align: center;
              color: rgb(255, 255, 255);
              width: 83%;
              flex: 0 0 83%;
            `;
            creaturesTitle.textContent = 'Creatures';
            titleContainer.appendChild(creaturesTitle);
            
            // Create the toggle button as a second title (same styling as "Creatures")
            const toggleButton = document.createElement('button');
            toggleButton.className = 'widget-top widget-top-text pixel-font-16';
            toggleButton.title = showShinyPortraits ? 'Shiny Mode' : 'Normal Mode';
            toggleButton.style.cssText = `
              margin: 0px;
              padding: 2px 8px;
              text-align: center;
              color: rgb(255, 255, 255);
              cursor: pointer;
              width: 15%;
              flex: 0 0 15%;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 16px;
              height: 100%;
              align-self: stretch;
              outline: none;
            `;
            
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
              
              console.log(`[Cyclopedia] Toggled to ${showShinyPortraits ? 'shiny' : 'normal'} portrait mode`);
              
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
      
      const creaturesBox = createCreatureBox('Creatures', GAME_DATA.ALL_CREATURES);
      const unobtainableBox = createCreatureBox('Unobtainable', GAME_DATA.UNOBTAINABLE_CREATURES);
      
      // Set custom flex values for height proportions: Creatures 60%, Unobtainable 40%
      creaturesBox.style.flex = '3 1 0';      // 3/5 = 60%
      unobtainableBox.style.flex = '2 1 0';   // 2/5 = 40%
      
      // Shared selection clearing
      const clearAllBestiarySelections = () => {
        [creaturesBox, unobtainableBox].forEach(box => {
          box.querySelectorAll('.cyclopedia-selected').forEach(el => {
          el.classList.remove('cyclopedia-selected');
          el.style.background = 'none';
          // Check creature status and restore appropriate styling
          const creatureName = el.textContent;
          if (box === creaturesBox) {
            const isUnobtainable = UNOBTAINABLE_CREATURES.some(c => c.toLowerCase() === creatureName.toLowerCase());
            if (!isUnobtainable) {
              const isPerfect = isCreaturePerfect(creatureName);
              const isOwned = isCreatureOwned(creatureName);
              if (isPerfect) {
                el.style.color = COLOR_CONSTANTS.PERFECT;
                el.style.filter = 'none';
              } else if (!isOwned) {
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
          } else {
            el.style.color = COLOR_CONSTANTS.TEXT;
            el.style.filter = 'none';
          }
        });
        });
      };
      
      creaturesBox.clearAllSelections = clearAllBestiarySelections;
      unobtainableBox.clearAllSelections = clearAllBestiarySelections;
      
      leftCol.appendChild(creaturesBox);
      leftCol.appendChild(unobtainableBox);
      d.appendChild(leftCol);
      d.appendChild(rightCol);
      updateRightColInternal();
      return d;
    }

    function createEquipmentTabPage(selectedCreature, selectedEquipment, selectedInventory, setSelectedCreature, setSelectedEquipment, setSelectedInventory, updateRightCol) {
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
        title: {
        margin: '0', padding: '2px 8px', textAlign: 'center', color: 'rgb(255, 255, 255)',
        width: '100%', boxSizing: 'border-box', marginBottom: '10px'
        },
        titleText: {
        margin: '0', padding: '0', textAlign: 'center', color: 'rgb(255, 255, 255)',
        width: '100%', boxSizing: 'border-box'
        }
      };

      const createTitleElement = (titleText, updateFunction) => {
        const title = document.createElement('h2');
        title.className = 'widget-top widget-top-text pixel-font-16';
        Object.assign(title.style, EQUIPMENT_STYLES.title);

        const titleP = document.createElement('p');
        titleP.className = 'pixel-font-16';
        Object.assign(titleP.style, EQUIPMENT_STYLES.titleText);

        if (updateFunction) updateFunction(titleP);
        title.appendChild(titleP);
        return { title, titleP };
      };

      const d = document.createElement('div');
      Object.assign(d.style, EQUIPMENT_STYLES.container);

      const equipDetailsCol = document.createElement('div');
      Object.assign(equipDetailsCol.style, EQUIPMENT_STYLES.column);
      equipDetailsCol.classList.add('text-whiteHighlight');

      // Create top section for equipment details
      const equipDetailsTop = document.createElement('div');
      Object.assign(equipDetailsTop.style, {
        flex: '0 0 30%', minHeight: '0', width: '100%', display: 'flex',
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
        flex: '0 0 65%', minHeight: '0', width: '100%', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        borderTop: '2px solid #444', marginTop: '5px', paddingTop: '5px'
      });

      const updateCreatureUsageTitle = (titleP) => {
        titleP.textContent = 'Creature Usage';
      };
      const { title: creatureUsageTitle, titleP: creatureUsageTitleP } = createTitleElement('Creature Usage', updateCreatureUsageTitle);
      equipDetailsBottom.appendChild(creatureUsageTitle);

      equipDetailsCol.appendChild(equipDetailsTop);
      equipDetailsCol.appendChild(equipDetailsBottom);

      const ownedEquipCol = document.createElement('div');
      Object.assign(ownedEquipCol.style, EQUIPMENT_STYLES.column);
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
        
        console.log('[Cyclopedia] Building equipment creature cache...');
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
            
            const regionName = region.id ? (GAME_DATA.REGION_NAME_MAP[region.id.toLowerCase()] || region.id.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())) : 'Unknown Region';
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

      function updateRightCol() {
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
          equipDetailsTop.innerHTML += '<div class="' + FONT_CONSTANTS.SIZES.BODY + '" style="text-align:center;">Select equipment to view details</div>';
          creatureUsageTitleP.textContent = 'Creature Usage';
          equipDetailsBottom.innerHTML += '<div class="' + FONT_CONSTANTS.SIZES.BODY + '" style="text-align:center;">Select equipment to view creature usage</div>';
        } else {
          equipDetailsTitleP.textContent = currentSelectedEquipment;
          creatureUsageTitleP.textContent = `Creatures using ${currentSelectedEquipment}`;
          
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
            equipDetailsTop.innerHTML += '<div class="' + FONT_CONSTANTS.SIZES.BODY + '" style="text-align:center;">Equipment not found</div>';
            equipDetailsBottom.innerHTML += '<div class="' + FONT_CONSTANTS.SIZES.BODY + '" style="text-align:center;">Equipment not found</div>';
          } else {
            const equipData = globalThis.state.utils.getEquipment(equipId);
            
            // Equipment details section
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.alignItems = 'center';
            wrap.style.justifyContent = 'center';
            wrap.style.width = '100%';
            wrap.style.maxWidth = '100%';

            let portrait = api.ui.components.createItemPortrait({
              itemId: equipData?.metadata?.spriteId,
              tier: 5
            });

            if (portrait.tagName === 'BUTTON' && portrait.firstChild) {
              portrait = portrait.firstChild;
            }

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
            } else if (equipData?.metadata?.EffectComponent && typeof globalThis.state.utils.createUIComponent === 'function') {
              const tooltipComponent = globalThis.state.utils.createUIComponent(tooltipDiv, equipData.metadata.EffectComponent);
              tooltipComponent.mount();
            } else {
              tooltipDiv.textContent = 'No description available.';
            }

            wrap.appendChild(portrait);
            wrap.appendChild(tooltipDiv);
            equipDetailsTop.appendChild(wrap);

            // Creature usage section
            const creatureUsageContainer = document.createElement('div');
            creatureUsageContainer.style.cssText = `
              width: 100%; height: 100%; overflow-y: auto; padding: 6px; box-sizing: border-box;
              display: flex; flex-direction: column; gap: 4px;
            `;

            // Get creature usage data
            const creatureUsageData = getCreatureUsageForEquipment(equipId);
            
            if (creatureUsageData.length === 0) {
              const noUsageDiv = document.createElement('div');
              noUsageDiv.className = FONT_CONSTANTS.SIZES.SMALL;
              noUsageDiv.style.textAlign = 'center';
              noUsageDiv.style.color = '#888';
              noUsageDiv.style.padding = '20px';
              noUsageDiv.style.fontStyle = 'italic';
              noUsageDiv.textContent = 'No creatures found using this equipment';
              creatureUsageContainer.appendChild(noUsageDiv);
            } else {
              
              // Group maps by region
              const mapsByRegion = {};
              creatureUsageData.forEach(usage => {
                const regionName = usage.regionName || 'Other Maps';
                if (!mapsByRegion[regionName]) {
                  mapsByRegion[regionName] = [];
                }
                mapsByRegion[regionName].push(usage);
              });
              
              // Display maps grouped by region
              Object.entries(mapsByRegion).forEach(([regionName, maps]) => {
                // Add region header (styled like Bestiary Tab)
                const regionHeader = document.createElement('div');
                regionHeader.className = 'pixel-font-16';
                regionHeader.style.cssText = `
                  font-weight: 700; color: var(--theme-text, #e6d7b0);
                  background: url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png");
                  border-width: 6px; border-style: solid; border-color: rgb(255, 224, 102);
                  border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill;
                  border-radius: 0px; box-sizing: border-box; text-align: center;
                  padding: 1px 4px; margin: 1px 0px 0px; display: block;
                `;
                regionHeader.textContent = regionName;
                creatureUsageContainer.appendChild(regionHeader);
                
                // Add maps for this region
                maps.forEach(usage => {
                  const usageDiv = document.createElement('div');
                  usageDiv.style.cssText = `
                    padding: 4px 6px; display: flex; flex-direction: column; gap: 3px;
                    margin-top: 2px; margin-bottom: 2px; line-height: 1;
                    letter-spacing: 0.0625rem; word-spacing: -0.1875rem;
                    color: rgb(255, 255, 255);
                  `;
                  usageDiv.className = 'pixel-font-16';
                  
                  // Map name with click functionality
                  const mapNameDiv = document.createElement('div');
                  mapNameDiv.className = 'pixel-font-14';
                  mapNameDiv.style.cssText = `
                    font-weight: bold; line-height: 1; letter-spacing: 0.0625rem;
                    word-spacing: -0.1875rem; margin: 0px; padding: 2px 6px;
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
                  mapNameSpan.textContent = usage.mapName;
                  
                  // Attach map navigation handler
                  NavigationHandler.attachMapNavigation(mapNameDiv, usage.mapName);
                  
                  mapNameDiv.appendChild(mapNameSpan);
                  usageDiv.appendChild(mapNameDiv);
                  
                  // Creature info
                  const creatureInfoDiv = document.createElement('div');
                  creatureInfoDiv.className = 'pixel-font-14';
                  creatureInfoDiv.style.cssText = `
                    color: rgb(170, 170, 170); line-height: 1;
                    letter-spacing: 0.0625rem; word-spacing: -0.1875rem;
                    margin-left: 6px; margin-top: 0px; font-style: italic;
                  `;
                  creatureInfoDiv.textContent = `${usage.creatures.join(', ')}`;
                  usageDiv.appendChild(creatureInfoDiv);
                  
                  // Add separator
                  const separator = document.createElement('div');
                  separator.className = 'separator my-2.5';
                  separator.setAttribute('role', 'none');
                  separator.style.cssText = 'margin: 3px 0px;';
                  usageDiv.appendChild(separator);
                  
                  creatureUsageContainer.appendChild(usageDiv);
                });
              });
            }

            equipDetailsBottom.appendChild(creatureUsageContainer);
          }
        }

        ownedEquipCol.innerHTML = '';
        ownedEquipCol.appendChild(ownedEquipTitle);

        if (!currentSelectedEquipment) {
          ownedEquipTitleP.textContent = 'Owned Equipment';
          ownedEquipCol.innerHTML += '<div class="' + FONT_CONSTANTS.SIZES.BODY + '" style="text-align:center;">Select equipment to view owned</div>';
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
          console.log('[Cyclopedia] Error in creature ownership check:', e);
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
            noEquipmentDiv.textContent = 'You do not own this equipment.';
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
          console.log('[Cyclopedia] Error in creature ownership check:', e);
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
        overflowY: 'scroll', minHeight: '0'
      });

      leftCol.appendChild(createEquipmentBox({
        title: 'Equipment',
        items: allEquipment
      }));

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
        overflowY: 'scroll', minHeight: '0'
      });

      const sharedScrollContainer = DOMUtils.createElement('div');
      sharedScrollContainer.style.cssText = `
        flex: 1 1 0; display: flex; flex-direction: row; height: 100%; overflow-y: auto;
        border-right: 6px solid transparent;
        border-image: url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch;
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
      const playerSearchBox = createPlayerSearchBox(selectedCreature, selectedEquipment, selectedInventory, setSelectedCreature, setSelectedEquipment, setSelectedInventory);

      function showLoadingState(col2) {
        col2.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.TEXT}; text-align: center; padding: 20px;"><div style="font-size: 24px; margin-bottom: 16px;">📚</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Loading...</div><div style="font-size: 14px; color: #888;">Fetching profile data</div></div>`;
      }

      function showErrorState(col2, message) {
        col2.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;"><div style="font-size: 48px; margin-bottom: 16px;">⚠️</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load Profile Data</div><div style="font-size: 14px; margin-bottom: 16px; color: #888;">${message}</div><div style="font-size: 12px; color: #666;">Please check your internet connection and try again.</div></div>`;
      }

      function createUserStatsContainer(profileData) {
        const container = DOMUtils.createElement('div');
        Object.assign(container.style, {
          display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
          padding: '20px', boxSizing: 'border-box', overflowY: 'scroll'
        });

        const userInfoContent = renderCyclopediaPlayerInfo(profileData);
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
          showLoadingState(col2);

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

      async function fetchRankingsFromWiki() {
        try {
          const apiUrl = 'https://bestiaryarena.wiki.gg/api.php?action=query&prop=revisions&titles=Rankings&rvslots=*&rvprop=content&formatversion=2&format=json&origin=*';
          const response = await fetch(apiUrl);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (!data.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content) {
            throw new Error('Invalid response format from wiki API');
          }
          
          const wikitext = data.query.pages[0].revisions[0].slots.main.content;

          const timestampMatch = wikitext.match(/Updated \(([^)]+)\)/);
          const timestamp = timestampMatch ? timestampMatch[1] : null;

          let tableMatch = wikitext.match(/\{\|[\s\S]*?\|\}/s);
          if (!tableMatch) {
            tableMatch = wikitext.match(/\{\|[\s\S]*?\|\}/);
            if (!tableMatch) {
              tableMatch = wikitext.match(/\{\|[\s\S]*\|\}/s);
            }
          }
          
          if (!tableMatch) {
            return { rankings: [], timestamp: timestamp };
          }
          
          const table = tableMatch[0];
          const rows = table.split('|-').slice(1);

          const rankings = [];
          let rank = 1;

          rows.forEach((row, rowIndex) => {
            const cols = row.split('|').map(s => s.trim()).filter(Boolean);
            if (cols.length < 11) {
              console.log(`[Cyclopedia] Skipping row ${rowIndex + 1}: insufficient columns (${cols.length}), expected at least 11`);
              return;
            }
            
            let username = cols[0];
            const usernameMatch = username.match(/\[https:\/\/bestiaryarena\.com\/profile\/[^\s\]]+\s+([^\]]+)\]/);
            if (usernameMatch) {
              username = usernameMatch[1];
            } else {
              username = username.replace(/[\[\]]/g, '');
            }
            const level = parseInt(cols[1], 10);
            const successfulRuns = parseInt(cols[2], 10);
            const rankPoints = parseInt(cols[3], 10);
            const timeSum = parseInt(cols[4], 10);
            const hasFloors = cols.length >= 12;
            const floors = hasFloors ? parseInt(cols[5], 10) : 0;
            const dailySeashell = hasFloors ? parseInt(cols[6], 10) : parseInt(cols[5], 10);
            const huntingTasks = hasFloors ? parseInt(cols[7], 10) : parseInt(cols[6], 10);
            const raids = hasFloors ? parseInt(cols[8], 10) : parseInt(cols[7], 10);
            const perfectCreatures = hasFloors ? parseInt(cols[9], 10) : parseInt(cols[8], 10);
            const bisEquipment = hasFloors ? parseInt(cols[10], 10) : parseInt(cols[9], 10);
            const bagOutfits = hasFloors ? parseInt(cols[11], 10) : parseInt(cols[10], 10);
            
            if (isNaN(level) || !username) {
              console.log(`[Cyclopedia] Skipping row ${rowIndex + 1}: invalid data (level: ${level}, username: ${username})`);
              return;
            }
            
            rankings.push({
              rank: rank,
              name: username,
              level: level,
              successfulRuns: successfulRuns,
              rankPoints: rankPoints,
              timeSum: timeSum,
              floors: isNaN(floors) ? 0 : floors,
              dailySeashell: dailySeashell,
              huntingTasks: huntingTasks,
              raids: raids,
              perfectCreatures: perfectCreatures,
              bisEquipment: bisEquipment,
              bagOutfits: bagOutfits
            });
            
            rank++;
          });
          
          if (rankings.length === 0) {
            console.warn('[Cyclopedia] No valid rankings data found in wiki table');
          }
          
          return { rankings: rankings, timestamp: timestamp };
        } catch (error) {
          console.error('[Cyclopedia] Error fetching rankings from wiki:', error);
          throw error;
        }
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
          const rooms = playerState.rooms;
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

          displayUserSpeedrunOrRankData(category, playerState.name, rooms, ROOM_NAMES, best, roomsHighscores, col2);
          updateSearchForSpeedrunOrRank(category, rooms, ROOM_NAMES, best, roomsHighscores);

        } catch (error) {
          console.error('[Cyclopedia] Error displaying speedrun/rank data:', error);
          col2.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;"><div style="font-size: 48px; margin-bottom: 16px;">⚠️</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load ${category} Data</div><div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not fetch game data</div><div style="font-size: 12px; color: #666;">Please check your internet connection and try again.</div></div>`;
        }
      }

      async function displayCombinedLeaderboardsData(playerState) {
        try {
          const ROOM_NAMES = globalThis.state.utils.ROOM_NAME;
          const rooms = playerState.rooms;
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

          displayUserCombinedLeaderboardsData(playerState.name, rooms, ROOM_NAMES, best, roomsHighscores, col2);
          updateSearchForCombinedLeaderboards(rooms, ROOM_NAMES, best, roomsHighscores);

        } catch (error) {
          console.error('[Cyclopedia] Error displaying combined leaderboards data:', error);
          col2.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;"><div style="font-size: 48px; margin-bottom: 16px;">⚠️</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load Leaderboards Data</div><div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not fetch game data</div><div style="font-size: 12px; color: #666;">Please check your internet connection and try again.</div></div>`;
        }
      }

      async function displayRankingsData(playerState) {
        try {
          let rankingsData = getCachedRankingsData();
          if (!rankingsData) {
            rankingsData = await fetchRankingsFromWiki();
            setCachedRankingsData(rankingsData);
          }
          
          const rankings = rankingsData.rankings || rankingsData;
          const timestamp = rankingsData.timestamp;
          
          let allRankings = [...rankings];
          let currentSortColumn = 'level';
          let currentSortDirection = 'desc';
          
          const rankingsGridColumns = '48px 120px 53px 53px 40px 48px 40px 40px 40px 40px 40px 40px 40px';
          
          const containerDiv = document.createElement('div');
          Object.assign(containerDiv.style, {
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            padding: '20px', boxSizing: 'border-box'
          });

          const contentContainer = document.createElement('div');
          contentContainer.style.cssText = `flex: 1; padding: 10px; overflow-y: auto; position: relative; height: 100%;`;

          const currentPlayerRank = rankings.find(r => r.name.toLowerCase() === playerState.name.toLowerCase());

          const tableContainer = document.createElement('div');
          tableContainer.className = 'pixel-font-14';
          tableContainer.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            overflow: hidden;
            font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
            font-size: 10px;
            position: relative;
            height: 100%;
            display: flex;
            flex-direction: column;
          `;

          const headerRow = document.createElement('div');
          headerRow.style.cssText = `
            display: grid;
            grid-template-columns: ${rankingsGridColumns};
            gap: 1px;
            background: rgba(255, 224, 102, 0.2);
            position: sticky;
            top: 0;
            z-index: 10;
            width: 100%;
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
          
          headerData.forEach((item, index) => {
            const headerCell = document.createElement('div');
            headerCell.className = 'pixel-font-14';
            headerCell.style.cssText = `
              padding: 8px 4px;
              color: ${COLOR_CONSTANTS.PRIMARY};
              font-weight: bold;
              text-align: center;
              border-right: 1px solid rgba(255, 255, 255, 0.1);
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
              font-size: 10px;
              ${item.sortable ? 'cursor: pointer;' : 'cursor: default;'}
              transition: all 0.2s ease;
            `;
            
            // Add sort indicator for current sort column
            if (item.key === currentSortColumn) {
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
            
            if (item.key === currentSortColumn) {
              const sortIndicator = document.createElement('span');
              sortIndicator.textContent = currentSortDirection === 'desc' ? ' ▼' : ' ▲';
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
              
              if (sortKey === currentSortColumn) {
                currentSortDirection = currentSortDirection === 'desc' ? 'asc' : 'desc';
              } else {
                currentSortColumn = sortKey;
                currentSortDirection = 'desc';
              }
              
              allRankings.sort((a, b) => {
                let aVal = a[sortKey];
                let bVal = b[sortKey];
                
                if (typeof aVal === 'string') {
                  aVal = aVal.toLowerCase();
                  bVal = bVal.toLowerCase();
                }
                
                let primarySort = 0;
                
                if (sortKey === 'timeSum') {
                  if (currentSortDirection === 'desc') {
                    primarySort = aVal - bVal;
                  } else {
                    primarySort = bVal - aVal;
                  }
                } else {
                  if (typeof aVal === 'string') {
                    if (currentSortDirection === 'desc') {
                      primarySort = bVal.localeCompare(aVal);
                    } else {
                      primarySort = aVal.localeCompare(bVal);
                    }
                  } else {
                    if (currentSortDirection === 'desc') {
                      primarySort = bVal - aVal;
                    } else {
                      primarySort = aVal - bVal;
                    }
                  }
                }
                
                if (primarySort === 0) {
                  return b.level - a.level;
                }
                
                return primarySort;
              });
              
              renderRankingsTable();
              updateHeaderHighlighting();
            });
          }
            
            if (item.sortable) {
              headerCell.addEventListener('mouseenter', () => {
                if (item.key !== currentSortColumn) {
                  headerCell.style.background = 'rgba(255, 224, 102, 0.1)';
                }
              });
              
              headerCell.addEventListener('mouseleave', () => {
                if (item.key !== currentSortColumn) {
                  headerCell.style.background = 'transparent';
                }
              });
            }
            
            headerRow.appendChild(headerCell);
          });
          
                    tableContainer.appendChild(headerRow);
          
          const scrollableContainer = document.createElement('div');
          scrollableContainer.style.cssText = `
            overflow-y: auto;
            max-height: calc(100vh - 300px);
            min-height: 400px;
            flex: 1;
            display: flex;
            flex-direction: column;
          `;
          
          const dataRowsContainer = document.createElement('div');
          dataRowsContainer.style.cssText = `
            display: grid;
            grid-template-columns: ${rankingsGridColumns};
            gap: 1px;
            min-height: fit-content;
            flex: 1;
          `;

          allRankings.sort((a, b) => b.level - a.level);
          
          function renderRankingsTable() {
            dataRowsContainer.innerHTML = '';
            
            allRankings.forEach((ranking, index) => {
            const isCurrentPlayer = ranking.name.toLowerCase() === playerState.name.toLowerCase();
            const isSearchedPlayer = cyclopediaState.searchedUsername && ranking.name.toLowerCase() === cyclopediaState.searchedUsername.toLowerCase();
            
            let rowBackground;
            if (isSearchedPlayer) {
              rowBackground = 'url("https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png")';
            } else if (isCurrentPlayer) {
              rowBackground = 'url("https://bestiaryarena.com/_next/static/media/background-green.be515334.png")';
            } else {
              rowBackground = index % 2 === 0 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)';
            }
            const rowBorder = 'none';

            let rankIcon = '🥉';
            if (ranking.rank === 1) rankIcon = '🥇';
            else if (ranking.rank === 2) rankIcon = '🥈';
            else if (ranking.rank <= 10) rankIcon = '🏅';

            const cellData = [
              `${rankIcon} #${currentSortDirection === 'desc' ? index + 1 : allRankings.length - index}`,
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

            cellData.forEach((text, cellIndex) => {
              const cell = document.createElement('div');
              cell.className = 'pixel-font-14';
              cell.style.cssText = `
                padding: 6px 4px;
                background: ${rowBackground};
                color: #fff;
                font-weight: ${isCurrentPlayer || isSearchedPlayer ? 'bold' : 'normal'};
                text-align: ${cellIndex === 0 ? 'left' : cellIndex === 1 ? 'left' : 'center'};
                border-right: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                align-items: center;
                justify-content: ${cellIndex === 0 ? 'flex-start' : cellIndex === 1 ? 'flex-start' : 'center'};
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                border: ${rowBorder};
                font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
                font-size: 10px;
              `;
              
              if (cellIndex === 1) {
                NavigationHandler.attachProfileNavigation(cell, ranking.name, { color: '#fff' });
              }
              
              cell.textContent = text;
              dataRowsContainer.appendChild(cell);
            });
          });
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
              
              if (item.key === currentSortColumn) {
                cell.style.background = 'rgba(255, 224, 102, 0.2)';
                
                const sortIndicator = document.createElement('span');
                sortIndicator.textContent = currentSortDirection === 'desc' ? ' ▼' : ' ▲';
                sortIndicator.style.cssText = `
                  margin-left: 4px;
                  font-size: 8px;
                  color: ${COLOR_CONSTANTS.PRIMARY};
                `;
                cell.appendChild(sortIndicator);
              }
            });
          }
          
          renderRankingsTable();
          updateHeaderHighlighting();
          
          scrollableContainer.appendChild(dataRowsContainer);
          tableContainer.appendChild(scrollableContainer);

          contentContainer.appendChild(tableContainer);

          const infoContainer = document.createElement('div');
          infoContainer.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
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

          const tooltip = document.createElement('div');
          tooltip.style.cssText = `
            position: absolute;
            top: 100%;
            right: 0;
            width: 280px;
            background: rgba(35, 35, 35, 0.95);
            border: 2px solid ${COLOR_CONSTANTS.PRIMARY};
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
          tooltip.innerHTML = `
            <div style="font-size: 16px; margin-bottom: 8px; color: ${COLOR_CONSTANTS.PRIMARY}; font-weight: bold;">📊 Data Source</div>
            <div style="margin-bottom: 6px;">Rankings fetched from <a href="https://bestiaryarena.wiki.gg/wiki/Rankings" target="_blank" style="color: #ffe066; text-decoration: underline;">Bestiary Arena Wiki</a></div>
            <div style="margin-bottom: 6px; font-size: 11px; color: #ccc;">Shows all players who completed all 64 maps, sorted by level</div>
            <div style="font-size: 10px; color: #888;">${timestamp ? `Updated: ${timestamp}` : 'No timestamp available'}</div>
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
          contentContainer.appendChild(infoContainer);

          containerDiv.appendChild(contentContainer);

          col2.innerHTML = '';
          col2.appendChild(containerDiv);

        } catch (error) {
          console.error('[Cyclopedia] Error displaying rankings data:', error);
          col2.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${COLOR_CONSTANTS.ERROR}; text-align: center; padding: 20px;"><div style="font-size: 48px; margin-bottom: 16px;">⚠️</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load Rankings</div><div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not fetch rankings from wiki</div><div style="font-size: 12px; color: #666;">Please check your internet connection and try again.</div></div>`;
        }
      }

      function displayUserSpeedrunOrRankData(category, playerName, rooms, ROOM_NAMES, best, roomsHighscores, container, isTemplate = false) {
        function formatTime(ms) {
          if (!ms || isNaN(ms) || ms < 0) return '--:--.---';
          const totalSeconds = Math.floor(ms / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          const milliseconds = Math.floor((ms % 1000) / 10);
          return `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}.${milliseconds.toString().padStart(3,'0')}`;
        }
        
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
        window.currentSpeedrunRankData = { yourRooms, ROOM_NAMES, best, roomsHighscores };
      }

      function updateSearchForCombinedLeaderboards(yourRooms, ROOM_NAMES, best, roomsHighscores) {
        window.currentSpeedrunRankCategory = 'Combined';
        window.currentSpeedrunRankData = { yourRooms, ROOM_NAMES, best, roomsHighscores };
        
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
        
        if (region.name) {
          return region.name;
        }
        
        const regionId = region.id ? region.id.toLowerCase() : '';
        if (GAME_DATA.REGION_NAME_MAP[regionId]) {
          return GAME_DATA.REGION_NAME_MAP[regionId];
        }
        
        return region.id ? (GAME_DATA.REGION_NAME_MAP[region.id.toLowerCase()] || region.id.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())) : 'Unknown Region';
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
        function formatTime(ms) {
          if (!ms || isNaN(ms) || ms < 0) return '--:--.---';
          const totalSeconds = Math.floor(ms / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          const milliseconds = Math.floor((ms % 1000) / 10);
          return `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}.${milliseconds.toString().padStart(3,'0')}`;
        }

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
        
        // Use new rooms data from profilePageData if available, otherwise fall back to highscores
        const searchedRooms = searchedProfileData.rooms || {};
        const searchedHighscores = searchedProfileData.highscores || [];
        
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
        function formatTime(ms) {
          if (!ms || isNaN(ms) || ms < 0) return '--:--.---';
          const totalSeconds = Math.floor(ms / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          const milliseconds = Math.floor((ms % 1000) / 10);
          return `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}.${milliseconds.toString().padStart(3,'0')}`;
        }

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
            const yourRoom = yourRooms[roomCode];
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
            <span style="color: ${COLOR_CONSTANTS.PRIMARY}; font-weight: bold;">${truncatePlayerName(playerName)}:</span>
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
            <span style="color: ${COLOR_CONSTANTS.PRIMARY}; font-weight: bold;">${truncatePlayerName(playerName)}:</span>
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
            <span style="color: ${COLOR_CONSTANTS.PRIMARY}; font-weight: bold;">${truncatePlayerName(playerName)}:</span>
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
          });
          
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
          const playerInfoContent = renderCyclopediaPlayerInfo(profileData);
          
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
                  displayUserStats('Rankings').catch(error => {
                    console.error('[Cyclopedia] Error refreshing rankings after reset:', error);
                  });
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
                // Refresh rankings to clear the previous blue background
                displayUserStats('Rankings').catch(error => {
                  console.error('[Cyclopedia] Error clearing previous search from rankings:', error);
                });
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
                // Refresh the rankings display to show the searched player with blue background
                displayUserStats('Rankings').catch(error => {
                  console.error('[Cyclopedia] Error refreshing rankings after search:', error);
                });
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
              col3.style.display = 'flex';
              col2.style.flex = '1 1 0';
              col2.style.maxWidth = '50%';
              
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
                      });
                      
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
                    });
                    
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
              col3.style.display = 'flex';
              col2.style.flex = '1 1 0';
              col2.style.maxWidth = '50%';
              
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
              col3.style.display = 'none';
              col2.style.flex = '1 1 0';
              col2.style.maxWidth = '100%';
              
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
            
            // Only call displayUserStats for Rankings since we handle Player Information and Leaderboards manually
            if (selectedCharacterItem === 'Rankings') {
              displayUserStats(selectedCharacterItem).catch(error => {
                console.error('[Cyclopedia] Error updating user stats:', error);
              });
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
            });
            
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

      let selectedCategory = 'Consumables';
      let selectedInventoryItem = null;



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
      const allInventoryCategories = Object.keys(INVENTORY_CONFIG.categories);

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
          return parseInt(countText.replace(/,/g, ''));
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
          '43672': { key: 'monsterCauldron', name: 'Monster Cauldron' },
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
          'monster-cauldron': () => ({ key: 'monsterCauldron', name: 'Monster Cauldron' }),
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

      const mainItemCategories = {
        'Consumables': [
          'Change Nickname',
          'Dice Manipulators',
          'Exaltation Chests',
          'Nickname Creature',
          'Outfit Bags',
          'Stamina Potions',
          'Stones of Insight',
          'Summon Scrolls',
          'Surprise Cubes'
        ],
        'Currency': [
          'Beast Coins',
          'Dust',
          'Gold',
          'Hunting Marks'
        ],
        'Upgrades': [
          'Daily Boosted Map',
          'Daycare',
          'Dragon Plant',
          'Hy\'genie',
          'Monster Cauldron',
          'Monster Squeezer',
          'Mountain Fortress',
          'Premium',
          'The Sweaty Cyclop\'s Forge',
          'Yasir\'s Trading Contract'
        ]
      };



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
            let count = 0;
            let realIcon = icon;
            let realRarity = rarity;
            
            if (itemData && typeof itemData === 'object') {
              count = itemData.count || 0;
              realIcon = itemData.icon || icon;
              realRarity = itemData.rarity || rarity;
            } else {
              count = inventory[itemKey] || 0;
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
          let count = 0;
          let realIcon = icon;
          let realRarity = rarity;
          
          if (itemData && typeof itemData === 'object') {
            count = itemData.count || 0;
            realIcon = itemData.icon || icon;
            realRarity = itemData.rarity || rarity;
          } else {
            count = inventory[itemKey] || 0;
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
          
          const itemData = inventory[itemKey];
          
          if (itemData && typeof itemData === 'object') {
            return itemData.count || 0;
          }
          return inventory[itemKey] || 0;
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
          
          const mainItemCategories = INVENTORY_CONFIG.categories || {};
          const rawItems = mainItemCategories[selectedCategory] || [];
          const items = rawItems.map(itemKey => getItemDisplayName(itemKey));
          
          const box = createBox({
            title: selectedCategory,
            items: items,
            type: 'inventory',
            selectedCreature: null,
            selectedEquipment: null,
            selectedInventory: selectedInventoryItem ? getItemDisplayName(selectedInventoryItem) : null,
            setSelectedCreature: () => {},
            setSelectedEquipment: () => {},
            setSelectedInventory: (itemDisplayName) => {
              // Find the key that corresponds to this display name
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
          if (selectedInventoryItem) {
            const itemVariants = INVENTORY_CONFIG.variants || {};
            if (INVENTORY_CONFIG.variants[selectedInventoryItem]) {
              rightCol.innerHTML = renderItemVariants(selectedInventoryItem);
            } else {
              rightCol.innerHTML = renderItemDetails(selectedInventoryItem);
            }
          } else {
            rightCol.innerHTML = '<div class="' + FONT_CONSTANTS.SIZES.BODY + '" style="display:flex;justify-content:center;align-items:center;height:100%;width:100%;color:' + COLOR_CONSTANTS.TEXT + ';font-weight:bold;text-align:center;">Select an item category to view variants.</div>';
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
          return Array.isArray(runs) ? runs : [];
        }
        return [];
      } catch (error) {
        console.error('[Cyclopedia] Error getting local runs:', error);
        return [];
      }
    }

    // Helper function to create statistics section
    function createStatisticsSection(selectedMap) {
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
      speedrunCol.style.display = 'flex';
      speedrunCol.style.flexDirection = 'column';
      speedrunCol.style.padding = '10px';
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
      speedrunContent.style.padding = '6px';
      speedrunContent.innerHTML = '<div style="margin-bottom: 10px;">Loading...</div>';
      speedrunCol.appendChild(speedrunContent);
      
      // Column 2: Rank Points
      const rankPointsCol = document.createElement('div');
      rankPointsCol.style.flex = '1 1 0';
      rankPointsCol.style.maxWidth = '160px';
      rankPointsCol.style.display = 'flex';
      rankPointsCol.style.flexDirection = 'column';
      rankPointsCol.style.padding = '10px';
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
      rankPointsContent.style.padding = '6px';
      rankPointsContent.innerHTML = '<div style="margin-bottom: 10px;">Loading...</div>';
      rankPointsCol.appendChild(rankPointsContent);
      
      // Column 3: Floors
      const floorsCol = document.createElement('div');
      floorsCol.style.flex = '1 1 0';
      floorsCol.style.maxWidth = '160px';
      floorsCol.style.display = 'flex';
      floorsCol.style.flexDirection = 'column';
      floorsCol.style.padding = '10px';
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
      floorsContent.style.padding = '6px';
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
      
      // Left column: Top 5 Speedruns
      const speedrunTableCol = document.createElement('div');
      speedrunTableCol.setAttribute('data-table-type', 'speedrun');
      speedrunTableCol.style.flex = '1 1 0';
      speedrunTableCol.style.maxWidth = '160px';
      speedrunTableCol.style.display = 'flex';
      speedrunTableCol.style.flexDirection = 'column';
      speedrunTableCol.style.padding = '10px';
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
        border: '1px solid #444',
        borderRadius: '4px',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.02)'
      });
      
      // Table header
      const speedrunHeader = DOMUtils.createStyledElement('div', {
        display: 'grid',
        gridTemplateColumns: '1fr 20px 20px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderBottom: '1px solid #444',
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
      
      // Store yourRooms data for warning icon comparisons
      let currentYourRooms = null;
      
      // Function to populate speedrun table with local data
      async function populateSpeedrunTable() {
        try {
          console.log(`[Cyclopedia] Populating speedrun table for map: ${selectedMap}`);
          // Resolve the map name to ensure consistency with RunTracker
          const resolvedMapName = resolveMapName(selectedMap);
          const mapKey = `map_${resolvedMapName.toLowerCase().replace(/\s+/g, '_')}`;
          console.log(`[Cyclopedia] Resolved map name: "${selectedMap}" -> "${resolvedMapName}"`);
          console.log(`[Cyclopedia] Generated mapKey: ${mapKey}`);
          let localRuns = await getLocalRunsForMap(mapKey, 'speedrun');
          console.log(`[Cyclopedia] Retrieved ${localRuns ? localRuns.length : 0} speedrun records:`, localRuns);
          
          // Ensure currentYourRooms is populated for warning icon comparisons
          if (!currentYourRooms) {
            const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
            currentYourRooms = playerState?.rooms || {};
            console.log(`[Cyclopedia] Populated currentYourRooms from player state:`, currentYourRooms);
          }
          
          // Filter out defeated runs with 0 rank points (for consistency)
          if (localRuns && localRuns.length > 0) {
            const originalCount = localRuns.length;
            localRuns = localRuns.filter(run => !run.points || run.points > 0);
            const filteredCount = localRuns.length;
            if (originalCount !== filteredCount) {
              console.log(`[Cyclopedia] Filtered out ${originalCount - filteredCount} defeated runs (0 rank points) from speedrun table`);
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
            console.log(`[Cyclopedia] Sorted speedrun records:`, localRuns);
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
            console.log(`[Cyclopedia] Processing speedrun run ${i + 1}:`, run);
            
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
              console.log(`[Cyclopedia] Speedrun run ${i + 1} ticks: ${run.time} -> ${formatLocalRunTime(run.time)}`);
              
              // Check if this run is lower than "Your Best" and add warning icon
              const yourTicks = currentYourRooms?.[selectedMap]?.ticks || 0;
              if (yourTicks > 0 && run.time < yourTicks) {
                // Create warning icon separately for left alignment
                const warningIcon = document.createElement('span');
                warningIcon.innerHTML = '⚠️';
                warningIcon.title = 'This run might be invalid';
                warningIcon.style.cursor = 'help';
                warningIcon.style.position = 'absolute';
                warningIcon.style.left = '1px';
                warningIcon.style.fontSize = '10px';
                warningIcon.style.zIndex = '1';
                
                // Create time text centered with left margin to avoid overlap
                timeText.textContent = formatLocalRunTime(run.time);
                timeText.style.textAlign = 'center';
                timeText.style.flex = '1';
                timeText.style.marginLeft = '12px';
                
                timeCell.appendChild(warningIcon);
                timeCell.appendChild(timeText);
                
                // Make the entire row red
                row.style.color = '#ff6b6b';
                console.log(`[Cyclopedia] Added warning icon for speedrun run ${i + 1}: ${run.time} < ${yourTicks}`);
              } else {
                timeText.textContent = formatLocalRunTime(run.time);
                timeCell.appendChild(timeText);
              }
            } else {
              timeCell.textContent = 'N/A';
              console.log(`[Cyclopedia] Speedrun run ${i + 1} has no time property`);
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
                
                console.log(`[Cyclopedia] Copy button clicked for speedrun run:`, run);
                
                // Generate replay command with board configuration if available
                let replayData = {};
                
                // Get proper region and map names
                let regionName = 'Unknown Region';
                let mapName = resolveMapName(selectedMap); // Use resolved map name
                
                // First, try to use the region name that RunTracker already resolved and saved
                if (run.regionName) {
                  regionName = run.regionName;
                  console.log('[Cyclopedia] Using saved region name from RunTracker:', regionName);
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
                      regionName = GAME_DATA.REGION_NAME_MAP[foundRegion.id] || foundRegion.id;
                      console.log('[Cyclopedia] Found region for map using game state utils:', regionName);
                    } else {
                      // Fallback: try to get region from current game state (this is the problematic part)
                      const boardSnapshot = globalThis.state?.board?.getSnapshot();
                      if (boardSnapshot?.context?.selectedMap?.selectedRegion?.name) {
                        regionName = boardSnapshot.context.selectedMap.selectedRegion.name;
                        console.log('[Cyclopedia] Using region name from current game state (fallback):', regionName);
                      } else if (boardSnapshot?.context?.selectedMap?.selectedRegion?.id) {
                        regionName = boardSnapshot.context.selectedMap.selectedRegion.id;
                        // Capitalize region name
                        regionName = GAME_DATA.REGION_NAME_MAP[regionName.toLowerCase()] || regionName.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
                        console.log('[Cyclopedia] Using region ID from current game state (fallback):', regionName);
                      }
                    }
                  } catch (e) {
                    console.warn('[Cyclopedia] Error getting region from game state:', e);
                  }
                }
                
                replayData.region = regionName;
                replayData.map = mapName;
                
                // Check if we have stored board setup data
                if (run.setup && run.setup.pieces && run.setup.pieces.length > 0) {
                  console.log('[Cyclopedia] Found stored board setup, generating complete replay command');
                  console.log('[Cyclopedia] Run setup data:', run.setup);
                  console.log('[Cyclopedia] Run setup pieces:', run.setup.pieces);
                  
                  // Convert stored pieces to board format
                  const board = run.setup.pieces.map(piece => {
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
                    
                    // Add equipment if available
                    if (piece.equipmentName || piece.equipId) {
                      boardPiece.equipment = {
                        name: piece.equipmentName || piece.equipId || 'unknown equipment',
                        stat: piece.equipmentStat || 'ap',
                        tier: piece.equipmentTier || 5
                      };
                    }
                    
                    return boardPiece;
                  });
                  
                  replayData.board = board;
                  console.log('[Cyclopedia] Generated board configuration:', board);
                  console.log('[Cyclopedia] Final replay data:', replayData);
                } else {
                  console.log('[Cyclopedia] No stored board setup found, using basic replay command');
                }
                
                // Add seed at the end
                replayData.seed = run.seed;
                
                const replayCommand = `$replay(${JSON.stringify(replayData)})`;
                console.log(`[Cyclopedia] Generated speedrun replay command: ${replayCommand}`);
                navigator.clipboard.writeText(replayCommand).then(() => {
                  console.log('[Cyclopedia] Successfully copied speedrun replay command to clipboard:', replayCommand);
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
                
                console.log(`[Cyclopedia] Delete button clicked for speedrun run:`, run);
                
                // Check if delete cell is already in "confirm" state
                if (deleteCell.getAttribute('data-confirming') === 'true') {
                  // User confirmed deletion
                  console.log(`[Cyclopedia] Deleting speedrun #${i + 1} for ${selectedMap}`);
                  // Remove from local storage
                  if (window.RunTrackerAPI && window.RunTrackerAPI.deleteRun) {
                    console.log(`[Cyclopedia] Calling RunTrackerAPI.deleteRun(${mapKey}, 'speedrun', ${i})`);
                    window.RunTrackerAPI.deleteRun(mapKey, 'speedrun', i).then(success => {
                      console.log(`[Cyclopedia] RunTrackerAPI.deleteRun result:`, success);
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
      
      // Right column: Top 5 Floors
      const floorsTableCol = document.createElement('div');
      floorsTableCol.setAttribute('data-table-type', 'floors');
      floorsTableCol.style.flex = '1 1 0';
      floorsTableCol.style.maxWidth = '160px';
      floorsTableCol.style.display = 'flex';
      floorsTableCol.style.flexDirection = 'column';
      floorsTableCol.style.padding = '10px';
      floorsTableCol.style.borderLeft = '3px solid transparent';
      floorsTableCol.style.borderRight = 'none';
      floorsTableCol.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
      
      const floorsTableTitle = document.createElement('div');
      floorsTableTitle.style.fontSize = '16px';
      floorsTableTitle.style.fontWeight = 'bold';
      floorsTableTitle.style.color = COLOR_CONSTANTS.TEXT;
      floorsTableTitle.style.marginBottom = '10px';
      floorsTableTitle.style.textAlign = 'center';
      floorsTableTitle.textContent = 'Top 5 Floors';
      floorsTableCol.appendChild(floorsTableTitle);
      
      const floorsTable = DOMUtils.createStyledElement('div', {
        border: '1px solid #444',
        borderRadius: '4px',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.02)'
      });
      
      // Table header
      const floorsHeader = DOMUtils.createStyledElement('div', {
        display: 'grid',
        gridTemplateColumns: '1fr 50px 20px 20px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderBottom: '1px solid #444',
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
          console.log(`[Cyclopedia] Populating floors table for map: ${selectedMap}`);
          // Resolve the map name to ensure consistency with RunTracker
          const resolvedMapName = resolveMapName(selectedMap);
          const mapKey = `map_${resolvedMapName.toLowerCase().replace(/\s+/g, '_')}`;
          console.log(`[Cyclopedia] Resolved map name: "${selectedMap}" -> "${resolvedMapName}"`);
          console.log(`[Cyclopedia] Generated mapKey: ${mapKey}`);
          let localRuns = await getLocalRunsForMap(mapKey, 'floor');
          console.log(`[Cyclopedia] Retrieved ${localRuns ? localRuns.length : 0} floor records:`, localRuns);
          
          // Ensure currentYourRooms is populated for warning icon comparisons
          if (!currentYourRooms) {
            const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
            currentYourRooms = playerState?.rooms || {};
            console.log(`[Cyclopedia] Populated currentYourRooms from player state:`, currentYourRooms);
          }
          
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
            console.log(`[Cyclopedia] Sorted floor records:`, localRuns);
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
          
          // Populate with actual data
          for (let i = 0; i < 5; i++) {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '1fr 50px 20px 20px';
            row.style.borderBottom = i < 4 ? '1px solid #333' : 'none';
            row.style.fontSize = '10px';
            row.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
            
            const run = localRuns[i];
            console.log(`[Cyclopedia] Processing floor run ${i + 1}:`, run);
            
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
            if (run.floor !== undefined && run.floor !== null) {
              floorCell.textContent = run.floor;
              console.log(`[Cyclopedia] Floor run ${i + 1} floor: ${run.floor}`);
            } else {
              floorCell.textContent = 'N/A';
              console.log(`[Cyclopedia] Floor run ${i + 1} has no floor property`);
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
              console.log(`[Cyclopedia] Floor run ${i + 1} time: ${run.time} -> ${timeValue}`);
            } else {
              timeCell.textContent = '-';
              console.log(`[Cyclopedia] Floor run ${i + 1} has no time property`);
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
                
                console.log(`[Cyclopedia] Copy button clicked for floor run:`, run);
                
                // Generate replay command with board configuration if available
                let replayData = {};
                
                // Get proper region and map names
                let regionName = 'Unknown Region';
                let mapName = resolveMapName(selectedMap); // Use resolved map name
                
                // First, try to use the region name that RunTracker already resolved and saved
                if (run.regionName) {
                  regionName = run.regionName;
                  console.log('[Cyclopedia] Using saved region name from RunTracker:', regionName);
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
                      regionName = GAME_DATA.REGION_NAME_MAP[foundRegion.id] || foundRegion.id;
                      console.log('[Cyclopedia] Found region for map using game state utils:', regionName);
                    } else {
                      // Fallback: try to get region from current game state
                      const boardSnapshot = globalThis.state?.board?.getSnapshot();
                      if (boardSnapshot?.context?.selectedMap?.selectedRegion?.name) {
                        regionName = boardSnapshot.context.selectedMap.selectedRegion.name;
                        console.log('[Cyclopedia] Using region name from current game state (fallback):', regionName);
                      } else if (boardSnapshot?.context?.selectedMap?.selectedRegion?.id) {
                        regionName = boardSnapshot.context.selectedMap.selectedRegion.id;
                        // Capitalize region name
                        regionName = GAME_DATA.REGION_NAME_MAP[regionName.toLowerCase()] || regionName.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
                        console.log('[Cyclopedia] Using region ID from current game state (fallback):', regionName);
                      }
                    }
                  } catch (e) {
                    console.warn('[Cyclopedia] Error getting region from game state:', e);
                  }
                }
                
                replayData.region = regionName;
                replayData.map = mapName;
                
                // Check if we have stored board setup data
                if (run.setup && run.setup.pieces && run.setup.pieces.length > 0) {
                  console.log('[Cyclopedia] Found stored board setup, generating complete replay command');
                  console.log('[Cyclopedia] Run setup data:', run.setup);
                  console.log('[Cyclopedia] Run setup pieces:', run.setup.pieces);
                  
                  // Convert stored pieces to board format
                  const board = run.setup.pieces.map(piece => {
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
                    
                    // Add equipment if available
                    if (piece.equipmentName || piece.equipId) {
                      boardPiece.equipment = {
                        name: piece.equipmentName || piece.equipId || 'unknown equipment',
                        stat: piece.equipmentStat || 'ap',
                        tier: piece.equipmentTier || 5
                      };
                    }
                    
                    return boardPiece;
                  });
                  
                  replayData.board = board;
                  console.log('[Cyclopedia] Generated board configuration:', board);
                  console.log('[Cyclopedia] Final replay data:', replayData);
                } else {
                  console.log('[Cyclopedia] No stored board setup found, using basic replay command');
                }
                
                // Add seed at the end
                replayData.seed = run.seed;
                
                const replayCommand = `$replay(${JSON.stringify(replayData)})`;
                console.log(`[Cyclopedia] Generated floor replay command: ${replayCommand}`);
                navigator.clipboard.writeText(replayCommand).then(() => {
                  console.log('[Cyclopedia] Successfully copied floor replay command to clipboard:', replayCommand);
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
                  console.log(`[Cyclopedia] Confirming deletion of floor run at index ${i} for ${mapKey}`);
                  
                  // Call RunTracker API to delete the run
                  if (window.RunTrackerAPI && window.RunTrackerAPI.deleteRun) {
                    window.RunTrackerAPI.deleteRun(mapKey, 'floor', i).then(success => {
                      if (success) {
                        console.log(`[Cyclopedia] Successfully deleted floor run at index ${i} for ${mapKey}`);
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
      ranksTableCol.style.padding = '10px';
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
      ranksTable.style.border = '1px solid #444';
      ranksTable.style.borderRadius = '4px';
      ranksTable.style.overflow = 'hidden';
      ranksTable.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
      
      // Table header
      const ranksHeader = document.createElement('div');
      ranksHeader.style.display = 'grid';
      ranksHeader.style.gridTemplateColumns = '1fr 50px 20px 20px';
      ranksHeader.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
      ranksHeader.style.borderBottom = '1px solid #444';
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
          console.log(`[Cyclopedia] Populating rank points table for map: ${selectedMap}`);
          // Resolve the map name to ensure consistency with RunTracker
          const resolvedMapName = resolveMapName(selectedMap);
          const mapKey = `map_${resolvedMapName.toLowerCase().replace(/\s+/g, '_')}`;
          console.log(`[Cyclopedia] Resolved map name: "${selectedMap}" -> "${resolvedMapName}"`);
          console.log(`[Cyclopedia] Generated mapKey: ${mapKey}`);
          let localRuns = await getLocalRunsForMap(mapKey, 'rank');
          console.log(`[Cyclopedia] Retrieved ${localRuns ? localRuns.length : 0} rank records:`, localRuns);
          
          // Ensure currentYourRooms is populated for warning icon comparisons
          if (!currentYourRooms) {
            const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
            currentYourRooms = playerState?.rooms || {};
            console.log(`[Cyclopedia] Populated currentYourRooms from player state:`, currentYourRooms);
          }
          
          // Filter out defeated runs with 0 rank points
          if (localRuns && localRuns.length > 0) {
            const originalCount = localRuns.length;
            localRuns = localRuns.filter(run => run.points > 0);
            const filteredCount = localRuns.length;
            if (originalCount !== filteredCount) {
              console.log(`[Cyclopedia] Filtered out ${originalCount - filteredCount} defeated runs (0 rank points)`);
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
            console.log(`[Cyclopedia] Sorted rank records:`, localRuns);
          }
          
          if (localRuns && localRuns.length > 0) {
            console.log(`[Cyclopedia] First rank record properties:`, Object.keys(localRuns[0]));
            console.log(`[Cyclopedia] First rank record values:`, localRuns[0]);
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
            console.log(`[Cyclopedia] Processing rank run ${i + 1}:`, run);
            
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
              console.log(`[Cyclopedia] Rank run ${i + 1} points: ${run.points} -> ${run.points.toLocaleString()}`);
            } else {
              rankCell.textContent = 'N/A';
              console.log(`[Cyclopedia] Rank run ${i + 1} has no points property`);
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
              console.log(`[Cyclopedia] Rank run ${i + 1} ticks: ${run.time} -> ${formatLocalRunTime(run.time)}`);
              
              // Check if this run is invalid (either faster than your best time OR worse rank than your best)
              const yourTicks = currentYourRooms?.[selectedMap]?.ticks || 0;
              const yourBestRank = currentYourRooms?.[selectedMap]?.rank || 0;
              const isTimeInvalid = yourTicks > 0 && run.time < yourTicks;
              const isRankInvalid = yourBestRank > 0 && run.points > yourBestRank;
              
              if (isTimeInvalid || isRankInvalid) {
                // Create warning icon separately for left alignment
                const warningIcon = document.createElement('span');
                warningIcon.innerHTML = '⚠️';
                warningIcon.title = isTimeInvalid && isRankInvalid ? 'This run might be invalid (both time and rank)' : 
                                   isTimeInvalid ? 'This run might be invalid (faster than your best time)' : 
                                   'This run might be invalid (worse rank than your best)';
                warningIcon.style.cursor = 'help';
                warningIcon.style.position = 'absolute';
                warningIcon.style.left = '1px';
                warningIcon.style.fontSize = '10px';
                warningIcon.style.zIndex = '1';
                
                // Create time text centered with left margin to avoid overlap
                const timeValue = formatLocalRunTime(run.time).replace(/\s*ticks?\s*/i, '');
                timeText.textContent = timeValue;
                timeText.style.textAlign = 'center';
                timeText.style.flex = '1';
                timeText.style.marginLeft = '12px';
                
                timeCell.appendChild(warningIcon);
                timeCell.appendChild(timeText);
                
                // Make the entire row red
                row.style.color = '#ff6b6b';
                console.log(`[Cyclopedia] Added warning icon for rank run ${i + 1}: time invalid=${isTimeInvalid} (${run.time} < ${yourTicks}), rank invalid=${isRankInvalid} (${run.points} > ${yourBestRank})`);
              } else {
                const timeValue = formatLocalRunTime(run.time).replace(/\s*ticks?\s*/i, '');
                timeText.textContent = timeValue;
                timeCell.appendChild(timeText);
              }
            } else {
              timeCell.textContent = 'N/A';
              console.log(`[Cyclopedia] Rank run ${i + 1} has no time property`);
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
                
                console.log(`[Cyclopedia] Copy button clicked for rank run:`, run);
                
                // Generate replay command with board configuration if available
                let replayData = {};
                
                // Get proper region and map names
                let regionName = 'Unknown Region';
                let mapName = resolveMapName(selectedMap); // Use resolved map name
                
                // First, try to use the region name that RunTracker already resolved and saved
                if (run.regionName) {
                  regionName = run.regionName;
                  console.log('[Cyclopedia] Using saved region name from RunTracker:', regionName);
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
                      regionName = GAME_DATA.REGION_NAME_MAP[foundRegion.id] || foundRegion.id;
                      console.log('[Cyclopedia] Found region for map using game state utils:', regionName);
                    } else {
                      // Fallback: try to get region from current game state (this is the problematic part)
                      const boardSnapshot = globalThis.state?.board?.getSnapshot();
                      if (boardSnapshot?.context?.selectedMap?.selectedRegion?.name) {
                        regionName = boardSnapshot.context.selectedMap.selectedRegion.name;
                        console.log('[Cyclopedia] Using region name from current game state (fallback):', regionName);
                      } else if (boardSnapshot?.context?.selectedMap?.selectedRegion?.id) {
                        regionName = boardSnapshot.context.selectedMap.selectedRegion.id;
                        // Capitalize region name
                        regionName = GAME_DATA.REGION_NAME_MAP[regionName.toLowerCase()] || regionName.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
                        console.log('[Cyclopedia] Using region ID from current game state (fallback):', regionName);
                      }
                    }
                  } catch (e) {
                    console.warn('[Cyclopedia] Error getting region from game state:', e);
                  }
                }
                
                replayData.region = regionName;
                replayData.map = mapName;
                
                // Check if we have stored board setup data
                if (run.setup && run.setup.pieces && run.setup.pieces.length > 0) {
                  console.log('[Cyclopedia] Found stored board setup, generating complete replay command');
                  console.log('[Cyclopedia] Run setup data:', run.setup);
                  console.log('[Cyclopedia] Run setup pieces:', run.setup.pieces);
                  
                  // Convert stored pieces to board format
                  const board = run.setup.pieces.map(piece => {
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
                    
                    // Add equipment if available
                    if (piece.equipmentName || piece.equipId) {
                      boardPiece.equipment = {
                        name: piece.equipmentName || piece.equipId || 'unknown equipment',
                        stat: piece.equipmentStat || 'ap',
                        tier: piece.equipmentTier || 5
                      };
                    }
                    
                    return boardPiece;
                  });
                  
                  replayData.board = board;
                  console.log('[Cyclopedia] Generated board configuration:', board);
                  console.log('[Cyclopedia] Final replay data:', replayData);
                } else {
                  console.log('[Cyclopedia] No stored board setup found, using basic replay command');
                }
                
                // Add seed at the end
                replayData.seed = run.seed;
                
                const replayCommand = `$replay(${JSON.stringify(replayData)})`;
                console.log(`[Cyclopedia] Generated rank replay command: ${replayCommand}`);
                navigator.clipboard.writeText(replayCommand).then(() => {
                  console.log('[Cyclopedia] Successfully copied rank replay command to clipboard:', replayCommand);
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
                
                console.log(`[Cyclopedia] Delete button clicked for rank run:`, run);
                
                // Check if delete cell is already in "confirm" state
                if (deleteCell.getAttribute('data-confirming') === 'true') {
                  // User confirmed deletion
                  console.log(`[Cyclopedia] Deleting rank run #${i + 1} for ${selectedMap}`);
                  // Remove from local storage
                  if (window.RunTrackerAPI && window.RunTrackerAPI.deleteRun) {
                    console.log(`[Cyclopedia] Calling RunTrackerAPI.deleteRun(${mapKey}, 'rank', ${i})`);
                    window.RunTrackerAPI.deleteRun(mapKey, 'rank', i).then(success => {
                      console.log(`[Cyclopedia] RunTrackerAPI.deleteRun result:`, success);
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
          
          const { best, roomsHighscores, yourRooms } = data;
          const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
          
          // Store yourRooms data for warning icon comparisons
          currentYourRooms = yourRooms;
          
          // Update speedrun content
          const yourTicks = yourRooms?.[selectedMap]?.ticks || 0;
          const bestTicks = best?.[selectedMap]?.ticks || 0;
          const bestPlayer = best?.[selectedMap]?.userName || 'Unknown';
          
          let speedrunHtml = '';
          if (bestTicks > 0) {
            speedrunHtml = `
              <div style="margin-bottom: 4px; color: #ff8; font-weight: bold; font-size: 12px;">World Record</div>
              <div style="margin-bottom: 2px; font-size: 12px; color: #fff;">${bestTicks} ticks</div>
              <div style="margin-bottom: 6px; font-size: 10px; color: #888;">by ${bestPlayer}</div>
            `;
            if (yourTicks > 0) {
              speedrunHtml += `
                <div style="margin-bottom: 4px; color: #8f8; font-weight: bold; font-size: 12px;">Your Best</div>
                <div style="font-size: 12px; color: #ccc;">${yourTicks} ticks</div>
              `;
            }
          } else {
            speedrunHtml = '<div style="color: #666; font-size: 12px;">No records yet</div>';
          }
          speedrunContent.innerHTML = speedrunHtml;
          
          // Update rank points content
          const yourRankPoints = yourRooms?.[selectedMap]?.rank || 0;
          const yourRankTicks = yourRooms?.[selectedMap]?.rankTicks;
          const bestRankPoints = roomsHighscores?.rank?.[selectedMap]?.rank || 0;
          const bestRankTicks = roomsHighscores?.rank?.[selectedMap]?.ticks;
          const bestRankPlayer = roomsHighscores?.rank?.[selectedMap]?.userName || 'Unknown';
          
          let rankPointsHtml = '';
          if (bestRankPoints > 0) {
            rankPointsHtml = `
              <div style="margin-bottom: 4px; color: #ff8; font-weight: bold; font-size: 12px;">World Record</div>
              <div style="margin-bottom: 2px; font-size: 12px; color: #fff;">${bestRankPoints.toLocaleString()}${bestRankTicks !== undefined && bestRankTicks !== null ? ` <i style="color: #aaa;">(${bestRankTicks} ticks)</i>` : ' (null)'}</div>
              <div style="margin-bottom: 6px; font-size: 10px; color: #888;">by ${bestRankPlayer}</div>
            `;
            if (yourRankPoints > 0) {
              rankPointsHtml += `
                <div style="margin-bottom: 4px; color: #8f8; font-weight: bold; font-size: 12px;">Your Best</div>
                <div style="font-size: 12px; color: #ccc;">${yourRankPoints.toLocaleString()}${yourRankTicks !== undefined && yourRankTicks !== null ? ` <i style="color: #aaa;">(${yourRankTicks} ticks)</i>` : ' (null)'}</div>
              `;
            }
          } else {
            rankPointsHtml = '<div style="color: #666; font-size: 12px;">No records yet</div>';
          }
          rankPointsContent.innerHTML = rankPointsHtml;
          
          // Update floors content
          const yourRoom = yourRooms?.[selectedMap];
          const { floor: yourFloor, floorTicks: yourFloorTicks } = normalizeUserFloorData(yourRoom);
          const { floor: bestFloor, floorTicks: bestFloorTicks, playerName: bestFloorPlayer } = normalizeBestFloorData(selectedMap, roomsHighscores, best);
          
          let floorsHtml = '';
          // Check if we have world record data (best floor or fallback to ticks)
          if (bestFloorTicks > 0) {
            floorsHtml = `
              <div style="margin-bottom: 4px; color: #ff8; font-weight: bold; font-size: 12px;">World Record</div>
              <div style="margin-bottom: 2px; font-size: 12px; color: #fff;">Floor ${bestFloor}${bestFloorTicks !== undefined && bestFloorTicks !== null ? ` <i style="color: #aaa;">(${bestFloorTicks} ticks)</i>` : ''}</div>
              <div style="margin-bottom: 6px; font-size: 10px; color: #888;">by ${bestFloorPlayer}</div>
            `;
            // Add "Your Best" if user has floor data
            if (yourFloor !== undefined && yourFloor !== null) {
              floorsHtml += `
                <div style="margin-bottom: 4px; color: #8f8; font-weight: bold; font-size: 12px;">Your Best</div>
                <div style="font-size: 12px; color: #ccc;">Floor ${yourFloor}${yourFloorTicks !== undefined && yourFloorTicks !== null ? ` <i style="color: #aaa;">(${yourFloorTicks} ticks)</i>` : ''}</div>
              `;
            }
          } else if (yourFloor !== undefined && yourFloor !== null) {
            // Only show "Your Best" if no world record but user has data
            floorsHtml = `
              <div style="margin-bottom: 4px; color: #8f8; font-weight: bold; font-size: 12px;">Your Best</div>
              <div style="font-size: 12px; color: #ccc;">Floor ${yourFloor}${yourFloorTicks !== undefined && yourFloorTicks !== null ? ` <i style="color: #aaa;">(${yourFloorTicks} ticks)</i>` : ''}</div>
            `;
          } else {
            floorsHtml = '<div style="color: #666; font-size: 12px;">No records yet</div>';
          }
          floorsContent.innerHTML = floorsHtml;
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
            `;
            
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
            
            if (actor.equip && actor.equip.gameId) {
              // Create equipment icon using the game's UI components
              try {
                if (api && api.ui && api.ui.components && api.ui.components.createItemPortrait) {
                  // Get equipment data to get the correct spriteId
                  let eqData = null;
                  try {
                    if (actor.equip.gameId && globalThis.state?.utils?.getEquipment) {
                      eqData = globalThis.state.utils.getEquipment(actor.equip.gameId);
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

    // Helper function to create map information section
    function createMapInfoSection(selectedMap, roomName) {
      const mapInfoDiv = document.createElement('div');
      mapInfoDiv.style.padding = '0 20px 20px 20px';
      mapInfoDiv.style.color = COLOR_CONSTANTS.TEXT;
      mapInfoDiv.style.width = '100%';
      mapInfoDiv.style.boxSizing = 'border-box';
      mapInfoDiv.style.marginBottom = '0';
      
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
          countOverlay.style.backgroundImage = 'url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png")';
          countOverlay.style.backgroundSize = 'cover';
          countOverlay.style.backgroundPosition = 'center';
          countOverlay.style.color = '#ffffff';
          countOverlay.style.fontSize = '10px';
          countOverlay.style.fontWeight = 'bold';
          countOverlay.style.fontFamily = 'Arial, Helvetica, sans-serif';
          countOverlay.style.textAlign = 'center';
          countOverlay.style.padding = '4px 6px';
          countOverlay.style.borderRadius = '4px';
          countOverlay.style.border = '3px solid transparent';
          countOverlay.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 3 fill';
          countOverlay.textContent = `Defeated ${defeatCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} times`;
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
      d.style.alignItems = 'flex-start';
      d.style.justifyContent = 'center';
      d.style.gap = '0';

      let selectedCategory = '';
      let selectedMap = null;

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
          
          // Get maps for selected region from game state
          let mapsInRegion = [];
          
          if (selectedCategory && globalThis.state?.utils?.REGIONS) {
            // Show maps from specific region
            const region = globalThis.state.utils.REGIONS.find(r => r.id === selectedCategory);
            console.log('[Cyclopedia] Selected region:', region);
            if (region && region.rooms) {
              console.log('[Cyclopedia] Region rooms:', region.rooms);
              mapsInRegion = region.rooms.map(room => ({
                id: room.id,
                name: globalThis.state.utils.ROOM_NAME[room.id] || room.id,
                region: region.id
              }));
              console.log('[Cyclopedia] Maps in region:', mapsInRegion);
            }
          }
          
          const box = createBox({
            title: 'Maps',
            items: mapsInRegion.map(map => map.name),
            mapIds: mapsInRegion.map(map => map.id),
            type: 'map',
            selectedCreature: null,
            selectedEquipment: null,
            selectedInventory: selectedMap,
            setSelectedCreature: () => {},
            setSelectedEquipment: () => {},
            setSelectedInventory: (mapName) => {
              const mapData = mapsInRegion.find(map => map.name === mapName);
              selectedMap = mapData ? mapData.id : mapName;
              console.log('[Cyclopedia] Map selected:', { mapName, mapData, selectedMap });
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
      
      // Set default selected region to first available region
      if (regions.length > 0 && !selectedCategory) {
        selectedCategory = regions[0];
      }

      const topBox = createBox({
        title: 'Regions',
        items: regions.map(regionId => GAME_DATA.REGION_NAME_MAP[regionId] || regionId),
        regionIds: regions,
        type: 'region',
        selectedCreature: null,
        selectedEquipment: null,
        selectedInventory: selectedCategory ? (GAME_DATA.REGION_NAME_MAP[selectedCategory] || selectedCategory) : null,
        setSelectedCreature: () => {},
        setSelectedEquipment: () => {},
        setSelectedInventory: (cat) => {
          // Find the region ID from the display name
          const regionId = regions.find(regionId => GAME_DATA.REGION_NAME_MAP[regionId] === cat) || cat;
          selectedCategory = regionId;
          selectedMap = null;
          updateBottomBox();
          updateRightCol();
        },
        updateRightCol: () => {}
      });

      topBox.style.flex = '0 0 35%';
      topBox.style.maxHeight = '35%';
      topBox.style.minHeight = '0';
      leftCol.appendChild(topBox);
      updateBottomBox();

      // Create two columns for the right side like Equipment Tab
      const col2 = document.createElement('div');
      Object.assign(col2.style, {
        width: '250px', minWidth: '250px', maxWidth: '250px', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start', fontSize: '16px',
        fontWeight: 'bold', color: COLOR_CONSTANTS.TEXT,
        borderRight: '6px solid transparent',
        borderImage: `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`
      });
      col2.classList.add('text-whiteHighlight');

      const col3 = document.createElement('div');
      Object.assign(col3.style, {
        flex: '1 1 0', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start', fontSize: '16px',
        fontWeight: 'bold', color: COLOR_CONSTANTS.TEXT
      });
      col3.classList.add('text-whiteHighlight');
      
      // Add content areas for optimized updates
      const col2Content = document.createElement('div');
      col2Content.className = 'maps-content-area';
      col2Content.style.flex = '1';
      col2Content.style.width = '100%';
      col2Content.style.overflowY = 'auto';
      
      const col3Content = document.createElement('div');
      col3Content.className = 'maps-content-area';
      col3Content.style.flex = '1';
      col3Content.style.width = '100%';
      col3Content.style.overflowY = 'auto';

      // Create titles for the columns
      const col2Title = document.createElement('h2');
      col2Title.className = 'widget-top widget-top-text pixel-font-16';
      Object.assign(col2Title.style, {
        margin: '0', padding: '2px 8px', textAlign: 'center', color: 'rgb(255, 255, 255)',
        width: '100%', boxSizing: 'border-box', marginBottom: '10px'
      });
      const col2TitleP = document.createElement('p');
      col2TitleP.className = 'pixel-font-16';
      Object.assign(col2TitleP.style, {
        margin: '0', padding: '0', textAlign: 'center', color: 'rgb(255, 255, 255)',
        width: '100%', boxSizing: 'border-box'
      });
      col2TitleP.textContent = 'Map Information';
      col2Title.appendChild(col2TitleP);
      col2.appendChild(col2Title);
      col2.appendChild(col2Content);

      const col3Title = document.createElement('h2');
      col3Title.className = 'widget-top widget-top-text pixel-font-16';
      Object.assign(col3Title.style, {
        margin: '0', padding: '2px 8px', textAlign: 'center', color: 'rgb(255, 255, 255)',
        width: '100%', boxSizing: 'border-box', marginBottom: '10px'
      });
      const col3TitleP = document.createElement('p');
      col3TitleP.className = 'pixel-font-16';
      Object.assign(col3TitleP.style, {
        margin: '0', padding: '0', textAlign: 'center', color: 'rgb(255, 255, 255)',
        width: '100%', boxSizing: 'border-box'
      });
      col3TitleP.textContent = 'Statistics';
      col3Title.appendChild(col3TitleP);
      col3.appendChild(col3Title);
      col3.appendChild(col3Content);
      

      
      function updateRightCol() {
        try {
          // Check if we actually need to update
          const roomData = globalThis.state?.utils?.ROOMS?.[selectedMap];
          const roomName = globalThis.state?.utils?.ROOM_NAME?.[selectedMap] || selectedMap;
          
          // Only update if state actually changed
          if (MapsTabDOMOptimizer.currentState.selectedMap === selectedMap && 
              MapsTabDOMOptimizer.currentState.roomData === roomData &&
              MapsTabDOMOptimizer.currentState.roomName === roomName) {
            return; // No change needed
          }
          
          // Update current state
          MapsTabDOMOptimizer.currentState.selectedMap = selectedMap;
          MapsTabDOMOptimizer.currentState.roomData = roomData;
          MapsTabDOMOptimizer.currentState.roomName = roomName;
          
          // Clear only content areas, preserve structure
          const col2Content = col2.querySelector('.maps-content-area');
          const col3Content = col3.querySelector('.maps-content-area');
          
          if (col2Content) col2Content.innerHTML = '';
          if (col3Content) col3Content.innerHTML = '';
          
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
            
            // Add "Creature Information" title using Bestiary Tab title system
            const creatureInfoTitle = document.createElement('h2');
            creatureInfoTitle.className = 'widget-top widget-top-text ' + FONT_CONSTANTS.SIZES.TITLE;
            creatureInfoTitle.style.margin = '0';
            creatureInfoTitle.style.padding = '2px 0';
            creatureInfoTitle.style.textAlign = 'center';
            creatureInfoTitle.style.color = COLOR_CONSTANTS.TEXT;
            creatureInfoTitle.style.width = '100%';
            creatureInfoTitle.style.boxSizing = 'border-box';
            creatureInfoTitle.style.display = 'block';
            creatureInfoTitle.style.position = 'relative';
            creatureInfoTitle.style.top = '0';
            creatureInfoTitle.style.left = '0';
            creatureInfoTitle.style.right = '0';
            creatureInfoTitle.style.marginLeft = '0';
            creatureInfoTitle.style.width = '100%';
            creatureInfoTitle.style.marginBottom = '5px';
            
            const creatureInfoTitleP = document.createElement('p');
            creatureInfoTitleP.textContent = 'Creature Information';
            creatureInfoTitleP.className = FONT_CONSTANTS.SIZES.TITLE;
            creatureInfoTitleP.style.margin = '0';
            creatureInfoTitleP.style.padding = '0';
            creatureInfoTitleP.style.textAlign = 'center';
            creatureInfoTitleP.style.color = COLOR_CONSTANTS.TEXT;
            creatureInfoTitle.appendChild(creatureInfoTitleP);
            creatureInfoDiv.appendChild(creatureInfoTitle);
            
            // Simple content container below the title
            const contentContainer = document.createElement('div');
            contentContainer.style.overflowY = 'hidden'; // Start with no scrollbar
            contentContainer.style.maxHeight = '190px';
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
              console.log('[Cyclopedia] Maps Tab - Room ID:', selectedMap);
              console.log('[Cyclopedia] Maps Tab - Room Data:', roomData);
              console.log('[Cyclopedia] Maps Tab - Room Actors:', roomActors);
              
              const creaturesContainer = createCreatureListSection(roomActors, selectedMap);
              contentContainer.appendChild(creaturesContainer);
            }
            
            // Add both divs to col2 content area
            col2Content.appendChild(mapInfoDiv);
            col2Content.appendChild(creatureInfoDiv);
            
            // Add the content container to the creature info div
            creatureInfoDiv.appendChild(contentContainer);
            
            // Check if content overflows and conditionally show scrollbar
            setTimeout(() => {
                const hasOverflow = contentContainer.scrollHeight > 190;
                if (hasOverflow) {
                    contentContainer.style.overflowY = 'auto';
                }
                // If no overflow, keep overflowY: 'hidden' (no scrollbar)
            }, 0);
            
            // Column 3: Statistics
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

    const tabNames = ['Home', 'Bestiary', 'Equipment', 'Inventory', 'Maps', 'Characters'];
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

    const mainContent = document.createElement('div');
    mainContent.style.flex = '1 1 0';
    mainContent.style.padding = '0';
    mainContent.style.display = 'flex';
    mainContent.style.flexDirection = 'column';
    mainContent.style.minHeight = '0';
    mainContent.style.background = "url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat";
    mainContent.style.justifyContent = 'center';
    mainContent.style.alignItems = 'center';
    mainContent.style.height = '500px';
    mainContent.style.minHeight = '500px';
    mainContent.style.maxHeight = '500px';

    defineSetActiveTab(tabButtons, mainContent, tabPages);

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
  if (typeof unobtainableCreatures !== 'undefined' && unobtainableCreatures.includes(name)) {
  }
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'row';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.gap = '0';
  container.style.overflowX = 'hidden';
  container.style.overflowY = 'auto';

  const col1 = document.createElement('div');
  col1.style.display = 'flex';
  col1.style.flexDirection = 'column';
  col1.style.width = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col1.style.minWidth = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col1.style.maxWidth = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col1.style.height = '100%';
  col1.style.borderRight = '6px solid transparent';
  col1.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
  col1.style.boxSizing = 'border-box';
  col1.style.marginRight = '0';
  col1.style.paddingRight = '0';
  col1.style.overflowX = 'hidden';
  col1.style.overflowY = 'hidden';
  const col1Title = document.createElement('h2');
  col1Title.className = 'widget-top widget-top-text ' + FONT_CONSTANTS.SIZES.TITLE;
  col1Title.style.margin = '0';
  col1Title.style.padding = '2px 0';
  col1Title.style.textAlign = 'center';
  col1Title.style.color = COLOR_CONSTANTS.TEXT;
  col1Title.style.width = '100%';
  col1Title.style.boxSizing = 'border-box';
  col1Title.style.display = 'block';
  col1Title.style.position = 'relative';
  col1Title.style.top = '0';
  col1Title.style.left = '0';
  col1Title.style.right = '0';
  col1Title.style.marginLeft = '0';
  col1Title.style.width = '100%';
  col1Title.style.marginBottom = '5px';
  const col1TitleP = document.createElement('p');
  col1TitleP.textContent = name || 'Creature Information';
  col1TitleP.className = FONT_CONSTANTS.SIZES.TITLE;
  col1TitleP.style.margin = '0';
  col1TitleP.style.padding = '0';
  col1TitleP.style.textAlign = 'center';
  col1TitleP.style.color = COLOR_CONSTANTS.TEXT;
  col1Title.appendChild(col1TitleP);
  
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

  if (cyclopediaState.monsterNameMap && typeof name === 'string') {
    const entry = cyclopediaState.monsterNameMap.get(name.toLowerCase());
    if (entry) {
      monster = entry.monster;
      monsterId = monster.gameId !== undefined ? monster.gameId : entry.index;
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
        const isUnobtainable = UNOBTAINABLE_CREATURES.some(c => c.toLowerCase() === name.toLowerCase());
        if (showShinyPortraits && !isUnobtainable) {
          const spriteImg = monsterSprite.querySelector('img.actor.spritesheet');
          if (spriteImg) {
            spriteImg.setAttribute('data-shiny', 'true');
            console.log(`[Cyclopedia] Set shiny attribute for monster ${monsterId}`);
          }
          
          // Add shiny star overlay like in inventory (same size as owned section)
          const shinyIcon = document.createElement('img');
          shinyIcon.src = 'https://bestiaryarena.com/assets/icons/shiny-star.png';
          shinyIcon.alt = 'shiny';
          shinyIcon.title = 'Shiny';
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
            console.log(`[Cyclopedia] Removed shiny attribute for monster ${monsterId}`);
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
  if (monsterId) {
    queueMonsterDataLoad(monsterId, (monsterData) => {
      // Create a safe copy for display without cloning non-cloneable objects
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
      
      const actualStatsDiv = renderMonsterStats(displayMonsterData);
      statsDiv.innerHTML = '';
      statsDiv.appendChild(actualStatsDiv);
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

  const abilityTitle = document.createElement('h2');
  abilityTitle.className = 'widget-top widget-top-text ' + FONT_CONSTANTS.SIZES.TITLE;
  abilityTitle.style.margin = '0';
  abilityTitle.style.padding = '2px 0';
  abilityTitle.style.textAlign = 'center';
  abilityTitle.style.color = COLOR_CONSTANTS.TEXT;
  abilityTitle.style.width = '100%';
  abilityTitle.style.boxSizing = 'border-box';
  abilityTitle.style.display = 'block';
  abilityTitle.style.position = 'relative';
  abilityTitle.style.top = '0';
  abilityTitle.style.left = '0';
  abilityTitle.style.right = '0';
  abilityTitle.style.marginLeft = '0';
  abilityTitle.style.width = '100%';

  const abilityTitleP = document.createElement('p');
  abilityTitleP.textContent = 'Ability';
  abilityTitleP.className = FONT_CONSTANTS.SIZES.TITLE;
  abilityTitleP.style.margin = '0';
  abilityTitleP.style.padding = '0';
  abilityTitleP.style.textAlign = 'center';
  abilityTitleP.style.color = COLOR_CONSTANTS.TEXT;
  abilityTitle.appendChild(abilityTitleP);
  abilitySection.appendChild(abilityTitle);

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
        tooltipComponent = globalThis.state.utils.createUIComponent(rootElement, AbilityTooltip);
        
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
  col2.style.display = 'flex';
  col2.style.flexDirection = 'column';
  col2.style.width = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col2.style.minWidth = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col2.style.maxWidth = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col2.style.height = '100%';
  col2.style.padding = '0'; // Remove padding from the column
  col2.style.margin = '0';
  col2.style.marginLeft = '0';
  col2.style.paddingLeft = '0';
  col2.style.borderRight = '6px solid transparent';
  col2.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
  col2.style.overflowX = 'hidden';
  col2.style.overflowY = 'auto';

  const dropsSection = document.createElement('div');
  dropsSection.style.height = '100%';
  dropsSection.style.display = 'flex';
  dropsSection.style.flexDirection = 'column';
  dropsSection.className = FONT_CONSTANTS.SIZES.SMALL;

  const dropsTitle = document.createElement('h2');
  dropsTitle.className = 'widget-top widget-top-text ' + FONT_CONSTANTS.SIZES.TITLE;
  dropsTitle.style.margin = '0';
  dropsTitle.style.padding = '2px 0';
  dropsTitle.style.textAlign = 'center';
  dropsTitle.style.color = COLOR_CONSTANTS.TEXT;
  dropsTitle.style.width = '100%';
  dropsTitle.style.boxSizing = 'border-box';
  dropsTitle.style.display = 'block';
  dropsTitle.style.position = 'relative';
  dropsTitle.style.top = '0';
  dropsTitle.style.left = '0';
  dropsTitle.style.right = '0';
  dropsTitle.style.marginLeft = '0';
  dropsTitle.style.width = '100%';

  const dropsTitleP = document.createElement('p');
  dropsTitleP.textContent = 'Location';
  dropsTitleP.className = FONT_CONSTANTS.SIZES.TITLE;
  dropsTitleP.style.margin = '0';
  dropsTitleP.style.padding = '0';
  dropsTitleP.style.textAlign = 'center';
  dropsTitleP.style.color = COLOR_CONSTANTS.TEXT;
  dropsTitle.appendChild(dropsTitleP);
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
  dropsList.style.overflowY = 'auto';
  dropsList.style.maxHeight = 'calc(100% - 40px)';

  let monsterLocations = [];
  try {
    monsterLocations = findMonsterLocations(name);
  } catch (error) {
  }
  if (monsterLocations.length > 0) {
    function capitalizeRegionName(name) {
      if (!name) return '';
      const regionId = name.toLowerCase();
      return GAME_DATA.REGION_NAME_MAP[regionId] || name.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
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
    noLocationItem.className = 'pixel-font-16';
    dropsList.appendChild(noLocationItem);
  }
  dropsSection.appendChild(dropsList);

  col2.appendChild(dropsSection);

  const col3 = document.createElement('div');
  col3.style.display = 'flex';
  col3.style.flexDirection = 'column';
  col3.style.width = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col3.style.minWidth = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col3.style.maxWidth = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col3.style.height = '100%';
  col3.style.minHeight = '0';
  col3.style.maxHeight = '100%';
  col3.style.overflowX = 'hidden';
  col3.style.overflowY = 'auto';

  let ownedMonsters = [];
  try {
    const playerContext = globalThis.state?.player?.getSnapshot?.().context;
    if (playerContext && Array.isArray(playerContext.monsters) && monsterId != null) {
      ownedMonsters = playerContext.monsters.filter(m => m.gameId === monsterId);
    }
  } catch (e) {}
  const col3Title = document.createElement('h2');
  col3Title.className = 'widget-top widget-top-text ' + FONT_CONSTANTS.SIZES.TITLE;
  col3Title.style.margin = '0';
  col3Title.style.padding = '2px 0';
  col3Title.style.textAlign = 'center';
  col3Title.style.color = COLOR_CONSTANTS.TEXT;
  col3Title.style.width = '100%';
  col3Title.style.boxSizing = 'border-box';
  col3Title.style.display = 'block';
  col3Title.style.position = 'relative';
  col3Title.style.top = '0';
  col3Title.style.left = '0';
  col3Title.style.right = '0';
  col3Title.style.marginLeft = '0';
  col3Title.style.width = '100%';
  const col3TitleP = document.createElement('p');
  const ownedName = name || '';
  const ownedCount = ownedMonsters.length;
  let pluralName = ownedName;
  if (ownedCount > 1 && ownedName) {
    pluralName = ownedName + 's';
  }

  let isUnobtainable = false;
  if (typeof GAME_DATA !== 'undefined' && Array.isArray(GAME_DATA.UNOBTAINABLE_CREATURES)) {
    isUnobtainable = GAME_DATA.UNOBTAINABLE_CREATURES.some(c => c.toLowerCase() === (name || '').toLowerCase());
  } else if (typeof unobtainableCreatures !== 'undefined' && Array.isArray(unobtainableCreatures)) {
    isUnobtainable = unobtainableCreatures.some(c => c.toLowerCase() === (name || '').toLowerCase());
  }

  if (isUnobtainable) {
    col3TitleP.textContent = ownedName;
  } else {
    col3TitleP.textContent = `Owned ${pluralName}${pluralName ? ` (${ownedCount})` : ''}`;
  }
  col3TitleP.className = FONT_CONSTANTS.SIZES.TITLE;
  col3TitleP.style.margin = '0';
  col3TitleP.style.padding = '0';
  col3TitleP.style.textAlign = 'center';
  col3TitleP.style.color = COLOR_CONSTANTS.TEXT;
  col3Title.appendChild(col3TitleP);
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

      const portrait = api.ui.components.createFullMonster({
        monsterId: monster.gameId || monster.id,
        tier: 1,
        starTier: monster.tier ?? 0,
        level: getLevelFromExp(monster.exp),
        size: 'small'
      });
      portrait.style.margin = '0';
      
      // Set shiny attribute on the sprite if creature is shiny
      if (monster.shiny === true) {
        console.log('[Cyclopedia] Setting shiny attribute for owned creature:', monster);
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
      const level = getLevelFromExp(monster.exp);
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
        const borderElem = portrait.querySelector('.has-rarity');
        if (borderElem) {
          borderElem.setAttribute('data-rarity', rarity);
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

function renderCyclopediaWelcomeColumn(playerName) {
  try {
    const div = document.createElement('div');
    div.style.flex = '1';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.justifyContent = 'center';
    div.style.alignItems = 'center';
    div.style.padding = '24px';
    div.style.width = '100%';

    const headline = document.createElement('h2');
    headline.style.color = '#ffe066';
    headline.style.fontSize = '22px';
    headline.style.marginBottom = '12px';
    headline.style.marginTop = '0';
    headline.style.textAlign = 'center';
    headline.style.width = '100%';
    headline.textContent = `Welcome${playerName ? ' ' + playerName : ''}!`;
    div.appendChild(headline);

    const desc = document.createElement('p');
    desc.style.color = '#e6d7b0';
    desc.style.fontSize = '15px';
    desc.style.textAlign = 'left';
    desc.style.margin = '0';
    desc.style.width = '100%';
    desc.innerHTML = `
      This is the <b>Cyclopedia</b> mod for Bestiary Arena.<br>
      Here you can view your player profile, browse creatures, and explore game data.<br>
      Use the tabs above to navigate, and click on creatures for detailed info.<br><br>
      <i>Enjoy your adventure!</i>
    `;
    div.appendChild(desc);
    return div;
  } catch (error) {
    console.error('[Cyclopedia] Error rendering welcome column:', error);
    const fallbackDiv = document.createElement('div');
    fallbackDiv.style.padding = '24px';
    fallbackDiv.style.color = '#e6d7b0';
    fallbackDiv.textContent = 'Welcome to Cyclopedia!';
    return fallbackDiv;
  }
}

const CYCLOPEDIA_MAX_VALUES = {
  perfectCreatures: 69,
  bisEquipments: 114,
  exploredMaps: 64,
  bagOutfits: 199,
  raids: 16
};

const CYCLOPEDIA_PROGRESS_STATS = [
  { key: 'perfectCreatures', icon: '/assets/icons/enemy.png', max: CYCLOPEDIA_MAX_VALUES.perfectCreatures },
  { key: 'bisEquipments', icon: '/assets/icons/equips.png', max: CYCLOPEDIA_MAX_VALUES.bisEquipments },
  { key: 'raids', icon: '/assets/icons/raid.png', max: CYCLOPEDIA_MAX_VALUES.raids },
  { key: 'exploredMaps', icon: '/assets/icons/map.png', max: CYCLOPEDIA_MAX_VALUES.exploredMaps },
  { key: 'bagOutfits', icon: '/assets/icons/mini-outfitbag.png', max: CYCLOPEDIA_MAX_VALUES.bagOutfits }
];

const CYCLOPEDIA_TRANSLATION = {
  shell: { label: 'Daily Seashell', value: d => d.shell },
  tasks: { label: 'Hunting tasks', value: d => d.tasks },
  playCount: { label: 'Total runs', value: d => d.playCount },
  perfectCreatures: { label: 'Perfect Creatures', value: d => d.perfectMonsters },
  bisEquipments: { label: 'BIS Equipments', value: d => d.bisEquips },
  raids: { label: 'Completed raids', value: d => d.raids },
  exploredMaps: { label: 'Explored maps', value: d => d.maps },
  bagOutfits: { label: 'Bag Outfits', value: d => d.ownedOutfits },
  rankPoints: { label: 'Rank points', value: d => d.rankPoints },
  timeSum: { label: 'Time sum', value: d => d.ticks },
  floorsSum: { label: 'Floors sum', value: d => d.floors },
  createdAt: { label: 'Created at', value: d => FormatUtils.date(d.createdAt) },
  level: { label: 'Level', value: d => (typeof d.exp === 'number' ? Math.floor(d.exp / 400) + 1 : '?') },
  xp: { label: 'XP', value: d => d.exp },
  name: { label: 'Player', value: d => d.name },
  premium: { label: 'Status', value: d => d.premium ? 'Premium' : 'Free' },
  loyaltyPoints: { label: 'Loyalty Points', value: d => d.loyaltyPoints }
};

  if (!DOMCache.get('#cyclopedia-maxed-style')) {
    const style = document.createElement('style');
    style.id = 'cyclopedia-maxed-style';
  style.textContent = `.stat-maxed { color: #3ecf4a !important; }`;
  document.head.appendChild(style);
}

function renderCyclopediaPlayerInfo(profileData) {
  try {
    if (profileData && profileData.json) profileData = profileData.json;
    if (!profileData) {
      const div = document.createElement('div');
      div.innerHTML = `<span style="color: #ff6b6b;">No profile data found.</span>`;
      return div;
    }

  function getProfileValue(key) {
    if (CYCLOPEDIA_TRANSLATION[key] && typeof CYCLOPEDIA_TRANSLATION[key].value === 'function') {
      return CYCLOPEDIA_TRANSLATION[key].value(profileData);
    }
    return profileData[key] !== undefined ? profileData[key] : '-';
  }

  function addRow({ label, icon, iconConfig, value, highlight, colspan, title, extraIcon, tooltip, valueClass }) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-highlight', highlight ? 'true' : 'false');
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
      td2.textContent = value;
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

  const infoBox = document.createElement('div');
  infoBox.className = 'widget-top widget-top-text flex items-center gap-1';
  infoBox.style.marginBottom = '0';
  const infoIcon = document.createElement('img');
  infoIcon.alt = 'Account';
  infoIcon.src = '/assets/icons/migrate.png';
  infoIcon.className = 'pixelated inline-block translate-y-px';
  infoIcon.width = 13;
  infoIcon.height = 13;
  infoBox.appendChild(infoIcon);
  const infoTitle = document.createElement('span');
  infoTitle.textContent = 'Player information';
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
  avatarImg.alt = 'Player Icon';
  avatarImg.width = 32;
  avatarImg.height = 32;
  avatarImg.style.width = '32px';
  avatarImg.style.height = '32px';
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
  nameP.textContent = getProfileValue('name') || 'Player';
  nameCol.appendChild(nameP);
  const levelRow = document.createElement('div');
  levelRow.className = 'flex justify-between gap-2';
      levelRow.title = FormatUtils.number(getProfileValue('xp')) + ' exp';
  const levelLabel = document.createElement('span');
  levelLabel.className = 'pixel-font-14 text-whiteRegular';
  levelLabel.textContent = 'Level';
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
  createdLabel.className = 'pixel-font-14';
  createdLabel.textContent = CYCLOPEDIA_TRANSLATION.createdAt.label;
  const createdValue = document.createElement('div');
  createdValue.className = 'text-whiteHighlight';
  createdValue.textContent = getProfileValue('createdAt');
  createdDiv.appendChild(createdLabel);
  createdDiv.appendChild(createdValue);
  createdDiv.style.textAlign = 'center';
  grid2.appendChild(createdDiv);
  const statusDiv = document.createElement('div');
  const statusLabel = document.createElement('div');
  statusLabel.className = 'pixel-font-14';
  statusLabel.textContent = CYCLOPEDIA_TRANSLATION.premium.label;
  const statusGrid = document.createElement('div');
  statusGrid.className = 'grid grid-cols-[min-content_1fr] gap-1 text-whiteHighlight';
  const statusIconWrap = document.createElement('div');
  statusIconWrap.className = 'relative h-full w-[22px]';
  const statusIcon = document.createElement('img');
  statusIcon.alt = 'Premium pass';
  statusIcon.src = '/assets/icons/premium-yes.png';
  statusIcon.className = 'pixelated absolute -bottom-0.5 left-0';
  statusIcon.width = 22;
  statusIcon.height = 19;
  statusIconWrap.appendChild(statusIcon);
  statusGrid.appendChild(statusIconWrap);
  const statusText = document.createElement('span');
  statusText.className = 'text-ally';
  statusText.textContent = getProfileValue('premium');
  statusGrid.appendChild(statusText);
  statusDiv.appendChild(statusLabel);
  statusDiv.appendChild(statusGrid);
  statusDiv.style.textAlign = 'center';
  grid2.appendChild(statusDiv);
  const loyaltyDiv = document.createElement('div');
  const loyaltyLabel = document.createElement('div');
  loyaltyLabel.className = 'pixel-font-14';
  loyaltyLabel.textContent = 'Loyalty Points';
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
  statsIcon.alt = 'Account';
  statsIcon.src = '/assets/icons/progress.png';
  statsIcon.className = 'pixelated inline-block translate-y-px';
  statsIcon.width = 12;
  statsIcon.height = 12;
  statsBox.appendChild(statsIcon);
  const statsTitle = document.createElement('span');
  statsTitle.textContent = 'Player stats';
  statsBox.appendChild(statsTitle);
  container.appendChild(statsBox);

  const statsTableWrap = document.createElement('div');
  statsTableWrap.className = 'widget-bottom';
  const statsTable = document.createElement('table');
  statsTable.className = 'pixel-font-16 frame-pressed-1 w-full caption-bottom border-separate border-spacing-0 text-whiteRegular';
  const tbody = document.createElement('tbody');
  tbody.className = 'whitespace-nowrap';

  addRow({ label: 'Current total', highlight: true, colspan: 2 });
  addRow({ label: CYCLOPEDIA_TRANSLATION.shell.label, icon: '/assets/icons/shell-count.png', value: (getProfileValue('shell') !== undefined ? FormatUtils.number(getProfileValue('shell')) + 'x' : '-') });
  addRow({ label: CYCLOPEDIA_TRANSLATION.tasks.label, icon: '/assets/icons/task-count.png', value: (getProfileValue('tasks') !== undefined ? FormatUtils.number(getProfileValue('tasks')) + 'x' : '-') });
  addRow({ label: CYCLOPEDIA_TRANSLATION.playCount.label, icon: '/assets/icons/match-count.png', value: (getProfileValue('playCount') !== undefined ? FormatUtils.number(getProfileValue('playCount')) + 'x' : '-') });

  addRow({ label: 'Progress', highlight: true, colspan: 2 });
  CYCLOPEDIA_PROGRESS_STATS.forEach(stat => {
    const val = getProfileValue(stat.key);
    const isMax = val === stat.max;
    const valueStr = `${FormatUtils.number(val)}/${stat.max}`;
    addRow({
      label: CYCLOPEDIA_TRANSLATION[stat.key].label,
      icon: stat.icon,
      value: valueStr,
      valueClass: isMax ? 'stat-maxed' : undefined
    });
  });

  addRow({ label: 'Rankings', highlight: true, colspan: 2 });
  addRow({
    label: CYCLOPEDIA_TRANSLATION.rankPoints.label,
    icon: '/assets/icons/star-tier.png',
    value: (getProfileValue('rankPoints') !== undefined ? FormatUtils.number(getProfileValue('rankPoints')) : '-'),
    title: profileData.rankPointsPosition !== undefined ? 'Position: ' + profileData.rankPointsPosition : undefined,
    extraIcon: { alt: 'Highscore', src: '/assets/icons/highscore.png' }
  });
  addRow({
    label: CYCLOPEDIA_TRANSLATION.timeSum.label,
    icon: '/assets/icons/speed.png',
    value: (getProfileValue('timeSum') !== undefined ? FormatUtils.number(getProfileValue('timeSum')) : '-'),
    title: profileData.ticksPosition !== undefined ? 'Position: ' + profileData.ticksPosition : undefined,
    extraIcon: { alt: 'Highscore', src: '/assets/icons/highscore.png' }
  });
  addRow({
    label: CYCLOPEDIA_TRANSLATION.floorsSum.label,
    icon: '/assets/UI/floor-15.png',
    iconConfig: { width: 14, height: 7, className: 'pixelated -ml-px mr-0.5 inline-block -translate-y-0.5' },
    value: (getProfileValue('floorsSum') !== undefined ? FormatUtils.number(getProfileValue('floorsSum')) : '-'),
    title: profileData.floorsPosition !== undefined ? 'Position: ' + profileData.floorsPosition : undefined,
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
    fallbackDiv.textContent = 'Failed to load player information.';
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
  yasirLocP.className = 'pixel-font-14';
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
  // Note: This function is safe to call multiple times (idempotent)
  // Only clean up modal-specific resources, preserve global context menu observer
  
  // Don't stop the global context menu observer - it's needed for future right-click menus
  // cyclopediaState.observer and window.cyclopediaGlobalObserver handle context menu injection
  
  if (window.cyclopediaMenuObserver) {
    try {
      window.cyclopediaMenuObserver.disconnect();
      window.cyclopediaMenuObserver = null;

    } catch (error) {
    console.log('[Cyclopedia] Error in monster location cache:', error);
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
    console.log('[Cyclopedia] Starting comprehensive cleanup...');
    
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
    
    console.log('[Cyclopedia] Cleanup completed successfully');
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
      console.log('[Cyclopedia] Exports cleanup called');
      
      // Comprehensive cleanup per mod development guide
      cleanupCyclopedia();
      
      // Additional cleanup for mod disable
      // Clear all global references
      if (typeof window !== 'undefined') {
        window.selectedCharacterItem = null;
        window.cyclopediaSelectedEquipment = null;
        window.cyclopediaMenuObserver = null;
        window.cyclopediaGlobalObserver = null;
      }
      
      // Clear all caches
      if (cyclopediaState) {
        cyclopediaState.cleanup();
      }
      
      console.log('[Cyclopedia] Exports cleanup completed');
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


