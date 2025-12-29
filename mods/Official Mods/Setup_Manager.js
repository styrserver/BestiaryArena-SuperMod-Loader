// Setup Manager Mod for Bestiary Arena
console.log('Setup Manager Mod initializing...');

// Configuration with defaults
const defaultConfig = {
  savedSetups: {},  // This will store all saved team setups by map ID
  setupNameMaxLength: 100, // Maximum character length for setup names
  maxSetupsPerMap: 10, // Maximum number of setups per map
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Ensure setupNameMaxLength is at least 100 (in case old config had lower value)
if (config.setupNameMaxLength < 100) {
  config.setupNameMaxLength = 100;
  // Update the saved config so the change persists
  api.service.updateScriptConfig(context.hash, config);
}

// Constants
const MOD_ID = 'setup-manager';
const BUTTON_ID = `${MOD_ID}-button`;
const STORAGE_KEY = 'bestiary-setup-manager-v1';
const DEFAULT_TEAM_NAMES = ['Farm', 'S+', 'Speedrun'];

// Ensure the savedSetups object has structure we expect
if (!config.savedSetups) {
  config.savedSetups = {};
}

// We'll hold references to active UI components here for cleanup
let activeButtonElement = null;

// Add a reference to track active modals
let activeModal = null;

// Helper function to safely access nested properties
const safeAccess = (obj, path) => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

// Use shared translation system via API
const t = (key) => api.i18n.t(key);

// Helper for dynamic translation with placeholders
const tReplace = (key, replacements) => {
  let text = t(key);
  Object.entries(replacements).forEach(([placeholder, value]) => {
    text = text.replace(`{${placeholder}}`, value);
  });
  return text;
};

// Calculate tier from monster stats
function calculateTierFromStats(monster) {
  if (!monster) return 1;
  
  const statSum = (monster.hp || 0) + 
                  (monster.ad || 0) + 
                  (monster.ap || 0) + 
                  (monster.armor || 0) + 
                  (monster.magicResist || 0);
  
  if (statSum >= 80) return 5;
  if (statSum >= 70) return 4;
  if (statSum >= 60) return 3;
  if (statSum >= 50) return 2;
  return 1;
}

// Replace the getMonsterInfo function with this updated version
function getMonsterInfo(monsterId) {
  try {
    const playerSnapshot = globalThis.state.player.getSnapshot();
    if (!playerSnapshot || !playerSnapshot.context || !playerSnapshot.context.monsters) {
      return null;
    }
    
    const monster = playerSnapshot.context.monsters.find(m => m.id === monsterId);
    if (!monster) {
      return null;
    }
    
    // Calculate tier based on stats sum
    const displayTier = calculateTierFromStats(monster);
    
    return {
      gameId: monster.gameId,
      tier: displayTier, // Use calculated tier for display
      actualTier: monster.tier, // Keep track of actual tier
      level: globalThis.state.utils.expToCurrentLevel(monster.exp),
      stats: {
        hp: monster.hp,
        ad: monster.ad,
        ap: monster.ap,
        armor: monster.armor,
        magicResist: monster.magicResist
      }
    };
  } catch (error) {
    console.error('Error getting monster info:', error);
    return null;
  }
}

// Get monster info from custom piece or check if it exists in player collection
function getMonsterInfoFromCustom(customPiece) {
  if (!customPiece || !customPiece.gameId) {
    return null;
  }
  
  try {
    const playerSnapshot = globalThis.state.player.getSnapshot();
    const monsters = playerSnapshot?.context?.monsters || [];
    
    // Get saved stats from custom piece
    const genes = customPiece.genes || {};
    const savedStats = extractStatsFromMonster(genes);
    
    // Find all monsters in collection with matching gameId
    const matchingMonsters = monsters.filter(m => m.gameId === customPiece.gameId);
    
    // Check if stats match any original monster in collection
    let isModified = true;
    if (matchingMonsters.length > 0) {
      // Compare saved stats with original monster stats
      for (const monster of matchingMonsters) {
        const originalStats = extractStatsFromMonster(monster);
        
        // Check if all stats match
        if (savedStats.hp === originalStats.hp &&
            savedStats.ad === originalStats.ad &&
            savedStats.ap === originalStats.ap &&
            savedStats.armor === originalStats.armor &&
            savedStats.magicResist === originalStats.magicResist) {
          isModified = false;
          break; // Found a match, not modified
        }
      }
    } else {
      // GameId doesn't exist in collection at all
      isModified = true;
    }
    
    // Calculate tier from genes using shared function
    const tier = calculateTierFromStats(savedStats);
    
    return {
      gameId: customPiece.gameId,
      tier: tier,
      level: customPiece.level || 1,
      stats: savedStats,
      isCustom: true,
      existsInCollection: !isModified // True if stats match original, false if modified
    };
  } catch (error) {
    console.error('Error getting monster info from custom piece:', error);
    return null;
  }
}

// ========== Core Functionality ==========

// Get the current map ID
function getCurrentMapId() {
  try {
    const boardSnapshot = globalThis.state.board.getSnapshot();
    if (!boardSnapshot || !boardSnapshot.context || !boardSnapshot.context.selectedMap) {
      return null;
    }
    
    return boardSnapshot.context.selectedMap.selectedRoom?.id;
  } catch (error) {
    console.error('Error getting current map ID:', error);
    return null;
  }
}

// Get current map name
function getCurrentMapName() {
  try {
    const boardSnapshot = globalThis.state.board.getSnapshot();
    if (!boardSnapshot || !boardSnapshot.context || !boardSnapshot.context.selectedMap) {
      return 'Unknown Map';
    }
    
    return boardSnapshot.context.selectedMap.selectedRoom?.name || 
           boardSnapshot.context.selectedMap.selectedRoom?.id || 
           'Unknown Map';
  } catch (error) {
    console.error('Error getting current map name:', error);
    return 'Unknown Map';
  }
}

// Get current number of creatures placed on the board
function getCurrentCreatureCount() {
  try {
    const boardSnapshot = globalThis.state.board.getSnapshot();
    const boardConfig = boardSnapshot?.context?.boardConfig || [];
    
    // Count only player and custom pieces (not villains)
    return boardConfig.filter(piece => 
      piece && (piece.type === 'player' || piece.type === 'custom') && !piece.villain
    ).length;
  } catch (error) {
    console.error('Error getting current creature count:', error);
    return 0;
  }
}

// Get maximum team size for current map
function getMaxTeamSize(mapId) {
  try {
    if (!mapId || !globalThis.state?.utils?.ROOMS) {
      return 5; // Default fallback
    }
    
    const rooms = globalThis.state.utils.ROOMS;
    
    // Try to find room by id (could be string or number)
    let roomData = rooms.find(room => 
      room.id === mapId || 
      room.id === String(mapId) || 
      String(room.id) === mapId
    );
    
    // If not found, try to find by file name or other identifier
    if (!roomData && typeof mapId === 'string') {
      roomData = rooms.find(room => 
        room.file?.name === mapId || 
        room.file?.id === mapId
      );
    }
    
    if (roomData && typeof roomData.maxTeamSize === 'number') {
      return roomData.maxTeamSize;
    }
  } catch (error) {
    console.warn('Error getting max team size:', error);
  }
  
  // Default fallback (most common is 5)
  return 5;
}

// Get all player pieces on the board in the format needed for autoSetupBoard
function getCurrentTeamSetup() {
  try {
    const boardSnapshot = globalThis.state.board.getSnapshot();
    if (!boardSnapshot || !boardSnapshot.context || !boardSnapshot.context.boardConfig) {
      return [];
    }
    
    const setup = [];
    
    // Save both player and custom pieces
    boardSnapshot.context.boardConfig.filter(piece => 
      piece.type === 'player' || piece.type === 'custom'
    ).forEach(piece => {
      if (piece.type === 'player') {
        // Player piece - save databaseId
        setup.push({
          type: 'player',
          monsterId: piece.databaseId,
          equipId: piece.equipId,
          tileIndex: piece.tileIndex
        });
      } else if (piece.type === 'custom') {
        // Custom piece - save full custom data
        setup.push({
          type: 'custom',
          gameId: piece.gameId,
          level: piece.level || 1,
          genes: piece.genes ? { ...piece.genes } : null,
          equip: piece.equip ? { ...piece.equip } : null,
          tileIndex: piece.tileIndex
        });
      }
    });
    
    return setup;
  } catch (error) {
    console.error('Error getting current team setup:', error);
    return [];
  }
}

// Add a function to save configurations to localStorage
function saveConfigToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config.savedSetups));
    console.log('Saved setups to localStorage:', config.savedSetups);
    
    // Also save via the mod config API
    api.service.updateScriptConfig(context.hash, config);
  } catch (error) {
    console.error('Error saving configurations to localStorage:', error);
  }
}

// Add a function to load configurations from localStorage
function loadConfigFromStorage() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      config.savedSetups = parsedData;
      console.log('Loaded setups from localStorage:', config.savedSetups);
      
      // Also update the mod config
      api.service.updateScriptConfig(context.hash, config);
    } else {
      console.log('No saved setups found in localStorage');
    }
  } catch (error) {
    console.error('Error loading configurations from localStorage:', error);
  }
}

// Update the saveTeamSetup function to use the new storage functions
function saveTeamSetup(mapId, name, setup) {
  if (!mapId || !name || !setup || setup.length === 0) {
    console.error('Invalid parameters for saving team setup');
    return false;
  }
  
  // Initialize map entry if it doesn't exist
  if (!config.savedSetups[mapId]) {
    config.savedSetups[mapId] = [];
  }
  
  // Check if we've reached the maximum number of setups for this map
  if (config.savedSetups[mapId].length >= config.maxSetupsPerMap) {
    showNotification(tReplace('mods.setupManager.maxTeamsReached', { max: config.maxSetupsPerMap }), 'error');
    return false;
  }
  
  // Check if a setup with this name already exists for this map
  const existingSetupIndex = config.savedSetups[mapId].findIndex(s => s.name === name);
  if (existingSetupIndex >= 0) {
    // Update the existing setup (preserve notes if they exist)
    const existingNotes = config.savedSetups[mapId][existingSetupIndex].notes || '';
    config.savedSetups[mapId][existingSetupIndex] = { name, setup, notes: existingNotes };
  } else {
    // Add a new setup
    config.savedSetups[mapId].push({ name, setup, notes: '' });
  }
  
  // Save the updated config
  saveConfigToStorage();
  
  return true;
}

// Update the deleteTeamSetup function to use the new storage functions
function deleteTeamSetup(mapId, setupName) {
  if (!mapId || !setupName) {
    console.error('Invalid parameters for deleting team setup');
    return false;
  }
  
  // Can't delete the original setup
  if (setupName === 'Auto-Setup') {
    return false;
  }
  
  // Check if this map has any saved setups
  if (!config.savedSetups[mapId]) {
    return false;
  }
  
  // Remove the setup
  config.savedSetups[mapId] = config.savedSetups[mapId].filter(s => s.name !== setupName);
  
  // Save the updated config
  saveConfigToStorage();
  
  return true;
}

// Get all saved setups for a map
function getMapSetups(mapId) {
  if (!mapId) {
    return [];
  }
  
  return config.savedSetups[mapId] || [];
}

// Update the loadTeamSetup function to not close the modal for the Original team
function loadTeamSetup(mapId, setupName, keepModalOpen = false) {
  try {
    if (!mapId) {
      console.error('No map ID provided for loading team setup');
      return false;
    }
    
    // Check if autosetup is enabled
    const playerContext = globalThis.state.player.getSnapshot().context;
    const playerFlags = playerContext.flags;
    
    // Create Flags object to check autosetup mode
    const flags = new globalThis.state.utils.Flags(playerFlags);
    if (!flags.isSet("autosetup")) {
      api.ui.components.createModal({
        title: t('mods.setupManager.autosetupRequired'),
        content: t('mods.setupManager.autosetupMessage'),
        buttons: [{ text: 'OK', primary: true }]
      });
      return false;
    }
    
    // If setupName is "Auto-Setup", use the game's built-in saved setup from player context
    if (setupName === 'Auto-Setup') {
      try {
        // Get the player's saved configuration for this map
        const playerContext = globalThis.state.player.getSnapshot().context;
        const originalSetup = playerContext.boardConfigs[mapId];
        
        console.log('Loading original setup for map:', mapId, originalSetup);
        
        // Apply the setup with the player's saved configuration
        if (originalSetup && Array.isArray(originalSetup) && originalSetup.length > 0) {
          globalThis.state.board.send({
            type: "autoSetupBoard",
            setup: originalSetup
          });
          
          return true;
        } else {
          console.error('No saved original setup found for map:', mapId);
          showNotification('No saved original setup found for this map', 'error');
          return false;
        }
      } catch (error) {
        console.error('Error loading original setup:', error);
        return false;
      }
    }
    
    // Find the saved setup
    const savedSetup = config.savedSetups[mapId]?.find(s => s.name === setupName);
    if (!savedSetup) {
      console.error(`Team setup "${setupName}" not found for map ${mapId}`);
      return false;
    }
    
    // Ensure the setup is in the correct format - must be an array
    const setupArray = Array.isArray(savedSetup.setup) ? savedSetup.setup : [savedSetup.setup];
    
    console.log('Loading team setup:', setupArray);
    
    // Check if we have any custom pieces
    const hasCustomPieces = setupArray.some(p => p.type === 'custom');
    
    if (hasCustomPieces) {
      // Mix of player and custom pieces - use setState to apply boardConfig
      const boardSnapshot = globalThis.state.board.getSnapshot();
      const mapIdFromBoard = boardSnapshot?.context?.selectedMap?.selectedRoom?.id;
      
      if (!mapIdFromBoard) {
        console.error('Could not determine map ID for loading custom pieces');
        return false;
      }
      
      const enemyTeamConfig = globalThis.state.utils.getBoardMonstersFromRoomId(mapIdFromBoard);
      
      const playerTeamConfig = setupArray.map((piece, index) => {
        if (piece.type === 'custom') {
          // Custom piece - use as-is
          return {
            type: 'custom',
            gameId: piece.gameId,
            level: piece.level || 1,
            genes: piece.genes || {},
            equip: piece.equip || null,
            tileIndex: piece.tileIndex,
            tier: 4,
            villain: false,
            key: `saved-custom-${index}-${Date.now()}`,
            direction: 'south'
          };
        } else {
          // Player piece - convert to custom format using current collection data
          const monsterInfo = getMonsterInfo(piece.monsterId);
          if (!monsterInfo) {
            console.warn(`Monster with ID ${piece.monsterId} not found in collection`);
            return null;
          }
          
          // Get equipment info if equipId exists
          let equipData = null;
          if (piece.equipId) {
            try {
              const playerContext = globalThis.state.player.getSnapshot().context;
              const equips = playerContext.equips || [];
              const equip = equips.find(e => e.id === piece.equipId);
              if (equip) {
                equipData = {
                  gameId: equip.gameId,
                  stat: equip.stat,
                  tier: equip.tier
                };
              }
            } catch (error) {
              console.warn('Error getting equipment data:', error);
            }
          }
          
          // Convert player piece to custom format using current stats from collection
          return {
            type: 'custom',
            gameId: monsterInfo.gameId,
            level: monsterInfo.level || 1,
            genes: {
              hp: monsterInfo.stats.hp || 0,
              ad: monsterInfo.stats.ad || 0,
              ap: monsterInfo.stats.ap || 0,
              armor: monsterInfo.stats.armor || 0,
              magicResist: monsterInfo.stats.magicResist || 0
            },
            equip: equipData,
            tileIndex: piece.tileIndex,
            tier: monsterInfo.tier || 1,
            villain: false,
            key: `saved-player-${index}-${Date.now()}`,
            direction: 'south'
          };
        }
      }).filter(Boolean);
      
      const boardConfig = [...enemyTeamConfig, ...playerTeamConfig];
      
      globalThis.state.board.send({
        type: 'setState',
        fn: (prev) => ({
          ...prev,
          boardConfig: boardConfig
        })
      });
    } else {
      // All player pieces - use autoSetupBoard (backward compatible)
      globalThis.state.board.send({
        type: "autoSetupBoard",
        setup: setupArray
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error loading team setup:', error);
    return false;
  }
}

// Update loadTeamAndNotify to handle the modal differently for Auto-Setup team
function loadTeamAndNotify(mapId, setupName) {
  // Check if this is the Auto-Setup team
  const isOriginalTeam = setupName === 'Auto-Setup';
  
  // If it's not the Auto-Setup team, close all modals
  if (!isOriginalTeam) {
    forceCloseAllModals();
  }
  
  // Load the team setup
  if (loadTeamSetup(mapId, setupName, isOriginalTeam)) {
    showNotification(t('mods.setupManager.teamLoaded'), 'success');
    
    // For Auto-Setup team, reshow the modal after a short delay
    if (isOriginalTeam) {
      setTimeout(() => {
        // Only reopen if we don't have an active modal already
        if (!activeModal || !document.contains(activeModal.element)) {
          showSetupManagerModal();
        }
      }, 300); 
    }
    
    return true;
  } else {
    showNotification(t('common.error'), 'error');
    return false;
  }
}

// ========== UI Functions ==========

// Create a function to create the notification container if it doesn't exist
function createNotificationContainer() {
  // Check if notification container already exists
  let notifContainer = document.getElementById('setup-manager-notification-container');
  
  if (!notifContainer) {
    notifContainer = document.createElement('div');
    notifContainer.id = 'setup-manager-notification-container';
    notifContainer.style.cssText = `
      position: fixed;
      bottom: 80px; /* Increased bottom position to move notifications higher */
      right: 20px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(notifContainer);
  }
}

// Function to show notification
function showNotification(message, type = 'info', duration = 3000) {
  const container = document.getElementById('setup-manager-notification-container');
  if (!container) {
    createNotificationContainer();
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'setup-manager-notification';
  
  // Base styles for the notification
  notification.style.cssText = `
    padding: 10px 16px;
    border-radius: 4px;
    margin-bottom: 8px;
    font-family: var(--font-primary);
    font-size: 14px;
    transition: all 0.3s ease;
    opacity: 0;
    transform: translateX(20px);
    max-width: 300px;
    pointer-events: auto;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  `;
  
  // Type-specific styles
  switch(type) {
    case 'success':
      notification.style.backgroundColor = 'rgba(46, 125, 50, 0.95)';
      notification.style.color = 'white';
      break;
    case 'error':
      notification.style.backgroundColor = 'rgba(198, 40, 40, 0.95)';
      notification.style.color = 'white';
      break;
    case 'warning':
      notification.style.backgroundColor = 'rgba(255, 152, 0, 0.95)';
      notification.style.color = 'white';
      break;
    default: // info
      notification.style.backgroundColor = 'rgba(25, 118, 210, 0.95)';
      notification.style.color = 'white';
  }
  
  // Set the notification content
  notification.innerText = message;
  
  // Add to container
  const container2 = document.getElementById('setup-manager-notification-container');
  container2.appendChild(notification);
  
  // Trigger animation
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(0)';
  }, 10);
  
  // Set removal timeout
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(20px)';
    
    // Remove after animation completes
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, duration);
}

// Create a styled button for actions
function createActionButton(text, onClick, primary = false, icon = null, small = false) {
  const button = document.createElement('button');
  
  button.className = primary 
    ? 'frame-1-green active:frame-pressed-1-green surface-green pixel-font-14 text-whiteRegular'
    : 'frame-1-yellow active:frame-pressed-1-yellow surface-yellow pixel-font-14 text-whiteRegular';
  
  button.style.cssText = `
    padding: ${small ? '4px 8px' : '6px 12px'};
    margin-right: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  `;
  
  if (icon) {
    const iconSpan = document.createElement('span');
    iconSpan.textContent = icon;
    iconSpan.style.fontSize = small ? '14px' : '16px';
    button.appendChild(iconSpan);
  }
  
  const textSpan = document.createElement('span');
  textSpan.textContent = text;
  button.appendChild(textSpan);
  
  button.addEventListener('click', onClick);
  
  return button;
}

// Create a delete button
function createDeleteButton(onClick) {
  const button = document.createElement('button');
  button.className = 'frame-1-red active:frame-pressed-1-red surface-red pixel-font-14 text-whiteRegular';
  button.style.cssText = `
    padding: 4px 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Trash icon
  const iconSpan = document.createElement('span');
  iconSpan.textContent = '🗑️';
  iconSpan.style.fontSize = '14px';
  button.appendChild(iconSpan);
  
  button.addEventListener('click', onClick);
  
  return button;
}

// Create a notes button (yellow)
function createNotesButton(onClick) {
  const button = document.createElement('button');
  button.className = 'frame-1-yellow active:frame-pressed-1-yellow surface-yellow pixel-font-14 text-whiteRegular';
  button.style.cssText = `
    padding: 4px 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  `;
  
  const textSpan = document.createElement('span');
  textSpan.textContent = 'Notes';
  button.appendChild(textSpan);
  
  button.addEventListener('click', onClick);
  
  return button;
}

// Create a setup card for a team
function createSetupCard(mapId, setupName, setupData) {
  const card = document.createElement('div');
  card.className = 'frame-pressed-1 surface-dark p-2 mb-3';
  card.style.maxWidth = '450px';
  card.style.width = '100%';
  card.style.boxSizing = 'border-box';
  card.style.overflow = 'hidden';
  card.style.display = 'flex';
  card.style.gap = '8px';
  
  // Left section (75%): Setup name and creatures
  const leftSection = document.createElement('div');
  leftSection.style.width = '75%';
  leftSection.style.flex = '0 0 75%';
  leftSection.style.minWidth = '0';
  leftSection.style.display = 'flex';
  leftSection.style.flexDirection = 'column';
  leftSection.style.gap = '8px';
  
  // Setup name
  const nameSpan = document.createElement('span');
  nameSpan.className = 'pixel-font-16 text-whiteRegular';
  nameSpan.textContent = setupName;
  nameSpan.style.maxWidth = '100%';
  nameSpan.style.wordWrap = 'break-word';
  nameSpan.style.wordBreak = 'break-word';
  nameSpan.style.overflowWrap = 'break-word';
  leftSection.appendChild(nameSpan);
  
  // Team content section
  const teamContent = document.createElement('div');
  teamContent.className = 'flex flex-wrap';
  teamContent.style.gap = '12px';
  
  // For "Auto-Setup" setup, get monsters from the player's saved setup
  if (setupName === 'Auto-Setup') {
    const playerContext = globalThis.state.player.getSnapshot().context;
    const boardSetup = playerContext.boardConfigs[mapId];
    
    if (boardSetup && Array.isArray(boardSetup) && boardSetup.length > 0) {
      boardSetup.forEach(piece => {
        if (piece && piece.monsterId) {
          const monsterInfo = getMonsterInfo(piece.monsterId);
          if (monsterInfo) {
            const pair = createCreatureEquipmentPair(monsterInfo, piece.equipId);
            if (pair && pair.children.length > 0) {
              teamContent.appendChild(pair);
            }
          }
        }
      });
    } else {
      const emptyText = document.createElement('p');
      emptyText.className = 'text-whiteRegular italic';
      emptyText.textContent = 'No monsters in original setup';
      teamContent.appendChild(emptyText);
    }
  } 
  // For saved setups, use the setup data
  else if (setupData && setupData.setup && Array.isArray(setupData.setup)) {
    setupData.setup.forEach(piece => {
      let monsterInfo = null;
      let equipId = null;
      let isCustom = false;
      let existsInCollection = true;
      let customEquip = null;
      
      if (piece.type === 'custom') {
        // Handle custom piece
        monsterInfo = getMonsterInfoFromCustom(piece);
        if (monsterInfo) {
          isCustom = true;
          existsInCollection = monsterInfo.existsInCollection;
          customEquip = piece.equip || null;
        }
      } else {
        // Handle player piece (backward compatibility)
        if (piece.monsterId) {
          monsterInfo = getMonsterInfo(piece.monsterId);
          equipId = piece.equipId;
        }
      }
      
      if (monsterInfo) {
        const pair = createCreatureEquipmentPair(
          monsterInfo, 
          equipId, 
          isCustom, 
          existsInCollection,
          customEquip
        );
        if (pair && pair.children.length > 0) {
          teamContent.appendChild(pair);
        }
      }
    });
    
    // If no monsters were added, show a message
    if (teamContent.children.length === 0) {
      const emptyText = document.createElement('p');
      emptyText.className = 'text-whiteRegular italic';
      emptyText.textContent = 'No monsters in this setup';
      teamContent.appendChild(emptyText);
    }
  } else {
    // Handle case where setup data is missing or invalid
    const emptyText = document.createElement('p');
    emptyText.className = 'text-whiteRegular italic';
    emptyText.textContent = 'Invalid setup data';
    teamContent.appendChild(emptyText);
  }
  
  leftSection.appendChild(teamContent);
  
  // Right section (25%): Actions (Load Team and Delete buttons)
  const rightSection = document.createElement('div');
  rightSection.style.width = '25%';
  rightSection.style.flex = '0 0 25%';
  rightSection.style.display = 'flex';
  rightSection.style.flexDirection = 'column';
  rightSection.style.gap = '8px';
  rightSection.style.alignItems = 'flex-end';
  rightSection.style.justifyContent = 'flex-start';
  
  // Actions container
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'flex gap-1';
  actionsDiv.style.flexDirection = 'column';
  actionsDiv.style.width = '100%';
  actionsDiv.style.alignItems = 'stretch';
  
  // Creature count indicator - count creatures in this setup
  let setupCreatureCount = 0;
  if (setupName === 'Auto-Setup') {
    // For "Auto-Setup" setup, count from player's saved setup
    const playerContext = globalThis.state.player.getSnapshot().context;
    const boardSetup = playerContext.boardConfigs[mapId];
    if (boardSetup && Array.isArray(boardSetup)) {
      setupCreatureCount = boardSetup.filter(piece => piece && piece.monsterId).length;
    }
  } else if (setupData && setupData.setup && Array.isArray(setupData.setup)) {
    // For saved setups, count all pieces (player and custom)
    setupCreatureCount = setupData.setup.length;
  }
  
  const maxCount = getMaxTeamSize(mapId);
  const countIndicator = document.createElement('div');
  countIndicator.className = 'pixel-font-14 text-whiteRegular';
  countIndicator.textContent = `${setupCreatureCount}/${maxCount} creatures`;
  
  // Color code: green if equals max, red otherwise
  const isMaxCreatures = setupCreatureCount === maxCount;
  const indicatorColor = isMaxCreatures ? '#4caf50' : '#ff4444'; // green or red
  
  countIndicator.style.cssText = `
    text-align: center;
    margin-bottom: 4px;
    opacity: 0.9;
    color: ${indicatorColor};
  `;
  actionsDiv.appendChild(countIndicator);
  
  // Load button
  const loadButton = createActionButton(
    t('mods.setupManager.loadTeam'), 
    () => loadTeamAndNotify(mapId, setupName), 
    true,
    null,
    true
  );
  loadButton.style.width = '100%';
  loadButton.style.marginRight = '0';
  actionsDiv.appendChild(loadButton);
  
  // Notes button (only for non-original setups)
  if (setupName !== 'Auto-Setup') {
    const notesButton = createNotesButton(() => {
      showNotesModal(mapId, setupName, setupData);
    });
    notesButton.style.width = '100%';
    actionsDiv.appendChild(notesButton);
  }
  
  // Delete button (only for non-original setups)
  if (setupName !== 'Auto-Setup') {
    const deleteButton = createDeleteButton(() => {
      showDeleteConfirmation(mapId, setupName);
    });
    deleteButton.style.width = '100%';
    actionsDiv.appendChild(deleteButton);
  }
  
  rightSection.appendChild(actionsDiv);
  
  // Append both sections to card
  card.appendChild(leftSection);
  card.appendChild(rightSection);
  
  return card;
}

// Show the main setup manager modal
function showSetupManagerModal() {
  try {
    // Check if autosetup is enabled
    const playerContext = globalThis.state.player.getSnapshot().context;
    const playerFlags = playerContext.flags;
    
    // Create Flags object to check autosetup mode
    const flags = new globalThis.state.utils.Flags(playerFlags);
    if (!flags.isSet("autosetup")) {
      api.ui.components.createModal({
        title: t('mods.setupManager.autosetupRequired'),
        content: t('mods.setupManager.autosetupMessage'),
        buttons: [{ text: 'OK', primary: true }]
      });
      return;
    }
    
    const mapId = getCurrentMapId();
    if (!mapId) {
      showNotification(t('mods.setupManager.noMapSelected'), 'error');
      return;
    }
    
    // Force close all open modals first
    forceCloseAllModals();
    
    const mapName = getCurrentMapName();
    
    // Create modal content
    const content = document.createElement('div');
    
    // Create a scrollable container
    const scrollContainer = api.ui.components.createScrollContainer({
      height: 400,
      padding: true
    });
    
    // Load the saved setups for this map
    const savedSetups = getMapSetups(mapId);
    
    // Add original setup card
    const originalCard = createSetupCard(mapId, 'Auto-Setup');
    scrollContainer.addContent(originalCard);
    
    // Add saved setup cards
    let hasSavedSetups = false;
    
    if (savedSetups && savedSetups.length > 0) {
      savedSetups.forEach(setup => {
        if (setup && setup.name) {
          hasSavedSetups = true;
          const setupCard = createSetupCard(mapId, setup.name, setup);
          scrollContainer.addContent(setupCard);
        }
      });
    }
    
    if (!hasSavedSetups) {
      const noSetupsMessage = document.createElement('p');
      noSetupsMessage.className = 'text-whiteRegular italic mt-2';
      noSetupsMessage.textContent = t('mods.setupManager.noTeamsFound');
      noSetupsMessage.style.textAlign = 'center';
      scrollContainer.addContent(noSetupsMessage);
    }
    
    content.appendChild(scrollContainer.element);
    
    // Add save button
    const saveButton = createActionButton(
      t('mods.setupManager.saveCurrentSetup'),
      () => showSaveSetupModal(mapId),
      true
    );
    saveButton.style.marginTop = '10px';
    content.appendChild(saveButton);
    
    // Create the modal
    activeModal = api.ui.components.createModal({
      title: `${t('mods.setupManager.setupManager')} - ${mapName}`,
      width: 500,
      content: content,
      buttons: [
        {
          text: t('common.cancel'),
          primary: false,
          closeOnClick: true
        }
      ]
    });
    
    // Override modal width styles to ensure 500px width
    setTimeout(() => {
      const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
      if (dialog) {
        dialog.style.width = '500px';
        dialog.style.minWidth = '500px';
        dialog.style.maxWidth = '500px';
        dialog.classList.remove('max-w-[300px]');
        
        // Center the scroll viewport horizontally
        const viewport = dialog.querySelector('div[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.style.marginLeft = 'auto';
          viewport.style.marginRight = 'auto';
        }
      }
    }, 0);
  } catch (error) {
    console.error('Error showing setup manager modal:', error);
    showNotification(t('common.error'), 'error');
  }
}

// Show modal to save current setup
function showSaveSetupModal(mapId) {
  try {
    if (!mapId) {
      console.error('No map ID provided for saving team setup');
      return;
    }
    
    // Check if autosetup is enabled
    const playerContext = globalThis.state.player.getSnapshot().context;
    const playerFlags = playerContext.flags;
    
    // Create Flags object to check autosetup mode
    const flags = new globalThis.state.utils.Flags(playerFlags);
    if (!flags.isSet("autosetup")) {
      api.ui.components.createModal({
        title: t('mods.setupManager.autosetupRequired'),
        content: t('mods.setupManager.autosetupMessage'),
        buttons: [{ text: 'OK', primary: true }]
      });
      return;
    }
    
    // Force close all open modals first
    forceCloseAllModals();
    
    // Get current team from board
    const currentSetup = getCurrentTeamSetup();
    
    if (!currentSetup || currentSetup.length === 0) {
      showNotification(t('mods.setupManager.invalidSetup'), 'error');
      return;
    }
    
    // Create modal content
    const content = document.createElement('div');
    
    // Name input
    const inputContainer = document.createElement('div');
    inputContainer.className = 'mb-4';
    
    const inputLabel = document.createElement('label');
    inputLabel.htmlFor = 'setup-name-input';
    inputLabel.className = 'block text-whiteRegular mb-1';
    inputLabel.textContent = t('mods.setupManager.setupName');
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'setup-name-input';
    nameInput.className = 'frame-pressed-1 surface-dark w-full p-2 text-whiteRegular';
    nameInput.maxLength = config.setupNameMaxLength;
    nameInput.value = t('mods.setupManager.newSetup');
    
    inputContainer.appendChild(inputLabel);
    inputContainer.appendChild(nameInput);
    content.appendChild(inputContainer);
    
    // Team preview section
    const previewHeading = document.createElement('h3');
    previewHeading.className = 'text-whiteRegular mb-2';
    previewHeading.textContent = 'Preview';
    content.appendChild(previewHeading);
    
    // Team preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'flex flex-wrap mb-4';
    previewContainer.style.gap = '12px';
    
    // Add monster and equipment portraits to preview
    currentSetup.forEach(piece => {
      if (piece && piece.monsterId) {
        const monsterInfo = getMonsterInfo(piece.monsterId);
        if (monsterInfo) {
          const pair = createCreatureEquipmentPair(monsterInfo, piece.equipId);
          if (pair && pair.children.length > 0) {
            previewContainer.appendChild(pair);
          }
        }
      }
    });
    
    content.appendChild(previewContainer);
    
    // Create the modal
    activeModal = api.ui.components.createModal({
      title: t('mods.setupManager.saveTeam'),
      width: 320,
      content: content,
      buttons: [
        {
          text: t('common.save'),
          primary: true,
          onClick: () => {
            // Validate name
            const name = nameInput.value.trim();
            if (!name) {
              showNotification(t('common.error'), 'error');
              return;
            }
            
            if (name.length > config.setupNameMaxLength) {
              showNotification(tReplace('mods.setupManager.nameTooLong', { max: config.setupNameMaxLength }), 'error');
              return;
            }
            
            // Save the setup
            const saveResult = saveTeamSetup(mapId, name, currentSetup);
            
            if (saveResult) {
              showNotification(t('mods.setupManager.teamSaved'), 'success');
              // Reopen the setup manager with updated data
              showSetupManagerModal();
            } else {
              showNotification(t('common.error'), 'error');
            }
          }
        },
        {
          text: t('common.cancel'),
          primary: false,
          closeOnClick: true
        }
      ]
    });
    
    // Focus the name input field
    setTimeout(() => {
      nameInput.focus();
      nameInput.select();
    }, 100);
    
  } catch (error) {
    console.error('Error showing save setup modal:', error);
    showNotification(t('common.error'), 'error');
  }
}

// Show notes modal for editing setup notes
function showNotesModal(mapId, setupName, setupData) {
  try {
    if (!mapId || !setupName) {
      console.error('Invalid parameters for notes modal');
      return;
    }
    
    // Check if autosetup is enabled
    const playerContext = globalThis.state.player.getSnapshot().context;
    const playerFlags = playerContext.flags;
    
    // Create Flags object to check autosetup mode
    const flags = new globalThis.state.utils.Flags(playerFlags);
    if (!flags.isSet("autosetup")) {
      api.ui.components.createModal({
        title: t('mods.setupManager.autosetupRequired'),
        content: t('mods.setupManager.autosetupMessage'),
        buttons: [{ text: 'OK', primary: true }]
      });
      return;
    }
    
    // Force close all open modals first
    forceCloseAllModals();
    
    // Get current notes from setup data
    const currentNotes = (setupData && setupData.notes) ? setupData.notes : '';
    
    // Create modal content
    const content = document.createElement('div');
    
    // Create a container matching the scroll container style (height: 400px)
    const textareaContainer = document.createElement('div');
    textareaContainer.className = 'relative overflow-hidden frame-pressed-1 surface-dark';
    textareaContainer.style.cssText = 'position: relative; height: 400px;';
    
    // Notes textarea
    const textarea = document.createElement('textarea');
    textarea.id = 'setup-notes-textarea';
    textarea.className = 'frame-pressed-1 surface-dark w-full p-2 text-whiteRegular';
    textarea.style.cssText = `
      width: 100%;
      height: 100%;
      resize: none;
      font-family: inherit;
      box-sizing: border-box;
      border: none;
      background: transparent;
    `;
    textarea.value = currentNotes;
    textarea.placeholder = 'Add notes about this setup...';
    textareaContainer.appendChild(textarea);
    
    content.appendChild(textareaContainer);
    
    // Create modal (matching setup manager modal structure)
    activeModal = api.ui.components.createModal({
      title: `Setup Notes - ${setupName}`,
      width: 500,
      content: content,
      buttons: [
        {
          text: 'Save',
          primary: true,
          onClick: () => {
            const newNotes = textarea.value.trim();
            
            // Update the setup with new notes
            if (!config.savedSetups[mapId]) {
              config.savedSetups[mapId] = [];
            }
            
            const setupIndex = config.savedSetups[mapId].findIndex(s => s.name === setupName);
            if (setupIndex >= 0) {
              // Update existing setup notes
              if (!config.savedSetups[mapId][setupIndex].notes) {
                config.savedSetups[mapId][setupIndex].notes = '';
              }
              config.savedSetups[mapId][setupIndex].notes = newNotes;
            } else {
              // Setup not found, create it with notes
              const currentSetup = getCurrentTeamSetup();
              if (currentSetup && currentSetup.length > 0) {
                config.savedSetups[mapId].push({ 
                  name: setupName, 
                  setup: currentSetup, 
                  notes: newNotes 
                });
              }
            }
            
            // Save the updated config
            saveConfigToStorage();
            
            showNotification('Notes saved', 'success');
            
            // Reopen the setup manager to refresh the display
            setTimeout(() => {
              showSetupManagerModal();
            }, 300);
          }
        },
        {
          text: t('common.cancel'),
          primary: false,
          closeOnClick: true
        }
      ]
    });
    
    // Override modal width styles to ensure 500px width (matching setup manager)
    setTimeout(() => {
      const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
      if (dialog) {
        dialog.style.width = '500px';
        dialog.style.minWidth = '500px';
        dialog.style.maxWidth = '500px';
        dialog.classList.remove('max-w-[300px]');
      }
      
      // Focus the textarea
      textarea.focus();
    }, 0);
    
  } catch (error) {
    console.error('Error showing notes modal:', error);
    showNotification(t('common.error'), 'error');
  }
}

// Show confirmation before deleting a setup
function showDeleteConfirmation(mapId, setupName) {
  try {
    // Check if autosetup is enabled
    const playerContext = globalThis.state.player.getSnapshot().context;
    const playerFlags = playerContext.flags;
    
    // Create Flags object to check autosetup mode
    const flags = new globalThis.state.utils.Flags(playerFlags);
    if (!flags.isSet("autosetup")) {
      api.ui.components.createModal({
        title: t('mods.setupManager.autosetupRequired'),
        content: t('mods.setupManager.autosetupMessage'),
        buttons: [{ text: 'OK', primary: true }]
      });
      return;
    }
    
    // Force close all open modals first
    forceCloseAllModals();
    
    // Create confirmation modal
    const content = document.createElement('div');
    const message = document.createElement('p');
    message.className = 'text-whiteRegular mb-4';
    message.textContent = t('mods.setupManager.confirmDelete');
    content.appendChild(message);
    
    const setupPreview = document.createElement('div');
    setupPreview.className = 'frame-pressed-1 surface-dark p-2 mb-4';
    setupPreview.style.maxWidth = '100%';
    setupPreview.style.overflowWrap = 'break-word';
    
    const setupNameEl = document.createElement('h3');
    setupNameEl.className = 'text-whiteRegular mb-2';
    setupNameEl.textContent = setupName;
    setupNameEl.style.wordWrap = 'break-word';
    setupNameEl.style.wordBreak = 'break-word';
    setupNameEl.style.overflowWrap = 'break-word';
    setupNameEl.style.maxWidth = '100%';
    setupPreview.appendChild(setupNameEl);
    
    content.appendChild(setupPreview);
    
    // Create the modal
    activeModal = api.ui.components.createModal({
      title: t('mods.setupManager.deleteTeam'),
      width: 300,
      content: content,
      buttons: [
        {
          text: t('common.yes'),
          primary: true,
          onClick: () => {
            const deleteResult = deleteTeamSetup(mapId, setupName);
            
            if (deleteResult) {
              showNotification(t('mods.setupManager.teamDeleted'), 'success');
              // Reopen the setup manager with updated data
              showSetupManagerModal();
            } else {
              showNotification(t('common.error'), 'error');
            }
          }
        },
        {
          text: t('common.no'),
          primary: false,
          closeOnClick: true
        }
      ]
    });
  } catch (error) {
    console.error('Error showing delete confirmation:', error);
    showNotification(t('common.error'), 'error');
  }
}

// ========== Button Handling ==========

// Create our own button for the setup manager
function createSetupManagerButton() {
  if (activeButtonElement) {
    // Button already exists
    return;
  }
  
  try {
    const button = api.ui.addButton({
      id: BUTTON_ID,
      text: t('mods.setupManager.setupManager'),
      tooltip: t('mods.setupManager.setupManager'),
      modId: MOD_ID,
      primary: false,
      onClick: showSetupManagerModal
    });
    
    activeButtonElement = button;
  } catch (error) {
    console.error('Error creating setup manager button:', error);
  }
}

// ========== Initialization ==========

// Update the init function to load configurations from localStorage
function init() {
  console.log('Setup Manager initializing...');
  
  // Create notification container
  createNotificationContainer();
  
  // Load saved configurations
  loadConfigFromStorage();
  
  // Check if we have a valid config
  if (!config.savedSetups) {
    config.savedSetups = {};
  }
  
  // Check if we should auto-initialize default setups
  const mapId = getCurrentMapId();
  if (mapId && !config.savedSetups[mapId]) {
    // Initialize with default empty templates
    config.savedSetups[mapId] = [];
    saveConfigToStorage();
  }
  
  // Create the setup manager button
  createSetupManagerButton();
  
  console.log('Setup Manager initialized');
}

// Wait for the game to be ready before initializing
const waitForGame = () => {
  if (safeAccess(globalThis, 'state.player.getSnapshot') && 
      safeAccess(globalThis, 'state.board.getSnapshot')) {
    init();
  } else {
    setTimeout(waitForGame, 500);
  }
};

// Start waiting for the game to be ready
waitForGame();

// Clean up when the mod is disabled
function cleanup() {
  if (activeButtonElement) {
    api.ui.removeButton(BUTTON_ID);
    activeButtonElement = null;
  }
  
  const notificationContainer = document.getElementById('setup-manager-notification-container');
  if (notificationContainer) {
    document.body.removeChild(notificationContainer);
  }
}

// Export functionality
context.exports = {
  showModal: showSetupManagerModal,
  saveTeam: (name) => {
    const mapId = getCurrentMapId();
    if (mapId) {
      const currentSetup = getCurrentTeamSetup();
      if (currentSetup && currentSetup.length > 0) {
        return saveTeamSetup(mapId, name, currentSetup);
      }
    }
    return false;
  },
  loadTeam: (name) => {
    const mapId = getCurrentMapId();
    if (mapId) {
      return loadTeamSetup(mapId, name);
    }
    return false;
  },
  cleanup: cleanup
};

// Add warning symbol to monster portrait (similar to Better Forge)
function addWarningSymbolToPortrait(portrait) {
  try {
    // Check if warning symbol already exists
    if (portrait.querySelector('.warning-symbol')) {
      return;
    }
    
    // Find the main container (button or container-slot)
    const container = portrait.querySelector('button') || 
                      portrait.querySelector('.container-slot') || 
                      portrait;
    
    // Ensure container has relative positioning for absolute positioning of warning
    if (container.style) {
      if (!container.style.position || container.style.position === 'static') {
        container.style.position = 'relative';
      }
    }
    
    // Create warning symbol element
    const warningSymbol = document.createElement('div');
    warningSymbol.className = 'warning-symbol';
    warningSymbol.textContent = '⚠️';
    warningSymbol.title = 'This monster has been modified and does not exist in your collection';
    warningSymbol.style.cssText = `
      position: absolute;
      top: 2px;
      right: 2px;
      font-size: 12px;
      color: #ff4444;
      text-shadow: -1px -1px 0 #ff0000, 1px -1px 0 #ff0000, -1px 1px 0 #ff0000, 1px 1px 0 #ff0000;
      z-index: 10;
      pointer-events: none;
      line-height: 1;
      background: rgba(0, 0, 0, 0.7);
      border-radius: 50%;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Add warning symbol to container
    container.appendChild(warningSymbol);
  } catch (error) {
    console.error('Error adding warning symbol to portrait:', error);
  }
}

// Create a stat row with progress bar
function createStatRow(label, value, maxValue, barColor = 'rgb(96, 192, 96)') {
  const statRow = document.createElement('div');
  statRow.setAttribute('data-transparent', 'false');
  statRow.className = 'pixel-font-16 whitespace-nowrap text-whiteRegular';
  
  // Top row with label and value
  const topRow = document.createElement('div');
  topRow.className = 'flex justify-between';
  
  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  topRow.appendChild(labelSpan);
  
  const valueSpan = document.createElement('span');
  valueSpan.className = 'text-right text-whiteExp';
  valueSpan.style.width = '3ch';
  valueSpan.textContent = value.toString();
  topRow.appendChild(valueSpan);
  
  statRow.appendChild(topRow);
  
  // Bar row with progress bar
  const barRow = document.createElement('div');
  barRow.className = 'relative';
  
  const barOuter = document.createElement('div');
  barOuter.className = 'frame-pressed-1 relative h-1 w-full overflow-hidden border border-solid border-black bg-black gene-stats-bar-filled';
  barOuter.style.animationDelay = '700ms';
  
  const barFillWrap = document.createElement('div');
  barFillWrap.className = 'absolute left-0 top-0 flex h-full w-full';
  
  const barFill = document.createElement('div');
  barFill.className = 'h-full shrink-0';
  // Calculate percentage based on max value
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));
  barFill.style.width = percentage + '%';
  barFill.style.background = barColor;
  
  barFillWrap.appendChild(barFill);
  barOuter.appendChild(barFillWrap);
  
  // Spill particles
  const barRight = document.createElement('div');
  barRight.className = 'absolute left-full top-1/2 z-[201] -translate-y-1/2';
  barRight.style.display = 'block';
  
  const skillBar = document.createElement('div');
  skillBar.className = 'relative text-skillBar';
  
  const spill1 = document.createElement('div');
  spill1.className = 'spill-particles absolute left-full h-px w-0.5 bg-current';
  
  const spill2 = document.createElement('div');
  spill2.className = 'spill-particles-2 absolute left-full h-px w-0.5 bg-current';
  
  skillBar.appendChild(spill1);
  skillBar.appendChild(spill2);
  barRight.appendChild(skillBar);
  
  barRow.appendChild(barOuter);
  barRow.appendChild(barRight);
  
  statRow.appendChild(barRow);
  
  return statRow;
}

// Add custom HTML tooltip with progress bars to portrait
function addCustomTooltipToPortrait(portrait, level, hp, ad, ap, armor, magicResist, isModified) {
  try {
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'setup-manager-monster-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      display: none;
      z-index: 10000;
      pointer-events: none;
    `;
    
    // Create tooltip content container
    const tooltipContent = document.createElement('div');
    tooltipContent.className = 'frame-pressed-1 surface-dark flex shrink-0 flex-col gap-1.5 px-2 py-1 pb-2';
    
    // Stat max values (genes max at 20)
    const statMaxValues = {
      hp: 20,
      ad: 20,
      ap: 20,
      armor: 20,
      magicResist: 20
    };
    
    // Stat colors (all green)
    const statColors = {
      hp: 'rgb(96, 192, 96)',
      ad: 'rgb(96, 192, 96)',
      ap: 'rgb(96, 192, 96)',
      armor: 'rgb(96, 192, 96)',
      magicResist: 'rgb(96, 192, 96)'
    };
    
    // Add stat rows
    tooltipContent.appendChild(createStatRow('Hitpoints', hp, statMaxValues.hp, statColors.hp));
    tooltipContent.appendChild(createStatRow('Attack', ad, statMaxValues.ad, statColors.ad));
    tooltipContent.appendChild(createStatRow('Ability Power', ap, statMaxValues.ap, statColors.ap));
    tooltipContent.appendChild(createStatRow('Armor', armor, statMaxValues.armor, statColors.armor));
    tooltipContent.appendChild(createStatRow('Magic Resist', magicResist, statMaxValues.magicResist, statColors.magicResist));
    
    // Add modified indicator if needed
    if (isModified) {
      const modifiedRow = document.createElement('div');
      modifiedRow.className = 'pixel-font-16 text-whiteRegular';
      modifiedRow.style.cssText = 'color: #ff4444; font-style: italic; margin-top: 4px;';
      modifiedRow.textContent = '(modified)';
      tooltipContent.appendChild(modifiedRow);
    }
    
    tooltip.appendChild(tooltipContent);
    document.body.appendChild(tooltip);
    
    // Show/hide tooltip on hover
    let tooltipTimeout;
    const showTooltip = (e) => {
      if (tooltipTimeout) clearTimeout(tooltipTimeout);
      tooltipTimeout = setTimeout(() => {
        tooltip.style.display = 'block';
        updateTooltipPosition(tooltip, e, portrait);
      }, 300);
    };
    
    const hideTooltip = () => {
      if (tooltipTimeout) clearTimeout(tooltipTimeout);
      tooltip.style.display = 'none';
    };
    
    const updateTooltipPosition = (tooltipEl, event, portraitEl) => {
      if (!event) return;
      
      const rect = portraitEl.getBoundingClientRect();
      const tooltipRect = tooltipEl.getBoundingClientRect();
      
      let left = rect.right + 10;
      let top = rect.top;
      
      // Adjust if tooltip goes off screen
      if (left + tooltipRect.width > window.innerWidth) {
        left = rect.left - tooltipRect.width - 10;
      }
      if (top + tooltipRect.height > window.innerHeight) {
        top = window.innerHeight - tooltipRect.height - 10;
      }
      if (top < 0) {
        top = 10;
      }
      
      tooltipEl.style.left = left + 'px';
      tooltipEl.style.top = top + 'px';
    };
    
    // Attach event listeners to portrait
    portrait.addEventListener('mouseenter', showTooltip);
    portrait.addEventListener('mouseleave', hideTooltip);
    portrait.addEventListener('mousemove', (e) => {
      if (tooltip.style.display === 'block') {
        updateTooltipPosition(tooltip, e, portrait);
      }
    });
    
    // Store tooltip reference for cleanup
    portrait._setupManagerTooltip = tooltip;
    
  } catch (error) {
    console.error('Error adding custom tooltip to portrait:', error);
    // Fallback to simple title tooltip
    const { hp = 0, ad = 0, ap = 0, armor = 0, magicResist = 0 } = { hp, ad, ap, armor, magicResist };
    let tooltipText = `Level: ${level}\nAD: ${ad}, AP: ${ap}, HP: ${hp}, ARM: ${armor}, MR: ${magicResist}`;
    if (isModified) {
      tooltipText += '\n(modified)';
    }
    portrait.title = tooltipText;
  }
}

// Helper function to create monster portraits with correct tier coloring
function createMonsterPortrait(monsterInfo, showWarning = false) {
  if (!monsterInfo || !monsterInfo.gameId) {
    return null;
  }
  
  try {
    // Create monster portrait with calculated tier colors
    const portrait = api.ui.components.createMonsterPortrait({
      monsterId: monsterInfo.gameId,
      level: monsterInfo.level || 1,
      tier: monsterInfo.tier || 1
    });
    
    // Ensure rarity border is set correctly
    const rarity = Math.min(5, Math.max(1, monsterInfo.tier || 1));
    
    // Remove any inline border styles from the portrait - rarity element provides the border
    if (portrait.style && portrait.style.border) {
      portrait.style.border = 'none';
    }
    
    // Try to find rarity element at different levels of nesting
    let rarityElement = portrait.querySelector('.has-rarity');
    if (!rarityElement) {
      // Try finding in button or slot elements
      const button = portrait.querySelector('button');
      if (button) {
        rarityElement = button.querySelector('.has-rarity');
      }
    }
    if (!rarityElement) {
      // Try finding in container-slot
      const slot = portrait.querySelector('.container-slot');
      if (slot) {
        rarityElement = slot.querySelector('.has-rarity');
      }
    }
    
    // If rarity element exists, update it
    if (rarityElement) {
      rarityElement.setAttribute('data-rarity', rarity);
      
      // Remove inline border from container - rarity element provides the border
      const container = rarityElement.parentElement;
      if (container && container.style && container.style.border) {
        container.style.border = 'none';
      }
    } else {
      // If rarity element doesn't exist, add it to the portrait
      // Find the main container div that has position: relative
      const container = portrait.querySelector('div[style*="position: relative"]') || 
                        portrait.querySelector('.container-slot') || 
                        (portrait.style && portrait.style.position === 'relative' ? portrait : null);
      
      if (container) {
        // Ensure container has position: relative for absolute positioning
        if (!container.style.position || container.style.position !== 'relative') {
          container.style.position = 'relative';
        }
        
        // Remove inline border style - the rarity element will provide the border
        if (container.style.border) {
          container.style.border = 'none';
        }
        
        // Create rarity element
        const rarityBg = document.createElement('div');
        rarityBg.className = 'has-rarity absolute inset-0 z-1 opacity-80';
        rarityBg.setAttribute('data-rarity', rarity);
        rarityBg.style.cssText = 'position: absolute; inset: 0; z-index: 1; opacity: 0.8; pointer-events: none;';
        
        // Insert it as the first child so it's behind the image
        if (container.firstChild) {
          container.insertBefore(rarityBg, container.firstChild);
        } else {
          container.appendChild(rarityBg);
        }
      }
    }
    
    // Add warning symbol if needed
    if (showWarning) {
      addWarningSymbolToPortrait(portrait);
    }
    
    // Add custom HTML tooltip with progress bars if stats are available
    if (monsterInfo.stats) {
      const { hp = 0, ad = 0, ap = 0, armor = 0, magicResist = 0 } = monsterInfo.stats;
      addCustomTooltipToPortrait(portrait, monsterInfo.level || 1, hp, ad, ap, armor, magicResist, showWarning);
    }
    
    return portrait;
  } catch (error) {
    console.error('Error creating monster portrait:', error);
    return null;
  }
}

// Helper function to extract stats object from monster or genes
function extractStatsFromMonster(monsterOrGenes) {
  return {
    hp: monsterOrGenes.hp || 0,
    ad: monsterOrGenes.ad || 0,
    ap: monsterOrGenes.ap || 0,
    armor: monsterOrGenes.armor || 0,
    magicResist: monsterOrGenes.magicResist || 0
  };
}

// Helper function to get equipment spriteId from gameId
function getEquipmentSpriteId(gameId) {
  try {
    const equipData = globalThis.state.utils.getEquipment(gameId);
    if (equipData && equipData.metadata) {
      return equipData.metadata.spriteId;
    }
  } catch (e) {
    console.warn('Error getting equipment data:', e);
  }
  return null;
}

// Helper function to extract inner div from item portrait button
function extractPortraitFromButton(itemPortrait) {
  if (!itemPortrait || itemPortrait.tagName !== 'BUTTON') {
    return itemPortrait;
  }
  
  // Look for .equipment-portrait div (direct child or nested)
  const innerDiv = itemPortrait.querySelector('.equipment-portrait');
  if (innerDiv) {
    return innerDiv.cloneNode(true);
  }
  
  // Fallback: get the first direct child div
  const firstDiv = Array.from(itemPortrait.children).find(child => child.tagName === 'DIV');
  if (firstDiv) {
    return firstDiv.cloneNode(true);
  }
  
  return itemPortrait;
}

// Helper function to create equipment portrait from gameId, stat, and tier
function createEquipmentPortraitFromData(gameId, stat, tier) {
  if (!gameId) {
    return null;
  }
  
  const spriteId = getEquipmentSpriteId(gameId);
  if (!spriteId) {
    return null;
  }
  
  if (typeof api?.ui?.components?.createItemPortrait === 'function') {
    const itemPortrait = api.ui.components.createItemPortrait({
      itemId: spriteId,
      stat: stat,
      tier: tier
    });
    
    return extractPortraitFromButton(itemPortrait);
  }
  
  return null;
}

// Helper function to create equipment portrait
function createEquipmentPortrait(equipId) {
  if (!equipId) {
    return null;
  }
  
  try {
    // Get equipment data from player context (equipId is database ID in board configs)
    const playerContext = globalThis.state.player.getSnapshot().context;
    const { equips } = playerContext;
    
    // Create lookup map from database ID to gameId (same as Item_tier_list.js)
    const equipLookup = new Map(equips.map(m => [m.id, m.gameId]));
    
    // Convert database ID to gameId
    const gameId = equipLookup.get(equipId);
    if (!gameId) {
      return null;
    }
    
    // Get stat and tier from the equipment item
    const equip = equips.find(e => e.id === equipId);
    const stat = equip ? equip.stat : null;
    const tier = equip ? equip.tier : null;
    
    return createEquipmentPortraitFromData(gameId, stat, tier);
  } catch (error) {
    console.error('Error creating equipment portrait:', error);
    return null;
  }
}

// Helper function to create equipment portrait from custom equip object
function createEquipmentPortraitFromCustom(equip) {
  if (!equip || !equip.gameId) {
    return null;
  }
  
  try {
    return createEquipmentPortraitFromData(equip.gameId, equip.stat, equip.tier);
  } catch (error) {
    console.error('Error creating equipment portrait from custom:', error);
    return null;
  }
}

// Helper function to create an empty equipment frame
function createEmptyEquipmentFrame() {
  const portrait = document.createElement('div');
  portrait.className = 'equipment-portrait surface-darker relative data-[alive=false]:dithered data-[noframes=false]:frame-pressed-1 hover:unset-border-image';
  portrait.setAttribute('data-noframes', 'false');
  portrait.setAttribute('data-alive', 'false');
  portrait.setAttribute('data-highlighted', 'true');
  portrait.style.cssText = 'width: 32px; height: 32px; max-width: 32px; max-height: 32px;';
  
  // Add rarity background (tier 1 for empty)
  const rarityBg = document.createElement('div');
  rarityBg.className = 'has-rarity absolute inset-0 z-1 opacity-80';
  rarityBg.setAttribute('data-rarity', '1');
  portrait.appendChild(rarityBg);
  
  // Empty frame - no sprite, no stat icon
  // The frame styling is already applied via classes
  
  return portrait;
}

// Helper function to create a creature+equipment pair container
function createCreatureEquipmentPair(monsterInfo, equipId, isCustom = false, existsInCollection = true, customEquip = null) {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'row';
  container.style.gap = '2px';
  container.style.alignItems = 'center';
  
  // Create monster portrait with warning if needed
  const showWarning = isCustom && !existsInCollection;
  const monsterPortrait = createMonsterPortrait(monsterInfo, showWarning);
  if (monsterPortrait) {
    container.appendChild(monsterPortrait);
  }
  
  // Create equipment portrait (or empty frame if no equipment)
  let equipmentPortrait = null;
  if (isCustom && customEquip) {
    equipmentPortrait = createEquipmentPortraitFromCustom(customEquip);
  } else if (equipId) {
    equipmentPortrait = createEquipmentPortrait(equipId);
  }
  
  // Always show equipment frame (empty if no equipment)
  if (!equipmentPortrait) {
    equipmentPortrait = createEmptyEquipmentFrame();
  }
  
  container.appendChild(equipmentPortrait);
  
  return container;
}

// Function to force close all open modals
function forceCloseAllModals() {
      console.log("Force closing all modals...");
  
  // Try to close the tracked activeModal first with the API
  if (activeModal && typeof activeModal.close === 'function') {
    try {
      activeModal.close();
    } catch (error) {
      console.error("Error closing active modal:", error);
    }
    activeModal = null;
  }
  
  // Find all open dialog elements
  const allDialogs = document.querySelectorAll('div[role="dialog"][data-state="open"]');
  allDialogs.forEach(dialog => {
          console.log("Found open modal to close:", dialog);
    
    // Change state to closed
    dialog.setAttribute('data-state', 'closed');
    
    // Force remove after a small delay
    setTimeout(() => {
      if (dialog.parentNode) {
        dialog.parentNode.removeChild(dialog);
        console.log("Modal removed successfully");
      }
    }, 50);
  });
  
  // Remove modal overlays
  document.querySelectorAll('.modal-overlay, .fixed.inset-0').forEach(overlay => {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
              console.log("Modal overlay removed");
    }
  });
  
  // Reset body styles
  document.body.style.overflow = '';
}

// Cleanup function for Setup Manager mod (exposed for mod system)
context.exports.cleanup = function() {
  console.log('[Setup Manager] Running cleanup...');
  
  // Remove any active UI components
  if (activeButtonElement) {
    activeButtonElement.remove();
    activeButtonElement = null;
  }
  
  // Remove any existing modals
  const existingModal = document.querySelector('#setup-manager-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Clear any cached data
  if (typeof window.setupManagerState !== 'undefined') {
    delete window.setupManagerState;
  }
  
  console.log('[Setup Manager] Cleanup completed');
}; 
