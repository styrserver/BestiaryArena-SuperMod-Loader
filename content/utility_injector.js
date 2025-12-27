// Polyfill for Chrome and Firefox WebExtensions
if (typeof window.browser === 'undefined') {
  window.browser = window.chrome;
}

window.browserAPI = window.browserAPI || (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

// Utility Injector - Loads the utility functions directly from local file

(function() {
  console.log('BA Utility Injector: Starting');
  
  // Function to inject sandbox utils directly from local file
  function injectSandboxUtils() {
    console.log('BA Utility Injector: Injecting sandbox utils from local file');
    
    // Create and inject the script
    const script = document.createElement('script');
    script.type = 'module';
    script.src = browserAPI.runtime.getURL('content/ba-sandbox-utils.mjs');
    
    // Handle script loading events
    script.onload = function() {
      console.log('BA Utility Injector: Sandbox utils loaded successfully');
      // After sandbox utils load, inject custom battles system
      injectCustomBattles();
    };
    
    script.onerror = function(error) {
      console.error('BA Utility Injector: Error loading sandbox utils:', error);
      // Still try to inject custom battles even if sandbox utils fails
      injectCustomBattles();
    };
    
    document.head.appendChild(script);
  }
  
  // Function to inject custom battles system
  function injectCustomBattles() {
    console.log('BA Utility Injector: Injecting custom battles system');
    
    // Create and inject the script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = browserAPI.runtime.getURL('content/custom-battles.js');
    
    // Handle script loading events
    script.onload = function() {
      console.log('BA Utility Injector: Custom battles script element loaded');
      // Note: Content scripts run in isolated context, so window.CustomBattles
      // may not be visible here, but mods (which run in page context) will be able to see it.
      // The script logs show it IS executing and setting window.CustomBattles in the page context.
      console.log('BA Utility Injector: custom-battles.js loaded - mods will be able to access window.CustomBattles');
    };
    
    script.onerror = function(error) {
      console.error('BA Utility Injector: ✗ ERROR loading custom battles system:', error);
      console.error('BA Utility Injector: Script URL was:', browserAPI.runtime.getURL('content/custom-battles.js'));
    };
    
    document.head.appendChild(script);
  }
  
  // Inject as soon as possible but wait for the document to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSandboxUtils);
  } else {
    injectSandboxUtils();
  }
})(); 

// Inject style to remove modal overlay darkening
document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.innerHTML = `
    .modal-overlay, .fixed.inset-0 {
      background: transparent !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);

  // Patch global modal creation to prevent overlay stacking
  function removeAllModalsAndOverlays() {
    // Remove all modal overlays
    document.querySelectorAll('.modal-overlay, .fixed.inset-0').forEach(overlay => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    });
    // Remove all open modals/dialogs
    document.querySelectorAll('div[role="dialog"][data-state="open"]').forEach(dialog => {
      if (dialog && dialog.parentNode) {
        dialog.parentNode.removeChild(dialog);
      }
    });
  }

  function patchGlobalModalCreation() {
    if (window.api && window.api.ui && window.api.ui.components && typeof window.api.ui.components.createModal === 'function') {
      const originalCreateModal = window.api.ui.components.createModal;
      window.api.ui.components.createModal = function(options) {
        removeAllModalsAndOverlays();
        return originalCreateModal.call(this, options);
      };
    } else {
      // If api is not ready yet, try again soon
      setTimeout(patchGlobalModalCreation, 500);
    }
  }

  patchGlobalModalCreation();
}); 

  // Add executeCommand function to window
  window.executeCommand = function(command) {
    console.log('[Utility Injector] Executing command:', command);
    
    try {
      // First, try to execute through the game's console system if available
      if (window.api && window.api.console && typeof window.api.console.execute === 'function') {
        try {
          window.api.console.execute(command);
          console.log('[Utility Injector] Command executed through game console API');
          return true;
        } catch (consoleError) {
          console.error('[Utility Injector] Error executing through game console:', consoleError);
        }
      }
      
      // Try to find and use the game's command execution system
      if (window.api && window.api.utils && typeof window.api.utils.executeCommand === 'function') {
        try {
          window.api.utils.executeCommand(command);
          console.log('[Utility Injector] Command executed through game utils API');
          return true;
        } catch (utilsError) {
          console.error('[Utility Injector] Error executing through game utils:', utilsError);
        }
      }
      
      // Try to access the game's global command system
      if (window.$replay || window.replay) {
        try {
          // If it's a replay command, try to parse and execute it
          if (command.startsWith('$replay(')) {
            const replayData = command.substring(8, command.length - 1); // Remove $replay( and )
            const parsedData = JSON.parse(replayData);
            
            if (window.$replay) {
              window.$replay(parsedData);
              console.log('[Utility Injector] Replay command executed through $replay function');
              return true;
            } else if (window.replay) {
              window.replay(parsedData);
              console.log('[Utility Injector] Replay command executed through replay function');
              return true;
            }
          }
        } catch (parseError) {
          console.error('[Utility Injector] Error parsing replay command:', parseError);
        }
      }
      
      // Try to find the command in the global scope
      if (command.startsWith('$')) {
        const commandName = command.substring(1, command.indexOf('('));
        if (window[commandName]) {
          try {
            const args = command.substring(command.indexOf('(') + 1, command.lastIndexOf(')'));
            const parsedArgs = JSON.parse(args);
            window[commandName](parsedArgs);
            console.log('[Utility Injector] Command executed through global function:', commandName);
            return true;
          } catch (argError) {
            console.error('[Utility Injector] Error parsing command arguments:', argError);
          }
        }
      }
      
      // Last resort: try to execute the command directly (this might not work for game commands)
      const result = eval(command);
      console.log('[Utility Injector] Command executed directly:', result);
      return result;
    } catch (error) {
      console.error('[Utility Injector] Error executing command:', error);
      
      // If all else fails, try to trigger the command through the game's input system
      try {
        // Look for any input or command elements in the game
        const commandInputs = document.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
        for (const input of commandInputs) {
          if (input.style.display !== 'none' && input.offsetParent !== null) {
            input.value = command;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            console.log('[Utility Injector] Command sent through input element');
            return true;
          }
        }
      } catch (inputError) {
        console.error('[Utility Injector] Error sending command through input:', inputError);
      }
      
      return false;
    }
  }; 