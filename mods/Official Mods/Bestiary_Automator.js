// Bestiary Automator Mod for Bestiary Arena
// Code by MathiasBynens and TheMegafuji

console.log('[Bestiary Automator] initializing...');

// Configuration with defaults
const defaultConfig = {
  enabled: false,
  autoRefillStamina: false,
  minimumStaminaWithoutRefill: 15,
  autoCollectRewards: false,
  autoDayCare: false,
  autoPlayAfterDefeat: false,
  autoFinishTasks: false,
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
    console.error('[Bestiary Automator] Error loading config:', error);
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

// Only track states that prevent conflicts
const AUTOMATION_STATES = {
  PROCESSING_DEFEAT: 'processing_defeat',  // Handling defeat toast
  PROCESSING_BATTLE: 'processing_battle',  // Handling battle ongoing toast
  COUNTDOWN: 'countdown'                   // Waiting for countdown to complete
};

let currentState = null;

// Translations
const TRANSLATIONS = {
  en: {
    buttonTooltip: 'Bestiary Automator',
    configButtonTooltip: 'Automator Settings',
    modalTitle: 'Bestiary Automator Settings',
    enabled: 'Enable Automation',
    autoRefillStamina: 'Autorefill Stamina',
    minimumStaminaLabel: 'Minimum Stamina Without Refill',
    autoCollectRewards: 'Autocollect Rewards',
    autoDayCare: 'Autohandle Daycare',
    autoPlayAfterDefeat: 'Autoplay after Defeat and Network Issues',
    autoFinishTasks: 'Autofinish Tasks',
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
    autoFinishTasks: 'Finalizar Tarefas Automaticamente',
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
    console.log(`[Bestiary Automator] Clicking button: "${textKey}" (${button.textContent.trim()})`);
    button.click();
    return true;
  }
  console.log(`[Bestiary Automator] Button not found: "${textKey}"`);
  return false;
};

// Check and handle scroll lock
const handleScrollLock = () => {
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
      console.log(`[Bestiary Automator] Clicking close button: "${buttonText}"`);
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

// Check if game is ready for stamina refill
const isGameReadyForStaminaRefill = () => {
  try {
    // Check if Board Analyzer is running - if so, pause automation
    if (window.__modCoordination && window.__modCoordination.boardAnalyzerRunning) {
      console.log('[Bestiary Automator] Board Analyzer is running, pausing stamina refill');
      return false;
    }
    
    // Check if stamina element exists and is visible
    const elStamina = document.querySelector('[title="Stamina"]');
    if (!elStamina || !elStamina.offsetParent) return false;
    
    // Check if stamina value is readable
    const staminaElement = elStamina.querySelector('span span');
    if (!staminaElement || !staminaElement.textContent) return false;
    
    return true;
  } catch (error) {
    console.error('[Bestiary Automator] Error checking game readiness:', error);
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
      console.log('[Bestiary Automator] Game not ready for stamina refill, will retry');
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
    
    console.log(`[Bestiary Automator] Refilling stamina: current=${stamina}, minimum=${config.minimumStaminaWithoutRefill}, retry=${staminaRefillRetryCount}`);
    
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
        console.log(`[Bestiary Automator] Stamina still low after refill: ${newStamina}, attempting another refill`);
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
    console.error('[Bestiary Automator] Error refilling stamina:', error);
    
    // Implement exponential backoff retry
    staminaRefillRetryCount++;
    if (staminaRefillRetryCount <= 3) {
      const retryDelay = Math.pow(2, staminaRefillRetryCount) * 1000; // 2s, 4s, 8s
      
      console.log(`[Bestiary Automator] Scheduling retry in ${retryDelay}ms (attempt ${staminaRefillRetryCount})`);
      
      clearTimeout(staminaRefillRetryTimeout);
      staminaRefillRetryTimeout = setTimeout(() => {
        refillStaminaIfNeeded();
      }, retryDelay);
    } else {
      console.log('[Bestiary Automator] Max retry attempts reached, giving up');
      staminaRefillRetryCount = 0;
    }
  }
};

// Track if we've already collected rewards for this game session
let rewardsCollectedThisSession = false;

// Track if we've already processed quest log for current board state
let questLogProcessedThisBoardState = false;

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
    
    console.log(`[Bestiary Automator] Taking rewards at level ${currentLevel}`);
    
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
    console.error('[Bestiary Automator] Error taking rewards:', error);
  }
};

// Handle day care
const handleDayCare = async () => {
  if (!config.autoDayCare) return;
  
  try {
    const dayCareBlip = document.querySelector('div[data-radix-scroll-area-viewport]:has(div:not(.text-invalid) > .animate-ping)');
    if (!dayCareBlip) return;
    
    console.log('[Bestiary Automator] Handling day care');
    
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
    console.error('[Bestiary Automator] Error handling day care:', error);
  }
};

// Handle task finishing
const handleTaskFinishing = async () => {
  
  if (!config.autoFinishTasks) {
    console.log('[Bestiary Automator] autoFinishTasks disabled, returning');
    return;
  }
  
  // Check if we should skip task checking due to sleep mode
  if (shouldSkipTaskChecking()) {
    console.log('[Bestiary Automator] Task checking sleeping, skipping...');
    return 'sleeping';
  }
  
  // Only process quest log once per board state
  if (questLogProcessedThisBoardState) {
    console.log('[Bestiary Automator] Quest log already processed for this board state, skipping...');
    return;
  }
  
  try {
    // Check if Game State API is available
    if (!globalThis.state || !globalThis.state.player) {
      console.log('[Bestiary Automator] Game State API not available');
      return;
    }
    
    const playerContext = globalThis.state.player.getSnapshot().context;
    
    // Check if there's a hunting task that's ready
    if (playerContext.questLog && playerContext.questLog.task) {
      const task = playerContext.questLog.task;
      
      // Early return if no active hunting task (killCount is 0 or undefined)
      if (!task.killCount || task.killCount === 0) {
        console.log('[Bestiary Automator] No active hunting task (killCount is 0), skipping...');
        return 'no_task';
      }
      
      // Check if task is ready OR if autoplay is active
      const isTaskReady = task.ready;
      let isAutoplayActive = checkIfAutoplayIsActive();
      
      // If autoplay shows "Auto" state, wait for it to transition to "Autoplay" state
      if (!isTaskReady && !isAutoplayActive) {
        const autoButton = document.querySelector('button[data-full="true"][data-state="closed"]');
        if (autoButton && autoButton.textContent.includes('Auto') && autoButton.hasAttribute('disabled')) {
          console.log('[Bestiary Automator] Waiting for autoplay button to transition from "Auto" to "Autoplay" state...');
          
          // Wait up to 30 seconds for the transition
          let waitAttempts = 0;
          const maxWaitAttempts = 300; // 30 seconds with 100ms intervals
          
          while (!isAutoplayActive && waitAttempts < maxWaitAttempts) {
            await sleep(100);
            waitAttempts++;
            isAutoplayActive = checkIfAutoplayIsActive();
            
            if (waitAttempts % 100 === 0) { // Log every 10 seconds
              console.log(`[Bestiary Automator] Still waiting for autoplay transition... (${waitAttempts / 10}s)`);
            }
          }
          
          if (isAutoplayActive) {
            console.log('[Bestiary Automator] Autoplay button transitioned to accessible state');
          } else {
            console.log('[Bestiary Automator] Autoplay button never transitioned, skipping quest log check');
            return;
          }
        }
      }
      
      if (isTaskReady || isAutoplayActive) {
        if (isTaskReady) {
          console.log('[Bestiary Automator] Hunting task is ready, finishing...');
        } else {
          console.log('[Bestiary Automator] Autoplay is active and quest log accessible, checking...');
        }
        
        // Mark quest log as processed for this board state
        questLogProcessedThisBoardState = true;
        
        // 1. Open quest log
        console.log('[Bestiary Automator] Looking for quest blip...');
        const questBlip = document.querySelector('img[src*="quest-blip.png"]');
        console.log('[Bestiary Automator] Quest blip found:', questBlip);
        
        if (questBlip) {
          questBlip.click();
          console.log('[Bestiary Automator] Quest log opened');
          
          // Wait for quest log to fully load - reduced for faster response
          await sleep(300);
          
          // 2. Wait up to 2 minutes for Finish button with mutation observer
          let finishButton = null;
          let attempts = 0;
          const maxAttempts = 240; // Keep 2 minute delay
          
          // Use mutation observer to watch for Finish button changes
          const finishButtonObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') {
                const target = mutation.target;
                if (target.textContent.includes('Finish')) {
                  // Check if button is now enabled
                  if (!target.hasAttribute('disabled') && !target.disabled) {
                    finishButton = target;
                    console.log('[Bestiary Automator] Finish button enabled via mutation observer');
                  }
                }
              }
            }
          });
          
          // Start observing the document body for button changes
          finishButtonObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled']
          });
          
          // Poll for Finish button with faster intervals
          while (!finishButton && attempts < maxAttempts) {
            await sleep(100); // Faster polling - 100ms instead of 500ms
            attempts++;
            
            // Look for Finish button that's not disabled
            const buttons = document.querySelectorAll('button');
            finishButton = Array.from(buttons).find(btn => 
              btn.textContent.includes('Finish') && 
              !btn.hasAttribute('disabled') && 
              !btn.disabled
            );
            
            if (finishButton) {
              console.log('[Bestiary Automator] Finish button found and ready, attempts:', attempts);
              break;
            }
          }
          
          // Stop observing
          finishButtonObserver.disconnect();
          
          // 3. Click Finish
          if (finishButton) {
            console.log('[Bestiary Automator] Clicking Finish button...');
            finishButton.click();
            console.log('[Bestiary Automator] Finish clicked');
            
            // 4. Close modal - reduced for faster response
            await sleep(300);
            clickAllCloseButtons();
            console.log('[Bestiary Automator] Modal closed');
          } else {
            // If we were checking during autoplay and no finish button appeared, just close the quest log
            if (isAutoplayActive && !isTaskReady) {
              console.log('[Bestiary Automator] No finish button found during autoplay, closing quest log');
              clickAllCloseButtons();
            } else {
              console.log('[Bestiary Automator] Finish button never became ready');
            }
          }
        } else {
          console.log('[Bestiary Automator] Quest blip not found');
        }
      } else {
        console.log('[Bestiary Automator] Task not ready, ready status:', task.ready);
      }
    } else {
      console.log('[Bestiary Automator] No quest log or task found');
    }
  } catch (error) {
    console.error('[Bestiary Automator] Error handling task finishing:', error);
  }
  
  // Return success if we reach here
  return 'success';
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
          console.log('[Bestiary Automator] Ignoring rapid new game event (debounced)');
          return;
        }
        lastGameStateChange = now;
        
        console.log('[Bestiary Automator] New game detected, resetting rewards collection flag');
        rewardsCollectedThisSession = false;
        questLogProcessedThisBoardState = false;
        
        // Reset sleep state when new game starts (new hunting task might be available)
        if (isTaskCheckingSleeping) {
          console.log('[Bestiary Automator] New game detected during sleep mode, waking up early');
          isTaskCheckingSleeping = false;
          sleepStartTime = 0;
          sleepDuration = 0;
        }
        
        // Log current task status when new game starts
        try {
          if (globalThis.state?.player) {
            const playerContext = globalThis.state.player.getSnapshot().context;
            const task = playerContext?.questLog?.task;
            
            if (task && task.killCount !== undefined) {
              console.log(`[Bestiary Automator] Progress: ${task.killCount} creatures killed`);
              
              // Calculate remaining kills if we can determine the target
              if (task.ready) {
                console.log('[Bestiary Automator] Task is ready to complete!');
                
                // Check and finish tasks immediately if they're ready
                handleTaskFinishing();
              }
            }
          }
        } catch (error) {
          console.error('[Bestiary Automator] Error logging task status on new game:', error);
        }
        
        // Cancel any ongoing countdown when new game starts
        if (currentCountdownTask) {
          cancelCurrentCountdown();
        }
      };
      
      // Subscribe to newGame event (primary handler)
      globalThis.state.board.on('newGame', handleNewGame);
      
      // Subscribe to emitNewGame event (secondary handler for countdown cancellation only)
      globalThis.state.board.on('emitNewGame', (event) => {
        if (currentCountdownTask) {
          console.log('[Bestiary Automator] Game started during countdown, cancelling...');
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
        
        // Check for task completion after every game ends (autoplay or manual)
        console.log('[Bestiary Automator] Game ended, checking for task completion...');
        
        // Log current task status and progress
        try {
          if (globalThis.state?.player) {
            const playerContext = globalThis.state.player.getSnapshot().context;
            const task = playerContext?.questLog?.task;
            
            if (task && task.killCount !== undefined) {
              console.log(`[Bestiary Automator] Progress: ${task.killCount} creatures killed`);
              
              // Calculate remaining kills if we can determine the target
              if (task.ready) {
                console.log('[Bestiary Automator] Task is ready to complete!');
              }
            }
          }
        } catch (error) {
          console.error('[Bestiary Automator] Error logging task status:', error);
        }
        
        // Check and finish tasks immediately after game ends
        handleTaskFinishing();
        
        // Defeat toasts are now detected automatically via MutationObserver - no need for manual checking
      };
      
      // Subscribe to emitEndGame event
      globalThis.state.board.on('emitEndGame', handleEndGame);
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
              
              // Also check child elements for toasts
              const defeatToast = node.querySelector && node.querySelector('div.widget-bottom.pixel-font-16.flex.items-center.gap-2.px-2.py-1.text-whiteHighlight:has(img[alt="no"])');
              if (defeatToast && defeatToast.textContent.includes('Autoplay stopped because your creatures were defeated')) {
                console.log('[Bestiary Automator] Defeat toast found in child elements via MutationObserver!');
                processDefeatToast();
                return;
              }
              
              // Check child elements for battle ongoing toasts
              const battleToast = node.querySelector && node.querySelector('div.widget-bottom.pixel-font-16.flex.items-center.gap-2.px-2.py-1.text-whiteHighlight');
              if (battleToast && battleToast.textContent.includes('Battle still ongoing') && battleToast.textContent.includes('ms diff')) {
                console.log('[Bestiary Automator] Battle ongoing toast found in child elements via MutationObserver!');
                const toastText = getToastText(battleToast);
                processBattleOngoingToast(toastText);
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

// Toast detection is now handled by MutationObserver - this function is no longer needed

// Simplified defeat toast processor - no cooldown, process each immediately
const processDefeatToast = async () => {
  if (!canTransitionTo(AUTOMATION_STATES.PROCESSING_DEFEAT)) {
    console.log('[Bestiary Automator] Cannot process defeat toast, system is busy');
    return false;
  }
  
  setState(AUTOMATION_STATES.PROCESSING_DEFEAT);
  console.log('[Bestiary Automator] Defeat toast detected!');
  
  // Log task progress
  logTaskProgress('defeat');
  
  // Check and finish tasks immediately when defeat is detected
  handleTaskFinishing();
  
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

// Simplified battle ongoing toast processor
const processBattleOngoingToast = async (toastText) => {
  if (!canTransitionTo(AUTOMATION_STATES.PROCESSING_BATTLE)) {
    return false;
  }
  
  setState(AUTOMATION_STATES.PROCESSING_BATTLE);
  console.log('[Bestiary Automator] Battle ongoing toast detected!');
  
  // Check and finish tasks immediately when battle ongoing is detected
  handleTaskFinishing();
  
  // Validate toastText parameter
  if (!toastText || typeof toastText !== 'string') {
    console.log('[Bestiary Automator] Invalid toastText parameter:', toastText);
    setState(null);
    return false;
  }
  
  // Extract time difference
  const timeMatch = toastText.match(/\((\d+)ms diff\)/);
  if (!timeMatch) {
    console.log('[Bestiary Automator] Could not extract time from battle ongoing toast:', toastText);
    setState(null);
    return false;
  }
  
  const timeDiff = parseInt(timeMatch[1], 10);
  const roundedTimeDiff = Math.floor(timeDiff / 1000) * 1000;
  
  console.log(`[Bestiary Automator] Battle ongoing toast detected, original time: ${timeDiff}ms, rounded down to: ${roundedTimeDiff}ms, waiting then clicking autoplay...`);
  
  // Start countdown
  if (await startCountdown(roundedTimeDiff)) {
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

// Helper function to dismiss defeat toast after successful game start
const dismissDefeatToast = () => {
  try {
    // Look for the defeat toast and click it to dismiss naturally
    const defeatToast = document.querySelector('div.widget-bottom.pixel-font-16.flex.items-center.gap-2.px-2.py-1.text-whiteHighlight:has(img[alt="no"])');
    if (defeatToast && defeatToast.textContent.includes('Autoplay stopped because your creatures were defeated')) {
      defeatToast.click();
      console.log('[Bestiary Automator] Defeat toast clicked to dismiss');
    }
  } catch (error) {
    console.error('[Bestiary Automator] Error dismissing defeat toast:', error);
  }
};

// Helper function to find start button
const findStartButton = () => {
  const startButtons = document.querySelectorAll('button[data-full="false"][data-state="closed"]');
  for (const button of startButtons) {
    if (button.textContent.trim() === 'Start') {
      return button;
    }
  }
  return null;
};

// Helper function to check if an element is a defeat toast
const isDefeatToast = (element) => {
  try {
    // Check if the element has the toast structure
    if (!element.classList || !element.classList.contains('widget-bottom')) {
      return false;
    }
    
    // Check for the "no" icon
    const noIcon = element.querySelector('img[alt="no"]');
    if (!noIcon) {
      return false;
    }
    
    // Check for the text content indicating defeat
    const textElement = element.querySelector('.text-left');
    if (!textElement) {
      return false;
    }
    
    const toastText = textElement.textContent;
    return toastText.includes('Autoplay stopped because your creatures were defeated') ||
           (toastText.includes('Autoplay stopped') && toastText.includes('defeated')) ||
           toastText.includes('creatures were defeated');
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

// Helper function to check if we should skip task checking due to sleep mode
const shouldSkipTaskChecking = () => {
  if (!isTaskCheckingSleeping) return false;
  
  const now = Date.now();
  const elapsed = now - sleepStartTime;
  
  // Check if sleep period is complete (safety check)
  if (elapsed >= sleepDuration) {
    console.log(`[Bestiary Automator] Sleep period complete (${Math.round(elapsed / 1000)}s elapsed), resuming task checking`);
    isTaskCheckingSleeping = false;
    sleepStartTime = 0;
    sleepDuration = 0;
    return false;
  }
  
  // Still sleeping, skip task checking
  const remaining = Math.round((sleepDuration - elapsed) / 1000);
  console.log(`[Bestiary Automator] Task checking sleeping (${remaining}s remaining) - other automation continues`);
  return true;
};

// Helper function to check if autoplay is active and quest log is accessible
const checkIfAutoplayIsActive = () => {
  try {
    // Look for the autoplay button with the specific pattern that allows quest log access
    const autoplayButton = document.querySelector('button[data-full="false"][data-state="closed"]');
    if (!autoplayButton) return false;
    
    // Check if it has the autoplay text and is disabled (indicating autoplay is running)
    const buttonText = autoplayButton.textContent;
    const isDisabled = autoplayButton.hasAttribute('disabled') || autoplayButton.disabled;
    
    // Check for autoplay text and disabled state
    if (buttonText.includes('Autoplay') && isDisabled) {
      console.log('[Bestiary Automator] Autoplay button detected as active and quest log accessible');
      return true;
    }
    
    // If we see "Auto" with data-full="true", quest log is not accessible yet
    const autoButton = document.querySelector('button[data-full="true"][data-state="closed"]');
    if (autoButton && autoButton.textContent.includes('Auto') && autoButton.hasAttribute('disabled')) {
      console.log('[Bestiary Automator] Autoplay button shows "Auto" - quest log not accessible yet');
      return false;
    }
    
    return false;
  } catch (error) {
    console.error('[Bestiary Automator] Error checking autoplay state:', error);
    return false;
  }
};

// Helper function to log task progress
const logTaskProgress = (context) => {
  try {
    if (globalThis.state?.player) {
      const playerContext = globalThis.state.player.getSnapshot().context;
      const task = playerContext?.questLog?.task;
      
      // Early return if no active hunting task
      if (!task || task.killCount === undefined || task.killCount === 0) {
        return;
      }
      
      // Only log progress if there's actually a hunting task
      console.log(`[Bestiary Automator] Progress: ${task.killCount} creatures killed`);
      if (task.ready) {
        console.log('[Bestiary Automator] Task is ready to complete!');
      }
    }
  } catch (error) {
    console.error('[Bestiary Automator] Error logging task status:', error);
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
  
  // Reset rewards collection flag when starting automation
  rewardsCollectedThisSession = false;
  
  
  // Run immediately once
  runAutomationTasks();
  
  // Set up core automation interval
  automationInterval = setInterval(runAutomationTasks, 5000); // Core automation every 5s
  
  // Subscribe to game state for autoplay after defeat
  subscribeToGameState();
 };

const stopAutomation = () => {
  if (!automationInterval) return;
  
  console.log('[Bestiary Automator] Stopping automation loop');
  
  // Clear main intervals
  clearInterval(automationInterval);
  automationInterval = null;
  

  
  // Clear any pending retry timeouts
  if (staminaRefillRetryTimeout) {
    clearTimeout(staminaRefillRetryTimeout);
    staminaRefillRetryTimeout = null;
  }
  
  // Clear all active timeouts
  cancelAllTimeouts();
  
  // Cancel any ongoing countdown
  cancelCurrentCountdown();
  
  // Reset retry counters
  staminaRefillRetryCount = 0;
  
  // Clear element cache
  elementCache.clear();
  
  // Remove focus event listeners
  removeFocusEventListeners();
  
  // Unsubscribe from game state changes
  unsubscribeFromGameState();
};

const runAutomationTasks = async () => {
  try {
    // Core automation tasks that should always run
    await takeRewardsIfAvailable();
    await handleDayCare();
    updateRequiredStamina();
    await refillStaminaIfNeeded();
    
    // Toast detection is now handled by MutationObserver - no need for interval checking
  } catch (error) {
    console.error('[Bestiary Automator] Error in automation tasks:', error);
  }
};

// Separate function for task checking that runs independently
const runTaskChecking = async () => {
  try {
    // Only run task checking if game is active and feature is enabled
    if (!isGameActive() || !config.autoFinishTasks) {
      return;
    }
    
    // Check if we should skip task checking due to sleep mode
    if (shouldSkipTaskChecking()) {
      return;
    }
    
    // Check and finish tasks proactively
    const taskResult = await handleTaskFinishing();
    
    // If no active hunting task, set sleep mode for task checking only
    if (taskResult === 'no_task') {
      console.log('[Bestiary Automator] No active hunting task, entering sleep mode for task checking only...');
      
      // Set global sleep state for task checking only
      isTaskCheckingSleeping = true;
      sleepStartTime = Date.now();
      sleepDuration = 300000; // 5 minutes = 300,000ms
      
      console.log('[Bestiary Automator] Task checking sleeping for 5 minutes, but other automation continues...');
    }
    
    // If task checking is sleeping, skip further processing
    if (taskResult === 'sleeping') {
      return;
    }
  } catch (error) {
    console.error('[Bestiary Automator] Error in task checking:', error);
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
  
  // Auto finish tasks checkbox
  const autoFinishTasksContainer = createCheckboxContainer('auto-finish-tasks-checkbox', t('autoFinishTasks'), config.autoFinishTasks);
  
  // Auto play after defeat checkbox
  const autoPlayContainer = createCheckboxContainer('auto-play-defeat-checkbox', t('autoPlayAfterDefeat'), config.autoPlayAfterDefeat);
  
  // Add all elements to content
  content.appendChild(refillContainer);
  content.appendChild(staminaContainer);
  content.appendChild(rewardsContainer);
  content.appendChild(dayCareContainer);
  content.appendChild(autoFinishTasksContainer);
  content.appendChild(autoPlayContainer);
  
  // Update checkboxes with current config values after creation
  setTimeout(() => {
    const refillCheckbox = document.getElementById('auto-refill-checkbox');
    const rewardsCheckbox = document.getElementById('auto-rewards-checkbox');
    const dayCareCheckbox = document.getElementById('auto-daycare-checkbox');
    const autoPlayCheckbox = document.getElementById('auto-play-defeat-checkbox');
    const autoFinishTasksCheckbox = document.getElementById('auto-finish-tasks-checkbox');
    const staminaInput = document.getElementById('min-stamina-input');
    
    if (refillCheckbox) refillCheckbox.checked = config.autoRefillStamina;
    if (rewardsCheckbox) rewardsCheckbox.checked = config.autoCollectRewards;
    if (dayCareCheckbox) dayCareCheckbox.checked = config.autoDayCare;
    if (autoPlayCheckbox) autoPlayCheckbox.checked = config.autoPlayAfterDefeat;
    if (autoFinishTasksCheckbox) autoFinishTasksCheckbox.checked = config.autoFinishTasks;
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
          config.autoFinishTasks = document.getElementById('auto-finish-tasks-checkbox').checked;
          
          // Save configuration
          const configToSave = {
            autoRefillStamina: config.autoRefillStamina,
            minimumStaminaWithoutRefill: config.minimumStaminaWithoutRefill,
            autoCollectRewards: config.autoCollectRewards,
            autoDayCare: config.autoDayCare,
            autoPlayAfterDefeat: config.autoPlayAfterDefeat,
            autoFinishTasks: config.autoFinishTasks
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
          
          // Always start automation when settings are saved
          startAutomation();
          
          // Update game state subscription based on autoplay setting
          if (config.autoPlayAfterDefeat) {
            subscribeToGameState();
          } else {
            unsubscribeFromGameState();
          }
          
          // Only update button styling if configuration actually changed
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
  // Create only the configuration button
  api.ui.addButton({
    id: CONFIG_BUTTON_ID,
    text: 'Automator',
    modId: MOD_ID,
    tooltip: t('configButtonTooltip'),
    primary: false, // Never use primary to avoid solid green color
    onClick: () => api.ui.toggleConfigPanel(CONFIG_PANEL_ID)
  });
  
  // Apply custom styling based on priority
  setTimeout(() => {
    const btn = document.getElementById(CONFIG_BUTTON_ID);
    if (btn) {
      applyButtonStyling(btn);
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
    console.log('  - autoFinishTasks:', config.autoFinishTasks);
  }
  
  if (config.autoRefillStamina) {
    // Priority 1: Green background for auto refill stamina
    btn.style.background = `url('${greenBgUrl}') repeat`;
    btn.style.backgroundSize = "auto";
    btn.style.color = "#ffffff";
  } else if (config.autoCollectRewards || config.autoDayCare || config.autoPlayAfterDefeat || config.autoFinishTasks) {
    // Priority 2: Blue background for other auto features
    btn.style.background = `url('${blueBgUrl}') repeat`;
    btn.style.backgroundSize = "auto";
    btn.style.color = "#ffffff";
  } else {
    // Default: No features enabled
    btn.style.background = `url('${regularBgUrl}') repeat`;
    btn.style.color = "#ffe066";
  }
  
  btn.title = t('configButtonTooltip');
};

// Initialize the mod
function init() {
  console.log('[Bestiary Automator] Initializing UI...');
  
  // Preload background images
  preloadBackgroundImages();
  
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
  
  console.log('[Bestiary Automator] Initialization complete');
}

// Initialize the mod
init();

// Global sleep state management
let isTaskCheckingSleeping = false;
let sleepStartTime = 0;
let sleepDuration = 0;

// Track button state to prevent unnecessary updates
let lastButtonState = {
  autoRefillStamina: config.autoRefillStamina,
  autoCollectRewards: config.autoCollectRewards,
  autoDayCare: config.autoDayCare,
  autoPlayAfterDefeat: config.autoPlayAfterDefeat,
  autoFinishTasks: config.autoFinishTasks,
  boardAnalyzerRunning: false
};

// Initialize lastButtonState with current config values to prevent unnecessary updates
lastButtonState = {
  autoRefillStamina: config.autoRefillStamina,
  autoCollectRewards: config.autoCollectRewards,
  autoDayCare: config.autoDayCare,
  autoPlayAfterDefeat: config.autoPlayAfterDefeat,
  autoFinishTasks: config.autoFinishTasks,
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
    autoFinishTasks: config.autoFinishTasks,
    boardAnalyzerRunning: window.__modCoordination && window.__modCoordination.boardAnalyzerRunning
  };
  
  // Only update button styling if state has changed
  const stateChanged = JSON.stringify(currentButtonState) !== JSON.stringify(lastButtonState);
  
  if (stateChanged) {
    const btn = document.getElementById(CONFIG_BUTTON_ID);
    if (btn) {
      applyButtonStyling(btn);
    }
    
    // Update last known state
    lastButtonState = currentButtonState;
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
    cancelAllTimeouts();
    
    console.log('[Bestiary Automator] Cleanup completed');
  }
}; 
