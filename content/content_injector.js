// Polyfill for Chrome and Firefox WebExtensions
if (typeof window.browser === 'undefined') {
  window.browser = window.chrome;
}

window.browserAPI = window.browserAPI || (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

// Global Debug Flag System
// Read initial debug setting from localStorage
window.BESTIARY_DEBUG = localStorage.getItem('bestiary-debug') === 'true';

// Dynamic console.log override that checks flag on each call
const originalLog = console.log;
console.log = function(...args) {
  if (window.BESTIARY_DEBUG) {
    originalLog.apply(console, args);
  }
};

// Also override console.log in the page context immediately
if (typeof window !== 'undefined') {
  window.BESTIARY_DEBUG = localStorage.getItem('bestiary-debug') === 'true';
  const pageOriginalLog = window.console.log;
  window.console.log = function(...args) {
    if (window.BESTIARY_DEBUG) {
      pageOriginalLog.apply(window.console, args);
    }
  };
}

// Content Script Injector for Bestiary Arena Mod Loader
if (window.DEBUG) console.log('Content Script Injector initializing...');

// Store the base URL for mods
const modsBaseUrl = browserAPI.runtime.getURL('mods/');
if (window.DEBUG) console.log('Mods base URL:', modsBaseUrl);

// Script injection function
function injectScript(filePath) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const scriptUrl = browserAPI.runtime.getURL(filePath);
    script.src = scriptUrl;
    script.type = filePath.endsWith('.mjs') ? 'module' : 'text/javascript';
    
    console.warn(`[Content Injector] Injecting script: ${filePath}`);
    console.warn(`[Content Injector] Script URL: ${scriptUrl}`);
    console.warn(`[Content Injector] Script type: ${script.type}`);
    
    script.onload = function() {
      console.warn(`[Content Injector] ✓ Script ${filePath} loaded successfully`);
      if (window.DEBUG) console.log(`Script ${filePath} injected and loaded`);
      resolve();
    };
    
    script.onerror = function(error) {
      console.error(`[Content Injector] ✗ ERROR loading script ${filePath}:`, error);
      console.error(`[Content Injector] Script URL was: ${scriptUrl}`);
      console.error(`[Content Injector] Error details:`, {
        error,
        filePath,
        scriptUrl,
        scriptType: script.type,
        readyState: script.readyState
      });
      reject(error);
    };
    
    try {
    (document.head || document.documentElement).appendChild(script);
      console.warn(`[Content Injector] Script element appended to DOM`);
    } catch (e) {
      console.error(`[Content Injector] Failed to append script:`, e);
      reject(e);
    }
    
    if (window.DEBUG) console.log(`Script ${filePath} injection started`);
  });
}

// Scripts to load in order
async function loadScripts() {
  try {
    // First load client.js which sets up the API
    await injectScript('content/client.js');
    if (window.DEBUG) console.log('Client script loaded, waiting for API initialization...');
    
    // Short delay to ensure API is ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Load mod coordination system before mods
    console.warn('[Content Injector] ===== Loading mod-coordination.mjs =====');
    try {
        await injectScript('content/mod-coordination.mjs');
        console.warn('[Content Injector] mod-coordination.mjs injection promise resolved');
    } catch (error) {
        console.error('[Content Injector] ✗ CRITICAL: Failed to inject mod-coordination.mjs:', error);
        console.error('[Content Injector] Error stack:', error?.stack);
    }
    
    // Verify ModCoordination is available
    console.warn('[Content Injector] Checking for window.ModCoordination...');
    let retries = 0;
    while (!window.ModCoordination && retries < 20) {
        await new Promise(resolve => setTimeout(resolve, 50));
        retries++;
        if (retries % 5 === 0) {
            console.warn(`[Content Injector] Waiting for ModCoordination... (attempt ${retries}/20)`);
        }
    }
    
    if (window.ModCoordination) {
        console.warn('[Content Injector] ✓ ModCoordination system verified and ready');
        console.warn('[Content Injector] ModCoordination methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.ModCoordination)).filter(name => name !== 'constructor'));
    } else {
        console.error('[Content Injector] ✗ ModCoordination system NOT available after injection!');
        console.error('[Content Injector] window.ModCoordination:', window.ModCoordination);
        console.error('[Content Injector] typeof window.ModCoordination:', typeof window.ModCoordination);
    }
    
    if (window.DEBUG) console.log('Mod coordination system loaded');
    
    // Short delay to ensure coordination system is ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Then load local_mods.js
    await injectScript('content/local_mods.js');
    if (window.DEBUG) console.log('Local mods script loaded');
    
    // RunTracker is now loaded as a Super Mod
    if (window.DEBUG) console.log('RunTracker will be loaded as a Super Mod');
    
    // Load utility functions via the sandbox utils
    // Make sure this is last since it needs the API to be initialized
    await injectScript('content/ba-sandbox-utils.mjs');
    if (window.DEBUG) console.log('Sandbox utility script loaded');
    
    // Load custom battles system
    try {
      await injectScript('content/custom-battles.js');
      console.warn('[Content Injector] Custom battles script injection completed');
      
      // Verify CustomBattles is available (always check, not just in debug mode)
      let retries = 0;
      while (!window.CustomBattles && retries < 20) {
        await new Promise(resolve => setTimeout(resolve, 50));
        retries++;
        if (retries % 5 === 0) {
          console.warn(`[Content Injector] Waiting for CustomBattles... (attempt ${retries}/20)`);
        }
      }
      
      if (window.CustomBattles) {
        console.warn('[Content Injector] ✓ CustomBattles system verified and ready');
        console.warn('[Content Injector] CustomBattles.create available:', typeof window.CustomBattles.create);
      } else {
        console.error('[Content Injector] ✗ CustomBattles system NOT available after injection!');
        console.error('[Content Injector] window.CustomBattles:', window.CustomBattles);
        console.error('[Content Injector] typeof window.CustomBattles:', typeof window.CustomBattles);
      }
    } catch (error) {
      console.error('[Content Injector] ✗ CRITICAL: Failed to inject custom-battles.js:', error);
      console.error('[Content Injector] Error stack:', error?.stack);
    }
    
    // Send mod base URL and browser API info after scripts are loaded
    window.postMessage({
      from: 'BESTIARY_EXTENSION',
      modBaseUrl: modsBaseUrl,
      browserAPI: {
        chrome: !!window.chrome,
        browser: !!window.browser,
        runtime: !!window.browserAPI?.runtime
      }
    }, '*');
    
    if (window.DEBUG) console.log('All scripts loaded and mod base URL sent');
  } catch (error) {
    console.error('Error loading scripts:', error);
  }
}

// Communication bridge between page and extension
window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  
  // Messages from page script to extension
  if (event.data && event.data.from === 'BESTIARY_CLIENT') {
    if (window.DEBUG) console.log('Received message from page script:', event.data);
    
    if (event.data.message && event.data.message.action === 'registerLocalMods') {
      // Forward to background script
      browserAPI.runtime.sendMessage(event.data.message, response => {
        if (window.DEBUG) console.log('Register mods response:', response);
        
        // Forward response back to page
        window.postMessage({
          from: 'BESTIARY_EXTENSION',
          message: {
            action: 'registerLocalMods',
            mods: response?.mods || []
          }
        }, '*');
      });
    }
    
    if (event.data.message && event.data.message.action === 'getLocalModConfig') {
      // Get mod configuration
      browserAPI.runtime.sendMessage(event.data.message, response => {
        if (window.DEBUG) console.log('Get mod config response:', response);
        
        // Forward configuration to page
        window.postMessage({
          from: 'BESTIARY_EXTENSION',
          id: event.data.id,
          response: {
            success: !!response?.success,
            config: response?.config || {}
          }
        }, '*');
      });
    }
    
    if (event.data.message && event.data.message.action === 'getVersion') {
      // Get extension version
      browserAPI.runtime.sendMessage(event.data.message, response => {
        if (window.DEBUG) console.log('Get version response:', response);
        
        // Forward version to page
        window.postMessage({
          from: 'BESTIARY_EXTENSION',
          id: event.data.id,
          response: {
            success: !!response?.success,
            version: response?.version || 'unknown'
          }
        }, '*');
      });
    }
    
    if (event.data.message && event.data.message.action === 'getModCounts') {
      // Get mod counts
      browserAPI.runtime.sendMessage(event.data.message, response => {
        if (window.DEBUG) console.log('Get mod counts response:', response);
        
        // Forward mod counts to page
        window.postMessage({
          from: 'BESTIARY_EXTENSION',
          id: event.data.id,
          response: {
            success: !!response?.success,
            counts: response?.counts || { official: 0, super: 0, test: 0 }
          }
        }, '*');
      });
    }
    
    if (event.data.message && event.data.message.action === 'getLocalMods') {
      if (window.DEBUG) console.log('Content injector: Processing getLocalMods request');
      
      // Wake up service worker first (for Chrome)
      browserAPI.runtime.sendMessage({ action: 'ping' }, (pingResponse) => {
        if (window.DEBUG) console.log('Content injector: Ping response:', pingResponse);
        
        // Then get local mods from background script
        browserAPI.runtime.sendMessage(event.data.message, response => {
          if (window.DEBUG) console.log('Content injector: Get local mods response:', response);
          
          // Forward local mods to page
          window.postMessage({
            from: 'BESTIARY_EXTENSION',
            id: event.data.id,
            response: {
              success: !!response?.success,
              mods: response?.mods || []
            }
          }, '*');
        });
      });
    }
    
    if (event.data.message && event.data.message.action === 'getManualMods') {
      console.log('Content injector: Processing getManualMods request');
      
      // Wake up service worker first (for Chrome)
      browserAPI.runtime.sendMessage({ action: 'ping' }, (pingResponse) => {
        console.log('Content injector: Ping response:', pingResponse);
        
        // Then get manual mods from background script
        browserAPI.runtime.sendMessage(event.data.message, response => {
          console.log('Content injector: Get manual mods response:', response);
          
          // Forward manual mods to page
          window.postMessage({
            from: 'BESTIARY_EXTENSION',
            id: event.data.id,
            response: {
              success: !!response?.success,
              mods: response?.mods || []
            }
          }, '*');
        }).catch(error => {
          console.error('Content injector: Error getting manual mods:', error);
          // Send empty response on error
          window.postMessage({
            from: 'BESTIARY_EXTENSION',
            id: event.data.id,
            response: {
              success: false,
              mods: []
            }
          }, '*');
        });
      });
    }
  }
  
  // Listen for utility functions loaded message
  if (event.data && event.data.from === 'BA_SANDBOX_UTILS' && event.data.type === 'UTILITY_FUNCTIONS_LOADED') {
    if (window.DEBUG) console.log('Utility functions loaded in the page:', event.data.functions);
    
    // Notify other parts of the extension if needed
    browserAPI.runtime.sendMessage({
      action: 'utilityFunctionsLoaded',
      functions: event.data.functions
    });
  }
});

// Initialization
if (window.DEBUG) console.log('Starting script injection sequence...');

// Inject debug override directly into page context
const debugOverrideScript = document.createElement('script');
debugOverrideScript.textContent = `
  // Global Debug Flag System for Mod Console Logs
  window.BESTIARY_DEBUG = localStorage.getItem('bestiary-debug') === 'true';
  
  // Override console.log in page context
  const originalLog = console.log;
  console.log = function(...args) {
    if (window.BESTIARY_DEBUG) {
      originalLog.apply(console, args);
    }
  };
  
  // Listen for debug mode changes
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.action === 'updateDebugMode') {
      window.BESTIARY_DEBUG = event.data.enabled;
      console.log('Debug mode updated to:', window.BESTIARY_DEBUG ? 'enabled' : 'disabled');
    }
  });
`;
document.head.appendChild(debugOverrideScript);

loadScripts();

// Listen for messages from background script
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (window.DEBUG) console.log('Content script received message:', message);
  
  if (message.action === 'executeLocalMod') {
    // Forward to page script
    window.postMessage({
      from: 'BESTIARY_EXTENSION',
      message: message
    }, '*');
    
    sendResponse({success: true});
  }
  
  if (message.action === 'updateLocalModState') {
    // Forward the mod state update to the page script
    window.postMessage({
      from: 'BESTIARY_EXTENSION',
      message: message
    }, '*');
    
    sendResponse({success: true});
  }
  
  if (message.action === 'updateDebugMode') {
    // Update the debug flag immediately
    window.BESTIARY_DEBUG = message.enabled;
    console.log('Debug mode updated to:', window.BESTIARY_DEBUG ? 'enabled' : 'disabled');
    sendResponse({success: true});
  }
  
  return true; // Indicates we may respond asynchronously
});

if (window.DEBUG) console.log('Content Script Injector setup complete'); 