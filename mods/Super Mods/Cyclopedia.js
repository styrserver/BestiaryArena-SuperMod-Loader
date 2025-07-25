// =======================
// 0. Version & Metadata
// =======================
/**
 * Cyclopedia Mod for Bestiary Arena
 * @version 1.0.2
 * @description Comprehensive game data viewer and player profile manager
 */
'use strict';

// =======================
// 1. Constants & Globals
// =======================
const START_PAGE_CONFIG = {
  API_TIMEOUT: 10000,
  COLUMN_WIDTHS: {
    LEFT: 300,
    MIDDLE: 300,
    RIGHT: 300
  },
  API_BASE_URL: 'https://bestiaryarena.com/api/trpc/serverSide.profilePageData',
  FRAME_IMAGE_URL: 'https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png'
};

let globalTimer = null;
let cachedProfileData = null;
const timerCleanup = new WeakMap();

var inventoryTooltips = (typeof window !== 'undefined' && window.inventoryTooltips)
  || {};

if (!(inventoryTooltips && typeof inventoryTooltips === 'object')) {
  console.warn('[Cyclopedia] inventory-tooltips.js NOT loaded or is not an object!');
}

const CYCLOPEDIA_MODAL_WIDTH = 900;
const CYCLOPEDIA_MODAL_HEIGHT = 600;

const LAYOUT_CONSTANTS = {
  COLUMN_WIDTH: '252px',
  LEFT_COLUMN_WIDTH: '180px',
  MODAL_WIDTH: 900,
  MODAL_HEIGHT: 600,
  CHROME_HEIGHT: 70,
  COLORS: {
    PRIMARY: '#ffe066',
    SECONDARY: '#e6d7b0',
    BACKGROUND: '#232323',
    TEXT: '#fff',
    ERROR: '#ff6b6b',
    WARNING: '#888'
  },
  FONTS: {
    PRIMARY: 'pixel-font',
    SMALL: 'pixel-font-14',
    MEDIUM: 'pixel-font-16',
    LARGE: 'pixel-font-16',
    SIZES: {
      TITLE: 'pixel-font-16',
      BODY: 'pixel-font-16',
      SMALL: 'pixel-font-14',
      TINY: 'pixel-font-14',
    }
  }
};

// =======================
// 2. Centralized Data Configuration
// =======================

const GAME_DATA = {
  MONSTER_STATS_CONFIG: [
    { key: 'hp', label: 'Hitpoints', icon: '/assets/icons/heal.png', max: 700, barColor: 'rgb(96, 192, 96)' },
    { key: 'ad', label: 'Attack Damage', icon: '/assets/icons/attackdamage.png', max: 80, barColor: 'rgb(255, 128, 96)' },
    { key: 'ap', label: 'Ability Power', icon: '/assets/icons/abilitypower.png', max: 60, barColor: 'rgb(128, 128, 255)' },
    { key: 'armor', label: 'Armor', icon: '/assets/icons/armor.png', max: 60, barColor: 'rgb(224, 224, 128)' },
    { key: 'magicResist', label: 'Magic Resist', icon: '/assets/icons/magicresist.png', max: 60, barColor: 'rgb(192, 128, 255)' }
  ],

  UNOBTAINABLE_CREATURES: [
    'Earth Crystal',
    'Energy Crystal',
    'Lavahole',
    'Magma Crystal',
    'Old Giant Spider',
    'Orc',
    'Sweaty Cyclops'
  ],

  ALL_CREATURES: [
    'Amazon', 'Banshee', 'Bear', 'Black Knight', 'Bog Raider', 'Bug', 'Corym Charlatan', 'Corym Skirmisher', 'Corym Vanguard', 'Cyclops', 'Deer', 'Demon Skeleton', 'Dragon', 'Dragon Lord',
    'Druid', 'Dwarf', 'Dwarf Geomancer', 'Dwarf Guard', 'Dwarf Soldier', 'Elf', 'Elf Arcanist', 'Elf Scout',
    'Fire Devil', 'Fire Elemental', 'Firestarter', 'Frost Troll', 'Ghost', 'Ghoul', 'Giant Spider', 'Goblin', 'Goblin Assassin',
    'Goblin Scavenger', 'Knight', 'Minotaur', 'Minotaur Archer', 'Minotaur Guard', 'Minotaur Mage', 'Monk',
    'Mummy', 'Nightstalker', 'Orc Berserker', 'Orc Leader', 'Orc Rider', 'Orc Shaman', 'Orc Spearman',
    'Orc Warlord', 'Poison Spider', 'Polar Bear', 'Rat', 'Rorc', 'Rotworm', 'Scorpion', 'Sheep', 'Skeleton',
    'Slime', 'Slug', 'Snake', 'Spider', 'Stalker', 'Swamp Troll', 'Tortoise', 'Troll', 'Valkyrie', 'Warlock', 'Wasp', 'Water Elemental',
    'Witch', 'Winter Wolf', 'Wolf', 'Wyvern'
  ],

  ALL_EQUIPMENT: [
    'Amulet of Loss', 'Bear Skin', 'Bloody Edge', 'Blue Robe', 'Bonelord Helmet', 'Boots of Haste', 'Chain Bolter', 'Cranial Basher',
    'Dwarven Helmet', 'Dwarven Legs', 'Ectoplasmic Shield', 'Epee', 'Fire Axe', 'Giant Sword', 'Glacial Rod',
    'Glass of Goo', 'Ice Rapier', 'Jester Hat', 'Medusa Shield', 'Ratana', 'Royal Scale Robe', 'Rubber Cap',
    'Skull Helmet', 'Skullcracker Armor', 'Springsprout Rod', 'Steel Boots', 'Stealth Ring', 'Vampire Shield', 'Wand of Decay',
    'White Skull'
  ],

  NO_RARITY_KEYS: ['nicknameChange', 'nicknameMonster', 'hunterOutfitBag', 'outfitBag1'],

  CURRENCY_KEYS: ['gold', 'dust', 'beastCoins', 'huntingMarks'],

  UPGRADE_KEYS: ['dailyBoostedMap', 'daycare', 'hygenie', 'monsterCauldron', 'monsterSqueezer', 'mountainFortress', 'premium', 'forge', 'yasirTradingContract'],

  RARITY_COLORS: {
    '1': '#9d9d9d',
    '2': '#1eff00',
    '3': '#0070dd',
    '4': '#a335ee',
    '5': '#ff8000'
  },

  EXP_TABLE: [
    [5, 11250], [6, 17000], [7, 24000], [8, 32250], [9, 41750], [10, 52250],
    [11, 64250], [12, 77750], [13, 92250], [14, 108500], [15, 126250], [16, 145750],
    [17, 167000], [18, 190000], [19, 215250], [20, 242750], [21, 272750], [22, 305750],
    [23, 342000], [24, 382000], [25, 426250], [26, 475250], [27, 530000], [28, 591500],
    [29, 660500], [30, 738500], [31, 827000], [32, 928000], [33, 1043500], [34, 1176000],
    [35, 1329000], [36, 1505750], [37, 1710500], [38, 1948750], [39, 2226500], [40, 2550500],
    [41, 2929500], [42, 3373500], [43, 3894000], [44, 4504750], [45, 5222500], [46, 6066000],
    [47, 7058000], [48, 8225000], [49, 9598500], [50, 11214750]
  ]
};

// =======================
// 3. Global State & Configuration
// =======================

if (typeof window.cyclopediaGlobalObserver === 'undefined') {
  window.cyclopediaGlobalObserver = null;
}

const cyclopediaState = {
  observer: null,
  modalOpen: false,
  currentModal: null,
  profileData: null,
  lastFetch: 0,
  fetchInProgress: false,
  monsterNameMap: null,
  monsterNameMapBuilt: false,
  monsterLocationCache: new Map(),
  searchDebounceTimer: null,
  lazyLoadQueue: [],
  isProcessingQueue: false
};

// =======================
// 4. Utility Functions
// =======================

function safeRemoveChild(parent, child) {
  try {
    if (!parent || !child) {
      return false;
    }
    
    if (!parent.contains(child)) {
      return false;
    }
    
    if (child.parentNode !== parent) {
      return false;
    }
    
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
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.element;
    }
    
    const element = context.querySelector(selector);
    this.cache.set(key, { element, timestamp: Date.now() });
    return element;
  },

  getAll: function(selector, context = document) {
    const key = `all_${selector}_${context === document ? 'doc' : context.id || 'ctx'}`;
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.elements;
    }
    
    const elements = context.querySelectorAll(selector);
    this.cache.set(key, { elements, timestamp: Date.now() });
    return elements;
  },

  clear: function() {
    this.cache.clear();
  },

  clearSelector: function(selector) {
    for (const key of this.cache.keys()) {
      if (key.includes(selector)) {
        this.cache.delete(key);
      }
    }
  }
};

const MemoizationUtils = {
  memoize: function(fn, keyFn = (...args) => JSON.stringify(args)) {
    const cache = new Map();
    return function(...args) {
      const key = keyFn(...args);
      if (cache.has(key)) {
        return cache.get(key);
      }
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
        if (now - timestamp < ttl) {
          return result;
        }
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

  number: function(n) {
    return n !== undefined ? n.toLocaleString() : '-';
  },

  date: function(ts) {
    if (!ts) return '-';
    try {
      const date = new Date(Number(ts));
      return date.toISOString().split('T')[0];
    } catch (e) {
      return '-';
    }
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

function getGoldFromUI() {
  try {
    const goldBtn = Array.from(DOMCache.getAll('button'))
      .find(btn => {
        const div = btn.querySelector('.frame-pressed-1[title="Gold"]');
        const img = btn.querySelector('img[alt="Player gold"]');
        return div || img;
      });
    if (!goldBtn) return null;
    const span = goldBtn.querySelector('span');
    if (!span) return null;
    const value = span.textContent.replace(/,/g, '');
    const parsedValue = parseInt(value, 10);
    return isNaN(parsedValue) ? null : parsedValue;
  } catch (error) {
    console.warn('[Cyclopedia] Error getting gold from UI:', error);
    return null;
  }
}

function getBeastCoinsFromUI() {
  try {
    const beastCoinsBtn = Array.from(DOMCache.getAll('button'))
      .find(btn => {
        const div = btn.querySelector('.frame-pressed-1[title="Beast Coins"]');
        const img = btn.querySelector('img[alt="Player Beast Coins"]');
        return div || img;
      });
    if (!beastCoinsBtn) return null;
    const span = beastCoinsBtn.querySelector('span');
    if (!span) return null;
    const value = span.textContent.replace(/,/g, '');
    const parsedValue = parseInt(value, 10);
    return isNaN(parsedValue) ? null : parsedValue;
  } catch (error) {
    console.warn('[Cyclopedia] Error getting beast coins from UI:', error);
    return null;
  }
}

function getDustFromUI() {
  try {
    const dustDiv = Array.from(DOMCache.getAll('div'))
      .find(div => {
        const hasTitle = div.getAttribute('title') === 'Dust';
        const img = div.querySelector('img[alt="Dust"]');
        return hasTitle || img;
      });
    
    if (!dustDiv) return null;
    
    const span = dustDiv.querySelector('span');
    if (!span) return null;
    
    const value = span.textContent.replace(/,/g, '');
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) {
      console.warn('[Cyclopedia] Invalid dust value:', value);
      return null;
    }
    return parsedValue;
  } catch (error) {
    console.warn('[Cyclopedia] Error getting dust from UI:', error);
    return null;
  }
}

function getDustFromGameState() {
  try {
    const gameState = globalThis.state?.player?.getSnapshot()?.context;
    if (!gameState) return null;
    
    const possiblePaths = [
      gameState.inventory?.dust,
      gameState.inventory?.dust?.count,
      gameState.resources?.dust,
      gameState.player?.dust,
      gameState.dust
    ];
    
    for (const dustValue of possiblePaths) {
      if (typeof dustValue === 'number' && !isNaN(dustValue) && dustValue > 0) {
        return dustValue;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

function getHuntingMarksFromUI() {
  try {
    let huntingMarksSprite = DOMCache.get('.sprite.item.relative.id-35572') ||
                            DOMCache.get('.sprite.item.relative[class*="id-35572"]') ||
                            DOMCache.get('img[src*="huntingmarks.png"]')?.closest('.sprite.item.relative') ||
                            DOMCache.get('[data-item*="hunting"]') ||
                            DOMCache.get('[data-item*="mark"]');
    
  if (!huntingMarksSprite) {
      const huntingMarksText = Array.from(DOMCache.getAll('*')).find(el => 
      el.textContent && el.textContent.includes('Hunting Marks')
    );
    if (huntingMarksText) {
      huntingMarksSprite = huntingMarksText.closest('.sprite.item.relative') || huntingMarksText;
    }
  }
  
  if (!huntingMarksSprite) {
    return null;
  }
  
  let span = huntingMarksSprite.querySelector('.font-outlined-fill');
  
  if (!span) {
    const spans = huntingMarksSprite.querySelectorAll('span');
    span = Array.from(spans).find(s => {
      const text = s.textContent.trim();
      return /^\d+$/.test(text.replace(/,/g, ''));
    });
  }
  
  if (!span) {
    const textContent = huntingMarksSprite.textContent;
    const numberMatch = textContent.match(/(\d{1,3}(?:,\d{3})*)/);
    if (numberMatch) {
      const value = numberMatch[1].replace(/,/g, '');
      const parsedValue = parseInt(value, 10);
      if (!isNaN(parsedValue)) {
        return parsedValue;
      }
    }
  }
  
  if (!span) {
    return null;
  }
  
  const value = span.textContent.replace(/,/g, '');
  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue)) {
    console.warn('[Cyclopedia] Invalid Hunting Marks value:', value);
    return null;
  }
  return parsedValue;
  } catch (error) {
    return null;
  }
}

function getHuntingMarksFromGameState() {
  try {
    const gameState = globalThis.state?.player?.getSnapshot()?.context;
    if (!gameState) return null;
    
    const possiblePaths = [
      gameState.inventory?.huntingMarks,
      gameState.inventory?.huntingMarks?.count,
      gameState.resources?.huntingMarks,
      gameState.player?.huntingMarks,
      gameState.huntingMarks,
      gameState.hunting?.marks,
      gameState.marks,
      gameState.huntingMarks?.count,
      gameState.huntingMarks?.amount,
      gameState.huntingMarks?.quantity,
      gameState.hunting?.huntingMarks,
      gameState.hunting?.huntingMarks?.count,
      gameState.player?.hunting?.marks,
      gameState.player?.hunting?.huntingMarks,
      gameState.player?.huntingMarks,
      gameState.player?.marks,
      gameState.inventory?.marks,
      gameState.inventory?.marks?.count,
      gameState.player?.inventory?.huntingMarks,
      gameState.player?.inventory?.huntingMarks?.count,
      gameState.player?.resources?.huntingMarks,
      gameState.player?.resources?.huntingMarks?.count,
      gameState.context?.inventory?.huntingMarks,
      gameState.context?.inventory?.huntingMarks?.count,
      gameState.context?.player?.huntingMarks,
      gameState.context?.player?.huntingMarks?.count,
      gameState.context?.huntingMarks,
      gameState.context?.huntingMarks?.count,
      gameState.context?.hunting?.marks,
      gameState.context?.hunting?.marks?.count,
      gameState.questLog?.hunting?.marks,
      gameState.questLog?.hunting?.huntingMarks,
      gameState.questLog?.task?.huntingMarks,
      gameState.questLog?.task?.marks,
      gameState.questLog?.task?.points,
      gameState.questLog?.seashell?.huntingMarks,
      gameState.questLog?.seashell?.marks,
      gameState.huntingMarks,
      gameState.huntingMarksCount,
      gameState.huntingMarksAmount,
      gameState.huntingMarksQuantity,
      gameState.huntingMarksTotal,
      gameState.totalHuntingMarks,
      gameState.huntingMarksEarned,
      gameState.huntingMarksCollected
    ];
    
    for (const huntingMarksValue of possiblePaths) {
      if (typeof huntingMarksValue === 'number' && !isNaN(huntingMarksValue) && huntingMarksValue >= 0) {
        return huntingMarksValue;
      }
    }
    
    const searchRecursively = (obj, depth = 0, path = '') => {
      if (depth > 4) return null;
      if (!obj || typeof obj !== 'object') return null;
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (key.toLowerCase().includes('hunting') && key.toLowerCase().includes('mark')) {
          if (typeof value === 'number' && !isNaN(value) && value >= 0) {
            return value;
          }
        }
        
        if (key.toLowerCase() === 'marks' && typeof value === 'number' && !isNaN(value) && value >= 0) {
          const parentKey = path.split('.').pop() || '';
          if (parentKey.toLowerCase().includes('hunting') || 
              parentKey.toLowerCase().includes('player') || 
              parentKey.toLowerCase().includes('inventory') ||
              parentKey.toLowerCase().includes('quest') ||
              parentKey.toLowerCase().includes('task')) {
            return value;
          }
        }
        
        if (key.toLowerCase() === 'points' && typeof value === 'number' && !isNaN(value) && value >= 0) {
          const parentKey = path.split('.').pop() || '';
          if (parentKey.toLowerCase().includes('task') || 
              parentKey.toLowerCase().includes('quest')) {
            return value;
          }
        }
        
        if (typeof value === 'number' && !isNaN(value) && value >= 0) {
          const keyLower = key.toLowerCase();
          if (keyLower.includes('hunt') || 
              keyLower.includes('mark') || 
              keyLower.includes('task') ||
              keyLower.includes('quest')) {
            if (keyLower.includes('hunting') || (keyLower.includes('hunt') && keyLower.includes('mark'))) {
              return value;
            }
          }
        }
        
        if (typeof value === 'object' && value !== null) {
          const result = searchRecursively(value, depth + 1, currentPath);
          if (result !== null) return result;
        }
      }
      return null;
    };
    
    const recursiveResult = searchRecursively(gameState);
    if (recursiveResult !== null) {
      return recursiveResult;
    }
    
    if (globalThis.state?.huntingMarks) {
      const value = globalThis.state.huntingMarks;
      if (typeof value === 'number' && !isNaN(value) && value >= 0) {
        return value;
      }
    }
    
    if (globalThis.state?.player?.huntingMarks) {
      const value = globalThis.state.player.huntingMarks;
      if (typeof value === 'number' && !isNaN(value) && value >= 0) {
        return value;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function getHuntingMarksFromProfileAPI() {
  try {
    console.log('[Cyclopedia] Fetching hunting marks from API...');
    
    let playerName = globalThis.state?.player?.getSnapshot()?.context?.player?.name;
    if (!playerName) {
      playerName = globalThis.state?.player?.getSnapshot()?.context?.name;
    }
    if (!playerName) {
      console.warn('[Cyclopedia] No player name found for API request');
      return null;
    }
    
    const apiUrl = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(playerName)}%22%7D%7D`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    const searchForHuntingMarks = (obj) => {
      if (!obj || typeof obj !== 'object') return null;
      
      for (const [key, value] of Object.entries(obj)) {
        if (key.toLowerCase().includes('hunting') && key.toLowerCase().includes('mark')) {
          if (typeof value === 'number' && !isNaN(value) && value >= 0) {
            return value;
          }
        }
        if (typeof value === 'object' && value !== null) {
          const result = searchForHuntingMarks(value);
          if (result !== null) return result;
        }
      }
      return null;
    };
    
    const huntingMarks = searchForHuntingMarks(data);
    if (huntingMarks !== null) {
      console.log('[Cyclopedia] Hunting marks fetched successfully:', huntingMarks);
      return huntingMarks;
    }
    
    console.log('[Cyclopedia] No hunting marks found in API response');
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

async function processLazyLoadQueue() {
  if (cyclopediaState.isProcessingQueue || cyclopediaState.lazyLoadQueue.length === 0) {
    return;
  }
  
  cyclopediaState.isProcessingQueue = true;
  
  try {
    while (cyclopediaState.lazyLoadQueue.length > 0) {
      const { monsterId, callback } = cyclopediaState.lazyLoadQueue.shift();
      
      try {
        const monsterData = safeGetMonsterData(monsterId);
        if (callback && typeof callback === 'function') {
          callback(monsterData);
        }
      } catch (error) {
        console.error(`[Cyclopedia] Error loading monster ${monsterId}:`, error);
        if (callback && typeof callback === 'function') {
          callback(null);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  } finally {
    cyclopediaState.isProcessingQueue = false;
  }
}

function queueMonsterDataLoad(monsterId, callback) {
  cyclopediaState.lazyLoadQueue.push({ monsterId, callback });
  
  if (!cyclopediaState.isProcessingQueue) {
    processLazyLoadQueue();
  }
}

function safeGetMonsterData(monsterId) {
  try {
    if (!globalThis.state?.utils?.getMonster) {
      throw new Error('Monster API not available');
    }
    const monsterData = globalThis.state.utils.getMonster(monsterId);
    if (!monsterData?.metadata) {
      throw new Error('Invalid monster data');
    }
    return monsterData;
  } catch (error) {
    console.error(`[Cyclopedia] Error getting monster data for ID ${monsterId}:`, error);
    return null;
  }
}

const buildCyclopediaMonsterNameMap = MemoizationUtils.memoize(function() {
  if (cyclopediaState.monsterNameMapBuilt && cyclopediaState.monsterNameMap) {
    return cyclopediaState.monsterNameMap;
  }
  cyclopediaState.monsterNameMap = new Map();
  const utils = globalThis.state.utils;
  
  if (!utils || !utils.getMonster) {
    console.warn('[Cyclopedia] Monster API not available, skipping name map build');
    return;
  }
  
  let maxId = 200;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 10;
  
  try {
    for (let i = 1; i < 1000; i++) {
      try {
        const monster = utils.getMonster(i);
        if (!monster || !monster.metadata || !monster.metadata.name) {
          consecutiveFailures++;
          if (consecutiveFailures >= maxConsecutiveFailures) {
            maxId = Math.max(1, i - maxConsecutiveFailures);
            break;
          }
        } else {
          consecutiveFailures = 0;
          maxId = i;
        }
      } catch (error) {
        consecutiveFailures++;
        if (consecutiveFailures >= maxConsecutiveFailures) {
          maxId = Math.max(1, i - maxConsecutiveFailures);
          break;
        }
      }
    }
  } catch (error) {
    console.warn('[Cyclopedia] Error determining monster ID range:', error);
  }
  
  for (let i = 1; i <= maxId; i++) {
    try {
      const monster = utils.getMonster(i);
      if (monster && monster.metadata && monster.metadata.name) {
        cyclopediaState.monsterNameMap.set(monster.metadata.name.toLowerCase(), { monster, index: i });
      }
    } catch (error) {
      continue;
    }
  }
  cyclopediaState.monsterNameMapBuilt = true;
  const entry = cyclopediaState.monsterNameMap.get('old giant spider');
  if (entry && entry.monster && entry.monster.metadata && entry.monster.metadata.baseStats) {
    entry.monster.metadata.baseStats = {
      hp: 1140,
      ad: 108,
      ap: 30,
      armor: 30,
      magicResist: 30
    };
  }
  return cyclopediaState.monsterNameMap;
});

function getMonsterNameFromMenu(menuElem) {
  const group = menuElem.querySelector('div[role="group"]');
  if (!group) return null;
  const firstItem = group.querySelector('.dropdown-menu-item');
  if (!firstItem) return null;
  const match = firstItem.textContent.trim().match(/^(.*?)\s*\(/);
  return match ? match[1] : firstItem.textContent.trim();
}



function findMonsterLocations(monsterName) {
  const cacheKey = monsterName.toLowerCase();
  if (cyclopediaState.monsterLocationCache.has(cacheKey)) {
    return cyclopediaState.monsterLocationCache.get(cacheKey);
  }
  const locations = [];
  try {
    let monsterGameId = null;
    if (cyclopediaState.monsterNameMap) {
      const entry = cyclopediaState.monsterNameMap.get(monsterName.toLowerCase());
      if (entry) {
        monsterGameId = entry.index;
      }
    }
    if (!monsterGameId) {
      if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.maps) {
        const maps = window.BestiaryModAPI.utility.maps;
        monsterGameId = maps.monsterNamesToGameIds.get(monsterName.toLowerCase());
      }
    }
    if (!monsterGameId) {
      cyclopediaState.monsterLocationCache.set(cacheKey, locations);
      return locations;
    }
    const rooms = globalThis.state.utils.ROOMS;
    const roomNames = globalThis.state.utils.ROOM_NAME;
    Object.entries(rooms).forEach(([roomId, room]) => {
      try {
        if (!room.file || !room.file.data || !room.file.data.actors) {
          return;
        }
        const actors = room.file.data.actors;
        const monsterInRoom = actors.filter((actor) => {
          if (!actor) {
            return false;
          }
          return actor.id === monsterGameId;
        });
        if (monsterInRoom.length > 0) {
          const roomName = roomNames[roomId] || roomId;
          const roomLocations = monsterInRoom.map((actor, index) => ({
            tileIndex: null,
            direction: actor.direction || 'unknown',
            level: actor.level || 1,
            tier: 0,
            villain: true,
            equipment: null,
            actorIndex: index
          }));
          locations.push({
            roomId: roomId,
            roomName: roomName,
            positions: roomLocations
          });
        }
      } catch (error) {
      }
    });
  } catch (error) {
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
// 3. DOM/CSS Injection Helpers
// =======================

function injectCyclopediaButtonStyles() {
  if (!document.getElementById('cyclopedia-btn-css')) {
    const style = document.createElement('style');
    style.id = 'cyclopedia-btn-css';
    style.textContent = `
      .cyclopedia-subnav { display: flex; gap: 0; margin-bottom: 0; width: 100%; }
      nav.cyclopedia-subnav > button.cyclopedia-btn,
      nav.cyclopedia-subnav > button.cyclopedia-btn:hover,
      nav.cyclopedia-subnav > button.cyclopedia-btn:focus {
        background: url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat !important;
        border: 6px solid transparent !important;
        border-color: #ffe066 !important;
        border-image: url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch !important;
        color: var(--theme-text, #e6d7b0) !important;
        font-weight: 700 !important;
        border-radius: 0 !important;
        box-sizing: border-box !important;
        transition: color 0.2s, border-image 0.1s !important;
        font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif !important;
        outline: none !important;
        position: relative !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 16px !important;
        padding: 7px 24px !important;
        cursor: pointer;
        flex: 1 1 0;
        min-width: 0;
      }
      nav.cyclopedia-subnav > button.cyclopedia-btn.pressed,
      nav.cyclopedia-subnav > button.cyclopedia-btn:active {
        border-image: url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 6 fill stretch !important;
      }
      nav.cyclopedia-subnav > button.cyclopedia-btn.active {
        border-image: url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 6 fill stretch !important;
      }
      /* Home button specific styling - 42x42 pixels */
      nav.cyclopedia-subnav > button.cyclopedia-btn[data-tab="home"],
      nav.cyclopedia-subnav > button.cyclopedia-btn[data-tab="wiki"] {
        width: 42px !important;
        height: 42px !important;
        min-width: 42px !important;
        min-height: 42px !important;
        max-width: 42px !important;
        max-height: 42px !important;
        flex: 0 0 42px !important;
        padding: 0 !important;
        font-size: 12px !important;
      }
    `;
    document.head.appendChild(style);
  }
}

function injectCyclopediaBoxStyles() {
  if (!document.getElementById('cyclopedia-box-css')) {
    const style = document.createElement('style');
    style.id = 'cyclopedia-box-css';
    style.textContent = `
      .cyclopedia-box { display: flex; flex-direction: column; border: none; background: none; margin-bottom: 16px; min-height: 120px; box-sizing: border-box; }
      .cyclopedia-box-title { border: 6px solid transparent; border-image: url('https://bestiaryarena.com/_next/static/media/4-frame-top.b7a55115.png') 6 6 0 6 stretch; border-bottom: none; background: #232323; color: #ffe066; font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif; font-size: 15px; font-weight: bold; padding: 4px 12px; text-align: left; letter-spacing: 1px; }
      .cyclopedia-box-content { flex: 1 1 0; overflow-y: auto; background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat; padding: 8px 12px; color: #e6d7b0; font-size: 14px; font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif; min-height: 0; max-height: none; scrollbar-width: thin !important; scrollbar-color: #444 #222 !important; }
      .cyclopedia-box-content::-webkit-scrollbar { width: 12px !important; background: transparent !important; }
      .cyclopedia-box-content::-webkit-scrollbar-thumb { background: url('https://bestiaryarena.com/_next/static/media/scrollbar-handle-vertical.962972d4.png') repeat-y !important; border-radius: 4px !important; }
      .cyclopedia-box-content::-webkit-scrollbar-corner { background: transparent !important; }
    `;
    document.head.appendChild(style);
  }
}

function injectCyclopediaSelectedCss() {
  if (!document.getElementById('cyclopedia-selected-css')) {
    const style = document.createElement('style');
    style.id = 'cyclopedia-selected-css';
    style.textContent = `
      .cyclopedia-selected {
        background: rgba(255,255,255,0.18) !important;
        color: #ffe066 !important;
      }
      
      .cyclopedia-box .equipment-portrait .absolute {
        background: none !important;
      }
      
      .cyclopedia-box .equipment-portrait[data-highlighted="true"] .absolute {
        background: none !important;
      }
      
      .cyclopedia-box .equipment-portrait .absolute[style*="radial-gradient"] {
        background: none !important;
      }
      
      .cyclopedia-box .equipment-portrait .absolute[style*="background: radial-gradient"] {
        background: none !important;
      }
      
      .cyclopedia-box .equipment-portrait .absolute[style*="rgba(0, 0, 0, 0.5)"] {
        background: none !important;
      }
      
      .cyclopedia-box .equipment-portrait .absolute.bottom-0.left-0 {
        background: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}

function removeCyclopediaFromMenus() {
  function isInMenu(el, menuLabel) {
    let parent = el.parentElement;
    while (parent) {
      if (parent.textContent && parent.textContent.includes(menuLabel)) {
        if (parent.getAttribute('role') === 'menu' || parent.classList.contains('dropdown-menu')) {
          return true;
        }
      }
      parent = parent.parentElement;
    }
    return false;
  }
  
  function isHeaderButton(el) {
    if (el.classList && el.classList.contains('cyclopedia-header-btn')) {
      return true;
    }
    
    if (el.tagName === 'LI' && el.querySelector('.cyclopedia-header-btn')) {
      return true;
    }
    
    let parent = el.parentElement;
    while (parent) {
      if (parent.classList && parent.classList.contains('cyclopedia-header-btn')) {
        return true;
      }
      if (parent.tagName === 'LI' && parent.querySelector('.cyclopedia-header-btn')) {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  }
  
  function isInHeader(el) {
    let parent = el.parentElement;
    while (parent) {
      if (parent.tagName === 'NAV' || (parent.classList && parent.classList.contains('w-full'))) {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  }
  
  document.querySelectorAll('div, li').forEach(el => {
    const textContent = el.textContent.trim().toLowerCase();
    if (textContent === 'cyclopedia') {
      const inMyAccount = isInMenu(el, 'My account');
      const inGameMode = isInMenu(el, 'Game mode');
      const isHeader = isHeaderButton(el);
      const inHeader = isInHeader(el);
      
      if ((inMyAccount || inGameMode) && !isHeader && !inHeader) {
        el.style.display = 'none';
      }
    }
  });
}

setTimeout(removeCyclopediaFromMenus, 500);
const cyclopediaMenuObserver = new MutationObserver(removeCyclopediaFromMenus);
cyclopediaMenuObserver.observe(document.body, { childList: true, subtree: true });

// =======================
// 4. UI Creation Functions
// =======================
function createBox({
  title,
  items,
  extraBoxStyles = {},
  type = 'creature',
  selectedCreature,
  selectedEquipment,
  selectedInventory,
  setSelectedCreature,
  setSelectedEquipment,
  setSelectedInventory,
  updateRightCol
}) {
  if (!api || !api.ui || !api.ui.components || typeof api.ui.components.createScrollContainer !== 'function') {
    console.error('[Cyclopedia] createBox: api.ui.components.createScrollContainer is not available.');
    const fallback = document.createElement('div');
    fallback.textContent = 'Cyclopedia UI error: scroll container unavailable.';
    fallback.style.color = 'red';
    return fallback;
  }
  if (!Array.isArray(items)) {
    console.warn('[Cyclopedia] createBox: items is not an array. Defaulting to empty list.');
    items = [];
  }
  const box = document.createElement('div');
  box.style.flex = '1 1 0';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.margin = '0';
  box.style.padding = '0';
  box.style.minHeight = '0';
  box.style.height = '100%';
  Object.assign(box.style, extraBoxStyles);
  const titleEl = document.createElement('h2');
  titleEl.className = 'widget-top widget-top-text ' + LAYOUT_CONSTANTS.FONTS.SIZES.TITLE;
  titleEl.style.margin = '0';
  titleEl.style.padding = '2px 8px';
  titleEl.style.textAlign = 'center';
  titleEl.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  const p = document.createElement('p');
  p.textContent = title;
  p.className = LAYOUT_CONSTANTS.FONTS.SIZES.TITLE;
  p.style.margin = '0';
  p.style.padding = '0';
  p.style.textAlign = 'center';
  p.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  titleEl.appendChild(p);
  box.appendChild(titleEl);
  const scrollContainer = api.ui.components.createScrollContainer({
    height: '100%',
    padding: false,
    content: null
  });
  
  if (!scrollContainer || !scrollContainer.element) {
    console.error('[Cyclopedia] createBox: scrollContainer creation failed');
    const fallback = document.createElement('div');
    fallback.textContent = 'Scroll container error';
    fallback.style.color = 'red';
    return fallback;
  }
  
  scrollContainer.element.style.flex = '1 1 0';
  scrollContainer.element.style.minHeight = '0';
  scrollContainer.element.style.overflowY = 'scroll';
  items.forEach(name => {
    const item = document.createElement('div');
    item.textContent = name;
    item.className = LAYOUT_CONSTANTS.FONTS.SIZES.BODY;
    item.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
    item.style.cursor = 'pointer';
    item.style.padding = '2px 4px';
    item.style.borderRadius = '2px';
    item.style.textAlign = 'left';
    item.addEventListener('mouseenter', () => {
      item.style.background = 'rgba(255,255,255,0.08)';
    });
    item.addEventListener('mouseleave', () => {
      if (!item.classList.contains('cyclopedia-selected')) {
        item.style.background = 'none';
      }
    });
    item.addEventListener('mousedown', () => {
      item.style.background = 'rgba(255,255,255,0.18)';
    });
    item.addEventListener('mouseup', () => {
      if (!item.classList.contains('cyclopedia-selected')) {
        item.style.background = 'rgba(255,255,255,0.08)';
      }
    });
    item.addEventListener('click', () => {
      document.querySelectorAll('.cyclopedia-selected').forEach(el => {
        el.classList.remove('cyclopedia-selected');
        el.style.background = 'none';
        el.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
      });
      item.classList.add('cyclopedia-selected');
      item.style.background = 'rgba(255,255,255,0.18)';
      item.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
      if (type === 'creature') {
        if (title === 'Unobtainable') {
        }
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
    });
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
    console.log('[Cyclopedia] Adding header button...');
    
    let retryCount = 0;
    const maxRetries = 20;
    const tryInsert = () => {
      try {
        const headerUl = DOMCache.get('header ul.pixel-font-16.flex.items-center');
        if (!headerUl) {
          retryCount++;
          if (retryCount > maxRetries) {
            console.warn('[Cyclopedia] addCyclopediaHeaderButton: header not found after max retries.');
            return;
          }
          setTimeout(tryInsert, 500);
          return;
        }
        if (headerUl.querySelector('.cyclopedia-header-btn')) {
          console.log('[Cyclopedia] Header button already exists');
          return;
        }
        
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
        console.log('[Cyclopedia] Header button added successfully');
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
  const group = menuElem.querySelector('div[role="group"]');
  if (!group) return null;
  const firstItem = Array.from(group.querySelectorAll('.dropdown-menu-item')).find(item => {
    return /\(Tier[: ]?\d+\)/.test(item.textContent);
  }) || group.querySelector('.dropdown-menu-item');
  if (!firstItem) return null;
  const match = firstItem.textContent.trim().match(/^(.*?)\s*\(Tier[: ]?\d+\)/);
  return match ? match[1] : firstItem.textContent.trim();
}

function injectCyclopediaButton(menuElem) {
  // Only show Cyclopedia button if data-scroll-locked is less than '2'
  const body = document.body;
  const scrollLocked = body.getAttribute('data-scroll-locked');
  if (scrollLocked >= '2') return;
  
  // Remove ALL existing Cyclopedia buttons in this menu (robust duplicate prevention)
  const existingButtons = menuElem.querySelectorAll('.cyclopedia-menu-item');
  existingButtons.forEach(btn => {
    try {
      if (btn.parentNode) {
        btn.parentNode.removeChild(btn);
      }
    } catch (error) {
      console.warn('[Cyclopedia] Error removing existing button:', error);
    }
  });
  
  // If we just removed buttons, don't inject new ones (menu is being cleaned up)
  if (existingButtons.length > 0) {
    return;
  }
  
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
    // Open Cyclopedia immediately
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
// 5. Data/Model Functions
// =======================
function startContextMenuObserver() {
  if (window.cyclopediaGlobalObserver) {
    try {
      window.cyclopediaGlobalObserver.disconnect();
    } catch (error) {
      console.warn('[Cyclopedia] Error disconnecting global observer:', error);
    }
    window.cyclopediaGlobalObserver = null;
  }
  
  if (cyclopediaState.observer) {
    stopContextMenuObserver();
  }
  
  cyclopediaState.observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          if (node.matches && node.matches('div[data-radix-popper-content-wrapper]')) {
            const menu = node.querySelector('[role="menu"]');
            if (menu) {
              setTimeout(() => injectCyclopediaButton(menu), 10);
            }
          } else if (node.querySelector) {
            const wrapper = node.querySelector('div[data-radix-popper-content-wrapper]');
            if (wrapper) {
              const menu = wrapper.querySelector('[role="menu"]');
              if (menu) {
                setTimeout(() => injectCyclopediaButton(menu), 10);
              }
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
    cyclopediaState.observer.disconnect();
    cyclopediaState.observer = null;
  }
  
  if (window.cyclopediaGlobalObserver) {
    try {
      window.cyclopediaGlobalObserver.disconnect();
    } catch (error) {
      console.warn('[Cyclopedia] Error disconnecting global observer during cleanup:', error);
    }
    window.cyclopediaGlobalObserver = null;
  }
}

// =======================
// 6. Modal & Template Rendering
// =======================

let activeCyclopediaModal = null;
let cyclopediaModalInProgress = false;
let lastModalCall = 0;

function createStartPageManager() {
  class StartPageManager {
    constructor() {
      this.container = this.createContainer();
      this.timerElements = {};
      this.isInitialized = false;
    }

    createContainer() {
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
      return container;
    }

    showLoading() {
      this.container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.TEXT};">
          <div style="font-size: 24px; margin-bottom: 16px;">📚</div>
          <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Loading Cyclopedia...</div>
          <div style="font-size: 14px; color: #888;">Fetching your profile data</div>
        </div>
      `;
    }

    async fetchProfileData(playerName) {
      try {
        if (!playerName || typeof playerName !== 'string') {
          throw new Error('Invalid player name provided');
        }

        if (cachedProfileData) {
          return cachedProfileData;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.warn('[Cyclopedia] Profile data fetch timed out');
        }, START_PAGE_CONFIG.API_TIMEOUT);

        try {
          const apiUrl = `${START_PAGE_CONFIG.API_BASE_URL}?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(playerName)}%22%7D%7D`;
          
          const response = await fetch(apiUrl, { 
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch profile data (HTTP ${response.status})`);
          }
          
          const data = await response.json();
          
          if (!data || typeof data !== 'object') {
            throw new Error('Invalid response format from API');
          }
          
          cachedProfileData = data;
          return data;
          
        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          if (fetchError.name === 'AbortError') {
            throw new Error('Request timed out. Please check your internet connection and try again.');
          }
          
          throw fetchError;
        }
        
      } catch (error) {
        console.error('[Cyclopedia] Error fetching profile data:', error);
        throw error;
      }
    }

    createColumn(width, content) {
      const wrapper = document.createElement('div');
      Object.assign(wrapper.style, {
        width: width + 'px',
        flex: `0 0 ${width}px`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      });
      wrapper.appendChild(content);
      return wrapper;
    }

    getErrorMessage(error) {
      const errorMessages = {
        'AbortError': 'Request timed out. Please check your internet connection and try again.',
        'Player name not available': 'Player name not available. Please ensure you are logged into the game.',
        'HTTP': 'Failed to fetch profile data. Please try again.'
      };
      
      for (const [key, message] of Object.entries(errorMessages)) {
        if (error.name === key || error.message.includes(key)) {
          return message;
        }
      }
      return 'An unexpected error occurred while loading the profile data.';
    }

    showError(message, retryFunction) {
      this.container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: ${LAYOUT_CONSTANTS.COLORS.ERROR}; text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
          <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load Profile Data</div>
          <div style="font-size: 14px; margin-bottom: 16px; color: #888;">${message}</div>
          <button id="retry-profile-load" style="padding: 8px 16px; background: #444; border: 1px solid #666; border-radius: 4px; color: white; cursor: pointer; font-family: ${LAYOUT_CONSTANTS.FONTS.PRIMARY};">Retry</button>
        </div>
      `;
      
      const retryButton = this.container.querySelector('#retry-profile-load');
      if (retryButton && retryFunction) {
        retryButton.addEventListener('click', retryFunction);
      }
    }

    async initialize() {
      try {
        this.showLoading();
        
        const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
        if (!playerState?.name) {
          throw new Error('Player name not available. Please ensure you are logged into the game.');
        }
        
        const data = await this.fetchProfileData(playerState.name);
        const profileData = Array.isArray(data) && data[0]?.result?.data?.json 
          ? data[0].result.data.json 
          : data;
        
        this.renderLayout(playerState.name, profileData);
        this.setupTimers();
        this.isInitialized = true;
      } catch (error) {
        this.showError(this.getErrorMessage(error), () => this.initialize());
      }
    }

    renderLayout(playerName, profileData) {
      try {
        this.container.innerHTML = '';
        
        const mainFlexRow = document.createElement('div');
        Object.assign(mainFlexRow.style, {
          display: 'flex',
          flexDirection: 'row',
          width: '900px',
          height: '100%',
          margin: '0 auto',
          gap: '0',
          alignItems: 'center'
        });
        
        const leftCol = this.createColumn(START_PAGE_CONFIG.COLUMN_WIDTHS.LEFT, renderCyclopediaWelcomeColumn(playerName));
        mainFlexRow.appendChild(leftCol);
        
        const middleCol = this.createColumn(START_PAGE_CONFIG.COLUMN_WIDTHS.MIDDLE, renderCyclopediaPlayerInfo(profileData));
        Object.assign(middleCol.style, {
          justifyContent: 'center',
          padding: '0 12px'
        });
        mainFlexRow.appendChild(middleCol);
        
        const rightCol = renderDailyContextColumn();
        mainFlexRow.appendChild(rightCol);
        
        this.container.appendChild(mainFlexRow);
      } catch (error) {
        console.error('[Cyclopedia] Error rendering layout:', error);
        this.showError('Failed to render the layout. Please try again.', () => this.initialize());
      }
    }

    setupTimers() {
      try {
        this.timerElements.yasir = this.container.querySelector('.yasir-timer');
        this.timerElements.boosted = this.container.querySelector('.boosted-timer');
        
        if (this.timerElements.yasir || this.timerElements.boosted) {
          this.startTimer();
        }
      } catch (error) {
        console.error('[Cyclopedia] Error setting up timers:', error);
      }
    }

    startTimer() {
      try {
        if (globalTimer) {
          clearInterval(globalTimer);
          globalTimer = null;
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
            console.error('[Cyclopedia] Error updating timers:', error);
            
            if (errorCount >= MAX_ERRORS) {
              console.warn('[Cyclopedia] Too many timer errors, stopping timer');
              this.stopTimer();
            }
          }
        };
        
        globalTimer = setInterval(updateTimers, 1000);
        
        timerCleanup.set(this.container, () => {
          this.stopTimer();
        });
        
      } catch (error) {
        console.error('[Cyclopedia] Error starting timer:', error);
      }
    }

    stopTimer() {
      try {
        if (globalTimer) {
          clearInterval(globalTimer);
          globalTimer = null;
        }
      } catch (error) {
        console.error('[Cyclopedia] Error stopping timer:', error);
      }
    }

    cleanup() {
      try {
        this.stopTimer();

        const cleanup = timerCleanup.get(this.container);
        if (cleanup) {
          cleanup();
          timerCleanup.delete(this.container);
        }
        
        this.timerElements = {};

        this.isInitialized = false;
        
      } catch (error) {
        console.error('[Cyclopedia] Error during StartPageManager cleanup:', error);
      }
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
    console.log('[Cyclopedia] Opening modal with options:', options);
    
    const now = Date.now();
    if (cyclopediaModalInProgress) {
      console.log('[Cyclopedia] Modal already in progress, ignoring request');
      return;
    }
    if (now - lastModalCall < 1000) {
      console.log('[Cyclopedia] Modal call too frequent, ignoring request');
      return;
    }
    lastModalCall = now;
    cyclopediaModalInProgress = true;
    options = options || {};
    const creatureToSelect = options.creature;
    const equipmentToSelect = options.equipment;
    
    const isFromHeader = options.fromHeader === true;
  
  (() => {
    try {
      if (!cyclopediaModalInProgress) {
        return;
      }
      
      if (!document.querySelector('.cyclopedia-styles-injected')) {
        injectCyclopediaButtonStyles();
        injectCyclopediaBoxStyles();
        injectCyclopediaSelectedCss();
        document.body.classList.add('cyclopedia-styles-injected');
      }
      
      if (!document.querySelector('.cyclopedia-header-btn')) {
        addCyclopediaHeaderButton();
      }
      
      if (!cyclopediaState.observer) {
        startContextMenuObserver();
      }

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
            console.warn('[Cyclopedia] Error appending tab page:', error);
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
            } catch (error) {
              console.warn('[Cyclopedia] Error changing tab display:', error);
            }
          }
        });
      };
    }

    function createBestiaryTabPage(selectedCreature, selectedEquipment, selectedInventory, setSelectedCreature, setSelectedEquipment, setSelectedInventory, updateRightCol) {
      const d = document.createElement('div');
      d.style.display = 'flex';
      d.style.flexDirection = 'row';
      d.style.width = '100%';
      d.style.height = '100%';
      d.style.alignItems = 'flex-start';
      d.style.justifyContent = 'center';
      d.style.gap = '0';
      const rightCol = document.createElement('div');
      rightCol.style.flex = '1';
      rightCol.style.padding = '0';
      rightCol.style.margin = '0';
      rightCol.style.height = '100%';
      rightCol.style.borderImage = 'none';
      function updateRightColInternal() {
        rightCol.innerHTML = '';
        if (selectedCreature) {
          rightCol.appendChild(renderCreatureTemplate(selectedCreature));
        } else {
          const msg = document.createElement('div');
          msg.textContent = 'Select a creature from the left column to view.';
          msg.className = LAYOUT_CONSTANTS.FONTS.SIZES.BODY;
          msg.style.display = 'flex';
          msg.style.justifyContent = 'center';
          msg.style.alignItems = 'center';
          msg.style.height = '100%';
          msg.style.width = '100%';
          msg.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
          msg.style.fontWeight = 'bold';
          msg.style.textAlign = 'center';
          rightCol.appendChild(msg);
        }
      }
      const leftCol = document.createElement('div');
      leftCol.style.width = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.minWidth = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.maxWidth = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.padding = '0';
      leftCol.style.margin = '0';
      leftCol.style.height = '100%';
      leftCol.style.display = 'flex';
      leftCol.style.flexDirection = 'column';
      leftCol.style.borderRight = '6px solid transparent';
      leftCol.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
      leftCol.style.overflowY = 'scroll';
      leftCol.style.minHeight = '0';
      const creaturesBox = createBox({
        title: 'Creatures',
        items: GAME_DATA.ALL_CREATURES,
        type: 'creature',
        selectedCreature,
        selectedEquipment,
        selectedInventory,
        setSelectedCreature: v => { selectedCreature = v; updateRightColInternal(); },
        setSelectedEquipment,
        setSelectedInventory,
        updateRightCol: updateRightColInternal
      });
      creaturesBox.style.flex = '1 1 0';
      creaturesBox.style.minHeight = '0';
      const unobtainableBox = createBox({
        title: 'Unobtainable',
        items: GAME_DATA.UNOBTAINABLE_CREATURES,
        type: 'creature',
        selectedCreature,
        selectedEquipment,
        selectedInventory,
        setSelectedCreature: v => { selectedCreature = v; updateRightColInternal(); },
        setSelectedEquipment,
        setSelectedInventory,
        updateRightCol: updateRightColInternal
      });
      unobtainableBox.style.flex = '1 1 0';
      unobtainableBox.style.minHeight = '0';
      leftCol.appendChild(creaturesBox);
      leftCol.appendChild(unobtainableBox);
      d.appendChild(leftCol);
      d.appendChild(rightCol);
      updateRightColInternal();
      return d;
    }

    function createEquipmentTabPage(selectedCreature, selectedEquipment, selectedInventory, setSelectedCreature, setSelectedEquipment, setSelectedInventory, updateRightCol) {
      const d = document.createElement('div');
      d.style.display = 'flex';
      d.style.flexDirection = 'row';
      d.style.width = '100%';
      d.style.height = '100%';
      d.style.alignItems = 'flex-start';
      d.style.justifyContent = 'center';
      d.style.gap = '0';

      let selectedEquipmentLocal = selectedEquipment;

      const equipDetailsCol = document.createElement('div');
      equipDetailsCol.style.flex = '1 1 0';
      equipDetailsCol.style.height = '100%';
      equipDetailsCol.style.display = 'flex';
      equipDetailsCol.style.flexDirection = 'column';
      equipDetailsCol.style.alignItems = 'center';
      equipDetailsCol.style.justifyContent = 'flex-start';
      equipDetailsCol.style.fontSize = '16px';
      equipDetailsCol.style.fontWeight = 'bold';
      equipDetailsCol.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
      equipDetailsCol.style.borderRight = '6px solid transparent';
      equipDetailsCol.style.borderImage = `url("${START_PAGE_CONFIG.FRAME_IMAGE_URL}") 6 6 6 6 fill stretch`;
      equipDetailsCol.classList.add('text-whiteHighlight');

      const equipDetailsTitle = document.createElement('h2');
      equipDetailsTitle.className = 'widget-top widget-top-text pixel-font-16';
      equipDetailsTitle.style.margin = '0';
      equipDetailsTitle.style.padding = '2px 8px';
      equipDetailsTitle.style.textAlign = 'center';
      equipDetailsTitle.style.color = 'rgb(255, 255, 255)';
      equipDetailsTitle.style.width = '100%';
      equipDetailsTitle.style.boxSizing = 'border-box';
      equipDetailsTitle.style.marginBottom = '10px';

      const equipDetailsTitleP = document.createElement('p');
      equipDetailsTitleP.className = 'pixel-font-16';
      equipDetailsTitleP.style.margin = '0';
      equipDetailsTitleP.style.padding = '0';
      equipDetailsTitleP.style.textAlign = 'center';
      equipDetailsTitleP.style.color = 'rgb(255, 255, 255)';
      equipDetailsTitleP.style.width = '100%';
      equipDetailsTitleP.style.boxSizing = 'border-box';

      function updateEquipDetailsTitle(name) {
        equipDetailsTitleP.textContent = name || 'Equipment Details';
      }

      updateEquipDetailsTitle();
      equipDetailsTitle.appendChild(equipDetailsTitleP);
      equipDetailsCol.appendChild(equipDetailsTitle);

      const ownedEquipCol = document.createElement('div');
      ownedEquipCol.style.flex = '1 1 0';
      ownedEquipCol.style.height = '100%';
      ownedEquipCol.style.display = 'flex';
      ownedEquipCol.style.flexDirection = 'column';
      ownedEquipCol.style.alignItems = 'center';
      ownedEquipCol.style.justifyContent = 'flex-start';
      ownedEquipCol.style.fontSize = '16px';
      ownedEquipCol.style.fontWeight = 'bold';
      ownedEquipCol.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
      ownedEquipCol.classList.add('text-whiteHighlight');

      const ownedEquipTitle = document.createElement('h2');
      ownedEquipTitle.className = 'widget-top widget-top-text pixel-font-16';
      ownedEquipTitle.style.margin = '0';
      ownedEquipTitle.style.padding = '2px 8px';
      ownedEquipTitle.style.textAlign = 'center';
      ownedEquipTitle.style.color = 'rgb(255, 255, 255)';
      ownedEquipTitle.style.width = '100%';
      ownedEquipTitle.style.boxSizing = 'border-box';
      ownedEquipTitle.style.marginBottom = '10px';

      const ownedEquipTitleP = document.createElement('p');
      ownedEquipTitleP.className = 'pixel-font-16';
      ownedEquipTitleP.style.margin = '0';
      ownedEquipTitleP.style.padding = '0';
      ownedEquipTitleP.style.textAlign = 'center';
      ownedEquipTitleP.style.color = 'rgb(255, 255, 255)';
      ownedEquipTitleP.style.width = '100%';
      ownedEquipTitleP.style.boxSizing = 'border-box';

      function updateOwnedEquipTitle(name, count) {
        if (name && count !== undefined) {
          ownedEquipTitleP.textContent = `Owned ${name} (${count})`;
        } else {
          ownedEquipTitleP.textContent = 'Owned Equipment';
        }
      }

      updateOwnedEquipTitle();
      ownedEquipTitle.appendChild(ownedEquipTitleP);
      ownedEquipCol.appendChild(ownedEquipTitle);

      function updateRightCol() {
        equipDetailsCol.innerHTML = '';
        equipDetailsCol.appendChild(equipDetailsTitle);

        if (!selectedEquipmentLocal) {
          updateEquipDetailsTitle();
          equipDetailsCol.innerHTML += '<div class="' + LAYOUT_CONSTANTS.FONTS.SIZES.BODY + '" style="text-align:center;">Select equipment to view details</div>';
        } else {
          updateEquipDetailsTitle(selectedEquipmentLocal);
          let equipId = null;

          if (window.BestiaryModAPI?.utility?.maps) {
            equipId = window.BestiaryModAPI.utility.maps.equipmentNamesToGameIds.get(selectedEquipmentLocal.toLowerCase());
          }

          if (equipId == null && globalThis.state?.utils?.getEquipment) {
            const utils = globalThis.state.utils;
            for (let i = 1; i < 1000; i++) {
              try {
                const eq = utils.getEquipment(i);
                if (eq?.metadata?.name?.toLowerCase() === selectedEquipmentLocal.toLowerCase()) {
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

        if (!selectedEquipmentLocal) {
          updateOwnedEquipTitle();
          ownedEquipCol.innerHTML += '<div class="' + LAYOUT_CONSTANTS.FONTS.SIZES.BODY + '" style="text-align:center;">Select equipment to view owned</div>';
        } else {
          let equipId = null;

          if (window.BestiaryModAPI?.utility?.maps) {
            equipId = window.BestiaryModAPI.utility.maps.equipmentNamesToGameIds.get(selectedEquipmentLocal.toLowerCase());
          }

          if (equipId == null && globalThis.state?.utils?.getEquipment) {
            const utils = globalThis.state.utils;
            for (let i = 1; i < 1000; i++) {
              try {
                const eq = utils.getEquipment(i);
                if (eq?.metadata?.name?.toLowerCase() === selectedEquipmentLocal.toLowerCase()) {
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

          updateOwnedEquipTitle(selectedEquipmentLocal, owned.length);

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
            headerRow.style.display = 'flex';
            headerRow.style.flexDirection = 'row';
            headerRow.style.width = '100%';
            headerRow.style.gap = '0';

            statTypes.forEach(stat => {
              const col = document.createElement('div');
              col.style.flex = '1 1 0';
              col.style.display = 'flex';
              col.style.flexDirection = 'column';
              col.style.alignItems = 'center';
              col.style.justifyContent = 'flex-start';

              const labelWrap = document.createElement('div');
              labelWrap.style.display = 'flex';
              labelWrap.style.alignItems = 'center';
              labelWrap.style.justifyContent = 'center';
              labelWrap.style.marginTop = '2px';
              labelWrap.style.marginBottom = '2px';

              const icon = document.createElement('img');
              icon.src = statIcons[stat];
              icon.alt = stat.toUpperCase();
              icon.style.width = '22px';
              icon.style.height = '22px';
              icon.style.display = 'inline-block';
              icon.style.marginRight = '4px';
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
            grid.style.display = 'flex';
            grid.style.flexDirection = 'row';
            grid.style.width = '100%';
            grid.style.gap = '0';
            grid.style.overflowY = 'auto';
            grid.style.flex = '1 1 0';
            grid.style.minHeight = '0';
            grid.style.height = 'auto';

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
                tierRow.style.display = 'flex';
                tierRow.style.alignItems = 'center';
                tierRow.style.justifyContent = 'center';
                tierRow.style.gap = '8px';
                tierRow.style.margin = '2px 0';

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

                portrait.style.margin = '0';
                portrait.style.display = 'block';
                tierRow.appendChild(portrait);

                const countLabel = document.createElement('span');
                countLabel.className = count === 0 ? LAYOUT_CONSTANTS.FONTS.SIZES.TINY : LAYOUT_CONSTANTS.FONTS.SIZES.SMALL;
                countLabel.textContent = `x${count}`;

                if (count === 0) {
                  countLabel.style.color = '#888';
                  countLabel.style.opacity = '0.7';
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

      function createEquipmentBox({ title, items }) {
        const box = document.createElement('div');
        box.style.flex = '1 1 0';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.margin = '0';
        box.style.padding = '0';
        box.style.minHeight = '0';
        box.style.height = '100%';

        const titleEl = document.createElement('h2');
        titleEl.className = 'widget-top widget-top-text pixel-font-16';
        titleEl.style.margin = '0';
        titleEl.style.padding = '2px 8px';
        titleEl.style.textAlign = 'center';
        titleEl.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;

        const p = document.createElement('p');
        p.textContent = title;
        p.className = 'pixel-font-16';
        p.style.margin = '0';
        p.style.padding = '0';
        p.style.textAlign = 'center';
        p.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
        titleEl.appendChild(p);
        box.appendChild(titleEl);

        const scrollContainer = api.ui.components.createScrollContainer({
          height: '100%',
          padding: false,
          content: null
        });

        scrollContainer.element.style.flex = '1 1 0';
        scrollContainer.element.style.minHeight = '0';
        scrollContainer.element.style.overflowY = 'scroll';

        items.forEach(name => {
          const item = document.createElement('div');
          item.textContent = name;
          item.className = LAYOUT_CONSTANTS.FONTS.SIZES.BODY;
          item.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
          item.style.cursor = 'pointer';
          item.style.padding = '2px 4px';
          item.style.borderRadius = '2px';
          item.style.textAlign = 'left';

          if (selectedEquipmentLocal && name === selectedEquipmentLocal) {
            item.classList.add('cyclopedia-selected');
            item.style.background = 'rgba(255,255,255,0.18)';
            item.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
            setTimeout(() => updateRightCol(), 0);
          }

          item.addEventListener('mouseenter', () => {
            item.style.background = 'rgba(255,255,255,0.08)';
          });

          item.addEventListener('mouseleave', () => {
            if (!item.classList.contains('cyclopedia-selected')) {
              item.style.background = 'none';
            }
          });

          item.addEventListener('mousedown', () => {
            item.style.background = 'rgba(255,255,255,0.18)';
          });

          item.addEventListener('mouseup', () => {
            if (!item.classList.contains('cyclopedia-selected')) {
              item.style.background = 'rgba(255,255,255,0.08)';
            }
          });

          item.addEventListener('click', () => {
            box.querySelectorAll('.cyclopedia-selected').forEach(el => {
              el.classList.remove('cyclopedia-selected');
              el.style.background = 'none';
              el.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
            });

            item.classList.add('cyclopedia-selected');
            item.style.background = 'rgba(255,255,255,0.18)';
            item.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
            selectedEquipmentLocal = name;
            updateRightCol();
          });

          scrollContainer.contentContainer.appendChild(item);
        });

        box.appendChild(scrollContainer.element);
        return box;
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
      leftCol.style.overflowY = 'scroll';
      leftCol.style.minHeight = '0';

      leftCol.appendChild(createEquipmentBox({
        title: 'Equipment',
        items: allEquipment
      }));

      d.appendChild(leftCol);
      d.appendChild(equipDetailsCol);
      d.appendChild(ownedEquipCol);
      updateRightCol();
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

      const INVENTORY_CONFIG = {
        items: {
          stamina: {
            prefix: 'stamina',
            baseName: 'Stamina Potion',
            tiers: {
              '1': '(Mini)', '2': '(Strong)', '3': '(Great)', '4': '(Ultimate)', '5': '(Supreme)'
            },
            rarity: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' }
          },
          insightStone: {
            prefix: 'insightStone',
            baseName: 'Stone of Insight',
            tiers: {
              '1': '(Glimpse)', '2': '(Awakening)', '3': '(Arcane)', '4': '(Enlightenment)', '5': '(Epiphany)'
            },
            rarity: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' }
          },
          summonScroll: {
            prefix: 'summonScroll',
            baseName: 'Summon Scroll',
            tiers: {
              '1': '(Crude)', '2': '(Ordinary)', '3': '(Refined)', '4': '(Special)', '5': '(Exceptional)'
            },
            rarity: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' }
          },
          diceManipulator: {
            prefix: 'diceManipulator',
            baseName: 'Dice Manipulator',
            tiers: {
              '1': '(Common)', '2': '(Uncommon)', '3': '(Rare)', '4': '(Mythic)', '5': '(Legendary)'
            },
            rarity: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' }
          },
          surpriseCube: {
            prefix: 'surpriseCube',
            baseName: 'Surprise Cube',
            tiers: {
              '2': '(Irregular)', '3': '(Uniform)', '4': '(Precise)', '5': '(Perfect)'
            },
            rarity: { '2': '2', '3': '3', '4': '4', '5': '5' }
          }
        },
        categories: {
          'Consumables': [
            'Change Nickname', 'Dice Manipulators', 'Exaltation Chests', 'Nickname Creature',
            'Outfit Bags', 'Stamina Potions', 'Stones of Insight', 'Summon Scrolls', 'Surprise Cubes'
          ],
          'Currency': ['Beast Coins', 'Dust', 'Gold', 'Hunting Marks'],
          'Upgrades': [
            'Daily Boosted Map', 'Daycare', 'Hy\'genie', 'Monster Cauldron', 'Monster Squeezer',
            'Mountain Fortress', 'Premium', 'The Sweaty Cyclop\'s Forge', 'Yasir\'s Trading Contract'
          ]
        },
        variants: {
          'Change Nickname': ['nicknameChange'],
          'Dice Manipulators': ['diceManipulator1', 'diceManipulator2', 'diceManipulator3', 'diceManipulator4', 'diceManipulator5'],
          'Exaltation Chests': ['equipChest'],
          'Nickname Creature': ['nicknameMonster'],
          'Outfit Bags': ['hunterOutfitBag', 'outfitBag1'],
          'Stamina Potions': ['stamina1', 'stamina2', 'stamina3', 'stamina4', 'stamina5'],
          'Stones of Insight': ['insightStone1', 'insightStone2', 'insightStone3', 'insightStone4', 'insightStone5'],
          'Summon Scrolls': ['summonScroll1', 'summonScroll2', 'summonScroll3', 'summonScroll4', 'summonScroll5'],
          'Surprise Cubes': ['surpriseCube1', 'surpriseCube2', 'surpriseCube3', 'surpriseCube4', 'surpriseCube5'],
          'Beast Coins': ['beastCoins'],
          'Dust': ['dust'],
          'Gold': ['gold'],
          'Hunting Marks': ['huntingMarks'],
          'Daily Boosted Map': ['dailyBoostedMap'],
          'Daycare': ['daycare'],
          'Hy\'genie': ['hygenie'],
          'Monster Cauldron': ['monsterCauldron'],
          'Monster Squeezer': ['monsterSqueezer'],
          'Mountain Fortress': ['mountainFortress'],
          'Premium': ['premium'],
          'The Sweaty Cyclop\'s Forge': ['forge'],
          'Yasir\'s Trading Contract': ['yasirTradingContract']
        },
        staticItems: {
          'beastCoins': { name: 'Beast Coins', rarity: '1' },
          'dust': { name: 'Dust', rarity: '2' },
          'gold': { name: 'Gold', rarity: '3' },
          'huntingMarks': { name: 'Hunting Marks', rarity: '4' },
          'nicknameMonster': { name: 'Nickname Creature', rarity: '3' },
          'nicknameChange': { name: 'Change Nickname', rarity: '2' },
          'nicknamePlayer': { name: 'Player Nickname', rarity: '2' },
          'equipChest': { name: 'Exaltation Chest', rarity: '5' },
          'hunterOutfitBag': { name: 'Hunter Outfit Bag', rarity: '3' },
          'outfitBag1': { name: 'Outfit Bag', rarity: '2' },
          'dailyBoostedMap': { name: 'Daily Boosted Map', rarity: '4' },
          'daycare': { name: 'Daycare', rarity: '3' },
          'hygenie': { name: 'Hy\'genie', rarity: '5' },
          'monsterCauldron': { name: 'Monster Cauldron', rarity: '4' },
          'monsterSqueezer': { name: 'Monster Squeezer', rarity: '3' },
          'mountainFortress': { name: 'Mountain Fortress', rarity: '4' },
          'premium': { name: 'Premium', rarity: '5' },
          'forge': { name: 'The Sweaty Cyclop\'s Forge', rarity: '5' },
          'yasirTradingContract': { name: 'Yasir\'s Trading Contract', rarity: '4' }
        },
        rarityColors: {
          '1': '#9d9d9d',
          '2': '#1eff00',
          '3': '#0070dd',
          '4': '#a335ee',
          '5': '#ff8000'
        },
        rarityText: {
          '1': 'Common',
          '2': 'Uncommon',
          '3': 'Rare',
          '4': 'Epic',
          '5': 'Legendary'
        }
      };

      const getItemInfo = (itemKey) => {
        if (!itemKey) return { displayName: 'Unknown Item', rarity: '1' };

        for (const [type, config] of Object.entries(INVENTORY_CONFIG.items)) {
          if (itemKey.startsWith(config.prefix)) {
            const tier = itemKey.replace(config.prefix, '');
            return {
              displayName: `${config.baseName} ${config.tiers[tier] || `(Tier ${tier})`}`,
              rarity: config.rarity[tier] || '1'
            };
          }
        }

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
          console.warn('[Cyclopedia] Error parsing inventory item:', error);
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
          console.warn('[Cyclopedia] Error clearing inventory cache:', error);
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

      const itemVariants = {
        'Change Nickname': ['nicknameChange'],
        'Dice Manipulators': ['diceManipulator1', 'diceManipulator2', 'diceManipulator3', 'diceManipulator4', 'diceManipulator5'],
        'Exaltation Chests': ['equipChest'],
        'Nickname Creature': ['nicknameMonster'],
        'Outfit Bags': ['hunterOutfitBag', 'outfitBag1'],
        'Stamina Potions': ['stamina1', 'stamina2', 'stamina3', 'stamina4', 'stamina5'],
        'Stones of Insight': ['insightStone1', 'insightStone2', 'insightStone3', 'insightStone4', 'insightStone5'],
        'Summon Scrolls': ['summonScroll1', 'summonScroll2', 'summonScroll3', 'summonScroll4', 'summonScroll5'],
        'Surprise Cubes': ['surpriseCube1', 'surpriseCube2', 'surpriseCube3', 'surpriseCube4', 'surpriseCube5'],
        'Beast Coins': ['beastCoins'],
        'Dust': ['dust'],
        'Gold': ['gold'],
        'Hunting Marks': ['huntingMarks'],
        'Daily Boosted Map': ['dailyBoostedMap'],
        'Daycare': ['daycare'],
        'Hy\'genie': ['hygenie'],
        'Monster Cauldron': ['monsterCauldron'],
        'Monster Squeezer': ['monsterSqueezer'],
        'Mountain Fortress': ['mountainFortress'],
        'Premium': ['premium'],
        'The Sweaty Cyclop\'s Forge': ['forge'],
        'Yasir\'s Trading Contract': ['yasirTradingContract']
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
        console.warn(`[Cyclopedia] Missing description in inventoryTooltips for:`, { itemKey, displayName, keys: Object.keys(inventoryTooltips) });
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
          console.warn(`[Cyclopedia] Missing icon in inventoryTooltips for:`, { itemKey, displayName, keys: Object.keys(inventoryTooltips) });
        }

        if (icon && !icon.startsWith('/assets/icons/') && !icon.startsWith('/assets/misc/') && !icon.startsWith('sprite://')) {
          console.warn(`[Cyclopedia] Icon path may be incorrect for:`, { itemKey, displayName, icon });
        }

        return icon;
      });

      const currencyConfig = {
        gold: {
          uiGetter: getGoldFromUI,
          gameStatePath: 'gold',
          name: 'Gold',
          icon: '/assets/icons/goldpile.png',
          rarity: '1'
        },
        beastCoins: {
          uiGetter: getBeastCoinsFromUI,
          gameStatePath: 'coin',
          name: 'Beast Coins',
          icon: '/assets/icons/beastcoin.png',
          rarity: '2'
        },
        dust: {
          gameStateGetter: getDustFromGameState,
          gameStatePath: 'dust',
          name: 'Dust',
          icon: '/assets/icons/dust.png',
          rarity: '3'
        },
        huntingMarks: {
          uiGetter: getHuntingMarksFromUI,
          gameStateGetter: getHuntingMarksFromGameState,
          apiGetter: getHuntingMarksFromProfileAPI,
          gameStatePath: 'questLog.task.points',
          name: 'Hunting Marks',
          icon: 'sprite://35572',
          rarity: '3'
        }
      };

      const fetchCurrency = async (currencyKey, config) => {
        if (inventory[currencyKey] && inventory[currencyKey].count > 0) {
          return;
        }

        let value = null;

        if (config.uiGetter) {
          value = config.uiGetter();
          if (typeof value === 'number' && !isNaN(value) && value >= 0) {
            // Value found from UI getter
          }
        }

        if ((!value || value === 0) && config.gameStateGetter) {
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

        if ((!value || value === 0) && config.apiGetter) {
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

      const currencyPromises = Object.entries(currencyConfig).map(([key, config]) => 
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
            console.warn('[Cyclopedia] Error rendering variant:', itemKey, error);
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
          if (Object.keys(itemVariants).some(cat => itemVariants[cat].includes(itemKey))) {
            category = Object.keys(itemVariants).find(cat => itemVariants[cat].includes(itemKey));
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
        console.warn(`[Cyclopedia] Missing obtain info in inventoryTooltips for:`, displayName, itemKey);
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
          const items = mainItemCategories[selectedCategory] || [];
          
          const box = createBox({
            title: selectedCategory,
            items: items,
            type: 'inventory',
            selectedCreature: null,
            selectedEquipment: null,
            selectedInventory: selectedInventoryItem,
            setSelectedCreature: () => {},
            setSelectedEquipment: () => {},
            setSelectedInventory: (itemName) => {
              selectedInventoryItem = itemName;
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
            if (itemVariants[selectedInventoryItem]) {
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
        console.warn('[Cyclopedia] Could not subscribe to game state:', error);
      }

      clearInventoryCache();
      updateRightCol();
      
      const cleanupSubscription = () => {
        if (gameStateSubscription && typeof gameStateSubscription === 'function') {
          try {
            gameStateSubscription();
          } catch (error) {
            console.warn('[Cyclopedia] Error cleaning up subscription:', error);
          }
        }
      };

      d._cleanupSubscription = cleanupSubscription;

      d.appendChild(leftCol);
      d.appendChild(rightCol);
      return d;
    }

    const tabPages = [
      (() => createStartPage())(),
      (() => createBestiaryTabPage(selectedCreature, selectedEquipment, selectedInventory, v => { selectedCreature = v; }, v => { selectedEquipment = v; }, v => { selectedInventory = v; }, () => {}))(),
      (() => createEquipmentTabPage(selectedCreature, selectedEquipment, selectedInventory, v => { selectedCreature = v; }, v => { selectedEquipment = v; }, v => { selectedInventory = v; }, () => {}))(),
      (() => createInventoryTabPage(selectedCreature, selectedEquipment, selectedInventory, v => { selectedCreature = v; }, v => { selectedEquipment = v; }, v => { selectedInventory = v; }, () => {}))()
    ];

    const tabNames = ['Home', 'Bestiary', 'Equipment', 'Inventory'];
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
        buttons: []
      });
      
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
          console.warn('[Cyclopedia] Invalid stat configuration:', stat);
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
            console.warn('[Cyclopedia] Failed to load stat icon:', stat.icon);
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

  const dropsSection = document.createElement('div');
  dropsSection.style.height = '50%';
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

  let monsterLocations = [];
  try {
    monsterLocations = findMonsterLocations(name);
  } catch (error) {
  }
  if (monsterLocations.length > 0) {
    function capitalizeRegionName(name) {
      if (!name) return '';
      if (name.toLowerCase() === 'rook') return 'Rookgaard';
      if (name.toLowerCase() === 'abdendriel') return 'Ab\'Dendriel';
      return name.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
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
          roomDiv.style.cursor = 'pointer';
          roomDiv.style.textDecoration = 'underline';
          let foundLoc = foundLocation;
          if (foundLoc) {
            roomDiv.addEventListener('mouseenter', () => {
              roomDiv.style.background = 'rgba(255,255,255,0.08)';
              roomDiv.style.color = '#4a9eff';
            });
            roomDiv.addEventListener('mouseleave', () => {
              roomDiv.style.background = 'none';
              roomDiv.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
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
  perfectCreatures: 66,
  bisEquipments: 87,
  exploredMaps: 62,
  bagOutfits: 192
};

const CYCLOPEDIA_PROGRESS_STATS = [
  { key: 'perfectCreatures', icon: '/assets/icons/enemy.png', max: CYCLOPEDIA_MAX_VALUES.perfectCreatures },
  { key: 'bisEquipments', icon: '/assets/icons/equips.png', max: CYCLOPEDIA_MAX_VALUES.bisEquipments },
  { key: 'exploredMaps', icon: '/assets/icons/map.png', max: CYCLOPEDIA_MAX_VALUES.exploredMaps },
  { key: 'bagOutfits', icon: '/assets/icons/mini-outfitbag.png', max: CYCLOPEDIA_MAX_VALUES.bagOutfits }
];

const CYCLOPEDIA_TRANSLATION = {
  shell: { label: 'Daily Seashell', value: d => d.shell },
  tasks: { label: 'Hunting tasks', value: d => d.tasks },
  playCount: { label: 'Total runs', value: d => d.playCount },
  perfectCreatures: { label: 'Perfect Creatures', value: d => d.perfectMonsters },
  bisEquipments: { label: 'BIS Equipments', value: d => d.bisEquips },
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
  if (loyaltyPoints === '-' || loyaltyPoints === undefined) {
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
    console.log('[Cyclopedia] Setting up UI components...');
    addCyclopediaHeaderButton();
    injectCyclopediaSelectedCss();
    
    console.log('[Cyclopedia] Starting observers...');
    startContextMenuObserver();
    
    console.log('[Cyclopedia] Setting up event handlers...');
    setupEventHandlers();
    
    console.log('[Cyclopedia] Initialization complete');
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

function cleanupCyclopedia() {
  stopContextMenuObserver();
  cleanupAbilityTooltips();
  removeCyclopediaEventListeners();
  const headerUl = document.querySelector('header ul.pixel-font-16.flex.items-center');
  if (headerUl) {
    const btnLi = headerUl.querySelector('li:has(.cyclopedia-header-btn)');
    if (btnLi) btnLi.remove();
  }
}

// =======================
// 10. Exports & Lifecycle Management
// =======================

// Proper exports following mod development guide
exports = {
  init: function() {
    console.log('[Cyclopedia] Initializing mod...');
    try {
      initCyclopedia();
      return true;
    } catch (error) {
      console.error('[Cyclopedia] Initialization error:', error);
      return false;
    }
  },
  
  cleanup: function() {
    console.log('[Cyclopedia] Cleaning up mod...');
    try {
      cleanupCyclopedia();
      return true;
    } catch (error) {
      console.error('[Cyclopedia] Cleanup error:', error);
      return false;
    }
  },
  
  show: function(options) {
    console.log('[Cyclopedia] Opening modal...');
    try {
      return openCyclopediaModal(options);
    } catch (error) {
      console.error('[Cyclopedia] Error opening modal:', error);
      return null;
    }
  },
  
  updateConfig: function(newConfig) {
    console.log('[Cyclopedia] Updating config...');
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
  console.log('[Cyclopedia] Auto-initializing in mod context...');
  exports.init();
}