// Welcome Mod for Bestiary Arena
// Shows a welcome page on initialization with mod description
// Also shows a loading toast while mods are loading
console.log('Welcome mod initializing...');

// Configuration
const defaultConfig = {
  enabled: true,
  showWelcome: true
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Get modal state from body element
function getModalState(body) {
  try {
    if (!body) return { isClean: true, hasModals: false };
    
    const hasScrollLock = body.getAttribute('data-scroll-locked') === '1';
    const hasPointerEvents = body.style.pointerEvents === 'none';
    const hasCheckeredClass = body.classList.contains('checkered');
    const hasWideClass = body.classList.contains('w-full-even-down');
    
    // Clean state: only "checkered w-full-even-down" with empty style
    const isClean = hasCheckeredClass && hasWideClass && !hasScrollLock && !hasPointerEvents;
    const hasModals = hasScrollLock || hasPointerEvents;
    
    return { isClean, hasModals, hasScrollLock, hasPointerEvents };
  } catch (error) {
    console.warn('[Welcome] Error checking modal state:', error);
    return { isClean: true, hasModals: false };
  }
}

// Check if other modals are open (simplified for welcome modal only)
async function tryCloseModalsAndCheck() {
  try {
    const body = document.body;
    if (!body) return false;
    
    // Get initial modal state
    const initialState = getModalState(body);
    
    // If it's already clean, no need to close anything
    if (initialState.isClean) {
      return false;
    }
    
    // If there are modals, try a single ESC press
    if (initialState.hasModals) {
      console.log('[Welcome] Attempting to close modals with single ESC press');
      
      // Single ESC press to close any open modals
      document.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'Escape', 
        keyCode: 27, 
        which: 27, 
        bubbles: true 
      }));
      
      // Wait for ESC press to take effect
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Re-check after ESC press
      const afterEscState = getModalState(body);
      
      if (afterEscState.isClean) {
        console.log('[Welcome] Modal successfully closed with ESC press');
        return false; // No modals open now
      } else {
        console.log('[Welcome] Modal still open after ESC press');
        return true; // Still has modals open
      }
    }
    
    return false; // No modals detected
  } catch (error) {
    console.warn('[Welcome] Error trying to close modals:', error);
    return false; // Default to allowing modal if we can't check
  }
}

// Check if user has chosen to never show welcome again
async function shouldShowWelcome() {
  try {
    // Simply check the welcome-enabled setting
    let welcomeEnabledRaw;
    
    if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
      try {
        const storageData = await new Promise(resolve => {
          window.browserAPI.storage.local.get(['welcome-enabled'], resolve);
        });
        welcomeEnabledRaw = storageData['welcome-enabled'];
        console.log('[Welcome Debug] Using extension storage');
      } catch (storageError) {
        console.warn('[Welcome Debug] Extension storage failed, using localStorage:', storageError);
        welcomeEnabledRaw = localStorage.getItem('welcome-enabled');
      }
    } else {
      welcomeEnabledRaw = localStorage.getItem('welcome-enabled');
      console.log('[Welcome Debug] Using localStorage');
    }
    
    const welcomeEnabled = welcomeEnabledRaw !== 'false'; // Default to true if not set
    
    console.log('[Welcome Debug] shouldShowWelcome - welcomeEnabledRaw:', welcomeEnabledRaw);
    console.log('[Welcome Debug] shouldShowWelcome - welcomeEnabled:', welcomeEnabled);
    
    return welcomeEnabled;
  } catch (error) {
    console.warn('Could not check welcome preference:', error);
    return true; // Default to showing welcome if we can't check
  }
}

// Set the never show again preference
async function setNeverShowAgain() {
  try {
    // Simply set welcome-enabled to false - this controls both the popup slider and welcome display
    if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
      await new Promise(resolve => {
        window.browserAPI.storage.local.set({
          'welcome-enabled': 'false'
        }, resolve);
      });
      console.log('Welcome page set to never show again and popup disabled (extension storage)');
    } else {
      localStorage.setItem('welcome-enabled', 'false');
      console.log('Welcome page set to never show again and popup disabled (localStorage)');
    }
    
    // Send message to popup via browser extension messaging
    if (window.browserAPI && window.browserAPI.runtime) {
      window.browserAPI.runtime.sendMessage({
        action: 'disableWelcomeToggle'
      }).catch(error => {
        console.warn('Could not send message to popup:', error);
      });
    }
    
    // Also try window.postMessage as fallback
    window.postMessage({
      from: 'BESTIARY_WELCOME',
      action: 'disableWelcomeToggle'
    }, '*');
  } catch (error) {
    console.warn('Could not save welcome preference:', error);
  }
}

// Get extension version dynamically
async function getExtensionVersion() {
  console.log('[Welcome] Getting extension version...');
  try {
    // Use the same message passing pattern as other mods
    const response = await new Promise((resolve) => {
      const messageId = `welcome_version_${Date.now()}_${Math.random()}`;
      
      // Set up response listener
      const handleResponse = (event) => {
        if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.id === messageId) {
          window.removeEventListener('message', handleResponse);
          resolve(event.data.response);
        }
      };
      
      window.addEventListener('message', handleResponse);
      
      // Send request to content script
      window.postMessage({
        from: 'BESTIARY_CLIENT',
        id: messageId,
        message: { action: 'getVersion' }
      }, '*');
      
      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        resolve({ success: false, error: 'Timeout' });
      }, 5000);
    });
    
    console.log('[Welcome] Version response:', response);
    
    if (response && response.success && response.version) {
      return response.version;
    }
    
    // If no version found, return unknown
    console.log('[Welcome] No version found, returning unknown');
    return 'unknown';
  } catch (error) {
    console.warn('[Welcome] Could not get extension version:', error);
    return 'unknown';
  }
}

// Get mod counts dynamically
async function getModCounts() {
  console.log('[Welcome] Getting mod counts...');
  try {
    const response = await new Promise((resolve) => {
      const messageId = `welcome_modcounts_${Date.now()}_${Math.random()}`;
      
      // Set up response listener
      const handleResponse = (event) => {
        if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.id === messageId) {
          window.removeEventListener('message', handleResponse);
          resolve(event.data.response);
        }
      };
      
      window.addEventListener('message', handleResponse);
      
      // Send request to content script
      window.postMessage({
        from: 'BESTIARY_CLIENT',
        id: messageId,
        message: { action: 'getModCounts' }
      }, '*');
      
      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        resolve({ success: false, error: 'Timeout' });
      }, 5000);
    });
    
    console.log('[Welcome] Mod counts response:', response);
    
    if (response && response.success && response.counts) {
      return response.counts;
    }
    
    // If API fails, throw error with details
    if (response && response.error) {
      throw new Error(`Background script error: ${response.error}`);
    } else if (!response) {
      throw new Error('No response from background script (timeout or message passing failure)');
    } else {
      throw new Error('Failed to get mod counts from background script');
    }
  } catch (error) {
    console.error('[Welcome] Could not get mod counts:', error);
    // Return null to indicate failure - welcome modal will handle gracefully
    return null;
  }
}

// Loading toast state
let loadingToast = null;
let loadingCompleted = false;
let modsLoaded = false;
let modLoadingObserver = null;
let modalAborted = false; // Track if modal was aborted due to other modals

// Cleanup tracking
let activeTimeouts = new Set();
let activeEventListeners = new Map();
let currentModal = null;

// Helper functions for cleanup tracking
function trackTimeout(timeoutId) {
  activeTimeouts.add(timeoutId);
  return timeoutId;
}

function clearTrackedTimeout(timeoutId) {
  clearTimeout(timeoutId);
  activeTimeouts.delete(timeoutId);
}

function trackEventListener(element, event, handler) {
  const key = `${element === window ? 'window' : element.constructor.name}_${event}`;
  if (!activeEventListeners.has(key)) {
    activeEventListeners.set(key, []);
  }
  activeEventListeners.get(key).push({ element, event, handler });
}

function removeTrackedEventListener(element, event, handler) {
  const key = `${element === window ? 'window' : element.constructor.name}_${event}`;
  const listeners = activeEventListeners.get(key);
  if (listeners) {
    const index = listeners.findIndex(l => l.handler === handler);
    if (index !== -1) {
      listeners.splice(index, 1);
      element.removeEventListener(event, handler);
      if (listeners.length === 0) {
        activeEventListeners.delete(key);
      }
    }
  }
}

// Common function to handle welcome modal after completion modal closes
async function handleCompletionModalClose(context = '') {
  // Skip if modal was already aborted due to other modals
  if (modalAborted) {
    console.log('[Welcome] Skipping welcome modal - previously aborted due to other modals');
    return;
  }
  
  const shouldShow = await shouldShowWelcome();
  if (shouldShow && config.showWelcome) {
    console.log(`[Welcome] Showing welcome modal after completion modal ${context}`);
    showWelcomeModal();
  } else {
    console.log('[Welcome] Welcome modal skipped (user preference or config)');
  }
}

// Toast implementation for Welcome mod with proper stacking
function createToast({ message, type = 'info', duration = 3000, icon = null }) {
  // Get or create the main toast container
  let mainContainer = document.getElementById('welcome-toast-container');
  if (!mainContainer) {
    mainContainer = document.createElement('div');
    mainContainer.id = 'welcome-toast-container';
    mainContainer.style.cssText = `
      position: fixed;
      z-index: 9999;
      inset: 16px 16px 64px;
      pointer-events: none;
    `;
    mainContainer.setAttribute('data-aria-hidden', 'true');
    mainContainer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(mainContainer);
  }
  
  // Count existing toasts to calculate stacking position
  const existingToasts = mainContainer.querySelectorAll('.toast-item');
  const stackOffset = existingToasts.length * 46; // 46px per toast
  
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
  
  // Create toast button with proper animation classes
  const toast = document.createElement('button');
  toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
  
  // Create widget structure to match game's toast style
  const widgetTop = document.createElement('div');
  widgetTop.className = 'widget-top h-2.5';
  
  const widgetBottom = document.createElement('div');
  widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';
  
  // Add icon if provided
  if (icon) {
    const iconImg = document.createElement('img');
    iconImg.alt = type;
    iconImg.src = icon;
    iconImg.className = 'pixelated';
    iconImg.style.cssText = 'width: 16px; height: 16px;';
    widgetBottom.appendChild(iconImg);
  }
  
  // Add message
  const messageDiv = document.createElement('div');
  messageDiv.className = 'text-left';
  messageDiv.innerHTML = message; // Use innerHTML to support HTML content like spans
  widgetBottom.appendChild(messageDiv);
  
  // Assemble toast
  toast.appendChild(widgetTop);
  toast.appendChild(widgetBottom);
  flexContainer.appendChild(toast);
  mainContainer.appendChild(flexContainer);
  
  // Debug: Log toast creation
  console.log('[Welcome] Toast created and added to DOM:', {
    container: !!mainContainer,
    stackOffset: stackOffset,
    duration: duration,
    totalToasts: existingToasts.length + 1
  });
  
  // Auto-remove after duration
  const timeoutId = trackTimeout(setTimeout(() => {
    if (flexContainer && flexContainer.parentNode) {
      console.log('[Welcome] Auto-removing toast after', duration, 'ms');
      flexContainer.parentNode.removeChild(flexContainer);
      
      // Update positions of remaining toasts
      updateToastPositions(mainContainer);
    }
    activeTimeouts.delete(timeoutId);
  }, duration));
  
  return {
    element: flexContainer,
    remove: () => {
      if (flexContainer && flexContainer.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        updateToastPositions(mainContainer);
      }
    }
  };
}

// Update positions of remaining toasts when one is removed
function updateToastPositions(container) {
  const toasts = container.querySelectorAll('.toast-item');
  toasts.forEach((toast, index) => {
    const offset = index * 46;
    toast.style.transform = `translateY(-${offset}px)`;
  });
}

// Show loading toast
function showLoadingToast() {
  console.log('[Welcome] showLoadingToast called');
  
  try {
    loadingToast = createToast({
      message: '<span class="text-monster">Loading mods</span>...',
      type: 'loading',
      duration: 5000, // Show for 5 seconds
      icon: 'https://bestiaryarena.com/assets/logo.png' // Use the official Bestiary Arena logo
    });

    console.log('[Welcome] Loading toast created:', !!loadingToast);
  } catch (error) {
    console.error('[Welcome] Error creating loading toast:', error);
  }
}

// Show error toast for mod loading failures
function showModErrorToast(error) {
  console.log('[Welcome] showModErrorToast called with error:', error);
  
  try {
    const errorToast = createToast({
      message: `<span class="text-red-400">Mod loading error:</span> ${error}`,
      type: 'error',
      duration: 5000, // Show for 5 seconds
      icon: 'https://bestiaryarena.com/assets/logo.png' // Use the official Bestiary Arena logo
    });

    console.log('[Welcome] Error toast created:', !!errorToast);
  } catch (toastError) {
    console.error('[Welcome] Error creating error toast:', toastError);
  }
}

// Update loading toast to show completion
async function updateLoadingToComplete() {
  console.log('[Welcome] updateLoadingToComplete called');
  console.log('[Welcome] loadingToast exists:', !!loadingToast);
  console.log('[Welcome] loadingCompleted:', loadingCompleted);
  
  // Prevent duplicate processing
  if (loadingCompleted) {
    console.log('[Welcome] Loading already completed, skipping duplicate call');
    return;
  }
  
  // Mark loading as completed
  loadingCompleted = true;
  modsLoaded = true;
  
  if (!loadingToast) {
    console.warn('[Welcome] No loading toast to update - showing welcome modal directly');
    handleCompletionModalClose('(no loading toast)');
    return;
  }

  try {
    // Remove the loading toast
    loadingToast?.remove?.();
    loadingToast = null;

    // Create a completion toast
    const completionToast = createToast({
      message: '<span class="text-monster">Mods</span> loaded successfully!',
      type: 'success',
      duration: 5000, // Show for 5 seconds
      icon: 'https://bestiaryarena.com/assets/logo.png' // Use the official Bestiary Arena logo
    });

    console.log('[Welcome] Completion toast created successfully');
    
    // Show welcome modal immediately if enabled (don't wait for toast)
    handleCompletionModalClose('(completion toast)');
    
  } catch (error) {
    console.error('[Welcome] Error creating completion toast:', error);
    // Fallback: show welcome modal directly
    handleCompletionModalClose('(error fallback)');
  }
}

// Hide loading toast
function hideLoadingToast() {
  console.log('[Welcome] hideLoadingToast called');
  console.log('[Welcome] loadingToast exists:', !!loadingToast);
  console.log('[Welcome] loadingCompleted:', loadingCompleted);
  
  if (loadingToast && typeof loadingToast.remove === 'function') {
    loadingToast.remove();
    loadingToast = null;
    console.log('[Welcome] Loading toast hidden successfully');
  } else {
    console.warn('[Welcome] Could not hide loading toast - invalid toast object');
  }
  
  // If loading was completed but toast was closed, show welcome modal as fallback
  if (loadingCompleted) {
    trackTimeout(setTimeout(() => handleCompletionModalClose('(loading completed but toast was closed)'), 100));
  }
}

// Show the welcome modal
async function showWelcomeModal() {
  // Try to close other modals and check if we can proceed
  const stillHasModals = await tryCloseModalsAndCheck();
  if (stillHasModals) {
    console.log('[Welcome] Aborting welcome modal - other modal is still open after ESC attempts');
    modalAborted = true; // Mark as aborted to prevent future attempts
    return;
  }
  
  // If we successfully closed modals, reset the abort flag
  if (modalAborted) {
    console.log('[Welcome] Modals were closed successfully, resetting abort flag');
    modalAborted = false;
  }
  
  if (!api || !api.ui || !api.ui.components) {
    console.error('[Welcome] API not available');
    return;
  }

  try {
    const [version, modCounts] = await Promise.all([
      getExtensionVersion(),
      getModCounts()
    ]);
    console.log('[Welcome] Version received:', version);
    console.log('[Welcome] Mod counts received:', modCounts);
    
    // Handle case where mod counts couldn't be fetched
    const officialCount = modCounts?.official || 'Multiple';
    const superCount = modCounts?.super || 'Multiple';
    
    const modal = api.ui.components.createModal({
      title: 'Welcome to Bestiary Arena Mod Loader!',
      width: 900,
      height: 600,
      content: `
        <div style="padding: 20px; text-align: center;">
          <div style="margin-bottom: 20px;">
            <h2 style="color: #a6adc8; margin-bottom: 15px;">🎮 Bestiary Arena SuperMod Loader</h2>
            <p style="color: #a6adc8; line-height: 1.6; margin-bottom: 20px;">
              Welcome to the enhanced Bestiary Arena experience! This mod loader provides powerful tools and improvements to make your gameplay more efficient and enjoyable.
            </p>
          </div>
          
          <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h3 style="color: #a6adc8; margin-bottom: 15px;">✨ What's Included:</h3>
            <div style="text-align: left; color: #a6adc8; line-height: 1.8;">
              <p><strong>🔧 ${officialCount} Official Mods:</strong> Bestiary Automator, Board Analyzer, Hero Editor, Custom Display, and more! <em>(Enabled by default)</em></p>
              <p><strong>🚀 ${superCount} Super Mods:</strong> Autoseller, Cyclopedia, Hunt Analyzer, Outfiter, Raid Hunter, and more! <em>(Disabled by default)</em></p>
              <p><strong>⚙️ Configuration:</strong> Import/export your settings and mod preferences</p>
              <p><strong>📊 Dashboard:</strong> Access the SuperMod dashboard for advanced features</p>
              <p><strong>🎛️ Popup Controls:</strong> Enable/disable mods directly from the extension popup</p>
              <p><strong>📈 Analytics:</strong> Track runs, analyze performance, and optimize your gameplay</p>
            </div>
          </div>
          
          <div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap;">
            <div style="background: rgba(0,255,0,0.1); border: 1px solid rgba(0,255,0,0.3); border-radius: 8px; padding: 15px; flex: 1; min-width: 300px; transition: all 0.2s ease;">
              <p style="color: #a6adc8; margin: 0; font-size: 14px; text-align: center;">
                <strong>✅ Safe & Approved:</strong> This mod loader is officially approved by the Bestiary Arena developer (Xandjiji) and designed for single-player enhancement only.
              </p>
            </div>
            <div style="background: rgba(0,255,0,0.1); border: 1px solid rgba(0,255,0,0.3); border-radius: 8px; padding: 15px; flex: 1; min-width: 300px; transition: all 0.2s ease;">
              <p style="color: #a6adc8; margin: 0; font-size: 14px;">
                <strong>💡 Tip:</strong> Click the extension icon to open the popup where you can enable/disable mods. Official Mods are enabled by default, but Super Mods need to be manually enabled as needed!
              </p>
            </div>
          </div>
          
          <div style="color: #a6adc8; font-size: 14px; text-align: center;">
            <p style="margin-bottom: 10px;">Enjoy your enhanced Bestiary Arena experience! 🎉</p>
            <p style="font-size: 12px; opacity: 0.7; margin: 0;">
              Bestiary Arena SuperMod Loader${version !== 'unknown' ? ` v${version}` : ''}
            </p>
          </div>
        </div>
      `,
      buttons: [
        {
          text: 'Never Show Again',
          primary: false,
          onClick: (e, modalObj) => {
            setNeverShowAgain();
            modalObj?.close?.();
          }
        },
        {
          text: 'Got It!',
          primary: true,
          onClick: (e, modalObj) => {
            modalObj?.close?.();
          }
        }
      ]
    });

    // Add ESC key support for closing modal
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        modal?.close?.();
        removeTrackedEventListener(document, 'keydown', escHandler);
      }
    };
    trackEventListener(document, 'keydown', escHandler);

    // Force the modal size to match Cyclopedia dimensions
    trackTimeout(setTimeout(() => {
      const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
      if (dialog) {
        dialog.style.width = '900px';
        dialog.style.minWidth = '900px';
        dialog.style.maxWidth = '900px';
        dialog.style.height = '600px';
        dialog.style.minHeight = '600px';
        dialog.style.maxHeight = '600px';
        const contentElem = dialog.querySelector('.modal-content, [data-content], .content, .modal-body');
        if (contentElem) {
          contentElem.style.width = '900px';
          contentElem.style.height = '600px';
          contentElem.style.display = 'flex';
          contentElem.style.flexDirection = 'column';
        }
      }
    }, 100));

    // Store modal reference for cleanup
    currentModal = modal;
  } catch (error) {
    console.error('[Welcome] Error creating welcome modal:', error);
  }
}

// Listen for mod loading completion and errors via direct message from local_mods.js
function setupModLoadingObserver() {
  console.log('[Welcome] Setting up mod loading completion listener');
  
  // Listen for completion and error messages from local_mods.js
  const messageHandler = (event) => {
    if (event.source !== window) return;
    
    
    // Listen for mod loading completion message
    if (event.data?.from === 'LOCAL_MODS_LOADER' && event.data?.action === 'allModsLoaded') {
      console.log('[Welcome] Received mod loading completion signal from local_mods.js');
      updateLoadingToComplete();
    }
    
    // Listen for mod loading error message
    if (event.data?.from === 'LOCAL_MODS_LOADER' && event.data?.action === 'modLoadError') {
      console.log('[Welcome] Received mod loading error signal:', event.data.error);
      showModErrorToast(event.data.error);
    }
  };
  
  trackEventListener(window, 'message', messageHandler);
  
  // Store the handler for cleanup
  modLoadingObserver = {
    disconnect: () => {
      removeTrackedEventListener(window, 'message', messageHandler);
      console.log('[Welcome] Mod loading completion listener removed');
    }
  };
  
  // Fallback timer in case the message never comes
  trackTimeout(setTimeout(() => {
    if (modLoadingObserver && !loadingCompleted) {
      console.log('[Welcome] Mod loading completion timeout, using fallback');
      modLoadingObserver.disconnect();
      modLoadingObserver = null;
      updateLoadingToComplete();
    }
  }, 3000)); // Reduced to 3 second timeout for faster response
}

// Initialize welcome modal if conditions are met
async function initializeWelcome() {
  console.log('[Welcome] initializeWelcome called');
  
  // Set up mod loading completion listener immediately (before API check)
  console.log('[Welcome] Setting up mod loading completion listener...');
  setupModLoadingObserver();
  
  // Show loading toast immediately (no API dependency needed)
  console.log('[Welcome] Starting loading process');
  showLoadingToast();
}


// Check popup toggle status first, then start the welcome process
checkPopupToggleStatus();
initializeWelcome();


// Message handler for welcome toggle changes
async function handleWelcomeToggle(event) {
  if (event.source !== window) return;
  
  if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.action === 'updateWelcomeMode') {
    const enabled = event.data.enabled;
    console.log('[Welcome] Received toggle update:', enabled);
    
    if (enabled) {
      console.log('[Welcome] Welcome page enabled via popup toggle');
    } else {
      console.log('[Welcome] Welcome page disabled via popup toggle');
    }
  }
}

// Check popup toggle status on initialization
function checkPopupToggleStatus() {
  try {
    const welcomeEnabled = localStorage.getItem('welcome-enabled');
    console.log('[Welcome Debug] checkPopupToggleStatus - welcomeEnabled:', welcomeEnabled);
  } catch (error) {
    console.warn('Could not check popup toggle status:', error);
  }
}

// Listen for welcome toggle changes
trackEventListener(window, 'message', handleWelcomeToggle);

// Cleanup function
function cleanup() {
  console.log('[Welcome] Cleaning up...');
  
  // Clear all tracked timeouts
  activeTimeouts.forEach(timeoutId => {
    clearTimeout(timeoutId);
  });
  activeTimeouts.clear();
  
  // Remove all tracked event listeners
  activeEventListeners.forEach((listeners, key) => {
    listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
  });
  activeEventListeners.clear();
  
  // Disconnect observer
  if (modLoadingObserver) {
    modLoadingObserver.disconnect();
    modLoadingObserver = null;
  }
  
  // Close any open modal
  if (currentModal && typeof currentModal.close === 'function') {
    currentModal.close();
    currentModal = null;
  }
  
  // Close any open toasts
  if (loadingToast && typeof loadingToast.remove === 'function') {
    loadingToast.remove();
    loadingToast = null;
  }
  
  // Clean up toast container
  const toastContainer = document.getElementById('welcome-toast-container');
  if (toastContainer && toastContainer.parentNode) {
    toastContainer.parentNode.removeChild(toastContainer);
  }
  
  // Reset state variables
  loadingCompleted = false;
  modalAborted = false;
  modsLoaded = false;
}

// Export functionality
exports = {
  showWelcome: showWelcomeModal,
  setNeverShowAgain,
  shouldShowWelcome,
  showLoading: showLoadingToast,
  hideLoading: hideLoadingToast,
  updateLoadingToComplete: updateLoadingToComplete,
  isModsLoaded: () => modsLoaded,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
  },
  cleanup: cleanup
};
