// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[Better Setups] initializing...');

// Configuration constants
const defaultConfig = {
  enabled: false
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Early exit if mod is disabled
if (!config.enabled) {
  console.log('[Better Setups] Mod is disabled, skipping initialization');
  exports = {
    activate: () => console.log('[Better Setups] Mod is disabled'),
    updateConfig: (newConfig) => {
      Object.assign(config, newConfig);
      if (config.enabled) {
        console.log('[Better Setups] Mod enabled, please reload the page for changes to take effect');
      }
    },
    cleanup: () => {}
  };
} else {

const t = (key) => {
  if (typeof api !== 'undefined' && api.i18n && api.i18n.t) {
    return api.i18n.t(key);
  }
  if (typeof context !== 'undefined' && context.api && context.api.i18n && context.api.i18n.t) {
    return context.api.i18n.t(key);
  }
  return key;
};

const tReplace = (key, replacements) => {
  let text = t(key);
  Object.entries(replacements).forEach(([placeholder, value]) => {
    text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
  });
  return text;
};

function getDefaultLabels() {
  return [
    t('mods.betterSetups.defaultLabels.farm'),
    t('mods.betterSetups.defaultLabels.speedrun'),
    t('mods.betterSetups.defaultLabels.rankPoints'),
    t('mods.betterSetups.defaultLabels.boostedMap'),
    t('mods.betterSetups.defaultLabels.other')
  ];
}

function getSetupNoun(count) {
  return count === 1
    ? t('mods.betterSetups.setupNoun.singular')
    : t('mods.betterSetups.setupNoun.plural');
}

function isSetupShortcutsAndHoverEnabled() {
  return window.betterUIConfig?.enableSetupShortcutsAndHover !== false;
}

// Global observer for setup interface changes
let setupInterfaceObserver = null;

// Track trash buttons in confirmation mode (pending deletion)
const trashButtonsInConfirmation = new WeakSet();
const trashButtonTimeouts = new WeakMap();

// Global click handler to cancel confirmation when clicking outside
let globalClickHandler = null;

// Track pending label remove confirmation in settings (one at a time)
let activeLabelRemoveConfirmation = null;

// Game UI media URLs (loaded from bestiaryarena.com CDN)
const MEDIA_URLS = {
  BACKGROUND_BLUE: 'https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png',
  BORDER_BLUE: 'https://bestiaryarena.com/_next/static/media/1-frame-blue.cf300a6a.png',
  BACKGROUND_GREEN: 'https://bestiaryarena.com/_next/static/media/background-green.be515334.png',
  BORDER_GREEN: 'https://bestiaryarena.com/_next/static/media/1-frame-green.fe32d59c.png',
  BACKGROUND_RED: 'https://bestiaryarena.com/_next/static/media/background-red.21d3f4bd.png',
  BORDER_RED: 'https://bestiaryarena.com/_next/static/media/1-frame-red.946aade9.png',
  BACKGROUND_REGULAR: 'https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png',
  BORDER_REGULAR: 'https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png',
  BACKGROUND_DARK: 'https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png',
  BACKGROUND_DARKER: 'https://bestiaryarena.com/_next/static/media/background-darker.2679c837.png',
  FRAME_BORDER: 'https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png'
};

const SETTINGS_MODAL_CONFIG = {
  width: 350,
  height: 410,
  contentInset: 30,
  viewportPadding: 16,
  minWidth: 280,
  minHeight: 280
};

let betterSetupsModalLayoutCleanup = null;

const BETTER_SETUPS_SETTINGS_BUTTON_CLASS = {
  primary: 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-14',
  secondary: 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14',
  danger: 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1-red active:frame-pressed-1-red surface-red gap-1 px-2 py-0.5 pb-[3px] pixel-font-14'
};

// Button styling constants
const BUTTON_STYLES = {
  BASE: 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 gap-1 px-2 py-0.5 pb-[3px] pixel-font-14',
  EDIT: {
    backgroundImage: `url("${MEDIA_URLS.BACKGROUND_BLUE}"), url("${MEDIA_URLS.BORDER_BLUE}")`,
    backgroundSize: 'auto, 100% 100%',
    backgroundPosition: 'top left, center',
    backgroundRepeat: 'repeat, no-repeat',
    color: '#fff'
  },
  ADD: {
    backgroundImage: `url("${MEDIA_URLS.BACKGROUND_GREEN}"), url("${MEDIA_URLS.BORDER_GREEN}")`,
    backgroundSize: 'auto, 100% 100%',
    backgroundPosition: 'top left, center',
    backgroundRepeat: 'repeat, no-repeat',
    color: '#fff'
  },
  REMOVE: {
    backgroundImage: `url("${MEDIA_URLS.BACKGROUND_RED}"), url("${MEDIA_URLS.BORDER_RED}")`,
    backgroundSize: 'auto, 100% 100%',
    backgroundPosition: 'top left, center',
    backgroundRepeat: 'repeat, no-repeat',
    color: '#fff'
  }
};

// Storage keys for setup data
const STORAGE_KEYS = {
  SETUP_LABELS: 'stored-setup-labels',
  STORED_SETUPS: 'stored-setups'
};

const BETTER_SETUPS_TOAST_DURATION = 5000;
const BETTER_SETUPS_TOAST_CONTAINER_ID = 'better-setups-toast-container';

// =======================
// 2. Initialization & Lifecycle
// =======================

// Wait for game to be ready before activating setup labels
function waitForGameAndActivate() {
  // Check if the game state is available and the game is fully loaded
  if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.player) {
    console.log('[Better Setups] Game state detected, starting immediate initialization...');
    
    // Start the MutationObserver immediately for faster detection
    startSetupInterfaceObserver();
    
    // Activate setups immediately
    activateSetups();
    
    // Try immediate injection, then fallback with shorter delays
    if (!processSetupInterface()) {
      console.log('[Better Setups] Setup interface not ready, trying with shorter delays...');
      
      // Try multiple times with increasing delays for faster detection
      const tryInjection = (attempt = 1) => {
        if (attempt > 10) {
          console.log('[Better Setups] Max injection attempts reached, MutationObserver will handle it');
          return;
        }
        
        if (processSetupInterface()) {
          console.log(`[Better Setups] Setup interface found on attempt ${attempt}`);
          return;
        }
        
        // Try again with increasing delay (100ms, 200ms, 300ms, etc.)
        setTimeout(() => tryInjection(attempt + 1), attempt * 100);
      };
      
      tryInjection();
    } else {
      console.log('[Better Setups] Setup interface found immediately!');
    }
  } else {
    console.log('[Better Setups] Game state not ready, waiting...');
    setTimeout(waitForGameAndActivate, 500); // Reduced from 1000ms to 500ms
  }
}

// Start early initialization attempts for faster button injection
if (!window.__betterSetupsShortcutsHoverListenerAdded) {
  window.__betterSetupsShortcutsHoverListenerAdded = true;
  window.addEventListener('betterUISetupShortcutsAndHoverChanged', (event) => {
    hideSetupPreview();
    if (event.detail?.enabled) {
      processSetupInterface();
    }
  });
}

console.log('[Better Setups] Starting early initialization attempts...');

// Try immediate initialization first
if (processSetupInterface()) {
  console.log('[Better Setups] Setup interface found immediately on startup!');
  // Start observer for future changes
  startSetupInterfaceObserver();
} else {
  console.log('[Better Setups] Setup interface not ready, starting fast polling...');
  
  // Start fast polling immediately
  let earlyAttempts = 0;
  const earlyMaxAttempts = 30; // Try for 3 seconds with 100ms intervals
  
  const earlyPoll = () => {
    earlyAttempts++;
    
    if (processSetupInterface()) {
      console.log(`[Better Setups] Setup interface found after ${earlyAttempts} early polling attempts`);
      startSetupInterfaceObserver();
      return;
    }
    
    if (earlyAttempts < earlyMaxAttempts) {
      setTimeout(earlyPoll, 100);
    } else {
      console.log('[Better Setups] Early polling completed, switching to game state waiting');
      // Fall back to game state waiting
      waitForGameAndActivate();
    }
  };
  
  earlyPoll();
}

// Also start the game state waiting as a backup
waitForGameAndActivate();

// =======================
// 3. Core Setup Management
// =======================

// Main mod functionality
function activateSetups() {
  console.log('[Better Setups] activateSetups() called');
  
  try {
    // Check if stored setups are already enabled
    const storedSetupsEnabled = window.localStorage.getItem(STORAGE_KEYS.STORED_SETUPS);
    const existingLabels = window.localStorage.getItem(STORAGE_KEYS.SETUP_LABELS);
    const defaultLabels = getDefaultLabels();
    
    console.log('[Better Setups] Checking stored-setups flag:', storedSetupsEnabled);
    console.log('[Better Setups] Checking existing labels:', existingLabels);
    console.log('[Better Setups] Default labels to set:', defaultLabels);
    
    const labelsToSet = defaultLabels;
    
    if (storedSetupsEnabled === 'true' && existingLabels) {
      try {
        const parsedLabels = JSON.parse(existingLabels);
        console.log('[Better Setups] Found existing labels:', parsedLabels);
        console.log('[Better Setups] Stored setups already enabled, exiting silently');
        return; // Exit silently if already enabled
      } catch (parseError) {
        console.warn('[Better Setups] Failed to parse existing labels, proceeding with setup:', parseError);
      }
    } else {
      console.log('[Better Setups] No existing setup found, setting defaults');
    }
    
    // Set the stored setups flag
    console.log('[Better Setups] Setting stored-setups flag to true');
    window.localStorage.setItem(STORAGE_KEYS.STORED_SETUPS, 'true');
    
    // Set the stored setup labels
    console.log('[Better Setups] Setting labels in localStorage:', labelsToSet);
    window.localStorage.setItem(STORAGE_KEYS.SETUP_LABELS, JSON.stringify(labelsToSet));
    
    // Update the game state to enable stored setups
    console.log('[Better Setups] Updating game state to enable stored setups');
    globalThis.state.menu.trigger.setState({
      fn: (prev) => ({
        ...prev,
        flags: { ...prev.flags, storedSetups: true },
      }),
    });
    
    // Verify the settings were applied correctly
    const verifyFlag = window.localStorage.getItem('stored-setups');
    const verifyLabels = window.localStorage.getItem('stored-setup-labels');
    console.log('[Better Setups] Verification - stored-setups flag:', verifyFlag);
    console.log('[Better Setups] Verification - labels in localStorage:', verifyLabels);
    
    console.log('[Better Setups] Setup labels activated successfully');
    
    showSetupNotification(
      tReplace('mods.betterSetups.toast.labelsActivated', {
        labels: t('mods.betterSetups.defaultLabelsList')
      }),
      'success'
    );
  } catch (error) {
    console.error('[Better Setups] Error activating setups:', error);
    showSetupNotification(t('mods.betterSetups.toast.activationFailed'), 'error');
  }
}
// =======================
// 4. UI Injection & Button Management
// =======================

// Function to inject edit buttons into existing setup labels

// Function to cancel all pending confirmations
function cancelAllConfirmations() {
  const setupContainer = document.querySelector('.mb-2.flex.items-center.gap-2');
  if (setupContainer) {
    const trashButtons = setupContainer.querySelectorAll('button svg.lucide-trash2');
    trashButtons.forEach(trashIcon => {
      const trashButton = trashIcon.closest('button');
      if (trashButton && trashButtonsInConfirmation.has(trashButton)) {
        trashButtonsInConfirmation.delete(trashButton);
        trashButton.classList.remove('trash-button-confirming');
        if (trashButtonTimeouts.has(trashButton)) {
          clearTimeout(trashButtonTimeouts.get(trashButton));
          trashButtonTimeouts.delete(trashButton);
        }
      }
    });
  }
}

// Function to add confirmation handler to trash button
function addTrashButtonConfirmation(trashButton) {
  // Skip if already has confirmation handler
  if (trashButton.dataset.confirmationHandler === 'true') {
    return;
  }
  
  // Mark as having confirmation handler
  trashButton.dataset.confirmationHandler = 'true';
  
  // Add blinking animation style if not already added
  if (!document.getElementById('trash-button-blink-style')) {
    const style = document.createElement('style');
    style.id = 'trash-button-blink-style';
    style.textContent = `
      .trash-button-confirming {
        position: relative !important;
      }
      .trash-button-confirming::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: white;
        opacity: 0;
        pointer-events: none;
        z-index: 1;
        animation: trash-button-blink 0.3s linear infinite;
      }
      @keyframes trash-button-blink {
        0%, 100% { 
          opacity: 0;
        }
        50% { 
          opacity: 0.8;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Set up global click handler if not already set
  if (!globalClickHandler) {
    globalClickHandler = function(e) {
      // Capture phase runs on document BEFORE the trash button's listener. Detecting
      // "click on trash" only via closest('button svg...') misses when e.target is
      // the <button> itself (padding / empty hit area), so we wrongly cancel and the
      // confirm click restarts confirmation instead of deleting.
      const btn = e.target.closest('button');
      const clickedTrashButton =
        btn && btn.querySelector('svg.lucide-trash2') ? btn : null;
      if (!clickedTrashButton) {
        cancelAllConfirmations();
      }
    };
    document.addEventListener('click', globalClickHandler, true);
  }
  
  // Store the handler function
  const clickHandler = function(e) {
    // Check if this button is in confirmation mode
    if (trashButtonsInConfirmation.has(trashButton)) {
      // Second click - proceed with deletion
      console.log('[Better Setups] Trash button confirmed, proceeding with deletion');
      
      // Remove from confirmation mode FIRST
      trashButtonsInConfirmation.delete(trashButton);
      trashButton.classList.remove('trash-button-confirming');
      
      // Clear timeout if exists
      if (trashButtonTimeouts.has(trashButton)) {
        clearTimeout(trashButtonTimeouts.get(trashButton));
        trashButtonTimeouts.delete(trashButton);
      }
      
      // Prevent the original event first
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      // Remove our handler temporarily
      trashButton.removeEventListener('click', clickHandler, true);
      
      // Use setTimeout to ensure handler removal is complete, then trigger native click
      setTimeout(() => {
        // Try native click() method first - this should work with most frameworks
        try {
          trashButton.click();
          console.log('[Better Setups] Triggered native click() method');
        } catch (err) {
          console.warn('[Better Setups] Error with click():', err);
          // Fallback: dispatch synthetic event
          const newEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            detail: 1
          });
          trashButton.dispatchEvent(newEvent);
        }
        
        // Re-add our handler after a delay
        setTimeout(() => {
          trashButton.addEventListener('click', clickHandler, true);
        }, 100);
      }, 10);
    } else {
      // First click - start blinking confirmation
      console.log('[Better Setups] Trash button clicked, starting confirmation');
      
      // Prevent default deletion
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      // Add to confirmation mode
      trashButtonsInConfirmation.add(trashButton);
      trashButton.classList.add('trash-button-confirming');
      
      // Set timeout to reset confirmation after 3 seconds
      const timeout = setTimeout(() => {
        console.log('[Better Setups] Trash button confirmation timeout, resetting');
        trashButtonsInConfirmation.delete(trashButton);
        trashButton.classList.remove('trash-button-confirming');
        trashButtonTimeouts.delete(trashButton);
      }, 3000);
      
      trashButtonTimeouts.set(trashButton, timeout);
    }
  };
  
  // Add click handler with capture phase to intercept early
  trashButton.addEventListener('click', clickHandler, true);
}

// Function to inject edit buttons into a specific setup button
function injectEditButton(setupButton) {
  const buttonText = setupButton.textContent.trim();
  
  // Check if this is a setup/save button and doesn't already have an edit button
  if ((buttonText.includes('Setup (') || buttonText.includes('Save (')) && 
      !setupButton.parentElement.querySelector('.edit-label-btn')) {
    
    // Create edit button
    const editButton = createEditButton(() => {
      console.log('[Better Setups] Edit button clicked for:', buttonText);
      showEditSingleLabelModal(buttonText);
    });
    
    // Find trash button and insert edit button after it if it exists
    const parent = setupButton.parentElement;
    const trashButton = parent.querySelector('button svg.lucide-trash2')?.closest('button');
    
    if (trashButton) {
      // Add confirmation handler to trash button
      addTrashButtonConfirmation(trashButton);
      
      // Insert edit button after trash button
      parent.insertBefore(editButton, trashButton.nextSibling);
    } else {
      // No trash button found, append at end
      parent.appendChild(editButton);
    }
    
    console.log(`[Better Setups] Injected edit button for: ${buttonText}`);
    return true;
  }
  return false;
}

// Function to inject utility buttons (Load Setup, Settings) if not present (always last)
function injectEditLabelsButton(setupContainer) {
  const existingUtilityContainer = setupContainer.querySelector('.better-setups-utility-container');
  if (existingUtilityContainer) {
    existingUtilityContainer.remove();
    console.log('[Better Setups] Removed existing utility buttons for reordering');
  }
  
  const loadSetupButton = createSetupButton(t('mods.betterSetups.loadSetup'), 'edit', () => {
    console.log('[Better Setups] Load Setup clicked');
    showLoadSetupModal();
  });
  loadSetupButton.classList.add('load-setup-btn');

  const settingsButton = createSetupButton(t('mods.betterSetups.settings'), 'add', () => {
    console.log('[Better Setups] Settings clicked');
    showSettingsModal();
  });
  settingsButton.classList.add('settings-btn');
  
  const utilityContainer = document.createElement('div');
  utilityContainer.className = 'flex items-center gap-2 better-setups-utility-container';
  utilityContainer.appendChild(loadSetupButton);
  utilityContainer.appendChild(settingsButton);
  
  setupContainer.appendChild(utilityContainer);
  
  console.log('[Better Setups] Injected Load Setup and Settings buttons at the end');
  return true;
}

// Function to process setup interface and inject buttons
function processSetupInterface() {
  const setupContainer = document.querySelector('.mb-2.flex.items-center.gap-2');
  
  if (!setupContainer) {
    return false;
  }

  ensureSetupPreviewDelegation();
  
  console.log('[Better Setups] Processing setup interface...');
  
  // First, add confirmation handlers to all existing trash buttons
  const allTrashButtons = setupContainer.querySelectorAll('button svg.lucide-trash2');
  allTrashButtons.forEach(trashIcon => {
    const trashButton = trashIcon.closest('button');
    if (trashButton) {
      addTrashButtonConfirmation(trashButton);
    }
  });
  
  // Then, inject edit buttons for all setup labels
  const setupButtons = setupContainer.querySelectorAll('button');
  let injectedCount = 0;
  
  setupButtons.forEach(button => {
    const buttonText = button.textContent.trim();
    if (buttonText.includes('Setup (') || buttonText.includes('Save (')) {
      attachSetupButtonHoverPreview(button);
    }
    if (injectEditButton(button)) {
      injectedCount++;
    }
  });
  
  // Then, add utility buttons at the very end
  injectEditLabelsButton(setupContainer);
  
  if (injectedCount > 0) {
    console.log(`[Better Setups] Successfully injected ${injectedCount} edit buttons`);
  }
  
  console.log('[Better Setups] Utility buttons positioned at the end');
  return true;
}

// Function to inject edit buttons into setup interface
function injectSetupButtons() {
  console.log('[Better Setups] injectSetupButtons() called');
  
  // Try to process immediately
  if (processSetupInterface()) {
    console.log('[Better Setups] Setup interface found and processed immediately');
    return;
  }
  
  // If not found, try with aggressive polling for faster detection
  console.log('[Better Setups] Setup interface not found, using fast polling...');
  
  let attempts = 0;
  const maxAttempts = 20; // Try for up to 2 seconds with 100ms intervals
  
  const fastPoll = () => {
    attempts++;
    
    if (processSetupInterface()) {
      console.log(`[Better Setups] Setup interface found after ${attempts} fast polling attempts`);
      return;
    }
    
    if (attempts < maxAttempts) {
      setTimeout(fastPoll, 100); // Check every 100ms
    } else {
      console.log('[Better Setups] Fast polling completed, MutationObserver will handle future changes');
    }
  };
  
  fastPoll();
}

// Function to start MutationObserver for automatic button injection
function startSetupInterfaceObserver() {
  if (setupInterfaceObserver) {
    console.log('[Better Setups] Observer already running');
    return;
  }
  
  console.log('[Better Setups] Starting MutationObserver for setup interface...');
  
  setupInterfaceObserver = new MutationObserver((mutations) => {
    let shouldProcess = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
            // Check if any added nodes contain setup buttons
            const addedNodes = Array.from(mutation.addedNodes);
            addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Check if this node is a setup button or contains setup buttons
                if (node.matches && node.matches('button')) {
                  const buttonText = node.textContent.trim();
                  if (buttonText.includes('Setup (') || buttonText.includes('Save (')) {
                    shouldProcess = true;
                  }
                  // Also check if it's a trash button
                  if (node.querySelector && node.querySelector('svg.lucide-trash2')) {
                    shouldProcess = true;
                  }
                }
                
                // Check if this node contains setup buttons
                if (node.querySelectorAll) {
                  const setupButtons = node.querySelectorAll('button');
                  setupButtons.forEach(button => {
                    const buttonText = button.textContent.trim();
                    if (buttonText.includes('Setup (') || buttonText.includes('Save (')) {
                      shouldProcess = true;
                    }
                  });
                  
                  // Also check for trash buttons
                  const trashButtons = node.querySelectorAll('button svg.lucide-trash2');
                  if (trashButtons.length > 0) {
                    shouldProcess = true;
                  }
                }
                
                // Check if this is the setup container itself
                if (node.matches && node.matches('.mb-2.flex.items-center.gap-2')) {
                  shouldProcess = true;
                }
              }
            });
        
        // Check if any removed nodes might affect our buttons
        const removedNodes = Array.from(mutation.removedNodes);
        removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.querySelector && node.querySelector('.edit-label-btn')) {
              shouldProcess = true; // Re-inject if edit buttons were removed
            }
          }
        });
      }
      
      // Also check for attribute changes that might affect button text
      if (mutation.type === 'characterData' || mutation.type === 'childList') {
        const target = mutation.target;
        if (target.nodeType === Node.ELEMENT_NODE && target.tagName === 'BUTTON') {
          const buttonText = target.textContent.trim();
          if (buttonText.includes('Setup (') || buttonText.includes('Save (')) {
            shouldProcess = true;
          }
        }
      }
    });
    
    if (shouldProcess) {
      console.log('[Better Setups] Setup interface change detected, processing immediately...');
      // Process immediately for faster response, with fallback
      processSetupInterface();
      
      // Also try again after a tiny delay to catch any delayed DOM updates
      setTimeout(() => {
        processSetupInterface();
      }, 50);
    }
  });
  
  // Start observing the entire document for changes
  setupInterfaceObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: false // We don't need to watch attribute changes
  });
  
  console.log('[Better Setups] MutationObserver started successfully');
}

// Function to stop the MutationObserver
function stopSetupInterfaceObserver() {
  if (setupInterfaceObserver) {
    console.log('[Better Setups] Stopping MutationObserver...');
    setupInterfaceObserver.disconnect();
    setupInterfaceObserver = null;
  }
  
  // Clean up global click handler
  if (globalClickHandler) {
    document.removeEventListener('click', globalClickHandler, true);
    globalClickHandler = null;
  }
  
  // Cancel all pending confirmations
  cancelAllConfirmations();
}

// =======================
// 5. UI Creation Functions
// =======================

// Helper function to create styled text input (matching Dice_Roller.js style)
function createStyledTextInput(options = {}) {
  const input = document.createElement('input');
  input.type = 'text';
  
  // Apply Dice_Roller.js style
  input.style.background = 'rgba(255, 255, 255, 0.1)';
  input.style.color = 'rgb(255, 255, 255)';
  input.style.border = '1px solid rgba(255, 255, 255, 0.2)';
  input.style.padding = '3px 6px';
  input.style.borderRadius = '2px';
  input.style.fontSize = '12px';
  input.style.width = '100%';
  input.style.fontFamily = 'inherit';
  input.style.outline = 'none';
  input.style.boxSizing = 'border-box';
  
  // Apply custom options
  if (options.value !== undefined) input.value = options.value;
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.datasetIndex !== undefined) input.dataset.index = options.datasetIndex;
  
  // Apply custom styles (these will override the base styles if needed)
  if (options.styles) {
    Object.assign(input.style, options.styles);
  }
  
  return input;
}

// Helper function to create setup buttons with consistent styling
function createSetupButton(text, type, onClick) {
  const button = document.createElement('button');
  button.className = BUTTON_STYLES.BASE;
  button.textContent = text;
  button.onclick = onClick;
  
  // Apply background styles based on button type
  if (type === 'edit') {
    Object.assign(button.style, BUTTON_STYLES.EDIT);
  } else if (type === 'add') {
    Object.assign(button.style, BUTTON_STYLES.ADD);
  }
  
  return button;
}

// Helper function to create edit buttons with pencil icon
function createEditButton(onClick) {
  const button = document.createElement('button');
  button.className = `${BUTTON_STYLES.BASE} edit-label-btn`;
  button.onclick = onClick;
  
  // Apply edit button styles
  Object.assign(button.style, BUTTON_STYLES.EDIT);
  
  // Add pencil icon
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil" aria-hidden="true">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
      <path d="m15 5 4 4"></path>
    </svg>
  `;
  
  return button;
}

// =======================
// 6. Modal Management
// =======================

function closeModalInstance(modalRef) {
  if (!modalRef) return;
  if (typeof modalRef.close === 'function') {
    modalRef.close();
  } else if (typeof modalRef === 'function') {
    modalRef();
  }
}

function getBetterSetupsToastContainer() {
  if (typeof document === 'undefined') return null;
  let container = document.getElementById(BETTER_SETUPS_TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = BETTER_SETUPS_TOAST_CONTAINER_ID;
    container.style.cssText = 'position: fixed; z-index: 9999; inset: 16px 16px 64px; pointer-events: none;';
    document.body.appendChild(container);
  }
  return container;
}

function updateBetterSetupsToastPositions(container) {
  if (!container) return;
  const toasts = container.querySelectorAll('.better-setups-toast-item');
  toasts.forEach((toast, index) => {
    toast.style.transform = `translateY(-${index * 46}px)`;
  });
}

function showBetterSetupsToast(message, options = {}) {
  const safeMsg = (message != null && message !== '') ? String(message).replace(/</g, '&lt;') : '';
  const duration = typeof options.duration === 'number' && options.duration > 0
    ? options.duration
    : BETTER_SETUPS_TOAST_DURATION;

  try {
    const container = getBetterSetupsToastContainer();
    if (!container) return;

    const existingToasts = container.querySelectorAll('.better-setups-toast-item');
    const stackOffset = existingToasts.length * 46;

    const flexContainer = document.createElement('div');
    flexContainer.className = 'better-setups-toast-item';
    flexContainer.style.cssText = `display: flex; position: absolute; transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1); transform: translateY(-${stackOffset}px); bottom: 0px; right: 0px; justify-content: flex-end; pointer-events: none; width: max-content; max-width: 100%;`;

    const toast = document.createElement('button');
    toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
    toast.style.pointerEvents = 'auto';

    const widgetTop = document.createElement('div');
    widgetTop.className = 'widget-top h-2.5';

    const widgetBottom = document.createElement('div');
    widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'text-left';
    messageDiv.style.flex = '1 1 auto';
    if (safeMsg.indexOf('\n') !== -1) messageDiv.style.whiteSpace = 'pre-line';
    messageDiv.style.color = '#fff';
    messageDiv.textContent = safeMsg;

    widgetBottom.appendChild(messageDiv);
    toast.appendChild(widgetTop);
    toast.appendChild(widgetBottom);
    flexContainer.appendChild(toast);
    container.appendChild(flexContainer);

    const removeToast = () => {
      if (flexContainer.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        updateBetterSetupsToastPositions(container);
      }
    };

    toast.addEventListener('click', removeToast);
    setTimeout(removeToast, duration);
  } catch (error) {
    console.error('[Better Setups] Error showing toast:', error);
  }
}

function normalizeToastMessage(message, type = 'info') {
  const trimmed = String(message ?? '').trim();
  if (!trimmed || /[.!?]$/.test(trimmed)) return trimmed;
  if (type === 'success') return `${trimmed}!`;
  return `${trimmed}.`;
}

function showSetupNotification(message, type = 'info', duration = BETTER_SETUPS_TOAST_DURATION) {
  showBetterSetupsToast(normalizeToastMessage(message, type), { duration });
}

function isStructuredSetupCommand(commandText) {
  const trimmed = commandText.trim();
  return (
    (trimmed.startsWith('$configureBoard(') && trimmed.endsWith(')')) ||
    (trimmed.startsWith('$replay(') && trimmed.endsWith(')')) ||
    trimmed.startsWith('{')
  );
}

function looksLikeSetupScript(commandText) {
  const trimmed = commandText.trim();
  const setupPatterns = [
    /\$configureBoard\s*\(/,
    /\$replay\s*\(/,
    /\bconfigureBoard\s*\(/,
    /\breplay\s*\(/,
    /BestiaryModAPI/,
    /\$configureRunes\s*\(/,
    /\bconfigureRunes\s*\(/,
    /autoSetupBoard/,
    /selectRoomById/,
    /(?:globalThis\.)?state\.board\.send/
  ];
  return setupPatterns.some((pattern) => pattern.test(trimmed));
}

function isMeaninglessCommandResult(result) {
  return result === false;
}

function rejectInvalidSetupInput() {
  throw new Error('INVALID_SETUP_INPUT');
}

function parseBoardSetupCommand(commandText) {
  const trimmed = commandText.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('$configureBoard(') && trimmed.endsWith(')')) {
    return JSON.parse(trimmed.substring('$configureBoard('.length, trimmed.length - 1));
  }
  if (trimmed.startsWith('$replay(') && trimmed.endsWith(')')) {
    return JSON.parse(trimmed.substring('$replay('.length, trimmed.length - 1));
  }
  return JSON.parse(trimmed);
}

function executeSetupScript(commandText) {
  if (!looksLikeSetupScript(commandText)) {
    rejectInvalidSetupInput();
  }

  if (typeof window.executeCommand === 'function') {
    const result = window.executeCommand(commandText);
    if (isMeaninglessCommandResult(result)) {
      rejectInvalidSetupInput();
    }
    return;
  }

  const result = eval(commandText);
  if (isMeaninglessCommandResult(result)) {
    rejectInvalidSetupInput();
  }
}

function getSetupLoadedMessage() {
  return t('mods.betterSetups.toast.setupLoaded');
}

const LOAD_SETUP_USER_ERROR_KEYS = [
  'mods.betterSetups.errors.emptyCommand',
  'mods.betterSetups.errors.commandExecutionFailed',
  'mods.betterSetups.errors.noReplayFunction',
  'mods.betterSetups.errors.noConfigureBoardFunction'
];

function getLoadSetupErrorMessage(error) {
  const message = error?.message;
  if (message && LOAD_SETUP_USER_ERROR_KEYS.some((key) => message === t(key))) {
    return message;
  }
  return t('mods.betterSetups.toast.invalidConfigFormat');
}

function applySetupCommand(commandText) {
  const trimmed = commandText.trim();
  if (!trimmed) {
    throw new Error(t('mods.betterSetups.errors.emptyCommand'));
  }

  if (isStructuredSetupCommand(trimmed)) {
    applyBoardSetup(parseBoardSetupCommand(trimmed));
    return;
  }

  executeSetupScript(trimmed);
  showSetupNotification(getSetupLoadedMessage(), 'success', 4000);
}

function applyBoardSetup(boardData) {
  if (boardData.seed) {
    if (typeof window.$replay === 'function') {
      window.$replay(boardData);
    } else if (window.BestiaryModAPI?.utility?.replay) {
      window.BestiaryModAPI.utility.replay(boardData);
    } else {
      throw new Error(t('mods.betterSetups.errors.noReplayFunction'));
    }
  } else {
    if (typeof window.$configureBoard === 'function') {
      window.$configureBoard(boardData);
    } else if (window.BestiaryModAPI?.utility?.configureBoard) {
      window.BestiaryModAPI.utility.configureBoard(boardData);
    } else {
      throw new Error(t('mods.betterSetups.errors.noConfigureBoardFunction'));
    }
  }

  showSetupNotification(getSetupLoadedMessage(), 'success', 4000);
}

function showLoadSetupModal() {
  try {
    clearBetterSetupsModalLayoutCleanup();
    let modalRef = null;
    const modalDimensions = getBetterSetupsModalDimensions();
    const content = document.createElement('div');
    content.className = 'better-setups-modal-root';
    content.style.cssText = 'width:100%;height:100%;min-height:0;flex:1 1 0;display:flex;flex-direction:column;box-sizing:border-box;position:relative;border-radius:8px;overflow:hidden;';
    content.style.backgroundImage = `url("${MEDIA_URLS.BACKGROUND_BLUE}")`;
    content.style.backgroundSize = 'auto';
    content.style.backgroundPosition = 'top left';
    content.style.backgroundRepeat = 'repeat';
    content.style.padding = '10px';

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 8px;';
    overlay.style.backgroundImage = `url("${MEDIA_URLS.BACKGROUND_DARK}")`;
    overlay.style.backgroundSize = 'auto';
    overlay.style.backgroundPosition = 'top left';
    overlay.style.backgroundRepeat = 'repeat';
    content.appendChild(overlay);

    const contentContainer = document.createElement('div');
    contentContainer.className = 'better-setups-load-content';
    contentContainer.style.cssText = 'position: relative; z-index: 1; color: #fff; display: flex; flex-direction: column; gap: 10px; flex: 1 1 0; min-height: 0; height: 100%; box-sizing: border-box;';

    const description = document.createElement('p');
    description.style.cssText = 'margin: 0; font-size: 14px; line-height: 1.4;';
    description.textContent = t('mods.betterSetups.loadSetupDescription');
    contentContainer.appendChild(description);

    const commandTextarea = document.createElement('textarea');
    commandTextarea.className = 'better-setups-load-textarea';
    commandTextarea.placeholder = t('mods.betterSetups.loadSetupPlaceholder');
    commandTextarea.style.cssText = 'width: 100%; flex: 1 1 0; min-height: 120px; background-color: rgba(0, 0, 0, 0.4); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; padding: 8px; font-family: monospace; font-size: 12px; resize: none; box-sizing: border-box; overflow-y: auto;';
    contentContainer.appendChild(commandTextarea);

    const applyButton = createSetupButton(t('mods.betterSetups.applySetup'), 'add', () => {
      const commandText = commandTextarea.value.trim();
      if (!commandText) {
        showSetupNotification(t('mods.betterSetups.toast.pasteValidConfig'), 'warning');
        return;
      }

      try {
        applySetupCommand(commandText);
        closeModalInstance(modalRef);
      } catch (error) {
        console.error('[Better Setups] Error applying team configuration:', error);
        showSetupNotification(getLoadSetupErrorMessage(error), 'error');
      }
    });
    applyButton.style.width = '100%';
    applyButton.style.flexShrink = '0';
    contentContainer.appendChild(applyButton);

    content.appendChild(contentContainer);

    modalRef = api.ui.components.createModal({
      title: t('mods.betterSetups.loadSetupTitle'),
      content: content,
      width: modalDimensions.width,
      height: modalDimensions.height,
      buttons: [
        {
          text: t('mods.betterSetups.close'),
          primary: true,
          onClick: () => {
            console.log('[Better Setups] Load setup modal closed');
          }
        }
      ],
      onClose: () => {
        clearBetterSetupsModalLayoutCleanup();
      }
    });
    setupBetterSetupsModalResponsiveLayout(modalRef, content);
  } catch (error) {
    console.error('[Better Setups] Error showing load setup modal:', error);
  }
}

// Function to show edit single label modal
function showEditSingleLabelModal(currentLabelText) {
  console.log('[Better Setups] showEditSingleLabelModal() called for:', currentLabelText);
  
  try {
    // Extract the label name from the button text (e.g., "Setup (rank)" -> "rank")
    const labelMatch = currentLabelText.match(/\(([^)]+)\)/);
    const currentLabel = labelMatch ? labelMatch[1] : currentLabelText;
    
    // Get current labels
    const existingLabels = window.localStorage.getItem('stored-setup-labels');
    let currentLabels = getDefaultLabels();
    
    if (existingLabels) {
      try {
        currentLabels = JSON.parse(existingLabels);
      } catch (e) {
        console.warn('[Better Setups] Failed to parse existing labels, using defaults');
      }
    }
    
    // Create modal content with blue background
    const content = document.createElement('div');
    content.style.backgroundImage = `url("${MEDIA_URLS.BACKGROUND_BLUE}")`;
    content.style.backgroundSize = 'auto';
    content.style.backgroundPosition = 'top left';
    content.style.backgroundRepeat = 'repeat';
    content.style.padding = '10px';
    content.style.borderRadius = '8px';
    content.style.minHeight = 'auto';
    content.style.position = 'relative';
    
    // Add overlay for better text readability
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundImage = `url("${MEDIA_URLS.BACKGROUND_DARK}")`;
    overlay.style.backgroundSize = 'auto';
    overlay.style.backgroundPosition = 'top left';
    overlay.style.backgroundRepeat = 'repeat';
    overlay.style.borderRadius = '8px';
    content.appendChild(overlay);
    
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.style.position = 'relative';
    contentContainer.style.zIndex = '1';
    contentContainer.style.color = '#fff';
    const editLabelText = document.createElement('p');
    editLabelText.style.cssText = 'margin: 0 0 8px 0; font-size: 14px;';
    editLabelText.appendChild(document.createTextNode(`${t('mods.betterSetups.editLabelPrefix')} `));
    const editLabelHighlight = document.createElement('strong');
    editLabelHighlight.style.color = '#ffe066';
    editLabelHighlight.textContent = currentLabel;
    editLabelText.appendChild(editLabelHighlight);
    contentContainer.appendChild(editLabelText);
    
    const input = createStyledTextInput({
      value: currentLabel,
      styles: { marginTop: '5px' }
    });
    
    contentContainer.appendChild(input);
    content.appendChild(contentContainer);
    
    // Show modal
    api.ui.components.createModal({
      title: t('mods.betterSetups.editSetupLabelTitle'),
      content: content,
      buttons: [
        {
          text: t('mods.betterSetups.cancel'),
          primary: false,
          onClick: () => {
            console.log('[Better Setups] Edit label cancelled');
          }
        },
        {
          text: t('mods.betterSetups.save'),
          primary: true,
          onClick: () => {
            const newLabel = input.value.trim();
            if (!newLabel) {
              showSetupNotification(t('mods.betterSetups.toast.enterLabelName'), 'warning');
              return;
            }
            
            if (newLabel === currentLabel) {
              console.log('[Better Setups] No changes made');
              return;
            }
            
            // Update the label in the array
            const labelIndex = currentLabels.indexOf(currentLabel);
            if (labelIndex !== -1) {
              currentLabels[labelIndex] = newLabel;
            } else {
              // If not found, add it
              currentLabels.push(newLabel);
            }
            
            // Update setup data in localStorage to rename setups
            console.log('[Better Setups] About to update setup data in localStorage');
            updateSetupDataLabel(currentLabel, newLabel);
            
            // Save updated labels
            console.log('[Better Setups] Saving updated labels to localStorage:', currentLabels);
            window.localStorage.setItem(STORAGE_KEYS.SETUP_LABELS, JSON.stringify(currentLabels));
            console.log('[Better Setups] Labels saved successfully');
            
            // Update game state
            globalThis.state.menu.trigger.setState({
              fn: (prev) => ({
                ...prev,
                flags: { ...prev.flags, storedSetups: true },
              }),
            });
            
            // Update the button text immediately
            updateButtonText(currentLabel, newLabel);
            
            // Re-inject edit buttons to ensure they appear on updated buttons
            setTimeout(() => {
              console.log('[Better Setups] Re-injecting edit buttons after label update');
              processSetupInterface();
            }, 100);
            
            showSetupNotification(tReplace('mods.betterSetups.toast.labelUpdated', {
              oldLabel: currentLabel,
              newLabel
            }), 'success');
          }
        }
      ]
    });
  } catch (error) {
    console.error('[Better Setups] Error showing edit single label modal:', error);
  }
}

function createSettingsActionButton(text, options = {}) {
  const { fullWidth = false, variant = 'secondary' } = options;
  const variantClassMap = {
    gray: 'secondary',
    secondary: 'secondary',
    blue: 'secondary',
    green: 'primary',
    red: 'danger'
  };
  const classKey = variantClassMap[variant] || 'secondary';

  const button = document.createElement('button');
  button.className = BETTER_SETUPS_SETTINGS_BUTTON_CLASS[classKey];
  button.style.cursor = 'pointer';
  if (fullWidth) {
    button.style.width = '100%';
  }

  const textSpan = document.createElement('span');
  textSpan.textContent = text;
  button.appendChild(textSpan);

  return button;
}

function getBetterSetupsModalDimensions() {
  const pad = SETTINGS_MODAL_CONFIG.viewportPadding * 2;
  return {
    width: Math.max(
      SETTINGS_MODAL_CONFIG.minWidth,
      Math.min(SETTINGS_MODAL_CONFIG.width, window.innerWidth - pad)
    ),
    height: Math.max(
      SETTINGS_MODAL_CONFIG.minHeight,
      Math.min(SETTINGS_MODAL_CONFIG.height, window.innerHeight - pad)
    )
  };
}

function getBetterSetupsDialog(modalRef) {
  if (modalRef?.element) return modalRef.element;
  if (modalRef instanceof HTMLElement) return modalRef;
  return document.querySelector('div[role="dialog"][data-state="open"]');
}

function clearBetterSetupsModalLayoutCleanup() {
  if (betterSetupsModalLayoutCleanup) {
    betterSetupsModalLayoutCleanup();
    betterSetupsModalLayoutCleanup = null;
  }
}

function applyBetterSetupsModalLayout(modalRef, contentRoot, dimensions) {
  const dialog = getBetterSetupsDialog(modalRef);
  if (!dialog) return;

  const { width, height } = dimensions;

  dialog.style.width = `${width}px`;
  dialog.style.minWidth = '0';
  dialog.style.maxWidth = `${width}px`;
  dialog.style.height = `${height}px`;
  dialog.style.minHeight = '0';
  dialog.style.maxHeight = `${height}px`;
  dialog.style.boxSizing = 'border-box';
  dialog.classList.remove('max-w-[300px]');

  const rootWrapper = dialog.querySelector(':scope > div');
  if (rootWrapper) {
    rootWrapper.style.height = '100%';
    rootWrapper.style.display = 'flex';
    rootWrapper.style.flexDirection = 'column';
    rootWrapper.style.flex = '1 1 0';
    rootWrapper.style.minHeight = '0';
  }

  const contentContainer = dialog.querySelector('.widget-bottom');
  if (contentContainer) {
    Object.assign(contentContainer.style, {
      flex: '1 1 auto',
      minHeight: '0',
      overflowY: 'hidden',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });
  }

  if (contentRoot) {
    Object.assign(contentRoot.style, {
      flex: '1 1 0',
      minHeight: '0',
      height: '100%',
      maxHeight: 'none',
      width: '100%',
      minWidth: '0',
      maxWidth: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });

    const settingsPanel = contentRoot.querySelector('#better-setups-settings-panel');
    if (settingsPanel) {
      Object.assign(settingsPanel.style, {
        flex: '1 1 0',
        minHeight: '0',
        height: '100%',
        overflow: 'hidden'
      });
    }

    const labelsList = contentRoot.querySelector('#better-setups-labels-list');
    if (labelsList) {
      Object.assign(labelsList.style, {
        flex: '1 1 0',
        minHeight: '0',
        overflowY: 'auto'
      });
    }

    const loadContainer = contentRoot.querySelector('.better-setups-load-content');
    if (loadContainer) {
      Object.assign(loadContainer.style, {
        flex: '1 1 0',
        minHeight: '0',
        height: '100%',
        overflow: 'hidden'
      });
    }

    const loadTextarea = contentRoot.querySelector('.better-setups-load-textarea');
    if (loadTextarea) {
      Object.assign(loadTextarea.style, {
        flex: '1 1 0',
        minHeight: '120px',
        maxHeight: 'none',
        height: 'auto',
        overflowY: 'auto'
      });
    }
  }
}

function setupBetterSetupsModalResponsiveLayout(modalRef, contentRoot) {
  clearBetterSetupsModalLayoutCleanup();
  const apply = () => applyBetterSetupsModalLayout(modalRef, contentRoot, getBetterSetupsModalDimensions());
  apply();
  const onResize = () => apply();
  window.addEventListener('resize', onResize);
  betterSetupsModalLayoutCleanup = () => {
    window.removeEventListener('resize', onResize);
  };
}

function getSettingsAutosaveText() {
  return t('mods.betterSetups.settingsAutoSave');
}

function injectSettingsModalAutosaveFooter() {
  setTimeout(() => {
    const modalElement = document.querySelector('div[role="dialog"][data-state="open"]');
    if (!modalElement) return;

    const footer = modalElement.querySelector('.flex.justify-end.gap-2');
    if (!footer || footer.querySelector('.better-setups-autosave-indicator')) return;

    const autoSaveIndicator = document.createElement('div');
    autoSaveIndicator.className = 'pixel-font-16 better-setups-autosave-indicator';
    autoSaveIndicator.style.cssText = 'font-size: 11px; color: rgb(74, 222, 128); font-style: italic; margin-right: auto;';
    autoSaveIndicator.textContent = getSettingsAutosaveText();

    footer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 8px;';
    footer.insertBefore(autoSaveIndicator, footer.firstChild);

    footer.querySelectorAll('button').forEach((button) => {
      button.className = BETTER_SETUPS_SETTINGS_BUTTON_CLASS.secondary;
      button.style.cssText = 'cursor: pointer;';
      const label = button.textContent?.trim();
      if (label && !button.querySelector('span')) {
        button.textContent = '';
        const textSpan = document.createElement('span');
        textSpan.textContent = label;
        button.appendChild(textSpan);
      }
    });
  }, 100);
}

function triggerStoredSetupsRefresh() {
  globalThis.state.menu.trigger.setState({
    fn: (prev) => ({
      ...prev,
      flags: { ...prev.flags, storedSetups: true },
    }),
  });
}

function saveSetupLabels(labels) {
  window.localStorage.setItem(STORAGE_KEYS.SETUP_LABELS, JSON.stringify(labels));
  triggerStoredSetupsRefresh();
}

function renameSetupLabel(oldLabel, newLabel, refreshPanel) {
  const trimmedLabel = newLabel.trim();
  if (!trimmedLabel) {
    showSetupNotification(t('mods.betterSetups.toast.enterLabelName'), 'warning');
    return false;
  }
  if (trimmedLabel === oldLabel) return true;

  const currentLabels = getCurrentLabels();
  const oldLabelIndex = currentLabels.indexOf(oldLabel);
  if (oldLabelIndex === -1) return false;

  if (currentLabels.includes(trimmedLabel) && trimmedLabel !== oldLabel) {
    showSetupNotification(tReplace('mods.betterSetups.toast.labelExists', { label: trimmedLabel }), 'warning');
    return false;
  }

  currentLabels[oldLabelIndex] = trimmedLabel;
  saveSetupLabels(currentLabels);
  updateSetupDataLabel(oldLabel, trimmedLabel);
  updateButtonText(oldLabel, trimmedLabel);
  refreshSetupInterface();
  if (refreshPanel) refreshPanel();
  showSetupNotification(tReplace('mods.betterSetups.toast.labelUpdated', {
    oldLabel,
    newLabel: trimmedLabel
  }), 'success');
  return true;
}

function getSetupKeysForLabel(label) {
  return Object.keys(localStorage).filter((key) => key.startsWith(`${label}-`));
}

function deleteSetupDataForLabel(label) {
  const keysToDelete = getSetupKeysForLabel(label);
  keysToDelete.forEach((key) => localStorage.removeItem(key));
  return keysToDelete.length;
}

function getRemoveLabelConfirmationText(label, setupCount) {
  if (setupCount > 0) {
    return tReplace('mods.betterSetups.removeConfirm.withSetups', {
      label,
      count: setupCount,
      setupNoun: getSetupNoun(setupCount)
    });
  }

  return tReplace('mods.betterSetups.removeConfirm.noSetups', { label });
}

function performRemoveSetupLabel(label, refreshPanel) {
  const currentLabels = getCurrentLabels();
  const labelIndex = currentLabels.indexOf(label);
  if (labelIndex === -1) return false;

  const deletedSetupCount = deleteSetupDataForLabel(label);

  currentLabels.splice(labelIndex, 1);
  saveSetupLabels(currentLabels);

  window.dispatchEvent(new CustomEvent('setupLabelsChanged', {
    detail: {
      action: 'remove',
      removedLabel: label,
      remainingLabels: currentLabels,
      deletedSetupCount
    }
  }));

  refreshSetupInterface();
  if (refreshPanel) refreshPanel();

  const successMessage = deletedSetupCount > 0
    ? tReplace(
      deletedSetupCount === 1
        ? 'mods.betterSetups.toast.labelRemovedWithOneDeletion'
        : 'mods.betterSetups.toast.labelRemovedWithManyDeletions',
      { label, count: deletedSetupCount }
    )
    : tReplace('mods.betterSetups.toast.labelRemoved', { label });
  showSetupNotification(successMessage, 'success');
  return true;
}

function clearLabelRemoveConfirmationListener() {
  if (!activeLabelRemoveConfirmation) return;
  document.removeEventListener('mousedown', activeLabelRemoveConfirmation.outsideClickHandler, true);
  activeLabelRemoveConfirmation = null;
}

function cancelLabelRemoveConfirmation() {
  if (!activeLabelRemoveConfirmation) return;
  const { refreshPanel } = activeLabelRemoveConfirmation;
  clearLabelRemoveConfirmationListener();
  refreshPanel();
}

function showLabelRemoveConfirmation(labelRow, label, refreshPanel) {
  if (activeLabelRemoveConfirmation?.label === label) return;

  if (activeLabelRemoveConfirmation) {
    const targetLabel = label;
    cancelLabelRemoveConfirmation();
    const panel = document.getElementById('better-setups-settings-panel');
    labelRow = panel?.querySelector(`[data-label-name="${CSS.escape(targetLabel)}"]`);
    if (!labelRow) return;
    label = targetLabel;
  }

  const setupCount = getSetupKeysForLabel(label).length;

  labelRow.innerHTML = '';
  labelRow.classList.add('better-setups-label-remove-confirm');
  labelRow.style.cssText = 'display: flex; flex-direction: column; gap: 6px; padding: 8px; background: rgba(139, 0, 0, 0.15); border: 1px solid rgba(231, 76, 60, 0.3); border-radius: 4px; margin-bottom: 4px;';

  const message = document.createElement('p');
  message.style.cssText = 'margin: 0; font-size: 12px; color: #e74c3c; line-height: 1.4;';
  message.textContent = getRemoveLabelConfirmationText(label, setupCount);

  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; gap: 6px; justify-content: flex-end;';

  const cancelBtn = createSettingsActionButton(t('mods.betterSetups.cancel'), { variant: 'secondary' });
  cancelBtn.onclick = () => cancelLabelRemoveConfirmation();

  const confirmBtn = createSettingsActionButton(t('mods.betterSetups.remove'), { variant: 'red' });
  confirmBtn.onclick = () => {
    clearLabelRemoveConfirmationListener();
    performRemoveSetupLabel(label, refreshPanel);
  };

  const outsideClickHandler = (event) => {
    if (labelRow.contains(event.target)) return;
    cancelLabelRemoveConfirmation();
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  labelRow.appendChild(message);
  labelRow.appendChild(actions);

  activeLabelRemoveConfirmation = { labelRow, label, refreshPanel, outsideClickHandler };
  setTimeout(() => {
    if (activeLabelRemoveConfirmation?.labelRow === labelRow) {
      document.addEventListener('mousedown', outsideClickHandler, true);
    }
  }, 0);
}

function persistLabelOrderFromList(labelsList) {
  const rows = labelsList.querySelectorAll('.better-setups-label-row');
  const newOrder = Array.from(rows)
    .map((row) => row.dataset.labelName)
    .filter(Boolean);

  if (!newOrder.length) return false;

  const currentLabels = getCurrentLabels();
  if (newOrder.length !== currentLabels.length) return false;

  const orderUnchanged = newOrder.every((label, index) => currentLabels[index] === label);
  if (orderUnchanged) return false;

  saveSetupLabels(newOrder);
  refreshSetupInterface();
  return true;
}

function ensureLabelDragStyles() {
  if (document.getElementById('better-setups-drag-styles')) return;

  const style = document.createElement('style');
  style.id = 'better-setups-drag-styles';
  style.textContent = `
    .better-setups-label-row.is-dragging {
      opacity: 0.45;
    }
    .better-setups-drag-handle {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
      padding: 0 4px;
      cursor: grab;
      user-select: none;
      flex: 0 0 auto;
    }
    .better-setups-drag-handle:active {
      cursor: grabbing;
    }
    .better-setups-drag-handle-line {
      display: block;
      width: 12px;
      height: 2px;
      background: #777;
      border-radius: 1px;
      transition: background 0.15s ease;
    }
    .better-setups-drag-handle:hover .better-setups-drag-handle-line {
      background: #bbb;
    }
  `;
  document.head.appendChild(style);
}

function createLabelDragHandle() {
  ensureLabelDragStyles();

  const dragHandle = document.createElement('span');
  dragHandle.className = 'better-setups-drag-handle';
  dragHandle.title = t('mods.betterSetups.dragToReorder');
  dragHandle.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < 3; i++) {
    const line = document.createElement('span');
    line.className = 'better-setups-drag-handle-line';
    dragHandle.appendChild(line);
  }

  return dragHandle;
}

function resetLabelRowDragState(labelRow) {
  labelRow.draggable = false;
  labelRow.classList.remove('is-dragging');
  labelRow.style.opacity = '';
  labelRow.style.outline = '';
  labelRow.style.background = '';
}

function attachLabelRowDragDrop(labelRow, labelsList) {
  ensureLabelDragStyles();
  labelRow.classList.add('better-setups-label-row');
  labelRow.draggable = false;

  const dragHandle = createLabelDragHandle();

  dragHandle.addEventListener('mousedown', () => {
    labelRow.draggable = true;
  });
  dragHandle.addEventListener('mouseup', () => {
    setTimeout(() => {
      if (!labelRow.classList.contains('is-dragging')) {
        labelRow.draggable = false;
      }
    }, 50);
  });

  labelRow.addEventListener('dragstart', (event) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', labelRow.dataset.labelName || '');
    labelRow.classList.add('is-dragging');
  });

  labelRow.addEventListener('dragend', () => {
    resetLabelRowDragState(labelRow);
    persistLabelOrderFromList(labelsList);
  });

  labelRow.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const dragging = labelsList.querySelector('.better-setups-label-row.is-dragging');
    if (!dragging || dragging === labelRow) return;

    const rect = labelRow.getBoundingClientRect();
    const middleY = rect.top + rect.height / 2;
    const targetNext = event.clientY < middleY ? labelRow : labelRow.nextSibling;
    if (dragging.nextSibling === targetNext) return;

    labelsList.insertBefore(dragging, targetNext);
  });

  labelRow.addEventListener('drop', (event) => {
    event.preventDefault();
  });

  return dragHandle;
}

function addSetupLabel(newLabel, refreshPanel) {
  const trimmedLabel = newLabel.trim();
  if (!trimmedLabel) {
    showSetupNotification(t('mods.betterSetups.toast.enterLabelName'), 'warning');
    return false;
  }

  const currentLabels = getCurrentLabels();
  if (currentLabels.includes(trimmedLabel)) {
    showSetupNotification(tReplace('mods.betterSetups.toast.labelExists', { label: trimmedLabel }), 'warning');
    return false;
  }

  currentLabels.push(trimmedLabel);
  saveSetupLabels(currentLabels);
  refreshSetupInterface();
  if (refreshPanel) refreshPanel();
  showSetupNotification(tReplace('mods.betterSetups.toast.labelAdded', { label: trimmedLabel }), 'success');
  return true;
}

function renderLabelsSettingsPanel(container) {
  clearLabelRemoveConfirmationListener();
  container.innerHTML = '';

  Object.assign(container.style, {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '0',
    boxSizing: 'border-box',
    overflow: 'hidden'
  });

  const sectionTitle = document.createElement('h4');
  sectionTitle.textContent = t('mods.betterSetups.setupLabelsTitle');
  sectionTitle.style.cssText = 'margin: 0 0 4px 0; color: #fff; font-size: 14px; border-bottom: 1px solid #444; padding-bottom: 6px; flex-shrink: 0;';
  container.appendChild(sectionTitle);

  const sectionHint = document.createElement('p');
  sectionHint.textContent = t('mods.betterSetups.setupLabelsHint');
  sectionHint.style.cssText = 'margin: 0 0 8px 0; font-size: 11px; color: #888; flex-shrink: 0;';
  container.appendChild(sectionHint);

  const labelsList = document.createElement('div');
  labelsList.id = 'better-setups-labels-list';
  labelsList.style.cssText = 'display: flex; flex-direction: column; gap: 6px; flex: 1 1 auto; min-height: 0; overflow-y: auto;';

  const refreshPanel = () => renderLabelsSettingsPanel(container);

  const labels = getCurrentLabels();
  labels.forEach((label) => {
    const labelRow = document.createElement('div');
    labelRow.dataset.labelName = label;
    labelRow.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.1);';

    const labelInput = createStyledTextInput({
      value: label,
      styles: { flex: '1', fontSize: '12px' }
    });
    labelInput.dataset.originalLabel = label;

    const dragHandle = attachLabelRowDragDrop(labelRow, labelsList);

    const commitRename = () => {
      const originalLabel = labelInput.dataset.originalLabel;
      if (renameSetupLabel(originalLabel, labelInput.value, refreshPanel)) {
        const trimmedLabel = labelInput.value.trim();
        labelInput.dataset.originalLabel = trimmedLabel;
        labelRow.dataset.labelName = trimmedLabel;
      } else {
        labelInput.value = originalLabel;
      }
    };

    labelInput.addEventListener('blur', commitRename);
    labelInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        labelInput.blur();
      } else if (event.key === 'Escape') {
        labelInput.value = labelInput.dataset.originalLabel;
        labelInput.blur();
      }
    });

    const removeBtn = createSettingsActionButton(t('mods.betterSetups.remove'), { variant: 'red' });
    removeBtn.onclick = () => {
      showLabelRemoveConfirmation(
        labelRow,
        labelInput.dataset.originalLabel,
        refreshPanel
      );
    };

    labelRow.appendChild(dragHandle);
    labelRow.appendChild(labelInput);
    labelRow.appendChild(removeBtn);
    labelsList.appendChild(labelRow);
  });

  container.appendChild(labelsList);

  const addRow = document.createElement('div');
  addRow.id = 'better-setups-add-label-row';
  addRow.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-top: auto; flex-shrink: 0; padding-top: 8px;';

  const addInput = createStyledTextInput({
    placeholder: t('mods.betterSetups.newLabelPlaceholder'),
    styles: { flex: '1', fontSize: '12px' }
  });

  const addBtn = createSettingsActionButton(t('mods.betterSetups.add'), { variant: 'green' });
  addBtn.onclick = () => {
    if (addSetupLabel(addInput.value, refreshPanel)) {
      addInput.value = '';
    }
  };
  addInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addBtn.click();
    }
  });

  addRow.appendChild(addInput);
  addRow.appendChild(addBtn);
  container.appendChild(addRow);
}

function showSettingsModal() {
  try {
    clearBetterSetupsModalLayoutCleanup();
    clearLabelRemoveConfirmationListener();
    console.log('[Better Setups] showSettingsModal() called');

    const modalDimensions = getBetterSetupsModalDimensions();
    const content = document.createElement('div');
    content.className = 'better-setups-modal-root';
    Object.assign(content.style, {
      width: '100%',
      height: '100%',
      minWidth: '0',
      maxWidth: '100%',
      minHeight: '0',
      maxHeight: 'none',
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      border: '6px solid transparent',
      borderImage: `url("${MEDIA_URLS.FRAME_BORDER}") 6 fill`,
      backgroundImage: `url("${MEDIA_URLS.BACKGROUND_DARK}")`,
      padding: '8px'
    });

    const settingsPanel = document.createElement('div');
    settingsPanel.id = 'better-setups-settings-panel';
    Object.assign(settingsPanel.style, {
      height: '100%',
      flex: '1 1 0',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '0',
      overflow: 'hidden',
      padding: '2px 4px',
      boxSizing: 'border-box'
    });

    renderLabelsSettingsPanel(settingsPanel);
    content.appendChild(settingsPanel);

    const modalRef = api.ui.components.createModal({
      title: t('mods.betterSetups.settingsTitle'),
      width: modalDimensions.width,
      height: modalDimensions.height,
      content: content,
      buttons: [
        {
          text: t('mods.betterSetups.close'),
          primary: true,
          onClick: () => {
            console.log('[Better Setups] Settings modal closed');
          }
        }
      ],
      onClose: () => {
        clearBetterSetupsModalLayoutCleanup();
      }
    });

    setupBetterSetupsModalResponsiveLayout(modalRef, content);
    injectSettingsModalAutosaveFooter();
  } catch (error) {
    console.error('[Better Setups] Error showing settings modal:', error);
  }
}

// =======================
// 7. Data Management & Updates
// =======================

// Function to get current labels from localStorage
function getCurrentLabels() {
  try {
    const existingLabels = window.localStorage.getItem('stored-setup-labels');
    let currentLabels = getDefaultLabels();
    
    if (existingLabels) {
      try {
        currentLabels = JSON.parse(existingLabels);
      } catch (e) {
        console.warn('[Better Setups] Failed to parse existing labels, using defaults');
      }
    }
    
    return currentLabels;
  } catch (error) {
    console.error('[Better Setups] Error getting current labels:', error);
    return getDefaultLabels();
  }
}

// Function to refresh the entire setup interface
function refreshSetupInterface() {
  console.log('[Better Setups] Refreshing entire setup interface');
  
  // Clear all existing mod buttons to avoid duplicates
  const existingEditButtons = document.querySelectorAll('.edit-label-btn');
  existingEditButtons.forEach(btn => btn.remove());
  
  const existingUtilityContainer = document.querySelector('.better-setups-utility-container');
  if (existingUtilityContainer) {
    existingUtilityContainer.remove();
  }
  
  // Trigger storage event to notify the game
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'stored-setup-labels',
    newValue: window.localStorage.getItem('stored-setup-labels'),
    oldValue: null,
    storageArea: window.localStorage
  }));
  
  // Dispatch custom event for any game listeners
  window.dispatchEvent(new CustomEvent('setupInterfaceRefresh', {
    detail: { 
      action: 'refresh',
      timestamp: Date.now()
    }
  }));
  
  // Re-inject all buttons immediately, then again after a tiny delay for safety
  processSetupInterface();
  
  setTimeout(() => {
    processSetupInterface();
  }, 50);
}

// Function to update button text dynamically
function updateButtonText(oldLabel, newLabel) {
  console.log('[Better Setups] Updating button text:', oldLabel, '→', newLabel);
  
  try {
    // Find all buttons that contain the old label
    const allButtons = document.querySelectorAll('button');
    
    allButtons.forEach(button => {
      const buttonText = button.textContent.trim();
      
      // Check if this button contains the old label
      if (buttonText.includes(`(${oldLabel})`)) {
        // Update the button text
        const newText = buttonText.replace(`(${oldLabel})`, `(${newLabel})`);
        button.textContent = newText;
        console.log('[Better Setups] Updated button:', buttonText, '→', newText);
      }
    });
    
    // Also trigger a storage event to notify the game
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'stored-setup-labels',
      newValue: window.localStorage.getItem('stored-setup-labels'),
      oldValue: null,
      storageArea: window.localStorage
    }));
    
  } catch (error) {
    console.error('[Better Setups] Error updating button text:', error);
  }
}

// Function to update setup data when renaming labels
function updateSetupDataLabel(oldLabel, newLabel) {
  console.log('[Better Setups] Updating setup data:', oldLabel, '→', newLabel);
  
  try {
    // Based on the config structure, setups are stored with keys like "Farm-crcat", "Farm-khub"
    // When we change a label, we need to rename these keys to maintain the association
    
    console.log('[Better Setups] Looking for setup keys with old label prefix...');
    
    const keysToUpdate = getSetupKeysForLabel(oldLabel);
    
    console.log(`[Better Setups] Found ${keysToUpdate.length} setup keys to update:`, keysToUpdate);
    
    let updatedCount = 0;
    
    keysToUpdate.forEach(oldKey => {
      try {
        // Get the setup data
        const setupData = localStorage.getItem(oldKey);
        if (setupData) {
          // Create new key with new label
          const mapId = oldKey.substring(oldLabel.length + 1); // Remove "Farm-" prefix
          const newKey = `${newLabel}-${mapId}`;
          
          // Store under new key
          localStorage.setItem(newKey, setupData);
          
          // Remove old key
          localStorage.removeItem(oldKey);
          
          console.log(`[Better Setups] Updated setup key: "${oldKey}" → "${newKey}"`);
          updatedCount++;
        }
      } catch (error) {
        console.error(`[Better Setups] Error updating setup key ${oldKey}:`, error);
      }
    });
    
    if (updatedCount > 0) {
      console.log(`[Better Setups] ✅ Updated ${updatedCount} setup keys successfully`);
    } else {
      console.log('[Better Setups] No setup keys found with old label prefix');
    }
    
  } catch (error) {
    console.error('[Better Setups] Error updating setup data:', error);
  }
}

// =======================
// 8. Setup Hover Preview
// =======================

const SETUP_PREVIEW_PORTRAIT_SIZE = 32;
const SETUP_PREVIEW_PAIR_INNER_GAP = 2;
const SETUP_PREVIEW_PAIR_OUTER_GAP = 6;
const SETUP_PREVIEW_PADDING = 8;
const SETUP_PREVIEW_PAIR_WIDTH = (SETUP_PREVIEW_PORTRAIT_SIZE * 2) + SETUP_PREVIEW_PAIR_INNER_GAP;
const SETUP_PREVIEW_CONTENT_WIDTH = 220;
const SETUP_PREVIEW_HOVER_DELAY_MS = 200;

let activeSetupPreview = null;
let activeSetupPreviewTimer = null;
let activeSetupPreviewAnchor = null;

function extractLabelFromSetupButton(buttonText) {
  const match = String(buttonText || '').trim().match(/^(?:Setup|Save)\s*\((.+)\)$/);
  return match ? match[1] : null;
}

function hasSavedSetupButton(button) {
  return button.classList.contains('frame-1-green')
    || button.classList.contains('surface-green')
    || button.style.backgroundImage?.includes('background-green');
}

function extractSetupPiecesFromParsed(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed?.setup && Array.isArray(parsed.setup)) return parsed.setup;
  if (parsed?.board && Array.isArray(parsed.board)) return parsed.board;
  if (parsed?.pieces && Array.isArray(parsed.pieces)) return parsed.pieces;
  return null;
}

function isAllySetupPreviewPiece(piece) {
  if (!piece || typeof piece !== 'object') return false;

  if (piece.villain === true) return false;
  if (piece.type === 'enemy' || piece.type === 'villain') return false;

  if (piece.type === 'player') return true;
  if (piece.type === 'custom') return piece.villain !== true;

  if (piece.monsterId || piece.databaseId) return true;
  if (piece.monster) return true;

  if (piece.gameId && piece.villain !== true) {
    return !piece.type || piece.type === 'custom';
  }

  return false;
}

function filterAllySetupPreviewPieces(pieces) {
  if (!Array.isArray(pieces)) return null;
  const allies = pieces.filter(isAllySetupPreviewPiece);
  return allies.length ? allies : null;
}

function parseStoredSetupData(raw) {
  if (!raw || typeof raw !== 'string') return null;

  const attempts = [raw.trim()];
  const arrayStart = raw.indexOf('[');
  const arrayEnd = raw.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    attempts.push(raw.slice(arrayStart, arrayEnd + 1));
  }

  for (const attempt of attempts) {
    try {
      let parsed = JSON.parse(attempt);
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch (innerError) {
          // Keep original parsed string.
        }
      }
      const pieces = extractSetupPiecesFromParsed(parsed);
      if (pieces?.length) return pieces;
    } catch (error) {
      // Try next parse strategy.
    }
  }

  return null;
}

function tryGetStoredSetupPiecesFromKey(key) {
  if (!key) return null;
  const pieces = parseStoredSetupData(localStorage.getItem(key));
  return filterAllySetupPreviewPieces(pieces);
}

function getStoredSetupPieces(label, mapId) {
  if (!label) return null;

  const labelKeys = getSetupKeysForLabel(label);
  const candidateKeys = [];

  if (mapId && mapId !== 'unknown') {
    candidateKeys.push(`${label}-${mapId}`);

    try {
      const floor = globalThis.state.board.getSnapshot()?.context?.floor;
      if (floor != null && floor !== '') {
        candidateKeys.push(`${label}-${mapId}-floor${floor}`);
        candidateKeys.push(`${label}-${mapId}-f${floor}`);
      }
    } catch (error) {
      // Ignore floor lookup errors.
    }

    labelKeys.forEach((key) => {
      if (key.includes(mapId)) candidateKeys.push(key);
    });
  }

  labelKeys.forEach((key) => candidateKeys.push(key));

  for (const key of [...new Set(candidateKeys)]) {
    const pieces = tryGetStoredSetupPiecesFromKey(key);
    if (pieces) return pieces;
  }

  return null;
}

function getSetupPreviewMonsterNameMap() {
  return window.BestiaryModAPI?.utility?.maps?.monsterNamesToGameIds || new Map();
}

function getSetupPreviewEquipmentNameMap() {
  return window.BestiaryModAPI?.utility?.maps?.equipmentNamesToGameIds
    || window.equipmentNamesToGameIds
    || new Map();
}

function getSetupPreviewMonsterInfoFromSerialized(monster) {
  if (!monster) return null;

  const name = String(monster.name || '').trim().toLowerCase();
  if (!name) return null;

  const nameMap = getSetupPreviewMonsterNameMap();
  const gameId = typeof nameMap.get === 'function' ? nameMap.get(name) : null;
  if (!gameId) return null;

  return {
    gameId,
    tier: calculateSetupPreviewTierFromStats(monster),
    level: monster.level || 1,
    stats: extractSetupPreviewStats(monster),
    shiny: monster.shiny === true,
    awaken: monster.awaken === true,
    awakened: monster.awakened === true,
    isAwakened: monster.isAwakened === true
  };
}

function getSetupPreviewEquipmentInfoFromSerialized(equipment) {
  if (!equipment?.name) return null;

  const name = String(equipment.name).trim().toLowerCase();
  const nameMap = getSetupPreviewEquipmentNameMap();
  const gameId = typeof nameMap.get === 'function' ? nameMap.get(name) : null;
  if (!gameId) return null;

  return {
    gameId,
    stat: equipment.stat || 'ad',
    tier: equipment.tier || 1
  };
}

function calculateSetupPreviewTierFromStats(monster) {
  if (!monster) return 1;
  const statSum = (monster.hp || 0)
    + (monster.ad || 0)
    + (monster.ap || 0)
    + (monster.armor || 0)
    + (monster.magicResist || 0);
  if (statSum >= 80) return 5;
  if (statSum >= 70) return 4;
  if (statSum >= 60) return 3;
  if (statSum >= 50) return 2;
  return 1;
}

function extractSetupPreviewStats(monsterOrGenes) {
  return {
    hp: monsterOrGenes.hp || 0,
    ad: monsterOrGenes.ad || 0,
    ap: monsterOrGenes.ap || 0,
    armor: monsterOrGenes.armor || 0,
    magicResist: monsterOrGenes.magicResist || 0
  };
}

function getSetupPreviewMonsterInfo(monsterId) {
  try {
    const playerSnapshot = globalThis.state.player.getSnapshot();
    const monsters = playerSnapshot?.context?.monsters;
    if (!monsters) return null;

    const monster = monsters.find((entry) => entry.id === monsterId);
    if (!monster) return null;

    return {
      gameId: monster.gameId,
      tier: calculateSetupPreviewTierFromStats(monster),
      level: globalThis.state.utils.expToCurrentLevel(monster.exp),
      stats: extractSetupPreviewStats(monster),
      shiny: monster.shiny === true,
      awaken: monster.awaken === true,
      awakened: monster.awakened === true,
      isAwakened: monster.isAwakened === true
    };
  } catch (error) {
    return null;
  }
}

function getSetupPreviewMonsterInfoFromCustom(customPiece) {
  if (!customPiece?.gameId) return null;

  try {
    const genes = customPiece.genes || {};
    const stats = extractSetupPreviewStats(genes);
    return {
      gameId: customPiece.gameId,
      tier: calculateSetupPreviewTierFromStats(stats),
      level: customPiece.level || 1,
      stats,
      shiny: customPiece.shiny === true || genes.shiny === true,
      awaken: customPiece.awaken === true,
      awakened: customPiece.awakened === true,
      isAwakened: customPiece.isAwakened === true
    };
  } catch (error) {
    return null;
  }
}

function getSetupPreviewEquipmentSpriteId(gameId) {
  try {
    const equipData = globalThis.state.utils.getEquipment(gameId);
    return equipData?.metadata?.spriteId || null;
  } catch (error) {
    return null;
  }
}

function hasBestiaryUIComponents() {
  return !!(
    window.BestiaryUIComponents?.createMonsterPortrait
    && window.BestiaryUIComponents?.createItemPortrait
  );
}

function isSetupPreviewMaxGenes(monster, level) {
  const parsedLevel = Number(level);
  if (parsedLevel !== 99) return false;

  return Number(monster.hp ?? 1) === 20
    && Number(monster.ad ?? 1) === 20
    && Number(monster.ap ?? 1) === 20
    && Number(monster.armor ?? 1) === 20
    && Number(monster.magicResist ?? 1) === 20;
}

function isSetupPreviewAwakened(monsterInfo, level) {
  return monsterInfo.awaken === true
    || monsterInfo.awakened === true
    || monsterInfo.isAwakened === true
    || Number(level) > 50;
}

function getSetupPreviewBorderMonster(monsterInfo) {
  return {
    ...(monsterInfo.stats || {}),
    shiny: monsterInfo.shiny === true,
    awaken: monsterInfo.awaken === true,
    awakened: monsterInfo.awakened === true,
    isAwakened: monsterInfo.isAwakened === true
  };
}

function applySetupPreviewMonsterPortraitBorder(slot, monsterInfo, level) {
  const monster = getSetupPreviewBorderMonster(monsterInfo);
  const statTier = calculateSetupPreviewTierFromStats(monster);
  const maxGenes = isSetupPreviewMaxGenes(monster, level);
  const awakened = isSetupPreviewAwakened(monsterInfo, level);
  const shiny = monster.shiny === true;

  let rarityBg = slot.querySelector('.has-rarity, .rarity-awaken, .rarity-shiny, .rarity-hundo');
  if (!rarityBg) {
    rarityBg = document.createElement('div');
    slot.insertBefore(rarityBg, slot.firstChild);
  }

  if (maxGenes && shiny) {
    rarityBg.className = 'absolute inset-0 z-2 opacity-80 rarity-shiny';
    rarityBg.removeAttribute('data-rarity');
  } else if (maxGenes) {
    rarityBg.className = 'absolute inset-0 z-1 opacity-80 rarity-hundo';
    rarityBg.removeAttribute('data-rarity');
  } else if (awakened) {
    rarityBg.className = 'absolute inset-0 z-2 opacity-80 rarity-awaken';
    rarityBg.removeAttribute('data-rarity');
  } else {
    rarityBg.className = 'has-rarity absolute inset-0 z-1 opacity-80';
    rarityBg.setAttribute('data-rarity', String(Math.min(5, statTier)));
  }

  let starIcon = slot.querySelector('img.tier-stars, img[alt="star tier"], img[alt="shiny-tier"], img[alt="hundo-tier"]');
  if (maxGenes) {
    const iconSrc = shiny ? '/assets/icons/star-tier-shiny.png' : '/assets/icons/star-tier-hundo.png';
    if (!starIcon) {
      starIcon = document.createElement('img');
      starIcon.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
      slot.appendChild(starIcon);
    }
    starIcon.src = iconSrc;
    starIcon.alt = shiny ? 'shiny-tier' : 'hundo-tier';
  } else if (awakened) {
    if (!starIcon) {
      starIcon = document.createElement('img');
      starIcon.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
      starIcon.alt = 'star tier';
      slot.appendChild(starIcon);
    }
    starIcon.src = '/assets/icons/star-tier-awaken.png';
    starIcon.alt = 'star tier';
  } else if (statTier > 1) {
    if (!starIcon) {
      starIcon = document.createElement('img');
      starIcon.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
      starIcon.alt = 'star tier';
      slot.appendChild(starIcon);
    }
    starIcon.src = `/assets/icons/star-tier-${Math.min(4, statTier)}.png`;
  } else if (starIcon) {
    starIcon.remove();
  }
}

function scaleSetupPreviewPortrait(element, size = SETUP_PREVIEW_PORTRAIT_SIZE) {
  if (!element) return;
  const sizePx = `${size}px`;
  element.style.width = sizePx;
  element.style.height = sizePx;
  element.style.maxWidth = sizePx;
  element.style.maxHeight = sizePx;
  element.style.flexShrink = '0';

  const innerPortrait = element.querySelector('.equipment-portrait, .container-slot, img[alt="creature"]');
  if (innerPortrait && innerPortrait !== element) {
    innerPortrait.style.width = sizePx;
    innerPortrait.style.height = sizePx;
    innerPortrait.style.maxWidth = sizePx;
    innerPortrait.style.maxHeight = sizePx;
  }

  const creatureImg = element.querySelector('img[alt="creature"]');
  if (creatureImg) {
    creatureImg.width = size;
    creatureImg.height = size;
  }
}

function ensureSetupPreviewLevelBadge(slot, level) {
  if (slot.querySelector('.better-setups-preview-level')) return;

  const levelBadge = document.createElement('span');
  levelBadge.className = 'better-setups-preview-level';
  levelBadge.textContent = String(level);
  levelBadge.style.cssText = 'position: absolute; bottom: 0; left: 2px; z-index: 3; color: #fff; font-size: 10px; line-height: 1; background: rgba(0, 0, 0, 0.7); padding: 2px; pointer-events: none;';
  slot.appendChild(levelBadge);
}

function finalizeSetupPreviewMonsterSlot(slot, monsterInfo) {
  const level = monsterInfo.level || 1;
  scaleSetupPreviewPortrait(slot);
  applySetupPreviewMonsterPortraitBorder(slot, monsterInfo, level);
  ensureSetupPreviewLevelBadge(slot, level);
  return slot;
}

function createSetupPreviewMonsterPortraitFallback(monsterInfo) {
  const slot = document.createElement('div');
  slot.className = 'container-slot surface-darker relative flex items-center justify-center overflow-hidden shrink-0';
  slot.style.position = 'relative';

  const monsterImg = document.createElement('img');
  monsterImg.className = 'pixelated';
  monsterImg.alt = 'creature';
  monsterImg.src = `/assets/portraits/${monsterInfo.gameId}.png`;
  slot.appendChild(monsterImg);

  return finalizeSetupPreviewMonsterSlot(slot, monsterInfo);
}

function createSetupPreviewMonsterPortrait(monsterInfo) {
  if (!monsterInfo?.gameId) return null;

  if (hasBestiaryUIComponents()) {
    try {
      const portrait = window.BestiaryUIComponents.createMonsterPortrait({
        monsterId: monsterInfo.gameId,
        level: monsterInfo.level || 1,
        tier: monsterInfo.tier || 1
      });
      const slot = portrait.querySelector('.container-slot');
      if (slot) {
        return finalizeSetupPreviewMonsterSlot(slot, monsterInfo);
      }
      finalizeSetupPreviewMonsterSlot(portrait, monsterInfo);
      return portrait;
    } catch (error) {
      // Fall through to silent fallback.
    }
  }

  return createSetupPreviewMonsterPortraitFallback(monsterInfo);
}

function applySetupPreviewEquipmentPortraitSize(element, size = SETUP_PREVIEW_PORTRAIT_SIZE) {
  if (!element) return element;

  const sizePx = `${size}px`;
  const portrait = element.classList?.contains('equipment-portrait')
    ? element
    : element.querySelector('.equipment-portrait');
  const target = portrait || element;

  target.style.width = sizePx;
  target.style.height = sizePx;
  target.style.maxWidth = sizePx;
  target.style.maxHeight = sizePx;
  target.style.flexShrink = '0';

  normalizeSetupPreviewEquipmentStatIcon(target);
  return target;
}

function normalizeSetupPreviewEquipmentStatIcon(portrait) {
  if (!portrait?.querySelector) {
    return;
  }

  portrait.style.position = 'relative';
  portrait.style.overflow = 'hidden';

  portrait.querySelectorAll('img[alt="stat type"]').forEach((statIcon) => {
    const container = statIcon.parentElement;
    if (!container) {
      return;
    }

    Object.assign(container.style, {
      position: 'absolute',
      bottom: '0',
      left: '0',
      zIndex: '2',
      display: 'flex',
      alignItems: 'flex-end',
      paddingBottom: '1px',
      paddingLeft: '2px',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      boxSizing: 'border-box'
    });

    Object.assign(statIcon.style, {
      width: '11px',
      height: '11px',
      display: 'block'
    });
  });
}

function extractSetupPreviewEquipmentPortrait(itemPortrait) {
  if (!itemPortrait) return null;

  let portrait = itemPortrait;
  if (itemPortrait.tagName === 'BUTTON') {
    portrait = itemPortrait.querySelector('.equipment-portrait')
      || Array.from(itemPortrait.children).find((child) => child.tagName === 'DIV');
    if (!portrait) return null;
    portrait = portrait.cloneNode(true);
  }

  portrait.classList.add('frame-pressed-1', 'pointer-events-none');
  return applySetupPreviewEquipmentPortraitSize(portrait);
}

function getSetupPreviewStatIconSrc(stat) {
  const statType = String(stat || 'ad').toLowerCase();
  if (statType === 'ap' || statType === 'abilitypower') return '/assets/icons/abilitypower.png';
  if (statType === 'hp' || statType === 'health') return '/assets/icons/heal.png';
  if (statType === 'armor') return '/assets/icons/armor.png';
  if (statType === 'mr' || statType === 'magicresist') return '/assets/icons/magicresist.png';
  return '/assets/icons/attackdamage.png';
}

function createSetupPreviewEquipmentPortraitFallback(spriteId, stat, tier) {
  if (!spriteId) return null;

  const portrait = document.createElement('div');
  portrait.className = 'equipment-portrait surface-darker relative';
  portrait.style.cssText = `width: ${SETUP_PREVIEW_PORTRAIT_SIZE}px; height: ${SETUP_PREVIEW_PORTRAIT_SIZE}px; max-width: ${SETUP_PREVIEW_PORTRAIT_SIZE}px; max-height: ${SETUP_PREVIEW_PORTRAIT_SIZE}px; position: relative; overflow: hidden;`;

  const rarityBg = document.createElement('div');
  rarityBg.className = 'has-rarity absolute inset-0 z-1 opacity-80';
  rarityBg.setAttribute('data-rarity', String(Math.min(5, tier || 1)));
  portrait.appendChild(rarityBg);

  const spriteContainer = document.createElement('div');
  spriteContainer.className = `sprite item relative id-${spriteId}`;
  const viewport = document.createElement('div');
  viewport.className = 'viewport';
  const img = document.createElement('img');
  img.alt = String(spriteId);
  img.className = 'spritesheet';
  img.style.cssText = '--cropX: 0; --cropY: 0;';
  viewport.appendChild(img);
  spriteContainer.appendChild(viewport);
  portrait.appendChild(spriteContainer);

  const statIconContainer = document.createElement('div');
  const statIcon = document.createElement('img');
  statIcon.className = 'pixelated';
  statIcon.alt = 'stat type';
  statIcon.src = getSetupPreviewStatIconSrc(stat);
  statIconContainer.appendChild(statIcon);
  portrait.appendChild(statIconContainer);

  normalizeSetupPreviewEquipmentStatIcon(portrait);
  return portrait;
}

function createSetupPreviewEquipmentPortraitFromData(gameId, stat, tier) {
  if (!gameId) return null;

  const spriteId = getSetupPreviewEquipmentSpriteId(gameId);
  if (!spriteId) return null;

  if (hasBestiaryUIComponents()) {
    try {
      const itemPortrait = window.BestiaryUIComponents.createItemPortrait({
        itemId: spriteId,
        stat: stat || 'ad',
        tier: tier || 1
      });
      return extractSetupPreviewEquipmentPortrait(itemPortrait);
    } catch (error) {
      // Fall through to silent fallback.
    }
  }

  return createSetupPreviewEquipmentPortraitFallback(spriteId, stat, tier);
}

function createSetupPreviewEquipmentPortrait(equipId) {
  if (!equipId) return null;

  try {
    const playerContext = globalThis.state.player.getSnapshot().context;
    const equips = playerContext?.equips || [];
    const equip = equips.find((entry) => entry.id === equipId);
    if (!equip) return null;

    return createSetupPreviewEquipmentPortraitFromData(equip.gameId, equip.stat, equip.tier);
  } catch (error) {
    return null;
  }
}

function createSetupPreviewEmptyEquipmentFrame() {
  const portrait = document.createElement('div');
  portrait.className = 'equipment-portrait surface-darker relative';
  portrait.style.cssText = `width: ${SETUP_PREVIEW_PORTRAIT_SIZE}px; height: ${SETUP_PREVIEW_PORTRAIT_SIZE}px; max-width: ${SETUP_PREVIEW_PORTRAIT_SIZE}px; max-height: ${SETUP_PREVIEW_PORTRAIT_SIZE}px;`;

  const rarityBg = document.createElement('div');
  rarityBg.className = 'has-rarity absolute inset-0 z-1 opacity-80';
  rarityBg.setAttribute('data-rarity', '1');
  portrait.appendChild(rarityBg);
  return portrait;
}

function createSetupPreviewCreatureEquipmentPair(piece) {
  if (!isAllySetupPreviewPiece(piece)) return null;

  let monsterInfo = null;
  let equipId = piece.equipId || null;
  let customEquip = null;
  let serializedEquip = null;

  if (piece.type === 'custom' || (piece.gameId && !piece.monsterId && !piece.databaseId)) {
    monsterInfo = getSetupPreviewMonsterInfoFromCustom(piece);
    customEquip = piece.equip || null;
  } else {
    const monsterRef = piece.monsterId || piece.databaseId;
    if (monsterRef) {
      monsterInfo = getSetupPreviewMonsterInfo(monsterRef);
      if (piece.equipment?.name) {
        serializedEquip = getSetupPreviewEquipmentInfoFromSerialized(piece.equipment);
      }
    } else if (piece.monster) {
      monsterInfo = getSetupPreviewMonsterInfoFromSerialized(piece.monster);
      if (piece.equipment?.name) {
        serializedEquip = getSetupPreviewEquipmentInfoFromSerialized(piece.equipment);
      }
    }
  }

  if (!monsterInfo) return null;

  const container = document.createElement('div');
  container.style.cssText = `display: flex; flex-direction: row; gap: ${SETUP_PREVIEW_PAIR_INNER_GAP}px; align-items: center; flex: 0 0 ${SETUP_PREVIEW_PAIR_WIDTH}px; width: ${SETUP_PREVIEW_PAIR_WIDTH}px;`;

  const monsterPortrait = createSetupPreviewMonsterPortrait(monsterInfo);
  if (monsterPortrait) container.appendChild(monsterPortrait);

  let equipmentPortrait = null;
  if (customEquip?.gameId) {
    equipmentPortrait = createSetupPreviewEquipmentPortraitFromData(
      customEquip.gameId,
      customEquip.stat,
      customEquip.tier
    );
  } else if (serializedEquip) {
    equipmentPortrait = createSetupPreviewEquipmentPortraitFromData(
      serializedEquip.gameId,
      serializedEquip.stat,
      serializedEquip.tier
    );
  } else if (equipId) {
    equipmentPortrait = createSetupPreviewEquipmentPortrait(equipId);
  }

  container.appendChild(equipmentPortrait || createSetupPreviewEmptyEquipmentFrame());
  return container.children.length > 0 ? container : null;
}

function buildSetupPreviewContent(pieces) {
  const allyPieces = filterAllySetupPreviewPieces(pieces);
  if (!allyPieces?.length) return null;

  const content = document.createElement('div');
  content.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: ${SETUP_PREVIEW_PAIR_OUTER_GAP}px;
    align-items: center;
    width: fit-content;
    max-width: ${SETUP_PREVIEW_CONTENT_WIDTH}px;
    box-sizing: border-box;
  `;

  allyPieces.forEach((piece) => {
    const pair = createSetupPreviewCreatureEquipmentPair(piece);
    if (pair) content.appendChild(pair);
  });

  return content.children.length > 0 ? content : null;
}

function positionSetupPreview(preview, anchorButton) {
  const rect = anchorButton.getBoundingClientRect();
  const margin = 8;
  let left = rect.left;
  let top = rect.bottom + 6;

  preview.style.visibility = 'hidden';
  preview.style.display = 'block';
  const previewRect = preview.getBoundingClientRect();

  if (left + previewRect.width > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - previewRect.width - margin);
  }
  if (top + previewRect.height > window.innerHeight - margin) {
    top = Math.max(margin, rect.top - previewRect.height - 6);
  }
  if (left < margin) left = margin;

  preview.style.left = `${left}px`;
  preview.style.top = `${top}px`;
  preview.style.visibility = 'visible';
}

function hideSetupPreview() {
  if (activeSetupPreviewTimer) {
    clearTimeout(activeSetupPreviewTimer);
    activeSetupPreviewTimer = null;
  }
  if (activeSetupPreview) {
    activeSetupPreview.remove();
    activeSetupPreview = null;
  }
  activeSetupPreviewAnchor = null;
}

function showSetupPreview(anchorButton) {
  if (!isSetupShortcutsAndHoverEnabled() || !hasSavedSetupButton(anchorButton)) return;

  const label = extractLabelFromSetupButton(anchorButton.textContent);
  const mapId = getCurrentMapId();
  const pieces = getStoredSetupPieces(label, mapId);
  const previewContent = buildSetupPreviewContent(pieces);
  if (!previewContent) return;

  hideSetupPreview();

  const preview = document.createElement('div');
  preview.className = 'better-setups-setup-preview';
  preview.style.cssText = `
    position: fixed;
    z-index: 10000001;
    padding: ${SETUP_PREVIEW_PADDING}px;
    width: fit-content;
    max-width: ${SETUP_PREVIEW_CONTENT_WIDTH + (SETUP_PREVIEW_PADDING * 2)}px;
    box-sizing: border-box;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    border: 4px solid transparent;
    border-image: url("${MEDIA_URLS.FRAME_BORDER}") 6 fill;
    background: url("${MEDIA_URLS.BACKGROUND_DARK}") repeat;
    border-radius: 4px;
  `;
  preview.appendChild(previewContent);
  document.body.appendChild(preview);

  positionSetupPreview(preview, anchorButton);
  activeSetupPreview = preview;
  activeSetupPreviewAnchor = anchorButton;
}

function isBetterSetupsMainActionButton(button) {
  if (!button || button.classList.contains('edit-label-btn')) return false;
  const label = button.textContent.trim();
  return label.startsWith('Setup (') || label.startsWith('Save (');
}

function scheduleSetupPreviewForButton(setupButton) {
  if (!setupButton || !isBetterSetupsMainActionButton(setupButton) || !isSetupShortcutsAndHoverEnabled()) return;

  if (activeSetupPreviewTimer) {
    clearTimeout(activeSetupPreviewTimer);
  }

  activeSetupPreviewTimer = setTimeout(() => {
    activeSetupPreviewTimer = null;
    showSetupPreview(setupButton);
  }, SETUP_PREVIEW_HOVER_DELAY_MS);
}

function attachSetupButtonHoverPreview(setupButton) {
  if (!setupButton || !isSetupShortcutsAndHoverEnabled() || setupButton.dataset.betterSetupsPreviewAttached === 'true') {
    return;
  }

  setupButton.dataset.betterSetupsPreviewAttached = 'true';

  setupButton.addEventListener('mouseenter', () => {
    scheduleSetupPreviewForButton(setupButton);
  });

  setupButton.addEventListener('focus', () => {
    scheduleSetupPreviewForButton(setupButton);
  });

  setupButton.addEventListener('mouseleave', () => {
    hideSetupPreview();
  });

  setupButton.addEventListener('blur', () => {
    hideSetupPreview();
  });

  setupButton.addEventListener('click', () => {
    hideSetupPreview();
  });
}

function ensureSetupPreviewDelegation() {
  if (document.documentElement.dataset.betterSetupsPreviewDelegation === 'true') {
    return;
  }

  document.documentElement.dataset.betterSetupsPreviewDelegation = 'true';

  document.addEventListener('mouseover', (event) => {
    if (!isSetupShortcutsAndHoverEnabled()) return;
    const setupButton = event.target.closest('button');
    if (!setupButton || !isBetterSetupsMainActionButton(setupButton)) return;
    attachSetupButtonHoverPreview(setupButton);
    scheduleSetupPreviewForButton(setupButton);
  }, true);

  document.addEventListener('mouseout', (event) => {
    const setupButton = event.target.closest('button');
    if (!setupButton || !isBetterSetupsMainActionButton(setupButton)) return;
    const related = event.relatedTarget;
    if (related && setupButton.contains(related)) return;
    if (activeSetupPreviewAnchor === setupButton) {
      hideSetupPreview();
    }
  }, true);
}

// =======================
// 9. Utility Functions
// =======================

// Helper function to get current map ID
function getCurrentMapId() {
  try {
    const boardContext = globalThis.state.board.getSnapshot().context;
    
    if (boardContext.selectedMap?.selectedRoom?.id) {
      return boardContext.selectedMap.selectedRoom.id;
    } else if (boardContext.selectedMap?.id) {
      return boardContext.selectedMap.id;
    } else if (boardContext.area?.id) {
      return boardContext.area.id;
    } else {
      const playerContext = globalThis.state.player.getSnapshot().context;
      return playerContext.currentRoomId || 'unknown';
    }
  } catch (error) {
    console.warn('[Better Setups] Error getting current map ID:', error);
    return 'unknown';
  }
}

// Helper function to get current map name
function getCurrentMapName() {
  try {
    const mapId = getCurrentMapId();
    if (mapId === 'unknown') return 'Unknown Map';
    
    // Try to get map name from utils
    if (globalThis.state.utils && globalThis.state.utils.ROOM_NAME) {
      return globalThis.state.utils.ROOM_NAME[mapId] || mapId;
    }
    
    return mapId;
  } catch (error) {
    console.warn('[Better Setups] Error getting current map name:', error);
    return 'Unknown Map';
  }
}

// Helper function to get map-specific setup data
function getMapSetupData(mapId) {
  try {
    if (!mapId || mapId === 'unknown') {
      return { setups: [], count: 0 };
    }
    
    // Try to get setup data from localStorage
    const setupKey = `bestiary-arena-setups-${mapId}`;
    const setupData = localStorage.getItem(setupKey);
    
    if (setupData) {
      try {
        const parsed = JSON.parse(setupData);
        return {
          setups: parsed.setups || [],
          count: parsed.setups ? parsed.setups.length : 0,
          source: 'localStorage'
        };
      } catch (e) {
        console.warn('[Better Setups] Failed to parse setup data for map:', mapId);
      }
    }
    
    // Try alternative storage keys
    const alternativeKeys = [
      `bestiary-arena-setups`,
      `setup-${mapId}`,
      `map-setups-${mapId}`
    ];
    
    for (const key of alternativeKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          // Look for map-specific data within the parsed object
          if (parsed[mapId]) {
            return {
              setups: parsed[mapId].setups || [],
              count: parsed[mapId].setups ? parsed[mapId].setups.length : 0,
              source: key
            };
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    return { setups: [], count: 0, source: 'none' };
  } catch (error) {
    console.warn('[Better Setups] Error getting map setup data:', error);
    return { setups: [], count: 0, source: 'error' };
  }
}

// =======================
// 10. Exports & Lifecycle Management
// =======================

// Export functionality
  exports = {
    activate: activateSetups,
    updateConfig: (newConfig) => {
      Object.assign(config, newConfig);
    },
    cleanup: () => {
      clearBetterSetupsModalLayoutCleanup();
      hideSetupPreview();
      stopSetupInterfaceObserver();
    }
  };
}
