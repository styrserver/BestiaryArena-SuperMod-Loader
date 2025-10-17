// =======================
// Better Boosted Maps - A mod for Bestiary Arena
// =======================
'use strict';

console.log('[Better Boosted Maps] initializing...');

const MOD_ID = 'better-boosted-maps';
const TOGGLE_BUTTON_ID = `${MOD_ID}-toggle-button`;
const SETTINGS_BUTTON_ID = `${MOD_ID}-settings-button`;

// Timing constants
const NAVIGATION_DELAY = 1000;
const AUTOMATION_CHECK_DELAY = 1000;
const BESTIARY_INTEGRATION_DELAY = 500;
const BESTIARY_RETRY_DELAY = 2000;

const REGION_NAME_MAP = {
    'rook': 'Rookgaard',
    'carlin': 'Carlin',
    'folda': 'Folda',
    'abdendriel': 'Ab\'Dendriel',
    'kazordoon': 'Kazordoon',
    'venore': 'Venore'
};

const FALLBACK_RAID_ROOM_IDS = [
    'rkcent', 'crwasp', 'crcat', 'crghst4', 'fhole', 'fbox', 'fscave',
    'abmazet', 'aborca', 'aborcb', 'aborcc', 'ofbar', 'kpob', 'kpow',
    'vbank', 'vdhar'
];

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
    'Windborn Colossus Armor'
];

// Get raid room IDs dynamically (raids cannot be boosted)
function getRaidRoomIds() {
    try {
        const raidsState = globalThis.state.raids.get();
        console.log('[Better Boosted Maps] Full raids state:', raidsState);
        console.log('[Better Boosted Maps] Raids context:', raidsState?.context);
        
        const currentList = raidsState?.context?.list;
        console.log('[Better Boosted Maps] Dynamic raid list from state:', currentList);
        
        // If list is empty or undefined, use fallback
        if (!currentList || currentList.length === 0) {
            console.log('[Better Boosted Maps] Using fallback raid list');
            return FALLBACK_RAID_ROOM_IDS;
        }
        
        return currentList;
    } catch (error) {
        console.error('[Better Boosted Maps] Error getting raid list from state:', error);
        console.log('[Better Boosted Maps] Using fallback raid list');
        return FALLBACK_RAID_ROOM_IDS;
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
    }
};

// =======================
// 3. Utility Functions
// =======================

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
                hasActiveTaskOperations = betterTaskerState.taskOperationInProgress || 
                                         betterTaskerState.taskHuntingOngoing || 
                                         betterTaskerState.pendingTaskCompletion;
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

// Setup raid coordination monitoring
function setupRaidHunterCoordination() {
    if (modState.coordination.raidHunterInterval) {
        clearInterval(modState.coordination.raidHunterInterval);
    }
    
    // Check initial state immediately
    modState.coordination.isRaidHunterActive = isRaidHunterRaiding();
    if (modState.coordination.isRaidHunterActive) {
        console.log('[Better Boosted Maps] Raid Hunter already active at startup - will not start boosted maps');
        updateExposedState();
    }
    
    // Check raid status every 10 seconds
    modState.coordination.raidHunterInterval = setInterval(() => {
        const wasRaidHunterActive = modState.coordination.isRaidHunterActive;
        modState.coordination.isRaidHunterActive = isRaidHunterRaiding();
        
        // Log state changes (coordination happens silently)
        if (modState.coordination.isRaidHunterActive && !wasRaidHunterActive) {
            console.log('[Better Boosted Maps] Raid Hunter started - pausing boosted map automation');
            updateExposedState();
        } else if (!modState.coordination.isRaidHunterActive && wasRaidHunterActive) {
            console.log('[Better Boosted Maps] Raid Hunter stopped - checking if boosted maps can resume');
            updateExposedState();
        }
    }, 10000);
    
    console.log('[Better Boosted Maps] Raid Hunter coordination set up');
}

// Setup task coordination monitoring
function setupBetterTaskerCoordination() {
    if (modState.coordination.betterTaskerInterval) {
        clearInterval(modState.coordination.betterTaskerInterval);
    }
    
    // Check initial state immediately
    modState.coordination.isBetterTaskerActive = isBetterTaskerTasking();
    if (modState.coordination.isBetterTaskerActive) {
        console.log('[Better Boosted Maps] Better Tasker already active at startup - will not start boosted maps');
        updateExposedState();
    }
    
    // Check task status every 10 seconds
    modState.coordination.betterTaskerInterval = setInterval(() => {
        const wasBetterTaskerActive = modState.coordination.isBetterTaskerActive;
        modState.coordination.isBetterTaskerActive = isBetterTaskerTasking();
        
        // Log state changes (coordination happens silently)
        if (modState.coordination.isBetterTaskerActive && !wasBetterTaskerActive) {
            console.log('[Better Boosted Maps] Better Tasker started - pausing boosted map automation');
            updateExposedState();
        } else if (!modState.coordination.isBetterTaskerActive && wasBetterTaskerActive) {
            console.log('[Better Boosted Maps] Better Tasker stopped - checking if boosted maps can resume');
            updateExposedState();
        }
    }, 10000);
    
    console.log('[Better Boosted Maps] Better Tasker coordination set up');
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
// 4. DOM Functions
// =======================

function isInQuestLog(element) {
    // Check if we're inside a Quest Log widget
    let current = element;
    while (current && current !== document.body) {
        // Look for the widget header with "Quest Log" text
        const widgetTop = current.querySelector?.('.widget-top-text p');
        if (widgetTop && widgetTop.textContent === 'Quest Log') {
            return true;
        }
        // Also check if current element is the widget top
        if (current.classList?.contains('widget-top-text')) {
            const p = current.querySelector('p');
            if (p && p.textContent === 'Quest Log') {
                return true;
            }
        }
        current = current.parentElement;
    }
    return false;
}

function findBoostedMapSection() {
    const allSections = document.querySelectorAll('.frame-1.surface-regular');
    for (const section of allSections) {
        const titleElement = section.querySelector('p.text-whiteHighlight');
        if (titleElement && titleElement.textContent === 'Daily boosted map') {
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
    if (titleElement && titleElement.textContent === 'Daily boosted map') {
        const titleContainer = titleElement.parentElement;
        
        if (titleContainer) {
            // Find the map name element (span with the action-link class)
            const mapNameElement = titleContainer.querySelector('span.action-link');
            
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `display: flex; gap: 4px; margin-top: 4px;`;
            
            const toggleButton = createStyledButton(TOGGLE_BUTTON_ID, 'Disabled', 'red', toggleBoostedMaps);
            buttonContainer.appendChild(toggleButton);
            
            const settingsButton = createStyledButton(SETTINGS_BUTTON_ID, 'Settings', 'blue', openSettingsModal);
            buttonContainer.appendChild(settingsButton);
            
            // Insert after map name if found, otherwise after title
            if (mapNameElement) {
                mapNameElement.parentNode.insertBefore(buttonContainer, mapNameElement.nextSibling);
            } else {
                titleElement.parentNode.insertBefore(buttonContainer, titleElement.nextSibling);
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
        
        // Check and start boosted map farming after delay
        setTimeout(() => {
            checkAndStartBoostedMapFarming();
        }, 3000); // 3 second delay
    } else {
        console.log('[Better Boosted Maps] Disabled - cleaning up coordination');
        cleanupCoordination();
        
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
        toggleButton.textContent = 'Enabled';
        toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
    } else {
        toggleButton.textContent = 'Disabled';
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
        startDelay: 3,
        showNotification: true,
        maps: {},
        equipment: {}
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
        equipment: {}
    };
    
    const inputs = document.querySelectorAll('input[id^="boosted-maps-"]');
    
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
        }
    });
    
    localStorage.setItem('betterBoostedMapsSettings', JSON.stringify(settings));
    console.log('[Better Boosted Maps] Settings saved');
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
    title.textContent = 'Boosted Map Settings';
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
        'Start Delay (seconds)',
        'Delay before starting a run after detection',
        settings.startDelay,
        1, 30
    );
    settingsWrapper.appendChild(startDelayDiv);
    
    // Auto-refill stamina setting
    const autoRefillStaminaDiv = createCheckboxSetting(
        'boosted-maps-autoRefillStamina',
        'Auto-refill Stamina',
        'Automatically activates refill stamina',
        settings.autoRefillStamina
    );
    settingsWrapper.appendChild(autoRefillStaminaDiv);
    
    // Faster autoplay setting
    const fasterAutoplayDiv = createCheckboxSetting(
        'boosted-maps-fasterAutoplay',
        'Faster Autoplay',
        'Enable faster autoplay speed during runs',
        settings.fasterAutoplay
    );
    settingsWrapper.appendChild(fasterAutoplayDiv);
    
    // Enable autoplant setting
    const enableAutoplantDiv = createCheckboxSetting(
        'boosted-maps-enableAutoplant',
        'Enable Autoplant',
        'Enable Autoplant (Autoseller) during runs',
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
        mapsBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
        equipmentBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-regular active:frame-pressed-1-regular surface-regular gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
        document.getElementById('maps-tab').style.display = 'block';
        document.getElementById('equipment-tab').style.display = 'none';
    } else {
        mapsBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-regular active:frame-pressed-1-regular surface-regular gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
        equipmentBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
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
    title.textContent = 'Select Maps';
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
        noMaps.textContent = 'No maps available';
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
            maps.forEach(({ id, name }) => {
                const mapDiv = createCheckboxSetting(
                    `boosted-maps-map-${id}`,
                    name,
                    '',
                    settings.maps?.[id] !== false,
                    '14px'
                );
                scrollContainer.appendChild(mapDiv);
            });
        });
    }
    
    wrapper.appendChild(scrollContainer);
    
    // Add select all/none buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        margin-top: 10px;
    `;
    
    const selectAllBtn = createCustomStyledButton(
        'select-all-maps',
        'Select All',
        'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 text-whiteHighlight',
        'flex: 1;',
        () => {
            const checkboxes = scrollContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = true);
            saveSettings(); // Auto-save after selecting all
        }
    );
    
    const selectNoneBtn = createCustomStyledButton(
        'select-none-maps',
        'Select None',
        'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-red active:frame-pressed-1-red surface-red gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 text-whiteHighlight',
        'flex: 1;',
        () => {
            const checkboxes = scrollContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
            saveSettings(); // Auto-save after selecting none
        }
    );
    
    buttonContainer.appendChild(selectAllBtn);
    buttonContainer.appendChild(selectNoneBtn);
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
        // No region data - return all maps unsorted (excluding raids)
        const raidRoomIds = getRaidRoomIds();
        return {
            'All Maps': Object.entries(roomNames)
                .filter(([id]) => !raidRoomIds.includes(id))
                .map(([id, name]) => ({ id, name }))
                .sort((a, b) => a.name.localeCompare(b.name))
        };
    }
    
    const organizedMaps = {};
    
    // Organize maps by region
    const raidRoomIds = getRaidRoomIds();
    regions.forEach(region => {
        if (!region.rooms || !Array.isArray(region.rooms)) return;
        
        const regionMaps = [];
        
        region.rooms.forEach(room => {
            const roomCode = room.id;
            // Exclude raid maps (raids cannot be boosted)
            if (roomNames[roomCode] && !raidRoomIds.includes(roomCode)) {
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
    
    // Add any remaining maps not in a region
    const processedRoomCodes = new Set();
    Object.values(organizedMaps).forEach(regionMaps => {
        regionMaps.forEach(map => processedRoomCodes.add(map.id));
    });
    
    const remainingMaps = Object.entries(roomNames)
        .filter(([id]) => !processedRoomCodes.has(id) && !raidRoomIds.includes(id))
        .map(([id, name]) => ({ id, name }))
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
    title.textContent = 'Select Equipment';
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
    
    // Filter out excluded equipment
    const availableEquipment = allEquipment.filter(equipName => !EXCLUDED_EQUIPMENT.includes(equipName));
    
    if (availableEquipment.length === 0) {
        const noEquipment = document.createElement('div');
        noEquipment.textContent = 'No equipment available';
        noEquipment.className = 'pixel-font-14';
        noEquipment.style.color = '#888';
        scrollContainer.appendChild(noEquipment);
    } else {
        availableEquipment.forEach(equipName => {
            const equipId = equipName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const equipDiv = createCheckboxSetting(
                `boosted-maps-equipment-${equipId}`,
                equipName,
                '',
                settings.equipment?.[equipId] !== false,
                '14px'
            );
            scrollContainer.appendChild(equipDiv);
        });
    }
    
    wrapper.appendChild(scrollContainer);
    
    // Add select all/none buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        margin-top: 10px;
    `;
    
    const selectAllBtn = createCustomStyledButton(
        'select-all-equipment',
        'Select All',
        'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 text-whiteHighlight',
        'flex: 1;',
        () => {
            const checkboxes = scrollContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = true);
            saveSettings(); // Auto-save after selecting all
        }
    );
    
    const selectNoneBtn = createCustomStyledButton(
        'select-none-equipment',
        'Select None',
        'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-red active:frame-pressed-1-red surface-red gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 text-whiteHighlight',
        'flex: 1;',
        () => {
            const checkboxes = scrollContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
            saveSettings(); // Auto-save after selecting none
        }
    );
    
    buttonContainer.appendChild(selectAllBtn);
    buttonContainer.appendChild(selectNoneBtn);
    wrapper.appendChild(buttonContainer);
    
    return wrapper;
}

function createCheckboxSetting(id, label, description, checked = false, fontSize = null) {
    const settingDiv = document.createElement('div');
    settingDiv.style.cssText = `
        margin-bottom: 0px;
        display: flex;
        flex-direction: column;
        gap: 6px;
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
    checkbox.checked = checked;
    checkbox.style.cssText = `
        width: 16px;
        height: 16px;
        accent-color: #ffe066;
        cursor: pointer;
    `;
    checkbox.addEventListener('change', saveSettings);
    
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.className = 'pixel-font-16';
    labelElement.setAttribute('for', id);
    labelElement.style.cssText = `
        font-weight: bold;
        color: #fff;
        cursor: pointer;
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
                                title: 'Better Boosted Maps Settings',
                                width: MODAL_WIDTH,
                                height: MODAL_HEIGHT,
                                content: settingsContent,
                                buttons: [{ text: 'Close', primary: true }],
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
                            
                            // Set modal dimensions
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
                                }
                            }, 50);
                            
                            // Inject auto-save indicator into modal footer
                            setTimeout(() => {
                                const modalElement = document.querySelector('div[role="dialog"][data-state="open"]');
                                if (modalElement) {
                                    const footer = modalElement.querySelector('.flex.justify-end.gap-2');
                                    if (footer) {
                                        const autoSaveIndicator = document.createElement('div');
                                        autoSaveIndicator.textContent = '✓ Settings auto-save when changed';
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
        'Auto-setup': ['Auto-setup', 'Autoconfigurar'],
        'Start': ['Start', 'Iniciar']
    };
    const possibleTexts = textMappings[text] || [text];
    return buttons.find(button => possibleTexts.includes(button.textContent.trim()));
}

// Check stamina availability
async function checkStamina() {
    const startButton = findButtonByText('Start');
    if (!startButton || startButton.disabled) {
        console.log('[Better Boosted Maps] Start button not found or disabled - insufficient stamina');
        return { hasEnough: false };
    }
    console.log('[Better Boosted Maps] Start button enabled - can start');
    return { hasEnough: true };
}

// Cancel boosted map farming
function cancelBoostedMapFarming(reason = 'unknown') {
    console.log(`[Better Boosted Maps] Cancelling farming: ${reason}`);
    modState.farming.isActive = false;
    modState.farming.currentMapInfo = null;
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
async function startBoostedMapFarming() {
    try {
        const farmCheck = shouldFarmBoostedMap();
        if (!farmCheck.shouldFarm) {
            console.log('[Better Boosted Maps] Not farming:', farmCheck.reason);
            return;
        }
        
        // Check if automation is still enabled before starting
        if (!checkAutomationEnabled('before starting')) return;
        
        modState.farming.isActive = true;
        modState.farming.currentMapInfo = farmCheck;
        
        console.log(`[Better Boosted Maps] Starting boosted map farming: ${farmCheck.roomName}`);
        
        // Close any open modals
        console.log('[Better Boosted Maps] Waiting before navigation...');
        clearModalsWithEsc(1);
        await new Promise(resolve => setTimeout(resolve, NAVIGATION_DELAY));
        
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
            console.log('[Better Boosted Maps] Navigation completed');
        } catch (error) {
            console.error('[Better Boosted Maps] Error navigating to map:', error);
            cancelBoostedMapFarming('Failed to navigate to map');
            return;
        }
        
        // Check automation status after navigation
        if (!checkAutomationEnabled('after navigation')) return;
        
        // Find and click Auto-setup button
        console.log('[Better Boosted Maps] Looking for Auto-setup button...');
        const autoSetupButton = findButtonByText('Auto-setup');
        if (!autoSetupButton) {
            console.log('[Better Boosted Maps] Auto-setup button not found');
            cancelBoostedMapFarming('Auto-setup button not found');
            return;
        }
        
        console.log('[Better Boosted Maps] Clicking Auto-setup button...');
        autoSetupButton.click();
        await new Promise(resolve => setTimeout(resolve, AUTOMATION_CHECK_DELAY));
        
        // Check automation status after auto-setup
        if (!checkAutomationEnabled('after auto-setup')) return;
        
        // Load settings once for all configuration
        const settings = loadSettings();
        
        // Enable autoplay mode
        console.log('[Better Boosted Maps] Enabling autoplay mode...');
        globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
        await new Promise(resolve => setTimeout(resolve, AUTOMATION_CHECK_DELAY));
        
        // Check automation status after enabling autoplay
        if (!checkAutomationEnabled('after enabling autoplay')) return;
        
        // Enable integration features with retry logic
        if (settings.autoRefillStamina) {
            console.log('[Better Boosted Maps] Auto-refill stamina enabled - enabling Bestiary Automator...');
            setTimeout(() => {
                const success = enableBestiaryAutomatorStaminaRefill();
                if (!success) {
                    console.log('[Better Boosted Maps] First attempt failed, retrying with longer delay...');
                    setTimeout(() => {
                        enableBestiaryAutomatorStaminaRefill();
                    }, BESTIARY_RETRY_DELAY);
                }
            }, BESTIARY_INTEGRATION_DELAY);
        }
        
        if (settings.fasterAutoplay) {
            console.log('[Better Boosted Maps] Faster autoplay enabled - enabling Bestiary Automator...');
            setTimeout(() => {
                const success = enableBestiaryAutomatorFasterAutoplay();
                if (!success) {
                    console.log('[Better Boosted Maps] First attempt failed, retrying with longer delay...');
                    setTimeout(() => {
                        enableBestiaryAutomatorFasterAutoplay();
                    }, BESTIARY_RETRY_DELAY);
                }
            }, BESTIARY_INTEGRATION_DELAY);
        }
        
        if (settings.enableAutoplant) {
            console.log('[Better Boosted Maps] Autoplant enabled - enabling via Autoseller...');
            enableAutosellerDragonPlant();
        }
        
        // Check stamina before attempting to start
        console.log('[Better Boosted Maps] Checking stamina before starting...');
        const staminaCheck = await checkStamina();
        if (!staminaCheck.hasEnough) {
            console.log('[Better Boosted Maps] Insufficient stamina - cannot start');
            cancelBoostedMapFarming('Insufficient stamina');
            return;
        }
        console.log('[Better Boosted Maps] Stamina check passed');
        
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
        
        console.log('[Better Boosted Maps] Boosted map farming started successfully');
    } catch (error) {
        console.error('[Better Boosted Maps] Error starting boosted map farming:', error);
        cancelBoostedMapFarming('Error during startup');
    }
}

// Bestiary Automator integration
function enableBestiaryAutomatorStaminaRefill() {
    try {
        const automator = window.bestiaryAutomator || context?.exports;
        if (automator?.updateConfig) {
            automator.updateConfig({ autoRefillStamina: true });
            console.log('[Better Boosted Maps] Bestiary Automator stamina refill enabled');
            return true;
        } else {
            console.log('[Better Boosted Maps] Bestiary Automator not available for stamina refill');
            return false;
        }
    } catch (error) {
        console.error('[Better Boosted Maps] Error enabling stamina refill:', error);
        return false;
    }
}

function enableBestiaryAutomatorFasterAutoplay() {
    try {
        const automator = window.bestiaryAutomator || context?.exports;
        if (automator?.updateConfig) {
            automator.updateConfig({ fasterAutoplay: true });
            console.log('[Better Boosted Maps] Bestiary Automator faster autoplay enabled');
            return true;
        } else {
            console.log('[Better Boosted Maps] Bestiary Automator not available for faster autoplay');
            return false;
        }
    } catch (error) {
        console.error('[Better Boosted Maps] Error enabling faster autoplay:', error);
        return false;
    }
}

function enableAutosellerDragonPlant() {
    try {
        // Try to find Autoseller's exported function
        let autoseller = null;
        
        // Method 1: Check window scope
        if (window.autoseller && window.autoseller.enableDragonPlant) {
            autoseller = window.autoseller;
            console.log('[Better Boosted Maps] Found Autoseller via window object');
        }
        // Method 2: Check context exports
        else if (typeof context !== 'undefined' && context.exports && context.exports.enableDragonPlant) {
            autoseller = context.exports;
            console.log('[Better Boosted Maps] Found Autoseller via context exports');
        }
        // Method 3: Try mod loader
        else if (window.modLoader && window.modLoader.getModContext) {
            const autosellerContext = window.modLoader.getModContext('autoseller');
            if (autosellerContext && autosellerContext.exports && autosellerContext.exports.enableDragonPlant) {
                autoseller = autosellerContext.exports;
                console.log('[Better Boosted Maps] Found Autoseller via mod loader');
            }
        }
        
        if (autoseller) {
            console.log('[Better Boosted Maps] Enabling Dragon Plant via Autoseller...');
            autoseller.enableDragonPlant();
            console.log('[Better Boosted Maps] Dragon Plant enabled');
            return true;
        } else {
            console.log('[Better Boosted Maps] Autoseller not available - trying direct approach');
            // Fallback: try to access via global exports
            if (typeof exports !== 'undefined' && exports.enableDragonPlant) {
                exports.enableDragonPlant();
                console.log('[Better Boosted Maps] Dragon Plant enabled via exports');
                return true;
            }
            return false;
        }
    } catch (error) {
        console.error('[Better Boosted Maps] Error enabling Dragon Plant:', error);
        return false;
    }
}

// Check and start boosted map farming if conditions are met
function checkAndStartBoostedMapFarming() {
    // Don't start if already farming
    if (modState.farming.isActive) {
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
                startBoostedMapFarming();
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
                            node.querySelector?.('*')?.textContent?.includes('Daily boosted map');
                        
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

context.exports = {
    toggle: toggleBoostedMaps,
    cleanup: () => {
        console.log('[Better Boosted Maps] Cleaning up...');
        cleanupCoordination();
        
        if (modState.questLogObserver) {
            modState.questLogObserver.disconnect();
            modState.questLogObserver = null;
        }
        
        if (modState.activeModal) {
            cleanupModal();
        }
        
        // Reset farming state
        modState.farming.isActive = false;
        modState.farming.currentMapInfo = null;
        
        // Clean up exposed state
        if (window.betterBoostedMapsState) {
            delete window.betterBoostedMapsState;
        }
        
        console.log('[Better Boosted Maps] Cleanup completed');
    }
};
