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
let executionTriggered = false;
let initExecutionFallbackTimer = null;

// Get the base URL for mods from a message from the injector
let modBaseUrl = '';

// Embedded fallback when dynamic import of mod-registry.js fails (e.g. Orion iOS).
// Keep in sync with content/mod-registry.js
const FALLBACK_DATABASE_MODS = [
  'welcome.js', 'inventory-database.js', 'creature-database.js', 'equipment-database.js',
  'maps-database.js', 'equipment-lua-export.js', 'creature-lua-export.js', 'playereq-database.js', 'firebase-admins.js'
];
const FALLBACK_OFFICIAL_MODS = [
  'Bestiary_Automator.js', 'Board Analyzer.js', 'Custom_Display.js', 'Hero_Editor.js',
  'Highscore_Improvements.js', 'Item_tier_list.js', 'Monster_tier_list.js', 'Setup_Manager.js',
  'Team_Copier.js', 'Tick_Tracker.js', 'Turbo Mode.js'
];
const FALLBACK_SUPER_MODS = [
  'Autoseller.js', 'Autoscroller.js', 'Battle_Helper.js', 'Better Analytics.js', 'Better Bestiary.js', 'Better Boosted Maps.js',
  'Better Cauldron.js', 'Better Exaltation Chest.js', 'Better Forge.js', 'Better Highscores.js',
  'Better Hy\'genie.js', 'Better Rune Recycler.js', 'Better Setups.js', 'Better Tasker.js',
  'Better Teleporter.js', 'Better Yasir.js', 'Cyclopedia.js', 'Dice_Roller.js', 'Depot Manager.js', 'Hunt Analyzer.js',
  'Mod Settings.js', 'Outfiter.js', 'Raid_Hunter.js', 'Manual Runner.js',
  'RunTracker.js', 'Stamina Optimizer.js', 'Awaken Tracker.js'
];
const FALLBACK_OT_MODS = ['Challenges.js', 'Quests.js', 'Guilds.js', 'VIP List.js'];
const WELCOME_MOD_PATH = 'database/welcome.js';
const LEGACY_WELCOME_MOD_PATH = 'database/Welcome.js';

function normalizeWelcomeModSavedStates(savedModStates) {
  if (!savedModStates || typeof savedModStates !== 'object') return;
  if (savedModStates[WELCOME_MOD_PATH] === undefined && savedModStates[LEGACY_WELCOME_MOD_PATH] === true) {
    savedModStates[WELCOME_MOD_PATH] = true;
  }
  delete savedModStates[LEGACY_WELCOME_MOD_PATH];
  savedModStates[WELCOME_MOD_PATH] = true;
}

function ensureWelcomeModAlwaysEnabled(mods) {
  if (!Array.isArray(mods)) return;
  for (const mod of mods) {
    if (mod.name === WELCOME_MOD_PATH) {
      mod.enabled = true;
    }
  }
}

const FALLBACK_DEFAULT_ENABLED_MODS = [
  'database/welcome.js', 'database/inventory-database.js', 'database/creature-database.js',
  'database/equipment-database.js', 'database/maps-database.js', 'database/equipment-lua-export.js',
  'database/creature-lua-export.js',
  'database/playereq-database.js', 'database/firebase-admins.js',
  'Official Mods/Bestiary_Automator.js', 'Official Mods/Board Analyzer.js', 'Official Mods/Custom_Display.js',
  'Official Mods/Hero_Editor.js', 'Official Mods/Highscore_Improvements.js', 'Official Mods/Item_tier_list.js',
  'Official Mods/Monster_tier_list.js', 'Official Mods/Setup_Manager.js', 'Official Mods/Team_Copier.js',
  'Official Mods/Tick_Tracker.js', 'Official Mods/Turbo Mode.js',
  'Super Mods/Mod Settings.js', 'Super Mods/RunTracker.js', 'Super Mods/Outfiter.js'
];

function getFallbackAllMods() {
  return [
    ...FALLBACK_DATABASE_MODS.map(name => `database/${name}`),
    ...FALLBACK_OFFICIAL_MODS.map(name => `Official Mods/${name}`),
    ...FALLBACK_SUPER_MODS.map(name => `Super Mods/${name}`),
    ...FALLBACK_OT_MODS.map(name => `OT Mods/${name}`)
  ];
}

let fallbackBundledModPaths = null;
function getFallbackBundledModPathSet() {
  if (!fallbackBundledModPaths) {
    fallbackBundledModPaths = new Set(getFallbackAllMods());
  }
  return fallbackBundledModPaths;
}

function isKnownBundledModPath(modName) {
  return getFallbackBundledModPathSet().has(modName);
}

function createFallbackRegistry() {
  return {
    getAllMods: getFallbackAllMods,
    DEFAULT_ENABLED_MODS: FALLBACK_DEFAULT_ENABLED_MODS
  };
}

function clearInitExecutionFallbackTimer() {
  if (initExecutionFallbackTimer) {
    clearTimeout(initExecutionFallbackTimer);
    initExecutionFallbackTimer = null;
  }
}

const GAME_STATE_POLL_INTERVAL_MS = 250;
const GAME_STATE_MAX_WAIT_MS = 10000;
const HYDRATION_SETTLE_MS = 750;
const LOAD_READY_LOG_INTERVAL_MS = 2000;
let reactHydrationErrorDetected = false;

function isReactHydrationErrorMessage(message) {
  const text = String(message || '');
  return text.includes('Minified React error #418') || text.includes('Minified React error #423');
}

function hasReactHydrationError() {
  return !!(window.__BA_REACT_HYDRATION_ERROR__ || reactHydrationErrorDetected);
}

function markReactHydrationError(source, message) {
  window.__BA_REACT_HYDRATION_ERROR__ = true;
  reactHydrationErrorDetected = true;
  console.warn(`[Local Mods] React hydration error detected (${source}):`, message);
}

function resetReactHydrationErrorFlag() {
  window.__BA_REACT_HYDRATION_ERROR__ = false;
  reactHydrationErrorDetected = false;
}

function installReactHydrationErrorListener() {
  if (window.__BA_HYDRATION_ERROR_LISTENER__) {
    return;
  }
  window.__BA_HYDRATION_ERROR_LISTENER__ = true;
  window.__BA_REACT_HYDRATION_ERROR__ = window.__BA_REACT_HYDRATION_ERROR__ || false;
  window.addEventListener('error', (event) => {
    if (isReactHydrationErrorMessage(event?.message)) {
      markReactHydrationError('window.error', event.message);
    }
  });
}

installReactHydrationErrorListener();

function isGameStateReady() {
  try {
    const state = globalThis.state;
    if (!state?.player?.getSnapshot || !state?.board?.getSnapshot) {
      return false;
    }
    const boardCtx = state.board.getSnapshot()?.context;
    const playerCtx = state.player.getSnapshot()?.context;
    return !!(boardCtx && playerCtx);
  } catch {
    return false;
  }
}

function modRequiresGameState(modName) {
  return modName && !modName.startsWith('database/');
}

function prefersRelaxedLoader() {
  return window.BestiaryPlatform?.prefersRelaxedLoader?.() ?? false;
}

function prefersDirectModFetchFirst() {
  return window.BestiaryPlatform?.prefersDirectModFetchFirst?.() ?? false;
}

function getBrowserExtensionApi() {
  return window.browserAPI || window.chrome || window.browser;
}

function getExtensionUrlApi() {
  return typeof BestiaryExtensionUrl !== 'undefined' ? BestiaryExtensionUrl : null;
}

function encodeModPathFallback(relativePath) {
  return String(relativePath).split('/').map((segment) => {
    if (!segment) return segment;
    try {
      segment = decodeURIComponent(segment);
    } catch {
      // keep as-is
    }
    return encodeURIComponent(segment);
  }).join('/');
}

function joinModBaseUrlFallback(baseUrl, relativePath) {
  const path = encodeModPathFallback(String(relativePath).replace(/^\//, ''));
  return baseUrl.endsWith('/') ? baseUrl + path : baseUrl + '/' + path;
}

function resolveBundledModPath(modName) {
  const extUrl = getExtensionUrlApi();
  if (extUrl?.resolveBundledModPath) {
    return extUrl.resolveBundledModPath(modName);
  }
  let filesystemPath = String(modName || '')
    .replace(/^Official Mods\//, 'Official_Mods/')
    .replace(/^Super Mods\//, 'Super_Mods/')
    .replace(/^OT Mods\//, 'OT_Mods/');
  const parts = filesystemPath.split('/');
  const file = parts.pop();
  if (file) {
    parts.push(file.replace(/ /g, '_'));
  }
  filesystemPath = parts.join('/');
  if (filesystemPath.startsWith('database/') || filesystemPath.startsWith('mods/')) {
    return filesystemPath;
  }
  return `mods/${filesystemPath}`;
}

function getModUrlFromExtensionApi(modName) {
  const api = getBrowserExtensionApi();
  if (!api?.runtime?.getURL) {
    return null;
  }
  try {
    const extUrl = getExtensionUrlApi();
    const logicalPath = resolveBundledModPath(modName);
    if (extUrl) {
      return extUrl.getExtensionResourceUrl(api.runtime.getURL.bind(api.runtime), logicalPath);
    }
    return api.runtime.getURL(logicalPath);
  } catch (error) {
    console.warn('Error getting URL from browser API:', error);
    return null;
  }
}

function useStrictLoaderCompletion() {
  return window.BestiaryPlatform?.useStrictLoaderCompletion?.() ?? true;
}

function getLoadReadySettleMs() {
  return prefersRelaxedLoader() ? 250 : HYDRATION_SETTLE_MS;
}

function waitForGameState(maxWaitMs = GAME_STATE_MAX_WAIT_MS) {
  return new Promise((resolve) => {
    if (isGameStateReady()) {
      resolve(true);
      return;
    }
    const start = Date.now();
    const tick = () => {
      if (isGameStateReady()) {
        resolve(true);
        return;
      }
      if (Date.now() - start >= maxWaitMs) {
        resolve(false);
        return;
      }
      setTimeout(tick, GAME_STATE_POLL_INTERVAL_MS);
    };
    setTimeout(tick, GAME_STATE_POLL_INTERVAL_MS);
  });
}

function waitForLoadReady(maxWaitMs = GAME_STATE_MAX_WAIT_MS) {
  return new Promise((resolve) => {
    const start = Date.now();
    let gameStateSeenAt = null;
    let lastLogAt = 0;
    const requiredSettleMs = getLoadReadySettleMs();

    const tick = () => {
      const elapsed = Date.now() - start;

      if (hasReactHydrationError() && useStrictLoaderCompletion()) {
        console.warn('[Local Mods] Aborting load-ready wait — React hydration error already detected');
        resolve(false);
        return;
      }

      const gameReady = isGameStateReady();
      const docReady = document.readyState === 'complete';

      if (gameReady && gameStateSeenAt === null) {
        gameStateSeenAt = Date.now();
        console.log('[Local Mods] Game state became ready, waiting for page settle...');
      }

      const settleMs = gameStateSeenAt ? Date.now() - gameStateSeenAt : 0;
      const settled = gameReady && docReady && gameStateSeenAt !== null && settleMs >= requiredSettleMs;

      if (settled) {
        console.log(`[Local Mods] Page load ready after ${elapsed}ms (game state + document complete + ${requiredSettleMs}ms settle)`);
        resolve(true);
        return;
      }

      if (elapsed - lastLogAt >= LOAD_READY_LOG_INTERVAL_MS) {
        lastLogAt = elapsed;
        console.log(
          `[Local Mods] Still waiting for page ready... ${Math.round(elapsed / 1000)}s ` +
          `(game: ${gameReady}, document: ${docReady}, settle: ${settleMs}ms/${requiredSettleMs}ms)`
        );
      }

      if (elapsed >= maxWaitMs) {
        if (prefersRelaxedLoader()) {
          console.warn(`[Local Mods] Relaxed loader: page ready timeout after ${maxWaitMs}ms — continuing`);
          resolve(true);
          return;
        }
        console.warn(
          `[Local Mods] Page ready timeout after ${maxWaitMs}ms (game: ${gameReady}, document: ${docReady})`
        );
        resolve(gameReady);
        return;
      }

      setTimeout(tick, GAME_STATE_POLL_INTERVAL_MS);
    };

    console.log('[Local Mods] Waiting for page ready (game state + document complete + settle)...');
    setTimeout(tick, GAME_STATE_POLL_INTERVAL_MS);
  });
}

function markExecutionTriggered() {
  executionTriggered = true;
  clearInitExecutionFallbackTimer();
}

function isModApiReadyForExecution() {
  return !!(window.BestiaryModAPI?.ui?.addButton);
}

function whenModApiReady(callback) {
  if (isModApiReadyForExecution()) {
    callback();
    return;
  }

  let done = false;
  const runOnce = () => {
    if (done) return;
    done = true;
    callback();
  };

  const onReady = () => {
    document.removeEventListener('bestiary-mod-api-ready', onReady);
    if (isModApiReadyForExecution()) {
      runOnce();
    } else if (prefersRelaxedLoader() && window.BestiaryModAPI) {
      console.warn('[Local Mods] Relaxed loader: proceeding without ui.addButton');
      runOnce();
    }
  };
  document.addEventListener('bestiary-mod-api-ready', onReady);

  if (prefersRelaxedLoader()) {
    setTimeout(() => {
      if (done) return;
      if (isModApiReadyForExecution() || window.BestiaryModAPI) {
        console.warn('[Local Mods] Relaxed loader: API wait timeout, proceeding');
        runOnce();
      }
    }, 5000);
  }
}

function scheduleInitExecutionFallback() {
  clearInitExecutionFallbackTimer();
  initExecutionFallbackTimer = setTimeout(() => {
    initExecutionFallbackTimer = null;
    if (executionTriggered || isBatchExecuting) {
      return;
    }
    if (Object.keys(executedMods).length > 0) {
      return;
    }
    const enabledMods = window.localMods.filter(mod => mod.enabled);
    if (enabledMods.length === 0) {
      return;
    }
    console.log('[Local Mods] No background execution yet; running init fallback for', enabledMods.length, 'mods');
    triggerModExecution(enabledMods, 'init-fallback');
  }, 1500);
}

function triggerModExecution(mods, source) {
  if (!mods || mods.length === 0) {
    return;
  }
  if (isBatchExecuting) {
    console.log(`[Local Mods] Skipping execution from ${source} — batch already in progress`);
    return;
  }

  const toRun = mods.filter(mod => mod.enabled && !executedMods[mod.name]);
  if (toRun.length === 0) {
    markExecutionTriggered();
    console.log(`[Local Mods] Skipping execution from ${source} — nothing left to run`);
    setTimeout(() => sendCompletionSignal([]), 500);
    return;
  }

  whenModApiReady(() => {
    if (isBatchExecuting) {
      console.log(`[Local Mods] Skipping execution from ${source} — batch started while waiting for API`);
      return;
    }
    const pending = toRun.filter(mod => !executedMods[mod.name]);
    if (pending.length === 0) {
      markExecutionTriggered();
      return;
    }
    markExecutionTriggered();
    console.log(`[Local Mods] Executing ${pending.length} mod(s) (source: ${source})`);
    executeModsInOrder(pending);
  });
}

// Ensure API is created immediately
window.localModsAPI = {
  getLocalMods: () => window.localMods,
  executeLocalMod: null // Will be defined later
};

function getModUrl(modName) {
  const extensionUrl = getModUrlFromExtensionApi(modName);
  if (extensionUrl) {
    return extensionUrl;
  }

  if (!modBaseUrl) {
    console.warn('No base URL available for mod file:', modName);
    return null;
  }

  const extUrl = getExtensionUrlApi();
  const resourcePath = resolveBundledModPath(modName);
  if (resourcePath.startsWith('database/')) {
    const baseUrl = modBaseUrl.endsWith('mods/') ? modBaseUrl.replace('mods/', '') : modBaseUrl;
    return extUrl ? extUrl.joinExtensionBaseUrl(baseUrl, resourcePath) : joinModBaseUrlFallback(baseUrl, resourcePath);
  }

  const relativePath = resourcePath.startsWith('mods/') ? resourcePath.slice('mods/'.length) : resourcePath;
  return extUrl ? extUrl.joinExtensionBaseUrl(modBaseUrl, relativePath) : joinModBaseUrlFallback(modBaseUrl, relativePath);
}

async function fetchModContentViaBackground(modName) {
  return new Promise((resolve, reject) => {
    const messageId = `mod_content_${Date.now()}_${Math.random()}`;
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', responseHandler);
      reject(new Error(`getModContent timeout for ${modName}`));
    }, 20000);

    const responseHandler = (event) => {
      if (event.source !== window) return;
      if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.id === messageId) {
        clearTimeout(timeoutId);
        window.removeEventListener('message', responseHandler);
        const response = event.data.response;
        if (response && response.success && response.content) {
          resolve(response.content);
        } else {
          reject(new Error(response?.error || 'Background failed to load mod content'));
        }
      }
    };

    window.addEventListener('message', responseHandler);
    window.postMessage({
      from: 'BESTIARY_CLIENT',
      id: messageId,
      message: { action: 'getModContent', modName }
    }, '*');
  });
}

async function tryDirectModFetch(modUrl) {
  if (!modUrl) {
    return null;
  }
  const response = await fetch(modUrl);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.text();
}

async function tryRuntimeModFetch(modName) {
  const api = window.browserAPI || window.chrome || window.browser;
  if (!api?.runtime?.sendMessage) {
    return null;
  }
  return new Promise((resolve, reject) => {
    api.runtime.sendMessage({ action: 'getModContent', modName }, (response) => {
      const lastError = chrome.runtime?.lastError || browser.runtime?.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      if (response?.success && response.content) {
        resolve(response.content);
      } else {
        reject(new Error(response?.error || 'Invalid background response'));
      }
    });
  });
}

async function getLocalModContent(modName) {
  try {
    console.log(`Fetching content for local mod: ${modName}`);
    const modUrl = getModUrl(modName);
    console.log(`Mod URL: ${modUrl}`);

    if (prefersRelaxedLoader()) {
      try {
        const content = await fetchModContentViaBackground(modName);
        console.log(`Mod content loaded via content-script bridge (relaxed), length: ${content.length} bytes`);
        return content;
      } catch (bridgeError) {
        console.warn(`Content-script bridge failed for ${modName} (relaxed):`, bridgeError);
      }

      if (modUrl) {
        try {
          const content = await tryDirectModFetch(modUrl);
          console.log(`Mod content loaded via direct fetch (relaxed), length: ${content.length} bytes`);
          return content;
        } catch (directError) {
          console.warn(`Direct fetch failed for ${modName} (relaxed):`, directError);
        }
      }

      try {
        const content = await tryRuntimeModFetch(modName);
        if (content) {
          console.log(`Mod content loaded via runtime.sendMessage (relaxed), length: ${content.length} bytes`);
          return content;
        }
      } catch (runtimeError) {
        console.warn(`Runtime getModContent failed for ${modName} (relaxed):`, runtimeError);
      }

      return null;
    }

    // Desktop path: direct fetch from page (fastest when supported)
    if (modUrl) {
      try {
        const content = await tryDirectModFetch(modUrl);
        console.log(`Mod content loaded via direct fetch, length: ${content.length} bytes`);
        return content;
      } catch (directError) {
        console.warn(`Direct fetch failed for ${modName}, trying background:`, directError);
        window.BestiaryPlatform?.setPageExtensionFetchWorks?.(false);
      }
    }

    // Mobile / Orion / Firefox fallback: background reads extension files
    try {
      const content = await fetchModContentViaBackground(modName);
      console.log(`Mod content loaded via background bridge, length: ${content.length} bytes`);
      return content;
    } catch (bridgeError) {
      console.warn(`Background bridge failed for ${modName}:`, bridgeError);
    }

    // Last resort when runtime is reachable from this context
    try {
      const content = await tryRuntimeModFetch(modName);
      if (content) {
        console.log(`Mod content loaded via runtime.sendMessage, length: ${content.length} bytes`);
        return content;
      }
    } catch (runtimeError) {
      console.warn(`Runtime getModContent failed for ${modName}:`, runtimeError);
    }

    return null;
  } catch (error) {
    console.error(`Error fetching local mod ${modName}:`, error);
    return null;
  }
}

async function checkFileExists(modName) {
  try {
    if (prefersRelaxedLoader()) {
      if (isKnownBundledModPath(modName)) {
        console.log(`[Local Mods] Relaxed loader: assuming bundled mod exists: ${modName}`);
        return true;
      }
      if (prefersDirectModFetchFirst()) {
        console.log(`[Local Mods] Mobile direct-fetch: skipping background existence probe for ${modName}`);
        return false;
      }
      try {
        const content = await fetchModContentViaBackground(modName);
        return !!content;
      } catch (backgroundError) {
        console.warn(`[Local Mods] Relaxed loader existence check failed for ${modName}:`, backgroundError);
        return false;
      }
    }

    console.log(`Checking if file exists: ${modName}`);
    const modUrl = getModUrl(modName);
    console.log(`Checking URL: ${modUrl}`);

    if (!modUrl) {
      return isKnownBundledModPath(modName);
    }

    try {
      const response = await fetch(modUrl, { method: 'HEAD' });
      const exists = response.ok;
      console.log(`File ${modName} exists: ${exists}, status: ${response.status}`);
      if (exists) {
        return true;
      }
    } catch (headError) {
      console.warn(`HEAD check failed for ${modName}:`, headError);
    }

    // GET probe when HEAD is blocked (common on mobile WebExtensions)
    try {
      const response = await fetch(modUrl, { method: 'GET' });
      if (response.ok) {
        console.log(`File ${modName} exists (verified via GET)`);
        return true;
      }
    } catch (getError) {
      console.warn(`GET check failed for ${modName}:`, getError);
    }

    if (isKnownBundledModPath(modName)) {
      console.log(`Assuming bundled mod exists in registry fallback: ${modName}`);
      return true;
    }

    try {
      const content = await fetchModContentViaBackground(modName);
      return !!content;
    } catch (backgroundError) {
      console.warn(`Background existence check failed for ${modName}:`, backgroundError);
      return false;
    }
  } catch (error) {
    console.error(`Error checking if file exists: ${modName}`, error);
    return isKnownBundledModPath(modName);
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
    
    let registryUrl = getBrowserExtensionApi()?.runtime?.getURL?.('content/mod-registry.js') || null;

    if (!registryUrl && modBaseUrl) {
      const baseUrl = modBaseUrl.replace(/mods\/$/, '');
      const extUrl = getExtensionUrlApi();
      registryUrl = extUrl
        ? extUrl.joinExtensionBaseUrl(baseUrl, 'content/mod-registry.js')
        : baseUrl + 'content/mod-registry.js';
      console.log('[Mod Registry] Using modBaseUrl to construct registry path');
    }

    if (!registryUrl) {
      throw new Error('Extension base URL not available for mod registry');
    }

    const extUrl = getExtensionUrlApi();
    if (extUrl) {
      registryUrl = extUrl.normalizeExtensionResourceUrl(registryUrl);
    }
    
    console.log('[Mod Registry] Attempting to load from:', registryUrl);
    
    // Try to import the registry module
    const module = await import(registryUrl);
    MOD_REGISTRY = module;
    console.log('[Mod Registry] Successfully loaded mod registry');
    return module;
  } catch (error) {
    console.warn('[Mod Registry] Dynamic import failed, using embedded fallback:', error);
    console.warn('[Mod Registry] modBaseUrl was:', modBaseUrl);
    MOD_REGISTRY = createFallbackRegistry();
    return MOD_REGISTRY;
  }
}

async function listAllModFiles() {
  // Only include .js files from Official Mods, Super Mods, and OT Mods
  // User-generated scripts are handled separately via localStorage
  const registry = await loadModRegistry();
  return registry.getAllMods();
}

// List of mods to enable by default - can be overridden by registry
let defaultEnabledMods = [
  'database/welcome.js',
  'database/inventory-database.js',
  'database/creature-database.js',
  'database/equipment-database.js',
  'database/maps-database.js',
  'database/equipment-lua-export.js',
  'database/creature-lua-export.js',
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
  // Hidden Super Mods - enabled by default since users can't toggle them in popup
  'Super Mods/Mod Settings.js',
  'Super Mods/RunTracker.js',
  'Super Mods/Outfiter.js'
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
      
      // Get saved mod states from storage to preserve user toggles
      let savedModStates = {};
      try {
        // Try sync storage first
        if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.sync) {
          const syncData = await window.browserAPI.storage.sync.get('localMods');
          if (syncData.localMods && syncData.localMods.length > 0) {
            syncData.localMods.forEach(mod => {
              savedModStates[mod.name] = mod.enabled;
            });
            console.log('[Local Mods] Loaded saved states from sync storage:', Object.keys(savedModStates).length, 'mods');
          }
        }
        // Fallback to local storage
        if (Object.keys(savedModStates).length === 0 && window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
          const localData = await window.browserAPI.storage.local.get('localMods');
          if (localData.localMods && localData.localMods.length > 0) {
            localData.localMods.forEach(mod => {
              savedModStates[mod.name] = mod.enabled;
            });
            console.log('[Local Mods] Loaded saved states from local storage:', Object.keys(savedModStates).length, 'mods');
          }
        }
      } catch (error) {
        console.warn('[Local Mods] Could not load saved mod states:', error);
      }

      normalizeWelcomeModSavedStates(savedModStates);
      
      let validMods = [];
      
      // Process file-based mods (Official and Super Mods)
      for (const file of modFiles) {
        console.log(`Checking mod file: ${file}`);
        const exists = await checkFileExists(file);
        console.log(`File ${file} exists: ${exists}`);
        if (exists) {
          // Use saved state if available, otherwise check defaultEnabledMods
          const enabled = file === WELCOME_MOD_PATH
            ? true
            : savedModStates.hasOwnProperty(file)
              ? savedModStates[file]
              : enabledByDefault.includes(file);
          console.log(`Mod ${file} enabled: ${enabled} (saved: ${savedModStates.hasOwnProperty(file)}, default: ${enabledByDefault.includes(file)})`);
          
          const displayKey = file.replace('.js','').replace(/_/g,' ');
          const normalizedPath = String(file).toLowerCase();
          const key = normalizedPath === 'official mods/highscore_improvements.js'
            ? 'Highscores'
            : displayKey;

          validMods.push({
            name: file,
            key,
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
      ensureWelcomeModAlwaysEnabled(window.localMods);
      
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
          if (modName.startsWith('OT Mods/')) return 3;
          if (modName.startsWith('User Mods/')) return 4;
          return 5; // Unknown mods go last
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
      
      // Prefer background-driven execution (preserves stored enable/disable states)
      console.log('Mods initialized, waiting for background registerLocalMods before execution');
      scheduleInitExecutionFallback();
      
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
    // Wait until mod-bar API is ready (ui.addButton survives UI component merge)
    if (!isModApiReadyForExecution()) {
      console.warn(`Mod API UI not ready yet, will retry executing mod: ${modName}`);
      
      let retryCount = 0;
      const maxRetries = 20;
      const checkAndExecute = () => {
        retryCount++;
        if (isModApiReadyForExecution()) {
          console.log(`Mod API UI ready on retry ${retryCount}, executing mod: ${modName}`);
          executeLocalMod(modNameOrObject, forceExecution);
        } else if (retryCount < maxRetries) {
          setTimeout(checkAndExecute, 300);
        } else {
          console.error(`Mod API UI not ready after ${maxRetries} retries, giving up on mod: ${modName}`);
        }
      };
      
      const onReady = () => {
        document.removeEventListener('bestiary-mod-api-ready', onReady);
        if (isModApiReadyForExecution()) {
          executeLocalMod(modNameOrObject, forceExecution);
        } else {
          setTimeout(checkAndExecute, 300);
        }
      };
      document.addEventListener('bestiary-mod-api-ready', onReady);
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

      // Wait for config response before executing
      return new Promise((resolve) => {
        const responseHandler = (event) => {
          if (event.source !== window) return;
          if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.id === configId) {
            window.removeEventListener('message', responseHandler);
            clearTimeout(timeoutId);
            
            if (event.data.response && event.data.response.success) {
              modConfig = event.data.response.config || {};
            }
            
            // Include enabled state in config
            modConfig.enabled = mod.enabled;
            
            executeModWithConfig();
          }
        };
        
        const executeModWithConfig = () => {
          try {
            console.log(`Creating context for local mod: ${modName} with config:`, modConfig);
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
        };
        
        // Add event listener for config response
        window.addEventListener('message', responseHandler);
        
        // Timeout fallback after 1 second
        const timeoutId = setTimeout(() => {
          window.removeEventListener('message', responseHandler);
          console.warn(`Config timeout for mod ${modName}, proceeding with default config`);
          modConfig.enabled = mod.enabled;
          executeModWithConfig();
        }, 1000);
      });
    } catch (error) {
      console.warn(`Could not load config for mod ${modName}:`, error);
      
      console.log(`Creating context for local mod: ${modName}`);
      const scriptContext = {
        hash: `local_${modName}`,
        config: { enabled: mod.enabled },
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

async function runModBatch(mods, forceExecution, results) {
  for (const mod of mods) {
    if (mod.enabled || forceExecution) {
      try {
        const result = await executeLocalMod(mod, forceExecution);
        if (result) {
          results.push({ mod: mod.name, success: true, result });
        } else {
          results.push({ mod: mod.name, success: false, error: 'Failed to load or execute' });
        }
      } catch (error) {
        console.error(`Failed to execute mod ${mod.name}:`, error);
        results.push({ mod: mod.name, success: false, error: error.message });
      }
    }
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

  window.postMessage({
    from: 'LOCAL_MODS_LOADER',
    action: 'modBatchExecutionStarted',
    modCount: mods.length
  }, '*');
  
  try {
    const results = [];
    const databaseMods = mods.filter(mod => mod.name.startsWith('database/'));
    const gameMods = mods.filter(mod => !mod.name.startsWith('database/'));

    await runModBatch(databaseMods, forceExecution, results);

    if (gameMods.length > 0) {
      if (hasReactHydrationError() && useStrictLoaderCompletion()) {
        console.warn('[Local Mods] Skipping game-dependent mods — React hydration error already detected');
      } else {
        console.log(`[Local Mods] Waiting for page ready before ${gameMods.length} game-dependent mod(s)...`);
        const maxWait = prefersRelaxedLoader() ? 5000 : GAME_STATE_MAX_WAIT_MS;
        const ready = await waitForLoadReady(maxWait);
        if (!ready) {
          console.warn('[Local Mods] Page not ready after max wait — executing game mods anyway (Welcome may refresh)');
        } else {
          console.log('[Local Mods] Page ready — executing game-dependent mods');
        }
        if (!hasReactHydrationError() || !useStrictLoaderCompletion()) {
          await runModBatch(gameMods, forceExecution, results);
        } else {
          console.warn('[Local Mods] Skipping game-dependent mods — React hydration error detected during wait');
        }
      }
    }
    
    console.log(`Batch execution completed. Results:`, results);
    
    // Send completion signal to Welcome mod after a delay to ensure all mods are fully loaded and listeners are set up
    console.log('[Local Mods] About to send completion signal...');
    setTimeout(() => {
      console.log('[Local Mods] Sending completion signal now...');
      sendCompletionSignal(results);
    }, 500); // Increased delay to ensure Welcome mod is ready
    
    return results;
  } finally {
    // isBatchExecuting stays true until sendCompletionSignal runs
  }
}

// Generate unique ID for messages
let messageIdCounter = 0;
function generateMessageId() {
  return `mod_msg_${Date.now()}_${messageIdCounter++}`;
}

// Simple completion signal - send once when all mods are done
let completionSignalSent = false;
let lastCompletionErrors = [];

function schedulePostBatchCatchup() {
  const pending = (window.localMods || []).filter(mod => mod.enabled && !executedMods[mod.name]);
  if (pending.length === 0) {
    return;
  }
  console.log(`[Local Mods] ${pending.length} enabled mod(s) not yet executed — scheduling catch-up batch`);
  resetCompletionSignal();
  setTimeout(() => triggerModExecution(pending, 'post-batch-catchup'), 0);
}

function sendCompletionSignal(results = []) {
  console.log('[Local Mods] sendCompletionSignal called, completionSignalSent:', completionSignalSent);
  if (completionSignalSent) {
    console.log('[Local Mods] Completion signal already sent, skipping');
    return; // Only send once
  }
  
  const errors = results
    .filter(r => !r.success)
    .map(r => ({ mod: r.mod, error: r.error || 'Failed to load or execute' }));

  const ranGameMods = results.some(r => modRequiresGameState(r.mod));
  if (useStrictLoaderCompletion() && ranGameMods && !isGameStateReady()) {
    errors.push({ mod: 'loader', error: 'Game state not ready (board/player unavailable)' });
    console.warn('[Local Mods] Game state still not ready after mod batch — reporting to Welcome for refresh');
  } else if (!useStrictLoaderCompletion() && ranGameMods && !isGameStateReady()) {
    console.warn('[Local Mods] Relaxed loader: game state not ready at completion (non-fatal)');
  }

  if (useStrictLoaderCompletion() && hasReactHydrationError()) {
    errors.push({ mod: 'loader', error: 'React hydration error detected (#418/#423)' });
    console.warn('[Local Mods] React hydration error detected — reporting to Welcome for refresh');
  } else if (!useStrictLoaderCompletion() && hasReactHydrationError()) {
    console.warn('[Local Mods] Relaxed loader: hydration error detected at completion (non-fatal)');
  }

  console.log('[Local Mods] All mods completed - sending signal', errors.length ? `with ${errors.length} error(s)` : 'successfully');
  completionSignalSent = true;
  lastCompletionErrors = errors;

  if (errors.length > 0 && window.BestiaryLoaderErrorLog) {
    window.BestiaryLoaderErrorLog.report(
      'loader',
      `Load completed with ${errors.length} error(s)`,
      errors.map((entry) => `${entry.mod}: ${entry.error}`).join('\n'),
      'error'
    );
  }

  if (errors.length > 0) {
    window.BestiaryUIComponents?.handleLoaderLoadFailure?.(errors);
  } else {
    window.BestiaryUIComponents?.resetModLoadRetryCount?.();
  }
  
  window.postMessage({
    from: 'LOCAL_MODS_LOADER',
    action: 'allModsLoaded',
    errors
  }, '*');
  
  isBatchExecuting = false;
  console.log('[Local Mods] Completion signal sent successfully');
  schedulePostBatchCatchup();
}

// Reset completion signal flag (for testing/reloading)
function resetCompletionSignal() {
  completionSignalSent = false;
  lastCompletionErrors = [];
  window.BestiaryUIComponents?.resetLoaderFailureHandled?.();
  console.log('[Local Mods] Completion signal flag reset');
}

document.addEventListener('reloadLocalMods', () => {
  console.log('Received reloadLocalMods event, reinitializing...');
  window.localMods = [];
  executedMods = {};
  initializationPromise = null; // Reset initialization promise
  executionTriggered = false;
  clearInitExecutionFallbackTimer();
  resetCompletionSignal(); // Reset completion signal flag
  resetReactHydrationErrorFlag();
  initLocalMods();
});

// Expose API functions immediately so they're available
window.localModsAPI.executeLocalMod = executeLocalMod;
window.localModsAPI.executeModsInOrder = executeModsInOrder;
window.localModsAPI.isBatchExecuting = () => isBatchExecuting;
window.localModsAPI.wasCompletionSignalSent = () => completionSignalSent;
window.localModsAPI.getLastLoadErrors = () => lastCompletionErrors;
window.localModsAPI.isGameStateReady = isGameStateReady;
window.localModsAPI.waitForGameState = waitForGameState;
window.localModsAPI.waitForLoadReady = waitForLoadReady;
window.localModsAPI.hasReactHydrationError = hasReactHydrationError;

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
      clearInitExecutionFallbackTimer();
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
        
        // Sort mods in the correct order: Database -> Official -> Super -> OT -> User
        const sortedMods = Array.from(existingByName.values()).sort((a, b) => {
          const getModOrder = (modName) => {
            if (modName.startsWith('database/')) return 0;
            if (modName.startsWith('Official Mods/')) return 1;
            if (modName.startsWith('Super Mods/')) return 2;
            if (modName.startsWith('OT Mods/')) return 3;
            if (modName.startsWith('User Mods/')) return 4;
            return 5; // Unknown mods go last
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
        ensureWelcomeModAlwaysEnabled(window.localMods);
        
        console.log('Local mods merged and sorted with stored states:', window.localMods.map(m => `${m.name}: ${m.enabled}`));
        console.log('Manual mods in merged data:', 
          window.localMods.filter(m => m.type === 'manual').map(m => ({ name: m.name, type: m.type, hasContent: !!m.content })));
        
        // Execute all enabled mods from stored states in correct order
        const enabledMods = window.localMods.filter(mod => mod.enabled);
        console.log(`[Local Mods] Found ${enabledMods.length} enabled mods, isBatchExecuting: ${isBatchExecuting}`);
        if (enabledMods.length > 0 && !isBatchExecuting) {
          console.log(`Executing ${enabledMods.length} enabled mods in correct order:`);
          console.log('Loading order: Database -> Official -> Super -> OT -> User');
          enabledMods.forEach((mod, index) => {
            const category = mod.name.startsWith('database/') ? 'Database' :
                           mod.name.startsWith('Official Mods/') ? 'Official' :
                           mod.name.startsWith('Super Mods/') ? 'Super' :
                           mod.name.startsWith('OT Mods/') ? 'OT' :
                           mod.name.startsWith('User Mods/') ? 'User' : 'Unknown';
            console.log(`  ${index + 1}. [${category}] ${mod.name}`);
          });
          triggerModExecution(enabledMods, 'background-registerLocalMods');
        } else if (isBatchExecuting) {
          console.log('Skipping execution - batch execution already in progress');
        } else {
          console.log('No enabled mods found in stored states');
          setTimeout(() => sendCompletionSignal([]), 500);
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
        triggerModExecution(enabledMods, 'executeLocalMod-batch');
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

