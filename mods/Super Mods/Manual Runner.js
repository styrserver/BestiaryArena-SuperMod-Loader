// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[Manual Runner] initializing...');

// Configuration with defaults
const defaultConfig = {
  hideGameBoard: false,
  stopCondition: 'max', // 'max' = Maximum Rank, 'any' = Any Victory, 'maxFloor' = Maximum Floor
  enableAutoRefillStamina: false,
  enableAutoSellCreatures: false,
  stopWhenTicksReached: 0, // Stop when finding a run with this number of ticks or less
  maxFloor: 10 // Maximum floor to reach (0-15)
};

// Storage key for localStorage
const STORAGE_KEY = 'manualRunnerConfig';

// Load config from localStorage (preferred) or context.config
function loadConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      console.log('[Manual Runner] Loaded config from localStorage:', parsed);
      return Object.assign({}, defaultConfig, parsed);
    }
  } catch (error) {
    console.error('[Manual Runner] Error loading config from localStorage:', error);
  }
  
  // Fallback to context.config if localStorage is empty
  return Object.assign({}, defaultConfig, context.config || {});
}

// Save config to localStorage
function saveConfig() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    console.log('[Manual Runner] Saved config to localStorage:', config);
  } catch (error) {
    console.error('[Manual Runner] Error saving config to localStorage:', error);
  }
}

// Initialize config
const config = loadConfig();

// Constants
const MOD_ID = 'manual-runner';
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

// Chart rendering constants
const CHART_BAR_WIDTH = 8;
const CHART_BAR_SPACING = 4;
const CHART_MIN_HEIGHT = 20;
const CHART_MAX_HEIGHT = 120;

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

// Inject Manual Runner styles (reuse Hunt Analyzer theme)
function injectManualRunnerStyles() {
  const styleId = 'manual-runner-styles';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Themed container matching Hunt Analyzer */
    .manual-runner-modal {
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
    .manual-runner-modal-header {
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
    .manual-runner-modal-body {
      background-image: url(/_next/static/media/background-regular.b0337118.png);
      background-repeat: repeat;
      background-color: rgba(40,44,52,0.4);
      border: 1px solid #3A404A;
      border-radius: 4px;
      padding: 6px;
    }
    .manual-runner-modal-footer {
      display: flex;
      justify-content: center;
      margin-top: 10px;
    }
    .manual-runner-button {
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
    .manual-runner-button:hover {
      background: linear-gradient(to bottom, #6B7280, #4B5563);
      box-shadow: 0 3px 8px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.2);
      transform: translateY(-1px);
    }
    .manual-runner-button:active {
      box-shadow: inset 0 2px 5px rgba(0,0,0,0.5);
      transform: translateY(1px);
    }
    .manual-runner-stat {
      margin-top: 6px;
      font-size: 12px;
      color: #ABB2BF;
      text-align: center;
    }
    .manual-runner-stat.warn { color: #E06C75; }
    .manual-runner-stat.info { color: #61AFEF; }
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
        console.warn('[Manual Runner] Error closing modal:', e);
      }
      this.activeModals.delete(id);
    }
  }
  
  closeAll() {
    if (this.isClosing) {
      console.warn('[Manual Runner] Modal manager is already closing modals, skipping recursive call');
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
          console.warn('[Manual Runner] Error closing modal in closeAll:', e);
        }
      });
      this.activeModals.clear();
    } finally {
      this.isClosing = false;
    }
  }
  
  closeByType(type) {
    if (this.isClosing) {
      console.warn('[Manual Runner] Modal manager is already closing modals, skipping recursive call');
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
          console.warn('[Manual Runner] Error closing modal by type:', e);
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
  console.log('[Manual Runner] Closing all registered modals...');
  modalManager.closeAll();
}

// Helper function to close running modal specifically
function closeRunningModal() {
  try {
    modalManager.close('running-modal');
    activeRunningModal = null;
    console.log('[Manual Runner] Running modal closed successfully');
  } catch (error) {
    console.warn('[Manual Runner] Error closing running modal:', error);
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
      console.log(`[Manual Runner] Using roomId from serverResults:`, roomId);
    }
    
    // Fallback to board context
    if (!roomId) {
      const boardContext = globalThis.state.board.getSnapshot().context;
      const selectedMap = boardContext.selectedMap || {};
      roomId = selectedMap.selectedRoom?.id;
      console.log(`[Manual Runner] Using roomId from board context:`, roomId);
    }
    
    if (roomId && globalThis.state?.utils?.ROOMS) {
      const rooms = globalThis.state.utils.ROOMS;
      
      // Try to find by id (could be string or number)
      let roomData = rooms.find(room => room.id === roomId || room.id === String(roomId) || String(room.id) === roomId);
      
      // If not found, try to find by file name or other identifier
      if (!roomData && typeof roomId === 'string') {
        roomData = rooms.find(room => room.file?.name === roomId || room.file?.id === roomId);
      }
      
      console.log(`[Manual Runner] Room data found:`, roomData ? { id: roomData.id, maxTeamSize: roomData.maxTeamSize, file: roomData.file?.name } : 'not found');
      
      if (roomData && typeof roomData.maxTeamSize === 'number') {
        console.log(`[Manual Runner] Using maxTeamSize from room data:`, roomData.maxTeamSize);
        return roomData.maxTeamSize;
      }
    }
  } catch (error) {
    console.warn('[Manual Runner] Error getting maxTeamSize:', error);
  }
  
  // Default fallback (most common is 5, but some maps are different)
  console.log(`[Manual Runner] Using default maxTeamSize: 5`);
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
    console.warn('[Manual Runner] Error computing player team size:', e);
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
      console.log(`[Manual Runner] Switching from ${currentMode} mode to manual mode`);
      globalThis.state.board.send({ type: "setPlayMode", mode: "manual" });
      return true;
    } else {
      console.log('[Manual Runner] Already in manual mode');
      return false;
    }
  } catch (error) {
    console.error('[Manual Runner] Error setting manual mode:', error);
    return false;
  }
}

// Get current floor (0-15)
function getCurrentFloor() {
  try {
    const currentFloor = globalThis.state.board.get().context.floor;
    if (typeof currentFloor === 'number' && currentFloor >= 0 && currentFloor <= 15) {
      return currentFloor;
    }
    console.warn('[Manual Runner] Invalid floor value:', currentFloor);
    return 0;
  } catch (error) {
    console.error('[Manual Runner] Error getting current floor:', error);
    return 0;
  }
}

// Advance to the next floor
function advanceToNextFloor() {
  try {
    const currentFloor = getCurrentFloor();
    if (currentFloor >= 15) {
      console.warn('[Manual Runner] Already at maximum floor (15), cannot advance');
      return false;
    }
    
    const nextFloor = currentFloor + 1;
    console.log(`[Manual Runner] Advancing from floor ${currentFloor} to floor ${nextFloor}`);
    
    globalThis.state.board.trigger.setState({ 
      fn: (prev) => ({ ...prev, floor: nextFloor }) 
    });
    
    // Wait a bit for the floor change to take effect
    return true;
  } catch (error) {
    console.error('[Manual Runner] Error advancing to next floor:', error);
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
            console.warn('[Manual Runner] Error in game state listener:', error);
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
    console.log('[Manual Runner] Persistent gameTimer subscription set up');
  } catch (error) {
    console.warn('[Manual Runner] Error setting up gameTimer subscription:', error);
  }
}

// Cleanup persistent gameTimer subscription
function cleanupGameTimerSubscription() {
  if (gameTimerUnsubscribe) {
    gameTimerUnsubscribe();
    gameTimerUnsubscribe = null;
    console.log('[Manual Runner] Persistent gameTimer subscription cleaned up');
  }
}

// Function to wait for game completion (tracking reward screen - 1 reward screen = 1 run)
async function waitForGameCompletion(analysisId) {
  console.log('[Manual Runner] Waiting for reward screen to open (1 reward screen = 1 run)...');
  
  // Use persistent tracking variables (updated by persistent gameTimer subscription)
  console.log('[Manual Runner] Current tracked values:', { 
    lastTick: persistentLastTick, 
    lastGrade: persistentLastGrade, 
    lastRankPoints: persistentLastRankPoints 
  });
  
  // Reset reward screen state at start (should already be false, but ensure it)
  rewardScreenOpen = false;
  console.log('[Manual Runner] waitForGameCompletion: Reset rewardScreenOpen to false');
  
  // Promise-based approach: wait for callback to fire or timeout
  const maxWaitMs = 240000; // 4 minutes max
  const checkIntervalMs = 1000; // Check stop/skip every second
  
  const completionPromise = new Promise((resolve, reject) => {
    let intervalId;
    let checkCount = 0;
    
    // Register callback for immediate resolution when reward screen opens
    rewardScreenOpenedCallback = () => {
      console.log('[Manual Runner] Reward screen opened via callback - resolving immediately');
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
          console.log('[Manual Runner] Stop requested - letting current run finish naturally');
        }
      }
      
      // Check for skip
      if (await handleSkipDetection(`[Manual Runner] Skip detected during wait check ${checkCount}`)) {
        clearInterval(intervalId);
        rewardScreenOpenedCallback = null;
        reject('skip');
        return;
      }
      
      // Also check state directly (fallback in case callback missed)
      if (getOpenRewardsStateWithFallback()) {
        console.log('[Manual Runner] Reward screen detected via polling fallback');
        clearInterval(intervalId);
        rewardScreenOpenedCallback = null;
        resolve('polling');
        return;
      }
      
      // Log progress every 10 seconds
      if (checkCount % 10 === 0) {
        console.log(`[Manual Runner] Still waiting for reward screen... (${checkCount}s elapsed, callback will resolve instantly)`);
      }
      
      // Timeout check
      if (checkCount * checkIntervalMs >= maxWaitMs) {
        console.log('[Manual Runner] Wait timeout reached');
        clearInterval(intervalId);
        rewardScreenOpenedCallback = null;
        reject('timeout');
      }
    }, checkIntervalMs);
  });
  
  // Wait for completion or error
  try {
    const triggerSource = await completionPromise;
    console.log(`[Manual Runner] Game completed (triggered by: ${triggerSource})`);
  } catch (reason) {
    if (reason === 'invalid_id' || reason === 'stopped') {
      return createForceStopResult();
    } else if (reason === 'skip') {
      return createSkipResult();
    } else if (reason === 'timeout') {
      console.log('[Manual Runner] Timeout waiting for reward screen - returning failed state');
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
  console.log(`[Manual Runner] Tracked game data when reward screen opened:`, { 
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
  
  console.log(`[Manual Runner] gameTimer context:`, {
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
    console.log(`[Manual Runner] Got serverResults from pending map for game completion check`);
  }
  
  // Also check current board context as fallback
  const boardContext = globalThis.state.board.getSnapshot().context;
  if (!serverResults && boardContext?.serverResults) {
    serverResults = boardContext.serverResults;
    console.log(`[Manual Runner] Got serverResults from board context`);
  }
  
  let completed = gameState === 'victory';
  
  if (serverResults?.rewardScreen) {
    const serverVictory = typeof serverResults.rewardScreen.victory === 'boolean' ? serverResults.rewardScreen.victory : false;
    console.log(`[Manual Runner] Found serverResults - gameState: ${gameState}, serverVictory: ${serverVictory}, gameTicks: ${serverResults.rewardScreen.gameTicks}`);
    
    // Use serverResults as authoritative for victory
    completed = serverVictory;
    
    // Use serverResults for tick info if available (especially important in manual mode)
    if (typeof serverResults.rewardScreen.gameTicks === 'number') {
      currentTick = serverResults.rewardScreen.gameTicks;
      console.log(`[Manual Runner] Using gameTicks from serverResults: ${currentTick}`);
    }
    
    // Try to get rank points from serverResults.rank (not rankPoints) - like RunTracker
    if (typeof serverResults.rewardScreen.rank === 'number') {
      rankPoints = serverResults.rewardScreen.rank;
      console.log(`[Manual Runner] Using rank from serverResults.rewardScreen.rank: ${rankPoints}`);
    }
    
    // Check if serverResults has grade field
    if (serverResults.rewardScreen.grade && 
        serverResults.rewardScreen.grade !== '' && 
        typeof serverResults.rewardScreen.grade === 'string') {
      readableGrade = serverResults.rewardScreen.grade;
      console.log(`[Manual Runner] Using grade from serverResults.rewardScreen.grade: ${readableGrade}`);
    }
    // Only calculate grade if neither gameTimer nor serverResults provided a valid one
    else if (!readableGrade || readableGrade === '' || readableGrade === 'F') {
      // Get maxTeamSize for proper grade calculation (fallback only) - pass serverResults for roomId lookup
      const maxTeamSize = getMaxTeamSize(serverResults);
      readableGrade = calculateGradeFromRankPoints(rankPoints, maxTeamSize);
      console.log(`[Manual Runner] Calculated grade from rankPoints ${rankPoints} and maxTeamSize ${maxTeamSize}: ${readableGrade} (neither gameTimer nor serverResults provided grade)`);
    } else {
      // Trust gameTimer's grade (same as Board Analyzer does)
      console.log(`[Manual Runner] Using grade from gameTimer: ${readableGrade}`);
    }
    
    // Log all available serverResults fields for debugging
    console.log(`[Manual Runner] serverResults.rewardScreen keys:`, Object.keys(serverResults.rewardScreen));
    if (serverResults.rewardScreen.grade !== undefined) {
      console.log(`[Manual Runner] serverResults.rewardScreen.grade:`, serverResults.rewardScreen.grade);
    }
  } else {
    console.log(`[Manual Runner] No serverResults available yet, using gameState: ${gameState}`);
    
    // Only calculate grade if gameTimer didn't provide a valid one (use game's calculation as authoritative)
    if (!readableGrade || readableGrade === '' || readableGrade === 'F') {
      const maxTeamSize = getMaxTeamSize(null);
      readableGrade = calculateGradeFromRankPoints(rankPoints, maxTeamSize);
      console.log(`[Manual Runner] Calculated grade from rankPoints ${rankPoints} and maxTeamSize ${maxTeamSize}: ${readableGrade} (gameTimer didn't provide valid grade)`);
    } else {
      // Trust gameTimer's grade (same as Board Analyzer does)
      console.log(`[Manual Runner] Using grade from gameTimer: ${readableGrade}`);
    }
  }
  
  console.log(`[Manual Runner] Final victory determination: ${completed}, ticks: ${currentTick}, grade: ${readableGrade}, rankPoints: ${rankPoints}`);
  
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
    console.log('[Manual Runner] Setting up board subscription for serverResults...');
    boardSubscription = globalThis.state.board.subscribe(({ context }) => {
      const serverResults = context.serverResults;
      if (!serverResults || !serverResults.rewardScreen || typeof serverResults.seed === 'undefined') {
        return; // No valid server results yet
      }
      
      // If server signals enableSkip, attempt to skip immediately (debounced)
      try {
        if (serverResults.enableSkip === true && !skipInProgress) {
          skipInProgress = true;
          console.log('[Manual Runner] enableSkip=true received from server (subscription) — attempting to skip');
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
      
      console.log('[Manual Runner] ServerResults captured, seed:', seed, 'victory:', serverResults.rewardScreen.victory, 'full serverResults:', serverResults);
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
    console.log('[Manual Runner] Setting up openRewards subscription to track reward screen...');
    
    try {
      const openRewards = globalThis.state.board.select((ctx) => ctx.openRewards);
      
      openRewardsSubscription = openRewards.subscribe((isOpen) => {
        console.log('[Manual Runner] openRewards changed:', isOpen);
        
        // Just track the state - don't auto-close here (we'll close it after detecting game completion)
        if (isOpen && !rewardScreenOpen) {
          // Reward screen just opened - this indicates a game completed
          console.log('[Manual Runner] Reward screen opened - game completed! (1 reward screen = 1 run)');
          rewardScreenOpen = true;
          
          // Trigger immediate check if callback is registered
          if (rewardScreenOpenedCallback) {
            console.log('[Manual Runner] Triggering immediate check via callback');
            rewardScreenOpenedCallback();
          }
        } else if (!isOpen && rewardScreenOpen) {
          // Reward screen just closed
          console.log('[Manual Runner] Reward screen closed');
          rewardScreenOpen = false;
          
          // Notify any waiting code
          if (rewardScreenClosedCallback) {
            rewardScreenClosedCallback();
            rewardScreenClosedCallback = null;
          }
        }
      });
      
      console.log('[Manual Runner] openRewards subscription set up successfully');
    } catch (error) {
      console.warn('[Manual Runner] Error setting up openRewards subscription:', error);
    }
  }
}

// Function to close the reward screen (like btlucas fix.js)
function closeRewardScreen() {
  console.log('[Manual Runner] Attempting to close reward screen using ESC key...');
  
  // Check if there's a modal open (data-scroll-locked="1") - like btlucas fix.js
  const bodyElement = document.body;
  const scrollLocked = bodyElement.getAttribute('data-scroll-locked');
  
  if (scrollLocked === '1') {
    console.log('[Manual Runner] Modal detected (data-scroll-locked="1") - pressing ESC to close...');
  } else {
    console.log('[Manual Runner] No data-scroll-locked="1" detected, but pressing ESC anyway...');
  }
  
  // Use ESC key directly (like btlucas fix.js - simpler and more reliable)
  dispatchEsc();
  console.log('[Manual Runner] ESC key pressed to close reward screen');
}

// Helper function to find skip button (from btlucas fix.js)
function findSkipButton() {
  try {
    // First, try the specific selector
    const specificSkipButton = document.querySelector("#__next > div.flex.min-h-screen.flex-col > div > main > div > div.flex.flex-col.justify-center.gap-2.\\32 xl\\:flex-row > div.grid.grid-cols-2.gap-2.gap-y-1\\.5.sm\\:grid-cols-\\[1fr_min-content\\].sm\\:grid-rows-\\[3fr\\].sm\\:gap-y-2.\\32 xl\\:grid-cols-\\[min-content\\] > div.sm\\:order-3 > button");
    if (specificSkipButton) {
      const buttonText = specificSkipButton.textContent.trim();
      if (buttonText.includes('Skip') || buttonText.includes('Pular')) {
        console.log('[Manual Runner] Found skip button using specific selector');
        console.log('[Manual Runner] Button text:', `"${buttonText}"`);
        return specificSkipButton;
      }
    }
    
    // Fallback: Look for skip button by text content in all buttons
    const skipButtons = document.querySelectorAll('button');
    for (const button of skipButtons) {
      const buttonText = button.textContent.trim();
      if (buttonText.includes('Skip') || buttonText.includes('Pular')) {
        console.log('[Manual Runner] Found skip button using text search');
        console.log('[Manual Runner] Button text:', `"${buttonText}"`);
        return button;
      }
    }
    
    // Additional fallback: Look for buttons with data attributes
    const skipButtonsByAttr = document.querySelectorAll('button[data-full="false"][data-state="closed"]');
    for (const button of skipButtonsByAttr) {
      const buttonText = button.textContent.trim();
      if (buttonText.includes('Skip') || buttonText.includes('Pular')) {
        console.log('[Manual Runner] Found skip button using data attributes');
        console.log('[Manual Runner] Button text:', `"${buttonText}"`);
        return button;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[Manual Runner] Error finding skip button:', error);
    return null;
  }
}

// Helper function to handle skip button click (from btlucas fix.js)
async function handleSkipButton() {
  try {
    const skipButton = findSkipButton();
    if (skipButton) {
      console.log('[Manual Runner] Skip button found - clicking to skip time-limit loss...');
      skipButton.click();
      await sleep(500); // Wait for skip to process
      console.log('[Manual Runner] Skip button clicked successfully');
      
      // Close loot summary window after a short delay
      setTimeout(() => {
        closeRewardScreen();
      }, 1000);
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Manual Runner] Error handling skip button:', error);
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
    console.warn('[Manual Runner] quickSkipScan error:', e);
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
    console.log('[Manual Runner] Reward screen is already closed (verified via openRewards state)');
    rewardScreenOpen = false; // Sync the flag
    return true;
  }
  
  console.log('[Manual Runner] Waiting for reward screen to close...');
  
  return new Promise((resolve) => {
    const startTime = performance.now();
    let callbackTriggered = false;
    
    // Set up callback for when subscription detects closure
    rewardScreenClosedCallback = () => {
      if (!callbackTriggered) {
        console.log('[Manual Runner] Reward screen closed callback triggered');
        callbackTriggered = true;
        resolve(true);
      }
    };
    
    // Polling fallback in case subscription doesn't fire
    const checkInterval = setInterval(() => {
      try {
        const openRewards = globalThis.state.board.select((ctx) => ctx.openRewards);
        const isOpen = openRewards.getSnapshot();
        
        console.log(`[Manual Runner] Polling openRewards: ${isOpen}, rewardScreenOpen: ${rewardScreenOpen}`);
        
        if (!isOpen) {
          console.log('[Manual Runner] Reward screen closed (detected via polling)');
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
          console.warn(`[Manual Runner] Timeout waiting for reward screen to close (${elapsed}ms elapsed)`);
          clearInterval(checkInterval);
          if (!callbackTriggered) {
            callbackTriggered = true;
            resolve(false);
          }
          return;
        }
        
        // Log progress every 500ms
        if (Math.floor(elapsed / 500) !== Math.floor((elapsed - 100) / 500)) {
          console.log(`[Manual Runner] Still waiting for reward screen to close... (${Math.floor(elapsed / 1000)}s elapsed)`);
        }
        
      } catch (e) {
        console.log('[Manual Runner] Could not check openRewards, assuming closed');
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
        console.log('[Manual Runner] openRewards subscription unsubscribed');
      }
    } catch (e) {
      console.warn('[Manual Runner] Error cleaning up openRewards subscription:', e);
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
      console.warn('[Manual Runner] Error cleaning up board subscription:', e);
    }
    boardSubscription = null;
  }
  
  // Also cleanup rewards screen subscription
  cleanupRewardsScreenSubscription();
}

function shouldAbortAnalysisLoop(analysisId) {
  if (!analysisState.isValidId(analysisId) || !analysisState.isRunning() || analysisState.forceStop) {
    console.log('[Manual Runner] Stopping analysis');
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
  console.log(`[Manual Runner] Checking coordination flags${contextSuffix}:`, {
    automatorRefilling: !!window.__modCoordination?.automatorRefilling,
    automatorCollectingRewards: !!window.__modCoordination?.automatorCollectingRewards,
    automatorHandlingDaycare: !!window.__modCoordination?.automatorHandlingDaycare,
    automatorCollectingSeashell: !!window.__modCoordination?.automatorCollectingSeashell,
    activeOperations: initialOps.length > 0 ? initialOps : 'none'
  });

  let activeOperations = initialOps;

  while (activeOperations.length > 0) {
    const attemptLabel = waitAttempts + 1;
    console.log(`[Manual Runner] Waiting for Bestiary Automator to finish ${activeOperations.join(', ')}... (${attemptLabel})${contextSuffix}`);

    const elapsed = performance.now() - start;
    if (elapsed >= maxWaitMs) {
      console.warn(`[Manual Runner] Waited ${Math.round(elapsed)}ms for Bestiary Automator${contextSuffix}, continuing analysis anyway`);
      return;
    }

    await sleep(delayMs);
    waitAttempts++;
    activeOperations = getActiveOperations();
  }

  if (waitAttempts > 0) {
    const elapsed = Math.round(performance.now() - start);
    console.log(`[Manual Runner] Bestiary Automator finished after ${elapsed}ms, resuming analysis${contextSuffix}`);
  } else {
    console.log(`[Manual Runner] No Automator operations active, continuing immediately${contextSuffix}`);
  }
}

function prepareAttemptState(nextAttemptNumber) {
  rewardScreenOpen = false;
  // Reset persistent tracking variables for new attempt
  persistentLastTick = 0;
  persistentLastGrade = 'F';
  persistentLastRankPoints = 0;
  console.log(`[Manual Runner] Reset state for attempt ${nextAttemptNumber}`);
}

async function ensureGameStopped(maxChecks = 5, delayMs = 80) {
  const startTime = performance.now();
  let stopWaitCount = 0;
  console.log('[Manual Runner] Checking if game has stopped...');
  while (stopWaitCount < maxChecks) {
    const boardContext = globalThis.state.board.getSnapshot().context;
    if (!boardContext.gameStarted) {
      const elapsed = Math.round(performance.now() - startTime);
      console.log(`[Manual Runner] Game stopped after ${elapsed}ms (${stopWaitCount} checks)`);
      break;
    }
    await sleep(delayMs);
    stopWaitCount++;
  }
  
  if (stopWaitCount >= maxChecks) {
    console.log(`[Manual Runner] Game state still showing as started after ${stopWaitCount * delayMs}ms, continuing anyway`);
  }
}

// Function to auto-sell creatures from reward screen
async function autoSellCreatures() {
  console.log('[Manual Runner] Attempting to auto-sell creatures...');
  
  // Wait a bit for reward screen to fully render
  await sleep(300);
  
  // Find Sell or Squeeze button
  // Check for both English and Portuguese text
  const sellButtonTexts = ['Sell', 'Vender', 'Squeeze', 'Espremer'];
  const allButtons = document.querySelectorAll('button');
  let sellButton = null;
  
  for (const button of allButtons) {
    const buttonText = button.textContent.trim();
    const hasSellImg = button.querySelector('img[alt="Bag with gold"]');
    
    if (sellButtonTexts.includes(buttonText) || hasSellImg) {
      sellButton = button;
      console.log('[Manual Runner] Found sell button:', buttonText);
      break;
    }
  }
  
  if (!sellButton) {
    console.warn('[Manual Runner] Could not find Sell/Squeeze button');
    return false;
  }
  
  try {
    // Click the sell button
    console.log('[Manual Runner] Clicking sell button...');
    sellButton.click();
    await sleep(500); // Wait for sell action to complete
    
    // Press ESC to close the reward screen
    console.log('[Manual Runner] Pressing ESC to close reward screen...');
    dispatchEsc();
    await sleep(200);
    
    console.log('[Manual Runner] Auto-sell completed');
    return true;
  } catch (error) {
    console.error('[Manual Runner] Error during auto-sell:', error);
    return false;
  }
}

async function ensureRewardScreenHandled() {
  let isRewardScreenOpen = false;
  try {
    const openRewards = globalThis.state.board.select((ctx) => ctx.openRewards);
    isRewardScreenOpen = openRewards.getSnapshot();
    console.log(`[Manual Runner] Verified reward screen state: ${isRewardScreenOpen}, rewardScreenOpen flag: ${rewardScreenOpen}`);
  } catch (e) {
    console.log('[Manual Runner] Could not check openRewards state, using flag');
    isRewardScreenOpen = rewardScreenOpen;
  }

  if (!isRewardScreenOpen) {
    console.log('[Manual Runner] Reward screen is not open, skipping close step');
    return;
  }

  await waitForModCoordinationTasks({ context: 'reward screen handling' });

  // Auto-sell creatures if enabled
  let autoSellSuccess = false;
  if (config.enableAutoSellCreatures) {
    console.log('[Manual Runner] Auto-sell enabled, attempting to sell creatures...');
    autoSellSuccess = await autoSellCreatures();
  }

  // If auto-sell didn't succeed or wasn't enabled, close reward screen normally
  if (!autoSellSuccess) {
    const closeStart = performance.now();
    console.log('[Manual Runner] Closing reward screen after game completion...');
    closeRewardScreen();
    await sleep(200);

    const rewardClosed = await waitForRewardScreenToClose(2500);
    const closeElapsed = Math.round(performance.now() - closeStart);
    
    if (!rewardClosed) {
      console.warn(`[Manual Runner] Reward screen did not close within timeout (${closeElapsed}ms), trying ESC key...`);
      dispatchEsc();
      await sleep(1000);
      try {
        const openRewards = globalThis.state.board.select((ctx) => ctx.openRewards);
        const isOpen = openRewards.getSnapshot();
        if (isOpen) {
          console.error('[Manual Runner] Reward screen still open after ESC key - this may cause issues');
        } else {
          console.log('[Manual Runner] Reward screen closed after ESC key');
          rewardScreenOpen = false;
        }
      } catch (e) {
        console.log('[Manual Runner] Could not check reward screen state after ESC');
      }
    } else {
      console.log(`[Manual Runner] Reward screen closed successfully in ${closeElapsed}ms, processing result...`);
    }
  } else {
    // Auto-sell handled closing, just verify it's closed
    await sleep(300);
    try {
      const openRewards = globalThis.state.board.select((ctx) => ctx.openRewards);
      const isOpen = openRewards.getSnapshot();
      if (!isOpen) {
        rewardScreenOpen = false;
        console.log('[Manual Runner] Reward screen closed after auto-sell');
      }
    } catch (e) {
      console.log('[Manual Runner] Could not verify reward screen state after auto-sell');
    }
  }
}

async function waitForServerResults(maxWaitTime = 2000) {
  let serverResults = null;
  const waitStart = performance.now();

  while (!serverResults && (performance.now() - waitStart) < maxWaitTime) {
    const contextServerResults = globalThis.state?.board?.getSnapshot?.()?.context?.serverResults;
    if (contextServerResults && contextServerResults.rewardScreen && typeof contextServerResults.seed !== 'undefined') {
      serverResults = JSON.parse(JSON.stringify(contextServerResults));
      console.log('[Manual Runner] Got serverResults from context, seed:', serverResults.seed, 'victory:', serverResults.rewardScreen.victory);
      break;
    }

    if (pendingServerResults.size > 0) {
      const lastSeed = Array.from(pendingServerResults.keys()).pop();
      serverResults = pendingServerResults.get(lastSeed);
      pendingServerResults.delete(lastSeed);
      console.log('[Manual Runner] Got serverResults from pending map, seed:', serverResults?.seed, 'victory:', serverResults?.rewardScreen?.victory);
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
    console.log(`[Manual Runner] Stamina spent this attempt: ${attemptStaminaSpent}, total: ${totalStaminaSpent}`);
  } else {
    console.warn(`[Manual Runner] No valid playerExpDiff found in serverResults for attempt ${attemptNumber}`);
  }
  return attemptStaminaSpent;
}

function createAttemptData({ attemptNumber, result, runTime, serverResults, attemptStaminaSpent, attemptSeed, isVictory, floor }) {
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
    skipped: !!result.skipped,
    floor: floor !== undefined ? floor : null
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
    console.log(message || '[Manual Runner] enableSkip=true received — attempting to skip');
    await handleSkipButton().finally(() => {
      setTimeout(() => { skipInProgress = false; }, 1200);
    });
    return true;
  }

  const skipButton = findSkipButton();
  if (skipButton) {
    if (!skipInProgress) {
      skipInProgress = true;
      console.log('[Manual Runner] Skip button detected — handling...');
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
        const currentFloor = getCurrentFloor();
        statusCallback({
          attempts: attemptCount,
          defeats: defeatsCount,
          victories: victoriesCount,
          staminaSpent: totalStaminaSpent,
          status: 'running',
          floor: currentFloor
        });
      }

      console.log(`[Manual Runner] Attempt ${attemptCount}: Starting game...`);

      await waitForModCoordinationTasks({ context: `pre-start attempt ${attemptCount}` });
      prepareAttemptState(attemptCount + 1);

      if (!clickStartButton()) {
        console.error('[Manual Runner] Failed to find start button');
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
        console.log('[Manual Runner] Analysis stopped');
        break;
      }

      const runTime = performance.now() - currentRunStartTime;
      const serverResults = await waitForServerResults();

      let isVictory = result.completed;

      if (serverResults && serverResults.rewardScreen) {
        const serverVictory = serverResults.rewardScreen.victory === true;
        console.log(`[Manual Runner] Victory status - serverResults: ${serverVictory}, result.completed: ${result.completed}`);
        if (typeof serverResults.rewardScreen.victory === 'boolean') {
          isVictory = serverVictory;
        }
      } else {
        console.warn('[Manual Runner] No serverResults available, using result.completed:', result.completed);
      }

      console.log(`[Manual Runner] Final victory determination: ${isVictory}`);
      updateVictoryDefeatCounters(isVictory);

      const attemptStaminaSpent = trackStaminaUsage(serverResults, attemptCount);

      let attemptSeed = null;
      if (serverResults && typeof serverResults.seed !== 'undefined') {
        attemptSeed = serverResults.seed;
      }

      // Get current floor for tracking
      const currentFloor = getCurrentFloor();

      const attemptData = createAttemptData({
        attemptNumber: attemptCount,
        result,
        runTime,
        serverResults,
        attemptStaminaSpent,
        attemptSeed,
        isVictory,
        floor: currentFloor
      });

      allAttempts.push(attemptData);

      console.log(`[Manual Runner] Attempt ${attemptCount} completed:`, {
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
        console.log('[Manual Runner] serverResults structure:', {
          hasRewardScreen: !!serverResults.rewardScreen,
          hasNext: !!serverResults.next,
          rewardScreenKeys: serverResults.rewardScreen ? Object.keys(serverResults.rewardScreen) : null,
          nextKeys: serverResults.next ? Object.keys(serverResults.next) : null
        });
      }
      
      // Check if stop was requested during this run (after recording attempt data)
      if (!analysisState.isRunning()) {
        console.log('[Manual Runner] Stop requested - current run finished and recorded, stopping now');
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

      // Handle maxFloor mode separately
      if (config.stopCondition === 'maxFloor' && isVictory) {
        const currentFloor = getCurrentFloor();
        console.log(`[Manual Runner] Victory on floor ${currentFloor}, target max floor: ${config.maxFloor}`);
        
        if (currentFloor >= config.maxFloor) {
          // Reached or exceeded max floor, stop
          const totalTime = performance.now() - startTime;
          console.log(`[Manual Runner] ✓ VICTORY DETECTED on floor ${currentFloor} (target: ${config.maxFloor}). Stopping analysis.`);
          console.log(`[Manual Runner] Maximum floor reached after ${attemptCount} attempts! Total time: ${formatMilliseconds(totalTime)}`);
          
          const finalResult = {
            ...result,
            completed: true,
            victory: true,
            floor: currentFloor
          };

          return {
            success: true,
            attempts: attemptCount,
            finalResult,
            totalTimeMs: totalTime,
            allAttempts
          };
        } else {
          // Advance to next floor and continue
          console.log(`[Manual Runner] Victory on floor ${currentFloor}, advancing to floor ${currentFloor + 1}...`);
          advanceToNextFloor();
          await sleep(300); // Wait for floor change to take effect
          
          // Continue loop to next attempt on new floor
          const cleanupStart = performance.now();
          console.log('[Manual Runner] Starting post-victory cleanup before floor advance...');
          
          await ensureGameStopped();
          
          if (rewardScreenOpen) {
            console.log('[Manual Runner] Reward screen is open, closing it...');
            closeRewardScreen();
          }

          const screenClosed = await waitForRewardScreenToClose(3000);
          if (screenClosed) {
            console.log('[Manual Runner] Reward screen closed, ready to continue');
          } else {
            console.warn('[Manual Runner] Reward screen did not close in time, continuing anyway');
          }

          await waitForModCoordinationTasks({ context: `post-victory cleanup ${attemptCount}` });

          console.log(`[Manual Runner] Waiting ${GAME_RESTART_DELAY_MS}ms before next attempt on new floor...`);
          await sleep(GAME_RESTART_DELAY_MS);
          
          const cleanupElapsed = Math.round(performance.now() - cleanupStart);
          console.log(`[Manual Runner] Cleanup complete in ${cleanupElapsed}ms, ready to start attempt ${attemptCount + 1} on floor ${currentFloor + 1}`);
          
          // Continue to next iteration
          continue;
        }
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
            console.log(`[Manual Runner] ✓ VICTORY DETECTED${targetRankPoints != null ? ` with rank ${result.rankPoints} (target S+${targetRankPoints})` : ''} and ticks ${result.ticks} <= ${config.stopWhenTicksReached}. Stopping analysis.`);
            console.log(`[Manual Runner] Victory achieved after ${attemptCount} attempts! Total time: ${formatMilliseconds(totalTime)}`);
            console.log('[Manual Runner] Result details:', {
              ticks: result.ticks,
              grade: result.grade,
              rankPoints: result.rankPoints,
              serverVictory: serverResults?.rewardScreen?.victory,
              isVictory: isVictory,
              resultCompleted: result.completed
            });
            console.log('[Manual Runner] About to return from runUntilVictory with success: true');
            console.log('[Manual Runner] Current analysisState:', analysisState.state);
            console.log('[Manual Runner] All attempts collected:', allAttempts.length);

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

            console.log('[Manual Runner] Returning victory result:', {
              success: returnValue.success,
              attempts: returnValue.attempts,
              totalTimeMs: returnValue.totalTimeMs,
              allAttemptsLength: returnValue.allAttempts.length
            });

            return returnValue;
          } else {
            victoryContinueDueToTicks = true;
            console.log(`[Manual Runner] ✓ VICTORY DETECTED${targetRankPoints != null ? ` with rank ${result.rankPoints} (target S+${targetRankPoints})` : ''} but ticks ${result.ticks} > ${config.stopWhenTicksReached}, continuing to find better run...`);
          }
        } else {
          const totalTime = performance.now() - startTime;
          console.log(`[Manual Runner] ✓ VICTORY DETECTED${targetRankPoints != null ? ` with rank ${result.rankPoints} (target S+${targetRankPoints})` : ''}. Stopping analysis.`);
          console.log(`[Manual Runner] Victory achieved after ${attemptCount} attempts! Total time: ${formatMilliseconds(totalTime)}`);
          console.log('[Manual Runner] Result details:', {
            ticks: result.ticks,
            grade: result.grade,
            rankPoints: result.rankPoints,
            serverVictory: serverResults?.rewardScreen?.victory,
            isVictory: isVictory,
            resultCompleted: result.completed
          });
          console.log('[Manual Runner] About to return from runUntilVictory with success: true');
          console.log('[Manual Runner] Current analysisState:', analysisState.state);
          console.log('[Manual Runner] All attempts collected:', allAttempts.length);

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

          console.log('[Manual Runner] Returning victory result:', {
            success: returnValue.success,
            attempts: returnValue.attempts,
            totalTimeMs: returnValue.totalTimeMs,
            allAttemptsLength: returnValue.allAttempts.length
          });

          return returnValue;
        }
      }

      if (victoryContinueDueToTicks) {
        console.log('[Manual Runner] Victory found but didn\'t meet ticks threshold, restarting to find better run...');
      } else {
        console.log(`[Manual Runner] Defeat on attempt ${attemptCount} - will restart`);
      }

      const cleanupStart = performance.now();
      console.log('[Manual Runner] Starting post-attempt cleanup...');
      
      await ensureGameStopped();

      if (rewardScreenOpen) {
        console.log('[Manual Runner] Reward screen is open, closing it...');
        closeRewardScreen();
      }

      const screenClosed = await waitForRewardScreenToClose(3000);
      if (screenClosed) {
        console.log('[Manual Runner] Reward screen closed, ready to continue');
      } else {
        console.warn('[Manual Runner] Reward screen did not close in time, continuing anyway');
      }

      await waitForModCoordinationTasks({ context: `post-attempt cleanup ${attemptCount}` });

      console.log(`[Manual Runner] Waiting ${GAME_RESTART_DELAY_MS}ms before next attempt...`);
      await sleep(GAME_RESTART_DELAY_MS);
      
      const cleanupElapsed = Math.round(performance.now() - cleanupStart);
      console.log(`[Manual Runner] Cleanup complete in ${cleanupElapsed}ms, ready to start attempt ${attemptCount + 1}`);
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
    console.error('[Manual Runner] Error during analysis:', error);
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
    console.log('[Manual Runner] runUntilVictory finally block entered');
    console.log('[Manual Runner] Current state before reset:', analysisState.state);
    console.log('[Manual Runner] attemptCount at finally:', attemptCount);
    console.log('[Manual Runner] allAttempts length at finally:', allAttempts.length);
    analysisState.reset();
    console.log('[Manual Runner] State after reset:', analysisState.state);
    console.log('[Manual Runner] runUntilVictory finally block completed');
    
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
    console.warn('[Manual Runner] Board serialization API not available, replay may not work correctly');
    return null;
  } catch (error) {
    console.error('[Manual Runner] Error serializing board:', error);
    return null;
  }
}

// Create replay data for a specific attempt (like Board Analyzer)
function createReplayDataForAttempt(attempt) {
  try {
    if (!attempt.seed) {
      console.warn('[Manual Runner] No seed available for attempt', attempt.attemptNumber);
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
      console.warn('[Manual Runner] Could not get board data for attempt', attempt.attemptNumber);
      return null;
    }
    
    // Add seed to board data
    boardData.seed = attempt.seed;
    
    // Verify required fields
    if (!boardData.region || !boardData.map || !boardData.board) {
      console.warn('[Manual Runner] Board data missing required fields:', boardData);
      return null;
    }
    
    return boardData;
  } catch (error) {
    console.error('[Manual Runner] Error creating replay data for attempt:', error);
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
    console.error('[Manual Runner] Failed to copy text:', err);
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
    console.warn('[Manual Runner] Error checking for ally creatures:', error);
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
  stopLabel.textContent = t('mods.manualRunner.stopWhenLabel');
  const stopSelect = document.createElement('select');
  stopSelect.id = `${CONFIG_PANEL_ID}-stop-select`;
  stopSelect.style.cssText = 'min-width: 160px; background-color: #222; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px;';
  const optAny = document.createElement('option');
  optAny.value = 'any';
  optAny.textContent = t('mods.manualRunner.stopWhenAny');
  const optMax = document.createElement('option');
  optMax.value = 'max';
  optMax.textContent = t('mods.manualRunner.stopWhenMax');
  const optMaxFloor = document.createElement('option');
  optMaxFloor.value = 'maxFloor';
  optMaxFloor.textContent = t('mods.manualRunner.stopWhenMaxFloor') || 'Maximum Floor';
  stopSelect.appendChild(optAny);
  stopSelect.appendChild(optMax);
  stopSelect.appendChild(optMaxFloor);
  stopSelect.value = config.stopCondition || 'max';
  stopContainer.appendChild(stopLabel);
  stopContainer.appendChild(stopSelect);
  content.appendChild(stopContainer);

  // Stop when ticks reached input (hidden and disabled when maxFloor is selected)
  const stopWhenTicksContainer = document.createElement('div');
  stopWhenTicksContainer.id = `${CONFIG_PANEL_ID}-stop-when-ticks-container`;
  stopWhenTicksContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
  stopWhenTicksContainer.style.display = config.stopCondition === 'maxFloor' ? 'none' : 'flex';
  
  const stopWhenTicksLabel = document.createElement('label');
  stopWhenTicksLabel.textContent = t('mods.manualRunner.stopWhenTicksReachedLabel');
  
  const stopWhenTicksInput = document.createElement('input');
  stopWhenTicksInput.type = 'number';
  stopWhenTicksInput.id = `${CONFIG_PANEL_ID}-stop-when-ticks-input`;
  stopWhenTicksInput.min = '0';
  stopWhenTicksInput.max = '3840'; // 4 minutes (240,000ms / 62.5ms per tick = 3,840 ticks)
  stopWhenTicksInput.value = config.stopWhenTicksReached || 0;
  stopWhenTicksInput.style.cssText = 'width: 80px; text-align: center; background-color: #333; color: #fff; border: 1px solid #555; padding: 4px 8px; border-radius: 4px;';
  stopWhenTicksInput.disabled = config.stopCondition === 'maxFloor';
  
  stopWhenTicksContainer.appendChild(stopWhenTicksLabel);
  stopWhenTicksContainer.appendChild(stopWhenTicksInput);
  content.appendChild(stopWhenTicksContainer);

  // Maximum floor input (only shown when maxFloor mode is selected)
  const maxFloorContainer = document.createElement('div');
  maxFloorContainer.id = `${CONFIG_PANEL_ID}-max-floor-container`;
  maxFloorContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
  maxFloorContainer.style.display = config.stopCondition === 'maxFloor' ? 'flex' : 'none';
  
  const maxFloorLabel = document.createElement('label');
  maxFloorLabel.textContent = t('mods.manualRunner.maxFloorLabel') || 'Maximum Floor:';
  
  const maxFloorInput = document.createElement('input');
  maxFloorInput.type = 'number';
  maxFloorInput.id = `${CONFIG_PANEL_ID}-max-floor-input`;
  maxFloorInput.min = '0';
  maxFloorInput.max = '15';
  maxFloorInput.value = config.maxFloor !== undefined ? config.maxFloor : 10;
  maxFloorInput.style.cssText = 'width: 80px; text-align: center; background-color: #333; color: #fff; border: 1px solid #555; padding: 4px 8px; border-radius: 4px;';
  
  maxFloorContainer.appendChild(maxFloorLabel);
  maxFloorContainer.appendChild(maxFloorInput);
  content.appendChild(maxFloorContainer);

  // Show/hide max floor input and stop when ticks input based on stop condition selection
  stopSelect.addEventListener('change', () => {
    const isMaxFloor = stopSelect.value === 'maxFloor';
    maxFloorContainer.style.display = isMaxFloor ? 'flex' : 'none';
    stopWhenTicksContainer.style.display = isMaxFloor ? 'none' : 'flex';
    stopWhenTicksInput.disabled = isMaxFloor;
  });

  // Hide game board checkbox
  const hideContainer = document.createElement('div');
  hideContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  
  const hideInput = document.createElement('input');
  hideInput.type = 'checkbox';
  hideInput.id = `${CONFIG_PANEL_ID}-hide-input`; // Make ID unique to this panel
  hideInput.checked = Boolean(config.hideGameBoard); // Explicit boolean conversion
  
  const hideLabel = document.createElement('label');
  hideLabel.htmlFor = hideInput.id;
  hideLabel.textContent = t('mods.manualRunner.hideGameBoardDuringRuns');
  
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
  refillLabel.textContent = t('mods.manualRunner.enableAutoRefill');
  refillContainer.appendChild(refillInput);
  refillContainer.appendChild(refillLabel);
  content.appendChild(refillContainer);

  // Enable auto-sell creatures
  const sellContainer = document.createElement('div');
  sellContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  const sellInput = document.createElement('input');
  sellInput.type = 'checkbox';
  sellInput.id = `${CONFIG_PANEL_ID}-sell-input`;
  sellInput.checked = Boolean(config.enableAutoSellCreatures);
  const sellLabel = document.createElement('label');
  sellLabel.htmlFor = sellInput.id;
  sellLabel.textContent = t('mods.manualRunner.enableAutoSell');
  sellContainer.appendChild(sellInput);
  sellContainer.appendChild(sellLabel);
  content.appendChild(sellContainer);

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
      text: t('mods.manualRunner.start'),
      primary: true,
      disabled: !hasAlly || !analysisState.canStart(), // Disable if no ally creatures or already running
      onClick: () => {
        console.log('[Manual Runner] Start button clicked, canStart:', analysisState.canStart(), 'state:', analysisState.state);
        
        // Double-check ally creatures (in case board changed since panel opened)
        if (!hasAllyCreaturesOnBoard()) {
          console.log('[Manual Runner] No ally creatures on board, cannot start');
          api.ui.components.createModal({
            title: t('mods.manualRunner.cannotStartTitle'),
            content: t('mods.boardAnalyzer.noAllyWarning'),
            buttons: [{ text: t('controls.ok'), primary: true }]
          });
          return;
        }
        
        if (!analysisState.canStart()) {
          console.log('[Manual Runner] Already running, cannot start. Current state:', analysisState.state);
          // Force reset if stuck in stopping state
          if (analysisState.isStopping()) {
            console.log('[Manual Runner] Force resetting from STOPPING state');
            analysisState.reset();
          }
          return;
        }
        
        // Update configuration using the direct reference
        config.hideGameBoard = hideInput.checked;
        config.stopCondition = stopSelect.value;
        config.enableAutoRefillStamina = refillInput.checked;
        config.enableAutoSellCreatures = sellInput.checked;
        config.stopWhenTicksReached = parseInt(document.getElementById(`${CONFIG_PANEL_ID}-stop-when-ticks-input`).value, 10) || 0;
        config.maxFloor = parseInt(maxFloorInput.value, 10) || 10;
        // Clamp maxFloor to valid range
        if (config.maxFloor < 0) config.maxFloor = 0;
        if (config.maxFloor > 15) config.maxFloor = 15;
        // Save to localStorage (preferred method)
        saveConfig();
        // Also save via API for backward compatibility
        api.service.updateScriptConfig(context.hash, {
          hideGameBoard: config.hideGameBoard,
          stopCondition: config.stopCondition,
          enableAutoRefillStamina: config.enableAutoRefillStamina,
          enableAutoSellCreatures: config.enableAutoSellCreatures,
          stopWhenTicksReached: config.stopWhenTicksReached,
          maxFloor: config.maxFloor
        });
        console.log('[Manual Runner] Config saved on Start,', {
          hideGameBoard: config.hideGameBoard,
          stopCondition: config.stopCondition,
          enableAutoRefillStamina: config.enableAutoRefillStamina,
          enableAutoSellCreatures: config.enableAutoSellCreatures,
          stopWhenTicksReached: config.stopWhenTicksReached,
          maxFloor: config.maxFloor
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
      text: t('mods.manualRunner.save'),
      primary: false,
      disabled: !analysisState.canStart(),
      onClick: () => {
        // Use direct reference to the checkbox element
        config.hideGameBoard = hideInput.checked;
        config.stopCondition = stopSelect.value;
        config.enableAutoRefillStamina = refillInput.checked;
        config.enableAutoSellCreatures = sellInput.checked;
        config.stopWhenTicksReached = parseInt(document.getElementById(`${CONFIG_PANEL_ID}-stop-when-ticks-input`).value, 10) || 0;
        config.maxFloor = parseInt(maxFloorInput.value, 10) || 10;
        // Clamp maxFloor to valid range
        if (config.maxFloor < 0) config.maxFloor = 0;
        if (config.maxFloor > 15) config.maxFloor = 15;
        // Save to localStorage (preferred method)
        saveConfig();
        // Also save via API for backward compatibility
        api.service.updateScriptConfig(context.hash, {
          hideGameBoard: config.hideGameBoard,
          stopCondition: config.stopCondition,
          enableAutoRefillStamina: config.enableAutoRefillStamina,
          enableAutoSellCreatures: config.enableAutoSellCreatures,
          stopWhenTicksReached: config.stopWhenTicksReached,
          maxFloor: config.maxFloor
        });
        console.log('[Manual Runner] Config saved', {
          hideGameBoard: config.hideGameBoard,
          stopCondition: config.stopCondition,
          enableAutoRefillStamina: config.enableAutoRefillStamina,
          enableAutoSellCreatures: config.enableAutoSellCreatures,
          stopWhenTicksReached: config.stopWhenTicksReached,
          maxFloor: config.maxFloor
        });
      }
    },
    {
      text: t('mods.manualRunner.cancel'),
      primary: false
    }
  ];

  // Separator and credit footer
  const separator = document.createElement('div');
  separator.style.cssText = 'margin-top: 8px; border-top: 1px solid #444; opacity: 0.6;';
  const credit = document.createElement('div');
  credit.style.cssText = 'margin-top: 2px; font-size: 11px; font-style: italic; color: #aaa; text-align: right;';
  const linkHtml = '<a href="https://bestiaryarena.com/profile/btlucas" target="_blank" rel="noopener noreferrer" style="color:#61AFEF; text-decoration: underline;">btlucas</a>';
  credit.innerHTML = t('mods.manualRunner.madeWithHelp').replace('{link}', linkHtml);
  content.appendChild(separator);
  content.appendChild(credit);

  // Create and return the config panel
  const panel = api.ui.createConfigPanel({
    id: CONFIG_PANEL_ID,
    title: 'Manual Runner Configuration',
    modId: MOD_ID,
    content: content,
    buttons: buttons
  });
  
  // Manually disable Start button if no ally creatures (in case disabled property isn't supported)
  if (!hasAlly && panel && panel.element) {
    setTimeout(() => {
      // Find the Start button in the panel and disable it
      const startButton = panel.element.querySelector('button');
        if (startButton && startButton.textContent.trim() === t('mods.manualRunner.start')) {
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
  showVictories = false,
  currentFloor = null,
  maxFloor = null
) {
  // First, force close any existing modals (like Board Analyzer does)
  forceCloseAllModals();
  
  const content = document.createElement('div');
  content.style.cssText = 'text-align: center;';
  
  const message = createTextElement('p', {
    id: 'manual-runner-target',
    text: config.stopCondition === 'maxFloor' && maxFloor != null
      ? (t('mods.manualRunner.runningUntilMaxFloor') ? t('mods.manualRunner.runningUntilMaxFloor').replace('{floor}', maxFloor) : `Running until floor ${maxFloor}`)
      : targetRankPoints != null
      ? t('mods.manualRunner.runningUntilTarget').replace('{points}', targetRankPoints)
      : t('mods.manualRunner.runningUntilVictory')
  });
  content.appendChild(message);
  
  // Add floor display when in maxFloor mode
  if (config.stopCondition === 'maxFloor' && currentFloor != null) {
    const floorElement = createTextElement('p', {
      id: 'manual-runner-floor',
      text: t('mods.manualRunner.currentFloor') ? t('mods.manualRunner.currentFloor').replace('{floor}', currentFloor).replace('{max}', maxFloor || config.maxFloor || 10) : `Floor ${currentFloor}/${maxFloor || config.maxFloor || 10}`,
      style: 'margin-top: 8px; color: #61AFEF;'
    });
    content.appendChild(floorElement);
  }

  const progress = createTextElement('p', {
    id: 'manual-runner-progress',
    text: t('mods.manualRunner.attempt').replace('{n}', attempts),
    style: 'margin-top: 12px;'
  });
  content.appendChild(progress);
  
  // Add victories count only when tracking ticks threshold
  if (showVictories) {
    const victoriesElement = createTextElement('p', {
      id: 'manual-runner-victories',
      text: t('mods.manualRunner.victories').replace('{n}', victories),
      style: 'margin-top: 8px; color: #2ecc71;'
    });
    content.appendChild(victoriesElement);
  }
  
  // Add defeats count
  const defeatsElement = createTextElement('p', {
    id: 'manual-runner-defeats',
    text: t('mods.manualRunner.defeats').replace('{n}', defeats),
    style: 'margin-top: 8px; color: #e74c3c;'
  });
  content.appendChild(defeatsElement);
  
  // Add stamina usage
  const staminaElement = createTextElement('p', {
    id: 'manual-runner-stamina',
    text: t('mods.manualRunner.staminaSpent').replace('{n}', staminaSpent),
    style: 'margin-top: 8px; color: #3498db;'
  });
  content.appendChild(staminaElement);
  
  // Create self-contained HTML modal to avoid conflicts with other modals
  injectManualRunnerStyles();
  const wrapper = document.createElement('div');
  wrapper.id = 'manual-runner-running-modal';
  wrapper.dataset.pointerModal = 'running';
  wrapper.setAttribute('role', 'dialog');
  wrapper.setAttribute('aria-label', t('mods.manualRunner.runningHeader'));
  // Position only; visual theme comes from CSS to match Hunt Analyzer
  wrapper.className = 'manual-runner-modal';
  wrapper.style.cssText = ['position: absolute','left: 12px','bottom: 12px'].join(';');

  const header = document.createElement('div');
  header.textContent = t('mods.manualRunner.runningHeader');
  header.className = 'manual-runner-modal-header';

  const body = document.createElement('div');
  body.className = 'manual-runner-modal-body';
  body.appendChild(content);

  const footer = document.createElement('div');
  footer.className = 'manual-runner-modal-footer';

  const stopBtn = document.createElement('button');
  stopBtn.type = 'button';
  stopBtn.textContent = t('mods.manualRunner.stop');
  stopBtn.className = 'manual-runner-button';
  stopBtn.addEventListener('click', (e) => {
    console.log('[Manual Runner] Stop button clicked, current state:', analysisState.state);
    analysisState.stop();
    console.log('[Manual Runner] After stop(), state:', analysisState.state);
    stopBtn.disabled = true;
    stopBtn.textContent = t('mods.manualRunner.stopping');
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
      skips: 0,
      maxFloor: 0,
      minFloor: 0,
      finalFloor: null,
      floorArray: []
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
  
  // Calculate floor statistics
  const floorArray = attempts.filter(a => a.floor !== null && a.floor !== undefined).map(a => a.floor);
  const maxFloor = floorArray.length > 0 ? Math.max(...floorArray) : 0;
  const minFloor = floorArray.length > 0 ? Math.min(...floorArray) : 0;
  const finalFloor = attempts.length > 0 && attempts[attempts.length - 1].floor !== null && attempts[attempts.length - 1].floor !== undefined 
    ? attempts[attempts.length - 1].floor 
    : null;
  
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
    skips,
    maxFloor,
    minFloor,
    finalFloor,
    floorArray
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
    console.warn('[Manual Runner] ensureResultsSafeToOpen error:', e);
  }
  return false;
}

// Show results modal
async function showResultsModal(results) {
  console.log('[Manual Runner] showResultsModal called with results:', {
    success: results?.success,
    attempts: results?.attempts,
    hasAllAttempts: !!results?.allAttempts,
    allAttemptsLength: results?.allAttempts?.length,
    hasFinalResult: !!results?.finalResult
  });

  // Guard against opening while body is scroll-locked (would crash)
  const safeToOpen = await ensureResultsSafeToOpen(ENSURE_RESULTS_SAFE_TIMEOUT_MS);
  if (!safeToOpen) {
    console.warn('[Manual Runner] Body still scroll-locked; deferring results modal open...');
    setTimeout(() => { try { showResultsModal(results); } catch (_) {} }, DEFER_RESULTS_OPEN_MS);
    return;
  }

  setTimeout(() => {
    console.log('[Manual Runner] showResultsModal setTimeout callback executing...');
    const content = document.createElement('div');
    
    // Add a note if stopped by user
    if (results.forceStopped && !results.success) {
      content.appendChild(createTextElement('div', {
        text: t('mods.manualRunner.stoppedByUser'),
        style: 'text-align: center; color: #e74c3c; margin-bottom: 15px;'
      }));
    }
    
    // Calculate statistics from all attempts
    const attempts = results.allAttempts || [];
    const stats = calculateStatistics(attempts);
    
    // Create result statistics
    const statsContainer = document.createElement('div');
    statsContainer.style.cssText = 'display: grid; grid-template-columns: 55% 40%; gap: 10px; margin-bottom: 20px;';
    
    appendStatRow(statsContainer, t('mods.manualRunner.totalAttempts'), stats.totalAttempts.toString());

    appendStatRow(statsContainer, t('mods.manualRunner.completionRate'), `${stats.completionRate}% (${stats.completedAttempts}/${stats.totalAttempts})`, {
      valueStyle: 'text-align: right; color: #2ecc71; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
    });

    // Show different stats based on stop condition
    if (config.stopCondition === 'maxFloor') {
      // Floor mode: Show floor-related stats
      // Show max floor completed (use maxFloor which represents the highest floor reached)
      if (stats.maxFloor > 0) {
        appendStatRow(statsContainer, t('mods.manualRunner.maxFloorCompleted') || 'Max Floor Completed:', stats.maxFloor.toString(), {
          valueStyle: 'text-align: right; color: #FFD700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
        });
      }
      
      if (config.maxFloor !== undefined) {
        appendStatRow(statsContainer, t('mods.manualRunner.targetFloor') || 'Target Floor:', config.maxFloor.toString(), {
          valueStyle: 'text-align: right; color: #FFD700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
        });
      }
    } else if (config.stopCondition === 'max') {
      // Rank mode: Show rank-related stats
      if (stats.sPlusCount > 0) {
        appendStatRow(statsContainer, t('mods.manualRunner.sPlusRate'), `${stats.sPlusRate}% (${stats.sPlusCount}/${stats.totalAttempts})`, {
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

              appendStatRow(statsContainer, t('mods.manualRunner.sPlusPointsRate').replace('{points}', rp), `${rate}% (${count}/${stats.totalAttempts})`, {
                labelStyle: 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 10px; font-style: italic;',
                valueStyle: `text-align: right; color: ${textColor}; font-style: italic;`
              });
            });
          }
        } catch (e) {
          console.warn('[Manual Runner] Error creating S+ breakdown:', e);
        }
      }

      if (!results.success) {
        try {
          const maxTeamSizeForTarget = getMaxTeamSize(null);
          const playerTeamSizeForTarget = getPlayerTeamSize();
          const targetRankPoints = Math.max(0, (2 * maxTeamSizeForTarget) - playerTeamSizeForTarget);

          appendStatRow(statsContainer, t('mods.manualRunner.highestRankPoints'), (stats.maxRankPoints || 0).toString(), {
            valueStyle: 'text-align: right; color: #FFD700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
          });

          appendStatRow(statsContainer, t('mods.manualRunner.targetRank'), `S+${targetRankPoints}`, {
            valueStyle: 'text-align: right; color: #FFD700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
          });
        } catch (e) {
          console.warn('[Manual Runner] Could not compute target rank points for display:', e);
        }
      }

      if (stats.maxRankPoints > 0) {
        appendStatRow(statsContainer, t('mods.manualRunner.maxRankPoints'), stats.maxRankPoints.toString(), {
          valueStyle: 'text-align: right; color: #FFD700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
        });
      }
    } else {
      // Any victory mode: Show general stats (no rank points)
      // Just show completion rate and basic stats
    }

    appendStatRow(statsContainer, t('mods.manualRunner.staminaSpent').replace(': {n}', ':'), (stats.staminaSpentTotal || 0).toString());

    appendStatRow(statsContainer, t('mods.manualRunner.skips'), (stats.skips || 0).toString());
    
    // If victory, show success message
    if (results.success && results.finalResult) {
      content.appendChild(createTextElement('div', {
        text: t('mods.manualRunner.victoryAchieved'),
        style: 'text-align: center; color: #2ecc71; margin-bottom: 15px; font-size: 1.2em; font-weight: bold;'
      }));

      let finalResultText = results.finalResult.grade || 'N/A';
      if (results.finalResult.grade === 'S+' && results.finalResult.rankPoints) {
        finalResultText = `S+${results.finalResult.rankPoints}`;
      }
      finalResultText += ` (${results.finalResult.ticks} ticks)`;

      appendStatRow(statsContainer, t('mods.manualRunner.finalResult'), finalResultText);
    }
    
    content.appendChild(statsContainer);

    // Show floor-based chart for maxFloor mode if there are victories
    if (config.stopCondition === 'maxFloor') {
      const victoryAttempts = attempts.filter(a => a && (a.completed || a.victory) && a.floor !== null && a.floor !== undefined);
      if (victoryAttempts.length > 0) {
        // Sort victories by floor, then by order in attempts array
        const sortedVictories = [...victoryAttempts].sort((a, b) => {
          if (a.floor !== b.floor) return a.floor - b.floor;
          return attempts.indexOf(a) - attempts.indexOf(b);
        });
        
        // Find max ticks for scaling
        const maxTicks = Math.max(...sortedVictories.map(v => v.ticks), 1);
        
        // Create floor chart
        const chartContainer = document.createElement('div');
        chartContainer.style.cssText = 'margin-top: 20px; border: 1px solid #333; padding: 10px;';
        
        const chartTitle = document.createElement('div');
        chartTitle.textContent = t('mods.manualRunner.floorVictoriesChart') || 'Floor Victories';
        chartTitle.style.cssText = 'text-align: center; color: #3498db; margin-bottom: 15px; font-size: 0.9em; font-weight: 500;';
        chartContainer.appendChild(chartTitle);
        
        // Create scrollable chart area (matching Board Analyzer style)
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
        
        const barsContainer = document.createElement('div');
        barsContainer.style.cssText = 'height: 150px; position: relative;';
        
        // Calculate dimensions - fit up to 15 floors, estimate max 10 victories per floor = 150 bars max
        // But we'll calculate actual width based on actual victories
        const spacing = CHART_BAR_SPACING;
        const barWidth = CHART_BAR_WIDTH;
        const totalChartWidth = sortedVictories.length * (barWidth + spacing) - spacing;
        
        // Update container width
        barsContainer.style.width = `${totalChartWidth}px`;
        
        // Create bars for each victory (matching Board Analyzer style)
        sortedVictories.forEach((victory, index) => {
          const barHeight = Math.max(CHART_MIN_HEIGHT, Math.floor((victory.ticks / maxTicks) * CHART_MAX_HEIGHT));
          const bar = document.createElement('div');
          
          // Determine bar color based on grade
          let barColor = '#4CAF50'; // Green for completed
          if (victory.grade === 'S+') {
            barColor = '#FFD700'; // Gold for S+
          } else if (victory.grade === 'S') {
            barColor = '#4CAF50'; // Green for S
          } else if (victory.grade === 'A') {
            barColor = '#2196F3'; // Blue for A
          } else if (victory.grade === 'B') {
            barColor = '#9C27B0'; // Purple for B
          }
          
          bar.style.cssText = `
            position: absolute;
            bottom: 0;
            left: ${index * (barWidth + spacing)}px;
            width: ${barWidth}px;
            height: ${barHeight}px;
            background-color: ${barColor};
            transition: height 0.3s ease;
            cursor: pointer;
            border: 1px solid transparent;
            z-index: 1;
            display: block;
            box-sizing: border-box;
          `;
          
          // Tooltip
          let tooltipText = `Floor ${victory.floor}: ${victory.ticks} ticks, Grade: ${victory.grade || 'N/A'}`;
          if (victory.seed) {
            tooltipText += `, Seed: ${victory.seed}`;
          }
          tooltipText += `\n${t('mods.manualRunner.clickToCopyReplay') || 'Click to copy replay'}`;
          bar.title = tooltipText;
          
          // Hover effects
          bar.addEventListener('mouseenter', () => {
            bar.style.border = '1px solid white';
            bar.style.transform = 'scale(1.1)';
          });
          bar.addEventListener('mouseleave', () => {
            bar.style.border = '1px solid transparent';
            bar.style.transform = 'scale(1)';
          });
          
          // Click handler to copy replay
          bar.addEventListener('click', () => {
            const replayData = createReplayDataForAttempt(victory);
            if (replayData) {
              const replayText = `$replay(${JSON.stringify(replayData)})`;
              const success = copyToClipboard(replayText);
              if (success) {
                showCopyNotification(t('mods.manualRunner.copiedReplay'));
              } else {
                showCopyNotification(t('mods.manualRunner.failedCopyReplay'), true);
              }
            } else if (victory.seed) {
              const seedText = victory.seed.toString();
              const success = copyToClipboard(seedText);
              if (success) {
                showCopyNotification(t('mods.manualRunner.copiedSeed').replace('{seed}', seedText));
              } else {
                showCopyNotification(t('mods.manualRunner.failedCopySeed'), true);
              }
            }
          });
          
          barsContainer.appendChild(bar);
        });
        
        // Add floor labels below the chart
        const labelsContainer = document.createElement('div');
        labelsContainer.style.cssText = `
          width: 246px;
          height: 20px;
          margin-top: 5px;
          position: relative;
          overflow-x: auto;
          overflow-y: hidden;
        `;
        
        const labelsInner = document.createElement('div');
        labelsInner.style.cssText = `
          height: 20px;
          position: relative;
          width: ${totalChartWidth}px;
        `;
        
        // Group victories by floor to show labels
        const victoriesByFloor = {};
        sortedVictories.forEach((victory, index) => {
          const floor = victory.floor;
          if (!victoriesByFloor[floor]) {
            victoriesByFloor[floor] = { startIndex: index, count: 0 };
          }
          victoriesByFloor[floor].count++;
        });
        
        // Create floor labels positioned under their bars (matching bar positions)
        Object.keys(victoriesByFloor).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).forEach(floor => {
          const { startIndex, count } = victoriesByFloor[floor];
          const label = document.createElement('div');
          label.textContent = `F${floor}`;
          const labelLeft = startIndex * (barWidth + spacing);
          const labelWidth = (count * (barWidth + spacing)) - spacing;
          label.style.cssText = `
            position: absolute;
            left: ${labelLeft}px;
            width: ${labelWidth}px;
            font-size: 10px;
            color: #aaa;
            text-align: center;
          `;
          labelsInner.appendChild(label);
        });
        
        labelsContainer.appendChild(labelsInner);
        
        scrollWrapper.appendChild(barsContainer);
        chartContainer.appendChild(scrollWrapper);
        chartContainer.appendChild(labelsContainer);
        content.appendChild(chartContainer);
      }
    }

    // Copy Replay button for last victory (hide for maxFloor mode since chart has clickable bars)
    // Get the last (most recent) victory attempt
    const victoryAttempts = attempts.filter(a => a && (a.completed || a.victory));
    const victoryAttempt = victoryAttempts.length > 0 ? victoryAttempts[victoryAttempts.length - 1] : null;
    if (victoryAttempt && config.stopCondition !== 'maxFloor') {
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
            showCopyNotification(t('mods.manualRunner.copiedReplay'));
          } else {
            showCopyNotification(t('mods.manualRunner.failedCopyReplay'), true);
          }
        } else if (attempt && attempt.seed) {
          const seedText = attempt.seed.toString();
          const success = copyToClipboard(seedText);
          if (success) {
            showCopyNotification(t('mods.manualRunner.copiedSeed').replace('{seed}', seedText));
          } else {
            showCopyNotification(t('mods.manualRunner.failedCopySeed'), true);
          }
        } else {
          showCopyNotification(t('mods.manualRunner.noReplayOrSeed'), true);
        }
      });

      replayContainer.appendChild(copyReplayBtn);
      content.appendChild(replayContainer);
    } else if (!victoryAttempt && config.stopCondition !== 'maxFloor') {
      content.appendChild(createTextElement('p', {
        text: t('mods.manualRunner.noAttemptsYet'),
        style: 'text-align: center; color: #777; margin-top: 15px;'
      }));
    }
    
    const modal = api.ui.components.createModal({
      title: t('mods.manualRunner.resultsTitle'),
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
    
    console.log('[Manual Runner] Modal created by API:', modal);
    console.log('[Manual Runner] Modal type:', typeof modal);
    
    // Handle modal - it might be a function (closeModal) or an object
    let modalObject = modal;
    if (typeof modal === 'function') {
      // If it's a function, wrap it in an object with close method
      console.log('[Manual Runner] Modal is a function, wrapping it...');
      modalObject = {
        close: modal,
        element: null, // Will find in DOM if needed
        type: MODAL_TYPES.RESULTS
      };
    } else if (modal && typeof modal === 'object') {
      // If it's already an object, just add type
      modalObject.type = MODAL_TYPES.RESULTS;
    } else {
      console.error('[Manual Runner] ERROR: Modal was not created or has unexpected type!');
      return null;
    }
    
    // Find the actual modal element in DOM by title
    setTimeout(() => {
      const modalElements = document.querySelectorAll('[role="dialog"]');
      modalElements.forEach((el) => {
        const header = el.querySelector('.widget-top-text');
        if (header && header.textContent.includes(t('mods.manualRunner.resultsTitle'))) {
          modalObject.element = el;
          console.log('[Manual Runner] Found modal element in DOM and attached to modalObject');
        }
      });
    }, 50);
    
    // Register results modal with modal manager (like Board Analyzer)
    modalManager.register('results-modal', modalObject);
    
    console.log('[Manual Runner] Results modal created and registered');
    console.log('[Manual Runner] Modal object details:', {
      hasModal: !!modalObject,
      hasClose: typeof modalObject?.close === 'function',
      hasElement: !!modalObject?.element,
      type: modalObject?.type
    });
    
    return modalObject;
  }, 100);
  
  console.log('[Manual Runner] showResultsModal returned (setTimeout scheduled)');
}

// Main entry point - Run the analysis
async function runAnalysis() {
  console.log('[Manual Runner] runAnalysis called, current state:', analysisState.state, 'canStart:', analysisState.canStart());
  
  if (!analysisState.canStart()) {
    console.log('[Manual Runner] Already running, cannot start new analysis. State:', analysisState.state);
    return;
  }
  
  // Close any existing modals using modal manager (like Board Analyzer)
  modalManager.closeByType(MODAL_TYPES.RUNNING);
  activeRunningModal = null;
  
  console.log('[Manual Runner] Cleared any existing running modals');
  
  let runningModal = null;
  
  try {
    // Signal to other mods that Manual Runner is running (for coordination)
    try {
      window.__modCoordination = window.__modCoordination || {};
      window.__modCoordination.manualRunnerRunning = true;
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
        console.log('[Manual Runner] Enabled auto-refill stamina via Bestiary Automator');
      }
    } catch (e) {
      console.warn('[Manual Runner] Could not enable auto-refill stamina via Bestiary Automator:', e);
    }
    
    // Get initial floor for display
    const initialFloor = getCurrentFloor();
    
    // Show running modal with target info
    runningModal = showRunningAnalysisModal(
      0,
      0,
      0,
      0,
      targetRankPoints,
      config.stopWhenTicksReached > 0,
      config.stopCondition === 'maxFloor' ? initialFloor : null,
      config.stopCondition === 'maxFloor' ? config.maxFloor : null
    );
    activeRunningModal = runningModal;
    
    // Run until victory with status updates
    console.log('[Manual Runner] Starting runUntilVictory, about to await...');
    const results = await runUntilVictory(targetRankPoints, (status) => {
      updateTextContent('manual-runner-progress', t('mods.manualRunner.attempt').replace('{n}', status.attempts));

      if (config.stopCondition === 'maxFloor') {
        updateTextContent('manual-runner-target', t('mods.manualRunner.runningUntilMaxFloor') ? t('mods.manualRunner.runningUntilMaxFloor').replace('{floor}', config.maxFloor) : `Running until floor ${config.maxFloor}`);
        if (status.floor !== undefined) {
          const floorElement = document.getElementById('manual-runner-floor');
          if (floorElement) {
            floorElement.textContent = t('mods.manualRunner.currentFloor') ? t('mods.manualRunner.currentFloor').replace('{floor}', status.floor).replace('{max}', config.maxFloor) : `Floor ${status.floor}/${config.maxFloor}`;
          }
        }
      } else if (typeof targetRankPoints === 'number') {
        updateTextContent('manual-runner-target', t('mods.manualRunner.runningUntilTarget').replace('{points}', targetRankPoints));
      } else {
        updateTextContent('manual-runner-target', t('mods.manualRunner.runningUntilVictory'));
      }

      if (status.victories !== undefined) {
        updateTextContent('manual-runner-victories', t('mods.manualRunner.victories').replace('{n}', status.victories));
      }

      if (status.defeats !== undefined) {
        updateTextContent('manual-runner-defeats', t('mods.manualRunner.defeats').replace('{n}', status.defeats));
      }

      if (status.staminaSpent !== undefined) {
        updateTextContent('manual-runner-stamina', t('mods.manualRunner.staminaSpent').replace('{n}', status.staminaSpent));
      }
    });
    
    console.log('[Manual Runner] runUntilVictory returned! Results:', results);
    console.log('[Manual Runner] Results type:', typeof results);
    console.log('[Manual Runner] Results keys:', results ? Object.keys(results) : 'null');
    console.log('[Manual Runner] Results.success:', results?.success);
    console.log('[Manual Runner] Results.attempts:', results?.attempts);
    console.log('[Manual Runner] Results.allAttempts length:', results?.allAttempts?.length);
    
    // Always show results, even if analysis was stopped early
    console.log('[Manual Runner] Analysis completed, showing results:', results);
    console.log('[Manual Runner] Current runningModal state:', !!runningModal);
    console.log('[Manual Runner] Current activeRunningModal state:', !!activeRunningModal);
    
    // Force close all modals (like Board Analyzer does)
    console.log('[Manual Runner] Step 1: Calling forceCloseAllModals() first time...');
    forceCloseAllModals();
    console.log('[Manual Runner] Step 1: forceCloseAllModals() completed');
    
    // Ensure we do NOT close the running modal twice.
    // Step 1 already closed all registered modals via ModalManager.
    if (runningModal) {
      console.log('[Manual Runner] Step 2: Skipping runningModal close (already closed by forceCloseAllModals)');
    }
    runningModal = null;
    activeRunningModal = null;
    
    // Small delay to ensure UI updates properly (like Board Analyzer)
    console.log('[Manual Runner] Step 3: Waiting', UI_UPDATE_DELAY_MS, 'ms for UI update...');
    await sleep(UI_UPDATE_DELAY_MS);
    console.log('[Manual Runner] Step 3: Wait completed');
    
    // Show the results modal (works for both completed and partial results)
    // Don't call forceCloseAllModals again before showing results - let the results modal show
    console.log('[Manual Runner] Step 4: About to call showResultsModal()...');
    console.log('[Manual Runner] Step 4: Results being passed:', {
      success: results?.success,
      attempts: results?.attempts,
      hasAllAttempts: !!results?.allAttempts,
      allAttemptsLength: results?.allAttempts?.length
    });
    
    // Show results modal - it handles its own cleanup
    showResultsModal(results);
    console.log('[Manual Runner] Step 4: showResultsModal() called');
    
  } catch (error) {
    console.error('[Manual Runner] Analysis error:', error);
    
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
      console.log('[Manual Runner] runAnalysis finally: Ensuring state is reset. Current state:', analysisState.state);
      analysisState.reset();
    }
    // Clear coordination flag so other mods may resume safely
    try {
      window.__modCoordination = window.__modCoordination || {};
      window.__modCoordination.manualRunnerRunning = false;
    } catch (_) {}
  }
}

// =======================
// 6. Initialization
// =======================

// Initialize UI
function init() {
  console.log('[Manual Runner] Initializing UI...');
  
  // Add the main button
  api.ui.addButton({
    id: BUTTON_ID,
    text: t('mods.manualRunner.buttonText'),
    modId: MOD_ID,
    tooltip: t('mods.manualRunner.buttonTooltip'),
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
  
  console.log('[Manual Runner] UI initialized');
}

// =======================
// 7. Cleanup System
// =======================

function cleanupManualRunner() {
  console.log('[Manual Runner] Starting cleanup...');
  
  try {
    // 1. Stop any running analysis
    if (analysisState.isRunning()) {
      console.log('[Manual Runner] Stopping running analysis during cleanup');
      analysisState.stop();
    }
    
    // 2. Close all modals (also removes event listeners via DOM removal)
    console.log('[Manual Runner] Closing all modals...');
    forceCloseAllModals();
    
    // 3. Cleanup all subscriptions
    console.log('[Manual Runner] Cleaning up subscriptions...');
    cleanupBoardSubscription();
    cleanupRewardsScreenSubscription();
    
    // 4. Cleanup game state tracker
    if (gameStateTracker) {
      console.log('[Manual Runner] Cleaning up game state tracker...');
      gameStateTracker.stopSubscription();
      gameStateTracker = null;
    }
    
    // 5. Reset analysis state
    console.log('[Manual Runner] Resetting analysis state...');
    analysisState.reset();
    
    // 6. Clear global state variables
    console.log('[Manual Runner] Clearing global state...');
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
      console.log('[Manual Runner] Restoring game board visibility...');
      const gameFrame = document.querySelector('main .frame-4');
      if (gameFrame && gameFrame.style.display === 'none') {
        gameFrame.style.display = '';
      }
    }
    
    // 9. Clear coordination flags
    try {
      if (window.__modCoordination) {
        window.__modCoordination.manualRunnerRunning = false;
      }
    } catch (_) {}
    
    console.log('[Manual Runner] Cleanup completed successfully');
  } catch (error) {
    console.error('[Manual Runner] Error during cleanup:', error);
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
  cleanup: cleanupManualRunner
};

