// Welcome Mod for Bestiary Arena
// Shows a welcome page on initialization with mod description
// Also shows a loading modal while mods are loading
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

// Try to close other modals with ESC presses and check if we can proceed
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
    
    // If there are modals, try to close them
    if (initialState.hasModals) {
      console.log('[Welcome] Attempting to close modals with ESC presses');
      
      // Try multiple ESC presses to close any open modals
      for (let i = 0; i < 3; i++) {
        document.dispatchEvent(new KeyboardEvent('keydown', { 
          key: 'Escape', 
          keyCode: 27, 
          which: 27, 
          bubbles: true 
        }));
      }
      
      // Wait for ESC presses to take effect
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Re-check after ESC presses
      const afterEscState = getModalState(body);
      
      if (afterEscState.isClean) {
        console.log('[Welcome] Modal successfully closed with ESC presses');
        return false; // No modals open now
      } else {
        console.log('[Welcome] Modal still open after ESC presses - waiting longer for DOM update');
        // Wait a bit more for DOM to fully update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Final check after additional wait
        const finalState = getModalState(body);
        
        if (finalState.isClean) {
          console.log('[Welcome] Modal successfully closed after extended wait');
          return false; // No modals open now
        } else {
          console.log('[Welcome] Modal still open after extended wait');
          return true; // Still has modals open
        }
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
    
    // Fallback to hardcoded counts if API fails
    console.log('[Welcome] Using fallback mod counts');
    return {
      official: 11,
      super: 17,
      test: 1
    };
  } catch (error) {
    console.warn('[Welcome] Could not get mod counts:', error);
    // Fallback to hardcoded counts
    return {
      official: 11,
      super: 17,
      test: 1
    };
  }
}

// Loading modal state
let loadingModal = null;
let loadingCompleted = false;
let modLoadingObserver = null;
let modalAborted = false; // Track if modal was aborted due to other modals

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

// Show loading modal
async function showLoadingModal() {
  console.log('[Welcome] showLoadingModal called');
  
  // Try to close other modals and check if we can proceed
  const stillHasModals = await tryCloseModalsAndCheck();
  if (stillHasModals) {
    console.log('[Welcome] Aborting loading modal - other modal is still open after ESC attempts');
    modalAborted = true; // Mark as aborted to prevent future attempts
    return;
  }
  
  if (!api || !api.ui || !api.ui.components) {
    console.error('[Welcome] API not available for loading modal');
    return;
  }

  try {
    loadingModal = api.ui.components.createModal({
      title: 'Loading Mods...',
      width: 300,
      height: 80,
      content: `
        <div style="padding: 15px; text-align: center;">
          <div style="margin-bottom: 10px;">
            <div style="width: 25px; height: 25px; border: 3px solid #a6adc8; border-top: 3px solid #7c3aed; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
          </div>
          <p style="color: #a6adc8; font-size: 15px; margin: 0;">Loading mods...</p>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `,
      buttons: [] // No buttons during loading
    });

    console.log('[Welcome] Loading modal created:', !!loadingModal);
    console.log('[Welcome] Loading modal type:', typeof loadingModal);
  } catch (error) {
    console.error('[Welcome] Error creating loading modal:', error);
  }
}

// Update loading modal to show completion
async function updateLoadingToComplete() {
  console.log('[Welcome] updateLoadingToComplete called');
  console.log('[Welcome] loadingModal exists:', !!loadingModal);
  
  // Mark loading as completed
  loadingCompleted = true;
  
  if (!loadingModal) {
    console.warn('[Welcome] No loading modal to update - showing welcome modal directly');
    setTimeout(() => handleCompletionModalClose('(no loading modal)'), 100);
    return;
  }

  try {
    // Close the loading modal and show completion modal
    loadingModal?.close?.();
    loadingModal = null;

    // Try to close other modals and check if we can proceed
    const stillHasModals = await tryCloseModalsAndCheck();
    if (stillHasModals) {
      console.log('[Welcome] Aborting completion modal - other modal is still open after ESC attempts');
      modalAborted = true; // Mark as aborted to prevent future attempts
      return;
    }
    
    // If we successfully closed modals, reset the abort flag
    if (modalAborted) {
      console.log('[Welcome] Modals were closed successfully, resetting abort flag');
      modalAborted = false;
    }

    // Create a simple completion modal
    const completionModal = api.ui.components.createModal({
      title: 'Mods Loaded!',
      width: 300,
      height: 150,
      content: `
        <div style="padding: 20px; text-align: center;">
          <div style="margin-bottom: 15px;">
            <div style="width: 30px; height: 30px; border: 3px solid #4CAF50; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
              <span style="color: #4CAF50; font-size: 18px; font-weight: bold;">✓</span>
            </div>
          </div>
          <p style="color: #a6adc8; font-size: 15px; margin: 0 0 10px 0;">Loading complete!</p>
          <p style="color: #a6adc8; font-size: 15px; margin: 0; opacity: 0.7;">All mods loaded successfully.</p>
        </div>
      `,
      buttons: [
        {
          text: 'Got it!',
          primary: true,
          onClick: async (e, modalObj) => {
            modalObj?.close?.();
            handleCompletionModalClose('(completion modal button)');
          }
        }
      ]
    });

    // Add ESC key support for closing modal
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        completionModal?.close?.();
        handleCompletionModalClose('(ESC key)');
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    console.log('[Welcome] Completion modal created successfully');
  } catch (error) {
    console.error('[Welcome] Error creating completion modal:', error);
    // Fallback: show welcome modal directly
    setTimeout(() => handleCompletionModalClose('(error fallback)'), 100);
  }
}

// Hide loading modal
function hideLoadingModal() {
  console.log('[Welcome] hideLoadingModal called');
  console.log('[Welcome] loadingModal exists:', !!loadingModal);
  console.log('[Welcome] loadingCompleted:', loadingCompleted);
  
  if (loadingModal && typeof loadingModal.close === 'function') {
    loadingModal.close();
    loadingModal = null;
    console.log('[Welcome] Loading modal hidden successfully');
  } else {
    console.warn('[Welcome] Could not hide loading modal - invalid modal object');
  }
  
  // If loading was completed but modal was closed, show welcome modal as fallback
  if (loadingCompleted) {
    setTimeout(() => handleCompletionModalClose('(loading completed but modal was closed)'), 100);
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
              <p><strong>🔧 ${modCounts.official} Official Mods:</strong> Bestiary Automator, Board Analyzer, Hero Editor, Custom Display, and more!</p>
              <p><strong>🚀 ${modCounts.super} Super Mods:</strong> Autoseller, Cyclopedia, Hunt Analyzer, Outfiter, Raid Hunter, and more!</p>
              <p><strong>🧪 ${modCounts.test} Test Mod${modCounts.test !== 1 ? 's' : ''}:</strong> Board Advisor (experimental features)</p>
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
                <strong>💡 Tip:</strong> Click the extension icon to open the popup where you can enable/disable mods, or look for the "SuperMod" button in the header to access the dashboard!
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
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Force the modal size to match Cyclopedia dimensions
    setTimeout(() => {
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
    }, 100);
  } catch (error) {
    console.error('[Welcome] Error creating welcome modal:', error);
  }
}

// Listen for mod loading completion via direct message from local_mods.js
function setupModLoadingObserver() {
  console.log('[Welcome] Setting up mod loading completion listener');
  
  // Listen for completion message from local_mods.js
  const messageHandler = (event) => {
    if (event.source !== window) return;
    
    // Listen for mod loading completion message
    if (event.data?.from === 'LOCAL_MODS_LOADER' && event.data?.action === 'allModsLoaded') {
      console.log('[Welcome] Received mod loading completion signal from local_mods.js');
      updateLoadingToComplete().then(() => {
        modsLoaded = true;
      });
    }
  };
  
  window.addEventListener('message', messageHandler);
  
  // Store the handler for cleanup
  modLoadingObserver = {
    disconnect: () => {
      window.removeEventListener('message', messageHandler);
      console.log('[Welcome] Mod loading completion listener removed');
    }
  };
  
  // Fallback timer in case the message never comes
  setTimeout(() => {
    if (modLoadingObserver) {
      console.log('[Welcome] Mod loading completion timeout, using fallback');
      modLoadingObserver.disconnect();
      modLoadingObserver = null;
      updateLoadingToComplete().then(() => {
        modsLoaded = true;
      });
    }
  }, 3000); // Reduced to 3 second timeout
}

// Initialize welcome modal if conditions are met
async function initializeWelcome() {
  console.log('[Welcome] initializeWelcome called');
  
  // Set up mod loading completion listener immediately (before API check)
  console.log('[Welcome] Setting up mod loading completion listener...');
  setupModLoadingObserver();
  
  // Check if API is available and show welcome immediately
  if (api && api.ui && api.ui.components) {
    console.log('[Welcome] API available, starting loading process');
    
    // Simulate ESC key presses to prevent DOM errors before showing modal
    for (let i = 0; i < 3; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    }
    
    // Small delay to ensure ESC presses are processed
    setTimeout(async () => {
      await showLoadingModal();
    }, 50);
  } else {
    console.log('[Welcome] API not ready, retrying in 100ms');
    // API not ready yet, wait a short time and try again
    setTimeout(initializeWelcome, 100);
  }
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
window.addEventListener('message', handleWelcomeToggle);

// Cleanup function
function cleanup() {
  console.log('[Welcome] Cleaning up...');
  
  // Remove event listeners
  window.removeEventListener('message', handleWelcomeToggle);
  
  // Disconnect observer
  if (modLoadingObserver) {
    modLoadingObserver.disconnect();
    modLoadingObserver = null;
  }
  
  // Close any open modals
  if (loadingModal && typeof loadingModal.close === 'function') {
    loadingModal.close();
    loadingModal = null;
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
  showLoading: showLoadingModal,
  hideLoading: hideLoadingModal,
  updateLoadingToComplete: updateLoadingToComplete,
  isModsLoaded: () => modsLoaded,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
  },
  cleanup: cleanup
};
