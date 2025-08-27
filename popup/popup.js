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
    'Hunt Analyzer.js',
    
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

// --- Configuration Export/Import System ---
async function exportConfiguration() {
  try {
    // Get all active scripts and their configs
    const activeScripts = await window.browserAPI.storage.sync.get('activeScripts');
    
    // Get local mods
    const localMods = await window.browserAPI.storage.local.get('localMods');
    
    // Get manual mods
    const manualMods = await window.browserAPI.storage.local.get('manualMods');
    
    // Get local mods config
    const localModsConfig = await window.browserAPI.storage.local.get('localModsConfig');
    
    // Get dashboard theme
    const dashboardTheme = await window.browserAPI.storage.local.get('dashboard-theme');
    
    // Get locale/language preference
    const locale = await window.browserAPI.storage.local.get('locale');
    
    // Get utility script cache (for faster loading)
    const utilityScriptCache = await window.browserAPI.storage.local.get(['utility_script_cache', 'utility_script_timestamp']);
    
    // Get all script caches (for faster loading of Gist mods)
    const allLocalStorage = await window.browserAPI.storage.local.get(null);
    const scriptCaches = {};
    const modLocalStorage = {};
    Object.keys(allLocalStorage).forEach(key => {
      if (key.startsWith('script_')) {
        scriptCaches[key] = allLocalStorage[key];
      } else if (key.startsWith('mod_') || key.startsWith('bestiary_') || key.startsWith('ba_')) {
        // Capture mod-specific localStorage data
        modLocalStorage[key] = allLocalStorage[key];
      }
    });
    
    // Get game localStorage data (setup labels, mod data, etc.)
    let gameLocalStorage = {};
    let setupLabels = null;
    try {
      // Use content script to access the game page's localStorage
      const tabs = await window.browserAPI.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].url && tabs[0].url.includes('bestiaryarena.com')) {
        // Inject script to get localStorage from the game page
        const results = await window.browserAPI.tabs.executeScript(tabs[0].id, {
          code: `
            const gameData = {};
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key) {
                try {
                  const value = localStorage.getItem(key);
                  gameData[key] = value;
                } catch (e) {
                  console.warn('Could not read localStorage key:', key, e);
                }
              }
            }
            gameData;
          `
        });
        
        if (results && results[0]) {
          gameLocalStorage = results[0];
          console.log(`Captured ${Object.keys(gameLocalStorage).length} localStorage items from game`);
          
          // Check for setup labels specifically
          if (gameLocalStorage['stored-setup-labels']) {
            setupLabels = gameLocalStorage['stored-setup-labels'];
            console.log('Captured setup labels:', setupLabels);
            
            try {
              const parsedLabels = JSON.parse(setupLabels);
              console.log('Setup labels found:', parsedLabels);
            } catch (e) {
              console.log('Setup labels (raw):', setupLabels);
            }
          }
        }
      } else {
        console.log('Not on Bestiary Arena page, game localStorage will not be captured');
      }
    } catch (error) {
      console.log('Could not access game localStorage:', error);
    }
    
    // Create export data
    const exportData = {
      version: '1.1',
      timestamp: new Date().toISOString(),
      activeScripts: activeScripts.activeScripts || [],
      localMods: localMods.localMods || [],
      manualMods: manualMods.manualMods || [],
      localModsConfig: localModsConfig.localModsConfig || {},
      dashboardTheme: dashboardTheme['dashboard-theme'] || 'default',
      locale: locale.locale || 'en-US',
      utilityScriptCache: utilityScriptCache.utility_script_cache || null,
      utilityScriptTimestamp: utilityScriptCache.utility_script_timestamp || null,
      scriptCaches: scriptCaches,
      modLocalStorage: modLocalStorage,
      gameLocalStorage: gameLocalStorage,
      exportInfo: {
        totalActiveScripts: (activeScripts.activeScripts || []).length,
        totalLocalMods: (localMods.localMods || []).length,
        totalManualMods: (manualMods.manualMods || []).length,
        hasUtilityCache: !!utilityScriptCache.utility_script_cache,
        hasScriptCaches: Object.keys(scriptCaches).length > 0,
        hasModLocalStorage: Object.keys(modLocalStorage).length > 0,
        hasGameLocalStorage: Object.keys(gameLocalStorage).length > 0
      }
    };
    
    // Create and download file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bestiary-arena-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Show notification with info about what was captured
    const capturedItems = [];
    if (exportData.activeScripts.length > 0) capturedItems.push(`${exportData.activeScripts.length} active scripts`);
    if (exportData.localMods.length > 0) capturedItems.push(`${exportData.localMods.length} local mods`);
    if (exportData.manualMods.length > 0) capturedItems.push(`${exportData.manualMods.length} manual mods`);
    if (Object.keys(exportData.gameLocalStorage).length > 0) capturedItems.push(`${Object.keys(exportData.gameLocalStorage).length} game localStorage items`);
    
    // Check for setup labels specifically
    if (exportData.gameLocalStorage && exportData.gameLocalStorage['stored-setup-labels']) {
      try {
        const setupLabels = JSON.parse(exportData.gameLocalStorage['stored-setup-labels']);
        capturedItems.push(`setup labels: ${setupLabels.join(', ')}`);
      } catch (e) {
        capturedItems.push(`setup labels: ${exportData.gameLocalStorage['stored-setup-labels']}`);
      }
    }
    
    const message = capturedItems.length > 0 
      ? `Configuration exported successfully! Captured: ${capturedItems.join(', ')}`
      : 'Configuration exported successfully! (No game localStorage captured - make sure you\'re on the Bestiary Arena page)';
    
    alert(message);
  } catch (error) {
    console.error('Error exporting configuration:', error);
    alert('Failed to export configuration: ' + error.message);
  }
}

async function importConfiguration() {
  try {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        // Validate import data
        if (!importData.version || !importData.activeScripts) {
          throw new Error('Invalid configuration file format');
        }
        
        // Show confirmation dialog with enhanced info
        const info = [
          `Active Scripts: ${importData.activeScripts.length}`,
          `Local Mods: ${importData.localMods.length}`,
          `Manual Mods: ${importData.manualMods.length}`
        ];
        
        if (importData.exportInfo) {
          info.push(`\nAdditional Data:`);
          if (importData.exportInfo.hasUtilityCache) info.push(`• Utility script cache`);
          if (importData.exportInfo.hasScriptCaches) info.push(`• Script caches (${Object.keys(importData.scriptCaches || {}).length} cached scripts)`);
          if (importData.exportInfo.hasModLocalStorage) info.push(`• Mod localStorage data (${Object.keys(importData.modLocalStorage || {}).length} items)`);
          if (importData.exportInfo.hasGameLocalStorage) {
            info.push(`• Game localStorage data (${Object.keys(importData.gameLocalStorage || {}).length} items)`);
            // Check for setup labels specifically
            if (importData.gameLocalStorage && importData.gameLocalStorage['stored-setup-labels']) {
              try {
                const setupLabels = JSON.parse(importData.gameLocalStorage['stored-setup-labels']);
                info.push(`• Setup labels: ${setupLabels.join(', ')}`);
              } catch (e) {
                info.push(`• Setup labels: ${importData.gameLocalStorage['stored-setup-labels']}`);
              }
            }
          }
          if (importData.locale) info.push(`• Language preference: ${importData.locale}`);
        }
        
        const confirmed = confirm(
          'This will replace your current configuration. Are you sure you want to continue?\n\n' +
          info.join('\n')
        );
        
        if (!confirmed) return;
        
        // Import the data
        await window.browserAPI.storage.sync.set({ activeScripts: importData.activeScripts });
        
        // Save localMods to both sync and local storage to ensure compatibility
        await window.browserAPI.storage.sync.set({ localMods: importData.localMods });
        await window.browserAPI.storage.local.set({ localMods: importData.localMods });
        
        await window.browserAPI.storage.local.set({ manualMods: importData.manualMods });
        await window.browserAPI.storage.local.set({ localModsConfig: importData.localModsConfig });
        
        if (importData.dashboardTheme) {
          await window.browserAPI.storage.local.set({ 'dashboard-theme': importData.dashboardTheme });
        }
        
        // Import locale if available
        if (importData.locale) {
          await window.browserAPI.storage.local.set({ locale: importData.locale });
        }
        
        // Import utility script cache if available
        if (importData.utilityScriptCache && importData.utilityScriptTimestamp) {
          await window.browserAPI.storage.local.set({
            'utility_script_cache': importData.utilityScriptCache,
            'utility_script_timestamp': importData.utilityScriptTimestamp
          });
        }
        
        // Import script caches if available
        if (importData.scriptCaches && Object.keys(importData.scriptCaches).length > 0) {
          await window.browserAPI.storage.local.set(importData.scriptCaches);
        }
        
        // Import mod localStorage data if available
        if (importData.modLocalStorage && Object.keys(importData.modLocalStorage).length > 0) {
          await window.browserAPI.storage.local.set(importData.modLocalStorage);
        }
        
        // Import game localStorage data if available
        if (importData.gameLocalStorage && Object.keys(importData.gameLocalStorage).length > 0) {
          try {
            // Use content script to set localStorage on the game page
            const tabs = await window.browserAPI.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0 && tabs[0].url && tabs[0].url.includes('bestiaryarena.com')) {
              // Try different injection methods based on browser
              let injectionSuccess = false;
              
              // Method 1: Try executeScript (Chrome Manifest V3)
              try {
                await window.browserAPI.tabs.executeScript(tabs[0].id, {
                  code: `
                    // Clear existing localStorage
                    localStorage.clear();
                    
                    // Set new localStorage data
                    const gameData = ${JSON.stringify(importData.gameLocalStorage)};
                    Object.keys(gameData).forEach(key => {
                      try {
                        localStorage.setItem(key, gameData[key]);
                      } catch (e) {
                        console.warn('Could not set localStorage key:', key, e);
                      }
                    });
                    
                    console.log('Restored', Object.keys(gameData).length, 'game localStorage items');
                    true;
                  `
                });
                injectionSuccess = true;
                console.log(`Restored ${Object.keys(importData.gameLocalStorage).length} game localStorage items via executeScript`);
              } catch (executeError) {
                console.log('executeScript failed, trying alternative method:', executeError);
                
                // Method 2: Try sending message to content script
                try {
                  await window.browserAPI.tabs.sendMessage(tabs[0].id, {
                    action: 'restoreGameLocalStorage',
                    data: importData.gameLocalStorage
                  });
                  injectionSuccess = true;
                  console.log(`Restored ${Object.keys(importData.gameLocalStorage).length} game localStorage items via content script message`);
                } catch (messageError) {
                  console.log('Content script message failed:', messageError);
                }
              }
              
              if (!injectionSuccess) {
                console.log('All injection methods failed - game localStorage will not be restored');
                alert('Warning: Could not restore game localStorage data. Please refresh the Bestiary Arena page manually after import.');
              }
            } else {
              console.log('Not on Bestiary Arena page, game localStorage will not be restored');
              alert('Warning: Not on Bestiary Arena page. Game localStorage data will not be restored. Please import while on the game page.');
            }
          } catch (error) {
            console.log('Could not restore game localStorage:', error);
            alert('Warning: Failed to restore game localStorage data: ' + error.message);
          }
        }
        
        alert('Configuration imported successfully! Please refresh the page.');
        
        // Immediately refresh the mod list to show updated states
        setTimeout(async () => {
          try {
            await loadLocalMods();
            console.log('Mod list refreshed after import');
          } catch (error) {
            console.error('Error refreshing mod list:', error);
          }
        }, 500);
        
        // Reload the popup after a longer delay to ensure everything is synced
        setTimeout(() => {
          window.location.reload();
        }, 3000);
        
      } catch (error) {
        console.error('Error importing configuration:', error);
        alert('Failed to import configuration: ' + error.message);
      }
      
      // Clean up
      document.body.removeChild(input);
    };
    
    document.body.appendChild(input);
    input.click();
  } catch (error) {
    console.error('Error setting up import:', error);
    alert('Failed to set up import: ' + error.message);
  }
}

// Add event listeners for export/import buttons
document.getElementById('export-config-btn')?.addEventListener('click', async () => {
  await exportConfiguration();
});

document.getElementById('import-config-btn')?.addEventListener('click', async () => {
  await importConfiguration();
});

// Debug function to check game localStorage
async function checkGameLocalStorage() {
  try {
    const tabs = await window.browserAPI.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0 && tabs[0].url && tabs[0].url.includes('bestiaryarena.com')) {
      // Execute script in the game tab to get localStorage
      const results = await window.browserAPI.tabs.executeScript(tabs[0].id, {
        code: `
          const data = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              data[key] = localStorage.getItem(key);
            }
          }
          data;
        `
      });
      
      if (results && results[0]) {
        const localStorageData = results[0];
        console.log('Game localStorage:', localStorageData);
        
        // Check for setup labels specifically
        if (localStorageData['stored-setup-labels']) {
          try {
            const setupLabels = JSON.parse(localStorageData['stored-setup-labels']);
            alert(`Setup labels found: ${setupLabels.join(', ')}`);
          } catch (e) {
            alert(`Setup labels (raw): ${localStorageData['stored-setup-labels']}`);
          }
        } else {
          alert('No setup labels found in game localStorage');
        }
      }
    } else {
      alert('Not on Bestiary Arena page');
    }
  } catch (error) {
    console.error('Error checking game localStorage:', error);
    alert('Error: ' + error.message);
  }
}

// Add debug button if needed (uncomment to add)
// document.getElementById('debug-storage-btn')?.addEventListener('click', checkGameLocalStorage);