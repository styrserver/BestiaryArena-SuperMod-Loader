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
  useInternalTimer: false,
  disableAutoReload: false,
  enableAntiIdleSounds: false,
  removeWebsiteFooter: false,
  alwaysOpenHuntAnalyzer: false,
  enablePlayercount: true,
  includeRunDataByDefault: true,
  includeHuntDataByDefault: true
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
// 2. DOM Selectors & Constants
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
      summary.push(`Run data: ${runStats.totalRuns} runs across ${runStats.totalMaps} maps (~${estimatedSizeKB} KB)`);
    }
  }
  
  // Add Hunt Analyzer data info
  if (data.huntAnalyzerData && data.huntAnalyzerData.data) {
    const huntData = data.huntAnalyzerData.data;
    const sessionCount = huntData.sessions ? huntData.sessions.length : 0;
    if (sessionCount > 0) {
      const estimatedSizeKB = Math.round((sessionCount * 864) / 1024);
      summary.push(`Hunt Analyzer: ${sessionCount} sessions (~${estimatedSizeKB} KB)`);
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
      resetBtn.textContent = '⏳ Resetting...';
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
      resetBtn.textContent = '🔄 Reset All Settings';
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
      resetBtn.textContent = '🔄 Reset All Settings';
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
    const menuItems = [
      { id: 'creatures', label: t('mods.betterUI.menuCreatures'), selected: true },
      { id: 'ui', label: t('mods.betterUI.menuUI'), selected: false },
      { id: 'hunt-analyzer', label: t('mods.betterUI.menuHuntAnalyzer'), selected: false },
      { id: 'advanced', label: t('mods.betterUI.menuAdvanced'), selected: false },
      { id: 'backup', label: t('mods.betterUI.menuBackup'), selected: false }
    ];
    
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
        const advancedContent = document.createElement('div');
        advancedContent.innerHTML = `
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; cursor: pointer;">
              <input type="checkbox" id="autoplay-refresh-toggle" checked="" style="transform: scale(1.2);">
              <span style="cursor: help; font-size: 16px; color: #ffaa00;" title="${t('mods.betterUI.autoplayRefreshWarning')}">⚠️</span>
              <select id="autoplay-refresh-timer-mode" style="width: fit-content; background: #333; color: #ccc; border: 1px solid #555; padding: 4px 20px 4px 10px; border-radius: 4px; pointer-events: auto;" title="${t('mods.betterUI.autoplayRefreshTimerModeWarning')}" onclick="event.stopPropagation();">
                <option value="autoplay">${t('mods.betterUI.autoplaySessionText')}</option>
                <option value="internal">${t('mods.betterUI.internalTimer')}</option>
              </select>
              <span style="color: #ccc;">${t('mods.betterUI.refreshesBrowserEvery')}</span>
              <input type="number" id="autoplay-refresh-minutes" value="30" min="1" max="120" style="width: 50px; padding: 4px 4px; border: 1px solid #555; background: #2a2a2a; color: #fff; border-radius: 4px; text-align: center; pointer-events: auto;" onclick="event.stopPropagation();">
              <span style="color: #ccc;">${t('mods.betterUI.autoplayRefreshMinutesText')}</span>
            </label>
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="persist-automator-autorefill-toggle" style="transform: scale(1.2);">
              <span style="cursor: help; font-size: 16px; color: #ffaa00;" title="${t('mods.betterUI.persistAutomatorAutoRefillWarning')}">${t('mods.betterUI.persistAutomatorAutoRefill')}</span>
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
                🔄 Reset All Settings
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
      // Set initial value based on config
      autoplayRefreshTimerModeSelect.value = config.useInternalTimer ? 'internal' : 'autoplay';
      
      autoplayRefreshTimerModeSelect.addEventListener('change', () => {
        const selectedMode = autoplayRefreshTimerModeSelect.value;
        config.useInternalTimer = (selectedMode === 'internal');
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
                runDataInfo.textContent = `Found ${runStats.totalRuns} runs across ${runStats.totalMaps} maps (~${estimatedSizeKB} KB)`;
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
                  runDataInfo.textContent = `Found ${runStats.totalRuns} runs across ${runStats.totalMaps} maps (~${estimatedSizeKB} KB)`;
                } else {
                  runDataInfo.style.display = 'block';
                  runDataInfo.textContent = 'No data found';
                }
              } else {
                runDataInfo.style.display = 'block';
                runDataInfo.textContent = 'No data found';
              }
            });
            return; // Early return for async case
          }
          
          // Show "No data found" if no data was found
          if (!hasData) {
            runDataInfo.style.display = 'block';
            runDataInfo.textContent = 'No data found';
          }
        } catch (e) {
          console.log('[Mod Settings] Could not check for Run Data:', e);
          runDataInfo.style.display = 'block';
          runDataInfo.textContent = 'No data found';
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
                huntAnalyzerInfo.textContent = `Found ${sessionCount} sessions (~${estimatedSizeKB} KB)`;
              } else {
                huntAnalyzerInfo.style.display = 'block';
                huntAnalyzerInfo.textContent = 'No sessions found';
              }
            } catch (e) {
              console.log('[Mod Settings] Could not parse Hunt Analyzer data:', e);
              huntAnalyzerInfo.style.display = 'block';
              huntAnalyzerInfo.textContent = 'No data found';
            }
          } else {
            huntAnalyzerInfo.style.display = 'block';
            huntAnalyzerInfo.textContent = 'No data found';
          }
        } catch (e) {
          console.log('[Mod Settings] Could not check for Hunt Analyzer data:', e);
          huntAnalyzerInfo.style.display = 'block';
          huntAnalyzerInfo.textContent = 'No data found';
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
  if (window.__modCoordination?.boardAnalyzerRunning || window.__modCoordination?.autoscrollerRunning) {
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
  if (window.__modCoordination?.boardAnalyzerRunning || window.__modCoordination?.autoscrollerRunning) {
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
  if (window.__modCoordination?.boardAnalyzerRunning || window.__modCoordination?.autoscrollerRunning) {
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
  if (window.__modCoordination?.boardAnalyzerRunning || window.__modCoordination?.autoscrollerRunning) {
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
    if (window.__modCoordination?.boardAnalyzerRunning || window.__modCoordination?.autoscrollerRunning) {
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
        if (window.__modCoordination?.boardAnalyzerRunning || window.__modCoordination?.autoscrollerRunning) return;
        console.log('[Mod Settings] New game started, re-applying shiny enemies...');
        scheduleTimeout(() => {
          applyShinyEnemies();
        }, 100);
      });
      
      // Listen for game end event
      endGameUnsubscribe = globalThis.state.board.on('emitEndGame', (event) => {
        if (window.__modCoordination?.boardAnalyzerRunning || window.__modCoordination?.autoscrollerRunning) return;
        console.log('[Mod Settings] Game ended, re-applying shiny enemies...');
        scheduleTimeout(() => {
          applyShinyEnemies();
        }, 100);
      });
      
      // Listen for auto-setup board event
      autoSetupUnsubscribe = globalThis.state.board.on('autoSetupBoard', (event) => {
        if (window.__modCoordination?.boardAnalyzerRunning || window.__modCoordination?.autoscrollerRunning) return;
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
        if (window.__modCoordination?.boardAnalyzerRunning || window.__modCoordination?.autoscrollerRunning) return;
        
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
  const pattern = new RegExp(`(?:${enText}|${ptText}) \\((\\d+):(\\d+)\\)`);
  
  const match = textContent.match(pattern);
  if (match) {
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    return minutes + (seconds / 60);
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
        
        // Reset internal timer on new game if using internal timer mode
        if (config.useInternalTimer) {
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
          // Reset internal timer when switching to autoplay if using internal timer mode
          if (config.useInternalTimer) {
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
    
    // Initialize internal timer if using internal timer mode
    if (config.useInternalTimer) {
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
    
    if (config.useInternalTimer) {
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
    playerCountBtn.innerHTML = `<span class="pixel-font-16 text-white animate-in fade-in">Players online: <span class="text-ally/80">${count}</span></span>`;
    playerCountBtn.title = `Players online: ${count} (Last updated: ${playercountState.lastUpdateTime ? playercountState.lastUpdateTime.toLocaleTimeString() : 'Never'})`;
    playerCountBtn.style.color = 'inherit';
  } else {
    playerCountBtn.innerHTML = `<span class="pixel-font-16 text-white animate-in fade-in">Players online: <span class="text-error">?</span></span>`;
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
    btn.innerHTML = '<span class="pixel-font-16 text-white animate-in fade-in">Players online: <span class="text-error">?</span></span>';
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
// 15. Initialization
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
// 17. Exports & Lifecycle Management
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
