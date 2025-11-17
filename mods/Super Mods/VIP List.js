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
  COLORS: {
    TEXT_PRIMARY: 'rgb(230, 215, 176)',
    TEXT_WHITE: 'rgb(255, 255, 255)',
    ONLINE: 'rgb(76, 175, 80)',
    OFFLINE: 'rgb(255, 107, 107)',
    LINK: 'rgb(100, 181, 246)',
    ERROR: '#ff6b6b',
    SUCCESS: '#4caf50',
    DUPLICATE: '#888'
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

// Read Global Chat (All Chat) enabled state from Mod Settings config if available, default to false
// Now controlled by enableVipListChat (Enable Chat setting)
const getGlobalChatEnabled = () => getConfigValue('enableVipListChat', false, 'boolean');

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
let firebase401WarningShown = false;
let pendingRequestCheckIntervals = new Map();
let modalCloseObserver = null;

// Track timeouts for cleanup (memory leak prevention)
const pendingTimeouts = new Set();

// Sort state: { column: 'name'|'level'|'status'|'rankPoints'|'timeSum', direction: 'asc'|'desc' }
let currentSortState = {
  column: 'name',
  direction: 'asc'
};

// Load sort preference from localStorage
function loadSortPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SORT);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (parsed.column && ['name', 'level', 'status', 'rankPoints', 'timeSum'].includes(parsed.column) &&
          parsed.direction && ['asc', 'desc'].includes(parsed.direction)) {
        currentSortState = parsed;
        console.log('[VIP List] Loaded sort preference from localStorage:', currentSortState);
        return currentSortState;
      }
    }
  } catch (error) {
    console.error('[VIP List] Error loading sort preference from localStorage:', error);
  }
  // Default: sort by name ascending
  currentSortState = { column: 'name', direction: 'asc' };
  return currentSortState;
}

// Save sort preference to localStorage
function saveSortPreference() {
  try {
    localStorage.setItem(STORAGE_KEYS.SORT, JSON.stringify(currentSortState));
    console.log('[VIP List] Saved sort preference to localStorage:', currentSortState);
  } catch (error) {
    console.error('[VIP List] Error saving sort preference to localStorage:', error);
  }
}

// Load config from localStorage (preferred) or context.config
// Similar to Rank Pointer's approach - prioritize localStorage
function loadVIPListConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      console.log('[VIP List] Loaded config from localStorage:', parsed);
      // Update context.config if available
      if (typeof context !== 'undefined' && context.config) {
        Object.assign(context.config, parsed);
      }
      return parsed;
    }
  } catch (error) {
    console.error('[VIP List] Error loading config from localStorage:', error);
  }
  
  // Fallback to context.config if localStorage is empty
  const defaultConfig = typeof context !== 'undefined' && context.config ? context.config : {};
  return defaultConfig;
}

// Save config to localStorage
function saveVIPListConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    console.log('[VIP List] Saved config to localStorage:', config);
  } catch (error) {
    console.error('[VIP List] Error saving config to localStorage:', error);
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
// 4. Translation Helpers & Config
// =======================

// Use shared translation system via API
const t = (key) => api.i18n.t(key);

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
    text = text.replace(`{${placeholder}}`, value);
  });
  return text;
};

// =======================
// 5. Player Data Helpers
// =======================

// Get current player's name from game state
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
  
  // Parse timestamp and check if within threshold
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
  
  return {
    name: profileData.name || playerName,
    level: level,
    status: status,
    rankPoints: rankPoints,
    timeSum: timeSum,
    profile: playerName.toLowerCase(),
    lastUpdatedAt: profileData.lastUpdatedAt || null
  };
}

// =======================
// 6. Messaging/Chat Functions
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
  try {
    const positions = loadAllChatPanelPositions();
    const rect = panel.getBoundingClientRect();
    
    positions[playerName.toLowerCase()] = {
      left: rect.left,
      top: rect.top,
      right: window.innerWidth - rect.right
    };
    
    localStorage.setItem(STORAGE_KEYS.CHAT_PANEL_POSITIONS, JSON.stringify(positions));
  } catch (error) {
    console.error(`[VIP List] Error saving chat panel position for ${playerName}:`, error);
  }
}

// Load chat panel position from localStorage
function loadChatPanelPosition(playerName) {
  try {
    const positions = loadAllChatPanelPositions();
    return positions[playerName.toLowerCase()] || null;
  } catch (error) {
    console.error(`[VIP List] Error loading chat panel position for ${playerName}:`, error);
    return null;
  }
}

// Load all chat panel positions from localStorage
function loadAllChatPanelPositions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CHAT_PANEL_POSITIONS);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('[VIP List] Error loading chat panel positions:', error);
    return {};
  }
}

function saveChatPanelSettings(isOpen = true, closedManually = false) {
  try {
    // Don't save during auto-reopen to prevent overwriting tabs before restoration
    if (window._vipListChatAutoReopening) {
      return;
    }
    const panel = document.getElementById('vip-chat-panel-all-chat');
    if (panel && panel._isAutoReopening) {
      return;
    }
    
    // Get list of open tabs (excluding 'all-chat' as it's always created)
    const openTabs = Array.from(allChatTabs.keys()).filter(name => name !== 'all-chat');
    
    const settings = {
      isOpen: isOpen,
      closedManually: closedManually,
      openTabs: openTabs,
      activeTab: activeAllChatTab || 'all-chat'
    };
    localStorage.setItem(STORAGE_KEYS.CHAT_PANEL_SETTINGS, JSON.stringify(settings));
    console.log('[VIP List] Chat panel settings saved:', settings);
  } catch (error) {
    console.error('[VIP List] Error saving chat panel settings:', error);
  }
}

// Load chat panel settings from localStorage
function loadChatPanelSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CHAT_PANEL_SETTINGS);
    if (saved) {
      const settings = JSON.parse(saved);
      console.log('[VIP List] Chat panel settings loaded:', settings);
      return settings;
    }
  } catch (error) {
    console.error('[VIP List] Error loading chat panel settings:', error);
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
      
      // Load saved settings BEFORE opening panel (to preserve tabs)
      const savedSettings = loadChatPanelSettings();
      const tabsToRestore = savedSettings.openTabs || [];
      const activeTabToRestore = savedSettings.activeTab || 'all-chat';
      
      console.log('[VIP List] Will restore tabs after panel opens:', tabsToRestore, 'activeTab:', activeTabToRestore);
      
      // Temporarily disable saving during panel creation and restoration
      window._vipListChatAutoReopening = true;
      
      await openAllChatPanel();
      
      // Set flag on panel after it's created
      const panel = document.getElementById('vip-chat-panel-all-chat');
      if (panel) {
        panel._isAutoReopening = true;
      }
      
      // Restore open tabs - wait a bit for panel to be fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (tabsToRestore.length > 0) {
        console.log('[VIP List] Restoring open tabs:', tabsToRestore);
        
        // Restore each tab
        for (const playerName of tabsToRestore) {
          try {
            const messages = await getConversationMessages(playerName);
            const unreadCount = await getPlayerUnreadCount(messages, playerName);
            await addAllChatTab(playerName, playerName, unreadCount);
          } catch (error) {
            console.error(`[VIP List] Error restoring tab for ${playerName}:`, error);
          }
        }
        
        // Restore active tab
        if (activeTabToRestore && (activeTabToRestore === 'all-chat' || tabsToRestore.includes(activeTabToRestore))) {
          await switchAllChatTab(activeTabToRestore);
        } else if (tabsToRestore.length > 0) {
          // If saved active tab is invalid, switch to first open tab
          await switchAllChatTab(tabsToRestore[0]);
        }
      } else {
        // Even if no tabs to restore, make sure we switch to the saved active tab (likely 'all-chat')
        if (activeTabToRestore) {
          await switchAllChatTab(activeTabToRestore);
        }
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
  // Handle both naming conventions for backward compatibility
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

// Hash username for use in Firebase paths (deterministic, one-way)
async function hashUsername(username) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(username.toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32); // Use first 32 chars (64 hex chars = 32 bytes)
  } catch (error) {
    console.error('[VIP List] Username hashing error:', error);
    // Fallback to plain username if hashing fails
    return username.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }
}

// Encrypt username for storage in message/request bodies
async function encryptUsername(username, player1, player2) {
  try {
    const key = await deriveUsernameKey(player1, player2);
    const encoder = new TextEncoder();
    const data = encoder.encode(username);
    
    // Generate a random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    // Combine IV and encrypted data, then encode as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Convert to base64 for Firebase storage
    return btoa(String.fromCharCode(...combined));
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
    let combined;
    try {
      combined = Uint8Array.from(atob(encryptedUsername), c => c.charCodeAt(0));
    } catch (e) {
      // Not valid base64, probably unencrypted username (backward compatibility)
      return encryptedUsername;
    }
    
    // Check if we have enough data (at least 12 bytes for IV + some encrypted data)
    if (combined.length < 13) {
      // Too short to be encrypted, probably unencrypted username
      return encryptedUsername;
    }
    
    const key = await deriveUsernameKey(player1, player2);
    
    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
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
    const encoder = new TextEncoder();
    const data = encoder.encode(readStatus ? 'true' : 'false');
    
    // Generate a random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    // Combine IV and encrypted data, then encode as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Convert to base64 for Firebase storage
    return btoa(String.fromCharCode(...combined));
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
    let combined;
    try {
      combined = Uint8Array.from(atob(encryptedReadStatus), c => c.charCodeAt(0));
    } catch (e) {
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
    
    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    const decryptedString = decoder.decode(decrypted);
    return decryptedString === 'true';
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
  // Sort names alphabetically to ensure both players derive the same key
  const sortedNames = [player1.toLowerCase(), player2.toLowerCase()].sort();
  const combined = sortedNames.join('|') + '|readstatus';
  
  // Use Web Crypto API to derive a key from the combined names using PBKDF2
  const encoder = new TextEncoder();
  const password = encoder.encode(combined);
  
  // Import password as a raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    password,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const salt = encoder.encode('vip-list-readstatus-salt'); // Different salt for read status encryption
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
}

// Derive a shared encryption key for usernames from two player names (deterministic)
async function deriveUsernameKey(player1, player2) {
  // Sort names alphabetically to ensure both players derive the same key
  const sortedNames = [player1.toLowerCase(), player2.toLowerCase()].sort();
  const combined = sortedNames.join('|') + '|username';
  
  // Use Web Crypto API to derive a key from the combined names using PBKDF2
  const encoder = new TextEncoder();
  const password = encoder.encode(combined);
  
  // Import password as a raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    password,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const salt = encoder.encode('vip-list-username-salt'); // Different salt for username encryption
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
}

// Derive a shared encryption key from two player names (deterministic)
async function deriveChatKey(player1, player2) {
  // Sort names alphabetically to ensure both players derive the same key
  const sortedNames = [player1.toLowerCase(), player2.toLowerCase()].sort();
  const combined = sortedNames.join('|');
  
  // Use Web Crypto API to derive a key from the combined names using PBKDF2
  const encoder = new TextEncoder();
  const password = encoder.encode(combined);
  
  // Import password as a raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    password,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const salt = encoder.encode('vip-list-chat-salt'); // Fixed salt for deterministic keys
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
}

// Encrypt message text
async function encryptMessage(text, player1, player2) {
  try {
    const key = await deriveChatKey(player1, player2);
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Generate a random IV for each message
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    // Combine IV and encrypted data, then encode as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Convert to base64 for Firebase storage
    return btoa(String.fromCharCode(...combined));
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
    let combined;
    try {
      combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    } catch (e) {
      // Not valid base64, probably unencrypted message
      return encryptedText;
    }
    
    // Check if we have enough data (at least 12 bytes for IV + some encrypted data)
    if (combined.length < 13) {
      // Too short to be encrypted, probably unencrypted message
      return encryptedText;
    }
    
    const key = await deriveChatKey(player1, player2);
    
    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    // If decryption fails, return original text (for backward compatibility with unencrypted messages)
    // Only log if it's not a common error (like invalid base64)
    if (!error.message.includes('invalid') && !error.message.includes('String contains')) {
      console.warn('[VIP List] Decryption error (message may be unencrypted):', error.message);
    }
    return encryptedText;
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
    font-size: 12px;
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
    font-size: 12px;
    font-weight: 600;
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
    textarea.style.color = canChat ? CSS_CONSTANTS.COLORS.TEXT_WHITE : 'rgba(255, 255, 255, 0.5)';
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
    setTimeout(() => {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }, 50);
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
              } catch (error) {
                console.warn('[VIP List] Failed to decrypt request usernames:', error);
                // Keep encrypted values if decryption fails
              }
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
    
    const currentPlayerLower = currentPlayer.toLowerCase();
    const playerNameLower = playerName.toLowerCase();
    
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
    
    const currentPlayerLower = currentPlayer.toLowerCase();
    const playerNameLower = playerName.toLowerCase();
    
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
    
    const currentPlayerLower = currentPlayer.toLowerCase();
    const playerNameLower = playerName.toLowerCase();
    
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
    
    const currentPlayerLower = currentPlayer.toLowerCase();
    const playerNameLower = playerName.toLowerCase();
    
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
    const response = await fetch(`${getAllChatApiUrl()}/${messageId}.json`, {
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
    const currentPlayerLower = currentPlayer.toLowerCase();
    
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
              } catch (error) {
                console.warn('[VIP List] Failed to decrypt usernames:', error);
                // Keep encrypted values if decryption fails
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
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return [];
    }
    
    // Fetch all All Chat messages
    let response = await fetch(`${getAllChatApiUrl()}.json`);
    
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

// Get all All Chat messages (for displaying in panel)
async function getAllChatMessages() {
  if (!getAllChatApiUrl() || !MESSAGING_CONFIG.enabled) {
    return [];
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return [];
    }
    
    // Fetch all All Chat messages
    let response = await fetch(`${getAllChatApiUrl()}.json`);
    
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
    
    // Convert Firebase object to array and filter blocked players
    const messages = [];
    for (const [id, msg] of Object.entries(data)) {
      if (!msg) continue;
      
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
    console.error('[VIP List] Error getting All Chat messages:', error);
    return [];
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
    const currentPlayerLower = currentPlayer.toLowerCase();
    
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
    const currentPlayerLower = currentPlayer.toLowerCase();
    
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

// Format message timestamp
function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
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
  
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  
  document.body.removeChild(textarea);
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


// Update message badge
function updateMessageBadge() {
  // Update badge in VIP List menu item if it exists
  const menuItem = document.querySelector('.vip-list-menu-item');
  if (menuItem) {
    let badge = menuItem.querySelector('.vip-message-badge');
    if (!badge && unreadMessageCount > 0) {
      badge = document.createElement('span');
      badge.className = 'vip-message-badge';
      badge.style.cssText = `
        position: absolute;
        top: -4px;
        right: -4px;
        background: ${CSS_CONSTANTS.COLORS.ERROR};
        color: white;
        border-radius: 50%;
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
      `;
      menuItem.style.position = 'relative';
      menuItem.appendChild(badge);
    }
    if (badge) {
      badge.textContent = formatBadgeCount(unreadMessageCount);
      badge.style.display = unreadMessageCount > 0 ? 'flex' : 'none';
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
  
  // Update all-chat tab badges for new messages
  for (const msg of newMessages) {
    if (!msg.read) {
      const sender = msg.from;
      const messages = await getConversationMessages(sender);
      const unreadCount = await getPlayerUnreadCount(messages, sender);
      updateAllChatTabUnread(sender, unreadCount);
      updateVIPListChatIcon(sender, unreadCount);
    }
  }
  
  // Update open chat panels with new messages
  messagesBySender.forEach((playerMessages, sender) => {
    const panel = openChatPanels.get(sender.toLowerCase());
    if (panel && typeof loadConversation === 'function') {
      const messagesArea = panel.querySelector(`#chat-messages-${sender.toLowerCase()}`);
      if (messagesArea) {
        loadConversation(sender, messagesArea, false);
      }
    }
  });
}

// Process chat requests (called by event listeners)
async function processChatRequests(requests) {
  if (requests.length === 0) return;
  
  const currentPlayer = getCurrentPlayerName();
  if (!currentPlayer) return;
  
  // Update any open chat panels that have incoming requests
  requests.forEach(req => {
    if (req.from) {
      const panelId = getChatPanelId(req.from);
      const panel = document.getElementById(panelId);
      if (panel) {
        checkRecipientChatEnabled(req.from).then(async enabled => {
          const hasPrivilege = await hasChatPrivilege(currentPlayer, req.from);
          await updateChatPanelUI(panel, req.from, enabled, hasPrivilege, true, false);
          const messagesArea = panel.querySelector(`#chat-messages-${req.from.toLowerCase()}`);
          if (messagesArea && !messagesArea.querySelector('.chat-privilege-message')) {
            openMessageDialog(req.from);
          }
        });
      }
    }
  });
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
    
    // Check for All Chat messages and update if panel is open
    const allChatPanel = openChatPanels.get('all-chat');
    if (allChatPanel && typeof loadAllChatConversation === 'function') {
      const messagesArea = allChatPanel.querySelector('#chat-messages-all-chat');
      if (messagesArea) {
        // Check for new messages
        try {
          const allChatMessages = await getAllChatMessages();
          const latestTimestamp = allChatMessages.length > 0 ? allChatMessages[allChatMessages.length - 1]?.timestamp : null;
          const storedTimestamp = allChatPanel._lastTimestamp;
          
          if (storedTimestamp === null || latestTimestamp === null) {
            allChatPanel._lastTimestamp = latestTimestamp;
          } else if (latestTimestamp > storedTimestamp || allChatMessages.length !== (allChatPanel._lastMessageCount || 0)) {
            allChatPanel._lastTimestamp = latestTimestamp;
            allChatPanel._lastMessageCount = allChatMessages.length;
            await loadAllChatConversation(messagesArea);
          }
        } catch (error) {
          if (error.message && !error.message.includes('401')) {
            console.warn('[VIP List] Error checking All Chat messages:', error);
          }
        }
      }
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
}

// Get all messages between current player and another player
async function getConversationMessages(otherPlayer) {
  if (!getMessagingApiUrl() || !MESSAGING_CONFIG.enabled) {
    return [];
  }
  
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return [];
    }
    
    const currentPlayerLower = currentPlayer.toLowerCase();
    const otherPlayerLower = otherPlayer.toLowerCase();
    
    // Hash usernames for Firebase paths (try hashed first, fallback to lowercase for backward compatibility)
    const hashedOtherPlayer = await hashUsername(otherPlayer);
    const hashedCurrentPlayer = await hashUsername(currentPlayer);
    
    // Fetch messages sent TO the other player (stored under their hashed name)
    let sentResponse = await fetch(`${getMessagingApiUrl()}/${hashedOtherPlayer}.json`);
    let sentData = {};
    
    if (!sentResponse.ok && sentResponse.status === 404) {
      // Try non-hashed path for backward compatibility
      sentResponse = await fetch(`${getMessagingApiUrl()}/${otherPlayerLower}.json`);
    }
    
    if (sentResponse.ok) {
      sentData = await sentResponse.json();
    } else if (sentResponse.status === 401) {
      // Silent fail - warning already shown by checkForMessages
      sentData = {};
    }
    
    // Fetch messages received FROM the other player (stored under current player's hashed name)
    let receivedResponse = await fetch(`${getMessagingApiUrl()}/${hashedCurrentPlayer}.json`);
    let receivedData = {};
    
    if (!receivedResponse.ok && receivedResponse.status === 404) {
      // Try non-hashed path for backward compatibility
      receivedResponse = await fetch(`${getMessagingApiUrl()}/${currentPlayerLower}.json`);
    }
    
    if (receivedResponse.ok) {
      receivedData = await receivedResponse.json();
    } else if (receivedResponse.status === 401) {
      // Silent fail - warning already shown by checkForMessages
      receivedData = {};
    }
    
    // Combine all messages
    const allMessages = [];
    
    // Add sent messages and decrypt
    if (sentData && typeof sentData === 'object') {
      for (const [id, msg] of Object.entries(sentData)) {
        if (!msg) continue;
        
        // Check if message is from current player using fromHash (for encrypted) or from field (for plain text)
        let isFromCurrentPlayer = false;
        if (msg.usernamesEncrypted && msg.fromHash) {
          // Use hash comparison for encrypted usernames
          isFromCurrentPlayer = msg.fromHash === hashedCurrentPlayer;
        } else if (msg.from) {
          // Plain text comparison (backward compatibility)
          try {
            // Try to decrypt and compare
            const decryptedFrom = await decryptUsername(msg.from, currentPlayer, otherPlayer);
            isFromCurrentPlayer = decryptedFrom && decryptedFrom.toLowerCase() === currentPlayerLower;
          } catch (error) {
            // If decryption fails, try direct comparison
            isFromCurrentPlayer = msg.from.toLowerCase() === currentPlayerLower;
          }
        }
        
        if (isFromCurrentPlayer) {
          let decryptedMsg = { id, ...msg, isFromMe: true };
          // Decrypt message text if encrypted
          if (msg.encrypted && msg.text) {
            try {
              const decryptedText = await decryptMessage(msg.text, currentPlayer, otherPlayer);
              decryptedMsg.text = decryptedText;
            } catch (error) {
              console.warn('[VIP List] Failed to decrypt sent message:', error);
            }
          }
          // Decrypt username if encrypted
          if (msg.usernamesEncrypted && msg.from) {
            try {
              decryptedMsg.from = await decryptUsername(msg.from, currentPlayer, otherPlayer);
            } catch (error) {
              decryptedMsg.from = currentPlayer;
            }
          }
          allMessages.push(decryptedMsg);
        }
      }
    }
    
    // Add received messages and decrypt
    if (receivedData && typeof receivedData === 'object') {
      for (const [id, msg] of Object.entries(receivedData)) {
        if (!msg) continue;
        
        // Check if message is from other player using fromHash (for encrypted) or from field (for plain text)
        let isFromOtherPlayer = false;
        if (msg.usernamesEncrypted && msg.fromHash) {
          // Use hash comparison for encrypted usernames
          isFromOtherPlayer = msg.fromHash === hashedOtherPlayer;
        } else if (msg.from) {
          // Plain text comparison (backward compatibility)
          try {
            // Try to decrypt and compare
            const decryptedFrom = await decryptUsername(msg.from, otherPlayer, currentPlayer);
            isFromOtherPlayer = decryptedFrom && decryptedFrom.toLowerCase() === otherPlayerLower;
          } catch (error) {
            // If decryption fails, try direct comparison
            isFromOtherPlayer = msg.from.toLowerCase() === otherPlayerLower;
          }
        }
        
        if (isFromOtherPlayer) {
          let decryptedMsg = { id, ...msg, isFromMe: false };
          // Decrypt message text if encrypted
          if (msg.encrypted && msg.text) {
            try {
              const decryptedText = await decryptMessage(msg.text, otherPlayer, currentPlayer);
              decryptedMsg.text = decryptedText;
            } catch (error) {
              console.warn('[VIP List] Failed to decrypt received message:', error);
            }
          }
          // Decrypt username if encrypted
          if (msg.usernamesEncrypted && msg.from) {
            try {
              decryptedMsg.from = await decryptUsername(msg.from, otherPlayer, currentPlayer);
            } catch (error) {
              decryptedMsg.from = otherPlayer;
            }
          }
          allMessages.push(decryptedMsg);
        }
      }
    }
    
    // Sort by timestamp
    allMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    return allMessages;
  } catch (error) {
    console.error('[VIP List] Error getting conversation messages:', error);
    return [];
  }
}

// Load and display conversation (module-level function)
async function loadConversation(player, container, forceScrollToBottom = false) {
  const messages = await getConversationMessages(player);
  
  // Get previous message count from container's data attribute or panel
  const panel = container.closest('[id^="vip-chat-panel-"]');
  const previousMessageCount = panel?._previousMessageCount || 0;
  
  // Check if new messages arrived (count increased)
  const hasNewMessages = messages.length > previousMessageCount;
  const shouldScrollToBottom = forceScrollToBottom || hasNewMessages;
  
  // Preserve warning message, privilege message, blocked message, and delete confirmation if they exist
  const warningMessage = container.querySelector('.chat-disabled-warning');
  const privilegeMessage = container.querySelector('.chat-privilege-message');
  const blockedMessage = container.querySelector('.chat-blocked-message');
  const deleteConfirmation = container.querySelector('.delete-confirmation');
  container.innerHTML = '';
  
  // Add privilege message first (if exists)
  if (privilegeMessage) {
    container.appendChild(privilegeMessage);
  }
  
  // Add warning message next (if exists)
  if (warningMessage) {
    container.appendChild(warningMessage);
  }
  
  if (messages.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.cssText = `
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
      padding: 15px;
      font-style: italic;
      font-size: 12px;
    `;
    emptyMsg.textContent = t('mods.vipList.noMessagesYet');
    container.appendChild(emptyMsg);
    
    // Add delete confirmation after empty message (if exists)
    if (deleteConfirmation) {
      container.appendChild(deleteConfirmation);
    }
    
    // Add blocked message at bottom (if exists)
    if (blockedMessage) {
      container.appendChild(blockedMessage);
    }
    
    if (panel) panel._previousMessageCount = 0;
    return;
  }
  
  messages.forEach(msg => {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 1px;
      max-width: 80%;
      ${msg.isFromMe ? 'align-self: flex-end;' : 'align-self: flex-start;'}
    `;
    
    const bubble = document.createElement('div');
    bubble.style.cssText = `
      padding: 4px 8px;
      border-radius: 4px;
      background: ${msg.isFromMe 
        ? CSS_CONSTANTS.COLORS.LINK 
        : 'rgba(255, 255, 255, 0.1)'};
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      word-wrap: break-word;
      font-size: 12px;
      line-height: 1.2;
    `;
    
    const senderName = document.createElement('div');
    senderName.style.cssText = `
      font-size: 9px;
      font-weight: bold;
      color: ${msg.isFromMe 
        ? 'rgba(255, 255, 255, 0.9)' 
        : CSS_CONSTANTS.COLORS.LINK};
      margin-bottom: 1px;
    `;
    senderName.textContent = msg.isFromMe ? 'You' : msg.from;
    
    const messageText = document.createElement('div');
    messageText.style.cssText = 'line-height: 1.2;';
    
    // Try to embed replay links
    const replayParts = embedReplayLinks(msg.text);
    if (replayParts) {
      replayParts.forEach(part => messageText.appendChild(part));
    } else {
      messageText.textContent = msg.text;
    }
    
    const timestamp = document.createElement('div');
    timestamp.style.cssText = `
      font-size: 8px;
      color: rgba(255, 255, 255, 0.5);
      margin-top: 1px;
      text-align: ${msg.isFromMe ? 'right' : 'left'};
    `;
    timestamp.textContent = formatMessageTime(msg.timestamp);
    
    bubble.appendChild(senderName);
    bubble.appendChild(messageText);
    messageDiv.appendChild(bubble);
    messageDiv.appendChild(timestamp);
    container.appendChild(messageDiv);
  });
  
  // Add delete confirmation after all messages (if exists)
  if (deleteConfirmation) {
    container.appendChild(deleteConfirmation);
  }
  
  // Add blocked message at bottom (if exists)
  if (blockedMessage) {
    container.appendChild(blockedMessage);
  }
  
  // Update message count on panel
  if (panel) panel._previousMessageCount = messages.length;
  
  // Scroll to bottom if forced, new messages arrived, or user is near bottom
  if (shouldScrollToBottom) {
    // Use setTimeout to ensure DOM is fully rendered before scrolling
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 50);
  } else {
    // Only scroll to bottom if user is already near the bottom (within 50px)
    // This prevents interrupting manual scrolling
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    if (isNearBottom) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 50);
    }
  }
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
      // Refresh the chat panel to show empty state
      await loadConversation(otherPlayer, messagesArea);
      // Update message count tracking
      const panel = messagesArea.closest('[id^="vip-chat-panel-"]');
      if (panel) {
        panel._lastMessageCount = 0;
        const conversationKey = otherPlayer.toLowerCase();
        conversationLastTimestamps.delete(conversationKey);
      }
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
  messagesArea.scrollTop = messagesArea.scrollHeight;
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
    
    const currentPlayerLower = currentPlayer.toLowerCase();
    const otherPlayerLower = otherPlayer.toLowerCase();
    
    // Hash usernames for Firebase paths (try hashed first, fallback to lowercase for backward compatibility)
    const hashedOtherPlayer = await hashUsername(otherPlayer);
    const hashedCurrentPlayer = await hashUsername(currentPlayer);
    
    // Get all messages in the conversation
    const conversationMessages = await getConversationMessages(otherPlayer);
    
    if (conversationMessages.length === 0) {
      console.log('[VIP List] No messages to delete');
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
    
    console.log('[VIP List] Conversation deleted successfully');
    
    return true;
  } catch (error) {
    console.error('[VIP List] Error deleting conversation:', error);
    alert(t('mods.vipList.deleteConversationError'));
    return false;
  }
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
  nameButton.textContent = username;
  
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

// Load and display All Chat conversation
async function loadAllChatConversation(container, forceScrollToBottom = false) {
  const panel = container.closest('[id^="vip-chat-panel-all-chat"]');
  
  // Prevent concurrent loading (memory leak prevention)
  if (panel?._isLoadingAllChat) {
    return;
  }
  
  panel._isLoadingAllChat = true;
  
  try {
    const messages = await getAllChatMessages();
    
    // Get previous message count from container's data attribute or panel
    const previousMessageCount = panel?._previousMessageCount || 0;
    
    // Check if new messages arrived (count increased)
    const hasNewMessages = messages.length > previousMessageCount;
    const shouldScrollToBottom = forceScrollToBottom || hasNewMessages;
    
    // Track displayed message IDs to prevent duplicates
    const displayedMessageIds = new Set();
    const existingMessages = container.querySelectorAll('[data-message-id]');
    existingMessages.forEach(msgEl => {
      const msgId = msgEl.getAttribute('data-message-id');
      if (msgId) displayedMessageIds.add(msgId);
    });
    
    // Only clear and rebuild if message count changed significantly or forced
    const shouldRebuild = forceScrollToBottom || hasNewMessages || messages.length !== previousMessageCount;
    
    if (shouldRebuild) {
      container.innerHTML = '';
    }
    
    if (messages.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = `
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        padding: 15px;
        font-style: italic;
        font-size: 12px;
      `;
      emptyMsg.textContent = t('mods.vipList.allChatEmptyState');
      container.appendChild(emptyMsg);
      
      if (panel) panel._previousMessageCount = 0;
      return;
    }
    
    // Process messages and add date separators
    let lastDateKey = null;
    const elementsToAppend = [];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const currentDateKey = getDateKey(msg.timestamp);
      
      // Add date separator if date changed
      if (currentDateKey !== lastDateKey) {
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
          background: rgba(255, 255, 255, 0.2);
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
        label.textContent = formatDateSeparator(msg.timestamp);
        
        const line2 = document.createElement('div');
        line2.style.cssText = `
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.2);
        `;
        
        separator.appendChild(line);
        separator.appendChild(label);
        separator.appendChild(line2);
        
        elementsToAppend.push(separator);
        lastDateKey = currentDateKey;
      }
      
      // Skip if message already displayed (prevent duplicates)
      if (!shouldRebuild && displayedMessageIds.has(msg.id)) {
        continue;
      }
      
      // Create message element
      const messageDiv = document.createElement('div');
      messageDiv.setAttribute('data-message-id', msg.id); // Track message ID to prevent duplicates
      const currentPlayer = getCurrentPlayerName();
      const isFromCurrentPlayer = msg.from && msg.from.toLowerCase() === currentPlayer?.toLowerCase();
      
      messageDiv.style.cssText = `
        padding: 6px 10px;
        margin: 2px 0;
        border-radius: 4px;
        word-wrap: break-word;
        max-width: 100%;
        font-size: 13px;
        line-height: 1.4;
        ${isFromCurrentPlayer ? 'background: rgba(100, 181, 246, 0.15);' : 'background: rgba(255, 255, 255, 0.05);'}
      `;
      
      // Format: [Datetime] [Username]: [Message]
      const datetime = formatAllChatDateTime(msg.timestamp);
      const username = msg.from || 'Unknown';
      const messageText = msg.text || '';
      
      // Get player level if it's the current player
      const playerLevel = isFromCurrentPlayer ? getCurrentPlayerLevel() : null;
      
      // Create message structure with clickable player name
      const datetimeSpan = document.createElement('span');
      datetimeSpan.textContent = `[${datetime}] `;
      
      const nameButton = await createAllChatPlayerNameButton(username, isFromCurrentPlayer, container, playerLevel);
      
      const colonSpan = document.createElement('span');
      colonSpan.textContent = ': ';
      
      const messageSpan = document.createElement('span');
      
      // Use embedReplayLinks to properly parse and embed replay links (same as normal chat)
      const replayParts = embedReplayLinks(messageText);
      if (replayParts) {
        replayParts.forEach(part => messageSpan.appendChild(part));
      } else {
        messageSpan.textContent = messageText;
      }
      
      messageDiv.appendChild(datetimeSpan);
      messageDiv.appendChild(nameButton);
      messageDiv.appendChild(colonSpan);
      messageDiv.appendChild(messageSpan);
      
      messageDiv.style.color = CSS_CONSTANTS.COLORS.TEXT_WHITE;
      messageDiv.style.whiteSpace = 'pre-wrap';
      
      elementsToAppend.push(messageDiv);
    }
  
    // Append all elements (separators and messages) to container
    elementsToAppend.forEach(element => container.appendChild(element));
    
    if (panel) panel._previousMessageCount = messages.length;
    
    // Scroll to bottom if needed
    if (shouldScrollToBottom) {
      const timeoutId = setTimeout(() => {
        container.scrollTop = container.scrollHeight;
        pendingTimeouts.delete(timeoutId);
      }, 100);
      trackTimeout(timeoutId);
    }
  } finally {
    // Always clear loading flag
    if (panel) panel._isLoadingAllChat = false;
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
    border: none;
    outline: none;
    height: 100%;
    align-self: stretch;
  `;
  
  const tabLabel = document.createElement('span');
  tabLabel.className = 'tab-player-name';
  tabLabel.textContent = displayName;
  
  // Set initial status color (only for player tabs, not "All Chat")
  // Note: Status color is applied to the label, but tab text color is controlled by game classes
  if (playerName !== 'all-chat') {
    try {
      const profileData = await fetchPlayerData(playerName);
      if (profileData) {
        const isCurrentPlayer = getCurrentPlayerName() && (profileData.name || playerName).toLowerCase() === getCurrentPlayerName().toLowerCase();
        const status = calculatePlayerStatus(profileData, isCurrentPlayer);
        const statusColor = getStatusColor(status);
        // Apply status color, but respect active state (whiteBrightest when active)
        if (!isActive) {
          tabLabel.style.color = statusColor;
        }
      } else {
        // Default to offline if player not found
        if (!isActive) {
          tabLabel.style.color = CSS_CONSTANTS.COLORS.OFFLINE;
        }
      }
    } catch (error) {
      // Default to offline on error
      if (!isActive) {
        tabLabel.style.color = CSS_CONSTANTS.COLORS.OFFLINE;
      }
    }
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
  
  // Close button (only for player tabs, not "All Chat")
  if (playerName !== 'all-chat') {
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
  
  // Clear existing content
  actionsColumn.innerHTML = '';
  
  if (playerName === 'all-chat') {
    // Hide column for all-chat
    actionsColumn.style.width = '0';
    actionsColumn.style.padding = '0';
    return;
  }
  
  // Show column for player conversations
  actionsColumn.style.width = '170px';
  actionsColumn.style.padding = '8px';
  
  // Check player status
  const isBlocked = await isPlayerBlocked(playerName);
  const isInVIPList = isPlayerInVIPList(playerName);
  
  // Delete conversation button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = `🗑 ${t('mods.vipList.deleteHistory')}`;
  deleteBtn.style.cssText = `
    padding: 8px 12px;
    background: rgba(255, 107, 107, 0.2);
    border: 2px solid ${CSS_CONSTANTS.COLORS.ERROR};
    border-radius: 4px;
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
    transition: background 0.2s;
  `;
  deleteBtn.addEventListener('mouseenter', () => {
    deleteBtn.style.background = 'rgba(255, 107, 107, 0.3)';
  });
  deleteBtn.addEventListener('mouseleave', () => {
    deleteBtn.style.background = 'rgba(255, 107, 107, 0.2)';
  });
  deleteBtn.addEventListener('click', async () => {
    const messagesArea = panel.querySelector('#chat-messages-all-chat');
    if (messagesArea) {
      showDeleteConfirmationForAllChat(panel, playerName, messagesArea);
    }
  });
  
  // Block/Unblock button
  const blockBtn = document.createElement('button');
  blockBtn.textContent = isBlocked ? `🔓 ${t('mods.vipList.unblockPlayer')}` : `🚫 ${t('mods.vipList.blockPlayer')}`;
  blockBtn.style.cssText = `
    padding: 8px 12px;
    background: ${isBlocked ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 107, 107, 0.2)'};
    border: 2px solid ${isBlocked ? CSS_CONSTANTS.COLORS.SUCCESS : CSS_CONSTANTS.COLORS.ERROR};
    border-radius: 4px;
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
    transition: background 0.2s;
  `;
  blockBtn.addEventListener('mouseenter', () => {
    blockBtn.style.background = isBlocked ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 107, 107, 0.3)';
  });
  blockBtn.addEventListener('mouseleave', () => {
    blockBtn.style.background = isBlocked ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 107, 107, 0.2)';
  });
  blockBtn.addEventListener('click', async () => {
    // Check current blocked status instead of using captured variable
    const currentlyBlocked = await isPlayerBlocked(playerName);
    
    if (currentlyBlocked) {
      const success = await unblockPlayer(playerName);
      if (success) {
        blockBtn.textContent = `🚫 ${t('mods.vipList.blockPlayer')}`;
        blockBtn.style.background = 'rgba(255, 107, 107, 0.2)';
        blockBtn.style.borderColor = CSS_CONSTANTS.COLORS.ERROR;
        // Update hover styles
        blockBtn.onmouseenter = () => {
          blockBtn.style.background = 'rgba(255, 107, 107, 0.3)';
        };
        blockBtn.onmouseleave = () => {
          blockBtn.style.background = 'rgba(255, 107, 107, 0.2)';
        };
        // Reload conversation and update UI
        const messagesArea = panel.querySelector('#chat-messages-all-chat');
        if (messagesArea) {
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
        blockBtn.style.background = 'rgba(76, 175, 80, 0.2)';
        blockBtn.style.borderColor = CSS_CONSTANTS.COLORS.SUCCESS;
        // Update hover styles
        blockBtn.onmouseenter = () => {
          blockBtn.style.background = 'rgba(76, 175, 80, 0.3)';
        };
        blockBtn.onmouseleave = () => {
          blockBtn.style.background = 'rgba(76, 175, 80, 0.2)';
        };
        // Reload conversation and update UI
        const messagesArea = panel.querySelector('#chat-messages-all-chat');
        if (messagesArea) {
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
  vipBtn.style.cssText = `
    padding: 8px 12px;
    background: ${isInVIPList ? 'rgba(76, 175, 80, 0.2)' : 'rgba(100, 181, 246, 0.2)'};
    border: 2px solid ${isInVIPList ? CSS_CONSTANTS.COLORS.SUCCESS : CSS_CONSTANTS.COLORS.LINK};
    border-radius: 4px;
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    cursor: ${isInVIPList ? 'default' : 'pointer'};
    font-size: 12px;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
    transition: background 0.2s;
    opacity: ${isInVIPList ? '0.6' : '1'};
  `;
  if (!isInVIPList) {
    vipBtn.addEventListener('mouseenter', () => {
      vipBtn.style.background = 'rgba(100, 181, 246, 0.3)';
    });
    vipBtn.addEventListener('mouseleave', () => {
      vipBtn.style.background = 'rgba(100, 181, 246, 0.2)';
    });
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
          vipBtn.style.background = 'rgba(76, 175, 80, 0.2)';
          vipBtn.style.borderColor = CSS_CONSTANTS.COLORS.SUCCESS;
          vipBtn.style.cursor = 'default';
        }
      } catch (error) {
        console.error('[VIP List] Error adding player to VIP list:', error);
        vipBtn.disabled = false;
        vipBtn.style.opacity = '1';
      }
    });
  }
  
  actionsColumn.appendChild(deleteBtn);
  actionsColumn.appendChild(blockBtn);
  actionsColumn.appendChild(vipBtn);
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
      // Reload conversation (will be empty)
      await loadConversation(otherPlayer, messagesArea, true);
    } else {
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });
  
  cancelBtn.addEventListener('click', () => {
    confirmation.remove();
  });
  
  messagesArea.appendChild(confirmation);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Switch active tab in all-chat panel
async function switchAllChatTab(playerName) {
  const panel = document.getElementById('vip-chat-panel-all-chat');
  if (!panel) return;
  
  const messagesArea = panel.querySelector('#chat-messages-all-chat');
  if (!messagesArea) return;
  
  // Update active tab
  activeAllChatTab = playerName;
  
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
  
  // Update actions column
  await updateAllChatActionsColumn(playerName);
  
  // Load appropriate conversation
  if (playerName === 'all-chat') {
    await loadAllChatConversation(messagesArea, true);
  } else {
    // Mark messages as read when switching to player tab
    await markAllMessagesAsReadFromPlayer(playerName);
    await loadConversation(playerName, messagesArea, true);
    // Clear unread badge on tab
    updateAllChatTabUnread(playerName, 0);
    // Hide chat icon in VIP list
    updateVIPListChatIcon(playerName, 0);
    
    // Update UI with privilege/warning messages for player conversations
    const currentPlayer = getCurrentPlayerName();
    const recipientHasChatEnabled = await checkRecipientChatEnabled(playerName);
    const hasPrivilege = await hasChatPrivilege(currentPlayer, playerName);
    
    // Check for incoming/outgoing requests
    const incomingRequests = await checkForChatRequests();
    const hasIncomingRequest = incomingRequests.some(req => req.from && req.from.toLowerCase() === playerName.toLowerCase());
    
    // Check for outgoing request
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
  }
  
  // Update input placeholder and state
  const textarea = panel.querySelector('textarea');
  const sendButton = panel.querySelector('button.primary');
  if (textarea) {
    if (playerName === 'all-chat') {
      const canChat = await checkRecipientChatEnabled(getCurrentPlayerName());
      textarea.placeholder = canChat ? t('mods.vipList.allChatPlaceholder') : t('mods.vipList.enableChatPlaceholder');
      textarea.disabled = !canChat;
      if (sendButton) sendButton.disabled = !canChat;
    } else {
      const recipientHasChatEnabled = await checkRecipientChatEnabled(playerName);
      const hasPrivilege = await hasChatPrivilege(getCurrentPlayerName(), playerName);
      const isBlocked = await isPlayerBlocked(playerName);
      const isBlockedBy = await isBlockedByPlayer(playerName);
      const canChat = recipientHasChatEnabled && hasPrivilege && !isBlocked && !isBlockedBy;
      textarea.placeholder = canChat ? tReplace('mods.vipList.chatPlaceholder', { name: playerName }) : tReplace('mods.vipList.messagePlaceholder', { name: playerName });
      textarea.disabled = !canChat;
      if (sendButton) sendButton.disabled = !canChat;
    }
  }
  
  // Save panel settings when active tab changes
  const chatPanel = document.getElementById('vip-chat-panel-all-chat');
  if (chatPanel && chatPanel.style.display !== 'none') {
    saveChatPanelSettings(true, false);
  }
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
  
  // Create and add tab
  const tab = await createAllChatTab(playerName, displayName, unreadCount, false);
  tabsContainer.appendChild(tab);
  allChatTabs.set(playerName, tab);
  
  // Save panel settings when tabs change
  if (panel && panel.style.display !== 'none') {
    saveChatPanelSettings(true, false);
  }
}

// Remove a tab from all-chat panel
function removeAllChatTab(playerName) {
  if (playerName === 'all-chat') return; // Can't remove "All Chat" tab
  
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
    // Try to switch to All Chat if it exists, otherwise switch to first available tab
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

// Update status color for a tab
async function updateAllChatTabStatus(playerName) {
  if (playerName === 'all-chat') return;
  
  const tab = allChatTabs.get(playerName);
  if (!tab) return;
  
  const tabLabel = tab.querySelector('.tab-player-name');
  if (!tabLabel) return;
  
  // Check if tab is active - if so, don't override text color (game classes control it)
  const isActive = tab.getAttribute('data-state') === 'active';
  
  try {
    const profileData = await fetchPlayerData(playerName);
    if (profileData) {
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
      // Default to offline if player not found
      if (!isActive) {
        tabLabel.style.color = CSS_CONSTANTS.COLORS.OFFLINE;
      } else {
        tabLabel.style.color = '';
      }
    }
  } catch (error) {
    // Default to offline on error
    if (!isActive) {
      tabLabel.style.color = CSS_CONSTANTS.COLORS.OFFLINE;
    } else {
      tabLabel.style.color = '';
    }
  }
}

// Update status colors for all open tabs
async function updateAllChatTabsStatus() {
  const updatePromises = Array.from(allChatTabs.keys())
    .filter(name => name !== 'all-chat')
    .map(playerName => updateAllChatTabStatus(playerName));
  
  await Promise.all(updatePromises);
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
    
    // Save panel state (open)
    saveChatPanelSettings(true, false);
    
    // Switch to polling if not already (panel is open)
    updateMessageCheckingMode();
    
    // Note: Tab restoration happens in autoReopenChatPanel after this function returns
    // This allows the caller to restore tabs after the panel is ready
    return;
  }
  
  // Load saved position for All Chat panel
  const savedPosition = loadChatPanelPosition('all-chat');
  const defaultTop = savedPosition?.top ?? 100;
  const defaultRight = savedPosition?.right ?? 20;
  const defaultLeft = savedPosition?.left ?? null;
  
  // Create main panel container
  const panel = document.createElement('div');
  panel.id = chatPanelId;
  const positionStyle = defaultLeft !== null 
    ? `left: ${defaultLeft}px; top: ${defaultTop}px;`
    : `top: ${defaultTop}px; right: ${defaultRight}px;`;
  panel.style.cssText = `
    position: fixed;
    ${positionStyle}
    width: 500px;
    height: ${CHAT_PANEL_DIMENSIONS.DEFAULT_HEIGHT}px;
    min-width: ${CHAT_PANEL_DIMENSIONS.MIN_WIDTH}px;
    max-width: ${CHAT_PANEL_DIMENSIONS.MAX_WIDTH}px;
    min-height: ${CHAT_PANEL_DIMENSIONS.MIN_HEIGHT}px;
    max-height: ${CHAT_PANEL_DIMENSIONS.MAX_HEIGHT}px;
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border: 6px solid transparent;
    border-image: url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill;
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
  }
  
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
  `;
  
  // Messages area
  const messagesArea = document.createElement('div');
  messagesArea.id = 'chat-messages-all-chat';
  messagesArea.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    background: rgba(0, 0, 0, 0.2);
    min-height: 0;
    min-width: 0;
  `;
  
  // Action buttons column (right side, only shown for player conversations)
  const actionsColumn = document.createElement('div');
  actionsColumn.id = 'all-chat-actions-column';
  actionsColumn.style.cssText = `
    width: 0;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
    border-left: 2px solid rgba(255, 255, 255, 0.1);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: width 0.2s;
  `;
  
  contentWrapper.appendChild(messagesArea);
  contentWrapper.appendChild(actionsColumn);
  
  // Input area
  const inputArea = document.createElement('div');
  inputArea.style.cssText = `
    padding: 8px;
    border-top: 2px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
  `;
  
  const inputRow = document.createElement('div');
  inputRow.style.cssText = 'display: flex; gap: 6px; align-items: center;';
  
  const canChat = hasChatEnabled;
  
  const textarea = document.createElement('textarea');
  textarea.className = 'vip-chat-input';
  textarea.placeholder = canChat ? t('mods.vipList.allChatPlaceholder') : t('mods.vipList.enableChatPlaceholder');
  textarea.disabled = !canChat;
  textarea.style.cssText = `
    flex: 1;
    min-height: 45px;
    max-height: 90px;
    padding: 6px;
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border: 4px solid transparent;
    border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
    color: ${canChat ? CSS_CONSTANTS.COLORS.TEXT_WHITE : 'rgba(255, 255, 255, 0.5)'};
    font-family: inherit;
    font-size: 13px;
    resize: none;
    box-sizing: border-box;
    ${!canChat ? 'cursor: not-allowed; opacity: 0.6;' : ''}
  `;
  
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
  
  const charCount = document.createElement('div');
  charCount.style.cssText = `font-size: 10px; color: rgba(255, 255, 255, 0.6); text-align: right;`;
  charCount.textContent = `0 / ${MESSAGING_CONFIG.maxMessageLength}`;
  
  // Character counter
  textarea.addEventListener('input', () => {
    const length = textarea.value.length;
    charCount.textContent = `${length} / ${MESSAGING_CONFIG.maxMessageLength}`;
    if (length > MESSAGING_CONFIG.maxMessageLength) {
      charCount.style.color = CSS_CONSTANTS.COLORS.ERROR;
    } else {
      charCount.style.color = 'rgba(255, 255, 255, 0.6)';
    }
  });
  
  // Send message function
  const sendMessageHandler = async () => {
    if (!canChat) {
      return;
    }
    
    const text = textarea.value.trim();
    if (!text || text.length === 0) {
      return;
    }
    
    if (text.length > MESSAGING_CONFIG.maxMessageLength) {
      return;
    }
    
    // Clear input
    textarea.value = '';
    charCount.textContent = `0 / ${MESSAGING_CONFIG.maxMessageLength}`;
    charCount.style.color = 'rgba(255, 255, 255, 0.6)';
    
    // Send message based on active tab
    try {
      let success = false;
      if (activeAllChatTab === 'all-chat') {
        success = await sendAllChatMessage(text);
        if (success) {
          await loadAllChatConversation(messagesArea, true);
        }
      } else {
        success = await sendMessage(activeAllChatTab, text);
        if (success) {
          await loadConversation(activeAllChatTab, messagesArea, true);
        }
      }
      
      if (!success) {
        // Restore text on failure
        textarea.value = text;
        const length = text.length;
        charCount.textContent = `${length} / ${MESSAGING_CONFIG.maxMessageLength}`;
        if (length > MESSAGING_CONFIG.maxMessageLength) {
          charCount.style.color = CSS_CONSTANTS.COLORS.ERROR;
        }
      }
    } catch (error) {
      // Handle Firebase 401 error specifically
      if (error.message === 'FIREBASE_401') {
        // Restore text
        textarea.value = text;
        const length = text.length;
        charCount.textContent = `${length} / ${MESSAGING_CONFIG.maxMessageLength}`;
        
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
        const length = text.length;
        charCount.textContent = `${length} / ${MESSAGING_CONFIG.maxMessageLength}`;
        if (length > MESSAGING_CONFIG.maxMessageLength) {
          charCount.style.color = CSS_CONSTANTS.COLORS.ERROR;
        }
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
  inputArea.appendChild(charCount);
  
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
        const timeoutId = setTimeout(() => {
          messagesArea.scrollTop = messagesArea.scrollHeight;
          pendingTimeouts.delete(timeoutId);
        }, 100);
        trackTimeout(timeoutId);
        
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
  
  // Check for new messages periodically (if All Chat API is available)
  if (getAllChatApiUrl()) {
    panel._checkInterval = setInterval(async () => {
      try {
        const messages = await getAllChatMessages();
        const latestTimestamp = messages.length > 0 ? messages[messages.length - 1]?.timestamp : null;
        const storedTimestamp = panel._lastTimestamp;
        
        if (storedTimestamp === null || latestTimestamp === null) {
          // First check - initialize timestamp
          panel._lastTimestamp = latestTimestamp;
        } else if (latestTimestamp > storedTimestamp || messages.length !== (panel._lastMessageCount || 0)) {
          // New messages detected - refresh UI (only if All Chat tab is active)
          if (activeAllChatTab === 'all-chat') {
            panel._lastTimestamp = latestTimestamp;
            panel._lastMessageCount = messages.length;
            await loadAllChatConversation(messagesArea);
          }
        }
      } catch (error) {
        if (error.message && !error.message.includes('401')) {
          console.warn('[VIP List] Error checking All Chat changes:', error);
        }
      }
    }, 5000); // Check every 5 seconds
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
    saveChatPanelSettings(true, false);
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
// 7. Cyclopedia Integration
// =======================

// Open Cyclopedia modal for a specific player
function openCyclopediaForPlayer(playerName) {
  // Close VIP List modal
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
  
  // Helper to set cyclopedia state
  const setCyclopediaState = (username) => {
    if (typeof cyclopediaState !== 'undefined') {
      cyclopediaState.searchedUsername = username;
    } else if (typeof window !== 'undefined' && window.cyclopediaState) {
      window.cyclopediaState.searchedUsername = username;
    }
  };
  
  // Wait a bit for modal to close, then open Cyclopedia
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
          
          // Find and set search input value
          const searchInput = document.querySelector('input[type="text"]');
          if (searchInput) {
            searchInput.value = playerName;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          // Find and click Leaderboards button
          const leaderboardsButton = Array.from(document.querySelectorAll('div')).find(div => {
            const text = div.textContent?.trim() || '';
            return text === 'Leaderboards';
          });
          
          if (leaderboardsButton) {
            leaderboardsButton.click();
          }
          
          // Wait a bit, then trigger the search
          const timeout4 = setTimeout(() => {
            pendingTimeouts.delete(timeout4);
            const searchButton = Array.from(document.querySelectorAll('button')).find(btn => {
              const text = btn.textContent?.trim() || '';
              return text === 'Search';
            });
            
            if (searchButton) {
              searchButton.click();
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
  }, TIMEOUTS.SHORT);
  trackTimeout(timeout1);
}

// =======================
// 8. Dropdown Positioning
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
// 8.1. Shared Dropdown Helper Functions
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
// 8.2. Additional Shared Helper Functions
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
// 9. Search Input Management
// =======================

// Add search input styles if not already added
function addSearchInputStyles() {
  if (!document.getElementById('vip-search-input-styles')) {
    const style = document.createElement('style');
    style.id = 'vip-search-input-styles';
    style.textContent = `
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
// 10. Modal Styling
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
// 11. VIP List Core Functions
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
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DATA);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[VIP List] Error loading VIP list:', error);
    return [];
  }
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
    }
    
    // Apply direction
    return direction === 'asc' ? comparison : -comparison;
  });
}

function saveVIPList(vipList) {
  try {
    // Sort before saving using current sort state
    const sortedList = sortVIPList(vipList);
    localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(sortedList));
  } catch (error) {
    console.error('[VIP List] Error saving VIP list:', error);
  }
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

async function fetchPlayerData(playerName) {
  try {
    const apiUrl = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(playerName)}%22%7D%7D`;
    
    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch player data (HTTP ${response.status})`);
    }
    
    const data = await response.json();
    
    // Extract profile data from the response
    let profileData = null;
    if (Array.isArray(data) && data[0]?.result?.data?.json !== undefined) {
      profileData = data[0].result.data.json;
    } else {
      profileData = data;
    }
    
    return profileData;
  } catch (error) {
    console.error('[VIP List] Error fetching player data:', error);
    throw error;
  }
}

async function refreshAllVIPPlayerData() {
  const vipList = getVIPList();
  if (vipList.length === 0) return;
  
  console.log('[VIP List] Refreshing data for', vipList.length, 'VIP players...');
  
  const currentPlayerName = getCurrentPlayerName();
  
  // Fetch data for all players in parallel
  const refreshPromises = vipList.map(async (vip) => {
    try {
      const profileData = await fetchPlayerData(vip.name || vip.profile);
      
      if (profileData === null) {
        // Player no longer exists, keep old data
        console.warn(`[VIP List] Player "${vip.name}" not found, keeping old data`);
        return vip;
      }
      
      const isCurrentPlayer = currentPlayerName && (profileData.name || vip.name).toLowerCase() === currentPlayerName;
      const playerInfo = extractPlayerInfoFromProfile(profileData, vip.name || vip.profile);
      playerInfo.profile = vip.profile || (profileData.name || vip.name).toLowerCase();
      
      return playerInfo;
    } catch (error) {
      console.error(`[VIP List] Error refreshing data for "${vip.name}":`, error);
      // Return old data if fetch fails
      return vip;
    }
  });
  
  const updatedList = await Promise.all(refreshPromises);
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
          // For level and rankPoints, default to desc (higher is better)
          // For other columns, default to asc
          currentSortState.direction = (column === 'level' || column === 'rankPoints') ? 'desc' : 'asc';
        }
        
        saveSortPreference();
        await refreshVIPListDisplay();
      });
      
      // Create content (icon or text) - centered
      if (iconUrl) {
        const iconImg = document.createElement('img');
        iconImg.src = iconUrl;
        iconImg.alt = text;
        iconImg.style.cssText = 'width: 11px; height: 11px; image-rendering: pixelated; display: block;';
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
    openCyclopediaForPlayer(vip.name);
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
    contentWrapper.innerHTML = '';
    const newContent = await getVIPListContent(forPanel);
    contentWrapper.appendChild(newContent);
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
    
    localStorage.setItem(STORAGE_KEYS.PANEL_SETTINGS, JSON.stringify(settings));
    console.log('[VIP List] Panel settings saved:', settings);
  } catch (error) {
    console.error('[VIP List] Error saving panel settings:', error);
  }
}

function loadPanelSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PANEL_SETTINGS);
    if (saved) {
      const settings = JSON.parse(saved);
      console.log('[VIP List] Panel settings loaded:', settings);
      return settings;
    }
  } catch (error) {
    console.error('[VIP List] Error loading panel settings:', error);
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
      border-image: url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill;
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
// 12. Exports & Lifecycle Management
// =======================

exports = {
  init: function() {
    try {
      // Ensure config is loaded from localStorage first (prioritize localStorage like Rank Pointer)
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
      // Note: WeakSet entries are automatically garbage collected when elements are removed
      
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