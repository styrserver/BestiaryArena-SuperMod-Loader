// Polyfill for Chrome and Firefox WebExtensions
if (typeof window.browser === 'undefined') {
  window.browser = window.chrome;
}

window.browserAPI = window.browserAPI || (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

// Content Script Injector for Bestiary Arena Mod Loader
console.log('Content Script Injector initializing...');

// Store the base URL for mods
const modsBaseUrl = browserAPI.runtime.getURL('mods/');
console.log('Mods base URL:', modsBaseUrl);

// Script injection function
function injectScript(filePath) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = browserAPI.runtime.getURL(filePath);
    script.type = filePath.endsWith('.mjs') ? 'module' : 'text/javascript';
    script.onload = function() {
      console.log(`Script ${filePath} injected and loaded`);
      resolve();
    };
    script.onerror = function(error) {
      console.error(`Error loading script ${filePath}:`, error);
      resolve(); // Resolve anyway to continue the chain
    };
    (document.head || document.documentElement).appendChild(script);
    console.log(`Script ${filePath} injection started`);
  });
}

// Scripts to load in order
async function loadScripts() {
  try {
    // First load client.js which sets up the API
    await injectScript('content/client.js');
    console.log('Client script loaded, waiting for API initialization...');
    
    // Short delay to ensure API is ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Then load local_mods.js
    await injectScript('content/local_mods.js');
    console.log('Local mods script loaded');
    
    // Load utility functions via the sandbox utils
    // Make sure this is last since it needs the API to be initialized
    await injectScript('content/ba-sandbox-utils.mjs');
    console.log('Sandbox utility script loaded');
    
    // Send mod base URL after scripts are loaded
    window.postMessage({
      from: 'BESTIARY_EXTENSION',
      modBaseUrl: modsBaseUrl
    }, '*');
    
    console.log('All scripts loaded and mod base URL sent');
  } catch (error) {
    console.error('Error loading scripts:', error);
  }
}

// Communication bridge between page and extension
window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  
  // Messages from page script to extension
  if (event.data && event.data.from === 'BESTIARY_CLIENT') {
    console.log('Received message from page script:', event.data);
    
    if (event.data.message && event.data.message.action === 'registerLocalMods') {
      // Forward to background script
      browserAPI.runtime.sendMessage(event.data.message, response => {
        console.log('Register mods response:', response);
        
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
        console.log('Get mod config response:', response);
        
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
  }
  
  // Listen for utility functions loaded message
  if (event.data && event.data.from === 'BA_SANDBOX_UTILS' && event.data.type === 'UTILITY_FUNCTIONS_LOADED') {
    console.log('Utility functions loaded in the page:', event.data.functions);
    
    // Notify other parts of the extension if needed
    browserAPI.runtime.sendMessage({
      action: 'utilityFunctionsLoaded',
      functions: event.data.functions
    });
  }
});

// Initialization
console.log('Starting script injection sequence...');
loadScripts();

// Listen for messages from background script
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
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
  
  return true; // Indicates we may respond asynchronously
});

console.log('Content Script Injector setup complete'); 