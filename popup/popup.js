/**
 * Popup Script for Bestiary Arena Mod Loader
 * 
 * IMPORTANT: When adding a new mod, update the static mod lists in this file!
 * Popup cannot load ES6 modules, so we maintain static lists that must be kept in sync with:
 * - content/mod-registry.js (the source of truth)
 * 
 * Search for "kept in sync with mod-registry.js" to find the lists to update.
 */

// Polyfill for Chrome and Firefox WebExtensions
if (typeof window.browser === 'undefined') {
  window.browser = window.chrome;
}

window.browserAPI = window.browserAPI || (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

// Global Debug System for Mod Console Logs
const DEBUG_STORAGE_KEY = 'bestiary-debug';
let DEBUG_MODE = false;

// Global Outfiter System
const OUTFITER_STORAGE_KEY = 'outfiter-enabled';
let OUTFITER_ENABLED = false;

// Global Welcome Page System
const WELCOME_STORAGE_KEY = 'welcome-enabled';
let WELCOME_ENABLED = true;

// Patch Notes System
// NOTE: Keep patch notes simple and concise. Consolidate similar changes into single entries.
// Only show patch notes for the current version in the popup.
const PATCH_NOTES_STORAGE_KEY = 'last-viewed-version';
let PATCH_NOTES = [];

// Load patch notes from JSON file
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
const originalConsoleLog = console.log;

// Function to update debug mode
async function updateDebugMode(enabled) {
  DEBUG_MODE = enabled;
  
  // Save to localStorage (shared with content script)
  localStorage.setItem(DEBUG_STORAGE_KEY, enabled.toString());
  
  // Update UI
  const debugToggle = document.getElementById('debug-toggle');
  const debugStatus = document.getElementById('debug-status');
  if (debugToggle) {
    debugToggle.checked = enabled;
  }
  if (debugStatus) {
    const onText = await getTranslation('popup.on', 'ON');
    const offText = await getTranslation('popup.off', 'OFF');
    debugStatus.textContent = enabled ? onText : offText;
  }
  
  // Send message to content script to update debug flag
  try {
    const [tab] = await window.browserAPI.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes('bestiaryarena.com')) {
      // Send to content script
      await window.browserAPI.tabs.sendMessage(tab.id, {
        action: 'updateDebugMode',
        enabled: enabled
      });
      
      // Also send to page context
      if (window.browserAPI.scripting && window.browserAPI.scripting.executeScript) {
        // Chrome Manifest V3 - use scripting API
        await window.browserAPI.scripting.executeScript({
          target: { tabId: tab.id },
          func: (enabled) => {
            window.BESTIARY_DEBUG = enabled;
            localStorage.setItem('bestiary-debug', enabled.toString());
            window.postMessage({
              from: 'BESTIARY_EXTENSION',
              action: 'updateDebugMode',
              enabled: enabled
            }, '*');
          },
          args: [enabled]
        });
      } else if (window.browserAPI.tabs && window.browserAPI.tabs.executeScript) {
        // Firefox fallback - use tabs API
        await window.browserAPI.tabs.executeScript(tab.id, {
          code: `
            window.BESTIARY_DEBUG = ${enabled};
            localStorage.setItem('bestiary-debug', '${enabled}');
            window.postMessage({
              from: 'BESTIARY_EXTENSION',
              action: 'updateDebugMode',
              enabled: ${enabled}
            }, '*');
          `
        });
      }
    }
  } catch (error) {
    originalConsoleLog('Could not send debug mode to content script:', error);
  }
  
  // Always show debug mode changes
  originalConsoleLog('Mod debug mode:', enabled ? 'enabled' : 'disabled');
}

// Function to update outfiter mode
async function updateOutfiterMode(enabled) {
  OUTFITER_ENABLED = enabled;
  
  // Save to localStorage (shared with content script)
  localStorage.setItem(OUTFITER_STORAGE_KEY, enabled.toString());
  
  // Update UI
  const outfiterToggle = document.getElementById('outfiter-toggle');
  const outfiterStatus = document.getElementById('outfiter-status');
  if (outfiterToggle) {
    outfiterToggle.checked = enabled;
  }
  if (outfiterStatus) {
    const onText = await getTranslation('popup.on', 'ON');
    const offText = await getTranslation('popup.off', 'OFF');
    outfiterStatus.textContent = enabled ? onText : offText;
  }
  
  // Send message to content script to update outfiter flag
  try {
    const [tab] = await window.browserAPI.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes('bestiaryarena.com')) {
      // Send to content script
      await window.browserAPI.tabs.sendMessage(tab.id, {
        action: 'updateOutfiterMode',
        enabled: enabled
      });
      
      // Also send to page context
      if (window.browserAPI.scripting && window.browserAPI.scripting.executeScript) {
        // Chrome Manifest V3 - use scripting API
        await window.browserAPI.scripting.executeScript({
          target: { tabId: tab.id },
          func: (enabled) => {
            window.OUTFITER_ENABLED = enabled;
            localStorage.setItem('outfiter-enabled', enabled.toString());
            window.postMessage({
              from: 'BESTIARY_EXTENSION',
              action: 'updateOutfiterMode',
              enabled: enabled
            }, '*');
          },
          args: [enabled]
        });
      } else if (window.browserAPI.tabs && window.browserAPI.tabs.executeScript) {
        // Firefox fallback - use tabs API
        await window.browserAPI.tabs.executeScript(tab.id, {
          code: `
            window.OUTFITER_ENABLED = ${enabled};
            localStorage.setItem('outfiter-enabled', '${enabled}');
            window.postMessage({
              from: 'BESTIARY_EXTENSION',
              action: 'updateOutfiterMode',
              enabled: ${enabled}
            }, '*');
          `
        });
      }
    }
  } catch (error) {
    originalConsoleLog('Could not send outfiter mode to content script:', error);
  }
  
  // Always show outfiter mode changes
  originalConsoleLog('Outfiter mode:', enabled ? 'enabled' : 'disabled');
}

// Function to enable welcome page
async function enableWelcomePage() {
  WELCOME_ENABLED = true;
  
  // Save to localStorage (shared with content script)
  localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
  
  // Send message to content script to update welcome flag
  try {
    const [tab] = await window.browserAPI.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes('bestiaryarena.com')) {
      // Send to content script
      await window.browserAPI.tabs.sendMessage(tab.id, {
        action: 'updateWelcomeMode',
        enabled: true
      });
      
      // Also send to page context
      if (window.browserAPI.scripting && window.browserAPI.scripting.executeScript) {
        // Chrome Manifest V3 - use scripting API
        await window.browserAPI.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            window.WELCOME_ENABLED = true;
            localStorage.setItem('welcome-enabled', 'true');
            window.postMessage({
              from: 'BESTIARY_EXTENSION',
              action: 'updateWelcomeMode',
              enabled: true
            }, '*');
          }
        });
      } else if (window.browserAPI.tabs && window.browserAPI.tabs.executeScript) {
        // Firefox fallback - use tabs API
        await window.browserAPI.tabs.executeScript(tab.id, {
          code: `
            window.WELCOME_ENABLED = true;
            localStorage.setItem('welcome-enabled', 'true');
            window.postMessage({
              from: 'BESTIARY_EXTENSION',
              action: 'updateWelcomeMode',
              enabled: true
            }, '*');
          `
        });
      }
    }
  } catch (error) {
    originalConsoleLog('Could not send welcome mode to content script:', error);
  }
  
  // Always show welcome mode changes
  originalConsoleLog('Welcome page enabled');
}

// Function to extract Gist hash from input (supports hash or full URL)
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
async function loadDebugMode() {
  try {
    DEBUG_MODE = localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
    
    // Update UI
    const debugToggle = document.getElementById('debug-toggle');
    const debugStatus = document.getElementById('debug-status');
    if (debugToggle) {
      debugToggle.checked = DEBUG_MODE;
    }
    if (debugStatus) {
      const onText = await getTranslation('popup.on', 'ON');
      const offText = await getTranslation('popup.off', 'OFF');
      debugStatus.textContent = DEBUG_MODE ? onText : offText;
    }
    
    // Always show debug mode loading
    originalConsoleLog('Mod debug mode loaded:', DEBUG_MODE ? 'enabled' : 'disabled');
  } catch (error) {
    originalConsoleLog.error('Failed to load debug mode:', error);
    DEBUG_MODE = false;
  }
}

// Function to load outfiter mode from storage
async function loadOutfiterMode() {
  try {
    OUTFITER_ENABLED = localStorage.getItem(OUTFITER_STORAGE_KEY) === 'true';
    
    // Update UI
    const outfiterToggle = document.getElementById('outfiter-toggle');
    const outfiterStatus = document.getElementById('outfiter-status');
    if (outfiterToggle) {
      outfiterToggle.checked = OUTFITER_ENABLED;
    }
    if (outfiterStatus) {
      const onText = await getTranslation('popup.on', 'ON');
      const offText = await getTranslation('popup.off', 'OFF');
      outfiterStatus.textContent = OUTFITER_ENABLED ? onText : offText;
    }
    
    // Always show outfiter mode loading
    originalConsoleLog('Outfiter mode loaded:', OUTFITER_ENABLED ? 'enabled' : 'disabled');
  } catch (error) {
    originalConsoleLog.error('Failed to load outfiter mode:', error);
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
    originalConsoleLog.error('Failed to load welcome page mode:', error);
    WELCOME_ENABLED = true; // Default to enabled on error
  }
}

const i18n = window.i18n;

const localModsContainer = document.getElementById('local-mods-container');

const MANUAL_MODS_KEY = 'manualMods';

// Translation cache
let translations = null;

// Load and apply translations
async function loadAndApplyTranslations() {
  try {
    translations = await window.LocalizationUtils.loadTranslations();
    await applyTranslations();
  } catch (error) {
    originalConsoleLog('Error loading translations:', error);
  }
}

// Apply translations to DOM elements
async function applyTranslations() {
  if (!translations) {
    translations = await window.LocalizationUtils.loadTranslations();
  }
  
  const t = async (path) => {
    return await window.LocalizationUtils.getLocalizedTextWithFallback('', path);
  };
  
  // Helper to get translation
  const getT = async (path, fallback) => {
    const translation = await window.LocalizationUtils.getTranslation(path);
    return translation || fallback;
  };
  
  // Apply translations
  const applyT = async (selector, path, attribute = 'textContent') => {
    const element = document.querySelector(selector);
    if (element) {
      const translation = await getT(path, element[attribute]);
      element[attribute] = translation;
    }
  };
  
  // Apply all translations
  await applyT('#mod-search', 'popup.searchPlaceholder', 'placeholder');
  await applyT('.category-filter[data-category="all"]', 'popup.categoryAll');
  await applyT('.category-filter[data-category="official"]', 'popup.categoryOfficial');
  await applyT('.category-filter[data-category="super"]', 'popup.categorySuper');
  await applyT('.category-filter[data-category="custom"]', 'popup.categoryCustom');
  await applyT('#empty-state p', 'popup.noModsFound');
  await applyT('.collapsible-header span:first-child', 'popup.addScript');
  await applyT('label[for="hash-input"]', 'popup.gistHashLabel');
  await applyT('#hash-input', 'popup.gistHashPlaceholder', 'placeholder');
  await applyT('.form-hint', 'popup.gistHashHelp');
  await applyT('label[for="name-input"]', 'popup.scriptNameLabel');
  await applyT('#name-input', 'popup.scriptNamePlaceholder', 'placeholder');
  await applyT('#hash-form button[type="submit"]', 'popup.addButton');
  await applyT('.external-link a', 'popup.findMoreMods');
  // Apply extras translation - find the second collapsible section
  const collapsibleSections = document.querySelectorAll('.collapsible-section');
  if (collapsibleSections.length > 1) {
    const extrasHeader = collapsibleSections[1].querySelector('.collapsible-header span:first-child');
    if (extrasHeader) {
      const extrasText = await getT('popup.extras', 'Extras');
      extrasHeader.textContent = extrasText;
    }
  }
  await applyT('label[for="debug-toggle"]', 'popup.debugMode');
  await applyT('#debug-status', 'popup.off');
  await applyT('.setting-item:has(#debug-toggle) .setting-description', 'popup.debugModeDescription');
  await applyT('#storage-usage', 'popup.storageCalculating');
  await applyT('label[for="outfiter-toggle"]', 'popup.outfiter');
  await applyT('#outfiter-status', 'popup.off');
  await applyT('.setting-item:has(#outfiter-toggle) .setting-description', 'popup.outfiterDescription');
  await applyT('.setting-item:has(#enable-welcome-btn) .setting-header label', 'popup.welcomePage');
  await applyT('#enable-welcome-btn', 'popup.enableWelcomePage');
  await applyT('.setting-item:has(#enable-welcome-btn) .setting-description', 'popup.welcomePageDescription');
  await applyT('.setting-item:has(#show-patch-notes-btn) .setting-header label', 'popup.patchNotes');
  await applyT('#show-patch-notes-btn', 'popup.viewPatchNotes');
  await applyT('.setting-item:has(#show-patch-notes-btn) .setting-description', 'popup.patchNotesDescription');
  await applyT('.patch-notes-title', 'popup.patchNotesTitle');
  await applyT('.patch-notes-close', 'popup.closePatchNotes', 'aria-label');
  
  // Update version display
  const versionElement = document.getElementById('version-display');
  if (versionElement && versionElement.textContent.includes('loading')) {
    const versionText = await getT('popup.versionLoading', 'Version loading...');
    versionElement.textContent = versionText;
  }
  
  // Update ON/OFF statuses (will be updated dynamically, but set initial)
  const debugStatus = document.getElementById('debug-status');
  const outfiterStatus = document.getElementById('outfiter-status');
  if (debugStatus) {
    const onText = await getT('popup.on', 'ON');
    const offText = await getT('popup.off', 'OFF');
    if (debugStatus.textContent === 'ON') debugStatus.textContent = onText;
    if (debugStatus.textContent === 'OFF') debugStatus.textContent = offText;
  }
  if (outfiterStatus) {
    const onText = await getT('popup.on', 'ON');
    const offText = await getT('popup.off', 'OFF');
    if (outfiterStatus.textContent === 'ON') outfiterStatus.textContent = onText;
    if (outfiterStatus.textContent === 'OFF') outfiterStatus.textContent = offText;
  }
}

// Helper function to get translation (for use in other functions)
async function getTranslation(path, fallback = '') {
  if (!translations) {
    translations = await window.LocalizationUtils.loadTranslations();
  }
  const translation = await window.LocalizationUtils.getTranslation(path);
  return translation || fallback;
}

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

// === STORAGE USAGE DISPLAY ===
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

document.addEventListener('DOMContentLoaded', async () => {
  // Load translations first
  await loadAndApplyTranslations();
  
  // Load patch notes
  await loadPatchNotes();
  
  // === VERSION DISPLAY ===
  async function updateVersionDisplay() {
    try {
      const manifest = await window.browserAPI.runtime.getManifest();
      const versionElement = document.getElementById('version-display');
      if (versionElement) {
        const versionText = await getTranslation('popup.version', 'Version');
        versionElement.textContent = `${versionText} ${manifest.version}`;
      }
      return manifest.version;
    } catch (error) {
      console.error('Failed to load manifest version:', error);
      const versionElement = document.getElementById('version-display');
      if (versionElement) {
        const versionText = await getTranslation('popup.version', 'Version');
        versionElement.textContent = `${versionText} unknown`;
      }
      return null;
    }
  }

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

  async function renderPatchNotes(currentVersion) {
    const patchNotesContainer = document.getElementById('patch-notes');
    const patchNotesContent = document.getElementById('patch-notes-content');
    
    if (!patchNotesContainer || !patchNotesContent) return;

    // Ensure patch notes are loaded
    if (PATCH_NOTES.length === 0) {
      await loadPatchNotes();
    }

    // Get patch notes for current version only
    const relevantNotes = PATCH_NOTES.filter(note => 
      note.version === currentVersion
    );

    if (relevantNotes.length === 0) {
      patchNotesContainer.style.display = 'none';
      return;
    }

    // Build HTML
    let html = '';
    // Define type order for sorting
    const typeOrder = { 'added': 0, 'changed': 1, 'removed': 2, 'fixed': 3 };
    
    for (const note of relevantNotes) {
      html += `<div class="patch-note-version">`;
      const versionText = await getTranslation('popup.version', 'Version');
      html += `<div class="patch-note-version-title">${versionText} ${note.version}</div>`;
      html += `<ul class="patch-note-list">`;
      // Sort changes by: 1. Type, 2. mod, 3. text
      const sortedChanges = [...note.changes].sort((a, b) => {
        // 1. Sort by type
        const orderA = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 999;
        const orderB = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 999;
        if (orderA !== orderB) return orderA - orderB;
        
        // 2. Sort by mod (if both have mod field)
        const modA = (a.mod || '').toLowerCase();
        const modB = (b.mod || '').toLowerCase();
        if (modA !== modB) return modA.localeCompare(modB);
        
        // 3. Sort by text
        return (a.text || '').localeCompare(b.text || '');
      });
      sortedChanges.forEach(change => {
        const modBadge = change.mod ? `<span class="patch-note-mod">${change.mod}</span>` : '';
        html += `<li class="${change.type}">${modBadge}${change.text}</li>`;
      });
      html += `</ul></div>`;
    }

    patchNotesContent.innerHTML = html;
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
          patchNotesContainer.style.display = 'block';
        }
      } else {
        // Still render but don't show (user can manually open if needed)
        await renderPatchNotes(currentVersion);
      }
    } catch (error) {
      originalConsoleLog('Error checking patch notes:', error);
    }
  }


  // === THEME SYNC (uses dashboard-theme storage key for compatibility) ===
  function applyPopupTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName || 'default');
  }

  // On load, apply theme from storage
  if (window.browser && window.browser.storage && window.browser.storage.local) {
    window.browser.storage.local.get(['dashboard-theme'], (result) => {
      applyPopupTheme(result['dashboard-theme'] || 'default');
    });
    // Listen for theme changes
    window.browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes['dashboard-theme']) {
        applyPopupTheme(changes['dashboard-theme'].newValue || 'default');
      }
    });
  } else if (window.chrome && window.chrome.storage && window.chrome.storage.local) {
    window.chrome.storage.local.get(['dashboard-theme'], (result) => {
      applyPopupTheme(result['dashboard-theme'] || 'default');
    });
    window.chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes['dashboard-theme']) {
        applyPopupTheme(changes['dashboard-theme'].newValue || 'default');
      }
    });
  } else {
    // fallback to localStorage
    applyPopupTheme(localStorage.getItem('dashboard-theme') || 'default');
  }
  
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
  
  // Load welcome page mode and set up button
  await loadWelcomeMode();
  
  // Set up enable welcome button event listener
  const enableWelcomeBtn = document.getElementById('enable-welcome-btn');
  if (enableWelcomeBtn) {
    originalConsoleLog('Enable welcome button found, setting up event listener');
    
    // Add click animation
    enableWelcomeBtn.addEventListener('mousedown', () => {
      enableWelcomeBtn.style.transform = 'scale(0.95)';
      enableWelcomeBtn.style.background = '#e6d15c';
    });
    
    enableWelcomeBtn.addEventListener('mouseup', () => {
      enableWelcomeBtn.style.transform = 'scale(1)';
      enableWelcomeBtn.style.background = 'var(--theme-accent, #ffe066)';
    });
    
    enableWelcomeBtn.addEventListener('mouseleave', () => {
      enableWelcomeBtn.style.transform = 'scale(1)';
      enableWelcomeBtn.style.background = 'var(--theme-accent, #ffe066)';
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
        patchNotesContainer.style.display = 'none';
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
        renderPatchNotes(currentVersion);
        const patchNotesContainer = document.getElementById('patch-notes');
        if (patchNotesContainer) {
          patchNotesContainer.style.display = 'block';
          // Scroll to top to show patch notes
          patchNotesContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
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
  
  // Listen for changes to manualMods in storage and update the popup in real time
  if (window.browser && window.browser.storage && window.browser.storage.onChanged) {
    window.browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[MANUAL_MODS_KEY]) {
        loadLocalMods();
      }
      // Update storage usage when any storage changes
      if (area === 'local') {
        updateStorageUsage();
      }
    });
  } else if (window.chrome && window.chrome.storage && window.chrome.storage.onChanged) {
    window.chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[MANUAL_MODS_KEY]) {
        loadLocalMods();
      }
      // Update storage usage when any storage changes
      if (area === 'local') {
        updateStorageUsage();
      }
    });
  }

  // Also reload mods when the popup gains focus (e.g., when the extension icon is clicked)
  window.addEventListener('focus', () => {
    loadLocalMods();
    updateStorageUsage();
  });
  
});

// Track whether we're currently loading mods to prevent loops
let isLoadingMods = false;

async function loadLocalMods() {
  isLoadingMods = true;
  try {
    // Fetch all mods (including manual mods) from background script
    const response = await window.browserAPI.runtime.sendMessage({ action: 'getLocalMods' });
    const mods = response && response.success ? response.mods : [];

    await renderLocalMods(mods);
  } catch (error) {
    showError('Error loading local mods: ' + error.message);
  }
  isLoadingMods = false;
}

// Store all mods for filtering
let allMods = [];

// Fallback descriptions for mods
const modDescriptions = {
  'Bestiary Automator': 'Automates bestiary completion, stamina refill, and auto-play features.',
  'Board Analyzer': 'Analyzes board setups and provides optimization suggestions.',
  'Custom Display': 'Customize the game display with various visual options.',
  'Hero Editor': 'Edit and manage hero configurations and stats.',
  'Highscore Improvements': 'Enhanced highscores display with additional statistics.',
  'Item Tier List': 'View and manage item tier rankings.',
  'Monster Tier List': 'View and manage monster tier rankings.',
  'Setup Manager': 'Manage and organize your board setups.',
  'Team Copier': 'Copy team configurations between setups.',
  'Tick Tracker': 'Track and analyze game ticks and timing.',
  'Turbo Mode': 'Enable turbo mode for faster gameplay.',
  'Autoseller': 'Automatically sells creatures based on gene thresholds and experience levels.',
  'Autoscroller': 'Automatically scrolls through content for convenience.',
  'Better Analytics': 'Enhanced analytics and statistics tracking.',
  'Better Boosted Maps': 'Improved boosted maps functionality.',
  'Better Cauldron': 'Enhanced cauldron management features.',
  'Better Exaltation Chest': 'Improved exaltation chest handling.',
  'Better Forge': 'Enhanced forge interface and functionality.',
  'Better Highscores': 'Improved highscores display and features.',
  'Better Hy\'genie': 'Enhanced Hy\'genie interaction features.',
  'Better Setups': 'Improved setup management and organization.',
  'Better Tasker': 'Enhanced task automation features.',
  'Better Yasir': 'Improved Yasir interaction and features.',
  'Cyclopedia': 'Comprehensive creature and item encyclopedia.',
  'Dice Roller': 'Roll dice for various game mechanics.',
  'Guilds': 'Guild management and interaction features.',
  'Hunt Analyzer': 'Analyze and optimize hunting strategies.',
  'Raid Hunter': 'Enhanced raid hunting features and tracking.',
  'Manual Runner': 'Run manual mode until victory with automatic floor progression.',
  'Stamina Optimizer': 'Optimize stamina usage and management.',
  'VIP List': 'Manage and view VIP list features.'
};

// Super Mods list - kept in sync with mod-registry.js
const superModNames = [
  'Autoseller.js',
  'Autoscroller.js',
  'Better Analytics.js',
  'Better Boosted Maps.js',
  'Better Cauldron.js',
  'Better Exaltation Chest.js',
  'Better Forge.js',
  'Better Highscores.js',
  'Better Hy\'genie.js',
  'Better Setups.js',
  'Better Tasker.js',
  'Better Yasir.js',
  'Cyclopedia.js',
  'Dice_Roller.js',
  'Guilds.js',
  'Hunt Analyzer.js',
  'Mod Settings.js',
  'Outfiter.js',
  'Raid_Hunter.js',
  'Manual Runner.js',
  'RunTracker.js',
  'Stamina Optimizer.js',
  'VIP List.js'
];

const hiddenMods = [
  'inventory-database.js',
  'creature-database.js',
  'Welcome.js',
  'equipment-database.js',
  'maps-database.js',
  'playereq-database.js',
  'Mod Settings.js',
  'RunTracker.js',
  'Outfiter.js'
];

function normalizeModName(name) {
  return name.replace(/\s+/g, '').toLowerCase();
}

function getModCategory(mod) {
  const modFileName = mod.name.split('/').pop();
  if (mod.type === 'manual') return 'custom';
  if (superModNames.some(n => normalizeModName(n) === normalizeModName(modFileName))) return 'super';
  return 'official';
}

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
  const categoryNames = {
    'official': await getTranslation('popup.categoryOfficial', 'Original Mods'),
    'super': await getTranslation('popup.categorySuper', 'SuperMods'),
    'custom': await getTranslation('popup.categoryCustom', 'Custom Mods')
  };
  return categoryNames[category] || category;
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
  modCard.appendChild(footer);

  return modCard;
}

async function updateCategoryCounts(mods) {
  if (!mods || mods.length === 0) return;

  // Filter out hidden mods
  const visibleMods = mods.filter(mod => {
    const modFileName = mod.name.split('/').pop();
    return !hiddenMods.some(hidden => 
      normalizeModName(hidden) === normalizeModName(modFileName)
    );
  });

  // Count mods by category
  const counts = {
    official: { total: 0, enabled: 0 },
    super: { total: 0, enabled: 0 },
    custom: { total: 0, enabled: 0 }
  };

  visibleMods.forEach(mod => {
    const category = getModCategory(mod);
    if (counts[category] !== undefined) {
      counts[category].total++;
      if (mod.enabled) {
        counts[category].enabled++;
      }
    }
  });

  // Update filter button labels
  const officialFilter = document.querySelector('.category-filter[data-category="official"]');
  const superFilter = document.querySelector('.category-filter[data-category="super"]');
  const customFilter = document.querySelector('.category-filter[data-category="custom"]');

  if (officialFilter) {
    if (counts.official.total > 0) {
      const categoryText = await getTranslation('popup.categoryOfficial', 'Original Mods');
      officialFilter.textContent = `${categoryText} (${counts.official.enabled}/${counts.official.total})`;
    } else {
      officialFilter.textContent = await getTranslation('popup.categoryOfficial', 'Original Mods');
    }
  }
  if (superFilter) {
    if (counts.super.total > 0) {
      const categoryText = await getTranslation('popup.categorySuper', 'SuperMods');
      superFilter.textContent = `${categoryText} (${counts.super.enabled}/${counts.super.total})`;
    } else {
      superFilter.textContent = await getTranslation('popup.categorySuper', 'SuperMods');
    }
  }
  if (customFilter) {
    if (counts.custom.total > 0) {
      const categoryText = await getTranslation('popup.categoryCustom', 'Custom Mods');
      customFilter.textContent = `${categoryText} (${counts.custom.enabled}/${counts.custom.total})`;
    } else {
      customFilter.textContent = await getTranslation('popup.categoryCustom', 'Custom Mods');
    }
  }
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
let currentSearchTerm = '';
let currentCategory = 'all';

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
    const response = await window.browserAPI.runtime.sendMessage({
      action: 'toggleLocalMod',
      name,
      enabled
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

async function executeLocalMod(name) {
  try {
    const response = await window.browserAPI.runtime.sendMessage({
      action: 'executeLocalMod',
      name
    });
    
    if (!response.success) {
      showError(response.error || 'Unknown error occurred');
    }
  } catch (error) {
    showError(`Communication error: ${error.message}`);
  }
}

function showError(message) {
  alert(message);
}

window.browserAPI.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.localMods && !isLoadingMods) {
      // Only reload local mods if we're not already in the process of loading them
      loadLocalMods();
    }
    if (changes.locale) {
      // Locale change handling removed - no i18n support
    }
    // Update storage usage on any local storage change
    updateStorageUsage();
  }
});

document.getElementById('reload-mods-btn')?.addEventListener('click', async () => {
  const confirmMsg = await getTranslation('popup.messages.resetLocalModsConfirm', 'Are you sure you want to reset local mods? This will remove all official and super mods from storage and reload from disk. User-generated mods will not be affected.');
  if (!confirm(confirmMsg)) return;
  try {
    if (window.browser && window.browser.storage && window.browser.storage.local) {
      await window.browser.storage.local.remove(['localMods', 'activeScripts']);
      if (window.browser.storage.sync) {
        await window.browser.storage.sync.remove(['localMods', 'activeScripts']);
      }
    } else if (window.localStorage) {
      window.localStorage.removeItem('localMods');
      window.localStorage.removeItem('activeScripts');
    }
    await new Promise(res => setTimeout(res, 50));
    await loadLocalMods();
    await updateStorageUsage();
    const successMsg = await getTranslation('popup.messages.localModsReset', 'Local mods reset!');
    alert(successMsg);
  } catch (e) {
    const errorMsg = await getTranslation('popup.messages.failedToResetLocalMods', 'Failed to reset local mods.');
    alert(errorMsg);
  }
});



document.getElementById('reset-all-btn')?.addEventListener('click', async () => {
  const confirmMsg = await getTranslation('popup.messages.resetAllConfirm', 'Are you sure you want to reset the entire mod loader? This will remove ALL settings, mods, and data.');
  if (!confirm(confirmMsg)) return;
  try {
    if (window.browser && window.browser.storage && window.browser.storage.local) {
      await new Promise(res => window.browser.storage.local.clear(res));
      if (window.browser.storage.sync) {
        await new Promise(res => window.browser.storage.sync.clear(res));
      }
    }
    if (window.localStorage) {
      window.localStorage.clear();
    }
    await loadLocalMods();
    await updateStorageUsage();
    const successMsg = await getTranslation('popup.messages.allDataReset', 'All mod loader data reset!');
    alert(successMsg);
    window.location.reload();
  } catch (e) {
    const errorMsg = await getTranslation('popup.messages.failedToResetAll', 'Failed to reset all data.');
    alert(errorMsg);
  }
});

// Example: Show warning when loading remote mod
function showModSourceWarningIfNeeded(source) {
  if (isRemoteSource(source)) {
    showModal({
      title: 'Security Warning',
      content: 'You are about to load a mod from an external or untrusted source. This can be dangerous. Only proceed if you trust the source.',
      buttons: [{ text: 'OK', onClick: () => {} }]
    });
  }
}