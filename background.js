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
try {
  if (typeof BestiaryExtensionUrl === 'undefined' && typeof importScripts === 'function') {
    importScripts('content/extension-url.js');
  }
} catch (error) {
  console.error('Background: Failed to load extension-url.js:', error);
}

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

const LOADER_ERROR_STORAGE_KEY = 'ba-loader-errors';
const MAX_LOADER_ERRORS = 200;

function appendBackgroundLoaderError(entry) {
  if (!browserAPI?.storage?.local) return;
  if ((entry.level || 'error') !== 'error') return;
  const fullEntry = {
    ts: Date.now(),
    level: entry.level || 'error',
    source: entry.source || 'background',
    message: entry.message || '',
    detail: entry.detail || undefined
  };
  browserAPI.storage.local.get([LOADER_ERROR_STORAGE_KEY], (result) => {
    const existing = Array.isArray(result[LOADER_ERROR_STORAGE_KEY]) ? result[LOADER_ERROR_STORAGE_KEY] : [];
    existing.push(fullEntry);
    browserAPI.storage.local.set({ [LOADER_ERROR_STORAGE_KEY]: existing.slice(-MAX_LOADER_ERRORS) });
  });
}

const originalBackgroundError = console.error;
console.error = function(...args) {
  originalBackgroundError.apply(console, args);
  appendBackgroundLoaderError({
    level: 'error',
    message: args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ')
  });
};

function resolveMessageTabId(message, sender) {
  if (message && message.tabId != null) return message.tabId;
  if (sender && sender.tab && sender.tab.id != null) return sender.tab.id;
  return null;
}

function sendMessageToResolvedTab(message, sender, payload) {
  const tabId = resolveMessageTabId(message, sender);
  if (tabId == null) {
    console.warn('[Background] No tab context for tabs.sendMessage:', payload?.action);
    return false;
  }
  browserAPI.tabs.sendMessage(tabId, payload);
  return true;
}

/** Push remote scripts + stored local mod states to a tab (once per page load). */
function deliverModLoaderToTab(tabId, enabledScripts) {
  if (registeredTabs.has(tabId)) {
    console.log(`Tab ${tabId} already received mod loader payload, skipping duplicate delivery`);
    return Promise.resolve(false);
  }

  return getLocalMods().then((mods) => {
    browserAPI.tabs.sendMessage(tabId, {
      action: 'loadScripts',
      scripts: enabledScripts
    });

    browserAPI.tabs.sendMessage(tabId, {
      action: 'registerLocalMods',
      mods
    });

    registeredTabs.add(tabId);
    console.log(`Delivered mod loader payload to tab ${tabId}:`, {
      remoteScripts: enabledScripts.length,
      localMods: mods.length
    });
    return true;
  });
}

const GITHUB_OPTIONAL_ORIGINS = [
  '*://*.gist.githubusercontent.com/*',
  '*://gist.githubusercontent.com/*',
  '*://*.raw.githubusercontent.com/*',
  '*://raw.githubusercontent.com/*'
];

async function hasGitHubHostAccess() {
  if (!browserAPI || !browserAPI.permissions) {
    return true;
  }
  try {
    return await browserAPI.permissions.contains({ origins: GITHUB_OPTIONAL_ORIGINS });
  } catch (error) {
    console.error('Error checking GitHub host permissions:', error);
    return false;
  }
}

async function requestGitHubHostAccess() {
  if (!browserAPI || !browserAPI.permissions) {
    return true;
  }
  if (await hasGitHubHostAccess()) {
    return true;
  }
  try {
    return await browserAPI.permissions.request({ origins: GITHUB_OPTIONAL_ORIGINS });
  } catch (error) {
    console.error('Error requesting GitHub host permissions:', error);
    return false;
  }
}

/** Extension resource path for a bundled mod (database/* or mods/*). */
function resolveModResourcePath(modName) {
  if (typeof BestiaryExtensionUrl !== 'undefined' && BestiaryExtensionUrl.resolveBundledModPath) {
    return BestiaryExtensionUrl.resolveBundledModPath(modName);
  }
  if (!modName || typeof modName !== 'string') {
    throw new Error('Invalid mod name');
  }
  const filesystemPath = String(modName)
    .replace(/^Official Mods\//, 'Official_Mods/')
    .replace(/^Super Mods\//, 'Super_Mods/')
    .replace(/^OT Mods\//, 'OT_Mods/');
  if (filesystemPath.startsWith('database/') || filesystemPath.startsWith('mods/')) {
    return filesystemPath;
  }
  return `mods/${filesystemPath}`;
}

function isServiceWorkerContext() {
  try {
    return typeof ServiceWorkerGlobalScope !== 'undefined' &&
      typeof self !== 'undefined' &&
      self instanceof ServiceWorkerGlobalScope;
  } catch {
    return false;
  }
}

// Keep in sync with content/mod-registry.js
const HARDCODED_DEFAULT_ENABLED_MODS = [
  'database/Welcome.js',
  'database/inventory-database.js',
  'database/creature-database.js',
  'database/equipment-database.js',
  'database/maps-database.js',
  'database/equipment-lua-export.js',
  'database/creature-lua-export.js',
  'database/playereq-database.js',
  'database/firebase-admins.js',
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

const HARDCODED_MOD_COUNTS = {
  database: 9,
  official: 11,
  super: 26,
  ot: 4
};

async function loadDefaultEnabledMods() {
  if (!isServiceWorkerContext()) {
    try {
      const registryUrl = getAssetUrl('content/mod-registry.js');
      const registry = await import(registryUrl);
      if (registry?.DEFAULT_ENABLED_MODS) {
        return registry.DEFAULT_ENABLED_MODS;
      }
    } catch (error) {
      console.warn('[Background] Could not import mod-registry.js, using hardcoded defaults:', error);
    }
  }
  return HARDCODED_DEFAULT_ENABLED_MODS;
}

const REGISTRY_MOD_ARRAYS = [
  { exportName: 'DATABASE_MODS', prefix: 'database/' },
  { exportName: 'OFFICIAL_MODS', prefix: 'Official Mods/' },
  { exportName: 'SUPER_MODS', prefix: 'Super Mods/' },
  { exportName: 'OT_MODS', prefix: 'OT Mods/' }
];

function parseModNamesFromRegistrySource(source) {
  const paths = [];
  for (const { exportName, prefix } of REGISTRY_MOD_ARRAYS) {
    const match = source.match(new RegExp(`export const ${exportName} = \\[([\\s\\S]*?)\\];`));
    if (!match) continue;
    for (const item of match[1].matchAll(/'((?:\\'|[^'])*)'/g)) {
      paths.push(`${prefix}${item[1].replace(/\\'/g, "'")}`);
    }
  }
  return paths;
}

async function loadBundledModPathsFromRegistry() {
  if (!isServiceWorkerContext()) {
    try {
      const registryUrl = getAssetUrl('content/mod-registry.js');
      const registry = await import(registryUrl);
      if (registry?.getAllMods) {
        return registry.getAllMods();
      }
    } catch (error) {
      console.warn('[Background] Could not import mod-registry.js for bundled mod list:', error);
    }
  }

  try {
    const registryUrl = getAssetUrl('content/mod-registry.js');
    const response = await fetch(registryUrl);
    if (!response.ok) return null;
    const paths = parseModNamesFromRegistrySource(await response.text());
    return paths.length > 0 ? paths : null;
  } catch (error) {
    console.warn('[Background] Could not read mod-registry.js for bundled mod list:', error);
    return null;
  }
}

function buildBundledModEntry(modPath, defaultEnabledMods) {
  const fileName = modPath.split('/').pop();
  return {
    name: modPath,
    displayName: fileName.replace('.js', '').replace(/_/g, ' '),
    isLocal: true,
    enabled: defaultEnabledMods.includes(modPath),
    type: 'file'
  };
}

async function mergeMissingBundledMods(storedMods) {
  const bundledPaths = await loadBundledModPathsFromRegistry();
  if (!bundledPaths?.length) return storedMods;

  const defaultEnabledMods = await loadDefaultEnabledMods();
  const byName = new Map(storedMods.map((mod) => [mod.name, mod]));
  let changed = false;

  for (const modPath of bundledPaths) {
    if (!byName.has(modPath)) {
      byName.set(modPath, buildBundledModEntry(modPath, defaultEnabledMods));
      changed = true;
    }
  }

  if (!changed) return storedMods;

  const merged = Array.from(byName.values());
  await browserAPI.storage.sync.set({ localMods: merged });
  await browserAPI.storage.local.set({ localMods: merged });
  console.log('[Background] Merged missing bundled mods from mod-registry into storage');
  return merged;
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
    
    if (!await hasGitHubHostAccess()) {
      const cached = await browserAPI.storage.local.get(`script_${source}`);
      if (cached[`script_${source}`]) {
        scriptCache[source] = cached[`script_${source}`];
        return cached[`script_${source}`];
      }
      throw new Error('GitHub host access not granted. Open the extension popup to allow remote mod downloads.');
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
    
    // Add bundled mods from mod-registry that are not yet in storage (e.g. after an extension update).
    mods = await mergeMissingBundledMods(mods);

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

    if (!await hasGitHubHostAccess()) {
      const data = await browserAPI.storage.local.get(['utility_script_cache']);
      if (data.utility_script_cache) {
        return data.utility_script_cache;
      }
      throw new Error('GitHub host access not granted. Open the extension popup to allow utility script downloads.');
    }
    
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
console.log('Background context:', isServiceWorkerContext() ? 'MV3 service worker' : 'persistent background page');
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
    return false;
  }

  if (message.action === 'requestGitHubHostAccess') {
    requestGitHubHostAccess()
      .then(granted => sendResponse({ success: granted, granted }))
      .catch(error => sendResponse({ success: false, error: error.message }));
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
        const minimalFallback = ['database/Welcome.js'];
        
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
    sendMessageToResolvedTab(message, sender, {
      action: 'executeLocalMod',
      name: message.name
    });
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'getModContent') {
    const resourcePath = resolveModResourcePath(message.modName);
    const getURL = browserAPI.runtime.getURL.bind(browserAPI.runtime);
    const modUrl = BestiaryExtensionUrl?.getExtensionResourceUrl?.(getURL, resourcePath)
      || getURL(resourcePath);
    console.log(`Background: Fetching mod content from: ${modUrl}`);

    const deliverContent = (content) => {
      console.log(`Background: Successfully loaded mod content, length: ${content.length} bytes`);
      sendResponse({ success: true, content });
    };

    const deliverError = (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Background: Error fetching mod content:`, errorMessage);
      appendBackgroundLoaderError({
        level: 'error',
        source: 'getModContent',
        message: `Failed to fetch ${message.modName}`,
        detail: `${errorMessage} (${modUrl})`
      });
      sendResponse({ success: false, error: errorMessage, url: modUrl });
    };

    try {
      if (BestiaryExtensionUrl?.fetchExtensionResourceText) {
        BestiaryExtensionUrl.fetchExtensionResourceText(getURL, resourcePath)
          .then(deliverContent)
          .catch(deliverError);
      } else {
        fetch(modUrl)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
          })
          .then(deliverContent)
          .catch(deliverError);
      }
    } catch (error) {
      deliverError(error);
    }
    return true;
  }

  if (message.action === 'executeScript') {
    const tabId = resolveMessageTabId(message, sender);
    const deliverScript = async (targetTabId) => {
      if (targetTabId == null) {
        sendResponse({ success: false, error: 'No target tab found' });
        return;
      }
      try {
        const scriptContent = await getScript(message.hash);
        if (!scriptContent) {
          sendResponse({ success: false, error: 'Script content not found' });
          return;
        }

        const scripts = await getActiveScripts();
        const script = scripts.find(s => s.hash === message.hash);

        if (!script) {
          sendResponse({ success: false, error: 'Script not found in active scripts' });
          return;
        }

        browserAPI.tabs.sendMessage(targetTabId, {
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
    };

    if (tabId != null) {
      deliverScript(tabId);
    } else {
      sendResponse({ success: false, error: 'No target tab found' });
    }
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
      const requestAutosellerConfig = (targetTabId) => {
        if (targetTabId == null) {
          sendResponse({ success: true, config: {} });
          return;
        }
        browserAPI.tabs.sendMessage(targetTabId, {
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
      };

      const tabId = resolveMessageTabId(message, sender);
      requestAutosellerConfig(tabId);
      return true; // Keep the message channel open for async response
    } else if (message.modName === 'Official Mods/Turbo Mode.js') {
      browserAPI.storage.local.get('localModsConfig', (data) => {
        const configs = data.localModsConfig || {};
        const config = configs[message.modName] || {};
        const legacy = configs['DOM_Turbo_with_ticks.js'] || {};
        const merged = { ...legacy, ...config };
        if (legacy.speedupFactor !== undefined && config.speedupFactor === undefined) {
          configs[message.modName] = merged;
          browserAPI.storage.local.set({ localModsConfig: configs });
        }
        sendResponse({ success: true, config: merged });
      });
      return true;
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

  if (message.action === 'gameLocalStorageResponse') {
    sendResponse({ success: true });
    return false;
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
              sendMessageToResolvedTab(message, sender, {
                action: 'updateLocalModState',
                name: message.name,
                enabled: message.enabled
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
              
              sendMessageToResolvedTab(message, sender, {
                action: 'updateLocalModState',
                name: message.name,
                enabled: message.enabled
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

    getActiveScripts().then((scripts) => {
      const enabledScripts = scripts.filter((s) => s.enabled);
      deliverModLoaderToTab(sender.tab.id, enabledScripts);
    });

    sendResponse({ success: true });
    return false;
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
    return false;
  }

  if (message.action === 'utilityFunctionsLoaded') {
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'getModCounts') {
    if (!isServiceWorkerContext()) {
      (async () => {
        try {
          const registryUrl = getAssetUrl('content/mod-registry.js');
          const registry = await import(registryUrl);
          if (registry?.getModCounts) {
            sendResponse({ success: true, counts: registry.getModCounts() });
            return;
          }
        } catch (error) {
          console.warn('[Background] Could not import mod-registry.js for counts:', error);
        }
        sendResponse({ success: true, counts: HARDCODED_MOD_COUNTS });
      })();
      return true;
    }

    sendResponse({ success: true, counts: HARDCODED_MOD_COUNTS });
    return false;
  }

  if (message.action === 'getLoaderErrors') {
    browserAPI.storage.local.get([LOADER_ERROR_STORAGE_KEY], (result) => {
      sendResponse({
        success: true,
        errors: Array.isArray(result[LOADER_ERROR_STORAGE_KEY]) ? result[LOADER_ERROR_STORAGE_KEY] : []
      });
    });
    return true;
  }

  if (message.action === 'clearLoaderErrors') {
    browserAPI.storage.local.set({ [LOADER_ERROR_STORAGE_KEY]: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Clean up registered tabs when they're closed
browserAPI.tabs.onRemoved.addListener((tabId) => {
  registeredTabs.delete(tabId);
});

// Mirrors content_scripts exclude_matches in manifest.json — when a URL is excluded,
// no content script runs, so checkAPI fails and this listener would otherwise inject
// injector.js via scripting.executeScript and bypass the exclusion.
const BESTIARY_MOD_INJECTION_EXCLUDE_PATTERNS = (() => {
  try {
    const patterns = new Set();
    for (const entry of browserAPI.runtime.getManifest().content_scripts || []) {
      for (const pattern of entry.exclude_matches || []) {
        patterns.add(pattern);
      }
    }
    return [...patterns];
  } catch {
    return [];
  }
})();

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function urlMatchesChromeMatchPattern(url, pattern) {
  const match = pattern.match(/^(\*|https?|file|ftp):\/\/([^/]+)(\/.*)$/);
  if (!match) return false;

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }

  const [, schemePattern, hostPattern, pathPattern] = match;
  const scheme = parsedUrl.protocol.replace(':', '');

  if (schemePattern !== '*') {
    if (schemePattern !== scheme) return false;
  } else if (!['http', 'https', 'file', 'ftp'].includes(scheme)) {
    return false;
  }

  let hostRegex;
  if (hostPattern === '*') {
    hostRegex = /^.*$/;
  } else if (hostPattern.startsWith('*.')) {
    const suffix = escapeRegExp(hostPattern.slice(2));
    hostRegex = new RegExp(`^(.+\\.)?${suffix}$`);
  } else {
    hostRegex = new RegExp(`^${escapeRegExp(hostPattern)}$`);
  }
  if (!hostRegex.test(parsedUrl.hostname)) return false;

  const pathRegex = new RegExp(`^${pathPattern.split('*').map(escapeRegExp).join('.*')}$`);
  return pathRegex.test(parsedUrl.pathname);
}

function isBestiaryExcludedFromModInjectionUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    if (!hostname.endsWith('bestiaryarena.com')) return false;
    return BESTIARY_MOD_INJECTION_EXCLUDE_PATTERNS.some(
      (pattern) => urlMatchesChromeMatchPattern(url, pattern)
    );
  } catch {
    return false;
  }
}

browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.match(/bestiaryarena\.com/) && !isBestiaryExcludedFromModInjectionUrl(tab.url)) {
    if (changeInfo.status === 'loading') {
      registeredTabs.delete(tabId);
      return;
    }
  }

  if (changeInfo.status === 'complete' && tab.url && tab.url.match(/bestiaryarena\.com/)) {
    if (isBestiaryExcludedFromModInjectionUrl(tab.url)) {
      return;
    }
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
                  console.log(`Sending ${enabledScripts.length} active scripts to tab ${tabId}`);
                  deliverModLoaderToTab(tabId, enabledScripts);
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
                    console.log(`Sending ${enabledScripts.length} active scripts to tab ${tabId}`);
                    deliverModLoaderToTab(tabId, enabledScripts);
                  }, 1000);
                } else {
                  console.error("Failed to initialize via messaging:", browserAPI.runtime.lastError);
                }
              });
            }
          } else {
            console.log('Content script already functioning; waiting for contentScriptReady to deliver mods');
          }
        });
      }, 500);
    });
  }
});

// Helper to get asset URL in extension context
function getAssetUrl(path) {
  if (browserAPI && browserAPI.runtime && typeof browserAPI.runtime.getURL === 'function') {
    return BestiaryExtensionUrl.getExtensionResourceUrl(
      browserAPI.runtime.getURL.bind(browserAPI.runtime),
      path
    );
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