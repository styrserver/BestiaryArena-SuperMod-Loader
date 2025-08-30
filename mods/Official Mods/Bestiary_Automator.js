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
    autoPlayAfterDefeat: 'Autoplay after defeat and network issues',
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
    autoPlayAfterDefeat: 'Jogar automaticamente após derrota e problemas de rede',
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
  // Don't handle scroll lock if Board Analyzer is running
  if (window.__modCoordination && window.__modCoordination.boardAnalyzerRunning) {
    if (window.DEBUG) console.log('[Bestiary Automator] Board Analyzer is running, skipping scroll lock handling');
    return false;
  }
  
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
  // Don't close modals if Board Analyzer is running
  if (window.__modCoordination && window.__modCoordination.boardAnalyzerRunning) {
    if (window.DEBUG) console.log('[Bestiary Automator] Board Analyzer is running, skipping modal close operations');
    return false;
  }
  
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

// Cancellable sleep function for countdowns
const cancellableSleep = (timeout = 1000, checkCancellation = () => false) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      // Check if we should cancel
      if (checkCancellation()) {
        clearInterval(checkInterval);
        resolve('cancelled');
        return;
      }
      
      // Check if time has elapsed
      if (Date.now() - startTime >= timeout) {
        clearInterval(checkInterval);
        resolve('completed');
        return;
      }
    }, 100); // Check every 100ms for cancellation
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

// Cancel current countdown task
const cancelCurrentCountdown = () => {
  if (currentCountdownTask) {
    currentCountdownTask.cancelled = true;
    currentCountdownTask = null;
    countdownCancelled = true;
    // Reset cooldown so system can track toasters again
    battleOngoingToastCooldown = false;
    console.log('[Bestiary Automator] Countdown cancelled due to board state change, cooldown reset');
    console.log('[Bestiary Automator] Ready to detect new toasters');
    console.log('[Bestiary Automator] Note: Main countdown function will complete its sleep and then confirm cancellation');
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
    // Check if Board Analyzer is running - if so, pause automation
    if (window.__modCoordination && window.__modCoordination.boardAnalyzerRunning) {
      if (window.DEBUG) console.log('[Bestiary Automator] Board Analyzer is running, pausing automation');
      return false;
    }
    
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
    // Check if Board Analyzer is running - if so, pause automation
    if (window.__modCoordination && window.__modCoordination.boardAnalyzerRunning) {
      if (window.DEBUG) console.log('[Bestiary Automator] Board Analyzer is running, pausing stamina refill');
      return false;
    }
    
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

// Track if we've already collected rewards for this game session
let rewardsCollectedThisSession = false;

// Take rewards if available - only check at game start
const takeRewardsIfAvailable = async () => {
  if (!config.autoCollectRewards || rewardsCollectedThisSession) return;
  
  try {
    // Check if player has reached the target level for rewards
    const playerContext = globalThis.state.player.getSnapshot().context;
    const currentExp = playerContext.exp;
    
    // Calculate current level from experience
    const currentLevel = globalThis.state.utils.expToCurrentLevel(currentExp);
    
    // Check if there are rewards available by looking for the ping animation
    const available = document.querySelector('button[aria-haspopup="menu"]:has(.animate-ping)');
    if (!available) return;
    
    if (window.DEBUG) console.log(`[Bestiary Automator] Taking rewards at level ${currentLevel}`);
    
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
    
    // Mark rewards as collected for this session
    rewardsCollectedThisSession = true;
    
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
// Only auto-update if user hasn't manually set a custom value
const updateRequiredStamina = () => {
  try {
    // Check if user has manually set a custom value (different from default)
    const hasCustomValue = config.minimumStaminaWithoutRefill !== defaultConfig.minimumStaminaWithoutRefill;
    if (hasCustomValue) {
      if (window.DEBUG) console.log(`[Bestiary Automator] Skipping auto-update - user has custom value: ${config.minimumStaminaWithoutRefill}`);
      return;
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
        if (window.DEBUG) console.log(`[Bestiary Automator] Auto-setting minimum stamina without refill to ${staminaRequired}`);
        
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
          if (window.DEBUG) console.error('[Bestiary Automator] Error saving to localStorage:', error);
        }
        
        try {
          api.service.updateScriptConfig(context.hash, configToSave);
        } catch (error) {
          if (window.DEBUG) console.error('[Bestiary Automator] Error saving via API:', error);
        }
        
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
let battleOngoingToastCooldown = false;
let focusEventListeners = null;
let currentCountdownTask = null;
let countdownCancelled = false;
let processedToastHashes = new Set();

// Subscribe to board game state changes
const subscribeToGameState = () => {
  try {
    // Subscribe to board state changes for new game detection
    if (globalThis.state && globalThis.state.board) {
      globalThis.state.board.on('newGame', (event) => {
        if (window.DEBUG) console.log('[Bestiary Automator] New game detected, resetting rewards collection flag');
        rewardsCollectedThisSession = false;
        // Cancel any ongoing countdown when new game starts
        if (currentCountdownTask) {
          cancelCurrentCountdown();
        }
      });
      
      // Monitor for other board state changes that should cancel countdowns
      globalThis.state.board.on('stateChange', (event) => {
        const boardContext = event.context;
        
        // Cancel countdown if map picker opens (user changing maps)
        if (boardContext.openMapPicker) {
          cancelCurrentCountdown();
        }
        
        // Cancel countdown if game state changes significantly
        if (boardContext.gameStarted !== boardContext.gameStarted) {
          cancelCurrentCountdown();
        }
      });
      
      // Monitor specific game events that should cancel countdowns
      globalThis.state.board.on('emitNewGame', (event) => {
        if (currentCountdownTask) {
          console.log('[Bestiary Automator] Game started during countdown, cancelling...');
          cancelCurrentCountdown();
        }
      });
      
      globalThis.state.board.on('emitEndGame', (event) => {
        if (currentCountdownTask) {
          console.log('[Bestiary Automator] Game ended during countdown, cancelling...');
          cancelCurrentCountdown();
        }
      });
    }
    
    // Subscribe to game state changes for autoplay after defeat
    if (!config.autoPlayAfterDefeat) return;
    
    if (api.game && api.game.subscribeToState) {
      // Add debouncing to prevent excessive calls
      let gameStateToastTimeout = null;
      gameStateObserver = api.game.subscribeToState((state) => {
        // Clear any existing timeout
        if (gameStateToastTimeout) {
          clearTimeout(gameStateToastTimeout);
        }
        
        // Debounce toast checking to prevent spam
        gameStateToastTimeout = setTimeout(() => {
          // Only check if we haven't checked recently
          if (!window.__lastToastCheck || (Date.now() - window.__lastToastCheck > 2000)) {
            window.__lastToastCheck = Date.now();
            handleToasts();
          }
        }, 500); // Wait 500ms after last state change
      });
    } else {
      // Fallback: use MutationObserver to watch for DOM changes
      // Add debouncing to prevent excessive calls
      let toastCheckTimeout = null;
      gameStateObserver = new MutationObserver((mutations) => {
        // Clear any existing timeout
        if (toastCheckTimeout) {
          clearTimeout(toastCheckTimeout);
        }
        
        // Debounce toast checking to prevent spam
        toastCheckTimeout = setTimeout(() => {
          // Only check if we haven't checked recently
          if (!window.__lastToastCheck || (Date.now() - window.__lastToastCheck > 2000)) {
            window.__lastToastCheck = Date.now();
            handleToasts();
          }
        }, 500); // Wait 500ms after last DOM change
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

// Unified toast handler for different types of toasts
const handleToasts = async () => {
  if (!config.autoPlayAfterDefeat) return;
  
  // Early return if battle ongoing cooldown is active to reduce spam
  if (battleOngoingToastCooldown) return;
  
  try {
    // Look for any toast with the "no" icon (same logic as original defeat toast)
    const toasts = document.querySelectorAll('div.widget-bottom.pixel-font-16.flex.items-center.gap-2.px-2.py-1.text-whiteHighlight');
    
    // Only proceed if we actually found toasts to check
    if (toasts.length === 0) return;
    
    console.log(`[Bestiary Automator] Found ${toasts.length} potential toasts, checking for "no" icon...`);
    
    for (const toast of toasts) {
      // Check if this toast has the "no" icon (same as original defeat toast logic)
      const noIcon = toast.querySelector('img[alt="no"]');
      if (!noIcon) continue;
      
      // Check if this toast contains text
      const textElement = toast.querySelector('.text-left');
      if (!textElement) continue;
      
      const toastText = textElement.textContent;
      
      // Create a hash of the toast content to avoid processing the same toast repeatedly
      const toastHash = btoa(toastText).slice(0, 16); // Simple hash of toast text
      
      // Skip if we've already processed this exact toast
      if (processedToastHashes.has(toastHash)) {
        continue;
      }
      
      console.log(`[Bestiary Automator] Found toaster with "no" icon!`);
      console.log(`[Bestiary Automator] Checking toast with "no" icon, text: "${toastText}"`);
      
      // Handle defeat toast
      if (toastText.includes('Autoplay stopped because your creatures were') && toastText.includes('defeated')) {
        if (window.DEBUG) console.log('[Bestiary Automator] Defeat toast detected!');
        
        if (defeatToastCooldown) {
          if (window.DEBUG) console.log('[Bestiary Automator] Defeat toast cooldown active, skipping...');
          continue;
        }
        
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
        
        return; // Exit after processing defeat toast
      }
      
      // Handle battle ongoing toast
      if (toastText.includes('Battle still ongoing') && toastText.includes('ms diff')) {
        // Check cooldown to prevent multiple executions
        if (battleOngoingToastCooldown) {
          return; // Silent return when cooldown is active
        }
        
        // Set cooldown to prevent multiple executions
        battleOngoingToastCooldown = true;
        
        console.log('[Bestiary Automator] Battle ongoing toast detected!');
        
        // Extract the time difference from the toast
        const timeMatch = toastText.match(/\((\d+)ms diff\)/);
        if (timeMatch) {
          const timeDiff = parseInt(timeMatch[1], 10);
          
          // Round down to nearest 1000ms (1 second) for more predictable timing
          const roundedTimeDiff = Math.floor(timeDiff / 1000) * 1000;
          
          console.log(`[Bestiary Automator] Battle ongoing toast detected, original time: ${timeDiff}ms, rounded down to: ${roundedTimeDiff}ms, waiting then clicking autoplay...`);
          
          // Create a cancellable countdown task
          const countdownTask = { cancelled: false };
          currentCountdownTask = countdownTask;
          countdownCancelled = false; // Reset global cancellation flag
          
          // Store initial board state for comparison
          const initialBoardContext = globalThis.state.board ? globalThis.state.board.getSnapshot().context : {};
          const initialPlayerContext = globalThis.state.player ? globalThis.state.player.getSnapshot().context : {};
          const initialGameTimerContext = globalThis.state.gameTimer ? globalThis.state.gameTimer.getSnapshot().context : {};
          const initialMenuContext = globalThis.state.menu ? globalThis.state.menu.getSnapshot().context : {};
          
          console.log('[Bestiary Automator] Starting countdown with comprehensive state monitoring...');
          
          // Set up state monitoring subscriptions
          const stateSubscriptions = [];
          let stateChanged = false;
          
          // Monitor board state changes
          if (globalThis.state && globalThis.state.board) {
            const boardSubscription = globalThis.state.board.subscribe((state) => {
              if (countdownTask.cancelled) return;
              
              const context = state.context;
              // Check for significant board changes
              if (context.openMapPicker !== initialBoardContext.openMapPicker ||
                  context.gameStarted !== initialBoardContext.gameStarted ||
                  context.mode !== initialBoardContext.mode ||
                  context.selectedMap !== initialBoardContext.selectedMap ||
                  context.boardConfig !== initialBoardContext.boardConfig) {
                stateChanged = true;
                countdownTask.cancelled = true;
                console.log('[Bestiary Automator] Board state changed during countdown, aborting...', {
                  openMapPicker: context.openMapPicker,
                  gameStarted: context.gameStarted,
                  mode: context.mode,
                  selectedMap: context.selectedMap
                });
              }
            });
            stateSubscriptions.push(boardSubscription);
          }
          
          // Monitor player state changes
          if (globalThis.state && globalThis.state.player) {
            const playerSubscription = globalThis.state.player.subscribe((state) => {
              if (countdownTask.cancelled) return;
              
              const context = state.context;
              // Check for significant player changes
              if (context.exp !== initialPlayerContext.exp ||
                  context.gold !== initialPlayerContext.gold ||
                  context.staminaWillBeFullAt !== initialPlayerContext.staminaWillBeFullAt ||
                  context.battleWillBeReadyAt !== initialPlayerContext.battleWillBeReadyAt) {
                stateChanged = true;
                countdownTask.cancelled = true;
                console.log('[Bestiary Automator] Player state changed during countdown, aborting...', {
                  exp: context.exp,
                  gold: context.gold,
                  staminaWillBeFullAt: context.staminaWillBeFullAt,
                  battleWillBeReadyAt: context.battleWillBeReadyAt
                });
              }
            });
            stateSubscriptions.push(playerSubscription);
          }
          
          // Monitor game timer changes
          if (globalThis.state && globalThis.state.gameTimer) {
            const timerSubscription = globalThis.state.gameTimer.subscribe((state) => {
              if (countdownTask.cancelled) return;
              
              const context = state.context;
              // Check for game state changes
              if (context.state !== initialGameTimerContext.state || 
                  context.currentTick !== initialGameTimerContext.currentTick) {
                stateChanged = true;
                countdownTask.cancelled = true;
                console.log('[Bestiary Automator] Game timer changed during countdown, aborting...', {
                  state: context.state,
                  currentTick: context.currentTick
                });
              }
            });
            stateSubscriptions.push(timerSubscription);
          }
          
          // Monitor menu state changes
          if (globalThis.state && globalThis.state.menu) {
            const menuSubscription = globalThis.state.menu.subscribe((state) => {
              if (countdownTask.cancelled) return;
              
              const context = state.context;
              // Check for menu mode changes
              if (context.mode !== initialMenuContext.mode) {
                stateChanged = true;
                countdownTask.cancelled = true;
                console.log('[Bestiary Automator] Menu state changed during countdown, aborting...', {
                  mode: context.mode
                });
              }
            });
            stateSubscriptions.push(menuSubscription);
          }
          
          // Wait for the rounded time difference with cancellation support
          const sleepResult = await cancellableSleep(roundedTimeDiff, () => {
            return countdownTask.cancelled || countdownCancelled || currentCountdownTask !== countdownTask;
          });
          
          // Check if countdown was cancelled during the wait
          if (sleepResult === 'cancelled') {
            console.log('[Bestiary Automator] Countdown was cancelled during wait period, not clicking Start button');
            // Clean up state subscriptions
            stateSubscriptions.forEach(sub => sub.unsubscribe());
            // Reset cooldown so system can track toasters again
            battleOngoingToastCooldown = false;
            // Reset the global cancellation flag
            countdownCancelled = false;
            console.log('[Bestiary Automator] Cooldown reset after countdown cancellation');
            console.log('[Bestiary Automator] Ready to detect new toasters');
            return;
          }
          
          // Clean up state subscriptions before proceeding
          stateSubscriptions.forEach(sub => sub.unsubscribe());
          
          // Find and click the Start button (same logic as defeat toast)
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
            console.log('[Bestiary Automator] Start button clicked after battle ongoing toast');
          } else {
            console.log('[Bestiary Automator] Start button not found after battle ongoing toast');
          }
          
          // Reset cooldown after processing to allow for future battle ongoing toasts
          setTimeout(() => {
            battleOngoingToastCooldown = false;
            console.log('[Bestiary Automator] Battle ongoing toast cooldown reset');
          }, 3000); // 3 second cooldown
          
        } else {
          console.log('[Bestiary Automator] Could not extract time from battle ongoing toast');
          // Reset cooldown if we couldn't process the toast
          battleOngoingToastCooldown = false;
        }
        
        return; // Exit after processing battle ongoing toast
      } else {
        // Mark this toast as processed even if it doesn't match our patterns
        processedToastHashes.add(toastHash);
        console.log(`[Bestiary Automator] Toast text does not match our patterns: "${toastText}"`);
      }
    }
    
    if (window.DEBUG) console.log('[Bestiary Automator] No relevant toasts found');
  } catch (error) {
    if (window.DEBUG) console.error('[Bestiary Automator] Error handling toasts:', error);
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
  
  // Reset rewards collection flag when starting automation
  rewardsCollectedThisSession = false;
  
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
  
  // Cancel any ongoing countdown
  cancelCurrentCountdown();
  
  // Reset retry counters
  staminaRefillRetryCount = 0;
  defeatToastCooldown = false;
  battleOngoingToastCooldown = false;
  countdownCancelled = false;
  
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
    
    // Check for any relevant toasts if autoplay after defeat is enabled
    // Only check every 5 seconds to reduce spam (main loop runs every 2 seconds)
    if (config.autoPlayAfterDefeat && !window.__lastToastCheck || (Date.now() - window.__lastToastCheck > 5000)) {
      window.__lastToastCheck = Date.now();
      await handleToasts();
    }
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
  const staminaContainer = createNumberInputContainer('min-stamina-input', t('minimumStaminaLabel'), config.minimumStaminaWithoutRefill, 1, 360);
  
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
    input.value = Math.max(min, Math.min(max, value)); // Clamp value to valid range
    input.style.cssText = 'width: 100%; padding: 5px; background-color: #222; color: #fff; border: 1px solid #444;';
    
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
      // Clear any existing background styling first
      btn.style.background = '';
      btn.style.backgroundColor = '';
      
      if (config.autoRefillStamina) {
        // Priority 1: Green background for auto refill stamina
        btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-green.be515334.png') repeat";
        btn.style.backgroundSize = "auto";
        btn.style.color = "#ffffff";
        btn.style.backgroundColor = "transparent"; // Ensure no fallback color
      } else if (config.autoCollectRewards || config.autoDayCare || config.autoPlayAfterDefeat) {
        // Priority 2: Blue background for other auto features
        btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png') repeat";
        btn.style.backgroundSize = "auto";
        btn.style.color = "#ffffff";
        btn.style.backgroundColor = "transparent"; // Ensure no fallback color
      } else {
        // Default: No features enabled
        btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat";
        btn.style.color = "#ffe066";
        btn.style.backgroundColor = "transparent"; // Ensure no fallback color
      }
    }
  }, 100);
};

// Initialize the mod
function init() {
  if (window.DEBUG) console.log('[Bestiary Automator] Initializing UI...');
  
  // Reset rewards collection flag on initialization
  rewardsCollectedThisSession = false;
  
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

// Track button state to prevent unnecessary updates
let lastButtonState = {
  autoRefillStamina: false,
  autoCollectRewards: false,
  autoDayCare: false,
  autoPlayAfterDefeat: false,
  boardAnalyzerRunning: false
};

// Update the Automator button style based on enabled features
function updateAutomatorButton() {
  if (api && api.ui) {
    const hasEnabledFeatures = config.autoRefillStamina || config.autoCollectRewards || config.autoDayCare || config.autoPlayAfterDefeat;
    
    api.ui.updateButton(CONFIG_BUTTON_ID, {
      primary: hasEnabledFeatures,
      tooltip: t('configButtonTooltip')
    });
    
    // Check current state
    const currentState = {
      autoRefillStamina: config.autoRefillStamina,
      autoCollectRewards: config.autoCollectRewards,
      autoDayCare: config.autoDayCare,
      autoPlayAfterDefeat: config.autoPlayAfterDefeat,
      boardAnalyzerRunning: window.__modCoordination && window.__modCoordination.boardAnalyzerRunning
    };
    
    // Only update button styling if state has changed
    const stateChanged = JSON.stringify(currentState) !== JSON.stringify(lastButtonState);
    
    if (stateChanged) {
      const btn = document.getElementById(CONFIG_BUTTON_ID);
      if (btn) {
        // Clear any existing background styling first
        btn.style.background = '';
        btn.style.backgroundColor = '';
        
        // Check if Board Analyzer is running and we should show paused state
        if (currentState.boardAnalyzerRunning) {
          // Show paused state with gray background
          btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-darker.2679c837.png') repeat";
          btn.style.color = "#888";
          btn.style.backgroundColor = "transparent"; // Ensure no fallback color
          btn.title = t('configButtonTooltip') + ' (Paused - Board Analyzer Running)';
        } else if (config.autoRefillStamina) {
          // Priority 1: Green background for auto refill stamina
          btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-green.be515334.png') repeat";
          btn.style.backgroundSize = "auto";
          btn.style.color = "#ffffff";
          btn.style.backgroundColor = "transparent"; // Ensure no fallback color
        } else if (config.autoCollectRewards || config.autoDayCare || config.autoPlayAfterDefeat) {
          // Priority 2: Blue background for other auto features
          btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png') repeat";
          btn.style.backgroundSize = "auto";
          btn.style.color = "#ffffff";
          btn.style.backgroundColor = "transparent"; // Ensure no fallback color
        } else {
          // Default: No features enabled
          btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat";
          btn.style.color = "#ffe066";
          btn.style.backgroundColor = "transparent"; // Ensure no fallback color
        }
        
        // Reset tooltip to normal if not paused
        if (!currentState.boardAnalyzerRunning) {
          btn.title = t('configButtonTooltip');
        }
      }
      
      // Update last known state
      lastButtonState = currentState;
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