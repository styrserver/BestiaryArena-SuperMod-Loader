// Board Analyzer Mod for Bestiary Arena
console.log('Board Analyzer Mod initializing...');

// Global state management for mod coordination
if (!window.__modCoordination) {
  window.__modCoordination = {
    boardAnalyzerRunning: false,
    boardAnalyzerStartTime: null,
    boardAnalyzerEndTime: null
  };
}

// Configuration with defaults
const defaultConfig = {
  runs: 20,
  speedupFactor: 1000,
  hideGameBoard: true,
  enableTurboAutomatically: true,
  stopOnSPlus: false,
  stopAfterTicks: 0, // 0 means no limit
  stopWhenTicksReached: 0, // Stop when finding a run with this number of ticks or less
  currentLocale: document.documentElement.lang === 'pt' || 
    document.querySelector('html[lang="pt"]') || 
    window.location.href.includes('/pt/') ? 'pt' : 'en'
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Constants
const MOD_ID = 'board-analyzer';
const BUTTON_ID = `${MOD_ID}-button`;
const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;
const DEFAULT_TICK_INTERVAL_MS = 62.5;

// Track active modals to ensure they can be closed properly
let activeRunningModal = null;
let activeConfigPanel = null;

// NEW: Lightweight modal registry to replace excessive DOM queries
const modalRegistry = {
  modals: new Set(),
  register(modal) {
    this.modals.add(modal);
  },
  unregister(modal) {
    this.modals.delete(modal);
  },
  closeAll() {
    this.modals.forEach(modal => {
      try {
        // Handle different modal structures
        if (modal && typeof modal === 'function') {
          // Modal is a function (like closeModal)
          modal();
        } else if (modal && typeof modal.close === 'function') {
          // Modal has a close method
          modal.close();
        } else if (modal && modal.element && typeof modal.element.remove === 'function') {
          // Modal has an element with remove method
          modal.element.remove();
        } else if (modal && typeof modal.remove === 'function') {
          // Modal has a remove method
          modal.remove();
        } else {
          console.warn('Unknown modal structure:', modal);
        }
      } catch (e) {
        console.warn('Error closing modal:', e);
      }
    });
    this.modals.clear();
  },
  closeByType(type) {
    this.modals.forEach(modal => {
      try {
        if (modal && modal.type === type) {
          // Handle different modal structures
          if (typeof modal === 'function') {
            modal();
          } else if (typeof modal.close === 'function') {
            modal.close();
          } else if (modal.element && typeof modal.element.remove === 'function') {
            modal.element.remove();
          } else if (typeof modal.remove === 'function') {
            modal.remove();
          }
          this.modals.delete(modal);
        }
      } catch (e) {
        console.warn('Error closing modal by type:', e);
      }
    });
  }
};

// Variable to signal forced stop
let forceStop = false;

// Global variables to track game data
let currentSeed = null;
let currentRegionId = null;
let currentRoomId = null;
let currentRoomName = null;
let boardSetup = [];

// Use the utility maps from the API if available, otherwise define placeholders
// that will be replaced when the API is ready
let regionNamesToIds = new Map();
let regionIdsToNames = new Map();
let mapNamesToIds = new Map();
let mapIdsToNames = new Map();
let monsterNamesToGameIds = new Map();
let monsterGameIdsToNames = new Map();
let equipmentNamesToGameIds = new Map(); 
let equipmentGameIdsToNames = new Map();

// Variable to track if turbo mode is active
let turboActive = false;
let speedupSubscription = null;

// Function to force a specific seed - use API version if available
let forceSeed = (seed) => {
  if (window.BestiaryModAPI && window.BestiaryModAPI.utility) {
    return window.BestiaryModAPI.utility.forceSeed(seed);
  }
  
  // Fallback implementation
  globalThis.state.board.send({
    type: 'setState',
    fn: (prev) => {
      return {
        ...prev,
        customSandboxSeed: seed,
      };
    },
  });
};

// Function to remove a forced seed - use API version if available
let removeSeed = () => {
  if (window.BestiaryModAPI && window.BestiaryModAPI.utility) {
    return window.BestiaryModAPI.utility.removeSeed();
  }
  
  // Fallback implementation
  globalThis.state.board.send({
    type: 'setState',
    fn: (prev) => {
      delete prev.customSandboxSeed;
      // Note: `structuredClone` doesn't work in this case.
      const copy = { ...prev };
      return copy;
    },
  });
};

// Wait for the utility functions to be available from the API
document.addEventListener('utility-api-ready', () => {
  console.log('Board Analyzer: Utility API is ready, updating functions');
  
  // Update map references to use the API versions
  if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.maps) {
    const maps = window.BestiaryModAPI.utility.maps;
    regionNamesToIds = maps.regionNamesToIds;
    regionIdsToNames = maps.regionIdsToNames;
    mapNamesToIds = maps.mapNamesToIds;
    mapIdsToNames = maps.mapIdsToNames;
    monsterNamesToGameIds = maps.monsterNamesToGameIds;
    monsterGameIdsToNames = maps.monsterGameIdsToNames;
    equipmentNamesToGameIds = maps.equipmentNamesToGameIds;
    equipmentGameIdsToNames = maps.equipmentGameIdsToNames;
  }
  
  // Update the function references to use the API versions
  if (window.BestiaryModAPI && window.BestiaryModAPI.utility) {
    forceSeed = window.BestiaryModAPI.utility.forceSeed;
    removeSeed = window.BestiaryModAPI.utility.removeSeed;
  }
});

// Set up the board based on a given configuration - use API version if available
const configureBoard = (config) => {
  if (window.BestiaryModAPI && window.BestiaryModAPI.utility) {
    return window.BestiaryModAPI.utility.configureBoard(config);
  }
  
  // Fallback implementation
  if (!config) {
    throw new Error('No config provided.');
  }
  // Enable sandbox mode.
  globalThis.state.board.send({
    type: 'setPlayMode',
    mode: 'sandbox',
  });
  // Load the relevant map.
  if (!Object.hasOwn(config, 'map')) {
    throw new Error('The config is missing the `map` property.');
  }
  const mapId = mapNamesToIds.get(config.map);
  globalThis.state.board.send({
    type: 'selectRoomById',
    roomId: mapId,
  });
  // Set up the pieces.
  const playerTeamConfig = config.board.map((piece, index) => {
    const monster = piece.monster;
    
    // Get monster ID from name
    const monsterGameId = monsterNamesToGameIds.get(monster.name);
    if (!monsterGameId) {
      console.warn(`Unknown monster name: ${monster.name}`);
    }
    
    // Get level from monster data if available
    const monsterLevel = monster.level || 1;
    
    const pieceConfig = {
      type: 'custom',
      nickname: null,
      tileIndex: piece.tile,
      gameId: monsterGameId,
      tier: 4,
      level: monsterLevel, // Use actual monster level instead of hardcoded value
      genes: {
        hp: monster.hp,
        ad: monster.ad,
        ap: monster.ap,
        armor: monster.armor,
        magicResist: monster.magicResist,
      },
      villain: false,
      key: `fake-monster-${index}`,
      direction: 'south',
    };
    
    // Only add equip if it exists
    const equip = piece.equipment;
    if (equip && equip.name) {
      const equipId = equipmentNamesToGameIds.get(equip.name);
      if (equipId) {
        pieceConfig.equip = {
          gameId: equipId,
          stat: equip.stat,
          tier: equip.tier,
        };
      } else {
        console.warn(`Unknown equipment name: ${equip.name}`);
      }
    }
    
    return pieceConfig;
  });
  
  const enemyTeamConfig = globalThis.state.utils.getBoardMonstersFromRoomId(mapId);
  const boardConfig = [...enemyTeamConfig, ...playerTeamConfig];
  
  globalThis.state.board.send({
    type: 'setState',
    fn: (prev) => {
      return {
        ...prev,
        boardConfig: boardConfig,
      };
    },
  });
};

// Enable turbo mode to speed up the game using the more efficient approach
function enableTurbo(speedupFactor = config.speedupFactor) {
  if (turboActive) return;
  
  // Clean up any existing subscription
  if (speedupSubscription) {
    speedupSubscription.unsubscribe();
    speedupSubscription = null;
  }
  
  // Calculate the new interval
  const interval = DEFAULT_TICK_INTERVAL_MS / speedupFactor;
  
  // Set up the subscription
  speedupSubscription = globalThis.state.board.on('newGame', (event) => {
    try {
      if (event.world && event.world.tickEngine) {
        event.world.tickEngine.setTickInterval(interval);
      }
    } catch (e) {
      console.warn('Could not set tick interval in newGame event:', e);
    }
  });
  
  // If there's an active game, try to adjust its speed but handle potential errors
  try {
    const boardContext = globalThis.state.board.getSnapshot().context;
    if (boardContext && boardContext.world && boardContext.world.tickEngine) {
      console.log(`Setting tick interval for existing game to ${interval}ms (${speedupFactor}x speed)`);
      boardContext.world.tickEngine.setTickInterval(interval);
    } else {
      console.log('No active game with tickEngine found, will apply speed on next game start');
    }
  } catch (e) {
    console.warn('Could not access current game tickEngine:', e);
  }
  
  turboActive = true;
  console.log(`Turbo mode enabled (${speedupFactor}x)`);
}

// Disable turbo mode and restore normal timing
function disableTurbo() {
  if (!turboActive) return;
  
  // Remove the subscription to restore original behavior
  if (speedupSubscription) {
    speedupSubscription.unsubscribe();
    speedupSubscription = null;
  }
  
  // Reset the current game's tick interval if it exists
  if (globalThis.state?.board?.getSnapshot()?.context?.world?.tickEngine) {
    const tickEngine = globalThis.state.board.getSnapshot().context.world.tickEngine;
    console.log(`Resetting tick interval to default (${DEFAULT_TICK_INTERVAL_MS}ms)`);
    tickEngine.setTickInterval(DEFAULT_TICK_INTERVAL_MS);
  }
  
  turboActive = false;
  console.log('Turbo mode disabled');
}

// Replay a board configuration with a specific seed - use API version if available
const replayBoard = (config) => {
  if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.replay) {
    return window.BestiaryModAPI.utility.replay(config);
  }
  
  // Fallback implementation
  // Set up the board.
  configureBoard(config);
  // Force a custom seed if the config specifies one.
  if (Object.hasOwn(config, 'seed')) {
    forceSeed(config.seed);
  }
};

// Serialize a player piece for replay
const serializePlayerPiece = (piece) => {
  try {
    const monsters = globalThis.state.player.getSnapshot().context.monsters;
    const equips = globalThis.state.player.getSnapshot().context.equips;
    const tile = piece.tileIndex;
    const monster = monsters.find((monster) => monster.id === piece.databaseId);
    
    if (!monster) {
      console.error(`Monster with database ID ${piece.databaseId} not found`);
      return null;
    }
    
    // Get the monster name using game ID
    const monsterName = monsterGameIdsToNames.get(monster.gameId);
    if (!monsterName) {
      console.error(`Monster name not found for game ID ${monster.gameId}`);
      return null;
    }
    
    // Calculate level from experience if available
    let monsterLevel = 1;
    if (monster.exp && typeof globalThis.state.utils.expToCurrentLevel === 'function') {
      monsterLevel = globalThis.state.utils.expToCurrentLevel(monster.exp);
    }
    
    // Create the base serialized object with monster data
    const serialized = {
      tile: tile,
      monster: {
        name: monsterName,
        // Match the in-game UI order
        hp: monster.hp,
        ad: monster.ad,
        ap: monster.ap,
        armor: monster.armor,
        magicResist: monster.magicResist,
        level: monsterLevel // Add level information
      }
    };
    
    // Only add equipment if it exists
    const equipId = piece.equipId ?? monster.equipId;
    if (equipId) {
      const equip = equips.find((equip) => equip.id === equipId);
      if (equip) {
        const equipName = equipmentGameIdsToNames.get(equip.gameId);
        if (equipName) {
          serialized.equipment = {
            name: equipName,
            stat: equip.stat,
            tier: equip.tier,
          };
        } else {
          console.warn(`Equipment name not found for game ID ${equip.gameId}`);
        }
      } else {
        console.warn(`Equipment with ID ${equipId} not found`);
      }
    } else {
      console.log(`No equipment for monster ${monsterName} at tile ${tile}`);
    }
    
    return serialized;
  } catch (error) {
    console.error('Error in serializePlayerPiece:', error);
    return null;
  }
};

// Serialize a custom piece for replay
const serializeCustomPiece = (piece) => {
  try {
    // Check if we have a valid monster game ID
    const monsterName = monsterGameIdsToNames.get(piece.gameId);
    if (!monsterName) {
      console.error(`Monster name not found for game ID ${piece.gameId}`);
      return null;
    }
    
    // Get monster level from piece if available
    const monsterLevel = piece.level || 1;
    
    // Create the base serialized object with monster data
    const serialized = {
      tile: piece.tileIndex,
      monster: {
        name: monsterName,
        // Match the in-game UI order
        hp: piece.genes?.hp || 1,
        ad: piece.genes?.ad || 1,
        ap: piece.genes?.ap || 1,
        armor: piece.genes?.armor || 1,
        magicResist: piece.genes?.magicResist || 1,
        level: monsterLevel // Add level information
      }
    };
    
    // Only add equipment if it exists
    if (piece.equip && piece.equip.gameId) {
      const equipName = equipmentGameIdsToNames.get(piece.equip.gameId);
      if (equipName) {
        serialized.equipment = {
          name: equipName,
          stat: piece.equip.stat,
          tier: piece.equip.tier,
        };
      } else {
        console.warn(`Equipment name not found for game ID ${piece.equip.gameId}`);
      }
    } else {
      console.log(`No equipment for custom monster at tile ${piece.tileIndex}`);
    }
    
    return serialized;
  } catch (error) {
    console.error('Error in serializeCustomPiece:', error);
    return null;
  }
};

// Serialize the player-added pieces on the board as JSON - use API version if available
const serializeBoard = () => {
  if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.serializeBoard) {
    // The API function returns a JSON string, so we parse it back to an object
    return JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
  }
  
  // Fallback implementation - this should be used only if utility API is not available
  const boardContext = globalThis.state.board.getSnapshot().context;
  const boardConfig = boardContext.boardConfig;
  const board = [];
  for (const piece of boardConfig) {
    if (piece.type === 'player') {
      board.push(serializePlayerPiece(piece));
    } else if (piece.type === 'custom') {
      board.push(serializeCustomPiece(piece));
    }
  }
  board.sort((a, b) => a.tile - b.tile);
  const selectedMap = boardContext.selectedMap;
  const regionId = selectedMap.selectedRegion.id;
  const regionName = regionIdsToNames.get(regionId);
  const mapId = selectedMap.selectedRoom.id;
  const mapName = mapIdsToNames.get(mapId);
  const result = {
    region: regionName,
    map: mapName,
    board: board,
  };
  return result;
};

const TRANSLATIONS = {
  en: {
    buttonText: 'Analyze Board',
    buttonTooltip: 'Analyze current board performance',
    configButtonTooltip: 'Analyzer Settings',
    configTitle: 'Board Analyzer Settings',
    runsLabel: 'Number of runs:',
    speedFactorLabel: 'Speed factor:',
    hideGameBoardLabel: 'Hide game board during analysis',
    autoTurboLabel: 'Enable turbo mode automatically',
    stopOnSPlusLabel: 'Stop when reaching S+ grade',
    stopAfterTicksLabel: 'Stop after ticks (0 for no limit):',
    stopWhenTicksReachedLabel: 'Stop when reaching ticks or below (0 to disable):',
    copyTargetTicksReplayButton: 'Replay Target',
    saveButton: 'Save',
    cancelButton: 'Cancel',
    startAnalysisButton: 'Start Analysis',
    modalTitle: 'Board Analysis',
    runningTitle: 'Running Analysis',
    runningText: 'Analyzing board performance...',
    progressText: 'Run {current} of {total}',
    resultTitle: 'Analysis Results',
    sPlusRateLabel: 'S+ Rate:',
    completionRateLabel: 'Completion Rate:',
    bestTimeLabel: 'Best Time:',
    maxPointsLabel: 'Max Rank Points:',
    minTimeLabel: 'Min Time:',
    maxTimeLabel: 'Max Time:',
    medianTimeLabel: 'Median Time:',
    averageTimeLabel: 'Average Time:',
    closeButton: 'Close',
    errorTitle: 'Error',
    errorText: 'An error occurred during analysis. Please try again.',
    ticksSuffix: 'ticks',
    startButton: 'Start',
    stopButton: 'Stop',
    forceStopButton: 'Stop Analysis',
    partialResultsNote: 'Partial results (analysis stopped early)',
    sandboxModeEnabled: 'Sandbox mode enabled for analysis',
    copyReplayButton: 'Copy Replay',
    replayCopiedMessage: 'Copied!',
    totalTimeLabel: 'Total Time:',
    avgRunTimeLabel: 'Avg Run Time:',
    estimatedTimeRemainingLabel: 'Est. Remaining:',
    fastestRunTimeLabel: 'Fastest Run:',
    slowestRunTimeLabel: 'Slowest Run:',
    maxPointsSuffix: 'max points',
    sPlusMaxPointsRateLabel: 'S+{points} Rate:'
  },
  pt: {
    buttonText: 'Analisar Tabuleiro',
    buttonTooltip: 'Analisar desempenho do tabuleiro atual',
    configButtonTooltip: 'Configurações do Analisador',
    configTitle: 'Configurações do Analisador',
    runsLabel: 'Número de execuções:',
    speedFactorLabel: 'Fator de velocidade:',
    hideGameBoardLabel: 'Ocultar tabuleiro durante análise',
    autoTurboLabel: 'Ativar modo turbo automaticamente',
    stopOnSPlusLabel: 'Parar ao atingir classificação S+',
    stopAfterTicksLabel: 'Parar após ticks (0 para sem limite):',
    stopWhenTicksReachedLabel: 'Parar ao atingir ticks ou abaixo (0 para desabilitar):',
    copyTargetTicksReplayButton: 'Replay Alvo',
    saveButton: 'Salvar',
    cancelButton: 'Cancelar',
    startAnalysisButton: 'Iniciar Análise',
    modalTitle: 'Análise do Tabuleiro',
    runningTitle: 'Executando Análise',
    runningText: 'Analisando desempenho do tabuleiro...',
    progressText: 'Execução {current} de {total}',
    resultTitle: 'Resultados da Análise',
    sPlusRateLabel: 'Taxa de S+:',
    completionRateLabel: 'Taxa de Conclusão:',
    bestTimeLabel: 'Melhor Tempo:',
    maxPointsLabel: 'Pontos Máximos:',
    minTimeLabel: 'Tempo Mínimo:',
    maxTimeLabel: 'Tempo Máximo:',
    medianTimeLabel: 'Tempo Mediana:',
    averageTimeLabel: 'Tempo Médio:',
    closeButton: 'Fechar',
    errorTitle: 'Erro',
    errorText: 'Ocorreu um erro durante a análise. Por favor, tente novamente.',
    ticksSuffix: 'ticks',
    startButton: 'Iniciar',
    stopButton: 'Parar',
    forceStopButton: 'Interromper Análise',
    partialResultsNote: 'Resultados parciais (análise interrompida)',
    sandboxModeEnabled: 'Modo sandbox ativado para análise',
    copyReplayButton: 'Copiar Replay',
    replayCopiedMessage: 'Copiado!',
    totalTimeLabel: 'Tempo Total:',
    avgRunTimeLabel: 'Tempo Médio/run:',
    estimatedTimeRemainingLabel: 'Tempo Restante Est.:',
    fastestRunTimeLabel: 'Execução Mais Rápida:',
    slowestRunTimeLabel: 'Execução Mais Lenta:',
    maxPointsSuffix: 'pontos máximos',
    sPlusMaxPointsRateLabel: 'Taxa S+{points}:'
  }
};

// Inject custom CSS for inputs to ensure better readability
function injectCustomStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    #${CONFIG_PANEL_ID} input[type="number"], 
    #${CONFIG_PANEL_ID} input[type="text"] {
      background-color: #333;
      color: #fff;
      border: 1px solid #555;
      padding: 4px 8px;
      border-radius: 4px;
    }
    
    #${CONFIG_PANEL_ID} input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: #4a5;
    }
  `;
  document.head.appendChild(styleElement);
}

// Get translation based on current locale
function t(key) {
  const locale = config.currentLocale;
  const translations = TRANSLATIONS[locale] || TRANSLATIONS.en;
  return translations[key] || key;
}

// Sleep function for async operations
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Find and click buttons in the game
function findButtonWithText(text) {
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    if (button.textContent === text) return button;
  }
  return null;
}

function clickButtonWithText(text) {
  const button = findButtonWithText(text);
  if (button) {
    button.click();
    return true;
  }
  return false;
}

// REMOVED: calculateMedian and calculateAverage functions - now handled by StatisticsCalculator

// Ensure the game is in sandbox mode
function ensureSandboxMode() {
  try {
    // Get the current game mode
    const boardContext = globalThis.state.board.getSnapshot().context;
    const currentMode = boardContext.mode;
    
    // If not in sandbox mode, switch to it
    if (currentMode !== 'sandbox') {
      console.log(`Switching from ${currentMode} mode to sandbox mode`);
      globalThis.state.board.send({ type: "setPlayMode", mode: "sandbox" });
      return true; // Mode was changed
    } else {
      console.log('Already in sandbox mode');
      return false; // No change needed
    }
  } catch (error) {
    console.error('Error setting sandbox mode:', error);
    return false;
  }
}

// NEW: Function to properly restore the board state
function restoreBoardState() {
  try {
    console.log('Restoring board state...');
    
    // NEW: Reset global coordination state to allow other mods to resume
    if (window.__modCoordination) {
      window.__modCoordination.boardAnalyzerRunning = false;
      window.__modCoordination.boardAnalyzerEndTime = Date.now();
      console.log('[Board Analyzer] Analysis finished - other mods can resume');
      
      // Small delay to ensure other mods detect the state change
      setTimeout(() => {
        // Force a small state change to trigger any watchers
        window.__modCoordination.boardAnalyzerRunning = false;
      }, 50);
    }
    
    // Stop any running game
    globalThis.state.board.send({
      type: "setState",
      fn: prevState => ({
        ...prevState,
        gameStarted: false
      })
    });
    
    // Remove any forced seed
    if (typeof removeSeed === 'function') {
      removeSeed();
    }
    
    // Restore game board visibility
    const gameFrame = document.querySelector('main .frame-4');
    if (gameFrame && gameFrame.style.display === 'none') {
      gameFrame.style.display = '';
      console.log('Game board visibility restored');
    }
    
    // Reset body overflow if it was modified
    if (document.body.style.overflow === 'hidden') {
      document.body.style.overflow = '';
    }
    
    // NEW: Restore Better Highscores container if it exists
    if (window.BetterHighscores && typeof window.BetterHighscores.restoreContainer === 'function') {
      try {
        console.log('[Board Analyzer] Restoring Better Highscores container...');
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          window.BetterHighscores.restoreContainer();
        }, 100);
      } catch (error) {
        console.warn('[Board Analyzer] Error restoring Better Highscores container:', error);
      }
    }
    
    console.log('Board state restored successfully');
  } catch (error) {
    console.error('Error restoring board state:', error);
  }
}

// NEW: Shared game state tracker to avoid multiple subscriptions
let gameStateTracker = null;
let currentGameState = null;

// NEW: Board serialization cache to avoid redundant calls
let boardSerializationCache = {
  lastSerialized: null,
  lastSerializedTime: 0,
  cacheTimeout: 100, // Cache for 100ms to avoid redundant calls
  
  serialize(seed = null) {
    const now = Date.now();
    
    // Return cached version if it's recent enough
    if (this.lastSerialized && (now - this.lastSerializedTime) < this.cacheTimeout) {
      const cached = JSON.parse(JSON.stringify(this.lastSerialized));
      if (seed) cached.seed = seed;
      return cached;
    }
    
    // Serialize fresh board data
    let boardData;
    
    try {
      if (typeof window.$serializeBoard === 'function') {
        boardData = JSON.parse(window.$serializeBoard());
      } else if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.serializeBoard) {
        boardData = JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
      } else {
        boardData = serializeBoard();
      }
      
      // Cache the result
      this.lastSerialized = JSON.parse(JSON.stringify(boardData));
      this.lastSerializedTime = now;
      
      // Add seed if provided
      if (seed) boardData.seed = seed;
      
      return boardData;
    } catch (error) {
      console.error('Error serializing board:', error);
      return null;
    }
  },
  
  clear() {
    this.lastSerialized = null;
    this.lastSerializedTime = 0;
  }
};

// NEW: Optimized statistics calculator to avoid repeated array operations
class StatisticsCalculator {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.totalRuns = 0;
    this.completedRuns = 0;
    this.sPlusCount = 0;
    this.sPlusMaxPointsCount = 0;
    this.maxRankPoints = 0;
    this.minTicks = Infinity;
    this.maxTicks = 0;
    this.ticksSum = 0;
    this.ticksArray = [];
    this.runTimes = [];
    this.runTimesSum = 0;
  }
  
  addRun(result, runTime) {
    this.totalRuns++;
    this.runTimes.push(runTime);
    this.runTimesSum += runTime;
    
    if (result.completed) {
      this.completedRuns++;
      this.ticksArray.push(result.ticks);
      this.ticksSum += result.ticks;
      
      // Update min/max ticks
      if (result.ticks < this.minTicks) {
        this.minTicks = result.ticks;
      }
      if (result.ticks > this.maxTicks) {
        this.maxTicks = result.ticks;
      }
    }
    
    // Update S+ stats
    if (result.grade === 'S+') {
      this.sPlusCount++;
      if (result.rankPoints === this.maxRankPoints) {
        this.sPlusMaxPointsCount++;
      } else if (result.rankPoints > this.maxRankPoints) {
        this.maxRankPoints = result.rankPoints;
        this.sPlusMaxPointsCount = 1;
      }
    }
  }
  
  calculateStatistics() {
    const sPlusRate = this.totalRuns > 0 ? (this.sPlusCount / this.totalRuns * 100).toFixed(2) : '0.00';
    const completionRate = this.totalRuns > 0 ? (this.completedRuns / this.totalRuns * 100).toFixed(2) : '0.00';
    const averageRunTime = this.runTimes.length > 0 ? this.runTimesSum / this.runTimes.length : 0;
    const averageTicks = this.ticksArray.length > 0 ? this.ticksSum / this.ticksArray.length : 0;
    const medianTicks = this.calculateMedian(this.ticksArray);
    
    return {
      totalRuns: this.totalRuns,
      completedRuns: this.completedRuns,
      sPlusCount: this.sPlusCount,
      sPlusMaxPointsCount: this.sPlusMaxPointsCount,
      sPlusRate,
      completionRate,
      minTicks: isFinite(this.minTicks) ? this.minTicks : 0,
      maxTicks: this.maxTicks,
      medianTicks,
      averageTicks,
      maxRankPoints: this.maxRankPoints,
      averageRunTime,
      fastestRunTime: this.runTimes.length > 0 ? Math.min(...this.runTimes) : 0,
      slowestRunTime: this.runTimes.length > 0 ? Math.max(...this.runTimes) : 0
    };
  }
  
  calculateMedian(array) {
    if (array.length === 0) return 0;
    if (array.length === 1) return array[0];
    
    const sorted = [...array].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }
}

// Function to initialize or get the shared game state tracker
function getGameStateTracker() {
  if (!gameStateTracker) {
    gameStateTracker = {
      subscription: null,
      listeners: new Set(),
      currentState: null,
      
      subscribe(listener) {
        this.listeners.add(listener);
        
        // If this is the first listener, start the subscription
        if (!this.subscription) {
          this.startSubscription();
        }
        
        // Return unsubscribe function
        return () => {
          this.listeners.delete(listener);
          if (this.listeners.size === 0) {
            this.stopSubscription();
          }
        };
      },
      
      startSubscription() {
        if (this.subscription) return;
        
        this.subscription = globalThis.state.gameTimer.subscribe((data) => {
          this.currentState = data.context;
          this.notifyListeners(data.context);
        });
      },
      
      stopSubscription() {
        if (this.subscription) {
          this.subscription.unsubscribe();
          this.subscription = null;
        }
        this.currentState = null;
      },
      
      notifyListeners(context) {
        this.listeners.forEach(listener => {
          try {
            listener(context);
          } catch (error) {
            console.warn('Error in game state listener:', error);
          }
        });
      },
      
      getCurrentState() {
        return this.currentState;
      }
    };
  }
  
  return gameStateTracker;
}

// Function to get the final result of a game run
const getLastTick = (analysisId = null) => {
  return new Promise((resolve) => {
    let hasResolved = false;
    let unsubscribe = null;
    
    // NEW: Check if this analysis instance is still valid
    if (analysisId && currentAnalysisId !== analysisId) {
      console.log('[Board Analyzer] Analysis instance changed in getLastTick - stopping immediately');
      resolve({
        ticks: 0,
        grade: 'F',
        rankPoints: 0,
        completed: false,
        forceStopped: true,
        analysisChanged: true
      });
      return;
    }
    
    // NEW: Check for force stop immediately
    if (forceStop) {
      console.log('Force stop detected in getLastTick - stopping immediately');
      resolve({
        ticks: 0,
        grade: 'F',
        rankPoints: 0,
        completed: false,
        forceStopped: true
      });
      return;
    }
    
    // NEW: Use shared game state tracker instead of creating new subscription
    const tracker = getGameStateTracker();
    
    const listener = (context) => {
      const { currentTick, state, readableGrade, rankPoints } = context;
      
      // NEW: Check if this analysis instance is still valid
      if (analysisId && currentAnalysisId !== analysisId && !hasResolved) {
        console.log('[Board Analyzer] Analysis instance changed during game - stopping immediately');
        hasResolved = true;
        if (unsubscribe) unsubscribe();
        resolve({
          ticks: currentTick,
          grade: readableGrade,
          rankPoints: rankPoints,
          completed: false,
          forceStopped: true,
          analysisChanged: true
        });
        return;
      }
      
      // NEW: Check if analysis state was reset (stop button was clicked)
      if (!isAnalysisRunning && !hasResolved) {
        console.log('[Board Analyzer] Analysis state reset during game - stopping immediately');
        hasResolved = true;
        if (unsubscribe) unsubscribe();
        resolve({
          ticks: currentTick,
          grade: readableGrade,
          rankPoints: rankPoints,
          completed: false,
          forceStopped: true,
          analysisReset: true
        });
        return;
      }
      
      // NEW: Check for force stop on every timer update
      if (forceStop && !hasResolved) {
        console.log('Force stop detected during game - stopping immediately');
        hasResolved = true;
        if (unsubscribe) unsubscribe();
        resolve({
          ticks: currentTick,
          grade: readableGrade,
          rankPoints: rankPoints,
          completed: false,
          forceStopped: true
        });
        return;
      }
      
      // Check for stop conditions
      if (state !== 'initial') {
        // Game completed naturally through state change
        if (!hasResolved) {
          hasResolved = true;
          if (unsubscribe) unsubscribe();
          resolve({
            ticks: currentTick,
            grade: readableGrade,
            rankPoints: rankPoints,
            completed: state === 'victory'
          });
        }
      } else if (config.stopOnSPlus && readableGrade === 'S+') {
        // Stop if we reached S+ grade and that option is enabled
        if (!hasResolved) {
          hasResolved = true;
          // Use direct state manipulation to stop the game
          globalThis.state.board.send({
            type: "setState",
            fn: prevState => ({
              ...prevState,
              gameStarted: false
            })
          });
          if (unsubscribe) unsubscribe();
          resolve({
            ticks: currentTick,
            grade: readableGrade,
            rankPoints: rankPoints,
            completed: true
          });
        }
      } else if (config.stopAfterTicks > 0 && currentTick >= config.stopAfterTicks) {
        // Stop if we reached the tick limit
        if (!hasResolved) {
          hasResolved = true;
          // Use direct state manipulation to stop the game
          globalThis.state.board.send({
            type: "setState",
            fn: prevState => ({
              ...prevState,
              gameStarted: false
            })
          });
          if (unsubscribe) unsubscribe();
          resolve({
            ticks: currentTick,
            grade: readableGrade,
            rankPoints: rankPoints,
            completed: false
          });
        }
      }
    };
    
    // Subscribe to the shared tracker
    unsubscribe = tracker.subscribe(listener);
  });
};

// Analysis state tracker
let isAnalysisRunning = false;
let currentAnalysisId = null;

// Main analyze function
async function analyzeBoard(runs = config.runs, statusCallback = null) {
  // NEW: Prevent multiple analyses from running simultaneously
  if (isAnalysisRunning) {
    console.log('[Board Analyzer] Analysis already running, stopping previous analysis first');
    forceStop = true;
    // Wait a bit for the previous analysis to stop
    await sleep(200);
  }
  
  // NEW: Set analysis state
  isAnalysisRunning = true;
  currentAnalysisId = Date.now();
  const thisAnalysisId = currentAnalysisId;
  
  // Set global state to indicate Board Analyzer is running
  window.__modCoordination.boardAnalyzerRunning = true;
  window.__modCoordination.boardAnalyzerStartTime = Date.now();
  window.__modCoordination.boardAnalyzerEndTime = null;
  
  console.log('[Board Analyzer] Analysis started - other mods should pause');
  
  // Reset force stop flag
  forceStop = false;
  
  // NEW: Clear board serialization cache for fresh analysis
  boardSerializationCache.clear();
  
  // NEW: Disable Turbo Mode button during analysis
  if (window.turboButton) {
    window.turboButton.disabled = true;
    window.turboButton.title = 'Turbo Mode disabled during Board Analysis';
    console.log('[Board Analyzer] Turbo Mode button disabled');
  }
  
  // Reset tracking variables
  currentSeed = null;
  currentRegionId = null;
  currentRoomId = null;
  currentRoomName = null;
  boardSetup = [];
  
  // NEW: Use optimized statistics calculator
  const statsCalculator = new StatisticsCalculator();
  
  // Variables to store best runs
  let bestTimeRun = null;
  let bestScoreRun = null;
  let targetTicksRun = null; // To store the run that reached the target ticks
  
  // Timing variables
  const startTime = performance.now();
  let lastRunStart = 0;
  
  // Ensure sandbox mode
  const modeSwitched = ensureSandboxMode();
  
  // NEW: Preserve Better Highscores container before hiding game board
  if (window.BetterHighscores && typeof window.BetterHighscores.preserveContainer === 'function') {
    try {
      console.log('[Board Analyzer] Preserving Better Highscores container...');
      window.BetterHighscores.preserveContainer();
    } catch (error) {
      console.warn('[Board Analyzer] Error preserving Better Highscores container:', error);
    }
  }
  
  // Hide the game board if configured
  const gameFrame = document.querySelector('main .frame-4');
  if (config.hideGameBoard && gameFrame) {
    gameFrame.style.display = 'none';
  }

  const results = [];

  try {
    // If we just switched to sandbox mode, ensure UI is updated
    if (modeSwitched) {
      await sleep(100);
    }
    
    // Enable turbo mode if configured - do this before starting games
    if (config.enableTurboAutomatically) {
      enableTurbo(config.speedupFactor);
    }

    // Capture current map information
    try {
      const boardContext = globalThis.state.board.getSnapshot().context;
      const selectedMap = boardContext.selectedMap || {};
      
      if (selectedMap.selectedRegion && selectedMap.selectedRegion.id) {
        currentRegionId = selectedMap.selectedRegion.id;
        console.log('Captured region ID:', currentRegionId);
      }
      
      if (selectedMap.selectedRoom) {
        currentRoomId = selectedMap.selectedRoom.id;
        currentRoomName = mapIdsToNames.get(currentRoomId) || 
                           globalThis.state.utils.ROOM_NAME[currentRoomId] || 
                           selectedMap.selectedRoom.file.name;
        console.log('Captured room ID:', currentRoomId, 'Name:', currentRoomName);
      }
    } catch (error) {
      console.error('Error capturing map information:', error);
    }
    
    for (let i = 1; i <= runs; i++) {
      // NEW: Check if this analysis instance is still valid
      if (currentAnalysisId !== thisAnalysisId) {
        console.log('[Board Analyzer] Analysis instance changed, stopping this run');
        break;
      }
      
      // NEW: Check if analysis state was reset (stop button was clicked)
      if (!isAnalysisRunning) {
        console.log('[Board Analyzer] Analysis state reset, stopping this run');
        break;
      }
      
      // Start timing this run
      lastRunStart = performance.now();
      
      // Check if forced stop was requested
      if (forceStop) {
        console.log('Analysis stopped by user - breaking out of loop');
        break;
      }
      
      // NEW: Update status callback if provided
      if (statusCallback && statsCalculator.runTimes.length > 0) {
        // Calculate average run time and estimated time remaining
        const avgRunTime = statsCalculator.runTimesSum / statsCalculator.runTimes.length;
        const remainingRuns = runs - i + 1;
        const estimatedTimeRemaining = avgRunTime * remainingRuns;
        
        statusCallback({
          current: i,
          total: runs,
          status: 'running',
          avgRunTime: avgRunTime.toFixed(0),
          estimatedTimeRemaining: formatMilliseconds(estimatedTimeRemaining)
        });
      } else if (statusCallback) {
        statusCallback({
          current: i,
          total: runs,
          status: 'running'
        });
      }
      
      // Generate a new unique seed for this run
      const runSeed = Math.floor((Date.now() * Math.random()) % 2147483647);
      console.log(`Run ${i} using generated seed: ${runSeed}`);
      
      try {
        // Start the game using direct state manipulation with embedded seed
        globalThis.state.board.send({
          type: "setState",
          fn: prevState => ({
            ...prevState,
            customSandboxSeed: runSeed,
            gameStarted: true
          })
        });
        
        // Wait for game to complete
        const result = await getLastTick(thisAnalysisId);
        
        // NEW: Check if this run was force stopped, analysis changed, or analysis reset
        if (result.forceStopped || result.analysisChanged || result.analysisReset) {
          console.log('Run was force stopped, analysis changed, or analysis reset - breaking out of analysis loop');
          break;
        }
        
        // Add seed to result
        result.seed = runSeed;
        results.push(result);
        
        const { ticks, grade, rankPoints, completed } = result;
        
        // NEW: Use statistics calculator to track stats efficiently
        const runTime = performance.now() - lastRunStart;
        statsCalculator.addRun(result, runTime);
        
        if (completed) {
          // Update min ticks if this is a completed run with lower ticks
          if (ticks < statsCalculator.minTicks) {
            const minTicksResult = {
              ticks,
              grade,
              rankPoints,
              seed: runSeed,
              runIndex: i
            };
            
            // NEW: Use cached board serialization for best time replay
            const boardData = boardSerializationCache.serialize(runSeed);
            
            if (boardData) {
              console.log('Best time: Using cached board serialization');
            } else {
              console.warn('Failed to serialize board for best time replay');
              continue;
            }
            
            bestTimeRun = {
              seed: runSeed,
              board: boardData
            };
            
            console.log(`New best time: ${ticks} ticks with seed ${runSeed} in run ${i}`);
            console.log('Best time board data:', boardData);
          }
        }
        
        if (grade === 'S+') {
          // Check if this S+ run achieved the maximum rank points
          if (rankPoints === statsCalculator.maxRankPoints) {
            // This is handled by the statistics calculator
          }
          // If stopOnSPlus is enabled, we might want to exit early
          if (config.stopOnSPlus) {
            console.log('Achieved S+ grade, stopping analysis early');
            break;
          }
        }
        
        // Check if should stop for reaching the desired number of ticks or below
        if (config.stopWhenTicksReached > 0 && completed && ticks <= config.stopWhenTicksReached) {
          console.log(`Reached target ticks: ${ticks} <= ${config.stopWhenTicksReached}, stopping analysis`);
          
          // NEW: Use cached board serialization for target ticks replay
          const boardData = boardSerializationCache.serialize(runSeed);
          
          if (boardData) {
            console.log('Target ticks: Using cached board serialization');
          } else {
            console.warn('Failed to serialize board for target ticks replay');
            break;
          }
          
          targetTicksRun = {
            seed: runSeed,
            board: boardData,
            ticks: ticks,
            grade: grade,
            rankPoints: rankPoints
          };
          
          console.log(`Target ticks run captured: ${ticks} ticks with seed ${runSeed}`);
          break;
        }
        
        // Update max rank points (handled by statistics calculator, but we need the result object)
        if (rankPoints > statsCalculator.maxRankPoints) {
          const maxRankPointsResult = {
            ticks,
            grade,
            rankPoints,
            seed: runSeed,
            runIndex: i
          };
          
          // NEW: Use cached board serialization for max points replay
          const boardData = boardSerializationCache.serialize(runSeed);
          
          if (boardData) {
            console.log('Max points: Using cached board serialization');
          } else {
            console.warn('Failed to serialize board for max points replay');
            continue;
          }
          
          bestScoreRun = {
            seed: runSeed,
            board: boardData
          };
          
          console.log(`New max points: ${rankPoints} with seed ${runSeed} in run ${i}`);
          console.log('Max points board data:', boardData);
        }
        
        // Check for force stop again
        if (forceStop) {
          console.log('Analysis stopped by user after run completed - breaking out of loop');
          break;
        }
        
        // Stop the game using direct state manipulation
        globalThis.state.board.send({
          type: "setState",
          fn: prevState => ({
            ...prevState,
            gameStarted: false
          })
        });
      } catch (runError) {
        console.error(`Error in run ${i}:`, runError);
        // Try to ensure game is stopped before continuing
        try {
          globalThis.state.board.send({
            type: "setState",
            fn: prevState => ({
              ...prevState,
              gameStarted: false
            })
          });
        } catch (e) {}
      }
      
      // Record the time taken for this run (handled by statistics calculator)
      const runTime = performance.now() - lastRunStart;
      console.log(`Run ${i} took ${runTime.toFixed(2)}ms`);
      
      // Brief pause between runs to ensure clean state
      await sleep(1);
    }
  } catch (error) {
    console.error('Error during analysis:', error);
    throw error;
  } finally {
    // NEW: Use the proper board restoration function (includes global state reset)
    restoreBoardState();
    
    // Disable turbo mode if it was enabled
    if (config.enableTurboAutomatically && turboActive) {
      disableTurbo();
    }
    
    // NEW: Reset analysis state
    if (currentAnalysisId === thisAnalysisId) {
      isAnalysisRunning = false;
      currentAnalysisId = null;
      console.log('[Board Analyzer] Analysis state reset');
    }
    
    // NEW: Clean up game state tracker if no more listeners
    if (gameStateTracker && gameStateTracker.listeners.size === 0) {
      gameStateTracker.stopSubscription();
      gameStateTracker = null;
      console.log('[Board Analyzer] Game state tracker cleaned up');
    }
    
    // NEW: Clear board serialization cache
    boardSerializationCache.clear();
    console.log('[Board Analyzer] Board serialization cache cleared');
    
    // NEW: Re-enable Turbo Mode button after analysis
    if (window.turboButton) {
      window.turboButton.disabled = false;
      window.turboButton.title = '';
      console.log('[Board Analyzer] Turbo Mode button re-enabled');
    }
  }

  // NEW: Use optimized statistics calculator
  const totalTime = performance.now() - startTime;
  const stats = statsCalculator.calculateStatistics();
  
  return {
    results,
    summary: {
      runs,
      totalRuns: stats.totalRuns,
      completedRuns: stats.completedRuns,
      sPlusCount: stats.sPlusCount,
      sPlusMaxPointsCount: stats.sPlusMaxPointsCount,
      sPlusRate: stats.sPlusRate,
      completionRate: stats.completionRate,
      minTicks: stats.minTicks,
      maxTicks: stats.maxTicks,
      medianTicks: stats.medianTicks,
      averageTicks: stats.averageTicks,
      maxRankPoints: stats.maxRankPoints,
      forceStopped: forceStop,
      modeSwitched,
      bestTimeResult: bestTimeRun,
      maxPointsResult: bestScoreRun,
      targetTicksResult: targetTicksRun,
      // Timing stats
      totalTimeMs: totalTime,
      totalTimeFormatted: formatMilliseconds(totalTime),
      averageRunTimeMs: stats.averageRunTime,
      averageRunTimeFormatted: formatMilliseconds(stats.averageRunTime),
      fastestRunTimeMs: stats.fastestRunTime,
      slowestRunTimeMs: stats.slowestRunTime
    }
  };
}

// Function to format milliseconds into a readable string
function formatMilliseconds(ms) {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}

// Create replay data in the required format
function createReplayData(seed = null) {
  try {
    // NEW: Use cached board serialization
    const boardData = boardSerializationCache.serialize(seed);
    
    if (!boardData) {
      console.error('Failed to serialize board data');
      return null;
    }
    
    console.log('Used cached board serialization for replay data');
    
    // Log the serialized data to see what we got
    console.log('Serialized board data:', boardData);
    
    // Verify that we have required fields
    if (!boardData.region || !boardData.map) {
      console.warn('Missing region or map in board data');
    }
    
    // Verify that monster and equipment names are included
    if (boardData.board && boardData.board.length > 0) {
      const firstPiece = boardData.board[0];
      if (!firstPiece.monster.name || !firstPiece.equipment.name) {
        console.warn('Monster or equipment names are missing in board data');
      }
    }
    
    // Add the seed if provided
    if (seed) {
      boardData.seed = seed;
    } else if (currentSeed) {
      boardData.seed = currentSeed;
    }
    
    return boardData;
  } catch (error) {
    console.error('Error creating replay data:', error);
    return null;
  }
}

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

// Function to create a copy button for replay data
function createCopyReplayButton(replayData) {
  if (!replayData || !replayData.board || replayData.board.length === 0) {
    return null;
  }
  
  // Use the exact format with $replay to match the expected output
  const replayText = `$replay(${JSON.stringify(replayData)})`;
  
  const button = document.createElement('button');
  button.textContent = t('copyReplayButton');
  button.style.cssText = `
    background-color: #3498db;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 5px;
    font-size: 12px;
    width: 100%;
    display: block;
  `;
  
  button.addEventListener('click', () => {
    const success = copyToClipboard(replayText);
    if (success) {
      const originalText = button.textContent;
      button.textContent = t('replayCopiedMessage');
      button.style.backgroundColor = '#2ecc71';
      setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = '#3498db';
      }, 2000);
    }
  });
  
  return button;
}

// Create the configuration panel UI
function createConfigPanel(startAnalysisCallback) {
  const content = document.createElement('div');
  content.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

  // Runs input
  const runsContainer = document.createElement('div');
  runsContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
  
  const runsLabel = document.createElement('label');
  runsLabel.textContent = t('runsLabel');
  
  const runsInput = document.createElement('input');
  runsInput.type = 'number';
  runsInput.id = 'runs-input';
  runsInput.min = '1';
  runsInput.max = '1000';
  runsInput.value = config.runs;
  runsInput.style.cssText = 'width: 80px; text-align: center;';
  
  runsContainer.appendChild(runsLabel);
  runsContainer.appendChild(runsInput);
  content.appendChild(runsContainer); 

  // Speed factor input
  const speedContainer = document.createElement('div');
  speedContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
  
  const speedLabel = document.createElement('label');
  speedLabel.textContent = t('speedFactorLabel');
  
  const speedInput = document.createElement('input');
  speedInput.type = 'number';
  speedInput.id = 'speed-input';
  speedInput.min = '1';
  speedInput.max = '10000';
  speedInput.value = config.speedupFactor;
  speedInput.style.cssText = 'width: 80px; text-align: center;';
  
  speedContainer.appendChild(speedLabel);
  speedContainer.appendChild(speedInput);
  content.appendChild(speedContainer);

  // Hide game board checkbox
  const hideContainer = document.createElement('div');
  hideContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  
  const hideInput = document.createElement('input');
  hideInput.type = 'checkbox';
  hideInput.id = 'hide-input';
  hideInput.checked = config.hideGameBoard;
  
  const hideLabel = document.createElement('label');
  hideLabel.htmlFor = 'hide-input';
  hideLabel.textContent = t('hideGameBoardLabel');
  
  hideContainer.appendChild(hideInput);
  hideContainer.appendChild(hideLabel);
  content.appendChild(hideContainer);

  // Auto-turbo checkbox
  const turboContainer = document.createElement('div');
  turboContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  
  const turboInput = document.createElement('input');
  turboInput.type = 'checkbox';
  turboInput.id = 'turbo-input';
  turboInput.checked = config.enableTurboAutomatically;
  
  const turboLabel = document.createElement('label');
  turboLabel.htmlFor = 'turbo-input';
  turboLabel.textContent = t('autoTurboLabel');
  
  turboContainer.appendChild(turboInput);
  turboContainer.appendChild(turboLabel);
  content.appendChild(turboContainer);

  // Stop on S+ checkbox
  const stopSPlusContainer = document.createElement('div');
  stopSPlusContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  
  const stopSPlusInput = document.createElement('input');
  stopSPlusInput.type = 'checkbox';
  stopSPlusInput.id = 'stop-splus-input';
  stopSPlusInput.checked = config.stopOnSPlus;
  
  const stopSPlusLabel = document.createElement('label');
  stopSPlusLabel.htmlFor = 'stop-splus-input';
  stopSPlusLabel.textContent = t('stopOnSPlusLabel');
  
  stopSPlusContainer.appendChild(stopSPlusInput);
  stopSPlusContainer.appendChild(stopSPlusLabel);
  content.appendChild(stopSPlusContainer);

  // Stop after ticks input
  const stopTicksContainer = document.createElement('div');
  stopTicksContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
  
  const stopTicksLabel = document.createElement('label');
  stopTicksLabel.textContent = t('stopAfterTicksLabel');
  
  const stopTicksInput = document.createElement('input');
  stopTicksInput.type = 'number';
  stopTicksInput.id = 'stop-ticks-input';
  stopTicksInput.min = '0';
  stopTicksInput.max = '10000';
  stopTicksInput.value = config.stopAfterTicks;
  stopTicksInput.style.cssText = 'width: 80px; text-align: center;';
  
  stopTicksContainer.appendChild(stopTicksLabel);
  stopTicksContainer.appendChild(stopTicksInput);
  content.appendChild(stopTicksContainer);

  // Stop when ticks reached input
  const stopWhenTicksContainer = document.createElement('div');
  stopWhenTicksContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

  const stopWhenTicksLabel = document.createElement('label');
  stopWhenTicksLabel.textContent = t('stopWhenTicksReachedLabel');

  const stopWhenTicksInput = document.createElement('input');
  stopWhenTicksInput.type = 'number';
  stopWhenTicksInput.id = 'stop-when-ticks-input';
  stopWhenTicksInput.min = '0';
  stopWhenTicksInput.max = '10000';
  stopWhenTicksInput.value = config.stopWhenTicksReached;
  stopWhenTicksInput.style.cssText = 'width: 80px; text-align: center;';

  stopWhenTicksContainer.appendChild(stopWhenTicksLabel);
  stopWhenTicksContainer.appendChild(stopWhenTicksInput);
  content.appendChild(stopWhenTicksContainer);

  // Create buttons array
  const buttons = [
    {
      text: t('startAnalysisButton'),
      primary: true,
      onClick: () => {
        // NEW: Check if analysis is already running
        if (isAnalysisRunning) {
          console.log('[Board Analyzer] Analysis already running, cannot start new analysis');
          return;
        }
        
        // Update configuration with form values
        updateConfig();
        
        // Close the config panel
        if (activeConfigPanel) {
          try {
            api.ui.hideAllConfigPanels();
          } catch (e) {
            console.error('Failed to hide config panels:', e);
          }
        }
        
        // Start the analysis with the updated config
        if (startAnalysisCallback) {
          startAnalysisCallback();
        }
      }
    },
    {
      text: t('saveButton'),
      primary: false,
      onClick: () => {
        // Just update and save configuration
        updateConfig();
      }
    },
    {
      text: t('cancelButton'),
      primary: false
    }
  ];

  // Helper function to update config from form values
  function updateConfig() {
    // Update configuration with form values
    config.runs = parseInt(document.getElementById('runs-input').value, 10);
    config.speedupFactor = parseInt(document.getElementById('speed-input').value, 10);
    config.hideGameBoard = document.getElementById('hide-input').checked;
    config.enableTurboAutomatically = document.getElementById('turbo-input').checked;
    config.stopOnSPlus = document.getElementById('stop-splus-input').checked;
    config.stopAfterTicks = parseInt(document.getElementById('stop-ticks-input').value, 10);
    config.stopWhenTicksReached = parseInt(document.getElementById('stop-when-ticks-input').value, 10);
    
    // Save configuration
    api.service.updateScriptConfig(context.hash, config);
  }

  // Create and return the config panel
  const panel = api.ui.createConfigPanel({
    id: CONFIG_PANEL_ID,
    title: t('configTitle'),
    modId: MOD_ID,
    content: content,
    buttons: buttons
  });
  
  // NEW: Register config panel with registry
  panel.type = 'config';
  modalRegistry.register(panel);
  
  activeConfigPanel = panel;
  return panel;
}

// Add a global function to forcefully close all analysis modals
function forceCloseAllModals() {
  console.log("Closing all registered modals...");
  modalRegistry.closeAll();
}

// Call this function when starting a new analysis
function showRunningAnalysisModal(currentRun, totalRuns, avgRunTime = null, estimatedTimeRemaining = null) {
  // First, force close any existing modals
  forceCloseAllModals();
  
  const content = document.createElement('div');
  content.style.cssText = 'text-align: center;';
  
  const message = document.createElement('p');
  message.textContent = t('runningText');
  content.appendChild(message);
  
  const progress = document.createElement('p');
  progress.id = 'analysis-progress';
  progress.textContent = t('progressText')
    .replace('{current}', currentRun)
    .replace('{total}', totalRuns);
  progress.style.cssText = 'margin-top: 12px;';
  content.appendChild(progress);
  
  // Add timing information if available
  if (avgRunTime) {
    const timingInfo = document.createElement('p');
    timingInfo.id = 'analysis-timing';
    timingInfo.style.cssText = 'margin-top: 8px; font-size: 0.9em; color: #aaa;';
    timingInfo.textContent = `${t('avgRunTimeLabel')} ${avgRunTime}ms`;
    
    if (estimatedTimeRemaining) {
      timingInfo.textContent += ` • ${t('estimatedTimeRemainingLabel')} ${estimatedTimeRemaining}`;
    }
    
    content.appendChild(timingInfo);
  }
  
  const modal = api.ui.components.createModal({
    title: t('runningTitle'),
    content: content,
    buttons: [
      {
        text: t('forceStopButton'),
        primary: false,
        onClick: () => {
          // Reset analysis state - this will stop everything immediately
          isAnalysisRunning = false;
          currentAnalysisId = null;
          forceStop = true;
          
          // NEW: Re-enable Turbo Mode button when stopping
          if (window.turboButton) {
            window.turboButton.disabled = false;
            window.turboButton.title = '';
            console.log('[Board Analyzer] Turbo Mode button re-enabled (stop)');
          }
          
          // Update UI
          const progressEl = document.getElementById('analysis-progress');
          if (progressEl) {
            progressEl.textContent += ' - Stopping...';
            progressEl.style.color = '#e74c3c';
          }
          
          const stopButton = event.target;
          if (stopButton) {
            stopButton.disabled = true;
            stopButton.textContent = 'Stopping...';
          }
          
          console.log('Stop Analysis clicked - analysis will stop immediately');
        }
      }
    ]
  });
  
  // NEW: Register modal with registry for efficient management
  modal.type = 'running';
  modalRegistry.register(modal);
  
  // Add a special identifier to the running modal
  if (modal && modal.element) {
    modal.element.id = 'board-analyzer-running-modal';
    modal.element.dataset.analyzerModal = 'running';
    
    // Add class to identify it easily
    if (modal.element.classList) {
      modal.element.classList.add('board-analyzer-modal');
    }
  }
  
  activeRunningModal = modal;
  return modal;
}

// Show the analysis results modal
function showResultsModal(results) {
  // Force close ALL modals before showing results
  forceCloseAllModals();
  
  // Small delay to ensure UI is clean
  setTimeout(() => {
    const content = document.createElement('div');
    
    // Add a partial results note if the analysis was forcefully stopped
    if (results.summary.forceStopped) {
      const partialNote = document.createElement('div');
      partialNote.textContent = t('partialResultsNote');
      partialNote.style.cssText = 'text-align: center; color: #e74c3c; margin-bottom: 15px;';
      content.appendChild(partialNote);
    }
    
    // Indicate if the mode was switched to sandbox
    if (results.summary.modeSwitched) {
      const sandboxNote = document.createElement('div');
      sandboxNote.textContent = t('sandboxModeEnabled');
      sandboxNote.style.cssText = 'text-align: center; color: #3498db; margin-bottom: 15px;';
      content.appendChild(sandboxNote);
    }
    
    // Create result statistics
    const statsContainer = document.createElement('div');
    statsContainer.style.cssText = 'display: grid; grid-template-columns: 130px auto; gap: 10px; margin-bottom: 20px;';
    
    // S+ Rate
    const sPlusRateLabel = document.createElement('div');
    sPlusRateLabel.textContent = t('sPlusRateLabel');
    sPlusRateLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    const sPlusRateValue = document.createElement('div');
    sPlusRateValue.textContent = `${results.summary.sPlusRate}% (${results.summary.sPlusCount}/${results.summary.totalRuns})`;
    sPlusRateValue.style.cssText = 'text-align: right; color: #FFD700;';
    
    // Create S+ rate lines for each unique rank point
    const sPlusRateElements = [];
    
    if (results.summary.sPlusCount > 0) {
      // Get all S+ runs and group by rank points
      const sPlusResults = results.results.filter(r => r.grade === 'S+');
      const rankPointsCounts = {};
      
      sPlusResults.forEach(r => {
        rankPointsCounts[r.rankPoints] = (rankPointsCounts[r.rankPoints] || 0) + 1;
      });
      
      // Sort rank points from highest to lowest
      const sortedRankPoints = Object.keys(rankPointsCounts)
        .map(points => parseInt(points))
        .sort((a, b) => b - a);
      
      // Create a line for each rank point
      sortedRankPoints.forEach(rankPoints => {
        const count = rankPointsCounts[rankPoints];
        const rate = results.summary.totalRuns > 0 ? 
          (count / results.summary.totalRuns * 100).toFixed(2) : '0.00';
        
        const label = document.createElement('div');
        label.textContent = rankPoints === results.summary.maxRankPoints ? 
          t('sPlusMaxPointsRateLabel').replace('{points}', rankPoints) : 
          `S+${rankPoints} Rate:`;
        label.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 10px; font-style: italic;';
        
        const value = document.createElement('div');
        value.textContent = `${rate}% (${count}/${results.summary.totalRuns})`;
        
        // Color the S+ rate text based on rank points to match chart colors
        // The highest rank points gets the brightest yellow, descending ranks get lighter shades
        let textColor;
        const highestRankPoints = sortedRankPoints[0];
        const rankDifference = highestRankPoints - rankPoints;
        
        switch (rankDifference) {
          case 0: textColor = '#FFD700'; break; // Bright gold for highest rank points
          case 1: textColor = '#FFA500'; break; // Orange for second highest
          case 2: textColor = '#FF8C00'; break; // Dark orange for third highest
          case 3: textColor = '#FF6347'; break; // Tomato for fourth highest
          case 4: textColor = '#FF4500'; break; // Orange red for fifth highest
          case 5: textColor = '#FF0000'; break; // Red for sixth highest
          case 6: textColor = '#DC143C'; break; // Crimson for seventh highest
          case 7: textColor = '#8B0000'; break; // Dark red for eighth highest
          default: textColor = '#FFD700'; break; // Default gold for unknown rank differences
        }
        
        value.style.cssText = `text-align: right; color: ${textColor}; font-style: italic;`;
        
        sPlusRateElements.push({ label, value });
      });
    }
    
    // Completion Rate
    const completionRateLabel = document.createElement('div');
    completionRateLabel.textContent = t('completionRateLabel');
    completionRateLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    const completionRateValue = document.createElement('div');
    completionRateValue.textContent = `${results.summary.completionRate}% (${results.summary.completedRuns}/${results.summary.totalRuns})`;
    completionRateValue.style.cssText = 'text-align: right; color: green;';
    
    // Best Time (Min Time)
    const minTimeLabel = document.createElement('div');
    minTimeLabel.textContent = t('minTimeLabel');
    minTimeLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    const minTimeValue = document.createElement('div');
    minTimeValue.textContent = `${results.summary.minTicks} ${t('ticksSuffix')}`;
    minTimeValue.style.cssText = 'text-align: right;';
    
    // Max Time
    const maxTimeLabel = document.createElement('div');
    maxTimeLabel.textContent = t('maxTimeLabel');
    maxTimeLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    const maxTimeValue = document.createElement('div');
    maxTimeValue.textContent = `${results.summary.maxTicks} ${t('ticksSuffix')}`;
    maxTimeValue.style.cssText = 'text-align: right;';
    
    // Median Time
    const medianTimeLabel = document.createElement('div');
    medianTimeLabel.textContent = t('medianTimeLabel');
    medianTimeLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    const medianTimeValue = document.createElement('div');
    medianTimeValue.textContent = `${results.summary.medianTicks} ${t('ticksSuffix')}`;
    medianTimeValue.style.cssText = 'text-align: right;';
    
    // Max Rank Points - Removed as redundant since we show S+ breakdown above
    
    // Add timing information
    
    // Total time
    const totalTimeLabel = document.createElement('div');
    totalTimeLabel.textContent = t('totalTimeLabel') || 'Total Time:';
    totalTimeLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    const totalTimeValue = document.createElement('div');
    totalTimeValue.textContent = results.summary.totalTimeFormatted;
    totalTimeValue.style.cssText = 'text-align: right;';
    
    // Average run time
    const avgRunTimeLabel = document.createElement('div');
    avgRunTimeLabel.textContent = t('avgRunTimeLabel') || 'Avg Run Time:';
    avgRunTimeLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    const avgRunTimeValue = document.createElement('div');
    avgRunTimeValue.textContent = results.summary.averageRunTimeFormatted;
    avgRunTimeValue.style.cssText = 'text-align: right;';
    
    // Add all stats to the container
    statsContainer.appendChild(sPlusRateLabel);
    statsContainer.appendChild(sPlusRateValue);
    
    // Add all S+ rate lines
    sPlusRateElements.forEach(({ label, value }) => {
      statsContainer.appendChild(label);
      statsContainer.appendChild(value);
    });
    
    statsContainer.appendChild(completionRateLabel);
    statsContainer.appendChild(completionRateValue);
    statsContainer.appendChild(minTimeLabel);
    statsContainer.appendChild(minTimeValue);
    statsContainer.appendChild(maxTimeLabel);
    statsContainer.appendChild(maxTimeValue);
    statsContainer.appendChild(medianTimeLabel);
    statsContainer.appendChild(medianTimeValue);
    
    // Add timing stats
    statsContainer.appendChild(document.createElement('hr'));
    statsContainer.appendChild(document.createElement('hr'));
    statsContainer.appendChild(totalTimeLabel);
    statsContainer.appendChild(totalTimeValue);
    statsContainer.appendChild(avgRunTimeLabel);
    statsContainer.appendChild(avgRunTimeValue);
    
    // Add the stats container to the content
    content.appendChild(statsContainer);
    
    // Check if we have valid replay data for target ticks
    const hasTargetTicksReplay = results.summary.targetTicksResult && results.summary.targetTicksResult.board;
    
    // Add target ticks replay button if available (only useful replay button)
    if (hasTargetTicksReplay) {
      const copyTargetTicksButton = document.createElement('button');
      copyTargetTicksButton.textContent = t('copyTargetTicksReplayButton');
      copyTargetTicksButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
      copyTargetTicksButton.style.cssText = 'width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 20px;';
      
      // Add click handler
      copyTargetTicksButton.addEventListener('click', () => {
        // Get the board data
        const replayData = results.summary.targetTicksResult.board;
        
        // Verify and fix the replay data format
        if (!verifyAndFixReplayData(replayData)) {
          api.ui.components.createModal({
            title: 'Error',
            content: 'Failed to create replay data. The board configuration may be incomplete.',
            buttons: [{ text: 'OK', primary: true }]
          });
          return;
        }
        
        // Create the $replay formatted string
        const replayText = `$replay(${JSON.stringify(replayData)})`;
        
        // Log for debugging
        console.log('Target ticks replay text:', replayText);
        
        // Copy to clipboard
        const success = copyToClipboard(replayText);
        if (success) {
          const originalText = copyTargetTicksButton.textContent;
          copyTargetTicksButton.textContent = t('replayCopiedMessage');
          setTimeout(() => {
            copyTargetTicksButton.textContent = originalText;
          }, 2000);
        }
      });
      
      // Add the button directly to content
      content.appendChild(copyTargetTicksButton);
    }
    
    // Only show chart if there are results
    if (results.results.length > 0) {
      // Create a chart visualization
      const chartContainer = document.createElement('div');
      chartContainer.style.cssText = 'margin-top: 20px; border: 1px solid #333; padding: 10px; height: 200px; position: relative; overflow: hidden;';
      
      // Add note about clickable bars above the chart
      const chartClickableNote = document.createElement('div');
      chartClickableNote.textContent = '💡 Tip: Click on any bar in the chart below to copy replay data for that specific run';
      chartClickableNote.style.cssText = 'text-align: center; color: #3498db; margin-bottom: 15px; font-size: 0.9em; font-weight: 500;';
      content.appendChild(chartClickableNote);
      
      // Create sorting buttons container
      const sortButtonsContainer = document.createElement('div');
      sortButtonsContainer.style.cssText = 'display: flex; gap: 5px; margin-bottom: 10px; justify-content: center;';
      
      // Create sorting buttons
      const createSortButton = (text, sortType) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
        button.style.cssText = 'flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px;';
        
        // Set first button as active by default
        if (sortType === 'runs') {
          button.style.backgroundColor = '#4a5';
        }
        
        button.addEventListener('click', () => {
          // Update button styles
          sortButtonsContainer.querySelectorAll('button').forEach(btn => {
            btn.style.backgroundColor = '';
          });
          button.style.backgroundColor = '#4a5';
          
          // Sort and redraw chart
          sortAndRedrawChart(sortType);
        });
        
        return button;
      };
      
      const allRunsButton = createSortButton('All Runs', 'runs');
      const minTimeButton = createSortButton('Min Time', 'time');
      const sPlusRanksButton = createSortButton('S+ Ranks', 'splus');
      
      sortButtonsContainer.appendChild(allRunsButton);
      sortButtonsContainer.appendChild(minTimeButton);
      sortButtonsContainer.appendChild(sPlusRanksButton);
      
      chartContainer.appendChild(sortButtonsContainer);
      
      // Create chart bars container
      const barsContainer = document.createElement('div');
      barsContainer.style.cssText = 'height: 150px; position: relative;';
      chartContainer.appendChild(barsContainer);
      
      // Use all results for the chart
      const displayResults = results.results;
      
      // Calculate bar width and total chart width
      const spacing = 4; // Spacing between bars
      const barWidth = 8; // Fixed bar width for consistent appearance
      const totalChartWidth = displayResults.length * (barWidth + spacing) - spacing; // Total width needed for all bars
      
      // Set the bars container to accommodate all bars
      barsContainer.style.cssText = `height: 150px; position: relative; width: ${totalChartWidth}px;`;
      
      // Create a scrollable wrapper
      const scrollWrapper = document.createElement('div');
      scrollWrapper.style.cssText = `
        width: 246px; 
        height: 150px; 
        overflow-x: auto; 
        overflow-y: hidden;
        border: 1px solid #555;
        border-radius: 4px;
        position: relative;
        padding-left: 2px;
        padding-right: 2px;
      `;
      
      // Replace the bars container in the scroll wrapper
      chartContainer.removeChild(barsContainer);
      scrollWrapper.appendChild(barsContainer);
      chartContainer.appendChild(scrollWrapper);
      
      // Ensure the bars container is properly sized for scrolling
      barsContainer.style.cssText = `height: 150px; position: relative; width: ${totalChartWidth}px;`;
      
      // Function to sort and redraw chart
      const sortAndRedrawChart = (sortType) => {
        // Clear existing bars
        barsContainer.innerHTML = '';
        
        let sortedResults;
        switch (sortType) {
          case 'runs':
            // Sort by run order (original order)
            sortedResults = [...displayResults];
            break;
          case 'time':
            // Sort by ticks (ascending - fastest first)
            sortedResults = [...displayResults].sort((a, b) => a.ticks - b.ticks);
            break;
          case 'splus':
            // Sort by grade hierarchy (S+ → S → A → B → C...), then by ticks, then by run order
            sortedResults = [...displayResults].sort((a, b) => {
              // First priority: S+ grades come before all other grades
              if (a.grade === 'S+' && b.grade !== 'S+') return -1;
              if (a.grade !== 'S+' && b.grade === 'S+') return 1;
              
              // Second priority: Among S+ grades, sort by rank points (descending - highest first)
              if (a.grade === 'S+' && b.grade === 'S+') {
                const rankDiff = (b.rankPoints || 0) - (a.rankPoints || 0);
                if (rankDiff !== 0) return rankDiff;
              }
              
              // Third priority: Among non-S+ grades, sort by grade hierarchy (S → A → B → C...)
              if (a.grade !== 'S+' && b.grade !== 'S+') {
                const gradeOrder = { 'S': 1, 'A': 2, 'B': 3, 'C': 4, 'D': 5, 'E': 6, 'F': 7 };
                const aGradeOrder = gradeOrder[a.grade] || 999;
                const bGradeOrder = gradeOrder[b.grade] || 999;
                
                if (aGradeOrder !== bGradeOrder) {
                  return aGradeOrder - bGradeOrder;
                }
              }
              
              // Fourth priority: ticks (fastest first)
              const tickDiff = a.ticks - b.ticks;
              if (tickDiff !== 0) return tickDiff;
              
              // Fifth priority: run order (earliest first)
              return results.results.indexOf(a) - results.results.indexOf(b);
            });
            break;
          default:
            sortedResults = [...displayResults];
          }
        
        // Find the maximum tick value for proper scaling
        const maxTicks = Math.max(...sortedResults.map(r => r.ticks));
        
        // Create bars
        sortedResults.forEach((result, index) => {
          const bar = document.createElement('div');
          const height = Math.max(10, Math.floor((result.ticks / maxTicks) * 120));
          
          // Determine bar color based on grade and rank points
          let barColor;
          if (result.completed) {
            if (result.grade === 'S+' && result.rankPoints) {
              // Calculate the highest rank points dynamically for this run
              const sPlusResults = displayResults.filter(r => r.grade === 'S+' && r.rankPoints);
              const highestRankPoints = sPlusResults.length > 0 ? 
                Math.max(...sPlusResults.map(r => r.rankPoints)) : 0;
              
              // Different shades of yellow based on rank difference from highest
              const rankDifference = highestRankPoints - result.rankPoints;
              
              switch (rankDifference) {
                case 0: barColor = '#FFD700'; break; // Bright gold for highest rank points
                case 1: barColor = '#FFA500'; break; // Orange for second highest
                case 2: barColor = '#FF8C00'; break; // Dark orange for third highest
                case 3: barColor = '#FF6347'; break; // Tomato for fourth highest
                case 4: barColor = '#FF4500'; break; // Orange red for fifth highest
                case 5: barColor = '#FF0000'; break; // Red for sixth highest
                case 6: barColor = '#DC143C'; break; // Crimson for seventh highest
                case 7: barColor = '#8B0000'; break; // Dark red for eighth highest
                default: barColor = '#FFD700'; break; // Default gold for unknown rank differences
              }
            } else if (result.grade === 'S+') {
              barColor = '#FFD700'; // Default gold for S+ without rank points
            } else {
              barColor = '#4CAF50'; // Green for other completed grades
            }
          } else {
            barColor = '#e74c3c'; // Red for failed runs
          }
          
          bar.style.cssText = `
            position: absolute;
            bottom: 0;
            left: ${index * (barWidth + spacing)}px;
            width: ${barWidth}px;
            height: ${height}px;
            background-color: ${barColor};
            transition: height 0.3s ease;
            cursor: pointer;
            border: 1px solid transparent;
          `;
          
          // Add hover effects
          bar.addEventListener('mouseenter', () => {
            bar.style.border = '1px solid white';
            bar.style.transform = 'scale(1.1)';
          });
          
          bar.addEventListener('mouseleave', () => {
            bar.style.border = '1px solid transparent';
            bar.style.transform = 'scale(1)';
          });
          
          // Add tooltip on hover
          let tooltipText = `Run ${results.results.indexOf(result) + 1}: ${result.ticks} ticks, Grade: `;
          
          // Show S+ with rank points directly in the grade
          if (result.grade === 'S+' && result.rankPoints) {
            tooltipText += `S+${result.rankPoints}`;
          } else {
            tooltipText += result.grade;
          }
          
          tooltipText += `, ${result.completed ? 'Completed' : 'Failed'}`;
          if (result.seed) {
            tooltipText += `, Seed: ${result.seed}`;
          }
          tooltipText += '\nClick to copy replay data';
          bar.title = tooltipText;
          
          // Add click handler to copy replay data for this specific run
          bar.addEventListener('click', () => {
            // Create replay data for this specific run
            const replayData = createReplayDataForRun(result);
            
            if (replayData) {
              // Create the $replay formatted string
              const replayText = `$replay(${JSON.stringify(replayData)})`;
              
              // Copy to clipboard
              const success = copyToClipboard(replayText);
              
              if (success) {
                // Show visual feedback
                const originalBorder = bar.style.border;
                
                bar.style.border = '2px solid white';
                
                // Reset after 2 seconds
                setTimeout(() => {
                  bar.style.border = originalBorder;
                }, 2000);
                
                // Show a brief notification
                showCopyNotification(`Copied run ${results.results.indexOf(result) + 1} replay data!`);
              } else {
                showCopyNotification('Failed to copy replay data', true);
              }
            } else {
              showCopyNotification('Failed to create replay data for this run', true);
            }
          });
          
          barsContainer.appendChild(bar);
        });
        
        // Reset scroll position to left when sorting
        scrollWrapper.scrollLeft = 0;
      };
      
      // Initial chart draw
      sortAndRedrawChart('runs');
      
      // Add note about clickable bars
      const clickableNote = document.createElement('div');
      clickableNote.textContent = '💡 Click on any bar to copy replay data for that specific run';
      clickableNote.style.cssText = 'text-align: center; color: #aaa; font-size: 0.9em; margin-top: 10px; font-style: italic;';
      chartContainer.appendChild(clickableNote);
      
      // No need for limit note since we show all runs with scrollbar
      
      content.appendChild(chartContainer);
    } else {
      // Show a message if no results
      const noResultsMessage = document.createElement('p');
      noResultsMessage.textContent = 'No runs completed yet.';
      noResultsMessage.style.cssText = 'text-align: center; color: #777; margin-top: 15px;';
      content.appendChild(noResultsMessage);
    }
    
    // Show the results modal with a callback to clean up when closed
    const resultsModal = api.ui.components.createModal({
      title: t('resultTitle'),
      width: 400,
      content: content,
      buttons: [
        {
          text: t('closeButton'),
          primary: true,
          onClick: () => {
            // One more check for lingering modals when user closes results
            forceCloseAllModals();
          }
        }
      ]
    });
    
    // NEW: Register results modal with registry
    resultsModal.type = 'results';
    modalRegistry.register(resultsModal);
    
    return resultsModal;
  }, 100);
}

// Function to verify and fix replay data to ensure it has all required fields
function verifyAndFixReplayData(replayData) {
  if (!replayData) {
    console.error('Replay data is null or undefined');
    return false;
  }
  
  // Must have region, map and board
  if (!replayData.region || !replayData.map || !replayData.board) {
    console.error('Replay data missing required fields:', replayData);
    return false;
  }
  
  // Must have at least one piece
  if (!Array.isArray(replayData.board) || replayData.board.length === 0) {
    console.error('Replay data has no board pieces');
    return false;
  }
  
  // Check each piece for required fields
  for (const piece of replayData.board) {
    // Must have tile
    if (typeof piece.tile !== 'number') {
      console.error('Board piece missing tile:', piece);
      return false;
    }
    
    // Must have monster with name and stats
    if (!piece.monster || typeof piece.monster !== 'object') {
      console.error('Board piece missing monster:', piece);
      return false;
    }
    
    // If monster is missing name, try to get it using the utility maps
    if (!piece.monster.name) {
      console.warn('Piece monster missing name, attempting to fix:', piece);
      // This is a complex issue requiring knowledge of the monster ID which we don't have
      return false;
    }
    
    // Check all required monster stats
    const requiredStats = ['hp', 'ad', 'ap', 'armor', 'magicResist'];
    for (const stat of requiredStats) {
      if (typeof piece.monster[stat] !== 'number') {
        console.error(`Monster missing ${stat}:`, piece.monster);
        return false;
      }
    }
    
    // Equipment is optional now - only validate if it exists
    if (piece.equipment) {
      // If equipment exists but is missing name, it's invalid
      if (!piece.equipment.name) {
        console.warn('Piece equipment missing name:', piece);
        delete piece.equipment; // Remove invalid equipment
        continue;
      }
      
      // Check required equipment fields if equipment exists
      if (!piece.equipment.stat) {
        console.warn('Equipment missing stat, using default "ad":', piece.equipment);
        piece.equipment.stat = "ad"; // Apply default
      }
      
      if (typeof piece.equipment.tier !== 'number') {
        console.warn('Equipment missing tier, using default 1:', piece.equipment);
        piece.equipment.tier = 1; // Apply default
      }
    }
  }
  
  return true;
}

// Function to create replay data for a specific run
function createReplayDataForRun(runResult) {
  try {
    // NEW: Use cached board serialization
    const boardData = boardSerializationCache.serialize(runResult.seed);
    
    if (!boardData) {
      console.error('Failed to serialize board for run replay data');
      return null;
    }
    
    console.log('Using cached board serialization for run replay data');
    
    // Verify the replay data is valid
    if (!verifyAndFixReplayData(boardData)) {
      console.error('Failed to create valid replay data for run:', runResult);
      return null;
    }
    
    return boardData;
  } catch (error) {
    console.error('Error creating replay data for run:', error);
    return null;
  }
}

// Function to show copy notification
function showCopyNotification(message, isError = false) {
  // Create notification element
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: ${isError ? '#e74c3c' : '#2ecc71'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  // Add to document
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// Show the configuration modal and prepare for analysis
function showConfigAndPrepareAnalysis() {
  // Create the configuration panel with a callback
  createConfigPanel(() => {
    // This function will be called when the Start Analysis button is clicked
    runAnalysis();
  });
  
  // Show the configuration panel
  api.ui.toggleConfigPanel(CONFIG_PANEL_ID);
}

// Main entry point - Run the analysis
async function runAnalysis() {
  // NEW: Check if analysis is already running
  if (isAnalysisRunning) {
    console.log('[Board Analyzer] Analysis already running, cannot start new analysis');
    return;
  }
  
  // Check if Turbo Mode mod is enabled and disable it before analysis
  if (window.__turboState && window.__turboState.active) {
    console.log('Turbo Mode mod is currently enabled, disabling it before analysis...');
    
    // Try to disable Turbo Mode using the exported function if available
    if (window.__turboState.disable && typeof window.__turboState.disable === 'function') {
      window.__turboState.disable();
    } else {
      // Fallback: manually set the state to inactive
      window.__turboState.active = false;
      
      // Also try to reset the tick interval if possible
      if (globalThis.state?.board?.getSnapshot()?.context?.world?.tickEngine) {
        const tickEngine = globalThis.state.board.getSnapshot().context.world.tickEngine;
        tickEngine.setTickInterval(62.5); // Reset to default tick interval
      }
    }
    
    // Update the Turbo Mode button to show as inactive
    if (window.turboButton) {
      window.turboButton.textContent = 'Enable Turbo';
      window.turboButton.style.background = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat";
      window.turboButton.style.color = "#ffe066";
    }
    
    console.log('Turbo Mode mod has been disabled for analysis');
  }
  
  // Force close any existing modals first
  forceCloseAllModals();
  
  // NEW: Use modal registry to close any existing modals
  modalRegistry.closeByType('running');
  activeRunningModal = null;
  
  // Create a variable to store the running modal
  let runningModal = null;
  
  try {
    // Show the running analysis modal
    runningModal = showRunningAnalysisModal(0, config.runs);
    activeRunningModal = runningModal;
    
    // Debug: Log the modal object structure
    console.log('Running modal object:', runningModal);
    console.log('Modal close method:', typeof runningModal?.close);
    console.log('Modal element:', runningModal?.element);
    console.log('Modal remove method:', typeof runningModal?.remove);
    
    // Run the analysis with status updates
    const results = await analyzeBoard(config.runs, (status) => {
      const progressEl = document.getElementById('analysis-progress');
      if (progressEl) {
        progressEl.textContent = t('progressText')
          .replace('{current}', status.current)
          .replace('{total}', status.total);
      }
      
      // Update timing information if available
      if (status.avgRunTime && status.estimatedTimeRemaining) {
        const timingEl = document.getElementById('analysis-timing');
        if (timingEl) {
          timingEl.textContent = `${t('avgRunTimeLabel')} ${status.avgRunTime}ms • ${t('estimatedTimeRemainingLabel')} ${status.estimatedTimeRemaining}`;
        } else {
          if (runningModal && runningModal.close) {
            runningModal.close();
          }
          runningModal = showRunningAnalysisModal(
            status.current, 
            status.total, 
            status.avgRunTime, 
            status.estimatedTimeRemaining
          );
          activeRunningModal = runningModal;
        }
      }
    });
    
    // NEW: Always show results, even if analysis was stopped early
    console.log('Analysis completed, showing results:', results);
    console.log('Results summary:', results.summary);
    console.log('Force stopped:', results.summary.forceStopped);
    console.log('Total runs completed:', results.summary.totalRuns);
    
    // Force close all modals again
    forceCloseAllModals();
    
    // Ensure the running modal is closed through the API too
    if (runningModal) {
      try {
        // Check if the modal has a close method before calling it
        if (typeof runningModal.close === 'function') {
          runningModal.close();
        } else if (runningModal.element && typeof runningModal.element.remove === 'function') {
          // Try to remove the element directly if close method doesn't exist
          runningModal.element.remove();
        } else if (runningModal.remove && typeof runningModal.remove === 'function') {
          // Try alternative remove method
          runningModal.remove();
        }
      } catch (e) {
        console.error('Error closing running modal:', e);
      }
      runningModal = null;
      activeRunningModal = null;
    }
    
    // Small delay to ensure UI updates properly
    await sleep(600);
    
    // Force close all modals one more time
    forceCloseAllModals();
    
    // Show the results modal (works for both completed and partial results)
    showResultsModal(results);
    
  } catch (error) {
    console.error('Analysis error:', error);
    
    // NEW: Use modal registry to close modals and restore board state
    modalRegistry.closeAll();
    restoreBoardState();
    runningModal = null;
    activeRunningModal = null;
    
    // Show error modal
    api.ui.components.createModal({
      title: t('errorTitle'),
      content: `<p>${t('errorText')}</p><p>${error.message || ''}</p>`,
      buttons: [
        {
          text: t('closeButton'),
          primary: true,
          onClick: () => {
            // One more check for lingering modals when user closes error
            forceCloseAllModals();
          }
        }
      ]
    });
  }
}

// REMOVED: setupModalWatcher function - replaced with lightweight modal registry

// Initialize UI
function init() {
  console.log('Board Analyzer initializing UI...');
  
  // REMOVED: setupModalWatcher() - replaced with lightweight modal registry
  
  // Make sure turbo mode is disabled on startup
  if (turboActive) {
    disableTurbo();
  }
  
  // Add the main analyzer button - opens config panel with analysis callback
  api.ui.addButton({
    id: BUTTON_ID,
    text: t('buttonText'),
    modId: MOD_ID,
    tooltip: t('buttonTooltip'),
    primary: false,
    onClick: showConfigAndPrepareAnalysis
  });
  
  // REMOVED: Cogwheel button - redundant since main button opens the same config panel
  
  // Create the configuration panel (without analysis callback)
  createConfigPanel();
  
  // Inject custom CSS to fix input styles
  injectCustomStyles();
  
  console.log('Board Analyzer UI initialized');
}

// Initialize the mod
init();

// Export functionality
context.exports = {
  analyze: showConfigAndPrepareAnalysis, // Opens config panel with analysis callback
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
    api.service.updateScriptConfig(context.hash, config);
  },
  // NEW: Cleanup function for modal registry
  cleanup: () => {
    modalRegistry.closeAll();
  }
};

// Display the results in the modal
function displayResults(results, element) {
  if (!results || !Array.isArray(results) || results.length === 0) {
    element.innerHTML = `<p class="error">${t('noResults')}</p>`;
    return;
  }

  // Sort results by sPlus (descending)
  const sortedResults = [...results].sort((a, b) => b.sPlus - a.sPlus);
  
  // Calculate statistics
  const splusRates = results.map(r => r.sPlus);
  const completionRates = results.map(r => r.boardCompleted);
  const times = results.map(r => r.timeMs);

  const avgSPlus = calculateAverage(splusRates);
  const avgCompleted = calculateAverage(completionRates);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const medianTime = calculateMedian(times);
  const avgTime = calculateAverage(times);

  // Build statistics section
  const statsHTML = `
    <div class="analysis-stats">
      <div class="stat">
        <span class="stat-label">${t('statSPlus')}</span>
        <span class="stat-value">${(avgSPlus * 100).toFixed(2)}%</span>
      </div>
      <div class="stat">
        <span class="stat-label">${t('statCompleted')}</span>
        <span class="stat-value">${(avgCompleted * 100).toFixed(2)}%</span>
      </div>
      <div class="stat">
        <span class="stat-label">${t('statMinTime')}</span>
        <span class="stat-value">${(minTime / 1000).toFixed(2)}s</span>
      </div>
      <div class="stat">
        <span class="stat-label">${t('statMaxTime')}</span>
        <span class="stat-value">${(maxTime / 1000).toFixed(2)}s</span>
      </div>
      <div class="stat">
        <span class="stat-label">${t('statMedianTime')}</span>
        <span class="stat-value">${(medianTime / 1000).toFixed(2)}s</span>
      </div>
      <div class="stat">
        <span class="stat-label">${t('statAvgTime')}</span>
        <span class="stat-value">${(avgTime / 1000).toFixed(2)}s</span>
      </div>
    </div>
  `;

  // Build chart section - limit displayed bars to MAX_VISIBLE_BARS
  const MAX_VISIBLE_BARS = 15; // Maximum number of bars to display to prevent overflow
  const displayResults = sortedResults.length > MAX_VISIBLE_BARS 
    ? sortedResults.slice(0, MAX_VISIBLE_BARS) 
    : sortedResults;
  
  const chartHTML = createResultsChart(displayResults);
  
  // Add a note if we're not showing all results
  const noteHTML = sortedResults.length > MAX_VISIBLE_BARS 
    ? `<div class="chart-note">${t('chartLimitedNote').replace('{shown}', MAX_VISIBLE_BARS).replace('{total}', sortedResults.length)}</div>` 
    : '';

  // Combine all sections
  element.innerHTML = `
    <div class="analysis-results">
      ${statsHTML}
      <div class="analysis-chart-container">
        <h3>${t('runResultsChart')}</h3>
        ${chartHTML}
        ${noteHTML}
      </div>
    </div>
  `;
} 