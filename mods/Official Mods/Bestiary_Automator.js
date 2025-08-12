// Bestiary Automator Mod for Bestiary Arena
// Code by MathiasBynens and TheMegafuji

// Enable debug mode (set to false for production)
window.DEBUG = false;

if (window.DEBUG) console.log('Bestiary Automator initializing...');

// Configuration with defaults
const defaultConfig = {
  enabled: false,
  autoRefillStamina: false,
  minimumStaminaWithoutRefill: 15,
  autoCollectRewards: false,
  autoDayCare: false,
  autoPlayAfterDefeat: false,
  currentLocale: document.documentElement.lang === 'pt' || 
    document.querySelector('html[lang="pt"]') || 
    window.location.href.includes('/pt/') ? 'pt' : 'en'
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
      return Object.assign({}, defaultConfig, savedConfig);
    }
  } catch (error) {
    if (window.DEBUG) console.error('[Bestiary Automator] Error loading config:', error);
  }
  
  // Fallback to context or defaults
  return Object.assign({}, defaultConfig, context.config || {});
};

config = loadConfig();
// Always force autoRefillStamina to false for safety
config.autoRefillStamina = false;

// Constants
const MOD_ID = 'bestiary-automator';
const BUTTON_ID = `${MOD_ID}-button`;
const CONFIG_BUTTON_ID = `${MOD_ID}-config-button`;
const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;

// Translations
const TRANSLATIONS = {
  en: {
    buttonTooltip: 'Bestiary Automator',
    configButtonTooltip: 'Automator Settings',
    modalTitle: 'Bestiary Automator Settings',
    enabled: 'Enable Automation',
    autoRefillStamina: 'Auto Refill Stamina',
    minimumStaminaLabel: 'Minimum Stamina Without Refill',
    autoCollectRewards: 'Auto Collect Rewards',
    autoDayCare: 'Auto Handle Day Care',
    autoPlayAfterDefeat: 'Autoplay after defeat',
    saveButton: 'Save Settings',
    closeButton: 'Close',
    statusEnabled: 'Automator Enabled',
    statusDisabled: 'Automator Disabled',
    settingsSaved: 'Settings saved successfully!',
    // Game-specific translations
    usePotion: 'Use potion (1)',
    close: 'Close',
    collect: 'Collect',
    inventory: 'Inventory',
    levelUp: 'Level up'
  },
  pt: {
    buttonTooltip: 'Automatizador do Bestiário',
    configButtonTooltip: 'Configurações do Automatizador',
    modalTitle: 'Configurações do Automatizador',
    enabled: 'Ativar Automação',
    autoRefillStamina: 'Reabastecimento Automático de Stamina',
    minimumStaminaLabel: 'Stamina Mínima Sem Reabastecimento',
    autoCollectRewards: 'Coletar Recompensas Automaticamente',
    autoDayCare: 'Cuidar Automaticamente da Creche',
    autoPlayAfterDefeat: 'Jogar automaticamente após derrota',
    saveButton: 'Salvar Configurações',
    closeButton: 'Fechar',
    statusEnabled: 'Automatizador Ativado',
    statusDisabled: 'Automatizador Desativado',
    settingsSaved: 'Configurações salvas com sucesso!',
    // Game-specific translations
    usePotion: 'Usar poção (1)',
    close: 'Fechar',
    collect: 'Resgatar',
    inventory: 'Inventário',
    levelUp: 'Level up'
  }
};

// Get translation based on current locale
function t(key) {
  const locale = config.currentLocale;
  const translations = TRANSLATIONS[locale] || TRANSLATIONS.en;
  return translations[key] || key;
}

// Helper functions for automation

// Cache for frequently accessed elements
const elementCache = new Map();
const CACHE_TTL = 5000; // 5 seconds

// Clear expired cache entries
const clearExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of elementCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      elementCache.delete(key);
    }
  }
};

// Find button with specific text (considering language differences)
const findButtonWithText = (textKey) => {
  const text = t(textKey);
  const cacheKey = `button:${textKey}:${text}`;
  
  // Check cache first
  const cached = elementCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    if (cached.element && document.contains(cached.element)) {
      return cached.element;
    }
  }
  
  // Clear expired cache entries periodically
  if (Math.random() < 0.1) clearExpiredCache();
  
  const buttons = document.querySelectorAll('button');
  
  for (const button of buttons) {
    const buttonText = button.textContent.trim();
    
    // Check exact text match first
    if (buttonText === text) {
      elementCache.set(cacheKey, { element: button, timestamp: Date.now() });
      return button;
    }
    
    // Check if text is contained within the button (for complex buttons)
    if (buttonText.includes(text)) {
      elementCache.set(cacheKey, { element: button, timestamp: Date.now() });
      return button;
    }
  }
  
  return null;
};

// Click button with specific text
const clickButtonWithText = (textKey) => {
  const button = findButtonWithText(textKey);
  if (button) {
    if (window.DEBUG) console.log(`[Bestiary Automator] Clicking button: "${textKey}" (${button.textContent.trim()})`);
    button.click();
    return true;
  }
  if (window.DEBUG) console.log(`[Bestiary Automator] Button not found: "${textKey}"`);
  return false;
};

// Check and handle scroll lock
const handleScrollLock = () => {
  try {
    const body = document.body;
    const scrollLockValue = body.getAttribute('data-scroll-locked');
    
    if (scrollLockValue && parseInt(scrollLockValue) > 0) {
      if (window.DEBUG) console.log(`[Bestiary Automator] Scroll lock detected (${scrollLockValue}), simulating ESC key`);
      
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
      return true;
    }
    
    return false;
  } catch (error) {
    if (window.DEBUG) console.error('[Bestiary Automator] Error handling scroll lock:', error);
    return false;
  }
};

// Click all Close buttons
const clickAllCloseButtons = () => {
  const closeButtons = document.querySelectorAll('button');
  let clickedCount = 0;
  
  for (const button of closeButtons) {
    const buttonText = button.textContent.trim();
    if (buttonText === 'Close' || buttonText === 'Fechar') {
      if (window.DEBUG) console.log(`[Bestiary Automator] Clicking close button: "${buttonText}"`);
      button.click();
      clickedCount++;
    }
  }
  
  if (window.DEBUG && clickedCount > 0) {
    console.log(`[Bestiary Automator] Clicked ${clickedCount} close button(s)`);
  }
  
  return clickedCount > 0;
};

// Utility function for waiting with cancellation support
let timeoutId;
let currentTask = null;

const sleep = (timeout = 1000) => {
  return new Promise((resolve, reject) => {
    const taskId = Date.now() + Math.random();
    currentTask = taskId;
    
    timeoutId = setTimeout(() => {
      if (currentTask === taskId) {
        resolve();
      }
    }, timeout);
  });
};

// Cancel current async operations
const cancelCurrentTask = () => {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  currentTask = null;
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
    buttons: [{ text: t('closeButton'), primary: true }]
  });
}

// Automation Tasks

// Stamina refill retry tracking
let staminaRefillRetryCount = 0;
let staminaRefillRetryTimeout = null;
let lastStaminaRefillAttempt = 0;

// Check if game is in a state where automation should run
const isGameActive = () => {
  try {
    // Check if document is visible and focused
    if (document.hidden) return false;
    
    // Check if Game State API is available
    if (!globalThis.state || !globalThis.state.board) {
      if (window.DEBUG) console.log('[Bestiary Automator] Game State API not available');
      return false;
    }
    
    const boardContext = globalThis.state.board.getSnapshot().context;
    
    // Only run automation if a game is started and active
    if (!boardContext.gameStarted) {
      if (window.DEBUG) console.log('[Bestiary Automator] No active game detected');
      return false;
    }
    
    // Check if we're in a playable mode (not in menus/dialogs)
    if (boardContext.openMapPicker) {
      if (window.DEBUG) console.log('[Bestiary Automator] Map picker is open');
      return false;
    }
    
    return true;
  } catch (error) {
    if (window.DEBUG) console.error('[Bestiary Automator] Error checking game state:', error);
    return false;
  }
};

// Check if game is ready for stamina refill
const isGameReadyForStaminaRefill = () => {
  try {
    // Check if document is visible and focused
    if (document.hidden) return false;
    
    // Check if stamina element exists and is visible
    const elStamina = document.querySelector('[title="Stamina"]');
    if (!elStamina || !elStamina.offsetParent) return false;
    
    // Check if stamina value is readable
    const staminaElement = elStamina.querySelector('span span');
    if (!staminaElement || !staminaElement.textContent) return false;
    
    // Check if a game is actually active using Game State API
    if (globalThis.state && globalThis.state.board) {
      const boardContext = globalThis.state.board.getSnapshot().context;
      
      // Only check stamina if a game is started and active
      if (!boardContext.gameStarted) {
        if (window.DEBUG) console.log('[Bestiary Automator] No active game detected');
        return false;
      }
      
      // Check if we're in a playable mode (not in menus/dialogs)
      if (boardContext.openMapPicker) {
        if (window.DEBUG) console.log('[Bestiary Automator] Map picker is open');
        return false;
      }
    }
    
    return true;
  } catch (error) {
    if (window.DEBUG) console.error('[Bestiary Automator] Error checking game readiness:', error);
    return false;
  }
};

// Refill stamina if needed with retry logic
const refillStaminaIfNeeded = async () => {
  if (!config.autoRefillStamina) return;
  
  // Prevent rapid retries
  const now = Date.now();
  if (now - lastStaminaRefillAttempt < 1000) return;
  lastStaminaRefillAttempt = now;
  
  try {
    // Check if game is ready
    if (!isGameReadyForStaminaRefill()) {
      if (window.DEBUG) console.log('[Bestiary Automator] Game not ready for stamina refill, will retry');
      return;
    }
    
    const elStamina = document.querySelector('[title="Stamina"]');
    const staminaElement = elStamina.querySelector('span span');
    const stamina = Number(staminaElement.textContent);
    
    if (stamina >= config.minimumStaminaWithoutRefill) {
      // Reset retry count on successful check
      staminaRefillRetryCount = 0;
      return;
    }
    
    if (window.DEBUG) console.log(`[Bestiary Automator] Refilling stamina: current=${stamina}, minimum=${config.minimumStaminaWithoutRefill}, retry=${staminaRefillRetryCount}`);
    
    // Attempt refill
    elStamina.click();
    await sleep(200); // Reduced from 500ms
    
    const usePotionClicked = clickButtonWithText('usePotion');
    if (!usePotionClicked) {
      throw new Error('Use potion button not found');
    }
    
    await sleep(300); // Reduced from 1000ms - stamina updates quickly
    
    // Check stamina again before closing
    const newStaminaElement = document.querySelector('[title="Stamina"] span span');
    if (newStaminaElement) {
      const newStamina = Number(newStaminaElement.textContent);
      if (newStamina < config.minimumStaminaWithoutRefill) {
        if (window.DEBUG) console.log(`[Bestiary Automator] Stamina still low after refill: ${newStamina}, attempting another refill`);
        // Don't close yet, let the loop try again
        return;
      }
    }
    
    // Only close if stamina is sufficient
    clickAllCloseButtons();
    await sleep(200); // Reduced from 500ms
    
    // Check for scroll lock after using potion
    handleScrollLock();
    
    // Reset retry count on success
    staminaRefillRetryCount = 0;
    
  } catch (error) {
    if (window.DEBUG) console.error('[Bestiary Automator] Error refilling stamina:', error);
    
    // Implement exponential backoff retry
    staminaRefillRetryCount++;
    if (staminaRefillRetryCount <= 3) {
      const retryDelay = Math.pow(2, staminaRefillRetryCount) * 1000; // 2s, 4s, 8s
      
      if (window.DEBUG) console.log(`[Bestiary Automator] Scheduling retry in ${retryDelay}ms (attempt ${staminaRefillRetryCount})`);
      
      clearTimeout(staminaRefillRetryTimeout);
      staminaRefillRetryTimeout = setTimeout(() => {
        refillStaminaIfNeeded();
      }, retryDelay);
    } else {
      if (window.DEBUG) console.log('[Bestiary Automator] Max retry attempts reached, giving up');
      staminaRefillRetryCount = 0;
    }
  }
};

// Take rewards if available
const takeRewardsIfAvailable = async () => {
  if (!config.autoCollectRewards) return;
  
  try {
    const available = document.querySelector('button[aria-haspopup="menu"]:has(.animate-ping)');
    if (!available) return;
    
    if (window.DEBUG) console.log('[Bestiary Automator] Taking rewards');
    
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
    clickButtonWithText('collect');
    await sleep(500);
    clickAllCloseButtons();
    await sleep(500);
    
    // Check for scroll lock after collecting rewards
    handleScrollLock();
  } catch (error) {
    if (window.DEBUG) console.error('[Bestiary Automator] Error taking rewards:', error);
  }
};

// Handle day care
const handleDayCare = async () => {
  if (!config.autoDayCare) return;
  
  try {
    const dayCareBlip = document.querySelector('div[data-radix-scroll-area-viewport]:has(div:not(.text-invalid) > .animate-ping)');
    if (!dayCareBlip) return;
    
    if (window.DEBUG) console.log('[Bestiary Automator] Handling day care');
    
    clickButtonWithText('inventory');
    await sleep(500);
    
    const button = document.querySelector('button:has(img[alt=daycare])');
    if (!button) return;
    
    button.click();
    await sleep(500);
    clickButtonWithText('levelUp');
    await sleep(500);
    clickAllCloseButtons();
    await sleep(500);
  } catch (error) {
    if (window.DEBUG) console.error('[Bestiary Automator] Error handling day care:', error);
  }
};

// Update minimum stamina if game shows a stamina requirement
const updateRequiredStamina = () => {
  try {
    const elements = document.querySelectorAll('.action-link');
    for (const element of elements) {
      if (element.textContent !== 'stamina') continue;
      
      const text = element.parentElement.textContent; // 'Not enough stamina (15)'
      const match = text.match(/\((\d+)\)/);
      if (!match) continue;
      
      const staminaRequired = Number(match[1]);
      if (
        (config.minimumStaminaWithoutRefill !== staminaRequired) &&
        (3 <= staminaRequired && staminaRequired <= 18)
      ) {
        config.minimumStaminaWithoutRefill = staminaRequired;
        if (window.DEBUG) console.log(`[Bestiary Automator] Setting minimum stamina without refill to ${staminaRequired}`);
        
        // Save the new value to config
        api.service.updateScriptConfig(context.hash, { 
          minimumStaminaWithoutRefill: config.minimumStaminaWithoutRefill 
        });
        
        return;
      }
    }
  } catch (error) {
    if (window.DEBUG) console.error('[Bestiary Automator] Error updating required stamina:', error);
  }
};

// Main automation loop
let automationInterval = null;
let gameStateObserver = null;
let defeatToastCooldown = false;
let focusEventListeners = null;

// Subscribe to board game state changes
const subscribeToGameState = () => {
  if (!config.autoPlayAfterDefeat) return;
  
  try {
    // Subscribe to game state changes
    if (api.game && api.game.subscribeToState) {
      gameStateObserver = api.game.subscribeToState((state) => {
        checkForDefeatToast();
      });
    } else {
      // Fallback: use MutationObserver to watch for DOM changes
      gameStateObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            checkForDefeatToast();
          }
        });
      });
      
      // Start observing the document body for added nodes
      gameStateObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    
    if (window.DEBUG) console.log('[Bestiary Automator] Subscribed to game state changes for autoplay after defeat');
  } catch (error) {
    if (window.DEBUG) console.error('[Bestiary Automator] Error subscribing to game state:', error);
  }
};

// Unsubscribe from game state changes
const unsubscribeFromGameState = () => {
  if (gameStateObserver) {
    if (api.game && api.game.unsubscribeFromState) {
      api.game.unsubscribeFromState(gameStateObserver);
    } else if (gameStateObserver.disconnect) {
      gameStateObserver.disconnect();
    }
    gameStateObserver = null;
    
    if (window.DEBUG) console.log('[Bestiary Automator] Unsubscribed from game state changes');
  }
};

// Check for defeat toast and restart if found
const checkForDefeatToast = async () => {
  if (!config.autoPlayAfterDefeat || defeatToastCooldown) return;
  
  try {
    // Look for the defeat toast
    const defeatToast = document.querySelector('div.widget-bottom.pixel-font-16.flex.items-center.gap-2.px-2.py-1.text-whiteHighlight:has(img[alt="no"])');
    
    if (defeatToast) {
      const toastText = defeatToast.textContent;
      if (toastText.includes('Autoplay stopped because your creatures were') && toastText.includes('defeated')) {
        // Set cooldown to prevent multiple executions
        defeatToastCooldown = true;
        
        if (window.DEBUG) console.log('[Bestiary Automator] Defeat toast detected, waiting 1s then restarting...');
        
        // Wait 1 second
        await sleep(1000);
        
        // Find and click the start button
        const startButtons = document.querySelectorAll('button[data-full="false"][data-state="closed"]');
        let startButton = null;
        
        for (const button of startButtons) {
          if (button.textContent.trim() === 'Start') {
            startButton = button;
            break;
          }
        }
        
        if (startButton) {
          startButton.click();
          if (window.DEBUG) console.log('[Bestiary Automator] Start button clicked after defeat');
        } else {
          if (window.DEBUG) console.log('[Bestiary Automator] Start button not found after defeat');
        }
        
        // Reset cooldown after 3 seconds to allow for future defeats
        setTimeout(() => {
          defeatToastCooldown = false;
          if (window.DEBUG) console.log('[Bestiary Automator] Defeat toast cooldown reset');
        }, 3000);
      }
    }
  } catch (error) {
    if (window.DEBUG) console.error('[Bestiary Automator] Error checking for defeat toast:', error);
  }
};

// Setup focus event listeners
const setupFocusEventListeners = () => {
  if (focusEventListeners) return;
  
  const handleVisibilityChange = () => {
    if (window.DEBUG) console.log(`[Bestiary Automator] Visibility changed: hidden=${document.hidden}`);
    
    if (!document.hidden) {
      // Page became visible, run tasks immediately
      setTimeout(() => {
        runAutomationTasks();
      }, 300); // Reduced delay for faster response
    }
  };
  
  const handleFocus = () => {
    if (window.DEBUG) console.log('[Bestiary Automator] Window gained focus');
    // Run tasks when window gains focus
    setTimeout(() => {
      runAutomationTasks();
    }, 300); // Reduced delay for faster response
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);
  
  focusEventListeners = { handleVisibilityChange, handleFocus };
  
  if (window.DEBUG) console.log('[Bestiary Automator] Focus event listeners setup complete');
};

// Remove focus event listeners
const removeFocusEventListeners = () => {
  if (!focusEventListeners) return;
  
  document.removeEventListener('visibilitychange', focusEventListeners.handleVisibilityChange);
  window.removeEventListener('focus', focusEventListeners.handleFocus);
  focusEventListeners = null;
  
  if (window.DEBUG) console.log('[Bestiary Automator] Focus event listeners removed');
};

const startAutomation = () => {
  if (automationInterval) return;
  
  if (window.DEBUG) console.log('[Bestiary Automator] Starting automation loop');
  
  // Setup focus event listeners
  setupFocusEventListeners();
  
  // Run immediately once
  runAutomationTasks();
  
  // Then set up interval - reduced from 5000ms for faster response
  automationInterval = setInterval(runAutomationTasks, 2000);
  
  // Subscribe to game state for autoplay after defeat
  subscribeToGameState();
};

const stopAutomation = () => {
  if (!automationInterval) return;
  
  if (window.DEBUG) console.log('[Bestiary Automator] Stopping automation loop');
  
  // Clear main interval
  clearInterval(automationInterval);
  automationInterval = null;
  
  // Clear any pending retry timeouts
  if (staminaRefillRetryTimeout) {
    clearTimeout(staminaRefillRetryTimeout);
    staminaRefillRetryTimeout = null;
  }
  
  // Clear global timeout and cancel current task
  cancelCurrentTask();
  
  // Reset retry counters
  staminaRefillRetryCount = 0;
  defeatToastCooldown = false;
  
  // Clear element cache
  elementCache.clear();
  
  // Remove focus event listeners
  removeFocusEventListeners();
  
  // Unsubscribe from game state changes
  unsubscribeFromGameState();
};

const runAutomationTasks = async () => {
  try {
    // Only run automation if game is active
    if (!isGameActive()) {
      return;
    }
    
    await takeRewardsIfAvailable();
    await handleDayCare();
    updateRequiredStamina();
    await refillStaminaIfNeeded();
  } catch (error) {
    if (window.DEBUG) console.error('[Bestiary Automator] Error in automation tasks:', error);
  }
};

// Toggle automation on/off (now only used internally)
const toggleAutomation = () => {
  config.enabled = !config.enabled;
  
  if (config.enabled) {
    startAutomation();
    showNotification(t('statusEnabled'), 'success');
  } else {
    stopAutomation();
    showNotification(t('statusDisabled'), 'info');
  }
  
  // Save the enabled state
  api.service.updateScriptConfig(context.hash, { enabled: config.enabled });
};

// Create the configuration panel
const createConfigPanel = () => {
  const content = document.createElement('div');
  content.style.cssText = 'display: flex; flex-direction: column; gap: 15px;';
  
  // Auto refill stamina checkbox
  const refillContainer = createCheckboxContainer('auto-refill-checkbox', t('autoRefillStamina'), config.autoRefillStamina);
  
  // Minimum stamina input
  const staminaContainer = createNumberInputContainer('min-stamina-input', t('minimumStaminaLabel'), config.minimumStaminaWithoutRefill, 3, 18);
  
  // Auto collect rewards checkbox
  const rewardsContainer = createCheckboxContainer('auto-rewards-checkbox', t('autoCollectRewards'), config.autoCollectRewards);
  
  // Auto day care checkbox
  const dayCareContainer = createCheckboxContainer('auto-daycare-checkbox', t('autoDayCare'), config.autoDayCare);
  
  // Auto play after defeat checkbox
  const autoPlayContainer = createCheckboxContainer('auto-play-defeat-checkbox', t('autoPlayAfterDefeat'), config.autoPlayAfterDefeat);
  
  // Add all elements to content
  content.appendChild(refillContainer);
  content.appendChild(staminaContainer);
  content.appendChild(rewardsContainer);
  content.appendChild(dayCareContainer);
  content.appendChild(autoPlayContainer);
  
  // Update checkboxes with current config values after creation
  setTimeout(() => {
    const refillCheckbox = document.getElementById('auto-refill-checkbox');
    const rewardsCheckbox = document.getElementById('auto-rewards-checkbox');
    const dayCareCheckbox = document.getElementById('auto-daycare-checkbox');
    const autoPlayCheckbox = document.getElementById('auto-play-defeat-checkbox');
    const staminaInput = document.getElementById('min-stamina-input');
    
    if (refillCheckbox) refillCheckbox.checked = config.autoRefillStamina;
    if (rewardsCheckbox) rewardsCheckbox.checked = config.autoCollectRewards;
    if (dayCareCheckbox) dayCareCheckbox.checked = config.autoDayCare;
    if (autoPlayCheckbox) autoPlayCheckbox.checked = config.autoPlayAfterDefeat;
    if (staminaInput) staminaInput.value = config.minimumStaminaWithoutRefill;
  }, 100);
  
  // Create the config panel
  return api.ui.createConfigPanel({
    id: CONFIG_PANEL_ID,
    title: t('modalTitle'),
    modId: MOD_ID,
    content: content,
    buttons: [
      {
        text: t('saveButton'),
        primary: true,
        onClick: () => {
          // Update configuration from form values
          config.autoRefillStamina = document.getElementById('auto-refill-checkbox').checked;
          config.minimumStaminaWithoutRefill = parseInt(document.getElementById('min-stamina-input').value, 10);
          config.autoCollectRewards = document.getElementById('auto-rewards-checkbox').checked;
          config.autoDayCare = document.getElementById('auto-daycare-checkbox').checked;
          config.autoPlayAfterDefeat = document.getElementById('auto-play-defeat-checkbox').checked;
          
          // Save configuration
          const configToSave = {
            autoRefillStamina: config.autoRefillStamina,
            minimumStaminaWithoutRefill: config.minimumStaminaWithoutRefill,
            autoCollectRewards: config.autoCollectRewards,
            autoDayCare: config.autoDayCare,
            autoPlayAfterDefeat: config.autoPlayAfterDefeat
          };
          
          if (window.DEBUG) console.log('[Bestiary Automator] Attempting to save config:', configToSave);
          
          // Save to localStorage
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(configToSave));
            if (window.DEBUG) console.log('[Bestiary Automator] Config saved to localStorage successfully');
          } catch (error) {
            if (window.DEBUG) console.error('[Bestiary Automator] Error saving config to localStorage:', error);
          }
          
          // Also save via the mod config API for compatibility
          if (window.DEBUG) console.log('[Bestiary Automator] Using hash:', context.hash);
          if (window.DEBUG) console.log('[Bestiary Automator] updateScriptConfig available:', !!(api.service && api.service.updateScriptConfig));
          
          try {
            api.service.updateScriptConfig(context.hash, configToSave);
            if (window.DEBUG) console.log('[Bestiary Automator] Config saved via API successfully');
          } catch (error) {
            if (window.DEBUG) console.error('[Bestiary Automator] Error saving config via API:', error);
          }
          
          // Always start automation when settings are saved
          startAutomation();
          
          // Update game state subscription based on autoplay setting
          if (config.autoPlayAfterDefeat) {
            subscribeToGameState();
          } else {
            unsubscribeFromGameState();
          }
          
          // Update button styling based on enabled features
          updateAutomatorButton();
          
          showNotification(t('settingsSaved'), 'success');
        }
      },
      {
        text: t('closeButton'),
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
  function createNumberInputContainer(id, label, value, min, max) {
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
    input.value = value;
    input.style.cssText = 'width: 100%; padding: 5px; background-color: #222; color: #fff; border: 1px solid #444;';
    
    container.appendChild(labelElement);
    container.appendChild(input);
    
    return container;
  }
};

// Create buttons
const createButtons = () => {
  // Check if any automation features are enabled
  const hasEnabledFeatures = config.autoRefillStamina || config.autoCollectRewards || config.autoDayCare || config.autoPlayAfterDefeat;
  
  // Create only the configuration button
  api.ui.addButton({
    id: CONFIG_BUTTON_ID,
    text: 'Automator',
    modId: MOD_ID,
    tooltip: t('configButtonTooltip'),
    primary: hasEnabledFeatures,
    onClick: () => api.ui.toggleConfigPanel(CONFIG_PANEL_ID)
  });
  
  // Apply custom styling based on priority
  setTimeout(() => {
    const btn = document.getElementById(CONFIG_BUTTON_ID);
    if (btn) {
      if (config.autoRefillStamina) {
        // Priority 1: Green background for auto refill stamina
        btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-green.be515334.png') repeat";
        btn.style.backgroundSize = "auto";
        btn.style.color = "#ffffff";
      } else if (config.autoCollectRewards || config.autoDayCare || config.autoPlayAfterDefeat) {
        // Priority 2: Blue background for other auto features
        btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png') repeat";
        btn.style.backgroundSize = "auto";
        btn.style.color = "#ffffff";
      } else {
        // Default: No features enabled
        btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat";
        btn.style.color = "#ffe066";
      }
    }
  }, 100);
};

// Initialize the mod
function init() {
  if (window.DEBUG) console.log('[Bestiary Automator] Initializing UI...');
  
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
  
  if (window.DEBUG) console.log('[Bestiary Automator] Initialization complete');
}

// Initialize the mod
init();

// Update the Automator button style based on enabled features
function updateAutomatorButton() {
  if (api && api.ui) {
    const hasEnabledFeatures = config.autoRefillStamina || config.autoCollectRewards || config.autoDayCare || config.autoPlayAfterDefeat;
    
    api.ui.updateButton(CONFIG_BUTTON_ID, {
      primary: hasEnabledFeatures,
      tooltip: t('configButtonTooltip')
    });
    
    // Apply custom styling based on priority
    const btn = document.getElementById(CONFIG_BUTTON_ID);
    if (btn) {
      if (config.autoRefillStamina) {
        // Priority 1: Green background for auto refill stamina
        btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-green.be515334.png') repeat";
        btn.style.backgroundSize = "auto";
        btn.style.color = "#ffffff";
      } else if (config.autoCollectRewards || config.autoDayCare || config.autoPlayAfterDefeat) {
        // Priority 2: Blue background for other auto features
        btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png') repeat";
        btn.style.backgroundSize = "auto";
        btn.style.color = "#ffffff";
      } else {
        // Default: No features enabled
        btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat";
        btn.style.color = "#ffe066";
      }
    }
  }
}

// Export functionality
context.exports = {
  toggleAutomation,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
    
    // Start or stop automation based on enabled state
    if (config.enabled) {
      startAutomation();
    } else {
      stopAutomation();
    }
    
    // Update button styling
    updateAutomatorButton();
  },
  cleanup: () => {
    // Cleanup function for when mod is disabled
    stopAutomation();
    
    // Clear all caches and timeouts
    elementCache.clear();
    cancelCurrentTask();
    
    if (window.DEBUG) console.log('[Bestiary Automator] Cleanup completed');
  }
}; 