// Raid Hunter Mod for Bestiary Arena
console.log('[Raid Hunter] initializing...');

// ============================================================================
// 1. CONSTANTS
// ============================================================================

const MOD_ID = 'raid-hunter';
const RAID_CLOCK_ID = `${MOD_ID}-raid-clock`;
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
let isAutomationEnabled = false; // Default to disabled

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

// State manager to prevent race conditions
let stateManager = {
    isInitializing: false,
    isProcessing: false
};

// Safe execution wrapper to prevent race conditions
function safeExecute(fn) {
    if (stateManager.isProcessing) return;
    stateManager.isProcessing = true;
    try {
        fn();
    } finally {
        stateManager.isProcessing = false;
    }
}

// Unified cleanup function to fix memory leaks
function cleanupAll() {
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
    if (questLogObserverTimeout) {
        clearTimeout(questLogObserverTimeout);
        questLogObserverTimeout = null;
    }
    if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
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
        updateRaidClockStatus(statusText);
    } catch (error) {
        console.error('[Raid Hunter] Error updating raid state:', error);
    }
}

// Update raid queue with available raids
function updateRaidQueue() {
    try {
        const settings = loadSettings();
        const enabledMaps = settings.enabledRaidMaps || [];
        
        
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
        
        if (currentRaidList.length > 0) {
            // Add available raids to queue using API data
            currentRaidList.forEach(raid => {
                const raidName = getEventNameForRoomId(raid.roomId);
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
                }
            });
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
    
    // Get next raid from queue
    const nextRaid = raidQueue.shift();
    if (!nextRaid) {
        return;
    }
    
    console.log(`[Raid Hunter] Starting next raid: ${nextRaid.name}`);
    currentRaidInfo = nextRaid;
    isCurrentlyRaiding = true;
    raidRetryCount = 0; // Reset retry count for new raid
    
    // Close any open modals first, then start the raid
    closeOpenModals().then(() => {
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

// Optimized quest log mutation processing with immediate detection (inspired by Better Yasir)
function debouncedProcessQuestLogMutations(mutations) {
    safeExecute(() => {
        // Skip if raid clock already exists
        if (document.getElementById(RAID_CLOCK_ID)) {
            return;
        }
        
        // Quick check: if no quest log-related content, skip processing entirely
        const hasQuestLogContent = mutations.some(mutation => 
            mutation.addedNodes.length > 0 && 
            Array.from(mutation.addedNodes).some(node => 
                node.nodeType === Node.ELEMENT_NODE && 
                (node.textContent?.includes('Quest Log') || 
                 node.querySelector?.('*') && 
                 Array.from(node.querySelectorAll('*')).some(el => 
                   el.textContent?.includes('Quest Log')
                 ) ||
                 // Also check for quest log container structure
                 node.classList?.contains('grid') && 
                 node.classList?.contains('items-start') && 
                 node.classList?.contains('gap-1') ||
                 // Check for widget-bottom that might contain quest log
                 node.classList?.contains('widget-bottom') ||
                 // Check for any element with quest log related classes
                 (node.querySelector && node.querySelector('.grid.h-\\[260px\\].items-start.gap-1'))
                )
            )
        );
        
        if (!hasQuestLogContent) {
            return;
        }
        
        console.log('[Raid Hunter] debouncedProcessQuestLogMutations: Quest log content detected!');
        
        // Clear any existing timeout
        if (questLogObserverTimeout) {
            clearTimeout(questLogObserverTimeout);
        }
        
        // Try immediate detection first (like Better Yasir)
        if (tryImmediateRaidClockCreation()) {
            // Don't stop monitoring - keep it running for future quest log reopenings
            console.log('[Raid Hunter] Raid clock created successfully! Continuing to monitor for future Quest Log openings...');
            return;
        }
        
        // Fallback with minimal delay (like Better Yasir's 50ms debounce)
        questLogObserverTimeout = setTimeout(() => {
            // Double-check that raid clock doesn't exist before trying to create
            if (!document.getElementById(RAID_CLOCK_ID) && tryImmediateRaidClockCreation()) {
                // Don't stop monitoring - keep it running for future quest log reopenings
                console.log('[Raid Hunter] Raid clock created via delayed detection! Continuing to monitor for future Quest Log openings...');
            }
        }, 50);
    });
}

// Monitors quest log visibility (simplified like Better Yasir)
function monitorQuestLogVisibility() {
    // Skip if observer already exists
    if (questLogObserver) {
        console.log('[Raid Hunter] monitorQuestLogVisibility: Observer already exists, skipping');
        return;
    }
    
    // MutationObserver for quest log detection (like Better Yasir)
    questLogObserver = new MutationObserver(debouncedProcessQuestLogMutations);
    
    questLogObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('[Raid Hunter] MutationObserver set up for quest log detection');
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
    }, 2000); // Reduced frequency since we have MutationObserver
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
            
            // Format to match quest log timers: HH:MM:SS (no 'h' suffix like other timers)
            const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
    updateRaidClockStatus('Waiting for stamina (checking every 3m)');
}

// Start continuous stamina monitoring every 3 minutes
function startStaminaMonitoring() {
    // Clear any existing stamina monitoring
    if (window.staminaMonitorInterval) {
        clearInterval(window.staminaMonitorInterval);
    }
    
    console.log('[Raid Hunter] Starting stamina monitoring - checking every 3 minutes');
    
    // Check stamina every 3 minutes
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
                    updateRaidClockStatus('No raids available');
                }
            } else {
                console.log('[Raid Hunter] Still waiting for stamina');
                updateRaidClockStatus('Waiting for stamina...');
            }
        } catch (error) {
            console.error('[Raid Hunter] Error during stamina monitoring:', error);
        }
    }, 3 * 60 * 1000); // Every 3 minutes
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
        // Check if Bestiary Automator is available
        if (typeof context !== 'undefined' && context.exports && context.exports.updateConfig) {
            console.log('[Raid Hunter] Enabling Bestiary Automator autorefill stamina...');
            context.exports.updateConfig({
                autoRefillStamina: true
            });
            console.log('[Raid Hunter] Bestiary Automator autorefill stamina enabled');
            return true;
        } else {
            console.log('[Raid Hunter] Bestiary Automator not available for autorefill stamina');
            return false;
        }
    } catch (error) {
        console.error('[Raid Hunter] Error enabling Bestiary Automator autorefill stamina:', error);
        return false;
    }
}

// Disable Bestiary Automator's autorefill stamina setting
function disableBestiaryAutomatorStaminaRefill() {
    try {
        // Check if Bestiary Automator is available
        if (typeof context !== 'undefined' && context.exports && context.exports.updateConfig) {
            console.log('[Raid Hunter] Disabling Bestiary Automator autorefill stamina...');
            context.exports.updateConfig({
                autoRefillStamina: false
            });
            console.log('[Raid Hunter] Bestiary Automator autorefill stamina disabled');
            return true;
        } else {
            console.log('[Raid Hunter] Bestiary Automator not available for autorefill stamina');
            return false;
        }
    } catch (error) {
        console.error('[Raid Hunter] Error disabling Bestiary Automator autorefill stamina:', error);
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

// Finds button by text content.
function findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(button => button.textContent.trim() === text && isElementVisible(button)) || null;
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
            isAutomationEnabled = false;
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
    isAutomationEnabled = !isAutomationEnabled;
    saveAutomationState(); // Save to localStorage
    updateToggleButton();
    
    if (isAutomationEnabled) {
        console.log('[Raid Hunter] Automation enabled');
        
        // Re-enable monitoring
        setupRaidMonitoring();
        checkForExistingRaids();
    } else {
        console.log('[Raid Hunter] Automation disabled');
        
        // Disable Bestiary Automator's autorefill stamina when Raid Hunter is disabled
        const settings = loadSettings();
        if (settings.autoRefillStamina) {
            console.log('[Raid Hunter] Automation disabled - disabling Bestiary Automator autorefill stamina...');
            disableBestiaryAutomatorStaminaRefill();
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
    }
}

// Updates the toggle button appearance
function updateToggleButton() {
    const toggleButton = document.querySelector('#raid-hunter-toggle-btn');
    if (!toggleButton) return;
    
    if (isAutomationEnabled) {
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
        
        // Update state and check for next raid
        updateRaidState();
        
        // If there are more raids available, process the next one
        if (raidQueue.length > 0) {
            console.log(`[Raid Hunter] ${raidQueue.length} raids remaining in queue`);
            setTimeout(() => {
                processNextRaid();
            }, 2000); // Small delay before starting next raid
        } else {
            console.log('[Raid Hunter] No more raids in queue');
            updateRaidClockStatus('All raids completed');
        }
        
    } catch (error) {
        console.error('[Raid Hunter] Error stopping autoplay on raid end:', error);
    }
}

// Updates raid clock status display
function updateRaidClockStatus(status) {
    const timerElement = document.querySelector(`#${RAID_CLOCK_ID} .raid-timer`);
    if (timerElement) {
        timerElement.textContent = status;
        timerElement.style.color = '#ff6b6b'; // Red for ended status
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
                    
                    // Update state consistently
                    updateRaidState();
                    
                    // If raids were removed and we were currently raiding, stop autoplay
                    if (currentList.length < lastRaidList.length && isCurrentlyRaiding) {
                        console.log('[Raid Hunter] Raids removed from list - raid likely ended');
                        stopAutoplayOnRaidEnd();
                    }
                    
                    // If new raids were added and we're not currently raiding, process next raid
                    if (currentList.length > lastRaidList.length && !isCurrentlyRaiding && isRaidActive) {
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
    }, 10000); // Check every 10 seconds (less frequent when active)
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

    console.log(`[Raid Hunter] Starting raid automation for room ID: ${roomId}`);

    try {
        // Sleep for 1000ms before navigating to the raid map
        console.log('[Raid Hunter] Waiting 1000ms before navigation...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Navigate to the raid map
        console.log('[Raid Hunter] Navigating to raid map...');
        globalThis.state.board.send({
            type: 'selectRoomById',
            roomId: roomId
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('[Raid Hunter] Navigation completed');
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

    // Enable autoplay mode
    console.log('[Raid Hunter] Enabling autoplay mode...');
    ensureAutoplayMode();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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
        enableBestiaryAutomatorStaminaRefill();
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
        updateRaidClockStatus(`Raid failed - retrying in 5s (${raidRetryCount}/${maxRetryAttempts})`);
        
        // Put the raid back in the queue for retry
        if (currentRaidInfo) {
            raidQueue.unshift(currentRaidInfo); // Put back at front of queue
        }
        
        // Reset state and retry after delay
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
        
        retryTimeout = setTimeout(() => {
            if (raidQueue.length > 0) {
                console.log('[Raid Hunter] Retrying raid after failure...');
                processNextRaid();
            }
        }, 5000);
    } else {
        console.log('[Raid Hunter] Max retry attempts reached - giving up on this raid');
        updateRaidClockStatus(`Raid failed after ${maxRetryAttempts} attempts`);
        
        // Reset state and move to next raid
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
        raidRetryCount = 0;
        
        // Process next raid if available
        if (raidQueue.length > 0) {
            setTimeout(() => {
                processNextRaid();
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
        if (!isAutomationEnabled) {
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
            updateRaidClockStatus('Raid in progress...');
            return;
        }
        
        // Update raid queue and process next raid
        updateRaidState();
        if (raidQueue.length > 0) {
            console.log(`[Raid Hunter] Found ${raidQueue.length} raids available - processing next raid`);
            processNextRaid();
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
}

// Handles new raid detection.
async function handleNewRaid(raid) {
    // Check if automation is enabled
    if (!isAutomationEnabled) {
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
            processNextRaid();
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
        
        // Reset modal state
        raidHunterModalInProgress = false;
        lastModalCall = 0;
        
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
                                    const cleanupObserver = new MutationObserver((mutations) => {
                                        mutations.forEach((mutation) => {
                                            mutation.removedNodes.forEach((node) => {
                                                if (node === modalElement || node.contains?.(modalElement)) {
                                                    cleanupObserver.disconnect();
                                                    cleanupRaidHunterModal();
                                                }
                                            });
                                        });
                                    });
                                    cleanupObserver.observe(document.body, { childList: true, subtree: true });
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
        padding: 15px;
        box-sizing: border-box;
        justify-content: space-between;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Auto-Raid Settings';
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0 0 15px 0;
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
        gap: 20px;
    `;
    
    // Raid Delay setting
    const delayDiv = document.createElement('div');
    delayDiv.style.cssText = `
        margin-bottom: 20px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;
    
    const delayLabel = document.createElement('label');
    delayLabel.textContent = 'Raid Start Delay (seconds)';
    delayLabel.className = 'pixel-font-16';
    delayLabel.style.cssText = `
        font-weight: bold;
        color: #fff;
        margin-bottom: 8px;
    `;
    delayDiv.appendChild(delayLabel);
    
    const delayInput = document.createElement('input');
    delayInput.type = 'number';
    delayInput.id = 'raidDelay';
    delayInput.value = 2;
    delayInput.min = 0;
    delayInput.max = 10;
    delayInput.className = 'pixel-font-16';
    delayInput.style.cssText = `
        width: 100%;
        padding: 8px;
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
        font-size: 12px;
        color: #888;
        font-style: italic;
        margin-top: 4px;
    `;
    delayDiv.appendChild(delayDesc);
    settingsWrapper.appendChild(delayDiv);
    
    // Auto-refill Stamina setting
    const staminaRefillDiv = document.createElement('div');
    staminaRefillDiv.style.cssText = `
        margin-bottom: 20px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;
    
    // Container for checkbox and label on same line
    const checkboxLabelContainer = document.createElement('div');
    checkboxLabelContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
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
        font-size: 12px;
        color: #888;
        font-style: italic;
        margin-top: 4px;
    `;
    staminaRefillDiv.appendChild(staminaRefillDesc);
    settingsWrapper.appendChild(staminaRefillDiv);
    
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
            if (input.id === 'raidDelay' || input.id === 'autoRefillStamina' || input.id.startsWith('raid-')) {
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
    
    setupRaidMonitoring();
    
    // Check for existing raids immediately and after a delay (only if automation is enabled)
    if (isAutomationEnabled) {
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
// 10. CLEANUP & EXPORTS
// ============================================================================

// Cleanup function for when mod is disabled (like Cyclopedia)
function cleanupRaidHunter() {
    try {
        // Clean up modal if open
        if (activeRaidHunterModal) {
            cleanupRaidHunterModal();
        }
        
        // Clean up raid clock
        stopRaidClock();
        
        // Clean up raid monitoring
        if (raidUnsubscribe && typeof raidUnsubscribe === 'function') {
            raidUnsubscribe();
            raidUnsubscribe = null;
        }
        
        // Reset state (but keep automation preference)
        isRaidActive = false;
        isCurrentlyRaiding = false;
        currentRaidInfo = null;
        raidQueue = [];
        raidRetryCount = 0;
        lastRaidList = [];
        if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
        }
        // Don't reset isAutomationEnabled - let it persist
        
        console.log('[Raid Hunter] Mod cleanup completed');
    } catch (error) {
        console.error('[Raid Hunter] Error during mod cleanup:', error);
    }
}

// Make cleanup function available globally for mod loader
window.cleanupRaidHunter = cleanupRaidHunter;

context.exports = {};