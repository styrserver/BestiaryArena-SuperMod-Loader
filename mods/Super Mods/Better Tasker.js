// Better Tasker - A mod for Bestiary Arena
console.log('[Better Tasker] initializing...');

// ============================================================================
// 1. CONSTANTS
// ============================================================================

const MOD_ID = 'better-tasker';
const TASKER_BUTTON_ID = `${MOD_ID}-settings-button`;
const TASKER_TOGGLE_ID = `${MOD_ID}-toggle-button`;

// Default settings constants
const DEFAULT_TASK_START_DELAY = 3;
const DEFAULT_TASKER_ENABLED = false;

// ============================================================================
// 2. STATE MANAGEMENT
// ============================================================================

// UI/Observer State
let questLogObserver = null;

// ============================================================================
// 2.1. QUEST BUTTON COORDINATION
// ============================================================================

// Shared quest button manager for coordination between mods
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

// ============================================================================
// 2.2. BESTIARY AUTOMATOR SETTINGS COORDINATION
// ============================================================================

// Shared Bestiary Automator settings manager for coordination between mods
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

// Raid Hunter coordination state
let isRaidHunterActive = false;
let raidHunterCoordinationInterval = null;
let questLogMonitorInterval = null;
let gameStateObserver = null;
let gameStateUnsubscribers = [];
let automationInterval = null;
let questLogInterval = null;

// Modal State
let activeTaskerModal = null;
let taskerModalInProgress = false;
let lastModalCall = 0;

// Event listener management
let escKeyListener = null;

// Automation State
let isTaskerEnabled = false;
let taskHuntingOngoing = false;
let taskNavigationCompleted = false;
let autoplayPausedByTasker = false;
let pendingTaskCompletion = false;
let taskInProgress = false;
let taskCompletionInProgress = false;

// Session State
let questLogProcessedThisBoardState = false;
let rewardsCollectedThisSession = false;
let lastGameStateChange = 0;
let lastNoTaskCheck = 0;

// Centralized state reset function
function resetState(resetType = 'full') {
    try {
        // Common reset groups to eliminate duplication
        const resetCommonFlags = () => {
            autoplayPausedByTasker = false;
            pendingTaskCompletion = false;
            taskInProgress = false;
            taskCompletionInProgress = false;
            lastNoTaskCheck = 0;
            
            // Stop quest button validation and restore appearance
            stopQuestButtonValidation();
            restoreQuestButtonAppearance();
        };
        
        const resetSessionFlags = () => {
            rewardsCollectedThisSession = false;
            questLogProcessedThisBoardState = false;
        };
        
        const resetTaskHunting = () => {
            taskHuntingOngoing = false;
            // Clear saved tasking map ID
            taskingMapId = null;
            // Stop quest button validation and restore appearance when task hunting stops
            stopQuestButtonValidation();
            restoreQuestButtonAppearance();
            console.log('[Better Tasker] Task hunting flag cleared - no longer actively hunting');
        };
        
        const resetNavigation = () => {
            taskNavigationCompleted = false;
            console.log('[Better Tasker] Task navigation flag cleared - ready for new navigation');
        };
        
        // Apply resets based on type
        switch (resetType) {
            case 'session':
                resetSessionFlags();
                // For session resets, only reset common flags if not task hunting
                if (!taskHuntingOngoing) {
                    resetCommonFlags();
                } else {
                    // Reset flags but preserve quest button state during task hunting
                    autoplayPausedByTasker = false;
                    pendingTaskCompletion = false;
                    taskInProgress = false;
                    taskCompletionInProgress = false;
                    lastNoTaskCheck = 0;
                    console.log('[Better Tasker] Session reset during task hunting - preserving quest button state');
                }
                // Don't reset taskHuntingOngoing during session reset - it should persist until task completion
                console.log('[Better Tasker] Session state reset (preserving task hunting flag)');
                break;
                
            case 'automation':
                resetSessionFlags();
                resetTaskHunting();
                resetCommonFlags();
                console.log('[Better Tasker] Automation state reset');
                break;
                
            case 'navigation':
                resetNavigation();
                resetTaskHunting();
                resetCommonFlags();
                console.log('[Better Tasker] Navigation state reset');
                break;
                
            case 'taskComplete':
                resetTaskHunting();
                resetCommonFlags();
                console.log('[Better Tasker] Task hunting flag reset - task completed');
                break;
                
            case 'full':
            default:
                resetSessionFlags();
                resetTaskHunting();
                resetCommonFlags();
                // Note: taskNavigationCompleted persists until user manually stops automation
                console.log('[Better Tasker] Full state reset');
                break;
        }
    } catch (error) {
        console.error('[Better Tasker] Error during state reset:', error);
    }
}

// ============================================================================
// 3. RAID HUNTER COORDINATION
// ============================================================================

// Check if Raid Hunter is actively raiding
function isRaidHunterRaiding() {
    try {
        // Check if Raid Hunter mod is loaded and actively raiding
        if (typeof window !== 'undefined') {
            // First check if Raid Hunter is actually enabled
            const raidHunterEnabled = localStorage.getItem('raidHunterAutomationEnabled');
            if (raidHunterEnabled !== 'true') {
                console.log('[Better Tasker] Raid Hunter is disabled - not actively raiding');
                return false;
            }
            
            // Check if Raid Hunter is actually currently raiding by checking if it has control of the quest button
            // Raid Hunter takes control of the quest button when it's actively processing a raid
            const raidState = globalThis.state?.raids?.getSnapshot?.();
            if (raidState) {
                const currentRaidList = raidState.context?.list || [];
                const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
                
                // Check if Raid Hunter has control of the quest button (indicates it's actively raiding)
                const isRaidHunterCurrentlyRaiding = window.QuestButtonManager?.getCurrentOwner() === 'Raid Hunter';
                
                console.log(`[Better Tasker] Raid check - Raid Hunter enabled: ${raidHunterEnabled === 'true'}, Active raids: ${currentRaidList.length}, Board mode: ${boardContext?.mode}, Quest button owner: ${window.QuestButtonManager?.getCurrentOwner() || 'none'}`);
                
                // Check if Raid Hunter is in the process of handling a raid (even if not on correct map yet)
                // This prevents Better Tasker from interfering when Raid Hunter is trying to navigate to raid map
                if (currentRaidList.length > 0 && boardContext?.mode === 'autoplay' && isRaidHunterCurrentlyRaiding) {
                    console.log('[Better Tasker] Raid Hunter has active raids and is actively raiding - preventing task automation');
                    return true;
                }
                
                // Also check if Raid Hunter has control of the quest button (backup check)
                if (isRaidHunterCurrentlyRaiding && boardContext?.mode === 'autoplay') {
                    console.log('[Better Tasker] Raid Hunter is actively raiding - preventing task automation');
                    return true;
                }
            } else {
                console.log('[Better Tasker] Raid state not available - assuming no active raids');
            }
        }
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error checking Raid Hunter status:', error);
        return false;
    }
}

// Monitor Raid Hunter coordination
function setupRaidHunterCoordination() {
    if (raidHunterCoordinationInterval) {
        clearInterval(raidHunterCoordinationInterval);
    }
    
    // Check Raid Hunter status every 2 seconds
    raidHunterCoordinationInterval = setInterval(() => {
        const wasRaidHunterActive = isRaidHunterActive;
        isRaidHunterActive = isRaidHunterRaiding();
        
        // If Raid Hunter just became active and we're running automation, stop it
        if (isRaidHunterActive && !wasRaidHunterActive && isTaskerEnabled) {
            console.log('[Better Tasker] Raid Hunter started raiding - pausing task automation');
            stopAutomation();
        }
        
        // If Raid Hunter stopped raiding and we were enabled, resume automation
        if (!isRaidHunterActive && wasRaidHunterActive && isTaskerEnabled) {
            console.log('[Better Tasker] Raid Hunter stopped raiding - resuming task automation');
            // Small delay before resuming to ensure Raid Hunter has fully stopped
            setTimeout(() => {
                if (!isRaidHunterRaiding() && isTaskerEnabled) {
                    // Now that Raid Hunter has stopped, we can safely disable its Bestiary Automator settings
                    // and enable our own if needed
                    handleRaidHunterStopped();
                    startAutomation();
                }
            }, 3000);
        }
    }, 2000);
    
    console.log('[Better Tasker] Raid Hunter coordination set up');
}

// Handle when Raid Hunter stops raiding
function handleRaidHunterStopped() {
    try {
        console.log('[Better Tasker] Raid Hunter stopped - managing Bestiary Automator settings transition');
        
        // Release Raid Hunter's control of Bestiary Automator settings
        window.BestiaryAutomatorSettingsManager.releaseControl('Raid Hunter');
        
        // Disable Raid Hunter's Bestiary Automator settings
        const settings = loadSettings();
        if (settings.autoRefillStamina) {
            console.log('[Better Tasker] Disabling Raid Hunter\'s Bestiary Automator autorefill stamina...');
            disableBestiaryAutomatorStaminaRefill();
        }
        if (settings.fasterAutoplay) {
            console.log('[Better Tasker] Disabling Raid Hunter\'s Bestiary Automator faster autoplay...');
            disableBestiaryAutomatorFasterAutoplay();
        }
        
        // Small delay before enabling our own settings to avoid conflicts
        setTimeout(() => {
            if (settings.autoRefillStamina) {
                console.log('[Better Tasker] Enabling our Bestiary Automator autorefill stamina...');
                enableBestiaryAutomatorStaminaRefill();
            }
            if (settings.fasterAutoplay) {
                console.log('[Better Tasker] Enabling our Bestiary Automator faster autoplay...');
                enableBestiaryAutomatorFasterAutoplay();
            }
        }, 1000);
    } catch (error) {
        console.error('[Better Tasker] Error handling Raid Hunter stop:', error);
    }
}

// Clean up Raid Hunter coordination
function cleanupRaidHunterCoordination() {
    if (raidHunterCoordinationInterval) {
        clearInterval(raidHunterCoordinationInterval);
        raidHunterCoordinationInterval = null;
    }
    isRaidHunterActive = false;
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
            console.log(`[Better Tasker] Found potential quest log container with selector ${i + 1}: ${selector}`);
            return container;
        }
    }
    
    return null;
}

// Find the Paw and Fur Society section
function findPawAndFurSection() {
    const questLogContainer = findQuestLogContainer();
    if (!questLogContainer) return null;
    
    // Look for the Paw and Fur Society section by its text content
    const sections = questLogContainer.querySelectorAll('.frame-1.surface-regular');
    for (const section of sections) {
        const titleElement = section.querySelector('p.text-whiteHighlight');
        if (titleElement && titleElement.textContent === 'Paw and Fur Society') {
            return section;
        }
    }
    
    return null;
}

// Create the settings button
function createSettingsButton() {
    const button = document.createElement('button');
    button.id = TASKER_BUTTON_ID;
    button.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-blue active:frame-pressed-1-blue surface-blue gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
    button.style.cssText = `
        padding: 2px 6px;
        height: 20px;
    `;
    button.textContent = 'Settings';
    
    // Add click event listener
    button.addEventListener('click', () => {
        console.log('[Better Tasker] Settings button clicked');
        openTaskerSettingsModal();
    });
    
    return button;
}

// Create the toggle button
function createToggleButton() {
    const button = document.createElement('button');
    button.id = TASKER_TOGGLE_ID;
    button.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-red active:frame-pressed-1-red surface-red gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
    button.style.cssText = `
        padding: 2px 6px;
        height: 20px;
    `;
    button.textContent = 'Disabled';
    
    // Add click event listener
    button.addEventListener('click', () => {
        console.log('[Better Tasker] Toggle button clicked');
        toggleTasker();
    });
    
    return button;
}

// Insert buttons into Paw and Fur Society section
function insertButtons() {
    // Check if buttons already exist
    if (document.getElementById(TASKER_BUTTON_ID) && document.getElementById(TASKER_TOGGLE_ID)) {
        console.log('[Better Tasker] Buttons already exist, skipping');
        return;
    }
    
    const pawAndFurSection = findPawAndFurSection();
    if (!pawAndFurSection) {
        console.log('[Better Tasker] Paw and Fur Society section not found');
        return;
    }
    
    console.log('[Better Tasker] Found Paw and Fur Society section, inserting buttons');
    
    // Find the title element and its parent container
    const titleElement = pawAndFurSection.querySelector('p.text-whiteHighlight');
    if (titleElement && titleElement.textContent === 'Paw and Fur Society') {
        // Find the parent container that holds the title
        const titleContainer = titleElement.parentElement;
        
        if (titleContainer) {
            // Create a button container
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 4px;
                margin-top: 4px;
            `;
            
            // Create the toggle button
            const toggleButton = createToggleButton();
            buttonContainer.appendChild(toggleButton);
            
            // Create the settings button
            const settingsButton = createSettingsButton();
            buttonContainer.appendChild(settingsButton);
            
            // Insert the button container after the title
            titleElement.parentNode.insertBefore(buttonContainer, titleElement.nextSibling);
            
            // Update toggle button state
            updateToggleButton();
            
            console.log('[Better Tasker] Buttons inserted next to title successfully');
        } else {
            console.log('[Better Tasker] Could not find title container for buttons');
        }
    } else {
        console.log('[Better Tasker] Could not find Paw and Fur Society title element');
    }
}

// ============================================================================
// 4. STATE MANAGEMENT FUNCTIONS
// ============================================================================

// Load tasker state from localStorage
function loadTaskerState() {
    const saved = localStorage.getItem('betterTaskerEnabled');
    if (saved !== null) {
        try {
            isTaskerEnabled = JSON.parse(saved);
            console.log('[Better Tasker] Loaded tasker state from localStorage:', isTaskerEnabled);
        } catch (error) {
            console.error('[Better Tasker] Error parsing tasker state:', error);
            isTaskerEnabled = false;
        }
    } else {
        console.log('[Better Tasker] No saved tasker state, using default (disabled)');
    }
}

// Save tasker state to localStorage
function saveTaskerState() {
    localStorage.setItem('betterTaskerEnabled', JSON.stringify(isTaskerEnabled));
    console.log('[Better Tasker] Saved tasker state to localStorage:', isTaskerEnabled);
}

// Toggle tasker on/off
function toggleTasker() {
    // Check if Raid Hunter is actively raiding before enabling
    if (!isTaskerEnabled && isRaidHunterRaiding()) {
        console.log('[Better Tasker] Cannot enable Tasker - Raid Hunter is actively raiding');
        // Show user feedback that Tasker cannot be enabled due to Raid Hunter
        updateToggleButtonWithRaidHunterStatus();
        return;
    }
    
    isTaskerEnabled = !isTaskerEnabled;
    saveTaskerState();
    updateToggleButton();
    
    if (isTaskerEnabled) {
        console.log('[Better Tasker] Tasker enabled');
        startAutomation();
    } else {
        console.log('[Better Tasker] Tasker disabled');
        // Reset state when user manually disables automation
        resetState('navigation');
        stopAutomation();
    }
}

// Update the toggle button appearance
function updateToggleButton() {
    const toggleButton = document.querySelector(`#${TASKER_TOGGLE_ID}`);
    if (!toggleButton) return;
    
    if (isTaskerEnabled) {
        toggleButton.textContent = 'Enabled';
        toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
        
        // Clear any shimmer effect when just enabled
        toggleButton.style.background = '';
        toggleButton.style.backgroundSize = '';
        toggleButton.style.backgroundClip = '';
        toggleButton.style.webkitBackgroundClip = '';
        toggleButton.style.webkitTextFillColor = '';
        toggleButton.style.animation = '';
    } else {
        toggleButton.textContent = 'Disabled';
        toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-red active:frame-pressed-1-red surface-red gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
        
        // Clear shimmer effect
        toggleButton.style.background = '';
        toggleButton.style.backgroundSize = '';
        toggleButton.style.backgroundClip = '';
        toggleButton.style.webkitBackgroundClip = '';
        toggleButton.style.webkitTextFillColor = '';
        toggleButton.style.animation = '';
    }
}

// Update toggle button to show Raid Hunter is preventing activation
function updateToggleButtonWithRaidHunterStatus() {
    const toggleButton = document.querySelector(`#${TASKER_TOGGLE_ID}`);
    if (!toggleButton) return;
    
    // Temporarily show that Raid Hunter is blocking activation
    toggleButton.textContent = 'Raid Active';
    toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-yellow active:frame-pressed-1-yellow surface-yellow gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
    
    // Reset to normal state after 3 seconds
    setTimeout(() => {
        updateToggleButton();
    }, 3000);
}

// Update toggle button to show "Tasking" during actual task execution
function updateToggleButtonForTasking() {
    const toggleButton = document.querySelector(`#${TASKER_TOGGLE_ID}`);
    if (!toggleButton) return;
    
    toggleButton.textContent = 'Tasking';
    toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
    
    // Add shimmer effect to the text
    toggleButton.style.background = 'linear-gradient(45deg, #22c55e, #16a34a, #22c55e, #16a34a)';
    toggleButton.style.backgroundSize = '400% 400%';
    toggleButton.style.backgroundClip = 'text';
    toggleButton.style.webkitBackgroundClip = 'text';
    toggleButton.style.webkitTextFillColor = 'transparent';
    toggleButton.style.animation = 'taskerShimmer 2s ease-in-out infinite';
    
    // Add CSS keyframes for shimmer animation if not already added
    if (!document.getElementById('taskerShimmerCSS')) {
        const style = document.createElement('style');
        style.id = 'taskerShimmerCSS';
        style.textContent = `
            @keyframes taskerShimmer {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Quest button modification is now handled after Start button click (like Raid Hunter)
}

// ============================================================================
// QUEST BUTTON MODIFICATION FUNCTIONS
// ============================================================================

// Store original quest button state
let originalQuestButtonState = null;
let questButtonValidationInterval = null;

// Store the map ID when tasking starts (after Start button click)
let taskingMapId = null;

// Function to get current room ID
function getCurrentRoomId() {
    try {
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (boardContext && boardContext.selectedMap && boardContext.selectedMap.selectedRoom) {
            return boardContext.selectedMap.selectedRoom.id;
        }
        return null;
    } catch (error) {
        console.error('[Better Tasker] Error getting current room ID:', error);
        return null;
    }
}

// Function to get room ID for a map name
function getRoomIdForMapName(mapName) {
    try {
        // Get all available maps from the game state
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (boardContext && boardContext.maps) {
            // Look through all maps to find one that matches the name
            for (const map of boardContext.maps) {
                if (map.name === mapName) {
                    // Return the first room ID of this map
                    if (map.rooms && map.rooms.length > 0) {
                        console.log(`[Better Tasker] Found room ID for map "${mapName}": ${map.rooms[0].id}`);
                        return map.rooms[0].id;
                    }
                }
            }
        }
        
        console.log(`[Better Tasker] No room ID found for map: ${mapName}`);
        return null;
    } catch (error) {
        console.error('[Better Tasker] Error getting room ID for map name:', error);
        return null;
    }
}

// Function to check if user is on the correct tasking map
function isOnCorrectTaskingMap() {
    if (!taskInProgress && !taskHuntingOngoing) {
        return false;
    }
    
    const currentRoomId = getCurrentRoomId();
    if (!currentRoomId) {
        console.log('[Better Tasker] Could not determine current room ID');
        return false;
    }
    
    // If we have a saved tasking map ID, compare with current map
    if (taskingMapId) {
        const isCorrectMap = currentRoomId === taskingMapId;
        console.log(`[Better Tasker] Map validation: current=${currentRoomId}, tasking=${taskingMapId}, correct=${isCorrectMap}`);
        return isCorrectMap;
    }
    
    // Fallback: Get the recommended map for the current task (for initial setup)
    try {
        const playerContext = globalThis.state.player.getSnapshot().context;
        const task = playerContext?.questLog?.task;
        
        if (task && task.suggestedMap) {
            const recommendedMapName = task.suggestedMap;
            console.log(`[Better Tasker] Task recommended map: ${recommendedMapName}`);
            
            // Check if current map matches recommended map
            const recommendedRoomId = getRoomIdForMapName(recommendedMapName);
            
            if (recommendedRoomId) {
                const isCorrectMap = currentRoomId === recommendedRoomId;
                console.log(`[Better Tasker] Map validation (fallback): current=${currentRoomId}, recommended=${recommendedRoomId}, correct=${isCorrectMap}`);
                return isCorrectMap;
            } else {
                console.log(`[Better Tasker] Could not find room ID for recommended map: ${recommendedMapName}`);
                return true;
            }
        } else {
            console.log('[Better Tasker] No task or recommended map found - allowing any map');
            return true;
        }
    } catch (error) {
        console.error('[Better Tasker] Error checking recommended map:', error);
        return true;
    }
}

// Function to find quest button with multiple fallback selectors
function findQuestButton() {
    // First, try to find by quest icon (normal state) - check both selected and unselected
    const questIconButton = document.querySelector('button img[src*="quest.png"]')?.closest('button');
    if (questIconButton) {
        console.log('[Better Tasker] Found quest button by quest icon');
        return questIconButton;
    }
    
    // Then, look for any button with "Tasking" text - check both selected and unselected
    const allButtons = document.querySelectorAll('button');
    for (const button of allButtons) {
        const span = button.querySelector('span');
        if (span && span.textContent === 'Tasking') {
            console.log('[Better Tasker] Found quest button by Tasking text');
            return button;
        }
    }
    
    // Fallback: look for any button with quest-related alt text - check both selected and unselected
    const questAltButton = document.querySelector('button img[alt="Quests"]')?.closest('button');
    if (questAltButton) {
        console.log('[Better Tasker] Found quest button by quest alt text');
        return questAltButton;
    }
    
    // Additional fallback: look for any button with "Quests" text
    for (const button of allButtons) {
        const span = button.querySelector('span');
        if (span && span.textContent === 'Quests') {
            console.log('[Better Tasker] Found quest button by Quests text');
            return button;
        }
    }
    
    console.log('[Better Tasker] Quest button not found');
    return null;
}

// Function to modify quest button appearance when tasking is active
function modifyQuestButtonForTasking() {
    try {
        console.log('[Better Tasker] Attempting to modify quest button for tasking...');
        
        // Request control of quest button
        if (!window.QuestButtonManager.requestControl('Better Tasker')) {
            console.log('[Better Tasker] Cannot modify quest button - controlled by another mod');
            return false;
        }
        
        console.log('[Better Tasker] Quest button control granted, finding quest button...');
        
        // Find the quest button in the header navigation
        const questButton = findQuestButton();
        
        if (!questButton) {
            console.log('[Better Tasker] Quest button not found for modification');
            window.QuestButtonManager.releaseControl('Better Tasker');
            return false;
        }
        
        console.log('[Better Tasker] Quest button found, proceeding with modification...');
        
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
        
        // Replace the icon with taskrank icon
        if (img) {
            img.src = 'https://bestiaryarena.com/assets/icons/taskrank.png';
            img.alt = 'Tasking';
            img.style.display = ''; // Make sure it's visible
        }
        
        // Change text to "Tasking"
        if (span) {
            span.textContent = 'Tasking';
            // Add shimmer effect to the text
            span.style.background = 'linear-gradient(45deg, #22c55e, #16a34a, #22c55e, #16a34a)';
            span.style.backgroundSize = '400% 400%';
            span.style.backgroundClip = 'text';
            span.style.webkitBackgroundClip = 'text';
            span.style.webkitTextFillColor = 'transparent';
            span.style.animation = 'taskerShimmer 2s ease-in-out infinite';
        }
        
        // Add CSS keyframes for shimmer animation if not already added
        if (!document.getElementById('taskerShimmerCSS')) {
            const style = document.createElement('style');
            style.id = 'taskerShimmerCSS';
            style.textContent = `
                @keyframes taskerShimmer {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Set green color for the button
        questButton.style.color = '#22c55e'; // Green color
        
        console.log('[Better Tasker] Quest button modified for tasking state');
        return true;
    } catch (error) {
        console.error('[Better Tasker] Error modifying quest button for tasking:', error);
        window.QuestButtonManager.releaseControl('Better Tasker');
        return false;
    }
}

// Function to restore quest button to original appearance
function restoreQuestButtonAppearance() {
    try {
        // Only restore if we have control
        if (!window.QuestButtonManager.hasControl('Better Tasker')) {
            console.log('[Better Tasker] Cannot restore quest button - not controlled by Better Tasker');
            return false;
        }
        
        // Find the quest button - try multiple selectors to find it regardless of current state
        const questButton = findQuestButton();
        
        if (!questButton) {
            console.log('[Better Tasker] Quest button not found for restoration');
            window.QuestButtonManager.releaseControl('Better Tasker');
            return false;
        }
        
        if (!window.QuestButtonManager.originalState) {
            console.log('[Better Tasker] Original quest button state not found for restoration');
            window.QuestButtonManager.releaseControl('Better Tasker');
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
        window.QuestButtonManager.releaseControl('Better Tasker');
        
        console.log('[Better Tasker] Quest button appearance restored');
        return true;
    } catch (error) {
        console.error('[Better Tasker] Error restoring quest button appearance:', error);
        window.QuestButtonManager.releaseControl('Better Tasker');
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
    
    // Only start monitoring if we're currently tasking or hunting
    if (!taskInProgress && !taskHuntingOngoing) {
        return;
    }
    
    console.log('[Better Tasker] Starting quest button validation monitoring');
    
    questButtonValidationInterval = setInterval(() => {
        try {
            // Check if we're still tasking or hunting
            if (!taskInProgress && !taskHuntingOngoing) {
                console.log('[Better Tasker] No longer tasking or hunting - stopping quest button validation');
                stopQuestButtonValidation();
                return;
            }
            
            // Check if we're on the correct map for tasking
            if (!isOnCorrectTaskingMap()) {
                console.log('[Better Tasker] User navigated away from tasking map - restoring quest button and clearing saved map ID');
                restoreQuestButtonAppearance();
                // Clear the saved tasking map ID since user switched maps
                taskingMapId = null;
                console.log('[Better Tasker] Cleared tasking map ID - quest button reset to normal state');
                // Don't stop the interval - keep monitoring in case they come back
                return;
            }
            
            // Only maintain quest button state if we have control and it's already in tasking state
            // Don't modify it here - quest button should only be modified AFTER Start button click
            if (window.QuestButtonManager.hasControl('Better Tasker')) {
                const questButton = findQuestButton();
                
                if (questButton) {
                    // Check if quest button is already in tasking state
                    const img = questButton.querySelector('img');
                    const span = questButton.querySelector('span');
                    const isInTaskingState = img && img.src.includes('taskrank.png') && span && span.textContent === 'Tasking';
                    
                    if (!isInTaskingState) {
                        // Quest button is not in tasking state - this means it was reset or never set
                        // Only restore it if we're actually tasking (after Start button was clicked)
                        console.log('[Better Tasker] Quest button not in tasking state - checking if we should restore it');
                        // Don't automatically modify it - only restore if it was previously set
                    }
                }
            } else {
                // We don't have control - check if Raid Hunter has control
                const currentOwner = window.QuestButtonManager.getCurrentOwner();
                if (currentOwner === 'Raid Hunter') {
                    // Raid Hunter has control, don't interfere
                    console.log('[Better Tasker] Raid Hunter has quest button control - not interfering');
                } else {
                    // No one has control - quest button should be in normal state
                    console.log('[Better Tasker] No quest button control - quest button should be in normal state');
                }
            }
        } catch (error) {
            console.error('[Better Tasker] Error in quest button validation:', error);
        }
    }, 2000); // Check every 2 seconds
}

// Function to stop monitoring quest button validation
function stopQuestButtonValidation() {
    if (questButtonValidationInterval) {
        clearInterval(questButtonValidationInterval);
        questButtonValidationInterval = null;
        console.log('[Better Tasker] Quest button validation monitoring stopped');
    }
    
    // Clear the saved tasking map ID when stopping validation
    if (taskingMapId) {
        console.log(`[Better Tasker] Clearing saved tasking map ID: ${taskingMapId}`);
        taskingMapId = null;
    }
}

// ============================================================================
// 5. QUEST LOG MONITORING
// ============================================================================

// Check for quest log content
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

// Check for Paw and Fur Society content
function checkForPawAndFurContent(node) {
    return node.textContent?.includes('Paw and Fur Society') || 
           (node.querySelector?.('*') && 
            Array.from(node.querySelectorAll('*')).some(el => 
              el.textContent?.includes('Paw and Fur Society')
            ));
}

// Consolidated mutation processing
function debouncedProcessAllMutations(mutations) {
    // Only process mutations if tasker is enabled
    if (!isTaskerEnabled) {
        return;
    }
    
    // Don't process mutations if task hunting is ongoing
    if (taskHuntingOngoing) {
        return;
    }
    
    let hasQuestLogContent = false;
    let hasPawAndFurContent = false;
    
    // Process all mutations in one pass
    for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check for quest log content
                    if (!hasQuestLogContent) {
                        hasQuestLogContent = checkForQuestLogContent(node);
                    }
                    
                    // Check for Paw and Fur Society content
                    if (!hasPawAndFurContent) {
                        hasPawAndFurContent = checkForPawAndFurContent(node);
                    }
                }
            }
        }
    }
    
    // Handle quest log detection
    if (hasQuestLogContent) {
        console.log('[Better Tasker] Quest log content detected!');
        
        // Try to insert buttons with a small delay
        setTimeout(() => {
            insertButtons();
        }, 100);
    }
    
    // Handle Paw and Fur Society detection
    if (hasPawAndFurContent) {
        console.log('[Better Tasker] Paw and Fur Society content detected!');
        
        // Try to insert buttons immediately
        insertButtons();
    }
}

// Monitors quest log visibility
function monitorQuestLogVisibility() {
    // Skip if observer already exists
    if (questLogObserver) {
        console.log('[Better Tasker] Observer already exists, skipping');
        return;
    }
    
    // Consolidated MutationObserver for quest log and Paw and Fur Society detection
    questLogObserver = new MutationObserver(debouncedProcessAllMutations);
    
    questLogObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('[Better Tasker] MutationObserver set up for quest log and Paw and Fur Society detection');
}

// Starts quest log monitoring
function startQuestLogMonitoring() {
    console.log('[Better Tasker] Starting quest log monitoring...');
    
    // Clear any existing monitoring first
    if (questLogMonitorInterval) {
        console.log('[Better Tasker] Clearing existing interval');
        clearInterval(questLogMonitorInterval);
        questLogMonitorInterval = null;
    }
    
    if (questLogObserver) {
        console.log('[Better Tasker] Disconnecting existing observer');
        questLogObserver.disconnect();
        questLogObserver = null;
    }
    
    // Set up MutationObserver for quest log detection
    monitorQuestLogVisibility();
    
    // Simple interval monitoring as backup
    questLogMonitorInterval = setInterval(() => {
        // Try to insert buttons
        insertButtons();
    }, 2000);
}

// ============================================================================
// 5. SETTINGS MODAL
// ============================================================================

// Cleanup function for modal state
function cleanupTaskerModal() {
    try {
        // Clear modal reference
        if (activeTaskerModal) {
            activeTaskerModal = null;
        }
        
        // Remove ESC key listener
        if (escKeyListener) {
            document.removeEventListener('keydown', escKeyListener);
            escKeyListener = null;
        }
        
        // Reset modal state
        taskerModalInProgress = false;
        lastModalCall = 0;
        
        console.log('[Better Tasker] Modal cleanup completed');
    } catch (error) {
        console.error('[Better Tasker] Error during modal cleanup:', error);
    }
}

// Constants for modal dimensions
const TASKER_MODAL_WIDTH = 700;
const TASKER_MODAL_HEIGHT = 400;

// Open Tasker Settings Modal
function openTaskerSettingsModal() {
    try {
        const now = Date.now();
        if (taskerModalInProgress) return;
        if (now - lastModalCall < 1000) return;
        
        lastModalCall = now;
        taskerModalInProgress = true;
        
        (() => {
            try {
                if (!taskerModalInProgress) return;
                
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
                            
                            // Open modal
                            activeTaskerModal = context.api.ui.components.createModal({
                                title: 'Better Tasker Settings',
                                width: TASKER_MODAL_WIDTH,
                                height: TASKER_MODAL_HEIGHT,
                                content: settingsContent,
                                buttons: [{ text: 'Close', primary: true }],
                                onClose: () => {
                                    console.log('[Better Tasker] Settings modal closed');
                                    cleanupTaskerModal();
                                }
                            });
                            
                            // Add ESC key support for closing modal
                            escKeyListener = (event) => {
                                if (event.key === 'Escape' && activeTaskerModal) {
                                    console.log('[Better Tasker] ESC key pressed, closing modal');
                                    cleanupTaskerModal();
                                }
                            };
                            document.addEventListener('keydown', escKeyListener);
                            
                            // Override modal size and load settings
                            setTimeout(() => {
                                const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
                                if (dialog) {
                                    dialog.style.width = TASKER_MODAL_WIDTH + 'px';
                                    dialog.style.minWidth = TASKER_MODAL_WIDTH + 'px';
                                    dialog.style.maxWidth = TASKER_MODAL_WIDTH + 'px';
                                    dialog.style.height = TASKER_MODAL_HEIGHT + 'px';
                                    dialog.style.minHeight = TASKER_MODAL_HEIGHT + 'px';
                                    dialog.style.maxHeight = TASKER_MODAL_HEIGHT + 'px';
                                    
                                    // Load and apply saved settings
                                    loadAndApplySettings();
                                }
                            }, 50);
                        } catch (error) {
                            console.error('[Better Tasker] Error creating modal:', error);
                            try {
                                alert('Failed to open settings. Please try again.');
                            } catch (alertError) {
                                console.error('[Better Tasker] Even fallback alert failed:', alertError);
                            }
                        } finally {
                            taskerModalInProgress = false;
                        }
                    } else {
                        console.warn('[Better Tasker] API not available for modal creation');
                        alert('Better Tasker Settings - API not available');
                        taskerModalInProgress = false;
                    }
                }, 100);
            } catch (error) {
                console.error('[Better Tasker] Error in modal creation wrapper:', error);
                taskerModalInProgress = false;
            }
        })();
        
    } catch (error) {
        console.error('[Better Tasker] Error in openTaskerSettingsModal:', error);
        taskerModalInProgress = false;
    }
}

// Create settings content
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
    
    // Left column - Auto-Task Settings
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
    
    // Right column - Task Settings
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
    
    // Left column content - Auto-Task Settings
    const leftContent = createGeneralSettings();
    leftColumn.appendChild(leftContent);
    
    // Right column content - Task Settings
    const rightContent = createTaskSettings();
    rightColumn.appendChild(rightContent);
    
    mainContainer.appendChild(leftColumn);
    mainContainer.appendChild(rightColumn);
    
    return mainContainer;
}

// Create Auto-Task Settings section
function createGeneralSettings() {
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
    title.textContent = 'Auto-Task Settings';
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0 0 10px 0;
        color: #ffe066;
        font-weight: bold;
        text-align: center;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    container.appendChild(title);
    
    // Create wrapper for main settings content that will be centered
    const settingsWrapper = document.createElement('div');
    settingsWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex: 1;
        justify-content: center;
    `;
    
    // Task Start Delay setting
    const taskDelayDiv = document.createElement('div');
    taskDelayDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    const taskDelayLabel = document.createElement('label');
    taskDelayLabel.textContent = 'Task Start Delay (seconds)';
    taskDelayLabel.className = 'pixel-font-16';
    taskDelayLabel.style.cssText = `
        font-weight: bold;
        color: #fff;
        margin-bottom: 4px;
    `;
    taskDelayDiv.appendChild(taskDelayLabel);
    
    const taskDelayInput = document.createElement('input');
    taskDelayInput.type = 'number';
    taskDelayInput.id = 'taskStartDelay';
    taskDelayInput.value = 3;
    taskDelayInput.min = 0;
    taskDelayInput.max = 10;
    taskDelayInput.className = 'pixel-font-16';
    taskDelayInput.style.cssText = `
        width: 100%;
        padding: 6px;
        background: #333;
        border: 1px solid #ffe066;
        color: #fff;
        border-radius: 3px;
        box-sizing: border-box;
        font-size: 14px;
    `;
    // Add auto-save listener immediately
    taskDelayInput.addEventListener('input', autoSaveSettings);
    taskDelayDiv.appendChild(taskDelayInput);
    
    const taskDelayDesc = document.createElement('div');
    taskDelayDesc.textContent = 'Delay before starting a task after detection';
    taskDelayDesc.className = 'pixel-font-16';
    taskDelayDesc.style.cssText = `
        font-size: 11px;
        color: #888;
        font-style: italic;
        margin-top: 2px;
    `;
    taskDelayDiv.appendChild(taskDelayDesc);
    settingsWrapper.appendChild(taskDelayDiv);
    
    // Auto-refill Stamina setting
    const staminaRefillDiv = document.createElement('div');
    staminaRefillDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    // Container for checkbox and label on same line
    const staminaRefillCheckboxLabelContainer = document.createElement('div');
    staminaRefillCheckboxLabelContainer.style.cssText = `
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
    staminaRefillCheckboxLabelContainer.appendChild(staminaRefillCheckbox);
    
    const staminaRefillLabel = document.createElement('label');
    staminaRefillLabel.textContent = 'Auto-refill Stamina';
    staminaRefillLabel.className = 'pixel-font-16';
    staminaRefillLabel.style.cssText = `
        font-weight: bold;
        color: #fff;
        cursor: pointer;
    `;
    staminaRefillLabel.setAttribute('for', 'autoRefillStamina');
    staminaRefillCheckboxLabelContainer.appendChild(staminaRefillLabel);
    
    staminaRefillDiv.appendChild(staminaRefillCheckboxLabelContainer);
    
    const staminaRefillDesc = document.createElement('div');
    staminaRefillDesc.textContent = 'Automatically refill stamina when starting a task';
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
    fasterAutoplayDesc.textContent = 'Enable faster autoplay speed during tasks (removes delays and increases game speed)';
    fasterAutoplayDesc.className = 'pixel-font-16';
    fasterAutoplayDesc.style.cssText = `
        font-size: 11px;
        color: #888;
        font-style: italic;
        margin-top: 2px;
    `;
    fasterAutoplayDiv.appendChild(fasterAutoplayDesc);
    settingsWrapper.appendChild(fasterAutoplayDiv);
    
    // Auto-complete Tasks setting
    const autoCompleteDiv = document.createElement('div');
    autoCompleteDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    // Container for checkbox and label on same line
    const autoCompleteCheckboxLabelContainer = document.createElement('div');
    autoCompleteCheckboxLabelContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
    `;
    
    const autoCompleteCheckbox = document.createElement('input');
    autoCompleteCheckbox.type = 'checkbox';
    autoCompleteCheckbox.id = 'autoCompleteTasks';
    autoCompleteCheckbox.checked = true;
    autoCompleteCheckbox.style.cssText = `
        width: 16px;
        height: 16px;
        accent-color: #ffe066;
    `;
    // Add auto-save listener immediately
    autoCompleteCheckbox.addEventListener('change', autoSaveSettings);
    autoCompleteCheckboxLabelContainer.appendChild(autoCompleteCheckbox);
    
    const autoCompleteLabel = document.createElement('label');
    autoCompleteLabel.textContent = 'Autocomplete Tasks';
    autoCompleteLabel.className = 'pixel-font-16';
    autoCompleteLabel.style.cssText = `
        font-weight: bold;
        color: #fff;
        cursor: pointer;
    `;
    autoCompleteLabel.setAttribute('for', 'autoCompleteTasks');
    autoCompleteCheckboxLabelContainer.appendChild(autoCompleteLabel);
    
    autoCompleteDiv.appendChild(autoCompleteCheckboxLabelContainer);
    
    const autoCompleteDesc = document.createElement('div');
    autoCompleteDesc.textContent = 'Automatically complete tasks when possible';
    autoCompleteDesc.className = 'pixel-font-16';
    autoCompleteDesc.style.cssText = `
        color: #888;
        font-style: italic;
        margin-top: 2px;
    `;
    autoCompleteDiv.appendChild(autoCompleteDesc);
    settingsWrapper.appendChild(autoCompleteDiv);
    
    // Add settings wrapper to container
    container.appendChild(settingsWrapper);
    
    
    return container;
}

// Create Task Settings section
function createTaskSettings() {
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
    
    // Monster Selection Settings
    const monsterSection = createMonsterSelectionSettings();
    container.appendChild(monsterSection);
    
    return container;
}

// Create Monster Selection Settings section
function createMonsterSelectionSettings() {
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
    title.textContent = 'Monster Selection';
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0 0 15px 0;
        color: #ffe066;
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    section.appendChild(title);
    
    const description = document.createElement('div');
    description.textContent = 'Select which creatures you want to hunt for tasks:';
    description.className = 'pixel-font-16';
    description.style.cssText = `
        margin-bottom: 15px;
        color: #888;
        font-style: italic;
    `;
    section.appendChild(description);
    
    // Add warning about active tasks
    const warning = document.createElement('div');
    warning.className = 'pixel-font-14';
    warning.style.cssText = `
        margin-bottom: 15px;
        padding: 8px 12px;
        background: rgba(255, 193, 7, 0.1);
        border: 1px solid rgba(255, 193, 7, 0.3);
        border-radius: 4px;
        color: #ffc107;
        font-weight: bold;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    `;
    
    // Create monster selection container first
    const monsterContainer = document.createElement('div');
    monsterContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        max-height: 190px;
        overflow-y: auto;
        border: 1px solid #555;
        border-radius: 3px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.3);
    `;
    
    // Get creatures from the creature database
    const creatures = window.creatureDatabase?.ALL_CREATURES || [];
    
    if (creatures.length === 0) {
        const noCreaturesDiv = document.createElement('div');
        noCreaturesDiv.textContent = 'No creatures available. Please refresh the page.';
        noCreaturesDiv.className = 'pixel-font-16';
        noCreaturesDiv.style.cssText = `
            color: #888;
            font-style: italic;
            text-align: center;
            padding: 20px;
        `;
        monsterContainer.appendChild(noCreaturesDiv);
    } else {
        // Create checkboxes for each creature
        creatures.forEach(creatureName => {
            const creatureDiv = document.createElement('div');
            creatureDiv.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 2px 0;
            `;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `creature-${creatureName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
            checkbox.checked = true; // Default to enabled
            checkbox.style.cssText = `
                width: 16px;
                height: 16px;
                accent-color: #ffe066;
            `;
            
            const label = document.createElement('label');
            label.textContent = creatureName;
            label.className = 'pixel-font-16';
            label.style.cssText = `
                color: #fff;
                cursor: pointer;
                flex: 1;
            `;
            label.setAttribute('for', checkbox.id);
            
        // Create warning symbol for unselected creatures
        const warningSymbol = document.createElement('span');
        warningSymbol.textContent = '⚠️';
        warningSymbol.className = 'creature-warning-symbol';
        warningSymbol.style.cssText = `
            color: #ffc107;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.2s ease;
            cursor: help;
        `;
        warningSymbol.setAttribute('title', 'Unselected creatures will cause active tasks to be removed');
            
        // Function to update warning visibility and count
        const updateWarningVisibility = () => {
            warningSymbol.style.opacity = checkbox.checked ? '0' : '1';
            window.updateWarningText(); // Update the warning count
        };
            
            // Add change listener to checkbox
            checkbox.addEventListener('change', updateWarningVisibility);
            
            creatureDiv.appendChild(checkbox);
            creatureDiv.appendChild(warningSymbol);
            creatureDiv.appendChild(label);
            monsterContainer.appendChild(creatureDiv);
        });
    }
    
    // Function to update warning text with count (defined after monsterContainer is created)
    window.updateWarningText = () => {
        const checkboxes = monsterContainer.querySelectorAll('input[type="checkbox"]');
        const totalCreatures = checkboxes.length;
        const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        warning.textContent = `⚠️ Warning: Unselected creatures will cause active tasks to be removed! (${selectedCount}/${totalCreatures} selected creatures)`;
    };
    
    // Add warning before monster container
    section.appendChild(warning);
    section.appendChild(monsterContainer);
    
    // Set initial warning text AFTER monsterContainer is added to DOM
    window.updateWarningText();
    
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
        const checkboxes = monsterContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = true;
            // Hide warning symbol for this checkbox
            const warningSymbol = cb.parentElement.querySelector('.creature-warning-symbol');
            if (warningSymbol) {
                warningSymbol.style.opacity = '0';
            }
        });
        window.updateWarningText(); // Update the warning count
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
        const checkboxes = monsterContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = false;
            // Show warning symbol for this checkbox
            const warningSymbol = cb.parentElement.querySelector('.creature-warning-symbol');
            if (warningSymbol) {
                warningSymbol.style.opacity = '1';
            }
        });
        window.updateWarningText(); // Update the warning count
        autoSaveSettings(); // Auto-save after selecting none
    });
    
    buttonContainer.appendChild(selectAllBtn);
    buttonContainer.appendChild(selectNoneBtn);
    section.appendChild(buttonContainer);
    
    return section;
}

// ============================================================================
// 6. SETTINGS PERSISTENCE
// ============================================================================

// Load settings function
function loadSettings() {
    const defaultSettings = {
        autoCompleteTasks: true,
        autoRefillStamina: false,
        fasterAutoplay: false,
        // Default all creatures to enabled
        ...Object.fromEntries(
            (window.creatureDatabase?.ALL_CREATURES || []).map(creature => 
                [`creature-${creature.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`, true]
            )
        )
    };
    
    const saved = localStorage.getItem('betterTaskerSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            return { ...defaultSettings, ...parsed };
        } catch (error) {
            console.error('[Better Tasker] Error parsing settings:', error);
        }
    }
    return defaultSettings;
}

// Auto-save settings when changed
function autoSaveSettings() {
    try {
        const settings = {};
        const inputs = document.querySelectorAll('input, select');
        
        inputs.forEach(input => {
            // Only process inputs that belong to Better Tasker settings
            if (input.id === 'autoCompleteTasks' || input.id === 'autoRefillStamina' || input.id === 'fasterAutoplay' || input.id === 'taskStartDelay' || input.id.startsWith('creature-')) {
                if (input.type === 'checkbox') {
                    settings[input.id] = input.checked;
                } else {
                    settings[input.id] = input.value;
                }
            }
        });
        
        // Save to localStorage
        localStorage.setItem('betterTaskerSettings', JSON.stringify(settings));
        console.log('[Better Tasker] Settings auto-saved:', settings);
    } catch (error) {
        console.error('[Better Tasker] Error auto-saving settings:', error);
    }
}

// Load and apply settings to the modal
function loadAndApplySettings() {
    try {
        const settings = loadSettings();
        
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
        
        if (settings.autoCompleteTasks !== undefined) {
            const checkbox = document.getElementById('autoCompleteTasks');
            if (checkbox) {
                checkbox.checked = settings.autoCompleteTasks;
                // Add auto-save listener
                checkbox.addEventListener('change', autoSaveSettings);
            }
        }
        
        if (settings.taskStartDelay !== undefined) {
            const input = document.getElementById('taskStartDelay');
            if (input) {
                input.value = settings.taskStartDelay;
                // Add auto-save listener
                input.addEventListener('input', autoSaveSettings);
            }
        }
        
        // Apply creature selections from individual settings
        const creatures = window.creatureDatabase?.ALL_CREATURES || [];
        console.log('[Better Tasker] Loading creature settings:', {
            hasIndividualSettings: Object.keys(settings).some(key => key.startsWith('creature-'))
        });
        
        creatures.forEach(creatureName => {
            const checkboxId = `creature-${creatureName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                // Use individual creature setting
                const individualSetting = settings[checkboxId];
                checkbox.checked = individualSetting !== undefined ? individualSetting : true;
                
                // Update warning symbol visibility based on checkbox state
                const warningSymbol = checkbox.parentElement.querySelector('.creature-warning-symbol');
                if (warningSymbol) {
                    warningSymbol.style.opacity = checkbox.checked ? '0' : '1';
                }
            }
        });
        
        // Add auto-save listeners to all creature checkboxes
        creatures.forEach(creatureName => {
            const checkboxId = `creature-${creatureName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                checkbox.addEventListener('change', autoSaveSettings);
            }
        });
        
        // Update warning text count after loading settings
        if (typeof window.updateWarningText === 'function') {
            window.updateWarningText();
        }
        
        console.log('[Better Tasker] Settings applied to modal with auto-save listeners');
    } catch (error) {
        console.error('[Better Tasker] Error applying settings:', error);
    }
}

// ============================================================================
// 7. TASK HANDLING FUNCTIONS
// ============================================================================

// Check if game is active and ready for task operations
function isGameActive() {
    try {
        // Check if Game State API is available
        if (!globalThis.state || !globalThis.state.board) {
            console.log('[Better Tasker] Game State API not available');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('[Better Tasker] Error checking game state:', error);
        return false;
    }
}

// Check if quest blip exists (indicates task is ready)
function isQuestBlipAvailable() {
    try {
        // Check for quest blip (pending task indicator)
        const questBlip = document.querySelector('img[src*="quest-blip.png"]');
        
        if (questBlip) {
            console.log('[Better Tasker] Quest blip found - task is ready');
            return true;
        }
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error checking quest blip:', error);
        return false;
    }
}

// Navigate to suggested map and start autoplay using API
async function navigateToSuggestedMapAndStartAutoplay(suggestedMapElement = null) {
    try {
        console.log('[Better Tasker] Looking for suggested map link...');
        
        // Wait a bit for the quest log to fully load
        await sleep(300);
        
        // Use provided element or look for the suggested map link
        let suggestedMapLink = suggestedMapElement;
        if (!suggestedMapLink) {
            // Look for the suggested map link only within Paw and Fur Society section
            console.log('[Better Tasker] No specific element provided, searching within Paw and Fur Society section...');
            const pawAndFurSection = findPawAndFurSection();
            if (pawAndFurSection) {
                console.log('[Better Tasker] Paw and Fur Society section found, looking for suggested map...');
                // Look for suggested map text within this section
                const allParagraphs = pawAndFurSection.querySelectorAll('p.pixel-font-14');
                for (const p of allParagraphs) {
                    if (p.textContent && p.textContent.includes('Suggested map:')) {
                        suggestedMapLink = p.querySelector('span.action-link');
                        console.log('[Better Tasker] Suggested map found within Paw and Fur Society section');
                        break;
                    }
                }
            } else {
                console.log('[Better Tasker] Paw and Fur Society section not found');
            }
            
            // If still no link found in Paw and Fur Society section, don't proceed
            if (!suggestedMapLink) {
                console.log('[Better Tasker] No suggested map found in Paw and Fur Society section');
                return;
            }
        } else {
            console.log('[Better Tasker] Using provided suggested map element (already validated)');
        }
        if (suggestedMapLink) {
            console.log('[Better Tasker] Suggested map link found, extracting map info...');
            console.log('[Better Tasker] Attempting to extract room ID from suggested map...');
            
            // Debug: Log all attributes of the suggested map element
            console.log('[Better Tasker] Suggested map element attributes:', {
                tagName: suggestedMapLink.tagName,
                className: suggestedMapLink.className,
                id: suggestedMapLink.id,
                textContent: suggestedMapLink.textContent.trim(),
                allAttributes: Array.from(suggestedMapLink.attributes).map(attr => `${attr.name}="${attr.value}"`)
            });
            
            // Extract map name from text content
            const mapName = suggestedMapLink.textContent.trim();
            console.log('[Better Tasker] Extracted map name:', mapName);
            
            // Try to find room ID using game state API
            let roomId = null;
            if (globalThis.state?.utils?.ROOM_NAME) {
                // Find room ID by map name
                for (const [id, name] of Object.entries(globalThis.state.utils.ROOM_NAME)) {
                    if (name === mapName) {
                        roomId = id;
                        break;
                    }
                }
            }
            
            if (roomId) {
                console.log('[Better Tasker] Found room ID for map:', mapName, '->', roomId);
                
                // Now simulate ESC key presses to clear quest log
                console.log('[Better Tasker] Simulating ESC key presses to clear quest log...');
                for (let i = 0; i < 3; i++) {
                    const escEvent = new KeyboardEvent('keydown', {
                        key: 'Escape',
                        code: 'Escape',
                        keyCode: 27,
                        which: 27,
                        bubbles: true,
                        cancelable: true
                    });
                    document.dispatchEvent(escEvent);
                    await sleep(50); // Small delay between ESC presses
                }
                
                // Wait for quest log to clear
                await sleep(200);
                console.log('[Better Tasker] Quest log cleared with ESC presses');
                
                // Use API to navigate to the remembered map
                console.log('[Better Tasker] Navigating to suggested map via API...');
                globalThis.state.board.send({
                    type: 'selectRoomById',
                    roomId: roomId
                });
                await sleep(200);
                
                // Wait for map to load
                await sleep(1000);
                console.log('[Better Tasker] Navigation to suggested map completed via API');
                
                // Find and click Auto-setup button
                console.log('[Better Tasker] Looking for Auto-setup button...');
                const autoSetupButton = findButtonByText('Auto-setup');
                if (!autoSetupButton) {
                    console.log('[Better Tasker] Auto-setup button not found');
                    return;
                }
                
                console.log('[Better Tasker] Clicking Auto-setup button...');
                autoSetupButton.click();
                await sleep(1000);
                
                // Enable autoplay mode
                console.log('[Better Tasker] Enabling autoplay mode...');
                await ensureAutoplayMode();
                await sleep(1000);
                
                // Enable Bestiary Automator settings if configured
                const settings = loadSettings();
                if (settings.autoRefillStamina) {
                    console.log('[Better Tasker] Auto-refill stamina enabled - enabling Bestiary Automator autorefill...');
                    // Add a small delay to ensure Bestiary Automator is fully initialized
                    setTimeout(() => {
                        const success = enableBestiaryAutomatorStaminaRefill();
                        if (!success) {
                            // If first attempt failed, try again with longer delay for Chrome
                            console.log('[Better Tasker] First attempt failed, retrying with longer delay for Chrome...');
                            setTimeout(() => {
                                enableBestiaryAutomatorStaminaRefill();
                            }, 2000);
                        }
                    }, 500);
                }
                if (settings.fasterAutoplay) {
                    console.log('[Better Tasker] Faster autoplay enabled - enabling Bestiary Automator faster autoplay...');
                    // Add a small delay to ensure Bestiary Automator is fully initialized
                    setTimeout(() => {
                        const success = enableBestiaryAutomatorFasterAutoplay();
                        if (!success) {
                            // If first attempt failed, try again with longer delay for Chrome
                            console.log('[Better Tasker] First attempt failed, retrying with longer delay for Chrome...');
                            setTimeout(() => {
                                enableBestiaryAutomatorFasterAutoplay();
                            }, 2000);
                        }
                    }, 500);
                }
                
                // Set flag BEFORE clicking Start to prevent rechecking during ongoing task
                taskNavigationCompleted = true;
                console.log('[Better Tasker] Task navigation flag set - will not repeat quest log navigation during ongoing task');
                
                // Find and click Start button
                console.log('[Better Tasker] Looking for Start button...');
                const startButton = findButtonByText('Start');
                if (!startButton) {
                    console.log('[Better Tasker] Start button not found');
                    return;
                }
                
                console.log('[Better Tasker] Clicking Start button...');
                startButton.click();
                
                // Save the current map ID for tasking validation
                const currentMapId = getCurrentRoomId();
                if (currentMapId) {
                    taskingMapId = currentMapId;
                    console.log(`[Better Tasker] Saved tasking map ID: ${taskingMapId}`);
                } else {
                    console.log('[Better Tasker] Could not save tasking map ID - map validation may not work properly');
                }
                
                // Set task hunting flag to prevent further automation
                taskHuntingOngoing = true;
                // Keep task in progress flag true - task is still active until completed
                // taskInProgress remains true to indicate an active task
                updateExposedState(); // Update exposed state for other mods
                console.log('[Better Tasker] Task hunting flag set - automation disabled until task completion');
                
                // Update button to show "Tasking" state
                updateToggleButtonForTasking();
                
                // Modify quest button appearance to show tasking state (after Start button click, like Raid Hunter)
                modifyQuestButtonForTasking();
                
                // Start quest button validation monitoring for task hunting
                startQuestButtonValidation();
                
                await sleep(200);
                
                console.log('[Better Tasker] Navigation and setup completed');
                
                return;
            } else {
                console.log('[Better Tasker] No room ID found for map name:', mapName);
                console.log('[Better Tasker] Available maps:', globalThis.state?.utils?.ROOM_NAME ? Object.values(globalThis.state.utils.ROOM_NAME) : 'Not available');
            }
        }
        
        // If no suggested map found or no room ID extracted, log and return
        console.log('[Better Tasker] No suggested map found or no room ID available for API navigation');
    } catch (error) {
        console.error('[Better Tasker] Error navigating to suggested map:', error);
    }
}

// Start autoplay
async function startAutoplay() {
    try {
        console.log('[Better Tasker] Looking for autoplay button...');
        
        // Wait for the board to load
        await sleep(500);
        
        // Look for autoplay button
        const autoplayButton = document.querySelector('button[data-full="false"][data-state="closed"]');
        if (autoplayButton && autoplayButton.textContent.includes('Autoplay')) {
            console.log('[Better Tasker] Autoplay button found, starting autoplay...');
            autoplayButton.click();
            await sleep(200);
            console.log('[Better Tasker] Autoplay started');
            
            // Enable Bestiary Automator settings if configured
            const settings = loadSettings();
            if (settings.autoRefillStamina) {
                console.log('[Better Tasker] Auto-refill stamina enabled - enabling Bestiary Automator autorefill...');
                // Add a small delay to ensure Bestiary Automator is fully initialized
                setTimeout(() => {
                    const success = enableBestiaryAutomatorStaminaRefill();
                    if (!success) {
                        // If first attempt failed, try again with longer delay for Chrome
                        console.log('[Better Tasker] First attempt failed, retrying with longer delay for Chrome...');
                        setTimeout(() => {
                            enableBestiaryAutomatorStaminaRefill();
                        }, 2000);
                    }
                }, 500);
            }
            if (settings.fasterAutoplay) {
                console.log('[Better Tasker] Faster autoplay enabled - enabling Bestiary Automator faster autoplay...');
                // Add a small delay to ensure Bestiary Automator is fully initialized
                setTimeout(() => {
                    const success = enableBestiaryAutomatorFasterAutoplay();
                    if (!success) {
                        // If first attempt failed, try again with longer delay for Chrome
                        console.log('[Better Tasker] First attempt failed, retrying with longer delay for Chrome...');
                        setTimeout(() => {
                            enableBestiaryAutomatorFasterAutoplay();
                        }, 2000);
                    }
                }, 500);
            }
        } else {
            console.log('[Better Tasker] Autoplay button not found or not ready');
        }
    } catch (error) {
        console.error('[Better Tasker] Error starting autoplay:', error);
    }
}

// Check if autoplay is active and quest log is accessible
function checkIfAutoplayIsActive() {
    try {
        // Look for the autoplay button with the specific pattern that allows quest log access
        const autoplayButton = document.querySelector('button[data-full="false"][data-state="closed"]');
        if (!autoplayButton) return false;
        
        // Check if it has the autoplay text and is disabled (indicating autoplay is running)
        const buttonText = autoplayButton.textContent;
        const isDisabled = autoplayButton.hasAttribute('disabled') || autoplayButton.disabled;
        
        // Check for autoplay text and disabled state
        if (buttonText.includes('Autoplay') && isDisabled) {
            console.log('[Better Tasker] Autoplay button detected as active and quest log accessible');
            return true;
        }
        
        // If we see "Auto" with data-full="true", quest log is not accessible yet
        const autoButton = document.querySelector('button[data-full="true"][data-state="closed"]');
        if (autoButton && autoButton.textContent.includes('Auto') && autoButton.hasAttribute('disabled')) {
            console.log('[Better Tasker] Autoplay button shows "Auto" - quest log not accessible yet');
            return false;
        }
        
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error checking autoplay state:', error);
        return false;
    }
}

// Click all Close buttons
function clickAllCloseButtons() {
    const closeButtons = document.querySelectorAll('button');
    let clickedCount = 0;
    
    for (const button of closeButtons) {
        const buttonText = button.textContent.trim();
        if (buttonText === 'Close' || buttonText === 'Fechar') {
            console.log(`[Better Tasker] Clicking close button: "${buttonText}"`);
            button.click();
            clickedCount++;
        }
    }
    
    if (clickedCount > 0) {
        console.log(`[Better Tasker] Clicked ${clickedCount} close button(s)`);
    }
    
    return clickedCount > 0;
}

// Sleep function for delays
function sleep(timeout = 1000) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, timeout);
    });
}

// ============================================================================
// 7. BESTIARY AUTOMATOR INTEGRATION
// ============================================================================

// Enable Bestiary Automator's autorefill stamina setting
function enableBestiaryAutomatorStaminaRefill() {
    try {
        // Request control of Bestiary Automator settings
        if (!window.BestiaryAutomatorSettingsManager.requestControl('Better Tasker')) {
            console.log('[Better Tasker] Cannot control Bestiary Automator settings - controlled by another mod');
            return false;
        }
        
        // Try multiple ways to access Bestiary Automator
        let bestiaryAutomator = null;
        
        // Method 1: Check if Bestiary Automator is available in global scope
        if (window.bestiaryAutomator && window.bestiaryAutomator.updateConfig) {
            bestiaryAutomator = window.bestiaryAutomator;
            console.log('[Better Tasker] Found Bestiary Automator via global window object');
        }
        // Method 2: Check if it's available in context exports
        else if (typeof context !== 'undefined' && context.exports && context.exports.updateConfig) {
            bestiaryAutomator = context.exports;
            console.log('[Better Tasker] Found Bestiary Automator via context exports');
        }
        // Method 3: Try to find it in the mod loader's context
        else if (window.modLoader && window.modLoader.getModContext) {
            const automatorContext = window.modLoader.getModContext('bestiary-automator');
            if (automatorContext && automatorContext.exports && automatorContext.exports.updateConfig) {
                bestiaryAutomator = automatorContext.exports;
                console.log('[Better Tasker] Found Bestiary Automator via mod loader');
            }
        }
        
        if (bestiaryAutomator) {
            console.log('[Better Tasker] Enabling Bestiary Automator autorefill stamina...');
            bestiaryAutomator.updateConfig({
                autoRefillStamina: true
            });
            console.log('[Better Tasker] Bestiary Automator autorefill stamina enabled');
            
            // Additional verification for Chrome - check if the setting actually took effect
            setTimeout(() => {
                if (window.bestiaryAutomator && window.bestiaryAutomator.config) {
                    console.log('[Better Tasker] Verifying stamina refill setting:', window.bestiaryAutomator.config.autoRefillStamina);
                }
            }, 1000);
            
            return true;
        } else {
            console.log('[Better Tasker] Bestiary Automator not available for autorefill stamina');
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
                    console.log('[Better Tasker] Retrying Bestiary Automator autorefill stamina...');
                    retryAutomator.updateConfig({
                        autoRefillStamina: true
                    });
                    console.log('[Better Tasker] Bestiary Automator autorefill stamina enabled (retry)');
                    
                    // Additional verification for Chrome - check if the setting actually took effect
                    setTimeout(() => {
                        if (window.bestiaryAutomator && window.bestiaryAutomator.config) {
                            console.log('[Better Tasker] Verifying stamina refill setting (retry):', window.bestiaryAutomator.config.autoRefillStamina);
                        }
                    }, 1000);
                } else {
                    console.log('[Better Tasker] Bestiary Automator still not available - you may need to enable autorefill stamina manually');
                }
            }, 2000);
            return false;
        }
    } catch (error) {
        console.error('[Better Tasker] Error enabling Bestiary Automator autorefill stamina:', error);
        window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
        return false;
    }
}

// Disable Bestiary Automator's autorefill stamina setting
function disableBestiaryAutomatorStaminaRefill() {
    try {
        // Only disable if we have control
        if (!window.BestiaryAutomatorSettingsManager.hasControl('Better Tasker')) {
            console.log('[Better Tasker] Cannot disable Bestiary Automator settings - not controlled by Better Tasker');
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
            console.log('[Better Tasker] Disabling Bestiary Automator autorefill stamina...');
            bestiaryAutomator.updateConfig({
                autoRefillStamina: false
            });
            console.log('[Better Tasker] Bestiary Automator autorefill stamina disabled');
            // Release control after disabling
            window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
            return true;
        } else {
            console.log('[Better Tasker] Bestiary Automator not available for autorefill stamina');
            window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
            return false;
        }
    } catch (error) {
        console.error('[Better Tasker] Error disabling Bestiary Automator autorefill stamina:', error);
        window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
        return false;
    }
}

// Enable Bestiary Automator's faster autoplay setting
function enableBestiaryAutomatorFasterAutoplay() {
    try {
        // Request control of Bestiary Automator settings
        if (!window.BestiaryAutomatorSettingsManager.requestControl('Better Tasker')) {
            console.log('[Better Tasker] Cannot control Bestiary Automator settings - controlled by another mod');
            return false;
        }
        
        // Try multiple ways to access Bestiary Automator
        let bestiaryAutomator = null;
        
        // Method 1: Check if Bestiary Automator is available in global scope
        if (window.bestiaryAutomator && window.bestiaryAutomator.updateConfig) {
            bestiaryAutomator = window.bestiaryAutomator;
            console.log('[Better Tasker] Found Bestiary Automator via global window object');
        }
        // Method 2: Check if it's available in context exports
        else if (typeof context !== 'undefined' && context.exports && context.exports.updateConfig) {
            bestiaryAutomator = context.exports;
            console.log('[Better Tasker] Found Bestiary Automator via context exports');
        }
        // Method 3: Try to find it in the mod loader's context
        else if (window.modLoader && window.modLoader.getModContext) {
            const automatorContext = window.modLoader.getModContext('bestiary-automator');
            if (automatorContext && automatorContext.exports && automatorContext.exports.updateConfig) {
                bestiaryAutomator = automatorContext.exports;
                console.log('[Better Tasker] Found Bestiary Automator via mod loader');
            }
        }
        
        if (bestiaryAutomator) {
            console.log('[Better Tasker] Enabling Bestiary Automator faster autoplay...');
            bestiaryAutomator.updateConfig({
                fasterAutoplay: true
            });
            console.log('[Better Tasker] Bestiary Automator faster autoplay enabled');
            
            // Additional verification for Chrome - check if the setting actually took effect
            setTimeout(() => {
                if (window.bestiaryAutomator && window.bestiaryAutomator.config) {
                    console.log('[Better Tasker] Verifying faster autoplay setting:', window.bestiaryAutomator.config.fasterAutoplay);
                }
            }, 1000);
            
            return true;
        } else {
            console.log('[Better Tasker] Bestiary Automator not available for faster autoplay');
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
                    console.log('[Better Tasker] Retrying Bestiary Automator faster autoplay...');
                    retryAutomator.updateConfig({
                        fasterAutoplay: true
                    });
                    console.log('[Better Tasker] Bestiary Automator faster autoplay enabled (retry)');
                    
                    // Additional verification for Chrome - check if the setting actually took effect
                    setTimeout(() => {
                        if (window.bestiaryAutomator && window.bestiaryAutomator.config) {
                            console.log('[Better Tasker] Verifying faster autoplay setting (retry):', window.bestiaryAutomator.config.fasterAutoplay);
                        }
                    }, 1000);
                } else {
                    console.log('[Better Tasker] Bestiary Automator still not available - you may need to enable faster autoplay manually');
                }
            }, 2000);
            return false;
        }
    } catch (error) {
        console.error('[Better Tasker] Error enabling Bestiary Automator faster autoplay:', error);
        window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
        return false;
    }
}

// Disable Bestiary Automator's faster autoplay setting
function disableBestiaryAutomatorFasterAutoplay() {
    try {
        // Only disable if we have control
        if (!window.BestiaryAutomatorSettingsManager.hasControl('Better Tasker')) {
            console.log('[Better Tasker] Cannot disable Bestiary Automator settings - not controlled by Better Tasker');
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
            console.log('[Better Tasker] Disabling Bestiary Automator faster autoplay...');
            bestiaryAutomator.updateConfig({
                fasterAutoplay: false
            });
            console.log('[Better Tasker] Bestiary Automator faster autoplay disabled');
            // Release control after disabling
            window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
            return true;
        } else {
            console.log('[Better Tasker] Bestiary Automator not available for faster autoplay');
            window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
            return false;
        }
    } catch (error) {
        console.error('[Better Tasker] Error disabling Bestiary Automator faster autoplay:', error);
        window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
        return false;
    }
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

// Checks element visibility
function isElementVisible(el) {
    if (!el || el.disabled) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

// Ensures autoplay mode is enabled
async function ensureAutoplayMode() {
    const boardContext = globalThis.state.board.getSnapshot().context;
    const currentMode = boardContext.mode;
    
    if (currentMode !== 'autoplay') {
        globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
        await sleep(200);
        return true;
    }
    return false;
}

// Stop all automations when task is ready to be claimed
async function stopAllAutomationsForTaskCompletion() {
    try {
        console.log('[Better Tasker] Stopping all automations for task completion...');
        
        // 1. Stop autoplay
        const autoplayStopped = await pauseAutoplay();
        
        // 2. Stop Bestiary Automator settings if we have control
        let bestiaryAutomatorStopped = false;
        if (window.BestiaryAutomatorSettingsManager.hasControl('Better Tasker')) {
            console.log('[Better Tasker] Stopping Bestiary Automator settings for task completion...');
            bestiaryAutomatorStopped = disableBestiaryAutomatorStaminaRefill();
            if (bestiaryAutomatorStopped) {
                bestiaryAutomatorStopped = disableBestiaryAutomatorFasterAutoplay();
            }
        }
        
        // 3. Coordinate with Raid Hunter to pause its automation
        let raidHunterPaused = false;
        if (isRaidHunterActive) {
            console.log('[Better Tasker] Coordinating with Raid Hunter to pause automation for task completion...');
            // Update exposed state to signal task completion is in progress
            updateExposedState();
            // Note: Raid Hunter should detect this through our exposed state and pause its own automation
            raidHunterPaused = true;
        }
        
        console.log('[Better Tasker] Automation stopping results:', {
            autoplayStopped,
            bestiaryAutomatorStopped,
            raidHunterPaused
        });
        
        return autoplayStopped;
    } catch (error) {
        console.error('[Better Tasker] Error stopping automations for task completion:', error);
        return false;
    }
}

// Pause autoplay by clicking the pause button
async function pauseAutoplay() {
    try {
        console.log('[Better Tasker] Looking for pause button to stop autoplay...');
        
        // Look for the pause button with the specific classes and SVG structure
        const pauseButton = document.querySelector('button.frame-1-red.surface-red .lucide-pause');
        if (!pauseButton) {
            // Alternative selector - look for button containing pause SVG
            const pauseButtons = document.querySelectorAll('button');
            const foundButton = Array.from(pauseButtons).find(btn => 
                btn.querySelector('.lucide-pause') && 
                btn.classList.contains('frame-1-red') &&
                btn.classList.contains('surface-red')
            );
            
            if (foundButton) {
                console.log('[Better Tasker] Pause button found via alternative selector');
                foundButton.click();
                autoplayPausedByTasker = true;
                await sleep(200);
                console.log('[Better Tasker] Autoplay paused successfully');
                return true;
            }
        } else {
            // Find the parent button element
            const buttonElement = pauseButton.closest('button');
            if (buttonElement) {
                console.log('[Better Tasker] Pause button found via SVG selector');
                buttonElement.click();
                autoplayPausedByTasker = true;
                await sleep(200);
                console.log('[Better Tasker] Autoplay paused successfully');
                return true;
            }
        }
        
        console.log('[Better Tasker] Pause button not found - autoplay may already be paused or button not available');
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error pausing autoplay:', error);
        return false;
    }
}

// Verify that task completion was successful before resuming automations
async function verifyTaskCompletion() {
    try {
        console.log('[Better Tasker] Verifying task completion...');
        
        // Wait a moment for the game state to update after task completion
        await sleep(1000);
        
        // Check if Game State API is available
        if (!globalThis.state || !globalThis.state.player) {
            console.log('[Better Tasker] Game State API not available for verification');
            return false;
        }
        
        const playerContext = globalThis.state.player.getSnapshot().context;
        
        // Check if there's still an active task
        if (playerContext.questLog && playerContext.questLog.task) {
            const task = playerContext.questLog.task;
            
            // If task still has gameId and is still ready, it wasn't completed properly
            if (task.gameId && task.ready) {
                console.log('[Better Tasker] Task verification failed - task still active and ready:', {
                    gameId: task.gameId,
                    ready: task.ready,
                    killCount: task.killCount
                });
                return false;
            }
            
            // If task has no gameId, it means it was completed successfully
            if (!task.gameId) {
                console.log('[Better Tasker] Task verification successful - no active task found');
                return true;
            }
            
            // If task exists but is not ready, it was completed
            if (!task.ready) {
                console.log('[Better Tasker] Task verification successful - task no longer ready');
                return true;
            }
        } else {
            // No task in quest log means it was completed successfully
            console.log('[Better Tasker] Task verification successful - no task in quest log');
            return true;
        }
        
        console.log('[Better Tasker] Task verification inconclusive - defaulting to successful');
        return true;
    } catch (error) {
        console.error('[Better Tasker] Error verifying task completion:', error);
        // Default to successful on error to avoid getting stuck
        return true;
    }
}

// Resume all automations after task completion
async function resumeAllAutomationsAfterTaskCompletion() {
    try {
        console.log('[Better Tasker] Resuming all automations after task completion...');
        
        // 1. Resume autoplay if we paused it
        const autoplayResumed = await resumeAutoplay();
        
        // 2. Resume Bestiary Automator settings if configured and we have control
        let bestiaryAutomatorResumed = false;
        const settings = loadSettings();
        if (window.BestiaryAutomatorSettingsManager.hasControl('Better Tasker')) {
            if (settings.autoRefillStamina) {
                console.log('[Better Tasker] Resuming Bestiary Automator autorefill stamina...');
                bestiaryAutomatorResumed = enableBestiaryAutomatorStaminaRefill();
            }
            if (settings.fasterAutoplay) {
                console.log('[Better Tasker] Resuming Bestiary Automator faster autoplay...');
                bestiaryAutomatorResumed = enableBestiaryAutomatorFasterAutoplay() || bestiaryAutomatorResumed;
            }
        }
        
        // 3. Coordinate with Raid Hunter to resume its automation if needed
        let raidHunterResumed = false;
        if (isRaidHunterActive) {
            console.log('[Better Tasker] Coordinating with Raid Hunter to resume automation after task completion...');
            // Update exposed state to signal task completion is finished
            updateExposedState();
            // Note: Raid Hunter should detect this through our exposed state and resume its own automation
            raidHunterResumed = true;
        }
        
        console.log('[Better Tasker] Automation resuming results:', {
            autoplayResumed,
            bestiaryAutomatorResumed,
            raidHunterResumed
        });
        
        return autoplayResumed;
    } catch (error) {
        console.error('[Better Tasker] Error resuming automations after task completion:', error);
        return false;
    }
}

// Resume autoplay after task completion
async function resumeAutoplay() {
    try {
        console.log('[Better Tasker] Looking for play button to resume autoplay...');
        
        // Look for the play button (triangle icon)
        const playButtons = document.querySelectorAll('button');
        const foundButton = Array.from(playButtons).find(btn => 
            btn.querySelector('.lucide-play') && 
            btn.classList.contains('frame-1-green') &&
            btn.classList.contains('surface-green')
        );
        
        if (foundButton && autoplayPausedByTasker) {
            console.log('[Better Tasker] Play button found, resuming autoplay...');
            foundButton.click();
            autoplayPausedByTasker = false;
            await sleep(200);
            console.log('[Better Tasker] Autoplay resumed successfully');
            return true;
        }
        
        console.log('[Better Tasker] Play button not found - autoplay may already be running');
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error resuming autoplay:', error);
        return false;
    }
}

// Handle task finishing - main function for completing tasks
async function handleTaskFinishing() {
    if (!isTaskerEnabled) {
        console.log('[Better Tasker] Tasker disabled, skipping task completion');
        return;
    }
    
    // Check if quest blip is available (indicates task is completed)
    const isQuestBlipReady = isQuestBlipAvailable();
    
    // If quest blip is available, task is completed - reset task hunting flag
    if (isQuestBlipReady && taskHuntingOngoing) {
        console.log('[Better Tasker] Quest blip detected - task completed, resetting task hunting flag');
        resetState('taskComplete');
        // Continue with task completion below
    } else if (taskHuntingOngoing) {
        console.log('[Better Tasker] Task hunting ongoing, skipping task completion');
        return;
    }
    
    // Don't run task finishing if a task is already in progress
    if (taskInProgress) {
        console.log('[Better Tasker] Task already in progress, skipping quest log check');
        return;
    }
    
    // Don't run task finishing if task completion is already in progress
    if (taskCompletionInProgress) {
        console.log('[Better Tasker] Task completion already in progress, skipping duplicate');
        return;
    }
    
    // Check if task navigation has already been completed for this session
    if (taskNavigationCompleted) {
        console.log('[Better Tasker] Task navigation already completed, skipping quest log check');
        return;
    }
    
    // Load settings to check if autocomplete is enabled
    const settings = loadSettings();
    if (!settings.autoCompleteTasks) {
        console.log('[Better Tasker] Autocomplete tasks disabled, skipping');
        return;
    }
    
    // Check if current task should be removed due to creature filtering
    const taskRemoved = await removeCurrentTaskIfNotAllowed();
    if (taskRemoved) {
        console.log('[Better Tasker] Task removed due to creature filtering, ending task finishing');
        return;
    }
    
    try {
        // Check if Game State API is available
        if (!globalThis.state || !globalThis.state.player) {
            console.log('[Better Tasker] Game State API not available');
            return;
        }
        
        const playerContext = globalThis.state.player.getSnapshot().context;
        
        // Check if there's a hunting task that's ready
        if (playerContext.questLog && playerContext.questLog.task) {
            const task = playerContext.questLog.task;
            
            // Check if there's an active task by checking for gameId
            if (!task.gameId) {
                console.log('[Better Tasker] No active task (no gameId), checking for quest blip...');
                
                if (isQuestBlipReady) {
                    console.log('[Better Tasker] Quest blip found - opening quest log to start new task...');
                    // Continue with quest log opening logic below
                } else {
                    console.log('[Better Tasker] No quest blip found - no task available');
                    return;
                }
            } else {
                console.log('[Better Tasker] Active task found:', {
                    gameId: task.gameId,
                    killCount: task.killCount,
                    ready: task.ready,
                    points: task.points
                });
                
                // If we have an active task (gameId exists), we should proceed to check quest log
                // The task might need to be activated even if killCount is 0
                console.log('[Better Tasker] Active task detected, proceeding to quest log check...');
                
                // Apply task start delay if configured (only for active tasks)
                const taskStartDelay = settings.taskStartDelay || DEFAULT_TASK_START_DELAY;
                
                if (taskStartDelay > 0) {
                    console.log(`[Better Tasker] Applying task start delay: ${taskStartDelay} seconds`);
                    
                    // Wait for the specified delay before proceeding
                    await new Promise(resolve => setTimeout(resolve, taskStartDelay * 1000));
                    
                    // Check if tasker is still enabled after delay
                    if (!isTaskerEnabled) {
                        console.log('[Better Tasker] Tasker disabled during task start delay');
                        return;
                    }
                    
                    console.log('[Better Tasker] Task start delay completed, proceeding...');
                }
            }
            
            // Quest blip already checked at the beginning of the function
            
            // Check if task is ready OR if autoplay is active OR if quest blip is available
            const isTaskReady = task.gameId ? task.ready : false; // Only check task.ready if there's an active task
            let isAutoplayActive = checkIfAutoplayIsActive();
            
            // If autoplay shows "Auto" state, wait for it to transition to "Autoplay" state
            if (!isTaskReady && !isAutoplayActive && !isQuestBlipReady) {
                const autoButton = document.querySelector('button[data-full="true"][data-state="closed"]');
                if (autoButton && autoButton.textContent.includes('Auto') && autoButton.hasAttribute('disabled')) {
                    console.log('[Better Tasker] Waiting for autoplay button to transition from "Auto" to "Autoplay" state...');
                    
                    // Wait up to 30 seconds for the transition
                    let waitAttempts = 0;
                    const maxWaitAttempts = 300; // 30 seconds with 100ms intervals
                    
                    while (!isAutoplayActive && waitAttempts < maxWaitAttempts) {
                        await sleep(100);
                        waitAttempts++;
                        isAutoplayActive = checkIfAutoplayIsActive();
                        
                        if (waitAttempts % 100 === 0) { // Log every 10 seconds
                            console.log(`[Better Tasker] Still waiting for autoplay transition... (${waitAttempts / 10}s)`);
                        }
                    }
                    
                    if (isAutoplayActive) {
                        console.log('[Better Tasker] Autoplay button transitioned to accessible state');
                    } else {
                        console.log('[Better Tasker] Autoplay button never transitioned, skipping quest log check');
                        return;
                    }
                }
            }
            
            // Try to open quest log when there's an active task or quest blip is available
            if (task.gameId) {
                console.log('[Better Tasker] Attempting to open quest log for active task...');
            } else if (isQuestBlipReady) {
                console.log('[Better Tasker] Quest blip detected - opening quest log to complete task...');
            } else {
                console.log('[Better Tasker] Attempting to open quest log to start new task...');
            }
            
            if (isTaskReady) {
                console.log('[Better Tasker] Hunting task is ready, finishing...');
                
                // Stop ALL automations when task is ready
                await stopAllAutomationsForTaskCompletion();
                
                // Check if a game is currently running
                const boardContext = globalThis.state.board.getSnapshot().context;
                if (boardContext.gameStarted) {
                    console.log('[Better Tasker] Game is running, waiting for game to finish before claiming task...');
                    pendingTaskCompletion = true;
                    updateExposedState(); // Update exposed state for other mods
                    console.log('[Better Tasker] Pending task completion flag set - waiting for game to end');
                    return; // Exit and wait for game to finish
                }
            } else if (isQuestBlipReady) {
                console.log('[Better Tasker] Quest blip detected - task is ready to complete, finishing...');
                
                // Stop ALL automations when task is ready
                await stopAllAutomationsForTaskCompletion();
                
                // Check if a game is currently running
                const boardContext = globalThis.state.board.getSnapshot().context;
                if (boardContext.gameStarted) {
                    console.log('[Better Tasker] Game is running, waiting for game to finish before claiming task...');
                    pendingTaskCompletion = true;
                    updateExposedState(); // Update exposed state for other mods
                    console.log('[Better Tasker] Pending task completion flag set - waiting for game to end');
                    return; // Exit and wait for game to finish
                }
            } else if (isAutoplayActive) {
                console.log('[Better Tasker] Autoplay is active and quest log accessible, checking...');
            } else {
                if (task.gameId) {
                    console.log('[Better Tasker] No quest blip found, but checking quest log anyway for active task...');
                } else {
                    // Check if we should wait before re-checking (1 minute delay)
                    const now = Date.now();
                    const NO_TASK_CHECK_DELAY = 60000; // 1 minute in milliseconds
                    
                    if (now - lastNoTaskCheck < NO_TASK_CHECK_DELAY) {
                        // Still within the delay period, skip this check
                        return;
                    }
                    
                    // Update the last check time
                    lastNoTaskCheck = now;
                    console.log('[Better Tasker] No quest blip found and no active task - waiting 1 minute before next check');
                    return;
                }
            }
            
            // 1. Open quest log
            console.log('[Better Tasker] Quest blip already detected, opening quest log...');
            
            if (isQuestBlipReady) {
                // Set task completion in progress flag to prevent duplicate operations
                taskCompletionInProgress = true;
                updateExposedState(); // Update exposed state for other mods
                console.log('[Better Tasker] Task completion in progress flag set - preventing duplicate operations');
                
                // Set task in progress flag to prevent duplicate quest log operations
                taskInProgress = true;
                console.log('[Better Tasker] Task in progress flag set - preventing duplicate quest log operations');
                
                // Update button to show "Tasking" state
                updateToggleButtonForTasking();
                
                // Start quest button validation monitoring
                startQuestButtonValidation();
                // Clear any modals with ESC key presses
                console.log('[Better Tasker] Clearing any modals with ESC key presses...');
                for (let i = 0; i < 3; i++) {
                    const escEvent = new KeyboardEvent('keydown', {
                        key: 'Escape',
                        code: 'Escape',
                        keyCode: 27,
                        which: 27,
                        bubbles: true,
                        cancelable: true
                    });
                    document.dispatchEvent(escEvent);
                    await sleep(50); // Small delay between ESC presses
                }
                
                // Wait for modals to clear
                await sleep(200);
                console.log('[Better Tasker] Modal clearing completed');
                
                // Find and click the quest blip
                const questBlip = document.querySelector('img[src*="quest-blip.png"]');
                if (questBlip) {
                    questBlip.click();
                } else {
                    console.log('[Better Tasker] Quest blip not found when trying to click');
                    return;
                }
                await sleep(200);
                console.log('[Better Tasker] Quest log opened via quest blip');
                
                // Wait for quest log to fully load
                await sleep(300);
                
                // 2. Look for and click "New Task" button
                console.log('[Better Tasker] Looking for New Task button...');
                let newTaskButton = document.querySelector('button:has(svg.lucide-plus)');
                if (!newTaskButton) {
                    // Alternative selector for New Task button
                    const buttons = document.querySelectorAll('button');
                    newTaskButton = Array.from(buttons).find(btn => 
                        btn.textContent.includes('New task') || btn.textContent.includes('New Task')
                    );
                }
                
                if (newTaskButton) {
                    console.log('[Better Tasker] New Task button found, clicking...');
                    newTaskButton.click();
                    await sleep(200);
                    console.log('[Better Tasker] New Task button clicked');
                    
                    // Wait for task selection to load
                    await sleep(500);
                    
                    // 3. Navigate to suggested map and start autoplay
                    await navigateToSuggestedMapAndStartAutoplay();
                } else {
                    console.log('[Better Tasker] New Task button not found, checking for suggested map...');
                    
                    // Try to navigate to suggested map using API (will validate Paw and Fur Society section internally)
                    await navigateToSuggestedMapAndStartAutoplay();
                }
                
                // 4. Wait up to 2 minutes for Finish button with mutation observer
                let finishButton = null;
                let attempts = 0;
                const maxAttempts = 240; // 2 minute delay
                
                // Use mutation observer to watch for Finish button changes
                const finishButtonObserver = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') {
                            const target = mutation.target;
                            if (target.textContent.includes('Finish')) {
                                // Check if button is now enabled
                                if (!target.hasAttribute('disabled') && !target.disabled) {
                                    finishButton = target;
                                    console.log('[Better Tasker] Finish button enabled via mutation observer');
                                }
                            }
                        }
                    }
                });
                
                // Start observing the document body for button changes
                finishButtonObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['disabled']
                });
                
                // Poll for Finish button with faster intervals
                while (!finishButton && attempts < maxAttempts) {
                    await sleep(100); // Faster polling - 100ms instead of 500ms
                    attempts++;
                    
                    // Look for Finish button that's not disabled
                    const buttons = document.querySelectorAll('button');
                    finishButton = Array.from(buttons).find(btn => 
                        btn.textContent.includes('Finish') && 
                        !btn.hasAttribute('disabled') && 
                        !btn.disabled
                    );
                    
                    if (finishButton) {
                        console.log('[Better Tasker] Finish button found and ready, attempts:', attempts);
                        break;
                    }
                }
                
                // Stop observing
                finishButtonObserver.disconnect();
                
                // 5. Click Finish
                if (finishButton) {
                    console.log('[Better Tasker] Clicking Finish button...');
                    finishButton.click();
                    await sleep(200);
                    console.log('[Better Tasker] Finish clicked');
                    
                    // Clear task completion in progress flag
                    taskCompletionInProgress = false;
                    
                    // Reset task hunting flag since task is now completed
                    resetState('taskComplete');
                    updateExposedState(); // Update exposed state for other mods
                    
                    // Restore normal button state
                    updateToggleButton();
                    
                    // 6. Close modal
                    await sleep(300);
                    clickAllCloseButtons();
                    console.log('[Better Tasker] Modal closed');
                    
                    // 7. Verify task completion before resuming automations
                    await sleep(500); // Small delay to ensure modal is fully closed
                    
                    // Verify that task is actually completed before resuming automations
                    const taskCompleted = await verifyTaskCompletion();
                    if (taskCompleted) {
                        console.log('[Better Tasker] Task completion verified - resuming automations');
                        await resumeAllAutomationsAfterTaskCompletion();
                    } else {
                        console.log('[Better Tasker] Task completion verification failed - not resuming automations yet');
                    }
                } else {
                    // If we were checking during autoplay and no finish button appeared, just close the quest log
                    if (isAutoplayActive && !isTaskReady) {
                        console.log('[Better Tasker] No finish button found during autoplay, closing quest log');
                        clickAllCloseButtons();
                // Clear task completion and task in progress flags since we're closing the quest log
                taskCompletionInProgress = false;
                taskInProgress = false;
                updateExposedState(); // Update exposed state for other mods
                console.log('[Better Tasker] Task completion and progress flags cleared - quest log closed');
                
                // Stop quest button validation and restore appearance
                stopQuestButtonValidation();
                restoreQuestButtonAppearance();
                
                // Restore normal button state
                updateToggleButton();
                    } else {
                        console.log('[Better Tasker] Finish button never became ready');
                        // Clear task completion and task in progress flags since no finish button appeared
                        taskCompletionInProgress = false;
                        taskInProgress = false;
                        console.log('[Better Tasker] Task completion and progress flags cleared - no finish button');
                        
                        // Stop quest button validation and restore appearance
                        stopQuestButtonValidation();
                        restoreQuestButtonAppearance();
                        
                        // Restore normal button state
                        updateToggleButton();
                    }
                }
            } else {
                // Fallback: Try to open quest log using "Quests" button for active tasks
                console.log('[Better Tasker] No quest blip found, trying Quests button fallback...');
                const questsButton = document.querySelector('button img[src*="quest.png"]');
                if (questsButton) {
                    const questButton = questsButton.closest('button');
                    if (questButton) {
                        console.log('[Better Tasker] Found Quests button, opening quest log...');
                        
                        // Set task completion in progress flag
                        taskCompletionInProgress = true;
                        updateExposedState();
                        console.log('[Better Tasker] Task completion in progress flag set - preventing duplicate operations');
                        
                        // Set task in progress flag
                        taskInProgress = true;
                        console.log('[Better Tasker] Task in progress flag set - preventing duplicate quest log operations');
                        
                        // Update button to show "Tasking" state
                        updateToggleButtonForTasking();
                        
                        // Start quest button validation monitoring
                        startQuestButtonValidation();
                        
                        // Clear any modals with ESC key presses
                        console.log('[Better Tasker] Clearing any modals with ESC key presses...');
                        for (let i = 0; i < 3; i++) {
                            const escEvent = new KeyboardEvent('keydown', {
                                key: 'Escape',
                                code: 'Escape',
                                keyCode: 27,
                                which: 27,
                                bubbles: true,
                                cancelable: true
                            });
                            document.dispatchEvent(escEvent);
                            await sleep(50);
                        }
                        
                        // Wait for modals to clear
                        await sleep(200);
                        console.log('[Better Tasker] Modal clearing completed');
                        
                        questButton.click();
                        await sleep(200);
                        console.log('[Better Tasker] Quest log opened via Quests button');
                        
                        // Wait for quest log to fully load
                        await sleep(300);
                        
                        // 1. Find Paw and Fur Society section first (section-first approach)
                        console.log('[Better Tasker] Using section-first approach - finding Paw and Fur Society section...');
                        const pawAndFurSection = findPawAndFurSection();
                        if (!pawAndFurSection) {
                            console.log('[Better Tasker] Paw and Fur Society section not found');
                            taskCompletionInProgress = false;
                            taskInProgress = false;
                            return;
                        }
                        
                        // 2. Extract & validate creature from that specific section
                        console.log('[Better Tasker] Extracting creature from Paw and Fur Society section...');
                        const creatureName = extractCreatureFromSection(pawAndFurSection);
                        console.log('[Better Tasker] Extracted creature name:', creatureName);
                        if (!creatureName || !isCreatureAllowed(creatureName)) {
                            console.log(`[Better Tasker] Task rejected - creature "${creatureName}" is not in allowed list`);
                            
                            // Remove the task directly while quest log is open
                            console.log('[Better Tasker] Removing rejected task directly from quest log...');
                            const taskRemoved = await removeTaskDirectlyFromQuestLog();
                            if (taskRemoved) {
                                console.log('[Better Tasker] Rejected task successfully removed from game');
                            } else {
                                console.log('[Better Tasker] Failed to remove rejected task from game');
                            }
                            
                            // Clear flags and return
                            taskCompletionInProgress = false;
                            taskInProgress = false;
                            return;
                        }
                        
                        // 3. Extract suggested map from that same section
                        console.log('[Better Tasker] Extracting suggested map from Paw and Fur Society section...');
                        const suggestedMapElement = extractSuggestedMapFromSection(pawAndFurSection);
                        
                        if (suggestedMapElement) {
                            console.log('[Better Tasker] Suggested map found, navigating...');
                            await navigateToSuggestedMapAndStartAutoplay(suggestedMapElement);
                        } else {
                            console.log('[Better Tasker] No suggested map found in Paw and Fur Society section');
                        }
                        
                        return; // Successfully opened quest log, exit early
                    }
                }
                
                // Check if we should wait before re-checking (1 minute delay)
                const now = Date.now();
                const NO_TASK_CHECK_DELAY = 60000; // 1 minute in milliseconds
                
                if (now - lastNoTaskCheck < NO_TASK_CHECK_DELAY) {
                    // Still within the delay period, skip this check
                    return;
                }
                
                // Update the last check time
                lastNoTaskCheck = now;
                console.log('[Better Tasker] Quest blip not found and Quests button fallback failed - waiting 1 minute before next check');
                // Clear task completion and task in progress flags since no quest blip was found
                taskCompletionInProgress = false;
                taskInProgress = false;
                console.log('[Better Tasker] Task completion and progress flags cleared - no quest blip');
                
                // Stop quest button validation and restore appearance
                stopQuestButtonValidation();
                restoreQuestButtonAppearance();
                
                // Restore normal button state
                updateToggleButton();
            }
        } else {
            // Check if we should wait before re-checking (1 minute delay)
            const now = Date.now();
            const NO_TASK_CHECK_DELAY = 60000; // 1 minute in milliseconds
            
            if (now - lastNoTaskCheck < NO_TASK_CHECK_DELAY) {
                // Still within the delay period, skip this check
                return;
            }
            
            // Update the last check time
            lastNoTaskCheck = now;
            console.log('[Better Tasker] No quest log or task found - waiting 1 minute before next check');
            // Clear task completion and task in progress flags since no quest log or task was found
            taskCompletionInProgress = false;
            taskInProgress = false;
            console.log('[Better Tasker] Task completion and progress flags cleared - no quest log or task');
            
            // Stop quest button validation and restore appearance
            stopQuestButtonValidation();
            restoreQuestButtonAppearance();
            
            // Restore normal button state
            updateToggleButton();
        }
    } catch (error) {
        console.error('[Better Tasker] Error handling task finishing:', error);
        // Clear task completion and task in progress flags on error
        taskCompletionInProgress = false;
        taskInProgress = false;
        updateExposedState(); // Update exposed state for other mods
        console.log('[Better Tasker] Task completion and progress flags cleared - error occurred');
        
        // Stop quest button validation and restore appearance
        stopQuestButtonValidation();
        restoreQuestButtonAppearance();
        
        // Restore normal button state
        updateToggleButton();
    }
}

// ============================================================================
// 8. AUTOMATION LOOP
// ============================================================================

// Add debouncing for game state events
const GAME_STATE_DEBOUNCE_MS = 1000; // 1 second debounce

// Subscribe to board game state changes
function subscribeToGameState() {
    try {
        // Subscribe to board state changes for new game detection
        if (globalThis.state && globalThis.state.board) {
            // Consolidated new game handler with debouncing
            const handleNewGame = (event) => {
                const now = Date.now();
                if (now - lastGameStateChange < GAME_STATE_DEBOUNCE_MS) {
                    console.log('[Better Tasker] Ignoring rapid new game event (debounced)');
                    return;
                }
                lastGameStateChange = now;
                
                console.log('[Better Tasker] New game detected via game state API, resetting session flags');
                console.log('[Better Tasker] New game event details:', event);
                resetState('session');
                // Don't reset taskNavigationCompleted - it should persist until user manually stops automation
                
                // Log current task status when new game starts
                try {
                    if (globalThis.state?.player) {
                        const playerContext = globalThis.state.player.getSnapshot().context;
                        const task = playerContext?.questLog?.task;
                        
                        if (task && task.killCount !== undefined) {
                            console.log(`[Better Tasker] Progress: ${task.killCount} creatures killed`);
                            
                            // Calculate remaining kills if we can determine the target
                            if (task.ready) {
                                console.log('[Better Tasker] Task is ready to complete!');
                                
                                // Stop ALL automations when task is ready (regardless of game state)
                                stopAllAutomationsForTaskCompletion();
                                
                                // Check if a game is currently running
                                const boardContext = globalThis.state.board.getSnapshot().context;
                                if (boardContext.gameStarted) {
                                    console.log('[Better Tasker] Game is running, waiting for game to finish before claiming task...');
                                    pendingTaskCompletion = true;
                                    updateExposedState(); // Update exposed state for other mods
                                    console.log('[Better Tasker] Pending task completion flag set - waiting for game to end');
                                    // All automations are stopped, task completion will be handled in the emitEndGame event
                                    return;
                                }
                                
                                // Reset task hunting flag since task is ready
                                resetState('taskComplete');
                                
                                // Check and finish tasks immediately if they're ready
                                handleTaskFinishing();
                            }
                        }
                    }
                } catch (error) {
                    console.error('[Better Tasker] Error logging task status on new game:', error);
                }
            };
            
            // Subscribe to newGame event (primary handler)
            const newGameUnsub = globalThis.state.board.on('newGame', handleNewGame);
            if (typeof newGameUnsub === 'function') {
                gameStateUnsubscribers.push(newGameUnsub);
            }
            
            // Consolidated end game handler with debouncing
            const handleEndGame = (event) => {
                const now = Date.now();
                if (now - lastGameStateChange < GAME_STATE_DEBOUNCE_MS) {
                    console.log('[Better Tasker] Ignoring rapid end game event (debounced)');
                    return;
                }
                lastGameStateChange = now;
                
                // Check for task completion after every game ends (autoplay or manual)
                console.log('[Better Tasker] Game ended, checking for task completion...');
                
                // Log current task status and progress
                try {
                    if (globalThis.state?.player) {
                        const playerContext = globalThis.state.player.getSnapshot().context;
                        const task = playerContext?.questLog?.task;
                        
                        if (task && task.killCount !== undefined) {
                            console.log(`[Better Tasker] Progress: ${task.killCount} creatures killed`);
                            
                            // Calculate remaining kills if we can determine the target
                            if (task.ready) {
                                console.log('[Better Tasker] Task is ready to complete!');
                                
                                // Check if we have a pending task completion
                                if (pendingTaskCompletion) {
                                    console.log('[Better Tasker] Game ended, now claiming pending task...');
                                    pendingTaskCompletion = false;
                                    
                                    // Autoplay is already paused from when task became ready
                                    // Reset task hunting flag since task is ready
                                    resetState('taskComplete');
                                    
                                    // Handle task completion now that game has ended
                                    handleTaskFinishing();
                                } else {
                                    // Stop ALL automations to prevent interference during task completion
                                    stopAllAutomationsForTaskCompletion();
                                    
                                    // Reset task hunting flag since task is ready
                                    resetState('taskComplete');
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('[Better Tasker] Error logging task status:', error);
                }
                
                // Check and finish tasks immediately after game ends
                handleTaskFinishing();
            };
            
            // Subscribe to emitEndGame event
            const endGameUnsub = globalThis.state.board.on('emitEndGame', handleEndGame);
            if (typeof endGameUnsub === 'function') {
                gameStateUnsubscribers.push(endGameUnsub);
            }
        }
        
        console.log('[Better Tasker] Game state monitoring set up');
    } catch (error) {
        console.error('[Better Tasker] Error subscribing to game state:', error);
    }
}

// Unsubscribe from game state changes
function unsubscribeFromGameState() {
    // Clean up game state API subscriptions
    gameStateUnsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') {
            try {
                unsub();
            } catch (error) {
                console.error('[Better Tasker] Error unsubscribing from game state:', error);
            }
        }
    });
    gameStateUnsubscribers = [];
    
    console.log('[Better Tasker] Game state monitoring disconnected');
}

// Main automation loop
function startAutomation() {
    if (automationInterval) return;
    
    // Check if Raid Hunter is actively raiding
    if (isRaidHunterRaiding()) {
        console.log('[Better Tasker] Cannot start automation - Raid Hunter is actively raiding');
        return;
    }
    
    console.log('[Better Tasker] Starting automation loop');
    
    // Reset session flags when starting automation
    resetState('automation');
    // Don't reset taskNavigationCompleted - let it persist across automation restarts
    
    // Run immediately once
    runAutomationTasks();
    checkQuestLogForTasks(); // Also check quest log immediately
    
    // Set up core automation interval
    automationInterval = setInterval(runAutomationTasks, 5000); // Core automation every 5s
    
    // Set up quest log check interval (respects raid status)
    questLogInterval = setInterval(checkQuestLogForTasks, 10000); // Check every 10 seconds
    
    // Subscribe to game state for task completion
    subscribeToGameState();
}

function stopAutomation() {
    if (!automationInterval) return;
    
    console.log('[Better Tasker] Stopping automation loop');
    
    // Clear main intervals
    clearInterval(automationInterval);
    automationInterval = null;
    
    // Clear quest log interval
    if (questLogInterval) {
        clearInterval(questLogInterval);
        questLogInterval = null;
    }
    
    // Unsubscribe from game state changes
    unsubscribeFromGameState();
    
    // Only disable Bestiary Automator settings if Raid Hunter is not actively raiding
    // This prevents conflicts when Raid Hunter needs these settings
    if (!isRaidHunterRaiding()) {
        const settings = loadSettings();
        if (settings.autoRefillStamina) {
            console.log('[Better Tasker] Automation stopped - disabling Bestiary Automator autorefill stamina...');
            disableBestiaryAutomatorStaminaRefill();
        }
        if (settings.fasterAutoplay) {
            console.log('[Better Tasker] Automation stopped - disabling Bestiary Automator faster autoplay...');
            disableBestiaryAutomatorFasterAutoplay();
        }
    } else {
        console.log('[Better Tasker] Raid Hunter is actively raiding - preserving Bestiary Automator settings');
    }
}

function runAutomationTasks() {
    try {
        // Only run if tasker is enabled
        if (!isTaskerEnabled) {
            return;
        }
        
        // Check if Raid Hunter is actively raiding
        if (isRaidHunterRaiding()) {
            console.log('[Better Tasker] Raid Hunter is actively raiding, skipping automation');
            return;
        }
        
        // Don't run automation if task hunting is ongoing
        if (taskHuntingOngoing) {
            console.log('[Better Tasker] Task hunting ongoing, skipping automation');
            return;
        }
        
        // Check if game is active
        if (!isGameActive()) {
            return;
        }
        
        // Check and finish tasks proactively
        handleTaskFinishing();
        
    } catch (error) {
        console.error('[Better Tasker] Error in automation tasks:', error);
    }
}

// ============================================================================
// 8.1. CREATURE FILTERING FUNCTIONS
// ============================================================================

// Extract creature name from task HTML (global search - kept for backward compatibility)
function extractCreatureFromTask() {
    try {
        console.log('[Better Tasker] Extracting creature from task...');
        
        // Look for creature sprite with ID (e.g., id-52 for Winter Wolf)
        const creatureSprite = document.querySelector('.sprite.outfit[class*="id-"]');
        if (creatureSprite) {
            const classList = Array.from(creatureSprite.classList);
            const idClass = classList.find(cls => cls.startsWith('id-'));
            if (idClass) {
                const creatureId = idClass.replace('id-', '');
                console.log('[Better Tasker] Found creature sprite with ID:', creatureId);
                
                // Try to get creature name from creature database
                if (window.creatureDatabase?.CREATURE_ID_MAP) {
                    const creatureName = window.creatureDatabase.CREATURE_ID_MAP[creatureId];
                    if (creatureName) {
                        console.log('[Better Tasker] Mapped creature ID to name:', creatureName);
                        return creatureName;
                    }
                }
                
                // Fallback: try to extract from task description
                const taskDescription = document.querySelector('.pixel-font-14');
                if (taskDescription && taskDescription.textContent) {
                    const text = taskDescription.textContent;
                    console.log('[Better Tasker] Task description:', text);
                    
                    // Look for "kill count" pattern to extract creature name
                    const killCountMatch = text.match(/^(.+?)\s+kill\s+count/i);
                    if (killCountMatch) {
                        const creatureName = killCountMatch[1].trim();
                        console.log('[Better Tasker] Extracted creature from description:', creatureName);
                        return creatureName;
                    }
                }
            }
        }
        
        // Alternative: Look for creature name in task description text
        const taskDescriptions = document.querySelectorAll('.pixel-font-14');
        for (const desc of taskDescriptions) {
            if (desc.textContent && desc.textContent.includes('kill count')) {
                const text = desc.textContent;
                const killCountMatch = text.match(/^(.+?)\s+kill\s+count/i);
                if (killCountMatch) {
                    const creatureName = killCountMatch[1].trim();
                    console.log('[Better Tasker] Extracted creature from description:', creatureName);
                    return creatureName;
                }
            }
        }
        
        console.log('[Better Tasker] Could not extract creature name from task');
        return null;
    } catch (error) {
        console.error('[Better Tasker] Error extracting creature from task:', error);
        return null;
    }
}

// Extract creature name from a specific section (new section-based approach)
function extractCreatureFromSection(section) {
    try {
        console.log('[Better Tasker] Extracting creature from section...');
        
        // Look for creature sprite with ID within the specific section
        const creatureSprite = section.querySelector('.sprite.outfit[class*="id-"]');
        if (creatureSprite) {
            const classList = Array.from(creatureSprite.classList);
            const idClass = classList.find(cls => cls.startsWith('id-'));
            if (idClass) {
                const creatureId = idClass.replace('id-', '');
                console.log('[Better Tasker] Found creature sprite with ID:', creatureId);
                
                // Try to get creature name from creature database
                if (window.creatureDatabase?.CREATURE_ID_MAP) {
                    const creatureName = window.creatureDatabase.CREATURE_ID_MAP[creatureId];
                    if (creatureName) {
                        console.log('[Better Tasker] Mapped creature ID to name:', creatureName);
                        return creatureName;
                    }
                }
                
                // Fallback: try to extract from task description within the section
                const taskDescription = section.querySelector('.pixel-font-14');
                if (taskDescription && taskDescription.textContent) {
                    const text = taskDescription.textContent;
                    console.log('[Better Tasker] Task description:', text);
                    
                    // Look for "kill count" pattern to extract creature name
                    const killCountMatch = text.match(/^(.+?)\s+kill\s+count/i);
                    if (killCountMatch) {
                        const creatureName = killCountMatch[1].trim();
                        console.log('[Better Tasker] Extracted creature from description:', creatureName);
                        return creatureName;
                    }
                }
            }
        }
        
        // Alternative: Look for creature name in task description text within the section
        const taskDescriptions = section.querySelectorAll('.pixel-font-14');
        for (const desc of taskDescriptions) {
            if (desc.textContent && desc.textContent.includes('kill count')) {
                const text = desc.textContent;
                const killCountMatch = text.match(/^(.+?)\s+kill\s+count/i);
                if (killCountMatch) {
                    const creatureName = killCountMatch[1].trim();
                    console.log('[Better Tasker] Extracted creature from description:', creatureName);
                    return creatureName;
                }
            }
        }
        
        console.log('[Better Tasker] Could not extract creature name from section');
        return null;
    } catch (error) {
        console.error('[Better Tasker] Error extracting creature from section:', error);
        return null;
    }
}

// Extract suggested map from a specific section
function extractSuggestedMapFromSection(section) {
    try {
        console.log('[Better Tasker] Extracting suggested map from section...');
        
        // Look for suggested map text within this section
        const allParagraphs = section.querySelectorAll('p.pixel-font-14');
        for (const p of allParagraphs) {
            if (p.textContent && p.textContent.includes('Suggested map:')) {
                const suggestedMapElement = p.querySelector('span.action-link');
                if (suggestedMapElement) {
                    console.log('[Better Tasker] Suggested map element found in section:', suggestedMapElement.textContent.trim());
                    return suggestedMapElement;
                }
            }
        }
        
        console.log('[Better Tasker] No suggested map found in section');
        return null;
    } catch (error) {
        console.error('[Better Tasker] Error extracting suggested map from section:', error);
        return null;
    }
}

// Open quest log specifically for task removal
async function openQuestLogForTaskRemoval() {
    try {
        // First try to find quest blip
        const questBlip = document.querySelector('[data-blip="true"]');
        if (questBlip) {
            console.log('[Better Tasker] Found quest blip, clicking to open quest log...');
            questBlip.click();
            await sleep(500);
            return true;
        }
        
        // Fallback: try Quests button
        const questsButton = document.querySelector('button img[src*="quest.png"]')?.closest('button') ||
                            Array.from(document.querySelectorAll('button')).find(btn => {
                                const span = btn.querySelector('span');
                                return span && (span.textContent === 'Quests' || span.textContent === 'Quest Log');
                            });
        
        if (questsButton) {
            console.log('[Better Tasker] Found Quests button, clicking to open quest log...');
            questsButton.click();
            await sleep(500);
            return true;
        }
        
        console.log('[Better Tasker] No quest blip or Quests button found for task removal');
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error opening quest log for task removal:', error);
        return false;
    }
}

// Remove current task if creature is not allowed
async function removeCurrentTaskIfNotAllowed() {
    try {
        console.log('[Better Tasker] Checking if current task should be removed...');
        
        // Get current active task
        const activeTask = globalThis.state?.player?.activeTask;
        if (!activeTask) {
            console.log('[Better Tasker] No active task found');
            return false;
        }
        
        // Safety check: prevent double-removal by checking if we're already in the middle of removing
        if (window.betterTaskerRemovingTask) {
            console.log('[Better Tasker] Task removal already in progress, skipping to prevent double-removal');
            return false;
        }
        
        // Set flag to prevent double-removal
        window.betterTaskerRemovingTask = true;
        
        // Extract creature from current task
        const creatureName = extractCreatureFromTask();
        if (!creatureName) {
            console.log('[Better Tasker] Could not extract creature from current task');
            window.betterTaskerRemovingTask = false;
            return false;
        }
        
        // Check if creature is allowed
        const isAllowed = isCreatureAllowed(creatureName);
        if (isAllowed) {
            console.log(`[Better Tasker] Current task creature "${creatureName}" is allowed, keeping task`);
            window.betterTaskerRemovingTask = false;
            return false;
        }
        
        console.log(`[Better Tasker] Current task creature "${creatureName}" is NOT allowed, removing task...`);
        
        // First, make sure quest log is open (Remove button is only visible when quest log is open)
        console.log('[Better Tasker] Opening quest log to access Remove button...');
        const questLogOpened = await openQuestLogForTaskRemoval();
        if (!questLogOpened) {
            console.log('[Better Tasker] Failed to open quest log for task removal');
            window.betterTaskerRemovingTask = false;
            return false;
        }
        
        // Wait a moment for quest log to fully load
        await sleep(500);
        
        // Find and click the Remove button (look for button containing trash icon)
        let removeButton = null;
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
            const trashIcon = btn.querySelector('svg.lucide-trash2');
            if (trashIcon && btn.textContent && btn.textContent.includes('Remove')) {
                removeButton = btn;
                break;
            }
        }
        
        if (!removeButton) {
            console.log('[Better Tasker] Remove button not found');
            window.betterTaskerRemovingTask = false;
            return false;
        }
        
        console.log('[Better Tasker] Clicking Remove button...');
        removeButton.click();
        
        // Wait for the confirmation dialog to appear
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Find and click the "Remove current task" confirmation button
        const confirmButtons = document.querySelectorAll('button');
        for (const btn of confirmButtons) {
            if (btn.textContent && btn.textContent.includes('Remove current task')) {
                console.log('[Better Tasker] Clicking confirmation button...');
                btn.click();
                
                // Wait after confirmation click
                await new Promise(resolve => setTimeout(resolve, 1000));
                break;
            }
        }
        
        console.log('[Better Tasker] Task removal completed');
        
        // Close quest log after task removal
        console.log('[Better Tasker] Closing quest log after task removal...');
        for (let i = 0; i < 3; i++) {
            const escEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true
            });
            document.dispatchEvent(escEvent);
            await sleep(50);
        }
        await sleep(200);
        
        return true;
        
    } catch (error) {
        console.error('[Better Tasker] Error removing current task:', error);
        return false;
    } finally {
        // Always clear the flag, even if there was an error
        window.betterTaskerRemovingTask = false;
    }
}

// Remove task directly from quest log (without closing it first)
async function removeTaskDirectlyFromQuestLog() {
    try {
        console.log('[Better Tasker] Removing task directly from quest log...');
        
        // Wait a moment for quest log to be fully loaded
        await sleep(500);
        
        // Find and click the Remove button (look for button containing trash icon)
        let removeButton = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!removeButton && attempts < maxAttempts) {
            const allButtons = document.querySelectorAll('button');
            for (const btn of allButtons) {
                const trashIcon = btn.querySelector('svg.lucide-trash2');
                if (trashIcon && btn.textContent) {
                    const text = btn.textContent.trim().toLowerCase();
                    // More specific matching to avoid false positives
                    if (text === 'remove' || text === 'remove task' || text.includes('remove current')) {
                        removeButton = btn;
                        break;
                    }
                }
            }
            
            if (!removeButton) {
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(`[Better Tasker] Remove button not found, retrying... (${attempts}/${maxAttempts})`);
                    await sleep(500);
                }
            }
        }
        
        if (!removeButton) {
            console.log('[Better Tasker] Remove button not found in quest log after retries');
            return false;
        }
        
        console.log('[Better Tasker] Clicking Remove button...');
        removeButton.click();
        
        // Wait for the confirmation dialog to appear
        await sleep(1000);
        
        // Find and click the "Remove current task" confirmation button
        let confirmationClicked = false;
        const confirmButtons = document.querySelectorAll('button');
        for (const btn of confirmButtons) {
            if (btn.textContent) {
                const text = btn.textContent.trim();
                // More specific matching for confirmation button
                if (text === 'Remove current task' || text === 'Remove task' || text === 'Confirm') {
                    console.log('[Better Tasker] Clicking confirmation button...');
                    btn.click();
                    confirmationClicked = true;
                    
                    // Wait after confirmation click
                    await sleep(1000);
                    break;
                }
            }
        }
        
        if (!confirmationClicked) {
            console.log('[Better Tasker] Confirmation button not found - task removal may be incomplete');
            return false;
        }
        
        console.log('[Better Tasker] Task removal completed directly from quest log');
        return true;
        
    } catch (error) {
        console.error('[Better Tasker] Error removing task directly from quest log:', error);
        return false;
    }
}

// Check if a creature is in the allowed list
function isCreatureAllowed(creatureName) {
    try {
        if (!creatureName) {
            console.log('[Better Tasker] No creature name provided for checking');
            return true; // Allow if we can't determine creature
        }
        
        const settings = loadSettings();
        
        // Convert creature name to settings key format (e.g., "Winter Wolf" -> "creature-winter-wolf")
        const creatureKey = `creature-${creatureName.toLowerCase().replace(/\s+/g, '-')}`;
        
        console.log('[Better Tasker] Checking if creature is allowed:', {
            creatureName,
            creatureKey,
            hasIndividualSetting: settings.hasOwnProperty(creatureKey),
            individualSettingValue: settings[creatureKey]
        });
        
        // Use individual creature settings
        const isAllowed = settings[creatureKey] === true;
        if (!isAllowed) {
            console.log(`[Better Tasker] Creature "${creatureName}" is NOT allowed (individual setting: ${settings[creatureKey]})`);
        } else {
            console.log(`[Better Tasker] Creature "${creatureName}" IS allowed (individual setting: ${settings[creatureKey]})`);
        }
        
        return isAllowed;
    } catch (error) {
        console.error('[Better Tasker] Error checking if creature is allowed:', error);
        return true; // Allow on error to avoid blocking tasks
    }
}

// Check for quest blip and accept tasks (respects raid status)
function checkQuestLogForTasks() {
    try {
        // Only run if tasker is enabled
        if (!isTaskerEnabled) {
            return;
        }
        
        // Check if Raid Hunter is actively raiding
        if (isRaidHunterRaiding()) {
            console.log('[Better Tasker] Raid Hunter is actively raiding - skipping quest log check');
            return;
        }
        
        // Don't run if task hunting is ongoing
        if (taskHuntingOngoing) {
            return;
        }
        
        // Check if game is active
        if (!isGameActive()) {
            return;
        }
        
        // Check for quest blip and accept task if available
        const playerContext = globalThis.state.player.getSnapshot().context;
        
        if (playerContext.questLog && playerContext.questLog.task) {
            const task = playerContext.questLog.task;
            
            // Only check for quest blip if there's no active task
            if (!task.gameId) {
                const isQuestBlipReady = isQuestBlipAvailable();
                
                if (isQuestBlipReady) {
                    console.log('[Better Tasker] Quest blip found during raid - accepting task to start cooldown...');
                    // Call the quest log opening logic
                    openQuestLogAndAcceptTask();
                }
            }
        }
        
    } catch (error) {
        console.error('[Better Tasker] Error checking quest log for tasks:', error);
    }
}

// Open quest log and accept new task (extracted from handleTaskFinishing)
async function openQuestLogAndAcceptTask() {
    try {
        // Set task in progress flag to prevent duplicate quest log operations
        taskInProgress = true;
        updateExposedState(); // Update exposed state for other mods
        console.log('[Better Tasker] Task in progress flag set - preventing duplicate quest log operations');
        
        // Clear any open modals first
        for (let i = 0; i < 3; i++) {
            const escEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(escEvent);
            await sleep(50);
        }
        
        // Wait for modals to clear
        await sleep(200);
        console.log('[Better Tasker] Modal clearing completed');
        
        // Find and click quest blip or use "Quests" button as fallback
        let questLogOpened = false;
        const questBlip = document.querySelector('img[src*="quest-blip.png"]');
        
        if (questBlip) {
            questBlip.click();
            await sleep(200);
            console.log('[Better Tasker] Quest log opened via quest blip');
            questLogOpened = true;
        } else {
            // Fallback: Look for "Quests" button
            console.log('[Better Tasker] No quest blip found, looking for Quests button...');
            const questsButton = document.querySelector('button img[src*="quest.png"]');
            if (questsButton) {
                const questButton = questsButton.closest('button');
                if (questButton) {
                    questButton.click();
                    await sleep(200);
                    console.log('[Better Tasker] Quest log opened via Quests button');
                    questLogOpened = true;
                    
                    // Wait for quest log to fully load
                    await sleep(300);
                    
                    // 1. Find Paw and Fur Society section first (section-first approach)
                    console.log('[Better Tasker] Using section-first approach - finding Paw and Fur Society section...');
                    const pawAndFurSection = findPawAndFurSection();
                    if (!pawAndFurSection) {
                        console.log('[Better Tasker] Paw and Fur Society section not found');
                        taskCompletionInProgress = false;
                        taskInProgress = false;
                        return;
                    }
                    
                    // 2. Extract & validate creature from that specific section
                    console.log('[Better Tasker] Extracting creature from Paw and Fur Society section...');
                    const creatureName = extractCreatureFromSection(pawAndFurSection);
                    console.log('[Better Tasker] Extracted creature name:', creatureName);
                    if (!creatureName || !isCreatureAllowed(creatureName)) {
                        console.log(`[Better Tasker] Task rejected - creature "${creatureName}" is not in allowed list`);
                        
                        // Remove the task directly while quest log is open
                        console.log('[Better Tasker] Removing rejected task directly from quest log...');
                        const taskRemoved = await removeTaskDirectlyFromQuestLog();
                        if (taskRemoved) {
                            console.log('[Better Tasker] Rejected task successfully removed from game');
                        } else {
                            console.log('[Better Tasker] Failed to remove rejected task from game');
                        }
                        
                        // Clear flags and return
                        taskCompletionInProgress = false;
                        taskInProgress = false;
                        return;
                    }
                    
                    // 3. Extract suggested map from that same section and navigate
                    console.log('[Better Tasker] Extracting suggested map from Paw and Fur Society section...');
                    const suggestedMapElement = extractSuggestedMapFromSection(pawAndFurSection);
                    
                    if (suggestedMapElement) {
                        console.log('[Better Tasker] Suggested map found, navigating...');
                        await navigateToSuggestedMapAndStartAutoplay(suggestedMapElement);
                    } else {
                        console.log('[Better Tasker] No suggested map found in Paw and Fur Society section');
                    }
                }
            } else {
                console.log('[Better Tasker] Neither quest blip nor Quests button found');
            }
        }
        
        if (questLogOpened) {
            // Wait for quest log to fully load
            await sleep(300);
            
            // Look for and click "New Task" button
            console.log('[Better Tasker] Looking for New Task button...');
            let newTaskButton = document.querySelector('button:has(svg.lucide-plus)');
            if (!newTaskButton) {
                const buttons = document.querySelectorAll('button');
                newTaskButton = Array.from(buttons).find(btn => 
                    btn.textContent.includes('New task') || btn.textContent.includes('New Task')
                );
            }
            
            if (newTaskButton) {
                console.log('[Better Tasker] New Task button found, clicking...');
                newTaskButton.click();
                await sleep(200);
                console.log('[Better Tasker] New Task button clicked');
                
                // Wait for task selection to load
                await sleep(500);
                
                // Check if the task creature is allowed before proceeding
                console.log('[Better Tasker] Checking creature filtering in main path...');
                const creatureName = extractCreatureFromTask();
                console.log('[Better Tasker] Extracted creature name:', creatureName);
                if (creatureName && !isCreatureAllowed(creatureName)) {
                    console.log(`[Better Tasker] Task rejected - creature "${creatureName}" is not in allowed list`);
                    
                    // Remove the task directly while quest log is open
                    console.log('[Better Tasker] Removing rejected task directly from quest log...');
                    const taskRemoved = await removeTaskDirectlyFromQuestLog();
                    if (taskRemoved) {
                        console.log('[Better Tasker] Rejected task successfully removed from game');
                    } else {
                        console.log('[Better Tasker] Failed to remove rejected task from game');
                    }
                    
                    // Clear task in progress flag and return early
                    taskInProgress = false;
                    return;
                }
                
                console.log('[Better Tasker] Task creature is allowed, proceeding with navigation...');
                
                // Navigate to suggested map and start autoplay
                await navigateToSuggestedMapAndStartAutoplay();
            } else {
                console.log('[Better Tasker] New Task button not found');
            }
        } else {
            console.log('[Better Tasker] Could not open quest log - neither quest blip nor Quests button found');
        }
        
        // Clear task in progress flag
        taskInProgress = false;
        console.log('[Better Tasker] Task in progress flag cleared');
        
    } catch (error) {
        console.error('[Better Tasker] Error opening quest log and accepting task:', error);
        taskInProgress = false;
    }
}

// ============================================================================
// 9. INITIALIZATION
// ============================================================================

function init() {
    console.log('[Better Tasker] Better Tasker initializing');
    
    // Load tasker state from localStorage first
    loadTaskerState();
    
    // Set up Raid Hunter coordination
    setupRaidHunterCoordination();
    
    // Check Raid Hunter status immediately on startup
    isRaidHunterActive = isRaidHunterRaiding();
    if (isRaidHunterActive) {
        console.log('[Better Tasker] Raid Hunter is actively raiding - automation will be paused');
    }
    
    // Expose initial state for other mods
    exposeTaskerState();
    
    // Start monitoring for quest log
    startQuestLogMonitoring();
    
    // Try to insert buttons immediately in case quest log is already open
    setTimeout(() => {
        insertButtons();
    }, 1000);
    
    // Start automation if enabled (will check for Raid Hunter internally)
    if (isTaskerEnabled) {
        startAutomation();
    }
    
    console.log('[Better Tasker] Better Tasker Mod initialized.');
}

init();

// ============================================================================
// 7. CLEANUP & EXPORTS
// ============================================================================

// Cleanup function for when mod is disabled
function cleanupBetterTasker() {
    try {
        // Stop automation
        stopAutomation();
        
        // Clean up Raid Hunter coordination
        cleanupRaidHunterCoordination();
        
        // Clean up modal if open
        if (activeTaskerModal) {
            try {
                // Close modal if it has a close method
                if (typeof activeTaskerModal.close === 'function') {
                    activeTaskerModal.close();
                }
            } catch (modalError) {
                console.warn('[Better Tasker] Error closing modal:', modalError);
            }
            cleanupTaskerModal();
        }
        
        // Clean up observer
        if (questLogObserver) {
            questLogObserver.disconnect();
            questLogObserver = null;
        }
        
        // Clean up interval
        if (questLogMonitorInterval) {
            clearInterval(questLogMonitorInterval);
            questLogMonitorInterval = null;
        }
        
        // Clean up quest button validation and restore appearance
        stopQuestButtonValidation();
        restoreQuestButtonAppearance();
        
        // Clean up ESC key listener
        if (escKeyListener) {
            document.removeEventListener('keydown', escKeyListener);
            escKeyListener = null;
        }
        
        // Remove custom CSS
        const shimmerCSS = document.getElementById('taskerShimmerCSS');
        if (shimmerCSS) {
            shimmerCSS.remove();
        }
        
        // Remove buttons if they exist
        const settingsButton = document.getElementById(TASKER_BUTTON_ID);
        if (settingsButton) {
            settingsButton.remove();
        }
        
        const toggleButton = document.getElementById(TASKER_TOGGLE_ID);
        if (toggleButton) {
            toggleButton.remove();
        }
        
        // Remove button containers created by insertButtons()
        const buttonContainers = document.querySelectorAll('div[style*="display: flex"][style*="gap: 4px"][style*="margin-top: 4px"]');
        buttonContainers.forEach(container => {
            // Only remove if it contains our buttons
            if (container.querySelector(`#${TASKER_BUTTON_ID}`) || container.querySelector(`#${TASKER_TOGGLE_ID}`)) {
                container.remove();
            }
        });
        
        // Clean up global state
        if (window.betterTaskerState) {
            delete window.betterTaskerState;
        }
        if (window.cleanupBetterTasker) {
            delete window.cleanupBetterTasker;
        }
        
        // Release control from shared managers
        try {
            if (window.QuestButtonManager) {
                window.QuestButtonManager.releaseControl('Better Tasker');
            }
        } catch (managerError) {
            console.warn('[Better Tasker] Error releasing Quest Button Manager control:', managerError);
        }
        
        try {
            if (window.BestiaryAutomatorSettingsManager) {
                window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
            }
        } catch (managerError) {
            console.warn('[Better Tasker] Error releasing Bestiary Automator Settings Manager control:', managerError);
        }
        
        // Reset session flags
        resetState('full');
        // Don't reset taskNavigationCompleted in cleanup - let it persist
        
        console.log('[Better Tasker] Mod cleanup completed');
    } catch (error) {
        console.error('[Better Tasker] Error during mod cleanup:', error);
    }
}

// Expose state for other mods to check (like Raid Hunter coordination)
function exposeTaskerState() {
    if (typeof window !== 'undefined') {
        window.betterTaskerState = {
            taskInProgress: taskInProgress,
            taskHuntingOngoing: taskHuntingOngoing,
            pendingTaskCompletion: pendingTaskCompletion,
            taskCompletionInProgress: taskCompletionInProgress,
            isTaskerEnabled: isTaskerEnabled,
            taskNavigationCompleted: taskNavigationCompleted
        };
    }
}

// Update exposed state whenever it changes
function updateExposedState() {
    exposeTaskerState();
}

// Make cleanup function available globally for mod loader
window.cleanupBetterTasker = cleanupBetterTasker;

// Export functionality for external access
context.exports = {
    cleanup: cleanupBetterTasker,
    toggleTasker: toggleTasker,
    startAutomation: startAutomation,
    stopAutomation: stopAutomation,
    loadSettings: loadSettings,
    autoSaveSettings: autoSaveSettings
};
