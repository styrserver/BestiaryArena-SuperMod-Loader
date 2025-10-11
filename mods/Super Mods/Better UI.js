// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[Better UI] initializing...');

// Default configuration
const defaultConfig = {
  enabled: true,
  showStaminaTimer: true,
  showSettingsButton: true,
  enableMaxCreatures: false,
  maxCreaturesColor: 'prismatic',
  enableMaxShinies: false,
  maxShiniesColor: 'prismatic',
  enableFavorites: true,
  favoriteSymbol: 'heart',
  showSetupLabels: true,
  enableShinyEnemies: false,
  enableAutoplayRefresh: false,
  autoplayRefreshMinutes: 30
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
    console.log('[Better UI] Config loaded from localStorage:', config);
  } else {
    config = Object.assign({}, defaultConfig);
    console.log('[Better UI] No saved config, using defaults:', config);
  }
} catch (error) {
  console.error('[Better UI] Error loading config from localStorage:', error);
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
  NAVIGATION_UL: 'nav ul',
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

// Translations
const TRANSLATIONS = {
  en: {
    settingsTitle: 'Better UI Settings',
    settingsTooltip: 'Better UI Settings',
    showStaminaTimer: 'Show Stamina Timer',
    showSetupLabels: 'Show Setup Labels',
    enableFavorites: 'Enable Favorites',
    shinyEnemies: '⚠️ Shiny Enemies',
    shinyEnemiesWarning: 'Warning: This feature may impact performance during battles due to continuous sprite monitoring. Disable if you experience lag.',
    autoplayRefresh: '⚠️ Autoplay Refresh Browser',
    autoplayRefreshWarning: 'Refreshes browser after X minutes of autoplay time.',
    autoplayRefreshMinutes: 'Minutes:',
    autoplaySessionText: 'Autoplay session',
    enableMaxCreatures: 'Enable Max Creatures',
    color: 'Color:',
    enableShinies: 'Enable Shinies',
    shinyColor: 'Color:',
    close: 'Close'
  },
  pt: {
    settingsTitle: 'Configurações do Better UI',
    settingsTooltip: 'Configurações do Better UI',
    showStaminaTimer: 'Mostrar Temporizador de Stamina',
    showSetupLabels: 'Mostrar Rótulos de Times',
    enableFavorites: 'Ativar Favoritos',
    shinyEnemies: '⚠️ Shiny Inimigos',
    shinyEnemiesWarning: 'Aviso: Este recurso pode afetar o desempenho durante batalhas devido ao monitoramento contínuo de sprites. Desative se você experimentar lag.',
    autoplayRefresh: '⚠️ Atualizar Navegador no Autoplay',
    autoplayRefreshWarning: 'Atualiza o navegador após X minutos de tempo de autoplay.',
    autoplayRefreshMinutes: 'Minutos:',
    autoplaySessionText: 'Sessão autoplay',
    enableMaxCreatures: 'Ativar Criaturas Máximas',
    color: 'Cor:',
    enableShinies: 'Ativar Shinies',
    shinyColor: 'Cor:',
    close: 'Fechar'
  }
};

// Translate function (dynamically detects current language)
const t = (key) => {
  const currentLocale = document.documentElement.lang === 'pt' || 
    document.querySelector('html[lang="pt"]') || 
    window.location.href.includes('/pt/') ? 'pt' : 'en';
  return TRANSLATIONS[currentLocale][key] || TRANSLATIONS.en[key] || key;
};

// =======================
// 3. Global State
// =======================

// Track timeouts for cleanup
const activeTimeouts = new Set();

// State
let staminaTimerElement = null;
let lastStaminaValue = null;
let updateThrottle = null;
let lastUpdateTime = 0;
let staminaObserver = null;
let settingsButton = null;
let tabObserver = null;
let contextMenuObserver = null;
let creatureObserver = null;
let setupLabelsObserver = null;
let scrollLockObserver = null;
let creatureButtonListeners = new WeakMap(); // Track event listeners on creature buttons
let favoriteCreatures = new Map(); // Maps uniqueId -> symbolKey
let autoplayRefreshGameSubscription = null;
let autoplayRefreshSetPlayModeSubscription = null;

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
  
  console.log('[Better UI] Applied flex-nowrap fix for Chrome compatibility');
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

// Get creature unique ID from the monster data (simple lookup by gameId)
function getCreatureIdFromGameId(gameId) {
  const monsters = globalThis.state?.player?.getSnapshot()?.context?.monsters || [];
  const monster = monsters.find(m => m.gameId === gameId);
  return monster ? monster.id : null;
}

function getTier4Monsters() {
  return globalThis.state.player.getSnapshot().context.monsters.filter(
    (m) => m.tier === GAME_CONSTANTS.MAX_TIER
  );
}

function getEliteMonsters() {
  return globalThis.state.player.getSnapshot().context.monsters.filter(isEliteMonster);
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
  `
};

function generateMaxCreaturesCSS(colorOption, colorKey) {
  return CSS_TEMPLATES.maxCreatures(colorOption, colorKey);
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
    return 'Full';
  }
  
  const minutesRemaining = max - current;
  if (minutesRemaining <= 0) {
    return 'Full';
  }
  
  const readyTime = new Date(Date.now() + minutesRemaining * GAME_CONSTANTS.STAMINA_REGEN_MINUTES * 60000);
  
  const hours = readyTime.getHours().toString().padStart(2, '0');
  const minutes = readyTime.getMinutes().toString().padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

// Check if update should be throttled
function shouldThrottleUpdate() {
  const now = Date.now();
  if (now - lastUpdateTime < THROTTLE_SETTINGS.UPDATE) {
    console.log('[Better UI] Update throttled (less than 10s since last update)');
    return true;
  }
  lastUpdateTime = now;
  return false;
}

// Create and style DOM element
function createStyledElement(tagName, className, styles, parentSelector) {
  const element = document.createElement(tagName);
  element.className = className;
  
  // Apply styles
  Object.assign(element.style, styles);
  
  // Insert into DOM if parent selector provided
  if (parentSelector) {
    const parentElement = document.querySelector(parentSelector);
    if (parentElement) {
      parentElement.appendChild(element);
    }
  }
  
  return element;
}

// Schedule timeout and track it for cleanup
function scheduleTimeout(callback, delay) {
  const timeoutId = setTimeout(callback, delay);
  activeTimeouts.add(timeoutId);
  return timeoutId;
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

// Save configuration
function saveConfig() {
  try {
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    console.log('[Better UI] Configuration saved to localStorage:', config);
  } catch (error) {
    console.error('[Better UI] Error saving config:', error);
  }
}

// Load favorites from localStorage
function loadFavorites() {
  try {
    const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
    console.log('[Better UI] Loading favorites from localStorage:', saved);
    if (saved) {
      const data = JSON.parse(saved);
      console.log('[Better UI] Parsed favorites data:', data);
      favoriteCreatures = new Map(Object.entries(data));
      console.log('[Better UI] Loaded', favoriteCreatures.size, 'favorites:', favoriteCreatures);
    } else {
      console.log('[Better UI] No saved favorites found');
    }
  } catch (error) {
    console.error('[Better UI] Error loading favorites:', error);
    favoriteCreatures = new Map();
  }
}

// Save favorites to localStorage
function saveFavorites() {
  try {
    const data = Object.fromEntries(favoriteCreatures);
    const jsonData = JSON.stringify(data);
    localStorage.setItem(FAVORITES_STORAGE_KEY, jsonData);
    console.log('[Better UI] Favorites saved:', favoriteCreatures.size, 'data:', jsonData);
  } catch (error) {
    console.error('[Better UI] Error saving favorites:', error);
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
  console.log('[Better UI] 📤 Lock API request body:', JSON.stringify(requestBody, null, 2));
  
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
    console.log('[Better UI] State update sent via setState');
    
    // Verify and close menu
    scheduleTimeout(() => {
      const monsters = globalThis.state.player.getSnapshot().context.monsters || [];
      const creature = monsters.find(m => m.id === uniqueId);
      console.log('[Better UI] 🔍 Creature AFTER state update:', {
        id: creature?.id,
        gameId: creature?.gameId,
        locked: creature?.locked
      });
      
      if (!creature?.locked) {
        console.error('[Better UI] ❌ CRITICAL: Creature is NOT locked after API call and state update!');
      } else {
        console.log('[Better UI] ✅ Creature is confirmed locked in local state');
      }
      
      // Close context menu
      const contextMenu = document.querySelector('[role="menu"][data-state="open"]');
      if (contextMenu) {
        document.body.click();
        console.log('[Better UI] Context menu closed - right-click again to see updated state');
      }
    }, TIMEOUT_DELAYS.STATE_VERIFY);
  } catch (e) {
    console.error('[Better UI] Failed to update state:', e);
    
    // Fallback: direct update
    try {
      const monsters = globalThis.state.player.getSnapshot().context.monsters || [];
      const creature = monsters.find(m => m.id === uniqueId);
      if (creature) {
        creature.locked = true;
        console.log('[Better UI] Fallback: directly updated creature.locked');
      }
    } catch (fallbackError) {
      console.error('[Better UI] Fallback also failed:', fallbackError);
    }
  }
}

// Toggle favorite status for a creature with a specific symbol
async function toggleFavorite(uniqueId, symbolKey = 'heart') {
  if (favoriteCreatures.has(uniqueId)) {
    // If already favorited, update the symbol instead of removing
    favoriteCreatures.set(uniqueId, symbolKey);
    console.log('[Better UI] Updated favorite symbol to', symbolKey + ':', uniqueId);
  } else {
    favoriteCreatures.set(uniqueId, symbolKey);
    console.log('[Better UI] Added to favorites with symbol', symbolKey + ':', uniqueId);
    
    // Log creature state before locking
    const monstersBefore = globalThis.state.player.getSnapshot().context.monsters || [];
    const creatureBefore = monstersBefore.find(m => m.id === uniqueId);
    console.log('[Better UI] 🔍 Creature BEFORE lock API call:', {
      id: creatureBefore?.id,
      gameId: creatureBefore?.gameId,
      locked: creatureBefore?.locked
    });
    
    // Attempt to lock the creature
    try {
      const data = await lockCreatureAPI(uniqueId);
      console.log('[Better UI] Lock API response:', data);
      
      // API returns null/undefined but the lock still succeeds
      // No need to verify - the local state update handles it
      
      console.log('[Better UI] Locked successfully:', uniqueId);
      updateLocalCreatureLock(uniqueId);
    } catch (error) {
      console.error('[Better UI] Failed to lock creature:', error);
      favoriteCreatures.delete(uniqueId);
      console.log('[Better UI] Removed from favorites due to lock failure:', uniqueId);
    }
  }
  
  saveFavorites();
  updateFavoriteHearts(uniqueId);
}

// Generate color picker dropdown HTML
function generateColorPickerHTML(id, configKey) {
  return `
    <select id="${id}" style="background: #333; color: #ccc; border: 1px solid #555; padding: 4px 8px; border-radius: 4px;">
      ${Object.entries(COLOR_OPTIONS).map(([key, option]) => 
        `<option value="${key}" ${config[configKey] === key ? 'selected' : ''}>${option.name}</option>`
      ).join('')}
    </select>
  `;
}

// Create settings event handler for checkboxes
function createSettingsCheckboxHandler(configKey, onEnable, onDisable) {
  return (checkbox) => {
    checkbox.addEventListener('change', () => {
      config[configKey] = checkbox.checked;
      saveConfig();
      
      if (config[configKey]) {
        onEnable?.();
      } else {
        onDisable?.();
      }
      
      console.log('[Better UI] Setting updated:', { [configKey]: config[configKey] });
    });
  };
}

// Create settings event handler for dropdowns
function createSettingsDropdownHandler(configKey, onChangeCallback) {
  return (dropdown) => {
    dropdown.addEventListener('change', () => {
      config[configKey] = dropdown.value;
      saveConfig();
      onChangeCallback?.();
      console.log('[Better UI] Setting updated:', { [configKey]: config[configKey] });
    });
  };
}

// Show settings modal
function showSettingsModal() {
  try {
    // Create content element with settings
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
          <input type="checkbox" id="stamina-timer-toggle" ${config.showStaminaTimer ? 'checked' : ''} style="transform: scale(1.2);">
          <span>${t('showStaminaTimer')}</span>
        </label>
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
          <input type="checkbox" id="setup-labels-toggle" ${config.showSetupLabels ? 'checked' : ''} style="transform: scale(1.2);">
          <span>${t('showSetupLabels')}</span>
        </label>
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
          <input type="checkbox" id="favorites-toggle" ${config.enableFavorites ? 'checked' : ''} style="transform: scale(1.2);">
          <span>${t('enableFavorites')}</span>
        </label>
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
          <input type="checkbox" id="rainbow-tiers-toggle" ${config.enableMaxCreatures ? 'checked' : ''} style="transform: scale(1.2);">
          <span>${t('enableMaxCreatures')}</span>
        </label>
      </div>
      <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
        <span style="color: #ccc;">${t('color')}</span>
        ${generateColorPickerHTML('color-picker', 'maxCreaturesColor')}
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
          <input type="checkbox" id="shinies-toggle" ${config.enableMaxShinies ? 'checked' : ''} style="transform: scale(1.2);">
          <span>${t('enableShinies')}</span>
        </label>
      </div>
      <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
        <span style="color: #ccc;">${t('shinyColor')}</span>
        ${generateColorPickerHTML('shiny-color-picker', 'maxShiniesColor')}
      </div>
      <div class="separator my-2.5" role="none" style="margin: 10px 0px;"></div>
      <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
          <input type="checkbox" id="shiny-enemies-toggle" ${config.enableShinyEnemies ? 'checked' : ''} style="transform: scale(1.2);">
          <span style="cursor: help; font-size: 16px; color: #ffaa00;" title="${t('shinyEnemiesWarning')}">${t('shinyEnemies')}</span>
        </label>
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
          <input type="checkbox" id="autoplay-refresh-toggle" ${config.enableAutoplayRefresh ? 'checked' : ''} style="transform: scale(1.2);">
          <span style="cursor: help; font-size: 16px; color: #ffaa00;" title="${t('autoplayRefreshWarning')}">${t('autoplayRefresh')}</span>
        </label>
      </div>
      <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
        <span style="color: #ccc;">${t('autoplayRefreshMinutes')}</span>
        <input type="number" id="autoplay-refresh-minutes" value="${config.autoplayRefreshMinutes}" min="1" max="120" style="width: 80px; padding: 4px 8px; border: 1px solid #555; background: #2a2a2a; color: #fff; border-radius: 4px;">
      </div>
    `;
    
    // Setup event handlers using factories
    const staminaCheckbox = content.querySelector('#stamina-timer-toggle');
    createSettingsCheckboxHandler('showStaminaTimer',
      () => {
        if (staminaTimerElement) {
          staminaTimerElement.style.display = 'inline';
        } else {
          updateStaminaTimer();
        }
      },
      () => {
        if (staminaTimerElement) {
          staminaTimerElement.style.display = 'none';
        }
      }
    )(staminaCheckbox);
    
    const rainbowCheckbox = content.querySelector('#rainbow-tiers-toggle');
    createSettingsCheckboxHandler('enableMaxCreatures', applyMaxCreatures, removeMaxCreatures)(rainbowCheckbox);
    
    const colorPicker = content.querySelector('#color-picker');
    createSettingsDropdownHandler('maxCreaturesColor', () => {
      if (config.enableMaxCreatures) applyMaxCreatures();
    })(colorPicker);
    
    const shiniesCheckbox = content.querySelector('#shinies-toggle');
    createSettingsCheckboxHandler('enableMaxShinies', applyMaxShinies, removeMaxShinies)(shiniesCheckbox);
    
    const shinyColorPicker = content.querySelector('#shiny-color-picker');
    createSettingsDropdownHandler('maxShiniesColor', () => {
      if (config.enableMaxShinies) applyMaxShinies();
    })(shinyColorPicker);
    
    const favoritesCheckbox = content.querySelector('#favorites-toggle');
    createSettingsCheckboxHandler('enableFavorites',
      updateFavoriteHearts,
      removeFavoriteHearts
    )(favoritesCheckbox);
    
    const setupLabelsCheckbox = content.querySelector('#setup-labels-toggle');
    createSettingsCheckboxHandler('showSetupLabels',
      () => {
        // Show setup labels
        applySetupLabelsVisibility(true);
        console.log('[Better UI] Setup labels shown');
      },
      () => {
        // Hide setup labels
        applySetupLabelsVisibility(false);
        console.log('[Better UI] Setup labels hidden');
      }
    )(setupLabelsCheckbox);
    
    const shinyEnemiesCheckbox = content.querySelector('#shiny-enemies-toggle');
    createSettingsCheckboxHandler('enableShinyEnemies',
      () => {
        startBattleBoardObserver();
        applyShinyEnemies();
      },
      removeShinyEnemies
    )(shinyEnemiesCheckbox);
    
    const autoplayRefreshCheckbox = content.querySelector('#autoplay-refresh-toggle');
    if (autoplayRefreshCheckbox) {
      autoplayRefreshCheckbox.addEventListener('change', () => {
        config.enableAutoplayRefresh = autoplayRefreshCheckbox.checked;
        saveConfig();
        
        if (autoplayRefreshCheckbox.checked) {
          console.log('[Better UI] Autoplay refresh enabled via settings');
          startAutoplayRefreshMonitor();
        } else {
          console.log('[Better UI] Autoplay refresh disabled via settings');
          stopAutoplayRefreshMonitor();
        }
      });
    }
    
    const autoplayRefreshMinutesInput = content.querySelector('#autoplay-refresh-minutes');
    if (autoplayRefreshMinutesInput) {
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
    
    // Store modal reference for button handlers
    let modalRef = null;
    
    // Create modal using the API
    modalRef = api.ui.components.createModal({
      title: t('settingsTitle'),
      width: 300,
      content: content,
      buttons: [
        {
          text: t('close'),
          primary: true,
          closeOnClick: true,
          onClick: () => {
            console.log('[Better UI] Settings modal closed');
          }
        }
      ]
    });
    
  } catch (error) {
    console.error('[Better UI] Error showing settings modal:', error);
  }
}

// Create settings button
function createSettingsButton() {
  try {
    const currencyContainer = document.querySelector(SELECTORS.CURRENCY_CONTAINER);
    if (!currencyContainer) {
      console.log('[Better UI] Currency container not found');
      return;
    }
    
    // Fix Chrome flexbox wrapping
    applyChromeFlex();
    
    // Create settings button matching the currency button style
    const settingsButtonElement = document.createElement('button');
    settingsButtonElement.className = 'focus-style-visible';
    settingsButtonElement.title = t('settingsTooltip');
    settingsButtonElement.innerHTML = `
      <div class="pixel-font-16 frame-pressed-1 surface-darker flex items-center justify-end gap-1 px-1.5 pb-px text-right text-whiteRegular">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5M19.43 12.97c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.4-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
        </svg>
      </div>
    `;
    
    // Add click event listener
    settingsButtonElement.addEventListener('click', showSettingsModal);
    
    // Insert after the gold button (last currency button)
    currencyContainer.appendChild(settingsButtonElement);
    
    // Store reference for cleanup
    settingsButton = settingsButtonElement;
    console.log('[Better UI] Settings button created in currency section');
    
  } catch (error) {
    console.error('[Better UI] Error creating settings button:', error);
  }
}

// =======================
// 5. Favorite Creatures Functions
// =======================

// Get creature name from context menu
function getCreatureNameFromMenu(menuElem) {
  // Look for the group element (like Cyclopedia does)
  const group = menuElem.querySelector('div[role="group"]');
  console.log('[Better UI] Found group:', group);
  if (!group) {
    console.log('[Better UI] No group found in menu');
    return null;
  }
  
  // Get first item from the group
  const firstItem = group.querySelector('.dropdown-menu-item');
  console.log('[Better UI] getCreatureNameFromMenu - firstItem:', firstItem);
  if (!firstItem) {
    console.log('[Better UI] No first item found in group');
    return null;
  }
  
  const text = firstItem.textContent;
  console.log('[Better UI] First item text:', text);
  
  // Check for monster pattern: "Monster Name (X%)"
  const monsterMatch = text.match(/^(.*?)\s*\(\d+%\)/);
  console.log('[Better UI] Monster match:', monsterMatch);
  if (monsterMatch) {
    return monsterMatch[1].trim();
  }
  
  // Check for equipment pattern: "Equipment Name (Tier: X)"
  const equipmentMatch = text.match(/^(.*?)\s*\(Tier: \d+\)/);
  console.log('[Better UI] Equipment match:', equipmentMatch);
  if (equipmentMatch) {
    return equipmentMatch[1].trim();
  }
  
  console.log('[Better UI] No pattern match found');
  return null;
}

// Validate if context menu should receive favorite button
function validateContextMenu(menuElem) {
  if (!config.enableFavorites) {
    console.log('[Better UI] Validation failed: enableFavorites is false');
    return false;
  }
  if (isScrollLocked()) {
    console.log('[Better UI] Validation failed: scroll is locked');
    return false;
  }
  if (menuElem.hasAttribute('data-favorite-processed')) {
    console.log('[Better UI] Validation failed: already processed');
    return false;
  }
  
  const creatureName = getCreatureNameFromMenu(menuElem);
  if (!creatureName) {
    console.log('[Better UI] Validation failed: no creature name found');
    return false;
  }
  
  const menuText = menuElem.textContent || '';
  if (/\(Tier: \d+\)/.test(menuText)) {
    console.log('[Better UI] Validation failed: tier list detected');
    return false;
  }
  if (menuText.toLowerCase().includes('my account') || menuText.toLowerCase().includes('logout')) {
    console.log('[Better UI] Validation failed: account menu detected');
    return false;
  }
  if (menuText.toLowerCase().includes('game mode') || menuText.toLowerCase().includes('manual')) {
    console.log('[Better UI] Validation failed: game mode menu detected');
    return false;
  }
  
  console.log('[Better UI] Validation passed for creature:', creatureName);
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
  
  const monsters = globalThis.state.player.getSnapshot().context.monsters || [];
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
  item.className = 'focus-style dropdown-menu-item flex cursor-default select-none items-center gap-2 outline-none';
  item.setAttribute('role', 'menuitem');
  item.setAttribute('aria-haspopup', 'menu');
  item.setAttribute('aria-expanded', 'false');
  item.setAttribute('aria-controls', 'favorite-submenu');
  item.setAttribute('data-state', 'closed');
  item.setAttribute('tabindex', '-1');
  item.setAttribute('data-orientation', 'vertical');
  item.setAttribute('data-radix-collection-item', '');
  item.style.cssText = 'color: white; background: transparent; padding: 4px 8px; font-size: 16px; font-weight: 400; line-height: 1;';
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
  
  const isFavorite = uniqueId ? favoriteCreatures.has(uniqueId) : false;
  
  Object.entries(FAVORITE_SYMBOLS).forEach(([symbolKey, symbol]) => {
    const symbolItem = document.createElement('div');
    symbolItem.className = 'dropdown-menu-item relative flex cursor-default select-none items-center gap-2 outline-none';
    symbolItem.setAttribute('role', 'menuitem');
    symbolItem.setAttribute('tabindex', '-1');
    symbolItem.setAttribute('data-orientation', 'vertical');
    symbolItem.setAttribute('data-radix-collection-item', '');
    symbolItem.style.cssText = 'color: white; background: transparent; padding: 4px 8px; font-size: 16px; font-weight: 400; line-height: 1;';
    
    symbolItem.addEventListener('mouseenter', () => symbolItem.style.background = 'rgba(255, 255, 255, 0.15)');
    symbolItem.addEventListener('mouseleave', () => symbolItem.style.background = 'transparent');
    
    const isCurrentSymbol = isFavorite && currentSymbol === symbolKey;
    let iconElement = '';
    if (!symbol.isNone) {
      iconElement = symbolKey === 'heart' ? symbol.icon : `<img src="${symbol.icon}" width="24" height="24" style="image-rendering: pixelated;" alt="${symbol.name}">`;
    }
    
    symbolItem.innerHTML = `${iconElement}${symbol.name}${isCurrentSymbol ? ' ✓' : ''}`;
    
    symbolItem.addEventListener('click', (e) => {
      e.stopPropagation();
      if (uniqueId) {
        if (symbol.isNone) {
          favoriteCreatures.delete(uniqueId);
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
  console.log('[Better UI] injectFavoriteButton called');
  if (!validateContextMenu(menuElem)) {
    console.log('[Better UI] validateContextMenu failed');
    return false;
  }
  
  console.log('[Better UI] Validation passed, injecting favorite button');
  menuElem.setAttribute('data-favorite-processed', 'true');
  
  const creatureData = identifyCreatureFromMenu(menuElem);
  const uniqueId = creatureData?.uniqueId || null;
  const currentSymbol = uniqueId ? favoriteCreatures.get(uniqueId) : null;
  
  const favoriteMainItem = createFavoriteMainMenuItem();
  const submenu = createFavoriteSubmenu(uniqueId, currentSymbol);
  
  attachSubmenuHandlers(favoriteMainItem, submenu);
  
  favoriteMainItem.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>Favorite<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right ml-auto" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;
  
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
  
  console.log('[Better UI] Favorite button injected successfully');
  return true;
}

// Remove all favorite hearts
function removeFavoriteHearts() {
  document.querySelectorAll('.favorite-heart').forEach(heart => heart.remove());
  console.log('[Better UI] All favorite hearts removed');
}

// Update heart icons on creature portraits
function updateFavoriteHearts(targetUniqueId = null) {
  console.log('[Better UI] updateFavoriteHearts called with targetUniqueId:', targetUniqueId);
  
  // Skip if Board Analyzer is running
  if (window.__modCoordination?.boardAnalyzerRunning) {
    console.log('[Better UI] Skipping updateFavoriteHearts - Board Analyzer active');
    return;
  }
  
  if (!config.enableFavorites) {
    console.log('[Better UI] Favorites disabled, removing hearts');
    removeFavoriteHearts();
    return;
  }
  
  if (isScrollLocked()) {
    console.log('[Better UI] Scroll locked, skipping update (not removing hearts)');
    return;
  }
  
  // Only process creatures in the main collection grid
  // This excludes creatures on the board, in menus, modals, etc.
  const creaturesContainer = document.querySelector('[data-testid="monster-grid"]') || 
                             document.querySelector('.grid') ||
                             document.querySelector('[class*="grid"]');
  if (!creaturesContainer) {
    console.log('[Better UI] Creatures container not found, skipping update');
    return;
  }
  
  const allCreatures = getVisibleCreatures();
  const creatures = Array.from(allCreatures).filter(img => {
    return creaturesContainer.contains(img);
  });
  console.log('[Better UI] Found', creatures.length, 'visible creatures in collection');
  
  // If no creatures visible, don't remove existing hearts - collection might be transitioning
  if (creatures.length === 0) {
    console.log('[Better UI] No creatures visible, skipping update (not removing hearts)');
    return;
  }
  
  const monsters = globalThis.state?.player?.getSnapshot()?.context?.monsters || [];
  
  resetCreatureMatchingIndex();
  
  // Remove all existing hearts first (only when we have creatures to re-apply them)
  removeFavoriteHearts();
  
  let heartsAdded = 0;
  let creaturesChecked = 0;
  let targetFound = false;
  
  creatures.forEach((imgEl, idx) => {
    const identifiedMonster = matchCreatureBySequentialIndex(imgEl, monsters);
    const uniqueId = identifiedMonster?.id;
    if (!uniqueId) return;
    
    creaturesChecked++;
    
    // Skip if we're only updating a specific creature
    if (targetUniqueId && uniqueId !== targetUniqueId) {
      return;
    }
    
    if (targetUniqueId && uniqueId === targetUniqueId) {
      targetFound = true;
      console.log('[Better UI] Found target creature at DOM index:', idx, 'gameId:', gameId, 'uniqueId:', uniqueId);
    }
    
    const isFavorite = favoriteCreatures.has(uniqueId);
    const container = imgEl.parentElement;
    
    // Add favorite symbol if favorited
    if (isFavorite) {
      const symbolKey = favoriteCreatures.get(uniqueId) || 'heart';
      const symbol = FAVORITE_SYMBOLS[symbolKey] || FAVORITE_SYMBOLS.heart;
      
      console.log('[Better UI] Adding favorite heart for:', uniqueId, 'symbolKey:', symbolKey);
      
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
      container.appendChild(heart);
      heartsAdded++;
      console.log('[Better UI] Heart added successfully for:', uniqueId);
    }
  });
  
  console.log('[Better UI] updateFavoriteHearts completed. Creatures checked:', creaturesChecked, 'Total hearts added:', heartsAdded);
  if (targetUniqueId) {
    console.log('[Better UI] Target search result:', targetFound ? `Found ${targetUniqueId}` : `NOT FOUND: ${targetUniqueId}`);
  }
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
  
  const matchingMonsters = monsters.filter(m => m.gameId === gameId).map(m => {
    m._statSum = (m.hp || 0) + (m.ad || 0) + (m.ap || 0) + (m.armor || 0) + (m.magicResist || 0);
    return m;
  }).sort((a, b) => {
    const gameIdCompare = (a.gameId || 0) - (b.gameId || 0);
    if (gameIdCompare !== 0) return gameIdCompare;
    return b._statSum - a._statSum;
  });
  
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

// Sort monsters by visual grid order: Level (desc) → Tier (desc) → GameID (asc) → Stats (desc)
function sortMonstersByVisualOrder(monsters) {
  return monsters.map(m => ({
    ...m,
    _level: getLevelFromExp(m.exp),
    _statSum: (m.hp || 0) + (m.ad || 0) + (m.ap || 0) + (m.armor || 0) + (m.magicResist || 0)
  })).sort((a, b) => {
    if (a._level !== b._level) return b._level - a._level;
    const tierA = a.tier || 0;
    const tierB = b.tier || 0;
    if (tierA !== tierB) return tierB - tierA;
    const gameIdCompare = String(a.gameId).localeCompare(String(b.gameId));
    if (gameIdCompare !== 0) return gameIdCompare;
    return b._statSum - a._statSum;
  });
}

// Match monster by stat percentage
function matchMonsterByPercentage(matchingMonsters, percentage, displayedLevel) {
  const monstersWithPercentage = matchingMonsters.filter(m => {
    const statSum = (m.hp || 0) + (m.ad || 0) + (m.ap || 0) + (m.armor || 0) + (m.magicResist || 0);
    return statSum === percentage;
  });
  
  console.log('[Better UI] Found', monstersWithPercentage.length, 'monster(s) with', percentage + '%');
  
  if (monstersWithPercentage.length === 0) return null;
  if (monstersWithPercentage.length === 1) return monstersWithPercentage[0];
  
  // Multiple monsters with same percentage - use level to disambiguate
  if (displayedLevel) {
    console.log('[Better UI] Multiple monsters with same percentage, using displayed level:', displayedLevel);
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
  
  console.log('[Better UI] getCreatureUniqueId - Target gameId:', gameId);
  if (contextMenuPercentage !== null) {
    console.log('[Better UI] getCreatureUniqueId - Context menu percentage provided:', contextMenuPercentage + '%');
  }
  
  // Get all monsters from game state
  const monsters = globalThis.state?.player?.getSnapshot()?.context?.monsters || [];
  const matchingMonsters = sortMonstersByVisualOrder(monsters.filter(m => m.gameId === gameId));
  
  console.log('[Better UI] getCreatureUniqueId - Found', matchingMonsters.length, 'monsters in game state with gameId', gameId);
  console.log('[Better UI] getCreatureUniqueId - Monster IDs in SORTED order:', matchingMonsters.map(m => {
    const level = getLevelFromExp(m.exp || 0);
    return `${m.id} (lvl ${level})`;
  }));
  
  // Get ALL visible creatures in DOM order, EXCLUDING creatures inside context menus or modals
  const allVisibleCreatures = Array.from(document.querySelectorAll('img[alt="creature"]')).filter(img => {
    // Exclude creatures inside context menus
    const isInContextMenu = img.closest('[role="menu"]');
    // Exclude creatures inside dialogs/modals
    const isInModal = img.closest('[role="dialog"]');
    return !isInContextMenu && !isInModal;
  });
  console.log('[Better UI] getCreatureUniqueId - Total visible creatures in DOM (excluding menus/modals):', allVisibleCreatures.length);
  console.log('[Better UI] getCreatureUniqueId - All creatures in DOM order:', allVisibleCreatures.map((img, i) => {
    const gid = getCreatureGameId(img);
    return `${i}: gameId ${gid}`;
  }));
  
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
    
    // Check for any unique identifiers on the button
    const buttonData = {
      'data-gameid': button.getAttribute('data-gameid'),
      'data-picked': button.getAttribute('data-picked'),
      'data-state': button.getAttribute('data-state'),
      'aria-describedby': button.getAttribute('aria-describedby'),
      'tabindex': button.getAttribute('tabindex'),
      'class': button.className,
      'id': button.id
    };
    
    console.log('[Better UI] getCreatureUniqueId - FOUND target at DOM position', i);
    console.log('[Better UI] getCreatureUniqueId - Displayed level:', displayedLevel);
    console.log('[Better UI] getCreatureUniqueId - Button data:', buttonData);
    console.log('[Better UI] getCreatureUniqueId - This is the', currentIndex, 'th creature with gameId', currentGameId);
    
    // Try to match by context menu percentage first (most reliable)
    let identifiedMonster = matchingMonsters[currentIndex];
    let matchedByPercentage = false;
    
    if (contextMenuPercentage !== null) {
      console.log('[Better UI] getCreatureUniqueId - Using provided percentage:', contextMenuPercentage + '%');
      const monster = matchMonsterByPercentage(matchingMonsters, contextMenuPercentage, displayedLevel);
      
      if (monster) {
        identifiedMonster = monster;
        matchedByPercentage = true;
        console.log('[Better UI] getCreatureUniqueId - Matched by percentage:', contextMenuPercentage + '%', '→', monster.id);
      } else {
        console.warn('[Better UI] getCreatureUniqueId - No monster found with percentage:', contextMenuPercentage + '%');
      }
    }
    
    // Fallback to level-based matching if percentage matching failed
    if (!matchedByPercentage && displayedLevel) {
      const button = currentImg.closest('button');
      const isShiny = currentImg.src.includes('-shiny');
      const hasStars = button.querySelector('.tier-stars') !== null;
      
      console.log('[Better UI] getCreatureUniqueId - Visual clues:', { level: displayedLevel, isShiny, hasStars });
      
      const bestMatch = matchMonsterByLevelAndVisuals(matchingMonsters, displayedLevel, isShiny, hasStars);
      if (bestMatch) {
        identifiedMonster = bestMatch;
        console.log('[Better UI] getCreatureUniqueId - Matched by level + visual clues');
      }
    }
    
    console.log('[Better UI] getCreatureUniqueId - Mapping to monster:', identifiedMonster?.id);
    console.log('[Better UI] getCreatureUniqueId - Monster stats:', calculateCreatureStats(identifiedMonster));
    
    return {
      uniqueId: identifiedMonster?.id,
      gameId: currentGameId,
      index: currentIndex
    };
  }
    
    // Increment the index for next creature with same gameId
    gameIdIndexMap.set(currentGameId, currentIndex + 1);
  }
  
  console.error('[Better UI] getCreatureUniqueId - FAILED to find target in DOM!');
  return null;
}

// Store reference to the currently right-clicked creature
let currentRightClickedCreature = null;

// Start context menu observer
function startContextMenuObserver() {
  if (contextMenuObserver) {
    console.log('[Better UI] Context menu observer already running');
    return;
  }
  
  console.log('[Better UI] Starting context menu observer...');
  
  // Handle right-click on creature button
  function handleCreatureRightClick(event) {
    const creatureImg = event.target.closest('button').querySelector('img[alt="creature"]');
    if (creatureImg) {
      // Store just the image element - we'll identify it properly when the context menu appears
      currentRightClickedCreature = { creatureImg };
      console.log('[Better UI] Right-clicked creature stored (will identify from context menu)');
    }
  }
  
  // First, add right-click listeners to all creature buttons
  function addRightClickListeners() {
    const creatureButtons = document.querySelectorAll('button[data-picked]');
    creatureButtons.forEach(button => {
      // Only add listener if not already added
      if (!creatureButtonListeners.has(button)) {
        button.addEventListener('contextmenu', handleCreatureRightClick);
        creatureButtonListeners.set(button, handleCreatureRightClick);
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
  
  contextMenuObserver = createThrottledObserver(processMenuMutations, 50);
  
  // Observe both document.body and document.documentElement to catch portals
  contextMenuObserver.observe(document.body, { childList: true, subtree: true });
  
  // Initial setup
  addRightClickListeners();
  
  console.log('[Better UI] Context menu observer started and observing document.body');
}

// Stop context menu observer
function stopContextMenuObserver() {
  if (contextMenuObserver) {
    contextMenuObserver.disconnect();
    contextMenuObserver = null;
    console.log('[Better UI] Context menu observer stopped');
  }
  
  // Remove all creature button event listeners
  const creatureButtons = document.querySelectorAll('button[data-picked]');
  let removedCount = 0;
  creatureButtons.forEach(button => {
    const listener = creatureButtonListeners.get(button);
    if (listener) {
      button.removeEventListener('contextmenu', listener);
      creatureButtonListeners.delete(button);
      removedCount++;
    }
  });
  if (removedCount > 0) {
    console.log(`[Better UI] Removed ${removedCount} creature button event listeners`);
  }
}

// =======================
// 6. Rainbow Tiers Functions
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
    console.error(`[Better UI] Error applying ${name}:`, error);
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
  
  console.log(`[Better UI] Max creatures applied with ${colorOption.name} color`);
}

function applyMaxCreatures() {
  // Skip if Board Analyzer is running
  if (window.__modCoordination?.boardAnalyzerRunning) {
    console.log('[Better UI] Skipping applyMaxCreatures - Board Analyzer active');
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
    
    console.log('[Better UI] Max creatures styling removed');
  } catch (error) {
    console.error('[Better UI] Error removing max creatures styling:', error);
  }
}

// =======================
// 7. Max Shinies Functions
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
  
  // Generate CSS for shinies - matching Max Creatures styling
  style.textContent = `
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
  `;
  
  console.log(`[Better UI] Max shinies applied with ${colorOption.name} color`);
}

function applyMaxShinies() {
  // Skip if Board Analyzer is running
  if (window.__modCoordination?.boardAnalyzerRunning) {
    console.log('[Better UI] Skipping applyMaxShinies - Board Analyzer active');
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
    
    console.log('[Better UI] Max shinies styling removed');
  } catch (error) {
    console.error('[Better UI] Error removing max shinies styling:', error);
  }
}

// =======================
// 7.5. Shiny Enemies
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
function isCreatureUnobtainable(creatureName) {
  if (!creatureName) return false;
  const UNOBTAINABLE_CREATURES = window.creatureDatabase?.UNOBTAINABLE_CREATURES || [];
  return UNOBTAINABLE_CREATURES.some(c => c.toLowerCase() === creatureName.toLowerCase());
}

// Helper: Check if a battle container is an enemy (red health bar)
function isEnemyByHealthBar(battleContainer) {
  const healthBar = battleContainer.querySelector('.h-full.shrink-0');
  return healthBar && healthBar.style.background && 
         healthBar.style.background.includes('rgb(255, 102, 102)');
}

function applyShinyEnemies() {
  // Skip if Board Analyzer is running
  if (window.__modCoordination?.boardAnalyzerRunning) {
    console.log('[Better UI] Skipping applyShinyEnemies - Board Analyzer active');
    return;
  }
  
  try {
    // Get board configuration from game state
    const boardSnapshot = globalThis.state?.board?.getSnapshot();
    const boardConfig = boardSnapshot?.context?.boardConfig;
    
    if (!boardConfig || !Array.isArray(boardConfig)) {
      console.log('[Better UI] No board configuration available yet (not in a game)');
      return;
    }
    
    
    // Filter for enemies (villain: true)
    const enemies = boardConfig.filter(entity => entity.villain === true);
    
    if (enemies.length === 0) {
      console.log('[Better UI] No enemies found on board - start a battle to see shiny enemies!');
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
      
      // Skip unobtainable creatures
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
        const spriteImg = spriteDiv.querySelector('img.spritesheet[data-shiny]');
        if (spriteImg && spriteImg.getAttribute('data-shiny') === 'false') {
          spriteImg.setAttribute('data-shiny', 'true');
          appliedCount++;
        }
      });
    });
    
    // Also apply shiny to all item sprites in battle (e.g., sleeping Bear uses item sprite 7175)
    // These are state-based sprite variations that don't match the creature's main spriteId
    const itemSprites = document.querySelectorAll('.sprite.item img.spritesheet[data-shiny="false"]');
    itemSprites.forEach(img => {
      const battleContainer = img.closest('[data-name]');
      if (battleContainer && isEnemyByHealthBar(battleContainer)) {
        img.setAttribute('data-shiny', 'true');
        appliedCount++;
      }
    });
    
    // Apply shiny to visual-only summons (e.g., War Wolf) not in boardConfig
    const allBattleContainers = document.querySelectorAll('[data-name]');
    
    allBattleContainers.forEach(container => {
      const creatureName = container.getAttribute('data-name');
      
      if (isEnemyByHealthBar(container)) {
        const outfitSprites = container.querySelectorAll('.sprite.outfit img.spritesheet[data-shiny="false"]');
        
        outfitSprites.forEach(spriteImg => {
          if (!isCreatureUnobtainable(creatureName)) {
            spriteImg.setAttribute('data-shiny', 'true');
            appliedCount++;
          }
        });
      }
    });
    
    // Only log when something actually happened
    if (appliedCount > 0 || skippedCount > 0) {
      console.log(`[Better UI] Shiny enemies applied to ${appliedCount} creatures (skipped ${skippedCount} unobtainable)`);
    }
  } catch (error) {
    console.error('[Better UI] Error applying shiny enemies:', error);
  }
}

function removeShinyEnemies() {
  try {
    // Reset all actor sprites to non-shiny (simpler approach for removal)
    const allActorSprites = document.querySelectorAll('img.actor.spritesheet[data-shiny="true"]');
    
    allActorSprites.forEach(spriteImg => {
      spriteImg.setAttribute('data-shiny', 'false');
    });
    
    console.log('[Better UI] Shiny enemies removed from', allActorSprites.length, 'sprites');
    
    // Stop the battle board observer
    stopBattleBoardObserver();
  } catch (error) {
    console.error('[Better UI] Error removing shiny enemies:', error);
  }
}

// =======================
// 8. Setup Labels Visibility Functions
// =======================

// Apply setup labels visibility
function applySetupLabelsVisibility(show) {
  const setupContainer = document.querySelector('.mb-2.flex.items-center.gap-2');
  if (setupContainer) {
    setupContainer.style.display = show ? '' : 'none';
    console.log('[Better UI] Setup labels container visibility:', show ? 'visible' : 'hidden');
  }
}

// Start observer for setup labels container
function startSetupLabelsObserver() {
  console.log('[Better UI] Starting setup labels observer');
  
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
// 9. Stamina Timer Functions
// =======================

// Update stamina timer display
function updateStaminaTimer() {
  const staminaDiv = document.querySelector(SELECTORS.STAMINA_DIV);
  if (!staminaDiv) {
    console.log('[Better UI] Stamina button not found');
    return;
  }
  
  try {
    // Find the parent span that contains the stamina values
    const parentSpan = staminaDiv.querySelector(SELECTORS.STAMINA_PARENT_SPAN);
    if (!parentSpan) {
      console.log('[Better UI] Parent stamina span not found');
      return;
    }
    
    // Parse stamina values
    const staminaValues = parseStaminaValues(parentSpan);
    if (!staminaValues) {
      console.log('[Better UI] Invalid stamina values');
      return;
    }
    
    const { current: currentStamina, max: maxStamina } = staminaValues;
    console.log('[Better UI] Stamina values:', staminaValues);
    
    // Check if stamina value changed
    const staminaChanged = lastStaminaValue !== currentStamina;
    if (staminaChanged) {
      console.log('[Better UI] Stamina changed from', lastStaminaValue, 'to', currentStamina);
      lastStaminaValue = currentStamina;
      
      // Check throttle
      if (shouldThrottleUpdate()) {
        return;
      }
      
      // Calculate ready time
      const readyTime = calculateStaminaReadyTime(currentStamina, maxStamina);
      console.log('[Better UI] Ready time calculated:', readyTime);
      
      // Update timer only if stamina changed
      updateTimerDisplay(readyTime);
    } else {
      // No stamina change, exit early
      return;
    }
  } catch (error) {
    console.error('[Better UI] Error updating stamina timer:', error);
  }
}

// Helper function to update timer display
function updateTimerDisplay(readyTime) {
  // Check if timer should be shown based on config
  if (!config.showStaminaTimer) {
    console.log('[Better UI] Timer display skipped (disabled in config)');
    return;
  }
  
  // Find or create timer element
  if (!staminaTimerElement) {
    console.log('[Better UI] Creating stamina timer element');
    
    // Create timer element with styles
    staminaTimerElement = document.createElement('span');
    staminaTimerElement.className = 'better-ui-stamina-timer';
    Object.assign(staminaTimerElement.style, TIMER_STYLES);
    
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
        parentSpan.appendChild(staminaTimerElement);
      }
    }
  }
  
  // Update timer text
  if (readyTime === 'Full') {
    staminaTimerElement.textContent = ` 🕐Full`;
    console.log('[Better UI] Stamina is full, showing Full status');
  } else {
    staminaTimerElement.textContent = ` 🕐${readyTime}`;
    console.log('[Better UI] Timer updated to:', readyTime);
  }
}

// Initialize stamina timer with retry logic
function initStaminaTimer() {
  console.log('[Better UI] Initializing stamina timer');
  
  const tryInit = () => {
    const staminaDiv = document.querySelector(SELECTORS.STAMINA_DIV);
    if (!staminaDiv) {
      console.log('[Better UI] Stamina button not found, retrying in 500ms');
      scheduleTimeout(tryInit, TIMEOUT_DELAYS.INIT_RETRY);
      return;
    }
    
    // Fix Chrome flexbox wrapping
    applyChromeFlex();
    
    const staminaButton = staminaDiv.closest('button');
    console.log('[Better UI] Stamina button found, setting up timer');
    
    // Initial update
    updateStaminaTimer();
    
    // Also update when stamina changes (observe only the stamina values span)
    console.log('[Better UI] Setting up MutationObserver for stamina changes');
    const staminaSpan = staminaDiv.querySelector(SELECTORS.STAMINA_PARENT_SPAN);
    if (staminaSpan) {
      staminaObserver = new MutationObserver((mutations) => {
        // Throttle updates to prevent spam
        if (updateThrottle) return;
        updateThrottle = setTimeout(() => {
          activeTimeouts.delete(updateThrottle);
          updateThrottle = null;
          console.log('[Better UI] Stamina span changed, checking timer');
          updateStaminaTimer();
        }, THROTTLE_SETTINGS.DOM_CHECK);
        activeTimeouts.add(updateThrottle);
      });
      
      staminaObserver.observe(staminaSpan, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    
    console.log('[Better UI] Stamina timer initialization complete');
  };
  
  tryInit();
}

// Setup tab observer to reapply max creatures when switching tabs
function initTabObserver() {
  try {
    // Disconnect existing observer if any
    if (tabObserver) {
      tabObserver.disconnect();
    }
    
    // Find the tab list
    const tabList = document.querySelector('div[role="tablist"]');
    if (!tabList) {
      console.warn('[Better UI] Tab list not found, tab observer not initialized');
      return;
    }
    
    console.log('[Better UI] Setting up tab observer');
    
    // Create observer to watch for tab changes
    tabObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Check if a tab's state changed
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
          const target = mutation.target;
          const newState = target.getAttribute('data-state');
          const tabId = target.getAttribute('id');
          
          // If Bestiary tab became active, check if we need to reapply
          if (newState === 'active' && tabId && tabId.includes('monster')) {
            console.log('[Better UI] Bestiary tab activated, checking config...', { enableMaxCreatures: config.enableMaxCreatures, enableMaxShinies: config.enableMaxShinies });
            if (config.enableMaxCreatures) {
              console.log('[Better UI] Reapplying max creatures');
              scheduleTimeout(() => {
                applyMaxCreatures();
              }, TIMEOUT_DELAYS.TAB_REAPPLY);
            } else {
              console.log('[Better UI] Max creatures disabled, skipping');
            }
            if (config.enableMaxShinies) {
              console.log('[Better UI] Reapplying max shinies');
              scheduleTimeout(() => {
                applyMaxShinies();
              }, TIMEOUT_DELAYS.TAB_REAPPLY);
            } else {
              console.log('[Better UI] Max shinies disabled, skipping');
            }
            if (config.enableShinyEnemies) {
              console.log('[Better UI] Reapplying shiny enemies');
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
      tabObserver.observe(button, {
        attributes: true,
        attributeFilter: ['data-state']
      });
    });
    
    console.log(`[Better UI] Tab observer initialized, watching ${tabButtons.length} tabs`);
  } catch (error) {
    console.error('[Better UI] Error initializing tab observer:', error);
  }
}

// Start observer for creature container changes (search filtering)
function startCreatureContainerObserver() {
  console.log('[Better UI] Starting creature container observer...');
  
  // Find the creature container
  const creatureContainer = document.querySelector('[data-testid="monster-grid"]') || 
                           document.querySelector('.grid') ||
                           document.querySelector('[class*="grid"]');
  
  if (!creatureContainer) {
    console.log('[Better UI] Creature container not found, retrying in 1 second...');
    scheduleTimeout(startCreatureContainerObserver, TIMEOUT_DELAYS.OBSERVER_RETRY);
    return;
  }
  
  console.log('[Better UI] Creature container found, setting up observer');
  
  // Disconnect existing observer if any
  if (creatureObserver) {
    creatureObserver.disconnect();
  }
  
  creatureObserver = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    
    mutations.forEach(mutation => {
      // Check for child list changes (creatures being added/removed/filtered)
      if (mutation.type === 'childList') {
        shouldUpdate = true;
      }
    });
    
    if (shouldUpdate) {
      
      // Debounce the updates to avoid excessive calls
      if (creatureObserver.updateTimeout) {
        clearTimeout(creatureObserver.updateTimeout);
        activeTimeouts.delete(creatureObserver.updateTimeout);
      }
      creatureObserver.updateTimeout = setTimeout(() => {
        // Temporarily disconnect observer to prevent infinite loop
        if (creatureObserver) {
          creatureObserver.disconnect();
        }
        
        // Use requestIdleCallback for non-critical cosmetic updates (with fallback)
        const scheduleUpdate = window.requestIdleCallback || requestAnimationFrame;
        scheduleUpdate(() => {
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
          if (config.enableFavorites) {
            updateFavoriteHearts();
          }
          
          // Reconnect observer
          if (creatureObserver && creatureContainer) {
            creatureObserver.observe(creatureContainer, {
              childList: true,
              subtree: true
            });
          }
        }, { timeout: 1000 }); // Fallback timeout for requestIdleCallback
        
        // Clean up the timeout reference
        activeTimeouts.delete(creatureObserver.updateTimeout);
        creatureObserver.updateTimeout = null;
      }, TIMEOUT_DELAYS.CONTAINER_DEBOUNCE);
      activeTimeouts.add(creatureObserver.updateTimeout);
    }
  });
  
  // Start observing (only childList changes, no attributes)
  creatureObserver.observe(creatureContainer, {
    childList: true,
    subtree: true
  });
  
  console.log('[Better UI] Creature container observer started');
}

// Start observer for scroll lock state changes
function initScrollLockObserver() {
  console.log('[Better UI] Starting scroll lock observer...');
  
  // Track previous scroll lock state
  let previouslyLocked = isScrollLocked();
  
  scrollLockObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-scroll-locked') {
        const currentlyLocked = isScrollLocked();
        
        // Detect transition from locked to unlocked (attribute is removed when unlocked)
        if (previouslyLocked && !currentlyLocked) {
          console.log('[Better UI] Scroll unlocked, re-applying styles...');
          
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
        }
        
        previouslyLocked = currentlyLocked;
      }
    });
  });
  
  // Observe document.body for data-scroll-locked attribute changes
  scrollLockObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-scroll-locked']
  });
  
  console.log('[Better UI] Scroll lock observer started');
}

// Handle page visibility changes (browser tab focus/unfocus)
function initVisibilityChangeHandler() {
  console.log('[Better UI] Setting up page visibility change handler...');
  
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.log('[Better UI] Page became visible, re-applying all features...');
      
      // Re-apply all enabled features
      if (config.enableMaxCreatures) {
        scheduleTimeout(() => applyMaxCreatures(), 100);
      }
      
      if (config.enableMaxShinies) {
        scheduleTimeout(() => applyMaxShinies(), 100);
      }
      
      if (config.enableShinyEnemies) {
        scheduleTimeout(() => applyShinyEnemies(), 100);
      }
      
      if (config.enableFavorites) {
        scheduleTimeout(() => updateFavoriteHearts(), 100);
      }
    }
  });
  
  console.log('[Better UI] Page visibility change handler initialized');
}

// Start observer for battle board changes (for shiny enemies)
let battleBoardObserver = null;
let boardStateUnsubscribe = null;

function startBattleBoardObserver() {
  if (!config.enableShinyEnemies) return;
  
  console.log('[Better UI] Starting battle board observer...');
  
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
      console.warn('[Better UI] Error unsubscribing previous board state listeners:', error);
    }
  }
  
  let shinyUpdateDebounce = null;
  let attributeChangeDebounce = null;
  
  const processBattleMutations = (mutations) => {
    // Skip if Board Analyzer is running
    if (window.__modCoordination?.boardAnalyzerRunning) {
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
                  const dataShiny = spriteImg.getAttribute('data-shiny');
                  const spriteContainer = spriteImg.closest('.sprite');
                  const spriteId = spriteContainer ? parseInt(extractSpriteIdFromClasses(spriteContainer), 10) : null;
                  
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
                    console.log(`[Better UI] ✨ Summoned enemy: ${creatureName} - applied shiny`);
                  } else if (!isEnemy) {
                    // NOT in boardConfig as enemy - check if it's a visual summon by health bar
                    const isVisualEnemy = isEnemyByHealthBar(containerNode);
                    
                    if (isVisualEnemy && dataShiny === 'false' && !isCreatureUnobtainable(creatureName)) {
                      spriteImg.setAttribute('data-shiny', 'true');
                      console.log(`[Better UI] ✨ Visual summon: ${creatureName} - applied shiny`);
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
              
              const isUnobtainable = creatureName && UNOBTAINABLE_CREATURES.some(c => c.toLowerCase() === creatureName.toLowerCase());
              
              if (isUnobtainable) {
                console.log(`[Better UI]    ⊘ Skipped ${creatureName} (unobtainable, no shiny sprite)`);
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
        scheduleUpdate(() => {
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
  
  console.log('[Better UI] Battle board observer started');
  
  // Variables to store unsubscribe functions
  let newGameUnsubscribe, endGameUnsubscribe, autoSetupUnsubscribe, boardConfigUnsubscribe;
  
  // Listen for board state changes (new games, game end, and auto-setup)
  if (globalThis.state?.board?.on) {
    try {
      newGameUnsubscribe = globalThis.state.board.on('emitNewGame', (event) => {
        if (window.__modCoordination?.boardAnalyzerRunning) return;
        console.log('[Better UI] New game started, re-applying shiny enemies...');
        scheduleTimeout(() => {
          applyShinyEnemies();
        }, 100);
      });
      
      // Listen for game end event
      endGameUnsubscribe = globalThis.state.board.on('emitEndGame', (event) => {
        if (window.__modCoordination?.boardAnalyzerRunning) return;
        console.log('[Better UI] Game ended, re-applying shiny enemies...');
        scheduleTimeout(() => {
          applyShinyEnemies();
        }, 100);
      });
      
      // Listen for auto-setup board event
      autoSetupUnsubscribe = globalThis.state.board.on('autoSetupBoard', (event) => {
        if (window.__modCoordination?.boardAnalyzerRunning) return;
        console.log('[Better UI] Auto-setup detected, re-applying shiny enemies...');
        scheduleTimeout(() => {
          applyShinyEnemies();
        }, 150);
      });
      
      console.log('[Better UI] Board state listeners added');
    } catch (error) {
      console.error('[Better UI] Error setting up board state listeners:', error);
    }
  }
  
  // Subscribe to boardConfig changes to catch dynamically summoned enemies
  if (globalThis.state?.board?.subscribe) {
    try {
      let lastEnemyCount = 0;
      
      boardConfigUnsubscribe = globalThis.state.board.subscribe((state) => {
        if (window.__modCoordination?.boardAnalyzerRunning) return;
        
        const boardConfig = state.context?.boardConfig;
        if (!boardConfig || !Array.isArray(boardConfig)) return;
        
        const enemies = boardConfig.filter(entity => entity.villain === true);
        const currentEnemyCount = enemies.length;
        
        // Detect when new enemies are added (e.g., summoned by Trolls or Orc Riders)
        if (currentEnemyCount > lastEnemyCount && lastEnemyCount > 0) {
          console.log(`[Better UI] Enemy summoned - re-applying shiny`);
          
          scheduleTimeout(() => {
            applyShinyEnemies();
          }, 20);
        }
        
        lastEnemyCount = currentEnemyCount;
      });
      
      console.log('[Better UI] Board config subscription added for summoned enemies');
    } catch (error) {
      console.error('[Better UI] Error setting up board config subscription:', error);
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
      console.log('[Better UI] Battle board observer stopped');
    }
    
    if (boardStateUnsubscribe) {
      boardStateUnsubscribe();
      boardStateUnsubscribe = null;
      console.log('[Better UI] Board state listener removed');
    }
  } catch (error) {
    console.error('[Better UI] Error stopping battle board observer:', error);
  }
}

// =======================
// 9. Autoplay Refresh Monitor
// =======================

// Parse autoplay time from text content (supports English and Portuguese)
function parseAutoplayTime(textContent) {
  // Build regex pattern using translation strings for both languages
  const enText = TRANSLATIONS.en.autoplaySessionText;
  const ptText = TRANSLATIONS.pt.autoplaySessionText;
  const pattern = new RegExp(`(?:${enText}|${ptText}) \\((\\d+):(\\d+)\\)`);
  
  const match = textContent.match(pattern);
  if (match) {
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    return minutes + (seconds / 60);
  }
  return null;
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
    console.error('[Better UI] Error getting autoplay session time:', error);
    return 0;
  }
}

// Start monitoring the autoplay session timer
function startAutoplayRefreshMonitor() {
  try {
    console.log('[Better UI] Starting autoplay refresh monitor');
    
    // Clear any existing monitoring
    stopAutoplayRefreshMonitor();
    
    // Check if game state is available
    if (!globalThis.state) {
      console.log('[Better UI] Game state not available, cannot start autoplay refresh monitor');
      return;
    }
    
    console.log('[Better UI] Game state available:', !!globalThis.state);
    console.log('[Better UI] Board state available:', !!globalThis.state.board);
    console.log('[Better UI] Game timer available:', !!globalThis.state.gameTimer);
    
    // Listen for new game events to start monitoring autoplay session
    if (globalThis.state.board) {
      // Listen for newGame event as documented in game_state_api.md
      autoplayRefreshGameSubscription = globalThis.state.board.on('newGame', (event) => {
        console.log('[Better UI] New game event:', event);
        
        // Check autoplay session timer and refresh if needed on each new game
        checkAutoplayRefreshThreshold();
      });
      
      // Also listen for setPlayMode when switching to autoplay
      autoplayRefreshSetPlayModeSubscription = globalThis.state.board.on('setPlayMode', (event) => {
        console.log(`[Better UI] setPlayMode event - mode: ${event.mode}`);
        if (event.mode === 'autoplay') {
          console.log('[Better UI] Autoplay mode set - checking refresh threshold');
          checkAutoplayRefreshThreshold();
        }
      });
      
      console.log('[Better UI] Game event listeners set up for newGame and setPlayMode');
    }
    
    // Also check immediately if a game is already running
    if (globalThis.state.gameTimer) {
      const gameTimerState = globalThis.state.gameTimer.getSnapshot();
      console.log('[Better UI] Current game timer state:', gameTimerState.context.state);
      if (gameTimerState.context.state === 'playing') {
        console.log('[Better UI] Game already running, checking autoplay refresh threshold');
        checkAutoplayRefreshThreshold();
      }
    }
    
    console.log('[Better UI] Autoplay refresh monitor started - waiting for new game or monitoring current game');
    
    // Test the autoplay session timer detection
    const testTime = getAutoplaySessionTime();
    console.log(`[Better UI] Test autoplay session time: ${testTime.toFixed(1)} minutes`);
  } catch (error) {
    console.error('[Better UI] Error starting autoplay refresh monitor:', error);
  }
}

// Check autoplay session timer and refresh if needed
function checkAutoplayRefreshThreshold() {
  try {
    const currentMinutes = getAutoplaySessionTime();
    console.log(`[Better UI] Autoplay refresh check: ${currentMinutes.toFixed(1)}/${config.autoplayRefreshMinutes} minutes`);
    
    if (currentMinutes > 0 && currentMinutes >= config.autoplayRefreshMinutes) {
      console.log(`[Better UI] Autoplay refresh threshold reached (${currentMinutes.toFixed(1)} >= ${config.autoplayRefreshMinutes} minutes). Refreshing page in 1 second...`);
      
      // Wait 1 second before refreshing
      scheduleTimeout(() => {
        console.log('[Better UI] Refreshing browser...');
        location.reload();
      }, TIMEOUT_DELAYS.BROWSER_REFRESH);
    }
  } catch (error) {
    console.error('[Better UI] Error checking autoplay refresh threshold:', error);
  }
}

// Stop monitoring the autoplay session timer
function stopAutoplayRefreshMonitor() {
  try {
    if (autoplayRefreshGameSubscription && typeof autoplayRefreshGameSubscription === 'function') {
      autoplayRefreshGameSubscription();
      autoplayRefreshGameSubscription = null;
      console.log('[Better UI] Autoplay refresh game subscription stopped');
    }
    
    if (autoplayRefreshSetPlayModeSubscription && typeof autoplayRefreshSetPlayModeSubscription === 'function') {
      autoplayRefreshSetPlayModeSubscription();
      autoplayRefreshSetPlayModeSubscription = null;
      console.log('[Better UI] Autoplay refresh setPlayMode subscription stopped');
    }
    
    console.log('[Better UI] Autoplay refresh monitor stopped');
  } catch (error) {
    console.error('[Better UI] Error stopping autoplay refresh monitor:', error);
  }
}

// =======================
// 10. Initialization
// =======================

function initBetterUI() {
  try {
    console.log('[Better UI] Starting initialization');
    
    // Load favorites
    loadFavorites();
    
    // Initialize features based on config
    const features = [
      { name: 'Stamina Timer', enabled: config.showStaminaTimer, init: initStaminaTimer },
      { name: 'Settings Button', enabled: config.showSettingsButton, init: createSettingsButton }
    ];
    
    features.forEach(feature => {
      if (feature.enabled) {
        console.log(`[Better UI] Initializing ${feature.name}`);
        feature.init();
      } else {
        console.log(`[Better UI] ${feature.name} disabled in config`);
      }
    });
    
    // Apply max creatures if enabled
    if (config.enableMaxCreatures) {
      console.log('[Better UI] Applying max creatures');
      applyMaxCreatures();
    }
    
    // Apply max shinies if enabled
    if (config.enableMaxShinies) {
      console.log('[Better UI] Applying max shinies');
      applyMaxShinies();
    }
    
    // Apply shiny enemies if enabled
    if (config.enableShinyEnemies) {
      console.log('[Better UI] Applying shiny enemies');
      startBattleBoardObserver();
      applyShinyEnemies();
    }
    
    // Start autoplay refresh monitor if enabled
    if (config.enableAutoplayRefresh) {
      console.log('[Better UI] Autoplay refresh enabled in config, starting monitor');
      startAutoplayRefreshMonitor();
    } else {
      console.log('[Better UI] Autoplay refresh disabled in config');
    }
    
    // Always setup tab observer (it will check config.enableMaxCreatures internally)
    initTabObserver();
    
    // Start context menu observer for favorites
    startContextMenuObserver();
    
    // Start creature container observer for search filtering
    startCreatureContainerObserver();
    
    // Start scroll lock observer to re-apply styles when unlocking
    initScrollLockObserver();
    
    // Initialize page visibility change handler
    initVisibilityChangeHandler();
    
    // Initial update of favorite hearts if enabled
    if (config.enableFavorites) {
      scheduleTimeout(() => updateFavoriteHearts(), TIMEOUT_DELAYS.FAVORITES_INIT);
    }
    
    // Apply initial setup labels visibility and start observer
    scheduleTimeout(() => {
      applySetupLabelsVisibility(config.showSetupLabels);
      setupLabelsObserver = startSetupLabelsObserver();
      console.log('[Better UI] Setup labels visibility applied:', config.showSetupLabels);
    }, 1000); // Delay to ensure DOM is ready
    
    console.log('[Better UI] Initialization completed');
  } catch (error) {
    console.error('[Better UI] Initialization error:', error);
  }
}

// Initialize the mod immediately
initBetterUI();

// =======================
// 10. Cleanup
// =======================

function cleanupBetterUI() {
  console.log('[Better UI] Cleanup called');
  try {
    // Clear all active timeouts
    activeTimeouts.forEach(timeoutId => {
      try {
        clearTimeout(timeoutId);
        clearInterval(timeoutId);
      } catch (error) {
        console.warn('[Better UI] Error clearing timeout/interval:', error);
      }
    });
    activeTimeouts.clear();
    
    // Clear throttle timeouts
    if (updateThrottle) {
      clearTimeout(updateThrottle);
      updateThrottle = null;
    }
    
    // Disconnect MutationObservers
    if (staminaObserver) {
      try {
        staminaObserver.disconnect();
        console.log('[Better UI] Stamina MutationObserver disconnected');
      } catch (error) {
        console.warn('[Better UI] Error disconnecting stamina MutationObserver:', error);
      }
      staminaObserver = null;
    }
    
    if (tabObserver) {
      try {
        tabObserver.disconnect();
        console.log('[Better UI] Tab MutationObserver disconnected');
      } catch (error) {
        console.warn('[Better UI] Error disconnecting tab MutationObserver:', error);
      }
      tabObserver = null;
    }
    
    // Disconnect context menu observer
    stopContextMenuObserver();
    
    // Disconnect creature container observer
    if (creatureObserver) {
      try {
        creatureObserver.disconnect();
        console.log('[Better UI] Creature container MutationObserver disconnected');
      } catch (error) {
        console.warn('[Better UI] Error disconnecting creature container MutationObserver:', error);
      }
      creatureObserver = null;
    }
    
    // Disconnect setup labels observer
    if (setupLabelsObserver) {
      try {
        setupLabelsObserver.disconnect();
        console.log('[Better UI] Setup labels MutationObserver disconnected');
      } catch (error) {
        console.warn('[Better UI] Error disconnecting setup labels MutationObserver:', error);
      }
      setupLabelsObserver = null;
    }
    
    // Disconnect scroll lock observer
    if (scrollLockObserver) {
      try {
        scrollLockObserver.disconnect();
        console.log('[Better UI] Scroll lock MutationObserver disconnected');
      } catch (error) {
        console.warn('[Better UI] Error disconnecting scroll lock MutationObserver:', error);
      }
      scrollLockObserver = null;
    }
    
    // Disconnect battle board observer and board state listeners
    if (battleBoardObserver) {
      try {
        battleBoardObserver.disconnect();
        console.log('[Better UI] Battle board MutationObserver disconnected');
      } catch (error) {
        console.warn('[Better UI] Error disconnecting battle board MutationObserver:', error);
      }
      battleBoardObserver = null;
    }
    
    // Unsubscribe from board state events
    if (boardStateUnsubscribe) {
      try {
        boardStateUnsubscribe();
        console.log('[Better UI] Board state listeners unsubscribed');
      } catch (error) {
        console.warn('[Better UI] Error unsubscribing board state listeners:', error);
      }
      boardStateUnsubscribe = null;
    }
    
    // Stop autoplay refresh monitor
    stopAutoplayRefreshMonitor();
    
    // Remove favorite hearts
    document.querySelectorAll('.favorite-heart').forEach(heart => {
      try {
        heart.remove();
      } catch (error) {
        console.warn('[Better UI] Error removing favorite heart:', error);
      }
    });
    
    // Remove stamina timer element
    if (staminaTimerElement && staminaTimerElement.parentNode) {
      try {
        staminaTimerElement.parentNode.removeChild(staminaTimerElement);
      } catch (error) {
        console.warn('[Better UI] Error removing stamina timer:', error);
      }
    }
    staminaTimerElement = null;
    
    // Remove settings button
    if (settingsButton && settingsButton.parentNode) {
      try {
        settingsButton.parentNode.removeChild(settingsButton);
        console.log('[Better UI] Settings button removed');
      } catch (error) {
        console.warn('[Better UI] Error removing settings button:', error);
      }
    }
    settingsButton = null;
    
    // Remove max creatures styling
    try {
      removeMaxCreatures();
      
      // Remove all max creatures styles
      Object.keys(COLOR_OPTIONS).forEach(color => {
        const style = document.getElementById(`max-creatures-${color}-style`);
        if (style && style.parentNode) {
          style.parentNode.removeChild(style);
        }
      });
      console.log('[Better UI] Max creatures styles removed');
    } catch (error) {
      console.warn('[Better UI] Error cleaning up max creatures:', error);
    }
    
    // Remove max shinies styling
    try {
      removeMaxShinies();
      
      // Remove all max shinies styles
      Object.keys(COLOR_OPTIONS).forEach(color => {
        const style = document.getElementById(`max-shinies-${color}-style`);
        if (style && style.parentNode) {
          style.parentNode.removeChild(style);
        }
      });
      console.log('[Better UI] Max shinies styles removed');
    } catch (error) {
      console.warn('[Better UI] Error cleaning up max shinies:', error);
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
        
        console.log('[Better UI] Header container and stamina button styles reset');
      }
    }
    
    // Reset state variables
    lastStaminaValue = null;
    lastUpdateTime = 0;
    
    console.log('[Better UI] Cleanup completed');
  } catch (error) {
    console.error('[Better UI] Cleanup error:', error);
  }
}

// =======================
// 11. Exports & Lifecycle Management
// =======================

// Proper exports following mod development guide
exports = {
  init: function() {
    try {
      initBetterUI();
      return true;
    } catch (error) {
      console.error('[Better UI] Initialization error:', error);
      return false;
    }
  },
  
  cleanup: function() {
    try {
      cleanupBetterUI();
      return true;
    } catch (error) {
      console.error('[Better UI] Cleanup error:', error);
      return false;
    }
  },
  
  updateConfig: function(newConfig) {
    try {
      Object.assign(config, newConfig);
      return true;
    } catch (error) {
      console.error('[Better UI] Config update error:', error);
      return false;
    }
  }
};
