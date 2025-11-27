// Bestiary Automator Mod for Bestiary Arena
// Code by MathiasBynens and TheMegafuji
// Edited for SuperMod Loader

console.log('[Bestiary Automator] initializing...');

// Configuration with defaults
const defaultConfig = {
  enabled: false,
  autoRefillStamina: false,
  minimumStaminaWithoutRefill: 15,
  autoCollectRewards: false,
  autoDayCare: false,
  autoPlayAfterDefeat: false,
  fasterAutoplay: false,
  fasterAutoplayMs: 100,
  persistAutoRefillOnRefresh: false,
  useApiForStaminaRefill: false,
  potionQuantityThresholds: {
    mini: 0,
    strong: 0,
    great: 0,
    ultimate: 0,
    supreme: 0
  },
  potionEnabled: {
    mini: true,
    strong: true,
    great: true,
    ultimate: true,
    supreme: true
  }
};

// Storage key for localStorage
const STORAGE_KEY = 'bestiary-automator-config';

// Initialize config with simplified priority: localStorage > context > defaults
let config = {};

// Load config with single source of truth
const loadConfig = () => {
  try {
    // Try localStorage first
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      const savedConfig = JSON.parse(savedData);
      const loadedConfig = Object.assign({}, defaultConfig, savedConfig);
      
      return loadedConfig;
    }
  } catch (error) {
    console.error('[Bestiary Automator] Error loading config:', error);
  }
  
  // Fallback to context or defaults
  const fallbackConfig = Object.assign({}, defaultConfig, context.config || {});
  
  return fallbackConfig;
};

// Save config to localStorage (consolidated helper)
const saveConfigToStorage = (configToSave) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configToSave));
    console.log('[Bestiary Automator] Config saved to localStorage successfully');
    return true;
  } catch (error) {
    console.error('[Bestiary Automator] Error saving config to localStorage:', error);
    return false;
  }
};

config = loadConfig();

// Force autoRefillStamina to false on every page load for safety (unless user enabled persistence)
if (!config.persistAutoRefillOnRefresh) {
  console.log('[Bestiary Automator] Resetting autoRefillStamina to false (persistAutoRefillOnRefresh is disabled)');
  config.autoRefillStamina = false;
} else {
  console.log('[Bestiary Automator] Keeping autoRefillStamina value (persistAutoRefillOnRefresh is enabled):', config.autoRefillStamina);
}

// Constants
const MOD_ID = 'bestiary-automator';
const BUTTON_ID = `${MOD_ID}-button`;
const CONFIG_BUTTON_ID = `${MOD_ID}-config-button`;
const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;

// Faster Autoplay timing constants
const SUPER_AUTOPLAY_TIMING = {
  INITIAL_DELAY: 100,       // Wait for game server API data processing (reduced for faster response)
  SERVER_RESULTS_RETRY_DELAY: 200, // Delay between server results retry attempts
  MAX_SERVER_RESULTS_RETRIES: 10,  // Maximum retry attempts for server results
  NAVIGATION_DELAY: 150,     // Delay before/after navigation (reduced for faster response)
  BUTTON_CLICK_DELAY: 150,   // Delay after button clicks (reduced for faster response)
  DEFEAT_PROCESSING_DELAY: 300, // Delay before processing defeat toast
  STATE_RESET_DELAY: 1000    // Delay before resetting state
};

// Common timing constants
const TIMING = {
  TOAST_AUTO_REMOVE: 4000,      // Auto-remove toast after 4 seconds
  TOAST_STACK_OFFSET: 46,        // Offset between stacked toasts
  QUEST_LOG_CLOSE_ATTEMPTS: 3,   // Number of ESC key presses to close quest log
  QUEST_LOG_CLOSE_DELAY: 50,     // Delay between ESC key presses
  STAMINA_REFILL_DELAY: 500,     // Delay for stamina refill operations
  MODAL_CLOSE_DELAY: 500,        // Delay after closing modals
  REWARDS_COLLECT_DELAY: 500,    // Delay for rewards collection
  DAYCARE_LEVELUP_DELAY: 1000,   // Delay after daycare level up
  DAYCARE_EJECTION_DELAY: 1000,  // Delay after daycare ejection
  SCROLL_LOCK_CHECK_DELAY: 150,  // Delay after ESC key for scroll lock check
  ESC_KEY_REPEAT_DELAY: 200      // Delay between repeated ESC key presses
};

// Only track states that prevent conflicts
const AUTOMATION_STATES = {
  PROCESSING_DEFEAT: 'processing_defeat',  // Handling defeat toast
  PROCESSING_BATTLE: 'processing_battle',  // Handling battle ongoing toast
  PROCESSING_SOMETHING_WRONG: 'processing_something_wrong',  // Handling "Something went wrong" toast
  COUNTDOWN: 'countdown'                   // Waiting for countdown to complete
};

let currentState = null;

// Translations
// Use shared translation system via API
const t = (key) => api.i18n.t(key);

// State machine helper functions
const setState = (newState) => {
  const oldState = currentState;
  currentState = newState;
  if (newState) {
    console.log(`[Bestiary Automator] State changed: ${oldState || 'none'} → ${newState}`);
  } else {
    console.log(`[Bestiary Automator] State cleared: ${oldState} → none`);
  }
};

const isState = (state) => currentState === state;
const canTransitionTo = (newState) => {
  // Only prevent transitions if we're already in a conflicting state
  if (currentState && currentState !== newState) {
    return false;
  }
  return true;
};

// Helper functions for automation

// Check if Board Analyzer is running (repeated check pattern)
const isBoardAnalyzerRunning = () => {
  return !!(window.__modCoordination && window.__modCoordination.boardAnalyzerRunning);
};

// Simulate ESC key press (repeated pattern)
const simulateEscKey = () => {
  const escEvent = new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    keyCode: 27,
    which: 27,
    bubbles: true,
    cancelable: true
  });
  document.dispatchEvent(escEvent);
};

// Find button with specific text (considering language differences)
const findButtonWithText = (textKey) => {
  const text = t(textKey);
  const buttons = document.querySelectorAll('button');
  
  for (const button of buttons) {
    const buttonText = button.textContent.trim();
    
    // Check exact text match first
    if (buttonText === text) {
      return button;
    }
    
    // Check if text is contained within the button (for complex buttons)
    if (buttonText.includes(text)) {
      return button;
    }
  }
  
  return null;
};

// Click button with specific text
const clickButtonWithText = (textKey) => {
  const button = findButtonWithText(textKey);
  if (button) {
    button.click();
    return true;
  }
  console.log(`[Bestiary Automator] Button not found: "${textKey}"`);
  return false;
};

// Check and handle scroll lock
const handleScrollLock = async () => {
  // Don't handle scroll lock if Board Analyzer is running
  if (isBoardAnalyzerRunning()) {
    console.log('[Bestiary Automator] Board Analyzer is running, skipping scroll lock handling');
    return false;
  }
  
  try {
    const body = document.body;
    const scrollLockValue = body.getAttribute('data-scroll-locked');
    
    if (scrollLockValue && parseInt(scrollLockValue) > 0) {
      console.log(`[Bestiary Automator] Scroll lock detected (${scrollLockValue}), simulating ESC key`);
      
      // Simulate ESC key press
      simulateEscKey();
      
      // Wait briefly and verify the scroll lock was actually resolved
      await sleep(TIMING.SCROLL_LOCK_CHECK_DELAY);
      const newScrollLockValue = body.getAttribute('data-scroll-locked');
      const wasResolved = !newScrollLockValue || parseInt(newScrollLockValue) <= 0;
      
      if (wasResolved) {
        console.log(`[Bestiary Automator] Scroll lock successfully resolved (was: ${scrollLockValue}, now: ${newScrollLockValue || '0'})`);
      } else {
        console.log(`[Bestiary Automator] Scroll lock still active after ESC (was: ${scrollLockValue}, now: ${newScrollLockValue})`);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[Bestiary Automator] Error handling scroll lock:', error);
    return false;
  }
};

// Click all Close buttons
const clickAllCloseButtons = () => {
  // Don't close modals if Board Analyzer is running
  if (isBoardAnalyzerRunning()) {
    console.log('[Bestiary Automator] Board Analyzer is running, skipping modal close operations');
    return false;
  }
  
  const closeButtons = document.querySelectorAll('button');
  let clickedCount = 0;
  
  for (const button of closeButtons) {
    const buttonText = button.textContent.trim();
    if (buttonText === 'Close' || buttonText === 'Fechar') {
      button.click();
      clickedCount++;
    }
  }
  
  if (clickedCount > 0) {
    console.log(`[Bestiary Automator] Clicked ${clickedCount} close button(s)`);
  }
  
  return clickedCount > 0;
};

// Unified timeout management
let activeTimeouts = new Map();

const sleep = (timeout = 1000) => {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      activeTimeouts.delete(timeoutId);
      resolve();
    }, timeout);
    activeTimeouts.set(timeoutId, { type: 'sleep', resolve });
  });
};

const cancellableSleep = (timeout = 1000, checkCancellation = () => false) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (checkCancellation()) {
        clearInterval(checkInterval);
        activeTimeouts.delete(checkInterval);
        resolve('cancelled');
        return;
      }
      
      if (Date.now() - startTime >= timeout) {
        clearInterval(checkInterval);
        activeTimeouts.delete(checkInterval);
        resolve('completed');
        return;
      }
    }, 100);
    
    // Store interval for potential cleanup
    activeTimeouts.set(checkInterval, { type: 'interval', resolve });
  });
};

// Cancel all active timeouts
const cancelAllTimeouts = () => {
  for (const [id, timeout] of activeTimeouts.entries()) {
    if (timeout.type === 'sleep') {
      clearTimeout(id);
    } else if (timeout.type === 'interval') {
      clearInterval(id);
    }
  }
  activeTimeouts.clear();
};

// Cancel current countdown task
const cancelCurrentCountdown = () => {
  if (currentCountdownTask) {
    currentCountdownTask.cancelled = true;
    currentCountdownTask = null;
    
    // Reset state if we were in countdown
    if (isState(AUTOMATION_STATES.COUNTDOWN)) {
      setState(null);
      console.log('[Bestiary Automator] Countdown cancelled due to board state change');
      console.log('[Bestiary Automator] Ready to detect new toasters');
      console.log('[Bestiary Automator] Note: Main countdown function will complete its sleep and then confirm cancellation');
    }
  }
};

// Show a notification message
function showNotification(message, type = 'info', duration = 3000) {
  if (api.ui && api.ui.notify) {
    api.ui.notify({
      message: message,
      type: type,
      duration: duration
    });
    return;
  }
  
  // Fallback to a simple modal
  api.ui.components.createModal({
    title: type.charAt(0).toUpperCase() + type.slice(1),
    content: message,
    buttons: [{ text: t('common.close'), primary: true }]
  });
}

// Show stamina restoration toast (matches Raid_Hunter.js toast pattern)
const showStaminaRestoredToast = (pointsRestored) => {
  try {
    // Get or create the main toast container (same pattern as Raid_Hunter.js)
    let mainContainer = document.getElementById('bestiary-automator-toast-container');
    if (!mainContainer) {
      mainContainer = document.createElement('div');
      mainContainer.id = 'bestiary-automator-toast-container';
      mainContainer.style.cssText = `
        position: fixed;
        z-index: 9999;
        inset: 16px 16px 64px;
        pointer-events: none;
      `;
      document.body.appendChild(mainContainer);
    }
    
    // Count existing toasts to calculate stacking position
    const existingToasts = mainContainer.querySelectorAll('.toast-item');
    const stackOffset = existingToasts.length * TIMING.TOAST_STACK_OFFSET;
    
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
    
    // Create toast button
    const toast = document.createElement('button');
    toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
    
    // Create widget structure
    const widgetTop = document.createElement('div');
    widgetTop.className = 'widget-top h-2.5';
    
    const widgetBottom = document.createElement('div');
    widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';
    
    // Create text content
    const textLeft = document.createElement('div');
    textLeft.className = 'text-left';
    
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Restored ';
    
    const staminaSpan = document.createElement('span');
    staminaSpan.className = 'text-stamina';
    staminaSpan.textContent = `+${pointsRestored} stamina points`;
    
    paragraph.appendChild(staminaSpan);
    textLeft.appendChild(paragraph);
    widgetBottom.appendChild(textLeft);
    
    // Assemble toast
    toast.appendChild(widgetTop);
    toast.appendChild(widgetBottom);
    flexContainer.appendChild(toast);
    mainContainer.appendChild(flexContainer);
    
    // Auto-remove after duration
    setTimeout(() => {
      if (flexContainer && flexContainer.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        
        // Update positions of remaining toasts
        const toasts = mainContainer.querySelectorAll('.toast-item');
        toasts.forEach((toast, index) => {
          const offset = index * TIMING.TOAST_STACK_OFFSET;
          toast.style.transform = `translateY(-${offset}px)`;
        });
      }
    }, TIMING.TOAST_AUTO_REMOVE);
    
  } catch (error) {
    console.error('[Bestiary Automator] Error showing stamina restored toast:', error);
  }
};

// Automation Tasks

// Stamina refill tracking (simplified)

// Check if game is in sandbox mode
const isSandboxMode = () => {
  try {
    const boardContext = globalThis.state?.board?.getSnapshot()?.context;
    return boardContext?.mode === 'sandbox';
  } catch (error) {
    console.warn('[Bestiary Automator] Error checking sandbox mode:', error);
    return false;
  }
};

// Check if game is in autoplay mode
const isAutoplayMode = () => {
  try {
    const boardContext = globalThis.state?.board?.getSnapshot()?.context;
    return boardContext?.mode === 'autoplay';
  } catch (error) {
    console.warn('[Bestiary Automator] Error checking autoplay mode:', error);
    return false;
  }
};

// Check if game is in a state where automation should run
const isGameActive = () => {
  try {
    // Check if Board Analyzer is running - if so, pause automation
    if (isBoardAnalyzerRunning()) {
      console.log('[Bestiary Automator] Board Analyzer is running, pausing automation');
      return false;
    }
    
    // Check if Game State API is available
    if (!globalThis.state || !globalThis.state.board) {
      console.log('[Bestiary Automator] Game State API not available');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[Bestiary Automator] Error checking game state:', error);
    return false;
  }
};

// Simple game readiness check for stamina refill
const isGameReadyForStaminaRefill = () => {
  try {
    // Check if Board Analyzer is running - if so, pause automation
    if (isBoardAnalyzerRunning()) {
      console.log('[Bestiary Automator] Board Analyzer is running, pausing stamina refill');
      return false;
    }
    
    // Simple check: just verify stamina element exists
    return !!getStaminaElement();
  } catch (error) {
    console.error('[Bestiary Automator] Error checking game readiness:', error);
    return false;
  }
};

// Get stamina element from DOM (repeated query pattern)
const getStaminaElement = () => {
  return document.querySelector('[title="Stamina"]');
};

// Get stamina value element from DOM
const getStaminaValueElement = () => {
  const elStamina = getStaminaElement();
  return elStamina ? elStamina.querySelector('span span') : null;
};

// Parse max stamina from DOM (e.g., "3/360" -> 360)
const parseMaxStaminaFromDOM = () => {
  try {
    const elStamina = getStaminaElement();
    if (!elStamina) {
      console.log('[Bestiary Automator] Stamina element not found in DOM for max stamina parsing');
      return null;
    }
    
    // Look for pattern like "3/360" in the stamina element
    const staminaText = elStamina.textContent || '';
    const match = staminaText.match(/\/(\d+)/);
    
    if (match && match[1]) {
      const maxStam = Number(match[1]);
      if (!isNaN(maxStam) && maxStam > 0) {
        console.log(`[Bestiary Automator] Parsed max stamina from DOM: ${maxStam}`);
        return maxStam;
      }
    }
    
    console.log('[Bestiary Automator] Could not parse max stamina from DOM');
    return null;
  } catch (error) {
    console.error('[Bestiary Automator] Error parsing max stamina from DOM:', error);
    return null;
  }
};

// Get current stamina from DOM (used by Game State-based refill system)
const getCurrentStaminaFromState = () => {
  try {
    console.log('[Bestiary Automator] Checking current stamina from DOM...');
    const staminaElement = getStaminaValueElement();
    if (!staminaElement) {
      console.log('[Bestiary Automator] Stamina value element not found');
      return null;
    }
    
    const staminaText = staminaElement.textContent;
    const stamina = Number(staminaText);
    
    if (isNaN(stamina)) {
      console.log(`[Bestiary Automator] Invalid stamina value: "${staminaText}" (not a number)`);
      return null;
    }
    
    console.log(`[Bestiary Automator] Current stamina retrieved: ${stamina} (from DOM text: "${staminaText}")`);
    return stamina;
  } catch (error) {
    console.error('[Bestiary Automator] Error getting current stamina:', error);
    return null;
  }
};

// Helper functions for mod coordination
const setRefillingFlag = () => {
  try {
    window.__modCoordination = window.__modCoordination || {};
    window.__modCoordination.automatorRefilling = true;
    console.log('[Bestiary Automator] Set automatorRefilling flag - other mods should pause');
  } catch (_) {}
};

const clearRefillingFlag = () => {
  try {
    if (window.__modCoordination) {
      window.__modCoordination.automatorRefilling = false;
      console.log('[Bestiary Automator] Cleared automatorRefilling flag - other mods can resume');
    }
  } catch (_) {}
};

// Helper to check if Game State API is available
const isGameStateAPIAvailable = () => {
  return !!(globalThis.state && globalThis.state.player);
};

// Helper to get player inventory from Game State API
const getPlayerInventory = () => {
  if (!isGameStateAPIAvailable()) {
    return null;
  }
  const playerContext = globalThis.state.player.getSnapshot().context;
  return playerContext.inventory || {};
};

// Helper to get current stamina from Game State API (for Game State-based refill method)
const getCurrentStaminaFromGameStateAPI = () => {
  try {
    if (!isGameStateAPIAvailable()) {
      console.log('[Bestiary Automator] Game State API not available for stamina check');
      return null;
    }
    
    const playerContext = globalThis.state.player.getSnapshot().context;
    
    // Check if stamina is directly in playerContext
    if (playerContext.stamina !== undefined && playerContext.stamina !== null) {
      const staminaValue = Number(playerContext.stamina);
      if (!isNaN(staminaValue)) {
        console.log(`[Bestiary Automator] Current stamina retrieved from Game State API: ${staminaValue}`);
        return staminaValue;
      }
    }
    
    // Try alternative property names
    if (playerContext.currentStamina !== undefined && playerContext.currentStamina !== null) {
      const staminaValue = Number(playerContext.currentStamina);
      if (!isNaN(staminaValue)) {
        console.log(`[Bestiary Automator] Found currentStamina in Game State API: ${staminaValue}`);
        return staminaValue;
      }
    }
    
    // Check if there's a utils function to calculate stamina
    if (globalThis.state.utils && typeof globalThis.state.utils.getCurrentStamina === 'function') {
      try {
        const stamina = globalThis.state.utils.getCurrentStamina();
        if (stamina !== null && stamina !== undefined) {
          console.log(`[Bestiary Automator] Current stamina from utils.getCurrentStamina: ${stamina}`);
          return Number(stamina);
        }
      } catch (e) {
        // Utils function doesn't exist or failed, continue to fallback
      }
    }
    
    // Calculate current stamina from staminaWillBeFullAt timestamp
    // Stamina regenerates at 1 per minute (60 seconds)
    if (playerContext.staminaWillBeFullAt && maxStamina !== null) {
      const currentTime = Date.now();
      const staminaWillBeFullAt = playerContext.staminaWillBeFullAt;
      const timeUntilFull = staminaWillBeFullAt - currentTime;
      
      console.log('[Bestiary Automator] === Stamina Calculation Debug ===');
      console.log(`[Bestiary Automator] Max stamina: ${maxStamina}`);
      console.log(`[Bestiary Automator] Current time: ${currentTime} (${new Date(currentTime).toLocaleString()})`);
      console.log(`[Bestiary Automator] Stamina will be full at: ${staminaWillBeFullAt} (${new Date(staminaWillBeFullAt).toLocaleString()})`);
      console.log(`[Bestiary Automator] Time until full: ${timeUntilFull}ms (${(timeUntilFull / 1000).toFixed(1)}s)`);
      
      // If already full or past the timestamp, stamina is at max
      if (timeUntilFull <= 0) {
        console.log(`[Bestiary Automator] ✅ Stamina is FULL (calculated from timestamp): ${maxStamina}`);
        console.log('[Bestiary Automator] === End Calculation ===');
        return maxStamina;
      }
      
      // Calculate missing stamina: time until full (in minutes) = stamina missing
      // 1 stamina per minute = 60,000ms per stamina
      const timeUntilFullMinutes = timeUntilFull / 60000;
      const staminaMissing = Math.ceil(timeUntilFullMinutes);
      const currentStamina = Math.max(0, maxStamina - staminaMissing);
      
      console.log(`[Bestiary Automator] Time until full: ${timeUntilFullMinutes.toFixed(2)} minutes`);
      console.log(`[Bestiary Automator] Stamina missing (rounded up): ${staminaMissing}`);
      console.log(`[Bestiary Automator] Calculation: ${maxStamina} - ${staminaMissing} = ${currentStamina}`);
      console.log(`[Bestiary Automator] ✅ Calculated current stamina: ${currentStamina} / ${maxStamina}`);
      console.log('[Bestiary Automator] === End Calculation ===');
      return currentStamina;
    }
    
    // Fallback to DOM if calculation not possible (works in foreground tabs, but not background)
    console.log('[Bestiary Automator] Cannot calculate stamina from timestamp (missing maxStamina or staminaWillBeFullAt), falling back to DOM');
    return getCurrentStaminaFromState();
    
  } catch (error) {
    console.error('[Bestiary Automator] Error getting current stamina from Game State API:', error);
    // Fallback to DOM on error
    return getCurrentStaminaFromState();
  }
};

// Helper to map tier number to potion name
const getPotionNameFromTier = (tier) => {
  const tierMap = {
    1: 'mini',
    2: 'strong',
    3: 'great',
    4: 'ultimate',
    5: 'supreme'
  };
  return tierMap[tier] || null;
};

// Helper to find lowest tier potion available in inventory that is enabled and meets threshold
const findLowestTierPotion = (inventory) => {
  if (!inventory) return null;
  
  // Check tiers 1-5 (Mini, Strong, Great, Ultimate, Supreme)
  for (let tier = 1; tier <= 5; tier++) {
    const potionKey = `stamina${tier}`;
    const potionCount = inventory[potionKey] || 0;
    
    // Check if potion exists and has quantity > 0
    if (potionCount <= 0) {
      continue;
    }
    
    // Get potion name from tier
    const potionName = getPotionNameFromTier(tier);
    if (!potionName) {
      continue;
    }
    
    // Check if this potion type is enabled
    if (!config.potionEnabled || !config.potionEnabled[potionName]) {
      console.log(`[Bestiary Automator] Tier ${tier} (${potionName}) potion is disabled, skipping`);
      continue;
    }
    
    // Check if quantity meets threshold
    const threshold = config.potionQuantityThresholds && config.potionQuantityThresholds[potionName] !== undefined
      ? config.potionQuantityThresholds[potionName]
      : 0;
    
    if (potionCount <= threshold) {
      console.log(`[Bestiary Automator] Tier ${tier} (${potionName}) potion quantity (${potionCount}) does not exceed threshold (${threshold}), skipping`);
      continue;
    }
    
    // This potion is available, enabled, and meets threshold
    console.log(`[Bestiary Automator] Found usable tier ${tier} (${potionName}) potion: ${potionCount} available (threshold: ${threshold})`);
    return tier;
  }
  
  return null;
};

// Helper to extract API response data
const extractAPIResponseData = (result) => {
  if (result && result[0] && result[0].result && result[0].result.data && result[0].result.data.json) {
    return result[0].result.data.json;
  }
  return null;
};

// Helper to update inventory state from inventoryDiff
const updateInventoryFromDiff = (inventoryDiff) => {
  if (!inventoryDiff || !isGameStateAPIAvailable()) {
    return;
  }
  
  globalThis.state.player.send({
    type: 'setState',
    fn: (prev) => {
      const newState = { ...prev };
      newState.inventory = { ...prev.inventory };
      
      for (let tier = 1; tier <= 4; tier++) {
        const potionKey = `stamina${tier}`;
        if (inventoryDiff[potionKey] !== undefined) {
          const diff = inventoryDiff[potionKey];
          if (newState.inventory[potionKey] !== undefined) {
            newState.inventory[potionKey] = Math.max(0, newState.inventory[potionKey] + diff);
            newState[potionKey] = newState.inventory[potionKey];
          }
        }
      }
      
      return newState;
    }
  });
};

// Helper to update staminaWillBeFullAt timestamp
const updateStaminaWillBeFullAt = (timestamp) => {
  if (!timestamp || !isGameStateAPIAvailable()) {
    return;
  }
  
  globalThis.state.player.send({
    type: 'setState',
    fn: (prev) => ({
      ...prev,
      staminaWillBeFullAt: timestamp
    })
  });
};

// Simple stamina refill method for background tabs (original approach)
const refillStaminaSimple = async (elStamina) => {
  elStamina.click();
  await sleep(TIMING.STAMINA_REFILL_DELAY);
  clickButtonWithText('mods.automator.usePotion');
  await sleep(TIMING.STAMINA_REFILL_DELAY);
  clickButtonWithText('common.close');
  await sleep(TIMING.STAMINA_REFILL_DELAY);
};

// Robust stamina refill method for foreground tabs (with retry logic)
const refillStaminaWithRetry = async (elStamina, staminaElement) => {
  const initialStamina = Number(staminaElement.textContent);
  
  elStamina.click();
  await sleep(TIMING.STAMINA_REFILL_DELAY);
  clickButtonWithText('mods.automator.usePotion');
  await sleep(TIMING.STAMINA_REFILL_DELAY);
  
      // Retry logic for foreground tabs
      let retryCount = 0;
      const maxRetries = 5;
      
      while (retryCount < maxRetries) {
        const newStaminaElement = getStaminaValueElement();
        if (newStaminaElement) {
      const newStamina = Number(newStaminaElement.textContent);
      if (newStamina >= config.minimumStaminaWithoutRefill) {
        break;
      }
      
      retryCount++;
      
      clickButtonWithText('mods.automator.usePotion');
      await sleep(TIMING.STAMINA_REFILL_DELAY);
    } else {
      break;
    }
  }
  
  if (retryCount >= maxRetries) {
    // Check if stamina didn't increase at all - likely means no potions
    const finalStaminaElement = getStaminaValueElement();
    if (finalStaminaElement) {
      const finalStamina = Number(finalStaminaElement.textContent);
      if (finalStamina === initialStamina) {
        // Wait a bit for inventory to update, then check
        await sleep(1000);
        if (!hasStaminaPotions()) {
          disableAutoRefillDueToNoPotions();
        }
      }
    }
  }
  
  // Use ESC key for foreground tabs (more reliable when tab is active)
  simulateEscKey();
  await sleep(TIMING.ESC_KEY_REPEAT_DELAY);
  simulateEscKey();
  
  await sleep(300);
};

// Rate limiting for potion usage: max 1 potion every 3 seconds
let lastPotionUsageTime = 0;
const POTION_RATE_LIMIT_MS = 3000; // 3 seconds

const waitForPotionRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastPotion = now - lastPotionUsageTime;
  
  if (timeSinceLastPotion < POTION_RATE_LIMIT_MS) {
    const waitTime = POTION_RATE_LIMIT_MS - timeSinceLastPotion;
    console.log(`[Bestiary Automator] Rate limit: waiting ${Math.ceil(waitTime / 1000)}s before next potion...`);
    await sleep(waitTime);
  }
  
  lastPotionUsageTime = Date.now();
};

// Game State-based stamina refill method
const refillStaminaViaAPI = async () => {
  // Check game readiness before starting
  if (!isGameReadyForStaminaRefill()) {
    return false;
  }
  
  setRefillingFlag();
  
  try {
    // Get current stamina from Game State API (not DOM, for background tab support)
    let currentStamina = getCurrentStaminaFromGameStateAPI();
    
    // If we got a value, update tracked stamina
    if (currentStamina !== null) {
      trackedStamina = currentStamina;
    } else if (trackedStamina !== null) {
      // Use tracked value if available (for background tabs)
      currentStamina = trackedStamina;
    } else {
      clearRefillingFlag();
      return false;
    }
    
    // Check if we already have enough stamina
    if (currentStamina >= config.minimumStaminaWithoutRefill) {
      clearRefillingFlag();
      return true;
    }
    
    // Check if any enabled potions are available before starting refill
    if (!hasStaminaPotions()) {
      clearRefillingFlag();
      return false;
    }
    
    if (!isGameStateAPIAvailable()) {
      clearRefillingFlag();
      return false;
    }
    
    // Refill loop: use lowest tier potions first until target is reached
    let potionCount = 0;
    while (currentStamina < config.minimumStaminaWithoutRefill) {
      potionCount++;
      
      // Refresh inventory from Game State API before each potion check
      const inventory = getPlayerInventory();
      if (!inventory) {
        break;
      }
      
      // Find lowest tier potion available
      const potionTier = findLowestTierPotion(inventory);
      if (!potionTier) {
        break;
      }
      
      const potionKey = `stamina${potionTier}`;
      const potionCountAvailable = inventory[potionKey] || 0;
      
      // Double-check potion is still available before making API call
      if (potionCountAvailable <= 0) {
        removeStaminaPotionFromInventory(potionTier);
        break;
      }
      
      // Wait for rate limit before using potion
      await waitForPotionRateLimit();
      
      // Final inventory check right before API call to prevent unnecessary 404s
      const finalInventory = getPlayerInventory();
      if (finalInventory) {
        const finalPotionKey = `stamina${potionTier}`;
        const finalPotionCount = finalInventory[finalPotionKey] || 0;
        if (finalPotionCount <= 0) {
          removeStaminaPotionFromInventory(potionTier);
          break;
        }
      }
      
      // Make API call with silent error handling for expected 404s
      try {
        const response = await fetch('https://bestiaryarena.com/api/trpc/inventory.staminaPotion?batch=1', {
          method: 'POST',
          headers: {
            'accept': '*/*',
            'content-type': 'application/json',
            'Referer': 'https://bestiaryarena.com/game',
            'X-Game-Version': '1'
          },
          credentials: 'include',
          body: JSON.stringify({
            '0': {
              json: {
                rarity: potionTier,
                amount: 1
              }
            }
          })
        });
        
        if (!response.ok) {
          const status = response.status;
          
          // Handle 400/403/404 errors (no potions or invalid request) - these are expected, handle silently
          if (status === 400 || status === 403 || status === 404) {
            removeStaminaPotionFromInventory(potionTier);
            break;
          }
          
          // For other errors, log and break
          let errorMessage = '';
          try {
            const errorBody = await response.text();
            errorMessage = errorBody ? ` - ${errorBody.substring(0, 200)}` : '';
          } catch (_) {}
          console.log(`[Bestiary Automator] API call failed with status ${status}${errorMessage}`);
          break;
        }
        
        const result = await response.json();
        const data = extractAPIResponseData(result);
        
        if (data) {
          // Update inventory state from API response
          if (data.inventoryDiff) {
            updateInventoryFromDiff(data.inventoryDiff);
          }
          
          // Update staminaWillBeFullAt timestamp
          if (data.nextStaminaWillBeFullAt) {
            updateStaminaWillBeFullAt(data.nextStaminaWillBeFullAt);
          }
          
          const pointsRestored = data.pointsRestored || 0;
          
          // Update tracked stamina from API response
          if (pointsRestored > 0 && trackedStamina !== null) {
            trackedStamina = trackedStamina + pointsRestored;
          }
          
          // Show toast notification
          if (pointsRestored > 0) {
            try {
              showStaminaRestoredToast(pointsRestored);
            } catch (error) {
              console.error('[Bestiary Automator] Error calling showStaminaRestoredToast:', error);
            }
          }
        }
        
        // Wait a bit before checking stamina again
        await sleep(300);
        
        // Re-check current stamina from Game State API (calculated from timestamp)
        const newStamina = getCurrentStaminaFromGameStateAPI();
        if (newStamina !== null) {
          currentStamina = newStamina;
          trackedStamina = newStamina; // Update tracked value with calculated value
        } else if (trackedStamina !== null) {
          // Use tracked value if calculation failed (fallback)
          currentStamina = trackedStamina;
        } else {
          break;
        }
        
      } catch (error) {
        console.error('[Bestiary Automator] Error in API call:', error);
        break;
      }
    }
    
    clearRefillingFlag();
    return true;
    
  } catch (error) {
    console.error('[Bestiary Automator] Error in API-based stamina refill:', error);
    clearRefillingFlag();
    return false;
  }
};

// Refill stamina if needed - chooses method based on config
const refillStaminaIfNeeded = async () => {
  if (!config.autoRefillStamina) {
    return;
  }
  
  // Use API method if enabled, otherwise use DOM method
  if (config.useApiForStaminaRefill) {
    await refillStaminaViaAPI();
    return;
  }
  
  // Existing DOM-based method (unchanged)
  try {
    const elStamina = getStaminaElement();
    if (!elStamina) return;
    
    const staminaElement = getStaminaValueElement();
    if (!staminaElement) return;
    
    const stamina = Number(staminaElement.textContent);
    if (stamina >= config.minimumStaminaWithoutRefill) return;
    
    // Check if any enabled potions are available before attempting refill
    if (!hasStaminaPotions()) {
      return;
    }
    
    setRefillingFlag();
    
    try {
      // Choose method based on tab visibility
      if (document.hidden) {
        await refillStaminaSimple(elStamina);
      } else {
        await refillStaminaWithRetry(elStamina, staminaElement);
      }
    } finally {
      clearRefillingFlag();
    }
    
  } catch (error) {
    console.error('[Bestiary Automator] Error refilling stamina:', error);
    clearRefillingFlag();
  }
};

// Track if we've already collected rewards for this game session
let rewardsCollectedThisSession = false;

// Track if Faster Autoplay has been executed for this game session
let fasterAutoplayExecutedThisSession = false;

// Seashell timer management
let seashellTimer = null;
let lastSeashellReadyAt = null;

// Track if Faster Autoplay is currently running
let fasterAutoplayRunning = false;

// Track current stamina for Game State-based refill (updated from API responses)
let trackedStamina = null;

// Store max stamina (parsed from DOM at init)
let maxStamina = null;


// Check if user has any enabled stamina potions in inventory that meet thresholds
const hasStaminaPotions = () => {
  try {
    if (!globalThis.state || !globalThis.state.player) {
      return false;
    }
    
    const playerContext = globalThis.state.player.getSnapshot().context;
    const inventory = playerContext.inventory || {};
    
    // Check all potion tiers (1-5: Mini, Strong, Great, Ultimate, Supreme)
    for (let tier = 1; tier <= 5; tier++) {
      const potionKey = `stamina${tier}`;
      const potionCount = inventory[potionKey] || 0;
      
      if (potionCount <= 0) {
        continue;
      }
      
      // Get potion name from tier
      const potionName = getPotionNameFromTier(tier);
      if (!potionName) {
        continue;
      }
      
      // Check if this potion type is enabled
      if (!config.potionEnabled || !config.potionEnabled[potionName]) {
        continue;
      }
      
      // Check if quantity meets threshold
      const threshold = config.potionQuantityThresholds && config.potionQuantityThresholds[potionName] !== undefined
        ? config.potionQuantityThresholds[potionName]
        : 0;
      
      if (potionCount > threshold) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('[Bestiary Automator] Error checking stamina potions:', error);
    return false;
  }
};

// Disable autoRefillStamina when user has no potions
const disableAutoRefillDueToNoPotions = () => {
  if (!config.autoRefillStamina) return;
  
  console.log('[Bestiary Automator] Disabling autoRefillStamina - no stamina potions available');
  config.autoRefillStamina = false;
  
  // Save to localStorage
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    const savedConfig = savedData ? JSON.parse(savedData) : {};
    savedConfig.autoRefillStamina = false;
    saveConfigToStorage(savedConfig);
  } catch (error) {
    console.error('[Bestiary Automator] Error saving to localStorage:', error);
  }
  
  // Update button styling
  updateAutomatorButton();
  
  // Update settings modal UI if it's open
  updateSettingsModalUI();
};

// Remove stamina potion from local inventory when 403 error occurs
const removeStaminaPotionFromInventory = (potionTier = 1) => {
  try {
    if (!globalThis.state || !globalThis.state.player) {
      console.log('[Bestiary Automator] Game state not available for inventory update');
      return false;
    }
    
    const player = globalThis.state.player;
    const potionKey = `stamina${potionTier}`;
    
    console.log(`[Bestiary Automator] Removing stamina potion (tier ${potionTier}) from local inventory due to API error`);
    
    player.send({
      type: 'setState',
      fn: (prev) => {
        const newState = { ...prev };
        
        // Ensure nested inventory exists
        newState.inventory = { ...prev.inventory };
        
        // Remove the potion from inventory
        if (newState.inventory[potionKey] && newState.inventory[potionKey] > 0) {
          newState.inventory[potionKey] = Math.max(0, newState.inventory[potionKey] - 1);
          // Mirror on root for compatibility
          newState[potionKey] = newState.inventory[potionKey];
          console.log(`[Bestiary Automator] Removed 1 stamina potion (tier ${potionTier}) from inventory. Remaining: ${newState.inventory[potionKey]}`);
        }
        
        return newState;
      }
    });
    
    return true;
  } catch (error) {
    console.error('[Bestiary Automator] Error removing stamina potion from inventory:', error);
    return false;
  }
};

// Store original fetch function
let originalFetch = null;

// Intercept fetch requests to handle 403 errors from stamina potion API
const setupStaminaPotionErrorHandler = () => {
  try {
    // Store original fetch if not already stored
    if (!originalFetch) {
      originalFetch = window.fetch;
    }
    
    // Hook into fetch to intercept stamina potion API calls
    window.fetch = function(...args) {
      const [url, options] = args;
      
      // Check if this is a stamina potion request
      if (url && url.includes('inventory.staminaPotion') && options && options.method === 'POST') {
        // Try to extract potion tier from request body
        let potionTier = 1;
        try {
          if (options.body) {
            const requestBody = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
            if (requestBody['0'] && requestBody['0'].json) {
              const jsonData = requestBody['0'].json;
              if (jsonData.rarity) {
                potionTier = jsonData.rarity;
              } else if (jsonData.tier) {
                potionTier = jsonData.tier;
              } else if (jsonData.potionTier) {
                potionTier = jsonData.potionTier;
              }
            }
          }
        } catch (_) {
          // Use default tier if parsing fails
        }
        
        // Check inventory before making the call to prevent unnecessary 404s
        const inventory = getPlayerInventory();
        if (inventory) {
          const potionKey = `stamina${potionTier}`;
          const potionCount = inventory[potionKey] || 0;
          if (potionCount <= 0) {
            // Potion not available - remove from inventory and prevent the API call
            // This prevents the browser from logging a 404 error
            removeStaminaPotionFromInventory(potionTier);
            // Return a response that won't trigger browser console errors
            // The calling code checks response.ok and then data, so this is safe
            return Promise.resolve(new Response(JSON.stringify([{
              result: {
                data: {
                  json: null
                }
              }
            }]), {
              status: 200,
              statusText: 'OK',
              headers: { 'Content-Type': 'application/json' }
            }));
          }
        }
        
        return originalFetch.apply(this, args).then(async response => {
          // Check for client/server errors (400, 401, 403, 404) - these are expected when potions aren't available
          if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404) {
            // Remove the potion from local inventory immediately (expected behavior for 404s)
            removeStaminaPotionFromInventory(potionTier);
            // Return a successful mock response to prevent browser console errors
            return new Response(JSON.stringify([{
              result: {
                data: {
                  json: null
                }
              }
            }]), {
              status: 200,
              statusText: 'OK',
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          return response;
        }).catch(error => {
          // Silently handle network errors
          removeStaminaPotionFromInventory(potionTier);
          // Return a successful mock response to prevent browser console errors
          return new Response(JSON.stringify([{
            result: {
              data: {
                json: null
              }
            }
          }]), {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' }
          });
        });
      }
      
      // For non-stamina potion requests, use original fetch
      return originalFetch.apply(this, args);
    };
    
    console.log('[Bestiary Automator] Stamina potion error handler set up successfully');
  } catch (error) {
    console.error('[Bestiary Automator] Error setting up stamina potion error handler:', error);
  }
};

// Take rewards if available - only check at game start
const takeRewardsIfAvailable = async () => {
  if (!config.autoCollectRewards || rewardsCollectedThisSession) {
    return;
  }
  
  try {
    // Check if player has reached the target level for rewards
    const playerContext = globalThis.state.player.getSnapshot().context;
    const currentExp = playerContext.exp;
    
    // Calculate current level from experience
    const currentLevel = globalThis.state.utils.expToCurrentLevel(currentExp);
    
    // Check if there are rewards available by looking for the ping animation
    const available = document.querySelector('button[aria-haspopup="menu"]:has(.animate-ping)');
    
    if (!available) {
      // Check for seashell collection even if no regular rewards (but only if no timer is set)
      if (!seashellTimer) {
        await collectSeashellIfReady();
      }
      return;
    }
    
    // Signal to other mods that we're collecting rewards (for coordination)
    try {
      window.__modCoordination = window.__modCoordination || {};
      window.__modCoordination.automatorCollectingRewards = true;
    } catch (_) {}
    
    // Open rewards menu
    globalThis.state.menu.send({
      type: 'setState',
      fn: (prev) => {
        return {
          ...prev,
          mode: 'playerLevelRewards',
        };
      },
    });
    await sleep(TIMING.REWARDS_COLLECT_DELAY);
    clickButtonWithText('mods.automator.collect');
    await sleep(TIMING.REWARDS_COLLECT_DELAY);
    clickAllCloseButtons();
    await sleep(TIMING.REWARDS_COLLECT_DELAY);
    
    // Check for seashell collection (but only if no timer is set)
    if (!seashellTimer) {
      await collectSeashellIfReady();
    }
    
    // Mark rewards as collected for this session
    rewardsCollectedThisSession = true;
    
    // Check for scroll lock after collecting rewards
    await handleScrollLock();
    
    // Clear the flag after collecting is complete
    try {
      window.__modCoordination.automatorCollectingRewards = false;
    } catch (_) {}
    
  } catch (error) {
    console.error('[Bestiary Automator] Error taking rewards:', error);
    // Always clear the flag even on error
    try {
      window.__modCoordination.automatorCollectingRewards = false;
    } catch (_) {}
  }
};

// Collect seashell if ready
const collectSeashellIfReady = async () => {
  try {
    console.log('[Bestiary Automator] === Starting seashell collection check ===');
    
    // Check if seashell is ready
    const playerContext = globalThis.state.player.getSnapshot().context;
    const seashell = playerContext.questLog?.seashell;
    
    console.log('[Bestiary Automator] Player context questLog:', playerContext.questLog);
    console.log('[Bestiary Automator] Seashell data:', seashell);
    
    if (!seashell) {
      console.log('[Bestiary Automator] No seashell data found in questLog');
      return;
    }
    
    const currentTime = Date.now();
    const isSeashellReady = currentTime >= seashell.readyAt;
    
    console.log(`[Bestiary Automator] Current time: ${currentTime}`);
    console.log(`[Bestiary Automator] Seashell readyAt: ${seashell.readyAt}`);
    console.log(`[Bestiary Automator] Time until ready: ${seashell.readyAt - currentTime}ms`);
    console.log(`[Bestiary Automator] Seashell ready: ${isSeashellReady}, streak: ${seashell.streak}`);
    
    if (!isSeashellReady) {
      // Set up smart timer to check exactly when seashell becomes ready
      setupSeashellTimer(seashell.readyAt);
      return;
    }
    
    console.log('[Bestiary Automator] Seashell is ready, opening quest log...');
    
    // Clear any existing timer since we're collecting now
    clearSeashellTimer();
    
    // Open quest log using the same method as Better Tasker
    const questLogOpened = await openQuestLogForSeashell();
    
    if (questLogOpened) {
      // Look for and click the seashell Open button
      await clickSeashellOpenButton();
      
      // Close quest log
      await closeQuestLog();
    }
    
    console.log('[Bestiary Automator] === Seashell collection check complete ===');
    
  } catch (error) {
    console.error('[Bestiary Automator] Error collecting seashell:', error);
  }
};

// Set up smart timer for seashell collection
const setupSeashellTimer = (readyAt) => {
  // Clear any existing timer
  clearSeashellTimer();
  
  // Don't set up timer if it's the same readyAt time
  if (lastSeashellReadyAt === readyAt) {
    console.log('[Bestiary Automator] Seashell timer already set for this readyAt time');
    return;
  }
  
  const currentTime = Date.now();
  const timeUntilReady = readyAt - currentTime;
  
  const hoursUntilReady = Math.floor(timeUntilReady / (1000 * 60 * 60));
  const minutesUntilReady = Math.floor((timeUntilReady % (1000 * 60 * 60)) / (1000 * 60));
  
  console.log(`[Bestiary Automator] Setting seashell timer for ${hoursUntilReady}h ${minutesUntilReady}m from now`);
  console.log(`[Bestiary Automator] Timer will trigger at: ${new Date(readyAt).toLocaleString()}`);
  
  seashellTimer = setTimeout(async () => {
    console.log('[Bestiary Automator] 🕐 Seashell timer triggered - attempting collection...');
    await collectSeashellIfReady();
  }, timeUntilReady);
  
  lastSeashellReadyAt = readyAt;
};

// Clear seashell timer
const clearSeashellTimer = () => {
  if (seashellTimer) {
    console.log('[Bestiary Automator] Clearing seashell timer');
    clearTimeout(seashellTimer);
    seashellTimer = null;
    lastSeashellReadyAt = null;
  }
};

// Open quest log for seashell collection (based on Better Tasker implementation)
const openQuestLogForSeashell = async () => {
  try {
    console.log('[Bestiary Automator] Opening quest log for seashell collection...');
    
    // First check if quest log is already open by looking for the seashell section
    const existingSeashellSection = document.querySelector('.frame-1.surface-regular:has(.sprite.item.id-197)');
    if (existingSeashellSection) {
      console.log('[Bestiary Automator] Quest log already open with seashell section visible');
      return true;
    }
    
    // Check if quest log container is already open
    const questLogContainer = document.querySelector('.widget-bottom .grid.h-\\[260px\\].items-start.gap-1');
    if (questLogContainer) {
      console.log('[Bestiary Automator] Quest log container already open');
      return true;
    }
    
    // Try to find quest log button or icon
    const questSelectors = [
      'button[aria-label*="quest"]',
      'button[title*="quest"]',
      '.quest-icon',
      'img[src*="quest.png"]',
      'button:has(svg[data-lucide="book"])',
      'button:has(svg[data-lucide="scroll"])',
      'img[src*="quest-blip.png"]', // Try quest blip as fallback
      '#header-slot img[src*="quest"]' // Try header slot
    ];
    
    let questButton = null;
    for (const selector of questSelectors) {
      questButton = document.querySelector(selector);
      if (questButton) {
        console.log(`[Bestiary Automator] Found quest button with selector: ${selector}`);
        break;
      }
    }
    
    if (questButton) {
      questButton.click();
      await sleep(TIMING.MODAL_CLOSE_DELAY); // Wait for quest log to open
      
      // Verify quest log opened by looking for the container or seashell section
      const questLogContainer = document.querySelector('.widget-bottom .grid.h-\\[260px\\].items-start.gap-1');
      const seashellSection = document.querySelector('.frame-1.surface-regular:has(.sprite.item.id-197)');
      
      if (questLogContainer || seashellSection) {
        console.log('[Bestiary Automator] Quest log opened successfully');
        return true;
      }
    }
    
    console.log('[Bestiary Automator] Failed to open quest log - no quest button found');
    return false;
    
  } catch (error) {
    console.error('[Bestiary Automator] Error opening quest log:', error);
    return false;
  }
};

// Click the seashell Open button
const clickSeashellOpenButton = async () => {
  try {
    console.log('[Bestiary Automator] === Starting seashell Open button search ===');
    
    // Look for the seashell section with the Open button
    console.log('[Bestiary Automator] Searching for seashell section with selector: .frame-1.surface-regular:has(.sprite.item.id-197)');
    const seashellSection = document.querySelector('.frame-1.surface-regular:has(.sprite.item.id-197)');
    
    if (seashellSection) {
      console.log('[Bestiary Automator] ✅ Found seashell section!');
      console.log('[Bestiary Automator] Seashell section HTML:', seashellSection.outerHTML.substring(0, 500) + '...');
      
      // Log all buttons in the seashell section first
      const allButtons = seashellSection.querySelectorAll('button');
      console.log(`[Bestiary Automator] Found ${allButtons.length} buttons in seashell section:`);
      allButtons.forEach((button, index) => {
        console.log(`[Bestiary Automator] Button ${index + 1}:`, {
          textContent: button.textContent.trim(),
          className: button.className,
          innerHTML: button.innerHTML.substring(0, 200) + '...'
        });
      });
      
      // Try multiple selectors for the Open button
      const buttonSelectors = [
        'button:has(img[src*="redeem.png"])',
        'button:has(img[alt="redeem"])',
        'button.frame-1-green:has(img[src*="redeem"])',
        'button.surface-green:has(img[src*="redeem"])',
        'button:contains("Open")',
        'button[class*="green"]'
      ];
      
      console.log('[Bestiary Automator] Trying button selectors...');
      let openButton = null;
      for (let i = 0; i < buttonSelectors.length; i++) {
        const selector = buttonSelectors[i];
        console.log(`[Bestiary Automator] Trying selector ${i + 1}/${buttonSelectors.length}: ${selector}`);
        try {
          openButton = seashellSection.querySelector(selector);
          if (openButton) {
            console.log(`[Bestiary Automator] ✅ Found seashell Open button with selector: ${selector}`);
            console.log('[Bestiary Automator] Open button details:', {
              textContent: openButton.textContent.trim(),
              className: openButton.className,
              innerHTML: openButton.innerHTML.substring(0, 200) + '...'
            });
            break;
          } else {
            console.log(`[Bestiary Automator] ❌ No button found with selector: ${selector}`);
          }
        } catch (e) {
          console.log(`[Bestiary Automator] ❌ Selector error for ${selector}:`, e.message);
          // Some selectors might not be supported, continue to next
          continue;
        }
      }
      
      // Fallback: look for any button in the seashell section that contains "Open" text
      if (!openButton) {
        console.log('[Bestiary Automator] No button found with selectors, trying text content fallback...');
        for (let i = 0; i < allButtons.length; i++) {
          const button = allButtons[i];
          console.log(`[Bestiary Automator] Checking button ${i + 1} text content: "${button.textContent.trim()}"`);
          if (button.textContent.includes('Open')) {
            openButton = button;
            console.log('[Bestiary Automator] ✅ Found seashell Open button by text content!');
            console.log('[Bestiary Automator] Open button details:', {
              textContent: openButton.textContent.trim(),
              className: openButton.className,
              innerHTML: openButton.innerHTML.substring(0, 200) + '...'
            });
            break;
          }
        }
      }
      
      if (openButton) {
        console.log('[Bestiary Automator] 🎯 About to click seashell Open button...');
        console.log('[Bestiary Automator] Button element:', openButton);
        console.log('[Bestiary Automator] Button is visible:', openButton.offsetParent !== null);
        console.log('[Bestiary Automator] Button is enabled:', !openButton.disabled);
        
        openButton.click();
        console.log('[Bestiary Automator] ✅ Seashell Open button clicked!');
        await sleep(TIMING.MODAL_CLOSE_DELAY);
        console.log('[Bestiary Automator] ✅ Seashell Open button click completed');
        return true;
      } else {
        console.log('[Bestiary Automator] ❌ Seashell Open button not found in section');
        console.log('[Bestiary Automator] Available buttons in seashell section:', seashellSection.querySelectorAll('button'));
        
        // Additional debugging - look for any elements with "Open" text
        const allElements = seashellSection.querySelectorAll('*');
        console.log('[Bestiary Automator] Searching all elements for "Open" text...');
        for (const element of allElements) {
          if (element.textContent && element.textContent.includes('Open')) {
            console.log('[Bestiary Automator] Found element with "Open" text:', {
              tagName: element.tagName,
              textContent: element.textContent.trim(),
              className: element.className,
              innerHTML: element.innerHTML.substring(0, 200) + '...'
            });
          }
        }
      }
    } else {
      console.log('[Bestiary Automator] ❌ Seashell section not found');
      console.log('[Bestiary Automator] Searching for any elements with item ID 197...');
      const item197Elements = document.querySelectorAll('.sprite.item.id-197');
      console.log(`[Bestiary Automator] Found ${item197Elements.length} elements with item ID 197`);
      item197Elements.forEach((element, index) => {
        console.log(`[Bestiary Automator] Item 197 element ${index + 1}:`, element);
      });
    }
    
    console.log('[Bestiary Automator] === Seashell Open button search complete ===');
    return false;
    
  } catch (error) {
    console.error('[Bestiary Automator] ❌ Error clicking seashell Open button:', error);
    return false;
  }
};

// Close quest log
const closeQuestLog = async () => {
  try {
    console.log('[Bestiary Automator] Closing quest log...');
    
    // Press ESC key to close quest log
    for (let i = 0; i < TIMING.QUEST_LOG_CLOSE_ATTEMPTS; i++) {
      simulateEscKey();
      await sleep(TIMING.QUEST_LOG_CLOSE_DELAY);
    }
    
    console.log('[Bestiary Automator] Quest log closed');
    
  } catch (error) {
    console.error('[Bestiary Automator] Error closing quest log:', error);
  }
};

// Handle day care
const handleDayCare = async () => {
  if (!config.autoDayCare) return;
  
  // Check if Board Analyzer is running - if so, skip daycare detection
  if (isBoardAnalyzerRunning()) return;
  
  try {
    // Signal to other mods that we're handling daycare (for coordination)
    try {
      window.__modCoordination = window.__modCoordination || {};
      window.__modCoordination.automatorHandlingDaycare = true;
    } catch (_) {}
    
    // Single query with early exit - if no blip elements, skip processing
    const blipElements = document.querySelectorAll('[data-blip="true"]');
    if (blipElements.length === 0) {
      // Clear the flag if no daycare to handle
      try {
        window.__modCoordination.automatorHandlingDaycare = false;
      } catch (_) {}
      return;
    }
    
    // Check for daycare button with visual indicator
    const dayCareButton = document.querySelector('button:has(img[alt="daycare"]), button:has(img[alt="Daycare"])');
    let hasDayCareButtonIndicator = false;
    
    if (dayCareButton) {
      if (dayCareButton.classList.contains('focus-style-visible') && dayCareButton.classList.contains('active:opacity-70')) {
        hasDayCareButtonIndicator = true;
      }
    }
    
    // Look for creatures that are actually in daycare slots (have both creature and daycare images)
    const creatureAtDaycare = document.querySelector('div[data-blip="true"]:has(img[alt="creature"]):has(img[alt="daycare"]), div[data-blip="true"]:has(img[alt="creature"]):has(img[alt="Daycare"])');
    
    // Check if there are any elements that contain both a blip AND a daycare image
    let foundBlipWithDaycare = false;
    let foundReadyCreature = false;
    let foundMaxedCreature = false;
    
    // Analyze blip elements for daycare creatures
    for (let i = 0; i < blipElements.length; i++) {
      const blipElement = blipElements[i];
      
      // Only check blip elements that have both creature and daycare images (actual daycare creatures)
      const daycareImg = blipElement.querySelector('img[alt="daycare"], img[alt="Daycare"]');
      const creatureImg = blipElement.querySelector('img[alt="creature"]');
      
      if (daycareImg && creatureImg) {
        foundBlipWithDaycare = true;
        
        // Check if this creature is at max level (red blip = max level)
        const isRedBlip = blipElement.querySelector('.text-invalid');
        const isGreenBlip = blipElement.querySelector('.text-expBar');
        const maxLevelText = blipElement.querySelector('span[data-state="closed"]');
        
        // Only consider it ready if it has a green blip (not red) and no "Max" text
        if (isGreenBlip && !isRedBlip && !maxLevelText?.textContent?.includes('Max')) {
          foundReadyCreature = true;
        } else if (isRedBlip || maxLevelText?.textContent?.includes('Max')) {
          foundMaxedCreature = true;
        }
      }
    }
    
    // Check if there are any daycare images without blips that might be ready
    const allDaycareImages = document.querySelectorAll('img[alt="daycare"], img[alt="Daycare"]');
    for (let i = 0; i < allDaycareImages.length; i++) {
      const daycareImg = allDaycareImages[i];
      const parentElement = daycareImg.closest('[data-blip="true"]');
      
      if (!parentElement) {
        // Check the parent container for level info
        const container = daycareImg.closest('.container-slot');
        if (container) {
          // Only process if this is actually a creature, not a Dragon Plant or other item
          const creatureImg = container.querySelector('img[alt="creature"]');
          if (!creatureImg) continue;
          
          const maxLevelText = container.querySelector('span[data-state="closed"]');
          
          // For creatures without blips, check if they're not at max level
          if (!maxLevelText?.textContent?.includes('Max')) {
            foundReadyCreature = true;
          } else {
            foundMaxedCreature = true;
          }
        }
      }
    }
    
    // Check if any creatures need daycare attention (ready for level up OR maxed and need ejection)
    
    if (foundBlipWithDaycare && !foundReadyCreature && !foundMaxedCreature) {
      console.log('[Bestiary Automator] Found daycare creatures but none ready for level up or maxed');
    }
    
    // Only proceed if there are creatures that need daycare attention
    if (!foundReadyCreature && !foundMaxedCreature) {
      console.log('[Bestiary Automator] No creatures need daycare attention, skipping');
      return;
    }
    
    if (foundMaxedCreature) {
      console.log('[Bestiary Automator] Found maxed creatures that need ejection from daycare');
    }
    
    console.log('[Bestiary Automator] Handling day care');
    
    clickButtonWithText('mods.automator.inventory');
    await sleep(TIMING.MODAL_CLOSE_DELAY);
    
    // Double-check after opening inventory
    const dayCareButtonAfter = document.querySelector('button:has(img[alt="daycare"]), button:has(img[alt="Daycare"])');
    if (!dayCareButtonAfter) return;
    
    dayCareButtonAfter.click();
    await sleep(TIMING.MODAL_CLOSE_DELAY);
    
    // Handle all creatures that can level up in one session
    let levelUpCount = 0;
    const maxLevelUps = 4; // Maximum 4 creatures can be in daycare
    
    while (levelUpCount < maxLevelUps) {
      // Check if there are any creatures ready to level up
      const readyCreatures = document.querySelectorAll('[data-blip="true"]');
      let foundReadyCreature = false;
      let readyCreatureCount = 0;
      
      for (let i = 0; i < readyCreatures.length; i++) {
        const creature = readyCreatures[i];
        const daycareImg = creature.querySelector('img[alt="daycare"], img[alt="Daycare"]');
        
        if (daycareImg) {
          const isRedBlip = creature.querySelector('.text-invalid');
          const isGreenBlip = creature.querySelector('.text-expBar');
          const maxLevelText = creature.querySelector('span[data-state="closed"]');
          
          if (isGreenBlip && !isRedBlip && !maxLevelText?.textContent?.includes('Max')) {
            foundReadyCreature = true;
            readyCreatureCount++;
          }
        }
      }
      
      if (!foundReadyCreature) {
        break;
      }
      
      // Click level up
      const levelUpClicked = clickButtonWithText('mods.automator.levelUp');
      
      if (!levelUpClicked) {
        break;
      }
      
      levelUpCount++;
      
      // Wait for the level up to process
      await sleep(TIMING.DAYCARE_LEVELUP_DELAY);
    }
    
    // Handle ejection of maxed creatures
    if (foundMaxedCreature) {
      let ejectionCount = 0;
      const maxEjections = 4; // Maximum 4 creatures can be in daycare
      
      while (ejectionCount < maxEjections) {
        // Check if there are any maxed creatures that need ejection
        // Look for daycare slot containers that contain maxed creatures
        const daycareSlots = document.querySelectorAll('div.relative.flex.items-center.gap-2');
        let foundMaxedCreatureInModal = false;
        let maxedCreatureWithdrawButton = null;
        
        for (let i = 0; i < daycareSlots.length; i++) {
          const slot = daycareSlots[i];
          // Check if this slot has a maxed creature (has "Max" text)
          const maxLevelText = slot.querySelector('span[data-state="closed"]');
          const withdrawButton = slot.querySelector('button[title="Withdraw"]');
          
          if (maxLevelText?.textContent?.includes('Max') && withdrawButton) {
            foundMaxedCreatureInModal = true;
            maxedCreatureWithdrawButton = withdrawButton;
            break; // Found one to eject, break and process it
          }
        }
        
        if (!foundMaxedCreatureInModal || !maxedCreatureWithdrawButton) {
          break;
        }
        
        // Click the withdraw button for the specific maxed creature
        maxedCreatureWithdrawButton.click();
        
        ejectionCount++;
        
        // Wait for the ejection to process
        await sleep(TIMING.DAYCARE_EJECTION_DELAY);
      }
    }
    
    // Close the modal after handling all creatures
    clickAllCloseButtons();
    await sleep(TIMING.MODAL_CLOSE_DELAY);
    
    // Check for scroll lock after daycare operations
    await handleScrollLock();
    
    // Clear the flag after daycare is complete
    try {
      window.__modCoordination.automatorHandlingDaycare = false;
    } catch (_) {}
    
  } catch (error) {
    console.error('[Bestiary Automator] Error handling day care:', error);
    // Always clear the flag even on error
    try {
      window.__modCoordination.automatorHandlingDaycare = false;
    } catch (_) {}
  }
};


// Update minimum stamina if game shows a stamina requirement
// Only auto-update if user hasn't manually set a custom value
const updateRequiredStamina = () => {
  try {
    // Check if user has manually set a custom value (different from default)
    const hasCustomValue = config.minimumStaminaWithoutRefill !== defaultConfig.minimumStaminaWithoutRefill;
    if (hasCustomValue) {
      return; // Silent return when user has custom value
    }
    
    const elements = document.querySelectorAll('.action-link');
    for (const element of elements) {
      if (element.textContent !== 'stamina') continue;
      
      const text = element.parentElement.textContent; // 'Not enough stamina (15)'
      const match = text.match(/\((\d+)\)/);
      if (!match) continue;
      
      const staminaRequired = Number(match[1]);
      if (
        (config.minimumStaminaWithoutRefill !== staminaRequired) &&
        (1 <= staminaRequired && staminaRequired <= 360)
      ) {
        config.minimumStaminaWithoutRefill = staminaRequired;
        console.log(`[Bestiary Automator] Auto-setting minimum stamina without refill to ${staminaRequired}`);
        
        // Save the new value to both localStorage and API
        const configToSave = {
          minimumStaminaWithoutRefill: config.minimumStaminaWithoutRefill
        };
        
        try {
          const existingConfig = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
          saveConfigToStorage({ ...existingConfig, ...configToSave });
        } catch (error) {
          console.error('[Bestiary Automator] Error saving to localStorage:', error);
        }
        
        try {
          api.service.updateScriptConfig(context.hash, configToSave);
        } catch (error) {
          console.error('[Bestiary Automator] Error saving via API:', error);
        }
        
        return;
      }
    }
  } catch (error) {
    console.error('[Bestiary Automator] Error updating required stamina:', error);
  }
};

// Main automation loop
let automationInterval = null;

let gameStateObserver = null;
let focusEventListeners = null;
let currentCountdownTask = null;
let gameStateUnsubscribers = [];

// Add debouncing for game state events
let lastGameStateChange = 0;
const GAME_STATE_DEBOUNCE_MS = 1000; // 1 second debounce

// Subscribe to board game state changes
const subscribeToGameState = () => {
  try {
    // Subscribe to board state changes for new game detection
    if (globalThis.state && globalThis.state.board) {
      // Consolidated new game handler with debouncing
      const handleNewGame = (event) => {
        const now = Date.now();
        if (now - lastGameStateChange < GAME_STATE_DEBOUNCE_MS) {
          return;
        }
        lastGameStateChange = now;
        
        console.log('[Bestiary Automator] New game detected, resetting session flags');
        rewardsCollectedThisSession = false;
        fasterAutoplayExecutedThisSession = false;
        fasterAutoplayRunning = false;
        
        // Cancel any ongoing countdown when new game starts
        if (currentCountdownTask) {
          cancelCurrentCountdown();
        }
      };
      
      // Subscribe to newGame event (primary handler)
      gameStateUnsubscribers.push(globalThis.state.board.on('newGame', handleNewGame));
      
      // Subscribe to emitNewGame event (secondary handler for countdown cancellation only)
      gameStateUnsubscribers.push(globalThis.state.board.on('emitNewGame', (event) => {
        if (currentCountdownTask) {
          console.log('[Bestiary Automator] Game started during countdown, cancelling...');
          cancelCurrentCountdown();
        }
      }));
      
      // Monitor for other board state changes that should cancel countdowns
      gameStateUnsubscribers.push(globalThis.state.board.on('stateChange', (event) => {
        const boardContext = event.context;
        
        // Cancel countdown if map picker opens (user changing maps)
        if (boardContext.openMapPicker) {
          cancelCurrentCountdown();
        }
        
        // Cancel countdown if game state changes significantly
        if (boardContext.gameStarted !== boardContext.gameStarted) {
          cancelCurrentCountdown();
        }
      }));
      
      // Consolidated end game handler with debouncing
      const handleEndGame = (event) => {
        const now = Date.now();
        if (now - lastGameStateChange < GAME_STATE_DEBOUNCE_MS) {
          console.log('[Bestiary Automator] Ignoring rapid end game event (debounced)');
          return;
        }
        lastGameStateChange = now;
        
        if (currentCountdownTask) {
          console.log('[Bestiary Automator] Game ended during countdown, cancelling...');
          cancelCurrentCountdown();
        }
        
        
        
        // Defeat toasts are now detected automatically via MutationObserver - no need for manual checking
      };
      
      // Subscribe to emitEndGame event
      gameStateUnsubscribers.push(globalThis.state.board.on('emitEndGame', handleEndGame));
    }
    
    // Set up MutationObserver for real-time toast detection
    if (!config.autoPlayAfterDefeat) return;
    
    // Use MutationObserver to watch for new toast elements in real-time
    gameStateObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Check each added node for toasts
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the added element is a defeat toast
              if (isDefeatToast(node)) {
                // Process immediately without debouncing
                processDefeatToast();
                return; // Exit early since we found a defeat toast
              }
              
              // Check for battle ongoing toasts (network issues)
              if (isBattleOngoingToast(node)) {
                // Process immediately without debouncing
                const toastText = getToastText(node);
                processBattleOngoingToast(toastText);
                return; // Exit early since we found a battle ongoing toast
              }
              
              // Check for "Something went wrong" toasts
              if (isSomethingWrongToast(node)) {
                // Process immediately without debouncing
                processSomethingWrongToast();
                return; // Exit early since we found a something wrong toast
              }
              
              // Also check child elements for toasts
              const defeatToast = node.querySelector && node.querySelector('div.widget-bottom.pixel-font-16.flex.items-center.gap-2.px-2.py-1.text-whiteHighlight:has(img[alt="no"])');
              if (defeatToast) {
                const toastText = defeatToast.textContent;
                const englishDefeat = toastText.includes('Autoplay stopped because your creatures were defeated');
                const portugueseDefeat = toastText.includes('Autoplay parou porque suas criaturas foram derrotadas');
                
                if (englishDefeat || portugueseDefeat) {
                  processDefeatToast();
                  return;
                }
              }
              
              // Check child elements for battle ongoing toasts
              const battleToast = node.querySelector && node.querySelector('div.widget-bottom.pixel-font-16.flex.items-center.gap-2.px-2.py-1.text-whiteHighlight');
              if (battleToast && battleToast.textContent.includes('Battle still ongoing') && battleToast.textContent.includes('ms diff')) {
                const toastText = getToastText(battleToast);
                processBattleOngoingToast(toastText);
                return;
              }
              
              // Check child elements for "Something went wrong" toasts
              const somethingWrongToast = node.querySelector && node.querySelector('div.widget-bottom.pixel-font-16.flex.items-center.gap-2.px-2.py-1.text-whiteHighlight');
              if (somethingWrongToast && somethingWrongToast.textContent.includes('Something went wrong')) {
                processSomethingWrongToast();
                return;
              }
            }
          }
        }
      }
    });
    
    // Start observing the document body for added nodes
    gameStateObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('[Bestiary Automator] MutationObserver set up for real-time defeat toast detection');
  } catch (error) {
    console.error('[Bestiary Automator] Error subscribing to game state:', error);
  }
};

// Unsubscribe from game state changes
const unsubscribeFromGameState = () => {
  if (gameStateObserver) {
    gameStateObserver.disconnect();
    gameStateObserver = null;
    
    console.log('[Bestiary Automator] MutationObserver disconnected');
  }
};

// Simplified defeat toast processor - no cooldown, process each immediately
const processDefeatToast = async () => {
  if (!canTransitionTo(AUTOMATION_STATES.PROCESSING_DEFEAT)) {
    console.log('[Bestiary Automator] Cannot process defeat toast, system is busy');
    return false;
  }
  
  setState(AUTOMATION_STATES.PROCESSING_DEFEAT);
  console.log('[Bestiary Automator] Defeat toast detected!');
  
  
  // Check if Faster Autoplay is enabled and not already executed this session
  if (config.fasterAutoplay && !fasterAutoplayExecutedThisSession) {
    console.log('[Bestiary Automator] Defeat detected - triggering Faster Autoplay...');
    await sleep(SUPER_AUTOPLAY_TIMING.DEFEAT_PROCESSING_DELAY);
    
    // Click the defeat toast to dismiss it naturally
    dismissDefeatToast();
    
    // Trigger Faster Autoplay
    await handleFasterAutoplay();
    
    // Reset state after delay
    setTimeout(() => {
      setState(null);
      console.log('[Bestiary Automator] Defeat processing complete');
    }, SUPER_AUTOPLAY_TIMING.STATE_RESET_DELAY);
    
    return true;
  }
  
  console.log('[Bestiary Automator] Defeat toast detected, waiting 1s then restarting...');
  await sleep(1000);
  
  // Click start button
  const startButton = findStartButton();
  if (startButton) {
    startButton.click();
    console.log('[Bestiary Automator] Start button clicked after defeat');
    
    // Click the defeat toast to dismiss it naturally
    dismissDefeatToast();
    
  } else {
    console.log('[Bestiary Automator] Start button not found after defeat');
  }
  
  // Reset state after 3 seconds
  setTimeout(() => {
    setState(null);
    console.log('[Bestiary Automator] Defeat processing complete');
  }, 3000);
  
  return true;
};

// Optimized battle ongoing toast processor using Game State API
const processBattleOngoingToast = async (toastText) => {
  if (!canTransitionTo(AUTOMATION_STATES.PROCESSING_BATTLE)) {
    return false;
  }
  
  setState(AUTOMATION_STATES.PROCESSING_BATTLE);
  console.log('[Bestiary Automator] Battle ongoing toast detected!');
  
  // Try to get battle ready time from Game State API first (more reliable)
  let waitTime = null;
  
  try {
    if (globalThis.state && globalThis.state.board) {
      const boardContext = globalThis.state.board.getSnapshot().context;
      if (boardContext && boardContext.battleWillBeReadyAt) {
        const currentTime = Date.now();
        const battleReadyTime = boardContext.battleWillBeReadyAt;
        waitTime = Math.max(0, battleReadyTime - currentTime);
        console.log(`[Bestiary Automator] Using Game State API - battle ready in ${waitTime}ms`);
      }
    }
  } catch (error) {
    console.warn('[Bestiary Automator] Could not access battleWillBeReadyAt from Game State API:', error);
  }
  
  // Fallback to parsing toast message if Game State API is not available
  if (waitTime === null) {
    if (!toastText || typeof toastText !== 'string') {
      console.log('[Bestiary Automator] Invalid toastText parameter:', toastText);
      setState(null);
      return false;
    }
    
    // Extract time difference from toast message
    const timeMatch = toastText.match(/\((\d+)ms diff\)/);
    if (!timeMatch) {
      console.log('[Bestiary Automator] Could not extract time from battle ongoing toast:', toastText);
      setState(null);
      return false;
    }
    
    const timeDiff = parseInt(timeMatch[1], 10);
    waitTime = Math.floor(timeDiff / 1000) * 1000; // Round down to nearest second
    console.log(`[Bestiary Automator] Using toast parsing - battle ready in ${waitTime}ms (original: ${timeDiff}ms)`);
  }
  
  console.log(`[Bestiary Automator] Battle ongoing detected, waiting ${waitTime}ms then clicking autoplay...`);
  
  // Start countdown
  if (await startCountdown(waitTime)) {
    // Click start button
    const startButton = findStartButton();
    if (startButton) {
      startButton.click();
      console.log('[Bestiary Automator] Start button clicked after battle ongoing toast');
    } else {
      console.log('[Bestiary Automator] Start button not found after battle ongoing toast');
    }
    
    // Reset state after 3 seconds
    setTimeout(() => {
      setState(null);
      console.log('[Bestiary Automator] Battle processing complete');
    }, 3000);
  }
  
  return true;
};

// Simplified something wrong toast processor
const processSomethingWrongToast = async () => {
  if (!canTransitionTo(AUTOMATION_STATES.PROCESSING_SOMETHING_WRONG)) {
    console.log('[Bestiary Automator] Cannot process something wrong toast, system is busy');
    return false;
  }
  
  setState(AUTOMATION_STATES.PROCESSING_SOMETHING_WRONG);
  console.log('[Bestiary Automator] Something went wrong toast detected!');
  
  console.log('[Bestiary Automator] Something went wrong toast detected, waiting 1s then restarting...');
  await sleep(1000);
  
  // Click start button
  const startButton = findStartButton();
  if (startButton) {
    startButton.click();
    console.log('[Bestiary Automator] Start button clicked after something went wrong');
  } else {
    console.log('[Bestiary Automator] Start button not found after something went wrong');
  }
  
  // Reset state after 3 seconds
  setTimeout(() => {
    setState(null);
    console.log('[Bestiary Automator] Something wrong processing complete');
  }, 3000);
  
  return true;
};

// Helper function to dismiss defeat toast after successful game start
const dismissDefeatToast = () => {
  try {
    // Look for the defeat toast and click it to dismiss naturally
    const defeatToast = document.querySelector('div.widget-bottom.pixel-font-16.flex.items-center.gap-2.px-2.py-1.text-whiteHighlight:has(img[alt="no"])');
    if (defeatToast) {
      const toastText = defeatToast.textContent || defeatToast.innerText;
      
      // Check for English or Portuguese defeat text
      const isEnglishDefeat = toastText.includes('Autoplay stopped because your creatures were defeated');
      const isPortugueseDefeat = toastText.includes('Autoplay parou porque suas criaturas foram derrotadas');
      
      if (isEnglishDefeat || isPortugueseDefeat) {
        defeatToast.click();
        console.log('[Bestiary Automator] Defeat toast clicked to dismiss');
      }
    }
  } catch (error) {
    console.error('[Bestiary Automator] Error dismissing defeat toast:', error);
  }
};

// Helper function to find start button
const findStartButton = () => {
  const startButtons = document.querySelectorAll('button[data-full="false"][data-state="closed"]');
  for (const button of startButtons) {
    const buttonText = button.textContent.trim();
    if (buttonText === 'Start' || buttonText === 'Iniciar') {
      return button;
    }
  }
  return null;
};

// Helper function to check if an element is a defeat toast
const isDefeatToast = (element) => {
  try {
    // Check if the element is a toast (either root toast element or child widget-bottom)
    const isToastElement = element.classList && (
      element.classList.contains('non-dismissable-dialogs') || 
      element.classList.contains('widget-bottom')
    );
    
    if (!isToastElement) {
      return false;
    }
    
    // Find the widget-bottom element (either the element itself or a child)
    const widgetBottom = element.classList.contains('widget-bottom') 
      ? element 
      : element.querySelector('.widget-bottom');
    
    if (!widgetBottom) {
      return false;
    }
    
    // Check for the "no" icon
    const noIcon = widgetBottom.querySelector('img[alt="no"]');
    if (!noIcon) {
      return false;
    }
    
    // Check for the text content indicating defeat
    const textElement = widgetBottom.querySelector('.text-left');
    if (!textElement) {
      return false;
    }
    
    // Get the full text content including nested spans
    const toastText = textElement.textContent || textElement.innerText;
    
    // Debug logging
    console.log('[Bestiary Automator] Checking defeat toast text:', toastText);
    
    // Check for English defeat text
    const englishDefeat = toastText.includes('Autoplay stopped because your creatures were defeated') ||
                         (toastText.includes('Autoplay stopped') && toastText.includes('defeated')) ||
                         toastText.includes('creatures were defeated');
    
    // Check for Portuguese defeat text
    const portugueseDefeat = toastText.includes('Autoplay parou porque suas criaturas foram derrotadas') ||
                            (toastText.includes('Autoplay parou') && toastText.includes('derrotadas')) ||
                            toastText.includes('criaturas foram derrotadas');
    
    console.log('[Bestiary Automator] Defeat detection - English:', englishDefeat, 'Portuguese:', portugueseDefeat);
    
    return englishDefeat || portugueseDefeat;
  } catch (error) {
    console.error('[Bestiary Automator] Error checking if element is defeat toast:', error);
    return false;
  }
};

// Helper function to check if an element is a battle ongoing toast (network issues)
const isBattleOngoingToast = (element) => {
  try {
    // Check if the element has the toast structure
    if (!element.classList || !element.classList.contains('widget-bottom')) {
      return false;
    }
    
    // Check for the text content indicating battle ongoing
    const textElement = element.querySelector('.text-left');
    if (!textElement) {
      return false;
    }
    
    const toastText = textElement.textContent;
    return toastText.includes('Battle still ongoing') && toastText.includes('ms diff');
  } catch (error) {
    console.error('[Bestiary Automator] Error checking if element is battle ongoing toast:', error);
    return false;
  }
};

// Helper function to check if an element is a "Something went wrong" toast
const isSomethingWrongToast = (element) => {
  try {
    // Check if the element has the toast structure
    if (!element.classList || !element.classList.contains('widget-bottom')) {
      return false;
    }
    
    // Check for the text content indicating something went wrong
    const textElement = element.querySelector('.text-left');
    if (!textElement) {
      return false;
    }
    
    const toastText = textElement.textContent;
    return toastText.includes('Something went wrong');
  } catch (error) {
    console.error('[Bestiary Automator] Error checking if element is something wrong toast:', error);
    return false;
  }
};

// Helper function to extract toast text from an element
const getToastText = (element) => {
  try {
    const textElement = element.querySelector('.text-left');
    return textElement ? textElement.textContent : '';
  } catch (error) {
    console.error('[Bestiary Automator] Error extracting toast text:', error);
    return '';
  }
};

// Faster Autoplay Functions

// Wait for server results to be available with retry logic
const waitForServerResults = async () => {
  for (let attempt = 1; attempt <= SUPER_AUTOPLAY_TIMING.MAX_SERVER_RESULTS_RETRIES; attempt++) {
    try {
      // Check if Game State API is available
      if (!globalThis.state || !globalThis.state.board) {
        console.log(`[Bestiary Automator] Game State API not available (attempt ${attempt})`);
        await sleep(SUPER_AUTOPLAY_TIMING.SERVER_RESULTS_RETRY_DELAY);
        continue;
      }
      
      const boardContext = globalThis.state.board.getSnapshot().context;
      const serverResults = boardContext.serverResults;
      
      if (serverResults && serverResults.rewardScreen) {
        console.log(`[Bestiary Automator] Server results available after ${attempt} attempt(s)`);
        return true;
      }
      
      console.log(`[Bestiary Automator] Server results not ready yet (attempt ${attempt}/${SUPER_AUTOPLAY_TIMING.MAX_SERVER_RESULTS_RETRIES})`);
      await sleep(SUPER_AUTOPLAY_TIMING.SERVER_RESULTS_RETRY_DELAY);
    } catch (error) {
      console.error(`[Bestiary Automator] Error checking server results (attempt ${attempt}):`, error);
      await sleep(SUPER_AUTOPLAY_TIMING.SERVER_RESULTS_RETRY_DELAY);
    }
  }
  
  console.log('[Bestiary Automator] Server results never became available after all retries');
  return false;
};

// Extract game time in ticks from server results (like RunTracker)
const extractGameTimeFromServerResults = () => {
  try {
    // Check if Game State API is available
    if (!globalThis.state || !globalThis.state.board) {
      console.log('[Bestiary Automator] Game State API not available for game time extraction');
      return null;
    }
    
    const boardContext = globalThis.state.board.getSnapshot().context;
    const serverResults = boardContext.serverResults;
    
    if (!serverResults || !serverResults.rewardScreen) {
      console.log('[Bestiary Automator] No server results available yet');
      return null;
    }
    
    // Extract game time from server results (like RunTracker)
    const gameTime = serverResults.rewardScreen.gameTicks;
    
    console.log(`[Bestiary Automator] Extracted game time: ${gameTime} ticks`);
    return gameTime;
  } catch (error) {
    console.error('[Bestiary Automator] Error extracting game time:', error);
    return null;
  }
};

// Extract map information from server results (like RunTracker)
const extractMapFromServerResults = () => {
  try {
    // Check if Game State API is available
    if (!globalThis.state || !globalThis.state.board) {
      console.log('[Bestiary Automator] Game State API not available for map extraction');
      return null;
    }
    
    const boardContext = globalThis.state.board.getSnapshot().context;
    const serverResults = boardContext.serverResults;
    
    if (!serverResults || !serverResults.rewardScreen) {
      console.log('[Bestiary Automator] No server results available yet');
      return null;
    }
    
    // Extract map from server results (like RunTracker)
    const mapId = serverResults.rewardScreen.roomId;
    
    if (!mapId) {
      console.log('[Bestiary Automator] No map ID in server results');
      return null;
    }
    
    console.log(`[Bestiary Automator] Extracted map: ${mapId}`);
    return mapId;
  } catch (error) {
    console.error('[Bestiary Automator] Error extracting map:', error);
    return null;
  }
};

// Navigate to a specific map using Game State API (like Raid Hunter)
const navigateToMap = async (mapId) => {
  try {
    if (!mapId) {
      console.log('[Bestiary Automator] No map ID provided for navigation');
      return false;
    }
    
    // Check if Game State API is available
    if (!globalThis.state || !globalThis.state.board) {
      console.log('[Bestiary Automator] Game State API not available for map navigation');
      return false;
    }
    
    console.log(`[Bestiary Automator] Navigating to map: ${mapId}`);
    
    // Sleep before navigating to the map
    console.log(`[Bestiary Automator] Waiting ${SUPER_AUTOPLAY_TIMING.NAVIGATION_DELAY}ms before navigation...`);
    await sleep(SUPER_AUTOPLAY_TIMING.NAVIGATION_DELAY);
    
    // Use the Game State API to select the room by ID (like Raid Hunter)
    globalThis.state.board.send({
      type: 'selectRoomById',
      roomId: mapId
    });
    
    // Wait after navigation
    await sleep(SUPER_AUTOPLAY_TIMING.NAVIGATION_DELAY);
    console.log(`[Bestiary Automator] Navigation completed`);
    
    return true;
  } catch (error) {
    console.error('[Bestiary Automator] Error navigating to map:', error);
    return false;
  }
};

// Click Auto-Setup button (like Raid Hunter)
const clickAutoSetup = async () => {
  try {
    console.log('[Bestiary Automator] Looking for Auto-setup button...');
    
    // Use the same approach as Raid Hunter - find button by text
    const autoSetupButton = findButtonByText('Auto-setup');
    if (!autoSetupButton) {
      console.log('[Bestiary Automator] Auto-setup button not found');
      return false;
    }
    
    console.log('[Bestiary Automator] Clicking Auto-setup button...');
    autoSetupButton.click();
    
    // Wait after clicking
    await sleep(SUPER_AUTOPLAY_TIMING.BUTTON_CLICK_DELAY);
    console.log('[Bestiary Automator] Auto-setup button clicked successfully');
    return true;
  } catch (error) {
    console.error('[Bestiary Automator] Error clicking Auto-setup button:', error);
    return false;
  }
};

// Helper function to find button by text (like Raid Hunter) - supports both English and Portuguese
function findButtonByText(text) {
  const buttons = Array.from(document.querySelectorAll('button'));
  
  // Define text mappings for different languages
  const textMappings = {
    'Auto-setup': ['Auto-setup', 'Autoconfigurar'],
    'Start': ['Start', 'Iniciar']
  };
  
  // Get the list of possible texts for the given text key
  const possibleTexts = textMappings[text] || [text];
  
  return buttons.find(button => {
    const buttonText = button.textContent.trim();
    return possibleTexts.includes(buttonText) && isElementVisible(button);
  }) || null;
}

// Helper function to check element visibility (like Raid Hunter)
function isElementVisible(el) {
  if (!el || el.disabled) return false;
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

// Helper function to check if Stop button is pressed
function isStopButtonPressed() {
  try {
    const stopButton = document.querySelector('button.surface-red[data-state="closed"]');
    return stopButton && stopButton.textContent.includes('Stop');
  } catch (error) {
    console.error('[Bestiary Automator] Error checking Stop button:', error);
    return false;
  }
}

// Click Start button (like Raid Hunter)
const clickAutoplay = async () => {
  try {
    console.log('[Bestiary Automator] Looking for Start button...');
    
    // Use the same approach as Raid Hunter - find button by text
    const startButton = findButtonByText('Start');
    if (!startButton) {
      console.log('[Bestiary Automator] Start button not found');
      return false;
    }
    
    console.log('[Bestiary Automator] Clicking Start button...');
    startButton.click();
    
    // Wait after clicking
    await sleep(SUPER_AUTOPLAY_TIMING.BUTTON_CLICK_DELAY);
    console.log('[Bestiary Automator] Start button clicked successfully');
    return true;
  } catch (error) {
    console.error('[Bestiary Automator] Error clicking Start button:', error);
    return false;
  }
};

// Main Faster Autoplay function
const handleFasterAutoplay = async () => {
  if (!config.fasterAutoplay || fasterAutoplayExecutedThisSession) {
    return;
  }
  
  try {
    // Set autoplay delay to 0 for instant execution
    globalThis.state.clientConfig.trigger.setState({
      fn: (prev) => ({
        ...prev,
        autoplayDelayMs: 0
      }),
    });
    
    fasterAutoplayExecutedThisSession = true;
    console.log('[Bestiary Automator] Faster Autoplay enabled - autoplay delay set to 0ms');
  } catch (error) {
    console.warn('[Bestiary Automator] Could not set autoplay delay:', error);
  }
};

// Simplified countdown function
const startCountdown = async (duration) => {
  const countdownTask = { cancelled: false };
  currentCountdownTask = countdownTask;
  
  // Transition to countdown state
  setState(AUTOMATION_STATES.COUNTDOWN);
  
  console.log(`[Bestiary Automator] Starting countdown for ${duration}ms...`);
  
  // Wait for the duration with cancellation support
  const sleepResult = await cancellableSleep(duration, () => {
    return countdownTask.cancelled || currentCountdownTask !== countdownTask;
  });
  
  // Check if countdown was cancelled
  if (sleepResult === 'cancelled') {
    console.log('[Bestiary Automator] Countdown was cancelled during wait period');
    // Don't set state here - let the calling function handle it
    return false;
  }
  
  console.log('[Bestiary Automator] Countdown completed successfully');
  return true;
};

const startAutomation = () => {
  if (automationInterval) return;
  
  console.log('[Bestiary Automator] Starting automation loop');
  
  // Reset session flags when starting automation
  rewardsCollectedThisSession = false;
  fasterAutoplayExecutedThisSession = false;
  fasterAutoplayRunning = false;
  
  
  // Run immediately once
  runAutomationTasks();
  
  // Set up adaptive automation interval based on tab visibility
  const getAutomationInterval = () => {
    return document.hidden ? 10000 : 5000; // 10s in background, 5s in foreground
  };
  
  const runWithAdaptiveInterval = () => {
    runAutomationTasks();
    
    // Schedule next run with appropriate interval
    const nextInterval = getAutomationInterval();
    automationInterval = setTimeout(runWithAdaptiveInterval, nextInterval);
  };
  
  // Start the adaptive interval
  runWithAdaptiveInterval();
  
  // Add tab visibility change detection
  const handleVisibilityChange = () => {
    if (document.hidden) {
      console.log('[Bestiary Automator] Tab became hidden - switching to background mode (10s interval)');
    } else {
      console.log('[Bestiary Automator] Tab became visible - switching to foreground mode (5s interval)');
    }
  };
  
  // Store handler for cleanup
  window.__bestiaryAutomatorVisibilityHandler = handleVisibilityChange;
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Add suspension detection
  let lastExecution = Date.now();
  const checkSuspension = () => {
    const now = Date.now();
    const timeDiff = now - lastExecution;
    
    if (timeDiff > 30000) { // 30 seconds
      console.log(`[Bestiary Automator] Tab may have been suspended for ${Math.round(timeDiff/1000)}s - resuming automation`);
    }
    
    lastExecution = now;
  };
  
  // Check for suspension every 10 seconds
  const suspensionCheckInterval = setInterval(checkSuspension, 10000);
  
  // Store cleanup function for suspension check
  window.__bestiaryAutomatorSuspensionCheck = suspensionCheckInterval;
  
  // Subscribe to game state for autoplay after defeat
  subscribeToGameState();
 };

const stopAutomation = () => {
  if (!automationInterval) return;
  
  console.log('[Bestiary Automator] Stopping automation loop');
  
  // Clear main timeout (now using setTimeout instead of setInterval)
  clearTimeout(automationInterval);
  automationInterval = null;
  
  // Clear suspension check interval
  if (window.__bestiaryAutomatorSuspensionCheck) {
    clearInterval(window.__bestiaryAutomatorSuspensionCheck);
    window.__bestiaryAutomatorSuspensionCheck = null;
  }
  
  // Remove visibility change listener (if it exists)
  if (window.__bestiaryAutomatorVisibilityHandler) {
    document.removeEventListener('visibilitychange', window.__bestiaryAutomatorVisibilityHandler);
    window.__bestiaryAutomatorVisibilityHandler = null;
  }
  
  // Clear all active timeouts
  cancelAllTimeouts();
  
  // Cancel any ongoing countdown
  cancelCurrentCountdown();
  
  // Element cache removed for better performance
  
  // Remove focus event listeners (if they exist)
  if (focusEventListeners) {
    focusEventListeners.forEach(removeListener => removeListener());
    focusEventListeners = null;
  }
  
  // Unsubscribe from game state changes
  unsubscribeFromGameState();
  
  // Clean up game state API subscriptions
  if (gameStateUnsubscribers && Array.isArray(gameStateUnsubscribers)) {
    gameStateUnsubscribers.forEach(unsub => {
      if (typeof unsub === 'function') {
        unsub();
      }
    });
    gameStateUnsubscribers = [];
  }
};

const runAutomationTasks = async () => {
  try {
    // Check if Board Analyzer is running - if so, skip all automation tasks
    if (isBoardAnalyzerRunning()) {
      return;
    }
    
    // Core automation tasks that should always run
    await takeRewardsIfAvailable();
    await handleDayCare();
    updateRequiredStamina();
    await refillStaminaIfNeeded();
    
    // Run Faster Autoplay if enabled (only once per session, after server results are available)
    if (config.fasterAutoplay && !fasterAutoplayExecutedThisSession) {
      await handleFasterAutoplay();
    }
    
    // Toast detection is now handled by MutationObserver - no need for interval checking
  } catch (error) {
    console.error('[Bestiary Automator] Error in automation tasks:', error);
  }
};

// Toggle automation on/off (now only used internally)
const toggleAutomation = () => {
  config.enabled = !config.enabled;
  
  if (config.enabled) {
    startAutomation();
    showNotification(t('mods.automator.statusEnabled'), 'success');
  } else {
    stopAutomation();
    showNotification(t('mods.automator.statusDisabled'), 'info');
  }
  
  // Save the enabled state
  api.service.updateScriptConfig(context.hash, { enabled: config.enabled });
};

// Helper function to check if any potions are selected
const hasAnyPotionSelected = () => {
  return config.potionEnabled.mini || 
         config.potionEnabled.strong || 
         config.potionEnabled.great || 
         config.potionEnabled.ultimate || 
         config.potionEnabled.supreme;
};

// Helper function to update warning visibility
const updatePotionWarning = () => {
  const refillCheckbox = document.getElementById('auto-refill-checkbox');
  const warningElement = document.getElementById('potion-warning-message');
  if (!warningElement) return;
  
  // Check current state of checkboxes
  const autoRefillEnabled = refillCheckbox ? refillCheckbox.checked : config.autoRefillStamina;
  const hasPotionSelected = 
    (document.getElementById('mini-potion-checkbox')?.checked) ||
    (document.getElementById('strong-potion-checkbox')?.checked) ||
    (document.getElementById('great-potion-checkbox')?.checked) ||
    (document.getElementById('ultimate-potion-checkbox')?.checked) ||
    (document.getElementById('supreme-potion-checkbox')?.checked);
  
  warningElement.style.display = (autoRefillEnabled && !hasPotionSelected) ? 'block' : 'none';
};

// Helper function to set nested property value
const setNestedProperty = (obj, propertyPath, value) => {
  if (propertyPath.includes('.')) {
    const parts = propertyPath.split('.');
    let target = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) {
        target[parts[i]] = {};
      }
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = value;
  } else {
    obj[propertyPath] = value;
  }
};

// Helper function to get nested property value
const getNestedProperty = (obj, propertyPath) => {
  if (propertyPath.includes('.')) {
    return propertyPath.split('.').reduce((current, key) => current?.[key], obj);
  }
  return obj[propertyPath];
};

// Auto-save function that saves only the changed setting
const autoSaveConfig = (propertyPath, value) => {
  try {
    // Update the config property
    setNestedProperty(config, propertyPath, value);
    
    // Handle special cases that need additional logic
    if (propertyPath === 'fasterAutoplay' || propertyPath === 'fasterAutoplayMs') {
      // Reset autoplay delay based on Faster Autoplay setting
      try {
        if (config.fasterAutoplay) {
          // Set autoplay delay to configured value
          globalThis.state.clientConfig.trigger.setState({
            fn: (prev) => ({
              ...prev,
              autoplayDelayMs: config.fasterAutoplayMs
            }),
          });
          
          console.log(`[Bestiary Automator] Faster Autoplay enabled - set autoplay delay to ${config.fasterAutoplayMs}ms`);
        } else {
          // Reset autoplay delay to default 3 seconds
          globalThis.state.clientConfig.trigger.setState({
            fn: (prev) => ({
              ...prev,
              autoplayDelayMs: 3000
            }),
          });
          console.log('[Bestiary Automator] Faster Autoplay disabled - reset autoplay delay to 3000ms');
        }
      } catch (error) {
        console.warn('[Bestiary Automator] Could not update autoplay delay:', error);
      }
    }
    
    // Load existing config from localStorage and merge with the change
    let savedConfig = {};
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        savedConfig = JSON.parse(savedData);
      }
    } catch (error) {
      console.warn('[Bestiary Automator] Error loading existing config:', error);
    }
    
    // Merge with current config to ensure all properties are present
    savedConfig = Object.assign({}, defaultConfig, savedConfig, config);
    
    // Update only the changed property in the saved config
    setNestedProperty(savedConfig, propertyPath, value);
    
    // Save to localStorage
    saveConfigToStorage(savedConfig);
    
    console.log(`[Bestiary Automator] Auto-saved ${propertyPath}:`, value);
    
    // Only start automation if it's not already running (prevents redundant initialization)
    if (!automationInterval) {
      startAutomation();
    }
    
    // Update game state subscription based on autoplay setting
    if (propertyPath === 'autoPlayAfterDefeat') {
      if (config.autoPlayAfterDefeat) {
        subscribeToGameState();
      } else {
        unsubscribeFromGameState();
      }
    }
    
    // Only update button styling if configuration actually changed
    updateAutomatorButton();
    
    // Update potion warning visibility if relevant property changed
    if (propertyPath === 'autoRefillStamina' || propertyPath.startsWith('potionEnabled.')) {
      updatePotionWarning();
    }
  } catch (error) {
    console.error('[Bestiary Automator] Error in auto-save:', error);
  }
};

// Helper function to setup checkbox with auto-save
const setupCheckboxAutoSave = (checkbox, propertyPath, onChange = null) => {
  if (!checkbox) return;
  checkbox.checked = config[propertyPath];
  checkbox.addEventListener('change', () => {
    if (onChange) onChange();
    autoSaveConfig(propertyPath, checkbox.checked);
  });
};

// Helper function to setup number input with auto-save and validation
const setupNumberInputAutoSave = (input, propertyPath, min, max) => {
  if (!input) return;
  input.value = getNestedProperty(config, propertyPath);
  
  const validateAndSave = () => {
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value >= min && value <= max) {
      autoSaveConfig(propertyPath, value);
    }
  };
  
  input.addEventListener('change', validateAndSave);
  input.addEventListener('blur', validateAndSave);
};

// Helper function to setup potion checkbox with auto-save
const setupPotionCheckboxAutoSave = (checkbox, potionType) => {
  if (!checkbox) return;
  checkbox.checked = config.potionEnabled[potionType];
  checkbox.addEventListener('change', () => {
    // Update associated threshold input disabled state
    const thresholdInput = document.getElementById(`${potionType}-threshold-input`);
    if (thresholdInput) {
      thresholdInput.disabled = !checkbox.checked;
    }
    updatePotionWarning();
    autoSaveConfig(`potionEnabled.${potionType}`, checkbox.checked);
  });
};

// Helper function to setup potion threshold input with auto-save
const setupPotionThresholdAutoSave = (input, potionType) => {
  if (!input) return;
  input.value = config.potionQuantityThresholds[potionType];
  
  const validateAndSave = () => {
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value >= 0 && value <= 1000) {
      autoSaveConfig(`potionQuantityThresholds.${potionType}`, value);
    }
  };
  
  input.addEventListener('change', validateAndSave);
  input.addEventListener('blur', validateAndSave);
};

// Create the configuration panel
const createConfigPanel = () => {
  const content = document.createElement('div');
  content.style.cssText = 'display: flex; flex-direction: column; gap: 15px;';
  
  // Auto refill stamina checkbox
  const refillContainer = createCheckboxContainer('auto-refill-checkbox', t('mods.automator.autoRefillStamina'), config.autoRefillStamina);
  
  // Minimum stamina input
  const staminaContainer = createNumberInputContainer('min-stamina-input', t('mods.automator.minimumStaminaLabel'), config.minimumStaminaWithoutRefill, 1, 360);
  
  // Auto collect rewards checkbox with info icon
  const rewardsContainer = createCheckboxContainerWithInfo('auto-rewards-checkbox', t('mods.automator.autoCollectRewards'), config.autoCollectRewards, 
    'Automatically collects level up rewards and Daily Seashell when ready');
  
  // Auto day care checkbox
  const dayCareContainer = createCheckboxContainer('auto-daycare-checkbox', t('mods.automator.autoDayCare'), config.autoDayCare);
  
  
  // Auto play after defeat checkbox
  const autoPlayContainer = createCheckboxContainer('auto-play-defeat-checkbox', t('mods.automator.autoPlayAfterDefeat'), config.autoPlayAfterDefeat);
  
  // Faster autoplay checkbox with warning
  const fasterAutoplayWarningText = t('mods.automator.fasterAutoplayWarning');
  
  const fasterAutoplayContainer = createCheckboxContainerWithWarning('faster-autoplay-checkbox', t('mods.automator.fasterAutoplay'), config.fasterAutoplay, fasterAutoplayWarningText);
  
  // Potion quantity thresholds section
  const miniThresholdContainer = createCheckboxWithNumberInput('mini-potion-checkbox', 'mini-threshold-input', t('mods.automator.miniPotion'), config.potionEnabled.mini, config.potionQuantityThresholds.mini, 0, 1000);
  const strongThresholdContainer = createCheckboxWithNumberInput('strong-potion-checkbox', 'strong-threshold-input', t('mods.automator.strongPotion'), config.potionEnabled.strong, config.potionQuantityThresholds.strong, 0, 1000);
  const greatThresholdContainer = createCheckboxWithNumberInput('great-potion-checkbox', 'great-threshold-input', t('mods.automator.greatPotion'), config.potionEnabled.great, config.potionQuantityThresholds.great, 0, 1000);
  const ultimateThresholdContainer = createCheckboxWithNumberInput('ultimate-potion-checkbox', 'ultimate-threshold-input', t('mods.automator.ultimatePotion'), config.potionEnabled.ultimate, config.potionQuantityThresholds.ultimate, 0, 1000);
  const supremeThresholdContainer = createCheckboxWithNumberInput('supreme-potion-checkbox', 'supreme-threshold-input', t('mods.automator.supremePotion'), config.potionEnabled.supreme, config.potionQuantityThresholds.supreme, 0, 1000);
  
  // Create header row for potion thresholds
  const potionHeaderRow = document.createElement('div');
  potionHeaderRow.style.cssText = 'display: flex; align-items: center; margin: 5px 0px; font-weight: bold;';
  
  // Add spacer to account for checkbox width (16px) + margin-right (10px) = 26px
  const checkboxSpacer = document.createElement('span');
  checkboxSpacer.style.cssText = 'width: 26px; margin-right: 0px;';
  
  const potionHeaderLabel = document.createElement('span');
  potionHeaderLabel.textContent = t('mods.automator.potion');
  potionHeaderLabel.style.cssText = 'margin-right: 10px; min-width: 120px; display: inline-block; text-align: center;';
  
  const thresholdHeaderLabel = document.createElement('span');
  thresholdHeaderLabel.textContent = t('mods.automator.threshold');
  thresholdHeaderLabel.style.cssText = 'width: 80px; display: inline-block; text-align: center;';
  
  // Create info icon with tooltip for threshold
  const thresholdInfoIcon = document.createElement('img');
  thresholdInfoIcon.src = 'https://bestiaryarena.com/assets/icons/info.png';
  thresholdInfoIcon.alt = 'info';
  thresholdInfoIcon.style.cssText = 'width: 11px; height: 11px; margin-left: 4px; cursor: help; opacity: 0.7;';
  thresholdInfoIcon.title = t('mods.automator.thresholdTooltip');
  
  potionHeaderRow.appendChild(checkboxSpacer);
  potionHeaderRow.appendChild(potionHeaderLabel);
  potionHeaderRow.appendChild(thresholdHeaderLabel);
  potionHeaderRow.appendChild(thresholdInfoIcon);
  
  // Create container for items above Advanced section
  const mainItemsContainer = document.createElement('div');
  mainItemsContainer.id = 'main-items-container';
  mainItemsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 15px;';
  mainItemsContainer.appendChild(refillContainer);
  mainItemsContainer.appendChild(staminaContainer);
  
  // Warning if autorefillstamina is enabled but no potions are selected
  const warningMsg = document.createElement('div');
  warningMsg.id = 'potion-warning-message';
  warningMsg.textContent = t('mods.automator.noPotionWarning');
  warningMsg.style.cssText = 'color: #e74c3c; margin-top: 8px; padding: 8px; background-color: rgba(231, 76, 60, 0.1); border-radius: 4px; font-size: 0.9em;';
  warningMsg.style.display = (config.autoRefillStamina && !hasAnyPotionSelected()) ? 'block' : 'none';
  mainItemsContainer.appendChild(warningMsg);
  
  mainItemsContainer.appendChild(rewardsContainer);
  
  mainItemsContainer.appendChild(dayCareContainer);
  mainItemsContainer.appendChild(autoPlayContainer);
  mainItemsContainer.appendChild(fasterAutoplayContainer);
  
  // Create separator between potion thresholds and faster autoplay delay
  const separator = document.createElement('div');
  separator.style.cssText = 'height: 1px; background-color: #555; margin: 15px 0px; width: 100%;';
  
  // Faster autoplay delay input
  const fasterAutoplayDelayContainer = createNumberInputContainer('faster-autoplay-input', t('mods.automator.autoplayDelay'), config.fasterAutoplayMs, 0, 3000);
  
  // Separator and credit footer for advanced section
  const creditSeparator = document.createElement('div');
  creditSeparator.style.cssText = 'margin-top: 8px; border-top: 1px solid #444; opacity: 0.6;';
  const credit = document.createElement('div');
  credit.style.cssText = 'margin-top: 2px; font-size: 11px; font-style: italic; color: #aaa; text-align: right;';
  const linkHtml = '<a href="https://bestiaryarena.com/profile/whoman2" target="_blank" rel="noopener noreferrer" style="color:#61AFEF; text-decoration: underline;">whoman2</a>';
  credit.innerHTML = `Made with the help of ${linkHtml}`;
  
  // Auto-save indicator at the top
  const autoSaveFooter = document.createElement('div');
  autoSaveFooter.style.cssText = 'font-size: 11px; font-style: italic; color: rgb(74, 222, 128); text-align: left;';
  autoSaveFooter.textContent = t('mods.automator.settingsAutoSave');
  
  // Create collapsible advanced section with potion thresholds and faster autoplay delay
  const advancedSection = createCollapsibleSection('advanced-section', t('mods.automator.advanced'), [
    potionHeaderRow,
    miniThresholdContainer,
    strongThresholdContainer,
    greatThresholdContainer,
    ultimateThresholdContainer,
    supremeThresholdContainer,
    separator,
    fasterAutoplayDelayContainer,
    creditSeparator,
    credit
  ], mainItemsContainer);
  
  // Add all elements to content
  content.appendChild(autoSaveFooter);
  content.appendChild(mainItemsContainer);
  content.appendChild(advancedSection);
  
  // Update checkboxes with current config values after creation
  setTimeout(() => {
    // Setup checkboxes with auto-save
    setupCheckboxAutoSave(document.getElementById('auto-refill-checkbox'), 'autoRefillStamina', updatePotionWarning);
    setupCheckboxAutoSave(document.getElementById('auto-rewards-checkbox'), 'autoCollectRewards');
    setupCheckboxAutoSave(document.getElementById('auto-daycare-checkbox'), 'autoDayCare');
    setupCheckboxAutoSave(document.getElementById('auto-play-defeat-checkbox'), 'autoPlayAfterDefeat');
    setupCheckboxAutoSave(document.getElementById('faster-autoplay-checkbox'), 'fasterAutoplay');
    
    // Setup number inputs with auto-save
    setupNumberInputAutoSave(document.getElementById('min-stamina-input'), 'minimumStaminaWithoutRefill', 1, 360);
    setupNumberInputAutoSave(document.getElementById('faster-autoplay-input'), 'fasterAutoplayMs', 0, 3000);
    
    // Setup potion checkboxes and threshold inputs with auto-save
    const potionTypes = ['supreme', 'ultimate', 'great', 'strong', 'mini'];
    potionTypes.forEach(potionType => {
      setupPotionCheckboxAutoSave(document.getElementById(`${potionType}-potion-checkbox`), potionType);
      setupPotionThresholdAutoSave(document.getElementById(`${potionType}-threshold-input`), potionType);
    });
  }, 100);
  
  // Create the config panel
  return api.ui.createConfigPanel({
    id: CONFIG_PANEL_ID,
    title: t('mods.automator.modalTitle'),
    modId: MOD_ID,
    content: content,
    onOpen: () => {
      // Update UI with current config values when modal opens
      console.log('[Bestiary Automator] Settings modal opened, updating UI with current config');
      updateSettingsModalUI();
    },
    buttons: [
      {
        text: t('mods.automator.closeButton'),
        primary: false
      }
    ]
  });
  
  // Helper to create a collapsible section
  function createCollapsibleSection(id, title, children, mainItemsContainer = null) {
    const container = document.createElement('div');
    container.id = id;
    container.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
    
    // Create the toggle button
    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 8px 12px;
      background-color: #333;
      color: #fff;
      border: 1px solid #555;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background-color 0.2s;
    `;
    toggleButton.onmouseover = () => toggleButton.style.backgroundColor = '#444';
    toggleButton.onmouseout = () => toggleButton.style.backgroundColor = '#333';
    
    // Create title text
    const titleText = document.createElement('span');
    titleText.textContent = title;
    
    // Create arrow icon
    const arrow = document.createElement('span');
    arrow.textContent = '▼';
    arrow.style.cssText = 'transition: transform 0.2s; font-size: 12px;';
    
    toggleButton.appendChild(titleText);
    toggleButton.appendChild(arrow);
    
    // Create the collapsible content container
    const contentContainer = document.createElement('div');
    contentContainer.id = `${id}-content`;
    contentContainer.style.cssText = `
      display: none;
      flex-direction: column;
      gap: 0px;
      margin-top: 5px;
    `;
    
    // Add children to content container
    children.forEach(child => {
      contentContainer.appendChild(child);
    });
    
    // Toggle functionality
    let isExpanded = false;
    toggleButton.addEventListener('click', () => {
      isExpanded = !isExpanded;
      if (isExpanded) {
        contentContainer.style.display = 'flex';
        arrow.style.transform = 'rotate(180deg)';
        // Hide main items container when Advanced is expanded
        if (mainItemsContainer) {
          mainItemsContainer.style.display = 'none';
        }
      } else {
        contentContainer.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
        // Show main items container when Advanced is collapsed
        if (mainItemsContainer) {
          mainItemsContainer.style.display = 'flex';
        }
      }
    });
    
    container.appendChild(toggleButton);
    container.appendChild(contentContainer);
    
    return container;
  }
  
  // Helper to create a checkbox container
  function createCheckboxContainer(id, label, checked) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; margin: 5px 0px;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = checked;
    checkbox.style.cssText = 'width: 16px; height: 16px; margin-right: 10px;';
    
    const labelElement = document.createElement('label');
    labelElement.htmlFor = id;
    labelElement.textContent = label;
    labelElement.style.cssText = 'flex: 1 1 0%;';
    
    container.appendChild(checkbox);
    container.appendChild(labelElement);
    
    return container;
  }
  
  // Helper to create a number input container
  function createNumberInputContainer(id, label, value, min, max, step = null) {
    const container = document.createElement('div');
    container.style.cssText = 'margin: 5px 0;';
    
    const labelElement = document.createElement('label');
    labelElement.htmlFor = id;
    labelElement.textContent = label;
    labelElement.style.cssText = 'display: block; margin-bottom: 5px;';
    
    const input = document.createElement('input');
    input.type = 'number';
    input.id = id;
    input.min = min;
    input.max = max;
    if (step !== null) input.step = step;
    input.value = Math.max(min, Math.min(max, value)); // Clamp value to valid range
    input.style.cssText = 'width: 100%; padding: 5px; background-color: #222; color: #fff; border: 1px solid #444;';
    
    // Add input validation
    input.addEventListener('input', () => {
      const numValue = parseInt(input.value, 10);
      if (isNaN(numValue) || numValue < min || numValue > max) {
        input.style.borderColor = '#ff4444';
        input.title = `Value must be between ${min} and ${max}%`;
      } else {
        input.style.borderColor = '#444';
        input.title = '';
      }
    });
    
    // Add validation to reset to min/max values when exceeding limits
    input.addEventListener('blur', () => {
      const numValue = parseInt(input.value, 10);
      if (!isNaN(numValue)) {
        if (numValue > max) {
          input.value = max;
          input.style.borderColor = '#444';
          input.title = '';
        } else if (numValue < min) {
          input.value = min;
          input.style.borderColor = '#444';
          input.title = '';
        }
      }
    });
    
    container.appendChild(labelElement);
    container.appendChild(input);
    
    return container;
  }
  
  // Helper to create a checkbox with number input container
  function createCheckboxWithNumberInput(checkboxId, inputId, label, checked, value, min, max) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; margin: 5px 0px;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = checkboxId;
    checkbox.checked = checked;
    checkbox.style.cssText = 'width: 16px; height: 16px; margin-right: 10px;';
    
    const labelElement = document.createElement('label');
    labelElement.htmlFor = checkboxId;
    labelElement.textContent = label;
    labelElement.style.cssText = 'margin-right: 10px; min-width: 120px;';
    
    const input = document.createElement('input');
    input.type = 'number';
    input.id = inputId;
    input.min = min;
    input.max = max;
    input.value = Math.max(min, Math.min(max, value));
    input.style.cssText = 'width: 80px; padding: 5px; background-color: #222; color: #fff; border: 1px solid #444;';
    
    // Disable input when checkbox is unchecked
    input.disabled = !checked;
    checkbox.addEventListener('change', () => {
      input.disabled = !checkbox.checked;
      updatePotionWarning();
      // Note: auto-save is handled by event listeners added in setTimeout block
      // to avoid duplicate saves
    });
    
    // Add input validation
    input.addEventListener('input', () => {
      const numValue = parseInt(input.value, 10);
      if (isNaN(numValue) || numValue < min || numValue > max) {
        input.style.borderColor = '#ff4444';
        input.title = `Value must be between ${min} and ${max}`;
      } else {
        input.style.borderColor = '#444';
        input.title = '';
      }
    });
    
    // Add validation to reset to min/max values when exceeding limits and auto-save
    input.addEventListener('blur', () => {
      const numValue = parseInt(input.value, 10);
      if (!isNaN(numValue)) {
        if (numValue > max) {
          input.value = max;
          input.style.borderColor = '#444';
          input.title = '';
        } else if (numValue < min) {
          input.value = min;
          input.style.borderColor = '#444';
          input.title = '';
        }
      }
      // Determine which property this is based on inputId
      const finalValue = parseInt(input.value, 10);
      if (!isNaN(finalValue) && finalValue >= min && finalValue <= max) {
        if (inputId.includes('threshold-input')) {
          const potionType = inputId.replace('-threshold-input', '');
          autoSaveConfig(`potionQuantityThresholds.${potionType}`, finalValue);
        } else if (inputId === 'faster-autoplay-input') {
          autoSaveConfig('fasterAutoplayMs', finalValue);
        } else if (inputId === 'min-stamina-input') {
          autoSaveConfig('minimumStaminaWithoutRefill', finalValue);
        }
      }
    });
    input.addEventListener('change', () => {
      const numValue = parseInt(input.value, 10);
      if (!isNaN(numValue) && numValue >= min && numValue <= max) {
        if (inputId.includes('threshold-input')) {
          const potionType = inputId.replace('-threshold-input', '');
          autoSaveConfig(`potionQuantityThresholds.${potionType}`, numValue);
        } else if (inputId === 'faster-autoplay-input') {
          autoSaveConfig('fasterAutoplayMs', numValue);
        } else if (inputId === 'min-stamina-input') {
          autoSaveConfig('minimumStaminaWithoutRefill', numValue);
        }
      }
    });
    
    container.appendChild(checkbox);
    container.appendChild(labelElement);
    container.appendChild(input);
    
    return container;
  }
  
  // Helper to create a checkbox container with info icon and tooltip
  function createCheckboxContainerWithInfo(id, label, checked, infoText) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; margin: 5px 0px;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = checked;
    checkbox.style.cssText = 'width: 16px; height: 16px; margin-right: 10px;';
    
    // Create info icon with tooltip
    const infoIcon = document.createElement('img');
    infoIcon.src = 'https://bestiaryarena.com/assets/icons/info.png';
    infoIcon.alt = 'info';
    infoIcon.style.cssText = 'width: 11px; height: 11px; margin-right: 8px; cursor: help; opacity: 0.7;';
    infoIcon.title = infoText;
    
    const labelElement = document.createElement('label');
    labelElement.htmlFor = id;
    labelElement.textContent = label;
    labelElement.style.cssText = 'flex: 1 1 0%;';
    
    container.appendChild(checkbox);
    container.appendChild(infoIcon);
    container.appendChild(labelElement);
    
    return container;
  }

  // Helper to create a checkbox container with warning symbol and tooltip
  function createCheckboxContainerWithWarning(id, label, checked, warningText) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; margin: 5px 0px;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = checked;
    checkbox.style.cssText = 'width: 16px; height: 16px; margin-right: 10px;';
    
    // Create warning symbol with tooltip
    const warningSymbol = document.createElement('span');
    warningSymbol.textContent = '⚠️';
    warningSymbol.style.cssText = 'margin-right: 8px; cursor: help; font-size: 16px; color: #ffaa00;';
    warningSymbol.title = warningText;
    
    const labelElement = document.createElement('label');
    labelElement.htmlFor = id;
    labelElement.textContent = label;
    labelElement.style.cssText = 'flex: 1 1 0%; color: #ff4444; font-weight: bold;';
    
    container.appendChild(checkbox);
    container.appendChild(warningSymbol);
    container.appendChild(labelElement);
    
    return container;
  }
};

// Create buttons
const createButtons = () => {
  // Create only the configuration button
  api.ui.addButton({
    id: CONFIG_BUTTON_ID,
    text: t('mods.automator.buttonText'),
    modId: MOD_ID,
    tooltip: t('mods.automator.configButtonTooltip'),
    primary: false, // Never use primary to avoid solid green color
    onClick: () => api.ui.toggleConfigPanel(CONFIG_PANEL_ID)
  });
  
  // Apply custom styling based on priority
  setTimeout(() => {
    const btn = document.getElementById(CONFIG_BUTTON_ID);
    console.log('[Bestiary Automator] Button creation timeout - looking for button:', CONFIG_BUTTON_ID);
    console.log('[Bestiary Automator] Button found:', !!btn);
    if (btn) {
      console.log('[Bestiary Automator] Applying initial button styling...');
      applyButtonStyling(btn);
    } else {
      console.log('[Bestiary Automator] Button not found during initial styling');
    }
  }, 100);
};

// Simple background image preloading
const preloadBackgroundImages = () => {
  const imageUrls = [
    'https://bestiaryarena.com/_next/static/media/background-green.be515334.png',
    'https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png',
    'https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png'
  ];
  
  imageUrls.forEach(url => {
    const img = new Image();
    img.src = url;
  });
  
  console.log('[Bestiary Automator] Background images preloaded');
};

// Apply button styling - simple and direct
const applyButtonStyling = (btn) => {
  // Clear any existing background styling first
  btn.style.background = '';
  btn.style.backgroundColor = '';
  
  const greenBgUrl = 'https://bestiaryarena.com/_next/static/media/background-green.be515334.png';
  const blueBgUrl = 'https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png';
  const regularBgUrl = 'https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png';
  
  {
    console.log('[Bestiary Automator] Applying button styling:');
    console.log('  - autoRefillStamina:', config.autoRefillStamina);
    console.log('  - autoCollectRewards:', config.autoCollectRewards);
    console.log('  - autoDayCare:', config.autoDayCare);
    console.log('  - autoPlayAfterDefeat:', config.autoPlayAfterDefeat);
    console.log('  - fasterAutoplay:', config.fasterAutoplay);
    console.log('  - fasterAutoplayRunning:', fasterAutoplayRunning);
  }
  
  // Update button text to show warning when Faster Autoplay is enabled or running
  if (config.fasterAutoplay) {
    btn.textContent = '⚠️ Automator';
  } else {
    btn.textContent = 'Automator';
  }
  
  if (config.autoRefillStamina) {
    // Priority 1: Green background for auto refill stamina (highest priority - most critical)
    console.log('[Bestiary Automator] Applying GREEN background for autoRefillStamina');
    btn.style.background = `url('${greenBgUrl}') repeat`;
    btn.style.backgroundSize = "auto";
  } else if (fasterAutoplayRunning) {
    // Priority 2: Special styling when Faster Autoplay is actively running (danger state)
    console.log('[Bestiary Automator] Applying BLUE background for fasterAutoplayRunning');
    btn.style.background = `url('${blueBgUrl}') repeat`;
    btn.style.backgroundSize = "auto";
  } else if (config.autoCollectRewards || config.autoDayCare || config.autoPlayAfterDefeat) {
    // Priority 3: Blue background for other auto features
    console.log('[Bestiary Automator] Applying BLUE background for other features');
    btn.style.background = `url('${blueBgUrl}') repeat`;
    btn.style.backgroundSize = "auto";
  } else {
    // Default: No features enabled
    console.log('[Bestiary Automator] Applying DEFAULT background');
    btn.style.background = `url('${regularBgUrl}') repeat`;
  }
  
  // Update tooltip to show Faster Autoplay status
  if (fasterAutoplayRunning) {
    btn.title = t('mods.automator.configButtonTooltip') + ' - Faster Autoplay Running';
  } else if (config.fasterAutoplay) {
    btn.title = t('mods.automator.configButtonTooltip') + ' - Faster Autoplay Enabled';
  } else {
    btn.title = t('mods.automator.configButtonTooltip');
  }
};

// Initialize the mod
function init() {
  console.log('[Bestiary Automator] Initializing UI...');
  
  // Preload background images
  preloadBackgroundImages();
  
  // Reset session flags on initialization
  rewardsCollectedThisSession = false;
  fasterAutoplayExecutedThisSession = false;
  fasterAutoplayRunning = false;
  
  // Parse max stamina from DOM (for Game State-based refill calculation)
  // Try immediately and with a delay in case DOM isn't ready
  maxStamina = parseMaxStaminaFromDOM();
  if (!maxStamina) {
    setTimeout(() => {
      maxStamina = parseMaxStaminaFromDOM();
      if (maxStamina) {
        console.log(`[Bestiary Automator] Max stamina parsed on delayed attempt: ${maxStamina}`);
      }
    }, 1000);
  }
  
  // Set up stamina potion error handler
  setupStaminaPotionErrorHandler();
  
  // Create the buttons
  createButtons();
  
  // Create the config panel
  createConfigPanel();
  
  // Always start automation on init
  startAutomation();
  
  // Subscribe to game state if autoplay after defeat is enabled
  if (config.autoPlayAfterDefeat) {
    subscribeToGameState();
  }
  
  console.log('[Bestiary Automator] Initialization complete');
}

// Initialize the mod
init();

// Track button state to prevent unnecessary updates
let lastButtonState = {
  autoRefillStamina: config.autoRefillStamina,
  autoCollectRewards: config.autoCollectRewards,
  autoDayCare: config.autoDayCare,
  autoPlayAfterDefeat: config.autoPlayAfterDefeat,
  fasterAutoplay: config.fasterAutoplay,
  fasterAutoplayRunning: false,
  boardAnalyzerRunning: false
};

// Initialize lastButtonState with current config values to prevent unnecessary updates
lastButtonState = {
  autoRefillStamina: config.autoRefillStamina,
  autoCollectRewards: config.autoCollectRewards,
  autoDayCare: config.autoDayCare,
  autoPlayAfterDefeat: config.autoPlayAfterDefeat,
  fasterAutoplay: config.fasterAutoplay,
  fasterAutoplayRunning: false,
  boardAnalyzerRunning: false
};

// Update the Automator button style based on enabled features
function updateAutomatorButton() {
  // Check current state
  const currentButtonState = {
    autoRefillStamina: config.autoRefillStamina,
    autoCollectRewards: config.autoCollectRewards,
    autoDayCare: config.autoDayCare,
    autoPlayAfterDefeat: config.autoPlayAfterDefeat,
    fasterAutoplay: config.fasterAutoplay,
    fasterAutoplayRunning: fasterAutoplayRunning,
    boardAnalyzerRunning: isBoardAnalyzerRunning()
  };
  
  // Only update button styling if state has changed
  const stateChanged = JSON.stringify(currentButtonState) !== JSON.stringify(lastButtonState);
  
  console.log('[Bestiary Automator] updateAutomatorButton called:');
  console.log('  - Current state:', currentButtonState);
  console.log('  - Last state:', lastButtonState);
  console.log('  - State changed:', stateChanged);
  
  if (stateChanged) {
    const btn = document.getElementById(CONFIG_BUTTON_ID);
    if (btn) {
      console.log('[Bestiary Automator] Updating button styling...');
      applyButtonStyling(btn);
    } else {
      console.log('[Bestiary Automator] Button not found for styling update');
    }
    
    // Update last known state
    lastButtonState = currentButtonState;
  } else {
    console.log('[Bestiary Automator] No state change detected, skipping button update');
  }
}

// Update UI elements in the settings modal if it's open
function updateSettingsModalUI() {
  try {
    console.log('[Bestiary Automator] Attempting to update settings modal UI...');
    console.log('[Bestiary Automator] Current config.autoRefillStamina:', config.autoRefillStamina);
    
    // Try multiple ways to find the modal
    let modal = document.querySelector(`#${CONFIG_PANEL_ID}`);
    if (!modal) {
      // Try alternative selectors
      modal = document.querySelector('[data-radix-dialog-content]');
      console.log('[Bestiary Automator] Modal found via alternative selector:', !!modal);
    }
    
    if (!modal) {
      console.log('[Bestiary Automator] Settings modal not found, skipping UI update');
      return;
    }
    
    // Check if modal is visible
    const isVisible = modal.offsetParent !== null;
    console.log('[Bestiary Automator] Modal visible:', isVisible);
    
    // Always update UI elements if they exist, regardless of modal visibility
    // This ensures UI stays in sync when config is changed programmatically (e.g., by Raid Hunter)
    if (!isVisible) {
      console.log('[Bestiary Automator] Settings modal not visible, but updating UI elements anyway for programmatic changes');
    }
    
    console.log('[Bestiary Automator] Updating settings modal UI with current config values');
    
    // Update checkboxes - try multiple selectors for each
    const refillCheckbox = document.getElementById('auto-refill-checkbox') || 
                          document.querySelector('input[type="checkbox"][id*="refill"]') ||
                          document.querySelector('input[type="checkbox"]:has(+ label:contains("Autorefill Stamina"))');
    
    const rewardsCheckbox = document.getElementById('auto-rewards-checkbox') || 
                           document.querySelector('input[type="checkbox"][id*="rewards"]');
    
    const dayCareCheckbox = document.getElementById('auto-daycare-checkbox') || 
                           document.querySelector('input[type="checkbox"][id*="daycare"]');
    
    const autoPlayCheckbox = document.getElementById('auto-play-defeat-checkbox') || 
                            document.querySelector('input[type="checkbox"][id*="defeat"]');
    
    
    const fasterAutoplayCheckbox = document.getElementById('faster-autoplay-checkbox') || 
                                 document.querySelector('input[type="checkbox"][id*="super"]');
    
    const staminaInput = document.getElementById('min-stamina-input') || 
                        document.querySelector('input[type="number"][id*="stamina"]');
    
    console.log('[Bestiary Automator] Found elements:');
    console.log('  - refillCheckbox:', !!refillCheckbox);
    console.log('  - rewardsCheckbox:', !!rewardsCheckbox);
    console.log('  - dayCareCheckbox:', !!dayCareCheckbox);
    console.log('  - autoPlayCheckbox:', !!autoPlayCheckbox);
    console.log('  - fasterAutoplayCheckbox:', !!fasterAutoplayCheckbox);
    console.log('  - staminaInput:', !!staminaInput);
    
    if (refillCheckbox) {
      const oldValue = refillCheckbox.checked;
      const newValue = config.autoRefillStamina;
      if (oldValue !== newValue) {
        refillCheckbox.checked = newValue;
        console.log('[Bestiary Automator] Updated autorefill stamina checkbox from', oldValue, 'to', newValue);
      }
      
      // Add event listener to auto-save when checkbox changes (if not already added)
      if (!refillCheckbox.hasAttribute('data-listener-added')) {
        setupCheckboxAutoSave(refillCheckbox, 'autoRefillStamina', updatePotionWarning);
        refillCheckbox.setAttribute('data-listener-added', 'true');
      }
    } else {
      console.log('[Bestiary Automator] Autorefill stamina checkbox not found!');
    }
    
    if (rewardsCheckbox && !rewardsCheckbox.hasAttribute('data-listener-added')) {
      rewardsCheckbox.checked = config.autoCollectRewards;
      setupCheckboxAutoSave(rewardsCheckbox, 'autoCollectRewards');
      rewardsCheckbox.setAttribute('data-listener-added', 'true');
    }
    if (dayCareCheckbox && !dayCareCheckbox.hasAttribute('data-listener-added')) {
      dayCareCheckbox.checked = config.autoDayCare;
      setupCheckboxAutoSave(dayCareCheckbox, 'autoDayCare');
      dayCareCheckbox.setAttribute('data-listener-added', 'true');
    }
    if (autoPlayCheckbox && !autoPlayCheckbox.hasAttribute('data-listener-added')) {
      autoPlayCheckbox.checked = config.autoPlayAfterDefeat;
      setupCheckboxAutoSave(autoPlayCheckbox, 'autoPlayAfterDefeat');
      autoPlayCheckbox.setAttribute('data-listener-added', 'true');
    }
    if (fasterAutoplayCheckbox && !fasterAutoplayCheckbox.hasAttribute('data-listener-added')) {
      fasterAutoplayCheckbox.checked = config.fasterAutoplay;
      setupCheckboxAutoSave(fasterAutoplayCheckbox, 'fasterAutoplay');
      fasterAutoplayCheckbox.setAttribute('data-listener-added', 'true');
    }
    if (staminaInput && !staminaInput.hasAttribute('data-listener-added')) {
      staminaInput.value = config.minimumStaminaWithoutRefill;
      setupNumberInputAutoSave(staminaInput, 'minimumStaminaWithoutRefill', 1, 360);
      staminaInput.setAttribute('data-listener-added', 'true');
    }

    // Update potion threshold inputs
    const supremeThresholdInput = document.getElementById('supreme-threshold-input');
    const ultimateThresholdInput = document.getElementById('ultimate-threshold-input');
    const greatThresholdInput = document.getElementById('great-threshold-input');
    const strongThresholdInput = document.getElementById('strong-threshold-input');
    const miniThresholdInput = document.getElementById('mini-threshold-input');

    if (supremeThresholdInput) supremeThresholdInput.value = config.potionQuantityThresholds.supreme;
    if (ultimateThresholdInput) ultimateThresholdInput.value = config.potionQuantityThresholds.ultimate;
    if (greatThresholdInput) greatThresholdInput.value = config.potionQuantityThresholds.great;
    if (strongThresholdInput) strongThresholdInput.value = config.potionQuantityThresholds.strong;
    if (miniThresholdInput) miniThresholdInput.value = config.potionQuantityThresholds.mini;

    // Update potion enabled checkboxes
    const supremePotionCheckbox = document.getElementById('supreme-potion-checkbox');
    const ultimatePotionCheckbox = document.getElementById('ultimate-potion-checkbox');
    const greatPotionCheckbox = document.getElementById('great-potion-checkbox');
    const strongPotionCheckbox = document.getElementById('strong-potion-checkbox');
    const miniPotionCheckbox = document.getElementById('mini-potion-checkbox');

    // Update potion checkboxes and their associated threshold inputs
    const potionTypes = ['supreme', 'ultimate', 'great', 'strong', 'mini'];
    potionTypes.forEach(potionType => {
      const checkbox = document.getElementById(`${potionType}-potion-checkbox`);
      const thresholdInput = document.getElementById(`${potionType}-threshold-input`);
      
      if (checkbox) {
        checkbox.checked = config.potionEnabled[potionType];
        // Update input disabled state
        if (thresholdInput) thresholdInput.disabled = !checkbox.checked;
        if (!checkbox.hasAttribute('data-listener-added')) {
          setupPotionCheckboxAutoSave(checkbox, potionType);
          checkbox.setAttribute('data-listener-added', 'true');
        }
      }
      
      if (thresholdInput && !thresholdInput.hasAttribute('data-listener-added')) {
        thresholdInput.value = config.potionQuantityThresholds[potionType];
        setupPotionThresholdAutoSave(thresholdInput, potionType);
        thresholdInput.setAttribute('data-listener-added', 'true');
      }
    });
    
    // Update faster autoplay delay input
    const fasterAutoplayInput = document.getElementById('faster-autoplay-input');
    if (fasterAutoplayInput && !fasterAutoplayInput.hasAttribute('data-listener-added')) {
      fasterAutoplayInput.value = config.fasterAutoplayMs;
      setupNumberInputAutoSave(fasterAutoplayInput, 'fasterAutoplayMs', 0, 3000);
      fasterAutoplayInput.setAttribute('data-listener-added', 'true');
    }
    
    // Update potion warning visibility after updating UI
    updatePotionWarning();
    
  } catch (error) {
    console.error('[Bestiary Automator] Error updating settings modal UI:', error);
  }
}

// Export functionality
context.exports = {
  toggleAutomation,
  updateConfig: (newConfig) => {
    console.log('[Bestiary Automator] updateConfig called with:', newConfig);
    console.log('[Bestiary Automator] Current config before update:', JSON.parse(JSON.stringify(config)));
    
    const oldEnabled = config.enabled;
    Object.assign(config, newConfig);
    
    console.log('[Bestiary Automator] Config after update:', JSON.parse(JSON.stringify(config)));
    
    // Only start or stop automation if the enabled state actually changed
    if (newConfig.hasOwnProperty('enabled') && newConfig.enabled !== oldEnabled) {
      if (config.enabled) {
        startAutomation();
      } else {
        stopAutomation();
      }
    }
    
    // Force button update if autoRefillStamina was explicitly set to true
    if (newConfig.hasOwnProperty('autoRefillStamina') && newConfig.autoRefillStamina === true) {
      console.log('[Bestiary Automator] autoRefillStamina set to true - forcing button update');
      const btn = document.getElementById(CONFIG_BUTTON_ID);
      if (btn) {
        applyButtonStyling(btn);
        // Update lastButtonState to reflect the change
        lastButtonState.autoRefillStamina = true;
      }
    } else {
      // Update button styling normally
      console.log('[Bestiary Automator] Calling updateAutomatorButton...');
      updateAutomatorButton();
    }
    
    // Update UI elements in the settings modal if it's open
    updateSettingsModalUI();
  },
  cleanup: () => {
    // Cleanup function for when mod is disabled
    stopAutomation();
    
    // Clear all timeouts
    cancelAllTimeouts();
    
    // Clear seashell timer
    clearSeashellTimer();
    
    // Restore original fetch function if it was overridden
    if (originalFetch && window.fetch !== originalFetch) {
      window.fetch = originalFetch;
      console.log('[Bestiary Automator] Restored original fetch function');
    }
    
    // Reset session flags
    fasterAutoplayExecutedThisSession = false;
    fasterAutoplayRunning = false;
    rewardsCollectedThisSession = false;
    
    console.log('[Bestiary Automator] Cleanup completed');
  },
  // Manual seashell collection for testing
  collectSeashell: collectSeashellIfReady,
  // Manual rewards collection for testing
  collectRewards: takeRewardsIfAvailable,
  // Seashell timer management
  clearSeashellTimer: clearSeashellTimer,
  setupSeashellTimer: setupSeashellTimer,
  // Debug function to check Game State API structure
  debugStamina: function() {
    console.log('=== [Bestiary Automator] Game State API Debug ===');
    console.log('Function called successfully');
    
    try {
      console.log('Step 1: Checking globalThis.state...');
      if (!globalThis.state) {
        console.error('❌ globalThis.state is not available');
        console.log('=== End Debug (early exit) ===');
        return;
      }
      console.log('✅ globalThis.state is available');
      console.log('Step 2: Checking globalThis.state.player...');
      
      if (!globalThis.state.player) {
        console.error('❌ globalThis.state.player is not available');
        console.log('Available state keys:', Object.keys(globalThis.state));
        console.log('=== End Debug (early exit) ===');
        return;
      }
      console.log('✅ globalThis.state.player is available');
      console.log('Step 3: Getting player snapshot...');
      
      const snapshot = globalThis.state.player.getSnapshot();
      console.log('✅ Snapshot obtained');
      console.log('Snapshot keys:', Object.keys(snapshot));
      
      console.log('Step 4: Getting player context...');
      const playerContext = snapshot.context;
      console.log('✅ Player context obtained');
      console.log('📋 All keys in playerContext:', Object.keys(playerContext));
      
      // Use a safer JSON stringify with error handling
      try {
        console.log('📦 Full playerContext object:', JSON.stringify(playerContext, null, 2));
      } catch (e) {
        console.log('📦 Full playerContext object (circular reference, showing keys only):', playerContext);
      }
      
      // Check for stamina in various possible locations
      console.log('\n🔍 Checking for stamina in different locations:');
      console.log('  - playerContext.stamina:', playerContext.stamina);
      console.log('  - playerContext.currentStamina:', playerContext.currentStamina);
      console.log('  - playerContext.staminaPoints:', playerContext.staminaPoints);
      console.log('  - playerContext.staminaCurrent:', playerContext.staminaCurrent);
      
      // Check if stamina might be in a nested object
      if (playerContext.stats) {
        console.log('  - playerContext.stats:', playerContext.stats);
        console.log('  - playerContext.stats.stamina:', playerContext.stats.stamina);
      }
      if (playerContext.resources) {
        console.log('  - playerContext.resources:', playerContext.resources);
        console.log('  - playerContext.resources.stamina:', playerContext.resources.stamina);
      }
      
      // Check snapshot value
      console.log('\n📸 Snapshot structure:');
      console.log('  - snapshot keys:', Object.keys(snapshot));
      if (snapshot.value) {
        console.log('  - snapshot.value keys:', Object.keys(snapshot.value));
        try {
          console.log('  - snapshot.value:', JSON.stringify(snapshot.value, null, 2));
        } catch (e) {
          console.log('  - snapshot.value (circular reference):', snapshot.value);
        }
      }
      
      // Try to get stamina using the same method as DOM
      console.log('\n🌐 Checking DOM for stamina:');
      const elStamina = getStaminaElement();
      if (elStamina) {
        const staminaElement = getStaminaValueElement();
        if (staminaElement) {
          console.log('  - DOM stamina value:', staminaElement.textContent);
        } else {
          console.log('  - Stamina element found but span span not found');
        }
      } else {
        console.log('  - Stamina element not found in DOM');
      }
      
      console.log('\n=== End Debug ===');
    } catch (error) {
      console.error('❌ Error during debug:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
};

// Also expose globally for other mods to access
window.bestiaryAutomator = context.exports; 