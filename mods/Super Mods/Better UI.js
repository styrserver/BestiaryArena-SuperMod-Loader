// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[Better UI] initializing...');

// Default configuration
const defaultConfig = {
  enabled: true,
  showStaminaTimer: true,
  showSettingsButton: true
};

// Storage key for this mod
const STORAGE_KEY = 'better-ui-config';

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
  CURRENCY_CONTAINER: '#header-slot > div > div:first-child'
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

// =======================
// 3. Utility Functions
// =======================

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
  
  const readyTime = new Date(Date.now() + minutesRemaining * 60000);
  
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
    `;
    
    // Add change event listener to checkbox for immediate updates
    const checkbox = content.querySelector('#stamina-timer-toggle');
    checkbox.addEventListener('change', () => {
      config.showStaminaTimer = checkbox.checked;
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
    
    // Fix Chrome flexbox wrapping issue by ensuring header container doesn't wrap
    const headerSlot = document.querySelector(SELECTORS.HEADER_SLOT);
    if (headerSlot) {
      const headerContainer = headerSlot.querySelector('div');
      if (headerContainer && headerContainer.classList.contains('flex')) {
        // Simple fix: just prevent flex wrapping without modifying other properties
        headerContainer.style.flexWrap = 'nowrap';
        
        // Fix stamina button to prevent timer wrapping
        const staminaButton = headerContainer.querySelector('button[title="Stamina"]');
        if (staminaButton) {
          const staminaDiv = staminaButton.querySelector('div');
          if (staminaDiv) {
            staminaDiv.style.flexWrap = 'nowrap';
            staminaDiv.style.whiteSpace = 'nowrap';
            staminaDiv.style.minWidth = '0';
            staminaDiv.style.flexShrink = '0';
            staminaDiv.style.overflow = 'hidden';
          }
        }
        
        console.log('[Better UI] Applied flex-nowrap fix for Chrome compatibility');
        
        console.log('[Better UI] Applied flex-nowrap and spacer fix for Chrome compatibility');
      }
    }
    
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
// 4. Stamina Timer Functions
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
      const timeoutId = setTimeout(tryInit, 500);
      activeTimeouts.add(timeoutId);
      return;
    }
    
    // Fix Chrome flexbox wrapping issue by ensuring header container doesn't wrap
    const headerSlot = document.querySelector(SELECTORS.HEADER_SLOT);
    if (headerSlot) {
      const headerContainer = headerSlot.querySelector('div');
      if (headerContainer && headerContainer.classList.contains('flex')) {
        // Simple fix: just prevent flex wrapping without modifying other properties
        headerContainer.style.flexWrap = 'nowrap';
        
        // Fix stamina button to prevent timer wrapping
        const staminaButton = headerContainer.querySelector('button[title="Stamina"]');
        if (staminaButton) {
          const staminaDiv = staminaButton.querySelector('div');
          if (staminaDiv) {
            staminaDiv.style.flexWrap = 'nowrap';
            staminaDiv.style.whiteSpace = 'nowrap';
            staminaDiv.style.minWidth = '0';
            staminaDiv.style.flexShrink = '0';
            staminaDiv.style.overflow = 'hidden';
          }
        }
        
        console.log('[Better UI] Applied flex-nowrap fix for Chrome compatibility');
        
        console.log('[Better UI] Applied flex-nowrap and spacer fix for Chrome compatibility');
      }
    }
    
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

// =======================
// 5. Initialization
// =======================

function initBetterUI() {
  try {
    console.log('[Better UI] Starting initialization');
    
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
    
    console.log('[Better UI] Initialization completed');
  } catch (error) {
    console.error('[Better UI] Initialization error:', error);
  }
}

// Initialize the mod immediately
initBetterUI();

// =======================
// 6. Cleanup
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
    
    // Disconnect MutationObserver
    if (staminaObserver) {
      try {
        staminaObserver.disconnect();
        console.log('[Better UI] MutationObserver disconnected');
      } catch (error) {
        console.warn('[Better UI] Error disconnecting MutationObserver:', error);
      }
      staminaObserver = null;
    }
    
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
// 7. Exports & Lifecycle Management
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
