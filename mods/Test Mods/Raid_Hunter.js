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
let lastRaidTime = 0;
let raidClockInterval = null;
let questLogMonitorInterval = null;
let raidCountdownEndTime = null;
let bodyObserver = null;
let questLogObserver = null;
let questLogObserverTimeout = null;

// Modal state management (like Cyclopedia)
let activeRaidHunterModal = null;
let raidHunterModalInProgress = false;
let lastModalCall = 0;

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
    
    console.log('[Raid Hunter] No quest log container found');
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
                <button class="focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-blue active:frame-pressed-1-blue surface-blue gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 w-full text-whiteHighlight mt-1" id="raid-hunter-settings-btn">
                    Settings
                </button>
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
    
    // Add event listener for Settings button
    const settingsButton = raidClockElement.querySelector('#raid-hunter-settings-btn');
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            console.log('[Raid Hunter] Settings button clicked');
            openRaidHunterSettingsModal();
        });
    }
    
    console.log('[Raid Hunter] createRaidClock: Raid clock created successfully!');
}

// Optimized quest log mutation processing with immediate detection (inspired by Better Yasir)
function debouncedProcessQuestLogMutations(mutations) {
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
        // Try immediate detection (like Better Yasir)
        if (tryImmediateRaidClockCreation()) {
            console.log('[Raid Hunter] Quest log monitoring: Raid clock created, continuing monitoring for future reopenings');
            // Don't stop monitoring - keep it running for future quest log reopenings
        }
    }, 2000); // Reduced frequency since we have MutationObserver
}

// Stops quest log monitoring.
function stopQuestLogMonitoring() {
    if (questLogMonitorInterval) {
        clearInterval(questLogMonitorInterval);
        questLogMonitorInterval = null;
    }
    
    if (questLogObserver) {
        questLogObserver.disconnect();
        questLogObserver = null;
    }
    
    if (questLogObserverTimeout) {
        clearTimeout(questLogObserverTimeout);
        questLogObserverTimeout = null;
    }
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
    if (raidClockInterval) {
        clearInterval(raidClockInterval);
        raidClockInterval = null;
    }
    
    stopQuestLogMonitoring();
    if (bodyObserver) {
        bodyObserver.disconnect();
        bodyObserver = null;
    }
    
    if (questLogObserver) {
        questLogObserver.disconnect();
        questLogObserver = null;
    }
    
    if (questLogObserverTimeout) {
        clearTimeout(questLogObserverTimeout);
        questLogObserverTimeout = null;
    }
    
    const raidClockElement = document.getElementById(RAID_CLOCK_ID);
    if (raidClockElement) {
        raidClockElement.remove();
    }
}

// ============================================================================
// 4. UTILITY FUNCTIONS
// ============================================================================

// Checks element visibility.
function isElementVisible(el) {
    if (!el || el.disabled) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

// Gets room ID for event.
function getRoomIdForEvent(eventName) {
    try {
        if (EVENT_TO_ROOM_MAPPING[eventName]) {
            return EVENT_TO_ROOM_MAPPING[eventName];
        }
        
        if (globalThis.state?.utils?.ROOM_ID) {
            const roomIds = globalThis.state.utils.ROOM_ID;
            for (const [key, value] of Object.entries(roomIds)) {
                if (key.toLowerCase().includes(eventName.toLowerCase().replace(/\s+/g, '')) ||
                    eventName.toLowerCase().replace(/\s+/g, '').includes(key.toLowerCase())) {
                    return value;
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('[Raid Hunter] Error getting room ID for event:', eventName, error);
        return null;
    }
}

// Finds button by text content.
function findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll('button'));
    const simpleButton = buttons.find(button => button.textContent.trim() === text && isElementVisible(button));
    if (simpleButton) {
        return simpleButton;
    }

    const actionLinks = Array.from(document.querySelectorAll('span.action-link'));
    for (const span of actionLinks) {
        if (span.textContent.trim().includes(text) && isElementVisible(span)) {
            const buttonsInSpan = span.querySelectorAll('button');
            for (const button of buttonsInSpan) {
                if (isElementVisible(button)) {
                    return button;
                }
            }
            if (span.onclick || span.getAttribute('role') === 'button') {
                return span;
            }
        }
    }

    const fallbackButton = buttons.find(button => button.textContent.trim().includes(text) && isElementVisible(button));
    if (fallbackButton) {
        return fallbackButton;
    }

    return null;
}

// ============================================================================
// 5. CORE LOGIC FUNCTIONS
// ============================================================================

// Handles events and raids via API.
async function handleEventOrRaid(roomId) {
    if (!roomId) {
        return;
    }

    try {
        globalThis.state.board.send({
            type: 'selectRoomById',
            roomId: roomId
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
        console.error('[Raid Hunter] Error navigating to map via API:', error);
        return;
    }
    const autoSetupButton = findButtonByText('Auto-setup');
    if (!autoSetupButton) {
        return;
    }

    autoSetupButton.click();
    await new Promise(resolve => setTimeout(resolve, 2000));

    ensureAutoplayMode();
    await new Promise(resolve => setTimeout(resolve, 2000));

    const startButton = findButtonByText('Start');
    if (!startButton) {
        return;
    }

    startButton.click();
    await new Promise(resolve => setTimeout(resolve, 2000));
}

function ensureAutoplayMode() {
  try {
    const boardContext = globalThis.state.board.getSnapshot().context;
    const currentMode = boardContext.mode;
    
    if (currentMode !== 'autoplay') {
      globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('[Raid Hunter] Error setting autoplay mode:', error);
    return false;
  }
}

// Checks for existing raids.
async function checkForExistingRaids() {
    try {
        const settings = loadSettings();
        const enabledMaps = settings.enabledRaidMaps || EVENT_TEXTS; // Default to all if not set
        
        let eventButton = null;
        for (const eventText of enabledMaps) {
            eventButton = findButtonByText(eventText);
            if (eventButton) {
                break;
            }
        }
        
        if (eventButton) {
            const eventText = eventButton.textContent.trim();
            const roomId = getRoomIdForEvent(eventText);
            if (roomId) {
                await handleEventOrRaid(roomId);
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
    }
}

// Handles new raid detection.
async function handleNewRaid(raid) {
    const currentTime = Date.now();
    if (currentTime - lastRaidTime < 30000) {
        return;
    }
    
    lastRaidTime = currentTime;
    
    try {
        const settings = loadSettings();
        const enabledMaps = settings.enabledRaidMaps || EVENT_TEXTS; // Default to all if not set
        
        while (true) {
            const closeButton = findButtonByText('Close');
            if (closeButton) {
                closeButton.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                break;
            }
        }
        
        let eventButton = null;
        for (const eventText of enabledMaps) {
            eventButton = findButtonByText(eventText);
            if (eventButton) {
                break;
            }
        }
        
        if (eventButton) {
            const eventText = eventButton.textContent.trim();
            const roomId = getRoomIdForEvent(eventText);
            if (roomId) {
                await handleEventOrRaid(roomId);
            }
        }
    } catch (error) {
        console.error("[Raid Hunter] Error handling raid:", error);
    }
}

// ============================================================================
// 6. SETTINGS MODAL
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

// Create settings content with 2-column layout (matching Dice Roller sizing)
function createSettingsContent() {
    // Main container with 2-column layout
    const mainContainer = document.createElement('div');
    mainContainer.style.cssText = `
        display: flex;
        flex-direction: row;
        width: 100%;
        height: 100%;
        min-width: 700px;
        max-width: 700px;
        min-height: 400px;
        max-height: 400px;
        box-sizing: border-box;
        overflow: hidden;
        background: #232323;
        color: #e6d7b0;
        font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
    `;
    
    // Left column - Auto-Raid Settings
    const leftColumn = document.createElement('div');
    leftColumn.style.cssText = `
        width: 200px;
        min-width: 200px;
        max-width: 200px;
        display: flex;
        flex-direction: column;
        border-right: 6px solid transparent;
        border-image: url('https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png') 6 6 6 6 fill stretch;
        overflow-y: auto;
        min-height: 0;
        padding: 0;
        margin: 0;
    `;
    
    // Right column - Other Settings
    const rightColumn = document.createElement('div');
    rightColumn.style.cssText = `
        flex: 1;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow-y: auto;
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
        padding: 20px;
        box-sizing: border-box;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Auto-Raid Settings';
    title.style.cssText = `
        margin: 0 0 20px 0;
        color: #ffe066;
        font-size: 16px;
        font-weight: bold;
        text-align: center;
    `;
    container.appendChild(title);
    
    // Enable Auto-Raid setting
    const enableDiv = document.createElement('div');
    enableDiv.style.cssText = `
        margin-bottom: 20px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;
    
    const enableLabel = document.createElement('label');
    enableLabel.style.cssText = `
        font-weight: bold;
        color: #e6d7b0;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    const enableCheckbox = document.createElement('input');
    enableCheckbox.type = 'checkbox';
    enableCheckbox.id = 'autoRaidEnabled';
    enableCheckbox.checked = true;
    enableCheckbox.style.cssText = `
        width: 16px;
        height: 16px;
    `;
    
    enableLabel.appendChild(enableCheckbox);
    enableLabel.appendChild(document.createTextNode('Enable Auto-Raid'));
    enableDiv.appendChild(enableLabel);
    
    const enableDesc = document.createElement('div');
    enableDesc.textContent = 'Automatically start raids when detected';
    enableDesc.style.cssText = `
        font-size: 12px;
        color: #888;
        font-style: italic;
    `;
    enableDiv.appendChild(enableDesc);
    container.appendChild(enableDiv);
    
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
    delayLabel.style.cssText = `
        font-weight: bold;
        color: #e6d7b0;
    `;
    delayDiv.appendChild(delayLabel);
    
    const delayInput = document.createElement('input');
    delayInput.type = 'number';
    delayInput.id = 'raidDelay';
    delayInput.value = 2;
    delayInput.min = 0;
    delayInput.max = 10;
    delayInput.style.cssText = `
        width: 100%;
        padding: 8px;
        background: #333;
        border: 1px solid #555;
        color: #e6d7b0;
        border-radius: 3px;
        box-sizing: border-box;
    `;
    delayDiv.appendChild(delayInput);
    
    const delayDesc = document.createElement('div');
    delayDesc.textContent = 'Delay before starting a raid after detection';
    delayDesc.style.cssText = `
        font-size: 12px;
        color: #888;
        font-style: italic;
    `;
    delayDiv.appendChild(delayDesc);
    container.appendChild(delayDiv);
    
    return container;
}

// Create Other Settings section (Raid Map Selection & Other Settings)
function createOtherSettings() {
    const container = document.createElement('div');
    container.style.cssText = `
        display: flex;
        flex-direction: column;
        width: 100%;
        padding: 20px;
        box-sizing: border-box;
        gap: 20px;
        min-height: 0;
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
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 5px;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Raid Map Selection';
    title.style.cssText = `
        margin: 0 0 15px 0;
        color: #ffe066;
        font-size: 16px;
        font-weight: bold;
    `;
    section.appendChild(title);
    
    const description = document.createElement('div');
    description.textContent = 'Select which raid maps you want to auto-raid when detected:';
    description.style.cssText = `
        margin-bottom: 15px;
        font-size: 12px;
        color: #888;
        font-style: italic;
    `;
    section.appendChild(description);
    
    // Add auto-save indicator
    const autoSaveIndicator = document.createElement('div');
    autoSaveIndicator.textContent = '✓ Settings auto-save when changed';
    autoSaveIndicator.style.cssText = `
        margin-bottom: 15px;
        font-size: 11px;
        color: #4ade80;
        font-style: italic;
    `;
    section.appendChild(autoSaveIndicator);
    
    // Create map selection container
    const mapContainer = document.createElement('div');
    mapContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid #555;
        border-radius: 3px;
        padding: 10px;
        background: #333;
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
        regionHeader.style.cssText = `
            font-weight: bold;
            color: #ffe066;
            margin: 10px 0 5px 0;
            font-size: 14px;
            border-bottom: 1px solid #555;
            padding-bottom: 3px;
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
            checkbox.checked = true; // Default to enabled
            checkbox.style.cssText = `
                width: 16px;
                height: 16px;
            `;
            
            const label = document.createElement('label');
            label.textContent = raidName;
            label.style.cssText = `
                color: #e6d7b0;
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
    selectAllBtn.style.cssText = `
        padding: 5px 10px;
        background: #333;
        border: 1px solid #555;
        color: #e6d7b0;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
    `;
    selectAllBtn.addEventListener('click', () => {
        const checkboxes = mapContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        autoSaveSettings(); // Auto-save after selecting all
    });
    
    const selectNoneBtn = document.createElement('button');
    selectNoneBtn.textContent = 'Select None';
    selectNoneBtn.style.cssText = `
        padding: 5px 10px;
        background: #333;
        border: 1px solid #555;
        color: #e6d7b0;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
    `;
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
    try {
        const saved = localStorage.getItem('raidHunterSettings');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (error) {
        console.error('[Raid Hunter] Error loading settings:', error);
    }
    return {};
}

// Auto-save settings when changed
function autoSaveSettings() {
    try {
        const settings = {};
        const inputs = document.querySelectorAll('input, select');
        
        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                settings[input.id] = input.checked;
            } else if (input.type === 'number') {
                settings[input.id] = parseInt(input.value) || 0;
            } else {
                settings[input.id] = input.value;
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
        
        // Apply basic settings
        if (settings.autoRaidEnabled !== undefined) {
            const checkbox = document.getElementById('autoRaidEnabled');
            if (checkbox) {
                checkbox.checked = settings.autoRaidEnabled;
                // Add auto-save listener
                checkbox.addEventListener('change', autoSaveSettings);
            }
        }
        
        if (settings.raidDelay !== undefined) {
            const input = document.getElementById('raidDelay');
            if (input) {
                input.value = settings.raidDelay;
                // Add auto-save listener
                input.addEventListener('input', autoSaveSettings);
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
// 7. INITIALIZATION
// ============================================================================

function init() {
    console.log('[Raid Hunter] Raid Hunter initializing');
    
    setupRaidMonitoring();
    setTimeout(checkForExistingRaids, 1000);
    
    // Start monitoring for quest log (like Better Yasir)
    // Don't try to create immediately - wait for quest log to appear
    startQuestLogMonitoring();

    console.log('[Raid Hunter] Raid Hunter Mod initialized.');
    
    window.testRaidClock = () => {
        createRaidClock();
    };
    
    window.refreshRaidCountdown = () => {
        resetRaidCountdown();
        updateRaidClock();
    };
    
    window.forceRaidClock = () => {
        const questLogContainer = findQuestLogContainer();
        
        if (questLogContainer) {
            console.log('[Raid Hunter] forceRaidClock found quest log container');
            createRaidClock();
        } else {
            console.log('[Raid Hunter] forceRaidClock: No quest log container found');
        }
    };
    
    window.debugQuestLog = () => {
        console.log('[Raid Hunter] === Quest Log Debug Info ===');
        console.log('[Raid Hunter] Current URL:', window.location.href);
        console.log('[Raid Hunter] Document ready state:', document.readyState);
        
        const questLogContainer = findQuestLogContainer();
        console.log('[Raid Hunter] Quest log container found:', !!questLogContainer);
        
        if (questLogContainer) {
            console.log('[Raid Hunter] Container classes:', questLogContainer.className);
            console.log('[Raid Hunter] Container children count:', questLogContainer.children.length);
        }
        
        // Check for quest log text
        const questLogText = document.querySelector('*[id*="radix"] p');
        console.log('[Raid Hunter] Quest Log text found:', questLogText?.textContent);
        
        // Check for Yasir element
        const yasirElement = document.querySelector('img[alt="Yasir"]');
        console.log('[Raid Hunter] Yasir element found:', !!yasirElement);
        
        console.log('[Raid Hunter] === End Debug Info ===');
    };
}

init();

// ============================================================================
// 8. CLEANUP & EXPORTS
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
        
        console.log('[Raid Hunter] Mod cleanup completed');
    } catch (error) {
        console.error('[Raid Hunter] Error during mod cleanup:', error);
    }
}

// Make cleanup function available globally for mod loader
window.cleanupRaidHunter = cleanupRaidHunter;

context.exports = {};