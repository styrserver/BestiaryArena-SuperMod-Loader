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
  stopOnOutcome: false, // false | 'victory' | 'defeat'
  stopAfterTicks: 0, // 0 means no limit
  stopWhenTicksReached: 0, // Stop when finding a run with this number of ticks or less
  estimateExperience: false,
  showAdvancedLiveStats: true
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);
if (config.stopOnAnyVictory && !config.stopOnOutcome) {
  config.stopOnOutcome = 'victory';
}
if (config.stopOnSPlus && config.stopOnOutcome) {
  config.stopOnOutcome = false;
}

// Constants
const MOD_ID = 'board-analyzer';
const BUTTON_ID = `${MOD_ID}-button`;
const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;
const DEFAULT_TICK_INTERVAL_MS = 62.5;

// Timing constants
const ANALYSIS_STOP_DELAY_MS = 200;
const LIVE_STATS_THROTTLE_MS = 50;
const UI_UPDATE_DELAY_MS = 600;
const MODAL_CLEANUP_DELAY_MS = 100;
const BOARD_RESTORE_DELAY_MS = 50;
const TURBO_RESET_DELAY_MS = 25;
const NOTIFICATION_DISPLAY_MS = 3000;
const BOARD_ANALYZER_TOAST_CONTAINER_ID = 'board-analyzer-toast-container';
const COPY_FEEDBACK_DELAY_MS = 2000;

// Chart rendering constants
const CHART_BAR_WIDTH = 8;
const CHART_BAR_SPACING = 4;
const CHART_BATCH_SIZE = 10;
const CHART_MIN_HEIGHT = 20;
const CHART_MAX_HEIGHT = 120;
const CHART_MAX_BARS = 1000; // Limit chart to prevent performance issues with large analyses
const CHART_BACKGROUND_STYLE = "url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat";
const SKIPPED_RUN_COLOR = '#9b59b6';

const BOARD_ANALYZER_UI = {
  CONTENT_PADDING: 2,
  STATS_GRID_GAP: 8,
  STATS_MARGIN_BOTTOM: 8,
  PROGRESS_MARGIN_Y: 8,
  NOTE_MARGIN_BOTTOM: 10,
  CHART_MARGIN_TOP: 12,
  CHART_PADDING: 8,
  CHART_HEIGHT: 200,
  CHART_SCROLL_HEIGHT: 150,
  CHART_SORT_MARGIN_BOTTOM: 6,
  BUTTON_MARGIN_Y: 6,
  LIVE_STATS_FONT_SIZE: '0.85em'
};

function createBoardAnalyzerStatsDivider() {
  const divider = document.createElement('div');
  divider.className = 'separator my-2.5';
  divider.setAttribute('role', 'none');
  divider.style.gridColumn = '1 / -1';
  return divider;
}

// Modal constants
const MODAL_TYPES = {
  CONFIG: 'config',
  RUNNING: 'running',
  RESULTS: 'results'
};

const BOARD_ANALYZER_MODAL_CONFIG = {
  width: 350,
  maxHeight: 700,
  viewportPadding: 16,
  minWidth: 280,
  minHeight: 200
};

let boardAnalyzerModalLayoutCleanup = null;
let boardAnalyzerActiveModalLayout = null;
let boardAnalyzerModalLayoutRefreshTimer = null;

function getBoardAnalyzerModalDimensions() {
  const pad = BOARD_ANALYZER_MODAL_CONFIG.viewportPadding * 2;
  return {
    width: Math.round(Math.max(
      BOARD_ANALYZER_MODAL_CONFIG.minWidth,
      Math.min(BOARD_ANALYZER_MODAL_CONFIG.width, window.innerWidth - pad)
    )),
    maxHeight: Math.round(Math.max(
      BOARD_ANALYZER_MODAL_CONFIG.minHeight,
      Math.min(BOARD_ANALYZER_MODAL_CONFIG.maxHeight, window.innerHeight - pad)
    ))
  };
}

function snapBoardAnalyzerModalPx(value) {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function applyBoardAnalyzerModalNaturalLayout(contentRoot) {
  if (!contentRoot) return;
  Object.assign(contentRoot.style, {
    flex: '0 0 auto',
    minHeight: '0',
    height: 'auto',
    maxHeight: 'none',
    width: '100%',
    minWidth: '0',
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: `${BOARD_ANALYZER_UI.CONTENT_PADDING}px`,
    overflowX: 'hidden',
    overflowY: 'visible'
  });
}

function applyBoardAnalyzerModalScrollLayout(rootWrapper, contentContainer, contentRoot) {
  if (rootWrapper) {
    Object.assign(rootWrapper.style, {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      minHeight: '0',
      gap: '0'
    });
  }
  if (contentContainer) {
    Object.assign(contentContainer.style, {
      flex: '1 1 auto',
      minHeight: '0',
      marginTop: '-1px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });
  }
  if (contentRoot) {
    Object.assign(contentRoot.style, {
      flex: '1 1 0',
      minHeight: '0',
      overflowX: 'hidden',
      overflowY: 'auto'
    });
  }
}

function applyBoardAnalyzerModalCompactLayout(rootWrapper, contentContainer, contentRoot) {
  if (rootWrapper) {
    Object.assign(rootWrapper.style, {
      height: 'auto',
      display: 'flex',
      flexDirection: 'column',
      flex: '0 0 auto',
      minHeight: '0',
      gap: '0'
    });
  }
  if (contentContainer) {
    Object.assign(contentContainer.style, {
      flex: '0 0 auto',
      minHeight: '0',
      marginTop: '-1px',
      overflow: 'visible',
      display: 'flex',
      flexDirection: 'column'
    });
  }
  applyBoardAnalyzerModalNaturalLayout(contentRoot);
}

function measureBoardAnalyzerModalNaturalHeight(dialog, contentRoot) {
  const rootWrapper = dialog.querySelector(':scope > div');
  if (rootWrapper?.offsetHeight > 0) {
    return rootWrapper.offsetHeight;
  }

  if (!contentRoot) return dialog.scrollHeight;

  const title = dialog.querySelector('.widget-top');
  const widgetBottom = dialog.querySelector('.widget-bottom');
  const separator = widgetBottom?.querySelector('.separator');
  const footer = widgetBottom?.querySelector('.flex.justify-end.gap-2');

  let chrome = 0;
  if (title) chrome += title.offsetHeight;
  if (separator) chrome += separator.offsetHeight;
  if (footer) chrome += footer.offsetHeight;
  if (widgetBottom) {
    const style = window.getComputedStyle(widgetBottom);
    chrome += parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    chrome += parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  }

  return chrome + contentRoot.scrollHeight;
}

function getBoardAnalyzerDialog(modalRef) {
  if (modalRef?.element) return modalRef.element;
  if (modalRef instanceof HTMLElement) return modalRef;
  return document.querySelector('div[role="dialog"][data-state="open"]');
}

function clearBoardAnalyzerModalLayoutCleanup() {
  if (boardAnalyzerModalLayoutRefreshTimer) {
    clearTimeout(boardAnalyzerModalLayoutRefreshTimer);
    boardAnalyzerModalLayoutRefreshTimer = null;
  }
  if (boardAnalyzerModalLayoutCleanup) {
    boardAnalyzerModalLayoutCleanup();
    boardAnalyzerModalLayoutCleanup = null;
  }
  boardAnalyzerActiveModalLayout = null;
}

function applyBoardAnalyzerModalLayout(modalRef, contentRoot, dimensions) {
  const dialog = getBoardAnalyzerDialog(modalRef);
  if (!dialog) return;

  const { width, maxHeight } = dimensions;
  const { minHeight } = BOARD_ANALYZER_MODAL_CONFIG;
  const snappedWidth = snapBoardAnalyzerModalPx(width);

  dialog.style.width = `${snappedWidth}px`;
  dialog.style.minWidth = '0';
  dialog.style.maxWidth = `${snappedWidth}px`;
  dialog.style.boxSizing = 'border-box';
  dialog.classList.remove('max-w-[300px]', 'w-full');

  const rootWrapper = dialog.querySelector(':scope > div');
  const contentContainer = dialog.querySelector('.widget-bottom');

  dialog.style.height = 'auto';
  dialog.style.minHeight = '0';
  dialog.style.maxHeight = 'none';

  const widgetTop = dialog.querySelector('.widget-top');
  if (widgetTop) {
    widgetTop.style.margin = '0';
    const titleText = widgetTop.querySelector('p');
    if (titleText) titleText.style.margin = '0';
  }

  applyBoardAnalyzerModalCompactLayout(rootWrapper, contentContainer, contentRoot);

  const naturalHeight = measureBoardAnalyzerModalNaturalHeight(dialog, contentRoot);
  const needsScroll = naturalHeight > maxHeight;
  const finalHeight = snapBoardAnalyzerModalPx(
    needsScroll ? maxHeight : Math.max(minHeight, naturalHeight)
  );

  dialog.style.height = `${finalHeight}px`;
  dialog.style.maxHeight = `${maxHeight}px`;

  if (needsScroll) {
    applyBoardAnalyzerModalScrollLayout(rootWrapper, contentContainer, contentRoot);
  } else {
    applyBoardAnalyzerModalCompactLayout(rootWrapper, contentContainer, contentRoot);
  }
}

function scheduleBoardAnalyzerModalLayoutRefresh() {
  if (!boardAnalyzerActiveModalLayout) return;
  if (boardAnalyzerModalLayoutRefreshTimer) {
    clearTimeout(boardAnalyzerModalLayoutRefreshTimer);
  }
  boardAnalyzerModalLayoutRefreshTimer = setTimeout(() => {
    boardAnalyzerModalLayoutRefreshTimer = null;
    if (!boardAnalyzerActiveModalLayout) return;
    const { modalRef, contentRoot } = boardAnalyzerActiveModalLayout;
    applyBoardAnalyzerModalLayout(modalRef, contentRoot, getBoardAnalyzerModalDimensions());
  }, 120);
}

function attachBoardAnalyzerModalCloseCleanup(modalRef) {
  if (!modalRef) return;

  if (typeof modalRef.onClose === 'function') {
    modalRef.onClose(() => clearBoardAnalyzerModalLayoutCleanup());
  }

  const originalClose = modalRef.close?.bind(modalRef);
  if (originalClose) {
    modalRef.close = () => {
      clearBoardAnalyzerModalLayoutCleanup();
      originalClose();
    };
  }
}

function setupBoardAnalyzerModalResponsiveLayout(modalRef, contentRoot) {
  clearBoardAnalyzerModalLayoutCleanup();
  boardAnalyzerActiveModalLayout = { modalRef, contentRoot };
  const apply = () => applyBoardAnalyzerModalLayout(modalRef, contentRoot, getBoardAnalyzerModalDimensions());
  requestAnimationFrame(() => apply());
  const onResize = () => apply();
  window.addEventListener('resize', onResize);
  boardAnalyzerModalLayoutCleanup = () => {
    window.removeEventListener('resize', onResize);
    boardAnalyzerActiveModalLayout = null;
  };
}

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
      skipped: !!r.skipped,
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
    
    // For run-order view, use smart sampling that includes best runs
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
      chartContainer.style.cssText = `margin-top: ${BOARD_ANALYZER_UI.CHART_MARGIN_TOP}px; border: 1px solid #555; padding: ${BOARD_ANALYZER_UI.CHART_PADDING}px; height: ${BOARD_ANALYZER_UI.CHART_HEIGHT}px; position: relative; overflow: hidden; box-sizing: border-box; background: ${CHART_BACKGROUND_STYLE}; background-size: auto;`;
      this.chartContainer = chartContainer;
      
      this.createSortButtons(chartContainer);
      this.createScrollableChart(chartContainer);
      
      DOMOptimizer.batchAppend(this.container, [chartContainer]);
      
      // Initial render
      this.renderChart();
      
    } catch (error) {
      console.error('Error creating chart:', error);
      this.showChartError();
    }
  }
  
  createSortButtons(container) {
    const sortButtonsContainer = document.createElement('div');
    sortButtonsContainer.style.cssText = `display: flex; gap: 4px; margin-bottom: ${BOARD_ANALYZER_UI.CHART_SORT_MARGIN_BOTTOM}px; justify-content: center;`;
    
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
    const barsContainer = document.createElement('div');
    barsContainer.style.cssText = `height: ${BOARD_ANALYZER_UI.CHART_SCROLL_HEIGHT}px; position: relative;`;
    
    const scrollWrapper = document.createElement('div');
    scrollWrapper.style.cssText = `
      width: 100%;
      height: ${BOARD_ANALYZER_UI.CHART_SCROLL_HEIGHT}px;
      overflow-x: auto;
      overflow-y: hidden;
      border: 1px solid #555;
      border-radius: 4px;
      position: relative;
      padding: 0 2px;
      box-sizing: border-box;
      background: ${CHART_BACKGROUND_STYLE};
      background-size: auto;
    `;
    
    scrollWrapper.appendChild(barsContainer);
    container.appendChild(scrollWrapper);
    
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
    
    this.renderGeneration = (this.renderGeneration || 0) + 1;
    const generation = this.renderGeneration;
    
    this.barsContainer.innerHTML = '';
    
    const sortedResults = this.getSortedResults();
    const spacing = CHART_BAR_SPACING;
    const barWidth = CHART_BAR_WIDTH;
    const totalChartWidth = sortedResults.length * (barWidth + spacing) - spacing;
    
    this.barsContainer.style.width = `${totalChartWidth}px`;
    
    const maxTicks = sortedResults.length > 0 ? Math.max(...sortedResults.map(r => r.ticks)) : 1;
    
    this.renderBarsAsync(sortedResults, maxTicks, spacing, barWidth, generation);
  }
  
  getSortedResults() {
    let sorted;
    const isSorted = this.currentSort !== 'runs';
    const getOutcomeGroup = (result) => {
      if (result.completed) return 0;
      if (result.skipped) return 1;
      return 2;
    };
    
    switch (this.currentSort) {
      case 'time':
        sorted = [...this.displayData].sort((a, b) => {
          // Wins first, then skipped runs, then regular defeats
          const outcomeDiff = getOutcomeGroup(a) - getOutcomeGroup(b);
          if (outcomeDiff !== 0) return outcomeDiff;
          return a.ticks - b.ticks;
        });
        break;
      case 'splus':
        sorted = [...this.displayData].sort((a, b) => {
          // Group by outcome first: wins, skipped, then regular defeats.
          const outcomeDiff = getOutcomeGroup(a) - getOutcomeGroup(b);
          if (outcomeDiff !== 0) return outcomeDiff;
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
          const gradeOrder = { 'S': 1, 'A': 2, 'B': 3, 'C': 4, 'D': 5, 'E': 6, 'F': 7 };
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
  
  async renderBarsAsync(sortedResults, maxTicks, spacing, barWidth, generation) {
    const batchSize = CHART_BATCH_SIZE;
    
    for (let i = 0; i < sortedResults.length; i += batchSize) {
      if (generation !== this.renderGeneration) return;
      
      const batch = sortedResults.slice(i, i + batchSize);
      
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      if (generation !== this.renderGeneration) return;
      
      const fragment = DOMOptimizer.createDocumentFragment();
      
      batch.forEach((result, batchIndex) => {
        const index = i + batchIndex;
        const bar = this.createBar(result, index, maxTicks, spacing, barWidth);
        if (bar) {
          fragment.appendChild(bar);
        }
      });
      
      this.barsContainer.appendChild(fragment);
    }
  }
  
  createBar(result, index, maxTicks, spacing, barWidth) {
    try {
      const bar = document.createElement('div');
      const height = Math.max(CHART_MIN_HEIGHT, Math.floor((result.ticks / maxTicks) * CHART_MAX_HEIGHT));
      
      const barColor = this.getBarColor(result);
      
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
      console.error('Error creating chart bar:', error);
      return null;
    }
  }
  
  getBarColor(result) {
    if (result.skipped) {
      return SKIPPED_RUN_COLOR;
    }
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
    let tooltipText = t('mods.boardAnalyzer.tooltipRunPrefix')
      .replace('{index}', result.originalIndex + 1)
      .replace('{ticks}', result.ticks);
    
    if (result.grade === 'S+' && result.rankPoints) {
      tooltipText += `S+${result.rankPoints}`;
    } else {
      tooltipText += result.grade;
    }
    
    const outcomeText = result.skipped
      ? 'Skipped'
      : (result.completed ? t('mods.boardAnalyzer.tooltipCompleted') : t('mods.boardAnalyzer.tooltipFailed'));
    tooltipText += `, ${outcomeText}`;
    if (currentFloor !== null && currentFloor !== undefined) {
      tooltipText += `, ${t('mods.boardAnalyzer.tooltipFloor').replace('{floor}', currentFloor)}`;
    }
    if (result.seed) {
      tooltipText += `, ${t('mods.boardAnalyzer.tooltipSeed').replace('{seed}', result.seed)}`;
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
    errorMessage.textContent = t('mods.boardAnalyzer.chartErrorMessage');
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
      boardContext.world.tickEngine.setTickInterval(interval);
    }
  } catch (e) {
    console.warn('Could not access current game tickEngine:', e);
  }
  
  turboActive = true;
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
    tickEngine.setTickInterval(DEFAULT_TICK_INTERVAL_MS);
  }
  
  turboActive = false;
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
  let regionName = regionIdsToNames.get(regionId);
  if (!regionName) {
    const fromState = globalThis.state?.utils?.REGION_NAME;
    regionName = fromState?.[regionId] || fromState?.[String(regionId).toLowerCase()];
    if (!regionName) {
      const id = String(regionId ?? '').trim();
      regionName = id.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }
  }
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
      globalThis.state.board.send({ type: "setPlayMode", mode: "sandbox" });
      return true; // Mode was changed
    }
    return false; // No change needed
  } catch (error) {
    console.error('Error setting sandbox mode:', error);
    return false;
  }
}

// Function to properly restore the board state
function restoreBoardState() {
  try {
    console.log('[Board Analyzer] Restoring board state...');
    
    // Update coordination system state
    if (window.ModCoordination) {
      window.ModCoordination.updateModState('Board Analyzer', { 
        active: false,
        metadata: { endTime: Date.now() }
      });
      console.log('[Board Analyzer] Analysis finished - other mods can resume');
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
    }
    
    // Reset body overflow if it was modified
    if (document.body.style.overflow === 'hidden') {
      document.body.style.overflow = '';
    }
    
    // Restore Better Highscores container if it exists
    if (window.BetterHighscores && typeof window.BetterHighscores.restoreContainer === 'function') {
      try {
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
        
        // Small delay to ensure map is loaded before restoring floor and board
        setTimeout(() => {
          // Restore the original floor that was active before analysis
          if (currentFloor !== null && currentFloor !== undefined) {
            try {
              if (globalThis.state.board.trigger && globalThis.state.board.trigger.setState) {
                globalThis.state.board.trigger.setState({
                  fn: (prev) => ({
                    ...prev,
                    floor: currentFloor,
                  }),
                });
              } else if (globalThis.state.board.send) {
                // Fallback to using send if trigger.setState is not available
                globalThis.state.board.send({
                  type: 'setState',
                  fn: (prev) => ({
                    ...prev,
                    floor: currentFloor,
                  }),
                });
              }
            } catch (error) {
              console.warn('[Board Analyzer] Error restoring floor:', error);
            }
          }
          
          // Also restore the original board configuration if we have it
          if (boardSetup && boardSetup.length > 0) {
            try {
              // Set the board configuration back to what it was before analysis
              globalThis.state.board.send({
                type: "setState",
                fn: prevState => ({
                  ...prevState,
                  boardConfig: boardSetup
                })
              });
            } catch (error) {
              console.warn('[Board Analyzer] Error restoring board configuration:', error);
            }
          }
        }, BOARD_RESTORE_DELAY_MS); // Reduced delay for faster restoration
      } catch (error) {
        console.warn('[Board Analyzer] Error restoring original map:', error);
      }
    }
    
    console.log('[Board Analyzer] Board state restored');
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

// Simple board data storage - serialize once, store, reuse
let currentBoardData = null;

function isCompleteBoardData(data) {
  return data && data.region && data.map && Array.isArray(data.board) && data.board.length > 0;
}

function getBoardData(seed = null) {
  if (!isCompleteBoardData(currentBoardData)) {
    try {
      if (typeof window.$serializeBoard === 'function') {
        currentBoardData = JSON.parse(window.$serializeBoard());
      } else if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.serializeBoard) {
        currentBoardData = JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
      } else {
        currentBoardData = serializeBoard();
      }
      if (!isCompleteBoardData(currentBoardData)) {
        console.error('Serialized board data is incomplete:', currentBoardData);
        currentBoardData = null;
        return null;
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
    this.skippedRuns = 0;
    this.timedRuns = 0;
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
    this.totalEstimatedExp = 0;
    this.expCount = 0;
    this.rankPointsCounts = {};
  }
  
  addRun(result, runTime) {
    this.totalRuns++;
    this.runTimes.push(runTime);
    this.runTimesSum += runTime;

    if (result.skipped) {
      this.skippedRuns++;
      return;
    }
    
    // Exclude skipped runs from tick metrics (min/max/median/average ticks)
    this.ticksArray.push(result.ticks);
    this.ticksSum += result.ticks;
    this.timedRuns++;
    
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
    
    // Update estimated experience stats
    if (result.estimatedExp != null) {
      this.totalEstimatedExp += result.estimatedExp;
      this.expCount++;
    }
    
    // Update S+ stats
    if (result.grade === 'S+') {
      this.sPlusCount++;
      if (result.rankPoints != null) {
        this.rankPointsCounts[result.rankPoints] = (this.rankPointsCounts[result.rankPoints] || 0) + 1;
      }
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
    const skippedRate = this.totalRuns > 0 ? (this.skippedRuns / this.totalRuns * 100).toFixed(2) : '0.00';
    const averageRunTime = this.runTimes.length > 0 ? this.runTimesSum / this.runTimes.length : 0;
    const averageTicks = this.timedRuns > 0 ? this.ticksSum / this.timedRuns : 0;
    const medianTicks = this.calculateMedian(this.ticksArray);
    
    return {
      totalRuns: this.totalRuns,
      completedRuns: this.completedRuns,
      skippedRuns: this.skippedRuns,
      sPlusCount: this.sPlusCount,
      sPlusMaxPointsCount: this.sPlusMaxPointsCount,
      sPlusRate,
      completionRate,
      skippedRate,
      minTicks: isFinite(this.minTicks) ? this.minTicks : 0,
      maxTicks: this.maxTicks,
      minDefeatTicks: isFinite(this.minDefeatTicks) ? this.minDefeatTicks : 0,
      maxDefeatTicks: this.maxDefeatTicks,
      medianTicks,
      averageTicks,
      maxRankPoints: this.maxRankPoints,
      averageRunTime,
      fastestRunTime: this.runTimes.length > 0 ? Math.min(...this.runTimes) : 0,
      slowestRunTime: this.runTimes.length > 0 ? Math.max(...this.runTimes) : 0,
      totalEstimatedExp: this.totalEstimatedExp,
      averageEstimatedExp: this.expCount > 0 ? Math.round(this.totalEstimatedExp / this.expCount) : 0,
      expCount: this.expCount,
      rankPointsCounts: { ...this.rankPointsCounts }
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
      resolve({
        ticks: 0,
        grade: 'F',
        rankPoints: 0,
        completed: false,
        forceStopped: true
      });
      return;
    }
    
    // Use shared game state tracker instead of creating new subscription
    const tracker = getGameStateTracker();
    
    const listener = (context) => {
      const { currentTick, state, readableGrade, rankPoints } = context;
      
      // Check if this analysis instance is still valid
      if (analysisId && !analysisState.isValidId(analysisId) && !hasResolved) {
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
      
      // Check if analysis state was reset (stop button was clicked)
      if (!analysisState.isRunning() && !hasResolved) {
        console.log('[Board Analyzer] Stop requested during run');
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
      
      // Check for force stop on every timer update
      if (analysisState.forceStop && !hasResolved) {
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
            completed: false,
            skipped: true
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
  // Update coordination system state
  if (window.ModCoordination) {
    window.ModCoordination.updateModState('Board Analyzer', { 
      active: true,
      metadata: { 
        startTime: Date.now(),
        endTime: null
      }
    });
  }
  
  console.log('[Board Analyzer] Analysis started - other mods should pause');
  
  // Disable Turbo Mode button during analysis
  if (window.turboButton) {
    window.turboButton.disabled = true;
    window.turboButton.title = t('mods.boardAnalyzer.turboDisabledTooltip');
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
    }
  } catch (error) {
    console.warn('[Board Analyzer] Error capturing board configuration:', error);
  }
}

// Helper function to preserve Better Highscores container
function preserveBetterHighscores() {
  if (window.BetterHighscores && typeof window.BetterHighscores.preserveContainer === 'function') {
    try {
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
    }
    
    if (selectedMap.selectedRoom) {
      currentRoomId = selectedMap.selectedRoom.id;
      currentRoomName = mapIdsToNames.get(currentRoomId) || 
                         globalThis.state.utils.ROOM_NAME[currentRoomId] || 
                         selectedMap.selectedRoom.file.name;
    }
    
    // Capture floor information
    if (typeof boardContext.floor !== 'undefined') {
      currentFloor = boardContext.floor;
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
    const completionRate = statsCalculator.totalRuns > 0 ? (statsCalculator.completedRuns / statsCalculator.totalRuns * 100).toFixed(2) : '0.00';
    
    statusCallback({
      current: i,
      total: config.runs,
      status: 'running',
      avgRunTime: avgRunTime.toFixed(0),
      estimatedTimeRemaining: formatDurationWholeSeconds(estimatedTimeRemaining),
      completionRate: completionRate,
      completedRuns: statsCalculator.completedRuns,
      totalRunsInStats: statsCalculator.totalRuns
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
      console.log('[Board Analyzer] Analysis stopped during run', i,
        `(${statsCalculator.totalRuns} completed)`);
      return null;
    }
    
    // Add seed to result
    result.seed = runSeed;
    
    // Estimate experience if enabled
    if (config.estimateExperience) {
      result.estimatedExp = estimateRunExperience(result.completed);
    }
    
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
  // Update coordination system state
  if (window.ModCoordination) {
    window.ModCoordination.updateModState('Board Analyzer', { 
      active: true,
      metadata: { 
        startTime: Date.now(),
        endTime: null
      }
    });
  }
  
  console.log('[Board Analyzer] Analysis started - other mods should pause');
  
  // Reset board data for fresh analysis
  currentBoardData = null;
  
  // Disable Turbo Mode button during analysis
  if (window.turboButton) {
    window.turboButton.disabled = true;
    window.turboButton.title = t('mods.boardAnalyzer.turboDisabledTooltip');
  }
  
  // Reset tracking variables (but preserve floor if it was already captured)
  const preservedFloor = currentFloor;
  currentSeed = null;
  currentRegionId = null;
  currentRoomId = null;
  currentRoomName = null;
  currentFloor = preservedFloor; // Restore preserved floor
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
    targetTicksRun: null
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
    }
  } catch (error) {
    console.warn('[Board Analyzer] Error capturing board configuration:', error);
  }
}

// Helper function to preserve Better Highscores container
function preserveBetterHighscores() {
  if (window.BetterHighscores && typeof window.BetterHighscores.preserveContainer === 'function') {
    try {
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
    }
    
    if (selectedMap.selectedRoom) {
      currentRoomId = selectedMap.selectedRoom.id;
      currentRoomName = mapIdsToNames.get(currentRoomId) || 
                         globalThis.state.utils.ROOM_NAME[currentRoomId] || 
                         selectedMap.selectedRoom.file.name;
    }
    
    // Capture floor information
    if (typeof boardContext.floor !== 'undefined') {
      currentFloor = boardContext.floor;
    }
  } catch (error) {
    console.error('Error capturing map information:', error);
  }
}

// Post-battle XP uses combat levels capped at 50 (room templates may store higher values, e.g. 500).
const XP_DROP_PER_LEVEL = 562.5;
const XP_COMBAT_LEVEL_CAP = 50;
// Props / summons that can be killed but do not contribute to expReward (e.g. Orcsmith Orcshop).
const XP_EXCLUDED_CREATURE_NAMES = new Set(['Orc', 'Sweaty Cyclops']);

function capLevelForXpEstimate(rawLevel) {
  const level = Math.max(1, Math.floor(Number(rawLevel) || 1));
  return Math.min(level, XP_COMBAT_LEVEL_CAP);
}

function resolveCreatureName(gameId) {
  if (gameId == null) return null;
  let name = monsterGameIdsToNames.get(gameId);
  if (!name) {
    try {
      const monData = globalThis.state?.utils?.getMonster?.(gameId);
      name = monData?.metadata?.name;
    } catch (_) {}
  }
  return name || null;
}

function isCreatureExcludedFromXp(name) {
  return name != null && XP_EXCLUDED_CREATURE_NAMES.has(name);
}

function collectVillainXpLevels() {
  const eligible = [];
  const excluded = [];

  const consider = (gameId, rawLevel, source) => {
    const name = resolveCreatureName(gameId);
    const raw = rawLevel || 1;
    if (isCreatureExcludedFromXp(name)) {
      excluded.push({ name: name || `gameId:${gameId}`, raw, source });
      return;
    }
    eligible.push({
      name: name || `gameId:${gameId}`,
      raw,
      capped: capLevelForXpEstimate(raw),
      source
    });
  };

  try {
    const boardConfig = globalThis.state?.board?.getSnapshot?.()?.context?.boardConfig;
    if (Array.isArray(boardConfig)) {
      for (const piece of boardConfig) {
        if (!piece || piece.villain === false || piece.type === 'player') continue;
        consider(piece.gameId, piece.level, 'board');
      }
    }
  } catch (_) {}

  if (eligible.length === 0 && excluded.length === 0 && currentRoomId && globalThis.state?.utils?.getBoardMonstersFromRoomId) {
    const enemies = globalThis.state.utils.getBoardMonstersFromRoomId(currentRoomId);
    if (Array.isArray(enemies)) {
      for (const enemy of enemies) {
        if (!enemy || enemy.villain === false) continue;
        consider(enemy.gameId, enemy.level, 'room');
      }
    }
  }

  return { eligible, excluded };
}

// Estimate experience gained from a run based on the experience formula.
// For victories all enemies are defeated; for defeats a random subset is used.
function estimateRunExperience(completed) {
  try {
    if (!currentRoomId) {
      return null;
    }

    const { eligible, excluded } = collectVillainXpLevels();
    if (eligible.length === 0) {
      return excluded.length > 0 ? 0 : null;
    }

    const cappedLevels = eligible.map(e => e.capped);

    let defeatedLevelSum;
    if (completed) {
      defeatedLevelSum = cappedLevels.reduce((sum, lvl) => sum + lvl, 0);
    } else {
      const killCount = Math.floor(Math.random() * cappedLevels.length);
      const shuffled = [...eligible].sort(() => Math.random() - 0.5);
      const defeated = shuffled.slice(0, killCount);
      defeatedLevelSum = defeated.reduce((sum, e) => sum + e.capped, 0);
    }

    if (defeatedLevelSum === 0) {
      return 0;
    }

    const d20Roll = Math.floor(Math.random() * 20) + 1;
    const xpValue = defeatedLevelSum * XP_DROP_PER_LEVEL;
    const rngMultiplier = (d20Roll - 10) / 100;
    const estimatedExp = Math.round(xpValue * (1 + rngMultiplier));
    return estimatedExp;
  } catch (error) {
    console.warn('[Board Analyzer][XP] Error:', error);
    return null;
  }
}

// Debug: log real battle XP from game.gameServer responses (when estimate XP is enabled).
let xpDebugFetchInstalled = false;
let xpDebugOriginalFetch = null;

function parseGameServerJson(responseData) {
  if (!responseData) return null;
  if (Array.isArray(responseData) && responseData[0]?.result?.data) {
    return responseData[0].result.data.json ?? responseData[0].result.data;
  }
  if (responseData.rewardScreen) return responseData;
  return null;
}

function parseServerExpReward(serverResults) {
  const rewardScreen = serverResults?.rewardScreen;
  const raw = rewardScreen?.expReward ?? serverResults?.next?.expReward;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function logServerExpReward(serverResults) {
  // Reserved for manual debugging; intentionally silent during analysis.
}

function installXpDebugFetchHook() {
  if (xpDebugFetchInstalled) return;
  xpDebugOriginalFetch = window.fetch.bind(window);
  window.fetch = async function(...args) {
    const response = await xpDebugOriginalFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      if (typeof url === 'string' && url.includes('game.gameServer')) {
        const cloned = response.clone();
        const responseData = await cloned.json();
        const serverResults = parseGameServerJson(responseData);
        if (serverResults?.rewardScreen) {
          logServerExpReward(serverResults);
        }
      }
    } catch (_) {}
    return response;
  };
  xpDebugFetchInstalled = true;
}

function uninstallXpDebugFetchHook() {
  if (!xpDebugFetchInstalled || !xpDebugOriginalFetch) return;
  window.fetch = xpDebugOriginalFetch;
  xpDebugFetchInstalled = false;
  xpDebugOriginalFetch = null;
}

// Helper function to run the main analysis loop
async function runAnalysisLoop(runs, thisAnalysisId, statsCalculator, bestRuns, timing, statusCallback, perf = null) {
  const results = [];
  
  for (let i = 1; i <= runs; i++) {
    // Check if analysis should continue
    if (!shouldContinueAnalysis(thisAnalysisId)) {
      break;
    }
    
    // Start timing this run
    timing.lastRunStart = performance.now();
    
    // Process individual run
    const runResult = await processSingleRun(i, thisAnalysisId, statsCalculator, bestRuns, timing, perf);
    
    if (runResult === null) {
      // Analysis was stopped
      break;
    }
    
    // Handle both regular results and stop-triggering results
    if (typeof runResult === 'object' && runResult.shouldStop) {
      // This run triggered the stop condition, but we still want to include it
      if (!runResult.result?.skipped) {
        results.push(runResult.result);
      }
      updateStatusCallback(i, runs, statsCalculator, statusCallback, timing, perf);
      break; // Stop the analysis
    } else {
      // Regular run result
      if (!runResult?.skipped) {
        results.push(runResult);
      }
      updateStatusCallback(i, runs, statsCalculator, statusCallback, timing, perf);
    }
  }
  
  return results;
}

// Helper function to check if analysis should continue
function shouldContinueAnalysis(thisAnalysisId) {
  if (!analysisState.isValidId(thisAnalysisId)) {
    return false;
  }
  
  if (!analysisState.isRunning()) {
    return false;
  }
  
  if (analysisState.forceStop) {
    return false;
  }
  
  return true;
}

function getSPlusRankTextColor(highestRankPoints, rankPoints) {
  const rankDifference = highestRankPoints - rankPoints;
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
}

function getSkippedRunStatus(statsCalculator) {
  const totalRunsInStats = statsCalculator.totalRuns;
  const skippedRuns = statsCalculator.skippedRuns;
  const skippedRate = totalRunsInStats > 0
    ? (skippedRuns / totalRunsInStats * 100).toFixed(2)
    : '0.00';
  return { skippedRuns, skippedRate, totalRunsInStats };
}

function getTimingStatus(currentRun, totalRuns, statsCalculator, timing = null) {
  if (statsCalculator.totalRuns === 0) {
    return {};
  }

  const averageRunTime = statsCalculator.runTimes.length > 0
    ? statsCalculator.runTimesSum / statsCalculator.runTimes.length
    : 0;
  const remainingRuns = totalRuns - currentRun + 1;

  return {
    avgRunTime: averageRunTime.toFixed(0),
    estimatedTimeRemaining: formatDurationWholeSeconds(averageRunTime * remainingRuns),
    totalTimeFormatted: timing
      ? formatDurationWholeSeconds(performance.now() - timing.startTime)
      : null
  };
}

function buildAnalysisStatus(currentRun, totalRuns, statsCalculator, timing = null) {
  const skippedStatus = getSkippedRunStatus(statsCalculator);
  const timingStatus = getTimingStatus(currentRun, totalRuns, statsCalculator, timing);

  if (statsCalculator.timedRuns === 0) {
    return {
      current: currentRun,
      total: totalRuns,
      status: 'running',
      hasStats: false,
      ...skippedStatus,
      ...timingStatus
    };
  }

  const stats = statsCalculator.calculateStatistics();
  const remainingRuns = totalRuns - currentRun + 1;
  const estimatedTimeRemaining = stats.averageRunTime * remainingRuns;
  const rankPointsBreakdown = Object.keys(stats.rankPointsCounts)
    .map(points => parseInt(points))
    .sort((a, b) => b - a)
    .map(rankPoints => ({
      rankPoints,
      count: stats.rankPointsCounts[rankPoints],
      rate: stats.totalRuns > 0
        ? (stats.rankPointsCounts[rankPoints] / stats.totalRuns * 100).toFixed(2)
        : '0.00'
    }));

  return {
    current: currentRun,
    total: totalRuns,
    status: 'running',
    hasStats: true,
    avgRunTime: stats.averageRunTime.toFixed(0),
    estimatedTimeRemaining: formatDurationWholeSeconds(estimatedTimeRemaining),
    totalTimeFormatted: timing ? formatDurationWholeSeconds(performance.now() - timing.startTime) : null,
    completionRate: stats.completionRate,
    skippedRuns: stats.skippedRuns,
    skippedRate: stats.skippedRate,
    completedRuns: stats.completedRuns,
    totalRunsInStats: stats.totalRuns,
    sPlusRate: stats.sPlusRate,
    sPlusCount: stats.sPlusCount,
    rankPointsBreakdown,
    minTicks: stats.minTicks,
    maxTicks: stats.maxTicks,
    minDefeatTicks: stats.minDefeatTicks,
    maxDefeatTicks: stats.maxDefeatTicks,
    medianTicks: Math.round(stats.medianTicks),
    averageEstimatedExp: stats.averageEstimatedExp,
    totalEstimatedExp: stats.totalEstimatedExp,
    hasWins: stats.completedRuns > 0,
    estimateExperience: config.estimateExperience && stats.averageEstimatedExp > 0
  };
}

// Helper function to update status callback
function updateStatusCallback(currentRun, totalRuns, statsCalculator, statusCallback, timing = null, perf = null) {
  if (!statusCallback) return;
  const buildStart = perf ? performance.now() : 0;
  const status = buildAnalysisStatus(currentRun, totalRuns, statsCalculator, timing);
  if (perf) {
    perf.recordStatusBuild(performance.now() - buildStart);
  }
  statusCallback(status);
}

// Helper function to process a single analysis run
async function processSingleRun(runIndex, thisAnalysisId, statsCalculator, bestRuns, timing, perf = null) {
  // Generate a new unique seed for this run
  const runSeed = Math.floor((Date.now() * Math.random()) % 2147483647);
  
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
      if (perf) {
        perf.stoppedDuringRun = runIndex;
      }
      console.log('[Board Analyzer] Analysis stopped during run', runIndex,
        `(${statsCalculator.totalRuns} completed)`);
      return null;
    }
    
    // Skipped runs should not persist data (ticks/replay/seed/exp).
    if (!result.skipped) {
      // Add seed to result
      result.seed = runSeed;
      
      // Estimate experience if enabled
      if (config.estimateExperience) {
        result.estimatedExp = estimateRunExperience(result.completed);
      }
    }
    
    const { ticks, grade, rankPoints, completed } = result;
    
    // Use statistics calculator to track stats efficiently
    const runTime = performance.now() - timing.lastRunStart;
    statsCalculator.addRun(result, runTime);
    
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
  if (result.skipped) {
    return false;
  }
  
  if (completed) {
    // Update min ticks if this is a completed run with lower ticks
    if (ticks < statsCalculator.minTicks) {
      const boardData = getBoardData(seed);
      
      if (boardData) {
        bestRuns.bestTimeRun = {
          seed: seed,
          board: boardData
        };
        console.log(`[Board Analyzer] New best time: ${ticks} ticks (run ${runIndex})`);
      } else {
        console.warn('Failed to get board data for best time replay');
      }
    }
  }

  if (config.stopOnOutcome === 'victory' && completed) {
    console.log('Victory achieved, stopping analysis early');
    return true;
  }
  if (config.stopOnOutcome === 'defeat' && !completed) {
    console.log('Defeat encountered, stopping analysis early');
    return true;
  }
  
  if (grade === 'S+') {
    // If stopOnSPlus is enabled, we might want to exit early
    if (config.stopOnSPlus) {
      console.log('Achieved S+ grade, stopping analysis early');
      return true; // Signal to stop
    }
  }
  
  // Check if should stop for reaching the desired number of ticks or below
  if (config.stopWhenTicksReached > 0 && completed && ticks <= config.stopWhenTicksReached) {
    console.log(`[Board Analyzer] Target ticks reached: ${ticks} (run ${runIndex})`);
    
    const boardData = getBoardData(seed);
    
    if (boardData) {
      bestRuns.targetTicksRun = {
        seed: seed,
        board: boardData,
        ticks: ticks,
        grade: grade,
        rankPoints: rankPoints
      };
    } else {
      console.warn('Failed to get board data for target ticks replay');
    }
    
    return true; // Signal to stop
  }
  
  // Update max rank points (S+ only; addRun already bumped maxRankPoints on a new high)
  if (
    grade === 'S+' &&
    rankPoints != null &&
    rankPoints === statsCalculator.maxRankPoints &&
    statsCalculator.sPlusMaxPointsCount === 1
  ) {
    const boardData = getBoardData(seed);
    
    if (boardData) {
      bestRuns.bestScoreRun = {
        seed: seed,
        board: boardData
      };
      console.log(`[Board Analyzer] New max points: ${rankPoints} (run ${runIndex})`);
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
  }
  
  // Clean up game state tracker if no more listeners
  if (gameStateTracker && gameStateTracker.listeners.size === 0) {
    gameStateTracker.stopSubscription();
    gameStateTracker = null;
  }
  
  // Reset board data
  currentBoardData = null;
  
  // Re-enable Turbo Mode button after analysis
  if (window.turboButton) {
    window.turboButton.disabled = false;
    window.turboButton.title = '';
  }
  
  // Also restore Turbo Mode button text and style if it was modified
  if (window.turboButton && window.__turboState) {
    // Only restore if turbo is actually inactive (not re-enabled by user)
    if (!window.__turboState.active) {
      window.turboButton.textContent = t('mods.boardAnalyzer.enableTurboLabel');
      window.turboButton.style.background = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat";
      window.turboButton.style.color = "#ffe066";
    }
  }
}

// Main analyze function - refactored to use helper functions
async function analyzeBoard(runs = config.runs, statusCallback = null, perfTracker = null) {
  // Initialize analysis
  const thisAnalysisId = initializeAnalysis();
  if (!thisAnalysisId) {
    await sleep(ANALYSIS_STOP_DELAY_MS);
    return null;
  }
  
  // Capture floor BEFORE initializeAnalysisEnvironment() resets it
  try {
    const boardContext = globalThis.state.board.getSnapshot().context;
    if (typeof boardContext.floor !== 'undefined') {
      currentFloor = boardContext.floor;
    }
  } catch (error) {
    console.warn('[Board Analyzer] Error capturing floor before analysis:', error);
  }
  
  try {
    // Initialize analysis environment
    initializeAnalysisEnvironment();
    
    // Setup analysis state
    const { statsCalculator, bestRuns, timing } = setupAnalysisState();
    
    const perf = perfTracker || createAnalysisPerformanceTracker();

    // Prepare analysis environment
    const setupStart = performance.now();
    const modeSwitched = await prepareAnalysisEnvironment();
    perf.setupMs = performance.now() - setupStart;
    console.log('[Board Analyzer] Analyzing', currentRoomName || currentRoomId, 'floor', currentFloor ?? 0, `(${runs} planned runs)`);
    
    // Run the main analysis loop
    const loopStart = performance.now();
    const results = await runAnalysisLoop(runs, thisAnalysisId, statsCalculator, bestRuns, timing, statusCallback, perf);
    perf.loopMs = performance.now() - loopStart;
    
    // Calculate final statistics
    const totalTime = performance.now() - timing.startTime;
    const stats = statsCalculator.calculateStatistics();
    perf.runTimes = statsCalculator.runTimes;
    perf.runTimesSum = statsCalculator.runTimesSum;
    perf.totalWallMs = totalTime;
    perf.forceStopped = analysisState.forceStop;
    perf.plannedRuns = runs;
    perf.turboEnabled = config.enableTurboAutomatically && turboActive;
    perf.speedupFactor = config.speedupFactor;
    
    return {
      results,
      perf,
      summary: {
        runs,
        totalRuns: stats.totalRuns,
        completedRuns: stats.completedRuns,
        skippedRuns: stats.skippedRuns,
        sPlusCount: stats.sPlusCount,
        sPlusMaxPointsCount: stats.sPlusMaxPointsCount,
        sPlusRate: stats.sPlusRate,
        completionRate: stats.completionRate,
        skippedRate: stats.skippedRate,
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
        // Timing stats
        totalTimeMs: totalTime,
        totalTimeFormatted: formatDurationWholeSeconds(totalTime),
        averageRunTimeMs: stats.averageRunTime,
        averageRunTimeFormatted: formatMilliseconds(stats.averageRunTime),
        fastestRunTimeMs: stats.fastestRunTime,
        slowestRunTimeMs: stats.slowestRunTime,
        totalEstimatedExp: stats.totalEstimatedExp,
        averageEstimatedExp: stats.averageEstimatedExp
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

function formatMillisecondsPrecise(ms) {
  if (ms >= 1000) {
    return formatMilliseconds(ms);
  }
  if (ms >= 10) {
    return `${Math.round(ms)}ms`;
  }
  if (ms >= 1) {
    return `${ms.toFixed(1)}ms`;
  }
  if (ms > 0) {
    return `${ms.toFixed(2)}ms`;
  }
  return '0ms';
}

function formatDurationWholeSeconds(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function createAnalysisPerformanceTracker() {
  return {
    setupMs: 0,
    loopMs: 0,
    statusBuildCount: 0,
    statusBuildMs: 0,
    liveUiFlushCount: 0,
    liveUiFlushMs: 0,
    recordStatusBuild(ms) {
      this.statusBuildCount++;
      this.statusBuildMs += ms;
    },
    recordLiveUiFlush(ms) {
      this.liveUiFlushCount++;
      this.liveUiFlushMs += ms;
    }
  };
}

function logAnalysisPerformanceSummary(perf, metrics) {
  const {
    runTimes,
    runTimesSum,
    totalWallMs,
    forceStopped,
    plannedRuns
  } = metrics;
  const runsExecuted = runTimes.length;
  const runsPerSecond = totalWallMs > 0 ? runsExecuted / (totalWallMs / 1000) : 0;
  const loopOverheadMs = Math.max(0, perf.loopMs - runTimesSum);
  const turboOn = perf.turboEnabled;
  const speedupFactor = perf.speedupFactor ?? config.speedupFactor;

  const summary = {
    plannedRuns,
    runsExecuted,
    forceStopped: !!forceStopped,
    ...(perf.stoppedDuringRun ? { stoppedDuringRun: perf.stoppedDuringRun } : {}),
    wallClock: {
      total: formatMilliseconds(totalWallMs),
      setup: formatMilliseconds(perf.setupMs),
      loop: formatMilliseconds(perf.loopMs)
    },
    throughput: runsExecuted > 0
      ? `${runsPerSecond.toFixed(1)} runs/s`
      : '0 runs/s',
    perRunWall: runsExecuted > 0 ? {
      avg: formatMilliseconds(runTimesSum / runsExecuted),
      min: formatMilliseconds(Math.min(...runTimes)),
      max: formatMilliseconds(Math.max(...runTimes))
    } : null,
    scriptOverhead: {
      loopCallbacks: formatMilliseconds(loopOverheadMs),
      statusBuilds: {
        count: perf.statusBuildCount,
        total: formatMilliseconds(perf.statusBuildMs),
        avg: perf.statusBuildCount > 0
          ? formatMillisecondsPrecise(perf.statusBuildMs / perf.statusBuildCount)
          : '0ms'
      },
      liveUiUpdates: {
        count: perf.liveUiFlushCount,
        total: formatMilliseconds(perf.liveUiFlushMs),
        avg: perf.liveUiFlushCount > 0
          ? formatMillisecondsPrecise(perf.liveUiFlushMs / perf.liveUiFlushCount)
          : '0ms'
      }
    },
    runtime: {
      turbo: turboOn ? `on (${speedupFactor}x)` : 'off',
      liveStats: config.showAdvancedLiveStats ? 'advanced' : 'basic',
      liveStatsThrottleMs: LIVE_STATS_THROTTLE_MS
    }
  };

  console.log('[Board Analyzer] Performance summary:', summary);
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
  
  if (textarea.parentNode) {
    textarea.parentNode.removeChild(textarea);
  }
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

  // Estimate experience checkbox
  const estimateExpContainer = document.createElement('div');
  estimateExpContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  const estimateExpInput = document.createElement('input');
  estimateExpInput.type = 'checkbox';
  estimateExpInput.id = 'estimate-exp-input';
  estimateExpInput.checked = config.estimateExperience;

  const estimateExpLabel = document.createElement('label');
  estimateExpLabel.htmlFor = 'estimate-exp-input';
  estimateExpLabel.textContent = t('mods.boardAnalyzer.estimateExperienceLabel');

  estimateExpContainer.appendChild(estimateExpInput);
  estimateExpContainer.appendChild(estimateExpLabel);
  content.appendChild(estimateExpContainer);

  // Advanced live stats checkbox
  const advancedLiveStatsContainer = document.createElement('div');
  advancedLiveStatsContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  const advancedLiveStatsInput = document.createElement('input');
  advancedLiveStatsInput.type = 'checkbox';
  advancedLiveStatsInput.id = 'advanced-live-stats-input';
  advancedLiveStatsInput.checked = config.showAdvancedLiveStats;

  const advancedLiveStatsLabel = document.createElement('label');
  advancedLiveStatsLabel.htmlFor = 'advanced-live-stats-input';
  advancedLiveStatsLabel.textContent = t('mods.boardAnalyzer.showAdvancedLiveStatsLabel');

  advancedLiveStatsContainer.appendChild(advancedLiveStatsInput);
  advancedLiveStatsContainer.appendChild(advancedLiveStatsLabel);
  content.appendChild(advancedLiveStatsContainer);

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

  // Stop on any victory/defeat checkbox
  const stopVictoryContainer = document.createElement('div');
  stopVictoryContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  const stopVictoryInput = document.createElement('input');
  stopVictoryInput.type = 'checkbox';
  stopVictoryInput.id = 'stop-victory-input';
  stopVictoryInput.checked = !!config.stopOnOutcome;

  const stopVictoryLabel = document.createElement('label');
  stopVictoryLabel.htmlFor = 'stop-victory-input';
  stopVictoryLabel.textContent = t('mods.boardAnalyzer.stopOnAnyOutcomeLabel');

  const stopOutcomeToggle = document.createElement('button');
  stopOutcomeToggle.type = 'button';
  stopOutcomeToggle.id = 'stop-outcome-toggle';

  function applyStopOutcomeToggle(outcome, enabled) {
    const isVictory = outcome !== 'defeat';
    stopOutcomeToggle.dataset.outcome = isVictory ? 'victory' : 'defeat';
    stopOutcomeToggle.textContent = t(isVictory ? 'mods.boardAnalyzer.stopOutcomeVictory' : 'mods.boardAnalyzer.stopOutcomeDefeat');
    stopOutcomeToggle.disabled = !enabled;
    const base = 'padding: 4px 14px; border-radius: 4px; border: 1px solid; font-weight: 600; min-width: 72px; text-transform: capitalize;';
    if (!enabled) {
      stopOutcomeToggle.style.cssText = `${base} background-color: #555; border-color: #666; color: #aaa; cursor: not-allowed; opacity: 0.6;`;
    } else if (isVictory) {
      stopOutcomeToggle.style.cssText = `${base} background-color: #2ecc71; border-color: #27ae60; color: #fff; cursor: pointer;`;
    } else {
      stopOutcomeToggle.style.cssText = `${base} background-color: #e74c3c; border-color: #c0392b; color: #fff; cursor: pointer;`;
    }
  }

  applyStopOutcomeToggle(
    config.stopOnOutcome === 'defeat' ? 'defeat' : 'victory',
    stopVictoryInput.checked
  );

  stopOutcomeToggle.addEventListener('click', () => {
    if (stopOutcomeToggle.disabled) return;
    const next = stopOutcomeToggle.dataset.outcome === 'victory' ? 'defeat' : 'victory';
    applyStopOutcomeToggle(next, true);
  });

  stopVictoryContainer.appendChild(stopVictoryInput);
  stopVictoryContainer.appendChild(stopVictoryLabel);
  stopVictoryContainer.appendChild(stopOutcomeToggle);
  content.appendChild(stopVictoryContainer);

  stopSPlusInput.addEventListener('change', () => {
    if (stopSPlusInput.checked) {
      stopVictoryInput.checked = false;
      applyStopOutcomeToggle(stopOutcomeToggle.dataset.outcome, false);
    }
  });
  stopVictoryInput.addEventListener('change', () => {
    applyStopOutcomeToggle(stopOutcomeToggle.dataset.outcome, stopVictoryInput.checked);
    if (stopVictoryInput.checked) {
      stopSPlusInput.checked = false;
    }
  });

  // Stop after ticks input
  const stopTicksContainer = document.createElement('div');
  stopTicksContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
  
  const stopTicksLabel = document.createElement('label');
  stopTicksLabel.textContent = 'Skip runs over N ticks (0 to disable):';
  
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
            title: t('mods.boardAnalyzer.cannotStartTitle'),
            content: t('mods.boardAnalyzer.noAllyWarning'),
            buttons: [{ text: t('controls.ok'), primary: true }]
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
    const stopSPlusEl = document.getElementById('stop-splus-input');
    const stopVictoryEl = document.getElementById('stop-victory-input');
    const stopOutcomeEl = document.getElementById('stop-outcome-toggle');
    let stopOnSPlus = stopSPlusEl.checked;
    let stopOnOutcome = stopVictoryEl.checked ? stopOutcomeEl.dataset.outcome : false;
    if (stopOnSPlus && stopOnOutcome) {
      stopOnOutcome = false;
      stopVictoryEl.checked = false;
      applyStopOutcomeToggle(stopOutcomeEl.dataset.outcome, false);
    }
    config.stopOnSPlus = stopOnSPlus;
    config.stopOnOutcome = stopOnOutcome;
    config.stopAfterTicks = parseInt(document.getElementById('stop-ticks-input').value, 10);
    config.stopWhenTicksReached = parseInt(document.getElementById('stop-when-ticks-input').value, 10);
    config.estimateExperience = document.getElementById('estimate-exp-input').checked;
    config.showAdvancedLiveStats = document.getElementById('advanced-live-stats-input').checked;
    
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
  clearBoardAnalyzerModalLayoutCleanup();
  modalManager.closeAll();
}

// Helper function to close running modal specifically
function closeRunningModal() {
  try {
    clearBoardAnalyzerModalLayoutCleanup();
    modalManager.close('running-modal');
    activeRunningModal = null;
  } catch (error) {
    console.warn('[Board Analyzer] Error closing running modal:', error);
  }
}

function appendLiveStatRow(container, labelText, valueId, valueStyle = 'text-align: right;') {
  const label = document.createElement('div');
  label.textContent = labelText;
  label.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

  const value = document.createElement('div');
  value.id = valueId;
  value.textContent = '—';
  value.style.cssText = valueStyle;

  container.appendChild(label);
  container.appendChild(value);
}

function updateTimingStatsDisplay(status) {
  if (status.totalTimeFormatted) {
    const totalTimeEl = document.getElementById('analysis-live-total-time');
    if (totalTimeEl) totalTimeEl.textContent = status.totalTimeFormatted;
  }

  if (status.avgRunTime != null) {
    const avgRunTimeEl = document.getElementById('analysis-avg-run-time');
    if (avgRunTimeEl) {
      avgRunTimeEl.textContent = `${t('mods.boardAnalyzer.avgRunTimeLabel')} ${status.avgRunTime}ms`;
    }

    const liveAvgRunTimeEl = document.getElementById('analysis-live-avg-run-time');
    if (liveAvgRunTimeEl) {
      liveAvgRunTimeEl.textContent = `${status.avgRunTime}ms`;
    }
  }

  if (status.estimatedTimeRemaining) {
    const estimatedTimeEl = document.getElementById('analysis-estimated-time');
    if (estimatedTimeEl) {
      estimatedTimeEl.textContent = `${t('mods.boardAnalyzer.estimatedTimeRemainingLabel')} ${status.estimatedTimeRemaining}`;
    }

    const liveEstimatedTimeEl = document.getElementById('analysis-live-estimated-time');
    if (liveEstimatedTimeEl) {
      liveEstimatedTimeEl.textContent = status.estimatedTimeRemaining;
    }
  }
}

function updateSkippedRunsDisplay(status) {
  const skippedRate = status.skippedRate ?? '0.00';
  const skippedRuns = status.skippedRuns ?? 0;
  const totalRunsInStats = status.totalRunsInStats ?? 0;
  const showSkipped = skippedRuns > 0;

  const skippedRunsEl = document.getElementById('analysis-skipped-runs');
  if (skippedRunsEl) {
    skippedRunsEl.style.display = showSkipped ? '' : 'none';
    if (showSkipped) {
      skippedRunsEl.style.color = SKIPPED_RUN_COLOR;
      skippedRunsEl.textContent = `Skipped runs ${skippedRate}% (${skippedRuns}/${totalRunsInStats})`;
    }
  }

  const skippedSection = document.getElementById('analysis-live-skipped-section');
  if (skippedSection) {
    skippedSection.style.display = showSkipped ? 'contents' : 'none';
  }

  const skippedEl = document.getElementById('analysis-live-skipped-runs');
  if (skippedEl && showSkipped) {
    skippedEl.textContent = `${skippedRate}% (${skippedRuns}/${totalRunsInStats})`;
    skippedEl.style.color = SKIPPED_RUN_COLOR;
  }
}

function updateBasicLiveStatsDisplay(status) {
  const completionRateEl = document.getElementById('analysis-completion-rate');

  if (completionRateEl) {
    const isComplete = parseFloat(status.completionRate) === 100;
    completionRateEl.style.color = isComplete ? '#2ecc71' : '#aaa';
    completionRateEl.textContent = `${t('mods.boardAnalyzer.completionRateLabel')} ${status.completionRate}%`;
  }
}

function updateAdvancedLiveStatsDisplay(status) {
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setText('analysis-live-splus-rate', `${status.sPlusRate}% (${status.sPlusCount}/${status.totalRunsInStats})`);

  const sPlusBreakdownEl = document.getElementById('analysis-live-splus-breakdown');
  if (sPlusBreakdownEl) {
    sPlusBreakdownEl.replaceChildren();
    if (status.rankPointsBreakdown.length > 0) {
      const highestRankPoints = status.rankPointsBreakdown[0].rankPoints;
      status.rankPointsBreakdown.forEach(({ rankPoints, count, rate }) => {
        const label = document.createElement('div');
        label.textContent = t('mods.boardAnalyzer.sPlusMaxPointsRateLabel').replace('{points}', rankPoints);
        label.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 10px; font-style: italic;';

        const value = document.createElement('div');
        value.textContent = `${rate}% (${count}/${status.totalRunsInStats})`;
        const textColor = getSPlusRankTextColor(highestRankPoints, rankPoints);
        value.style.cssText = `text-align: right; color: ${textColor}; font-style: italic;`;

        sPlusBreakdownEl.appendChild(label);
        sPlusBreakdownEl.appendChild(value);
      });
    }
  }

  const completionEl = document.getElementById('analysis-live-completion-rate');
  if (completionEl) {
    completionEl.textContent = `${status.completionRate}% (${status.completedRuns}/${status.totalRunsInStats})`;
    completionEl.style.color = parseFloat(status.completionRate) === 100 ? '#2ecc71' : 'green';
  }
  const minLabelEl = document.getElementById('analysis-live-min-time-label');
  const maxLabelEl = document.getElementById('analysis-live-max-time-label');
  if (minLabelEl) {
    minLabelEl.textContent = status.hasWins
      ? t('mods.boardAnalyzer.minTimeLabel')
      : t('mods.boardAnalyzer.minDefeatTimeLabel');
  }
  if (maxLabelEl) {
    maxLabelEl.textContent = status.hasWins
      ? t('mods.boardAnalyzer.maxTimeLabel')
      : t('mods.boardAnalyzer.maxDefeatTimeLabel');
  }

  const minTicks = status.hasWins ? status.minTicks : status.minDefeatTicks;
  const maxTicks = status.hasWins ? status.maxTicks : status.maxDefeatTicks;
  setText('analysis-live-min-time', `${minTicks} ${t('mods.boardAnalyzer.ticksSuffix')}`);
  setText('analysis-live-max-time', `${maxTicks} ${t('mods.boardAnalyzer.ticksSuffix')}`);
  setText('analysis-live-median-time', `${status.medianTicks} ${t('mods.boardAnalyzer.ticksSuffix')}`);

  const expSection = document.getElementById('analysis-live-exp-section');
  if (expSection) {
    expSection.style.display = status.estimateExperience ? 'contents' : 'none';
    if (status.estimateExperience) {
      setText('analysis-live-avg-exp', `${status.averageEstimatedExp.toLocaleString()} XP`);
      setText('analysis-live-total-exp', `${status.totalEstimatedExp.toLocaleString()} XP`);
    }
  }

  if (status.totalTimeFormatted) {
    setText('analysis-live-total-time', status.totalTimeFormatted);
  }
}

function updateLiveStatsDisplay(status) {
  const progressEl = document.getElementById('analysis-progress');
  if (progressEl) {
    progressEl.textContent = t('mods.boardAnalyzer.progressText')
      .replace('{current}', status.current)
      .replace('{total}', status.total);
  }

  updateSkippedRunsDisplay(status);
  updateTimingStatsDisplay(status);

  if (!status.hasStats) return;

  let structureChanged = false;
  if (config.showAdvancedLiveStats) {
    const breakdown = document.getElementById('analysis-live-splus-breakdown');
    const expSection = document.getElementById('analysis-live-exp-section');
    const prevBreakdownCount = breakdown?.childElementCount ?? 0;
    const prevExpVisible = expSection?.style.display === 'contents';
    updateAdvancedLiveStatsDisplay(status);
    structureChanged = (breakdown?.childElementCount ?? 0) !== prevBreakdownCount
      || (expSection?.style.display === 'contents') !== prevExpVisible;
  } else {
    updateBasicLiveStatsDisplay(status);
  }

  if (structureChanged) {
    scheduleBoardAnalyzerModalLayoutRefresh();
  }
}

function createLiveStatsThrottler(onFlush, perf = null) {
  let pendingStatus = null;
  let timerId = null;
  let lastFlushAt = 0;

  return {
    schedule(status) {
      pendingStatus = status;
      const now = Date.now();
      const elapsed = now - lastFlushAt;
      if (elapsed >= LIVE_STATS_THROTTLE_MS) {
        this.flush();
        return;
      }
      if (timerId === null) {
        timerId = setTimeout(() => this.flush(), LIVE_STATS_THROTTLE_MS - elapsed);
      }
    },
    flush() {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (!pendingStatus) return;
      lastFlushAt = Date.now();
      const status = pendingStatus;
      pendingStatus = null;
      const flushStart = perf ? performance.now() : 0;
      onFlush(status);
      if (perf) {
        perf.recordLiveUiFlush(performance.now() - flushStart);
      }
    },
    cancel() {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      pendingStatus = null;
    }
  };
}

function appendBasicLiveStats(content) {
  const avgRunTimeInfo = document.createElement('p');
  avgRunTimeInfo.id = 'analysis-avg-run-time';
  avgRunTimeInfo.style.cssText = 'margin-top: 6px; margin-bottom: 2px; font-size: 0.85em; color: #aaa;';
  avgRunTimeInfo.textContent = `${t('mods.boardAnalyzer.avgRunTimeLabel')} —`;
  content.appendChild(avgRunTimeInfo);

  const estimatedTimeInfo = document.createElement('p');
  estimatedTimeInfo.id = 'analysis-estimated-time';
  estimatedTimeInfo.style.cssText = 'margin-top: 2px; margin-bottom: 2px; font-size: 0.85em; color: #aaa;';
  estimatedTimeInfo.textContent = `${t('mods.boardAnalyzer.estimatedTimeRemainingLabel')} —`;
  content.appendChild(estimatedTimeInfo);

  const completionRateInfo = document.createElement('p');
  completionRateInfo.id = 'analysis-completion-rate';
  completionRateInfo.style.cssText = 'margin-top: 6px; margin-bottom: 2px; font-size: 0.85em; color: #aaa;';
  completionRateInfo.textContent = `${t('mods.boardAnalyzer.completionRateLabel')} —`;
  content.appendChild(completionRateInfo);

  const skippedRunsInfo = document.createElement('p');
  skippedRunsInfo.id = 'analysis-skipped-runs';
  skippedRunsInfo.style.cssText = `display: none; margin-top: 2px; margin-bottom: 2px; font-size: 0.85em; color: ${SKIPPED_RUN_COLOR};`;
  skippedRunsInfo.textContent = 'Skipped runs —';
  content.appendChild(skippedRunsInfo);
}

function appendAdvancedLiveStats(content) {
  const statsContainer = document.createElement('div');
  statsContainer.id = 'analysis-live-stats';
  statsContainer.style.cssText = `display: grid; grid-template-columns: 130px auto; gap: ${BOARD_ANALYZER_UI.STATS_GRID_GAP}px; margin-bottom: ${BOARD_ANALYZER_UI.STATS_MARGIN_BOTTOM}px; text-align: left; font-size: ${BOARD_ANALYZER_UI.LIVE_STATS_FONT_SIZE};`;

  appendLiveStatRow(statsContainer, t('mods.boardAnalyzer.sPlusRateLabel'), 'analysis-live-splus-rate', 'text-align: right; color: #FFD700;');

  const sPlusBreakdown = document.createElement('div');
  sPlusBreakdown.id = 'analysis-live-splus-breakdown';
  sPlusBreakdown.style.cssText = 'display: contents;';
  statsContainer.appendChild(sPlusBreakdown);

  appendLiveStatRow(statsContainer, t('mods.boardAnalyzer.completionRateLabel'), 'analysis-live-completion-rate', 'text-align: right; color: green;');

  const skippedSection = document.createElement('div');
  skippedSection.id = 'analysis-live-skipped-section';
  skippedSection.style.cssText = 'display: none;';
  appendLiveStatRow(skippedSection, 'Skipped runs', 'analysis-live-skipped-runs', `text-align: right; color: ${SKIPPED_RUN_COLOR};`);
  statsContainer.appendChild(skippedSection);

  const minTimeLabel = document.createElement('div');
  minTimeLabel.id = 'analysis-live-min-time-label';
  minTimeLabel.textContent = t('mods.boardAnalyzer.minTimeLabel');
  minTimeLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
  const minTimeValue = document.createElement('div');
  minTimeValue.id = 'analysis-live-min-time';
  minTimeValue.textContent = '—';
  minTimeValue.style.cssText = 'text-align: right;';
  statsContainer.appendChild(minTimeLabel);
  statsContainer.appendChild(minTimeValue);

  const maxTimeLabel = document.createElement('div');
  maxTimeLabel.id = 'analysis-live-max-time-label';
  maxTimeLabel.textContent = t('mods.boardAnalyzer.maxTimeLabel');
  maxTimeLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
  const maxTimeValue = document.createElement('div');
  maxTimeValue.id = 'analysis-live-max-time';
  maxTimeValue.textContent = '—';
  maxTimeValue.style.cssText = 'text-align: right;';
  statsContainer.appendChild(maxTimeLabel);
  statsContainer.appendChild(maxTimeValue);

  appendLiveStatRow(statsContainer, t('mods.boardAnalyzer.medianTimeLabel'), 'analysis-live-median-time');

  const expSection = document.createElement('div');
  expSection.id = 'analysis-live-exp-section';
  expSection.style.cssText = 'display: none;';
  appendLiveStatRow(expSection, t('mods.boardAnalyzer.avgEstimatedExpLabel'), 'analysis-live-avg-exp', 'text-align: right; color: #9b59b6;');
  appendLiveStatRow(expSection, t('mods.boardAnalyzer.totalEstimatedExpLabel'), 'analysis-live-total-exp', 'text-align: right; color: #9b59b6;');
  statsContainer.appendChild(expSection);

  statsContainer.appendChild(createBoardAnalyzerStatsDivider());

  appendLiveStatRow(statsContainer, t('mods.boardAnalyzer.totalTimeLabel'), 'analysis-live-total-time');
  appendLiveStatRow(statsContainer, t('mods.boardAnalyzer.avgRunTimeLabel'), 'analysis-live-avg-run-time');
  appendLiveStatRow(statsContainer, t('mods.boardAnalyzer.estimatedTimeRemainingLabel'), 'analysis-live-estimated-time');

  content.appendChild(statsContainer);
}

// Call this function when starting a new analysis
function showRunningAnalysisModal(currentRun, totalRuns, liveStatus = null) {
  // First, force close any existing modals
  forceCloseAllModals();
  
  const content = document.createElement('div');
  content.className = 'board-analyzer-modal-content';
  content.style.cssText = 'text-align: center;';
  
  const message = document.createElement('p');
  message.textContent = t('mods.boardAnalyzer.runningText');
  message.style.cssText = 'margin: 0;';
  content.appendChild(message);
  
  const progress = document.createElement('p');
  progress.id = 'analysis-progress';
  progress.textContent = t('mods.boardAnalyzer.progressText')
    .replace('{current}', currentRun)
    .replace('{total}', totalRuns);
  progress.style.cssText = `margin-top: ${BOARD_ANALYZER_UI.PROGRESS_MARGIN_Y}px; margin-bottom: ${BOARD_ANALYZER_UI.PROGRESS_MARGIN_Y}px;`;
  content.appendChild(progress);

  if (config.showAdvancedLiveStats) {
    appendAdvancedLiveStats(content);
  } else {
    appendBasicLiveStats(content);
  }

  if (liveStatus) {
    updateLiveStatsDisplay(liveStatus);
  }

  let modalTitle = t('mods.boardAnalyzer.runningTitle');
  if (currentFloor !== null && currentFloor !== undefined) {
    modalTitle += ` ${t('mods.boardAnalyzer.resultTitleFloorSuffix').replace('{floor}', currentFloor)}`;
  }
  
  const modalDimensions = getBoardAnalyzerModalDimensions();

  const modal = api.ui.components.createModal({
    title: modalTitle,
    width: modalDimensions.width,
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
          }
          
          // Update UI
          const progressEl = document.getElementById('analysis-progress');
          if (progressEl) {
            progressEl.textContent += t('mods.boardAnalyzer.stoppingProgressSuffix');
            progressEl.style.color = '#e74c3c';
          }
          
          const stopButton = event.target;
          if (stopButton) {
            stopButton.disabled = true;
            stopButton.textContent = t('mods.boardAnalyzer.stoppingLabel');
          }
        }
      }
    ]
  });
  
  // Register modal with modal manager for efficient management
  modal.type = MODAL_TYPES.RUNNING;
  modalManager.register('running-modal', modal);

  attachBoardAnalyzerModalCloseCleanup(modal);

  const runningModalElement = modal?.element
    || document.querySelector('div[role="dialog"][data-state="open"]');
  if (runningModalElement) {
    runningModalElement.id = 'board-analyzer-running-modal';
    runningModalElement.dataset.analyzerModal = 'running';
    if (runningModalElement.classList) {
      runningModalElement.classList.add('board-analyzer-modal');
    }
  }

  requestAnimationFrame(() => {
    setupBoardAnalyzerModalResponsiveLayout(modal, content);
  });

  activeRunningModal = modal;
  return modal;
}

// Show the analysis results modal
function showResultsModal(results) {
  // Small delay to ensure UI is clean
  setTimeout(() => {
    const content = document.createElement('div');
    content.className = 'board-analyzer-modal-content';
    
    // Create EventManager for modal's event listeners
    const modalEventManager = new EventManager();
    let chartRenderer = null;
    
    // Add a partial results note if the analysis was forcefully stopped
    if (results.summary.forceStopped) {
      const partialNote = document.createElement('div');
      partialNote.textContent = t('mods.boardAnalyzer.partialResultsNote');
      partialNote.style.cssText = `text-align: center; color: #e74c3c; margin-bottom: ${BOARD_ANALYZER_UI.NOTE_MARGIN_BOTTOM}px;`;
      content.appendChild(partialNote);
    }
    
    // Create result statistics
    const statsContainer = document.createElement('div');
    statsContainer.style.cssText = `display: grid; grid-template-columns: 130px auto; gap: ${BOARD_ANALYZER_UI.STATS_GRID_GAP}px; margin-bottom: ${BOARD_ANALYZER_UI.STATS_MARGIN_BOTTOM}px;`;
    
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
        
        const highestRankPoints = sortedRankPoints[0];
        const textColor = getSPlusRankTextColor(highestRankPoints, rankPoints);
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

    const skippedRateLabel = document.createElement('div');
    skippedRateLabel.textContent = 'Skipped runs';
    skippedRateLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

    const skippedRateValue = document.createElement('div');
    skippedRateValue.textContent = `${results.summary.skippedRate}% (${results.summary.skippedRuns}/${results.summary.totalRuns})`;
    skippedRateValue.style.cssText = `text-align: right; color: ${SKIPPED_RUN_COLOR};`;
    
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
    totalTimeLabel.textContent = t('mods.boardAnalyzer.totalTimeLabel');
    totalTimeLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    
    const totalTimeValue = document.createElement('div');
    totalTimeValue.textContent = results.summary.totalTimeFormatted;
    totalTimeValue.style.cssText = 'text-align: right;';
    
    // Average run time
    const avgRunTimeLabel = document.createElement('div');
    avgRunTimeLabel.textContent = t('mods.boardAnalyzer.avgRunTimeLabel');
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
    if (results.summary.skippedRuns > 0) {
      statsContainer.appendChild(skippedRateLabel);
      statsContainer.appendChild(skippedRateValue);
    }
    statsContainer.appendChild(minTimeLabel);
    statsContainer.appendChild(minTimeValue);
    statsContainer.appendChild(maxTimeLabel);
    statsContainer.appendChild(maxTimeValue);
    statsContainer.appendChild(medianTimeLabel);
    statsContainer.appendChild(medianTimeValue);
    
    // Estimated Experience (only if enabled)
    if (config.estimateExperience && results.summary.averageEstimatedExp > 0) {
      const avgExpLabel = document.createElement('div');
      avgExpLabel.textContent = t('mods.boardAnalyzer.avgEstimatedExpLabel');
      avgExpLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

      const avgExpValue = document.createElement('div');
      avgExpValue.textContent = results.summary.averageEstimatedExp.toLocaleString() + ' XP';
      avgExpValue.style.cssText = 'text-align: right; color: #9b59b6;';

      const totalExpLabel = document.createElement('div');
      totalExpLabel.textContent = t('mods.boardAnalyzer.totalEstimatedExpLabel');
      totalExpLabel.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

      const totalExpValue = document.createElement('div');
      totalExpValue.textContent = results.summary.totalEstimatedExp.toLocaleString() + ' XP';
      totalExpValue.style.cssText = 'text-align: right; color: #9b59b6; cursor: help; text-decoration: underline solid; text-underline-offset: 3px;';

      // Build level-up tooltip for ally creatures
      try {
        const expToLevel = globalThis.state.utils.expToCurrentLevel;
        if (typeof expToLevel === 'function') {
          const boardContext = globalThis.state.board.getSnapshot().context;
          const playerMonsters = globalThis.state.player.getSnapshot().context.monsters;
          const pieces = boardContext.boardConfig || [];
          const totalXP = results.summary.totalEstimatedExp;

          const lines = [t('mods.boardAnalyzer.levelUpTooltipHeader')];
          for (const piece of pieces) {
            if (piece.type !== 'player') continue;
            const mon = playerMonsters.find(m => m.id === piece.databaseId);
            if (!mon) continue;
            let name = monsterGameIdsToNames.get(mon.gameId);
            if (!name) {
              try {
                const monData = globalThis.state.utils.getMonster(mon.gameId);
                name = monData?.metadata?.name;
              } catch (_) {}
            }
            if (!name) name = `Monster #${mon.gameId}`;
            const currentExp = mon.exp || 0;
            const currentLvl = expToLevel(currentExp);
            const newLvl = expToLevel(currentExp + totalXP);
            const gained = newLvl - currentLvl;
            lines.push(
              t('mods.boardAnalyzer.levelUpTooltipLine')
                .replace('{name}', name)
                .replace('{currentLvl}', currentLvl)
                .replace('{newLvl}', newLvl)
                .replace('{gained}', gained)
            );
          }
          if (lines.length > 1) {
            totalExpValue.title = lines.join('\n');
          }
        }
      } catch (e) {
        console.warn('[Board Analyzer] Error building level-up tooltip:', e);
      }

      statsContainer.appendChild(avgExpLabel);
      statsContainer.appendChild(avgExpValue);
      statsContainer.appendChild(totalExpLabel);
      statsContainer.appendChild(totalExpValue);
    }
    
    // Add timing stats
    statsContainer.appendChild(createBoardAnalyzerStatsDivider());
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
      copyTargetTicksButton.textContent = t('mods.boardAnalyzer.copyTargetTicksReplayButton');
      copyTargetTicksButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
      copyTargetTicksButton.style.cssText = `width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: ${BOARD_ANALYZER_UI.STATS_MARGIN_BOTTOM}px;`;
      
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
        errorMessage.textContent = t('mods.boardAnalyzer.chartErrorMessage');
        errorMessage.style.cssText = 'text-align: center; color: #e74c3c; margin-top: 15px; padding: 10px; border: 1px solid #e74c3c; border-radius: 4px;';
        content.appendChild(errorMessage);
      }
    } else {
      // Show a message if no results
      const noResultsMessage = document.createElement('p');
      noResultsMessage.textContent = t('mods.boardAnalyzer.noRunsMessage');
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

      clearBoardAnalyzerModalLayoutCleanup();
      
      // Clean up chart renderer event listeners
      if (chartRenderer) {
        chartRenderer.cleanup();
      }
      
      // Clean up modal's own event listeners
      modalEventManager.cleanup();
      
      // Remove ESC key listener
      if (escKeyListener) {
        document.removeEventListener('keydown', escKeyListener);
      }
      
      // Clear global results to free memory when modal closes
      if (window.__boardAnalyzerResults) {
        window.__boardAnalyzerResults = null;
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
    
    // Helper function to generate setup name and copy to clipboard
    const generateSetupName = () => {
      // Get completion rate
      const successPercent = Math.round(parseFloat(results.summary.completionRate));
      
      // Determine the best grade achieved
      let bestGrade = 'F';
      if (results.summary.sPlusCount > 0) {
        // If we have S+ runs, show S+ with the highest rank points
        bestGrade = `S+${results.summary.maxRankPoints}`;
      } else {
        // Find the best grade from all results
        const gradeOrder = { 'S': 1, 'A': 2, 'B': 3, 'C': 4, 'D': 5, 'E': 6, 'F': 7 };
        let bestGradeOrder = 7;
        
        for (const result of results.results) {
          const gradeVal = gradeOrder[result.grade] || 7;
          if (gradeVal < bestGradeOrder) {
            bestGradeOrder = gradeVal;
            bestGrade = result.grade;
          }
        }
      }
      
      // Get floor
      const floor = currentFloor !== null && currentFloor !== undefined ? currentFloor : 0;
      
      // Get min and median ticks
      const minTicks = Math.round(results.summary.minTicks);
      const medTicks = Math.round(results.summary.medianTicks);
      
      // Format: "{success percent}% {max rank} f{floor#} {mintick}min {medtick}med"
      const setupName = `${successPercent}% ${bestGrade} f${floor} ${minTicks}min ${medTicks}med`;
      
      // Copy to clipboard and return success status
      const success = copyToClipboard(setupName);
      return { success, setupName };
    };
    
    // Add Generate Setup button to content as a regular button to prevent modal closure
    const genNameButton = document.createElement('button');
    genNameButton.textContent = t('mods.boardAnalyzer.generateSetupNameButton');
    genNameButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
    genNameButton.style.cssText = `width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: ${BOARD_ANALYZER_UI.BUTTON_MARGIN_Y}px; margin-bottom: ${BOARD_ANALYZER_UI.BUTTON_MARGIN_Y}px;`;
    
    modalEventManager.addListener(genNameButton, 'click', () => {
      const { success, setupName } = generateSetupName();
      if (success) {
        showCopyNotification(t('mods.boardAnalyzer.setupNameCopiedNotification').replace('{name}', setupName));
      } else {
        showCopyNotification(t('mods.boardAnalyzer.setupNameCopyFailedNotification'), true);
      }
    });
    
    content.appendChild(genNameButton);
    
    // Show the results modal with a callback to clean up when closed
    let modalTitle = t('mods.boardAnalyzer.resultTitle');
    if (currentFloor !== null && currentFloor !== undefined) {
      modalTitle += ` ${t('mods.boardAnalyzer.resultTitleFloorSuffix').replace('{floor}', currentFloor)}`;
    }
    const modalDimensions = getBoardAnalyzerModalDimensions();
    const resultsModal = api.ui.components.createModal({
      title: modalTitle,
      width: modalDimensions.width,
      content: content,
      buttons: [
        {
          text: t('mods.boardAnalyzer.closeButton'),
          primary: true,
          onClick: cleanupResultsModal
        }
      ]
    });

    attachBoardAnalyzerModalCloseCleanup(resultsModal);

    requestAnimationFrame(() => {
      setupBoardAnalyzerModalResponsiveLayout(resultsModal, content);
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

    // Override the floor with the current floor being analyzed
    if (currentFloor !== null && currentFloor !== undefined) {
      boardData.floor = currentFloor;
    }

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

function getBoardAnalyzerToastContainer() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(BOARD_ANALYZER_TOAST_CONTAINER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = BOARD_ANALYZER_TOAST_CONTAINER_ID;
    el.style.cssText = 'position: fixed; z-index: 9999; inset: 16px 16px 64px; pointer-events: none;';
    document.body.appendChild(el);
  }
  return el;
}

function updateBoardAnalyzerToastPositions(container) {
  if (!container) return;
  container.querySelectorAll('.board-analyzer-toast-item').forEach((toast, index) => {
    toast.style.transform = `translateY(-${index * 46}px)`;
  });
}

function showBoardAnalyzerToast(message, options = {}) {
  const safeMsg = message != null ? String(message).replace(/</g, '&lt;') : '';
  const duration = typeof options.duration === 'number' ? options.duration : NOTIFICATION_DISPLAY_MS;
  try {
    const container = getBoardAnalyzerToastContainer();
    if (!container) return;
    const existingToasts = container.querySelectorAll('.board-analyzer-toast-item');
    const stackOffset = existingToasts.length * 46;
    const flexContainer = document.createElement('div');
    flexContainer.className = 'board-analyzer-toast-item';
    flexContainer.style.cssText = `display: flex; position: absolute; transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1); transform: translateY(-${stackOffset}px); bottom: 0px; right: 0px; justify-content: flex-end; pointer-events: none; width: max-content; max-width: 100%;`;
    const toast = document.createElement('button');
    toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
    toast.style.pointerEvents = 'auto';
    const widgetTop = document.createElement('div');
    widgetTop.className = 'widget-top h-2.5';
    const widgetBottom = document.createElement('div');
    widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';
    const messageDiv = document.createElement('div');
    messageDiv.className = 'text-left';
    messageDiv.style.flex = '1 1 auto';
    if (options.messageColor) messageDiv.style.color = options.messageColor;
    messageDiv.textContent = safeMsg;
    widgetBottom.appendChild(messageDiv);
    toast.appendChild(widgetTop);
    toast.appendChild(widgetBottom);
    flexContainer.appendChild(toast);
    container.appendChild(flexContainer);
    toast.addEventListener('click', () => {
      if (flexContainer.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        updateBoardAnalyzerToastPositions(container);
      }
    });
    setTimeout(() => {
      if (flexContainer.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        updateBoardAnalyzerToastPositions(container);
      }
    }, duration);
  } catch (e) {
    console.warn('[Board Analyzer] showBoardAnalyzerToast:', e);
  }
}

// Function to show copy notification
function showCopyNotification(message, isError = false) {
  showBoardAnalyzerToast(message, {
    duration: NOTIFICATION_DISPLAY_MS,
    messageColor: isError ? '#e74c3c' : undefined
  });
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
        } catch (e) {
          console.warn('[Board Analyzer] Error removing turbo subscription:', e);
        }
      }
      
      // Reset tick interval to default
      if (globalThis.state?.board?.getSnapshot()?.context?.world?.tickEngine) {
        try {
          const tickEngine = globalThis.state.board.getSnapshot().context.world.tickEngine;
          tickEngine.setTickInterval(62.5); // Reset to default tick interval
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
      window.turboButton.textContent = t('mods.boardAnalyzer.enableTurboLabel');
      window.turboButton.style.background = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat";
      window.turboButton.style.color = "#ffe066";
    }
  }
  
  // Close any existing modals using modal manager
  modalManager.closeByType(MODAL_TYPES.RUNNING);
  activeRunningModal = null;
  
  // Create a variable to store the running modal
  let runningModal = null;
  const perfTracker = createAnalysisPerformanceTracker();
  const liveStatsThrottler = createLiveStatsThrottler((status) => {
    updateLiveStatsDisplay(status);
  }, perfTracker);
  
  try {
    // Capture floor before showing the running modal
    try {
      const boardContext = globalThis.state.board.getSnapshot().context;
      if (typeof boardContext.floor !== 'undefined') {
        currentFloor = boardContext.floor;
      }
    } catch (error) {
      console.warn('[Board Analyzer] Error capturing floor for running modal:', error);
    }

    // Show the running analysis modal
    runningModal = showRunningAnalysisModal(0, config.runs);
    activeRunningModal = runningModal;
    
    // Run the analysis with status updates
    const results = await analyzeBoard(config.runs, (status) => {
      const hasLiveStatsUi = document.getElementById('analysis-progress')
        || document.getElementById('analysis-live-stats')
        || document.getElementById('analysis-avg-run-time');
      if (hasLiveStatsUi) {
        liveStatsThrottler.schedule(status);
      } else if (analysisState.isRunning()) {
        liveStatsThrottler.cancel();
        if (runningModal && runningModal.close) {
          runningModal.close();
        }
        runningModal = showRunningAnalysisModal(status.current, status.total, status);
        activeRunningModal = runningModal;
      }
    }, perfTracker);

    liveStatsThrottler.flush();

    if (results?.perf) {
      logAnalysisPerformanceSummary(results.perf, {
        runTimes: results.perf.runTimes || [],
        runTimesSum: results.perf.runTimesSum || 0,
        totalWallMs: results.perf.totalWallMs || 0,
        forceStopped: results.perf.forceStopped,
        plannedRuns: results.perf.plannedRuns || config.runs
      });
    }
    
    if (results?.summary) {
      const stoppedEarly = results.summary.forceStopped;
      const stoppedDuring = results.perf?.stoppedDuringRun;
      const completionNote = stoppedEarly
        ? stoppedDuring
          ? `(stopped early during run ${stoppedDuring})`
          : '(stopped early)'
        : '';
      console.log('[Board Analyzer] Analysis complete:', results.summary.totalRuns, 'runs completed',
        completionNote);
    }
    
    // Clear old results before storing new ones to prevent memory accumulation
    if (window.__boardAnalyzerResults) {
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
    
    api.ui.components.createModal({
      title: t('mods.boardAnalyzer.errorTitle'),
      content: t('mods.boardAnalyzer.errorText'),
      buttons: [{ text: t('mods.boardAnalyzer.closeButton'), primary: true }]
    });
  } finally {
    liveStatsThrottler.cancel();
  }
}


// Initialize UI
function init() {
  console.log('Board Analyzer initializing UI...');
  
  // Register with mod coordination system
  if (window.ModCoordination) {
    window.ModCoordination.registerMod('Board Analyzer', {
      priority: 200, // Highest priority (system task)
      metadata: { description: 'Board analysis system' }
    });
    window.ModCoordination.updateModState('Board Analyzer', { enabled: true });
  }
  
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
  
  installXpDebugFetchHook();

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
    uninstallXpDebugFetchHook();
    clearBoardAnalyzerModalLayoutCleanup();
    modalManager.closeAll();
    // Unregister from coordination system
    if (window.ModCoordination) {
      window.ModCoordination.unregisterMod('Board Analyzer');
    }
  }
};

