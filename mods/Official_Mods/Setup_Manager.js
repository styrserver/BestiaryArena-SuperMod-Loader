// Setup Manager Mod for Bestiary Arena
console.log('Setup Manager Mod initializing...');

// Configuration with defaults
const defaultConfig = {
  savedSetups: {},  // This will store all saved team setups by map ID
  setupNameMaxLength: 100, // Maximum character length for setup names
  maxSetupsPerMap: 10, // Maximum number of setups per map
  showMapShortcuts: true, // Show quick-load setup buttons on the map
  mapShortcutsMinimized: false, // Whether the map shortcut bar is collapsed
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

// Ensure the savedSetups object has structure we expect
if (!config.savedSetups) {
  config.savedSetups = {};
}

// We'll hold references to active UI components here for cleanup
let activeButtonElement = null;
let mapShortcutsContainer = null;
let mapShortcutsSubscription = null;
let mapShortcutsMapId = null;

// Add a reference to track active modals
let activeModal = null;
let setupManagerModalLayoutCleanup = null;
let pendingDeleteConfirmation = null;

// Helper function to safely access nested properties
const safeAccess = (obj, path) => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

// Use shared translation system via API
const t = (key) => api.i18n.t(key);

function isSetupShortcutsAndHoverEnabled() {
  return window.betterUIConfig?.enableSetupShortcutsAndHover !== false;
}

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
      level: globalThis.state.utils.expToCurrentLevel(monster.exp),
      shiny: monster.shiny === true,
      awaken: monster.awaken === true || monster.awakened === true || monster.isAwakened === true,
      awakened: monster.awakened === true || monster.isAwakened === true,
      isAwakened: monster.isAwakened === true,
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
      shiny: customPiece.shiny === true,
      awaken: customPiece.awaken === true || customPiece.awakened === true || customPiece.isAwakened === true,
      awakened: customPiece.awakened === true || customPiece.isAwakened === true,
      isAwakened: customPiece.isAwakened === true,
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

function resolveMapDisplayName(mapId) {
  try {
    if (!mapId) return null;

    if (window.mapIdsToNames?.has(mapId)) {
      return window.mapIdsToNames.get(mapId);
    }

    if (globalThis.state?.utils?.ROOM_NAME?.[mapId]) {
      return globalThis.state.utils.ROOM_NAME[mapId];
    }

    return mapId;
  } catch (error) {
    console.warn('[Setup Manager] Error resolving map name:', error);
    return mapId;
  }
}

// Get current map display name
function getCurrentMapName() {
  try {
    const mapId = getCurrentMapId();
    if (!mapId) {
      return t('mods.setupManager.unknownMap');
    }
    
    return resolveMapDisplayName(mapId) || t('mods.setupManager.unknownMap');
  } catch (error) {
    console.error('Error getting current map name:', error);
    return t('mods.setupManager.unknownMap');
  }
}

function formatSetupCreatureCount(current, max) {
  return tReplace('mods.setupManager.creatureCount', { current, max });
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

    updateMapShortcuts();
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
  
  if (config.savedSetups[mapId].some(savedSetup => savedSetup.name === name)) {
    showNotification(t('mods.setupManager.setupNameExists'), 'error');
    return false;
  }

  config.savedSetups[mapId].push({ name, setup, notes: '' });
  
  // Save the updated config
  saveConfigToStorage();
  
  return true;
}

function renameTeamSetup(mapId, oldName, newName) {
  const trimmedName = newName?.trim();
  if (!mapId || !oldName || !trimmedName) {
    showNotification(t('common.error'), 'error');
    return false;
  }

  if (oldName === 'Auto-Setup') {
    return false;
  }

  if (trimmedName === oldName) {
    return true;
  }

  if (trimmedName.length > config.setupNameMaxLength) {
    showNotification(tReplace('mods.setupManager.nameTooLong', { max: config.setupNameMaxLength }), 'error');
    return false;
  }

  const setups = config.savedSetups[mapId];
  if (!setups) {
    showNotification(t('common.error'), 'error');
    return false;
  }

  const setupIndex = setups.findIndex(setup => setup.name === oldName);
  if (setupIndex < 0) {
    showNotification(t('common.error'), 'error');
    return false;
  }

  if (setups.some(setup => setup.name === trimmedName)) {
    showNotification(t('mods.setupManager.setupNameExists'), 'error');
    return false;
  }

  const existingSetup = setups[setupIndex];
  setups[setupIndex] = { ...existingSetup, name: trimmedName };
  saveConfigToStorage();
  return true;
}

function saveSetupRenameInline(mapId, oldName, newName) {
  const trimmedName = newName?.trim();
  if (!trimmedName) {
    showNotification(t('common.error'), 'error');
    return false;
  }

  const renameResult = renameTeamSetup(mapId, oldName, trimmedName);
  if (renameResult) {
    if (trimmedName !== oldName) {
      showNotification(t('mods.setupManager.teamRenamed'), 'success');
    }
    showSetupManagerModal();
    return true;
  }

  return false;
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

function loadTeamSetup(mapId, setupName) {
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
        buttons: [{ text: t('controls.ok'), primary: true }]
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
          showNotification(t('mods.setupManager.noOriginalSetup'), 'error');
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

function loadTeamAndNotify(mapId, setupName) {
  if (loadTeamSetup(mapId, setupName)) {
    forceCloseAllModals();
    showNotification(t('mods.setupManager.teamLoaded'), 'success');
    return true;
  }

  showNotification(t('common.error'), 'error');
  return false;
}

// ========== UI Functions ==========

const SETUP_MANAGER_MODAL_CONFIG = {
  width: 500,
  height: 550,
  viewportPadding: 16,
  minWidth: 280,
  minHeight: 280
};

function getSetupManagerModalDimensions() {
  const pad = SETUP_MANAGER_MODAL_CONFIG.viewportPadding * 2;
  return {
    width: Math.max(
      SETUP_MANAGER_MODAL_CONFIG.minWidth,
      Math.min(SETUP_MANAGER_MODAL_CONFIG.width, window.innerWidth - pad)
    ),
    height: Math.max(
      SETUP_MANAGER_MODAL_CONFIG.minHeight,
      Math.min(SETUP_MANAGER_MODAL_CONFIG.height, window.innerHeight - pad)
    )
  };
}

function clearSetupManagerModalLayoutCleanup() {
  if (setupManagerModalLayoutCleanup) {
    setupManagerModalLayoutCleanup();
    setupManagerModalLayoutCleanup = null;
  }
}
const SETUP_MANAGER_EQUIPMENT_PORTRAIT_SIZE = 34;
const SETUP_NAME_FIELD_HEIGHT_PX = 25;

const SETUP_MANAGER_BUTTON_CLASS = {
  primary: 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-14',
  secondary: 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14',
  danger: 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1-red active:frame-pressed-1-red surface-red gap-1 px-2 py-0.5 pb-[3px] pixel-font-14'
};

const SETUP_MANAGER_SCROLLBAR_GUTTER_PX = 12;

function applySetupManagerViewportWidth(element) {
  if (!element) return;
  const gutter = `${SETUP_MANAGER_SCROLLBAR_GUTTER_PX}px`;
  element.style.width = `calc(100% - ${gutter})`;
  element.style.maxWidth = `calc(100% - ${gutter})`;
}

function applySetupManagerScrollViewportGutter(scrollContainer) {
  if (!scrollContainer?.element) return;

  const viewport = scrollContainer.scrollView ||
    scrollContainer.element.querySelector('[data-radix-scroll-area-viewport]') ||
    scrollContainer.element.querySelector('.scroll-view');
  if (!viewport) return;

  viewport.setAttribute('data-radix-scroll-area-viewport', '');
  viewport.setAttribute('data-type', 'always');
  viewport.className = 'h-full w-[calc(100%-12px)] data-[type=\'auto\']:w-full';
  viewport.style.overflow = 'hidden scroll';

  const contentContainer = scrollContainer.contentContainer;
  if (contentContainer) {
    contentContainer.className = 'my-1 grid items-start gap-1 data-[nopadding=\'true\']:my-0';
    contentContainer.dataset.nopadding = 'false';
    contentContainer.style.gridTemplateRows = 'max-content';
  }

  const scrollbar = scrollContainer.element.querySelector('[data-orientation="vertical"]') ||
    Array.from(scrollContainer.element.children).find(
      child => child !== viewport && child.classList?.contains('frame-1')
    );
  if (scrollbar) {
    scrollbar.setAttribute('data-orientation', 'vertical');
    scrollbar.className = 'scrollbar-element frame-1 surface-dark flex touch-none select-none border-0 data-[orientation=\'horizontal\']:h-3 data-[orientation=\'vertical\']:h-full data-[orientation=\'vertical\']:w-3 data-[orientation=\'horizontal\']:flex-col';
    scrollbar.style.cssText = `position: absolute; top: 0px; right: 0px; bottom: 0px; width: ${SETUP_MANAGER_SCROLLBAR_GUTTER_PX}px;`;
  }
}

function createSetupManagerScrollContainer({ grow = true } = {}) {
  const scrollContainer = api.ui.components.createScrollContainer({
    height: grow ? '100%' : 'auto',
    padding: true,
    content: ''
  });
  Object.assign(scrollContainer.element.style, {
    flex: grow ? '1 1 0' : '0 0 auto',
    minHeight: '0',
    height: 'auto',
    position: 'relative',
    overflow: 'hidden'
  });
  applySetupManagerScrollViewportGutter(scrollContainer);
  return scrollContainer;
}

function styleSetupManagerFooterButtons(footer) {
  if (!footer) return;

  footer.style.cssText = `
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
  `;

  const backBtn = footer.querySelector('.setup-manager-back-button');
  if (backBtn) {
    backBtn.className = `${SETUP_MANAGER_BUTTON_CLASS.secondary} setup-manager-back-button`;
    backBtn.style.cssText = 'cursor: pointer; margin-right: auto;';
  }

  const actionButtons = footer.querySelectorAll('button:not(.setup-manager-back-button)');
  actionButtons.forEach((button) => {
    const bg = button.style.backgroundColor?.toLowerCase();
    const isPrimary = bg === 'rgb(76, 175, 80)' || bg === '#4caf50';
    button.className = isPrimary
      ? SETUP_MANAGER_BUTTON_CLASS.primary
      : SETUP_MANAGER_BUTTON_CLASS.secondary;
    button.style.cssText = '';
  });
}

function getSetupManagerDialog(modalRef) {
  if (modalRef?.element) return modalRef.element;
  if (modalRef instanceof HTMLElement) return modalRef;
  return document.querySelector('div[role="dialog"][data-state="open"]') ||
    document.querySelector('div[role="dialog"]');
}

function applySetupManagerExpandedLayout(modalRef, dimensions, contentRoot) {
  try {
    const dialog = getSetupManagerDialog(modalRef);
    if (!dialog) return;

    const { width, height } = dimensions || getSetupManagerModalDimensions();

    dialog.classList.remove('w-full', 'max-w-[300px]');
    dialog.style.width = `${width}px`;
    dialog.style.minWidth = '0';
    dialog.style.maxWidth = `${width}px`;
    dialog.style.height = `${height}px`;
    dialog.style.minHeight = '0';
    dialog.style.maxHeight = `${height}px`;
    dialog.style.boxSizing = 'border-box';

    const rootWrapper = dialog.querySelector(':scope > div');
    if (rootWrapper) {
      rootWrapper.style.height = '100%';
      rootWrapper.style.display = 'flex';
      rootWrapper.style.flexDirection = 'column';
      rootWrapper.style.minHeight = '0';
    }

    const widgetBottom = dialog.querySelector('.widget-bottom');
    if (widgetBottom) {
      Object.assign(widgetBottom.style, {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minHeight: '0',
        overflowY: 'hidden',
        overflowX: 'hidden'
      });
    }

    if (contentRoot) {
      Object.assign(contentRoot.style, {
        flex: '1 1 auto',
        minHeight: '0',
        height: '100%',
        maxHeight: 'none'
      });
    }

    styleSetupManagerFooterButtons(dialog.querySelector('.flex.justify-end.gap-2'));
  } catch (error) {
    console.warn('[Setup Manager] Failed to apply expanded modal layout:', error);
  }
}

function setupSetupManagerModalResponsiveLayout(modalRef, contentRoot) {
  clearSetupManagerModalLayoutCleanup();
  const apply = () => applySetupManagerExpandedLayout(modalRef, getSetupManagerModalDimensions(), contentRoot);
  requestAnimationFrame(() => apply());
  const onResize = () => apply();
  window.addEventListener('resize', onResize);
  setupManagerModalLayoutCleanup = () => {
    window.removeEventListener('resize', onResize);
  };
}

function addSetupManagerFooterBackButton(modalRef, onClick) {
  try {
    const dialog = getSetupManagerDialog(modalRef);
    const footer = dialog?.querySelector('.flex.justify-end.gap-2');
    if (!footer || footer.querySelector('.setup-manager-back-button')) return;

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = `${SETUP_MANAGER_BUTTON_CLASS.secondary} setup-manager-back-button`;
    backBtn.style.cssText = 'cursor: pointer; margin-right: auto;';
    backBtn.textContent = t('mods.setupManager.back');
    backBtn.addEventListener('click', () => {
      forceCloseAllModals();
      onClick();
    });

    footer.insertBefore(backBtn, footer.firstChild);
    styleSetupManagerFooterButtons(footer);
  } catch (error) {
    console.warn('[Setup Manager] Failed to add back button:', error);
  }
}

function applySetupManagerEquipmentPortraitSize(element, sizePx = SETUP_MANAGER_EQUIPMENT_PORTRAIT_SIZE) {
  if (!element) return element;

  const size = `${sizePx}px`;
  const portrait = element.classList?.contains('equipment-portrait')
    ? element
    : element.querySelector('.equipment-portrait');
  const target = portrait || element;

  target.style.width = size;
  target.style.height = size;
  target.style.maxWidth = size;
  target.style.maxHeight = size;
  target.style.flexShrink = '0';

  normalizeSetupManagerEquipmentStatIcon(target);
  return target;
}

function normalizeSetupManagerEquipmentStatIcon(portrait) {
  if (!portrait?.querySelector) {
    return;
  }

  portrait.style.position = 'relative';
  portrait.style.overflow = 'hidden';

  portrait.querySelectorAll('img[alt="stat type"]').forEach((statIcon) => {
    const container = statIcon.parentElement;
    if (!container) {
      return;
    }

    Object.assign(container.style, {
      position: 'absolute',
      bottom: '0',
      left: '0',
      zIndex: '2',
      display: 'flex',
      alignItems: 'flex-end',
      paddingBottom: '1px',
      paddingLeft: '2px',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      boxSizing: 'border-box'
    });

    Object.assign(statIcon.style, {
      width: '11px',
      height: '11px',
      display: 'block'
    });
  });
}

function extractSetupManagerEquipmentPortrait(itemPortrait) {
  if (!itemPortrait) return null;

  let portrait = itemPortrait;
  if (itemPortrait.tagName === 'BUTTON') {
    portrait = itemPortrait.querySelector('.equipment-portrait')
      || Array.from(itemPortrait.children).find((child) => child.tagName === 'DIV');
    if (!portrait) return null;
    portrait = portrait.cloneNode(true);
  }

  portrait.classList.add('frame-pressed-1', 'pointer-events-none');
  return applySetupManagerEquipmentPortraitSize(portrait);
}

function clampSetupEquipTier(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(5, Math.max(1, parsed));
}

function hasSetupManagerUIComponents() {
  return !!(
    window.BestiaryUIComponents?.createMonsterPortrait
    && window.BestiaryUIComponents?.createItemPortrait
  );
}

function getSetupManagerStatIconSrc(stat) {
  const statType = String(stat || 'ad').toLowerCase();
  if (statType === 'ap' || statType === 'abilitypower') return '/assets/icons/abilitypower.png';
  if (statType === 'hp' || statType === 'health') return '/assets/icons/heal.png';
  if (statType === 'armor') return '/assets/icons/armor.png';
  if (statType === 'mr' || statType === 'magicresist') return '/assets/icons/magicresist.png';
  return '/assets/icons/attackdamage.png';
}

function createSetupManagerEquipmentPortraitFallback(spriteId, stat, tier) {
  if (!spriteId) {
    return null;
  }

  const size = SETUP_MANAGER_EQUIPMENT_PORTRAIT_SIZE;
  const portrait = document.createElement('div');
  portrait.className = 'equipment-portrait surface-darker relative frame-pressed-1 pointer-events-none';
  portrait.style.cssText = `width: ${size}px; height: ${size}px; max-width: ${size}px; max-height: ${size}px; position: relative; overflow: hidden;`;

  const rarityBg = document.createElement('div');
  rarityBg.className = 'has-rarity absolute inset-0 z-1 opacity-80';
  rarityBg.setAttribute('data-rarity', String(clampSetupEquipTier(tier)));
  portrait.appendChild(rarityBg);

  const spriteContainer = document.createElement('div');
  spriteContainer.className = `sprite item relative id-${spriteId}`;
  const viewport = document.createElement('div');
  viewport.className = 'viewport';
  const img = document.createElement('img');
  img.alt = String(spriteId);
  img.className = 'spritesheet';
  img.style.cssText = '--cropX: 0; --cropY: 0;';
  viewport.appendChild(img);
  spriteContainer.appendChild(viewport);
  portrait.appendChild(spriteContainer);

  const statIconContainer = document.createElement('div');
  const statIcon = document.createElement('img');
  statIcon.className = 'pixelated';
  statIcon.alt = 'stat type';
  statIcon.src = getSetupManagerStatIconSrc(stat);
  statIconContainer.appendChild(statIcon);
  portrait.appendChild(statIconContainer);

  normalizeSetupManagerEquipmentStatIcon(portrait);
  return portrait;
}

function createSetupItemPortrait(options) {
  if (hasSetupManagerUIComponents()) {
    try {
      const itemPortrait = window.BestiaryUIComponents.createItemPortrait(options);
      return extractSetupManagerEquipmentPortrait(itemPortrait);
    } catch (error) {
      // Fall through to silent fallback.
    }
  }

  return createSetupManagerEquipmentPortraitFallback(options.itemId, options.stat, options.tier);
}

function toSetupPortraitMonster(monsterInfo) {
  const stats = monsterInfo?.stats || monsterInfo || {};
  return {
    hp: stats.hp ?? monsterInfo?.hp ?? 0,
    ad: stats.ad ?? monsterInfo?.ad ?? 0,
    ap: stats.ap ?? monsterInfo?.ap ?? 0,
    armor: stats.armor ?? monsterInfo?.armor ?? 0,
    magicResist: stats.magicResist ?? monsterInfo?.magicResist ?? 0,
    shiny: monsterInfo?.shiny === true,
    awaken: monsterInfo?.awaken === true || monsterInfo?.awakened === true || monsterInfo?.isAwakened === true,
    awakened: monsterInfo?.awakened === true || monsterInfo?.isAwakened === true,
    isAwakened: monsterInfo?.isAwakened === true
  };
}

function removeSetupPortraitLevelIndicators(slot) {
  if (!slot) {
    return;
  }

  slot.querySelectorAll('.pixel-font-16, .setup-manager-portrait-level').forEach((element) => {
    element.remove();
  });
}

function ensureSetupManagerLevelBadge(slot, level) {
  if (!slot || slot.querySelector('.setup-manager-portrait-level')) {
    return;
  }

  const levelBadge = document.createElement('span');
  levelBadge.className = 'setup-manager-portrait-level';
  levelBadge.setAttribute('translate', 'no');
  levelBadge.textContent = String(level);
  levelBadge.style.cssText = 'position: absolute; bottom: 0; left: 2px; z-index: 3; color: #fff; font-size: 10px; line-height: 1; background: rgba(0, 0, 0, 0.7); padding: 2px; pointer-events: none;';
  slot.appendChild(levelBadge);
}

function finalizeSetupMonsterPortraitSlot(slot, monster, level, { hideLevel = false } = {}) {
  const parsedLevel = Number(level) || 1;
  const portraitMonster = toSetupPortraitMonster(monster);

  removeSetupPortraitLevelIndicators(slot);
  applySetupMonsterPortraitBorder(slot, portraitMonster, parsedLevel);

  if (!hideLevel) {
    ensureSetupManagerLevelBadge(slot, parsedLevel);
  }

  return slot;
}

function isSetupMaxGenes(monster, level) {
  const parsedLevel = Number(level);
  if (parsedLevel !== 99) return false;

  return Number(monster.hp ?? 1) === 20 &&
    Number(monster.ad ?? 1) === 20 &&
    Number(monster.ap ?? 1) === 20 &&
    Number(monster.armor ?? 1) === 20 &&
    Number(monster.magicResist ?? 1) === 20;
}

function isSetupAwakened(monster, level) {
  return monster.awaken === true ||
    monster.awakened === true ||
    monster.isAwakened === true ||
    Number(level) > 50;
}

function applySetupMonsterPortraitBorder(slot, monster, level) {
  const statTier = calculateTierFromStats(monster);
  const maxGenes = isSetupMaxGenes(monster, level);
  const awakened = isSetupAwakened(monster, level);
  const shiny = monster.shiny === true;

  let rarityBg = slot.querySelector('.has-rarity, .rarity-awaken, .rarity-shiny, .rarity-hundo');
  if (!rarityBg) {
    rarityBg = document.createElement('div');
    slot.insertBefore(rarityBg, slot.firstChild);
  }

  if (maxGenes && shiny) {
    rarityBg.className = 'absolute inset-0 z-2 opacity-80 rarity-shiny';
    rarityBg.removeAttribute('data-rarity');
  } else if (maxGenes) {
    rarityBg.className = 'absolute inset-0 z-1 opacity-80 rarity-hundo';
    rarityBg.removeAttribute('data-rarity');
  } else if (awakened) {
    rarityBg.className = 'absolute inset-0 z-2 opacity-80 rarity-awaken';
    rarityBg.removeAttribute('data-rarity');
  } else {
    rarityBg.className = 'has-rarity absolute inset-0 z-1 opacity-80';
    rarityBg.setAttribute('data-rarity', Math.min(5, statTier));
  }

  let starIcon = slot.querySelector('img.tier-stars, img[alt="star tier"], img[alt="shiny-tier"], img[alt="hundo-tier"]');
  if (maxGenes) {
    const iconSrc = shiny ? '/assets/icons/star-tier-shiny.png' : '/assets/icons/star-tier-hundo.png';
    if (!starIcon) {
      starIcon = document.createElement('img');
      starIcon.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
      slot.appendChild(starIcon);
    }
    starIcon.src = iconSrc;
    starIcon.alt = shiny ? 'shiny-tier' : 'hundo-tier';
  } else if (awakened) {
    if (!starIcon) {
      starIcon = document.createElement('img');
      starIcon.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
      starIcon.alt = 'star tier';
      slot.appendChild(starIcon);
    }
    starIcon.src = '/assets/icons/star-tier-awaken.png';
    starIcon.alt = 'star tier';
  } else if (statTier > 1) {
    if (!starIcon) {
      starIcon = document.createElement('img');
      starIcon.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
      starIcon.alt = 'star tier';
      slot.appendChild(starIcon);
    }
    starIcon.src = `/assets/icons/star-tier-${Math.min(4, statTier)}.png`;
  } else if (starIcon) {
    starIcon.remove();
  }
}

function createSetupMonsterPortraitSlot({ monsterId, level, monster, size = SETUP_MANAGER_EQUIPMENT_PORTRAIT_SIZE, hideLevel = false }) {
  const parsedLevel = Number(level) || 1;
  const portraitMonster = toSetupPortraitMonster(monster);

  if (window.BestiaryUIComponents?.createMonsterPortrait) {
    try {
      const root = window.BestiaryUIComponents.createMonsterPortrait({
        monsterId,
        level: parsedLevel,
        tier: calculateTierFromStats(portraitMonster)
      });
      const slot = root.querySelector('.container-slot');
      if (slot) {
        slot.remove();
        slot.className = 'container-slot surface-darker relative flex items-center justify-center overflow-hidden shrink-0';
        slot.style.width = `${size}px`;
        slot.style.height = `${size}px`;

        const img = slot.querySelector('img[alt="creature"]');
        if (img) {
          img.width = size;
          img.height = size;
        }

        return finalizeSetupMonsterPortraitSlot(slot, monster, parsedLevel, { hideLevel });
      }
    } catch (error) {
      // Fall through to silent fallback.
    }
  }

  const slot = document.createElement('div');
  slot.className = 'container-slot surface-darker relative flex items-center justify-center overflow-hidden shrink-0';
  slot.style.width = `${size}px`;
  slot.style.height = `${size}px`;
  slot.style.position = 'relative';

  const monsterImg = document.createElement('img');
  monsterImg.className = 'pixelated';
  monsterImg.alt = 'creature';
  monsterImg.width = size;
  monsterImg.height = size;
  monsterImg.src = `/assets/portraits/${monsterId}.png`;
  slot.appendChild(monsterImg);

  return finalizeSetupMonsterPortraitSlot(slot, monster, parsedLevel, { hideLevel });
}

function createSetupEmptyEquipmentPlaceholder(sizePx = SETUP_MANAGER_EQUIPMENT_PORTRAIT_SIZE) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'focus-style-visible container-slot surface-darker size-[34px] active:opacity-70 disabled:opacity-100';
  button.style.width = `${sizePx}px`;
  button.style.height = `${sizePx}px`;
  button.style.maxWidth = `${sizePx}px`;
  button.style.maxHeight = `${sizePx}px`;
  button.style.flexShrink = '0';
  button.disabled = true;
  button.tabIndex = -1;

  const grid = document.createElement('div');
  grid.className = 'grid size-full place-items-center';
  grid.setAttribute('data-state', 'closed');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', 'lucide lucide-circle-plus size-4 text-whiteDarker');
  svg.setAttribute('aria-hidden', 'true');

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '10');
  svg.appendChild(circle);

  const horizontalPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  horizontalPath.setAttribute('d', 'M8 12h8');
  svg.appendChild(horizontalPath);

  const verticalPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  verticalPath.setAttribute('d', 'M12 8v8');
  svg.appendChild(verticalPath);

  grid.appendChild(svg);
  button.appendChild(grid);
  return button;
}

const SETUP_MANAGER_TOAST_DURATION = 5000;
const SETUP_MANAGER_TOAST_CONTAINER_ID = 'setup-manager-toast-container';

function formatSetupManagerToastMessage(message, type = 'info') {
  const trimmed = String(message ?? '').trim();
  if (!trimmed) return trimmed;
  if (/[.!?…]$/.test(trimmed)) return trimmed;

  if (type === 'success') return `${trimmed}!`;
  if (type === 'error' || type === 'warning' || type === 'info') return `${trimmed}.`;
  return `${trimmed}.`;
}

function getSetupManagerToastContainer() {
  if (typeof document === 'undefined') return null;

  let container = document.getElementById(SETUP_MANAGER_TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = SETUP_MANAGER_TOAST_CONTAINER_ID;
    container.style.cssText = 'position: fixed; z-index: 9999; inset: 16px 16px 64px; pointer-events: none;';
    document.body.appendChild(container);
  }
  return container;
}

function updateSetupManagerToastPositions(container) {
  if (!container) return;

  container.querySelectorAll('.setup-manager-toast-item').forEach((toast, index) => {
    toast.style.transform = `translateY(-${index * 46}px)`;
  });
}

function showSetupManagerToast(message, options = {}) {
  const safeMsg = message != null && message !== '' ? String(message).replace(/</g, '&lt;') : '';
  const duration = typeof options.duration === 'number' && options.duration > 0
    ? options.duration
    : SETUP_MANAGER_TOAST_DURATION;

  try {
    const container = getSetupManagerToastContainer();
    if (!container) return;

    const existingToasts = container.querySelectorAll('.setup-manager-toast-item');
    const stackOffset = existingToasts.length * 46;

    const flexContainer = document.createElement('div');
    flexContainer.className = 'setup-manager-toast-item';
    flexContainer.style.cssText = `display: flex; position: absolute; transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1); transform: translateY(-${stackOffset}px); bottom: 0px; right: 0px; justify-content: flex-end; pointer-events: none; width: max-content; max-width: 100%;`;

    const toast = document.createElement('button');
    toast.type = 'button';
    toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
    toast.style.pointerEvents = 'auto';

    const widgetTop = document.createElement('div');
    widgetTop.className = 'widget-top h-2.5';

    const widgetBottom = document.createElement('div');
    widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'text-left text-whiteRegular';
    messageDiv.style.flex = '1 1 auto';
    messageDiv.style.color = '#ffffff';
    if (safeMsg.indexOf('\n') !== -1) {
      messageDiv.style.whiteSpace = 'pre-line';
    }
    messageDiv.textContent = safeMsg;

    widgetBottom.appendChild(messageDiv);
    toast.appendChild(widgetTop);
    toast.appendChild(widgetBottom);
    flexContainer.appendChild(toast);
    container.appendChild(flexContainer);

    const removeToast = () => {
      if (flexContainer.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        updateSetupManagerToastPositions(container);
      }
    };

    toast.addEventListener('click', removeToast);
    setTimeout(removeToast, duration);
  } catch (error) {
    console.warn('[Setup Manager] showSetupManagerToast:', error);
  }
}

function showNotification(message, type = 'info', duration = SETUP_MANAGER_TOAST_DURATION) {
  showSetupManagerToast(formatSetupManagerToastMessage(message, type), { duration });
}

// Create a styled button for actions
function createActionButton(text, onClick, primary = false) {
  const button = document.createElement('button');
  
  button.className = primary
    ? SETUP_MANAGER_BUTTON_CLASS.primary
    : SETUP_MANAGER_BUTTON_CLASS.secondary;
  
  button.style.cssText = 'cursor: pointer;';
  
  const textSpan = document.createElement('span');
  textSpan.textContent = text;
  button.appendChild(textSpan);
  
  button.addEventListener('click', onClick);
  
  return button;
}

const SETUP_MANAGER_DELETE_CONFIRM_MS = 5000;
const SETUP_MANAGER_SETUP_CARD_CLASS = 'setup-manager-setup-card';

function setSetupCardDeleteWarning(deleteButton, active) {
  const card = deleteButton?.closest(`.${SETUP_MANAGER_SETUP_CARD_CLASS}`);
  if (!card) return;

  if (active) {
    card.classList.remove('frame-1', 'surface-regular');
    card.classList.add('frame-1-red', 'surface-red');
    card.dataset.deleteConfirming = 'true';
    return;
  }

  card.classList.remove('frame-1-red', 'surface-red');
  card.classList.add('frame-1', 'surface-regular');
  card.dataset.deleteConfirming = 'false';
}

function resetDeleteButton(deleteButton) {
  if (!deleteButton) return;

  const textSpan = deleteButton.querySelector('span');
  if (textSpan) {
    textSpan.textContent = t('mods.setupManager.deleteTeam');
  }
  deleteButton.className = SETUP_MANAGER_BUTTON_CLASS.danger;
  deleteButton.style.cssText = 'width: 100%; cursor: pointer;';
  deleteButton.dataset.confirming = 'false';
  setSetupCardDeleteWarning(deleteButton, false);
}

function cancelPendingDeleteConfirmation() {
  if (!pendingDeleteConfirmation) return;

  const { deleteButton, timeoutId } = pendingDeleteConfirmation;
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  resetDeleteButton(deleteButton);
  pendingDeleteConfirmation = null;
}

function deleteSetupInline(mapId, setupName) {
  const deleteResult = deleteTeamSetup(mapId, setupName);
  if (deleteResult) {
    cancelPendingDeleteConfirmation();
    showNotification(t('mods.setupManager.teamDeleted'), 'success');
    showSetupManagerModal();
    return true;
  }

  showNotification(t('common.error'), 'error');
  return false;
}

function handleDeleteButtonClick(mapId, setupName, deleteButton) {
  if (pendingDeleteConfirmation?.deleteButton === deleteButton) {
    deleteSetupInline(mapId, setupName);
    return;
  }

  cancelPendingDeleteConfirmation();

  const textSpan = deleteButton.querySelector('span');
  if (textSpan) {
    textSpan.textContent = t('mods.setupManager.confirmDeleteButton');
  }
  deleteButton.dataset.confirming = 'true';
  setSetupCardDeleteWarning(deleteButton, true);

  const timeoutId = setTimeout(() => {
    if (pendingDeleteConfirmation?.deleteButton === deleteButton) {
      cancelPendingDeleteConfirmation();
    }
  }, SETUP_MANAGER_DELETE_CONFIRM_MS);

  pendingDeleteConfirmation = { deleteButton, mapId, setupName, timeoutId };
}

function createDeleteButton(mapId, setupName) {
  const button = document.createElement('button');
  button.className = SETUP_MANAGER_BUTTON_CLASS.danger;
  button.style.cssText = 'width: 100%; cursor: pointer;';
  button.dataset.confirming = 'false';

  const textSpan = document.createElement('span');
  textSpan.textContent = t('mods.setupManager.deleteTeam');
  button.appendChild(textSpan);

  button.addEventListener('click', () => {
    handleDeleteButtonClick(mapId, setupName, button);
  });

  return button;
}

function hasSetupNotes(setupData) {
  return Boolean(String(setupData?.notes ?? '').trim());
}

function createSetupNameInput(value) {
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'frame-pressed-1 surface-dark w-full p-1 text-whiteRegular pixel-font-16';
  nameInput.maxLength = config.setupNameMaxLength;
  nameInput.value = value;
  nameInput.placeholder = t('mods.setupManager.setupName');
  nameInput.style.maxWidth = '100%';
  nameInput.style.boxSizing = 'border-box';
  nameInput.style.height = `${SETUP_NAME_FIELD_HEIGHT_PX}px`;
  nameInput.style.maxHeight = `${SETUP_NAME_FIELD_HEIGHT_PX}px`;
  return nameInput;
}

function injectSetupManagerNameInputStyles() {
  if (document.getElementById('setup-manager-name-input-styles')) return;

  const style = document.createElement('style');
  style.id = 'setup-manager-name-input-styles';
  style.textContent = `
    input.setup-manager-name-locked:disabled {
      opacity: 1 !important;
      color: inherit !important;
      cursor: default !important;
      -webkit-text-fill-color: inherit !important;
    }
  `;
  document.head.appendChild(style);
}

function applySetupNameInputEditable(nameInput, editable, { greyedWhenLocked = false } = {}) {
  injectSetupManagerNameInputStyles();
  nameInput.classList.remove('setup-manager-name-locked');
  nameInput.readOnly = false;

  if (editable) {
    nameInput.disabled = false;
    nameInput.style.opacity = '';
    nameInput.style.cursor = '';
    nameInput.style.color = '';
    return;
  }

  nameInput.disabled = true;

  if (greyedWhenLocked) {
    nameInput.style.opacity = '0.5';
    nameInput.style.cursor = 'not-allowed';
    nameInput.style.color = '#888888';
    return;
  }

  nameInput.classList.add('setup-manager-name-locked');
  nameInput.style.opacity = '';
  nameInput.style.cursor = 'default';
  nameInput.style.color = '';
}

function createEditableSetupNameRow(mapId, setupName) {
  const nameRow = document.createElement('div');
  nameRow.className = 'flex w-full min-w-0 items-center gap-1';
  nameRow.style.maxHeight = `${SETUP_NAME_FIELD_HEIGHT_PX}px`;

  const nameInput = createSetupNameInput(setupName);
  nameInput.style.flex = '1 1 0';
  nameInput.style.minWidth = '0';
  nameInput.style.width = 'auto';
  applySetupNameInputEditable(nameInput, false);
  nameRow.appendChild(nameInput);

  let isEditingName = false;
  let outsideClickHandler = null;

  const removeOutsideClickHandler = () => {
    if (!outsideClickHandler) return;
    document.removeEventListener('mousedown', outsideClickHandler, true);
    outsideClickHandler = null;
  };

  const cancelNameEdit = () => {
    if (!isEditingName) return;

    nameInput.value = setupName;
    isEditingName = false;
    applySetupNameInputEditable(nameInput, false);
    editNameButton.querySelector('span').textContent = t('mods.setupManager.editName');
    removeOutsideClickHandler();
  };

  const startOutsideClickHandler = () => {
    removeOutsideClickHandler();
    outsideClickHandler = (event) => {
      if (!isEditingName || nameRow.contains(event.target)) return;
      cancelNameEdit();
    };

    setTimeout(() => {
      if (isEditingName) {
        document.addEventListener('mousedown', outsideClickHandler, true);
      }
    }, 0);
  };

  const editNameButton = createActionButton(
    t('mods.setupManager.editName'),
    () => {
      if (!isEditingName) {
        isEditingName = true;
        applySetupNameInputEditable(nameInput, true);
        editNameButton.querySelector('span').textContent = t('common.save');
        nameInput.focus();
        nameInput.select();
        startOutsideClickHandler();
        return;
      }

      removeOutsideClickHandler();
      saveSetupRenameInline(mapId, setupName, nameInput.value);
    },
    false,
    null,
    true
  );
  editNameButton.style.cssText = `flex-shrink: 0; cursor: pointer; margin-right: 0; height: ${SETUP_NAME_FIELD_HEIGHT_PX}px; max-height: ${SETUP_NAME_FIELD_HEIGHT_PX}px;`;
  nameRow.appendChild(editNameButton);

  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && isEditingName) {
      removeOutsideClickHandler();
      saveSetupRenameInline(mapId, setupName, nameInput.value);
    } else if (event.key === 'Escape' && isEditingName) {
      cancelNameEdit();
    }
  });

  return nameRow;
}

function createSetupNotesPreview(notes) {
  const trimmed = String(notes ?? '').trim();
  if (!trimmed) return null;

  const notesBlock = document.createElement('div');
  notesBlock.className = 'frame-pressed-1 surface-dark w-full min-w-0 shrink-0 p-1';

  const notesText = document.createElement('p');
  notesText.className = 'pixel-font-14 text-whiteRegular italic m-0';
  notesText.style.cssText = [
    'line-height: 1.35',
    'word-break: break-word',
    'white-space: pre-line',
    'overflow: hidden',
    'display: -webkit-box',
    '-webkit-line-clamp: 2',
    '-webkit-box-orient: vertical'
  ].join('; ');
  notesText.textContent = trimmed;
  notesText.title = trimmed;

  notesBlock.appendChild(notesText);

  return notesBlock;
}

// Create a notes button
function createNotesButton(onClick, hasNotes = false) {
  const button = document.createElement('button');
  button.className = SETUP_MANAGER_BUTTON_CLASS.secondary;
  button.style.cssText = 'width: 100%; cursor: pointer;';

  const textSpan = document.createElement('span');
  textSpan.textContent = t('mods.setupManager.notes');
  button.appendChild(textSpan);

  if (hasNotes) {
    const indicator = document.createElement('span');
    indicator.className = 'setup-manager-has-notes-indicator';
    indicator.textContent = ' ●';
    indicator.style.color = '#ff8';
    indicator.setAttribute('aria-hidden', 'true');
    textSpan.appendChild(indicator);
    button.title = t('mods.setupManager.hasNotes');
  }

  button.addEventListener('click', onClick);

  return button;
}

function createSetupTeamPreviewContainer() {
  const teamPreview = document.createElement('div');
  teamPreview.className = 'frame-pressed-1 p-1 min-w-0 flex flex-1 items-center min-h-0';

  const teamContent = document.createElement('div');
  teamContent.className = 'flex flex-wrap items-center';
  teamContent.style.gap = '12px';
  teamContent.style.width = '100%';

  teamPreview.appendChild(teamContent);
  return { teamPreview, teamContent };
}

function styleSetupCardLeftSection(leftSection) {
  leftSection.className = 'flex flex-col w-full gap-1 min-h-0 self-stretch';
  leftSection.style.width = '75%';
  leftSection.style.flex = '0 0 75%';
  leftSection.style.minWidth = '0';
}

function appendBoardPieceToTeamContent(teamContent, piece) {
  if (!piece) return false;

  if (piece.type === 'player') {
    const monsterInfo = getMonsterInfo(piece.databaseId);
    if (!monsterInfo) return false;

    const pair = createCreatureEquipmentPair(monsterInfo, piece.equipId);
    if (pair && pair.children.length > 0) {
      teamContent.appendChild(pair);
      return true;
    }
    return false;
  }

  if (piece.type === 'custom') {
    const monsterInfo = getMonsterInfoFromCustom({
      gameId: piece.gameId,
      level: piece.level,
      genes: piece.genes
    });
    if (!monsterInfo) return false;

    const pair = createCreatureEquipmentPair(
      monsterInfo,
      null,
      true,
      monsterInfo.existsInCollection,
      piece.equip || null
    );
    if (pair && pair.children.length > 0) {
      teamContent.appendChild(pair);
      return true;
    }
  }

  return false;
}

function saveCurrentBoardSetup(mapId, name) {
  const trimmedName = name?.trim();
  if (!trimmedName) {
    showNotification(t('common.error'), 'error');
    return false;
  }

  if (trimmedName.length > config.setupNameMaxLength) {
    showNotification(tReplace('mods.setupManager.nameTooLong', { max: config.setupNameMaxLength }), 'error');
    return false;
  }

  const currentSetup = getCurrentTeamSetup();
  if (!currentSetup || currentSetup.length === 0) {
    showNotification(t('mods.setupManager.invalidSetup'), 'error');
    return false;
  }

  const saveResult = saveTeamSetup(mapId, trimmedName, currentSetup);
  if (saveResult) {
    showNotification(t('mods.setupManager.teamSaved'), 'success');
    showSetupManagerModal();
  }

  return saveResult;
}

function createCurrentBoardCard(mapId) {
  const creatureCount = getCurrentCreatureCount();
  const maxCount = getMaxTeamSize(mapId);
  const hasSetup = creatureCount > 0;

  const card = document.createElement('div');
  card.className = 'frame-1 surface-regular box-border flex w-full items-stretch gap-2 overflow-hidden p-1 shrink-0';

  const leftSection = document.createElement('div');
  styleSetupCardLeftSection(leftSection);

  const nameInput = createSetupNameInput(t('mods.setupManager.newSetup'));
  applySetupNameInputEditable(nameInput, hasSetup, { greyedWhenLocked: true });
  leftSection.appendChild(nameInput);

  const { teamPreview, teamContent } = createSetupTeamPreviewContainer();

  try {
    const boardSnapshot = globalThis.state.board.getSnapshot();
    const boardPieces = boardSnapshot?.context?.boardConfig?.filter(
      piece => piece && (piece.type === 'player' || piece.type === 'custom') && !piece.villain
    ) || [];

    boardPieces.forEach(piece => appendBoardPieceToTeamContent(teamContent, piece));
  } catch (error) {
    console.error('Error building current board preview:', error);
  }

  if (teamContent.children.length === 0) {
    const emptyText = document.createElement('p');
    emptyText.className = 'pixel-font-14 text-whiteRegular italic';
    emptyText.textContent = t('mods.setupManager.noMonstersOnBoard');
    teamContent.appendChild(emptyText);
  }

  teamPreview.appendChild(teamContent);
  leftSection.appendChild(teamPreview);

  const rightSection = document.createElement('div');
  rightSection.style.width = '25%';
  rightSection.style.flex = '0 0 25%';
  rightSection.style.display = 'flex';
  rightSection.style.flexDirection = 'column';
  rightSection.style.gap = '8px';
  rightSection.style.alignItems = 'flex-end';
  rightSection.style.justifyContent = 'flex-start';
  rightSection.style.boxSizing = 'border-box';
  rightSection.style.padding = '8px';

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'flex gap-1';
  actionsDiv.style.flexDirection = 'column';
  actionsDiv.style.width = '100%';
  actionsDiv.style.alignItems = 'stretch';

  const isMaxCreatures = creatureCount === maxCount;
  const indicatorColor = isMaxCreatures ? '#4caf50' : '#ff4444';

  const countIndicator = document.createElement('div');
  countIndicator.className = 'pixel-font-12 text-whiteRegular shrink-0';
  countIndicator.textContent = formatSetupCreatureCount(creatureCount, maxCount);
  countIndicator.style.cssText = `
    text-align: center;
    margin-bottom: 4px;
    opacity: 0.9;
    color: ${indicatorColor};
  `;
  actionsDiv.appendChild(countIndicator);

  const saveButton = createActionButton(
    t('common.save'),
    () => saveCurrentBoardSetup(mapId, nameInput.value),
    true,
    null,
    true
  );
  saveButton.style.width = '100%';
  saveButton.style.marginRight = '0';
  if (!hasSetup) {
    saveButton.disabled = true;
    saveButton.style.opacity = '0.5';
    saveButton.style.cursor = 'not-allowed';
  }
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !saveButton.disabled) {
      saveCurrentBoardSetup(mapId, nameInput.value);
    }
  });
  actionsDiv.appendChild(saveButton);

  rightSection.appendChild(actionsDiv);
  card.appendChild(leftSection);
  card.appendChild(rightSection);

  return card;
}

// Create a setup card for a team
function createSetupCard(mapId, setupName, setupData) {
  const card = document.createElement('div');
  card.className = `frame-1 surface-regular box-border flex w-full items-stretch gap-2 overflow-hidden p-1 shrink-0 ${SETUP_MANAGER_SETUP_CARD_CLASS}`;
  card.dataset.deleteConfirming = 'false';
  
  // Left section (75%): Setup name and creatures
  const leftSection = document.createElement('div');
  styleSetupCardLeftSection(leftSection);
  
  const isSavedSetup = setupName !== 'Auto-Setup';
  if (isSavedSetup) {
    leftSection.appendChild(createEditableSetupNameRow(mapId, setupName));
    const notesPreview = createSetupNotesPreview(setupData?.notes);
    if (notesPreview) {
      leftSection.appendChild(notesPreview);
    }
  } else {
    const nameInput = createSetupNameInput(setupName);
    applySetupNameInputEditable(nameInput, false);
    leftSection.appendChild(nameInput);
  }
  
  const { teamPreview, teamContent } = createSetupTeamPreviewContainer();
  
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
      emptyText.className = 'pixel-font-14 text-whiteRegular italic';
      emptyText.textContent = t('mods.setupManager.noMonstersInOriginalSetup');
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
      emptyText.className = 'pixel-font-14 text-whiteRegular italic';
      emptyText.textContent = t('mods.setupManager.noMonstersInSetup');
      teamContent.appendChild(emptyText);
    }
  } else {
    // Handle case where setup data is missing or invalid
    const emptyText = document.createElement('p');
    emptyText.className = 'pixel-font-14 text-whiteRegular italic';
    emptyText.textContent = t('mods.setupManager.invalidSetup');
    teamContent.appendChild(emptyText);
  }
  
  teamPreview.appendChild(teamContent);
  leftSection.appendChild(teamPreview);
  
  // Right section (25%): Actions (Load Team and Delete buttons)
  const rightSection = document.createElement('div');
  rightSection.style.width = '25%';
  rightSection.style.flex = '0 0 25%';
  rightSection.style.display = 'flex';
  rightSection.style.flexDirection = 'column';
  rightSection.style.gap = '8px';
  rightSection.style.alignItems = 'flex-end';
  rightSection.style.justifyContent = 'flex-start';
  rightSection.style.boxSizing = 'border-box';
  rightSection.style.padding = '8px';
  
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
  countIndicator.className = 'pixel-font-12 text-whiteRegular shrink-0';
  countIndicator.textContent = formatSetupCreatureCount(setupCreatureCount, maxCount);
  
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
    }, hasSetupNotes(setupData));
    notesButton.style.width = '100%';
    actionsDiv.appendChild(notesButton);
  }
  
  // Delete button (only for non-original setups)
  if (setupName !== 'Auto-Setup') {
    const deleteButton = createDeleteButton(mapId, setupName);
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
        buttons: [{ text: t('controls.ok'), primary: true }]
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
    cancelPendingDeleteConfirmation();
    
    const mapName = getCurrentMapName();
    
    const modalDimensions = getSetupManagerModalDimensions();

    // Create modal content
    const content = document.createElement('div');
    content.className = 'setup-manager-modal-root flex min-h-0 flex-1 flex-col';
    content.style.height = '100%';

    const newSetupHeader = document.createElement('div');
    newSetupHeader.className = 'pixel-font-12 text-whiteRegular mb-1 shrink-0';
    newSetupHeader.textContent = t('mods.setupManager.newSetup');
    applySetupManagerViewportWidth(newSetupHeader);
    content.appendChild(newSetupHeader);

    const newSetupScroll = createSetupManagerScrollContainer({ grow: false });
    newSetupScroll.addContent(createCurrentBoardCard(mapId));
    newSetupScroll.element.style.marginBottom = '8px';
    content.appendChild(newSetupScroll.element);

    const listHeader = document.createElement('div');
    listHeader.className = 'pixel-font-12 text-whiteRegular mb-1 shrink-0';
    listHeader.textContent = t('mods.setupManager.savedSetups');
    applySetupManagerViewportWidth(listHeader);
    content.appendChild(listHeader);
    
    const scrollContainer = createSetupManagerScrollContainer();
    
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
    
    // Create the modal
    activeModal = api.ui.components.createModal({
      title: `${t('mods.setupManager.setupManager')} - ${mapName}`,
      width: modalDimensions.width,
      height: modalDimensions.height,
      content: content,
      buttons: [
        {
          text: t('common.close'),
          closeOnClick: true
        }
      ]
    });

    setupSetupManagerModalResponsiveLayout(activeModal, content);
  } catch (error) {
    console.error('Error showing setup manager modal:', error);
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
        buttons: [{ text: t('controls.ok'), primary: true }]
      });
      return;
    }
    
    // Force close all open modals first
    forceCloseAllModals();
    
    const modalDimensions = getSetupManagerModalDimensions();

    // Get current notes from setup data
    const currentNotes = (setupData && setupData.notes) ? setupData.notes : '';
    
    const content = document.createElement('div');
    content.className = 'setup-manager-modal-root flex min-h-0 flex-1 flex-col';
    content.style.height = '100%';

    const textareaContainer = document.createElement('div');
    textareaContainer.className = 'frame-pressed-1 surface-dark relative box-border min-h-0 flex-1 overflow-hidden';
    textareaContainer.style.padding = '5px';
    
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
    textarea.placeholder = t('mods.setupManager.notesPlaceholder');
    textareaContainer.appendChild(textarea);
    
    content.appendChild(textareaContainer);
    
    // Create modal (matching setup manager modal structure)
    activeModal = api.ui.components.createModal({
      title: tReplace('mods.setupManager.notesModalTitle', { name: setupName }),
      width: modalDimensions.width,
      height: modalDimensions.height,
      content: content,
      buttons: [
        {
          text: t('common.save'),
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
            
            showNotification(t('mods.setupManager.notesSaved'), 'success');
            
            // Reopen the setup manager to refresh the display
            setTimeout(() => {
              showSetupManagerModal();
            }, 300);
          }
        }
      ]
    });
    
    setupSetupManagerModalResponsiveLayout(activeModal, content);
    addSetupManagerFooterBackButton(activeModal, () => showSetupManagerModal());
    textarea.focus();
    
  } catch (error) {
    console.error('Error showing notes modal:', error);
    showNotification(t('common.error'), 'error');
  }
}

// ========== Map Shortcut Bar ==========

const MAP_SHORTCUTS_CLASS = 'setup-manager-map-shortcuts';
const MAP_SHORTCUTS_BUTTONS_CLASS = 'setup-manager-map-shortcuts-buttons';
const MAP_SHORTCUT_BUTTON_CLASS = 'setup-manager-map-shortcut-btn';
const MAP_SHORTCUTS_TOGGLE_CLASS = 'setup-manager-map-shortcuts-toggle';
const MAP_SHORTCUT_PREVIEW_CLASS = 'setup-manager-map-shortcut-preview';
const MAP_SHORTCUT_NAME_MAX_LENGTH = 16;
const MAP_SHORTCUT_PREVIEW_PADDING = 8;
const MAP_SHORTCUT_PREVIEW_COMBOS_PER_ROW = 3;
const MAP_SHORTCUT_PREVIEW_COMBO_INNER_GAP_PX = 2;
const MAP_SHORTCUT_PREVIEW_COMBO_OUTER_GAP_PX = 6;
const MAP_SHORTCUT_PREVIEW_WIDTH_EXTRA_PX = 10;
const MAP_SHORTCUT_PREVIEW_HOVER_DELAY_MS = 200;

function getMapShortcutPreviewComboWidth() {
  return (SETUP_MANAGER_EQUIPMENT_PORTRAIT_SIZE * 2) + MAP_SHORTCUT_PREVIEW_COMBO_INNER_GAP_PX;
}

function getMapShortcutPreviewRowMaxWidth() {
  const comboWidth = getMapShortcutPreviewComboWidth();
  const rowGaps = MAP_SHORTCUT_PREVIEW_COMBO_OUTER_GAP_PX * (MAP_SHORTCUT_PREVIEW_COMBOS_PER_ROW - 1);
  return (comboWidth * MAP_SHORTCUT_PREVIEW_COMBOS_PER_ROW) + rowGaps + MAP_SHORTCUT_PREVIEW_WIDTH_EXTRA_PX;
}
const MAP_SHORTCUTS_EDGE_GAP_PX = 4;
// Above board map labels (z-1..z-10), below native game modals (z-modals = 200).
const MAP_SHORTCUTS_Z_INDEX = 101;
const MAP_SHORTCUT_PREVIEW_MEDIA = {
  FRAME_BORDER: 'https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png',
  BACKGROUND_DARK: 'https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png'
};

let activeMapShortcutPreview = null;
let activeMapShortcutPreviewTimer = null;
let activeMapShortcutPreviewAnchor = null;
let mapShortcutsPositionHandler = null;

function isAutosetupEnabled() {
  try {
    const playerFlags = globalThis.state.player.getSnapshot().context.flags;
    const flags = new globalThis.state.utils.Flags(playerFlags);
    return flags.isSet('autosetup');
  } catch (error) {
    console.warn('[Setup Manager] Error checking autosetup flag:', error);
    return false;
  }
}

function getMapMainContainer() {
  return document.querySelector('.relative.z-0.select-none') ||
    document.querySelector('[class*="relative"]') ||
    document.body;
}

function syncMapShortcutsPosition() {
  if (!mapShortcutsContainer) {
    return;
  }

  const mainContainer = getMapMainContainer();
  if (!mainContainer || mainContainer === document.body) {
    return;
  }

  const rect = mainContainer.getBoundingClientRect();
  const gap = MAP_SHORTCUTS_EDGE_GAP_PX;

  Object.assign(mapShortcutsContainer.style, {
    position: 'fixed',
    left: `${rect.left + (rect.width / 2)}px`,
    right: 'auto',
    top: 'auto',
    bottom: `${Math.max(gap, window.innerHeight - rect.bottom + gap)}px`,
    transform: 'translateX(-50%)',
    transformOrigin: 'bottom center',
    zIndex: String(MAP_SHORTCUTS_Z_INDEX),
    pointerEvents: 'auto'
  });
}

function ensureMapShortcutsPositionListener() {
  if (mapShortcutsPositionHandler) {
    return;
  }

  mapShortcutsPositionHandler = () => {
    syncMapShortcutsPosition();
  };

  window.addEventListener('resize', mapShortcutsPositionHandler);
  window.addEventListener('scroll', mapShortcutsPositionHandler, true);
}

function removeMapShortcutsPositionListener() {
  if (!mapShortcutsPositionHandler) {
    return;
  }

  window.removeEventListener('resize', mapShortcutsPositionHandler);
  window.removeEventListener('scroll', mapShortcutsPositionHandler, true);
  mapShortcutsPositionHandler = null;
}

function truncateShortcutLabel(label, maxLength = MAP_SHORTCUT_NAME_MAX_LENGTH) {
  if (!label || label.length <= maxLength) {
    return label;
  }

  return `${label.slice(0, maxLength - 1)}…`;
}

function getMapShortcutEntries(mapId) {
  const entries = [{
    name: 'Auto-Setup',
    label: t('mods.setupManager.originalSetup')
  }];

  getMapSetups(mapId).forEach((setup) => {
    if (setup?.name) {
      entries.push({
        name: setup.name,
        label: setup.name
      });
    }
  });

  return entries;
}

function getMapShortcutEntriesSignature(entries) {
  return entries.map((entry) => entry.name).join('|');
}

function getMapShortcutsContainerSignature(container) {
  const buttons = container?.querySelectorAll(`.${MAP_SHORTCUT_BUTTON_CLASS}`) || [];
  return Array.from(buttons).map((button) => button.dataset.setupName || '').join('|');
}

function getMapShortcutButtonStyles() {
  return {
    cursor: 'pointer',
    padding: '3px 8px',
    background: 'url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png")',
    backgroundSize: 'auto',
    backgroundRepeat: 'repeat',
    border: '4px solid transparent',
    borderImage: 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 4 stretch',
    borderRadius: '4px',
    color: 'white',
    fontFamily: "'Courier New', monospace",
    fontSize: '11px',
    lineHeight: '1.2',
    whiteSpace: 'nowrap'
  };
}

function appendSavedSetupPieceToPreviewContent(content, piece) {
  if (!piece) {
    return false;
  }

  let monsterInfo = null;
  let equipId = null;
  let isCustom = false;
  let existsInCollection = true;
  let customEquip = null;

  if (piece.type === 'custom') {
    monsterInfo = getMonsterInfoFromCustom(piece);
    if (monsterInfo) {
      isCustom = true;
      existsInCollection = monsterInfo.existsInCollection;
      customEquip = piece.equip || null;
    }
  } else if (piece.monsterId) {
    monsterInfo = getMonsterInfo(piece.monsterId);
    equipId = piece.equipId;
  }

  if (!monsterInfo) {
    return false;
  }

  const pair = createCreatureEquipmentPair(
    monsterInfo,
    equipId,
    isCustom,
    existsInCollection,
    customEquip
  );

  if (!pair || pair.children.length === 0) {
    return false;
  }

  return appendMapShortcutPreviewCombo(content, pair);
}

function styleMapShortcutPreviewCombo(pair) {
  const comboWidth = getMapShortcutPreviewComboWidth();
  Object.assign(pair.style, {
    display: 'flex',
    flexDirection: 'row',
    gap: `${MAP_SHORTCUT_PREVIEW_COMBO_INNER_GAP_PX}px`,
    alignItems: 'center',
    flex: `0 0 ${comboWidth}px`,
    width: `${comboWidth}px`,
    maxWidth: `${comboWidth}px`
  });
  return pair;
}

function appendMapShortcutPreviewCombo(row, pair) {
  if (!pair || pair.children.length === 0) {
    return false;
  }

  row.appendChild(styleMapShortcutPreviewCombo(pair));
  return true;
}

function buildMapShortcutPreviewContent(mapId, setupName) {
  if (!mapId || !setupName) {
    return null;
  }

  const rowMaxWidth = getMapShortcutPreviewRowMaxWidth();

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: fit-content;
    max-width: ${rowMaxWidth}px;
    box-sizing: border-box;
  `;

  const setupRow = document.createElement('div');
  setupRow.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: ${MAP_SHORTCUT_PREVIEW_COMBO_OUTER_GAP_PX}px;
    align-items: center;
    justify-content: flex-start;
    width: fit-content;
    max-width: ${rowMaxWidth}px;
  `;

  let added = false;
  let setupNotes = '';

  if (setupName === 'Auto-Setup') {
    const boardSetup = globalThis.state.player.getSnapshot().context.boardConfigs[mapId];
    if (boardSetup && Array.isArray(boardSetup)) {
      boardSetup.forEach((piece) => {
        if (!piece?.monsterId) {
          return;
        }

        const monsterInfo = getMonsterInfo(piece.monsterId);
        if (!monsterInfo) {
          return;
        }

        const pair = createCreatureEquipmentPair(monsterInfo, piece.equipId);
        if (appendMapShortcutPreviewCombo(setupRow, pair)) {
          added = true;
        }
      });
    }
  } else {
    const savedSetup = config.savedSetups[mapId]?.find((setup) => setup.name === setupName);
    setupNotes = savedSetup?.notes ?? '';

    if (savedSetup?.setup && Array.isArray(savedSetup.setup)) {
      savedSetup.setup.forEach((piece) => {
        if (appendSavedSetupPieceToPreviewContent(setupRow, piece)) {
          added = true;
        }
      });
    }
  }

  if (!added) {
    return null;
  }

  wrapper.appendChild(setupRow);

  const notesPreview = createSetupNotesPreview(setupNotes);
  if (notesPreview) {
    notesPreview.style.width = '100%';
    notesPreview.style.maxWidth = `${rowMaxWidth}px`;
    wrapper.appendChild(notesPreview);
  }

  return wrapper;
}

function positionMapShortcutPreview(preview, anchorButton) {
  const rect = anchorButton.getBoundingClientRect();
  const margin = 8;

  preview.style.visibility = 'hidden';
  preview.style.display = 'block';
  const previewRect = preview.getBoundingClientRect();

  let left = rect.left + (rect.width / 2) - (previewRect.width / 2);
  let top = rect.top - previewRect.height - 6;

  if (top < margin) {
    top = rect.bottom + 6;
  }

  if (left + previewRect.width > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - previewRect.width - margin);
  }
  if (left < margin) {
    left = margin;
  }

  preview.style.left = `${left}px`;
  preview.style.top = `${top}px`;
  preview.style.visibility = 'visible';
}

function hideMapShortcutPreview() {
  if (activeMapShortcutPreviewTimer) {
    clearTimeout(activeMapShortcutPreviewTimer);
    activeMapShortcutPreviewTimer = null;
  }

  if (activeMapShortcutPreview) {
    activeMapShortcutPreview.remove();
    activeMapShortcutPreview = null;
  }

  activeMapShortcutPreviewAnchor = null;
}

function showMapShortcutPreview(anchorButton) {
  if (!isSetupShortcutsAndHoverEnabled()) {
    return;
  }

  const mapId = anchorButton?.dataset?.mapId;
  const setupName = anchorButton?.dataset?.setupName;
  if (!mapId || !setupName) {
    return;
  }

  const previewContent = buildMapShortcutPreviewContent(mapId, setupName);
  if (!previewContent) {
    return;
  }

  hideMapShortcutPreview();

  const previewMaxWidth = getMapShortcutPreviewRowMaxWidth() + (MAP_SHORTCUT_PREVIEW_PADDING * 2);

  const preview = document.createElement('div');
  preview.className = MAP_SHORTCUT_PREVIEW_CLASS;
  preview.style.cssText = `
    position: fixed;
    z-index: ${MAP_SHORTCUTS_Z_INDEX + 1};
    padding: ${MAP_SHORTCUT_PREVIEW_PADDING}px;
    width: fit-content;
    max-width: ${previewMaxWidth}px;
    box-sizing: border-box;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    border: 4px solid transparent;
    border-image: url("${MAP_SHORTCUT_PREVIEW_MEDIA.FRAME_BORDER}") 6 fill;
    background: url("${MAP_SHORTCUT_PREVIEW_MEDIA.BACKGROUND_DARK}") repeat;
    border-radius: 4px;
  `;
  preview.appendChild(previewContent);
  document.body.appendChild(preview);

  positionMapShortcutPreview(preview, anchorButton);
  activeMapShortcutPreview = preview;
  activeMapShortcutPreviewAnchor = anchorButton;
}

function scheduleMapShortcutPreview(button) {
  if (!button?.dataset?.mapId || !button?.dataset?.setupName || !isSetupShortcutsAndHoverEnabled()) {
    return;
  }

  if (activeMapShortcutPreviewTimer) {
    clearTimeout(activeMapShortcutPreviewTimer);
  }

  activeMapShortcutPreviewTimer = setTimeout(() => {
    activeMapShortcutPreviewTimer = null;
    showMapShortcutPreview(button);
  }, MAP_SHORTCUT_PREVIEW_HOVER_DELAY_MS);
}

function attachMapShortcutHoverPreview(button) {
  if (!button || !isSetupShortcutsAndHoverEnabled() || button.dataset.setupManagerPreviewAttached === 'true') {
    return;
  }

  button.dataset.setupManagerPreviewAttached = 'true';

  button.addEventListener('mouseenter', () => {
    scheduleMapShortcutPreview(button);
  });

  button.addEventListener('focus', () => {
    scheduleMapShortcutPreview(button);
  });

  button.addEventListener('mouseleave', () => {
    hideMapShortcutPreview();
  });

  button.addEventListener('blur', () => {
    hideMapShortcutPreview();
  });
}

function createMapShortcutButton(mapId, setupName, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${MAP_SHORTCUT_BUTTON_CLASS} pixel-font-14`;
  button.textContent = truncateShortcutLabel(label);
  button.dataset.mapId = mapId;
  button.dataset.setupName = setupName;
  Object.assign(button.style, getMapShortcutButtonStyles());

  attachMapShortcutHoverPreview(button);

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideMapShortcutPreview();
    loadTeamAndNotify(mapId, setupName);
  });

  return button;
}

function isMapShortcutsMinimized() {
  return config.mapShortcutsMinimized === true;
}

function applyMapShortcutsCollapsedState(wrapper) {
  if (!wrapper) {
    return;
  }

  const minimized = isMapShortcutsMinimized();
  const buttonsRow = wrapper.querySelector(`.${MAP_SHORTCUTS_BUTTONS_CLASS}`);
  const toggleButton = wrapper.querySelector(`.${MAP_SHORTCUTS_TOGGLE_CLASS}`);

  if (buttonsRow) {
    buttonsRow.style.display = minimized ? 'none' : 'inline-flex';
  }

  if (toggleButton) {
    toggleButton.textContent = minimized ? '▲' : '▼';
    toggleButton.title = minimized
      ? t('mods.setupManager.mapShortcutsExpand')
      : t('mods.setupManager.mapShortcutsCollapse');
  }
}

function setMapShortcutsMinimized(minimized) {
  config.mapShortcutsMinimized = minimized === true;
  api.service.updateScriptConfig(context.hash, config);

  if (mapShortcutsContainer) {
    applyMapShortcutsCollapsedState(mapShortcutsContainer);
  }
}

function createMapShortcutsToggleButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = MAP_SHORTCUTS_TOGGLE_CLASS;
  Object.assign(button.style, {
    cursor: 'pointer',
    padding: '0',
    margin: '0',
    minWidth: '0',
    width: 'auto',
    height: 'auto',
    background: 'none',
    border: 'none',
    borderRadius: '0',
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: "'Courier New', monospace",
    fontSize: '11px',
    lineHeight: '1',
    textShadow: '1px 1px 0 #000',
    opacity: '0.85'
  });

  button.addEventListener('mouseenter', () => {
    button.style.opacity = '1';
    button.style.color = 'rgba(255, 255, 255, 0.95)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.opacity = '0.85';
    button.style.color = 'rgba(255, 255, 255, 0.7)';
  });

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    setMapShortcutsMinimized(!isMapShortcutsMinimized());
  });

  return button;
}

function createMapShortcutsBar(mapId) {
  const wrapper = document.createElement('div');
  wrapper.className = MAP_SHORTCUTS_CLASS;
  Object.assign(wrapper.style, {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: `${MAP_SHORTCUTS_EDGE_GAP_PX}px`,
    width: 'fit-content',
    height: 'fit-content',
    background: 'transparent',
    border: 'none'
  });

  const buttonsRow = document.createElement('div');
  buttonsRow.className = MAP_SHORTCUTS_BUTTONS_CLASS;
  Object.assign(buttonsRow.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '6px',
    width: 'auto',
    maxWidth: 'min(92vw, 720px)'
  });

  getMapShortcutEntries(mapId).forEach(({ name, label }) => {
    buttonsRow.appendChild(createMapShortcutButton(mapId, name, label));
  });

  wrapper.appendChild(buttonsRow);
  wrapper.appendChild(createMapShortcutsToggleButton());
  applyMapShortcutsCollapsedState(wrapper);
  return wrapper;
}

function removeMapShortcuts() {
  hideMapShortcutPreview();

  if (mapShortcutsContainer) {
    mapShortcutsContainer.remove();
    mapShortcutsContainer = null;
  }

  mapShortcutsMapId = null;
  removeMapShortcutsPositionListener();
}

function updateMapShortcuts() {
  if (config.showMapShortcuts === false || !isSetupShortcutsAndHoverEnabled()) {
    removeMapShortcuts();
    return;
  }

  if (!isAutosetupEnabled()) {
    removeMapShortcuts();
    return;
  }

  const mapId = getCurrentMapId();
  if (!mapId) {
    removeMapShortcuts();
    return;
  }

  const mainContainer = getMapMainContainer();
  if (!mainContainer) {
    return;
  }

  const entries = getMapShortcutEntries(mapId);
  const canReuseContainer = mapShortcutsContainer &&
    mapShortcutsMapId === mapId &&
    document.body.contains(mapShortcutsContainer);

  if (canReuseContainer) {
    const entriesSignature = getMapShortcutEntriesSignature(entries);
    const containerSignature = getMapShortcutsContainerSignature(mapShortcutsContainer);
    if (containerSignature === entriesSignature) {
      applyMapShortcutsCollapsedState(mapShortcutsContainer);
      syncMapShortcutsPosition();
      return;
    }
  }

  removeMapShortcuts();
  mapShortcutsContainer = createMapShortcutsBar(mapId);
  mapShortcutsMapId = mapId;
  ensureMapShortcutsPositionListener();
  document.body.appendChild(mapShortcutsContainer);
  syncMapShortcutsPosition();
  requestAnimationFrame(syncMapShortcutsPosition);
}

function initMapShortcuts() {
  if (!window.__setupManagerShortcutsHoverListenerAdded) {
    window.__setupManagerShortcutsHoverListenerAdded = true;
    window.addEventListener('betterUISetupShortcutsAndHoverChanged', () => {
      updateMapShortcuts();
    });
  }

  updateMapShortcuts();

  if (!mapShortcutsContainer) {
    setTimeout(updateMapShortcuts, 1000);
    setTimeout(updateMapShortcuts, 3000);
  }

  if (mapShortcutsSubscription || !globalThis.state?.board?.subscribe) {
    return;
  }

  mapShortcutsSubscription = globalThis.state.board.subscribe(() => {
    const mapId = getCurrentMapId();
    if (mapId !== mapShortcutsMapId) {
      updateMapShortcuts();
    }
  });
}

function cleanupMapShortcuts() {
  hideMapShortcutPreview();
  removeMapShortcutsPositionListener();

  if (mapShortcutsSubscription) {
    try {
      mapShortcutsSubscription();
    } catch (error) {
      console.warn('[Setup Manager] Error unsubscribing map shortcuts listener:', error);
    }
    mapShortcutsSubscription = null;
  }

  removeMapShortcuts();
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

  // Show quick-load setup buttons on the map
  initMapShortcuts();
  
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
  cancelPendingDeleteConfirmation();

  if (activeModal && typeof activeModal.close === 'function') {
    try {
      activeModal.close();
    } catch (error) {
      console.error('[Setup Manager] Error closing active modal:', error);
    }
    activeModal = null;
  }

  if (activeButtonElement) {
    api.ui.removeButton(BUTTON_ID);
    activeButtonElement = null;
  }

  cleanupMapShortcuts();

  const toastContainer = document.getElementById(SETUP_MANAGER_TOAST_CONTAINER_ID);
  if (toastContainer?.parentNode) {
    toastContainer.parentNode.removeChild(toastContainer);
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
    warningSymbol.title = t('mods.setupManager.modifiedMonsterWarning');
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
    tooltipContent.appendChild(createStatRow(t('mods.setupManager.statHitpoints'), hp, statMaxValues.hp, statColors.hp));
    tooltipContent.appendChild(createStatRow(t('mods.setupManager.statAttack'), ad, statMaxValues.ad, statColors.ad));
    tooltipContent.appendChild(createStatRow(t('mods.setupManager.statAbilityPower'), ap, statMaxValues.ap, statColors.ap));
    tooltipContent.appendChild(createStatRow(t('mods.setupManager.statArmor'), armor, statMaxValues.armor, statColors.armor));
    tooltipContent.appendChild(createStatRow(t('mods.setupManager.statMagicResist'), magicResist, statMaxValues.magicResist, statColors.magicResist));
    
    // Add modified indicator if needed
    if (isModified) {
      const modifiedRow = document.createElement('div');
      modifiedRow.className = 'pixel-font-16 text-whiteRegular';
      modifiedRow.style.cssText = 'color: #ff4444; font-style: italic; margin-top: 4px;';
      modifiedRow.textContent = t('mods.setupManager.modified');
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
    let tooltipText = `${tReplace('mods.setupManager.tooltipLevel', { level })}\n${tReplace('mods.setupManager.tooltipStatsFallback', { ad, ap, hp, armor, magicResist })}`;
    if (isModified) {
      tooltipText += `\n${t('mods.setupManager.modified')}`;
    }
    portrait.title = tooltipText;
  }
}

// Helper function to create monster portraits with correct tier coloring
function createMonsterPortrait(monsterInfo, showWarning = false) {
  if (!monsterInfo?.gameId) {
    return null;
  }

  try {
    const portrait = createSetupMonsterPortraitSlot({
      monsterId: monsterInfo.gameId,
      level: monsterInfo.level || 1,
      monster: monsterInfo,
      size: SETUP_MANAGER_EQUIPMENT_PORTRAIT_SIZE
    });

    if (!portrait) {
      return null;
    }

    if (showWarning) {
      addWarningSymbolToPortrait(portrait);
    }

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

// Helper function to create equipment portrait from gameId, stat, and tier
function createEquipmentPortraitFromData(gameId, stat, tier) {
  if (!gameId) {
    return null;
  }

  const spriteId = getEquipmentSpriteId(gameId);
  if (!spriteId) {
    return null;
  }

  return createSetupItemPortrait({
    itemId: spriteId,
    stat: stat || 'ad',
    tier: clampSetupEquipTier(tier)
  });
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

  let equipmentPortrait = null;
  if (isCustom && customEquip) {
    equipmentPortrait = createEquipmentPortraitFromCustom(customEquip);
  } else if (equipId) {
    equipmentPortrait = createEquipmentPortrait(equipId);
  }

  container.appendChild(equipmentPortrait || createSetupEmptyEquipmentPlaceholder());
  
  return container;
}

// Function to force close all open modals
function forceCloseAllModals() {
      console.log("Force closing all modals...");

  clearSetupManagerModalLayoutCleanup();
  
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

