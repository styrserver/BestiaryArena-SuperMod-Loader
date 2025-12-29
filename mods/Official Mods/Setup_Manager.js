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

// Constants
const MOD_ID = 'setup-manager';
const BUTTON_ID = `${MOD_ID}-button`;
const STORAGE_KEY = 'bestiary-setup-manager-v1';
const DEFAULT_TEAM_NAMES = ['Farm', 'S+', 'Speedrun'];

// Ensure the savedSetups object has structure we expect
if (!config.savedSetups) {
  config.savedSetups = {};
}

// Ensure setupNameMaxLength uses at least the new default value
if (!config.setupNameMaxLength || config.setupNameMaxLength < defaultConfig.setupNameMaxLength) {
  config.setupNameMaxLength = defaultConfig.setupNameMaxLength;
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

// Get all player pieces on the board in the format needed for autoSetupBoard
function getCurrentTeamSetup() {
  try {
    const boardSnapshot = globalThis.state.board.getSnapshot();
    if (!boardSnapshot || !boardSnapshot.context || !boardSnapshot.context.boardConfig) {
      return [];
    }
    
    const setup = [];
    
    // Get player equipment for looking up equipment metadata
    const playerSnapshot = globalThis.state.player.getSnapshot();
    
    // Equipment is stored in 'equips', not 'equipment'!
    const playerEquipment = playerSnapshot?.context?.equips || [];
    
    // Only consider player pieces (not custom or enemy pieces)
    boardSnapshot.context.boardConfig.filter(piece => piece.type === 'player').forEach(piece => {
      const setupPiece = {
        monsterId: piece.databaseId,
        equipId: piece.equipId,
        tileIndex: piece.tileIndex
      };
      
      // Try to save equipment metadata for future reference
      if (piece.equipId) {
        try {
          const equipmentInstance = playerEquipment.find(eq => eq.id === piece.equipId);
          
            if (equipmentInstance) {
            const equipmentData = globalThis.state?.utils?.getEquipment?.(equipmentInstance.gameId);
            
            if (equipmentData && equipmentData.metadata) {
              // Save equipment metadata so we can display it even if player no longer owns it
              setupPiece.equipmentMetadata = {
                gameId: equipmentInstance.gameId,
                name: equipmentData.metadata.name,
                sprite: equipmentData.metadata.sprite || equipmentInstance.gameId,
                stat: equipmentInstance.stat, // Stat is on the instance, not equipmentData
                tier: equipmentInstance.tier || equipmentData.tier
              };
            }
          } else {
            console.warn('[Setup Manager] Equipment not found for equipId:', piece.equipId);
          }
        } catch (error) {
          console.error('[Setup Manager] Error saving equipment metadata:', error);
        }
      }
      
      setup.push(setupPiece);
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
    // Update the existing setup
    config.savedSetups[mapId][existingSetupIndex] = { name, setup };
  } else {
    // Add a new setup
    config.savedSetups[mapId].push({ name, setup });
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
  if (setupName === 'Original') {
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
    
    // If setupName is "Original", use the game's built-in saved setup from player context
    if (setupName === 'Original') {
      try {
        // Get the player's saved configuration for this map
        const playerContext = globalThis.state.player.getSnapshot().context;
        const originalSetup = playerContext.boardConfigs[mapId];
        
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
    
    // Apply the setup
    globalThis.state.board.send({
      type: "autoSetupBoard",
      setup: setupArray
    });
    
    return true;
  } catch (error) {
    console.error('Error loading team setup:', error);
    return false;
  }
}

// Update loadTeamAndNotify to handle the modal differently for Original team
function loadTeamAndNotify(mapId, setupName) {
  // Check if this is the Original team
  const isOriginalTeam = setupName === 'Original';
  
  // If it's not the Original team, close all modals
  if (!isOriginalTeam) {
    forceCloseAllModals();
  }
  
  // Load the team setup
  if (loadTeamSetup(mapId, setupName, isOriginalTeam)) {
    showNotification(t('mods.setupManager.teamLoaded'), 'success');
    
    // For Original team, reshow the modal after a short delay
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

// Create a setup card for a team
function createSetupCard(mapId, setupName, setupData) {
  const card = document.createElement('div');
  card.className = 'frame-pressed-1 surface-dark p-2 mb-3';
  
  // Header section with name and actions
  const headerDiv = document.createElement('div');
  headerDiv.className = 'flex justify-between items-center mb-2';
  
  // Setup name
  const nameSpan = document.createElement('span');
  nameSpan.className = 'pixel-font-16 text-whiteRegular';
  nameSpan.textContent = setupName;
  headerDiv.appendChild(nameSpan);
  
  // Actions container
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'flex gap-1';
  
  // Load button
  const loadButton = createActionButton(
    t('mods.setupManager.loadTeam'), 
    () => loadTeamAndNotify(mapId, setupName), 
    true,
    null,
    true
  );
  actionsDiv.appendChild(loadButton);
  
  // Delete button (only for non-original setups)
  if (setupName !== 'Original') {
    const deleteButton = createDeleteButton(() => {
      showDeleteConfirmation(mapId, setupName);
    });
    actionsDiv.appendChild(deleteButton);
  }
  
  headerDiv.appendChild(actionsDiv);
  card.appendChild(headerDiv);
  
  // Team content section
  const teamContent = document.createElement('div');
  teamContent.className = 'flex flex-wrap gap-1';
  
  // For "Original" setup, get monsters from the player's saved setup
  if (setupName === 'Original') {
    const playerContext = globalThis.state.player.getSnapshot().context;
    const boardSetup = playerContext.boardConfigs[mapId];
    
    if (boardSetup && Array.isArray(boardSetup) && boardSetup.length > 0) {
      boardSetup.forEach(piece => {
        if (piece && piece.monsterId) {
          const monsterInfo = getMonsterInfo(piece.monsterId);
          if (monsterInfo) {
            const monsterPortrait = createMonsterPortrait(monsterInfo, piece.equipId, piece.equipmentMetadata);
            if (monsterPortrait) {
              teamContent.appendChild(monsterPortrait);
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
      if (piece && piece.monsterId) {
        const monsterInfo = getMonsterInfo(piece.monsterId);
        if (monsterInfo) {
          const monsterPortrait = createMonsterPortrait(monsterInfo, piece.equipId, piece.equipmentMetadata);
          if (monsterPortrait) {
            teamContent.appendChild(monsterPortrait);
          }
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
  
  card.appendChild(teamContent);
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
    const originalCard = createSetupCard(mapId, 'Original');
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
      width: 360,
      content: content,
      buttons: [
        {
          text: t('common.cancel'),
          primary: false,
          closeOnClick: true
        }
      ]
    });
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
    previewContainer.className = 'flex flex-wrap gap-2 mb-4';
    
    // Add monster portraits to preview
    currentSetup.forEach(piece => {
      if (piece && piece.monsterId) {
        const monsterInfo = getMonsterInfo(piece.monsterId);
        if (monsterInfo) {
          const portrait = createMonsterPortrait(monsterInfo, piece.equipId, piece.equipmentMetadata);
          if (portrait) {
            previewContainer.appendChild(portrait);
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
    
    const setupNameEl = document.createElement('h3');
    setupNameEl.className = 'text-whiteRegular mb-2';
    setupNameEl.textContent = setupName;
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

// Helper function to create monster portraits with correct tier coloring
function createMonsterPortrait(monsterInfo, equipId = null, equipmentMetadata = null) {
  if (!monsterInfo || !monsterInfo.gameId) {
    return null;
  }
  
  try {
    // Create a container for the portrait and equipment
    const container = document.createElement('div');
    container.style.cssText = `
      position: relative;
      display: inline-block;
    `;
    
    // Create monster portrait with calculated tier colors
    const portrait = api.ui.components.createMonsterPortrait({
      monsterId: monsterInfo.gameId,
      level: monsterInfo.level || 1,
      tier: monsterInfo.tier || 1
    });
    
    container.appendChild(portrait);
    
    // Build comprehensive tooltip with equipment info if available
    try {
      let equipName = null;
      let equipStatType = null;
      let equipTier = null;
      
      // First, try to use saved equipment metadata (works even if player no longer owns the item)
      if (equipmentMetadata) {
        equipName = equipmentMetadata.name;
        equipStatType = equipmentMetadata.stat;
        equipTier = equipmentMetadata.tier;
      } 
      // Fallback: try to look up equipment in player's current inventory
      else if (equipId) {
        const playerSnapshot = globalThis.state.player.getSnapshot();
        const playerEquipment = playerSnapshot?.context?.equips;
        
        if (playerEquipment && Array.isArray(playerEquipment)) {
          const equipmentInstance = playerEquipment.find(eq => eq.id === equipId);
          
          if (equipmentInstance) {
            const equipmentData = globalThis.state?.utils?.getEquipment?.(equipmentInstance.gameId);
            
            if (equipmentData && equipmentData.metadata) {
              equipName = equipmentData.metadata.name;
              equipStatType = equipmentInstance.stat;
              equipTier = equipmentInstance.tier || equipmentData.tier;
            }
          }
        }
      }
      
      // Build tooltip
      let tooltipParts = [];
      
      // Add monster info
      if (monsterInfo.stats) {
        const statsSum = Object.values(monsterInfo.stats).reduce((sum, stat) => sum + stat, 0);
        tooltipParts.push(`Level: ${monsterInfo.level}`);
        tooltipParts.push(`Stats: ${statsSum}`);
      }
      
      // Add equipment info
      if (equipName) {
        tooltipParts.push(`\nEquipment: ${equipName}`);
        if (equipTier) {
          tooltipParts.push(`Tier: ${equipTier}`);
        }
        if (equipStatType) {
          tooltipParts.push(`Stat: ${equipStatType.toUpperCase()}`);
        }
      }
      
      // Set the tooltip on the container
      if (tooltipParts.length > 0) {
        container.title = tooltipParts.join('\n');
      }
    } catch (error) {
      console.error('[Setup Manager] Error creating tooltip:', error);
      // Fallback tooltip with just monster info
      if (monsterInfo.stats) {
        const statsSum = Object.values(monsterInfo.stats).reduce((sum, stat) => sum + stat, 0);
        container.title = `Level: ${monsterInfo.level}\nStats: ${statsSum}`;
      }
    }
    
    return container;
  } catch (error) {
    console.error('Error creating monster portrait:', error);
    return null;
  }
}

// Function to force close all open modals
function forceCloseAllModals() {
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
    // Change state to closed
    dialog.setAttribute('data-state', 'closed');
    
    // Force remove after a small delay
    setTimeout(() => {
      if (dialog.parentNode) {
        dialog.parentNode.removeChild(dialog);
      }
    }, 50);
  });
  
  // Remove modal overlays
  document.querySelectorAll('.modal-overlay, .fixed.inset-0').forEach(overlay => {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
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
