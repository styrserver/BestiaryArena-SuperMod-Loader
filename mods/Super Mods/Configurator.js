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

// Toast creation function based on Welcome.js implementation
function createToast({ message, type = 'info', duration = 5000, icon = null }) {
  // Get or create the main toast container
  let mainContainer = document.getElementById('configurator-toast-container');
  if (!mainContainer) {
    mainContainer = document.createElement('div');
    mainContainer.id = 'configurator-toast-container';
    mainContainer.style.cssText = `
      position: fixed;
      z-index: 9999;
      inset: 16px 16px 64px;
      pointer-events: none;
    `;
    mainContainer.setAttribute('data-aria-hidden', 'true');
    mainContainer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(mainContainer);
  }
  
  // Count existing toasts to calculate stacking position
  const existingToasts = mainContainer.querySelectorAll('.toast-item');
  const stackOffset = existingToasts.length * 46; // 46px per toast
  
  // Create the flex container for this specific toast
  const flexContainer = document.createElement('div');
  flexContainer.className = 'toast-item';
  flexContainer.style.cssText = `
    left: 0px;
    right: 0px;
    display: flex;
    position: absolute;
    transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1);
    transform: translateY(-${stackOffset}px);
    bottom: 0px;
    justify-content: flex-end;
  `;
  
  // Create toast button with proper animation classes
  const toast = document.createElement('button');
  toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
  
  // Create widget structure to match game's toast style
  const widgetTop = document.createElement('div');
  widgetTop.className = 'widget-top h-2.5';
  
  const widgetBottom = document.createElement('div');
  widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';
  
  // Add icon if provided
  if (icon) {
    const iconImg = document.createElement('img');
    iconImg.alt = type;
    iconImg.src = icon;
    iconImg.className = 'pixelated';
    iconImg.style.cssText = 'width: 20px; height: 20px;';
    widgetBottom.appendChild(iconImg);
  }
  
  // Add message
  const messageDiv = document.createElement('div');
  messageDiv.className = 'text-left';
  messageDiv.innerHTML = message; // Use innerHTML to support HTML content
  widgetBottom.appendChild(messageDiv);
  
  // Assemble toast
  toast.appendChild(widgetTop);
  toast.appendChild(widgetBottom);
  flexContainer.appendChild(toast);
  mainContainer.appendChild(flexContainer);
  
  // Auto-remove after duration
  const timeoutId = setTimeout(() => {
    if (flexContainer && flexContainer.parentNode) {
      flexContainer.parentNode.removeChild(flexContainer);
      updateToastPositions(mainContainer);
    }
    activeTimeouts.delete(timeoutId);
  }, duration);
  activeTimeouts.add(timeoutId);
  
  return {
    element: flexContainer,
    remove: () => {
      if (flexContainer && flexContainer.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        updateToastPositions(mainContainer);
      }
    }
  };
}

// Update positions of remaining toasts when one is removed
function updateToastPositions(container) {
  const toasts = container.querySelectorAll('.toast-item');
  toasts.forEach((toast, index) => {
    const offset = index * 46;
    toast.style.transform = `translateY(-${offset}px)`;
  });
}

// Configuration
const defaultConfig = {
  enabled: true,
  showNotifications: true
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Track timeouts and event listeners for cleanup
const activeTimeouts = new Set();
const activeEventListeners = new Map();

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
      const timeoutId = setTimeout(tryInsert, 500);
      activeTimeouts.add(timeoutId);
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
  const timeoutId = setTimeout(() => {
    const exportBtn = document.getElementById('export-config-btn');
    const importBtn = document.getElementById('import-config-btn');
    
    if (exportBtn) {
      const exportHandler = () => {
        exportConfiguration(modal);
      };
      exportBtn.addEventListener('click', exportHandler);
      activeEventListeners.set(exportBtn, { event: 'click', handler: exportHandler });
    }
    
    if (importBtn) {
      const importHandler = () => {
        importConfiguration(modal);
      };
      importBtn.addEventListener('click', importHandler);
      activeEventListeners.set(importBtn, { event: 'click', handler: importHandler });
    }
    activeTimeouts.delete(timeoutId);
  }, 100);
  activeTimeouts.add(timeoutId);
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
    
    // Show success message using toast
    try {
      createToast({
        message: `<span class="text-success">✅ Configuration exported successfully!</span><br><span class="text-whiteHighlight">📦 What was saved:</span><br>• ${summary.join('<br>• ')}`,
        type: 'success',
        duration: 8000
      });
    } catch (toastError) {
      console.error('Could not show export success toast:', toastError);
      // Fallback: show alert instead
      alert(`✅ Configuration exported successfully!\n\n📦 What was saved:\n• ${summary.join('\n• ')}`);
    }
    
    // Close the modal after successful export
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
      console.warn('[Configurator] Could not close modal after export:', closeError);
    }
    
  } catch (error) {
    console.error('Error exporting configuration:', error);
    
    // Reset button state
    const exportBtn = document.getElementById('export-config-btn');
    if (exportBtn) {
      exportBtn.textContent = '📤 Export Configuration';
      exportBtn.disabled = false;
    }
    
    // Show error message using toast
    try {
      createToast({
        message: `<span class="text-error">❌ Export Failed</span><br><span class="text-whiteHighlight">Failed to export configuration: ${error.message}</span>`,
        type: 'error',
        duration: 6000
      });
    } catch (toastError) {
      console.error('Could not show export error toast:', toastError);
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
         
                             // Show success message using toast
          try {
            createToast({
              message: `<span class="text-success">✅ Configuration imported successfully!</span><br><span class="text-whiteHighlight">📦 What was restored:</span><br>• ${importSummary.join('<br>• ')}<br><br><span class="text-warning">🔄 Please refresh the page to see all changes.</span>`,
              type: 'success',
              duration: 10000
            });
          } catch (toastError) {
            console.error('[Configurator] Could not show import success toast:', toastError);
            // Fallback: show alert instead
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
         
         // Show error message using toast
         try {
           createToast({
             message: `<span class="text-error">❌ Import Failed</span><br><span class="text-whiteHighlight">Failed to import configuration: ${error.message}</span>`,
             type: 'error',
             duration: 6000
           });
         } catch (toastError) {
           console.error('Could not show error toast:', toastError);
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
    try {
      createToast({
        message: `<span class="text-error">❌ Import Setup Error</span><br><span class="text-whiteHighlight">Failed to set up import: ${error.message}</span>`,
        type: 'error',
        duration: 6000
      });
    } catch (toastError) {
      console.error('Could not show setup error toast:', toastError);
      alert(`Failed to set up import: ${error.message}`);
    }
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
  },
  cleanup: () => {
    console.log('[Configurator] Exports cleanup called');
    try {
      // Call the global cleanup function
      if (window.cleanupSuperModsConfiguratorjs) {
        window.cleanupSuperModsConfiguratorjs();
      }
      console.log('[Configurator] Exports cleanup completed');
    } catch (error) {
      console.error('[Configurator] Exports cleanup error:', error);
    }
  }
};

// Cleanup function for Configurator mod
window.cleanupSuperModsConfiguratorjs = function() {
  try {
    console.log('[Configurator] Starting comprehensive cleanup...');
    
    // Clear all active timeouts
    activeTimeouts.forEach(timeoutId => {
      try {
        clearTimeout(timeoutId);
      } catch (error) {
        console.warn('[Configurator] Error clearing timeout:', error);
      }
    });
    activeTimeouts.clear();
    
    // Remove all tracked event listeners
    activeEventListeners.forEach((listenerInfo, element) => {
      try {
        if (element && element.removeEventListener) {
          element.removeEventListener(listenerInfo.event, listenerInfo.handler);
        }
      } catch (error) {
        console.warn('[Configurator] Error removing event listener:', error);
      }
    });
    activeEventListeners.clear();
    
    // Remove configurator header button
    const configuratorBtn = document.querySelector('.configurator-header-btn');
    if (configuratorBtn && configuratorBtn.parentNode) {
      try {
        configuratorBtn.parentNode.remove();
      } catch (error) {
        console.warn('[Configurator] Error removing header button:', error);
      }
    }
    
    // Remove any existing modals (multiple selectors for comprehensive cleanup)
    const modalSelectors = [
      '#configurator-modal',
      '.modal-bg',
      '.modal-content', 
      '.modal-overlay',
      '[role="dialog"]'
    ];
    
    modalSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        try {
          safeRemoveElement(element);
        } catch (error) {
          console.warn('[Configurator] Error removing modal element:', error);
        }
      });
    });
    
    // Remove toast container and all toasts
    const toastContainer = document.getElementById('configurator-toast-container');
    if (toastContainer) {
      try {
        safeRemoveElement(toastContainer);
      } catch (error) {
        console.warn('[Configurator] Error removing toast container:', error);
      }
    }
    
    // Clean up any temporary file input elements
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
      try {
        if (input.parentNode && input.parentNode.contains(input)) {
          input.parentNode.removeChild(input);
        }
      } catch (error) {
        console.warn('[Configurator] Error removing file input:', error);
      }
    });
    
    // Clean up any temporary download links
    const downloadLinks = document.querySelectorAll('a[download]');
    downloadLinks.forEach(link => {
      try {
        if (link.href && link.href.startsWith('blob:')) {
          URL.revokeObjectURL(link.href);
        }
        if (link.parentNode && link.parentNode.contains(link)) {
          link.parentNode.removeChild(link);
        }
      } catch (error) {
        console.warn('[Configurator] Error removing download link:', error);
      }
    });
    
    // Clear any cached data and global state
    if (typeof window.configuratorState !== 'undefined') {
      try {
        delete window.configuratorState;
      } catch (error) {
        console.warn('[Configurator] Error clearing configurator state:', error);
      }
    }
    
    // Clear any remaining global references
    try {
      if (window.configuratorModal) {
        delete window.configuratorModal;
      }
    } catch (error) {
      console.warn('[Configurator] Error clearing modal reference:', error);
    }
    
    console.log('[Configurator] Cleanup completed successfully');
  } catch (error) {
    console.error('[Configurator] Error during cleanup:', error);
  }
};