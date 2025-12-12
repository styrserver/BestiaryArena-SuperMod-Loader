// Stamina Optimizer Mod for Bestiary Arena

// Prevent multiple executions of the entire mod
if (window.__staminaOptimizerLoaded) {
    console.log('[Stamina Optimizer] Mod already loaded, skipping execution');
    if (typeof exports !== 'undefined') {
        exports = {
            name: 'Stamina Optimizer',
            description: 'Automatically manages stamina levels by starting/stopping gameplay',
            version: '1.0',
            enabled: true
        };
    }
    (function() { return; })();
}

window.__staminaOptimizerLoaded = true;
console.log('[Stamina Optimizer] Initializing...');

// Register with mod coordination system
// Priority 110: Higher than Raid Hunter (100) so it can stop mods when stamina is low
// but lower than Manual Runner (150) and Board Analyzer (200) which are system-level tools
if (window.ModCoordination) {
    // Check if there's a saved priority override that's the old default (5)
    // If so, remove it so the new default (110) is used
    try {
        const savedPriorities = localStorage.getItem('mod-coordination-priorities');
        if (savedPriorities) {
            const parsed = JSON.parse(savedPriorities);
            if (parsed['Stamina Optimizer'] === 5) {
                // Remove the old default override so new default (110) is used
                delete parsed['Stamina Optimizer'];
                localStorage.setItem('mod-coordination-priorities', JSON.stringify(parsed));
                console.log('[Stamina Optimizer] Removed old priority override (5), will use new default (110)');
            }
        }
    } catch (error) {
        console.warn('[Stamina Optimizer] Error checking saved priorities:', error);
    }
    
    // Register or update registration
    const existingMod = window.ModCoordination.getModState('Stamina Optimizer');
    if (existingMod) {
        // Mod already registered - update priority if different from new default
        if (existingMod.priority !== 110) {
            window.ModCoordination.updateModPriority('Stamina Optimizer', 110);
            console.log('[Stamina Optimizer] Updated priority from', existingMod.priority, 'to 110');
        }
    } else {
        // First time registration - use new default priority 110
        window.ModCoordination.registerMod('Stamina Optimizer', {
            priority: 110,
            metadata: { description: 'Automated stamina management system' }
        });
    }
    window.ModCoordination.updateModState('Stamina Optimizer', { enabled: true });
}

// ============================================================================
// 1. CONSTANTS
// ============================================================================

const MOD_ID = 'stamina-optimizer';
const BUTTON_ID = `${MOD_ID}-button`;
const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;

const DEFAULT_MAX_STAMINA = 350;
const DEFAULT_MIN_STAMINA = 100;
const DEFAULT_ACTIONS = ['boosted-maps'];

const AUTOMATION_ENABLED = true;
const AUTOMATION_DISABLED = false;

// Translation helper using shared API
const t = (key) => {
    if (typeof api !== 'undefined' && api.i18n && api.i18n.t) {
        return api.i18n.t(key);
    }
    return key;
};

const STAMINA_CHECK_INTERVAL = 5000;
const BESTIARY_REFILL_COOLDOWN = 10000;
const STATE_FLAG_CLEAR_DELAY = 500;
const AUTOPLAY_STOP_CHECK_DELAY = 3000;
const BOOSTED_MAPS_TRIGGER_WINDOW = 5000;
const PAUSE_BUTTON_CLICK_DELAY = 100;
const PAUSE_BUTTON_UPDATE_DELAY = 300;
const MODS_LOADING_GRACE_PERIOD = 10000; // 10 seconds after allModsLoaded before allowing actions
const MAX_WAIT_FOR_SIGNAL = 15000; // Maximum time to wait for allModsLoaded signal (15 seconds)

const COLOR_ACCENT = '#ffe066';
const COLOR_WHITE = '#fff';
const COLOR_GRAY = '#888';
const COLOR_RED = '#ff6b6b';
const COLOR_YELLOW = '#ffd93d';
const COLOR_GREEN = '#22c55e';
const COLOR_DARK_GREEN = '#16a34a';
const COLOR_DARK_GRAY = '#333';
const COLOR_BORDER = '#444';
const COLOR_SUCCESS = '#4ade80';

// ============================================================================
// 2. STATE MANAGEMENT
// ============================================================================

// Use global ControlManager from coordination system
// The coordination system initializes AutoplayManager, so we just use it
if (!window.AutoplayManager && window.ModCoordination) {
    window.AutoplayManager = window.ModCoordination.getControlManager('autoplay', {
        originalMode: null,
        isControlledByOther(modName) {
            return this.currentOwner !== null && this.currentOwner !== modName;
        }
    });
}

let isAutomationEnabled = AUTOMATION_DISABLED;
let isCurrentlyActive = false;
let wasInitiatedByMod = false;
let isStartingAutoplay = false;
let isStoppingAutoplay = false;
let lastBestiaryRefillTime = 0;
let staminaCheckInterval = null;
let boardStateUnsubscribe = null;
let autoplayStopCheckTimeout = null;
let stateFlagTimeouts = [];
let modalTimeouts = [];
let otherTimeouts = [];
let allModsLoaded = false;
let hasLoggedAutoplayDetection = false;
let gracePeriodEndTime = 0; // Timestamp when grace period ends (0 = grace period active or not started)
let lastMissingBoostedStateLog = 0;
let lastMissingFunctionLog = 0;
let functionRetryAttempts = 0;
const MAX_FUNCTION_RETRY_ATTEMPTS = 3;
const FUNCTION_RETRY_DELAY = 2000; // 2 seconds

// ============================================================================
// 3. STAMINA MONITORING FUNCTIONS
// ============================================================================

// Calculate current stamina using game state API - Returns: Current stamina amount (number)
function getCurrentStamina() {
    try {
        const elStamina = document.querySelector('[title="Stamina"]');
        if (!elStamina) {
            return 0;
        }
        
        const staminaElement = elStamina.querySelector('span span');
        if (!staminaElement) {
            return 0;
        }
        
        const stamina = Number(staminaElement.textContent);
        return stamina;
    } catch (error) {
        console.error('[Stamina Optimizer] Error reading stamina:', error);
        return 0;
    }
}

// Check if Bestiary Automator recently refilled stamina - Returns: True if refilled recently (boolean)
function wasBestiaryRefillRecent() {
    const now = Date.now();
    const timeSinceRefill = now - lastBestiaryRefillTime;
    return timeSinceRefill < BESTIARY_REFILL_COOLDOWN;
}

// Monitor Bestiary Automator for stamina refills by detecting increases > 1 in 5 seconds (natural regen is 1/min)
function setupBestiaryRefillMonitoring() {
    try {
        let lastStamina = getCurrentStamina();
        const refillCheckInterval = setInterval(() => {
            try {
                const currentStamina = getCurrentStamina();
                const automator = findBestiaryAutomator();
                if (automator && automator.config && automator.config.autoRefillStamina) {
                    const staminaIncrease = currentStamina - lastStamina;
                    if (staminaIncrease > 1) {
                        console.log('[Stamina Optimizer] Detected Bestiary Automator stamina refill');
                        lastBestiaryRefillTime = Date.now();
                    }
                }
                lastStamina = currentStamina;
            } catch (error) {
                console.error('[Stamina Optimizer] Error monitoring Bestiary refill:', error);
            }
        }, 5000);
        window.staminaOptimizerRefillInterval = refillCheckInterval;
    } catch (error) {
        console.error('[Stamina Optimizer] Error setting up Bestiary refill monitoring:', error);
    }
}

// Find Bestiary Automator instance - Returns: Instance or null (Object|null)
function findBestiaryAutomator() {
    try {
        if (window.bestiaryAutomator?.updateConfig) {
            return window.bestiaryAutomator;
        }
        if (typeof context !== 'undefined' && context.exports?.updateConfig) {
            return context.exports;
        }
        if (window.modLoader?.getModContext) {
            const automatorContext = window.modLoader.getModContext('bestiary-automator');
            if (automatorContext?.exports?.updateConfig) {
                return automatorContext.exports;
            }
        }
        return null;
    } catch (error) {
        console.error('[Stamina Optimizer] Error finding Bestiary Automator:', error);
        return null;
    }
}

// ============================================================================
// 4. COORDINATION FUNCTIONS
// ============================================================================

// Check if a mod is active via AutoplayManager - modName: Name of mod (string) - Returns: True if mod has control (boolean)
function hasAutoplayControl(modName) {
    try {
        return window.AutoplayManager?.getCurrentOwner?.() === modName;
    } catch (error) {
        return false;
    }
}

// Check if Raid Hunter is currently active - Returns: True if active (boolean)
function isRaidHunterActive() {
    try {
        // Use coordination system if available
        if (window.ModCoordination) {
            return window.ModCoordination.isModActive('Raid Hunter');
        }
        
        // Fallback to old method for backward compatibility
        if (window.raidHunterIsCurrentlyRaiding?.()) {
            return true;
        }
        return hasAutoplayControl('Raid Hunter');
    } catch (error) {
        console.error('[Stamina Optimizer] Error checking Raid Hunter status:', error);
        return false;
    }
}

// Check if Better Boosted Maps is currently active - Returns: True if active (boolean)
function isBoostedMapsActive() {
    try {
        // Use coordination system if available
        if (window.ModCoordination) {
            return window.ModCoordination.isModActive('Better Boosted Maps');
        }
        
        // Fallback to old method for backward compatibility
        const boostedState = getBetterBoostedMapsState();
        // Check the exposed state (Better Boosted Maps uses betterBoostedMapsState, not boostedMapsState)
        if (boostedState) {
            // Check if enabled and actively farming (Better Boosted Maps exposes 'enabled' and 'isFarming')
            if (boostedState.enabled && boostedState.isFarming === true) {
                return true;
            }
        }
        // Fallback: check autoplay control
        return hasAutoplayControl('Better Boosted Maps');
    } catch (error) {
        console.error('[Stamina Optimizer] Error checking Better Boosted Maps status:', error);
        return false;
    }
}

// Safely obtain Better Boosted Maps state from multiple sources
function getBetterBoostedMapsState() {
    try {
        if (window.betterBoostedMapsState) {
            return window.betterBoostedMapsState;
        }
        const modContext = window.modLoader?.getModContext?.('better-boosted-maps');
        if (modContext?.exports?.betterBoostedMapsState) {
            return modContext.exports.betterBoostedMapsState;
        }
        if (modContext?.exports?.state) {
            return modContext.exports.state;
        }
    } catch (error) {
        console.error('[Stamina Optimizer] Error fetching Better Boosted Maps state:', error);
    }
    return null;
}

// Determine if Better Boosted Maps is enabled (fallbacks to stored value)
function isBetterBoostedMapsEnabled() {
    const boostedState = getBetterBoostedMapsState();
    if (boostedState && typeof boostedState.enabled === 'boolean') {
        return boostedState.enabled;
    }
    try {
        const saved = localStorage.getItem('betterBoostedMapsEnabled');
        if (saved !== null) {
            return JSON.parse(saved) === true;
        }
    } catch (error) {
        console.error('[Stamina Optimizer] Error reading Better Boosted Maps enabled state:', error);
    }
    return false;
}

// Check if Better Tasker is currently active - Returns: True if active (boolean)
function isBetterTaskerActive() {
    try {
        // Use coordination system if available
        if (window.ModCoordination) {
            return window.ModCoordination.isModActive('Better Tasker');
        }
        
        // Fallback to old method for backward compatibility
        const state = window.betterTaskerState;
        if (!state || state.taskerState === 'disabled' || !state.taskerState) {
            return false;
        }
        if (state.hasActiveTask === true ||
            state.taskHuntingOngoing === true ||
            state.taskOperationInProgress === true ||
            state.pendingTaskCompletion === true) {
            return true;
        }
        return hasAutoplayControl('Better Tasker');
    } catch (error) {
        console.error('[Stamina Optimizer] Error checking Better Tasker state:', error);
        return false;
    }
}

// Check if another mod is controlling autoplay - Returns: True if another mod has control (boolean)
function isAutoplayControlledByOther() {
    const currentOwner = window.AutoplayManager?.getCurrentOwner();
    if (!currentOwner) {
        return false;
    }
    if (currentOwner === 'Stamina Optimizer') {
        return false;
    }
    return true;
}

// Get reason why we cannot proceed (for logging) - Returns: Reason string or null (string|null)
function getCannotProceedReason() {
    const currentOwner = window.AutoplayManager?.getCurrentOwner?.();
    if (currentOwner && currentOwner !== 'Stamina Optimizer' && !isCurrentlyActive) {
        return `autoplay controlled by ${currentOwner}`;
    }
    if (isAutoplayControlledByOther() && !isCurrentlyActive) {
        return 'autoplay controlled by another mod';
    }
    if (isRaidHunterActive()) return 'Raid Hunter is active';
    if (isBetterTaskerActive()) return 'Better Tasker is active';
    if (isBoostedMapsActive()) return 'Better Boosted Maps is active';
    return null;
}

// Check if it's safe to start/stop autoplay - Returns: True if safe to proceed (boolean)
function canProceed() {
    const reason = getCannotProceedReason();
    if (reason) {
        console.log(`[Stamina Optimizer] Cannot proceed - ${reason}`);
        return false;
    }
    return true;
}

// ============================================================================
// 5. AUTOPLAY CONTROL FUNCTIONS
// ============================================================================

// Set state flags and clear them after delay - flagName: 'isStartingAutoplay' or 'isStoppingAutoplay' (string)
function setStateFlag(flagName) {
    if (flagName === 'isStartingAutoplay') {
        isStartingAutoplay = true;
        const timeout = setTimeout(() => { 
            isStartingAutoplay = false;
            const index = stateFlagTimeouts.indexOf(timeout);
            if (index > -1) stateFlagTimeouts.splice(index, 1);
        }, STATE_FLAG_CLEAR_DELAY);
        stateFlagTimeouts.push(timeout);
    } else if (flagName === 'isStoppingAutoplay') {
        isStoppingAutoplay = true;
        const timeout = setTimeout(() => { 
            isStoppingAutoplay = false;
            const index = stateFlagTimeouts.indexOf(timeout);
            if (index > -1) stateFlagTimeouts.splice(index, 1);
        }, STATE_FLAG_CLEAR_DELAY);
        stateFlagTimeouts.push(timeout);
    }
}

// Helper to release control and reset state
function releaseControlAndResetState() {
    isCurrentlyActive = false;
    wasInitiatedByMod = false;
    window.AutoplayManager?.releaseControl('Stamina Optimizer');
    
    // Update coordination system state
    if (window.ModCoordination) {
        window.ModCoordination.updateModState('Stamina Optimizer', { active: false });
    }
    
    updateButton();
}

// Request control and set active state - Returns: True if control was granted (boolean)
function requestControlAndSetActive() {
    if (!window.AutoplayManager?.requestControl('Stamina Optimizer')) {
        return false;
    }
    isCurrentlyActive = true;
    wasInitiatedByMod = true;
    updateButton();
    return true;
}

// Check if autoplay was initiated by the player (not by this mod) - Returns: True if player-initiated (boolean)
function isPlayerInitiatedAutoplay() {
    try {
        const boardContext = globalThis.state?.board?.getSnapshot()?.context;
        if (!boardContext) {
            return false;
        }
        const isAutoplayRunning = boardContext.mode === 'autoplay';
        if (!isAutoplayRunning) {
            return false;
        }
        const hasControl = window.AutoplayManager?.hasControl('Stamina Optimizer');
        if (hasControl) {
            return false;
        }
        if (isCurrentlyActive && wasInitiatedByMod) {
            return false;
        }
        return true;
    } catch (error) {
        console.error('[Stamina Optimizer] Error checking player-initiated autoplay:', error);
        return false;
    }
}

// Start autoplay (only if we can proceed and it wasn't player-initiated)
function startAutoplay() {
    if (!canProceed()) {
        return false;
    }
    if (isPlayerInitiatedAutoplay()) {
        console.log('[Stamina Optimizer] Autoplay was player-initiated - not starting');
        return false;
    }
    if (wasBestiaryRefillRecent()) {
        console.log('[Stamina Optimizer] Bestiary Automator recently refilled - not starting');
        return false;
    }
    if (!window.AutoplayManager?.requestControl('Stamina Optimizer')) {
        console.log('[Stamina Optimizer] Cannot start autoplay - control denied');
        return false;
    }
    try {
        const boardContext = globalThis.state.board.getSnapshot().context;
        const currentMode = boardContext.mode;
        setStateFlag('isStartingAutoplay');
        if (currentMode !== 'autoplay') {
            globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
            console.log('[Stamina Optimizer] Started autoplay');
        }
        isCurrentlyActive = true;
        wasInitiatedByMod = true;
        
        // Update coordination system state
        if (window.ModCoordination) {
            window.ModCoordination.updateModState('Stamina Optimizer', { active: true });
        }
        
        updateButton();
        return true;
    } catch (error) {
        console.error('[Stamina Optimizer] Error starting autoplay:', error);
        window.AutoplayManager?.releaseControl('Stamina Optimizer');
        isCurrentlyActive = false;
        wasInitiatedByMod = false;
        isStartingAutoplay = false;
        updateButton();
        return false;
    }
}

// Create ESC key event for clearing modals - Returns: ESC key event (KeyboardEvent)
function createEscKeyEvent() {
    return new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true
    });
}

// Find and click the pause button to pause autoplay session
async function pauseAutoplayWithButton() {
    try {
        console.log('[Stamina Optimizer] Looking for pause button...');
        
        const selectors = [
            'button:has(svg.lucide-pause)',
            'button.frame-1-red[class*="pause"]',
            'button.frame-1-red:has(svg.lucide-pause)',
            'button[class*="surface-red"]:has(svg.lucide-pause)'
        ];
        let button = selectors.reduce((found, selector) => 
            found || document.querySelector(selector), null);
        if (!button) {
            const flexContainer = document.querySelector('div.flex');
            if (flexContainer) {
                const buttons = flexContainer.querySelectorAll('button');
                if (buttons.length >= 2) {
                    const secondButton = buttons[1];
                    const hasPauseIcon = secondButton.querySelector('svg.lucide-pause');
                    if (hasPauseIcon) {
                        button = secondButton;
                        console.log('[Stamina Optimizer] Found pause button using structure fallback');
                    }
                }
            }
        }
        if (button) {
            console.log('[Stamina Optimizer] Found pause button, clicking to pause autoplay session...');
            document.dispatchEvent(createEscKeyEvent());
            await new Promise(resolve => setTimeout(resolve, PAUSE_BUTTON_CLICK_DELAY));
            button.click();
            await new Promise(resolve => setTimeout(resolve, PAUSE_BUTTON_UPDATE_DELAY));
            console.log('[Stamina Optimizer] Pause button clicked successfully');
            
            return true;
        } else {
            console.log('[Stamina Optimizer] Pause button not found');
            return false;
        }
    } catch (error) {
        console.error('[Stamina Optimizer] Error clicking pause button:', error);
        return false;
    }
}

// Stop autoplay - Uses pause button to stop session without changing mode
// Can stop if we initiated it OR if we have control (took control to stop due to low stamina)
async function stopAutoplay() {
    // Check if we have control (either we initiated it or we took control to stop it)
    if (!window.AutoplayManager?.hasControl('Stamina Optimizer')) {
        console.log('[Stamina Optimizer] Not stopping - control lost');
        releaseControlAndResetState();
        return false;
    }
    
    // If we didn't initiate it but we have control, we took control to stop it (low stamina)
    // So we should proceed with stopping
    if (!wasInitiatedByMod && !isCurrentlyActive) {
        // We have control but didn't initiate - this means we took control to stop
        // Set flags so we can properly stop
        isCurrentlyActive = true;
        wasInitiatedByMod = false; // Keep false to indicate we didn't start it, but we're stopping it
    }
    
    if (!isCurrentlyActive) {
        console.log('[Stamina Optimizer] Not stopping - not currently active');
        return false;
    }
    try {
        setStateFlag('isStoppingAutoplay');
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (boardContext.mode === 'autoplay') {
            const paused = await pauseAutoplayWithButton();
            if (paused) {
                console.log('[Stamina Optimizer] Autoplay session paused using pause button');
            } else {
                console.log('[Stamina Optimizer] Pause button not found - falling back to mode change');
                globalThis.state.board.send({ type: "setPlayMode", mode: "manual" });
            }
        }
        
        releaseControlAndResetState();
        return true;
    } catch (error) {
        console.error('[Stamina Optimizer] Error stopping autoplay:', error);
        isStoppingAutoplay = false;
        return false;
    }
}

// ============================================================================
// 6. STAMINA MONITORING AND ACTION EXECUTION
// ============================================================================

// Find mod function using multiple methods - functionName: Name of function (string), modContextKey: Context key (string), windowKey: Window key (optional string) - Returns: Found function or null (Function|null)
function findModFunction(functionName, modContextKey, windowKey = null) {
    // First, try direct window access (Better Boosted Maps exposes checkAndStartBoostedMapFarming directly on window)
    if (window[functionName] && typeof window[functionName] === 'function') {
        return window[functionName];
    }
    
    // Try modLoader context
    if (window.modLoader?.getModContext) {
        try {
            const modContext = window.modLoader.getModContext(modContextKey);
            if (modContext?.exports?.[functionName] && typeof modContext.exports[functionName] === 'function') {
                return modContext.exports[functionName];
            }
            if (modContext?.[functionName] && typeof modContext[functionName] === 'function') {
                return modContext[functionName];
            }
        } catch (e) {
            console.error(`[Stamina Optimizer] Error accessing modContext for ${modContextKey}:`, e);
        }
    }
    
    // Try windowKey object (only if different from direct window check)
    if (windowKey && windowKey !== functionName && window[windowKey]?.[functionName] && typeof window[windowKey][functionName] === 'function') {
        return window[windowKey][functionName];
    }
    
    // Try state key (hyphenated to camelCase) - only if different from windowKey
    const stateKey = modContextKey.replace(/-/g, '');
    if (stateKey !== windowKey && window[stateKey]?.[functionName] && typeof window[stateKey][functionName] === 'function') {
        return window[stateKey][functionName];
    }
    
    // Only log detailed debug info on first failure (not on retries)
    if (functionRetryAttempts === 0) {
        console.log(`[Stamina Optimizer] ⚠️ Could not find ${functionName}`);
        console.log(`[Stamina Optimizer]   Checked: window.${functionName}, modContext, window.${windowKey || stateKey}`);
    }
    
    return null;
}

// Helper function to actually trigger Better Boosted Maps (can be retried)
function triggerBetterBoostedMapsFunction() {
    const checkAndStartFunction = findModFunction(
        'checkAndStartBoostedMapFarming',
        'better-boosted-maps',
        'betterBoostedMapsState'
    );
    
    if (checkAndStartFunction && typeof checkAndStartFunction === 'function') {
        // Reset retry counter on success
        const wasRetrying = functionRetryAttempts > 0;
        functionRetryAttempts = 0;
        if (wasRetrying) {
            console.log('[Stamina Optimizer] ✅ Successfully triggered Better Boosted Maps farming');
        } else {
            console.log('[Stamina Optimizer] Triggering Better Boosted Maps farming');
        }
        window.staminaOptimizerLastBoostedMapsTrigger = Date.now();
        checkAndStartFunction(true);
        const timeout = setTimeout(() => {
            isStartingAutoplay = false;
            const index = otherTimeouts.indexOf(timeout);
            if (index > -1) otherTimeouts.splice(index, 1);
        }, BOOSTED_MAPS_TRIGGER_WINDOW);
        otherTimeouts.push(timeout);
        return true;
    }
    return false;
}

// Start boosted map farming via Better Boosted Maps
function startBoostedMapFarming() {
    try {
        if (isPlayerInitiatedAutoplay()) {
            console.log('[Stamina Optimizer] Autoplay is player-initiated - not starting boosted map farming');
            return;
        }
        const boostedState = getBetterBoostedMapsState();
        const boostedEnabled = isBetterBoostedMapsEnabled();
        // Check if Better Boosted Maps is already active first (this handles timing issues better)
        if (isBoostedMapsActive()) {
            console.log('[Stamina Optimizer] Better Boosted Maps is already active - not interfering');
            return;
        }
        // Check if Better Boosted Maps state is available and enabled
        if (!boostedState && !boostedEnabled) {
            const now = Date.now();
            if (now - lastMissingBoostedStateLog > 5000) {
                console.log('[Stamina Optimizer] Better Boosted Maps state not available yet - will retry (using fallback checks)');
                lastMissingBoostedStateLog = now;
            }
        }
        if (!boostedEnabled) {
            console.log('[Stamina Optimizer] Better Boosted Maps is not enabled - cannot start boosted map farming');
            return;
        }
        const currentOwner = window.AutoplayManager?.getCurrentOwner?.();
        if (currentOwner === 'Better Boosted Maps') {
            console.log('[Stamina Optimizer] Better Boosted Maps already has autoplay control - not stealing control');
            return;
        }
        if (currentOwner === 'Raid Hunter') {
            console.log('[Stamina Optimizer] Raid Hunter has autoplay control - not stealing control');
            return;
        }
        try {
            const boardContext = globalThis.state?.board?.getSnapshot()?.context;
            if (boardContext?.mode === 'autoplay' && !isCurrentlyActive) {
                console.log('[Stamina Optimizer] Autoplay is already running (likely player-initiated) - not starting boosted map farming');
                return;
            }
        } catch (error) {
        }
        if (boostedState?.isFarming) {
            console.log('[Stamina Optimizer] Better Boosted Maps is already farming');
            return;
        }
        if (!requestControlAndSetActive()) {
            console.log('[Stamina Optimizer] Cannot start boosted map farming - autoplay control denied');
            return;
        }
        isStartingAutoplay = true;
        console.log('[Stamina Optimizer] Requested autoplay control before triggering Better Boosted Maps');
        
        // Try to trigger the function
        if (triggerBetterBoostedMapsFunction()) {
            // Success - function was found and called
            return;
        }
        
        // Function not found - try retrying if we haven't exceeded max attempts
        const now = Date.now();
        if (functionRetryAttempts < MAX_FUNCTION_RETRY_ATTEMPTS) {
            functionRetryAttempts++;
            if (functionRetryAttempts === 1) {
                console.log(`[Stamina Optimizer] ⏳ Better Boosted Maps function not found, retrying (${MAX_FUNCTION_RETRY_ATTEMPTS} attempts)...`);
            }
            const retryTimeout = setTimeout(() => {
                const index = otherTimeouts.indexOf(retryTimeout);
                if (index > -1) otherTimeouts.splice(index, 1);
                // Retry just the function lookup and call (we already have control)
                if (triggerBetterBoostedMapsFunction()) {
                    // Success on retry
                    console.log(`[Stamina Optimizer] ✅ Better Boosted Maps function found on retry ${functionRetryAttempts}`);
                    return;
                }
                // Still failed after retry - release control
                if (functionRetryAttempts >= MAX_FUNCTION_RETRY_ATTEMPTS) {
                    releaseControlAndResetState();
                    isStartingAutoplay = false;
                    functionRetryAttempts = 0;
                }
            }, FUNCTION_RETRY_DELAY);
            otherTimeouts.push(retryTimeout);
            // Don't release control yet - wait for retry
            return;
        } else {
            // Max retries exceeded - give up
            releaseControlAndResetState();
            isStartingAutoplay = false;
            functionRetryAttempts = 0; // Reset for next time
            const timeSinceLastLog = now - lastMissingFunctionLog;
            if (timeSinceLastLog > 30000) { // Log at most once every 30 seconds
                console.error('[Stamina Optimizer] ❌ Better Boosted Maps function not found after all retries');
                console.log('[Stamina Optimizer] This usually means Better Boosted Maps failed to load or crashed during initialization');
                lastMissingFunctionLog = now;
            }
        }
    } catch (error) {
        console.error('[Stamina Optimizer] Error starting boosted map farming:', error);
        releaseControlAndResetState();
        isStartingAutoplay = false;
    }
}

// Start Raid Hunter automation
function startRaidHunter() {
    try {
        if (isPlayerInitiatedAutoplay()) {
            console.log('[Stamina Optimizer] Autoplay is player-initiated - not starting Raid Hunter');
            return;
        }
        
        // Check if Raid Hunter is already active
        if (isRaidHunterActive()) {
            console.log('[Stamina Optimizer] Raid Hunter is already active - not interfering');
            return;
        }
        
        // Check if Raid Hunter is enabled
        const raidHunterEnabled = localStorage.getItem('raidHunterAutomationEnabled');
        if (raidHunterEnabled !== 'true') {
            console.log('[Stamina Optimizer] Raid Hunter is not enabled - cannot start');
            return;
        }
        
        const currentOwner = window.AutoplayManager?.getCurrentOwner?.();
        if (currentOwner === 'Raid Hunter') {
            console.log('[Stamina Optimizer] Raid Hunter already has autoplay control');
            return;
        }
        
        // Check if there are raids available
        try {
            const raidState = globalThis.state?.raids?.getSnapshot?.();
            const hasActiveRaids = raidState?.context?.list?.length > 0;
            if (!hasActiveRaids) {
                console.log('[Stamina Optimizer] No raids available - cannot start Raid Hunter');
                return;
            }
        } catch (error) {
            console.error('[Stamina Optimizer] Error checking raid state:', error);
            return;
        }
        
        if (!requestControlAndSetActive()) {
            console.log('[Stamina Optimizer] Cannot start Raid Hunter - autoplay control denied');
            return;
        }
        
        // Raid Hunter will automatically check for raids when enabled
        // We just need to ensure autoplay is running
        try {
            const boardContext = globalThis.state.board.getSnapshot().context;
            const currentMode = boardContext.mode;
            setStateFlag('isStartingAutoplay');
            if (currentMode !== 'autoplay') {
                globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
                console.log('[Stamina Optimizer] Started autoplay for Raid Hunter');
            }
        } catch (error) {
            console.error('[Stamina Optimizer] Error starting autoplay for Raid Hunter:', error);
            releaseControlAndResetState();
            isStartingAutoplay = false;
        }
    } catch (error) {
        console.error('[Stamina Optimizer] Error starting Raid Hunter:', error);
        releaseControlAndResetState();
        isStartingAutoplay = false;
    }
}

// Start Better Tasker automation
function startBetterTasker() {
    try {
        if (isPlayerInitiatedAutoplay()) {
            console.log('[Stamina Optimizer] Autoplay is player-initiated - not starting Better Tasker');
            return;
        }
        
        // Check if Better Tasker is already active
        if (isBetterTaskerActive()) {
            console.log('[Stamina Optimizer] Better Tasker is already active - not interfering');
            return;
        }
        
        // Check if Better Tasker is enabled
        const taskerState = window.betterTaskerState?.taskerState;
        if (!taskerState || taskerState === 'disabled') {
            console.log('[Stamina Optimizer] Better Tasker is not enabled - cannot start');
            return;
        }
        
        const currentOwner = window.AutoplayManager?.getCurrentOwner?.();
        if (currentOwner === 'Better Tasker') {
            console.log('[Stamina Optimizer] Better Tasker already has autoplay control');
            return;
        }
        
        // Try to start Better Tasker automation
        const startAutomationFunction = findModFunction(
            'startAutomation',
            'better-tasker',
            'betterTaskerState'
        );
        
        if (!startAutomationFunction) {
            console.log('[Stamina Optimizer] Better Tasker startAutomation function not found');
            return;
        }
        
        if (!requestControlAndSetActive()) {
            console.log('[Stamina Optimizer] Cannot start Better Tasker - autoplay control denied');
            return;
        }
        
        isStartingAutoplay = true;
        console.log('[Stamina Optimizer] Starting Better Tasker automation');
        
        // Start Better Tasker automation
        try {
            startAutomationFunction();
            
            // Ensure autoplay is running
            const boardContext = globalThis.state.board.getSnapshot().context;
            const currentMode = boardContext.mode;
            if (currentMode !== 'autoplay') {
                globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
            }
            
            // Update coordination system state
            if (window.ModCoordination) {
                window.ModCoordination.updateModState('Stamina Optimizer', { active: true });
            }
            
            updateButton();
        } catch (error) {
            console.error('[Stamina Optimizer] Error starting Better Tasker:', error);
            releaseControlAndResetState();
            isStartingAutoplay = false;
        }
    } catch (error) {
        console.error('[Stamina Optimizer] Error starting Better Tasker:', error);
        releaseControlAndResetState();
        isStartingAutoplay = false;
    }
}

// Start normal autoplay (when no other mod is controlling)
function startNormalAutoplay() {
    try {
        if (isPlayerInitiatedAutoplay()) {
            console.log('[Stamina Optimizer] Autoplay is player-initiated - not starting normal autoplay');
            return;
        }
        
        // Check if any mod is currently controlling autoplay
        const currentOwner = window.AutoplayManager?.getCurrentOwner?.();
        if (currentOwner && currentOwner !== 'Stamina Optimizer') {
            console.log(`[Stamina Optimizer] Another mod (${currentOwner}) is controlling autoplay - not starting normal autoplay`);
            return;
        }
        
        // Check if any mod is active
        if (isRaidHunterActive()) {
            console.log('[Stamina Optimizer] Raid Hunter is active - not starting normal autoplay');
            return;
        }
        if (isBetterTaskerActive()) {
            console.log('[Stamina Optimizer] Better Tasker is active - not starting normal autoplay');
            return;
        }
        if (isBoostedMapsActive()) {
            console.log('[Stamina Optimizer] Better Boosted Maps is active - not starting normal autoplay');
            return;
        }
        
        // Check if autoplay is already running
        try {
            const boardContext = globalThis.state?.board?.getSnapshot()?.context;
            if (boardContext?.mode === 'autoplay' && !isCurrentlyActive) {
                console.log('[Stamina Optimizer] Autoplay is already running - not starting normal autoplay');
                return;
            }
        } catch (error) {
            // Ignore errors checking board state
        }
        
        if (!requestControlAndSetActive()) {
            console.log('[Stamina Optimizer] Cannot start normal autoplay - autoplay control denied');
            return;
        }
        
        // Start normal autoplay
        try {
            const boardContext = globalThis.state.board.getSnapshot().context;
            const currentMode = boardContext.mode;
            setStateFlag('isStartingAutoplay');
            if (currentMode !== 'autoplay') {
                globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
                console.log('[Stamina Optimizer] Started normal autoplay');
            }
            
            // Update coordination system state
            if (window.ModCoordination) {
                window.ModCoordination.updateModState('Stamina Optimizer', { active: true });
            }
            
            updateButton();
        } catch (error) {
            console.error('[Stamina Optimizer] Error starting normal autoplay:', error);
            releaseControlAndResetState();
            isStartingAutoplay = false;
        }
    } catch (error) {
        console.error('[Stamina Optimizer] Error starting normal autoplay:', error);
        releaseControlAndResetState();
        isStartingAutoplay = false;
    }
}

// Start "all" - tries each mod in priority order until one succeeds
function startAllMods() {
    try {
        if (isPlayerInitiatedAutoplay()) {
            console.log('[Stamina Optimizer] Autoplay is player-initiated - not starting any mod');
            return;
        }
        
        // Try in priority order: Raid Hunter > Better Tasker > Better Boosted Maps
        // Check Raid Hunter first (highest priority)
        const raidHunterEnabled = localStorage.getItem('raidHunterAutomationEnabled');
        if (raidHunterEnabled === 'true') {
            try {
                const raidState = globalThis.state?.raids?.getSnapshot?.();
                const hasActiveRaids = raidState?.context?.list?.length > 0;
                if (hasActiveRaids && !isRaidHunterActive()) {
                    console.log('[Stamina Optimizer] Trying Raid Hunter first (highest priority)');
                    startRaidHunter();
                    return; // If Raid Hunter starts, we're done
                }
            } catch (error) {
                console.error('[Stamina Optimizer] Error checking Raid Hunter:', error);
            }
        }
        
        // Try Better Tasker next
        const taskerState = window.betterTaskerState?.taskerState;
        if (taskerState && taskerState !== 'disabled' && !isBetterTaskerActive()) {
            console.log('[Stamina Optimizer] Trying Better Tasker (second priority)');
            startBetterTasker();
            return; // If Better Tasker starts, we're done
        }
        
        // Try Better Boosted Maps last
        const boostedEnabled = isBetterBoostedMapsEnabled();
        if (boostedEnabled && !isBoostedMapsActive()) {
            console.log('[Stamina Optimizer] Trying Better Boosted Maps (lowest priority)');
            startBoostedMapFarming();
            return;
        }
        
        console.log('[Stamina Optimizer] No mods available to start');
    } catch (error) {
        console.error('[Stamina Optimizer] Error starting all mods:', error);
    }
}

// Execute the configured actions (in priority order)
function executeAction() {
    const settings = loadSettings();
    const actions = settings.actions || DEFAULT_ACTIONS;
    
    if (!Array.isArray(actions) || actions.length === 0) {
        console.log('[Stamina Optimizer] No actions configured');
        return;
    }
    
    console.log(`[Stamina Optimizer] Executing actions: ${actions.join(', ')}`);
    
    // Execute actions in priority order: Raid Hunter > Better Tasker > Better Boosted Maps > Autoplay
    const actionOrder = ['raid-hunter', 'better-tasker', 'boosted-maps', 'autoplay'];
    
    for (const action of actionOrder) {
        if (actions.includes(action)) {
            switch (action) {
                case 'autoplay':
                    startNormalAutoplay();
                    // If autoplay starts successfully, don't try other actions
                    if (isCurrentlyActive) return;
                    break;
                case 'boosted-maps':
                    startBoostedMapFarming();
                    // If boosted maps starts successfully, don't try other lower priority actions
                    if (isCurrentlyActive) return;
                    break;
                case 'raid-hunter':
                    startRaidHunter();
                    // If raid hunter starts successfully, don't try other lower priority actions
                    if (isCurrentlyActive) return;
                    break;
                case 'better-tasker':
                    startBetterTasker();
                    // If better tasker starts successfully, don't try other lower priority actions
                    if (isCurrentlyActive) return;
                    break;
            }
        }
    }
}

// Monitor stamina and execute actions based on thresholds
function monitorStamina() {
    if (!isAutomationEnabled) {
        return;
    }
    
    // Check if we're still waiting for allModsLoaded signal or in grace period
    if (!allModsLoaded) {
        // Still waiting for the signal - don't execute actions yet
        return;
    }
    
    // Check if we're still in the grace period after allModsLoaded
    const now = Date.now();
    if (gracePeriodEndTime > 0 && now < gracePeriodEndTime) {
        const remainingSeconds = Math.ceil((gracePeriodEndTime - now) / 1000);
        // Only log at 10s, 5s, and when it ends
        if (remainingSeconds === 10 || remainingSeconds === 5 || remainingSeconds === 1) {
            console.log(`[Stamina Optimizer] ⏳ Waiting for mods to finish loading (${remainingSeconds}s remaining)...`);
        }
        return;
    }
    
    const settings = loadSettings();
    const maxStamina = settings.maxStamina || DEFAULT_MAX_STAMINA;
    const minStamina = settings.minStamina || DEFAULT_MIN_STAMINA;
    
    const currentStamina = getCurrentStamina();
    updateButton();
    if (currentStamina >= maxStamina) {
        if (!isCurrentlyActive) {
            if (isPlayerInitiatedAutoplay()) {
                return;
            }
            if (!wasBestiaryRefillRecent()) {
                if (canProceed()) {
                console.log(`[Stamina Optimizer] Stamina (${currentStamina}) >= max (${maxStamina}) - executing action`);
                executeAction();
                updateButton();
                } else {
                    const reason = getCannotProceedReason();
                    if (reason) {
                        console.log(`[Stamina Optimizer] ⏸️ Stamina high but ${reason} - waiting`);
                    }
                }
            }
        }
    }
    if (currentStamina < minStamina) {
        // Check if autoplay is currently running
        try {
            const boardContext = globalThis.state?.board?.getSnapshot()?.context;
            const isAutoplayRunning = boardContext?.mode === 'autoplay';
            
            if (isAutoplayRunning) {
                // If we initiated it, stop it
                if (isCurrentlyActive && wasInitiatedByMod) {
                    console.log(`[Stamina Optimizer] ⏹️ Stamina (${currentStamina}) < min (${minStamina}) - stopping`);
                    stopAutoplay().catch(error => {
                        console.error('[Stamina Optimizer] Error in stopAutoplay:', error);
                    });
                    updateButton();
                } else {
                    // Autoplay is running but we didn't start it - check if we should stop it
                    const currentOwner = window.AutoplayManager?.getCurrentOwner?.();
                    
                    // Check if the mod controlling autoplay is in our configured actions
                    // (settings already loaded at the start of monitorStamina function)
                    const actions = settings.actions || DEFAULT_ACTIONS;
                    
                    // Map mod names to action values
                    const modToActionMap = {
                        'Raid Hunter': 'raid-hunter',
                        'Better Tasker': 'better-tasker',
                        'Better Boosted Maps': 'boosted-maps'
                    };
                    
                    // Check if the current owner is in our configured actions
                    // If currentOwner is null/undefined, try to detect which mod is active
                    let detectedMod = currentOwner;
                    if (!detectedMod) {
                        // Try to detect via active mod functions
                        if (isRaidHunterActive()) {
                            detectedMod = 'Raid Hunter';
                        } else if (isBetterTaskerActive()) {
                            detectedMod = 'Better Tasker';
                        } else if (isBoostedMapsActive()) {
                            detectedMod = 'Better Boosted Maps';
                        }
                    }
                    
                    let shouldStop = false;
                    if (detectedMod) {
                        const actionValue = modToActionMap[detectedMod];
                        if (actionValue && actions.includes(actionValue)) {
                            // Mod is in configured actions - we should stop it
                            shouldStop = true;
                        } else {
                            // Mod is not in configured actions - don't stop it
                            console.log(`[Stamina Optimizer] ⚠️ Stamina (${currentStamina}) < min (${minStamina}) but ${detectedMod} is not in configured actions - not stopping`);
                            return; // Exit early - don't try to stop
                        }
                    } else {
                        // No owner or unknown owner - check if 'autoplay' action is configured
                        if (actions.includes('autoplay')) {
                            shouldStop = true;
                        } else {
                            console.log(`[Stamina Optimizer] ⚠️ Stamina (${currentStamina}) < min (${minStamina}) but autoplay action is not configured - not stopping`);
                            return; // Exit early - don't try to stop
                        }
                    }
                    
                    // Only proceed if we should stop
                    if (!shouldStop) {
                        return;
                    }
                    
                    // Check if a high-priority mod is blocking us (only Board Analyzer and Manual Runner have higher priority)
                    const isBlockedByHighPriority = window.ModCoordination ? 
                        !window.ModCoordination.canModRun('Stamina Optimizer', [
                            'Board Analyzer',
                            'Manual Runner'
                        ]) : false;
                    
                    // Only try to stop if not blocked by system-level mods
                    // Stamina Optimizer (110) can stop Raid Hunter (100), Better Tasker (90), and Better Boosted Maps (10)
                    if (!isBlockedByHighPriority) {
                        // Try to request control and stop via coordination system (respects priorities)
                        let controlGranted = false;
                        if (window.ModCoordination) {
                            controlGranted = window.ModCoordination.requestControl('autoplay', 'Stamina Optimizer');
                        } else {
                            // Fallback to AutoplayManager if coordination system not available
                            controlGranted = window.AutoplayManager?.requestControl('Stamina Optimizer') || false;
                        }
                        
                        if (controlGranted) {
                            // We took control to stop autoplay - set state so stopAutoplay() can proceed
                            isCurrentlyActive = true;
                            wasInitiatedByMod = false; // We didn't initiate it, but we're stopping it
                            
                            console.log(`[Stamina Optimizer] ⏹️ Stamina (${currentStamina}) < min (${minStamina}) - stopping autoplay (took control from ${currentOwner || 'unknown'})`);
                            stopAutoplay().catch(error => {
                                console.error('[Stamina Optimizer] Error in stopAutoplay:', error);
                            });
                            updateButton();
                        } else {
                            console.log(`[Stamina Optimizer] ⚠️ Stamina (${currentStamina}) < min (${minStamina}) but autoplay controlled by ${currentOwner || 'unknown'} - cannot stop`);
                        }
                    } else {
                        console.log(`[Stamina Optimizer] ⚠️ Stamina (${currentStamina}) < min (${minStamina}) but system-level mod is active - cannot stop`);
                    }
                }
            }
        } catch (error) {
            console.error('[Stamina Optimizer] Error checking autoplay state:', error);
        }
    }
}

// Start stamina monitoring
function startStaminaMonitoring() {
    if (staminaCheckInterval) {
        clearInterval(staminaCheckInterval);
    }
    
    staminaCheckInterval = setInterval(() => {
        monitorStamina();
    }, STAMINA_CHECK_INTERVAL);
    
    console.log('[Stamina Optimizer] Stamina monitoring started');
}

// Stop stamina monitoring
function stopStaminaMonitoring() {
    if (staminaCheckInterval) {
        clearInterval(staminaCheckInterval);
        staminaCheckInterval = null;
    }
    
    console.log('[Stamina Optimizer] Stamina monitoring stopped');
}

// ============================================================================
// 7. AUTOPLAY STATE MONITORING
// ============================================================================

// Monitor autoplay state changes to detect when player manually stops/starts
function startAutoplayStateMonitoring() {
    if (boardStateUnsubscribe && typeof boardStateUnsubscribe === 'function') {
        boardStateUnsubscribe();
        boardStateUnsubscribe = null;
    }
    try {
        // Check if game state is available before subscribing
        if (!globalThis.state || !globalThis.state.board) {
            console.log('[Stamina Optimizer] ⏳ Game state not ready, retrying autoplay monitoring...');
            // Retry after a delay
            const retryTimeout = setTimeout(() => {
                const index = otherTimeouts.indexOf(retryTimeout);
                if (index > -1) otherTimeouts.splice(index, 1);
                startAutoplayStateMonitoring();
            }, 2000);
            otherTimeouts.push(retryTimeout);
            return;
        }
        boardStateUnsubscribe = globalThis.state.board.subscribe((state) => {
            try {
                const isAutoplay = state.context.mode === 'autoplay';
                if (!isAutoplay && isCurrentlyActive && wasInitiatedByMod && !isStoppingAutoplay && !isStartingAutoplay) {
                    if (window.AutoplayManager?.hasControl('Stamina Optimizer')) {
                        if (autoplayStopCheckTimeout) {
                            clearTimeout(autoplayStopCheckTimeout);
                            autoplayStopCheckTimeout = null;
                        }
                        autoplayStopCheckTimeout = setTimeout(() => {
                            const boardContext = globalThis.state?.board?.getSnapshot()?.context;
                            const stillStopped = boardContext?.mode !== 'autoplay';
                            if (stillStopped && window.AutoplayManager?.hasControl('Stamina Optimizer') && 
                                isCurrentlyActive && wasInitiatedByMod && !isStoppingAutoplay && !isStartingAutoplay) {
                                console.log('[Stamina Optimizer] Autoplay stopped by player - releasing control');
                                releaseControlAndResetState();
                                if (isAutomationEnabled) {
                                    setTimeout(() => monitorStamina(), 500);
                                }
                            }
                            autoplayStopCheckTimeout = null;
                        }, AUTOPLAY_STOP_CHECK_DELAY);
                    }
                } else if (isAutoplay && autoplayStopCheckTimeout) {
                    clearTimeout(autoplayStopCheckTimeout);
                    autoplayStopCheckTimeout = null;
                }
                if (!isAutoplay && !isCurrentlyActive && !wasInitiatedByMod && !isStoppingAutoplay && !isStartingAutoplay) {
                    // Reset detection flag when autoplay stops
                    hasLoggedAutoplayDetection = false;
                    if (isAutomationEnabled) {
                        setTimeout(() => monitorStamina(), 500);
                    }
                }
                if (hasAutoplayControl('Raid Hunter') && isCurrentlyActive && wasInitiatedByMod) {
                    console.log('[Stamina Optimizer] Raid Hunter took control - releasing our control');
                    releaseControlAndResetState();
                }
                if (isAutoplay && window.AutoplayManager?.hasControl('Stamina Optimizer')) {
                    if (!isCurrentlyActive || !wasInitiatedByMod) {
                        console.log('[Stamina Optimizer] Autoplay started (via Better Boosted Maps) - recognizing as our own');
                        isCurrentlyActive = true;
                        wasInitiatedByMod = true;
                        updateButton();
                    }
                } else if (isAutoplay && !isCurrentlyActive && !wasInitiatedByMod && !isStartingAutoplay) {
                    const timeSinceTrigger = Date.now() - (window.staminaOptimizerLastBoostedMapsTrigger || 0);
                    if (timeSinceTrigger < BOOSTED_MAPS_TRIGGER_WINDOW) {
                        if (!hasAutoplayControl('Raid Hunter') && requestControlAndSetActive()) {
                            console.log('[Stamina Optimizer] Autoplay started after triggering Better Boosted Maps - claiming control');
                        }
                    } else {
                        // Only log once on initialization to avoid spam, and only if it's unexpected
                        if (!hasLoggedAutoplayDetection) {
                            const settings = loadSettings();
                            const actions = settings.actions || DEFAULT_ACTIONS;
                            
                            // Identify which mod (if any) is controlling autoplay
                            const currentOwner = window.AutoplayManager?.getCurrentOwner?.();
                            let ownerInfo = 'player';
                            let isExpected = false;
                            
                            // Check if any of the configured actions match
                            if (Array.isArray(actions)) {
                                if (actions.includes('boosted-maps') && (currentOwner === 'Better Boosted Maps' || isBoostedMapsActive())) {
                                    ownerInfo = currentOwner || 'Better Boosted Maps (likely)';
                                    isExpected = true;
                                } else if (actions.includes('raid-hunter') && (currentOwner === 'Raid Hunter' || isRaidHunterActive())) {
                                    ownerInfo = currentOwner || 'Raid Hunter (likely)';
                                    isExpected = true;
                                } else if (actions.includes('better-tasker') && (currentOwner === 'Better Tasker' || isBetterTaskerActive())) {
                                    ownerInfo = currentOwner || 'Better Tasker (likely)';
                                    isExpected = true;
                                } else if (actions.includes('autoplay') && currentOwner === null) {
                                    ownerInfo = 'player';
                                    isExpected = true;
                                } else {
                                    // Determine owner info for logging
                                    if (currentOwner) {
                                        ownerInfo = currentOwner;
                                    } else if (isBoostedMapsActive()) {
                                        ownerInfo = 'Better Boosted Maps (likely)';
                                    } else if (isRaidHunterActive()) {
                                        ownerInfo = 'Raid Hunter (likely)';
                                    } else if (isBetterTaskerActive()) {
                                        ownerInfo = 'Better Tasker (likely)';
                                    }
                                }
                            }
                            
                            // Only log if it's unexpected (not the intended behavior)
                            if (!isExpected) {
                                console.log(`[Stamina Optimizer] Autoplay is running (started by ${ownerInfo}) - monitoring stamina and will stop if needed`);
                            }
                            hasLoggedAutoplayDetection = true;
                        }
                    }
                }
            } catch (error) {
                console.error('[Stamina Optimizer] Error in autoplay state monitoring:', error);
            }
        });
    } catch (error) {
        console.error('[Stamina Optimizer] Error setting up autoplay state monitoring:', error);
    }
}

// Stop autoplay state monitoring
function stopAutoplayStateMonitoring() {
    if (autoplayStopCheckTimeout) {
        clearTimeout(autoplayStopCheckTimeout);
        autoplayStopCheckTimeout = null;
    }
    if (boardStateUnsubscribe && typeof boardStateUnsubscribe === 'function') {
        boardStateUnsubscribe();
        boardStateUnsubscribe = null;
    }
}

// ============================================================================
// 8. UI FUNCTIONS
// ============================================================================


// Create button (like Bestiary Automator)
function createButton() {
    if (!api || !api.ui || !api.ui.addButton) {
        console.error('[Stamina Optimizer] API not available for button creation');
        return;
    }
    api.ui.addButton({
        id: BUTTON_ID,
        text: t('mods.staminaOptimizer.buttonText'),
        modId: MOD_ID,
        tooltip: t('mods.staminaOptimizer.buttonTooltip'),
        primary: false,
        onClick: () => {
            openSettingsModal();
        }
    });
    const timeout = setTimeout(() => {
        const btn = document.getElementById(BUTTON_ID);
        if (btn) {
            applyButtonStyling(btn);
        }
        const index = otherTimeouts.indexOf(timeout);
        if (index > -1) otherTimeouts.splice(index, 1);
    }, 100);
    otherTimeouts.push(timeout);
}

// Apply button styling based on automation state
function applyButtonStyling(btn) {
    const regularBgUrl = 'https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png';
    const greenBgUrl = 'https://bestiaryarena.com/_next/static/media/background-green.be515334.png';
    const blueBgUrl = 'https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png';
    btn.style.background = '';
    btn.style.backgroundColor = '';
    if (isAutomationEnabled) {
        btn.style.background = `url('${greenBgUrl}') repeat`;
        btn.style.backgroundSize = "auto";
    } else {
        btn.style.background = `url('${regularBgUrl}') repeat`;
    }
}

// Update button styling
function updateButton() {
    const btn = document.getElementById(BUTTON_ID);
    if (btn) {
        applyButtonStyling(btn);
    }
}

// ============================================================================
// 9. SETTINGS MODAL
// ============================================================================

let activeModal = null;
let modalInProgress = false;
let lastModalCall = 0;
let modalCleanupObserver = null;

const MODAL_WIDTH = 400;
const MODAL_HEIGHT = 490;

// Create styled input element
function createStyledInput(type, id, value, style, attributes = {}) {
    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    if (value !== undefined) input.value = value;
    if (style) input.style.cssText = style;
    
    Object.entries(attributes).forEach(([key, val]) => {
        input[key] = val;
    });
    
    return input;
}

// Create checkbox setting
function createCheckboxSetting(id, labelText, description, checked = false) {
    const settingDiv = document.createElement('div');
    settingDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
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
    
    if (description) {
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
    }
    
    return settingDiv;
}

// Create number input setting
function createNumberSetting(id, labelText, description, value, min, max) {
    const settingDiv = document.createElement('div');
    settingDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    const label = document.createElement('label');
    label.textContent = labelText;
    label.className = 'pixel-font-16';
    label.setAttribute('for', id);
    label.style.cssText = `
        font-weight: bold;
        color: ${COLOR_WHITE};
        margin-bottom: 4px;
    `;
    settingDiv.appendChild(label);
    
    const input = createStyledInput('number', id, value, `
        width: 100%;
        padding: 6px;
        background: ${COLOR_DARK_GRAY};
        border: 1px solid ${COLOR_ACCENT};
        color: ${COLOR_WHITE};
        border-radius: 3px;
        box-sizing: border-box;
        font-size: 14px;
    `, {
        min,
        max,
        className: 'pixel-font-16'
    });
    input.addEventListener('change', autoSaveSettings);
    settingDiv.appendChild(input);
    
    if (description) {
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
    }
    
    return settingDiv;
}

// Create dropdown setting
function createDropdownSetting(id, label, description, value, options = []) {
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
    
    options.forEach(option => {
        const optionElement = document.createElement('option');
        // Support both string values and objects with {value, label}
        if (typeof option === 'object' && option.value !== undefined) {
            optionElement.value = option.value;
            optionElement.textContent = option.label || option.value;
        } else {
            optionElement.value = option;
            optionElement.textContent = option;
        }
        optionElement.style.cssText = `
            background: ${COLOR_DARK_GRAY};
            color: ${COLOR_WHITE};
        `;
        selectElement.appendChild(optionElement);
    });
    
    selectElement.value = value;
    selectElement.addEventListener('change', autoSaveSettings);
    settingDiv.appendChild(selectElement);
    
    if (description) {
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
    }
    
    return settingDiv;
}

// Create settings content
function createSettingsContent() {
    const mainContainer = document.createElement('div');
    mainContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        width: 370px;
        height: 490px;
        box-sizing: border-box;
        overflow-y: auto;
        background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
        color: ${COLOR_WHITE};
        font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
        border: 4px solid transparent;
        border-image: url('https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png') 6 fill stretch;
        border-radius: 6px;
        padding: 20px;
    `;
    
    const title = document.createElement('h3');
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0 0 20px 0;
        color: ${COLOR_ACCENT};
        font-size: 18px;
        font-weight: bold;
        text-align: center;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    
    const btlucasLink = document.createElement('a');
    btlucasLink.href = 'https://bestiaryarena.com/profile/btlucas';
    btlucasLink.target = '_blank';
    btlucasLink.rel = 'noopener noreferrer';
    btlucasLink.textContent = 'btlucas';
    btlucasLink.style.cssText = `
        color: ${COLOR_ACCENT};
        text-decoration: none;
    `;
    btlucasLink.addEventListener('mouseenter', () => {
        btlucasLink.style.textDecoration = 'underline';
    });
    btlucasLink.addEventListener('mouseleave', () => {
        btlucasLink.style.textDecoration = 'none';
    });
    
    title.appendChild(btlucasLink);
    title.appendChild(document.createTextNode(' Stamina Optimizer'));
    mainContainer.appendChild(title);
    
    const settings = loadSettings();
    
    // Automation toggle
        const automationToggle = createCheckboxSetting(
            'automationEnabled',
            t('mods.staminaOptimizer.enableAutomation'),
            t('mods.staminaOptimizer.enableAutomationDescription'),
            isAutomationEnabled
        );
        const automationCheckbox = automationToggle.querySelector('input[type="checkbox"]');
        automationCheckbox.replaceWith(automationCheckbox.cloneNode(true));
    const newAutomationCheckbox = automationToggle.querySelector('input[type="checkbox"]');
    newAutomationCheckbox.addEventListener('change', (e) => {
        isAutomationEnabled = e.target.checked ? AUTOMATION_ENABLED : AUTOMATION_DISABLED;
        saveAutomationState();
        updateButton();
        
        if (isAutomationEnabled) {
            startStaminaMonitoring();
            startAutoplayStateMonitoring();
            setupBestiaryRefillMonitoring();
        } else {
            stopStaminaMonitoring();
            stopAutoplayStateMonitoring();
            if (isCurrentlyActive && wasInitiatedByMod) {
                stopAutoplay();
            }
            if (window.staminaOptimizerRefillInterval) {
                clearInterval(window.staminaOptimizerRefillInterval);
                window.staminaOptimizerRefillInterval = null;
            }
        }
    });
    mainContainer.appendChild(automationToggle);
    
    const maxStaminaSetting = createNumberSetting(
        'maxStamina',
        t('mods.staminaOptimizer.maxStaminaLabel'),
        t('mods.staminaOptimizer.maxStaminaDescription'),
        settings.maxStamina || DEFAULT_MAX_STAMINA,
        1,
        1000
    );
    mainContainer.appendChild(maxStaminaSetting);
    
    const minStaminaSetting = createNumberSetting(
        'minStamina',
        t('mods.staminaOptimizer.minStaminaLabel'),
        t('mods.staminaOptimizer.minStaminaDescription'),
        settings.minStamina || DEFAULT_MIN_STAMINA,
        1,
        1000
    );
    mainContainer.appendChild(minStaminaSetting);
    
    // Action checkboxes section
    const actionSection = document.createElement('div');
    actionSection.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    const actionLabel = document.createElement('label');
    actionLabel.textContent = t('mods.staminaOptimizer.actionLabel');
    actionLabel.className = 'pixel-font-16';
    actionLabel.style.cssText = `
        font-weight: bold;
        color: ${COLOR_WHITE};
        margin-bottom: 4px;
    `;
    actionSection.appendChild(actionLabel);
    
    const actionDescription = document.createElement('div');
    actionDescription.textContent = t('mods.staminaOptimizer.actionDescription');
    actionDescription.className = 'pixel-font-16';
    actionDescription.style.cssText = `
        font-size: 11px;
        color: ${COLOR_GRAY};
        font-style: italic;
        margin-bottom: 8px;
    `;
    actionSection.appendChild(actionDescription);
    
    const currentActions = settings.actions || DEFAULT_ACTIONS;
    const actionOptions = [
        { value: 'raid-hunter', label: t('mods.staminaOptimizer.actionRaidHunter') },
        { value: 'better-tasker', label: t('mods.staminaOptimizer.actionBetterTasker') },
        { value: 'boosted-maps', label: t('mods.staminaOptimizer.actionBoostedMaps') },
        { value: 'autoplay', label: t('mods.staminaOptimizer.actionAutoplay') }
    ];
    
    actionOptions.forEach(option => {
        const checkboxSetting = createCheckboxSetting(
            `action-${option.value}`,
            option.label,
            null,
            Array.isArray(currentActions) && currentActions.includes(option.value)
        );
        actionSection.appendChild(checkboxSetting);
    });
    
    mainContainer.appendChild(actionSection);
    
    const validationDiv = document.createElement('div');
    validationDiv.id = `${MOD_ID}-validation`;
    validationDiv.style.cssText = `
        margin-top: 10px;
        padding: 8px;
        background: rgba(255, 107, 107, 0.1);
        border: 1px solid ${COLOR_RED};
        border-radius: 3px;
        color: ${COLOR_RED};
        font-size: 12px;
        display: none;
    `;
    mainContainer.appendChild(validationDiv);
    
    const autoSaveIndicator = document.createElement('div');
    autoSaveIndicator.textContent = t('mods.staminaOptimizer.settingsAutoSave');
    autoSaveIndicator.className = 'pixel-font-16';
    autoSaveIndicator.style.cssText = `
        font-size: 11px;
        color: ${COLOR_SUCCESS};
        font-style: italic;
        margin-right: auto;
    `;
    window.staminaOptimizerAutoSaveIndicator = autoSaveIndicator;
    
    return mainContainer;
}

// Cleanup function for modal state
function cleanupModal() {
    try {
        modalTimeouts.forEach(timeout => clearTimeout(timeout));
        modalTimeouts = [];
        if (activeModal) {
            activeModal = null;
        }
        if (modalCleanupObserver) {
            modalCleanupObserver.disconnect();
            modalCleanupObserver = null;
        }
        modalInProgress = false;
        lastModalCall = 0;
        
        console.log('[Stamina Optimizer] Modal cleanup completed');
    } catch (error) {
        console.error('[Stamina Optimizer] Error during modal cleanup:', error);
    }
}

// Open settings modal
function openSettingsModal() {
    try {
        const now = Date.now();
        if (modalInProgress) return;
        if (now - lastModalCall < 1000) return;
        
        lastModalCall = now;
        modalInProgress = true;
        
        (() => {
            try {
                if (!modalInProgress) return;
                document.dispatchEvent(createEscKeyEvent());
                const timeout1 = setTimeout(() => {
                    const index = modalTimeouts.indexOf(timeout1);
                    if (index > -1) modalTimeouts.splice(index, 1);
                    if (typeof context !== 'undefined' && context.api && context.api.ui) {
                        try {
                            const settingsContent = createSettingsContent();
                            activeModal = context.api.ui.components.createModal({
                                title: t('mods.staminaOptimizer.settingsTitle'),
                                width: MODAL_WIDTH,
                                height: MODAL_HEIGHT,
                                content: settingsContent,
                                buttons: [{ text: t('mods.staminaOptimizer.closeButton'), primary: true }],
                                onClose: () => {
                                    console.log('[Stamina Optimizer] Settings modal closed');
                                    cleanupModal();
                                }
                            });
                            const timeout2 = setTimeout(() => {
                                const index2 = modalTimeouts.indexOf(timeout2);
                                if (index2 > -1) modalTimeouts.splice(index2, 1);
                                const modalElement = document.querySelector('div[role="dialog"][data-state="open"]');
                                if (modalElement) {
                                    modalCleanupObserver = new MutationObserver((mutations) => {
                                        mutations.forEach((mutation) => {
                                            mutation.removedNodes.forEach((node) => {
                                                if (node === modalElement || node.contains?.(modalElement)) {
                                                    modalCleanupObserver.disconnect();
                                                    modalCleanupObserver = null;
                                                    cleanupModal();
                                                }
                                            });
                                        });
                                    });
                                    modalCleanupObserver.observe(document.body, { childList: true, subtree: true });
                                }
                            }, 100);
                            modalTimeouts.push(timeout2);
                            const timeout3 = setTimeout(() => {
                                const index3 = modalTimeouts.indexOf(timeout3);
                                if (index3 > -1) modalTimeouts.splice(index3, 1);
                                const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
                                if (dialog) {
                                    dialog.style.width = MODAL_WIDTH + 'px';
                                    dialog.style.minWidth = MODAL_WIDTH + 'px';
                                    dialog.style.maxWidth = MODAL_WIDTH + 'px';
                                    dialog.style.height = MODAL_HEIGHT + 'px';
                                    dialog.style.minHeight = MODAL_HEIGHT + 'px';
                                    dialog.style.maxHeight = MODAL_HEIGHT + 'px';
                                    let footer = dialog.querySelector('div.flex.justify-end.gap-2');
                                    if (!footer) {
                                        const closeButton = Array.from(dialog.querySelectorAll('button')).find(
                                            btn => btn.textContent.trim() === t('mods.staminaOptimizer.closeButton')
                                        );
                                        if (closeButton) {
                                            footer = closeButton.closest('div.flex');
                                        }
                                    }
                                    if (footer && window.staminaOptimizerAutoSaveIndicator) {
                                        footer.insertBefore(window.staminaOptimizerAutoSaveIndicator, footer.firstChild);
                                        delete window.staminaOptimizerAutoSaveIndicator;
                                    }
                                    loadAndApplySettings();
                                }
                            }, 50);
                            modalTimeouts.push(timeout3);
                        } catch (error) {
                            console.error('[Stamina Optimizer] Error creating modal:', error);
                            modalInProgress = false;
                        }
                    } else {
                        console.warn('[Stamina Optimizer] API not available for modal creation');
                        modalInProgress = false;
                    }
                }, 100);
                modalTimeouts.push(timeout1);
            } catch (error) {
                console.error('[Stamina Optimizer] Error in modal creation wrapper:', error);
                modalInProgress = false;
            }
        })();
        
    } catch (error) {
        console.error('[Stamina Optimizer] Error in openSettingsModal:', error);
        modalInProgress = false;
    }
}

// ============================================================================
// 10. SETTINGS MANAGEMENT
// ============================================================================

const DEFAULT_SETTINGS = {
    maxStamina: DEFAULT_MAX_STAMINA,
    minStamina: DEFAULT_MIN_STAMINA,
    actions: DEFAULT_ACTIONS
};

// Load settings
function loadSettings() {
    const saved = localStorage.getItem(`${MOD_ID}Settings`);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            const settings = { ...DEFAULT_SETTINGS, ...parsed };
            
            // Migrate from old single action to new actions array
            if (settings.action && !settings.actions) {
                if (settings.action === 'all') {
                    settings.actions = ['raid-hunter', 'better-tasker', 'boosted-maps', 'autoplay'];
                } else {
                    settings.actions = [settings.action];
                }
                // Remove old action field and save migrated settings
                delete settings.action;
                saveSettings(settings);
            }
            
            // Ensure actions is an array
            if (!Array.isArray(settings.actions) || settings.actions.length === 0) {
                settings.actions = DEFAULT_ACTIONS;
            }
            
            return settings;
        } catch (error) {
            console.error('[Stamina Optimizer] Error parsing settings:', error);
            return DEFAULT_SETTINGS;
        }
    }
    return DEFAULT_SETTINGS;
}

// Save settings
function saveSettings(settings) {
    try {
        localStorage.setItem(`${MOD_ID}Settings`, JSON.stringify(settings));
        console.log('[Stamina Optimizer] Settings saved');
    } catch (error) {
        console.error('[Stamina Optimizer] Error saving settings:', error);
    }
}

// Auto-save settings
function autoSaveSettings() {
    try {
        const settings = {};
        const maxStaminaInput = document.getElementById('maxStamina');
        const minStaminaInput = document.getElementById('minStamina');
        
        if (maxStaminaInput) {
            const maxStamina = parseInt(maxStaminaInput.value);
            if (isNaN(maxStamina) || maxStamina < 1 || maxStamina > 1000) {
                showValidationMessage(t('mods.staminaOptimizer.validationMaxRange'));
                return;
            }
            settings.maxStamina = maxStamina;
        }
        
        if (minStaminaInput) {
            const minStamina = parseInt(minStaminaInput.value);
            if (isNaN(minStamina) || minStamina < 1 || minStamina > 1000) {
                showValidationMessage(t('mods.staminaOptimizer.validationMinRange'));
                return;
            }
            settings.minStamina = minStamina;
        }
        if (settings.maxStamina && settings.minStamina) {
            if (settings.maxStamina <= settings.minStamina) {
                showValidationMessage(t('mods.staminaOptimizer.validationMaxMin'));
                return;
            }
        }
        
        // Collect selected actions from checkboxes
        const actions = [];
        const actionCheckboxes = [
            { id: 'action-raid-hunter', value: 'raid-hunter' },
            { id: 'action-better-tasker', value: 'better-tasker' },
            { id: 'action-boosted-maps', value: 'boosted-maps' },
            { id: 'action-autoplay', value: 'autoplay' }
        ];
        
        actionCheckboxes.forEach(({ id, value }) => {
            const checkbox = document.getElementById(id);
            if (checkbox && checkbox.checked) {
                actions.push(value);
            }
        });
        
        // Ensure at least one action is selected
        if (actions.length === 0) {
            showValidationMessage(t('mods.staminaOptimizer.validationAtLeastOneAction'));
            return;
        }
        
        settings.actions = actions;
        
        saveSettings(settings);
        hideValidationMessage();
    } catch (error) {
        console.error('[Stamina Optimizer] Error auto-saving settings:', error);
    }
}

// Load and apply settings to modal
function loadAndApplySettings() {
    try {
        const settings = loadSettings();
        
        const maxStaminaInput = document.getElementById('maxStamina');
        const minStaminaInput = document.getElementById('minStamina');
        
        if (maxStaminaInput) {
            maxStaminaInput.value = settings.maxStamina || DEFAULT_MAX_STAMINA;
        }
        
        if (minStaminaInput) {
            minStaminaInput.value = settings.minStamina || DEFAULT_MIN_STAMINA;
        }
        
        // Handle migration from old single action to new actions array
        let currentActions = settings.actions || DEFAULT_ACTIONS;
        if (settings.action && !settings.actions) {
            // Migrate old single action to array
            if (settings.action === 'all') {
                currentActions = ['raid-hunter', 'better-tasker', 'boosted-maps', 'autoplay'];
            } else {
                currentActions = [settings.action];
            }
        }
        
        // Apply action checkboxes
        const actionCheckboxes = [
            { id: 'action-raid-hunter', value: 'raid-hunter' },
            { id: 'action-better-tasker', value: 'better-tasker' },
            { id: 'action-boosted-maps', value: 'boosted-maps' },
            { id: 'action-autoplay', value: 'autoplay' }
        ];
        
        actionCheckboxes.forEach(({ id, value }) => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.checked = Array.isArray(currentActions) && currentActions.includes(value);
            }
        });
    } catch (error) {
        console.error('[Stamina Optimizer] Error loading and applying settings:', error);
    }
}

// Show validation message
function showValidationMessage(message) {
    const validationDiv = document.getElementById(`${MOD_ID}-validation`);
    if (validationDiv) {
        validationDiv.textContent = message;
        validationDiv.style.display = 'block';
    }
}

// Hide validation message
function hideValidationMessage() {
    const validationDiv = document.getElementById(`${MOD_ID}-validation`);
    if (validationDiv) {
        validationDiv.style.display = 'none';
    }
}

// ============================================================================
// 11. AUTOMATION CONTROL
// ============================================================================

// Load automation state
function loadAutomationState() {
    const saved = localStorage.getItem(`${MOD_ID}AutomationEnabled`);
    if (saved !== null) {
        try {
            isAutomationEnabled = JSON.parse(saved);
            console.log('[Stamina Optimizer] Loaded automation state:', isAutomationEnabled);
        } catch (error) {
            console.error('[Stamina Optimizer] Error parsing automation state:', error);
            isAutomationEnabled = AUTOMATION_DISABLED;
        }
    }
}

// Save automation state
function saveAutomationState() {
    localStorage.setItem(`${MOD_ID}AutomationEnabled`, JSON.stringify(isAutomationEnabled));
    console.log('[Stamina Optimizer] Automation state saved');
}

// Toggle automation
function toggleAutomation() {
    isAutomationEnabled = isAutomationEnabled === AUTOMATION_DISABLED ? AUTOMATION_ENABLED : AUTOMATION_DISABLED;
    saveAutomationState();
    updateButton();
    
    // Update coordination system state
    if (window.ModCoordination) {
        window.ModCoordination.updateModState('Stamina Optimizer', { enabled: isAutomationEnabled });
    }
    
    if (isAutomationEnabled) {
        console.log('[Stamina Optimizer] Automation enabled');
        startStaminaMonitoring();
        startAutoplayStateMonitoring();
        setupBestiaryRefillMonitoring();
    } else {
        console.log('[Stamina Optimizer] Automation disabled');
        stopStaminaMonitoring();
        stopAutoplayStateMonitoring();
        
        // Update coordination system state
        if (window.ModCoordination) {
            window.ModCoordination.updateModState('Stamina Optimizer', { active: false });
        }
        
        // Stop autoplay if we initiated it
        if (isCurrentlyActive && wasInitiatedByMod) {
            stopAutoplay();
        }
        
        // Clean up refill monitoring
        if (window.staminaOptimizerRefillInterval) {
            clearInterval(window.staminaOptimizerRefillInterval);
            window.staminaOptimizerRefillInterval = null;
        }
    }
}

// ============================================================================
// 12. INITIALIZATION
// ============================================================================

function init() {
    if (!api || !api.ui) {
        console.error('[Stamina Optimizer] API not available, cannot initialize');
        return;
    }
    loadAutomationState();
    createButton();
    if (isAutomationEnabled) {
        startStaminaMonitoring();
        startAutoplayStateMonitoring();
        setupBestiaryRefillMonitoring();
    }
    
    console.log('[Stamina Optimizer] Initialized - waiting for allModsLoaded signal');
    
    // Fallback: if allModsLoaded signal is never received, set grace period after max wait time
    const fallbackTimeout = setTimeout(() => {
        if (!allModsLoaded) {
            console.warn('[Stamina Optimizer] allModsLoaded signal not received after timeout - setting grace period anyway');
            allModsLoaded = true;
            gracePeriodEndTime = Date.now() + MODS_LOADING_GRACE_PERIOD;
            console.log(`[Stamina Optimizer] Grace period started (fallback) - will wait ${MODS_LOADING_GRACE_PERIOD / 1000}s before allowing actions`);
            
            const gracePeriodTimeout = setTimeout(() => {
                console.log('[Stamina Optimizer] Grace period ended - now allowing actions');
                const index = otherTimeouts.indexOf(gracePeriodTimeout);
                if (index > -1) otherTimeouts.splice(index, 1);
            }, MODS_LOADING_GRACE_PERIOD);
            otherTimeouts.push(gracePeriodTimeout);
        }
        const index = otherTimeouts.indexOf(fallbackTimeout);
        if (index > -1) otherTimeouts.splice(index, 1);
    }, MAX_WAIT_FOR_SIGNAL);
    otherTimeouts.push(fallbackTimeout);
}

// Start automation after all mods are loaded
function startAutomation() {
    console.log('[Stamina Optimizer] Starting automation after allModsLoaded signal');
    if (isAutomationEnabled) {
        updateButton();
    }
}

// Listen for allModsLoaded signal
let windowMessageHandler = (event) => {
    if (event.source !== window) return;
    if (event.data?.from === 'LOCAL_MODS_LOADER' && event.data?.action === 'allModsLoaded') {
        console.log('[Stamina Optimizer] Received allModsLoaded signal');
        allModsLoaded = true;
        
        // Set grace period end time to allow other mods to initialize
        gracePeriodEndTime = Date.now() + MODS_LOADING_GRACE_PERIOD;
        console.log(`[Stamina Optimizer] Grace period started - will wait ${MODS_LOADING_GRACE_PERIOD / 1000}s before allowing actions`);
        
        const timeout = setTimeout(() => {
            startAutomation();
            const index = otherTimeouts.indexOf(timeout);
            if (index > -1) otherTimeouts.splice(index, 1);
        }, 1500);
        otherTimeouts.push(timeout);
        
        // Log when grace period ends
        const gracePeriodTimeout = setTimeout(() => {
            console.log('[Stamina Optimizer] ✅ Grace period ended - ready for actions');
            const index = otherTimeouts.indexOf(gracePeriodTimeout);
            if (index > -1) otherTimeouts.splice(index, 1);
        }, MODS_LOADING_GRACE_PERIOD);
        otherTimeouts.push(gracePeriodTimeout);
    }
};
window.addEventListener('message', windowMessageHandler);

// Run initialization
init();

// ============================================================================
// 13. CLEANUP & EXPORTS
// ============================================================================

// Cleanup function
function cleanupStaminaOptimizer() {
    try {
        stopStaminaMonitoring();
        stopAutoplayStateMonitoring();
        stateFlagTimeouts.forEach(timeout => clearTimeout(timeout));
        stateFlagTimeouts = [];
        modalTimeouts.forEach(timeout => clearTimeout(timeout));
        modalTimeouts = [];
        otherTimeouts.forEach(timeout => clearTimeout(timeout));
        otherTimeouts = [];
        if (autoplayStopCheckTimeout) {
            clearTimeout(autoplayStopCheckTimeout);
            autoplayStopCheckTimeout = null;
        }
        if (isCurrentlyActive && wasInitiatedByMod) {
            stopAutoplay();
        }
        if (window.staminaOptimizerRefillInterval) {
            clearInterval(window.staminaOptimizerRefillInterval);
            window.staminaOptimizerRefillInterval = null;
        }
        cleanupModal();
        if (windowMessageHandler) {
            window.removeEventListener('message', windowMessageHandler);
            windowMessageHandler = null;
        }
        
        // Unregister from coordination system
        if (window.ModCoordination) {
            window.ModCoordination.unregisterMod('Stamina Optimizer');
        }
        
        delete window.__staminaOptimizerLoaded;
        delete window.staminaOptimizerLastBoostedMapsTrigger;
        delete window.staminaOptimizerIsActive;
        delete window.staminaOptimizerAutoSaveIndicator;
        if (api && api.ui && api.ui.removeButton) {
            api.ui.removeButton(BUTTON_ID);
        }
        
        console.log('[Stamina Optimizer] Cleanup completed');
    } catch (error) {
        console.error('[Stamina Optimizer] Error during cleanup:', error);
    }
}

// Export functionality
if (typeof context !== 'undefined') {
    context.exports = {
        cleanup: cleanupStaminaOptimizer,
        isCurrentlyActive: () => isCurrentlyActive,
        updateConfig: (newConfig) => {
            console.log('[Stamina Optimizer] Config update received:', newConfig);
        }
    };
}

window.staminaOptimizerIsActive = () => isCurrentlyActive;

// Check if Stamina Optimizer would block starting autoplay (stamina is low)
// modName: Name of the mod requesting autoplay (optional) - only blocks if mod is in configured actions
window.staminaOptimizerWouldBlock = (modName = null) => {
    if (!isAutomationEnabled) {
        return false; // Not enabled, won't block
    }
    
    try {
        const settings = loadSettings();
        const actions = settings.actions || DEFAULT_ACTIONS;
        
        // Map mod names to action values
        const modToActionMap = {
            'Raid Hunter': 'raid-hunter',
            'Better Tasker': 'better-tasker',
            'Better Boosted Maps': 'boosted-maps'
        };
        
        // If modName is provided, check if it's in the configured actions
        if (modName) {
            const actionValue = modToActionMap[modName];
            if (actionValue && !actions.includes(actionValue)) {
                // Mod is not in configured actions - don't block
                return false;
            }
        }
        
        const minStamina = settings.minStamina || DEFAULT_MIN_STAMINA;
        const currentStamina = getCurrentStamina();
        
        // Block if stamina is below minimum threshold (would want to stop autoplay)
        if (currentStamina < minStamina) {
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('[Stamina Optimizer] Error checking if would block:', error);
        return false; // Don't block on error
    }
};
