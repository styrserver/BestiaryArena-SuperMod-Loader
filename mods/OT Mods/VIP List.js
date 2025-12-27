// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[VIP List] initializing...');

// =======================
// 2. Constants
// =======================

// Storage keys
const STORAGE_KEYS = {
  DATA: 'vip-list-data',
  CONFIG: 'vip-list-config',
  SORT: 'vip-list-sort',
  PANEL_SETTINGS: 'vip-list-panel-settings',
  CHAT_PANEL_POSITIONS: 'vip-list-chat-panel-positions',
  CHAT_PANEL_SETTINGS: 'vip-list-chat-panel-settings'
};

// Timeout constants
const TIMEOUTS = {
  IMMEDIATE: 0,
  SHORT: 10,
  MEDIUM: 50,
  NORMAL: 100,
  LONG: 200,
  LONGER: 300,
  INITIAL_CHECK: 500,
  PLACEHOLDER_RESET: 3000
};

// Online status threshold (15 minutes in milliseconds)
const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;

// CSS constants
const CSS_CONSTANTS = {
  BACKGROUND_URL: 'https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png',
  BORDER_4_FRAME: 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch',
  BORDER_1_FRAME: 'url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 4 fill',
  BORDER_1_FRAME_PRESSED: 'url("https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png") 4 fill',
  BORDER_3_FRAME: 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill',
  FONT_FAMILY: "'Trebuchet MS', 'Arial Black', Arial, sans-serif",
  FONT_FAMILY_SYSTEM: 'system-ui, -apple-system, sans-serif',
  COLORS: {
    TEXT_PRIMARY: 'rgb(230, 215, 176)',
    TEXT_WHITE: 'rgb(255, 255, 255)',
    ONLINE: 'rgb(76, 175, 80)',
    OFFLINE: 'rgb(255, 107, 107)',
    LINK: 'rgb(100, 181, 246)',
    ERROR: '#ff6b6b',
    SUCCESS: '#4caf50',
    DUPLICATE: '#888',
    // Opacity variants
    WHITE_50: 'rgba(255, 255, 255, 0.5)',
    WHITE_60: 'rgba(255, 255, 255, 0.6)',
    WHITE_70: 'rgba(255, 255, 255, 0.7)',
    WHITE_05: 'rgba(255, 255, 255, 0.05)',
    WHITE_10: 'rgba(255, 255, 255, 0.1)',
    WHITE_20: 'rgba(255, 255, 255, 0.2)',
    BLACK_20: 'rgba(0, 0, 0, 0.2)',
    BLACK_30: 'rgba(0, 0, 0, 0.3)',
    LINK_15: 'rgba(100, 181, 246, 0.15)'
  },
  FONT_SIZES: {
    XS: '10px',
    SM: '11px',
    BASE: '12px',
    MD: '13px',
    LG: '14px',
    XL: '16px'
  }
};

// Modal dimensions
const MODAL_DIMENSIONS = {
  WIDTH: 550,
  HEIGHT: 360
};

// Panel dimensions
const PANEL_DIMENSIONS = {
  WIDTH: 500,
  HEIGHT: 400,
  MIN_WIDTH: 300,
  MAX_WIDTH: 700,
  MIN_HEIGHT: 250,
  MAX_HEIGHT: 500
};

const PANEL_ID = 'vip-list-panel';

const getConfigValue = (key, defaultValue, typeCheck = null) => {
  if (window.betterUIConfig && window.betterUIConfig[key] !== undefined) {
    const value = window.betterUIConfig[key];
    if (typeCheck === null || typeof value === typeCheck) {
      return value;
    }
  }
  return defaultValue;
};

// Read enabled state from Mod Settings config if available, default to false
const getMessagingEnabled = () => getConfigValue('enableVipListChat', false, 'boolean');

// Read message filter setting from Mod Settings config if available, default to 'all'
const getMessageFilter = () => getConfigValue('vipListMessageFilter', 'all');

// Check if a player is in the VIP list
function isPlayerInVIPList(playerName) {
  const vipList = getVIPList();
  return vipList.some(vip => vip.name.toLowerCase() === playerName.toLowerCase());
}

const MESSAGING_CONFIG = {
  get enabled() {
    return getMessagingEnabled();
  },
  firebaseUrl: 'https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app',
  checkInterval: 5000,
  maxMessageLength: 1000
};

// Sanitize username for Firebase key (Firebase keys cannot start with . or $)
const sanitizeFirebaseKey = (username) => {
  if (!username) return '';
  let sanitized = username.toLowerCase();
  // Replace leading dot with _dot_
  if (sanitized.startsWith('.')) {
    sanitized = '_dot_' + sanitized.substring(1);
  }
  // Replace leading $ with _dollar_
  if (sanitized.startsWith('$')) {
    sanitized = '_dollar_' + sanitized.substring(1);
  }
  // Replace other invalid characters for Firebase keys
  sanitized = sanitized.replace(/[\/\[\]#]/g, '_');
  return sanitized;
};

const getApiUrl = (endpoint) => {
  return MESSAGING_CONFIG.enabled 
    ? `${MESSAGING_CONFIG.firebaseUrl}/${endpoint}`
    : null;
};

const getMessagingApiUrl = () => getApiUrl('messages');
const getChatEnabledApiUrl = () => getApiUrl('chat-enabled');
const getChatPrivilegesApiUrl = () => getApiUrl('chat-privileges');
const getChatRequestsApiUrl = () => getApiUrl('chat-requests');
const getBlockedPlayersApiUrl = () => getApiUrl('blocked-players');
const getAllChatApiUrl = () => getApiUrl('all-chat');

// =======================
// Chat State Manager
// =======================

// Unified chat state manager to prevent mixing between All Chat, Guild Chat, and private chats
const chatStateManager = {
  _activeChatType: null,
  _abortController: null,
  
  getActiveChatType() {
    return this._activeChatType;
  },
  
  setActiveChatType(type) {
    // Abort any ongoing operations for previous chat type
    if (this._abortController) {
      this._abortController.abort();
    }
    
    // Create new AbortController for this chat type
    this._abortController = new AbortController();
    this._activeChatType = type;
    
    // Also update the global activeAllChatTab for backward compatibility
    activeAllChatTab = type;
  },
  
  isChatTypeActive(expectedType) {
    return this._activeChatType === expectedType && activeAllChatTab === expectedType;
  },
  
  clearChatState() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this._activeChatType = null;
    activeAllChatTab = null;
  },
  
  getAbortController() {
    return this._abortController;
  },
  
  setAbortController(abortController) {
    this._abortController = abortController;
  }
};

// =======================
// 3. State & Observers
// =======================

let accountMenuObserver = null;
const processedMenus = new WeakSet();
let vipListModalInstance = null;
let vipListPanelInstance = null;
let vipListRefreshInterval = null;
let panelResizeMouseMoveHandler = null;
let panelResizeMouseUpHandler = null;
let panelDragMouseMoveHandler = null;
let panelDragMouseUpHandler = null;
let vipListPanelTitleRowMousedownHandler = null;
let vipListPanelMousemoveHandler = null;
let vipListPanelMousedownHandler = null;

// Messaging state
let messageCheckInterval = null;
let unreadMessageCount = 0;
let lastMessageCheckTime = 0;
const conversationLastTimestamps = new Map();
let openChatPanels = new Map();
let allChatTabs = new Map();
let vipListItems = new Map(); // Map of playerName -> VIP list item element
let activeAllChatTab = 'all-chat';
let currentTabSwitchPromise = null; // Track ongoing tab switch to cancel if needed
let firebase401WarningShown = false;
let pendingRequestCheckIntervals = new Map();
let conversationUpdateTimeouts = new Map(); // Debounce rapid conversation updates
let allChatUpdateTimeout = null; // Debounce All Chat updates
let modalCloseObserver = null;
const playerLevelCache = new Map(); // Cache for player levels (playerName -> { level, timestamp })
const allChatCache = { messages: null, timestamp: 0, expiresAt: 0 }; // Cache for All Chat messages
const conversationCache = new Map(); // Cache for conversations (playerName -> { messages, timestamp, expiresAt })
const CACHE_TTL = 30000; // Cache time-to-live: 30 seconds (optimized for faster tab switching)
const playerGuildCache = new Map(); // Cache for player guild info (playerName -> { abbreviation, guildId, timestamp })
const GUILD_CACHE_TTL = 3600000; // Cache guild info for 1 hour
const MESSAGES_PER_PAGE = 20; // Number of messages to load per page for pagination

// Track timeouts for cleanup (memory leak prevention)
const pendingTimeouts = new Set();

// =======================
// Storage Helpers
// =======================

// localStorage abstraction helpers
const storage = {
  get(key, defaultValue = null) {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error(`[VIP List] Error loading ${key} from localStorage:`, error);
    }
    return defaultValue;
  },
  
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[VIP List] Error saving ${key} to localStorage:`, error);
      return false;
    }
  }
};

// =======================
// Firebase API Helpers
// =======================

// Firebase API wrapper (preserves exact paths and query parameters)
const firebaseApi = {
  async get(path, options = {}) {
    if (!path) return null;
    
    // Handle query parameters - if path already has ?, use as-is, otherwise add .json and query
    let url = path;
    if (!path.includes('?')) {
      url = path.endsWith('.json') ? path : `${path}.json`;
      if (options.query) {
        url += (url.includes('?') ? '&' : '?') + options.query;
      }
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) return null;
        if (response.status === 401) {
          if (!firebase401WarningShown) {
            console.warn('[VIP List] Firebase access denied (401). Some features may be limited.');
            firebase401WarningShown = true;
          }
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`[VIP List] Firebase GET error for ${path}:`, error);
      return null;
    }
  },
  
  async put(path, data) {
    if (!path) return false;
    
    const url = path.endsWith('.json') ? path : `${path}.json`;
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        return true;
      } else if (response.status === 401) {
        if (!firebase401WarningShown) {
          console.warn('[VIP List] Firebase write access denied (401). Some features may be limited.');
          firebase401WarningShown = true;
        }
        return false;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      console.error(`[VIP List] Firebase PUT error for ${path}:`, error);
      return false;
    }
  },
  
  async delete(path) {
    if (!path) return false;
    
    const url = path.endsWith('.json') ? path : `${path}.json`;
    try {
      const response = await fetch(url, {
        method: 'DELETE'
      });
      
      if (response.ok || response.status === 404) {
        return true;
      } else if (response.status === 401) {
        if (!firebase401WarningShown) {
          console.warn('[VIP List] Firebase delete access denied (401). Some features may be limited.');
          firebase401WarningShown = true;
        }
        return false;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      console.error(`[VIP List] Firebase DELETE error for ${path}:`, error);
      return false;
    }
  }
};

// Sort state: { column: 'name'|'level'|'status'|'rankPoints'|'timeSum', direction: 'asc'|'desc' }
let currentSortState = {
  column: 'name',
  direction: 'asc'
};

// Load sort preference from localStorage
function loadSortPreference() {
  const saved = storage.get(STORAGE_KEYS.SORT);
  if (saved && saved.column && ['name', 'level', 'status', 'rankPoints', 'timeSum'].includes(saved.column) &&
      saved.direction && ['asc', 'desc'].includes(saved.direction)) {
    currentSortState = saved;
    console.log('[VIP List] Loaded sort preference from localStorage:', currentSortState);
    return currentSortState;
  }
  // Default: sort by name ascending
  currentSortState = { column: 'name', direction: 'asc' };
  return currentSortState;
}

// Save sort preference to localStorage
function saveSortPreference() {
  if (storage.set(STORAGE_KEYS.SORT, currentSortState)) {
    console.log('[VIP List] Saved sort preference to localStorage:', currentSortState);
  }
}

// Load config from localStorage (preferred) or context.config
// Similar to Manual Runner's approach - prioritize localStorage
function loadVIPListConfig() {
  const saved = storage.get(STORAGE_KEYS.CONFIG);
  if (saved !== null) {
    console.log('[VIP List] Loaded config from localStorage:', saved);
    // Update context.config if available
    if (typeof context !== 'undefined' && context.config) {
      Object.assign(context.config, saved);
    }
    return saved;
  }
  
  // Fallback to context.config if localStorage is empty
  const defaultConfig = typeof context !== 'undefined' && context.config ? context.config : {};
  return defaultConfig;
}

// Save config to localStorage
function saveVIPListConfig(config) {
  if (storage.set(STORAGE_KEYS.CONFIG, config)) {
    console.log('[VIP List] Saved config to localStorage:', config);
  }
}

// Initialize config - check localStorage first
const vipListConfig = loadVIPListConfig();

// Initialize sort preference - check localStorage first
loadSortPreference();

// Global click handler for closing dropdowns (only add once)
let vipDropdownClickHandler = null;
function setupVIPDropdownClickHandler() {
  if (vipDropdownClickHandler) return;
  
  vipDropdownClickHandler = (e) => {
    // Close all dropdowns if click is outside any dropdown
    const clickedDropdown = e.target.closest('.vip-dropdown-menu');
    const clickedNameButton = e.target.closest('button');
    
    if (!clickedDropdown && !clickedNameButton) {
      document.querySelectorAll('.vip-dropdown-menu').forEach(menu => {
        resetDropdownStyles(menu);
      });
    }
  };
  
  document.addEventListener('click', vipDropdownClickHandler);
}

// Remove global click handler (memory leak prevention)
function removeVIPDropdownClickHandler() {
  if (vipDropdownClickHandler) {
    document.removeEventListener('click', vipDropdownClickHandler);
    vipDropdownClickHandler = null;
  }
}

// Track and clear timeouts (memory leak prevention)
function trackTimeout(timeoutId) {
  pendingTimeouts.add(timeoutId);
  return timeoutId;
}

function clearTrackedTimeout(timeoutId) {
  if (timeoutId) {
    clearTimeout(timeoutId);
    pendingTimeouts.delete(timeoutId);
  }
}

function clearAllPendingTimeouts() {
  pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  pendingTimeouts.clear();
}

// =======================
// 4. Style Injection
// =======================

// Inject all CSS styles once (consolidated stylesheet)
function injectVIPListStyles() {
  if (document.getElementById('vip-list-consolidated-styles')) {
    return; // Already injected
  }
  
  const style = document.createElement('style');
  style.id = 'vip-list-consolidated-styles';
  style.textContent = `
    @keyframes vip-chat-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .vip-search-input.error::placeholder {
      color: ${CSS_CONSTANTS.COLORS.ERROR} !important;
      font-style: italic;
    }
    .vip-search-input.success::placeholder {
      color: ${CSS_CONSTANTS.COLORS.SUCCESS} !important;
      font-style: italic;
    }
    .vip-search-input.duplicate::placeholder {
      color: ${CSS_CONSTANTS.COLORS.DUPLICATE} !important;
      font-style: italic;
    }
  `;
  document.head.appendChild(style);
}

// =======================
// 5. Translation Helpers & Config
// =======================

// Use shared translation system via API
const t = (key) => {
  if (typeof api !== 'undefined' && api.i18n && api.i18n.t) {
    return api.i18n.t(key);
  }
  return key;
};

// Get VIP List interface type from Mod Settings config
function getVIPListInterfaceType() {
  try {
    const config = window.betterUIConfig || {};
    return config.vipListInterface || 'modal'; // Default to 'modal'
  } catch (error) {
    console.warn('[VIP List] Error reading interface type, defaulting to modal:', error);
    return 'modal';
  }
}

const tReplace = (key, replacements) => {
  let text = t(key);
  Object.entries(replacements).forEach(([placeholder, value]) => {
    const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
    text = text.replace(regex, value);
  });
  return text;
};

// =======================
// 6. Player Data Helpers
// =======================

// Get current player's name from game state
// Validate if a username looks valid (not encrypted/corrupted)
function isValidUsername(username) {
  if (!username || typeof username !== 'string') {
    return false;
  }
  
  // Username should be reasonable length (encrypted data is usually 40+ characters)
  if (username.length > 50) {
    return false;
  }
  
  // Check if it looks like base64-encoded encrypted data
  // Encrypted data typically contains base64-specific characters (/, +) or padding (=)
  const hasBase64Chars = username.includes('/') || username.includes('+') || username.includes('=');
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
  
  // If it's 40+ characters and contains base64-specific characters, likely encrypted
  if (username.length >= 40 && hasBase64Chars && base64Pattern.test(username)) {
    return false; // Likely encrypted
  }
  
  // If it's 30+ characters with base64 pattern and padding, likely encrypted
  if (username.length >= 30 && username.includes('=') && base64Pattern.test(username)) {
    return false; // Likely encrypted
  }
  
  // Username should contain at least one alphanumeric character
  if (!/[a-zA-Z0-9]/.test(username)) {
    return false;
  }
  
  return true;
}

function getCurrentPlayerName() {
  try {
    const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
    if (playerState?.name) {
      return playerState.name.toLowerCase();
    }
  } catch (error) {
    // Silently fail if we can't get player state
  }
  return null;
}

// Get current player's level from game state (using same formula as Cyclopedia)
function getCurrentPlayerLevel() {
  try {
    const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
    if (playerState?.exp != null && typeof playerState.exp === 'number') {
      return Math.floor(playerState.exp / 400) + 1;
    }
  } catch (error) {
    // Silently fail if we can't get player level
  }
  return null;
}

// Calculate level from experience points (same as Cyclopedia)
function calculateLevelFromExp(exp) {
  return typeof exp === 'number' ? Math.floor(exp / 400) + 1 : 1;
}

// Calculate player status (Online/Offline)
function calculatePlayerStatus(profileData, isCurrentPlayer) {
  if (isCurrentPlayer) {
    return t('mods.vipList.statusOnline');
  }
  
  const lastUpdated = profileData.lastUpdatedAt;
  
  if (!lastUpdated) {
    return t('mods.vipList.statusOffline');
  }
  
  const lastUpdatedTime = new Date(lastUpdated).getTime();
  const now = Date.now();
  const timeDiff = now - lastUpdatedTime;
  
  return timeDiff <= ONLINE_THRESHOLD_MS 
    ? t('mods.vipList.statusOnline') 
    : t('mods.vipList.statusOffline');
}

// Format time difference for "last online" display
function formatLastOnline(lastUpdatedAt) {
  if (!lastUpdatedAt) return '';
  
  const lastUpdatedTime = new Date(lastUpdatedAt).getTime();
  const now = Date.now();
  const diffMs = now - lastUpdatedTime;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return t('mods.vipList.timeJustNow');
  if (diffMins < 60) {
    const plural = diffMins !== 1 ? t('mods.vipList.wordMinutes') : t('mods.vipList.wordMinute');
    return tReplace('mods.vipList.timeMinutesAgo', { minutes: diffMins, plural: plural });
  }
  if (diffHours < 24) {
    const plural = diffHours !== 1 ? t('mods.vipList.wordHours') : t('mods.vipList.wordHour');
    return tReplace('mods.vipList.timeHoursAgo', { hours: diffHours, plural: plural });
  }
  if (diffDays < 7) {
    const plural = diffDays !== 1 ? t('mods.vipList.wordDays') : t('mods.vipList.wordDay');
    return tReplace('mods.vipList.timeDaysAgo', { days: diffDays, plural: plural });
  }
  
  // For longer periods, show the date
  const date = new Date(lastUpdatedAt);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Extract player info from profile data
function extractPlayerInfoFromProfile(profileData, playerName) {
  const exp = profileData.exp || 0;
  const level = calculateLevelFromExp(exp);
  const currentPlayerName = getCurrentPlayerName();
  const isCurrentPlayer = currentPlayerName && (profileData.name || playerName).toLowerCase() === currentPlayerName;
  const status = calculatePlayerStatus(profileData, isCurrentPlayer);
  const rankPoints = profileData.rankPoints !== undefined ? profileData.rankPoints : 0;
  const timeSum = profileData.ticks !== undefined ? profileData.ticks : 0;
  const floors = profileData.floors !== undefined ? profileData.floors : 0;
  
  return {
    name: profileData.name || playerName,
    level: level,
    status: status,
    rankPoints: rankPoints,
    timeSum: timeSum,
    floors: floors,
    profile: playerName.toLowerCase(),
    lastUpdatedAt: profileData.lastUpdatedAt || null
  };
}

// =======================
// 7. Messaging/Chat Functions
// =======================

const CHAT_PANEL_ID_PREFIX = 'vip-chat-panel-';
const CHAT_PANEL_DIMENSIONS = {
  MIN_WIDTH: 280,
  MAX_WIDTH: 800,
  MIN_HEIGHT: 200,
  MAX_HEIGHT: 800,
  DEFAULT_WIDTH: 320,
  DEFAULT_HEIGHT: 380
};

function getChatPanelId(playerName) {
  return `${CHAT_PANEL_ID_PREFIX}${playerName.toLowerCase()}`;
}

function saveChatPanelPosition(playerName, panel) {
  const positions = loadAllChatPanelPositions();
  const rect = panel.getBoundingClientRect();
  
  positions[playerName.toLowerCase()] = {
    left: rect.left,
    top: rect.top,
    right: window.innerWidth - rect.right,
    width: rect.width,
    height: rect.height
  };
  
  storage.set(STORAGE_KEYS.CHAT_PANEL_POSITIONS, positions);
}

// Load chat panel position from localStorage
function loadChatPanelPosition(playerName) {
  const positions = loadAllChatPanelPositions();
  return positions[playerName.toLowerCase()] || null;
}

// Load all chat panel positions from localStorage
function loadAllChatPanelPositions() {
  return storage.get(STORAGE_KEYS.CHAT_PANEL_POSITIONS, {});
}

function saveChatPanelSettings(isOpen = true, closedManually = false) {
  // Don't save during auto-reopen to prevent overwriting tabs before restoration
  if (window._vipListChatAutoReopening) {
    return;
  }
  const panel = document.getElementById('vip-chat-panel-all-chat');
  if (panel && panel._isAutoReopening) {
    return;
  }
  
  // Get list of open tabs (excluding 'all-chat' as it's always created)
  // Filter out any invalid tab names (shouldn't happen, but safety check)
  const openTabs = Array.from(allChatTabs.keys())
    .filter(name => name !== 'all-chat')
    .filter(name => isValidTabName(name));
  
  // Validate activeTab before saving
  const activeTab = activeAllChatTab || 'all-chat';
  const validActiveTab = isValidTabName(activeTab) ? activeTab : 'all-chat';
  
  const settings = {
    isOpen: isOpen,
    closedManually: closedManually,
    openTabs: openTabs,
    activeTab: validActiveTab
  };
  if (storage.set(STORAGE_KEYS.CHAT_PANEL_SETTINGS, settings)) {
    console.log('[VIP List] Chat panel settings saved:', settings);
  }
}

// Validate if a tab name is valid (not encrypted/invalid)
function isValidTabName(tabName) {
  if (!tabName || typeof tabName !== 'string') {
    return false;
  }
  
  // Special tab names are always valid
  if (tabName === 'all-chat') {
    return true;
  }
  
  // Guild chat tabs are valid if they have the correct format
  if (tabName.startsWith('guild-')) {
    const guildId = tabName.replace('guild-', '');
    // Guild ID should be a valid string (not encrypted)
    return guildId.length > 0 && guildId.length < 100;
  }
  
  // Regular player tabs must pass username validation
  return isValidUsername(tabName);
}

// Load chat panel settings from localStorage
function loadChatPanelSettings() {
  const saved = storage.get(STORAGE_KEYS.CHAT_PANEL_SETTINGS);
  if (saved) {
    console.log('[VIP List] Chat panel settings loaded:', saved);
    
    // Clean up invalid tab names (encrypted values that couldn't be decrypted)
    let cleaned = false;
    const cleanedSettings = { ...saved };
    
    // Clean up activeTab if invalid
    if (saved.activeTab && !isValidTabName(saved.activeTab)) {
      console.warn('[VIP List] Removing invalid activeTab (likely encrypted):', saved.activeTab);
      cleanedSettings.activeTab = 'all-chat';
      cleaned = true;
    }
    
    // Clean up openTabs array if it exists
    if (Array.isArray(saved.openTabs)) {
      const validTabs = saved.openTabs.filter(tab => isValidTabName(tab));
      if (validTabs.length !== saved.openTabs.length) {
        const invalidTabs = saved.openTabs.filter(tab => !isValidTabName(tab));
        console.warn('[VIP List] Removing invalid openTabs (likely encrypted):', invalidTabs);
        cleanedSettings.openTabs = validTabs;
        cleaned = true;
      }
    }
    
    // Save cleaned settings back to localStorage if any were cleaned
    if (cleaned) {
      storage.set(STORAGE_KEYS.CHAT_PANEL_SETTINGS, cleanedSettings);
      console.log('[VIP List] Chat panel settings cleaned and saved:', cleanedSettings);
    }
    
    return cleanedSettings;
  }
  
  // Return default settings
  return {
    isOpen: false,
    closedManually: false,
    openTabs: [],
    activeTab: 'all-chat'
  };
}

// Check if chat panel should be reopened after page refresh
function shouldReopenChatPanel() {
  if (!MESSAGING_CONFIG.enabled) {
    return false;
  }
  
  const savedSettings = loadChatPanelSettings();
  // Auto-reopen if panel was open and not manually closed
  return savedSettings.isOpen && !savedSettings.closedManually;
}

// Auto-reopen chat panel after page refresh
async function autoReopenChatPanel() {
  if (shouldReopenChatPanel()) {
    console.log('[VIP List] Auto-reopen chat panel after page refresh');
    const timeoutId = setTimeout(async () => {
      pendingTimeouts.delete(timeoutId);
      
      // Wait for player name to be available
      let retries = 0;
      const maxRetries = 20; // 10 seconds total (20 * 500ms)
      while (!getCurrentPlayerName() && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
        retries++;
      }
      
      if (!getCurrentPlayerName()) {
        console.error('[VIP List] Could not get player name, skipping chat panel auto-reopen');
        return;
      }
      
      // Load saved settings to get active tab preference
      // loadChatPanelSettings() now automatically cleans up invalid tab names
      const savedSettings = loadChatPanelSettings();
      const activeTabToRestore = savedSettings.activeTab || 'all-chat';
      
      // Double-check that activeTab is valid (should already be cleaned, but safety check)
      const validActiveTab = isValidTabName(activeTabToRestore) && 
                            (activeTabToRestore === 'all-chat' || allChatTabs.has(activeTabToRestore))
                            ? activeTabToRestore 
                            : 'all-chat';
      
      // Temporarily disable saving during panel creation
      window._vipListChatAutoReopening = true;
      
      await openAllChatPanel();
      
      // Set flag on panel after it's created
      const panel = document.getElementById('vip-chat-panel-all-chat');
      if (panel) {
        panel._isAutoReopening = true;
      }
      
      // Wait for panel to be fully ready and tabs to be opened
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // On init, tabs are synced from Firebase (source of truth):
      // 1. All Chat (always created)
      // 2. Guild chat (if user has guild)
      // 3. Unread messages from Firebase
      // 4. Chat requests from Firebase
      // No stale tabs are restored from localStorage
      
      // Switch to saved active tab if it still exists
      if (validActiveTab === 'all-chat' || allChatTabs.has(validActiveTab)) {
        await switchAllChatTab(validActiveTab);
      } else {
        // Default to all-chat
        await switchAllChatTab('all-chat');
      }
      
      // Re-enable saving and save final state
      window._vipListChatAutoReopening = false;
      const finalPanel = document.getElementById('vip-chat-panel-all-chat');
      if (finalPanel) {
        finalPanel._isAutoReopening = false;
        saveChatPanelSettings(true, false);
      }
    }, TIMEOUTS.INITIAL_CHECK); // Wait for page to fully load
    trackTimeout(timeoutId);
  }
}

// Make a panel resizable with edge-based resizing (same as VIP List panel)
function makePanelResizable(panel, headerContainer, savePositionCallback, dimensions) {
  const edgeSize = 8; // px, area near edge/corner to trigger resize
  panel._isResizing = false;
  panel._resizeDir = '';
  panel._resizeStartX = 0;
  panel._resizeStartY = 0;
  panel._resizeStartWidth = 0;
  panel._resizeStartHeight = 0;
  panel._resizeStartLeft = 0;
  panel._resizeStartTop = 0;
  
  function getResizeDirection(e) {
    const rect = panel.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let dir = '';
    
    if (y < edgeSize) dir += 'n';
    else if (y > rect.height - edgeSize) dir += 's';
    if (x < edgeSize) dir += 'w';
    else if (x > rect.width - edgeSize) dir += 'e';
    
    return dir;
  }
  
  // Remove old handlers if they exist
  if (panel._allChatPanelMousemoveHandler) {
    panel.removeEventListener('mousemove', panel._allChatPanelMousemoveHandler);
  }
  if (panel._allChatPanelMousedownHandler) {
    panel.removeEventListener('mousedown', panel._allChatPanelMousedownHandler);
  }
  if (panel._resizeHandler) {
    document.removeEventListener('mousemove', panel._resizeHandler);
  }
  if (panel._resizeUpHandler) {
    document.removeEventListener('mouseup', panel._resizeUpHandler);
  }
  
  const allChatPanelMousemoveHandler = function(e) {
    if (panel._isResizing) return;
    const dir = getResizeDirection(e);
    let cursor = '';
    switch (dir) {
      case 'n': cursor = 'ns-resize'; break;
      case 's': cursor = 'ns-resize'; break;
      case 'e': cursor = 'ew-resize'; break;
      case 'w': cursor = 'ew-resize'; break;
      case 'ne': cursor = 'nesw-resize'; break;
      case 'nw': cursor = 'nwse-resize'; break;
      case 'se': cursor = 'nwse-resize'; break;
      case 'sw': cursor = 'nesw-resize'; break;
      default: cursor = '';
    }
    panel.style.cursor = cursor || '';
  };
  panel.addEventListener('mousemove', allChatPanelMousemoveHandler);
  panel._allChatPanelMousemoveHandler = allChatPanelMousemoveHandler;
  
  const allChatPanelMousedownHandler = function(e) {
    // Don't resize if clicking on tabs, close button, or buttons
    if (e.target.tagName === 'BUTTON' || 
        e.target.closest('.all-chat-tab') || 
        e.target.closest('button[title="Close"]') ||
        (headerContainer && headerContainer.contains(e.target) && e.target !== headerContainer)) return;
    const dir = getResizeDirection(e);
    if (!dir) return;
    panel._isResizing = true;
    panel._resizeDir = dir;
    panel._resizeStartX = e.clientX;
    panel._resizeStartY = e.clientY;
    const rect = panel.getBoundingClientRect();
    panel._resizeStartWidth = rect.width;
    panel._resizeStartHeight = rect.height;
    panel._resizeStartLeft = rect.left;
    panel._resizeStartTop = rect.top;
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };
  panel.addEventListener('mousedown', allChatPanelMousedownHandler);
  panel._allChatPanelMousedownHandler = allChatPanelMousedownHandler;
  
  const panelResizeMouseMoveHandler = function(e) {
    if (!panel._isResizing) return;
    let dx = e.clientX - panel._resizeStartX;
    let dy = e.clientY - panel._resizeStartY;
    let newWidth = panel._resizeStartWidth;
    let newHeight = panel._resizeStartHeight;
    let newLeft = panel._resizeStartLeft;
    let newTop = panel._resizeStartTop;
    
    if (panel._resizeDir.includes('e')) {
      newWidth = clamp(panel._resizeStartWidth + dx, dimensions.MIN_WIDTH, dimensions.MAX_WIDTH);
    }
    if (panel._resizeDir.includes('w')) {
      newWidth = clamp(panel._resizeStartWidth - dx, dimensions.MIN_WIDTH, dimensions.MAX_WIDTH);
      newLeft = panel._resizeStartLeft + dx;
    }
    if (panel._resizeDir.includes('s')) {
      newHeight = clamp(panel._resizeStartHeight + dy, dimensions.MIN_HEIGHT, dimensions.MAX_HEIGHT);
    }
    if (panel._resizeDir.includes('n')) {
      newHeight = clamp(panel._resizeStartHeight - dy, dimensions.MIN_HEIGHT, dimensions.MAX_HEIGHT);
      newTop = panel._resizeStartTop + dy;
    }
    
    panel.style.width = newWidth + 'px';
    panel.style.height = newHeight + 'px';
    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
    panel.style.right = 'auto';
    panel.style.transition = 'none';
  };
  document.addEventListener('mousemove', panelResizeMouseMoveHandler);
  panel._resizeHandler = panelResizeMouseMoveHandler;
  
  const panelResizeMouseUpHandler = function() {
    if (panel._isResizing) {
      panel._isResizing = false;
      document.body.style.userSelect = '';
      panel.style.transition = '';
      panel.style.cursor = '';
      if (savePositionCallback) {
        savePositionCallback();
      }
    }
  };
  document.addEventListener('mouseup', panelResizeMouseUpHandler);
  panel._resizeUpHandler = panelResizeMouseUpHandler;
  panel._resizeHandlersAttached = true;
}

// Make a panel draggable (shared function for all chat panels)
function makePanelDraggable(panel, headerContainer, savePositionCallback) {
  // Initialize drag state on panel object
  panel._isDragging = false;
  panel._dragOffsetX = 0;
  panel._dragOffsetY = 0;
  
  // Remove old handlers if they exist (for reattachment)
  if (panel._dragHandler) {
    document.removeEventListener('mousemove', panel._dragHandler);
  }
  if (panel._dragUpHandler) {
    document.removeEventListener('mouseup', panel._dragUpHandler);
  }
  if (panel._mousedownHandler) {
    headerContainer.removeEventListener('mousedown', panel._mousedownHandler);
  }
  
  // Mousedown handler
  const mousedownHandler = function(e) {
    // Don't drag if clicking on buttons, tabs, or close button
    if (e.target.tagName === 'BUTTON' || 
        e.target.closest('button') || 
        e.target.closest('.all-chat-tab')) return;
    panel._isDragging = true;
    const rect = panel.getBoundingClientRect();
    panel._dragOffsetX = e.clientX - rect.left;
    panel._dragOffsetY = e.clientY - rect.top;
    // Ensure we're using left/top positioning for dragging
    if (panel.style.right && !panel.style.left) {
      panel.style.left = rect.left + 'px';
      panel.style.right = 'auto';
    }
    panel.style.cursor = 'move';
    e.preventDefault();
  };
  
  // Mousemove handler
  const panelDragMouseMoveHandler = function(e) {
    if (!panel._isDragging) return;
    const newLeft = e.clientX - panel._dragOffsetX;
    const newTop = e.clientY - panel._dragOffsetY;
    
    const maxLeft = window.innerWidth - panel.offsetWidth;
    const maxTop = window.innerHeight - panel.offsetHeight;
    
    const clampedLeft = clamp(newLeft, 0, maxLeft);
    const clampedTop = clamp(newTop, 0, maxTop);
    
    panel.style.left = clampedLeft + 'px';
    panel.style.top = clampedTop + 'px';
    panel.style.right = 'auto';
    panel.style.transition = 'none';
    
    // Save position during drag
    if (savePositionCallback) {
      savePositionCallback();
    }
  };
  
  // Mouseup handler
  const panelDragMouseUpHandler = function() {
    if (panel._isDragging) {
      panel._isDragging = false;
      panel.style.cursor = '';
      panel.style.transition = '';
      // Save position after drag ends
      if (savePositionCallback) {
        savePositionCallback();
      }
    }
  };
  
  // Attach handlers
  headerContainer.addEventListener('mousedown', mousedownHandler);
  document.addEventListener('mousemove', panelDragMouseMoveHandler);
  document.addEventListener('mouseup', panelDragMouseUpHandler);
  
  // Store handlers for cleanup
  panel._dragHandler = panelDragMouseMoveHandler;
  panel._dragUpHandler = panelDragMouseUpHandler;
  panel._mousedownHandler = mousedownHandler;
  panel._dragHandlersAttached = true;
}

// Remove drag handlers from a panel (for cleanup)
function removePanelDragHandlers(panel, headerContainer) {
  if (panel._dragHandler) {
    document.removeEventListener('mousemove', panel._dragHandler);
  }
  if (panel._dragUpHandler) {
    document.removeEventListener('mouseup', panel._dragUpHandler);
  }
  if (panel._upHandler) {
    document.removeEventListener('mouseup', panel._upHandler);
  }
  if (panel._mousedownHandler && headerContainer) {
    headerContainer.removeEventListener('mousedown', panel._mousedownHandler);
  }
  panel._dragHandlersAttached = false;
}

function formatBadgeCount(count) {
  return count > 0 ? (count > 9 ? '9+' : count.toString()) : '';
}

function groupMessagesBySender(messages) {
  const grouped = new Map();
  messages.forEach(msg => {
    const sender = msg.from.toLowerCase();
    if (!grouped.has(sender)) {
      grouped.set(sender, []);
    }
    grouped.get(sender).push(msg);
  });
  return grouped;
}

function getPlayerUnreadCount(messages, playerName) {
  return messages.filter(msg => 
    msg.from.toLowerCase() === playerName.toLowerCase() && !msg.read
  ).length;
}

// =======================
// Encryption Utilities
// =======================

// Base64 encoding/decoding utilities for encryption
const cryptoUtils = {
  // Encode IV + encrypted data as base64
  encodeWithIV(iv, encryptedData) {
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);
    return btoa(String.fromCharCode(...combined));
  },
  
  // Decode base64 to IV + encrypted data
  decodeWithIV(encoded) {
    try {
      return Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    } catch (e) {
      return null;
    }
  },
  
  // Extract IV and encrypted data from combined array
  extractIVAndData(combined) {
    if (!combined || combined.length < 13) return null;
    return {
      iv: combined.slice(0, 12),
      encrypted: combined.slice(12)
    };
  }
};

// Generic key derivation function
async function deriveKey(salt, password) {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const saltBytes = encoder.encode(salt);
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  
  return key;
}

// Generic encryption function
async function encryptData(data, key) {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    dataBytes
  );
  
  return cryptoUtils.encodeWithIV(iv, encrypted);
}

// Generic decryption function
async function decryptData(encoded, key) {
  const combined = cryptoUtils.decodeWithIV(encoded);
  if (!combined) return null;
  
  const extracted = cryptoUtils.extractIVAndData(combined);
  if (!extracted) return null;
  
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: extracted.iv },
      key,
      extracted.encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    return null;
  }
}

// =======================
// Username Hashing
// =======================

// Hash username for use in Firebase paths (deterministic, one-way)
// Cache for username hashes (usernames don't change, so cache permanently)
const usernameHashCache = new Map();

async function hashUsername(username) {
  if (!username) return '';
  
  const key = username.toLowerCase();
  
  // Check cache first
  if (usernameHashCache.has(key)) {
    return usernameHashCache.get(key);
  }
  
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const hash = hashHex.substring(0, 32); // Use first 32 chars (64 hex chars = 32 bytes)
    
    // Cache the hash
    usernameHashCache.set(key, hash);
    return hash;
  } catch (error) {
    console.error('[VIP List] Username hashing error:', error);
    // Fallback to plain username if hashing fails
    const fallback = key.replace(/[^a-z0-9_]/g, '_');
    usernameHashCache.set(key, fallback);
    return fallback;
  }
}

// Encrypt username for storage in message/request bodies
async function encryptUsername(username, player1, player2) {
  try {
    const key = await deriveUsernameKey(player1, player2);
    return await encryptData(username, key);
  } catch (error) {
    console.error('[VIP List] Username encryption error:', error);
    throw error;
  }
}

// Decrypt username from message/request bodies
async function decryptUsername(encryptedUsername, player1, player2) {
  try {
    // Check if it looks like encrypted data
    if (!encryptedUsername || typeof encryptedUsername !== 'string') {
      return encryptedUsername; // Return as-is if not a string
    }
    
    // Try to decode base64 - if it fails, it's probably not encrypted
    const combined = cryptoUtils.decodeWithIV(encryptedUsername);
    if (!combined) {
      // Not valid base64, probably unencrypted username (backward compatibility)
      return encryptedUsername;
    }
    
    // Check if we have enough data (at least 12 bytes for IV + some encrypted data)
    if (combined.length < 13) {
      // Too short to be encrypted, probably unencrypted username
      return encryptedUsername;
    }
    
    const key = await deriveUsernameKey(player1, player2);
    const decrypted = await decryptData(encryptedUsername, key);
    
    // If decryption fails, return original (for backward compatibility)
    return decrypted !== null ? decrypted : encryptedUsername;
  } catch (error) {
    // If decryption fails, return original (for backward compatibility)
    if (!error.message.includes('invalid') && !error.message.includes('String contains')) {
      console.warn('[VIP List] Username decryption error (may be unencrypted):', error.message);
    }
    return encryptedUsername;
  }
}

// Encrypt read status for storage in Firebase
async function encryptReadStatus(readStatus, player1, player2) {
  try {
    const key = await deriveReadStatusKey(player1, player2);
    return await encryptData(readStatus ? 'true' : 'false', key);
  } catch (error) {
    console.error('[VIP List] Read status encryption error:', error);
    throw error;
  }
}

// Decrypt read status from Firebase
async function decryptReadStatus(encryptedReadStatus, player1, player2) {
  try {
    // Check if it looks like encrypted data
    if (!encryptedReadStatus || typeof encryptedReadStatus !== 'string') {
      // Backward compatibility: if it's a boolean, return it
      if (typeof encryptedReadStatus === 'boolean') {
        return encryptedReadStatus;
      }
      // If it's the string "true" or "false", convert to boolean
      if (encryptedReadStatus === 'true' || encryptedReadStatus === true) {
        return true;
      }
      if (encryptedReadStatus === 'false' || encryptedReadStatus === false) {
        return false;
      }
      return false; // Default to false for unread
    }
    
    // Try to decode base64 - if it fails, it's probably not encrypted
    const combined = cryptoUtils.decodeWithIV(encryptedReadStatus);
    if (!combined) {
      // Not valid base64, probably unencrypted (backward compatibility)
      if (encryptedReadStatus === 'true' || encryptedReadStatus === true) {
        return true;
      }
      return false;
    }
    
    // Check if we have enough data (at least 12 bytes for IV + some encrypted data)
    if (combined.length < 13) {
      // Too short to be encrypted, probably unencrypted (backward compatibility)
      if (encryptedReadStatus === 'true' || encryptedReadStatus === true) {
        return true;
      }
      return false;
    }
    
    const key = await deriveReadStatusKey(player1, player2);
    const decrypted = await decryptData(encryptedReadStatus, key);
    
    // If decryption fails, return false for backward compatibility
    if (decrypted === null) {
      if (encryptedReadStatus === 'true' || encryptedReadStatus === true) {
        return true;
      }
      return false;
    }
    
    return decrypted === 'true';
  } catch (error) {
    // If decryption fails, return false for backward compatibility
    if (!error.message.includes('invalid') && !error.message.includes('String contains')) {
      console.warn('[VIP List] Read status decryption error (may be unencrypted):', error.message);
    }
    // Backward compatibility: try to parse as boolean/string
    if (encryptedReadStatus === 'true' || encryptedReadStatus === true) {
      return true;
    }
    return false;
  }
}

// Derive a shared encryption key for read status from two player names (deterministic)
async function deriveReadStatusKey(player1, player2) {
  const sortedNames = [player1.toLowerCase(), player2.toLowerCase()].sort();
  const password = sortedNames.join('|') + '|readstatus';
  return deriveKey('vip-list-readstatus-salt', password);
}

// Derive a shared encryption key for usernames from two player names (deterministic)
async function deriveUsernameKey(player1, player2) {
  const sortedNames = [player1.toLowerCase(), player2.toLowerCase()].sort();
  const password = sortedNames.join('|') + '|username';
  return deriveKey('vip-list-username-salt', password);
}

// Derive a shared encryption key from two player names (deterministic)
async function deriveChatKey(player1, player2) {
  const sortedNames = [player1.toLowerCase(), player2.toLowerCase()].sort();
  const password = sortedNames.join('|');
  return deriveKey('vip-list-chat-salt', password);
}

// Encrypt message text
async function encryptMessage(text, player1, player2) {
  try {
    const key = await deriveChatKey(player1, player2);
    return await encryptData(text, key);
  } catch (error) {
    console.error('[VIP List] Encryption error:', error);
    throw error;
  }
}

// Decrypt message text
async function decryptMessage(encryptedText, player1, player2) {
  try {
    // Check if text looks like base64 (basic validation)
    if (!encryptedText || typeof encryptedText !== 'string') {
      return encryptedText; // Return as-is if not a string
    }
    
    // Try to decode base64 - if it fails, it's probably not encrypted
    const combined = cryptoUtils.decodeWithIV(encryptedText);
    if (!combined) {
      // Not valid base64, probably unencrypted message
      return encryptedText;
    }
    
    // Check if we have enough data (at least 12 bytes for IV + some encrypted data)
    if (combined.length < 13) {
      // Too short to be encrypted, probably unencrypted message
      return encryptedText;
    }
    
    const key = await deriveChatKey(player1, player2);
    const decrypted = await decryptData(encryptedText, key);
    
    // If decryption fails, return original text (for backward compatibility)
    return decrypted !== null ? decrypted : encryptedText;
  } catch (error) {
    // If decryption fails, return original text (for backward compatibility with unencrypted messages)
    // Only log if it's not a common error (like invalid base64)
    if (!error.message.includes('invalid') && !error.message.includes('String contains')) {
      console.warn('[VIP List] Decryption error (message may be unencrypted):', error.message);
    }
    return encryptedText;
  }
}

// =======================
// Guild Chat Functions
// =======================

// Validate chat API URL to ensure correct endpoint is used
function validateChatApiUrl(url, expectedType) {
  if (!url || typeof url !== 'string') {
    console.error(`[VIP List] Invalid ${expectedType} API URL:`, url);
    return false;
  }
  
  if (expectedType === 'all-chat') {
    if (!url.includes('/all-chat')) {
      console.error('[VIP List] All Chat endpoint validation failed: URL does not contain /all-chat', url);
      return false;
    }
    if (url.includes('/guilds/')) {
      console.error('[VIP List] All Chat endpoint validation failed: URL contains /guilds/ (should be all-chat only)', url);
      return false;
    }
  } else if (expectedType === 'guild-chat') {
    if (!url.includes('/guilds/chat/')) {
      console.error('[VIP List] Guild Chat endpoint validation failed: URL does not contain /guilds/chat/', url);
      return false;
    }
    if (url.includes('/all-chat')) {
      console.error('[VIP List] Guild Chat endpoint validation failed: URL contains /all-chat (should be guilds/chat only)', url);
      return false;
    }
  }
  
  return true;
}

// Get guild chat API URL (VIP List specific)
function getVipListGuildChatApiUrl(guildId) {
  if (!guildId) {
    console.error('[VIP List] getVipListGuildChatApiUrl called without guildId');
    return null;
  }
  const firebaseUrl = MESSAGING_CONFIG.firebaseUrl;
  const url = `${firebaseUrl}/guilds/chat/${guildId}`;
  
  // Validate URL doesn't accidentally point to All Chat
  if (!validateChatApiUrl(url, 'guild-chat')) {
    return null;
  }
  
  return url;
}

// Get player's guild from localStorage (set by Guilds mod)
function getPlayerGuild() {
  return storage.get('guilds-data', null);
}

// Extract guild ID from tab name (e.g., "guild-abc123" -> "abc123")
function extractGuildIdFromTabName(tabName) {
  if (!tabName || !tabName.startsWith('guild-')) return null;
  return tabName.replace('guild-', '');
}

// Check if a tab name is a guild chat tab
function isGuildChatTab(tabName) {
  return tabName && tabName.startsWith('guild-');
}

// Switch away from a guild tab to All Chat or first available tab
function switchAwayFromGuildTab() {
  if (activeAllChatTab && isGuildChatTab(activeAllChatTab)) {
    if (allChatTabs.has('all-chat')) {
      switchAllChatTab('all-chat');
    } else if (allChatTabs.size > 0) {
      const firstTab = allChatTabs.keys().next().value;
      if (firstTab) {
        switchAllChatTab(firstTab);
      }
    }
  }
}

// Check if a guild exists in Firebase
async function guildExists(guildId) {
  if (!guildId) return false;
  try {
    const firebaseUrl = MESSAGING_CONFIG.firebaseUrl;
    const response = await fetch(`${firebaseUrl}/guilds/list/${guildId}.json`);
    if (!response.ok) {
      return false;
    }
    const guild = await response.json();
    return guild !== null && typeof guild === 'object';
  } catch (error) {
    console.error('[VIP List] Error checking if guild exists:', error);
    return false;
  }
}

// Derive an encryption key from guild ID (deterministic - all members use same key)
async function deriveGuildChatKey(guildId) {
  try {
    return deriveKey('guild-chat-salt', guildId);
  } catch (error) {
    console.error('[VIP List] Error deriving guild chat key:', error);
    throw error;
  }
}

// Encrypt guild chat message
async function encryptGuildMessage(text, guildId) {
  try {
    const key = await deriveGuildChatKey(guildId);
    return await encryptData(text, key);
  } catch (error) {
    console.error('[VIP List] Error encrypting guild message:', error);
    throw error;
  }
}

// Decrypt guild chat message
async function decryptGuildMessage(encryptedText, guildId) {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') {
      return encryptedText;
    }
    
    const combined = cryptoUtils.decodeWithIV(encryptedText);
    if (!combined || combined.length < 13) {
      return encryptedText;
    }
    
    const key = await deriveGuildChatKey(guildId);
    const decrypted = await decryptData(encryptedText, key);
    
    // If decryption fails, return original (for backward compatibility)
    return decrypted !== null ? decrypted : encryptedText;
  } catch (error) {
    if (!error.message.includes('invalid') && !error.message.includes('String contains')) {
      console.warn('[VIP List] Guild message decryption error (may be unencrypted):', error.message);
    }
    return encryptedText;
  }
}

// Send guild chat message
async function sendGuildChatMessage(guildId, text) {
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      throw new Error('Could not get current player name');
    }

    if (!text || text.trim().length === 0) {
      return false;
    }

    if (text.length > 1000) {
      throw new Error('Message must be 1000 characters or less');
    }

    const messageText = text.trim();
    const encryptedText = await encryptGuildMessage(messageText, guildId);
    
    const messageData = {
      from: currentPlayer,
      fromHashed: await hashUsername(currentPlayer),
      text: encryptedText,
      timestamp: Date.now()
    };

    const messageId = Date.now().toString();
    const response = await fetch(`${getVipListGuildChatApiUrl(guildId)}/${messageId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('[VIP List] Error sending guild message:', error);
    throw error;
  }
}

// Get guild chat messages with pagination support
// limit: maximum number of messages to fetch (default: MESSAGES_PER_PAGE)
// endBefore: message ID to fetch messages before (for pagination)
// abortController: AbortController to cancel the fetch request
async function getGuildChatMessages(guildId, limit = MESSAGES_PER_PAGE, endBefore = null, abortController = null) {
  try {
    // Validate guild ID
    if (!guildId) {
      console.error('[VIP List] getGuildChatMessages called without guildId');
      return [];
    }
    
    // Get and validate API URL
    const guildChatUrl = getVipListGuildChatApiUrl(guildId);
    if (!guildChatUrl) {
      console.error('[VIP List] Invalid Guild Chat API URL');
      return [];
    }
    
    // Validate URL doesn't accidentally point to All Chat
    if (!validateChatApiUrl(guildChatUrl, 'guild-chat')) {
      console.error('[VIP List] Guild Chat URL validation failed');
      return [];
    }
    
    let queryUrl = `${guildChatUrl}.json?orderBy="$key"&limitToLast=${limit}`;

    // If endBefore is provided, use endAt to get messages before that key
    if (endBefore !== null) {
      queryUrl += `&endAt="${endBefore}"`;
    }
    
    // Fetch guild chat messages with abort signal support
    const fetchOptions = {};
    if (abortController) {
      fetchOptions.signal = abortController.signal;
    }
    
    let response;
    try {
      response = await fetch(queryUrl, fetchOptions);
    } catch (error) {
      // If fetch was aborted, return empty array
      if (error.name === 'AbortError' || abortController?.signal.aborted) {
        return [];
      }
      throw error;
    }
    
    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      if (response.status === 401) {
        return [];
      }
      throw new Error(`Failed to get messages: ${response.status}`);
    }
    const data = await response.json();
    if (!data || typeof data !== 'object') {
      return [];
    }
    const messages = Object.entries(data)
      .map(([id, message]) => ({ id, ...message }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Decrypt messages
    const decryptedMessages = await Promise.all(
      messages.map(async (msg) => {
        try {
          const decryptedText = await decryptGuildMessage(msg.text, guildId);
          return { ...msg, text: decryptedText };
        } catch (error) {
          console.warn('[VIP List] Failed to decrypt guild message:', error);
          return msg;
        }
      })
    );
    
    return decryptedMessages;
  } catch (error) {
    console.error('[VIP List] Error getting guild messages:', error);
    return [];
  }
}

// Sync guild chat tab - ensures only one guild chat tab exists, placed after All Chat
async function syncGuildChatTab() {
  const panel = document.getElementById('vip-chat-panel-all-chat');
  if (!panel) return;
  
  const headerContainer = panel.querySelector('#all-chat-tabs-container');
  if (!headerContainer) return;
  
  const tabsContainer = headerContainer.querySelector('div:first-child');
  if (!tabsContainer) return;
  
  // Remove all existing guild chat tabs
  const guildTabNames = Array.from(allChatTabs.keys()).filter(name => isGuildChatTab(name));
  for (const tabName of guildTabNames) {
    const tab = allChatTabs.get(tabName);
    if (tab) {
      tab.remove();
      allChatTabs.delete(tabName);
    }
  }
  
  // If user has no guild, we're done (guild chat is hidden)
  const playerGuild = getPlayerGuild();
  if (!playerGuild || !playerGuild.abbreviation) {
    switchAwayFromGuildTab();
    
    // Save panel settings
    if (panel.style.display !== 'none') {
      saveChatPanelSettings(true, false);
    }
    return;
  }
  
  // Verify guild exists before creating tab
  const guildId = playerGuild.id;
  const guildExistsCheck = await guildExists(guildId);
  if (!guildExistsCheck) {
    // Guild doesn't exist, switch away from guild tab if active
    switchAwayFromGuildTab();
    
    // Save panel settings
    if (panel.style.display !== 'none') {
      saveChatPanelSettings(true, false);
    }
    return;
  }
  
  // Add guild chat tab after All Chat tab
  const tabName = `guild-${guildId}`;
  const displayName = playerGuild.abbreviation;
  
  // Find All Chat tab to insert after it
  const allChatTab = tabsContainer.querySelector('[data-player-name="all-chat"]');
  const guildChatTab = await createAllChatTab(tabName, displayName, 0, false);
  
  if (allChatTab && allChatTab.nextSibling) {
    // Insert after All Chat tab
    tabsContainer.insertBefore(guildChatTab, allChatTab.nextSibling);
  } else if (allChatTab) {
    // All Chat is last, append guild chat
    tabsContainer.appendChild(guildChatTab);
  } else {
    // No All Chat tab, just append
    tabsContainer.appendChild(guildChatTab);
  }
  
  allChatTabs.set(tabName, guildChatTab);
  
  // Save panel settings
  if (panel.style.display !== 'none') {
    saveChatPanelSettings(true, false);
  }
}

// Add guild chat tab (legacy function, now uses syncGuildChatTab)
async function addGuildChatTab() {
  await syncGuildChatTab();
}

// Show loading indicator at top of chat container
function showLoadingIndicator(container) {
  // Remove existing indicator if any
  const existingIndicator = container.querySelector('.vip-chat-loading-indicator');
  if (existingIndicator) {
    return existingIndicator;
  }
  
  const indicator = document.createElement('div');
  indicator.className = 'vip-chat-loading-indicator';
  indicator.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    color: ${CSS_CONSTANTS.COLORS.WHITE_70};
    font-size: 12px;
    gap: 8px;
    user-select: none;
  `;
  
  // Create spinner
  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    animation: vip-chat-spin 0.8s linear infinite;
  `;
  
  // Inject styles (consolidated)
  injectVIPListStyles();
  
  const text = document.createElement('span');
  text.textContent = 'Loading older messages...';
  
  indicator.appendChild(spinner);
  indicator.appendChild(text);
  
  // Insert at the top of container
  container.insertBefore(indicator, container.firstChild);
  
  return indicator;
}

// Hide loading indicator
function hideLoadingIndicator(container) {
  const indicator = container.querySelector('.vip-chat-loading-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Show "beginning of conversation" indicator at top of chat container
function showBeginningIndicator(container) {
  // Remove existing indicator if any
  const existingIndicator = container.querySelector('.vip-chat-beginning-indicator');
  if (existingIndicator) {
    return existingIndicator;
  }
  
  const indicator = document.createElement('div');
  indicator.className = 'vip-chat-beginning-indicator';
  indicator.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    color: ${CSS_CONSTANTS.COLORS.WHITE_50};
    font-size: 12px;
    user-select: none;
    font-style: italic;
  `;
  
  const text = document.createElement('span');
  text.textContent = 'Beginning of conversation';
  
  indicator.appendChild(text);
  
  // Insert at the top of container (after loading indicator if it exists)
  const loadingIndicator = container.querySelector('.vip-chat-loading-indicator');
  if (loadingIndicator) {
    container.insertBefore(indicator, loadingIndicator.nextSibling);
  } else {
    container.insertBefore(indicator, container.firstChild);
  }
  
  return indicator;
}

// Hide "beginning of conversation" indicator
function hideBeginningIndicator(container) {
  const indicator = container.querySelector('.vip-chat-beginning-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Generic function to load older messages when scrolling to top (pagination)
// fetchFunction: function that fetches messages (e.g., getAllChatMessages, getGuildChatMessages, getConversationMessages)
// config: { loadingFlag, oldestIdKey, fetchArgs, playerName? } - playerName is optional, used for runs-only filter
async function loadOlderMessages(container, fetchFunction, config) {
  const panel = container.closest('[id^="vip-chat-panel-"]');
  if (!panel || panel[config.loadingFlag]) {
    return;
  }
  
  const oldestMessageId = panel[config.oldestIdKey];
  if (!oldestMessageId) {
    // Hide loading indicator if visible
    hideLoadingIndicator(container);
    // Show "beginning of conversation" indicator if not already shown
    showBeginningIndicator(container);
    return; // No more messages to load
  }
  
  // Hide "beginning of conversation" indicator if we're loading more messages
  hideBeginningIndicator(container);
  
  panel[config.loadingFlag] = true;
  
  // Get scroll element and current scroll position (before showing indicator)
  let scrollElement = container;
  if (panel._scrollContainer && panel._scrollContainer.scrollView) {
    scrollElement = panel._scrollContainer.scrollView;
  } else {
    const contentWrapper = panel.querySelector('#all-chat-content-wrapper');
    const scrollView = contentWrapper?.querySelector('.scroll-view');
    if (scrollView) scrollElement = scrollView;
  }
  
  // Show loading indicator and get its height
  const loadingIndicator = showLoadingIndicator(container);
  const indicatorHeight = loadingIndicator ? loadingIndicator.offsetHeight : 0;
  
  // Measure scroll height after showing indicator
  const scrollHeightBefore = scrollElement.scrollHeight;
  
  try {
    // Fetch older messages using provided function and args
    const olderMessages = await fetchFunction(...config.fetchArgs(oldestMessageId));
    
    if (olderMessages.length === 0) {
      panel[config.oldestIdKey] = null;
      // Hide loading indicator
      hideLoadingIndicator(container);
      // Show "beginning of conversation" indicator
      showBeginningIndicator(container);
      return;
    }
    
    // Get displayed message IDs to prevent duplicates
    const displayedMessageIds = getDisplayedMessageIds(container);
    
    // Filter to get only messages older than the oldest we have
    const oldestIdNum = parseInt(oldestMessageId) || 0;
    let newMessages = olderMessages.filter(msg => {
      const msgId = msg.id || null;
      if (!msgId || displayedMessageIds.has(msgId)) {
        return false;
      }
      const msgIdNum = parseInt(msgId) || 0;
      return msgIdNum < oldestIdNum;
    });
    
    // Apply runs-only filter if active (for conversation messages)
    if (config.playerName) {
      const filterKey = `runsOnlyFilter_${config.playerName.toLowerCase()}`;
      const isRunsOnlyActive = panel.getAttribute(`data-${filterKey}`) === 'true';
      if (isRunsOnlyActive) {
        const originalCount = newMessages.length;
        newMessages = newMessages.filter(msg => {
          const text = msg.text || '';
          return text.includes('$replay(');
        });
        console.log(`[VIP List] Runs-only filter applied to older messages: ${originalCount} -> ${newMessages.length} messages`);
      }
    }
    
    if (newMessages.length === 0) {
      panel[config.oldestIdKey] = null;
      // Hide loading indicator
      hideLoadingIndicator(container);
      // Show "beginning of conversation" indicator
      showBeginningIndicator(container);
      return;
    }
    
    // Sort new messages (should already be sorted, but ensure)
    newMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Get first existing message for boundary date check
    const firstExistingMessage = container.querySelector('[data-message-id]');
    let firstExistingDateKey = null;
    if (firstExistingMessage) {
      // Get timestamp directly from data attribute (most reliable)
      const firstTimestamp = firstExistingMessage.getAttribute('data-timestamp');
      if (firstTimestamp) {
        firstExistingDateKey = getDateKey(parseInt(firstTimestamp));
      } else {
        // Fallback: try to get from element
        firstExistingDateKey = getDateKeyFromElement(firstExistingMessage);
      }
    }
    
    // Process messages and create elements
    // Start with null to add separator for first message's date
    const elementsToPrepend = [];
    let currentDateKey = null;
    
    for (const msg of newMessages) {
      const msgDateKey = getDateKey(msg.timestamp);
      
      // Add date separator if date changed (within new messages)
      if (currentDateKey !== null && currentDateKey !== msgDateKey) {
        elementsToPrepend.push(createDateSeparator(msg.timestamp));
        currentDateKey = msgDateKey;
      } else if (currentDateKey === null) {
        // First message - set current date key
        currentDateKey = msgDateKey;
      }
      
      // Create message element
      const messageId = msg.id || `msg-${msg.timestamp}`;
      const messageElement = await createChatMessageElement(msg, container, messageId);
      if (messageElement) {
        elementsToPrepend.push(messageElement);
      }
    }
    
    // Check if we need a date separator at the boundary between new and existing messages
    // (the newest new message will be at the top after reverse, right before first existing)
    if (newMessages.length > 0 && firstExistingMessage && firstExistingDateKey) {
      const newestNewMessage = newMessages[newMessages.length - 1]; // Newest of the new messages
      const newestNewDateKey = getDateKey(newestNewMessage.timestamp);
      
      // If dates differ, we need a separator at the boundary
      if (newestNewDateKey !== firstExistingDateKey) {
        // Check if there's already a separator before the first existing message
        const firstExistingPrev = firstExistingMessage.previousElementSibling;
        const hasSeparator = firstExistingPrev && 
          firstExistingPrev.querySelector('div[style*="text-transform: uppercase"]');
        
        // If no separator exists, add one before prepending
        if (!hasSeparator) {
          // Add separator for the first existing message's date
          elementsToPrepend.push(createDateSeparator(
            firstExistingMessage.getAttribute('data-timestamp') ? 
              parseInt(firstExistingMessage.getAttribute('data-timestamp')) : 
              Date.now()
          ));
        }
      }
    }
    
    // Insert elements at the beginning of container (preserve scroll position)
    const firstChild = container.firstChild;
    elementsToPrepend.reverse().forEach(element => {
      container.insertBefore(element, firstChild);
    });
    
    // Update oldest loaded message ID
    if (newMessages.length > 0) {
      panel[config.oldestIdKey] = newMessages[0].id;
    } else {
      panel[config.oldestIdKey] = null;
    }
    
    // Hide loading indicator before adjusting scroll position
    hideLoadingIndicator(container);
    
    // Hide beginning indicator since we successfully loaded messages
    hideBeginningIndicator(container);
    
    // Preserve scroll position (calculate after hiding indicator)
    // Account for indicator height in the calculation
    const scrollHeightAfter = scrollElement.scrollHeight;
    const scrollDiff = scrollHeightAfter - scrollHeightBefore + indicatorHeight;
    scrollElement.scrollTop += scrollDiff;
    
  } catch (error) {
    console.error('[VIP List] Error loading older messages:', error);
    // Hide loading indicator on error too
    hideLoadingIndicator(container);
  } finally {
    panel[config.loadingFlag] = false;
  }
}

// Load older guild chat messages when scrolling to top (pagination)
async function loadOlderGuildChatMessages(container, guildId) {
  const guildKey = `guild-${guildId}`;
  await loadOlderMessages(container, getGuildChatMessages, {
    loadingFlag: '_isLoadingOlderGuildChat',
    oldestIdKey: `_oldestLoadedMessageId_${guildKey}`,
    fetchArgs: (oldestMessageId) => [guildId, 10, oldestMessageId]
  });
}

// Generic function to setup scroll detection for loading older messages
// config: { handlerKey, oldestIdKey, loadingFlag, loadFunction, loadArgs }
function setupScrollDetection(panel, messagesArea, scrollElement, config) {
  if (!panel || !scrollElement) {
    return;
  }
  
  // Check if already setup (using handlerKey)
  if (panel[config.handlerKey]) {
    return; // Already setup
  }
  
  // Store scroll timeout on panel for cleanup (memory leak prevention)
  const timeoutKey = `${config.handlerKey}_timeout`;
  panel[timeoutKey] = null;
  
  const scrollHandler = async () => {
    if (panel[timeoutKey]) {
      clearTimeout(panel[timeoutKey]);
      panel[timeoutKey] = null;
    }
    
    panel[timeoutKey] = setTimeout(() => {
      panel[timeoutKey] = null;
      const scrollTop = scrollElement.scrollTop;
      const scrollThreshold = 100;
      const oldestMessageId = panel[config.oldestIdKey];
      
      if (scrollTop <= scrollThreshold && oldestMessageId && !panel[config.loadingFlag]) {
        config.loadFunction(...config.loadArgs);
      }
    }, 100);
  };
  
  scrollElement.addEventListener('scroll', scrollHandler, { passive: true });
  panel[config.handlerKey] = scrollHandler;
  panel[`${config.handlerKey}_element`] = scrollElement; // Store element reference for cleanup
}

// Remove scroll detection handlers (memory leak prevention)
function removeScrollDetection(panel, config) {
  if (!panel || !config) {
    return;
  }
  
  const handlerKey = config.handlerKey || config;
  const scrollHandler = panel[handlerKey];
  const scrollElement = panel[`${handlerKey}_element`];
  const timeoutKey = `${handlerKey}_timeout`;
  
  if (scrollElement && scrollHandler) {
    scrollElement.removeEventListener('scroll', scrollHandler);
  }
  
  if (panel[timeoutKey]) {
    clearTimeout(panel[timeoutKey]);
    panel[timeoutKey] = null;
  }
  
  // Clean up references
  delete panel[handlerKey];
  delete panel[`${handlerKey}_element`];
  delete panel[timeoutKey];
}

// Setup scroll detection for guild chat
function setupGuildChatScrollDetection(panel, messagesArea, scrollElement, guildId) {
  const guildKey = `guild-${guildId}`;
  setupScrollDetection(panel, messagesArea, scrollElement, {
    handlerKey: `_scrollHandler_${guildKey}`,
    oldestIdKey: `_oldestLoadedMessageId_${guildKey}`,
    loadingFlag: '_isLoadingOlderGuildChat',
    loadFunction: loadOlderGuildChatMessages,
    loadArgs: [messagesArea, guildId]
  });
}

// Load guild chat conversation
async function loadGuildChatConversation(container, guildId, forceScrollToBottom = false, checkCancelled = null, abortController = null) {
  const panel = container.closest('[id^="vip-chat-panel-all-chat"]');
  const guildKey = `guild-${guildId}`;
  const expectedTab = `guild-${guildId}`;
  
  // Prevent concurrent loading
  if (panel?.[`_isLoadingGuildChat_${guildKey}`]) {
    return;
  }
  panel[`_isLoadingGuildChat_${guildKey}`] = true;
  
  // Show loading indicator if not already shown (for polling updates)
  const wasLoadingIndicatorShown = container.querySelector('.chat-loading-indicator') !== null;
  if (!wasLoadingIndicatorShown) {
    showChatLoadingIndicator(container);
  }
  
  try {
    // Check if cancelled before starting
    if (checkCancelled && checkCancelled()) {
      return;
    }
    if (abortController?.signal.aborted) {
      return;
    }
    
    // Verify we're actually loading for the expected guild tab using state manager
    // If active chat type doesn't match, abort (user switched tabs)
    if (!chatStateManager.isChatTypeActive(expectedTab)) {
      return;
    }
    
    // Check if initial load or refresh
    const existingMessages = container.querySelectorAll('[data-message-id]');
    
    // CRITICAL: Clear container if it appears to be a tab switch (previous count was reset but container has messages)
    // This prevents mixing messages from all-chat or private chats when switching to guild chat
    const wasTabSwitch = (panel?.[`_previousMessageCount_${guildKey}`] ?? 0) === 0 && existingMessages.length > 0;
    
    if (wasTabSwitch) {
      container.innerHTML = '';
      if (panel) {
        panel[`_previousMessageCount_${guildKey}`] = 0;
        panel[`_oldestLoadedMessageId_${guildKey}`] = null;
      }
    }
    
    // Re-check after potential clear
    const remainingMessages = container.querySelectorAll('[data-message-id]');
    const isInitialLoad = remainingMessages.length === 0;
    
    // Load messages (all for updates, limited for initial load)
    const messages = await getGuildChatMessages(guildId, isInitialLoad ? MESSAGES_PER_PAGE : undefined, null, abortController);
    
    // Check if cancelled after loading messages
    if (checkCancelled && checkCancelled()) {
      return;
    }
    if (abortController?.signal.aborted) {
      return;
    }
    
    // Verify active chat type still matches expected guild tab
    if (!chatStateManager.isChatTypeActive(expectedTab)) {
      return;
    }
    
    if (isInitialLoad) {
      container.innerHTML = '';
      
      // Track oldest loaded message for pagination
      if (messages.length > 0) {
        panel[`_oldestLoadedMessageId_${guildKey}`] = messages[0].id;
        panel[`_lastTimestamp_${guildKey}`] = messages[messages.length - 1]?.timestamp || null;
        panel[`_lastMessageCount_${guildKey}`] = messages.length;
      } else {
        panel[`_oldestLoadedMessageId_${guildKey}`] = null;
        panel[`_lastTimestamp_${guildKey}`] = null;
        panel[`_lastMessageCount_${guildKey}`] = 0;
      }
    } else {
      // For updates, check if there are new messages
      const latestTimestamp = messages.length > 0 ? messages[messages.length - 1]?.timestamp : null;
      const storedTimestamp = panel[`_lastTimestamp_${guildKey}`];
      
      if (storedTimestamp === null || latestTimestamp === null) {
        panel[`_lastTimestamp_${guildKey}`] = latestTimestamp;
        panel[`_lastMessageCount_${guildKey}`] = messages.length;
      } else if (latestTimestamp <= storedTimestamp && messages.length === (panel[`_lastMessageCount_${guildKey}`] || 0)) {
        // No new messages - but still scroll if forceScrollToBottom is true (tab switching)
        if (forceScrollToBottom) {
          handleChatScroll(panel, container, true, false);
        }
        return;
      } else {
        // Update timestamp and count
        panel[`_lastTimestamp_${guildKey}`] = latestTimestamp;
        panel[`_lastMessageCount_${guildKey}`] = messages.length;
      }
    }

    if (messages.length === 0) {
      if (isInitialLoad) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = `
          text-align: center;
          color: ${CSS_CONSTANTS.COLORS.WHITE_50};
          padding: 15px;
          font-style: italic;
          font-size: 12px;
        `;
        emptyMsg.textContent = 'No messages yet';
        container.appendChild(emptyMsg);
      }
      // Still scroll to bottom if forceScrollToBottom is true (tab switching)
      if (forceScrollToBottom) {
        handleChatScroll(panel, container, true, false);
      }
      return;
    }

    // Get previous message count
    const previousMessageCount = panel?.[`_previousMessageCount_${guildKey}`] || 0;
    
    // Track displayed message IDs to prevent duplicates
    const displayedMessageIds = getDisplayedMessageIds(container);
    
    // Determine if we need a full rebuild (use remainingMessages after potential clear)
    const needsFullRebuild = isInitialLoad || shouldRebuildChat(messages, previousMessageCount, remainingMessages);
    
    // Check if cancelled before modifying DOM
    if (checkCancelled && checkCancelled()) {
      return;
    }
    
    // Verify active chat type still matches expected guild tab
    if (!chatStateManager.isChatTypeActive(expectedTab)) {
      return;
    }
    
    if (needsFullRebuild) {
      container.innerHTML = '';
    }
    
    if (messages.length === 0) {
      if (needsFullRebuild) {
        const emptyMsg = createEmptyChatMessage('No messages yet');
        container.appendChild(emptyMsg);
      }
      if (panel) panel[`_previousMessageCount_${guildKey}`] = 0;
      // Still scroll to bottom if forceScrollToBottom is true (tab switching)
      if (forceScrollToBottom) {
        handleChatScroll(panel, container, true, needsFullRebuild);
      }
      return;
    }
    
    // Get last date key for separator logic
    // When appending new messages, get the date key from the last displayed message in DOM
    let lastDateKey = null;
    if (needsFullRebuild) {
      lastDateKey = getLastDateKeyFromMessages(messages, previousMessageCount, needsFullRebuild);
    } else {
      // Get last date key from the last message element in the DOM
      const lastMessageElement = Array.from(container.querySelectorAll('[data-message-id]')).pop();
      if (lastMessageElement) {
        // Look backwards from the last message to find the date separator that applies to it
        let prevElement = lastMessageElement.previousElementSibling;
        while (prevElement) {
          const dateText = prevElement.querySelector('div[style*="text-transform: uppercase"]')?.textContent;
          if (dateText) {
            lastDateKey = getDateKeyFromElement(prevElement);
            break;
          }
          prevElement = prevElement.previousElementSibling;
        }
        // If no date separator found before the last message, check if there's one at the very beginning
        if (!lastDateKey) {
          const firstElement = container.firstElementChild;
          if (firstElement) {
            const firstDateText = firstElement.querySelector('div[style*="text-transform: uppercase"]')?.textContent;
            if (firstDateText) {
              lastDateKey = getDateKeyFromElement(firstElement);
            }
          }
        }
      }
    }
    
    // Only process new messages if not rebuilding
    const messagesToProcess = needsFullRebuild ? messages : messages.slice(previousMessageCount);
    
    // Message ID generator function
    const getMessageId = (msg) => msg.id || null;
    
    // Process messages using unified helper (handles date separators only on full rebuild)
    // filterSystemMessages = false for guild chat (system messages should appear)
    const elementsToAppend = await processMessagesForChat(
      messages,
      messagesToProcess,
      needsFullRebuild,
      displayedMessageIds,
      container,
      getMessageId,
      needsFullRebuild ? lastDateKey : null,
      false // Don't filter system messages in guild chat
    );
    
    // Final check: verify active tab still matches expected guild tab before appending messages
    if (checkCancelled && checkCancelled()) {
      return;
    }
    if (abortController?.signal.aborted) {
      return;
    }
    if (activeAllChatTab !== expectedTab) {
      return;
    }
    
    // Append elements using DocumentFragment (reduces flicker)
    appendElementsToContainer(container, elementsToAppend);
    
    // Update message count
    if (panel) {
      const totalDisplayed = container.querySelectorAll('[data-message-id]').length;
      panel[`_previousMessageCount_${guildKey}`] = totalDisplayed;
    }

    // Setup scroll detection if initial load
    if (isInitialLoad && panel) {
      let scrollElement = container;
      if (panel._scrollContainer && panel._scrollContainer.scrollView) {
        scrollElement = panel._scrollContainer.scrollView;
      } else {
        const contentWrapper = panel.querySelector('#all-chat-content-wrapper');
        const scrollView = contentWrapper?.querySelector('.scroll-view');
        if (scrollView) scrollElement = scrollView;
      }
      setupGuildChatScrollDetection(panel, container, scrollElement, guildId);
    }

    // Determine if we should scroll to bottom (consistent with other chat types)
    const hasNewMessages = !isInitialLoad && messagesToProcess.length > 0;
    const shouldScrollToBottom = forceScrollToBottom || hasNewMessages;
    
    // Handle scrolling using unified function (consistent with all-chat and private chats)
    handleChatScroll(panel, container, shouldScrollToBottom, needsFullRebuild);
  } finally {
    // Always clear loading flag and hide loading indicator
    if (panel) panel[`_isLoadingGuildChat_${guildKey}`] = false;
    // Hide loading indicator if we showed it (for polling updates)
    if (!wasLoadingIndicatorShown) {
      hideChatLoadingIndicator(container);
    }
  }
}

// Sync chat enabled status to Firebase
async function syncChatEnabledStatus(enabled) {
  if (!getChatEnabledApiUrl() || !MESSAGING_CONFIG.enabled) {
    return;
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return;
    }
    
    // Hash username for Firebase path
    const hashedCurrentPlayer = await hashUsername(currentPlayer);
    const response = await fetch(`${getChatEnabledApiUrl()}/${hashedCurrentPlayer}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: enabled,
        updatedAt: Date.now()
      })
    });
    
    if (response.ok) {
      console.log('[VIP List] Chat enabled status synced to Firebase:', enabled);
    } else if (response.status === 401) {
      // Firebase security rules prevent write access - this is expected if rules aren't configured
      console.warn('[VIP List] Cannot sync chat enabled status: Firebase write access denied (401). Chat will still work, but recipient verification may be limited.');
    } else {
      console.warn('[VIP List] Failed to sync chat enabled status:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('[VIP List] Error syncing chat enabled status:', error);
  }
}

// Check if recipient has chat enabled
async function checkRecipientChatEnabled(recipientName) {
  if (!getChatEnabledApiUrl() || !MESSAGING_CONFIG.enabled) {
    return false;
  }
  
  // If Firebase is blocking access (401), skip recipient check and allow sending
  if (firebase401WarningShown) {
    return true; // Skip check if Firebase is blocking access
  }
  
  try {
    // Try hashed path first (new format), fallback to non-hashed (backward compatibility)
    const hashedRecipientName = await hashUsername(recipientName);
    let response = await fetch(`${getChatEnabledApiUrl()}/${hashedRecipientName}.json`);
    
    if (!response.ok && response.status === 404) {
      // Try non-hashed path for backward compatibility
      response = await fetch(`${getChatEnabledApiUrl()}/${recipientName.toLowerCase()}.json`);
    }
    
    if (!response.ok) {
      if (response.status === 401) {
        // Firebase security rules prevent read access - fail open (allow sending)
        // Don't log here as it's already logged by checkForMessages
        return true;
      }
      // If 404, recipient hasn't enabled chat yet
      return false;
    }
    
    const data = await response.json();
    return data && data.enabled === true;
  } catch (error) {
    console.error('[VIP List] Error checking recipient chat enabled status:', error);
    // On error, allow sending (fail open) but log the error
    return true;
  }
}

function createMessageBoxStyle(borderColor, backgroundColor = null) {
  let bg = backgroundColor;
  if (!bg) {
    // Convert rgb to rgba with 0.2 opacity
    if (borderColor.startsWith('rgb(')) {
      bg = borderColor.replace('rgb(', 'rgba(').replace(')', ', 0.2)');
    } else if (borderColor.startsWith('#')) {
      // Convert hex to rgba (supports both 3-digit and 6-digit hex)
      const hex = borderColor.slice(1);
      let r, g, b;
      if (hex.length === 3) {
        // 3-digit hex: expand to 6-digit
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else {
        // 6-digit hex
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
      bg = `rgba(${r}, ${g}, ${b}, 0.2)`;
    } else {
      bg = borderColor; // Fallback
    }
  }
  return `
    padding: 12px;
    margin: 8px;
    background: ${bg};
    border: 2px solid ${borderColor};
    border-radius: 4px;
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    text-align: center;
    font-size: ${CSS_CONSTANTS.FONT_SIZES.BASE};
    line-height: 1.4;
  `;
}

function createButtonStyle(backgroundColor) {
  return `
    padding: 6px 16px;
    background: ${backgroundColor};
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: ${CSS_CONSTANTS.FONT_SIZES.BASE};
    font-weight: 600;
  `;
}

// Create action button style (for delete, block, VIP, runs-only buttons)
function createActionButtonStyle(color = CSS_CONSTANTS.COLORS.TEXT_PRIMARY, fontSize = CSS_CONSTANTS.FONT_SIZES.BASE) {
  return `
    padding: 6px 12px;
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border: 4px solid transparent;
    border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
    color: ${color};
    cursor: pointer;
    font-size: ${fontSize};
    font-weight: 700;
    text-align: center;
    white-space: nowrap;
    transition: color 0.2s, border-image 0.1s;
    font-family: ${CSS_CONSTANTS.FONT_FAMILY};
    box-sizing: border-box;
    border-radius: 0;
  `;
}

// Setup button hover/press handlers
function setupActionButtonHandlers(button, hoverColor = null, defaultColor = CSS_CONSTANTS.COLORS.TEXT_PRIMARY) {
  button.addEventListener('mouseenter', () => {
    if (hoverColor) button.style.color = hoverColor;
  });
  button.addEventListener('mouseleave', () => {
    button.style.color = defaultColor;
  });
  button.addEventListener('mousedown', () => {
    button.style.borderImage = CSS_CONSTANTS.BORDER_1_FRAME_PRESSED;
  });
  button.addEventListener('mouseup', () => {
    button.style.borderImage = CSS_CONSTANTS.BORDER_1_FRAME;
  });
}

// Create flex container style
function createFlexContainerStyle(direction = 'row', align = 'center', justify = 'flex-start', gap = '0') {
  return `
    display: flex;
    flex-direction: ${direction};
    align-items: ${align};
    justify-content: ${justify};
    gap: ${gap};
  `;
}

function updateChatInputState(textarea, sendButton, canChat, hasPrivilege, recipientHasChatEnabled, toPlayer) {
  if (textarea) {
    textarea.disabled = !canChat;
    if (!hasPrivilege) {
      textarea.placeholder = 'Request chat privileges to send messages';
    } else {
      textarea.placeholder = recipientHasChatEnabled 
        ? tReplace('mods.vipList.messagePlaceholder', { name: toPlayer })
        : `${toPlayer} does not have chat enabled`;
    }
    textarea.style.color = canChat ? CSS_CONSTANTS.COLORS.TEXT_WHITE : CSS_CONSTANTS.COLORS.WHITE_50;
    textarea.style.cursor = canChat ? '' : 'not-allowed';
    textarea.style.opacity = canChat ? '1' : '0.6';
  }
  
  if (sendButton) {
    sendButton.disabled = !canChat;
    sendButton.style.opacity = canChat ? '1' : '0.6';
    sendButton.style.cursor = canChat ? '' : 'not-allowed';
  }
}

function updateBlockedMessage(messagesArea, isBlocked, isBlockedBy, toPlayer) {
  let blockedMessage = messagesArea.querySelector('.chat-blocked-message');
  
  if (isBlocked || isBlockedBy) {
    if (blockedMessage) {
      blockedMessage.remove();
    }
    
    blockedMessage = document.createElement('div');
    blockedMessage.className = 'chat-blocked-message';
    blockedMessage.style.cssText = createMessageBoxStyle(CSS_CONSTANTS.COLORS.ERROR);
    
    if (isBlocked) {
      blockedMessage.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px; color: ${CSS_CONSTANTS.COLORS.ERROR};">
          ${t('mods.vipList.playerBlocked')}
        </div>
        <div>
          ${tReplace('mods.vipList.playerBlockedMessage', { name: toPlayer })}
        </div>
      `;
    } else {
      blockedMessage.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px; color: ${CSS_CONSTANTS.COLORS.ERROR};">
          ${t('mods.vipList.youAreBlocked')}
        </div>
        <div>
          ${tReplace('mods.vipList.youAreBlockedMessage', { name: toPlayer })}
        </div>
      `;
    }
    
    messagesArea.appendChild(blockedMessage);
    // Scroll to bottom to show blocked message
    const panel = messagesArea.closest('[id^="vip-chat-panel-"]');
    if (panel) {
      scrollChatToBottom(panel);
    } else {
      // Fallback if panel not found
      setTimeout(() => {
        messagesArea.scrollTop = messagesArea.scrollHeight;
      }, 50);
    }
  } else if (blockedMessage) {
    blockedMessage.remove();
  }
}

function createIncomingRequestMessage(toPlayer, messagesArea, panel) {
  const privilegeMessage = document.createElement('div');
  privilegeMessage.className = 'chat-privilege-message';
  privilegeMessage.style.cssText = createMessageBoxStyle(CSS_CONSTANTS.COLORS.LINK);
  privilegeMessage.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px; color: ${CSS_CONSTANTS.COLORS.LINK};">
      ${tReplace('mods.vipList.chatRequestFrom', { name: toPlayer })}
    </div>
    <div style="margin-bottom: 8px;">
      ${tReplace('mods.vipList.chatRequestMessage', { name: toPlayer })}
    </div>
    <div style="display: flex; gap: 8px; justify-content: center;">
      <button class="accept-chat-request-btn" style="${createButtonStyle(CSS_CONSTANTS.COLORS.SUCCESS)}">${t('mods.vipList.accept')}</button>
      <button class="decline-chat-request-btn" style="${createButtonStyle(CSS_CONSTANTS.COLORS.ERROR)}">${t('mods.vipList.decline')}</button>
    </div>
  `;
  
  const acceptBtn = privilegeMessage.querySelector('.accept-chat-request-btn');
  const declineBtn = privilegeMessage.querySelector('.decline-chat-request-btn');
  
  acceptBtn.addEventListener('click', async () => {
    acceptBtn.disabled = true;
    declineBtn.disabled = true;
    const success = await acceptChatRequest(toPlayer);
    if (success) {
      privilegeMessage.remove();
      const recipientHasChatEnabled = await checkRecipientChatEnabled(toPlayer);
      await updateChatPanelUI(panel, toPlayer, recipientHasChatEnabled, true, false, false);
      if (typeof loadConversation === 'function') {
        await loadConversation(toPlayer, messagesArea, true);
      }
    } else {
      acceptBtn.disabled = false;
      declineBtn.disabled = false;
    }
  });
  
  declineBtn.addEventListener('click', async () => {
    acceptBtn.disabled = true;
    declineBtn.disabled = true;
    await declineChatRequest(toPlayer);
    privilegeMessage.remove();
  });
  
  return privilegeMessage;
}

function createRequestPrivilegeMessage(toPlayer) {
  const privilegeMessage = document.createElement('div');
  privilegeMessage.className = 'chat-privilege-message';
  privilegeMessage.style.cssText = createMessageBoxStyle(CSS_CONSTANTS.COLORS.LINK);
  privilegeMessage.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px; color: ${CSS_CONSTANTS.COLORS.LINK};">
      ${t('mods.vipList.requestChatPrivileges')}
    </div>
    <div style="margin-bottom: 8px;">
      ${tReplace('mods.vipList.requestChatPrivilegesMessage', { name: toPlayer })}
    </div>
    <button class="request-chat-btn" style="${createButtonStyle(CSS_CONSTANTS.COLORS.LINK)}">${t('mods.vipList.requestChat')}</button>
  `;
  
  const requestBtn = privilegeMessage.querySelector('.request-chat-btn');
  requestBtn.addEventListener('click', async () => {
    requestBtn.disabled = true;
    const success = await requestChatPrivilege(toPlayer);
    if (success) {
      privilegeMessage.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px; color: ${CSS_CONSTANTS.COLORS.LINK};">
          ${t('mods.vipList.chatRequestSent')}
        </div>
        <div>
          ${tReplace('mods.vipList.waitingForAccept', { name: toPlayer })}
        </div>
      `;
      startPendingRequestCheck(toPlayer);
    } else {
      requestBtn.disabled = false;
    }
  });
  
  return privilegeMessage;
}

function updatePrivilegeMessage(messagesArea, hasPrivilege, isBlocked, isBlockedBy, recipientHasChatEnabled, hasIncomingRequest, hasOutgoingRequest, toPlayer, panel) {
  let privilegeMessage = messagesArea.querySelector('.chat-privilege-message');
  
  if (!hasPrivilege && !isBlocked && !isBlockedBy && (recipientHasChatEnabled || hasIncomingRequest)) {
    if (privilegeMessage) {
      privilegeMessage.remove();
    }
    
    if (hasIncomingRequest) {
      privilegeMessage = createIncomingRequestMessage(toPlayer, messagesArea, panel);
    } else if (hasOutgoingRequest) {
      privilegeMessage = document.createElement('div');
      privilegeMessage.className = 'chat-privilege-message';
      privilegeMessage.style.cssText = createMessageBoxStyle(CSS_CONSTANTS.COLORS.LINK);
      privilegeMessage.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px; color: ${CSS_CONSTANTS.COLORS.LINK};">
          ${t('mods.vipList.chatRequestPending')}
        </div>
        <div>
          ${tReplace('mods.vipList.waitingForAccept', { name: toPlayer })}
        </div>
      `;
    } else {
      privilegeMessage = createRequestPrivilegeMessage(toPlayer);
    }
    
    messagesArea.insertBefore(privilegeMessage, messagesArea.firstChild);
  } else if ((hasPrivilege || (!recipientHasChatEnabled && !hasIncomingRequest)) && privilegeMessage) {
    privilegeMessage.remove();
  }
}

function updateWarningMessage(messagesArea, recipientHasChatEnabled, isBlocked, isBlockedBy, toPlayer) {
  let warningMessage = messagesArea.querySelector('.chat-disabled-warning');
  if (!recipientHasChatEnabled && !isBlocked && !isBlockedBy && !warningMessage) {
    warningMessage = document.createElement('div');
    warningMessage.className = 'chat-disabled-warning';
    warningMessage.style.cssText = createMessageBoxStyle(CSS_CONSTANTS.COLORS.ERROR);
    warningMessage.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px; color: ${CSS_CONSTANTS.COLORS.ERROR};">
        ${t('mods.vipList.chatNotAvailable')}
      </div>
      <div>
        ${tReplace('mods.vipList.chatNotAvailableMessage', { name: toPlayer })}
      </div>
    `;
    messagesArea.insertBefore(warningMessage, messagesArea.firstChild);
  } else if (recipientHasChatEnabled && warningMessage) {
    warningMessage.remove();
  }
}

// Update chat panel UI based on recipient chat enabled status and privileges
async function updateChatPanelUI(panel, toPlayer, recipientHasChatEnabled, hasPrivilege = true, hasIncomingRequest = false, hasOutgoingRequest = false) {
  const textarea = panel.querySelector('.vip-chat-input');
  const sendButton = panel.querySelector('button.primary');
  const messagesArea = panel.querySelector(`#chat-messages-${toPlayer.toLowerCase()}`);
  
  // Check if player is blocked
  const isBlocked = await isPlayerBlocked(toPlayer);
  const isBlockedBy = await isBlockedByPlayer(toPlayer);
  
  const canChat = recipientHasChatEnabled && hasPrivilege && !isBlocked && !isBlockedBy;
  
  // Update input and button states
  updateChatInputState(textarea, sendButton, canChat, hasPrivilege, recipientHasChatEnabled, toPlayer);
  
  // Update messages area UI
  if (messagesArea) {
    updateBlockedMessage(messagesArea, isBlocked, isBlockedBy, toPlayer);
    updatePrivilegeMessage(messagesArea, hasPrivilege, isBlocked, isBlockedBy, recipientHasChatEnabled, hasIncomingRequest, hasOutgoingRequest, toPlayer, panel);
    updateWarningMessage(messagesArea, recipientHasChatEnabled, isBlocked, isBlockedBy, toPlayer);
  }
}

// Check if two players have chat privileges with each other
async function hasChatPrivilege(player1, player2) {
  if (!getChatPrivilegesApiUrl() || !MESSAGING_CONFIG.enabled) {
    return false;
  }
  
  try {
    const player1Lower = player1.toLowerCase();
    const player2Lower = player2.toLowerCase();
    
    // Hash usernames for Firebase paths (try hashed first, fallback to lowercase for backward compatibility)
    const hashedPlayer1 = await hashUsername(player1);
    const hashedPlayer2 = await hashUsername(player2);
    
    // Check if player1 has privilege with player2 (try hashed path first)
    let response = await fetch(`${getChatPrivilegesApiUrl()}/${hashedPlayer1}/${hashedPlayer2}.json`);
    
    if (!response.ok && response.status === 404) {
      // Try non-hashed path for backward compatibility
      response = await fetch(`${getChatPrivilegesApiUrl()}/${player1Lower}/${player2Lower}.json`);
    }
    
    if (!response.ok) {
      if (response.status === 401) {
        // Firebase security rules prevent read access - fail open (allow sending)
        return true;
      }
      return false;
    }
    
    const data = await response.json();
    return data && data.granted === true;
  } catch (error) {
    console.error('[VIP List] Error checking chat privilege:', error);
    // On error, fail open (allow sending) but log the error
    return true;
  }
}

// Request chat privileges from a player
async function requestChatPrivilege(toPlayer) {
  if (!getChatRequestsApiUrl() || !MESSAGING_CONFIG.enabled) {
    console.warn('[VIP List] Chat requests not enabled');
    return false;
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      throw new Error('Could not get current player name');
    }
    
    const currentPlayerLower = currentPlayer.toLowerCase();
    const toPlayerLower = toPlayer.toLowerCase();
    
    // Encrypt usernames in request body
    const encryptedFrom = await encryptUsername(currentPlayer, currentPlayer, toPlayer);
    const encryptedTo = await encryptUsername(toPlayer, currentPlayer, toPlayer);
    
    // Hash username for Firebase path (deterministic)
    const hashedToPlayer = await hashUsername(toPlayer);
    const hashedFromPlayer = await hashUsername(currentPlayer); // Hash hint for sender identification
    
    // Create request under recipient's hashed name
    const request = {
      from: encryptedFrom, // Encrypted username
      to: encryptedTo, // Encrypted username
      fromHash: hashedFromPlayer, // Hash hint for sender identification
      timestamp: Date.now(),
      status: 'pending',
      usernamesEncrypted: true // Flag to indicate username encryption
    };
    
    const requestId = `${await hashUsername(currentPlayer)}_${Date.now()}`;
    const response = await fetch(`${getChatRequestsApiUrl()}/${hashedToPlayer}/${requestId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    console.log('[VIP List] Chat request sent to', toPlayer);
    
    return true;
  } catch (error) {
    console.error('[VIP List] Error requesting chat privilege:', error);
    return false;
  }
}

// Accept a chat request
async function acceptChatRequest(fromPlayer) {
  if (!getChatRequestsApiUrl() || !getChatPrivilegesApiUrl() || !MESSAGING_CONFIG.enabled) {
    return false;
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      throw new Error('Could not get current player name');
    }
    
    const currentPlayerLower = currentPlayer.toLowerCase();
    const fromPlayerLower = fromPlayer.toLowerCase();
    
    // Hash usernames for Firebase paths (consistent with messages and requests)
    const hashedCurrentPlayer = await hashUsername(currentPlayer);
    const hashedFromPlayer = await hashUsername(fromPlayer);
    
    // Grant privilege for both directions
    const privilege1 = {
      granted: true,
      grantedAt: Date.now()
    };
    const privilege2 = {
      granted: true,
      grantedAt: Date.now()
    };
    
    // Grant privilege: currentPlayer can chat with fromPlayer (using hashed paths)
    await fetch(`${getChatPrivilegesApiUrl()}/${hashedCurrentPlayer}/${hashedFromPlayer}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(privilege1)
    });
    
    // Grant privilege: fromPlayer can chat with currentPlayer (using hashed paths)
    await fetch(`${getChatPrivilegesApiUrl()}/${hashedFromPlayer}/${hashedCurrentPlayer}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(privilege2)
    });
    
    // Remove all pending requests between these two players (try both hashed and non-hashed paths for backward compatibility)
    let requestsResponse = await fetch(`${getChatRequestsApiUrl()}/${hashedCurrentPlayer}.json`);
    if (!requestsResponse.ok && requestsResponse.status === 404) {
      // Try non-hashed path for backward compatibility
      requestsResponse = await fetch(`${getChatRequestsApiUrl()}/${currentPlayerLower}.json`);
    }
    
    if (requestsResponse.ok) {
      const requests = await requestsResponse.json();
      if (requests && typeof requests === 'object') {
        await Promise.all(
          Object.entries(requests).map(async ([id, req]) => {
            let fromMatches = false;
            
            // Check if usernames are encrypted
            if (req && req.usernamesEncrypted && req.fromHash) {
              // Use hash hint to match
              const fromPlayerHash = await hashUsername(fromPlayer);
              fromMatches = req.fromHash === fromPlayerHash;
            } else {
              // Backward compatibility: check unencrypted username
              fromMatches = req && req.from && req.from.toLowerCase() === fromPlayerLower;
            }
            
            if (fromMatches && req.status === 'pending') {
              const pathToUse = requestsResponse.url.includes(hashedCurrentPlayer) ? hashedCurrentPlayer : currentPlayerLower;
              await fetch(`${getChatRequestsApiUrl()}/${pathToUse}/${id}.json`, {
                method: 'DELETE'
              });
            }
          })
        );
      }
    }
    
    console.log('[VIP List] Chat request accepted from', fromPlayer);
    return true;
  } catch (error) {
    console.error('[VIP List] Error accepting chat request:', error);
    return false;
  }
}

// Decline a chat request
async function declineChatRequest(fromPlayer) {
  if (!getChatRequestsApiUrl() || !MESSAGING_CONFIG.enabled) {
    return false;
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      throw new Error('Could not get current player name');
    }
    
    const currentPlayerLower = currentPlayer.toLowerCase();
    const fromPlayerLower = fromPlayer.toLowerCase();
    
    // Remove all pending requests from this player (try both hashed and non-hashed paths for backward compatibility)
    const hashedCurrentPlayer = await hashUsername(currentPlayer);
    let requestsResponse = await fetch(`${getChatRequestsApiUrl()}/${hashedCurrentPlayer}.json`);
    if (!requestsResponse.ok && requestsResponse.status === 404) {
      // Try non-hashed path for backward compatibility
      requestsResponse = await fetch(`${getChatRequestsApiUrl()}/${currentPlayerLower}.json`);
    }
    
    if (requestsResponse.ok) {
      const requests = await requestsResponse.json();
      if (requests && typeof requests === 'object') {
        await Promise.all(
          Object.entries(requests).map(async ([id, req]) => {
            let fromMatches = false;
            
            // Check if usernames are encrypted
            if (req && req.usernamesEncrypted && req.fromHash) {
              // Use hash hint to match
              const fromPlayerHash = await hashUsername(fromPlayer);
              fromMatches = req.fromHash === fromPlayerHash;
            } else {
              // Backward compatibility: check unencrypted username
              fromMatches = req && req.from && req.from.toLowerCase() === fromPlayerLower;
            }
            
            if (fromMatches && req.status === 'pending') {
              const pathToUse = requestsResponse.url.includes(hashedCurrentPlayer) ? hashedCurrentPlayer : currentPlayerLower;
              await fetch(`${getChatRequestsApiUrl()}/${pathToUse}/${id}.json`, {
                method: 'DELETE'
              });
            }
          })
        );
      }
    }
    
    console.log('[VIP List] Chat request declined from', fromPlayer);
    return true;
  } catch (error) {
    console.error('[VIP List] Error declining chat request:', error);
    return false;
  }
}

// Check for incoming chat requests
async function checkForChatRequests() {
  if (!getChatRequestsApiUrl() || !MESSAGING_CONFIG.enabled) {
    return [];
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return [];
    }
    
    // Try hashed path first (new format), fallback to non-hashed (backward compatibility)
    const hashedCurrentPlayer = await hashUsername(currentPlayer);
    let response = await fetch(`${getChatRequestsApiUrl()}/${hashedCurrentPlayer}.json`);
    
    if (!response.ok && response.status === 404) {
      // Try non-hashed path for backward compatibility
      response = await fetch(`${getChatRequestsApiUrl()}/${currentPlayer.toLowerCase()}.json`);
    }
    
    if (!response.ok) {
      if (response.status === 404) {
        return []; // No requests yet
      }
      if (response.status === 401) {
        // Firebase security rules prevent read access - fail gracefully
        return [];
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || typeof data !== 'object') {
      return [];
    }
    
    // Convert Firebase object to array, decrypt usernames, and filter pending requests
    const requests = await Promise.all(
      Object.entries(data)
        .map(async ([id, req]) => {
          if (req && req.status === 'pending' && req.from) {
            let decryptedReq = { id, ...req };
            
            // Decrypt usernames if encrypted
            if (req.usernamesEncrypted && req.from && req.fromHash) {
              try {
                // Use hash hint to efficiently identify the sender
                const vipList = getVIPList();
                for (const vip of vipList) {
                  try {
                    const testHash = await hashUsername(vip.name);
                    if (testHash === req.fromHash) {
                      // Found matching sender, decrypt usernames
                      decryptedReq.from = await decryptUsername(req.from, vip.name, currentPlayer);
                      decryptedReq.to = await decryptUsername(req.to, vip.name, currentPlayer);
                      break;
                    }
                  } catch (e) {
                    // Continue trying other senders
                  }
                }
                
                // If still not decrypted, try with recent conversations
                if (decryptedReq.from === req.from && conversationLastTimestamps.size > 0) {
                  for (const [playerName, timestamp] of conversationLastTimestamps.entries()) {
                    try {
                      const testHash = await hashUsername(playerName);
                      if (testHash === req.fromHash) {
                        decryptedReq.from = await decryptUsername(req.from, playerName, currentPlayer);
                        decryptedReq.to = await decryptUsername(req.to, playerName, currentPlayer);
                        break;
                      }
                    } catch (e) {
                      // Continue trying
                    }
                  }
                }
                
                // If decryption failed and username is still invalid, delete the corrupted request
                if (!isValidUsername(decryptedReq.from)) {
                  console.warn('[VIP List] Deleting corrupted chat request with invalid username:', id);
                  try {
                    // Try hashed path first, then fallback to non-hashed
                    let deleteUrl = `${getChatRequestsApiUrl()}/${hashedCurrentPlayer}/${id}.json`;
                    let deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });
                    if (!deleteResponse.ok && deleteResponse.status === 404) {
                      deleteUrl = `${getChatRequestsApiUrl()}/${currentPlayer.toLowerCase()}/${id}.json`;
                      deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });
                    }
                    if (deleteResponse.ok) {
                      console.log('[VIP List] Deleted corrupted chat request:', id);
                    }
                  } catch (deleteError) {
                    console.error('[VIP List] Failed to delete corrupted chat request:', deleteError);
                  }
                  return null; // Don't include this request
                }
              } catch (error) {
                console.warn('[VIP List] Failed to decrypt request usernames:', error);
                // If username is invalid, delete the corrupted request
                if (!isValidUsername(req.from)) {
                  console.warn('[VIP List] Deleting corrupted chat request with invalid username:', id);
                  try {
                    let deleteUrl = `${getChatRequestsApiUrl()}/${hashedCurrentPlayer}/${id}.json`;
                    let deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });
                    if (!deleteResponse.ok && deleteResponse.status === 404) {
                      deleteUrl = `${getChatRequestsApiUrl()}/${currentPlayer.toLowerCase()}/${id}.json`;
                      deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });
                    }
                    if (deleteResponse.ok) {
                      console.log('[VIP List] Deleted corrupted chat request:', id);
                    }
                  } catch (deleteError) {
                    console.error('[VIP List] Failed to delete corrupted chat request:', deleteError);
                  }
                  return null; // Don't include this request
                }
              }
            }
            
            // Final check: if username is invalid (even if not marked as encrypted), delete corrupted request
            if (decryptedReq.from && !isValidUsername(decryptedReq.from)) {
              console.warn('[VIP List] Deleting chat request with invalid username (not marked as encrypted):', id);
              try {
                let deleteUrl = `${getChatRequestsApiUrl()}/${hashedCurrentPlayer}/${id}.json`;
                let deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });
                if (!deleteResponse.ok && deleteResponse.status === 404) {
                  deleteUrl = `${getChatRequestsApiUrl()}/${currentPlayer.toLowerCase()}/${id}.json`;
                  deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });
                }
                if (deleteResponse.ok) {
                  console.log('[VIP List] Deleted corrupted chat request:', id);
                }
              } catch (deleteError) {
                console.error('[VIP List] Failed to delete corrupted chat request:', deleteError);
              }
              return null; // Don't include this request
            }
            
            return decryptedReq;
          }
          return null;
        })
    );
    
    return requests.filter(req => req !== null && req.from);
  } catch (error) {
    console.error('[VIP List] Error checking for chat requests:', error);
    return [];
  }
}

// Check if a player is blocked
async function isPlayerBlocked(playerName) {
  if (!getBlockedPlayersApiUrl() || !MESSAGING_CONFIG.enabled) {
    return false;
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return false;
    }
    
    const currentPlayerLower = sanitizeFirebaseKey(currentPlayer);
    const playerNameLower = sanitizeFirebaseKey(playerName);
    
    // Check if current player has blocked this player
    const response = await fetch(`${getBlockedPlayersApiUrl()}/${currentPlayerLower}/${playerNameLower}.json`);
    
    if (!response.ok) {
      if (response.status === 401) {
        // Firebase security rules prevent read access - fail open (don't block)
        return false;
      }
      return false;
    }
    
    const data = await response.json();
    return data && data.blocked === true;
  } catch (error) {
    console.error('[VIP List] Error checking if player is blocked:', error);
    // On error, fail open (don't block)
    return false;
  }
}

// Check if current player is blocked by another player
async function isBlockedByPlayer(playerName) {
  if (!getBlockedPlayersApiUrl() || !MESSAGING_CONFIG.enabled) {
    return false;
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return false;
    }
    
    const currentPlayerLower = sanitizeFirebaseKey(currentPlayer);
    const playerNameLower = sanitizeFirebaseKey(playerName);
    
    // Check if the other player has blocked current player
    const response = await fetch(`${getBlockedPlayersApiUrl()}/${playerNameLower}/${currentPlayerLower}.json`);
    
    if (!response.ok) {
      if (response.status === 401) {
        // Firebase security rules prevent read access - fail open (don't block)
        return false;
      }
      return false;
    }
    
    const data = await response.json();
    return data && data.blocked === true;
  } catch (error) {
    console.error('[VIP List] Error checking if blocked by player:', error);
    // On error, fail open (don't block)
    return false;
  }
}

// Block a player
async function blockPlayer(playerName) {
  if (!getBlockedPlayersApiUrl() || !MESSAGING_CONFIG.enabled) {
    console.warn('[VIP List] Blocking not enabled');
    return false;
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      throw new Error('Could not get current player name');
    }
    
    const currentPlayerLower = sanitizeFirebaseKey(currentPlayer);
    const playerNameLower = sanitizeFirebaseKey(playerName);
    
    // Add to blocked list
    const blockData = {
      blocked: true,
      blockedAt: Date.now()
    };
    
    const response = await fetch(`${getBlockedPlayersApiUrl()}/${currentPlayerLower}/${playerNameLower}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blockData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    console.log('[VIP List] Blocked player:', playerName);
    return true;
  } catch (error) {
    console.error('[VIP List] Error blocking player:', error);
    return false;
  }
}

// Unblock a player
async function unblockPlayer(playerName) {
  if (!getBlockedPlayersApiUrl() || !MESSAGING_CONFIG.enabled) {
    return false;
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      throw new Error('Could not get current player name');
    }
    
    const currentPlayerLower = sanitizeFirebaseKey(currentPlayer);
    const playerNameLower = sanitizeFirebaseKey(playerName);
    
    // Remove from blocked list
    const response = await fetch(`${getBlockedPlayersApiUrl()}/${currentPlayerLower}/${playerNameLower}.json`, {
      method: 'DELETE'
    });
    
    if (!response.ok && response.status !== 404) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    console.log('[VIP List] Unblocked player:', playerName);
    return true;
  } catch (error) {
    console.error('[VIP List] Error unblocking player:', error);
    return false;
  }
}

// Send message to a player
async function sendMessage(toPlayer, text) {
  if (!getMessagingApiUrl() || !MESSAGING_CONFIG.enabled) {
    console.warn('[VIP List] Messaging not enabled');
    return false;
  }
  
  if (!text || text.trim().length === 0) {
    return false;
  }
  
  if (text.length > MESSAGING_CONFIG.maxMessageLength) {
    console.warn('[VIP List] Message too long');
    return false;
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      throw new Error('Could not get current player name');
    }
    
    // Check if recipient is blocked
    const isBlocked = await isPlayerBlocked(toPlayer);
    if (isBlocked) {
      console.warn('[VIP List] Cannot send message: player is blocked');
      return false;
    }
    
    // Check if current player is blocked by recipient
    const isBlockedBy = await isBlockedByPlayer(toPlayer);
    if (isBlockedBy) {
      console.warn('[VIP List] Cannot send message: you are blocked by', toPlayer);
      return false;
    }
    
    // Check if current player has chat privilege with recipient
    const hasPrivilege = await hasChatPrivilege(currentPlayer, toPlayer);
    if (!hasPrivilege) {
      console.warn('[VIP List] No chat privilege with', toPlayer);
      return false;
    }
    
    // Encrypt message text
    const encryptedText = await encryptMessage(text.trim(), currentPlayer, toPlayer);
    
    // Encrypt usernames in message body
    const encryptedFrom = await encryptUsername(currentPlayer, currentPlayer, toPlayer);
    const encryptedTo = await encryptUsername(toPlayer.toLowerCase(), currentPlayer, toPlayer);
    
    // Hash usernames for Firebase path (deterministic) and sender hint
    const hashedToPlayer = await hashUsername(toPlayer);
    const hashedFromPlayer = await hashUsername(currentPlayer); // Store hash hint for efficient decryption
    
    const message = {
      from: encryptedFrom, // Encrypted username
      to: encryptedTo, // Encrypted username
      fromHash: hashedFromPlayer, // Hash hint for sender identification (one-way, cannot be reversed to username)
      text: encryptedText, // Store encrypted text
      encrypted: true, // Flag to indicate encryption
      usernamesEncrypted: true, // Flag to indicate username encryption
      timestamp: Date.now(),
      read: false
    };
    
    const messageId = Date.now().toString();
    const response = await fetch(`${getMessagingApiUrl()}/${hashedToPlayer}/${messageId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    console.log('[VIP List] Message sent to', toPlayer);
    
    // Invalidate conversation cache for this player
    const cacheKey = toPlayer.toLowerCase();
    conversationCache.delete(cacheKey);
    
    return true;
  } catch (error) {
    console.error('[VIP List] Error sending message:', error);
    return false;
  }
}

// Send message to All Chat (public channel)
async function sendAllChatMessage(text) {
  if (!getAllChatApiUrl() || !MESSAGING_CONFIG.enabled) {
    console.warn('[VIP List] All Chat not enabled');
    return false;
  }
  
  // Validate that getAllChatApiUrl returns the correct endpoint
  const allChatUrl = getAllChatApiUrl();
  if (!allChatUrl || typeof allChatUrl !== 'string') {
    console.error('[VIP List] Invalid All Chat API URL in sendAllChatMessage:', allChatUrl);
    return false;
  }
  
  if (!allChatUrl.includes('/all-chat')) {
    console.error('[VIP List] All Chat endpoint validation failed in sendAllChatMessage: URL does not contain /all-chat', allChatUrl);
    return false;
  }
  
  if (allChatUrl.includes('/guilds/')) {
    console.error('[VIP List] All Chat endpoint validation failed in sendAllChatMessage: URL contains /guilds/ (should be all-chat only)', allChatUrl);
    return false;
  }
  
  if (!text || text.trim().length === 0) {
    return false;
  }
  
  if (text.length > MESSAGING_CONFIG.maxMessageLength) {
    console.warn('[VIP List] Message too long');
    return false;
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      throw new Error('Could not get current player name');
    }
    
    // Check if current player has chat enabled (verify with Firebase)
    const hasChatEnabled = await checkRecipientChatEnabled(currentPlayer);
    if (!hasChatEnabled) {
      console.warn('[VIP List] Cannot send to All Chat: you do not have chat enabled');
      return false;
    }
    
    // Store plain text for public channel (no encryption needed)
    const message = {
      from: currentPlayer, // Plain text username
      text: text.trim(), // Plain text message
      timestamp: Date.now(),
      read: false
    };
    
    const messageId = Date.now().toString();
    // Use the validated allChatUrl variable to ensure we're using the correct endpoint
    const response = await fetch(`${allChatUrl}/${messageId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        // Firebase security rules prevent write access - need to configure rules
        console.warn('[VIP List] Cannot send All Chat message: Firebase write access denied (401). All Chat requires Firebase security rules to be configured for the /all-chat path.');
        throw new Error('FIREBASE_401'); // Special error code for UI handling
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    console.log('[VIP List] Message sent to All Chat');
    
    // Don't invalidate cache - we're updating it optimistically
    // The cache will be updated when the message is added optimistically
    // This prevents unnecessary reloads
    
    return true;
  } catch (error) {
    if (error.message === 'FIREBASE_401') {
      // Re-throw with special code for UI handling
      throw error;
    }
    console.error('[VIP List] Error sending All Chat message:', error);
    return false;
  }
}

// Check for new messages
async function checkForMessages() {
  if (!getMessagingApiUrl() || !MESSAGING_CONFIG.enabled) {
    return [];
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return [];
    }
    
    // Hash username for Firebase path (try both hashed and non-hashed for backward compatibility)
    const hashedCurrentPlayer = await hashUsername(currentPlayer);
    const currentPlayerLower = sanitizeFirebaseKey(currentPlayer);
    
    // Try hashed path first (new format), fallback to non-hashed (backward compatibility)
    let response = await fetch(`${getMessagingApiUrl()}/${hashedCurrentPlayer}.json`);
    let data = null;
    
    if (!response.ok && response.status === 404) {
      // Try non-hashed path for backward compatibility
      response = await fetch(`${getMessagingApiUrl()}/${currentPlayerLower}.json`);
    }
    
    if (!response.ok) {
      if (response.status === 404) {
        return []; // No messages yet
      }
      if (response.status === 401) {
        // Firebase security rules prevent read access - fail gracefully
        if (!firebase401WarningShown) {
          console.warn('[VIP List] Firebase security rules are blocking message access (401). To enable full chat functionality, configure Firebase security rules. See firebase_setup.md for instructions. Chat sending will still work.');
          firebase401WarningShown = true;
        }
        return [];
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    data = await response.json();
    
    if (!data || typeof data !== 'object') {
      return [];
    }
    
    // Convert Firebase object to array, decrypt messages and usernames, and filter unread messages
    const messages = await Promise.all(
      Object.entries(data)
        .map(async ([id, msg]) => {
          if (!msg) {
            return null;
          }
          let decryptedMsg = { id, ...msg };
            
            // Decrypt usernames if encrypted
            if (msg && msg.usernamesEncrypted && msg.from && msg.to) {
              try {
                let decryptedFrom = msg.from;
                let decryptedTo = msg.to;
                
                // Use fromHash hint to efficiently identify the sender
                if (msg.fromHash) {
                  // Try decrypting with each VIP list member and match the hash
                  const vipList = getVIPList();
                  for (const vip of vipList) {
                    try {
                      const testHash = await hashUsername(vip.name);
                      if (testHash === msg.fromHash) {
                        // Found matching sender, decrypt usernames
                        decryptedFrom = await decryptUsername(msg.from, vip.name, currentPlayer);
                        decryptedTo = await decryptUsername(msg.to, vip.name, currentPlayer);
                        break;
                      }
                    } catch (e) {
                      // Continue trying other senders
                    }
                  }
                  
                  // If not found in VIP list, try all users from recent conversations
                  if (decryptedFrom === msg.from && conversationLastTimestamps.size > 0) {
                    for (const [playerName, timestamp] of conversationLastTimestamps.entries()) {
                      try {
                        const testHash = await hashUsername(playerName);
                        if (testHash === msg.fromHash) {
                          decryptedFrom = await decryptUsername(msg.from, playerName, currentPlayer);
                          decryptedTo = await decryptUsername(msg.to, playerName, currentPlayer);
                          break;
                        }
                      } catch (e) {
                        // Continue trying
                      }
                    }
                  }
                } else {
                  // No hash hint (backward compatibility) - try VIP list members
                  const vipList = getVIPList();
                  for (const vip of vipList) {
                    try {
                      const testDecrypted = await decryptUsername(msg.from, vip.name, currentPlayer);
                      if (testDecrypted && testDecrypted !== msg.from && testDecrypted.toLowerCase() === vip.name.toLowerCase()) {
                        decryptedFrom = testDecrypted;
                        decryptedTo = await decryptUsername(msg.to, vip.name, currentPlayer);
                        break;
                      }
                    } catch (e) {
                      // Continue trying other senders
                    }
                  }
                }
                
                decryptedMsg.from = decryptedFrom;
                decryptedMsg.to = decryptedTo;
                
                // If decryption failed and username is still invalid, delete the corrupted message
                if (!isValidUsername(decryptedFrom)) {
                  console.warn('[VIP List] Deleting corrupted message with invalid username:', id);
                  try {
                    // Try hashed path first, then fallback to non-hashed
                    let deleteUrl = `${getMessagingApiUrl()}/${hashedCurrentPlayer}/${id}.json`;
                    let deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });
                    if (!deleteResponse.ok && deleteResponse.status === 404) {
                      deleteUrl = `${getMessagingApiUrl()}/${currentPlayerLower}/${id}.json`;
                      deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });
                    }
                    if (deleteResponse.ok) {
                      console.log('[VIP List] Deleted corrupted message:', id);
                    }
                  } catch (deleteError) {
                    console.error('[VIP List] Failed to delete corrupted message:', deleteError);
                  }
                  return null; // Don't include this message
                }
              } catch (error) {
                console.warn('[VIP List] Failed to decrypt usernames:', error);
                // If username is invalid, delete the corrupted message
                if (!isValidUsername(msg.from)) {
                  console.warn('[VIP List] Deleting corrupted message with invalid username:', id);
                  try {
                    let deleteUrl = `${getMessagingApiUrl()}/${hashedCurrentPlayer}/${id}.json`;
                    let deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });
                    if (!deleteResponse.ok && deleteResponse.status === 404) {
                      deleteUrl = `${getMessagingApiUrl()}/${currentPlayerLower}/${id}.json`;
                      deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });
                    }
                    if (deleteResponse.ok) {
                      console.log('[VIP List] Deleted corrupted message:', id);
                    }
                  } catch (deleteError) {
                    console.error('[VIP List] Failed to delete corrupted message:', deleteError);
                  }
                  return null; // Don't include this message
                }
              }
            }
            
            // Decrypt message text if encrypted
            if (msg && msg.encrypted && msg.text && decryptedMsg.from) {
              try {
                const decryptedText = await decryptMessage(msg.text, decryptedMsg.from, currentPlayer);
                decryptedMsg.text = decryptedText;
              } catch (error) {
                console.warn('[VIP List] Failed to decrypt message:', error);
                // Keep encrypted text if decryption fails
              }
            }
            
            // Decrypt read status if we have sender name
            if (decryptedMsg.from && msg.read !== undefined) {
              try {
                decryptedMsg.read = await decryptReadStatus(msg.read, decryptedMsg.from, currentPlayer);
              } catch (error) {
                console.warn('[VIP List] Failed to decrypt read status:', error);
                // Fallback: try to parse as boolean/string
                decryptedMsg.read = msg.read === true || msg.read === 'true';
              }
            } else {
              // Default to unread if read status is missing
              decryptedMsg.read = false;
            }
            
            // Final check: if username is invalid (even if not marked as encrypted), delete corrupted message
            if (decryptedMsg.from && !isValidUsername(decryptedMsg.from)) {
              console.warn('[VIP List] Deleting message with invalid username (not marked as encrypted):', id);
              try {
                let deleteUrl = `${getMessagingApiUrl()}/${hashedCurrentPlayer}/${id}.json`;
                let deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });
                if (!deleteResponse.ok && deleteResponse.status === 404) {
                  deleteUrl = `${getMessagingApiUrl()}/${currentPlayerLower}/${id}.json`;
                  deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });
                }
                if (deleteResponse.ok) {
                  console.log('[VIP List] Deleted corrupted message:', id);
                }
              } catch (deleteError) {
                console.error('[VIP List] Failed to delete corrupted message:', deleteError);
              }
              return null; // Don't include this message
            }
            
            return decryptedMsg;
        })
    );
    
    let unreadMessages = messages
      .filter(msg => msg && msg.read === false)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Apply message filter: if set to 'friends', only show messages from VIP list
    const messageFilter = getMessageFilter();
    if (messageFilter === 'friends') {
      unreadMessages = unreadMessages.filter(msg => {
        if (!msg.from) return false;
        return isPlayerInVIPList(msg.from);
      });
    }
    
    lastMessageCheckTime = Date.now();
    return unreadMessages;
  } catch (error) {
    console.error('[VIP List] Error checking messages:', error);
    return [];
  }
}

// Check for new All Chat messages
async function checkForAllChatMessages() {
  if (!getAllChatApiUrl() || !MESSAGING_CONFIG.enabled) {
    return [];
  }
  
  // Validate that getAllChatApiUrl returns the correct endpoint
  const allChatUrl = getAllChatApiUrl();
  if (!allChatUrl || typeof allChatUrl !== 'string') {
    console.error('[VIP List] Invalid All Chat API URL in checkForAllChatMessages:', allChatUrl);
    return [];
  }
  
  if (!allChatUrl.includes('/all-chat')) {
    console.error('[VIP List] All Chat endpoint validation failed in checkForAllChatMessages: URL does not contain /all-chat', allChatUrl);
    return [];
  }
  
  if (allChatUrl.includes('/guilds/')) {
    console.error('[VIP List] All Chat endpoint validation failed in checkForAllChatMessages: URL contains /guilds/ (should be all-chat only)', allChatUrl);
    return [];
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return [];
    }
    
    // Fetch all All Chat messages - use orderBy to ensure chronological order
    // Use the validated allChatUrl variable to ensure we're using the correct endpoint
    let response = await fetch(`${allChatUrl}.json?orderBy="$key"`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return []; // No messages yet
      }
      if (response.status === 401) {
        // Firebase security rules prevent read access - fail gracefully
        return [];
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || typeof data !== 'object') {
      return [];
    }
    
    // Convert Firebase object to array and filter blocked players
    const messages = [];
    for (const [id, msg] of Object.entries(data)) {
      if (!msg) continue;
      
      // Filter out system messages (should only appear in guild chat)
      if (isSystemMessage(msg)) {
        continue;
      }
      
      // Filter out messages from blocked players
      if (msg.from) {
        const isBlocked = await isPlayerBlocked(msg.from);
        if (isBlocked) continue;
        
        const isBlockedBy = await isBlockedByPlayer(msg.from);
        if (isBlockedBy) continue;
      }
      
      messages.push({ id, ...msg });
    }
    
    messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Apply message filter: if set to 'friends', only show messages from VIP list
    const messageFilter = getMessageFilter();
    if (messageFilter === 'friends') {
      return messages.filter(msg => {
        if (!msg.from) return false;
        return isPlayerInVIPList(msg.from);
      });
    }
    
    return messages;
  } catch (error) {
    console.error('[VIP List] Error checking for All Chat messages:', error);
    return [];
  }
}

// =======================
// System Message Filtering
// =======================

// Unified function to check if a message is a system message
// System messages should only appear in Guild Chat, never in All Chat
function isSystemMessage(msg) {
  if (!msg) return false;
  
  // Check isSystem flag
  if (msg.isSystem === true) return true;
  
  // Check from field (case-insensitive)
  if (msg.from && msg.from.toLowerCase() === 'system') return true;
  
  // Check fromHashed field
  if (msg.fromHashed && msg.fromHashed.toLowerCase() === 'system') return true;
  
  // Pattern matching for system message text
  if (msg.text && typeof msg.text === 'string') {
    const textLower = msg.text.toLowerCase();
    const systemPatterns = [
      'joined the guild',
      'left the guild',
      'invited',
      'cancelled the invite',
      'promoted',
      'demoted',
      'to the guild',
      'transferred',
      'leadership',
      'changed the guild',
      'guild was created',
      'was created by',
      'cancelled the invite for'
    ];
    
    // Check for exact pattern matches
    if (systemPatterns.some(pattern => textLower.includes(pattern))) return true;
    
    // Check for guild-related keywords combined with system message patterns
    const guildKeywords = ['guild', 'invited', 'joined', 'left', 'cancelled', 'promoted', 'demoted'];
    const hasGuildKeyword = guildKeywords.some(keyword => textLower.includes(keyword));
    const looksLikeSystemMessage = textLower.includes(' to the guild') || 
                                  textLower.includes(' was created') ||
                                  textLower.includes(' transferred') ||
                                  (textLower.includes('invited') && textLower.includes('to the guild')) ||
                                  (textLower.includes('cancelled') && textLower.includes('invite'));
    
    if (hasGuildKeyword && looksLikeSystemMessage) return true;
  }
  
  return false;
}

// Check if a DOM element contains a system message
function isSystemMessageElement(el) {
  if (!el) return false;
  const text = el.textContent || '';
  const fromSpan = el.querySelector('span[style*="font-weight: bold"]');
  const fromText = fromSpan?.textContent || '';
  const textLower = text.toLowerCase();
  
  return fromText.toLowerCase().includes('system') || 
         (textLower.includes('invited') && textLower.includes('to the guild')) ||
         (textLower.includes('guild') && textLower.includes('was created')) ||
         (textLower.includes('cancelled') && textLower.includes('invite')) ||
         (textLower.includes('joined') && textLower.includes('guild')) ||
         (textLower.includes('left') && textLower.includes('guild')) ||
         (textLower.includes('promoted') || textLower.includes('demoted'));
}

// Get all All Chat messages (for displaying in panel)
// limit: maximum number of messages to fetch (default: null = all)
// endBefore: message ID or timestamp to fetch messages before (for pagination)
// abortController: AbortController to cancel the fetch request
async function getAllChatMessages(forceRefresh = false, limit = null, endBefore = null, abortController = null) {
  if (!getAllChatApiUrl() || !MESSAGING_CONFIG.enabled) {
    return [];
  }
  
  // Validate that getAllChatApiUrl returns the correct endpoint
  const allChatUrl = getAllChatApiUrl();
  if (!allChatUrl || typeof allChatUrl !== 'string') {
    console.error('[VIP List] Invalid All Chat API URL:', allChatUrl);
    return [];
  }
  
  if (!allChatUrl.includes('/all-chat')) {
    console.error('[VIP List] All Chat endpoint validation failed: URL does not contain /all-chat', allChatUrl);
    return [];
  }
  
  if (allChatUrl.includes('/guilds/')) {
    console.error('[VIP List] All Chat endpoint validation failed: URL contains /guilds/ (should be all-chat only)', allChatUrl);
    return [];
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return [];
    }
    
    // CACHE REMOVED: Always fetch from Firebase to prevent stale data and system message issues
    
    // Build query URL - always use orderBy to ensure chronological order
    // Use the validated allChatUrl variable to ensure we're using the correct endpoint
    let queryUrl = `${allChatUrl}.json?orderBy="$key"`;
    
    if (limit !== null) {
      // For pagination, use limitToLast to get most recent messages
      queryUrl += `&limitToLast=${limit}`;

      // If endBefore is provided, use endAt to get messages before that key
      if (endBefore !== null) {
        queryUrl += `&endAt="${endBefore}"`;
      }
    }
    
    // Fetch All Chat messages with abort signal support
    const fetchOptions = {};
    if (abortController) {
      fetchOptions.signal = abortController.signal;
    }
    
    let response;
    try {
      response = await fetch(queryUrl, fetchOptions);
    } catch (error) {
      // If fetch was aborted, return empty array
      if (error.name === 'AbortError' || abortController?.signal.aborted) {
        return [];
      }
      throw error;
    }
    
    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      if (response.status === 401) {
        return [];
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || typeof data !== 'object') {
      return [];
    }
    
    // DEBUG: Log raw Firebase data
    const rawMessageCount = Object.keys(data).length;
    console.log(`[VIP List] [DEBUG] getAllChatMessages: Fetched ${rawMessageCount} raw messages from Firebase`);
    
    // Convert Firebase object to array and filter system messages and blocked players
    const messages = [];
    let filteredSystemCount = 0;
    
    for (const [id, msg] of Object.entries(data)) {
      if (!msg) continue;
      
      // Filter out system messages (should only appear in guild chat)
      if (isSystemMessage(msg)) {
        filteredSystemCount++;
        continue;
      }
      
      // Filter out messages from blocked players
      if (msg.from) {
        const isBlocked = await isPlayerBlocked(msg.from);
        if (isBlocked) continue;
        
        const isBlockedBy = await isBlockedByPlayer(msg.from);
        if (isBlockedBy) continue;
      }
      
      messages.push({ id, ...msg });
    }
    
    // DEBUG: Log filtering results
    if (filteredSystemCount > 0) {
      console.log(`[VIP List] [DEBUG] getAllChatMessages: Filtered ${filteredSystemCount} system messages out of ${rawMessageCount} total`);
    }
    
    messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Apply message filter: if set to 'friends', only show messages from VIP list
    const messageFilter = getMessageFilter();
    let filteredMessages = messages;
    if (messageFilter === 'friends') {
      filteredMessages = messages.filter(msg => {
        if (!msg.from) return false;
        return isPlayerInVIPList(msg.from);
      });
    }
    
    // CACHE REMOVED: No longer caching messages - always fetch fresh from Firebase
    
    return filteredMessages;
  } catch (error) {
    console.error('[VIP List] Error getting All Chat messages:', error);
    return [];
  }
}

// Clean up All Chat messages older than specified age
// ageMs: age in milliseconds (default: 30 days)
async function cleanupOldAllChatMessages(ageMs = 30 * 24 * 60 * 60 * 1000) {
  if (!getAllChatApiUrl() || !MESSAGING_CONFIG.enabled) {
    return { deleted: 0, error: null };
  }
  
  const allChatUrl = getAllChatApiUrl();
  if (!allChatUrl || typeof allChatUrl !== 'string') {
    return { deleted: 0, error: 'Invalid API URL' };
  }
  
  if (!allChatUrl.includes('/all-chat')) {
    return { deleted: 0, error: 'Invalid endpoint' };
  }
  
  try {
    const cutoffTime = Date.now() - ageMs;
    
    // Fetch all messages to check timestamps
    const response = await fetch(`${allChatUrl}.json?orderBy="$key"`);
    if (!response.ok) {
      if (response.status === 404) {
        return { deleted: 0, error: null }; // No messages to clean
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (!data || typeof data !== 'object') {
      return { deleted: 0, error: null };
    }
    
    // Find messages older than cutoff
    const messagesToDelete = [];
    for (const [id, msg] of Object.entries(data)) {
      if (!msg) continue;
      
      // Check timestamp (message ID is timestamp, or use msg.timestamp)
      const msgTimestamp = msg.timestamp || parseInt(id) || 0;
      if (msgTimestamp < cutoffTime) {
        messagesToDelete.push(id);
      }
    }
    
    if (messagesToDelete.length === 0) {
      return { deleted: 0, error: null };
    }
    
    // Delete old messages in batches (Firebase has limits)
    const BATCH_SIZE = 50;
    let deletedCount = 0;
    
    for (let i = 0; i < messagesToDelete.length; i += BATCH_SIZE) {
      const batch = messagesToDelete.slice(i, i + BATCH_SIZE);
      const deletePromises = batch.map(msgId => 
        fetch(`${allChatUrl}/${msgId}.json`, { method: 'DELETE' })
          .then(response => {
            if (response.ok) return 1;
            return 0;
          })
          .catch(() => 0)
      );
      
      const results = await Promise.all(deletePromises);
      deletedCount += results.reduce((sum, count) => sum + count, 0);
    }
    
    if (deletedCount > 0) {
      console.log(`[VIP List] Cleaned up ${deletedCount} old All Chat messages (older than ${Math.round(ageMs / (24 * 60 * 60 * 1000))} days)`);
    }
    
    return { deleted: deletedCount, error: null };
  } catch (error) {
    console.error('[VIP List] Error cleaning up old All Chat messages:', error);
    return { deleted: 0, error: error.message };
  }
}

// Mark message as read
async function markMessageAsRead(messageId, fromPlayer = null) {
  if (!getMessagingApiUrl() || !MESSAGING_CONFIG.enabled) {
    return;
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return;
    }
    
    // Hash username for Firebase path (use hashed path, same as messages)
    const hashedCurrentPlayer = await hashUsername(currentPlayer);
    const currentPlayerLower = sanitizeFirebaseKey(currentPlayer);
    
    // If fromPlayer not provided, fetch the message to get sender
    let senderName = fromPlayer;
    if (!senderName) {
      // Try hashed path first (new format), fallback to non-hashed (backward compatibility)
      let response = await fetch(`${getMessagingApiUrl()}/${hashedCurrentPlayer}/${messageId}.json`);
      
      if (!response.ok && response.status === 404) {
        // Try non-hashed path for backward compatibility
        response = await fetch(`${getMessagingApiUrl()}/${currentPlayerLower}/${messageId}.json`);
      }
      if (response.ok) {
        const msg = await response.json();
        if (msg && msg.from) {
          // Decrypt sender name if encrypted
          if (msg.usernamesEncrypted && msg.fromHash) {
            const vipList = getVIPList();
            for (const vip of vipList) {
              try {
                const testHash = await hashUsername(vip.name);
                if (testHash === msg.fromHash) {
                  senderName = await decryptUsername(msg.from, vip.name, currentPlayer);
                  break;
                }
              } catch (e) {
                // Continue trying other senders
              }
            }
            // If not found in VIP list, try to decrypt with current player (fallback)
            if (!senderName || senderName === msg.from) {
              try {
                senderName = await decryptUsername(msg.from, currentPlayer, currentPlayer);
              } catch (e) {
                senderName = msg.from; // Use encrypted value as fallback
              }
            }
          } else {
            senderName = msg.from;
          }
        }
      }
    }
    
    // Encrypt read status if we have sender name
    let encryptedReadStatus = 'true';
    if (senderName) {
      try {
        encryptedReadStatus = await encryptReadStatus(true, senderName, currentPlayer);
      } catch (error) {
        console.warn('[VIP List] Failed to encrypt read status, using plain text:', error);
        encryptedReadStatus = 'true'; // Fallback to plain text
      }
    }
    
    // Store read status using hashed path (always use hashed path for new writes to prevent unencrypted usernames)
    // Only use hashed path - never write to plain username paths to maintain privacy
    const response = await fetch(`${getMessagingApiUrl()}/${hashedCurrentPlayer}/${messageId}/read.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encryptedReadStatus)
    });
    
    if (!response.ok && response.status !== 404) {
      console.warn('[VIP List] Failed to store read status:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('[VIP List] Error marking message as read:', error);
  }
}

// Mark all messages from a specific player as read
async function markAllMessagesAsReadFromPlayer(playerName) {
  if (!getMessagingApiUrl() || !MESSAGING_CONFIG.enabled) {
    return;
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return;
    }
    
    // Hash username for Firebase path (use hashed path, same as messages)
    const hashedCurrentPlayer = await hashUsername(currentPlayer);
    const currentPlayerLower = sanitizeFirebaseKey(currentPlayer);
    
    // Get all messages for current player (try hashed path first, fallback to non-hashed)
    let response = await fetch(`${getMessagingApiUrl()}/${hashedCurrentPlayer}.json`);
    
    if (!response.ok && response.status === 404) {
      // Try non-hashed path for backward compatibility
      response = await fetch(`${getMessagingApiUrl()}/${currentPlayerLower}.json`);
    }
    
    if (!response.ok) {
      if (response.status === 401) {
        // Silent fail - warning already shown by checkForMessages
      }
      return;
    }
    
    const data = await response.json();
    if (!data || typeof data !== 'object') {
      return;
    }
    
    // Find all unread messages from this player and mark them as read
    const playerNameLower = playerName.toLowerCase();
    const markPromises = [];
    
    for (const [id, msg] of Object.entries(data)) {
      if (msg && msg.from) {
        // Check if sender matches (handle encrypted usernames)
        let senderMatches = false;
        if (msg.usernamesEncrypted && msg.fromHash) {
          // Check if fromHash matches playerName
          const hash = await hashUsername(playerName);
          if (hash === msg.fromHash) {
            senderMatches = true;
          }
        } else if (msg.from.toLowerCase() === playerNameLower) {
          senderMatches = true;
        }
        
        if (senderMatches) {
          // Decrypt read status to check if unread
          const isRead = await decryptReadStatus(msg.read, playerName, currentPlayer);
          if (!isRead) {
            markPromises.push(markMessageAsRead(id, playerName));
          }
        }
      }
    }
    
    await Promise.all(markPromises);
    
    // Update global unread count - recalculate after marking messages as read
    const messagesAfterRead = await checkForMessages();
    unreadMessageCount = messagesAfterRead.filter(msg => !msg.read).length;
    updateMessageBadge();
    
    // Update VIP list chat icon (hide it since messages are now read)
    const unreadCount = messagesAfterRead.filter(msg => 
      msg.from && msg.from.toLowerCase() === playerName.toLowerCase() && !msg.read
    ).length;
    updateVIPListChatIcon(playerName, unreadCount);
  } catch (error) {
    console.error('[VIP List] Error marking all messages as read:', error);
  }
}

// Format datetime for All Chat (time only format)
function formatAllChatDateTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  // Format: HH:MM (time only, no date or seconds)
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Create date separator element (used by all chat types)
function createDateSeparator(timestamp) {
  const separator = document.createElement('div');
  separator.style.cssText = `
    display: flex;
    align-items: center;
    margin: 12px 0;
    padding: 4px 0;
  `;
  
  const line = document.createElement('div');
  line.style.cssText = `
    flex: 1;
    height: 1px;
    background: ${CSS_CONSTANTS.COLORS.WHITE_20};
  `;
  
  const label = document.createElement('div');
  label.style.cssText = `
    padding: 0 12px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  `;
  label.textContent = formatDateSeparator(timestamp);
  
  const line2 = document.createElement('div');
  line2.style.cssText = `
    flex: 1;
    height: 1px;
    background: ${CSS_CONSTANTS.COLORS.WHITE_20};
  `;
  
  separator.appendChild(line);
  separator.appendChild(label);
  separator.appendChild(line2);
  
  return separator;
}

// Create message element (used by all chat types)
async function createChatMessageElement(msg, container, messageId = null, cachedLevel = null) {
  const messageDiv = document.createElement('div');
  messageDiv.setAttribute('data-message-id', messageId || msg.id || `msg-${Date.now()}`);
  // Store timestamp for date boundary detection when prepending older messages
  if (msg.timestamp) {
    messageDiv.setAttribute('data-timestamp', msg.timestamp.toString());
  }
  
  const currentPlayer = getCurrentPlayerName();
  const isFromCurrentPlayer = msg.isFromMe || (msg.from && msg.from.toLowerCase() === currentPlayer?.toLowerCase());
  
  messageDiv.style.cssText = `
    padding: 6px 10px;
    margin: 2px 0;
    border-radius: 4px;
    word-wrap: break-word;
    max-width: 100%;
    font-size: 13px;
    line-height: 1.4;
    ${isFromCurrentPlayer ? 'background: rgba(100, 181, 246, 0.15);' : 'background: rgba(255, 255, 255, 0.05);'}
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    white-space: pre-wrap;
  `;
  
  // Format: [Datetime] [Username]: [Message]
  const datetime = formatAllChatDateTime(msg.timestamp);
  const username = msg.isFromMe ? currentPlayer : (msg.from || 'Unknown');
  const messageText = msg.text || '';
  
  // Use cached level if provided (from batch processing), otherwise fetch
  let playerLevel = cachedLevel;
  if (playerLevel === null || playerLevel === undefined) {
    playerLevel = await getPlayerLevel(username, isFromCurrentPlayer);
  }
  
  // Create message structure with clickable player name
  const datetimeSpan = document.createElement('span');
  datetimeSpan.textContent = `[${datetime}] `;
  
  const nameButton = await createAllChatPlayerNameButton(username, isFromCurrentPlayer, container, playerLevel);
  
  const colonSpan = document.createElement('span');
  colonSpan.textContent = ': ';
  
  const messageSpan = document.createElement('span');
  
  // For system messages, parse and make usernames clickable
  if (username && username.toLowerCase() === 'system') {
    const systemParts = await embedSystemMessageUsernames(messageText, container);
    if (systemParts) {
      systemParts.forEach(part => messageSpan.appendChild(part));
    } else {
      // Still translate even if no usernames found
      const translatedText = translateSystemMessage(messageText);
      messageSpan.textContent = translatedText;
    }
  } else {
    // Use embedReplayLinks to properly parse and embed replay links
    const replayParts = embedReplayLinks(messageText);
    if (replayParts) {
      replayParts.forEach(part => messageSpan.appendChild(part));
    } else {
      messageSpan.textContent = messageText;
    }
  }
  
  messageDiv.appendChild(datetimeSpan);
  messageDiv.appendChild(nameButton);
  messageDiv.appendChild(colonSpan);
  messageDiv.appendChild(messageSpan);
  
  return messageDiv;
}

// Format date for separator (shows "Today", "Yesterday", or date)
function formatDateSeparator(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (messageDate.getTime() === today.getTime()) {
    return t('mods.vipList.dateToday');
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return t('mods.vipList.dateYesterday');
  } else {
    // Format: Month Day, Year (e.g., "January 15, 2024")
    const monthKeys = ['monthJanuary', 'monthFebruary', 'monthMarch', 'monthApril', 'monthMay', 'monthJune',
      'monthJuly', 'monthAugust', 'monthSeptember', 'monthOctober', 'monthNovember', 'monthDecember'];
    const monthName = t(`mods.vipList.${monthKeys[date.getMonth()]}`);
    return `${monthName} ${date.getDate()}, ${date.getFullYear()}`;
  }
}

// =======================
// Chat Loading Helper Functions
// =======================

// Get set of displayed message IDs from container
function getDisplayedMessageIds(container) {
  const displayedMessageIds = new Set();
  const existingMessages = container.querySelectorAll('[data-message-id]');
  existingMessages.forEach(msgEl => {
    const msgId = msgEl.getAttribute('data-message-id');
    if (msgId) displayedMessageIds.add(msgId);
  });
  return displayedMessageIds;
}

// Determine if chat needs full rebuild
function shouldRebuildChat(messages, previousCount, existingMessages, filterChanged = false) {
  return filterChanged || messages.length < previousCount || existingMessages.length === 0;
}

// Get last date key from previous messages (for date separator logic)
function getLastDateKeyFromMessages(messages, previousCount, needsFullRebuild) {
  if (needsFullRebuild || previousCount === 0 || messages.length < previousCount) {
    return null;
  }
  const lastPreviousMsg = messages[previousCount - 1];
  return lastPreviousMsg ? getDateKey(lastPreviousMsg.timestamp) : null;
}

// Unified helper to process messages for any chat type
// Returns array of elements to append (messages and optionally date separators)
// filterSystemMessages: if true, filters out system messages (for All Chat). If false, includes them (for Guild Chat).
async function processMessagesForChat(messages, messagesToProcess, needsFullRebuild, displayedIds, container, getMessageIdFn, initialLastDateKey = null, filterSystemMessages = true) {
  const elementsToAppend = [];
  let lastDateKey = initialLastDateKey;
  
  // Collect messages to process (filter out already displayed)
  const messagesToCreate = [];
  const messageIndices = [];
  
  for (let i = 0; i < messagesToProcess.length; i++) {
    const msg = messagesToProcess[i];
    
    // Filter out system messages only if filterSystemMessages is true (for All Chat)
    // System messages should appear in Guild Chat, so filterSystemMessages should be false for guild chat
    if (filterSystemMessages && isSystemMessage(msg)) {
      continue;
    }
    
    const msgId = getMessageIdFn(msg, messages, i) || msg.id;
    
    // Skip if already displayed
    if (!needsFullRebuild && displayedIds.has(msgId)) {
      continue;
    }
    
    messagesToCreate.push(msg);
    messageIndices.push(i);
  }
  
  if (messagesToCreate.length === 0) {
    return elementsToAppend;
  }
  
  // Batch fetch player levels for all unique usernames in parallel
  const currentPlayer = getCurrentPlayerName();
  const uniqueUsernames = new Set();
  messagesToCreate.forEach(msg => {
    const username = msg.isFromMe ? currentPlayer : (msg.from || 'Unknown');
    if (username && username.toLowerCase() !== 'system') {
      uniqueUsernames.add(username);
    }
  });
  
  // Pre-fetch all player levels in parallel
  const levelPromises = new Map();
  uniqueUsernames.forEach(username => {
    const isFromCurrentPlayer = username === currentPlayer;
    levelPromises.set(username, getPlayerLevel(username, isFromCurrentPlayer));
  });
  
  // Wait for all levels to be fetched (don't block if some fail)
  const levelCache = new Map();
  await Promise.allSettled(
    Array.from(levelPromises.entries()).map(async ([username, promise]) => {
      try {
        const level = await promise;
        levelCache.set(username, level);
      } catch (error) {
        levelCache.set(username, null);
      }
    })
  );
  
  // Create message elements in batches (parallel processing)
  const BATCH_SIZE = 10; // Process 10 messages at a time in parallel
  for (let batchStart = 0; batchStart < messagesToCreate.length; batchStart += BATCH_SIZE) {
    const batch = messagesToCreate.slice(batchStart, batchStart + BATCH_SIZE);
    const batchIndices = messageIndices.slice(batchStart, batchStart + BATCH_SIZE);
    
    // Process batch in parallel
    const batchElements = await Promise.all(
      batch.map(async (msg, batchIndex) => {
        const originalIndex = batchIndices[batchIndex];
        const msgId = getMessageIdFn(msg, messages, originalIndex) || msg.id;
        const currentDateKey = getDateKey(msg.timestamp);
        
        // Create message element with pre-fetched level
        const username = msg.isFromMe ? currentPlayer : (msg.from || 'Unknown');
        const isFromCurrentPlayer = username === currentPlayer;
        const playerLevel = levelCache.get(username) || null;
        
        // Create element (cache level to avoid re-fetching)
        msg._cachedLevel = playerLevel;
        const messageDiv = await createChatMessageElement(msg, container, msgId, playerLevel);
        
        return { element: messageDiv, dateKey: currentDateKey, index: batchStart + batchIndex };
      })
    );
    
    // Add date separators and elements in order
    for (let batchIndex = 0; batchIndex < batchElements.length; batchIndex++) {
      const { element, dateKey } = batchElements[batchIndex];
      const originalIndex = batchStart + batchIndex;
      
      // Only add date separator on full rebuild (initial load)
      // When appending new messages, skip date separators for simplicity
      if (needsFullRebuild && dateKey !== lastDateKey) {
        const msg = messagesToCreate[originalIndex];
        elementsToAppend.push(createDateSeparator(msg.timestamp));
        lastDateKey = dateKey;
      }
      
      elementsToAppend.push(element);
    }
  }
  
  return elementsToAppend;
}

// Append elements to container using DocumentFragment (reduces flicker)
function appendElementsToContainer(container, elements) {
  if (elements.length === 0) return;
  const fragment = document.createDocumentFragment();
  elements.forEach(element => fragment.appendChild(element));
  container.appendChild(fragment);
}

// Optimistically add a single message to All Chat without reloading
async function addMessageToAllChatOptimistically(message, container, panel) {
  if (!container || !message) return;
  
  // Filter out system messages (should only appear in guild chat)
  if (isSystemMessage(message)) {
    return;
  }
  
  const messageId = message.id || `msg-${message.timestamp}`;
  
  // Check if message already exists in DOM
  const existingMessage = container.querySelector(`[data-message-id="${messageId}"]`);
  if (existingMessage) {
    return; // Already displayed
  }
  
  // Get last displayed message to check if we need a date separator
  const displayedMessages = Array.from(container.querySelectorAll('[data-message-id]'));
  const lastMessage = displayedMessages.length > 0 ? displayedMessages[displayedMessages.length - 1] : null;
  
  let lastDateKey = null;
  if (lastMessage) {
    // Get date key from DOM (cache removed - always use DOM)
    // Try to find date separator
    if (!lastDateKey) {
      let prevElement = lastMessage.previousElementSibling;
      while (prevElement) {
        const dateText = prevElement.querySelector('div[style*="text-transform: uppercase"]')?.textContent;
        if (dateText) {
          lastDateKey = getDateKeyFromElement(prevElement);
          break;
        }
        prevElement = prevElement.previousElementSibling;
      }
    }
  }
  
  const newMessageDateKey = getDateKey(message.timestamp);
  const needsDateSeparator = lastDateKey && lastDateKey !== newMessageDateKey;
  
  // Create elements to append
  const elementsToAppend = [];
  
  // Add date separator if needed
  if (needsDateSeparator) {
    elementsToAppend.push(createDateSeparator(message.timestamp));
  }
  
  // Create message element
  const messageElement = await createChatMessageElement(message, container, messageId);
  if (messageElement) {
    elementsToAppend.push(messageElement);
  }
  
  // Append to container
  if (elementsToAppend.length > 0) {
    appendElementsToContainer(container, elementsToAppend);
    
    // Update cache if it exists
    if (allChatCache.messages) {
      // Add message to cache if not already there
      const existsInCache = allChatCache.messages.some(msg => msg.id === messageId);
      if (!existsInCache) {
        allChatCache.messages.push(message);
        allChatCache.messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        // Update cache timestamp to keep it fresh
        const now = Date.now();
        allChatCache.timestamp = now;
        allChatCache.expiresAt = now + CACHE_TTL;
      }
    }
    
    // Update message count
    if (panel) {
      const totalDisplayed = container.querySelectorAll('[data-message-id]').length;
      panel._previousMessageCount = totalDisplayed;
    }
    
    // Scroll to bottom
    scrollChatToBottom(panel);
  }
}

// Optimistically add a single message to private conversation without reloading
async function addMessageToConversationOptimistically(message, container, panel) {
  if (!container || !message) return;
  
  const messageId = message.id || `msg-${message.timestamp}`;
  
  // Check if message already exists in DOM
  const existingMessage = container.querySelector(`[data-message-id="${messageId}"]`);
  if (existingMessage) {
    return; // Already displayed
  }
  
  // Simply append the message without date separators or complex logic
  const messageElement = await createChatMessageElement(message, container, messageId);
  if (messageElement) {
    container.appendChild(messageElement);
    
    // Update message count
    if (panel) {
      const totalDisplayed = container.querySelectorAll('[data-message-id]').length;
      panel._previousMessageCount = totalDisplayed;
    }
    
    // Scroll to bottom
    scrollChatToBottom(panel);
  }
}

// Handle chat scrolling logic
function handleChatScroll(panel, container, shouldScrollToBottom, needsFullRebuild) {
  if (!panel) return;
  
  if (shouldScrollToBottom) {
    scrollChatToBottom(panel);
  } else if (!needsFullRebuild) {
    // Only scroll to bottom if user is already near the bottom (within 50px)
    let scrollElement = container;
    if (panel._scrollContainer && panel._scrollContainer.scrollView) {
      scrollElement = panel._scrollContainer.scrollView;
    } else {
      const contentWrapper = panel.querySelector('#all-chat-content-wrapper');
      const scrollView = contentWrapper?.querySelector('.scroll-view');
      if (scrollView) scrollElement = scrollView;
    }
    const isNearBottom = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight < 50;
    if (isNearBottom) {
      scrollChatToBottom(panel);
    }
  }
}

// Create empty state message
function createEmptyChatMessage(text) {
  const emptyMsg = document.createElement('div');
  emptyMsg.style.cssText = `
    text-align: center;
    color: ${CSS_CONSTANTS.COLORS.WHITE_50};
    padding: 15px;
    font-style: italic;
    font-size: 12px;
  `;
  emptyMsg.textContent = text;
  return emptyMsg;
}

// Get date key for comparison (YYYY-MM-DD format)
function getDateKey(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Copy text to clipboard
function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  
  let success = false;
  try {
    success = document.execCommand('copy');
  } catch (err) {
    console.error('[VIP List] Failed to copy text:', err);
  }
  
  // Safely remove textarea if it's still a child of body
  if (textarea.parentNode === document.body) {
    document.body.removeChild(textarea);
  } else if (textarea.parentNode) {
    textarea.parentNode.removeChild(textarea);
  }
  return success;
}

// Embed replay links in message text
function embedReplayLinks(text) {
  const parts = [];
  let lastIndex = 0;
  let searchIndex = 0;
  
  while (searchIndex < text.length) {
    const replayStart = text.indexOf('$replay(', searchIndex);
    if (replayStart === -1) {
      break;
    }
    
    // Add text before the replay
    if (replayStart > lastIndex) {
      parts.push(document.createTextNode(text.substring(lastIndex, replayStart)));
    }
    
    // Find the matching closing parenthesis by counting braces
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;
    let jsonStart = -1;
    let jsonEnd = -1;
    
    for (let i = replayStart + 8; i < text.length; i++) {
      const char = text[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (inString) {
        continue;
      }
      
      if (char === '{') {
        if (braceCount === 0) {
          jsonStart = i;
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && jsonStart !== -1) {
          jsonEnd = i;
          // Look for the closing parenthesis
          if (i + 1 < text.length && text[i + 1] === ')') {
            const replayText = text.substring(replayStart, i + 2);
            const jsonText = text.substring(jsonStart, jsonEnd + 1);
            
            // Parse replay data
            try {
              const replayData = JSON.parse(jsonText);
              const region = replayData.region || 'Unknown';
              const map = replayData.map || 'Unknown';
              
              // Create clickable link
              const link = document.createElement('a');
              link.textContent = `${region} - ${map}`;
              link.href = '#';
              link.style.cssText = `
                color: rgb(25, 118, 210);
                text-decoration: underline;
                cursor: pointer;
              `;
              
              link.addEventListener('click', async (e) => {
                e.preventDefault();
                const result = copyToClipboard(replayText);
                const success = result instanceof Promise ? await result : result;
                if (success) {
                  const originalText = link.textContent;
                  link.textContent = 'Copied!';
                  link.style.color = CSS_CONSTANTS.COLORS.SUCCESS;
                  setTimeout(() => {
                    link.textContent = originalText;
                    link.style.color = 'rgb(25, 118, 210)';
                  }, 2000);
                }
              });
              
              parts.push(link);
              lastIndex = i + 2;
              searchIndex = i + 2;
              break;
            } catch (error) {
              // If parsing fails, just add the original text
              parts.push(document.createTextNode(replayText));
              lastIndex = i + 2;
              searchIndex = i + 2;
              break;
            }
          }
        }
      }
    }
    
    // If we didn't find a valid replay, skip this occurrence
    if (jsonEnd === -1 || searchIndex === lastIndex) {
      searchIndex = replayStart + 1;
      if (searchIndex >= text.length) break;
    }
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(document.createTextNode(text.substring(lastIndex)));
  }
  
  // If no replays found, return null to use textContent instead
  if (parts.length === 1 && parts[0].nodeType === Node.TEXT_NODE) {
    return null;
  }
  
  return parts;
}

// Extract usernames from English system message text
function extractUsernamesFromSystemMessage(text) {
  if (!text || typeof text !== 'string') {
    return { usernames: [], textWithPlaceholders: text };
  }
  
  const usernames = [];
  const commonWords = ['the', 'guild', 'was', 'created', 'and', 'or', 'a', 'an', 'to', 'by', 'joined', 'left', 'promoted', 'demoted', 'transferred', 'leadership', 'invited', 'kicked', 'from', 'changed', 'updated', 'description', 'type', 'cancelled', 'invite'];
  const roleWords = ['officer', 'member', 'leader', 'admin'];
  const actionWords = ['promoted', 'demoted', 'joined', 'left', 'created', 'transferred', 'invited', 'kicked', 'changed', 'updated', 'cancelled'];
  
  // Extract and protect quoted strings (guild names)
  const quotedStrings = [];
  const quotePattern = /"([^"]+)"/g;
  let quoteMatch;
  while ((quoteMatch = quotePattern.exec(text)) !== null) {
    const start = quoteMatch.index;
    const end = start + quoteMatch[0].length;
    quotedStrings.push({ start, end, content: quoteMatch[0] });
  }
  
  // Build protected text
  let protectedText = text;
  for (let i = quotedStrings.length - 1; i >= 0; i--) {
    const q = quotedStrings[i];
    const spaces = ' '.repeat(q.end - q.start);
    protectedText = protectedText.substring(0, q.start) + spaces + protectedText.substring(q.end);
  }
  
  // Find all potential usernames (including dots)
  const usernamePattern = /(?<![a-zA-Z0-9_.\-])([a-zA-Z0-9_\-.]{1,30})(?![a-zA-Z0-9_.\-])/g;
  const usernameMatches = [];
  let match;
  
  while ((match = usernamePattern.exec(protectedText)) !== null) {
    const username = match[1];
    const usernameLower = username.toLowerCase();
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    
    // Skip if inside quoted string
    if (quotedStrings.some(q => matchStart >= q.start && matchEnd <= q.end)) {
      continue;
    }
    
    // Skip common words
    if (commonWords.includes(usernameLower)) {
      continue;
    }
    
    // Skip action words
    if (actionWords.includes(usernameLower)) {
      continue;
    }
    
    // Skip role words after "to"
    if (roleWords.includes(usernameLower)) {
      const beforeText = protectedText.substring(Math.max(0, matchStart - 10), matchStart).toLowerCase();
      if (beforeText.includes(' to ')) {
        continue;
      }
    }
    
    // Context validation
    const beforeText = protectedText.substring(Math.max(0, matchStart - 30), matchStart).toLowerCase();
    const afterText = protectedText.substring(matchEnd, Math.min(protectedText.length, matchEnd + 30)).toLowerCase();
    
    const isAtStart = matchStart === 0;
    const isAfterBy = beforeText.endsWith('by ') || beforeText.endsWith('by');
    const isBeforeAction = actionWords.some(action => afterText.startsWith(action + ' ') || afterText.startsWith(action));
    const immediateBefore = protectedText.substring(Math.max(0, matchStart - 30), matchStart).toLowerCase();
    const isAfterAction = actionWords.some(action => {
      return immediateBefore.endsWith(' ' + action + ' ') || immediateBefore.endsWith(action + ' ');
    });
    const isAfterTo = beforeText.endsWith('to ') || beforeText.endsWith(' to ');
    const isAfterToWithAction = isAfterTo && actionWords.some(action => {
      const toIndex = immediateBefore.lastIndexOf('to');
      if (toIndex === -1) return false;
      const beforeTo = immediateBefore.substring(0, toIndex).trim();
      return beforeTo.endsWith(' ' + action) || beforeTo.endsWith(action) || beforeTo.includes(' ' + action + ' ');
    });
    const isAfterFor = beforeText.endsWith('for ') || beforeText.endsWith(' for ');
    const isAfterForWithAction = isAfterFor && actionWords.some(action => {
      const forIndex = immediateBefore.lastIndexOf('for');
      if (forIndex === -1) return false;
      const beforeFor = immediateBefore.substring(0, forIndex).trim();
      return beforeFor.endsWith(' ' + action) || beforeFor.endsWith(action) || beforeFor.includes(' ' + action + ' ') || beforeFor.includes('invite');
    });
    
    const isValidContext = isAtStart || isAfterBy || isBeforeAction || isAfterAction || isAfterToWithAction || isAfterForWithAction;
    
    if (isValidContext) {
      usernameMatches.push({
        start: matchStart,
        end: matchEnd,
        username: username
      });
    }
  }
  
  // Sort by position (reverse order for replacement)
  usernameMatches.sort((a, b) => b.start - a.start);
  
  // Replace usernames with placeholders
  let textWithPlaceholders = text;
  usernameMatches.forEach((match, index) => {
    const placeholder = `__USERNAME_${index}__`;
    usernames.unshift(match.username); // Add to beginning to maintain order
    textWithPlaceholders = textWithPlaceholders.substring(0, match.start) + placeholder + textWithPlaceholders.substring(match.end);
  });
  
  return { usernames, textWithPlaceholders };
}

// Translate system messages from English (stored in Firebase) to current language
// Can accept text with placeholders (__USERNAME_0__, etc.) or actual usernames
function translateSystemMessage(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  // Check if text contains placeholders - if so, we need to handle it differently
  const hasPlaceholders = /__USERNAME_\d+__/.test(text);
  
  // Pattern: Guild "{name}" was created by {player}
  const createdByMatch = text.match(/^Guild "([^"]+)" was created by (.+)$/);
  if (createdByMatch) {
    const result = tReplace('mods.guilds.guildCreatedBy', { name: createdByMatch[1], player: createdByMatch[2] });
    // If original had placeholders, preserve them in the result
    if (hasPlaceholders && createdByMatch[2].startsWith('__USERNAME_')) {
      return result.replace(createdByMatch[2], createdByMatch[2]);
    }
    return result;
  }
  
  // Pattern: {player} joined the guild
  const joinedMatch = text.match(/^(.+) joined the guild$/);
  if (joinedMatch) {
    return tReplace('mods.guilds.playerJoinedGuild', { player: joinedMatch[1] });
  }
  
  // Pattern: {player} left the guild
  const leftMatch = text.match(/^(.+) left the guild$/);
  if (leftMatch) {
    return tReplace('mods.guilds.playerLeftGuild', { player: leftMatch[1] });
  }
  
  // Pattern: {player} transferred leadership to {newLeader}
  const transferredMatch = text.match(/^(.+) transferred leadership to (.+)$/);
  if (transferredMatch) {
    return tReplace('mods.guilds.playerTransferredLeadership', { player: transferredMatch[1], newLeader: transferredMatch[2] });
  }
  
  // Pattern: {player} invited {invitedPlayer} to the guild
  const invitedMatch = text.match(/^(.+) invited (.+) to the guild$/);
  if (invitedMatch) {
    return tReplace('mods.guilds.playerInvitedToGuild', { player: invitedMatch[1], invitedPlayer: invitedMatch[2] });
  }
  
  // Pattern: {player} cancelled the invite for {playerName}
  const cancelledInviteMatch = text.match(/^(.+) cancelled the invite for (.+)$/);
  if (cancelledInviteMatch) {
    // Fallback to English if translation key doesn't exist
    const translation = t('mods.guilds.playerCancelledInvite');
    if (translation === 'mods.guilds.playerCancelledInvite') {
      return text; // No translation available, return original
    }
    return tReplace('mods.guilds.playerCancelledInvite', { player: cancelledInviteMatch[1], playerName: cancelledInviteMatch[2] });
  }
  
  // Pattern: {player} promoted {member} to Officer
  const promotedMatch = text.match(/^(.+) promoted (.+) to Officer$/);
  if (promotedMatch) {
    return tReplace('mods.guilds.playerPromotedToOfficer', { player: promotedMatch[1], member: promotedMatch[2] });
  }
  
  // Pattern: {player} demoted {member} to Member
  const demotedMatch = text.match(/^(.+) demoted (.+) to Member$/);
  if (demotedMatch) {
    return tReplace('mods.guilds.playerDemotedToMember', { player: demotedMatch[1], member: demotedMatch[2] });
  }
  
  // Pattern: {player} kicked {member} from the guild
  const kickedMatch = text.match(/^(.+) kicked (.+) from the guild$/);
  if (kickedMatch) {
    // Fallback to English if translation key doesn't exist
    const translation = t('mods.guilds.playerKickedFromGuild');
    if (translation === 'mods.guilds.playerKickedFromGuild') {
      return text; // No translation available, return original
    }
    return tReplace('mods.guilds.playerKickedFromGuild', { player: kickedMatch[1], member: kickedMatch[2] });
  }
  
  // Pattern: {player} changed the guild join type to {type}
  const joinTypeMatch = text.match(/^(.+) changed the guild join type to (.+)$/);
  if (joinTypeMatch) {
    const translation = t('mods.guilds.playerChangedJoinType');
    if (translation === 'mods.guilds.playerChangedJoinType') {
      return text; // No translation available, return original
    }
    return tReplace('mods.guilds.playerChangedJoinType', { player: joinTypeMatch[1], type: joinTypeMatch[2] });
  }
  
  // Pattern: {player} updated the guild description
  const descriptionMatch = text.match(/^(.+) updated the guild description$/);
  if (descriptionMatch) {
    const translation = t('mods.guilds.playerUpdatedDescription');
    if (translation === 'mods.guilds.playerUpdatedDescription') {
      return text; // No translation available, return original
    }
    return tReplace('mods.guilds.playerUpdatedDescription', { player: descriptionMatch[1] });
  }
  
  // No pattern matched, return original text
  return text;
}

async function embedSystemMessageUsernames(text, container) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  
  // Extract usernames from original English text first
  const { usernames } = extractUsernamesFromSystemMessage(text);
  
  // If no usernames found, just return null to use textContent
  if (usernames.length === 0) {
    return null;
  }
  
  // Translate the original message (usernames will be in the translated text)
  const translatedText = translateSystemMessage(text);
  
  // Now find and replace usernames in the translated text with clickable buttons
  const parts = [];
  let lastIndex = 0;
  
  // Sort usernames by length (longest first) to avoid partial matches
  const sortedUsernames = [...usernames].sort((a, b) => b.length - a.length);
  
  // Find all username positions in translated text
  const usernamePositions = [];
  for (const username of sortedUsernames) {
    // Use negative lookbehind/lookahead to match whole usernames only (handles dots)
    const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![a-zA-Z0-9_.\\-])${escapedUsername}(?![a-zA-Z0-9_.\\-])`, 'g');
    let match;
    while ((match = regex.exec(translatedText)) !== null) {
      usernamePositions.push({
        start: match.index,
        end: match.index + match[0].length,
        username: username
      });
    }
  }
  
  // Sort by position and remove overlaps (keep first occurrence)
  usernamePositions.sort((a, b) => a.start - b.start);
  const nonOverlappingPositions = [];
  for (const pos of usernamePositions) {
    if (nonOverlappingPositions.length === 0 || pos.start >= nonOverlappingPositions[nonOverlappingPositions.length - 1].end) {
      nonOverlappingPositions.push(pos);
    }
  }
  
  // Build parts array
  for (const pos of nonOverlappingPositions) {
    // Add text before username
    if (pos.start > lastIndex) {
      parts.push(document.createTextNode(translatedText.substring(lastIndex, pos.start)));
    }
    
    // Create clickable username button
    try {
      const nameButton = await createAllChatPlayerNameButton(pos.username, false, container);
      const button = nameButton.querySelector('button');
      if (button) {
        button.style.textDecoration = 'underline';
      }
      parts.push(nameButton);
    } catch (error) {
      parts.push(document.createTextNode(pos.username));
    }
    
    lastIndex = pos.end;
  }
  
  // Add remaining text after last username
  if (lastIndex < translatedText.length) {
    parts.push(document.createTextNode(translatedText.substring(lastIndex)));
  }
  
  // If no parts created, return null
  if (parts.length === 0) {
    return null;
  }
  
  // If only one text node, return null to use textContent instead
  if (parts.length === 1 && parts[0].nodeType === Node.TEXT_NODE) {
    return null;
  }
  
  return parts;
}


// Update message badge
function updateMessageBadge() {
  // Remove any existing badges from VIP List menu item
  const menuItem = document.querySelector('.vip-list-menu-item');
  if (menuItem) {
    const badge = menuItem.querySelector('.vip-message-badge');
    if (badge) {
      badge.remove();
    }
  }
  
  // Update blip on chat header button
  const chatButton = document.querySelector('.vip-chat-header-btn');
  if (chatButton) {
    let blip = chatButton.querySelector('.vip-chat-header-blip');
    if (!blip && unreadMessageCount > 0) {
      blip = document.createElement('div');
      blip.className = 'vip-chat-header-blip flex rounded-full border border-solid border-black absolute right-0 top-0 size-3 text-message animate-in fade-in sm:size-2';
      const pingSpan = document.createElement('span');
      pingSpan.className = 'absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75';
      const dotSpan = document.createElement('span');
      dotSpan.className = 'relative inline-flex size-full rounded-full bg-current';
      blip.appendChild(pingSpan);
      blip.appendChild(dotSpan);
      chatButton.appendChild(blip);
    }
    if (blip) {
      blip.style.display = unreadMessageCount > 0 ? 'flex' : 'none';
    }
  }
}

// Check for conversation deletions and refresh open panels
async function checkForConversationDeletions() {
  if (!getMessagingApiUrl() || !MESSAGING_CONFIG.enabled) {
    return;
  }
  
  // Check all open chat panels for message count changes
  for (const [playerName, panel] of openChatPanels.entries()) {
    if (!panel || panel.nodeType !== 1) {
      continue;
    }
    
    // Skip All Chat - it has its own update mechanism
    if (playerName === 'all-chat') {
      continue;
    }
    
    try {
      const messagesArea = panel.querySelector(`#chat-messages-${playerName.toLowerCase()}`);
      if (!messagesArea) {
        continue;
      }
      
      // Get current conversation messages
      const messages = await getConversationMessages(playerName);
      const currentCount = messages.length;
      const previousCount = panel._lastMessageCount || 0;
      
      // If message count decreased, refresh the conversation
      if (currentCount < previousCount) {
        console.log(`[VIP List] Detected message deletion for ${playerName}, refreshing conversation...`);
        await loadConversation(playerName, messagesArea, false);
        panel._lastMessageCount = currentCount;
        
        // Update timestamp tracking
        const conversationKey = playerName.toLowerCase();
        if (messages.length === 0) {
          conversationLastTimestamps.delete(conversationKey);
        } else {
          const latestMessage = messages[messages.length - 1];
          conversationLastTimestamps.set(conversationKey, latestMessage?.timestamp || Date.now());
        }
      } else if (currentCount !== previousCount) {
        // Update count even if it increased (handled by processNewMessages, but update tracking)
        panel._lastMessageCount = currentCount;
      }
    } catch (error) {
      // Silently handle errors - don't spam console
      if (error.message && !error.message.includes('401')) {
        console.warn(`[VIP List] Error checking conversation deletions for ${playerName}:`, error);
      }
    }
  }
}

// Process new messages (called by event listeners)
async function processNewMessages(messages) {
  const newMessages = messages.filter(msg => msg.timestamp > lastMessageCheckTime);
  lastMessageCheckTime = Math.max(...messages.map(m => m.timestamp || 0), lastMessageCheckTime);
  
  // Group messages by sender
  const messagesBySender = groupMessagesBySender(messages);
  
  // Mark messages as read if chat panel is open for that sender
  const markReadPromises = [];
  messagesBySender.forEach((playerMessages, sender) => {
    const panel = openChatPanels.get(sender.toLowerCase());
    const senderKey = sender.toLowerCase();
    if (panel) {
      // Chat panel is open, mark all unread messages from this sender as read in Firebase
      playerMessages.forEach(msg => {
        if (!msg.read && msg.id) {
          markReadPromises.push(markMessageAsRead(msg.id, sender));
          // Update message read status locally to avoid re-fetching
          msg.read = true;
        }
      });
    }
  });
  
  // Wait for all read status updates to complete
  if (markReadPromises.length > 0) {
    await Promise.all(markReadPromises);
  }
  
  // Update all-chat tabs
  messagesBySender.forEach((playerMessages, sender) => {
    const unreadCount = playerMessages.filter(msg => !msg.read).length;
    // Update all-chat tab if it exists
    if (allChatTabs.has(sender)) {
      updateAllChatTabUnread(sender, unreadCount);
    }
    // Update VIP list chat icon
    updateVIPListChatIcon(sender, unreadCount);
  });
  
  unreadMessageCount = messages.filter(msg => !msg.read).length;
  updateMessageBadge();
  
  // Update open chat panels with new messages (debounced to prevent rapid updates)
  messagesBySender.forEach((playerMessages, sender) => {
    const senderLower = sender.toLowerCase();
    
    // Clear existing timeout for this sender
    const existingTimeout = conversationUpdateTimeouts.get(senderLower);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Debounce updates (wait 300ms to batch rapid message arrivals)
    const timeoutId = setTimeout(async () => {
      conversationUpdateTimeouts.delete(senderLower);
      
      const panel = openChatPanels.get(senderLower);
      if (panel && typeof loadConversation === 'function') {
        const messagesArea = panel.querySelector(`#chat-messages-${senderLower}`);
        if (messagesArea) {
          await loadConversation(sender, messagesArea, false);
        }
      }
      
      // Check for tabs in all-chat panel (new style)
      if (allChatTabs.has(senderLower)) {
        const allChatPanel = openChatPanels.get('all-chat');
        if (allChatPanel && activeAllChatTab === senderLower) {
          // This sender's tab is currently active, refresh the conversation
          const messagesArea = allChatPanel.querySelector('#chat-messages-all-chat');
          if (messagesArea && typeof loadConversation === 'function') {
            await loadConversation(sender, messagesArea, false);
          }
        }
      }
    }, 300);
    
    conversationUpdateTimeouts.set(senderLower, timeoutId);
  });
}

// Auto-open tabs based on Firebase state (unread messages, chat requests, guild chat)
// This is called on init and when opening the panel to ensure tabs reflect current Firebase state
async function autoOpenTabsFromFirebase(updateTabStatus = true) {
  try {
    // Get all unread messages (always check Firebase for unread messages)
    const unreadMessages = await checkForMessages();
    
    // Group unread messages by sender, filtering out invalid usernames
    const unreadBySender = new Map();
    unreadMessages.forEach(msg => {
      if (msg && msg.from && !msg.read && isValidUsername(msg.from)) {
        const sender = msg.from;
        if (!unreadBySender.has(sender)) {
          unreadBySender.set(sender, []);
        }
        unreadBySender.get(sender).push(msg);
      } else if (msg && msg.from && !isValidUsername(msg.from)) {
        console.warn('[VIP List] Skipping message with invalid/encrypted username:', msg.from);
      }
    });
    
    // Open tabs for each sender with unread messages
    for (const [sender, messages] of unreadBySender) {
      if (!allChatTabs.has(sender)) {
        const unreadCount = messages.length;
        await addAllChatTab(sender, sender, unreadCount);
      }
    }
    
    // Get all message requests (always open tabs for requests)
    const requests = await checkForChatRequests();
    
    // Open tabs for each requester, filtering out invalid usernames
    for (const req of requests) {
      if (req && req.from && isValidUsername(req.from) && !allChatTabs.has(req.from)) {
        await addAllChatTab(req.from, req.from, 0);
      } else if (req && req.from && !isValidUsername(req.from)) {
        console.warn('[VIP List] Skipping chat request with invalid/encrypted username:', req.from);
      }
    }
    
    // Add guild chat tab if player is in a guild
    await addGuildChatTab();
    
    // Batch update all tab statuses with rate limiting (optional, for performance)
    if (updateTabStatus) {
      await updateAllChatTabsStatus();
    }
  } catch (error) {
    console.error('[VIP List] Error auto-opening tabs:', error);
  }
}

// Process chat requests (called by event listeners)
async function processChatRequests(requests) {
  if (requests.length === 0) return;
  
  const currentPlayer = getCurrentPlayerName();
  if (!currentPlayer) return;
  
  // Process each incoming request
  for (const req of requests) {
    if (req.from) {
      // Skip if username is invalid/encrypted
      if (!isValidUsername(req.from)) {
        console.warn('[VIP List] Skipping chat request with invalid/encrypted username:', req.from);
        continue;
      }
      
      const fromPlayer = req.from;
      const fromPlayerLower = fromPlayer.toLowerCase();
      
      // Check if tab exists in all-chat panel
      const tabExists = allChatTabs.has(fromPlayerLower);
      
      if (!tabExists) {
        // Open new tab for incoming request (will show incoming request message)
        await openMessageDialog(fromPlayer);
      } else {
        // Tab already exists, update UI to show incoming request
        const panel = document.getElementById('vip-chat-panel-all-chat');
        if (panel) {
          const messagesArea = panel.querySelector(`#chat-messages-${fromPlayerLower}`);
          if (messagesArea) {
            checkRecipientChatEnabled(fromPlayer).then(async enabled => {
              const hasPrivilege = await hasChatPrivilege(currentPlayer, fromPlayer);
              
              // Create temporary panel object for updateChatPanelUI
              const tempPanel = {
                querySelector: (selector) => {
                  if (selector === 'button.primary') {
                    return panel.querySelector('button.primary');
                  }
                  if (selector === '.vip-chat-input' || selector === 'textarea') {
                    return panel.querySelector('textarea');
                  }
                  if (selector === `#chat-messages-${fromPlayerLower}`) {
                    return messagesArea;
                  }
                  return null;
                }
              };
              
              await updateChatPanelUI(tempPanel, fromPlayer, enabled, hasPrivilege, true, false);
            });
          }
        }
      }
    }
  }
}

// Check if outgoing requests have been accepted (for open chat panels)
async function checkAcceptedRequests() {
  const currentPlayer = getCurrentPlayerName();
  if (!currentPlayer) return;
  
  for (const [playerName, panel] of openChatPanels.entries()) {
    if (panel && panel.nodeType === 1) {
      try {
        const messagesArea = panel.querySelector(`#chat-messages-${playerName.toLowerCase()}`);
        if (messagesArea) {
          const privilegeMessage = messagesArea.querySelector('.chat-privilege-message');
          const hasPendingRequest = privilegeMessage && privilegeMessage.textContent.includes('Waiting for');
          
          if (hasPendingRequest) {
            const hasPrivilege = await hasChatPrivilege(currentPlayer, playerName);
            if (hasPrivilege) {
              // Stop frequent checking for this player since request was accepted
              stopPendingRequestCheck(playerName);
              
              const recipientHasChatEnabled = await checkRecipientChatEnabled(playerName);
              await updateChatPanelUI(panel, playerName, recipientHasChatEnabled, true, false, false);
              if (typeof loadConversation === 'function') {
                await loadConversation(playerName, messagesArea, true);
              }
            }
          } else {
            // No pending request, stop frequent checking if it exists
            stopPendingRequestCheck(playerName);
          }
        }
      } catch (error) {
        console.warn('[VIP List] Error checking privilege status for', playerName, error);
      }
    }
  }
}

// Start frequent checking for a player with a pending request
function startPendingRequestCheck(playerName) {
  // Stop any existing check for this player
  stopPendingRequestCheck(playerName);
  
  const currentPlayer = getCurrentPlayerName();
  if (!currentPlayer) return;
  
  const playerNameLower = playerName.toLowerCase();
  
  // Check every 1 second for this specific player
  const intervalId = setInterval(async () => {
    // Use lowercase for consistency with openChatPanels map
    const panel = openChatPanels.get(playerNameLower);
    if (!panel || panel.nodeType !== 1) {
      stopPendingRequestCheck(playerName);
      return;
    }
    
    try {
      const messagesArea = panel.querySelector(`#chat-messages-${playerNameLower}`);
      if (messagesArea) {
        const privilegeMessage = messagesArea.querySelector('.chat-privilege-message');
        const hasPendingRequest = privilegeMessage && (
          privilegeMessage.textContent.includes('Waiting for') || 
          privilegeMessage.textContent.includes('Chat Request Sent') ||
          privilegeMessage.textContent.includes('Chat Request Pending')
        );
        
        if (!hasPendingRequest) {
          stopPendingRequestCheck(playerName);
          return;
        }
        
        const hasPrivilege = await hasChatPrivilege(currentPlayer, playerName);
        if (hasPrivilege) {
          stopPendingRequestCheck(playerName);
          
          const recipientHasChatEnabled = await checkRecipientChatEnabled(playerName);
          // Remove privilege message if it exists
          if (privilegeMessage) {
            privilegeMessage.remove();
          }
          await updateChatPanelUI(panel, playerName, recipientHasChatEnabled, true, false, false);
          if (typeof loadConversation === 'function') {
            await loadConversation(playerName, messagesArea, true);
          }
        }
      }
    } catch (error) {
      console.warn('[VIP List] Error checking pending request for', playerName, error);
    }
  }, 1000); // Check every 1 second
  
  pendingRequestCheckIntervals.set(playerNameLower, intervalId);
}

// Stop frequent checking for a player
function stopPendingRequestCheck(playerName) {
  const playerNameLower = playerName.toLowerCase();
  const intervalId = pendingRequestCheckIntervals.get(playerNameLower);
  if (intervalId) {
    clearInterval(intervalId);
    pendingRequestCheckIntervals.delete(playerNameLower);
  }
}

// Setup polling for message checking (adaptive interval based on panel state)
function setupPolling(interval = MESSAGING_CONFIG.checkInterval) {
  // Clear existing interval if any
  if (messageCheckInterval) {
    clearInterval(messageCheckInterval);
    messageCheckInterval = null;
  }
  
  console.log('[VIP List] Using polling for messages (interval:', interval, 'ms)');
  
  // Initial load
  checkForMessages().then(messages => {
    unreadMessageCount = messages.filter(msg => !msg.read).length;
    updateMessageBadge();
  });
  
  messageCheckInterval = setInterval(async () => {
    const messages = await checkForMessages();
    await processNewMessages(messages);
    
    // Check for All Chat and Guild Chat messages if panel is open and tab is active (debounced)
    const allChatPanel = openChatPanels.get('all-chat');
    if (allChatPanel && typeof loadAllChatConversation === 'function') {
      // Clear existing timeout
      if (allChatUpdateTimeout) {
        clearTimeout(allChatUpdateTimeout);
      }
      
      // Debounce All Chat updates (wait 300ms to batch rapid updates)
      allChatUpdateTimeout = setTimeout(async () => {
        allChatUpdateTimeout = null;
        const messagesArea = allChatPanel.querySelector('#chat-messages-all-chat');
        if (!messagesArea) return;
        
        // Only check if All Chat tab is active using state manager (avoid unnecessary API calls)
        if (chatStateManager.isChatTypeActive('all-chat')) {
          try {
            // Get abortController from panel to cancel if tab switches
            const abortController = allChatPanel._abortController || chatStateManager.getAbortController();
            
            // Check if cancelled before fetching
            if (abortController?.signal.aborted) return;
            
            const allChatMessages = await getAllChatMessages(false, null, null, abortController);
            
            // Check if cancelled after fetching
            if (abortController?.signal.aborted) return;
            if (!chatStateManager.isChatTypeActive('all-chat')) return;
            
            const latestTimestamp = allChatMessages.length > 0 ? allChatMessages[allChatMessages.length - 1]?.timestamp : null;
            const storedTimestamp = allChatPanel._lastTimestamp;
            
            if (storedTimestamp === null || latestTimestamp === null) {
              allChatPanel._lastTimestamp = latestTimestamp;
            } else if (latestTimestamp > storedTimestamp || allChatMessages.length !== (allChatPanel._lastMessageCount || 0)) {
              allChatPanel._lastTimestamp = latestTimestamp;
              allChatPanel._lastMessageCount = allChatMessages.length;
              
              // Create checkCancelled callback for loadAllChatConversation
              const checkCancelled = () => {
                if (abortController?.signal.aborted) return true;
                if (!chatStateManager.isChatTypeActive('all-chat')) return true;
                return false;
              };
              
              await loadAllChatConversation(messagesArea, false, false, checkCancelled, abortController);
            }
          } catch (error) {
            if (error.message && !error.message.includes('401') && !error.message.includes('AbortError')) {
              console.warn('[VIP List] Error checking All Chat messages:', error);
            }
          }
        }
        
        // Check for new guild chat messages if guild tab is active using state manager
        const activeChatType = chatStateManager.getActiveChatType();
        if (activeChatType && activeChatType.startsWith('guild-')) {
          try {
            const guildId = activeChatType.replace('guild-', '');
            
            // Get abortController from panel to cancel if tab switches
            const abortController = allChatPanel._abortController || chatStateManager.getAbortController();
            
            // Check if cancelled before loading
            if (abortController?.signal.aborted) return;
            if (!chatStateManager.isChatTypeActive(activeChatType)) return;
            
            // Create checkCancelled callback for loadGuildChatConversation
            const checkCancelled = () => {
              if (abortController?.signal.aborted) return true;
              if (!chatStateManager.isChatTypeActive(activeChatType)) return true;
              return false;
            };
            
            await loadGuildChatConversation(messagesArea, guildId, false, checkCancelled, abortController);
          } catch (error) {
            if (error.message && !error.message.includes('401') && !error.message.includes('AbortError')) {
              console.warn('[VIP List] Error checking Guild Chat messages:', error);
            }
          }
        }
      }, 300);
    }
    
    // Check for conversation deletions and refresh open panels
    await checkForConversationDeletions();
    
    const requests = await checkForChatRequests();
    await processChatRequests(requests);
    
    await checkAcceptedRequests();
  }, interval);
}

// Switch polling interval based on whether panels are open
function updateMessageCheckingMode() {
  if (!getMessagingApiUrl() || !MESSAGING_CONFIG.enabled) {
    return;
  }
  
  const hasOpenPanels = openChatPanels.size > 0;
  
  // Use shorter interval (5s) when panels are open for more responsive updates
  // Use longer interval (30s) when no panels are open for better efficiency
  const interval = hasOpenPanels ? 5000 : 30000;
  
  // Restart polling with appropriate interval
  setupPolling(interval);
}

// Setup message checking (uses polling with adaptive intervals)
function setupMessageChecking() {
  if (!getMessagingApiUrl() || !MESSAGING_CONFIG.enabled) {
    return;
  }
  
  // Start with longer interval (no panels open)
  setupPolling(30000);
}

// Cleanup message checking
function cleanupMessageChecking() {
  if (messageCheckInterval) {
    clearInterval(messageCheckInterval);
    messageCheckInterval = null;
  }
  
  // Clear all conversation update timeouts
  for (const timeoutId of conversationUpdateTimeouts.values()) {
    clearTimeout(timeoutId);
  }
  conversationUpdateTimeouts.clear();
  
  // Clear All Chat update timeout
  if (allChatUpdateTimeout) {
    clearTimeout(allChatUpdateTimeout);
    allChatUpdateTimeout = null;
  }
}

// Get all messages between current player and another player
// Get conversation messages with pagination support
// limit: maximum number of messages to fetch (default: null = all for compatibility)
// endBefore: message ID or timestamp to fetch messages before (for pagination)
async function getConversationMessages(otherPlayer, forceRefresh = false, limit = null, endBefore = null) {
  if (!getMessagingApiUrl() || !MESSAGING_CONFIG.enabled) {
    return [];
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return [];
    }
    
    const currentPlayerLower = sanitizeFirebaseKey(currentPlayer);
    const otherPlayerLower = sanitizeFirebaseKey(otherPlayer);
    
    // Check cache first (only for full fetch without pagination)
    const cacheKey = otherPlayer.toLowerCase(); // Use unsanitized for cache key consistency
    let now = Date.now();
    if (!forceRefresh && limit === null && endBefore === null && conversationCache.has(cacheKey)) {
      const cached = conversationCache.get(cacheKey);
      if (now < cached.expiresAt) {
        return cached.messages;
      }
    }
    
    // Hash usernames for Firebase paths (cached, so fast)
    const [hashedOtherPlayer, hashedCurrentPlayer] = await Promise.all([
      hashUsername(otherPlayer),
      hashUsername(currentPlayer)
    ]);
    
    // Build query URLs - always use orderBy to ensure chronological order
    let sentUrl = `${getMessagingApiUrl()}/${hashedOtherPlayer}.json?orderBy="$key"`;
    let receivedUrl = `${getMessagingApiUrl()}/${hashedCurrentPlayer}.json?orderBy="$key"`;
    
    if (limit !== null) {
      // For pagination, use limitToLast to get most recent messages
      sentUrl += `&limitToLast=${limit}`;
      receivedUrl += `&limitToLast=${limit}`;

      // If endBefore is provided, use endAt to get messages before that key
      if (endBefore !== null) {
        sentUrl += `&endAt="${endBefore}"`;
        receivedUrl += `&endAt="${endBefore}"`;
      }
    }
    
    // Fetch both message sets in parallel for faster loading
    const [sentResponse, receivedResponse] = await Promise.all([
      fetch(sentUrl).catch(() => ({ ok: false, status: 404 })),
      fetch(receivedUrl).catch(() => ({ ok: false, status: 404 }))
    ]);
    
    let sentData = {};
    if (!sentResponse.ok && sentResponse.status === 404) {
      // Try non-hashed path for backward compatibility
      const fallbackResponse = await fetch(`${getMessagingApiUrl()}/${otherPlayerLower}.json`).catch(() => ({ ok: false }));
      if (fallbackResponse.ok) {
        sentData = await fallbackResponse.json();
      }
    } else if (sentResponse.ok) {
      sentData = await sentResponse.json();
    } else if (sentResponse.status === 401) {
      // Silent fail - warning already shown by checkForMessages
      sentData = {};
    }
    
    let receivedData = {};
    if (!receivedResponse.ok && receivedResponse.status === 404) {
      // Try non-hashed path for backward compatibility
      const fallbackResponse = await fetch(`${getMessagingApiUrl()}/${currentPlayerLower}.json`).catch(() => ({ ok: false }));
      if (fallbackResponse.ok) {
        receivedData = await fallbackResponse.json();
      }
    } else if (receivedResponse.ok) {
      receivedData = await receivedResponse.json();
    } else if (receivedResponse.status === 401) {
      // Silent fail - warning already shown by checkForMessages
      receivedData = {};
    }
    
    // Collect all potential messages first (fast filtering using hashes)
    const sentMessagePromises = [];
    const receivedMessagePromises = [];
    
    // Collect sent messages
    if (sentData && typeof sentData === 'object') {
      for (const [id, msg] of Object.entries(sentData)) {
        if (!msg) continue;
        
        // Fast filter using hash (avoids decryption for filtering)
        let isFromCurrentPlayer = false;
        if (msg.usernamesEncrypted && msg.fromHash) {
          isFromCurrentPlayer = msg.fromHash === hashedCurrentPlayer;
        } else if (msg.from) {
          // Fallback: try direct comparison first (fast)
          isFromCurrentPlayer = msg.from.toLowerCase() === currentPlayerLower;
        }
        
        if (isFromCurrentPlayer) {
          // Queue decryption task (will decrypt in parallel)
          sentMessagePromises.push(
            (async () => {
              let decryptedMsg = { id, ...msg, isFromMe: true };
              
              // Decrypt text and username in parallel
              const decryptTasks = [];
              if (msg.encrypted && msg.text) {
                decryptTasks.push(
                  decryptMessage(msg.text, currentPlayer, otherPlayer)
                    .then(text => { decryptedMsg.text = text; })
                    .catch(() => {}) // Keep encrypted text on error
                );
              }
              if (msg.usernamesEncrypted && msg.from) {
                decryptTasks.push(
                  decryptUsername(msg.from, currentPlayer, otherPlayer)
                    .then(from => { decryptedMsg.from = from; })
                    .catch(() => { decryptedMsg.from = currentPlayer; })
                );
              }
              
              await Promise.all(decryptTasks);
              return decryptedMsg;
            })()
          );
        }
      }
    }
    
    // Collect received messages
    if (receivedData && typeof receivedData === 'object') {
      for (const [id, msg] of Object.entries(receivedData)) {
        if (!msg) continue;
        
        // Fast filter using hash (avoids decryption for filtering)
        let isFromOtherPlayer = false;
        if (msg.usernamesEncrypted && msg.fromHash) {
          isFromOtherPlayer = msg.fromHash === hashedOtherPlayer;
        } else if (msg.from) {
          // Fallback: try direct comparison first (fast)
          isFromOtherPlayer = msg.from.toLowerCase() === otherPlayerLower;
        }
        
        if (isFromOtherPlayer) {
          // Queue decryption task (will decrypt in parallel)
          receivedMessagePromises.push(
            (async () => {
              let decryptedMsg = { id, ...msg, isFromMe: false };
              
              // Decrypt text and username in parallel
              const decryptTasks = [];
              if (msg.encrypted && msg.text) {
                decryptTasks.push(
                  decryptMessage(msg.text, otherPlayer, currentPlayer)
                    .then(text => { decryptedMsg.text = text; })
                    .catch(() => {}) // Keep encrypted text on error
                );
              }
              if (msg.usernamesEncrypted && msg.from) {
                decryptTasks.push(
                  decryptUsername(msg.from, otherPlayer, currentPlayer)
                    .then(from => { decryptedMsg.from = from; })
                    .catch(() => { decryptedMsg.from = otherPlayer; })
                );
              }
              
              await Promise.all(decryptTasks);
              return decryptedMsg;
            })()
          );
        }
      }
    }
    
    // Decrypt all messages in parallel (much faster than sequential)
    const [sentMessages, receivedMessages] = await Promise.all([
      Promise.all(sentMessagePromises),
      Promise.all(receivedMessagePromises)
    ]);
    
    let allMessages = [...sentMessages, ...receivedMessages];
    
    // Filter out system messages (should only appear in guild chat)
    allMessages = allMessages.filter(msg => {
      if (msg.from && msg.from.toLowerCase() === 'system') {
        return false;
      }
      if (msg.isSystem === true) {
        return false;
      }
      return true;
    });
    
    // Sort by timestamp
    allMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // If limit is set, take only the most recent 'limit' messages
    if (limit !== null && allMessages.length > limit) {
      allMessages = allMessages.slice(-limit);
    }
    
    // Cache the messages (only for full fetch without pagination)
    if (limit === null && endBefore === null) {
      now = Date.now();
      conversationCache.set(cacheKey, {
        messages: allMessages,
        timestamp: now,
        expiresAt: now + CACHE_TTL
      });
    }
    
    return allMessages;
  } catch (error) {
    console.error('[VIP List] Error getting conversation messages:', error);
    return [];
  }
}

// Load older conversation messages when scrolling to top (pagination)
async function loadOlderConversationMessages(container, playerName) {
  const playerKey = playerName.toLowerCase();
  await loadOlderMessages(container, getConversationMessages, {
    loadingFlag: '_isLoadingOlderConversation',
    oldestIdKey: `_oldestLoadedMessageId_${playerKey}`,
    fetchArgs: (oldestMessageId) => [playerName, false, 10, oldestMessageId],
    playerName: playerName // Pass playerName for runs-only filter
  });
}

// Setup scroll detection for private conversation
function setupConversationScrollDetection(panel, messagesArea, scrollElement, playerName) {
  const playerKey = playerName.toLowerCase();
  setupScrollDetection(panel, messagesArea, scrollElement, {
    handlerKey: `_scrollHandler_conversation_${playerKey}`,
    oldestIdKey: `_oldestLoadedMessageId_${playerKey}`,
    loadingFlag: '_isLoadingOlderConversation',
    loadFunction: loadOlderConversationMessages,
    loadArgs: [messagesArea, playerName]
  });
}

// Load and display conversation (module-level function)
async function loadConversation(player, container, forceScrollToBottom = false, forceRefresh = false) {
  // Get previous message count from container's data attribute or panel
  const panel = container.closest('[id^="vip-chat-panel-"]');
  
  // Check if we're loading initial messages or appending new ones
  const existingMessages = container.querySelectorAll('[data-message-id]');
  const isInitialLoad = existingMessages.length === 0 || forceRefresh;
  
  let messages;
  if (isInitialLoad) {
    // Load only the most recent 20 messages initially
    messages = await getConversationMessages(player, forceRefresh, MESSAGES_PER_PAGE);
    
    // Track oldest loaded message for pagination
    const playerKey = player.toLowerCase();
    if (messages.length > 0) {
      panel[`_oldestLoadedMessageId_${playerKey}`] = messages[0].id;
    } else {
      panel[`_oldestLoadedMessageId_${playerKey}`] = null;
    }
    
    // Setup scroll detection for loading older messages
    let scrollElement = container;
    if (panel._scrollContainer && panel._scrollContainer.scrollView) {
      scrollElement = panel._scrollContainer.scrollView;
    } else {
      const contentWrapper = panel.querySelector('#all-chat-content-wrapper');
      const scrollView = contentWrapper?.querySelector('.scroll-view');
      if (scrollView) scrollElement = scrollView;
    }
    setupConversationScrollDetection(panel, container, scrollElement, player);
  } else {
    // For updates, fetch all messages first
    // Show "Fetching runs..." indicator if runs-only filter is active and we're refreshing
    const filterKey = panel ? `runsOnlyFilter_${player.toLowerCase()}` : null;
    const isRunsOnlyActive = panel && panel.getAttribute(`data-${filterKey}`) === 'true';
    if (isRunsOnlyActive && forceRefresh) {
      showFetchingRunsIndicator(container);
    }
    
    let filteredMessages;
    try {
      const allMessages = await getConversationMessages(player, forceRefresh);
      
      // Apply runs-only filter to all messages first (so we can properly track filtered count)
      filteredMessages = allMessages;
      if (isRunsOnlyActive) {
        const originalCount = filteredMessages.length;
        filteredMessages = filteredMessages.filter(msg => {
          const text = msg.text || '';
          return text.includes('$replay(');
        });
        console.log(`[VIP List] Runs-only filter applied to all messages: ${originalCount} -> ${filteredMessages.length} messages`);
      }
      
      // Ensure filtered messages are sorted chronologically (oldest to newest)
      if (filteredMessages && filteredMessages.length > 0) {
        filteredMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      }
    } finally {
      // Hide indicator after fetching and filtering is complete
      if (isRunsOnlyActive && forceRefresh) {
        hideFetchingRunsIndicator(container);
      }
    }
    
    // Check if any new messages have timestamps earlier than the last displayed message
    // If so, we need to do a full rebuild to maintain correct chronological order
    if (filteredMessages && filteredMessages.length > 0 && existingMessages.length > 0) {
      const lastDisplayedMessage = Array.from(container.querySelectorAll('[data-message-id]')).pop();
      if (lastDisplayedMessage) {
        const lastMessageId = lastDisplayedMessage.getAttribute('data-message-id');
        const lastMessage = filteredMessages.find(msg => msg.id === lastMessageId);
        if (lastMessage && lastMessage.timestamp) {
          // Get messages that would be "new" (after previousMessageCount)
          const previousMessageCount = panel?._previousMessageCount || 0;
          const newMessages = filteredMessages.slice(previousMessageCount);
          // Check if any new message has an earlier timestamp
          const hasOlderMessages = newMessages.some(msg => msg.timestamp && msg.timestamp < lastMessage.timestamp);
          if (hasOlderMessages) {
            // Force full rebuild by treating as initial load
            messages = filteredMessages;
            // This will be handled by needsFullRebuild check below
          } else {
            // Use all filtered messages (not just new ones) so we can properly slice for appending
            messages = filteredMessages;
          }
        } else {
          messages = filteredMessages;
        }
      } else {
        messages = filteredMessages;
      }
    } else {
      // Use all filtered messages (not just new ones) so we can properly slice for appending
      messages = filteredMessages || [];
    }
  }
  
  // Get filter state (already applied above for updates, but need it for initial load)
  const filterKey = panel ? `runsOnlyFilter_${player.toLowerCase()}` : null;
  const isRunsOnlyActive = panel && panel.getAttribute(`data-${filterKey}`) === 'true';
  const previousFilterState = panel?._lastRunsOnlyFilter || false;
  const filterChanged = isRunsOnlyActive !== previousFilterState;
  
  // Apply runs-only filter for initial load
  if (isInitialLoad && isRunsOnlyActive) {
    showFetchingRunsIndicator(container);
    try {
      const originalCount = messages.length;
      messages = messages.filter(msg => {
        const text = msg.text || '';
        return text.includes('$replay(');
      });
      console.log(`[VIP List] Runs-only filter applied to initial load: ${originalCount} -> ${messages.length} messages`);
    } finally {
      hideFetchingRunsIndicator(container);
    }
  }
  
  // Ensure messages are always sorted chronologically (oldest to newest)
  if (messages && messages.length > 0) {
    messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }
  
  const previousMessageCount = panel?._previousMessageCount || 0;
  
  // Check if new messages arrived (count increased)
  const hasNewMessages = messages.length > previousMessageCount;
  const shouldScrollToBottom = forceScrollToBottom || hasNewMessages;
  
  // Track displayed message IDs to prevent duplicates
  const displayedMessageIds = getDisplayedMessageIds(container);
  
  // Determine if we need a full rebuild
  // Rebuild if: filter changed, message count decreased (deletion), or no existing messages
  const needsFullRebuild = shouldRebuildChat(messages, previousMessageCount, existingMessages, filterChanged);
  
  // Preserve warning message, privilege message, blocked message, and delete confirmation if they exist
  const warningMessage = container.querySelector('.chat-disabled-warning');
  const privilegeMessage = container.querySelector('.chat-privilege-message');
  const blockedMessage = container.querySelector('.chat-blocked-message');
  const deleteConfirmation = container.querySelector('.delete-confirmation');
  
  if (needsFullRebuild) {
    container.innerHTML = '';
    
    // Add privilege message first (if exists)
    if (privilegeMessage) {
      container.appendChild(privilegeMessage);
    }
    
    // Add warning message next (if exists)
    if (warningMessage) {
      container.appendChild(warningMessage);
    }
  }
  
  if (messages.length === 0) {
    if (needsFullRebuild) {
      const emptyMsg = createEmptyChatMessage(t('mods.vipList.noMessagesYet'));
      container.appendChild(emptyMsg);
      
      // Add delete confirmation after empty message (if exists)
      if (deleteConfirmation) {
        container.appendChild(deleteConfirmation);
      }
      
      // Add blocked message at bottom (if exists)
      if (blockedMessage) {
        container.appendChild(blockedMessage);
      }
    }
    
    if (panel) {
      panel._previousMessageCount = 0;
      panel._lastRunsOnlyFilter = isRunsOnlyActive;
    }
    return;
  }
  
  // Get last date key for separator logic
  // When appending new messages, get the date key from the last displayed message in DOM
  let lastDateKey = null;
  if (needsFullRebuild) {
    lastDateKey = getLastDateKeyFromMessages(messages, previousMessageCount, needsFullRebuild);
  } else {
    // Get last date key from the last message element in the DOM
    const lastMessageElement = Array.from(container.querySelectorAll('[data-message-id]')).pop();
    if (lastMessageElement) {
      // Look backwards from the last message to find the date separator that applies to it
      let prevElement = lastMessageElement.previousElementSibling;
      while (prevElement) {
        const dateText = prevElement.querySelector('div[style*="text-transform: uppercase"]')?.textContent;
        if (dateText) {
          lastDateKey = getDateKeyFromElement(prevElement);
          break;
        }
        prevElement = prevElement.previousElementSibling;
      }
      // If no date separator found before the last message, check if there's one at the very beginning
      if (!lastDateKey) {
        const firstElement = container.firstElementChild;
        if (firstElement) {
          const firstDateText = firstElement.querySelector('div[style*="text-transform: uppercase"]')?.textContent;
          if (firstDateText) {
            lastDateKey = getDateKeyFromElement(firstElement);
          }
        }
      }
    }
  }
  
  // Only process new messages if not rebuilding
  const messagesToProcess = needsFullRebuild ? messages : messages.slice(previousMessageCount);
  
  // Message ID generator function
  const getMessageId = (msg, allMessages, index) => msg.id || `msg-${allMessages.indexOf(msg)}`;
  
  // Process messages using unified helper (handles date separators only on full rebuild)
  const elementsToAppend = await processMessagesForChat(
    messages,
    messagesToProcess,
    needsFullRebuild,
    displayedMessageIds,
    container,
    getMessageId,
    needsFullRebuild ? lastDateKey : null
  );
  
  // Append elements using DocumentFragment (reduces flicker)
  appendElementsToContainer(container, elementsToAppend);
  
  // Add delete confirmation after all messages (if exists and rebuilding)
  if (needsFullRebuild && deleteConfirmation) {
    container.appendChild(deleteConfirmation);
  }
  
  // Add blocked message at bottom (if exists and rebuilding)
  if (needsFullRebuild && blockedMessage) {
    container.appendChild(blockedMessage);
  }
  
  // Update message count on panel
  if (panel) {
    panel._previousMessageCount = messages.length;
    panel._lastRunsOnlyFilter = isRunsOnlyActive;
  }
  
  // Handle scrolling
  handleChatScroll(panel, container, shouldScrollToBottom, needsFullRebuild);
}

// Show inline delete confirmation in chat panel
function showDeleteConfirmation(panel, otherPlayer) {
  const messagesArea = panel.querySelector(`#chat-messages-${otherPlayer.toLowerCase()}`);
  if (!messagesArea) return;
  
  // Check if confirmation already exists
  const existingConfirmation = messagesArea.querySelector('.delete-confirmation');
  if (existingConfirmation) {
    existingConfirmation.remove();
  }
  
  // Create confirmation message
  const confirmation = document.createElement('div');
  confirmation.className = 'delete-confirmation';
  confirmation.style.cssText = `
    padding: 16px;
    margin: 8px;
    background: rgba(255, 107, 107, 0.2);
    border: 2px solid ${CSS_CONSTANTS.COLORS.ERROR};
    border-radius: 4px;
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    text-align: center;
    font-size: 12px;
    line-height: 1.4;
  `;
  
  confirmation.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px; color: ${CSS_CONSTANTS.COLORS.ERROR};">
      ${t('mods.vipList.deleteConversationTitle')}
    </div>
    <div style="margin-bottom: 12px;">
      ${tReplace('mods.vipList.deleteConversationMessage', { name: otherPlayer })}
    </div>
    <div style="display: flex; gap: 8px; justify-content: center;">
      <button class="confirm-delete-btn" style="
        padding: 6px 16px;
        background: ${CSS_CONSTANTS.COLORS.ERROR};
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
      ">${t('mods.vipList.delete')}</button>
      <button class="cancel-delete-btn" style="
        padding: 6px 16px;
        background: rgba(255, 255, 255, 0.1);
        color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
      ">${t('mods.vipList.cancelButton')}</button>
    </div>
  `;
  
  // Add hover effects
  const confirmBtn = confirmation.querySelector('.confirm-delete-btn');
  const cancelBtn = confirmation.querySelector('.cancel-delete-btn');
  
  confirmBtn.addEventListener('mouseenter', () => {
    confirmBtn.style.background = '#ff5252';
  });
  confirmBtn.addEventListener('mouseleave', () => {
    confirmBtn.style.background = CSS_CONSTANTS.COLORS.ERROR;
  });
  
  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.background = 'rgba(255, 255, 255, 0.2)';
  });
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
  });
  
  // Handle confirm button click
  confirmBtn.addEventListener('click', async () => {
    confirmation.style.opacity = '0.6';
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    
    const success = await deleteConversation(otherPlayer);
    if (success) {
      // Remove confirmation dialog
      confirmation.remove();
      // Clear messages area completely
      messagesArea.innerHTML = '';
      // Refresh the chat panel to show empty state (force refresh to ensure clean state)
      await loadConversation(otherPlayer, messagesArea, false, true);
    } else {
      // Re-enable buttons if deletion failed
      confirmation.style.opacity = '1';
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });
  
  // Handle cancel button click
  cancelBtn.addEventListener('click', () => {
    confirmation.remove();
  });
  
  // Scroll to bottom and append confirmation
  messagesArea.appendChild(confirmation);
  // Scroll to bottom to show confirmation (panel is already a parameter)
  scrollChatToBottom(panel);
}

async function deleteConversation(otherPlayer) {
  if (!getMessagingApiUrl() || !MESSAGING_CONFIG.enabled) {
    console.warn('[VIP List] Messaging not enabled');
    return false;
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      throw new Error('Could not get current player name');
    }
    
    const currentPlayerLower = sanitizeFirebaseKey(currentPlayer);
    const otherPlayerLower = sanitizeFirebaseKey(otherPlayer);
    const conversationKey = otherPlayer.toLowerCase(); // Use unsanitized for cache key consistency
    
    // Hash usernames for Firebase paths (try hashed first, fallback to lowercase for backward compatibility)
    const hashedOtherPlayer = await hashUsername(otherPlayer);
    const hashedCurrentPlayer = await hashUsername(currentPlayer);
    
    // Get all messages in the conversation
    const conversationMessages = await getConversationMessages(otherPlayer, true); // Force refresh to get all messages
    
    if (conversationMessages.length === 0) {
      console.log('[VIP List] No messages to delete');
      // Still clear cache and state even if no messages
      clearConversationCacheAndState(otherPlayer);
      return true;
    }
    
    console.log(`[VIP List] Deleting ${conversationMessages.length} messages...`);
    
    // Delete messages from both players' collections
    // Messages are stored under the recipient's hashed name in Firebase
    const deletePromises = [];
    
    for (const msg of conversationMessages) {
      if (msg.isFromMe) {
        // Message sent by current player - stored under otherPlayer's hashed name
        // Try hashed path first, then fallback to non-hashed for backward compatibility
        let deleteUrl = `${getMessagingApiUrl()}/${hashedOtherPlayer}/${msg.id}.json`;
        deletePromises.push(
          fetch(deleteUrl, { method: 'DELETE' })
            .then(response => {
              if (!response.ok && response.status === 404) {
                // Try non-hashed path for backward compatibility
                const fallbackUrl = `${getMessagingApiUrl()}/${otherPlayerLower}/${msg.id}.json`;
                return fetch(fallbackUrl, { method: 'DELETE' });
              } else if (!response.ok) {
                console.warn(`[VIP List] Failed to delete sent message ${msg.id}:`, response.status);
              }
              return response;
            })
            .catch(error => {
              console.warn(`[VIP List] Error deleting sent message ${msg.id}:`, error);
            })
        );
      } else {
        // Message received from otherPlayer - stored under currentPlayer's hashed name
        // Try hashed path first, then fallback to non-hashed for backward compatibility
        let deleteUrl = `${getMessagingApiUrl()}/${hashedCurrentPlayer}/${msg.id}.json`;
        deletePromises.push(
          fetch(deleteUrl, { method: 'DELETE' })
            .then(response => {
              if (!response.ok && response.status === 404) {
                // Try non-hashed path for backward compatibility
                const fallbackUrl = `${getMessagingApiUrl()}/${currentPlayerLower}/${msg.id}.json`;
                return fetch(fallbackUrl, { method: 'DELETE' });
              } else if (!response.ok) {
                console.warn(`[VIP List] Failed to delete received message ${msg.id}:`, response.status);
              }
              return response;
            })
            .catch(error => {
              console.warn(`[VIP List] Error deleting received message ${msg.id}:`, error);
            })
        );
      }
    }
    
    // Wait for all deletions to complete
    await Promise.all(deletePromises);
    
    // Clear cache and state after successful Firebase deletion
    clearConversationCacheAndState(otherPlayer);
    
    console.log('[VIP List] Conversation deleted successfully');
    
    return true;
  } catch (error) {
    console.error('[VIP List] Error deleting conversation:', error);
    alert(t('mods.vipList.deleteConversationError'));
    return false;
  }
}

// Helper function to clear all conversation-related cache and state
function clearConversationCacheAndState(otherPlayer) {
  const conversationKey = otherPlayer.toLowerCase();
  
  // Clear conversation cache
  conversationCache.delete(conversationKey);
  
  // Clear conversation last timestamp
  conversationLastTimestamps.delete(conversationKey);
  
  // Clear panel state for this conversation
  // Try to find panel by checking all chat panels (conversations are tabs in all-chat panel)
  const allChatPanel = document.querySelector('[id^="vip-chat-panel-all-chat"]');
  const privateChatPanel = document.querySelector(`[id^="vip-chat-panel-${conversationKey}"]`);
  const panel = allChatPanel || privateChatPanel;
  
  if (panel) {
    // Clear pagination state
    panel[`_oldestLoadedMessageId_${conversationKey}`] = null;
    panel[`_previousMessageCount_${conversationKey}`] = 0;
    panel[`_previousMessageCount`] = 0; // Also clear generic one if exists
    panel[`_lastMessageCount_${conversationKey}`] = 0;
    panel[`_lastMessageCount`] = 0; // Also clear generic one if exists
    
    // Clear scroll handler if exists
    const handlerKey = `_scrollHandler_conversation_${conversationKey}`;
    if (panel[handlerKey]) {
      panel[handlerKey] = null;
    }
  }
  
  console.log(`[VIP List] Cleared cache and state for conversation with ${otherPlayer}`);
}

// Open chat panel (now opens as tab in all-chat panel)
async function openChatPanel(toPlayer) {
  if (!getMessagingApiUrl() || !MESSAGING_CONFIG.enabled) {
    return;
  }
  
  const currentPlayer = getCurrentPlayerName();
  if (!currentPlayer) {
    return;
  }
  
  // Hide chat icon in VIP list when opening chat
  updateVIPListChatIcon(toPlayer, 0);
  
  // Always open as tab in all-chat panel
  await openMessageDialog(toPlayer);
}

// Create clickable player name with dropdown menu for All Chat
async function createAllChatPlayerNameButton(username, isFromCurrentPlayer, container, playerLevel = null) {
  // System should not be clickable
  if (username && username.toLowerCase() === 'system') {
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = `
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: 13px;
      font-weight: bold;
      display: inline;
      line-height: 1.4;
    `;
    nameSpan.textContent = username;
    return nameSpan;
  }
  
  const nameWrapper = document.createElement('span');
  nameWrapper.style.cssText = 'position: relative; display: inline-block;';
  
  const nameButton = document.createElement('button');
  nameButton.type = 'button';
  const nameColor = isFromCurrentPlayer ? CSS_CONSTANTS.COLORS.LINK : CSS_CONSTANTS.COLORS.TEXT_WHITE;
  
  // Check if player is blocked
  const isBlocked = MESSAGING_CONFIG.enabled ? await isPlayerBlocked(username) : false;
  const finalNameColor = isBlocked ? CSS_CONSTANTS.COLORS.ERROR : nameColor;
  
  nameButton.style.cssText = `
    background: transparent;
    border: none;
    color: ${finalNameColor};
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    font-size: 13px;
    font-weight: bold;
    display: inline;
    line-height: 1.4;
  `;
  
  // Get guild abbreviation
  const guildAbbreviation = await getPlayerGuildAbbreviation(username);
  nameButton.textContent = username;
  
  // Check if we're in a guild chat tab and if this player is in the same guild
  let shouldShowGuildAbbreviation = true;
  if (activeAllChatTab && activeAllChatTab.startsWith('guild-')) {
    const currentGuildId = activeAllChatTab.replace('guild-', '');
    const playerGuildId = await getPlayerGuildId(username);
    if (playerGuildId === currentGuildId) {
      shouldShowGuildAbbreviation = false;
    }
  }
  
  // Add guild abbreviation as separate span (not underlined) if available and should show
  if (guildAbbreviation && shouldShowGuildAbbreviation) {
    const guildSpan = document.createElement('span');
    guildSpan.textContent = `[${guildAbbreviation}] `;
    guildSpan.style.cssText = `
      color: ${finalNameColor};
      font-size: 13px;
      font-weight: bold;
      text-decoration: none;
      display: inline;
      line-height: 1.4;
    `;
    nameWrapper.appendChild(guildSpan);
  }
  
  // Dropdown menu
  const dropdown = createDropdownElement();
  
  // Get profile URL (default to lowercase username if no profile data available)
  const profileUrl = username.toLowerCase();
  
  // Create dropdown items
  dropdown.appendChild(createDropdownItem(t('mods.vipList.dropdownProfile'), () => {
    window.open(`/profile/${profileUrl}`, '_blank');
  }, dropdown, { fontSize: '13px' }));
  
  const cyclopediaMenuItem = createDropdownItem(t('mods.vipList.dropdownCyclopedia'), () => {
    openCyclopediaForPlayer(username);
  }, dropdown, {
    dataAttributes: {
      'data-vip-list-item': 'true',
      'data-cyclopedia-exclude': 'true'
    }
  });
  cyclopediaMenuItem.style.display = '';
  dropdown.appendChild(cyclopediaMenuItem);
  
  // Add Send Message option (only if not current player and messaging enabled)
  if (!isFromCurrentPlayer && MESSAGING_CONFIG.enabled) {
    dropdown.appendChild(createDropdownItem(t('mods.vipList.dropdownSendMessage'), () => {
      openMessageDialog(username);
    }, dropdown, { color: CSS_CONSTANTS.COLORS.LINK, fontSize: '13px' }));
  }
  
  // Add to VIP option (only if not already in VIP list and not current player)
  if (!isFromCurrentPlayer && !isPlayerInVIPList(username)) {
    dropdown.appendChild(createDropdownItem(t('mods.vipList.addToVIPList'), async () => {
      try {
        const profileData = await fetchPlayerData(username);
        if (profileData) {
          const playerInfo = extractPlayerInfoFromProfile(profileData, username);
          playerInfo.profile = profileData.name?.toLowerCase() || username.toLowerCase();
          addToVIPList(username, playerInfo);
          await refreshVIPListDisplay();
        }
      } catch (error) {
        console.error('[VIP List] Error adding player to VIP list:', error);
      }
    }, dropdown, { color: CSS_CONSTANTS.COLORS.SUCCESS, fontSize: '13px' }));
  }
  
  nameButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const scrollContainer = findDropdownContainer(container) || container;
    toggleDropdown(dropdown, nameButton, scrollContainer, {
      cyclopediaMenuItem: cyclopediaMenuItem
    });
  });
  
  setupVIPDropdownClickHandler();
  
  nameWrapper.appendChild(nameButton);
  
  // Add level as separate span if available (not underlined)
  if (playerLevel != null) {
    const levelSpan = document.createElement('span');
    levelSpan.textContent = ` (Lv. ${playerLevel})`;
    levelSpan.style.cssText = `
      color: ${finalNameColor};
      font-size: 13px;
      font-weight: bold;
      text-decoration: none;
      display: inline;
      line-height: 1.4;
    `;
    nameWrapper.appendChild(levelSpan);
  }
  
  nameWrapper.appendChild(dropdown);
  
  return nameWrapper;
}

// Get player level (checks cache and VIP list)
async function getPlayerLevel(playerName, isFromCurrentPlayer) {
  if (isFromCurrentPlayer) {
    return getCurrentPlayerLevel();
  }
  
  const playerNameLower = playerName.toLowerCase();
  
  // Check cache first (cache valid for 1 hour)
  const cached = playerLevelCache.get(playerNameLower);
  if (cached && Date.now() - cached.timestamp < 3600000) {
    return cached.level;
  }
  
  // Check VIP list
  const vipList = getVIPList();
  const vipInfo = vipList.find(vip => vip.name.toLowerCase() === playerNameLower);
  if (vipInfo && vipInfo.level != null) {
    // Cache it
    playerLevelCache.set(playerNameLower, { level: vipInfo.level, timestamp: Date.now() });
    return vipInfo.level;
  }
  
  // If not in VIP list, try to fetch from profile
  try {
    const profileData = await fetchPlayerData(playerName);
    if (profileData) {
      const playerInfo = extractPlayerInfoFromProfile(profileData, playerName);
      if (playerInfo.level != null) {
        // Cache it
        playerLevelCache.set(playerNameLower, { level: playerInfo.level, timestamp: Date.now() });
        return playerInfo.level;
      }
    }
  } catch (error) {
    // Silently fail - player might not exist or API might be unavailable
    // Cache null to avoid repeated failed requests
    playerLevelCache.set(playerNameLower, { level: null, timestamp: Date.now() });
  }
  
  return null;
}

// Get player guild abbreviation (checks cache and Firebase)
async function getPlayerGuildAbbreviation(playerName) {
  if (!playerName) return null;
  
  const playerNameLower = playerName.toLowerCase();
  
  // Check cache first (cache valid for 1 hour)
  const cached = playerGuildCache.get(playerNameLower);
  if (cached && Date.now() - cached.timestamp < GUILD_CACHE_TTL) {
    return cached.abbreviation;
  }
  
  try {
    // Get player's guild from Firebase
    const hashedPlayer = await hashUsername(playerName);
    const firebaseUrl = MESSAGING_CONFIG.firebaseUrl;
    const response = await fetch(`${firebaseUrl}/guilds/players/${hashedPlayer}.json`);
    
    if (response.ok) {
      const playerGuild = await response.json();
      if (playerGuild && playerGuild.guildId) {
        // Get guild details to get abbreviation
        const guildResponse = await fetch(`${firebaseUrl}/guilds/list/${playerGuild.guildId}.json`);
        if (guildResponse.ok) {
          const guild = await guildResponse.json();
          if (guild && guild.abbreviation) {
            // Cache it with both abbreviation and guildId
            playerGuildCache.set(playerNameLower, { abbreviation: guild.abbreviation, guildId: playerGuild.guildId, timestamp: Date.now() });
            return guild.abbreviation;
          }
        }
      }
    }
    
    // Cache null result to avoid repeated failed requests
    playerGuildCache.set(playerNameLower, { abbreviation: null, guildId: null, timestamp: Date.now() });
    return null;
  } catch (error) {
    console.error('[VIP List] Error getting player guild abbreviation:', error);
    return null;
  }
}

// Get player guild ID (checks cache and Firebase)
async function getPlayerGuildId(playerName) {
  if (!playerName) return null;
  
  const playerNameLower = playerName.toLowerCase();
  
  // Check cache first (cache valid for 1 hour)
  const cached = playerGuildCache.get(playerNameLower);
  if (cached && Date.now() - cached.timestamp < GUILD_CACHE_TTL) {
    return cached.guildId || null;
  }
  
  // If not in cache, fetch it (this will also populate the cache via getPlayerGuildAbbreviation)
  await getPlayerGuildAbbreviation(playerName);
  
  // Check cache again after fetching
  const cachedAfterFetch = playerGuildCache.get(playerNameLower);
  return cachedAfterFetch ? (cachedAfterFetch.guildId || null) : null;
}

// Setup scroll detection for all-chat
function setupAllChatScrollDetection(panel, messagesArea, scrollElement) {
  setupScrollDetection(panel, messagesArea, scrollElement, {
    handlerKey: '_scrollHandler',
    oldestIdKey: '_oldestLoadedMessageId',
    loadingFlag: '_isLoadingOlderAllChat',
    loadFunction: loadOlderAllChatMessages,
    loadArgs: [messagesArea]
  });
}

// Load older messages when scrolling to top (pagination)
async function loadOlderAllChatMessages(container) {
  await loadOlderMessages(container, getAllChatMessages, {
    loadingFlag: '_isLoadingOlderAllChat',
    oldestIdKey: '_oldestLoadedMessageId',
    fetchArgs: (oldestMessageId) => [false, 10, oldestMessageId]
  });
}

// Get date key from a message element
function getDateKeyFromElement(element) {
  // Check if element is a date separator
  const dateText = element.querySelector('div[style*="text-transform: uppercase"]')?.textContent;
  if (dateText) {
    // Extract date from separator - format is "Today", "Yesterday", or date string
    // Use the same translation function to match the text
    const todayText = t('mods.vipList.dateToday');
    const yesterdayText = t('mods.vipList.dateYesterday');
    const today = new Date();
    if (dateText === todayText || dateText.toUpperCase() === 'TODAY') {
      return getDateKey(today.getTime());
    } else if (dateText === yesterdayText || dateText.toUpperCase() === 'YESTERDAY') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return getDateKey(yesterday.getTime());
    }
  }
  
  // Get date from message element's data-timestamp or nearby message
  const messageId = element.getAttribute('data-message-id');
  if (messageId) {
    // Try to find timestamp from message content
    const timestampMatch = element.textContent.match(/\[(\d{2}):(\d{2})\]/);
    if (timestampMatch) {
      // We don't have full date from timestamp alone, so check previous elements
      let prevElement = element.previousElementSibling;
      while (prevElement) {
        const prevDateText = prevElement.querySelector('div[style*="text-transform: uppercase"]')?.textContent;
        if (prevDateText) {
          return getDateKeyFromElement(prevElement);
        }
        prevElement = prevElement.previousElementSibling;
      }
    }
  }
  
  return null;
}

// Load and display All Chat conversation
async function loadAllChatConversation(container, forceScrollToBottom = false, forceRefresh = false, checkCancelled = null, abortController = null) {
  const panel = container.closest('[id^="vip-chat-panel-all-chat"]');
  
  // Prevent concurrent loading (memory leak prevention)
  if (panel?._isLoadingAllChat) {
    return;
  }
  
  panel._isLoadingAllChat = true;
  
  // Show loading indicator if not already shown (for polling updates)
  const wasLoadingIndicatorShown = container.querySelector('.chat-loading-indicator') !== null;
  if (!wasLoadingIndicatorShown) {
    showChatLoadingIndicator(container);
  }
  
  try {
    // Check if cancelled before starting
    if (checkCancelled && checkCancelled()) {
      return;
    }
    if (abortController?.signal.aborted) {
      return;
    }
    
    // CRITICAL: When loading all-chat, verify active chat type and clear container if needed
    // This prevents mixing messages from guild chat or private chats when switching tabs
    // The container is shared between all chat types, so we must ensure it's clean for all-chat
    const existingMessages = container.querySelectorAll('[data-message-id]');
    
    // DEBUG: Check for system messages in DOM (indicates contamination from Guild Chat)
    if (existingMessages.length > 0) {
      const systemMessagesInDOM = Array.from(existingMessages).filter(el => isSystemMessageElement(el));
      if (systemMessagesInDOM.length > 0) {
        console.warn(`[VIP List] [DEBUG] Found ${systemMessagesInDOM.length} system messages in DOM - will clear container`);
      }
    }
    
    // Verify we're actually loading for the all-chat tab using state manager
    if (!chatStateManager.isChatTypeActive('all-chat')) {
      return;
    }
    
    // CRITICAL FIX: Always clear container when loading all-chat if it has messages
    // This prevents guild chat messages from appearing in all-chat after tab switches
    // The container is shared, so messages from other chat types must be cleared
    // 
    // CRITICAL: Check if there are system messages in the container - if so, ALWAYS clear
    // System messages should NEVER appear in All Chat, so their presence indicates
    // messages from Guild Chat are present and must be cleared
    const storedPreviousCount = panel?._previousMessageCount ?? 0;
    const wasTabSwitch = storedPreviousCount === 0 && existingMessages.length > 0;
    
    // Check for system messages in existing messages (indicates Guild Chat contamination)
    const hasSystemMessages = existingMessages.length > 0 && 
                              Array.from(existingMessages).some(el => isSystemMessageElement(el));
    
    // Only allow incremental update if:
    // - not forcing refresh
    // - storedPreviousCount > 0 (we had all-chat messages before)
    // - existingMessages.length matches storedPreviousCount (same messages, just appending new ones)
    // - NO system messages present (system messages = Guild Chat contamination)
    const isIncrementalUpdate = !forceRefresh && 
                                !hasSystemMessages &&
                                storedPreviousCount > 0 && 
                                existingMessages.length > 0 && 
                                existingMessages.length === storedPreviousCount;
    
    // Clear container unless this is a legitimate incremental update
    // Always clear if: forcing refresh, tab switch detected, system messages present, or not incremental update
    if (forceRefresh || wasTabSwitch || hasSystemMessages || !isIncrementalUpdate) {
      container.innerHTML = '';
      if (panel) {
        panel._previousMessageCount = 0;
        panel._oldestLoadedMessageId = null;
      }
    }
    
    // Check if we're loading initial messages or appending new ones
    const remainingMessages = container.querySelectorAll('[data-message-id]');
    const isInitialLoad = remainingMessages.length === 0 || forceRefresh;
    
    let messages;
    let forceRebuildForDateChange = false;
    if (isInitialLoad) {
      // If forceRefresh is true, load all messages (user wants fresh data)
      // Otherwise, load only the most recent 20 messages initially for faster loading
      const limit = forceRefresh ? null : MESSAGES_PER_PAGE;
      messages = await getAllChatMessages(forceRefresh, limit, null, abortController);
      
      // Check if cancelled after loading messages
      if (checkCancelled && checkCancelled()) {
        return;
      }
      if (abortController?.signal.aborted) {
        return;
      }
      
      // Verify active chat type is still 'all-chat' before displaying
      if (!chatStateManager.isChatTypeActive('all-chat')) {
        return;
      }
      
      // Track oldest loaded message for pagination
      if (messages.length > 0) {
        panel._oldestLoadedMessageId = messages[0].id;
      } else {
        panel._oldestLoadedMessageId = null;
      }
    } else {
      // For updates, fetch all new messages (will append to existing)
      const allMessages = await getAllChatMessages(forceRefresh, null, null, abortController);
      
      // Check if cancelled after loading messages
      if (checkCancelled && checkCancelled()) {
        return;
      }
      if (abortController?.signal.aborted) {
        return;
      }
      
      // Verify active chat type is still 'all-chat' before displaying
      if (!chatStateManager.isChatTypeActive('all-chat')) {
        return;
      }
      
      // Filter to only new messages (after the latest we have)
      const allDisplayedIds = Array.from(container.querySelectorAll('[data-message-id]')).map(el => el.getAttribute('data-message-id'));
      if (allDisplayedIds.length > 0) {
        // Filter out messages we already have displayed
        messages = allMessages.filter(msg => !allDisplayedIds.includes(msg.id));
      } else {
        messages = allMessages;
      }
      
      // Check if we need a full rebuild due to date changes or chronological order issues
      // Only rebuild if there are actual date changes or older messages that need to be inserted
      // Don't rebuild just because there are newer messages - those can be appended
      if (existingMessages.length > 0 && allMessages.length > 0) {
        // Get date keys directly from displayed messages in THIS container only
        const displayedDateKeys = new Set();
        const displayedMsgElements = Array.from(container.querySelectorAll('[data-message-id]'));
        
        // Extract date keys from displayed messages by finding their timestamps in allMessages
        displayedMsgElements.forEach(msgEl => {
          const msgId = msgEl.getAttribute('data-message-id');
          if (msgId) {
            const displayedMsg = allMessages.find(msg => msg.id === msgId);
            if (displayedMsg && displayedMsg.timestamp) {
              displayedDateKeys.add(getDateKey(displayedMsg.timestamp));
            }
          }
        });
        
        // Get the last displayed message's date key (for checking if new messages cross date boundaries)
        let lastDisplayedDateKey = null;
        if (displayedMsgElements.length > 0) {
          const lastMsgElement = displayedMsgElements[displayedMsgElements.length - 1];
          const lastMsgId = lastMsgElement.getAttribute('data-message-id');
          if (lastMsgId) {
            const lastMsg = allMessages.find(msg => msg.id === lastMsgId);
            if (lastMsg && lastMsg.timestamp) {
              lastDisplayedDateKey = getDateKey(lastMsg.timestamp);
            }
          }
        }
        
        // Check NEW messages (not already displayed) for date changes
        // Only rebuild if new messages have different dates than the last displayed message
        const newMessages = allMessages.filter(msg => !allDisplayedIds.includes(msg.id));
        const hasDateChange = newMessages.length > 0 && lastDisplayedDateKey !== null && 
          newMessages.some(msg => msg.timestamp && getDateKey(msg.timestamp) !== lastDisplayedDateKey);
        
        // Check if any message in allMessages has an earlier timestamp than the first displayed message
        // This means we have older messages that need to be inserted at the top
        const firstDisplayedMessage = displayedMsgElements.length > 0 ? displayedMsgElements[0] : null;
        let hasOlderMessages = false;
        
        if (firstDisplayedMessage) {
          const firstMsgId = firstDisplayedMessage.getAttribute('data-message-id');
          const firstMsg = firstMsgId ? allMessages.find(msg => msg.id === firstMsgId) : null;
          
          if (firstMsg && firstMsg.timestamp) {
            // Check if any message in allMessages is older than the first displayed message
            // Only count messages that aren't already displayed
            hasOlderMessages = allMessages.some(msg => 
              !allDisplayedIds.includes(msg.id) && 
              msg.timestamp && 
              msg.timestamp < firstMsg.timestamp
            );
          }
        }
        
        // Only rebuild if:
        // 1. Date changed in NEW messages (new messages from different dates need proper date dividers)
        // 2. Older messages detected (need to insert at the top, can't just append)
        // Don't rebuild just because there are newer messages - those can be appended normally
        if (hasDateChange || hasOlderMessages) {
          // Use all messages and ensure they're sorted chronologically
          messages = [...allMessages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          forceRebuildForDateChange = true;
        }
      }
    }
    
    // Ensure messages are always sorted chronologically (safety check)
    if (messages && messages.length > 0) {
      messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    }
    
    // Get previous message count from container's data attribute or panel
    const previousMessageCount = panel?._previousMessageCount || 0;
    const currentDisplayedCount = existingMessages.length;
    
    // Check if new messages arrived (count increased)
    const hasNewMessages = isInitialLoad ? messages.length > 0 : messages.length > 0;
    const shouldScrollToBottom = forceScrollToBottom || (hasNewMessages && !isInitialLoad);
    
    // Check if we need a full rebuild due to chronological order issues
    // (This happens when new messages have earlier timestamps than displayed messages)
    // If messages contains all messages (not just new ones), we detected older messages and need full rebuild
    const allDisplayedIdsForRebuild = Array.from(container.querySelectorAll('[data-message-id]')).map(el => el.getAttribute('data-message-id'));
    const needsChronologicalRebuild = !isInitialLoad && allDisplayedIdsForRebuild.length > 0 && 
      messages.length > allDisplayedIdsForRebuild.length && 
      messages.some(msg => allDisplayedIdsForRebuild.includes(msg.id));
    
    // Only rebuild if: message count decreased (deletion), no existing messages, force refresh, chronological order issue, or date change detected
    // Don't rebuild just because we want to scroll - that causes flicker
    const needsFullRebuild = isInitialLoad || forceRebuildForDateChange || needsChronologicalRebuild || shouldRebuildChat(messages, previousMessageCount, existingMessages);
    
    // Check if cancelled before modifying DOM
    if (checkCancelled && checkCancelled()) {
      return;
    }
    if (abortController?.signal.aborted) {
      return;
    }
    
    // Verify active tab is still 'all-chat' before displaying
    if (activeAllChatTab !== 'all-chat') {
      return;
    }
    
    // IMPORTANT: If no messages and not initial load, return early BEFORE clearing container
    // This prevents clearing the container when API fails or all messages are filtered out
    if (messages.length === 0 && !isInitialLoad) {
      // No new messages and not initial load - just update count
      if (panel) panel._previousMessageCount = currentDisplayedCount;
      return;
    }
    
    if (needsFullRebuild) {
      container.innerHTML = '';
      // Reset oldest loaded message ID on rebuild
      if (messages.length > 0) {
        panel._oldestLoadedMessageId = messages[0].id;
      }
    }
    
    // Track displayed message IDs AFTER clearing (if rebuild) to prevent duplicates
    // This ensures we use fresh IDs after container is cleared
    const displayedMessageIds = getDisplayedMessageIds(container);
    
    if (messages.length === 0 && isInitialLoad) {
      const emptyMsg = createEmptyChatMessage(t('mods.vipList.allChatEmptyState'));
      container.appendChild(emptyMsg);
      if (panel) panel._previousMessageCount = 0;
      panel._oldestLoadedMessageId = null;
      return;
    }
    
    // Get last date key for separator logic (only needed for full rebuild)
    // When appending new messages, get the date key from the last displayed message in DOM
    let lastDateKey = null;
    if (needsFullRebuild) {
      lastDateKey = getLastDateKeyFromMessages(messages, previousMessageCount, needsFullRebuild);
    } else {
      // Get last date key from the last message element in the DOM
      // Find the last message element and look backwards to find the date separator that applies to it
      const lastMessageElement = Array.from(container.querySelectorAll('[data-message-id]')).pop();
      if (lastMessageElement) {
        // Look backwards from the last message to find the date separator that applies to it
        let prevElement = lastMessageElement.previousElementSibling;
        while (prevElement) {
          const dateText = prevElement.querySelector('div[style*="text-transform: uppercase"]')?.textContent;
          if (dateText) {
            // Found the date separator that applies to the last message
            lastDateKey = getDateKeyFromElement(prevElement);
            break;
          }
          prevElement = prevElement.previousElementSibling;
        }
        // If no date separator found before the last message, check if there's one at the very beginning
        // This means all messages are from the same date (the first separator's date)
        if (!lastDateKey) {
          const firstElement = container.firstElementChild;
          if (firstElement) {
            const firstDateText = firstElement.querySelector('div[style*="text-transform: uppercase"]')?.textContent;
            if (firstDateText) {
              lastDateKey = getDateKeyFromElement(firstElement);
            }
          }
        }
      }
    }
    
    // Message ID generator function (All Chat messages always have IDs)
    const getMessageId = (msg) => msg.id || null;
    
    // Double-check displayed IDs right before processing (in case DOM changed)
    // This prevents duplicates if loadAllChatConversation is called multiple times concurrently
    const finalDisplayedIds = getDisplayedMessageIds(container);
    
    // Process messages using unified helper (handles date separators only on full rebuild)
    // filterSystemMessages = true for All Chat (system messages should NOT appear)
    const elementsToAppend = await processMessagesForChat(
      messages,
      messages,
      needsFullRebuild,
      finalDisplayedIds,
      container,
      getMessageId,
      needsFullRebuild ? lastDateKey : null,
      true // Filter system messages in All Chat
    );
    
    // Final safety check: verify no duplicates before appending (even during rebuild)
    // This prevents duplicates if loadAllChatConversation is called multiple times concurrently
    if (elementsToAppend.length > 0) {
      const existingIds = new Set(Array.from(container.querySelectorAll('[data-message-id]')).map(el => el.getAttribute('data-message-id')));
      
      // Filter out any elements that would create duplicates
      const filteredElements = [];
      const filteredMessageElements = [];
      let duplicateCount = 0;
      
      for (const el of elementsToAppend) {
        const msgId = el.getAttribute?.('data-message-id');
        if (!msgId) {
          // Keep non-message elements (date separators, etc.) for now
          filteredElements.push(el);
        } else if (existingIds.has(msgId)) {
          // Skip duplicate message
          duplicateCount++;
        } else {
          // Add new message
          filteredElements.push(el);
          filteredMessageElements.push(el);
          existingIds.add(msgId); // Track as we go to prevent duplicates within the batch
        }
      }
      
      if (duplicateCount > 0) {
        console.warn(`[VIP List] Preventing ${duplicateCount} duplicate message(s) before appending`);
        // If we found duplicates, it means messages were already added (race condition)
        // Only append if we have new messages, otherwise skip to avoid duplicates and orphaned date separators
        if (filteredMessageElements.length === 0) {
          // All messages were duplicates - don't append anything (including date separators)
          return;
        }
        
        // If we have messages but also have date separators, we need to clean up orphaned separators
        // Date separators should only appear before messages, so remove any trailing separators
        // Keep separators that appear before messages in filteredMessageElements
        const cleanedElements = [];
        let lastWasSeparator = false;
        for (let i = 0; i < filteredElements.length; i++) {
          const el = filteredElements[i];
          const isMessage = el.getAttribute?.('data-message-id');
          if (isMessage) {
            cleanedElements.push(el);
            lastWasSeparator = false;
          } else {
            // It's a date separator - only keep it if there's a message after it
            const hasMessageAfter = filteredElements.slice(i + 1).some(e => e.getAttribute?.('data-message-id'));
            if (hasMessageAfter) {
              cleanedElements.push(el);
              lastWasSeparator = true;
            }
          }
        }
        
        // Remove trailing separators
        while (cleanedElements.length > 0 && !cleanedElements[cleanedElements.length - 1].getAttribute?.('data-message-id')) {
          cleanedElements.pop();
        }
        
        // Replace elementsToAppend with cleaned version
        elementsToAppend.length = 0;
        elementsToAppend.push(...cleanedElements);
      }
    }
    
  
    // Final check: verify active chat type is still 'all-chat' before appending messages
    if (checkCancelled && checkCancelled()) {
      return;
    }
    if (abortController?.signal.aborted) {
      return;
    }
    if (!chatStateManager.isChatTypeActive('all-chat')) {
      return;
    }
  
    // Final duplicate check right before appending (catches race conditions)
    if (elementsToAppend.length > 0) {
      const currentDisplayedIds = new Set(Array.from(container.querySelectorAll('[data-message-id]')).map(el => el.getAttribute('data-message-id')));
      const elementsToAppendIds = elementsToAppend
        .map(el => el.getAttribute?.('data-message-id'))
        .filter(id => id);
      
      const hasDuplicates = elementsToAppendIds.some(id => currentDisplayedIds.has(id));
      if (hasDuplicates) {
        console.warn(`[VIP List] Detected duplicates right before appending - skipping to prevent duplicate messages`);
        // Update count and return without appending
        if (panel) {
          panel._previousMessageCount = currentDisplayedIds.size;
        }
        return;
      }
    }
    
    // Append elements using DocumentFragment (reduces flicker)
    appendElementsToContainer(container, elementsToAppend);
    
    // Final check: verify no system messages made it through
    const displayedMessages = Array.from(container.querySelectorAll('[data-message-id]'));
    const systemMessagesInDOM = displayedMessages.filter(el => isSystemMessageElement(el));
    if (systemMessagesInDOM.length > 0) {
      console.error(`[VIP List] ERROR: ${systemMessagesInDOM.length} system messages found in All Chat after loading!`);
    }
    
    // Update message count
    if (panel) {
      panel._previousMessageCount = displayedMessages.length;
    }
    
    // Handle scrolling
    handleChatScroll(panel, container, shouldScrollToBottom, needsFullRebuild);
  } finally {
    // Always clear loading flag and hide loading indicator
    if (panel) panel._isLoadingAllChat = false;
    // Hide loading indicator if we showed it (for polling updates)
    if (!wasLoadingIndicatorShown) {
      hideChatLoadingIndicator(container);
    }
  }
}

// Create a tab for all-chat panel - styled like game's native tabs
async function createAllChatTab(playerName, displayName, unreadCount = 0, isActive = false) {
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  tab.setAttribute('data-state', isActive ? 'active' : 'inactive');
  tab.setAttribute('tabindex', isActive ? '0' : '-1');
  tab.className = 'focus-style-visible console-frame-inactive pixel-font-16 surface-dark relative whitespace-nowrap text-center text-whiteRegular data-[state=active]:console-frame-active data-[state=active]:surface-regular data-[state=active]:text-whiteBrightest px-2.5';
  tab.dataset.playerName = playerName;
  tab.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    white-space: nowrap;
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.2);
    outline: none;
    height: 100%;
    align-self: stretch;
    min-width: 100px;
    flex-shrink: 0;
  `;
  
  const tabLabel = document.createElement('span');
  tabLabel.className = 'tab-player-name';
  tabLabel.textContent = displayName;
  
  // Set initial status color (only for player tabs, not "All Chat")
  // Note: We'll fetch player data after the tab is added to the DOM
  // For now, set default offline color
  if (playerName !== 'all-chat' && !playerName.startsWith('guild-') && !isActive) {
    tabLabel.style.color = CSS_CONSTANTS.COLORS.OFFLINE;
  }
  
  tab.appendChild(tabLabel);
  
  // Unread badge
  if (unreadCount > 0) {
    const badge = document.createElement('span');
    badge.className = 'tab-unread-badge';
    badge.textContent = formatBadgeCount(unreadCount);
    badge.style.cssText = `
      background: ${CSS_CONSTANTS.COLORS.ERROR};
      color: white;
      border-radius: 10px;
      padding: 1px 6px;
      font-size: 10px;
      font-weight: bold;
      min-width: 16px;
      text-align: center;
      margin-left: 4px;
    `;
    tab.appendChild(badge);
  }
  
  // Close button (only for player tabs, not "All Chat" or guild chat)
  if (playerName !== 'all-chat' && !playerName.startsWith('guild-')) {
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      margin-left: 4px;
      padding: 0 2px;
      font-size: 14px;
      opacity: 0.7;
      transition: opacity 0.2s;
      cursor: pointer;
    `;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      removeAllChatTab(playerName);
    });
    tab.appendChild(closeBtn);
  }
  
  // Click handler to switch tabs (button click is handled by the button itself)
  tab.addEventListener('click', (e) => {
    // Don't switch if clicking close button
    if (e.target.tagName === 'SPAN' && (e.target.textContent === '✕' || e.target.classList.contains('tab-unread-badge'))) {
      return;
    }
    switchAllChatTab(playerName);
  });
  
  return tab;
}

// Update actions column for player conversations
async function updateAllChatActionsColumn(playerName) {
  const panel = document.getElementById('vip-chat-panel-all-chat');
  if (!panel) return;
  
  const actionsColumn = panel.querySelector('#all-chat-actions-column');
  if (!actionsColumn) return;
  
  // Preserve toggle button before clearing
  const toggleBtn = actionsColumn.querySelector('#all-chat-actions-toggle');
  
  // Clear existing content (but preserve toggle button)
  const children = Array.from(actionsColumn.children);
  children.forEach(child => {
    if (child !== toggleBtn && child.parentNode === actionsColumn) {
      actionsColumn.removeChild(child);
    }
  });
  
  // Re-add toggle button at the end if it existed
  if (toggleBtn && actionsColumn.contains(toggleBtn) && toggleBtn.parentNode === actionsColumn) {
    actionsColumn.removeChild(toggleBtn);
    actionsColumn.appendChild(toggleBtn);
  } else if (toggleBtn && !actionsColumn.contains(toggleBtn)) {
    actionsColumn.appendChild(toggleBtn);
  }
  
  if (playerName === 'all-chat' || (playerName && playerName.startsWith('guild-'))) {
    // Hide column for all-chat and guild chat - completely hide it
    actionsColumn.style.display = 'none';
    // Update toggle button visibility immediately
    if (panel._updateToggleButtonVisibility) {
      panel._updateToggleButtonVisibility();
    }
    return;
  }
  
  // Show column for player conversations
  actionsColumn.style.display = 'flex';
  
  // Show column for player conversations (respect collapsed state)
  const isCollapsed = panel.dataset.actionsCollapsed === 'true';
  if (!isCollapsed) {
    actionsColumn.style.width = '170px';
    actionsColumn.style.padding = '8px';
    actionsColumn.style.borderLeft = '2px solid rgba(255, 255, 255, 0.1)';
    actionsColumn.style.overflow = 'visible';
  } else {
    actionsColumn.style.width = '0';
    actionsColumn.style.padding = '0';
    actionsColumn.style.borderLeft = 'none';
    actionsColumn.style.overflow = 'visible';
  }
  
  // Check player status
  const isBlocked = await isPlayerBlocked(playerName);
  const isInVIPList = isPlayerInVIPList(playerName);
  
  // Delete conversation button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = `🗑 ${t('mods.vipList.deleteHistory')}`;
  deleteBtn.style.cssText = createActionButtonStyle();
  setupActionButtonHandlers(deleteBtn, CSS_CONSTANTS.COLORS.ERROR);
  deleteBtn.addEventListener('click', async () => {
    const messagesArea = panel.querySelector('#chat-messages-all-chat');
    if (messagesArea) {
      showDeleteConfirmationForAllChat(panel, playerName, messagesArea);
    }
  });
  
  // Block/Unblock button
  const blockBtn = document.createElement('button');
  blockBtn.textContent = isBlocked ? `🔓 ${t('mods.vipList.unblockPlayer')}` : `🚫 ${t('mods.vipList.blockPlayer')}`;
  blockBtn.style.cssText = createActionButtonStyle();
  const blockBtnHoverColor = isBlocked ? CSS_CONSTANTS.COLORS.SUCCESS : CSS_CONSTANTS.COLORS.ERROR;
  setupActionButtonHandlers(blockBtn, blockBtnHoverColor);
  blockBtn.addEventListener('click', async () => {
    // Check current blocked status instead of using captured variable
    const currentlyBlocked = await isPlayerBlocked(playerName);
    
    if (currentlyBlocked) {
      const success = await unblockPlayer(playerName);
      if (success) {
        blockBtn.textContent = `🚫 ${t('mods.vipList.blockPlayer')}`;
        // Update hover styles
        blockBtn.onmouseenter = () => {
          blockBtn.style.color = CSS_CONSTANTS.COLORS.ERROR;
        };
        blockBtn.onmouseleave = () => {
          blockBtn.style.color = CSS_CONSTANTS.COLORS.TEXT_PRIMARY;
        };
        // Reload conversation and update UI (only if this player's tab is still active)
        const messagesArea = panel.querySelector('#chat-messages-all-chat');
        if (activeAllChatTab === playerName && messagesArea) {
          await loadConversation(playerName, messagesArea, true);
        }
        // Update actions column to reflect new state
        await updateAllChatActionsColumn(playerName);
        // Update chat panel UI
        const currentPlayer = getCurrentPlayerName();
        const recipientHasChatEnabled = await checkRecipientChatEnabled(playerName);
        const hasPrivilege = await hasChatPrivilege(currentPlayer, playerName);
        const hasIncomingRequest = false; // Could check if needed
        const hasOutgoingRequest = false; // Could check if needed
        const tempPanel = {
          querySelector: (selector) => {
            if (selector === 'button.primary') return panel.querySelector('button.primary');
            if (selector === '.vip-chat-input' || selector === 'textarea') return panel.querySelector('textarea');
            if (selector === `#chat-messages-${playerName.toLowerCase()}`) return messagesArea;
            return null;
          }
        };
        await updateChatPanelUI(tempPanel, playerName, recipientHasChatEnabled, hasPrivilege, hasIncomingRequest, hasOutgoingRequest);
      }
    } else {
      const success = await blockPlayer(playerName);
      if (success) {
        blockBtn.textContent = `🔓 ${t('mods.vipList.unblockPlayer')}`;
        // Update hover styles
        blockBtn.onmouseenter = () => {
          blockBtn.style.color = CSS_CONSTANTS.COLORS.SUCCESS;
        };
        blockBtn.onmouseleave = () => {
          blockBtn.style.color = CSS_CONSTANTS.COLORS.TEXT_PRIMARY;
        };
        // Reload conversation and update UI (only if this player's tab is still active)
        const messagesArea = panel.querySelector('#chat-messages-all-chat');
        if (activeAllChatTab === playerName && messagesArea) {
          await loadConversation(playerName, messagesArea, true);
        }
        // Update actions column to reflect new state
        await updateAllChatActionsColumn(playerName);
        // Update chat panel UI
        const currentPlayer = getCurrentPlayerName();
        const recipientHasChatEnabled = await checkRecipientChatEnabled(playerName);
        const hasPrivilege = await hasChatPrivilege(currentPlayer, playerName);
        const hasIncomingRequest = false; // Could check if needed
        const hasOutgoingRequest = false; // Could check if needed
        const tempPanel = {
          querySelector: (selector) => {
            if (selector === 'button.primary') return panel.querySelector('button.primary');
            if (selector === '.vip-chat-input' || selector === 'textarea') return panel.querySelector('textarea');
            if (selector === `#chat-messages-${playerName.toLowerCase()}`) return messagesArea;
            return null;
          }
        };
        await updateChatPanelUI(tempPanel, playerName, recipientHasChatEnabled, hasPrivilege, hasIncomingRequest, hasOutgoingRequest);
      }
    }
  });
  
  // Add/Remove VIP button
  const vipBtn = document.createElement('button');
  vipBtn.textContent = isInVIPList ? `⭐ ${t('mods.vipList.inVIPList')}` : `☆ ${t('mods.vipList.addToVIP')}`;
  const vipBtnColor = isInVIPList ? CSS_CONSTANTS.COLORS.SUCCESS : CSS_CONSTANTS.COLORS.TEXT_PRIMARY;
  vipBtn.style.cssText = createActionButtonStyle(vipBtnColor) + `cursor: ${isInVIPList ? 'default' : 'pointer'}; opacity: ${isInVIPList ? '0.6' : '1'};`;
  if (!isInVIPList) {
    setupActionButtonHandlers(vipBtn, CSS_CONSTANTS.COLORS.LINK);
    vipBtn.addEventListener('click', async () => {
      vipBtn.disabled = true;
      vipBtn.style.opacity = '0.6';
      try {
        const profileData = await fetchPlayerData(playerName);
        if (profileData) {
          const playerInfo = extractPlayerInfoFromProfile(profileData, playerName);
          playerInfo.profile = profileData.name?.toLowerCase() || playerName.toLowerCase();
          addToVIPList(playerName, playerInfo);
          await refreshVIPListDisplay();
          vipBtn.textContent = `⭐ ${t('mods.vipList.inVIPList')}`;
          vipBtn.style.color = CSS_CONSTANTS.COLORS.SUCCESS;
          vipBtn.style.cursor = 'default';
          vipBtn.style.opacity = '0.6';
        }
      } catch (error) {
        console.error('[VIP List] Error adding player to VIP list:', error);
        vipBtn.disabled = false;
        vipBtn.style.opacity = '1';
      }
    });
  }
  
  // Show runs only button
  const runsOnlyBtn = document.createElement('button');
  const filterKey = `runsOnlyFilter_${playerName.toLowerCase()}`;
  const dataAttrName = `data-${filterKey}`;
  const isRunsOnlyActive = panel.getAttribute(dataAttrName) === 'true';
  runsOnlyBtn.textContent = `🎮 ${t('mods.vipList.showRunsOnly') || 'Show Runs Only'}`;
  
  // Update button visual state function
  const updateButtonState = (isActive) => {
    if (isActive) {
      runsOnlyBtn.style.color = CSS_CONSTANTS.COLORS.LINK;
      runsOnlyBtn.style.borderImage = CSS_CONSTANTS.BORDER_1_FRAME_PRESSED;
    } else {
      runsOnlyBtn.style.color = CSS_CONSTANTS.COLORS.TEXT_PRIMARY;
      runsOnlyBtn.style.borderImage = CSS_CONSTANTS.BORDER_1_FRAME;
    }
  };
  
  runsOnlyBtn.style.cssText = createActionButtonStyle();
  updateButtonState(isRunsOnlyActive);
  
  runsOnlyBtn.addEventListener('mouseenter', () => {
    const currentState = panel.getAttribute(dataAttrName) === 'true';
    if (!currentState) {
      runsOnlyBtn.style.color = CSS_CONSTANTS.COLORS.LINK;
    }
  });
  runsOnlyBtn.addEventListener('mouseleave', () => {
    updateButtonState(panel.getAttribute(dataAttrName) === 'true');
  });
  runsOnlyBtn.addEventListener('mousedown', () => {
    runsOnlyBtn.style.borderImage = CSS_CONSTANTS.BORDER_1_FRAME_PRESSED;
  });
  runsOnlyBtn.addEventListener('mouseup', () => {
    updateButtonState(panel.getAttribute(dataAttrName) === 'true');
  });
  runsOnlyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const filterKey = `runsOnlyFilter_${playerName.toLowerCase()}`;
    const dataAttrName = `data-${filterKey}`;
    const isActive = panel.getAttribute(dataAttrName) === 'true';
    const newState = !isActive;
    panel.setAttribute(dataAttrName, newState ? 'true' : 'false');
    updateButtonState(newState);
    
    // Reload conversation with filter applied - force refresh to get all messages
    // For all-chat panel, use #chat-messages-all-chat, for regular panels use player-specific selector
    const messagesArea = panel.id === 'vip-chat-panel-all-chat' 
      ? panel.querySelector('#chat-messages-all-chat')
      : panel.querySelector(`#chat-messages-${playerName.toLowerCase()}`);
    if (messagesArea && playerName !== 'all-chat') {
      // Show "Fetching runs..." indicator when filtering is enabled
      if (newState) {
        showFetchingRunsIndicator(messagesArea);
      }
      try {
        await loadConversation(playerName, messagesArea, false, true); // forceRefresh = true to fetch all messages
      } finally {
        // Always hide indicator when done
        hideFetchingRunsIndicator(messagesArea);
      }
    }
  });
  
  actionsColumn.appendChild(deleteBtn);
  actionsColumn.appendChild(blockBtn);
  actionsColumn.appendChild(vipBtn);
  actionsColumn.appendChild(runsOnlyBtn);
  
  // Update toggle button visibility
  if (panel._updateToggleButtonVisibility) {
    setTimeout(() => panel._updateToggleButtonVisibility(), 50);
  }
}

// Show delete confirmation for all-chat panel
function showDeleteConfirmationForAllChat(panel, otherPlayer, messagesArea) {
  // Check if confirmation already exists
  const existingConfirmation = messagesArea.querySelector('.delete-confirmation');
  if (existingConfirmation) {
    existingConfirmation.remove();
  }
  
  // Create confirmation message
  const confirmation = document.createElement('div');
  confirmation.className = 'delete-confirmation';
  confirmation.style.cssText = `
    padding: 16px;
    margin: 8px;
    background: rgba(255, 107, 107, 0.2);
    border: 2px solid ${CSS_CONSTANTS.COLORS.ERROR};
    border-radius: 4px;
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    text-align: center;
    font-size: 12px;
    line-height: 1.4;
  `;
  
  confirmation.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px; color: ${CSS_CONSTANTS.COLORS.ERROR};">
      ${t('mods.vipList.deleteConversationTitle')}
    </div>
    <div style="margin-bottom: 12px;">
      ${tReplace('mods.vipList.deleteConversationMessage', { name: otherPlayer })}
    </div>
    <div style="display: flex; gap: 8px; justify-content: center;">
      <button class="confirm-delete-btn" style="
        padding: 6px 16px;
        background: ${CSS_CONSTANTS.COLORS.ERROR};
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
      ">${t('mods.vipList.delete')}</button>
      <button class="cancel-delete-btn" style="
        padding: 6px 16px;
        background: rgba(255, 255, 255, 0.1);
        color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
      ">${t('mods.vipList.cancelButton')}</button>
    </div>
  `;
  
  const confirmBtn = confirmation.querySelector('.confirm-delete-btn');
  const cancelBtn = confirmation.querySelector('.cancel-delete-btn');
  
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    const success = await deleteConversation(otherPlayer);
    if (success) {
      confirmation.remove();
      // Clear messages area completely
      messagesArea.innerHTML = '';
      // Reload conversation (will be empty, force refresh to ensure clean state)
      await loadConversation(otherPlayer, messagesArea, false, true);
    } else {
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });
  
  cancelBtn.addEventListener('click', () => {
    confirmation.remove();
  });
  
  messagesArea.appendChild(confirmation);
  // Scroll to bottom to show confirmation
  if (panel) {
    scrollChatToBottom(panel);
  } else {
    // Fallback if panel not found
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }
}

// Scroll chat messages to bottom (works with both scroll container and regular div)
function scrollChatToBottom(panel) {
  if (!panel) return;
  
  // Use requestAnimationFrame for smoother scrolling
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Check if panel has scroll container reference
      if (panel._scrollContainer && panel._scrollContainer.scrollView) {
        // Use scroll container's scrollView
        const scrollView = panel._scrollContainer.scrollView;
        scrollView.scrollTop = scrollView.scrollHeight;
        return;
      }
      
      // Fallback: look for scroll-view element
      const contentWrapper = panel.querySelector('#all-chat-content-wrapper');
      if (contentWrapper) {
        const scrollView = contentWrapper.querySelector('.scroll-view');
        if (scrollView) {
          scrollView.scrollTop = scrollView.scrollHeight;
          return;
        }
      }
      
      // Final fallback: direct scrolling on messagesArea
      const messagesArea = panel.querySelector('#chat-messages-all-chat');
      if (messagesArea && messagesArea.scrollHeight !== undefined) {
        messagesArea.scrollTop = messagesArea.scrollHeight;
      }
    });
  });
}

// Show loading indicator in messages area
function showChatLoadingIndicator(container) {
  // Remove existing loading indicator if any
  const existing = container.querySelector('.chat-loading-indicator');
  if (existing) {
    existing.remove();
  }
  
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-loading-indicator';
  loadingDiv.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    gap: 12px;
  `;
  
  // Create spinning loader
  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 24px;
    height: 24px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  `;
  
  // Add keyframes animation if not already added
  // Inject styles (consolidated)
  injectVIPListStyles();
  
  const text = document.createElement('span');
  text.textContent = 'Loading messages...';
  
  loadingDiv.appendChild(spinner);
  loadingDiv.appendChild(text);
  container.appendChild(loadingDiv);
  
  return loadingDiv;
}

// Hide loading indicator
function hideChatLoadingIndicator(container) {
  const loading = container.querySelector('.chat-loading-indicator');
  if (loading) {
    loading.remove();
  }
}

// Show "Fetching runs..." loading indicator
function showFetchingRunsIndicator(container) {
  // Remove existing indicator if any
  const existing = container.querySelector('.fetching-runs-indicator');
  if (existing) {
    return existing;
  }
  
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'fetching-runs-indicator';
  loadingDiv.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    gap: 12px;
  `;
  
  // Create spinning loader
  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 24px;
    height: 24px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  `;
  
  // Add keyframes animation if not already added
  // Inject styles (consolidated)
  injectVIPListStyles();
  
  const text = document.createElement('span');
  text.textContent = 'Fetching runs...';
  
  loadingDiv.appendChild(spinner);
  loadingDiv.appendChild(text);
  container.appendChild(loadingDiv);
  
  return loadingDiv;
}

// Hide "Fetching runs..." indicator
function hideFetchingRunsIndicator(container) {
  const loading = container.querySelector('.fetching-runs-indicator');
  if (loading) {
    loading.remove();
  }
}

// Switch active tab in all-chat panel
async function switchAllChatTab(playerName) {
  const panel = document.getElementById('vip-chat-panel-all-chat');
  if (!panel) return;
  
  const messagesArea = panel.querySelector('#chat-messages-all-chat');
  if (!messagesArea) return;
  
  // Validate tab name (prevent switching to encrypted/invalid tab names)
  if (!isValidTabName(playerName)) {
    console.warn('[VIP List] Attempted to switch to invalid tab name (likely encrypted):', playerName);
    // Fallback to 'all-chat' if it exists, otherwise do nothing
    if (allChatTabs.has('all-chat')) {
      playerName = 'all-chat';
    } else {
      return;
    }
  }
  
  // Ensure tab exists before switching
  if (!allChatTabs.has(playerName)) {
    console.warn('[VIP List] Attempted to switch to non-existent tab:', playerName);
    // Fallback to 'all-chat' if it exists, otherwise do nothing
    if (allChatTabs.has('all-chat')) {
      playerName = 'all-chat';
    } else {
      return;
    }
  }
  
  // If a tab switch is already in progress, cancel it and reset all state
  if (currentTabSwitchPromise) {
    // Abort any ongoing fetch operations
    if (panel._abortController) {
      panel._abortController.abort();
      panel._abortController = null;
    }
    
    // Cancel previous tab switch by resetting all state
    panel._isLoadingAllChat = false;
    panel._isLoadingOlderAllChat = false;
    panel._previousMessageCount = 0;
    panel._lastTimestamp = null;
    panel._lastMessageCount = null;
    panel._lastRunsOnlyFilter = false;
    
    // Reset guild chat loading flags
    for (const key of Object.keys(panel)) {
      if (key.startsWith('_isLoadingGuildChat_')) {
        panel[key] = false;
      }
    }
    
    // Hide any loading indicator
    hideChatLoadingIndicator(messagesArea);
    
    // Clear any pending operations
    currentTabSwitchPromise = null;
  }
  
  // Track this tab switch
  const switchPromise = (async () => {
    // Update active chat type using state manager BEFORE clearing container
    // This creates a new AbortController and aborts any previous operations
    chatStateManager.setActiveChatType(playerName);
    const abortController = chatStateManager.getAbortController();
    panel._abortController = abortController;
    
    // Update tab styles to match game's native tab styling
    allChatTabs.forEach((tab, name) => {
      const isActive = name === playerName;
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.setAttribute('data-state', isActive ? 'active' : 'inactive');
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
      
      // Update classes to match active/inactive state
      if (isActive) {
        tab.classList.remove('console-frame-inactive', 'surface-dark', 'text-whiteRegular');
        tab.classList.add('console-frame-active', 'surface-regular', 'text-whiteBrightest');
        
        // Clear status color when active (let game classes control it)
        const tabLabel = tab.querySelector('.tab-player-name');
        if (tabLabel) {
          tabLabel.style.color = '';
        }
      } else {
        tab.classList.remove('console-frame-active', 'surface-regular', 'text-whiteBrightest');
        tab.classList.add('console-frame-inactive', 'surface-dark', 'text-whiteRegular');
        
        // Restore status color when inactive (if it's a player tab)
        if (name !== 'all-chat') {
          updateAllChatTabStatus(name);
        }
      }
    });
    
    // Don't reset runs-only filter when switching tabs - preserve per-player filter state
    // The filter state is stored per player and will be applied when loading the conversation
    
    // Update actions column
    await updateAllChatActionsColumn(playerName);
    
    // Clear messages area and reset ALL loading/preservation state when switching tabs
    // This ensures old content from the previous tab doesn't remain visible
    messagesArea.innerHTML = '';
    if (panel) {
      // Reset all loading and preservation flags
      panel._isLoadingAllChat = false;
      panel._isLoadingOlderAllChat = false;
      panel._previousMessageCount = 0;
      panel._lastTimestamp = null;
      panel._lastMessageCount = null;
      panel._lastRunsOnlyFilter = false;
      panel._oldestLoadedMessageId = null;
    }
    
    // Show loading indicator
    showChatLoadingIndicator(messagesArea);
    
    try {
      // Check if this switch was cancelled (user clicked another tab)
      const checkCancelled = () => {
        if (currentTabSwitchPromise !== switchPromise) return true;
        if (abortController.signal.aborted) return true;
        if (!chatStateManager.isChatTypeActive(playerName)) return true;
        return false;
      };
      
      // Load appropriate conversation
      // Always scroll to bottom when switching tabs
      if (playerName === 'all-chat') {
        // Always fetch fresh from Firebase (no cache)
        await loadAllChatConversation(messagesArea, true, true, checkCancelled, abortController);
        
        // Final verification: check for system messages
        const finalMessages = messagesArea.querySelectorAll('[data-message-id]');
        const finalSystemMessages = Array.from(finalMessages).filter(el => isSystemMessageElement(el));
        if (finalSystemMessages.length > 0) {
          console.error(`[VIP List] ERROR: ${finalSystemMessages.length} system messages found in All Chat after loading!`);
        }
        if (checkCancelled()) return; // Abort if cancelled
        // Verify active chat type still matches loaded messages
        if (!chatStateManager.isChatTypeActive(playerName)) {
          messagesArea.innerHTML = '';
          return;
        }
        // Scroll is handled inside loadAllChatConversation when forceScrollToBottom = true
      } else if (playerName.startsWith('guild-')) {
        // Guild chat tab
        const guildId = playerName.replace('guild-', '');
        await loadGuildChatConversation(messagesArea, guildId, true, checkCancelled, abortController); // Force scroll to bottom, pass cancellation check and abort controller
        if (checkCancelled()) return; // Abort if cancelled
        // Verify active chat type still matches loaded messages
        if (!chatStateManager.isChatTypeActive(playerName)) {
          messagesArea.innerHTML = '';
          return;
        }
        // Scroll is handled inside loadGuildChatConversation when forceScrollToBottom = true
      } else {
        // Load conversation FIRST so user sees messages immediately
        // Use cache when switching tabs for faster loading (5s cache is fresh)
        // Always scroll to bottom when switching tabs
        await loadConversation(playerName, messagesArea, true, false); // Force scroll to bottom, use cache
        if (checkCancelled()) return; // Abort if cancelled
        // Verify active chat type still matches loaded messages
        if (!chatStateManager.isChatTypeActive(playerName)) {
          messagesArea.innerHTML = '';
          return;
        }
        // Scroll is handled inside loadConversation when forceScrollToBottom = true
        
        // Clear unread badge on tab immediately (optimistic update)
        updateAllChatTabUnread(playerName, 0);
        updateVIPListChatIcon(playerName, 0);
        
        // Check if cancelled before continuing
        if (checkCancelled()) return;
        
        // Run all other operations in parallel (non-blocking for UI)
        const currentPlayer = getCurrentPlayerName();
        
        // Start all async operations in parallel
        const [
          recipientHasChatEnabled,
          hasPrivilege,
          incomingRequests
        ] = await Promise.all([
          checkRecipientChatEnabled(playerName),
          hasChatPrivilege(currentPlayer, playerName),
          checkForChatRequests()
        ]);
        
        // Check if cancelled after async operations
        if (checkCancelled()) return;
        
        const hasIncomingRequest = incomingRequests.some(req => req.from && req.from.toLowerCase() === playerName.toLowerCase());
        
        // Check for outgoing request (only if needed)
        let hasOutgoingRequest = false;
        if (!hasPrivilege && !hasIncomingRequest) {
          try {
            const hashedPlayerName = await hashUsername(playerName);
            let recipientRequestsResponse = await fetch(`${getChatRequestsApiUrl()}/${hashedPlayerName}.json`);
            if (!recipientRequestsResponse.ok && recipientRequestsResponse.status === 404) {
              recipientRequestsResponse = await fetch(`${getChatRequestsApiUrl()}/${playerName.toLowerCase()}.json`);
            }
            if (recipientRequestsResponse.ok) {
              const recipientRequests = await recipientRequestsResponse.json();
              if (recipientRequests && typeof recipientRequests === 'object') {
                const currentPlayerHash = await hashUsername(currentPlayer);
                hasOutgoingRequest = await Promise.all(
                  Object.values(recipientRequests).map(async (req) => {
                    if (!req || req.status !== 'pending') return false;
                    if (req.usernamesEncrypted && req.from && req.fromHash) {
                      if (req.fromHash === currentPlayerHash) {
                        try {
                          const decryptedFrom = await decryptUsername(req.from, currentPlayer, playerName);
                          return decryptedFrom && decryptedFrom.toLowerCase() === currentPlayer.toLowerCase();
                        } catch (error) {
                          return true;
                        }
                      }
                      return false;
                    } else {
                      return req.from && req.from.toLowerCase() === currentPlayer.toLowerCase();
                    }
                  })
                ).then(results => results.some(result => result === true));
              }
            }
          } catch (error) {
            // Ignore errors
          }
        }
        
        // Create a temporary panel-like object for updateChatPanelUI
        const tempPanel = {
          querySelector: (selector) => {
            if (selector === 'button.primary') {
              return panel.querySelector('button.primary');
            }
            if (selector === '.vip-chat-input' || selector === 'textarea') {
              return panel.querySelector('textarea');
            }
            if (selector === `#chat-messages-${playerName.toLowerCase()}`) {
              return messagesArea;
            }
            return null;
          }
        };
        
        await updateChatPanelUI(tempPanel, playerName, recipientHasChatEnabled, hasPrivilege, hasIncomingRequest, hasOutgoingRequest);
        
        // Check if cancelled before marking as read
        if (checkCancelled()) return;
        
        // Mark messages as read in the background (non-blocking, don't wait for it)
        markAllMessagesAsReadFromPlayer(playerName).catch(error => {
          console.warn('[VIP List] Error marking messages as read:', error);
        });
        
        // Update input placeholder and state
        const textarea = panel.querySelector('textarea');
        const sendButton = panel.querySelector('button.primary');
        if (textarea) {
          const recipientHasChatEnabled2 = await checkRecipientChatEnabled(playerName);
          const hasPrivilege2 = await hasChatPrivilege(getCurrentPlayerName(), playerName);
          const isBlocked = await isPlayerBlocked(playerName);
          const isBlockedBy = await isBlockedByPlayer(playerName);
          const canChat = recipientHasChatEnabled2 && hasPrivilege2 && !isBlocked && !isBlockedBy;
          textarea.placeholder = canChat ? tReplace('mods.vipList.chatPlaceholder', { name: playerName }) : tReplace('mods.vipList.messagePlaceholder', { name: playerName });
          textarea.disabled = !canChat;
          if (sendButton) sendButton.disabled = !canChat;
        }
      }
      
      // Update input placeholder for all-chat and guild tabs
      if (playerName === 'all-chat' || playerName.startsWith('guild-')) {
        if (checkCancelled()) return; // Abort if cancelled
        
        const textarea = panel.querySelector('textarea');
        const sendButton = panel.querySelector('button.primary');
        if (textarea) {
          if (playerName === 'all-chat') {
            const canChat = await checkRecipientChatEnabled(getCurrentPlayerName());
            textarea.placeholder = canChat ? t('mods.vipList.allChatPlaceholder') : t('mods.vipList.enableChatPlaceholder');
            textarea.disabled = !canChat;
            if (sendButton) sendButton.disabled = !canChat;
          } else if (playerName.startsWith('guild-')) {
            // Guild chat - always enabled
            textarea.placeholder = 'Type a message...';
            textarea.disabled = false;
            if (sendButton) sendButton.disabled = false;
          }
        }
      }
    } finally {
      // Hide loading indicator when done (whether successful or error)
      hideChatLoadingIndicator(messagesArea);
      
      // Clear switch promise and abort controller when done
      if (currentTabSwitchPromise === switchPromise) {
        currentTabSwitchPromise = null;
        if (panel._abortController === abortController) {
          panel._abortController = null;
        }
      }
      
      // Prefetch conversations for other open tabs (background caching)
      // This makes switching to those tabs instant
      const otherTabs = Array.from(allChatTabs.keys()).filter(name => name !== playerName && !name.startsWith('guild-'));
      if (otherTabs.length > 0) {
        // Prefetch in background (don't wait)
        Promise.all(
          otherTabs.slice(0, 3).map(async (tabName) => {
            try {
              // Prefetch conversation (will be cached)
              await getConversationMessages(tabName, false);
            } catch (error) {
              // Silently fail - just for prefetching
            }
          })
        ).catch(() => {}); // Ignore errors in background prefetch
      }
    }
    
    // Save panel settings when active tab changes
    const chatPanel = document.getElementById('vip-chat-panel-all-chat');
    if (chatPanel && chatPanel.style.display !== 'none') {
      saveChatPanelSettings(true, false);
    }
  })();
  
  // Store the promise so we can check if it's still the current switch
  currentTabSwitchPromise = switchPromise;
  
  // Wait for this switch to complete (but allow it to be cancelled if user clicks another tab)
  await switchPromise;
}

// Add a tab to all-chat panel
async function addAllChatTab(playerName, displayName, unreadCount = 0) {
  const panel = document.getElementById('vip-chat-panel-all-chat');
  if (!panel) return;
  
  const headerContainer = panel.querySelector('#all-chat-tabs-container');
  if (!headerContainer) return;
  
  // Find the tabs container inside the header (it's the first child div)
  const tabsContainer = headerContainer.querySelector('div:first-child');
  if (!tabsContainer) return;
  
  // Check if tab already exists
  if (allChatTabs.has(playerName)) {
    updateAllChatTabUnread(playerName, unreadCount);
    // Update status color for existing tab
    await updateAllChatTabStatus(playerName);
    return;
  }
  
  // Create tab
  const tab = await createAllChatTab(playerName, displayName, unreadCount, false);
  
  // Determine insertion position based on tab type
  if (playerName === 'all-chat') {
    // All Chat goes first
    tabsContainer.insertBefore(tab, tabsContainer.firstChild);
  } else if (playerName.startsWith('guild-')) {
    // Guild chat goes after All Chat
    const allChatTab = tabsContainer.querySelector('[data-player-name="all-chat"]');
    if (allChatTab && allChatTab.nextSibling) {
      tabsContainer.insertBefore(tab, allChatTab.nextSibling);
    } else if (allChatTab) {
      tabsContainer.appendChild(tab);
    } else {
      // No All Chat tab, just append
      tabsContainer.appendChild(tab);
    }
  } else {
    // Player tabs go after All Chat and guild chat
    const allChatTab = tabsContainer.querySelector('[data-player-name="all-chat"]');
    const guildTab = Array.from(tabsContainer.children).find(child => {
      const name = child.getAttribute('data-player-name');
      return name && name.startsWith('guild-');
    });
    
    // Insert after guild tab if exists, otherwise after All Chat, otherwise append
    if (guildTab && guildTab.nextSibling) {
      tabsContainer.insertBefore(tab, guildTab.nextSibling);
    } else if (guildTab) {
      tabsContainer.appendChild(tab);
    } else if (allChatTab && allChatTab.nextSibling) {
      tabsContainer.insertBefore(tab, allChatTab.nextSibling);
    } else if (allChatTab) {
      tabsContainer.appendChild(tab);
    } else {
      tabsContainer.appendChild(tab);
    }
  }
  
  // Verify tab was actually added to the DOM before adding to Map
  if (!document.contains(tab)) {
    // Tab wasn't added, don't track it
    return;
  }
  
  allChatTabs.set(playerName, tab);
  
  // Don't fetch player data immediately - it will be batched and rate-limited
  // Status updates will be handled by updateAllChatTabsStatus() which is called
  // after all tabs are added (e.g., in openAllChatPanel)
  
  // Save panel settings when tabs change
  if (panel && panel.style.display !== 'none') {
    saveChatPanelSettings(true, false);
  }
}

// Clean up tabs that no longer exist in the DOM
function cleanupOrphanedChatTabs() {
  const orphanedTabs = [];
  
  for (const [playerName, tab] of allChatTabs.entries()) {
    // Skip if tab is still in the DOM
    if (document.contains(tab)) continue;
    
    // Tab is orphaned - mark for removal
    orphanedTabs.push(playerName);
  }
  
  // Remove orphaned tabs from Map
  for (const playerName of orphanedTabs) {
    allChatTabs.delete(playerName);
    
    // If this was the active tab, clear it
    if (activeAllChatTab === playerName) {
      activeAllChatTab = null;
    }
  }
  
  return orphanedTabs.length;
}

// Remove a tab from all-chat panel
function removeAllChatTab(playerName) {
  if (playerName === 'all-chat') return; // Can't remove "All Chat" tab
  if (playerName && playerName.startsWith('guild-')) return; // Can't remove guild chat tab (use removeGuildChatTab instead)
  
  const tab = allChatTabs.get(playerName);
  if (!tab) return;
  
  tab.remove();
  allChatTabs.delete(playerName);
  
  // Save panel settings when tabs change
  const chatPanel = document.getElementById('vip-chat-panel-all-chat');
  if (chatPanel && chatPanel.style.display !== 'none') {
    saveChatPanelSettings(true, false);
  }
  
  // If this was the active tab, switch to another tab
  if (activeAllChatTab === playerName) {
    // Try to switch to All Chat if it exists, otherwise guild chat, otherwise first available tab
    if (allChatTabs.has('all-chat')) {
      switchAllChatTab('all-chat');
    } else {
      // Try to find guild chat tab
      const guildTab = Array.from(allChatTabs.keys()).find(name => name.startsWith('guild-'));
      if (guildTab) {
        switchAllChatTab(guildTab);
      } else if (allChatTabs.size > 0) {
        // Switch to first available tab
        const firstTab = allChatTabs.keys().next().value;
        if (firstTab) {
          switchAllChatTab(firstTab);
        } else {
          // No tabs left, clear the messages area
          activeAllChatTab = null;
          const panel = document.getElementById('vip-chat-panel-all-chat');
          if (panel) {
            const messagesArea = panel.querySelector('#chat-messages-all-chat');
            if (messagesArea) {
              messagesArea.innerHTML = '';
            }
          }
        }
      } else {
        // No tabs left, clear the messages area
        activeAllChatTab = null;
        const panel = document.getElementById('vip-chat-panel-all-chat');
        if (panel) {
          const messagesArea = panel.querySelector('#chat-messages-all-chat');
          if (messagesArea) {
            messagesArea.innerHTML = '';
          }
        }
      }
    }
  }
}

// Remove guild chat tab (called when player leaves or is kicked from guild)
function removeGuildChatTab(guildId) {
  const tabName = `guild-${guildId}`;
  const tab = allChatTabs.get(tabName);
  if (!tab) return;
  
  tab.remove();
  allChatTabs.delete(tabName);
  
  // Save panel settings when tabs change
  const chatPanel = document.getElementById('vip-chat-panel-all-chat');
  if (chatPanel && chatPanel.style.display !== 'none') {
    saveChatPanelSettings(true, false);
  }
  
  // If this was the active tab, switch to another tab
  if (activeAllChatTab === tabName) {
    // Try to switch to All Chat if it exists, otherwise first available tab
    if (allChatTabs.has('all-chat')) {
      switchAllChatTab('all-chat');
    } else if (allChatTabs.size > 0) {
      // Switch to first available tab
      const firstTab = allChatTabs.keys().next().value;
      if (firstTab) {
        switchAllChatTab(firstTab);
      } else {
        // No tabs left, clear the messages area
        activeAllChatTab = null;
        if (chatPanel) {
          const messagesArea = chatPanel.querySelector('#chat-messages-all-chat');
          if (messagesArea) {
            messagesArea.innerHTML = '';
          }
        }
      }
    } else {
      // No tabs left, clear the messages area
      activeAllChatTab = null;
      if (chatPanel) {
        const messagesArea = chatPanel.querySelector('#chat-messages-all-chat');
        if (messagesArea) {
          messagesArea.innerHTML = '';
        }
      }
    }
  }
}

// Expose functions globally for other mods (e.g., Guilds mod)
if (typeof window !== 'undefined') {
  window.removeGuildChatTab = removeGuildChatTab;
  window.syncGuildChatTab = syncGuildChatTab;
}

// Update status color for a tab
async function updateAllChatTabStatus(playerName) {
  if (playerName === 'all-chat') return;
  if (playerName && playerName.startsWith('guild-')) return; // Guild chat tabs don't need status updates
  
  const tab = allChatTabs.get(playerName);
  if (!tab) return;
  
  // Verify tab is still in the DOM
  if (!document.contains(tab)) {
    allChatTabs.delete(playerName);
    return;
  }
  
  const tabLabel = tab.querySelector('.tab-player-name');
  if (!tabLabel) return;
  
  // Check if tab is active - if so, don't override text color (game classes control it)
  const isActive = tab.getAttribute('data-state') === 'active';
  
  try {
    const profileData = await fetchPlayerData(playerName);
    if (profileData && profileData.name) {
      const isCurrentPlayer = getCurrentPlayerName() && (profileData.name || playerName).toLowerCase() === getCurrentPlayerName().toLowerCase();
      const status = calculatePlayerStatus(profileData, isCurrentPlayer);
      const statusColor = getStatusColor(status);
      // Only apply status color when tab is inactive
      if (!isActive) {
        tabLabel.style.color = statusColor;
      } else {
        tabLabel.style.color = ''; // Let game classes control color when active
      }
    } else {
      // Player doesn't exist (no profile data or no name) - silently remove the tab
      removeAllChatTab(playerName);
      return;
    }
  } catch (error) {
    // Check if error is 404 (player doesn't exist)
    if (error.message && error.message.includes('HTTP 404')) {
      // Player doesn't exist - silently remove the tab
      removeAllChatTab(playerName);
      return;
    }
    
    // For rate limiting (429) or other errors, keep the tab but show offline
    // Don't remove tabs for rate limiting - player might exist, just can't fetch now
    if (!isActive) {
      tabLabel.style.color = CSS_CONSTANTS.COLORS.OFFLINE;
    } else {
      tabLabel.style.color = '';
    }
  }
}

// Update status colors for all open tabs with rate limiting
async function updateAllChatTabsStatus() {
  // Clean up orphaned tabs first
  cleanupOrphanedChatTabs();
  
  // Filter out tabs that no longer exist in the DOM
  const validPlayerNames = Array.from(allChatTabs.keys())
    .filter(name => {
      if (name === 'all-chat' || name.startsWith('guild-')) return false;
      const tab = allChatTabs.get(name);
      if (!tab || !document.contains(tab)) {
        allChatTabs.delete(name);
        return false;
      }
      return true;
    });
  
  if (validPlayerNames.length === 0) return;
  
  // Process in batches with delays to avoid rate limiting
  const BATCH_SIZE = 5;
  const BATCH_DELAY = 500; // 500ms between batches
  
  for (let i = 0; i < validPlayerNames.length; i += BATCH_SIZE) {
    const batch = validPlayerNames.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(playerName => updateAllChatTabStatus(playerName)));
    
    // Add delay between batches (except for the last batch)
    if (i + BATCH_SIZE < validPlayerNames.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }
}

// Update chat icon indicator in VIP list
function updateVIPListChatIcon(playerName, unreadCount) {
  const playerKey = playerName.toLowerCase();
  const vipItem = vipListItems.get(playerKey);
  if (!vipItem || !vipItem.chatIcon) return;
  
  if (unreadCount > 0) {
    // Check if chat panel is open for this player - if so, don't show icon
    const panel = openChatPanels.get(playerKey);
    if (!panel) {
      vipItem.chatIcon.style.display = 'block';
    } else {
      vipItem.chatIcon.style.display = 'none';
    }
  } else {
    vipItem.chatIcon.style.display = 'none';
  }
}

// Update unread count for a tab
function updateAllChatTabUnread(playerName, unreadCount) {
  const tab = allChatTabs.get(playerName);
  if (!tab) return;
  
  let badge = tab.querySelector('.tab-unread-badge');
  
  if (unreadCount > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'tab-unread-badge';
      badge.style.cssText = `
        background: ${CSS_CONSTANTS.COLORS.ERROR};
        color: white;
        border-radius: 10px;
        padding: 1px 6px;
        font-size: 10px;
        font-weight: bold;
        min-width: 16px;
        text-align: center;
      `;
      // Insert before close button if exists, otherwise append
      const closeBtn = tab.querySelector('span:last-child');
      if (closeBtn && closeBtn.textContent === '✕') {
        tab.insertBefore(badge, closeBtn);
      } else {
        tab.appendChild(badge);
      }
    }
    badge.textContent = formatBadgeCount(unreadCount);
    badge.style.display = 'inline-block';
  } else if (badge) {
    badge.remove();
  }
}

// Open All Chat panel
async function openAllChatPanel() {
  // Allow opening panel for private chats even if Global Chat is disabled
  // Only check messaging enabled, not Global Chat
  if (!MESSAGING_CONFIG.enabled) {
    return;
  }
  
  const currentPlayer = getCurrentPlayerName();
  if (!currentPlayer) {
    return;
  }
  
  const chatPanelId = 'vip-chat-panel-all-chat';
  
  // Check if current player has chat enabled (only needed for All Chat tab)
  const hasChatEnabled = await checkRecipientChatEnabled(currentPlayer);
  
  // Check if panel already exists
  const existingPanel = document.getElementById(chatPanelId);
  if (existingPanel) {
    console.log('[VIP List] All Chat panel already exists, focusing...');
    
    // Clean up any orphaned tabs before proceeding
    cleanupOrphanedChatTabs();
    
    // Check if panel was manually closed - if so, this is a user-initiated reopen, so reset the flag
    const savedSettings = loadChatPanelSettings();
    const wasManuallyClosed = savedSettings.closedManually && !savedSettings.isOpen;
    
    existingPanel.style.zIndex = '10000';
    existingPanel.style.display = 'flex';
    
    // Re-attach drag and resize handlers (they were removed when panel was minimized)
    const headerContainer = existingPanel.querySelector('#all-chat-tabs-container');
    if (headerContainer && !existingPanel._dragHandlersAttached) {
      makePanelDraggable(existingPanel, headerContainer, () => {
        saveChatPanelPosition('all-chat', existingPanel);
      });
    }
    if (!existingPanel._resizeHandlersAttached) {
      makePanelResizable(existingPanel, headerContainer, () => {
        saveChatPanelPosition('all-chat', existingPanel);
      }, CHAT_PANEL_DIMENSIONS);
    }
    
    // Switch to All Chat tab when opening from header
    if (getAllChatApiUrl() && allChatTabs.has('all-chat')) {
      await switchAllChatTab('all-chat');
    }
    
    // Save panel state (open)
    // If panel was manually closed, this is a user-initiated reopen, so reset closedManually to false
    // Otherwise, preserve the existing closedManually state (should be false if panel was already open)
    saveChatPanelSettings(true, wasManuallyClosed ? false : savedSettings.closedManually);
    
    // Switch to polling if not already (panel is open)
    updateMessageCheckingMode();
    
    // Automatically open tabs based on Firebase state (unread messages, requests, guild chat)
    autoOpenTabsFromFirebase();
    
    return;
  }
  
  // Load saved position and dimensions for All Chat panel
  const savedPosition = loadChatPanelPosition('all-chat');
  const defaultTop = savedPosition?.top ?? 100;
  const defaultRight = savedPosition?.right ?? 20;
  const defaultLeft = savedPosition?.left ?? null;
  const savedWidth = savedPosition?.width ? 
    Math.max(CHAT_PANEL_DIMENSIONS.MIN_WIDTH, Math.min(CHAT_PANEL_DIMENSIONS.MAX_WIDTH, savedPosition.width)) : 
    500;
  const savedHeight = savedPosition?.height ? 
    Math.max(CHAT_PANEL_DIMENSIONS.MIN_HEIGHT, Math.min(CHAT_PANEL_DIMENSIONS.MAX_HEIGHT, savedPosition.height)) : 
    CHAT_PANEL_DIMENSIONS.DEFAULT_HEIGHT;
  
  // Create main panel container
  const panel = document.createElement('div');
  panel.id = chatPanelId;
  const positionStyle = defaultLeft !== null 
    ? `left: ${defaultLeft}px; top: ${defaultTop}px;`
    : `top: ${defaultTop}px; right: ${defaultRight}px;`;
  panel.style.cssText = `
    position: fixed;
    ${positionStyle}
    width: ${savedWidth}px;
    height: ${savedHeight}px;
    min-width: ${CHAT_PANEL_DIMENSIONS.MIN_WIDTH}px;
    max-width: ${CHAT_PANEL_DIMENSIONS.MAX_WIDTH}px;
    min-height: ${CHAT_PANEL_DIMENSIONS.MIN_HEIGHT}px;
    max-height: ${CHAT_PANEL_DIMENSIONS.MAX_HEIGHT}px;
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border: 6px solid transparent;
    border-image: ${CSS_CONSTANTS.BORDER_3_FRAME};
    border-radius: 6px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  `;
  
  // Create consolidated header with tabs and close button
  const headerContainer = document.createElement('div');
  headerContainer.id = 'all-chat-tabs-container';
  headerContainer.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
    cursor: move;
    user-select: none;
    flex-shrink: 0;
    min-height: 32px;
  `;
  
  // Tabs container (left side) - styled like game's native tabs
  const tabsContainer = document.createElement('div');
  tabsContainer.setAttribute('role', 'tablist');
  tabsContainer.setAttribute('aria-orientation', 'horizontal');
  tabsContainer.setAttribute('tabindex', '0');
  tabsContainer.className = 'flex';
  tabsContainer.style.cssText = `
    display: flex;
    gap: 0;
    overflow-x: auto;
    flex: 1;
    min-width: 0;
    outline: none;
    align-items: stretch;
    height: 100%;
  `;
  
  // Create "All Chat" tab (always create if messaging is enabled and API URL is available)
  let activeTab = null;
  if (getAllChatApiUrl()) {
    const allChatTab = await createAllChatTab('all-chat', t('mods.vipList.allChatTitle'), 0, true);
    tabsContainer.appendChild(allChatTab);
    allChatTabs.set('all-chat', allChatTab);
    activeTab = 'all-chat';
    
    // Set chat state immediately to prevent loading before state is set
    // This ensures loadAllChatConversation doesn't abort when called during auto-reopen
    chatStateManager.setActiveChatType('all-chat');
  }
  
  // Sync guild chat tab (will add if player is in a guild, hide if not)
  await syncGuildChatTab();
  
  // Close button (right side)
  const closeBtn = createStyledIconButton('✕', true);
  closeBtn.title = t('mods.vipList.closeButton');
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: rgb(255, 255, 255);
    cursor: pointer;
    padding: 4px 8px;
    font-size: 14px;
    font-weight: bold;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    flex-shrink: 0;
  `;
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    minimizeAllChatPanel();
  });
  
  headerContainer.appendChild(tabsContainer);
  headerContainer.appendChild(closeBtn);
  
  panel.appendChild(headerContainer);
  
  // Content wrapper (messages + action buttons column)
  const contentWrapper = document.createElement('div');
  contentWrapper.id = 'all-chat-content-wrapper';
  contentWrapper.style.cssText = `
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
    position: relative;
  `;
  
  // Messages area using UI component library
  let messagesArea;
  let scrollContainer;
  if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createScrollContainer) {
    // Use createScrollContainer from UI components library
    scrollContainer = api.ui.components.createScrollContainer({
      height: '100%',
      padding: false
    });
    messagesArea = scrollContainer.contentContainer;
    messagesArea.id = 'chat-messages-all-chat';
    // Override default styles to match chat panel design and flex layout
    scrollContainer.element.style.cssText = `
      flex: 1;
      min-height: 0;
      min-width: 0;
      position: relative;
      background: rgba(0, 0, 0, 0.2);
      border: none;
      padding: 0;
      height: 100%;
    `;
    // Adjust scroll view padding and dimensions
    scrollContainer.scrollView.style.padding = '8px';
    scrollContainer.scrollView.style.height = '100%';
    scrollContainer.scrollView.style.width = '100%';
    // Adjust content container - remove grid layout, use block for messages
    scrollContainer.contentContainer.className = '';
    scrollContainer.contentContainer.style.cssText = 'display: block;';
    // Hide the custom scrollbar (use native scrolling for chat)
    const customScrollbar = scrollContainer.element.querySelector('.scrollbar');
    if (customScrollbar) {
      customScrollbar.style.display = 'none';
    }
    // Store scroll container reference for pagination
    panel._scrollContainer = scrollContainer;
    // Setup scroll detection for loading older messages
    setupAllChatScrollDetection(panel, messagesArea, scrollContainer.scrollView);
  } else if (typeof window !== 'undefined' && window.BestiaryUIComponents && window.BestiaryUIComponents.createScrollContainer) {
    // Fallback to global BestiaryUIComponents
    scrollContainer = window.BestiaryUIComponents.createScrollContainer({
      height: '100%',
      padding: false
    });
    messagesArea = scrollContainer.contentContainer;
    messagesArea.id = 'chat-messages-all-chat';
    scrollContainer.element.style.cssText = `
      flex: 1;
      min-height: 0;
      min-width: 0;
      position: relative;
      background: rgba(0, 0, 0, 0.2);
      border: none;
      padding: 0;
      height: 100%;
    `;
    scrollContainer.scrollView.style.padding = '8px';
    scrollContainer.scrollView.style.height = '100%';
    scrollContainer.scrollView.style.width = '100%';
    scrollContainer.contentContainer.className = '';
    scrollContainer.contentContainer.style.cssText = 'display: block;';
    const customScrollbar = scrollContainer.element.querySelector('.scrollbar');
    if (customScrollbar) {
      customScrollbar.style.display = 'none';
    }
    // Store scroll container reference for pagination
    panel._scrollContainer = scrollContainer;
    // Setup scroll detection for loading older messages
    setupAllChatScrollDetection(panel, messagesArea, scrollContainer.scrollView);
  } else {
    // Fallback to custom div if UI components not available
    messagesArea = document.createElement('div');
    messagesArea.id = 'chat-messages-all-chat';
    messagesArea.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      background: rgba(0, 0, 0, 0.2);
      min-height: 0;
      min-width: 0;
      position: relative;
    `;
    // Store scroll container reference for pagination
    panel._scrollContainer = null;
    // Setup scroll detection for loading older messages
    setupAllChatScrollDetection(panel, messagesArea, messagesArea);
  }
  
  // Action buttons column (right side, only shown for player conversations)
  const actionsColumn = document.createElement('div');
  actionsColumn.id = 'all-chat-actions-column';
  actionsColumn.style.cssText = `
    width: 0;
    overflow: visible;
    background: rgba(0, 0, 0, 0.3);
    border-left: 2px solid rgba(255, 255, 255, 0.1);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: width 0.1s;
    position: relative;
  `;
  
  // Toggle button for actions column (positioned inside the column on the left edge)
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'all-chat-actions-toggle';
  toggleBtn.innerHTML = '◀';
  toggleBtn.style.cssText = `
    position: absolute;
    top: 50%;
    left: -16px;
    transform: translateY(-50%);
    width: 16px;
    height: 32px;
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border: 4px solid transparent;
    border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
    color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
    cursor: pointer;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    transition: all 0.1s;
    opacity: 0;
    pointer-events: none;
    box-sizing: border-box;
    font-family: ${CSS_CONSTANTS.FONT_FAMILY};
    font-weight: 700;
  `;
  toggleBtn.addEventListener('mouseenter', () => {
    toggleBtn.style.borderImage = CSS_CONSTANTS.BORDER_1_FRAME_PRESSED;
    toggleBtn.style.color = CSS_CONSTANTS.COLORS.TEXT_WHITE;
    toggleBtn.style.filter = 'brightness(1.2)';
  });
  toggleBtn.addEventListener('mouseleave', () => {
    toggleBtn.style.borderImage = CSS_CONSTANTS.BORDER_1_FRAME;
    toggleBtn.style.color = CSS_CONSTANTS.COLORS.TEXT_PRIMARY;
    toggleBtn.style.filter = 'none';
  });
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCollapsed = panel.dataset.actionsCollapsed === 'true';
    if (isCollapsed) {
      // Show column
      panel.dataset.actionsCollapsed = 'false';
      actionsColumn.style.width = '170px';
      actionsColumn.style.padding = '8px';
      actionsColumn.style.borderLeft = '2px solid rgba(255, 255, 255, 0.1)';
      toggleBtn.innerHTML = '◀';
    } else {
      // Hide column
      panel.dataset.actionsCollapsed = 'true';
      actionsColumn.style.width = '0';
      actionsColumn.style.padding = '0';
      actionsColumn.style.borderLeft = 'none';
      toggleBtn.innerHTML = '▶';
    }
  });
  
  // Show toggle button when column can be shown (player conversation, not all-chat or guild chat)
  const updateToggleButtonVisibility = () => {
    const currentTab = activeAllChatTab;
    const columnWidth = parseInt(actionsColumn.style.width) || 0;
    const isPlayerTab = currentTab && currentTab !== 'all-chat' && !currentTab.startsWith('guild-');
    
    if (isPlayerTab && columnWidth > 0) {
      // Column is visible - show button on left edge of column
      toggleBtn.style.opacity = '1';
      toggleBtn.style.pointerEvents = 'auto';
      toggleBtn.style.left = '-16px';
      toggleBtn.innerHTML = '◀';
    } else if (isPlayerTab && columnWidth === 0) {
      // Column is collapsed but can be shown - show button on left edge
      toggleBtn.style.opacity = '1';
      toggleBtn.style.pointerEvents = 'auto';
      toggleBtn.style.left = '-16px';
      toggleBtn.innerHTML = '▶';
    } else {
      // All-chat or guild chat tab, hide toggle
      toggleBtn.style.opacity = '0';
      toggleBtn.style.pointerEvents = 'none';
    }
  };
  
  // Observe column width changes
  const observer = new MutationObserver(() => {
    updateToggleButtonVisibility();
  });
  observer.observe(actionsColumn, { attributes: true, attributeFilter: ['style'] });
  
  // Store observer and update function on panel for cleanup (memory leak prevention)
  panel._toggleButtonObserver = observer;
  panel._updateToggleButtonVisibility = updateToggleButtonVisibility;
  
  // Append messages area (either scroll container element or plain div)
  if (scrollContainer) {
    contentWrapper.appendChild(scrollContainer.element);
    // Store scroll container reference on panel for later use
    panel._scrollContainer = scrollContainer;
  } else {
    contentWrapper.appendChild(messagesArea);
  }
  // Add toggle button to actions column (positioned on left edge)
  actionsColumn.appendChild(toggleBtn);
  
  contentWrapper.appendChild(actionsColumn);
  
  // Input area
  const inputArea = document.createElement('div');
  inputArea.style.cssText = `
    padding: 4px 8px;
    border-top: 2px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
  `;
  
  const inputRow = document.createElement('div');
  inputRow.style.cssText = 'display: flex; gap: 6px; align-items: center;';
  
  const canChat = hasChatEnabled;
  
  const textarea = document.createElement('textarea');
  textarea.className = 'vip-chat-input';
  textarea.setAttribute('wrap', 'off');
  textarea.placeholder = canChat ? t('mods.vipList.allChatPlaceholder') : t('mods.vipList.enableChatPlaceholder');
  textarea.disabled = !canChat;
  textarea.style.cssText = `
    flex: 1;
    height: 27px;
    padding: 4px 6px;
    background-color: #333;
    border: 4px solid transparent;
    border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
    color: ${canChat ? CSS_CONSTANTS.COLORS.TEXT_WHITE : 'rgba(255, 255, 255, 0.5)'};
    font-family: inherit;
    font-size: 13px;
    resize: none;
    box-sizing: border-box;
    line-height: 1.2;
    white-space: nowrap;
    overflow-x: hidden;
    overflow-y: hidden;
    outline: none;
    ${!canChat ? 'cursor: not-allowed; opacity: 0.6;' : ''}
  `;
  
  // Remove focus outline/border
  textarea.addEventListener('focus', () => {
    textarea.style.outline = 'none';
    textarea.style.borderImage = CSS_CONSTANTS.BORDER_1_FRAME;
  });
  
  textarea.addEventListener('blur', () => {
    textarea.style.outline = 'none';
    textarea.style.borderImage = CSS_CONSTANTS.BORDER_1_FRAME;
  });
  
  const sendButton = document.createElement('button');
  sendButton.textContent = t('mods.vipList.sendButton');
  sendButton.className = 'primary';
  sendButton.disabled = !canChat;
  sendButton.style.cssText = `
    padding: 6px 12px;
    white-space: nowrap;
    font-size: 13px;
    ${!canChat ? 'opacity: 0.6; cursor: not-allowed;' : ''}
  `;
  
  // Send message function
  const sendMessageHandler = async () => {
    // Allow sending for guild chat even if canChat is false (guild chat doesn't need privilege checks)
    const isGuildChat = activeAllChatTab && activeAllChatTab.startsWith('guild-');
    if (!canChat && !isGuildChat) {
      return;
    }
    
    let text = textarea.value.trim();
    if (!text || text.length === 0) {
      return;
    }
    
    // Truncate to max length if needed (guild chat has different limit)
    const maxLength = (activeAllChatTab && activeAllChatTab.startsWith('guild-')) ? 1000 : MESSAGING_CONFIG.maxMessageLength;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength);
    }
    
    // Clear input
    textarea.value = '';
    
    // Send message based on active tab
    try {
      let success = false;
      if (activeAllChatTab === 'all-chat') {
        const currentPlayer = getCurrentPlayerName();
        const messageId = Date.now().toString();
        const timestamp = Date.now();
        
        // Create optimistic message object
        const optimisticMessage = {
          id: messageId,
          from: currentPlayer,
          text: text.trim(),
          timestamp: timestamp,
          read: false
        };
        
        // Optimistically add message to DOM immediately
        const panel = messagesArea.closest('[id^="vip-chat-panel-all-chat"]');
        await addMessageToAllChatOptimistically(optimisticMessage, messagesArea, panel);
        
        // Send message to server
        success = await sendAllChatMessage(text);
        
        // Only reload if send failed (to remove optimistic message)
        if (!success) {
          // Remove optimistic message on failure
          const optimisticMsgEl = messagesArea.querySelector(`[data-message-id="${messageId}"]`);
          if (optimisticMsgEl) {
            optimisticMsgEl.remove();
            // Remove date separator if it was added and is now empty
            const prevSeparator = optimisticMsgEl.previousElementSibling;
            if (prevSeparator && prevSeparator.querySelector('div[style*="text-transform: uppercase"]')) {
              const nextMsg = optimisticMsgEl.nextElementSibling;
              if (!nextMsg || !nextMsg.hasAttribute('data-message-id')) {
                prevSeparator.remove();
              }
            }
          }
          // Reload to sync state
          await loadAllChatConversation(messagesArea, true);
        }
        // If success, message is already displayed optimistically, no reload needed
      } else if (activeAllChatTab && activeAllChatTab.startsWith('guild-')) {
        // Guild chat
        const guildId = activeAllChatTab.replace('guild-', '');
        success = await sendGuildChatMessage(guildId, text);
        if (success) {
          await loadGuildChatConversation(messagesArea, guildId, true);
        }
      } else {
        // Private message - use optimistic update
        const currentPlayer = getCurrentPlayerName();
        const messageId = Date.now().toString();
        const timestamp = Date.now();
        
        // Create optimistic message object
        const optimisticMessage = {
          id: messageId,
          from: currentPlayer,
          text: text.trim(),
          timestamp: timestamp,
          read: false,
          isFromMe: true
        };
        
        // Optimistically add message to DOM immediately
        const panel = messagesArea.closest('[id^="vip-chat-panel-"]');
        await addMessageToConversationOptimistically(optimisticMessage, messagesArea, panel);
        
        // Send message to server
        success = await sendMessage(activeAllChatTab, text);
        
        if (!success) {
          // Remove optimistic message on failure
          const optimisticMsgEl = messagesArea.querySelector(`[data-message-id="${messageId}"]`);
          if (optimisticMsgEl) {
            optimisticMsgEl.remove();
          }
          // Reload to sync state
          await loadConversation(activeAllChatTab, messagesArea, true);
        } else {
          // Reload conversation after successful send to ensure message is synced from Firebase
          // This ensures the message persists after page refresh
          await loadConversation(activeAllChatTab, messagesArea, true, true);
        }
      }
      
      if (!success) {
        // Restore text on failure
        textarea.value = text;
      }
    } catch (error) {
      // Handle Firebase 401 error specifically
      if (error.message === 'FIREBASE_401') {
        // Restore text
        textarea.value = text;
        
        // Show user-friendly error message
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255, 107, 107, 0.95);
          border: 2px solid ${CSS_CONSTANTS.COLORS.ERROR};
          border-radius: 4px;
          padding: 12px 20px;
          color: white;
          font-size: 13px;
          z-index: 10001;
          max-width: 500px;
          text-align: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        `;
        errorMsg.textContent = t('mods.vipList.allChatNotAvailable');
        document.body.appendChild(errorMsg);
        
        // Auto-remove after 5 seconds
        const timeoutId = setTimeout(() => {
          errorMsg.remove();
          pendingTimeouts.delete(timeoutId);
        }, 5000);
        trackTimeout(timeoutId);
      } else {
        // Restore text on other errors
        textarea.value = text;
      }
    }
  };
  
  sendButton.addEventListener('click', sendMessageHandler);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageHandler();
    }
  });
  
  inputRow.appendChild(textarea);
  inputRow.appendChild(sendButton);
  inputArea.appendChild(inputRow);
  
  panel.appendChild(headerContainer);
  panel.appendChild(contentWrapper);
  panel.appendChild(inputArea);
  
  // Set active tab (if All Chat tab was created, use it; otherwise wait for a tab to be added)
  if (activeTab) {
    activeAllChatTab = activeTab;
    // Initialize actions column (hidden for all-chat)
    await updateAllChatActionsColumn('all-chat');
    
    // Load initial conversation if All Chat tab exists
    if (activeTab === 'all-chat' && getAllChatApiUrl()) {
      loadAllChatConversation(messagesArea, true).then(async () => {
        // Scroll to bottom after loading
        scrollChatToBottom(panel);
        
        // Initialize message count
        const messages = await getAllChatMessages();
        if (messages.length > 0) {
          panel._lastMessageCount = messages.length;
          panel._previousMessageCount = messages.length;
        } else {
          panel._lastMessageCount = 0;
          panel._previousMessageCount = 0;
        }
      });
    } else {
      // No active tab yet, show empty state
      messagesArea.innerHTML = '';
      panel._lastMessageCount = 0;
      panel._previousMessageCount = 0;
    }
  } else {
    // No All Chat tab, wait for a private chat tab to be added
    activeAllChatTab = null;
    messagesArea.innerHTML = '';
    panel._lastMessageCount = 0;
    panel._previousMessageCount = 0;
  }
  
  // Add to document
  document.body.appendChild(panel);
  openChatPanels.set('all-chat', panel);
  
  // Save panel state (open)
  saveChatPanelSettings(true, false);
  
  // Switch to polling when panel opens (for more frequent updates)
  updateMessageCheckingMode();
  
  // Make panel draggable (same as regular chat panels)
  makePanelDraggable(panel, headerContainer, () => {
    saveChatPanelPosition('all-chat', panel);
  });
  panel._lastTimestamp = null;
  
  // Make panel resizable (same as VIP List panel - edge-based resizing)
  makePanelResizable(panel, headerContainer, () => {
    saveChatPanelPosition('all-chat', panel);
  }, CHAT_PANEL_DIMENSIONS);
  
  // Focus textarea
  const timeoutId = setTimeout(() => {
    textarea.focus();
    pendingTimeouts.delete(timeoutId);
  }, 100);
  trackTimeout(timeoutId);
  
  // Automatically open tabs based on Firebase state (unread messages, requests, guild chat)
  // Skip tab status update here (done after panel creation) for better performance
  autoOpenTabsFromFirebase(false);
}

// Minimize All Chat panel
async function minimizeAllChatPanel() {
  const chatPanelId = 'vip-chat-panel-all-chat';
  const panel = document.getElementById(chatPanelId);
  
  if (panel) {
    // Cleanup panel resources
    if (panel._checkInterval) {
      clearInterval(panel._checkInterval);
      panel._checkInterval = null;
    }
    
    // Remove scroll handlers (memory leak prevention)
    removeScrollDetection(panel, { handlerKey: '_scrollHandler' });
    
    // Remove MutationObserver (memory leak prevention)
    if (panel._toggleButtonObserver) {
      panel._toggleButtonObserver.disconnect();
      panel._toggleButtonObserver = null;
    }
    
    // Remove event listeners
    const headerContainer = panel.querySelector('#all-chat-tabs-container');
    removePanelDragHandlers(panel, headerContainer);
    
    // Remove resize handlers
    if (panel._resizeHandler) {
      document.removeEventListener('mousemove', panel._resizeHandler);
      panel._resizeHandler = null;
    }
    if (panel._resizeUpHandler) {
      document.removeEventListener('mouseup', panel._resizeUpHandler);
      panel._resizeUpHandler = null;
    }
    if (panel._allChatPanelMousemoveHandler) {
      panel.removeEventListener('mousemove', panel._allChatPanelMousemoveHandler);
      panel._allChatPanelMousemoveHandler = null;
    }
    if (panel._allChatPanelMousedownHandler) {
      panel.removeEventListener('mousedown', panel._allChatPanelMousedownHandler);
      panel._allChatPanelMousedownHandler = null;
    }
    panel._resizeHandlersAttached = false;
    
    // Hide panel
    panel.style.display = 'none';
    openChatPanels.delete('all-chat');
    
    // Save panel state (closed manually)
    saveChatPanelSettings(false, true);
    
    // Switch polling mode if no panels open
    updateMessageCheckingMode();
  }
}

// Minimize chat panel (add tab to all-chat instead of minimizing)
async function minimizeChatPanel(playerName) {
  const chatPanelId = getChatPanelId(playerName);
  const panel = document.getElementById(chatPanelId);
  
  if (panel) {
    // Mark all messages from this player as read in Firebase before closing
    await markAllMessagesAsReadFromPlayer(playerName);
    
    // Check if all-chat panel is open, if so add a tab
    const allChatPanel = document.getElementById('vip-chat-panel-all-chat');
    if (allChatPanel) {
      // Get unread count
      const messages = await getConversationMessages(playerName);
      const unreadCount = await getPlayerUnreadCount(messages, playerName);
      await addAllChatTab(playerName, playerName, unreadCount);
      // Switch to the tab
      await switchAllChatTab(playerName);
    }
    
    // Cleanup panel resources
    // Clean up conversation timestamp tracking
    const conversationKey = playerName.toLowerCase();
    conversationLastTimestamps.delete(conversationKey);
    
    // Stop frequent checking for this player
    stopPendingRequestCheck(playerName);
    
    // Remove scroll handlers (memory leak prevention)
    removeScrollDetection(panel, { handlerKey: `_scrollHandler_conversation_${conversationKey}` });
    
    // Remove event listeners (stored directly on panel object)
    const headerContainer = panel.querySelector('div:first-child');
    removePanelDragHandlers(panel, headerContainer);
    
    // Remove panel
    panel.remove();
    openChatPanels.delete(playerName.toLowerCase());
    
    // Check if there are still unread messages and show icon if needed
    try {
      const messages = await getConversationMessages(playerName);
      const unreadCount = await getPlayerUnreadCount(messages, playerName);
      updateVIPListChatIcon(playerName, unreadCount);
    } catch (error) {
      // Silently fail
    }
    
    // Switch to event-driven if no panels are open (more efficient)
    updateMessageCheckingMode();
  }
}

// Open chat dialog (always opens as HTML panel)
function openChatDialog(toPlayer) {
  if (!getMessagingApiUrl() || !MESSAGING_CONFIG.enabled) {
    if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal) {
      api.ui.components.createModal({
        title: t('mods.vipList.messagingDisabled'),
        content: t('mods.vipList.messagingDisabledText'),
        buttons: [{ text: t('mods.vipList.closeButton'), primary: true }]
      });
    }
    return;
  }
  
  const currentPlayer = getCurrentPlayerName();
  if (!currentPlayer) {
    return;
  }
  
  // Always open as panel (no modal version)
  openChatPanel(toPlayer);
}

// Open message dialog (opens as tab in all-chat panel)
async function openMessageDialog(toPlayer) {
  if (!getMessagingApiUrl() || !MESSAGING_CONFIG.enabled) {
    if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal) {
      api.ui.components.createModal({
        title: t('mods.vipList.messagingDisabled'),
        content: t('mods.vipList.messagingDisabledText'),
        buttons: [{ text: t('mods.vipList.closeButton'), primary: true }]
      });
    }
    return;
  }
  
  // Open all-chat panel if not already open or if it's hidden
  const allChatPanel = document.getElementById('vip-chat-panel-all-chat');
  if (!allChatPanel || allChatPanel.style.display === 'none') {
    await openAllChatPanel();
  } else {
    // Panel exists and is visible, but make sure it's focused
    allChatPanel.style.zIndex = '10000';
    allChatPanel.style.display = 'flex';
    // Save panel state (open)
    // Check if panel was manually closed - if so, this is a user-initiated reopen, so reset the flag
    const savedSettings = loadChatPanelSettings();
    const wasManuallyClosed = savedSettings.closedManually && !savedSettings.isOpen;
    saveChatPanelSettings(true, wasManuallyClosed ? false : savedSettings.closedManually);
  }
  
  // Add tab for this player if it doesn't exist
      const messages = await getConversationMessages(toPlayer);
      const unreadCount = await getPlayerUnreadCount(messages, toPlayer);
      await addAllChatTab(toPlayer, toPlayer, unreadCount);
  
  // Hide chat icon in VIP list when opening chat
  updateVIPListChatIcon(toPlayer, 0);
  
  // Switch to the tab
  await switchAllChatTab(toPlayer);
}

// =======================
// 8. Cyclopedia Integration
// =======================

// Open Cyclopedia modal for a specific player
function openCyclopediaForPlayer(playerName, closeVIPList = false) {
  // Close VIP List modal only if explicitly requested (e.g., when called from VIP list items)
  if (closeVIPList) {
    if (vipListModalInstance) {
      document.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'Escape', 
        code: 'Escape', 
        keyCode: 27, 
        bubbles: true 
      }));
      vipListModalInstance = null;
    }
    
    // Close VIP List panel
    if (vipListPanelInstance) {
      handlePanelCloseButtonClick(vipListPanelInstance);
    }
  }
  
  // Check if Cyclopedia is already open and close it first
  const isCyclopediaOpen = () => {
    // Check for active modal
    if (typeof window !== 'undefined' && window.activeCyclopediaModal) {
      return true;
    }
    // Check for modal in progress flag
    if (typeof window !== 'undefined' && window.cyclopediaModalInProgress) {
      return true;
    }
    // Check cyclopediaState
    if (typeof window !== 'undefined' && window.cyclopediaState && window.cyclopediaState.modalOpen) {
      return true;
    }
    // Check for open modal in DOM
    const openModal = document.querySelector('div[role="dialog"][data-state="open"]');
    if (openModal && openModal.textContent && openModal.textContent.includes('Cyclopedia')) {
      return true;
    }
    return false;
  };
  
  // Check if Cyclopedia is open and store the result
  const wasCyclopediaOpen = isCyclopediaOpen();
  
  // Close Cyclopedia if already open
  if (wasCyclopediaOpen) {
    // Press ESC to close existing Cyclopedia
    document.dispatchEvent(new KeyboardEvent('keydown', { 
      key: 'Escape', 
      code: 'Escape', 
      keyCode: 27, 
      bubbles: true 
    }));
    document.dispatchEvent(new KeyboardEvent('keyup', { 
      key: 'Escape', 
      code: 'Escape', 
      keyCode: 27, 
      bubbles: true 
    }));
    
    // Reset modal flags
    if (typeof window !== 'undefined') {
      if (window.activeCyclopediaModal) {
        window.activeCyclopediaModal = null;
      }
      if (window.cyclopediaModalInProgress !== undefined) {
        window.cyclopediaModalInProgress = false;
      }
      if (window.cyclopediaState) {
        window.cyclopediaState.modalOpen = false;
      }
    }
  }
  
  // Helper to set cyclopedia state
  const setCyclopediaState = (username) => {
    if (typeof cyclopediaState !== 'undefined') {
      cyclopediaState.searchedUsername = username;
    } else if (typeof window !== 'undefined' && window.cyclopediaState) {
      window.cyclopediaState.searchedUsername = username;
    }
  };
  
  // Wait a bit for modal to close, then open Cyclopedia (longer wait if we closed one)
  const waitTime = wasCyclopediaOpen ? TIMEOUTS.NORMAL : TIMEOUTS.SHORT;
  const timeout1 = setTimeout(() => {
    pendingTimeouts.delete(timeout1);
    try {
      // Set searched player name in cyclopediaState before opening
      setCyclopediaState(playerName);
      
      // Set selected category to Leaderboards
      if (typeof window !== 'undefined') {
        window.selectedCharacterItem = 'Leaderboards';
      }
      
      // Open Cyclopedia modal
      if (typeof window !== 'undefined' && window.Cyclopedia && typeof window.Cyclopedia.show === 'function') {
        window.Cyclopedia.show({});
      } else if (typeof openCyclopediaModal === 'function') {
        openCyclopediaModal({});
      } else {
        console.warn('[VIP List] Could not find openCyclopediaModal function');
        return;
      }
      
      // After opening, navigate to Characters tab and Leaderboards
      const timeout2 = setTimeout(() => {
        pendingTimeouts.delete(timeout2);
        setCyclopediaState(playerName);
        
        // Find Characters tab button
        const tabButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
          const text = btn.textContent?.trim() || '';
          return text === 'Characters';
        });
        
        // Click Characters tab
        if (tabButtons.length > 0) {
          const charactersTab = tabButtons.find((btn) => {
            const parent = btn.closest('[role="tablist"], .flex, nav');
            return parent !== null;
          }) || tabButtons[0];
          
          charactersTab.click();
        }
        
        // Wait for Characters tab to load, then click Leaderboards and trigger search
        const timeout3 = setTimeout(() => {
          pendingTimeouts.delete(timeout3);
          setCyclopediaState(playerName);
          
          // Set selected category to Leaderboards
          if (typeof window !== 'undefined') {
            window.selectedCharacterItem = 'Leaderboards';
          }
          
          // Find and click Leaderboards button
          const leaderboardsButton = Array.from(document.querySelectorAll('div')).find(div => {
            const text = div.textContent?.trim() || '';
            return text === 'Leaderboards';
          });
          
          if (leaderboardsButton) {
            leaderboardsButton.click();
          }
          
          // Wait for Leaderboards to load, then find search input and trigger search
          const timeout4 = setTimeout(() => {
            pendingTimeouts.delete(timeout4);
            // Try to find the leaderboard search input using multiple strategies
            let searchInput = null;
            
            // Strategy 1: Look for input with placeholder "Compare with..." inside "Player search" widget
            const playerSearchHeaders = Array.from(document.querySelectorAll('h2, .widget-top-text')).filter(el => {
              const text = el.textContent?.trim() || '';
              return text.toLowerCase() === 'player search';
            });
            
            if (playerSearchHeaders.length > 0) {
              // Find the closest parent container that contains both the header and the input
              const playerSearchContainer = playerSearchHeaders[0].closest('div[style*="flex-direction: column"]');
              if (playerSearchContainer) {
                const inputWithPlaceholder = playerSearchContainer.querySelector('input[placeholder*="Compare with"]');
                if (inputWithPlaceholder) {
                  searchInput = inputWithPlaceholder;
                }
              }
            }
            
            // Strategy 2: Look for visible input with placeholder "Compare with..."
            if (!searchInput) {
              const allInputs = Array.from(document.querySelectorAll('input[type="text"]'));
              searchInput = allInputs.find(input => {
                const placeholder = (input.placeholder || '').toLowerCase();
                const style = window.getComputedStyle(input);
                return placeholder.includes('compare with') &&
                       !input.disabled && 
                       input.offsetParent !== null &&
                       style.display !== 'none' &&
                       style.visibility !== 'hidden';
              });
            }
            
            // Strategy 3: Look for input near a Search button (fallback)
            if (!searchInput) {
              const searchButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
                const text = btn.textContent?.trim().toLowerCase() || '';
                return text === 'search' && !btn.disabled && btn.offsetParent !== null;
              });
              
              if (searchButtons.length > 0) {
                // Find the Search button that's in the same container as "Player search" header
                const playerSearchButton = searchButtons.find(btn => {
                  const container = btn.closest('div[style*="flex-direction: column"]');
                  if (container) {
                    const header = container.querySelector('h2, .widget-top-text');
                    return header && header.textContent?.trim().toLowerCase() === 'player search';
                  }
                  return false;
                });
                
                if (playerSearchButton) {
                  const buttonParent = playerSearchButton.closest('div');
                  if (buttonParent) {
                    searchInput = buttonParent.querySelector('input[type="text"]');
                  }
                }
              }
            }
            
            // If found, set the value and trigger search
            if (searchInput) {
              searchInput.value = playerName;
              searchInput.focus();
              
              // Trigger input event
              searchInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
              
              // Also try Enter key to trigger search
              searchInput.dispatchEvent(new KeyboardEvent('keydown', { 
                bubbles: true, 
                cancelable: true, 
                key: 'Enter',
                code: 'Enter',
                keyCode: 13
              }));
              
              // Look for and click Search button if it exists
              const searchButton = Array.from(document.querySelectorAll('button')).find(btn => {
                const text = btn.textContent?.trim() || '';
                return text.toLowerCase() === 'search' && !btn.disabled && btn.offsetParent !== null;
              });
              
              if (searchButton) {
                setTimeout(() => {
                  searchButton.click();
                }, 100);
              }
            }
          }, TIMEOUTS.NORMAL);
          trackTimeout(timeout4);
        }, TIMEOUTS.LONGER);
        trackTimeout(timeout3);
      }, TIMEOUTS.LONG);
      trackTimeout(timeout2);
    } catch (error) {
      console.error('[VIP List] Error opening Cyclopedia:', error);
    }
  }, waitTime);
  trackTimeout(timeout1);
}

// =======================
// 9. Dropdown Positioning
// =======================

// Check if dropdown should open upward based on available space
// Simplified logic: prefer upward when near bottom of container or when there's more space above
function shouldDropdownOpenUpward(dropdown, button, container) {
  const buttonRect = button.getBoundingClientRect();
  
  // Measure dropdown height (simplified - use default if not measurable)
  const wasVisible = dropdown.style.display === 'block';
  dropdown.style.position = 'fixed';
  dropdown.style.visibility = 'hidden';
  dropdown.style.display = 'block';
  dropdown.style.top = '-9999px';
  dropdown.style.left = '-9999px';
  
  void dropdown.offsetHeight; // Force layout
  const dropdownHeight = dropdown.offsetHeight || 150;
  
  // Restore
  dropdown.style.display = wasVisible ? 'block' : 'none';
  dropdown.style.position = '';
  dropdown.style.visibility = '';
  dropdown.style.top = '';
  dropdown.style.left = '';
  
  // Calculate space relative to container or viewport
  let spaceBelow, spaceAbove, containerBottom, containerTop;
  
  if (container) {
    const containerRect = container.getBoundingClientRect();
    containerBottom = Math.min(containerRect.bottom, window.innerHeight);
    containerTop = Math.max(containerRect.top, 0);
    spaceBelow = containerBottom - buttonRect.bottom;
    spaceAbove = buttonRect.top - containerTop;
    
    // If scrollable container, check position within visible area
    if (container.scrollHeight > container.clientHeight) {
      const visibleHeight = containerBottom - containerTop;
      const buttonPositionInContainer = buttonRect.top - containerTop;
      const buttonPercentInContainer = buttonPositionInContainer / visibleHeight;
      
      // If button is in bottom 60% of visible container, prefer upward (more aggressive)
      if (buttonPercentInContainer > 0.4) {
        const requiredSpace = dropdownHeight + 20;
        // If there's any reasonable space above, open upward
        if (spaceAbove >= requiredSpace || (spaceAbove > dropdownHeight && spaceBelow < spaceAbove)) {
          return true; // Open upward if in bottom 60% and space available
        }
      }
    }
  } else {
    // No container - use viewport
    containerBottom = window.innerHeight;
    containerTop = 0;
    spaceBelow = containerBottom - buttonRect.bottom;
    spaceAbove = buttonRect.top;
  }
  
  const requiredSpace = dropdownHeight + 20;
  
  // Simple decision: open upward if:
  // 1. Not enough space below AND enough space above, OR
  // 2. More space above than below (prefer upward)
  return (spaceBelow < requiredSpace && spaceAbove >= requiredSpace) ||
         (spaceAbove > spaceBelow && spaceAbove >= requiredSpace);
}

// Position dropdown above or below button (always opens to the right)
// Uses absolute positioning for modal (to work with transforms) and fixed for panel
function positionDropdown(dropdown, button, openUpward, container) {
  // Detect if we're in a modal (has column-content-wrapper) or panel (has vip-panel-content-wrapper)
  const isModal = container && container.classList.contains('column-content-wrapper');
  const isPanel = container && container.classList.contains('vip-panel-content-wrapper');
  
  if (isModal) {
    // Modal: use absolute positioning relative to button's positioned parent
    const nameCell = button.closest('div[style*="position: relative"]') || button.parentElement;
    if (nameCell && nameCell.style.position !== 'relative') {
      nameCell.style.position = 'relative';
    }
    
    dropdown.style.position = 'absolute';
    if (openUpward) {
      dropdown.style.top = 'auto';
      dropdown.style.bottom = '100%';
      dropdown.style.marginTop = '0';
      dropdown.style.marginBottom = '4px';
    } else {
      dropdown.style.top = '100%';
      dropdown.style.bottom = 'auto';
      dropdown.style.marginTop = '4px';
      dropdown.style.marginBottom = '0';
    }
    dropdown.style.left = '0';
    dropdown.style.transform = 'none';
  } else {
    // Panel or standalone: use fixed positioning relative to viewport
    const buttonRect = button.getBoundingClientRect();
    
    if (openUpward) {
      dropdown.style.position = 'fixed';
      dropdown.style.top = `${buttonRect.top - dropdown.offsetHeight - 4}px`;
      dropdown.style.bottom = 'auto';
      dropdown.style.left = `${buttonRect.left}px`;
    } else {
      dropdown.style.position = 'fixed';
      dropdown.style.top = `${buttonRect.bottom + 4}px`;
      dropdown.style.bottom = 'auto';
      dropdown.style.left = `${buttonRect.left}px`;
    }
    dropdown.style.marginTop = '0';
    dropdown.style.marginBottom = '0';
    dropdown.style.transform = 'none';
  }
}

// Adjust dropdown position after rendering if it extends outside viewport
function adjustDropdownPosition(dropdown, button, openUpward) {
  const timeoutId = setTimeout(() => {
    pendingTimeouts.delete(timeoutId);
    const dropdownRect = dropdown.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const viewportBottom = window.innerHeight;
    const viewportTop = 0;
    const dropdownHeight = dropdown.offsetHeight;
    
    // Get container to determine positioning strategy
    const container = findDropdownContainer(button);
    const isModal = container && container.classList.contains('column-content-wrapper');
    
    // Only adjust for fixed positioning (panel), not absolute (modal)
    if (!isModal && dropdown.style.position === 'fixed') {
      // If dropdown extends below viewport and we're opening downward, switch to upward
      if (!openUpward && dropdownRect.bottom > viewportBottom) {
        // Check if there's enough space above to open upward
        if (buttonRect.top >= dropdownHeight + 15) {
          positionDropdown(dropdown, button, true, container);
          // Re-measure after repositioning
          const newRect = dropdown.getBoundingClientRect();
          // If still extends above viewport, try to adjust vertically
          if (newRect.top < viewportTop) {
            dropdown.style.top = `${viewportTop + 5}px`;
            dropdown.style.bottom = 'auto';
          }
        } else {
          // Not enough space either way - position at viewport edge
          const maxTop = viewportBottom - dropdownHeight - 5;
          dropdown.style.top = `${maxTop}px`;
          dropdown.style.bottom = 'auto';
        }
      }
      
      // If dropdown extends above viewport and we're opening upward, adjust
      if (openUpward && dropdownRect.top < viewportTop) {
        // Try switching to downward if there's space
        if (buttonRect.bottom + dropdownHeight + 15 <= viewportBottom) {
          positionDropdown(dropdown, button, false, container);
        } else {
          // Position at viewport top with small margin
          dropdown.style.top = `${viewportTop + 5}px`;
          dropdown.style.bottom = 'auto';
        }
      }
    }
    
    // Check horizontal overflow - always keep dropdown opening to the right
    if (dropdownRect.right > window.innerWidth) {
      // Dropdown extends beyond right edge - shift left but keep it aligned to button's left edge
      const overflow = dropdownRect.right - window.innerWidth;
      const newLeft = Math.max(buttonRect.left, buttonRect.left - overflow - 5); // Shift left with 5px margin
      dropdown.style.left = `${newLeft}px`;
      dropdown.style.transform = 'none';
    } else if (dropdownRect.left < buttonRect.left) {
      // If somehow positioned left of button, reset to button's left edge
      dropdown.style.left = `${buttonRect.left}px`;
      dropdown.style.transform = 'none';
    }
  }, TIMEOUTS.IMMEDIATE);
  trackTimeout(timeoutId);
}

// =======================
// 9.1. Shared Dropdown Helper Functions
// =======================

// Reset dropdown positioning styles
function resetDropdownStyles(dropdown) {
  dropdown.style.display = 'none';
  dropdown.style.top = '';
  dropdown.style.bottom = '';
  dropdown.style.left = '';
  dropdown.style.marginTop = '';
  dropdown.style.marginBottom = '';
  dropdown.style.transform = '';
  dropdown.style.position = '';
}

// Close all dropdowns except the specified one
function closeAllDropdownsExcept(excludeDropdown) {
  document.querySelectorAll('.vip-dropdown-menu').forEach(menu => {
    if (menu !== excludeDropdown) {
      resetDropdownStyles(menu);
    }
  });
}

// Create dropdown element with base styling
function createDropdownElement() {
  const dropdown = document.createElement('div');
  dropdown.className = 'vip-dropdown-menu';
  dropdown.style.cssText = `
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    transform: none;
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border: 4px solid transparent;
    border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
    min-width: 120px;
    z-index: 10001;
    margin-top: 4px;
    padding: 4px;
    pointer-events: auto;
  `;
  return dropdown;
}

// Create dropdown menu item
function createDropdownItem(text, onClick, dropdown, options = {}) {
  const {
    color = CSS_CONSTANTS.COLORS.TEXT_PRIMARY,
    fontSize = '',
    dataAttributes = {}
  } = options;
  
  const menuItem = document.createElement('div');
  menuItem.textContent = text;
  menuItem.style.cssText = `
    padding: 6px 12px;
    color: ${color};
    cursor: pointer;
    ${fontSize ? `font-size: ${fontSize};` : ''}
    text-align: left;
  `;
  
  // Apply data attributes
  Object.entries(dataAttributes).forEach(([key, value]) => {
    menuItem.setAttribute(key, value);
  });
  
  addHoverEffect(menuItem);
  menuItem.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
    dropdown.style.display = 'none';
  });
  
  return menuItem;
}

// Toggle dropdown visibility with positioning
function toggleDropdown(dropdown, button, container, options = {}) {
  const {
    onOpen = null,
    cyclopediaMenuItem = null
  } = options;
  
  const isVisible = dropdown.style.display === 'block';
  closeAllDropdownsExcept(dropdown);
  
  if (!isVisible) {
    const openUpward = shouldDropdownOpenUpward(dropdown, button, container);
    
    if (cyclopediaMenuItem) {
      cyclopediaMenuItem.style.display = '';
      cyclopediaMenuItem.style.visibility = 'visible';
    }
    
    dropdown.style.display = 'block';
    void dropdown.offsetHeight; // Force layout calculation
    positionDropdown(dropdown, button, openUpward, container);
    adjustDropdownPosition(dropdown, button, openUpward);
    
    if (onOpen) {
      onOpen();
    }
    
    // Double-check Cyclopedia item visibility after a short delay
    if (cyclopediaMenuItem) {
      const timeoutId = setTimeout(() => {
        pendingTimeouts.delete(timeoutId);
        if (dropdown.style.display === 'block' && cyclopediaMenuItem) {
          if (cyclopediaMenuItem.style.display === 'none') {
            cyclopediaMenuItem.style.display = '';
            cyclopediaMenuItem.style.visibility = 'visible';
          }
        }
      }, 10);
      trackTimeout(timeoutId);
    }
  } else {
    resetDropdownStyles(dropdown);
  }
}

// =======================
// 9.2. Additional Shared Helper Functions
// =======================

// Find container (modal, panel, or scrollable parent)
function findDropdownContainer(element) {
  return element.closest('.column-content-wrapper') || 
         element.closest('.vip-panel-content-wrapper') ||
         element.closest('[style*="overflow"]') ||
         element.closest('[class*="scroll"]');
}

// Get font size style string (empty for modal, fontSize for panel)
function getFontSizeStyle(fontSize, forPanel) {
  return forPanel ? `font-size: ${fontSize};` : '';
}

// Query for open dialog element
function getOpenDialog() {
  return document.querySelector('div[role="dialog"][data-state="open"]');
}

// Add hover effect to element
function addHoverEffect(element, hoverBackground = 'rgba(255, 255, 255, 0.1)') {
  element.addEventListener('mouseenter', () => {
    element.style.background = hoverBackground;
  });
  element.addEventListener('mouseleave', () => {
    element.style.background = 'transparent';
  });
}

// Get status color based on status text
function getStatusColor(statusText) {
  const onlineText = t('mods.vipList.statusOnline');
  const offlineText = t('mods.vipList.statusOffline');
  
  if (statusText === onlineText) {
    return CSS_CONSTANTS.COLORS.ONLINE;
  } else if (statusText === offlineText) {
    return CSS_CONSTANTS.COLORS.OFFLINE;
  }
  return CSS_CONSTANTS.COLORS.TEXT_PRIMARY;
}

// =======================
// 10. Search Input Management
// =======================

// Add search input styles if not already added
function addSearchInputStyles() {
  injectVIPListStyles(); // Uses consolidated stylesheet
}

// Show placeholder message with class styling
function showPlaceholderMessage(searchInput, originalPlaceholder, message, className) {
  searchInput.value = '';
  searchInput.placeholder = message;
  searchInput.classList.remove('error', 'success', 'duplicate');
  searchInput.classList.add(className);
  
  const timeoutId = setTimeout(() => {
    searchInput.placeholder = originalPlaceholder;
    searchInput.classList.remove(className);
    pendingTimeouts.delete(timeoutId);
  }, TIMEOUTS.PLACEHOLDER_RESET);
  trackTimeout(timeoutId);
}

// Create add player handler for search input
function createAddPlayerHandler(searchInput, addButton, originalPlaceholder) {
  return async () => {
    const playerName = searchInput.value.trim();
    if (!playerName) return;
    
    // Check if player is already in VIP list
    const vipList = getVIPList();
    const existingPlayer = vipList.find(vip => vip.name.toLowerCase() === playerName.toLowerCase());
    
    if (existingPlayer) {
      showPlaceholderMessage(
        searchInput,
        originalPlaceholder,
        tReplace('mods.vipList.errorDuplicate', { name: existingPlayer.name }),
        'duplicate'
      );
      return;
    }
    
    // Disable input and button while fetching
    searchInput.disabled = true;
    addButton.disabled = true;
    const originalButtonText = addButton.textContent;
    addButton.textContent = t('mods.vipList.addingButton');
    
    try {
      const profileData = await fetchPlayerData(playerName);
      
      if (profileData === null) {
        showPlaceholderMessage(
          searchInput,
          originalPlaceholder,
          t('mods.vipList.errorPlayerNotFound'),
          'error'
        );
        searchInput.disabled = false;
        addButton.disabled = false;
        addButton.textContent = originalButtonText;
        return;
      }
      
      // Extract player info using helper function
      const playerInfo = extractPlayerInfoFromProfile(profileData, playerName);
      
      // Add to VIP list
      addToVIPList(playerName, playerInfo);
      
      // Refresh display
      await refreshVIPListDisplay();
      
      // Show success message
      showPlaceholderMessage(
        searchInput,
        originalPlaceholder,
        tReplace('mods.vipList.successAdded', { name: playerInfo.name }),
        'success'
      );
      
      console.log('[VIP List] Added player:', playerName);
    } catch (error) {
      console.error('[VIP List] Error adding player:', error);
      alert(`Failed to add player "${playerName}". Please try again.`);
    } finally {
      searchInput.disabled = false;
      addButton.disabled = false;
      addButton.textContent = originalButtonText;
    }
  };
}

// Create search input element
function createSearchInput(originalPlaceholder, forPanel = false) {
  const fontSize = getFontSize(14, forPanel);
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'pixel-font-14 vip-search-input';
  searchInput.placeholder = originalPlaceholder;
  searchInput.style.cssText = `
    flex: 1;
    min-width: 0;
    max-width: 200px;
    padding: 2px 8px;
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border: 4px solid transparent;
    border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    font-size: ${fontSize};
    text-align: left;
    box-sizing: border-box;
    max-height: 21px;
    height: 21px;
    line-height: normal;
  `;
  return searchInput;
}

// =======================
// 11. Modal Styling
// =======================

// Apply modal styles after creation
function applyModalStyles(dialog) {
  dialog.style.width = `${MODAL_DIMENSIONS.WIDTH}px`;
  dialog.style.minWidth = `${MODAL_DIMENSIONS.WIDTH}px`;
  dialog.style.maxWidth = `${MODAL_DIMENSIONS.WIDTH}px`;
  dialog.style.height = `${MODAL_DIMENSIONS.HEIGHT}px`;
  dialog.style.minHeight = `${MODAL_DIMENSIONS.HEIGHT}px`;
  dialog.style.maxHeight = `${MODAL_DIMENSIONS.HEIGHT}px`;
  
  const contentElem = dialog.querySelector('.modal-content, [data-content], .content, .modal-body, .widget-bottom');
  if (contentElem) {
    contentElem.style.width = `${MODAL_DIMENSIONS.WIDTH}px`;
    contentElem.style.height = `${MODAL_DIMENSIONS.HEIGHT}px`;
    contentElem.style.display = 'flex';
    contentElem.style.flexDirection = 'column';
    contentElem.style.flex = '1 1 0';
    contentElem.style.minHeight = '0';
  }
  
  // Update separator before footer
  const separator = dialog.querySelector('.separator');
  if (separator) {
    separator.className = 'separator my-2.5';
  }
}

// Unified search input setup for both modal and panel
function setupSearchInput(container, forPanel = false, insertBefore = null) {
  // Style the container
  if (forPanel) {
    container.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px;';
  } else {
    container.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 8px;';
  }
  
  // Create search input container
  const searchContainer = document.createElement('div');
  searchContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; flex: 1;';
  
  // Add search input styles
  addSearchInputStyles();
  
  // Create search input
  const originalPlaceholder = t('mods.vipList.searchPlaceholder');
  const searchInput = createSearchInput(originalPlaceholder, forPanel);
  
  // Create Add button
  const addButton = document.createElement('button');
  addButton.textContent = t('mods.vipList.addButton');
  addButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
  const buttonFontSize = getFontSize(14, forPanel);
  const buttonStyle = `cursor: pointer; white-space: nowrap; box-sizing: border-box; max-height: 21px; height: 21px; font-size: ${buttonFontSize};`;
  addButton.style.cssText = buttonStyle;
  
  // Create add player handler
  const addPlayer = createAddPlayerHandler(searchInput, addButton, originalPlaceholder);
  addButton.addEventListener('click', addPlayer);
  
  // Add Enter key support
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPlayer();
    }
  });
  
  searchContainer.appendChild(searchInput);
  searchContainer.appendChild(addButton);
  
  // Insert search container (before first child for modal, append for panel)
  if (insertBefore) {
    container.insertBefore(searchContainer, insertBefore);
  } else {
    container.appendChild(searchContainer);
  }
}

// Setup search input in modal footer (wrapper for backward compatibility)
function setupModalSearchInput(buttonContainer) {
  setupSearchInput(buttonContainer, false, buttonContainer.firstChild);
}

// =======================
// 12. VIP List Core Functions
// =======================

// Get font size based on interface type (panel vs modal)
// Panel uses smaller fonts (2px reduction) for compact display
function getFontSize(baseSize, forPanel = false) {
  return forPanel ? `${baseSize - 2}px` : `${baseSize}px`;
}

// Common initialization steps for both panel and modal
async function initializeVIPListInterface() {
  // Refresh all VIP player data before opening interface
  await refreshAllVIPPlayerData();
}

function getVIPList() {
  return storage.get(STORAGE_KEYS.DATA, []);
}

// Secondary sort by name helper
function secondarySortByName(a, b, primaryComparison) {
  if (primaryComparison !== 0) return primaryComparison;
  const nameA = (a.name || '').toLowerCase();
  const nameB = (b.name || '').toLowerCase();
  return nameA.localeCompare(nameB);
}

function sortVIPList(vipList, sortColumn = null, sortDirection = null) {
  // Use provided sort params or current sort state
  const column = sortColumn || currentSortState.column;
  const direction = sortDirection || currentSortState.direction;
  
  return [...vipList].sort((a, b) => {
    let comparison = 0;
    
    if (column === 'name') {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      comparison = nameA.localeCompare(nameB);
    } else if (column === 'level') {
      const levelA = parseInt(a.level) || 0;
      const levelB = parseInt(b.level) || 0;
      comparison = levelA - levelB;
      comparison = secondarySortByName(a, b, comparison);
    } else if (column === 'status') {
      // Sort: Online first, then Offline
      const statusA = (a.status || '').toLowerCase();
      const statusB = (b.status || '').toLowerCase();
      if (statusA === 'online' && statusB === 'offline') {
        comparison = -1;
      } else if (statusA === 'offline' && statusB === 'online') {
        comparison = 1;
      } else {
        comparison = statusA.localeCompare(statusB);
      }
      comparison = secondarySortByName(a, b, comparison);
    } else if (column === 'rankPoints') {
      const rankPointsA = parseInt(a.rankPoints) || 0;
      const rankPointsB = parseInt(b.rankPoints) || 0;
      comparison = rankPointsA - rankPointsB;
      comparison = secondarySortByName(a, b, comparison);
    } else if (column === 'timeSum') {
      const timeSumA = parseInt(a.timeSum) || 0;
      const timeSumB = parseInt(b.timeSum) || 0;
      comparison = timeSumA - timeSumB;
      comparison = secondarySortByName(a, b, comparison);
    } else if (column === 'floors') {
      const floorsA = parseInt(a.floors) || 0;
      const floorsB = parseInt(b.floors) || 0;
      comparison = floorsA - floorsB;
      comparison = secondarySortByName(a, b, comparison);
    }
    
    // Apply direction
    return direction === 'asc' ? comparison : -comparison;
  });
}

function saveVIPList(vipList) {
  // Sort before saving using current sort state
  const sortedList = sortVIPList(vipList);
  storage.set(STORAGE_KEYS.DATA, sortedList);
}

function addToVIPList(playerName, playerInfo) {
  const vipList = getVIPList();
  // Check if player already exists
  const existingIndex = vipList.findIndex(vip => vip.name.toLowerCase() === playerName.toLowerCase());
  
  if (existingIndex >= 0) {
    // Update existing entry
    vipList[existingIndex] = playerInfo;
  } else {
    // Add new entry
    vipList.push(playerInfo);
  }
  
  saveVIPList(vipList);
  return vipList;
}

function removeFromVIPList(playerName) {
  const vipList = getVIPList();
  const filteredList = vipList.filter(vip => vip.name.toLowerCase() !== playerName.toLowerCase());
  saveVIPList(filteredList);
  return filteredList;
}

// Rate limiting and caching for player data fetches
const PlayerDataFetcher = {
  cache: new Map(),
  pendingRequests: new Map(),
  
  rateLimit: {
    lastRequestTime: 0,
    requestCount: 0,
    windowStart: 0,
    maxRequests: 25, // Conservative limit (30 per 10s, but leave buffer)
    windowMs: 10000  // 10 seconds
  },
  
  TTL: 2 * 60 * 1000, // 2 minutes cache
  
  getCached(playerName) {
    const key = playerName.toLowerCase();
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (cached.data && cached.data.error) {
      // Don't use cached request_failed errors - they're transient and should retry immediately
      if (cached.data.error === 'request_failed') {
        this.cache.delete(key);
        return null;
      }
      // Only cache rate_limited errors for a short period
      const errorTTL = cached.data.error === 'rate_limited' ? 30000 : 60000;
      if (now - cached.timestamp < errorTTL) {
        return cached.data;
      }
      this.cache.delete(key);
      return null;
    }
    
    if (now - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  },
  
  setCached(playerName, data) {
    const key = playerName.toLowerCase();
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  },
  
  clearCache() {
    this.cache.clear();
    this.pendingRequests.clear();
    this.rateLimit.requestCount = 0;
    this.rateLimit.windowStart = 0;
    this.rateLimit.lastRequestTime = 0;
  },
  
  async waitForRateLimit() {
    const now = Date.now();
    
    // Reset window if it's been more than windowMs since last request
    if (now - this.rateLimit.windowStart > this.rateLimit.windowMs) {
      this.rateLimit.requestCount = 0;
      this.rateLimit.windowStart = now;
    }
    
    // If we've hit the limit, wait until the window resets
    if (this.rateLimit.requestCount >= this.rateLimit.maxRequests) {
      const waitTime = this.rateLimit.windowMs - (now - this.rateLimit.windowStart);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.rateLimit.requestCount = 0;
        this.rateLimit.windowStart = Date.now();
      }
    }
    
    this.rateLimit.requestCount++;
    this.rateLimit.lastRequestTime = Date.now();
  },
  
  async fetch(playerName) {
    const key = playerName.toLowerCase();
    
    // Check cache first
    const cached = this.getCached(key);
    if (cached !== null) {
      if (cached.error) {
        throw new Error(cached.error);
      }
      return cached;
    }
    
    // Check if there's already a pending request for this player
    if (this.pendingRequests.has(key)) {
      return await this.pendingRequests.get(key);
    }
    
    // Create promise for this request
    const fetchPromise = (async () => {
      try {
        await this.waitForRateLimit();
        
        const apiUrl = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(playerName)}%22%7D%7D`;
        
        const response = await fetch(apiUrl, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.status === 429) {
          this.setCached(key, { error: 'rate_limited', timestamp: Date.now() });
          throw new Error('Failed to fetch player data (HTTP 429)');
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch player data (HTTP ${response.status})`);
        }
        
        const data = await response.json();
        
        let profileData = null;
        if (Array.isArray(data) && data[0]?.result?.data?.json !== undefined) {
          profileData = data[0].result.data.json;
          // Check if the result contains an error (player doesn't exist)
          if (data[0]?.result?.error || !profileData || (typeof profileData === 'object' && !profileData.name)) {
            throw new Error('Failed to fetch player data (HTTP 404)');
          }
        } else {
          profileData = data;
          // Check if data is null or doesn't have a name (player doesn't exist)
          if (!profileData || (typeof profileData === 'object' && !profileData.name)) {
            throw new Error('Failed to fetch player data (HTTP 404)');
          }
        }
        
        this.setCached(key, profileData);
        return profileData;
      } catch (error) {
        // Don't cache request_failed errors - they're transient and should retry immediately
        // Only cache rate_limited errors (handled separately above)
        throw error;
      } finally {
        this.pendingRequests.delete(key);
      }
    })();
    
    this.pendingRequests.set(key, fetchPromise);
    return await fetchPromise;
  }
};

async function fetchPlayerData(playerName) {
  try {
    return await PlayerDataFetcher.fetch(playerName);
  } catch (error) {
    // Don't log 404 errors as errors - they're expected when a player doesn't exist
    if (error.message && error.message.includes('HTTP 404')) {
      throw error; // Re-throw without logging
    }
    // Don't log transient network errors - they'll retry automatically
    if (error.message && (error.message === 'request_failed' || error.message.includes('Failed to fetch'))) {
      throw error; // Re-throw without logging
    }
    // Only log unexpected errors (rate limiting, auth issues, etc.)
    console.error('[VIP List] Error fetching player data:', error);
    throw error;
  }
}

async function refreshAllVIPPlayerData() {
  const vipList = getVIPList();
  if (vipList.length === 0) return;
  
  console.log('[VIP List] Refreshing data for', vipList.length, 'VIP players...');
  
  const currentPlayerName = getCurrentPlayerName();
  
  // Process in batches with delays to avoid rate limiting
  const BATCH_SIZE = 5;
  const BATCH_DELAY = 500; // 500ms between batches
  const updatedList = [];
  
  for (let i = 0; i < vipList.length; i += BATCH_SIZE) {
    const batch = vipList.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (vip) => {
      try {
        const profileData = await fetchPlayerData(vip.name || vip.profile);
        
        if (profileData === null) {
          console.warn(`[VIP List] Player "${vip.name}" not found, keeping old data`);
          return vip;
        }
        
        const isCurrentPlayer = currentPlayerName && (profileData.name || vip.name).toLowerCase() === currentPlayerName;
        const playerInfo = extractPlayerInfoFromProfile(profileData, vip.name || vip.profile);
        playerInfo.profile = vip.profile || (profileData.name || vip.name).toLowerCase();
        
        return playerInfo;
      } catch (error) {
        console.error(`[VIP List] Error refreshing data for "${vip.name}":`, error);
        return vip;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    updatedList.push(...batchResults);
    
    // Add delay between batches (except for the last batch)
    if (i + BATCH_SIZE < vipList.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }
  
  // Sort and save the updated list
  saveVIPList(updatedList);
  
  // Update status colors for all open chat tabs
  await updateAllChatTabsStatus();
  console.log('[VIP List] Finished refreshing VIP player data');
  
  return sortVIPList(updatedList);
}

function injectVIPListItem(menuElement) {
  // Check if already processed
  if (processedMenus.has(menuElement)) {
    return false;
  }
  
  // Check if this is the "My Account" menu (support both English and Portuguese)
  const menuText = menuElement.textContent || '';
  const lowerMenuText = menuText.toLowerCase();
  if (!lowerMenuText.includes('my account') && !lowerMenuText.includes('minha conta')) {
    return false;
  }
  
  // Check if VIP List item already exists
  if (menuElement.querySelector('.vip-list-menu-item')) {
    processedMenus.add(menuElement);
    return false;
  }
  
  // Find the group container
  const group = menuElement.querySelector('div[role="group"]');
  if (!group) {
    return false;
  }
  
  // Find the separator before logout (or the logout button itself)
  const menuItems = Array.from(group.querySelectorAll('.dropdown-menu-item'));
  const logoutButton = menuItems.find(item => 
    item.textContent?.toLowerCase().includes('logout') || 
    item.querySelector('button')
  );
  
  if (!logoutButton) {
    return false;
  }
  
  // Create VIP List menu item
  const vipListItem = document.createElement('div');
  vipListItem.className = 'dropdown-menu-item relative flex cursor-default select-none items-center gap-2 outline-none text-whiteRegular vip-list-menu-item';
  vipListItem.setAttribute('role', 'menuitem');
  vipListItem.setAttribute('tabindex', '-1');
  vipListItem.setAttribute('data-orientation', 'vertical');
  vipListItem.setAttribute('data-radix-collection-item', '');
  
  // Add icon (using a star icon similar to other menu items)
  vipListItem.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
    ${t('mods.vipList.menuItem')}
  `;
  
  // Add click handler
  vipListItem.addEventListener('click', (e) => {
    e.stopPropagation();
    const interfaceType = getVIPListInterfaceType();
    if (interfaceType === 'panel') {
      openVIPListPanel();
    } else {
      openVIPListModal();
    }
    // Close the menu
    const timeoutId = setTimeout(() => {
      pendingTimeouts.delete(timeoutId);
      document.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'Escape', 
        code: 'Escape', 
        keyCode: 27, 
        bubbles: true 
      }));
    }, TIMEOUTS.SHORT);
    trackTimeout(timeoutId);
  });
  
  // Add hover effects
  vipListItem.addEventListener('mouseenter', () => {
    vipListItem.style.background = 'rgba(255, 255, 255, 0.15)';
  });
  vipListItem.addEventListener('mouseleave', () => {
    vipListItem.style.background = 'transparent';
  });
  
  // Insert before the separator before logout (or before logout button)
  const separator = logoutButton.previousElementSibling;
  if (separator && separator.classList.contains('separator')) {
    separator.insertAdjacentElement('beforebegin', vipListItem);
  } else {
    logoutButton.insertAdjacentElement('beforebegin', vipListItem);
  }
  
  // Add separator before VIP List item if needed
  const prevItem = vipListItem.previousElementSibling;
  if (!prevItem || !prevItem.classList.contains('separator')) {
    const separator = document.createElement('div');
    separator.setAttribute('role', 'none');
    separator.setAttribute('aria-orientation', 'horizontal');
    separator.className = 'separator my-1';
    vipListItem.insertAdjacentElement('beforebegin', separator);
  }
  
  processedMenus.add(menuElement);
  console.log('[VIP List] Successfully injected VIP List menu item');
  return true;
}

function createVIPBox({headerRow, content}) {
  const box = document.createElement('div');
  box.style.flex = '1 1 0';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.margin = '0';
  box.style.padding = '0';
  box.style.minHeight = '0';
  box.style.height = '100%';
  box.style.background = `url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat`;
  box.style.border = '4px solid transparent';
  box.style.borderImage = CSS_CONSTANTS.BORDER_4_FRAME;
  box.style.borderRadius = '6px';
  box.style.overflow = 'hidden';
  
  // Replace title with header row
  const titleEl = document.createElement('h2');
  titleEl.className = 'widget-top widget-top-text';
  titleEl.style.margin = '0';
  titleEl.style.padding = '0';
  titleEl.style.textAlign = 'center';
  titleEl.style.color = CSS_CONSTANTS.COLORS.TEXT_WHITE;
  titleEl.style.display = 'flex';
  titleEl.style.flexDirection = 'row';
  titleEl.style.alignItems = 'center';
  titleEl.style.width = '100%';
  titleEl.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  titleEl.style.fontSize = '14px';
  titleEl.style.fontWeight = '600';
  titleEl.style.letterSpacing = '0.3px';
  
  // Append header row directly to title area (not cloned to preserve event listeners)
  if (headerRow) {
    // Remove sticky positioning since it's now static in title area
    headerRow.style.position = 'static';
    headerRow.style.top = 'auto';
    headerRow.style.zIndex = 'auto';
    headerRow.style.marginBottom = '0';
    headerRow.style.width = '100%';
    titleEl.appendChild(headerRow);
  }
  box.appendChild(titleEl);
  
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'column-content-wrapper';
  contentWrapper.style.flex = '1 1 0';
  contentWrapper.style.width = '100%';
  contentWrapper.style.height = '100%';
  contentWrapper.style.minHeight = '0';
  contentWrapper.style.overflowY = 'auto';
  contentWrapper.style.display = 'flex';
  contentWrapper.style.flexDirection = 'column';
  contentWrapper.style.padding = '3px';
  
  if (typeof content === 'string') {
    contentWrapper.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    contentWrapper.appendChild(content);
  }
  box.appendChild(contentWrapper);
  return box;
}

function createVIPHeaderRow(forPanel = false) {
  const fontSize = getFontSize(13, forPanel);
  const indicatorFontSize = getFontSize(12, forPanel);
  const headerRow = document.createElement('div');
  headerRow.className = 'vip-header-row';
  // For panels, remove redundant styling since vip-panel-header-row-container already handles it
  const padding = forPanel ? '0' : '8px 0';
  const marginBottom = forPanel ? '0' : '4px';
  const background = forPanel ? 'transparent' : 'rgba(255, 255, 255, 0.1)';
  const borderBottom = forPanel ? 'none' : '2px solid rgba(255, 255, 255, 0.2)';
  headerRow.style.cssText = `
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: ${padding};
    margin-bottom: ${marginBottom};
    background: ${background};
    border-bottom: ${borderBottom};
    font-weight: 600;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: ${fontSize};
    letter-spacing: 0.2px;
    width: 100%;
  `;
  
  const createHeaderCell = (text, flex = '1', column = null, iconUrl = null) => {
    const cell = document.createElement('div');
    cell.style.cssText = `flex: ${flex}; color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; text-align: center; white-space: nowrap; position: relative; font-family: system-ui, -apple-system, sans-serif; font-size: ${fontSize}; font-weight: 600; letter-spacing: 0.2px;`;
    
    if (column) {
      // Make it clickable
      cell.style.cursor = 'pointer';
      cell.style.userSelect = 'none';
      cell.style.display = 'flex';
      cell.style.alignItems = 'center';
      cell.style.justifyContent = 'center';
      
      // Add hover effect
      cell.addEventListener('mouseenter', () => {
        cell.style.background = 'rgba(255, 255, 255, 0.15)';
      });
      cell.addEventListener('mouseleave', () => {
        cell.style.background = 'transparent';
      });
      
      // Add click handler
      cell.addEventListener('click', async () => {
        // Toggle direction if clicking same column, otherwise set default direction
        if (currentSortState.column === column) {
          currentSortState.direction = currentSortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
          currentSortState.column = column;
        // For level, rankPoints, timeSum, and floors, default to desc (higher is better)
        // For other columns, default to asc
        currentSortState.direction = (column === 'level' || column === 'rankPoints' || column === 'timeSum' || column === 'floors') ? 'desc' : 'asc';
        }
        
        saveSortPreference();
        await refreshVIPListDisplay();
      });
      
      // Create content (icon or text) - centered
      if (iconUrl) {
        const iconImg = document.createElement('img');
        iconImg.src = iconUrl;
        iconImg.alt = text;
        // Special sizing for floor-15 icon (14x7)
        const isFloorIcon = iconUrl.includes('floor-15');
        iconImg.style.cssText = isFloorIcon 
          ? 'width: 14px; height: 7px; image-rendering: pixelated; display: block;'
          : 'width: 11px; height: 11px; image-rendering: pixelated; display: block;';
        cell.appendChild(iconImg);
      } else {
        const textSpan = document.createElement('span');
        textSpan.textContent = text;
        textSpan.style.whiteSpace = 'nowrap';
        cell.appendChild(textSpan);
      }
      
      // Add sort indicator positioned to the right
      const indicator = document.createElement('span');
      indicator.style.cssText = `font-size: ${indicatorFontSize}; color: rgba(255, 255, 255, 0.7); margin-left: 4px;`;
      
      if (currentSortState.column === column) {
        indicator.textContent = currentSortState.direction === 'asc' ? '↑' : '↓';
        indicator.style.color = CSS_CONSTANTS.COLORS.LINK;
      } else {
        indicator.textContent = '↕';
        indicator.style.opacity = '0.3';
      }
      
      cell.appendChild(indicator);
      
      // Add invisible spacer to balance the arrow and keep text centered
      const spacer = document.createElement('span');
      spacer.style.cssText = 'width: 12px; visibility: hidden;';
      cell.insertBefore(spacer, cell.firstChild);
    } else {
      // Non-clickable separator
      cell.textContent = text;
    }
    
    return cell;
  };
  
  headerRow.appendChild(createHeaderCell(t('mods.vipList.columnName'), '2.0', 'name'));
  headerRow.appendChild(createHeaderCell(t('mods.vipList.columnLevel'), '0.8', 'level'));
  headerRow.appendChild(createHeaderCell(t('mods.vipList.columnStatus'), '0.9', 'status'));
  headerRow.appendChild(createHeaderCell(t('mods.vipList.columnRankPoints'), '0.9', 'rankPoints', 'https://bestiaryarena.com/assets/icons/star-tier.png'));
  headerRow.appendChild(createHeaderCell(t('mods.vipList.columnTimeSum'), '0.9', 'timeSum', 'https://bestiaryarena.com/assets/icons/speed.png'));
  headerRow.appendChild(createHeaderCell(t('mods.vipList.columnFloors'), '0.9', 'floors', 'https://bestiaryarena.com/assets/UI/floor-15.png'));
  
  return headerRow;
}

async function createVIPListItem(vip, forPanel = false) {
  const dropdownFontSize = getFontSize(14, forPanel);
  const cellFontSize = getFontSize(14, forPanel);
  const item = document.createElement('div');
  // Only set font-size explicitly for panel; modal inherits from parent
  const itemStyle = getFontSizeStyle(cellFontSize, forPanel);
  item.style.cssText = `
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 8px 0;
    margin-bottom: 4px;
    background: rgba(255, 255, 255, 0.05);
    width: 100%;
    ${itemStyle}
  `;
  
  // Check if this VIP is the current player
  const currentPlayerName = getCurrentPlayerName();
  const isCurrentPlayer = currentPlayerName && vip.name.toLowerCase() === currentPlayerName;
  const displayName = isCurrentPlayer ? `${vip.name} ${t('mods.vipList.currentPlayerSuffix')}` : vip.name;
  
  const createCell = (content, flex = '1', isLink = false, tooltip = null) => {
    const cell = document.createElement('div');
    // Only set font-size explicitly for panel; modal inherits from parent
    const cellFontStyle = getFontSizeStyle(cellFontSize, forPanel);
    cell.style.cssText = `flex: ${flex}; text-align: center; position: relative; ${cellFontStyle}`;
    
    if (isLink) {
      const link = document.createElement('a');
      link.href = content.href;
      link.target = '_blank';
      link.textContent = content.text;
      const linkFontStyle = getFontSizeStyle(cellFontSize, forPanel);
      link.style.cssText = `color: ${CSS_CONSTANTS.COLORS.LINK}; text-decoration: underline; cursor: pointer; ${linkFontStyle}`;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(content.href, '_blank');
      });
      cell.appendChild(link);
    } else {
      cell.textContent = content;
      cell.style.color = typeof content === 'string' ? getStatusColor(content) : CSS_CONSTANTS.COLORS.TEXT_PRIMARY;
      
      // Add tooltip if provided
      if (tooltip) {
        cell.style.cursor = 'help';
        cell.title = tooltip;
      }
    }
    
    return cell;
  };
  
  const createSeparator = () => {
    const sep = document.createElement('div');
    sep.textContent = '|';
    sep.style.cssText = 'flex: 0.1; color: rgba(255, 255, 255, 0.3); text-align: center;';
    return sep;
  };
  
  // Create name cell with dropdown menu
  const nameCell = document.createElement('div');
  nameCell.style.cssText = 'flex: 2.0; text-align: center; position: relative;';
  
  const nameButton = document.createElement('button');
  nameButton.type = 'button'; // Explicitly set type to prevent any default form behavior
  
  // Check if player is blocked
  const isBlocked = MESSAGING_CONFIG.enabled ? await isPlayerBlocked(vip.name) : false;
  const nameColor = isBlocked ? CSS_CONSTANTS.COLORS.ERROR : CSS_CONSTANTS.COLORS.TEXT_PRIMARY;
  
  // Only set font-size explicitly for panel; modal inherits from parent
  const buttonFontStyle = getFontSizeStyle(cellFontSize, forPanel);
  nameButton.style.cssText = `
    background: transparent;
    border: none;
    color: ${nameColor};
    cursor: pointer;
    padding: 0;
    text-decoration: none;
    ${buttonFontStyle}
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  `;
  
  // Create player name span (underlined)
  const nameSpan = document.createElement('span');
  nameSpan.textContent = vip.name;
  const spanFontStyle = getFontSizeStyle(cellFontSize, forPanel);
  nameSpan.style.cssText = `text-decoration: underline; margin-left: 15px; color: ${nameColor}; ${spanFontStyle}`;
  nameButton.appendChild(nameSpan);
  
  // Add "(you)" span if current player (not underlined, italic, light blue)
  if (isCurrentPlayer) {
    const youSpan = document.createElement('span');
    youSpan.textContent = ` ${t('mods.vipList.currentPlayerSuffix')}`;
    youSpan.style.cssText = `text-decoration: none; font-style: italic; color: ${CSS_CONSTANTS.COLORS.LINK}; ${spanFontStyle}`;
    nameButton.appendChild(youSpan);
  }
  
  // Add chat icon indicator for unread messages (only if messaging enabled and not current player)
  let chatIcon = null;
  if (!isCurrentPlayer && MESSAGING_CONFIG.enabled) {
    chatIcon = document.createElement('img');
    chatIcon.src = 'https://bestiaryarena.com/assets/icons/chat.png';
    chatIcon.alt = 'Unread messages';
    chatIcon.className = 'vip-chat-indicator';
    chatIcon.style.cssText = `
      width: 12px;
      height: 11px;
      image-rendering: pixelated;
      display: none;
      margin-left: 4px;
      opacity: 0.9;
    `;
    nameButton.appendChild(chatIcon);
    
    // Check for unread messages and show icon if needed
    try {
      const messages = await getConversationMessages(vip.name);
      const unreadCount = await getPlayerUnreadCount(messages, vip.name);
      if (unreadCount > 0) {
        chatIcon.style.display = 'block';
      }
    } catch (error) {
      // Silently fail - icon will remain hidden
    }
  }
  
  // Dropdown menu
  const dropdown = createDropdownElement();
  
  // Only set font-size explicitly for panel; modal inherits from parent
  const dropdownFontSizeOption = forPanel ? dropdownFontSize : '';
  
  // Always create all dropdown items (Profile, Cyclopedia, Send Message, Remove VIP)
  // This ensures consistency between modal and panel views
  dropdown.appendChild(createDropdownItem(t('mods.vipList.dropdownProfile'), () => {
    window.open(`/profile/${vip.profile}`, '_blank');
  }, dropdown, { fontSize: dropdownFontSizeOption }));
  
  // Create Cyclopedia item with data attribute to prevent Cyclopedia mod from hiding it
  const cyclopediaMenuItem = createDropdownItem(t('mods.vipList.dropdownCyclopedia'), () => {
    openCyclopediaForPlayer(vip.name); // Don't close VIP list when opening cyclopedia
  }, dropdown, {
    fontSize: dropdownFontSizeOption,
    dataAttributes: {
      'data-vip-list-item': 'true',
      'data-cyclopedia-exclude': 'true'
    }
  });
  cyclopediaMenuItem.style.display = '';
  dropdown.appendChild(cyclopediaMenuItem);
  
  // Add Send Message option (only if not current player and messaging enabled)
  if (!isCurrentPlayer && MESSAGING_CONFIG.enabled) {
    dropdown.appendChild(createDropdownItem(t('mods.vipList.dropdownSendMessage'), () => {
      openMessageDialog(vip.name);
    }, dropdown, { color: CSS_CONSTANTS.COLORS.LINK, fontSize: dropdownFontSizeOption }));
  }
  
  dropdown.appendChild(createDropdownItem(t('mods.vipList.dropdownRemoveVIP'), async () => {
    removeFromVIPList(vip.name);
    await refreshVIPListDisplay();
  }, dropdown, { color: CSS_CONSTANTS.COLORS.OFFLINE, fontSize: dropdownFontSizeOption }));
  
  nameButton.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent default button behavior
    e.stopPropagation(); // Prevent event bubbling
    // Find container - check for both modal and panel containers, and scrollable parents
    const container = findDropdownContainer(nameCell);
    toggleDropdown(dropdown, nameButton, container, {
      cyclopediaMenuItem: cyclopediaMenuItem
    });
  });
  
  // Setup global click handler for closing dropdowns (only once)
  setupVIPDropdownClickHandler();
  nameCell.appendChild(nameButton);
  nameCell.appendChild(dropdown);
  
  // Store reference to this item for updating chat icon
  vipListItems.set(vip.name.toLowerCase(), { item, chatIcon });
  
  item.appendChild(nameCell);
  item.appendChild(createCell(vip.level, '0.8'));
  
  // Add tooltip for offline status
  const offlineText = t('mods.vipList.statusOffline');
  const statusTooltip = vip.status === offlineText && vip.lastUpdatedAt 
    ? tReplace('mods.vipList.tooltipLastOnline', { time: formatLastOnline(vip.lastUpdatedAt) })
    : null;
  item.appendChild(createCell(vip.status, '0.9', false, statusTooltip));
  
  // Format rankPoints with locale string (e.g., 386)
  const rankPointsCell = createCell((vip.rankPoints !== undefined ? vip.rankPoints.toLocaleString() : '0'), '0.9');
  item.appendChild(rankPointsCell);
  
  // Format timeSum with locale string (e.g., 14 181)
  const timeSumCell = createCell((vip.timeSum !== undefined ? vip.timeSum.toLocaleString() : '0'), '0.9');
  item.appendChild(timeSumCell);
  
  // Format floors with locale string
  const floorsCell = createCell((vip.floors !== undefined ? vip.floors.toLocaleString() : '0'), '0.9');
  item.appendChild(floorsCell);
  
  return item;
}

async function getVIPListContent(forPanel = false) {
  // Clear VIP list items map when refreshing
  vipListItems.clear();
  
  const vipList = getVIPList();
  
  // Sort VIP list using current sort state
  const sortedList = sortVIPList(vipList);
  
  const container = document.createElement('div');
  container.style.cssText = 'width: 100%; display: flex; flex-direction: column;';
  
  // Header row is now in the title area, so don't add it here
  
  // Add VIP items
  if (sortedList.length === 0) {
    const emptyMessage = document.createElement('div');
    const emptyFontSize = getFontSize(14, forPanel);
    emptyMessage.style.cssText = `
      padding: 20px;
      text-align: center;
      color: rgba(255, 255, 255, 0.6);
      font-size: ${emptyFontSize};
    `;
    emptyMessage.textContent = t('mods.vipList.emptyState');
    container.appendChild(emptyMessage);
  } else {
    // Create items in parallel for better performance
    const items = await Promise.all(sortedList.map(vip => createVIPListItem(vip, forPanel)));
    items.forEach(item => container.appendChild(item));
  }
  
  return container;
}

// Refresh header row for a given container
function refreshHeaderRow(container, forPanel) {
  if (forPanel) {
    // Panel: header is in a dedicated container
    const headerContainer = container.querySelector('.vip-panel-header-row-container');
    if (headerContainer) {
      const existingHeader = headerContainer.querySelector('.vip-header-row');
      if (existingHeader) {
        existingHeader.remove();
      }
      const newHeaderRow = createVIPHeaderRow(true);
      headerContainer.appendChild(newHeaderRow);
    }
  } else {
    // Modal: header is in the title element
    const vipBox = container.closest('div[style*="background"]');
    if (vipBox) {
      const titleEl = vipBox.querySelector('h2.widget-top.widget-top-text');
      if (titleEl) {
        const existingHeader = titleEl.querySelector('.vip-header-row');
        if (existingHeader) {
          existingHeader.remove();
        }
        const newHeaderRow = createVIPHeaderRow(false);
        newHeaderRow.style.position = 'static';
        newHeaderRow.style.top = 'auto';
        newHeaderRow.style.zIndex = 'auto';
        newHeaderRow.style.marginBottom = '0';
        newHeaderRow.style.width = '100%';
        // Ensure title element has proper font styling
        titleEl.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        titleEl.style.fontSize = '14px';
        titleEl.style.fontWeight = '600';
        titleEl.style.letterSpacing = '0.3px';
        titleEl.appendChild(newHeaderRow);
      }
    }
  }
}

// Refresh content for a given container
async function refreshContent(container, forPanel) {
  const contentWrapper = forPanel
    ? container.querySelector('.vip-panel-content-wrapper')
    : container.querySelector('.column-content-wrapper');
  
  if (contentWrapper) {
    // Build new content first to avoid flicker
    const newContent = await getVIPListContent(forPanel);
    // Replace content atomically to prevent flicker
    contentWrapper.replaceChildren(newContent);
  }
}

async function refreshVIPListDisplay() {
  // Refresh modal display
  if (vipListModalInstance) {
    // Find the VIP box container (parent of .column-content-wrapper)
    const vipListBox = vipListModalInstance.querySelector('.column-content-wrapper')?.closest('div[style*="background"]');
    if (vipListBox) {
      refreshHeaderRow(vipListBox, false);
      await refreshContent(vipListBox, false);
    } else {
      // Fallback: try to find it another way
      const contentWrapper = vipListModalInstance.querySelector('.column-content-wrapper');
      if (contentWrapper) {
        refreshHeaderRow(contentWrapper, false);
        await refreshContent(contentWrapper, false);
      }
    }
  }
  
  // Refresh panel display
  if (vipListPanelInstance) {
    refreshHeaderRow(vipListPanelInstance, true);
    await refreshContent(vipListPanelInstance, true);
  }
}

function createStyledIconButton(iconText, forPanel = false) {
  const fontSize = getFontSize(16, forPanel);
  const button = document.createElement('button');
  button.textContent = iconText;
  button.style.cssText = `
    background: transparent;
    border: none;
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    cursor: pointer;
    padding: 4px 8px;
    font-size: ${fontSize};
    font-weight: bold;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
  `;
  addHoverEffect(button, 'rgba(255, 255, 255, 0.15)');
  return button;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function savePanelSettings(panel, isOpen = true, closedManually = false) {
  if (!panel) return;
  
  try {
    const rect = panel.getBoundingClientRect();
    const settings = {
      width: panel.style.width || `${PANEL_DIMENSIONS.WIDTH}px`,
      height: panel.style.height || `${PANEL_DIMENSIONS.HEIGHT}px`,
      top: rect.top + 'px',
      left: rect.left + 'px',
      isOpen: isOpen,
      closedManually: closedManually
    };
    
    if (storage.set(STORAGE_KEYS.PANEL_SETTINGS, settings)) {
      console.log('[VIP List] Panel settings saved:', settings);
    }
  } catch (error) {
    console.error('[VIP List] Error saving panel settings:', error);
  }
}

function loadPanelSettings() {
  const saved = storage.get(STORAGE_KEYS.PANEL_SETTINGS);
  if (saved) {
    console.log('[VIP List] Panel settings loaded:', saved);
    return saved;
  }
  
  // Return default settings
  return {
    width: `${PANEL_DIMENSIONS.WIDTH}px`,
    height: `${PANEL_DIMENSIONS.HEIGHT}px`,
    top: '50px',
    left: '10px',
    isOpen: false,
    closedManually: false
  };
}

// Apply panel settings to panel element
function applyPanelSettings(panel, settings) {
  if (!panel || !settings) return;
  
  try {
    // Apply width (clamp to valid range)
    if (settings.width) {
      const width = parseInt(settings.width);
      const clampedWidth = clamp(width, PANEL_DIMENSIONS.MIN_WIDTH, PANEL_DIMENSIONS.MAX_WIDTH);
      panel.style.width = clampedWidth + 'px';
    }
    
    // Apply height (clamp to valid range)
    if (settings.height) {
      const height = parseInt(settings.height);
      const clampedHeight = clamp(height, PANEL_DIMENSIONS.MIN_HEIGHT, PANEL_DIMENSIONS.MAX_HEIGHT);
      panel.style.height = clampedHeight + 'px';
    }
    
    // Apply top position (ensure panel stays within viewport)
    if (settings.top) {
      const top = parseInt(settings.top);
      const maxTop = window.innerHeight - PANEL_DIMENSIONS.MIN_HEIGHT;
      const clampedTop = clamp(top, 0, Math.max(0, maxTop));
      panel.style.top = clampedTop + 'px';
    }
    
    // Apply left position (ensure panel stays within viewport)
    if (settings.left) {
      const left = parseInt(settings.left);
      const maxLeft = window.innerWidth - PANEL_DIMENSIONS.MIN_WIDTH;
      const clampedLeft = clamp(left, 0, Math.max(0, maxLeft));
      panel.style.left = clampedLeft + 'px';
    }
    
    console.log('[VIP List] Panel settings applied:', settings);
  } catch (error) {
    console.error('[VIP List] Error applying panel settings:', error);
  }
}

// Setup search input in panel footer (wrapper for backward compatibility)
function setupPanelSearchInput(panel) {
  const footerContainer = panel.querySelector('.vip-panel-footer');
  if (!footerContainer) return;
  setupSearchInput(footerContainer, true);
}

// Unified auto-refresh setup for both modal and panel
function setupAutoRefresh(type) {
  // Clear existing interval
  if (vipListRefreshInterval) {
    clearInterval(vipListRefreshInterval);
    vipListRefreshInterval = null;
  }
  
  // Setup new interval
  vipListRefreshInterval = setInterval(async () => {
    // Check if instance is still open
    const instance = type === 'panel' ? vipListPanelInstance : vipListModalInstance;
    if (!instance || !document.contains(instance)) {
      clearInterval(vipListRefreshInterval);
      vipListRefreshInterval = null;
      return;
    }
    
    try {
      await refreshAllVIPPlayerData();
      await refreshVIPListDisplay();
    } catch (error) {
      console.error(`[VIP List] Error refreshing ${type} data:`, error);
    }
  }, 60000); // 1 minute = 60000 ms
}

// Cleanup auto-refresh interval
function cleanupAutoRefresh() {
  if (vipListRefreshInterval) {
    clearInterval(vipListRefreshInterval);
    vipListRefreshInterval = null;
  }
}

// Cleanup panel event listeners
function cleanupPanelEventListeners() {
  if (panelResizeMouseMoveHandler) {
    document.removeEventListener('mousemove', panelResizeMouseMoveHandler);
    panelResizeMouseMoveHandler = null;
  }
  if (panelResizeMouseUpHandler) {
    document.removeEventListener('mouseup', panelResizeMouseUpHandler);
    panelResizeMouseUpHandler = null;
  }
  if (panelDragMouseMoveHandler) {
    document.removeEventListener('mousemove', panelDragMouseMoveHandler);
    panelDragMouseMoveHandler = null;
  }
  if (panelDragMouseUpHandler) {
    document.removeEventListener('mouseup', panelDragMouseUpHandler);
    panelDragMouseUpHandler = null;
  }
  // Clean up VIP List panel event listeners (memory leak prevention)
  if (vipListPanelInstance) {
    if (vipListPanelTitleRowMousedownHandler) {
      const titleRow = vipListPanelInstance.querySelector('.vip-list-panel-title-row');
      if (titleRow) {
        titleRow.removeEventListener('mousedown', vipListPanelTitleRowMousedownHandler);
      }
      vipListPanelTitleRowMousedownHandler = null;
    }
    if (vipListPanelMousemoveHandler) {
      vipListPanelInstance.removeEventListener('mousemove', vipListPanelMousemoveHandler);
      vipListPanelMousemoveHandler = null;
    }
    if (vipListPanelMousedownHandler) {
      vipListPanelInstance.removeEventListener('mousedown', vipListPanelMousedownHandler);
      vipListPanelMousedownHandler = null;
    }
  }
}

// Check if panel should be reopened after page refresh
function shouldReopenVIPListPanel() {
  const interfaceType = getVIPListInterfaceType();
  if (interfaceType !== 'panel') {
    console.log('[VIP List] Interface type is not panel, not auto-reopening');
    return false;
  }
  
  const savedSettings = loadPanelSettings();
  console.log('[VIP List] Checking auto-reopen conditions:', {
    savedSettings,
    interfaceType: interfaceType
  });
  
  // Auto-reopen if panel was open and not manually closed
  return savedSettings.isOpen && !savedSettings.closedManually;
}

// Auto-reopen VIP List panel after page refresh
function autoReopenVIPListPanel() {
  if (shouldReopenVIPListPanel()) {
    console.log('[VIP List] Auto-reopening panel after page refresh');
    const timeoutId = setTimeout(() => {
      pendingTimeouts.delete(timeoutId);
      openVIPListPanel();
    }, TIMEOUTS.INITIAL_CHECK); // Wait for page to fully load
    trackTimeout(timeoutId);
  } else {
    console.log('[VIP List] Not auto-reopening panel:', {
      interfaceType: getVIPListInterfaceType(),
      savedSettings: loadPanelSettings()
    });
  }
}

// Handle panel close button click
function handlePanelCloseButtonClick(panel) {
  // Save panel settings before closing (mark as closed manually)
  savePanelSettings(panel, false, true);
  
  // Remove document event listeners
  cleanupPanelEventListeners();
  
  // Clear refresh interval
  cleanupAutoRefresh();
  
  // Remove panel-specific event listeners before removing panel (memory leak prevention)
  if (vipListPanelTitleRowMousedownHandler) {
    const titleRow = panel.querySelector('.vip-list-panel-title-row');
    if (titleRow) {
      titleRow.removeEventListener('mousedown', vipListPanelTitleRowMousedownHandler);
    }
    vipListPanelTitleRowMousedownHandler = null;
  }
  if (vipListPanelMousemoveHandler) {
    panel.removeEventListener('mousemove', vipListPanelMousemoveHandler);
    vipListPanelMousemoveHandler = null;
  }
  if (vipListPanelMousedownHandler) {
    panel.removeEventListener('mousedown', vipListPanelMousedownHandler);
    vipListPanelMousedownHandler = null;
  }
  
  // Remove the panel
  panel.remove();
  vipListPanelInstance = null;
  console.log('[VIP List] Panel closed');
}

// Create and open VIP List HTML panel
async function openVIPListPanel() {
  try {
    // Check if panel already exists
    const existingPanel = document.getElementById(PANEL_ID);
    if (existingPanel) {
      console.log('[VIP List] Panel already exists, focusing...');
      existingPanel.style.zIndex = '9999';
      return;
    }
    
    // Common initialization
    await initializeVIPListInterface();
    
    // Load saved panel settings
    const savedSettings = loadPanelSettings();
    
    // Create main panel container
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = `
      position: fixed;
      top: ${savedSettings.top};
      left: ${savedSettings.left};
      width: ${savedSettings.width};
      height: ${savedSettings.height};
      min-width: ${PANEL_DIMENSIONS.MIN_WIDTH}px;
      max-width: ${PANEL_DIMENSIONS.MAX_WIDTH}px;
      min-height: ${PANEL_DIMENSIONS.MIN_HEIGHT}px;
      max-height: ${PANEL_DIMENSIONS.MAX_HEIGHT}px;
      background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
      border: 6px solid transparent;
      border-image: ${CSS_CONSTANTS.BORDER_3_FRAME};
      border-radius: 6px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    `;
    
    // Apply saved settings (validates and clamps values)
    applyPanelSettings(panel, savedSettings);
    
    // Create header section
    const headerContainer = document.createElement('div');
    headerContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 2px solid rgba(255, 255, 255, 0.1);
      flex-shrink: 0;
    `;
    
    // Title and controls row
    const titleRow = document.createElement('div');
    titleRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      cursor: move;
      user-select: none;
    `;
    
    const title = document.createElement('h3');
    title.textContent = t('mods.vipList.modalTitle');
    title.style.cssText = `
      margin: 0;
      padding: 0;
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: 14px;
      font-weight: 600;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    
    const headerControls = document.createElement('div');
    headerControls.style.cssText = 'display: flex; gap: 4px; align-items: center;';
    
    const closeBtn = createStyledIconButton('✕', true); // true = for panel
    closeBtn.title = t('mods.vipList.closeButton');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePanelCloseButtonClick(panel);
    });
    
    headerControls.appendChild(closeBtn);
    titleRow.appendChild(title);
    titleRow.appendChild(headerControls);
    headerContainer.appendChild(titleRow);
    
    // Header row container (for sortable columns)
    const headerRowContainer = document.createElement('div');
    headerRowContainer.className = 'vip-panel-header-row-container';
    headerRowContainer.style.cssText = `
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border-bottom: 2px solid rgba(255, 255, 255, 0.2);
    `;
    const headerRow = createVIPHeaderRow(true); // true = for panel
    headerRowContainer.appendChild(headerRow);
    headerContainer.appendChild(headerRowContainer);
    
    panel.appendChild(headerContainer);
    
    // Content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'vip-panel-content-wrapper';
    contentWrapper.style.cssText = `
      flex: 1 1 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 8px;
      min-height: 0;
    `;
    const content = await getVIPListContent(true); // true = panel
    contentWrapper.appendChild(content);
    panel.appendChild(contentWrapper);
    
    // Footer with search input
    const footerContainer = document.createElement('div');
    footerContainer.className = 'vip-panel-footer';
    footerContainer.style.cssText = `
      border-top: 2px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.05);
      flex-shrink: 0;
    `;
    panel.appendChild(footerContainer);
    setupPanelSearchInput(panel);
    
    // Add to document
    document.body.appendChild(panel);
    vipListPanelInstance = panel;
    
    // Save panel state as open
    savePanelSettings(panel, true, false);
    
    // --- DRAGGABLE PANEL LOGIC ---
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    
    vipListPanelTitleRowMousedownHandler = function(e) {
      if (e.target.tagName === 'BUTTON') return; // Don't drag if clicking a button
      isDragging = true;
      const rect = panel.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      panel.style.cursor = 'move';
      e.preventDefault();
    };
    titleRow.addEventListener('mousedown', vipListPanelTitleRowMousedownHandler);
    
    panelDragMouseMoveHandler = function(e) {
      if (!isDragging) return;
      const newLeft = e.clientX - dragOffsetX;
      const newTop = e.clientY - dragOffsetY;
      
      // Clamp to viewport bounds
      const maxLeft = window.innerWidth - panel.offsetWidth;
      const maxTop = window.innerHeight - panel.offsetHeight;
      
      panel.style.left = clamp(newLeft, 0, maxLeft) + 'px';
      panel.style.top = clamp(newTop, 0, maxTop) + 'px';
      panel.style.transition = 'none';
    };
    document.addEventListener('mousemove', panelDragMouseMoveHandler);
    
    panelDragMouseUpHandler = function() {
      if (isDragging) {
        isDragging = false;
        panel.style.cursor = '';
        panel.style.transition = '';
        // Save panel position after dragging ends
        savePanelSettings(panel);
      }
    };
    document.addEventListener('mouseup', panelDragMouseUpHandler);
    // --- END DRAGGABLE PANEL LOGIC ---
    
    // --- RESIZABLE PANEL LOGIC ---
    const edgeSize = 8; // px, area near edge/corner to trigger resize
    let isResizing = false;
    let resizeDir = '';
    let resizeStartX = 0;
    let resizeStartY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let startLeft = 0;
    let startTop = 0;
    
    function getResizeDirection(e) {
      const rect = panel.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let dir = '';
      
      if (y < edgeSize) dir += 'n';
      else if (y > rect.height - edgeSize) dir += 's';
      if (x < edgeSize) dir += 'w';
      else if (x > rect.width - edgeSize) dir += 'e';
      
      return dir;
    }
    
    vipListPanelMousemoveHandler = function(e) {
      if (isResizing) return;
      const dir = getResizeDirection(e);
      let cursor = '';
      switch (dir) {
        case 'n': cursor = 'ns-resize'; break;
        case 's': cursor = 'ns-resize'; break;
        case 'e': cursor = 'ew-resize'; break;
        case 'w': cursor = 'ew-resize'; break;
        case 'ne': cursor = 'nesw-resize'; break;
        case 'nw': cursor = 'nwse-resize'; break;
        case 'se': cursor = 'nwse-resize'; break;
        case 'sw': cursor = 'nesw-resize'; break;
        default: cursor = '';
      }
      panel.style.cursor = cursor || '';
    };
    panel.addEventListener('mousemove', vipListPanelMousemoveHandler);
    
    vipListPanelMousedownHandler = function(e) {
      if (e.target.tagName === 'BUTTON' || titleRow.contains(e.target)) return;
      const dir = getResizeDirection(e);
      if (!dir) return;
      isResizing = true;
      resizeDir = dir;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      const rect = panel.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;
      startLeft = rect.left;
      startTop = rect.top;
      document.body.style.userSelect = 'none';
      e.preventDefault();
    };
    panel.addEventListener('mousedown', vipListPanelMousedownHandler);
    
    panelResizeMouseMoveHandler = function(e) {
      if (!isResizing) return;
      let dx = e.clientX - resizeStartX;
      let dy = e.clientY - resizeStartY;
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;
      
      if (resizeDir.includes('e')) {
        newWidth = clamp(startWidth + dx, PANEL_DIMENSIONS.MIN_WIDTH, PANEL_DIMENSIONS.MAX_WIDTH);
      }
      if (resizeDir.includes('w')) {
        newWidth = clamp(startWidth - dx, PANEL_DIMENSIONS.MIN_WIDTH, PANEL_DIMENSIONS.MAX_WIDTH);
        newLeft = startLeft + dx;
      }
      if (resizeDir.includes('s')) {
        newHeight = clamp(startHeight + dy, PANEL_DIMENSIONS.MIN_HEIGHT, PANEL_DIMENSIONS.MAX_HEIGHT);
      }
      if (resizeDir.includes('n')) {
        newHeight = clamp(startHeight - dy, PANEL_DIMENSIONS.MIN_HEIGHT, PANEL_DIMENSIONS.MAX_HEIGHT);
        newTop = startTop + dy;
      }
      
      panel.style.width = newWidth + 'px';
      panel.style.height = newHeight + 'px';
      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
      panel.style.transition = 'none';
    };
    document.addEventListener('mousemove', panelResizeMouseMoveHandler);
    
    panelResizeMouseUpHandler = function() {
      if (isResizing) {
        isResizing = false;
        document.body.style.userSelect = '';
        panel.style.transition = '';
        // Save panel size after resizing ends
        savePanelSettings(panel);
      }
    };
    document.addEventListener('mouseup', panelResizeMouseUpHandler);
    // --- END RESIZABLE PANEL LOGIC ---
    
    // Setup auto-refresh every 1 minute
    setupAutoRefresh('panel');
    
    console.log('[VIP List] Panel opened');
    return panel;
  } catch (error) {
    console.error('[VIP List] Error opening panel:', error);
    return false;
  }
}

async function openVIPListModal() {
  try {
    // Use the API's modal component if available
    if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal) {
      // Common initialization
      await initializeVIPListInterface();
      
      const contentDiv = document.createElement('div');
      contentDiv.style.width = '100%';
      contentDiv.style.flex = '1 1 0';
      contentDiv.style.minHeight = '0';
      contentDiv.style.boxSizing = 'border-box';
      contentDiv.style.overflow = 'hidden';
      contentDiv.style.display = 'flex';
      contentDiv.style.flexDirection = 'row';
      contentDiv.style.gap = '8px';
      
      const headerRow = createVIPHeaderRow();
      const vipListBox = createVIPBox({
        headerRow: headerRow,
        content: await getVIPListContent()
      });
      vipListBox.style.width = '100%';
      vipListBox.style.height = '100%';
      vipListBox.style.flex = '1 1 0';
      
      contentDiv.appendChild(vipListBox);
      
      const modal = api.ui.components.createModal({
        title: t('mods.vipList.modalTitle'),
        width: MODAL_DIMENSIONS.WIDTH,
        height: MODAL_DIMENSIONS.HEIGHT,
        content: contentDiv,
        buttons: [{ 
          text: t('mods.vipList.closeButton'), 
          primary: true,
          onClick: () => {
            // Clear refresh interval
            cleanupAutoRefresh();
            // Clear modal instance reference (memory leak prevention)
            vipListModalInstance = null;
          }
        }]
      });
      
      // Store modal instance for refreshing display
      const timeout1 = setTimeout(() => {
        pendingTimeouts.delete(timeout1);
        const dialog = getOpenDialog();
        if (dialog) {
          vipListModalInstance = dialog;
        }
      }, TIMEOUTS.MEDIUM);
      trackTimeout(timeout1);
      
      // Adjust dialog styles after creation
      const timeout2 = setTimeout(() => {
        pendingTimeouts.delete(timeout2);
        const dialog = getOpenDialog();
        if (dialog) {
          applyModalStyles(dialog);
          
          // Add search input and Add button to footer
          const buttonContainer = dialog.querySelector('.flex.justify-end.gap-2');
          if (buttonContainer) {
            setupModalSearchInput(buttonContainer);
          }
          
          // Setup auto-refresh every 1 minute
          setupAutoRefresh('modal');
          
          // Watch for modal closing (via ESC or other methods)
          modalCloseObserver = new MutationObserver((mutations) => {
            if (!document.contains(dialog) || dialog.getAttribute('data-state') === 'closed') {
              cleanupAutoRefresh();
              vipListModalInstance = null;
              if (modalCloseObserver) {
                modalCloseObserver.disconnect();
                modalCloseObserver = null;
              }
            }
          });
          modalCloseObserver.observe(dialog, { attributes: true, attributeFilter: ['data-state'] });
          modalCloseObserver.observe(document.body, { childList: true, subtree: true });
        }
      }, TIMEOUTS.NORMAL);
      trackTimeout(timeout2);
      
      console.log('[VIP List] Modal opened');
      return modal;
    } else {
      // Fallback to window.BestiaryModAPI if available
      if (typeof window !== 'undefined' && window.BestiaryModAPI && window.BestiaryModAPI.showModal) {
        window.BestiaryModAPI.showModal({
          title: t('mods.vipList.modalTitle'),
          content: '<p>VIP List content will go here.</p>',
          buttons: [{ text: t('mods.vipList.closeButton'), primary: false }]
        });
        console.log('[VIP List] Modal opened (fallback)');
        return true;
      } else {
        console.error('[VIP List] Modal API not available');
        return false;
      }
    }
  } catch (error) {
    console.error('[VIP List] Error opening modal:', error);
    return false;
  }
}

function startAccountMenuObserver() {
  if (accountMenuObserver) {
    return;
  }
  
  const processMutations = (mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        
        // Check if this is a menu element
        const isMenu = node.getAttribute?.('role') === 'menu';
        const hasMenu = node.querySelector?.('[role="menu"]');
        
        const menu = isMenu ? node : hasMenu;
        if (menu) {
          const timeoutId = setTimeout(() => {
            pendingTimeouts.delete(timeoutId);
            injectVIPListItem(menu);
          }, TIMEOUTS.SHORT);
          trackTimeout(timeoutId);
        }
      }
    }
  };
  
  accountMenuObserver = new MutationObserver(processMutations);
  accountMenuObserver.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  // Also check for existing menus
  const timeoutId = setTimeout(() => {
    pendingTimeouts.delete(timeoutId);
    const menus = document.querySelectorAll('[role="menu"]');
    menus.forEach(menu => {
      injectVIPListItem(menu);
    });
  }, TIMEOUTS.INITIAL_CHECK);
  trackTimeout(timeoutId);
  
  console.log('[VIP List] Account menu observer started');
}

function stopAccountMenuObserver() {
  if (accountMenuObserver) {
    accountMenuObserver.disconnect();
    accountMenuObserver = null;
    console.log('[VIP List] Account menu observer stopped');
  }
}

// Create Chat button in header navigation
function updateChatHeaderButtonVisibility() {
  const chatEnabled = getMessagingEnabled();
  const headerUl = document.querySelector('#header-slot nav ul');
  if (!headerUl) return;
  
  const chatButtonLi = Array.from(headerUl.children).find(
    el => el.querySelector('.vip-chat-header-btn')
  );
  
  if (chatButtonLi) {
    chatButtonLi.style.display = chatEnabled ? '' : 'none';
  }
}

function createChatHeaderButton() {
  const tryInsert = () => {
    // Find the header <ul> inside #header-slot nav
    const headerUl = document.querySelector('#header-slot nav ul');
    if (!headerUl) {
      const timeoutId = setTimeout(tryInsert, 500);
      trackTimeout(timeoutId);
      return;
    }
    
    // Prevent duplicate button
    if (headerUl.querySelector('.vip-chat-header-btn')) {
      // Update visibility if button already exists
      updateChatHeaderButtonVisibility();
      return;
    }
    
    // Check if chat is enabled before creating button
    const chatEnabled = getMessagingEnabled();
    if (!chatEnabled) {
      // Retry later in case setting changes
      const timeoutId = setTimeout(tryInsert, 1000);
      trackTimeout(timeoutId);
      return;
    }

    // Create the <li> and <button>
    const li = document.createElement('li');
    li.className = 'hover:text-whiteExp';
    const btn = document.createElement('button');
    btn.className = 'vip-chat-header-btn focus-style-visible pixel-font-16 relative my-px flex items-center gap-1.5 border border-solid border-transparent px-1 py-0.5 active:frame-pressed-1 data-[selected="true"]:frame-pressed-1 hover:text-whiteExp data-[selected="true"]:text-whiteExp sm:px-2 sm:py-0.5';
    btn.setAttribute('data-selected', 'false');
    
    // Add chat icon
    const icon = document.createElement('img');
    icon.src = 'https://bestiaryarena.com/assets/icons/chat.png';
    icon.alt = 'Chat';
    icon.width = 16;
    icon.height = 14;
    icon.className = 'pixelated';
    icon.style.cssText = 'width: 16px; height: 14px;';
    btn.appendChild(icon);
    
    // Add text span (hidden on small screens, shown on larger screens)
    const textSpan = document.createElement('span');
    textSpan.textContent = 'Chat';
    textSpan.className = 'hidden sm:inline';
    btn.appendChild(textSpan);
    
    // Add unread message blip (initially hidden)
    const blip = document.createElement('div');
    blip.className = 'vip-chat-header-blip flex rounded-full border border-solid border-black absolute right-0 top-0 size-3 text-message animate-in fade-in sm:size-2';
    blip.style.display = 'none';
    const pingSpan = document.createElement('span');
    pingSpan.className = 'absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75';
    const dotSpan = document.createElement('span');
    dotSpan.className = 'relative inline-flex size-full rounded-full bg-current';
    blip.appendChild(pingSpan);
    blip.appendChild(dotSpan);
    btn.appendChild(blip);
    
    btn.onclick = () => {
      openAllChatPanel();
    };
    li.appendChild(btn);

    // Try to insert after Autoseller button
    const autosellerLi = Array.from(headerUl.children).find(
      el => el.querySelector('.autoseller-nav-btn')
    );

    if (autosellerLi) {
      // Insert after Autoseller
      if (autosellerLi.nextSibling) {
        headerUl.insertBefore(li, autosellerLi.nextSibling);
      } else {
        headerUl.appendChild(li);
      }
      console.log('[VIP List] Chat header button inserted after Autoseller.');
    } else {
      // Fallback: Insert after Quest button
      const questLi = Array.from(headerUl.children).find(
        el => {
          const button = el.querySelector('button');
          return button && (button.textContent.includes('Quest') || button.textContent.includes('Tarefa') || button.getAttribute('alt') === 'Quests');
        }
      );
      if (questLi) {
        if (questLi.nextSibling) {
          headerUl.insertBefore(li, questLi.nextSibling);
        } else {
          headerUl.appendChild(li);
        }
        console.log('[VIP List] Chat header button inserted after Quest (fallback).');
      } else {
        headerUl.appendChild(li);
        console.log('[VIP List] Chat header button appended to end (fallback).');
      }
    }
  };
  tryInsert();
}

// =======================
// 13. Exports & Lifecycle Management
// =======================

exports = {
  init: function() {
    try {
      // Clear any stale cache entries from previous sessions
      PlayerDataFetcher.clearCache();
      
      // Ensure config is loaded from localStorage first (prioritize localStorage like Manual Runner)
      loadVIPListConfig();
      
      startAccountMenuObserver();
      
      // Create Chat button in header
      createChatHeaderButton();
      // Update visibility based on chat setting
      updateChatHeaderButtonVisibility();
      
      // Auto-reopen panel if in panel mode and was previously open
      autoReopenVIPListPanel();
      
      // Setup message checking if messaging is enabled
      if (MESSAGING_CONFIG.enabled) {
        setupMessageChecking();
        
        // Sync chat enabled status to Firebase
        syncChatEnabledStatus(true);
        
        // Clean up old All Chat messages (older than 30 days) on init
        // Run asynchronously to not block initialization
        cleanupOldAllChatMessages(30 * 24 * 60 * 60 * 1000).catch(error => {
          console.error('[VIP List] Error during message cleanup:', error);
        });
        
        // Auto-reopen chat panel if it was previously open
        autoReopenChatPanel();
      }
      
      return true;
    } catch (error) {
      console.error('[VIP List] Initialization error:', error);
      return false;
    }
  },
  
  cleanup: function() {
    try {
      // 1. Stop account menu observer
      stopAccountMenuObserver();
      
      // 2. Remove global click handler (memory leak prevention)
      removeVIPDropdownClickHandler();
      
      // 3. Clear all pending timeouts (memory leak prevention)
      clearAllPendingTimeouts();
      
      // 4. Clear refresh interval
      cleanupAutoRefresh();
      
      // 5. Cleanup message checking (polling intervals)
      cleanupMessageChecking();
      
      // 6. Clear pending request check intervals
      for (const [playerName, intervalId] of pendingRequestCheckIntervals.entries()) {
        clearInterval(intervalId);
      }
      pendingRequestCheckIntervals.clear();
      
      // 7. Clear conversation timestamps
      conversationLastTimestamps.clear();
      
      // 7.1. Clear all chat tabs Map (memory leak prevention)
      allChatTabs.clear();
      
      // 8. Clean up all open chat panels
      for (const [playerName, panel] of openChatPanels.entries()) {
        if (panel && panel.nodeType === 1) {
          // Remove scroll handlers (memory leak prevention)
          const playerKey = playerName.toLowerCase();
          if (playerName === 'all-chat') {
            removeScrollDetection(panel, { handlerKey: '_scrollHandler' });
            // Remove All Chat MutationObserver
            if (panel._toggleButtonObserver) {
              panel._toggleButtonObserver.disconnect();
              panel._toggleButtonObserver = null;
            }
          } else {
            // Remove conversation scroll handlers
            removeScrollDetection(panel, { handlerKey: `_scrollHandler_conversation_${playerKey}` });
          }
          // Remove guild chat scroll handlers if any
          for (const key of Object.keys(panel)) {
            if (key.startsWith('_scrollHandler_guild-')) {
              removeScrollDetection(panel, { handlerKey: key });
            }
          }
          
          // Remove event listeners (memory leak prevention)
          if (panel._dragHandler) {
            document.removeEventListener('mousemove', panel._dragHandler);
          }
          if (panel._upHandler) {
            document.removeEventListener('mouseup', panel._upHandler);
          }
          if (panel._dragUpHandler) {
            document.removeEventListener('mouseup', panel._dragUpHandler);
          }
          if (panel._resizeHandler) {
            document.removeEventListener('mousemove', panel._resizeHandler);
          }
          if (panel._resizeUpHandler) {
            document.removeEventListener('mouseup', panel._resizeUpHandler);
          }
          // Remove resize handle handler if exists
          const resizeHandle = panel.querySelector('.chat-panel-resize-handle');
          if (resizeHandle && panel._resizeHandleMousedownHandler) {
            resizeHandle.removeEventListener('mousedown', panel._resizeHandleMousedownHandler);
          }
          // Remove panel drag handlers
          const headerContainer = panel.querySelector('div:first-child');
          if (headerContainer && panel._mousedownHandler) {
            headerContainer.removeEventListener('mousedown', panel._mousedownHandler);
          }
          // Remove panel
          panel.remove();
        }
      }
      openChatPanels.clear();
      
      // 9. Remove document event listeners
      cleanupPanelEventListeners();
      
      // 12. Remove panel if it exists (clean up event listeners first)
      const panel = document.getElementById(PANEL_ID);
      if (panel) {
        // Remove panel-specific event listeners before removing panel
        if (vipListPanelTitleRowMousedownHandler) {
          const titleRow = panel.querySelector('.vip-list-panel-title-row');
          if (titleRow) {
            titleRow.removeEventListener('mousedown', vipListPanelTitleRowMousedownHandler);
          }
          vipListPanelTitleRowMousedownHandler = null;
        }
        if (vipListPanelMousemoveHandler) {
          panel.removeEventListener('mousemove', vipListPanelMousemoveHandler);
          vipListPanelMousemoveHandler = null;
        }
        if (vipListPanelMousedownHandler) {
          panel.removeEventListener('mousedown', vipListPanelMousedownHandler);
          vipListPanelMousedownHandler = null;
        }
        panel.remove();
      }
      
      // 13. Clean up modal observer
      if (modalCloseObserver) {
        modalCloseObserver.disconnect();
        modalCloseObserver = null;
      }
      
      // 14. Clear modal instance reference
      vipListModalInstance = null;
      
      // 15. Clear panel instance reference
      vipListPanelInstance = null;
      
      // 16. Remove injected menu items
      const vipListItems = document.querySelectorAll('.vip-list-menu-item');
      vipListItems.forEach(item => {
        try {
          if (item.parentNode) {
            item.parentNode.removeChild(item);
          }
        } catch (error) {
          console.warn('[VIP List] Error removing menu item:', error);
        }
      });
      
      // Clear processed menus set (WeakSet doesn't have clear, so we just reset the reference)
      console.log('[VIP List] Cleaned up successfully');
      return true;
    } catch (error) {
      console.error('[VIP List] Cleanup error:', error);
      return false;
    }
  }
};

// Legacy window object for backward compatibility
if (typeof window !== 'undefined') {
  window.VIPList = {
    init: exports.init,
    cleanup: exports.cleanup,
    // Update messaging configuration
    updateMessagingConfig: function(newConfig) {
      try {
        // The config is read from window.betterUIConfig, so we just need to restart/stop checking
        if (newConfig.enabled === false) {
          // Stop message checking
          cleanupMessageChecking();
          // Sync disabled status to Firebase
          syncChatEnabledStatus(false);
          // Hide chat header button
          updateChatHeaderButtonVisibility();
          console.log('[VIP List] Messaging disabled, stopped message checking');
        } else if (newConfig.enabled === true) {
          // Start message checking
          cleanupMessageChecking(); // Clean up any existing interval first
          setupMessageChecking();
          // Sync enabled status to Firebase
          syncChatEnabledStatus(true);
          // Show chat header button (create if doesn't exist)
          createChatHeaderButton();
          updateChatHeaderButtonVisibility();
          console.log('[VIP List] Messaging enabled, started message checking');
        }
        return true;
      } catch (error) {
        console.error('[VIP List] Error updating messaging config:', error);
        return false;
      }
    },
    // Update Global Chat state
    updateGlobalChatState: function(enabled) {
      try {
        // Close All Chat panel if disabling
        if (!enabled) {
          const panel = document.getElementById('vip-chat-panel-all-chat');
          if (panel) {
            minimizeAllChatPanel();
          }
        }
        // Update chat header button visibility
        updateChatHeaderButtonVisibility();
        console.log('[VIP List] Global Chat', enabled ? 'enabled' : 'disabled');
        return true;
      } catch (error) {
        console.error('[VIP List] Error updating Global Chat state:', error);
        return false;
      }
    }
  };
}

// Auto-initialize if running in mod context
if (typeof context !== 'undefined' && context.api) {
  exports.init();
}