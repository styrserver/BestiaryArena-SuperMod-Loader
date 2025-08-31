// Global debug utilities for Bestiary Arena Mod Loader
// This file provides centralized debug control for all mods

class DebugManager {
  constructor() {
    this.debugEnabled = false;
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug
    };
    
    this.init();
  }

  init() {
    // Load saved debug state
    this.loadDebugState();
    
    // Override console methods
    this.overrideConsole();
    
    // Make debug manager globally available
    window.debugManager = this;
    
    // Listen for debug state changes from popup
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.action === 'debugStateChanged') {
        this.setDebugState(event.data.debugEnabled);
      }
    });
  }

  loadDebugState() {
    try {
      const saved = localStorage.getItem('bestiary_debug_enabled');
      this.debugEnabled = saved === 'true';
    } catch (e) {
      this.debugEnabled = false;
    }
  }

  saveDebugState() {
    try {
      localStorage.setItem('bestiary_debug_enabled', this.debugEnabled.toString());
    } catch (e) {
      // Silently fail if localStorage is not available
    }
  }

  setDebugState(enabled) {
    this.debugEnabled = enabled;
    this.saveDebugState();
    this.overrideConsole();
    
    // Notify all mods about debug state change
    window.postMessage({
      from: 'BESTIARY_EXTENSION',
      action: 'debugStateChanged',
      debugEnabled: this.debugEnabled
    }, '*');
  }

  toggleDebug() {
    this.setDebugState(!this.debugEnabled);
    return this.debugEnabled;
  }

  overrideConsole() {
    if (this.debugEnabled) {
      // Restore original console methods
      console.log = this.originalConsole.log;
      console.warn = this.originalConsole.warn;
      console.error = this.originalConsole.error;
      console.info = this.originalConsole.info;
      console.debug = this.originalConsole.debug;
    } else {
      // Override with no-op functions
      console.log = () => {};
      console.warn = () => {};
      console.info = () => {};
      console.debug = () => {};
      // Keep error logging for critical issues
      console.error = this.originalConsole.error;
    }
  }

  // Utility method for mods to check debug state
  isDebugEnabled() {
    return this.debugEnabled;
  }

  // Conditional logging - only logs when debug is enabled
  debugLog(...args) {
    if (this.debugEnabled) {
      this.originalConsole.log('[DEBUG]', ...args);
    }
  }

  debugWarn(...args) {
    if (this.debugEnabled) {
      this.originalConsole.warn('[DEBUG]', ...args);
    }
  }
}

// Initialize debug manager when script loads
const debugManager = new DebugManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DebugManager;
}
