/**
 * Popup Script for Bestiary Arena Mod Loader
 * 
 * IMPORTANT: When adding a new mod, update the static mod lists in this file!
 * Popup cannot load ES6 modules, so we maintain static lists that must be kept in sync with:
 * - content/mod-registry.js (the source of truth)
 * 
 * Search for "kept in sync with mod-registry.js" to find the lists to update.
 */

// =============================================================================
// 1. Configuration & Constants
// =============================================================================

// Polyfill for Chrome and Firefox WebExtensions
if (typeof window.browser === 'undefined') {
  window.browser = window.chrome;
}

window.browserAPI = window.browserAPI || (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

const originalConsoleLog = console.log;

const GITHUB_OPTIONAL_ORIGINS = [
  '*://*.gist.githubusercontent.com/*',
  '*://gist.githubusercontent.com/*',
  '*://*.raw.githubusercontent.com/*',
  '*://raw.githubusercontent.com/*'
];

// Feature / storage keys
const DEBUG_STORAGE_KEY = 'bestiary-debug';
const LOADER_ERROR_STORAGE_KEY = 'ba-loader-errors';
const OUTFITER_STORAGE_KEY = 'outfiter-enabled';
const WELCOME_STORAGE_KEY = 'welcome-enabled';
const COLOR_MODE_STORAGE_KEY = 'popup-color-mode-v2';
const PATCH_NOTES_STORAGE_KEY = 'last-viewed-version';
const MANUAL_MODS_KEY = 'manualMods';
const LANGUAGE_STORAGE_KEY = 'popup-language';

// NOTE: Keep patch notes simple and concise. Consolidate similar changes into single entries.
// Only show patch notes for the current version in the popup.

const POPUP_LAYOUT_CONFIG = {
  width: 600,
  maxHeight: 600,
  minWidth: 280,
  minHeightCap: 280,
  patchNotesHeaderHeight: 49,
  patchNotesContentMinHeight: 100,
  patchNotesMaxHeight: 360,
  patchNotesReservedHeight: 120
};

const POPUP_LAYOUT_MAX_RETRIES = 12;

// Fallback descriptions for mods (aligned with README.md; keys must match getModDisplayName() exactly)
const modDescriptions = {
  'Bestiary Automator': 'Automates stamina, rewards, Day Care, and other routine gameplay.',
  'Board Analyzer': 'Simulates board setups to compare strategies and performance.',
  'Custom Display': 'Performance Mode and map grid overlay for clearer planning.',
  'Hero Editor': 'Edit monster stats and gear in-game; save and load test setups.',
  'Highscores': 'Richer highscores with extra stats, sorting, and room breakdowns.',
  'Item tier list': 'Equipment rankings to compare items and loadouts by tier.',
  'Monster tier list': 'Monster rankings with usage stats and sortable performance tiers.',
  'Setup Manager': 'Save, load, and manage named team setups per map.',
  'Team Copier': 'Share setups as JSON or links, with seeds and recent history.',
  'Tick Tracker': 'Tracks session ticks (optional ms) with history and copy tools.',
  'Turbo Mode': 'Speeds up gameplay with custom multipliers and tick display.',
  'Battle Helper': 'Load another player\'s arsenal into sandbox; restore in one click.',
  'Autoseller': 'Sells or squeezes creatures by gene thresholds with session stats.',
  'Autoscroller': 'Auto-uses summon scrolls to hunt targets with tiers and stop rules.',
  'Better Analytics': 'Impact DPS plus sandbox units, battle log, filters, and fight speed.',
  'Better Bestiary': 'Bulk-sell duplicates for species you already keep shiny or awakened.',
  'Better Boosted Maps': 'Farms daily boosted maps with mod coordination and setups.',
  'Better Cauldron': 'Search and filter Monstrous Cauldron monsters, including by rarity.',
  'Better Daycare': 'Autohandles Daycare level-ups/ejections and fills slots from a queue.',
  'Better Exaltation Chest': 'Auto-open chests, filter gear, and disenchant with dust tracking.',
  'Better Forge': 'Arsenal tools with batch disenchant, search, filters, and dust stats.',
  'Better Highscores': 'Live tick and rank boards for the current map with medal styling.',
  'Better Hy\'genie': 'Smarter Hy\'genie fusion UI with quantity inputs and ratios.',
  'Better Rune Recycler': 'Batch-recycles runes with validation and gold/stat tracking.',
  'Better Setups': 'Labeled setups (Farm, Speedrun, etc.) with UI and Configurator support.',
  'Better Tasker': 'Auto-accepts quests and navigates maps; pauses when rewards are ready.',
  'Better Teleporter': 'Improves the in-game teleporter map selection dialog.',
  'Better Yasir': 'Bulk buy and sell at Yasir with live prices and confirmations.',
  'Cyclopedia': 'Monster and gear databases, profiles, season ranks, and RunTracker.',
  'Dice Roller': 'Auto-rolls dice until your target stats are reached.',
  'Depot Manager': 'Depot rows, favorites, and quick send-to-depot from the bestiary.',
  'Challenges': 'Random challenge runs with scoring, leaderboards, and replay sharing.',
  'Guilds': 'Guilds with roles, encrypted chat, invites, and a browser.',
  'Hunt Analyzer': 'Autoplay session stats for gold, dust, drops, and export.',
  'Raid Hunter': 'Detects and joins raids with setup, autoplay, stamina, and queues.',
  'Manual Runner': 'Repeats manual runs until win, S+, or max floor; stats and replays.',
  'Stamina Optimizer': 'Starts or stops play at stamina limits; works with farming mods.',
  'Awaken Tracker': 'Tracks awaken gene progress per map with live deltas and pause-on-cap.',
  'Quests': 'Quest tracking, NPC dialogs, items, and synced progress.',
  'VIP List': 'Favorite players with profiles, sortable stats, and Cyclopedia links.',
  'Map Editor': 'Experimental tile editor: swap sprites, hitboxes, and export quest JSON.'
};

const modAuthorProfileUrls = {
  'Better Bestiary': 'https://bestiaryarena.com/profile/megafuji',
};

// Super Mods list - kept in sync with mod-registry.js
const superModNames = [
  'Autoseller.js',
  'Autoscroller.js',
  'Battle_Helper.js',
  'Better Analytics.js',
  'Better Bestiary.js',
  'Better Boosted Maps.js',
  'Better Cauldron.js',
  'Better Daycare.js',
  'Better Exaltation Chest.js',
  'Better Forge.js',
  'Better Highscores.js',
  'Better Hy\'genie.js',
  'Better Rune Recycler.js',
  'Better Setups.js',
  'Better Tasker.js',
  'Better Teleporter.js',
  'Better Yasir.js',
  'Cyclopedia.js',
  'Dice_Roller.js',
  'Depot Manager.js',
  'Hunt Analyzer.js',
  'Mod Settings.js',
  'Outfiter.js',
  'Raid_Hunter.js',
  'Manual Runner.js',
  'RunTracker.js',
  'Stamina Optimizer.js',
  'Awaken Tracker.js'
];

// OT Mods list - kept in sync with mod-registry.js
const otModNames = [
  'Challenges.js',
  'Quests.js',
  'Guilds.js',
  'VIP List.js',
  'Map_Editor.js'
];

const hiddenMods = [
  'inventory-database.js',
  'creature-database.js',
  'welcome.js',
  'equipment-database.js',
  'maps-database.js',
  'equipment-lua-export.js',
  'creature-lua-export.js',
  'playereq-database.js',
  'firebase-admins.js',
  'Mod Settings.js',
  'RunTracker.js',
  'Outfiter.js'
];


// =============================================================================
// 2. Runtime State
// =============================================================================

let DEBUG_MODE = false;
let OUTFITER_ENABLED = false;
let WELCOME_ENABLED = true;
let COLOR_MODE = 'light';
let PATCH_NOTES = [];
let popupLayoutResizeHandler = null;
let popupLayoutRetryRafId = null;
let currentTranslations = null;
let allMods = [];
let isLoadingMods = false;
let loadLocalModsGeneration = 0;

let currentSearchTerm = '';
let currentCategory = 'all';

let popupStorageChangeHandler = null;
let popupFocusHandler = null;

// =============================================================================
// 3. Browser & Permissions Helpers
// =============================================================================

async function getActiveTabId() {
  const [tab] = await window.browserAPI.tabs.query({ active: true, currentWindow: true });
  return tab && tab.id != null ? tab.id : null;
}

async function hasGitHubHostAccess() {
  if (!window.browserAPI || !window.browserAPI.permissions) {
    return true;
  }
  try {
    return await window.browserAPI.permissions.contains({ origins: GITHUB_OPTIONAL_ORIGINS });
  } catch (error) {
    originalConsoleLog('Error checking GitHub host permissions:', error);
    return false;
  }
}

async function ensureGitHubHostAccess() {
  if (await hasGitHubHostAccess()) {
    return true;
  }
  if (!window.browserAPI || !window.browserAPI.permissions) {
    return true;
  }
  try {
    return await window.browserAPI.permissions.request({ origins: GITHUB_OPTIONAL_ORIGINS });
  } catch (error) {
    originalConsoleLog('Error requesting GitHub host permissions:', error);
    return false;
  }
}


// =============================================================================
// 4. Color Mode & Theme
// =============================================================================

function getStoredColorMode() {
  try {
    const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch (_) {}
  return 'light'; // default when unset
}

function applyColorMode(mode, { persist = true } = {}) {
  COLOR_MODE = mode === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-color-mode', COLOR_MODE);
  if (persist) {
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, COLOR_MODE);
    } catch (_) {}
  }
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    darkModeToggle.checked = COLOR_MODE === 'dark';
  }
  updateColorModeLabel();
}

function updateColorModeLabel() {
  const label = document.getElementById('color-mode-label');
  if (!label) return;
  const lightText = label.dataset.lightText || 'Light Mode';
  const darkText = label.dataset.darkText || 'Dark Mode';
  label.textContent = COLOR_MODE === 'dark' ? darkText : lightText;
}

async function refreshToggleStatusLabels() {
  const { onText, offText } = await getOnOffLabels();
  setToggleUi('debug-toggle', 'debug-status', DEBUG_MODE, onText, offText);
  setToggleUi('outfiter-toggle', 'outfiter-status', OUTFITER_ENABLED, onText, offText);

  const label = document.getElementById('color-mode-label');
  if (label) {
    label.dataset.lightText = (await getTranslation('popup.lightMode')) || 'Light Mode';
    label.dataset.darkText = (await getTranslation('popup.darkMode')) || 'Dark Mode';
    updateColorModeLabel();
  }
}

function applyPopupTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName || 'default');
}

// Apply stored mode ASAP to avoid a dark flash (light is default)
applyColorMode(getStoredColorMode(), { persist: false });


// =============================================================================
// 5. Layout & Responsive
// =============================================================================

function isLikelyMobilePopupHost() {
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    /iPhone|iPad|iPod|Android|Mobile|Orion/i.test(navigator.userAgent || '')
  );
}

function getPopupViewportSize() {
  const visualViewport = window.visualViewport;
  return {
    width: Math.round(visualViewport?.width ?? window.innerWidth),
    height: Math.round(visualViewport?.height ?? window.innerHeight)
  };
}

function isUninitializedPopupViewport(width, height) {
  return (
    width <= POPUP_LAYOUT_CONFIG.minWidth &&
    height <= POPUP_LAYOUT_CONFIG.minHeightCap
  );
}

function applyPopupPatchNotesLayout(height) {
  const root = document.documentElement;
  const patchNotesCap = Math.min(
    POPUP_LAYOUT_CONFIG.patchNotesMaxHeight,
    Math.max(
      POPUP_LAYOUT_CONFIG.patchNotesHeaderHeight + 80,
      height - POPUP_LAYOUT_CONFIG.patchNotesReservedHeight
    )
  );
  const contentMin = Math.min(
    POPUP_LAYOUT_CONFIG.patchNotesContentMinHeight,
    patchNotesCap - POPUP_LAYOUT_CONFIG.patchNotesHeaderHeight
  );
  root.style.setProperty('--patch-notes-max-height', `${patchNotesCap}px`);
  root.style.setProperty(
    '--patch-notes-content-min-height',
    `${Math.max(80, contentMin)}px`
  );
}

function applyPopupResponsiveLayout(retryAttempt = 0) {
  const targetWidth = POPUP_LAYOUT_CONFIG.width;
  const targetHeight = POPUP_LAYOUT_CONFIG.maxHeight;
  const { width: viewportW, height: viewportH } = getPopupViewportSize();
  const isLikelyMobileViewport = isLikelyMobilePopupHost();
  const root = document.documentElement;
  root.classList.toggle('popup-mobile-host', isLikelyMobileViewport);

  let width;
  let height;

  if (isLikelyMobileViewport) {
    // Mobile hosts (Firefox Android, Orion sheet, etc.) should fill the real viewport.
    // Same 280×280 first-paint stub as desktop Edge — never lock to it; retry until real size.
    if (isUninitializedPopupViewport(viewportW, viewportH)) {
      if (retryAttempt < POPUP_LAYOUT_MAX_RETRIES && popupLayoutRetryRafId == null) {
        popupLayoutRetryRafId = requestAnimationFrame(() => {
          popupLayoutRetryRafId = null;
          applyPopupResponsiveLayout(retryAttempt + 1);
        });
      }
      return;
    }
    width = viewportW;
    height = viewportH;
  } else {
    // Extension popups should default to the designed size (600×600). Only shrink when the
    // browser has already given a real viewport smaller than our target (e.g. narrow window).
    // Edge can report the minimum stub size on first paint; clamping to that locks the popup small.
    const shrinkForViewport =
      viewportW > POPUP_LAYOUT_CONFIG.minWidth &&
      viewportH > POPUP_LAYOUT_CONFIG.minHeightCap &&
      (viewportW < targetWidth || viewportH < targetHeight);

    width = shrinkForViewport
      ? Math.max(POPUP_LAYOUT_CONFIG.minWidth, Math.min(targetWidth, viewportW))
      : targetWidth;
    height = shrinkForViewport
      ? Math.max(POPUP_LAYOUT_CONFIG.minHeightCap, Math.min(targetHeight, viewportH))
      : targetHeight;
  }

  root.style.setProperty('--popup-width', `${width}px`);
  root.style.setProperty('--popup-height', `${height}px`);
  applyPopupPatchNotesLayout(height);
  fitCategoryFilterLabels();
}

function teardownPopupResponsiveLayout() {
  if (popupLayoutRetryRafId != null) {
    cancelAnimationFrame(popupLayoutRetryRafId);
    popupLayoutRetryRafId = null;
  }
  if (popupLayoutResizeHandler) {
    window.removeEventListener('resize', popupLayoutResizeHandler);
    window.visualViewport?.removeEventListener('resize', popupLayoutResizeHandler);
    window.visualViewport?.removeEventListener('scroll', popupLayoutResizeHandler);
    popupLayoutResizeHandler = null;
  }
}

function setupPopupResponsiveLayout() {
  teardownPopupResponsiveLayout();
  applyPopupResponsiveLayout();
  requestAnimationFrame(() => applyPopupResponsiveLayout());

  popupLayoutResizeHandler = () => applyPopupResponsiveLayout();
  window.addEventListener('resize', popupLayoutResizeHandler);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', popupLayoutResizeHandler);
    window.visualViewport.addEventListener('scroll', popupLayoutResizeHandler);
  }
}

function setPatchNotesVisible(container, visible) {
  if (!container) return;
  container.classList.toggle('is-visible', visible);
}

// Load patch notes from JSON file


// =============================================================================
// 6. Feature Flags (Debug / Outfiter / Welcome)
// =============================================================================

async function getOnOffLabels() {
  const onText = (await getTranslation('popup.on')) || 'ON';
  const offText = (await getTranslation('popup.off')) || 'OFF';
  return { onText, offText };
}

function setToggleUi(toggleId, statusId, enabled, onText, offText) {
  const toggle = document.getElementById(toggleId);
  const status = document.getElementById(statusId);
  if (toggle) toggle.checked = enabled;
  if (status) status.textContent = enabled ? onText : offText;
}

async function syncBooleanFlagToGameTab({ action, windowKey, storageKey, enabled }) {
  try {
    const [tab] = await window.browserAPI.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.includes('bestiaryarena.com')) return;

    await window.browserAPI.tabs.sendMessage(tab.id, { action, enabled }).catch(() => null);

    if (window.browserAPI.scripting?.executeScript) {
      await window.browserAPI.scripting.executeScript({
        target: { tabId: tab.id },
        func: (windowKey, storageKey, action, enabled) => {
          window[windowKey] = enabled;
          localStorage.setItem(storageKey, String(enabled));
          window.postMessage({ from: 'BESTIARY_EXTENSION', action, enabled }, '*');
        },
        args: [windowKey, storageKey, action, enabled]
      });
    } else if (window.browserAPI.tabs?.executeScript) {
      const code = [
        `window[${JSON.stringify(windowKey)}] = ${enabled};`,
        `localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(String(enabled))});`,
        `window.postMessage({ from: 'BESTIARY_EXTENSION', action: ${JSON.stringify(action)}, enabled: ${enabled} }, '*');`
      ].join('\n');
      await window.browserAPI.tabs.executeScript(tab.id, { code });
    }
  } catch (error) {
    originalConsoleLog(`Could not send ${action} to content script:`, error);
  }
}

async function updateDebugMode(enabled) {
  DEBUG_MODE = enabled;
  localStorage.setItem(DEBUG_STORAGE_KEY, enabled.toString());
  const { onText, offText } = await getOnOffLabels();
  setToggleUi('debug-toggle', 'debug-status', enabled, onText, offText);
  await syncBooleanFlagToGameTab({
    action: 'updateDebugMode',
    windowKey: 'BESTIARY_DEBUG',
    storageKey: DEBUG_STORAGE_KEY,
    enabled
  });
  originalConsoleLog('Mod debug mode:', enabled ? 'enabled' : 'disabled');
}

async function updateOutfiterMode(enabled) {
  OUTFITER_ENABLED = enabled;
  localStorage.setItem(OUTFITER_STORAGE_KEY, enabled.toString());
  const { onText, offText } = await getOnOffLabels();
  setToggleUi('outfiter-toggle', 'outfiter-status', enabled, onText, offText);
  await syncBooleanFlagToGameTab({
    action: 'updateOutfiterMode',
    windowKey: 'OUTFITER_ENABLED',
    storageKey: OUTFITER_STORAGE_KEY,
    enabled
  });
  originalConsoleLog('Outfiter mode:', enabled ? 'enabled' : 'disabled');
}

async function enableWelcomePage() {
  WELCOME_ENABLED = true;
  localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
  await syncBooleanFlagToGameTab({
    action: 'updateWelcomeMode',
    windowKey: 'WELCOME_ENABLED',
    storageKey: WELCOME_STORAGE_KEY,
    enabled: true
  });
  originalConsoleLog('Welcome page enabled');
}

// Function to extract Gist hash from input (supports hash or full URL)

async function loadDebugMode() {
  try {
    DEBUG_MODE = localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
    const { onText, offText } = await getOnOffLabels();
    setToggleUi('debug-toggle', 'debug-status', DEBUG_MODE, onText, offText);
    originalConsoleLog('Mod debug mode loaded:', DEBUG_MODE ? 'enabled' : 'disabled');
  } catch (error) {
    console.error('Failed to load debug mode:', error);
    DEBUG_MODE = false;
  }
}

// Function to load outfiter mode from storage
async function loadOutfiterMode() {
  try {
    OUTFITER_ENABLED = localStorage.getItem(OUTFITER_STORAGE_KEY) === 'true';
    const { onText, offText } = await getOnOffLabels();
    setToggleUi('outfiter-toggle', 'outfiter-status', OUTFITER_ENABLED, onText, offText);
    originalConsoleLog('Outfiter mode loaded:', OUTFITER_ENABLED ? 'enabled' : 'disabled');
  } catch (error) {
    console.error('Failed to load outfiter mode:', error);
    OUTFITER_ENABLED = false;
  }
}

// Function to load welcome page mode from storage
async function loadWelcomeMode() {
  try {
    const welcomeEnabled = localStorage.getItem(WELCOME_STORAGE_KEY);
    WELCOME_ENABLED = welcomeEnabled !== 'false'; // Default to true if not set
    
    // Always show welcome mode loading
    originalConsoleLog('Welcome page mode loaded:', WELCOME_ENABLED ? 'enabled' : 'disabled');
  } catch (error) {
    console.error('Failed to load welcome page mode:', error);
    WELCOME_ENABLED = true; // Default to enabled on error
  }
}


// =============================================================================
// 7. Localization
// =============================================================================

async function loadAndApplyTranslations() {
  try {
    currentTranslations = await window.LocalizationUtils.loadTranslations();
    await applyTranslations();
  } catch (error) {
    originalConsoleLog('Error loading translations:', error);
  }
}

// Apply translations to DOM elements (data-localize + a few special cases)
async function applyTranslations() {
  if (!currentTranslations) {
    currentTranslations = await window.LocalizationUtils.loadTranslations();
  }

  applyLocalization();

  const patchTitle = document.querySelector('.patch-notes-title');
  if (patchTitle) {
    patchTitle.textContent = getTranslationSync('popup.patchNotesTitle', patchTitle.textContent);
  }
  const patchClose = document.querySelector('.patch-notes-close');
  if (patchClose) {
    patchClose.setAttribute(
      'aria-label',
      getTranslationSync('popup.closePatchNotes', patchClose.getAttribute('aria-label') || 'Close patch notes')
    );
  }

  await refreshToggleStatusLabels();
  fitCategoryFilterLabels();
}

// Helper function to get translation (for use in other functions)
function getTranslationSync(path, fallback = '') {
  if (!currentTranslations) {
    return fallback;
  }

  const keys = path.split('.');
  let result = currentTranslations;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return fallback;
    }
  }

  return result || fallback;
}

function applyLocalization() {
  // Apply text localization
  const localizeElements = document.querySelectorAll('[data-localize]');
  for (const element of localizeElements) {
    const key = element.getAttribute('data-localize');
    const translation = getTranslationSync(key);
    if (translation) {
      element.textContent = translation;
    }
  }

  // Apply placeholder localization
  const placeholderElements = document.querySelectorAll('[data-localize-placeholder]');
  for (const element of placeholderElements) {
    const key = element.getAttribute('data-localize-placeholder');
    const translation = getTranslationSync(key);
    if (translation) {
      element.placeholder = translation;
    }
  }
}

function initializeLanguageToggle() {
  const langEnBtn = document.getElementById('lang-en');
  const langPtBtn = document.getElementById('lang-pt');

  if (!langEnBtn || !langPtBtn) return;

  // Get stored language or default to browser language
  const storedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  const currentLang = storedLang || (navigator.language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en-US');

  // Update button states
  updateLanguageButtons(currentLang);

  // Add event listeners
  langEnBtn.addEventListener('click', () => switchLanguage('en-US'));
  langPtBtn.addEventListener('click', () => switchLanguage('pt-BR'));
}

function updateLanguageButtons(activeLang) {
  const langEnBtn = document.getElementById('lang-en');
  const langPtBtn = document.getElementById('lang-pt');

  if (!langEnBtn || !langPtBtn) return;

  // Remove active class from both buttons
  langEnBtn.classList.remove('active');
  langPtBtn.classList.remove('active');

  // Add active class to the current language button
  if (activeLang === 'en-US') {
    langEnBtn.classList.add('active');
  } else if (activeLang === 'pt-BR') {
    langPtBtn.classList.add('active');
  }
}

async function switchLanguage(locale) {
  // Store the selected language
  localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);

  // Update button states
  updateLanguageButtons(locale);

  // Clear the global translation cache to force reload with new language
  if (window.LocalizationUtils) {
    window.LocalizationUtils.translationsCache = null;
    window.LocalizationUtils.translationsLocale = null;
  }

  // Load translations for the new language using global system
  currentTranslations = await window.LocalizationUtils.loadTranslations();

  // Update version display with new language
  await updateVersionDisplay();

  // Reapply chrome UI localizations (data-localize, toggles, etc.)
  await applyTranslations();

  // Mod cards bake in translated strings at create time — rebuild them
  if (allMods.length) {
    await renderLocalMods(allMods);
  } else {
    fitCategoryFilterLabels();
  }
}


// Apply localization to elements with data attributes


// =============================================================================
// 8. Storage & Lifecycle
// =============================================================================

async function getManualMods() {
  return new Promise(resolve => {
    if (!window.browserAPI || !window.browserAPI.storage || !window.browserAPI.storage.local) {
      // Fallback to localStorage if browserAPI not available
      try {
        const stored = localStorage.getItem(MANUAL_MODS_KEY);
        resolve(stored ? JSON.parse(stored) : []);
      } catch (e) {
        resolve([]);
      }
      return;
    }
    window.browserAPI.storage.local.get([MANUAL_MODS_KEY], result => {
      resolve(result[MANUAL_MODS_KEY] || []);
    });
  });
}

async function saveManualMods(mods) {
  return new Promise(resolve => {
    if (!window.browserAPI || !window.browserAPI.storage || !window.browserAPI.storage.local) {
      // Fallback to localStorage if browserAPI not available
      try {
        localStorage.setItem(MANUAL_MODS_KEY, JSON.stringify(mods));
        resolve();
      } catch (e) {
        resolve();
      }
      return;
    }
    window.browserAPI.storage.local.set({ [MANUAL_MODS_KEY]: mods }, resolve);
  });
}

async function updateStorageUsage() {
  try {
    const storageElement = document.getElementById('storage-usage');
    if (!storageElement) return;

    let totalBytes = 0;
    
    // 1. Extension storage (chrome.storage.local/sync)
    if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
      if (window.browserAPI.storage.local.getBytesInUse) {
        totalBytes += await new Promise(resolve => {
          window.browserAPI.storage.local.getBytesInUse(null, resolve);
        });
      } else {
        const allData = await new Promise(resolve => {
          window.browserAPI.storage.local.get(null, resolve);
        });
        totalBytes += new Blob([JSON.stringify(allData)]).size;
      }
    }
    
    // 2. localStorage estimate (need to query from content script or estimate)
    try {
      // Try to get from active tab's localStorage
      if (window.browserAPI && window.browserAPI.tabs) {
        const [tab] = await window.browserAPI.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && tab.url.includes('bestiaryarena.com')) {
          const result = await window.browserAPI.tabs.sendMessage(tab.id, {
            action: 'getStorageSizes'
          }).catch(() => null);
          
          if (result && result.success) {
            totalBytes += result.localStorageSize || 0;
            totalBytes += result.indexedDBSize || 0;
          }
        }
      }
    } catch (e) {
      // If we can't query tab, just show extension storage
      if (typeof originalConsoleLog !== 'undefined') {
        originalConsoleLog('Could not query tab storage:', e);
      }
    }
    
    // Format bytes to human-readable
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      // If value in KB is >= 1000, show in MB instead
      if (i === 1 && bytes >= 1000 * k) {
        return parseFloat((bytes / Math.pow(k, 2)).toFixed(2)) + ' ' + sizes[2];
      }
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    const storageText = await getTranslation('popup.storage', 'Storage:');
    storageElement.textContent = `${storageText} ${formatBytes(totalBytes)}`;
    
    // Add color indicator if storage is getting high
    if (totalBytes > 4 * 1024 * 1024) { // > 4MB
      storageElement.style.color = '#ff9966';
    } else if (totalBytes > 3 * 1024 * 1024) { // > 3MB
      storageElement.style.color = '#ffe066';
    } else {
      storageElement.style.color = 'var(--theme-text-secondary, #aaa)';
    }
  } catch (error) {
    console.error('Failed to calculate storage usage:', error);
    const storageElement = document.getElementById('storage-usage');
    if (storageElement) {
      const storageText = await getTranslation('popup.storage', 'Storage:');
      storageElement.textContent = `${storageText} unavailable`;
    }
  }
}

function setupPopupStorageAndLifecycle() {
  const storage = window.browserAPI?.storage;

  if (storage?.local?.get) {
    storage.local.get(['dashboard-theme'], (result) => {
      applyPopupTheme(result?.['dashboard-theme'] || 'default');
    });
  } else {
    applyPopupTheme(localStorage.getItem('dashboard-theme') || 'default');
  }

  if (popupStorageChangeHandler && storage?.onChanged?.removeListener) {
    storage.onChanged.removeListener(popupStorageChangeHandler);
  }

  popupStorageChangeHandler = (changes, area) => {
    if (area !== 'local') return;
    if (changes['dashboard-theme']) {
      applyPopupTheme(changes['dashboard-theme'].newValue || 'default');
    }
    if ((changes[MANUAL_MODS_KEY] || changes.localMods) && !isLoadingMods) {
      loadLocalMods();
    }
    updateStorageUsage();
  };

  if (storage?.onChanged?.addListener) {
    storage.onChanged.addListener(popupStorageChangeHandler);
  }

  if (popupFocusHandler) {
    window.removeEventListener('focus', popupFocusHandler);
  }
  popupFocusHandler = () => {
    loadLocalMods();
    updateStorageUsage();
  };
  window.addEventListener('focus', popupFocusHandler);

  window.addEventListener('pagehide', () => {
    teardownPopupResponsiveLayout();
    if (popupStorageChangeHandler && window.browserAPI?.storage?.onChanged?.removeListener) {
      window.browserAPI.storage.onChanged.removeListener(popupStorageChangeHandler);
      popupStorageChangeHandler = null;
    }
    if (popupFocusHandler) {
      window.removeEventListener('focus', popupFocusHandler);
      popupFocusHandler = null;
    }
  }, { once: true });
}


// Track whether we're currently loading mods to prevent loops / stale renders


// =============================================================================
// 9. Error Log
// =============================================================================

function isLoaderErrorEntry(entry) {
  return (entry?.level || 'error') === 'error';
}

function parseBrowserName(userAgent) {
  if (/Orion/i.test(userAgent)) return 'Orion';
  if (/Firefox/i.test(userAgent)) return 'Firefox';
  if (/Edg\//i.test(userAgent)) return 'Edge';
  if (/Chrome/i.test(userAgent)) return 'Chrome';
  if (/Safari/i.test(userAgent)) return 'Safari';
  return 'Unknown';
}

async function fetchDeviceInfo() {
  try {
    const tabs = await window.browserAPI.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab?.id != null && tab.url && tab.url.includes('bestiaryarena.com')) {
      const live = await window.browserAPI.tabs.sendMessage(tab.id, { action: 'getDeviceInfo' }).catch(() => null);
      if (live?.success && live.info) {
        return live.info;
      }
    }
    if (tab?.url) {
      return {
        userAgent: navigator.userAgent || '',
        platform: navigator.platform || 'unknown',
        language: navigator.language || '',
        mobile: /iPhone|iPad|iPod|Android|Orion/i.test(navigator.userAgent || ''),
        url: tab.url
      };
    }
  } catch {
    // fall through to popup context
  }

  return {
    userAgent: navigator.userAgent || '',
    platform: navigator.platform || 'unknown',
    language: navigator.language || '',
    mobile: /iPhone|iPad|iPod|Android|Orion/i.test(navigator.userAgent || ''),
    url: 'n/a (no active game tab)'
  };
}

async function formatErrorLogEnvironmentHeader() {
  const info = await fetchDeviceInfo();
  let extVersion = 'unknown';
  try {
    extVersion = (await window.browserAPI.runtime.getManifest()).version;
  } catch {
    // keep default
  }

  const lines = [
    '--- Device / Browser ---',
    `Extension: v${extVersion}`,
    `Browser: ${parseBrowserName(info.userAgent)}`,
    `Platform: ${info.platform}`,
    `Device: ${info.mobile ? 'mobile' : 'desktop'}`,
    `Language: ${info.language}`,
    `URL: ${info.url}`,
    `User-Agent: ${info.userAgent}`,
    `Captured: ${new Date().toISOString()}`,
    '---'
  ];
  return lines.join('\n');
}

function formatLoaderErrorEntry(entry) {
  const time = new Date(entry.ts || Date.now()).toISOString();
  const mobile = entry.mobile ? ' [mobile]' : '';
  const detail = entry.detail ? `\n  ${entry.detail}` : '';
  return `[${time}] ${(entry.level || 'error').toUpperCase()}${mobile} [${entry.source || 'unknown'}] ${entry.message || ''}${detail}`;
}

async function fetchLoaderErrors() {
  try {
    const tabs = await window.browserAPI.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab?.id != null && tab.url && tab.url.includes('bestiaryarena.com')) {
      const live = await window.browserAPI.tabs.sendMessage(tab.id, { action: 'getLoaderErrors' }).catch(() => null);
      if (live?.success && Array.isArray(live.errors)) {
        return live.errors;
      }
    }
  } catch {
    // ignore tab query failures
  }

  const background = await window.browserAPI.runtime.sendMessage({ action: 'getLoaderErrors' }).catch(() => null);
  if (background?.success && Array.isArray(background.errors)) {
    return background.errors;
  }

  return new Promise((resolve) => {
    window.browserAPI.storage.local.get([LOADER_ERROR_STORAGE_KEY], (result) => {
      resolve(Array.isArray(result[LOADER_ERROR_STORAGE_KEY]) ? result[LOADER_ERROR_STORAGE_KEY] : []);
    });
  });
}

async function refreshErrorLogPanel() {
  const panel = document.getElementById('error-log-panel');
  if (!panel) return;

  panel.textContent = await getTranslation('popup.errorLogLoading', 'Loading errors...');
  const [header, errors] = await Promise.all([
    formatErrorLogEnvironmentHeader(),
    fetchLoaderErrors().then((entries) => entries.filter(isLoaderErrorEntry))
  ]);

  if (errors.length === 0) {
    const emptyMsg = await getTranslation('popup.errorLogEmpty', 'No errors recorded.');
    panel.textContent = `${header}\n\n${emptyMsg}`;
  } else {
    panel.textContent = `${header}\n\n${errors.map(formatLoaderErrorEntry).join('\n\n')}`;
  }
}

async function copyErrorLog() {
  const panel = document.getElementById('error-log-panel');
  if (!panel?.textContent) return;

  try {
    await navigator.clipboard.writeText(panel.textContent);
    const copiedMsg = await getTranslation('popup.errorLogCopied', 'Error log copied to clipboard.');
    originalConsoleLog(copiedMsg);
  } catch (error) {
    originalConsoleLog('Failed to copy error log:', error);
  }
}

async function clearErrorLog() {
  await new Promise((resolve) => {
    window.browserAPI.storage.local.set({ [LOADER_ERROR_STORAGE_KEY]: [] }, resolve);
  });

  const tabId = await getActiveTabId();
  if (tabId != null) {
    await window.browserAPI.tabs.sendMessage(tabId, { action: 'clearLoaderErrors' }).catch(() => null);
  }

  await window.browserAPI.runtime.sendMessage({ action: 'clearLoaderErrors' }).catch(() => null);
  await refreshErrorLogPanel();
}


// =============================================================================
// 10. Version & Patch Notes Data
// =============================================================================

async function updateVersionDisplay() {
  const versionElement = document.getElementById('version-display');
  if (!versionElement) return null;

  // Set loading text first
  const loadingText = getTranslationSync('popup.versionLoading', 'Version loading...');
  versionElement.textContent = loadingText;

  try {
    const manifest = await window.browserAPI.runtime.getManifest();
    const versionText = getTranslationSync('popup.version', 'Version');
    versionElement.textContent = `${versionText} ${manifest.version}`;
    return manifest.version;
  } catch (error) {
    console.error('Failed to load manifest version:', error);
    const versionText = getTranslationSync('popup.version', 'Version');
    versionElement.textContent = `${versionText} unknown`;
    return null;
  }
}

async function loadPatchNotes() {
  try {
    const response = await fetch(chrome.runtime.getURL('docs/patch-notes.json'));
    if (response.ok) {
      const data = await response.json();
      // Handle both old array format and new object format with metadata
      PATCH_NOTES = Array.isArray(data) ? data : (data.notes || []);
      return PATCH_NOTES;
    }
  } catch (error) {
    originalConsoleLog('Error loading patch notes:', error);
  }
  return [];
}

// Keep original console.log for popup use


// =============================================================================
// 11. Mods (Load / Render / Filter)
// =============================================================================

function extractGistHash(input) {
  // Gist hash (at least 8 hex chars)
  if (/^[a-f0-9]{8,}$/i.test(input)) {
    return input;
  }
  // Gist URL
  const match = input.match(/gist\.github\.com\/(?:[\w-]+\/)?([a-f0-9]{8,})/i);
  if (match) {
    return match[1];
  }
  return null;
}


// Function to load debug mode from storage

async function loadLocalMods() {
  const generation = ++loadLocalModsGeneration;
  isLoadingMods = true;
  try {
    const response = await window.browserAPI.runtime.sendMessage({ action: 'getLocalMods' });
    if (generation !== loadLocalModsGeneration) return;
    const mods = response && response.success ? response.mods : [];
    await renderLocalMods(mods);
  } catch (error) {
    if (generation === loadLocalModsGeneration) {
      showError('Error loading local mods: ' + error.message);
    }
  } finally {
    if (generation === loadLocalModsGeneration) {
      isLoadingMods = false;
    }
  }
}

// Store all mods for filtering

function normalizeModName(name) {
  return name.replace(/\s+/g, '').toLowerCase();
}

function getModCategory(mod) {
  const modFileName = mod.name.split('/').pop();
  if (mod.type === 'manual') return 'custom';
  if (otModNames.some(n => normalizeModName(n) === normalizeModName(modFileName))) return 'ot';
  if (superModNames.some(n => normalizeModName(n) === normalizeModName(modFileName))) return 'super';
  return 'official';
}

const CATEGORY_FILTER_LABELS = {
  official: { key: 'popup.categoryOfficial', fallback: 'Original Mods' },
  super: { key: 'popup.categorySuper', fallback: 'SuperMods' },
  ot: { key: 'popup.categoryOt', fallback: 'OT Mods' },
  custom: { key: 'popup.categoryCustom', fallback: 'Custom Mods' }
};

function getModDisplayName(mod) {
  const modFileName = mod.name.split('/').pop();
  if (mod.displayName && !mod.displayName.includes('/')) {
    return mod.displayName;
  }
  return modFileName.replace('.js', '').replace(/_/g, ' ');
}

async function getModDescription(mod) {
  const displayName = getModDisplayName(mod);
  // Try to get translation first
  const translationKey = `popup.modDescriptions.${displayName}`;
  const translatedDescription = await getTranslation(translationKey);
  if (translatedDescription) {
    return translatedDescription;
  }
  // Fallback to hardcoded English descriptions
  if (modDescriptions[displayName]) {
    return modDescriptions[displayName];
  }
  // Final fallback with translation
  const defaultDesc = await getTranslation('popup.modDescriptions.defaultDescription', `Enhance your Bestiary Arena experience with ${displayName}.`);
  return defaultDesc.replace('{name}', displayName);
}

async function getCategoryDisplayName(category) {
  const meta = CATEGORY_FILTER_LABELS[category];
  if (!meta) return category;
  return (await getTranslation(meta.key)) || meta.fallback;
}

async function createModCard(mod) {
  const modCard = document.createElement('div');
  modCard.className = 'mod-card';
  if (mod.enabled) {
    modCard.classList.add('enabled');
  }
  modCard.dataset.name = mod.name;
  modCard.dataset.category = getModCategory(mod);

  const category = getModCategory(mod);
  const displayName = getModDisplayName(mod);
  const description = await getModDescription(mod);

  // Header with title and category badge
  const header = document.createElement('div');
  header.className = 'mod-card-header';

  const title = document.createElement('h3');
  title.className = 'mod-card-title';
  title.textContent = displayName;

  const categoryBadge = document.createElement('span');
  categoryBadge.className = `mod-card-category ${category}`;
  categoryBadge.textContent = await getCategoryDisplayName(category);

  header.appendChild(title);
  header.appendChild(categoryBadge);

  // Description
  const desc = document.createElement('p');
  desc.className = 'mod-card-description';
  desc.textContent = description;

  const authorProfileUrl = modAuthorProfileUrls[displayName];
  let authorCredit = null;
  if (authorProfileUrl) {
    authorCredit = document.createElement('a');
    authorCredit.className = 'mod-card-author-credit';
    authorCredit.href = authorProfileUrl;
    authorCredit.target = '_blank';
    authorCredit.rel = 'noopener noreferrer';
    authorCredit.textContent = await getTranslation('mods.betterBestiary.authorCredit', 'by megafuji');
  }

  // Footer with toggle and delete
  const footer = document.createElement('div');
  footer.className = 'mod-card-footer';

  const toggleContainer = document.createElement('div');
  toggleContainer.className = 'mod-card-toggle';

  const toggleLabel = document.createElement('span');
  toggleLabel.className = 'mod-card-toggle-label';
  const onText = await getTranslation('popup.on', 'ON');
  const offText = await getTranslation('popup.off', 'OFF');
  toggleLabel.textContent = mod.enabled ? onText : offText;

  const toggleSwitch = document.createElement('label');
  toggleSwitch.className = 'toggle-switch';

  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.checked = mod.enabled;
  toggleInput.addEventListener('change', async () => {
    await toggleLocalMod(mod.name, toggleInput.checked);
    const onText = await getTranslation('popup.on', 'ON');
    const offText = await getTranslation('popup.off', 'OFF');
    toggleLabel.textContent = toggleInput.checked ? onText : offText;
    if (toggleInput.checked) {
      modCard.classList.add('enabled');
    } else {
      modCard.classList.remove('enabled');
    }
    // Update mod enabled state for counts
    mod.enabled = toggleInput.checked;
    await updateCategoryCounts(allMods);
  });

  const slider = document.createElement('span');
  slider.className = 'slider';

  toggleSwitch.appendChild(toggleInput);
  toggleSwitch.appendChild(slider);
  toggleContainer.appendChild(toggleLabel);
  toggleContainer.appendChild(toggleSwitch);

  footer.appendChild(toggleContainer);

  // Add delete button for user-generated mods
  if (mod.type === 'manual') {
    const deleteButton = document.createElement('button');
    deleteButton.className = 'mod-card-delete';
    deleteButton.innerHTML = '×';
    const deleteText = await getTranslation('popup.deleteMod', 'Delete mod');
    deleteButton.setAttribute('aria-label', deleteText);
    deleteButton.setAttribute('title', deleteText);
    deleteButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const modName = mod.originalName || mod.displayName || mod.name.split('/').pop().replace('.js', '');
      const confirmMsg = await getTranslation('popup.messages.deleteConfirm', `Are you sure you want to delete "${modName}"?`);
      if (confirm(confirmMsg.replace('{name}', modName))) {
        await deleteManualMod(mod.originalName || mod.displayName || mod.name.split('/').pop().replace('.js', ''));
      }
    });
    footer.appendChild(deleteButton);
  }

  modCard.appendChild(header);
  modCard.appendChild(desc);
  if (authorCredit) {
    modCard.appendChild(authorCredit);
  }
  modCard.appendChild(footer);

  return modCard;
}

async function updateCategoryCounts(mods) {
  if (!mods || mods.length === 0) {
    fitCategoryFilterLabels();
    return;
  }

  const visibleMods = mods.filter(mod => {
    const modFileName = mod.name.split('/').pop();
    return !hiddenMods.some(hidden =>
      normalizeModName(hidden) === normalizeModName(modFileName)
    );
  });

  const counts = {
    official: { total: 0, enabled: 0 },
    super: { total: 0, enabled: 0 },
    ot: { total: 0, enabled: 0 },
    custom: { total: 0, enabled: 0 }
  };

  visibleMods.forEach(mod => {
    const category = getModCategory(mod);
    if (counts[category] !== undefined) {
      counts[category].total++;
      if (mod.enabled) counts[category].enabled++;
    }
  });

  for (const [category, meta] of Object.entries(CATEGORY_FILTER_LABELS)) {
    const filter = document.querySelector(`.category-filter[data-category="${category}"]`);
    if (!filter) continue;
    const categoryText = (await getTranslation(meta.key)) || meta.fallback;
    const { total, enabled } = counts[category];
    filter.textContent = total > 0 ? `${categoryText} (${enabled}/${total})` : categoryText;
  }

  fitCategoryFilterLabels();
}

function fitCategoryFilterLabels() {
  const buttons = document.querySelectorAll('.category-filter');
  if (!buttons.length) return;

  const applyFit = () => {
    buttons.forEach((btn) => {
      if (btn.offsetParent === null && btn.clientWidth === 0) return;
      const maxSize = 11;
      const minSize = 7;
      let size = maxSize;
      btn.style.fontSize = `${size}px`;
      // Shrink until the label fits the equal-width tab
      while (size > minSize && btn.scrollWidth > btn.clientWidth + 1) {
        size -= 0.5;
        btn.style.fontSize = `${size}px`;
      }
    });
  };

  requestAnimationFrame(() => requestAnimationFrame(applyFit));
}

async function renderLocalMods(mods) {
  const modsGrid = document.getElementById('mods-grid');
  const emptyState = document.getElementById('empty-state');

  if (!modsGrid) return;

  modsGrid.innerHTML = '';

  if (!mods || mods.length === 0) {
    emptyState.style.display = 'block';
    await updateCategoryCounts([]);
    return;
  }

  // Filter out hidden mods
  const visibleMods = mods.filter(mod => {
    const modFileName = mod.name.split('/').pop();
    return !hiddenMods.some(hidden => 
      normalizeModName(hidden) === normalizeModName(modFileName)
    );
  });

  // Store all mods for filtering
  allMods = visibleMods;

  // Update category counts
  await updateCategoryCounts(visibleMods);

  // Render all mods
  for (const mod of visibleMods) {
    const modCard = await createModCard(mod);
    modsGrid.appendChild(modCard);
  }

  emptyState.style.display = visibleMods.length === 0 ? 'block' : 'none';
  
  // Apply current filters
  applyFilters();
}

// Filter functionality

function applyFilters() {
  const modsGrid = document.getElementById('mods-grid');
  const emptyState = document.getElementById('empty-state');
  
  if (!modsGrid) return;

  const searchTerm = currentSearchTerm.toLowerCase();
  const category = currentCategory;

  const cards = modsGrid.querySelectorAll('.mod-card');
  let visibleCount = 0;

  cards.forEach(card => {
    const modName = card.querySelector('.mod-card-title').textContent.toLowerCase();
    const cardCategory = card.dataset.category;
    
    const matchesSearch = !searchTerm || modName.includes(searchTerm);
    const matchesCategory = category === 'all' || cardCategory === category;

    if (matchesSearch && matchesCategory) {
      card.style.display = 'flex';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });

  emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
}

async function toggleLocalMod(name, enabled) {
  try {
    const tabId = await getActiveTabId();
    const response = await window.browserAPI.runtime.sendMessage({
      action: 'toggleLocalMod',
      name,
      enabled,
      tabId
    });
    
    if (!response.success) {
      showError(response.error || 'Unknown error occurred');
      loadLocalMods();
    }
  } catch (error) {
    showError(`Communication error: ${error.message}`);
    loadLocalMods();
  }
}

async function deleteManualMod(modName) {
  try {
    let mods = await getManualMods();
    // Manual mods are stored with just the name (not the full path)
    // The modName passed here is the originalName from the mod object
    const initialLength = mods.length;
    mods = mods.filter(mod => mod.name !== modName);
    
    if (mods.length === initialLength) {
      // If no match found, the mod might have been deleted already
      originalConsoleLog('Mod not found in storage, may have been already deleted');
    }
    
    await saveManualMods(mods);
    originalConsoleLog('Manual mod deleted successfully');
    await loadLocalMods();
    await updateStorageUsage();
  } catch (error) {
    originalConsoleLog('Error deleting manual mod:', error);
    showError(`Failed to delete mod: ${error.message}`);
  }
}

function showError(message) {
  alert(message);
}


// =============================================================================
// 12. Initialization
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupPopupResponsiveLayout();

  // Load translations first
  await loadAndApplyTranslations();
  
  // Load patch notes
  await loadPatchNotes();
  
  // === PATCH NOTES ===
  async function getLastViewedVersion() {
    try {
      if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
        const result = await new Promise(resolve => {
          window.browserAPI.storage.local.get([PATCH_NOTES_STORAGE_KEY], resolve);
        });
        return result[PATCH_NOTES_STORAGE_KEY] || null;
      } else {
        return localStorage.getItem(PATCH_NOTES_STORAGE_KEY);
      }
    } catch (error) {
      originalConsoleLog('Error getting last viewed version:', error);
      return null;
    }
  }

  async function setLastViewedVersion(version) {
    try {
      if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
        await new Promise(resolve => {
          window.browserAPI.storage.local.set({ [PATCH_NOTES_STORAGE_KEY]: version }, resolve);
        });
      } else {
        localStorage.setItem(PATCH_NOTES_STORAGE_KEY, version);
      }
    } catch (error) {
      originalConsoleLog('Error setting last viewed version:', error);
    }
  }

  function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    return 0;
  }

  function getSortedPatchNoteVersions() {
    return [...new Set(PATCH_NOTES.map(note => note.version).filter(Boolean))]
      .sort((a, b) => compareVersions(b, a));
  }

  function updatePatchNotesVersionNavigationUI(versions, activeIndex) {
    const versionLabel = document.getElementById('patch-notes-version-label');
    const prevButton = document.getElementById('patch-notes-prev');
    const nextButton = document.getElementById('patch-notes-next');
    if (!versionLabel || !prevButton || !nextButton) return;

    const versionText = getTranslationSync('popup.version', 'Version');
    const activeVersion = versions[activeIndex];
    versionLabel.textContent = activeVersion ? `${versionText} ${activeVersion}` : `${versionText} -`;
    prevButton.disabled = activeIndex >= versions.length - 1;
    nextButton.disabled = activeIndex <= 0;
  }

  let patchNoteVersions = [];
  let currentPatchNotesVersionIndex = 0;

  async function renderPatchNotes(currentVersion, requestedVersion = null) {
    const patchNotesContainer = document.getElementById('patch-notes');
    const patchNotesContent = document.getElementById('patch-notes-content');
    
    if (!patchNotesContainer || !patchNotesContent) return;

    // Ensure patch notes are loaded
    if (PATCH_NOTES.length === 0) {
      await loadPatchNotes();
    }

    patchNoteVersions = getSortedPatchNoteVersions();
    if (patchNoteVersions.length === 0) {
      updatePatchNotesVersionNavigationUI([], 0);
      setPatchNotesVisible(patchNotesContainer, false);
      return;
    }

    const defaultVersion = patchNoteVersions.includes(currentVersion)
      ? currentVersion
      : patchNoteVersions[0];
    const activeVersion = requestedVersion && patchNoteVersions.includes(requestedVersion)
      ? requestedVersion
      : defaultVersion;
    currentPatchNotesVersionIndex = Math.max(0, patchNoteVersions.indexOf(activeVersion));
    updatePatchNotesVersionNavigationUI(patchNoteVersions, currentPatchNotesVersionIndex);

    // Get patch notes for selected version only
    const relevantNotes = PATCH_NOTES.filter(note => note.version === activeVersion);

    if (relevantNotes.length === 0) {
      setPatchNotesVisible(patchNotesContainer, false);
      return;
    }

    // Build HTML
    let html = '';
    // Define type order for sorting / section display
    const typeOrder = { 'added': 0, 'changed': 1, 'removed': 2, 'fixed': 3 };
    const useModGroupedLayout = (version) => compareVersions(version || '0', '4.6.0') >= 0;

    function escapePatchHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function buildLegacyPatchEntriesHtml(note, sanitizedVersion) {
      let entriesHtml = '';
      const sortedChanges = [...note.changes].sort((a, b) => {
        const orderA = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 999;
        const orderB = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 999;
        if (orderA !== orderB) return orderA - orderB;
        const modA = (a.mod || '').toLowerCase();
        const modB = (b.mod || '').toLowerCase();
        if (modA !== modB) return modA.localeCompare(modB);
        return (a.text || '').localeCompare(b.text || '');
      });
      sortedChanges.forEach((change, index) => {
        const changeMod = escapePatchHtml(change.mod || 'General');
        const changeType = change.type || 'changed';
        const changeTypeLabel = escapePatchHtml(changeType.charAt(0).toUpperCase() + changeType.slice(1));
        const changeText = escapePatchHtml(change.text || '');
        const entryId = `patch-note-${sanitizedVersion}-${index}`;
        entriesHtml += `
          <li class="patch-note-entry ${escapePatchHtml(changeType)}">
            <button class="patch-note-toggle" type="button" aria-expanded="false" aria-controls="${entryId}">
              <span class="patch-note-summary patch-note-summary-legacy">
                <span class="patch-note-summary-mod">${changeMod}</span>
                <span class="patch-note-summary-separator">|</span>
                <span class="patch-note-summary-type">${changeTypeLabel}</span>
              </span>
              <span class="patch-note-chevron">▼</span>
            </button>
            <div id="${entryId}" class="patch-note-details" hidden>${changeText}</div>
          </li>
        `;
      });
      return entriesHtml;
    }

    function buildModGroupedPatchEntriesHtml(note, sanitizedVersion) {
      let entriesHtml = '';
      const byMod = new Map();
      for (const change of note.changes || []) {
        const modName = change.mod || 'General';
        if (!byMod.has(modName)) byMod.set(modName, []);
        byMod.get(modName).push(change);
      }

      const sortedMods = [...byMod.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      sortedMods.forEach((modName, index) => {
        const modChanges = [...byMod.get(modName)].sort((a, b) => {
          const orderA = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 999;
          const orderB = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 999;
          if (orderA !== orderB) return orderA - orderB;
          return (a.text || '').localeCompare(b.text || '');
        });

        const typeSections = [];
        for (const change of modChanges) {
          const changeType = change.type || 'changed';
          const changeTypeLabel = changeType.charAt(0).toUpperCase() + changeType.slice(1);
          const changeText = escapePatchHtml(change.text || '');
          typeSections.push(`
            <div class="patch-note-type-block ${escapePatchHtml(changeType)}">
              <div class="patch-note-type-separator">
                <span class="patch-note-type-label">${escapePatchHtml(changeTypeLabel)}</span>
              </div>
              <div class="patch-note-type-text">${changeText}</div>
            </div>
          `);
        }

        const entryId = `patch-note-${sanitizedVersion}-mod-${index}`;
        const presentTypes = [...new Set(modChanges.map((c) => c.type || 'changed'))]
          .sort((a, b) => (typeOrder[a] ?? 999) - (typeOrder[b] ?? 999));
        const typeHint = presentTypes
          .map((type) => {
            const label = type.charAt(0).toUpperCase() + type.slice(1);
            return `<span class="patch-note-summary-type-chip ${escapePatchHtml(type)}">${escapePatchHtml(label)}</span>`;
          })
          .join('<span class="patch-note-summary-separator">|</span>');

        entriesHtml += `
          <li class="patch-note-entry patch-note-entry-mod">
            <button class="patch-note-toggle" type="button" aria-expanded="false" aria-controls="${entryId}">
              <span class="patch-note-summary patch-note-summary-mod-grouped">
                <span class="patch-note-summary-mod">${escapePatchHtml(modName)}</span>
                <span class="patch-note-summary-type-chips">${typeHint}</span>
              </span>
              <span class="patch-note-chevron">▼</span>
            </button>
            <div id="${entryId}" class="patch-note-details patch-note-details-mod" hidden>${typeSections.join('')}</div>
          </li>
        `;
      });
      return entriesHtml;
    }
    
    for (const note of relevantNotes) {
      html += `<div class="patch-note-version">`;
      const versionText = await getTranslation('popup.version', 'Version');
      html += `<div class="patch-note-version-title">${versionText} ${note.version}</div>`;
      html += `<ul class="patch-note-list">`;
      const sanitizedVersion = String(note.version || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '-');
      if (useModGroupedLayout(note.version)) {
        html += buildModGroupedPatchEntriesHtml(note, sanitizedVersion);
      } else {
        html += buildLegacyPatchEntriesHtml(note, sanitizedVersion);
      }
      html += `</ul></div>`;
    }

    patchNotesContent.innerHTML = html;

    const patchNoteToggles = patchNotesContent.querySelectorAll('.patch-note-toggle');
    patchNoteToggles.forEach(toggle => {
      toggle.addEventListener('click', () => {
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        const detailsId = toggle.getAttribute('aria-controls');
        const detailsElement = detailsId ? document.getElementById(detailsId) : null;
        if (!detailsElement) return;

        toggle.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
        detailsElement.hidden = isExpanded;
      });
    });

  }

  async function navigatePatchNotesVersion(delta) {
    if (!patchNoteVersions.length) return;
    const targetIndex = currentPatchNotesVersionIndex + delta;
    if (targetIndex < 0 || targetIndex >= patchNoteVersions.length) return;
    currentPatchNotesVersionIndex = targetIndex;
    const currentVersion = await updateVersionDisplay();
    await renderPatchNotes(currentVersion || patchNoteVersions[0], patchNoteVersions[currentPatchNotesVersionIndex]);
  }

  async function checkAndShowPatchNotes() {
    try {
      const currentVersion = await updateVersionDisplay();
      if (!currentVersion) return;

      const lastViewedVersion = await getLastViewedVersion();
      
      // Show patch notes if:
      // 1. No last viewed version (first time)
      // 2. Current version is newer than last viewed
      if (!lastViewedVersion || compareVersions(currentVersion, lastViewedVersion) > 0) {
        await renderPatchNotes(currentVersion);
        const patchNotesContainer = document.getElementById('patch-notes');
        if (patchNotesContainer) {
          setPatchNotesVisible(patchNotesContainer, true);
        }
      } else {
        // Still render but don't show (user can manually open if needed)
        await renderPatchNotes(currentVersion);
      }
    } catch (error) {
      originalConsoleLog('Error checking patch notes:', error);
    }
  }


  setupPopupStorageAndLifecycle();

  // Load debug mode and set up toggle
  await loadDebugMode();
  
  // Set up debug toggle event listener
  const debugToggle = document.getElementById('debug-toggle');
  if (debugToggle) {
    originalConsoleLog('Debug toggle found, setting up event listener');
    debugToggle.addEventListener('change', (e) => {
      originalConsoleLog('Debug toggle changed to:', e.target.checked);
      updateDebugMode(e.target.checked);
    });
  } else {
    originalConsoleLog('Debug toggle not found in DOM');
  }
  
  // Load outfiter mode and set up toggle
  await loadOutfiterMode();
  
  // Set up outfiter toggle event listener
  const outfiterToggle = document.getElementById('outfiter-toggle');
  if (outfiterToggle) {
    originalConsoleLog('Outfiter toggle found, setting up event listener');
    outfiterToggle.addEventListener('change', (e) => {
      originalConsoleLog('Outfiter toggle changed to:', e.target.checked);
      updateOutfiterMode(e.target.checked);
    });
  } else {
    originalConsoleLog('Outfiter toggle not found in DOM');
  }

  // Color mode (light default)
  applyColorMode(getStoredColorMode());
  await refreshToggleStatusLabels();
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', (e) => {
      applyColorMode(e.target.checked ? 'dark' : 'light');
    });
  }
  
  // Load welcome page mode and set up button
  await loadWelcomeMode();
  
  // Set up enable welcome button event listener
  const enableWelcomeBtn = document.getElementById('enable-welcome-btn');
  if (enableWelcomeBtn) {
    originalConsoleLog('Enable welcome button found, setting up event listener');
    
    // Add click animation
    enableWelcomeBtn.addEventListener('mousedown', () => {
      enableWelcomeBtn.style.filter = 'brightness(0.95)';
    });
    
    enableWelcomeBtn.addEventListener('mouseup', () => {
      enableWelcomeBtn.style.filter = '';
    });
    
    enableWelcomeBtn.addEventListener('mouseleave', () => {
      enableWelcomeBtn.style.filter = '';
    });
    
    enableWelcomeBtn.addEventListener('click', () => {
      originalConsoleLog('Enable welcome button clicked');
      enableWelcomePage();
    });
  } else {
    originalConsoleLog('Enable welcome button not found in DOM');
  }
  
  // Set up script import form handler
  const hashForm = document.getElementById('hash-form');
  const hashInput = document.getElementById('hash-input');
  const nameInput = document.getElementById('name-input');
  
  if (hashForm) {
    hashForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      const hashInputValue = hashInput.value.trim();
      const name = nameInput.value.trim() || 'Imported Script';
      const gistHash = extractGistHash(hashInputValue);
      
      if (!gistHash) {
        const errorMsg = await getTranslation('form.hashPlaceholder', 'Please enter a valid GitHub Gist hash or Gist URL.');
        alert(errorMsg);
        return;
      }
      
      if (!await ensureGitHubHostAccess()) {
        const errorMsg = await getTranslation(
          'messages.githubPermissionRequired',
          'GitHub access is required to import remote mods. Allow it in the browser prompt, then try again.'
        );
        alert(errorMsg);
        return;
      }

      const url = `https://gist.githubusercontent.com/raw/${gistHash}`;
      let scriptContent = '';
      
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
          scriptContent = await response.text();
        }
      } catch (e) {
        originalConsoleLog('Error fetching script:', e);
      }
      
      if (!scriptContent) {
        const errorMsg = await getTranslation('messages.errorLoadingScripts', 'Failed to fetch script content. Check the Gist hash/URL and your internet connection.');
        alert(errorMsg);
        return;
      }
      
      try {
        let mods = await getManualMods();
        mods.push({ name, content: scriptContent, enabled: true });
        await saveManualMods(mods);
        hashInput.value = '';
        nameInput.value = '';
        originalConsoleLog('Script imported successfully!');
        await loadLocalMods();
        // Update storage usage after import
        await updateStorageUsage();
      } catch (e) {
        originalConsoleLog('Failed to save script:', e);
        const errorMsg = await getTranslation('popup.messages.failedToSaveScript', 'Failed to save script.');
        alert(errorMsg);
      }
    });
  }
  
  // Update version display and check patch notes
  await checkAndShowPatchNotes();
  
  // Set up patch notes close button
  const patchNotesClose = document.querySelector('.patch-notes-close');
  if (patchNotesClose) {
    patchNotesClose.addEventListener('click', async () => {
      const patchNotesContainer = document.getElementById('patch-notes');
      if (patchNotesContainer) {
        setPatchNotesVisible(patchNotesContainer, false);
        // Mark current version as viewed
        const currentVersion = await updateVersionDisplay();
        if (currentVersion) {
          await setLastViewedVersion(currentVersion);
        }
      }
    });
  }

  // Set up show patch notes button in extras
  const showPatchNotesBtn = document.getElementById('show-patch-notes-btn');
  if (showPatchNotesBtn) {
    showPatchNotesBtn.addEventListener('click', async () => {
      const currentVersion = await updateVersionDisplay();
      if (currentVersion) {
        await renderPatchNotes(currentVersion);
        const patchNotesContainer = document.getElementById('patch-notes');
        if (patchNotesContainer) {
          setPatchNotesVisible(patchNotesContainer, true);
          // Scroll to top to show patch notes
          patchNotesContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  const patchNotesPrevBtn = document.getElementById('patch-notes-prev');
  if (patchNotesPrevBtn) {
    patchNotesPrevBtn.addEventListener('click', async () => {
      await navigatePatchNotesVersion(1);
    });
  }

  const patchNotesNextBtn = document.getElementById('patch-notes-next');
  if (patchNotesNextBtn) {
    patchNotesNextBtn.addEventListener('click', async () => {
      await navigatePatchNotesVersion(-1);
    });
  }

  const copyErrorLogBtn = document.getElementById('copy-error-log-btn');
  if (copyErrorLogBtn) {
    copyErrorLogBtn.addEventListener('click', copyErrorLog);
  }

  const clearErrorLogBtn = document.getElementById('clear-error-log-btn');
  if (clearErrorLogBtn) {
    clearErrorLogBtn.addEventListener('click', clearErrorLog);
  }

  const debugSection = document.querySelector('[data-section="debug"]');
  if (debugSection) {
    debugSection.addEventListener('toggle', () => {
      if (debugSection.open) {
        refreshErrorLogPanel();
      }
    });
  }
  
  // Update storage usage display
  await updateStorageUsage();
  
  await loadLocalMods();
  
  // Set up search and filter functionality
  const searchInput = document.getElementById('mod-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value;
      applyFilters();
    });
  }

  const categoryFilters = document.querySelectorAll('.category-filter');
  categoryFilters.forEach(filter => {
    filter.addEventListener('click', () => {
      // Remove active class from all filters
      categoryFilters.forEach(f => f.classList.remove('active'));
      // Add active class to clicked filter
      filter.classList.add('active');
      // Update current category
      currentCategory = filter.dataset.category;
      applyFilters();
    });
  });
  
  // Language / permissions (former second DOMContentLoaded)
  initializeLanguageToggle();
  ensureGitHubHostAccess().catch(error => {
    originalConsoleLog('GitHub optional permission prompt skipped:', error);
  });
});
