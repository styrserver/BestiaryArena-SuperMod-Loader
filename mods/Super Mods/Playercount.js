// Playercount Mod for Bestiary Arena
// Displays live player count in the header
console.log('Playercount initializing...');

// Configuration
const defaultConfig = {
  enabled: true,
  updateInterval: 30000, // 30 seconds
  showNotifications: true
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Track timeouts and event listeners for cleanup
const activeTimeouts = new Set();
const activeEventListeners = new Map();

// Player count state
let currentPlayerCount = null;
let lastUpdateTime = null;

// Safe DOM element removal helper
function safeRemoveElement(element) {
  if (element && element.parentNode && element.parentNode.contains(element)) {
    element.parentNode.removeChild(element);
  } else if (element && element.remove) {
    element.remove();
  }
}

// Fetch player count from API
async function fetchPlayerCount() {
  try {
    const response = await fetch("/api/player-count");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const countText = await response.text();
    const count = parseInt(countText, 10);
    
    if (isNaN(count)) {
      throw new Error('Invalid player count data received');
    }
    
    currentPlayerCount = count;
    lastUpdateTime = new Date();
    
    console.log(`[Playercount] Player count updated: ${count}`);
    return count;
  } catch (error) {
    console.error('[Playercount] Error fetching player count:', error);
    return null;
  }
}

// Update the player count display
function updatePlayerCountDisplay(count) {
  const playerCountBtn = document.querySelector('.playercount-header-btn');
  if (!playerCountBtn) return;
  
  if (count !== null) {
    playerCountBtn.innerHTML = `<span class="pixel-font-16 text-white animate-in fade-in">Players online: <span class="text-ally/80">${count}</span></span>`;
    playerCountBtn.title = `Players online: ${count} (Last updated: ${lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : 'Never'})`;
    playerCountBtn.style.color = 'inherit'; // Use inherited color from spans
  } else {
    playerCountBtn.innerHTML = `<span class="pixel-font-16 text-white animate-in fade-in">Players online: <span class="text-error">?</span></span>`;
    playerCountBtn.title = 'Player count unavailable';
    playerCountBtn.style.color = 'inherit'; // Use inherited color from spans
  }
}

// Start periodic updates
function startPlayerCountUpdates() {
  // Initial fetch
  fetchPlayerCount().then(count => {
    updatePlayerCountDisplay(count);
  });
  
  // Set up periodic updates
  const updateInterval = setInterval(async () => {
    const count = await fetchPlayerCount();
    updatePlayerCountDisplay(count);
  }, config.updateInterval);
  
  activeTimeouts.add(updateInterval);
}

// Add Playercount button to the header
function addPlayercountHeaderButton() {
  const tryInsert = () => {
    // Find the header <ul> by its class
    const headerUl = document.querySelector('header ul.pixel-font-16.flex.items-center');
    if (!headerUl) {
      const timeoutId = setTimeout(tryInsert, 500);
      activeTimeouts.add(timeoutId);
      return;
    }
    
    // Prevent duplicate button
    if (headerUl.querySelector('.playercount-header-btn')) {
      console.log('[Playercount] Playercount header button already exists, skipping insert.');
      return;
    }

    // Create the <li> and <span> (non-clickable)
    const li = document.createElement('li');
    const btn = document.createElement('span');
    btn.innerHTML = '<span class="pixel-font-16 text-white animate-in fade-in">Players online: <span class="text-error">?</span></span>';
    btn.className = 'playercount-header-btn';
    btn.title = 'Loading player count...';
    
    li.appendChild(btn);

    // Insert after Discord if it exists, otherwise after Configurator
    const discordLi = Array.from(headerUl.children).find(
      el => el.querySelector('a') && el.querySelector('a').href && el.querySelector('a').href.includes('discord')
    );
    const configuratorLi = Array.from(headerUl.children).find(
      el => el.querySelector('.configurator-header-btn')
    );
    const mlAutoLi = Array.from(headerUl.children).find(
      el => el.classList.contains('ml-auto')
    );

    if (discordLi) {
      // Insert after Discord
      if (discordLi.nextSibling) {
        headerUl.insertBefore(li, discordLi.nextSibling);
      } else {
        headerUl.appendChild(li);
      }
      console.log('[Playercount] Playercount header button inserted after Discord.');
    } else if (configuratorLi) {
      if (mlAutoLi) {
        headerUl.insertBefore(li, mlAutoLi);
      } else if (configuratorLi.nextSibling) {
        headerUl.insertBefore(li, configuratorLi.nextSibling);
      } else {
        headerUl.appendChild(li);
      }
      console.log('[Playercount] Playercount header button inserted after Configurator.');
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
      console.log('[Playercount] Playercount header button appended to header.');
    }
    
    // Start the periodic updates
    startPlayerCountUpdates();
  };
  tryInsert();
}

// Initialize the mod
addPlayercountHeaderButton();

// Export functionality
exports = {
  fetchPlayerCount,
  updatePlayerCountDisplay,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
  },
  cleanup: () => {
    console.log('[Playercount] Exports cleanup called');
    try {
      // Clear all active timeouts
      activeTimeouts.forEach(timeoutId => {
        try {
          clearTimeout(timeoutId);
          clearInterval(timeoutId);
        } catch (error) {
          console.warn('[Playercount] Error clearing timeout/interval:', error);
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
          console.warn('[Playercount] Error removing event listener:', error);
        }
      });
      activeEventListeners.clear();
      
      // Remove playercount header button
      const playercountBtn = document.querySelector('.playercount-header-btn');
      if (playercountBtn && playercountBtn.parentNode) {
        try {
          playercountBtn.parentNode.remove();
        } catch (error) {
          console.warn('[Playercount] Error removing header button:', error);
        }
      }
      
      // Reset state variables
      currentPlayerCount = null;
      lastUpdateTime = null;
      
      console.log('[Playercount] Exports cleanup completed');
    } catch (error) {
      console.error('[Playercount] Exports cleanup error:', error);
    }
  }
};

