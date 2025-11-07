// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[Rank Pointer] initializing...');

// Configuration with defaults
const defaultConfig = {
  hideGameBoard: false,
  stopCondition: 'max', // 'max' = Maximum rank, 'any' = Any Victory
  enableAutoRefillStamina: false,
  stopWhenTicksReached: 0 // Stop when finding a run with this number of ticks or less
};

// Storage key for localStorage
const STORAGE_KEY = 'rankPointerConfig';

// Load config from localStorage (preferred) or context.config
function loadConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      console.log('[Rank Pointer] Loaded config from localStorage:', parsed);
      return Object.assign({}, defaultConfig, parsed);
    }
  } catch (error) {
    console.error('[Rank Pointer] Error loading config from localStorage:', error);
  }
  
  // Fallback to context.config if localStorage is empty
  return Object.assign({}, defaultConfig, context.config || {});
}

// Save config to localStorage
function saveConfig() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    console.log('[Rank Pointer] Saved config to localStorage:', config);
  } catch (error) {
    console.error('[Rank Pointer] Error saving config to localStorage:', error);
  }
}

// Initialize config
const config = loadConfig();

// Constants
const MOD_ID = 'rank-pointer';
const BUTTON_ID = `${MOD_ID}-button`;
const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;

// Timing constants
const UI_UPDATE_DELAY_MS = 600;
const GAME_RESTART_DELAY_MS = 400;
const NOTIFICATION_DISPLAY_MS = 3000;

// Analysis state constants
const ANALYSIS_STATES = {
  IDLE: 'idle',
  RUNNING: 'running',
  STOPPING: 'stopping',
  ERROR: 'error'
};

// Modal constants
const MODAL_TYPES = {
  CONFIG: 'config',
  RUNNING: 'running',
  RESULTS: 'results'
};

// Key/event and timing constants
const ESC_KEY_EVENT_INIT = {
  key: 'Escape',
  code: 'Escape',
  keyCode: 27,
  which: 27,
  bubbles: true,
  cancelable: true
};
const ENSURE_RESULTS_SAFE_TIMEOUT_MS = 3500;
const ENSURE_RESULTS_POLL_DELAY_MS = 120;
const DEFER_RESULTS_OPEN_MS = 250;
const S_PLUS_COLORS = ['#FFD700', '#FFA500', '#FF8C00', '#FF6347', '#FF4500', '#FF0000', '#DC143C', '#8B0000'];

function dispatchEsc() {
  try {
    document.dispatchEvent(new KeyboardEvent('keydown', ESC_KEY_EVENT_INIT));
  } catch (_) {}
}

// =======================
// 2. Global State & Classes
// =======================

// Track active modals
let activeRunningModal = null;
let activeConfigPanel = null;

// Inject Rank Pointer styles (reuse Hunt Analyzer theme)
function injectRankPointerStyles() {
  const styleId = 'rank-pointer-styles';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Themed container matching Hunt Analyzer */
    .rank-pointer-modal {
      background-image: url(/_next/static/media/background-darker.2679c837.png);
      background-repeat: repeat;
      background-color: #282C34;
      border: 1px solid #3A404A;
      color: #ABB2BF;
      border-radius: 7px;
      box-shadow: 0 0 15px rgba(0,0,0,0.7);
      padding: 10px;
      min-width: 220px;
      max-width: 260px;
      z-index: 2147483647;
      font-family: inherit;
    }
    .rank-pointer-modal-header {
      background-image: url(/_next/static/media/background-dark.95edca67.png);
      background-repeat: repeat;
      border-bottom: 1px solid #3A404A;
      padding: 4px;
      text-align: center;
      margin: -10px -10px 8px -10px;
      border-top-left-radius: 7px;
      border-top-right-radius: 7px;
      color: #E06C75;
      font-weight: bold;
      font-size: 14px;
      text-shadow: 0 0 5px rgba(224, 108, 117, 0.7);
    }
    .rank-pointer-modal-body {
      background-image: url(/_next/static/media/background-regular.b0337118.png);
      background-repeat: repeat;
      background-color: rgba(40,44,52,0.4);
      border: 1px solid #3A404A;
      border-radius: 4px;
      padding: 6px;
    }
    .rank-pointer-modal-footer {
      display: flex;
      justify-content: center;
      margin-top: 10px;
    }
    .rank-pointer-button {
      padding: 6px 12px;
      border: 1px solid #3A404A;
      background: linear-gradient(to bottom, #4B5563, #343841);
      color: #ABB2BF;
      font-size: 11px;
      cursor: pointer;
      border-radius: 5px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
    }
    .rank-pointer-button:hover {
      background: linear-gradient(to bottom, #6B7280, #4B5563);
      box-shadow: 0 3px 8px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.2);
      transform: translateY(-1px);
    }
    .rank-pointer-button:active {
      box-shadow: inset 0 2px 5px rgba(0,0,0,0.5);
      transform: translateY(1px);
    }
    .rank-pointer-stat {
      margin-top: 6px;
      font-size: 12px;
      color: #ABB2BF;
      text-align: center;
    }
    .rank-pointer-stat.warn { color: #E06C75; }
    .rank-pointer-stat.info { color: #61AFEF; }
  `;
  document.head.appendChild(style);
}

// ModalManager class for proper modal lifecycle management (like Board Analyzer)
class ModalManager {
  constructor() {
    this.activeModals = new Map();
    this.isClosing = false;
  }
  
  register(id, modal) {
    if (this.activeModals.has(id)) {
      this.close(id);
    }
    this.activeModals.set(id, modal);
  }
  
  close(id) {
    const modal = this.activeModals.get(id);
    if (modal) {
      try {
        if (typeof modal.close === 'function') {
          modal.close();
        } else if (modal.element && typeof modal.element.remove === 'function') {
          modal.element.remove();
        } else if (typeof modal.remove === 'function') {
          modal.remove();
        }
      } catch (e) {
        console.warn('[Rank Pointer] Error closing modal:', e);
      }
      this.activeModals.delete(id);
    }
  }
  
  closeAll() {
    if (this.isClosing) {
      console.warn('[Rank Pointer] Modal manager is already closing modals, skipping recursive call');
      return;
    }
    
    this.isClosing = true;
    try {
      this.activeModals.forEach((modal, id) => {
        try {
          if (typeof modal.close === 'function') {
            modal.close();
          } else if (modal.element && typeof modal.element.remove === 'function') {
            modal.element.remove();
          } else if (typeof modal.remove === 'function') {
            modal.remove();
          }
        } catch (e) {
          console.warn('[Rank Pointer] Error closing modal in closeAll:', e);
        }
      });
      this.activeModals.clear();
    } finally {
      this.isClosing = false;
    }
  }
  
  closeByType(type) {
    if (this.isClosing) {
      console.warn('[Rank Pointer] Modal manager is already closing modals, skipping recursive call');
      return;
    }
    
    this.isClosing = true;
    try {
      this.activeModals.forEach((modal, id) => {
        try {
          if (modal && modal.type === type) {
            if (typeof modal.close === 'function') {
              modal.close();
            } else if (modal.element && typeof modal.element.remove === 'function') {
              modal.element.remove();
            } else if (typeof modal.remove === 'function') {
              modal.remove();
            }
            this.activeModals.delete(id);
          }
        } catch (e) {
          console.warn('[Rank Pointer] Error closing modal by type:', e);
        }
      });
    } finally {
      this.isClosing = false;
    }
  }
}

// Create global modal manager instance
const modalManager = new ModalManager();

// Add a global function to forcefully close all analysis modals
function forceCloseAllModals() {
  console.log('[Rank Pointer] Closing all registered modals...');
  modalManager.closeAll();
}

// Helper function to close running modal specifically
function closeRunningModal() {
  try {
    modalManager.close('running-modal');
    activeRunningModal = null;
    console.log('[Rank Pointer] Running modal closed successfully');
  } catch (error) {
    console.warn('[Rank Pointer] Error closing running modal:', error);
  }
}

// AnalysisState class for proper state management
class AnalysisState {
  constructor() {
    this.state = ANALYSIS_STATES.IDLE;
    this.currentId = null;
    this.forceStop = false;
  }
  
  canStart() {
    return this.state === ANALYSIS_STATES.IDLE;
  }
  
  start() {
    if (!this.canStart()) {
      throw new Error(`Cannot start analysis from state: ${this.state}`);
    }
    this.state = ANALYSIS_STATES.RUNNING;
    this.currentId = Date.now();
    this.forceStop = false;
    return this.currentId;
  }
  
  stop() {
    this.state = ANALYSIS_STATES.STOPPING;
    this.forceStop = true;
  }
  
  reset() {
    this.state = ANALYSIS_STATES.IDLE;
    this.currentId = null;
    this.forceStop = false;
  }
  
  setError() {
    this.state = ANALYSIS_STATES.ERROR;
  }
  
  isRunning() {
    return this.state === ANALYSIS_STATES.RUNNING;
  }
  
  isStopping() {
    return this.state === ANALYSIS_STATES.STOPPING;
  }
  
  isIdle() {
    return this.state === ANALYSIS_STATES.IDLE;
  }
  
  isValidId(id) {
    return this.currentId === id;
  }
}

// Create global analysis state instance
const analysisState = new AnalysisState();

// Global variables to track game data
let attemptCount = 0;
let currentRunStartTime = null;
let allAttempts = []; // Store all attempt data including serverResults
let boardSubscription = null; // Subscription to board state for serverResults
let pendingServerResults = new Map(); // Map of seed -> serverResults for matching to attempts
let defeatsCount = 0; // Track number of defeats
let victoriesCount = 0; // Track number of victories
let totalStaminaSpent = 0; // Track total stamina spent
let openRewardsSubscription = null; // Subscription to openRewards state

// Shared game state tracker to avoid multiple subscriptions
let gameStateTracker = null;
let skipCount = 0; // Track number of skips
let skipInProgress = false; // Debounce skip handling

// Persistent tracking variables updated by gameTimer subscription
let persistentLastTick = 0;
let persistentLastGrade = 'F';
let persistentLastRankPoints = 0;
let gameTimerUnsubscribe = null; // Unsubscribe function for gameTimer

// =======================
// 3. Utility Functions
// =======================

// Use shared translation system via API
const t = (key) => api.i18n.t(key);

// Sleep function for async operations
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate grade from rankPoints and maxTeamSize
// Based on game formula:
// maxGrade(maxTeamSize) = {
//   0                if maxTeamSize ≤ 1
//   maxTeamSize + 1  otherwise
// }
// - rankGrade = maxGrade - rankPoints
// - Grade mapping: rankGrade determines the letter grade
//
// Example: maxTeamSize=5, rankPoints=5
// - maxGrade = 6 (5 + 1)
// - rankGrade = 6 - 5 = 1
// - Grade = S
//
// Example: maxTeamSize=1, rankPoints=1
// - maxGrade = 0 (since maxTeamSize ≤ 1)
// - rankGrade = 0 - 1 = -1
// - When rankPoints >= maxTeamSize and maxTeamSize ≤ 1, this is exceptional = S+
function calculateGradeFromRankPoints(rankPoints, maxTeamSize) {
  if (typeof rankPoints !== 'number' || typeof maxTeamSize !== 'number' || rankPoints < 0) {
    return 'F';
  }
  
  // Calculate max grade for this map (special case for maxTeamSize ≤ 1)
  const maxGrade = maxTeamSize <= 1 ? 0 : maxTeamSize + 1;
  
  // Calculate rank grade: maxGrade - rankPoints
  // Higher rankPoints = lower rankGrade = better grade
  const rankGrade = maxGrade - rankPoints;
  
  // Special case: When maxTeamSize ≤ 1 and rankPoints >= maxTeamSize, it's S+
  // This represents exceptional performance in small team size maps
  if (maxTeamSize <= 1 && rankPoints >= maxTeamSize) {
    return 'S+';
  }
  
  // S+ is also achieved with very high rankPoints (typically >= maxTeamSize * 2)
  // This represents exceptional performance beyond normal S grade
  if (maxTeamSize > 1 && rankPoints >= maxTeamSize * 2) {
    return 'S+';
  }
  
  // Map rankGrade to letter grade (lower rankGrade = better grade)
  // rankGrade 1 = S (as per user's example)
  // rankGrade 2 = A
  // rankGrade 3 = B
  // rankGrade 4 = C
  // rankGrade 5 = D
  // rankGrade 6 = E
  // rankGrade <= 0 (rankPoints >= maxGrade) = S (fallback, though S+ would catch most)
  // rankGrade >= 7 = F
  
  if (rankGrade <= 0) {
    // rankPoints >= maxGrade, should be S (or S+ if already handled above)
    return 'S';
  } else if (rankGrade === 1) {
    return 'S';
  } else if (rankGrade === 2) {
    return 'A';
  } else if (rankGrade === 3) {
    return 'B';
  } else if (rankGrade === 4) {
    return 'C';
  } else if (rankGrade === 5) {
    return 'D';
  } else if (rankGrade === 6) {
    return 'E';
  } else {
    // rankGrade >= 7, which means rankPoints <= maxGrade - 7 (very low)
    return 'F';
  }
}

// Get maxTeamSize for current room (optionally from serverResults roomId)
function getMaxTeamSize(serverResults = null) {
  try {
    let roomId = null;
    
    // First try to get roomId from serverResults (most reliable)
    if (serverResults && serverResults.rewardScreen && serverResults.rewardScreen.roomId) {
      roomId = serverResults.rewardScreen.roomId;
      console.log(`[Rank Pointer] Using roomId from serverResults:`, roomId);
    }
    
    // Fallback to board context
    if (!roomId) {
      const boardContext = globalThis.state.board.getSnapshot().context;
      const selectedMap = boardContext.selectedMap || {};
      roomId = selectedMap.selectedRoom?.id;
      console.log(`[Rank Pointer] Using roomId from board context:`, roomId);
    }
    
    if (roomId && globalThis.state?.utils?.ROOMS) {
      const rooms = globalThis.state.utils.ROOMS;
      
      // Try to find by id (could be string or number)
      let roomData = rooms.find(room => room.id === roomId || room.id === String(roomId) || String(room.id) === roomId);
      
      // If not found, try to find by file name or other identifier
      if (!roomData && typeof roomId === 'string') {
        roomData = rooms.find(room => room.file?.name === roomId || room.file?.id === roomId);
      }
      
      console.log(`[Rank Pointer] Room data found:`, roomData ? { id: roomData.id, maxTeamSize: roomData.maxTeamSize, file: roomData.file?.name } : 'not found');
      
      if (roomData && typeof roomData.maxTeamSize === 'number') {
        console.log(`[Rank Pointer] Using maxTeamSize from room data:`, roomData.maxTeamSize);
        return roomData.maxTeamSize;
      }
    }
  } catch (error) {
    console.warn('[Rank Pointer] Error getting maxTeamSize:', error);
  }
  
  // Default fallback (most common is 5, but some maps are different)
  console.log(`[Rank Pointer] Using default maxTeamSize: 5`);
  return 5;
}

// Find and click the start button
function findStartButton() {
  const buttons = document.querySelectorAll('button');
  // Support EN and pt-BR labels
  const startTexts = ['start', 'fight', 'iniciar', 'lutar', 'jogar', 'começar'];
  for (const button of buttons) {
    const text = (button.textContent || '').trim().toLowerCase();
    if (startTexts.some((t) => text.includes(t))) {
      return button;
    }
  }
  return null;
}

// Get the player's team size from the current board setup
function getPlayerTeamSize() {
  try {
    const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
    if (!boardContext || !Array.isArray(boardContext.boardConfig)) return 0;
    const isAlly = (piece) => (piece?.type === 'player') || (piece?.type === 'custom' && piece?.villain === false);
    return boardContext.boardConfig.filter(isAlly).length;
  } catch (e) {
    console.warn('[Rank Pointer] Error computing player team size:', e);
    return 0;
  }
}

function clickStartButton() {
  const button = findStartButton();
  if (button) {
    button.click();
    return true;
  }
  return false;
}

// Ensure the game is in manual mode
function ensureManualMode() {
  try {
    const boardContext = globalThis.state.board.getSnapshot().context;
    const currentMode = boardContext.mode;
    
    if (currentMode !== 'manual') {
      console.log(`[Rank Pointer] Switching from ${currentMode} mode to manual mode`);
      globalThis.state.board.send({ type: "setPlayMode", mode: "manual" });
      return true;
    } else {
      console.log('[Rank Pointer] Already in manual mode');
      return false;
    }
  } catch (error) {
    console.error('[Rank Pointer] Error setting manual mode:', error);
    return false;
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
        
        if (!this.subscription) {
          this.startSubscription();
        }
        
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
            console.warn('[Rank Pointer] Error in game state listener:', error);
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

// Setup persistent gameTimer subscription for tracking game data
function setupGameTimerSubscription() {
  if (gameTimerUnsubscribe) {
    return; // Already set up
  }
  
  // Reset tracking variables
  persistentLastTick = 0;
  persistentLastGrade = 'F';
  persistentLastRankPoints = 0;
  
  try {
    const tracker = getGameStateTracker();
    gameTimerUnsubscribe = tracker.subscribe((context) => {
      if (context.currentTick !== undefined) persistentLastTick = context.currentTick;
      if (context.readableGrade) persistentLastGrade = context.readableGrade;
      if (context.rankPoints !== undefined) persistentLastRankPoints = context.rankPoints;
    });
    console.log('[Rank Pointer] Persistent gameTimer subscription set up');
  } catch (error) {
    console.warn('[Rank Pointer] Error setting up gameTimer subscription:', error);
  }
}

// Cleanup persistent gameTimer subscription
function cleanupGameTimerSubscription() {
  if (gameTimerUnsubscribe) {
    gameTimerUnsubscribe();
    gameTimerUnsubscribe = null;
    console.log('[Rank Pointer] Persistent gameTimer subscription cleaned up');
  }
}

// Function to wait for game completion (tracking reward screen - 1 reward screen = 1 run)
async function waitForGameCompletion(analysisId) {
  console.log('[Rank Pointer] Waiting for reward screen to open (1 reward screen = 1 run)...');
  
  // Use persistent tracking variables (updated by persistent gameTimer subscription)
  console.log('[Rank Pointer] Current tracked values:', { 
    lastTick: persistentLastTick, 
    lastGrade: persistentLastGrade, 
    lastRankPoints: persistentLastRankPoints 
  });
  
  // Reset reward screen state at start (should already be false, but ensure it)
  rewardScreenOpen = false;
  console.log('[Rank Pointer] waitForGameCompletion: Reset rewardScreenOpen to false');
  
  // Promise-based approach: wait for callback to fire or timeout
  const maxWaitMs = 240000; // 4 minutes max
  const checkIntervalMs = 1000; // Check stop/skip every second
  
  const completionPromise = new Promise((resolve, reject) => {
    let intervalId;
    let checkCount = 0;
    
    // Register callback for immediate resolution when reward screen opens
    rewardScreenOpenedCallback = () => {
      console.log('[Rank Pointer] Reward screen opened via callback - resolving immediately');
      if (intervalId) clearInterval(intervalId);
      rewardScreenOpenedCallback = null;
      resolve('callback');
    };
    
    // Interval to check for stop/skip conditions
    intervalId = setInterval(async () => {
      checkCount++;
      
      // Check if we should stop
      if (!analysisState.isValidId(analysisId)) {
        clearInterval(intervalId);
        rewardScreenOpenedCallback = null;
        reject('invalid_id');
        return;
      }
      
      if (!analysisState.isRunning()) {
        // Don't abort - let the current run finish (reward screen will still be captured)
        // The main loop will check this after the run completes
        if (checkCount === 1) {
          console.log('[Rank Pointer] Stop requested - letting current run finish naturally');
        }
      }
      
      // Check for skip
      if (await handleSkipDetection(`[Rank Pointer] Skip detected during wait check ${checkCount}`)) {
        clearInterval(intervalId);
        rewardScreenOpenedCallback = null;
        reject('skip');
        return;
      }
      
      // Also check state directly (fallback in case callback missed)
      if (getOpenRewardsStateWithFallback()) {
        console.log('[Rank Pointer] Reward screen detected via polling fallback');
        clearInterval(intervalId);
        rewardScreenOpenedCallback = null;
        resolve('polling');
        return;
      }
      
      // Log progress every 10 seconds
      if (checkCount % 10 === 0) {
        console.log(`[Rank Pointer] Still waiting for reward screen... (${checkCount}s elapsed, callback will resolve instantly)`);
      }
      
      // Timeout check
      if (checkCount * checkIntervalMs >= maxWaitMs) {
        console.log('[Rank Pointer] Wait timeout reached');
        clearInterval(intervalId);
        rewardScreenOpenedCallback = null;
        reject('timeout');
      }
    }, checkIntervalMs);
  });
  
  // Wait for completion or error
  try {
    const triggerSource = await completionPromise;
    console.log(`[Rank Pointer] Game completed (triggered by: ${triggerSource})`);
  } catch (reason) {
    if (reason === 'invalid_id' || reason === 'stopped') {
      return createForceStopResult();
    } else if (reason === 'skip') {
      return createSkipResult();
    } else if (reason === 'timeout') {
      console.log('[Rank Pointer] Timeout waiting for reward screen - returning failed state');
      return {
        ticks: persistentLastTick || 0,
        grade: persistentLastGrade || 'F',
        rankPoints: persistentLastRankPoints || 0,
        completed: false,
        forceStopped: true
      };
    }
  }
  
  // Process completion
  console.log(`[Rank Pointer] Tracked game data when reward screen opened:`, { 
    lastTick: persistentLastTick, 
    lastGrade: persistentLastGrade, 
    lastRankPoints: persistentLastRankPoints 
  });
  
  // Get game state from gameTimer context (for victory check and grade/rank) - like Board Analyzer
  const gameTimerContext = globalThis.state.gameTimer.getSnapshot().context;
  const gameState = gameTimerContext.state;
  
  // Get grade and rank from gameTimer context (authoritative source, like Board Analyzer)
  // Use gameTimer's readableGrade directly if available and valid (non-empty string)
  // Empty string means grade not yet available
  let readableGrade = (gameTimerContext.readableGrade && 
                      gameTimerContext.readableGrade !== '' && 
                      gameTimerContext.readableGrade !== null && 
                      gameTimerContext.readableGrade !== undefined)
    ? gameTimerContext.readableGrade 
    : persistentLastGrade;
  let rankPoints = gameTimerContext.rankPoints !== undefined ? gameTimerContext.rankPoints : persistentLastRankPoints;
  let currentTick = gameTimerContext.currentTick !== undefined ? gameTimerContext.currentTick : persistentLastTick;
  
  console.log(`[Rank Pointer] gameTimer context:`, {
    state: gameState,
    readableGrade: gameTimerContext.readableGrade,
    rankPoints: gameTimerContext.rankPoints,
    currentTick: gameTimerContext.currentTick
  });
  
  // Check pending serverResults first (captured by subscription)
  let serverResults = null;
  if (pendingServerResults.size > 0) {
    const lastSeed = Array.from(pendingServerResults.keys()).pop();
    serverResults = pendingServerResults.get(lastSeed);
    console.log(`[Rank Pointer] Got serverResults from pending map for game completion check`);
  }
  
  // Also check current board context as fallback
  const boardContext = globalThis.state.board.getSnapshot().context;
  if (!serverResults && boardContext?.serverResults) {
    serverResults = boardContext.serverResults;
    console.log(`[Rank Pointer] Got serverResults from board context`);
  }
  
  let completed = gameState === 'victory';
  
  if (serverResults?.rewardScreen) {
    const serverVictory = typeof serverResults.rewardScreen.victory === 'boolean' ? serverResults.rewardScreen.victory : false;
    console.log(`[Rank Pointer] Found serverResults - gameState: ${gameState}, serverVictory: ${serverVictory}, gameTicks: ${serverResults.rewardScreen.gameTicks}`);
    
    // Use serverResults as authoritative for victory
    completed = serverVictory;
    
    // Use serverResults for tick info if available (especially important in manual mode)
    if (typeof serverResults.rewardScreen.gameTicks === 'number') {
      currentTick = serverResults.rewardScreen.gameTicks;
      console.log(`[Rank Pointer] Using gameTicks from serverResults: ${currentTick}`);
    }
    
    // Try to get rank points from serverResults.rank (not rankPoints) - like RunTracker/Board Advisor
    if (typeof serverResults.rewardScreen.rank === 'number') {
      rankPoints = serverResults.rewardScreen.rank;
      console.log(`[Rank Pointer] Using rank from serverResults.rewardScreen.rank: ${rankPoints}`);
    }
    
    // Check if serverResults has grade field
    if (serverResults.rewardScreen.grade && 
        serverResults.rewardScreen.grade !== '' && 
        typeof serverResults.rewardScreen.grade === 'string') {
      readableGrade = serverResults.rewardScreen.grade;
      console.log(`[Rank Pointer] Using grade from serverResults.rewardScreen.grade: ${readableGrade}`);
    }
    // Only calculate grade if neither gameTimer nor serverResults provided a valid one
    else if (!readableGrade || readableGrade === '' || readableGrade === 'F') {
      // Get maxTeamSize for proper grade calculation (fallback only) - pass serverResults for roomId lookup
      const maxTeamSize = getMaxTeamSize(serverResults);
      readableGrade = calculateGradeFromRankPoints(rankPoints, maxTeamSize);
      console.log(`[Rank Pointer] Calculated grade from rankPoints ${rankPoints} and maxTeamSize ${maxTeamSize}: ${readableGrade} (neither gameTimer nor serverResults provided grade)`);
    } else {
      // Trust gameTimer's grade (same as Board Analyzer does)
      console.log(`[Rank Pointer] Using grade from gameTimer: ${readableGrade}`);
    }
    
    // Log all available serverResults fields for debugging
    console.log(`[Rank Pointer] serverResults.rewardScreen keys:`, Object.keys(serverResults.rewardScreen));
    if (serverResults.rewardScreen.grade !== undefined) {
      console.log(`[Rank Pointer] serverResults.rewardScreen.grade:`, serverResults.rewardScreen.grade);
    }
  } else {
    console.log(`[Rank Pointer] No serverResults available yet, using gameState: ${gameState}`);
    
    // Only calculate grade if gameTimer didn't provide a valid one (use game's calculation as authoritative)
    if (!readableGrade || readableGrade === '' || readableGrade === 'F') {
      const maxTeamSize = getMaxTeamSize(null);
      readableGrade = calculateGradeFromRankPoints(rankPoints, maxTeamSize);
      console.log(`[Rank Pointer] Calculated grade from rankPoints ${rankPoints} and maxTeamSize ${maxTeamSize}: ${readableGrade} (gameTimer didn't provide valid grade)`);
    } else {
      // Trust gameTimer's grade (same as Board Analyzer does)
      console.log(`[Rank Pointer] Using grade from gameTimer: ${readableGrade}`);
    }
  }
  
  console.log(`[Rank Pointer] Final victory determination: ${completed}, ticks: ${currentTick}, grade: ${readableGrade}, rankPoints: ${rankPoints}`);
  
  return {
    ticks: currentTick,
    grade: readableGrade,
    rankPoints: rankPoints,
    completed: completed
  };
}

// =======================
// 4. Main Analysis Loop
// =======================

// Setup board subscription to capture serverResults
function setupBoardSubscription() {
  if (boardSubscription) {
    return; // Already set up
  }
  
  // Reset pending serverResults
  pendingServerResults.clear();
  let lastProcessedSeed = null;
  
  if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
    console.log('[Rank Pointer] Setting up board subscription for serverResults...');
    boardSubscription = globalThis.state.board.subscribe(({ context }) => {
      const serverResults = context.serverResults;
      if (!serverResults || !serverResults.rewardScreen || typeof serverResults.seed === 'undefined') {
        return; // No valid server results yet
      }
      
      // If server signals enableSkip, attempt to skip immediately (debounced)
      try {
        if (serverResults.enableSkip === true && !skipInProgress) {
          skipInProgress = true;
          console.log('[Rank Pointer] enableSkip=true received from server (subscription) — attempting to skip');
          handleSkipButton().finally(() => {
            setTimeout(() => { skipInProgress = false; }, 1200);
          });
        }
      } catch (_) {}
      
      // Get the seed
      const seed = serverResults.seed;
      
      // Skip duplicate seeds (like Hunt Analyzer does)
      if (seed === lastProcessedSeed) {
        return; // Already processed this seed
      }
      
      lastProcessedSeed = seed;
      
      // Store serverResults by seed for later matching with attempts
      // Make a deep copy to avoid mutation
      pendingServerResults.set(seed, JSON.parse(JSON.stringify(serverResults)));
      
      console.log('[Rank Pointer] ServerResults captured, seed:', seed, 'victory:', serverResults.rewardScreen.victory, 'full serverResults:', serverResults);
    });
  }
}

// Track reward screen state
let rewardScreenOpen = false;
let rewardScreenClosedCallback = null;
let rewardScreenOpenedCallback = null;

// Setup openRewards subscription to track when reward screen opens/closes
function setupRewardsScreenSubscription() {
  if (openRewardsSubscription) {
    return; // Already set up
  }
  
  if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.select) {
    console.log('[Rank Pointer] Setting up openRewards subscription to track reward screen...');
    
    try {
      const openRewards = globalThis.state.board.select((ctx) => ctx.openRewards);
      
      openRewardsSubscription = openRewards.subscribe((isOpen) => {
        console.log('[Rank Pointer] openRewards changed:', isOpen);
        
        // Just track the state - don't auto-close here (we'll close it after detecting game completion)
        if (isOpen && !rewardScreenOpen) {
          // Reward screen just opened - this indicates a game completed
          console.log('[Rank Pointer] Reward screen opened - game completed! (1 reward screen = 1 run)');
          rewardScreenOpen = true;
          
          // Trigger immediate check if callback is registered
          if (rewardScreenOpenedCallback) {
            console.log('[Rank Pointer] Triggering immediate check via callback');
            rewardScreenOpenedCallback();
          }
        } else if (!isOpen && rewardScreenOpen) {
          // Reward screen just closed
          console.log('[Rank Pointer] Reward screen closed');
          rewardScreenOpen = false;
          
          // Notify any waiting code
          if (rewardScreenClosedCallback) {
            rewardScreenClosedCallback();
            rewardScreenClosedCallback = null;
          }
        }
      });
      
      console.log('[Rank Pointer] openRewards subscription set up successfully');
    } catch (error) {
      console.warn('[Rank Pointer] Error setting up openRewards subscription:', error);
    }
  }
}

// Function to close the reward screen (like btlucas fix.js)
function closeRewardScreen() {
  console.log('[Rank Pointer] Attempting to close reward screen using ESC key...');
  
  // Check if there's a modal open (data-scroll-locked="1") - like btlucas fix.js
  const bodyElement = document.body;
  const scrollLocked = bodyElement.getAttribute('data-scroll-locked');
  
  if (scrollLocked === '1') {
    console.log('[Rank Pointer] Modal detected (data-scroll-locked="1") - pressing ESC to close...');
  } else {
    console.log('[Rank Pointer] No data-scroll-locked="1" detected, but pressing ESC anyway...');
  }
  
  // Use ESC key directly (like btlucas fix.js - simpler and more reliable)
  dispatchEsc();
  console.log('[Rank Pointer] ESC key pressed to close reward screen');
}

// Helper function to find skip button (from btlucas fix.js)
function findSkipButton() {
  try {
    // First, try the specific selector
    const specificSkipButton = document.querySelector("#__next > div.flex.min-h-screen.flex-col > div > main > div > div.flex.flex-col.justify-center.gap-2.\\32 xl\\:flex-row > div.grid.grid-cols-2.gap-2.gap-y-1\\.5.sm\\:grid-cols-\\[1fr_min-content\\].sm\\:grid-rows-\\[3fr\\].sm\\:gap-y-2.\\32 xl\\:grid-cols-\\[min-content\\] > div.sm\\:order-3 > button");
    if (specificSkipButton) {
      const buttonText = specificSkipButton.textContent.trim();
      if (buttonText.includes('Skip') || buttonText.includes('Pular')) {
        console.log('[Rank Pointer] Found skip button using specific selector');
        console.log('[Rank Pointer] Button text:', `"${buttonText}"`);
        return specificSkipButton;
      }
    }
    
    // Fallback: Look for skip button by text content in all buttons
    const skipButtons = document.querySelectorAll('button');
    for (const button of skipButtons) {
      const buttonText = button.textContent.trim();
      if (buttonText.includes('Skip') || buttonText.includes('Pular')) {
        console.log('[Rank Pointer] Found skip button using text search');
        console.log('[Rank Pointer] Button text:', `"${buttonText}"`);
        return button;
      }
    }
    
    // Additional fallback: Look for buttons with data attributes
    const skipButtonsByAttr = document.querySelectorAll('button[data-full="false"][data-state="closed"]');
    for (const button of skipButtonsByAttr) {
      const buttonText = button.textContent.trim();
      if (buttonText.includes('Skip') || buttonText.includes('Pular')) {
        console.log('[Rank Pointer] Found skip button using data attributes');
        console.log('[Rank Pointer] Button text:', `"${buttonText}"`);
        return button;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[Rank Pointer] Error finding skip button:', error);
    return null;
  }
}

// Helper function to handle skip button click (from btlucas fix.js)
async function handleSkipButton() {
  try {
    const skipButton = findSkipButton();
    if (skipButton) {
      console.log('[Rank Pointer] Skip button found - clicking to skip time-limit loss...');
      skipButton.click();
      await sleep(500); // Wait for skip to process
      console.log('[Rank Pointer] Skip button clicked successfully');
      
      // Close loot summary window after a short delay
      setTimeout(() => {
        closeRewardScreen();
      }, 1000);
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Rank Pointer] Error handling skip button:', error);
    return false;
  }
}

// Rapid scanner to detect Skip button during waits
async function quickSkipScan(totalMs = 5000, stepMs = 400) {
  try {
    const deadline = performance.now() + totalMs;
    // Cap step to sensible bounds
    const interval = Math.max(150, Math.min(stepMs, 1000));
    while (performance.now() < deadline) {
      const btn = findSkipButton();
      if (btn) {
        await handleSkipButton();
        return true;
      }
      await sleep(interval);
    }
  } catch (e) {
    console.warn('[Rank Pointer] quickSkipScan error:', e);
  }
  return false;
}

// Function to wait for reward screen to close
async function waitForRewardScreenToClose(maxWaitMs = 2500) {
  // Check actual state first, not just the flag
  let isCurrentlyOpen = false;
  try {
    const openRewards = globalThis.state.board.select((ctx) => ctx.openRewards);
    isCurrentlyOpen = openRewards.getSnapshot();
  } catch (e) {
    // Fallback to flag
    isCurrentlyOpen = rewardScreenOpen;
  }
  
  if (!isCurrentlyOpen) {
    console.log('[Rank Pointer] Reward screen is already closed (verified via openRewards state)');
    rewardScreenOpen = false; // Sync the flag
    return true;
  }
  
  console.log('[Rank Pointer] Waiting for reward screen to close...');
  
  return new Promise((resolve) => {
    const startTime = performance.now();
    let callbackTriggered = false;
    
    // Set up callback for when subscription detects closure
    rewardScreenClosedCallback = () => {
      if (!callbackTriggered) {
        console.log('[Rank Pointer] Reward screen closed callback triggered');
        callbackTriggered = true;
        resolve(true);
      }
    };
    
    // Polling fallback in case subscription doesn't fire
    const checkInterval = setInterval(() => {
      try {
        const openRewards = globalThis.state.board.select((ctx) => ctx.openRewards);
        const isOpen = openRewards.getSnapshot();
        
        console.log(`[Rank Pointer] Polling openRewards: ${isOpen}, rewardScreenOpen: ${rewardScreenOpen}`);
        
        if (!isOpen) {
          console.log('[Rank Pointer] Reward screen closed (detected via polling)');
          clearInterval(checkInterval);
          rewardScreenOpen = false;
          if (!callbackTriggered) {
            callbackTriggered = true;
            resolve(true);
          }
          return;
        }
        
        const elapsed = performance.now() - startTime;
        if (elapsed > maxWaitMs) {
          console.warn(`[Rank Pointer] Timeout waiting for reward screen to close (${elapsed}ms elapsed)`);
          clearInterval(checkInterval);
          if (!callbackTriggered) {
            callbackTriggered = true;
            resolve(false);
          }
          return;
        }
        
        // Log progress every 500ms
        if (Math.floor(elapsed / 500) !== Math.floor((elapsed - 100) / 500)) {
          console.log(`[Rank Pointer] Still waiting for reward screen to close... (${Math.floor(elapsed / 1000)}s elapsed)`);
        }
        
      } catch (e) {
        console.log('[Rank Pointer] Could not check openRewards, assuming closed');
        clearInterval(checkInterval);
        if (!callbackTriggered) {
          callbackTriggered = true;
          resolve(true);
        }
      }
    }, 80);
  });
}

// Cleanup rewards screen subscription
function cleanupRewardsScreenSubscription() {
  if (openRewardsSubscription) {
    try {
      if (typeof openRewardsSubscription.unsubscribe === 'function') {
        openRewardsSubscription.unsubscribe();
        console.log('[Rank Pointer] openRewards subscription unsubscribed');
      }
    } catch (e) {
      console.warn('[Rank Pointer] Error cleaning up openRewards subscription:', e);
    }
    openRewardsSubscription = null;
  }
}

// Cleanup board subscription
function cleanupBoardSubscription() {
  if (boardSubscription) {
    try {
      if (typeof boardSubscription.unsubscribe === 'function') {
        boardSubscription.unsubscribe();
      } else if (typeof boardSubscription === 'function') {
        boardSubscription();
      }
    } catch (e) {
      console.warn('[Rank Pointer] Error cleaning up board subscription:', e);
    }
    boardSubscription = null;
  }
  
  // Also cleanup rewards screen subscription
  cleanupRewardsScreenSubscription();
}

function shouldAbortAnalysisLoop(analysisId) {
  if (!analysisState.isValidId(analysisId) || !analysisState.isRunning() || analysisState.forceStop) {
    console.log('[Rank Pointer] Stopping analysis');
    return true;
  }
  return false;
}

async function waitForModCoordinationTasks(options = {}) {
  const {
    maxWaitMs = 10000,
    delayMs = 500,
    context = ''
  } = options || {};

  const start = performance.now();
  let waitAttempts = 0;

  const getActiveOperations = () => {
    const ops = [];
    if (window.__modCoordination?.automatorRefilling) ops.push('refilling stamina');
    if (window.__modCoordination?.automatorCollectingRewards) ops.push('collecting rewards');
    if (window.__modCoordination?.automatorHandlingDaycare) ops.push('handling daycare');
    if (window.__modCoordination?.automatorCollectingSeashell) ops.push('collecting seashell');
    return ops;
  };

  // Log initial coordination state
  const initialOps = getActiveOperations();
  const contextSuffix = context ? ` [${context}]` : '';
  console.log(`[Rank Pointer] Checking coordination flags${contextSuffix}:`, {
    automatorRefilling: !!window.__modCoordination?.automatorRefilling,
    automatorCollectingRewards: !!window.__modCoordination?.automatorCollectingRewards,
    automatorHandlingDaycare: !!window.__modCoordination?.automatorHandlingDaycare,
    automatorCollectingSeashell: !!window.__modCoordination?.automatorCollectingSeashell,
    activeOperations: initialOps.length > 0 ? initialOps : 'none'
  });

  let activeOperations = initialOps;

  while (activeOperations.length > 0) {
    const attemptLabel = waitAttempts + 1;
    console.log(`[Rank Pointer] Waiting for Bestiary Automator to finish ${activeOperations.join(', ')}... (${attemptLabel})${contextSuffix}`);

    const elapsed = performance.now() - start;
    if (elapsed >= maxWaitMs) {
      console.warn(`[Rank Pointer] Waited ${Math.round(elapsed)}ms for Bestiary Automator${contextSuffix}, continuing analysis anyway`);
      return;
    }

    await sleep(delayMs);
    waitAttempts++;
    activeOperations = getActiveOperations();
  }

  if (waitAttempts > 0) {
    const elapsed = Math.round(performance.now() - start);
    console.log(`[Rank Pointer] Bestiary Automator finished after ${elapsed}ms, resuming analysis${contextSuffix}`);
  } else {
    console.log(`[Rank Pointer] No Automator operations active, continuing immediately${contextSuffix}`);
  }
}

function prepareAttemptState(nextAttemptNumber) {
  rewardScreenOpen = false;
  // Reset persistent tracking variables for new attempt
  persistentLastTick = 0;
  persistentLastGrade = 'F';
  persistentLastRankPoints = 0;
  console.log(`[Rank Pointer] Reset state for attempt ${nextAttemptNumber}`);
}

async function ensureGameStopped(maxChecks = 5, delayMs = 80) {
  const startTime = performance.now();
  let stopWaitCount = 0;
  console.log('[Rank Pointer] Checking if game has stopped...');
  while (stopWaitCount < maxChecks) {
    const boardContext = globalThis.state.board.getSnapshot().context;
    if (!boardContext.gameStarted) {
      const elapsed = Math.round(performance.now() - startTime);
      console.log(`[Rank Pointer] Game stopped after ${elapsed}ms (${stopWaitCount} checks)`);
      break;
    }
    await sleep(delayMs);
    stopWaitCount++;
  }
  
  if (stopWaitCount >= maxChecks) {
    console.log(`[Rank Pointer] Game state still showing as started after ${stopWaitCount * delayMs}ms, continuing anyway`);
  }
}

async function ensureRewardScreenHandled() {
  let isRewardScreenOpen = false;
  try {
    const openRewards = globalThis.state.board.select((ctx) => ctx.openRewards);
    isRewardScreenOpen = openRewards.getSnapshot();
    console.log(`[Rank Pointer] Verified reward screen state: ${isRewardScreenOpen}, rewardScreenOpen flag: ${rewardScreenOpen}`);
  } catch (e) {
    console.log('[Rank Pointer] Could not check openRewards state, using flag');
    isRewardScreenOpen = rewardScreenOpen;
  }

  if (!isRewardScreenOpen) {
    console.log('[Rank Pointer] Reward screen is not open, skipping close step');
    return;
  }

  await waitForModCoordinationTasks({ context: 'reward screen handling' });

  const closeStart = performance.now();
  console.log('[Rank Pointer] Closing reward screen after game completion...');
  closeRewardScreen();
  await sleep(200);

  const rewardClosed = await waitForRewardScreenToClose(2500);
  const closeElapsed = Math.round(performance.now() - closeStart);
  
  if (!rewardClosed) {
    console.warn(`[Rank Pointer] Reward screen did not close within timeout (${closeElapsed}ms), trying ESC key...`);
    dispatchEsc();
    await sleep(1000);
    try {
      const openRewards = globalThis.state.board.select((ctx) => ctx.openRewards);
      const isOpen = openRewards.getSnapshot();
      if (isOpen) {
        console.error('[Rank Pointer] Reward screen still open after ESC key - this may cause issues');
      } else {
        console.log('[Rank Pointer] Reward screen closed after ESC key');
        rewardScreenOpen = false;
      }
    } catch (e) {
      console.log('[Rank Pointer] Could not check reward screen state after ESC');
    }
  } else {
    console.log(`[Rank Pointer] Reward screen closed successfully in ${closeElapsed}ms, processing result...`);
  }
}

async function waitForServerResults(maxWaitTime = 2000) {
  let serverResults = null;
  const waitStart = performance.now();

  while (!serverResults && (performance.now() - waitStart) < maxWaitTime) {
    const contextServerResults = globalThis.state?.board?.getSnapshot?.()?.context?.serverResults;
    if (contextServerResults && contextServerResults.rewardScreen && typeof contextServerResults.seed !== 'undefined') {
      serverResults = JSON.parse(JSON.stringify(contextServerResults));
      console.log('[Rank Pointer] Got serverResults from context, seed:', serverResults.seed, 'victory:', serverResults.rewardScreen.victory);
      break;
    }

    if (pendingServerResults.size > 0) {
      const lastSeed = Array.from(pendingServerResults.keys()).pop();
      serverResults = pendingServerResults.get(lastSeed);
      pendingServerResults.delete(lastSeed);
      console.log('[Rank Pointer] Got serverResults from pending map, seed:', serverResults?.seed, 'victory:', serverResults?.rewardScreen?.victory);
      break;
    }

    await sleep(50);
  }

  return serverResults;
}

function updateVictoryDefeatCounters(isVictory) {
  if (isVictory) {
    victoriesCount++;
  } else {
    defeatsCount++;
  }
}

function trackStaminaUsage(serverResults, attemptNumber) {
  let attemptStaminaSpent = 0;
  if (typeof serverResults?.next?.playerExpDiff === 'number') {
    attemptStaminaSpent = serverResults.next.playerExpDiff;
    totalStaminaSpent += attemptStaminaSpent;
    console.log(`[Rank Pointer] Stamina spent this attempt: ${attemptStaminaSpent}, total: ${totalStaminaSpent}`);
  } else {
    console.warn(`[Rank Pointer] No valid playerExpDiff found in serverResults for attempt ${attemptNumber}`);
  }
  return attemptStaminaSpent;
}

function createAttemptData({ attemptNumber, result, runTime, serverResults, attemptStaminaSpent, attemptSeed, isVictory }) {
  return {
    attemptNumber,
    ticks: result.ticks,
    grade: result.grade,
    rankPoints: result.rankPoints || 0,
    completed: isVictory,
    victory: isVictory,
    runTimeMs: runTime,
    staminaSpent: attemptStaminaSpent,
    seed: attemptSeed,
    serverResults,
    skipped: !!result.skipped
  };
}

function createForceStopResult() {
  return {
    ticks: 0,
    grade: 'F',
    rankPoints: 0,
    completed: false,
    forceStopped: true
  };
}

function createSkipResult() {
  return {
    ticks: 0,
    grade: 'F',
    rankPoints: 0,
    completed: false,
    skipped: true
  };
}

function getOpenRewardsStateWithFallback() {
  try {
    const openRewards = globalThis.state.board.select((ctx) => ctx.openRewards);
    return openRewards.getSnapshot();
  } catch (e) {
    return rewardScreenOpen;
  }
}

function serverSignalsSkipEnabled() {
  try {
    const ctx = globalThis.state?.board?.getSnapshot?.()?.context;
    return ctx?.serverResults?.enableSkip === true;
  } catch (e) {
    return false;
  }
}

async function handleSkipDetection(message) {
  if (serverSignalsSkipEnabled() && !skipInProgress) {
    skipInProgress = true;
    console.log(message || '[Rank Pointer] enableSkip=true received — attempting to skip');
    await handleSkipButton().finally(() => {
      setTimeout(() => { skipInProgress = false; }, 1200);
    });
    return true;
  }

  const skipButton = findSkipButton();
  if (skipButton) {
    if (!skipInProgress) {
      skipInProgress = true;
      console.log('[Rank Pointer] Skip button detected — handling...');
      await handleSkipButton();
      setTimeout(() => { skipInProgress = false; }, 1200);
      return true;
    }
  }

  return false;
}

function createTextElement(tag, { id, text, style, className } = {}) {
  const el = document.createElement(tag);
  if (id) {
    el.id = id;
  }
  if (typeof text === 'string') {
    el.textContent = text;
  }
  if (style) {
    el.style.cssText = style;
  }
  if (className) {
    el.className = className;
  }
  return el;
}

function appendStatRow(container, labelText, valueText, { labelStyle, valueStyle } = {}) {
  const defaultLabelStyle = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
  const defaultValueStyle = 'text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

  const label = createTextElement('div', {
    text: labelText,
    style: labelStyle || defaultLabelStyle
  });

  const value = createTextElement('div', {
    text: valueText,
    style: valueStyle || defaultValueStyle
  });

  container.appendChild(label);
  container.appendChild(value);
  return { label, value };
}

function updateTextContent(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

// Main function to run until victory
async function runUntilVictory(targetRankPoints = null, statusCallback = null) {
  const thisAnalysisId = analysisState.start();
  let startTime = null;
  
  try {
    // Reset attempts array and tracking variables
    allAttempts = [];
    defeatsCount = 0;
    victoriesCount = 0;
    totalStaminaSpent = 0;
    
    // Setup board subscription to capture serverResults
    setupBoardSubscription();
    
    // Setup rewards screen subscription to auto-close reward screens
    setupRewardsScreenSubscription();
    
    // Setup persistent gameTimer subscription to track game data
    setupGameTimerSubscription();
    
    // Ensure manual mode
    ensureManualMode();
    await sleep(100);
    
    // Hide game board if configured
    if (config.hideGameBoard) {
      const gameFrame = document.querySelector('main .frame-4');
      if (gameFrame) {
        gameFrame.style.display = 'none';
      }
    }
    
    attemptCount = 0;
    startTime = performance.now();
    
    while (true) {
      if (shouldAbortAnalysisLoop(thisAnalysisId)) {
        break;
      }

      attemptCount++;
      currentRunStartTime = performance.now();

      if (statusCallback) {
        statusCallback({
          attempts: attemptCount,
          defeats: defeatsCount,
          victories: victoriesCount,
          staminaSpent: totalStaminaSpent,
          status: 'running'
        });
      }

      console.log(`[Rank Pointer] Attempt ${attemptCount}: Starting game...`);

      await waitForModCoordinationTasks({ context: `pre-start attempt ${attemptCount}` });
      prepareAttemptState(attemptCount + 1);

      if (!clickStartButton()) {
        console.error('[Rank Pointer] Failed to find start button');
        break;
      }

      await sleep(200);

      const result = await waitForGameCompletion(thisAnalysisId);
      if (result && result.skipped) {
        skipCount += 1;
      }

      await ensureRewardScreenHandled();
      await waitForModCoordinationTasks({ context: `post-attempt cleanup ${attemptCount}` });

      if (result.forceStopped) {
        console.log('[Rank Pointer] Analysis stopped');
        break;
      }

      const runTime = performance.now() - currentRunStartTime;
      const serverResults = await waitForServerResults();

      let isVictory = result.completed;

      if (serverResults && serverResults.rewardScreen) {
        const serverVictory = serverResults.rewardScreen.victory === true;
        console.log(`[Rank Pointer] Victory status - serverResults: ${serverVictory}, result.completed: ${result.completed}`);
        if (typeof serverResults.rewardScreen.victory === 'boolean') {
          isVictory = serverVictory;
        }
      } else {
        console.warn('[Rank Pointer] No serverResults available, using result.completed:', result.completed);
      }

      console.log(`[Rank Pointer] Final victory determination: ${isVictory}`);
      updateVictoryDefeatCounters(isVictory);

      const attemptStaminaSpent = trackStaminaUsage(serverResults, attemptCount);

      let attemptSeed = null;
      if (serverResults && typeof serverResults.seed !== 'undefined') {
        attemptSeed = serverResults.seed;
      }

      const attemptData = createAttemptData({
        attemptNumber: attemptCount,
        result,
        runTime,
        serverResults,
        attemptStaminaSpent,
        attemptSeed,
        isVictory
      });

      allAttempts.push(attemptData);

      console.log(`[Rank Pointer] Attempt ${attemptCount} completed:`, {
        ticks: result.ticks,
        grade: result.grade,
        rankPoints: result.rankPoints,
        completed: isVictory,
        victory: isVictory,
        victoryFromServer: serverResults?.rewardScreen?.victory,
        time: runTime,
        hasServerResults: !!serverResults,
        defeatsCount: defeatsCount,
        totalStaminaSpent: totalStaminaSpent,
        serverResultsKeys: serverResults ? Object.keys(serverResults) : null
      });

      if (serverResults) {
        console.log('[Rank Pointer] serverResults structure:', {
          hasRewardScreen: !!serverResults.rewardScreen,
          hasNext: !!serverResults.next,
          rewardScreenKeys: serverResults.rewardScreen ? Object.keys(serverResults.rewardScreen) : null,
          nextKeys: serverResults.next ? Object.keys(serverResults.next) : null
        });
      }
      
      // Check if stop was requested during this run (after recording attempt data)
      if (!analysisState.isRunning()) {
        console.log('[Rank Pointer] Stop requested - current run finished and recorded, stopping now');
        break;
      }

      if (statusCallback) {
        statusCallback({
          attempts: attemptCount,
          defeats: defeatsCount,
          victories: victoriesCount,
          staminaSpent: totalStaminaSpent,
          status: 'running'
        });
      }

      const victoryConditionMet = isVictory && (
        config.stopCondition === 'any' ||
        targetRankPoints == null ||
        (typeof result.rankPoints === 'number' && result.rankPoints >= targetRankPoints)
      );

      let victoryContinueDueToTicks = false;

      if (victoryConditionMet) {
        if (config.stopWhenTicksReached > 0) {
          if (result.ticks <= config.stopWhenTicksReached) {
            const totalTime = performance.now() - startTime;
            console.log(`[Rank Pointer] ✓ VICTORY DETECTED${targetRankPoints != null ? ` with rank ${result.rankPoints} (target S+${targetRankPoints})` : ''} and ticks ${result.ticks} <= ${config.stopWhenTicksReached}. Stopping analysis.`);
            console.log(`[Rank Pointer] Victory achieved after ${attemptCount} attempts! Total time: ${formatMilliseconds(totalTime)}`);
            console.log('[Rank Pointer] Result details:', {
              ticks: result.ticks,
              grade: result.grade,
              rankPoints: result.rankPoints,
              serverVictory: serverResults?.rewardScreen?.victory,
              isVictory: isVictory,
              resultCompleted: result.completed
            });
            console.log('[Rank Pointer] About to return from runUntilVictory with success: true');
            console.log('[Rank Pointer] Current analysisState:', analysisState.state);
            console.log('[Rank Pointer] All attempts collected:', allAttempts.length);

            const finalResult = {
              ...result,
              completed: true,
              victory: true
            };

            const returnValue = {
              success: true,
              attempts: attemptCount,
              finalResult,
              totalTimeMs: totalTime,
              allAttempts
            };

            console.log('[Rank Pointer] Returning victory result:', {
              success: returnValue.success,
              attempts: returnValue.attempts,
              totalTimeMs: returnValue.totalTimeMs,
              allAttemptsLength: returnValue.allAttempts.length
            });

            return returnValue;
          } else {
            victoryContinueDueToTicks = true;
            console.log(`[Rank Pointer] ✓ VICTORY DETECTED${targetRankPoints != null ? ` with rank ${result.rankPoints} (target S+${targetRankPoints})` : ''} but ticks ${result.ticks} > ${config.stopWhenTicksReached}, continuing to find better run...`);
          }
        } else {
          const totalTime = performance.now() - startTime;
          console.log(`[Rank Pointer] ✓ VICTORY DETECTED${targetRankPoints != null ? ` with rank ${result.rankPoints} (target S+${targetRankPoints})` : ''}. Stopping analysis.`);
          console.log(`[Rank Pointer] Victory achieved after ${attemptCount} attempts! Total time: ${formatMilliseconds(totalTime)}`);
          console.log('[Rank Pointer] Result details:', {
            ticks: result.ticks,
            grade: result.grade,
            rankPoints: result.rankPoints,
            serverVictory: serverResults?.rewardScreen?.victory,
            isVictory: isVictory,
            resultCompleted: result.completed
          });
          console.log('[Rank Pointer] About to return from runUntilVictory with success: true');
          console.log('[Rank Pointer] Current analysisState:', analysisState.state);
          console.log('[Rank Pointer] All attempts collected:', allAttempts.length);

          const finalResult = {
            ...result,
            completed: true,
            victory: true
          };

          const returnValue = {
            success: true,
            attempts: attemptCount,
            finalResult,
            totalTimeMs: totalTime,
            allAttempts
          };

          console.log('[Rank Pointer] Returning victory result:', {
            success: returnValue.success,
            attempts: returnValue.attempts,
            totalTimeMs: returnValue.totalTimeMs,
            allAttemptsLength: returnValue.allAttempts.length
          });

          return returnValue;
        }
      }

      if (victoryContinueDueToTicks) {
        console.log('[Rank Pointer] Victory found but didn\'t meet ticks threshold, restarting to find better run...');
      } else {
        console.log(`[Rank Pointer] Defeat on attempt ${attemptCount} - will restart`);
      }

      const cleanupStart = performance.now();
      console.log('[Rank Pointer] Starting post-attempt cleanup...');
      
      await ensureGameStopped();

      if (rewardScreenOpen) {
        console.log('[Rank Pointer] Reward screen is open, closing it...');
        closeRewardScreen();
      }

      const screenClosed = await waitForRewardScreenToClose(3000);
      if (screenClosed) {
        console.log('[Rank Pointer] Reward screen closed, ready to continue');
      } else {
        console.warn('[Rank Pointer] Reward screen did not close in time, continuing anyway');
      }

      await waitForModCoordinationTasks({ context: `post-attempt cleanup ${attemptCount}` });

      console.log(`[Rank Pointer] Waiting ${GAME_RESTART_DELAY_MS}ms before next attempt...`);
      await sleep(GAME_RESTART_DELAY_MS);
      
      const cleanupElapsed = Math.round(performance.now() - cleanupStart);
      console.log(`[Rank Pointer] Cleanup complete in ${cleanupElapsed}ms, ready to start attempt ${attemptCount + 1}`);
    }
    
    const totalTime = performance.now() - startTime;
    return {
      success: false,
      attempts: attemptCount,
      forceStopped: true,
      totalTimeMs: totalTime,
      allAttempts: allAttempts
    };
    
  } catch (error) {
    console.error('[Rank Pointer] Error during analysis:', error);
    const totalTime = startTime ? performance.now() - startTime : 0;
    return {
      success: false,
      attempts: attemptCount,
      error: error.message,
      totalTimeMs: totalTime,
      allAttempts: allAttempts
    };
  } finally {
    // Cleanup - ensure state is reset
    console.log('[Rank Pointer] runUntilVictory finally block entered');
    console.log('[Rank Pointer] Current state before reset:', analysisState.state);
    console.log('[Rank Pointer] attemptCount at finally:', attemptCount);
    console.log('[Rank Pointer] allAttempts length at finally:', allAttempts.length);
    analysisState.reset();
    console.log('[Rank Pointer] State after reset:', analysisState.state);
    console.log('[Rank Pointer] runUntilVictory finally block completed');
    
    // Cleanup board subscription
    cleanupBoardSubscription();
    
    // Cleanup gameTimer subscription
    cleanupGameTimerSubscription();
    
    // Restore game board visibility
    if (config.hideGameBoard) {
      const gameFrame = document.querySelector('main .frame-4');
      if (gameFrame && gameFrame.style.display === 'none') {
        gameFrame.style.display = '';
      }
    }
    
    // Clean up game state tracker if no more listeners
    if (gameStateTracker && gameStateTracker.listeners.size === 0) {
      gameStateTracker.stopSubscription();
      gameStateTracker = null;
    }
  }
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

// Serialize board configuration for replay (like Board Analyzer)
function serializeBoard() {
  try {
    if (typeof window.$serializeBoard === 'function') {
      return JSON.parse(window.$serializeBoard());
    } else if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.serializeBoard) {
      return JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
    }
    
    // Fallback: manual serialization if API not available
    const boardContext = globalThis.state.board.getSnapshot().context;
    const boardConfig = boardContext.boardConfig;
    const selectedMap = boardContext.selectedMap || {};
    
    // This is a simplified version - would need full implementation for all piece types
    console.warn('[Rank Pointer] Board serialization API not available, replay may not work correctly');
    return null;
  } catch (error) {
    console.error('[Rank Pointer] Error serializing board:', error);
    return null;
  }
}

// Create replay data for a specific attempt (like Board Analyzer)
function createReplayDataForAttempt(attempt) {
  try {
    if (!attempt.seed) {
      console.warn('[Rank Pointer] No seed available for attempt', attempt.attemptNumber);
      return null;
    }
    
    // Try to get board data using API utilities
    let boardData = null;
    if (typeof window.$serializeBoard === 'function') {
      boardData = JSON.parse(window.$serializeBoard());
    } else if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.serializeBoard) {
      boardData = JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
    } else {
      // Fallback: use serverResults if available (contains board info)
      if (attempt.serverResults && attempt.serverResults.rewardScreen) {
        // ServerResults doesn't have full board setup, so we need to serialize current board
        boardData = serializeBoard();
      }
    }
    
    if (!boardData) {
      console.warn('[Rank Pointer] Could not get board data for attempt', attempt.attemptNumber);
      return null;
    }
    
    // Add seed to board data
    boardData.seed = attempt.seed;
    
    // Verify required fields
    if (!boardData.region || !boardData.map || !boardData.board) {
      console.warn('[Rank Pointer] Board data missing required fields:', boardData);
      return null;
    }
    
    return boardData;
  } catch (error) {
    console.error('[Rank Pointer] Error creating replay data for attempt:', error);
    return null;
  }
}

// Function to copy text to clipboard (like Board Analyzer)
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
    console.error('[Rank Pointer] Failed to copy text:', err);
  }
  
  document.body.removeChild(textarea);
  return success;
}

// Function to show copy notification (like Board Analyzer)
function showCopyNotification(message, isError = false) {
  const NOTIFICATION_DISPLAY_MS = 3000;
  
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
  
  // Remove after specified time
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, NOTIFICATION_DISPLAY_MS);
}

// =======================
// 5. UI Management
// =======================

// Check if board has ally creatures (player pieces)
function hasAllyCreaturesOnBoard() {
  try {
    const boardContext = globalThis.state?.board?.getSnapshot()?.context;
    if (!boardContext || !boardContext.boardConfig || !Array.isArray(boardContext.boardConfig)) {
      return false;
    }
    
    // Check for player pieces (type: 'player' or type: 'custom' with villain: false)
    const hasAlly = boardContext.boardConfig.some(piece => {
      if (!piece) return false;
      // Player pieces are type 'player' or 'custom' with villain: false
      return (piece.type === 'player') || 
             (piece.type === 'custom' && piece.villain === false);
    });
    
    return hasAlly;
  } catch (error) {
    console.warn('[Rank Pointer] Error checking for ally creatures:', error);
    return false;
  }
}

// Create the configuration panel UI
function createConfigPanel() {
  // Reload config from localStorage to ensure we have the latest values
  // This ensures the config is always current, even if the mod was reloaded
  const currentConfig = loadConfig();
  Object.assign(config, currentConfig);
  
  const content = document.createElement('div');
  content.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

  // Stop condition dropdown
  const stopContainer = document.createElement('div');
  stopContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 8px;';
  const stopLabel = document.createElement('label');
  stopLabel.textContent = t('mods.rankPointer.stopWhenLabel');
  const stopSelect = document.createElement('select');
  stopSelect.id = `${CONFIG_PANEL_ID}-stop-select`;
  stopSelect.style.cssText = 'min-width: 160px; background-color: #222; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px;';
  const optMax = document.createElement('option');
  optMax.value = 'max';
  optMax.textContent = t('mods.rankPointer.stopWhenMax');
  const optAny = document.createElement('option');
  optAny.value = 'any';
  optAny.textContent = t('mods.rankPointer.stopWhenAny');
  stopSelect.appendChild(optMax);
  stopSelect.appendChild(optAny);
  stopSelect.value = (config.stopCondition === 'any') ? 'any' : 'max';
  stopContainer.appendChild(stopLabel);
  stopContainer.appendChild(stopSelect);
  content.appendChild(stopContainer);

  // Stop when ticks reached input
  const stopWhenTicksContainer = document.createElement('div');
  stopWhenTicksContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
  
  const stopWhenTicksLabel = document.createElement('label');
  stopWhenTicksLabel.textContent = t('mods.rankPointer.stopWhenTicksReachedLabel');
  
  const stopWhenTicksInput = document.createElement('input');
  stopWhenTicksInput.type = 'number';
  stopWhenTicksInput.id = `${CONFIG_PANEL_ID}-stop-when-ticks-input`;
  stopWhenTicksInput.min = '0';
  stopWhenTicksInput.max = '3840'; // 4 minutes (240,000ms / 62.5ms per tick = 3,840 ticks)
  stopWhenTicksInput.value = config.stopWhenTicksReached || 0;
  stopWhenTicksInput.style.cssText = 'width: 80px; text-align: center; background-color: #333; color: #fff; border: 1px solid #555; padding: 4px 8px; border-radius: 4px;';
  
  stopWhenTicksContainer.appendChild(stopWhenTicksLabel);
  stopWhenTicksContainer.appendChild(stopWhenTicksInput);
  content.appendChild(stopWhenTicksContainer);

  // Hide game board checkbox
  const hideContainer = document.createElement('div');
  hideContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  
  const hideInput = document.createElement('input');
  hideInput.type = 'checkbox';
  hideInput.id = `${CONFIG_PANEL_ID}-hide-input`; // Make ID unique to this panel
  hideInput.checked = Boolean(config.hideGameBoard); // Explicit boolean conversion
  
  const hideLabel = document.createElement('label');
  hideLabel.htmlFor = hideInput.id;
  hideLabel.textContent = t('mods.rankPointer.hideGameBoardDuringRuns');
  
  hideContainer.appendChild(hideInput);
  hideContainer.appendChild(hideLabel);
  content.appendChild(hideContainer);

  // Enable auto-refill stamina (Bestiary Automator integration)
  const refillContainer = document.createElement('div');
  refillContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  const refillInput = document.createElement('input');
  refillInput.type = 'checkbox';
  refillInput.id = `${CONFIG_PANEL_ID}-refill-input`;
  refillInput.checked = Boolean(config.enableAutoRefillStamina);
  const refillLabel = document.createElement('label');
  refillLabel.htmlFor = refillInput.id;
  refillLabel.textContent = t('mods.rankPointer.enableAutoRefill');
  refillContainer.appendChild(refillInput);
  refillContainer.appendChild(refillLabel);
  content.appendChild(refillContainer);

  // Check if board has ally creatures
  const hasAlly = hasAllyCreaturesOnBoard();
  
  // Add warning message if no ally creatures
  if (!hasAlly) {
    content.appendChild(createTextElement('div', {
      text: t('mods.boardAnalyzer.noAllyWarning'),
      style: 'color: #e74c3c; margin-top: 8px; padding: 8px; background-color: rgba(231, 76, 60, 0.1); border-radius: 4px; font-size: 0.9em;'
    }));
  }
  
  // Create buttons array - use closure to access hideInput directly
  const buttons = [
    {
      text: t('mods.rankPointer.start'),
      primary: true,
      disabled: !hasAlly || !analysisState.canStart(), // Disable if no ally creatures or already running
      onClick: () => {
        console.log('[Rank Pointer] Start button clicked, canStart:', analysisState.canStart(), 'state:', analysisState.state);
        
        // Double-check ally creatures (in case board changed since panel opened)
        if (!hasAllyCreaturesOnBoard()) {
          console.log('[Rank Pointer] No ally creatures on board, cannot start');
          api.ui.components.createModal({
            title: t('mods.rankPointer.cannotStartTitle'),
            content: t('mods.boardAnalyzer.noAllyWarning'),
            buttons: [{ text: t('controls.ok'), primary: true }]
          });
          return;
        }
        
        if (!analysisState.canStart()) {
          console.log('[Rank Pointer] Already running, cannot start. Current state:', analysisState.state);
          // Force reset if stuck in stopping state
          if (analysisState.isStopping()) {
            console.log('[Rank Pointer] Force resetting from STOPPING state');
            analysisState.reset();
          }
          return;
        }
        
        // Update configuration using the direct reference
        config.hideGameBoard = hideInput.checked;
        config.stopCondition = stopSelect.value === 'any' ? 'any' : 'max';
        config.enableAutoRefillStamina = refillInput.checked;
        config.stopWhenTicksReached = parseInt(document.getElementById(`${CONFIG_PANEL_ID}-stop-when-ticks-input`).value, 10) || 0;
        // Save to localStorage (preferred method)
        saveConfig();
        // Also save via API for backward compatibility
        api.service.updateScriptConfig(context.hash, {
          hideGameBoard: config.hideGameBoard,
          stopCondition: config.stopCondition,
          enableAutoRefillStamina: config.enableAutoRefillStamina,
          stopWhenTicksReached: config.stopWhenTicksReached
        });
        console.log('[Rank Pointer] Config saved on Start,', {
          hideGameBoard: config.hideGameBoard,
          stopCondition: config.stopCondition,
          enableAutoRefillStamina: config.enableAutoRefillStamina,
          stopWhenTicksReached: config.stopWhenTicksReached
        });
        
        // Close config panel
        if (activeConfigPanel) {
          try {
            api.ui.hideAllConfigPanels();
          } catch (e) {
            console.error('Failed to hide config panels:', e);
          }
        }
        
        // Start analysis
        runAnalysis();
      }
    },
    {
      text: t('mods.rankPointer.save'),
      primary: false,
      disabled: !analysisState.canStart(),
      onClick: () => {
        // Use direct reference to the checkbox element
        config.hideGameBoard = hideInput.checked;
        config.stopCondition = stopSelect.value === 'any' ? 'any' : 'max';
        config.enableAutoRefillStamina = refillInput.checked;
        config.stopWhenTicksReached = parseInt(document.getElementById(`${CONFIG_PANEL_ID}-stop-when-ticks-input`).value, 10) || 0;
        // Save to localStorage (preferred method)
        saveConfig();
        // Also save via API for backward compatibility
        api.service.updateScriptConfig(context.hash, {
          hideGameBoard: config.hideGameBoard,
          stopCondition: config.stopCondition,
          enableAutoRefillStamina: config.enableAutoRefillStamina,
          stopWhenTicksReached: config.stopWhenTicksReached
        });
        console.log('[Rank Pointer] Config saved', {
          hideGameBoard: config.hideGameBoard,
          stopCondition: config.stopCondition,
          enableAutoRefillStamina: config.enableAutoRefillStamina,
          stopWhenTicksReached: config.stopWhenTicksReached
        });
      }
    },
    {
      text: t('mods.rankPointer.cancel'),
      primary: false
    }
  ];

  // Separator and credit footer
  const separator = document.createElement('div');
  separator.style.cssText = 'margin-top: 8px; border-top: 1px solid #444; opacity: 0.6;';
  const credit = document.createElement('div');
  credit.style.cssText = 'margin-top: 2px; font-size: 11px; font-style: italic; color: #aaa; text-align: right;';
  const linkHtml = '<a href="https://bestiaryarena.com/profile/btlucas" target="_blank" rel="noopener noreferrer" style="color:#61AFEF; text-decoration: underline;">btlucas</a>';
  credit.innerHTML = t('mods.rankPointer.madeWithHelp').replace('{link}', linkHtml);
  content.appendChild(separator);
  content.appendChild(credit);

  // Create and return the config panel
  const panel = api.ui.createConfigPanel({
    id: CONFIG_PANEL_ID,
    title: 'Rank Pointer Configuration',
    modId: MOD_ID,
    content: content,
    buttons: buttons
  });
  
  // Manually disable Start button if no ally creatures (in case disabled property isn't supported)
  if (!hasAlly && panel && panel.element) {
    setTimeout(() => {
      // Find the Start button in the panel and disable it
      const startButton = panel.element.querySelector('button');
        if (startButton && startButton.textContent.trim() === t('mods.rankPointer.start')) {
        startButton.disabled = true;
        startButton.style.opacity = '0.5';
        startButton.style.cursor = 'not-allowed';
      }
    }, 50);
  }
  
  activeConfigPanel = panel;
  return panel;
}

// Show running analysis modal
function showRunningAnalysisModal(
  attempts,
  defeats = 0,
  victories = 0,
  staminaSpent = 0,
  targetRankPoints = null,
  showVictories = false
) {
  // First, force close any existing modals (like Board Analyzer does)
  forceCloseAllModals();
  
  const content = document.createElement('div');
  content.style.cssText = 'text-align: center;';
  
  const message = createTextElement('p', {
    id: 'rank-pointer-target',
    text: targetRankPoints != null
      ? t('mods.rankPointer.runningUntilTarget').replace('{points}', targetRankPoints)
      : t('mods.rankPointer.runningUntilVictory')
  });
  content.appendChild(message);

  const progress = createTextElement('p', {
    id: 'rank-pointer-progress',
    text: t('mods.rankPointer.attempt').replace('{n}', attempts),
    style: 'margin-top: 12px;'
  });
  content.appendChild(progress);
  
  // Add victories count only when tracking ticks threshold
  if (showVictories) {
    const victoriesElement = createTextElement('p', {
      id: 'rank-pointer-victories',
      text: t('mods.rankPointer.victories').replace('{n}', victories),
      style: 'margin-top: 8px; color: #2ecc71;'
    });
    content.appendChild(victoriesElement);
  }
  
  // Add defeats count
  const defeatsElement = createTextElement('p', {
    id: 'rank-pointer-defeats',
    text: t('mods.rankPointer.defeats').replace('{n}', defeats),
    style: 'margin-top: 8px; color: #e74c3c;'
  });
  content.appendChild(defeatsElement);
  
  // Add stamina usage
  const staminaElement = createTextElement('p', {
    id: 'rank-pointer-stamina',
    text: t('mods.rankPointer.staminaSpent').replace('{n}', staminaSpent),
    style: 'margin-top: 8px; color: #3498db;'
  });
  content.appendChild(staminaElement);
  
  // Create self-contained HTML modal to avoid conflicts with other modals
  injectRankPointerStyles();
  const wrapper = document.createElement('div');
  wrapper.id = 'rank-pointer-running-modal';
  wrapper.dataset.pointerModal = 'running';
  wrapper.setAttribute('role', 'dialog');
  wrapper.setAttribute('aria-label', t('mods.rankPointer.runningHeader'));
  // Position only; visual theme comes from CSS to match Hunt Analyzer
  wrapper.className = 'rank-pointer-modal';
  wrapper.style.cssText = ['position: absolute','left: 12px','bottom: 12px'].join(';');

  const header = document.createElement('div');
  header.textContent = t('mods.rankPointer.runningHeader');
  header.className = 'rank-pointer-modal-header';

  const body = document.createElement('div');
  body.className = 'rank-pointer-modal-body';
  body.appendChild(content);

  const footer = document.createElement('div');
  footer.className = 'rank-pointer-modal-footer';

  const stopBtn = document.createElement('button');
  stopBtn.type = 'button';
  stopBtn.textContent = t('mods.rankPointer.stop');
  stopBtn.className = 'rank-pointer-button';
  stopBtn.addEventListener('click', (e) => {
    console.log('[Rank Pointer] Stop button clicked, current state:', analysisState.state);
    analysisState.stop();
    console.log('[Rank Pointer] After stop(), state:', analysisState.state);
    stopBtn.disabled = true;
    stopBtn.textContent = t('mods.rankPointer.stopping');
  });

  footer.appendChild(stopBtn);
  wrapper.appendChild(header);
  wrapper.appendChild(body);
  wrapper.appendChild(footer);

  // Intentionally do not bind ESC to close the running modal.
  // The running/progress modal must remain open until Stop is clicked
  // or a victory condition shows the result screen.

  // Attach to <main> when available to keep it within game area; fallback to body
  const mountPoint = document.querySelector('main') || document.body;
  mountPoint.appendChild(wrapper);

  // Provide a modal-like object compatible with our ModalManager
  const modalObject = {
    type: MODAL_TYPES.RUNNING,
    element: wrapper,
    close: () => {
      if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
    }
  };

  modalManager.register('running-modal', modalObject);
  activeRunningModal = modalObject;
  return modalObject;
}

// Calculate statistics from attempts
function calculateStatistics(attempts) {
  if (!attempts || attempts.length === 0) {
    return {
      totalAttempts: 0,
      completedAttempts: 0,
      sPlusCount: 0,
      sPlusRate: '0.00',
      completionRate: '0.00',
      minTicks: 0,
      maxTicks: 0,
      medianTicks: 0,
      averageTicks: 0,
      maxRankPoints: 0,
      ticksArray: [],
      rankPointsArray: [],
      staminaSpentTotal: 0,
      skips: 0
    };
  }
  
  const completedAttempts = attempts.filter(a => a.completed);
  const sPlusAttempts = attempts.filter(a => a.completed && a.grade === 'S+');
  const ticksArray = attempts.map(a => a.ticks);
  const rankPointsArray = attempts.filter(a => a.rankPoints).map(a => a.rankPoints);
  
  const sPlusRate = attempts.length > 0 ? (sPlusAttempts.length / attempts.length * 100).toFixed(2) : '0.00';
  const completionRate = attempts.length > 0 ? (completedAttempts.length / attempts.length * 100).toFixed(2) : '0.00';
  
  const minTicks = completedAttempts.length > 0 ? Math.min(...completedAttempts.map(a => a.ticks)) : 0;
  const maxTicks = attempts.length > 0 ? Math.max(...ticksArray) : 0;
  const averageTicks = ticksArray.length > 0 ? ticksArray.reduce((a, b) => a + b, 0) / ticksArray.length : 0;
  
  // Calculate median
  let medianTicks = 0;
  if (ticksArray.length > 0) {
    const sorted = [...ticksArray].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianTicks = sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }
  
  const maxRankPoints = rankPointsArray.length > 0 ? Math.max(...rankPointsArray) : 0;
  
  const staminaSpentTotal = attempts.reduce((sum, a) => sum + (a.staminaSpent || 0), 0);
  const skips = attempts.filter(a => a.skipped).length;

  return {
    totalAttempts: attempts.length,
    completedAttempts: completedAttempts.length,
    sPlusCount: sPlusAttempts.length,
    sPlusRate,
    completionRate,
    minTicks,
    maxTicks,
    medianTicks: Math.round(medianTicks),
    averageTicks: Math.round(averageTicks),
    maxRankPoints,
    ticksArray,
    rankPointsArray,
    staminaSpentTotal,
    skips
  };
}

// Ensure openRewards screen is fully closed and scroll lock is cleared before showing results
async function ensureResultsSafeToOpen(timeoutMs = ENSURE_RESULTS_SAFE_TIMEOUT_MS) {
  try {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const body = document.body;
      const isLocked = body && body.getAttribute && body.getAttribute('data-scroll-locked') === '1';
      if (!isLocked) {
        return true;
      }
      // Just dispatch ESC to close any remaining modals - reward screen is already closed at this point
      dispatchEsc();
      await new Promise(resolve => setTimeout(resolve, ENSURE_RESULTS_POLL_DELAY_MS));
    }
  } catch (e) {
    console.warn('[Rank Pointer] ensureResultsSafeToOpen error:', e);
  }
  return false;
}

// Show results modal
async function showResultsModal(results) {
  console.log('[Rank Pointer] showResultsModal called with results:', {
    success: results?.success,
    attempts: results?.attempts,
    hasAllAttempts: !!results?.allAttempts,
    allAttemptsLength: results?.allAttempts?.length,
    hasFinalResult: !!results?.finalResult
  });

  // Guard against opening while body is scroll-locked (would crash)
  const safeToOpen = await ensureResultsSafeToOpen(ENSURE_RESULTS_SAFE_TIMEOUT_MS);
  if (!safeToOpen) {
    console.warn('[Rank Pointer] Body still scroll-locked; deferring results modal open...');
    setTimeout(() => { try { showResultsModal(results); } catch (_) {} }, DEFER_RESULTS_OPEN_MS);
    return;
  }

  setTimeout(() => {
    console.log('[Rank Pointer] showResultsModal setTimeout callback executing...');
    const content = document.createElement('div');
    
    // Add a note if stopped by user
    if (results.forceStopped && !results.success) {
      content.appendChild(createTextElement('div', {
        text: t('mods.rankPointer.stoppedByUser'),
        style: 'text-align: center; color: #e74c3c; margin-bottom: 15px;'
      }));
    }
    
    // Calculate statistics from all attempts
    const attempts = results.allAttempts || [];
    const stats = calculateStatistics(attempts);
    
    // Create result statistics
    const statsContainer = document.createElement('div');
    statsContainer.style.cssText = 'display: grid; grid-template-columns: 55% 40%; gap: 10px; margin-bottom: 20px;';
    
    appendStatRow(statsContainer, t('mods.rankPointer.totalAttempts'), stats.totalAttempts.toString());

    appendStatRow(statsContainer, t('mods.rankPointer.completionRate'), `${stats.completionRate}% (${stats.completedAttempts}/${stats.totalAttempts})`, {
      valueStyle: 'text-align: right; color: #2ecc71; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
    });

    if (stats.sPlusCount > 0) {
      appendStatRow(statsContainer, t('mods.rankPointer.sPlusRate'), `${stats.sPlusRate}% (${stats.sPlusCount}/${stats.totalAttempts})`, {
        valueStyle: 'text-align: right; color: #FFD700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
      });

      try {
        const sPlusResults = attempts.filter(a => a.grade === 'S+' && a.rankPoints);
        if (sPlusResults.length > 0) {
          const rankPointsCounts = {};
          sPlusResults.forEach(r => {
            const rp = r.rankPoints || 0;
            rankPointsCounts[rp] = (rankPointsCounts[rp] || 0) + 1;
          });
          const sortedRankPoints = Object.keys(rankPointsCounts)
            .map(n => parseInt(n, 10))
            .sort((a, b) => b - a);
          const highestRankPoints = sortedRankPoints[0];
          sortedRankPoints.forEach(rp => {
            const count = rankPointsCounts[rp];
            const rate = stats.totalAttempts > 0 ? (count / stats.totalAttempts * 100).toFixed(2) : '0.00';
            const rankDifference = highestRankPoints - rp;
            const idx = Math.max(0, Math.min(rankDifference, S_PLUS_COLORS.length - 1));
            const textColor = S_PLUS_COLORS[idx];

            appendStatRow(statsContainer, t('mods.rankPointer.sPlusPointsRate').replace('{points}', rp), `${rate}% (${count}/${stats.totalAttempts})`, {
              labelStyle: 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 10px; font-style: italic;',
              valueStyle: `text-align: right; color: ${textColor}; font-style: italic;`
            });
          });
        }
      } catch (e) {
        console.warn('[Rank Pointer] Error creating S+ breakdown:', e);
      }
    }

    if (!results.success) {
      try {
        const maxTeamSizeForTarget = getMaxTeamSize(null);
        const playerTeamSizeForTarget = getPlayerTeamSize();
        const targetRankPoints = Math.max(0, (2 * maxTeamSizeForTarget) - playerTeamSizeForTarget);

        appendStatRow(statsContainer, t('mods.rankPointer.highestRankPoints'), (stats.maxRankPoints || 0).toString(), {
          valueStyle: 'text-align: right; color: #FFD700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
        });

        appendStatRow(statsContainer, t('mods.rankPointer.targetRank'), `S+${targetRankPoints}`, {
          valueStyle: 'text-align: right; color: #FFD700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
        });
      } catch (e) {
        console.warn('[Rank Pointer] Could not compute target rank points for display:', e);
      }
    }

    if (stats.maxRankPoints > 0) {
      appendStatRow(statsContainer, t('mods.rankPointer.maxRankPoints'), stats.maxRankPoints.toString(), {
        valueStyle: 'text-align: right; color: #FFD700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
      });
    }

    appendStatRow(statsContainer, t('mods.rankPointer.staminaSpent').replace(': {n}', ':'), (stats.staminaSpentTotal || 0).toString());

    appendStatRow(statsContainer, t('mods.rankPointer.skips'), (stats.skips || 0).toString());
    
    // If victory, show success message
    if (results.success && results.finalResult) {
      content.appendChild(createTextElement('div', {
        text: t('mods.rankPointer.victoryAchieved'),
        style: 'text-align: center; color: #2ecc71; margin-bottom: 15px; font-size: 1.2em; font-weight: bold;'
      }));

      let finalResultText = results.finalResult.grade || 'N/A';
      if (results.finalResult.grade === 'S+' && results.finalResult.rankPoints) {
        finalResultText = `S+${results.finalResult.rankPoints}`;
      }
      finalResultText += ` (${results.finalResult.ticks} ticks)`;

      appendStatRow(statsContainer, t('mods.rankPointer.finalResult'), finalResultText);
    }
    
    content.appendChild(statsContainer);

    // We only have 1 run: remove graph and provide Copy Replay only when a victory exists
    const victoryAttempt = attempts.find(a => a && (a.completed || a.victory));
    if (victoryAttempt) {
      const replayContainer = document.createElement('div');
      replayContainer.style.cssText = 'margin-top: 12px; display: flex; justify-content: flex-end;';

      const copyReplayBtn = document.createElement('button');
      copyReplayBtn.textContent = t('mods.boardAnalyzer.copyReplayButton');
      copyReplayBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
      copyReplayBtn.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px;';

      copyReplayBtn.addEventListener('click', () => {
        const attempt = victoryAttempt;
        const replayData = createReplayDataForAttempt(attempt);
        if (replayData) {
          const replayText = `$replay(${JSON.stringify(replayData)})`;
          const success = copyToClipboard(replayText);
          if (success) {
            showCopyNotification(t('mods.rankPointer.copiedReplay'));
          } else {
            showCopyNotification(t('mods.rankPointer.failedCopyReplay'), true);
          }
        } else if (attempt && attempt.seed) {
          const seedText = attempt.seed.toString();
          const success = copyToClipboard(seedText);
          if (success) {
            showCopyNotification(t('mods.rankPointer.copiedSeed').replace('{seed}', seedText));
          } else {
            showCopyNotification(t('mods.rankPointer.failedCopySeed'), true);
          }
        } else {
          showCopyNotification(t('mods.rankPointer.noReplayOrSeed'), true);
        }
      });

      replayContainer.appendChild(copyReplayBtn);
      content.appendChild(replayContainer);
    } else {
      content.appendChild(createTextElement('p', {
        text: t('mods.rankPointer.noAttemptsYet'),
        style: 'text-align: center; color: #777; margin-top: 15px;'
      }));
    }
    
    const modal = api.ui.components.createModal({
      title: t('mods.rankPointer.resultsTitle'),
      width: 400,
      content: content,
      buttons: [
        {
          text: t('controls.close'),
          primary: true,
          onClick: () => {
            // One more check for lingering modals when user closes results (like Board Analyzer)
            forceCloseAllModals();
          }
        }
      ]
    });
    
    console.log('[Rank Pointer] Modal created by API:', modal);
    console.log('[Rank Pointer] Modal type:', typeof modal);
    
    // Handle modal - it might be a function (closeModal) or an object
    let modalObject = modal;
    if (typeof modal === 'function') {
      // If it's a function, wrap it in an object with close method
      console.log('[Rank Pointer] Modal is a function, wrapping it...');
      modalObject = {
        close: modal,
        element: null, // Will find in DOM if needed
        type: MODAL_TYPES.RESULTS
      };
    } else if (modal && typeof modal === 'object') {
      // If it's already an object, just add type
      modalObject.type = MODAL_TYPES.RESULTS;
    } else {
      console.error('[Rank Pointer] ERROR: Modal was not created or has unexpected type!');
      return null;
    }
    
    // Find the actual modal element in DOM by title
    setTimeout(() => {
      const modalElements = document.querySelectorAll('[role="dialog"]');
      modalElements.forEach((el) => {
        const header = el.querySelector('.widget-top-text');
        if (header && header.textContent.includes(t('mods.rankPointer.resultsTitle'))) {
          modalObject.element = el;
          console.log('[Rank Pointer] Found modal element in DOM and attached to modalObject');
        }
      });
    }, 50);
    
    // Register results modal with modal manager (like Board Analyzer)
    modalManager.register('results-modal', modalObject);
    
    console.log('[Rank Pointer] Results modal created and registered');
    console.log('[Rank Pointer] Modal object details:', {
      hasModal: !!modalObject,
      hasClose: typeof modalObject?.close === 'function',
      hasElement: !!modalObject?.element,
      type: modalObject?.type
    });
    
    return modalObject;
  }, 100);
  
  console.log('[Rank Pointer] showResultsModal returned (setTimeout scheduled)');
}

// Main entry point - Run the analysis
async function runAnalysis() {
  console.log('[Rank Pointer] runAnalysis called, current state:', analysisState.state, 'canStart:', analysisState.canStart());
  
  if (!analysisState.canStart()) {
    console.log('[Rank Pointer] Already running, cannot start new analysis. State:', analysisState.state);
    return;
  }
  
  // Close any existing modals using modal manager (like Board Analyzer)
  modalManager.closeByType(MODAL_TYPES.RUNNING);
  activeRunningModal = null;
  
  console.log('[Rank Pointer] Cleared any existing running modals');
  
  let runningModal = null;
  
  try {
    // Signal to other mods that Rank Pointer is running (for coordination)
    try {
      window.__modCoordination = window.__modCoordination || {};
      window.__modCoordination.rankPointerRunning = true;
    } catch (_) {}
    // Compute target S+ rank points based on current setup and stop condition
    let targetRankPoints = null;
    if (config.stopCondition !== 'any') {
      const maxTeamSize = getMaxTeamSize(null);
      const playerTeamSize = getPlayerTeamSize();
      targetRankPoints = Math.max(0, (2 * maxTeamSize) - playerTeamSize);
    }

    // Optional: enable auto-refill stamina via Bestiary Automator
    try {
      if (config.enableAutoRefillStamina && window.bestiaryAutomator && typeof window.bestiaryAutomator.updateConfig === 'function') {
        window.bestiaryAutomator.updateConfig({ autoRefillStamina: true });
        console.log('[Rank Pointer] Enabled auto-refill stamina via Bestiary Automator');
      }
    } catch (e) {
      console.warn('[Rank Pointer] Could not enable auto-refill stamina via Bestiary Automator:', e);
    }
    
    // Show running modal with target info
    runningModal = showRunningAnalysisModal(
      0,
      0,
      0,
      0,
      targetRankPoints,
      config.stopWhenTicksReached > 0
    );
    activeRunningModal = runningModal;
    
    // Run until victory with status updates
    console.log('[Rank Pointer] Starting runUntilVictory, about to await...');
    const results = await runUntilVictory(targetRankPoints, (status) => {
      updateTextContent('rank-pointer-progress', t('mods.rankPointer.attempt').replace('{n}', status.attempts));

      if (typeof targetRankPoints === 'number') {
        updateTextContent('rank-pointer-target', t('mods.rankPointer.runningUntilTarget').replace('{points}', targetRankPoints));
      } else {
        updateTextContent('rank-pointer-target', t('mods.rankPointer.runningUntilVictory'));
      }

      if (status.victories !== undefined) {
        updateTextContent('rank-pointer-victories', t('mods.rankPointer.victories').replace('{n}', status.victories));
      }

      if (status.defeats !== undefined) {
        updateTextContent('rank-pointer-defeats', t('mods.rankPointer.defeats').replace('{n}', status.defeats));
      }

      if (status.staminaSpent !== undefined) {
        updateTextContent('rank-pointer-stamina', t('mods.rankPointer.staminaSpent').replace('{n}', status.staminaSpent));
      }
    });
    
    console.log('[Rank Pointer] runUntilVictory returned! Results:', results);
    console.log('[Rank Pointer] Results type:', typeof results);
    console.log('[Rank Pointer] Results keys:', results ? Object.keys(results) : 'null');
    console.log('[Rank Pointer] Results.success:', results?.success);
    console.log('[Rank Pointer] Results.attempts:', results?.attempts);
    console.log('[Rank Pointer] Results.allAttempts length:', results?.allAttempts?.length);
    
    // Always show results, even if analysis was stopped early
    console.log('[Rank Pointer] Analysis completed, showing results:', results);
    console.log('[Rank Pointer] Current runningModal state:', !!runningModal);
    console.log('[Rank Pointer] Current activeRunningModal state:', !!activeRunningModal);
    
    // Force close all modals (like Board Analyzer does)
    console.log('[Rank Pointer] Step 1: Calling forceCloseAllModals() first time...');
    forceCloseAllModals();
    console.log('[Rank Pointer] Step 1: forceCloseAllModals() completed');
    
    // Ensure we do NOT close the running modal twice.
    // Step 1 already closed all registered modals via ModalManager.
    if (runningModal) {
      console.log('[Rank Pointer] Step 2: Skipping runningModal close (already closed by forceCloseAllModals)');
    }
    runningModal = null;
    activeRunningModal = null;
    
    // Small delay to ensure UI updates properly (like Board Analyzer)
    console.log('[Rank Pointer] Step 3: Waiting', UI_UPDATE_DELAY_MS, 'ms for UI update...');
    await sleep(UI_UPDATE_DELAY_MS);
    console.log('[Rank Pointer] Step 3: Wait completed');
    
    // Show the results modal (works for both completed and partial results)
    // Don't call forceCloseAllModals again before showing results - let the results modal show
    console.log('[Rank Pointer] Step 4: About to call showResultsModal()...');
    console.log('[Rank Pointer] Step 4: Results being passed:', {
      success: results?.success,
      attempts: results?.attempts,
      hasAllAttempts: !!results?.allAttempts,
      allAttemptsLength: results?.allAttempts?.length
    });
    
    // Show results modal - it handles its own cleanup
    showResultsModal(results);
    console.log('[Rank Pointer] Step 4: showResultsModal() called');
    
  } catch (error) {
    console.error('[Rank Pointer] Analysis error:', error);
    
    // Ensure state is reset on error
    analysisState.reset();
    
    // Close all modals and restore board state (like Board Analyzer)
    forceCloseAllModals();
    runningModal = null;
    activeRunningModal = null;
  } finally {
    // Ensure state is reset even if there's an error or early return
    // This is a safety net in case the finally block in runUntilVictory doesn't execute
    if (!analysisState.isIdle()) {
      console.log('[Rank Pointer] runAnalysis finally: Ensuring state is reset. Current state:', analysisState.state);
      analysisState.reset();
    }
    // Clear coordination flag so other mods may resume safely
    try {
      window.__modCoordination = window.__modCoordination || {};
      window.__modCoordination.rankPointerRunning = false;
    } catch (_) {}
  }
}

// =======================
// 6. Initialization
// =======================

// Initialize UI
function init() {
  console.log('[Rank Pointer] Initializing UI...');
  
  // Add the main button
  api.ui.addButton({
    id: BUTTON_ID,
    text: t('mods.rankPointer.buttonText'),
    modId: MOD_ID,
    tooltip: t('mods.rankPointer.buttonTooltip'),
    primary: false,
    onClick: () => {
      createConfigPanel();
      api.ui.toggleConfigPanel(CONFIG_PANEL_ID);
    },
    style: {
      background: "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat",
      backgroundSize: 'auto'
    }
  });
  
  // Create the configuration panel
  createConfigPanel();
  
  console.log('[Rank Pointer] UI initialized');
}

// =======================
// 7. Cleanup System
// =======================

function cleanupRankPointer() {
  console.log('[Rank Pointer] Starting cleanup...');
  
  try {
    // 1. Stop any running analysis
    if (analysisState.isRunning()) {
      console.log('[Rank Pointer] Stopping running analysis during cleanup');
      analysisState.stop();
    }
    
    // 2. Close all modals (also removes event listeners via DOM removal)
    console.log('[Rank Pointer] Closing all modals...');
    forceCloseAllModals();
    
    // 3. Cleanup all subscriptions
    console.log('[Rank Pointer] Cleaning up subscriptions...');
    cleanupBoardSubscription();
    cleanupRewardsScreenSubscription();
    
    // 4. Cleanup game state tracker
    if (gameStateTracker) {
      console.log('[Rank Pointer] Cleaning up game state tracker...');
      gameStateTracker.stopSubscription();
      gameStateTracker = null;
    }
    
    // 5. Reset analysis state
    console.log('[Rank Pointer] Resetting analysis state...');
    analysisState.reset();
    
    // 6. Clear global state variables
    console.log('[Rank Pointer] Clearing global state...');
    attemptCount = 0;
    currentRunStartTime = null;
    allAttempts = [];
    pendingServerResults.clear();
    defeatsCount = 0;
    victoriesCount = 0;
    totalStaminaSpent = 0;
    skipCount = 0;
    skipInProgress = false;
    rewardScreenOpen = false;
    rewardScreenClosedCallback = null;
    
    // 7. Clear active modals references
    activeRunningModal = null;
    activeConfigPanel = null;
    
    // 8. Restore game board visibility if hidden
    if (config.hideGameBoard) {
      console.log('[Rank Pointer] Restoring game board visibility...');
      const gameFrame = document.querySelector('main .frame-4');
      if (gameFrame && gameFrame.style.display === 'none') {
        gameFrame.style.display = '';
      }
    }
    
    // 9. Clear coordination flags
    try {
      if (window.__modCoordination) {
        window.__modCoordination.rankPointerRunning = false;
      }
    } catch (_) {}
    
    console.log('[Rank Pointer] Cleanup completed successfully');
  } catch (error) {
    console.error('[Rank Pointer] Error during cleanup:', error);
  }
}

// Initialize the mod (guard for API readiness)
if (typeof api !== 'undefined' && api && api.ui && typeof api.ui.addButton === 'function') {
  init();
} else {
  setTimeout(() => {
    if (typeof api !== 'undefined' && api && api.ui && typeof api.ui.addButton === 'function') {
      init();
    }
  }, 250);
}

// Export functionality
context.exports = {
  run: runAnalysis,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
    // Save to localStorage (preferred method)
    saveConfig();
    // Also save via API for backward compatibility
    api.service.updateScriptConfig(context.hash, {
      hideGameBoard: config.hideGameBoard
    });
  },
  cleanup: cleanupRankPointer
};

