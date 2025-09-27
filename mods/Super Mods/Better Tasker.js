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

// Task handling delay constants
const QUEST_LOG_LOAD_DELAY = 300;
const MAP_NAVIGATION_DELAY = 200;
const MAP_LOAD_DELAY = 1000;
const AUTO_SETUP_DELAY = 1000;
const AUTOPLAY_SETUP_DELAY = 1000;
const BESTIARY_AUTOMATOR_INIT_DELAY = 500;
const BESTIARY_AUTOMATOR_RETRY_DELAY = 2000;
const ESC_KEY_DELAY = 50;
const TASK_START_DELAY = 200;

// ============================================================================
// 1.1. DOM UTILITY FUNCTIONS
// ============================================================================

// Utility function to handle control request/release with proper error handling
function withControl(manager, modName, callback, errorContext = 'operation') {
    // Request control
    if (!manager.requestControl(modName)) {
        console.log(`[Better Tasker] Cannot ${errorContext} - controlled by another mod`);
        return false;
    }
    
    try {
        const result = callback();
        return result;
    } catch (error) {
        console.error(`[Better Tasker] Error during ${errorContext}:`, error);
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
        console.log(`[Better Tasker] Cannot ${errorContext} - not controlled by Better Tasker`);
        return false;
    }
    
    try {
        const result = callback();
        return result;
    } catch (error) {
        console.error(`[Better Tasker] Error during ${errorContext}:`, error);
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
        accent-color: #ffe066;
    `, { checked });
    // Add auto-save listener immediately
    checkbox.addEventListener('change', autoSaveSettings);
    checkboxLabelContainer.appendChild(checkbox);
    
    const label = document.createElement('label');
    label.textContent = labelText;
    label.className = 'pixel-font-16';
    label.style.cssText = `
        font-weight: bold;
        color: #fff;
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
        color: #888;
        font-style: italic;
        margin-top: 2px;
    `;
    settingDiv.appendChild(desc);
    
    return settingDiv;
}

// ============================================================================
// 2. STATE MANAGEMENT
// ============================================================================

// UI/Observer State
let questLogObserver = null;

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

// Raid Hunter coordination state
let isRaidHunterActive = false;
let raidHunterCoordinationInterval = null;
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
let taskOperationInProgress = false;

// Session State
let lastGameStateChange = 0;
let lastNoTaskCheck = 0;

// Centralized state reset function
function resetState(resetType = 'full') {
    try {
        // Common reset groups to eliminate duplication
        const resetCommonFlags = () => {
            autoplayPausedByTasker = false;
            pendingTaskCompletion = false;
            taskOperationInProgress = false;
            lastNoTaskCheck = 0;
            
            // Stop quest button validation and restore appearance
            stopQuestButtonValidation();
            restoreQuestButtonAppearance();
        };
        
        const resetSessionFlags = () => {
            // Session flags reset (currently no session flags to reset)
        };
        
        const resetTaskHunting = () => {
            taskHuntingOngoing = false;
            // Clear saved tasking map ID
            taskingMapId = null;
            // Reset quest button modification flag
            questButtonModifiedForTasking = false;
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
                    taskOperationInProgress = false;
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
        
        // Always update exposed state after any reset so other mods (like Raid Hunter) can see the changes
        updateExposedState();
    } catch (error) {
        console.error('[Better Tasker] Error during state reset:', error);
    }
}

// Centralized cleanup function for task completion failures
function cleanupTaskCompletionFailure(reason = 'unknown') {
    try {
        console.log(`[Better Tasker] Cleaning up after task completion failure: ${reason}`);
        
        // Clear all task-related flags
        resetState('taskComplete');
        
        // Close any open quest log
        clickAllCloseButtons();
        
        // Press ESC to ensure quest log is closed
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
        }
        
        // Update exposed state for other mods
        updateExposedState();
        
        console.log('[Better Tasker] Task completion failure cleanup completed');
        
    } catch (error) {
        console.error('[Better Tasker] Error during cleanup:', error);
    }
}

// ============================================================================
// 3. AUTOPLAY CONTROL FUNCTIONS
// ============================================================================

// Generic function to control autoplay with button clicks
async function controlAutoplayWithButton(action) {
    try {
        console.log(`[Better Tasker] Looking for ${action} button...`);
        
        // Define selectors based on action type
        const selectors = action === 'pause' 
            ? [
                'button:has(svg.lucide-pause)',
                'button.frame-1-red[class*="pause"]',
                'button[class*="pause"]',
                'button[class*="surface-red"]:has(svg)', // Red button with icon (pause)
                'div.flex button:nth-child(2)' // Second button in flex container (pause button)
              ]
            : [
                'button:has(svg.lucide-play)',
                'button.frame-1-green[class*="play"]',
                'button[class*="play"]',
                'button[class*="surface-green"]:has(svg)', // Green button with icon (play)
                'button:not([class*="pause"]):has(svg)' // Fallback for play button
              ];
        
        // Find button using first matching selector
        let button = selectors.reduce((found, selector) => 
            found || document.querySelector(selector), null);
        
        // Fallback: Look for pause button by structure (second button in flex container with pause icon)
        if (!button && action === 'pause') {
            const flexContainer = document.querySelector('div.flex');
            if (flexContainer) {
                const buttons = flexContainer.querySelectorAll('button');
                if (buttons.length >= 2) {
                    const secondButton = buttons[1]; // Second button (pause button)
                    const hasPauseIcon = secondButton.querySelector('svg.lucide-pause');
                    if (hasPauseIcon) {
                        button = secondButton;
                        console.log('[Better Tasker] Found pause button using structure fallback');
                    }
                }
            }
        }
        
        if (button) {
            console.log(`[Better Tasker] Found ${action} button, clicking to ${action} autoplay...`);
            button.click();
            
            // For pause action, verify the pause state was successful
            if (action === 'pause') {
                // Wait a moment for the UI to update
                await sleep(500);
                
                // Check if pause button is now disabled (indicating successful pause)
                const pauseButtonAfter = document.querySelector('button:has(svg.lucide-pause)');
                if (pauseButtonAfter && pauseButtonAfter.disabled) {
                    console.log('[Better Tasker] Pause button verified as disabled - autoplay paused successfully');
                    return true;
                } else {
                    console.log('[Better Tasker] Pause button not disabled - autoplay pause may have failed');
                    console.log('[Better Tasker] Pause button state:', {
                        found: !!pauseButtonAfter,
                        disabled: pauseButtonAfter?.disabled,
                        hasDisabledAttr: pauseButtonAfter?.hasAttribute('disabled')
                    });
                    return false;
                }
            }
            
            return true;
        } else {
            console.log(`[Better Tasker] ${action.charAt(0).toUpperCase() + action.slice(1)} button not found`);
            return false;
        }
    } catch (error) {
        console.error(`[Better Tasker] Error clicking ${action} button:`, error);
        return false;
    }
}

// Find and click the pause button to pause autoplay
async function pauseAutoplayWithButton() {
    return await controlAutoplayWithButton('pause');
}

// Find and click the play button to resume autoplay
async function resumeAutoplayWithButton() {
    return await controlAutoplayWithButton('play');
}

// ============================================================================
// 4. RAID HUNTER COORDINATION
// ============================================================================

// Check if Raid Hunter is actively raiding
function isRaidHunterRaiding() {
    // If Raid Hunter coordination is disabled, always return false
    if (!raidHunterCoordinationInterval) {
        return false;
    }
    
    try {
        // Check if Raid Hunter mod is loaded and actively raiding
        if (typeof window !== 'undefined') {
            // First check if Raid Hunter is actually enabled
            const raidHunterEnabled = localStorage.getItem('raidHunterAutomationEnabled');
            if (raidHunterEnabled !== 'true') {
                return false;
            }
            
            // Check if Raid Hunter is actually currently raiding by checking if it has control of the quest button
            // Raid Hunter takes control of the quest button when it's actively processing a raid
            const raidState = globalThis.state?.raids?.getSnapshot?.();
            if (raidState) {
                const currentRaidList = raidState.context?.list || [];
                const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
                
                // Check if Raid Hunter has control of the quest button OR is internally raiding
                const isRaidHunterCurrentlyRaiding = window.QuestButtonManager?.getCurrentOwner() === 'Raid Hunter' ||
                                                     (window.raidHunterIsCurrentlyRaiding && window.raidHunterIsCurrentlyRaiding());
                
                // Only yield control if Raid Hunter is actually actively raiding (has quest button control)
                if (isRaidHunterCurrentlyRaiding) {
                    console.log('[Better Tasker] Raid Hunter is actively raiding - preventing task automation');
                    return true;
                } else if (currentRaidList.length > 0 && raidHunterEnabled === 'true') {
                    console.log('[Better Tasker] Active raids available but Raid Hunter not actively raiding - allowing task automation');
                    // Don't yield control - let Better Tasker check for tasks
                    return false;
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
    
    // Check Raid Hunter status every 10 seconds
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
    }, 10000);
    
    console.log('[Better Tasker] Raid Hunter coordination set up');
}

// Handle when Raid Hunter stops raiding
function handleRaidHunterStopped() {
    try {
        console.log('[Better Tasker] Raid Hunter stopped - managing Bestiary Automator settings transition');
        
        // Release Raid Hunter's control of Bestiary Automator settings
        window.BestiaryAutomatorSettingsManager.releaseControl('Raid Hunter');
        
        // Ensure Raid Hunter releases quest button control if it still has it
        if (window.QuestButtonManager.getCurrentOwner() === 'Raid Hunter') {
            console.log('[Better Tasker] Forcing Raid Hunter to release quest button control');
            window.QuestButtonManager.releaseControl('Raid Hunter');
        }
        
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
            console.log('[Better Tasker] Enabling our Bestiary Automator settings...');
            enableBestiaryAutomatorSettings();
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
    return createStyledButton(TASKER_BUTTON_ID, 'Settings', 'blue', () => {
        console.log('[Better Tasker] Settings button clicked');
        openTaskerSettingsModal();
    });
}

// Create the toggle button
function createToggleButton() {
    return createStyledButton(TASKER_TOGGLE_ID, 'Disabled', 'red', () => {
        console.log('[Better Tasker] Toggle button clicked');
        toggleTasker();
    });
}

// Insert buttons into Paw and Fur Society section
function insertButtons() {
    // Check if buttons already exist
    if (document.getElementById(TASKER_BUTTON_ID) && document.getElementById(TASKER_TOGGLE_ID)) {
        console.log('[Better Tasker] Buttons already exist, skipping');
        return true; // Success - buttons already exist
    }
    
    const pawAndFurSection = findPawAndFurSection();
    if (!pawAndFurSection) {
        console.log('[Better Tasker] Paw and Fur Society section not found');
        return false; // Failed - section not found
    }
    
    console.log('[Better Tasker] Found Paw and Fur Society section, inserting buttons');
    
    // Find the title element and its parent container
    const titleElement = pawAndFurSection.querySelector('p.text-whiteHighlight');
    if (titleElement && titleElement.textContent === 'Paw and Fur Society') {
        // Find the parent container that holds the title
        const titleContainer = titleElement.parentElement;
        
        if (titleContainer) {
            // Create a button container
            const buttonContainer = createStyledContainer(null, `
                display: flex;
                gap: 4px;
                margin-top: 4px;
            `);
            
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
            return true; // Success - buttons inserted
        } else {
            console.log('[Better Tasker] Could not find title container for buttons');
            return false; // Failed - no container
        }
    } else {
        console.log('[Better Tasker] Could not find Paw and Fur Society title element');
        return false; // Failed - no title element
    }
}

// ============================================================================
// 5. STATE MANAGEMENT FUNCTIONS
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
        // Update exposed state immediately so other mods (like Raid Hunter) can detect the change
        updateExposedState();
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


// ============================================================================
// 6. QUEST BUTTON MODIFICATION FUNCTIONS
// ============================================================================

// Store original quest button state
let originalQuestButtonState = null;
let questButtonValidationInterval = null;

// Store the map ID when tasking starts (after Start button click)
let taskingMapId = null;

// Track if quest button has been modified for tasking (only after Start button click)
let questButtonModifiedForTasking = false;

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
    if (!taskOperationInProgress && !taskHuntingOngoing) {
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
    console.log('[Better Tasker] Attempting to modify quest button for tasking...');
    
    return withControl(window.QuestButtonManager, 'Better Tasker', () => {
        console.log('[Better Tasker] Quest button control granted, finding quest button...');
        
        // Find the quest button in the header navigation
        const questButton = findQuestButton();
        
        if (!questButton) {
            console.log('[Better Tasker] Quest button not found for modification');
            return false;
        }
        
        console.log('[Better Tasker] Quest button found, proceeding with modification...');
        
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
                console.log('[Better Tasker] Stored original quest button state');
            } else {
                console.log('[Better Tasker] Quest button not in original state - not storing originalState');
            }
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
    }, 'modify quest button');
}

// Function to restore quest button to original appearance
function restoreQuestButtonAppearance() {
    return withControlCheck(window.QuestButtonManager, 'Better Tasker', () => {
        // Find the quest button - try multiple selectors to find it regardless of current state
        const questButton = findQuestButton();
        
        if (!questButton) {
            console.log('[Better Tasker] Quest button not found for restoration');
            return false;
        }
        
        if (!window.QuestButtonManager.originalState) {
            console.log('[Better Tasker] Original quest button state not found for restoration');
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
        
        console.log('[Better Tasker] Quest button appearance restored');
        return true;
    }, 'restore quest button');
}

// Function to start monitoring quest button validation
function startQuestButtonValidation() {
    // Clear any existing interval
    if (questButtonValidationInterval) {
        clearInterval(questButtonValidationInterval);
        questButtonValidationInterval = null;
    }
    
    // Only start monitoring if we're currently tasking or hunting
    if (!taskOperationInProgress && !taskHuntingOngoing) {
        return;
    }
    
    console.log('[Better Tasker] Starting quest button validation monitoring');
    
    questButtonValidationInterval = setInterval(() => {
        try {
            // Check if we're still tasking or hunting
            if (!taskOperationInProgress && !taskHuntingOngoing) {
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
                } else if (currentOwner === null && taskHuntingOngoing && !isRaidHunterRaiding() && questButtonModifiedForTasking) {
                    // No one has control and we're tasking - check if quest button needs restoration
                    const questButton = findQuestButton();
                    if (questButton) {
                        const img = questButton.querySelector('img');
                        const span = questButton.querySelector('span');
                        const isInTaskingState = img && img.src.includes('taskrank.png') && span && span.textContent === 'Tasking';
                        
                        if (!isInTaskingState) {
                            // Quest button is not in tasking state - restore it
                            console.log('[Better Tasker] No quest button control and we are tasking - restoring tasking state');
                            modifyQuestButtonForTasking();
                        }
                    }
                } else {
                    // No one has control - quest button should be in normal state
                    console.log('[Better Tasker] No quest button control - quest button should be in normal state');
                }
            }
        } catch (error) {
            console.error('[Better Tasker] Error in quest button validation:', error);
        }
    }, 30000); // Check every 30 seconds
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
// 7. QUEST LOG MONITORING
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
    
    // Handle quest log detection (always insert buttons for UI)
    if (hasQuestLogContent) {
        console.log('[Better Tasker] Quest log content detected!');
        
        // Only try to insert if buttons don't already exist (like Raid Hunter)
        if (!document.getElementById(TASKER_BUTTON_ID) || !document.getElementById(TASKER_TOGGLE_ID)) {
            // Try immediate insertion first (like Raid Hunter)
            if (insertButtons()) {
                console.log('[Better Tasker] Buttons inserted immediately!');
                return;
            }
            
            // Fallback with minimal delay (like Raid Hunter)
            setTimeout(() => {
                insertButtons();
            }, 50);
        }
        
        // Only trigger task completion logic if we're not already processing a task
        // and we're not just inserting UI elements
        if (!taskOperationInProgress && !pendingTaskCompletion && !taskHuntingOngoing) {
            console.log('[Better Tasker] Quest log opened for task processing - checking for tasks...');
            // Small delay to let quest log fully load before checking
            setTimeout(() => {
                checkQuestLogForTasks();
            }, 100);
        } else {
            console.log('[Better Tasker] Quest log opened but task operation already in progress - skipping task check');
        }
    }
    
    // Handle Paw and Fur Society detection (only if tasker is enabled)
    if (hasPawAndFurContent && isTaskerEnabled) {
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

// Starts UI monitoring (always runs to insert buttons)
function startUIMonitoring() {
    console.log('[Better Tasker] Starting UI monitoring...');
    
    // Clear any existing UI monitoring first
    
    if (questLogObserver) {
        console.log('[Better Tasker] Disconnecting existing UI observer');
        questLogObserver.disconnect();
        questLogObserver = null;
    }
    
    // Set up MutationObserver for quest log detection (UI only)
    monitorQuestLogVisibility();
}

// Starts quest log monitoring (for automation only)
function startQuestLogMonitoring() {
    console.log('[Better Tasker] Starting quest log monitoring...');
    
    // Clear any existing monitoring first
    
    if (questLogObserver) {
        console.log('[Better Tasker] Disconnecting existing observer');
        questLogObserver.disconnect();
        questLogObserver = null;
    }
    
    // Set up MutationObserver for quest log detection
    monitorQuestLogVisibility();
}

// Stops quest log monitoring
function stopQuestLogMonitoring() {
    console.log('[Better Tasker] Stopping quest log monitoring...');
    
    // Disconnect mutation observer
    if (questLogObserver) {
        questLogObserver.disconnect();
        questLogObserver = null;
    }
}

// ============================================================================
// 8. SETTINGS MODAL
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
    
    const taskDelayInput = createStyledInput('number', 'taskStartDelay', 3, `
        width: 100%;
        padding: 6px;
        background: #333;
        border: 1px solid #ffe066;
        color: #fff;
        border-radius: 3px;
        box-sizing: border-box;
        font-size: 14px;
    `, { 
        min: 0, 
        max: 10, 
        className: 'pixel-font-16' 
    });
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
    const staminaRefillSetting = createCheckboxSetting(
        'autoRefillStamina',
        'Auto-refill Stamina',
        'Automatically refill stamina when starting a task',
        false
    );
    settingsWrapper.appendChild(staminaRefillSetting);
    
    // Faster Autoplay setting
    const fasterAutoplaySetting = createCheckboxSetting(
        'fasterAutoplay',
        'Faster Autoplay',
        'Enable faster autoplay speed during tasks',
        false
    );
    settingsWrapper.appendChild(fasterAutoplaySetting);
    
    // Auto-complete Tasks setting
    const autoCompleteSetting = createCheckboxSetting(
        'autoCompleteTasks',
        'Autocomplete Tasks',
        'Automatically complete tasks when possible',
        true
    );
    settingsWrapper.appendChild(autoCompleteSetting);
    
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
    const buttonContainer = createStyledContainer(null, `
        display: flex;
        gap: 10px;
        margin-top: 10px;
    `);
    
    const selectAllBtn = createCustomStyledButton(
        'selectAllBtn',
        'Select All',
        'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 text-whiteHighlight',
        'flex: 1;',
        () => {
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
        }
    );
    
    const selectNoneBtn = createCustomStyledButton(
        'selectNoneBtn',
        'Select None',
        'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-red active:frame-pressed-1-red surface-red gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 text-whiteHighlight',
        'flex: 1;',
        () => {
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
        }
    );
    
    buttonContainer.appendChild(selectAllBtn);
    buttonContainer.appendChild(selectNoneBtn);
    section.appendChild(buttonContainer);
    
    return section;
}

// ============================================================================
// 9. SETTINGS PERSISTENCE
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
                // Event listener already added by createCheckboxSetting
            }
        }
        
        if (settings.fasterAutoplay !== undefined) {
            const checkbox = document.getElementById('fasterAutoplay');
            if (checkbox) {
                checkbox.checked = settings.fasterAutoplay;
                // Event listener already added by createCheckboxSetting
            }
        }
        
        if (settings.autoCompleteTasks !== undefined) {
            const checkbox = document.getElementById('autoCompleteTasks');
            if (checkbox) {
                checkbox.checked = settings.autoCompleteTasks;
                // Event listener already added by createCheckboxSetting
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
// 10. TASK HANDLING FUNCTIONS
// ============================================================================

// Enable Bestiary Automator settings with retry logic
function enableBestiaryAutomatorSettings(returnSuccess = false) {
    const settings = loadSettings();
    let anySuccess = false;
    
    if (settings.autoRefillStamina) {
        console.log('[Better Tasker] Auto-refill stamina enabled - enabling Bestiary Automator autorefill...');
        // Add a small delay to ensure Bestiary Automator is fully initialized
        setTimeout(() => {
            const success = enableBestiaryAutomatorStaminaRefill();
            if (success) anySuccess = true;
            if (!success) {
                // If first attempt failed, try again with longer delay for Chrome
                console.log('[Better Tasker] First attempt failed, retrying with longer delay for Chrome...');
                setTimeout(() => {
                    const retrySuccess = enableBestiaryAutomatorStaminaRefill();
                    if (retrySuccess) anySuccess = true;
                }, BESTIARY_AUTOMATOR_RETRY_DELAY);
            }
        }, BESTIARY_AUTOMATOR_INIT_DELAY);
    }
    
    if (settings.fasterAutoplay) {
        console.log('[Better Tasker] Faster autoplay enabled - enabling Bestiary Automator faster autoplay...');
        // Add a small delay to ensure Bestiary Automator is fully initialized
        setTimeout(() => {
            const success = enableBestiaryAutomatorFasterAutoplay();
            if (success) anySuccess = true;
            if (!success) {
                // If first attempt failed, try again with longer delay for Chrome
                console.log('[Better Tasker] First attempt failed, retrying with longer delay for Chrome...');
                setTimeout(() => {
                    const retrySuccess = enableBestiaryAutomatorFasterAutoplay();
                    if (retrySuccess) anySuccess = true;
                }, BESTIARY_AUTOMATOR_RETRY_DELAY);
            }
        }, BESTIARY_AUTOMATOR_INIT_DELAY);
    }
    
    // Return success status if requested (for functions that need it)
    if (returnSuccess) {
        return anySuccess;
    }
}

// Handle quest log state - close quest log first, then navigate to suggested map
async function handleQuestLogState(roomId) {
    // First, close the quest log with ESC key presses (like Raid Hunter)
    console.log('[Better Tasker] Closing quest log before navigation...');
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
        await sleep(ESC_KEY_DELAY); // Small delay between ESC presses
    }
    
    // Wait for quest log to close
    await sleep(MAP_LOAD_DELAY);
    console.log('[Better Tasker] Quest log closed with ESC presses');
    
    // Now navigate to the suggested map
    console.log('[Better Tasker] Navigating to suggested map via API...');
    globalThis.state.board.send({
        type: 'selectRoomById',
        roomId: roomId
    });
    await sleep(MAP_NAVIGATION_DELAY);
    
    // Wait for map to load
    await sleep(MAP_LOAD_DELAY);
    console.log('[Better Tasker] Navigation to suggested map completed via API');
    
    return true; // Navigation completed, quest log closed
}

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
        await sleep(QUEST_LOG_LOAD_DELAY);
        
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
                
                // Handle quest log state and navigation
                const navigationCompleted = await handleQuestLogState(roomId);
                
                // Find and click Auto-setup button
                console.log('[Better Tasker] Looking for Auto-setup button...');
                const autoSetupButton = findButtonByText('Auto-setup');
                if (!autoSetupButton) {
                    console.log('[Better Tasker] Auto-setup button not found');
                    return;
                }
                
                console.log('[Better Tasker] Clicking Auto-setup button...');
                autoSetupButton.click();
                await sleep(AUTO_SETUP_DELAY);
                
                // Enable autoplay mode
                console.log('[Better Tasker] Enabling autoplay mode...');
                await ensureAutoplayMode();
                await sleep(AUTOPLAY_SETUP_DELAY);
                
                // Enable Bestiary Automator settings if configured
                enableBestiaryAutomatorSettings();
                
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
                
                // Modify quest button appearance to show tasking state (after Start button click, like Raid Hunter)
                modifyQuestButtonForTasking();
                questButtonModifiedForTasking = true;
                
                // Start quest button validation monitoring for task hunting
                startQuestButtonValidation();
                
                await sleep(TASK_START_DELAY);
                
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
            enableBestiaryAutomatorSettings();
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

// Wait for game to end by continuously checking multiple game state indicators
async function waitForGameToEnd() {
    console.log('[Better Tasker] Starting continuous game state monitoring...');
    
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max wait time (60 * 2 seconds)
    
    while (attempts < maxAttempts) {
        try {
            // Check multiple indicators that game has ended
            const boardContext = globalThis.state.board.getSnapshot().context;
            const gameTimerContext = globalThis.state.gameTimer.getSnapshot().context;
            
            const isGameRunning = boardContext.gameStarted;
            const gameState = gameTimerContext.state; // 'initial', 'victory', 'defeat'
            console.log(`[Better Tasker] Game state check ${attempts + 1}: gameStarted=${isGameRunning}, gameState=${gameState}`);
            
            // Game has ended if any of these conditions are true:
            // 1. board.gameStarted is false
            // 2. gameTimer.state is 'victory' or 'defeat' (not 'initial')
            if (!isGameRunning || (gameState !== 'initial')) {
                console.log(`[Better Tasker] Game ended after ${attempts * 2} seconds - gameStarted: ${isGameRunning}, gameState: ${gameState}`);
                return true;
            }
            
            // If game has been running for more than 30 seconds and is still in initial state,
            // it might be stuck - proceed with task completion anyway
            if (attempts >= 15 && gameState === 'initial' && isGameRunning) {
                console.log(`[Better Tasker] Game stuck in initial state for ${attempts * 2}s - proceeding with task completion`);
                return true;
            }
            
            // Log progress every 10 seconds (every 5 attempts)
            if (attempts % 5 === 0 && attempts > 0) {
                console.log(`[Better Tasker] Still waiting for game to end... (${attempts * 2}s elapsed)`);
            }
            
            await sleep(2000); // Check every 2 seconds
            attempts++;
            
        } catch (error) {
            console.error('[Better Tasker] Error checking game state during wait:', error);
            await sleep(2000);
            attempts++;
        }
    }
    
    console.log('[Better Tasker] Game state monitoring timeout - proceeding anyway...');
    return false;
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
// 11. BESTIARY AUTOMATOR INTEGRATION
// ============================================================================

// Find Bestiary Automator instance using multiple access methods
function findBestiaryAutomator() {
    // Method 1: Check if Bestiary Automator is available in global scope
    if (window.bestiaryAutomator && window.bestiaryAutomator.updateConfig) {
        console.log('[Better Tasker] Found Bestiary Automator via global window object');
        return window.bestiaryAutomator;
    }
    // Method 2: Check if it's available in context exports
    else if (typeof context !== 'undefined' && context.exports && context.exports.updateConfig) {
        console.log('[Better Tasker] Found Bestiary Automator via context exports');
        return context.exports;
    }
    // Method 3: Try to find it in the mod loader's context
    else if (window.modLoader && window.modLoader.getModContext) {
        const automatorContext = window.modLoader.getModContext('bestiary-automator');
        if (automatorContext && automatorContext.exports && automatorContext.exports.updateConfig) {
            console.log('[Better Tasker] Found Bestiary Automator via mod loader');
            return automatorContext.exports;
        }
    }
    return null;
}

// Generic function to update Bestiary Automator configuration
function updateBestiaryAutomatorConfig(setting, value, enableRetry = false) {
    try {
        const bestiaryAutomator = findBestiaryAutomator();
        
        if (bestiaryAutomator) {
            console.log(`[Better Tasker] ${value ? 'Enabling' : 'Disabling'} Bestiary Automator ${setting}...`);
            bestiaryAutomator.updateConfig({
                [setting]: value
            });
            console.log(`[Better Tasker] Bestiary Automator ${setting} ${value ? 'enabled' : 'disabled'}`);
            
            // Verification for enable operations
            if (value && enableRetry) {
                setTimeout(() => {
                    if (window.bestiaryAutomator && window.bestiaryAutomator.config) {
                        console.log(`[Better Tasker] Verifying ${setting} setting:`, window.bestiaryAutomator.config[setting]);
                    }
                }, 1000);
            }
            
            return true;
        } else {
            console.log(`[Better Tasker] Bestiary Automator not available for ${setting}`);
            
            // Retry logic for enable operations
            if (value && enableRetry) {
                setTimeout(() => {
                    const retryAutomator = findBestiaryAutomator();
                    if (retryAutomator) {
                        console.log(`[Better Tasker] Retrying Bestiary Automator ${setting}...`);
                        retryAutomator.updateConfig({ [setting]: value });
                        console.log(`[Better Tasker] Bestiary Automator ${setting} enabled (retry)`);
                        
                        setTimeout(() => {
                            if (window.bestiaryAutomator && window.bestiaryAutomator.config) {
                                console.log(`[Better Tasker] Verifying ${setting} setting (retry):`, window.bestiaryAutomator.config[setting]);
                            }
                        }, 1000);
                    } else {
                        console.log(`[Better Tasker] Bestiary Automator still not available - you may need to enable ${setting} manually`);
                    }
                }, 2000);
            }
            return false;
        }
    } catch (error) {
        console.error(`[Better Tasker] Error ${value ? 'enabling' : 'disabling'} Bestiary Automator ${setting}:`, error);
        return false;
    }
}

// Generic function to toggle Bestiary Automator settings
function toggleBestiaryAutomatorSetting(setting, value, enableRetry = false) {
    const isEnabling = value === true;
    const controlMethod = isEnabling ? 'requestControl' : 'hasControl';
    
    if (!window.BestiaryAutomatorSettingsManager[controlMethod]('Better Tasker')) {
        const action = isEnabling ? 'control' : 'disable';
        const reason = isEnabling ? 'controlled by another mod' : 'not controlled by Better Tasker';
        console.log(`[Better Tasker] Cannot ${action} Bestiary Automator settings - ${reason}`);
        return false;
    }
    
    const success = updateBestiaryAutomatorConfig(setting, value, enableRetry);
    if (!success && isEnabling) {
        window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
    } else if (!isEnabling) {
        window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
    }
    return success;
}

// Enable Bestiary Automator's autorefill stamina setting
function enableBestiaryAutomatorStaminaRefill() {
    return toggleBestiaryAutomatorSetting('autoRefillStamina', true, true);
}

// Disable Bestiary Automator's autorefill stamina setting
function disableBestiaryAutomatorStaminaRefill() {
    return toggleBestiaryAutomatorSetting('autoRefillStamina', false);
}

// Enable Bestiary Automator's faster autoplay setting
function enableBestiaryAutomatorFasterAutoplay() {
    return toggleBestiaryAutomatorSetting('fasterAutoplay', true, true);
}

// Disable Bestiary Automator's faster autoplay setting
function disableBestiaryAutomatorFasterAutoplay() {
    return toggleBestiaryAutomatorSetting('fasterAutoplay', false);
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

// Ensures autoplay mode is enabled with coordination
function ensureAutoplayMode() {
    // Check if another mod is controlling autoplay
    if (window.AutoplayManager.isControlledByOther('Better Tasker')) {
        console.log('[Better Tasker] Cannot switch to autoplay - controlled by another mod');
        return false;
    }
    
    return withControl(window.AutoplayManager, 'Better Tasker', () => {
        const boardContext = globalThis.state.board.getSnapshot().context;
        const currentMode = boardContext.mode;
        
        if (currentMode !== 'autoplay') {
            globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
            console.log('[Better Tasker] Switched to autoplay mode');
            return true;
        }
        return false;
    }, 'switch to autoplay');
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

// Pause autoplay using game state API with coordination
async function pauseAutoplay() {
    console.log('[Better Tasker] Pausing autoplay using state API...');
    
    // Check if another mod is controlling autoplay
    if (window.AutoplayManager.isControlledByOther('Better Tasker')) {
        console.log('[Better Tasker] Cannot pause autoplay - controlled by another mod');
        return false;
    }
    
    // Request control of autoplay
    if (!window.AutoplayManager.requestControl('Better Tasker')) {
        console.log('[Better Tasker] Cannot pause autoplay - control denied');
        return false;
    }
    
    try {
        // Check current mode and pause if in autoplay
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (boardContext.mode === 'autoplay') {
            // Try to pause autoplay with retry logic
            for (let attempt = 1; attempt <= 3; attempt++) {
                console.log(`[Better Tasker] Pause attempt ${attempt}/3`);
                
                const paused = await pauseAutoplayWithButton();
                if (paused) {
                    autoplayPausedByTasker = true;
                    console.log(`[Better Tasker] Autoplay paused successfully on attempt ${attempt}`);
                    return true;
                } else {
                    console.log(`[Better Tasker] Pause attempt ${attempt} failed`);
                    if (attempt < 3) {
                        console.log('[Better Tasker] Waiting 1 second before retry...');
                        await sleep(1000);
                    }
                }
            }

            // All attempts failed - reload page
            console.log('[Better Tasker] All pause attempts failed, reloading page...');
            window.location.reload();
            return false;
        } else {
            console.log('[Better Tasker] Not in autoplay mode - no need to pause');
            return true; // Already paused/not running
        }
    } finally {
        // Release control after operation
        window.AutoplayManager.releaseControl('Better Tasker');
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
        if (window.BestiaryAutomatorSettingsManager.hasControl('Better Tasker')) {
            console.log('[Better Tasker] Resuming Bestiary Automator settings...');
            bestiaryAutomatorResumed = enableBestiaryAutomatorSettings(true);
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

// Resume autoplay using game state API with coordination
async function resumeAutoplay() {
    try {
        console.log('[Better Tasker] Resuming autoplay using state API...');
        
        // Only resume if we previously paused it
        if (autoplayPausedByTasker) {
            // Check if we still have control
            if (!window.AutoplayManager.hasControl('Better Tasker')) {
                console.log('[Better Tasker] Cannot resume autoplay - no longer have control');
                autoplayPausedByTasker = false;
                return false;
            }
            
            // Use play button instead of switching to autoplay mode
            const resumed = resumeAutoplayWithButton();
            autoplayPausedByTasker = false;
            if (resumed) {
                console.log('[Better Tasker] Autoplay resumed successfully using play button');
            } else {
                // Fallback to autoplay mode if play button not found
                const wasChanged = ensureAutoplayMode();
                if (wasChanged) {
                    console.log('[Better Tasker] Autoplay resumed using fallback (switched to autoplay mode)');
                } else {
                    console.log('[Better Tasker] Already in autoplay mode - no need to resume');
                }
            }
            return true;
        } else {
            console.log('[Better Tasker] Autoplay was not paused by tasker - no need to resume');
            return true;
        }
    } catch (error) {
        console.error('[Better Tasker] Error resuming autoplay:', error);
        return false;
    }
}


// Open quest log directly without relying on quest blip
async function openQuestLogDirectly() {
    try {
        console.log('[Better Tasker] Opening quest log directly...');
        
        // Try to find quest log button or icon
        const questSelectors = [
            'button[aria-label*="quest"]',
            'button[title*="quest"]',
            '.quest-icon',
            'img[src*="quest.png"]',
            'button:has(svg[data-lucide="book"])',
            'button:has(svg[data-lucide="scroll"])'
        ];
        
        let questButton = null;
        for (const selector of questSelectors) {
            questButton = document.querySelector(selector);
            if (questButton) {
                console.log(`[Better Tasker] Found quest button with selector: ${selector}`);
                break;
            }
        }
        
        if (questButton) {
            questButton.click();
            await sleep(300);
            
            // Validate that quest log actually opened
            const questLogContainer = document.querySelector('[class*="quest"], [class*="modal"], [class*="dialog"]');
            if (questLogContainer) {
                console.log('[Better Tasker] Quest log opened directly and validated');
                return true;
            } else {
                console.log('[Better Tasker] Quest log button clicked but UI did not appear');
                return false;
            }
        } else {
            console.log('[Better Tasker] Could not find quest log button, trying fallback...');
            
            // Fallback: try to find any button that might open quest log
            const allButtons = document.querySelectorAll('button');
            const questButtonFallback = Array.from(allButtons).find(btn => 
                btn.textContent.toLowerCase().includes('quest') ||
                btn.getAttribute('aria-label')?.toLowerCase().includes('quest') ||
                btn.getAttribute('title')?.toLowerCase().includes('quest')
            );
            
            if (questButtonFallback) {
                questButtonFallback.click();
                await sleep(300);
                
                // Validate that quest log actually opened
                const questLogContainer = document.querySelector('[class*="quest"], [class*="modal"], [class*="dialog"]');
                if (questLogContainer) {
                    console.log('[Better Tasker] Quest log opened via fallback and validated');
                    return true;
                } else {
                    console.log('[Better Tasker] Quest log fallback clicked but UI did not appear');
                    return false;
                }
            }
            
            console.log('[Better Tasker] Could not find quest log button with any method');
            return false;
        }
    } catch (error) {
        console.error('[Better Tasker] Error opening quest log directly:', error);
        return false;
    }
}

// Find and click Finish button with improved detection
async function findAndClickFinishButton() {
    try {
        console.log('[Better Tasker] Looking for Finish button...');
        
        // Wait for quest log to load
        await sleep(500);
        
        // Multiple selectors for Finish button
        const finishSelectors = [
            'button[aria-label*="Finish"]',
            'button[title*="Finish"]',
            'button:has(svg.lucide-check)',
            'button:has(svg.lucide-check-circle)'
        ];
        
        let finishButton = null;
        let attempts = 0;
        const maxAttempts = 3; // 3 retries with 1000ms intervals
        
        // Use mutation observer to watch for Finish button changes
        const finishButtonObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') {
                    const target = mutation.target;
                    if (target.textContent?.includes('Finish')) {
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
        
        // Poll for Finish button
        while (!finishButton && attempts < maxAttempts) {
            await sleep(1000);
            attempts++;
            
            // First try: search all buttons by text content (most reliable)
            const allButtons = document.querySelectorAll('button');
            finishButton = Array.from(allButtons).find(btn => 
                btn.textContent.includes('Finish') && 
                !btn.hasAttribute('disabled') && 
                !btn.disabled
            );
            
            // If not found, try CSS selectors
            if (!finishButton) {
                for (const selector of finishSelectors) {
                    try {
                        const buttons = document.querySelectorAll(selector);
                        finishButton = Array.from(buttons).find(btn => 
                            btn.textContent.includes('Finish') && 
                            !btn.hasAttribute('disabled') && 
                            !btn.disabled
                        );
                        
                        if (finishButton) break;
                    } catch (error) {
                        // Skip invalid selectors
                        console.log(`[Better Tasker] Skipping invalid selector: ${selector}`);
                    }
                }
            }
            
            if (finishButton) {
                console.log('[Better Tasker] Finish button found and ready, attempts:', attempts);
                break;
            }
            
            if (attempts % 2 === 0) { // Log every 2 seconds
                console.log(`[Better Tasker] Still looking for Finish button... (${attempts}s)`);
            }
        }
        
        // Stop observing
        finishButtonObserver.disconnect();
        
        // Click Finish button
        if (finishButton) {
            console.log('[Better Tasker] Clicking Finish button...');
            finishButton.click();
            await sleep(200);
            console.log('[Better Tasker] Finish button clicked');
            
            // Clear task operation in progress flag
            taskOperationInProgress = false;
            updateExposedState();
            
            // Verify task completion
            await sleep(1000);
            const taskCompleted = await verifyTaskCompletion();
            if (taskCompleted) {
                console.log('[Better Tasker] Task completion verified successfully');
                
                // Press ESC to clear quest log after successful task completion
                console.log('[Better Tasker] Pressing ESC to clear quest log...');
                const escEvent = new KeyboardEvent('keydown', {
                    key: 'Escape',
                    code: 'Escape',
                    keyCode: 27,
                    which: 27,
                    bubbles: true,
                    cancelable: true
                });
                document.dispatchEvent(escEvent);
                await sleep(200); // Wait for quest log to close
                console.log('[Better Tasker] Quest log cleared with ESC key');
                
                // Reset task hunting flag since task is completed
                resetState('taskComplete');
                
                // Restore quest button appearance
                restoreQuestButtonAppearance();
                updateToggleButton();
                
                // Don't resume automations after task completion - let user choose next action
                console.log('[Better Tasker] Task completed - returning to idle state for user control');
            }
            
            return true;
        } else {
            console.log('[Better Tasker] Finish button never became ready');
            // Clear task operation in progress flag since no finish button appeared
            taskOperationInProgress = false;
            updateExposedState();
            console.log('[Better Tasker] Task completion and progress flags cleared - no finish button');
            
            // Stop quest button validation and restore appearance
            stopQuestButtonValidation();
            restoreQuestButtonAppearance();
            updateToggleButton();
            
            return false;
        }
    } catch (error) {
        console.error('[Better Tasker] Error finding and clicking Finish button:', error);
        
        // Clear flags on error
        taskOperationInProgress = false;
        updateExposedState();
        
        return false;
    }
}


// Handle task completion when task.ready = true (API state)
async function handleTaskReadyCompletion() {
    try {
        console.log('[Better Tasker] Handling task ready completion via API state...');
        
        // Set task operation in progress flag to prevent duplicate operations
        taskOperationInProgress = true;
        updateExposedState(); // Update exposed state for other mods
        console.log('[Better Tasker] Task operation in progress flag set - preventing duplicate operations');
        
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
        
        // Also try clicking any Close buttons
        clickAllCloseButtons();
        
        // Wait for modals to clear
        await sleep(200);
        console.log('[Better Tasker] Modal clearing completed');
        
        // Check if a game is actually running before waiting for it to finish
        const boardContext = globalThis.state.board.getSnapshot().context;
        const isGameRunning = boardContext.gameStarted;
        console.log('[Better Tasker] Game running check:', isGameRunning);
        
        if (isGameRunning) {
            console.log('[Better Tasker] Game is running, waiting for game to finish before completing task...');
            // NOTE: Quest log opening and Finish button clicking will be handled 
            // in the game end event handler, not here, to avoid opening quest log
            // while game is still running
        } else {
            console.log('[Better Tasker] No game running, proceeding with task completion...');
            // No game running, proceed with quest log opening
            await handlePostGameTaskCompletion();
        }
        
    } catch (error) {
        console.error('[Better Tasker] Error in handleTaskReadyCompletion:', error);
        cleanupTaskCompletionFailure('error in handleTaskReadyCompletion');
    }
}

// Open quest log with retry mechanism - tries 3 times with ESC fallback
async function openQuestLogWithRetry() {
    for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`[Better Tasker] Quest log opening attempt ${attempt}/3...`);
        
        // Try to open quest log directly
        const questLogOpened = await openQuestLogDirectly();
        
        if (questLogOpened) {
            console.log(`[Better Tasker] Quest log opened successfully on attempt ${attempt}`);
            return true;
        }
        
        // If not the last attempt, try ESC key and retry
        if (attempt < 3) {
            console.log(`[Better Tasker] Quest log opening failed, trying ESC key and retrying...`);
            const escEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(escEvent);
            await sleep(200); // Wait for any modals to close
        }
    }
    
    console.log('[Better Tasker] All quest log opening attempts failed');
    return false;
}

// Handle quest log opening and button clicking AFTER game finishes
async function handlePostGameTaskCompletion() {
    try {
        console.log('[Better Tasker] Handling post-game task completion...');
        
        // Wait for game to finish completely
        console.log('[Better Tasker] Waiting for game to finish...');
        await sleep(1000); // Wait for game end animations and UI to settle
        
        
        // Check current task state to determine what to do
        const playerContext = globalThis.state.player.getSnapshot().context;
        const task = playerContext?.questLog?.task;
        
        if (task && task.ready) {
            // Task is ready - open quest log and look for Finish button
            console.log('[Better Tasker] Task is ready, opening quest log for Finish button...');
            
            // Try to open quest log with retry mechanism
            const questLogOpened = await openQuestLogWithRetry();
            
            if (questLogOpened) {
                // Look for Finish button
                await findAndClickFinishButton();
            } else {
                console.log('[Better Tasker] Failed to open quest log after 3 attempts');
            }
        } else {
            // No active task or not ready - check for quest blip to start new task
            console.log('[Better Tasker] No ready task, checking for quest blip to start new task...');
            
            const questBlip = document.querySelector('img[src*="quest-blip.png"]');
            if (questBlip) {
                questBlip.click();
                await sleep(300);
                console.log('[Better Tasker] Quest log opened via quest blip for new task');
                await openQuestLogAndAcceptTask();
            } else {
                console.log('[Better Tasker] No quest blip found, no new task available');
                cleanupTaskCompletionFailure('no quest blip found');
            }
        }
        
        // Clear task operation flag on successful completion
        taskOperationInProgress = false;
        updateExposedState();
        console.log('[Better Tasker] Task operation completed successfully');
        
    } catch (error) {
        console.error('[Better Tasker] Error in handlePostGameTaskCompletion:', error);
        cleanupTaskCompletionFailure('error in handlePostGameTaskCompletion');
    }
}


// Handle task finishing - main function for completing tasks
async function handleTaskFinishing() {
    if (!isTaskerEnabled) {
        console.log('[Better Tasker] Tasker disabled, skipping task completion');
        return;
    }
    
    // Check if quest blip is available (indicates new task available)
    const isQuestBlipReady = isQuestBlipAvailable();
    
    // If task hunting is ongoing, check if task is ready to complete
    if (taskHuntingOngoing) {
        // Check if we have an active task that's ready
        const playerContext = globalThis.state.player.getSnapshot().context;
        const task = playerContext?.questLog?.task;
        
        if (task && task.gameId && task.ready) {
            console.log('[Better Tasker] Task hunting complete - task is ready, proceeding with completion');
            // Don't return - proceed with task completion
        } else {
            console.log('[Better Tasker] Task hunting ongoing, task not ready yet - skipping task completion');
            return;
        }
    }
    
    // Don't run task finishing if a task operation is already in progress
    if (taskOperationInProgress) {
        console.log('[Better Tasker] Task operation already in progress, skipping quest log check');
        return;
    }
    
    // Don't run task finishing if pending task completion is already set
    if (pendingTaskCompletion) {
        console.log('[Better Tasker] Pending task completion already set, skipping quest log check');
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
            
            // Check if task is ready OR if autoplay is active
            const isTaskReady = task.gameId ? task.ready : false; // Only check task.ready if there's an active task
            let isAutoplayActive = checkIfAutoplayIsActive();
            
            // If autoplay shows "Auto" state, wait for it to transition to "Autoplay" state
            if (!isTaskReady && !isAutoplayActive) {
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
            
            // Try to open quest log when there's an active task
            if (task.gameId) {
                console.log('[Better Tasker] Attempting to open quest log for active task...');
            } else if (isQuestBlipReady) {
                console.log('[Better Tasker] Quest blip detected - opening quest log to start new task...');
            } else {
                console.log('[Better Tasker] Attempting to open quest log to start new task...');
            }
            
            if (isTaskReady) {
                console.log('[Better Tasker] Task ready via API, opening quest log directly...');
                
                // Stop ALL automations when task is ready
                await stopAllAutomationsForTaskCompletion();
                
                // Check if a game is currently running
                const boardContext = globalThis.state.board.getSnapshot().context;
                const isGameRunning = boardContext.gameStarted;
                console.log('[Better Tasker] Game running check:', isGameRunning);
                
                if (isGameRunning) {
                    console.log('[Better Tasker] Game is running, waiting for game to finish before claiming task...');
                    pendingTaskCompletion = true;
                    updateExposedState(); // Update exposed state for other mods
                    console.log('[Better Tasker] Pending task completion flag set - waiting for game to end');
                    
                    // Start continuous checking for game end
                    await waitForGameToEnd();
                    
                    // Game has ended, proceed with task completion
                    console.log('[Better Tasker] Game ended, proceeding with task completion...');
                    await handleTaskReadyCompletion();
                    return;
                } else {
                    console.log('[Better Tasker] No game running, proceeding with task completion...');
                }
                
                // Task is ready and no game running - proceed with claiming
                await handleTaskReadyCompletion();
                return;
                
            } else if (isQuestBlipReady) {
                console.log('[Better Tasker] Quest blip detected - opening quest log to start new task...');
                // Quest blip is only used for starting new tasks, not completing existing ones
                
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
            
            // 1. Open quest log for other cases (autoplay active, etc.)
            console.log('[Better Tasker] Opening quest log for general case...');
            
            if (isQuestBlipReady) {
                // Set task completion in progress flag to prevent duplicate operations
                taskCompletionInProgress = true;
                updateExposedState(); // Update exposed state for other mods
                console.log('[Better Tasker] Task completion in progress flag set - preventing duplicate operations');
                
                // Set task in progress flag to prevent duplicate quest log operations
                taskInProgress = true;
                console.log('[Better Tasker] Task in progress flag set - preventing duplicate quest log operations');
                
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
                
                // Also try clicking any Close buttons
                clickAllCloseButtons();
                
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
                    // Set task operation in progress flag when actually accepting a new task
                    taskOperationInProgress = true;
                    updateExposedState();
                    console.log('[Better Tasker] Task operation in progress flag set - accepting new task');
                    
                    newTaskButton.click();
                    await sleep(200);
                    console.log('[Better Tasker] New Task button clicked');
                    
                    // Wait for task selection to load
                    await sleep(500);
                    
                    // Check if the task creature is allowed before proceeding
                    console.log('[Better Tasker] Checking creature filtering in handleTaskFinishing...');
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
                        
                        // Clear task operation in progress flag and return early
                        taskOperationInProgress = false;
                        return;
                    }
                    
                    console.log('[Better Tasker] Task creature is allowed, proceeding with navigation...');
                    
                    // 3. Navigate to suggested map and start autoplay
                    await navigateToSuggestedMapAndStartAutoplay();
                } else {
                    console.log('[Better Tasker] New Task button not found, checking for suggested map...');
                    
                    // Try to navigate to suggested map using API (will validate Paw and Fur Society section internally)
                    await navigateToSuggestedMapAndStartAutoplay();
                }
                
                // 4. Wait up to 3 seconds for Finish button with mutation observer
                let finishButton = null;
                let attempts = 0;
                const maxAttempts = 3; // 3 retries with 1000ms intervals
                
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
                    
                // Clear task operation in progress flag
                taskOperationInProgress = false;
                    
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
                    
                    // Verify that task is actually completed
                    const taskCompleted = await verifyTaskCompletion();
                    if (taskCompleted) {
                        console.log('[Better Tasker] Task completion verified - returning to idle state');
                    } else {
                        console.log('[Better Tasker] Task completion verification failed');
                        cleanupTaskCompletionFailure('task completion verification failed');
                    }
                } else {
                    // If we were checking during autoplay and no finish button appeared, just close the quest log
                    if (isAutoplayActive && !isTaskReady) {
                        console.log('[Better Tasker] No finish button found during autoplay, closing quest log');
                        clickAllCloseButtons();
                // Clear task operation in progress flag since we're closing the quest log
                taskOperationInProgress = false;
                updateExposedState(); // Update exposed state for other mods
                console.log('[Better Tasker] Task completion and progress flags cleared - quest log closed');
                
                // Stop quest button validation and restore appearance
                stopQuestButtonValidation();
                restoreQuestButtonAppearance();
                
                // Restore normal button state
                updateToggleButton();
                    } else {
                        console.log('[Better Tasker] Finish button never became ready');
                        // Clear task operation in progress flag since no finish button appeared
                        taskOperationInProgress = false;
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
                        
                        // Set task operation in progress flag
                        taskOperationInProgress = true;
                        updateExposedState();
                        console.log('[Better Tasker] Task operation in progress flag set - preventing duplicate operations');
                        
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
                        
                        // Also try clicking any Close buttons
                        clickAllCloseButtons();
                        
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
                            taskOperationInProgress = false;
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
                            taskOperationInProgress = false;
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
                // Clear task operation in progress flag since no quest blip was found
                taskOperationInProgress = false;
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
            // Clear task operation in progress flag since no quest log or task was found
            taskOperationInProgress = false;
            console.log('[Better Tasker] Task completion and progress flags cleared - no quest log or task');
            
            // Stop quest button validation and restore appearance
            stopQuestButtonValidation();
            restoreQuestButtonAppearance();
            
            // Restore normal button state
            updateToggleButton();
        }
    } catch (error) {
        console.error('[Better Tasker] Error handling task finishing:', error);
        cleanupTaskCompletionFailure('error handling task finishing');
    }
}

// ============================================================================
// 12. AUTOMATION LOOP
// ============================================================================

// Add debouncing for game state events
const GAME_STATE_DEBOUNCE_MS = 1000; // 1 second debounce

// Subscribe to board game state changes
function subscribeToGameState() {
    try {
        // Subscribe to board state changes for new game detection
        if (globalThis.state && globalThis.state.board) {
            // Consolidated new game handler with debouncing
            const handleNewGame = async (event) => {
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
                                const isGameRunning = boardContext.gameStarted;
                                console.log('[Better Tasker] Game running check:', isGameRunning);
                                
                                if (isGameRunning) {
                                    console.log('[Better Tasker] Game is running, waiting for game to finish before claiming task...');
                                    pendingTaskCompletion = true;
                                    updateExposedState(); // Update exposed state for other mods
                                    console.log('[Better Tasker] Pending task completion flag set - waiting for game to end');
                                    
                                    // Start continuous checking for game end
                                    await waitForGameToEnd();
                                    
                                    // Game has ended, proceed with task completion
                                    console.log('[Better Tasker] Game ended, proceeding with task completion...');
                                    await handleTaskReadyCompletion();
                                    return;
                                } else {
                                    console.log('[Better Tasker] No game running, proceeding with task completion...');
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
            const handleEndGame = async (event) => {
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
                                    await handlePostGameTaskCompletion();
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
                await handlePostGameTaskCompletion();
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
    
    // Set up Raid Hunter coordination
    setupRaidHunterCoordination();
    
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
    
    // Clean up Raid Hunter coordination
    cleanupRaidHunterCoordination();
    
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
    
    // Pause autoplay if we have control (using pause button)
    try {
        if (window.AutoplayManager.hasControl('Better Tasker')) {
            const boardContext = globalThis.state.board.getSnapshot().context;
            if (boardContext.mode === 'autoplay') {
                // Use pause button to pause autoplay
                const paused = pauseAutoplayWithButton();
                if (paused) {
                    console.log('[Better Tasker] Autoplay paused using pause button');
                } else {
                    console.log('[Better Tasker] Pause button not found - autoplay not paused');
                }
            }
            // Release control after pausing
            window.AutoplayManager.releaseControl('Better Tasker');
        } else {
            console.log('[Better Tasker] Cannot pause autoplay - not controlling autoplay');
        }
    } catch (error) {
        console.error('[Better Tasker] Error pausing autoplay:', error);
    }
    
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
// 12.1. CREATURE FILTERING FUNCTIONS
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
        // Don't set task operation in progress flag here - only set it when actually processing a task
        console.log('[Better Tasker] Opening quest log to check for tasks...');
        
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
                        taskOperationInProgress = false;
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
                        taskOperationInProgress = false;
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
                // Set task operation in progress flag when actually accepting a new task
                taskOperationInProgress = true;
                updateExposedState();
                console.log('[Better Tasker] Task operation in progress flag set - accepting new task');
                
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
                    
                    // Clear task operation in progress flag and return early
                    taskOperationInProgress = false;
                    return;
                }
                
                console.log('[Better Tasker] Task creature is allowed, proceeding with navigation...');
                
                // Navigate to suggested map and start autoplay
                await navigateToSuggestedMapAndStartAutoplay();
            } else {
                console.log('[Better Tasker] New Task button not found');
                cleanupTaskCompletionFailure('no new task button found');
            }
        } else {
            console.log('[Better Tasker] Could not open quest log - neither quest blip nor Quests button found');
        }
        
        console.log('[Better Tasker] Quest log check completed');
        
    } catch (error) {
        console.error('[Better Tasker] Error opening quest log and accepting task:', error);
        cleanupTaskCompletionFailure('error opening quest log and accepting task');
    }
}

// ============================================================================
// 13. INITIALIZATION
// ============================================================================

function init() {
    console.log('[Better Tasker] Better Tasker initializing');
    
    // Load tasker state from localStorage first
    loadTaskerState();
    
    // Only set up Raid Hunter coordination if tasker is enabled
    if (isTaskerEnabled) {
        setupRaidHunterCoordination();
        
        // Check Raid Hunter status immediately on startup
        isRaidHunterActive = isRaidHunterRaiding();
        if (isRaidHunterActive) {
            console.log('[Better Tasker] Raid Hunter is actively raiding - automation will be paused');
        }
    }
    
    // Expose initial state for other mods
    exposeTaskerState();
    
    // Always start UI monitoring to insert buttons (needed to enable/disable mod)
    startUIMonitoring();
    
    // Start automation if enabled (will check for Raid Hunter internally)
    if (isTaskerEnabled) {
        startAutomation();
    }
    
    console.log('[Better Tasker] Better Tasker Mod initialized.');
}

init();

// ============================================================================
// 14. CLEANUP & EXPORTS
// ============================================================================

// Cleanup function for when mod is disabled
function cleanupBetterTasker(periodic = false) {
    try {
        // Stop automation only if not periodic cleanup
        if (!periodic) {
            stopAutomation();
        }
        
        // Clean up Raid Hunter coordination
        cleanupRaidHunterCoordination();
        
        // Clean up modal if open only if not periodic cleanup
        if (!periodic && activeTaskerModal) {
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
        
        // Clean up quest log observer
        stopQuestLogMonitoring();
        
        // Clean up quest button validation and restore appearance
        stopQuestButtonValidation();
        restoreQuestButtonAppearance();
        
        // Release autoplay control
        window.AutoplayManager.releaseControl('Better Tasker');
        
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
        
        // Remove buttons if they exist only if not periodic cleanup
        if (!periodic) {
            const settingsButton = document.getElementById(TASKER_BUTTON_ID);
            if (settingsButton) {
                settingsButton.remove();
            }
            
            const toggleButton = document.getElementById(TASKER_TOGGLE_ID);
            if (toggleButton) {
                toggleButton.remove();
            }
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
        if (window.updateWarningText) {
            delete window.updateWarningText;
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
            taskOperationInProgress: taskOperationInProgress,
            taskHuntingOngoing: taskHuntingOngoing,
            pendingTaskCompletion: pendingTaskCompletion,
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

// Expose cleanup function globally for the mod loader
window.cleanupSuperModsBetterTaskerjs = (periodic = false) => {
  cleanupBetterTasker(periodic);
};
