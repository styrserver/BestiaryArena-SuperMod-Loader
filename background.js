/**
 * BestiaryArena SuperMod Loader - background.js
 * 
 * Supports loading mods from:
 * - base64: Inline base64-encoded scripts
 * - URL: Direct HTTP(S) links
 * - GitHub: owner/repo/branch/path
 * - Gist: Gist hash
 * 
 * SECURITY WARNING:
 * - Remote and dynamic scripts are potentially dangerous.
 * - All scripts are fetched and executed in the extension context.
 * - Users should only load mods from trusted sources.
 * 
 * See documentation below for each function.
 */
// Polyfill for browser API (Firefox/Chromium separation)
const browserAPI = (function() {
  if (typeof browser !== 'undefined') {
    return browser;
  } else if (typeof chrome !== 'undefined') {
    return chrome;
  } else {
    console.error('No browser API available');
    return null;
  }
})();

const scriptCache = {};

let localMods = [];
let registeredTabs = new Set(); // Track which tabs have received local mods

const DEBUG = false; // Set to true for development

// Function to load default enabled mods from mod-registry.js
async function loadDefaultEnabledMods() {
  try {
    // Try dynamic import for Firefox
    if (typeof browser !== 'undefined') {
      console.log('[Background] Loading default enabled mods from registry (Firefox)');
      const registryUrl = browserAPI.runtime.getURL('content/mod-registry.js');
      const registry = await import(registryUrl);
      
      if (registry && registry.DEFAULT_ENABLED_MODS) {
        console.log('[Background] Successfully loaded default enabled mods from registry:', registry.DEFAULT_ENABLED_MODS);
        return registry.DEFAULT_ENABLED_MODS;
      }
    }
    
    // Chrome fallback: Use hardcoded list since Chrome service workers can't use dynamic import
    console.log('[Background] Using hardcoded default enabled mods (Chrome limitation)');
    return [
      'database/inventory-database.js',
      'database/creature-database.js',
      'database/equipment-database.js',
      'database/maps-database.js',
      'database/playereq-database.js',
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
      'Super Mods/Mod Settings.js',
      'Super Mods/RunTracker.js',
      'Super Mods/Outfiter.js'
    ];
  } catch (error) {
    console.error('[Background] Error loading default enabled mods from registry:', error);
    // Return hardcoded fallback
    return [
      'database/inventory-database.js',
      'database/creature-database.js',
      'database/equipment-database.js',
      'database/maps-database.js',
      'database/playereq-database.js',
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
      'Super Mods/Mod Settings.js',
      'Super Mods/RunTracker.js',
      'Super Mods/Outfiter.js'
    ];
  }
}

// Enhanced function to handle multiple mod sources
function parseModSource(source) {
  // Check if it's a base64 encoded content
  if (source.startsWith('base64:')) {
    return {
      type: 'base64',
      content: source.substring(7)
    };
  }
  
  // Check if it's a direct URL
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return {
      type: 'url',
      url: source
    };
  }
  
  // Check if it's a GitHub raw file path (format: owner/repo/branch/path/to/file)
  if (source.includes('/') && !source.includes('://')) {
    const parts = source.split('/');
    if (parts.length >= 4) {
      const [owner, repo, branch, ...filePath] = parts;
      return {
        type: 'github',
        url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath.join('/')}`
      };
    }
  }
  
  // Default: treat as GitHub Gist hash
  return {
    type: 'gist',
    url: `https://gist.githubusercontent.com/raw/${source}?cache=${Date.now()}`
  };
}

function hashToGistUrl(hash) {
  return `https://gist.githubusercontent.com/raw/${hash}?cache=${Date.now()}`;
}

function isTrustedSource(url) {
  // Only allow githubusercontent.com, gist.githubusercontent.com, or your own domain
  return /^https:\/\/(gist\.githubusercontent\.com|raw\.githubusercontent\.com|yourdomain\.com)\//.test(url);
}

async function fetchScript(source) {
  try {
    const parsedSource = parseModSource(source);
    let url;
    
    switch (parsedSource.type) {
      case 'base64':
        // Decode base64 content
        try {
          const decodedContent = atob(parsedSource.content);
          if (decodedContent.length > 1024 * 1024) {
            throw new Error('Script too large (max 1MB)');
          }
          scriptCache[source] = decodedContent;
          await browserAPI.storage.local.set({ [`script_${source}`]: decodedContent });
          return decodedContent;
        } catch (error) {
          throw new Error('Invalid base64 content');
        }
        
      case 'url':
      case 'github':
      case 'gist':
      default:
        url = parsedSource.url;
        // Security: Validate mod source
        if (!isTrustedSource(url)) {
          if (typeof showModal === 'function') {
            showModal({
              title: 'Security Warning',
              content: 'You are about to load a mod from an external or untrusted source. This can be dangerous. Only proceed if you trust the source.',
              buttons: [{ text: 'OK', onClick: () => {} }]
            });
          }
          if (!DEBUG) return null;
        }
        break;
    }
    
    if (DEBUG) console.log('Fetching script from:', url);
    
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const scriptContent = await response.text();
    
    if (scriptContent.length > 1024 * 1024) {
      throw new Error('Script too large (max 1MB)');
    }
    
    scriptCache[source] = scriptContent;
    await browserAPI.storage.local.set({ [`script_${source}`]: scriptContent });
    
    return scriptContent;
  } catch (error) {
    if (DEBUG) console.error('Error fetching script:', error);
    return null;
  }
}

async function getScript(hash, forceRefresh = false) {
  // If force refresh is true, bypass cache and get from network
  if (forceRefresh) {
    console.log(`Force refreshing script: ${hash}`);
    return await fetchScript(hash);
  }
  
  // Otherwise try memory cache first
  if (scriptCache[hash]) {
    return scriptCache[hash];
  }
  
  // Then try stored cache
  const storedScripts = await browserAPI.storage.local.get(`script_${hash}`);
  if (storedScripts[`script_${hash}`]) {
    scriptCache[hash] = storedScripts[`script_${hash}`];
    return scriptCache[hash];
  }
  
  // Finally fetch from network
  return await fetchScript(hash);
}

async function getActiveScripts() {
  const data = await browserAPI.storage.sync.get('activeScripts');
  return data.activeScripts || [];
}

async function setActiveScripts(activeScripts) {
  await browserAPI.storage.sync.set({ activeScripts });
}

async function getLocalMods() {
  try {
    // Get file-based mods
    let mods = [];
    
    // Check if manual mods exist
    const manualData = await browserAPI.storage.local.get('manualMods');
    const manualMods = manualData.manualMods || [];
    
    // First try to get from sync storage
    const syncData = await browserAPI.storage.sync.get('localMods');
    
    if (syncData.localMods && syncData.localMods.length > 0) {
      // If found in sync, also update local storage
      await browserAPI.storage.local.set({ localMods: syncData.localMods });
      mods = syncData.localMods;
    } else {
      // Fall back to local storage
      const localData = await browserAPI.storage.local.get('localMods');
      mods = localData.localMods || [];
    }
    
    // Convert manual mods to the same format as file-based mods
    const convertedManualMods = manualMods.map(mod => ({
      name: `User Mods/${mod.name}.js`,
      displayName: mod.name,
      isLocal: true,
      enabled: mod.enabled !== false,
      type: 'manual',
      content: mod.content,
      originalName: mod.name
    }));
    
    // Combine file-based mods and manual mods without duplicates,
    // but PREFER the manual mod entry (so its enabled state wins)
    const byName = new Map(mods.map(m => [m.name, m]));
    for (const man of convertedManualMods) {
      byName.set(man.name, man);
    }
    return Array.from(byName.values());
  } catch (error) {
    console.error('Error getting local mods:', error);
    return [];
  }
}

// Hardcoded gist URL for utility functions
const UTILITY_GIST_URL = 'https://gist.githubusercontent.com/mathiasbynens/b9c59bc14fb0d2b52e6945aeee99453f/raw';

// Normalize utility script content to ensure proper execution
function normalizeUtilityScript(scriptContent) {
  if (!scriptContent) return '';
  
  // Remove any existing IIFE wrapping to avoid conflicts
  let script = scriptContent.trim();
  if (script.startsWith('(function(') && script.endsWith('})();')) {
    script = script.slice(script.indexOf('{') + 1, script.lastIndexOf('}'));
  }
  
  // Wrap in try-catch for better error reporting
  return `
    try {
      // Utility functions script from ${UTILITY_GIST_URL}
      ${script}
      
      // Verify required functions are available
      console.log('Utility script loaded, checking functions:', {
        serializeBoard: typeof $serializeBoard === 'function',
        replay: typeof $replay === 'function',
        forceSeed: typeof $forceSeed === 'function'
      });
    } catch (utilityError) {
      console.error('Error in utility script:', utilityError);
    }
  `;
}

// Function to fetch and cache utility script
async function fetchUtilityScript() {
  try {
    console.log('Fetching utility script from:', UTILITY_GIST_URL);
    const cacheParam = `?cache=${Date.now()}`;
    const url = UTILITY_GIST_URL + cacheParam;
    
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch utility gist: ${response.status}`);
    }
    const scriptContent = await response.text();
    
    // Normalize script content
    const normalizedScript = normalizeUtilityScript(scriptContent);
    
    // Store in chrome.storage.local for caching instead of localStorage
    await browserAPI.storage.local.set({
      'utility_script_cache': normalizedScript,
      'utility_script_timestamp': Date.now()
    });
    
    return normalizedScript;
  } catch (error) {
    console.error('Error fetching utility script:', error);
    
    // Try to use cached version if available from storage.local
    const data = await browserAPI.storage.local.get(['utility_script_cache']);
    if (data.utility_script_cache) {
      return data.utility_script_cache;
    }
    
    throw error;
  }
}

// Function to get the utility script (with caching)
async function getUtilityScript(forceRefresh = false) {
  try {
    // Always fetch new if forceRefresh is true
    if (forceRefresh) {
      console.log('Force refreshing utility script');
      return await fetchUtilityScript();
    }
    
    // Get cached data from chrome.storage.local instead of localStorage
    const data = await browserAPI.storage.local.get(['utility_script_cache', 'utility_script_timestamp']);
    const cachedScript = data.utility_script_cache;
    const timestamp = data.utility_script_timestamp;
    const cacheAge = timestamp ? (Date.now() - timestamp) : Infinity;
    
    // Use cache if it's less than 1 day old
    if (cachedScript && cacheAge < 86400000) {
      console.log('Using cached utility script');
      return cachedScript;
    }
    
    console.log('Cache expired or not found, fetching fresh utility script');
    return await fetchUtilityScript();
  } catch (error) {
    console.error('Error getting utility script:', error);
    return await fetchUtilityScript();
  }
}

console.log('Bestiary Arena Mod Loader - Background script initialized');
console.log('Running in:', typeof browser !== 'undefined' ? 'Firefox' : 'Chrome');
console.log('Using browserAPI:', typeof browserAPI);

// Service worker initialization for Chrome
if (typeof self !== 'undefined' && self.addEventListener) {
  self.addEventListener('install', (event) => {
    console.log('Service worker installing...');
    self.skipWaiting();
  });
  
  self.addEventListener('activate', (event) => {
    console.log('Service worker activating...');
    event.waitUntil(self.clients.claim());
  });
}

// Verificando permissões
if (browserAPI && browserAPI.permissions) {
  browserAPI.permissions.getAll().then(perms => {
    console.log('Current permissions:', perms);
  }).catch(error => {
    console.error('Error checking permissions:', error);
  });
}

// Verificando se estamos usando o polyfill correto
try {
  const extensionUrl = browserAPI.runtime.getURL('');
  console.log('Extension base URL:', extensionUrl);
} catch (error) {
  console.error('Error getting extension URL:', error);
}

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle service worker wake-up for Chrome
  if (message.action === 'ping') {
    console.log('Background script pinged, responding...');
    sendResponse({ success: true, timestamp: Date.now() });
    return true;
  }
  
  if (message.action === 'getScript') {
    getScript(message.hash)
      .then(scriptContent => {
        sendResponse({ success: true, scriptContent });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'refreshScript') {
    getScript(message.hash, true)
      .then(scriptContent => {
        sendResponse({ success: true, scriptContent });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'refreshAllScripts') {
    refreshAllScripts()
      .then(enabledScripts => {
        sendResponse({ success: true, scripts: enabledScripts });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'getActiveScripts') {
    getActiveScripts()
      .then(scripts => {
        sendResponse({ success: true, scripts });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'registerScript') {
    // Always force refresh when registering a script to get latest version
    getScript(message.hash, true)
      .then(scriptContent => {
        if (!scriptContent) {
          sendResponse({ 
            success: false, 
            error: 'Failed to fetch script content. Check the Gist hash and your internet connection.' 
          });
          return;
        }
        
        return getActiveScripts()
          .then(scripts => {
            const existingIndex = scripts.findIndex(s => s.hash === message.hash);
            if (existingIndex !== -1) {
              scripts[existingIndex] = { ...scripts[existingIndex], ...message.config };
            } else {
              scripts.push({
                hash: message.hash,
                name: message.name || `Script ${message.hash.substring(0, 8)}`,
                enabled: true,
                config: message.config || {}
              });
            }
            return setActiveScripts(scripts);
          })
          .then(() => {
            sendResponse({ success: true });
          });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'toggleScript') {
    getActiveScripts()
      .then(scripts => {
        const script = scripts.find(s => s.hash === message.hash);
        if (script) {
          script.enabled = message.enabled;
          return setActiveScripts(scripts);
        }
        throw new Error('Script not found');
      })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'updateScriptConfig') {
    getActiveScripts()
      .then(scripts => {
        if (message.hash && message.hash.startsWith('local_')) {
          const localModName = message.hash.replace('local_', '');
          browserAPI.storage.local.get('localModsConfig', (data) => {
            const configs = data.localModsConfig || {};
            configs[localModName] = message.config;
            browserAPI.storage.local.set({ localModsConfig: configs });
            
            sendResponse({ success: true });
          });
          return true;
        }
        
        const script = scripts.find(s => s.hash === message.hash);
        if (script) {
          script.config = { ...script.config, ...message.config };
          return setActiveScripts(scripts);
        }
        throw new Error('Script not found');
      })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'removeScript') {
    getActiveScripts()
      .then(scripts => {
        const newScripts = scripts.filter(s => s.hash !== message.hash);
        return setActiveScripts(newScripts);
      })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.action === 'registerLocalMods') {
    console.log('Background: Registering local mods:', message.mods);
    
    // Get existing mods to preserve enabled states
    getLocalMods().then(existingMods => {
      const newMods = message.mods || [];
      
      // Create a map of existing mod states
      const existingModStates = {};
      existingMods.forEach(mod => {
        existingModStates[mod.name] = mod.enabled;
      });
      
      // Load default enabled mods from mod-registry.js
      loadDefaultEnabledMods().then(defaultEnabledMods => {
        // Process incoming mods, preserving enabled states from existing mods
        localMods = newMods.map(mod => ({
          name: mod.name,
          displayName: mod.displayName || mod.name,
          isLocal: true,
          // If mod existed before, use its previous enabled state, otherwise check if it should be enabled by default
          enabled: existingModStates.hasOwnProperty(mod.name) ? existingModStates[mod.name] : defaultEnabledMods.includes(mod.name),
          // Preserve type and content for manual mods
          type: mod.type,
          content: mod.content,
          originalName: mod.originalName
        }));
        
        console.log('Background: Processed local mods with preserved states:', localMods);
        
        // Save to sync storage first, then to local
        browserAPI.storage.sync.set({ localMods }, () => {
          browserAPI.storage.local.set({ localMods }, () => {
            sendResponse({ success: true, mods: localMods });
          });
        });
      }).catch(error => {
        console.error('Background: Error loading default enabled mods:', error);
        // This should not happen since loadDefaultEnabledMods has its own fallback
        // But just in case, use a minimal fallback
        const minimalFallback = [];
        
        // Process with minimal fallback
        localMods = newMods.map(mod => ({
          name: mod.name,
          displayName: mod.displayName || mod.name,
          isLocal: true,
          enabled: existingModStates.hasOwnProperty(mod.name) ? existingModStates[mod.name] : minimalFallback.includes(mod.name),
          type: mod.type,
          content: mod.content,
          originalName: mod.originalName
        }));
        
        console.log('Background: Processed local mods with minimal fallback:', localMods);
        
        // Save to sync storage first, then to local
        browserAPI.storage.sync.set({ localMods }, () => {
          browserAPI.storage.local.set({ localMods }, () => {
            sendResponse({ success: true, mods: localMods });
          });
        });
      });
    });
    
    return true;
  }

  if (message.action === 'getManualMods') {
    console.log('Background: Getting manual mods');
    
    // Get manual mods from storage
    browserAPI.storage.local.get(['manualMods'], result => {
      const manualMods = result.manualMods || [];
      console.log('Background: Found manual mods:', manualMods.map(m => m.name));
      console.log('Background: Sending response with', manualMods.length, 'mods');
      sendResponse({ success: true, mods: manualMods });
    });
    
    return true; // Keep message channel open for async response
  }

  if (message.action === 'executeLocalMod') {
    browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        browserAPI.tabs.sendMessage(tabs[0].id, {
          action: 'executeLocalMod',
          name: message.name
        });
      }
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'getModContent') {
    try {
      const modUrl = browserAPI.runtime.getURL(message.modName);
      console.log(`Background: Fetching mod content from: ${modUrl}`);
      
      fetch(modUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.text();
        })
        .then(content => {
          console.log(`Background: Successfully loaded mod content, length: ${content.length} bytes`);
          sendResponse({ success: true, content });
        })
        .catch(error => {
          console.error(`Background: Error fetching mod content:`, error);
          sendResponse({ success: false, error: error.message });
        });
    } catch (error) {
      console.error(`Background: Error getting mod URL:`, error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (message.action === 'executeScript') {
    browserAPI.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        try {
          // Obter o conteúdo do script
          const scriptContent = await getScript(message.hash);
          if (!scriptContent) {
            sendResponse({ success: false, error: 'Script content not found' });
            return;
          }
          
          // Obter a configuração do script
          const scripts = await getActiveScripts();
          const script = scripts.find(s => s.hash === message.hash);
          
          if (!script) {
            sendResponse({ success: false, error: 'Script not found in active scripts' });
            return;
          }
          
          // Enviar mensagem para o content script executar o script
          browserAPI.tabs.sendMessage(tabs[0].id, {
            action: 'executeScript',
            hash: message.hash,
            scriptContent: scriptContent,
            config: script.config || {}
          });
          
          sendResponse({ success: true });
        } catch (error) {
          console.error('Error executing script:', error);
          sendResponse({ success: false, error: error.message });
        }
      } else {
        sendResponse({ success: false, error: 'No active tab found' });
      }
    });
    return true;
  }

  if (message.action === 'getLocale') {
    getTranslations()
      .then(({ currentLocale, translations }) => {
        sendResponse({ 
          success: true, 
          locale: currentLocale,
          translations: translations
        });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'setLocale') {
    setLocale(message.locale)
      .then(success => {
        if (success) {
          return getTranslations();
        }
        throw new Error('Failed to set locale');
      })
      .then(({ currentLocale, translations }) => {
        sendResponse({ 
          success: true, 
          locale: currentLocale,
          translations: translations
        });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.action === 'getLocalModConfig') {
    // For mods that use context.config, read from game localStorage instead of extension storage
    // This ensures mods get the actual current settings, not stale defaults
    if (message.modName === 'Super Mods/Autoseller.js') {
      // Request actual localStorage from content script
      browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          browserAPI.tabs.sendMessage(tabs[0].id, {
            action: 'getGameLocalStorage',
            key: 'autoseller-settings'
          }, (response) => {
            if (response && response.success && response.value) {
              try {
                const settings = JSON.parse(response.value);
                sendResponse({ success: true, config: settings });
              } catch (e) {
                sendResponse({ success: true, config: {} });
              }
            } else {
              sendResponse({ success: true, config: {} });
            }
          });
        } else {
          sendResponse({ success: true, config: {} });
        }
      });
      return true; // Keep the message channel open for async response
    } else {
      // For other mods, use the existing extension storage system
      browserAPI.storage.local.get('localModsConfig', (data) => {
        const configs = data.localModsConfig || {};
        const config = configs[message.modName] || {};
        sendResponse({ success: true, config });
      });
      return true;
    }
  }

  // Handle localStorage responses from content script
  if (message.action === 'gameLocalStorageResponse') {
    // This is a response from the content script about localStorage operations
    if (message.success) {
      if (message.value !== undefined) {
        // This is a response for a specific key request (from getLocalModConfig)
        // The response is handled by the Promise in getLocalModConfig
        return true;
      } else {
        console.log('Game localStorage operation successful:', message.data);
      }
    } else {
      console.error('Game localStorage operation failed:', message.error);
    }
    return true;
  }

  if (message.action === 'toggleLocalMod') {
    // Check if this is a manual mod (starts with "User Mods/")
    if (message.name.startsWith('User Mods/')) {
      // Handle manual mod toggle
      browserAPI.storage.local.get('manualMods', (data) => {
        const manualMods = data.manualMods || [];
        const originalName = message.name.replace('User Mods/', '').replace('.js', '');
        const modIndex = manualMods.findIndex(mod => mod.name === originalName);
        
        if (modIndex !== -1) {
          manualMods[modIndex].enabled = message.enabled;
          
          console.log(`Toggling manual mod ${originalName} to ${message.enabled}`);
          
          // Update manual mods in storage and mirror the state in localMods for consistency
          browserAPI.storage.local.set({ manualMods }, () => {
            // Also update any existing entry in localMods caches
            Promise.all([
              browserAPI.storage.local.get('localMods'),
              browserAPI.storage.sync.get('localMods')
            ]).then(([localData, syncData]) => {
              const updateList = (list) => {
                const modsArr = list.localMods || [];
                const idx = modsArr.findIndex(m => m.name === message.name);
                if (idx !== -1) modsArr[idx].enabled = message.enabled;
                return modsArr;
              };
              const updatedLocal = updateList(localData || {});
              const updatedSync = updateList(syncData || {});
              browserAPI.storage.local.set({ localMods: updatedLocal });
              browserAPI.storage.sync.set({ localMods: updatedSync });
            }).finally(() => {
              // Respond to confirm it's done
              sendResponse({ success: true });
              // Notify active tabs about the change
              browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                  browserAPI.tabs.sendMessage(tabs[0].id, {
                    action: 'updateLocalModState',
                    name: message.name,
                    enabled: message.enabled
                  });
                }
              });
            });
          });
        } else {
          sendResponse({ success: false, error: 'Manual mod not found' });
        }
      });
    } else {
      // Handle regular local mod toggle
      browserAPI.storage.local.get('localMods', (data) => {
        const localMods = data.localMods || [];
        const modIndex = localMods.findIndex(mod => mod.name === message.name);
        
        if (modIndex !== -1) {
          localMods[modIndex].enabled = message.enabled;
          
          console.log(`Toggling local mod ${message.name} to ${message.enabled}`);
          
          // First update browser sync storage
          browserAPI.storage.sync.set({ localMods }, () => {
            // Then update local storage
            browserAPI.storage.local.set({ localMods }, () => {
              // Then respond to confirm it's done
              sendResponse({ success: true });
              
              // Finally notify active tabs about the change
              browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                  browserAPI.tabs.sendMessage(tabs[0].id, {
                    action: 'updateLocalModState',
                    name: message.name,
                    enabled: message.enabled
                  });
                }
              });
            });
          });
        } else {
          sendResponse({ success: false, error: 'Local mod not found' });
        }
      });
    }
    return true;
  }

  if (message.action === 'getLocalMods') {
    getLocalMods()
      .then(mods => {
        sendResponse({ success: true, mods });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'contentScriptReady') {
    console.log('Content script reported ready in tab:', sender.tab.id);
    
    // Send active scripts
    getActiveScripts().then(scripts => {
      const enabledScripts = scripts.filter(s => s.enabled);
      
      browserAPI.tabs.sendMessage(sender.tab.id, {
        action: 'loadScripts',
        scripts: enabledScripts
      });
      
      // OPTIMIZATION: Only register local mods, let the content script handle execution
      setTimeout(() => {
        getLocalMods().then(localMods => {
          console.log(`Sending ${localMods.length} local mods to ready tab:`, 
            localMods.map(m => `${m.name}: ${m.enabled}`));
          
          // Send registration message only - content script will handle execution
          browserAPI.tabs.sendMessage(sender.tab.id, {
            action: 'registerLocalMods',
            mods: localMods
          });
          
          // Mark this tab as registered
          registeredTabs.add(sender.tab.id);
        });
      }, 500);
    });
    
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'getUtilityScript') {
    getUtilityScript(message.forceRefresh)
      .then(script => sendResponse({ success: true, script }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicate async response
  }

  if (message.action === 'getVersion') {
    try {
      const manifest = browserAPI.runtime.getManifest();
      sendResponse({ success: true, version: manifest.version });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true; // Indicate async response
  }

  if (message.action === 'getModCounts') {
    // Chrome service workers cannot use import() or new Function()
    // Firefox background scripts CAN use dynamic import
    // So we need different approaches for each browser
    
    (async () => {
      try {
        // Try dynamic import for Firefox
        if (typeof browser !== 'undefined') {
          console.log('[Background] Firefox detected, using dynamic import...');
          const registryUrl = browserAPI.runtime.getURL('content/mod-registry.js');
          const registry = await import(registryUrl);
          
          if (registry && registry.getModCounts) {
            const counts = registry.getModCounts();
            console.log('[Background] Firefox: Got counts from registry:', counts);
            sendResponse({ success: true, counts });
            return;
          }
        }
        
        // Chrome fallback: Use hardcoded counts
        // NOTE: Keep these in sync with content/mod-registry.js
        console.log('[Background] Chrome detected or Firefox import failed, using hardcoded counts');
        const modCounts = {
          database: 5,
          official: 11,
          super: 22
        };
        
        sendResponse({ success: true, counts: modCounts });
      } catch (error) {
        console.error('[Background] Error getting mod counts:', error);
        // Ultimate fallback
        sendResponse({ 
          success: true, 
          counts: { database: 5, official: 11, super: 22 } 
        });
      }
    })();
    return true; // Indicate async response
  }
});

// Clean up registered tabs when they're closed
browserAPI.tabs.onRemoved.addListener((tabId) => {
  registeredTabs.delete(tabId);
});

browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.match(/bestiaryarena\.com/)) {
    console.log(`Tab ${tabId} updated with URL ${tab.url}`);
    
    // First refresh all scripts to get latest versions
    refreshAllScripts().then(enabledScripts => {
      console.log(`Refreshed ${enabledScripts.length} active scripts`);
      
      // Delay slightly to ensure the page has fully loaded
      setTimeout(() => {
        browserAPI.tabs.sendMessage(tabId, { action: 'checkAPI' }, response => {
          if (browserAPI.runtime.lastError) {
            console.log('Content script not functioning, injecting manually:', browserAPI.runtime.lastError);
            
            if (browserAPI.scripting) {
              browserAPI.scripting.executeScript({
                target: { tabId },
                files: ['content/injector.js']
              }).then(() => {
                console.log('Injector script injected via scripting API');
                
                setTimeout(() => {
                  // Use already refreshed scripts
                  console.log(`Sending ${enabledScripts.length} active scripts to tab ${tabId}`);
                  
                  browserAPI.tabs.sendMessage(tabId, {
                    action: 'loadScripts',
                    scripts: enabledScripts
                  });

                  getLocalMods().then(localMods => {
                    console.log(`Found ${localMods.length} local mods`, localMods);
                    
                    // Only register if this tab hasn't been registered yet
                    if (!registeredTabs.has(tabId)) {
                      browserAPI.tabs.sendMessage(tabId, {
                        action: 'registerLocalMods',
                        mods: localMods
                      });
                      
                      // Mark this tab as registered
                      registeredTabs.add(tabId);
                    } else {
                      console.log(`Tab ${tabId} already registered, skipping duplicate registration`);
                    }
                    
                    // OPTIMIZATION: Content script will handle execution automatically
                  });
                }, 1000);
              }).catch(error => {
                console.error("Error injecting injector script:", error);
                console.error("Details:", error.message);
                console.error("Current tab URL:", tab.url);
                console.error("Make sure your extension has permission for this domain in the manifest.json");
                
                // Try using content script messaging instead as fallback
                browserAPI.tabs.sendMessage(tabId, { action: 'initializeModLoader' }, response => {
                  if (!browserAPI.runtime.lastError) {
                    console.log("Successfully initialized mod loader via messaging");
                  } else {
                    console.error("Failed to initialize via messaging:", browserAPI.runtime.lastError);
                  }
                });
              });
            } else {
              // No Firefox, a API scripting pode não estar disponível no Manifest V2
              console.log('scripting API not available, relying on content scripts');
              
              // Tentar usar messaging como fallback
              browserAPI.tabs.sendMessage(tabId, { action: 'initializeModLoader' }, response => {
                if (!browserAPI.runtime.lastError) {
                  console.log("Successfully initialized mod loader via messaging");
                  
                  // Continue com o carregamento normal após inicialização
                  setTimeout(() => {
                    // Use already refreshed scripts
                    console.log(`Sending ${enabledScripts.length} active scripts to tab ${tabId}`);
                    
                    browserAPI.tabs.sendMessage(tabId, {
                      action: 'loadScripts',
                      scripts: enabledScripts
                    });

                    getLocalMods().then(localMods => {
                      console.log(`Found ${localMods.length} local mods`, localMods);
                      
                      browserAPI.tabs.sendMessage(tabId, {
                        action: 'registerLocalMods',
                        mods: localMods
                      });
                      
                      // OPTIMIZATION: Content script will handle execution automatically
                    });
                  }, 1000);
                } else {
                  console.error("Failed to initialize via messaging:", browserAPI.runtime.lastError);
                }
              });
            }
          } else {
            console.log('Content script already functioning, loading scripts');
            
            // Use already refreshed scripts
            browserAPI.tabs.sendMessage(tabId, {
              action: 'loadScripts',
              scripts: enabledScripts
            });

            getLocalMods().then(localMods => {
              console.log(`Found ${localMods.length} local mods with states:`, 
                localMods.map(m => `${m.name}: ${m.enabled}`));
              
              // Send registration message only - content script will handle execution
              browserAPI.tabs.sendMessage(tabId, {
                action: 'registerLocalMods',
                mods: localMods
              });
            });
          }
        });
      }, 500);
    });
  }
});

// Helper to get asset URL in extension context
function getAssetUrl(path) {
  if (browserAPI && browserAPI.runtime && typeof browserAPI.runtime.getURL === 'function') {
    return browserAPI.runtime.getURL(path);
  }
  return path;
}

async function getTranslations() {
  const localeData = await browserAPI.storage.local.get('locale');
  const currentLocale = localeData.locale || 'en-US';
  const translations = {};
  
  // Load all supported locale files
  const locales = ['en-US', 'pt-BR'];
  for (const locale of locales) {
    try {
      const response = await fetch(getAssetUrl(`assets/locales/${locale}.json`));
      if (response.ok) {
        translations[locale] = await response.json();
      }
    } catch (error) {
      console.error(`Error loading ${locale} translations:`, error);
    }
  }
  
  return { currentLocale, translations };
}

async function setLocale(locale) {
  try {
    await browserAPI.storage.local.set({ locale });
    return true;
  } catch (error) {
    console.error('Error setting locale:', error);
    return false;
  }
}

// Force refresh all active scripts from their source
async function refreshAllScripts() {
  console.log('Refreshing all active scripts');
  const scripts = await getActiveScripts();
  
  for (const script of scripts) {
    console.log(`Refreshing script: ${script.hash}`);
    await getScript(script.hash, true);
  }
  
  return scripts.filter(s => s.enabled);
}

// All usages of window.browserAPI replaced with browserAPI
// Removed all DOM-manipulating code below (moved to content/utility_injector.js):
// - removeModalOverlayDarkening
// - patchGlobalModalCreation
// These functions are now in content/utility_injector.js and injected as a content script. 