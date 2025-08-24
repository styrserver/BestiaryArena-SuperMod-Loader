// =======================
// 1. Configuration
// =======================
'use strict';
const START_PAGE_CONFIG = { API_TIMEOUT: 10000, COLUMN_WIDTHS: { LEFT: 300, MIDDLE: 300, RIGHT: 300 }, API_BASE_URL: 'https://bestiaryarena.com/api/trpc/serverSide.profilePageData', FRAME_IMAGE_URL: 'https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png' };
var inventoryTooltips = (typeof window !== 'undefined' && window.inventoryTooltips) || {};
if (!(inventoryTooltips && typeof inventoryTooltips === 'object')) {}
const CYCLOPEDIA_MODAL_WIDTH = 900, CYCLOPEDIA_MODAL_HEIGHT = 600;
const LAYOUT_CONSTANTS = { COLUMN_WIDTH: '247px', LEFT_COLUMN_WIDTH: '200px', MODAL_WIDTH: 900, MODAL_HEIGHT: 600, CHROME_HEIGHT: 70, COLORS: { PRIMARY: '#ffe066', SECONDARY: '#e6d7b0', BACKGROUND: '#232323', TEXT: '#fff', ERROR: '#ff6b6b', WARNING: '#888' }, FONTS: { PRIMARY: 'pixel-font', SMALL: 'pixel-font-14', MEDIUM: 'pixel-font-16', LARGE: 'pixel-font-16', SIZES: { TITLE: 'pixel-font-16', BODY: 'pixel-font-16', SMALL: 'pixel-font-14', TINY: 'pixel-font-14' } } };
const INVENTORY_CATEGORIES = {
  'Consumables': ['Change Nickname', 'Dice Manipulators', 'Exaltation Chests', 'Nickname Creature', 'Outfit Bags', 'Stamina Potions', 'Stones of Insight', 'Summon Scrolls', 'Surprise Cubes'],
  'Currency': ['Beast Coins', 'Dust', 'Gold', 'Hunting Marks'],
  'Upgrades': ['Daily Boosted Map', 'Daycare', 'Hy\'genie', 'Monster Cauldron', 'Monster Raids', 'Monster Squeezer', 'Mountain Fortress', 'Premium', 'The Sweaty Cyclop\'s Forge', 'Yasir\'s Trading Contract']
};

const INVENTORY_VARIANTS = {
  'Change Nickname': ['nicknameChange'],
  'Dice Manipulators': ['diceManipulator1', 'diceManipulator2', 'diceManipulator3', 'diceManipulator4', 'diceManipulator5'],
  'Exaltation Chests': ['equipChest'], 'Nickname Creature': ['nicknameMonster'], 'Outfit Bags': ['hunterOutfitBag', 'outfitBag1'],
  'Stamina Potions': ['stamina1', 'stamina2', 'stamina3', 'stamina4', 'stamina5'],
  'Stones of Insight': ['insightStone1', 'insightStone2', 'insightStone3', 'insightStone4', 'insightStone5'],
  'Summon Scrolls': ['summonScroll1', 'summonScroll2', 'summonScroll3', 'summonScroll4', 'summonScroll5'],
  'Surprise Cubes': ['surpriseCube1', 'surpriseCube2', 'surpriseCube3', 'surpriseCube4', 'surpriseCube5'],
  'Beast Coins': ['beastCoins'], 'Dust': ['dust'], 'Gold': ['gold'], 'Hunting Marks': ['huntingMarks'],
  'Daily Boosted Map': ['dailyBoostedMap'], 'Daycare': ['daycare'], 'Hy\'genie': ['hygenie'],
  'Monster Cauldron': ['monsterCauldron'], 'Monster Raids': ['monsterRaids'], 'Monster Squeezer': ['monsterSqueezer'], 'Mountain Fortress': ['mountainFortress'],
  'Premium': ['premium'], 'The Sweaty Cyclop\'s Forge': ['forge'], 'Yasir\'s Trading Contract': ['yasirTradingContract']
};

const INVENTORY_STATIC_ITEMS = {
  'beastCoins': { name: 'Beast Coins', rarity: '1' }, 'dust': { name: 'Dust', rarity: '2' },
  'gold': { name: 'Gold', rarity: '3' }, 'huntingMarks': { name: 'Hunting Marks', rarity: '4' },
  'nicknameMonster': { name: 'Nickname Creature', rarity: '3' }, 'nicknameChange': { name: 'Change Nickname', rarity: '2' },
  'nicknamePlayer': { name: 'Player Nickname', rarity: '2' }, 'equipChest': { name: 'Exaltation Chest', rarity: '5' },
  'hunterOutfitBag': { name: 'Hunter Outfit Bag', rarity: '3' }, 'outfitBag1': { name: 'Outfit Bag', rarity: '2' },
  'dailyBoostedMap': { name: 'Daily Boosted Map', rarity: '4' }, 'daycare': { name: 'Daycare', rarity: '3' },
  'hygenie': { name: 'Hy\'genie', rarity: '5' }, 'monsterCauldron': { name: 'Monster Cauldron', rarity: '4' },
  'monsterRaids': { name: 'Monster Raids', rarity: '4' }, 'monsterSqueezer': { name: 'Monster Squeezer', rarity: '3' }, 'mountainFortress': { name: 'Mountain Fortress', rarity: '4' },
  'premium': { name: 'Premium', rarity: '5' }, 'forge': { name: 'The Sweaty Cyclop\'s Forge', rarity: '5' },
  'yasirTradingContract': { name: 'Yasir\'s Trading Contract', rarity: '4' }
};

const RARITY_CONFIG = {
  text: { '1': 'Common', '2': 'Uncommon', '3': 'Rare', '4': 'Epic', '5': 'Legendary' },
  colors: { '1': '#9d9d9d', '2': '#1eff00', '3': '#0070dd', '4': '#a335ee', '5': '#ff8000' }
};

const INVENTORY_CONFIG = {
  categories: INVENTORY_CATEGORIES,
  variants: INVENTORY_VARIANTS,
  staticItems: INVENTORY_STATIC_ITEMS,
  rarityText: RARITY_CONFIG.text,
  rarityColors: RARITY_CONFIG.colors
};
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
const MONSTER_STATS_CONFIG = [
    { key: 'hp', label: 'Hitpoints', icon: '/assets/icons/heal.png', max: 700, barColor: 'rgb(96, 192, 96)' },
    { key: 'ad', label: 'Attack Damage', icon: '/assets/icons/attackdamage.png', max: 80, barColor: 'rgb(255, 128, 96)' },
    { key: 'ap', label: 'Ability Power', icon: '/assets/icons/abilitypower.png', max: 60, barColor: 'rgb(128, 128, 255)' },
    { key: 'armor', label: 'Armor', icon: '/assets/icons/armor.png', max: 60, barColor: 'rgb(224, 224, 128)' },
    { key: 'magicResist', label: 'Magic Resist', icon: '/assets/icons/magicresist.png', max: 60, barColor: 'rgb(192, 128, 255)' }
];

const UNOBTAINABLE_CREATURES = ['Black Knight', 'Dead Tree', 'Earth Crystal', 'Energy Crystal', 'Lavahole', 'Magma Crystal', 'Old Giant Spider', 'Orc', 'Sweaty Cyclops', 'Willi Wasp'];

const ALL_CREATURES = ['Amazon', 'Banshee', 'Bear', 'Bog Raider', 'Bug', 'Corym Charlatan', 'Corym Skirmisher', 'Corym Vanguard', 'Cyclops', 'Deer', 'Demon Skeleton', 'Dragon', 'Dragon Lord', 'Druid', 'Dwarf', 'Dwarf Geomancer', 'Dwarf Guard', 'Dwarf Soldier', 'Elf', 'Elf Arcanist', 'Elf Scout', 'Fire Devil', 'Fire Elemental', 'Firestarter', 'Frost Troll', 'Ghost', 'Ghoul', 'Giant Spider', 'Goblin', 'Goblin Assassin', 'Goblin Scavenger', 'Knight', 'Minotaur', 'Minotaur Archer', 'Minotaur Guard', 'Minotaur Mage', 'Monk', 'Mummy', 'Nightstalker', 'Orc Berserker', 'Orc Leader', 'Orc Rider', 'Orc Shaman', 'Orc Spearman', 'Orc Warlord', 'Poison Spider', 'Polar Bear', 'Rat', 'Rorc', 'Rotworm', 'Scorpion', 'Sheep', 'Skeleton', 'Slime', 'Snake', 'Spider', 'Stalker', 'Swamp Troll', 'Tortoise', 'Troll', 'Valkyrie', 'Warlock', 'Wasp', 'Water Elemental', 'Witch', 'Winter Wolf', 'Wolf', 'Wyvern'];

const ALL_EQUIPMENT = ['Amazon Armor', 'Amazon Helmet', 'Amazon Shield', 'Amulet of Loss', 'Bear Skin', 'Bloody Edge', 'Blue Robe', 'Bonelord Helmet', 'Boots of Haste', 'Chain Bolter', 'Cranial Basher', 'Dwarven Helmet', 'Dwarven Legs', 'Ectoplasmic Shield', 'Epee', 'Fire Axe', 'Giant Sword', 'Glacial Rod', 'Glass of Goo', 'Hailstorm Rod', 'Ice Rapier', 'Jester Hat', 'Medusa Shield', 'Ratana', 'Royal Scale Robe', 'Rubber Cap', 'Skull Helmet', 'Skullcracker Armor', 'Springsprout Rod', 'Steel Boots', 'Stealth Ring', 'Vampire Shield', 'Wand of Decay', 'White Skull'];

const GAME_KEYS = {
  NO_RARITY: ['nicknameChange', 'nicknameMonster', 'hunterOutfitBag', 'outfitBag1'],
  CURRENCY: ['gold', 'dust', 'beastCoins', 'huntingMarks'],
  UPGRADE: ['dailyBoostedMap', 'daycare', 'hygenie', 'monsterCauldron', 'monsterRaids', 'monsterSqueezer', 'mountainFortress', 'premium', 'forge', 'yasirTradingContract']
};

const EXP_TABLE = [[5, 11250], [6, 17000], [7, 24000], [8, 32250], [9, 41750], [10, 52250], [11, 64250], [12, 77750], [13, 92250], [14, 108500], [15, 126250], [16, 145750], [17, 167000], [18, 190000], [19, 215250], [20, 242750], [21, 272750], [22, 305750], [23, 342000], [24, 382000], [25, 426250], [26, 475250], [27, 530000], [28, 591500], [29, 660500], [30, 738500], [31, 827000], [32, 928000], [33, 1043500], [34, 1176000], [35, 1329000], [36, 1505750], [37, 1710500], [38, 1948750], [39, 2226500], [40, 2550500], [41, 2929500], [42, 3373500], [43, 3894000], [44, 4504750], [45, 5222500], [46, 6066000], [47, 7058000], [48, 8225000], [49, 9598500], [50, 11214750]];

const HARDCODED_MONSTER_STATS = {
  'old giant spider': { baseStats: { hp: 1140, ad: 108, ap: 30, armor: 30, magicResist: 30 }, level: 300 },
  'willi wasp': { baseStats: { hp: 924, ad: 0, ap: 0, armor: 26, magicResist: 45 }, level: 100 },
  'black knight': { baseStats: { hp: 4800, ad: 66, ap: 0, armor: 975, magicResist: 975 }, level: 300 },
  'dead tree': { baseStats: { hp: 7000, ad: 0, ap: 0, armor: 700, magicResist: 700 }, level: 100 },
  'earth crystal': { baseStats: { hp: 350, ad: 0, ap: 0, armor: 350, magicResist: 350 }, level: 50 },
  'energy crystal': { baseStats: { hp: 350, ad: 0, ap: 0, armor: 150, magicResist: 30 }, level: 50 },
  'magma crystal': { baseStats: { hp: 350, ad: 0, ap: 0, armor: 350, magicResist: 350 }, level: 50 }
};

const MAP_INTERACTION_CONFIG = {
  cursor: 'pointer',
  textDecoration: 'underline',
  tooltip: 'Click to go to this map',
  hoverBackground: 'rgba(255,255,255,0.08)',
  hoverTextColor: '#4a9eff',
  defaultBackground: 'transparent',
  defaultTextColor: LAYOUT_CONSTANTS.COLORS.TEXT,
  padding: '2px 6px',
  borderRadius: '4px',
  boxSizing: 'border-box'
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
  RARITY_COLORS: RARITY_CONFIG.colors,
  EXP_TABLE,
  HARDCODED_MONSTER_STATS,
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
      queueStatus: RequestQueue.getStatus(),
      memoryInfo: MemoryUtils.getMemoryInfo()
    };
  },
  
  cleanup: function() {
    this.clearCache();
    this.timers.forEach(timer => { if (timer) clearInterval(timer); });
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
const MemoryUtils = {
  clearLargeObjects: function() {
    if (window.cyclopediaMenuObserver) {
      try { 
        window.cyclopediaMenuObserver.disconnect(); 
        window.cyclopediaMenuObserver = null; 
      } catch (e) {}
    }
  },
  
  getMemoryInfo: function() {
    return {
      eventHandlers: EventHandlerManager.getHandlerCount(),
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
  
  createTitle: function(text, className = LAYOUT_CONSTANTS.FONTS.SIZES.TITLE) {
    const titleEl = document.createElement('h2');
    titleEl.className = 'widget-top widget-top-text ' + className;
    Object.assign(titleEl.style, { margin: '0', padding: '2px 8px', textAlign: 'center', color: LAYOUT_CONSTANTS.COLORS.TEXT });
    const p = document.createElement('p');
    p.textContent = text; p.className = className;
    Object.assign(p.style, { margin: '0', padding: '0', textAlign: 'center', color: LAYOUT_CONSTANTS.COLORS.TEXT });
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
  
  createListItem: function(text, className = LAYOUT_CONSTANTS.FONTS.SIZES.BODY) {
    const item = document.createElement('div');
    item.textContent = text; item.className = className;
    Object.assign(item.style, { color: LAYOUT_CONSTANTS.COLORS.TEXT, cursor: 'pointer', padding: '2px 4px', borderRadius: '2px', textAlign: 'left' });
    return item;
  }
};

// =======================
// 4. Event Handler Management
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
      clearTimeout(cyclopediaState.searchDebounceTimer);
      func(...args);
    };
    clearTimeout(cyclopediaState.searchDebounceTimer);
    cyclopediaState.searchDebounceTimer = setTimeout(later, wait);
  };
}

const DOMCache = {
  cache: new Map(),
  cacheTimeout: 1000,

  get: function(selector, context = document) {
    const key = `${selector}_${context === document ? 'doc' : context.id || 'ctx'}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) return cached.element;
    const element = context.querySelector(selector);
    this.cache.set(key, { element, timestamp: Date.now() });
    return element;
  },

  getAll: function(selector, context = document) {
    const key = `all_${selector}_${context === document ? 'doc' : context.id || 'ctx'}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) return cached.elements;
    const elements = context.querySelectorAll(selector);
    this.cache.set(key, { elements, timestamp: Date.now() });
    return elements;
  },

  clear: function() { this.cache.clear(); },

  clearSelector: function(selector) {
    for (const key of this.cache.keys()) {
      if (key.includes(selector)) this.cache.delete(key);
    }
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
function getCurrencyFromUI(currencyType) { try { const config = CURRENCY_UI_SELECTORS[currencyType]; if (!config) return null; const selector = config.button ? 'button' : 'div'; const element = Array.from(DOMCache.getAll(selector)).find(el => { const div = el.querySelector(`.frame-pressed-1[title="${config.title}"]`); const img = el.querySelector(`img[alt="${config.alt}"]`); return div || img; }); if (!element) return null; const span = element.querySelector('span'); if (!span) return null; const value = span.textContent.replace(/,/g, ''); const parsedValue = parseInt(value, 10); return isNaN(parsedValue) ? null : parsedValue; } catch (error) { console.warn(`[Cyclopedia] Error getting ${currencyType} from UI:`, error); return null; } }
function getCurrencyFromGameState(currencyType) { try { const gameState = globalThis.state?.player?.getSnapshot()?.context; if (!gameState) return null; const paths = CURRENCY_GAME_STATE_PATHS[currencyType]; if (!paths) return null; for (const path of paths) { const value = path.split('?.').reduce((obj, key) => obj?.[key], gameState); if (typeof value === 'number' && !isNaN(value) && value >= 0) return value; } return null; } catch (error) { return null; } }
function getGoldFromUI() { return getCurrencyFromUI('gold'); }

function getBeastCoinsFromUI() { return getCurrencyFromUI('beastCoins'); }
function getDustFromUI() { return getCurrencyFromUI('dust'); }
function getDustFromGameState() { return getCurrencyFromGameState('dust'); }

function getHuntingMarksFromUI() {
  try {
    let huntingMarksSprite = HUNTING_MARKS_UI_SELECTORS.reduce((found, selector) => {
      if (found) return found;
      const element = DOMCache.get(selector);
      return element?.tagName === 'IMG' ? element.closest('.sprite.item.relative') : element;
    }, null);
    
    if (!huntingMarksSprite) {
      const huntingMarksText = Array.from(DOMCache.getAll('*')).find(el => 
        el.textContent?.includes('Hunting Marks')
      );
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
// 5. Characters Tab Caching Utilities
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

// Image caching functions for room thumbnails
function getCachedRoomThumbnail(roomCode) {
  return cyclopediaState.cache.roomThumbnails.get(roomCode);
}

function setCachedRoomThumbnail(roomCode, imgElement) {
  cyclopediaState.cache.roomThumbnails.set(roomCode, imgElement);
  // Enforce cache size limit
  if (cyclopediaState.cache.roomThumbnails.size > cyclopediaState.cache.maxSize.roomThumbnails) {
    const firstKey = cyclopediaState.cache.roomThumbnails.keys().next().value;
    cyclopediaState.cache.roomThumbnails.delete(firstKey);
  }
}

function createRoomThumbnail(roomCode, roomName, size = 32) {
  let cachedThumbnail = getCachedRoomThumbnail(roomCode);
  
  if (cachedThumbnail) {
    const clonedThumbnail = cachedThumbnail.cloneNode(true);
    clonedThumbnail.style.width = `${size}px`;
    clonedThumbnail.style.height = `${size}px`;
    return clonedThumbnail;
  }
  
  const thumbnail = document.createElement('img');
  thumbnail.src = `/assets/room-thumbnails/${roomCode}.png`;
  thumbnail.alt = roomName;
  thumbnail.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    border-radius: 4px;
    object-fit: cover;
  `;
  
  setCachedRoomThumbnail(roomCode, thumbnail);
  
  return thumbnail;
}

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
  } catch (error) {}
  
  for (let i = 1; i <= maxId; i++) {
    try {
      const monster = utils.getMonster(i);
      if (monster?.metadata?.name) {
        cyclopediaState.monsterNameMap.set(monster.metadata.name.toLowerCase(), { monster, index: i });
      }
    } catch (error) { continue; }
  }
  cyclopediaState.monsterNameMapBuilt = true;
  
  Object.entries(GAME_DATA.HARDCODED_MONSTER_STATS).forEach(([monsterName, stats]) => {
    const entry = cyclopediaState.monsterNameMap.get(monsterName);
    if (entry?.monster?.metadata) {
      if (stats.baseStats) entry.monster.metadata.baseStats = stats.baseStats;
      if (stats.level) entry.monster.metadata.level = stats.level;
    }
  });
  
  return cyclopediaState.monsterNameMap;
});

const MENU_UTILS = {
  getGroup: (menuElem) => menuElem.querySelector('div[role="group"]'),
  getFirstItem: (group) => group?.querySelector('.dropdown-menu-item'),
  getTierItem: (group) => Array.from(group?.querySelectorAll('.dropdown-menu-item') || []).find(item => /\(Tier[: ]?\d+\)/.test(item.textContent)) || group?.querySelector('.dropdown-menu-item'),
  extractName: (text, pattern) => {
    const match = text.trim().match(pattern);
    return match ? match[1] : text.trim();
  }
};

function getMonsterNameFromMenu(menuElem) {
  const group = MENU_UTILS.getGroup(menuElem);
  const firstItem = MENU_UTILS.getFirstItem(group);
  return firstItem ? MENU_UTILS.extractName(firstItem.textContent, /^(.*?)\s*\(/) : null;
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
      } catch (error) {}
    });
  } catch (error) {}
  
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
// 6. DOM/CSS Injection Helpers
// =======================
const CYCLOPEDIA_BUTTON_CSS = `.cyclopedia-subnav { display: flex; gap: 0; margin-bottom: 0; width: 100%; } nav.cyclopedia-subnav > button.cyclopedia-btn, nav.cyclopedia-subnav > button.cyclopedia-btn:hover, nav.cyclopedia-subnav > button.cyclopedia-btn:focus { background: url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat !important; border: 6px solid transparent !important; border-color: #ffe066 !important; border-image: url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch !important; color: var(--theme-text, #e6d7b0) !important; font-weight: 700 !important; border-radius: 0 !important; box-sizing: border-box !important; transition: color 0.2s, border-image 0.1s !important; font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif !important; outline: none !important; position: relative !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; font-size: 16px !important; padding: 7px 24px !important; cursor: pointer; flex: 1 1 0; min-width: 0; } nav.cyclopedia-subnav > button.cyclopedia-btn.pressed, nav.cyclopedia-subnav > button.cyclopedia-btn:active { border-image: url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 6 fill stretch !important; } nav.cyclopedia-subnav > button.cyclopedia-btn.active { border-image: url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 6 fill stretch !important; } nav.cyclopedia-subnav > button.cyclopedia-btn[data-tab="home"], nav.cyclopedia-subnav > button.cyclopedia-btn[data-tab="wiki"] { width: 42px !important; height: 42px !important; min-width: 42px !important; min-height: 42px !important; max-width: 42px !important; max-height: 42px !important; flex: 0 0 42px !important; padding: 0 !important; font-size: 12px !important; }`;
function injectCyclopediaButtonStyles() { if (!document.getElementById('cyclopedia-btn-css')) { const style = document.createElement('style'); style.id = 'cyclopedia-btn-css'; style.textContent = CYCLOPEDIA_BUTTON_CSS; document.head.appendChild(style); } }

const CYCLOPEDIA_BOX_CSS = `.cyclopedia-box { display: flex; flex-direction: column; border: none; background: none; margin-bottom: 16px; min-height: 120px; box-sizing: border-box; } .cyclopedia-box-title { border: 6px solid transparent; border-image: url('https://bestiaryarena.com/_next/static/media/4-frame-top.b7a55115.png') 6 6 0 6 stretch; border-bottom: none; background: #232323; color: #ffe066; font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif; font-size: 15px; font-weight: bold; padding: 4px 12px; text-align: left; letter-spacing: 1px; } .cyclopedia-box-content { flex: 1 1 0; overflow-y: auto; background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat; padding: 8px 12px; color: #e6d7b0; font-size: 14px; font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif; min-height: 0; max-height: none; scrollbar-width: thin !important; scrollbar-color: #444 #222 !important; } .cyclopedia-box-content::-webkit-scrollbar { width: 12px !important; background: transparent !important; } .cyclopedia-box-content::-webkit-scrollbar-thumb { background: url('https://bestiaryarena.com/_next/static/media/scrollbar-handle-vertical.962972d4.png') repeat-y !important; border-radius: 4px !important; } .cyclopedia-box-content::-webkit-scrollbar-corner { background: transparent !important; }`;
function injectCyclopediaBoxStyles() { if (!document.getElementById('cyclopedia-box-css')) { const style = document.createElement('style'); style.id = 'cyclopedia-box-css'; style.textContent = CYCLOPEDIA_BOX_CSS; document.head.appendChild(style); } }

const CYCLOPEDIA_SELECTED_CSS = `.cyclopedia-selected { background: rgba(255,255,255,0.18) !important; color: #ffe066 !important; } .cyclopedia-box .equipment-portrait .absolute { background: none !important; } .cyclopedia-box .equipment-portrait[data-highlighted="true"] .absolute { background: none !important; } .cyclopedia-box .equipment-portrait .absolute[style*="radial-gradient"] { background: none !important; } .cyclopedia-box .equipment-portrait .absolute[style*="background: radial-gradient"] { background: none !important; } .cyclopedia-box .equipment-portrait .absolute[style*="rgba(0, 0, 0, 0.5)"] { background: none !important; } .cyclopedia-box .equipment-portrait .absolute.bottom-0.left-0 { background: none !important; }`;
function injectCyclopediaSelectedCss() { if (!document.getElementById('cyclopedia-selected-css')) { const style = document.createElement('style'); style.id = 'cyclopedia-selected-css'; style.textContent = CYCLOPEDIA_SELECTED_CSS; document.head.appendChild(style); } }

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
  
  // Process all cyclopedia elements
  document.querySelectorAll('div, li').forEach(el => {
    if (el.textContent.trim().toLowerCase() === 'cyclopedia') {
      const inMyAccount = isInMenu(el, 'My account');
      const inGameMode = isInMenu(el, 'Game mode');
      const isHeader = isHeaderButton(el);
      const inHeader = isInHeader(el);
      
      if ((inMyAccount || inGameMode) && !isHeader && !inHeader) el.style.display = 'none';
    }
  });
}

setTimeout(removeCyclopediaFromMenus, 500);
const cyclopediaMenuObserver = new MutationObserver(removeCyclopediaFromMenus);
cyclopediaMenuObserver.observe(document.body, { childList: true, subtree: true });
window.cyclopediaMenuObserver = cyclopediaMenuObserver;

// =======================
// 7. UI Creation Functions
// =======================
function createBox({
  title, items, extraBoxStyles = {}, type = 'creature', selectedCreature, selectedEquipment, selectedInventory,
  setSelectedCreature, setSelectedEquipment, setSelectedInventory, updateRightCol, clearAllSelections = null
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
      const item = DOMUtils.createListItem(name);
      
      const clickHandler = () => {
        if (clearAllSelections) {
          clearAllSelections();
        } else if (box.clearAllSelections) {
          box.clearAllSelections();
        } else {
          box.querySelectorAll('.cyclopedia-selected').forEach(el => {
            el.classList.remove('cyclopedia-selected');
            el.style.background = 'none';
            el.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
          });
        }
        
        item.classList.add('cyclopedia-selected');
        item.style.background = 'rgba(255,255,255,0.18)';
        item.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
        
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
          } else if (type === 'inventory') {
            setSelectedCreature(null);
            setSelectedEquipment(null);
            setSelectedInventory(name);
            updateRightCol();
        }
      };
      
      const mouseEnterHandler = () => { item.style.background = 'rgba(255,255,255,0.08)'; };
      const mouseLeaveHandler = () => {
        if (!item.classList.contains('cyclopedia-selected')) item.style.background = 'none';
      };
      const mouseDownHandler = () => { item.style.background = 'rgba(255,255,255,0.18)'; };
      const mouseUpHandler = () => {
        if (!item.classList.contains('cyclopedia-selected')) item.style.background = 'rgba(255,255,255,0.08)';
      };
      
      EventHandlerManager.addHandler(item, 'click', clickHandler);
      EventHandlerManager.addHandler(item, 'mouseenter', mouseEnterHandler);
      EventHandlerManager.addHandler(item, 'mouseleave', mouseLeaveHandler);
      EventHandlerManager.addHandler(item, 'mousedown', mouseDownHandler);
      EventHandlerManager.addHandler(item, 'mouseup', mouseUpHandler);
      
      if (type === 'equipment' && selectedEquipment && name === selectedEquipment) {
        item.classList.add('cyclopedia-selected');
        item.style.background = 'rgba(255,255,255,0.18)';
        item.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
      }
      
      if (type === 'inventory' && selectedInventory && name === selectedInventory) {
        item.classList.add('cyclopedia-selected');
        item.style.background = 'rgba(255,255,255,0.18)';
        item.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
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

/**
 * Waits for data-scroll-locked to be 0 or empty before running callback.
 */


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
          setTimeout(tryInsert, 500);
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
        const wikiLi = Array.from(headerUl.children).find(
          el => el.querySelector('a') && el.textContent.includes('Wiki')
        );
        if (wikiLi && wikiLi.nextSibling) {
          headerUl.insertBefore(li, wikiLi.nextSibling);
        } else {
          headerUl.appendChild(li);
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

function getEquipmentNameFromMenu(menuElem) {
  const group = MENU_UTILS.getGroup(menuElem);
  const tierItem = MENU_UTILS.getTierItem(group);
  return tierItem ? MENU_UTILS.extractName(tierItem.textContent, /^(.*?)\s*\(Tier[: ]?\d+\)/) : null;
}

function injectCyclopediaButton(menuElem) {
  const body = document.body;
  const scrollLocked = body.getAttribute('data-scroll-locked');
  if (scrollLocked >= '2') return;
  
  const existingButtons = menuElem.querySelectorAll('.cyclopedia-menu-item');
  existingButtons.forEach(btn => {
    try {
      if (btn.parentNode) btn.parentNode.removeChild(btn);
    } catch (error) {}
  });
  
  if (existingButtons.length > 0) return;
  
  const monsterName = getMonsterNameFromMenu(menuElem);
  const equipmentName = getEquipmentNameFromMenu(menuElem);
  const allEquipment = GAME_DATA.ALL_EQUIPMENT;
  let matchedEquipment = null;
  let normalizedEquipmentName = null;
  if (equipmentName) {
    normalizedEquipmentName = equipmentName.replace(/\s*\(Tier: \d+\)/i, '').trim();
    matchedEquipment = allEquipment.find(e => e.toLowerCase() === normalizedEquipmentName.toLowerCase());
  }
  const cyclopediaItem = document.createElement('div');
  cyclopediaItem.className = 'dropdown-menu-item cyclopedia-menu-item relative flex cursor-default select-none items-center gap-2 outline-none';
  cyclopediaItem.setAttribute('role', 'menuitem');
  cyclopediaItem.setAttribute('tabindex', '-1');
  cyclopediaItem.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open"><path d="M2 19V6a2 2 0 0 1 2-2h7"></path><path d="M22 19V6a2 2 0 0 0-2-2h-7"></path><path d="M2 19a2 2 0 0 0 2 2h7"></path><path d="M22 19a2 2 0 0 1-2 2h-7"></path></svg>Cyclopedia`;
  cyclopediaItem.addEventListener('click', (e) => {
    e.stopPropagation();
    const equipmentToOpen = matchedEquipment;
    const creatureToOpen = monsterName;
    if (equipmentToOpen) {
      openCyclopediaModal({ equipment: equipmentToOpen });
    } else if (creatureToOpen && typeof creatureToOpen === 'string') {
      openCyclopediaModal({ creature: creatureToOpen });
    } else {
      openCyclopediaModal({});
    }
  });
  const separator = menuElem.querySelector('.separator');
  if (separator) {
    separator.parentNode.insertBefore(cyclopediaItem, separator);
  } else {
    menuElem.appendChild(cyclopediaItem);
  }
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
// 8. Data/Model Functions
// =======================
function startContextMenuObserver() {
  if (cyclopediaState.observer && window.cyclopediaGlobalObserver) {
    return;
  }
  
  if (window.cyclopediaGlobalObserver) {
    try {
      window.cyclopediaGlobalObserver.disconnect();
    } catch (error) {}
    window.cyclopediaGlobalObserver = null;
  }
  
  if (cyclopediaState.observer) {
    try {
      cyclopediaState.observer.disconnect();
    } catch (error) {}
    cyclopediaState.observer = null;
  }
  
  cyclopediaState.observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          if (node.matches && node.matches('div[data-radix-popper-content-wrapper]')) {
            const menu = node.querySelector('[role="menu"]');
            if (menu) setTimeout(() => injectCyclopediaButton(menu), 10);
          } else if (node.querySelector) {
            const wrapper = node.querySelector('div[data-radix-popper-content-wrapper]');
            if (wrapper) {
              const menu = wrapper.querySelector('[role="menu"]');
              if (menu) setTimeout(() => injectCyclopediaButton(menu), 10);
            }
          }
        }
      }
    }
  });
  
  cyclopediaState.observer.observe(document.body, { childList: true, subtree: true });
  window.cyclopediaGlobalObserver = cyclopediaState.observer;
}

function stopContextMenuObserver() {
  if (cyclopediaState.observer) {
    try {
    cyclopediaState.observer.disconnect();
    } catch (error) {}
    cyclopediaState.observer = null;
  }
  
  if (window.cyclopediaGlobalObserver) {
    try {
      window.cyclopediaGlobalObserver.disconnect();
    } catch (error) {}
    window.cyclopediaGlobalObserver = null;
  }
}

// =======================
// 9. Modal & Template Rendering
// =======================

let activeCyclopediaModal = null;
let cyclopediaModalInProgress = false;
let lastModalCall = 0;

function createStartPageManager() {
  const HTML_TEMPLATES = {
    loading: () => `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.TEXT};">
        <div style="font-size: 24px; margin-bottom: 16px;">📚</div>
        <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Loading Cyclopedia...</div>
        <div style="font-size: 14px; color: #888;">Fetching your profile data</div>
      </div>
    `,
    error: (message) => `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.ERROR}; text-align: center; padding: 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load Profile Data</div>
        <div style="font-size: 14px; margin-bottom: 16px; color: #888;">${message}</div>
        <button id="retry-profile-load" style="padding: 8px 16px; background: #444; border: 1px solid #666; border-radius: 4px; color: white; cursor: pointer; font-family: ${LAYOUT_CONSTANTS.FONTS.PRIMARY};">Retry</button>
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
          } catch (error) {}
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
                  setTimeout(() => {
                    page.updateRightCol();
                  }, 10);
                }
              }
            } catch (error) {}
          }
        });
      };
    }

    function createBestiaryTabPage(selectedCreature, selectedEquipment, selectedInventory, setSelectedCreature, setSelectedEquipment, setSelectedInventory, updateRightCol) {
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
          rightCol.appendChild(renderCreatureTemplate(selectedCreature));
        } else {
          const msg = DOMUtils.createElement('div', LAYOUT_CONSTANTS.FONTS.SIZES.BODY, 'Select a creature from the left column to view.');
          Object.assign(msg.style, {
            display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%',
            color: LAYOUT_CONSTANTS.COLORS.TEXT, fontWeight: 'bold', textAlign: 'center'
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
        return box;
      };
      
      const creaturesBox = createCreatureBox('Creatures', GAME_DATA.ALL_CREATURES);
      const unobtainableBox = createCreatureBox('Unobtainable', GAME_DATA.UNOBTAINABLE_CREATURES);
      
      // Shared selection clearing
      const clearAllBestiarySelections = () => {
        [creaturesBox, unobtainableBox].forEach(box => {
          box.querySelectorAll('.cyclopedia-selected').forEach(el => {
          el.classList.remove('cyclopedia-selected');
          el.style.background = 'none';
          el.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
          fontWeight: 'bold', color: LAYOUT_CONSTANTS.COLORS.TEXT,
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

      const updateEquipDetailsTitle = (titleP) => {
        titleP.textContent = 'Equipment Details';
      };
      const { title: equipDetailsTitle, titleP: equipDetailsTitleP } = createTitleElement('Equipment Details', updateEquipDetailsTitle);
      equipDetailsCol.appendChild(equipDetailsTitle);

      const ownedEquipCol = document.createElement('div');
      Object.assign(ownedEquipCol.style, EQUIPMENT_STYLES.column);
      ownedEquipCol.classList.add('text-whiteHighlight');

      const updateOwnedEquipTitle = (titleP) => {
        titleP.textContent = 'Owned Equipment';
      };
      const { title: ownedEquipTitle, titleP: ownedEquipTitleP } = createTitleElement('Owned Equipment', updateOwnedEquipTitle);
      ownedEquipCol.appendChild(ownedEquipTitle);

      function updateRightCol() {
        equipDetailsCol.innerHTML = '';
        equipDetailsCol.appendChild(equipDetailsTitle);

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
          equipDetailsCol.innerHTML += '<div class="' + LAYOUT_CONSTANTS.FONTS.SIZES.BODY + '" style="text-align:center;">Select equipment to view details</div>';
        } else {
          equipDetailsTitleP.textContent = currentSelectedEquipment;
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
              } catch (e) {}
            }
          }

          if (equipId == null) {
            equipDetailsCol.innerHTML += '<div class="' + LAYOUT_CONSTANTS.FONTS.SIZES.BODY + '" style="text-align:center;">Equipment not found</div>';
          } else {
            const equipData = globalThis.state.utils.getEquipment(equipId);
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
            tooltipDiv.className = LAYOUT_CONSTANTS.FONTS.SIZES.SMALL;
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
            equipDetailsCol.appendChild(wrap);
          }
        }

        ownedEquipCol.innerHTML = '';
        ownedEquipCol.appendChild(ownedEquipTitle);

        if (!currentSelectedEquipment) {
          ownedEquipTitleP.textContent = 'Owned Equipment';
          ownedEquipCol.innerHTML += '<div class="' + LAYOUT_CONSTANTS.FONTS.SIZES.BODY + '" style="text-align:center;">Select equipment to view owned</div>';
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
              } catch (e) {}
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
            ownedEquipCol.innerHTML += '<div class="' + LAYOUT_CONSTANTS.FONTS.SIZES.BODY + '" style="text-align:center;">You do not own this equipment.</div>';
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
              countSpan.className = LAYOUT_CONSTANTS.FONTS.SIZES.BODY;
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
                } catch (e) {}

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
                countLabel.className = count === 0 ? LAYOUT_CONSTANTS.FONTS.SIZES.TINY : LAYOUT_CONSTANTS.FONTS.SIZES.SMALL;
                countLabel.textContent = `x${count}`;

                if (count === 0) {
                  Object.assign(countLabel.style, { color: '#888', opacity: '0.7' });
                } else {
                  countLabel.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
        col2.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; text-align: center; padding: 20px;"><div style="font-size: 24px; margin-bottom: 16px;">📚</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Loading...</div><div style="font-size: 14px; color: #888;">Fetching profile data</div></div>`;
      }

      function showErrorState(col2, message) {
        col2.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.ERROR}; text-align: center; padding: 20px;"><div style="font-size: 48px; margin-bottom: 16px;">⚠️</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load Profile Data</div><div style="font-size: 14px; margin-bottom: 16px; color: #888;">${message}</div><div style="font-size: 12px; color: #666;">Please check your internet connection and try again.</div></div>`;
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
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; text-align: center; padding: 20px;">
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
            if (cols.length < 9) {
              console.warn(`[Cyclopedia] Skipping row ${rowIndex + 1}: insufficient columns (${cols.length})`);
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
            const dailySeashell = parseInt(cols[5], 10);
            const huntingTasks = parseInt(cols[6], 10);
            const raids = parseInt(cols[7], 10);
            const perfectCreatures = parseInt(cols[8], 10);
            const bisEquipment = parseInt(cols[9], 10);
            const bagOutfits = parseInt(cols[10], 10);
            
            if (isNaN(level) || !username) {
              console.warn(`[Cyclopedia] Skipping row ${rowIndex + 1}: invalid data (level: ${level}, username: ${username})`);
              return;
            }
            
            rankings.push({
              rank: rank,
              name: username,
              level: level,
              successfulRuns: successfulRuns,
              rankPoints: rankPoints,
              timeSum: timeSum,
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
// 9. API Call Optimization
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
          col2.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.ERROR}; text-align: center; padding: 20px;"><div style="font-size: 48px; margin-bottom: 16px;">⚠️</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load ${category} Data</div><div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not fetch game data</div><div style="font-size: 12px; color: #666;">Please check your internet connection and try again.</div></div>`;
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
          col2.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.ERROR}; text-align: center; padding: 20px;"><div style="font-size: 48px; margin-bottom: 16px;">⚠️</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load Leaderboards Data</div><div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not fetch game data</div><div style="font-size: 12px; color: #666;">Please check your internet connection and try again.</div></div>`;
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
            grid-template-columns: 43px 120px 53px 48px 48px 48px 48px 48px 48px 48px 48px 48px;
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
            { type: 'icon', src: '/assets/icons/grade.png', alt: 'Rank points', key: 'rankPoints', sortable: true },
            { type: 'icon', src: '/assets/icons/speed.png', alt: 'Time sum', key: 'timeSum', sortable: true },
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
              color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY};
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
                color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY};
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
            grid-template-columns: 43px 120px 53px 48px 48px 48px 48px 48px 48px 48px 48px 48px;
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
                cell.style.cursor = 'pointer';
                cell.style.textDecoration = 'underline';
                cell.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
                cell.addEventListener('click', () => {
                  window.open(`https://bestiaryarena.com/profile/${ranking.name}`, '_blank');
                });
                cell.addEventListener('mouseenter', () => {
                  cell.style.color = '#fff';
                });
                cell.addEventListener('mouseleave', () => {
                  cell.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
                });
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
                  color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY};
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
            color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY};
          `;

          const tooltip = document.createElement('div');
          tooltip.style.cssText = `
            position: absolute;
            top: 100%;
            right: 0;
            width: 280px;
            background: rgba(35, 35, 35, 0.95);
            border: 2px solid ${LAYOUT_CONSTANTS.COLORS.PRIMARY};
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
            <div style="font-size: 16px; margin-bottom: 8px; color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY}; font-weight: bold;">📊 Data Source</div>
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
              infoIcon.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
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
              infoIcon.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
            }
          });

          document.addEventListener('click', (e) => {
            if (isTooltipPersistent && !infoContainer.contains(e.target)) {
              isTooltipPersistent = false;
              tooltip.style.opacity = '0';
              tooltip.style.visibility = 'hidden';
              infoIcon.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
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
          col2.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.ERROR}; text-align: center; padding: 20px;"><div style="font-size: 48px; margin-bottom: 16px;">⚠️</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load Rankings</div><div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not fetch rankings from wiki</div><div style="font-size: 12px; color: #666;">Please check your internet connection and try again.</div></div>`;
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
        header.style.cssText = `font-size: 18px; font-weight: bold; color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY}; margin-bottom: 20px; text-align: center; padding: 10px; background: rgba(255, 224, 102, 0.1); border-radius: 8px;`;
        header.textContent = isTemplate ? 'Search Results' : `Your ${category} Data`;
        containerDiv.appendChild(header);

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
            regionHeader.style.cssText = `font-size: 14px; font-weight: bold; color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY}; margin: 8px 0 4px 0; padding: 4px 6px; background: rgba(255, 224, 102, 0.15); border-radius: 4px; border-left: 3px solid ${LAYOUT_CONSTANTS.COLORS.PRIMARY};`;
            regionHeader.textContent = regionName;
            contentContainer.appendChild(regionHeader);

            regionRooms.forEach(({ roomCode, roomName }) => {
              const roomEntry = document.createElement('div');
              roomEntry.style.cssText = `margin-bottom: 12px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);`;

              const roomHeader = document.createElement('div');
              roomHeader.style.cssText = `display: flex; align-items: center; gap: 10px; margin-bottom: 8px;`;

              const thumbnail = createRoomThumbnail(roomCode, roomName, 32);

              const roomTitle = document.createElement('div');
              roomTitle.style.cssText = `font-weight: bold; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; font-size: 14px;`;
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
          searchInstruction.style.cssText = `text-align: center; padding: 20px; color: ${LAYOUT_CONSTANTS.COLORS.WARNING}; font-size: 14px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); margin-top: 16px;`;
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

            const thumbnail = createRoomThumbnail(roomCode, roomName, 32);

            const roomTitle = document.createElement('div');
            roomTitle.style.cssText = `font-weight: bold; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; font-size: 14px;`;
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
        
        col3.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; text-align: center; padding: 20px;"><div style="font-size: 24px; margin-bottom: 16px;">🔍</div><div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Search Results</div><div style="font-size: 14px; color: #888; margin-bottom: 16px;">Use the search box above to compare leaderboard data</div><div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 16px; margin-top: 16px; border: 1px solid rgba(255, 255, 255, 0.1);"><div style="font-size: 14px; font-weight: bold; color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY}; margin-bottom: 8px;">How to use:</div><div style="font-size: 12px; color: #ccc; text-align: left; line-height: 1.4;">• Enter a player name in the search box<br>• View their leaderboard data compared to yours</div></div></div>`;
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

        const playerInfoSection = document.createElement('div');
        playerInfoSection.style.cssText = `margin-bottom: 20px; padding: 16px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);`;

        const playerInfoHeader = document.createElement('div');
        playerInfoHeader.style.cssText = `display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 16px; font-weight: bold; color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY};`;
        playerInfoHeader.innerHTML = `<span>📄</span><span>Player information</span>`;
        playerInfoSection.appendChild(playerInfoHeader);

        const playerName = document.createElement('div');
        playerName.style.cssText = `display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 14px; color: #ccc;`;
        playerName.innerHTML = `<span style="color: #4CAF50;">🛡️</span><span style="color: #888;">[Player Name]</span>`;
        playerInfoSection.appendChild(playerName);

        const level = document.createElement('div');
        level.style.cssText = `margin-bottom: 8px; font-size: 14px; color: #ccc;`;
        level.innerHTML = `<span>Level</span><div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;"><div style="flex: 1; height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px;"><div style="width: 50%; height: 100%; background: #FFD700; border-radius: 4px;"></div></div><span style="color: #888;">[Level]</span></div>`;
        playerInfoSection.appendChild(level);

        const createdAt = document.createElement('div');
        createdAt.style.cssText = `
          margin-bottom: 8px;
          font-size: 14px;
          color: #ccc;
        `;
        createdAt.innerHTML = `
          <span>Created at</span>
          <div style="color: #888; margin-top: 2px;">[Date]</div>
        `;
        playerInfoSection.appendChild(createdAt);

        const status = document.createElement('div');
        status.style.cssText = `
          margin-bottom: 8px;
          font-size: 14px;
          color: #ccc;
        `;
        status.innerHTML = `
          <span>Status</span>
          <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
            <span style="color: #888;">[Status]</span>
            <span style="color: #FFD700;">🔥</span>
          </div>
        `;
        playerInfoSection.appendChild(status);

        const loyaltyPoints = document.createElement('div');
        loyaltyPoints.style.cssText = `
          font-size: 14px;
          color: #ccc;
        `;
        loyaltyPoints.innerHTML = `
          <span>Loyalty Points</span>
          <div style="color: #888; margin-top: 2px;">[Points]</div>
        `;
        playerInfoSection.appendChild(loyaltyPoints);

        profileContainer.appendChild(playerInfoSection);

        const playerStatsSection = document.createElement('div');
        playerStatsSection.style.cssText = `
          margin-bottom: 20px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        `;

        const playerStatsHeader = document.createElement('div');
        playerStatsHeader.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          font-size: 16px;
          font-weight: bold;
          color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY};
        `;
        playerStatsHeader.innerHTML = `
          <span>📊</span>
          <span>Player stats</span>
        `;
        playerStatsSection.appendChild(playerStatsHeader);

        const currentTotal = document.createElement('div');
        currentTotal.style.cssText = `
          margin-bottom: 12px;
        `;
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
          color: ${LAYOUT_CONSTANTS.COLORS.WARNING};
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
        
        return region.id ? region.id.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()) : 'Unknown Region';
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

        const organizedRooms = organizeRoomsByRegion(rooms, ROOM_NAMES);

        Object.entries(organizedRooms).forEach(([regionName, regionRooms]) => {
          const regionHeader = DOMUtils.createTitle(regionName, LAYOUT_CONSTANTS.FONTS.SIZES.SMALL);
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
            gap: 8px;
            margin-bottom: 4px;
            padding: 6px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            min-width: 0;
            max-width: 100%;
          `;

          // Column 1: Map Icon + Map Name (stacked vertically)
          const mapColumn = document.createElement('div');
          mapColumn.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            width: 80px;
            min-width: 80px; /* Prevent shrinking */
            max-width: 80px; /* Prevent expanding */
          `;

          // Map icon
          const mapIcon = document.createElement('div');
          mapIcon.style.cssText = `
            width: 32px;
            height: 32px;
            border-radius: 4px;
            overflow: hidden;
          `;
          const thumbnail = createRoomThumbnail(roomCode, roomName, 32);
          thumbnail.style.width = '100%';
          thumbnail.style.height = '100%';
          mapIcon.appendChild(thumbnail);

          const mapName = document.createElement('div');
          mapName.style.cssText = `
            font-size: 12px;
            font-weight: bold;
            color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY};
            text-align: center;
            width: 100%;
            word-wrap: break-word;
          `;
          mapName.textContent = roomName;

          mapColumn.appendChild(mapIcon);
          mapColumn.appendChild(mapName);

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
          const isSpeedrunTop = yourRoom.ticks && best?.[roomCode]?.ticks && yourRoom.ticks === best[roomCode].ticks;
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

          const yourTicks = yourRoom.ticks || 0;
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

          const rankRow = document.createElement('div');
          const isRankTop = yourRoom.rank && roomsHighscores?.rank?.[roomCode]?.rank && yourRoom.rank === roomsHighscores.rank[roomCode].rank;
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

          const yourRank = yourRoom.rank || 0;
          const topRank = roomsHighscores?.rank?.[roomCode]?.rank || 0;
          const topRankPlayer = roomsHighscores?.rank?.[roomCode]?.userName || 'Unknown';

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
            <span>${yourRank} points</span>
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
            <span>${topRank} points</span>
          `;

          rankRow.appendChild(yourRankData);
          rankRow.appendChild(topRankData);

          dataColumn.appendChild(speedrunRow);
          dataColumn.appendChild(rankRow);

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
          color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY};
          margin-bottom: 20px;
          text-align: center;
          padding: 10px;
          background: rgba(255, 224, 102, 0.1);
          border-radius: 8px;
        `;
        header.textContent = `${playerName}'s ${category} Data`;
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

          if (!searchedRoom) return; // Skip if searched player doesn't have this room

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
            color: ${LAYOUT_CONSTANTS.COLORS.TEXT};
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
              <div style="color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY}; font-weight: bold;">${playerName}:</div>
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
              <div style="font-size: 10px; color: #888;">by ${bestPlayer}</div>
            `;

            dataRow.appendChild(searchedData);
            dataRow.appendChild(yourData);
            dataRow.appendChild(bestData);
            roomEntry.appendChild(dataRow);

          } else if (category === 'Rank Points') {
            const searchedRank = searchedRoom.rank || 0;
            const yourRank = yourRoom?.rank || 0;
            const topRank = roomsHighscores?.rank?.[roomCode]?.rank || 0;
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
              <div style="color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY}; font-weight: bold;">${playerName}:</div>
              <div>${searchedRank} points</div>
            `;

            const yourData = document.createElement('div');
            yourData.innerHTML = `
              <div style="color: #8f8; font-weight: bold;">You:</div>
              <div>${yourRank} points</div>
            `;

            const topData = document.createElement('div');
            topData.innerHTML = `
              <div style="color: #ff8; font-weight: bold;">Top:</div>
              <div>${topRank} points</div>
              <div style="font-size: 10px; color: #888;">by ${topPlayer}</div>
            `;

            dataRow.appendChild(searchedData);
            dataRow.appendChild(yourData);
            dataRow.appendChild(topData);
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
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.ERROR}; text-align: center; padding: 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Data Error</div>
                <div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not load leaderboard data</div>
                <div style="font-size: 12px; color: #666;">Please try searching again.</div>
              </div>
            `;
          }
          return;
        }
        
        const searchedHighscores = searchedProfileData.highscores || [];
        
        const searchedHighscoresMap = {};
        const searchedRankPointsMap = {};
        
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

        // Organize rooms by region
        const organizedRooms = organizeRoomsByRegion(ROOM_NAMES, ROOM_NAMES);

        // Create room entries organized by region
        Object.entries(organizedRooms).forEach(([regionName, regionRooms]) => {
          // Create region header using the title system with sticky positioning
          const regionHeader = DOMUtils.createTitle(regionName, LAYOUT_CONSTANTS.FONTS.SIZES.SMALL);
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

            const hasSearchedScore = searchedScore && searchedScore.ticks;
            const hasSearchedRankScore = searchedRankPointsMap[roomCode];

            const roomEntry = document.createElement('div');
            roomEntry.style.cssText = `
              display: grid;
              grid-template-columns: 80px 1fr;
              gap: 8px;
              margin-bottom: 4px;
              padding: 6px;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 4px;
              border: 1px solid rgba(255, 255, 255, 0.1);
              min-width: 0;
              max-width: 100%;
            `;

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
          const thumbnail = createRoomThumbnail(roomCode, roomName, 32);
          thumbnail.style.width = '100%';
          thumbnail.style.height = '100%';
          mapIcon.appendChild(thumbnail);

          const mapName = document.createElement('div');
          mapName.style.cssText = `
            font-size: 12px;
            font-weight: bold;
            color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY};
            text-align: center;
            width: 100%;
            word-wrap: break-word;
          `;
          mapName.textContent = roomName;

          mapColumn.appendChild(mapIcon);
          mapColumn.appendChild(mapName);

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
            <span style="color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY}; font-weight: bold;">${playerName}:</span>
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
          const topRank = roomsHighscores?.rank?.[roomCode]?.rank || null;

          const rankRow = document.createElement('div');
          const isRankTop = searchedRank !== null && topRank !== null && searchedRank === topRank;
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
            <span style="color: ${LAYOUT_CONSTANTS.COLORS.PRIMARY}; font-weight: bold;">${playerName}:</span>
            <span>${searchedRank !== null && searchedRank >= 0 ? searchedRank + ' points' : '-'}</span>
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
            <span>${topRank !== null ? topRank + ' points' : '-'}</span>
          `;

          rankRow.appendChild(searchedRankData);
          rankRow.appendChild(topRankData);

          dataColumn.appendChild(speedrunRow);
          dataColumn.appendChild(rankRow);

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
            nameElement.style.color = LAYOUT_CONSTANTS.COLORS.ERROR;
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
              const profileUrl = `https://bestiaryarena.com/profile/${encodeURIComponent(playerName)}`;
              window.open(profileUrl, '_blank');
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
        setTimeout(() => {
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
              color: LAYOUT_CONSTANTS.COLORS.TEXT,
              fontFamily: LAYOUT_CONSTANTS.FONTS.PRIMARY,
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
              color: LAYOUT_CONSTANTS.COLORS.TEXT,
              fontFamily: LAYOUT_CONSTANTS.FONTS.PRIMARY,
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
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; text-align: center; padding: 20px;">
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
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.ERROR}; text-align: center; padding: 20px;">
                      <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                      <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Player doesn't exist</div>
                      <div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not find player: ${searchTerm}</div>
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
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.ERROR}; text-align: center; padding: 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                        <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Search Error</div>
                        <div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not search for: ${searchTerm}</div>
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
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.ERROR}; text-align: center; padding: 20px;">
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
      setTimeout(() => {
        // Only select divs that are actual character items (not titles or other elements)
        const items = charactersBox.querySelectorAll('div');
        const characterItems = Array.from(items).filter(item => {
          const text = item.textContent.trim();
          return text === 'Player Information' || text === 'Leaderboards' || text === 'Rankings';
        });
        
        characterItems.forEach(item => {
          
          if (item.textContent === 'Player Information') {
            item.classList.add('cyclopedia-selected');
            item.style.background = 'rgba(255,255,255,0.18)';
            item.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
          }
          
          // Add click handler for character items only
          item.addEventListener('click', async (event) => {
            event.stopPropagation(); // Prevent event bubbling
            
            // Remove selection from all character items
            characterItems.forEach(otherItem => {
              otherItem.classList.remove('cyclopedia-selected');
              otherItem.style.background = 'none';
              otherItem.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
            });
            
            // Add selection to clicked item
            item.classList.add('cyclopedia-selected');
            item.style.background = 'rgba(255,255,255,0.18)';
            item.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
            
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
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; text-align: center; padding: 20px;">
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
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; text-align: center; padding: 20px;">
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
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; text-align: center; padding: 20px;">
                          <div style="font-size: 24px; margin-bottom: 16px;">📊</div>
                          <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Loading Leaderboards...</div>
                          <div style="font-size: 14px; color: #888;">Preparing ${cyclopediaState.searchedUsername}'s data</div>
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
                          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.ERROR}; text-align: center; padding: 20px;">
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
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; text-align: center; padding: 20px;">
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
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.ERROR}; text-align: center; padding: 20px;">
                              <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                              <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Player doesn't exist</div>
                              <div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not find player: ${cyclopediaState.searchedUsername}</div>
                              <div style="font-size: 12px; color: #666;">Please check the spelling and try again.</div>
                            </div>
                          `;
                        }
                      }).catch(error => {
                        console.error('[Cyclopedia] Error fetching searched player data:', error);
                        col3.innerHTML = `
                          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.ERROR}; text-align: center; padding: 20px;">
                            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                            <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Search Error</div>
                            <div style="font-size: 14px; margin-bottom: 16px; color: #888;">Could not search for: ${cyclopediaState.searchedUsername}</div>
                            <div style="font-size: 12px; color: #666;">Please try again later.</div>
                          </div>
                        `;
                      });
                    }).catch(error => {
                      console.error('[Cyclopedia] Error loading leaderboard data:', error);
                      col3.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.ERROR}; text-align: center; padding: 20px;">
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
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; text-align: center; padding: 20px;">
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
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; text-align: center; padding: 20px;">
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
          'nickname-monster': () => ({ key: 'nicknameMonster', name: 'Nickname Creature' })
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
  
        }

        if (icon && !icon.startsWith('/assets/icons/') && !icon.startsWith('/assets/misc/') && !icon.startsWith('sprite://')) {
  
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
          <button class="focus-style-visible active:opacity-70">
            <div data-hoverable="true" data-highlighted="false" data-disabled="false" class="container-slot surface-darker data-[disabled='true']:dithered data-[highlighted='true']:unset-border-image data-[hoverable='true']:hover:unset-border-image" style="overflow: visible;">
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
          </button>
        `;
      };

      const renderStyledImgPortrait = (iconSrc, displayName, rarity, size = 28, count = 0, itemKey = '') => {
        const noRarityKeys = GAME_DATA.NO_RARITY_KEYS;
        if (noRarityKeys.includes(itemKey)) rarity = '';

        if (!iconSrc) {
          return `<div style="width: ${size}px; height: ${size}px; background: #333; border-radius: 4px; color: #666; font-size: 10px; display: flex; align-items: center; justify-content: center;">?</div>`;
        }

        return `
          <button class="focus-style-visible active:opacity-70" tabindex="-1" style="all: unset; display: block;">
            <div data-hoverable="true" data-highlighted="false" data-disabled="false" class="container-slot surface-darker" style="overflow: visible;">
              <div class="has-rarity relative grid h-full place-items-center" data-rarity="${rarity || ''}">
                <img src="${iconSrc}" class="pixelated" width="32" height="32" alt="${displayName || ''}">
              </div>
            </div>
          </button>
        `;
      };

      const renderItemVariants = (categoryName) => {
        const variants = INVENTORY_CONFIG.variants[categoryName] || [];
        const currencyKeys = GAME_DATA.CURRENCY_KEYS;
        
        if (variants.length === 0) {
          return `
            <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; font-weight: bold; text-align: center;">
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
            const nameColor = isNoRarity ? LAYOUT_CONSTANTS.COLORS.TEXT : (rarityColors[realRarity] || '#fff');
            const raritySpan = isNoRarity ? '' : `<span style="color: ${rarityColors[realRarity] || '#666'}; font-size: 11px;">${getRarityDisplayText(realRarity)}</span>`;

            const upgradeKeys = GAME_DATA.UPGRADE_KEYS;
            const formattedCount = currencyKeys.includes(itemKey)
              ? `<span style=\"color: #ffe066; font-weight: bold; cursor: help;\" title=\"${count.toLocaleString()}\">${FormatUtils.currency(count)}</span>`
              : upgradeKeys.includes(itemKey)
              ? `<span style=\"color: #888; font-style: italic;\">One-time purchase</span>`
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
              <h3 style="margin: 0; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; font-size: 18px; font-weight: bold;">
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
          const nameColor = isNoRarity ? LAYOUT_CONSTANTS.COLORS.TEXT : (rarityColors[realRarity] || '#fff');
          const raritySpan = isNoRarity ? '' : `<span style="color: ${rarityColors[realRarity] || '#666'}; font-size: 12px;">${getRarityDisplayText(realRarity)}</span>`;

          const currencyKeys = GAME_DATA.CURRENCY_KEYS;
          const upgradeKeys = GAME_DATA.UPGRADE_KEYS;
          const formattedCount = currencyKeys.includes(itemKey)
            ? FormatUtils.currency(count)
            : upgradeKeys.includes(itemKey)
            ? 'One-time purchase'
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
                    style="color: #ffe066; font-size: 16px; font-weight: bold; cursor: help;"
                    title="${upgradeKeys.includes(itemKey) ? (count > 0 ? 'Owned' : 'Not owned') : count.toLocaleString()}"
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
              <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.TEXT}; font-weight: bold; text-align: center;">
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
          errorBox.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
            rightCol.innerHTML = '<div class="' + LAYOUT_CONSTANTS.FONTS.SIZES.BODY + '" style="display:flex;justify-content:center;align-items:center;height:100%;width:100%;color:' + LAYOUT_CONSTANTS.COLORS.TEXT + ';font-weight:bold;text-align:center;">Select an item category to view variants.</div>';
          }
        } catch (error) {
          console.error('[Cyclopedia] Error updating right column:', error);
          rightCol.innerHTML = '<div class="' + LAYOUT_CONSTANTS.FONTS.SIZES.BODY + '" style="display:flex;justify-content:center;align-items:center;height:100%;width:100%;color:' + LAYOUT_CONSTANTS.COLORS.TEXT + ';font-weight:bold;text-align:center;">Error loading content.</div>';
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
            type: 'inventory',
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
          errorBox.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
        type: 'inventory',
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
        fontWeight: 'bold', color: LAYOUT_CONSTANTS.COLORS.TEXT,
        borderRight: '6px solid transparent',
        borderImage: `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`
      });
      col2.classList.add('text-whiteHighlight');

      const col3 = document.createElement('div');
      Object.assign(col3.style, {
        flex: '1 1 0', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start', fontSize: '16px',
        fontWeight: 'bold', color: LAYOUT_CONSTANTS.COLORS.TEXT
      });
      col3.classList.add('text-whiteHighlight');

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
      
      function updateRightCol() {
        try {
          // Clear both columns
          col2.innerHTML = '';
          col3.innerHTML = '';
          
          // Re-add titles
          col2.appendChild(col2Title);
          col3.appendChild(col3Title);
          
          if (selectedMap) {
            // Get map data from game state
            const roomData = globalThis.state?.utils?.ROOMS?.[selectedMap];
            const roomName = globalThis.state?.utils?.ROOM_NAME?.[selectedMap] || selectedMap;
            
            // Column 2: Two separate divs - Map Information and Creature Information
            
            // First div: Map Information
            const mapInfoDiv = document.createElement('div');
            mapInfoDiv.style.padding = '0 20px 20px 20px';
            mapInfoDiv.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
            mapInfoDiv.style.width = '100%';
            mapInfoDiv.style.boxSizing = 'border-box';
            mapInfoDiv.style.marginBottom = '0';
            
            // Row1: Map Icon and Map Name
            // Add room thumbnail
            
            // Add room thumbnail
            const thumbnail = document.createElement('img');
            thumbnail.alt = roomName;
            thumbnail.className = 'pixelated';
            thumbnail.style.width = '192px';
            thumbnail.style.height = '192px';
            thumbnail.style.objectFit = 'cover';
            thumbnail.style.border = '2px solid #666';
            thumbnail.style.borderRadius = '4px';
            thumbnail.style.margin = '0 auto';
            thumbnail.style.display = 'block';
            thumbnail.src = `/assets/room-thumbnails/${selectedMap}.png`;
            
            mapInfoDiv.appendChild(thumbnail);
            
            // Add map name with click interaction
            const title = document.createElement('h3');
            title.textContent = roomName;
            title.style.margin = '10px 0 0 0';
            title.style.fontSize = '18px';
            title.style.fontWeight = 'bold';
            title.style.textAlign = 'center';
            title.style.cursor = MAP_INTERACTION_CONFIG.cursor;
            title.title = MAP_INTERACTION_CONFIG.tooltip;
            title.style.textDecoration = MAP_INTERACTION_CONFIG.textDecoration;
            title.style.padding = MAP_INTERACTION_CONFIG.padding;
            title.style.borderRadius = MAP_INTERACTION_CONFIG.borderRadius;
            title.style.boxSizing = MAP_INTERACTION_CONFIG.boxSizing;
            
            // Add the exact same interaction handlers as Bestiary Tab
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
              globalThis.state.board.send({
                type: 'selectRoomById',
                roomId: selectedMap
              });
              // Try to close the modal if present
              const closeBtn = Array.from(document.querySelectorAll('button.pixel-font-14')).find(
                btn => btn.textContent.trim() === 'Close'
              );
              if (closeBtn) {
                closeBtn.click();
              }
            });
            mapInfoDiv.appendChild(title);
            
            // Second div: Creature Information
            const creatureInfoDiv = document.createElement('div');
            creatureInfoDiv.style.padding = '0';
            creatureInfoDiv.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
            creatureInfoDiv.style.width = '100%';
            creatureInfoDiv.style.boxSizing = 'border-box';
            
            // Add "Creature Information" title using Bestiary Tab title system
            const creatureInfoTitle = document.createElement('h2');
            creatureInfoTitle.className = 'widget-top widget-top-text ' + LAYOUT_CONSTANTS.FONTS.SIZES.TITLE;
            creatureInfoTitle.style.margin = '0';
            creatureInfoTitle.style.padding = '2px 0';
            creatureInfoTitle.style.textAlign = 'center';
            creatureInfoTitle.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
            creatureInfoTitleP.className = LAYOUT_CONSTANTS.FONTS.SIZES.TITLE;
            creatureInfoTitleP.style.margin = '0';
            creatureInfoTitleP.style.padding = '0';
            creatureInfoTitleP.style.textAlign = 'center';
            creatureInfoTitleP.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
            creatureInfoTitle.appendChild(creatureInfoTitleP);
            creatureInfoDiv.appendChild(creatureInfoTitle);
            
            // Simple content container below the title
            const contentContainer = document.createElement('div');
            contentContainer.style.overflowY = 'hidden'; // Start with no scrollbar
            contentContainer.style.maxHeight = '175px';
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
              const creaturesContainer = document.createElement('div');
              creaturesContainer.style.marginTop = '15px';
              creaturesContainer.style.textAlign = 'center';

              

              
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
              
              if (roomActors && roomActors.length > 0) {
                const creaturesGrid = document.createElement('div');
                creaturesGrid.style.display = 'grid';
                creaturesGrid.style.gridTemplateColumns = '1fr';
                creaturesGrid.style.gap = '8px';
                creaturesGrid.style.justifyItems = 'center';
                creaturesGrid.style.maxWidth = '100%';
                
                roomActors.forEach((actor, index) => {
                  if (actor && actor.id) {
                    try {
                      console.log('[Cyclopedia] Processing actor:', actor);
                      
                      // Create creature icon similar to Bestiary Tab
                      let monsterSprite;
                      if (actor.metadata && actor.metadata.lookType === 'item') {
                        monsterSprite = api.ui.components.createItemPortrait({
                          itemId: actor.metadata.spriteId,
                          size: 'small'
                        });
                        [monsterSprite.style.width, monsterSprite.style.height] = ['50px', '50px'];
                        const portrait = monsterSprite.querySelector('.equipment-portrait');
                        if (portrait) {
                          portrait.style.width = '50px';
                          portrait.style.height = '50px';
                        }
                      } else {
                        monsterSprite = api.ui.components.createFullMonster({
                          monsterId: actor.id,
                          tier: 1,
                          starTier: 1,
                          level: 1,
                          size: 'small'
                        });
                        [monsterSprite.style.width, monsterSprite.style.height] = ['50px', '50px'];
                        // Remove level badge and star tier
                        const levelBadge = monsterSprite.querySelector('span.pixel-font-16');
                        if (levelBadge) levelBadge.remove();
                        const starTierIcon = monsterSprite.querySelector('img[alt="star tier"]');
                        if (starTierIcon) starTierIcon.remove();
                      }
                      
                      creaturesGrid.appendChild(monsterSprite);
                    } catch (error) {
                      console.error('[Cyclopedia] Error creating creature icon for actor:', actor, error);
                    }
                  } else {
                    console.log('[Cyclopedia] Skipping invalid actor:', actor);
                  }
                });
                
                creaturesContainer.appendChild(creaturesGrid);
              } else {
                const noCreaturesMsg = document.createElement('p');
                noCreaturesMsg.textContent = `No creatures found on this map. (Room ID: ${selectedMap})`;
                noCreaturesMsg.style.color = '#888';
                noCreaturesMsg.style.fontStyle = 'italic';
                creaturesContainer.appendChild(noCreaturesMsg);
                
                // Add debug info
                const debugInfo = document.createElement('div');
                debugInfo.style.marginTop = '10px';
                debugInfo.style.fontSize = '12px';
                debugInfo.style.color = '#666';
                debugInfo.innerHTML = `
                  <strong>Debug Info:</strong><br>
                  Available Rooms: ${Object.keys(globalThis.state?.utils?.ROOMS || {}).length}<br>
                  Available Regions: ${globalThis.state?.utils?.REGIONS?.length || 0}<br>
                  Room Data: ${roomData ? 'Found' : 'Not found'}<br>
                  Actors: ${roomActors ? roomActors.length : 'None'}
                `;
                creaturesContainer.appendChild(debugInfo);
              }
              
              contentContainer.appendChild(creaturesContainer);
            }
            
            // Add both divs to col2
            col2.appendChild(mapInfoDiv);
            col2.appendChild(creatureInfoDiv);
            
            // Add the content container to the creature info div
            creatureInfoDiv.appendChild(contentContainer);
            
            // Check if content overflows and conditionally show scrollbar
            setTimeout(() => {
                const hasOverflow = contentContainer.scrollHeight > 175;
                if (hasOverflow) {
                    contentContainer.style.overflowY = 'auto';
                }
                // If no overflow, keep overflowY: 'hidden' (no scrollbar)
            }, 0);
            
            // Column 3: Statistics
            const statsContainer = document.createElement('div');
            statsContainer.style.padding = '20px';
            statsContainer.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
            statsContainer.style.width = '100%';
            statsContainer.style.boxSizing = 'border-box';
            
            const statsTitle = document.createElement('h3');
            statsTitle.textContent = 'Statistics';
            statsTitle.style.margin = '0 0 15px 0';
            statsTitle.style.fontSize = '18px';
            statsTitle.style.fontWeight = 'bold';
            statsTitle.style.textAlign = 'center';
            statsContainer.appendChild(statsTitle);
            
            if (roomData) {
              // Player progress (if available)
              if (globalThis.state?.player?.getSnapshot?.()?.context?.rooms?.[selectedMap]) {
                const playerRoom = globalThis.state.player.getSnapshot().context.rooms[selectedMap];
                const progressDiv = document.createElement('div');
                progressDiv.style.marginTop = '15px';
                progressDiv.style.padding = '10px';
                progressDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                progressDiv.style.borderRadius = '5px';
                progressDiv.style.textAlign = 'center';
                progressDiv.innerHTML = `
                  <strong>Your Progress:</strong><br>
                  Rank: ${playerRoom.rank}<br>
                  Completions: ${playerRoom.count}<br>
                  Best Time: ${playerRoom.ticks} ticks
                `;
                statsContainer.appendChild(progressDiv);
              } else {
                const noProgressDiv = document.createElement('div');
                noProgressDiv.style.textAlign = 'center';
                noProgressDiv.style.color = '#888';
                noProgressDiv.style.padding = '20px';
                noProgressDiv.textContent = 'No progress data available for this map.';
                statsContainer.appendChild(noProgressDiv);
              }
            } else {
              const noStatsDiv = document.createElement('div');
              noStatsDiv.style.textAlign = 'center';
              noStatsDiv.style.color = '#888';
              noStatsDiv.style.padding = '20px';
              noStatsDiv.textContent = 'Statistics not available for this map.';
              statsContainer.appendChild(noStatsDiv);
            }
            
            col3.appendChild(statsContainer);
          } else {
            // No map selected - show placeholder messages
            const col2Msg = document.createElement('div');
            col2Msg.style.display = 'flex';
            col2Msg.style.justifyContent = 'center';
            col2Msg.style.alignItems = 'center';
            col2Msg.style.height = '100%';
            col2Msg.style.width = '100%';
            col2Msg.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
            col2Msg.style.fontWeight = 'bold';
            col2Msg.style.textAlign = 'center';
            col2Msg.textContent = 'Select a map to view information.';
            col2.appendChild(col2Msg);
            
            const col3Msg = document.createElement('div');
            col3Msg.style.display = 'flex';
            col3Msg.style.justifyContent = 'center';
            col3Msg.style.alignItems = 'center';
            col3Msg.style.height = '100%';
            col3Msg.style.width = '100%';
            col3Msg.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
            col3Msg.style.fontWeight = 'bold';
            col3Msg.style.textAlign = 'center';
            col3Msg.textContent = 'Select a map to view statistics.';
            col3.appendChild(col3Msg);
          }
        } catch (error) {
          console.error('[Cyclopedia] Error updating right columns:', error);
          col2.innerHTML = '<div style="padding: 20px; color: #ccc; text-align: center;">Error loading map information.</div>';
          col3.innerHTML = '<div style="padding: 20px; color: #ccc; text-align: center;">Error loading statistics.</div>';
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
        width: CYCLOPEDIA_MODAL_WIDTH,
        height: CYCLOPEDIA_MODAL_HEIGHT,
        content: content,
        buttons: [],
        onClose: () => {
  

          cleanupCyclopediaModal();
        }
      });
      
      // Fallback cleanup for when onClose doesn't work
      
      setTimeout(() => {
        const modalElement = document.querySelector('div[role="dialog"][data-state="open"]');
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
      height: '150px',
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
            width: '16px',
            height: '16px',
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

function renderCreatureTemplate(name) {
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
      const flexRows = document.querySelectorAll('div[role="dialog"] .modal-content > div');
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
    waitingDiv.className = LAYOUT_CONSTANTS.FONTS.SIZES.BODY;
    waitingDiv.style.textAlign = 'center';
    waitingDiv.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
  col1.style.overflowY = 'auto';
  const col1Title = document.createElement('h2');
  col1Title.className = 'widget-top widget-top-text ' + LAYOUT_CONSTANTS.FONTS.SIZES.TITLE;
  col1Title.style.margin = '0';
  col1Title.style.padding = '2px 0';
  col1Title.style.textAlign = 'center';
  col1Title.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
  col1TitleP.className = LAYOUT_CONSTANTS.FONTS.SIZES.TITLE;
  col1TitleP.style.margin = '0';
  col1TitleP.style.padding = '0';
  col1TitleP.style.textAlign = 'center';
  col1TitleP.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  col1Title.appendChild(col1TitleP);
  const col1Picture = document.createElement('div');
  col1Picture.style.textAlign = 'center';
  col1Picture.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  col1Picture.className = LAYOUT_CONSTANTS.FONTS.SIZES.SMALL;
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
      }
      let monsterSprite;
      if (monster && monster.metadata && monster.metadata.lookType === 'item') {
        monsterSprite = api.ui.components.createItemPortrait({
          itemId: monster.metadata.spriteId,
          size: 'large'
        });
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
      col1Picture.appendChild(monsterSprite);
      const allDivs = monsterSprite.querySelectorAll('div');
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
  col1TopArea.style.height = '35%';
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
  statsDiv.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  statsDiv.style.padding = '0';
  statsDiv.style.margin = '0';
  statsDiv.style.alignSelf = 'unset';
  if (monsterId) {
    queueMonsterDataLoad(monsterId, (monsterData) => {
      const actualStatsDiv = renderMonsterStats(monsterData);
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
  abilityTitle.className = 'widget-top widget-top-text ' + LAYOUT_CONSTANTS.FONTS.SIZES.TITLE;
  abilityTitle.style.margin = '0';
  abilityTitle.style.padding = '2px 0';
  abilityTitle.style.textAlign = 'center';
  abilityTitle.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
  abilityTitleP.className = LAYOUT_CONSTANTS.FONTS.SIZES.TITLE;
  abilityTitleP.style.margin = '0';
  abilityTitleP.style.padding = '0';
  abilityTitleP.style.textAlign = 'center';
  abilityTitleP.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  abilityTitle.appendChild(abilityTitleP);
  abilitySection.appendChild(abilityTitle);

  const abilityList = document.createElement('ul');
  abilityList.style.listStyle = 'none';
  abilityList.style.padding = '0';
  abilityList.style.margin = '0';
  abilityList.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  abilityList.className = LAYOUT_CONSTANTS.FONTS.SIZES.SMALL;
  
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
      rootElement.classList.add(LAYOUT_CONSTANTS.FONTS.SIZES.SMALL);
      rootElement.style.width = '100%';
      rootElement.style.height = '100%';
      rootElement.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
    abilityContainer.style.color = LAYOUT_CONSTANTS.COLORS.ERROR;
  }
  
  abilityList.appendChild(abilityContainer);
  abilitySection.appendChild(abilityList);
  
  if (tooltipComponent) {
    abilitySection._tooltipComponent = tooltipComponent;
  }

  col1FlexRows.appendChild(col1TopArea);
  col1FlexRows.appendChild(abilitySection);
  col1.appendChild(col1Title);
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
  dropsSection.className = LAYOUT_CONSTANTS.FONTS.SIZES.SMALL;

  const dropsTitle = document.createElement('h2');
  dropsTitle.className = 'widget-top widget-top-text ' + LAYOUT_CONSTANTS.FONTS.SIZES.TITLE;
  dropsTitle.style.margin = '0';
  dropsTitle.style.padding = '2px 0';
  dropsTitle.style.textAlign = 'center';
  dropsTitle.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
  dropsTitleP.className = LAYOUT_CONSTANTS.FONTS.SIZES.TITLE;
  dropsTitleP.style.margin = '0';
  dropsTitleP.style.padding = '0';
  dropsTitleP.style.textAlign = 'center';
  dropsTitleP.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  dropsTitle.appendChild(dropsTitleP);
  dropsSection.appendChild(dropsTitle);
  const dropsList = document.createElement('div');
  dropsList.style.padding = '8px 10px 8px 10px';
  dropsList.style.display = 'flex';
  dropsList.style.flexDirection = 'column';
  dropsList.style.gap = '6px';
  dropsList.style.marginTop = '4px';
  dropsList.style.marginBottom = '4px';
  dropsList.className = LAYOUT_CONSTANTS.FONTS.SIZES.BODY;
  dropsList.style.lineHeight = '1';
  dropsList.style.letterSpacing = '.0625rem';
  dropsList.style.wordSpacing = '-.1875rem';
  dropsList.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
        regionDiv.className = LAYOUT_CONSTANTS.FONTS.SIZES.BODY;
        regionDiv.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
          roomDiv.className = LAYOUT_CONSTANTS.FONTS.SIZES.SMALL;
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
                globalThis.state.board.send({
                  type: 'selectRoomById',
                  roomId: roomCode
                });
                const closeBtn = Array.from(document.querySelectorAll('button.pixel-font-14')).find(
                  btn => btn.textContent.trim() === 'Close'
                );
                if (closeBtn) {
                  closeBtn.click();
                }
              }
            });
          }
          dropsList.appendChild(roomDiv);
          positions.forEach((pos) => {
            const detail = document.createElement('div');
            detail.textContent = `Lv: ${pos.level}`;
            detail.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
            detail.className = LAYOUT_CONSTANTS.FONTS.SIZES.TINY;
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
      noLocationItem.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
      noLocationItem.className = LAYOUT_CONSTANTS.FONTS.SIZES.BODY;
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
    noLocationItem.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
  col3Title.className = 'widget-top widget-top-text ' + LAYOUT_CONSTANTS.FONTS.SIZES.TITLE;
  col3Title.style.margin = '0';
  col3Title.style.padding = '2px 0';
  col3Title.style.textAlign = 'center';
  col3Title.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
  col3TitleP.className = LAYOUT_CONSTANTS.FONTS.SIZES.TITLE;
  col3TitleP.style.margin = '0';
  col3TitleP.style.padding = '0';
  col3TitleP.style.textAlign = 'center';
  col3TitleP.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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

      const levelBadge = portrait.querySelector('span.pixel-font-16');
      if (levelBadge) levelBadge.remove();
      const statsGrid = document.createElement('div');
      statsGrid.style.display = 'grid';
      statsGrid.style.gridTemplateColumns = 'auto auto';
      statsGrid.style.gridTemplateRows = 'repeat(3, auto)';
      statsGrid.style.gap = '2px 12px';
      statsGrid.style.alignSelf = 'center';
      statsGrid.className = LAYOUT_CONSTANTS.FONTS.SIZES.SMALL;
      statsGrid.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
          label.className = LAYOUT_CONSTANTS.FONTS.SIZES.TINY;
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
        num.className = LAYOUT_CONSTANTS.FONTS.SIZES.TINY;
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
      col3Content.appendChild(row);
      const statSum = (monster.hp || 0) + (monster.ad || 0) + (monster.ap || 0) + (monster.armor || 0) + (monster.magicResist || 0);
      let rarity = 1;
      if (statSum >= 80) rarity = 5;
      else if (statSum >= 70) rarity = 4;
      else if (statSum >= 60) rarity = 3;
      else if (statSum >= 50) rarity = 2;

      setTimeout(() => {
        const borderElem = portrait.querySelector('.has-rarity');
        if (borderElem) {
          borderElem.setAttribute('data-rarity', rarity);
        }
      }, 0);
    });
  } else {
    if (isUnobtainable) {
      col3Content.className = LAYOUT_CONSTANTS.FONTS.SIZES.BODY;
      col3Content.textContent = 'This creature is unobtainable.';
    } else {
      col3Content.className = LAYOUT_CONSTANTS.FONTS.SIZES.BODY;
      col3Content.textContent = 'You do not own this creature.';
    }
  }
  col3.appendChild(col3Title);
  col3.appendChild(col3Content);
  container.appendChild(col1);
  container.appendChild(col2);
  container.appendChild(col3);

  col3Content.id = 'cyclopedia-owned-scroll';

  if (!document.getElementById('cyclopedia-owned-scrollbar-style')) {
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
  perfectCreatures: 68,
  bisEquipments: 102,
  exploredMaps: 64,
  bagOutfits: 192,
  raids: 13
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
  createdAt: { label: 'Created at', value: d => FormatUtils.date(d.createdAt) },
  level: { label: 'Level', value: d => (typeof d.exp === 'number' ? Math.floor(d.exp / 400) + 1 : '?') },
  xp: { label: 'XP', value: d => d.exp },
  name: { label: 'Player', value: d => d.name },
  premium: { label: 'Status', value: d => d.premium ? 'Premium' : 'Free' },
  loyaltyPoints: { label: 'Loyalty Points', value: d => d.loyaltyPoints }
};

if (!document.getElementById('cyclopedia-maxed-style')) {
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

  function addRow({ label, icon, value, highlight, colspan, title, extraIcon, tooltip, valueClass }) {
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
        img.src = icon;
        img.className = 'pixelated mr-1 inline-block -translate-y-0.5';
        img.width = 11;
        img.height = 11;
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
  loyaltyValue.textContent = loyaltyPoints;
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
      globalThis.state.board.send({
        type: 'selectRoomById',
        roomId: boosted.roomId
      });
      const closeBtn = Array.from(document.querySelectorAll('button.pixel-font-14')).find(
        btn => btn.textContent.trim() === 'Close'
      );
      if (closeBtn) {
        closeBtn.click();
      }
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
  
  setTimeout(() => {
    const gradientElements = boostedDiv.querySelectorAll('.absolute[style*="radial-gradient"]');
    gradientElements.forEach(el => {
      el.style.background = 'none';
    });
  }, 0);
  
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

  const tabClickHandler = function (e) {
    if (e.target && e.target.classList.contains('cyclopedia-tab-btn')) {
    }
  };
  document.addEventListener('click', tabClickHandler);
  cyclopediaEventHandlers.push({ type: 'click', handler: tabClickHandler });

  const searchClickHandler = function (e) {
    if (e.target && e.target.textContent === 'Search' && e.target.parentElement.classList.contains('cyclopedia-search-bar')) {
    }
  };
  document.addEventListener('click', searchClickHandler);
  cyclopediaEventHandlers.push({ type: 'click', handler: searchClickHandler });

  const listItemClickHandler = function (e) {
    if (e.target && e.target.classList.contains('cyclopedia-list-item')) {
    }
  };
  document.addEventListener('click', listItemClickHandler);
  cyclopediaEventHandlers.push({ type: 'click', handler: listItemClickHandler });
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

    } catch (error) {}
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

    
    // Don't stop the context menu observer - it should always be active
    // stopContextMenuObserver(); // REMOVED - context menu observer should persist
    
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
    const headerUl = document.querySelector('header ul.pixel-font-16.flex.items-center');
    if (headerUl) {
      const btnLi = headerUl.querySelector('li:has(.cyclopedia-header-btn)');
      if (btnLi) btnLi.remove();
    }
    
    // Clean up all event handlers
    EventHandlerManager.cleanup();
    // Simple memory cleanup
    MemoryUtils.clearLargeObjects();
    
    // Use centralized cleanup
    cyclopediaState.cleanup();
    
      // Ensure context menu observer is always running
  if (!cyclopediaState.observer || !window.cyclopediaGlobalObserver) {
    startContextMenuObserver();
  }
  } catch (error) {
    console.error('[Cyclopedia] Error during cleanup:', error);
  }
}

// =======================
// 10. Exports & Lifecycle Management
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
      cleanupCyclopedia();
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