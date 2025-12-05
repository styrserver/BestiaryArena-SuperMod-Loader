// =======================
// Better Boosted Maps - A mod for Bestiary Arena
// =======================
'use strict';

console.log('[Better Boosted Maps] initializing...');

const MOD_ID = 'better-boosted-maps';
const TOGGLE_BUTTON_ID = `${MOD_ID}-toggle-button`;
const SETTINGS_BUTTON_ID = `${MOD_ID}-settings-button`;

// Translation helper
const t = (key) => {
    if (typeof context !== 'undefined' && context.api && context.api.i18n && context.api.i18n.t) {
        return context.api.i18n.t(key);
    }
    // Fallback to key if translation API is not available
    return key;
};

// Helper for dynamic translation with placeholders
const tReplace = (key, replacements) => {
    let text = t(key);
    Object.entries(replacements).forEach(([placeholder, value]) => {
        text = text.replace(`{${placeholder}}`, value);
    });
    return text;
};

// Timing constants - Standardized across all mods
const NAVIGATION_DELAY = 500;           // Reduced from 1000ms for faster response
const AUTO_SETUP_DELAY = 800;          // Reduced from 1000ms for faster response
const AUTOPLAY_SETUP_DELAY = 500;      // Reduced from 1000ms for faster response
const AUTOMATION_CHECK_DELAY = 300;    // Reduced from 1000ms for faster response
const BESTIARY_INTEGRATION_DELAY = 300; // Reduced from 500ms for faster response
const BESTIARY_RETRY_DELAY = 1500;     // Reduced from 2000ms for faster response
const BESTIARY_INIT_WAIT = 2000;       // Reduced from 3000ms for faster response

// User-configurable delays
const DEFAULT_START_DELAY = 3;         // 3 seconds default (user-configurable 1-10)
const MAX_START_DELAY = 10;            // 10 seconds maximum

// Stamina constants
const DEFAULT_STAMINA_COST = 30;

// UI Class name constants
const BASE_BUTTON_CLASSES = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50';
const TAB_BUTTON_CLASSES = `${BASE_BUTTON_CLASSES} gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight`;
const ACTION_BUTTON_CLASSES = `${BASE_BUTTON_CLASSES} gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 text-whiteHighlight`;

const BUTTON_STYLES = {
    GREEN: 'frame-1-green active:frame-pressed-1-green surface-green',
    RED: 'frame-1-red active:frame-pressed-1-red surface-red',
    REGULAR: 'frame-1-regular active:frame-pressed-1-regular surface-regular'
};

const REGION_NAME_MAP = {
    'rook': 'Rookgaard',
    'carlin': 'Carlin',
    'folda': 'Folda',
    'abdendriel': 'Ab\'Dendriel',
    'kazordoon': 'Kazordoon',
    'venore': 'Venore'
};

// Equipment that cannot be on boosted maps
const EXCLUDED_EQUIPMENT = [
    'Amazon Armor',
    'Amazon Helmet',
    'Amazon Shield',
    'Earthborn Titan Armor',
    'Fireborn Giant Armor',
    'Hailstorm Rod',
    'Jester Hat',
    'Paladin Armor',
    'Rubber Cap',
    'Steel Boots',
    'Windborn Colossus Armor',
    'Witch Hat'
];

// Maps that cannot have boosted equipment (grey out in settings)
const MAPS_WITHOUT_BOOSTED_EQUIPMENT = [
    'Lonesome Dragon',
    'Shore Camp',
    'Orcsmith Orcshop',
    'Mine Hub',
    'Emperor Kruzak\'s Treasure Room',
    'Mad Technomancer\'s Lab',
    'Eclipse',
    'Dwarven Bridge',
    'A Secluded Herb',
    'Amazon Camp',
    'Black Knight Villa',
    'Dragon Lair',
    'Corym Base Lounge'
];

// =======================
// 1.1. Stamina Monitoring Functions
// =======================

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
            console.log('[Better Boosted Maps] Stamina element not found');
            return 0;
        }
        
        const staminaElement = elStamina.querySelector('span span');
        if (!staminaElement) {
            console.log('[Better Boosted Maps] Stamina text element not found');
            return 0;
        }
        
        const stamina = Number(staminaElement.textContent);
        console.log('[Better Boosted Maps] Current stamina from DOM:', stamina);
        return stamina;
    } catch (error) {
        console.error('[Better Boosted Maps] Error reading stamina:', error);
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
        
        return DEFAULT_STAMINA_COST; // Default if unknown
    } catch (error) {
        console.error('[Better Boosted Maps] Error getting stamina cost:', error);
        return DEFAULT_STAMINA_COST;
    }
}

/**
 * Get current room ID
 * @returns {string|null} Current room ID or null
 */
function getCurrentRoomId() {
    try {
        const boardContext = globalThis.state?.board?.getSnapshot()?.context;
        return boardContext?.selectedMap?.selectedRoom?.id || null;
    } catch (error) {
        return null;
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
        console.log(`[Better Boosted Maps] Tooltip check: Insufficient (needs ${cost})`);
        return { insufficient: true, cost };
    }
    
    // No tooltip = sufficient stamina (trust the game)
    return { insufficient: false, cost };
}

/**
 * Get stamina cost for current map (cached or from API)
 * @returns {number} Stamina cost or default
 */
function getStaminaCost() {
    const currentMapId = getCurrentRoomId();
    
    // If we have cached cost for this map, use it
    if (currentMapId && modState.staminaCache.currentMapId === currentMapId && modState.staminaCache.cost) {
        console.log(`[Better Boosted Maps] Using cached stamina cost: ${modState.staminaCache.cost}`);
        return modState.staminaCache.cost;
    }
    
    // Get fresh cost from game API
    const cost = getCurrentMapStaminaCost();
    
    // Cache it for this map
    if (currentMapId) {
        modState.staminaCache.currentMapId = currentMapId;
        modState.staminaCache.cost = cost;
        console.log(`[Better Boosted Maps] Cached stamina cost from API: ${cost} for map ${currentMapId}`);
    }
    
    return cost;
}

/**
 * Watch for stamina depletion (tooltip appears)
 * @param {Function} onDepleted - Callback when stamina depletes
 */
function watchStaminaDepletion(onDepleted) {
    // Check immediately if already depleted
    const staminaCheck = hasInsufficientStamina();
    if (staminaCheck.insufficient) {
        console.log('[Better Boosted Maps] Stamina already depleted - starting recovery monitoring');
        onDepleted();
        return;
    }
    
    console.log('[Better Boosted Maps] Watching for stamina depletion...');
    
    // Watch for tooltip appearance (stamina depletes)
    const depletionCheckInterval = setInterval(() => {
        const currentCheck = hasInsufficientStamina();
        if (currentCheck.insufficient) {
            console.log('[Better Boosted Maps] Stamina depleted - starting recovery monitoring');
            clearInterval(depletionCheckInterval);
            onDepleted();
        }
    }, 5000); // Check every 5 seconds
    
    // Store for cleanup
    window.betterBoostedMapsDepletionInterval = depletionCheckInterval;
}

/**
 * Set up hybrid stamina monitoring (API polling + tooltip watching)
 * Uses tooltip as truth for recovery, API for progress tracking
 * @param {Function} onRecovered - Callback when stamina recovers
 * @param {number} requiredStamina - Stamina cost for this map
 */
function startStaminaTooltipMonitoring(onRecovered, requiredStamina) {
    // Clean up any existing monitoring
    if (staminaTooltipObserver) {
        stopStaminaTooltipMonitoring();
    }
    
    // Only start if stamina is actually insufficient
    const staminaCheck = hasInsufficientStamina();
    if (!staminaCheck.insufficient) {
        console.log('[Better Boosted Maps] Stamina sufficient - skipping recovery monitoring');
        return;
    }
    
    console.log('[Better Boosted Maps] Starting stamina recovery monitoring...');
    
    staminaRecoveryCallback = onRecovered;
    let hasStaminaIssue = true;
    
    // PRIMARY METHOD: Interval-based API checking for progress tracking (every 5 seconds)
    const staminaCheckInterval = setInterval(() => {
        const currentStamina = getCurrentStamina();
        const timeRemaining = Math.max(0, (requiredStamina || DEFAULT_STAMINA_COST) - currentStamina);
        console.log(`[Better Boosted Maps] Waiting for stamina (${currentStamina}/${requiredStamina || DEFAULT_STAMINA_COST}) - ~${timeRemaining} min remaining`);
        
        // Also check if tooltip disappeared (double-check)
        const tooltipStillExists = document.querySelector(
            '[role="tooltip"] img[alt="stamina"], [data-state="instant-open"] img[alt="stamina"]'
        );
        
        if (!tooltipStillExists && hasStaminaIssue) {
            console.log(`[Better Boosted Maps] ✅ STAMINA RECOVERED (tooltip gone) - current: ${currentStamina}`);
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
    }, 15000); // Check every 15 seconds (stamina regenerates 1 per minute)
    
    // Store interval for cleanup
    window.betterBoostedMapsStaminaInterval = staminaCheckInterval;
    
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
                        console.log(`[Better Boosted Maps] ✅ STAMINA RECOVERED (tooltip removed) - current: ${currentStamina}`);
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
    
    console.log('[Better Boosted Maps] Stamina monitoring active (tooltip watching + API progress)');
}

/**
 * Stop stamina tooltip monitoring
 */
function stopStaminaTooltipMonitoring() {
    // Clear interval-based API checking
    if (window.betterBoostedMapsStaminaInterval) {
        clearInterval(window.betterBoostedMapsStaminaInterval);
        window.betterBoostedMapsStaminaInterval = null;
    }
    
    // Clear depletion watching interval
    if (window.betterBoostedMapsDepletionInterval) {
        clearInterval(window.betterBoostedMapsDepletionInterval);
        window.betterBoostedMapsDepletionInterval = null;
    }
    
    // Disconnect MutationObserver
    if (staminaTooltipObserver) {
        staminaTooltipObserver.disconnect();
        staminaTooltipObserver = null;
        staminaRecoveryCallback = null;
    }
    
    console.log('[Better Boosted Maps] Stamina monitoring stopped');
}

/**
 * Check if user is still on correct boosted map
 * @returns {boolean} True if on correct map
 */
function isOnCorrectBoostedMap() {
    try {
        if (!modState.farming.currentMapInfo) {
            console.log('[Better Boosted Maps] No current map info stored');
            return false;
        }
        
        const boardContext = globalThis.state?.board?.getSnapshot()?.context;
        const currentRoomId = boardContext?.selectedMap?.selectedRoom?.id;
        
        if (!currentRoomId) {
            console.log('[Better Boosted Maps] Could not determine current room ID');
            return false;
        }
        
        const isCorrectMap = currentRoomId === modState.farming.currentMapInfo.roomId;
        console.log(`[Better Boosted Maps] Map validation: current=${currentRoomId}, expected=${modState.farming.currentMapInfo.roomId}, correct=${isCorrectMap}`);
        
        return isCorrectMap;
    } catch (error) {
        console.error('[Better Boosted Maps] Error checking map:', error);
        return false;
    }
}

// =======================
// 2. State Management
// =======================

const modState = {
    enabled: false,
    questLogObserver: null,
    activeModal: null,
    escKeyListener: null,
    modalInProgress: false,
    lastModalCall: 0,
    coordination: {
        raidHunterInterval: null,
        betterTaskerInterval: null,
        isRaidHunterActive: false,
        isBetterTaskerActive: false
    },
    farming: {
        isActive: false,
        currentMapInfo: null
    },
    dailySubscription: null,
    lastBoostedMap: null,
    staminaCache: {
        currentMapId: null,
        cost: null
    }
};

// =======================
// 3. Utility Functions
// =======================

// =======================
// 3.1. Better Setups Integration Functions
// =======================

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
        console.error('[Better Boosted Maps] Error checking Better Setups availability:', error);
        return false;
    }
}

/**
 * Get available setup options from Better Setups
 * @returns {Array} Array of available setup options
 */
function getAvailableSetupOptions() {
    const options = [t('mods.betterBoostedMaps.autoSetup')]; // Always include default with translation
    
    if (isBetterSetupsAvailable()) {
        try {
            const labels = JSON.parse(window.localStorage.getItem('stored-setup-labels') || '[]');
            if (Array.isArray(labels) && labels.length > 0) {
                options.push(...labels);
                console.log('[Better Boosted Maps] Better Setups labels found:', labels);
            }
        } catch (error) {
            console.error('[Better Boosted Maps] Error parsing Better Setups labels:', error);
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
    if (option === 'Auto-setup') {
        return findButtonByText('Auto-setup');
    }
    
    // Look for Better Setups buttons with patterns "Setup (LabelName)" or "Save (LabelName)"
    const buttons = Array.from(document.querySelectorAll('button'));
    const setupButton = buttons.find(button => {
        const text = button.textContent.trim();
        return text === `Setup (${option})` || text === `Save (${option})`;
    });
    
    if (setupButton) {
        console.log(`[Better Boosted Maps] Found Better Setups button: ${setupButton.textContent.trim()}`);
        
        // Check if this button has a saved setup
        if (hasSavedSetup(setupButton)) {
            console.log(`[Better Boosted Maps] Button has saved setup (green) - using it`);
            return setupButton;
        } else {
            console.log(`[Better Boosted Maps] Button has no saved setup (grey) - falling back to Auto-setup`);
            // Fallback to Auto-setup if the selected button has no saved setup
            const autoSetupButton = findButtonByText('Auto-setup');
            if (autoSetupButton) {
                console.log(`[Better Boosted Maps] Using Auto-setup as fallback`);
                return autoSetupButton;
            }
        }
    } else {
        console.log(`[Better Boosted Maps] Better Setups button not found for: ${option}`);
    }
    
    return null;
}

function createStyledButton(id, text, color, onClick) {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = text;
    button.className = `focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-${color} active:frame-pressed-1-${color} surface-${color} gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight`;
    button.style.cssText = `padding: 2px 6px; height: 20px;`;
    button.addEventListener('click', onClick);
    return button;
}

function createCustomStyledButton(id, text, className, style, onClick) {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = text;
    button.className = className;
    button.style.cssText = style;
    button.addEventListener('click', onClick);
    return button;
}

function clearModalsWithEsc(count = 1) {
    for (let i = 0; i < count; i++) {
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
}

function showToast(message, duration = 5000) {
    try {
        // Use custom toast implementation (same as Welcome.js)
        // Get or create the main toast container
        let mainContainer = document.getElementById('bbm-toast-container');
        if (!mainContainer) {
            mainContainer = document.createElement('div');
            mainContainer.id = 'bbm-toast-container';
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
        
        // Add icon (map icon for boosted maps)
        const iconImg = document.createElement('img');
        iconImg.alt = 'map';
        iconImg.src = 'https://bestiaryarena.com/assets/icons/map.png';
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
        
        console.log(`[Better Boosted Maps] Toast shown: ${message}`);
        
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
        console.error('[Better Boosted Maps] Error showing toast:', error);
    }
}

function createSelectAllNoneButtons(idPrefix, scrollContainer) {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        margin-top: 10px;
    `;
    
    const selectAllBtn = createCustomStyledButton(
        `select-all-${idPrefix}`,
        'Select All',
        `${ACTION_BUTTON_CLASSES} ${BUTTON_STYLES.GREEN}`,
        'flex: 1;',
        () => {
            const checkboxes = scrollContainer.querySelectorAll('input[type="checkbox"]:not(:disabled)');
            checkboxes.forEach(cb => cb.checked = true);
            saveSettings();
        }
    );
    
    const selectNoneBtn = createCustomStyledButton(
        `select-none-${idPrefix}`,
        'Select None',
        `${ACTION_BUTTON_CLASSES} ${BUTTON_STYLES.RED}`,
        'flex: 1;',
        () => {
            const checkboxes = scrollContainer.querySelectorAll('input[type="checkbox"]:not(:disabled)');
            checkboxes.forEach(cb => cb.checked = false);
            saveSettings();
        }
    );
    
    buttonContainer.appendChild(selectAllBtn);
    buttonContainer.appendChild(selectNoneBtn);
    
    return buttonContainer;
}

// =======================
// 3.1. Mod Coordination Functions
// =======================

// Check if raid automation is active
function isRaidHunterRaiding() {
    try {
        if (typeof window !== 'undefined') {
            // Check if raid automation is enabled
            const raidHunterEnabled = localStorage.getItem('raidHunterAutomationEnabled');
            if (raidHunterEnabled !== 'true') {
                return false;
            }
            
            // Check quest button control or internal raiding state
            const isRaidHunterCurrentlyRaiding = window.QuestButtonManager?.getCurrentOwner() === 'Raid Hunter' ||
                                                 (window.raidHunterIsCurrentlyRaiding && window.raidHunterIsCurrentlyRaiding());
            
            if (isRaidHunterCurrentlyRaiding) {
                console.log('[Better Boosted Maps] Raid Hunter is actively raiding - yielding priority');
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('[Better Boosted Maps] Error checking Raid Hunter status:', error);
        return false;
    }
}

// =======================
// 3.2. Boosted Map Detection Functions
// =======================

// Get current boosted map data from API
function getBoostedMapData() {
    try {
        const dailyContext = globalThis.state?.daily?.getSnapshot()?.context;
        if (!dailyContext || !dailyContext.boostedMap) {
            console.log('[Better Boosted Maps] No boosted map data available');
            return null;
        }
        
        const boostedMap = dailyContext.boostedMap;
        console.log('[Better Boosted Maps] Boosted map data:', boostedMap);
        
        return {
            roomId: boostedMap.roomId,
            equipId: boostedMap.equipId,
            equipStat: boostedMap.equipStat
        };
    } catch (error) {
        console.error('[Better Boosted Maps] Error getting boosted map data:', error);
        return null;
    }
}

// Get room name from room ID
function getRoomName(roomId) {
    try {
        const roomNames = globalThis.state?.utils?.ROOM_NAME || {};
        return roomNames[roomId] || roomId;
    } catch (error) {
        console.error('[Better Boosted Maps] Error getting room name:', error);
        return roomId;
    }
}

// Get equipment name from equipment ID
function getEquipmentName(equipId) {
    try {
        const equipment = globalThis.state?.utils?.getEquipment(equipId);
        return equipment?.metadata?.name || `Equipment ${equipId}`;
    } catch (error) {
        console.error('[Better Boosted Maps] Error getting equipment name:', error);
        return `Equipment ${equipId}`;
    }
}

// Check if boosted map should be farmed
function shouldFarmBoostedMap() {
    try {
        // Check if we can run (not blocked by other automation)
        if (!canRunBoostedMaps()) {
            return { shouldFarm: false, reason: 'Priority blocked by other mods' };
        }
        
        // Get boosted map data
        const boostedData = getBoostedMapData();
        if (!boostedData) {
            return { shouldFarm: false, reason: 'No boosted map data' };
        }
        
        // Get settings
        const settings = loadSettings();
        
        // Check if map is enabled
        const roomName = getRoomName(boostedData.roomId);
        const isMapEnabled = settings.maps?.[boostedData.roomId] !== false;
        
        if (!isMapEnabled) {
            console.log(`[Better Boosted Maps] Map "${roomName}" is not enabled`);
            return { shouldFarm: false, reason: `Map "${roomName}" not enabled` };
        }
        
        // Check if equipment is excluded
        const equipmentName = getEquipmentName(boostedData.equipId);
        if (EXCLUDED_EQUIPMENT.includes(equipmentName)) {
            console.log(`[Better Boosted Maps] Equipment "${equipmentName}" is excluded from boosted maps`);
            return { shouldFarm: false, reason: `Equipment "${equipmentName}" is excluded` };
        }
        
        // Check if equipment is enabled
        const equipId = equipmentName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const isEquipmentEnabled = settings.equipment?.[equipId] !== false;
        
        if (!isEquipmentEnabled) {
            console.log(`[Better Boosted Maps] Equipment "${equipmentName}" is not enabled`);
            return { shouldFarm: false, reason: `Equipment "${equipmentName}" not enabled` };
        }
        
        console.log(`[Better Boosted Maps] Should farm: ${roomName} with ${equipmentName}`);
        return { 
            shouldFarm: true, 
            roomId: boostedData.roomId,
            roomName: roomName,
            equipmentName: equipmentName,
            equipStat: boostedData.equipStat
        };
    } catch (error) {
        console.error('[Better Boosted Maps] Error checking if should farm boosted map:', error);
        return { shouldFarm: false, reason: 'Error checking conditions' };
    }
}

// Check if task automation is active
function isBetterTaskerTasking() {
    try {
        if (typeof window !== 'undefined') {
            // Check quest button control or active task operations
            const hasBetterTaskerQuestButtonControl = window.QuestButtonManager?.getCurrentOwner() === 'Better Tasker';
            
            // Also check exposed state flags
            const betterTaskerState = window.betterTaskerState;
            let hasActiveTaskOperations = false;
            
            if (betterTaskerState) {
                // Check if task automation is disabled
                if (betterTaskerState.taskerState === 'disabled') {
                    return false;
                }
                
                // Check operation flags (enabled state alone doesn't indicate activity)
                // Also check if Better Tasker has an active task (even if in cooldown)
                hasActiveTaskOperations = betterTaskerState.taskOperationInProgress || 
                                         betterTaskerState.taskHuntingOngoing || 
                                         betterTaskerState.pendingTaskCompletion ||
                                         betterTaskerState.hasActiveTask;
            }
            
            const isActivelyTasking = hasBetterTaskerQuestButtonControl || hasActiveTaskOperations;
            
            if (isActivelyTasking) {
                console.log('[Better Boosted Maps] Better Tasker is actively tasking - yielding priority');
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('[Better Boosted Maps] Error checking Better Tasker status:', error);
        return false;
    }
}

// Check if Better Boosted Maps can run (only if no raids or tasks)
function canRunBoostedMaps() {
    // Pause while Manual Runner is running to avoid conflicts
    if (window.__modCoordination?.manualRunnerRunning === true) {
        console.log('[Better Boosted Maps] Manual Runner running - skipping boosted maps');
        return false;
    }
    // Board Analyzer always blocks (highest priority system task)
    if (window.__modCoordination?.boardAnalyzerRunning === true) {
        console.log('[Better Boosted Maps] Board Analyzer running - skipping boosted maps');
        return false;
    }
    if (!modState.enabled) {
        return false;
    }
    
    // Priority check: check status directly to avoid race conditions
    if (isRaidHunterRaiding()) {
        console.log('[Better Boosted Maps] Cannot run - Raid Hunter is actively raiding');
        return false;
    }
    
    if (isBetterTaskerTasking()) {
        console.log('[Better Boosted Maps] Cannot run - Better Tasker is actively tasking');
        return false;
    }
    
    return true;
}

// Generic mod coordination setup
function setupModCoordination(modName, intervalKey, stateKey, checkFunction) {
    if (modState.coordination[intervalKey]) {
        clearInterval(modState.coordination[intervalKey]);
    }
    
    // Check initial state immediately
    modState.coordination[stateKey] = checkFunction();
    if (modState.coordination[stateKey]) {
        console.log(`[Better Boosted Maps] ${modName} already active at startup - will not start boosted maps`);
        updateExposedState();
    }
    
    // Check status every 10 seconds
    modState.coordination[intervalKey] = setInterval(() => {
        const wasActive = modState.coordination[stateKey];
        modState.coordination[stateKey] = checkFunction();
        
        // Log state changes (coordination happens silently)
        if (modState.coordination[stateKey] && !wasActive) {
            console.log(`[Better Boosted Maps] ${modName} started - pausing boosted map automation`);
            updateExposedState();
        } else if (!modState.coordination[stateKey] && wasActive) {
            console.log(`[Better Boosted Maps] ${modName} stopped - checking if boosted maps can resume`);
            updateExposedState();
        }
    }, 10000);
    
    console.log(`[Better Boosted Maps] ${modName} coordination set up`);
}

// Setup raid coordination monitoring
function setupRaidHunterCoordination() {
    setupModCoordination('Raid Hunter', 'raidHunterInterval', 'isRaidHunterActive', isRaidHunterRaiding);
}

// Setup task coordination monitoring
function setupBetterTaskerCoordination() {
    setupModCoordination('Better Tasker', 'betterTaskerInterval', 'isBetterTaskerActive', isBetterTaskerTasking);
}

// Cleanup coordination intervals
function cleanupCoordination() {
    if (modState.coordination.raidHunterInterval) {
        clearInterval(modState.coordination.raidHunterInterval);
        modState.coordination.raidHunterInterval = null;
    }
    
    if (modState.coordination.betterTaskerInterval) {
        clearInterval(modState.coordination.betterTaskerInterval);
        modState.coordination.betterTaskerInterval = null;
    }
    
    modState.coordination.isRaidHunterActive = false;
    modState.coordination.isBetterTaskerActive = false;
    
    console.log('[Better Boosted Maps] Coordination cleanup completed');
}

// =======================
// 3.3. Daily State Monitoring
// =======================

function setupDailyStateMonitoring() {
    // Unsubscribe if already monitoring
    if (modState.dailySubscription) {
        modState.dailySubscription.unsubscribe();
    }
    
    // Store initial boosted map
    const initialData = getBoostedMapData();
    if (initialData) {
        modState.lastBoostedMap = {
            roomId: initialData.roomId,
            equipId: initialData.equipId,
            equipStat: initialData.equipStat
        };
        console.log('[Better Boosted Maps] Initial boosted map tracked:', modState.lastBoostedMap);
    }
    
    // Subscribe to daily state changes
    modState.dailySubscription = globalThis.state.daily.subscribe((dailyState) => {
        const newBoostedMap = dailyState.context?.boostedMap;
        
        if (!newBoostedMap) return;
        
        // Check if boosted map changed
        const hasChanged = !modState.lastBoostedMap || 
            modState.lastBoostedMap.roomId !== newBoostedMap.roomId ||
            modState.lastBoostedMap.equipId !== newBoostedMap.equipId ||
            modState.lastBoostedMap.equipStat !== newBoostedMap.equipStat;
        
        if (hasChanged) {
            console.log('[Better Boosted Maps] Boosted map changed!');
            console.log('  Old:', modState.lastBoostedMap);
            console.log('  New:', newBoostedMap);
            
            // Update tracked map
            modState.lastBoostedMap = {
                roomId: newBoostedMap.roomId,
                equipId: newBoostedMap.equipId,
                equipStat: newBoostedMap.equipStat
            };
            
            // If mod is enabled, handle the change
            if (modState.enabled) {
                handleBoostedMapChange();
            }
        }
    });
    
    console.log('[Better Boosted Maps] Daily state monitoring enabled');
}

function handleBoostedMapChange() {
    console.log('[Better Boosted Maps] Handling boosted map change...');
    
    // Clear stamina cache (new map will have different cost)
    modState.staminaCache.currentMapId = null;
    modState.staminaCache.cost = null;
    console.log('[Better Boosted Maps] Stamina cache cleared');
    
    // Stop current farming if active
    if (modState.farming.isActive) {
        console.log('[Better Boosted Maps] Stopping current farming session');
        cancelBoostedMapFarming('Boosted map changed');
    }
    
    // Wait a bit for game state to stabilize, then check new map
    setTimeout(() => {
        checkAndStartBoostedMapFarming();
    }, 3000);
}

// =======================
// 4. DOM Functions
// =======================

function isInQuestLog(element) {
    // Check if we're inside a Quest Log widget
    const questLogTexts = ['Quest Log', 'Diário de Missões'];
    let current = element;
    while (current && current !== document.body) {
        // Look for the widget header with "Quest Log" text
        const widgetTop = current.querySelector?.('.widget-top-text p');
        if (widgetTop && questLogTexts.includes(widgetTop.textContent)) {
            return true;
        }
        // Also check if current element is the widget top
        if (current.classList?.contains('widget-top-text')) {
            const p = current.querySelector('p');
            if (p && questLogTexts.includes(p.textContent)) {
                return true;
            }
        }
        current = current.parentElement;
    }
    return false;
}

function findBoostedMapSection() {
    const allSections = document.querySelectorAll('.frame-1.surface-regular');
    const boostedMapTexts = ['Daily boosted map', 'Mapa boostado diário'];
    
    for (const section of allSections) {
        const titleElement = section.querySelector('p.text-whiteHighlight');
        if (titleElement && boostedMapTexts.includes(titleElement.textContent)) {
            // Only return if we're in the Quest Log
            if (isInQuestLog(section)) {
                return section;
            }
        }
    }
    return null;
}

function insertButtons() {
    if (document.getElementById(TOGGLE_BUTTON_ID) && document.getElementById(SETTINGS_BUTTON_ID)) {
        console.log('[Better Boosted Maps] Buttons already exist');
        return true;
    }
    
    const boostedMapSection = findBoostedMapSection();
    if (!boostedMapSection) {
        console.log('[Better Boosted Maps] Daily boosted map section not found');
        return false;
    }
    
    console.log('[Better Boosted Maps] Found Daily boosted map section, inserting buttons');
    
    const titleElement = boostedMapSection.querySelector('p.text-whiteHighlight');
    const boostedMapTexts = ['Daily boosted map', 'Mapa boostado diário'];
    if (titleElement && boostedMapTexts.includes(titleElement.textContent)) {
        const titleContainer = titleElement.parentElement;
        
        if (titleContainer) {
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `display: flex; gap: 4px; margin-top: 4px;`;
            
            const toggleButton = createStyledButton(TOGGLE_BUTTON_ID, t('mods.betterBoostedMaps.enabled'), 'red', toggleBoostedMaps);
            buttonContainer.appendChild(toggleButton);
            
            const settingsButton = createStyledButton(SETTINGS_BUTTON_ID, t('mods.betterBoostedMaps.settingsButton'), 'blue', openSettingsModal);
            buttonContainer.appendChild(settingsButton);
            
            // Find the timer element (has clock icon and time)
            const timerElement = titleContainer.querySelector('p.pixel-font-14.text-right');
            
            // Insert before timer if found, otherwise append to titleContainer
            if (timerElement) {
                titleContainer.insertBefore(buttonContainer, timerElement);
            } else {
                titleContainer.appendChild(buttonContainer);
            }
            
            updateToggleButton();
            
            console.log('[Better Boosted Maps] Buttons inserted successfully');
            return true;
        }
    }
    
    return false;
}

// =======================
// 5. Toggle Functionality
// =======================

function toggleBoostedMaps() {
    modState.enabled = !modState.enabled;
    updateToggleButton();
    saveBoostedMapsState();
    
    if (modState.enabled) {
        console.log('[Better Boosted Maps] Enabled - setting up mod coordination');
        setupRaidHunterCoordination();
        setupBetterTaskerCoordination();
        setupDailyStateMonitoring();
        
        // Check and start boosted map farming after delay
        setTimeout(() => {
            checkAndStartBoostedMapFarming();
        }, 3000); // 3 second delay
    } else {
        console.log('[Better Boosted Maps] Disabled - cleaning up coordination');
        cleanupCoordination();
        
        // Cleanup daily subscription
        if (modState.dailySubscription) {
            modState.dailySubscription.unsubscribe();
            modState.dailySubscription = null;
        }
        
        // Stop stamina tooltip monitoring
        stopStaminaTooltipMonitoring();
        
        // Reset farming state
        modState.farming.isActive = false;
        modState.farming.currentMapInfo = null;
    }
    
    // Update exposed state after toggle
    updateExposedState();
    
    console.log('[Better Boosted Maps] Toggled to:', modState.enabled);
}

function updateToggleButton() {
    const toggleButton = document.querySelector(`#${TOGGLE_BUTTON_ID}`);
    if (!toggleButton) return;
    
    if (modState.enabled) {
        toggleButton.textContent = t('mods.betterBoostedMaps.enabled');
        toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
    } else {
        toggleButton.textContent = 'Disabled'; // Not in translations yet, keeping as-is
        toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-red active:frame-pressed-1-red surface-red gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
    }
}

// =======================
// 6. Settings & Storage
// =======================

const MODAL_WIDTH = 700;
const MODAL_HEIGHT = 400;

function loadBoostedMapsState() {
    const saved = localStorage.getItem('betterBoostedMapsEnabled');
    if (saved !== null) {
        try {
            modState.enabled = JSON.parse(saved);
            console.log('[Better Boosted Maps] Loaded state:', modState.enabled);
        } catch (error) {
            console.error('[Better Boosted Maps] Error parsing state:', error);
            modState.enabled = false;
        }
    }
}

function saveBoostedMapsState() {
    localStorage.setItem('betterBoostedMapsEnabled', JSON.stringify(modState.enabled));
}

function loadSettings() {
    const defaultSettings = {
        autoNavigate: true,  // Default ON
        autoSetup: true,     // Default ON
        autoRefillStamina: false,
        fasterAutoplay: false,
        enableAutoplant: false,
        startDelay: DEFAULT_START_DELAY,  // Use standardized default
        setupMethod: 'Auto-setup',  // Default to Auto-setup (translation applied at display time)
        showNotification: true,
        maps: {},
        equipment: {},
        mapFloors: {}
    };
    
    const saved = localStorage.getItem('betterBoostedMapsSettings');
    if (saved) {
        try {
            return { ...defaultSettings, ...JSON.parse(saved) };
        } catch (error) {
            console.error('[Better Boosted Maps] Error parsing settings:', error);
        }
    }
    return defaultSettings;
}

function saveSettings() {
    const settings = {
        maps: {},
        equipment: {},
        mapFloors: {}
    };
    
    const inputs = document.querySelectorAll('input[id^="boosted-maps-"], select[id^="boosted-maps-"], select[id^="floor-"]');
    
    inputs.forEach(input => {
        if (input.type === 'checkbox') {
            const id = input.id.replace('boosted-maps-', '');
            
            if (id.startsWith('map-')) {
                settings.maps[id.replace('map-', '')] = input.checked;
            } else if (id.startsWith('equipment-')) {
                settings.equipment[id.replace('equipment-', '')] = input.checked;
            } else {
                settings[id] = input.checked;
            }
        } else if (input.type === 'number') {
            const id = input.id.replace('boosted-maps-', '');
            settings[id] = parseInt(input.value) || 3;
        } else if (input.tagName === 'SELECT') {
            if (input.id.startsWith('floor-')) {
                const mapId = input.getAttribute('data-map-id');
                if (mapId) {
                    const floorValue = parseInt(input.value);
                    if (!isNaN(floorValue) && floorValue >= 0 && floorValue <= 15) {
                        settings.mapFloors[mapId] = floorValue;
                    }
                }
            } else {
                const id = input.id.replace('boosted-maps-', '');
                settings[id] = input.value;
            }
        }
    });
    
    localStorage.setItem('betterBoostedMapsSettings', JSON.stringify(settings));
    console.log('[Better Boosted Maps] Settings saved');
}

// Apply saved floor settings to floor dropdowns in the modal
function applyFloorSettings() {
    try {
        const settings = loadSettings();
        
        // Apply floor dropdown values for all maps
        if (settings.mapFloors && typeof settings.mapFloors === 'object') {
            document.querySelectorAll('select[id^="floor-"]').forEach(select => {
                const mapId = select.getAttribute('data-map-id');
                if (mapId && settings.mapFloors[mapId] !== undefined) {
                    const floorValue = settings.mapFloors[mapId];
                    if (floorValue >= 0 && floorValue <= 15) {
                        select.value = floorValue.toString();
                    }
                }
            });
        }
    } catch (error) {
        console.error('[Better Boosted Maps] Error applying floor settings:', error);
    }
}

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
    
    // Left column - Automation Settings
    const leftColumn = document.createElement('div');
    leftColumn.style.cssText = `
        width: 200px;
        min-width: 200px;
        max-width: 200px;
        display: flex;
        flex-direction: column;
        border-right: 1px solid #444;
        overflow-y: auto;
        min-height: 0;
        padding: 0;
        margin: 0;
        background: rgba(0, 0, 0, 0.2);
    `;
    
    // Right column - Additional Settings
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
    
    const settings = loadSettings();
    
    // Left column content - Boosted Map Settings
    const leftContent = createBoostedMapSettings(settings);
    leftColumn.appendChild(leftContent);
    
    // Right column content - Map & Equipment Selection
    const rightContent = createSelectionSettings(settings);
    rightColumn.appendChild(rightContent);
    
    mainContainer.appendChild(leftColumn);
    mainContainer.appendChild(rightColumn);
    
    return mainContainer;
}

function createBoostedMapSettings(settings) {
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
    title.textContent = t('mods.betterBoostedMaps.boostedMapSettings');
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0 0 10px 0;
        color: #ffe066;
        font-weight: bold;
        text-align: center;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    container.appendChild(title);
    
    const settingsWrapper = document.createElement('div');
    settingsWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 20px;
        flex: 1;
        justify-content: center;
    `;
    
    // Start delay setting
    const startDelayDiv = createNumberSetting(
        'boosted-maps-startDelay',
        t('mods.betterBoostedMaps.startDelay'),
        '',
        settings.startDelay,
        1, MAX_START_DELAY
    );
    settingsWrapper.appendChild(startDelayDiv);
    
    // Setup method selection
    const setupMethodDiv = createDropdownSetting(
        'boosted-maps-setupMethod',
        'Setup Method', // Not in translations yet, keeping as-is
        '',
        settings.setupMethod || t('mods.betterBoostedMaps.autoSetup'),
        getAvailableSetupOptions()
    );
    settingsWrapper.appendChild(setupMethodDiv);
    
    // Auto-refill stamina setting
    const autoRefillStaminaDiv = createCheckboxSetting(
        'boosted-maps-autoRefillStamina',
        t('mods.betterBoostedMaps.autoRefillStamina'),
        '',
        settings.autoRefillStamina
    );
    settingsWrapper.appendChild(autoRefillStaminaDiv);
    
    // Faster autoplay setting
    const fasterAutoplayDiv = createCheckboxSetting(
        'boosted-maps-fasterAutoplay',
        t('mods.betterBoostedMaps.fasterAutoplay'),
        '',
        settings.fasterAutoplay
    );
    settingsWrapper.appendChild(fasterAutoplayDiv);
    
    // Enable autoplant setting
    const enableAutoplantDiv = createCheckboxSetting(
        'boosted-maps-enableAutoplant',
        t('mods.betterBoostedMaps.enableAutoplant'),
        '',
        settings.enableAutoplant
    );
    settingsWrapper.appendChild(enableAutoplantDiv);
    
    container.appendChild(settingsWrapper);
    
    return container;
}

function createSelectionSettings(settings) {
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
    
    // Map & Equipment Selection Settings
    const selectionSection = createMapEquipmentSelection(settings);
    container.appendChild(selectionSection);
    
    return container;
}

function createMapEquipmentSelection(settings) {
    const container = document.createElement('div');
    container.style.cssText = `
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        padding: 10px;
        box-sizing: border-box;
        gap: 10px;
        min-height: 0;
    `;
    
    // Tab buttons
    const tabButtons = document.createElement('div');
    tabButtons.style.cssText = `
        display: flex;
        gap: 4px;
        margin-bottom: 5px;
    `;
    
    const mapsTabBtn = createStyledButton('maps-tab-btn', 'Maps', 'green', () => switchTab('maps'));
    const equipmentTabBtn = createStyledButton('equipment-tab-btn', 'Equipment', 'regular', () => switchTab('equipment'));
    
    tabButtons.appendChild(mapsTabBtn);
    tabButtons.appendChild(equipmentTabBtn);
    container.appendChild(tabButtons);
    
    // Tab content container
    const tabContent = document.createElement('div');
    tabContent.id = 'tab-content';
    tabContent.style.cssText = `
        flex: 1;
        overflow-y: auto;
        border: 1px solid #444;
        border-radius: 5px;
        background: rgba(0, 0, 0, 0.2);
        padding: 10px;
    `;
    
    // Create maps tab content
    const mapsContent = createMapsTab(settings);
    mapsContent.id = 'maps-tab';
    mapsContent.style.display = 'block';
    
    // Create equipment tab content
    const equipmentContent = createEquipmentTab(settings);
    equipmentContent.id = 'equipment-tab';
    equipmentContent.style.display = 'none';
    
    tabContent.appendChild(mapsContent);
    tabContent.appendChild(equipmentContent);
    container.appendChild(tabContent);
    
    // Store for tab switching
    window.boostedMapsActiveTab = 'maps';
    
    return container;
}

function switchTab(tabName) {
    window.boostedMapsActiveTab = tabName;
    
    // Update tab buttons
    const mapsBtn = document.getElementById('maps-tab-btn');
    const equipmentBtn = document.getElementById('equipment-tab-btn');
    
    if (tabName === 'maps') {
        mapsBtn.className = `${TAB_BUTTON_CLASSES} ${BUTTON_STYLES.GREEN}`;
        equipmentBtn.className = `${TAB_BUTTON_CLASSES} ${BUTTON_STYLES.REGULAR}`;
        document.getElementById('maps-tab').style.display = 'block';
        document.getElementById('equipment-tab').style.display = 'none';
    } else {
        mapsBtn.className = `${TAB_BUTTON_CLASSES} ${BUTTON_STYLES.REGULAR}`;
        equipmentBtn.className = `${TAB_BUTTON_CLASSES} ${BUTTON_STYLES.GREEN}`;
        document.getElementById('maps-tab').style.display = 'none';
        document.getElementById('equipment-tab').style.display = 'block';
    }
}

function createMapsTab(settings) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        height: 100%;
    `;
    
    const title = document.createElement('h3');
    title.textContent = t('mods.betterBoostedMaps.selectMaps');
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0 0 10px 0;
        color: #ffe066;
        font-weight: bold;
    `;
    wrapper.appendChild(title);
    
    // Scrollable container for maps
    const scrollContainer = document.createElement('div');
    scrollContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        max-height: 250px;
        overflow-y: auto;
        border: 1px solid #555;
        border-radius: 3px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.3);
    `;
    
    // Get all maps organized by region
    const organizedMaps = organizeMapsByRegion();
    
    if (Object.keys(organizedMaps).length === 0) {
        const noMaps = document.createElement('div');
        noMaps.textContent = t('mods.betterBoostedMaps.noMapsAvailable');
        noMaps.className = 'pixel-font-14';
        noMaps.style.color = '#888';
        scrollContainer.appendChild(noMaps);
    } else {
        // Display maps grouped by region
        Object.entries(organizedMaps).forEach(([regionName, maps]) => {
            // Region header
            const regionHeader = document.createElement('div');
            regionHeader.textContent = regionName;
            regionHeader.className = 'pixel-font-16';
            regionHeader.style.cssText = `
                color: #ffe066;
                font-weight: bold;
                margin-top: 8px;
                margin-bottom: 4px;
                padding-bottom: 4px;
                border-bottom: 1px solid #555;
            `;
            scrollContainer.appendChild(regionHeader);
            
            // Maps in this region
            maps.forEach(({ id, name, isRaid }) => {
                const isDisabled = MAPS_WITHOUT_BOOSTED_EQUIPMENT.includes(name) || isRaid;
                const mapDiv = createCheckboxSetting(
                    `boosted-maps-map-${id}`,
                    name,
                    '',
                    settings.maps?.[id] !== false,
                    '14px',
                    isDisabled
                );
                
                // Add floor dropdown only for selectable maps
                if (!isDisabled) {
                    const floorSelect = document.createElement('select');
                    floorSelect.id = `floor-${id}`;
                    floorSelect.className = 'pixel-font-16';
                    floorSelect.setAttribute('data-map-id', id);
                    floorSelect.style.cssText = `
                        font-size: 10px;
                        padding: 2px 18px 2px 6px;
                        border-radius: 3px;
                        font-weight: bold;
                        cursor: pointer;
                        outline: none;
                        appearance: none;
                        -webkit-appearance: none;
                        -moz-appearance: none;
                        min-width: 60px;
                        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23ffffff' d='M1 0l4 4 4-4 1 1-5 5-5-5z'/%3E%3C/svg%3E");
                        background-repeat: no-repeat;
                        background-position: right 6px center;
                        background-color: rgba(255, 211, 61, 0.2);
                        color: rgb(255, 217, 61);
                        border: 1px solid rgb(255, 217, 61);
                        margin-left: auto;
                    `;
                    // Create options for floors 0-15
                    for (let i = 0; i <= 15; i++) {
                        const opt = document.createElement('option');
                        opt.value = i.toString();
                        opt.textContent = `${t('mods.betterBoostedMaps.floor')} ${i}`;
                        floorSelect.appendChild(opt);
                    }
                    // Set initial value from settings (default: 0)
                    const mapFloors = settings.mapFloors || {};
                    floorSelect.value = (mapFloors[id] !== undefined ? mapFloors[id] : 0).toString();
                    floorSelect.addEventListener('change', () => {
                        saveSettings();
                    });
                    
                    // Add floor dropdown to the checkbox container
                    const checkboxContainer = mapDiv.querySelector('div[style*="display: flex"]');
                    if (checkboxContainer) {
                        checkboxContainer.appendChild(floorSelect);
                    } else {
                        mapDiv.appendChild(floorSelect);
                    }
                }
                
                scrollContainer.appendChild(mapDiv);
            });
        });
    }
    
    wrapper.appendChild(scrollContainer);
    
    // Add select all/none buttons
    const buttonContainer = createSelectAllNoneButtons('maps', scrollContainer);
    wrapper.appendChild(buttonContainer);
    
    return wrapper;
}

function getRealRegionName(region) {
    if (!region) return 'Unknown Region';
    
    if (region.name) {
        return region.name;
    }
    
    const regionId = region.id ? region.id.toLowerCase() : '';
    if (REGION_NAME_MAP[regionId]) {
        return REGION_NAME_MAP[regionId];
    }
    
    return region.id ? (REGION_NAME_MAP[region.id.toLowerCase()] || region.id.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())) : 'Unknown Region';
}

function organizeMapsByRegion() {
    const roomNames = globalThis.state?.utils?.ROOM_NAME || {};
    const regions = globalThis.state?.utils?.REGIONS || [];
    const roomsData = globalThis.state?.utils?.ROOMS || {};
    
    if (!regions || regions.length === 0) {
        // No region data - return all maps unsorted (mark raids)
        return {
            'All Maps': Object.entries(roomNames)
                .map(([id, name]) => ({ 
                    id, 
                    name,
                    isRaid: window.mapsDatabase?.isRaid(id) || false
                }))
                .sort((a, b) => a.name.localeCompare(b.name))
        };
    }
    
    const organizedMaps = {};
    
    // Organize maps by region
    regions.forEach(region => {
        if (!region.rooms || !Array.isArray(region.rooms)) return;
        
        const regionMaps = [];
        
        region.rooms.forEach(room => {
            const roomCode = room.id;
            // Include all maps, mark raids as disabled
            if (roomNames[roomCode]) {
                regionMaps.push({
                    id: roomCode,
                    name: roomNames[roomCode],
                    isRaid: window.mapsDatabase?.isRaid(roomCode) || false
                });
            }
        });
        
        if (regionMaps.length > 0) {
            const regionName = getRealRegionName(region);
            organizedMaps[regionName] = regionMaps;
        }
    });
    
    // Add any remaining maps not in a region
    const processedRoomCodes = new Set();
    Object.values(organizedMaps).forEach(regionMaps => {
        regionMaps.forEach(map => processedRoomCodes.add(map.id));
    });
    
    const remainingMaps = Object.entries(roomNames)
        .filter(([id]) => !processedRoomCodes.has(id))
        .map(([id, name]) => ({ 
            id, 
            name,
            isRaid: window.mapsDatabase?.isRaid(id) || false
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    
    if (remainingMaps.length > 0) {
        organizedMaps['Other Maps'] = remainingMaps;
    }
    
    return organizedMaps;
}

function createEquipmentTab(settings) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        height: 100%;
    `;
    
    const title = document.createElement('h3');
    title.textContent = t('mods.betterBoostedMaps.selectEquipment');
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0 0 10px 0;
        color: #ffe066;
        font-weight: bold;
    `;
    wrapper.appendChild(title);
    
    // Scrollable container for equipment
    const scrollContainer = document.createElement('div');
    scrollContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        max-height: 250px;
        overflow-y: auto;
        border: 1px solid #555;
        border-radius: 3px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.3);
    `;
    
    const allEquipment = window.equipmentDatabase?.ALL_EQUIPMENT || [];
    
    if (allEquipment.length === 0) {
        const noEquipment = document.createElement('div');
        noEquipment.textContent = t('mods.betterBoostedMaps.noEquipmentAvailable');
        noEquipment.className = 'pixel-font-14';
        noEquipment.style.color = '#888';
        scrollContainer.appendChild(noEquipment);
    } else {
        allEquipment.forEach(equipName => {
            const equipId = equipName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const isExcluded = EXCLUDED_EQUIPMENT.includes(equipName);
            const equipDiv = createCheckboxSetting(
                `boosted-maps-equipment-${equipId}`,
                equipName,
                '',
                settings.equipment?.[equipId] !== false,
                '14px',
                isExcluded
            );
            scrollContainer.appendChild(equipDiv);
        });
    }
    
    wrapper.appendChild(scrollContainer);
    
    // Add select all/none buttons
    const buttonContainer = createSelectAllNoneButtons('equipment', scrollContainer);
    wrapper.appendChild(buttonContainer);
    
    return wrapper;
}

function createCheckboxSetting(id, label, description, checked = false, fontSize = null, disabled = false) {
    const settingDiv = document.createElement('div');
    settingDiv.style.cssText = `
        margin-bottom: 0px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        ${disabled ? 'opacity: 0.4;' : ''}
    `;
    
    const checkboxContainer = document.createElement('div');
    checkboxContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
    `;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = disabled ? false : checked;
    checkbox.disabled = disabled;
    checkbox.style.cssText = `
        width: 16px;
        height: 16px;
        accent-color: #ffe066;
        cursor: ${disabled ? 'not-allowed' : 'pointer'};
    `;
    if (!disabled) {
        checkbox.addEventListener('change', saveSettings);
    }
    
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.className = 'pixel-font-16';
    labelElement.setAttribute('for', id);
    labelElement.style.cssText = `
        font-weight: bold;
        color: ${disabled ? '#666' : '#fff'};
        cursor: ${disabled ? 'not-allowed' : 'pointer'};
        ${fontSize ? `font-size: ${fontSize};` : ''}
    `;
    
    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(labelElement);
    settingDiv.appendChild(checkboxContainer);
    
    const descElement = document.createElement('div');
    descElement.textContent = description;
    descElement.className = 'pixel-font-16';
    descElement.style.cssText = `
        font-size: 11px;
        color: #888;
        font-style: italic;
        margin-top: 2px;
    `;
    settingDiv.appendChild(descElement);
    
    return settingDiv;
}

function createNumberSetting(id, label, description, value = 3, min = 1, max = 30) {
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
        color: #fff;
        margin-bottom: 4px;
    `;
    settingDiv.appendChild(labelElement);
    
    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.id = id;
    numberInput.value = value;
    numberInput.min = min;
    numberInput.max = max;
    numberInput.className = 'pixel-font-16';
    numberInput.style.cssText = `
        width: 100%;
        padding: 6px;
        background: #333;
        border: 1px solid #ffe066;
        color: #fff;
        border-radius: 3px;
        box-sizing: border-box;
        font-size: 14px;
    `;
    numberInput.addEventListener('input', saveSettings);
    settingDiv.appendChild(numberInput);
    
    const descElement = document.createElement('div');
    descElement.textContent = description;
    descElement.className = 'pixel-font-16';
    descElement.style.cssText = `
        font-size: 11px;
        color: #888;
        font-style: italic;
        margin-top: 2px;
    `;
    settingDiv.appendChild(descElement);
    
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
        color: #fff;
        margin-bottom: 4px;
    `;
    settingDiv.appendChild(labelElement);
    
    const selectElement = document.createElement('select');
    selectElement.id = id;
    selectElement.className = 'pixel-font-16';
    selectElement.style.cssText = `
        width: 100%;
        padding: 6px;
        background: #333;
        border: 1px solid #ffe066;
        color: #fff;
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
            background: #333;
            color: #fff;
        `;
        selectElement.appendChild(optionElement);
    });
    
    // Set initial value
    selectElement.value = value;
    selectElement.addEventListener('change', saveSettings);
    settingDiv.appendChild(selectElement);
    
    const descElement = document.createElement('div');
    descElement.textContent = description;
    descElement.className = 'pixel-font-16';
    descElement.style.cssText = `
        font-size: 11px;
        color: #888;
        font-style: italic;
        margin-top: 2px;
    `;
    settingDiv.appendChild(descElement);
    
    return settingDiv;
}

function cleanupModal() {
    if (modState.activeModal) {
        modState.activeModal = null;
    }
    
    if (modState.escKeyListener) {
        document.removeEventListener('keydown', modState.escKeyListener);
        modState.escKeyListener = null;
    }
}

function openSettingsModal() {
    try {
        const now = Date.now();
        if (modState.modalInProgress) return;
        if (now - modState.lastModalCall < 1000) return;
        
        modState.lastModalCall = now;
        modState.modalInProgress = true;
        
        (() => {
            try {
                if (!modState.modalInProgress) return;
                
                // Simulate ESC key to remove scroll lock
                clearModalsWithEsc(1);
                
                // Small delay to ensure scroll lock is removed
                setTimeout(() => {
                    if (typeof context !== 'undefined' && context.api && context.api.ui) {
                        try {
                            const settingsContent = createSettingsContent();
                            
                            modState.activeModal = context.api.ui.components.createModal({
                                title: t('mods.betterBoostedMaps.modalTitle'),
                                width: MODAL_WIDTH,
                                height: MODAL_HEIGHT,
                                content: settingsContent,
                                buttons: [{ text: t('mods.betterBoostedMaps.closeButton'), primary: true }],
                                onClose: () => {
                                    console.log('[Better Boosted Maps] Settings modal closed');
                                    cleanupModal();
                                }
                            });
                            
                            // Add ESC key support
                            modState.escKeyListener = (event) => {
                                if (event.key === 'Escape' && modState.activeModal) {
                                    console.log('[Better Boosted Maps] ESC key pressed, closing modal');
                                    cleanupModal();
                                }
                            };
                            document.addEventListener('keydown', modState.escKeyListener);
                            
                            // Set modal dimensions and apply settings
                            setTimeout(() => {
                                const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
                                if (dialog) {
                                    dialog.style.width = MODAL_WIDTH + 'px';
                                    dialog.style.minWidth = MODAL_WIDTH + 'px';
                                    dialog.style.maxWidth = MODAL_WIDTH + 'px';
                                    dialog.style.height = MODAL_HEIGHT + 'px';
                                    dialog.style.minHeight = MODAL_HEIGHT + 'px';
                                    dialog.style.maxHeight = MODAL_HEIGHT + 'px';
                                    
                                    const contentElem = dialog.querySelector('.modal-content, [data-content], .content, .modal-body');
                                    if (contentElem) {
                                        contentElem.style.width = '700px';
                                        contentElem.style.height = '400px';
                                        contentElem.style.display = 'flex';
                                        contentElem.style.flexDirection = 'column';
                                    }
                                    
                                    // Apply saved floor settings
                                    applyFloorSettings();
                                }
                            }, 50);
                            
                            // Inject auto-save indicator into modal footer
                            setTimeout(() => {
                                const modalElement = document.querySelector('div[role="dialog"][data-state="open"]');
                                if (modalElement) {
                                    const footer = modalElement.querySelector('.flex.justify-end.gap-2');
                                    if (footer) {
                                        const autoSaveIndicator = document.createElement('div');
                                        autoSaveIndicator.textContent = t('mods.betterBoostedMaps.settingsAutoSave');
                                        autoSaveIndicator.className = 'pixel-font-16';
                                        autoSaveIndicator.style.cssText = `
                                            font-size: 11px;
                                            color: #4ade80;
                                            font-style: italic;
                                            margin-right: auto;
                                        `;
                                        
                                        footer.style.cssText = `
                                            display: flex;
                                            justify-content: space-between;
                                            align-items: center;
                                            gap: 2px;
                                        `;
                                        
                                        footer.insertBefore(autoSaveIndicator, footer.firstChild);
                                    }
                                }
                            }, 100);
                        } catch (error) {
                            console.error('[Better Boosted Maps] Error creating modal:', error);
                        } finally {
                            modState.modalInProgress = false;
                        }
                    } else {
                        console.warn('[Better Boosted Maps] API not available for modal creation');
                        modState.modalInProgress = false;
                    }
                }, 100);
            } catch (error) {
                console.error('[Better Boosted Maps] Error in modal creation wrapper:', error);
                modState.modalInProgress = false;
            }
        })();
        
    } catch (error) {
        console.error('[Better Boosted Maps] Error in openSettingsModal:', error);
        modState.modalInProgress = false;
    }
}

// =======================
// 7. Boosted Map Automation
// =======================

// Helper to find button by text
function findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll('button'));
    const textMappings = {
        'Auto-setup': [t('mods.betterBoostedMaps.autoSetup'), 'Auto-setup'],
        'Start': [t('mods.betterBoostedMaps.start'), 'Start'],
        'Close': [t('mods.betterBoostedMaps.closeButton'), 'Close']
    };
    const possibleTexts = textMappings[text] || [text];
    return buttons.find(button => possibleTexts.includes(button.textContent.trim()));
}

// Cancel boosted map farming
function cancelBoostedMapFarming(reason = 'unknown') {
    console.log(`[Better Boosted Maps] Cancelling farming: ${reason}`);
    modState.farming.isActive = false;
    modState.farming.currentMapInfo = null;
    
    // Stop stamina tooltip monitoring
    stopStaminaTooltipMonitoring();
}

// Helper: Check automation enabled and cancel if not
function checkAutomationEnabled(stage) {
    if (!modState.enabled) {
        cancelBoostedMapFarming(`automation disabled ${stage}`);
        return false;
    }
    return true;
}

// Start farming boosted map
async function startBoostedMapFarming(force = false) {
    try {
        let farmCheck;
        if (force) {
            // When forced (e.g., by Stamina Optimizer), bypass enabled checks
            // but still get the boosted map data
            const boostedData = getBoostedMapData();
            if (!boostedData) {
                console.log('[Better Boosted Maps] No boosted map data available');
                return;
            }
            const roomName = getRoomName(boostedData.roomId);
            const equipmentName = getEquipmentName(boostedData.equipId);
            farmCheck = {
                shouldFarm: true,
                roomId: boostedData.roomId,
                roomName: roomName,
                equipmentName: equipmentName,
                equipStat: boostedData.equipStat
            };
            console.log('[Better Boosted Maps] Forced farming (bypassing enabled checks)');
        } else {
            farmCheck = shouldFarmBoostedMap();
            if (!farmCheck.shouldFarm) {
                console.log('[Better Boosted Maps] Not farming:', farmCheck.reason);
                return;
            }
        }
        
        // Check if automation is still enabled before starting
        if (!checkAutomationEnabled('before starting')) return;
        
        modState.farming.isActive = true;
        modState.farming.currentMapInfo = farmCheck;
        
        console.log(`[Better Boosted Maps] Starting boosted map farming: ${farmCheck.roomName}`);
        
        // Show toast notification
        showToast('Starting Boosted Map');
        
        // Close any open modals (3 ESC presses for consistency)
        console.log('[Better Boosted Maps] Clearing modals before navigation...');
        clearModalsWithEsc(3);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // User-configurable initial delay
        const initialSettings = loadSettings();
        const startDelay = (initialSettings.startDelay || DEFAULT_START_DELAY) * 1000;
        console.log(`[Better Boosted Maps] Waiting ${startDelay/1000}s before navigation...`);
        await new Promise(resolve => setTimeout(resolve, startDelay));
        
        // Check automation status after initial delay
        if (!checkAutomationEnabled('during navigation delay')) return;
        
        // Navigate to boosted map
        console.log('[Better Boosted Maps] Navigating to map...');
        try {
            globalThis.state.board.send({
                type: 'selectRoomById',
                roomId: farmCheck.roomId
            });
            await new Promise(resolve => setTimeout(resolve, NAVIGATION_DELAY));
            
            // Set floor for this map (default to 0 if not configured)
            const mapFloors = initialSettings.mapFloors || {};
            const floor = mapFloors[farmCheck.roomId] !== undefined ? mapFloors[farmCheck.roomId] : 0;
            console.log(`[Better Boosted Maps] Setting floor to ${floor} for map ${farmCheck.roomId}`);
            globalThis.state.board.trigger.setState({ fn: (prev) => ({ ...prev, floor: floor }) });
            await new Promise(resolve => setTimeout(resolve, 100));
            
            console.log('[Better Boosted Maps] Navigation completed');
        } catch (error) {
            console.error('[Better Boosted Maps] Error navigating to map:', error);
            cancelBoostedMapFarming('Failed to navigate to map');
            return;
        }
        
        // Check automation status after navigation
        if (!checkAutomationEnabled('after navigation')) return;
        
        // Get user's selected setup method
        const setupSettings = loadSettings();
        const setupMethod = setupSettings.setupMethod || 'Auto-setup';
        
        // Find and click the appropriate setup button
        console.log(`[Better Boosted Maps] Looking for ${setupMethod} button...`);
        const setupButton = findSetupButton(setupMethod);
        if (!setupButton) {
            console.log(`[Better Boosted Maps] ${setupMethod} button not found`);
            cancelBoostedMapFarming(`${setupMethod} button not found`);
            return;
        }
        
        console.log(`[Better Boosted Maps] Clicking ${setupMethod} button...`);
        setupButton.click();
        await new Promise(resolve => setTimeout(resolve, AUTO_SETUP_DELAY));
        
        // Check automation status after setup
        if (!checkAutomationEnabled('after setup')) return;
        
        // Load settings once for all configuration
        const settings = loadSettings();
        
        // Enable autoplay mode
        console.log('[Better Boosted Maps] Enabling autoplay mode...');
        globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
        await new Promise(resolve => setTimeout(resolve, AUTOPLAY_SETUP_DELAY));
        
        // Check automation status after enabling autoplay
        if (!checkAutomationEnabled('after enabling autoplay')) return;
        
        // Enable integration features with retry logic
        if (settings.autoRefillStamina) {
            console.log('[Better Boosted Maps] Auto-refill stamina enabled - enabling Bestiary Automator...');
            enableIntegrationWithRetry(enableBestiaryAutomatorStaminaRefill, 'Stamina refill');
        }
        
        if (settings.fasterAutoplay) {
            console.log('[Better Boosted Maps] Faster autoplay enabled - enabling Bestiary Automator...');
            enableIntegrationWithRetry(enableBestiaryAutomatorFasterAutoplay, 'Faster autoplay');
        }
        
        if (settings.enableAutoplant) {
            console.log('[Better Boosted Maps] Autoplant enabled - enabling via Autoseller...');
            enableAutosellerDragonPlant();
        }
        
        // CRITICAL FIX: Wait for Bestiary Automator to initialize (standardized timing)
        console.log('[Better Boosted Maps] Waiting for Bestiary Automator to initialize...');
        await new Promise(resolve => setTimeout(resolve, BESTIARY_INIT_WAIT));
        
        // Post-navigation settings validation
        console.log('[Better Boosted Maps] Validating settings after navigation...');
        validateSettingsAfterNavigation();
        
        // Check stamina before attempting to start
        console.log('[Better Boosted Maps] Checking stamina status...');
        const staminaCheck = hasInsufficientStamina();
        
        if (staminaCheck.insufficient) {
            console.log(`[Better Boosted Maps] Insufficient stamina (needs ${staminaCheck.cost}) - starting monitoring`);
            
            // Start stamina recovery monitoring with continuous monitoring
            const continuousStaminaMonitoring = createStaminaMonitoringCallback(
                'Stamina recovered - clicking Start button',
                'Boosted map farming started successfully after stamina recovery'
            );
            
            startStaminaTooltipMonitoring(continuousStaminaMonitoring, staminaCheck.cost || DEFAULT_STAMINA_COST);
            
            return; // Exit - monitoring will handle the rest
        }
        
        console.log('[Better Boosted Maps] Stamina sufficient - checking automation status...');
        
        // Check automation status before clicking Start button
        if (!checkAutomationEnabled('before clicking Start')) return;
        
        // Find and click Start button
        console.log('[Better Boosted Maps] Looking for Start button...');
        const startButton = findButtonByText('Start');
        if (!startButton) {
            console.log('[Better Boosted Maps] Start button not found');
            cancelBoostedMapFarming('Start button not found');
            return;
        }
        
        console.log('[Better Boosted Maps] Clicking Start button...');
        startButton.click();
        await new Promise(resolve => setTimeout(resolve, AUTOMATION_CHECK_DELAY));
        
        // Final check after clicking Start button
        if (!checkAutomationEnabled('after clicking Start')) return;
        
        // Watch for stamina depletion during autoplay, then start recovery monitoring
        const handleStaminaDepletion = () => {
            const continuousStaminaMonitoring = createStaminaMonitoringCallback(
                'Stamina depleted during autoplay - restarting',
                'Autoplay restarted after stamina recovery'
            );
            
            const requiredStamina = getStaminaCost();
            startStaminaTooltipMonitoring(continuousStaminaMonitoring, requiredStamina);
        };
        
        watchStaminaDepletion(handleStaminaDepletion);
        
        console.log('[Better Boosted Maps] Boosted map farming started successfully');
    } catch (error) {
        console.error('[Better Boosted Maps] Error starting boosted map farming:', error);
        cancelBoostedMapFarming('Error during startup');
    }
}

// Generic helper to find mod exports
function findMod(modName, windowKey = null, contextKey = null) {
    // Method 1: Check window scope
    const windowObj = window[windowKey || modName];
    if (windowObj) return windowObj;
    
    // Method 2: Check context exports
    if (typeof context !== 'undefined' && context.exports) {
        return context.exports;
    }
    
    // Method 3: Try mod loader
    if (window.modLoader?.getModContext) {
        const modContext = window.modLoader.getModContext(contextKey || modName);
        if (modContext?.exports) return modContext.exports;
    }
    
    // Method 4: Try global exports
    if (typeof exports !== 'undefined') return exports;
    
    return null;
}

// Generic integration helper with retry logic
function enableIntegrationWithRetry(enableFunction, description) {
    setTimeout(() => {
        const success = enableFunction();
        if (!success) {
            console.log(`[Better Boosted Maps] ${description} - first attempt failed, retrying...`);
            setTimeout(() => enableFunction(), BESTIARY_RETRY_DELAY);
        }
    }, BESTIARY_INTEGRATION_DELAY);
}

// Create continuous stamina monitoring callback
function createStaminaMonitoringCallback(logPrefix, successMessage) {
    return () => {
        console.log(`[Better Boosted Maps] ${logPrefix}`);
        
        // Check if still valid to continue
        if (!modState.enabled) {
            console.log('[Better Boosted Maps] Farming cancelled during stamina wait');
            stopStaminaTooltipMonitoring();
            return;
        }
        
        // Check if user is still on correct boosted map
        if (!isOnCorrectBoostedMap()) {
            console.log('[Better Boosted Maps] User changed map - stopping stamina monitoring');
            stopStaminaTooltipMonitoring();
            cancelBoostedMapFarming('User changed map during stamina wait');
            return;
        }
        
        // Check if autoplay session is actually running (not just mode enabled)
        const boardContext = globalThis.state.board.getSnapshot().context;
        const isAutoplayMode = boardContext.mode === 'autoplay';
        const isAutoplaySessionRunning = boardContext.isRunning || boardContext.autoplayRunning;
        
        if (isAutoplayMode && isAutoplaySessionRunning) {
            // Autoplay session is actually running - just continue monitoring
            console.log('[Better Boosted Maps] Autoplay session running - continuing stamina monitoring');
            const requiredStamina = getStaminaCost();
            const callback = createStaminaMonitoringCallback(logPrefix, successMessage);
            startStaminaTooltipMonitoring(callback, requiredStamina);
        } else {
            // Autoplay session is not running - need to click Start button
            console.log('[Better Boosted Maps] Autoplay session not running - clicking Start button');
            
            // Find and click Start button
            const startButton = findButtonByText('Start');
            if (!startButton) {
                console.log('[Better Boosted Maps] Start button not found after stamina recovery');
                cancelBoostedMapFarming('Start button not found after stamina recovery');
                return;
            }
            
            console.log('[Better Boosted Maps] Clicking Start button after stamina recovery...');
            startButton.click();
            
            // Set up stamina depletion monitoring for the new autoplay session
            const handleStaminaDepletion = () => {
                const continuousStaminaMonitoring = createStaminaMonitoringCallback(
                    'Stamina depleted during autoplay - restarting',
                    'Autoplay restarted after stamina recovery'
                );
                
                const requiredStamina = getStaminaCost();
                startStaminaTooltipMonitoring(continuousStaminaMonitoring, requiredStamina);
            };
            
            watchStaminaDepletion(handleStaminaDepletion);
            
            console.log('[Better Boosted Maps] Autoplay started after stamina recovery');
        }
    };
}

// Bestiary Automator integration
function enableBestiaryAutomatorStaminaRefill() {
    try {
        const automator = findMod('bestiaryAutomator');
        if (automator?.updateConfig) {
            automator.updateConfig({ autoRefillStamina: true });
            console.log('[Better Boosted Maps] Bestiary Automator stamina refill enabled');
            return true;
        }
        console.log('[Better Boosted Maps] Bestiary Automator not available for stamina refill');
        return false;
    } catch (error) {
        console.error('[Better Boosted Maps] Error enabling stamina refill:', error);
        return false;
    }
}

function enableBestiaryAutomatorFasterAutoplay() {
    try {
        const automator = findMod('bestiaryAutomator');
        if (automator?.updateConfig) {
            automator.updateConfig({ fasterAutoplay: true });
            console.log('[Better Boosted Maps] Bestiary Automator faster autoplay enabled');
            return true;
        }
        console.log('[Better Boosted Maps] Bestiary Automator not available for faster autoplay');
        return false;
    } catch (error) {
        console.error('[Better Boosted Maps] Error enabling faster autoplay:', error);
        return false;
    }
}

function enableAutosellerDragonPlant() {
    try {
        const autoseller = findMod('autoseller');
        if (autoseller?.enableDragonPlant) {
            autoseller.enableDragonPlant();
            console.log('[Better Boosted Maps] Dragon Plant enabled');
            return true;
        }
        console.log('[Better Boosted Maps] Autoseller not available');
        return false;
    } catch (error) {
        console.error('[Better Boosted Maps] Error enabling Dragon Plant:', error);
        return false;
    }
}

// Find Bestiary Automator instance
function findBestiaryAutomator() {
    // Method 1: Check if Bestiary Automator is available in global scope
    if (window.bestiaryAutomator?.updateConfig) {
        return window.bestiaryAutomator;
    }
    
    // Method 2: Check if Bestiary Automator is available via API
    if (window.BestiaryAutomatorAPI?.updateConfig) {
        return window.BestiaryAutomatorAPI;
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
        
        // Validate boosted map settings
        if (!settings.maps || Object.keys(settings.maps).length === 0) {
            validationIssues.push('No boosted maps configured');
        }
        
        // Validate equipment settings
        if (!settings.equipment || Object.keys(settings.equipment).length === 0) {
            validationIssues.push('No equipment configured');
        }
        
        // Log validation results and attempt recovery
        if (validationIssues.length > 0) {
            console.warn('[Better Boosted Maps] Settings validation issues:', validationIssues);
            
            // Attempt automatic recovery for Bestiary Automator issues
            if (validationIssues.some(issue => issue.includes('Bestiary Automator'))) {
                console.log('[Better Boosted Maps] Attempting automatic recovery for Bestiary Automator...');
                const healthCheck = checkBestiaryAutomatorHealth();
                if (!healthCheck.healthy) {
                    console.warn('[Better Boosted Maps] Bestiary Automator health check failed:', healthCheck.reason);
                } else {
                    console.log('[Better Boosted Maps] Bestiary Automator health check passed, attempting to re-enable settings...');
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
            console.log('[Better Boosted Maps] Settings validation passed');
        }
        
        return validationIssues.length === 0;
    } catch (error) {
        console.error('[Better Boosted Maps] Error during settings validation:', error);
        return false;
    }
}

// Check and start boosted map farming if conditions are met
function checkAndStartBoostedMapFarming(force = false) {
    // Don't start if already farming
    if (modState.farming.isActive) {
        return;
    }
    
    if (force) {
        // When forced, bypass all checks and start immediately
        console.log('[Better Boosted Maps] Forced start - bypassing conditions check');
        const settings = loadSettings();
        const startDelay = (settings.startDelay || 3) * 1000;
        
        setTimeout(() => {
            if (!modState.farming.isActive) {
                startBoostedMapFarming(true);
            }
        }, startDelay);
        return;
    }
    
    // Check if we should farm
    const farmCheck = shouldFarmBoostedMap();
    if (farmCheck.shouldFarm) {
        console.log('[Better Boosted Maps] Conditions met - starting boosted map farming');
        
        // Get settings for delay
        const settings = loadSettings();
        const startDelay = (settings.startDelay || 3) * 1000;
        
        setTimeout(() => {
            // Double-check conditions before starting
            if (canRunBoostedMaps() && !modState.farming.isActive) {
                startBoostedMapFarming(false);
            }
        }, startDelay);
    }
}

// =======================
// 8. Quest Log Monitoring
// =======================

function monitorQuestLog() {
    if (modState.questLogObserver) return;
    
    modState.questLogObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const hasBoostedMap = node.textContent?.includes('Daily boosted map') || 
                            node.textContent?.includes('Mapa boostado diário') ||
                            node.querySelector?.('*')?.textContent?.includes('Daily boosted map') ||
                            node.querySelector?.('*')?.textContent?.includes('Mapa boostado diário');
                        
                        if (hasBoostedMap && !document.getElementById(TOGGLE_BUTTON_ID)) {
                            // Check if this is in Quest Log before injecting
                            if (isInQuestLog(node)) {
                                insertButtons();
                                break;
                            }
                        }
                    }
                }
            }
        }
    });
    
    modState.questLogObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('[Better Boosted Maps] Quest log monitoring started');
}

// =======================
// 9. Initialization
// =======================

function init() {
    console.log('[Better Boosted Maps] Initializing...');
    
    loadBoostedMapsState();
    monitorQuestLog();
    
    // Setup mod coordination if enabled
    if (modState.enabled) {
        console.log('[Better Boosted Maps] Mod is enabled - setting up coordination');
        setupRaidHunterCoordination();
        setupBetterTaskerCoordination();
        setupDailyStateMonitoring();
        
        // Check and start boosted map farming after delay
        setTimeout(() => {
            checkAndStartBoostedMapFarming();
        }, 5000); // 5 second delay to let other mods initialize
    }
    
    console.log('[Better Boosted Maps] Initialized');
}

init();

// =======================
// 10. State Exposure & Exports
// =======================

// Expose state for other mods to check
function exposeBoostedMapsState() {
    if (typeof window !== 'undefined') {
        window.betterBoostedMapsState = {
            enabled: modState.enabled,
            canRun: canRunBoostedMaps(),
            isYieldingToRaidHunter: modState.coordination.isRaidHunterActive,
            isYieldingToBetterTasker: modState.coordination.isBetterTaskerActive,
            isFarming: modState.farming.isActive,
            currentMap: modState.farming.currentMapInfo
        };
    }
}

// Update exposed state whenever coordination state changes
function updateExposedState() {
    exposeBoostedMapsState();
}

// Initial state exposure
exposeBoostedMapsState();

// Expose checkAndStartBoostedMapFarming on window for other mods to access
if (typeof window !== 'undefined') {
    window.checkAndStartBoostedMapFarming = checkAndStartBoostedMapFarming;
}

context.exports = {
    toggle: toggleBoostedMaps,
    checkAndStartBoostedMapFarming: checkAndStartBoostedMapFarming,
    cleanup: () => {
        console.log('[Better Boosted Maps] Cleaning up...');
        cleanupCoordination();
        
        // Cleanup daily subscription
        if (modState.dailySubscription) {
            modState.dailySubscription.unsubscribe();
            modState.dailySubscription = null;
        }
        
        if (modState.questLogObserver) {
            modState.questLogObserver.disconnect();
            modState.questLogObserver = null;
        }
        
        // Clean up stamina tooltip monitoring
        stopStaminaTooltipMonitoring();
        
        if (modState.activeModal) {
            cleanupModal();
        }
        
        // Reset farming state
        modState.farming.isActive = false;
        modState.farming.currentMapInfo = null;
        
        // Clear stamina cache
        modState.staminaCache.currentMapId = null;
        modState.staminaCache.cost = null;
        
        // Clean up exposed state
        if (window.betterBoostedMapsState) {
            delete window.betterBoostedMapsState;
        }
        
        // Clean up exposed function
        if (window.checkAndStartBoostedMapFarming) {
            delete window.checkAndStartBoostedMapFarming;
        }
        
        console.log('[Better Boosted Maps] Cleanup completed');
    }
};
