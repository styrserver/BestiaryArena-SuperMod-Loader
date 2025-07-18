// Board Analyzer Mod for Bestiary Arena
console.log('Board Analyzer Mod initializing...');

// Configuration with defaults
const defaultConfig = {
  runs: 20,
  speedupFactor: 1000,
  hideGameBoard: true,
  enableTurboAutomatically: true,
  stopOnSPlus: false,
  stopAfterTicks: 0, // 0 means no limit
  currentLocale: document.documentElement.lang === 'pt' || 
    document.querySelector('html[lang="pt"]') || 
    window.location.href.includes('/pt/') ? 'pt' : 'en'
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Constants
const MOD_ID = 'board-analyzer';
const BUTTON_ID = `${MOD_ID}-button`;
const CONFIG_BUTTON_ID = `${MOD_ID}-config-button`;
const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;
const DEFAULT_TICK_INTERVAL_MS = 62.5;

// Track active modals to ensure they can be closed properly
let activeRunningModal = null;
let activeConfigPanel = null;

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
    copyBestTimeReplayButton: 'Replay Ticks',
    copyMaxPointsReplayButton: 'Replay Score',
    replayCopiedMessage: 'Copied!',
    totalTimeLabel: 'Total Time:',
    avgRunTimeLabel: 'Avg Run Time:',
    estimatedTimeRemainingLabel: 'Est. Remaining:',
    fastestRunTimeLabel: 'Fastest Run:',
    slowestRunTimeLabel: 'Slowest Run:'
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
    copyBestTimeReplayButton: 'Replay Ticks',
    copyMaxPointsReplayButton: 'Replay Score',
    replayCopiedMessage: 'Copiado!',
    totalTimeLabel: 'Tempo Total:',
    avgRunTimeLabel: 'Tempo Médio/run:',
    estimatedTimeRemainingLabel: 'Tempo Restante Est.:',
    fastestRunTimeLabel: 'Execução Mais Rápida:',
    slowestRunTimeLabel: 'Execução Mais Lenta:'
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

// Calculate median of an array
function calculateMedian(arr) {
  if (arr.length === 0) return 0;
  
  const sorted = [...arr].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  } else {
    return sorted[middle];
  }
}

// Calculate average of an array
function calculateAverage(arr) {
  if (arr.length === 0) return 0;
  const sum = arr.reduce((a, b) => a + b, 0);
  return Math.round(sum / arr.length);
}

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

// Function to get the final result of a game run
const getLastTick = () => {
  return new Promise((resolve) => {
    let timerSubscription;
    let hasResolved = false;
    
    // Subscribe to timer to track ticks and game state
    timerSubscription = globalThis.state.gameTimer.subscribe((data) => {
      const { currentTick, state, readableGrade, rankPoints } = data.context;
      
      // Check for stop conditions
      if (state !== 'initial') {
        // Game completed naturally through state change
        if (!hasResolved) {
          hasResolved = true;
          timerSubscription.unsubscribe();
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
          timerSubscription.unsubscribe();
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
          timerSubscription.unsubscribe();
          resolve({
            ticks: currentTick,
            grade: readableGrade,
            rankPoints: rankPoints,
            completed: false
          });
        }
      }
    });
  });
};

// Main analyze function
async function analyzeBoard(runs = config.runs, statusCallback = null) {
  // Reset force stop flag
  forceStop = false;
  
  // Reset tracking variables
  currentSeed = null;
  currentRegionId = null;
  currentRoomId = null;
  currentRoomName = null;
  boardSetup = [];
  
  // Variables to store best runs
  let bestTimeRun = null;
  let bestScoreRun = null;
  
  // Timing variables
  const startTime = performance.now();
  const runTimes = [];
  let lastRunStart = 0;
  
  // Ensure sandbox mode
  const modeSwitched = ensureSandboxMode();
  
  // Hide the game board if configured
  const gameFrame = document.querySelector('main .frame-4');
  if (config.hideGameBoard && gameFrame) {
    gameFrame.style.display = 'none';
  }

  const results = [];
  let minTicks = Infinity;
  let minTicksResult = null;
  let maxRankPoints = 0;
  let maxRankPointsResult = null;
  let sPlusCount = 0;
  let totalRuns = 0;
  let completedRuns = 0;

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
      // Start timing this run
      lastRunStart = performance.now();
      
      // Check if forced stop was requested
      if (forceStop) {
        console.log('Analysis stopped by user');
        break;
      }
      
      // Update status callback if provided
      if (statusCallback && runTimes.length > 0) {
        // Calculate average run time and estimated time remaining
        const avgRunTime = runTimes.reduce((sum, time) => sum + time, 0) / runTimes.length;
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
            sandboxSeed: runSeed,
            gameStarted: true
          })
        });
        
        // Wait for game to complete
        const result = await getLastTick();
        
        // Add seed to result
        result.seed = runSeed;
        results.push(result);
        
        const { ticks, grade, rankPoints, completed } = result;
        totalRuns++;
        
        if (completed) {
          completedRuns++;
          
          // Update min ticks if this is a completed run with lower ticks
          if (ticks < minTicks) {
            minTicks = ticks;
            minTicksResult = {
              ticks,
              grade,
              rankPoints,
              seed: runSeed,
              runIndex: i
            };
            
            // Store the board configuration for best time replay
            // Try various methods to get the most complete board data
            let boardData;
            
            if (typeof window.$serializeBoard === 'function') {
              // Use the raw function directly from window
              boardData = JSON.parse(window.$serializeBoard());
              console.log('Best time: Using window.$serializeBoard directly');
            } else if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.serializeBoard) {
              // Use the function from the API
              boardData = JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
              console.log('Best time: Using BestiaryModAPI.utility.serializeBoard');
            } else {
              // Fallback to our own implementation
              boardData = serializeBoard();
              console.log('Best time: Using local serializeBoard implementation');
            }
            
            // Ensure the seed is set
            boardData.seed = runSeed;
            
            bestTimeRun = {
              seed: runSeed,
              board: boardData
            };
            
            console.log(`New best time: ${ticks} ticks with seed ${runSeed} in run ${i}`);
            console.log('Best time board data:', boardData);
          }
        }
        
        if (grade === 'S+') {
          sPlusCount++;
          // If stopOnSPlus is enabled, we might want to exit early
          if (config.stopOnSPlus) {
            console.log('Achieved S+ grade, stopping analysis early');
            break;
          }
        }
        
        // Update max rank points
        if (rankPoints > maxRankPoints) {
          maxRankPoints = rankPoints;
          maxRankPointsResult = {
            ticks,
            grade,
            rankPoints,
            seed: runSeed,
            runIndex: i
          };
          
          // Store the board configuration for max points replay
          // Try various methods to get the most complete board data
          let boardData;
          
          if (typeof window.$serializeBoard === 'function') {
            // Use the raw function directly from window
            boardData = JSON.parse(window.$serializeBoard());
            console.log('Max points: Using window.$serializeBoard directly');
          } else if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.serializeBoard) {
            // Use the function from the API
            boardData = JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
            console.log('Max points: Using BestiaryModAPI.utility.serializeBoard');
          } else {
            // Fallback to our own implementation
            boardData = serializeBoard();
            console.log('Max points: Using local serializeBoard implementation');
          }
          
          // Ensure the seed is set
          boardData.seed = runSeed;
          
          bestScoreRun = {
            seed: runSeed,
            board: boardData
          };
          
          console.log(`New max points: ${rankPoints} with seed ${runSeed} in run ${i}`);
          console.log('Max points board data:', boardData);
        }
        
        // Check for force stop again
        if (forceStop) {
          console.log('Analysis stopped by user after run completed');
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
      
      // Record the time taken for this run
      const runTime = performance.now() - lastRunStart;
      runTimes.push(runTime);
      console.log(`Run ${i} took ${runTime.toFixed(2)}ms`);
      
      // Brief pause between runs to ensure clean state
      await sleep(1);
    }
  } catch (error) {
    console.error('Error during analysis:', error);
    throw error;
  } finally {
    // Restore game board visibility
    if (config.hideGameBoard && gameFrame) {
      gameFrame.style.display = '';
    }
    
    // Disable turbo mode if it was enabled
    if (config.enableTurboAutomatically && turboActive) {
      disableTurbo();
    }
    
    // Ensure the game is stopped using direct state manipulation
    try {
      globalThis.state.board.send({
        type: "setState",
        fn: prevState => ({
          ...prevState,
          gameStarted: false
        })
      });
    } catch (e) {
      console.error('Error stopping game in finally block:', e);
    }
  }

  // Calculate timing statistics
  const totalTime = performance.now() - startTime;
  const averageRunTime = runTimes.length > 0 ? runTimes.reduce((sum, time) => sum + time, 0) / runTimes.length : 0;
  
  // Calculate statistics
  const sPlusRate = totalRuns > 0 ? (sPlusCount / totalRuns * 100).toFixed(2) : '0.00';
  const completionRate = totalRuns > 0 ? (completedRuns / totalRuns * 100).toFixed(2) : '0.00';
  const ticksArray = results.filter(r => r.completed).map(r => r.ticks);
  const medianTicks = calculateMedian(ticksArray);
  const averageTicks = calculateAverage(ticksArray);
  
  return {
    results,
    summary: {
      runs,
      totalRuns,
      completedRuns,
      sPlusCount,
      sPlusRate,
      completionRate,
      minTicks: isFinite(minTicks) ? minTicks : 0,
      maxTicks: Math.max(...results.map(r => r.ticks)),
      medianTicks: medianTicks,
      averageTicks: averageTicks,
      maxRankPoints,
      forceStopped: forceStop,
      modeSwitched,
      bestTimeResult: bestTimeRun,
      maxPointsResult: bestScoreRun,
      // Timing stats
      totalTimeMs: totalTime,
      totalTimeFormatted: formatMilliseconds(totalTime),
      averageRunTimeMs: averageRunTime,
      averageRunTimeFormatted: formatMilliseconds(averageRunTime),
      fastestRunTimeMs: Math.min(...runTimes),
      slowestRunTimeMs: Math.max(...runTimes)
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
    // Get the serialized board data
    let boardData;
    
    // Check if the utility functions are directly available in window scope
    if (typeof window.$serializeBoard === 'function') {
      // Use the raw function directly from window
      boardData = JSON.parse(window.$serializeBoard());
      console.log('Used window.$serializeBoard directly for board data');
    } else if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.serializeBoard) {
      // Use the function from the API
      boardData = JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
      console.log('Used BestiaryModAPI.utility.serializeBoard for board data');
    } else {
      // Fallback to our own implementation
      boardData = serializeBoard();
      console.log('Used local serializeBoard implementation for board data');
    }
    
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

  // Create buttons array
  const buttons = [
    {
      text: t('startAnalysisButton'),
      primary: true,
      onClick: () => {
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
  
  activeConfigPanel = panel;
  return panel;
}

// Add a global function to forcefully close all analysis modals
function forceCloseAllModals() {
  console.log("Tentando forçar o fechamento de todos os modais...");
  
  // Specific cleanup for the modal structure in the UI
  const allDialogs = document.querySelectorAll('div[role="dialog"][data-state="open"]');
  allDialogs.forEach(dialog => {
    // Check if it's our analysis modal by looking for content
    const title = dialog.querySelector('.widget-top p');
    if (title && (title.textContent.includes('Executando Análise') || title.textContent.includes('Running Analysis'))) {
      console.log("Encontrado modal de análise para remover:", dialog);
      
      // First try to change its state to closed
      dialog.setAttribute('data-state', 'closed');
      
      // Then force remove it after a small delay
      setTimeout(() => {
        if (dialog.parentNode) {
          dialog.parentNode.removeChild(dialog);
          console.log("Modal removido com sucesso!");
        }
      }, 50);
    }
  });
  
  // Also try to find by text content inside any element
  document.querySelectorAll('*').forEach(el => {
    if (el.textContent && (
        el.textContent.includes('Executando Análise') || 
        el.textContent.includes('Running Analysis')
      ) && el.closest('[role="dialog"]')) {
      const dialog = el.closest('[role="dialog"]');
      console.log("Encontrado modal de análise por texto:", dialog);
      if (dialog && dialog.parentNode) {
        dialog.parentNode.removeChild(dialog);
      }
    }
  });
  
  // Remove overlay backgrounds too
  document.querySelectorAll('.modal-overlay, .fixed.inset-0').forEach(overlay => {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  });
  
  // Reset body styles that might have been added by modal
  document.body.style.overflow = '';
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
          // Set force stop flag
          forceStop = true;
          
          // Try to stop current game run
          globalThis.state.board.send({
            type: "setState",
            fn: prevState => ({
              ...prevState,
              gameStarted: false
            })
          });
          
          // Update progress text to indicate stopping
          const progressEl = document.getElementById('analysis-progress');
          if (progressEl) {
            progressEl.textContent += ' - Stopping...';
            progressEl.style.color = '#e74c3c';
          }
        }
      }
    ]
  });
  
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
    sPlusRateValue.style.cssText = 'text-align: right; color: gold;';
    
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
    
    // Max Rank Points
    const maxPointsLabel = document.createElement('div');
    maxPointsLabel.textContent = t('maxPointsLabel');
    maxPointsLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    const maxPointsValue = document.createElement('div');
    maxPointsValue.textContent = results.summary.maxRankPoints.toString();
    maxPointsValue.style.cssText = 'text-align: right;';
    
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
    statsContainer.appendChild(completionRateLabel);
    statsContainer.appendChild(completionRateValue);
    statsContainer.appendChild(minTimeLabel);
    statsContainer.appendChild(minTimeValue);
    statsContainer.appendChild(maxTimeLabel);
    statsContainer.appendChild(maxTimeValue);
    statsContainer.appendChild(medianTimeLabel);
    statsContainer.appendChild(medianTimeValue);
    statsContainer.appendChild(maxPointsLabel);
    statsContainer.appendChild(maxPointsValue);
    
    // Add timing stats
    statsContainer.appendChild(document.createElement('hr'));
    statsContainer.appendChild(document.createElement('hr'));
    statsContainer.appendChild(totalTimeLabel);
    statsContainer.appendChild(totalTimeValue);
    statsContainer.appendChild(avgRunTimeLabel);
    statsContainer.appendChild(avgRunTimeValue);
    
    // Add the stats container to the content
    content.appendChild(statsContainer);
    
    // Check if we have valid replay data for best time or max points
    const hasBestTimeReplay = results.summary.bestTimeResult && results.summary.bestTimeResult.board;
    const hasMaxPointsReplay = results.summary.maxPointsResult && results.summary.maxPointsResult.board;
    
    console.log('Best time replay data:', results.summary.bestTimeResult);
    console.log('Max points replay data:', results.summary.maxPointsResult);
    
    // Add copy replay buttons in their own container
    if (hasBestTimeReplay || hasMaxPointsReplay) {
      // Create a dedicated container for replay buttons
      const replayButtonsContainer = document.createElement('div');
      replayButtonsContainer.style.cssText = 'display: flex; gap: 5px; margin-bottom: 20px; width: 100%;';
      
      // Add best time button if available
      if (hasBestTimeReplay) {
        const copyBestTimeButton = document.createElement('button');
        copyBestTimeButton.textContent = t('copyBestTimeReplayButton');
        copyBestTimeButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
        copyBestTimeButton.style.cssText = 'flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        
        // Add click handler - use exact $replay format
        copyBestTimeButton.addEventListener('click', () => {
          // Get the board data, ensuring it's a complete copy
          const replayData = results.summary.bestTimeResult.board;
          
          // Always verify and fix the replay data format
          if (!verifyAndFixReplayData(replayData)) {
            // If the data is invalid, show an error to the user
            api.ui.components.createModal({
              title: 'Error',
              content: 'Failed to create replay data. The board configuration may be incomplete.',
              buttons: [{ text: 'OK', primary: true }]
            });
            return;
          }
          
          // Create the $replay formatted string with proper data
          const replayText = `$replay(${JSON.stringify(replayData)})`;
          
          // Log the replay text for debugging
          console.log('Best time replay text:', replayText);
          
          // Copy to clipboard
          const success = copyToClipboard(replayText);
          if (success) {
            const originalText = copyBestTimeButton.textContent;
            copyBestTimeButton.textContent = t('replayCopiedMessage');
            setTimeout(() => {
              copyBestTimeButton.textContent = originalText;
            }, 2000);
          }
        });
        
        replayButtonsContainer.appendChild(copyBestTimeButton);
      }
      
      // Add max points button if available
      if (hasMaxPointsReplay) {
        const copyMaxPointsButton = document.createElement('button');
        copyMaxPointsButton.textContent = t('copyMaxPointsReplayButton');
        copyMaxPointsButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
        copyMaxPointsButton.style.cssText = 'flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        
        // Add click handler - use exact $replay format
        copyMaxPointsButton.addEventListener('click', () => {
          // Get the board data, ensuring it's a complete copy
          const replayData = results.summary.maxPointsResult.board;
          
          // Always verify and fix the replay data format
          if (!verifyAndFixReplayData(replayData)) {
            // If the data is invalid, show an error to the user
            api.ui.components.createModal({
              title: 'Error',
              content: 'Failed to create replay data. The board configuration may be incomplete.',
              buttons: [{ text: 'OK', primary: true }]
            });
            return;
          }
          
          // Create the $replay formatted string with proper data
          const replayText = `$replay(${JSON.stringify(replayData)})`;
          
          // Log the replay text for debugging
          console.log('Max points replay text:', replayText);
          
          // Copy to clipboard
          const success = copyToClipboard(replayText);
          if (success) {
            const originalText = copyMaxPointsButton.textContent;
            copyMaxPointsButton.textContent = t('replayCopiedMessage');
            setTimeout(() => {
              copyMaxPointsButton.textContent = originalText;
            }, 2000);
          }
        });
        
        replayButtonsContainer.appendChild(copyMaxPointsButton);
      }
      
      // Add the buttons container to the content
      content.appendChild(replayButtonsContainer);
    }
    
    // Only show chart if there are results
    if (results.results.length > 0) {
      // Create a chart visualization
      const chartContainer = document.createElement('div');
      chartContainer.style.cssText = 'margin-top: 20px; border: 1px solid #333; padding: 10px; height: 150px; position: relative;';
      
      // Calculate the appropriate bar width to fit within container
      const containerWidth = 270; // Fixed container width (minus padding)
      const maxBars = 20; // Maximum number of bars to display - reduced to 14 to ensure they fit
      
      // Determine if we need to limit the number of displayed results
      const displayResults = results.results.length > maxBars ? 
        results.results.slice(0, maxBars) : 
        results.results;
      
      // Calculate bar width based on available space
      const spacing = 4; // Increased spacing for better visibility
      const barWidth = Math.max(4, Math.floor((containerWidth - (displayResults.length * spacing)) / displayResults.length));
      
      // Find the maximum tick value for proper scaling
      const maxTicks = Math.max(...results.results.map(r => r.ticks));
      
      // Create bars
      displayResults.forEach((result, index) => {
        const bar = document.createElement('div');
        const height = Math.max(10, Math.floor((result.ticks / maxTicks) * 120));
        
        bar.style.cssText = `
          position: absolute;
          bottom: 0;
          left: ${index * (barWidth + spacing)}px;
          width: ${barWidth}px;
          height: ${height}px;
          background-color: ${result.completed ? (result.grade === 'S+' ? 'gold' : '#4CAF50') : '#e74c3c'};
          transition: height 0.3s ease;
        `;
        
        // Add tooltip on hover
        bar.title = `Run ${index + 1}: ${result.ticks} ticks, Grade: ${result.grade}, ${result.completed ? 'Completed' : 'Failed'}`;
        
        chartContainer.appendChild(bar);
      });
      
      // Add a note if we limited the display
      if (results.results.length > maxBars) {
        const limitNote = document.createElement('div');
        limitNote.textContent = `Showing ${maxBars} of ${results.results.length} runs`;
        limitNote.style.cssText = 'text-align: center; font-size: 0.8em; color: #999; margin-top: 5px;';
        chartContainer.appendChild(limitNote);
      }
      
      content.appendChild(chartContainer);
    } else {
      // Show a message if no results
      const noResultsMessage = document.createElement('p');
      noResultsMessage.textContent = 'No runs completed yet.';
      noResultsMessage.style.cssText = 'text-align: center; color: #777; margin-top: 15px;';
      content.appendChild(noResultsMessage);
    }
    
    // Show the results modal with a callback to clean up when closed
    return api.ui.components.createModal({
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
  // Force close any existing modals first
  forceCloseAllModals();
  
  // Rest of the cleanup code can stay
  if (activeRunningModal) {
    try {
      activeRunningModal.close();
      activeRunningModal = null;
    } catch (e) {
      console.error('Error closing active running modal:', e);
    }
  }
  
  // Create a variable to store the running modal
  let runningModal = null;
  
  try {
    // Show the running analysis modal
    runningModal = showRunningAnalysisModal(0, config.runs);
    activeRunningModal = runningModal;
    
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
    
    // Force close all modals again
    forceCloseAllModals();
    
    // Ensure the running modal is closed through the API too
    if (runningModal) {
      try {
        runningModal.close();
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
    
    // Show the results modal
    showResultsModal(results);
    
  } catch (error) {
    console.error('Analysis error:', error);
    
    // Close the running modal if it exists
    forceCloseAllModals();
    
    if (runningModal) {
      try {
        runningModal.close();
      } catch (e) {
        console.error('Error closing running modal after error:', e);
      }
      runningModal = null;
      activeRunningModal = null;
    }
    
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

// Add an initialization function to set up a MutationObserver to catch modals
function setupModalWatcher() {
  // Check if we already have an observer
  if (window.__boardAnalyzerModalObserver) return;
  
  // Create a mutation observer to monitor for stuck modals
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        // Look for any added dialog nodes
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1 && node.getAttribute && node.getAttribute('role') === 'dialog') {
            // If this is a results dialog, check if there are other analysis modals still open
            const title = node.querySelector('.widget-top p');
            if (title && title.textContent.includes(t('resultTitle'))) {
              // Results modal is showing, force close any analysis modals
              setTimeout(forceCloseAllModals, 100);
            }
          }
        });
      }
    }
  });
  
  // Start observing the document
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Store the observer for later reference
  window.__boardAnalyzerModalObserver = observer;
}

// Initialize UI
function init() {
  console.log('Board Analyzer initializing UI...');
  
  // Setup modal watcher
  setupModalWatcher();
  
  // Make sure turbo mode is disabled on startup
  if (turboActive) {
    disableTurbo();
  }
  
  // Add the main analyzer button - now opens config first
  api.ui.addButton({
    id: BUTTON_ID,
    text: t('buttonText'),
    modId: MOD_ID,
    tooltip: t('buttonTooltip'),
    primary: false,
    onClick: showConfigAndPrepareAnalysis
  });
  
  // Add the configuration button
  api.ui.addButton({
    id: CONFIG_BUTTON_ID,
    icon: '⚙️',
    modId: MOD_ID,
    tooltip: t('configButtonTooltip'),
    onClick: () => api.ui.toggleConfigPanel(CONFIG_PANEL_ID)
  });
  
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
  analyze: showConfigAndPrepareAnalysis, // Changed to show config first
  toggleConfig: () => api.ui.toggleConfigPanel(CONFIG_PANEL_ID),
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
    api.service.updateScriptConfig(context.hash, config);
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