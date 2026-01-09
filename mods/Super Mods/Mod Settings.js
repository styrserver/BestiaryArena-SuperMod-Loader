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
  maxCreaturesColor: 'prismatic',
  enableMaxShinies: false,
  maxShiniesColor: 'prismatic',
  enableFavorites: false,
  favoriteSymbol: 'heart',
  showSetupLabels: false,
  enableShinyEnemies: false,
  enableAutoplayRefresh: false,
  autoplayRefreshMinutes: 30,
  autoplayRefreshTimerMode: 'autoplay', // 'autoplay', 'internal', or 'both'
  disableAutoReload: false,
  enableAntiIdleSounds: false,
  removeWebsiteFooter: false,
  alwaysOpenHuntAnalyzer: false,
  enablePlayercount: true,
  includeRunDataByDefault: true,
  includeHuntDataByDefault: true,
  inventoryBorderStyle: 'Original',
  vipListInterface: 'modal', // 'modal' or 'panel'
  enableVipListChat: false, // Enable messaging/chat feature in VIP List (controls both VIP List chat and Global Chat)
  vipListMessageFilter: 'all', // 'all' or 'friends' - who can send messages
  betterHighscoresBackgroundOpacity: 1.0, // Opacity for Better Highscores background (0.0 to 1.0)
  enableFirebaseRunsUpload: false, // Enable uploading best runs to Firebase
  firebaseRunsPassword: '', // Encryption password for Firebase runs (stored encrypted)
  autoUploadRuns: false // Automatically upload when new best run is recorded
};

// Storage key for this mod
const STORAGE_KEY = 'better-ui-config';
const FAVORITES_STORAGE_KEY = 'better-ui-favorites';

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
  CURRENCY_CONTAINER: '#header-slot > div > div:first-child',
  CREATURE_IMG: 'img[alt="creature"]',
  STAR_TIER_4: 'img[src*="star-tier-4.png"]',
  RARITY_DIV: '.has-rarity',
  RARITY_TEXT: '.has-rarity-text',
  LEVEL_SPAN: '.pixel-font-16.text-whiteExp span'
};

// Game constants
const GAME_CONSTANTS = {
  MAX_STAT_VALUE: 20,
  MAX_LEVEL: 50,
  MAX_TIER: 4,
  ELITE_RARITY_LEVEL: 6,
  STAMINA_REGEN_MINUTES: 1
};

// Modal dimensions
const MODAL_CONFIG = {
  width: 530,
  height: 350,
  leftColumnWidth: 140,
  rightColumnWidth: 320
};

// Experience table for level calculation
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

// Timeout/Delay settings (in milliseconds)
const TIMEOUT_DELAYS = {
  MENU_CLOSE: 10,
  SUBMENU_HIDE: 100,
  TAB_REAPPLY: 100,
  STATE_VERIFY: 100,
  INIT_RETRY: 500,
  FAVORITES_INIT: 500,
  OBSERVER_RETRY: 1000,
  CONTAINER_DEBOUNCE: 200,
  BROWSER_REFRESH: 1000
};

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

// Observer state
const observers = {
  stamina: null,
  tab: null,
  contextMenu: null,
  creature: null,
  setupLabels: null,
  scrollLock: null
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

// Favorites state
const favoritesState = {
  creatures: new Map(), // Maps uniqueId -> symbolKey
  buttonListeners: new WeakMap(), // Track event listeners on creature buttons
  lastOptimizedUpdate: 0, // Track last optimized favorite update to prevent double-refresh
  lastLoggedResult: null // Track last logged result to prevent duplicate logs
};

// Subscriptions state
const subscriptions = {
  autoplayRefreshGame: null,
  autoplayRefreshSetPlayMode: null
};

// Anti-idle sounds state
let antiIdleAudioElement = null;

// Playercount state
const playercountState = {
  currentPlayerCount: null,
  lastUpdateTime: null,
  updateInterval: null
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

// Favorite symbol options using Bestiary Arena stat icons
const FAVORITE_SYMBOLS = {
  heart: {
    name: 'Heart',
    icon: '❤️'
  },
  hp: {
    name: 'HP',
    icon: 'https://bestiaryarena.com/assets/icons/heal.png'
  },
  attackdamage: {
    name: 'AD',
    icon: 'https://bestiaryarena.com/assets/icons/attackdamage.png'
  },
  abilitypower: {
    name: 'AP',
    icon: 'https://bestiaryarena.com/assets/icons/abilitypower.png'
  },
  attackspeed: {
    name: 'APS',
    icon: 'https://bestiaryarena.com/assets/icons/attackspeed.png'
  },
  armor: {
    name: 'ARM',
    icon: 'https://bestiaryarena.com/assets/icons/armor.png'
  },
  magicresist: {
    name: 'MR',
    icon: 'https://bestiaryarena.com/assets/icons/magicresist.png'
  },
  speed: {
    name: 'SPD',
    icon: 'https://bestiaryarena.com/assets/icons/speed.png'
  },
  shinystar: {
    name: 'Shiny',
    icon: 'https://bestiaryarena.com/assets/icons/shiny-star.png'
  },
  none: {
    name: '(none)',
    icon: null,
    isNone: true
  }
};

// =======================
// 4. Utility Functions
// =======================

// Calculate level from experience points
function getLevelFromExp(exp) {
  if (typeof exp !== 'number' || exp < EXP_TABLE[0][1]) return 1;
  for (let i = EXP_TABLE.length - 1; i >= 0; i--) {
    if (exp >= EXP_TABLE[i][1]) return EXP_TABLE[i][0];
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

function isMaxLevel(levelText) {
  return levelText === GAME_CONSTANTS.MAX_LEVEL.toString();
}

function getCreatureGameId(imgElement) {
  // Match both regular and shiny portraits: /46.png or /46-shiny.png
  const match = imgElement.src.match(/\/(\d+)(?:-shiny)?\.png$/);
  return match ? parseInt(match[1], 10) : null;
}

function isShinyCreature(imgElement) {
  return imgElement.src.includes('-shiny.png');
}

function getPlayerMonsters() {
  return globalThis.state?.player?.getSnapshot()?.context?.monsters || [];
}

function getTier4Monsters() {
  return getPlayerMonsters().filter(
    (m) => m.tier === GAME_CONSTANTS.MAX_TIER
  );
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
// Level 1 (context menus) should still allow favorite button injection
// When unlocked, the attribute is removed (returns null), which evaluates to false
function isScrollLocked() {
  const scrollLocked = document.body.getAttribute('data-scroll-locked');
  return scrollLocked >= '2';
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
  
  return `<div class="has-rarity absolute inset-0 z-1 opacity-80" data-rarity="5" data-max-shinies="true" data-max-shinies-color="${colorKey}" style="${borderStyle}"></div>`;
}

// Expose globally for other mods
window.getInventoryBorderStyle = getInventoryBorderStyle;

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
  }
};

// Get Firebase path for best runs
async function getBestRunsFirebasePath(playerName) {
  const hashedName = await hashUsername(playerName);
  return `${FIREBASE_RUNS_CONFIG.firebaseUrl}/best-runs/${hashedName}`;
}

// Upload runs to Firebase
async function uploadRunsToFirebase(playerName, encryptedData, password) {
  try {
    const path = await getBestRunsFirebasePath(playerName);
    const data = {
      encrypted: encryptedData,
      lastUpdated: Date.now(),
      version: '1.0'
    };
    await FirebaseRunsService.put(path, data, 'upload runs to Firebase');
    console.log('[Mod Settings] Successfully uploaded runs to Firebase');
    return true;
  } catch (error) {
    console.error('[Mod Settings] Error uploading runs to Firebase:', error);
    return false;
  }
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
    console.log('[Mod Settings] Successfully deleted runs from Firebase');
    return true;
  } catch (error) {
    console.error('[Mod Settings] Error deleting runs from Firebase:', error);
    return false;
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

// Helper function to build temp run object for replayLink generation
function buildTempRunForReplayLink(run, contextRegionName) {
  return {
    seed: run.seed,
    mapName: run.mapName,
    mapId: run.mapId,
    regionName: contextRegionName || run.regionName,
    floor: run.floor !== undefined && run.floor !== null ? run.floor : 0,
    setup: run.setup ? {
      pieces: (run.setup.pieces || []).map(piece => ({
        tile: piece.tile,
        monsterName: piece.monsterName,
        monsterId: piece.monsterId,
        equipmentName: piece.equipmentName,
        equipId: piece.equipId,
        level: piece.level
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
    date: bestRun.date,
    mapName: bestRun.mapName,
    replayLink: replayLink
  };
  
  // Add floorTicks if available
  if (bestRun.floorTicks !== undefined && bestRun.floorTicks !== null) {
    cleanRun.floorTicks = bestRun.floorTicks;
  }
  
  return cleanRun;
}

// Helper function to update Firebase status display
function updateFirebaseStatus(statusDiv, message, color = '#7f8fa4') {
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.style.color = color;
  }
}

// Generate $replay link from run data
function generateReplayLink(runData) {
  try {
    if (!runData || !runData.seed) {
      return null;
    }
    
    const board = [];
    if (runData.setup && runData.setup.pieces) {
      runData.setup.pieces.forEach(piece => {
        const boardPiece = {
          tile: piece.tile || 0
        };
        
        // Add monster as object with name and stats
        const monsterName = piece.monsterName || piece.monsterId || 'unknown monster';
        boardPiece.monster = {
          name: monsterName.toLowerCase(),
          level: piece.level || 1,
          hp: piece.monsterStats?.hp || 20,
          ad: piece.monsterStats?.ad || 20,
          ap: piece.monsterStats?.ap || 20,
          armor: piece.monsterStats?.armor || 20,
          magicResist: piece.monsterStats?.magicResist || 20
        };
        
        // Add equipment as object if available
        if (piece.equipmentName || piece.equipId) {
          const equipmentName = piece.equipmentName || piece.equipId || 'unknown equipment';
          boardPiece.equipment = {
            name: equipmentName.toLowerCase(),
            stat: piece.equipmentStat || 'ap',
            tier: piece.equipmentTier || 5
          };
        }
        
        board.push(boardPiece);
      });
    }
    
    // Build replayData in the correct order: region, map, floor, board, seed
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
    
    // Add board
    replayData.board = board;
    
    // Add seed (last)
    replayData.seed = runData.seed;
    
    return `$replay(${JSON.stringify(replayData)})`;
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
        // Map region IDs to proper region names
        const regionNameMap = {
          'rook': 'Rookgaard',
          'carlin': 'Carlin',
          'folda': 'Folda',
          'abdendriel': 'Ab\'Dendriel',
          'kazordoon': 'Kazordoon',
          'venore': 'Venore'
        };
        
        // Create a map of mapKey -> region name
        const mapKeyToRegion = {};
        
        regions.forEach(region => {
          if (!region.rooms) return;
          
          const regionName = region.id ? (regionNameMap[region.id] || region.id.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())) : 'Unknown Region';
          
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
        // Map region IDs to proper region names
        const regionNameMap = {
          'rook': 'Rookgaard',
          'carlin': 'Carlin',
          'folda': 'Folda',
          'abdendriel': 'Ab\'Dendriel',
          'kazordoon': 'Kazordoon',
          'venore': 'Venore'
        };
        
        regions.forEach((region, index) => {
          const regionId = region.id ? (regionNameMap[region.id] || region.id.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())) : null;
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
        text += `SPEEDRUN:\n`;
        text += `  Time: ${bestSpeedrun.time || 'N/A'} ticks\n`;
        text += `  Seed: ${extractSeedFromReplayLink(bestSpeedrun.replayLink)}\n`;
        text += `  Date: ${bestSpeedrun.date || 'N/A'}\n`;
        if (bestSpeedrun.replayLink) {
          text += `  ${bestSpeedrun.replayLink}\n`;
        }
        text += `\n`;
      }
      
      // Rank category
      if (mapData.rank && mapData.rank.length > 0) {
        const bestRank = mapData.rank[0];
        text += `RANK:\n`;
        text += `  Points: ${bestRank.points || 'N/A'}\n`;
        text += `  Time: ${bestRank.time || 'N/A'} ticks\n`;
        text += `  Seed: ${extractSeedFromReplayLink(bestRank.replayLink)}\n`;
        text += `  Date: ${bestRank.date || 'N/A'}\n`;
        if (bestRank.replayLink) {
          text += `  ${bestRank.replayLink}\n`;
        }
        text += `\n`;
      }
      
      // Floor category
      if (mapData.floor && mapData.floor.length > 0) {
        const bestFloor = mapData.floor[0];
        text += `FLOOR:\n`;
        text += `  Floor: ${bestFloor.floor || 'N/A'}\n`;
        if (bestFloor.floorTicks) {
          text += `  Floor Ticks: ${bestFloor.floorTicks} ticks\n`;
        }
        text += `  Seed: ${extractSeedFromReplayLink(bestFloor.replayLink)}\n`;
        text += `  Date: ${bestFloor.date || 'N/A'}\n`;
        if (bestFloor.replayLink) {
          text += `  ${bestFloor.replayLink}\n`;
        }
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

// Upload best runs to Firebase
async function uploadBestRuns() {
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
    
    if (!window.RunTrackerAPI || !window.RunTrackerAPI.getAllRuns) {
      console.error('[Mod Settings] Cannot upload runs: RunTracker not available');
      return { success: false, error: 'RunTracker not available' };
    }
    
    // Get all runs from RunTracker
    const allRuns = window.RunTrackerAPI.getAllRuns();
    
    // Filter to best runs only (top run per map/category)
    // Sort by region and map order before storing
    const bestRuns = {
      runs: {},
      metadata: allRuns.metadata || {},
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
        
        // Map region IDs to proper region names
        const regionNameMap = {
          'rook': 'Rookgaard',
          'carlin': 'Carlin',
          'folda': 'Folda',
          'abdendriel': 'Ab\'Dendriel',
          'kazordoon': 'Kazordoon',
          'venore': 'Venore'
        };
        
        // Iterate through regions in order
        regions.forEach(region => {
          if (!region.rooms) return;
          
          const regionName = region.id ? (regionNameMap[region.id] || region.id.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())) : 'Unknown Region';
          
          region.rooms.forEach(room => {
            const roomId = room.id;
            const roomName = roomNames[roomId] || roomId;
            const mapKey = `map_${roomName.toLowerCase().replace(/\s+/g, '_')}`;
            
            if (allRuns.runs[mapKey]) {
              runsWithRegion.push({
                mapKey: mapKey,
                mapName: roomName,
                regionName: regionName,
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
          regionOrder: 0,
          roomOrder: 0,
          mapData: mapData
        });
      }
    }
    
    // Extract best run from each category for each map (now in sorted order)
    for (const { mapKey, mapData, regionName: contextRegionName } of runsWithRegion) {
      const cleanMapData = {
        speedrun: [],
        rank: [],
        floor: []
      };
      
      // Clean speedrun runs - simplified: generate replayLink and store only essentials
      if (mapData.speedrun && mapData.speedrun.length > 0) {
        const bestSpeedrun = mapData.speedrun[0];
        const cleanSpeedrun = cleanRunForUpload(bestSpeedrun, contextRegionName, {
          time: bestSpeedrun.time
        });
        cleanMapData.speedrun = [cleanSpeedrun];
      }
      
      // Clean rank runs - simplified: generate replayLink and store only essentials
      if (mapData.rank && mapData.rank.length > 0) {
        const bestRank = mapData.rank[0];
        const cleanRank = cleanRunForUpload(bestRank, contextRegionName, {
          points: bestRank.points,
          time: bestRank.time
        });
        cleanMapData.rank = [cleanRank];
      }
      
      // Clean floor runs - simplified: generate replayLink and store only essentials
      if (mapData.floor && mapData.floor.length > 0) {
        const bestFloor = mapData.floor[0];
        const cleanFloor = cleanRunForUpload(bestFloor, contextRegionName, {
          floor: bestFloor.floor,
          floorTicks: bestFloor.floorTicks
        });
        cleanMapData.floor = [cleanFloor];
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
    
    // Encrypt the data
    const encryptedData = await encryptRunsData(bestRuns, config.firebaseRunsPassword);
    
    // Upload to Firebase
    const success = await uploadRunsToFirebase(playerName, encryptedData, config.firebaseRunsPassword);
    
    if (success) {
      // Update last upload time
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
    
    const encryptedData = await fetchRunsFromFirebase(playerName);
    if (!encryptedData || !encryptedData.encrypted) {
      return null;
    }
    
    const decryptedData = await decryptRunsData(encryptedData.encrypted, password);
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
      // Local source - filter to best runs (same as upload logic)
      if (!window.RunTrackerAPI || !window.RunTrackerAPI.getAllRuns) {
        return { success: false, error: 'RunTracker not available' };
      }
      const allRuns = window.RunTrackerAPI.getAllRuns();
      
      // Filter to best runs only (top run per map/category) - same logic as upload
      const bestRuns = {
        runs: {},
        metadata: allRuns.metadata || {},
        playerName: 'local', // Use 'local' for local downloads since it's the user's own data
        uploadedAt: Date.now()
      };
      
      // Extract best run from each category for each map (same logic as upload)
      // First, build a map of mapKey -> regionName (same as upload logic)
      const mapKeyToRegionName = {};
      
      try {
        const regions = globalThis.state?.utils?.REGIONS;
        const roomNames = globalThis.state?.utils?.ROOM_NAME;
        
        if (regions && Array.isArray(regions) && roomNames) {
          // Map region IDs to proper region names
          const regionNameMap = {
            'rook': 'Rookgaard',
            'carlin': 'Carlin',
            'folda': 'Folda',
            'abdendriel': 'Ab\'Dendriel',
            'kazordoon': 'Kazordoon',
            'venore': 'Venore'
          };
          
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
            
            const regionName = region.id ? (regionNameMap[region.id] || region.id.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())) : 'Unknown Region';
            
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
        
        // Get best speedrun (first in sorted array) - clean it like upload does
        if (mapData.speedrun && mapData.speedrun.length > 0) {
          const bestSpeedrun = mapData.speedrun[0];
          // Ensure required fields are present
          if (bestSpeedrun.time !== undefined && bestSpeedrun.time !== null) {
            const cleanSpeedrun = cleanRunForUpload(bestSpeedrun, contextRegionName, {
              time: bestSpeedrun.time
            });
            cleanMapData.speedrun = [cleanSpeedrun];
          }
        }
        
        // Get best rank (first in sorted array) - clean it like upload does
        if (mapData.rank && mapData.rank.length > 0) {
          const bestRank = mapData.rank[0];
          // Ensure required fields are present
          if (bestRank.points !== undefined && bestRank.points !== null) {
            const cleanRank = cleanRunForUpload(bestRank, contextRegionName, {
              points: bestRank.points,
              time: bestRank.time
            });
            cleanMapData.rank = [cleanRank];
          }
        }
        
        // Get best floor (first in sorted array) - clean it like upload does
        if (mapData.floor && mapData.floor.length > 0) {
          const bestFloor = mapData.floor[0];
          // Ensure required fields are present
          if (bestFloor.floor !== undefined && bestFloor.floor !== null && bestFloor.floor > 0) {
            const cleanFloor = cleanRunForUpload(bestFloor, contextRegionName, {
              floor: bestFloor.floor,
              floorTicks: bestFloor.floorTicks
            });
            cleanMapData.floor = [cleanFloor];
          }
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
    document.body.removeChild(a);
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
  }, 10000); // Check every 10 seconds
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
  setTimeout(() => {
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
  
  // Add Hunt Analyzer data info
  if (data.huntAnalyzerData && data.huntAnalyzerData.data) {
    const huntData = data.huntAnalyzerData.data;
    const sessionCount = huntData.sessions ? huntData.sessions.length : 0;
    if (sessionCount > 0) {
      const estimatedSizeKB = Math.round((sessionCount * 864) / 1024);
      summary.push(`Hunt Analyzer: ${sessionCount} sessions (~${formatStorageSize(estimatedSizeKB)})`);
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
      if (window.browserAPI && window.browserAPI.runtime) {
        window.browserAPI.runtime.sendMessage({ action: 'getLocalMods' }, response => {
          if (response && response.success && response.mods && response.mods.length > 0) {
            resolve(response.mods);
          } else {
            // Fallback: try to get mods from current page context
            if (window.localMods && Array.isArray(window.localMods) && window.localMods.length > 0) {
              resolve(window.localMods);
            } else {
              resolve([]);
            }
          }
        });
      } else {
        // Fallback: try to get mods from current page context
        if (window.localMods && Array.isArray(window.localMods) && window.localMods.length > 0) {
          resolve(window.localMods);
        } else {
          resolve([]);
        }
      }
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
        const huntData = localStorage.getItem('huntAnalyzerData');
        const huntState = localStorage.getItem('huntAnalyzerState');
        const huntSettings = localStorage.getItem('huntAnalyzerSettings');
        
        if (huntData || huntState || huntSettings) {
          huntAnalyzerData = {
            data: huntData ? JSON.parse(huntData) : null,
            state: huntState ? JSON.parse(huntState) : null,
            settings: huntSettings ? JSON.parse(huntSettings) : null
          };
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
    document.body.removeChild(a);
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
          
          // Save localMods using background script
          if (window.browserAPI.runtime) {
            await new Promise(resolve => {
              window.browserAPI.runtime.sendMessage({ 
                action: 'registerLocalMods', 
                mods: importData.localMods 
              }, response => {
                resolve();
              });
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
              await window.RunTrackerAPI.importRuns(importData);
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
            if (importData.huntAnalyzerData.data) {
              localStorage.setItem('huntAnalyzerData', JSON.stringify(importData.huntAnalyzerData.data));
            }
            if (importData.huntAnalyzerData.state) {
              localStorage.setItem('huntAnalyzerState', JSON.stringify(importData.huntAnalyzerData.state));
            }
            if (importData.huntAnalyzerData.settings) {
              localStorage.setItem('huntAnalyzerSettings', JSON.stringify(importData.huntAnalyzerData.settings));
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
      document.body.removeChild(input);
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

function loadFavorites() {
  try {
    const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
    console.log('[Mod Settings] Loading favorites from localStorage:', saved);
    if (saved) {
      const data = JSON.parse(saved);
      console.log('[Mod Settings] Parsed favorites data:', data);
      favoritesState.creatures = new Map(Object.entries(data));
      console.log('[Mod Settings] Loaded', favoritesState.creatures.size, 'favorites:', favoritesState.creatures);
    } else {
      console.log('[Mod Settings] No saved favorites found');
    }
  } catch (error) {
    console.error('[Mod Settings] Error loading favorites:', error);
    favoritesState.creatures = new Map();
  }
}

function saveFavorites() {
  try {
    const data = Object.fromEntries(favoritesState.creatures);
    const jsonData = JSON.stringify(data);
    localStorage.setItem(FAVORITES_STORAGE_KEY, jsonData);
    console.log('[Mod Settings] Favorites saved:', favoritesState.creatures.size, 'data:', jsonData);
  } catch (error) {
    console.error('[Mod Settings] Error saving favorites:', error);
  }
}

// Lock creature via API
async function lockCreatureAPI(uniqueId) {
  const requestBody = {
    "0": {
      "json": {
        "locked": true,
        "monsterId": uniqueId
      }
    }
  };
  console.log('[Mod Settings] 📤 Lock API request body:', JSON.stringify(requestBody, null, 2));
  
  const response = await fetch('https://bestiaryarena.com/api/trpc/game.lockMonster?batch=1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Game-Version': '1'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
}

// Update local state for locked creature
function updateLocalCreatureLock(uniqueId) {
  try {
    globalThis.state.player.send({
      type: 'setState',
      fn: (prev) => {
        const monsters = (prev.monsters || []).map(m => 
          m.id === uniqueId ? { ...m, locked: true } : m
        );
        return { ...prev, monsters };
      }
    });
    console.log('[Mod Settings] State update sent via setState');
    
    // Verify and close menu
    scheduleTimeout(() => {
      const monsters = getPlayerMonsters();
      const creature = monsters.find(m => m.id === uniqueId);
      console.log('[Mod Settings] 🔍 Creature AFTER state update:', {
        id: creature?.id,
        gameId: creature?.gameId,
        locked: creature?.locked
      });
      
      if (!creature?.locked) {
        console.error('[Mod Settings] ❌ CRITICAL: Creature is NOT locked after API call and state update!');
      } else {
        console.log('[Mod Settings] ✅ Creature is confirmed locked in local state');
      }
      
      // Close context menu
      const contextMenu = document.querySelector('[role="menu"][data-state="open"]');
      if (contextMenu) {
        document.body.click();
        console.log('[Mod Settings] Context menu closed - right-click again to see updated state');
      }
    }, TIMEOUT_DELAYS.STATE_VERIFY);
  } catch (e) {
    console.error('[Mod Settings] Failed to update state:', e);
    
    // Fallback: direct update
    try {
      const monsters = getPlayerMonsters();
      const creature = monsters.find(m => m.id === uniqueId);
      if (creature) {
        creature.locked = true;
        console.log('[Mod Settings] Fallback: directly updated creature.locked');
      }
    } catch (fallbackError) {
      console.error('[Mod Settings] Fallback also failed:', fallbackError);
    }
  }
}

// Toggle favorite status for a creature with a specific symbol
async function toggleFavorite(uniqueId, symbolKey = 'heart') {
  if (favoritesState.creatures.has(uniqueId)) {
    // If already favorited, update the symbol instead of removing
    favoritesState.creatures.set(uniqueId, symbolKey);
    console.log('[Mod Settings] Updated favorite symbol to', symbolKey + ':', uniqueId);
  } else {
    favoritesState.creatures.set(uniqueId, symbolKey);
    console.log('[Mod Settings] Added to favorites with symbol', symbolKey + ':', uniqueId);
    
    // Log creature state before locking
    const monstersBefore = getPlayerMonsters();
    const creatureBefore = monstersBefore.find(m => m.id === uniqueId);
    console.log('[Mod Settings] 🔍 Creature BEFORE lock API call:', {
      id: creatureBefore?.id,
      gameId: creatureBefore?.gameId,
      locked: creatureBefore?.locked
    });
    
    // Attempt to lock the creature
    try {
      const data = await lockCreatureAPI(uniqueId);
      console.log('[Mod Settings] Lock API response:', data);
      
      // API returns null/undefined but the lock still succeeds
      // No need to verify - the local state update handles it
      
      console.log('[Mod Settings] Locked successfully:', uniqueId);
      updateLocalCreatureLock(uniqueId);
    } catch (error) {
      console.error('[Mod Settings] Failed to lock creature:', error);
      favoritesState.creatures.delete(uniqueId);
      console.log('[Mod Settings] Removed from favorites due to lock failure:', uniqueId);
    }
  }
  
  saveFavorites();
  updateFavoriteHearts(uniqueId);
}

// Create settings event handler for checkboxes
function createSettingsCheckboxHandler(configKey, onEnable, onDisable) {
  return (checkbox) => {
    // Set initial state from config
    checkbox.checked = config[configKey];
    
    checkbox.addEventListener('change', () => {
      config[configKey] = checkbox.checked;
      saveConfig();
      
      if (config[configKey]) {
        onEnable?.();
      } else {
        onDisable?.();
      }
      
      console.log('[Mod Settings] Setting updated:', { [configKey]: config[configKey] });
    });
  };
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
    // Create main content container with tabs
    const content = document.createElement('div');
    
    // Apply sizing and layout styles to content (matching Autoscroller pattern)
    const contentWidth = MODAL_CONFIG.width - 30;
    Object.assign(content.style, {
      width: '100%',
      height: '100%',
      minWidth: `${contentWidth}px`,
      maxWidth: `${contentWidth}px`,
      minHeight: `${MODAL_CONFIG.height}px`,
      maxHeight: `${MODAL_CONFIG.height}px`,
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      border: '6px solid transparent',
      borderImage: 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill',
      backgroundImage: 'url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png")',
      padding: '8px'
    });
    
    // Create main content container with 2-column layout
    const mainContent = document.createElement('div');
    Object.assign(mainContent.style, {
      display: 'flex',
      flexDirection: 'row',
      gap: '8px',
      height: '100%',
      flex: '1 1 0'
    });
    
    // Left column - Options
    const leftColumn = document.createElement('div');
    Object.assign(leftColumn.style, {
      width: `${MODAL_CONFIG.leftColumnWidth}px`,
      minWidth: `${MODAL_CONFIG.leftColumnWidth}px`,
      maxWidth: `${MODAL_CONFIG.leftColumnWidth}px`,
      height: '100%',
      flex: `0 0 ${MODAL_CONFIG.leftColumnWidth}px`,
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
      width: `${MODAL_CONFIG.rightColumnWidth}px`,
      minWidth: `${MODAL_CONFIG.rightColumnWidth}px`,
      maxWidth: `${MODAL_CONFIG.rightColumnWidth}px`,
      flex: `0 0 ${MODAL_CONFIG.rightColumnWidth}px`,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      overflowY: 'auto',
      padding: '2px'
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
    
    // Create menu items for left column
    let menuItems = [
      { id: 'creatures', label: t('mods.betterUI.menuCreatures'), selected: true },
      { id: 'ui', label: t('mods.betterUI.menuUI'), selected: false },
      { id: 'mod-coordination', label: t('mods.betterUI.menuModCoordination'), selected: false },
      { id: 'advanced', label: t('mods.betterUI.menuAdvanced'), selected: false },
      { id: 'backup', label: t('mods.betterUI.menuBackup'), selected: false }
    ];

    // Check if Hunt Analyzer mod is enabled and add the tab if it is
    const huntAnalyzerMod = window.localMods.find(mod => mod.name === 'Super Mods/Hunt Analyzer.js');
    if (huntAnalyzerMod?.enabled) {
      // Insert Hunt Analyzer tab after ui
      menuItems.splice(2, 0, { id: 'hunt-analyzer', label: t('mods.betterUI.menuHuntAnalyzer'), selected: false });
    }

    // Check if VIP List mod is enabled and add the tab if it is
    const vipListMod = window.localMods.find(mod => mod.name === 'OT Mods/VIP List.js');
    if (vipListMod?.enabled) {
      // Insert VIP List tab after hunt-analyzer (or after ui if hunt-analyzer is not enabled)
      const insertPosition = huntAnalyzerMod?.enabled ? 3 : 2;
      menuItems.splice(insertPosition, 0, { id: 'vip-list', label: t('mods.betterUI.menuVipList'), selected: false });
    }
    
    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'menu-item pixel-font-16';
      menuItem.dataset.category = item.id;
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
        // Update menu selection
        menuItems.forEach(mi => {
          const miElement = leftColumn.querySelector(`[data-category="${mi.id}"]`);
          if (miElement) {
            applyMenuItemStyle(miElement, mi.id === item.id);
          }
        });
        
        // Update right column content
        updateRightColumn(item.id);
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
    
    // Function to update right column content based on selected category
    function updateRightColumn(categoryId) {
      rightColumn.innerHTML = '';
      
      if (categoryId === 'ui') {
        const uiContent = document.createElement('div');
        uiContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="stamina-timer-toggle" checked="" style="transform: scale(1.2);">
              <span>${t('mods.betterUI.showStaminaTimer')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="setup-labels-toggle" checked="" style="transform: scale(1.2);">
              <span>${t('mods.betterUI.showSetupLabels')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="playercount-toggle" style="transform: scale(1.2);">
              <span>${t('mods.betterUI.showPlayersOnline')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="remove-footer-toggle" style="transform: scale(1.2);">
              <span>${t('mods.betterUI.hideWebsiteFooter')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
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
          <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span style="color: #ccc; min-width: 200px;">${t('mods.betterUI.betterHighscoresBackgroundOpacity')}</span>
            <input type="range" id="better-highscores-opacity-slider" min="0" max="100" value="100" step="1" style="flex: 1; min-width: 150px; max-width: 300px; cursor: pointer;" onclick="event.stopPropagation();">
            <span id="better-highscores-opacity-value" style="color: #ccc; min-width: 40px; text-align: right;">100%</span>
          </div>
        `;
        rightColumn.appendChild(uiContent);
      } else if (categoryId === 'creatures') {
        const creaturesContent = document.createElement('div');
        creaturesContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="favorites-toggle" checked="" style="transform: scale(1.2);">
              <span>${t('mods.betterUI.enableFavorites')}</span>
            </label>
          </div>
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
              <span style="cursor: help; font-size: 16px; color: #ffaa00;" title="${t('mods.betterUI.shinyEnemiesWarning')}">${t('mods.betterUI.shinyEnemies')}</span>
            </label>
          </div>
        `;
        rightColumn.appendChild(creaturesContent);
      } else if (categoryId === 'advanced') {
        // Read Bestiary Automator config values BEFORE creating HTML to ensure correct initial state
        let useApiForStaminaRefill = false;
        let persistAutoRefill = false;
        let thresholdsEnabled = true; // Default to true as per Bestiary Automator config
        try {
          const automatorConfig = localStorage.getItem('bestiary-automator-config');
          const parsedConfig = automatorConfig ? JSON.parse(automatorConfig) : {};
          useApiForStaminaRefill = parsedConfig.useApiForStaminaRefill || false;
          persistAutoRefill = parsedConfig.persistAutoRefillOnRefresh || false;
          thresholdsEnabled = parsedConfig.thresholdsEnabled !== false; // Default to true if not set
        } catch (error) {
          console.error('[Mod Settings] Error reading Bestiary Automator config for HTML:', error);
        }
        
        const advancedContent = document.createElement('div');
        advancedContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; cursor: pointer;">
              <input type="checkbox" id="autoplay-refresh-toggle" checked="" style="transform: scale(1.2);">
              <span style="cursor: help; font-size: 16px; color: #ffaa00;" title="${t('mods.betterUI.autoplayRefreshWarning')}">⚠️</span>
              <select id="autoplay-refresh-timer-mode" style="width: fit-content; background: #333; color: #ccc; border: 1px solid #555; padding: 4px 20px 4px 10px; border-radius: 4px; pointer-events: auto;" title="${t('mods.betterUI.autoplayRefreshTimerModeWarning')}" onclick="event.stopPropagation();">
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
              <span style="cursor: help; font-size: 16px; color: #ffaa00;" title="${t('mods.betterUI.persistAutomatorAutoRefillWarning')}">${t('mods.betterUI.persistAutomatorAutoRefill')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; ${thresholdsEnabled ? 'cursor: not-allowed; opacity: 0.5;' : 'cursor: pointer;'}">
              <input type="checkbox" id="automator-api-stamina-refill-toggle" ${useApiForStaminaRefill ? 'checked' : ''} ${thresholdsEnabled ? 'disabled title="Cannot disable while thresholds are enabled in Bestiary Automator settings"' : ''} style="transform: scale(1.2);">
              <span style="cursor: help; font-size: 16px; color: #ffaa00;" title="${thresholdsEnabled ? t('mods.betterUI.useApiForStaminaRefillWarning') + ' (Disabled while thresholds are enabled in Bestiary Automator)' : t('mods.betterUI.useApiForStaminaRefillWarning')}">⚠️ ${t('mods.betterUI.useApiForStaminaRefill')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="disable-auto-reload-toggle" style="transform: scale(1.2);">
              <span style="cursor: help; font-size: 16px; color: #ffaa00;" title="${t('mods.betterUI.disableAutoReloadWarning')}">${t('mods.betterUI.disableAutoReload')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="anti-idle-sounds-toggle" style="transform: scale(1.2);">
              <span style="cursor: help; font-size: 16px; color: #ffaa00;" title="${t('mods.betterUI.antiIdleTooltip')}">${t('mods.betterUI.antiIdleLabel')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="run-tracker-toggle" style="transform: scale(1.2);">
              <span style="cursor: help; font-size: 16px; color: #ffaa00;" title="${t('mods.betterUI.disableRunTrackerWarning')}">${t('mods.betterUI.disableRunTracker')}</span>
            </label>
          </div>
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="margin-bottom: 15px;">
              <h4 style="margin: 0 0 15px 0; color: #ffaa00; font-size: 14px; cursor: help;" title="Upload your best runs to Firebase with password encryption. Other players can fetch and download your runs using your player name and password. Runs are encrypted client-side before upload, ensuring privacy. You can also download runs as .txt files with $replay links for easy sharing.">⚠️ Firebase Best Runs Upload</h4>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="firebase-runs-upload-toggle" style="transform: scale(1.2);">
                <span style="color: #ccc;">Upload best runs to Firebase</span>
              </label>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="auto-upload-runs-toggle" style="transform: scale(1.2);">
                <span style="color: #ccc;">Auto-upload when new best run is recorded</span>
              </label>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: flex; flex-direction: column; gap: 5px;">
                <span style="color: #ccc; font-size: 13px;">Encryption Password (5-20 characters):</span>
                <input type="password" id="firebase-runs-password" placeholder="Enter password (5-20 characters)" maxlength="20" style="width: 100%; padding: 6px; border: 1px solid #555; background: #2a2a2a; color: #fff; border-radius: 4px; pointer-events: auto;" onclick="event.stopPropagation();">
              </label>
            </div>
            <div style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
              <button id="upload-runs-btn" class="btn btn-primary" style="flex: 1 1 0%; min-width: 100px; pointer-events: auto; opacity: 0.5; cursor: not-allowed;" disabled onclick="event.stopPropagation();">
                Upload Now
              </button>
              <button id="download-runs-btn" class="btn btn-secondary" style="flex: 1 1 0%; min-width: 100px; pointer-events: auto;" onclick="event.stopPropagation();">
                Download as .txt
              </button>
              <button id="delete-runs-btn" class="btn btn-secondary" style="flex: 1 1 0%; min-width: 100px; pointer-events: auto; background: #dc3545; border-color: #dc3545;" onclick="event.stopPropagation();">
                Delete Runs
              </button>
            </div>
            <div id="firebase-runs-status" style="margin-top: 10px; font-size: 12px; color: #7f8fa4; min-height: 20px;">
            </div>
          </div>
        `;
        rightColumn.appendChild(advancedContent);
      } else if (categoryId === 'hunt-analyzer') {
        const huntAnalyzerContent = document.createElement('div');
        huntAnalyzerContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="hunt-analyzer-persist-toggle" style="transform: scale(1.2);">
              <span style="cursor: help; font-size: 16px; color: #ffaa00;" title="${t('mods.betterUI.huntPersistTooltip')}">${t('mods.betterUI.huntPersistLabel')}</span>
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
            
            // Store unsubscribe functions for cleanup (if needed)
            modCoordinationContent._unsubscribers = [unsubscribeEnabled, unsubscribeActive];
          }
        }, 0);
      } else if (categoryId === 'backup') {
        const backupContent = document.createElement('div');
        backupContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <h3 style="margin-bottom: 10px; color: #fff; font-size: 14px;">${t('mods.betterUI.backupExportOptions')}</h3>
            
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;">
              <input type="checkbox" id="export-run-data" checked style="cursor: pointer; transform: scale(1.2);">
              <span>${t('mods.betterUI.backupIncludeRunData')}</span>
            </label>
            <div id="run-data-info" style="margin-left: 28px; margin-bottom: 10px; font-size: 12px; color: #7f8fa4; display: none;">
            </div>
            
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;">
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
    
      const rainbowCheckbox = content.querySelector('#rainbow-tiers-toggle');
      if (rainbowCheckbox) {
        createSettingsCheckboxHandler('enableMaxCreatures', applyMaxCreatures, removeMaxCreatures)(rainbowCheckbox);
      }
      
      const colorPicker = content.querySelector('#color-picker');
      if (colorPicker) {
        createSettingsDropdownHandler('maxCreaturesColor', () => {
          if (config.enableMaxCreatures) applyMaxCreatures();
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
        })(shinyColorPicker);
      }
      
      const favoritesCheckbox = content.querySelector('#favorites-toggle');
      if (favoritesCheckbox) {
        createSettingsCheckboxHandler('enableFavorites',
          updateFavoriteHearts,
          removeFavoriteHearts
        )(favoritesCheckbox);
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
      
      const removeFooterCheckbox = content.querySelector('#remove-footer-toggle');
      if (removeFooterCheckbox) {
        createSettingsCheckboxHandler('removeWebsiteFooter',
          hideWebsiteFooter,
          showWebsiteFooter
        )(removeFooterCheckbox);
      }
      
      const inventoryBorderStyleSelector = content.querySelector('#inventory-border-style-selector');
      if (inventoryBorderStyleSelector) {
        createSettingsDropdownHandler('inventoryBorderStyle')(inventoryBorderStyleSelector);
      }
      
      const betterHighscoresOpacitySlider = content.querySelector('#better-highscores-opacity-slider');
      const betterHighscoresOpacityValue = content.querySelector('#better-highscores-opacity-value');
      if (betterHighscoresOpacitySlider && betterHighscoresOpacityValue) {
        // Set initial value from config (convert from 0-1 to 0-100)
        const initialValue = Math.round((config.betterHighscoresBackgroundOpacity || 1.0) * 100);
        betterHighscoresOpacitySlider.value = initialValue;
        betterHighscoresOpacityValue.textContent = `${initialValue}%`;
        
        betterHighscoresOpacitySlider.addEventListener('input', () => {
          const opacityValue = parseInt(betterHighscoresOpacitySlider.value) / 100;
          config.betterHighscoresBackgroundOpacity = opacityValue;
          saveConfig();
          betterHighscoresOpacityValue.textContent = `${betterHighscoresOpacitySlider.value}%`;
          
          // Update Better Highscores mod if available
          if (window.BetterHighscores && typeof window.BetterHighscores.updateOpacity === 'function') {
            window.BetterHighscores.updateOpacity(opacityValue);
          } else if (window.BetterHighscores && window.BetterHighscores.updateLeaderboards) {
            // Fallback: trigger a full update to apply new opacity
            window.BetterHighscores.updateLeaderboards();
          }
          
          console.log('[Mod Settings] Better Highscores background opacity updated:', opacityValue);
        });
      }
      
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
      
      const automatorApiStaminaRefillCheckbox = content.querySelector('#automator-api-stamina-refill-toggle');
      if (automatorApiStaminaRefillCheckbox) {
        // Function to update checkbox state based on thresholds
        const updateCheckboxState = () => {
          try {
            const automatorConfig = localStorage.getItem('bestiary-automator-config');
            const config = automatorConfig ? JSON.parse(automatorConfig) : {};
            const thresholdsEnabled = config.thresholdsEnabled !== false;
            const label = automatorApiStaminaRefillCheckbox.closest('label');

            if (thresholdsEnabled) {
              automatorApiStaminaRefillCheckbox.disabled = true;
              automatorApiStaminaRefillCheckbox.checked = true; // Force checked when thresholds enabled
              automatorApiStaminaRefillCheckbox.title = 'Cannot disable while thresholds are enabled in Bestiary Automator settings';
              label.style.cursor = 'not-allowed';
              label.style.opacity = '0.5';
              label.querySelector('span').title = t('mods.betterUI.useApiForStaminaRefillWarning') + ' (Disabled while thresholds are enabled in Bestiary Automator)';
            } else {
              automatorApiStaminaRefillCheckbox.disabled = false;
              automatorApiStaminaRefillCheckbox.checked = config.useApiForStaminaRefill || false;
              automatorApiStaminaRefillCheckbox.title = ''; // Clear the title when enabled
              label.style.cursor = 'pointer';
              label.style.opacity = '1';
              label.querySelector('span').title = t('mods.betterUI.useApiForStaminaRefillWarning');
            }
          } catch (error) {
            console.error('[Mod Settings] Error updating checkbox state:', error);
          }
        };

        // Set initial state
        updateCheckboxState();

        automatorApiStaminaRefillCheckbox.addEventListener('change', () => {
          const newValue = automatorApiStaminaRefillCheckbox.checked;

          // Write directly to Bestiary Automator's localStorage
          try {
            const automatorConfig = localStorage.getItem('bestiary-automator-config');
            const config = automatorConfig ? JSON.parse(automatorConfig) : {};
            config.useApiForStaminaRefill = newValue;
            localStorage.setItem('bestiary-automator-config', JSON.stringify(config));
            console.log('[Mod Settings] Updated Bestiary Automator localStorage useApiForStaminaRefill:', newValue);
          } catch (error) {
            console.error('[Mod Settings] Error updating Bestiary Automator config:', error);
          }

          // Also update runtime if Bestiary Automator is loaded
          if (window.bestiaryAutomator && typeof window.bestiaryAutomator.updateConfig === 'function') {
            window.bestiaryAutomator.updateConfig({
              useApiForStaminaRefill: newValue
            });
            console.log('[Mod Settings] Updated Bestiary Automator runtime config');
          }
        });

        // Listen for changes to Bestiary Automator config (in case thresholds are toggled)
        const checkForConfigChanges = () => {
          updateCheckboxState();
        };

        // Check for config changes every second while modal is open
        const configCheckInterval = setInterval(checkForConfigChanges, 1000);

        // Clear interval when modal closes
        const modal = content.closest('.modal');
        if (modal) {
          const observer = new MutationObserver(() => {
            if (!document.contains(modal)) {
              clearInterval(configCheckInterval);
              observer.disconnect();
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
        }
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
      
      const firebaseRunsPasswordInput = content.querySelector('#firebase-runs-password');
      const uploadRunsBtn = content.querySelector('#upload-runs-btn');
      const statusDiv = content.querySelector('#firebase-runs-status');
      
      // Function to update upload button and checkbox states
      const updateUploadButtonState = () => {
        const hasPassword = config.firebaseRunsPassword && config.firebaseRunsPassword.length >= 5;
        
        if (uploadRunsBtn) {
          uploadRunsBtn.disabled = !hasPassword;
          uploadRunsBtn.style.opacity = hasPassword ? '1' : '0.5';
          uploadRunsBtn.style.cursor = hasPassword ? 'pointer' : 'not-allowed';
          uploadRunsBtn.title = hasPassword ? '' : 'Please set a password (5-20 characters) first';
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
      };
      
      if (firebaseRunsPasswordInput) {
        // Don't show the actual password, but show if one is set
        if (config.firebaseRunsPassword) {
          firebaseRunsPasswordInput.placeholder = 'Password set (enter new to change)';
        } else {
          firebaseRunsPasswordInput.placeholder = 'Enter password (5-20 characters)';
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
            updateFirebaseStatus(statusDiv, 'Password must be at least 5 characters', '#dc3545');
            firebaseRunsPasswordInput.focus();
            return;
          }
          
          if (password.length > 20) {
            updateFirebaseStatus(statusDiv, 'Password must be at most 20 characters', '#dc3545');
            firebaseRunsPasswordInput.focus();
            return;
          }
          
          // Check if password is changing (not first time setting)
          const passwordChanged = config.firebaseRunsPassword && config.firebaseRunsPassword !== password;
          
          // Password is valid, save it
          config.firebaseRunsPassword = password;
          saveConfig();
          firebaseRunsPasswordInput.placeholder = 'Password set (enter new to change)';
          firebaseRunsPasswordInput.value = '';
          
          // Update upload button state
          updateUploadButtonState();
          
          // If password changed and upload is enabled, re-upload to Firebase with new password
          if (passwordChanged && config.enableFirebaseRunsUpload) {
            updateFirebaseStatus(statusDiv, 'Password changed. Re-uploading to Firebase...', '#7f8fa4');
            
            // Re-upload with new password
            uploadBestRuns().then(result => {
              if (result.success) {
                const date = formatEUDateTime(config.lastFirebaseRunsUpload);
                updateFirebaseStatus(statusDiv, `Password changed and re-uploaded: ${date}`, '#4ade80');
              } else {
                updateFirebaseStatus(statusDiv, `Password saved, but re-upload failed: ${result.error || 'Unknown error'}`, '#ffaa00');
              }
            }).catch(error => {
              console.error('[Mod Settings] Error re-uploading after password change:', error);
              updateFirebaseStatus(statusDiv, 'Password saved, but re-upload failed', '#ffaa00');
            });
          } else {
            // Clear status or show success
            updateFirebaseStatus(statusDiv, 'Password saved', '#4ade80');
            setTimeout(() => {
              if (statusDiv && statusDiv.textContent === 'Password saved') {
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
            updateFirebaseStatus(statusDiv, 'Error: Password not set or invalid', '#dc3545');
            return;
          }
          
          updateFirebaseStatus(statusDiv, 'Uploading...', '#7f8fa4');
          
          const result = await uploadBestRuns();
          if (result.success) {
            const date = formatEUDateTime(config.lastFirebaseRunsUpload);
            updateFirebaseStatus(statusDiv, `Last uploaded: ${date}`, '#4ade80');
          } else {
            updateFirebaseStatus(statusDiv, `Error: ${result.error || 'Upload failed'}`, '#dc3545');
          }
        });
      }
      
      const downloadRunsBtn = content.querySelector('#download-runs-btn');
      if (downloadRunsBtn) {
        downloadRunsBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Ask user for source
          const source = confirm('Download from Firebase? (Cancel for local)') ? 'firebase' : 'local';
          
          if (source === 'firebase') {
            // Single prompt for both username and password
            const input = prompt('Enter player name and password:\nFormat: PlayerName:Password\n\nExample: MyPlayer:test123');
            
            if (!input) {
              updateFirebaseStatus(statusDiv, 'Download cancelled', '#7f8fa4');
              return;
            }
            
            // Parse input (format: PlayerName:Password)
            const parts = input.split(':');
            if (parts.length !== 2) {
              updateFirebaseStatus(statusDiv, 'Error: Invalid format. Use PlayerName:Password', '#dc3545');
              return;
            }
            
            const playerName = parts[0].trim();
            const password = parts[1].trim();
            
            if (!playerName || !password) {
              updateFirebaseStatus(statusDiv, 'Error: Player name and password are required', '#dc3545');
              return;
            }
            
            updateFirebaseStatus(statusDiv, 'Downloading from Firebase...', '#7f8fa4');
            
            const result = await downloadRunsAsTxt(playerName, password, 'firebase');
            if (result.success) {
              updateFirebaseStatus(statusDiv, 'Downloaded successfully', '#4ade80');
            } else {
              updateFirebaseStatus(statusDiv, `Error: ${result.error || 'Download failed'}`, '#dc3545');
            }
          } else {
            updateFirebaseStatus(statusDiv, 'Downloading local runs...', '#7f8fa4');
            
            const result = await downloadRunsAsTxt(null, null, 'local');
            if (result.success) {
              updateFirebaseStatus(statusDiv, 'Downloaded successfully', '#4ade80');
            } else {
              updateFirebaseStatus(statusDiv, `Error: ${result.error || 'Download failed'}`, '#dc3545');
            }
          }
        });
      }
      
      const deleteRunsBtn = content.querySelector('#delete-runs-btn');
      if (deleteRunsBtn) {
        deleteRunsBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const playerName = getCurrentPlayerName();
          if (!playerName) {
            updateFirebaseStatus(statusDiv, 'Error: Player name not found', '#dc3545');
            return;
          }
          
          updateFirebaseStatus(statusDiv, 'Deleting...', '#7f8fa4');
          
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
              firebaseRunsPasswordInput.placeholder = 'Enter password (5-20 characters)';
              firebaseRunsPasswordInput.value = '';
            }
            
            // Update button states
            updateUploadButtonState();
            
            updateFirebaseStatus(statusDiv, 'Runs deleted successfully. Settings reset.', '#4ade80');
          } else {
            updateFirebaseStatus(statusDiv, 'Error: Failed to delete runs', '#dc3545');
          }
        });
      }
      
      // Update status on load
      if (statusDiv && config.lastFirebaseRunsUpload) {
        const date = formatEUDateTime(config.lastFirebaseRunsUpload);
        updateFirebaseStatus(statusDiv, `Last uploaded: ${date}`, '#4ade80');
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
            // Stop updates
            if (playercountState.updateInterval) {
              clearInterval(playercountState.updateInterval);
              activeTimeouts.delete(playercountState.updateInterval);
              playercountState.updateInterval = null;
            }
            // Remove button
            const btn = document.querySelector('.playercount-header-btn');
            if (btn && btn.parentNode) {
              btn.parentNode.remove();
            }
          }
        });
      }
      
      // Hunt Analyzer settings
      const huntAnalyzerPersistCheckbox = content.querySelector('#hunt-analyzer-persist-toggle');
      if (huntAnalyzerPersistCheckbox) {
        // Load current Hunt Analyzer settings
        try {
          const huntAnalyzerSettings = localStorage.getItem('huntAnalyzerSettings');
          const parsedSettings = huntAnalyzerSettings ? JSON.parse(huntAnalyzerSettings) : {};
          huntAnalyzerPersistCheckbox.checked = parsedSettings.persistData || false;
        } catch (error) {
          console.error('[Mod Settings] Error reading Hunt Analyzer settings:', error);
        }
        
        huntAnalyzerPersistCheckbox.addEventListener('change', () => {
          const newValue = huntAnalyzerPersistCheckbox.checked;
          
          // Update Hunt Analyzer settings in localStorage
          try {
            const huntAnalyzerSettings = localStorage.getItem('huntAnalyzerSettings');
            const settings = huntAnalyzerSettings ? JSON.parse(huntAnalyzerSettings) : {};
            settings.persistData = newValue;
            localStorage.setItem('huntAnalyzerSettings', JSON.stringify(settings));
            console.log('[Mod Settings] Updated Hunt Analyzer persistData:', newValue);
            
            // If turning OFF persistence, clear the persisted data
            if (!newValue) {
              localStorage.removeItem('huntAnalyzerData');
            }
          } catch (error) {
            console.error('[Mod Settings] Error updating Hunt Analyzer settings:', error);
          }
          
          // Also update runtime if Hunt Analyzer is loaded
          if (window.HuntAnalyzerState && window.HuntAnalyzerState.settings) {
            window.HuntAnalyzerState.settings.persistData = newValue;
          }
        });
      }
      
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
        try {
          const huntAnalyzerSettings = localStorage.getItem('huntAnalyzerSettings');
          const parsedSettings = huntAnalyzerSettings ? JSON.parse(huntAnalyzerSettings) : {};
          huntAnalyzerThemeSelector.value = parsedSettings.theme || 'original';
        } catch (error) {
          console.error('[Mod Settings] Error reading Hunt Analyzer theme:', error);
        }
        
        huntAnalyzerThemeSelector.addEventListener('change', () => {
          const newTheme = huntAnalyzerThemeSelector.value;
          
          // Update Hunt Analyzer settings in localStorage
          try {
            const huntAnalyzerSettings = localStorage.getItem('huntAnalyzerSettings');
            const settings = huntAnalyzerSettings ? JSON.parse(huntAnalyzerSettings) : {};
            settings.theme = newTheme;
            localStorage.setItem('huntAnalyzerSettings', JSON.stringify(settings));
            console.log('[Mod Settings] Updated Hunt Analyzer theme:', newTheme);
          } catch (error) {
            console.error('[Mod Settings] Error updating Hunt Analyzer theme:', error);
          }
          
          // Also update runtime if Hunt Analyzer is loaded
          if (window.HuntAnalyzerState && window.HuntAnalyzerState.settings) {
            window.HuntAnalyzerState.settings.theme = newTheme;
            console.log('[Mod Settings] Updated Hunt Analyzer runtime theme');
            
            // Call applyTheme function if available for immediate update
            if (window.applyHuntAnalyzerTheme && typeof window.applyHuntAnalyzerTheme === 'function') {
              window.applyHuntAnalyzerTheme(newTheme, true);
              console.log('[Mod Settings] Applied Hunt Analyzer theme immediately');
            }
          }
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
              const sessionCount = parsed.sessions ? parsed.sessions.length : 0;
              if (sessionCount > 0) {
                const estimatedSizeKB = Math.round((sessionCount * 864) / 1024);
                huntAnalyzerInfo.style.display = 'block';
                huntAnalyzerInfo.textContent = tReplace('mods.betterUI.backupFoundSessions', {
                  sessions: sessionCount,
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
    }
    
    // Attach event handlers to the initial content
    attachEventHandlers(content);
    
    // Store modal reference for button handlers
    let modalRef = null;
    
    // Create modal using the API
    modalRef = api.ui.components.createModal({
      title: t('mods.betterUI.settingsTitle'),
      width: MODAL_CONFIG.width,
      height: MODAL_CONFIG.height,
      content: content,
      buttons: [
        {
          text: t('common.close'),
          primary: true,
          closeOnClick: true,
          onClick: () => {
            console.log('[Mod Settings] Settings modal closed');
          }
        }
      ]
    });
    
    // Set static size for the modal dialog (non-resizable)
    scheduleTimeout(() => {
      const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
      if (dialog) {
        dialog.style.width = `${MODAL_CONFIG.width}px`;
        dialog.style.minWidth = `${MODAL_CONFIG.width}px`;
        dialog.style.maxWidth = `${MODAL_CONFIG.width}px`;
        dialog.style.height = `${MODAL_CONFIG.height}px`;
        dialog.style.minHeight = `${MODAL_CONFIG.height}px`;
        dialog.style.maxHeight = `${MODAL_CONFIG.height}px`;
        dialog.classList.remove('max-w-[300px]');
        
        // Style the content wrapper for proper flexbox layout
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
        }
      }
    }, 0);
    
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

// =======================
// 6. Favorite Creatures Functions
// =======================

// Get creature name from context menu
function getCreatureNameFromMenu(menuElem) {
  // Look for the group element (like Cyclopedia does)
  const group = menuElem.querySelector('div[role="group"]');
  if (!group) {
    return null;
  }
  
  // Get first item from the group
  const firstItem = group.querySelector('.dropdown-menu-item');
  if (!firstItem) {
    return null;
  }
  
  const text = firstItem.textContent;
  
  // Check for monster pattern: "Monster Name (X%)"
  const monsterMatch = text.match(/^(.*?)\s*\(\d+%\)/);
  if (monsterMatch) {
    return monsterMatch[1].trim();
  }
  
  // Check for equipment pattern: "Equipment Name (Tier: X)"
  const equipmentMatch = text.match(/^(.*?)\s*\(Tier: \d+\)/);
  if (equipmentMatch) {
    return equipmentMatch[1].trim();
  }
  
  return null;
}

// Validate if context menu should receive favorite button
function validateContextMenu(menuElem) {
  if (!config.enableFavorites) {
    return false;
  }
  if (isScrollLocked()) {
    return false;
  }
  if (menuElem.hasAttribute('data-favorite-processed')) {
    return false;
  }
  
  const creatureName = getCreatureNameFromMenu(menuElem);
  if (!creatureName) {
    return false;
  }
  
  const menuText = menuElem.textContent || '';
  if (/\(Tier: \d+\)/.test(menuText)) {
    return false;
  }
  if (menuText.toLowerCase().includes('my account') || menuText.toLowerCase().includes('logout')) {
    return false;
  }
  if (menuText.toLowerCase().includes('game mode') || menuText.toLowerCase().includes('manual')) {
    return false;
  }
  
  return true;
}

// Identify creature from context menu
function identifyCreatureFromMenu(menuElem) {
  let contextMenuPercentage = null;
  const group = menuElem.querySelector('div[role="group"]');
  if (group) {
    const firstItem = group.querySelector('.dropdown-menu-item');
    if (firstItem) {
      const text = firstItem.textContent;
      const percentageMatch = text.match(/\((\d+)%\)/);
      if (percentageMatch) {
        contextMenuPercentage = parseInt(percentageMatch[1]);
      }
    }
  }
  
  if (!currentRightClickedCreature?.creatureImg) return null;
  
  const creatureInfo = getCreatureUniqueId(currentRightClickedCreature.creatureImg, contextMenuPercentage);
  if (!creatureInfo) return null;
  
  const monsters = getPlayerMonsters();
  const creature = monsters.find(m => m.id === creatureInfo.uniqueId);
  
  return {
    gameId: creatureInfo.gameId,
    uniqueId: creatureInfo.uniqueId,
    creatureIndex: creatureInfo.index,
    isLocked: creature?.locked || false
  };
}

// Create favorite main menu item
function createFavoriteMainMenuItem() {
  const item = document.createElement('div');
  item.className = 'focus-style dropdown-menu-item flex cursor-default select-none items-center gap-2 outline-none data-[state=open]:bg-whiteDarkest data-[state=open]:text-whiteBrightest';
  item.setAttribute('role', 'menuitem');
  item.setAttribute('aria-haspopup', 'menu');
  item.setAttribute('aria-expanded', 'false');
  item.setAttribute('aria-controls', 'favorite-submenu');
  item.setAttribute('data-state', 'closed');
  item.setAttribute('tabindex', '-1');
  item.setAttribute('data-orientation', 'vertical');
  item.setAttribute('data-radix-collection-item', '');
  return item;
}

// Create favorite submenu with symbol items
function createFavoriteSubmenu(uniqueId, currentSymbol) {
  const submenu = document.createElement('div');
  submenu.id = 'favorite-submenu';
  submenu.className = 'pixel-font-16 frame-3 surface-regular z-modals min-w-[7rem] overflow-hidden py-1 text-whiteHighlight shadow-md';
  submenu.setAttribute('role', 'menu');
  submenu.setAttribute('aria-orientation', 'vertical');
  submenu.setAttribute('data-state', 'closed');
  submenu.setAttribute('data-radix-menu-content', '');
  submenu.style.cssText = `position: absolute; left: 100%; top: 0; display: none; z-index: 1000; min-width: 120px;`;
  
  const isFavorite = uniqueId ? favoritesState.creatures.has(uniqueId) : false;
  
  Object.entries(FAVORITE_SYMBOLS).forEach(([symbolKey, symbol]) => {
    const symbolItem = document.createElement('div');
    symbolItem.className = 'dropdown-menu-item relative flex cursor-default select-none items-center gap-1 outline-none';
    symbolItem.setAttribute('role', 'menuitem');
    symbolItem.setAttribute('tabindex', '-1');
    symbolItem.setAttribute('data-orientation', 'vertical');
    symbolItem.setAttribute('data-radix-collection-item', '');
    symbolItem.style.cssText = 'color: white; background: transparent; padding: 4px 8px; font-size: 14px; font-weight: 400; line-height: 1.2;';
    
    symbolItem.addEventListener('mouseenter', () => symbolItem.style.background = 'rgba(255, 255, 255, 0.15)');
    symbolItem.addEventListener('mouseleave', () => symbolItem.style.background = 'transparent');
    
    const isCurrentSymbol = isFavorite && currentSymbol === symbolKey;
    let iconElement = '';
    if (!symbol.isNone) {
      iconElement = symbolKey === 'heart' ? `<span style="font-size: 14px; line-height: 1;">${symbol.icon}</span>` : `<img src="${symbol.icon}" width="14" height="14" style="image-rendering: pixelated;" alt="${symbol.name}">`;
    }
    
    symbolItem.innerHTML = `${iconElement}${symbol.name}${isCurrentSymbol ? ' ✓' : ''}`;
    
    symbolItem.addEventListener('click', (e) => {
      e.stopPropagation();
      if (uniqueId) {
        if (symbol.isNone) {
          favoritesState.creatures.delete(uniqueId);
          saveFavorites();
          updateFavoriteHearts(uniqueId);
        } else {
          toggleFavorite(uniqueId, symbolKey);
        }
      }
      currentRightClickedCreature = null;
      scheduleTimeout(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
      }, TIMEOUT_DELAYS.MENU_CLOSE);
    });
    
    submenu.appendChild(symbolItem);
  });
  
  return submenu;
}

// Attach submenu event handlers
function attachSubmenuHandlers(mainItem, submenu) {
  mainItem.addEventListener('mouseenter', () => {
    mainItem.style.background = 'rgba(255, 255, 255, 0.15)';
    mainItem.setAttribute('data-state', 'open');
    mainItem.setAttribute('aria-expanded', 'true');
    submenu.setAttribute('data-state', 'open');
    submenu.style.display = 'block';
  });
  
  mainItem.addEventListener('mouseleave', () => {
    mainItem.style.background = 'transparent';
    scheduleTimeout(() => {
      if (!submenu.matches(':hover') && !mainItem.matches(':hover')) {
        mainItem.setAttribute('data-state', 'closed');
        mainItem.setAttribute('aria-expanded', 'false');
        submenu.setAttribute('data-state', 'closed');
        submenu.style.display = 'none';
      }
    }, TIMEOUT_DELAYS.SUBMENU_HIDE);
  });
  
  submenu.addEventListener('mouseenter', () => {
    submenu.style.display = 'block';
    submenu.setAttribute('data-state', 'open');
  });
  
  submenu.addEventListener('mouseleave', () => {
    submenu.style.display = 'none';
    submenu.setAttribute('data-state', 'closed');
    mainItem.setAttribute('data-state', 'closed');
    mainItem.setAttribute('aria-expanded', 'false');
  });
}

// Inject favorite button into context menu
function injectFavoriteButton(menuElem) {
  if (!validateContextMenu(menuElem)) {
    return false;
  }
  menuElem.setAttribute('data-favorite-processed', 'true');
  
  const creatureData = identifyCreatureFromMenu(menuElem);
  const uniqueId = creatureData?.uniqueId || null;
  const currentSymbol = uniqueId ? favoritesState.creatures.get(uniqueId) : null;
  
  const favoriteMainItem = createFavoriteMainMenuItem();
  const submenu = createFavoriteSubmenu(uniqueId, currentSymbol);
  
  attachSubmenuHandlers(favoriteMainItem, submenu);
  
  favoriteMainItem.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>${t('mods.betterUI.favoriteMenuLabel')}<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right ml-auto" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;
  
  favoriteMainItem.addEventListener('click', (e) => {
    e.stopPropagation();
    if (uniqueId) {
      toggleFavorite(uniqueId, 'heart');
    }
    currentRightClickedCreature = null;
    scheduleTimeout(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    }, TIMEOUT_DELAYS.MENU_CLOSE);
  });
  
  favoriteMainItem.appendChild(submenu);
  menuElem.appendChild(favoriteMainItem);
  
  console.log('[Mod Settings] Favorite button injected successfully');
  return true;
}

// Remove all favorite hearts
function removeFavoriteHearts() {
  document.querySelectorAll('.favorite-heart').forEach(heart => heart.remove());
}

// Update heart icons on creature portraits
function updateFavoriteHearts(targetUniqueId = null) {
  // Skip if Board Analyzer or Autoscroller is running
  if (isBlockedByAnalysisMods()) {
    return;
  }
  
  if (!config.enableFavorites) {
    removeFavoriteHearts();
    return;
  }
  
  if (isScrollLocked()) {
    return;
  }
  
  // Get all creatures, but exclude those inside the Impact Analyzer and autoplay session
  const allCreatures = Array.from(getVisibleCreatures());
  const creatures = allCreatures.filter(imgEl => {
    // Exclude creatures inside the Impact Analyzer panel
    const isInAnalyzer = imgEl.closest('div[data-state="open"]')?.querySelector('img[alt="damage"]') ||
                         imgEl.closest('div[data-state="open"]')?.querySelector('img[alt="healing"]');
    
    // Exclude creatures inside the autoplay session widget
    const isInAutoplaySession = imgEl.closest('div[data-autosetup]') ||
                               imgEl.closest('#autoseller-session-widget') ||
                               imgEl.closest('#drop-widget-bottom-element');
    
    return !isInAnalyzer && !isInAutoplaySession;
  });
  
  // If no creatures visible, don't remove existing hearts - collection might be transitioning
  if (creatures.length === 0) {
    return;
  }
  
  const monsters = getPlayerMonsters();
  
  // OPTIMIZATION: If updating a specific creature, only update that one
  if (targetUniqueId) {
    updateSingleFavoriteHeart(targetUniqueId, creatures, monsters);
    favoritesState.lastOptimizedUpdate = Date.now(); // Track time to prevent observer double-refresh
    return;
  }
  
  // Full update: reset index and process all creatures
  resetCreatureMatchingIndex();
  
  // Remove all existing hearts first (only when we have creatures to re-apply them)
  removeFavoriteHearts();
  
  let heartsAdded = 0;
  let creaturesChecked = 0;
  
  creatures.forEach((imgEl, idx) => {
    const identifiedMonster = matchCreatureBySequentialIndex(imgEl, monsters);
    const uniqueId = identifiedMonster?.id;
    if (!uniqueId) return;
    
    creaturesChecked++;
    
    const isFavorite = favoritesState.creatures.has(uniqueId);
    const container = imgEl.parentElement;
    
    // Add favorite symbol if favorited
    if (isFavorite) {
      const symbolKey = favoritesState.creatures.get(uniqueId) || 'heart';
      const symbol = FAVORITE_SYMBOLS[symbolKey] || FAVORITE_SYMBOLS.heart;
      
      const heart = createFavoriteHeartElement(symbolKey, symbol);
      container.appendChild(heart);
      heartsAdded++;
    }
  });
  
  // Only log when hearts were actually added and result is different from last time
  if (heartsAdded > 0) {
    const currentResult = `${creaturesChecked}-${heartsAdded}`;
    if (favoritesState.lastLoggedResult !== currentResult) {
      console.log('[Mod Settings] updateFavoriteHearts completed. Creatures checked:', creaturesChecked, 'Total hearts added:', heartsAdded);
      favoritesState.lastLoggedResult = currentResult;
    }
  }
}

// Helper: Update a single creature's favorite heart (optimized for single-creature updates)
function updateSingleFavoriteHeart(targetUniqueId, allCreatures, monsters) {
  // Filter out analyzer creatures and autoplay session creatures
  const creatures = allCreatures.filter(imgEl => {
    const isInAnalyzer = imgEl.closest('div[data-state="open"]')?.querySelector('img[alt="damage"]') ||
                         imgEl.closest('div[data-state="open"]')?.querySelector('img[alt="healing"]');
    
    // Exclude creatures inside the autoplay session widget
    const isInAutoplaySession = imgEl.closest('div[data-autosetup]') ||
                               imgEl.closest('#autoseller-session-widget') ||
                               imgEl.closest('#drop-widget-bottom-element');
    
    return !isInAnalyzer && !isInAutoplaySession;
  });
  
  resetCreatureMatchingIndex();
  
  let targetFound = false;
  
  for (let idx = 0; idx < creatures.length; idx++) {
    const imgEl = creatures[idx];
    const identifiedMonster = matchCreatureBySequentialIndex(imgEl, monsters);
    const uniqueId = identifiedMonster?.id;
    
    if (!uniqueId) continue;
    
    // Only process the target creature
    if (uniqueId === targetUniqueId) {
      targetFound = true;
      const container = imgEl.parentElement;
      
      // Remove existing heart for this creature
      const existingHeart = container.querySelector('.favorite-heart');
      if (existingHeart) {
        existingHeart.remove();
      }
      
      // Add heart if favorited
      const isFavorite = favoritesState.creatures.has(uniqueId);
      if (isFavorite) {
        const symbolKey = favoritesState.creatures.get(uniqueId) || 'heart';
        const symbol = FAVORITE_SYMBOLS[symbolKey] || FAVORITE_SYMBOLS.heart;
        
        const heart = createFavoriteHeartElement(symbolKey, symbol);
        container.appendChild(heart);
      }
      
      break; // Found and updated, exit early
    }
  }
  
  if (!targetFound) {
    console.warn('[Mod Settings] Target creature not found in visible creatures:', targetUniqueId);
  }
}

// Helper: Create favorite heart element
function createFavoriteHeartElement(symbolKey, symbol) {
  const heart = document.createElement('div');
  heart.className = 'favorite-heart pixelated';
  heart.style.cssText = 'position: absolute; bottom: 1px; right: 0; z-index: 3; width: 16px; height: 16px; pointer-events: none;';
  
  // Use the appropriate icon for the favorite marker
  if (symbolKey === 'heart') {
    // For heart, use emoji directly with proper alignment
    heart.innerHTML = symbol.icon;
    heart.style.fontSize = '16px';
    heart.style.display = 'flex';
    heart.style.alignItems = 'center';
    heart.style.justifyContent = 'center';
    heart.style.lineHeight = '1';
  } else {
    // For stat icons, use the actual game icons
    heart.innerHTML = `<img src="${symbol.icon}" width="16" height="16" style="image-rendering: pixelated;" alt="${symbol.name}">`;
  }
  
  return heart;
}

// Match visible creature to game state using sequential indexing
function matchCreatureBySequentialIndex(imgEl, monsters) {
  const gameId = getCreatureGameId(imgEl);
  if (!gameId) return null;
  
  const button = imgEl.closest('button');
  const levelSpan = button?.querySelector('span[translate="no"]');
  const displayedLevel = levelSpan ? parseInt(levelSpan.textContent) : null;
  
  const indexKey = `${gameId}-${displayedLevel || 'unknown'}`;
  
  if (!matchCreatureBySequentialIndex.indexMap) {
    matchCreatureBySequentialIndex.indexMap = new Map();
  }
  
  if (!matchCreatureBySequentialIndex.indexMap.has(indexKey)) {
    matchCreatureBySequentialIndex.indexMap.set(indexKey, 0);
  }
  
  const currentIndex = matchCreatureBySequentialIndex.indexMap.get(indexKey);
  
  // Get all monsters with this gameId, sorted by game's visual order
  const matchingMonsters = getSortedMonstersByGameId(monsters, gameId);
  
  let candidateMonsters = matchingMonsters;
  if (displayedLevel && matchingMonsters.length > 1) {
    const sameLevelMonsters = matchingMonsters.filter(m => getLevelFromExp(m.exp || 0) === displayedLevel);
    if (sameLevelMonsters.length > 0) {
      candidateMonsters = sameLevelMonsters;
    }
  }
  
  const identifiedMonster = candidateMonsters[currentIndex] || matchingMonsters[currentIndex];
  matchCreatureBySequentialIndex.indexMap.set(indexKey, currentIndex + 1);
  
  return identifiedMonster;
}

// Reset creature matching index (call before each batch operation)
function resetCreatureMatchingIndex() {
  if (matchCreatureBySequentialIndex.indexMap) {
    matchCreatureBySequentialIndex.indexMap.clear();
  }
}

// Sort monsters to match game's visual order: EXP (desc) → Name (asc) → CreatedAt (asc)
function sortMonstersByVisualOrder(monsters) {
  return monsters.slice().sort((a, b) => {
    // Primary: EXP (descending)
    if (b.exp !== a.exp) return b.exp - a.exp;
    
    // Secondary: Name (ascending) - with safe fallback
    if (a.metadata?.name && b.metadata?.name) {
      const nameCompare = a.metadata.name.localeCompare(b.metadata.name);
      if (nameCompare !== 0) return nameCompare;
    }
    
    // Tertiary: CreatedAt (ascending)
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

// Helper: Get sorted monsters filtered by gameId
function getSortedMonstersByGameId(monsters, gameId) {
  return sortMonstersByVisualOrder(monsters.filter(m => m.gameId === gameId));
}

// Match monster by stat percentage
function matchMonsterByPercentage(matchingMonsters, percentage, displayedLevel) {
  const monstersWithPercentage = matchingMonsters.filter(m => {
    const statSum = (m.hp || 0) + (m.ad || 0) + (m.ap || 0) + (m.armor || 0) + (m.magicResist || 0);
    return statSum === percentage;
  });
  
  console.log('[Mod Settings] Found', monstersWithPercentage.length, 'monster(s) with', percentage + '%');
  
  if (monstersWithPercentage.length === 0) return null;
  if (monstersWithPercentage.length === 1) return monstersWithPercentage[0];
  
  // Multiple monsters with same percentage - use level to disambiguate
  if (displayedLevel) {
    console.log('[Mod Settings] Multiple monsters with same percentage, using displayed level:', displayedLevel);
    const levelMatch = monstersWithPercentage.find(m => getLevelFromExp(m.exp || 0) === displayedLevel);
    if (levelMatch) return levelMatch;
  }
  
  return monstersWithPercentage[0];
}

// Match monster by level and visual clues
function matchMonsterByLevelAndVisuals(matchingMonsters, displayedLevel, isShiny, hasStars) {
  if (!displayedLevel) return null;
  
  const levelMatches = matchingMonsters.filter(m => getLevelFromExp(m.exp) === displayedLevel);
  
  if (levelMatches.length === 0) return null;
  if (levelMatches.length === 1) return levelMatches[0];
  
  // Multiple creatures with same level - use visual clues
  return levelMatches.find(m => {
    if (isShiny && !m.shiny) return false;
    if (!isShiny && m.shiny) return false;
    if (hasStars && !m.tier) return false;
    if (!hasStars && m.tier) return false;
    return true;
  }) || null;
}

// Calculate and format creature stats
function calculateCreatureStats(monster) {
  const statSum = (monster?.hp || 0) + (monster?.ad || 0) + (monster?.ap || 0) + (monster?.armor || 0) + (monster?.magicResist || 0);
  const statPercent = Math.round((statSum / 100) * 100);
  const level = getLevelFromExp(monster?.exp || 0);
  
  return {
    id: monster?.id,
    level,
    hp: monster?.hp,
    ad: monster?.ad,
    ap: monster?.ap,
    armor: monster?.armor,
    magicResist: monster?.magicResist,
    total: statSum,
    percentage: statPercent + '%'
  };
}

// Helper function to get the unique ID of a creature from its image element
// Uses sequential counter logic to match DOM order with game state order
function getCreatureUniqueId(creatureImg, contextMenuPercentage = null) {
  if (!creatureImg) return null;
  
  const gameId = getCreatureGameId(creatureImg);
  if (!gameId) return null;
  
  // Get all monsters from game state
  const monsters = getPlayerMonsters();
  const matchingMonsters = getSortedMonstersByGameId(monsters, gameId);
  
  // Get ALL visible creatures in DOM order, EXCLUDING creatures inside context menus or modals
  const allVisibleCreatures = Array.from(document.querySelectorAll('img[alt="creature"]')).filter(img => {
    // Exclude creatures inside context menus
    const isInContextMenu = img.closest('[role="menu"]');
    // Exclude creatures inside dialogs/modals
    const isInModal = img.closest('[role="dialog"]');
    return !isInContextMenu && !isInModal;
  });
  
  // Use sequential counter logic to match DOM order with game state
  const gameIdIndexMap = new Map();
  
  // Iterate through all creatures to find the target one
  for (let i = 0; i < allVisibleCreatures.length; i++) {
    const currentImg = allVisibleCreatures[i];
    const currentGameId = getCreatureGameId(currentImg);
    
    if (!currentGameId) continue;
    
    // Get or initialize the index for this gameId
    if (!gameIdIndexMap.has(currentGameId)) {
      gameIdIndexMap.set(currentGameId, 0);
    }
    const currentIndex = gameIdIndexMap.get(currentGameId);
    
  // Check if this is the target creature
  if (currentImg === creatureImg) {
    // Get all available data from the button
    const button = currentImg.closest('button');
    const levelSpan = button.querySelector('span[translate="no"]');
    const displayedLevel = levelSpan ? parseInt(levelSpan.textContent) : null;
    
    // Try to match by context menu percentage first (most reliable)
    let identifiedMonster = matchingMonsters[currentIndex];
    let matchedByPercentage = false;
    
    if (contextMenuPercentage !== null) {
      const monster = matchMonsterByPercentage(matchingMonsters, contextMenuPercentage, displayedLevel);
      
      if (monster) {
        identifiedMonster = monster;
        matchedByPercentage = true;
      } else {
        console.warn('[Mod Settings] getCreatureUniqueId - No monster found with percentage:', contextMenuPercentage + '%');
      }
    }
    
    // Fallback to level-based matching if percentage matching failed
    if (!matchedByPercentage && displayedLevel) {
      const button = currentImg.closest('button');
      const isShiny = currentImg.src.includes('-shiny');
      const hasStars = button.querySelector('.tier-stars') !== null;
      
      const bestMatch = matchMonsterByLevelAndVisuals(matchingMonsters, displayedLevel, isShiny, hasStars);
      if (bestMatch) {
        identifiedMonster = bestMatch;
      }
    }
    
    return {
      uniqueId: identifiedMonster?.id,
      gameId: currentGameId,
      index: currentIndex
    };
  }
    
    // Increment the index for next creature with same gameId
    gameIdIndexMap.set(currentGameId, currentIndex + 1);
  }
  
  console.error('[Mod Settings] getCreatureUniqueId - FAILED to find target in DOM!');
  return null;
}

// Store reference to the currently right-clicked creature
let currentRightClickedCreature = null;

// Start context menu observer
function startContextMenuObserver() {
  if (observers.contextMenu) {
    console.log('[Mod Settings] Context menu observer already running');
    return;
  }
  
  // Handle right-click on creature button
  function handleCreatureRightClick(event) {
    const creatureImg = event.target.closest('button').querySelector('img[alt="creature"]');
    if (creatureImg) {
      // Store just the image element - we'll identify it properly when the context menu appears
      currentRightClickedCreature = { creatureImg };
      console.log('[Mod Settings] Right-clicked creature stored (will identify from context menu)');
    }
  }
  
  // First, add right-click listeners to all creature buttons
  function addRightClickListeners() {
    const creatureButtons = document.querySelectorAll('button[data-picked]');
    creatureButtons.forEach(button => {
      // Only add listener if not already added
      if (!favoritesState.buttonListeners.has(button)) {
        button.addEventListener('contextmenu', handleCreatureRightClick);
        favoritesState.buttonListeners.set(button, handleCreatureRightClick);
      }
    });
  }
  
  const processMenuMutations = (mutations) => {
    addRightClickListeners();
    
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        
        const isMenu = node.getAttribute?.('role') === 'menu';
        const hasMenu = node.querySelector?.('[role="menu"]');
        const isDropdown = node.classList?.contains('dropdown-content') || node.querySelector?.('.dropdown-content');
        
        const menu = isMenu ? node : hasMenu;
        if (menu) {
          scheduleTimeout(() => injectFavoriteButton(menu), TIMEOUT_DELAYS.MENU_CLOSE);
        } else if (isDropdown || node.querySelector?.('.dropdown-menu-item')) {
          scheduleTimeout(() => injectFavoriteButton(node), TIMEOUT_DELAYS.MENU_CLOSE);
        }
      }
    }
  };
  
  observers.contextMenu = createThrottledObserver(processMenuMutations, 50);
  
  // Observe both document.body and document.documentElement to catch portals
  observers.contextMenu.observe(document.body, { childList: true, subtree: true });
  
  // Initial setup
  addRightClickListeners();
  
  console.log('[Mod Settings] Context menu observer started and observing document.body');
}

// Stop context menu observer
function stopContextMenuObserver() {
  if (observers.contextMenu) {
    observers.contextMenu.disconnect();
    observers.contextMenu = null;
    console.log('[Mod Settings] Context menu observer stopped');
  }
  
  // Remove all creature button event listeners
  const creatureButtons = document.querySelectorAll('button[data-picked]');
  let removedCount = 0;
  creatureButtons.forEach(button => {
    const listener = favoritesState.buttonListeners.get(button);
    if (listener) {
      button.removeEventListener('contextmenu', listener);
      favoritesState.buttonListeners.delete(button);
      removedCount++;
    }
  });
  if (removedCount > 0) {
    console.log(`[Mod Settings] Removed ${removedCount} creature button event listeners`);
  }
}

// =======================
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

// Apply max creatures styling to elite monsters
// Helper functions for applyMaxCreatures
function filterEligibleCreatures(visibleCreatures) {
  // Skip if scroll is locked (e.g., Bestiary tab)
  if (isScrollLocked()) return [];
  
  const tier4Monsters = getTier4Monsters();
  const eligibleCreatures = [];
  
  visibleCreatures.forEach((imgEl) => {
    const gameId = getCreatureGameId(imgEl);
    if (!gameId) return;

    const monster = tier4Monsters.find((m) => m.gameId === gameId);
    if (!monster) return;
    
    // Skip shinies if max shinies is enabled (shinies take priority)
    if (config.enableMaxShinies && isShinyCreature(imgEl)) {
      return;
    }
    
    const elements = getCreatureElements(imgEl.parentElement);
    const levelText = getCreatureLevel(elements.levelEl);
    const isLevel50 = isMaxLevel(levelText);
    const hasAllMaxStats = isEliteMonster(monster);
    
    if (isLevel50 && hasAllMaxStats && elements.starImg && elements.rarityDiv) {
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
  
  // Apply styling with data attributes
  applyDataAttributes(
    { starImg: elements.starImg, rarityDiv: elements.rarityDiv, textRarityEl: elements.textRarityEl },
    'max-creatures',
    colorKey,
    {
      rarityDiv: { 'data-rarity': GAME_CONSTANTS.ELITE_RARITY_LEVEL.toString() },
      textRarityEl: { 'data-rarity': GAME_CONSTANTS.ELITE_RARITY_LEVEL.toString() }
    }
  );
}

function injectMaxCreaturesCSS(colorOption, colorKey) {
  // Remove any existing max creatures styles first
  Object.keys(COLOR_OPTIONS).forEach(color => {
    const existingStyle = document.getElementById(`max-creatures-${color}-style`);
    if (existingStyle) {
      existingStyle.remove();
    }
  });

  // Create new style for current color
  const styleId = `max-creatures-${colorKey}-style`;
  const style = document.createElement("style");
  style.id = styleId;
  document.head.appendChild(style);
  
  // Generate CSS using template system
  const css = generateMaxCreaturesCSS(colorOption, colorKey);
  style.textContent = css;
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

    // Reset all max creatures borders
    document.querySelectorAll('.has-rarity[data-max-creatures="true"]').forEach((rarityDiv) => {
      rarityDiv.setAttribute('data-rarity', '5');
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
function filterEligibleShinies(visibleCreatures) {
  // Skip if scroll is locked (e.g., Bestiary tab)
  if (isScrollLocked()) return [];
  
  const eligibleShinies = [];
  
  visibleCreatures.forEach((imgEl) => {
    if (!isShinyCreature(imgEl)) return;
    
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
  
  // Store original rarity
  const currentRarity = elements.rarityDiv.getAttribute('data-rarity') || '5';
  
  // Apply styling with data attributes
  applyDataAttributes(
    { imgEl, rarityDiv: elements.rarityDiv, textRarityEl: elements.textRarityEl },
    'max-shinies',
    colorKey,
    { rarityDiv: { 'data-original-rarity': currentRarity } }
  );
}

function injectMaxShiniesCSS(colorOption, colorKey) {
  // Remove any existing max shinies styles first
  Object.keys(COLOR_OPTIONS).forEach(color => {
    const existingStyle = document.getElementById(`max-shinies-${color}-style`);
    if (existingStyle) {
      existingStyle.remove();
    }
  });
  
  // Create new style for current color
  const styleId = `max-shinies-${colorKey}-style`;
  const style = document.createElement("style");
  style.id = styleId;
  document.head.appendChild(style);
  
  // Generate CSS using template system
  const css = generateMaxShiniesCSS(colorOption, colorKey);
  style.textContent = css;
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
    
    // Reset all shiny borders
    document.querySelectorAll('.has-rarity[data-max-shinies="true"]').forEach((rarityDiv) => {
      // If this was dynamically created, remove it completely
      if (rarityDiv.hasAttribute('data-dynamic-created')) {
        rarityDiv.remove();
        return;
      }
      
      // Otherwise, restore original state
      const originalRarity = rarityDiv.getAttribute('data-original-rarity') || '5';
      rarityDiv.setAttribute('data-rarity', originalRarity);
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
// 9. Shiny Enemies
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

// Helper: Get comprehensive sprite information from a sprite element
function getSpriteInfo(spriteElement) {
  // Null safety check
  if (!spriteElement) {
    return {
      spriteContainer: null,
      battleContainer: null,
      isInDialog: false,
      spriteId: null,
      creatureName: null,
      isEnemy: false
    };
  }
  
  const spriteContainer = spriteElement.closest('.sprite');
  const battleContainer = spriteElement.closest('[data-name]');
  const isInDialog = spriteElement.closest('[role="dialog"]') !== null;
  const spriteId = spriteContainer ? parseInt(extractSpriteIdFromClasses(spriteContainer), 10) : null;
  const creatureName = battleContainer?.getAttribute('data-name') || null;
  const isEnemy = battleContainer ? isEnemyByHealthBar(battleContainer) : false;
  
  return {
    spriteContainer,
    battleContainer,
    isInDialog,
    spriteId,
    creatureName,
    isEnemy
  };
}

// Helper: Check if creature is in the unobtainable list
// Handles creatures with suffixes like "Dwarf Henchman 4" by checking if the name starts with an unobtainable creature name
function isCreatureUnobtainable(creatureName) {
  if (!creatureName) return false;
  const UNOBTAINABLE_CREATURES = window.creatureDatabase?.UNOBTAINABLE_CREATURES || [];
  const creatureNameLower = creatureName.toLowerCase();
  return UNOBTAINABLE_CREATURES.some(c => {
    const unobtainableLower = c.toLowerCase();
    // Check exact match or if creature name starts with unobtainable name (for suffixes like "Dwarf Henchman 4")
    return unobtainableLower === creatureNameLower || 
           creatureNameLower.startsWith(unobtainableLower + ' ');
  });
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
      
      // Check if unobtainable first - if so, skip entirely
      if (isCreatureUnobtainable(creatureName)) {
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
        if (isCreatureUnobtainable(creatureName)) {
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
        // Check if unobtainable first - if so, skip entirely
        if (isCreatureUnobtainable(creatureName)) {
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
// 11. Website Footer Functions
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
            // Update favorite hearts if enabled
            if (config.enableFavorites) {
              scheduleTimeout(() => {
                updateFavoriteHearts();
              }, TIMEOUT_DELAYS.TAB_REAPPLY);
            }
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
          
          // Re-apply max shinies styling if enabled
          if (config.enableMaxShinies) {
            applyMaxShinies();
          }
          
          // Re-apply shiny enemies if enabled
          if (config.enableShinyEnemies) {
            applyShinyEnemies();
          }
          
          // Update favorite hearts if enabled
          // Skip if we just did an optimized update (within 500ms) to prevent double-refresh
          if (config.enableFavorites) {
            const timeSinceOptimizedUpdate = Date.now() - favoritesState.lastOptimizedUpdate;
            if (timeSinceOptimizedUpdate > 500) {
              updateFavoriteHearts();
            } else {
              console.log('[Mod Settings] Skipping full favorite refresh - recent optimized update:', timeSinceOptimizedUpdate + 'ms ago');
            }
          }
          
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
            
            if (config.enableMaxShinies) {
              applyMaxShinies();
            }
            
            if (config.enableShinyEnemies) {
              applyShinyEnemies();
            }
            
            if (config.enableFavorites) {
              updateFavoriteHearts();
            }
            
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
                  
                  // Check if creature is unobtainable first - if so, skip entirely
                  if (isCreatureUnobtainable(creatureName)) {
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
                  
                  if (isEnemy && dataShiny === 'false' && !isCreatureUnobtainable(creatureName)) {
                    spriteImg.setAttribute('data-shiny', 'true');
                  } else if (!isEnemy) {
                    // NOT in boardConfig as enemy - check if it's a visual summon by health bar
                    const isVisualEnemy = isEnemyByHealthBar(containerNode);
                    
                    if (isVisualEnemy && dataShiny === 'false' && !isCreatureUnobtainable(creatureName)) {
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
              // Check if creature is unobtainable (no shiny version)
              const UNOBTAINABLE_CREATURES = window.creatureDatabase?.UNOBTAINABLE_CREATURES || [];
              let creatureName = null;
              
              if (globalThis.state?.utils?.getMonster) {
                const monster = globalThis.state.utils.getMonster(matchedEnemy.gameId);
                creatureName = monster?.metadata?.name;
              }
              
              if (isCreatureUnobtainable(creatureName)) {
                // Skip unobtainable creatures
              } else {
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
    
    el.play().catch(error => {
      console.warn('[Mod Settings] Anti-idle sounds play failed (may require user interaction):', error);
    });
    
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
  } catch (error) {
    console.error('[Mod Settings] Error disabling anti-idle sounds:', error);
  }
}

// =======================
// 14. Playercount Functions
// =======================

// Fetch player count from API
async function fetchPlayerCount() {
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

// Update the player count display
function updatePlayerCountDisplay(count) {
  const playerCountBtn = document.querySelector('.playercount-header-btn');
  if (!playerCountBtn) return;
  
  if (count !== null) {
    playerCountBtn.innerHTML = `<span class="pixel-font-16 text-white animate-in fade-in">Online: <span class="text-ally/80">${count}</span></span>`;
    playerCountBtn.title = `Online: ${count} (Last updated: ${playercountState.lastUpdateTime ? playercountState.lastUpdateTime.toLocaleTimeString() : 'Never'})`;
    playerCountBtn.style.color = 'inherit';
  } else {
    playerCountBtn.innerHTML = `<span class="pixel-font-16 text-white animate-in fade-in">Online: <span class="text-error">?</span></span>`;
    playerCountBtn.title = 'Player count unavailable';
    playerCountBtn.style.color = 'inherit';
  }
}

// Start periodic updates
function startPlayerCountUpdates() {
  // Initial fetch
  fetchPlayerCount().then(count => {
    updatePlayerCountDisplay(count);
  });
  
  // Set up periodic updates (30 seconds)
  const updateInterval = setInterval(async () => {
    const count = await fetchPlayerCount();
    updatePlayerCountDisplay(count);
  }, 30000);
  
  playercountState.updateInterval = updateInterval;
  activeTimeouts.add(updateInterval);
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

    // Insert after Cyclopedia
    const cyclopediaLi = Array.from(headerUl.children).find(
      el => el.querySelector('.cyclopedia-header-btn')
    );

    if (cyclopediaLi) {
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
  resetAllBtn.style.cssText = 'padding: 6px 12px; font-size: 12px; background: #333; color: #ccc; border: 1px solid #555; border-radius: 4px; cursor: pointer; width: 100%;';
  resetAllBtn.title = t('mods.betterUI.modCoordinationResetAllTooltip') || 'Reset all mod priorities to their default values';
  
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
    } else {
      console.log('[Mod Settings] No mod priorities to reset');
    }
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
  try {
    console.log('[Mod Settings] Starting initialization');
    
    loadFavorites();
    
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
    
    if (config.enableMaxCreatures) {
      console.log('[Mod Settings] Applying max creatures');
      applyMaxCreatures();
    }
    
    if (config.enableMaxShinies) {
      console.log('[Mod Settings] Applying max shinies');
      applyMaxShinies();
    }
    
    if (config.enableShinyEnemies) {
      console.log('[Mod Settings] Applying shiny enemies');
      startBattleBoardObserver();
      applyShinyEnemies();
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
    
    if (config.enablePlayercount) {
      console.log('[Mod Settings] Playercount enabled in config, initializing');
      removeHeaderLinks();
      addPlayercountHeaderButton();
    } else {
      console.log('[Mod Settings] Playercount disabled in config');
    }
    
    initTabObserver();
    startContextMenuObserver();
    startCreatureContainerObserver();
    initScrollLockObserver();
    
    if (config.enableFavorites) {
      scheduleTimeout(() => updateFavoriteHearts(), TIMEOUT_DELAYS.FAVORITES_INIT);
    }
    
    // Apply initial setup labels visibility and start observer
    scheduleTimeout(() => {
      applySetupLabelsVisibility(config.showSetupLabels);
      observers.setupLabels = startSetupLabelsObserver();
      console.log('[Mod Settings] Setup labels visibility applied:', config.showSetupLabels);
    }, 1000); // Delay to ensure DOM is ready
    
    // Hide website footer if enabled
    if (config.removeWebsiteFooter) {
      scheduleTimeout(() => {
        hideWebsiteFooter();
      }, 1000); // Delay to ensure DOM is ready
    }
    
    console.log('[Mod Settings] Initialization completed');
    
    // Check if Hunt Analyzer should be opened on initialization
    scheduleTimeout(() => {
      checkAndOpenHuntAnalyzer();
    }, 500); // Small delay to ensure all mods are loaded
  } catch (error) {
    console.error('[Mod Settings] Initialization error:', error);
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
    stopContextMenuObserver();
    observers.creature = disconnectObserver(observers.creature, 'Creature container');
    observers.setupLabels = disconnectObserver(observers.setupLabels, 'Setup labels');
    observers.scrollLock = disconnectObserver(observers.scrollLock, 'Scroll lock');
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
    
    // Cleanup playercount
    if (playercountState.updateInterval) {
      clearInterval(playercountState.updateInterval);
      activeTimeouts.delete(playercountState.updateInterval);
      playercountState.updateInterval = null;
    }
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
    
    document.querySelectorAll('.favorite-heart').forEach(heart => {
      try {
        heart.remove();
      } catch (error) {
        console.warn('[Mod Settings] Error removing favorite heart:', error);
      }
    });
    
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
    
    // Reset favorites state
    favoritesState.creatures.clear();
    favoritesState.lastOptimizedUpdate = 0;
    // Note: buttonListeners is a WeakMap and will be garbage collected
    
    // Reset subscriptions
    subscriptions.autoplayRefreshGame = null;
    subscriptions.autoplayRefreshSetPlayMode = null;
    
    // Reset anti-idle sounds
    antiIdleAudioElement = null;
    
    // Reset playercount state
    playercountState.currentPlayerCount = null;
    playercountState.lastUpdateTime = null;
    playercountState.updateInterval = null;
    
    // Reset global update tracking
    lastGlobalUpdate = 0;
    
    // Clean up global exposure
    if (window.betterUIConfig) {
      delete window.betterUIConfig;
      console.log('[Mod Settings] Global config reference removed');
    }
    
    console.log('[Mod Settings] Cleanup completed');
  } catch (error) {
    console.error('[Mod Settings] Cleanup error:', error);
  }
}

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
