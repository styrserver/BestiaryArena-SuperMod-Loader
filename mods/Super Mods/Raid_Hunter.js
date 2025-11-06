// Raid Hunter Mod for Bestiary Arena
console.log('[Raid Hunter] Initializing...');

// ============================================================================
// 1. CONSTANTS
// ============================================================================

const MOD_ID = 'raid-hunter';
const RAID_CLOCK_ID = `${MOD_ID}-raid-clock`;

// Key event constants and helper (align with Rank Pointer)
const ESC_KEY_EVENT_INIT = {
    key: 'Escape',
    code: 'Escape',
    keyCode: 27,
    which: 27,
    bubbles: true,
    cancelable: true
};
function dispatchEsc() {
    try { document.dispatchEvent(new KeyboardEvent('keydown', ESC_KEY_EVENT_INIT)); } catch (_) {}
}

// Default settings
const DEFAULT_RAID_START_DELAY = 3; // Default delay in seconds

// Automation state
const AUTOMATION_ENABLED = true;
const AUTOMATION_DISABLED = false;

// UI Text Constants - Centralized text management for multi-language support
const UI_TEXT = {
    BUTTONS: {
        ENABLED: 'Enabled',
        SETTINGS: 'Settings',
        CLOSE: 'Close',
        START: 'Start',
        AUTO_SETUP: 'Auto-setup',
        REMOVE: 'Remove',
        CONFIRM: 'Confirm'
    },
    BUTTONS_PT: {
        ENABLED: 'Habilitado',
        SETTINGS: 'Configurações',
        CLOSE: 'Fechar',
        START: 'Iniciar',
        AUTO_SETUP: 'Autoconfigurar',
        REMOVE: 'Remover',
        CONFIRM: 'Confirmar'
    },
    LABELS: {
        RAID_START_DELAY: 'Raid Start Delay (seconds)',
        RAID_MAP_SELECTION: 'Select which raid maps to hunt:',
        AUTO_REFILL_STAMINA: 'Auto-refill Stamina',
        FASTER_AUTOPLAY: 'Faster Autoplay',
        ENABLE_AUTOPLANT: 'Enable Autoplant',
        WARNING_UNSELECTED: 'Unselected maps will be skipped'
    },
    LABELS_PT: {
        RAID_START_DELAY: 'Delay de Início do Raid (segundos)',
        RAID_MAP_SELECTION: 'Selecione quais mapas de raid caçar:',
        AUTO_REFILL_STAMINA: 'Recarregar Stamina Automaticamente',
        FASTER_AUTOPLAY: 'Autoplay Mais Rápido',
        ENABLE_AUTOPLANT: 'Ativar Vendedor Automático de Planta Dragão',
        WARNING_UNSELECTED: 'Mapas não selecionados serão ignorados'
    },
    TITLES: {
        RAID_HUNTER_SETTINGS: 'Raid Hunter Settings',
        AUTO_RAID_SETTINGS: 'Auto-Raid Settings',
        OTHER_SETTINGS: 'Other Settings'
    },
    TITLES_PT: {
        RAID_HUNTER_SETTINGS: 'Configurações do Raid Hunter',
        AUTO_RAID_SETTINGS: 'Configurações de Auto-Raid',
        OTHER_SETTINGS: 'Outras Configurações'
    },
    DESCRIPTIONS: {
        RAID_MAP_SELECTION_DESC: 'Select which raid maps you want to auto-raid when detected:'
    },
    DESCRIPTIONS_PT: {
        RAID_MAP_SELECTION_DESC: 'Selecione quais mapas de raid você quer auto-raidar quando detectados:'
    }
};

// Timing constants - Standardized across all mods
const NAVIGATION_DELAY = 500;           // Reduced from 1000ms for faster response
const AUTO_SETUP_DELAY = 800;          // New standardized delay
const AUTOPLAY_SETUP_DELAY = 500;      // New standardized delay
const AUTOMATION_CHECK_DELAY = 300;    // Reduced from 1000ms for faster response
const BESTIARY_INTEGRATION_DELAY = 300; // Reduced from 500ms for faster response
const BESTIARY_RETRY_DELAY = 1500;     // Reduced from 2000ms for faster response
const BESTIARY_INIT_WAIT = 2000;       // New standardized delay (was missing)

// Raid Hunter specific constants (not standardized)
const RAID_CLOCK_UPDATE_INTERVAL = 1000;
const RAID_FAILURE_RETRY_DELAY = 5000;
const NEXT_RAID_DELAY = 2000;
const QUEST_BUTTON_VALIDATION_INTERVAL = 30000;
const MODAL_OPEN_DELAY = 1000;

// User-configurable delays
const DEFAULT_START_DELAY = 3;         // 3 seconds default (user-configurable 1-10)
const MAX_START_DELAY = 10;            // 10 seconds maximum
const STAMINA_MONITOR_INTERVAL = 30000;
const RAID_STATUS_UPDATE_INTERVAL = 600000; // 10 minutes
const RAID_END_CHECK_INTERVAL = 30000;

// Stamina constants
const DEFAULT_STAMINA_COST = 30;

// Count
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_COUNT = 0;

// Priority levels for raid processing (matches user-facing tooltip: High/Medium/Low)
const RAID_PRIORITY = {
    HIGH: 1,    // High Priority - Highest priority, never yields
    MEDIUM: 2,  // Medium Priority - Yields to High Priority, never yields to Better Tasker
    LOW: 3       // Low Priority - Yields to Medium/High Priority and Better Tasker when active
};

// Colors
const COLOR_ACCENT = '#ffe066';
const COLOR_WHITE = '#fff';
const COLOR_GRAY = '#888';
const COLOR_RED = '#ff6b6b';
const COLOR_YELLOW = '#ffd93d';
const COLOR_GREEN = '#22c55e';
const COLOR_DARK_GREEN = '#16a34a';
const COLOR_DARK_GRAY = '#333';
const COLOR_BORDER = '#444';
const COLOR_BORDER_DARK = '#555';
const COLOR_LINK = '#666';
const COLOR_SUCCESS = '#4ade80';

// Helper function for automation state checks
function isAutomationActive() {
    return isAutomationEnabled === AUTOMATION_ENABLED;
}

// Priority conversion helpers (maps user-facing strings to internal constants)
function priorityStringToNumber(priorityString) {
    const p = (priorityString || 'low').toLowerCase();
    if (p === 'high') return RAID_PRIORITY.HIGH;
    if (p === 'medium') return RAID_PRIORITY.MEDIUM;
    if (p === 'low') return RAID_PRIORITY.LOW;
    return RAID_PRIORITY.LOW; // Default to low
}

function priorityNumberToString(priorityNumber) {
    if (priorityNumber === RAID_PRIORITY.HIGH) return 'high';
    if (priorityNumber === RAID_PRIORITY.MEDIUM) return 'medium';
    if (priorityNumber === RAID_PRIORITY.LOW) return 'low';
    return 'low'; // Default to low
}

function getPriorityLabel(priorityNumber, detailed = false) {
    if (priorityNumber === RAID_PRIORITY.HIGH) return 'HIGH';
    if (priorityNumber === RAID_PRIORITY.MEDIUM) return detailed ? 'MEDIUM (Medium Priority)' : 'MEDIUM';
    if (priorityNumber === RAID_PRIORITY.LOW) return 'LOW';
    return 'UNKNOWN';
}

// Helper function to get raid priority
function getRaidPriority(raidName) {
    try {
        const settings = loadSettings();
        const raidPriorities = settings.raidPriorities || {};
        const defaultPriorityString = EVENT_TEXTS.includes(raidName) ? 'medium' : 'low';
        const priorityString = raidPriorities[raidName] || defaultPriorityString;
        return priorityStringToNumber(priorityString);
    } catch (_) {
        // Default: static raids = MEDIUM, dynamic events = LOW
        return EVENT_TEXTS.includes(raidName) ? RAID_PRIORITY.MEDIUM : RAID_PRIORITY.LOW;
    }
}

// Track if all mods have finished loading
let allModsLoaded = false;

/**
 * Checks if Better Tasker is currently active and performing tasks
 * Since we wait for allModsLoaded signal, Better Tasker will always be initialized when this is called
 * @returns {boolean} - true if Better Tasker is active
 */
function isBetterTaskerActive() {
    try {
        // Check window.betterTaskerState (primary detection)
        if (!window.betterTaskerState) {
            return false;
        }
        
        const state = window.betterTaskerState;
        
        // Check if tasker is enabled (taskerState: 'enabled' or 'new_task_only')
        if (state.taskerState === 'disabled' || !state.taskerState) {
            return false;
        }
        
        // Check if Better Tasker has an active task
        if (state.hasActiveTask === true) {
            console.log('[Raid Hunter] ✅ Better Tasker ACTIVE');
            return true;
        }
        
        // Check if Better Tasker is currently hunting for a task
        if (state.taskHuntingOngoing === true) {
            console.log('[Raid Hunter] ✅ Better Tasker ACTIVE');
            return true;
        }
        
        // Check if Better Tasker is performing a task operation
        if (state.taskOperationInProgress === true) {
            console.log('[Raid Hunter] ✅ Better Tasker ACTIVE');
            return true;
        }
        
        // Check if Better Tasker is pending task completion
        if (state.pendingTaskCompletion === true) {
            console.log('[Raid Hunter] ✅ Better Tasker ACTIVE');
            return true;
        }
        
        // Check AutoplayManager owner as final fallback
        if (window.AutoplayManager?.getCurrentOwner && 
            window.AutoplayManager.getCurrentOwner() === 'Better Tasker') {
            console.log('[Raid Hunter] ✅ Better Tasker ACTIVE');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('[Raid Hunter] ⚠️ Error checking Better Tasker state:', error);
        return false;
    }
}

// Helper function to check if Better Boosted Maps is active
function isBoostedMapsActive() {
    try {
        // Method 1: Check global boostedMapsState
        if (window.boostedMapsState && window.boostedMapsState.isEnabled) {
            return window.boostedMapsState.isCurrentlyFarming === true;
        }
        // Method 2: Check AutoplayManager owner
        if (window.AutoplayManager && window.AutoplayManager.getCurrentOwner() === 'Better Boosted Maps') {
            return true;
        }
        return false;
    } catch (error) {
        console.error('[Raid Hunter] Error checking Better Boosted Maps status:', error);
        return false;
    }
}

// Helper function to check if raid processing can proceed based on priority
function canProcessRaidWithPriority(raidPriority, context = 'raid processing') {
    // Rank Pointer coordination: pause while Rank Pointer runs
    if (window.__modCoordination?.rankPointerRunning) {
        console.log(`[Raid Hunter] Rank Pointer running during ${context} - skipping`);
        return false;
    }
    // Board Analyzer always blocks (highest priority system task)
    if (isBoardAnalyzerRunning) {
        console.log(`[Raid Hunter] Board Analyzer running during ${context} - skipping`);
        return false;
    }
    
    // Automation must be enabled
    if (!isAutomationActive()) {
        console.log(`[Raid Hunter] Automation disabled during ${context} - skipping`);
        return false;
    }
    
    // High and Medium priority raids always proceed (do not yield to Better Tasker)
    if (raidPriority === RAID_PRIORITY.HIGH || raidPriority === RAID_PRIORITY.MEDIUM) {
        return true;
    }
    
    // Low priority raids yield to Better Tasker
    if (raidPriority === RAID_PRIORITY.LOW) {
        const betterTaskerState = window.betterTaskerState;
        
        // Check if Better Tasker is in "New Task+" mode - if so, allow low priority raids to proceed
        if (betterTaskerState && betterTaskerState.taskerState === 'new_task_only') {
            console.log(`[Raid Hunter] Better Tasker is in "New Task+" mode - low priority raid can proceed`);
            return true;
        }
        
        // Otherwise, check if Better Tasker is actively doing full automation (excluding "New Task+" mode)
        if (betterTaskerState && betterTaskerState.taskerState === 'enabled') {
            // Check for active task operations only in full automation mode
            if (betterTaskerState.hasActiveTask === true || 
                betterTaskerState.taskHuntingOngoing === true ||
                betterTaskerState.taskOperationInProgress === true ||
                betterTaskerState.pendingTaskCompletion === true) {
                console.log(`[Raid Hunter] Better Tasker is active (full automation) - low priority raid waiting`);
                return false;
            }
        }
        
        // Also check AutoplayManager owner for full automation mode only
        if (betterTaskerState && betterTaskerState.taskerState === 'enabled') {
            if (window.AutoplayManager?.getCurrentOwner && 
                window.AutoplayManager.getCurrentOwner() === 'Better Tasker') {
                console.log(`[Raid Hunter] Better Tasker has autoplay control (full automation) - low priority raid waiting`);
                return false;
            }
        }
        
        // Better Tasker not blocking - low priority raid can proceed
        console.log(`[Raid Hunter] Better Tasker not blocking - low priority raid can proceed`);
        return true;
    }
    
    return true;
}

// Helper function to check if raid processing can proceed (backwards compatibility)
function canProcessRaid(context = 'raid processing') {
    if (window.__modCoordination?.rankPointerRunning) {
        console.log(`[Raid Hunter] Rank Pointer running during ${context} - skipping`);
        return false;
    }
    if (isBoardAnalyzerRunning) {
        console.log(`[Raid Hunter] Board Analyzer running during ${context} - skipping`);
        return false;
    }
    if (!isAutomationActive()) {
        console.log(`[Raid Hunter] Automation disabled during ${context} - skipping`);
        return false;
    }
    return true;
}

// Helper function to cancel current raid and cleanup
function cancelCurrentRaid(reason = 'unknown') {
    console.log(`[Raid Hunter] Cancelling raid: ${reason}`);
    isCurrentlyRaiding = false;
    currentRaidInfo = null;
    restoreQuestButtonAppearance();
    stopAutoplayStateMonitoring();
    stopQuestButtonValidation();
    stopStaminaTooltipMonitoring();
}

// Static raid list (dynamic events are detected automatically from active raids not in this list)
const EVENT_TEXTS = [
    'Rat Plague',
    'Buzzing Madness', 
    'Monastery Catacombs',
    'Ghostlands Boneyard',
    'Permafrosted Hole',
    'Jammed Mailbox',
    'Frosted Bunker',
    'Hedge Maze Trap',
    'Tower of Whitewatch (Shield)',
    'Tower of Whitewatch (Helmet)',
    'Tower of Whitewatch (Armor)',
    'Orcish Barricade',
    'Poacher Cave (Bear)',
    'Poacher Cave (Wolf)',
    'Dwarven Bank Heist',
    'An Arcanist Ritual'
];

// Event to room ID mapping (FALLBACK ONLY - game state API is used first)
// Kept for backward compatibility if game state API is unavailable
const EVENT_TO_ROOM_MAPPING = {
    'Rat Plague': 'rkcent',
    'Buzzing Madness': 'crwasp',
    'Monastery Catacombs': 'crcat',
    'Ghostlands Boneyard': 'crghst4',
    'Permafrosted Hole': 'fhole',
    'Jammed Mailbox': 'fbox',
    'Frosted Bunker': 'fscave',
    'Hedge Maze Trap': 'abmazet',
    'Tower of Whitewatch (Shield)': 'aborca',
    'Tower of Whitewatch (Helmet)': 'aborcb',
    'Tower of Whitewatch (Armor)': 'aborcc',
    'Orcish Barricade': 'ofbar',
    'Poacher Cave (Bear)': 'kpob',
    'Poacher Cave (Wolf)': 'kpow',
    'Dwarven Bank Heist': 'vbank',
    'An Arcanist Ritual': 'vdhar'
};

// ============================================================================
// 1.1. STAMINA MONITORING FUNCTIONS
// ============================================================================

// Stamina tooltip monitoring state
let staminaTooltipObserver = null;
let staminaRecoveryCallback = null;

/**
 * Calculate current stamina using game state API
 * @returns {number} Current stamina amount
 */
function getCurrentStamina() {
    try {
        // Read stamina directly from DOM (same approach as Bestiary Automator)
        const elStamina = document.querySelector('[title="Stamina"]');
        if (!elStamina) {
            console.log('[Raid Hunter] Stamina element not found');
            return 0;
        }
        
        const staminaElement = elStamina.querySelector('span span');
        if (!staminaElement) {
            console.log('[Raid Hunter] Stamina text element not found');
            return 0;
        }
        
        const stamina = Number(staminaElement.textContent);
        console.log('[Raid Hunter] Current stamina from DOM:', stamina);
        return stamina;
    } catch (error) {
        console.error('[Raid Hunter] Error reading stamina:', error);
        return 0;
    }
}

/**
 * Get stamina cost for current map from game API
 * @returns {number} Stamina cost (defaults to DEFAULT_STAMINA_COST if unknown)
 */
function getCurrentMapStaminaCost() {
    try {
        const boardContext = globalThis.state?.board?.getSnapshot()?.context;
        const selectedRoom = boardContext?.selectedMap?.selectedRoom;
        
        if (selectedRoom && selectedRoom.staminaCost) {
            return selectedRoom.staminaCost;
        }
        
        return DEFAULT_STAMINA_COST;
    } catch (error) {
        console.error('[Raid Hunter] Error getting stamina cost:', error);
        return DEFAULT_STAMINA_COST;
    }
}

/**
 * Check if stamina tooltip is visible (insufficient stamina indicator)
 * @returns {Object} { insufficient: boolean, cost: number }
 */
function hasInsufficientStamina() {
    // Look for stamina tooltip (icon-based, language-independent)
    const staminaTooltip = document.querySelector(
        '[role="tooltip"] img[alt="stamina"], [data-state="instant-open"] img[alt="stamina"]'
    );
    
    // Get stamina cost from game API
    const cost = getCurrentMapStaminaCost();
    
    if (staminaTooltip) {
        // Found stamina icon in tooltip = insufficient stamina
        console.log(`[Raid Hunter] Tooltip check: Insufficient (needs ${cost})`);
        return { insufficient: true, cost };
    }
    
    // No tooltip = sufficient stamina (trust the game)
    return { insufficient: false, cost };
}

/**
 * Set up hybrid stamina monitoring (tooltip watching + API for progress)
 * Uses tooltip as truth for recovery, API for progress tracking
 * @param {Function} onRecovered - Callback when stamina recovers
 * @param {number} requiredStamina - Stamina cost for this map (optional for continuous monitoring)
 */
function startStaminaTooltipMonitoring(onRecovered, requiredStamina = null) {
    // Clean up any existing monitoring
    if (staminaTooltipObserver) {
        stopStaminaTooltipMonitoring();
    }
    
    console.log('[Raid Hunter] Starting stamina recovery monitoring...');
    
    staminaRecoveryCallback = onRecovered;
    let hasStaminaIssue = true;
    
    // PRIMARY METHOD: Interval-based API checking for progress tracking (every 5 seconds)
    const staminaCheckInterval = setInterval(() => {
        const currentStamina = getCurrentStamina();
        
        // Also check if tooltip disappeared (double-check)
        const tooltipStillExists = document.querySelector(
            '[role="tooltip"] img[alt="stamina"], [data-state="instant-open"] img[alt="stamina"]'
        );
        
        if (!tooltipStillExists && hasStaminaIssue) {
            console.log(`[Raid Hunter] ✅ STAMINA RECOVERED - current: ${currentStamina}`);
            hasStaminaIssue = false;
            
            // Save callback before cleanup (cleanup clears the callback)
            const callback = staminaRecoveryCallback;
            
            clearInterval(staminaCheckInterval);
            stopStaminaTooltipMonitoring();
            
            // Execute saved callback
            if (typeof callback === 'function') {
                callback();
            }
        } else if (tooltipStillExists && requiredStamina) {
            // Show progress if we know required stamina
            const timeRemaining = Math.max(0, requiredStamina - currentStamina);
            console.log(`[Raid Hunter] Waiting for stamina (${currentStamina}/${requiredStamina}) - ~${timeRemaining} min remaining`);
        }
    }, 15000); // Check every 15 seconds (stamina regenerates 1 per minute)
    
    // Store interval for cleanup
    window.raidHunterStaminaInterval = staminaCheckInterval;
    
    // BACKUP METHOD: MutationObserver for tooltip removal (instant detection)
    staminaTooltipObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.removedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const wasStaminaTooltip = 
                        (node.matches?.('[role="tooltip"]') || node.matches?.('[data-state="instant-open"]')) &&
                        node.querySelector?.('img[alt="stamina"]');
                    
                    if (wasStaminaTooltip && hasStaminaIssue) {
                        const currentStamina = getCurrentStamina();
                        console.log(`[Raid Hunter] ✅ STAMINA RECOVERED - current: ${currentStamina}`);
                        hasStaminaIssue = false;
                        
                        // Save callback before cleanup (cleanup clears the callback)
                        const callback = staminaRecoveryCallback;
                        
                        clearInterval(staminaCheckInterval);
                        stopStaminaTooltipMonitoring();
                        
                        // Execute saved callback
                        if (typeof callback === 'function') {
                            callback();
                        }
                    }
                }
            });
        }
    });
    
    staminaTooltipObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('[Raid Hunter] Stamina monitoring active (tooltip watching + API progress)');
}

/**
 * Stop stamina tooltip monitoring
 */
function stopStaminaTooltipMonitoring() {
    // Clear interval-based API checking
    if (window.raidHunterStaminaInterval) {
        clearInterval(window.raidHunterStaminaInterval);
        window.raidHunterStaminaInterval = null;
    }
    
    // Disconnect MutationObserver
    if (staminaTooltipObserver) {
        staminaTooltipObserver.disconnect();
        staminaTooltipObserver = null;
        staminaRecoveryCallback = null;
    }
    
    console.log('[Raid Hunter] Stamina monitoring stopped');
}

// ============================================================================
// 1.1. BETTER SETUPS INTEGRATION FUNCTIONS
// ============================================================================

/**
 * Check if Better Setups mod is available and enabled
 * @returns {boolean} True if Better Setups is available
 */
function isBetterSetupsAvailable() {
    try {
        const storedSetupsEnabled = window.localStorage.getItem('stored-setups');
        const storedLabels = window.localStorage.getItem('stored-setup-labels');
        return storedSetupsEnabled === 'true' && storedLabels !== null;
    } catch (error) {
        console.error('[Raid Hunter] Error checking Better Setups availability:', error);
        return false;
    }
}

/**
 * Get available setup options from Better Setups
 * @returns {Array} Array of available setup options
 */
function getAvailableSetupOptions() {
    const options = [getLocalizedText('Auto-setup', 'Autoconfigurar')]; // Always include default with translation
    
    if (isBetterSetupsAvailable()) {
        try {
            const labels = JSON.parse(window.localStorage.getItem('stored-setup-labels') || '[]');
            if (Array.isArray(labels) && labels.length > 0) {
                options.push(...labels);
                console.log('[Raid Hunter] Better Setups labels found:', labels);
            }
        } catch (error) {
            console.error('[Raid Hunter] Error parsing Better Setups labels:', error);
        }
    }
    
    return options;
}

/**
 * Check if a Better Setups button has a saved setup (green button = has setup, grey = no setup)
 * @param {HTMLElement} button - The button element to check
 * @returns {boolean} True if button has a saved setup
 */
function hasSavedSetup(button) {
    // Green buttons have saved setups, grey buttons don't
    // Check for green styling classes
    const hasGreenStyling = button.classList.contains('frame-1-green') || 
                           button.classList.contains('surface-green') ||
                           button.style.backgroundImage?.includes('background-green');
    
    return hasGreenStyling;
}

/**
 * Find setup button by option name with fallback to Auto-setup if no saved setup
 * @param {string} option - The setup option to find
 * @returns {HTMLElement|null} The button element or null if not found
 */
function findSetupButton(option) {
    if (option === getLocalizedText('Auto-setup', 'Autoconfigurar')) {
        return findButtonByText('Auto-setup');
    }
    
    // Look for Better Setups buttons with patterns "Setup (LabelName)" or "Save (LabelName)"
    const buttons = Array.from(document.querySelectorAll('button'));
    const setupButton = buttons.find(button => {
        const text = button.textContent.trim();
        return text === `Setup (${option})` || text === `Save (${option})`;
    });
    
    if (setupButton) {
        console.log(`[Raid Hunter] Found Better Setups button: ${setupButton.textContent.trim()}`);
        
        // Check if this button has a saved setup
        if (hasSavedSetup(setupButton)) {
            console.log(`[Raid Hunter] Button has saved setup (green) - using it`);
            return setupButton;
        } else {
            console.log(`[Raid Hunter] Button has no saved setup (grey) - falling back to Auto-setup`);
            // Fallback to Auto-setup if the selected button has no saved setup
            const autoSetupButton = findButtonByText('Auto-setup');
            if (autoSetupButton) {
                console.log(`[Raid Hunter] Using Auto-setup as fallback`);
                return autoSetupButton;
            }
        }
    } else {
        console.log(`[Raid Hunter] Better Setups button not found for: ${option}`);
    }
    
    return null;
}

// ============================================================================
// 2. STATE MANAGEMENT
// ============================================================================

// ============================================================================
// 2.1. CONTROL MANAGER CLASS
// ============================================================================

// Reusable control manager class for coordination between mods
class ControlManager {
    constructor(name, uniqueProperties = {}) {
        this.name = name;
        this.currentOwner = null;
        
        // Add any unique properties specific to this manager
        Object.assign(this, uniqueProperties);
    }
    
    // Request control (returns true if successful)
    requestControl(modName) {
        if (this.currentOwner === null || this.currentOwner === modName) {
            this.currentOwner = modName;
            console.log(`[${this.name}] Control granted to ${modName}`);
            return true;
        }
        console.log(`[${this.name}] Control denied to ${modName} (currently owned by ${this.currentOwner})`);
        return false;
    }
    
    // Release control
    releaseControl(modName) {
        if (this.currentOwner === modName) {
            this.currentOwner = null;
            console.log(`[${this.name}] Control released by ${modName}`);
            return true;
        }
        return false;
    }
    
    // Check if mod has control
    hasControl(modName) {
        return this.currentOwner === modName;
    }
    
    // Get current owner
    getCurrentOwner() {
        return this.currentOwner;
    }
}

// ============================================================================
// 2.2. CONTROL MANAGER INSTANCES
// ============================================================================

// Quest Button Manager for coordination between mods
window.QuestButtonManager = window.QuestButtonManager || new ControlManager('Quest Button Manager', {
    originalState: null,
    validationInterval: null
});

// Autoplay Manager for coordination between mods
window.AutoplayManager = window.AutoplayManager || new ControlManager('Autoplay Manager', {
    originalMode: null,
    isControlledByOther(modName) {
        return this.currentOwner !== null && this.currentOwner !== modName;
    }
});

// Bestiary Automator Settings Manager for coordination between mods
window.BestiaryAutomatorSettingsManager = window.BestiaryAutomatorSettingsManager || new ControlManager('Bestiary Automator Settings Manager');

// ============================================================================
// 2.3. CENTRALIZED STATE RESET FUNCTION
// ============================================================================

// Utility function to handle control request/release with proper error handling
function withControl(manager, modName, callback, errorContext = 'operation') {
    // Request control
    if (!manager.requestControl(modName)) {
        console.log(`[Raid Hunter] Cannot ${errorContext} - controlled by another mod`);
        return false;
    }
    
    try {
        const result = callback();
        return result;
    } catch (error) {
        console.error(`[Raid Hunter] Error during ${errorContext}:`, error);
        return false;
    } finally {
        // Always release control
        manager.releaseControl(modName);
    }
}

// Utility function to handle control check/release with proper error handling
function withControlCheck(manager, modName, callback, errorContext = 'operation') {
    // Check if we have control
    if (!manager.hasControl(modName)) {
        console.log(`[Raid Hunter] Cannot ${errorContext} - not controlled by Raid Hunter`);
        return false;
    }
    
    try {
        const result = callback();
        return result;
    } catch (error) {
        console.error(`[Raid Hunter] Error during ${errorContext}:`, error);
        return false;
    } finally {
        // Always release control
        manager.releaseControl(modName);
    }
}

// Create a styled button with consistent styling
function createStyledButton(id, text, color, onClick) {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = text;
    button.className = `focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-${color} active:frame-pressed-1-${color} surface-${color} gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight`;
    button.style.cssText = `
        padding: 2px 6px;
        height: 20px;
    `;
    button.addEventListener('click', onClick);
    return button;
}

// Create a styled button with custom styling
function createCustomStyledButton(id, text, className, style, onClick) {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = text;
    button.className = className;
    button.style.cssText = style;
    button.addEventListener('click', onClick);
    return button;
}

// Create a styled container div
function createStyledContainer(className, style) {
    const container = document.createElement('div');
    if (className) container.className = className;
    if (style) container.style.cssText = style;
    return container;
}

// Create a styled input element
function createStyledInput(type, id, value, style, attributes = {}) {
    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    if (value !== undefined) input.value = value;
    if (style) input.style.cssText = style;
    
    // Apply additional attributes
    Object.entries(attributes).forEach(([key, val]) => {
        input[key] = val;
    });
    
    return input;
}

// Create a reusable checkbox setting with label and description
function createCheckboxSetting(id, labelText, description, checked = false) {
    const settingDiv = document.createElement('div');
    settingDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    // Container for checkbox and label on same line
    const checkboxLabelContainer = document.createElement('div');
    checkboxLabelContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
    `;
    
    const checkbox = createStyledInput('checkbox', id, undefined, `
        width: 16px;
        height: 16px;
        accent-color: ${COLOR_ACCENT};
    `, { checked });
    // Add auto-save listener immediately
    checkbox.addEventListener('change', autoSaveSettings);
    checkboxLabelContainer.appendChild(checkbox);
    
    const label = document.createElement('label');
    label.textContent = labelText;
    label.className = 'pixel-font-16';
    label.style.cssText = `
        font-weight: bold;
        color: ${COLOR_WHITE};
        cursor: pointer;
    `;
    label.setAttribute('for', id);
    checkboxLabelContainer.appendChild(label);
    
    settingDiv.appendChild(checkboxLabelContainer);
    
    const desc = document.createElement('div');
    desc.textContent = description;
    desc.className = 'pixel-font-16';
    desc.style.cssText = `
        font-size: 11px;
        color: ${COLOR_GRAY};
        font-style: italic;
        margin-top: 2px;
    `;
    settingDiv.appendChild(desc);
    
    return settingDiv;
}

function createDropdownSetting(id, label, description, value = 'Auto-setup', options = ['Auto-setup']) {
    const settingDiv = document.createElement('div');
    settingDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.className = 'pixel-font-16';
    labelElement.setAttribute('for', id);
    labelElement.style.cssText = `
        font-weight: bold;
        color: ${COLOR_WHITE};
        margin-bottom: 4px;
    `;
    settingDiv.appendChild(labelElement);
    
    const selectElement = document.createElement('select');
    selectElement.id = id;
    selectElement.className = 'pixel-font-16';
    selectElement.style.cssText = `
        width: 100%;
        padding: 6px;
        background: ${COLOR_DARK_GRAY};
        border: 1px solid ${COLOR_ACCENT};
        color: ${COLOR_WHITE};
        border-radius: 3px;
        box-sizing: border-box;
        font-size: 14px;
        cursor: pointer;
    `;
    
    // Add options to dropdown
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        optionElement.style.cssText = `
            background: ${COLOR_DARK_GRAY};
            color: ${COLOR_WHITE};
        `;
        selectElement.appendChild(optionElement);
    });
    
    // Set initial value
    selectElement.value = value;
    selectElement.addEventListener('change', autoSaveSettings);
    settingDiv.appendChild(selectElement);
    
    const descElement = document.createElement('div');
    descElement.textContent = description;
    descElement.className = 'pixel-font-16';
    descElement.style.cssText = `
        font-size: 11px;
        color: ${COLOR_GRAY};
        font-style: italic;
        margin-top: 2px;
    `;
    settingDiv.appendChild(descElement);
    
    return settingDiv;
}

// Show toast notification
function showToast(message, duration = 5000) {
    try {
        // Use custom toast implementation (same as Welcome.js)
        // Get or create the main toast container
        let mainContainer = document.getElementById('rh-toast-container');
        if (!mainContainer) {
            mainContainer = document.createElement('div');
            mainContainer.id = 'rh-toast-container';
            mainContainer.style.cssText = `
                position: fixed;
                z-index: 9999;
                inset: 16px 16px 64px;
                pointer-events: none;
            `;
            document.body.appendChild(mainContainer);
        }
        
        // Count existing toasts to calculate stacking position
        const existingToasts = mainContainer.querySelectorAll('.toast-item');
        const stackOffset = existingToasts.length * 46;
        
        // Create the flex container for this specific toast
        const flexContainer = document.createElement('div');
        flexContainer.className = 'toast-item';
        flexContainer.style.cssText = `
            left: 0px;
            right: 0px;
            display: flex;
            position: absolute;
            transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1);
            transform: translateY(-${stackOffset}px);
            bottom: 0px;
            justify-content: flex-end;
        `;
        
        // Create toast button
        const toast = document.createElement('button');
        toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
        
        // Create widget structure
        const widgetTop = document.createElement('div');
        widgetTop.className = 'widget-top h-2.5';
        
        const widgetBottom = document.createElement('div');
        widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';
        
        // Add icon (enemy icon for raids)
        const iconImg = document.createElement('img');
        iconImg.alt = 'raid';
        iconImg.src = 'https://bestiaryarena.com/assets/icons/enemy.png';
        iconImg.className = 'pixelated';
        iconImg.style.cssText = 'width: 16px; height: 16px;';
        widgetBottom.appendChild(iconImg);
        
        // Add message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'text-left';
        messageDiv.textContent = message;
        widgetBottom.appendChild(messageDiv);
        
        // Assemble toast
        toast.appendChild(widgetTop);
        toast.appendChild(widgetBottom);
        flexContainer.appendChild(toast);
        mainContainer.appendChild(flexContainer);
        
        console.log(`[Raid Hunter] Toast shown: ${message}`);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (flexContainer && flexContainer.parentNode) {
                flexContainer.parentNode.removeChild(flexContainer);
                
                // Update positions of remaining toasts
                const toasts = mainContainer.querySelectorAll('.toast-item');
                toasts.forEach((toast, index) => {
                    const offset = index * 46;
                    toast.style.transform = `translateY(-${offset}px)`;
                });
            }
        }, duration);
        
    } catch (error) {
        console.error('[Raid Hunter] Error showing toast:', error);
    }
}

// ============================================================================
// 3. UTILITY FUNCTIONS
// ============================================================================

// Centralized state reset function
function resetState(resetType = 'full') {
    try {
        // Common reset groups to eliminate duplication
        const resetAutomationFlags = () => {
            isAutomationEnabled = AUTOMATION_DISABLED;
            isCurrentlyRaiding = false;
            currentRaidInfo = null;
            raidRetryCount = 0;
            lastRaidTime = 0;
            
            // Stop quest button validation and restore appearance
            stopAutoplayStateMonitoring();
            stopQuestButtonValidation();
            restoreQuestButtonAppearance();
        };
        
        const resetRaidState = () => {
            isRaidActive = false;
            raidQueue = [];
            lastRaidList = [];
            raidCountdownEndTime = null;
        };
        
        const resetMonitoringState = () => {
            // Clear all intervals
            if (raidClockInterval) {
                clearInterval(raidClockInterval);
                raidClockInterval = null;
            }
            if (questLogMonitorInterval) {
                clearInterval(questLogMonitorInterval);
                questLogMonitorInterval = null;
            }
            if (raidEndCheckInterval) {
                clearInterval(raidEndCheckInterval);
                raidEndCheckInterval = null;
            }
            if (boardAnalyzerCoordinationInterval) {
                clearInterval(boardAnalyzerCoordinationInterval);
                boardAnalyzerCoordinationInterval = null;
            }
            if (questButtonValidationInterval) {
                clearInterval(questButtonValidationInterval);
                questButtonValidationInterval = null;
            }
            if (window.staminaMonitorInterval) {
                clearInterval(window.staminaMonitorInterval);
                window.staminaMonitorInterval = null;
            }
            
            // Clear board state subscription
            if (boardStateUnsubscribe && typeof boardStateUnsubscribe === 'function') {
                boardStateUnsubscribe();
                boardStateUnsubscribe = null;
            }
            
            // Disconnect all observers
            if (questLogObserver) {
                questLogObserver.disconnect();
                questLogObserver = null;
            }
            // bodyObserver is no longer used - fight toast monitoring is consolidated
            if (raidListMonitor) {
                raidListMonitor.unsubscribe();
                raidListMonitor = null;
            }
            if (modalCleanupObserver) {
                modalCleanupObserver.disconnect();
                modalCleanupObserver = null;
            }
            
            // Clear all timeouts
            if (questLogObserverTimeout) {
                clearTimeout(questLogObserverTimeout);
                questLogObserverTimeout = null;
            }
            if (retryTimeout) {
                clearTimeout(retryTimeout);
                retryTimeout = null;
            }
        };
        
        const resetModalState = () => {
            activeRaidHunterModal = null;
            raidHunterModalInProgress = false;
            lastModalCall = 0;
        };
        
        const resetBoardAnalyzerState = () => {
            isBoardAnalyzerRunning = false;
        };
        
        const resetQuestButtonState = () => {
            originalQuestButtonState = null;
        };
        
        const resetStateManager = () => {
            stateManager.isInitializing = false;
            stateManager.isProcessing = false;
        };
        
        // Apply resets based on type
        switch (resetType) {
            case 'automation':
                resetAutomationFlags();
                resetRaidState();
                resetQuestButtonState();
                console.log('[Raid Hunter] State reset: automation');
                break;
                
            case 'raid':
                resetRaidState();
                resetQuestButtonState();
                console.log('[Raid Hunter] State reset: raid');
                break;
                
            case 'monitoring':
                resetMonitoringState();
                console.log('[Raid Hunter] State reset: monitoring');
                break;
                
            case 'modal':
                resetModalState();
                console.log('[Raid Hunter] State reset: modal');
                break;
                
            case 'boardAnalyzer':
                resetBoardAnalyzerState();
                console.log('[Raid Hunter] State reset: board analyzer');
                break;
                
            case 'full':
            default:
                resetAutomationFlags();
                resetRaidState();
                resetMonitoringState();
                resetModalState();
                resetBoardAnalyzerState();
                resetQuestButtonState();
                resetStateManager();
                console.log('[Raid Hunter] State reset: full');
                break;
        }
    } catch (error) {
        console.error('[Raid Hunter] Error during state reset:', error);
    }
}

let raidUnsubscribe = null;
let raidListMonitor = null;
let lastRaidTime = 0;
let raidClockInterval = null;
let questLogMonitorInterval = null;
let raidCountdownEndTime = null;
// bodyObserver removed - fight toast monitoring is now consolidated
let questLogObserver = null;
let questLogObserverTimeout = null;
let lastRaidList = [];
let isRaidActive = false;
let raidEndCheckInterval = null;
let isAutomationEnabled = AUTOMATION_DISABLED; // Default to disabled

// Raid queue system for handling multiple raids
let raidQueue = [];
let isCurrentlyRaiding = false;
let currentRaidInfo = null;

// Raid retry system
let raidRetryCount = 0;
let maxRetryAttempts = MAX_RETRY_ATTEMPTS;
let retryTimeout = null;

// Modal state management (like Cyclopedia)
let activeRaidHunterModal = null;
let raidHunterModalInProgress = false;
let lastModalCall = 0;
let modalCleanupObserver = null;

// State manager to prevent race conditions
let stateManager = {
    isInitializing: false,
    isProcessing: false
};


// Board Analyzer coordination
let boardAnalyzerCoordinationInterval = null;
let isBoardAnalyzerRunning = false;

// Page visibility handling for foreground/background transitions
let pageVisibilityHandler = null;
let lastPageVisibilityChange = 0;

// Window message listener for allModsLoaded signal (stored for cleanup)
let windowMessageHandler = null;

// Toast detection for fight icon (now consolidated with quest log observer)

// Handle page visibility changes (foreground/background transitions)
function handlePageVisibilityChange() {
    try {
        const now = Date.now();
        
        // Debounce rapid visibility changes
        if (now - lastPageVisibilityChange < 1000) {
            return;
        }
        lastPageVisibilityChange = now;
        
        if (document.visibilityState === 'visible') {
            console.log('[Raid Hunter] Page became visible - checking for active raids and reclaiming control if needed');
            
            // CRITICAL: Check game state FIRST (works even if mod was reloaded and variables were reset)
            const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
            const inAutoplay = boardContext?.mode === 'autoplay';
            const currentRoomId = getCurrentRoomId();
            
            // Check if we're in autoplay mode on a raid map
            if (inAutoplay && currentRoomId) {
                // Check if current room is a raid from the active raid list
                const raidState = globalThis.state?.raids?.getSnapshot?.();
                const activeRaids = raidState?.context?.list || [];
                const onRaidMap = activeRaids.some(raid => raid.roomId === currentRoomId);
                
                if (onRaidMap) {
                    // We're already autoplaying on an active raid map - just reclaim control
                    console.log('[Raid Hunter] Already autoplaying on active raid map - just reclaiming quest button control');
                    
                    // Restore internal state if lost (e.g., after mod reload)
                    if (!isCurrentlyRaiding) {
                        const raid = activeRaids.find(r => r.roomId === currentRoomId);
                        const raidName = getEventNameForRoomId(currentRoomId);
                        console.log(`[Raid Hunter] Restoring internal state for ongoing raid: ${raidName}`);
                        isCurrentlyRaiding = true;
                        currentRaidInfo = {
                            name: raidName,
                            roomId: currentRoomId,
                            priority: getRaidPriority(raidName),
                            expiresAt: raid?.expiresAt || Infinity
                        };
                    }
                    
                    // Reclaim quest button control if needed
                    const questButtonOwner = window.QuestButtonManager?.getCurrentOwner();
                    if (questButtonOwner !== 'Raid Hunter') {
                        modifyQuestButtonForRaiding();
                    }
                    
                    return; // Don't process new raids
                }
            }
            
            // Check if we have active raids but lost control
            const raidState = globalThis.state?.raids?.getSnapshot?.();
            const hasActiveRaids = raidState?.context?.list?.length > 0;
            const questButtonOwner = window.QuestButtonManager?.getCurrentOwner();
            
            // Check if we're already raiding and on the correct map (internal state check as backup)
            if (isCurrentlyRaiding && currentRaidInfo) {
                const onCorrectMap = currentRoomId === currentRaidInfo.roomId;
                
                if (onCorrectMap && inAutoplay) {
                    // We're already raiding correctly, just reclaim quest button control if needed
                    console.log('[Raid Hunter] Already raiding on correct map (internal state) - just reclaiming quest button control');
                    if (questButtonOwner !== 'Raid Hunter') {
                        modifyQuestButtonForRaiding();
                    }
                    return; // Don't process new raids
                } else {
                    console.log('[Raid Hunter] Was raiding but state changed - resetting raid state');
                    isCurrentlyRaiding = false;
                    currentRaidInfo = null;
                }
            }
            
            if (hasActiveRaids && questButtonOwner !== 'Raid Hunter') {
                console.log('[Raid Hunter] Active raids detected but quest button not controlled by Raid Hunter - checking for new raids');
                
                // Update raid state first
                updateRaidState();
                
                // If we have raids in queue but aren't currently raiding, start processing
                if (raidQueue.length > 0 && !isCurrentlyRaiding) {
                    console.log('[Raid Hunter] Found queued raids after foreground transition - processing next raid');
                    processNextRaid();
                } else if (isCurrentlyRaiding) {
                    // We were raiding but lost quest button control - reclaim it
                    console.log('[Raid Hunter] Reclaiming quest button control for ongoing raid');
                    modifyQuestButtonForRaiding();
                }
            }
        } else {
            console.log('[Raid Hunter] Page became hidden - maintaining raid state');
        }
    } catch (error) {
        console.error('[Raid Hunter] Error handling page visibility change:', error);
    }
}

// Set up page visibility monitoring for foreground/background transitions
function setupPageVisibilityMonitoring() {
    // Remove existing listener if any
    if (pageVisibilityHandler) {
        document.removeEventListener('visibilitychange', pageVisibilityHandler);
        pageVisibilityHandler = null;
    }
    
    // Add new listener
    pageVisibilityHandler = handlePageVisibilityChange;
    document.addEventListener('visibilitychange', pageVisibilityHandler);
    
    console.log('[Raid Hunter] Page visibility monitoring set up');
}

// Safe execution wrapper to prevent race conditions
function safeExecute(fn) {
    if (stateManager.isProcessing) {
        return;
    }
    stateManager.isProcessing = true;
    try {
        fn();
    } catch (error) {
        console.error('[Raid Hunter] safeExecute() - error during execution:', error);
    } finally {
        stateManager.isProcessing = false;
    }
}

// Alternative execution method that doesn't use the state manager
function executeImmediately(fn) {
    try {
        fn();
    } catch (error) {
        console.error('[Raid Hunter] executeImmediately() error:', error);
    }
}

/**
 * Check if an element is a raid toast (looks for fight icon like Bestiary Automator's defeat toast detection)
 * @param {Element} element - The DOM element to check
 * @returns {boolean} True if the element is a raid toast
 */
function isRaidToast(element) {
    try {
        // Check if the element is a toast (either root toast element or child widget-bottom)
        const isToastElement = element.classList && (
            element.classList.contains('non-dismissable-dialogs') || 
            element.classList.contains('widget-bottom')
        );
        
        if (!isToastElement) {
            return false;
        }
        
        // Find the widget-bottom element (either the element itself or a child)
        const widgetBottom = element.classList.contains('widget-bottom') 
            ? element 
            : element.querySelector('.widget-bottom');
        
        if (!widgetBottom) {
            return false;
        }
        
        // Look specifically for the fight icon that indicates a raid toast
        const fightIcon = widgetBottom.querySelector('img[src*="fight.png"]') || 
                         widgetBottom.querySelector('img[alt*="fight"]') ||
                         widgetBottom.querySelector('img[src*="assets/icons/fight.png"]');
        
        // Additional check: make sure this is not a quest log (which also has widget-bottom)
        const isQuestLog = widgetBottom.textContent && widgetBottom.textContent.includes('Quest Log');
        
        if (fightIcon && !isQuestLog) {
            console.log('[Raid Hunter] Fight icon detected in toast - this is a raid toast');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('[Raid Hunter] Error checking if element is raid toast:', error);
        return false;
    }
}


/**
 * Handle fight toast detection and process raids
 */
function handleFightToast() {
    // Check if Board Analyzer is running - if so, skip processing
    if (isBoardAnalyzerRunning) {
        console.log('[Raid Hunter] Fight toast detected but Board Analyzer is running - skipping');
        return;
    }
    
    if (!isAutomationActive()) {
        console.log('[Raid Hunter] Fight toast detected but automation is disabled');
        return;
    }
    
    // Check for existing raids and process them (use immediate execution to avoid state manager conflicts)
    executeImmediately(() => {
        updateRaidState();
        
        if (raidQueue.length > 0) {
            console.log('[Raid Hunter] Processing raid');
            
            // Apply raid start delay if configured
            const settings = loadSettings();
            const raidStartDelay = settings.raidDelay || DEFAULT_RAID_START_DELAY;
            
            if (raidStartDelay > 0) {
                
                setTimeout(() => {
                    // Check if raid processing can proceed
                    if (canProcessRaid('fight toast delay') && raidQueue.length > 0) {
                        processNextRaid();
                    }
                }, raidStartDelay * 1000);
            } else {
                // No delay, process immediately
                processNextRaid();
            }
        } else if (isCurrentlyRaiding) {
            console.log('[Raid Hunter] Already raiding');
        }
    });
}

// Board Analyzer coordination - pause Raid Hunter monitoring during Board Analyzer runs
function handleBoardAnalyzerCoordination() {
    try {
        if (!window.__modCoordination) return;
        
        const boardAnalyzerRunning = window.__modCoordination.boardAnalyzerRunning;
        const rankPointerRunning = window.__modCoordination.rankPointerRunning === true;
        
        if ((boardAnalyzerRunning || rankPointerRunning) && !isBoardAnalyzerRunning) {
            // Board Analyzer started - pause Raid Hunter monitoring
            console.log('[Raid Hunter] Coordination active (Board Analyzer or Rank Pointer) - pausing monitoring');
            isBoardAnalyzerRunning = true;
            pauseRaidHunterMonitoring();
        } else if (!boardAnalyzerRunning && !rankPointerRunning && isBoardAnalyzerRunning) {
            // Board Analyzer finished - resume Raid Hunter monitoring
            console.log('[Raid Hunter] Coordination cleared - resuming monitoring');
            isBoardAnalyzerRunning = false;
            resumeRaidHunterMonitoring();
        }
    } catch (error) {
        console.error('[Raid Hunter] Error in Board Analyzer coordination:', error);
    }
}

// Pause Raid Hunter monitoring to prevent interference
function pauseRaidHunterMonitoring() {
    try {
        // Only pause the monitoring that could interfere with Board Analyzer
        // Keep the UI widget visible - no need to remove it
        
        // Pause quest log monitoring interval (but keep observer for UI)
        if (questLogMonitorInterval) {
            clearInterval(questLogMonitorInterval);
            questLogMonitorInterval = null;
        }
        
        // Fight toast monitoring is now handled by consolidated observer
        // No need to pause separate bodyObserver
        
        // Don't disconnect the quest log observer - keep it for UI detection
        // The observer won't interfere with Board Analyzer
        
        // Keep the Raid Monitor widget visible - don't remove it
        // Board Analyzer only hides the game board, not the Quest Log
        console.log('[Raid Hunter] Monitoring paused for Board Analyzer (widget remains visible)');
    } catch (error) {
        console.error('[Raid Hunter] Error pausing monitoring:', error);
    }
}

// Resume Raid Hunter monitoring after Board Analyzer finishes
function resumeRaidHunterMonitoring() {
    try {
        // Only resume if automation is enabled
        if (isAutomationActive()) {
            // Resume ALL monitoring
            setupRaidMonitoring(); // This restores raid monitoring
            
            // Restore fight toast monitoring
            setupFightToastMonitoring();
            
            // Restore quest log monitoring interval (observer was never disconnected)
            if (!questLogMonitorInterval) {
                questLogMonitorInterval = setInterval(() => {
                    safeExecute(() => {
                        // Try immediate detection (like Better Yasir)
                        if (tryImmediateRaidClockCreation()) {
                            console.log('[Raid Hunter] Quest log monitoring: Raid clock created, continuing monitoring for future reopenings');
                            // Don't stop monitoring - keep it running for future quest log reopenings
                        }
                    });
                }, 10000); // Reduced frequency since we have MutationObserver
            }
            
            console.log('[Raid Hunter] All monitoring resumed after Board Analyzer');
        } else {
            console.log('[Raid Hunter] Automation disabled');
        }
    } catch (error) {
        console.error('[Raid Hunter] Error resuming monitoring:', error);
    }
}

// Unified cleanup function to fix memory leaks
function cleanupAll() {
    try {
        // Clear all intervals
        if (raidClockInterval) {
            clearInterval(raidClockInterval);
            raidClockInterval = null;
        }
        if (questLogMonitorInterval) {
            clearInterval(questLogMonitorInterval);
            questLogMonitorInterval = null;
        }
        if (raidEndCheckInterval) {
            clearInterval(raidEndCheckInterval);
            raidEndCheckInterval = null;
        }
        if (boardAnalyzerCoordinationInterval) {
            clearInterval(boardAnalyzerCoordinationInterval);
            boardAnalyzerCoordinationInterval = null;
        }
        
        // Disconnect all observers
        if (questLogObserver) {
            questLogObserver.disconnect();
            questLogObserver = null;
        }
        // bodyObserver is no longer used - fight toast monitoring is consolidated
        if (raidListMonitor) {
            raidListMonitor.unsubscribe();
            raidListMonitor = null;
        }
        
        // Clear all timeouts
        if (questLogObserverTimeout) {
            clearTimeout(questLogObserverTimeout);
            questLogObserverTimeout = null;
        }
        if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
        }
        
        console.log('[Raid Hunter] cleanupAll() completed successfully');
    } catch (error) {
        console.error('[Raid Hunter] Error in cleanupAll():', error);
    }
}

// Single source of truth for raid state consistency
function updateRaidState() {
    try {
        const raidState = globalThis.state.raids.getSnapshot();
        const currentList = raidState.context.list || [];
        
        // Update raid availability (any raids in the list)
        isRaidActive = currentList.length > 0;
        lastRaidList = [...currentList];
        
        // Log active raid details (only when list changes)
        if (currentList.length > 0) {
            const listChanged = JSON.stringify(currentList) !== JSON.stringify(lastRaidList);
            if (listChanged) {
                console.log('[Raid Hunter] Active raids detected:', currentList.length);
            }
        }
        
        // Update raid queue with available raids
        updateRaidQueue();
        
        // Update UI to match state
        const settings = loadSettings();
        const enabledMaps = settings.enabledRaidMaps || [];
        
        let statusText;
        if (isCurrentlyRaiding) {
            // Only show priority label for LOW priority (HIGH and MEDIUM are default/normal)
            const priorityLabel = currentRaidInfo?.priority === RAID_PRIORITY.LOW ? ' (Low Priority)' : '';
            statusText = `Raiding: ${currentRaidInfo?.name || 'Unknown'}${priorityLabel}`;
        } else if (enabledMaps.length === 0) {
            statusText = 'No raid maps enabled - check settings';
        } else if (isRaidActive) {
            // Check if we have low priority raid waiting for Better Tasker
            const lowPriorityRaid = raidQueue.find(r => r.priority === RAID_PRIORITY.LOW);
            if (lowPriorityRaid && !canProcessRaidWithPriority(RAID_PRIORITY.LOW, 'status check')) {
                statusText = `${currentList.length} raid(s) available - Low priority raid waiting for Better Tasker`;
            } else {
            statusText = `${currentList.length} raid(s) available`;
            }
        } else {
            statusText = 'No raids available';
        }
    } catch (error) {
        console.error('[Raid Hunter] Error updating raid state:', error);
    }
}

// Update raid queue with available raids
function updateRaidQueue() {
    try {
        const settings = loadSettings();
        const enabledMaps = settings.enabledRaidMaps || [];
        
        console.log(`[Raid Hunter] updateRaidQueue() - enabledMaps.length: ${enabledMaps.length}`);
        
        // Clear existing queue
        raidQueue = [];
        
        // If no maps are enabled, show a helpful message and don't process raids
        if (enabledMaps.length === 0) {
            console.log('[Raid Hunter] No raid maps enabled in settings - please configure which raids to auto-raid');
            return;
        }
        
        // Get current raid state to check for available raids via API
        const raidState = globalThis.state.raids.getSnapshot();
        const currentRaidList = raidState.context.list || [];
        
        console.log(`[Raid Hunter] updateRaidQueue() - currentRaidList.length: ${currentRaidList.length}`);
        console.log('[Raid Hunter] updateRaidQueue() - currentRaidList:', currentRaidList);
        
        if (currentRaidList.length > 0) {
            // Add available raids to queue using API data with priority
            currentRaidList.forEach(raid => {
                const raidName = getEventNameForRoomId(raid.roomId);
                console.log(`[Raid Hunter] Checking raid: ${raidName} (roomId: ${raid.roomId})`);
                console.log(`[Raid Hunter] Is ${raidName} in enabledMaps? ${enabledMaps.includes(raidName)}`);
                
                // Include current raid in queue for priority comparison
                if (isCurrentlyRaiding && currentRaidInfo && currentRaidInfo.roomId === raid.roomId) {
                    console.log(`[Raid Hunter] Including current raid ${raidName} in queue for priority comparison`);
                    // Continue to add it to queue instead of skipping
                }
                
                if (enabledMaps.includes(raidName)) {
                    const priority = getRaidPriority(raidName);
                    raidQueue.push({
                        name: raidName,
                        roomId: raid.roomId,
                        button: null, // No UI button needed for API access
                        priority: priority,
                        isCurrentRaid: (isCurrentlyRaiding && currentRaidInfo && currentRaidInfo.roomId === raid.roomId),
                        expiresAt: raid.expiresAt || Infinity // Add expiration time for tie-breaking
                    });
                    // Only log if we're not already raiding this specific raid
                    if (!isCurrentlyRaiding || currentRaidInfo?.roomId !== raid.roomId) {
                        const priorityLabel = getPriorityLabel(priority);
                        console.log(`[Raid Hunter] Added ${raidName} to queue via API (Priority: ${priorityLabel})`);
                    }
                } else {
                    console.log(`[Raid Hunter] Skipped ${raidName} - not in enabled maps`);
                }
            });
            
            // Sort queue by priority (lower number = higher priority), then by expiration time (least time left first)
            raidQueue.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                // If priorities are equal, sort by time remaining (earliest expiring first)
                return a.expiresAt - b.expiresAt;
            });
        } else {
            console.log('[Raid Hunter] No raids available in currentRaidList');
        }
        
        console.log(`[Raid Hunter] Raid queue updated: ${raidQueue.length} raids available`);
    } catch (error) {
        console.error('[Raid Hunter] Error updating raid queue:', error);
    }
}

// Close any open modals before starting raids
function closeOpenModals() {
    try {
        // Send ESC key to close any open modals (like other scripts)
        dispatchEsc();
        console.log('[Raid Hunter] Sent ESC key to close modals');
        
        // Small delay to let modals close
        return new Promise(resolve => setTimeout(resolve, AUTOMATION_CHECK_DELAY));
    } catch (error) {
        console.error('[Raid Hunter] Error closing modals:', error);
        return Promise.resolve();
    }
}

// Process next raid in queue
function processNextRaid(allowInterrupt = false) {
    if (raidQueue.length === 0) {
        return;
    }
    
    // If currently raiding and not allowing interrupt, don't process
    if (isCurrentlyRaiding && !allowInterrupt) {
        return;
    }
    
    // Check if Board Analyzer is running - if so, skip processing
    if (isBoardAnalyzerRunning) {
        console.log('[Raid Hunter] Board Analyzer is running - skipping raid processing');
        return;
    }
    
    // Check if automation is still enabled before starting
    if (!isAutomationActive()) {
        console.log('[Raid Hunter] Automation disabled');
        return;
    }
    
    // Sort queue by priority before processing (ensure correct order), then by expiration time
    raidQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
            return a.priority - b.priority;
        }
        return a.expiresAt - b.expiresAt;
    });
    
    // Peek at next raid (don't remove yet)
    const nextRaid = raidQueue[0];
    if (!nextRaid) {
        return;
    }
    
    // Check if we can proceed based on raid priority
    if (!canProcessRaidWithPriority(nextRaid.priority, 'processNextRaid')) {
        const priorityLabel = getPriorityLabel(nextRaid.priority);
        console.log(`[Raid Hunter] ${nextRaid.name} (Priority: ${priorityLabel}) waiting for higher priority activities...`);
        
        // Schedule retry check after 10 seconds
        setTimeout(() => {
            if (!isCurrentlyRaiding && raidQueue.length > 0) {
                console.log(`[Raid Hunter] Retrying raid processing after priority wait...`);
                processNextRaid();
            }
        }, 10000);
        return;
    }
    
    // Now remove from queue since we're processing it
    raidQueue.shift();
    
    // Double-check that this raid is still enabled (safety check)
    const settings = loadSettings();
    const enabledMaps = settings.enabledRaidMaps || [];
    if (!enabledMaps.includes(nextRaid.name)) {
        console.log(`[Raid Hunter] Safety check failed - ${nextRaid.name} is no longer enabled, skipping`);
        return;
    }
    
    const priorityLabel = getPriorityLabel(nextRaid.priority);
    console.log(`[Raid Hunter] Starting next raid: ${nextRaid.name} (Priority: ${priorityLabel})`);
    currentRaidInfo = nextRaid;
    isCurrentlyRaiding = true;
    raidRetryCount = 0; // Reset retry count for new raid
    
    // Don't modify quest button yet - wait until Start button is clicked
    // Quest button will be modified in handleEventOrRaid() after Start button click
    
    // Close any open modals first, then start the raid
    closeOpenModals().then(() => {
        // Double-check automation is still enabled before proceeding
        if (isAutomationEnabled === AUTOMATION_DISABLED) {
            console.log('[Raid Hunter] Automation disabled');
            isCurrentlyRaiding = false;
            currentRaidInfo = null;
            restoreQuestButtonAppearance();
            stopQuestButtonValidation();
            return;
        }
        handleEventOrRaid(nextRaid.roomId);
    });
}

// ============================================================================
// 4. UI FUNCTIONS
// ============================================================================

// Helper function to find quest log container with optimized selectors
function findQuestLogContainer() {
    const selectors = [
        '.widget-bottom .grid.h-\\[260px\\].items-start.gap-1', // Most specific
        '[data-radix-scroll-area-viewport] .grid.h-\\[260px\\].items-start.gap-1',
        '.grid.h-\\[260px\\].items-start.gap-1',
        '.widget-bottom .grid.items-start.gap-1',
        '[data-radix-scroll-area-viewport] .grid.items-start.gap-1',
        '.grid.items-start.gap-1'
    ];
    
    for (let i = 0; i < selectors.length; i++) {
        const selector = selectors[i];
        const container = document.querySelector(selector);
        
        if (container) {
            console.log(`[Raid Hunter] Found potential quest log container with selector ${i + 1}: ${selector}`);
            return container;
        }
    }
    
    return null;
}

// Aggressive immediate detection function (inspired by Better Yasir)
function tryImmediateRaidClockCreation() {
    // Skip if raid clock already exists
    if (document.getElementById(RAID_CLOCK_ID)) {
        return false;
    }
    
    const questLogContainer = findQuestLogContainer();
    if (questLogContainer) {
        // Final verification - check for the exact Quest Log header structure
        const questLogHeader = document.querySelector('h2[id*="radix-"][class*="widget-top"] p[id*="radix-"]');
        if (!questLogHeader || questLogHeader.textContent !== 'Quest Log') {
            console.log('[Raid Hunter] Quest Log verification failed');
            return false; // Not the actual Quest Log, abort
        }
        
        console.log('[Raid Hunter] Quest Log verified');
        createRaidClock();
        return true;
    }
    
    return false;
}

// Creates the raid clock widget.
function createRaidClock() {
    console.log('[Raid Hunter] Creating raid clock');
    
    const existingClock = document.getElementById(RAID_CLOCK_ID);
    if (existingClock) {
        console.log('[Raid Hunter] createRaidClock: Raid clock already exists, skipping');
        return;
    }

    // Find quest log container using optimized helper
    console.log('[Raid Hunter] createRaidClock: Finding quest log container...');
    const questLogContainer = findQuestLogContainer();
    
    if (!questLogContainer) {
        console.log('[Raid Hunter] createRaidClock: Quest log container not found, aborting');
        return;
    }
    
    console.log('[Raid Hunter] createRaidClock: Quest log container found, proceeding with creation...');

    const raidClockElement = document.createElement('div');
    raidClockElement.id = RAID_CLOCK_ID;
    raidClockElement.className = 'frame-1 surface-regular relative grid gap-2 p-1.5 text-left data-[disabled=\'true\']:order-last md:data-[highlighted=\'true\']:brightness-[1.2]';
    raidClockElement.setAttribute('data-highlighted', 'false');
    raidClockElement.setAttribute('data-disabled', 'false');
    raidClockElement.style.order = '-1';

    raidClockElement.innerHTML = `
        <div class="flex justify-between gap-2">
            <div class="container-slot surface-darker grid place-items-center px-3.5 py-0.5">
                <div class="relative size-sprite flex items-center justify-center">
                    <img alt="Raid Clock" class="pixelated" width="34" height="37" src="https://bestiaryarena.com/assets/icons/raid-store.png">
                </div>
            </div>
            <div class="flex w-full flex-col">
                <p class="text-whiteHighlight">Raid Monitor</p>
                <div class="flex justify-between items-center pixel-font-14">
                    <span>Next raid check in:</span>
                    <div class="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock mr-1 inline-block size-2 -translate-y-px">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span class="raid-timer">--:--:--</span>
                    </div>
                </div>
                <div class="flex gap-1 mt-1">
                    <button class="focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-red active:frame-pressed-1-red surface-red gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 flex-1 text-whiteHighlight" id="raid-hunter-toggle-btn">
                        ${getLocalizedText('Disabled', 'Desabilitado')}
                    </button>
                    <button class="focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-blue active:frame-pressed-1-blue surface-blue gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 flex-1 text-whiteHighlight" id="raid-hunter-settings-btn">
                        ${getLocalizedText(UI_TEXT.BUTTONS.SETTINGS, UI_TEXT.BUTTONS_PT.SETTINGS)}
                    </button>
                </div>
            </div>
        </div>
    `;

    // Insert above Yasir if found
    const yasirElement = questLogContainer.querySelector('img[alt="Yasir"]')?.closest('.frame-1');
    if (yasirElement) {
        questLogContainer.insertBefore(raidClockElement, yasirElement);
        console.log('[Raid Hunter] Raid clock placed above Yasir');
    } else {
        questLogContainer.insertBefore(raidClockElement, questLogContainer.firstChild);
        console.log('[Raid Hunter] Raid clock placed at top (Yasir not found)');
    }

    updateRaidClock();
    startRaidClockUpdates();
    monitorQuestLogVisibility();
    startQuestLogMonitoring();
    
    // Initialize toggle button state
    updateToggleButton();
    
    // Add event listener for Settings button
    const settingsButton = raidClockElement.querySelector('#raid-hunter-settings-btn');
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            console.log('[Raid Hunter] Settings button clicked');
            openRaidHunterSettingsModal();
        });
    }
    
    // Add event listener for Toggle button
    const toggleButton = raidClockElement.querySelector('#raid-hunter-toggle-btn');
    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            console.log('[Raid Hunter] Toggle button clicked');
            toggleAutomation();
        });
    }
    
    console.log('[Raid Hunter] createRaidClock: Raid clock created successfully!');
}

// Quest log detection handler
function handleQuestLogDetection(mutations) {
    safeExecute(() => {
        let hasQuestLogContent = false;
        
        // Process mutations for quest log content
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE && !document.getElementById(RAID_CLOCK_ID)) {
                            hasQuestLogContent = checkForQuestLogContent(node);
                        if (hasQuestLogContent) break;
                        }
                        }
                    }
            if (hasQuestLogContent) break;
        }
        
        // Handle quest log detection
        if (hasQuestLogContent) {
            console.log('[Raid Hunter] Quest log content detected!');
            
            // Clear any existing timeout
            if (questLogObserverTimeout) {
                clearTimeout(questLogObserverTimeout);
            }
            
            // Try immediate detection first
            if (tryImmediateRaidClockCreation()) {
                console.log('[Raid Hunter] Raid clock created successfully!');
                return;
            }
            
            // Fallback with minimal delay
            questLogObserverTimeout = setTimeout(() => {
                if (!document.getElementById(RAID_CLOCK_ID) && tryImmediateRaidClockCreation()) {
                    console.log('[Raid Hunter] Raid clock created via delayed detection!');
                }
            }, 50);
        }
    });
}

// Fight toast detection handler
function handleFightToastDetection(mutations) {
    safeExecute(() => {
        let hasFightToast = false;
        
        // Process mutations for fight toast
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        hasFightToast = isRaidToast(node);
                        if (hasFightToast) {
                            console.log('[Raid Hunter] Fight toast element detected in DOM');
                            break;
                        }
                    }
                }
            }
            if (hasFightToast) break;
        }
        
        // Handle fight toast detection
        if (hasFightToast) {
            console.log('[Raid Hunter] Raid toast detected in handler!');
            handleFightToast();
        }
    });
}

// Consolidated mutation processing for both quest log and fight toast detection
// NOTE: Processed immediately (no debounce) - both raid clock and fight toast need instant detection
function processAllMutations(mutations) {
    // Handle quest log detection
    handleQuestLogDetection(mutations);
    
    // Handle fight toast detection
    handleFightToastDetection(mutations);
}

// Helper function to check for quest log content
function checkForQuestLogContent(node) {
    return node.textContent?.includes('Quest Log') || 
           (node.querySelector?.('*') && 
            Array.from(node.querySelectorAll('*')).some(el => 
              el.textContent?.includes('Quest Log')
            )) ||
           // Check for quest log container structure
           (node.classList?.contains('grid') && 
            node.classList?.contains('items-start') && 
            node.classList?.contains('gap-1')) ||
           // Check for widget-bottom that might contain quest log
           node.classList?.contains('widget-bottom') ||
           // Check for any element with quest log related classes
           (node.querySelector && node.querySelector('.grid.h-\\[260px\\].items-start.gap-1'));
}

// Monitors quest log visibility (simplified like Better Yasir)
function monitorQuestLogVisibility() {
    // Skip if observer already exists
    if (questLogObserver) {
        console.log('[Raid Hunter] monitorQuestLogVisibility: Observer already exists, skipping');
        return;
    }
    
    // Consolidated MutationObserver for quest log and fight toast detection
    questLogObserver = new MutationObserver(processAllMutations);
    
    questLogObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('[Raid Hunter] Consolidated MutationObserver set up for quest log and fight toast detection');
}

// Starts quest log monitoring (simplified like Better Yasir)
function startQuestLogMonitoring() {
    console.log('[Raid Hunter] startQuestLogMonitoring: Starting quest log monitoring...');
    
    // Clear any existing monitoring first
    if (questLogMonitorInterval) {
        console.log('[Raid Hunter] startQuestLogMonitoring: Clearing existing interval');
        clearInterval(questLogMonitorInterval);
        questLogMonitorInterval = null;
    }
    
    if (questLogObserver) {
        console.log('[Raid Hunter] startQuestLogMonitoring: Disconnecting existing observer');
        questLogObserver.disconnect();
        questLogObserver = null;
    }
    
    // Set up MutationObserver for quest log detection (like Better Yasir)
    monitorQuestLogVisibility();
    
    // Simple interval monitoring as backup (like Better Yasir)
    questLogMonitorInterval = setInterval(() => {
        safeExecute(() => {
            // Try immediate detection (like Better Yasir)
            if (tryImmediateRaidClockCreation()) {
                console.log('[Raid Hunter] Quest log monitoring: Raid clock created, continuing monitoring for future reopenings');
                // Don't stop monitoring - keep it running for future quest log reopenings
            }
        });
    }, 10000); // Reduced frequency - MutationObserver handles real-time detection
}

// Stops quest log monitoring.
function stopQuestLogMonitoring() {
    cleanupAll();
}

// Updates raid clock display (synced with quest log timer format).
function updateRaidClock() {
    const timerElement = document.querySelector(`#${RAID_CLOCK_ID} .raid-timer`);
    if (!timerElement) return;

    try {
        if (!raidCountdownEndTime) {
            const raidState = globalThis.state.raids.getSnapshot();
            const msUntilUpdate = raidState.context.msUntilNextUpdate;
            
            if (msUntilUpdate && msUntilUpdate > 0) {
                raidCountdownEndTime = Date.now() + msUntilUpdate;
            } else {
                timerElement.textContent = 'Checking...';
                timerElement.style.color = COLOR_WHITE;
                return;
            }
        }
        const now = Date.now();
        const msRemaining = raidCountdownEndTime - now;
        
        if (msRemaining > 0) {
            const hours = Math.floor(msRemaining / (1000 * 60 * 60));
            const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((msRemaining % (1000 * 60)) / 1000);
            
            // Format as MM:SSm since raids typically update every 5-15 minutes
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}m`;
            timerElement.textContent = timeString;
            
            // Color coding to match quest log timer behavior
            if (msRemaining < 60000) {
                timerElement.style.color = COLOR_RED; // Red for < 1 minute
            } else if (msRemaining < 300000) {
                timerElement.style.color = COLOR_YELLOW; // Yellow for < 5 minutes
            } else {
                timerElement.style.color = COLOR_WHITE; // White for normal
            }
        } else {
            timerElement.textContent = 'Checking...';
            timerElement.style.color = '#ffffff';
            raidCountdownEndTime = null;
            
            setTimeout(() => {
                const raidState = globalThis.state.raids.getSnapshot();
                const msUntilUpdate = raidState.context.msUntilNextUpdate;
                if (msUntilUpdate && msUntilUpdate > 0) {
                    raidCountdownEndTime = Date.now() + msUntilUpdate;
                }
            }, 1000);
        }
    } catch (error) {
        timerElement.textContent = 'Error';
        timerElement.style.color = COLOR_RED;
        console.error('[Raid Hunter] Error updating raid clock:', error);
    }
}

// Resets raid countdown.
function resetRaidCountdown() {
    raidCountdownEndTime = null;
}

// Starts raid clock updates.
function startRaidClockUpdates() {
    if (raidClockInterval) {
        clearInterval(raidClockInterval);
    }
    raidClockInterval = setInterval(updateRaidClock, RAID_CLOCK_UPDATE_INTERVAL);
}

// Stops raid clock and cleanup.
function stopRaidClock() {
    cleanupAll();
    
    const raidClockElement = document.getElementById(RAID_CLOCK_ID);
    if (raidClockElement) {
        raidClockElement.remove();
    }
}

// ============================================================================
// 5. AUTOMATION CONTROL FUNCTIONS
// ============================================================================

// Helper function to find Bestiary Automator
function findBestiaryAutomator() {
    // Method 1: Check if Bestiary Automator is available in global scope
    if (window.bestiaryAutomator?.updateConfig) {
        return window.bestiaryAutomator;
    }
    // Method 2: Check if it's available in context exports
    if (typeof context !== 'undefined' && context.exports?.updateConfig) {
        return context.exports;
    }
    // Method 3: Try to find it in the mod loader's context
    if (window.modLoader?.getModContext) {
        const automatorContext = window.modLoader.getModContext('bestiary-automator');
        if (automatorContext?.exports?.updateConfig) {
            return automatorContext.exports;
        }
    }
    return null;
}

// Lightweight health check for Bestiary Automator integration
function checkBestiaryAutomatorHealth() {
    try {
        const automator = findBestiaryAutomator();
        if (!automator) {
            return { healthy: false, reason: 'Bestiary Automator not available' };
        }
        
        // Check if automator is responsive
        if (typeof automator.updateConfig !== 'function') {
            return { healthy: false, reason: 'Bestiary Automator not responsive' };
        }
        
        return { healthy: true, reason: 'Bestiary Automator is healthy' };
    } catch (error) {
        return { healthy: false, reason: `Health check failed: ${error.message}` };
    }
}

// Helper function to update Bestiary Automator config with retry
function updateBestiaryAutomatorConfig(configUpdate, settingName, verifyProperty) {
    const automator = findBestiaryAutomator();
    
    if (automator) {
        console.log(`[Raid Hunter] Enabling Bestiary Automator ${settingName}...`);
        automator.updateConfig(configUpdate);
        console.log(`[Raid Hunter] Bestiary Automator ${settingName} enabled`);
        
        // Additional verification for Chrome
        setTimeout(() => {
            if (window.bestiaryAutomator?.config) {
                console.log(`[Raid Hunter] Verifying ${settingName}:`, window.bestiaryAutomator.config[verifyProperty]);
            }
        }, AUTOMATION_CHECK_DELAY);
        
        return true;
    } else {
        console.log(`[Raid Hunter] Bestiary Automator not available for ${settingName}`);
        // Retry in 2 seconds
        setTimeout(() => {
            const retryAutomator = findBestiaryAutomator();
            if (retryAutomator) {
                console.log(`[Raid Hunter] Retrying Bestiary Automator ${settingName}...`);
                retryAutomator.updateConfig(configUpdate);
                console.log(`[Raid Hunter] Bestiary Automator ${settingName} enabled (retry)`);
                
                setTimeout(() => {
                    if (window.bestiaryAutomator?.config) {
                        console.log(`[Raid Hunter] Verifying ${settingName} (retry):`, window.bestiaryAutomator.config[verifyProperty]);
                    }
                }, AUTOMATION_CHECK_DELAY);
            } else {
                console.log(`[Raid Hunter] Bestiary Automator still not available - you may need to enable ${settingName} manually`);
            }
        }, BESTIARY_RETRY_DELAY);
        return false;
    }
}

// Enable Bestiary Automator's autorefill stamina setting
function enableBestiaryAutomatorStaminaRefill() {
    return withControl(window.BestiaryAutomatorSettingsManager, 'Raid Hunter', () => {
        return updateBestiaryAutomatorConfig(
            { autoRefillStamina: true },
            'autorefill stamina',
            'autoRefillStamina'
        );
    }, 'enable Bestiary Automator autorefill stamina');
}

// Disable Bestiary Automator's autorefill stamina setting
function disableBestiaryAutomatorStaminaRefill() {
    return withControlCheck(window.BestiaryAutomatorSettingsManager, 'Raid Hunter', () => {
        const automator = findBestiaryAutomator();
        if (automator) {
            console.log('[Raid Hunter] Disabling Bestiary Automator autorefill stamina...');
            automator.updateConfig({ autoRefillStamina: false });
            console.log('[Raid Hunter] Bestiary Automator autorefill stamina disabled');
            return true;
        } else {
            console.log('[Raid Hunter] Bestiary Automator not available for autorefill stamina');
            return false;
        }
    }, 'disable Bestiary Automator autorefill stamina');
}

// Enable Bestiary Automator's faster autoplay setting
function enableBestiaryAutomatorFasterAutoplay() {
    return withControl(window.BestiaryAutomatorSettingsManager, 'Raid Hunter', () => {
        return updateBestiaryAutomatorConfig(
            { fasterAutoplay: true },
            'faster autoplay',
            'fasterAutoplay'
        );
    }, 'enable Bestiary Automator faster autoplay');
}

// Disable Bestiary Automator's faster autoplay setting
function disableBestiaryAutomatorFasterAutoplay() {
    return withControlCheck(window.BestiaryAutomatorSettingsManager, 'Raid Hunter', () => {
        const automator = findBestiaryAutomator();
        if (automator) {
            console.log('[Raid Hunter] Disabling Bestiary Automator faster autoplay...');
            automator.updateConfig({ fasterAutoplay: false });
            console.log('[Raid Hunter] Bestiary Automator faster autoplay disabled');
            return true;
        } else {
            console.log('[Raid Hunter] Bestiary Automator not available for faster autoplay');
            return false;
        }
    }, 'disable Bestiary Automator faster autoplay');
}

// Post-navigation settings validation
function validateSettingsAfterNavigation() {
    try {
        const settings = loadSettings();
        let validationIssues = [];
        
        // Validate Bestiary Automator settings if enabled
        if (settings.autoRefillStamina) {
            const automator = findBestiaryAutomator();
            if (!automator) {
                validationIssues.push('Bestiary Automator not available for stamina refill');
            }
        }
        
        if (settings.fasterAutoplay) {
            const automator = findBestiaryAutomator();
            if (!automator) {
                validationIssues.push('Bestiary Automator not available for faster autoplay');
            }
        }
        
        // Validate raid delay settings
        if (settings.raidDelay < 1 || settings.raidDelay > 30) {
            validationIssues.push('Invalid raid delay setting');
        }
        
        // Log validation results and attempt recovery
        if (validationIssues.length > 0) {
            console.warn('[Raid Hunter] Settings validation issues:', validationIssues);
            
            // Attempt automatic recovery for Bestiary Automator issues
            if (validationIssues.some(issue => issue.includes('Bestiary Automator'))) {
                console.log('[Raid Hunter] Attempting automatic recovery for Bestiary Automator...');
                const healthCheck = checkBestiaryAutomatorHealth();
                if (!healthCheck.healthy) {
                    console.warn('[Raid Hunter] Bestiary Automator health check failed:', healthCheck.reason);
                } else {
                    console.log('[Raid Hunter] Bestiary Automator health check passed, attempting to re-enable settings...');
                    // Re-enable settings if health check passes
                    if (settings.autoRefillStamina) {
                        enableBestiaryAutomatorStaminaRefill();
                    }
                    if (settings.fasterAutoplay) {
                        enableBestiaryAutomatorFasterAutoplay();
                    }
                }
            }
        } else {
            console.log('[Raid Hunter] Settings validation passed');
        }
        
        return validationIssues.length === 0;
    } catch (error) {
        console.error('[Raid Hunter] Error during settings validation:', error);
        return false;
    }
}

// Enable Autoseller's Dragon Plant setting
function enableAutosellerDragonPlant() {
    try {
        // Try to find Autoseller's exported function
        let autoseller = null;
        
        // Method 1: Check window scope
        if (window.autoseller && window.autoseller.enableDragonPlant) {
            autoseller = window.autoseller;
            console.log('[Raid Hunter] Found Autoseller via window object');
        }
        // Method 2: Check context exports
        else if (typeof context !== 'undefined' && context.exports && context.exports.enableDragonPlant) {
            autoseller = context.exports;
            console.log('[Raid Hunter] Found Autoseller via context exports');
        }
        // Method 3: Try mod loader
        else if (window.modLoader && window.modLoader.getModContext) {
            const autosellerContext = window.modLoader.getModContext('autoseller');
            if (autosellerContext && autosellerContext.exports && autosellerContext.exports.enableDragonPlant) {
                autoseller = autosellerContext.exports;
                console.log('[Raid Hunter] Found Autoseller via mod loader');
            }
        }
        
        if (autoseller) {
            console.log('[Raid Hunter] Enabling Dragon Plant via Autoseller...');
            autoseller.enableDragonPlant();
            console.log('[Raid Hunter] Dragon Plant enabled');
            return true;
        } else {
            console.log('[Raid Hunter] Autoseller not available - trying direct approach');
            // Fallback: try to access via global exports
            if (typeof exports !== 'undefined' && exports.enableDragonPlant) {
                exports.enableDragonPlant();
                console.log('[Raid Hunter] Dragon Plant enabled via exports');
                return true;
            }
            return false;
        }
    } catch (error) {
        console.error('[Raid Hunter] Error enabling Dragon Plant:', error);
        return false;
    }
}

/**
 * Checks element visibility
 * @param {Element} el - The element to check
 * @returns {boolean} True if the element is visible
 */
function isElementVisible(el) {
    if (!el || el.disabled) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

/**
 * Gets room ID for event name using game state API (with fallback)
 * @param {string} eventName - The event name
 * @returns {string|null} The room ID or null if not found
 */
function getRoomIdForEvent(eventName) {
    try {
        // Try game state API reverse lookup (if ROOM_NAME exists, find matching ROOM_ID)
        if (globalThis.state?.utils?.ROOM_NAME) {
            const roomNames = globalThis.state.utils.ROOM_NAME;
            for (const [roomId, roomName] of Object.entries(roomNames)) {
                if (roomName === eventName) {
                    return roomId;
                }
            }
        }
    } catch (error) {
        console.warn('[Raid Hunter] Error accessing game state API for room ID:', error);
    }
    
    // Fallback to hardcoded mapping (backward compatibility)
    return EVENT_TO_ROOM_MAPPING[eventName] || null;
}

/**
 * Gets event name for room ID using game state API (fully dynamic)
 * @param {string} roomId - The room ID
 * @returns {string} The event name or fallback name
 */
function getEventNameForRoomId(roomId) {
    try {
        // Try game state API first (fully dynamic - no hardcoding needed)
        if (globalThis.state?.utils?.ROOM_NAME?.[roomId]) {
            return globalThis.state.utils.ROOM_NAME[roomId];
        }
    } catch (error) {
        console.warn('[Raid Hunter] Error accessing game state API for room name:', error);
    }
    
    // Fallback to hardcoded mapping (only needed for backward compatibility)
    for (const [eventName, mappedRoomId] of Object.entries(EVENT_TO_ROOM_MAPPING)) {
        if (mappedRoomId === roomId) {
            return eventName;
        }
    }
    
    return `Unknown (${roomId})`;
}

// Language detection function
function isPortuguese() {
    return document.documentElement.lang === 'pt-BR' || 
           document.querySelector('html[lang="pt-BR"]') || 
           navigator.language.startsWith('pt-BR') ||
           window.location.href.includes('/pt/');
}

// Get localized text based on current language
function getLocalizedText(englishText, portugueseText) {
    return isPortuguese() ? portugueseText : englishText;
}

// Finds button by text content - supports both English and Portuguese
function findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll('button'));
    
    // Define text mappings for different languages using centralized constants
    const textMappings = {
        'Auto-setup': [UI_TEXT.BUTTONS.AUTO_SETUP, UI_TEXT.BUTTONS_PT.AUTO_SETUP],
        'Start': [UI_TEXT.BUTTONS.START, UI_TEXT.BUTTONS_PT.START],
        'Close': [UI_TEXT.BUTTONS.CLOSE, UI_TEXT.BUTTONS_PT.CLOSE]
    };
    
    // Get the list of possible texts for the given text key
    const possibleTexts = textMappings[text] || [text];
    
    return buttons.find(button => {
        const buttonText = button.textContent.trim();
        return possibleTexts.includes(buttonText) && isElementVisible(button);
    }) || null;
}

// ============================================================================
// 6. RAID END DETECTION FUNCTIONS
// ============================================================================

// Loads automation state from localStorage
function loadAutomationState() {
    const saved = localStorage.getItem('raidHunterAutomationEnabled');
    if (saved !== null) {
        try {
            isAutomationEnabled = JSON.parse(saved);
            console.log('[Raid Hunter] Loaded automation state from localStorage:', isAutomationEnabled);
        } catch (error) {
            console.error('[Raid Hunter] Error parsing automation state:', error);
            isAutomationEnabled = AUTOMATION_DISABLED;
        }
    } else {
        console.log('[Raid Hunter] Using default automation state');
    }
}

// Saves automation state to localStorage
function saveAutomationState() {
    localStorage.setItem('raidHunterAutomationEnabled', JSON.stringify(isAutomationEnabled));
    console.log('[Raid Hunter] Automation state saved');
}

// Toggles automation on/off
function toggleAutomation() {
    isAutomationEnabled = isAutomationEnabled === AUTOMATION_DISABLED ? AUTOMATION_ENABLED : AUTOMATION_DISABLED;
    saveAutomationState(); // Save to localStorage
    updateToggleButton();
    
    if (isAutomationActive()) {
        console.log('[Raid Hunter] Automation enabled');
        
        // Get raid start delay from settings
        const settings = loadSettings();
        const raidStartDelay = settings.raidDelay || DEFAULT_RAID_START_DELAY;
        
        console.log(`[Raid Hunter] Raid start delay: ${raidStartDelay} seconds`);
        
        // Re-enable monitoring
        setupRaidMonitoring();
        
        // Wait for the specified delay before checking for raids
        if (raidStartDelay > 0) {
            console.log(`[Raid Hunter] Waiting ${raidStartDelay} seconds before checking for raids...`);
            
            setTimeout(() => {
                // Check if raid processing can proceed
                if (canProcessRaid('start delay')) {
                    console.log('[Raid Hunter] Raid start delay completed - checking for raids');
                    checkForExistingRaids();
                }
            }, raidStartDelay * 1000);
        } else {
            // No delay, check immediately
            checkForExistingRaids();
        }
    } else {
        console.log('[Raid Hunter] Automation disabled');
        
        // Stop stamina tooltip monitoring
        stopStaminaTooltipMonitoring();
        
        // Disable Bestiary Automator's autorefill stamina when Raid Hunter is disabled
        const settings = loadSettings();
        if (settings.autoRefillStamina) {
            console.log('[Raid Hunter] Automation disabled - disabling Bestiary Automator autorefill stamina...');
            disableBestiaryAutomatorStaminaRefill();
        }
        if (settings.fasterAutoplay) {
            console.log('[Raid Hunter] Automation disabled - disabling Bestiary Automator faster autoplay...');
            disableBestiaryAutomatorFasterAutoplay();
        }
        
        // Stop any ongoing raid monitoring
        if (raidEndCheckInterval) {
            stopRaidEndChecking();
        }
        
        // If we're in autoplay mode, stop it (only if we have control)
        // Switch to manual mode if we have autoplay control
        withControlCheck(window.AutoplayManager, 'Raid Hunter', () => {
                const boardContext = globalThis.state.board.getSnapshot().context;
                if (boardContext.mode === 'autoplay') {
                    globalThis.state.board.send({ type: "setPlayMode", mode: "manual" });
                    console.log('[Raid Hunter] Switched to manual mode (automation disabled)');
                }
        }, 'switch to manual mode');
        
        // Reset automation state
        resetState('automation');
        raidRetryCount = 0;
        if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
        }
        
        // Restore quest button appearance when automation is disabled
        restoreQuestButtonAppearance();
        
        // Stop quest button validation monitoring
        stopAutoplayStateMonitoring();
        stopQuestButtonValidation();
    }
}

// Updates the toggle button appearance
function updateToggleButton() {
    const toggleButton = document.querySelector('#raid-hunter-toggle-btn');
    if (!toggleButton) return;
    
    if (isAutomationActive()) {
        toggleButton.textContent = getLocalizedText(UI_TEXT.BUTTONS.ENABLED, UI_TEXT.BUTTONS_PT.ENABLED);
        toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 flex-1 text-whiteHighlight';
    } else {
        toggleButton.textContent = getLocalizedText('Disabled', 'Desabilitado');
        toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-red active:frame-pressed-1-red surface-red gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 flex-1 text-whiteHighlight';
    }
}

// ============================================================================
// 7. CORE LOGIC FUNCTIONS
// ============================================================================

// Check if it's safe to reload the page (won't interrupt user's active game)
function isSafeToReload() {
    try {
        const boardContext = globalThis.state?.board?.getSnapshot()?.context;
        
        // Don't reload if game state is unavailable
        if (!boardContext) {
            console.log('[Raid Hunter] Cannot verify game state - skipping reload for safety');
            return false;
        }
        
        // CRITICAL: Check if user is actively playing a game
        if (boardContext.gameStarted) {
            console.log('[Raid Hunter] User is in an active game - skipping reload to avoid interruption');
            return false;
        }
        
        // Check if user is in autoplay mode but this mod doesn't have control
        // This means user manually enabled autoplay or another mod is controlling it
        const currentOwner = window.AutoplayManager?.getCurrentOwner();
        
        if (boardContext.mode === 'autoplay' && currentOwner && currentOwner !== 'Raid Hunter') {
            console.log(`[Raid Hunter] Another mod (${currentOwner}) is autoplaying - skipping reload`);
            return false;
        }
        
        // Safe to reload
        return true;
        
    } catch (error) {
        console.error('[Raid Hunter] Error checking if safe to reload:', error);
        return false; // Fail safe - don't reload on error
    }
}

// Interrupts current raid for higher priority raid
function interruptCurrentRaid(callback) {
    console.log(`[Raid Hunter] Interrupting current raid: ${currentRaidInfo?.name} for higher priority raid`);
    
    // Manually reset raid state WITHOUT clearing the queue (we need it for the next raid)
    isCurrentlyRaiding = false;
    const interruptedRaidName = currentRaidInfo?.name;
    currentRaidInfo = null;
    isRaidActive = false;
    raidCountdownEndTime = null;
    
    // Reset quest button state
    stopAutoplayStateMonitoring();
    stopQuestButtonValidation();
    restoreQuestButtonAppearance();
    
    // Stop stamina tooltip monitoring
    stopStaminaTooltipMonitoring();
    
    // Release autoplay control without reloading
    if (window.AutoplayManager.getCurrentOwner() === 'Raid Hunter') {
        withControlCheck(window.AutoplayManager, 'Raid Hunter', () => {
            const boardContext = globalThis.state.board.getSnapshot().context;
            if (boardContext.mode === 'autoplay') {
                globalThis.state.board.send({ type: "setPlayMode", mode: "manual" });
                console.log('[Raid Hunter] Switched to manual mode (interrupted)');
            }
        }, 'interrupt raid');
    }
    
    console.log(`[Raid Hunter] Successfully interrupted ${interruptedRaidName}`);
    
    // Execute callback after cleanup
    if (typeof callback === 'function') {
        setTimeout(() => callback(), 500);
    }
}

// Stops autoplay when raid ends
function stopAutoplayOnRaidEnd() {
    try {
        console.log('[Raid Hunter] Raid ended - checking for more raids in queue');
        
        // Update raid state to refresh queue before checking
        updateRaidState();
        
        // Check if there are more raids in the queue
        if (raidQueue.length > 0) {
            console.log(`[Raid Hunter] Found ${raidQueue.length} raid(s) in queue - navigating to next raid instead of reloading`);
            
            // Reset current raid state (but preserve queue)
            isCurrentlyRaiding = false;
            currentRaidInfo = null;
            raidRetryCount = 0;
            lastRaidTime = 0;
            
            // Restore quest button appearance
            restoreQuestButtonAppearance();
            
            // Stop quest button validation monitoring
            stopAutoplayStateMonitoring();
            stopQuestButtonValidation();
            
            // Stop stamina tooltip monitoring
            stopStaminaTooltipMonitoring();
            
            // Stop raid end checking
            stopRaidEndChecking();
            
            // Check if Better Tasker is active before disabling Bestiary Automator settings
            if (window.betterTaskerState && window.betterTaskerState.isTaskerEnabled) {
                console.log('[Raid Hunter] Better Tasker is active - skipping Bestiary Automator settings reset to avoid conflicts');
            } else {
                // Disable Bestiary Automator's autorefill stamina when raid ends
                const settings = loadSettings();
                if (settings.autoRefillStamina) {
                    console.log('[Raid Hunter] Raid ended - disabling Bestiary Automator autorefill stamina...');
                    disableBestiaryAutomatorStaminaRefill();
                }
                if (settings.fasterAutoplay) {
                    console.log('[Raid Hunter] Raid ended - disabling Bestiary Automator faster autoplay...');
                    disableBestiaryAutomatorFasterAutoplay();
                }
            }
            
            // Navigate to next raid after cleanup delay
            setTimeout(() => {
                if (isAutomationActive() && raidQueue.length > 0) {
                    console.log('[Raid Hunter] Processing next raid from queue');
                    processNextRaid();
                }
            }, 2000); // 2 second delay to allow cleanup
            
            return; // Exit early - don't reload
        }
        
        // No more raids in queue - proceed with normal cleanup and reload
        console.log('[Raid Hunter] No more raids in queue - reloading page');
        
        // Reset raid state
        resetState('raid');
        
        // Restore quest button appearance
        restoreQuestButtonAppearance();
        
        // Stop quest button validation monitoring
        stopAutoplayStateMonitoring();
        stopQuestButtonValidation();
        
        // Stop stamina tooltip monitoring
        stopStaminaTooltipMonitoring();
        
        // Check if Better Tasker is active before disabling Bestiary Automator settings
        if (window.betterTaskerState && window.betterTaskerState.isTaskerEnabled) {
            console.log('[Raid Hunter] Better Tasker is active - skipping Bestiary Automator settings reset to avoid conflicts');
        } else {
            // Disable Bestiary Automator's autorefill stamina when raid ends
            const settings = loadSettings();
            if (settings.autoRefillStamina) {
                console.log('[Raid Hunter] Raid ended - disabling Bestiary Automator autorefill stamina...');
                disableBestiaryAutomatorStaminaRefill();
            }
            if (settings.fasterAutoplay) {
                console.log('[Raid Hunter] Raid ended - disabling Bestiary Automator faster autoplay...');
                disableBestiaryAutomatorFasterAutoplay();
            }
        }
        
        // Reload page after cleanup to reset cache, DOM, and check for more raids
        setTimeout(() => {
            if (!isSafeToReload()) return;
            // Check if Mod Settings has disabled auto-reload
            if (window.betterUIConfig?.disableAutoReload) {
                console.log('[Raid Hunter] Auto-reload disabled by Mod Settings - skipping page refresh');
                return;
            }
            location.reload();
        }, 2000); // 2 second delay to allow cleanup
        
    } catch (error) {
        console.error('[Raid Hunter] Error stopping autoplay on raid end:', error);
    }
}


// Monitors raid list changes to detect when raids end
function setupRaidListMonitoring() {
    if (raidListMonitor) {
        raidListMonitor.unsubscribe();
        raidListMonitor = null;
    }

    if (globalThis.state && globalThis.state.raids) {
        raidListMonitor = globalThis.state.raids.subscribe((state) => {
            safeExecute(() => {
                const currentList = state.context.list || [];
                
                // Check if raid list changed
                if (JSON.stringify(currentList) !== JSON.stringify(lastRaidList)) {
                    console.log('[Raid Hunter] Raid list changed:', {
                        previous: lastRaidList,
                        current: currentList,
                        changeType: currentList.length > lastRaidList.length ? "ADDED" : "REMOVED"
                    });
                    
                    // IMPORTANT: Check conditions BEFORE updating state
                    const raidsAdded = currentList.length > lastRaidList.length;
                    const raidsRemoved = currentList.length < lastRaidList.length;
                    
                    // Check if current raid we're playing is still in the list
                    const currentRaidStillExists = isCurrentlyRaiding && currentRaidInfo && 
                        currentList.some(raid => raid.roomId === currentRaidInfo.roomId);
                    
                    // Update state consistently (this updates lastRaidList)
                    updateRaidState();
                    
                    // If raids were removed and we were currently raiding, stop autoplay
                    // OR if our specific raid is no longer in the list (even if new raids appeared)
                    if ((raidsRemoved && isCurrentlyRaiding) || (isCurrentlyRaiding && !currentRaidStillExists)) {
                        console.log('[Raid Hunter] Raid ended (current raid no longer in list)');
                        stopAutoplayOnRaidEnd();
                    }
                    
                    // If new raids were added, process next raid (raids have priority over current autoplay)
                    if (raidsAdded) {
                        console.log(`[Raid Hunter] New raid detected`);
                        if (isAutomationEnabled === AUTOMATION_ENABLED) {
                            // Check if we should interrupt current raid for higher priority raid
                            if (isCurrentlyRaiding && currentRaidInfo) {
                                // Get highest priority from updated queue
                                if (raidQueue.length > 0) {
                                    raidQueue.sort((a, b) => {
                                        if (a.priority !== b.priority) {
                                            return a.priority - b.priority;
                                        }
                                        return a.expiresAt - b.expiresAt;
                                    });
                                    const nextRaid = raidQueue[0];
                                    
                                    // Only interrupt if new raid has HIGHER priority than current raid, or same priority but expires sooner
                                    const shouldInterrupt = (nextRaid.priority < currentRaidInfo.priority) || 
                                                          (nextRaid.priority === currentRaidInfo.priority && nextRaid.expiresAt < (currentRaidInfo.expiresAt || Infinity));
                                    
                                    if (shouldInterrupt) {
                                        const reason = nextRaid.priority < currentRaidInfo.priority ? 
                                            'higher priority' : 'same priority but expires sooner';
                                        console.log(`[Raid Hunter] ${reason} raid detected: ${nextRaid.name} (Priority: ${nextRaid.priority}) vs current: ${currentRaidInfo.name} (Priority: ${currentRaidInfo.priority}) - switching`);
                                        
                                        // Check if Better Tasker should block low priority raids
                                        // HIGH and MEDIUM priority raids always proceed
                                        if (nextRaid.priority === RAID_PRIORITY.LOW) {
                                            const betterTaskerState = window.betterTaskerState;
                                            
                                            // Allow low priority raids if Better Tasker is in "New Task+" mode
                                            if (betterTaskerState && betterTaskerState.taskerState === 'new_task_only') {
                                                console.log('[Raid Hunter] Better Tasker is in "New Task+" mode - low priority raid can proceed');
                                                // Continue to interrupt logic below
                                            } 
                                            // Only block if Better Tasker is in full automation mode with active operations
                                            else if (betterTaskerState && betterTaskerState.taskerState === 'enabled') {
                                                if (betterTaskerState.hasActiveTask === true || 
                                                    betterTaskerState.taskHuntingOngoing === true ||
                                                    betterTaskerState.taskOperationInProgress === true ||
                                                    betterTaskerState.pendingTaskCompletion === true ||
                                                    (window.AutoplayManager?.getCurrentOwner && 
                                                     window.AutoplayManager.getCurrentOwner() === 'Better Tasker')) {
                                                    console.log('[Raid Hunter] Better Tasker is active (full automation) - low priority raid should wait');
                                                    return; // Don't interrupt
                                                }
                                            }
                                        }
                                        
                                        // Interrupt current raid and switch to higher priority or sooner expiring raid
                                        interruptCurrentRaid(() => {
                                            processNextRaid(true); // Allow interrupt
                                        });
                                        return;
                                    } else {
                                        console.log(`[Raid Hunter] New raid ${nextRaid.name} has same or lower priority than current raid ${currentRaidInfo.name} - continuing current raid`);
                                        return; // Don't switch
                                    }
                                }
                            }
                            
                            // Normal processing when not currently raiding
                            console.log('[Raid Hunter] Processing next raid');
                            processNextRaid();
                        } else {
                            console.log('[Raid Hunter] New raids detected but automation is disabled - not processing');
                        }
                    }

                    // Update UI availability for event raids in settings modal, if open
                    try { applyEventRaidAvailabilityUI(); } catch (_) {}
                }
            });
        });
    }
}

// Periodic check for raid end (backup method) - only runs when needed
function startRaidEndChecking() {
    if (raidEndCheckInterval) {
        clearInterval(raidEndCheckInterval);
    }
    
    raidEndCheckInterval = setInterval(() => {
        safeExecute(() => {
            try {
                // Only check if we're actually in a raid and autoplay mode
                const boardContext = globalThis.state.board.getSnapshot().context;
                
                // If not in autoplay mode or not currently raiding, stop checking
                if (boardContext.mode !== 'autoplay' || !isCurrentlyRaiding) {
                    console.log('[Raid Hunter] Not in autoplay mode or not currently raiding - stopping raid end checks');
                    stopRaidEndChecking();
                    return;
                }
                
                // Update raid state first
                updateRaidState();
                
                const raidState = globalThis.state.raids.getSnapshot();
                const currentRaidList = raidState.context.list || [];
                
                // Check if no raids are available but we're still in autoplay
                if (currentRaidList.length === 0) {
                    console.log('[Raid Hunter] No raids available');
                    stopAutoplayOnRaidEnd();
                    return;
                }
                
                // Check if there's a better raid in the queue than the current one
                if (currentRaidInfo && raidQueue.length > 0) {
                    // Sort queue and check if there's a better raid
                    raidQueue.sort((a, b) => {
                        if (a.priority !== b.priority) {
                            return a.priority - b.priority;
                        }
                        return a.expiresAt - b.expiresAt;
                    });
                    const bestRaid = raidQueue[0];
                    
                    const shouldSwitch = (bestRaid.priority < currentRaidInfo.priority) || 
                                       (bestRaid.priority === currentRaidInfo.priority && bestRaid.expiresAt < (currentRaidInfo.expiresAt || Infinity));
                    
                    if (shouldSwitch && bestRaid.roomId !== currentRaidInfo.roomId) {
                        const reason = bestRaid.priority < currentRaidInfo.priority ? 
                            'higher priority' : 'same priority but expires sooner';
                        console.log(`[Raid Hunter] Periodic check: ${reason} raid detected: ${bestRaid.name} vs current: ${currentRaidInfo.name} - switching`);
                        
                        // Check Better Tasker blocking for low priority raids
                        if (bestRaid.priority === RAID_PRIORITY.LOW) {
                            const betterTaskerState = window.betterTaskerState;
                            if (betterTaskerState && betterTaskerState.taskerState === 'enabled') {
                                if (betterTaskerState.hasActiveTask === true || 
                                    betterTaskerState.taskHuntingOngoing === true ||
                                    betterTaskerState.taskOperationInProgress === true ||
                                    betterTaskerState.pendingTaskCompletion === true) {
                                    console.log('[Raid Hunter] Better Tasker is active - low priority raid should wait');
                                    return;
                                }
                            }
                        }
                        
                        interruptCurrentRaid(() => {
                            processNextRaid(true);
                        });
                        return;
                    }
                }
                
                // For LOW priority raids: Monitor Better Tasker and yield if it becomes active
                if (currentRaidInfo && currentRaidInfo.priority === RAID_PRIORITY.LOW) {
                    const betterTaskerState = window.betterTaskerState;
                    if (betterTaskerState && betterTaskerState.taskerState === 'enabled') {
                        // Check if Better Tasker is actively tasking
                        if (betterTaskerState.hasActiveTask === true || 
                            betterTaskerState.taskHuntingOngoing === true ||
                            betterTaskerState.taskOperationInProgress === true ||
                            betterTaskerState.pendingTaskCompletion === true) {
                            const currentOwner = window.AutoplayManager?.getCurrentOwner();
                            if (currentOwner === 'Raid Hunter') {
                                console.log('[Raid Hunter] Better Tasker became active during LOW priority raid - releasing control');
                                window.AutoplayManager.releaseControl('Raid Hunter');
                                cancelCurrentRaid('Better Tasker became active - LOW priority raid yields');
                                return;
                            }
                        }
                    }
                }
                
                // Look for raid-specific UI elements that might indicate raid ended
                const raidEndIndicators = [
                    'Raid completed',
                    'Raid finished',
                    'Raid ended',
                    'No more raids available',
                    'All raids completed'
                ];
                
                const hasRaidEndIndicator = raidEndIndicators.some(text => 
                    document.body.textContent.includes(text)
                );
                
                if (hasRaidEndIndicator) {
                    console.log('[Raid Hunter] Raid ended');
                    stopAutoplayOnRaidEnd();
                    return;
                }
                
        } catch (error) {
            console.error('[Raid Hunter] Error in raid end checking:', error);
        }
    });
}, RAID_END_CHECK_INTERVAL);
}

// Stops the periodic raid end checking
function stopRaidEndChecking() {
    if (raidEndCheckInterval) {
        clearInterval(raidEndCheckInterval);
        raidEndCheckInterval = null;
        console.log('[Raid Hunter] Raid end checking stopped');
    }
}

// ============================================================================
// 8. SETTINGS MODAL
// ============================================================================

/**
 * Handles events and raids via API
 * @param {string} roomId - The room ID for the raid/event
 */
async function handleEventOrRaid(roomId) {
    if (!roomId) {
        console.log('[Raid Hunter] No room ID provided for raid');
        return;
    }

    // Check if automation is still enabled before starting
    if (!isAutomationActive()) {
        cancelCurrentRaid('automation disabled before starting');
        return;
    }

    console.log(`[Raid Hunter] Starting raid automation for room ID: ${roomId}`);
    
    // Show toast notification
    showToast('Starting Raid Hunter');

    try {
        // User-configurable initial delay (standardized timing)
        const settings = loadSettings();
        const startDelay = (settings.raidDelay || DEFAULT_START_DELAY) * 1000;
        console.log(`[Raid Hunter] Waiting ${startDelay/1000}s before navigation...`);
        await new Promise(resolve => setTimeout(resolve, startDelay));
        
        // Check automation status after initial delay
        if (!isAutomationActive()) {
            cancelCurrentRaid('automation disabled during navigation delay');
            return;
        }
        
        // Navigate to the raid map
        console.log('[Raid Hunter] Navigating to raid map...');
        globalThis.state.board.send({
            type: 'selectRoomById',
            roomId: roomId
        });
        await new Promise(resolve => setTimeout(resolve, NAVIGATION_DELAY));
        console.log('[Raid Hunter] Navigation completed');
        
        // Check automation status after navigation
        if (!isAutomationActive()) {
            cancelCurrentRaid('automation disabled after navigation');
            return;
        }
        
        // Post-navigation settings validation
        console.log('[Raid Hunter] Validating settings after navigation...');
        validateSettingsAfterNavigation();
    } catch (error) {
        console.error('[Raid Hunter] Error navigating to map via API:', error);
        handleRaidFailure('Failed to navigate to map');
        return;
    }
    
    // Get user's selected setup method
    const settings = loadSettings();
    const setupMethod = settings.setupMethod || 'Auto-setup';
    
    // Find and click the appropriate setup button
    console.log(`[Raid Hunter] Looking for ${setupMethod} button...`);
    const setupButton = findSetupButton(setupMethod);
    if (!setupButton) {
        console.log(`[Raid Hunter] ${setupMethod} button not found`);
        handleRaidFailure(`${setupMethod} button not found`);
        return;
    }
    
    console.log(`[Raid Hunter] Clicking ${setupMethod} button...`);
    setupButton.click();
    await new Promise(resolve => setTimeout(resolve, AUTO_SETUP_DELAY));
    
    // Check automation status after auto-setup
    if (!isAutomationActive()) {
        cancelCurrentRaid('automation disabled after auto-setup');
        return;
    }
    
    // Load settings once for all raid configuration
    const raidSettings = loadSettings();

    // Enable autoplay mode
    console.log('[Raid Hunter] Enabling autoplay mode...');
    ensureAutoplayMode();
    await new Promise(resolve => setTimeout(resolve, AUTOPLAY_SETUP_DELAY));
    
    // Check automation status after enabling autoplay
    if (!isAutomationActive()) {
        cancelCurrentRaid('automation disabled after enabling autoplay');
        return;
    }
    
    // Calculate and display sleep duration based on raid expiration
    try {
        const raidState = globalThis.state.raids.getSnapshot();
        const currentRaidList = raidState.context.list || [];
        const currentRaid = currentRaidList.find(raid => raid.roomId === roomId);
        
        if (currentRaid && currentRaid.expiresAt) {
            const now = Date.now();
            const sleepDuration = currentRaid.expiresAt - now;
            const sleepMinutes = Math.round(sleepDuration / 1000 / 60);
            const sleepHours = Math.floor(sleepMinutes / 60);
            const remainingMinutes = sleepMinutes % 60;
            
            if (sleepDuration > 0) {
                const timeString = sleepHours > 0 ? 
                    `${sleepHours}h ${remainingMinutes}m` : 
                    `${remainingMinutes}m`;
                console.log(`[Raid Hunter] Autoplay enabled! Script will sleep for ${timeString} until raid expires`);
                console.log(`[Raid Hunter] Raid expires at: ${new Date(currentRaid.expiresAt).toLocaleString()}`);
            } else {
                console.log('[Raid Hunter] Warning: Raid has already expired!');
            }
        }
    } catch (error) {
        console.error('[Raid Hunter] Error calculating sleep duration:', error);
    }

    // Enable Bestiary Automator's autorefill stamina if Raid Hunter setting is enabled
    if (raidSettings.autoRefillStamina) {
        console.log('[Raid Hunter] Auto-refill stamina enabled - enabling Bestiary Automator autorefill...');
        // Add a small delay to ensure Bestiary Automator is fully initialized in Chrome
        setTimeout(() => {
            const success = enableBestiaryAutomatorStaminaRefill();
            if (!success) {
                // If first attempt failed, try again with longer delay for Chrome
                console.log('[Raid Hunter] First attempt failed, retrying with longer delay for Chrome...');
                setTimeout(() => {
                    enableBestiaryAutomatorStaminaRefill();
                }, 2000);
            }
        }, 500);
    }
    if (raidSettings.fasterAutoplay) {
        console.log('[Raid Hunter] Faster autoplay enabled - enabling Bestiary Automator faster autoplay...');
        // Add a small delay to ensure Bestiary Automator is fully initialized in Chrome
        setTimeout(() => {
            const success = enableBestiaryAutomatorFasterAutoplay();
            if (!success) {
                // If first attempt failed, try again with longer delay for Chrome
                console.log('[Raid Hunter] First attempt failed, retrying with longer delay for Chrome...');
                setTimeout(() => {
                    enableBestiaryAutomatorFasterAutoplay();
                }, 2000);
            }
        }, 500);
    }
    if (raidSettings.enableDragonPlant) {
        console.log('[Raid Hunter] Dragon Plant enabled - enabling via Autoseller...');
        enableAutosellerDragonPlant();
    }
    
    // CRITICAL FIX: Wait for Bestiary Automator to initialize (standardized timing)
    console.log('[Raid Hunter] Waiting for Bestiary Automator to initialize...');
    await new Promise(resolve => setTimeout(resolve, BESTIARY_INIT_WAIT));
    
    // Check stamina before attempting to start raid
    console.log('[Raid Hunter] Checking stamina status...');
    const staminaCheck = hasInsufficientStamina();
    
    if (staminaCheck.insufficient) {
        console.log(`[Raid Hunter] Insufficient stamina (needs ${staminaCheck.cost}) - starting monitoring`);
        
        // Start stamina recovery monitoring (tooltip + API for progress) with continuous monitoring
        const continuousStaminaMonitoring = () => {
            console.log('[Raid Hunter] Stamina recovered - clicking Start button');
            
            // Check if still valid to continue
            if (!isAutomationActive() || !isCurrentlyRaiding) {
                console.log('[Raid Hunter] Raid cancelled during stamina wait');
                stopStaminaTooltipMonitoring();
                return;
            }
            
            // Check if user is still on correct raid map
            if (!isOnCorrectRaidMap()) {
                console.log('[Raid Hunter] User changed map - stopping stamina monitoring');
                stopStaminaTooltipMonitoring();
                handleRaidFailure('User changed map during stamina wait');
                return;
            }
            
            // Check if autoplay session is actually running (not just mode enabled)
            const boardContext = globalThis.state.board.getSnapshot().context;
            const isAutoplayMode = boardContext.mode === 'autoplay';
            const isAutoplaySessionRunning = boardContext.isRunning || boardContext.autoplayRunning;
            
            if (isAutoplayMode && isAutoplaySessionRunning) {
                // Autoplay session is actually running - just continue monitoring
                console.log('[Raid Hunter] Autoplay session running - continuing stamina monitoring');
                startStaminaTooltipMonitoring(continuousStaminaMonitoring);
            } else {
                // Autoplay session is not running - need to click Start button
                console.log('[Raid Hunter] Autoplay session not running - clicking Start button');
                
                // Find and click Start button
                const startButton = findButtonByText('Start');
                if (!startButton) {
                    console.log('[Raid Hunter] Start button not found after stamina recovery');
                    handleRaidFailure('Start button not found after stamina recovery');
                    return;
                }
                
                console.log('[Raid Hunter] Clicking Start button after stamina recovery...');
                startButton.click();
                
                // Set up stamina depletion monitoring for the new autoplay session
                const handleStaminaDepletion = () => {
                    const continuousStaminaMonitoring = () => {
                        console.log('[Raid Hunter] Stamina recovered - checking autoplay state');
                        
                        // Check if still valid to continue
                        if (!isAutomationActive() || !isCurrentlyRaiding) {
                            console.log('[Raid Hunter] Raid no longer active during stamina recovery');
                            stopStaminaTooltipMonitoring();
                            return;
                        }
                        
                        // Check if user is still on correct raid map
                        if (!isOnCorrectRaidMap()) {
                            console.log('[Raid Hunter] User changed map - stopping stamina monitoring');
                            stopStaminaTooltipMonitoring();
                            return;
                        }
                        
                        // Check if autoplay session is actually running (not just mode enabled)
                        const boardContext = globalThis.state.board.getSnapshot().context;
                        const isAutoplayMode = boardContext.mode === 'autoplay';
                        const isAutoplaySessionRunning = boardContext.isRunning || boardContext.autoplayRunning;
                        
                        if (isAutoplayMode && isAutoplaySessionRunning) {
                            // Autoplay session is actually running - just continue monitoring
                            console.log('[Raid Hunter] Autoplay session running - continuing stamina monitoring');
                            startStaminaTooltipMonitoring(continuousStaminaMonitoring);
                        } else {
                            // User changed mode (manual or sandbox) - respect their choice and stop monitoring
                            console.log(`[Raid Hunter] Mode changed to ${boardContext.mode} - stopping stamina monitoring`);
                            stopStaminaTooltipMonitoring();
                            cancelCurrentRaid('User changed mode during stamina wait');
                        }
                    };
                    
                    startStaminaTooltipMonitoring(continuousStaminaMonitoring);
                };
                
                // Watch for stamina depletion during autoplay
                const watchStaminaDepletion = () => {
                    const depletionCheckInterval = setInterval(() => {
                        const currentCheck = hasInsufficientStamina();
                        if (currentCheck.insufficient) {
                            console.log('[Raid Hunter] Stamina depleted during autoplay - starting recovery monitoring');
                            clearInterval(depletionCheckInterval);
                            handleStaminaDepletion();
                        }
                    }, 5000); // Check every 5 seconds
                    
                    // Store for cleanup
                    window.raidHunterDepletionInterval = depletionCheckInterval;
                };
                
                watchStaminaDepletion();
                
                console.log('[Raid Hunter] Autoplay started after stamina recovery');
            }
        };
        
        startStaminaTooltipMonitoring(continuousStaminaMonitoring, staminaCheck.cost); // Pass required stamina
        
        return; // Exit - monitoring will handle the rest
    }
    
    console.log('[Raid Hunter] Stamina sufficient - checking automation status...');
    
    // Check automation status before clicking Start button
    if (!isAutomationActive()) {
        cancelCurrentRaid('automation disabled before starting raid');
        return;
    }

    // Find and click Start button
    console.log('[Raid Hunter] Looking for Start button...');
    const startButton = findButtonByText('Start');
    if (!startButton) {
        console.log('[Raid Hunter] Start button not found');
        handleRaidFailure('Start button not found');
        return;
    }
    
    console.log('[Raid Hunter] Clicking Start button...');
    startButton.click();
    await new Promise(resolve => setTimeout(resolve, AUTOMATION_CHECK_DELAY));
    
    // Final check after clicking Start button
    if (!isAutomationActive()) {
        cancelCurrentRaid('automation disabled after clicking Start');
        return;
    }
    
    // Now that Start button is clicked, modify quest button to show raiding state
    modifyQuestButtonForRaiding();
    
    // Start monitoring autoplay state changes
    startAutoplayStateMonitoring();
    
    // Start continuous stamina monitoring for depletion during autoplay (recursive)
    const continuousStaminaMonitoring = () => {
        console.log('[Raid Hunter] Stamina recovered - checking autoplay state');
        
        // Check if still valid to continue
        if (!isAutomationActive() || !isCurrentlyRaiding) {
            console.log('[Raid Hunter] Raid no longer active during stamina recovery');
            stopStaminaTooltipMonitoring();
            return;
        }
        
        // Check if user is still on correct raid map
        if (!isOnCorrectRaidMap()) {
            console.log('[Raid Hunter] User changed map - stopping stamina monitoring');
            stopStaminaTooltipMonitoring();
            return;
        }
        
        // Check if autoplay session is actually running (not just mode enabled)
        const boardContext = globalThis.state.board.getSnapshot().context;
        const isAutoplayMode = boardContext.mode === 'autoplay';
        const isAutoplaySessionRunning = boardContext.isRunning || boardContext.autoplayRunning;
        
        if (isAutoplayMode && isAutoplaySessionRunning) {
            // Autoplay session is actually running - just continue monitoring
            console.log('[Raid Hunter] Autoplay session running - continuing stamina monitoring');
            startStaminaTooltipMonitoring(continuousStaminaMonitoring);
        } else {
            // Autoplay session is not running - need to click Start button
            console.log('[Raid Hunter] Autoplay session not running - clicking Start button');
            
            // Find and click Start button
            const startButton = findButtonByText('Start');
            if (!startButton) {
                console.log('[Raid Hunter] Start button not found after stamina recovery');
                cancelCurrentRaid('Start button not found after stamina recovery');
                return;
            }
            
            console.log('[Raid Hunter] Clicking Start button after stamina recovery...');
            startButton.click();
            
            // Continue monitoring for stamina depletion
            startStaminaTooltipMonitoring(continuousStaminaMonitoring);
        }
    };
    
    startStaminaTooltipMonitoring(continuousStaminaMonitoring);
    
    console.log('[Raid Hunter] Raid automation sequence completed');
    
    // Verify raid actually started by checking if we're in autoplay mode
    setTimeout(() => {
        verifyRaidStarted();
    }, 1000);
    
    // Start the actual sleep timer for the raid duration
    startRaidSleepTimer(roomId);
}

// Verify that the raid actually started
function verifyRaidStarted() {
    try {
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (boardContext.mode === 'autoplay') {
            console.log('[Raid Hunter] Raid verification successful - in autoplay mode');
            raidRetryCount = 0; // Reset retry count on success
        } else {
            console.log('[Raid Hunter] Raid verification failed - not in autoplay mode');
            handleRaidFailure('Raid failed to start - not in autoplay mode');
        }
    } catch (error) {
        console.error('[Raid Hunter] Error verifying raid start:', error);
        handleRaidFailure('Error verifying raid start');
    }
}

// Start the actual sleep timer for raid duration
function startRaidSleepTimer(roomId) {
    try {
        const raidState = globalThis.state.raids.getSnapshot();
        const currentRaidList = raidState.context.list || [];
        const currentRaid = currentRaidList.find(raid => raid.roomId === roomId);
        
        if (currentRaid && currentRaid.expiresAt) {
            const now = Date.now();
            const sleepDuration = currentRaid.expiresAt - now;
            
            if (sleepDuration > 0) {
                const sleepMinutes = Math.round(sleepDuration / 1000 / 60);
                const sleepHours = Math.floor(sleepMinutes / 60);
                const remainingMinutes = sleepMinutes % 60;
                const timeString = sleepHours > 0 ? 
                    `${sleepHours}h ${remainingMinutes}m` : 
                    `${remainingMinutes}m`;
                
                console.log(`[Raid Hunter] Starting sleep timer for ${timeString} until raid expires`);
                console.log(`[Raid Hunter] Stopping interfering monitoring (keeping autoplay monitoring for map switch detection)`);
                
                // Stop interfering monitoring (but keep autoplay state monitoring for map switch detection)
                if (raidEndCheckInterval) {
                    clearInterval(raidEndCheckInterval);
                    raidEndCheckInterval = null;
                }
                if (questLogMonitorInterval) {
                    clearInterval(questLogMonitorInterval);
                    questLogMonitorInterval = null;
                }
                if (raidListMonitor) {
                    raidListMonitor.unsubscribe();
                    raidListMonitor = null;
                }
                setupRaidListMonitoring();
                
                // NOTE: We intentionally keep autoplay state monitoring AND stamina tooltip monitoring running
                
                // Set up the sleep timer
                setTimeout(() => {
                    console.log(`[Raid Hunter] Raid sleep timer expired - checking for new raids`);
                    isCurrentlyRaiding = false;
                    currentRaidInfo = null;
                    updateRaidState();
                    checkForExistingRaids();
                }, sleepDuration);
                
                // Optional: Status updates every 10 minutes (less frequent)
                const statusInterval = setInterval(() => {
                    const remaining = Math.round((currentRaid.expiresAt - Date.now()) / 1000 / 60);
                    if (remaining > 0) {
                        console.log(`[Raid Hunter] Raid in progress - ${remaining} minutes remaining`);
                    } else {
                        clearInterval(statusInterval);
                    }
                }, 10 * 60 * 1000); // Every 10 minutes
                
            } else {
                console.log('[Raid Hunter] Raid has already expired!');
            }
        }
    } catch (error) {
        console.error('[Raid Hunter] Error starting raid sleep timer:', error);
    }
}




// Handle raid failure with retry logic
function handleRaidFailure(reason) {
    console.log(`[Raid Hunter] Raid failed: ${reason}`);
    
    raidRetryCount++;
    
    if (raidRetryCount < maxRetryAttempts) {
        console.log(`[Raid Hunter] Retrying raid (attempt ${raidRetryCount}/${maxRetryAttempts}) in 5 seconds...`);
        
        // Put the raid back in the queue for retry (only if still enabled)
        if (currentRaidInfo) {
            const settings = loadSettings();
            const enabledMaps = settings.enabledRaidMaps || [];
            if (enabledMaps.includes(currentRaidInfo.name)) {
                // Preserve priority when re-queueing
                const priority = currentRaidInfo.priority || getRaidPriority(currentRaidInfo.name);
                raidQueue.unshift({
                    ...currentRaidInfo,
                    priority: priority
                }); // Put back at front of queue
                const priorityLabel = getPriorityLabel(priority);
                console.log(`[Raid Hunter] Retry: ${currentRaidInfo.name} (Priority: ${priorityLabel}) is still enabled, adding back to queue`);
            } else {
                console.log(`[Raid Hunter] Retry: ${currentRaidInfo.name} is no longer enabled, not retrying`);
            }
        }
        
        // Reset state and retry after delay
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
        
        // Restore quest button appearance when raid fails
        restoreQuestButtonAppearance();
        
        // Stop quest button validation monitoring
        stopAutoplayStateMonitoring();
        stopQuestButtonValidation();
        
        // Stop stamina tooltip monitoring
        stopStaminaTooltipMonitoring();
        
        retryTimeout = setTimeout(() => {
            // Check if raid processing can proceed
            if (canProcessRaid('retry') && raidQueue.length > 0) {
                console.log('[Raid Hunter] Retrying raid after failure...');
                processNextRaid();
            }
        }, RAID_FAILURE_RETRY_DELAY);
    } else {
        console.log('[Raid Hunter] Max retry attempts reached - giving up on this raid');
        
        // Reset state and move to next raid
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
        raidRetryCount = 0;
        
        // Restore quest button appearance when max retries reached
        restoreQuestButtonAppearance();
        
        // Stop quest button validation monitoring
        stopAutoplayStateMonitoring();
        stopQuestButtonValidation();
        
        // Stop stamina tooltip monitoring
        stopStaminaTooltipMonitoring();
        
        // Process next raid if available
        if (raidQueue.length > 0) {
            setTimeout(() => {
                // Check if raid processing can proceed
                if (canProcessRaid('next raid processing')) {
                    processNextRaid();
                }
            }, NEXT_RAID_DELAY);
        }
    }
}

function ensureAutoplayMode() {
    // HIGH and MEDIUM priority raids take control from anyone (including Better Tasker)
    // LOW priority raids MUST yield to Better Tasker when it becomes active
    const currentOwner = window.AutoplayManager.getCurrentOwner();
    const isHighPriorityRaid = currentRaidInfo && currentRaidInfo.priority === RAID_PRIORITY.HIGH;
    const isMediumPriorityRaid = currentRaidInfo && currentRaidInfo.priority === RAID_PRIORITY.MEDIUM;
    const isLowPriorityRaid = currentRaidInfo && currentRaidInfo.priority === RAID_PRIORITY.LOW;
    
    // For LOW priority raids: Check Better Tasker BEFORE taking control
    if (isLowPriorityRaid) {
        const betterTaskerState = window.betterTaskerState;
        // Check if Better Tasker is active and should take priority
        if (betterTaskerState && betterTaskerState.taskerState === 'enabled') {
            if (betterTaskerState.hasActiveTask === true || 
                betterTaskerState.taskHuntingOngoing === true ||
                betterTaskerState.taskOperationInProgress === true ||
                betterTaskerState.pendingTaskCompletion === true ||
                currentOwner === 'Better Tasker') {
                console.log(`[Raid Hunter] Better Tasker is active - LOW priority raid yields control`);
                // Release control to allow Better Tasker to take over
                if (currentOwner === 'Raid Hunter') {
                    window.AutoplayManager.releaseControl('Raid Hunter');
                }
                return false;
            }
        }
    }
    
    if (currentOwner && currentOwner !== 'Raid Hunter') {
        // HIGH and MEDIUM priority raids take control from anyone
        if (isHighPriorityRaid || isMediumPriorityRaid) {
            const priorityLabel = isHighPriorityRaid ? 'HIGH' : 'MEDIUM';
            console.log(`[Raid Hunter] Taking autoplay control from ${currentOwner} for ${priorityLabel} priority raid`);
            window.AutoplayManager.currentOwner = 'Raid Hunter';
        } 
        // Low priority raids take control from Better Boosted Maps and others (but not Better Tasker)
        else if (isLowPriorityRaid && currentOwner !== 'Better Tasker') {
            console.log(`[Raid Hunter] Taking autoplay control from ${currentOwner} for low priority raid`);
            window.AutoplayManager.currentOwner = 'Raid Hunter';
        }
        // Better Tasker has control - LOW priority raid yields
        else if (isLowPriorityRaid && currentOwner === 'Better Tasker') {
            console.log(`[Raid Hunter] Better Tasker has control - LOW priority raid yields`);
            return false;
        }
    }
    
    return withControl(window.AutoplayManager, 'Raid Hunter', () => {
        const boardContext = globalThis.state.board.getSnapshot().context;
        const currentMode = boardContext.mode;
        
        if (currentMode !== 'autoplay') {
            const priorityLabel = getPriorityLabel(isHighPriorityRaid ? RAID_PRIORITY.HIGH : RAID_PRIORITY.MEDIUM);
            globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
            console.log(`[Raid Hunter] Switched to autoplay mode (${priorityLabel} priority raid)`);
            return true;
        }
        return false;
    }, 'switch to autoplay mode for raid');
}

// Checks for existing raids.
async function checkForExistingRaids() {
    try {
        // Check if automation is enabled
        if (!isAutomationActive()) {
            console.log('[Raid Hunter] Automation is disabled - skipping existing raid check');
            return;
        }
        
        // First check if there are any raids available in the raid state
        const raidState = globalThis.state.raids.getSnapshot();
        const currentRaidList = raidState.context.list || [];
        
        if (currentRaidList.length === 0) {
            console.log('[Raid Hunter] No raids currently available');
            return;
        }
        
        console.log('[Raid Hunter] Found existing raids:', currentRaidList.length);
        console.log('[Raid Hunter] Active raid details:', currentRaidList);
        
        // Check if we're already in autoplay mode and on a raid map
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (boardContext.mode === 'autoplay') {
            // Check if we're on a raid map to determine if we're actually raiding
            const currentRoomId = getCurrentRoomId();
            const settings = loadSettings();
            const enabledMaps = settings.enabledRaidMaps || [];
            
            // Find if current room matches any enabled raid
            let matchingRaid = null;
            for (const raid of currentRaidList) {
                const raidName = getEventNameForRoomId(raid.roomId);
                if (raid.roomId === currentRoomId && enabledMaps.includes(raidName)) {
                    matchingRaid = raid;
                    break;
                }
            }
            
            if (matchingRaid) {
                const raidName = getEventNameForRoomId(matchingRaid.roomId);
                const priority = getRaidPriority(raidName);
                const priorityLabel = getPriorityLabel(priority, true);
                
                console.log('[Raid Hunter] ═══════════════════════════════════════════════════════════');
                console.log('[Raid Hunter] RESUMING EXISTING RAID');
                console.log('[Raid Hunter]   - Raid Name:', raidName);
                console.log('[Raid Hunter]   - Room ID:', matchingRaid.roomId);
                console.log('[Raid Hunter]   - Priority:', priorityLabel);
                console.log('[Raid Hunter] ═══════════════════════════════════════════════════════════');
                
                // Log priority information for medium priority raids
                if (priority === RAID_PRIORITY.MEDIUM) {
                    console.log('[Raid Hunter] This is a MEDIUM PRIORITY raid - does not yield to Better Tasker');
                }
                
                isCurrentlyRaiding = true;
                currentRaidInfo = {
                    name: raidName,
                    roomId: matchingRaid.roomId,
                    priority: priority,
                    expiresAt: matchingRaid.expiresAt || Infinity
                };
                
                // Modify quest button to show raiding state
                modifyQuestButtonForRaiding();
                
                // Start monitoring autoplay state changes
                startAutoplayStateMonitoring();
                
                startRaidEndChecking(); // Start monitoring for raid end
                return;
            } else {
                console.log('[Raid Hunter] In autoplay mode but not on a raid map - proceeding with normal raid processing');
                // Continue with normal raid processing below
            }
        }
        
        // Update raid queue and process next raid
        updateRaidState();
        if (raidQueue.length > 0) {
            console.log(`[Raid Hunter] Found ${raidQueue.length} raids available - processing next raid`);
            
            // If we're currently in autoplay mode but not on a raid map, raids have priority
            // We should stop current autoplay and switch to the raid
            if (boardContext.mode === 'autoplay' && !isCurrentlyRaiding) {
                console.log('[Raid Hunter] Currently autoplaying on non-raid map - raids have priority, switching to raid');
            }
            
            // Apply raid start delay if configured
            const settings = loadSettings();
            const raidStartDelay = settings.raidDelay || DEFAULT_RAID_START_DELAY;
            
            if (raidStartDelay > 0) {
                console.log(`[Raid Hunter] Applying raid start delay: ${raidStartDelay} seconds`);
                
            setTimeout(() => {
                // Check if raid processing can proceed
                if (canProcessRaid('existing raid delay') && raidQueue.length > 0) {
                    console.log('[Raid Hunter] Raid start delay completed - processing raid (raid priority)');
                    processNextRaid();
                }
            }, raidStartDelay * 1000);
            } else {
                // No delay, process immediately
                processNextRaid();
            }
        } else {
            const settings = loadSettings();
            const enabledMaps = settings.enabledRaidMaps || [];
            if (enabledMaps.length === 0) {
                console.log('[Raid Hunter] No raid maps enabled in settings - please configure which raids to auto-raid');
                console.log('[Raid Hunter] Click the Settings button in the Raid Monitor to enable raid maps');
            } else {
                console.log('[Raid Hunter] No enabled raids found in UI, but raids are available');
            }
        }
    } catch (error) {
        console.error("[Raid Hunter] Error checking for existing raids:", error);
    }
}

// Sets up Board Analyzer coordination
function setupBoardAnalyzerCoordination() {
    // Poll for Board Analyzer state changes every 2 seconds (reduced from 500ms)
    boardAnalyzerCoordinationInterval = setInterval(() => {
        handleBoardAnalyzerCoordination();
    }, 2000);
    
    console.log('[Raid Hunter] Board Analyzer coordination set up');
}

// Sets up raid monitoring.
function setupRaidMonitoring() {
    if (raidUnsubscribe && typeof raidUnsubscribe === 'function') {
        raidUnsubscribe();
        raidUnsubscribe = null;
    }

    if (globalThis.state && globalThis.state.raids) {
        raidUnsubscribe = globalThis.state.raids.on("newRaid", (e) => {
            resetRaidCountdown();
            handleNewRaid(e.raid);
        });
        
        // Set up raid list monitoring for end detection
        setupRaidListMonitoring();
        
        // Start periodic raid end checking
        startRaidEndChecking();
    }
    
    // Fight toast monitoring is set up in init() and runs independently
}

// Set up fight toast monitoring (now consolidated with quest log monitoring)
function setupFightToastMonitoring() {
    console.log('[Raid Hunter] Fight toast monitoring is now handled by the consolidated observer');
    // Fight toast monitoring is now handled by the consolidated questLogObserver
    // No need for a separate bodyObserver
}

// Handles new raid detection.
async function handleNewRaid(raid) {
    // Check if automation is enabled
    if (!isAutomationActive()) {
        console.log('[Raid Hunter] New raid detected but automation is disabled');
        return;
    }
    
    const currentTime = Date.now();
    if (currentTime - lastRaidTime < 30000) {
        return;
    }
    
    lastRaidTime = currentTime;
    
    try {
        const settings = loadSettings();
        const enabledMaps = settings.enabledRaidMaps || []; // Default to none if not set
        
        while (true) {
            const closeButton = findButtonByText('Close');
            if (closeButton) {
                closeButton.click();
                await new Promise(resolve => setTimeout(resolve, BESTIARY_RETRY_DELAY));
            } else {
                break;
            }
        }
        
        // Update raid queue and process next raid
        updateRaidState();
        if (raidQueue.length > 0) {
            console.log(`[Raid Hunter] New raids detected - processing next raid (raid priority)`);
            
            // Apply raid start delay if configured
            const raidStartDelay = settings.raidDelay || DEFAULT_RAID_START_DELAY;
            
            if (raidStartDelay > 0) {
                console.log(`[Raid Hunter] Applying raid start delay: ${raidStartDelay} seconds`);
                
                setTimeout(() => {
                    // Check if raid processing can proceed
                    if (canProcessRaid('new raid delay') && raidQueue.length > 0) {
                        console.log('[Raid Hunter] Raid start delay completed - processing raid (raid priority)');
                        processNextRaid();
                    }
                }, raidStartDelay * 1000);
            } else {
                // No delay, process immediately
                processNextRaid();
            }
        }
    } catch (error) {
        console.error("[Raid Hunter] Error handling raid:", error);
    }
}

// ============================================================================
// 9. QUEST BUTTON MODIFICATION FUNCTIONS
// ============================================================================

// Cleanup function for modal state (like Cyclopedia)
function cleanupRaidHunterModal() {
    try {
        // Clear modal reference
        if (activeRaidHunterModal) {
            activeRaidHunterModal = null;
        }
        
        // Clean up modal cleanup observer
        if (modalCleanupObserver) {
            modalCleanupObserver.disconnect();
            modalCleanupObserver = null;
        }
        
        // Reset modal state
        raidHunterModalInProgress = false;
        lastModalCall = 0;
        
        // Additional defensive cleanup - check if modal is still in DOM
        const existingModal = document.querySelector('div[role="dialog"][data-state="open"]');
        if (existingModal && existingModal.querySelector('#raid-hunter-settings-btn')) {
            console.log('[Raid Hunter] Found lingering modal in DOM, attempting cleanup');
            try {
                existingModal.remove();
            } catch (removeError) {
                console.error('[Raid Hunter] Error removing lingering modal:', removeError);
            }
        }
        
        console.log('[Raid Hunter] Modal cleanup completed');
    } catch (error) {
        console.error('[Raid Hunter] Error during modal cleanup:', error);
    }
}

// Constants for modal dimensions (matching Dice Roller)
const RAID_HUNTER_MODAL_WIDTH = 700;
const RAID_HUNTER_MODAL_HEIGHT = 400;

// Open Raid Hunter Settings Modal (Cyclopedia-style robust implementation)
function openRaidHunterSettingsModal() {
    try {
        const now = Date.now();
        if (raidHunterModalInProgress) return;
        if (now - lastModalCall < 1000) return;
        
        lastModalCall = now;
        raidHunterModalInProgress = true;
        
        (() => {
            try {
                if (!raidHunterModalInProgress) return;
                
                // Simulate ESC key to remove scroll lock
                dispatchEsc();
                
                // Small delay to ensure scroll lock is removed
                setTimeout(() => {
                    if (typeof context !== 'undefined' && context.api && context.api.ui) {
                        try {
                            // Create settings content
                            const settingsContent = createSettingsContent();
                            
                            // Open modal using the same API as Cyclopedia
                            activeRaidHunterModal = context.api.ui.components.createModal({
                                title: getLocalizedText(UI_TEXT.TITLES.RAID_HUNTER_SETTINGS, UI_TEXT.TITLES_PT.RAID_HUNTER_SETTINGS),
                                width: RAID_HUNTER_MODAL_WIDTH,
                                height: RAID_HUNTER_MODAL_HEIGHT,
                                content: settingsContent,
                                buttons: [{ text: getLocalizedText(UI_TEXT.BUTTONS.CLOSE, UI_TEXT.BUTTONS_PT.CLOSE), primary: true }], // Add Close button like other mods
                                onClose: () => {
                                    console.log('[Raid Hunter] Settings modal closed');
                                    cleanupRaidHunterModal();
                                }
                            });
                            
                            // Inject auto-save indicator into the existing modal footer
                            setTimeout(() => {
                                const modalElement = document.querySelector('div[role="dialog"][data-state="open"]');
                                if (modalElement) {
                                    const footer = modalElement.querySelector('.flex.justify-end.gap-2');
                                    if (footer) {
                                        // Create auto-save indicator
                                        const autoSaveIndicator = document.createElement('div');
                                        autoSaveIndicator.textContent = getLocalizedText(
                                            '✓ Settings auto-save when changed',
                                            '✓ Configurações são salvas automaticamente quando alteradas'
                                        );
                                        autoSaveIndicator.className = 'pixel-font-16';
                                        autoSaveIndicator.style.cssText = `
                                            font-size: 11px;
                                            color: ${COLOR_SUCCESS};
                                            font-style: italic;
                                            margin-right: auto;
                                        `;
                                        
                                        // Modify footer to use space-between layout
                                        footer.style.cssText = `
                                            display: flex;
                                            justify-content: space-between;
                                            align-items: center;
                                            gap: 2px;
                                        `;
                                        
                                        // Insert auto-save indicator at the beginning
                                        footer.insertBefore(autoSaveIndicator, footer.firstChild);
                                    }
                                }
                            }, 100);
                            
                            // Fallback cleanup for when onClose doesn't work
                            setTimeout(() => {
                                const modalElement = document.querySelector('div[role="dialog"][data-state="open"]');
                                if (modalElement) {
                                    // Watch for modal removal
                                    modalCleanupObserver = new MutationObserver((mutations) => {
                                        mutations.forEach((mutation) => {
                                            mutation.removedNodes.forEach((node) => {
                                                if (node === modalElement || node.contains?.(modalElement)) {
                                                    modalCleanupObserver.disconnect();
                                                    modalCleanupObserver = null;
                                                    cleanupRaidHunterModal();
                                                }
                                            });
                                        });
                                    });
                                    modalCleanupObserver.observe(document.body, { childList: true, subtree: true });
                                }
                            }, 100);
                            
                            // Override modal size to ensure it's actually the correct size (matching Dice Roller approach)
                            setTimeout(() => {
                                const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
                                if (dialog) {
                                    dialog.style.width = RAID_HUNTER_MODAL_WIDTH + 'px';
                                    dialog.style.minWidth = RAID_HUNTER_MODAL_WIDTH + 'px';
                                    dialog.style.maxWidth = RAID_HUNTER_MODAL_WIDTH + 'px';
                                    dialog.style.height = RAID_HUNTER_MODAL_HEIGHT + 'px';
                                    dialog.style.minHeight = RAID_HUNTER_MODAL_HEIGHT + 'px';
                                    dialog.style.maxHeight = RAID_HUNTER_MODAL_HEIGHT + 'px';
                                    
                                    // Load and apply saved settings
                                    loadAndApplySettings();
                                }
                            }, 50);
                        } catch (error) {
                            console.error('[Raid Hunter] Error creating modal:', error);
                            try {
                                alert('Failed to open settings. Please try again.');
                            } catch (alertError) {
                                console.error('[Raid Hunter] Even fallback alert failed:', alertError);
                            }
                        } finally {
                            raidHunterModalInProgress = false;
                        }
                    } else {
                        console.warn('[Raid Hunter] API not available for modal creation');
                        alert('Raid Hunter Settings - API not available');
                        raidHunterModalInProgress = false;
                    }
                }, 100);
            } catch (error) {
                console.error('[Raid Hunter] Error in modal creation wrapper:', error);
                raidHunterModalInProgress = false;
            }
        })();
        
    } catch (error) {
        console.error('[Raid Hunter] Error in openRaidHunterSettingsModal:', error);
        
        if (typeof context !== 'undefined' && context.api && context.api.ui) {
            try {
                context.api.ui.components.createModal({
                    title: 'Error',
                    content: '<p>Failed to open Raid Hunter Settings. Please try again later.</p>',
                    buttons: [{ text: 'OK', primary: true }]
                });
            } catch (modalError) {
                console.error('[Raid Hunter] Error showing error modal:', modalError);
                alert('Failed to open settings. Please try again.');
            }
        }
        
        raidHunterModalInProgress = false;
    }
}

// Create settings content with 2-column layout (matching Super Mods styling)
function createSettingsContent() {
    // Main container with 2-column layout
    const mainContainer = document.createElement('div');
    mainContainer.style.cssText = `
        display: flex;
        flex-direction: row;
        width: 100%;
        height: 100%;
        min-width: 665px;
        max-width: 700px;
        min-height: 400px;
        max-height: 400px;
        box-sizing: border-box;
        overflow: hidden;
        background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
        color: ${COLOR_WHITE};
        font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
        border: 4px solid transparent;
        border-image: url('https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png') 6 fill stretch;
        border-radius: 6px;
    `;
    
    // Left column - Auto-Raid Settings
    const leftColumn = document.createElement('div');
    leftColumn.style.cssText = `
        width: 250px;
        min-width: 250px;
        max-width: 250px;
        display: flex;
        flex-direction: column;
        border-right: 1px solid ${COLOR_BORDER};
        overflow-y: auto;
        min-height: 0;
        padding: 0;
        margin: 0;
        background: rgba(0, 0, 0, 0.2);
    `;
    
    // Right column - Other Settings
    const rightColumn = document.createElement('div');
    rightColumn.style.cssText = `
        flex: 1 1 0%;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow-y: auto;
        background: rgba(0, 0, 0, 0.1);
        width: auto;
        height: 100%;
    `;
    
    // Left column content - Auto-Raid Settings
    const leftContent = createAutoRaidSettings();
    leftColumn.appendChild(leftContent);
    
    // Right column content - Other Settings
    const rightContent = createOtherSettings();
    rightColumn.appendChild(rightContent);
    
    mainContainer.appendChild(leftColumn);
    mainContainer.appendChild(rightColumn);
    
    return mainContainer;
}

// Create Auto-Raid Settings section
function createAutoRaidSettings() {
    const container = document.createElement('div');
    container.style.cssText = `
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        padding: 10px;
        box-sizing: border-box;
        justify-content: space-between;
    `;
    
    const title = document.createElement('h3');
    title.textContent = getLocalizedText(UI_TEXT.TITLES.AUTO_RAID_SETTINGS, UI_TEXT.TITLES_PT.AUTO_RAID_SETTINGS);
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0 0 10px 0;
        color: ${COLOR_ACCENT};
        font-size: 16px;
        font-weight: bold;
        text-align: center;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    container.appendChild(title);
    
    // Create wrapper for main settings content
    const settingsWrapper = document.createElement('div');
    settingsWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
    `;
    
    // Raid Delay setting
    const delayDiv = document.createElement('div');
    delayDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    const delayLabel = document.createElement('label');
    delayLabel.textContent = getLocalizedText(UI_TEXT.LABELS.RAID_START_DELAY, UI_TEXT.LABELS_PT.RAID_START_DELAY);
    delayLabel.className = 'pixel-font-16';
    delayLabel.style.cssText = `
        font-weight: bold;
        color: ${COLOR_WHITE};
        margin-bottom: 4px;
    `;
    delayDiv.appendChild(delayLabel);
    
    const delayInput = createStyledInput('number', 'raidDelay', 3, `
        width: 100%;
        padding: 6px;
        background: ${COLOR_DARK_GRAY};
        border: 1px solid ${COLOR_ACCENT};
        color: ${COLOR_WHITE};
        border-radius: 3px;
        box-sizing: border-box;
        font-size: 14px;
    `, {
        min: 0,
        max: 10,
        className: 'pixel-font-16'
    });
    delayDiv.appendChild(delayInput);
    
    settingsWrapper.appendChild(delayDiv);
    
    // Setup method selection
    const setupMethodDiv = createDropdownSetting(
        'setupMethod',
        getLocalizedText('Setup Method', 'Método de Configuração'),
        '',
        loadSettings().setupMethod || getLocalizedText('Auto-setup', 'Autoconfigurar'),
        getAvailableSetupOptions()
    );
    settingsWrapper.appendChild(setupMethodDiv);
    
    // Auto-refill Stamina setting
    const staminaRefillDiv = document.createElement('div');
    staminaRefillDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    // Container for checkbox and label on same line
    const checkboxLabelContainer = document.createElement('div');
    checkboxLabelContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
    `;
    
    const staminaRefillSetting = createCheckboxSetting('autoRefillStamina', 
        getLocalizedText('Auto-refill Stamina', 'Recarregar Stamina Automaticamente'), 
        '', 
        false);
    staminaRefillDiv.appendChild(staminaRefillSetting);
    settingsWrapper.appendChild(staminaRefillDiv);
    
    // Faster Autoplay setting
    const fasterAutoplayDiv = document.createElement('div');
    fasterAutoplayDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    const fasterAutoplaySetting = createCheckboxSetting('fasterAutoplay', 
        getLocalizedText('Faster Autoplay', 'Autoplay Mais Rápido'), 
        '', 
        false);
    fasterAutoplayDiv.appendChild(fasterAutoplaySetting);
    settingsWrapper.appendChild(fasterAutoplayDiv);
    
    // Dragon Plant setting
    const dragonPlantDiv = document.createElement('div');
    dragonPlantDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    const dragonPlantSetting = createCheckboxSetting('enableDragonPlant', 
        getLocalizedText('Enable Autoplant', 'Ativar Vendedor Automático'), 
        '', 
        false);
    dragonPlantDiv.appendChild(dragonPlantSetting);
    settingsWrapper.appendChild(dragonPlantDiv);
    
    // Add settings wrapper to container
    container.appendChild(settingsWrapper);
    
    // Credit section - subtle at bottom
    const creditDiv = document.createElement('div');
    creditDiv.style.cssText = `
        padding: 8px 0 0 0;
        text-align: center;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    `;
    
    const creditText = document.createElement('div');
    creditText.innerHTML = getLocalizedText(
        'Inspired by <a href="https://bestiaryarena.com/profile/kurak" target="_blank" style="color: #666; text-decoration: none; font-size: 10px; cursor: pointer; transition: color 0.2s ease;" onmouseover="this.style.color=\'#ffe066\'" onmouseout="this.style.color=\'#666\'">Kurak\'s Event Hunter</a>',
        'Inspirado por <a href="https://bestiaryarena.com/profile/kurak" target="_blank" style="color: #666; text-decoration: none; font-size: 10px; cursor: pointer; transition: color 0.2s ease;" onmouseover="this.style.color=\'#ffe066\'" onmouseout="this.style.color=\'#666\'">Kurak\'s Event Hunter</a>'
    );
    creditText.className = 'pixel-font-16';
    creditText.style.cssText = `
        font-size: 10px;
        color: #666;
        font-style: italic;
    `;
    creditDiv.appendChild(creditText);
    container.appendChild(creditDiv);
    
    return container;
}

// Create Other Settings section (Raid Map Selection & Other Settings)
function createOtherSettings() {
    const container = document.createElement('div');
    container.style.cssText = `
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        padding: 10px;
        box-sizing: border-box;
        gap: 20px;
        min-height: 0;
        justify-content: center;
    `;
    
    // Raid Map Selection
    const mapSelectionSection = createRaidMapSelection();
    container.appendChild(mapSelectionSection);
    
    return container;
}

// Create Raid Map Selection section
function createRaidMapSelection() {
    const section = document.createElement('div');
    section.style.cssText = `
        padding: 15px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid ${COLOR_BORDER};
        border-radius: 5px;
        margin: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
    `;
    
    // Title container with question mark tooltip
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 0 0 15px 0;
    `;
    
    const title = document.createElement('h3');
    title.textContent = getLocalizedText('Raid Map Selection', 'Seleção de Mapas de Raid');
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0;
        color: ${COLOR_ACCENT};
        font-size: 16px;
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    titleContainer.appendChild(title);
    
    // Question mark icon with tooltip
    const helpIcon = document.createElement('div');
    helpIcon.textContent = '?';
    helpIcon.className = 'pixel-font-16';
    helpIcon.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(255, 224, 102, 0.2);
        color: ${COLOR_ACCENT};
        border: 1px solid ${COLOR_ACCENT};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: help;
        font-size: 14px;
        font-weight: bold;
        position: relative;
        flex-shrink: 0;
    `;
    
    // Tooltip content
    const tooltip = document.createElement('div');
    tooltip.className = 'pixel-font-16';
    tooltip.style.cssText = `
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 8px;
        padding: 10px;
        background: ${COLOR_DARK_GRAY};
        border: 1px solid ${COLOR_ACCENT};
        border-radius: 5px;
        color: ${COLOR_WHITE};
        font-size: 12px;
        min-width: 250px;
        max-width: 300px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
        z-index: 99999;
        display: none;
        pointer-events: none;
        line-height: 1.6;
    `;
    tooltip.innerHTML = getLocalizedText(
        `Priority Levels:<br><br>` +
        `<strong style="color: ${COLOR_RED}">High Priority:</strong> Highest priority - Never yields<br>` +
        `<strong style="color: ${COLOR_GREEN}">Medium Priority:</strong> Yields to High Priority, never yields to Better Tasker<br>` +
        `<strong style="color: ${COLOR_YELLOW}">Low Priority:</strong> Yields to Medium/High Priority and Better Tasker when active`,
        `Níveis de Prioridade:<br><br>` +
        `<strong style="color: ${COLOR_RED}">Alta Prioridade:</strong> Prioridade mais alta - Nunca cede<br>` +
        `<strong style="color: ${COLOR_GREEN}">Prioridade Média:</strong> Cede à Alta Prioridade, nunca cede ao Better Tasker<br>` +
        `<strong style="color: ${COLOR_YELLOW}">Baixa Prioridade:</strong> Cede à Prioridade Média/Alta e ao Better Tasker quando ativo`
    );
    helpIcon.appendChild(tooltip);
    
    // Show/hide tooltip on hover
    helpIcon.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
    });
    helpIcon.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });
    
    titleContainer.appendChild(helpIcon);
    section.appendChild(titleContainer);
    
    const description = document.createElement('div');
    description.textContent = getLocalizedText(UI_TEXT.DESCRIPTIONS.RAID_MAP_SELECTION_DESC, UI_TEXT.DESCRIPTIONS_PT.RAID_MAP_SELECTION_DESC);
    description.className = 'pixel-font-16';
    description.style.cssText = `
        margin-bottom: 10px;
        font-size: 12px;
        color: ${COLOR_GRAY};
        font-style: italic;
    `;
    section.appendChild(description);
    
    // Create map selection container
    const mapContainer = document.createElement('div');
    mapContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        max-height: 255px;
        overflow-y: auto;
        border: 1px solid ${COLOR_BORDER_DARK};
        border-radius: 3px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.3);
    `;
    
    // Group raids by region for better organization
    const raidGroups = {
        'Rookgaard': [
            'Rat Plague'
        ],
        'Carlin': [
            'Buzzing Madness',
            'Monastery Catacombs',
            'Ghostlands Boneyard'
        ],
        'Folda': [
            'Permafrosted Hole',
            'Jammed Mailbox',
            'Frosted Bunker'
        ],
        'Ab\'Dendriel': [
            'Hedge Maze Trap',
            'Tower of Whitewatch (Shield)',
            'Tower of Whitewatch (Helmet)',
            'Tower of Whitewatch (Armor)',
            'Orcish Barricade'
        ],
        'Kazordoon': [
            'Poacher Cave (Bear)',
            'Poacher Cave (Wolf)'
        ],
        'Venore': [
            'Dwarven Bank Heist',
            'An Arcanist Ritual'
        ]
    };
    
    // Helper: Get region name for a room ID using game state API
    function getRegionNameForRoomId(roomId) {
        try {
            const regions = globalThis.state?.utils?.REGIONS;
            if (!regions || !Array.isArray(regions)) return null;
            
            for (const region of regions) {
                if (region.rooms && Array.isArray(region.rooms)) {
                    const hasRoom = region.rooms.some(room => room.id === roomId);
                    if (hasRoom) {
                        // Map region IDs to friendly names
                        const regionNameMap = {
                            'rook': 'Rookgaard',
                            'carlin': 'Carlin',
                            'folda': 'Folda',
                            'ab': 'Ab\'Dendriel',
                            'kaz': 'Kazordoon',
                            'venore': 'Venore'
                        };
                        return regionNameMap[region.id] || region.id;
                    }
                }
            }
        } catch (error) {
            console.error('[Raid Hunter] Error getting region for room:', error);
        }
        return null;
    }
    
    // Dynamically add active raids to their correct regions using game state API
    try {
        const knownStatic = new Set(Object.values(raidGroups).flat());
        const raidState = globalThis.state?.raids?.getSnapshot?.();
        const list = raidState?.context?.list || [];
        
        for (const raid of list) {
            const raidName = getEventNameForRoomId(raid.roomId);
            if (!raidName || raidName.startsWith('Unknown') || knownStatic.has(raidName)) {
                continue; // Skip already added or invalid raids
            }
            
            // Get the region for this raid
            const regionName = getRegionNameForRoomId(raid.roomId);
            
            if (regionName && raidGroups[regionName]) {
                // Add to the correct region
                if (!raidGroups[regionName].includes(raidName)) {
                    raidGroups[regionName].push(raidName);
                }
            } else {
                // Fallback: Unknown region - add to first region or create "Other" category
                if (!raidGroups['Other']) {
                    raidGroups['Other'] = [];
                }
                if (!raidGroups['Other'].includes(raidName)) {
                    raidGroups['Other'].push(raidName);
                }
            }
        }
    } catch (error) {
        console.error('[Raid Hunter] Error populating dynamic raids:', error);
    }

    // Create checkboxes for each raid group
    Object.entries(raidGroups).forEach(([region, raids]) => {
        // Skip empty regions
        if (raids.length === 0) {
            return;
        }
        
        // Region header
        const regionHeader = document.createElement('div');
        regionHeader.textContent = region;
        regionHeader.className = 'pixel-font-16';
        regionHeader.style.cssText = `
            font-weight: bold;
            color: ${COLOR_ACCENT};
            margin: 10px 0 5px 0;
            font-size: 14px;
            border-bottom: 1px solid #555;
            padding-bottom: 3px;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
        `;
        mapContainer.appendChild(regionHeader);
        
        // Individual raid checkboxes
        raids.forEach(raidName => {
            const raidDiv = document.createElement('div');
            raidDiv.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 2px 0;
            `;
            
            // Load saved checkbox state from settings (works for both static and event raids)
            const settings = loadSettings();
            const enabledMaps = settings.enabledRaidMaps || [];
            const isChecked = enabledMaps.includes(raidName);
            
            const checkbox = createStyledInput('checkbox', `raid-${raidName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`, undefined, `
                width: 16px;
                height: 16px;
                accent-color: ${COLOR_ACCENT};
            `, { checked: isChecked });
            // Add auto-save listener for both static and event raids
            checkbox.addEventListener('change', autoSaveSettings);
            
            const label = document.createElement('label');
            label.textContent = raidName;
            label.className = 'pixel-font-16';
            label.style.cssText = `
                color: ${COLOR_WHITE};
                font-size: 13px;
                cursor: pointer;
                flex: 1;
            `;
            label.setAttribute('for', checkbox.id);

            raidDiv.appendChild(checkbox);
            raidDiv.appendChild(label);
            
            // Add "Event" badge only for raids NOT in the hardcoded EVENT_TEXTS list
            // These are truly dynamic events that are not statically defined
            if (!EVENT_TEXTS.includes(raidName)) {
                const eventBadge = document.createElement('span');
                eventBadge.textContent = getLocalizedText('Event', 'Evento');
                eventBadge.className = 'pixel-font-16';
                eventBadge.style.cssText = `
                    font-size: 10px;
                    padding: 2px 6px;
                    background: rgba(255, 107, 107, 0.2);
                    color: ${COLOR_RED};
                    border: 1px solid ${COLOR_RED};
                    border-radius: 3px;
                    font-weight: bold;
                    margin-right: 6px;
                `;
                raidDiv.appendChild(eventBadge);
            }

            // Priority dropdown for all raids
            const prioritySelect = document.createElement('select');
            prioritySelect.id = `priority-${raidName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
            prioritySelect.className = 'pixel-font-16';
            prioritySelect.setAttribute('data-raid-name', raidName);
            prioritySelect.style.cssText = `
                font-size: 10px;
                padding: 2px 18px 2px 6px;
                border-radius: 3px;
                font-weight: bold;
                cursor: pointer;
                outline: none;
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                min-width: 105px;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23ffffff' d='M1 0l4 4 4-4 1 1-5 5-5-5z'/%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 6px center;
            `;
            const opts = [
                {v:'low', t:getLocalizedText('Low Priority', 'Baixa Prioridade')},
                {v:'medium', t:getLocalizedText('Medium Priority', 'Prioridade Média')},
                {v:'high', t:getLocalizedText('High Priority', 'Alta Prioridade')}
            ];
            opts.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.v;
                opt.textContent = o.t;
                prioritySelect.appendChild(opt);
            });
            // Set initial value from settings (default: medium for static raids, low for events)
            const raidPriorities = settings.raidPriorities || {};
            const defaultPriority = EVENT_TEXTS.includes(raidName) ? 'medium' : 'low';
            prioritySelect.value = raidPriorities[raidName] || defaultPriority;
            try { stylePrioritySelect(prioritySelect); } catch (_) {}
            prioritySelect.addEventListener('change', (e) => {
                stylePrioritySelect(prioritySelect);
                autoSaveSettings();
            });
            raidDiv.appendChild(prioritySelect);
            
            mapContainer.appendChild(raidDiv);
        });
    });
    
    section.appendChild(mapContainer);
    
    // Add select all/none buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        margin-top: 10px;
    `;
    
    const selectAllBtn = createStyledButton('select-all-maps', 'Select All', 'green', () => {
        const checkboxes = mapContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        autoSaveSettings(); // Auto-save after selecting all
    });
    
    const selectNoneBtn = createStyledButton('select-none-maps', 'Select None', 'red', () => {
        const checkboxes = mapContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        autoSaveSettings(); // Auto-save after selecting none
    });
    
    buttonContainer.appendChild(selectAllBtn);
    buttonContainer.appendChild(selectNoneBtn);
    section.appendChild(buttonContainer);
    
    return section;
}

// Refresh availability UI for event raids in the settings modal (refresh priority badge styling)
function applyEventRaidAvailabilityUI() {
    try {
        // Refresh priority badge styling for all priority selects
        document.querySelectorAll('select[id^="priority-"]').forEach(select => {
            try { stylePrioritySelect(select); } catch (_) {}
        });
    } catch (_) {}
}

// Style the priority dropdown to look like a colored badge
function stylePrioritySelect(selectEl) {
    const v = (selectEl.value || 'low').toLowerCase();
    if (v === 'low') {
        selectEl.style.backgroundColor = 'rgba(255, 211, 61, 0.2)';
        selectEl.style.color = `${COLOR_YELLOW}`;
        selectEl.style.border = `1px solid ${COLOR_YELLOW}`;
    } else if (v === 'high') {
        selectEl.style.backgroundColor = 'rgba(255, 107, 107, 0.2)';
        selectEl.style.color = `${COLOR_RED}`;
        selectEl.style.border = `1px solid ${COLOR_RED}`;
    } else { // medium (green)
        selectEl.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
        selectEl.style.color = `${COLOR_GREEN}`;
        selectEl.style.border = `1px solid ${COLOR_GREEN}`;
    }
}

// Default settings with validation
const DEFAULT_SETTINGS = {
    raidDelay: DEFAULT_RAID_START_DELAY,
    autoRefillStamina: false,
    fasterAutoplay: false,
    enableDragonPlant: false,
    setupMethod: getLocalizedText('Auto-setup', 'Autoconfigurar'),  // Default to Auto-setup
    enabledRaidMaps: [],
    raidPriorities: {} // raidName -> 'low' | 'medium' | 'high'
};

// Settings validation functions
function validateRaidDelay(value) {
    const num = parseInt(value);
    return !isNaN(num) && num >= 0 && num <= 60;
}

function validateRaidMaps(maps) {
    if (!Array.isArray(maps)) return false;
    // Allow static raids (in EVENT_TEXTS) OR events that exist in game state API or fallback mapping
    return maps.every(map => {
        // Static raids
        if (EVENT_TEXTS.includes(map)) return true;
        
        // Check game state API for dynamic events (primary method)
        try {
            if (globalThis.state?.utils?.ROOM_NAME) {
                const roomNames = globalThis.state.utils.ROOM_NAME;
                const existsInGameState = Object.values(roomNames).includes(map);
                if (existsInGameState) return true;
            }
        } catch (_) {}
        
        // Fallback to hardcoded mapping (backward compatibility)
        if (EVENT_TO_ROOM_MAPPING.hasOwnProperty(map)) return true;
        
        return false;
    });
}

function validateBoolean(value) {
    return typeof value === 'boolean';
}

function sanitizeSettings(settings) {
    const sanitized = {};
    
    // Validate and sanitize raid delay
    if (validateRaidDelay(settings.raidDelay)) {
        sanitized.raidDelay = parseInt(settings.raidDelay);
    } else {
        sanitized.raidDelay = DEFAULT_RAID_START_DELAY;
        console.warn('[Raid Hunter] Invalid raid delay, using default:', DEFAULT_RAID_START_DELAY);
    }
    
    // Validate and sanitize boolean settings
    sanitized.autoRefillStamina = validateBoolean(settings.autoRefillStamina) ? settings.autoRefillStamina : false;
    sanitized.fasterAutoplay = validateBoolean(settings.fasterAutoplay) ? settings.fasterAutoplay : false;
    sanitized.enableDragonPlant = validateBoolean(settings.enableDragonPlant) ? settings.enableDragonPlant : false;
    
    // Validate and sanitize raid maps
    if (validateRaidMaps(settings.enabledRaidMaps)) {
        sanitized.enabledRaidMaps = settings.enabledRaidMaps;
    } else {
        sanitized.enabledRaidMaps = [];
        console.warn('[Raid Hunter] Invalid raid maps, using default: []');
    }
    
    // Preserve setup method setting
    if (settings.setupMethod) {
        sanitized.setupMethod = settings.setupMethod;
    }
    
    // Validate raid priorities
    if (settings.raidPriorities && typeof settings.raidPriorities === 'object') {
        const allowed = ['low','medium','high'];
        sanitized.raidPriorities = {};
        Object.entries(settings.raidPriorities).forEach(([raidName, priority]) => {
            const p = (priority || 'low').toLowerCase();
            sanitized.raidPriorities[raidName] = allowed.includes(p) ? p : 'low';
        });
    } else {
        sanitized.raidPriorities = {};
    }
    
    return sanitized;
}

// Load settings function with validation
function loadSettings() {
    const saved = localStorage.getItem('raidHunterSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            const sanitized = sanitizeSettings(parsed);
            return { ...DEFAULT_SETTINGS, ...sanitized };
        } catch (error) {
            console.error('[Raid Hunter] Error parsing settings:', error);
            console.log('[Raid Hunter] Using default settings due to parse error');
            return DEFAULT_SETTINGS;
        }
    }
    return DEFAULT_SETTINGS;
}

// Auto-save settings when changed with validation
function autoSaveSettings() {
    try {
        const settings = {};
        const inputs = document.querySelectorAll('input, select');
        
        inputs.forEach(input => {
            // Only process inputs that belong to Raid Hunter settings
            if (input.id === 'raidDelay' || input.id === 'autoRefillStamina' || input.id === 'fasterAutoplay' || input.id === 'enableDragonPlant' || input.id === 'setupMethod' || input.id.startsWith('raid-') || input.id.startsWith('priority-')) {
                if (input.type === 'checkbox') {
                    // Skip individual raid checkboxes since we process them separately
                    if (!input.id.startsWith('raid-')) {
                        settings[input.id] = input.checked;
                    }
                } else if (input.type === 'number') {
                    const value = parseInt(input.value);
                    if (input.id === 'raidDelay' && !validateRaidDelay(value)) {
                        console.warn('[Raid Hunter] Invalid raid delay value:', value);
                        input.value = DEFAULT_RAID_START_DELAY;
                        settings[input.id] = DEFAULT_RAID_START_DELAY;
                    } else {
                        settings[input.id] = value || 0;
                    }
                } else {
                    settings[input.id] = input.value;
                }
            }
        });
        
        // Process raid map selections (static raids + event raids)
        // Load current settings first to preserve event raid states that aren't currently visible
        const currentSettings = loadSettings();
        const previouslySavedMaps = currentSettings.enabledRaidMaps || [];
        const enabledRaidMaps = [];
        
        // Collect all currently visible raid checkboxes (checked and unchecked)
        const checkedRaids = new Set();
        const visibleEventRaids = new Set(); // Track which event raids are currently visible
        
        document.querySelectorAll('input[type="checkbox"][id^="raid-"]').forEach(checkbox => {
            // Get the actual raid name from the label text (more reliable than parsing ID)
            const label = checkbox.nextElementSibling;
            const raidName = label?.textContent?.trim();
            if (!raidName) return;
            
            // Track all visible event raids (checked or unchecked)
            if (!EVENT_TEXTS.includes(raidName)) {
                visibleEventRaids.add(raidName);
            }
            
            // Track checked raids
            if (checkbox.checked) {
                checkedRaids.add(raidName);
            }
        });
        
        // Save static raids based on current checkbox state
        EVENT_TEXTS.forEach(eventText => {
            if (checkedRaids.has(eventText)) {
                enabledRaidMaps.push(eventText);
            }
        });
        
        // Save currently visible event raids based on their checkbox state
        checkedRaids.forEach(raidName => {
            if (!EVENT_TEXTS.includes(raidName) && !enabledRaidMaps.includes(raidName)) {
                enabledRaidMaps.push(raidName);
            }
        });
        
        // Preserve event raid states that aren't currently visible
        // If an event raid was previously saved (checked) but isn't visible now, keep it checked
        previouslySavedMaps.forEach(savedRaidName => {
            if (!EVENT_TEXTS.includes(savedRaidName) && !visibleEventRaids.has(savedRaidName)) {
                // This is an event raid that was previously saved but not currently visible
                // Preserve its checked state
                if (!enabledRaidMaps.includes(savedRaidName)) {
                    enabledRaidMaps.push(savedRaidName);
                }
            }
        });
        
        settings.enabledRaidMaps = enabledRaidMaps;
        
        // Collect all priority dropdown values
        const raidPriorities = {};
        document.querySelectorAll('select[id^="priority-"]').forEach(select => {
            const raidName = select.getAttribute('data-raid-name');
            if (raidName && select.value) {
                raidPriorities[raidName] = select.value;
            }
        });
        
        // Preserve priorities for raids that aren't currently visible
        const currentPriorities = (currentSettings.raidPriorities || {});
        Object.keys(currentPriorities).forEach(raidName => {
            if (!raidPriorities[raidName]) {
                // Check if this raid still exists in enabled maps (may be event raid that's not visible)
                if (enabledRaidMaps.includes(raidName)) {
                    raidPriorities[raidName] = currentPriorities[raidName];
                }
            }
        });
        
        settings.raidPriorities = raidPriorities;
        
        // Validate and sanitize settings before saving
        const sanitizedSettings = sanitizeSettings(settings);
        
        // Save to localStorage
        localStorage.setItem('raidHunterSettings', JSON.stringify(sanitizedSettings));
        console.log('[Raid Hunter] Settings saved');
        
        // Show validation feedback if needed
        if (sanitizedSettings.raidDelay !== settings.raidDelay) {
            showValidationMessage('Raid delay must be between 0-60 seconds', 'warning');
        }
        
    } catch (error) {
        console.error('[Raid Hunter] Error auto-saving settings:', error);
        showValidationMessage('Failed to save settings. Please try again.', 'error');
    }
}

// Load and apply settings to the modal
function loadAndApplySettings() {
    try {
        const settings = loadSettings();
        
        
        // Apply raid delay with validation
        const raidDelayInput = document.getElementById('raidDelay');
        if (raidDelayInput) {
            raidDelayInput.value = settings.raidDelay;
            // Add auto-save listener with validation
            raidDelayInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (!validateRaidDelay(value)) {
                    e.target.style.borderColor = COLOR_RED;
                    showValidationMessage('Raid delay must be between 0-60 seconds', 'warning');
                } else {
                    e.target.style.borderColor = '';
                }
                autoSaveSettings();
            });
        }
        
        if (settings.autoRefillStamina !== undefined) {
            const checkbox = document.getElementById('autoRefillStamina');
            if (checkbox) {
                checkbox.checked = settings.autoRefillStamina;
                // Add auto-save listener
                checkbox.addEventListener('change', autoSaveSettings);
            }
        }
        
        if (settings.fasterAutoplay !== undefined) {
            const checkbox = document.getElementById('fasterAutoplay');
            if (checkbox) {
                checkbox.checked = settings.fasterAutoplay;
                // Add auto-save listener
                checkbox.addEventListener('change', autoSaveSettings);
            }
        }
        
        // Load Dragon Plant setting from Raid Hunter settings
        if (settings.enableDragonPlant !== undefined) {
            const checkbox = document.getElementById('enableDragonPlant');
            if (checkbox) {
                checkbox.checked = settings.enableDragonPlant;
                // Add auto-save listener
                checkbox.addEventListener('change', autoSaveSettings);
            }
        }
        
        // Apply setup method setting
        if (settings.setupMethod !== undefined) {
            const setupMethodSelect = document.getElementById('setupMethod');
            if (setupMethodSelect) {
                setupMethodSelect.value = settings.setupMethod;
                // Note: auto-save listener is already added in createDropdownSetting function
            }
        }
        
        // Apply raid map selections with validation (static raids + event raids)
        if (settings.enabledRaidMaps && Array.isArray(settings.enabledRaidMaps)) {
            settings.enabledRaidMaps.forEach(raidName => {
                // Restore both static raids and event raids
                const checkboxId = `raid-${raidName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }
        
        // Apply priority dropdown values for all raids
        if (settings.raidPriorities && typeof settings.raidPriorities === 'object') {
            document.querySelectorAll('select[id^="priority-"]').forEach(select => {
                const raidName = select.getAttribute('data-raid-name');
                if (raidName && settings.raidPriorities[raidName]) {
                    select.value = settings.raidPriorities[raidName];
                    try { stylePrioritySelect(select); } catch (_) {}
                }
            });
        }

        // Add auto-save listeners to all raid map checkboxes
        EVENT_TEXTS.forEach(eventText => {
            const checkboxId = `raid-${eventText.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                checkbox.addEventListener('change', autoSaveSettings);
            }
        });
        
        console.log('[Raid Hunter] Settings loaded');
        // After loading settings, refresh event raid availability UI if modal is open
        try { applyEventRaidAvailabilityUI(); } catch (_) {}
    } catch (error) {
        console.error('[Raid Hunter] Error loading and applying settings:', error);
        showValidationMessage('Failed to load settings. Using defaults.', 'error');
    }
}

// Show validation message to user
function showValidationMessage(message, type = 'info') {
    try {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 4px;
            color: white;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        
        // Set color based on type
        switch (type) {
            case 'error':
                notification.style.backgroundColor = COLOR_RED;
                break;
            case 'warning':
                notification.style.backgroundColor = COLOR_YELLOW;
                notification.style.color = COLOR_DARK_GRAY;
                break;
            case 'success':
                notification.style.backgroundColor = COLOR_GREEN;
                break;
            default:
                notification.style.backgroundColor = COLOR_ACCENT;
                notification.style.color = COLOR_DARK_GRAY;
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
        
    } catch (error) {
        console.error('[Raid Hunter] Error showing validation message:', error);
        // Fallback to console
        console.log(`[Raid Hunter] ${type.toUpperCase()}: ${message}`);
    }
}

// ============================================================================
// 10. INITIALIZATION
// ============================================================================

function init() {
    
    // Load automation state from localStorage first
    loadAutomationState();
    
    // Set up fight toast monitoring immediately (independent of automation state)
    setupFightToastMonitoring();
    
    setupRaidMonitoring();
    
    // Set up Board Analyzer coordination
    setupBoardAnalyzerCoordination();
    
    // Start monitoring for quest log (like Better Yasir)
    // Don't try to create immediately - wait for quest log to appear
    startQuestLogMonitoring();
    
    // Set up page visibility monitoring for foreground/background transitions
    setupPageVisibilityMonitoring();

    console.log('[Raid Hunter] Raid Hunter Mod initialized - waiting for allModsLoaded signal before checking raids');
}

// Start raid automation only after all mods are loaded
function startRaidAutomation() {
    console.log('[Raid Hunter] Starting raid automation after allModsLoaded signal');
    
    // Check for existing raids (only if automation is enabled)
    if (isAutomationActive()) {
        checkForExistingRaids();
        setTimeout(checkForExistingRaids, MODAL_OPEN_DELAY);
    }
}

// Listen for allModsLoaded signal and start automation
// Store handler reference for cleanup (prevents memory leaks per mod development guide)
windowMessageHandler = (event) => {
    if (event.source !== window) return;
    if (event.data?.from === 'LOCAL_MODS_LOADER' && event.data?.action === 'allModsLoaded') {
        console.log('[Raid Hunter] Received allModsLoaded signal');
        allModsLoaded = true;
        
        // Delay to ensure Better Tasker has fully set up its state
        setTimeout(() => {
            startRaidAutomation();
        }, 1500);
    }
};
window.addEventListener('message', windowMessageHandler);

// Run initialization immediately when file loads
init();

// ============================================================================
// 11. QUEST BUTTON MODIFICATION FUNCTIONS
// ============================================================================

// Store original quest button state
let originalQuestButtonState = null;
let questButtonValidationInterval = null;
let boardStateUnsubscribe = null;

// Function to get current room ID
function getCurrentRoomId() {
    try {
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (boardContext && boardContext.selectedMap && boardContext.selectedMap.selectedRoom) {
            return boardContext.selectedMap.selectedRoom.id;
        }
        return null;
    } catch (error) {
        console.error('[Raid Hunter] Error getting current room ID:', error);
        return null;
    }
}

// Function to find quest button with multiple fallback selectors
function findQuestButton() {
    // Try image-based selectors first
    const imageSelectors = [
        'button img[src*="quest.png"]',
        'button img[src*="enemy.png"]', // For raiding state
        'button img[alt="Quests"]'
    ];
    
    for (const selector of imageSelectors) {
        const button = document.querySelector(selector)?.closest('button');
        if (button) return button;
    }
    
    // Try text-based selectors
    const textMatches = ['Raiding', 'Quest Log', 'Quests'];
    const buttons = document.querySelectorAll('button');
    
    for (const button of buttons) {
        const span = button.querySelector('span');
        if (span && textMatches.includes(span.textContent)) {
            return button;
        }
    }
    
    return null;
}

// Function to check if user is on the correct raid map
function isOnCorrectRaidMap() {
    if (!isCurrentlyRaiding || !currentRaidInfo) {
        return false;
    }
    
    const currentRoomId = getCurrentRoomId();
    if (!currentRoomId) {
        console.log('[Raid Hunter] Could not determine current room ID');
        return false;
    }
    
    const isCorrectMap = currentRoomId === currentRaidInfo.roomId;
    console.log(`[Raid Hunter] Map validation: current=${currentRoomId}, expected=${currentRaidInfo.roomId}, correct=${isCorrectMap}`);
    return isCorrectMap;
}

// Function to modify quest button appearance when raiding is active
function modifyQuestButtonForRaiding() {
        // Check if we're currently raiding - if so, modify quest button regardless of map
        // The user might be navigating to the raid map, so we should show "Raiding" status
        if (!isCurrentlyRaiding) {
            console.log('[Raid Hunter] Quest button unchanged');
            return false;
        }
        
    // Request control (don't use withControl - we need to keep control during the raid)
    if (!window.QuestButtonManager.requestControl('Raid Hunter')) {
        console.log('[Raid Hunter] Cannot modify quest button - controlled by another mod');
        return false;
    }
    
    try {
        // Find the quest button in the header navigation
        const questButton = findQuestButton();
        
        if (!questButton) {
            console.log('[Raid Hunter] Quest button not found for modification');
            return false;
        }
        
        // Store original state if not already stored AND quest button is in original state
        if (!window.QuestButtonManager.originalState) {
            const img = questButton.querySelector('img');
            const span = questButton.querySelector('span');
            
            // Only store original state if quest button appears to be in original state
            // Check if it's not already modified by another mod
            const isInOriginalState = img && img.src.includes('quest.png') && span && span.textContent === 'Quests';
            
            if (isInOriginalState) {
                window.QuestButtonManager.originalState = {
                    imgSrc: img ? img.src : null,
                    imgAlt: img ? img.alt : null,
                    imgWidth: img ? img.width : null,
                    imgHeight: img ? img.height : null,
                    imgStyle: img ? img.style.cssText : null,
                    imgClassList: img ? img.className : null,
                    spanText: span ? span.textContent : null,
                    buttonColor: questButton.style.color || ''
                };
                console.log('[Raid Hunter] Quest button state stored');
            } else {
                console.log('[Raid Hunter] Quest button not in original state - not storing originalState');
            }
        }
        
        // Modify the button appearance - replace icon and change text
        const img = questButton.querySelector('img');
        const span = questButton.querySelector('span');
        
        // Replace the icon with enemy icon
        if (img) {
            img.src = 'https://bestiaryarena.com/assets/icons/enemy.png';
            img.alt = 'Enemy';
            img.style.display = ''; // Make sure it's visible
        }
        
        // Change text to "Raiding"
        if (span) {
            span.textContent = 'Raiding';
            // Add shimmer effect to the text
            span.style.background = `linear-gradient(45deg, ${COLOR_GREEN}, ${COLOR_DARK_GREEN}, ${COLOR_GREEN}, ${COLOR_DARK_GREEN})`;
            span.style.backgroundSize = '400% 400%';
            span.style.backgroundClip = 'text';
            span.style.webkitBackgroundClip = 'text';
            span.style.webkitTextFillColor = 'transparent';
            span.style.animation = 'raidShimmer 2s ease-in-out infinite';
        }
        
        // Add CSS keyframes for shimmer animation if not already added
        if (!document.getElementById('raidShimmerCSS')) {
            const style = document.createElement('style');
            style.id = 'raidShimmerCSS';
            style.textContent = `
                @keyframes raidShimmer {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Set green color for the button
        questButton.style.color = COLOR_GREEN; // Green color
        
        console.log('[Raid Hunter] Quest button modified for raiding state (keeping control)');
        return true;
    } catch (error) {
        console.error('[Raid Hunter] Error modifying quest button:', error);
        // Release control on error
        window.QuestButtonManager.releaseControl('Raid Hunter');
        return false;
    }
    // NOTE: Do NOT release control here - we keep it during the raid
}

// Function to restore quest button to original appearance
function restoreQuestButtonAppearance() {
    return withControlCheck(window.QuestButtonManager, 'Raid Hunter', () => {
        
        // Find the quest button - try multiple selectors to find it regardless of current state
        const questButton = findQuestButton();
        
        if (!questButton) {
            console.log('[Raid Hunter] Quest button not found for restoration');
            return false;
        }
        
        if (!window.QuestButtonManager.originalState) {
            console.log('[Raid Hunter] Quest button state not found');
            return false;
        }
        
        // Restore original appearance
        const img = questButton.querySelector('img');
        const span = questButton.querySelector('span');
        
        // Show the icon again
        if (img) {
            img.style.display = '';
            // Restore original source and properties
            if (window.QuestButtonManager.originalState.imgSrc) {
                img.src = window.QuestButtonManager.originalState.imgSrc;
                img.alt = window.QuestButtonManager.originalState.imgAlt;
            }
            // Restore original dimensions
            if (window.QuestButtonManager.originalState.imgWidth) {
                img.width = window.QuestButtonManager.originalState.imgWidth;
            }
            if (window.QuestButtonManager.originalState.imgHeight) {
                img.height = window.QuestButtonManager.originalState.imgHeight;
            }
            // Restore original CSS styles
            if (window.QuestButtonManager.originalState.imgStyle) {
                img.style.cssText = window.QuestButtonManager.originalState.imgStyle;
            }
            // Restore original class list
            if (window.QuestButtonManager.originalState.imgClassList) {
                img.className = window.QuestButtonManager.originalState.imgClassList;
            }
        }
        
        // Restore original text and clear shimmer effect
        if (span) {
            if (window.QuestButtonManager.originalState.spanText) {
                span.textContent = window.QuestButtonManager.originalState.spanText;
            }
            // Clear shimmer effect
            span.style.background = '';
            span.style.backgroundSize = '';
            span.style.backgroundClip = '';
            span.style.webkitBackgroundClip = '';
            span.style.webkitTextFillColor = '';
            span.style.animation = '';
        }
        
        // Restore original color
        questButton.style.color = window.QuestButtonManager.originalState.buttonColor;
        
        console.log('[Raid Hunter] Quest button appearance restored');
        return true;
    }, 'restore quest button appearance');
}

// Function to start monitoring autoplay state changes
function startAutoplayStateMonitoring() {
    // Clear any existing subscription
    if (boardStateUnsubscribe && typeof boardStateUnsubscribe === 'function') {
        boardStateUnsubscribe();
        boardStateUnsubscribe = null;
    }
    
    // Only start monitoring if we're currently raiding
    if (!isCurrentlyRaiding) {
        return;
    }
    
    console.log('[Raid Hunter] Autoplay state monitoring started');
    
    try {
        boardStateUnsubscribe = globalThis.state.board.subscribe((state) => {
            try {
                const isAutoplay = state.context.mode === 'autoplay';
                
                // Only act if we're currently raiding
                if (!isCurrentlyRaiding) {
                    return;
                }
                
                if (isAutoplay && isOnCorrectRaidMap()) {
                    // Autoplay resumed on correct map - ensure quest button shows raiding
                    if (window.QuestButtonManager.hasControl('Raid Hunter')) {
                        modifyQuestButtonForRaiding();
                    }
                } else if (!isAutoplay) {
                    // Autoplay paused - check if raid ended
                    console.log('[Raid Hunter] Autoplay stopped - checking if raid ended');
                    
                    // Update raid state to check if current raid still exists
                    updateRaidState();
                    
                    // Check if current raid still exists in the list
                    const raidState = globalThis.state?.raids?.getSnapshot?.();
                    const currentRaidList = raidState?.context?.list || [];
                    const currentRaidStillExists = currentRaidInfo && 
                        currentRaidList.some(raid => raid.roomId === currentRaidInfo.roomId);
                    
                    if (!currentRaidStillExists && isCurrentlyRaiding) {
                        // Raid ended - check for more raids in queue
                        console.log('[Raid Hunter] Raid ended (no longer in list) - checking queue for next raid');
                        stopAutoplayOnRaidEnd(); // This now checks queue and navigates if available
                        return;
                    }
                    
                    // Autoplay paused but raid still active - restore quest button
                    console.log('[Raid Hunter] Autoplay paused - restoring quest button');
                    
                    // Force take control to restore quest button (we need to restore it regardless of current owner)
                    if (window.QuestButtonManager.requestControl('Raid Hunter')) {
                        restoreQuestButtonAppearance();
                        window.QuestButtonManager.releaseControl('Raid Hunter');
                    } else {
                        console.log('[Raid Hunter] Could not get quest button control to restore - another mod may be using it');
                    }
                } else if (isAutoplay && !isOnCorrectRaidMap()) {
                    // Autoplay on wrong map - restore quest button
                    console.log('[Raid Hunter] Autoplay on wrong map - restoring quest button');
                    isCurrentlyRaiding = false;
                    currentRaidInfo = null;
                    
                    // Force take control to restore quest button (we need to restore it regardless of current owner)
                    if (window.QuestButtonManager.requestControl('Raid Hunter')) {
                        restoreQuestButtonAppearance();
                        window.QuestButtonManager.releaseControl('Raid Hunter');
                    } else {
                        console.log('[Raid Hunter] Could not get quest button control to restore - another mod may be using it');
                    }
                    
                    stopAutoplayStateMonitoring();
                }
            } catch (error) {
                console.error('[Raid Hunter] Error in autoplay state monitoring:', error);
            }
        });
    } catch (error) {
        console.error('[Raid Hunter] Error setting up autoplay state monitoring:', error);
        // Fallback to old polling method if subscription fails
        startQuestButtonValidation();
    }
}

// Function to start monitoring quest button validation (fallback method)
function startQuestButtonValidation() {
    // Clear any existing interval
    if (questButtonValidationInterval) {
        clearInterval(questButtonValidationInterval);
        questButtonValidationInterval = null;
    }
    
    // Only start monitoring if we're currently raiding
    if (!isCurrentlyRaiding) {
        return;
    }
    
    console.log('[Raid Hunter] Quest button monitoring started (fallback method)');
    
    questButtonValidationInterval = setInterval(() => {
        try {
            // Check if we're still raiding
            if (!isCurrentlyRaiding) {
                console.log('[Raid Hunter] No longer raiding - stopping quest button validation');
                stopQuestButtonValidation();
                return;
            }
            
            // Check if we're on the correct raid map first
            if (!isOnCorrectRaidMap()) {
                console.log('[Raid Hunter] User switched to different map - quest button restored');
                isCurrentlyRaiding = false;
                currentRaidInfo = null;
                restoreQuestButtonAppearance();
                stopQuestButtonValidation();
                return;
            }
            
            // Check if we're still in autoplay mode (indicates raid is still active)
            const boardContext = globalThis.state.board.getSnapshot().context;
            if (boardContext.mode !== 'autoplay') {
                console.log('[Raid Hunter] No longer in autoplay mode - checking if raid ended');
                
                // Update raid state to check if current raid still exists
                updateRaidState();
                
                // Check if current raid still exists in the list
                const raidState = globalThis.state?.raids?.getSnapshot?.();
                const currentRaidList = raidState?.context?.list || [];
                const currentRaidStillExists = currentRaidInfo && 
                    currentRaidList.some(raid => raid.roomId === currentRaidInfo.roomId);
                
                if (!currentRaidStillExists && isCurrentlyRaiding) {
                    // Raid ended - check for more raids in queue
                    console.log('[Raid Hunter] Raid ended (no longer in list) - checking queue for next raid');
                    isCurrentlyRaiding = false;
                    stopQuestButtonValidation();
                    stopAutoplayOnRaidEnd(); // This now checks queue and navigates if available
                    return;
                }
                
                // Autoplay paused but raid still active - restore quest button
                console.log('[Raid Hunter] Autoplay paused - quest button restored');
                isCurrentlyRaiding = false;
                currentRaidInfo = null;
                restoreQuestButtonAppearance();
                stopQuestButtonValidation();
                return;
            }
            
            // Check if the raid is still in the raid list
            const raidState = globalThis.state?.raids?.getSnapshot?.();
            const hasActiveRaids = raidState?.context?.list?.length > 0;
            if (!hasActiveRaids) {
                console.log('[Raid Hunter] Quest button restored');
                isCurrentlyRaiding = false;
                currentRaidInfo = null;
                restoreQuestButtonAppearance();
                stopQuestButtonValidation();
                return;
            }
            
            // If we get here, we're still raiding - ensure quest button shows raiding state
            if (window.QuestButtonManager.hasControl('Raid Hunter')) {
                    const questButton = findQuestButton();
                    
                    if (questButton) {
                        // Check if quest button is already in raiding state
                        const img = questButton.querySelector('img');
                        const span = questButton.querySelector('span');
                        const isInRaidingState = img && img.src.includes('enemy.png') && span && span.textContent === 'Raiding';
                        
                        if (!isInRaidingState) {
                            // Quest button is not in raiding state, try to modify it
                            modifyQuestButtonForRaiding();
                        }
                    } else {
                        // Quest button not found, try to modify it
                        modifyQuestButtonForRaiding();
                    }
                } else {
                    // We don't have control - check if we have active raids
                    const raidState = globalThis.state?.raids?.getSnapshot?.();
                    const hasActiveRaids = raidState?.context?.list?.length > 0;
                    
                    if (hasActiveRaids) {
                        // We have active raids - take control regardless of current owner
                        console.log('[Raid Hunter] Active raids detected - taking quest button control from', window.QuestButtonManager.getCurrentOwner() || 'unknown');
                        modifyQuestButtonForRaiding();
                    } else {
                        // No active raids - release control and restore quest button if we still have it
                        const currentOwner = window.QuestButtonManager.getCurrentOwner();
                        if (currentOwner === 'Raid Hunter') {
                            console.log('[Raid Hunter] No active raids - releasing quest button control');
                            restoreQuestButtonAppearance();
                        } else if (currentOwner === 'Better Tasker') {
                            // Better Tasker has control, don't interfere
                            console.log('[Raid Hunter] Better Tasker has quest button control - not interfering');
                        }
                    }
                }
        } catch (error) {
            console.error('[Raid Hunter] Error in quest button validation:', error);
        }
    }, QUEST_BUTTON_VALIDATION_INTERVAL);
}

// Function to stop monitoring autoplay state changes
function stopAutoplayStateMonitoring() {
    if (boardStateUnsubscribe && typeof boardStateUnsubscribe === 'function') {
        boardStateUnsubscribe();
        boardStateUnsubscribe = null;
        console.log('[Raid Hunter] Autoplay state monitoring stopped');
    }
}

// Function to stop monitoring quest button validation
function stopQuestButtonValidation() {
    if (questButtonValidationInterval) {
        clearInterval(questButtonValidationInterval);
        questButtonValidationInterval = null;
        console.log('[Raid Hunter] Quest button validation monitoring stopped');
    }
}

// ============================================================================
// 12. CLEANUP & EXPORTS
// ============================================================================

// Cleanup function for when mod is disabled
// Follows mod development guide best practices: "Clean up event listeners and intervals when they're no longer needed"
function cleanupRaidHunter() {
    try {
        // 1. Clean up all intervals, observers, and timeouts (centralized cleanup)
        cleanupAll();
        
        // 2. Stop quest button validation monitoring
        stopQuestButtonValidation();
        
        // 3. Stop autoplay state monitoring
        stopAutoplayStateMonitoring();
        
        // 4. Clean up modal if open
        if (activeRaidHunterModal) {
            cleanupRaidHunterModal();
        }
        
        // 5. Clean up modal cleanup observer (defensive check - in case modal was already closed)
        if (modalCleanupObserver) {
            modalCleanupObserver.disconnect();
            modalCleanupObserver = null;
        }
        
        // 6. Clean up raid clock (calls cleanupAll internally, but we already did it above)
        stopRaidClock();
        
        // 7. Clean up stamina tooltip monitoring
        stopStaminaTooltipMonitoring();
        
        // 8. Clean up CSS styles
        const raidShimmerCSS = document.getElementById('raidShimmerCSS');
        if (raidShimmerCSS) {
            raidShimmerCSS.remove();
        }
        
        // 9. Clean up event listeners from raid clock buttons
        const settingsButton = document.querySelector('#raid-hunter-settings-btn');
        const toggleButton = document.querySelector('#raid-hunter-toggle-btn');
        if (settingsButton) {
            settingsButton.replaceWith(settingsButton.cloneNode(true)); // Remove all event listeners
        }
        if (toggleButton) {
            toggleButton.replaceWith(toggleButton.cloneNode(true)); // Remove all event listeners
        }
        
        // 10. Clean up page visibility monitoring
        if (pageVisibilityHandler) {
            document.removeEventListener('visibilitychange', pageVisibilityHandler);
            pageVisibilityHandler = null;
        }
        
        // 11. Clean up window message listener (prevent memory leaks)
        if (windowMessageHandler) {
            window.removeEventListener('message', windowMessageHandler);
            windowMessageHandler = null;
        }
        
        // Note: Control release is handled automatically by withControl functions
        
        // 12. Reset all state using centralized function
        resetState('full');
        
        console.log('[Raid Hunter] Mod cleanup completed');
    } catch (error) {
        console.error('[Raid Hunter] Error during mod cleanup:', error);
    }
}

// Export functionality for mod loader (following mod development guide)
context.exports = {
    cleanup: cleanupRaidHunter,
    isCurrentlyRaiding: () => isCurrentlyRaiding,
    updateConfig: (newConfig) => {
        // Handle config updates if needed
        console.log('[Raid Hunter] Config update received:', newConfig);
    }
};

// Expose Raid Hunter state globally for Better Tasker coordination
window.raidHunterIsCurrentlyRaiding = () => isCurrentlyRaiding;

// Expose function to check if Raid Hunter is raiding a HIGH priority raid
// Better Tasker should yield ONLY for HIGH priority raids
// MEDIUM priority raids do NOT cause Better Tasker to yield, but also don't yield to Better Tasker
// LOW priority raids yield to Better Tasker when it's active
window.raidHunterIsRaidingHighPriority = () => {
    if (!isCurrentlyRaiding || !currentRaidInfo) {
        return false;
    }
    // Only HIGH priority raids cause Better Tasker to yield
    // MEDIUM and LOW priority raids do not trigger Better Tasker to yield
    return currentRaidInfo.priority === RAID_PRIORITY.HIGH;
};

// Expose function to check if Raid Hunter is raiding a MEDIUM priority raid
// Better Tasker should NOT overtake MEDIUM priority raids - they coexist (neither yields)
window.raidHunterIsRaidingMediumPriority = () => {
    if (!isCurrentlyRaiding || !currentRaidInfo) {
        return false;
    }
    // MEDIUM priority raids should coexist with Better Tasker - neither yields to the other per tooltip
    return currentRaidInfo.priority === RAID_PRIORITY.MEDIUM;
};

// Expose function to check if Raid Hunter has any enabled HIGH priority raids available
// This helps Better Tasker avoid waiting unnecessarily for disabled raids
window.raidHunterHasEnabledHighPriorityRaid = () => {
    try {
        const settings = loadSettings();
        const enabledMaps = settings.enabledRaidMaps || [];
        
        if (enabledMaps.length === 0) {
            return false; // No raids enabled at all
        }
        
        const raidState = globalThis.state?.raids?.getSnapshot?.();
        if (!raidState) {
            return false;
        }
        
        const currentRaidList = raidState.context?.list || [];
        
        // Check if any of the available raids are enabled HIGH priority raids
        for (const raid of currentRaidList) {
            const raidName = getEventNameForRoomId(raid.roomId);
            if (enabledMaps.includes(raidName)) {
                const priority = getRaidPriority(raidName);
                if (priority === RAID_PRIORITY.HIGH) {
                    return true; // Found an enabled HIGH priority raid
                }
            }
        }
        
        return false; // No enabled HIGH priority raids found
    } catch (error) {
        console.error('[Raid Hunter] Error checking enabled HIGH priority raids:', error);
        return false;
    }
};