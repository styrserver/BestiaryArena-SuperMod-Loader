// Configurator Mod for Bestiary Arena
// Handles import/export of configuration data
console.log('Configurator initializing...');

// Safe DOM element removal helper
function safeRemoveElement(element) {
  if (element && element.parentNode && element.parentNode.contains(element)) {
    element.parentNode.removeChild(element);
  } else if (element && element.remove) {
    element.remove();
  }
}

// Configuration
const defaultConfig = {
  enabled: true,
  showNotifications: true
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Utility function to generate user-friendly summary
function generateSummary(data, isImport = false) {
  const summary = [];
  
  // Count enabled/disabled mods
  if (data.localMods && data.localMods.length > 0) {
    const enabledMods = data.localMods.filter(mod => mod.enabled).length;
    const disabledMods = data.localMods.length - enabledMods;
    summary.push(`${data.localMods.length} mods (${enabledMods} enabled, ${disabledMods} disabled)`);
  }
  
  // Add manual mods if any
  if (data.manualMods && data.manualMods.length > 0) {
    summary.push(`${data.manualMods.length} custom mods`);
  }
  
  // Add game data info
  if (data.gameLocalStorage && Object.keys(data.gameLocalStorage).length > 0) {
    const gameDataItems = [];
    if (data.gameLocalStorage['stored-setup-labels']) {
      try {
        const setupLabels = JSON.parse(data.gameLocalStorage['stored-setup-labels']);
        gameDataItems.push(`${setupLabels.length} setup labels`);
      } catch (e) {
        gameDataItems.push('setup labels');
      }
    }
    if (data.gameLocalStorage['stored-setups']) {
      gameDataItems.push('saved setups');
    }
    if (data.gameLocalStorage['autoseller-settings']) {
      gameDataItems.push('autoseller settings');
    }
    if (data.gameLocalStorage['bestiary-automator-config']) {
      gameDataItems.push('automator config');
    }
    
    if (gameDataItems.length > 0) {
      summary.push(`Game data: ${gameDataItems.join(', ')}`);
    } else {
      summary.push(`${Object.keys(data.gameLocalStorage).length} game settings`);
    }
  }
  
  // Add run data info
  if (data.runData && data.runData.metadata) {
    const runStats = data.runData.metadata;
    if (runStats.totalRuns > 0) {
      summary.push(`Run data: ${runStats.totalRuns} runs across ${runStats.totalMaps} maps`);
    }
  }
  
  // Add settings info
  const settings = [];
  if (data.dashboardTheme && data.dashboardTheme !== 'default') {
    settings.push(`theme: ${data.dashboardTheme}`);
  }
  if (data.locale && data.locale !== 'en-US') {
    settings.push(`language: ${data.locale}`);
  }
  if (settings.length > 0) {
    summary.push(`Settings: ${settings.join(', ')}`);
  }
  
  return summary;
}

// Add Configurator button to the header
function addConfiguratorHeaderButton() {
  const tryInsert = () => {
    // Find the header <ul> by its class
    const headerUl = document.querySelector('header ul.pixel-font-16.flex.items-center');
    if (!headerUl) {
      setTimeout(tryInsert, 500);
      return;
    }
    
    // Prevent duplicate button
    if (headerUl.querySelector('.configurator-header-btn')) {
      console.log('[Configurator] Configurator header button already exists, skipping insert.');
      return;
    }

    // Create the <li> and <button>
    const li = document.createElement('li');
    li.className = 'hover:text-whiteExp';
    const btn = document.createElement('button');
    btn.textContent = 'Configurator';
    btn.className = 'configurator-header-btn';
    btn.onclick = openConfigurator;
    li.appendChild(btn);

    // Insert after DashboardButton if it exists, otherwise before Cyclopedia
    const dashboardLi = Array.from(headerUl.children).find(
      el => el.querySelector('.dashboard-header-btn')
    );
    const cyclopediaLi = Array.from(headerUl.children).find(
      el => el.querySelector('button') && el.textContent.includes('Cyclopedia')
    );
    const mlAutoLi = Array.from(headerUl.children).find(
      el => el.classList.contains('ml-auto')
    );

    if (dashboardLi) {
      if (mlAutoLi) {
        headerUl.insertBefore(li, mlAutoLi);
      } else if (dashboardLi.nextSibling) {
        headerUl.insertBefore(li, dashboardLi.nextSibling);
      } else {
        headerUl.appendChild(li);
      }
      console.log('[Configurator] Configurator header button inserted after DashboardButton.');
    } else if (cyclopediaLi) {
      // Insert before Cyclopedia
      headerUl.insertBefore(li, cyclopediaLi);
      console.log('[Configurator] Configurator header button inserted before Cyclopedia.');
    } else {
      // Fallback: Insert after Wiki
      const wikiLi = Array.from(headerUl.children).find(
        el => el.querySelector('a') && el.textContent.includes('Wiki')
      );
      if (wikiLi && wikiLi.nextSibling) {
        headerUl.insertBefore(li, wikiLi.nextSibling);
      } else {
        headerUl.appendChild(li);
      }
      console.log('[Configurator] Configurator header button appended to header.');
    }
  };
  tryInsert();
}

// Main configurator function
function openConfigurator() {
  if (!api || !api.ui || !api.ui.components) {
    console.error('[Configurator] API not available');
    return;
  }

  let modal;
  try {
    modal = api.ui.components.createModal({
    title: 'Configuration Manager',
    width: 400,
    content: `
      <div style="text-align: center; padding: 20px;">
        <p style="margin-bottom: 20px; color: #a6adc8;">
          Import or export your mod loader configuration, including active mods, settings, and game data.
        </p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button id="export-config-btn" class="btn btn-primary" style="width: 100%;">
            📤 Export Configuration
          </button>
          <button id="import-config-btn" class="btn btn-secondary" style="width: 100%;">
            📥 Import Configuration
          </button>
        </div>
        <div style="margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px; font-size: 14px; color: #a6adc8;">
          <strong>What's included:</strong><br>
          • Active mods and their settings<br>
          • Dashboard theme and language<br>
          • Game localStorage data (setup labels, etc.)<br>
          • Mod-specific data and caches
        </div>
      </div>
    `,
    buttons: [
      {
        text: 'Close',
        primary: false,
        onClick: (e, modalObj) => {
          if (modalObj && typeof modalObj.close === 'function') {
            modalObj.close();
          } else if (modal && typeof modal.close === 'function') {
            modal.close();
          } else {
            // Fallback: remove modal elements from DOM
            document.querySelectorAll('.modal-bg, .modal-content, .modal-overlay').forEach(el => {
              if (el && el.parentNode) {
                el.parentNode.removeChild(el);
              }
            });
          }
        }
      }
    ]
  });

  // Add event listeners after modal is created
  setTimeout(() => {
    const exportBtn = document.getElementById('export-config-btn');
    const importBtn = document.getElementById('import-config-btn');
    
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportConfiguration(modal);
      });
    }
    
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        importConfiguration(modal);
      });
    }
  }, 100);
  } catch (error) {
    console.error('[Configurator] Error creating modal:', error);
    // Fallback: show a simple alert
    alert('Error opening Configuration Manager. Please try again.');
  }
}

// Export configuration function
async function exportConfiguration(modal) {
  try {
    // Show loading state
    const exportBtn = document.getElementById('export-config-btn');
    if (exportBtn) {
      exportBtn.textContent = '⏳ Exporting...';
      exportBtn.disabled = true;
    }

    // Get all active scripts and their configs
    const activeScripts = await api.service.getActiveScripts();
    
         // Get local mods from background script with fallback to page context
     const localModsData = await new Promise(resolve => {
       if (window.browserAPI && window.browserAPI.runtime) {
         console.log('[Configurator] Requesting local mods from background...');
         window.browserAPI.runtime.sendMessage({ action: 'getLocalMods' }, response => {
           console.log('[Configurator] Background response:', response);
           if (response && response.success && response.mods && response.mods.length > 0) {
             console.log('[Configurator] Local mods received from background:', response.mods);
             resolve(response.mods);
           } else {
             console.warn('Failed to get local mods from background, trying page context...');
             // Fallback: try to get mods from current page context
             if (window.localMods && Array.isArray(window.localMods) && window.localMods.length > 0) {
               console.log('[Configurator] Local mods found in page context:', window.localMods);
               resolve(window.localMods);
             } else {
               console.warn('[Configurator] No local mods found in page context either');
               resolve([]);
             }
           }
         });
       } else {
         console.warn('[Configurator] No browserAPI.runtime available, trying page context...');
         // Fallback: try to get mods from current page context
         if (window.localMods && Array.isArray(window.localMods) && window.localMods.length > 0) {
           console.log('[Configurator] Local mods found in page context:', window.localMods);
           resolve(window.localMods);
         } else {
           console.warn('[Configurator] No local mods found in page context');
           resolve([]);
         }
       }
     });
    
    // Get all storage data in one batch operation
    const storageData = await new Promise(resolve => {
      if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
        window.browserAPI.storage.local.get([
          'manualMods',
          'localModsConfig', 
          'dashboard-theme',
          'locale',
          'utility_script_cache',
          'utility_script_timestamp',
          'ba_local_runs' // Include run data
        ], result => {
          resolve(result || {});
        });
      } else {
        resolve({});
      }
    });
    
    // Extract individual values from batch result
    const manualModsData = storageData.manualMods || [];
    const localModsConfigData = storageData.localModsConfig || {};
    const dashboardThemeData = storageData['dashboard-theme'] || 'default';
    const localeData = storageData.locale || 'en-US';
         const utilityScriptCacheData = {
       cache: storageData.utility_script_cache || null,
       timestamp: storageData.utility_script_timestamp || null
     };
     
     // Get run data (try RunTrackerAPI first, then fallback to storage)
     let runData = null;
     if (window.RunTrackerAPI) {
       runData = window.RunTrackerAPI.getAllRuns();
     } else {
       runData = storageData.ba_local_runs || null;
     }
    
         // Get all script caches from storage
     const allStorageData = await new Promise(resolve => {
       if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
         window.browserAPI.storage.local.get(null, result => {
           resolve(result || {});
         });
       } else {
         resolve({});
       }
     });
     
     const scriptCaches = {};
     const modLocalStorage = {};
     Object.keys(allStorageData).forEach(key => {
       if (key.startsWith('script_')) {
         scriptCaches[key] = allStorageData[key];
       } else if (key.startsWith('mod_') || key.startsWith('bestiary_') || key.startsWith('ba_')) {
         // Capture mod-specific localStorage data
         modLocalStorage[key] = allStorageData[key];
       }
     });
     
     // Extract mod status from localMods array
     const modStatus = {};
     if (localModsData && Array.isArray(localModsData)) {
       localModsData.forEach(mod => {
         if (mod.name && typeof mod.enabled === 'boolean') {
           modStatus[mod.name] = mod.enabled;
         }
       });
     }
    
    // Get game localStorage data (setup labels, mod data, etc.)
    let gameLocalStorage = {};
    let setupLabels = null;
    try {
      // Access the game page's localStorage directly
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try {
            const value = localStorage.getItem(key);
            gameLocalStorage[key] = value;
          } catch (e) {
            console.warn('Could not read localStorage key:', key, e);
          }
        }
      }
      
      console.log(`Captured ${Object.keys(gameLocalStorage).length} localStorage items from game`);
      
      // Check for setup labels specifically
      if (gameLocalStorage['stored-setup-labels']) {
        setupLabels = gameLocalStorage['stored-setup-labels'];
        console.log('Captured setup labels:', setupLabels);
      }
    } catch (error) {
      console.log('Could not access game localStorage:', error);
    }
    
         // Create export data
     const exportData = {
       version: '1.2',
       timestamp: new Date().toISOString(),
       activeScripts: activeScripts || [],
       localMods: localModsData || [],
       manualMods: manualModsData || [],
       localModsConfig: localModsConfigData || {},
       modStatus: modStatus,
       dashboardTheme: dashboardThemeData || 'default',
       locale: localeData || 'en-US',
       utilityScriptCache: utilityScriptCacheData.cache || null,
       utilityScriptTimestamp: utilityScriptCacheData.timestamp || null,
       runData: runData,
       scriptCaches: scriptCaches,
       modLocalStorage: modLocalStorage,
       gameLocalStorage: gameLocalStorage,
       exportInfo: {
         totalActiveScripts: (activeScripts || []).length,
         totalLocalMods: (localModsData || []).length,
         totalManualMods: (manualModsData || []).length,
         totalModStatus: Object.keys(modStatus).length,
         hasUtilityCache: !!utilityScriptCacheData.cache,
         hasRunData: !!runData,
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
    
              // Create user-friendly export summary
     const summary = generateSummary(exportData);
     const message = summary.length > 0 
       ? `✅ Configuration exported successfully!\n\n📦 What was saved:\n• ${summary.join('\n• ')}`
       : '✅ Configuration exported successfully!\n\n📦 Basic settings saved';
    
    // Reset button state
    if (exportBtn) {
      exportBtn.textContent = '📤 Export Configuration';
      exportBtn.disabled = false;
    }
    
    // Show success message
    try {
      api.ui.components.createModal({
        title: 'Export Successful',
        content: `<p style="color: #a6adc8;">${message}</p>`,
        buttons: [{ text: 'OK', primary: true }]
      });
    } catch (modalError) {
      console.error('Could not show export success modal:', modalError);
      // Fallback: show alert instead
      alert(`✅ Configuration exported successfully!\n\n📦 What was saved:\n• ${summary.join('\n• ')}`);
    }
    
  } catch (error) {
    console.error('Error exporting configuration:', error);
    
    // Reset button state
    const exportBtn = document.getElementById('export-config-btn');
    if (exportBtn) {
      exportBtn.textContent = '📤 Export Configuration';
      exportBtn.disabled = false;
    }
    
    // Show error message
    try {
      api.ui.components.createModal({
        title: 'Export Failed',
        content: `<p style="color: #e78284;">Failed to export configuration: ${error.message}</p>`,
        buttons: [{ text: 'OK', primary: true }]
      });
    } catch (modalError) {
      console.error('Could not show export error modal:', modalError);
      alert(`Failed to export configuration: ${error.message}`);
    }
  }
}

// Import configuration function
async function importConfiguration(modal) {
  try {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
         input.onchange = async (event) => {
       console.log('[Configurator] File input change event triggered');
       const file = event.target.files[0];
       if (!file) {
         console.log('[Configurator] No file selected');
         return;
       }
       
       console.log('[Configurator] File selected:', file.name, file.size, 'bytes');
       
       try {
         console.log('[Configurator] Reading file...');
         const text = await file.text();
         console.log('[Configurator] File read, parsing JSON...');
         const importData = JSON.parse(text);
         console.log('[Configurator] JSON parsed successfully, importData keys:', Object.keys(importData));
        
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
         
         if (importData.modStatus && Object.keys(importData.modStatus).length > 0) {
           info.push(`Mod Status: ${Object.keys(importData.modStatus).length} entries`);
         }
        
                 if (importData.exportInfo) {
           info.push(`\nAdditional Data:`);
           if (importData.exportInfo.hasUtilityCache) info.push(`• Utility script cache`);
           if (importData.exportInfo.hasScriptCaches) info.push(`• Script caches (${Object.keys(importData.scriptCaches || {}).length} cached scripts)`);
           if (importData.exportInfo.hasModLocalStorage) info.push(`• Mod localStorage data (${Object.keys(importData.modLocalStorage || {}).length} items)`);
           if (importData.exportInfo.totalModStatus > 0) info.push(`• Mod status data (${importData.exportInfo.totalModStatus} entries)`);
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
           if (importData.exportInfo.hasRunData) {
             const runStats = importData.runData?.metadata;
             if (runStats && runStats.totalRuns > 0) {
               info.push(`• Run data: ${runStats.totalRuns} runs across ${runStats.totalMaps} maps`);
             }
           }
           if (importData.locale) info.push(`• Language preference: ${importData.locale}`);
         }
        
                 // Create user-friendly confirmation info
         const confirmInfo = generateSummary(importData, true);
         
         const confirmMessage = confirmInfo.length > 0 
           ? `This will replace your current configuration. Are you sure you want to continue?\n\n📦 What will be imported:\n• ${confirmInfo.join('\n• ')}`
           : 'This will replace your current configuration. Are you sure you want to continue?\n\n📦 Basic configuration will be imported.';
         
         // Show confirmation modal
         const confirmed = await new Promise(resolve => {
           const confirmModal = api.ui.components.createModal({
             title: 'Confirm Import',
             width: 450,
             content: `
               <div style="padding: 20px;">
                 <p style="color: #a6adc8; margin-bottom: 20px; white-space: pre-line;">${confirmMessage}</p>
                 <div style="background: rgba(255, 0, 0, 0.1); border: 1px solid rgba(255, 0, 0, 0.3); border-radius: 8px; padding: 12px; margin-top: 15px;">
                   <p style="color: #e78284; margin: 0; font-size: 14px;">
                     <strong>⚠️ Warning:</strong> This will overwrite your current configuration and game data.
                   </p>
                 </div>
               </div>
             `,
             buttons: [
               {
                 text: 'Cancel',
                 primary: false,
                 onClick: () => {
                   // Close modal by removing it from DOM
                   document.querySelectorAll('.modal-bg, .modal-content, .modal-overlay, [role="dialog"]').forEach(el => {
                     safeRemoveElement(el);
                   });
                   resolve(false);
                 }
               },
               {
                 text: 'Import Configuration',
                 primary: true,
                 onClick: () => {
                   // Close modal by removing it from DOM
                   document.querySelectorAll('.modal-bg, .modal-content, .modal-overlay, [role="dialog"]').forEach(el => {
                     safeRemoveElement(el);
                   });
                   resolve(true);
                 }
               }
             ]
           });
         });
         
         if (!confirmed) return;
        
        // Show loading state
        const importBtn = document.getElementById('import-config-btn');
        if (importBtn) {
          importBtn.textContent = '⏳ Importing...';
          importBtn.disabled = true;
        }
        
        // Import the data using browser storage API
        if (window.browserAPI && window.browserAPI.storage) {
          // Import active scripts to sync storage
          if (window.browserAPI.storage.sync) {
            await new Promise(resolve => {
              window.browserAPI.storage.sync.set({ activeScripts: importData.activeScripts }, resolve);
            });
          }
          
                     // Save localMods using background script
           if (window.browserAPI.runtime) {
             await new Promise(resolve => {
               window.browserAPI.runtime.sendMessage({ 
                 action: 'registerLocalMods', 
                 mods: importData.localMods 
               }, response => {
                 if (response && response.success) {
                   console.log('Local mods registered successfully');
                 } else {
                   console.warn('Failed to register local mods:', response);
                 }
                 resolve();
               });
             });
           }
          
          if (window.browserAPI.storage.local) {
            // Batch import basic settings
            const basicSettings = {
              manualMods: importData.manualMods,
              localModsConfig: importData.localModsConfig
            };
            
            // Add optional settings if they exist
            if (importData.dashboardTheme) {
              basicSettings['dashboard-theme'] = importData.dashboardTheme;
            }
            if (importData.locale) {
              basicSettings.locale = importData.locale;
            }
            if (importData.utilityScriptCache && importData.utilityScriptTimestamp) {
              basicSettings['utility_script_cache'] = importData.utilityScriptCache;
              basicSettings['utility_script_timestamp'] = importData.utilityScriptTimestamp;
            }
            
            await new Promise(resolve => {
              window.browserAPI.storage.local.set(basicSettings, resolve);
            });
          }
          
          // Import script caches if available
          if (importData.scriptCaches && Object.keys(importData.scriptCaches).length > 0 && window.browserAPI.storage.local) {
            await new Promise(resolve => {
              window.browserAPI.storage.local.set(importData.scriptCaches, resolve);
            });
          }
          
                     // Import mod localStorage data if available
           if (importData.modLocalStorage && Object.keys(importData.modLocalStorage).length > 0 && window.browserAPI.storage.local) {
             await new Promise(resolve => {
               window.browserAPI.storage.local.set(importData.modLocalStorage, resolve);
             });
           }
           
           // Import run data if available
           if (importData.runData) {
             if (window.RunTrackerAPI) {
               await window.RunTrackerAPI.importRuns(importData);
             } else if (window.browserAPI.storage.local) {
               await new Promise(resolve => {
                 window.browserAPI.storage.local.set({ ba_local_runs: importData.runData }, resolve);
               });
             }
           }
           
           // Import mod status data if available
           if (importData.modStatus && Object.keys(importData.modStatus).length > 0) {
             // Update localMods with the correct enabled states
             if (importData.localMods && Array.isArray(importData.localMods)) {
               const updatedLocalMods = importData.localMods.map(mod => ({
                 ...mod,
                 enabled: importData.modStatus[mod.name] !== undefined ? importData.modStatus[mod.name] : mod.enabled
               }));
               
               // Save updated localMods to both sync and local storage
               if (window.browserAPI.storage.sync) {
                 await new Promise(resolve => {
                   window.browserAPI.storage.sync.set({ localMods: updatedLocalMods }, resolve);
                 });
               }
               if (window.browserAPI.storage.local) {
                 await new Promise(resolve => {
                   window.browserAPI.storage.local.set({ localMods: updatedLocalMods }, resolve);
                 });
               }
             }
           }
        }
        
                 // Import game localStorage data if available
         if (importData.gameLocalStorage && Object.keys(importData.gameLocalStorage).length > 0) {
           try {
             // Backup current localStorage before clearing
             const currentLocalStorage = {};
             for (let i = 0; i < localStorage.length; i++) {
               const key = localStorage.key(i);
               if (key) {
                 currentLocalStorage[key] = localStorage.getItem(key);
               }
             }
             
             // Clear existing localStorage
             localStorage.clear();
             
             // Set new localStorage data
             Object.keys(importData.gameLocalStorage).forEach(key => {
               try {
                 localStorage.setItem(key, importData.gameLocalStorage[key]);
               } catch (e) {
                 console.warn('Could not set localStorage key:', key, e);
                 // Restore backup on failure
                 Object.keys(currentLocalStorage).forEach(backupKey => {
                   try {
                     localStorage.setItem(backupKey, currentLocalStorage[backupKey]);
                   } catch (restoreError) {
                     console.error('Failed to restore localStorage backup:', restoreError);
                   }
                 });
                 throw new Error(`Failed to set localStorage key: ${key}`);
               }
             });
             
             console.log(`Restored ${Object.keys(importData.gameLocalStorage).length} game localStorage items`);
           } catch (error) {
             console.log('Could not restore game localStorage:', error);
             alert('Warning: Failed to restore game localStorage data: ' + error.message);
           }
         }
        
                 // Reset button state
         console.log('[Configurator] Resetting button state...');
         if (importBtn) {
           importBtn.textContent = '📥 Import Configuration';
           importBtn.disabled = false;
         }
         
         console.log('[Configurator] Import process completed successfully');
        
                 // Create user-friendly import summary
         console.log('[Configurator] Creating import summary...');
         const importSummary = generateSummary(importData, true);
         console.log('[Configurator] Import summary:', importSummary);
         
         const message = importSummary.length > 0 
           ? `✅ Configuration imported successfully!\n\n📦 What was restored:\n• ${importSummary.join('\n• ')}\n\n🔄 Please refresh the page to see all changes.`
           : '✅ Configuration imported successfully!\n\n📦 Basic settings restored\n\n🔄 Please refresh the page to see all changes.';
         
         console.log('[Configurator] Success message:', message);
         
                             // Show success message with fallback handling
          if (api && api.ui && api.ui.components && api.ui.components.createModal) {
            try {
              // Try to create the modal
              const successModal = api.ui.components.createModal({
                title: 'Import Successful',
                content: `<p style="color: #a6adc8;">${message}</p>`,
                buttons: [{ text: 'OK', primary: true }]
              });
              
              // Check if modal was created and is visible
              setTimeout(() => {
                const modalElements = document.querySelectorAll('[role="dialog"], .modal-bg, .modal-content, .modal-overlay');
                if (modalElements.length === 0) {
                  // Modal was auto-closed, create persistent modal
                  try {
                    api.ui.components.createModal({
                      title: 'Import Successful',
                      content: `<p style="color: #a6adc8;">${message}</p>`,
                      buttons: [{ 
                        text: 'OK', 
                        primary: true,
                        onClick: (e, modalObj) => {
                          if (modalObj && typeof modalObj.close === 'function') {
                            modalObj.close();
                          }
                        }
                      }]
                    });
                  } catch (persistentError) {
                    console.error('[Configurator] Persistent modal failed:', persistentError);
                    alert(`✅ Configuration imported successfully!\n\n📦 What was restored:\n• ${importSummary.join('\n• ')}\n\n🔄 Please refresh the page to see all changes.`);
                  }
                }
              }, 100);
              
            } catch (modalError) {
              console.error('[Configurator] Could not show import success modal:', modalError);
              // Fallback: show alert instead
              alert(`✅ Configuration imported successfully!\n\n📦 What was restored:\n• ${importSummary.join('\n• ')}\n\n🔄 Please refresh the page to see all changes.`);
            }
          } else {
            // UI components not available, use alert as fallback
            alert(`✅ Configuration imported successfully!\n\n📦 What was restored:\n• ${importSummary.join('\n• ')}\n\n🔄 Please refresh the page to see all changes.`);
          }
        
                 // Close the configurator modal - use a simple approach
         try {
           if (modal && typeof modal.close === 'function') {
             modal.close();
           } else {
             // Fallback: remove modal elements from DOM
             document.querySelectorAll('.modal-bg, .modal-content, .modal-overlay, [role="dialog"]').forEach(el => {
               safeRemoveElement(el);
             });
           }
         } catch (closeError) {
           console.warn('Could not close modal:', closeError);
           // Final fallback: remove all modal-like elements
           document.querySelectorAll('div[style*="position: fixed"][style*="z-index: 999"]').forEach(el => {
             safeRemoveElement(el);
           });
         }
        
             } catch (error) {
         console.error('[Configurator] Error importing configuration:', error);
         console.error('[Configurator] Error details:', {
           name: error.name,
           message: error.message,
           stack: error.stack
         });
         
         // Reset button state
         const importBtn = document.getElementById('import-config-btn');
         if (importBtn) {
           importBtn.textContent = '📥 Import Configuration';
           importBtn.disabled = false;
         }
         
         // Show error message
         try {
           api.ui.components.createModal({
             title: 'Import Failed',
             content: `<p style="color: #e78284;">Failed to import configuration: ${error.message}</p>`,
             buttons: [{ text: 'OK', primary: true }]
           });
         } catch (modalError) {
           console.error('Could not show error modal:', modalError);
           alert(`Failed to import configuration: ${error.message}`);
         }
       }
      
      // Clean up
      document.body.removeChild(input);
    };
    
    document.body.appendChild(input);
    input.click();
  } catch (error) {
    console.error('Error setting up import:', error);
    api.ui.components.createModal({
      title: 'Import Error',
      content: `<p style="color: #e78284;">Failed to set up import: ${error.message}</p>`,
      buttons: [{ text: 'OK', primary: true }]
    });
  }
}

// Initialize the mod
addConfiguratorHeaderButton();

// Export functionality
exports = {
  openConfigurator,
  exportConfiguration,
  importConfiguration,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
  }
};
