// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[Board Analyzer] initializing...');

// Configuration with defaults
const defaultConfig = {
  runs: 20,
  speedupFactor: 1000,
  hideGameBoard: true,
  enableTurboAutomatically: true,
  stopOnSPlus: false,
  stopAfterTicks: 0, // 0 means no limit
  stopWhenTicksReached: 0, // Stop when finding a run with this number of ticks or less
  stopOnAchievement: false // Stop when achievement is completed
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Constants
const MOD_ID = 'board-analyzer';
const BUTTON_ID = `${MOD_ID}-button`;
const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;
const DEFAULT_TICK_INTERVAL_MS = 62.5;

// Timing constants
const ANALYSIS_STOP_DELAY_MS = 200;
const UI_UPDATE_DELAY_MS = 600;
const MODAL_CLEANUP_DELAY_MS = 100;
const BOARD_RESTORE_DELAY_MS = 50;
const TURBO_RESET_DELAY_MS = 25;
const NOTIFICATION_DISPLAY_MS = 3000;
const COPY_FEEDBACK_DELAY_MS = 2000;

// Chart rendering constants
const CHART_BAR_WIDTH = 8;
const CHART_BAR_SPACING = 4;
const CHART_BATCH_SIZE = 10;
const CHART_MIN_HEIGHT = 20;
const CHART_MAX_HEIGHT = 120;
const CHART_MAX_BARS = 1000; // Limit chart to prevent performance issues with large analyses

// Modal constants
const MODAL_TYPES = {
  CONFIG: 'config',
  RUNNING: 'running',
  RESULTS: 'results'
};

// Analysis state constants
const ANALYSIS_STATES = {
  IDLE: 'idle',
  RUNNING: 'running',
  STOPPING: 'stopping',
  ERROR: 'error'
};

// =======================
// 2. Global State & Classes
// =======================

// Global state management for mod coordination
if (!window.__modCoordination) {
  window.__modCoordination = {
    boardAnalyzerRunning: false,
    boardAnalyzerStartTime: null,
    boardAnalyzerEndTime: null
  };
}

// Track active modals to ensure they can be closed properly
let activeRunningModal = null;
let activeConfigPanel = null;

// ModalManager class for proper modal lifecycle management
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
        // Call modal's cleanup function if it exists
        if (typeof modal.cleanup === 'function') {
          modal.cleanup();
        }
        
        if (typeof modal.close === 'function') {
          modal.close();
        } else if (modal.element && typeof modal.element.remove === 'function') {
          modal.element.remove();
        } else if (typeof modal.remove === 'function') {
          modal.remove();
        }
      } catch (e) {
        console.warn('[Board Analyzer] Error closing modal:', e);
      }
      this.activeModals.delete(id);
    }
  }
  
  closeAll() {
    if (this.isClosing) {
      console.warn('Modal manager is already closing modals, skipping recursive call');
      return;
    }
    
    this.isClosing = true;
    try {
      this.activeModals.forEach((modal, id) => {
        try {
          // Call modal's cleanup function if it exists
          if (typeof modal.cleanup === 'function') {
            modal.cleanup();
          }
          
          if (typeof modal.close === 'function') {
            modal.close();
          } else if (modal.element && typeof modal.element.remove === 'function') {
            modal.element.remove();
          } else if (typeof modal.remove === 'function') {
            modal.remove();
          }
        } catch (e) {
          console.warn('[Board Analyzer] Error closing modal in closeAll:', e);
        }
      });
      this.activeModals.clear();
    } finally {
      this.isClosing = false;
    }
  }
  
  closeByType(type) {
    if (this.isClosing) {
      console.warn('Modal manager is already closing modals, skipping recursive call');
      return;
    }
    
    this.isClosing = true;
    try {
      this.activeModals.forEach((modal, id) => {
        try {
          if (modal && modal.type === type) {
            // Call modal's cleanup function if it exists
            if (typeof modal.cleanup === 'function') {
              modal.cleanup();
            }
            
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
          console.warn('[Board Analyzer] Error closing modal by type:', e);
        }
      });
    } finally {
      this.isClosing = false;
    }
  }
}

// Create global modal manager instance
const modalManager = new ModalManager();


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
    this.listeners = new WeakMap(); // Use WeakMap to allow garbage collection of DOM elements
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
    // WeakMap doesn't support iteration, but DOM elements will be garbage collected automatically
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

// ChartRenderer class for efficient chart rendering
class ChartRenderer {
  constructor(container, results, onBarClick) {
    this.container = container;
    
    // Pre-calculate highest rank points once to avoid repeated filtering
    const sPlusResults = results.filter(r => r.grade === 'S+' && r.rankPoints);
    this.highestRankPoints = sPlusResults.length > 0 ? 
      Math.max(...sPlusResults.map(r => r.rankPoints)) : 0;
    
    // Store only minimal data needed for display (not full board data)
    this.displayData = results.map((r, i) => ({
      originalIndex: i,  // Track original run number
      ticks: r.ticks,
      grade: r.grade,
      rankPoints: r.rankPoints,
      completed: r.completed,
      seed: r.seed
    }));
    
    this.fullResultsCount = results.length;
    this.eventManager = new EventManager();
    this.currentSort = 'runs';
    this.onBarClick = onBarClick; // Callback to access full results when needed
  }
  
  // Sample results if there are too many for performance
  sampleResults(results, isSorted = false) {
    if (results.length <= CHART_MAX_BARS) {
      return results;
    }
    
    // For sorted views (time/rank), just take the top results
    if (isSorted) {
      console.log(`[Board Analyzer] Chart: Showing top ${CHART_MAX_BARS} of ${results.length} results`);
      return results.slice(0, CHART_MAX_BARS);
    }
    
    // For "All Runs" view, use smart sampling that includes best runs
    const sampled = new Set();
    
    // Always include top performers by time (completed runs first)
    const sortedByTime = [...results].sort((a, b) => {
      if (a.completed !== b.completed) return b.completed - a.completed;
      return a.ticks - b.ticks;
    });
    const topCount = Math.min(100, Math.floor(CHART_MAX_BARS * 0.1));
    for (let i = 0; i < topCount; i++) {
      sampled.add(sortedByTime[i]);
    }
    
    // Fill remaining with even sampling to maintain overview
    const remaining = CHART_MAX_BARS - sampled.size;
    const step = results.length / remaining;
    for (let i = 0; i < results.length && sampled.size < CHART_MAX_BARS; i += step) {
      sampled.add(results[Math.floor(i)]);
    }
    
    // Convert back to array and restore original order
    const sampledArray = Array.from(sampled).sort((a, b) => a.originalIndex - b.originalIndex);
    
    console.log(`[Board Analyzer] Chart: Showing ${sampledArray.length} of ${results.length} results (top ${topCount} + sampling)`);
    return sampledArray;
  }
  
  render() {
    try {
      // Create chart container
      const chartContainer = document.createElement('div');
      chartContainer.style.cssText = 'margin-top: 20px; border: 1px solid #333; padding: 10px; height: 200px; position: relative; overflow: hidden;';
      
      // Create all chart elements
      const chartClickableNote = document.createElement('div');
      chartClickableNote.textContent = t('mods.boardAnalyzer.chartTipMessage');
      chartClickableNote.style.cssText = 'text-align: center; color: #3498db; margin-bottom: 15px; font-size: 0.9em; font-weight: 500;';
      
      const elementsToAppend = [chartClickableNote];
      
      // Create sorting buttons and scrollable chart area
      this.createSortButtons(chartContainer);
      this.createScrollableChart(chartContainer);
      
      // Batch append all elements to container
      elementsToAppend.push(chartContainer);
      DOMOptimizer.batchAppend(this.container, elementsToAppend);
      
      // Initial render
      this.renderChart();
      
    } catch (error) {
      console.error('Error creating chart:', error);
      this.showChartError();
    }
  }
  
  createSortButtons(container) {
    const sortButtonsContainer = document.createElement('div');
    sortButtonsContainer.style.cssText = 'display: flex; gap: 5px; margin-bottom: 10px; justify-content: center;';
    
    const buttons = [
      { text: t('mods.boardAnalyzer.allRunsButton'), sortType: 'runs' },
      { text: t('mods.boardAnalyzer.sortTimeButton'), sortType: 'time' },
      { text: t('mods.boardAnalyzer.sortRanksButton'), sortType: 'splus' }
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
    
    // Sort results based on current sort type
    const sortedResults = this.getSortedResults();
    
    // Calculate dimensions
    const spacing = CHART_BAR_SPACING;
    const barWidth = CHART_BAR_WIDTH;
    const totalChartWidth = sortedResults.length * (barWidth + spacing) - spacing;
    
    // Update container width
    this.barsContainer.style.width = `${totalChartWidth}px`;
    
    // Find max ticks for scaling
    const maxTicks = Math.max(...sortedResults.map(r => r.ticks));
    
    // Render bars asynchronously to prevent UI blocking
    this.renderBarsAsync(sortedResults, maxTicks, spacing, barWidth);
  }
  
  getSortedResults() {
    let sorted;
    const isSorted = this.currentSort !== 'runs';
    
    switch (this.currentSort) {
      case 'time':
        sorted = [...this.displayData].sort((a, b) => {
          // F runs always go last
          if (a.grade === 'F' && b.grade !== 'F') return 1;
          if (a.grade !== 'F' && b.grade === 'F') return -1;
          // Sort by ticks
          return a.ticks - b.ticks;
        });
        break;
      case 'splus':
        sorted = [...this.displayData].sort((a, b) => {
          // F runs always go last
          if (a.grade === 'F' && b.grade !== 'F') return 1;
          if (a.grade !== 'F' && b.grade === 'F') return -1;
          // Both F runs, sort by ticks
          if (a.grade === 'F' && b.grade === 'F') return a.ticks - b.ticks;
          
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
        break;
      default:
        sorted = [...this.displayData];
    }
    
    // Apply smart sampling (takes top results for sorted views)
    return this.sampleResults(sorted, isSorted);
  }
  
  async renderBarsAsync(sortedResults, maxTicks, spacing, barWidth) {
    const batchSize = CHART_BATCH_SIZE; // Process bars in batches
    
    for (let i = 0; i < sortedResults.length; i += batchSize) {
      const batch = sortedResults.slice(i, i + batchSize);
      
      // Use requestAnimationFrame to prevent UI blocking
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Create document fragment for batch DOM operations
      const fragment = DOMOptimizer.createDocumentFragment();
      
      batch.forEach((result, batchIndex) => {
        const index = i + batchIndex;
        const bar = this.createBar(result, index, maxTicks, spacing, barWidth);
        if (bar) {
          fragment.appendChild(bar);
        }
      });
      
      // Batch append all bars in this batch
      this.barsContainer.appendChild(fragment);
    }
  }
  
  createBar(result, index, maxTicks, spacing, barWidth) {
    try {
      const bar = document.createElement('div');
      const height = Math.max(CHART_MIN_HEIGHT, Math.floor((result.ticks / maxTicks) * CHART_MAX_HEIGHT));
      
      // Determine bar color
      const barColor = this.getBarColor(result);
      
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
      bar.title = this.createTooltipText(result);
      
      // Add click handler
      this.addEventListener(bar, 'click', () => {
        this.handleBarClick(result);
      });
      
      return bar;
      
    } catch (error) {
      console.error(`Error creating bar ${index}:`, error);
      return null;
    }
  }
  
  getBarColor(result) {
    if (result.completed) {
      if (result.grade === 'S+' && result.rankPoints) {
        // Use pre-calculated value instead of filtering every time
        const rankDifference = this.highestRankPoints - result.rankPoints;
        
        switch (rankDifference) {
          case 0: return '#FFD700';
          case 1: return '#FFA500';
          case 2: return '#FF8C00';
          case 3: return '#FF6347';
          case 4: return '#FF4500';
          case 5: return '#FF0000';
          case 6: return '#DC143C';
          case 7: return '#8B0000';
          default: return '#FFD700';
        }
      } else if (result.grade === 'S+') {
        return '#FFD700';
      } else {
        return '#4CAF50';
      }
    } else {
      return '#e74c3c';
    }
  }
  
  createTooltipText(result) {
    let tooltipText = `Run ${result.originalIndex + 1}: ${result.ticks} ticks, Grade: `;
    
    if (result.grade === 'S+' && result.rankPoints) {
      tooltipText += `S+${result.rankPoints}`;
    } else {
      tooltipText += result.grade;
    }
    
    tooltipText += `, ${result.completed ? 'Completed' : 'Failed'}`;
    if (currentFloor !== null && currentFloor !== undefined) {
      tooltipText += `, Floor: ${currentFloor}`;
    }
    if (result.seed) {
      tooltipText += `, Seed: ${result.seed}`;
    }
    tooltipText += `\n${t('mods.boardAnalyzer.clickToCopyReplay')}`;
    
    return tooltipText;
  }
  
  handleBarClick(result) {
    if (this.onBarClick) {
      this.onBarClick(result.originalIndex, result);
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
let currentSeed = null;
let currentRegionId = null;
let currentRoomId = null;
let currentRoomName = null;
let currentFloor = null;
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
  // Configure the proper floor, defaulting to `0`.
  try {
    if (globalThis.state.board.trigger && globalThis.state.board.trigger.setState) {
      globalThis.state.board.trigger.setState({
        fn: (prev) => ({
          ...prev,
          floor: config.floor ?? 0,
        }),
      });
    } else if (globalThis.state.board.send) {
      // Fallback to using send if trigger.setState is not available
      globalThis.state.board.send({
        type: 'setState',
        fn: (prev) => ({
          ...prev,
          floor: config.floor ?? 0,
        }),
      });
    }
  } catch (error) {
    console.warn('Could not set floor:', error);
  }
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

// =======================
// 3. Utility Functions
// =======================

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
  const floor = boardContext.floor;
  const result = {
    region: regionName,
    map: mapName,
    floor: floor,
    board: board,
  };
  return result;
};

// Inject custom CSS for inputs to ensure better readability
function injectCustomStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    #${BUTTON_ID} {
      background: url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat !important;
      background-size: auto !important;
    }
    
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

// Use shared translation system via API
const t = (key) => api.i18n.t(key);

// Sleep function for async operations
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if board has ally creatures (player pieces)
function hasAllyCreaturesOnBoard() {
  try {
    const boardContext = globalThis.state?.board?.getSnapshot()?.context;
    if (!boardContext || !boardContext.boardConfig || !Array.isArray(boardContext.boardConfig)) {
      return false;
    }
    // Player pieces are type 'player' or 'custom' with villain: false
    const isAlly = (piece) => (piece?.type === 'player') || (piece?.type === 'custom' && piece?.villain === false);
    return boardContext.boardConfig.some(isAlly);
  } catch (error) {
    console.warn('[Board Analyzer] Error checking for ally creatures:', error);
    return false;
  }
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

// Function to properly restore the board state
function restoreBoardState() {
  try {
    console.log('Restoring board state...');
    
    // Reset global coordination state to allow other mods to resume
    if (window.__modCoordination) {
      window.__modCoordination.boardAnalyzerRunning = false;
      window.__modCoordination.boardAnalyzerEndTime = Date.now();
      console.log('[Board Analyzer] Analysis finished - other mods can resume');
      
      // Small delay to ensure other mods detect the state change
      setTimeout(() => {
        // Force a small state change to trigger any watchers
        window.__modCoordination.boardAnalyzerRunning = false;
      }, TURBO_RESET_DELAY_MS);
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
    
    // Restore Better Highscores container if it exists
    if (window.BetterHighscores && typeof window.BetterHighscores.restoreContainer === 'function') {
      try {
        console.log('[Board Analyzer] Restoring Better Highscores container...');
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          window.BetterHighscores.restoreContainer();
        }, BOARD_RESTORE_DELAY_MS);
      } catch (error) {
        console.warn('[Board Analyzer] Error restoring Better Highscores container:', error);
      }
    }
    
    // Restore the original map that was active before analysis
    if (currentRoomId) {
      try {
        globalThis.state.board.send({
          type: 'selectRoomById',
          roomId: currentRoomId,
        });
        console.log('[Board Analyzer] Restored original map:', currentRoomId);
        
        // Also restore the original board configuration if we have it
        if (boardSetup && boardSetup.length > 0) {
          console.log('[Board Analyzer] Restoring original board configuration with', boardSetup.length, 'pieces');
          console.log('[Board Analyzer] Board setup to restore:', boardSetup);
          
          // Small delay to ensure map is loaded before setting board
          setTimeout(() => {
            try {
              // Set the board configuration back to what it was before analysis
              globalThis.state.board.send({
                type: "setState",
                fn: prevState => ({
                  ...prevState,
                  boardConfig: boardSetup
                })
              });
              console.log('[Board Analyzer] Original board configuration restored');
              
              // Verify the restoration worked
              setTimeout(() => {
                try {
                  const restoredContext = globalThis.state.board.getSnapshot().context;
                  if (restoredContext.boardConfig && restoredContext.boardConfig.length > 0) {
                    console.log('[Board Analyzer] Verification: Board now has', restoredContext.boardConfig.length, 'pieces');
                  } else {
                    console.warn('[Board Analyzer] Verification: Board restoration may have failed');
                  }
                } catch (verifyError) {
                  console.warn('[Board Analyzer] Error verifying board restoration:', verifyError);
                }
              }, BOARD_RESTORE_DELAY_MS);
            } catch (error) {
              console.warn('[Board Analyzer] Error restoring board configuration:', error);
            }
          }, BOARD_RESTORE_DELAY_MS); // Reduced delay for faster restoration
        } else {
          console.log('[Board Analyzer] No board configuration to restore');
        }
      } catch (error) {
        console.warn('[Board Analyzer] Error restoring original map:', error);
      }
    }
    
    console.log('Board state restored successfully');
  } catch (error) {
    console.error('Error restoring board state:', error);
  }
}

// Shared game state tracker to avoid multiple subscriptions
let gameStateTracker = null;
let currentGameState = null;

// =======================
// 4. Game State Management
// =======================

// Achievement detection function
function didAchievement(world) {
  console.log('[Achievement Debug] Checking achievement conditions...');
  
  // Track what we find
  let foundGrynchBarrel = false;
  let foundGrynchGoblin = false;
  let grynchBarrelAlive = false;
  let grynchGoblinHit = false;
  
  for (const actor of world.grid.actors) {
    if (!actor.villain) continue;
    
    // Check for grynch barrel
    if (actor.tags.has("grynchBarrel")) {
      foundGrynchBarrel = true;
      grynchBarrelAlive = actor.hp.isAlive;
      console.log(`[Achievement Debug] Found grynchBarrel - isAlive: ${actor.hp.isAlive}`);
      if (!actor.hp.isAlive) {
        console.log('[Achievement Debug] ❌ grynchBarrel is dead! Achievement failed.');
        return false;
      }
    }
    
    // Check for grynch goblin gumslinger
    if (!actor.tags.has("grynchGoblinGumslinger")) continue;
    
    foundGrynchGoblin = true;
    grynchGoblinHit = actor.tags.has("hitByWaterElementalBall");
    console.log(`[Achievement Debug] Found grynchGoblinGumslinger - hitByWaterElementalBall: ${grynchGoblinHit}`);
    
    if (!actor.tags.has("hitByWaterElementalBall")) {
      console.log('[Achievement Debug] ❌ grynchGoblinGumslinger was NOT hit by water elemental ball! Achievement failed.');
      return false;
    }
  }
  
  console.log('[Achievement Debug] Summary:');
  console.log(`  - Found grynchBarrel: ${foundGrynchBarrel} (alive: ${grynchBarrelAlive})`);
  console.log(`  - Found grynchGoblinGumslinger: ${foundGrynchGoblin} (hit: ${grynchGoblinHit})`);
  console.log(`[Achievement Debug] ✅ Achievement conditions met!`);
  
  return true;
}

// Simple board data storage - serialize once, store, reuse
let currentBoardData = null;

function getBoardData(seed = null) {
  if (!currentBoardData) {
    try {
      if (typeof window.$serializeBoard === 'function') {
        currentBoardData = JSON.parse(window.$serializeBoard());
      } else if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.serializeBoard) {
        currentBoardData = JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
      } else {
        currentBoardData = serializeBoard();
      }
    } catch (error) {
      console.error('Error serializing board:', error);
      return null;
    }
  }
  
  // Return a copy with seed if provided
  if (seed) {
    return { ...currentBoardData, seed };
  }
  return { ...currentBoardData };
}

// Optimized statistics calculator to avoid repeated array operations
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
    this.minDefeatTicks = Infinity;
    this.maxDefeatTicks = 0;
    this.ticksSum = 0;
    this.ticksArray = [];
    this.runTimes = [];
    this.runTimesSum = 0;
    this.achievementCount = 0;
  }
  
  addRun(result, runTime) {
    this.totalRuns++;
    this.runTimes.push(runTime);
    this.runTimesSum += runTime;
    
    // Include all runs in time statistics (both completed and failed)
    this.ticksArray.push(result.ticks);
    this.ticksSum += result.ticks;
    
    // Track achievement completions
    if (result.achievementCompleted) {
      this.achievementCount++;
    }
    
    // Update min/max ticks for completed runs
    if (result.completed) {
      this.completedRuns++;
      
      if (result.ticks < this.minTicks) {
        this.minTicks = result.ticks;
      }
      if (result.ticks > this.maxTicks) {
        this.maxTicks = result.ticks;
      }
    } else {
      // Update min/max ticks for failed runs
      if (result.ticks < this.minDefeatTicks) {
        this.minDefeatTicks = result.ticks;
      }
      if (result.ticks > this.maxDefeatTicks) {
        this.maxDefeatTicks = result.ticks;
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
    const achievementRate = this.totalRuns > 0 ? (this.achievementCount / this.totalRuns * 100).toFixed(2) : '0.00';
    const averageRunTime = this.runTimes.length > 0 ? this.runTimesSum / this.runTimes.length : 0;
    const averageTicks = this.totalRuns > 0 ? this.ticksSum / this.totalRuns : 0;
    const medianTicks = this.calculateMedian(this.ticksArray);
    
    return {
      totalRuns: this.totalRuns,
      completedRuns: this.completedRuns,
      sPlusCount: this.sPlusCount,
      sPlusMaxPointsCount: this.sPlusMaxPointsCount,
      achievementCount: this.achievementCount,
      sPlusRate,
      completionRate,
      achievementRate,
      minTicks: isFinite(this.minTicks) ? this.minTicks : 0,
      maxTicks: this.maxTicks,
      minDefeatTicks: isFinite(this.minDefeatTicks) ? this.minDefeatTicks : 0,
      maxDefeatTicks: this.maxDefeatTicks,
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
    
    // Check if this analysis instance is still valid
    if (analysisId && !analysisState.isValidId(analysisId)) {
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
    
    // Check for force stop immediately
    if (analysisState.forceStop) {
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
    
    // Achievement detection will happen when the game naturally ends (in the state check)
    // We need to capture the world reference while the game is running
    let capturedWorld = null;
    let newGameSubscription = null;
    
    if (config.stopOnAchievement) {
      console.log('[Board Analyzer] Achievement detection ENABLED - subscribing to newGame to capture world');
      
      // Subscribe to newGame event to capture world immediately when game starts
      newGameSubscription = globalThis.state.board.on('newGame', (event) => {
        if (event.world) {
          capturedWorld = event.world;
          console.log('[Board Analyzer] ✅ Captured world reference from newGame event');
          // Unsubscribe after capturing
          if (newGameSubscription) {
            newGameSubscription.unsubscribe();
            newGameSubscription = null;
          }
        }
      });
    }
    
    // Use shared game state tracker instead of creating new subscription
    const tracker = getGameStateTracker();
    
    const listener = (context) => {
      const { currentTick, state, readableGrade, rankPoints } = context;
      
      // Check if this analysis instance is still valid
      if (analysisId && !analysisState.isValidId(analysisId) && !hasResolved) {
        console.log('[Board Analyzer] Analysis instance changed during game - stopping immediately');
        hasResolved = true;
        if (unsubscribe) unsubscribe();
        if (newGameSubscription) newGameSubscription.unsubscribe();
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
      
      // Check if analysis state was reset (stop button was clicked)
      if (!analysisState.isRunning() && !hasResolved) {
        console.log('[Board Analyzer] Analysis state reset during game - stopping immediately');
        hasResolved = true;
        if (unsubscribe) unsubscribe();
        if (newGameSubscription) newGameSubscription.unsubscribe();
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
      
      // Check for force stop on every timer update
      if (analysisState.forceStop && !hasResolved) {
        console.log('Force stop detected during game - stopping immediately');
        hasResolved = true;
        if (unsubscribe) unsubscribe();
        if (newGameSubscription) newGameSubscription.unsubscribe();
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
          console.log(`[Board Analyzer] Game ended with state: "${state}"`);
          hasResolved = true;
          if (unsubscribe) unsubscribe();
          if (newGameSubscription) newGameSubscription.unsubscribe();
          
          // Check for achievement completion if enabled
          let achievementCompleted = false;
          if (config.stopOnAchievement) {
            console.log(`[Board Analyzer] Achievement detection enabled, state is "${state}", checking achievement...`);
            try {
              if (capturedWorld) {
                console.log('[Board Analyzer] Checking achievement at game end using captured world...');
                achievementCompleted = didAchievement(capturedWorld);
                console.log(`[Board Analyzer] Achievement check result: ${achievementCompleted}`);
              } else {
                console.warn('[Board Analyzer] No world was captured during game - cannot check achievement');
              }
            } catch (e) {
              console.warn('[Board Analyzer] Error checking achievement:', e);
            }
          }
          
          resolve({
            ticks: currentTick,
            grade: readableGrade,
            rankPoints: rankPoints,
            completed: state === 'victory',
            achievementCompleted: achievementCompleted
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
          if (newGameSubscription) newGameSubscription.unsubscribe();
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
          if (newGameSubscription) newGameSubscription.unsubscribe();
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


// =======================
// 6. Analysis Engine
// =======================

// Helper function to initialize analysis
function initializeAnalysis() {
  // Prevent multiple analyses from running simultaneously
  if (!analysisState.canStart()) {
    console.log('[Board Analyzer] Analysis already running, stopping previous analysis first');
    analysisState.stop();
    return false;
  }
  
  // Set analysis state
  const thisAnalysisId = analysisState.start();
  
  
  return thisAnalysisId;
}

// Helper function to setup analysis environment
function setupAnalysisEnvironment() {
  // Set global state to indicate Board Analyzer is running
  window.__modCoordination.boardAnalyzerRunning = true;
  window.__modCoordination.boardAnalyzerStartTime = Date.now();
  window.__modCoordination.boardAnalyzerEndTime = null;
  
  console.log('[Board Analyzer] Analysis started - other mods should pause');
  
  // Disable Turbo Mode button during analysis
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
  currentFloor = null;
  boardSetup = [];
}

// Helper function to capture current board state
function captureCurrentBoardState() {
  try {
    const boardContext = globalThis.state.board.getSnapshot().context;
    if (boardContext.boardConfig && Array.isArray(boardContext.boardConfig)) {
      // Deep clone the board configuration to preserve it
      boardSetup = JSON.parse(JSON.stringify(boardContext.boardConfig));
      console.log('[Board Analyzer] Captured board configuration with', boardSetup.length, 'pieces');
    } else {
      console.log('[Board Analyzer] No board configuration found to capture');
    }
  } catch (error) {
    console.warn('[Board Analyzer] Error capturing board configuration:', error);
  }
}

// Helper function to preserve Better Highscores container
function preserveBetterHighscores() {
  if (window.BetterHighscores && typeof window.BetterHighscores.preserveContainer === 'function') {
    try {
      console.log('[Board Analyzer] Preserving Better Highscores container...');
      window.BetterHighscores.preserveContainer();
    } catch (error) {
      console.warn('[Board Analyzer] Error preserving Better Highscores container:', error);
    }
  }
}

// Helper function to hide game board if configured
function hideGameBoardIfConfigured() {
  const gameFrame = document.querySelector('main .frame-4');
  if (config.hideGameBoard && gameFrame) {
    gameFrame.style.display = 'none';
  }
}

// Helper function to capture map information
function captureMapInformation() {
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
    
    // Capture floor information
    if (typeof boardContext.floor !== 'undefined') {
      currentFloor = boardContext.floor;
      console.log('Captured floor:', currentFloor);
    }
  } catch (error) {
    console.error('Error capturing map information:', error);
  }
}

// Helper function to run a single analysis run
async function runSingleAnalysis(i, thisAnalysisId, statusCallback, statsCalculator) {
  // Check if this analysis instance is still valid
  if (!analysisState.isValidId(thisAnalysisId)) {
    console.log('[Board Analyzer] Analysis instance changed, stopping this run');
    return null;
  }
  
  // Check if analysis state was reset (stop button was clicked)
  if (!analysisState.isRunning()) {
    console.log('[Board Analyzer] Analysis state reset, stopping this run');
    return null;
  }
  
  // Start timing this run
  const lastRunStart = performance.now();
  
  // Check if forced stop was requested
  if (analysisState.forceStop) {
    console.log('Analysis stopped by user - breaking out of loop');
    return null;
  }
  
  // Update status callback if provided
  if (statusCallback && statsCalculator.runTimes.length > 0) {
    const avgRunTime = statsCalculator.runTimesSum / statsCalculator.runTimes.length;
    const remainingRuns = config.runs - i + 1;
    const estimatedTimeRemaining = avgRunTime * remainingRuns;
    
    statusCallback({
      current: i,
      total: config.runs,
      status: 'running',
      avgRunTime: avgRunTime.toFixed(0),
      estimatedTimeRemaining: formatMilliseconds(estimatedTimeRemaining)
    });
  } else if (statusCallback) {
    statusCallback({
      current: i,
      total: config.runs,
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
    
    // Check if this run was force stopped, analysis changed, or analysis reset
    if (result.forceStopped || result.analysisChanged || result.analysisReset) {
      console.log('Run was force stopped, analysis changed, or analysis reset - breaking out of analysis loop');
      return null;
    }
    
    // Add seed to result
    result.seed = runSeed;
    
    const { ticks, grade, rankPoints, completed } = result;
    
    // Use statistics calculator to track stats efficiently
    const runTime = performance.now() - lastRunStart;
    statsCalculator.addRun(result, runTime);
    
    // Stop the game using direct state manipulation
    globalThis.state.board.send({
      type: "setState",
      fn: prevState => ({
        ...prevState,
        gameStarted: false
      })
    });
    
    return result;
    
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
    return null;
  }
}

// Helper function to initialize analysis environment
function initializeAnalysisEnvironment() {
  // Set global state to indicate Board Analyzer is running
  window.__modCoordination.boardAnalyzerRunning = true;
  window.__modCoordination.boardAnalyzerStartTime = Date.now();
  window.__modCoordination.boardAnalyzerEndTime = null;
  
  console.log('[Board Analyzer] Analysis started - other mods should pause');
  
  // Reset board data for fresh analysis
  currentBoardData = null;
  
  // Disable Turbo Mode button during analysis
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
  currentFloor = null;
  boardSetup = [];
}

// Helper function to setup analysis state
function setupAnalysisState() {
  // Use optimized statistics calculator
  const statsCalculator = new StatisticsCalculator();
  
  // Variables to store best runs
  const bestRuns = {
    bestTimeRun: null,
    bestScoreRun: null,
    targetTicksRun: null,
    achievementRun: null
  };
  
  // Timing variables
  const timing = {
    startTime: performance.now(),
    lastRunStart: 0
  };
  
  return { statsCalculator, bestRuns, timing };
}

// Helper function to prepare analysis environment
async function prepareAnalysisEnvironment() {
  // Ensure sandbox mode
  const modeSwitched = ensureSandboxMode();
  
  // Capture the current board configuration before starting analysis
  captureCurrentBoardState();
  
  // Preserve Better Highscores container before hiding game board
  preserveBetterHighscores();
  
  // Hide the game board if configured
  hideGameBoardIfConfigured();

  // If we just switched to sandbox mode, ensure UI is updated
  if (modeSwitched) {
    await sleep(100);
  }
  
  // Enable turbo mode if configured - do this before starting games
  if (config.enableTurboAutomatically) {
    enableTurbo(config.speedupFactor);
  }

  // Capture current map information
  captureMapInformation();
  
  return modeSwitched;
}

// Helper function to capture current board state
function captureCurrentBoardState() {
  try {
    const boardContext = globalThis.state.board.getSnapshot().context;
    if (boardContext.boardConfig && Array.isArray(boardContext.boardConfig)) {
      // Deep clone the board configuration to preserve it
      boardSetup = JSON.parse(JSON.stringify(boardContext.boardConfig));
      console.log('[Board Analyzer] Captured board configuration with', boardSetup.length, 'pieces');
    } else {
      console.log('[Board Analyzer] No board configuration found to capture');
    }
  } catch (error) {
    console.warn('[Board Analyzer] Error capturing board configuration:', error);
  }
}

// Helper function to preserve Better Highscores container
function preserveBetterHighscores() {
  if (window.BetterHighscores && typeof window.BetterHighscores.preserveContainer === 'function') {
    try {
      console.log('[Board Analyzer] Preserving Better Highscores container...');
      window.BetterHighscores.preserveContainer();
    } catch (error) {
      console.warn('[Board Analyzer] Error preserving Better Highscores container:', error);
    }
  }
}

// Helper function to hide game board if configured
function hideGameBoardIfConfigured() {
  const gameFrame = document.querySelector('main .frame-4');
  if (config.hideGameBoard && gameFrame) {
    gameFrame.style.display = 'none';
  }
}

// Helper function to capture map information
function captureMapInformation() {
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
    
    // Capture floor information
    if (typeof boardContext.floor !== 'undefined') {
      currentFloor = boardContext.floor;
      console.log('Captured floor:', currentFloor);
    }
  } catch (error) {
    console.error('Error capturing map information:', error);
  }
}

// Helper function to run the main analysis loop
async function runAnalysisLoop(runs, thisAnalysisId, statsCalculator, bestRuns, timing, statusCallback) {
  const results = [];
  
  for (let i = 1; i <= runs; i++) {
    // Check if analysis should continue
    if (!shouldContinueAnalysis(thisAnalysisId)) {
      break;
    }
    
    // Start timing this run
    timing.lastRunStart = performance.now();
    
    // Update status callback if provided
    updateStatusCallback(i, runs, statsCalculator, statusCallback);
    
    // Process individual run
    const runResult = await processSingleRun(i, thisAnalysisId, statsCalculator, bestRuns, timing);
    
    if (runResult === null) {
      // Analysis was stopped
      break;
    }
    
    // Handle both regular results and stop-triggering results
    if (typeof runResult === 'object' && runResult.shouldStop) {
      // This run triggered the stop condition, but we still want to include it
      results.push(runResult.result);
      break; // Stop the analysis
    } else {
      // Regular run result
      results.push(runResult);
    }
  }
  
  return results;
}

// Helper function to check if analysis should continue
function shouldContinueAnalysis(thisAnalysisId) {
  // Check if this analysis instance is still valid
  if (!analysisState.isValidId(thisAnalysisId)) {
    console.log('[Board Analyzer] Analysis instance changed, stopping this run');
    return false;
  }
  
  // Check if analysis state was reset (stop button was clicked)
  if (!analysisState.isRunning()) {
    console.log('[Board Analyzer] Analysis state reset, stopping this run');
    return false;
  }
  
  // Check if forced stop was requested
  if (analysisState.forceStop) {
    console.log('Analysis stopped by user - breaking out of loop');
    return false;
  }
  
  return true;
}

// Helper function to update status callback
function updateStatusCallback(currentRun, totalRuns, statsCalculator, statusCallback) {
  if (!statusCallback) return;
  
  if (statsCalculator.runTimes.length > 0) {
    // Calculate average run time and estimated time remaining
    const avgRunTime = statsCalculator.runTimesSum / statsCalculator.runTimes.length;
    const remainingRuns = totalRuns - currentRun + 1;
    const estimatedTimeRemaining = avgRunTime * remainingRuns;
    
    statusCallback({
      current: currentRun,
      total: totalRuns,
      status: 'running',
      avgRunTime: avgRunTime.toFixed(0),
      estimatedTimeRemaining: formatMilliseconds(estimatedTimeRemaining)
    });
  } else {
    statusCallback({
      current: currentRun,
      total: totalRuns,
      status: 'running'
    });
  }
}

// Helper function to process a single analysis run
async function processSingleRun(runIndex, thisAnalysisId, statsCalculator, bestRuns, timing) {
  // Generate a new unique seed for this run
  const runSeed = Math.floor((Date.now() * Math.random()) % 2147483647);
  
  // Only log every 100th run to avoid console spam on large analyses
  if (runIndex % 100 === 0 || runIndex === 1) {
    console.log(`Run ${runIndex} using generated seed: ${runSeed}`);
  }
  
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
    
    // Check if this run was force stopped, analysis changed, or analysis reset
    if (result.forceStopped || result.analysisChanged || result.analysisReset) {
      console.log('Run was force stopped, analysis changed, or analysis reset - breaking out of analysis loop');
      return null;
    }
    
    // Add seed to result
    result.seed = runSeed;
    
    const { ticks, grade, rankPoints, completed } = result;
    
    // Use statistics calculator to track stats efficiently
    const runTime = performance.now() - timing.lastRunStart;
    statsCalculator.addRun(result, runTime);
    
    // Log if achievement was completed
    if (result.achievementCompleted) {
      console.log(`🏆 Run ${runIndex}: Achievement completed! (${result.ticks} ticks, ${result.grade})`);
    }
    
    // Process run results and update best runs
    const shouldStop = processRunResults(result, runIndex, statsCalculator, bestRuns);
    
    // Stop the game using direct state manipulation
    globalThis.state.board.send({
      type: "setState",
      fn: prevState => ({
        ...prevState,
        gameStarted: false
      })
    });
    
    if (shouldStop) {
      return { result, shouldStop: true }; // Return both result and stop signal
    }
    
    return result;
    
  } catch (runError) {
    console.error(`Error in run ${runIndex}:`, runError);
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
    return null;
  }
}

// Helper function to process run results and update best runs
function processRunResults(result, runIndex, statsCalculator, bestRuns) {
  const { ticks, grade, rankPoints, completed, seed } = result;
  
  if (completed) {
    // Update min ticks if this is a completed run with lower ticks
    if (ticks < statsCalculator.minTicks) {
      const boardData = getBoardData(seed);
      
      if (boardData) {
        console.log('Best time: Using board data');
        bestRuns.bestTimeRun = {
          seed: seed,
          board: boardData
        };
        console.log(`New best time: ${ticks} ticks with seed ${seed} in run ${runIndex}`);
      } else {
        console.warn('Failed to get board data for best time replay');
      }
    }
  }
  
  if (grade === 'S+') {
    // If stopOnSPlus is enabled, we might want to exit early
    if (config.stopOnSPlus) {
      console.log('Achieved S+ grade, stopping analysis early');
      return true; // Signal to stop
    }
  }
  
  // Check if achievement was completed and stopOnAchievement is enabled
  if (result.achievementCompleted && config.stopOnAchievement) {
    console.log('🏆 Achievement completed, stopping ALL subsequent runs');
    
    // Save the achievement run for replay
    const boardData = getBoardData(seed);
    
    if (boardData) {
      console.log('🏆 Achievement run: Saving board data for replay');
      bestRuns.achievementRun = {
        seed: seed,
        board: boardData,
        ticks: ticks,
        grade: grade,
        rankPoints: rankPoints
      };
      console.log(`🏆 Achievement run captured: ${ticks} ticks with seed ${seed} in run ${runIndex}`);
    } else {
      console.warn('Failed to get board data for achievement replay');
    }
    
    return true; // Signal to stop ALL subsequent runs
  }
  
  // Check if should stop for reaching the desired number of ticks or below
  if (config.stopWhenTicksReached > 0 && completed && ticks <= config.stopWhenTicksReached) {
    console.log(`Reached target ticks: ${ticks} <= ${config.stopWhenTicksReached}, stopping analysis`);
    
    const boardData = getBoardData(seed);
    
    if (boardData) {
      console.log('Target ticks: Using board data');
      bestRuns.targetTicksRun = {
        seed: seed,
        board: boardData,
        ticks: ticks,
        grade: grade,
        rankPoints: rankPoints
      };
      console.log(`Target ticks run captured: ${ticks} ticks with seed ${seed}`);
    } else {
      console.warn('Failed to get board data for target ticks replay');
    }
    
    return true; // Signal to stop
  }
  
  // Update max rank points
  if (rankPoints > statsCalculator.maxRankPoints) {
    const boardData = getBoardData(seed);
    
    if (boardData) {
      console.log('Max points: Using board data');
      bestRuns.bestScoreRun = {
        seed: seed,
        board: boardData
      };
      console.log(`New max points: ${rankPoints} with seed ${seed} in run ${runIndex}`);
    } else {
      console.warn('Failed to get board data for max points replay');
    }
  }
  
  return false; // Continue analysis
}

// Helper function to cleanup analysis resources
function cleanupAnalysisResources(thisAnalysisId) {
  // Use the proper board restoration function (includes global state reset)
  restoreBoardState();
  
  // Disable turbo mode if it was enabled
  if (config.enableTurboAutomatically && turboActive) {
    disableTurbo();
  }
  
  // Reset analysis state
  if (analysisState.isValidId(thisAnalysisId)) {
    analysisState.reset();
    console.log('[Board Analyzer] Analysis state reset');
  }
  
  // Clean up game state tracker if no more listeners
  if (gameStateTracker && gameStateTracker.listeners.size === 0) {
    gameStateTracker.stopSubscription();
    gameStateTracker = null;
    console.log('[Board Analyzer] Game state tracker cleaned up');
  }
  
  // Reset board data
  currentBoardData = null;
  console.log('[Board Analyzer] Board data reset');
  
  // Re-enable Turbo Mode button after analysis
  if (window.turboButton) {
    window.turboButton.disabled = false;
    window.turboButton.title = '';
    console.log('[Board Analyzer] Turbo Mode button re-enabled');
  }
  
  // Also restore Turbo Mode button text and style if it was modified
  if (window.turboButton && window.__turboState) {
    // Only restore if turbo is actually inactive (not re-enabled by user)
    if (!window.__turboState.active) {
      window.turboButton.textContent = 'Enable Turbo';
      window.turboButton.style.background = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat";
      window.turboButton.style.color = "#ffe066";
      console.log('[Board Analyzer] Turbo Mode button style restored');
    }
  }
}

// Main analyze function - refactored to use helper functions
async function analyzeBoard(runs = config.runs, statusCallback = null) {
  // Initialize analysis
  const thisAnalysisId = initializeAnalysis();
  if (!thisAnalysisId) {
    await sleep(ANALYSIS_STOP_DELAY_MS);
    return null;
  }
  
  try {
    // Initialize analysis environment
    initializeAnalysisEnvironment();
    
    // Setup analysis state
    const { statsCalculator, bestRuns, timing } = setupAnalysisState();
    
    // Prepare analysis environment
    const modeSwitched = await prepareAnalysisEnvironment();
    
    // Run the main analysis loop
    const results = await runAnalysisLoop(runs, thisAnalysisId, statsCalculator, bestRuns, timing, statusCallback);
    
    // Calculate final statistics
    const totalTime = performance.now() - timing.startTime;
    const stats = statsCalculator.calculateStatistics();
    
    return {
      results,
      summary: {
        runs,
        totalRuns: stats.totalRuns,
        completedRuns: stats.completedRuns,
        sPlusCount: stats.sPlusCount,
        sPlusMaxPointsCount: stats.sPlusMaxPointsCount,
        achievementCount: stats.achievementCount,
        sPlusRate: stats.sPlusRate,
        completionRate: stats.completionRate,
        achievementRate: stats.achievementRate,
        minTicks: stats.minTicks,
        maxTicks: stats.maxTicks,
        minDefeatTicks: stats.minDefeatTicks,
        maxDefeatTicks: stats.maxDefeatTicks,
        medianTicks: stats.medianTicks,
        averageTicks: stats.averageTicks,
        maxRankPoints: stats.maxRankPoints,
        forceStopped: analysisState.forceStop,
        modeSwitched,
        bestTimeResult: bestRuns.bestTimeRun,
        maxPointsResult: bestRuns.bestScoreRun,
        targetTicksResult: bestRuns.targetTicksRun,
        achievementResult: bestRuns.achievementRun,
        // Timing stats
        totalTimeMs: totalTime,
        totalTimeFormatted: formatMilliseconds(totalTime),
        averageRunTimeMs: stats.averageRunTime,
        averageRunTimeFormatted: formatMilliseconds(stats.averageRunTime),
        fastestRunTimeMs: stats.fastestRunTime,
        slowestRunTimeMs: stats.slowestRunTime
      }
    };
    
  } catch (error) {
    console.error('[Board Analyzer] Error during analysis execution:', error);
    throw error;
  } finally {
    // Cleanup analysis resources
    cleanupAnalysisResources(thisAnalysisId);
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

// Create replay data in the required format
function createReplayData(seed = null) {
  try {
    // Get board data
    const boardData = getBoardData(seed);
    
    if (!boardData) {
      console.error('Failed to get board data');
      return null;
    }
    
    console.log('Used board data for replay data');
    
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
  button.textContent = t('mods.boardAnalyzer.copyReplayButton');
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
      button.textContent = t('mods.boardAnalyzer.replayCopiedMessage');
      button.style.backgroundColor = '#2ecc71';
      setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = '#3498db';
      }, 2000);
    }
  });
  
  return button;
}

// =======================
// 5. UI Management
// =======================

// Create the configuration panel UI
function createConfigPanel(startAnalysisCallback) {
  const content = document.createElement('div');
  content.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

  // Runs input
  const runsContainer = document.createElement('div');
  runsContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
  
  const runsLabel = document.createElement('label');
  runsLabel.textContent = t('mods.boardAnalyzer.runsLabel');
  
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
  speedLabel.textContent = t('mods.boardAnalyzer.speedFactorLabel');
  
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
  hideLabel.textContent = t('mods.boardAnalyzer.hideGameBoardLabel');
  
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
  turboLabel.textContent = t('mods.boardAnalyzer.autoTurboLabel');
  
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
  stopSPlusLabel.textContent = t('mods.boardAnalyzer.stopOnSPlusLabel');
  
  stopSPlusContainer.appendChild(stopSPlusInput);
  stopSPlusContainer.appendChild(stopSPlusLabel);
  content.appendChild(stopSPlusContainer);

  // Stop on Achievement checkbox
  const stopAchievementContainer = document.createElement('div');
  stopAchievementContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  
  const stopAchievementInput = document.createElement('input');
  stopAchievementInput.type = 'checkbox';
  stopAchievementInput.id = 'stop-achievement-input';
  stopAchievementInput.checked = config.stopOnAchievement;
  
  const stopAchievementLabel = document.createElement('label');
  stopAchievementLabel.htmlFor = 'stop-achievement-input';
  stopAchievementLabel.textContent = t('mods.boardAnalyzer.stopOnAchievementLabel');
  
  stopAchievementContainer.appendChild(stopAchievementInput);
  stopAchievementContainer.appendChild(stopAchievementLabel);
  content.appendChild(stopAchievementContainer);

  // Stop after ticks input
  const stopTicksContainer = document.createElement('div');
  stopTicksContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
  
  const stopTicksLabel = document.createElement('label');
  stopTicksLabel.textContent = t('mods.boardAnalyzer.stopAfterTicksLabel');
  
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
  stopWhenTicksLabel.textContent = t('mods.boardAnalyzer.stopWhenTicksReachedLabel');

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

  // Warning if no ally creatures on board (parity with Manual Runner)
  const hasAlly = hasAllyCreaturesOnBoard();
  if (!hasAlly) {
    const warningMsg = document.createElement('div');
    warningMsg.textContent = t('mods.boardAnalyzer.noAllyWarning');
    warningMsg.style.cssText = 'color: #e74c3c; margin-top: 8px; padding: 8px; background-color: rgba(231, 76, 60, 0.1); border-radius: 4px; font-size: 0.9em;';
    content.appendChild(warningMsg);
  }

  // Create buttons array
  const buttons = [
    {
      text: t('mods.boardAnalyzer.startAnalysisButton'),
      primary: true,
      onClick: () => {
        // Prevent starting if there are no ally creatures on board
        if (!hasAllyCreaturesOnBoard()) {
          api.ui.components.createModal({
            title: 'Cannot Start',
            content: 'Please place at least one ally creature on the board before starting.',
            buttons: [{ text: 'OK', primary: true }]
          });
          return;
        }
        // Check if analysis is already running
        if (!analysisState.canStart()) {
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
      text: t('mods.boardAnalyzer.saveButton'),
      primary: false,
      onClick: () => {
        // Just update and save configuration
        updateConfig();
      }
    },
    {
      text: t('mods.boardAnalyzer.cancelButton'),
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
    config.stopOnAchievement = document.getElementById('stop-achievement-input').checked;
    config.stopAfterTicks = parseInt(document.getElementById('stop-ticks-input').value, 10);
    config.stopWhenTicksReached = parseInt(document.getElementById('stop-when-ticks-input').value, 10);
    
    // Save configuration
    api.service.updateScriptConfig(context.hash, config);
  }

  // Create and return the config panel
  const panel = api.ui.createConfigPanel({
    id: CONFIG_PANEL_ID,
    title: t('mods.boardAnalyzer.configTitle'),
    modId: MOD_ID,
    content: content,
    buttons: buttons
  });
  
  // Register config panel with modal manager
  panel.type = MODAL_TYPES.CONFIG;
  modalManager.register('config-panel', panel);
  
  // If no ally creatures, disable the Start button in the panel UI as well
  if (!hasAlly) {
    setTimeout(() => {
      try {
        const startText = t('mods.boardAnalyzer.startAnalysisButton');
        const btns = panel?.element ? panel.element.querySelectorAll('button') : document.querySelectorAll('button');
        for (const btn of btns) {
          if (btn.textContent === startText) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            break;
          }
        }
      } catch (_) {}
    }, 50);
  }

  activeConfigPanel = panel;
  return panel;
}

// Add a global function to forcefully close all analysis modals
function forceCloseAllModals() {
  console.log("Closing all registered modals...");
  modalManager.closeAll();
}

// Helper function to close running modal specifically
function closeRunningModal() {
  try {
    modalManager.close('running-modal');
    activeRunningModal = null;
    console.log('[Board Analyzer] Running modal closed successfully');
  } catch (error) {
    console.warn('[Board Analyzer] Error closing running modal:', error);
  }
}

// Call this function when starting a new analysis
function showRunningAnalysisModal(currentRun, totalRuns, avgRunTime = null, estimatedTimeRemaining = null) {
  // First, force close any existing modals
  forceCloseAllModals();
  
  const content = document.createElement('div');
  content.style.cssText = 'text-align: center;';
  
  const message = document.createElement('p');
  message.textContent = t('mods.boardAnalyzer.runningText');
  content.appendChild(message);
  
  const progress = document.createElement('p');
  progress.id = 'analysis-progress';
  progress.textContent = t('mods.boardAnalyzer.progressText')
    .replace('{current}', currentRun)
    .replace('{total}', totalRuns);
  progress.style.cssText = 'margin-top: 12px;';
  content.appendChild(progress);
  
  // Add timing information if available
  if (avgRunTime) {
    const timingInfo = document.createElement('p');
    timingInfo.id = 'analysis-timing';
    timingInfo.style.cssText = 'margin-top: 8px; font-size: 0.9em; color: #aaa;';
    timingInfo.textContent = `${t('mods.boardAnalyzer.avgRunTimeLabel')} ${avgRunTime}ms`;
    
    if (estimatedTimeRemaining) {
      timingInfo.textContent += ` • ${t('mods.boardAnalyzer.estimatedTimeRemainingLabel')} ${estimatedTimeRemaining}`;
    }
    
    content.appendChild(timingInfo);
  }
  
  const modal = api.ui.components.createModal({
    title: t('mods.boardAnalyzer.runningTitle'),
    content: content,
    buttons: [
      {
        text: t('mods.boardAnalyzer.forceStopButton'),
        primary: false,
        onClick: () => {
          // Reset analysis state - this will stop everything immediately
          analysisState.stop();
          
          // Close the running modal immediately
          closeRunningModal();
          
          // Re-enable Turbo Mode button when stopping
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
  
  // Register modal with modal manager for efficient management
  modal.type = MODAL_TYPES.RUNNING;
  modalManager.register('running-modal', modal);
  
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
  // Small delay to ensure UI is clean
  setTimeout(() => {
    const content = document.createElement('div');
    
    // Create EventManager for modal's event listeners
    const modalEventManager = new EventManager();
    let chartRenderer = null;
    
    // Add a partial results note if the analysis was forcefully stopped
    if (results.summary.forceStopped) {
      const partialNote = document.createElement('div');
      partialNote.textContent = t('mods.boardAnalyzer.partialResultsNote');
      partialNote.style.cssText = 'text-align: center; color: #e74c3c; margin-bottom: 15px;';
      content.appendChild(partialNote);
    }
    
    // Indicate if the mode was switched to sandbox
    if (results.summary.modeSwitched) {
      const sandboxNote = document.createElement('div');
      sandboxNote.textContent = t('mods.boardAnalyzer.sandboxModeEnabled');
      sandboxNote.style.cssText = 'text-align: center; color: #3498db; margin-bottom: 15px;';
      content.appendChild(sandboxNote);
    }
    
    // Show achievement completion notification
    if (config.stopOnAchievement && results.summary.achievementCount > 0) {
      const achievementNote = document.createElement('div');
      if (results.summary.achievementCount === 1) {
        achievementNote.textContent = '🏆 Achievement completed! Analysis stopped.';
      } else {
        achievementNote.textContent = `🏆 ${results.summary.achievementCount} run(s) completed the achievement!`;
      }
      achievementNote.style.cssText = 'text-align: center; color: #9b59b6; margin-bottom: 15px; font-weight: bold; padding: 8px; background-color: rgba(155, 89, 182, 0.1); border-radius: 4px;';
      content.appendChild(achievementNote);
    }
    
    // Create result statistics
    const statsContainer = document.createElement('div');
    statsContainer.style.cssText = 'display: grid; grid-template-columns: 130px auto; gap: 10px; margin-bottom: 20px;';
    
    // S+ Rate
    const sPlusRateLabel = document.createElement('div');
    sPlusRateLabel.textContent = t('mods.boardAnalyzer.sPlusRateLabel');
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
        label.textContent = t('mods.boardAnalyzer.sPlusMaxPointsRateLabel').replace('{points}', rankPoints);
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
    completionRateLabel.textContent = t('mods.boardAnalyzer.completionRateLabel');
    completionRateLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    const completionRateValue = document.createElement('div');
    completionRateValue.textContent = `${results.summary.completionRate}% (${results.summary.completedRuns}/${results.summary.totalRuns})`;
    completionRateValue.style.cssText = 'text-align: right; color: green;';
    
    // Achievement Rate (only show if stopOnAchievement is enabled)
    let achievementRateLabel = null;
    let achievementRateValue = null;
    if (config.stopOnAchievement && results.summary.achievementCount > 0) {
      achievementRateLabel = document.createElement('div');
      achievementRateLabel.textContent = t('mods.boardAnalyzer.achievementRateLabel');
      achievementRateLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
      
      achievementRateValue = document.createElement('div');
      achievementRateValue.textContent = `${results.summary.achievementRate}% (${results.summary.achievementCount}/${results.summary.totalRuns})`;
      achievementRateValue.style.cssText = 'text-align: right; color: #9b59b6; font-weight: bold;';
    }
    
    // Best Time (Min Time) - Dynamic label based on completion status
    const minTimeLabel = document.createElement('div');
    const hasWins = results.summary.completedRuns > 0;
    minTimeLabel.textContent = hasWins ? t('mods.boardAnalyzer.minTimeLabel') : t('mods.boardAnalyzer.minDefeatTimeLabel');
    minTimeLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    const minTimeValue = document.createElement('div');
    const minTimeToShow = hasWins ? results.summary.minTicks : results.summary.minDefeatTicks;
    minTimeValue.textContent = `${minTimeToShow} ${t('mods.boardAnalyzer.ticksSuffix')}`;
    minTimeValue.style.cssText = 'text-align: right;';
    
    // Max Time - Dynamic label based on completion status
    const maxTimeLabel = document.createElement('div');
    maxTimeLabel.textContent = hasWins ? t('mods.boardAnalyzer.maxTimeLabel') : t('mods.boardAnalyzer.maxDefeatTimeLabel');
    maxTimeLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    const maxTimeValue = document.createElement('div');
    const maxTimeToShow = hasWins ? results.summary.maxTicks : results.summary.maxDefeatTicks;
    maxTimeValue.textContent = `${maxTimeToShow} ${t('mods.boardAnalyzer.ticksSuffix')}`;
    maxTimeValue.style.cssText = 'text-align: right;';
    
    // Median Time
    const medianTimeLabel = document.createElement('div');
    medianTimeLabel.textContent = t('mods.boardAnalyzer.medianTimeLabel');
    medianTimeLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    const medianTimeValue = document.createElement('div');
    medianTimeValue.textContent = `${Math.round(results.summary.medianTicks)} ${t('mods.boardAnalyzer.ticksSuffix')}`;
    medianTimeValue.style.cssText = 'text-align: right;';
    
    // Max Rank Points - Removed as redundant since we show S+ breakdown above
    
    // Add timing information
    
    // Total time
    const totalTimeLabel = document.createElement('div');
    totalTimeLabel.textContent = t('mods.boardAnalyzer.totalTimeLabel') || 'Total Time:';
    totalTimeLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    const totalTimeValue = document.createElement('div');
    totalTimeValue.textContent = results.summary.totalTimeFormatted;
    totalTimeValue.style.cssText = 'text-align: right;';
    
    // Average run time
    const avgRunTimeLabel = document.createElement('div');
    avgRunTimeLabel.textContent = t('mods.boardAnalyzer.avgRunTimeLabel') || 'Avg Run Time:';
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
    
    // Add achievement rate if available
    if (achievementRateLabel && achievementRateValue) {
      statsContainer.appendChild(achievementRateLabel);
      statsContainer.appendChild(achievementRateValue);
    }
    
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
    
    // Check if we have valid replay data for achievement
    const hasAchievementReplay = results.summary.achievementResult && results.summary.achievementResult.board;
    
    // Add achievement replay button if available
    if (hasAchievementReplay) {
      const copyAchievementButton = document.createElement('button');
      copyAchievementButton.textContent = '🏆 ' + t('mods.boardAnalyzer.copyAchievementReplayButton');
      copyAchievementButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
      copyAchievementButton.style.cssText = 'width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 10px; background-color: rgba(155, 89, 182, 0.2);';
      
      // Add click handler using EventManager
      modalEventManager.addListener(copyAchievementButton, 'click', () => {
        // Get the board data
        const replayData = results.summary.achievementResult.board;
        
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
        console.log('🏆 Achievement replay text:', replayText);
        
        // Copy to clipboard
        const success = copyToClipboard(replayText);
        if (success) {
          const originalText = copyAchievementButton.textContent;
          copyAchievementButton.textContent = t('mods.boardAnalyzer.replayCopiedMessage');
          setTimeout(() => {
            copyAchievementButton.textContent = originalText;
          }, 2000);
        }
      });
      
      // Add the button directly to content
      content.appendChild(copyAchievementButton);
    }
    
    // Check if we have valid replay data for target ticks
    const hasTargetTicksReplay = results.summary.targetTicksResult && results.summary.targetTicksResult.board;
    
    // Add target ticks replay button if available (only useful replay button)
    if (hasTargetTicksReplay) {
      const copyTargetTicksButton = document.createElement('button');
      copyTargetTicksButton.textContent = t('mods.boardAnalyzer.copyTargetTicksReplayButton');
      copyTargetTicksButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
      copyTargetTicksButton.style.cssText = 'width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 20px;';
      
      // Add click handler using EventManager
      modalEventManager.addListener(copyTargetTicksButton, 'click', () => {
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
          copyTargetTicksButton.textContent = t('mods.boardAnalyzer.replayCopiedMessage');
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
      try {
        // Debug: Log results data
        console.log('Creating chart with results:', {
          totalResults: results.results.length,
          results: results.results.slice(0, 5) // Log first 5 results for debugging
        });
        
        // Use ChartRenderer with callback for replay generation
        chartRenderer = new ChartRenderer(content, results.results, (originalIndex, displayResult) => {
          const fullResult = results.results[originalIndex];
          const replayData = createReplayDataForRun(fullResult);
          
          if (replayData) {
            const replayText = `$replay(${JSON.stringify(replayData)})`;
            const success = copyToClipboard(replayText);
            
            if (success) {
              showCopyNotification(`Copied run ${originalIndex + 1} replay data!`);
            } else {
              showCopyNotification('Failed to copy replay data', true);
            }
          } else {
            showCopyNotification('Failed to create replay data for this run', true);
          }
        });
        chartRenderer.render();
      
      } catch (error) {
        console.error('Error creating chart:', error);
        
        // Fallback: Show error message
        const errorMessage = document.createElement('div');
        errorMessage.textContent = 'Error creating chart. Please check console for details.';
        errorMessage.style.cssText = 'text-align: center; color: #e74c3c; margin-top: 15px; padding: 10px; border: 1px solid #e74c3c; border-radius: 4px;';
        content.appendChild(errorMessage);
      }
    } else {
      // Show a message if no results
      const noResultsMessage = document.createElement('p');
      noResultsMessage.textContent = 'No runs completed yet.';
      noResultsMessage.style.cssText = 'text-align: center; color: #777; margin-top: 15px;';
      content.appendChild(noResultsMessage);
    }
    
    // Flag to prevent double cleanup
    let isCleanedUp = false;
    
    // Cleanup function for when modal closes
    const cleanupResultsModal = () => {
      // Prevent double cleanup
      if (isCleanedUp) {
        return;
      }
      isCleanedUp = true;
      
      // Clean up chart renderer event listeners
      if (chartRenderer) {
        chartRenderer.cleanup();
        console.log('[Board Analyzer] ChartRenderer cleaned up');
      }
      
      // Clean up modal's own event listeners
      modalEventManager.cleanup();
      console.log('[Board Analyzer] Modal event listeners cleaned up');
      
      // Remove ESC key listener
      if (escKeyListener) {
        document.removeEventListener('keydown', escKeyListener);
      }
      
      // Clear global results to free memory when modal closes
      if (window.__boardAnalyzerResults) {
        window.__boardAnalyzerResults = null;
        console.log('[Board Analyzer] Global results cleared from memory');
      }
      
      // One more check for lingering modals when user closes results
      forceCloseAllModals();
    };
    
    // Add ESC key listener to handle closing via ESC
    const escKeyListener = (e) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        cleanupResultsModal();
      }
    };
    document.addEventListener('keydown', escKeyListener);
    
    // Show the results modal with a callback to clean up when closed
    let modalTitle = t('mods.boardAnalyzer.resultTitle');
    if (currentFloor !== null && currentFloor !== undefined) {
      modalTitle += ` (Floor ${currentFloor})`;
    }
    const resultsModal = api.ui.components.createModal({
      title: modalTitle,
      width: 400,
      content: content,
      buttons: [
        {
          text: t('mods.boardAnalyzer.closeButton'),
          primary: true,
          onClick: cleanupResultsModal
        }
      ]
    });
    
    // Register results modal with modal manager
    resultsModal.type = MODAL_TYPES.RESULTS;
    
    // Store cleanup function with modal so it can be called when modal is force-closed
    resultsModal.cleanup = cleanupResultsModal;
    
    modalManager.register('results-modal', resultsModal);
    
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
    // Get board data
    const boardData = getBoardData(runResult.seed);
    
    if (!boardData) {
      console.error('Failed to get board data for run replay data');
      return null;
    }
    
    console.log('Using board data for run replay data');
    
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
  
  // Remove after specified time
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, NOTIFICATION_DISPLAY_MS);
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

// =======================
// 7. Main Entry Point & Lifecycle
// =======================

// Main entry point - Run the analysis
async function runAnalysis() {
  // Check if analysis is already running
  if (!analysisState.canStart()) {
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
      // Fallback: manually disable turbo completely
      window.__turboState.active = false;
      
      // Remove speedup subscription - this is crucial for actually stopping turbo
      if (window.__turboState.speedupSubscription) {
        try {
          window.__turboState.speedupSubscription.unsubscribe();
          window.__turboState.speedupSubscription = null;
          console.log('[Board Analyzer] Turbo speedup subscription removed');
        } catch (e) {
          console.warn('[Board Analyzer] Error removing turbo subscription:', e);
        }
      }
      
      // Reset tick interval to default
      if (globalThis.state?.board?.getSnapshot()?.context?.world?.tickEngine) {
        try {
          const tickEngine = globalThis.state.board.getSnapshot().context.world.tickEngine;
          tickEngine.setTickInterval(62.5); // Reset to default tick interval
          console.log('[Board Analyzer] Tick interval reset to default');
        } catch (e) {
          console.warn('[Board Analyzer] Error resetting tick interval:', e);
        }
      }
      
      // Also try to reset any other turbo-related state
      if (window.__turboState.timerSubscribed) {
        window.__turboState.timerSubscribed = false;
      }
      
      // Clear any intervals
      if (window.__turboState.timerCheckInterval) {
        clearInterval(window.__turboState.timerCheckInterval);
        window.__turboState.timerCheckInterval = null;
      }
    }
    
    // Update the Turbo Mode button to show as inactive
    if (window.turboButton) {
      window.turboButton.textContent = 'Enable Turbo';
      window.turboButton.style.background = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat";
      window.turboButton.style.color = "#ffe066";
    }
    
    console.log('Turbo Mode mod has been completely disabled for analysis');
  }
  
  // Close any existing modals using modal manager
  modalManager.closeByType(MODAL_TYPES.RUNNING);
  activeRunningModal = null;
  
  console.log('[Board Analyzer] Cleared any existing running modals');
  
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
        progressEl.textContent = t('mods.boardAnalyzer.progressText')
          .replace('{current}', status.current)
          .replace('{total}', status.total);
      }
      
      // Update timing information if available
      if (status.avgRunTime && status.estimatedTimeRemaining) {
        const timingEl = document.getElementById('analysis-timing');
        if (timingEl) {
          timingEl.textContent = `${t('mods.boardAnalyzer.avgRunTimeLabel')} ${status.avgRunTime}ms • ${t('mods.boardAnalyzer.estimatedTimeRemainingLabel')} ${status.estimatedTimeRemaining}`;
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
    
    // Always show results, even if analysis was stopped early
    console.log('Analysis completed, showing results:', results);
    console.log('Results summary:', results.summary);
    console.log('Force stopped:', results.summary.forceStopped);
    console.log('Total runs completed:', results.summary.totalRuns);
    
    // Clear old results before storing new ones to prevent memory accumulation
    if (window.__boardAnalyzerResults) {
      console.log('[Board Analyzer] Clearing old results from memory');
      window.__boardAnalyzerResults = null;
    }
    
    // Force close all modals again
    forceCloseAllModals();
    
    // Ensure the running modal is closed through the API too
    if (runningModal) {
      try {
        // Check if the modal is a function (like closeModal)
        if (typeof runningModal === 'function') {
          runningModal();
        } else if (typeof runningModal.close === 'function') {
          runningModal.close();
        } else if (runningModal.element && typeof runningModal.element.remove === 'function') {
          runningModal.element.remove();
        } else if (runningModal.remove && typeof runningModal.remove === 'function') {
          runningModal.remove();
        } else {
          console.warn('[Board Analyzer] No valid close method found for modal:', runningModal);
        }
      } catch (e) {
        console.error('[Board Analyzer] Error closing running modal:', e);
      }
      
      runningModal = null;
      activeRunningModal = null;
    }
    
    // Small delay to ensure UI updates properly
    await sleep(UI_UPDATE_DELAY_MS);
    
    // Force close all modals one more time
    forceCloseAllModals();
    
    // Show the results modal (works for both completed and partial results)
    showResultsModal(results);
    
  } catch (error) {
    console.error('[Board Analyzer] Analysis error:', error);
    
    // Close all modals and restore board state
    modalManager.closeAll();
    restoreBoardState();
    runningModal = null;
    activeRunningModal = null;
    
    console.log('[Board Analyzer] Error cleanup completed - all modals closed');
  }
}


// Initialize UI
function init() {
  console.log('Board Analyzer initializing UI...');
  
  
  // Make sure turbo mode is disabled on startup
  if (turboActive) {
    disableTurbo();
  }
  
  // Add the main analyzer button - opens config panel with analysis callback
  api.ui.addButton({
    id: BUTTON_ID,
    text: t('mods.boardAnalyzer.buttonText'),
    modId: MOD_ID,
    tooltip: t('mods.boardAnalyzer.buttonTooltip'),
    primary: false,
    onClick: showConfigAndPrepareAnalysis,
    style: {
      background: "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat",
      backgroundSize: 'auto'
    }
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
  analyze: showConfigAndPrepareAnalysis, // Opens config panel with analysis callback
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
    api.service.updateScriptConfig(context.hash, config);
  },
  // Cleanup function for modal manager
  cleanup: () => {
    modalManager.closeAll();
  }
};

