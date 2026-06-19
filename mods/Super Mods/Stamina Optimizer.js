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

// ============================================================================
// 1. CONSTANTS
// ============================================================================

const MOD_ID = 'stamina-optimizer';
const BUTTON_ID = `${MOD_ID}-button`;
const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;

const DEFAULT_MAX_STAMINA = 350;
const DEFAULT_MIN_STAMINA = 100;
const DEFAULT_ACTION = 'boosted-maps';
const DEFAULT_MAP_ID = '';
const DEFAULT_SETUP_LABEL = '';
const DEFAULT_FLOOR = 0;

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
const NAVIGATION_DELAY = 500;
const AUTO_SETUP_DELAY = 800;
const PAUSE_BUTTON_CLICK_DELAY = 100;
const PAUSE_BUTTON_UPDATE_DELAY = 300;
const MODS_LOADING_GRACE_PERIOD = 5000; // 5 seconds after allModsLoaded before allowing actions
const ACTION_START_DELAY = 1000;
const ACTION_START_TOAST_COOLDOWN_MS = 10000;
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

// Control Manager class for coordination
class ControlManager {
    constructor(name, uniqueProperties = {}) {
        this.name = name;
        this.currentOwner = null;
        Object.assign(this, uniqueProperties);
    }
    
    requestControl(modName) {
        if (this.currentOwner === null || this.currentOwner === modName) {
            this.currentOwner = modName;
            console.log(`[${this.name}] Control granted to ${modName}`);
            return true;
        }
        console.log(`[${this.name}] Control denied to ${modName} (currently owned by ${this.currentOwner})`);
        return false;
    }
    
    releaseControl(modName) {
        if (this.currentOwner === modName) {
            this.currentOwner = null;
            console.log(`[${this.name}] Control released by ${modName}`);
            return true;
        }
        return false;
    }
    
    hasControl(modName) {
        return this.currentOwner === modName;
    }
    
    getCurrentOwner() {
        return this.currentOwner;
    }
}

window.AutoplayManager = window.AutoplayManager || new ControlManager('Autoplay Manager', {
    originalMode: null,
    isControlledByOther(modName) {
        return this.currentOwner !== null && this.currentOwner !== modName;
    }
});

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
let lastActionStartToastAt = 0;
let isActionPending = false;
let isLifecycleActive = true;

// Schedule a timeout tracked for cleanup; no-op after cleanupStaminaOptimizer()
function scheduleTrackedTimeout(callback, ms) {
    const timeout = setTimeout(() => {
        const index = otherTimeouts.indexOf(timeout);
        if (index > -1) otherTimeouts.splice(index, 1);
        if (!isLifecycleActive) return;
        callback();
    }, ms);
    otherTimeouts.push(timeout);
    return timeout;
}

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
        if (window.staminaOptimizerRefillInterval) {
            clearInterval(window.staminaOptimizerRefillInterval);
            window.staminaOptimizerRefillInterval = null;
        }
        let lastStamina = getCurrentStamina();
        const refillCheckInterval = setInterval(() => {
            if (!isLifecycleActive) return;
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
// 4. MAP, SETUP AND FLOOR MANAGEMENT
// ============================================================================

// Get region display name from region id (uses maps-database)
function getRealRegionName(region) {
    if (!region) return 'Unknown Region';
    if (typeof globalThis.mapsDatabase?.getRegionDisplayNameFromRegion === 'function') {
        return globalThis.mapsDatabase.getRegionDisplayNameFromRegion(region);
    }
    if (region.name) return region.name;
    const regionId = region.id || 'unknown';
    if (typeof globalThis.mapsDatabase?.getRegionDisplayName === 'function') {
        return globalThis.mapsDatabase.getRegionDisplayName(regionId);
    }
    return String(regionId).replace(/\w\S*/g, (txt) =>
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
}

// Build room-id → index map from maps-database / state.utils.ROOMS order
function getMapsRoomOrderIndex() {
    const rooms = globalThis.mapsDatabase?.getAllMaps?.()
        || globalThis.state?.utils?.ROOMS
        || [];
    const orderMap = new Map();
    if (!Array.isArray(rooms)) return orderMap;
    rooms.forEach((room, index) => {
        if (room?.id) orderMap.set(room.id, index);
    });
    return orderMap;
}

// Sort maps by maps-database order (fallback to name for unknown ids)
function sortMapsByDatabaseOrder(maps) {
    const orderMap = getMapsRoomOrderIndex();
    return [...maps].sort((a, b) => {
        const orderA = orderMap.has(a.id) ? orderMap.get(a.id) : Number.MAX_SAFE_INTEGER;
        const orderB = orderMap.has(b.id) ? orderMap.get(b.id) : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
    });
}

// All maps in maps-database order (used when region data is unavailable)
function getAllMapsInDatabaseOrder(roomNames) {
    const rooms = globalThis.mapsDatabase?.getAllMaps?.()
        || globalThis.state?.utils?.ROOMS
        || [];
    if (Array.isArray(rooms) && rooms.length > 0) {
        return rooms
            .filter(room => room?.id && roomNames[room.id])
            .map(room => ({ id: room.id, name: roomNames[room.id] }));
    }
    return sortMapsByDatabaseOrder(
        Object.entries(roomNames).map(([id, name]) => ({ id, name }))
    );
}

// Organize maps by region for better UI (region + room order from game data)
function organizeMapsByRegion() {
    try {
        const roomNames = globalThis.state?.utils?.ROOM_NAME || {};
        const regions = globalThis.state?.utils?.REGIONS || [];
        
        if (!regions || regions.length === 0) {
            return { 'All Maps': getAllMapsInDatabaseOrder(roomNames) };
        }
        
        const organizedMaps = {};
        
        // Organize maps by region (preserve region.rooms order)
        regions.forEach(region => {
            if (!region.rooms || !Array.isArray(region.rooms)) return;
            
            const regionMaps = [];
            
            region.rooms.forEach(room => {
                const roomCode = room.id;
                if (roomNames[roomCode]) {
                    regionMaps.push({
                        id: roomCode,
                        name: roomNames[roomCode]
                    });
                }
            });
            
            if (regionMaps.length > 0) {
                const regionName = getRealRegionName(region);
                organizedMaps[regionName] = regionMaps;
            }
        });
        
        // Add any remaining maps not in a region (maps-database order)
        const processedRoomCodes = new Set();
        Object.values(organizedMaps).forEach(regionMaps => {
            regionMaps.forEach(map => processedRoomCodes.add(map.id));
        });
        
        const remainingMaps = sortMapsByDatabaseOrder(
            Object.entries(roomNames)
                .filter(([id]) => !processedRoomCodes.has(id))
                .map(([id, name]) => ({ id, name }))
        );
        
        if (remainingMaps.length > 0) {
            organizedMaps['Other Maps'] = remainingMaps;
        }
        
        return organizedMaps;
    } catch (error) {
        console.error('[Stamina Optimizer] Error organizing maps by region:', error);
        const roomNames = globalThis.state?.utils?.ROOM_NAME || {};
        return { 'All Maps': getAllMapsInDatabaseOrder(roomNames) };
    }
}

// Get all available maps from the game (legacy function for compatibility)
function getAllMapsList() {
    try {
        const organized = organizeMapsByRegion();
        const allMaps = [];
        
        // Flatten organized maps into single array
        for (const regionMaps of Object.values(organized)) {
            allMaps.push(...regionMaps.map(m => ({ roomId: m.id, roomName: m.name })));
        }
        
        return allMaps;
    } catch (error) {
        console.error('[Stamina Optimizer] Error getting maps list:', error);
        return [];
    }
}

// Get available setup labels from Better Setups
function getAvailableSetupLabels() {
    try {
        const labelsStr = localStorage.getItem('stored-setup-labels');
        if (labelsStr) {
            const labels = JSON.parse(labelsStr);
            return Array.isArray(labels) ? labels : [];
        }
        return ['Farm', 'Speedrun', 'Rank Points', 'Boosted Map', 'Other'];
    } catch (error) {
        console.error('[Stamina Optimizer] Error getting setup labels:', error);
        return ['Farm', 'Speedrun', 'Rank Points', 'Boosted Map', 'Other'];
    }
}

// Check if a setup exists for a specific map and label
function hasSetupForMap(setupLabel, mapId) {
    try {
        const setupKey = `${setupLabel}-${mapId}`;
        const setupData = localStorage.getItem(setupKey);
        return setupData !== null;
    } catch (error) {
        console.error('[Stamina Optimizer] Error checking setup:', error);
        return false;
    }
}

// Parse label from Better Setups "Setup (Label)" / "Save (Label)" button text
function parseBetterSetupsButtonLabel(buttonText) {
    const match = buttonText.trim().match(/^(?:Setup|Save)\s*\((.+)\)$/i);
    return match ? match[1].trim() : null;
}

// Green Better Setups buttons have saved data (same heuristic as Raid Hunter)
function hasBetterSetupsSavedData(button) {
    return button.classList.contains('frame-1-green')
        || button.classList.contains('surface-green')
        || button.style.backgroundImage?.includes('background-green');
}

// Stored-setups feature (game UI) — enabled via localStorage; Better Setups mod only manages labels
function isStoredSetupsFeatureEnabled() {
    try {
        return window.localStorage.getItem('stored-setups') === 'true'
            && window.localStorage.getItem('stored-setup-labels') != null;
    } catch (error) {
        console.error('[Stamina Optimizer] Error checking stored-setups feature:', error);
        return false;
    }
}

function isBetterSetupsMainActionButton(button) {
    const label = button.textContent.trim();
    if (button.classList.contains('edit-label-btn')) return false;
    return label.startsWith('Setup (') || label.startsWith('Save (');
}

// Main action buttons from the stored-setups bar (game UI; same with Better Setups mod on or off)
function getBetterSetupsMainActionButtons() {
    const setupContainer = document.querySelector('.mb-2.flex.items-center.gap-2');
    if (setupContainer) {
        const fromBar = Array.from(setupContainer.querySelectorAll('button')).filter(isBetterSetupsMainActionButton);
        if (fromBar.length > 0) return fromBar;
    }
    // Fallback: scan document (bar layout can differ when Better Setups mod is disabled)
    return Array.from(document.querySelectorAll('button')).filter(isBetterSetupsMainActionButton);
}

/**
 * Resolve how to apply a Better Setups label for the current map.
 * - setup: green "Setup (label)" — click to load
 * - already-applied: disabled "Save (label)" — board already matches saved setup
 * - null: not available
 */
function resolveBetterSetupsAction(setupLabel) {
    const wanted = String(setupLabel || '').trim();
    if (!wanted) return null;
    if (!isStoredSetupsFeatureEnabled()) {
        return null;
    }

    const buttons = getBetterSetupsMainActionButtons();
    let setupButton = null;
    let saveButton = null;

    for (const button of buttons) {
        const parsed = parseBetterSetupsButtonLabel(button.textContent);
        if (!parsed || parsed.toLowerCase() !== wanted.toLowerCase()) continue;
        const text = button.textContent.trim();
        if (text.startsWith('Setup (')) setupButton = button;
        else if (text.startsWith('Save (')) saveButton = button;
    }

    if (setupButton && hasBetterSetupsSavedData(setupButton)) {
        return { type: 'setup', button: setupButton };
    }
    if (saveButton && saveButton.disabled) {
        return { type: 'already-applied', button: saveButton };
    }
    if (setupButton) {
        return { type: 'setup', button: setupButton };
    }
    return null;
}

// Find setup button with retry logic
async function findSetupButton(setupLabel, maxAttempts = 5) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const action = resolveBetterSetupsAction(setupLabel);
        if (action?.type === 'setup') {
            console.log(`[Stamina Optimizer] ✅ Found setup button: "${action.button.textContent.trim()}"`);
            return action.button;
        }
        if (action?.type === 'already-applied') {
            console.log(`[Stamina Optimizer] Setup "${setupLabel}" already on board (Save button disabled) — skip load`);
            return 'already-applied';
        }

        const buttonCount = document.querySelectorAll('button').length;
        console.log(`[Stamina Optimizer] Attempt ${attempt}/${maxAttempts} - Found ${buttonCount} buttons`);
        if (attempt < maxAttempts) {
            console.log('[Stamina Optimizer] Setup button not found yet, waiting...');
            await sleep(200);
        }
    }

    console.log(`[Stamina Optimizer] ❌ Setup button not found after ${maxAttempts} attempts`);
    return null;
}

// Find auto-setup button with retry logic
async function findAutoSetupButton(maxAttempts = 5) {
    const autoSetupTexts = [
        t('mods.betterTasker.autoSetup'),
        t('mods.betterBoostedMaps.autoSetup'),
        t('mods.raidHunter.autoSetup'),
        'Auto-setup',
        'Auto setup',
        'Autosetup',
        'Autoconfigurar'
    ]
        .filter(text => typeof text === 'string' && text.trim() && !text.includes('.'))
        .map(text => text.trim().toLowerCase());

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const setupButtons = document.querySelectorAll('button');
        console.log(`[Stamina Optimizer] Attempt ${attempt}/${maxAttempts} - Searching for Auto-setup in ${setupButtons.length} buttons`);

        for (const button of setupButtons) {
            const buttonText = button.textContent.trim();
            const normalizedText = buttonText.toLowerCase();
            const hasAutoSetupText = autoSetupTexts.some(candidate => normalizedText.includes(candidate));
            const hasWandIcon = !!button.querySelector('svg.lucide-wand-sparkles');

            if (hasAutoSetupText || (hasWandIcon && normalizedText.includes('auto'))) {
                console.log(`[Stamina Optimizer] ✅ Found auto-setup button: "${buttonText}"`);
                return button;
            }
        }

        if (attempt < maxAttempts) {
            await sleep(200);
        }
    }

    console.log(`[Stamina Optimizer] ❌ Auto-setup button not found after ${maxAttempts} attempts`);
    return null;
}

// Load a setup from Better Setups
async function loadSetup(setupLabel, mapId) {
    try {
        console.log(`[Stamina Optimizer] Loading setup: ${setupLabel} for map: ${mapId}`);
        
        const setupKey = `${setupLabel}-${mapId}`;
        const setupData = localStorage.getItem(setupKey);
        
        if (!setupData) {
            console.log(`[Stamina Optimizer] ❌ No setup data found in localStorage for key: ${setupKey}`);
            return false;
        }

        if (!isStoredSetupsFeatureEnabled()) {
            console.log('[Stamina Optimizer] Stored-setups feature is off — enable Better Setups (or stored-setups in game) for labeled setups');
            return false;
        }
        
        console.log('[Stamina Optimizer] ✅ Setup data exists in localStorage');
        
        const setupButton = await findSetupButton(setupLabel);

        if (setupButton === 'already-applied') {
            return true;
        }

        if (setupButton) {
            console.log(`[Stamina Optimizer] Clicking setup button for: ${setupLabel}`);
            setupButton.click();
            console.log('[Stamina Optimizer] Setup button clicked, waiting for load...');
            await sleep(500);
            return true;
        } else {
            console.log(`[Stamina Optimizer] ❌ Setup button not found in UI for: ${setupLabel}`);
            // List all setup buttons for debugging
            const allButtons = document.querySelectorAll('button');
            const setupButtonTexts = [];
            for (const btn of allButtons) {
                const text = btn.textContent.trim();
                if (text.includes('Setup (') || text.includes('Save (')) {
                    setupButtonTexts.push(text);
                }
            }
            if (setupButtonTexts.length > 0) {
                console.log(`[Stamina Optimizer] Available setup buttons:`, setupButtonTexts);
            } else {
                console.log(`[Stamina Optimizer] No setup buttons found in UI`);
            }
            return false;
        }
    } catch (error) {
        console.error('[Stamina Optimizer] Error loading setup:', error);
        return false;
    }
}

// Load map auto-setup
async function loadAutoSetup() {
    try {
        console.log('[Stamina Optimizer] Loading map auto-setup');
        const autoSetupButton = await findAutoSetupButton();

        if (!autoSetupButton) {
            return false;
        }

        autoSetupButton.click();
        console.log('[Stamina Optimizer] Auto-setup button clicked, waiting for load...');
        await sleep(AUTO_SETUP_DELAY);
        return true;
    } catch (error) {
        console.error('[Stamina Optimizer] Error loading auto-setup:', error);
        return false;
    }
}

// Navigate to a specific map (no-op when already on that map)
async function navigateToSpecificMap(mapId) {
    try {
        if (!mapId) {
            console.log('[Stamina Optimizer] No map ID provided');
            return false;
        }

        const currentMapId = getCurrentMapId();
        if (currentMapId === mapId) {
            console.log(`[Stamina Optimizer] Already on map: ${mapId} - skipping navigation`);
            return true;
        }
        
        console.log(`[Stamina Optimizer] Navigating to map: ${mapId} (from ${currentMapId || 'unknown'})`);
        
        if (typeof window.markModSettingsProgrammaticNavFloorGuard === 'function') {
            window.markModSettingsProgrammaticNavFloorGuard('stamina-optimizer');
        }
        globalThis.state.board.send({
            type: 'selectRoomById',
            roomId: mapId
        });
        
        await sleep(NAVIGATION_DELAY);
        return true;
    } catch (error) {
        console.error('[Stamina Optimizer] Error navigating to map:', error);
        return false;
    }
}

// Set floor/difficulty level
async function setFloor(floor) {
    try {
        console.log(`[Stamina Optimizer] Setting floor to: ${floor}`);
        
        globalThis.state.board.trigger.setState({
            fn: (prev) => ({ ...prev, floor: floor })
        });
        
        await sleep(100);
        return true;
    } catch (error) {
        console.error('[Stamina Optimizer] Error setting floor:', error);
        return false;
    }
}

// Get current map ID
function getCurrentMapId() {
    try {
        const boardContext = globalThis.state?.board?.getSnapshot()?.context;
        if (boardContext?.selectedMap?.selectedRoom?.id) {
            return boardContext.selectedMap.selectedRoom.id;
        }
        return null;
    } catch (error) {
        console.error('[Stamina Optimizer] Error getting current map:', error);
        return null;
    }
}

// Sleep helper function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Close open modals before navigation (same pattern as Better Boosted Maps)
function clearModalsWithEsc(count = 1) {
    for (let i = 0; i < count; i++) {
        document.dispatchEvent(createEscKeyEvent());
    }
}

function showToast(message, duration = 5000) {
    try {
        let mainContainer = document.getElementById('stamina-optimizer-toast-container');
        if (!mainContainer) {
            mainContainer = document.createElement('div');
            mainContainer.id = 'stamina-optimizer-toast-container';
            mainContainer.style.cssText = `
                position: fixed;
                z-index: 9999;
                inset: 16px 16px 64px;
                pointer-events: none;
            `;
            document.body.appendChild(mainContainer);
        }

        const existingToasts = mainContainer.querySelectorAll('.toast-item');
        const stackOffset = existingToasts.length * 46;

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

        const toast = document.createElement('button');
        toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';

        const widgetTop = document.createElement('div');
        widgetTop.className = 'widget-top h-2.5';

        const widgetBottom = document.createElement('div');
        widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';

        const iconImg = document.createElement('img');
        iconImg.alt = 'stamina';
        iconImg.src = 'https://bestiaryarena.com/assets/icons/stamina.png';
        iconImg.className = 'pixelated';
        iconImg.style.cssText = 'width: 16px; height: 16px;';
        widgetBottom.appendChild(iconImg);

        const messageDiv = document.createElement('div');
        messageDiv.className = 'text-left';
        messageDiv.textContent = message;
        widgetBottom.appendChild(messageDiv);

        toast.appendChild(widgetTop);
        toast.appendChild(widgetBottom);
        flexContainer.appendChild(toast);
        mainContainer.appendChild(flexContainer);

        console.log(`[Stamina Optimizer] Toast shown: ${message}`);

        setTimeout(() => {
            if (flexContainer && flexContainer.parentNode) {
                flexContainer.parentNode.removeChild(flexContainer);

                const toasts = mainContainer.querySelectorAll('.toast-item');
                toasts.forEach((item, index) => {
                    item.style.transform = `translateY(-${index * 46}px)`;
                });
            }
        }, duration);
    } catch (error) {
        console.error('[Stamina Optimizer] Error showing toast:', error);
    }
}

function showActionStartToast() {
    const now = Date.now();
    if (now - lastActionStartToastAt < ACTION_START_TOAST_COOLDOWN_MS) {
        return;
    }
    lastActionStartToastAt = now;
    showToast('Starting Stamina Optimizer');
}

// ============================================================================
// 5. COORDINATION FUNCTIONS
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
        if (window.ModCoordination?.isModActive('Better Boosted Maps')) {
            return true;
        }
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

function isBoostedMapsAction() {
    const settings = loadSettings();
    return (settings.action || DEFAULT_ACTION) === 'boosted-maps';
}

// True when Better Boosted Maps is running an autoplay session we should manage (not player autoplay)
function isBetterBoostedMapsAutoplaySession() {
    if (!isBoostedMapsAction()) {
        return false;
    }
    try {
        const boardContext = globalThis.state?.board?.getSnapshot()?.context;
        if (boardContext?.mode !== 'autoplay' || !isAutoplaySessionActive()) {
            return false;
        }
    } catch (error) {
        return false;
    }
    return isBoostedMapsActive();
}

function recognizeBoostedMapsAutoplaySession() {
    if (isCurrentlyActive && wasInitiatedByMod) {
        return;
    }
    isCurrentlyActive = true;
    wasInitiatedByMod = true;
    syncModCoordinationState();
    updateButton();
}

// Check if Better Boosted Maps is farming a valid boosted map - Returns: True if farming valid map (boolean)
function isBoostedMapFarmingValid() {
    try {
        const boostedState = getBetterBoostedMapsState() || window.betterBoostedMapsState;
        const modCoordActive = window.ModCoordination?.isModActive('Better Boosted Maps') === true;
        if (!boostedState?.enabled && !modCoordActive) {
            return false;
        }
        if (!boostedState?.isFarming && !modCoordActive) {
            return false;
        }
        
        // Check if there's current map info
        if (!boostedState?.currentMap) {
            return modCoordActive;
        }
        
        // Load Better Boosted Maps settings
        const settingsStr = localStorage.getItem('betterBoostedMapsSettings');
        if (!settingsStr) {
            return false;
        }
        
        const settings = JSON.parse(settingsStr);
        
        // Check if the current map is enabled
        const mapEnabled = settings.maps?.[boostedState.currentMap.roomId] !== false;
        if (!mapEnabled) {
            console.log('[Stamina Optimizer] Current boosted map is not enabled in Better Boosted Maps settings');
            return false;
        }
        
        // Check if the equipment is enabled
        const equipmentName = boostedState.currentMap.equipmentName;
        if (equipmentName) {
            const equipId = equipmentName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const equipEnabled = settings.equipment?.[equipId] !== false;
            if (!equipEnabled) {
                console.log('[Stamina Optimizer] Current boosted equipment is not enabled in Better Boosted Maps settings');
                return false;
            }
        }
        
        console.log('[Stamina Optimizer] Valid boosted map farming detected - will not stop');
        return true;
    } catch (error) {
        console.error('[Stamina Optimizer] Error checking boosted map validity:', error);
        return false;
    }
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
// 6. AUTOPLAY CONTROL FUNCTIONS
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

// Sync enabled/active flags with Mod Coordination
function syncModCoordinationState() {
    if (!window.ModCoordination) return;
    window.ModCoordination.updateModState('Stamina Optimizer', {
        enabled: isAutomationEnabled === AUTOMATION_ENABLED,
        active: isCurrentlyActive && wasInitiatedByMod
    });
}

// Helper to release control and reset state
function releaseControlAndResetState() {
    isCurrentlyActive = false;
    wasInitiatedByMod = false;
    window.AutoplayManager?.releaseControl('Stamina Optimizer');
    syncModCoordinationState();
    updateButton();
}

// Request control and set active state - Returns: True if control was granted (boolean)
function requestControlAndSetActive() {
    if (!window.AutoplayManager?.requestControl('Stamina Optimizer')) {
        return false;
    }
    isCurrentlyActive = true;
    wasInitiatedByMod = true;
    syncModCoordinationState();
    updateButton();
    return true;
}

// True when an autoplay session is actively running (not paused/idle in autoplay mode)
function isAutoplaySessionActive() {
    try {
        const pauseSelectors = [
            'button:has(svg.lucide-pause)',
            'button.frame-1-red:has(svg.lucide-pause)',
            'button[class*="surface-red"]:has(svg.lucide-pause)'
        ];
        if (pauseSelectors.some(selector => document.querySelector(selector))) {
            return true;
        }
        const resumeTexts = getBothLanguages('Resume');
        for (const text of resumeTexts) {
            if (findButtonByText(text)) return false;
        }
        const startTexts = getBothLanguages('Start');
        for (const text of startTexts) {
            if (findButtonByText(text)) return false;
        }
        return false;
    } catch (error) {
        console.error('[Stamina Optimizer] Error checking autoplay session state:', error);
        return false;
    }
}

// Check if autoplay was initiated by the player (not by this mod) - Returns: True if player-initiated (boolean)
function isPlayerInitiatedAutoplay() {
    try {
        const boardContext = globalThis.state?.board?.getSnapshot()?.context;
        if (!boardContext) {
            return false;
        }
        const isAutoplayMode = boardContext.mode === 'autoplay';
        if (!isAutoplayMode) {
            return false;
        }
        // Paused/idle in autoplay mode (e.g. after mod clicked Pause) is not player-initiated blocking
        if (!isAutoplaySessionActive()) {
            return false;
        }
        if (isBetterBoostedMapsAutoplaySession()) {
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

// Find button by text (supports multiple languages)
function findButtonByText(text) {
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
        if (button.textContent.trim() === text) {
            return button;
        }
    }
    return null;
}

// Get both English and Portuguese text for a key
function getBothLanguages(key) {
    const translations = {
        'Start': ['Start', 'Iniciar'],
        'Pause': ['Pause', 'Pausar'],
        'Resume': ['Resume', 'Retomar']
    };
    return translations[key] || [key];
}

// Find Start button in multiple languages
function findStartButton() {
    const startTexts = getBothLanguages('Start');
    for (const text of startTexts) {
        const button = findButtonByText(text);
        if (button) {
            console.log(`[Stamina Optimizer] Found Start button with text: "${text}"`);
            return button;
        }
    }
    console.log('[Stamina Optimizer] Start button not found');
    return null;
}

// Ensure autoplay mode is active
async function ensureAutoplayMode() {
    try {
        const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
        if (!boardContext) {
            console.warn('[Stamina Optimizer] Board context not available');
            return false;
        }
        
        const currentMode = boardContext.mode;
        console.log(`[Stamina Optimizer] Current mode: ${currentMode}`);
        
        if (currentMode !== 'autoplay') {
            console.log('[Stamina Optimizer] Setting mode to autoplay...');
            globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
            
            // Wait for mode to change
            await sleep(300);
            
            // Verify mode changed
            const newContext = globalThis.state.board.getSnapshot().context;
            if (newContext.mode !== 'autoplay') {
                console.error('[Stamina Optimizer] Failed to change mode to autoplay!');
                return false;
            }
            console.log('[Stamina Optimizer] ✅ Mode changed to autoplay');
        } else {
            console.log('[Stamina Optimizer] Already in autoplay mode');
        }
        
        return true;
    } catch (error) {
        console.error('[Stamina Optimizer] Error ensuring autoplay mode:', error);
        return false;
    }
}

// Start autoplay (only if we can proceed and it wasn't player-initiated)
async function startAutoplay() {
    console.log('[Stamina Optimizer] startAutoplay() called');
    
    if (!canProceed()) {
        console.log('[Stamina Optimizer] Cannot proceed with autoplay');
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
    
    // Check if we already have control (might have been requested earlier)
    const hasControl = window.AutoplayManager?.hasControl('Stamina Optimizer');
    if (!hasControl) {
        if (!window.AutoplayManager?.requestControl('Stamina Optimizer')) {
            console.log('[Stamina Optimizer] Cannot start autoplay - control denied');
            return false;
        }
        console.log('[Stamina Optimizer] Control acquired');
    } else {
        console.log('[Stamina Optimizer] Already have control');
    }
    
    try {
        setStateFlag('isStartingAutoplay');
        
        // Step 1: Ensure autoplay mode is active
        const modeSet = await ensureAutoplayMode();
        if (!modeSet) {
            console.error('[Stamina Optimizer] Failed to set autoplay mode');
            window.AutoplayManager?.releaseControl('Stamina Optimizer');
            isStartingAutoplay = false;
            return false;
        }
        
        // Step 2: Find and click the Start button
        await sleep(200);
        const startButton = findStartButton();
        
        if (!startButton) {
            console.error('[Stamina Optimizer] ❌ Start button not found!');
            window.AutoplayManager?.releaseControl('Stamina Optimizer');
            isCurrentlyActive = false;
            wasInitiatedByMod = false;
            isStartingAutoplay = false;
            return false;
        }
        
        console.log('[Stamina Optimizer] Clicking Start button...');
        startButton.click();
        
        // Wait for autoplay to actually start
        await sleep(300);
        
        isCurrentlyActive = true;
        wasInitiatedByMod = true;
        updateButton();
        
        console.log('[Stamina Optimizer] ✅ Autoplay started successfully (button clicked)');
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
async function pauseAutoplayWithButton(maxRetries = 3, retryDelay = 500) {
    try {
        console.log('[Stamina Optimizer] Looking for pause button...');

        const selectors = [
            'button:has(svg.lucide-pause)',
            'button.frame-1-red[class*="pause"]',
            'button.frame-1-red:has(svg.lucide-pause)',
            'button[class*="surface-red"]:has(svg.lucide-pause)'
        ];

        let button = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            button = selectors.reduce((found, selector) =>
                found || document.querySelector(selector), null);

            if (!button) {
                const flexContainers = document.querySelectorAll('div.flex');
                for (const flexContainer of flexContainers) {
                    const buttons = flexContainer.querySelectorAll('button');
                    if (buttons.length >= 2) {
                        const secondButton = buttons[1];
                        if (secondButton.querySelector('svg.lucide-pause')) {
                            button = secondButton;
                            console.log('[Stamina Optimizer] Found pause button using structure fallback');
                            break;
                        }
                    }
                }
            }

            if (button) break;

            if (attempt < maxRetries - 1) {
                console.log(`[Stamina Optimizer] Pause button not found, retrying in ${retryDelay}ms... (attempt ${attempt + 1}/${maxRetries})`);
                await sleep(retryDelay);
            }
        }

        if (button) {
            console.log('[Stamina Optimizer] Found pause button, clicking to pause autoplay session...');
            document.dispatchEvent(createEscKeyEvent());
            await sleep(PAUSE_BUTTON_CLICK_DELAY);
            button.click();
            await sleep(PAUSE_BUTTON_UPDATE_DELAY);
            console.log('[Stamina Optimizer] Pause button clicked successfully');
            return true;
        }

        console.log('[Stamina Optimizer] Pause button not found after retries');
        return false;
    } catch (error) {
        console.error('[Stamina Optimizer] Error clicking pause button:', error);
        return false;
    }
}

// Stop autoplay (only if we initiated it) - Uses pause button to stop session without changing mode
async function stopAutoplay(options = {}) {
    const { toastMessage = null } = options;
    if (!wasInitiatedByMod || !isCurrentlyActive) {
        console.log('[Stamina Optimizer] Not stopping - autoplay was not initiated by mod');
        return false;
    }
    if (!window.AutoplayManager?.hasControl('Stamina Optimizer')) {
        console.log('[Stamina Optimizer] Not stopping - control lost');
        releaseControlAndResetState();
        return false;
    }
    try {
        if (toastMessage) {
            showToast(toastMessage);
        }
        setStateFlag('isStoppingAutoplay');
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (boardContext.mode === 'autoplay') {
            const needsPause = boardContext.gameStarted || isAutoplaySessionActive();
            if (needsPause) {
                const paused = await pauseAutoplayWithButton();
                if (paused) {
                    console.log('[Stamina Optimizer] Autoplay session paused using pause button');
                } else {
                    console.warn('[Stamina Optimizer] Pause button not found after retries - releasing control without mode change');
                }
            } else {
                console.log('[Stamina Optimizer] Autoplay idle - releasing control without pause');
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

// Check if there are creatures on the board
function hasCreaturesOnBoard() {
    try {
        const boardContext = globalThis.state?.board?.getSnapshot()?.context;
        if (!boardContext || !boardContext.boardConfig) {
            return false;
        }
        
        // Check if there are any player creatures
        const hasPlayerCreatures = boardContext.boardConfig.some(piece => 
            piece.type === 'player' || (piece.type === 'custom' && piece.villain === false)
        );
        
        console.log(`[Stamina Optimizer] Has creatures on board: ${hasPlayerCreatures}`);
        return hasPlayerCreatures;
    } catch (error) {
        console.error('[Stamina Optimizer] Error checking board creatures:', error);
        return false;
    }
}

// Start playing on specific map with setup and floor
async function startSpecificMapPlay() {
    try {
        if (isPlayerInitiatedAutoplay()) {
            console.log('[Stamina Optimizer] Autoplay is player-initiated - not starting specific map play');
            return false;
        }
        
        const settings = loadSettings();
        const mapId = settings.mapId || DEFAULT_MAP_ID;
        const setupLabel = settings.setupLabel || DEFAULT_SETUP_LABEL;
        const floor = settings.floor !== undefined ? settings.floor : DEFAULT_FLOOR;
        
        if (!mapId) {
            console.error('[Stamina Optimizer] No map ID specified for specific map play');
            return false;
        }
        
        // Check if already playing
        if (isAutoplayControlledByOther()) {
            console.log('[Stamina Optimizer] Autoplay controlled by another mod - not starting');
            return false;
        }
        
        // Request control
        if (!requestControlAndSetActive()) {
            console.log('[Stamina Optimizer] Cannot start specific map play - autoplay control denied');
            return false;
        }
        
        console.log(`[Stamina Optimizer] Starting specific map play: ${mapId}, setup: ${setupLabel}, floor: ${floor}`);

        const alreadyOnMap = getCurrentMapId() === mapId;

        const navigated = await navigateToSpecificMap(mapId);
        if (!navigated) {
            console.error('[Stamina Optimizer] Failed to navigate to map');
            releaseControlAndResetState();
            return false;
        }
        
        // Shorter wait when already on the correct map
        await sleep(alreadyOnMap ? 150 : 800);
        
        // Set floor
        await setFloor(floor);
        await sleep(200);
        
        // Load setup if specified
        if (setupLabel && hasSetupForMap(setupLabel, mapId)) {
            console.log(`[Stamina Optimizer] Loading setup: ${setupLabel} for map: ${mapId}`);
            const setupLoaded = await loadSetup(setupLabel, mapId);

            if (!setupLoaded) {
                console.error(`[Stamina Optimizer] Failed to load setup "${setupLabel}" for map ${mapId}`);
                releaseControlAndResetState();
                return false;
            }

            console.log('[Stamina Optimizer] Waiting for setup to load...');
            await sleep(1200);

            if (!hasCreaturesOnBoard()) {
                console.error('[Stamina Optimizer] No creatures on board after loading setup!');
                releaseControlAndResetState();
                return false;
            }
            console.log('[Stamina Optimizer] Setup ready, creatures on board');
        } else if (setupLabel) {
            console.log(`[Stamina Optimizer] No setup found for ${setupLabel}-${mapId}, continuing without setup`);
        } else {
            // No custom setup selected - use map auto-setup
            const autoSetupLoaded = await loadAutoSetup();
            if (autoSetupLoaded) {
                console.log('[Stamina Optimizer] Waiting for auto-setup to load...');
                await sleep(1200);
            } else {
                // Fallback behavior if auto-setup button is unavailable
                await sleep(500);
            }

            if (!hasCreaturesOnBoard()) {
                console.warn('[Stamina Optimizer] No creatures on board after auto-setup fallback flow!');
            }
        }
        
        // Final wait before starting autoplay
        await sleep(300);
        
        // Ensure we're in manual mode before starting
        try {
            const boardContext = globalThis.state.board.getSnapshot().context;
            if (boardContext.mode === 'autoplay') {
                console.log('[Stamina Optimizer] Already in autoplay mode, checking if running...');
                // If already in autoplay but not started, we still need to click Start
                const startButton = findStartButton();
                if (startButton) {
                    console.log('[Stamina Optimizer] Clicking Start button...');
                    startButton.click();
                    await sleep(300);
                }
                return true;
            }
            console.log(`[Stamina Optimizer] Current mode: ${boardContext.mode}, starting autoplay...`);
        } catch (error) {
            console.error('[Stamina Optimizer] Error checking board mode:', error);
        }
        
        // Start autoplay (now async)
        const started = await startAutoplay();
        
        if (started) {
            console.log('[Stamina Optimizer] ✅ Autoplay started successfully');
        } else {
            console.error('[Stamina Optimizer] ❌ Failed to start autoplay');
            releaseControlAndResetState();
        }
        
        return started;
        
    } catch (error) {
        console.error('[Stamina Optimizer] Error starting specific map play:', error);
        releaseControlAndResetState();
        return false;
    }
}

// ============================================================================
// 8. STAMINA MONITORING AND ACTION EXECUTION
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
        if (isBetterBoostedMapsAutoplaySession()) {
            recognizeBoostedMapsAutoplaySession();
            console.log('[Stamina Optimizer] Better Boosted Maps autoplay already running - not starting');
            return;
        }
        if (isPlayerInitiatedAutoplay()) {
            console.log('[Stamina Optimizer] Autoplay is player-initiated - not starting boosted map farming');
            return;
        }
        if (window.ModCoordination?.isModActive('Better Boosted Maps')) {
            console.log('[Stamina Optimizer] Better Boosted Maps is active (Mod Coordination) - not interfering');
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
            if (boardContext?.mode === 'autoplay' && isAutoplaySessionActive() && !isCurrentlyActive) {
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

// Execute the configured action
async function executeAction() {
    if (isActionPending) {
        return;
    }
    isActionPending = true;
    try {
        const settings = loadSettings();
        const action = settings.action || DEFAULT_ACTION;
        
        console.log(`[Stamina Optimizer] Executing action: ${action}`);

        showActionStartToast();
        clearModalsWithEsc(3);
        await sleep(100);

        console.log(`[Stamina Optimizer] Waiting ${ACTION_START_DELAY}ms before starting action...`);
        await sleep(ACTION_START_DELAY);

        if (!isLifecycleActive || !isAutomationEnabled) {
            return;
        }
        if (!canProceed()) {
            return;
        }

        switch (action) {
            case 'boosted-maps':
                startBoostedMapFarming();
                break;
            case 'specific-map':
                await startSpecificMapPlay();
                break;
            default:
                console.log(`[Stamina Optimizer] Unknown action: ${action}`);
        }
    } finally {
        isActionPending = false;
    }
}

// Monitor stamina and execute actions based on thresholds
async function monitorStamina() {
    if (!isLifecycleActive || !isAutomationEnabled) {
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
        if (remainingSeconds === 3 || remainingSeconds === 2 || remainingSeconds === 1) {
            console.log(`[Stamina Optimizer] ⏳ Waiting for mods to finish loading (${remainingSeconds}s remaining)...`);
        }
        return;
    }
    
    const settings = loadSettings();
    const maxStamina = settings.maxStamina || DEFAULT_MAX_STAMINA;
    const minStamina = settings.minStamina || DEFAULT_MIN_STAMINA;
    
    const currentStamina = getCurrentStamina();
    const runningTag = isCurrentlyActive
        ? (wasInitiatedByMod ? ', running (mod)' : ', running')
        : '';
    console.log(
        `[Stamina Optimizer] Checking stamina: ${currentStamina} (min: ${minStamina}, max: ${maxStamina}${runningTag})`
    );
    updateButton();
    if (currentStamina >= maxStamina) {
        if (!isCurrentlyActive && !isActionPending) {
            if (isBetterBoostedMapsAutoplaySession()) {
                recognizeBoostedMapsAutoplaySession();
                return;
            }
            if (isPlayerInitiatedAutoplay()) {
                console.log('[Stamina Optimizer] Stamina high but player autoplay active — not starting');
                return;
            }
            if (!wasBestiaryRefillRecent()) {
                if (canProceed()) {
                    console.log(`[Stamina Optimizer] Stamina (${currentStamina}) >= max (${maxStamina}) - executing action`);
                    try {
                        await executeAction();
                        updateButton();
                    } catch (error) {
                        console.error('[Stamina Optimizer] Error executing action:', error);
                    }
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
        if (isCurrentlyActive && wasInitiatedByMod) {
            // Check if we're farming a valid boosted map - if so, don't stop
            if (isBoostedMapFarmingValid()) {
                console.log(`[Stamina Optimizer] ⏸️ Stamina (${currentStamina}) < min (${minStamina}) but farming valid boosted map - continuing`);
                return;
            }
            
            console.log(`[Stamina Optimizer] ⏹️ Stamina (${currentStamina}) < min (${minStamina}) - stopping`);
            try {
                await stopAutoplay({ toastMessage: 'Stopping - Low Stamina' });
                updateButton();
            } catch (error) {
                console.error('[Stamina Optimizer] Error stopping autoplay:', error);
            }
        }
    }
}

// Start stamina monitoring
function startStaminaMonitoring() {
    if (staminaCheckInterval) {
        clearInterval(staminaCheckInterval);
    }
    
    monitorStamina();
    staminaCheckInterval = setInterval(() => {
        if (!isLifecycleActive) return;
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
// 9. AUTOPLAY STATE MONITORING
// ============================================================================

// Monitor autoplay state changes to detect when player manually stops/starts
function startAutoplayStateMonitoring() {
    if (!isLifecycleActive) return;
    if (boardStateUnsubscribe && typeof boardStateUnsubscribe === 'function') {
        boardStateUnsubscribe();
        boardStateUnsubscribe = null;
    }
    try {
        // Check if game state is available before subscribing
        if (!globalThis.state || !globalThis.state.board) {
            console.log('[Stamina Optimizer] ⏳ Game state not ready, retrying autoplay monitoring...');
            scheduleTrackedTimeout(() => startAutoplayStateMonitoring(), 2000);
            return;
        }
        boardStateUnsubscribe = globalThis.state.board.subscribe((state) => {
            if (!isLifecycleActive) return;
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
                                    scheduleTrackedTimeout(() => monitorStamina(), 500);
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
                        scheduleTrackedTimeout(() => monitorStamina(), 500);
                    }
                }
                if (hasAutoplayControl('Raid Hunter') && isCurrentlyActive && wasInitiatedByMod) {
                    console.log('[Stamina Optimizer] Raid Hunter took control - releasing our control');
                    releaseControlAndResetState();
                }
                if (isAutoplay && isBetterBoostedMapsAutoplaySession()) {
                    recognizeBoostedMapsAutoplaySession();
                } else if (isAutoplay && window.AutoplayManager?.hasControl('Stamina Optimizer')) {
                    if (!isCurrentlyActive || !wasInitiatedByMod) {
                        console.log('[Stamina Optimizer] Autoplay started (via Better Boosted Maps) - recognizing as our own');
                        isCurrentlyActive = true;
                        wasInitiatedByMod = true;
                        syncModCoordinationState();
                        updateButton();
                    }
                } else if (isAutoplay && isAutoplaySessionActive() && !isCurrentlyActive && !wasInitiatedByMod && !isStartingAutoplay) {
                    const timeSinceTrigger = Date.now() - (window.staminaOptimizerLastBoostedMapsTrigger || 0);
                    if (timeSinceTrigger < BOOSTED_MAPS_TRIGGER_WINDOW) {
                        if (!hasAutoplayControl('Raid Hunter') && requestControlAndSetActive()) {
                            console.log('[Stamina Optimizer] Autoplay started after triggering Better Boosted Maps - claiming control');
                        }
                    } else {
                        // Only log once on initialization to avoid spam, and only if it's unexpected
                        if (!hasLoggedAutoplayDetection) {
                            const settings = loadSettings();
                            const action = settings.action || DEFAULT_ACTION;
                            
                            // Identify which mod (if any) is controlling autoplay
                            const currentOwner = window.AutoplayManager?.getCurrentOwner?.();
                            let ownerInfo = 'player';
                            let isExpected = false;
                            
                            // Check if Better Boosted Maps is enabled (even if not actively farming yet)
                            const boostedMapsEnabled = window.betterBoostedMapsState?.enabled === true;
                            
                            if (currentOwner) {
                                ownerInfo = currentOwner;
                                // If action is 'boosted-maps' and Better Boosted Maps has control, that's expected
                                if (action === 'boosted-maps' && currentOwner === 'Better Boosted Maps') {
                                    isExpected = true;
                                }
                            } else if (isBoostedMapsActive()) {
                                ownerInfo = 'Better Boosted Maps (likely)';
                                // If action is 'boosted-maps' and Better Boosted Maps is active, that's expected
                                if (action === 'boosted-maps') {
                                    isExpected = true;
                                }
                            } else if (action === 'boosted-maps' && boostedMapsEnabled) {
                                // If action is 'boosted-maps' and Better Boosted Maps is enabled, 
                                // and autoplay is running, it's likely Better Boosted Maps started it
                                ownerInfo = 'Better Boosted Maps (likely)';
                                isExpected = true;
                            } else if (isRaidHunterActive()) {
                                ownerInfo = 'Raid Hunter (likely)';
                            } else if (isBetterTaskerActive()) {
                                ownerInfo = 'Better Tasker (likely)';
                            }
                            
                            // Only log if it's unexpected (not the intended behavior)
                            if (!isExpected) {
                                console.log(`[Stamina Optimizer] Autoplay is running (started by ${ownerInfo}) - will not interfere`);
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
// 10. UI FUNCTIONS
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
// 11. SETTINGS MODAL
// ============================================================================

let activeModal = null;
let modalInProgress = false;
let lastModalCall = 0;
let modalCleanupObserver = null;

const MODAL_WIDTH = 450;
const MODAL_HEIGHT = 300;

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

function createSettingInfoIcon(description) {
    if (!description) return null;
    const info = document.createElement('button');
    info.type = 'button';
    info.textContent = 'i';
    info.title = description;
    info.setAttribute('aria-label', description);
    info.style.cssText = `
        flex-shrink: 0;
        width: 14px;
        height: 14px;
        padding: 0;
        margin: 0;
        border: 1px solid ${COLOR_ACCENT};
        border-radius: 50%;
        background: ${COLOR_DARK_GRAY};
        color: ${COLOR_ACCENT};
        font-size: 10px;
        font-weight: bold;
        font-style: italic;
        font-family: serif;
        line-height: 1;
        cursor: help;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    `;
    info.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    return info;
}

function createSettingLabel(labelText, description, forId) {
    const row = document.createElement('div');
    row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 4px;
    `;
    const label = document.createElement('label');
    label.textContent = labelText;
    label.className = 'pixel-font-16';
    label.style.cssText = `
        font-weight: bold;
        color: ${COLOR_WHITE};
    `;
    if (forId) label.setAttribute('for', forId);
    const info = createSettingInfoIcon(description);
    if (info) row.appendChild(info);
    row.appendChild(label);
    return row;
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
    const info = createSettingInfoIcon(description);
    if (info) checkboxLabelContainer.appendChild(info);
    checkboxLabelContainer.appendChild(label);
    
    settingDiv.appendChild(checkboxLabelContainer);
    
    return settingDiv;
}

function getStaminaInputStyle(isInvalid) {
    if (isInvalid) {
        return `
            width: 100%;
            padding: 6px;
            background: rgba(255, 107, 107, 0.12);
            border: 1px solid ${COLOR_RED};
            color: ${COLOR_WHITE};
            border-radius: 3px;
            box-sizing: border-box;
            font-size: 14px;
        `;
    }
    return `
        width: 100%;
        padding: 6px;
        background: ${COLOR_DARK_GRAY};
        border: 1px solid ${COLOR_ACCENT};
        color: ${COLOR_WHITE};
        border-radius: 3px;
        box-sizing: border-box;
        font-size: 14px;
    `;
}

// Highlight max/min inputs when invalid; returns true if values can be saved
function updateStaminaThresholdValidation() {
    const maxInput = document.getElementById('maxStamina');
    const minInput = document.getElementById('minStamina');
    if (!maxInput || !minInput) return true;

    const max = parseInt(maxInput.value, 10);
    const min = parseInt(minInput.value, 10);
    const maxRangeInvalid = isNaN(max) || max < 1 || max > 1000;
    const minRangeInvalid = isNaN(min) || min < 1 || min > 1000;
    const orderInvalid = !maxRangeInvalid && !minRangeInvalid && max <= min;

    maxInput.style.cssText = getStaminaInputStyle(maxRangeInvalid || orderInvalid);
    minInput.style.cssText = getStaminaInputStyle(minRangeInvalid || orderInvalid);

    return !maxRangeInvalid && !minRangeInvalid && !orderInvalid;
}

function bindStaminaValidationInputs() {
    ['maxStamina', 'minStamina'].forEach((id) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', () => {
            updateStaminaThresholdValidation();
            autoSaveSettings();
        });
    });
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
    
    settingDiv.appendChild(createSettingLabel(labelText, description, id));
    
    const input = createStyledInput('number', id, value, getStaminaInputStyle(false), {
        min,
        max,
        className: 'pixel-font-16'
    });
    input.addEventListener('change', autoSaveSettings);
    settingDiv.appendChild(input);
    
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
    
    settingDiv.appendChild(createSettingLabel(label, description, id));
    
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
    
    return settingDiv;
}

// Create grouped map dropdown with optgroups
function createGroupedMapDropdown(id, label, description, value) {
    const settingDiv = document.createElement('div');
    settingDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    settingDiv.appendChild(createSettingLabel(label, description, id));
    
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
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select a Map --';
    defaultOption.style.cssText = `
        background: ${COLOR_DARK_GRAY};
        color: ${COLOR_GRAY};
    `;
    selectElement.appendChild(defaultOption);
    
    // Get organized maps by region
    const organizedMaps = organizeMapsByRegion();
    
    // Create optgroups for each region
    Object.entries(organizedMaps).forEach(([regionName, maps]) => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = regionName;
        optgroup.style.cssText = `
            background: ${COLOR_DARK_GRAY};
            color: ${COLOR_ACCENT};
            font-weight: bold;
        `;
        
        maps.forEach(map => {
            const option = document.createElement('option');
            option.value = map.id;
            option.textContent = map.name;
            option.style.cssText = `
                background: ${COLOR_DARK_GRAY};
                color: ${COLOR_WHITE};
                padding-left: 10px;
            `;
            optgroup.appendChild(option);
        });
        
        selectElement.appendChild(optgroup);
    });
    
    selectElement.value = value;
    selectElement.addEventListener('change', autoSaveSettings);
    settingDiv.appendChild(selectElement);
    
    return settingDiv;
}

// Place two settings side by side (single child uses full row width)
function createSettingsRow(leftSetting, rightSetting = null) {
    const row = document.createElement('div');
    row.style.cssText = `
        display: flex;
        gap: 10px;
        margin-bottom: 8px;
        align-items: flex-start;
        width: 100%;
    `;
    const children = rightSetting ? [leftSetting, rightSetting] : [leftSetting];
    children.forEach(child => {
        child.style.flex = '1 1 0';
        child.style.minWidth = '0';
        child.style.marginBottom = '0';
        row.appendChild(child);
    });
    return row;
}

// Create settings content
function createSettingsContent() {
    const mainContainer = document.createElement('div');
    mainContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        width: 420px;
        height: 300px;
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
        syncModCoordinationState();
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
    const minStaminaSetting = createNumberSetting(
        'minStamina',
        t('mods.staminaOptimizer.minStaminaLabel'),
        t('mods.staminaOptimizer.minStaminaDescription'),
        settings.minStamina || DEFAULT_MIN_STAMINA,
        1,
        1000
    );
    mainContainer.appendChild(createSettingsRow(maxStaminaSetting, minStaminaSetting));
    bindStaminaValidationInputs();
    updateStaminaThresholdValidation();
    
    const actionSetting = createDropdownSetting(
        'action',
        t('mods.staminaOptimizer.actionLabel'),
        t('mods.staminaOptimizer.actionDescription'),
        settings.action || DEFAULT_ACTION,
        [
            { value: 'boosted-maps', label: 'Better Boosted Maps' },
            { value: 'specific-map', label: 'Specific Map' }
        ]
    );
    const mapSettingSlot = document.createElement('div');
    mapSettingSlot.id = 'stamina-optimizer-map-slot';
    mapSettingSlot.style.cssText = 'display: flex; flex-direction: column; flex: 1 1 0; min-width: 0;';
    const setupFloorRowSlot = document.createElement('div');
    setupFloorRowSlot.id = 'stamina-optimizer-setup-floor-row';
    mainContainer.appendChild(createSettingsRow(actionSetting, mapSettingSlot));
    mainContainer.appendChild(setupFloorRowSlot);
    
    function attachConditionalAutoSave(root) {
        root.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', autoSaveSettings);
        });
    }
    
    // Function to update conditional settings based on action
    function updateConditionalSettings() {
        const actionSelect = document.getElementById('action');
        const action = actionSelect ? actionSelect.value : settings.action || DEFAULT_ACTION;
        mapSettingSlot.innerHTML = '';
        setupFloorRowSlot.innerHTML = '';
        
        if (action === 'specific-map') {
            const mapSetting = createGroupedMapDropdown(
                'mapId',
                t('mods.staminaOptimizer.mapLabel'),
                t('mods.staminaOptimizer.mapDescription'),
                settings.mapId || DEFAULT_MAP_ID
            );
            mapSetting.style.marginBottom = '0';
            mapSettingSlot.appendChild(mapSetting);
            
            const setupLabels = getAvailableSetupLabels();
            const setupOptions = setupLabels.map(label => ({ value: label, label: label }));
            const autoSetupLabel = t('mods.betterTasker.autoSetup');
            const safeAutoSetupLabel = typeof autoSetupLabel === 'string' && !autoSetupLabel.includes('.')
                ? autoSetupLabel
                : 'Auto-setup';
            setupOptions.unshift({ value: '', label: safeAutoSetupLabel });
            
            const setupSetting = createDropdownSetting(
                'setupLabel',
                t('mods.staminaOptimizer.setupLabelField'),
                t('mods.staminaOptimizer.setupDescription'),
                settings.setupLabel || DEFAULT_SETUP_LABEL,
                setupOptions
            );
            
            const floorOptions = [];
            for (let i = 0; i <= 15; i++) {
                floorOptions.push({ value: i, label: `Floor ${i}` });
            }
            const floorSetting = createDropdownSetting(
                'floor',
                t('mods.staminaOptimizer.floorLabel'),
                t('mods.staminaOptimizer.floorDescription'),
                settings.floor !== undefined ? settings.floor : DEFAULT_FLOOR,
                floorOptions
            );
            setupFloorRowSlot.appendChild(createSettingsRow(setupSetting, floorSetting));
            mapSettingSlot.style.display = 'flex';
            attachConditionalAutoSave(mapSettingSlot);
            attachConditionalAutoSave(setupFloorRowSlot);
        } else {
            mapSettingSlot.style.display = 'none';
        }
    }
    
    // Initial update
    updateConditionalSettings();
    
    // Update when action changes
    const actionSelect = actionSetting.querySelector('select');
    if (actionSelect) {
        actionSelect.addEventListener('change', () => {
            updateConditionalSettings();
            autoSaveSettings();
        });
    }
    
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
// 12. SETTINGS MANAGEMENT
// ============================================================================

const DEFAULT_SETTINGS = {
    maxStamina: DEFAULT_MAX_STAMINA,
    minStamina: DEFAULT_MIN_STAMINA,
    action: DEFAULT_ACTION,
    mapId: DEFAULT_MAP_ID,
    setupLabel: DEFAULT_SETUP_LABEL,
    floor: DEFAULT_FLOOR
};

// Load settings
function loadSettings() {
    const saved = localStorage.getItem(`${MOD_ID}Settings`);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            return { ...DEFAULT_SETTINGS, ...parsed };
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
        const actionSelect = document.getElementById('action');
        const mapIdSelect = document.getElementById('mapId');
        const setupLabelSelect = document.getElementById('setupLabel');
        const floorSelect = document.getElementById('floor');
        
        if (!updateStaminaThresholdValidation()) {
            return;
        }
        if (maxStaminaInput) {
            settings.maxStamina = parseInt(maxStaminaInput.value, 10);
        }
        if (minStaminaInput) {
            settings.minStamina = parseInt(minStaminaInput.value, 10);
        }
        
        if (actionSelect) {
            settings.action = actionSelect.value;
        }
        
        // Save conditional settings
        if (mapIdSelect) {
            settings.mapId = mapIdSelect.value;
        }
        
        if (setupLabelSelect) {
            settings.setupLabel = setupLabelSelect.value;
        }
        
        if (floorSelect) {
            settings.floor = parseInt(floorSelect.value);
        }
        
        saveSettings(settings);
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
        const actionSelect = document.getElementById('action');
        const mapIdSelect = document.getElementById('mapId');
        const setupLabelSelect = document.getElementById('setupLabel');
        const floorSelect = document.getElementById('floor');
        
        if (maxStaminaInput) {
            maxStaminaInput.value = settings.maxStamina || DEFAULT_MAX_STAMINA;
        }
        
        if (minStaminaInput) {
            minStaminaInput.value = settings.minStamina || DEFAULT_MIN_STAMINA;
        }
        
        if (actionSelect) {
            actionSelect.value = settings.action || DEFAULT_ACTION;
        }
        
        // Load conditional settings
        if (mapIdSelect) {
            mapIdSelect.value = settings.mapId || DEFAULT_MAP_ID;
        }
        
        if (setupLabelSelect) {
            setupLabelSelect.value = settings.setupLabel || DEFAULT_SETUP_LABEL;
        }
        
        if (floorSelect) {
            floorSelect.value = settings.floor !== undefined ? settings.floor : DEFAULT_FLOOR;
        }
        updateStaminaThresholdValidation();
    } catch (error) {
        console.error('[Stamina Optimizer] Error loading and applying settings:', error);
    }
}

// ============================================================================
// 13. AUTOMATION CONTROL
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
    syncModCoordinationState();
    updateButton();
    
    if (isAutomationEnabled) {
        console.log('[Stamina Optimizer] Automation enabled');
        startStaminaMonitoring();
        startAutoplayStateMonitoring();
        setupBestiaryRefillMonitoring();
    } else {
        console.log('[Stamina Optimizer] Automation disabled');
        stopStaminaMonitoring();
        stopAutoplayStateMonitoring();
        
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
// 14. INITIALIZATION
// ============================================================================

function init() {
    if (!api || !api.ui) {
        console.error('[Stamina Optimizer] API not available, cannot initialize');
        return;
    }
    if (window.ModCoordination) {
        window.ModCoordination.registerMod('Stamina Optimizer', {
            priority: 5,
            metadata: { description: 'Automatically manages stamina by starting/stopping gameplay' }
        });
    }
    loadAutomationState();
    syncModCoordinationState();
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
// 15. CLEANUP & EXPORTS
// ============================================================================

// Cleanup function — clears intervals, subscriptions, timers, and listeners
function cleanupStaminaOptimizer() {
    try {
        isLifecycleActive = false;

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

        if (window.staminaOptimizerRefillInterval) {
            clearInterval(window.staminaOptimizerRefillInterval);
            window.staminaOptimizerRefillInterval = null;
        }

        if (isCurrentlyActive && wasInitiatedByMod) {
            stopAutoplay();
        } else if (window.AutoplayManager?.hasControl('Stamina Optimizer')) {
            releaseControlAndResetState();
        }

        cleanupModal();

        if (windowMessageHandler) {
            window.removeEventListener('message', windowMessageHandler);
            windowMessageHandler = null;
        }

        isStartingAutoplay = false;
        isStoppingAutoplay = false;
        isActionPending = false;
        functionRetryAttempts = 0;

        delete window.__staminaOptimizerLoaded;
        delete window.staminaOptimizerLastBoostedMapsTrigger;
        delete window.staminaOptimizerIsActive;
        delete window.staminaOptimizerAutoSaveIndicator;

        if (api && api.ui && api.ui.removeButton) {
            api.ui.removeButton(BUTTON_ID);
        }

        if (window.ModCoordination) {
            window.ModCoordination.unregisterMod('Stamina Optimizer');
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

window.staminaOptimizerIsActive = () => isLifecycleActive && isCurrentlyActive;
