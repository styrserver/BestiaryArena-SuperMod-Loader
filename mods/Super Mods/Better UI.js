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
  favoriteSymbol: 'hp'
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
  CONTAINER_DEBOUNCE: 200
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
let creatureButtonListeners = new WeakMap(); // Track event listeners on creature buttons
let favoriteCreatures = new Map(); // Maps uniqueId -> symbolKey

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

// CSS template system
const CSS_TEMPLATES = {
  maxCreatures: (colorOption, colorKey) => `
    .has-rarity[data-rarity="${GAME_CONSTANTS.ELITE_RARITY_LEVEL}"][data-max-creatures="true"][data-max-creatures-color="${colorKey}"] {
      border: 3px solid;
      border-image: ${colorOption.borderGradient} 1;
      background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
      box-shadow: 0 0 10px ${colorOption.textColor}40, inset 0 0 10px ${colorOption.textColor}20;
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
    const timeoutId = setTimeout(() => {
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
    activeTimeouts.add(timeoutId);
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

// Show settings modal
function showSettingsModal() {
  try {
    // Create content element with settings
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
          <input type="checkbox" id="stamina-timer-toggle" ${config.showStaminaTimer ? 'checked' : ''} style="transform: scale(1.2);">
          <span>Show Stamina Timer</span>
        </label>
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
          <input type="checkbox" id="rainbow-tiers-toggle" ${config.enableMaxCreatures ? 'checked' : ''} style="transform: scale(1.2);">
          <span>Enable Max Creatures</span>
        </label>
      </div>
      <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
        <span style="color: #ccc;">Color:</span>
        <select id="color-picker" style="background: #333; color: #ccc; border: 1px solid #555; padding: 4px 8px; border-radius: 4px;">
          <option value="prismatic" ${config.maxCreaturesColor === 'prismatic' ? 'selected' : ''}>Prismatic</option>
          <option value="demon" ${config.maxCreaturesColor === 'demon' ? 'selected' : ''}>Demonic</option>
          <option value="ice" ${config.maxCreaturesColor === 'ice' ? 'selected' : ''}>Frosty</option>
          <option value="poison" ${config.maxCreaturesColor === 'poison' ? 'selected' : ''}>Venomous</option>
          <option value="gold" ${config.maxCreaturesColor === 'gold' ? 'selected' : ''}>Divine</option>
          <option value="undead" ${config.maxCreaturesColor === 'undead' ? 'selected' : ''}>Undead</option>
        </select>
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
          <input type="checkbox" id="shinies-toggle" ${config.enableMaxShinies ? 'checked' : ''} style="transform: scale(1.2);">
          <span>Enable Shinies</span>
        </label>
      </div>
      <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
        <span style="color: #ccc;">Shiny Color:</span>
        <select id="shiny-color-picker" style="background: #333; color: #ccc; border: 1px solid #555; padding: 4px 8px; border-radius: 4px;">
          <option value="prismatic" ${config.maxShiniesColor === 'prismatic' ? 'selected' : ''}>Prismatic</option>
          <option value="demon" ${config.maxShiniesColor === 'demon' ? 'selected' : ''}>Demonic</option>
          <option value="ice" ${config.maxShiniesColor === 'ice' ? 'selected' : ''}>Frosty</option>
          <option value="poison" ${config.maxShiniesColor === 'poison' ? 'selected' : ''}>Venomous</option>
          <option value="gold" ${config.maxShiniesColor === 'gold' ? 'selected' : ''}>Divine</option>
          <option value="undead" ${config.maxShiniesColor === 'undead' ? 'selected' : ''}>Undead</option>
        </select>
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
          <input type="checkbox" id="favorites-toggle" ${config.enableFavorites ? 'checked' : ''} style="transform: scale(1.2);">
          <span>Enable Favorites</span>
        </label>
      </div>
    `;
    
    // Add change event listener to stamina checkbox
    const staminaCheckbox = content.querySelector('#stamina-timer-toggle');
    staminaCheckbox.addEventListener('change', () => {
      config.showStaminaTimer = staminaCheckbox.checked;
      saveConfig();
      
      // Handle timer element based on setting
      if (config.showStaminaTimer) {
        // If enabling, create/show timer
        if (staminaTimerElement) {
          staminaTimerElement.style.display = 'inline';
        } else {
          // Force timer update to create element
          updateStaminaTimer();
        }
      } else {
        // If disabling, hide timer
        if (staminaTimerElement) {
          staminaTimerElement.style.display = 'none';
        }
      }
      
      console.log('[Better UI] Setting updated:', { showStaminaTimer: config.showStaminaTimer });
    });
    
    // Add change event listener to max creatures checkbox
    const rainbowCheckbox = content.querySelector('#rainbow-tiers-toggle');
    rainbowCheckbox.addEventListener('change', () => {
      config.enableMaxCreatures = rainbowCheckbox.checked;
      saveConfig();
      
      // Apply or remove max creatures based on setting
      if (config.enableMaxCreatures) {
        applyMaxCreatures();
      } else {
        removeMaxCreatures();
      }
      
      console.log('[Better UI] Setting updated:', { enableMaxCreatures: config.enableMaxCreatures });
    });
    
    // Add change event listener to color picker
    const colorPicker = content.querySelector('#color-picker');
    colorPicker.addEventListener('change', () => {
      config.maxCreaturesColor = colorPicker.value;
      saveConfig();
      
      // Reapply max creatures with new color if enabled
      if (config.enableMaxCreatures) {
        applyMaxCreatures();
      }
      
      console.log('[Better UI] Color updated:', { maxCreaturesColor: config.maxCreaturesColor });
    });
    
    // Add change event listener to shinies checkbox
    const shiniesCheckbox = content.querySelector('#shinies-toggle');
    shiniesCheckbox.addEventListener('change', () => {
      config.enableMaxShinies = shiniesCheckbox.checked;
      saveConfig();
      
      // Apply or remove max shinies based on setting
      if (config.enableMaxShinies) {
        applyMaxShinies();
      } else {
        removeMaxShinies();
      }
      
      console.log('[Better UI] Setting updated:', { enableMaxShinies: config.enableMaxShinies });
    });
    
    // Add change event listener to shiny color picker
    const shinyColorPicker = content.querySelector('#shiny-color-picker');
    shinyColorPicker.addEventListener('change', () => {
      config.maxShiniesColor = shinyColorPicker.value;
      saveConfig();
      
      // Reapply max shinies with new color if enabled
      if (config.enableMaxShinies) {
        applyMaxShinies();
      }
      
      console.log('[Better UI] Shiny color updated:', { maxShiniesColor: config.maxShiniesColor });
    });
    
    // Add change event listener to favorites checkbox
    const favoritesCheckbox = content.querySelector('#favorites-toggle');
    favoritesCheckbox.addEventListener('change', () => {
      config.enableFavorites = favoritesCheckbox.checked;
      saveConfig();
      
      // Show or hide favorites based on setting
      if (config.enableFavorites) {
        updateFavoriteHearts();
      } else {
        // Remove all favorite hearts
        document.querySelectorAll('.favorite-heart').forEach(heart => heart.remove());
      }
      
      console.log('[Better UI] Setting updated:', { enableFavorites: config.enableFavorites });
    });
    
    // Store modal reference for button handlers
    let modalRef = null;
    
    // Create modal using the API
    modalRef = api.ui.components.createModal({
      title: 'Better UI Settings',
      width: 300,
      content: content,
      buttons: [
        {
          text: 'Close',
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
    settingsButtonElement.title = 'Better UI Settings';
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

// Inject favorite button into context menu
function injectFavoriteButton(menuElem) {
  // Check if favorites are enabled
  if (!config.enableFavorites) return false;
  
  // Mark this menu as processed to prevent duplicate processing
  if (menuElem.hasAttribute('data-favorite-processed')) return false;
  menuElem.setAttribute('data-favorite-processed', 'true');
  
  // Get creature name from menu
  const creatureName = getCreatureNameFromMenu(menuElem);
  if (!creatureName) return false;
  
  // Check if menu is for account/game mode
  const menuText = menuElem.textContent?.toLowerCase() || '';
  const isAccountMenu = menuText.includes('my account') || menuText.includes('logout');
  const isGameModeMenu = menuText.includes('game mode') || menuText.includes('manual');
  if (isAccountMenu || isGameModeMenu) return false;
  
  // Parse percentage from the context menu
  let contextMenuPercentage = null;
  const group = menuElem.querySelector('div[role="group"]');
  if (group) {
    const firstItem = group.querySelector('.dropdown-menu-item');
    if (firstItem) {
      const text = firstItem.textContent;
      const percentageMatch = text.match(/\((\d+)%\)/);
      if (percentageMatch) {
        contextMenuPercentage = parseInt(percentageMatch[1]);
        console.log('[Better UI] injectFavoriteButton - Parsed percentage from menu:', contextMenuPercentage + '%');
      }
    }
  }
  
  // Use the stored reference to the right-clicked creature
  let gameId = null;
  let uniqueId = null;
  let creatureIndex = null;
  
  if (currentRightClickedCreature?.creatureImg) {
    // Now identify the creature using the percentage from the context menu
    const creatureInfo = getCreatureUniqueId(currentRightClickedCreature.creatureImg, contextMenuPercentage);
    
    if (creatureInfo) {
      gameId = creatureInfo.gameId;
      uniqueId = creatureInfo.uniqueId;
      creatureIndex = creatureInfo.index;
      
      // Get creature's locked status
      const monsters = globalThis.state.player.getSnapshot().context.monsters || [];
      const creature = monsters.find(m => m.id === uniqueId);
      const isLocked = creature?.locked || false;
      
      // Update the stored reference with full info
      currentRightClickedCreature = {
        creatureImg: currentRightClickedCreature.creatureImg,
        gameId,
        uniqueId,
        creatureIndex,
        isLocked
      };
      
      console.log('[Better UI] injectFavoriteButton - Identified creature:', {
        gameId,
        uniqueId,
        percentage: contextMenuPercentage + '%',
        isLocked
      });
    } else {
      console.warn('[Better UI] injectFavoriteButton - Failed to identify creature');
    }
  }
  
  const isFavorite = uniqueId ? favoriteCreatures.has(uniqueId) : false;
  const currentSymbol = uniqueId ? favoriteCreatures.get(uniqueId) : null;
  
  // Create main "Favorite" menu item using Radix UI submenu pattern
  const favoriteMainItem = document.createElement('div');
  favoriteMainItem.className = 'focus-style dropdown-menu-item flex cursor-default select-none items-center gap-2 outline-none';
  favoriteMainItem.setAttribute('role', 'menuitem');
  favoriteMainItem.setAttribute('aria-haspopup', 'menu');
  favoriteMainItem.setAttribute('aria-expanded', 'false');
  favoriteMainItem.setAttribute('aria-controls', 'favorite-submenu');
  favoriteMainItem.setAttribute('data-state', 'closed');
  favoriteMainItem.setAttribute('tabindex', '-1');
  favoriteMainItem.setAttribute('data-orientation', 'vertical');
  favoriteMainItem.setAttribute('data-radix-collection-item', '');
  favoriteMainItem.style.cssText = 'color: white; background: transparent; padding: 4px 8px; font-size: 16px; font-weight: 400; line-height: 1;';
  
  // Create submenu container using Radix UI structure
  const submenu = document.createElement('div');
  submenu.id = 'favorite-submenu';
  submenu.className = 'pixel-font-16 frame-3 surface-regular z-modals min-w-[7rem] overflow-hidden py-1 text-whiteHighlight shadow-md';
  submenu.setAttribute('role', 'menu');
  submenu.setAttribute('aria-orientation', 'vertical');
  submenu.setAttribute('data-state', 'closed');
  submenu.setAttribute('data-radix-menu-content', '');
  submenu.style.cssText = `
    position: absolute;
    left: 100%;
    top: 0;
    display: none;
    z-index: 1000;
    min-width: 120px;
  `;
  
  // Add hover events to show/hide submenu
  favoriteMainItem.addEventListener('mouseenter', () => {
    favoriteMainItem.style.background = 'rgba(255, 255, 255, 0.15)';
    favoriteMainItem.setAttribute('data-state', 'open');
    favoriteMainItem.setAttribute('aria-expanded', 'true');
    submenu.setAttribute('data-state', 'open');
    submenu.style.display = 'block';
  });
  
  favoriteMainItem.addEventListener('mouseleave', () => {
    favoriteMainItem.style.background = 'transparent';
    // Delay hiding to allow mouse to move to submenu
    const timeoutId = setTimeout(() => {
      if (!submenu.matches(':hover') && !favoriteMainItem.matches(':hover')) {
        favoriteMainItem.setAttribute('data-state', 'closed');
        favoriteMainItem.setAttribute('aria-expanded', 'false');
        submenu.setAttribute('data-state', 'closed');
        submenu.style.display = 'none';
      }
    }, TIMEOUT_DELAYS.SUBMENU_HIDE);
    activeTimeouts.add(timeoutId);
  });
  
  submenu.addEventListener('mouseenter', () => {
    submenu.style.display = 'block';
    submenu.setAttribute('data-state', 'open');
  });
  
  submenu.addEventListener('mouseleave', () => {
    submenu.style.display = 'none';
    submenu.setAttribute('data-state', 'closed');
    favoriteMainItem.setAttribute('data-state', 'closed');
    favoriteMainItem.setAttribute('aria-expanded', 'false');
  });
  
  // Create submenu items for each symbol
  Object.entries(FAVORITE_SYMBOLS).forEach(([symbolKey, symbol]) => {
    const symbolItem = document.createElement('div');
    symbolItem.className = 'dropdown-menu-item relative flex cursor-default select-none items-center gap-2 outline-none';
    symbolItem.setAttribute('role', 'menuitem');
    symbolItem.setAttribute('tabindex', '-1');
    symbolItem.setAttribute('data-orientation', 'vertical');
    symbolItem.setAttribute('data-radix-collection-item', '');
    symbolItem.style.cssText = 'color: white; background: transparent; padding: 4px 8px; font-size: 16px; font-weight: 400; line-height: 1;';
    
    symbolItem.addEventListener('mouseenter', () => {
      symbolItem.style.background = 'rgba(255, 255, 255, 0.15)';
    });
    symbolItem.addEventListener('mouseleave', () => {
      symbolItem.style.background = 'transparent';
    });
    
    const isCurrentSymbol = isFavorite && currentSymbol === symbolKey;
    const isNone = symbol.isNone;
    
    // Create icon element
    let iconElement;
    if (isNone) {
      // For "(none)" option, no icon
      iconElement = '';
    } else if (symbolKey === 'heart') {
      // For heart, use emoji directly
      iconElement = symbol.icon;
    } else {
      // For stat icons, use the actual game icons
      iconElement = `<img src="${symbol.icon}" width="24" height="24" style="image-rendering: pixelated;" alt="${symbol.name}">`;
    }
    
    symbolItem.innerHTML = `${iconElement}${symbol.name}${isCurrentSymbol ? ' ✓' : ''}`;
    
    symbolItem.addEventListener('click', (e) => {
      e.stopPropagation();
      if (uniqueId) {
        if (isNone) {
          // Remove from favorites
          favoriteCreatures.delete(uniqueId);
          console.log('[Better UI] Removed from favorites:', uniqueId);
          saveFavorites();
          // Update the favorite hearts to remove the icon
          updateFavoriteHearts(uniqueId);
        } else {
          // Add/change favorite symbol
          toggleFavorite(uniqueId, symbolKey);
        }
      }
      currentRightClickedCreature = null;
      const timeoutId = setTimeout(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
      }, TIMEOUT_DELAYS.MENU_CLOSE);
      activeTimeouts.add(timeoutId);
    });
    
    submenu.appendChild(symbolItem);
  });
  
  // Set main item content with chevron
  favoriteMainItem.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>Favorite<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right ml-auto" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;
  
  // Add click handler to main favorite button to add heart emoji
  favoriteMainItem.addEventListener('click', (e) => {
    e.stopPropagation();
    if (uniqueId) {
      toggleFavorite(uniqueId, 'heart');
    }
    currentRightClickedCreature = null;
    const timeoutId = setTimeout(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    }, TIMEOUT_DELAYS.MENU_CLOSE);
    activeTimeouts.add(timeoutId);
  });
  
  // Append submenu to main item
  favoriteMainItem.appendChild(submenu);
  
  // Append main item to menu
  menuElem.appendChild(favoriteMainItem);
  
  return true;
}

// Update heart icons on creature portraits
function updateFavoriteHearts(targetUniqueId = null) {
  // Check if favorites are enabled
  if (!config.enableFavorites) {
    // Remove all favorite hearts if disabled
    document.querySelectorAll('.favorite-heart').forEach(heart => heart.remove());
    return;
  }
  
  const creatures = getVisibleCreatures();
  
  // Get all monsters from game state once
  const monsters = globalThis.state?.player?.getSnapshot()?.context?.monsters || [];
  
  // Helper function to calculate level from exp (copied from getCreatureUniqueId for performance)
  const getLevelFromExp = (exp) => {
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
    if (typeof exp !== 'number' || exp < EXP_TABLE[0][1]) return 1;
    for (let i = EXP_TABLE.length - 1; i >= 0; i--) {
      if (exp >= EXP_TABLE[i][1]) return EXP_TABLE[i][0];
    }
    return 1;
  };
  
  // Track which creatures of each gameId we've seen
  const gameIdIndexMap = new Map();
  
  let heartsAdded = 0;
  
  creatures.forEach((imgEl) => {
    const gameId = getCreatureGameId(imgEl);
    if (!gameId) return;
    
    // Get or initialize the index for this gameId
    if (!gameIdIndexMap.has(gameId)) {
      gameIdIndexMap.set(gameId, 0);
    }
    const currentIndex = gameIdIndexMap.get(gameId);
    
    // Find all monsters with this gameId, sorted by stats
    const matchingMonsters = monsters.filter(m => m.gameId === gameId).map(m => {
      m._statSum = (m.hp || 0) + (m.ad || 0) + (m.ap || 0) + (m.armor || 0) + (m.magicResist || 0);
      return m;
    }).sort((a, b) => {
      const gameIdCompare = (a.gameId || 0) - (b.gameId || 0);
      if (gameIdCompare !== 0) return gameIdCompare;
      return b._statSum - a._statSum;
    });
    
    // Get displayed level to help with disambiguation
    const button = imgEl.closest('button');
    const levelSpan = button?.querySelector('span[translate="no"]');
    const displayedLevel = levelSpan ? parseInt(levelSpan.textContent) : null;
    
    // Identify the creature at this index
    let identifiedMonster = matchingMonsters[currentIndex];
    
    // If we have multiple monsters with same gameId and displayed level, use level to match
    if (matchingMonsters.length > 1 && displayedLevel) {
      const levelMatch = matchingMonsters.find(m => getLevelFromExp(m.exp || 0) === displayedLevel);
      if (levelMatch) {
        identifiedMonster = levelMatch;
      }
    }
    
    // Increment the index for next creature with same gameId
    gameIdIndexMap.set(gameId, currentIndex + 1);
    
    const uniqueId = identifiedMonster?.id;
    if (!uniqueId) return;
    
    // Skip if we're only updating a specific creature
    if (targetUniqueId && uniqueId !== targetUniqueId) {
      return;
    }
    
    const isFavorite = favoriteCreatures.has(uniqueId);
    const container = imgEl.parentElement;
    
    // Remove existing heart
    const existingHeart = container.querySelector('.favorite-heart');
    if (existingHeart) existingHeart.remove();
    
    // Add favorite symbol if favorited
    if (isFavorite) {
      const symbolKey = favoriteCreatures.get(uniqueId) || 'heart';
      const symbol = FAVORITE_SYMBOLS[symbolKey] || FAVORITE_SYMBOLS.heart;
      
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
    }
  });
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
  
  // Helper function to calculate level from exp
  const getLevelFromExp = (exp) => {
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
    if (typeof exp !== 'number' || exp < EXP_TABLE[0][1]) return 1;
    for (let i = EXP_TABLE.length - 1; i >= 0; i--) {
      if (exp >= EXP_TABLE[i][1]) return EXP_TABLE[i][0];
    }
    return 1;
  };
  
  // Get all monsters from game state
  const monsters = globalThis.state?.player?.getSnapshot()?.context?.monsters || [];
  let matchingMonsters = monsters.filter(m => m.gameId === gameId);
  
  // Sort monsters the same way as the visual grid: Level (desc) → Tier (desc) → GameID (asc) → Stats (desc)
  matchingMonsters = matchingMonsters.map(m => ({
    ...m,
    _level: getLevelFromExp(m.exp),
    _statSum: (m.hp || 0) + (m.ad || 0) + (m.ap || 0) + (m.armor || 0) + (m.magicResist || 0)
  })).sort((a, b) => {
    // Level (desc)
    if (a._level !== b._level) return b._level - a._level;
    // Tier (desc)
    const tierA = a.tier || 0;
    const tierB = b.tier || 0;
    if (tierA !== tierB) return tierB - tierA;
    // Game ID (asc, string compare)
    const gameIdCompare = String(a.gameId).localeCompare(String(b.gameId));
    if (gameIdCompare !== 0) return gameIdCompare;
    // Stat sum (desc)
    return b._statSum - a._statSum;
  });
  
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
    
    // Use the percentage passed from context menu if available
    if (contextMenuPercentage !== null) {
      console.log('[Better UI] getCreatureUniqueId - Using provided percentage:', contextMenuPercentage + '%');
      
      // Find all monsters with matching stats percentage
      const monstersWithPercentage = matchingMonsters.filter(m => {
        const statSum = (m.hp || 0) + (m.ad || 0) + (m.ap || 0) + (m.armor || 0) + (m.magicResist || 0);
        return statSum === contextMenuPercentage;
      });
      
      console.log('[Better UI] getCreatureUniqueId - Found', monstersWithPercentage.length, 'monster(s) with', contextMenuPercentage + '%');
      
      let monster = null;
      
      // If multiple monsters with same percentage, use displayed level to disambiguate
      if (monstersWithPercentage.length > 1 && displayedLevel) {
        console.log('[Better UI] getCreatureUniqueId - Multiple monsters with same percentage, using displayed level:', displayedLevel);
        
        // Log all candidates with their levels
        monstersWithPercentage.forEach(m => {
          const mLevel = getLevelFromExp(m.exp || 0);
          console.log(`[Better UI] getCreatureUniqueId - Candidate: ${m.id}, level ${mLevel}, exp ${m.exp}`);
        });
        
        monster = monstersWithPercentage.find(m => {
          const monsterLevel = getLevelFromExp(m.exp || 0);
          return monsterLevel === displayedLevel;
        });
        if (monster) {
          console.log('[Better UI] getCreatureUniqueId - Matched by percentage AND level:', contextMenuPercentage + '%', 'level', displayedLevel, '→', monster.id);
        } else {
          console.warn('[Better UI] getCreatureUniqueId - No monster matched level', displayedLevel, '- using first match');
        }
      }
      
      // If no level match or only one monster with that percentage, just use percentage
      if (!monster && monstersWithPercentage.length > 0) {
        monster = monstersWithPercentage[0];
        console.log('[Better UI] getCreatureUniqueId - Matched by provided percentage:', contextMenuPercentage + '%', '→', monster.id);
      }
      
      if (monster) {
        identifiedMonster = monster;
        matchedByPercentage = true;
      } else {
        console.warn('[Better UI] getCreatureUniqueId - No monster found with percentage:', contextMenuPercentage + '%');
      }
    }
    
    // Fallback to level-based matching if percentage matching failed
    if (!matchedByPercentage && displayedLevel) {
      // Get additional visual clues
      const button = currentImg.closest('button');
      const isShiny = currentImg.src.includes('-shiny');
      const rarity = button.querySelector('[data-rarity]')?.getAttribute('data-rarity');
      const hasStars = button.querySelector('.tier-stars') !== null;
      
      console.log('[Better UI] getCreatureUniqueId - Visual clues:', {
        level: displayedLevel,
        isShiny: isShiny,
        rarity: rarity,
        hasStars: hasStars
      });
      
      // Find monsters with matching level
      const levelMatches = matchingMonsters.filter(m => getLevelFromExp(m.exp) === displayedLevel);
      console.log('[Better UI] getCreatureUniqueId - Level matches:', levelMatches.map(m => ({
        id: m.id,
        shiny: m.shiny,
        tier: m.tier
      })));
      
      if (levelMatches.length === 1) {
        // Only one creature with this level
        identifiedMonster = levelMatches[0];
        console.log('[Better UI] getCreatureUniqueId - Matched by unique level:', displayedLevel);
      } else if (levelMatches.length > 1) {
        // Multiple creatures with same level, use additional criteria
        let bestMatch = levelMatches.find(m => {
          // Match shiny status
          if (isShiny && !m.shiny) return false;
          if (!isShiny && m.shiny) return false;
          
          // Match tier (stars)
          if (hasStars && !m.tier) return false;
          if (!hasStars && m.tier) return false;
          
          return true;
        });
        
        if (bestMatch) {
          identifiedMonster = bestMatch;
          console.log('[Better UI] getCreatureUniqueId - Matched by level + visual clues');
        } else {
          // Fall back to index-based matching within level group
          const levelIndex = matchingMonsters.filter(m => getLevelFromExp(m.exp) === displayedLevel).indexOf(matchingMonsters[currentIndex]);
          if (levelIndex >= 0 && levelIndex < levelMatches.length) {
            identifiedMonster = levelMatches[levelIndex];
            console.log('[Better UI] getCreatureUniqueId - Matched by level + index within level group');
          }
        }
      }
    }
    
    const statSum = (identifiedMonster?.hp || 0) + (identifiedMonster?.ad || 0) + (identifiedMonster?.ap || 0) + (identifiedMonster?.armor || 0) + (identifiedMonster?.magicResist || 0);
    const statPercent = Math.round((statSum / 100) * 100);
    const monsterLevel = getLevelFromExp(identifiedMonster?.exp || 0);
    
    console.log('[Better UI] getCreatureUniqueId - Mapping to monster:', identifiedMonster?.id);
    console.log('[Better UI] getCreatureUniqueId - Monster stats:', {
      id: identifiedMonster?.id,
      level: monsterLevel,
      hp: identifiedMonster?.hp,
      ad: identifiedMonster?.ad,
      ap: identifiedMonster?.ap,
      armor: identifiedMonster?.armor,
      magicResist: identifiedMonster?.magicResist,
      total: statSum,
      percentage: statPercent + '%'
    });
    
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
  
  // Throttle to avoid excessive processing during rapid DOM changes
  let contextMenuThrottle = null;
  
  contextMenuObserver = new MutationObserver((mutations) => {
    // Throttle the processing to reduce performance impact
    if (contextMenuThrottle) return;
    
    contextMenuThrottle = setTimeout(() => {
      contextMenuThrottle = null;
      
      // Add listeners to new creature buttons
      addRightClickListeners();
      
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          
          // Check for context menu
          const isMenu = node.getAttribute?.('role') === 'menu';
          const hasMenu = node.querySelector?.('[role="menu"]');
          const isDropdown = node.classList?.contains('dropdown-content') || node.querySelector?.('.dropdown-content');
          
          const menu = isMenu ? node : hasMenu;
          if (menu) {
            console.log('[Better UI] Context menu detected! Injecting favorite button...');
            const timeoutId = setTimeout(() => {
              injectFavoriteButton(menu);
            }, TIMEOUT_DELAYS.MENU_CLOSE);
            activeTimeouts.add(timeoutId);
          } else if (isDropdown || node.querySelector?.('.dropdown-menu-item')) {
            console.log('[Better UI] Dropdown menu detected! Injecting favorite button...');
            const timeoutId = setTimeout(() => {
              injectFavoriteButton(node);
            }, TIMEOUT_DELAYS.MENU_CLOSE);
            activeTimeouts.add(timeoutId);
          }
        }
      }
    }, 50); // 50ms throttle
  });
  
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
  
  // Apply star styling
  elements.starImg.setAttribute('data-max-creatures', 'true');
  elements.starImg.setAttribute('data-max-creatures-color', colorKey);

  // Apply rarity div styling
  elements.rarityDiv.setAttribute('data-rarity', GAME_CONSTANTS.ELITE_RARITY_LEVEL.toString());
  elements.rarityDiv.setAttribute('data-max-creatures', 'true');
  elements.rarityDiv.setAttribute('data-max-creatures-color', colorKey);

  // Apply text rarity styling if it exists
  if (elements.textRarityEl) {
    elements.textRarityEl.setAttribute('data-rarity', GAME_CONSTANTS.ELITE_RARITY_LEVEL.toString());
    elements.textRarityEl.setAttribute('data-max-creatures', 'true');
    elements.textRarityEl.setAttribute('data-max-creatures-color', colorKey);
  }
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
  const eligibleShinies = [];
  
  visibleCreatures.forEach((imgEl) => {
    if (!isShinyCreature(imgEl)) return;
    
    const elements = getCreatureElements(imgEl.parentElement);
    
    // All shinies qualify, regardless of stats or level
    if (elements.rarityDiv) {
      eligibleShinies.push({
        imgEl,
        elements
      });
    }
  });
  
  return eligibleShinies;
}

function applyShinyStyling(shiny, colorKey) {
  const { elements, imgEl } = shiny;
  
  // Apply styling to the creature image itself
  imgEl.setAttribute('data-max-shinies', 'true');
  imgEl.setAttribute('data-max-shinies-color', colorKey);
  
  // Apply rarity div styling
  const currentRarity = elements.rarityDiv.getAttribute('data-rarity') || '5';
  elements.rarityDiv.setAttribute('data-max-shinies', 'true');
  elements.rarityDiv.setAttribute('data-max-shinies-color', colorKey);
  elements.rarityDiv.setAttribute('data-original-rarity', currentRarity);
  
  // Apply text rarity styling if it exists
  if (elements.textRarityEl) {
    elements.textRarityEl.setAttribute('data-max-shinies', 'true');
    elements.textRarityEl.setAttribute('data-max-shinies-color', colorKey);
  }
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
      border: 3px solid;
      border-image: ${colorOption.borderGradient} 1;
      background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
      box-shadow: 0 0 10px ${colorOption.textColor}40, inset 0 0 10px ${colorOption.textColor}20;
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
// 8. Stamina Timer Functions
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
      const timeoutId = setTimeout(tryInit, TIMEOUT_DELAYS.INIT_RETRY);
      activeTimeouts.add(timeoutId);
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
          updateThrottle = null;
          console.log('[Better UI] Stamina span changed, checking timer');
          updateStaminaTimer();
        }, THROTTLE_SETTINGS.DOM_CHECK);
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
              // Use setTimeout to ensure DOM has updated
              const timeoutId = setTimeout(() => {
                applyMaxCreatures();
              }, TIMEOUT_DELAYS.TAB_REAPPLY);
              activeTimeouts.add(timeoutId);
            } else {
              console.log('[Better UI] Max creatures disabled, skipping');
            }
            if (config.enableMaxShinies) {
              console.log('[Better UI] Reapplying max shinies');
              const timeoutId = setTimeout(() => {
                applyMaxShinies();
              }, TIMEOUT_DELAYS.TAB_REAPPLY);
              activeTimeouts.add(timeoutId);
            } else {
              console.log('[Better UI] Max shinies disabled, skipping');
            }
            // Update favorite hearts if enabled
            if (config.enableFavorites) {
              const timeoutId = setTimeout(() => {
                updateFavoriteHearts();
              }, TIMEOUT_DELAYS.TAB_REAPPLY);
              activeTimeouts.add(timeoutId);
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
    const timeoutId = setTimeout(startCreatureContainerObserver, TIMEOUT_DELAYS.OBSERVER_RETRY);
    activeTimeouts.add(timeoutId);
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
      console.log('[Better UI] Creature container changed, updating max creatures and favorites');
      
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
        
        // Re-apply max creatures styling if enabled
        if (config.enableMaxCreatures) {
          applyMaxCreatures();
        }
        
        // Re-apply max shinies styling if enabled
        if (config.enableMaxShinies) {
          applyMaxShinies();
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

// =======================
// 9. Initialization
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
    
    // Always setup tab observer (it will check config.enableMaxCreatures internally)
    initTabObserver();
    
    // Start context menu observer for favorites
    startContextMenuObserver();
    
    // Start creature container observer for search filtering
    startCreatureContainerObserver();
    
    // Initial update of favorite hearts if enabled
    if (config.enableFavorites) {
      const timeoutId = setTimeout(() => updateFavoriteHearts(), TIMEOUT_DELAYS.FAVORITES_INIT);
      activeTimeouts.add(timeoutId);
    }
    
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
    
    // Clear throttle timeout
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
