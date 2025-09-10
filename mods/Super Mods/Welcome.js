// Welcome Mod for Bestiary Arena
// Shows a welcome page on initialization with mod description
console.log('Welcome mod initializing...');

// Configuration
const defaultConfig = {
  enabled: true,
  showWelcome: true
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

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
  try {
    // Try to get version from browser extension API
    if (window.browserAPI && window.browserAPI.runtime && window.browserAPI.runtime.getManifest) {
      const manifest = window.browserAPI.runtime.getManifest();
      return manifest.version || '1.8.7'; // fallback to current version
    }
    
    // Fallback: try to fetch from extension context
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
      const manifest = chrome.runtime.getManifest();
      return manifest.version || '1.8.7';
    }
    
    // Final fallback
    return '1.8.7';
  } catch (error) {
    console.warn('[Welcome] Could not get extension version:', error);
    return '1.8.7';
  }
}

// Show the welcome modal
async function showWelcomeModal() {
  if (!api || !api.ui || !api.ui.components) {
    console.error('[Welcome] API not available');
    return;
  }

  try {
    const version = await getExtensionVersion();
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
              <p><strong>🔧 Official Mods:</strong> Bestiary Automator, Board Analyzer, Hero Editor, and more!</p>
              <p><strong>🚀 Super Mods:</strong> Autoseller, Cyclopedia, Better Analytics, Hunt Analyzer, and more!</p>
              <p><strong>⚙️ Configuration:</strong> Import/export your settings and mod preferences</p>
              <p><strong>📊 Dashboard:</strong> Access the SuperMod dashboard for advanced features</p>
              <p><strong>🎛️ Popup Controls:</strong> Enable/disable mods directly from the extension popup</p>
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
              Bestiary Arena SuperMod Loader v${version}
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
            if (modalObj && typeof modalObj.close === 'function') {
              modalObj.close();
            }
          }
        },
        {
          text: 'Got It!',
          primary: true,
          onClick: (e, modalObj) => {
            if (modalObj && typeof modalObj.close === 'function') {
              modalObj.close();
            }
          }
        }
      ]
    });

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

// Initialize welcome modal if conditions are met
async function initializeWelcome() {
  // Check if API is available and show welcome immediately
  if (api && api.ui && api.ui.components) {
    const shouldShow = await shouldShowWelcome();
    if (shouldShow && config.showWelcome) {
      console.log('[Welcome] Showing welcome modal');
      showWelcomeModal();
    } else {
      console.log('[Welcome] Welcome modal skipped (user preference or config)');
    }
  } else {
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

// Export functionality
exports = {
  showWelcome: showWelcomeModal,
  setNeverShowAgain,
  shouldShowWelcome,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
  }
};
