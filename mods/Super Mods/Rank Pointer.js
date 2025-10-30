// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[Rank Pointer] initializing...');

// Configuration with defaults
const defaultConfig = {
  hideGameBoard: false,
  stopCondition: 'max', // 'max' = Maximum rank, 'any' = Any Victory
  enableAutoRefillStamina: false
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
const GAME_RESTART_DELAY_MS = 1000;
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

// Chart rendering constants
const CHART_BAR_WIDTH = 8;
const CHART_BAR_SPACING = 4;
const CHART_BATCH_SIZE = 10;
const CHART_MIN_HEIGHT = 20;
const CHART_MAX_HEIGHT = 120;

// DOM optimization utility for batch operations
class DOMOptimizer {
  static createDocumentFragment() {
    return document.createDocumentFragment();
  }
  
  static batchAppend(parent, elements) {
    const fragment = this.createDocumentFragment();
    elements.forEach(element => {
      if (element) {
        fragment.appendChild(element);
      }
    });
    parent.appendChild(fragment);
  }
  
  static batchStyleUpdate(elements, styles) {
    elements.forEach(element => {
      if (element && element.style) {
        Object.assign(element.style, styles);
      }
    });
  }
  
  static batchTextUpdate(elements, text) {
    elements.forEach(element => {
      if (element) {
        element.textContent = text;
      }
    });
  }
}

// Event listener management utility
class EventManager {
  constructor() {
    this.listeners = new Map();
  }
  
  addListener(element, event, handler, options = {}) {
    element.addEventListener(event, handler, options);
    
    if (!this.listeners.has(element)) {
      this.listeners.set(element, []);
    }
    
    this.listeners.get(element).push({ event, handler, options });
  }
  
  removeListener(element, event, handler) {
    element.removeEventListener(event, handler);
    
    if (this.listeners.has(element)) {
      const listeners = this.listeners.get(element);
      const index = listeners.findIndex(l => l.event === event && l.handler === handler);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  removeAllListeners(element) {
    if (this.listeners.has(element)) {
      const listeners = this.listeners.get(element);
      listeners.forEach(({ event, handler, options }) => {
        element.removeEventListener(event, handler, options);
      });
      this.listeners.delete(element);
    }
  }
  
  cleanup() {
    this.listeners.forEach((listeners, element) => {
      listeners.forEach(({ event, handler, options }) => {
        element.removeEventListener(event, handler, options);
      });
    });
    this.listeners.clear();
  }
}

// ChartRenderer class for efficient chart rendering
class ChartRenderer {
  constructor(container, attempts) {
    this.container = container;
    this.attempts = attempts;
    this.eventManager = new EventManager();
    this.currentSort = 'runs';
  }
  
  render() {
    try {
      // Create chart container
      const chartContainer = document.createElement('div');
      chartContainer.style.cssText = 'margin-top: 20px; border: 1px solid #333; padding: 10px; height: 200px; position: relative; overflow: hidden;';
      
      // Create all chart elements
      const chartClickableNote = document.createElement('div');
      chartClickableNote.textContent = 'Click bars to view details';
      chartClickableNote.style.cssText = 'text-align: center; color: #3498db; margin-bottom: 15px; font-size: 0.9em; font-weight: 500;';
      
      // Create sorting buttons and scrollable chart area
      this.createSortButtons(chartContainer);
      this.createScrollableChart(chartContainer);
      
      // Batch append all elements to container
      DOMOptimizer.batchAppend(this.container, [chartClickableNote, chartContainer]);
      
      // Initial render
      this.renderChart();
      
    } catch (error) {
      console.error('[Rank Pointer] Error creating chart:', error);
      this.showChartError();
    }
  }
  
  createSortButtons(container) {
    const sortButtonsContainer = document.createElement('div');
    sortButtonsContainer.style.cssText = 'display: flex; gap: 5px; margin-bottom: 10px; justify-content: center;';
    
    const buttons = [
      { text: 'All Attempts', sortType: 'runs' },
      { text: 'Sort by Time', sortType: 'time' },
      { text: 'Sort by Ranks', sortType: 'ranks' }
    ];
    
    buttons.forEach(({ text, sortType }) => {
      const button = document.createElement('button');
      button.textContent = text;
      button.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
      button.style.cssText = 'flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px;';
      
      if (sortType === this.currentSort) {
        button.style.backgroundColor = '#4a5';
      }
      
      this.addEventListener(button, 'click', () => {
        this.updateSortButtons(sortButtonsContainer, button);
        this.currentSort = sortType;
        this.renderChart();
      });
      
      sortButtonsContainer.appendChild(button);
    });
    
    container.appendChild(sortButtonsContainer);
  }
  
  createScrollableChart(container) {
    // Create bars container
    const barsContainer = document.createElement('div');
    barsContainer.style.cssText = 'height: 150px; position: relative;';
    
    // Create scrollable wrapper
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
    
    scrollWrapper.appendChild(barsContainer);
    container.appendChild(scrollWrapper);
    
    // Store references for later use
    this.barsContainer = barsContainer;
    this.scrollWrapper = scrollWrapper;
  }
  
  updateSortButtons(container, activeButton) {
    container.querySelectorAll('button').forEach(btn => {
      btn.style.backgroundColor = '';
    });
    activeButton.style.backgroundColor = '#4a5';
  }
  
  renderChart() {
    if (!this.barsContainer) return;
    
    // Clear existing bars
    this.barsContainer.innerHTML = '';
    
    // Sort attempts based on current sort type
    const sortedAttempts = this.getSortedAttempts();
    
    // Calculate dimensions
    const spacing = CHART_BAR_SPACING;
    const barWidth = CHART_BAR_WIDTH;
    const totalChartWidth = sortedAttempts.length * (barWidth + spacing) - spacing;
    
    // Update container width
    this.barsContainer.style.width = `${totalChartWidth}px`;
    
    // Find max ticks for scaling - ensure it's at least 1 to avoid divide by zero
    const maxTicks = Math.max(1, ...sortedAttempts.map(a => a.ticks));
    
    // Render bars asynchronously to prevent UI blocking
    this.renderBarsAsync(sortedAttempts, maxTicks, spacing, barWidth);
  }
  
  getSortedAttempts() {
    switch (this.currentSort) {
      case 'time':
        return [...this.attempts].sort((a, b) => {
          // Failed attempts always go last
          if (!a.completed && b.completed) return 1;
          if (a.completed && !b.completed) return -1;
          // Sort by ticks
          return a.ticks - b.ticks;
        });
      case 'ranks':
        return [...this.attempts].sort((a, b) => {
          // Failed attempts always go last
          if (!a.completed && b.completed) return 1;
          if (a.completed && !b.completed) return -1;
          // Both failed, sort by ticks
          if (!a.completed && !b.completed) return a.ticks - b.ticks;
          
          if (a.grade === 'S+' && b.grade !== 'S+') return -1;
          if (a.grade !== 'S+' && b.grade === 'S+') return 1;
          if (a.grade === 'S+' && b.grade === 'S+') {
            // First sort by rank points (highest first)
            const rankDiff = (b.rankPoints || 0) - (a.rankPoints || 0);
            if (rankDiff !== 0) return rankDiff;
            // Then sort by ticks (lowest first)
            return a.ticks - b.ticks;
          }
          // For non-S+ grades, sort by grade first
          const gradeOrder = { 'S': 1, 'A': 2, 'B': 3, 'C': 4, 'D': 5, 'E': 6 };
          const gradeDiff = (gradeOrder[a.grade] || 999) - (gradeOrder[b.grade] || 999);
          if (gradeDiff !== 0) return gradeDiff;
          // Then sort by ticks (lowest first)
          return a.ticks - b.ticks;
        });
      default:
        return [...this.attempts];
    }
  }
  
  async renderBarsAsync(sortedAttempts, maxTicks, spacing, barWidth) {
    const batchSize = CHART_BATCH_SIZE;
    
    for (let i = 0; i < sortedAttempts.length; i += batchSize) {
      const batch = sortedAttempts.slice(i, i + batchSize);
      
      // Use requestAnimationFrame to prevent UI blocking
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Create document fragment for batch DOM operations
      const fragment = DOMOptimizer.createDocumentFragment();
      
      batch.forEach((attempt, batchIndex) => {
        const index = i + batchIndex;
        const bar = this.createBar(attempt, index, maxTicks, spacing, barWidth);
        if (bar) {
          fragment.appendChild(bar);
        }
      });
      
      // Batch append all bars in this batch
      this.barsContainer.appendChild(fragment);
    }
  }
  
  createBar(attempt, index, maxTicks, spacing, barWidth) {
    try {
      const bar = document.createElement('div');
      const height = Math.max(CHART_MIN_HEIGHT, Math.floor((attempt.ticks / maxTicks) * CHART_MAX_HEIGHT));
      
      // Determine bar color
      const barColor = this.getBarColor(attempt);
      
      // Set bar styles
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
        z-index: 1;
        display: block;
        box-sizing: border-box;
      `;
      
      // Add hover effects
      this.addEventListener(bar, 'mouseenter', () => {
        bar.style.border = '1px solid white';
        bar.style.transform = 'scale(1.1)';
      });
      
      this.addEventListener(bar, 'mouseleave', () => {
        bar.style.border = '1px solid transparent';
        bar.style.transform = 'scale(1)';
      });
      
      // Add tooltip
      bar.title = this.createTooltipText(attempt);
      
      // Add click handler for copying seed/replay data (like Board Analyzer)
      this.addEventListener(bar, 'click', () => {
        this.handleBarClick(attempt);
      });
      
      return bar;
      
    } catch (error) {
      console.error(`[Rank Pointer] Error creating bar ${index}:`, error);
      return null;
    }
  }
  
  getBarColor(attempt) {
    if (attempt.completed) {
      if (attempt.grade === 'S+' && attempt.rankPoints) {
        const sPlusAttempts = this.attempts.filter(a => a.grade === 'S+' && a.rankPoints);
        const highestRankPoints = sPlusAttempts.length > 0 ? 
          Math.max(...sPlusAttempts.map(a => a.rankPoints)) : 0;
        
        const rankDifference = highestRankPoints - attempt.rankPoints;
        const index = Math.max(0, Math.min(rankDifference, S_PLUS_COLORS.length - 1));
        return S_PLUS_COLORS[index];
      } else if (attempt.grade === 'S+') {
        return '#FFD700';
      } else {
        return '#4CAF50';
      }
    } else {
      return '#e74c3c';
    }
  }
  
  createTooltipText(attempt) {
    let tooltipText = `Attempt ${attempt.attemptNumber}: ${attempt.ticks} ticks, Grade: `;
    
    if (attempt.grade === 'S+' && attempt.rankPoints) {
      tooltipText += `S+${attempt.rankPoints}`;
    } else {
      tooltipText += attempt.grade;
    }
    
    tooltipText += `, ${attempt.completed ? 'Victory' : 'Defeat'}`;
    
    if (attempt.seed) {
      tooltipText += `, Seed: ${attempt.seed}`;
    }
    
    tooltipText += `\nClick to copy replay data`;
    
    return tooltipText;
  }
  
  handleBarClick(attempt) {
    // Create replay data (like Board Analyzer does)
    const replayData = createReplayDataForAttempt(attempt);
    
    if (replayData) {
      const replayText = `$replay(${JSON.stringify(replayData)})`;
      const success = copyToClipboard(replayText);
      
      if (success) {
        showCopyNotification(`Copied attempt ${attempt.attemptNumber} replay data!`);
      } else {
        showCopyNotification('Failed to copy replay data', true);
      }
    } else {
      // Fallback: if replay data fails, just copy seed
      if (attempt.seed) {
        const seedText = attempt.seed.toString();
        const success = copyToClipboard(seedText);
        
        if (success) {
          showCopyNotification(`Copied seed ${seedText} from attempt ${attempt.attemptNumber}!`);
        } else {
          showCopyNotification('Failed to copy seed', true);
        }
      } else {
        showCopyNotification('No replay data or seed available for this attempt', true);
      }
    }
  }
  
  showChartError() {
    const errorMessage = document.createElement('div');
    errorMessage.textContent = 'Error creating chart. Please check console for details.';
    errorMessage.style.cssText = 'text-align: center; color: #e74c3c; margin-top: 15px; padding: 10px; border: 1px solid #e74c3c; border-radius: 4px;';
    this.container.appendChild(errorMessage);
  }
  
  addEventListener(element, event, handler) {
    this.eventManager.addListener(element, event, handler);
  }
  
  cleanup() {
    this.eventManager.cleanup();
  }
}

// Global variables to track game data
let attemptCount = 0;
let currentRunStartTime = null;
let allAttempts = []; // Store all attempt data including serverResults
let boardSubscription = null; // Subscription to board state for serverResults
let pendingServerResults = new Map(); // Map of seed -> serverResults for matching to attempts
let defeatsCount = 0; // Track number of defeats
let totalStaminaSpent = 0; // Track total stamina spent
let openRewardsSubscription = null; // Subscription to openRewards state

// Shared game state tracker to avoid multiple subscriptions
let gameStateTracker = null;
let skipCount = 0; // Track number of skips
let skipInProgress = false; // Debounce skip handling

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

// Function to wait for game completion (tracking reward screen - 1 reward screen = 1 run)
async function waitForGameCompletion(analysisId) {
  console.log('[Rank Pointer] Waiting for reward screen to open (1 reward screen = 1 run)...');
  
  let attempts = 0;
  const maxAttempts = 48; // 4 minutes max wait time (48 * 5 seconds)
  
  // Track game data as it updates
  let lastTick = 0;
  let lastGrade = 'F';
  let lastRankPoints = 0;
  
  // Subscribe to gameTimer to capture game data as it updates
  const tracker = getGameStateTracker();
  const unsubscribeTracker = tracker.subscribe((context) => {
    console.log('[Rank Pointer] gameTimer context update:', {
      currentTick: context.currentTick,
      readableGrade: context.readableGrade,
      rankPoints: context.rankPoints
    });
    if (context.currentTick !== undefined) lastTick = context.currentTick;
    if (context.readableGrade) lastGrade = context.readableGrade;
    if (context.rankPoints !== undefined) lastRankPoints = context.rankPoints;
  });
  
  // Also log the tracked values when reward screen opens
  console.log('[Rank Pointer] Initial tracked values:', { lastTick, lastGrade, lastRankPoints });
  
  // Reset reward screen state at start (should already be false, but ensure it)
  rewardScreenOpen = false;
  console.log('[Rank Pointer] waitForGameCompletion: Reset rewardScreenOpen to false');
  
  while (attempts < maxAttempts) {
    try {
      // Check if this analysis instance is still valid
      if (analysisId && !analysisState.isValidId(analysisId)) {
        console.log('[Rank Pointer] Analysis instance changed during wait - stopping');
        return {
          ticks: 0,
          grade: 'F',
          rankPoints: 0,
          completed: false,
          forceStopped: true
        };
      }
      
      // Check for force stop
      if (analysisState.forceStop) {
        console.log('[Rank Pointer] Force stop detected during wait - stopping');
        return {
          ticks: 0,
          grade: 'F',
          rankPoints: 0,
          completed: false,
          forceStopped: true
        };
      }
      
      // Check if analysis state was reset
      if (!analysisState.isRunning()) {
        console.log('[Rank Pointer] Analysis state reset during wait - stopping');
        return {
          ticks: 0,
          grade: 'F',
          rankPoints: 0,
          completed: false,
          forceStopped: true
        };
      }
      
      // Check for skip button first (time-limit loss) - like btlucas fix.js
      const skipButton = findSkipButton();
      if (skipButton) {
        console.log(`[Rank Pointer] Skip button detected during check ${attempts + 1} - clicking to skip time-limit loss...`);
        await handleSkipButton();
        
        // Return a defeat result for skip button
        return {
          ticks: 0,
          grade: 'F',
          rankPoints: 0,
          completed: false,
          skipped: true
        };
      }
      
      // Check if reward screen is open (this means the game completed)
      let isRewardScreenOpen = false;
      try {
        const openRewards = globalThis.state.board.select((ctx) => ctx.openRewards);
        isRewardScreenOpen = openRewards.getSnapshot();
      } catch (e) {
        // Fallback to our tracked state
        isRewardScreenOpen = rewardScreenOpen;
      }
      
      // Also check tracked state (in case subscription updated it)
      if (!isRewardScreenOpen) {
        isRewardScreenOpen = rewardScreenOpen;
      }
      
      console.log(`[Rank Pointer] Check ${attempts + 1}: rewardScreenOpen=${isRewardScreenOpen}`);
      
      if (isRewardScreenOpen) {
        console.log(`[Rank Pointer] Reward screen opened after ${attempts} seconds - game completed!`);
        console.log(`[Rank Pointer] Tracked game data when reward screen opened:`, { lastTick, lastGrade, lastRankPoints });
        
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
          : lastGrade;
        let rankPoints = gameTimerContext.rankPoints !== undefined ? gameTimerContext.rankPoints : lastRankPoints;
        let currentTick = gameTimerContext.currentTick !== undefined ? gameTimerContext.currentTick : lastTick;
        
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
        
        // Unsubscribe from tracker before returning
        if (unsubscribeTracker) unsubscribeTracker();
        
        return {
          ticks: currentTick,
          grade: readableGrade,
          rankPoints: rankPoints,
          completed: completed
        };
      }
      
      // Log progress approximately every 10 seconds
      if (attempts % 2 === 0 && attempts > 0) {
        console.log(`[Rank Pointer] Still waiting for reward screen... (${attempts * 5}s elapsed)`);
      }
      
      // Fallback window: up to 10 seconds, check every 500ms (enableSkip first)
      for (let i = 0; i < 20; i++) {
        try {
          // 1) Server signal is most reliable
          try {
            const ctx = globalThis.state?.board?.getSnapshot?.()?.context;
            if (ctx?.serverResults?.enableSkip === true && !skipInProgress) {
              skipInProgress = true;
              console.log('[Rank Pointer] enableSkip=true (fast loop) — handling skip...');
              await handleSkipButton();
              setTimeout(() => { skipInProgress = false; }, 1200);
              return { ticks: 0, grade: 'F', rankPoints: 0, completed: false, skipped: true };
            }
          } catch (_) {}

          // 2) DOM fallback
          const skipButtonFast = findSkipButton();
          if (skipButtonFast) {
            console.log(`[Rank Pointer] Fast-scan DOM: Skip detected, handling immediately...`);
            await handleSkipButton();
            return { ticks: 0, grade: 'F', rankPoints: 0, completed: false, skipped: true };
          }
        } catch (_) {}
        await sleep(500);
      }
      attempts++;
      
    } catch (error) {
      console.error('[Rank Pointer] Error checking reward screen during wait:', error);
      await sleep(1000);
      attempts++;
    }
  }
  
  // Unsubscribe from tracker
  if (unsubscribeTracker) unsubscribeTracker();
  
  console.log('[Rank Pointer] Reward screen wait timeout - proceeding anyway...');
  // Return with failed state, using last tracked values if available
  return {
    ticks: lastTick || 0,
    grade: lastGrade || 'F',
    rankPoints: lastRankPoints || 0,
    completed: false,
    forceStopped: true
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
async function waitForRewardScreenToClose(maxWaitMs = 5000) {
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
    }, 100);
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

// Main function to run until victory
async function runUntilVictory(targetRankPoints = null, statusCallback = null) {
  const thisAnalysisId = analysisState.start();
  let startTime = null;
  
  try {
    // Reset attempts array and tracking variables
    allAttempts = [];
    defeatsCount = 0;
    totalStaminaSpent = 0;
    
    // Setup board subscription to capture serverResults
    setupBoardSubscription();
    
    // Setup rewards screen subscription to auto-close reward screens
    setupRewardsScreenSubscription();
    
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
      // Check if should stop
      if (!analysisState.isValidId(thisAnalysisId) || 
          !analysisState.isRunning() || 
          analysisState.forceStop) {
        console.log('[Rank Pointer] Stopping analysis');
        break;
      }
      
      attemptCount++;
      currentRunStartTime = performance.now();
      
      // Update status initially
      if (statusCallback) {
        statusCallback({
          attempts: attemptCount,
          defeats: defeatsCount,
          staminaSpent: totalStaminaSpent,
          status: 'running'
        });
      }
      
      console.log(`[Rank Pointer] Attempt ${attemptCount}: Starting game...`);
      
      // Reset reward screen state before starting new game
      rewardScreenOpen = false;
      console.log(`[Rank Pointer] Reset rewardScreenOpen to false for attempt ${attemptCount + 1}`);
      
      // Start the game
      if (!clickStartButton()) {
        console.error('[Rank Pointer] Failed to find start button');
        break;
      }
      
      // Wait a moment for game to actually start
      await sleep(200);
      
      // Wait for game to complete (detected by reward screen opening)
      // Skip button check will happen inside waitForGameCompletion
      const result = await waitForGameCompletion(thisAnalysisId);
      if (result && result.skipped) {
        skipCount += 1;
      }
      
      // Reward screen should be open now (waitForGameCompletion returned when it opened)
      // Verify it's actually open and then close it
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
      } else {
        console.log(`[Rank Pointer] Closing reward screen after game completion...`);
        
        // First, try to close the reward screen
        closeRewardScreen();
        
        // Wait a moment for the close action to take effect
        await sleep(500);
        
        // Wait for reward screen to actually close (this is critical for the Start button to appear)
        const rewardClosed = await waitForRewardScreenToClose(5000); // Increased timeout
        if (!rewardClosed) {
          console.warn('[Rank Pointer] Reward screen did not close within timeout, trying ESC key...');
          // Try ESC key as fallback
          dispatchEsc();
          
          // Wait a bit more
          await sleep(1000);
          
          // Check one more time
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
          console.log(`[Rank Pointer] Reward screen closed successfully, processing result...`);
        }
      }
      
      // Check if force stopped
      if (result.forceStopped) {
        console.log('[Rank Pointer] Analysis stopped');
        break;
      }
      
      const runTime = performance.now() - currentRunStartTime;
      
      // Wait for serverResults to arrive (with timeout to avoid infinite wait)
      // This ensures we get the victory status from serverResults
      let serverResults = null;
      const maxWaitTime = 2000; // Max 2 seconds to wait for serverResults
      const waitStart = performance.now();
      
      while (!serverResults && (performance.now() - waitStart) < maxWaitTime) {
        // First, try to get from context (most reliable and current)
        if (globalThis.state?.board?.getSnapshot?.()?.context?.serverResults) {
          const contextServerResults = globalThis.state.board.getSnapshot().context.serverResults;
          if (contextServerResults && contextServerResults.rewardScreen && typeof contextServerResults.seed !== 'undefined') {
            // Make a deep copy of serverResults
            serverResults = JSON.parse(JSON.stringify(contextServerResults));
            console.log('[Rank Pointer] Got serverResults from context, seed:', serverResults.seed, 'victory:', serverResults.rewardScreen.victory);
            break;
          }
        }
        
        // If not found in context, check pending serverResults map
        if (pendingServerResults.size > 0) {
          // Get the most recently added serverResults
          const lastSeed = Array.from(pendingServerResults.keys()).pop();
          serverResults = pendingServerResults.get(lastSeed);
          // Remove from pending since we've used it
          pendingServerResults.delete(lastSeed);
          console.log('[Rank Pointer] Got serverResults from pending map, seed:', serverResults?.seed, 'victory:', serverResults?.rewardScreen?.victory);
          break;
        }
        
        // Wait a bit before checking again
        await sleep(50);
      }
      
      // Determine victory/defeat from serverResults if available, otherwise use result.completed
      let isVictory = result.completed;
      
      if (serverResults && serverResults.rewardScreen) {
        // Use serverResults.rewardScreen.victory as the source of truth (like Hunt Analyzer)
        const serverVictory = serverResults.rewardScreen.victory === true;
        console.log(`[Rank Pointer] Victory status - serverResults: ${serverVictory}, result.completed: ${result.completed}`);
        
        // Prefer serverResults over result.completed (server is authoritative)
        if (typeof serverResults.rewardScreen.victory === 'boolean') {
          isVictory = serverVictory;
        }
      } else {
        console.warn(`[Rank Pointer] No serverResults available, using result.completed:`, result.completed);
      }
      
      // Final victory determination
      console.log(`[Rank Pointer] Final victory determination: ${isVictory}`);
      
      // Track defeats
      if (!isVictory) {
        defeatsCount++;
      }
      
      // Track stamina spent from serverResults (like Hunt Analyzer)
      // Use same approach as Hunt Analyzer: check if playerExpDiff is a number
      let attemptStaminaSpent = 0;
      if (typeof serverResults?.next?.playerExpDiff === 'number') {
        attemptStaminaSpent = serverResults.next.playerExpDiff;
        totalStaminaSpent += attemptStaminaSpent;
        console.log(`[Rank Pointer] Stamina spent this attempt: ${attemptStaminaSpent}, total: ${totalStaminaSpent}`);
      } else {
        console.warn(`[Rank Pointer] No valid playerExpDiff found in serverResults for attempt ${attemptCount}`);
      }
      
      // Extract seed from serverResults if available
      let attemptSeed = null;
      if (serverResults && typeof serverResults.seed !== 'undefined') {
        attemptSeed = serverResults.seed;
      }
      
      // Store attempt data (similar to Hunt Analyzer's sessionData structure)
      const attemptData = {
        attemptNumber: attemptCount,
        ticks: result.ticks,
        grade: result.grade,
        rankPoints: result.rankPoints || 0,
        completed: isVictory, // Use victory status from serverResults
        victory: isVictory, // Explicit victory field
        runTimeMs: runTime,
        staminaSpent: attemptStaminaSpent, // Store stamina spent per attempt (like Hunt Analyzer)
        seed: attemptSeed, // Store seed for replay/copy functionality
        serverResults: serverResults,
        skipped: !!result.skipped
      };
      
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
      
      // Check if serverResults has tick information
      if (serverResults) {
        console.log('[Rank Pointer] serverResults structure:', {
          hasRewardScreen: !!serverResults.rewardScreen,
          hasNext: !!serverResults.next,
          rewardScreenKeys: serverResults.rewardScreen ? Object.keys(serverResults.rewardScreen) : null,
          nextKeys: serverResults.next ? Object.keys(serverResults.next) : null
        });
      }
      
      // Update status callback with defeats and stamina info
      if (statusCallback) {
        statusCallback({
          attempts: attemptCount,
          defeats: defeatsCount,
          staminaSpent: totalStaminaSpent,
          status: 'running'
        });
      }
      
      // If victory, stop only when reaching target S+ rank points if provided
      if (isVictory && (targetRankPoints == null || (typeof result.rankPoints === 'number' && result.rankPoints >= targetRankPoints))) {
        const totalTime = performance.now() - startTime;
        console.log(`[Rank Pointer] ✓ VICTORY DETECTED${targetRankPoints != null ? ` with rank ${result.rankPoints} (target S+${targetRankPoints})` : ''}. Stopping analysis.`);
        console.log(`[Rank Pointer] Victory achieved after ${attemptCount} attempts! Total time: ${formatMilliseconds(totalTime)}`);
        console.log(`[Rank Pointer] Result details:`, {
          ticks: result.ticks,
          grade: result.grade,
          rankPoints: result.rankPoints,
          serverVictory: serverResults?.rewardScreen?.victory,
          isVictory: isVictory,
          resultCompleted: result.completed
        });
        console.log(`[Rank Pointer] About to return from runUntilVictory with success: true`);
        console.log(`[Rank Pointer] Current analysisState:`, analysisState.state);
        console.log(`[Rank Pointer] All attempts collected:`, allAttempts.length);
        
        // Update final result with serverResults data
        const finalResult = {
          ...result,
          completed: true,
          victory: true
        };
        
        // Return immediately - this will exit the while loop
        const returnValue = {
          success: true,
          attempts: attemptCount,
          finalResult: finalResult,
          totalTimeMs: totalTime,
          allAttempts: allAttempts
        };
        
        console.log(`[Rank Pointer] Returning victory result:`, {
          success: returnValue.success,
          attempts: returnValue.attempts,
          totalTimeMs: returnValue.totalTimeMs,
          allAttemptsLength: returnValue.allAttempts.length
        });
        
        return returnValue;
      }
      
      // Log defeat for debugging
      console.log(`[Rank Pointer] Defeat on attempt ${attemptCount} - will restart`);
      
      // If defeat, wait a bit then restart
      console.log(`[Rank Pointer] Defeat on attempt ${attemptCount}, restarting...`);
      
      // Wait for game to fully stop before restarting
      let stopWaitCount = 0;
      while (stopWaitCount < 10) { // Wait up to 1 second
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (!boardContext.gameStarted) {
          console.log(`[Rank Pointer] Game stopped after ${stopWaitCount * 100}ms`);
          break;
        }
        await sleep(100);
        stopWaitCount++;
      }
      
      // Wait for reward screen to close (if it opened)
      // First close it if it's open
      if (rewardScreenOpen) {
        console.log(`[Rank Pointer] Reward screen is open, closing it...`);
        closeRewardScreen();
      }
      
      // Wait for it to fully close
      const screenClosed = await waitForRewardScreenToClose(3000);
      if (screenClosed) {
        console.log(`[Rank Pointer] Reward screen closed, ready to continue`);
      } else {
        console.warn(`[Rank Pointer] Reward screen did not close in time, continuing anyway`);
      }
      
      // Additional delay to ensure UI is ready
      await sleep(GAME_RESTART_DELAY_MS);
      console.log(`[Rank Pointer] Ready to start attempt ${attemptCount + 1}`);
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
  stopLabel.textContent = 'Stop when:';
  const stopSelect = document.createElement('select');
  stopSelect.id = `${CONFIG_PANEL_ID}-stop-select`;
  stopSelect.style.cssText = 'min-width: 160px; background-color: #222; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 4px;';
  const optMax = document.createElement('option');
  optMax.value = 'max';
  optMax.textContent = 'Maximum rank';
  const optAny = document.createElement('option');
  optAny.value = 'any';
  optAny.textContent = 'Any Victory';
  stopSelect.appendChild(optMax);
  stopSelect.appendChild(optAny);
  stopSelect.value = (config.stopCondition === 'any') ? 'any' : 'max';
  stopContainer.appendChild(stopLabel);
  stopContainer.appendChild(stopSelect);
  content.appendChild(stopContainer);

  // Hide game board checkbox
  const hideContainer = document.createElement('div');
  hideContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  
  const hideInput = document.createElement('input');
  hideInput.type = 'checkbox';
  hideInput.id = `${CONFIG_PANEL_ID}-hide-input`; // Make ID unique to this panel
  hideInput.checked = Boolean(config.hideGameBoard); // Explicit boolean conversion
  
  const hideLabel = document.createElement('label');
  hideLabel.htmlFor = hideInput.id;
  hideLabel.textContent = 'Hide game board during runs';
  
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
  refillLabel.textContent = 'Enable auto-refill stamina (via Automator)';
  refillContainer.appendChild(refillInput);
  refillContainer.appendChild(refillLabel);
  content.appendChild(refillContainer);

  // Check if board has ally creatures
  const hasAlly = hasAllyCreaturesOnBoard();
  
  // Add warning message if no ally creatures
  if (!hasAlly) {
    const warningMsg = document.createElement('div');
    warningMsg.textContent = '⚠️ No ally creatures on board. Please place at least one ally creature before starting.';
    warningMsg.style.cssText = 'color: #e74c3c; margin-top: 8px; padding: 8px; background-color: rgba(231, 76, 60, 0.1); border-radius: 4px; font-size: 0.9em;';
    content.appendChild(warningMsg);
  }
  
  // Create buttons array - use closure to access hideInput directly
  const buttons = [
    {
      text: 'Start',
      primary: true,
      disabled: !hasAlly || !analysisState.canStart(), // Disable if no ally creatures or already running
      onClick: () => {
        console.log('[Rank Pointer] Start button clicked, canStart:', analysisState.canStart(), 'state:', analysisState.state);
        
        // Double-check ally creatures (in case board changed since panel opened)
        if (!hasAllyCreaturesOnBoard()) {
          console.log('[Rank Pointer] No ally creatures on board, cannot start');
          api.ui.components.createModal({
            title: 'Cannot Start',
            content: 'Please place at least one ally creature on the board before starting.',
            buttons: [{ text: 'OK', primary: true }]
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
        // Save to localStorage (preferred method)
        saveConfig();
        // Also save via API for backward compatibility
        api.service.updateScriptConfig(context.hash, {
          hideGameBoard: config.hideGameBoard,
          stopCondition: config.stopCondition,
          enableAutoRefillStamina: config.enableAutoRefillStamina
        });
        console.log('[Rank Pointer] Config saved on Start,', {
          hideGameBoard: config.hideGameBoard,
          stopCondition: config.stopCondition,
          enableAutoRefillStamina: config.enableAutoRefillStamina
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
      text: 'Save',
      primary: false,
      onClick: () => {
        // Use direct reference to the checkbox element
        config.hideGameBoard = hideInput.checked;
        config.stopCondition = stopSelect.value === 'any' ? 'any' : 'max';
        config.enableAutoRefillStamina = refillInput.checked;
        // Save to localStorage (preferred method)
        saveConfig();
        // Also save via API for backward compatibility
        api.service.updateScriptConfig(context.hash, {
          hideGameBoard: config.hideGameBoard,
          stopCondition: config.stopCondition,
          enableAutoRefillStamina: config.enableAutoRefillStamina
        });
        console.log('[Rank Pointer] Config saved', {
          hideGameBoard: config.hideGameBoard,
          stopCondition: config.stopCondition,
          enableAutoRefillStamina: config.enableAutoRefillStamina
        });
      }
    },
    {
      text: 'Cancel',
      primary: false
    }
  ];

  // Separator and credit footer
  const separator = document.createElement('div');
  separator.style.cssText = 'margin-top: 8px; border-top: 1px solid #444; opacity: 0.6;';
  const credit = document.createElement('div');
  credit.style.cssText = 'margin-top: 2px; font-size: 11px; font-style: italic; color: #aaa; text-align: right;';
  credit.innerHTML = 'Made with the help of <a href="https://bestiaryarena.com/profile/btlucas" target="_blank" rel="noopener noreferrer" style="color:#61AFEF; text-decoration: underline;">btlucas</a>';
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
      if (startButton && startButton.textContent.trim() === 'Start') {
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
function showRunningAnalysisModal(attempts, defeats = 0, staminaSpent = 0, targetRankPoints = null) {
  // First, force close any existing modals (like Board Analyzer does)
  forceCloseAllModals();
  
  const content = document.createElement('div');
  content.style.cssText = 'text-align: center;';
  
  const message = document.createElement('p');
  message.id = 'rank-pointer-target';
  message.textContent = targetRankPoints != null ? `Running until S+${targetRankPoints}` : 'Running until victory...';
  content.appendChild(message);
  
  const progress = document.createElement('p');
  progress.id = 'rank-pointer-progress';
  progress.textContent = `Attempt ${attempts}`;
  progress.style.cssText = 'margin-top: 12px;';
  content.appendChild(progress);
  
  // Add defeats count
  const defeatsElement = document.createElement('p');
  defeatsElement.id = 'rank-pointer-defeats';
  defeatsElement.textContent = `Defeats: ${defeats}`;
  defeatsElement.style.cssText = 'margin-top: 8px; color: #e74c3c;';
  content.appendChild(defeatsElement);
  
  // Add stamina usage
  const staminaElement = document.createElement('p');
  staminaElement.id = 'rank-pointer-stamina';
  staminaElement.textContent = `Stamina Spent: ${staminaSpent}`;
  staminaElement.style.cssText = 'margin-top: 8px; color: #3498db;';
  content.appendChild(staminaElement);
  
  // Create self-contained HTML modal to avoid conflicts with other modals
  injectRankPointerStyles();
  const wrapper = document.createElement('div');
  wrapper.id = 'rank-pointer-running-modal';
  wrapper.dataset.pointerModal = 'running';
  wrapper.setAttribute('role', 'dialog');
  wrapper.setAttribute('aria-label', 'Rank Pointer Running');
  // Position only; visual theme comes from CSS to match Hunt Analyzer
  wrapper.className = 'rank-pointer-modal';
  wrapper.style.cssText = ['position: absolute','left: 12px','bottom: 12px'].join(';');

  const header = document.createElement('div');
  header.textContent = 'Rank Pointer Running';
  header.className = 'rank-pointer-modal-header';

  const body = document.createElement('div');
  body.className = 'rank-pointer-modal-body';
  body.appendChild(content);

  const footer = document.createElement('div');
  footer.className = 'rank-pointer-modal-footer';

  const stopBtn = document.createElement('button');
  stopBtn.type = 'button';
  stopBtn.textContent = 'Stop';
  stopBtn.className = 'rank-pointer-button';
  stopBtn.addEventListener('click', (e) => {
    console.log('[Rank Pointer] Stop button clicked, current state:', analysisState.state);
    analysisState.stop();
    console.log('[Rank Pointer] After stop(), state:', analysisState.state);
    stopBtn.disabled = true;
    stopBtn.textContent = 'Stopping...';
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
      try { closeRewardScreen(); } catch (_) {}
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
      const partialNote = document.createElement('div');
      partialNote.textContent = 'Rank Pointer stopped by user';
      partialNote.style.cssText = 'text-align: center; color: #e74c3c; margin-bottom: 15px;';
      content.appendChild(partialNote);
    }
    
    // Calculate statistics from all attempts
    const attempts = results.allAttempts || [];
    const stats = calculateStatistics(attempts);
    
    // Create result statistics
    const statsContainer = document.createElement('div');
    statsContainer.style.cssText = 'display: grid; grid-template-columns: 55% 40%; gap: 10px; margin-bottom: 20px;';
    
    // Total Attempts
    const attemptsLabel = document.createElement('div');
    attemptsLabel.textContent = 'Total Attempts:';
    attemptsLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    const attemptsValue = document.createElement('div');
    attemptsValue.textContent = stats.totalAttempts.toString();
    attemptsValue.style.cssText = 'text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    // Completion Rate
    const completionRateLabel = document.createElement('div');
    completionRateLabel.textContent = 'Completion Rate:';
    completionRateLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    const completionRateValue = document.createElement('div');
    completionRateValue.textContent = `${stats.completionRate}% (${stats.completedAttempts}/${stats.totalAttempts})`;
    completionRateValue.style.cssText = 'text-align: right; color: #2ecc71; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    // S+ Rate
    if (stats.sPlusCount > 0) {
      const sPlusRateLabel = document.createElement('div');
      sPlusRateLabel.textContent = 'S+ Rate:';
      sPlusRateLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
      const sPlusRateValue = document.createElement('div');
      sPlusRateValue.textContent = `${stats.sPlusRate}% (${stats.sPlusCount}/${stats.totalAttempts})`;
      sPlusRateValue.style.cssText = 'text-align: right; color: #FFD700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
      
      statsContainer.appendChild(sPlusRateLabel);
      statsContainer.appendChild(sPlusRateValue);

      // Add S+ breakdown per rank points (S+1, S+2, ...), similar to Board Analyzer
      try {
        const sPlusResults = attempts.filter(a => a.grade === 'S+' && a.rankPoints);
        if (sPlusResults.length > 0) {
          const rankPointsCounts = {};
          sPlusResults.forEach(r => {
            const rp = r.rankPoints || 0;
            rankPointsCounts[rp] = (rankPointsCounts[rp] || 0) + 1;
          });
          const sortedRankPoints = Object.keys(rankPointsCounts)
            .map(n => parseInt(n))
            .sort((a, b) => b - a);
          const highestRankPoints = sortedRankPoints[0];
          sortedRankPoints.forEach(rp => {
            const count = rankPointsCounts[rp];
            const rate = stats.totalAttempts > 0 ? (count / stats.totalAttempts * 100).toFixed(2) : '0.00';
            const label = document.createElement('div');
            label.textContent = `S+${rp} Rate:`;
            label.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 10px; font-style: italic;';
            const value = document.createElement('div');
            const rankDifference = highestRankPoints - rp;
            const idx = Math.max(0, Math.min(rankDifference, S_PLUS_COLORS.length - 1));
            const textColor = S_PLUS_COLORS[idx];
            value.textContent = `${rate}% (${count}/${stats.totalAttempts})`;
            value.style.cssText = `text-align: right; color: ${textColor}; font-style: italic;`;
            statsContainer.appendChild(label);
            statsContainer.appendChild(value);
          });
        }
      } catch (e) {
        console.warn('[Rank Pointer] Error creating S+ breakdown:', e);
      }
    }
    
    // When stopped without victory, show progress toward target S+ rank
    if (!results.success) {
      try {
        const maxTeamSizeForTarget = getMaxTeamSize(null);
        const playerTeamSizeForTarget = getPlayerTeamSize();
        const targetRankPoints = Math.max(0, (2 * maxTeamSizeForTarget) - playerTeamSizeForTarget);
        
        const highestLabel = document.createElement('div');
        highestLabel.textContent = 'Highest Rank Points:';
        highestLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        const highestValue = document.createElement('div');
        highestValue.textContent = (stats.maxRankPoints || 0).toString();
        highestValue.style.cssText = 'text-align: right; color: #FFD700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        statsContainer.appendChild(highestLabel);
        statsContainer.appendChild(highestValue);
        
        const targetLabel = document.createElement('div');
        targetLabel.textContent = 'Target Rank:';
        targetLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        const targetValue = document.createElement('div');
        targetValue.textContent = `S+${targetRankPoints}`;
        targetValue.style.cssText = 'text-align: right; color: #FFD700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        statsContainer.appendChild(targetLabel);
        statsContainer.appendChild(targetValue);
      } catch (e) {
        console.warn('[Rank Pointer] Could not compute target rank points for display:', e);
      }
    }
    
    // Max Rank Points
    if (stats.maxRankPoints > 0) {
      const maxRankLabel = document.createElement('div');
      maxRankLabel.textContent = 'Max Rank Points:';
      maxRankLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
      const maxRankValue = document.createElement('div');
      maxRankValue.textContent = stats.maxRankPoints.toString();
      maxRankValue.style.cssText = 'text-align: right; color: #FFD700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
      
      statsContainer.appendChild(maxRankLabel);
      statsContainer.appendChild(maxRankValue);
    }
    
    // Removed Min Ticks row for simplified single-run view
    
    // Remove ticks/time aggregates; instead show stamina and skips
    const staminaLabel = document.createElement('div');
    staminaLabel.textContent = 'Stamina Spent:';
    staminaLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    const staminaValue = document.createElement('div');
    staminaValue.textContent = (stats.staminaSpentTotal || 0).toString();
    staminaValue.style.cssText = 'text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    statsContainer.appendChild(staminaLabel);
    statsContainer.appendChild(staminaValue);

    const skipsLabel = document.createElement('div');
    skipsLabel.textContent = 'Skips:';
    skipsLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    const skipsValue = document.createElement('div');
    skipsValue.textContent = (stats.skips || 0).toString();
    skipsValue.style.cssText = 'text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    statsContainer.appendChild(skipsLabel);
    statsContainer.appendChild(skipsValue);
    
    // If victory, show success message
    if (results.success && results.finalResult) {
      const successMsg = document.createElement('div');
      successMsg.textContent = '✓ Victory achieved!';
      successMsg.style.cssText = 'text-align: center; color: #2ecc71; margin-bottom: 15px; font-size: 1.2em; font-weight: bold;';
      content.appendChild(successMsg);
      
      // Add final result details
      const finalResultLabel = document.createElement('div');
      finalResultLabel.textContent = 'Final Result:';
      finalResultLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
      const finalResultValue = document.createElement('div');
      
      // Format: "S+1 (130 ticks)" or "S (130 ticks)" if no rankPoints
      let finalResultText = results.finalResult.grade || 'N/A';
      if (results.finalResult.grade === 'S+' && results.finalResult.rankPoints) {
        finalResultText = `S+${results.finalResult.rankPoints}`;
      }
      finalResultText += ` (${results.finalResult.ticks} ticks)`;
      
      finalResultValue.textContent = finalResultText;
      finalResultValue.style.cssText = 'text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
      
      statsContainer.appendChild(finalResultLabel);
      statsContainer.appendChild(finalResultValue);
    }
    
    statsContainer.appendChild(attemptsLabel);
    statsContainer.appendChild(attemptsValue);
    statsContainer.appendChild(completionRateLabel);
    statsContainer.appendChild(completionRateValue);
    
    content.appendChild(statsContainer);

    // We only have 1 run: remove graph and provide Copy Replay only when a victory exists
    const victoryAttempt = attempts.find(a => a && (a.completed || a.victory));
    if (victoryAttempt) {
      const replayContainer = document.createElement('div');
      replayContainer.style.cssText = 'margin-top: 12px; display: flex; justify-content: flex-end;';

      const copyReplayBtn = document.createElement('button');
      copyReplayBtn.textContent = 'Copy Replay';
      copyReplayBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
      copyReplayBtn.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px;';

      copyReplayBtn.addEventListener('click', () => {
        const attempt = victoryAttempt;
        const replayData = createReplayDataForAttempt(attempt);
        if (replayData) {
          const replayText = `$replay(${JSON.stringify(replayData)})`;
          const success = copyToClipboard(replayText);
          if (success) {
            showCopyNotification('Copied replay data!');
          } else {
            showCopyNotification('Failed to copy replay data', true);
          }
        } else if (attempt && attempt.seed) {
          const seedText = attempt.seed.toString();
          const success = copyToClipboard(seedText);
          if (success) {
            showCopyNotification(`Copied seed ${seedText}!`);
          } else {
            showCopyNotification('Failed to copy seed', true);
          }
        } else {
          showCopyNotification('No replay data or seed available', true);
        }
      });

      replayContainer.appendChild(copyReplayBtn);
      content.appendChild(replayContainer);
    } else {
      const noAttemptsMessage = document.createElement('p');
      noAttemptsMessage.textContent = 'No attempts completed yet.';
      noAttemptsMessage.style.cssText = 'text-align: center; color: #777; margin-top: 15px;';
      content.appendChild(noAttemptsMessage);
    }
    
    const modal = api.ui.components.createModal({
      title: 'Rank Pointer Results',
      width: 400,
      content: content,
      buttons: [
        {
          text: 'Close',
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
        if (header && header.textContent.includes('Rank Pointer Results')) {
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
    runningModal = showRunningAnalysisModal(0, 0, 0, targetRankPoints);
    activeRunningModal = runningModal;
    
    // Run until victory with status updates
    console.log('[Rank Pointer] Starting runUntilVictory, about to await...');
    const results = await runUntilVictory(targetRankPoints, (status) => {
      const progressEl = document.getElementById('rank-pointer-progress');
      if (progressEl) {
        progressEl.textContent = `Attempt ${status.attempts}`;
      }
      
      const targetEl = document.getElementById('rank-pointer-target');
      if (targetEl) {
        if (typeof targetRankPoints === 'number') {
          targetEl.textContent = `Running until S+${targetRankPoints}`;
        } else {
          targetEl.textContent = 'Running until victory...';
        }
      }
      
      // Update defeats display
      const defeatsEl = document.getElementById('rank-pointer-defeats');
      if (defeatsEl && status.defeats !== undefined) {
        defeatsEl.textContent = `Defeats: ${status.defeats}`;
      }
      
      // Update stamina display
      const staminaEl = document.getElementById('rank-pointer-stamina');
      if (staminaEl && status.staminaSpent !== undefined) {
        staminaEl.textContent = `Stamina Spent: ${status.staminaSpent}`;
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
    text: 'Rank Pointer',
    modId: MOD_ID,
    tooltip: 'Run manual mode until victory (restarts on defeat)',
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
  }
};

