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

const i18n = window.i18n;

const localModsContainer = document.getElementById('local-mods-container');

import { getLocalMods } from '../mods/modsLoader.js';

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
  
  await i18n.init();
  
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
  
  // Update version display
  await updateVersionDisplay();
  
  await loadLocalMods();
  
  // Listen for changes to manualMods in storage and update the popup in real time
  if (window.browser && window.browser.storage && window.browser.storage.onChanged) {
    window.browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[MANUAL_MODS_KEY]) {
        loadLocalMods();
      }
    });
  } else if (window.chrome && window.chrome.storage && window.chrome.storage.onChanged) {
    window.chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[MANUAL_MODS_KEY]) {
        loadLocalMods();
      }
    });
  }

  // Also reload mods when the popup gains focus (e.g., when the extension icon is clicked)
  window.addEventListener('focus', () => {
    loadLocalMods();
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
    emptyMessage.textContent = i18n.t('messages.noLocalMods');
    if (officialModsList) officialModsList.appendChild(emptyMessage.cloneNode(true));
    if (superModsList) superModsList.appendChild(emptyMessage.cloneNode(true));
    if (userModsList) userModsList.appendChild(emptyMessage.cloneNode(true));
    return;
  }

  const superModNames = [
    'Autoseller.js',
    'Autoscroller.js',
    'Better Analytics.js',
    'Better Cauldron.js',
    'Better Forge.js',
    'Better Highscores.js',
    'Better Hy\'genie.js',
    'Better Yasir.js',
    'Configurator.js',
    'Cyclopedia.js',
    'DashboardButton.js',
    'Dice_Roller.js',
    'Hunt Analyzer.js',
    'Outfiter.js',
    
  ];

  const hiddenMods = [
    'inventory-tooltips.js',
    'DashboardButton.js',
    'RunTracker.js',
    'Outfiter.js',
    'Board Advisor.js'
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

    // Toggle
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

    // Group mods by type using filename only
    const isSuper = superModNames.some(
      n => normalizeModName(n) === normalizeModName(modFileName)
    );
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
      showError(response.error || i18n.t('messages.unknownError'));
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
      showError(response.error || i18n.t('messages.unknownError'));
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
      i18n.setLocale(changes.locale.newValue);
    }
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
    if (typeof getLocalMods === 'function') {
      await loadLocalMods();
    }
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
    if (typeof getLocalMods === 'function') {
      await loadLocalMods();
    }
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