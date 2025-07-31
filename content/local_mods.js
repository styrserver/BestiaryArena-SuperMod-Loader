// Polyfill for Chrome and Firefox WebExtensions
if (typeof window.browser === 'undefined') {
  window.browser = window.chrome;
}

window.browserAPI = window.browserAPI || (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

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
    if (typeof browser !== 'undefined') {
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
    if (typeof browser !== 'undefined') {
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

async function listAllModFiles() {
  // Only include .js files from Official Mods and Super Mods
  // User-generated scripts are handled separately via localStorage
  try {
    // If you have a dynamic index, update this logic accordingly
    const databaseMods = [
      'database/inventory-tooltips.js'
    ];
    const officialMods = [
      'Official Mods/Board Analyzer.js',
      'Official Mods/Bestiary_Automator.js',
      'Official Mods/Custom_Display.js',
      'Official Mods/Hero_Editor.js',
      'Official Mods/Highscore_Improvements.js',
      'Official Mods/Item_tier_list.js',
      'Official Mods/Monster_tier_list.js',
      'Official Mods/Setup_Manager.js',
      'Official Mods/Team_Copier.js',
      'Official Mods/Tick_Tracker.js',
      'Official Mods/Turbo Mode.js'
    ];
    const superMods = [
      'Super Mods/Autoseller.js',
      'Super Mods/Autoscroller.js',
      'Super Mods/Better_Hygenie.js',
      'Super Mods/Cauldron Upgrade.js',
      'Super Mods/Cyclopedia.js',
      'Super Mods/DashboardButton.js',
      'Super Mods/Dice_Roller.js',
      'Super Mods/Hunt Analyzer.js'
    ];
    return [...databaseMods, ...officialMods, ...superMods];
  } catch (e) {
    // fallback: hardcoded list
    return [
      'database/inventory-tooltips.js',
      'Official Mods/Board Analyzer.js',
      'Official Mods/Bestiary_Automator.js',
      'Official Mods/Custom_Display.js',
      'Official Mods/Hero_Editor.js',
      'Official Mods/Highscore_Improvements.js',
      'Official Mods/Item_tier_list.js',
      'Official Mods/Monster_tier_list.js',
      'Official Mods/Setup_Manager.js',
      'Official Mods/Team_Copier.js',
      'Official Mods/Tick_Tracker.js',
      'Official Mods/Turbo Mode.js',
      'Super Mods/Autoseller.js',
      'Super Mods/Autoscroller.js',
      'Super Mods/Better_Hygenie.js',
      'Super Mods/Cauldron Upgrade.js',
      'Super Mods/Cyclopedia.js',
      'Super Mods/DashboardButton.js',
      'Super Mods/Dice_Roller.js',
      'Super Mods/Hunt Analyzer.js'
    ];
  }
}

// List of mods to enable by default
const defaultEnabledMods = [
  'database/inventory-tooltips.js',
  'Official Mods/Bestiary_Automator.js',
  'Official Mods/Board Analyzer.js',
  'Official Mods/Hero_Editor.js',
  'Official Mods/Highscore_Improvements.js',
  'Official Mods/Item_tier_list.js',
  'Official Mods/Monster_tier_list.js',
  'Official Mods/Setup_Manager.js',
  'Official Mods/Team_Copier.js',
  'Official Mods/Tick_Tracker.js',
  'Official Mods/Turbo Mode.js'
  // All other super mods enabled by default, so no need to list them
];

// Key for localStorage user-generated scripts
const MANUAL_MODS_KEY = 'manualMods';

// Helper function to get user-generated scripts from localStorage
async function getManualMods() {
  return new Promise(resolve => {
    if (!window.browserAPI || !window.browserAPI.storage || !window.browserAPI.storage.local) {
      // Fallback to localStorage if browserAPI not available
      try {
        const stored = localStorage.getItem(MANUAL_MODS_KEY);
        resolve(stored ? JSON.parse(stored) : []);
      } catch (e) {
        console.warn('Error reading manual mods from localStorage:', e);
        resolve([]);
      }
      return;
    }
    
    window.browserAPI.storage.local.get([MANUAL_MODS_KEY], result => {
      resolve(result[MANUAL_MODS_KEY] || []);
    });
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
      let validMods = [];
      
      // Process file-based mods (Official and Super Mods)
      for (const file of modFiles) {
        console.log(`Checking mod file: ${file}`);
        const exists = await checkFileExists(file);
        console.log(`File ${file} exists: ${exists}`);
        if (exists) {
          // Enable only if in defaultEnabledMods or if it's a Super Mod or Database Mod
          const isSuperMod = file.startsWith('Super Mods/');
          const isDatabaseMod = file.startsWith('database/');
          const enabled = defaultEnabledMods.includes(file) || isSuperMod || isDatabaseMod;
          console.log(`Mod ${file} enabled: ${enabled} (isSuperMod: ${isSuperMod}, isDatabaseMod: ${isDatabaseMod})`);
          validMods.push({
            name: file,
            key: file.replace('.js','').replace(/_/g,' '),
            enabled: enabled,
            type: 'file'
          });
        }
      }
      
      // Process user-generated scripts from localStorage
      const manualMods = await getManualMods();
      console.log(`Found ${manualMods.length} user-generated scripts in localStorage`);
      
      manualMods.forEach((manualMod, index) => {
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
      
      // Register mods with the extension
      window.postMessage({
        from: 'BESTIARY_CLIENT',
        message: {
          action: 'registerLocalMods',
          mods: window.localMods
        }
      }, '*');
      
      return window.localMods;
    } finally {
      isInitializing = false;
    }
  })();
  
  return initializationPromise;
}

// Optimized execution function with better error handling and deduplication
async function executeLocalMod(modName, forceExecution = false) {
  console.log(`=== EXECUTE LOCAL MOD START: ${modName} ===`);
  console.log(`Force execution: ${forceExecution}`);
  console.log(`Executed mods:`, Object.keys(executedMods));
  console.log(`Local mods available:`, window.localMods ? window.localMods.map(m => m.name) : 'undefined');
  
  // If already executed, log and exit (but allow a forced re-execution if needed)
  if (executedMods[modName] && !forceExecution) {
    console.log(`Local mod ${modName} was already executed, skipping`);
    return executedMods[modName];
  }

  // Check if the mod is enabled before execution
  const mod = window.localMods.find(m => m.name === modName);
  if (!mod) {
    console.error(`Cannot execute mod ${modName}: mod not found in local mods list`);
    console.log(`Available mods:`, window.localMods);
    return null;
  }
  
  console.log(`Found mod:`, mod);
  
  if (!mod.enabled && !forceExecution) {
    console.log(`Skipping disabled mod: ${modName}`);
    return null;
  }

  console.log(`Executing local mod: ${modName}`);
  
  let content = null;
  
  // Check if this is a user-generated script (manual mod)
  if (mod && mod.type === 'manual' && mod.content) {
    // Use the content directly from the mod object
    content = mod.content;
    console.log(`Using stored content for user-generated mod: ${modName}`);
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
          executeLocalMod(modName, forceExecution);
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
              api: window.BestiaryModAPI
            };
            
            console.log(`Preparing to execute mod: ${modName}`);
            const scriptFunction = new Function('context', `
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
        api: window.BestiaryModAPI
      };
      
      console.log(`Preparing to execute mod: ${modName}`);
      const scriptFunction = new Function('context', `
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
  console.log(`Executing ${mods.length} mods in order...`);
  
  const results = [];
  for (const mod of mods) {
    if (mod.enabled || forceExecution) {
      try {
        const result = await executeLocalMod(mod.name, forceExecution);
        results.push({ mod: mod.name, success: !!result, result });
      } catch (error) {
        console.error(`Failed to execute mod ${mod.name}:`, error);
        results.push({ mod: mod.name, success: false, error: error.message });
      }
    }
  }
  
  console.log(`Batch execution completed. Results:`, results);
  return results;
}

// Generate unique ID for messages
let messageIdCounter = 0;
function generateMessageId() {
  return `mod_msg_${Date.now()}_${messageIdCounter++}`;
}

document.addEventListener('reloadLocalMods', () => {
  console.log('Received reloadLocalMods event, reinitializing...');
  window.localMods = [];
  executedMods = {};
  initializationPromise = null; // Reset initialization promise
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
        // Store the previous mods for reference
        const previousMods = [...window.localMods];
        
        // Update with new mods
        window.localMods = event.data.message.mods;
        console.log('Local mods updated from extension:', 
          window.localMods.map(m => `${m.name}: ${m.enabled}`));
        
        // OPTIMIZATION: Execute mods in proper order instead of forEach
        const enabledMods = window.localMods.filter(mod => mod.enabled);
        const newlyEnabledMods = enabledMods.filter(mod => {
          const wasEnabledBefore = previousMods.find(m => m.name === mod.name && m.enabled);
          const wasExecutedBefore = !!executedMods[mod.name];
          return !wasExecutedBefore || !wasEnabledBefore;
        });
        
        if (newlyEnabledMods.length > 0) {
          console.log(`Auto-executing ${newlyEnabledMods.length} newly enabled mods in order`);
          console.log(`Mods to execute:`, newlyEnabledMods.map(m => m.name));
          executeModsInOrder(newlyEnabledMods);
        }
      }
    }
    
    if (event.data.message && event.data.message.action === 'executeLocalMod') {
      const modName = event.data.message.name;
      const force = !!event.data.message.force;
      console.log(`Received request to execute local mod: ${modName} (force: ${force})`);
      executeLocalMod(modName, force).catch(err => {
        console.error(`Error executing local mod ${modName} on request:`, err);
      });
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

