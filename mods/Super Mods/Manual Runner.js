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
  enableAutoInjectSealedCreatures: false,
  stopWhenTicksReached: 0, // Stop when finding a run with this number of ticks or less
  stopAfterRounds: 0, // Stop after X rounds; 0 = endless (manual stop only)
  maxFloor: 10, // Maximum floor to reach (0-15)
  /** When true, auto-click Skip when it shows a stamina cost. Default off; normal free skips still auto-click regardless. */
  enableStaminaSkip: false
};

// Storage key for localStorage
const STORAGE_KEY = 'manualRunnerConfig';

// Load config from localStorage (preferred) or context.config
// options.silent — avoid duplicate logs when createConfigPanel() refreshes after initial load
function loadConfig(options = {}) {
  const silent = !!options.silent;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (!silent) {
        console.log('[Manual Runner] Loaded config from localStorage:', parsed);
      }
      const merged = Object.assign({}, defaultConfig, parsed);
      const validStopConditions = new Set(['any', 'max', 'maxFloor', 'rounds']);
      if (!validStopConditions.has(merged.stopCondition)) {
        merged.stopCondition = defaultConfig.stopCondition;
      }
      return merged;
    }
  } catch (error) {
    console.error('[Manual Runner] Error loading config from localStorage:', error);
  }
  
  // Fallback to context.config if localStorage is empty
  return Object.assign({}, defaultConfig, context.config || {});
}

// Save config to localStorage. options.silent — caller logs a single summary line
function saveConfig(options = {}) {
  const silent = !!options.silent;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    if (!silent) {
      console.log('[Manual Runner] Saved config to localStorage:', config);
    }
  } catch (error) {
    console.error('[Manual Runner] Error saving config to localStorage:', error);
  }
}

function logConfigSummary(prefix) {
  console.log(`[Manual Runner] ${prefix}`, {
    stop: config.stopCondition,
    ticksMax: config.stopWhenTicksReached,
    roundsMax: config.stopAfterRounds,
    maxFloor: config.maxFloor,
    refill: config.enableAutoRefillStamina,
    autoSell: config.enableAutoSellCreatures,
    autoInject: config.enableAutoInjectSealedCreatures,
    hideBoard: config.hideGameBoard,
    staminaSkip: config.enableStaminaSkip
  });
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
const BOARD_IDLE_MAX_WAIT_MS = 10000;
const BOARD_IDLE_RECHECK_DELAY_MS = 100;
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
let mainButtonWarningInterval = null;

// Inject Manual Runner styles (reuse Hunt Analyzer theme)
function injectManualRunnerStyles() {
  const styleId = 'manual-runner-styles';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    :root {
      --mr-frame-3: url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill;
      --mr-frame-1: url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 4 fill;
      --mr-frame-1-pressed: url("https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png") 4 fill;
      --mr-frame-4: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch;
    }
    /* Themed container matching Hunt Analyzer */
    .manual-runner-modal {
      background-image: url(/_next/static/media/background-darker.2679c837.png);
      background-repeat: repeat;
      background-color: #282C34;
      border: 6px solid transparent;
      border-image: var(--mr-frame-3);
      color: #ABB2BF;
      border-radius: 6px;
      box-shadow: 0 0 15px rgba(0,0,0,0.7);
      padding: 0;
      min-width: 220px;
      max-width: 260px;
      z-index: 2147483647;
      font-family: Inter, sans-serif;
      overflow: hidden;
      box-sizing: border-box;
    }
    .manual-runner-modal-header {
      background-image: url(/_next/static/media/background-regular.b0337118.png);
      background-repeat: repeat;
      background-color: rgba(40,44,52,0.5);
      border: 6px solid transparent;
      border-image: var(--mr-frame-4);
      margin: 2px;
      padding: 4px;
      text-align: center;
      color: #E06C75;
      font-weight: bold;
      font-size: 14px;
      text-shadow: 0 0 5px rgba(224, 108, 117, 0.7);
      box-sizing: border-box;
    }
    .manual-runner-modal-body {
      background-image: url(/_next/static/media/background-regular.b0337118.png);
      background-repeat: repeat;
      background-color: rgba(40,44,52,0.5);
      border: 6px solid transparent;
      border-image: var(--mr-frame-4);
      margin: 0 2px;
      padding: 4px;
      box-sizing: border-box;
    }
    .manual-runner-modal-footer {
      display: flex;
      justify-content: center;
      border: 6px solid transparent;
      border-image: var(--mr-frame-4);
      background-image: url(/_next/static/media/background-regular.b0337118.png);
      background-repeat: repeat;
      background-color: rgba(40,44,52,0.5);
      margin: 0 2px 2px 2px;
      padding: 4px;
      box-sizing: border-box;
    }
    .manual-runner-button {
      padding: 2px 10px;
      border: 4px solid transparent;
      border-image: var(--mr-frame-1);
      background-image: url(/_next/static/media/background-dark.95edca67.png);
      background-repeat: repeat;
      background-color: #4B5563;
      color: #ABB2BF;
      font-size: 11px;
      font-weight: 700;
      font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
      cursor: pointer;
      transition: color 0.2s, border-image 0.1s, filter 0.15s;
      box-shadow: 0 2px 5px rgba(0,0,0,0.5);
      min-height: 24px;
      line-height: 1.1;
    }
    .manual-runner-button:hover {
      color: #9EA7B3;
      filter: brightness(1.12);
    }
    .manual-runner-button:active {
      border-image: var(--mr-frame-1-pressed);
      filter: brightness(0.95);
    }
    .manual-runner-stat {
      margin-top: 6px;
      font-size: 12px;
      color: #ABB2BF;
      text-align: center;
    }
    .manual-runner-stat.warn { color: #E06C75; }
    .manual-runner-stat.info { color: #61AFEF; }
    .manual-runner-live-section {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 0;
      color: #61AFEF;
      font-size: 11px;
      line-height: 15px;
      font-family: Inter, sans-serif;
    }
    .manual-runner-live-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 15px;
    }
    .manual-runner-live-label {
      color: #ABB2BF;
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1 1 auto;
      min-width: 0;
    }
    .manual-runner-live-value {
      color: #61AFEF;
      text-align: right;
      white-space: nowrap;
      flex: 0 0 auto;
      font-weight: 600;
      font-size: 12px;
    }
    .manual-runner-live-value-endless {
      color: #E06C75;
      font-weight: 600;
    }
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
  modalManager.closeAll();
}

// Helper function to close running modal specifically
function closeRunningModal() {
  try {
    modalManager.close('running-modal');
    activeRunningModal = null;
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
  
  forceStop() {
    this.state = ANALYSIS_STATES.STOPPING;
    this.forceStop = true;
    // Force stop immediately - don't wait for current run to finish
    console.log('[Manual Runner] Force stop requested - aborting immediately');
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
let allAttempts = []; // Slim per-attempt stats (no full serverResults — keeps long runs from ballooning memory)
let boardSubscription = null; // Subscription to board state for serverResults
let pendingServerResults = new Map(); // Map of seed -> serverResults for matching to attempts
let lastInjectProcessedSeed = null; // Avoid double-inject on the same reward
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

/** Log [Perf] every N attempts + batch start/end (Chrome: heap via performance.memory). */
const PERF_LOG_EVERY_N_ATTEMPTS = 25;

function getManualRunnerPerfSnapshot() {
  const heapMb =
    typeof performance !== 'undefined' && performance.memory?.usedJSHeapSize
      ? Math.round(performance.memory.usedJSHeapSize / 1048576)
      : null;
  return {
    stored: allAttempts.length,
    pending: pendingServerResults.size,
    boardSub: !!boardSubscription,
    rewardsSub: !!openRewardsSubscription,
    timerSub: !!gameTimerUnsubscribe,
    trackerListeners: gameStateTracker?.listeners?.size ?? 0,
    modals: modalManager?.activeModals?.size ?? 0,
    heapMb
  };
}

function formatManualRunnerPerfSnapshot(s) {
  const heap = s.heapMb != null ? ` heap=${s.heapMb}MB` : '';
  return `stored=${s.stored} pending=${s.pending} subs=${s.boardSub ? 1 : 0}/${s.rewardsSub ? 1 : 0}/${s.timerSub ? 1 : 0} listeners=${s.trackerListeners} modals=${s.modals}${heap}`;
}

function logManualRunnerPerfCheckpoint(attemptNumber, attemptMs) {
  if (PERF_LOG_EVERY_N_ATTEMPTS <= 0) return;
  if (attemptNumber !== 1 && attemptNumber % PERF_LOG_EVERY_N_ATTEMPTS !== 0) return;
  console.log(
    `[Manual Runner][Perf] attempt=${attemptNumber} attemptMs=${Math.round(attemptMs)} ${formatManualRunnerPerfSnapshot(getManualRunnerPerfSnapshot())}`
  );
}

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
    }
    
    // Fallback to board context
    if (!roomId) {
      const boardContext = globalThis.state.board.getSnapshot().context;
      const selectedMap = boardContext.selectedMap || {};
      roomId = selectedMap.selectedRoom?.id;
    }
    
    if (roomId && globalThis.state?.utils?.ROOMS) {
      const rooms = globalThis.state.utils.ROOMS;
      
      // Try to find by id (could be string or number)
      let roomData = rooms.find(room => room.id === roomId || room.id === String(roomId) || String(room.id) === roomId);
      
      // If not found, try to find by file name or other identifier
      if (!roomData && typeof roomId === 'string') {
        roomData = rooms.find(room => room.file?.name === roomId || room.file?.id === roomId);
      }
      
      if (roomData && typeof roomData.maxTeamSize === 'number') {
        return roomData.maxTeamSize;
      }
    }
  } catch (error) {
    console.warn('[Manual Runner] Error getting maxTeamSize:', error);
  }
  
  // Default fallback (most common is 5, but some maps are different)
  return 5;
}

// Find and click the start button
function findStartButton() {
  // Prefer board action buttons only (avoid clicking "Start" from other modals/tools).
  const startTexts = ['start', 'fight', 'iniciar', 'lutar', 'jogar', 'começar'];
  const candidates = document.querySelectorAll('button[data-full="false"][data-state="closed"]');

  const isBoardStartButton = (button) => {
    if (!button || button.disabled) return false;
    const text = (button.textContent || '').trim().toLowerCase();
    if (!startTexts.some((t) => text === t || text.includes(t))) return false;

    // Board controls are rendered under a container that includes class token "sm:order-3".
    let node = button.parentElement;
    while (node) {
      if (node.classList && node.classList.contains('sm:order-3')) return true;
      node = node.parentElement;
    }

    // Fallback heuristic: board control row usually includes the Manual mode icon next to Start.
    const container = button.parentElement;
    if (container && container.querySelector('img[alt="Manual"]')) {
      return true;
    }

    return false;
  };

  for (const button of candidates) {
    if (isBoardStartButton(button)) {
      return button;
    }
  }

  // Final fallback for UI variants: still require board-control context.
  const allButtons = document.querySelectorAll('button');
  for (const button of allButtons) {
    if (isBoardStartButton(button)) {
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

/**
 * Robust start click for transient UI states.
 * Retries for a short window with ESC nudge + coordination wait before giving up.
 */
async function clickStartButtonRobust(options = {}) {
  const maxWaitMs = Math.max(200, Number(options.maxWaitMs) || 10000);
  const recheckDelayMs = Math.max(40, Number(options.recheckDelayMs) || 1000);
  const startTs = performance.now();
  const deadline = startTs + maxWaitMs;
  let attempts = 0;

  while (performance.now() < deadline) {
    attempts++;
    if (clickStartButton()) {
      if (attempts > 1) {
        const elapsed = Math.round(performance.now() - startTs);
        console.log(`[Manual Runner] Start button recovered after ${attempts} checks (${elapsed}ms)`);
      }
      return true;
    }

    // Close transient overlays/modals that may block board controls.
    dispatchEsc();

    const remaining = deadline - performance.now();
    if (remaining <= 0) {
      break;
    }

    // Respect Bestiary Automator coordination while we re-check board controls.
    await waitForModCoordinationTasks({
      maxWaitMs: Math.min(350, Math.max(120, remaining)),
      delayMs: 120,
      context: 'start-button recovery'
    });

    if (performance.now() >= deadline) {
      break;
    }
    await sleep(Math.min(recheckDelayMs, Math.max(40, deadline - performance.now())));
  }

  console.error(`[Manual Runner] Failed to find start button after ${attempts} checks (${Math.round(performance.now() - startTs)}ms)`);
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
      return false;
    }
  } catch (error) {
    console.error('[Manual Runner] Error setting manual mode:', error);
    return false;
  }
}

let lastManualModeEnforceAt = 0;
let lockedFloorDuringRun = null;
let lastFloorEnforceAt = 0;

function enforceManualModeLock(currentMode = null) {
  if (!analysisState.isRunning()) return false;
  try {
    const mode = currentMode ?? globalThis.state?.board?.getSnapshot?.()?.context?.mode;
    if (mode === 'manual' || typeof mode === 'undefined') return false;

    const now = Date.now();
    if (now - lastManualModeEnforceAt < 250) return false;
    lastManualModeEnforceAt = now;

    console.log(`[Manual Runner] Mode lock: forcing ${mode} → manual`);
    globalThis.state?.board?.send?.({ type: 'setPlayMode', mode: 'manual' });
    return true;
  } catch (error) {
    console.warn('[Manual Runner] Error enforcing manual mode lock:', error);
    return false;
  }
}

function setLockedFloorDuringRun(floor = null) {
  if (typeof floor === 'number' && floor >= 0 && floor <= 15) {
    lockedFloorDuringRun = floor;
    return;
  }
  lockedFloorDuringRun = null;
}

function enforceFloorLock(currentFloor = null) {
  if (!analysisState.isRunning()) return false;
  if (typeof lockedFloorDuringRun !== 'number') return false;
  if (typeof currentFloor !== 'number') return false;
  if (currentFloor === lockedFloorDuringRun) return false;

  const now = Date.now();
  if (now - lastFloorEnforceAt < 250) return false;
  lastFloorEnforceAt = now;

  console.log(`[Manual Runner] Floor lock: forcing ${currentFloor} → ${lockedFloorDuringRun}`);
  globalThis.state?.board?.trigger?.setState?.({
    fn: (prev) => ({ ...prev, floor: lockedFloorDuringRun })
  });
  return true;
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

function updateMainButtonSealedWarning() {
  try {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;

    const currentFloor = getCurrentFloor();
    const showWarning = (Boolean(config.enableAutoSellCreatures) || Boolean(config.enableAutoInjectSealedCreatures)) && currentFloor >= 11;
    const baseText = t('mods.manualRunner.buttonText') || 'Manual Runner';

    button.textContent = showWarning ? `${baseText} ⚠` : baseText;
    button.style.color = showWarning ? '#e74c3c' : '#ffe066';
    button.title = showWarning
      ? 'Autosell or auto-inject is enabled on floor 11+ (sealed creatures may be affected)'
      : (t('mods.manualRunner.buttonTooltip') || 'Run manual mode until victory (restarts on defeat)');
  } catch (error) {
    console.warn('[Manual Runner] Error updating main button warning:', error);
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
    setLockedFloorDuringRun(nextFloor);
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
  } catch (error) {
    console.warn('[Manual Runner] Error setting up gameTimer subscription:', error);
  }
}

// Cleanup persistent gameTimer subscription
function cleanupGameTimerSubscription() {
  if (gameTimerUnsubscribe) {
    gameTimerUnsubscribe();
    gameTimerUnsubscribe = null;
  }
}

// Function to wait for game completion (tracking reward screen - 1 reward screen = 1 run)
async function waitForGameCompletion(analysisId) {
  // Reset reward screen state at start (should already be false, but ensure it)
  rewardScreenOpen = false;
  
  // Promise-based approach: wait for callback to fire or timeout
  const maxWaitMs = 240000; // 4 minutes max
  const checkIntervalMs = 1000; // Check stop/skip every second
  
  const completionPromise = new Promise((resolve, reject) => {
    let intervalId;
    let checkCount = 0;
    
    // Register callback for immediate resolution when reward screen opens
    rewardScreenOpenedCallback = () => {
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
      
      // Check for force-stop - abort immediately
      if (analysisState.forceStop && analysisState.isStopping()) {
        console.log('[Manual Runner] Force stop detected during wait - aborting immediately');
        clearInterval(intervalId);
        rewardScreenOpenedCallback = null;
        reject('force_stopped');
        return;
      }
      
      if (!analysisState.isRunning()) {
        // Don't abort - let the current run finish (reward screen will still be captured)
        // The main loop will check this after the run completes
        // UNLESS force-stop was requested
        if (analysisState.forceStop) {
          console.log('[Manual Runner] Force stop requested - aborting wait immediately');
          clearInterval(intervalId);
          rewardScreenOpenedCallback = null;
          reject('force_stopped');
          return;
        }
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

      // Recovery: if no run is active and no reward UI, the first Start may have been ignored — nudge Start periodically
      if (checkCount >= 8 && (checkCount - 8) % 10 === 0) {
        if (!getOpenRewardsStateWithFallback() && !isBoardGameRunning()) {
          console.warn('[Manual Runner] No reward screen and no active game — clicking Start again (recovery)');
          clickStartButton();
        }
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
    await completionPromise;
  } catch (reason) {
    if (reason === 'invalid_id' || reason === 'stopped' || reason === 'force_stopped') {
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
        forceStopped: false,
        timedOut: true
      };
    }
  }
  
  // Process completion — get game state from gameTimer context (for victory check and grade/rank) - like Board Analyzer
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
  
  // Check pending serverResults first (captured by subscription)
  let serverResults = null;
  if (pendingServerResults.size > 0) {
    const lastSeed = Array.from(pendingServerResults.keys()).pop();
    serverResults = pendingServerResults.get(lastSeed);
  }
  
  // Also check current board context as fallback
  const boardContext = globalThis.state.board.getSnapshot().context;
  if (!serverResults && boardContext?.serverResults) {
    serverResults = boardContext.serverResults;
  }
  
  let completed = gameState === 'victory';
  
  if (serverResults?.rewardScreen) {
    const serverVictory = typeof serverResults.rewardScreen.victory === 'boolean' ? serverResults.rewardScreen.victory : false;
    
    // Use serverResults as authoritative for victory
    completed = serverVictory;
    
    // Use serverResults for tick info if available (especially important in manual mode)
    if (typeof serverResults.rewardScreen.gameTicks === 'number') {
      currentTick = serverResults.rewardScreen.gameTicks;
    }
    
    // Try to get rank points from serverResults.rank (not rankPoints) - like RunTracker
    if (typeof serverResults.rewardScreen.rank === 'number') {
      rankPoints = serverResults.rewardScreen.rank;
    }
    
    // Check if serverResults has grade field
    if (serverResults.rewardScreen.grade && 
        serverResults.rewardScreen.grade !== '' && 
        typeof serverResults.rewardScreen.grade === 'string') {
      readableGrade = serverResults.rewardScreen.grade;
    }
    // Only calculate grade if neither gameTimer nor serverResults provided a valid one
    else if (!readableGrade || readableGrade === '' || readableGrade === 'F') {
      // Get maxTeamSize for proper grade calculation (fallback only) - pass serverResults for roomId lookup
      const maxTeamSize = getMaxTeamSize(serverResults);
      readableGrade = calculateGradeFromRankPoints(rankPoints, maxTeamSize);
    }
  } else {
    // Only calculate grade if gameTimer didn't provide a valid one (use game's calculation as authoritative)
    if (!readableGrade || readableGrade === '' || readableGrade === 'F') {
      const maxTeamSize = getMaxTeamSize(null);
      readableGrade = calculateGradeFromRankPoints(rankPoints, maxTeamSize);
    }
  }
  
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
    boardSubscription = globalThis.state.board.subscribe(({ context }) => {
      enforceManualModeLock(context?.mode);
      enforceFloorLock(context?.floor);

      const serverResults = context.serverResults;
      if (!serverResults || !serverResults.rewardScreen || typeof serverResults.seed === 'undefined') {
        return; // No valid server results yet
      }
      
      // If server signals enableSkip, attempt to skip immediately (debounced)
      try {
        if (serverResults.enableSkip === true && !skipInProgress) {
          const skipBtn = findSkipButton();
          if (shouldProcessAutoSkip(skipBtn)) {
            skipInProgress = true;
            console.log('[Manual Runner] enableSkip=true received from server (subscription) — attempting to skip');
            handleSkipButton().finally(() => {
              setTimeout(() => { skipInProgress = false; }, 1200);
            });
          }
        }
      } catch (_) {}
      
      // Get the seed
      const seed = serverResults.seed;
      
      // Skip duplicate seeds (like Hunt Analyzer does)
      if (seed === lastProcessedSeed) {
        return; // Already processed this seed
      }
      
      lastProcessedSeed = seed;
      
      // One pending entry per run (avoids map growth); single clone at capture
      pendingServerResults.clear();
      pendingServerResults.set(seed, cloneServerResults(serverResults));
      
      console.log('[Manual Runner] ServerResults captured, seed:', seed, 'victory:', serverResults.rewardScreen.victory, 'ticks:', serverResults.rewardScreen.gameTicks);
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
    try {
      const openRewards = globalThis.state.board.select((ctx) => ctx.openRewards);
      
      openRewardsSubscription = openRewards.subscribe((isOpen) => {
        // Just track the state - don't auto-close here (we'll close it after detecting game completion)
        if (isOpen && !rewardScreenOpen) {
          // Reward screen just opened - this indicates a game completed
          rewardScreenOpen = true;
          
          // Trigger immediate check if callback is registered
          if (rewardScreenOpenedCallback) {
            rewardScreenOpenedCallback();
          }
        } else if (!isOpen && rewardScreenOpen) {
          // Reward screen just closed
          rewardScreenOpen = false;
          
          // Notify any waiting code
          if (rewardScreenClosedCallback) {
            rewardScreenClosedCallback();
            rewardScreenClosedCallback = null;
          }
        }
      });
    } catch (error) {
      console.warn('[Manual Runner] Error setting up openRewards subscription:', error);
    }
  }
}

// Function to close the reward screen (like btlucas fix.js)
function closeRewardScreen() {
  const scrollLocked = document.body?.getAttribute('data-scroll-locked');
  dispatchEsc();
  console.log('[Manual Runner] ESC → close reward screen' + (scrollLocked === '1' ? ' (modal)' : ''));
}

/** Skip button shows a stamina cost (e.g. Skip (stamina icon 2)). */
function isStaminaSkipButton(button) {
  if (!button) return false;
  try {
    return button.querySelector('img[alt="stamina"], img[src*="stamina"]') !== null;
  } catch (_) {
    return false;
  }
}

/** If skipButton is null, allow (handleSkipButton will resolve); if stamina skip and disabled in config, block. */
function shouldProcessAutoSkip(skipButton) {
  if (!skipButton) return true;
  if (isStaminaSkipButton(skipButton) && !config.enableStaminaSkip) {
    return false;
  }
  return true;
}

// Helper function to find skip button (from btlucas fix.js)
function findSkipButton() {
  try {
    // First, try the specific selector
    const specificSkipButton = document.querySelector("#__next > div.flex.min-h-screen.flex-col > div > main > div > div.flex.flex-col.justify-center.gap-2.\\32 xl\\:flex-row > div.grid.grid-cols-2.gap-2.gap-y-1\\.5.sm\\:grid-cols-\\[1fr_min-content\\].sm\\:grid-rows-\\[3fr\\].sm\\:gap-y-2.\\32 xl\\:grid-cols-\\[min-content\\] > div.sm\\:order-3 > button");
    if (specificSkipButton) {
      const buttonText = specificSkipButton.textContent.trim();
      if (buttonText.includes('Skip') || buttonText.includes('Pular')) {
        return specificSkipButton;
      }
    }
    
    // Fallback: Look for skip button by text content in all buttons
    const skipButtons = document.querySelectorAll('button');
    for (const button of skipButtons) {
      const buttonText = button.textContent.trim();
      if (buttonText.includes('Skip') || buttonText.includes('Pular')) {
        return button;
      }
    }
    
    // Additional fallback: Look for buttons with data attributes
    const skipButtonsByAttr = document.querySelectorAll('button[data-full="false"][data-state="closed"]');
    for (const button of skipButtonsByAttr) {
      const buttonText = button.textContent.trim();
      if (buttonText.includes('Skip') || buttonText.includes('Pular')) {
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
      if (!shouldProcessAutoSkip(skipButton)) {
        console.log('[Manual Runner] Skip not auto-clicked (stamina skip disabled in config):', skipButton.textContent.trim());
        return false;
      }
      console.log('[Manual Runner] Skip:', skipButton.textContent.trim());
      skipButton.click();
      await sleep(500); // Wait for skip to process

      // Let ensureRewardScreenHandled inject/sell on the loot screen when enabled
      const deferClose =
        config.enableAutoInjectSealedCreatures === true || config.enableAutoSellCreatures === true;
      if (!deferClose) {
        setTimeout(() => {
          closeRewardScreen();
        }, 1000);
      }

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
      if (btn && shouldProcessAutoSkip(btn)) {
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

// Read openRewards from board snapshot (avoids creating a new board.select() per poll)
function getBoardOpenRewardsSnapshot() {
  try {
    const ctx = globalThis.state?.board?.getSnapshot?.()?.context;
    if (ctx && typeof ctx.openRewards === 'boolean') {
      return ctx.openRewards;
    }
    if (ctx && ctx.openRewards != null) {
      return !!ctx.openRewards;
    }
  } catch (_) { /* board unavailable */ }
  return rewardScreenOpen;
}

function cloneServerResults(serverResults) {
  if (!serverResults) return null;
  try {
    return JSON.parse(JSON.stringify(serverResults));
  } catch (_) {
    return serverResults;
  }
}

// Function to wait for reward screen to close
async function waitForRewardScreenToClose(maxWaitMs = 2500) {
  let isCurrentlyOpen = rewardScreenOpen || getBoardOpenRewardsSnapshot();
  
  if (!isCurrentlyOpen) {
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
        callbackTriggered = true;
        resolve(true);
      }
    };
    
    // Polling fallback in case subscription doesn't fire
    let pollLogAt = 0;
    const checkInterval = setInterval(() => {
      try {
        const isOpen = rewardScreenOpen || getBoardOpenRewardsSnapshot();
        
        if (!isOpen) {
          console.log('[Manual Runner] Reward screen closed (polling)');
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
          console.warn(`[Manual Runner] Timeout waiting for reward screen to close (${Math.round(elapsed)}ms)`);
          clearInterval(checkInterval);
          if (!callbackTriggered) {
            callbackTriggered = true;
            resolve(false);
          }
          return;
        }
        
        // Log progress ~every 2s while waiting
        if (elapsed - pollLogAt >= 2000) {
          pollLogAt = elapsed;
          console.log(`[Manual Runner] Still waiting for reward screen to close… (${Math.floor(elapsed / 1000)}s)`);
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

  // ModCoordination replaces `metadata` with a new object on each updateModState call.
  // Must re-read getModState each time; a captured metadata reference becomes stale.
  const getAutomatorMetadata = () => {
    const automatorState = window.ModCoordination?.getModState('Bestiary Automator');
    return automatorState?.metadata || {};
  };

  const getActiveOperations = () => {
    const m = getAutomatorMetadata();
    const ops = [];
    if (m.refilling) ops.push('refilling stamina');
    if (m.collectingRewards) ops.push('collecting rewards');
    if (m.handlingDaycare) ops.push('handling daycare');
    if (m.collectingSeashell) ops.push('collecting seashell');
    return ops;
  };

  const initialMeta = getAutomatorMetadata();
  const initialOps = getActiveOperations();
  const contextSuffix = context ? ` [${context}]` : '';

  let activeOperations = initialOps;

  if (activeOperations.length > 0) {
    console.log(`[Manual Runner] Coordination: waiting for Automator (${activeOperations.join(', ')})${contextSuffix}`, {
      automatorRefilling: !!initialMeta.refilling,
      automatorCollectingRewards: !!initialMeta.collectingRewards,
      automatorHandlingDaycare: !!initialMeta.handlingDaycare,
      automatorCollectingSeashell: !!initialMeta.collectingSeashell
    });
  }

  while (activeOperations.length > 0) {
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
    console.log(`[Manual Runner] Automator idle after ${elapsed}ms${contextSuffix}`);
  }
}

function prepareAttemptState(nextAttemptNumber) {
  rewardScreenOpen = false;
  // Reset persistent tracking variables for new attempt
  persistentLastTick = 0;
  persistentLastGrade = 'F';
  persistentLastRankPoints = 0;
}

/** True when the board reports an active run (same signal as Better Tasker). */
function isBoardGameRunning() {
  try {
    return !!globalThis.state.board.getSnapshot().context.gameStarted;
  } catch (e) {
    return false;
  }
}

/**
 * After clicking Start, confirm the run actually began. Retries the click if the board never
 * enters gameStarted (ignored click, overlay, wrong button match, etc.).
 * @returns {'started'|'aborted'|'failed'}
 */
async function waitForGameStartAfterClick(analysisId) {
  const maxWaitPerTryMs = 5000;
  const maxRetries = 4;
  const pollMs = 120;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const deadline = performance.now() + maxWaitPerTryMs;
    while (performance.now() < deadline) {
      if (shouldAbortAnalysisLoop(analysisId)) {
        return 'aborted';
      }
      if (getOpenRewardsStateWithFallback()) {
        console.log('[Manual Runner] Reward screen opened while waiting for game start');
        return 'started';
      }
      if (isBoardGameRunning()) {
        if (attempt > 1) {
          console.log(`[Manual Runner] Game started after ${attempt} attempt(s) to click Start`);
        }
        return 'started';
      }
      await sleep(pollMs);
    }
    console.warn(`[Manual Runner] No active game after ${maxWaitPerTryMs}ms (start click ${attempt}/${maxRetries}) — clicking Start again`);
    clickStartButton();
    await sleep(200);
  }
  console.error('[Manual Runner] Failed to start a run: board never entered gameStarted');
  return 'failed';
}

/**
 * Wait until board reports no active run (gameStarted false).
 * Same 10s window as clickStartButtonRobust; ESC + Automator coordination while waiting.
 * @returns {Promise<boolean>} true when idle, false if still running after timeout
 */
async function ensureGameStopped(options = {}) {
  const maxWaitMs = Math.max(200, Number(options.maxWaitMs) || BOARD_IDLE_MAX_WAIT_MS);
  const recheckDelayMs = Math.max(40, Number(options.recheckDelayMs) || BOARD_IDLE_RECHECK_DELAY_MS);
  const contextSuffix = options.context ? ` [${options.context}]` : '';
  const startTs = performance.now();
  const deadline = startTs + maxWaitMs;
  let checks = 0;
  let lastEscNudgeAt = 0;

  while (performance.now() < deadline) {
    checks++;
    if (!isBoardGameRunning()) {
      const elapsed = Math.round(performance.now() - startTs);
      if (elapsed > 50 || checks > 1) {
        console.log(`[Manual Runner] Game stopped after ${elapsed}ms (${checks} checks)${contextSuffix}`);
      }
      return true;
    }

    const elapsed = performance.now() - startTs;
    if (elapsed - lastEscNudgeAt >= 1000) {
      dispatchEsc();
      lastEscNudgeAt = elapsed;
    }

    const remaining = deadline - performance.now();
    if (remaining <= 0) {
      break;
    }

    await waitForModCoordinationTasks({
      maxWaitMs: Math.min(350, Math.max(120, remaining)),
      delayMs: 120,
      context: options.context ? `board-idle ${options.context}` : 'board-idle wait'
    });

    if (performance.now() >= deadline) {
      break;
    }
    await sleep(Math.min(recheckDelayMs, Math.max(40, deadline - performance.now())));
  }

  const elapsed = Math.round(performance.now() - startTs);
  console.warn(
    `[Manual Runner] gameStarted still true after ${elapsed}ms (${checks} checks)${contextSuffix}`
  );
  return false;
}

// =======================
// Auto-inject sealed creatures (manual mode — standalone, not Autoseller)
// =======================

const INJECT_API_RETRY_ATTEMPTS = 2;
const INJECT_DELAY_BETWEEN_MS = 400;

/** Same event names/detail shape as Autoseller — consumed by Awaken Tracker. */
function emitInjectTrackerEvent(type, detail) {
  try {
    window.dispatchEvent(new CustomEvent(`autoseller:inject:${type}`, { detail }));
  } catch (_) {}
}

function emitInjectSkip(gameId, reason, candidateStats) {
  emitInjectTrackerEvent('skip', {
    reason,
    gameId: Number(gameId),
    candidate: { stats: candidateStats || {} }
  });
}

function peekServerResultsForCurrentReward() {
  if (pendingServerResults.size > 0) {
    const lastSeed = Array.from(pendingServerResults.keys()).pop();
    return pendingServerResults.get(lastSeed) || null;
  }
  try {
    const contextServerResults = globalThis.state?.board?.getSnapshot?.()?.context?.serverResults;
    if (contextServerResults?.rewardScreen && typeof contextServerResults.seed !== 'undefined') {
      return contextServerResults;
    }
  } catch (_) {}
  return null;
}

function isSealedTierFiveCreature(monster) {
  if (!monster) return false;
  const tier = monster.tier ?? monster.metadata?.tier;
  return Number(tier) === 5;
}

function isAwakenedCreature(monster) {
  if (!monster) return false;
  const tier = Number(monster.tier ?? monster.metadata?.tier);
  if (tier === 6) return true;
  return monster.awaken === true || monster.awakened === true || monster.isAwakened === true;
}

function isShinyCreature(monster) {
  if (!monster) return false;
  return monster.shiny === true || monster.isShiny === true;
}

function getMonsterGeneStats(monster) {
  if (!monster || typeof monster !== 'object') {
    return { hp: 0, ad: 0, ap: 0, armor: 0, magicResist: 0 };
  }
  const genes = monster.genes || monster.stats || {};
  return {
    hp: Number(monster.hp ?? genes.hp ?? 0),
    ad: Number(monster.ad ?? genes.ad ?? 0),
    ap: Number(monster.ap ?? genes.ap ?? 0),
    armor: Number(monster.armor ?? genes.armor ?? 0),
    magicResist: Number(monster.magicResist ?? monster.mr ?? genes.magicResist ?? genes.mr ?? 0)
  };
}

function hasAnyHigherGeneStat(candidate, target) {
  if (!candidate || !target) return false;
  const c = getMonsterGeneStats(candidate);
  const t = getMonsterGeneStats(target);
  return c.hp > t.hp || c.ad > t.ad || c.ap > t.ap || c.armor > t.armor || c.magicResist > t.magicResist;
}

function getCreatureNameFromGameId(gameId) {
  if (gameId === undefined || gameId === null || gameId === '') return '';
  try {
    const fromDb = globalThis.creatureDatabase?.findMonsterByGameId?.(gameId);
    if (fromDb?.metadata?.name) return fromDb.metadata.name;
  } catch (_) { /* ignore */ }
  try {
    const fromState = globalThis.state?.utils?.getMonster?.(gameId);
    if (fromState?.metadata?.name) return fromState.metadata.name;
  } catch (_) { /* ignore */ }
  return '';
}

function getCreatureNameFromMonster(monster) {
  if (!monster) return '';
  const name = monster.metadata?.name || monster.name;
  if (name) return name;
  const gameId = monster.gameId ?? monster.metadata?.id;
  const resolved = getCreatureNameFromGameId(gameId);
  if (resolved) return resolved;
  return gameId ? `gameId:${gameId}` : '';
}

function isGameCurrentlyRunning() {
  const gameState = globalThis.state?.gameTimer?.getSnapshot?.()?.context?.state;
  return gameState === 'playing';
}

function isMonsterCurrentlyOnBoard(monsterId) {
  if (!monsterId) return false;
  const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
  if (!boardContext) return false;
  const pieceArrays = [boardContext.boardConfig, boardContext.board, boardContext.pieces];
  for (const pieceArray of pieceArrays) {
    if (!Array.isArray(pieceArray)) continue;
    const found = pieceArray.some(piece => {
      if (!piece || piece.type !== 'player') return false;
      const pieceMonsterId = piece.databaseId ?? piece.monsterId ?? piece.id;
      return String(pieceMonsterId) === String(monsterId);
    });
    if (found) return true;
  }
  return false;
}

/**
 * Extract creature drops from manual-mode serverResults (paths differ from autoplay).
 * @returns {{ battleRewardMonsters: Array, rewardMonsterIds: Set<string|number> }}
 */
function extractManualRunnerRewardMonsters(serverResults) {
  let battleRewardMonsters = [];
  const rewardMonsterIds = new Set();
  const pathsUsed = [];

  if (!serverResults) {
    return { battleRewardMonsters, rewardMonsterIds };
  }

  const rs = serverResults.rewardScreen;
  if (rs?.monsterDrop) {
    const drop = rs.monsterDrop;
    battleRewardMonsters = Array.isArray(drop) ? drop : [drop];
    pathsUsed.push('rewardScreen.monsterDrop');
  }
  if (battleRewardMonsters.length === 0 && rs?.loot) {
    const loot = rs.loot;
    const lootItems = Array.isArray(loot) ? loot : [loot];
    battleRewardMonsters = lootItems.filter(item => item && (item.type === 'monster' || item.monster || item.id));
    if (battleRewardMonsters.length > 0) pathsUsed.push('rewardScreen.loot');
  }
  if (battleRewardMonsters.length === 0 && rs?.monsters) {
    battleRewardMonsters = Array.isArray(rs.monsters) ? rs.monsters : [rs.monsters];
    pathsUsed.push('rewardScreen.monsters');
  }
  if (battleRewardMonsters.length === 0 && serverResults.monsters) {
    battleRewardMonsters = Array.isArray(serverResults.monsters) ? serverResults.monsters : [serverResults.monsters];
    pathsUsed.push('serverResults.monsters');
  }
  if (battleRewardMonsters.length === 0 && serverResults.rewards?.monsters) {
    const m = serverResults.rewards.monsters;
    battleRewardMonsters = Array.isArray(m) ? m : [m];
    pathsUsed.push('serverResults.rewards.monsters');
  }
  if (battleRewardMonsters.length === 0 && serverResults.next?.monsterDrop) {
    const drop = serverResults.next.monsterDrop;
    battleRewardMonsters = Array.isArray(drop) ? drop : [drop];
    pathsUsed.push('next.monsterDrop');
  }

  if (battleRewardMonsters.length > 0) {
    console.log(
      `[Manual Runner][Inject] extract: paths=${pathsUsed.join(', ')} ` +
      `drops=${battleRewardMonsters.length} seed=${serverResults.seed ?? 'unknown'}`
    );
  }

  for (const entry of battleRewardMonsters) {
    if (!entry || typeof entry !== 'object') continue;
    const monster = entry.monster || entry;
    const serverId = monster.id || monster.databaseId || entry.monsterId;
    if (serverId) rewardMonsterIds.add(serverId);
  }

  return { battleRewardMonsters, rewardMonsterIds };
}

function serverResultsHasCreatureDrop(serverResults) {
  if (!serverResults) return false;
  const rs = serverResults.rewardScreen;
  if (rs?.monsterDrop) return true;
  if (rs?.monsters) return true;
  if (serverResults.monsters) return true;
  if (serverResults.rewards?.monsters) return true;
  if (serverResults.next?.monsterDrop) return true;
  if (rs?.loot) {
    const lootItems = Array.isArray(rs.loot) ? rs.loot : [rs.loot];
    return lootItems.some(item => item && (item.type === 'monster' || item.monster || item.id));
  }
  return false;
}

async function waitForServerResultsForReward(maxWaitMs = 3000) {
  const start = performance.now();
  while (performance.now() - start < maxWaitMs) {
    const serverResults = peekServerResultsForCurrentReward();
    if (serverResults) return serverResults;
    await sleep(50);
  }
  return peekServerResultsForCurrentReward();
}

async function waitForRewardScreenReady(maxWaitMs = 8000) {
  if (getOpenRewardsStateWithFallback()) return true;
  const start = performance.now();
  while (performance.now() - start < maxWaitMs) {
    await sleep(100);
    if (getOpenRewardsStateWithFallback()) return true;
  }
  return getOpenRewardsStateWithFallback();
}

function filterMonstersByServerIds(inventorySnapshot, rewardMonsterIds) {
  if (!rewardMonsterIds?.size) return [];
  return inventorySnapshot.filter(inv => rewardMonsterIds.has(inv.id));
}

function logManualRunnerDropsForFloor11Plus(battleRewardMonsters, floor) {
  const floorNum = Number(floor);
  if (!Number.isFinite(floorNum) || floorNum < 11 || !battleRewardMonsters.length) return;
  battleRewardMonsters.forEach((drop, index) => {
    const monster = drop?.monster || drop || {};
    const stats = getMonsterGeneStats(monster);
    const genes = stats.hp + stats.ad + stats.ap + stats.armor + stats.magicResist;
    const tier = monster.tier ?? monster.metadata?.tier ?? 'unknown';
    const serverId = monster.id || monster.databaseId || drop?.monsterId || 'unknown';
    const gameId = monster.gameId ?? monster.metadata?.id ?? 'unknown';
    const name = getCreatureNameFromMonster(monster) || `gameId:${gameId}`;
    console.log(
      `[Manual Runner][Inject][DropDebug] Floor ${floorNum} drop #${index + 1}: ` +
      `name=${name} id=${serverId} gameId=${gameId} tier=${tier} genes=${genes} ` +
      `(hp=${stats.hp} ad=${stats.ad} ap=${stats.ap} armor=${stats.armor} mr=${stats.magicResist})`
    );
  });
}

async function manualRunnerApiRequest(url, options = {}, retries = INJECT_API_RETRY_ATTEMPTS) {
  const { method = 'GET', body, headers = {} } = options;
  const baseHeaders = { 'content-type': 'application/json', 'X-Game-Version': '1' };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, {
        method,
        credentials: 'include',
        headers: { ...baseHeaders, ...headers },
        ...(body && { body: JSON.stringify(body) })
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        if (resp.status >= 500 && attempt < retries) {
          await sleep(300 * (attempt + 1));
          continue;
        }
        return { success: false, status: resp.status, data };
      }
      return { success: true, status: resp.status, data };
    } catch (error) {
      if (attempt === retries) return { success: false, error, data: null };
      await sleep(300 * (attempt + 1));
    }
  }
  return { success: false, data: null };
}

async function fetchManualRunnerInventory() {
  const localMonsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters;
  if (Array.isArray(localMonsters) && localMonsters.length > 0) {
    return localMonsters;
  }

  const myName = globalThis.state?.player?.getSnapshot?.()?.context?.name;
  if (!myName) {
    return [];
  }
  const url = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=${encodeURIComponent(JSON.stringify({ '0': { json: myName } }))}`;
  const result = await manualRunnerApiRequest(url);
  if (!result.success) {
    console.warn(`[Manual Runner][Inject] fetch inventory failed: HTTP ${result.status ?? 'unknown'}`);
    return Array.isArray(localMonsters) ? localMonsters : [];
  }
  return result.data?.[0]?.result?.data?.json?.monsters || [];
}

function syncInjectedAwakenedStatsLocally(awakenedMonsterId, targetBeforeStats, candidateStats) {
  try {
    const player = globalThis.state?.player;
    if (!player || typeof player.send !== 'function') return false;
    const expectedAfter = {
      hp: Math.max(targetBeforeStats.hp, candidateStats.hp),
      ad: Math.max(targetBeforeStats.ad, candidateStats.ad),
      ap: Math.max(targetBeforeStats.ap, candidateStats.ap),
      armor: Math.max(targetBeforeStats.armor, candidateStats.armor),
      magicResist: Math.max(targetBeforeStats.magicResist, candidateStats.magicResist)
    };
    player.send({
      type: 'setState',
      fn: (prev) => {
        if (!prev || !Array.isArray(prev.monsters)) return prev;
        let changed = false;
        const nextMonsters = prev.monsters.map(monster => {
          if (String(monster?.id) !== String(awakenedMonsterId)) return monster;
          changed = true;
          const next = { ...monster };
          next.hp = Math.max(Number(monster?.hp) || 0, expectedAfter.hp);
          next.ad = Math.max(Number(monster?.ad) || 0, expectedAfter.ad);
          next.ap = Math.max(Number(monster?.ap) || 0, expectedAfter.ap);
          next.armor = Math.max(Number(monster?.armor) || 0, expectedAfter.armor);
          next.magicResist = Math.max(Number(monster?.magicResist) || 0, expectedAfter.magicResist);
          if (next.genes && typeof next.genes === 'object') {
            next.genes = {
              ...next.genes,
              hp: Math.max(Number(next.genes.hp) || 0, expectedAfter.hp),
              ad: Math.max(Number(next.genes.ad) || 0, expectedAfter.ad),
              ap: Math.max(Number(next.genes.ap) || 0, expectedAfter.ap),
              armor: Math.max(Number(next.genes.armor) || 0, expectedAfter.armor),
              magicResist: Math.max(Number(next.genes.magicResist) || 0, expectedAfter.magicResist)
            };
          }
          return next;
        });
        return changed ? { ...prev, monsters: nextMonsters } : prev;
      }
    });
    return true;
  } catch (error) {
    console.warn('[Manual Runner][Inject] syncInjectedAwakenedStatsLocally failed:', error);
    return false;
  }
}

function removeMonsterFromLocalInventory(monsterId) {
  try {
    const player = globalThis.state?.player;
    if (!player?.send) return false;
    player.send({
      type: 'setState',
      fn: (prev) => {
        if (!prev || !Array.isArray(prev.monsters)) return prev;
        return {
          ...prev,
          monsters: prev.monsters.filter(m => String(m?.id) !== String(monsterId))
        };
      }
    });
    return true;
  } catch (error) {
    console.warn('[Manual Runner][Inject] removeMonsterFromLocalInventory failed:', error);
    return false;
  }
}

function showManualRunnerInjectToast(message, durationMs = 5000) {
  try {
    let mainContainer = document.getElementById('manual-runner-inject-toast-container');
    if (!mainContainer) {
      mainContainer = document.createElement('div');
      mainContainer.id = 'manual-runner-inject-toast-container';
      mainContainer.style.cssText = 'position: fixed; z-index: 9999; inset: 16px 16px 64px; pointer-events: none;';
      document.body.appendChild(mainContainer);
    }

    const existingToasts = mainContainer.querySelectorAll('.manual-runner-inject-toast-item');
    const stackOffset = existingToasts.length * 44;

    const flexContainer = document.createElement('div');
    flexContainer.className = 'manual-runner-inject-toast-item';
    flexContainer.style.cssText = `left:0;right:0;display:flex;position:absolute;transition:230ms cubic-bezier(0.21, 1.02, 0.73, 1);transform:translateY(-${stackOffset}px);bottom:0;justify-content:flex-end;`;

    const toast = document.createElement('button');
    toast.type = 'button';
    toast.style.pointerEvents = 'auto';
    toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';

    const widgetTop = document.createElement('div');
    widgetTop.className = 'widget-top h-2.5';
    const widgetBottom = document.createElement('div');
    widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';
    const textLeft = document.createElement('div');
    textLeft.className = 'text-left';
    const paragraph = document.createElement('p');
    paragraph.style.cssText = 'margin: 0; max-width: 28rem; white-space: pre-wrap;';
    if (typeof message === 'string') {
      paragraph.textContent = message;
    } else if (message instanceof Node) {
      paragraph.style.whiteSpace = 'normal';
      paragraph.appendChild(message);
    } else {
      paragraph.textContent = String(message ?? '');
    }

    textLeft.appendChild(paragraph);
    widgetBottom.appendChild(textLeft);
    toast.appendChild(widgetTop);
    toast.appendChild(widgetBottom);
    flexContainer.appendChild(toast);
    mainContainer.appendChild(flexContainer);

    const remove = () => {
      if (flexContainer?.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        const toasts = mainContainer.querySelectorAll('.manual-runner-inject-toast-item');
        toasts.forEach((el, index) => {
          el.style.transform = `translateY(-${index * 44}px)`;
        });
      }
    };
    toast.addEventListener('click', remove);
    setTimeout(remove, Math.max(1000, durationMs));
  } catch (error) {
    console.warn('[Manual Runner][Inject] Failed to show toast:', error);
  }
}

async function pollTargetStatsAfterInject(awakenedTargetId, targetBeforeStats, awakenedTarget) {
  let targetAfterStats = targetBeforeStats;
  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(120);
    const refreshedTarget = (globalThis.state?.player?.getSnapshot?.()?.context?.monsters || [])
      .find(m => String(m?.id) === String(awakenedTargetId));
    targetAfterStats = getMonsterGeneStats(refreshedTarget || awakenedTarget);
    const hasAnyDelta =
      targetAfterStats.hp !== targetBeforeStats.hp ||
      targetAfterStats.ad !== targetBeforeStats.ad ||
      targetAfterStats.ap !== targetBeforeStats.ap ||
      targetAfterStats.armor !== targetBeforeStats.armor ||
      targetAfterStats.magicResist !== targetBeforeStats.magicResist;
    if (hasAnyDelta) break;
  }
  return targetAfterStats;
}

function showInjectSuccessToast({
  gameId,
  creatureName,
  goldDiff,
  candidateStats,
  targetBeforeStats,
  targetAfterStats,
  awakenedTargetName,
  awakenedTargetId
}) {
  const statLabelMap = { hp: 'HP', ad: 'AD', ap: 'AP', armor: 'ARM', magicResist: 'MR' };
  const statIconMap = {
    hp: 'https://bestiaryarena.com/assets/icons/heal.png',
    ad: 'https://bestiaryarena.com/assets/icons/attackdamage.png',
    ap: 'https://bestiaryarena.com/assets/icons/abilitypower.png',
    armor: 'https://bestiaryarena.com/assets/icons/armor.png',
    magicResist: 'https://bestiaryarena.com/assets/icons/magicresist.png'
  };
  const statKeys = ['hp', 'ad', 'ap', 'armor', 'magicResist'];

  const gains = statKeys
    .map(key => ({ key, diff: targetAfterStats[key] - targetBeforeStats[key] }))
    .filter(item => item.diff > 0);
  const inferredGains = statKeys
    .map(key => ({ key, diff: Math.max(0, candidateStats[key] - targetBeforeStats[key]) }))
    .filter(item => item.diff > 0);
  const gainsForToast = gains.length > 0 ? gains : inferredGains;
  const inferredGainsTextList = inferredGains.map(item => `+${item.diff} ${statLabelMap[item.key]}`);

  const gainsObject = { hp: 0, ad: 0, ap: 0, armor: 0, magicResist: 0 };
  (gains.length > 0 ? gains : inferredGains).forEach(g => { gainsObject[g.key] = g.diff; });

  console.log(
    `[Manual Runner][Inject][Applied] ${awakenedTargetName} (${awakenedTargetId}): ` +
    `${inferredGainsTextList.length > 0 ? inferredGainsTextList.join(', ') : 'no gain'}`
  );

  emitInjectTrackerEvent('applied', {
    gameId: Number(gameId),
    gains: gainsObject,
    candidate: candidateStats,
    before: targetBeforeStats,
    after: targetAfterStats
  });

  const beforeTotalGenes =
    targetBeforeStats.hp + targetBeforeStats.ad + targetBeforeStats.ap + targetBeforeStats.armor + targetBeforeStats.magicResist;
  const afterTotalGenes =
    targetAfterStats.hp + targetAfterStats.ad + targetAfterStats.ap + targetAfterStats.armor + targetAfterStats.magicResist;

  const toastContent = document.createElement('span');
  toastContent.style.display = 'inline-flex';
  toastContent.style.alignItems = 'center';
  toastContent.style.flexWrap = 'wrap';
  toastContent.style.gap = '4px';

  const displayName =
    (creatureName && !/^gameId:\d+$/i.test(creatureName) ? creatureName : '') ||
    getCreatureNameFromGameId(gameId) ||
    (awakenedTargetName && !/^gameId:\d+$/i.test(awakenedTargetName) ? awakenedTargetName : '') ||
    'creature';
  const introText = document.createElement('span');
  introText.textContent = `Injected ${displayName}`;
  toastContent.appendChild(introText);

  const numericGoldDiff = Number(goldDiff);
  const hasGoldDiff = Number.isFinite(numericGoldDiff) && numericGoldDiff !== 0;
  const hasTotalGenesTransition = Number.isFinite(beforeTotalGenes) && Number.isFinite(afterTotalGenes);
  if (hasGoldDiff || gainsForToast.length > 0 || hasTotalGenesTransition) {
    const spacer = document.createElement('span');
    spacer.textContent = ' ';
    toastContent.appendChild(spacer);

    let badgeIndex = 0;
    const totalBadges = gainsForToast.length + (hasGoldDiff ? 1 : 0) + (hasTotalGenesTransition ? 1 : 0);

    if (hasGoldDiff) {
      const goldBadge = document.createElement('span');
      goldBadge.style.display = 'inline-flex';
      goldBadge.style.alignItems = 'center';
      goldBadge.style.gap = '3px';
      const goldValue = document.createElement('span');
      goldValue.textContent = numericGoldDiff > 0 ? `+${numericGoldDiff}` : `${numericGoldDiff}`;
      goldBadge.appendChild(goldValue);
      const goldIcon = document.createElement('img');
      goldIcon.src = 'https://bestiaryarena.com/assets/icons/goldpile.png';
      goldIcon.alt = 'Gold';
      goldIcon.style.width = '12px';
      goldIcon.style.height = '12px';
      goldIcon.style.verticalAlign = 'middle';
      goldBadge.appendChild(goldIcon);
      toastContent.appendChild(goldBadge);
      badgeIndex += 1;
      if (badgeIndex < totalBadges) {
        const comma = document.createElement('span');
        comma.textContent = ',';
        toastContent.appendChild(comma);
      }
    }

    gainsForToast.forEach((gain) => {
      const gainBadge = document.createElement('span');
      gainBadge.style.display = 'inline-flex';
      gainBadge.style.alignItems = 'center';
      gainBadge.style.gap = '3px';
      const gainValue = document.createElement('span');
      gainValue.textContent = `+${gain.diff}`;
      gainBadge.appendChild(gainValue);
      const statIcon = document.createElement('img');
      statIcon.src = statIconMap[gain.key];
      statIcon.alt = statLabelMap[gain.key];
      statIcon.style.width = '12px';
      statIcon.style.height = '12px';
      statIcon.style.verticalAlign = 'middle';
      gainBadge.appendChild(statIcon);
      toastContent.appendChild(gainBadge);
      badgeIndex += 1;
      if (badgeIndex < totalBadges) {
        const comma = document.createElement('span');
        comma.textContent = ',';
        toastContent.appendChild(comma);
      }
    });

    if (hasTotalGenesTransition) {
      const totalGenesBadge = document.createElement('span');
      totalGenesBadge.textContent = `${beforeTotalGenes}% -> ${afterTotalGenes}%`;
      toastContent.appendChild(totalGenesBadge);
    }
  }

  showManualRunnerInjectToast(toastContent, 5000);
}

/**
 * Inject sealed tier-5 drops into matching awakened creatures (manual-mode reward flow).
 * @param {Object} serverResults
 * @returns {Promise<Set<string|number>>} Consumed sealed monster server IDs
 */
async function manualRunnerAutoInjectSealedCreatures(serverResults) {
  const consumedServerIds = new Set();
  if (!config.enableAutoInjectSealedCreatures) {
    return consumedServerIds;
  }

  const seed = serverResults?.seed;
  if (seed !== undefined && seed !== null && seed === lastInjectProcessedSeed) {
    return consumedServerIds;
  }

  const { battleRewardMonsters, rewardMonsterIds } = extractManualRunnerRewardMonsters(serverResults);
  const floor =
    serverResults?.floor ??
    serverResults?.rewardScreen?.floor ??
    globalThis.state?.board?.getSnapshot?.()?.context?.floor;
  logManualRunnerDropsForFloor11Plus(battleRewardMonsters, floor);

  if (rewardMonsterIds.size === 0) {
    if (seed !== undefined && seed !== null) lastInjectProcessedSeed = seed;
    return consumedServerIds;
  }

  await sleep(200);
  const inventorySnapshot = await fetchManualRunnerInventory();
  const matchedMonsters = filterMonstersByServerIds(inventorySnapshot, rewardMonsterIds);
  const sealedCandidates = matchedMonsters.filter(m => isSealedTierFiveCreature(m) && !isShinyCreature(m));

  if (sealedCandidates.length > 0) {
    console.log(
      `[Manual Runner][Inject] matched=${matchedMonsters.length} sealedCandidates=${sealedCandidates.length}`
    );
  }

  if (sealedCandidates.length === 0) {
    if (seed !== undefined && seed !== null) lastInjectProcessedSeed = seed;
    return consumedServerIds;
  }

  const localMonsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters || inventorySnapshot || [];
  const awakenedCandidates = localMonsters.filter(m => m?.id && isAwakenedCreature(m) && !isSealedTierFiveCreature(m));
  if (awakenedCandidates.length === 0) {
    console.log('[Manual Runner][Inject] Skip: no awakened targets in inventory');
    if (seed !== undefined && seed !== null) lastInjectProcessedSeed = seed;
    return consumedServerIds;
  }

  for (const monster of sealedCandidates) {
    if (!monster?.id) continue;
    const creatureName = getCreatureNameFromMonster(monster);

    const sealedGameId = Number(monster?.gameId ?? monster?.metadata?.id);
    const matchingAwakened = awakenedCandidates.filter(candidate => {
      const candidateGameId = Number(candidate?.gameId ?? candidate?.metadata?.id);
      return Number.isFinite(candidateGameId) && Number.isFinite(sealedGameId) && candidateGameId === sealedGameId;
    });
    const awakenedTarget = matchingAwakened[0];
    const awakenedTargetName = getCreatureNameFromMonster(awakenedTarget) || 'unknown';

    if (!awakenedTarget?.id) {
      const c = getMonsterGeneStats(monster);
      console.log(`[Manual Runner][Inject][Skip] ${creatureName || monster.id}: no awakened target (gameId=${sealedGameId})`);
      emitInjectSkip(sealedGameId, 'no-target', c);
      continue;
    }
    if (String(monster.id) === String(awakenedTarget.id)) {
      console.log(`[Manual Runner][Inject][Skip] ${creatureName || monster.id}: same as target`);
      emitInjectSkip(sealedGameId, 'same-id', getMonsterGeneStats(monster));
      continue;
    }
    if (!hasAnyHigherGeneStat(monster, awakenedTarget)) {
      const c = getMonsterGeneStats(monster);
      const t = getMonsterGeneStats(awakenedTarget);
      console.log(
        `[Manual Runner][Inject][Skip] ${creatureName || monster.id}: no higher gene than ${awakenedTargetName} ` +
        `(candidate hp=${c.hp} ad=${c.ad} ap=${c.ap} armor=${c.armor} mr=${c.magicResist} | ` +
        `target hp=${t.hp} ad=${t.ad} ap=${t.ap} armor=${t.armor} mr=${t.magicResist})`
      );
      emitInjectSkip(sealedGameId, 'no-higher-gene', c);
      continue;
    }
    if (isGameCurrentlyRunning() && isMonsterCurrentlyOnBoard(awakenedTarget.id)) {
      console.log(`[Manual Runner][Inject][Skip] ${creatureName || monster.id}: target ${awakenedTargetName} on board during battle`);
      emitInjectSkip(sealedGameId, 'on-board', getMonsterGeneStats(monster));
      continue;
    }

    console.log(
      `[Manual Runner][Inject] Injecting ${creatureName || monster.id} (${monster.id}) ` +
      `-> ${awakenedTargetName} (${awakenedTarget.id}) gameId=${sealedGameId}`
    );

    const result = await manualRunnerApiRequest('https://bestiaryarena.com/api/trpc/inventory.useDoctor?batch=1', {
      method: 'POST',
      body: { '0': { json: { awakenMonsterId: awakenedTarget.id, consumingMonsterId: monster.id } } }
    });

    const goldDiff = result?.data?.[0]?.result?.data?.json?.goldDiff;
    if (result.success && goldDiff !== undefined && goldDiff !== null) {
      const candidateStats = getMonsterGeneStats(monster);
      const targetBeforeStats = getMonsterGeneStats(awakenedTarget);
      console.log(
        `[Manual Runner][Inject][Success] ${creatureName || monster.id} -> ${awakenedTargetName}, goldDiff=${goldDiff}`
      );
      syncInjectedAwakenedStatsLocally(awakenedTarget.id, targetBeforeStats, candidateStats);
      const targetAfterStats = await pollTargetStatsAfterInject(awakenedTarget.id, targetBeforeStats, awakenedTarget);
      showInjectSuccessToast({
        gameId: sealedGameId,
        creatureName,
        goldDiff,
        candidateStats,
        targetBeforeStats,
        targetAfterStats,
        awakenedTargetName,
        awakenedTargetId: awakenedTarget.id
      });
      removeMonsterFromLocalInventory(monster.id);
      consumedServerIds.add(monster.id);
    } else if (!result.success && result.status === 429) {
      console.log(`[Manual Runner][Inject][Retry] ${creatureName || monster.id}: rate limited (429)`);
      await sleep(800);
    } else if (!result.success && result.status === 400) {
      console.warn(
        `[Manual Runner][Inject] useDoctor HTTP 400 for ${monster.id} ` +
        `(awaken=${awakenedTarget.id}, consume=${monster.id})`,
        result?.data
      );
    } else if (!result.success) {
      console.warn(`[Manual Runner][Inject] useDoctor failed for ${monster.id}: HTTP ${result.status ?? 'unknown'}`);
    }

    await sleep(INJECT_DELAY_BETWEEN_MS);
  }

  if (seed !== undefined && seed !== null) lastInjectProcessedSeed = seed;
  if (consumedServerIds.size > 0) {
    console.log(`[Manual Runner][Inject] Done: consumed=${consumedServerIds.size}`);
  }
  return consumedServerIds;
}

// Function to auto-sell creatures from reward screen (requires loot UI to stay open)
async function autoSellCreatures() {
  if (!getOpenRewardsStateWithFallback()) {
    console.warn('[Manual Runner] Autosell skipped: reward screen is not open');
    return false;
  }

  const sellButtonTexts = ['Sell', 'Vender', 'Squeeze', 'Espremer'];
  let sellButton = null;

  for (let attempt = 0; attempt < 20; attempt++) {
    if (!getOpenRewardsStateWithFallback()) {
      console.warn('[Manual Runner] Autosell aborted: reward screen closed while waiting for Sell button');
      return false;
    }

    const allButtons = document.querySelectorAll('button');
    for (const button of allButtons) {
      const buttonText = button.textContent.trim();
      const hasSellImg = button.querySelector('img[alt="Bag with gold"]');
      if (sellButtonTexts.includes(buttonText) || hasSellImg) {
        sellButton = button;
        break;
      }
    }

    if (sellButton) break;
    await sleep(200);
  }

  if (!sellButton) {
    console.warn('[Manual Runner] Could not find Sell/Squeeze button (reward screen may have closed too early)');
    return false;
  }
  
  try {
    const soldLabel = sellButton.textContent.trim() || 'sell';
    sellButton.click();
    await sleep(500); // Wait for sell action to complete
    
    dispatchEsc();
    await sleep(200);
    
    console.log('[Manual Runner] Auto-sell:', soldLabel);
    return true;
  } catch (error) {
    console.error('[Manual Runner] Error during auto-sell:', error);
    return false;
  }
}

async function ensureRewardScreenHandled() {
  const wantsInject = config.enableAutoInjectSealedCreatures === true;
  const wantsSell = config.enableAutoSellCreatures === true;
  if (!wantsInject && !wantsSell) {
    if (!getOpenRewardsStateWithFallback()) return;
    closeRewardScreen();
    await sleep(200);
    await waitForRewardScreenToClose(2500);
    return;
  }

  // Act on the loot screen while it is still open — do NOT wait for Automator first (it can take seconds).
  const screenReady = await waitForRewardScreenReady(8000);
  if (!screenReady) {
    console.warn('[Manual Runner] Reward screen not open; inject may still use API, autosell needs the loot UI');
  }

  await sleep(300);
  const serverResults = await waitForServerResultsForReward(3000);
  const hasCreatureDrop = serverResults ? serverResultsHasCreatureDrop(serverResults) : false;

  if (wantsInject && serverResults) {
    await manualRunnerAutoInjectSealedCreatures(serverResults);
    if (wantsSell && hasCreatureDrop) {
      await sleep(300);
    }
  } else if (wantsInject && !serverResults) {
    console.warn('[Manual Runner][Inject] No serverResults at reward screen');
  }

  let autoSellSuccess = false;
  if (wantsSell && hasCreatureDrop) {
    if (!getOpenRewardsStateWithFallback()) {
      console.warn('[Manual Runner] Autosell skipped: reward screen already closed before sell');
    } else {
      autoSellSuccess = await autoSellCreatures();
    }
  }

  if (!autoSellSuccess) {
    const closeStart = performance.now();
    closeRewardScreen();
    await sleep(200);

    const rewardClosed = await waitForRewardScreenToClose(2500);
    const closeElapsed = Math.round(performance.now() - closeStart);
    
    if (!rewardClosed) {
      console.warn(`[Manual Runner] Reward screen did not close within timeout (${closeElapsed}ms), trying ESC key...`);
      dispatchEsc();
      await sleep(1000);
      if (getBoardOpenRewardsSnapshot()) {
        console.error('[Manual Runner] Reward screen still open after ESC key - this may cause issues');
      } else {
        rewardScreenOpen = false;
      }
    } else {
      console.log(`[Manual Runner] Reward screen closed in ${closeElapsed}ms`);
    }
  } else {
    // Autosell handled closing — verify it closed
    await sleep(300);
    if (!getBoardOpenRewardsSnapshot()) {
      rewardScreenOpen = false;
    }
  }
}

async function waitForServerResults(maxWaitTime = 2000) {
  let serverResults = null;
  const waitStart = performance.now();

  while (!serverResults && (performance.now() - waitStart) < maxWaitTime) {
    if (pendingServerResults.size > 0) {
      const lastSeed = Array.from(pendingServerResults.keys()).pop();
      serverResults = pendingServerResults.get(lastSeed);
      pendingServerResults.delete(lastSeed);
      break;
    }

    const contextServerResults = globalThis.state?.board?.getSnapshot?.()?.context?.serverResults;
    if (contextServerResults && contextServerResults.rewardScreen && typeof contextServerResults.seed !== 'undefined') {
      serverResults = contextServerResults;
      break;
    }

    await sleep(50);
  }

  return serverResults;
}

/**
 * After waitForGameCompletion, the skip path returns placeholder ticks/grade/rank (0, F, 0) while
 * serverResults still holds the real outcome. Victory is later taken from the server, so without this
 * merge, tick-based stop wrongly treats ticks 0 as ≤ stopWhenTicksReached.
 */
function applyRewardScreenToRunResult(result, serverResults) {
  if (!result || !serverResults?.rewardScreen) return;
  const rs = serverResults.rewardScreen;
  if (typeof rs.gameTicks === 'number') {
    result.ticks = rs.gameTicks;
  }
  if (typeof rs.rank === 'number') {
    result.rankPoints = rs.rank;
  }
  if (rs.grade && typeof rs.grade === 'string' && rs.grade !== '') {
    result.grade = rs.grade;
  } else if (typeof result.rankPoints === 'number') {
    const maxTeamSize = getMaxTeamSize(serverResults);
    result.grade = calculateGradeFromRankPoints(result.rankPoints, maxTeamSize);
  }
  if (typeof rs.victory === 'boolean') {
    result.completed = rs.victory;
  }
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
    roomId: serverResults?.rewardScreen?.roomId ?? null,
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
  return rewardScreenOpen || getBoardOpenRewardsSnapshot();
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
    const skipBtnEarly = findSkipButton();
    if (!shouldProcessAutoSkip(skipBtnEarly)) {
      return false;
    }
    skipInProgress = true;
    console.log(message || '[Manual Runner] enableSkip=true received — attempting to skip');
    await handleSkipButton().finally(() => {
      setTimeout(() => { skipInProgress = false; }, 1200);
    });
    return true;
  }

  const skipButton = findSkipButton();
  if (skipButton && shouldProcessAutoSkip(skipButton)) {
    if (!skipInProgress) {
      skipInProgress = true;
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

/** Win share and W/L string; wins+losses must be finished runs (same meaning as results modal). */
function formatWinratePercentWL(wins, losses) {
  const w = Math.max(0, Number(wins) || 0);
  const l = Math.max(0, Number(losses) || 0);
  const total = w + l;
  const pct = total > 0 ? String(Math.round((w / total) * 100)) : '0';
  return `${pct}% (${w}/${l})`;
}

function formatRoundsProgress(roundsPlayed, roundsLimit) {
  const played = Math.max(0, Number(roundsPlayed) || 0);
  const limit = Math.max(0, Number(roundsLimit) || 0);
  return limit > 0 ? `${played}/${limit}` : `${played}/∞`;
}

// Main function to run until victory
async function runUntilVictory(targetRankPoints = null, statusCallback = null) {
  const thisAnalysisId = analysisState.start();
  let startTime = null;
  let userForceStopped = false;
  
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
    setLockedFloorDuringRun(getCurrentFloor());
    
    // Hide game board if configured
    if (config.hideGameBoard) {
      const gameFrame = document.querySelector('main .frame-4');
      if (gameFrame) {
        gameFrame.style.display = 'none';
      }
    }
    
    attemptCount = 0;
    startTime = performance.now();
    console.log(`[Manual Runner][Perf] batch start ${formatManualRunnerPerfSnapshot(getManualRunnerPerfSnapshot())}`);
    
    while (true) {
      if (shouldAbortAnalysisLoop(thisAnalysisId)) {
        userForceStopped = true;
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

      if (!await clickStartButtonRobust({ maxWaitMs: 10000, recheckDelayMs: 1000 })) {
        console.warn('[Manual Runner] Stopping run: Start button unavailable (not a user stop)');
        break;
      }

      await sleep(200);

      const startOutcome = await waitForGameStartAfterClick(thisAnalysisId);
      let result;
      if (startOutcome === 'aborted') {
        result = createForceStopResult();
      } else if (startOutcome === 'failed') {
        result = {
          ticks: 0,
          grade: 'F',
          rankPoints: 0,
          completed: false,
          forceStopped: false,
          failedToStart: true
        };
        console.warn('[Manual Runner] Skipping wait for reward screen — run never started');
      } else {
        result = await waitForGameCompletion(thisAnalysisId);
      }
      if (result && result.skipped) {
        skipCount += 1;
      }

      await ensureRewardScreenHandled();
      await waitForModCoordinationTasks({ context: `post-attempt cleanup ${attemptCount}` });

      if (result.forceStopped) {
        userForceStopped = true;
        console.log('[Manual Runner] Analysis stopped');
        break;
      }

      const runTime = performance.now() - currentRunStartTime;
      // Do not read board serverResults after a failed start — context often still holds the *previous* run,
      // which would mark this attempt as victory with ticks 0 and wrongly satisfy ticksMax stop.
      let serverResults = null;
      if (!result.failedToStart) {
        serverResults = await waitForServerResults();
        applyRewardScreenToRunResult(result, serverResults);
      }

      let isVictory = result.completed;

      if (result.failedToStart) {
        isVictory = false;
      } else if (serverResults && serverResults.rewardScreen) {
        const serverVictory = serverResults.rewardScreen.victory === true;
        if (typeof serverResults.rewardScreen.victory === 'boolean') {
          isVictory = serverVictory;
        }
      } else {
        console.warn('[Manual Runner] No serverResults available, using result.completed:', result.completed);
      }

      updateVictoryDefeatCounters(isVictory);

      const attemptStaminaSpent = result.failedToStart
        ? 0
        : trackStaminaUsage(serverResults, attemptCount);

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

      console.log(`[Manual Runner] Attempt ${attemptCount} done:`, {
        victory: isVictory,
        ticks: result.ticks,
        grade: result.grade,
        rankPoints: result.rankPoints,
        staminaThis: attemptStaminaSpent,
        staminaTotal: totalStaminaSpent
      });
      logManualRunnerPerfCheckpoint(attemptCount, runTime);
      
      // Check if stop was requested during this run (after recording attempt data)
      if (!analysisState.isRunning()) {
        console.log('[Manual Runner] Stop requested - current run finished and recorded, stopping now');
        break;
      }

      if (config.stopCondition === 'rounds' && config.stopAfterRounds > 0 && attemptCount >= config.stopAfterRounds) {
        const totalTime = performance.now() - startTime;
        console.log(`[Manual Runner] ✓ Stop: reached round limit ${attemptCount}/${config.stopAfterRounds} — ${formatMilliseconds(totalTime)}`);
        return {
          success: true,
          attempts: attemptCount,
          finalResult: {
            ...result,
            completed: result.completed,
            victory: isVictory,
            stoppedByRoundLimit: true
          },
          totalTimeMs: totalTime,
          allAttempts
        };
      }

      if (statusCallback) {
        statusCallback({
          attempts: attemptCount,
          defeats: defeatsCount,
          victories: victoriesCount,
          staminaSpent: totalStaminaSpent,
          status: 'running',
          floor: getCurrentFloor()
        });
      }

      // Handle maxFloor mode separately
      if (config.stopCondition === 'maxFloor' && isVictory) {
        const currentFloor = getCurrentFloor();
        if (currentFloor >= config.maxFloor) {
          // Reached or exceeded max floor, stop
          const totalTime = performance.now() - startTime;
          console.log(`[Manual Runner] ✓ Max floor ${currentFloor}/${config.maxFloor} — stopping (${attemptCount} attempts, ${formatMilliseconds(totalTime)})`);
          
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
          console.log(`[Manual Runner] Victory floor ${currentFloor} → ${currentFloor + 1}`);
          advanceToNextFloor();
          await sleep(300); // Wait for floor change to take effect
          
          // Continue loop to next attempt on new floor
          const cleanupStart = performance.now();
          
          if (!await ensureGameStopped({ context: `post-victory cleanup ${attemptCount}` })) {
            console.warn('[Manual Runner] Stopping run: board still busy after idle wait (not a user stop)');
            break;
          }
          
          if (rewardScreenOpen) {
            closeRewardScreen();
          }

          const screenClosed = await waitForRewardScreenToClose(3000);
          if (!screenClosed) {
            console.warn('[Manual Runner] Reward screen did not close in time, continuing anyway');
          }

          await waitForModCoordinationTasks({ context: `post-victory cleanup ${attemptCount}` });

          await sleep(GAME_RESTART_DELAY_MS);
          
          const cleanupElapsed = Math.round(performance.now() - cleanupStart);
          console.log(`[Manual Runner] Next attempt on floor ${currentFloor + 1} after ${cleanupElapsed}ms`);
          
          // Continue to next iteration
          continue;
        }
      }

      const victoryConditionMet =
        isVictory &&
        config.stopCondition !== 'rounds' &&
        (config.stopCondition === 'any' ||
          targetRankPoints == null ||
          (typeof result.rankPoints === 'number' && result.rankPoints >= targetRankPoints));

      let victoryContinueDueToTicks = false;

      if (victoryConditionMet) {
        if (config.stopWhenTicksReached > 0) {
          // ticks === 0 is never a real fast win here (skip stub / stale read); require a positive count.
          if (result.ticks > 0 && result.ticks <= config.stopWhenTicksReached) {
            const totalTime = performance.now() - startTime;
            const rankSuffix = targetRankPoints != null ? `rank ${result.rankPoints} (S+${targetRankPoints})` : `rank ${result.rankPoints}`;
            console.log(`[Manual Runner] ✓ Stop: victory, ${rankSuffix}, ticks ${result.ticks} ≤ ${config.stopWhenTicksReached} — ${formatMilliseconds(totalTime)} (${attemptCount} attempts)`);

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

            return returnValue;
          } else {
            victoryContinueDueToTicks = true;
            if (result.ticks === 0) {
              console.warn(`[Manual Runner] ✓ Victory but ticks still 0 after server merge — cannot evaluate tick target; retrying`);
            } else {
              console.log(`[Manual Runner] ✓ Victory but ticks ${result.ticks} > ${config.stopWhenTicksReached} — searching for better run`);
            }
          }
        } else {
          const totalTime = performance.now() - startTime;
          const rankSuffix = targetRankPoints != null ? `rank ${result.rankPoints} (S+${targetRankPoints})` : `rank ${result.rankPoints}`;
          console.log(`[Manual Runner] ✓ Stop: victory, ${rankSuffix}, ticks ${result.ticks} — ${formatMilliseconds(totalTime)} (${attemptCount} attempts)`);

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

          return returnValue;
        }
      }

      if (!victoryContinueDueToTicks && !isVictory) {
        console.log(`[Manual Runner] Defeat on attempt ${attemptCount} — retry`);
      }

      const cleanupStart = performance.now();
      
      if (!await ensureGameStopped({ context: `post-attempt cleanup ${attemptCount}` })) {
        console.warn('[Manual Runner] Stopping run: board still busy after idle wait (not a user stop)');
        break;
      }

      if (rewardScreenOpen) {
        closeRewardScreen();
      }

      const screenClosed = await waitForRewardScreenToClose(3000);
      if (!screenClosed) {
        console.warn('[Manual Runner] Reward screen did not close in time, continuing anyway');
      }

      await waitForModCoordinationTasks({ context: `post-attempt cleanup ${attemptCount}` });

      await sleep(GAME_RESTART_DELAY_MS);
      
      const cleanupElapsed = Math.round(performance.now() - cleanupStart);
      console.log(`[Manual Runner] Ready attempt ${attemptCount + 1} (+${cleanupElapsed}ms cleanup)`);
    }
    
    const totalTime = performance.now() - startTime;
    return {
      success: false,
      attempts: attemptCount,
      forceStopped: userForceStopped,
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
    setLockedFloorDuringRun(null);
    analysisState.reset();
    teardownManualRunnerSubscriptions();
    resetManualRunnerTransientState();
    console.log(
      `[Manual Runner][Perf] batch end attempts=${attemptCount} ${formatManualRunnerPerfSnapshot(getManualRunnerPerfSnapshot())}`
    );
    
    // Restore game board visibility
    if (config.hideGameBoard) {
      const gameFrame = document.querySelector('main .frame-4');
      if (gameFrame && gameFrame.style.display === 'none') {
        gameFrame.style.display = '';
      }
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
      boardData = serializeBoard();
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
  
  if (textarea.parentNode) {
    textarea.parentNode.removeChild(textarea);
  }
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
  const currentConfig = loadConfig({ silent: true });
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
  const optRounds = document.createElement('option');
  optRounds.value = 'rounds';
  optRounds.textContent = t('mods.manualRunner.stopWhenRounds') || 'After X rounds';
  stopSelect.appendChild(optAny);
  stopSelect.appendChild(optMax);
  stopSelect.appendChild(optMaxFloor);
  stopSelect.appendChild(optRounds);
  stopSelect.value = config.stopCondition || 'max';
  stopContainer.appendChild(stopLabel);
  stopContainer.appendChild(stopSelect);
  content.appendChild(stopContainer);

  // Stop when ticks reached input (hidden and disabled when maxFloor is selected)
  const stopWhenTicksContainer = document.createElement('div');
  stopWhenTicksContainer.id = `${CONFIG_PANEL_ID}-stop-when-ticks-container`;
  stopWhenTicksContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
  stopWhenTicksContainer.style.display =
    (config.stopCondition === 'maxFloor' || config.stopCondition === 'rounds') ? 'none' : 'flex';
  
  const stopWhenTicksLabel = document.createElement('label');
  stopWhenTicksLabel.textContent = t('mods.manualRunner.stopWhenTicksReachedLabel');
  
  const stopWhenTicksInput = document.createElement('input');
  stopWhenTicksInput.type = 'number';
  stopWhenTicksInput.id = `${CONFIG_PANEL_ID}-stop-when-ticks-input`;
  stopWhenTicksInput.min = '0';
  stopWhenTicksInput.max = '3840'; // 4 minutes (240,000ms / 62.5ms per tick = 3,840 ticks)
  stopWhenTicksInput.value = config.stopWhenTicksReached || 0;
  stopWhenTicksInput.style.cssText = 'width: 80px; text-align: center; background-color: #333; color: #fff; border: 1px solid #555; padding: 4px 8px; border-radius: 4px;';
  stopWhenTicksInput.disabled =
    (config.stopCondition === 'maxFloor' || config.stopCondition === 'rounds');
  
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

  // Stop after rounds input (0 = endless)
  const roundsContainer = document.createElement('div');
  roundsContainer.id = `${CONFIG_PANEL_ID}-rounds-container`;
  roundsContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
  roundsContainer.style.display = config.stopCondition === 'rounds' ? 'flex' : 'none';

  const roundsLabel = document.createElement('label');
  roundsLabel.textContent = t('mods.manualRunner.stopAfterRoundsLabel') || 'Stop after rounds (0 = endless):';

  const roundsInput = document.createElement('input');
  roundsInput.type = 'number';
  roundsInput.id = `${CONFIG_PANEL_ID}-rounds-input`;
  roundsInput.min = '0';
  roundsInput.max = '9999';
  roundsInput.value = config.stopAfterRounds || 0;
  roundsInput.style.cssText = 'width: 80px; text-align: center; background-color: #333; color: #fff; border: 1px solid #555; padding: 4px 8px; border-radius: 4px;';

  roundsContainer.appendChild(roundsLabel);
  roundsContainer.appendChild(roundsInput);
  content.appendChild(roundsContainer);

  // Show/hide max floor input and stop when ticks input based on stop condition selection
  stopSelect.addEventListener('change', () => {
    const isMaxFloor = stopSelect.value === 'maxFloor';
    const isRounds = stopSelect.value === 'rounds';
    maxFloorContainer.style.display = isMaxFloor ? 'flex' : 'none';
    roundsContainer.style.display = isRounds ? 'flex' : 'none';
    stopWhenTicksContainer.style.display = (isMaxFloor || isRounds) ? 'none' : 'flex';
    stopWhenTicksInput.disabled = (isMaxFloor || isRounds);
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
  const sellWarningIcon = document.createElement('span');
  sellWarningIcon.textContent = '⚠';
  sellWarningIcon.title = 'Autosell on floor 11+ may sell sealed creatures';
  sellWarningIcon.setAttribute('aria-label', 'Warning: autosell may sell sealed creatures on floor 11+');
  sellWarningIcon.style.cssText = 'display: none; color: #f1c40f; font-weight: bold; cursor: help; margin-left: 2px;';

  const updateAutoSellWarning = () => {
    const currentFloor = getCurrentFloor();
    const maxFloorValue = parseInt(maxFloorInput.value, 10) || 10;
    const currentOrTargetFloor = Math.max(currentFloor, maxFloorValue);
    const canReachFloorElevenPlus = (stopSelect.value === 'maxFloor' && maxFloorValue >= 11) || currentOrTargetFloor >= 11;
    const showWarning = sellInput.checked && canReachFloorElevenPlus;
    sellWarningIcon.style.display = showWarning ? 'inline-block' : 'none';
    updateAutoInjectWarning();
  };

  sellContainer.appendChild(sellInput);
  sellContainer.appendChild(sellWarningIcon);
  sellContainer.appendChild(sellLabel);
  content.appendChild(sellContainer);

  // Auto-inject sealed creatures (manual-mode drops via serverResults)
  const injectContainer = document.createElement('div');
  injectContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  const injectInput = document.createElement('input');
  injectInput.type = 'checkbox';
  injectInput.id = `${CONFIG_PANEL_ID}-inject-input`;
  injectInput.checked = Boolean(config.enableAutoInjectSealedCreatures);
  const injectLabel = document.createElement('label');
  injectLabel.htmlFor = injectInput.id;
  injectLabel.textContent = t('mods.manualRunner.enableAutoInjectSealed') || 'Auto-inject sealed creatures';
  const injectWarningIcon = document.createElement('span');
  injectWarningIcon.textContent = '⚠';
  injectWarningIcon.title =
    t('mods.manualRunner.autoInjectWarningTooltip') ||
    'Injects sealed drops into matching awakened creatures (costs gold). Runs before autosell when both are enabled.';
  injectWarningIcon.setAttribute('aria-label', 'Warning: auto-inject affects sealed creatures on floor 11+');
  injectWarningIcon.style.cssText = 'display: none; color: #f1c40f; font-weight: bold; cursor: help; margin-left: 2px;';

  const updateAutoInjectWarning = () => {
    const currentFloor = getCurrentFloor();
    const maxFloorValue = parseInt(maxFloorInput.value, 10) || 10;
    const currentOrTargetFloor = Math.max(currentFloor, maxFloorValue);
    const canReachFloorElevenPlus =
      (stopSelect.value === 'maxFloor' && maxFloorValue >= 11) || currentOrTargetFloor >= 11;
    injectWarningIcon.style.display = injectInput.checked && canReachFloorElevenPlus ? 'inline-block' : 'none';
  };

  injectContainer.appendChild(injectInput);
  injectContainer.appendChild(injectWarningIcon);
  injectContainer.appendChild(injectLabel);
  content.appendChild(injectContainer);

  // Auto-skip when skip costs stamina (toggleable; normal free skips are always auto-clicked)
  const staminaSkipContainer = document.createElement('div');
  staminaSkipContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  const staminaSkipInput = document.createElement('input');
  staminaSkipInput.type = 'checkbox';
  staminaSkipInput.id = `${CONFIG_PANEL_ID}-stamina-skip-input`;
  staminaSkipInput.checked = Boolean(config.enableStaminaSkip);
  const staminaSkipLabel = document.createElement('label');
  staminaSkipLabel.htmlFor = staminaSkipInput.id;
  staminaSkipLabel.textContent = t('mods.manualRunner.enableStaminaSkip');
  staminaSkipContainer.appendChild(staminaSkipInput);
  staminaSkipContainer.appendChild(staminaSkipLabel);
  content.appendChild(staminaSkipContainer);

  sellInput.addEventListener('change', updateAutoSellWarning);
  injectInput.addEventListener('change', updateAutoInjectWarning);
  maxFloorInput.addEventListener('input', updateAutoSellWarning);
  stopSelect.addEventListener('change', updateAutoSellWarning);
  updateAutoSellWarning();
  updateAutoInjectWarning();

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
        config.enableAutoInjectSealedCreatures = injectInput.checked;
        config.enableStaminaSkip = staminaSkipInput.checked;
        config.stopWhenTicksReached = parseInt(document.getElementById(`${CONFIG_PANEL_ID}-stop-when-ticks-input`).value, 10) || 0;
        config.stopAfterRounds = parseInt(roundsInput.value, 10) || 0;
        config.maxFloor = parseInt(maxFloorInput.value, 10) || 10;
        // Clamp maxFloor to valid range
        if (config.maxFloor < 0) config.maxFloor = 0;
        if (config.maxFloor > 15) config.maxFloor = 15;
        if (config.stopAfterRounds < 0) config.stopAfterRounds = 0;
        if (config.stopAfterRounds > 9999) config.stopAfterRounds = 9999;
        saveConfig({ silent: true });
        api.service.updateScriptConfig(context.hash, {
          hideGameBoard: config.hideGameBoard,
          stopCondition: config.stopCondition,
          enableAutoRefillStamina: config.enableAutoRefillStamina,
          enableAutoSellCreatures: config.enableAutoSellCreatures,
          enableAutoInjectSealedCreatures: config.enableAutoInjectSealedCreatures,
          enableStaminaSkip: config.enableStaminaSkip,
          stopWhenTicksReached: config.stopWhenTicksReached,
          stopAfterRounds: config.stopAfterRounds,
          maxFloor: config.maxFloor
        });
        logConfigSummary('Start');
        
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
        config.enableAutoInjectSealedCreatures = injectInput.checked;
        config.enableStaminaSkip = staminaSkipInput.checked;
        config.stopWhenTicksReached = parseInt(document.getElementById(`${CONFIG_PANEL_ID}-stop-when-ticks-input`).value, 10) || 0;
        config.stopAfterRounds = parseInt(roundsInput.value, 10) || 0;
        config.maxFloor = parseInt(maxFloorInput.value, 10) || 10;
        // Clamp maxFloor to valid range
        if (config.maxFloor < 0) config.maxFloor = 0;
        if (config.maxFloor > 15) config.maxFloor = 15;
        if (config.stopAfterRounds < 0) config.stopAfterRounds = 0;
        if (config.stopAfterRounds > 9999) config.stopAfterRounds = 9999;
        saveConfig({ silent: true });
        api.service.updateScriptConfig(context.hash, {
          hideGameBoard: config.hideGameBoard,
          stopCondition: config.stopCondition,
          enableAutoRefillStamina: config.enableAutoRefillStamina,
          enableAutoSellCreatures: config.enableAutoSellCreatures,
          enableAutoInjectSealedCreatures: config.enableAutoInjectSealedCreatures,
          enableStaminaSkip: config.enableStaminaSkip,
          stopWhenTicksReached: config.stopWhenTicksReached,
          stopAfterRounds: config.stopAfterRounds,
          maxFloor: config.maxFloor
        });
        logConfigSummary('Config saved');
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
    title: t('mods.manualRunner.configTitle'),
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
  currentFloor = null,
  maxFloor = null
) {
  // First, force close any existing modals (like Board Analyzer does)
  forceCloseAllModals();
  
  const content = document.createElement('div');
  content.className = 'manual-runner-live-section';

  const createLiveRow = (labelText, valueText, valueId) => {
    const row = document.createElement('div');
    row.className = 'manual-runner-live-row';

    const label = createTextElement('span', {
      text: labelText,
      className: 'manual-runner-live-label'
    });
    const value = createTextElement('span', {
      id: valueId,
      text: valueText,
      className: 'manual-runner-live-value'
    });

    row.appendChild(label);
    row.appendChild(value);
    content.appendChild(row);
    return value;
  };
  
  const initialTargetFloor = maxFloor || config.maxFloor || 10;
  const initialCurrentFloor = currentFloor != null ? currentFloor : initialTargetFloor;
  if (config.stopCondition !== 'rounds') {
    createLiveRow(
      config.stopCondition === 'maxFloor' ? 'Floor' : 'Target',
      config.stopCondition === 'maxFloor' && maxFloor != null
        ? `${initialCurrentFloor}/${initialTargetFloor}`
        : targetRankPoints != null
          ? String(targetRankPoints)
          : 'Victory',
      'manual-runner-target'
    );
  }

  createLiveRow(
    t('mods.manualRunner.roundsLabel') || 'Rounds',
    formatRoundsProgress(attempts, config.stopCondition === 'rounds' ? config.stopAfterRounds : 0),
    'manual-runner-progress'
  );

  const winLossLine = formatWinratePercentWL(victories, defeats);
  const winLossValue = createLiveRow(
    'W/L',
    winLossLine,
    'manual-runner-win-loss'
  );
  if (winLossValue) {
    winLossValue.style.color = '#98C379';
  }
  
  // Add stamina usage
  createLiveRow(
    'Stamina',
    String(staminaSpent),
    'manual-runner-stamina'
  );
  
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
      // If already stopping, force-stop everything immediately
      if (analysisState.isStopping()) {
        console.log('[Manual Runner] Stop — force (already stopping)');
        analysisState.forceStop();
        
        // Force cleanup immediately
        if (window.ModCoordination) {
          window.ModCoordination.updateModState('Manual Runner', { active: false });
        }
        
        teardownManualRunnerSubscriptions();
        resetManualRunnerTransientState();
        
        // Close modal immediately
        if (activeRunningModal && activeRunningModal.close) {
          activeRunningModal.close();
        }
        activeRunningModal = null;
        
        // Reset state
        analysisState.reset();
        
        stopBtn.disabled = true;
        stopBtn.textContent = t('mods.manualRunner.stopped') || 'Stopped';
        return;
      }
    
    const prev = analysisState.state;
    analysisState.stop();
    console.log(`[Manual Runner] Stop (${prev} → ${analysisState.state})`);
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
  // Guard against opening while body is scroll-locked (would crash)
  const safeToOpen = await ensureResultsSafeToOpen(ENSURE_RESULTS_SAFE_TIMEOUT_MS);
  if (!safeToOpen) {
    console.warn('[Manual Runner] Body still scroll-locked; deferring results modal open...');
    setTimeout(() => { try { showResultsModal(results); } catch (_) {} }, DEFER_RESULTS_OPEN_MS);
    return;
  }

  setTimeout(() => {
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

    const lossAttempts = Math.max(0, stats.totalAttempts - stats.completedAttempts);
    appendStatRow(statsContainer, t('mods.manualRunner.winLoss'), formatWinratePercentWL(stats.completedAttempts, lossAttempts), {
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
    
    // Handle modal - it might be a function (closeModal) or an object
    let modalObject = modal;
    if (typeof modal === 'function') {
      // If it's a function, wrap it in an object with close method
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
        }
      });
    }, 50);
    
    // Register results modal with modal manager (like Board Analyzer)
    modalManager.register('results-modal', modalObject);
    
    return modalObject;
  }, 100);
}

// Main entry point - Run the analysis
async function runAnalysis() {
  if (!analysisState.canStart()) {
    console.log('[Manual Runner] Already running (state:', analysisState.state + ')');
    return;
  }
  
  // Close any existing modals using modal manager (like Board Analyzer)
  modalManager.closeByType(MODAL_TYPES.RUNNING);
  activeRunningModal = null;
  
  let runningModal = null;
  
  try {
    // Update coordination system state
    if (window.ModCoordination) {
      window.ModCoordination.updateModState('Manual Runner', { active: true });
    }
    // Compute target S+ rank points based on current setup and stop condition
    let targetRankPoints = null;
    if (config.stopCondition === 'max') {
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
    let lastDisplayedFloor = initialFloor;
    
    // Show running modal with target info
    runningModal = showRunningAnalysisModal(
      0,
      0,
      0,
      0,
      targetRankPoints,
      config.stopCondition === 'maxFloor' ? initialFloor : null,
      config.stopCondition === 'maxFloor' ? config.maxFloor : null
    );
    activeRunningModal = runningModal;
    
    const results = await runUntilVictory(targetRankPoints, (status) => {
      updateTextContent(
        'manual-runner-progress',
        formatRoundsProgress(status.attempts || 0, config.stopCondition === 'rounds' ? config.stopAfterRounds : 0)
      );

      if (config.stopCondition === 'maxFloor') {
        const targetFloor = config.maxFloor || 10;
        if (typeof status.floor === 'number') {
          lastDisplayedFloor = status.floor;
        }
        const currentFloor = lastDisplayedFloor;
        updateTextContent('manual-runner-target', `${currentFloor}/${targetFloor}`);
      } else if (typeof targetRankPoints === 'number') {
        updateTextContent('manual-runner-target', String(targetRankPoints));
      } else {
        updateTextContent('manual-runner-target', 'Victory');
      }

      const v = status.victories !== undefined ? status.victories : 0;
      const d = status.defeats !== undefined ? status.defeats : 0;
      updateTextContent(
        'manual-runner-win-loss',
        formatWinratePercentWL(v, d)
      );

      if (status.staminaSpent !== undefined) {
        updateTextContent('manual-runner-stamina', String(status.staminaSpent));
      }
    });
    
    console.log('[Manual Runner] Run finished:', {
      success: results?.success,
      attempts: results?.attempts,
      forceStopped: results?.forceStopped,
      allAttempts: results?.allAttempts?.length
    });
    
    forceCloseAllModals();
    runningModal = null;
    activeRunningModal = null;
    
    await sleep(UI_UPDATE_DELAY_MS);
    
    showResultsModal(results);
    
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
    // Update coordination system state
    if (window.ModCoordination) {
      window.ModCoordination.updateModState('Manual Runner', { active: false });
    }
    
    // Update coordination system state
    if (window.ModCoordination) {
      window.ModCoordination.updateModState('Manual Runner', { active: false });
    }
  }
}

// =======================
// 6. Initialization
// =======================

// Initialize UI
function init() {
  console.log('[Manual Runner] Initializing UI...');
  
  // Register with mod coordination system
  if (window.ModCoordination) {
    window.ModCoordination.registerMod('Manual Runner', {
      priority: 150,
      metadata: { description: 'Manual run analysis system' }
    });
    window.ModCoordination.updateModState('Manual Runner', { enabled: true });
  }
  
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
  updateMainButtonSealedWarning();
  if (mainButtonWarningInterval) {
    clearInterval(mainButtonWarningInterval);
  }
  mainButtonWarningInterval = setInterval(updateMainButtonSealedWarning, 1000);
  
  // Create the configuration panel
  createConfigPanel();
  
  console.log('[Manual Runner] UI initialized');
}

// =======================
// 7. Cleanup System
// =======================

/** Reward-screen flags, pending results, skip debounce — reset between runs and on mod unload. */
function resetManualRunnerTransientState() {
  pendingServerResults.clear();
  rewardScreenOpen = false;
  rewardScreenOpenedCallback = null;
  rewardScreenClosedCallback = null;
  skipInProgress = false;
  persistentLastTick = 0;
  persistentLastGrade = 'F';
  persistentLastRankPoints = 0;
}

/** Unsubscribe board, openRewards, and gameTimer; tear down shared tracker. */
function teardownManualRunnerSubscriptions() {
  cleanupBoardSubscription();
  cleanupGameTimerSubscription();
  if (gameStateTracker) {
    if (gameStateTracker.listeners?.size > 0) {
      console.warn(
        `[Manual Runner] gameStateTracker still has ${gameStateTracker.listeners.size} listener(s) during teardown`
      );
    }
    gameStateTracker.stopSubscription();
    gameStateTracker = null;
  }
}

function cleanupManualRunner() {
  console.log('[Manual Runner] Starting cleanup...');
  
  try {
    if (analysisState.isRunning()) {
      console.log('[Manual Runner] Stopping running analysis during cleanup');
      analysisState.stop();
    }
    
    forceCloseAllModals();
    teardownManualRunnerSubscriptions();
    resetManualRunnerTransientState();
    analysisState.reset();
    
    attemptCount = 0;
    currentRunStartTime = null;
    allAttempts = [];
    lastInjectProcessedSeed = null;
    defeatsCount = 0;
    victoriesCount = 0;
    totalStaminaSpent = 0;
    skipCount = 0;
    activeRunningModal = null;
    activeConfigPanel = null;
    
    if (config.hideGameBoard) {
      const gameFrame = document.querySelector('main .frame-4');
      if (gameFrame && gameFrame.style.display === 'none') {
        gameFrame.style.display = '';
      }
    }
    
    if (mainButtonWarningInterval) {
      clearInterval(mainButtonWarningInterval);
      mainButtonWarningInterval = null;
    }
    
    if (window.ModCoordination) {
      window.ModCoordination.updateModState('Manual Runner', { active: false });
      window.ModCoordination.unregisterMod('Manual Runner');
    }
    
    console.log(
      `[Manual Runner] Cleanup completed — ${formatManualRunnerPerfSnapshot(getManualRunnerPerfSnapshot())}`
    );
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
    saveConfig({ silent: true });
    // Also save via API for backward compatibility
    api.service.updateScriptConfig(context.hash, {
      hideGameBoard: config.hideGameBoard
    });
  },
  cleanup: cleanupManualRunner
};

