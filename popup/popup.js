/**
 * Popup Script for Bestiary Arena Mod Loader
 * 
 * IMPORTANT: When adding a new mod, update the static mod lists in this file!
 * Popup cannot load ES6 modules, so we maintain static lists that must be kept in sync with:
 * - content/mod-registry.js (the source of truth)
 * - dashboard/dashboard.js (also uses static lists)
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
    debugStatus.textContent = enabled ? 'ON' : 'OFF';
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
    outfiterStatus.textContent = enabled ? 'ON' : 'OFF';
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

// Function to open dashboard
async function openDashboard() {
  try {
    const response = await window.browserAPI.runtime.sendMessage({ action: 'openDashboard' });
    if (response && response.success) {
      originalConsoleLog('Dashboard opened successfully');
    }
  } catch (error) {
    originalConsoleLog('Failed to open dashboard:', error);
    // Fallback: try to open dashboard URL directly
    try {
      const dashboardUrl = window.browserAPI.runtime.getURL('dashboard/dashboard.html');
      window.browserAPI.tabs.create({ url: dashboardUrl });
    } catch (fallbackError) {
      originalConsoleLog('Fallback dashboard opening also failed:', fallbackError);
    }
  }
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
      debugStatus.textContent = DEBUG_MODE ? 'ON' : 'OFF';
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
      outfiterStatus.textContent = OUTFITER_ENABLED ? 'ON' : 'OFF';
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

document.addEventListener('DOMContentLoaded', async () => {
  // === VERSION DISPLAY ===
  async function updateVersionDisplay() {
    try {
      const manifest = await window.browserAPI.runtime.getManifest();
      const versionElement = document.getElementById('version-display');
      if (versionElement) {
        versionElement.textContent = `Version ${manifest.version}`;
      }
    } catch (error) {
      console.error('Failed to load manifest version:', error);
      const versionElement = document.getElementById('version-display');
      if (versionElement) {
        versionElement.textContent = 'Version unknown';
      }
    }
  }

  // === STORAGE USAGE DISPLAY ===
  async function updateStorageUsage() {
    try {
      const storageElement = document.getElementById('storage-usage');
      if (!storageElement) return;

      let totalBytes = 0;
      
      // 1. Extension storage (chrome.storage.local/sync)
      if (window.browserAPI.storage.local.getBytesInUse) {
        totalBytes += await window.browserAPI.storage.local.getBytesInUse();
      } else {
        const allData = await window.browserAPI.storage.local.get(null);
        totalBytes += new Blob([JSON.stringify(allData)]).size;
      }
      
      // 2. localStorage estimate (need to query from content script or estimate)
      try {
        // Try to get from active tab's localStorage
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
      } catch (e) {
        // If we can't query tab, just show extension storage
        originalConsoleLog('Could not query tab storage:', e);
      }
      
      // Format bytes to human-readable
      const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };
      
      storageElement.textContent = `Storage: ${formatBytes(totalBytes)}`;
      
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
        storageElement.textContent = 'Storage: unavailable';
      }
    }
  }

  // === THEME SYNC WITH DASHBOARD ===
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
  
  // Set up open dashboard button event listener
  const openDashboardBtn = document.getElementById('open-dashboard-btn');
  if (openDashboardBtn) {
    originalConsoleLog('Open dashboard button found, setting up event listener');
    
    // Add click animation
    openDashboardBtn.addEventListener('mousedown', () => {
      openDashboardBtn.style.transform = 'scale(0.95)';
      openDashboardBtn.style.background = '#e6d15c';
    });
    
    openDashboardBtn.addEventListener('mouseup', () => {
      openDashboardBtn.style.transform = 'scale(1)';
      openDashboardBtn.style.background = 'var(--theme-accent, #ffe066)';
    });
    
    openDashboardBtn.addEventListener('mouseleave', () => {
      openDashboardBtn.style.transform = 'scale(1)';
      openDashboardBtn.style.background = 'var(--theme-accent, #ffe066)';
    });
    
    openDashboardBtn.addEventListener('click', () => {
      originalConsoleLog('Open dashboard button clicked');
      openDashboard();
    });
  } else {
    originalConsoleLog('Open dashboard button not found in DOM');
  }
  
  // Update version display
  await updateVersionDisplay();
  
  // Update storage usage display
  await updateStorageUsage();
  
  await loadLocalMods();
  
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

    renderLocalMods(mods);
  } catch (error) {
    showError('Error loading local mods: ' + error.message);
  }
  isLoadingMods = false;
}

function renderLocalMods(mods) {
  const officialModsList = document.getElementById('official-mods-list');
  const superModsList = document.getElementById('super-mods-list');
  const userModsList = document.getElementById('user-mods-list');

  if (officialModsList) officialModsList.innerHTML = '';
  if (superModsList) superModsList.innerHTML = '';
  if (userModsList) userModsList.innerHTML = '';

  if (!mods || mods.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'No local mods found';
    if (officialModsList) officialModsList.appendChild(emptyMessage.cloneNode(true));
    if (superModsList) superModsList.appendChild(emptyMessage.cloneNode(true));
    if (userModsList) userModsList.appendChild(emptyMessage.cloneNode(true));
    return;
  }

  // Super Mods list - kept in sync with mod-registry.js
  // Note: Popup cannot load ES6 modules, so we maintain this list manually
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
    'Better UI.js',
    'Better Yasir.js',
    'Board Advisor.js',
    'Configurator.js',
    'Cyclopedia.js',
    'Dice_Roller.js',
    'Hunt Analyzer.js',
    'Outfiter.js',
    'Playercount.js',
    'Raid_Hunter.js',
    'Rank Pointer.js',
    'RunTracker.js'
  ];


  const hiddenMods = [
    'inventory-database.js',
    'creature-database.js',
    'Welcome.js',
    'equipment-database.js',
    'maps-database.js',
    'RunTracker.js',
    'Outfiter.js',
    'Playercount.js'
  ];

  function normalizeModName(name) {
    return name.replace(/\s+/g, '').toLowerCase();
  }

  const visibleMods = mods.filter(mod => {
    const modFileName = mod.name.split('/').pop();
    return !hiddenMods.some(hidden => 
      normalizeModName(hidden) === normalizeModName(modFileName)
    );
  });

  visibleMods.forEach(mod => {
    const modCard = document.createElement('div');
    modCard.className = 'script-card local-mod-card';
    modCard.dataset.name = mod.name;

    const modHeader = document.createElement('div');
    modHeader.className = 'script-header';

    const modTitle = document.createElement('div');
    modTitle.className = 'script-title';
    const modFileName = mod.name.split('/').pop();
    modTitle.textContent = (mod.displayName && !mod.displayName.includes('/'))
      ? mod.displayName
      : modFileName.replace('.js', '').replace(/_/g, ' ');

    modHeader.appendChild(modTitle);
    modCard.appendChild(modHeader);

    const modControls = document.createElement('div');
    modControls.className = 'script-controls';
    modControls.style.display = 'flex';
    modControls.style.justifyContent = 'flex-end';
    modControls.style.alignItems = 'center';

    // Group mods by type using filename only
    const isSuper = superModNames.some(
      n => normalizeModName(n) === normalizeModName(modFileName)
    );

    // Toggle (functional for all mods)
    const modToggle = document.createElement('div');
    modToggle.className = 'script-toggle';
    modToggle.style.marginLeft = 'auto';

    const toggleSwitch = document.createElement('label');
    toggleSwitch.className = 'toggle-switch';

    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = mod.enabled;
    toggleInput.addEventListener('change', () => {
      toggleLocalMod(mod.name, toggleInput.checked);
    });

    const slider = document.createElement('span');
    slider.className = 'slider';

    toggleSwitch.appendChild(toggleInput);
    toggleSwitch.appendChild(slider);

    modToggle.appendChild(toggleSwitch);
    modControls.appendChild(modToggle);
    modCard.appendChild(modControls);

    if (mod.type === 'manual' && userModsList) {
      userModsList.appendChild(modCard);
    } else if (isSuper && superModsList) {
      superModsList.appendChild(modCard);
    } else if (officialModsList) {
      officialModsList.appendChild(modCard);
    }
  });
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
  if (!confirm('Are you sure you want to reset local mods? This will remove all official and super mods from storage and reload from disk. User-generated mods will not be affected.')) return;
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
    alert('Local mods reset!');
  } catch (e) {
    alert('Failed to reset local mods.');
  }
});



document.getElementById('reset-all-btn')?.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to reset the entire mod loader? This will remove ALL settings, mods, and data.')) return;
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
    alert('All mod loader data reset!');
    window.location.reload();
  } catch (e) {
    alert('Failed to reset all data.');
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