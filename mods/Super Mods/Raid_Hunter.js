// Raid Hunter Mod for Bestiary Arena
console.log('[Raid Hunter] initializing...');

// ============================================================================
// 1. CONSTANTS
// ============================================================================

const MOD_ID = 'raid-hunter';
const RAID_CLOCK_ID = `${MOD_ID}-raid-clock`;

// Default settings constants
const DEFAULT_RAID_START_DELAY = 3; // Default delay in seconds

// Automation state constants
const AUTOMATION_ENABLED = true;
const AUTOMATION_DISABLED = false;

// Helper function for automation state checks
function isAutomationActive() {
    return isAutomationEnabled === AUTOMATION_ENABLED;
}

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

// Event to room ID mapping
const EVENT_TO_ROOM_MAPPING = {
    'Rat Plague': 'rkswrs',
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
// 2. STATE MANAGEMENT
// ============================================================================

// Quest Button Manager (shared with Better Tasker)
window.QuestButtonManager = window.QuestButtonManager || {
    currentOwner: null,
    originalState: null,
    validationInterval: null,
    
    // Request control of quest button (returns true if successful)
    requestControl(modName) {
        if (this.currentOwner === null || this.currentOwner === modName) {
            this.currentOwner = modName;
            console.log(`[Quest Button Manager] Control granted to ${modName}`);
            return true;
        }
        console.log(`[Quest Button Manager] Control denied to ${modName} (currently owned by ${this.currentOwner})`);
        return false;
    },
    
    // Release control of quest button
    releaseControl(modName) {
        if (this.currentOwner === modName) {
            this.currentOwner = null;
            console.log(`[Quest Button Manager] Control released by ${modName}`);
            return true;
        }
        return false;
    },
    
    // Check if mod has control
    hasControl(modName) {
        return this.currentOwner === modName;
    },
    
    // Get current owner
    getCurrentOwner() {
        return this.currentOwner;
    }
};

// Bestiary Automator Settings Manager (shared with Better Tasker)
window.BestiaryAutomatorSettingsManager = window.BestiaryAutomatorSettingsManager || {
    currentOwner: null,
    
    // Request control of Bestiary Automator settings (returns true if successful)
    requestControl(modName) {
        if (this.currentOwner === null || this.currentOwner === modName) {
            this.currentOwner = modName;
            console.log(`[Bestiary Automator Settings Manager] Control granted to ${modName}`);
            return true;
        }
        console.log(`[Bestiary Automator Settings Manager] Control denied to ${modName} (currently owned by ${this.currentOwner})`);
        return false;
    },
    
    // Release control of Bestiary Automator settings
    releaseControl(modName) {
        if (this.currentOwner === modName) {
            this.currentOwner = null;
            console.log(`[Bestiary Automator Settings Manager] Control released by ${modName}`);
            return true;
        }
        return false;
    },
    
    // Check if mod has control
    hasControl(modName) {
        return this.currentOwner === modName;
    },
    
    // Get current owner
    getCurrentOwner() {
        return this.currentOwner;
    }
};

let raidUnsubscribe = null;
let raidListMonitor = null;
let lastRaidTime = 0;
let raidClockInterval = null;
let questLogMonitorInterval = null;
let raidCountdownEndTime = null;
let bodyObserver = null;
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
let maxRetryAttempts = 3;
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

// Debug function to check state manager status
function debugStateManager() {
    console.log(`[Raid Hunter] State Manager - isInitializing: ${stateManager.isInitializing}, isProcessing: ${stateManager.isProcessing}`);
}

// Board Analyzer coordination
let boardAnalyzerCoordinationInterval = null;
let isBoardAnalyzerRunning = false;

// Toast detection for fight icon (now consolidated with quest log observer)

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
    console.log('[Raid Hunter] executeImmediately() - executing without state manager');
    try {
        fn();
        console.log('[Raid Hunter] executeImmediately() - execution completed');
    } catch (error) {
        console.error('[Raid Hunter] executeImmediately() - error during execution:', error);
    }
}

// Check if an element is a raid toast (looks for fight icon like Bestiary Automator's defeat toast detection)
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

// Keep the old function name for backward compatibility but redirect to new function
function isFightToast(element) {
    return isRaidToast(element);
}

// Check if Better Tasker is currently processing task completion
function isBetterTaskerProcessingTask() {
    try {
        // Check if Better Tasker is currently processing a task
        // We need to check the global scope for Better Tasker's state variables
        if (typeof window !== 'undefined' && window.betterTaskerState) {
            const taskerState = window.betterTaskerState;
            return taskerState.taskInProgress || taskerState.taskHuntingOngoing || taskerState.pendingTaskCompletion;
        }
        
        // Fallback: Check if Better Tasker mod is loaded and has task processing flags
        // This is a more defensive approach that doesn't rely on exposed state
        const taskerMod = document.querySelector(`#${'better-tasker'}-settings-button`)?.closest('.frame-1');
        if (taskerMod) {
            // Check if the toggle button shows "Tasking" state (indicates task processing)
            const toggleButton = taskerMod.querySelector('button');
            if (toggleButton && toggleButton.textContent.includes('Tasking')) {
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('[Raid Hunter] Error checking Better Tasker state:', error);
        return false;
    }
}

// Handle fight toast detection
function handleFightToast() {
    console.log('[Raid Hunter] handleFightToast() called');
    debugStateManager();
    
    // Check if Board Analyzer is running - if so, skip processing
    if (isBoardAnalyzerRunning) {
        console.log('[Raid Hunter] Fight toast detected but Board Analyzer is running - skipping');
        return;
    }
    
    if (!isAutomationActive()) {
        console.log('[Raid Hunter] Fight toast detected but automation is disabled');
        return;
    }
    
    console.log('[Raid Hunter] Fight toast detected - checking for raids...');
    
    // Check for existing raids and process them (use immediate execution to avoid state manager conflicts)
    executeImmediately(() => {
        console.log('[Raid Hunter] Inside executeImmediately - Calling updateRaidState()...');
        updateRaidState();
        
        console.log(`[Raid Hunter] After updateRaidState - raidQueue.length: ${raidQueue.length}, isCurrentlyRaiding: ${isCurrentlyRaiding}`);
        
        if (raidQueue.length > 0 && !isCurrentlyRaiding) {
            console.log('[Raid Hunter] Fight toast detected - processing next raid');
            
            // Apply raid start delay if configured
            const settings = loadSettings();
            const raidStartDelay = settings.raidDelay || DEFAULT_RAID_START_DELAY;
            
            if (raidStartDelay > 0) {
                console.log(`[Raid Hunter] Applying raid start delay: ${raidStartDelay} seconds`);
                
                setTimeout(() => {
                    // Check if automation is still enabled after delay and Board Analyzer is not running
                    if (isAutomationEnabled === AUTOMATION_ENABLED && !isBoardAnalyzerRunning && raidQueue.length > 0 && !isCurrentlyRaiding) {
                        console.log('[Raid Hunter] Raid start delay completed - processing raid');
                        processNextRaid();
                    } else if (isAutomationEnabled === AUTOMATION_DISABLED) {
                        console.log('[Raid Hunter] Automation disabled during fight toast delay');
                    } else if (isBoardAnalyzerRunning) {
                        console.log('[Raid Hunter] Board Analyzer running during fight toast delay - skipping');
                    } else {
                        console.log(`[Raid Hunter] Raid start delay completed but conditions not met - raidQueue.length: ${raidQueue.length}, isCurrentlyRaiding: ${isCurrentlyRaiding}`);
                    }
                }, raidStartDelay * 1000);
            } else {
                // No delay, process immediately
                console.log('[Raid Hunter] No delay - processing raid immediately');
                processNextRaid();
            }
        } else if (isCurrentlyRaiding) {
            console.log('[Raid Hunter] Fight toast detected but already raiding');
        } else {
            console.log('[Raid Hunter] Fight toast detected but no raids in queue');
            
            // If no raids are available, check if Better Tasker is processing a task
            // If so, don't interfere with task completion
            if (isBetterTaskerProcessingTask()) {
                console.log('[Raid Hunter] No raids available but Better Tasker is processing task - not interfering');
                return;
            }
        }
    });
}

// Board Analyzer coordination - pause Raid Hunter monitoring during Board Analyzer runs
function handleBoardAnalyzerCoordination() {
    try {
        if (!window.__modCoordination) return;
        
        const boardAnalyzerRunning = window.__modCoordination.boardAnalyzerRunning;
        
        if (boardAnalyzerRunning && !isBoardAnalyzerRunning) {
            // Board Analyzer started - pause Raid Hunter monitoring
            console.log('[Raid Hunter] Board Analyzer started - pausing monitoring');
            isBoardAnalyzerRunning = true;
            pauseRaidHunterMonitoring();
        } else if (!boardAnalyzerRunning && isBoardAnalyzerRunning) {
            // Board Analyzer finished - resume Raid Hunter monitoring
            console.log('[Raid Hunter] Board Analyzer finished - resuming monitoring');
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
        
        // Pause body observer for fight toast detection to prevent interference
        if (bodyObserver) {
            bodyObserver.disconnect();
            bodyObserver = null;
        }
        
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
        if (isAutomationEnabled === AUTOMATION_ENABLED) {
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
                }, 2000); // Reduced frequency since we have MutationObserver
            }
            
            console.log('[Raid Hunter] All monitoring resumed after Board Analyzer');
        } else {
            console.log('[Raid Hunter] Automation disabled - skipping resume');
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
        if (bodyObserver) {
            bodyObserver.disconnect();
            bodyObserver = null;
        }
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
            statusText = `Raiding: ${currentRaidInfo?.name || 'Unknown'}`;
        } else if (enabledMaps.length === 0) {
            statusText = 'No raid maps enabled - check settings';
        } else if (isRaidActive) {
            statusText = `${currentList.length} raid(s) available`;
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
            // Add available raids to queue using API data
            currentRaidList.forEach(raid => {
                const raidName = getEventNameForRoomId(raid.roomId);
                console.log(`[Raid Hunter] Checking raid: ${raidName} (roomId: ${raid.roomId})`);
                console.log(`[Raid Hunter] Is ${raidName} in enabledMaps? ${enabledMaps.includes(raidName)}`);
                
                if (enabledMaps.includes(raidName)) {
                    raidQueue.push({
                        name: raidName,
                        roomId: raid.roomId,
                        button: null // No UI button needed for API access
                    });
                    // Only log if we're not already raiding this specific raid
                    if (!isCurrentlyRaiding || currentRaidInfo?.roomId !== raid.roomId) {
                        console.log(`[Raid Hunter] Added ${raidName} to queue via API`);
                    }
                } else {
                    console.log(`[Raid Hunter] Skipped ${raidName} - not in enabled maps`);
                }
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
        const escEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(escEvent);
        console.log('[Raid Hunter] Sent ESC key to close modals');
        
        // Small delay to let modals close
        return new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
        console.error('[Raid Hunter] Error closing modals:', error);
        return Promise.resolve();
    }
}

// Process next raid in queue
function processNextRaid() {
    if (isCurrentlyRaiding || raidQueue.length === 0) {
        return;
    }
    
    // Check if Board Analyzer is running - if so, skip processing
    if (isBoardAnalyzerRunning) {
        console.log('[Raid Hunter] Board Analyzer is running - skipping raid processing');
        return;
    }
    
    // Check if automation is still enabled before starting
    if (!isAutomationActive()) {
        console.log('[Raid Hunter] Automation disabled - stopping raid processing');
        return;
    }
    
    // Get next raid from queue
    const nextRaid = raidQueue.shift();
    if (!nextRaid) {
        return;
    }
    
    // Double-check that this raid is still enabled (safety check)
    const settings = loadSettings();
    const enabledMaps = settings.enabledRaidMaps || [];
    if (!enabledMaps.includes(nextRaid.name)) {
        console.log(`[Raid Hunter] Safety check failed - ${nextRaid.name} is no longer enabled, skipping`);
        return;
    }
    
    console.log(`[Raid Hunter] Starting next raid: ${nextRaid.name}`);
    currentRaidInfo = nextRaid;
    isCurrentlyRaiding = true;
    raidRetryCount = 0; // Reset retry count for new raid
    
    // Modify quest button appearance to show raiding state
    modifyQuestButtonForRaiding();
    
    // Start monitoring quest button validation
    startQuestButtonValidation();
    
    // Close any open modals first, then start the raid
    closeOpenModals().then(() => {
        // Double-check automation is still enabled before proceeding
        if (isAutomationEnabled === AUTOMATION_DISABLED) {
            console.log('[Raid Hunter] Automation disabled during modal close - stopping raid');
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
// 3. UI FUNCTIONS
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
            console.log('[Raid Hunter] Quest Log header verification failed - not the actual Quest Log, skipping raid clock creation');
            return false; // Not the actual Quest Log, abort
        }
        
        console.log('[Raid Hunter] Quest Log verified! Creating raid clock...');
        createRaidClock();
        return true;
    }
    
    return false;
}

// Creates the raid clock widget.
function createRaidClock() {
    console.log('[Raid Hunter] createRaidClock: Starting raid clock creation...');
    
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
                        Disabled
                    </button>
                    <button class="focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-blue active:frame-pressed-1-blue surface-blue gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 flex-1 text-whiteHighlight" id="raid-hunter-settings-btn">
                        Settings
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

// Consolidated mutation processing for both quest log and fight toast detection
function debouncedProcessAllMutations(mutations) {
    safeExecute(() => {
        let hasQuestLogContent = false;
        let hasFightToast = false;
        
        // Process all mutations in one pass
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check for quest log content
                        if (!hasQuestLogContent && !document.getElementById(RAID_CLOCK_ID)) {
                            hasQuestLogContent = checkForQuestLogContent(node);
                        }
                        
                        // Check for raid toast
                        if (!hasFightToast && isAutomationActive()) {
                            hasFightToast = isRaidToast(node);
                        }
                    }
                }
            }
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
        
        // Handle raid toast detection
        if (hasFightToast) {
            console.log('[Raid Hunter] Raid toast detected!');
            handleFightToast();
        }
    });
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
    
    // Consolidated MutationObserver for both quest log and fight toast detection
    questLogObserver = new MutationObserver(debouncedProcessAllMutations);
    
    questLogObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('[Raid Hunter] Consolidated MutationObserver set up for quest log and raid toast detection');
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
    }, 5000); // Reduced from 2s to 5s - MutationObserver handles real-time detection
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
                timerElement.style.color = '#ffffff';
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
                timerElement.style.color = '#ff6b6b'; // Red for < 1 minute
            } else if (msRemaining < 300000) {
                timerElement.style.color = '#ffd93d'; // Yellow for < 5 minutes
            } else {
                timerElement.style.color = '#ffffff'; // White for normal
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
        timerElement.style.color = '#ff6b6b';
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
    raidClockInterval = setInterval(updateRaidClock, 1000);
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
// 4. UTILITY FUNCTIONS
// ============================================================================

// Check if we can start the raid (stamina/raid availability)
async function checkStamina() {
    // Look for disabled Start button - if disabled, we either don't have enough stamina or raid is inactive
    const startButton = findButtonByText('Start');
    if (!startButton || startButton.disabled) {
        console.log('[Raid Hunter] Start button not found or disabled - insufficient stamina or raid inactive');
        return {
            hasEnough: false
        };
    }
    
    console.log('[Raid Hunter] Start button enabled - can start raid');
    return {
        hasEnough: true
    };
}

// Handle insufficient stamina gracefully
function handleInsufficientStamina() {
    console.log('[Raid Hunter] Insufficient stamina detected');
    console.log('[Raid Hunter] Starting 3-minute stamina monitoring...');
    
    // Reset raid state
    isCurrentlyRaiding = false;
    currentRaidInfo = null;
    
    // Start continuous stamina monitoring every 3 minutes
    startStaminaMonitoring();
    
    // Update status
    // Status messages removed - only countdown clock shown
}

// Start continuous stamina monitoring every 3 minutes
function startStaminaMonitoring() {
    // Clear any existing stamina monitoring
    if (window.staminaMonitorInterval) {
        clearInterval(window.staminaMonitorInterval);
    }
    
    console.log('[Raid Hunter] Starting stamina monitoring - checking every 30 seconds');
    
    // Check stamina every 30 seconds
    window.staminaMonitorInterval = setInterval(async () => {
        try {
            console.log('[Raid Hunter] Checking stamina...');
            const staminaCheck = await checkStamina();
            
            if (staminaCheck.hasEnough) {
                console.log('[Raid Hunter] Stamina available! - Checking for raids...');
                clearInterval(window.staminaMonitorInterval);
                window.staminaMonitorInterval = null;
                
                // Check if there are active raids to continue with
                const raidState = globalThis.state.raids.getSnapshot();
                const currentRaidList = raidState.context.list || [];
                
                if (currentRaidList.length > 0) {
                    console.log('[Raid Hunter] Active raids found - resuming automation');
                    updateRaidState();
                    checkForExistingRaids();
                } else {
                    console.log('[Raid Hunter] No active raids - waiting for new raids');
                }
            } else {
                console.log('[Raid Hunter] Still waiting for stamina');
            }
        } catch (error) {
            console.error('[Raid Hunter] Error during stamina monitoring:', error);
        }
    }, 30 * 1000); // Every 30 seconds
}

// Stop stamina monitoring
function stopStaminaMonitoring() {
    if (window.staminaMonitorInterval) {
        clearInterval(window.staminaMonitorInterval);
        window.staminaMonitorInterval = null;
        console.log('[Raid Hunter] Stamina monitoring stopped');
    }
}

// Enable Bestiary Automator's autorefill stamina setting
function enableBestiaryAutomatorStaminaRefill() {
    try {
        // Request control of Bestiary Automator settings
        if (!window.BestiaryAutomatorSettingsManager.requestControl('Raid Hunter')) {
            console.log('[Raid Hunter] Cannot control Bestiary Automator settings - controlled by another mod');
            return false;
        }
        
        // Try multiple ways to access Bestiary Automator
        let bestiaryAutomator = null;
        
        // Method 1: Check if Bestiary Automator is available in global scope
        if (window.bestiaryAutomator && window.bestiaryAutomator.updateConfig) {
            bestiaryAutomator = window.bestiaryAutomator;
            console.log('[Raid Hunter] Found Bestiary Automator via global window object');
        }
        // Method 2: Check if it's available in context exports
        else if (typeof context !== 'undefined' && context.exports && context.exports.updateConfig) {
            bestiaryAutomator = context.exports;
            console.log('[Raid Hunter] Found Bestiary Automator via context exports');
        }
        // Method 3: Try to find it in the mod loader's context
        else if (window.modLoader && window.modLoader.getModContext) {
            const automatorContext = window.modLoader.getModContext('bestiary-automator');
            if (automatorContext && automatorContext.exports && automatorContext.exports.updateConfig) {
                bestiaryAutomator = automatorContext.exports;
                console.log('[Raid Hunter] Found Bestiary Automator via mod loader');
            }
        }
        
        if (bestiaryAutomator) {
            console.log('[Raid Hunter] Enabling Bestiary Automator autorefill stamina...');
            bestiaryAutomator.updateConfig({
                autoRefillStamina: true
            });
            console.log('[Raid Hunter] Bestiary Automator autorefill stamina enabled');
            
            // Additional verification for Chrome - check if the setting actually took effect
            setTimeout(() => {
                if (window.bestiaryAutomator && window.bestiaryAutomator.config) {
                    console.log('[Raid Hunter] Verifying stamina refill setting:', window.bestiaryAutomator.config.autoRefillStamina);
                }
            }, 1000);
            
            return true;
        } else {
            console.log('[Raid Hunter] Bestiary Automator not available for autorefill stamina');
            // Try again in 2 seconds
            setTimeout(() => {
                // Retry the same methods
                let retryAutomator = null;
                
                if (window.bestiaryAutomator && window.bestiaryAutomator.updateConfig) {
                    retryAutomator = window.bestiaryAutomator;
                } else if (typeof context !== 'undefined' && context.exports && context.exports.updateConfig) {
                    retryAutomator = context.exports;
                } else if (window.modLoader && window.modLoader.getModContext) {
                    const automatorContext = window.modLoader.getModContext('bestiary-automator');
                    if (automatorContext && automatorContext.exports && automatorContext.exports.updateConfig) {
                        retryAutomator = automatorContext.exports;
                    }
                }
                
                if (retryAutomator) {
                    console.log('[Raid Hunter] Retrying Bestiary Automator autorefill stamina...');
                    retryAutomator.updateConfig({
                        autoRefillStamina: true
                    });
                    console.log('[Raid Hunter] Bestiary Automator autorefill stamina enabled (retry)');
                    
                    // Additional verification for Chrome - check if the setting actually took effect
                    setTimeout(() => {
                        if (window.bestiaryAutomator && window.bestiaryAutomator.config) {
                            console.log('[Raid Hunter] Verifying stamina refill setting (retry):', window.bestiaryAutomator.config.autoRefillStamina);
                        }
                    }, 1000);
                } else {
                    console.log('[Raid Hunter] Bestiary Automator still not available - you may need to enable autorefill stamina manually');
                }
            }, 2000);
            return false;
        }
    } catch (error) {
        console.error('[Raid Hunter] Error enabling Bestiary Automator autorefill stamina:', error);
        window.BestiaryAutomatorSettingsManager.releaseControl('Raid Hunter');
        return false;
    }
}

// Disable Bestiary Automator's autorefill stamina setting
function disableBestiaryAutomatorStaminaRefill() {
    try {
        // Only disable if we have control
        if (!window.BestiaryAutomatorSettingsManager.hasControl('Raid Hunter')) {
            console.log('[Raid Hunter] Cannot disable Bestiary Automator settings - not controlled by Raid Hunter');
            return false;
        }
        
        // Try multiple ways to access Bestiary Automator
        let bestiaryAutomator = null;
        
        // Method 1: Check if Bestiary Automator is available in global scope
        if (window.bestiaryAutomator && window.bestiaryAutomator.updateConfig) {
            bestiaryAutomator = window.bestiaryAutomator;
        }
        // Method 2: Check if it's available in context exports
        else if (typeof context !== 'undefined' && context.exports && context.exports.updateConfig) {
            bestiaryAutomator = context.exports;
        }
        // Method 3: Try to find it in the mod loader's context
        else if (window.modLoader && window.modLoader.getModContext) {
            const automatorContext = window.modLoader.getModContext('bestiary-automator');
            if (automatorContext && automatorContext.exports && automatorContext.exports.updateConfig) {
                bestiaryAutomator = automatorContext.exports;
            }
        }
        
        if (bestiaryAutomator) {
            console.log('[Raid Hunter] Disabling Bestiary Automator autorefill stamina...');
            bestiaryAutomator.updateConfig({
                autoRefillStamina: false
            });
            console.log('[Raid Hunter] Bestiary Automator autorefill stamina disabled');
            // Release control after disabling
            window.BestiaryAutomatorSettingsManager.releaseControl('Raid Hunter');
            return true;
        } else {
            console.log('[Raid Hunter] Bestiary Automator not available for autorefill stamina');
            window.BestiaryAutomatorSettingsManager.releaseControl('Raid Hunter');
            return false;
        }
    } catch (error) {
        console.error('[Raid Hunter] Error disabling Bestiary Automator autorefill stamina:', error);
        window.BestiaryAutomatorSettingsManager.releaseControl('Raid Hunter');
        return false;
    }
}

// Enable Bestiary Automator's faster autoplay setting
function enableBestiaryAutomatorFasterAutoplay() {
    try {
        // Request control of Bestiary Automator settings
        if (!window.BestiaryAutomatorSettingsManager.requestControl('Raid Hunter')) {
            console.log('[Raid Hunter] Cannot control Bestiary Automator settings - controlled by another mod');
            return false;
        }
        
        // Try multiple ways to access Bestiary Automator
        let bestiaryAutomator = null;
        
        // Method 1: Check if Bestiary Automator is available in global scope
        if (window.bestiaryAutomator && window.bestiaryAutomator.updateConfig) {
            bestiaryAutomator = window.bestiaryAutomator;
            console.log('[Raid Hunter] Found Bestiary Automator via global window object');
        }
        // Method 2: Check if it's available in context exports
        else if (typeof context !== 'undefined' && context.exports && context.exports.updateConfig) {
            bestiaryAutomator = context.exports;
            console.log('[Raid Hunter] Found Bestiary Automator via context exports');
        }
        // Method 3: Try to find it in the mod loader's context
        else if (window.modLoader && window.modLoader.getModContext) {
            const automatorContext = window.modLoader.getModContext('bestiary-automator');
            if (automatorContext && automatorContext.exports && automatorContext.exports.updateConfig) {
                bestiaryAutomator = automatorContext.exports;
                console.log('[Raid Hunter] Found Bestiary Automator via mod loader');
            }
        }
        
        if (bestiaryAutomator) {
            console.log('[Raid Hunter] Enabling Bestiary Automator faster autoplay...');
            bestiaryAutomator.updateConfig({
                fasterAutoplay: true
            });
            console.log('[Raid Hunter] Bestiary Automator faster autoplay enabled');
            
            // Additional verification for Chrome - check if the setting actually took effect
            setTimeout(() => {
                if (window.bestiaryAutomator && window.bestiaryAutomator.config) {
                    console.log('[Raid Hunter] Verifying faster autoplay setting:', window.bestiaryAutomator.config.fasterAutoplay);
                }
            }, 1000);
            
            return true;
        } else {
            console.log('[Raid Hunter] Bestiary Automator not available for faster autoplay');
            // Try again in 2 seconds
            setTimeout(() => {
                // Retry the same methods
                let retryAutomator = null;
                
                if (window.bestiaryAutomator && window.bestiaryAutomator.updateConfig) {
                    retryAutomator = window.bestiaryAutomator;
                } else if (typeof context !== 'undefined' && context.exports && context.exports.updateConfig) {
                    retryAutomator = context.exports;
                } else if (window.modLoader && window.modLoader.getModContext) {
                    const automatorContext = window.modLoader.getModContext('bestiary-automator');
                    if (automatorContext && automatorContext.exports && automatorContext.exports.updateConfig) {
                        retryAutomator = automatorContext.exports;
                    }
                }
                
                if (retryAutomator) {
                    console.log('[Raid Hunter] Retrying Bestiary Automator faster autoplay...');
                    retryAutomator.updateConfig({
                        fasterAutoplay: true
                    });
                    console.log('[Raid Hunter] Bestiary Automator faster autoplay enabled (retry)');
                    
                    // Additional verification for Chrome - check if the setting actually took effect
                    setTimeout(() => {
                        if (window.bestiaryAutomator && window.bestiaryAutomator.config) {
                            console.log('[Raid Hunter] Verifying faster autoplay setting (retry):', window.bestiaryAutomator.config.fasterAutoplay);
                        }
                    }, 1000);
                } else {
                    console.log('[Raid Hunter] Bestiary Automator still not available - you may need to enable faster autoplay manually');
                }
            }, 2000);
            return false;
        }
    } catch (error) {
        console.error('[Raid Hunter] Error enabling Bestiary Automator faster autoplay:', error);
        window.BestiaryAutomatorSettingsManager.releaseControl('Raid Hunter');
        return false;
    }
}

// Disable Bestiary Automator's faster autoplay setting
function disableBestiaryAutomatorFasterAutoplay() {
    try {
        // Only disable if we have control
        if (!window.BestiaryAutomatorSettingsManager.hasControl('Raid Hunter')) {
            console.log('[Raid Hunter] Cannot disable Bestiary Automator settings - not controlled by Raid Hunter');
            return false;
        }
        
        // Try multiple ways to access Bestiary Automator
        let bestiaryAutomator = null;
        
        // Method 1: Check if Bestiary Automator is available in global scope
        if (window.bestiaryAutomator && window.bestiaryAutomator.updateConfig) {
            bestiaryAutomator = window.bestiaryAutomator;
        }
        // Method 2: Check if it's available in context exports
        else if (typeof context !== 'undefined' && context.exports && context.exports.updateConfig) {
            bestiaryAutomator = context.exports;
        }
        // Method 3: Try to find it in the mod loader's context
        else if (window.modLoader && window.modLoader.getModContext) {
            const automatorContext = window.modLoader.getModContext('bestiary-automator');
            if (automatorContext && automatorContext.exports && automatorContext.exports.updateConfig) {
                bestiaryAutomator = automatorContext.exports;
            }
        }
        
        if (bestiaryAutomator) {
            console.log('[Raid Hunter] Disabling Bestiary Automator faster autoplay...');
            bestiaryAutomator.updateConfig({
                fasterAutoplay: false
            });
            console.log('[Raid Hunter] Bestiary Automator faster autoplay disabled');
            // Release control after disabling
            window.BestiaryAutomatorSettingsManager.releaseControl('Raid Hunter');
            return true;
        } else {
            console.log('[Raid Hunter] Bestiary Automator not available for faster autoplay');
            window.BestiaryAutomatorSettingsManager.releaseControl('Raid Hunter');
            return false;
        }
    } catch (error) {
        console.error('[Raid Hunter] Error disabling Bestiary Automator faster autoplay:', error);
        window.BestiaryAutomatorSettingsManager.releaseControl('Raid Hunter');
        return false;
    }
}

// Checks element visibility.
function isElementVisible(el) {
    if (!el || el.disabled) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

// Gets room ID for event.
function getRoomIdForEvent(eventName) {
    return EVENT_TO_ROOM_MAPPING[eventName] || null;
}

// Gets event name for room ID (reverse lookup)
function getEventNameForRoomId(roomId) {
    for (const [eventName, mappedRoomId] of Object.entries(EVENT_TO_ROOM_MAPPING)) {
        if (mappedRoomId === roomId) {
            return eventName;
        }
    }
    return `Unknown (${roomId})`;
}

// Finds button by text content - supports both English and Portuguese
function findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll('button'));
    
    // Define text mappings for different languages
    const textMappings = {
        'Auto-setup': ['Auto-setup', 'Autoconfigurar'],
        'Start': ['Start', 'Iniciar'],
        'Close': ['Close', 'Fechar']
    };
    
    // Get the list of possible texts for the given text key
    const possibleTexts = textMappings[text] || [text];
    
    return buttons.find(button => {
        const buttonText = button.textContent.trim();
        return possibleTexts.includes(buttonText) && isElementVisible(button);
    }) || null;
}

// ============================================================================
// 5. AUTOMATION CONTROL FUNCTIONS
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
        console.log('[Raid Hunter] No saved automation state, using default (disabled)');
    }
}

// Saves automation state to localStorage
function saveAutomationState() {
    localStorage.setItem('raidHunterAutomationEnabled', JSON.stringify(isAutomationEnabled));
    console.log('[Raid Hunter] Saved automation state to localStorage:', isAutomationEnabled);
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
                // Check if automation is still enabled after delay
                if (isAutomationEnabled === AUTOMATION_ENABLED) {
                    console.log('[Raid Hunter] Raid start delay completed - checking for raids');
                    checkForExistingRaids();
                } else {
                    console.log('[Raid Hunter] Automation disabled during start delay');
                }
            }, raidStartDelay * 1000);
        } else {
            // No delay, check immediately
            checkForExistingRaids();
        }
    } else {
        console.log('[Raid Hunter] Automation disabled');
        
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
        
        // If we're in autoplay mode, stop it
        try {
            const boardContext = globalThis.state.board.getSnapshot().context;
            if (boardContext.mode === 'autoplay') {
                globalThis.state.board.send({ type: "setPlayMode", mode: "manual" });
                console.log('[Raid Hunter] Switched to manual mode (automation disabled)');
            }
        } catch (error) {
            console.error('[Raid Hunter] Error switching to manual mode:', error);
        }
        
        isRaidActive = false;
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
        raidQueue = [];
        raidRetryCount = 0;
        if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
        }
        
        // Restore quest button appearance when automation is disabled
        restoreQuestButtonAppearance();
        
        // Stop quest button validation monitoring
        stopQuestButtonValidation();
    }
}

// Updates the toggle button appearance
function updateToggleButton() {
    const toggleButton = document.querySelector('#raid-hunter-toggle-btn');
    if (!toggleButton) return;
    
    if (isAutomationEnabled === AUTOMATION_ENABLED) {
        toggleButton.textContent = 'Enabled';
        toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 flex-1 text-whiteHighlight';
    } else {
        toggleButton.textContent = 'Disabled';
        toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-red active:frame-pressed-1-red surface-red gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 flex-1 text-whiteHighlight';
    }
}

// ============================================================================
// 6. RAID END DETECTION FUNCTIONS
// ============================================================================

// Stops autoplay when raid ends
function stopAutoplayOnRaidEnd() {
    try {
        console.log('[Raid Hunter] Raid ended - stopping autoplay...');
        
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
        
        // Check if we're in autoplay mode
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (boardContext.mode === 'autoplay') {
            // Switch back to manual mode
            globalThis.state.board.send({ type: "setPlayMode", mode: "manual" });
            console.log('[Raid Hunter] Switched from autoplay to manual mode');
        }
        
        // Update raid status
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
        
        // Restore quest button appearance
        restoreQuestButtonAppearance();
        
        // Stop quest button validation monitoring
        stopQuestButtonValidation();
        
        // Update state and check for next raid
        updateRaidState();
        
        // If there are more raids available, process the next one
        if (raidQueue.length > 0) {
            console.log(`[Raid Hunter] ${raidQueue.length} raids remaining in queue`);
            setTimeout(() => {
                // Check if automation is still enabled before processing next raid
                if (isAutomationEnabled === AUTOMATION_ENABLED) {
                    processNextRaid();
                } else {
                    console.log('[Raid Hunter] Automation disabled during raid end processing');
                }
            }, 2000); // Small delay before starting next raid
        } else {
            console.log('[Raid Hunter] No more raids in queue');
        }
        
    } catch (error) {
        console.error('[Raid Hunter] Error stopping autoplay on raid end:', error);
    }
}

// Updates raid clock status display (disabled - only shows countdown clock)
function updateRaidClockStatus(status) {
    // Status messages removed - only countdown clock is shown
    // This function is kept to prevent errors but does nothing
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
                    
                    // Update state consistently
                    updateRaidState();
                    
                    // If raids were removed and we were currently raiding, stop autoplay
                    if (currentList.length < lastRaidList.length && isCurrentlyRaiding) {
                        console.log('[Raid Hunter] Raids removed from list - raid likely ended');
                        stopAutoplayOnRaidEnd();
                    }
                    
                    // If new raids were added and we're not currently raiding, process next raid
                    if (currentList.length > lastRaidList.length && !isCurrentlyRaiding && isAutomationEnabled === AUTOMATION_ENABLED) {
                        console.log('[Raid Hunter] New raids detected - processing next raid');
                        processNextRaid();
                    }
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
                    console.log('[Raid Hunter] No raids available but still in autoplay - stopping autoplay');
                    stopAutoplayOnRaidEnd();
                    return;
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
                    console.log('[Raid Hunter] Raid end indicator found in UI - stopping autoplay');
                    stopAutoplayOnRaidEnd();
                    return;
                }
                
            } catch (error) {
                console.error('[Raid Hunter] Error in raid end checking:', error);
            }
        });
    }, 30000); // Reduced from 10s to 30s - raids last hours, so less frequent checking is fine
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
// 7. CORE LOGIC FUNCTIONS
// ============================================================================

// Handles events and raids via API.
async function handleEventOrRaid(roomId) {
    if (!roomId) {
        console.log('[Raid Hunter] No room ID provided for raid');
        return;
    }

    // Check if automation is still enabled before starting
    if (isAutomationEnabled === AUTOMATION_DISABLED) {
        console.log('[Raid Hunter] Automation disabled - stopping raid automation');
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
        return;
    }

    console.log(`[Raid Hunter] Starting raid automation for room ID: ${roomId}`);

    try {
        // Sleep for 1000ms before navigating to the raid map
        console.log('[Raid Hunter] Waiting 1000ms before navigation...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check automation status after initial delay
        if (isAutomationEnabled === AUTOMATION_DISABLED) {
            console.log('[Raid Hunter] Automation disabled during navigation delay - stopping raid');
            isCurrentlyRaiding = false;
            currentRaidInfo = null;
            return;
        }
        
        // Navigate to the raid map
        console.log('[Raid Hunter] Navigating to raid map...');
        globalThis.state.board.send({
            type: 'selectRoomById',
            roomId: roomId
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('[Raid Hunter] Navigation completed');
        
        // Check automation status after navigation
        if (isAutomationEnabled === AUTOMATION_DISABLED) {
            console.log('[Raid Hunter] Automation disabled after navigation - stopping raid');
            isCurrentlyRaiding = false;
            currentRaidInfo = null;
            return;
        }
    } catch (error) {
        console.error('[Raid Hunter] Error navigating to map via API:', error);
        handleRaidFailure('Failed to navigate to map');
        return;
    }
    
    // Find and click Auto-setup button
    console.log('[Raid Hunter] Looking for Auto-setup button...');
    const autoSetupButton = findButtonByText('Auto-setup');
    if (!autoSetupButton) {
        console.log('[Raid Hunter] Auto-setup button not found');
        handleRaidFailure('Auto-setup button not found');
        return;
    }
    
    console.log('[Raid Hunter] Clicking Auto-setup button...');
    autoSetupButton.click();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check automation status after auto-setup
    if (isAutomationEnabled === AUTOMATION_DISABLED) {
        console.log('[Raid Hunter] Automation disabled after auto-setup - stopping raid');
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
        return;
    }

    // Enable autoplay mode
    console.log('[Raid Hunter] Enabling autoplay mode...');
    ensureAutoplayMode();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check automation status after enabling autoplay
    if (isAutomationEnabled === AUTOMATION_DISABLED) {
        console.log('[Raid Hunter] Automation disabled after enabling autoplay - stopping raid');
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
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
    const settings = loadSettings();
    if (settings.autoRefillStamina) {
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
    if (settings.fasterAutoplay) {
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
    
    // Check stamina before attempting to start raid
    console.log('[Raid Hunter] Checking stamina before starting raid...');
    const staminaCheck = await checkStamina();
    if (!staminaCheck.hasEnough) {
        console.log('[Raid Hunter] Insufficient stamina detected');
        console.log('[Raid Hunter] Waiting for stamina to regenerate...');
        handleInsufficientStamina();
        return;
    }
    console.log('[Raid Hunter] Stamina check passed');
    
    // Check automation status before clicking Start button
    if (isAutomationEnabled === AUTOMATION_DISABLED) {
        console.log('[Raid Hunter] Automation disabled before starting raid - stopping raid');
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
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
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Final check after clicking Start button
    if (isAutomationEnabled === AUTOMATION_DISABLED) {
        console.log('[Raid Hunter] Automation disabled after clicking Start - stopping raid');
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
        return;
    }
    
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
                console.log(`[Raid Hunter] Stopping monitoring to prevent interference with ongoing raid`);
                
                // Stop interfering monitoring
                if (raidEndCheckInterval) {
                    clearInterval(raidEndCheckInterval);
                    raidEndCheckInterval = null;
                }
                if (questLogMonitorInterval) {
                    clearInterval(questLogMonitorInterval);
                    questLogMonitorInterval = null;
                }
                stopStaminaMonitoring();
                if (raidListMonitor) {
                    raidListMonitor.unsubscribe();
                    raidListMonitor = null;
                }
                setupRaidListMonitoring();
                
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
                raidQueue.unshift(currentRaidInfo); // Put back at front of queue
                console.log(`[Raid Hunter] Retry: ${currentRaidInfo.name} is still enabled, adding back to queue`);
            } else {
                console.log(`[Raid Hunter] Retry: ${currentRaidInfo.name} is no longer enabled, not retrying`);
            }
        }
        
        // Reset state and retry after delay
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
        
        retryTimeout = setTimeout(() => {
            // Check if automation is still enabled before retrying
            if (isAutomationEnabled === AUTOMATION_ENABLED && raidQueue.length > 0) {
                console.log('[Raid Hunter] Retrying raid after failure...');
                processNextRaid();
            } else if (isAutomationEnabled === AUTOMATION_DISABLED) {
                console.log('[Raid Hunter] Automation disabled during retry - cancelling retry');
            }
        }, 5000);
    } else {
        console.log('[Raid Hunter] Max retry attempts reached - giving up on this raid');
        
        // Reset state and move to next raid
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
        raidRetryCount = 0;
        
        // Process next raid if available
        if (raidQueue.length > 0) {
            setTimeout(() => {
                // Check if automation is still enabled before processing next raid
                if (isAutomationEnabled === AUTOMATION_ENABLED) {
                    processNextRaid();
                } else {
                    console.log('[Raid Hunter] Automation disabled during next raid processing');
                }
            }, 2000);
        }
    }
}

function ensureAutoplayMode() {
    const boardContext = globalThis.state.board.getSnapshot().context;
    const currentMode = boardContext.mode;
    
    if (currentMode !== 'autoplay') {
        globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
        return true;
    }
    return false;
}

// Checks for existing raids.
async function checkForExistingRaids() {
    try {
        // Check if automation is enabled
        if (isAutomationEnabled === AUTOMATION_DISABLED) {
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
        
        // Check if we're already in autoplay mode (indicating an ongoing raid)
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (boardContext.mode === 'autoplay') {
            console.log('[Raid Hunter] Already in autoplay mode - marking as currently raiding');
            isCurrentlyRaiding = true;
            currentRaidInfo = { name: 'Unknown', roomId: null };
            startRaidEndChecking(); // Start monitoring for raid end
            return;
        }
        
        // Update raid queue and process next raid
        updateRaidState();
        if (raidQueue.length > 0) {
            console.log(`[Raid Hunter] Found ${raidQueue.length} raids available - processing next raid`);
            
            // Apply raid start delay if configured
            const settings = loadSettings();
            const raidStartDelay = settings.raidDelay || DEFAULT_RAID_START_DELAY;
            
            if (raidStartDelay > 0) {
                console.log(`[Raid Hunter] Applying raid start delay: ${raidStartDelay} seconds`);
                
                setTimeout(() => {
                    // Check if automation is still enabled after delay
                    if (isAutomationEnabled === AUTOMATION_ENABLED && raidQueue.length > 0 && !isCurrentlyRaiding) {
                        console.log('[Raid Hunter] Raid start delay completed - processing raid');
                        processNextRaid();
                    } else if (isAutomationEnabled === AUTOMATION_DISABLED) {
                        console.log('[Raid Hunter] Automation disabled during existing raid delay');
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
    // Set up a dedicated body observer for fight toast detection
    // This runs independently of quest log monitoring
    if (bodyObserver) {
        bodyObserver.disconnect();
        bodyObserver = null;
    }
    
    bodyObserver = new MutationObserver((mutations) => {
        safeExecute(() => {
            // Only check for raid toasts if automation is enabled
            if (!isAutomationActive()) return;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Skip quest log elements to prevent false positives
                            if (node.textContent && node.textContent.includes('Quest Log')) {
                                continue; // Skip quest log elements
                            }
                            
                            // Check if the added element is a raid toast (like Bestiary Automator)
                            if (isRaidToast(node)) {
                                console.log('[Raid Hunter] Raid toast detected via MutationObserver!');
                                handleFightToast();
                                return; // Exit early since we found a raid toast
                            }
                            
                            // Also check child elements for raid toasts (like Bestiary Automator)
                            const raidToast = node.querySelector && node.querySelector('.widget-bottom');
                            if (raidToast && isRaidToast(raidToast)) {
                                console.log('[Raid Hunter] Raid toast found in child elements via MutationObserver!');
                                handleFightToast();
                                return;
                            }
                        }
                    }
                }
            }
        });
    });
    
    bodyObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('[Raid Hunter] Body observer set up for raid toast detection');
}

// Handles new raid detection.
async function handleNewRaid(raid) {
    // Check if automation is enabled
    if (isAutomationEnabled === AUTOMATION_DISABLED) {
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
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                break;
            }
        }
        
        // Update raid queue and process next raid
        updateRaidState();
        if (raidQueue.length > 0 && !isCurrentlyRaiding) {
            console.log(`[Raid Hunter] New raids detected - processing next raid`);
            
            // Apply raid start delay if configured
            const raidStartDelay = settings.raidDelay || DEFAULT_RAID_START_DELAY;
            
            if (raidStartDelay > 0) {
                console.log(`[Raid Hunter] Applying raid start delay: ${raidStartDelay} seconds`);
                
                setTimeout(() => {
                    // Check if automation is still enabled after delay
                    if (isAutomationEnabled === AUTOMATION_ENABLED && raidQueue.length > 0 && !isCurrentlyRaiding) {
                        console.log('[Raid Hunter] Raid start delay completed - processing raid');
                        processNextRaid();
                    } else if (isAutomationEnabled === AUTOMATION_DISABLED) {
                        console.log('[Raid Hunter] Automation disabled during new raid delay');
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
// 8. SETTINGS MODAL
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
                const escEvent = new KeyboardEvent('keydown', {
                    key: 'Escape',
                    code: 'Escape',
                    keyCode: 27,
                    which: 27,
                    bubbles: true,
                    cancelable: true
                });
                document.dispatchEvent(escEvent);
                
                // Small delay to ensure scroll lock is removed
                setTimeout(() => {
                    if (typeof context !== 'undefined' && context.api && context.api.ui) {
                        try {
                            // Create settings content
                            const settingsContent = createSettingsContent();
                            
                            // Open modal using the same API as Cyclopedia
                            activeRaidHunterModal = context.api.ui.components.createModal({
                                title: 'Raid Hunter Settings',
                                width: RAID_HUNTER_MODAL_WIDTH,
                                height: RAID_HUNTER_MODAL_HEIGHT,
                                content: settingsContent,
                                buttons: [{ text: 'Close', primary: true }], // Add Close button like other mods
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
                                        autoSaveIndicator.textContent = '✓ Settings auto-save when changed';
                                        autoSaveIndicator.className = 'pixel-font-16';
                                        autoSaveIndicator.style.cssText = `
                                            font-size: 11px;
                                            color: #4ade80;
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
        color: #fff;
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
        border-right: 1px solid #444;
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
    title.textContent = 'Auto-Raid Settings';
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0 0 10px 0;
        color: #ffe066;
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
    delayLabel.textContent = 'Raid Start Delay (seconds)';
    delayLabel.className = 'pixel-font-16';
    delayLabel.style.cssText = `
        font-weight: bold;
        color: #fff;
        margin-bottom: 4px;
    `;
    delayDiv.appendChild(delayLabel);
    
    const delayInput = document.createElement('input');
    delayInput.type = 'number';
    delayInput.id = 'raidDelay';
    delayInput.value = 3;
    delayInput.min = 0;
    delayInput.max = 10;
    delayInput.className = 'pixel-font-16';
    delayInput.style.cssText = `
        width: 100%;
        padding: 6px;
        background: #333;
        border: 1px solid #ffe066;
        color: #fff;
        border-radius: 3px;
        box-sizing: border-box;
        font-size: 14px;
    `;
    delayDiv.appendChild(delayInput);
    
    const delayDesc = document.createElement('div');
    delayDesc.textContent = 'Delay before starting a raid after detection';
    delayDesc.className = 'pixel-font-16';
    delayDesc.style.cssText = `
        font-size: 11px;
        color: #888;
        font-style: italic;
        margin-top: 2px;
    `;
    delayDiv.appendChild(delayDesc);
    settingsWrapper.appendChild(delayDiv);
    
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
    
    const staminaRefillCheckbox = document.createElement('input');
    staminaRefillCheckbox.type = 'checkbox';
    staminaRefillCheckbox.id = 'autoRefillStamina';
    staminaRefillCheckbox.checked = false;
    staminaRefillCheckbox.style.cssText = `
        width: 16px;
        height: 16px;
        accent-color: #ffe066;
    `;
    // Add auto-save listener immediately
    staminaRefillCheckbox.addEventListener('change', autoSaveSettings);
    checkboxLabelContainer.appendChild(staminaRefillCheckbox);
    
    const staminaRefillLabel = document.createElement('label');
    staminaRefillLabel.textContent = 'Auto-refill Stamina';
    staminaRefillLabel.className = 'pixel-font-16';
    staminaRefillLabel.style.cssText = `
        font-weight: bold;
        color: #fff;
        cursor: pointer;
    `;
    staminaRefillLabel.setAttribute('for', 'autoRefillStamina');
    checkboxLabelContainer.appendChild(staminaRefillLabel);
    
    staminaRefillDiv.appendChild(checkboxLabelContainer);
    
    const staminaRefillDesc = document.createElement('div');
    staminaRefillDesc.textContent = 'Automatically refill stamina when starting a raid';
    staminaRefillDesc.className = 'pixel-font-16';
    staminaRefillDesc.style.cssText = `
        font-size: 11px;
        color: #888;
        font-style: italic;
        margin-top: 2px;
    `;
    staminaRefillDiv.appendChild(staminaRefillDesc);
    settingsWrapper.appendChild(staminaRefillDiv);
    
    // Faster Autoplay setting
    const fasterAutoplayDiv = document.createElement('div');
    fasterAutoplayDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    // Container for checkbox and label on same line
    const fasterAutoplayCheckboxLabelContainer = document.createElement('div');
    fasterAutoplayCheckboxLabelContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
    `;
    
    const fasterAutoplayCheckbox = document.createElement('input');
    fasterAutoplayCheckbox.type = 'checkbox';
    fasterAutoplayCheckbox.id = 'fasterAutoplay';
    fasterAutoplayCheckbox.checked = false;
    fasterAutoplayCheckbox.style.cssText = `
        width: 16px;
        height: 16px;
        accent-color: #ffe066;
    `;
    // Add auto-save listener immediately
    fasterAutoplayCheckbox.addEventListener('change', autoSaveSettings);
    fasterAutoplayCheckboxLabelContainer.appendChild(fasterAutoplayCheckbox);
    
    const fasterAutoplayLabel = document.createElement('label');
    fasterAutoplayLabel.textContent = 'Faster Autoplay';
    fasterAutoplayLabel.className = 'pixel-font-16';
    fasterAutoplayLabel.style.cssText = `
        font-weight: bold;
        color: #fff;
        cursor: pointer;
    `;
    fasterAutoplayLabel.setAttribute('for', 'fasterAutoplay');
    fasterAutoplayCheckboxLabelContainer.appendChild(fasterAutoplayLabel);
    
    fasterAutoplayDiv.appendChild(fasterAutoplayCheckboxLabelContainer);
    
    const fasterAutoplayDesc = document.createElement('div');
    fasterAutoplayDesc.textContent = 'Enable faster autoplay speed during raids (removes delays and increases game speed)';
    fasterAutoplayDesc.className = 'pixel-font-16';
    fasterAutoplayDesc.style.cssText = `
        font-size: 11px;
        color: #888;
        font-style: italic;
        margin-top: 2px;
    `;
    fasterAutoplayDiv.appendChild(fasterAutoplayDesc);
    settingsWrapper.appendChild(fasterAutoplayDiv);
    
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
    creditText.innerHTML = 'Inspired by <a href="https://bestiaryarena.com/profile/kurak" target="_blank" style="color: #666; text-decoration: none; font-size: 10px; cursor: pointer; transition: color 0.2s ease;" onmouseover="this.style.color=\'#ffe066\'" onmouseout="this.style.color=\'#666\'">Kurak\'s Event Hunter</a>';
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
        border: 1px solid #444;
        border-radius: 5px;
        margin: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Raid Map Selection';
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0 0 15px 0;
        color: #ffe066;
        font-size: 16px;
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    section.appendChild(title);
    
    const description = document.createElement('div');
    description.textContent = 'Select which raid maps you want to auto-raid when detected:';
    description.className = 'pixel-font-16';
    description.style.cssText = `
        margin-bottom: 15px;
        font-size: 12px;
        color: #888;
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
        max-height: 250px;
        overflow-y: auto;
        border: 1px solid #555;
        border-radius: 3px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.3);
    `;
    
    // Group raids by region for better organization
    const raidGroups = {
        'Rookgaard': [
            'Rat Plague',
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
            'Tower of Whitewatch (Armor)'
        ],
        'Kazordoon': [
            'Orcish Barricade'
        ],
        'Venore': [
            'Poacher Cave (Bear)',
            'Poacher Cave (Wolf)',
            'Dwarven Bank Heist',
            'An Arcanist Ritual'
        ]
    };
    
    // Create checkboxes for each raid group
    Object.entries(raidGroups).forEach(([region, raids]) => {
        // Region header
        const regionHeader = document.createElement('div');
        regionHeader.textContent = region;
        regionHeader.className = 'pixel-font-16';
        regionHeader.style.cssText = `
            font-weight: bold;
            color: #ffe066;
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
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `raid-${raidName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
            checkbox.checked = false; // Default to disabled
            checkbox.style.cssText = `
                width: 16px;
                height: 16px;
                accent-color: #ffe066;
            `;
            
            const label = document.createElement('label');
            label.textContent = raidName;
            label.className = 'pixel-font-16';
            label.style.cssText = `
                color: #fff;
                font-size: 13px;
                cursor: pointer;
                flex: 1;
            `;
            label.setAttribute('for', checkbox.id);
            
            raidDiv.appendChild(checkbox);
            raidDiv.appendChild(label);
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
    
    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 text-whiteHighlight';
    selectAllBtn.style.cssText = `
        flex: 1;
    `;
    
    // Functionality on click
    selectAllBtn.addEventListener('click', () => {
        const checkboxes = mapContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        autoSaveSettings(); // Auto-save after selecting all
    });
    
    const selectNoneBtn = document.createElement('button');
    selectNoneBtn.textContent = 'Select None';
    selectNoneBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-red active:frame-pressed-1-red surface-red gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 text-whiteHighlight';
    selectNoneBtn.style.cssText = `
        flex: 1;
    `;
    
    // Functionality on click
    selectNoneBtn.addEventListener('click', () => {
        const checkboxes = mapContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        autoSaveSettings(); // Auto-save after selecting none
    });
    
    buttonContainer.appendChild(selectAllBtn);
    buttonContainer.appendChild(selectNoneBtn);
    section.appendChild(buttonContainer);
    
    return section;
}




// Load settings function
function loadSettings() {
    const saved = localStorage.getItem('raidHunterSettings');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (error) {
            console.error('[Raid Hunter] Error parsing settings:', error);
        }
    }
    return {};
}

// Auto-save settings when changed
function autoSaveSettings() {
    try {
        const settings = {};
        const inputs = document.querySelectorAll('input, select');
        
        inputs.forEach(input => {
            // Only process inputs that belong to Raid Hunter settings
            if (input.id === 'raidDelay' || input.id === 'autoRefillStamina' || input.id === 'fasterAutoplay' || input.id.startsWith('raid-')) {
                if (input.type === 'checkbox') {
                    // Skip individual raid checkboxes since we process them separately
                    if (!input.id.startsWith('raid-')) {
                        settings[input.id] = input.checked;
                    }
                } else if (input.type === 'number') {
                    settings[input.id] = parseInt(input.value) || 0;
                } else {
                    settings[input.id] = input.value;
                }
            }
        });
        
        // Process raid map selections
        const enabledRaidMaps = [];
        EVENT_TEXTS.forEach(eventText => {
            const checkboxId = `raid-${eventText.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
            const checkbox = document.getElementById(checkboxId);
            if (checkbox && checkbox.checked) {
                enabledRaidMaps.push(eventText);
            }
        });
        settings.enabledRaidMaps = enabledRaidMaps;
        
        // Save to localStorage
        localStorage.setItem('raidHunterSettings', JSON.stringify(settings));
        console.log('[Raid Hunter] Settings auto-saved:', settings);
    } catch (error) {
        console.error('[Raid Hunter] Error auto-saving settings:', error);
    }
}

// Load and apply settings to the modal
function loadAndApplySettings() {
    try {
        const settings = loadSettings();
        
        
        if (settings.raidDelay !== undefined) {
            const input = document.getElementById('raidDelay');
            if (input) {
                input.value = settings.raidDelay;
                // Add auto-save listener
                input.addEventListener('input', autoSaveSettings);
            }
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
        
        // Apply raid map selections and add auto-save listeners
        if (settings.enabledRaidMaps) {
            settings.enabledRaidMaps.forEach(eventText => {
                const checkboxId = `raid-${eventText.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) checkbox.checked = true;
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
        
        console.log('[Raid Hunter] Settings applied to modal with auto-save listeners');
    } catch (error) {
        console.error('[Raid Hunter] Error applying settings:', error);
    }
}

// ============================================================================
// 9. INITIALIZATION
// ============================================================================

function init() {
    console.log('[Raid Hunter] Raid Hunter initializing');
    
    // Load automation state from localStorage first
    loadAutomationState();
    
    // Set up fight toast monitoring immediately (independent of automation state)
    setupFightToastMonitoring();
    
    setupRaidMonitoring();
    
    // Set up Board Analyzer coordination
    setupBoardAnalyzerCoordination();
    
    // Check for existing raids immediately and after a delay (only if automation is enabled)
    if (isAutomationEnabled === AUTOMATION_ENABLED) {
        checkForExistingRaids();
        setTimeout(checkForExistingRaids, 1000);
    } else {
        console.log('[Raid Hunter] Automation disabled - skipping initial raid check');
    }
    
    // Start monitoring for quest log (like Better Yasir)
    // Don't try to create immediately - wait for quest log to appear
    startQuestLogMonitoring();

    console.log('[Raid Hunter] Raid Hunter Mod initialized.');
    
    
}

init();

// ============================================================================
// 9. QUEST BUTTON VISUAL MODIFICATIONS
// ============================================================================

// Store original quest button state
let originalQuestButtonState = null;
let questButtonValidationInterval = null;

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
    // First, try to find by quest icon (normal state) - check both selected and unselected
    const questIconButton = document.querySelector('button img[src*="quest.png"]')?.closest('button');
    if (questIconButton) {
        return questIconButton;
    }
    
    // Then, look for any button with "Raiding" text - check both selected and unselected
    const allButtons = document.querySelectorAll('button');
    for (const button of allButtons) {
        const span = button.querySelector('span');
        if (span && span.textContent === 'Raiding') {
            return button;
        }
    }
    
    // Look for any button with "Quest Log" text - check both selected and unselected
    for (const button of allButtons) {
        const span = button.querySelector('span');
        if (span && span.textContent === 'Quest Log') {
            return button;
        }
    }
    
    // Fallback: look for any button with quest-related alt text - check both selected and unselected
    const questAltButton = document.querySelector('button img[alt="Quests"]')?.closest('button');
    if (questAltButton) {
        return questAltButton;
    }
    
    // Additional fallback: look for any button with "Quests" text
    for (const button of allButtons) {
        const span = button.querySelector('span');
        if (span && span.textContent === 'Quests') {
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
    try {
        // Only check map if we're currently raiding and have raid info
        if (isCurrentlyRaiding && currentRaidInfo && !isOnCorrectRaidMap()) {
            console.log('[Raid Hunter] User not on correct raid map - not modifying quest button');
            return false;
        }
        
        // Request control of quest button
        if (!window.QuestButtonManager.requestControl('Raid Hunter')) {
            console.log('[Raid Hunter] Cannot modify quest button - controlled by another mod');
            return false;
        }
        
        // Find the quest button in the header navigation
        const questButton = findQuestButton();
        
        if (!questButton) {
            console.log('[Raid Hunter] Quest button not found for modification');
            window.QuestButtonManager.releaseControl('Raid Hunter');
            return false;
        }
        
        // Store original state if not already stored
        if (!window.QuestButtonManager.originalState) {
            const img = questButton.querySelector('img');
            const span = questButton.querySelector('span');
            
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
            span.style.background = 'linear-gradient(45deg, #22c55e, #16a34a, #22c55e, #16a34a)';
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
        questButton.style.color = '#22c55e'; // Green color
        
        console.log('[Raid Hunter] Quest button modified for raiding state');
        return true;
    } catch (error) {
        console.error('[Raid Hunter] Error modifying quest button for raiding:', error);
        window.QuestButtonManager.releaseControl('Raid Hunter');
        return false;
    }
}

// Function to restore quest button to original appearance
function restoreQuestButtonAppearance() {
    try {
        // Only restore if we have control
        if (!window.QuestButtonManager.hasControl('Raid Hunter')) {
            console.log('[Raid Hunter] Cannot restore quest button - not controlled by Raid Hunter');
            return false;
        }
        
        // Find the quest button - try multiple selectors to find it regardless of current state
        const questButton = findQuestButton();
        
        if (!questButton) {
            console.log('[Raid Hunter] Quest button not found for restoration');
            window.QuestButtonManager.releaseControl('Raid Hunter');
            return false;
        }
        
        if (!window.QuestButtonManager.originalState) {
            console.log('[Raid Hunter] Original quest button state not found for restoration');
            window.QuestButtonManager.releaseControl('Raid Hunter');
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
        
        // Release control after restoration
        window.QuestButtonManager.releaseControl('Raid Hunter');
        
        console.log('[Raid Hunter] Quest button appearance restored');
        return true;
    } catch (error) {
        console.error('[Raid Hunter] Error restoring quest button appearance:', error);
        window.QuestButtonManager.releaseControl('Raid Hunter');
        return false;
    }
}

// Function to start monitoring quest button validation
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
    
    console.log('[Raid Hunter] Starting quest button validation monitoring');
    
    questButtonValidationInterval = setInterval(() => {
        try {
            // Check if we're still raiding
            if (!isCurrentlyRaiding) {
                console.log('[Raid Hunter] No longer raiding - stopping quest button validation');
                stopQuestButtonValidation();
                return;
            }
            
            // Check if we're on the correct map
            if (!isOnCorrectRaidMap()) {
                console.log('[Raid Hunter] User navigated away from raid map - restoring quest button');
                restoreQuestButtonAppearance();
                // Don't stop the interval - keep monitoring in case they come back
            } else {
                // We're on the correct map, ensure quest button shows raiding state (only if we have control)
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
                    // We don't have control - check if Better Tasker has control
                    const currentOwner = window.QuestButtonManager.getCurrentOwner();
                    if (currentOwner === 'Better Tasker') {
                        // Better Tasker has control, don't interfere
                        console.log('[Raid Hunter] Better Tasker has quest button control - not interfering');
                    } else {
                        // No one has control or it's available, try to get it
                        modifyQuestButtonForRaiding();
                    }
                }
            }
        } catch (error) {
            console.error('[Raid Hunter] Error in quest button validation:', error);
        }
    }, 2000); // Check every 2 seconds
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
// 10. CLEANUP & EXPORTS
// ============================================================================

// Cleanup function for when mod is disabled (like Cyclopedia)
function cleanupRaidHunter() {
    try {
        // Clean up modal if open
        if (activeRaidHunterModal) {
            cleanupRaidHunterModal();
        }
        
        // Clean up raid clock (this calls cleanupAll() internally)
        stopRaidClock();
        
        // Clean up additional items not covered by cleanupAll()
        
        // Clean up window.staminaMonitorInterval
        if (window.staminaMonitorInterval) {
            clearInterval(window.staminaMonitorInterval);
            window.staminaMonitorInterval = null;
        }
        
        // Clean up CSS styles
        const raidShimmerCSS = document.getElementById('raidShimmerCSS');
        if (raidShimmerCSS) {
            raidShimmerCSS.remove();
        }
        
        // Clean up event listeners from raid clock buttons
        const settingsButton = document.querySelector('#raid-hunter-settings-btn');
        const toggleButton = document.querySelector('#raid-hunter-toggle-btn');
        if (settingsButton) {
            settingsButton.replaceWith(settingsButton.cloneNode(true)); // Remove all event listeners
        }
        if (toggleButton) {
            toggleButton.replaceWith(toggleButton.cloneNode(true)); // Remove all event listeners
        }
        
        // Clean up modal cleanup observer
        if (modalCleanupObserver) {
            modalCleanupObserver.disconnect();
            modalCleanupObserver = null;
        }
        
        // Clean up global state managers
        try {
            // Release control of Quest Button Manager
            if (window.QuestButtonManager && window.QuestButtonManager.hasControl('Raid Hunter')) {
                window.QuestButtonManager.releaseControl('Raid Hunter');
            }
            
            // Release control of Bestiary Automator Settings Manager
            if (window.BestiaryAutomatorSettingsManager && window.BestiaryAutomatorSettingsManager.hasControl('Raid Hunter')) {
                window.BestiaryAutomatorSettingsManager.releaseControl('Raid Hunter');
            }
        } catch (error) {
            console.error('[Raid Hunter] Error cleaning up global state managers:', error);
        }
        
        // Reset additional state variables
        isRaidActive = false;
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
        raidQueue = [];
        raidRetryCount = 0;
        lastRaidList = [];
        originalQuestButtonState = null;
        stateManager.isInitializing = false;
        stateManager.isProcessing = false;
        isBoardAnalyzerRunning = false;
        
        // Reset automation state to default (disabled)
        isAutomationEnabled = AUTOMATION_DISABLED;
        
        // Restore quest button appearance
        restoreQuestButtonAppearance();
        
        // Stop quest button validation monitoring
        stopQuestButtonValidation();
        
        console.log('[Raid Hunter] Mod cleanup completed');
    } catch (error) {
        console.error('[Raid Hunter] Error during mod cleanup:', error);
    }
}

// Export functionality for mod loader (following mod development guide)
context.exports = {
    cleanup: cleanupRaidHunter,
    updateConfig: (newConfig) => {
        // Handle config updates if needed
        console.log('[Raid Hunter] Config update received:', newConfig);
    }
};