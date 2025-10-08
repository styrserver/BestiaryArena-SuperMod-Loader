// Polyfill for Chrome and Firefox WebExtensions
if (typeof window.browser === 'undefined') {
  window.browser = window.chrome;
}

window.browserAPI = window.browserAPI || (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

// Initialize debug flag immediately at the top level
if (typeof window !== 'undefined') {
  window.BESTIARY_DEBUG = localStorage.getItem('bestiary-debug') === 'true';
}

console.log('Local Mods Loader initializing...');
console.log('Browser API available:', {
  browserAPI: !!window.browserAPI,
  chrome: !!window.chrome,
  browser: !!window.browser,
  runtime: !!(window.browserAPI && window.browserAPI.runtime)
});

if (typeof window.localMods === 'undefined') {
  window.localMods = [];
}

let executedMods = {};
let isInitializing = false;
let initializationPromise = null;
let isBatchExecuting = false; // Flag to prevent duplicate executions during batch operations

// Get the base URL for mods from a message from the injector
let modBaseUrl = '';

// Ensure API is created immediately
window.localModsAPI = {
  getLocalMods: () => window.localMods,
  executeLocalMod: null // Will be defined later
};

function getModUrl(modName) {
  if (modName.startsWith('database/')) {
    // Try multiple ways to get the browser API first
    const api = window.browserAPI || window.chrome || window.browser;
    
    if (api && api.runtime && api.runtime.getURL) {
      try {
        return api.runtime.getURL(modName);
      } catch (error) {
        console.warn('Error getting URL from browser API:', error);
      }
    }
    
    // Fallback: construct URL from modBaseUrl by removing 'mods/' and adding the database path
    if (modBaseUrl) {
      const baseUrl = modBaseUrl.endsWith('mods/') ? modBaseUrl.replace('mods/', '') : modBaseUrl;
      return baseUrl + modName;
    }
    
    console.warn('No base URL available for database file:', modName);
    return null;
  }
  return modBaseUrl + modName;
}

async function getLocalModContent(modName) {
  try {
    console.log(`Fetching content for local mod: ${modName}`);
    const modUrl = getModUrl(modName);
    console.log(`Mod URL: ${modUrl}`);
    
    // Firefox-specific handling
    if (typeof browser !== 'undefined' && browser !== window.chrome) {
      console.log('Firefox detected, using Firefox-specific content loading');
      
      const api = window.browserAPI || window.chrome || window.browser;
      if (api && api.runtime && api.runtime.sendMessage) {
        try {
          console.log(`Firefox: Requesting mod content via background script: ${modName}`);
          const response = await new Promise((resolve, reject) => {
            api.runtime.sendMessage({
              action: 'getModContent',
              modName: modName
            }, (response) => {
              const lastError = chrome.runtime.lastError || browser.runtime.lastError;
              if (lastError) {
                reject(new Error(lastError.message));
              } else {
                resolve(response);
              }
            });
          });
          
          if (response && response.success && response.content) {
            console.log(`Firefox: Mod content loaded via background script, length: ${response.content.length} bytes`);
            return response.content;
          } else {
            throw new Error('Background script returned invalid response');
          }
        } catch (backgroundError) {
          console.error(`Firefox: Background script fetch failed for ${modName}:`, backgroundError);
          
          // Fallback: try direct fetch even in Firefox
          console.log(`Firefox: Trying direct fetch as fallback for ${modName}`);
          try {
            const response = await fetch(modUrl);
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const content = await response.text();
            console.log(`Firefox: Direct fetch fallback successful, length: ${content.length} bytes`);
            return content;
          } catch (fetchError) {
            console.error(`Firefox: Direct fetch fallback also failed for ${modName}:`, fetchError);
            return null;
          }
        }
      }
    }
    
    // Chrome/Chromium fallback to direct fetch
    console.log('Using direct fetch for mod content');
    const response = await fetch(modUrl);
    
    if (!response.ok) {
      console.error(`HTTP error fetching mod ${modName}! Status: ${response.status}`);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const content = await response.text();
    console.log(`Mod content loaded, length: ${content.length} bytes`);
    return content;
  } catch (error) {
    console.error(`Error fetching local mod ${modName}:`, error);
    return null;
  }
}

async function checkFileExists(modName) {
  try {
    console.log(`Checking if file exists: ${modName}`);
    const modUrl = getModUrl(modName);
    console.log(`Checking URL: ${modUrl}`);
    
    if (!modUrl) {
      console.warn(`No URL generated for mod: ${modName}`);
      return false;
    }
    
    // Firefox-specific handling
    if (typeof browser !== 'undefined' && browser !== window.chrome) {
      console.log('Firefox detected, using Firefox-specific file checking');
      
      // For Firefox, we'll assume the file exists if we can get a URL
      const api = window.browserAPI || window.chrome || window.browser;
      if (api && api.runtime && api.runtime.getURL) {
        try {
          const testUrl = api.runtime.getURL(modName);
          if (testUrl) {
            console.log(`Firefox: File ${modName} URL generated successfully: ${testUrl}`);
            return true;
          }
        } catch (error) {
          console.warn(`Firefox: Error getting URL for ${modName}:`, error);
          // In Firefox, if we can't get a URL, still assume the file exists for known files
          if (modName.startsWith('database/') || modName.includes('Super Mods/') || modName.includes('Official Mods/')) {
            console.log(`Firefox: Assuming known file ${modName} exists despite URL error`);
            return true;
          }
          return false;
        }
      }
      
      // If we can't get a URL, assume database files and known mods exist in Firefox
      if (modName.startsWith('database/') || modName.includes('Super Mods/') || modName.includes('Official Mods/')) {
        console.log(`Firefox: Assuming known file ${modName} exists`);
        return true;
      }
    }
    
    // Chrome/Chromium fallback to fetch
    try {
      const response = await fetch(modUrl, { method: 'HEAD' });
      const exists = response.ok;
      console.log(`File ${modName} exists: ${exists}, status: ${response.status}`);
      if (!exists) {
        console.error(`Failed to find mod at ${modUrl}, status: ${response.status}`);
      }
      return exists;
    } catch (fetchError) {
      console.warn(`Fetch check failed for ${modName}, assuming file exists:`, fetchError);
      // In Firefox, fetch might fail due to CORS, but the file might still exist
      return true;
    }
  } catch (error) {
    console.error(`Error checking if file exists: ${modName}`, error);
    return false;
  }
}

// Import mod registry
let MOD_REGISTRY = null;

// Load mod registry dynamically
async function loadModRegistry() {
  if (MOD_REGISTRY) return MOD_REGISTRY;
  
  try {
    // This script runs in PAGE CONTEXT (injected), not as a content script
    // So we need to use getModUrl() which constructs URLs from modBaseUrl
    // The modBaseUrl is set by the injector before this script loads
    
    let registryUrl;
    
    // Check if we have modBaseUrl set (this is the extension base URL)
    if (modBaseUrl) {
      // Construct the registry URL from the base URL
      // modBaseUrl ends with 'mods/', so we need to go up one level
      const baseUrl = modBaseUrl.replace(/mods\/$/, '');
      registryUrl = baseUrl + 'content/mod-registry.js';
      console.log('[Mod Registry] Using modBaseUrl to construct registry path');
    } else {
      throw new Error('modBaseUrl not set - extension base URL not available');
    }
    
    console.log('[Mod Registry] Attempting to load from:', registryUrl);
    
    // Try to import the registry module
    const module = await import(registryUrl);
    MOD_REGISTRY = module;
    console.log('[Mod Registry] Successfully loaded mod registry');
    return module;
  } catch (error) {
    // CRITICAL: If registry fails to load, the extension cannot function
    console.error('[Mod Registry] CRITICAL ERROR: Failed to load mod registry!', error);
    console.error('[Mod Registry] The extension cannot function without the registry.');
    console.error('[Mod Registry] Please reload the extension or check the console for errors.');
    console.error('[Mod Registry] modBaseUrl was:', modBaseUrl);
    throw new Error('Mod registry failed to load - extension cannot function');
  }
}

async function listAllModFiles() {
  // Only include .js files from Official Mods and Super Mods
  // User-generated scripts are handled separately via localStorage
  const registry = await loadModRegistry();
  return registry.getAllMods();
}

// List of mods to enable by default - can be overridden by registry
let defaultEnabledMods = [
  'database/Welcome.js',
  'database/inventory-database.js',
  'database/creature-database.js',
  'database/equipment-database.js',
  'Official Mods/Bestiary_Automator.js',
  'Official Mods/Board Analyzer.js',
  'Official Mods/Custom_Display.js',
  'Official Mods/Hero_Editor.js',
  'Official Mods/Highscore_Improvements.js',
  'Official Mods/Item_tier_list.js',
  'Official Mods/Monster_tier_list.js',
  'Official Mods/Setup_Manager.js',
  'Official Mods/Team_Copier.js',
  'Official Mods/Tick_Tracker.js',
  'Official Mods/Turbo Mode.js',
  // Hidden Super Mods - enabled by default since users can't toggle them in popup
  'Super Mods/RunTracker.js',
  'Super Mods/Outfiter.js',
  'Super Mods/Playercount.js'
  // All other Super Mods are disabled by default - users must manually enable them
];

// Update defaultEnabledMods from registry if available
async function getDefaultEnabledMods() {
  try {
    const registry = await loadModRegistry();
    if (registry && registry.DEFAULT_ENABLED_MODS) {
      return registry.DEFAULT_ENABLED_MODS;
    }
  } catch (error) {
    console.warn('[Mod Registry] Could not load default enabled mods from registry:', error);
  }
  return defaultEnabledMods;
}

// Key for localStorage user-generated scripts
const MANUAL_MODS_KEY = 'manualMods';



// Helper function to get user-generated scripts from localStorage
async function getManualMods() {
  return new Promise(resolve => {
    console.log('getManualMods: Requesting manual mods from background script...');
    
    // Use message passing to get manual mods from background script
    const messageId = 'manual_mods_' + Date.now() + '_' + Math.random();
    
    // Set up a listener for the response
    let responseHandler = (event) => {
      if (event.source !== window) return;
      if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.id === messageId) {
        clearTimeout(timeoutId);
        window.removeEventListener('message', responseHandler);
        const mods = event.data.response?.mods || [];
        console.log(`getManualMods: Received ${mods.length} manual mods from background script:`, mods.map(m => m.name));
        resolve(mods);
      }
    };
    
    // Fallback timeout in case no response
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', responseHandler);
      console.warn('getManualMods: No response from background script, trying direct storage access...');
      
      // Try direct storage access as fallback
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['manualMods'], result => {
          const mods = result.manualMods || [];
          console.log(`getManualMods: Fallback - Found ${mods.length} manual mods in direct storage access:`, mods.map(m => m.name));
          resolve(mods);
        });
      } else if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        browser.storage.local.get(['manualMods'], result => {
          const mods = result.manualMods || [];
          console.log(`getManualMods: Fallback - Found ${mods.length} manual mods in direct storage access:`, mods.map(m => m.name));
          resolve(mods);
        });
      } else {
        console.warn('getManualMods: No storage API available, using empty array');
        resolve([]);
      }
    }, 2000); // Further reduced timeout for faster fallback
    
    window.addEventListener('message', responseHandler);
    
    // Send request to background script via content_injector
    window.postMessage({
      from: 'BESTIARY_CLIENT',
      id: messageId,
      message: {
        action: 'getManualMods'
      }
    }, '*');
  });
}

// Optimized initialization function with proper sequencing
async function initLocalMods() {
  if (isInitializing) {
    console.log('Initialization already in progress, waiting...');
    return initializationPromise;
  }
  
  if (initializationPromise) {
    console.log('Using existing initialization promise');
    return initializationPromise;
  }
  
  isInitializing = true;
  initializationPromise = (async () => {
    try {
      console.log('Initializing local mods...');
      if (!modBaseUrl) {
        console.warn('Mod base URL not set, waiting for extension communication');
        return;
      }
      

      
      const modFiles = await listAllModFiles();
      const enabledByDefault = await getDefaultEnabledMods();
      let validMods = [];
      
      // Process file-based mods (Official and Super Mods)
      for (const file of modFiles) {
        console.log(`Checking mod file: ${file}`);
        const exists = await checkFileExists(file);
        console.log(`File ${file} exists: ${exists}`);
        if (exists) {
          // Enable only if in defaultEnabledMods (Super Mods are no longer auto-enabled)
          const isDatabaseMod = file.startsWith('database/');
          const enabled = enabledByDefault.includes(file);
          console.log(`Mod ${file} enabled: ${enabled} (isDatabaseMod: ${isDatabaseMod})`);
          
          validMods.push({
            name: file,
            key: file.replace('.js','').replace(/_/g,' '),
            enabled: enabled,
            type: 'file'
          });
        }
      }
      
      // Process user-generated scripts from localStorage
      console.log('Starting to process manual mods...');
      const manualMods = await getManualMods();
      console.log(`Found ${manualMods.length} user-generated scripts in localStorage`);
      
      manualMods.forEach((manualMod, index) => {
        console.log(`Processing manual mod: ${manualMod.name}, enabled: ${manualMod.enabled !== false}`);
        validMods.push({
          name: `User Mods/${manualMod.name}.js`,
          key: manualMod.name,
          enabled: manualMod.enabled !== false, // Default to enabled unless explicitly disabled
          type: 'manual',
          content: manualMod.content,
          originalName: manualMod.name
        });
      });
      
      if (validMods.length === 0) {
        console.warn('No valid local mods found!');
      } else {
        console.log(`Found ${validMods.length} total mods (${validMods.filter(m => m.type === 'file').length} file-based, ${validMods.filter(m => m.type === 'manual').length} user-generated)`);
      }
      
      window.localMods = validMods.map(mod => ({
        name: mod.name,
        displayName: mod.key,
        isLocal: true,
        enabled: mod.enabled,
        type: mod.type,
        content: mod.content,
        originalName: mod.originalName
      }));
      
      console.log('Local mods initialized:', window.localMods);
      console.log('Manual mods in initialized data:', 
        window.localMods.filter(m => m.type === 'manual').map(m => ({ 
          name: m.name, 
          type: m.type, 
          hasContent: !!m.content,
          contentLength: m.content ? m.content.length : 0
        })));
      
      // Sort mods in the correct order before registering
      window.localMods = window.localMods.sort((a, b) => {
        const getModOrder = (modName) => {
          if (modName.startsWith('database/')) return 0;
          if (modName.startsWith('Official Mods/')) return 1;
          if (modName.startsWith('Super Mods/')) return 2;
          if (modName.startsWith('User Mods/')) return 3;
          return 4; // Unknown mods go last
        };
        
        const orderA = getModOrder(a.name);
        const orderB = getModOrder(b.name);
        
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        
        // Within the same category, maintain alphabetical order
        return a.name.localeCompare(b.name);
      });
      
      console.log('=== MOD SORTING DEBUG ===');
      console.log('Total mods to sort:', window.localMods.length);
      console.log('Mods by category:');
      const categories = {};
      window.localMods.forEach(mod => {
        const category = mod.name.split('/')[0];
        if (!categories[category]) categories[category] = [];
        categories[category].push(mod.name);
      });
      Object.keys(categories).forEach(cat => {
        console.log(`  ${cat}: ${categories[cat].length} mods - ${categories[cat].join(', ')}`);
      });
      console.log('Final sorted order:', window.localMods.map(m => m.name));
      console.log('=== END MOD SORTING DEBUG ===');
      
      // Register mods with the extension
      window.postMessage({
        from: 'BESTIARY_CLIENT',
        message: {
          action: 'registerLocalMods',
          mods: window.localMods
        }
      }, '*');
      
      // Don't execute mods here - wait for stored states from background script
      console.log('Mods initialized, waiting for stored states from background script before execution');
      
      console.log('Initialization completed successfully');
      return window.localMods;
    } finally {
      isInitializing = false;
    }
  })();
  
  return initializationPromise;
}

// Optimized execution function with better error handling and deduplication
async function executeLocalMod(modNameOrObject, forceExecution = false) {
  // Handle both string (mod name) and object (mod object) parameters
  const isModObject = typeof modNameOrObject === 'object' && modNameOrObject !== null;
  const modName = isModObject ? modNameOrObject.name : modNameOrObject;
  const mod = isModObject ? modNameOrObject : window.localMods.find(m => m.name === modNameOrObject);
  
  console.log(`=== EXECUTE LOCAL MOD START: ${modName} ===`);
  console.log(`Force execution: ${forceExecution}`);
  console.log(`Mod type: ${isModObject ? 'object' : 'string'}`);
  
  // If already executed, log and exit (but allow a forced re-execution if needed)
  if (executedMods[modName] && !forceExecution) {
    console.log(`Local mod ${modName} was already executed, skipping`);
    return executedMods[modName];
  }

  // Check if the mod exists and is enabled
  if (!mod) {
    console.error(`Cannot execute mod ${modName}: mod not found in local mods list`);
    console.log(`Available mods:`, window.localMods ? window.localMods.map(m => m.name) : 'undefined');
    return null;
  }
  
  console.log(`Found mod:`, mod);
  console.log(`Mod properties:`, {
    name: mod.name,
    type: mod.type,
    hasContent: !!mod.content,
    contentLength: mod.content ? mod.content.length : 0,
    enabled: mod.enabled
  });
  
  if (!mod.enabled && !forceExecution) {
    console.log(`Skipping disabled mod: ${modName}`);
    return null;
  }

  console.log(`Executing local mod: ${modName}`);
  
  let content = null;
  
  // Check if this is a user-generated script (manual mod)
  console.log(`Checking mod type for ${modName}:`, mod.type, 'has content:', !!mod.content);
  if (mod && mod.type === 'manual' && mod.content) {
    // Use the content directly from the mod object
    content = mod.content;
    console.log(`Using stored content for user-generated mod: ${modName}`);
    console.log(`Manual mod content preview:`, content.substring(0, 200) + '...');
  } else {
    // Fetch content from file for file-based mods
    if (!modBaseUrl) {
      console.error(`Cannot execute mod ${modName}: mod base URL not set yet`);
      return null;
    }
    
    content = await getLocalModContent(modName);
    
    if (!content) {
      console.error(`Failed to load local mod: ${modName}`);
      return null;
    }
  }
  
  try {
    // Check API availability with better retry mechanism
    if (!window.BestiaryModAPI) {
      console.warn(`BestiaryModAPI not available yet, will retry executing mod: ${modName}`);
      
      // Setup a more robust retry mechanism
      let retryCount = 0;
      const maxRetries = 20; // Increase max retries
      const checkAndExecute = () => {
        retryCount++;
        if (window.BestiaryModAPI) {
          console.log(`BestiaryModAPI now available on retry ${retryCount}, executing mod: ${modName}`);
          executeLocalMod(modNameOrObject, forceExecution);
        } else if (retryCount < maxRetries) {
          console.log(`BestiaryModAPI still not available, retry ${retryCount}/${maxRetries}`);
          setTimeout(checkAndExecute, 300); // Slightly faster retries
        } else {
          console.error(`BestiaryModAPI not available after ${maxRetries} retries, giving up on mod: ${modName}`);
        }
      };
      
      setTimeout(checkAndExecute, 300);
      return null;
    }

    // Get saved config for the mod via page communication
    let modConfig = {};
    try {
      const configId = generateMessageId();
      
      // Request mod config via message to the injector
      window.postMessage({
        from: 'BESTIARY_CLIENT',
        id: configId,
        message: {
          action: 'getLocalModConfig',
          modName: modName
        }
      }, '*');

      // Execute with a slight delay to allow config to be received
      return new Promise((resolve) => {
        setTimeout(async () => {
          try {
            console.log(`Creating context for local mod: ${modName}`);
            const scriptContext = {
              hash: `local_${modName}`,
              config: modConfig,
              api: window.BestiaryModAPI,
              // Add debug flag to context
              BESTIARY_DEBUG: window.BESTIARY_DEBUG || localStorage.getItem('bestiary-debug') === 'true'
            };
            
            console.log(`Preparing to execute mod: ${modName}`);
            const scriptFunction = new Function('context', `
              // Override console.log based on debug flag
              const originalLog = console.log;
              console.log = function(...args) {
                const currentDebug = localStorage.getItem('bestiary-debug') === 'true' || window.BESTIARY_DEBUG === true;
                if (currentDebug) {
                  originalLog.apply(console, args);
                }
              };
              
              with (context) {
                ${content}
              }
              // Return any exports
              return context.exports;
            `);
            
            console.log(`Executing mod function for: ${modName}`);
            const scriptResult = scriptFunction(scriptContext);
            executedMods[modName] = {
              name: modName,
              exports: scriptResult,
              context: scriptContext
            };
            
            console.log(`Local mod ${modName} executed successfully`, scriptResult);
            console.log(`=== EXECUTE LOCAL MOD END: ${modName} ===`);
            
            resolve(executedMods[modName]);
          } catch (error) {
            console.error(`Error executing mod ${modName}:`, error);
            resolve(null);
          }
        }, 50);
      });
    } catch (error) {
      console.warn(`Could not load config for mod ${modName}:`, error);
      
      console.log(`Creating context for local mod: ${modName}`);
      const scriptContext = {
        hash: `local_${modName}`,
        config: {},
        api: window.BestiaryModAPI,
        // Add debug flag to context
        BESTIARY_DEBUG: window.BESTIARY_DEBUG || localStorage.getItem('bestiary-debug') === 'true'
      };
      
      console.log(`Preparing to execute mod: ${modName}`);
      const scriptFunction = new Function('context', `
        // Override console.log based on debug flag
        const originalLog = console.log;
        console.log = function(...args) {
          const currentDebug = localStorage.getItem('bestiary-debug') === 'true' || window.BESTIARY_DEBUG === true;
          if (currentDebug) {
            originalLog.apply(console, args);
          }
        };
        
        with (context) {
          ${content}
        }
        // Return any exports
        return context.exports;
      `);
      
      console.log(`Executing mod function for: ${modName}`);
      const scriptResult = scriptFunction(scriptContext);
      executedMods[modName] = {
        name: modName,
        exports: scriptResult,
        context: scriptContext
      };
      
      console.log(`Local mod ${modName} executed successfully`, scriptResult);
      console.log(`=== EXECUTE LOCAL MOD END: ${modName} ===`);
      
      return executedMods[modName];
    }
  } catch (error) {
    console.error(`Error executing local mod ${modName}:`, error);
    console.log(`=== EXECUTE LOCAL MOD ERROR: ${modName} ===`);
    throw error;
  }
}

// Optimized batch execution function
async function executeModsInOrder(mods, forceExecution = false) {
  console.log(`[Local Mods] executeModsInOrder called with ${mods.length} mods, forceExecution: ${forceExecution}`);
  if (isBatchExecuting) {
    console.log('Batch execution already in progress, skipping duplicate call');
    return [];
  }
  
  isBatchExecuting = true;
  console.log(`Executing ${mods.length} mods in order...`);
  
  try {
    const results = [];
    for (const mod of mods) {
      if (mod.enabled || forceExecution) {
        try {
          // Use the consolidated executeLocalMod function
          const result = await executeLocalMod(mod, forceExecution);
          results.push({ mod: mod.name, success: !!result, result });
        } catch (error) {
          console.error(`Failed to execute mod ${mod.name}:`, error);
          results.push({ mod: mod.name, success: false, error: error.message });
        }
      }
    }
    
    console.log(`Batch execution completed. Results:`, results);
    
    // Send completion signal to Welcome mod after a delay to ensure all mods are fully loaded and listeners are set up
    console.log('[Local Mods] About to send completion signal...');
    setTimeout(() => {
      console.log('[Local Mods] Sending completion signal now...');
      sendCompletionSignal();
    }, 500); // Increased delay to ensure Welcome mod is ready
    
    return results;
  } finally {
    isBatchExecuting = false;
  }
}

// Generate unique ID for messages
let messageIdCounter = 0;
function generateMessageId() {
  return `mod_msg_${Date.now()}_${messageIdCounter++}`;
}

// Simple completion signal - send once when all mods are done
let completionSignalSent = false;

function sendCompletionSignal() {
  console.log('[Local Mods] sendCompletionSignal called, completionSignalSent:', completionSignalSent);
  if (completionSignalSent) {
    console.log('[Local Mods] Completion signal already sent, skipping');
    return; // Only send once
  }
  
  console.log('[Local Mods] All mods completed - sending signal');
  completionSignalSent = true;
  
  window.postMessage({
    from: 'LOCAL_MODS_LOADER',
    action: 'allModsLoaded'
  }, '*');
  
  console.log('[Local Mods] Completion signal sent successfully');
}

// Reset completion signal flag (for testing/reloading)
function resetCompletionSignal() {
  completionSignalSent = false;
  console.log('[Local Mods] Completion signal flag reset');
}

document.addEventListener('reloadLocalMods', () => {
  console.log('Received reloadLocalMods event, reinitializing...');
  window.localMods = [];
  executedMods = {};
  initializationPromise = null; // Reset initialization promise
  resetCompletionSignal(); // Reset completion signal flag
  initLocalMods();
});

// Expose API functions immediately so they're available
window.localModsAPI.executeLocalMod = executeLocalMod;
window.localModsAPI.executeModsInOrder = executeModsInOrder;

window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  
  if (event.data && event.data.from === 'BESTIARY_EXTENSION') {
    if (event.data.modBaseUrl) {
      modBaseUrl = event.data.modBaseUrl;
      console.log('Received mod base URL:', modBaseUrl);
      
      // Log some diagnostic info
      console.log('ModBaseUrl format check:', {
        endsWithSlash: modBaseUrl.endsWith('/'),
        startsWithHttp: modBaseUrl.startsWith('http'),
        protocol: modBaseUrl.split(':')[0]
      });
      
      // Now that we have the base URL, we can initialize
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLocalMods);
      } else {
        initLocalMods();
      }
    }
    
    if (event.data.message && event.data.message.action === 'registerLocalMods') {
      console.log('Received registerLocalMods message:', event.data.message);
      if (event.data.message.mods && Array.isArray(event.data.message.mods)) {
        // Merge with existing mods instead of replacing to avoid dropping file-based mods
        const incoming = event.data.message.mods;
        const existingByName = new Map(window.localMods.map(m => [m.name, m]));
        
        // Update or add from incoming
        for (const inc of incoming) {
          const prev = existingByName.get(inc.name);
          if (prev) {
            // Preserve type/content/displayName from existing; update enabled state from incoming
            prev.enabled = inc.enabled;
          } else {
            existingByName.set(inc.name, inc);
          }
        }
        
        // Sort mods in the correct order: Database -> Official -> Super -> User
        const sortedMods = Array.from(existingByName.values()).sort((a, b) => {
          const getModOrder = (modName) => {
            if (modName.startsWith('database/')) return 0;
            if (modName.startsWith('Official Mods/')) return 1;
            if (modName.startsWith('Super Mods/')) return 2;
            if (modName.startsWith('User Mods/')) return 3;
            return 4; // Unknown mods go last
          };
          
          const orderA = getModOrder(a.name);
          const orderB = getModOrder(b.name);
          
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          
          // Within the same category, maintain alphabetical order
          return a.name.localeCompare(b.name);
        });
        
        window.localMods = sortedMods;
        
        console.log('Local mods merged and sorted with stored states:', window.localMods.map(m => `${m.name}: ${m.enabled}`));
        console.log('Manual mods in merged data:', 
          window.localMods.filter(m => m.type === 'manual').map(m => ({ name: m.name, type: m.type, hasContent: !!m.content })));
        
        // Execute all enabled mods from stored states in correct order
        const enabledMods = window.localMods.filter(mod => mod.enabled);
        console.log(`[Local Mods] Found ${enabledMods.length} enabled mods, isBatchExecuting: ${isBatchExecuting}`);
        if (enabledMods.length > 0 && !isBatchExecuting) {
          console.log(`Executing ${enabledMods.length} enabled mods in correct order:`);
          console.log('Loading order: Database -> Official -> Super -> User');
          enabledMods.forEach((mod, index) => {
            const category = mod.name.startsWith('database/') ? 'Database' :
                           mod.name.startsWith('Official Mods/') ? 'Official' :
                           mod.name.startsWith('Super Mods/') ? 'Super' :
                           mod.name.startsWith('User Mods/') ? 'User' : 'Unknown';
            console.log(`  ${index + 1}. [${category}] ${mod.name}`);
          });
          console.log('[Local Mods] Calling executeModsInOrder...');
          executeModsInOrder(enabledMods);
        } else if (isBatchExecuting) {
          console.log('Skipping execution - batch execution already in progress');
        } else {
          console.log('No enabled mods found in stored states');
        }
      }
    }
    
    if (event.data.message && event.data.message.action === 'executeLocalMod') {
      const modName = event.data.message.name;
      const force = !!event.data.message.force;
      console.log(`Received request to execute local mod: ${modName} (force: ${force})`);
      
      // Skip if we're in batch execution mode to prevent duplicates
      if (isBatchExecuting && !force) {
        console.log(`Skipping individual execution of ${modName} - batch execution in progress`);
        return;
      }
      
      // If this is a force execution, allow it
      if (force) {
        executeLocalMod(modName, force).catch(err => {
          console.error(`Error executing local mod ${modName} on request:`, err);
        });
        return;
      }
      
      // For normal execution, check if we should use batch execution instead
      const enabledMods = window.localMods.filter(mod => mod.enabled);
      if (enabledMods.length > 1 && !isBatchExecuting) {
        console.log(`Received individual execution request for ${modName}, but using batch execution for all ${enabledMods.length} enabled mods`);
        executeModsInOrder(enabledMods);
      } else {
        executeLocalMod(modName, force).catch(err => {
          console.error(`Error executing local mod ${modName} on request:`, err);
        });
      }
    }
    
    if (event.data.message && event.data.message.action === 'updateLocalModState') {
      const modName = event.data.message.name;
      const enabled = event.data.message.enabled;
      console.log(`Updating local mod state: ${modName} -> ${enabled}`);
      
      // Find the mod in our local list and update its state
      const modIndex = window.localMods.findIndex(mod => mod.name === modName);
      if (modIndex !== -1) {
        window.localMods[modIndex].enabled = enabled;
        console.log(`Updated local mod state for ${modName} to ${enabled}`);
        
        // If mod was disabled, no action needed
        // If mod was enabled, we should execute it if not already executed
        if (enabled && !executedMods[modName]) {
          console.log(`Auto-executing newly enabled mod: ${modName}`);
          executeLocalMod(modName).catch(error => {
            console.error(`Error auto-executing mod ${modName}:`, error);
          });
        }
      } else {
        console.error(`Cannot update state: mod ${modName} not found in local mods list`);
      }
    }
    
    if (event.data.response && event.data.id && event.data.id.startsWith('mod_msg_')) {
      console.log('Received response for mod message:', event.data);
      // Here we could process the response from getLocalModConfig
    }
    

  }
});

// Notify of API availability
console.log('LocalModsAPI has been attached to window:', !!window.localModsAPI);

// Initialization - now we wait for modBaseUrl before initializing
console.log('Local Mods Loader setup, waiting for mod base URL...');

console.log('Local Mods Loader setup complete');

