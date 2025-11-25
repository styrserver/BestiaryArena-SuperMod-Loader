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
  persistAutoRefillOnRefresh: false,
  useApiForStaminaRefill: false
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
  if (window.__modCoordination && window.__modCoordination.boardAnalyzerRunning) {
    console.log('[Bestiary Automator] Board Analyzer is running, skipping scroll lock handling');
    return false;
  }
  
  try {
    const body = document.body;
    const scrollLockValue = body.getAttribute('data-scroll-locked');
    
    if (scrollLockValue && parseInt(scrollLockValue) > 0) {
      console.log(`[Bestiary Automator] Scroll lock detected (${scrollLockValue}), simulating ESC key`);
      
      // Simulate ESC key press
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true
      });
      
      document.dispatchEvent(escEvent);
      
      // Wait briefly and verify the scroll lock was actually resolved
      await sleep(150);
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
  if (window.__modCoordination && window.__modCoordination.boardAnalyzerRunning) {
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
    const stackOffset = existingToasts.length * 46;
    
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
          const offset = index * 46;
          toast.style.transform = `translateY(-${offset}px)`;
        });
      }
    }, 4000);
    
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
    if (window.__modCoordination && window.__modCoordination.boardAnalyzerRunning) {
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
    if (window.__modCoordination && window.__modCoordination.boardAnalyzerRunning) {
      console.log('[Bestiary Automator] Board Analyzer is running, pausing stamina refill');
      return false;
    }
    
    // Simple check: just verify stamina element exists
    const elStamina = document.querySelector('[title="Stamina"]');
    return !!elStamina;
  } catch (error) {
    console.error('[Bestiary Automator] Error checking game readiness:', error);
    return false;
  }
};

// Get current stamina from DOM (used by API-based refill system)
const getCurrentStaminaFromState = () => {
  try {
    const elStamina = document.querySelector('[title="Stamina"]');
    if (!elStamina) return null;
    
    const staminaElement = elStamina.querySelector('span span');
    if (!staminaElement) return null;
    
    const stamina = Number(staminaElement.textContent);
    return isNaN(stamina) ? null : stamina;
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

// Helper to find lowest tier potion available in inventory
const findLowestTierPotion = (inventory) => {
  if (!inventory) return null;
  
  for (let tier = 1; tier <= 4; tier++) {
    const potionKey = `stamina${tier}`;
    if (inventory[potionKey] && inventory[potionKey] > 0) {
      return tier;
    }
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
  console.log('[Bestiary Automator] Using simple refill method (background tab)');
  
  elStamina.click();
  await sleep(500);
  clickButtonWithText('mods.automator.usePotion');
  await sleep(500);
  clickButtonWithText('common.close');
  await sleep(500);
};

// Robust stamina refill method for foreground tabs (with retry logic)
const refillStaminaWithRetry = async (elStamina, staminaElement) => {
  console.log('[Bestiary Automator] Using retry refill method (foreground tab)');
  
  const initialStamina = Number(staminaElement.textContent);
  
  elStamina.click();
  await sleep(500);
  clickButtonWithText('mods.automator.usePotion');
  await sleep(500);
  
  // Retry logic for foreground tabs
  let retryCount = 0;
  const maxRetries = 5;
  
  while (retryCount < maxRetries) {
    const newStaminaElement = document.querySelector('[title="Stamina"] span span');
    if (newStaminaElement) {
      const newStamina = Number(newStaminaElement.textContent);
      if (newStamina >= config.minimumStaminaWithoutRefill) {
        console.log(`[Bestiary Automator] Stamina refilled successfully: ${newStamina}`);
        break;
      }
      
      retryCount++;
      console.log(`[Bestiary Automator] Stamina still low after refill: ${newStamina}, retry ${retryCount}/${maxRetries}`);
      
      clickButtonWithText('mods.automator.usePotion');
      await sleep(500);
    } else {
      console.log(`[Bestiary Automator] Could not find stamina element for retry ${retryCount + 1}`);
      break;
    }
  }
  
  if (retryCount >= maxRetries) {
    console.log(`[Bestiary Automator] Max retries (${maxRetries}) reached for stamina refill`);
    
    // Check if stamina didn't increase at all - likely means no potions
    const finalStaminaElement = document.querySelector('[title="Stamina"] span span');
    if (finalStaminaElement) {
      const finalStamina = Number(finalStaminaElement.textContent);
      if (finalStamina === initialStamina) {
        console.log('[Bestiary Automator] Stamina unchanged after max retries - checking if user has potions...');
        
        // Wait a bit for inventory to update, then check
        await sleep(1000);
        if (!hasStaminaPotions()) {
          disableAutoRefillDueToNoPotions();
        }
      }
    }
  }
  
  // Use ESC key for foreground tabs (more reliable when tab is active)
  const escEvent1 = new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    keyCode: 27,
    which: 27,
    bubbles: true,
    cancelable: true
  });
  document.dispatchEvent(escEvent1);
  
  await sleep(200);
  
  const escEvent2 = new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    keyCode: 27,
    which: 27,
    bubbles: true,
    cancelable: true
  });
  document.dispatchEvent(escEvent2);
  
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

// API-based stamina refill method
const refillStaminaViaAPI = async () => {
  // Check game readiness before starting
  if (!isGameReadyForStaminaRefill()) {
    console.log('[Bestiary Automator] Game not ready for API-based stamina refill');
    return false;
  }
  
  setRefillingFlag();
  
  try {
    // Get current stamina
    let currentStamina = getCurrentStaminaFromState();
    if (currentStamina === null) {
      console.log('[Bestiary Automator] Could not get current stamina, aborting API refill');
      clearRefillingFlag();
      return false;
    }
    
    // Check if we already have enough stamina
    if (currentStamina >= config.minimumStaminaWithoutRefill) {
      console.log(`[Bestiary Automator] Stamina already sufficient: ${currentStamina} >= ${config.minimumStaminaWithoutRefill}`);
      clearRefillingFlag();
      return true;
    }
    
    console.log(`[Bestiary Automator] Starting API-based stamina refill: current=${currentStamina}, target=${config.minimumStaminaWithoutRefill}`);
    
    if (!isGameStateAPIAvailable()) {
      console.log('[Bestiary Automator] Game State API not available for API refill');
      clearRefillingFlag();
      return false;
    }
    
    // Refill loop: use lowest tier potions first until target is reached
    while (currentStamina < config.minimumStaminaWithoutRefill) {
      // Refresh inventory from Game State API before each potion check
      const inventory = getPlayerInventory();
      if (!inventory) {
        console.log('[Bestiary Automator] Game State API not available for inventory check');
        break;
      }
      
      // Find lowest tier potion available
      const potionTier = findLowestTierPotion(inventory);
      if (!potionTier) {
        console.log('[Bestiary Automator] No stamina potions available');
        break;
      }
      
      const potionKey = `stamina${potionTier}`;
      console.log(`[Bestiary Automator] Using tier ${potionTier} potion (current stamina: ${currentStamina}, available: ${inventory[potionKey]})`);
      
      // Wait for rate limit before using potion
      await waitForPotionRateLimit();
      
      // Make API call
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
          let errorMessage = '';
          try {
            const errorBody = await response.text();
            errorMessage = errorBody ? ` - ${errorBody.substring(0, 200)}` : '';
          } catch (_) {}
          console.log(`[Bestiary Automator] API call failed with status ${status}${errorMessage}`);
          
          // Handle 400/403/404 errors (no potions or invalid request)
          if (status === 400 || status === 403 || status === 404) {
            removeStaminaPotionFromInventory(potionTier);
            break;
          }
          
          // For other errors, break and return failure
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
          console.log(`[Bestiary Automator] Potion used successfully, restored ${pointsRestored} points`);
          
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
        
        // Re-check current stamina
        currentStamina = getCurrentStaminaFromState();
        if (currentStamina === null) {
          console.log('[Bestiary Automator] Could not get updated stamina, stopping refill');
          break;
        }
        
      } catch (error) {
        console.error('[Bestiary Automator] Error in API call:', error);
        break;
      }
    }
    
    const finalStamina = getCurrentStaminaFromState();
    if (finalStamina !== null && finalStamina >= config.minimumStaminaWithoutRefill) {
      console.log(`[Bestiary Automator] API refill completed successfully: ${finalStamina} >= ${config.minimumStaminaWithoutRefill}`);
    } else {
      console.log(`[Bestiary Automator] API refill completed: final stamina = ${finalStamina}`);
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
  if (!config.autoRefillStamina) return;
  
  // Use API method if enabled, otherwise use DOM method
  if (config.useApiForStaminaRefill) {
    await refillStaminaViaAPI();
    return;
  }
  
  // Existing DOM-based method (unchanged)
  try {
    const elStamina = document.querySelector('[title="Stamina"]');
    if (!elStamina) return;
    
    const staminaElement = elStamina.querySelector('span span');
    if (!staminaElement) return;
    
    const stamina = Number(staminaElement.textContent);
    if (stamina >= config.minimumStaminaWithoutRefill) return;
    
    console.log(`[Bestiary Automator] Refilling stamina: current=${stamina}, minimum=${config.minimumStaminaWithoutRefill}`);
    
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


// Check if user has any stamina potions in inventory
const hasStaminaPotions = () => {
  try {
    if (!globalThis.state || !globalThis.state.player) {
      return false;
    }
    
    const playerContext = globalThis.state.player.getSnapshot().context;
    const inventory = playerContext.inventory || {};
    
    // Check all potion tiers (1-4)
    for (let tier = 1; tier <= 4; tier++) {
      const potionKey = `stamina${tier}`;
      if (inventory[potionKey] && inventory[potionKey] > 0) {
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig));
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
        return originalFetch.apply(this, args).then(async response => {
          // Check for client/server errors (400, 401, 403, 404)
          if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404) {
            console.log(`[Bestiary Automator] ${response.status} error detected for stamina potion API`);
            
            // Try to extract potion tier from request body
            let potionTier = 1; // Default to tier 1
            try {
              if (options.body) {
                const requestBody = JSON.parse(options.body);
                console.log('[Bestiary Automator] Request body for tier detection:', requestBody);
                
                // Try different possible structures for tier
                if (requestBody['0'] && requestBody['0'].json) {
                  const jsonData = requestBody['0'].json;
                  if (jsonData.rarity) {
                    // Game uses 'rarity' field to indicate potion tier
                    potionTier = jsonData.rarity;
                  } else if (jsonData.tier) {
                    potionTier = jsonData.tier;
                  } else if (jsonData.potionTier) {
                    potionTier = jsonData.potionTier;
                  } else if (jsonData.type && jsonData.type.includes('stamina')) {
                    // Try to extract tier from type field like "stamina2"
                    const tierMatch = jsonData.type.match(/stamina(\d+)/);
                    if (tierMatch) {
                      potionTier = parseInt(tierMatch[1]);
                    }
                  }
                }
                
                console.log(`[Bestiary Automator] Detected potion tier: ${potionTier}`);
              }
            } catch (parseError) {
              console.warn('[Bestiary Automator] Could not parse request body for potion tier, using default tier 1:', parseError);
            }
            
            // Remove the potion from local inventory immediately
            removeStaminaPotionFromInventory(potionTier);
          }
          
          return response;
        }).catch(error => {
          console.error('[Bestiary Automator] Error in fetch interceptor:', error);
          throw error;
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
    
    console.log(`[Bestiary Automator] Taking rewards at level ${currentLevel}`);
    
    // Signal to other mods that we're collecting rewards (for coordination)
    try {
      window.__modCoordination = window.__modCoordination || {};
      window.__modCoordination.automatorCollectingRewards = true;
      console.log('[Bestiary Automator] Set automatorCollectingRewards flag - other mods should pause');
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
    await sleep(500);
    clickButtonWithText('mods.automator.collect');
    await sleep(500);
    clickAllCloseButtons();
    await sleep(500);
    
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
      console.log('[Bestiary Automator] Cleared automatorCollectingRewards flag - other mods can resume');
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
      await sleep(500); // Wait for quest log to open
      
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
        await sleep(500);
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
    for (let i = 0; i < 3; i++) {
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(escEvent);
      await sleep(50);
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
  if (window.__modCoordination?.boardAnalyzerRunning) return;
  
  try {
    // Signal to other mods that we're handling daycare (for coordination)
    try {
      window.__modCoordination = window.__modCoordination || {};
      window.__modCoordination.automatorHandlingDaycare = true;
      console.log('[Bestiary Automator] Set automatorHandlingDaycare flag - other mods should pause');
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
    
    console.log('[Bestiary Automator] Found', blipElements.length, 'daycare creatures with data-blip="true"');
    
    // Check for daycare button with visual indicator
    const dayCareButton = document.querySelector('button:has(img[alt="daycare"]), button:has(img[alt="Daycare"])');
    let hasDayCareButtonIndicator = false;
    
    if (dayCareButton) {
      if (dayCareButton.classList.contains('focus-style-visible') && dayCareButton.classList.contains('active:opacity-70')) {
        hasDayCareButtonIndicator = true;
        console.log('[Bestiary Automator] Daycare button has visual indicator');
      }
    } else {
      console.log('[Bestiary Automator] No daycare button found');
    }
    
    // Look for creatures that are actually in daycare slots (have both creature and daycare images)
    const creatureAtDaycare = document.querySelector('div[data-blip="true"]:has(img[alt="creature"]):has(img[alt="daycare"]), div[data-blip="true"]:has(img[alt="creature"]):has(img[alt="Daycare"])');
    
    if (creatureAtDaycare) {
      console.log('[Bestiary Automator] Found creature at daycare with blip');
      
      // Check if this specific creature is ready (not max level)
      const isRedBlip = creatureAtDaycare.querySelector('.text-invalid');
      const isGreenBlip = creatureAtDaycare.querySelector('.text-expBar');
      const maxLevelText = creatureAtDaycare.querySelector('span[data-state="closed"]');
      
      if (isRedBlip || maxLevelText?.textContent?.includes('Max')) {
        console.log('[Bestiary Automator] Creature is at max level, not ready');
      } else if (isGreenBlip) {
        console.log('[Bestiary Automator] Creature is ready for level up!');
      }
    } else {
      console.log('[Bestiary Automator] No creature at daycare with blip found');
    }
    
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
          console.log(`[Bestiary Automator] Creature ${i + 1} is ready for level up!`);
          foundReadyCreature = true;
        } else if (isRedBlip || maxLevelText?.textContent?.includes('Max')) {
          console.log(`[Bestiary Automator] Creature ${i + 1} is at max level, needs ejection`);
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
    await sleep(500);
    
    // Double-check after opening inventory
    const dayCareButtonAfter = document.querySelector('button:has(img[alt="daycare"]), button:has(img[alt="Daycare"])');
    if (!dayCareButtonAfter) return;
    
    dayCareButtonAfter.click();
    await sleep(500);
    
    // Handle all creatures that can level up in one session
    let levelUpCount = 0;
    const maxLevelUps = 4; // Maximum 4 creatures can be in daycare
    
    while (levelUpCount < maxLevelUps) {
      console.log(`[Bestiary Automator] === Level up attempt ${levelUpCount + 1} ===`);
      
      // Check if there are any creatures ready to level up
      const readyCreatures = document.querySelectorAll('[data-blip="true"]');
      let foundReadyCreature = false;
      let readyCreatureCount = 0;
      
      console.log(`[Bestiary Automator] Checking ${readyCreatures.length} blip elements for ready creatures...`);
      
      for (let i = 0; i < readyCreatures.length; i++) {
        const creature = readyCreatures[i];
        const daycareImg = creature.querySelector('img[alt="daycare"], img[alt="Daycare"]');
        
        if (daycareImg) {
          const isRedBlip = creature.querySelector('.text-invalid');
          const isGreenBlip = creature.querySelector('.text-expBar');
          const maxLevelText = creature.querySelector('span[data-state="closed"]');
          
          console.log(`[Bestiary Automator] Creature ${i + 1} in daycare modal:`);
          console.log(`[Bestiary Automator] - Red blip:`, !!isRedBlip);
          console.log(`[Bestiary Automator] - Green blip:`, !!isGreenBlip);
          console.log(`[Bestiary Automator] - Max text:`, maxLevelText?.textContent);
          
          if (isGreenBlip && !isRedBlip && !maxLevelText?.textContent?.includes('Max')) {
            console.log(`[Bestiary Automator] Creature ${i + 1} is ready for level up!`);
            foundReadyCreature = true;
            readyCreatureCount++;
          } else {
            console.log(`[Bestiary Automator] Creature ${i + 1} is not ready`);
          }
        }
      }
      
      console.log(`[Bestiary Automator] Found ${readyCreatureCount} creatures ready for level up`);
      
      if (!foundReadyCreature) {
        console.log('[Bestiary Automator] No more creatures ready for level up, stopping');
        break;
      }
      
      // Click level up
      console.log('[Bestiary Automator] Attempting to click level up button...');
      const levelUpClicked = clickButtonWithText('mods.automator.levelUp');
      
      if (!levelUpClicked) {
        console.log('[Bestiary Automator] Level up button not found, stopping');
        break;
      }
      
      levelUpCount++;
      console.log(`[Bestiary Automator] Successfully clicked level up for creature ${levelUpCount}`);
      
      // Wait for the level up to process
      console.log('[Bestiary Automator] Waiting 1 second for level up to process...');
      await sleep(1000);
      
      console.log(`[Bestiary Automator] Level up ${levelUpCount} completed`);
    }
    
    console.log(`[Bestiary Automator] Completed ${levelUpCount} level ups`);
    
    // Handle ejection of maxed creatures
    if (foundMaxedCreature) {
      console.log('[Bestiary Automator] Starting maxed creature ejection process');
      
      let ejectionCount = 0;
      const maxEjections = 4; // Maximum 4 creatures can be in daycare
      
      while (ejectionCount < maxEjections) {
        console.log(`[Bestiary Automator] === Ejection attempt ${ejectionCount + 1} ===`);
        
        // Check if there are any maxed creatures that need ejection
        // Look for daycare slot containers that contain maxed creatures
        const daycareSlots = document.querySelectorAll('div.relative.flex.items-center.gap-2');
        let foundMaxedCreatureInModal = false;
        let maxedCreatureWithdrawButton = null;
        
        console.log(`[Bestiary Automator] Checking ${daycareSlots.length} daycare slots for maxed creatures...`);
        
        for (let i = 0; i < daycareSlots.length; i++) {
          const slot = daycareSlots[i];
          // Check if this slot has a maxed creature (has "Max" text)
          const maxLevelText = slot.querySelector('span[data-state="closed"]');
          const withdrawButton = slot.querySelector('button[title="Withdraw"]');
          
          console.log(`[Bestiary Automator] Daycare slot ${i + 1}:`);
          console.log(`[Bestiary Automator] - Max text:`, maxLevelText?.textContent);
          console.log(`[Bestiary Automator] - Withdraw button:`, !!withdrawButton);
          
          if (maxLevelText?.textContent?.includes('Max') && withdrawButton) {
            console.log(`[Bestiary Automator] Daycare slot ${i + 1} has maxed creature, ejecting!`);
            foundMaxedCreatureInModal = true;
            maxedCreatureWithdrawButton = withdrawButton;
            break; // Found one to eject, break and process it
          }
        }
        
        if (!foundMaxedCreatureInModal || !maxedCreatureWithdrawButton) {
          console.log('[Bestiary Automator] No more maxed creatures to eject, stopping');
          break;
        }
        
        // Click the withdraw button for the specific maxed creature
        console.log('[Bestiary Automator] Clicking withdraw button for maxed creature...');
        maxedCreatureWithdrawButton.click();
        
        ejectionCount++;
        console.log(`[Bestiary Automator] Successfully ejected creature ${ejectionCount}`);
        
        // Wait for the ejection to process
        console.log('[Bestiary Automator] Waiting 1 second for ejection to process...');
        await sleep(1000);
        
        console.log(`[Bestiary Automator] Ejection ${ejectionCount} completed`);
      }
      
      console.log(`[Bestiary Automator] Completed ${ejectionCount} ejections`);
    }
    
    // Close the modal after handling all creatures
    clickAllCloseButtons();
    await sleep(500);
    
    // Check for scroll lock after daycare operations
    await handleScrollLock();
    
    // Clear the flag after daycare is complete
    try {
      window.__modCoordination.automatorHandlingDaycare = false;
      console.log('[Bestiary Automator] Cleared automatorHandlingDaycare flag - other mods can resume');
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
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'),
            ...configToSave
          }));
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
                console.log('[Bestiary Automator] Defeat toast detected via MutationObserver!');
                // Process immediately without debouncing
                processDefeatToast();
                return; // Exit early since we found a defeat toast
              }
              
              // Check for battle ongoing toasts (network issues)
              if (isBattleOngoingToast(node)) {
                console.log('[Bestiary Automator] Battle ongoing toast detected via MutationObserver!');
                // Process immediately without debouncing
                const toastText = getToastText(node);
                processBattleOngoingToast(toastText);
                return; // Exit early since we found a battle ongoing toast
              }
              
              // Check for "Something went wrong" toasts
              if (isSomethingWrongToast(node)) {
                console.log('[Bestiary Automator] Something went wrong toast detected via MutationObserver!');
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
                  console.log('[Bestiary Automator] Defeat toast found in child elements via MutationObserver!');
                  processDefeatToast();
                  return;
                }
              }
              
              // Check child elements for battle ongoing toasts
              const battleToast = node.querySelector && node.querySelector('div.widget-bottom.pixel-font-16.flex.items-center.gap-2.px-2.py-1.text-whiteHighlight');
              if (battleToast && battleToast.textContent.includes('Battle still ongoing') && battleToast.textContent.includes('ms diff')) {
                console.log('[Bestiary Automator] Battle ongoing toast found in child elements via MutationObserver!');
                const toastText = getToastText(battleToast);
                processBattleOngoingToast(toastText);
                return;
              }
              
              // Check child elements for "Something went wrong" toasts
              const somethingWrongToast = node.querySelector && node.querySelector('div.widget-bottom.pixel-font-16.flex.items-center.gap-2.px-2.py-1.text-whiteHighlight');
              if (somethingWrongToast && somethingWrongToast.textContent.includes('Something went wrong')) {
                console.log('[Bestiary Automator] Something went wrong toast found in child elements via MutationObserver!');
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
    if (window.__modCoordination && window.__modCoordination.boardAnalyzerRunning) {
      console.log('[Bestiary Automator] Board Analyzer is running, skipping all automation tasks');
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
  const fasterAutoplayWarningText = config.currentLocale === 'pt' 
    ? '⚠️ Remove o tempo de espera de 3 segundos entre ações de autoplay. Pode causar comportamento inesperado ou conflitos com outros mods.'
    : '⚠️ Removes the 3-second delay between autoplay actions. May cause unexpected behavior or conflicts with other mods.';
  
  const fasterAutoplayContainer = createCheckboxContainerWithWarning('faster-autoplay-checkbox', t('mods.automator.fasterAutoplay'), config.fasterAutoplay, fasterAutoplayWarningText);
  
  
  // Add all elements to content
  content.appendChild(refillContainer);
  content.appendChild(staminaContainer);
  content.appendChild(rewardsContainer);
  content.appendChild(dayCareContainer);
  content.appendChild(autoPlayContainer);
  content.appendChild(fasterAutoplayContainer);
  
  // Update checkboxes with current config values after creation
  setTimeout(() => {
    const refillCheckbox = document.getElementById('auto-refill-checkbox');
    const rewardsCheckbox = document.getElementById('auto-rewards-checkbox');
    const dayCareCheckbox = document.getElementById('auto-daycare-checkbox');
    const autoPlayCheckbox = document.getElementById('auto-play-defeat-checkbox');
    const fasterAutoplayCheckbox = document.getElementById('faster-autoplay-checkbox');
    const staminaInput = document.getElementById('min-stamina-input');
    
    if (refillCheckbox) {
      refillCheckbox.checked = config.autoRefillStamina; // Show current state
      // Add event listener to update config when checkbox changes (button styling only updates on save)
      refillCheckbox.addEventListener('change', () => {
        config.autoRefillStamina = refillCheckbox.checked;
        console.log('[Bestiary Automator] Checkbox manually changed to:', refillCheckbox.checked);
      });
    }
    if (rewardsCheckbox) rewardsCheckbox.checked = config.autoCollectRewards;
    if (dayCareCheckbox) dayCareCheckbox.checked = config.autoDayCare;
    if (autoPlayCheckbox) autoPlayCheckbox.checked = config.autoPlayAfterDefeat;
    if (fasterAutoplayCheckbox) fasterAutoplayCheckbox.checked = config.fasterAutoplay;
    if (staminaInput) staminaInput.value = config.minimumStaminaWithoutRefill;
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
        text: t('mods.automator.saveButton'),
        primary: true,
        onClick: () => {
          // Update configuration from form values
          const refillCheckbox = document.getElementById('auto-refill-checkbox');
          config.autoRefillStamina = refillCheckbox ? refillCheckbox.checked : false;
          
          // Validate stamina input
          const staminaInput = document.getElementById('min-stamina-input');
          const staminaValue = parseInt(staminaInput.value, 10);
          if (isNaN(staminaValue) || staminaValue < 1 || staminaValue > 360) {
            showNotification('Minimum stamina must be between 1 and 360', 'error');
            staminaInput.focus();
            return;
          }
          config.minimumStaminaWithoutRefill = staminaValue;
          
          config.autoCollectRewards = document.getElementById('auto-rewards-checkbox').checked;
          config.autoDayCare = document.getElementById('auto-daycare-checkbox').checked;
          config.autoPlayAfterDefeat = document.getElementById('auto-play-defeat-checkbox').checked;
          config.fasterAutoplay = document.getElementById('faster-autoplay-checkbox').checked;
          
          // Reset autoplay delay based on Faster Autoplay setting
          try {
            if (config.fasterAutoplay) {
              // Set autoplay delay to 0 for instant execution
              globalThis.state.clientConfig.trigger.setState({
                fn: (prev) => ({
                  ...prev,
                  autoplayDelayMs: 0
                }),
              });
              
              console.log(`[Bestiary Automator] Faster Autoplay enabled - set autoplay delay to 0ms`);
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
          
          // Save configuration
          const configToSave = {
            enabled: config.enabled,
            autoRefillStamina: config.autoRefillStamina,
            minimumStaminaWithoutRefill: config.minimumStaminaWithoutRefill,
            autoCollectRewards: config.autoCollectRewards,
            autoDayCare: config.autoDayCare,
            autoPlayAfterDefeat: config.autoPlayAfterDefeat,
            fasterAutoplay: config.fasterAutoplay,
            persistAutoRefillOnRefresh: config.persistAutoRefillOnRefresh
          };
          
          console.log('[Bestiary Automator] Attempting to save config:', configToSave);
          
          // Save to localStorage
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(configToSave));
            console.log('[Bestiary Automator] Config saved to localStorage successfully');
          } catch (error) {
            console.error('[Bestiary Automator] Error saving config to localStorage:', error);
          }
          
          // Skip API save to prevent reload/reinitialization issues
          console.log('[Bestiary Automator] Skipping API save to prevent reload issues');
          
          // Only start automation if it's not already running (prevents redundant initialization)
          if (!automationInterval) {
            startAutomation();
          }
          
          // Update game state subscription based on autoplay setting
          if (config.autoPlayAfterDefeat) {
            subscribeToGameState();
          } else {
            unsubscribeFromGameState();
          }
          
          // Only update button styling if configuration actually changed
          updateAutomatorButton();
          
          showNotification(t('mods.automator.settingsSaved'), 'success');
        }
      },
      {
        text: t('mods.automator.closeButton'),
        primary: false
      }
    ]
  });
  
  // Helper to create a checkbox container
  function createCheckboxContainer(id, label, checked) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; margin: 5px 0;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = checked;
    checkbox.style.cssText = 'width: 16px; height: 16px; margin-right: 10px;';
    
    const labelElement = document.createElement('label');
    labelElement.htmlFor = id;
    labelElement.textContent = label;
    
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
  
  // Helper to create a checkbox container with info icon and tooltip
  function createCheckboxContainerWithInfo(id, label, checked, infoText) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; margin: 5px 0;';
    
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
    labelElement.style.cssText = 'flex: 1;';
    
    container.appendChild(checkbox);
    container.appendChild(infoIcon);
    container.appendChild(labelElement);
    
    return container;
  }

  // Helper to create a checkbox container with warning symbol and tooltip
  function createCheckboxContainerWithWarning(id, label, checked, warningText) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; margin: 5px 0;';
    
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
    labelElement.style.cssText = 'flex: 1; color: #ff4444; font-weight: bold;';
    
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
    boardAnalyzerRunning: window.__modCoordination && window.__modCoordination.boardAnalyzerRunning
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
      
      // Add event listener to update config when checkbox changes (if not already added) - button styling only updates on save
      if (!refillCheckbox.hasAttribute('data-listener-added')) {
        refillCheckbox.addEventListener('change', () => {
          config.autoRefillStamina = refillCheckbox.checked;
          console.log('[Bestiary Automator] Checkbox manually changed to:', refillCheckbox.checked);
        });
        refillCheckbox.setAttribute('data-listener-added', 'true');
      }
    } else {
      console.log('[Bestiary Automator] Autorefill stamina checkbox not found!');
    }
    
    if (rewardsCheckbox) rewardsCheckbox.checked = config.autoCollectRewards;
    if (dayCareCheckbox) dayCareCheckbox.checked = config.autoDayCare;
    if (autoPlayCheckbox) autoPlayCheckbox.checked = config.autoPlayAfterDefeat;
    if (fasterAutoplayCheckbox) fasterAutoplayCheckbox.checked = config.fasterAutoplay;
    if (staminaInput) staminaInput.value = config.minimumStaminaWithoutRefill;
    
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
  setupSeashellTimer: setupSeashellTimer
};

// Also expose globally for other mods to access
window.bestiaryAutomator = context.exports; 