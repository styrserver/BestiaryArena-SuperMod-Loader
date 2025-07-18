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
    };
    
    script.onerror = function(error) {
      console.error('BA Utility Injector: Error loading sandbox utils:', error);
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