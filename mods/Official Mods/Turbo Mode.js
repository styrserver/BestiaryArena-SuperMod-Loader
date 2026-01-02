// DOM Turbo with Ticks mod for Bestiary Arena
console.log('Turbo Mod initializing...');

// Use shared translation system via API
const t = (key) => api.i18n.t(key);

// Constants
const DEFAULT_TICK_INTERVAL_MS = 62.5;

// Set up the mod state (will persist across script executions)
if (!window.__turboState) {
  window.__turboState = {
    active: false,
    tickDisplayElement: null,
    speedupFactor: 5,
    timerCheckInterval: null,
    lastKnownTick: -1,
    timerSubscribed: false,
    gameControlsObserver: null,
    speedupSubscription: null,
    enable: null,  // Will be set after functions are defined
    disable: null  // Will be set after functions are defined
  };
}

// Store reference to state for easier access
const turboState = window.__turboState;

// Function to enable turbo mode with the new approach
function enableTurbo() {
  if (turboState.active) return; // Already active
  
  console.log('Enabling Turbo mode...');
  turboState.active = true;
  
  // Apply time scale using the new approach
  setTimeScale(turboState.speedupFactor);
  
  // Try to create tick display immediately, or set up observer if not possible yet
  if (!tryInitTickDisplay()) {
    setupMutationObserver();
  }
  
  // Set up interval to check for game timer and resubscribe when needed
  setupTimerWatcher();
  
  // Watch for game controls
  watchForGameControls();
  
  console.log('Turbo mode enabled with factor:', turboState.speedupFactor);
  
  // Update button text
  if (window.turboButton) {
    window.turboButton.textContent = 'Disable Turbo';
  }
  updateTurboButton();
}

// Implementation of the new setTimeScale function
function setTimeScale(factor) {
  // Remove any previous custom handlers. This restores the original tick interval.
  if (turboState.speedupSubscription) {
    turboState.speedupSubscription.unsubscribe();
    turboState.speedupSubscription = null;
  }

  // If factor is 1 or less, the original tick interval is desired. Nothing to do here.
  if (factor <= 1) return;

  // Otherwise, set up a custom handler that adjusts the tick interval.
  const interval = Math.max(DEFAULT_TICK_INTERVAL_MS / factor, 16); // Minimum 16ms (60fps) for performance
      console.log(`Setting tick interval to ${interval}ms (${factor}x speed)`);
  
  turboState.speedupSubscription = globalThis.state.board.on('newGame', (event) => {
    event.world.tickEngine.setTickInterval(interval);
  });
  
  // Try to adjust tick interval of current game if it exists
  if (globalThis.state?.board?.getSnapshot()?.context?.world?.tickEngine) {
    const tickEngine = globalThis.state.board.getSnapshot().context.world.tickEngine;
    console.log(`Setting tick interval for existing game to ${interval}ms`);
    tickEngine.setTickInterval(interval);
  }
}

// Function to disable turbo mode
function disableTurbo() {
  if (!turboState.active) return; // Not active
  
  console.log('Disabling Turbo mode...');
  
  // Update tick display
  if (turboState.tickDisplayElement) {
    turboState.tickDisplayElement.style.color = '#888';
    turboState.tickDisplayElement.textContent = 'Turbo: OFF';
  }
  
  // Disconnect observer if it exists
  if (turboState.observer) {
    turboState.observer.disconnect();
    turboState.observer = null;
  }
  
  // Disconnect game controls observer
  if (turboState.gameControlsObserver) {
    turboState.gameControlsObserver.disconnect();
    turboState.gameControlsObserver = null;
  }
  
  // Clear timer watcher interval
  if (turboState.timerCheckInterval) {
    clearInterval(turboState.timerCheckInterval);
    turboState.timerCheckInterval = null;
  }
  
  // Remove speedup subscription - this automatically resets the tick interval
  if (turboState.speedupSubscription) {
    turboState.speedupSubscription.unsubscribe();
    turboState.speedupSubscription = null;
  }
  
  turboState.active = false;
  turboState.timerSubscribed = false;
  console.log('Turbo mode disabled');
  
  // Update button text
  if (window.turboButton) {
    window.turboButton.textContent = 'Enable Turbo';
  }
  updateTurboButton();
  
  // Reset tick interval of current game if it exists
  if (globalThis.state?.board?.getSnapshot()?.context?.world?.tickEngine) {
    const tickEngine = globalThis.state.board.getSnapshot().context.world.tickEngine;
    console.log(`Resetting tick interval to ${DEFAULT_TICK_INTERVAL_MS}ms`);
    tickEngine.setTickInterval(DEFAULT_TICK_INTERVAL_MS);
  }
}

// Set up interval to watch for game timer changes and resubscribe when needed
function setupTimerWatcher() {
  if (turboState.timerCheckInterval) {
    clearInterval(turboState.timerCheckInterval);
  }
  
  turboState.timerCheckInterval = setInterval(() => {
    if (!turboState.active) return;
    
    const tickDisplayExists = turboState.tickDisplayElement !== null;
    const timerAvailable = globalThis.state && state.gameTimer && typeof state.gameTimer.subscribe === 'function';
    
    // Check if we need to create the tick display
    if (!tickDisplayExists) {
      if (tryInitTickDisplay()) {
        console.log('Tick display created during watcher interval');
      }
      return;
    }
    
    // If the game timer is available but we're not subscribed, subscribe
    if (timerAvailable && !turboState.timerSubscribed) {
      console.log('Timer available but not subscribed, subscribing now...');
      subscribeToGameTimer();
      return;
    }
    
    // If the display shows just "Turbo: ON" but timer is available, we need to subscribe
    if (tickDisplayExists && timerAvailable && 
        (turboState.tickDisplayElement.textContent === 'Turbo: ON' || 
         turboState.tickDisplayElement.textContent === 'Turbo: ON | Lost connection to timer')) {
      console.log('Display shows no ticks or lost connection, subscribing...');
      subscribeToGameTimer();
    }
  }, 1000); // Check every second for better performance at high speeds
}

// Function to subscribe to the game timer
function subscribeToGameTimer() {
  if (!turboState.tickDisplayElement || 
      !globalThis.state || 
      !state.gameTimer || 
      typeof state.gameTimer.subscribe !== 'function') {
    
    if (turboState.tickDisplayElement && turboState.active) {
      turboState.tickDisplayElement.textContent = 'Turbo: ON | No timer available';
    }
    
    return false;
  }
  
  try {
    // Define our callback outside to help with debugging
    const timerCallback = ({ context }) => {
      if (!turboState.active || !turboState.tickDisplayElement) return;
      
      // If tick count went down, that means game was restarted
      if (context.currentTick < turboState.lastKnownTick && turboState.lastKnownTick > 0) {
        console.log('Detected game restart (tick reset)');
      }
      
      turboState.lastKnownTick = context.currentTick;
      
      // Update DOM every tick but use more efficient textContent assignment
      turboState.tickDisplayElement.textContent = `Turbo: ON | Ticks: ${context.currentTick}`;
      turboState.tickDisplayElement.style.color = '#00ff00';
      
      // If we get here, we're definitely subscribed
      turboState.timerSubscribed = true;
    };
    
    // Get current timer state to know if game is running
    let isGameRunning = false;
    try {
      const timerState = state.gameTimer.getSnapshot();
      isGameRunning = timerState && timerState.context && timerState.context.isRunning;
      console.log('Game running state:', isGameRunning);
    } catch (e) {
      console.warn('Could not get timer state:', e);
    }
    
    // Subscribe to timer updates
    const subscription = state.gameTimer.subscribe(timerCallback);
    
    if (subscription) {
      console.log('Successfully subscribed to game timer');
      turboState.timerSubscribed = true;
      
      // If game is not running, show a special message
      if (!isGameRunning && turboState.tickDisplayElement) {
        turboState.tickDisplayElement.textContent = 'Turbo: ON | Game paused';
      }
      
      return true;
    } else {
      console.warn('Subscription returned falsy value');
      turboState.timerSubscribed = false;
      
      if (turboState.tickDisplayElement) {
        turboState.tickDisplayElement.textContent = 'Turbo: ON | Failed to subscribe';
      }
      
      return false;
    }
  } catch (e) {
    console.error('Error subscribing to game timer:', e);
    turboState.timerSubscribed = false;
    
    if (turboState.tickDisplayElement) {
      turboState.tickDisplayElement.textContent = 'Turbo: ON | Lost connection to timer';
    }
    
    return false;
  }
}

// Try to create tick display element
function tryInitTickDisplay() {
  // Skip if Board Analyzer or Manual Runner is running
  if (window.__modCoordination?.boardAnalyzerRunning || window.__modCoordination?.manualRunnerActive) {
    return false;
  }
  
  const container = document.querySelector('.flex.flex-col.items-end.overflow-hidden');
  if (!container || document.getElementById('mb-game-timer')) return false;
  
        console.log('Creating tick display element...');
  const tickEl = document.createElement('div');
  tickEl.id = 'mb-game-timer';
  Object.assign(tickEl.style, {
    fontFamily: 'monospace',
    fontSize: '20px',
    color: turboState.active ? '#00ff00' : '#888',
    marginTop: '4px',
    textAlign: 'right'
  });
  
  tickEl.textContent = turboState.active ? 'Turbo: ON' : 'Turbo: OFF';
  container.appendChild(tickEl);
  turboState.tickDisplayElement = tickEl;
  
  // Attempt to subscribe to game timer
  if (turboState.active) {
    subscribeToGameTimer();
  }
  
  return true;
}

// Set up mutation observer to detect when we can create the tick display
function setupMutationObserver() {
  if (turboState.observer) {
    turboState.observer.disconnect();
  }
  
  turboState.observer = new MutationObserver(() => {
    if (tryInitTickDisplay()) {
      // Keep the observer running but don't create more displays
      // This allows us to detect if the display is removed
    }
  });
  
  turboState.observer.observe(document.body, { childList: true, subtree: true });
      console.log('Set up mutation observer for tick display');
}

// Add a function to detect game reset by watching for play button
function watchForGameControls() {
  // If we already have an observer, disconnect it first
  if (turboState.gameControlsObserver) {
    turboState.gameControlsObserver.disconnect();
  }
  
  turboState.gameControlsObserver = new MutationObserver((mutations) => {
    if (!turboState.active) return;
    
    // Cache button queries to avoid repeated DOM searches
    let playButton = null;
    let stopButton = null;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        // Only query DOM once per observer cycle
        if (!playButton) playButton = document.querySelector('button[aria-label="Play"]');
        if (!stopButton) stopButton = document.querySelector('button[aria-label="Stop"]');
        
        // If play button appears (game stopped), mark timer as unsubscribed so we resubscribe on next play
        if (playButton && turboState.timerSubscribed) {
          console.log('Game stopped (play button found), will resubscribe when started');
          turboState.timerSubscribed = false;
          
          if (turboState.tickDisplayElement) {
            turboState.tickDisplayElement.textContent = 'Turbo: ON | Game paused';
          }
        }
        
        // If stop button appears (game started), try to subscribe
        if (stopButton && !turboState.timerSubscribed && turboState.active) {
          console.log('Game started (stop button found), subscribing to timer');
          // Add a delay to ensure the game is fully initialized
          setTimeout(() => {
            // Force resubscription
            turboState.timerSubscribed = false;
            subscribeToGameTimer();
          }, 200);
        }
      }
    }
  });
  
  // Watch for changes in the game controls area
  const gameArea = document.querySelector('#game');
  if (gameArea) {
    turboState.gameControlsObserver.observe(gameArea, { 
      childList: true, 
      subtree: false,
      attributes: false
    });
    console.log('Watching game controls for play/stop events');
  } else {
    // If game area not found, watch the whole document and try again later
    turboState.gameControlsObserver.observe(document.body, { 
      childList: true, 
      subtree: false
    });
          console.log('Game area not found, watching body for changes');
    
    // Try again later to find the game area
    setTimeout(() => {
      const gameArea = document.querySelector('#game');
      if (gameArea && turboState.gameControlsObserver) {
        turboState.gameControlsObserver.disconnect();
        turboState.gameControlsObserver.observe(gameArea, { 
          childList: true, 
          subtree: true,
          attributes: true
        });
        console.log('Found game area, now watching it specifically');
      }
    }, 2000);
  }
  
  // Also check for play/pause buttons right now
  const playButton = document.querySelector('button[aria-label="Play"]');
  if (playButton) {
          console.log('Found play button initially - game is paused');
    if (turboState.tickDisplayElement && turboState.active) {
      turboState.tickDisplayElement.textContent = 'Turbo: ON | Game paused';
    }
  }
}

// Toggle turbo mode
function toggleTurbo() {
  if (turboState.active) {
    disableTurbo();
  } else {
    enableTurbo();
  }
  updateTurboButton();
  
  // Save state to extension config
  if (api) {
    api.service.updateScriptConfig('local_DOM_Turbo_with_ticks.js', {
      active: turboState.active,
      speedupFactor: turboState.speedupFactor
    });
  }
}

// Function to update the speedup factor
function updateSpeedupFactor(newFactor) {
  turboState.speedupFactor = newFactor;
  
  // Update config panel if it exists
  const speedLabel = document.getElementById('turbo-speed-value');
  if (speedLabel) {
    speedLabel.textContent = `${newFactor}x`;
  }
  
  // If turbo is active, update the time scale
  if (turboState.active) {
    setTimeScale(newFactor);
  }
  
  // Save to config
  if (api) {
    api.service.updateScriptConfig('local_DOM_Turbo_with_ticks.js', {
      active: turboState.active,
      speedupFactor: turboState.speedupFactor
    });
  }
}

// Create a configuration panel
function createConfigPanel() {
  if (api && api.ui) {
    const configContent = document.createElement('div');
    
    // Add a heading
    const heading = document.createElement('h3');
    heading.textContent = 'Turbo Speed Settings';
    heading.style.marginBottom = '15px';
    configContent.appendChild(heading);
    
    // Add slider container
    const sliderContainer = document.createElement('div');
    sliderContainer.style.display = 'flex';
    sliderContainer.style.flexDirection = 'column';
    sliderContainer.style.marginBottom = '20px';
    
    // Add slider label
    const sliderLabel = document.createElement('div');
    sliderLabel.style.display = 'flex';
    sliderLabel.style.justifyContent = 'space-between';
    sliderLabel.style.marginBottom = '5px';
    
    const labelText = document.createElement('span');
    labelText.textContent = 'Game Speed:';
    
    const speedValue = document.createElement('span');
    speedValue.id = 'turbo-speed-value';
    speedValue.textContent = `${turboState.speedupFactor}x`;
    
    sliderLabel.appendChild(labelText);
    sliderLabel.appendChild(speedValue);
    sliderContainer.appendChild(sliderLabel);
    
    // Add the slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '2';
    slider.max = '10';
    slider.step = '1';
    slider.value = turboState.speedupFactor;
    slider.style.width = '100%';
    
    slider.addEventListener('input', () => {
      const value = parseInt(slider.value, 10);
      updateSpeedupFactor(value);
    });
    
    sliderContainer.appendChild(slider);
    configContent.appendChild(sliderContainer);
    
    // Add description
    const description = document.createElement('p');
    description.textContent = 'Adjust the slider to control how much faster the game runs when Turbo is enabled. Higher values make the game run faster but may cause performance issues on some devices.';
    description.style.fontSize = '14px';
    description.style.color = '#888';
    configContent.appendChild(description);
    
    const defaultNote = document.createElement('p');
    defaultNote.textContent = `Default game speed is 1x (${DEFAULT_TICK_INTERVAL_MS}ms per tick). Turbo speeds range from 2x to 10x with performance optimizations.`;
    defaultNote.style.fontSize = '14px';
    defaultNote.style.marginTop = '10px';
    defaultNote.style.color = '#888';
    configContent.appendChild(defaultNote);
    
    // Create the config panel
    api.ui.createConfigPanel({
      id: 'turbo-config-panel',
      title: 'Turbo Settings',
      content: configContent,
      buttons: [
        {
          text: 'Close',
          primary: true,
          closeOnClick: true
        }
      ]
    });
    
    // Create config button
    api.ui.addButton({
      id: 'turbo-config-button',
      text: '⚙️',
      tooltip: t('mods.turbo.configButtonTooltip'),
      onClick: () => api.ui.toggleConfigPanel('turbo-config-panel')
    });
  }
}

// Create the Turbo button and config panel using the API
if (api) {
      console.log('BestiaryModAPI available in Turbo Mod');
  
  // Check if config has saved state
  api.service.updateScriptConfig('local_DOM_Turbo_with_ticks.js', {})
    .then(() => {
      return api.service.getActiveScripts();
    })
    .then(scripts => {
      const turboConfig = scripts.find(s => s.hash === 'local_DOM_Turbo_with_ticks.js')?.config || {};
      console.log('Loaded Turbo config:', turboConfig);
      
      // Update speed from saved config
      if (turboConfig.speedupFactor) {
        turboState.speedupFactor = Math.max(turboConfig.speedupFactor || 5, 2);
      }
      
      // If it was active before, reactivate it
      if (turboConfig.active) {
        console.log('Turbo was previously active, re-enabling...');
        enableTurbo();
      }
      
      // Create button with correct initial text
      window.turboButton = api.ui.addButton({
        id: 'turbo-mod-button',
        text: turboState.active ? t('mods.turbo.buttonDisable') : t('mods.turbo.buttonEnable'),
        tooltip: t('mods.turbo.buttonTooltip'),
        primary: turboState.active,
        onClick: toggleTurbo
      });
      
      console.log('Turbo button added');
      
      // Create configuration panel
      createConfigPanel();
    })
    .catch(err => {
      console.error('Error setting up Turbo mod:', err);
      
      // Fallback - just create the button and config panel
      window.turboButton = api.ui.addButton({
        id: 'turbo-mod-button',
        text: turboState.active ? t('mods.turbo.buttonDisable') : t('mods.turbo.buttonEnable'),
        tooltip: t('mods.turbo.buttonTooltip'),
        primary: turboState.active,
        onClick: toggleTurbo
      });
      
      createConfigPanel();
    });
} else {
  console.error('BestiaryModAPI not available in Turbo Mod');
}

// Try to init tick display or set up observer right away
if (turboState.active) {
  if (!tryInitTickDisplay()) {
    setupMutationObserver();
  }
  
  // Set up timer watcher and game controls watcher
  setupTimerWatcher();
  watchForGameControls();
} else {
  // Still set up mutation observer to be ready when enabled
  setupMutationObserver();
}

// Always set up game controls watcher so we're ready when turbo is enabled
setTimeout(watchForGameControls, 1000);

  console.log('Turbo Mod initialization complete');

// Expose enable/disable functions in turboState for other mods to use
window.__turboState.enable = enableTurbo;
window.__turboState.disable = disableTurbo;

// Export control functions
exports = {
  enable: enableTurbo,
  disable: disableTurbo,
  toggle: toggleTurbo,
  isActive: () => turboState.active,
  setSpeed: updateSpeedupFactor,
  getSpeed: () => turboState.speedupFactor,
  cleanup: function() {
    console.log('[Turbo Mode] Running cleanup...');
    
    // Disable turbo mode if active
    if (turboState.active) {
      disableTurbo();
    }
    
    // Clear timer check interval
    if (turboState.timerCheckInterval) {
      clearInterval(turboState.timerCheckInterval);
      turboState.timerCheckInterval = null;
    }
    
    // Remove tick display element
    if (turboState.tickDisplayElement) {
      turboState.tickDisplayElement.remove();
      turboState.tickDisplayElement = null;
    }
    
    // Disconnect game controls observer
    if (turboState.gameControlsObserver) {
      turboState.gameControlsObserver.disconnect();
      turboState.gameControlsObserver = null;
    }
    
    // Unsubscribe from speedup
    if (turboState.speedupSubscription) {
      turboState.speedupSubscription.unsubscribe();
      turboState.speedupSubscription = null;
    }
    
    // Reset state
    turboState.active = false;
    turboState.timerSubscribed = false;
    turboState.lastKnownTick = -1;
    
    console.log('[Turbo Mode] Cleanup completed');
  }
};

// Update the Turbo button style based on state
function updateTurboButton() {
  if (api && api.ui && window.turboButton) {
    api.ui.updateButton('turbo-mod-button', {
      text: turboState.active ? t('mods.turbo.buttonDisable') : t('mods.turbo.buttonEnable'),
      primary: turboState.active,
      tooltip: t('mods.turbo.buttonTooltip')
    });
    // Apply green background when active, regular when not
    const btn = document.getElementById('turbo-mod-button');
    if (btn) {
      if (turboState.active) {
        btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-green.be515334.png') repeat";
        btn.style.backgroundSize = "auto";
      } else {
        btn.style.background = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat";
        btn.style.color = "#ffe066";
      }
    }
  }
}
