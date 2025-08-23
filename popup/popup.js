// Polyfill for Chrome and Firefox WebExtensions
if (typeof window.browser === 'undefined') {
  window.browser = window.chrome;
}

window.browserAPI = window.browserAPI || (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

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

const DEBUG = false; // Set to true for development

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
    'Cyclopedia.js',
    'DashboardButton.js',
    'Dice_Roller.js',
    'Hunt Analyzer.js'
  ];

  const hiddenMods = [
    'inventory-tooltips.js',
    'DashboardButton.js'
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

document.getElementById('check-api-btn')?.addEventListener('click', () => {
  window.browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      window.browserAPI.tabs.sendMessage(tabs[0].id, { action: 'checkAPI' }, (response) => {
        if (window.browserAPI.runtime.lastError) {
          alert('Error checking API: ' + window.browserAPI.runtime.lastError.message);
          return;
        }
        if (response && response.success) {
          alert(`API is available! Methods: ${response.methods.join(', ')}`);
        } else {
          alert('API is not available in the active tab');
        }
      });
    } else {
      alert('No active tab found');
    }
  });
});

document.getElementById('log-storage-btn')?.addEventListener('click', async () => {
  try {
    const localData = await window.browserAPI.storage.local.get(null);
    const syncData = await window.browserAPI.storage.sync.get(null);
    console.log('Local Storage:', localData);
    console.log('Sync Storage:', syncData);
    alert('Storage contents logged to console');
  } catch (error) {
    alert('Error accessing storage: ' + error.message);
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