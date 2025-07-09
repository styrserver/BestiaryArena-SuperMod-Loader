// Team Copier Mod for Bestiary Arena
console.log('Team Copier initializing...');

// Configuration with defaults
const defaultConfig = {
  buttonTooltip: 'Copy team setup to clipboard',
  includeSeed: false,
  useCompression: true,
  lastUsedSeeds: [],
  maxSavedSeeds: 5,
  currentLocale: document.documentElement.lang === 'pt' || 
    document.querySelector('html[lang="pt"]') || 
    window.location.href.includes('/pt/') ? 'pt' : 'en'
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Constants
const MOD_ID = 'team-copier';
const BUTTON_ID = `${MOD_ID}-button`;

// Translations
const TRANSLATIONS = {
  en: {
    buttonTooltip: 'Team Copier',
    successMessage: 'Team setup copied!',
    errorMessage: 'Error copying team setup',
    teamSetupCopied: 'Team setup copied to clipboard!',
    linkCopied: 'Sharable link copied to clipboard!',
    linkOpened: 'Opening shared configuration in new window!',
    modalTitle: 'Team Copier',
    copyTeamSetup: 'Copy Team Setup',
    copyStandard: 'Copy as Command',
    shareSetup: 'Share Team Setup',
    settings: 'Settings',
    includeSeedLabel: 'Include seed (for exact replay)',
    useCompressionLabel: 'Use compression for shorter URLs',
    seedSectionTitle: 'Last Used Seeds',
    noSeedsFound: 'No previously used seeds found',
    copyCompressedLink: 'Copy Compact Link (Shortest)',
    copyReadableLink: 'Copy Readable Link (Longer)',
    openInNewWindow: 'Open in New Window',
    closeButton: 'Close',
    saveButton: 'Save Settings',
    loadTeam: 'Load Team Configuration',
    pasteCommand: 'Paste team configuration command here...',
    applyTeam: 'Apply Team Configuration',
    teamApplied: 'Team configuration applied successfully!'
  },
  pt: {
    buttonTooltip: 'Copiador de Equipe',
    successMessage: 'Configuração copiada!',
    errorMessage: 'Erro ao copiar configuração',
    teamSetupCopied: 'Configuração da equipe copiada para a área de transferência!',
    linkCopied: 'Link compartilhável copiado para a área de transferência!',
    linkOpened: 'Abrindo configuração compartilhada em nova janela!',
    modalTitle: 'Copiador de Equipe',
    copyTeamSetup: 'Copiar Configuração',
    copyStandard: 'Copiar como Comando',
    shareSetup: 'Compartilhar Configuração',
    settings: 'Configurações',
    includeSeedLabel: 'Incluir seed (para replay exato)',
    useCompressionLabel: 'Usar compressão para URLs mais curtas',
    seedSectionTitle: 'Seeds Usados Recentemente',
    noSeedsFound: 'Nenhum seed usado anteriormente encontrado',
    copyCompressedLink: 'Copiar Link Compacto (Mais Curto)',
    copyReadableLink: 'Copiar Link Legível (Mais Longo)',
    openInNewWindow: 'Abrir em Nova Janela',
    closeButton: 'Fechar',
    saveButton: 'Salvar Configurações',
    loadTeam: 'Carregar Configuração de Equipe',
    pasteCommand: 'Cole o comando de configuração da equipe aqui...',
    applyTeam: 'Aplicar Configuração da Equipe',
    teamApplied: 'Configuração da equipe aplicada com sucesso!'
  }
};

// Get translation based on current locale
function t(key) {
  const locale = config.currentLocale;
  const translations = TRANSLATIONS[locale] || TRANSLATIONS.en;
  return translations[key] || key;
}

// Use a clipboard emoji instead of SVG
const clipboardIcon = "📋"; // Unicode clipboard icon

// Function to copy text to clipboard
function copyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  
  let success = false;
  try {
    success = document.execCommand('copy');
  } catch (err) {
    console.error('Failed to copy text:', err);
  }
  
  document.body.removeChild(textarea);
  return success;
}

// Helper function to compress JSON to make URLs shorter
function compressData(data) {
  try {
    // Convert to JSON string
    const jsonString = JSON.stringify(data);
    
    // Use base64 encoding to make it URL-safe
    // This is more efficient than percent-encoding the whole JSON
    return btoa(encodeURIComponent(jsonString));
  } catch (error) {
    console.error('Error compressing data:', error);
    return null;
  }
}

// Serialize the current board setup
function serializeBoard() {
  try {
    // Try different methods to get the serialized board data
    let boardData;
    
    // Method 1: Use the raw function directly from window if available
    if (typeof window.$serializeBoard === 'function') {
      boardData = JSON.parse(window.$serializeBoard());
      console.log('Used window.$serializeBoard directly for board data');
    } 
    // Method 2: Use the function from the API if available
    else if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.serializeBoard) {
      boardData = JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
      console.log('Used BestiaryModAPI.utility.serializeBoard for board data');
    } 
    // Method 3: Fallback to custom implementation
    else {
      // This is a simplified version of the BoardAnalyzer implementation
      const boardContext = globalThis.state.board.getSnapshot().context;
      const boardConfig = boardContext.boardConfig || [];
      const board = [];
      
      // Maps for converting IDs to names if available
      const monsterGameIdsToNames = window.BestiaryModAPI?.utility?.maps?.monsterGameIdsToNames || new Map();
      const equipmentGameIdsToNames = window.BestiaryModAPI?.utility?.maps?.equipmentGameIdsToNames || new Map();
      
      // Skip enemy pieces, only include player pieces
      for (const piece of boardConfig) {
        if (piece.type === 'player' || piece.type === 'custom') {
          const serializedPiece = {
            tile: piece.tileIndex,
            monster: {
              name: piece.type === 'custom' ? 
                monsterGameIdsToNames.get(piece.gameId) || `Monster ID ${piece.gameId}` :
                getMonsterName(piece),
              // Match the in-game UI order for stats
              hp: piece.type === 'custom' ? piece.genes.hp : getMonsterStat(piece, 'hp'),
              ad: piece.type === 'custom' ? piece.genes.ad : getMonsterStat(piece, 'ad'),
              ap: piece.type === 'custom' ? piece.genes.ap : getMonsterStat(piece, 'ap'),
              armor: piece.type === 'custom' ? piece.genes.armor : getMonsterStat(piece, 'armor'),
              magicResist: piece.type === 'custom' ? piece.genes.magicResist : getMonsterStat(piece, 'magicResist')
            },
            equipment: {
              name: piece.type === 'custom' ? 
                equipmentGameIdsToNames.get(piece.equip?.gameId) || `Equipment ID ${piece.equip?.gameId}` :
                getEquipmentName(piece),
              stat: piece.type === 'custom' ? piece.equip?.stat : getEquipmentStat(piece),
              tier: piece.type === 'custom' ? piece.equip?.tier : getEquipmentTier(piece)
            }
          };
          
          board.push(serializedPiece);
        }
      }
      
      // Sort by tile index for consistent order
      board.sort((a, b) => a.tile - b.tile);
      
      // Get map information
      const selectedMap = boardContext.selectedMap || {};
      const regionId = selectedMap.selectedRegion?.id;
      const regionName = getRegionName(regionId);
      const mapId = selectedMap.selectedRoom?.id;
      const mapName = getMapName(mapId);
      
      boardData = {
        region: regionName,
        map: mapName,
        board: board
      };
      
      console.log('Used custom serializeBoard implementation');
    }
    
    // Include current seed if enabled in config
    if (config.includeSeed) {
      try {
        // Try to get seed from current game
        const boardContext = globalThis.state.board.getSnapshot().context;
        const currentSeed = boardContext.sandboxSeed || boardContext.customSandboxSeed;
        
        if (currentSeed) {
          console.log('Including seed in board data:', currentSeed);
          boardData.seed = currentSeed;
          
          // Save this seed in our recent seeds list
          saveRecentSeed(currentSeed);
        }
      } catch (seedError) {
        console.warn('Could not retrieve current seed:', seedError);
      }
    }
    
    return boardData;
  } catch (error) {
    console.error('Error serializing board:', error);
    return null;
  }
}

// Save a seed to the recent seeds list
function saveRecentSeed(seed) {
  if (!seed) return;
  
  // Convert to number if it's a string
  const seedValue = typeof seed === 'string' ? parseInt(seed, 10) : seed;
  if (isNaN(seedValue)) return;
  
  // Add to the beginning of the list
  const updatedSeeds = [seedValue, ...config.lastUsedSeeds.filter(s => s !== seedValue)];
  
  // Limit to max seeds
  config.lastUsedSeeds = updatedSeeds.slice(0, config.maxSavedSeeds);
  
  // Save to config
  api.service.updateScriptConfig(context.hash, { 
    lastUsedSeeds: config.lastUsedSeeds 
  });
}

// Helper functions for the custom implementation
function getMonsterName(piece) {
  try {
    const monsters = globalThis.state.player.getSnapshot().context.monsters;
    const monster = monsters.find(m => m.id === piece.databaseId);
    if (monster) {
      return window.BestiaryModAPI?.utility?.maps?.monsterGameIdsToNames?.get(monster.gameId) || `Monster ID ${monster.gameId}`;
    }
    return `Unknown Monster`;
  } catch (e) {
    return `Monster`;
  }
}

function getMonsterStat(piece, stat) {
  try {
    const monsters = globalThis.state.player.getSnapshot().context.monsters;
    const monster = monsters.find(m => m.id === piece.databaseId);
    if (monster && monster[stat] !== undefined) {
      return monster[stat];
    }
    return 0;
  } catch (e) {
    return 0;
  }
}

function getEquipmentName(piece) {
  try {
    const equips = globalThis.state.player.getSnapshot().context.equips;
    const equipId = piece.equipId ?? null;
    const equip = equips.find(e => e.id === equipId);
    if (equip) {
      return window.BestiaryModAPI?.utility?.maps?.equipmentGameIdsToNames?.get(equip.gameId) || `Equipment ID ${equip.gameId}`;
    }
    return `Unknown Equipment`;
  } catch (e) {
    return `Equipment`;
  }
}

function getEquipmentStat(piece) {
  try {
    const equips = globalThis.state.player.getSnapshot().context.equips;
    const equipId = piece.equipId ?? null;
    const equip = equips.find(e => e.id === equipId);
    if (equip && equip.stat) {
      return equip.stat;
    }
    return 'ad';
  } catch (e) {
    return 'ad';
  }
}

function getEquipmentTier(piece) {
  try {
    const equips = globalThis.state.player.getSnapshot().context.equips;
    const equipId = piece.equipId ?? null;
    const equip = equips.find(e => e.id === equipId);
    if (equip && equip.tier) {
      return equip.tier;
    }
    return 1;
  } catch (e) {
    return 1;
  }
}

function getRegionName(regionId) {
  if (!regionId) return 'Unknown Region';
  
  try {
    // Try to get the name from the API utility maps
    if (window.BestiaryModAPI?.utility?.maps?.regionIdsToNames) {
      const name = window.BestiaryModAPI.utility.maps.regionIdsToNames.get(regionId);
      if (name) return name;
    }
    
    // Fallback to the game state utils
    const regions = globalThis.state.utils.REGIONS || [];
    const region = regions.find(r => r.id === regionId);
    if (region) return region.id; // Just use the ID if no name available
    
    return regionId; // Just return the ID if all else fails
  } catch (e) {
    return regionId;
  }
}

function getMapName(mapId) {
  if (!mapId) return 'Unknown Map';
  
  try {
    // Try to get the name from the API utility maps
    if (window.BestiaryModAPI?.utility?.maps?.mapIdsToNames) {
      const name = window.BestiaryModAPI.utility.maps.mapIdsToNames.get(mapId);
      if (name) return name;
    }
    
    // Fallback to the game state utils
    if (globalThis.state.utils.ROOM_NAME && globalThis.state.utils.ROOM_NAME[mapId]) {
      return globalThis.state.utils.ROOM_NAME[mapId];
    }
    
    return mapId; // Just return the ID if all else fails
  } catch (e) {
    return mapId;
  }
}

// Main function to copy the team setup
function copyTeamSetup() {
  try {
    // Get the board data
    const boardData = serializeBoard();
    
    if (!boardData) {
      console.error('Failed to serialize board data');
      showNotification(t('errorMessage'), 'error');
      return;
    }
    
    // Check if we have player pieces
    if (!boardData.board || boardData.board.length === 0) {
      console.warn('No player pieces found in the board data');
      showNotification('No player pieces to copy', 'warning');
      return;
    }
    
    // Format the board data for replay
    const replayText = `$configureBoard(${JSON.stringify(boardData)})`;
    
    // Copy to clipboard
    const success = copyToClipboard(replayText);
    
    if (success) {
      showNotification(t('teamSetupCopied'), 'success');
    } else {
      showNotification(t('errorMessage'), 'error');
    }
    
    console.log('Team setup copied to clipboard:', boardData);
  } catch (error) {
    console.error('Error copying team setup:', error);
    showNotification(t('errorMessage'), 'error');
  }
}

// Function to create a shareable link (compressed)
function createCompressedLink(boardData) {
  if (!boardData) boardData = serializeBoard();
  
  if (!boardData) {
    console.error('Failed to serialize board data');
    showNotification(t('errorMessage'), 'error');
    return null;
  }
  
  // Check if we have player pieces
  if (!boardData.board || boardData.board.length === 0) {
    console.warn('No player pieces found in the board data');
    showNotification('No player pieces to copy', 'warning');
    return null;
  }
  
  // Create a URL for sharing with compressed data
  const baseURL = 'https://bestiaryarena.com/game';
  
  // Use the compact V2 format for much shorter URLs
  let compressedData;
  try {
    compressedData = compressCompactFormat(boardData);
    if (!compressedData) {
      throw new Error('Compression failed');
    }
  } catch (error) {
    console.error('Error using compact compression, falling back to standard:', error);
    compressedData = compressStandardFormat(boardData);
  }
  
  if (!compressedData) {
    showNotification(t('errorMessage'), 'error');
    return null;
  }
  
  return `${baseURL}#replay=${compressedData}`;
}

// Function to create a shareable link (readable)
function createReadableLink(boardData) {
  if (!boardData) boardData = serializeBoard();
  
  if (!boardData) {
    console.error('Failed to serialize board data');
    showNotification(t('errorMessage'), 'error');
    return null;
  }
  
  // Check if we have player pieces
  if (!boardData.board || boardData.board.length === 0) {
    console.warn('No player pieces found in the board data');
    showNotification('No player pieces to copy', 'warning');
    return null;
  }
  
  // Create a URL for sharing with readable JSON
  const baseURL = 'https://bestiaryarena.com/game';
  const serializedData = encodeURIComponent(JSON.stringify(boardData));
  
  return `${baseURL}#replay=${serializedData}`;
}

// Helper function to compress JSON using base64 (standard format)
function compressStandardFormat(data) {
  try {
    // Convert to JSON string
    const jsonString = JSON.stringify(data);
    
    // Use base64 encoding to make it URL-safe
    return btoa(encodeURIComponent(jsonString));
  } catch (error) {
    console.error('Error compressing data:', error);
    return null;
  }
}

// Compact format compression for significantly shorter URLs (V2 format)
function compressCompactFormat(boardData) {
  try {
    // Get the essential data needed for team configuration
    const region = boardData.region || '';
    const map = boardData.map || '';
    const seed = boardData.seed || 0;
    const board = boardData.board || [];
    
    // Create compact arrays for board data
    const compactBoard = board.map(piece => {
      // Format: [tileIndex, monsterName, hp, ad, ap, armor, mr, equipName, equipStat, equipTier]
      return [
        piece.tile,
        piece.monster.name,
        piece.monster.hp,
        piece.monster.ad,
        piece.monster.ap,
        piece.monster.armor,
        piece.monster.magicResist,
        piece.equipment.name,
        piece.equipment.stat,
        piece.equipment.tier
      ];
    });
    
    // Create the compact data object
    const compactData = [
      region,
      map,
      seed,
      compactBoard
    ];
    
    // Use a more efficient encoding than standard JSON
    // 1. Convert to JSON with minimal whitespace
    const jsonStr = JSON.stringify(compactData);
    
    // 2. Use base64 but with URL-safe characters
    // Replace standard base64 chars with URL-safe alternatives
    // and remove padding to make it shorter
    let base64 = btoa(jsonStr);
    base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    return `v2-${base64}`;
  } catch (error) {
    console.error('Error compressing data using compact format:', error);
    return null;
  }
}

// Show a notification message
function showNotification(message, type = 'info', duration = 3000) {
  // Check if the API has a notify function
  if (api.ui && api.ui.notify) {
    api.ui.notify({
      message: message,
      type: type,
      duration: duration
    });
    return;
  }
  
  // Fallback to a simple modal
  api.ui.components.createModal({
    title: type.charAt(0).toUpperCase() + type.slice(1),
    content: message,
    buttons: [{ text: 'OK', primary: true }]
  });
}

// Create the main Team Copier modal with scrollable vertical layout
function showTeamCopierModal() {
  // Get board data once for all operations in the modal
  const boardData = serializeBoard();
  
  // Track if we have valid board data with pieces
  const hasValidBoardData = boardData && boardData.board && boardData.board.length > 0;
  
  // Create modal container
  const content = document.createElement('div');
  
  // Create a scrollable container using the game's native component 
  // instead of CSS overflow for consistent styling
  const scrollContainer = api.ui.components.createScrollContainer({
    height: 400,
    padding: true
  });
  
  // Create inner content to add to the scroll container
  const innerContent = document.createElement('div');
  innerContent.style.cssText = 'display: flex; flex-direction: column; gap: 15px; padding: 10px;';
  
  // SECTION: LOAD TEAM CONFIGURATION - Always show this section
  const loadTeamSection = createSection(t('loadTeam'));
  
  // Create a textarea for pasting team configuration command
  const commandTextarea = document.createElement('textarea');
  commandTextarea.placeholder = t('pasteCommand');
  commandTextarea.style.cssText = 'width: 100%; min-height: 80px; background-color: #222; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 8px; font-family: monospace; resize: vertical;';
  
  // Create button to apply the configuration
  const applyButton = createActionButton(t('applyTeam'), () => {
    // Get the command text from the textarea
    const commandText = commandTextarea.value.trim();
    
    // Verify that the command is valid
    if (!commandText) {
      showNotification('Please paste a valid team configuration', 'warning');
      return;
    }
    
    try {
      // Extract the JSON data from the command
      let boardData;
      
      // Check if it's a configureBoard command
      if (commandText.startsWith('$configureBoard(') && commandText.endsWith(')')) {
        const jsonStr = commandText.substring('$configureBoard('.length, commandText.length - 1);
        boardData = JSON.parse(jsonStr);
      } 
      // Check if it's a replay command
      else if (commandText.startsWith('$replay(') && commandText.endsWith(')')) {
        const jsonStr = commandText.substring('$replay('.length, commandText.length - 1);
        boardData = JSON.parse(jsonStr);
      } 
      // If it's a raw JSON string
      else {
        try {
          boardData = JSON.parse(commandText);
        } catch (e) {
          showNotification('Invalid command format. Please use $configureBoard() or $replay() format', 'error');
          return;
        }
      }
      
      // Apply the configuration
      applySharedTeamData(boardData);
      
      // Show success notification
      showNotification(t('teamApplied'), 'success');
      
      // Close the modal
      api.ui.closeModal();
      
      // Return early to prevent execution of code below that might throw an error
      return;
    } catch (error) {
      console.error('Error parsing team configuration:', error);
      showNotification('Invalid team configuration format', 'error');
    }
  });
  
  // Add elements to the section
  loadTeamSection.appendChild(commandTextarea);
  loadTeamSection.appendChild(applyButton);
  
  // Only add other sections if we have valid board data
  if (hasValidBoardData) {
    // SECTION: Copy Team Setup
    const copySection = createSection(t('copyTeamSetup'));
    
    // Button to copy standard command
    const copyButton = createActionButton(t('copyStandard'), () => {
      const success = copyToClipboard(`$configureBoard(${JSON.stringify(boardData)})`);
      if (success) {
        showNotification(t('teamSetupCopied'), 'success');
      } else {
        showNotification(t('errorMessage'), 'error');
      }
    });
    
    copySection.appendChild(copyButton);
    
    // Add seed selection section if we have any saved seeds
    if (config.lastUsedSeeds && config.lastUsedSeeds.length > 0) {
      const seedTitle = document.createElement('h4');
      seedTitle.textContent = t('seedSectionTitle');
      seedTitle.style.cssText = 'margin-top: 15px; margin-bottom: 10px; color: #bbb; font-size: 14px;';
      
      copySection.appendChild(seedTitle);
      
      // Create buttons for each seed
      config.lastUsedSeeds.forEach(seed => {
        const seedButton = createSeedButton(seed, boardData);
        copySection.appendChild(seedButton);
      });
    }
    
    // SECTION: Share Setup
    const shareSection = createSection(t('shareSetup'));
    
    // Button to copy compressed link
    const copyCompressedButton = createActionButton(t('copyCompressedLink'), () => {
      // Always use compression for the compressed link
      const useOriginalSetting = config.useCompression;
      config.useCompression = true;
      
      const link = createCompressedLink(boardData);
      if (link) {
        const success = copyToClipboard(link);
        if (success) {
          showNotification(t('linkCopied'), 'success');
        } else {
          showNotification(t('errorMessage'), 'error');
        }
      }
      
      // Restore original setting
      config.useCompression = useOriginalSetting;
    });
    
    // Button to copy readable link
    const copyReadableButton = createActionButton(t('copyReadableLink'), () => {
      const link = createReadableLink(boardData);
      if (link) {
        const success = copyToClipboard(link);
        if (success) {
          showNotification(t('linkCopied'), 'success');
        } else {
          showNotification(t('errorMessage'), 'error');
        }
      }
    });
    
    // Button to open in new window
    const openWindowButton = createActionButton(t('openInNewWindow'), () => {
      let link;
      if (config.useCompression) {
        link = createCompressedLink(boardData);
      } else {
        link = createReadableLink(boardData);
      }
      
      if (link) {
        window.open(link, '_blank');
        showNotification(t('linkOpened'), 'success');
      }
    });
    
    shareSection.appendChild(copyCompressedButton);
    shareSection.appendChild(copyReadableButton);
    shareSection.appendChild(openWindowButton);
    
    // SECTION: Settings
    const settingsSection = createSection(t('settings'));
    
    // Include seed checkbox
    const seedContainer = createCheckboxContainer();
    
    const seedCheckbox = document.createElement('input');
    seedCheckbox.type = 'checkbox';
    seedCheckbox.id = 'include-seed-checkbox';
    seedCheckbox.checked = config.includeSeed;
    seedCheckbox.style.cssText = 'width: 16px; height: 16px; margin-right: 10px;';
    
    const seedLabel = document.createElement('label');
    seedLabel.htmlFor = 'include-seed-checkbox';
    seedLabel.textContent = t('includeSeedLabel');
    
    seedContainer.appendChild(seedCheckbox);
    seedContainer.appendChild(seedLabel);
    
    // Compression checkbox
    const compressionContainer = createCheckboxContainer();
    
    const compressionCheckbox = document.createElement('input');
    compressionCheckbox.type = 'checkbox';
    compressionCheckbox.id = 'use-compression-checkbox';
    compressionCheckbox.checked = config.useCompression;
    compressionCheckbox.style.cssText = 'width: 16px; height: 16px; margin-right: 10px;';
    
    const compressionLabel = document.createElement('label');
    compressionLabel.htmlFor = 'use-compression-checkbox';
    compressionLabel.textContent = t('useCompressionLabel');
    
    compressionContainer.appendChild(compressionCheckbox);
    compressionContainer.appendChild(compressionLabel);
    
    // Save settings button
    const saveSettingsButton = createActionButton(t('saveButton'), () => {
      // Update config with form values
      config.includeSeed = document.getElementById('include-seed-checkbox').checked;
      config.useCompression = document.getElementById('use-compression-checkbox').checked;
      
      // Save configuration
      api.service.updateScriptConfig(context.hash, {
        includeSeed: config.includeSeed,
        useCompression: config.useCompression
      });
      
      showNotification('Settings saved', 'success');
    });
    
    settingsSection.appendChild(seedContainer);
    settingsSection.appendChild(compressionContainer);
    settingsSection.appendChild(saveSettingsButton);
    
    // Add all sections to the inner content
    innerContent.appendChild(copySection);
    innerContent.appendChild(shareSection);
    innerContent.appendChild(settingsSection);
  } else if (!hasValidBoardData) {
    // Add a message when there are no pieces on the board
    const noTeamMessage = document.createElement('div');
    noTeamMessage.textContent = 'No player pieces found on the board. Paste a team configuration above to load a team.';
    noTeamMessage.style.cssText = 'padding: 10px; color: #aaa; text-align: center; margin-top: 10px; font-style: italic;';
    loadTeamSection.appendChild(noTeamMessage);
  }
  
  // Always add the load team section first
  innerContent.appendChild(loadTeamSection);
  
  // Add inner content to scroll container
  scrollContainer.addContent(innerContent);
  
  // Add scroll container to main content
  content.appendChild(scrollContainer.element);
  
  // Create and show the modal
  return api.ui.components.createModal({
    title: t('modalTitle'),
    content: content,
    buttons: [
      {
        text: t('closeButton'),
        primary: true
      }
    ],
    width: 350 // Set a fixed width to avoid being too narrow
  });
  
  // Helper to create a section with title
  function createSection(title) {
    const section = document.createElement('div');
    section.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px;';
    
    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleElement.style.cssText = 'margin: 0; padding: 5px 0; border-bottom: 1px solid #444; color: #fff; font-size: 16px;';
    
    section.appendChild(titleElement);
    return section;
  }
  
  // Helper to create a checkbox container with consistent styling
  function createCheckboxContainer() {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; margin: 5px 0;';
    return container;
  }
  
  // Helper to create action buttons
  function createActionButton(label, onClick) {
    const button = document.createElement('button');
    button.textContent = label;
    button.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-2 pixel-font-14';
    button.style.cssText = 'width: 100%; margin: 3px 0;';
    
    button.addEventListener('click', onClick);
    
    return button;
  }
  
  // Helper to create seed buttons
  function createSeedButton(seed, baseData) {
    const button = document.createElement('button');
    button.textContent = `Seed: ${seed}`;
    button.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-1 pixel-font-14';
    button.style.cssText = 'width: 100%; margin: 3px 0;';
    
    button.addEventListener('click', () => {
      // Create a copy of the board data with this seed
      const dataCopy = JSON.parse(JSON.stringify(baseData));
      dataCopy.seed = seed;
      
      // Copy to clipboard
      const replayText = `$replay(${JSON.stringify(dataCopy)})`;
      const success = copyToClipboard(replayText);
      
      if (success) {
        showNotification(`Copied setup with seed ${seed}!`, 'success');
      } else {
        showNotification(t('errorMessage'), 'error');
      }
    });
    
    return button;
  }
}

// Create the main button
function createButton() {
  api.ui.addButton({
    id: BUTTON_ID,
    icon: clipboardIcon,
    modId: MOD_ID,
    tooltip: t('buttonTooltip'),
    primary: false,
    onClick: showTeamCopierModal
  });
}

// Initialize the mod
function init() {
  console.log('Team Copier Mod initializing UI...');
  
  // Create the button
  createButton();
  
  // Check for shared team configuration data in localStorage
  checkForSharedTeamData();
  
  console.log('Team Copier Mod initialized');
}

// Initialize the mod
init();

// Export functionality
context.exports = {
  copyTeamSetup: copyTeamSetup,
  showModal: showTeamCopierModal
};

// Check if there's shared team data to apply
function checkForSharedTeamData() {
  const replayDataStr = localStorage.getItem('BESTIARY_REPLAY_DATA');
  const loadedWithShare = localStorage.getItem('BESTIARY_LOADED_WITH_SHARE') === 'true';
  
  if (replayDataStr && loadedWithShare) {
    try {
      console.log('Found shared team data to apply');
      const boardData = JSON.parse(replayDataStr);
      
      // Wait a moment to ensure the game is fully loaded
      setTimeout(() => {
        applySharedTeamData(boardData);
      }, 200);
    } catch (error) {
      console.error('Error parsing shared team data:', error);
      showNotification('Error parsing shared team data', 'error');
    }
  }
}

// Apply shared team data to the game
function applySharedTeamData(boardData) {
  try {
    console.log('Applying shared team data:', boardData);
    
    // Check if we should use replay or configureBoard based on presence of seed
    if (boardData.seed) {
      console.log('Using replay function with seed');
      if (typeof window.$replay === 'function') {
        window.$replay(boardData);
      } else if (BestiaryModAPI?.utility?.replay) {
        BestiaryModAPI.utility.replay(boardData);
      } else {
        throw new Error('No replay function available');
      }
    } else {
      console.log('Using configureBoard function without seed');
      if (typeof window.$configureBoard === 'function') {
        window.$configureBoard(boardData);
      } else if (BestiaryModAPI?.utility?.configureBoard) {
        BestiaryModAPI.utility.configureBoard(boardData);
      } else {
        throw new Error('No configureBoard function available');
      }
    }
    
    // Show success notification
    showTeamLoadedNotification(boardData);
    
    // Clear the localStorage data after usage only if it exists
    if (localStorage.getItem('BESTIARY_REPLAY_DATA')) {
      localStorage.removeItem('BESTIARY_REPLAY_DATA');
      localStorage.removeItem('BESTIARY_LOADED_WITH_SHARE');
    }
  } catch (error) {
    console.error('Error applying shared team data:', error);
    showNotification('Error applying shared team data', 'error');
  }
}

// Show a notification when a shared team is loaded
function showTeamLoadedNotification(data) {
  try {
    // Extract region, map, and team size info
    const regionName = data.region || 'Unknown';
    const mapName = data.map || 'Unknown';
    const teamSize = data.board ? data.board.length : 0;
    
    // Create notification message
    const message = `Loaded shared team: ${teamSize} units on ${mapName} (${regionName})`;
    
    showNotification(message, 'success', 4000);
  } catch (error) {
    console.error('Error showing team loaded notification:', error);
  }
} 