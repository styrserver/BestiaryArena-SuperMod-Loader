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
    'Orclops Santa',
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

let betterBoostedMapsOpenContextMenu = null;

const BBM_CTX_COLOR_ACCENT = '#ffe066';
const BBM_CTX_COLOR_WHITE = '#ffffff';
const BBM_CTX_COLOR_DARK_GRAY = '#2a2a2a';
/** Match Better Boosted Maps modal tab panel / list inset styling */
const BBM_CTX_PANEL_BORDER = '#444444';
const BBM_CTX_INSET_BORDER = '#555555';
const BBM_CTX_PANEL_BG = 'rgba(0, 0, 0, 0.2)';
const BBM_CTX_INSET_BG = 'rgba(0, 0, 0, 0.3)';
/** Same repeating texture as the main Better Boosted Maps settings panel (not flat black). */
const BBM_CTX_PANEL_TEXTURE =
    "url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat";
/** Fixed shell height so the panel does not grow/shrink with content; inner areas scroll. */
const BBM_CTX_MENU_HEIGHT = 'min(400px, 85vh)';
/** Fixed shell width so adding rules / equipment does not widen the menu (viewport-capped). */
const BBM_CTX_MENU_WIDTH = 'min(440px, 94vw)';
/** In-game stat icons (same assets as equipment portrait / Cyclopedia). */
const BBM_RULE_STAT_ICON_URL = {
    ad: 'https://bestiaryarena.com/assets/icons/attackdamage.png',
    ap: 'https://bestiaryarena.com/assets/icons/abilitypower.png',
    hp: 'https://bestiaryarena.com/assets/icons/heal.png'
};

const BBM_CTX_FOOTER_BTN_FRAME =
    'width: 70px; height: 28px; border-radius: 3px; cursor: pointer; font-size: 12px; font-weight: bold;';

function bbmCtxStyleMenuSelectFull() {
    return `width: 100%; padding: 6px; background: ${BBM_CTX_COLOR_DARK_GRAY}; border: 1px solid ${BBM_CTX_COLOR_ACCENT}; color: ${BBM_CTX_COLOR_WHITE}; border-radius: 3px; font-size: 13px; cursor: pointer; box-sizing: border-box;`;
}

/** Inline selects in compact equipment rule rows (shared border / colors). */
function bbmCtxStyleMenuSelectCompact(maxWidth, fontSize, padding, extraCss) {
    return `width: auto; min-width: 0; max-width: ${maxWidth}; padding: ${padding}; background: ${BBM_CTX_COLOR_DARK_GRAY}; border: 1px solid ${BBM_CTX_COLOR_ACCENT}; color: ${BBM_CTX_COLOR_WHITE}; border-radius: 3px; font-size: ${fontSize}; cursor: pointer; box-sizing: border-box;${extraCss || ''}`;
}

function bbmCtxFillSelectSetupOptions(select, setupOptions, value) {
    setupOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });
    select.value = setupOptions.includes(value) ? value : setupOptions[0];
}

/**
 * @param {'clear' | 'cancel'} variant — cancel styling used for Close (dismiss only).
 */
function bbmCtxCreateContextMenuFooterButton(text, variant) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pixel-font-14';
    b.textContent = text;
    if (variant === 'clear') {
        b.style.cssText = `${BBM_CTX_FOOTER_BTN_FRAME} background: #1a1a1a; color: #888888; border: 1px solid #555;`;
        b.addEventListener('mouseenter', () => {
            b.style.backgroundColor = '#2a2a2a';
            b.style.color = '#ff6b6b';
        });
        b.addEventListener('mouseleave', () => {
            b.style.backgroundColor = '#1a1a1a';
            b.style.color = '#888888';
        });
    } else {
        b.style.cssText = `${BBM_CTX_FOOTER_BTN_FRAME} background: #1a1a1a; color: #888888; border: 1px solid #555;`;
        b.addEventListener('mouseenter', () => {
            b.style.backgroundColor = '#2a2a2a';
            b.style.color = '#4CAF50';
        });
        b.addEventListener('mouseleave', () => {
            b.style.backgroundColor = '#1a1a1a';
            b.style.color = '#888888';
        });
    }
    return b;
}

/** At most one equipment name; deterministic pick for legacy multi-entry rows. */
function bbmNormalizeEquipmentRuleNames(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    const uniq = [...new Set(arr.map(String))].filter(Boolean).sort((a, b) => a.localeCompare(b));
    return uniq.length ? [uniq[0]] : [];
}

function bbmClampEquipmentSetToSingleName(set) {
    if (!set || set.size <= 1) return;
    const pick = [...set].sort((a, b) => a.localeCompare(b))[0];
    set.clear();
    set.add(pick);
}

function bbmNormalizeEquipmentRuleStatsArray(input) {
    if (input == null) {
        return ['all'];
    }
    if (Array.isArray(input)) {
        const u = new Set();
        input.forEach(x => {
            const s = String(x).toLowerCase().trim();
            if (s === 'all') {
                u.add('all');
            } else if (['ad', 'ap', 'hp'].includes(s)) {
                u.add(s);
            }
        });
        if (u.has('all')) {
            return ['all'];
        }
        const out = [...u].sort((a, b) => a.localeCompare(b));
        return out.length ? out : ['all'];
    }
    if (typeof input === 'string') {
        const s = input.toLowerCase().trim();
        if (s === 'all') {
            return ['all'];
        }
        if (['ad', 'ap', 'hp'].includes(s)) {
            return [s];
        }
        return ['all'];
    }
    return ['all'];
}

/** Legacy single field or new array; used when loading rules. */
function bbmNormalizeEquipmentRuleStatsFromRule(rule) {
    if (rule && Array.isArray(rule.equipmentStats)) {
        return bbmNormalizeEquipmentRuleStatsArray(rule.equipmentStats);
    }
    if (rule && rule.equipmentStat != null) {
        return bbmNormalizeEquipmentRuleStatsArray(rule.equipmentStat);
    }
    return ['all'];
}

function bbmEquipmentRuleStatsKey(stats) {
    return bbmNormalizeEquipmentRuleStatsArray(stats).join('|');
}

/** True if two stat sets would match the same boost type for some equipment (used to block duplicate rules). */
function bbmEquipmentRuleStatsOverlap(a, b) {
    const na = bbmNormalizeEquipmentRuleStatsArray(a);
    const nb = bbmNormalizeEquipmentRuleStatsArray(b);
    if (na.includes('all') || nb.includes('all')) {
        return true;
    }
    const setA = new Set(na);
    for (let i = 0; i < nb.length; i++) {
        if (setA.has(nb[i])) {
            return true;
        }
    }
    return false;
}

function bbmGetEquipmentStatFromEquipId(equipId) {
    try {
        const equipment = globalThis.state?.utils?.getEquipment(equipId);
        const st = equipment?.metadata?.stat || equipment?.stats?.[0]?.type;
        if (st && ['hp', 'ad', 'ap'].includes(String(st).toLowerCase())) {
            return String(st).toLowerCase();
        }
    } catch (_) {}
    return null;
}

/** Rule matches if actual boost stat is included, or rule includes "all". */
function bbmRuleStatsMatchEquipment(ruleStatsNorm, actualStat) {
    const r = bbmNormalizeEquipmentRuleStatsArray(ruleStatsNorm);
    if (r.includes('all')) {
        return true;
    }
    return !!actualStat && r.includes(actualStat);
}

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
        // Use coordination system if available
        if (window.ModCoordination) {
            return window.ModCoordination.isModActive('Raid Hunter');
        }
        
        // Fallback to old method for backward compatibility
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

function bbmGetGameApi() {
    try {
        if (typeof globalThis.api !== 'undefined' && globalThis.api) {
            return globalThis.api;
        }
    } catch (_) {}
    return null;
}

function bbmBuildEquipmentNameToGameIdMap() {
    const map = new Map();
    const utils = globalThis.state?.utils;
    if (!utils) {
        return map;
    }
    for (let i = 1; ; i++) {
        try {
            const equipData = utils.getEquipment(i);
            if (equipData && equipData.metadata && equipData.metadata.name) {
                map.set(equipData.metadata.name.toLowerCase(), i);
            } else {
                break;
            }
        } catch {
            break;
        }
    }
    return map;
}

function bbmEquipmentSettingsSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

function bbmEquipmentRuleWarningInfo(equipmentName, settings) {
    if (EXCLUDED_EQUIPMENT.includes(equipmentName)) {
        return {
            warn: true,
            title: t('mods.betterBoostedMaps.ruleEquipmentExcludedTooltip')
        };
    }
    const slug = bbmEquipmentSettingsSlug(equipmentName);
    const enabled = settings.equipment?.[slug] !== false;
    if (!enabled) {
        return {
            warn: true,
            title: t('mods.betterBoostedMaps.ruleEquipmentDisabledTooltip')
        };
    }
    return { warn: false, title: '' };
}

function bbmCreateFallbackEquipmentSprite(container, spriteId) {
    try {
        if (spriteId) {
            const sizeSprite = document.createElement('div');
            sizeSprite.className = 'relative size-sprite';
            sizeSprite.style.overflow = 'visible';

            const spriteDiv = document.createElement('div');
            spriteDiv.className = `sprite item relative id-${spriteId}`;

            const viewportDiv = document.createElement('div');
            viewportDiv.className = 'viewport';
            viewportDiv.style.width = '32px';
            viewportDiv.style.height = '32px';

            const img = document.createElement('img');
            img.alt = spriteId;
            img.setAttribute('data-cropped', 'false');
            img.className = 'spritesheet';
            img.style.setProperty('--cropX', '0');
            img.style.setProperty('--cropY', '0');

            viewportDiv.appendChild(img);
            spriteDiv.appendChild(viewportDiv);
            sizeSprite.appendChild(spriteDiv);
            container.appendChild(sizeSprite);
        } else {
            const img = document.createElement('img');
            img.className = 'pixelated ml-auto';
            img.alt = 'equipment';
            img.width = 34;
            img.height = 34;
            img.style.width = '34px';
            img.style.height = '34px';
            img.style.minWidth = '34px';
            img.style.minHeight = '34px';
            img.style.maxWidth = '34px';
            img.style.maxHeight = '34px';
            img.style.objectFit = 'contain';
            img.src = '/assets/spells/smith.png';
            container.appendChild(img);
        }
    } catch (error) {
        const fallbackDiv = document.createElement('div');
        fallbackDiv.style.cssText = 'width: 32px; height: 32px; background: #666; border: 1px solid #999; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px;';
        fallbackDiv.textContent = '?';
        container.appendChild(fallbackDiv);
    }
}

function bbmCreateForgeStyleEquipmentIconButton(equipmentName, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'focus-style-visible active:opacity-70';
    btn.setAttribute('data-state', 'closed');
    btn.setAttribute('data-equipment', equipmentName);
    btn.style.width = '34px';
    btn.style.height = '34px';
    btn.style.minWidth = '34px';
    btn.style.minHeight = '34px';
    btn.style.maxWidth = '34px';
    btn.style.maxHeight = '34px';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.padding = '0';
    btn.style.margin = '0';
    btn.style.border = 'none';
    btn.style.background = 'none';
    btn.style.cursor = onClick ? 'pointer' : 'default';

    const nameMap = bbmBuildEquipmentNameToGameIdMap();
    const gameId = nameMap.get(equipmentName.toLowerCase());
    let spriteId = '';
    try {
        const equipData = gameId ? globalThis.state?.utils?.getEquipment(gameId) : null;
        if (equipData && equipData.metadata) {
            spriteId = equipData.metadata.spriteId || '';
        }
    } catch (e) {
        console.warn('[Better Boosted Maps] Error getting equipment data for icon:', e);
    }

    const apiRef = bbmGetGameApi();
    if (spriteId && typeof apiRef?.ui?.components?.createItemPortrait === 'function') {
        try {
            const itemPortrait = apiRef.ui.components.createItemPortrait({
                itemId: spriteId,
                stat: null,
                tier: null,
                onClick: () => {
                    if (onClick) {
                        onClick();
                    }
                }
            });
            btn.innerHTML = '';
            btn.appendChild(itemPortrait);
        } catch (e) {
            bbmCreateFallbackEquipmentSprite(btn, spriteId);
            if (onClick) {
                btn.addEventListener('click', () => onClick());
            }
        }
    } else {
        bbmCreateFallbackEquipmentSprite(btn, spriteId);
        if (onClick) {
            btn.addEventListener('click', () => onClick());
        }
    }

    btn.title = equipmentName;
    return btn;
}

function bbmGenerateEquipmentNameListForRules() {
    const list = [];
    const utils = globalThis.state?.utils;
    if (utils) {
        for (let i = 1; ; i++) {
            try {
                const equipData = utils.getEquipment(i);
                if (equipData && equipData.metadata && equipData.metadata.name) {
                    list.push(equipData.metadata.name);
                } else {
                    break;
                }
            } catch {
                break;
            }
        }
    }
    if (list.length > 0) {
        return list.sort((a, b) => a.localeCompare(b));
    }
    return [...(window.equipmentDatabase?.ALL_EQUIPMENT || [])].sort((a, b) => a.localeCompare(b));
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
        
        if (isRaidRoomId(boostedData.roomId)) {
            const rn = getRoomName(boostedData.roomId);
            console.log(`[Better Boosted Maps] Daily boost is on raid "${rn}" — not boostable, skipping`);
            return { shouldFarm: false, reason: `Map "${rn}" is a raid (not boostable)` };
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
            equipId: boostedData.equipId,
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
        // Use coordination system if available
        if (window.ModCoordination) {
            return window.ModCoordination.isModActive('Better Tasker');
        }
        
        // Fallback to old method for backward compatibility
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
    if (!modState.enabled) {
        return false;
    }
    
    // Use coordination system if available
    if (window.ModCoordination) {
        const canRun = window.ModCoordination.canModRun('Better Boosted Maps', [
            'Board Analyzer',
            'Manual Runner',
            'Raid Hunter',
            'Better Tasker'
            // Note: Stamina Optimizer check removed - it only blocks when enabling autoplay, not during navigation
        ]);
        if (!canRun) {
            console.log('[Better Boosted Maps] Cannot run - blocked by higher priority mod');
            return false;
        }
        
        return true;
    }
    
    // Check if blocking mods are active
    if (window.ModCoordination?.isModActive('Manual Runner')) {
        console.log('[Better Boosted Maps] Manual Runner running - skipping boosted maps');
        return false;
    }
    // Board Analyzer always blocks (highest priority system task)
    if (window.ModCoordination?.isModActive('Board Analyzer')) {
        console.log('[Better Boosted Maps] Board Analyzer running - skipping boosted maps');
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

// Old coordination functions removed - now using event-driven ModCoordination system

// =======================
// 3.3. Daily State Monitoring
// =======================

function setupDailyStateMonitoring() {
    // Unsubscribe if already monitoring
    if (modState.dailySubscription) {
        modState.dailySubscription.unsubscribe();
    }
    
    // Check if game state is available before subscribing
    if (!globalThis.state || !globalThis.state.daily) {
        console.log('[Better Boosted Maps] ⏳ Game state not ready, retrying daily state monitoring...');
        // Retry after a delay
        setTimeout(() => {
            setupDailyStateMonitoring();
        }, 2000);
        return;
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
    
    // Update coordination system state
    if (window.ModCoordination) {
        window.ModCoordination.updateModState('Better Boosted Maps', { enabled: modState.enabled });
    }
    
    if (modState.enabled) {
        console.log('[Better Boosted Maps] Enabled - setting up mod coordination');
        setupDailyStateMonitoring();
        
        // Check and start boosted map farming after delay
        setTimeout(() => {
            checkAndStartBoostedMapFarming();
        }, 3000); // 3 second delay
    } else {
        console.log('[Better Boosted Maps] Disabled - cleaning up coordination');
        
        // Update coordination system state
        if (window.ModCoordination) {
            window.ModCoordination.updateModState('Better Boosted Maps', { active: false });
        }
        
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
        toggleButton.textContent = t('mods.betterBoostedMaps.disabled');
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
        mapFloors: {},
        mapSettings: {}
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
    
    const previousStored = localStorage.getItem('betterBoostedMapsSettings');
    let previousMapSettings = {};
    if (previousStored) {
        try {
            const parsed = JSON.parse(previousStored);
            if (parsed.mapSettings && typeof parsed.mapSettings === 'object') {
                previousMapSettings = parsed.mapSettings;
            }
        } catch (_) {}
    }
    settings.mapSettings = previousMapSettings;
    
    localStorage.setItem('betterBoostedMapsSettings', JSON.stringify(settings));
    console.log('[Better Boosted Maps] Settings saved');
}

/**
 * Resolved autorefill, setup, and floor for a map (per-map overrides + optional equipment rules from context menu).
 * @param {string} roomId
 * @param {object} [settings]
 * @param {string|number|null} [equipId] - daily boost equipment id; when set, matching equipmentRules apply first
 * @returns {{ setupMethod: string, autoRefillStamina: boolean, floor: number }}
 */
function bbmClampRuleFloor(n) {
    const x = typeof n === 'number' && !isNaN(n) ? Math.floor(n) : 0;
    return Math.max(0, Math.min(15, x));
}

function getEffectiveMapAutomationSettings(roomId, settings, equipId) {
    const s = settings || loadSettings();
    const ov = (s.mapSettings && s.mapSettings[roomId]) || {};
    const mapFloors = s.mapFloors || {};
    const defaultFloor = mapFloors[roomId] !== undefined ? bbmClampRuleFloor(mapFloors[roomId]) : 0;
    let equipName = null;
    if (equipId != null && equipId !== '') {
        try {
            equipName = getEquipmentName(equipId);
        } catch (_) {}
    }
    const actualEquipStat = bbmGetEquipmentStatFromEquipId(equipId);
    if (equipName && Array.isArray(ov.equipmentRules)) {
        for (let i = 0; i < ov.equipmentRules.length; i++) {
            const rule = ov.equipmentRules[i];
            if (!rule || !Array.isArray(rule.equipmentNames) || rule.equipmentNames.length === 0) {
                continue;
            }
            const ruleEq = bbmNormalizeEquipmentRuleNames(rule.equipmentNames);
            if (!ruleEq.includes(equipName)) {
                continue;
            }
            const ruleStats = bbmNormalizeEquipmentRuleStatsFromRule(rule);
            if (!bbmRuleStatsMatchEquipment(ruleStats, actualEquipStat)) {
                continue;
            }
            const fallbackSetup = s.setupMethod || t('mods.betterBoostedMaps.autoSetup');
            const floor = rule.hasOwnProperty('floor')
                ? bbmClampRuleFloor(rule.floor)
                : defaultFloor;
            return {
                setupMethod: rule.setupMethod || fallbackSetup,
                autoRefillStamina: rule.hasOwnProperty('autoRefillStamina')
                    ? !!rule.autoRefillStamina
                    : !!s.autoRefillStamina,
                floor
            };
        }
    }
    const setupMethod = ov.setupMethod || s.setupMethod || t('mods.betterBoostedMaps.autoSetup');
    const autoRefillStamina = ov.hasOwnProperty('autoRefillStamina')
        ? ov.autoRefillStamina
        : !!s.autoRefillStamina;
    return { setupMethod, autoRefillStamina, floor: defaultFloor };
}

function hasMapCustomSettings(mapId) {
    try {
        const ms = (loadSettings().mapSettings || {})[mapId];
        if (!ms || typeof ms !== 'object') return false;
        if (Array.isArray(ms.equipmentRules) && ms.equipmentRules.length > 0) return true;
        return ms.hasOwnProperty('autoRefillStamina') || !!ms.setupMethod;
    } catch (error) {
        console.error('[Better Boosted Maps] Error checking map custom settings:', error);
        return false;
    }
}

function updateMapCustomSettingsIndicator(mapDiv, mapId) {
    const existingIndicator = mapDiv.querySelector('.bbm-map-custom-settings-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    if (!hasMapCustomSettings(mapId)) return;
    const indicator = document.createElement('span');
    indicator.className = 'bbm-map-custom-settings-indicator pixel-font-16';
    indicator.textContent = '⚙';
    indicator.title = 'Custom per-map or equipment-based settings';
    indicator.style.cssText = `
        font-size: 14px;
        color: #ff4444;
        margin-right: 4px;
        cursor: help;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    `;
    const checkboxContainer = mapDiv.querySelector('div[style*="display: flex"]');
    const label = mapDiv.querySelector('label');
    if (checkboxContainer && label && label.parentNode === checkboxContainer) {
        checkboxContainer.insertBefore(indicator, label.nextSibling);
    } else if (label && label.parentNode) {
        label.parentNode.insertBefore(indicator, label.nextSibling);
    } else {
        mapDiv.appendChild(indicator);
    }
}

function createBoostedMapContextMenu(mapId, mapName, x, y, onClose) {
    if (betterBoostedMapsOpenContextMenu && betterBoostedMapsOpenContextMenu.closeMenu) {
        betterBoostedMapsOpenContextMenu.closeMenu();
    }
    
    const settings = loadSettings();
    const mapSettings = settings.mapSettings || {};
    const mapSetting = mapSettings[mapId] || {};
    const currentAutoRefillStamina = mapSetting.hasOwnProperty('autoRefillStamina')
        ? mapSetting.autoRefillStamina
        : !!settings.autoRefillStamina;
    const defaultSetup = settings.setupMethod || t('mods.betterBoostedMaps.autoSetup');
    const currentSetupMethod = mapSetting.setupMethod || defaultSetup;
    
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '9998';
    overlay.style.backgroundColor = 'transparent';
    overlay.style.pointerEvents = 'auto';
    overlay.style.cursor = 'default';
    
    const menu = document.createElement('div');
    menu.setAttribute('data-bbm-context-menu', '1');
    menu.style.position = 'fixed';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.zIndex = '9999';
    menu.style.width = BBM_CTX_MENU_WIDTH;
    menu.style.minWidth = BBM_CTX_MENU_WIDTH;
    menu.style.maxWidth = BBM_CTX_MENU_WIDTH;
    menu.style.height = BBM_CTX_MENU_HEIGHT;
    menu.style.minHeight = BBM_CTX_MENU_HEIGHT;
    menu.style.maxHeight = BBM_CTX_MENU_HEIGHT;
    menu.style.boxSizing = 'border-box';
    menu.style.display = 'flex';
    menu.style.flexDirection = 'column';
    menu.style.overflow = 'hidden';
    menu.style.background = BBM_CTX_PANEL_TEXTURE;
    menu.style.color = '#fff';
    menu.style.border = `1px solid ${BBM_CTX_PANEL_BORDER}`;
    menu.style.borderRadius = '5px';
    menu.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.45)';
    
    const menuShell = document.createElement('div');
    menuShell.style.cssText = `
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        flex: 1 1 0%;
        min-height: 0;
        overflow: hidden;
        padding: 10px;
        box-sizing: border-box;
        gap: 20px;
    `;
    
    const titleEl = document.createElement('h3');
    titleEl.className = 'pixel-font-16';
    titleEl.textContent = mapName;
    titleEl.style.cssText = `
        margin: 0 0 0 0;
        color: ${BBM_CTX_COLOR_ACCENT};
        font-weight: bold;
        text-align: center;
        flex-shrink: 0;
    `;
    
    const contentPanel = document.createElement('div');
    contentPanel.setAttribute('data-bbm-ctx-tab-content', '1');
    contentPanel.style.cssText = `
        flex: 1 1 0%;
        min-height: 0;
        overflow: hidden;
        border: 1px solid ${BBM_CTX_PANEL_BORDER};
        border-radius: 5px;
        background: ${BBM_CTX_PANEL_BG};
        padding: 10px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 10px;
    `;
    
    const setupOptions = getAvailableSetupOptions();
    const equipmentNamesList = bbmGenerateEquipmentNameListForRules();
    const equipSectionLabel = document.createElement('div');
    equipSectionLabel.className = 'pixel-font-14';
    equipSectionLabel.textContent = t('mods.betterBoostedMaps.contextMenuIfEquipment');
    equipSectionLabel.style.cssText = `
        color: ${BBM_CTX_COLOR_ACCENT};
        font-size: 12px;
        font-weight: bold;
        margin: 0 0 6px 0;
        flex-shrink: 0;
    `;
    
    const rulesWrapper = document.createElement('div');
    rulesWrapper.setAttribute('data-bbm-ctx-rules-scroll', '1');
    rulesWrapper.style.cssText = `
        flex: 1 1 0%;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        margin: 0;
        padding: 10px;
        box-sizing: border-box;
        border: 1px solid ${BBM_CTX_INSET_BORDER};
        border-radius: 3px;
        background: ${BBM_CTX_INSET_BG};
    `;
    const equipmentDropdownClosers = [];
    let persistMapContextMenuSettings = () => {};
    
    function populateRuleSetupSelect(sel, value) {
        sel.className = 'pixel-font-14';
        sel.setAttribute('data-bbm-rule-setup', '1');
        sel.style.cssText = bbmCtxStyleMenuSelectCompact('100%', '9px', '3px 4px', '');
        bbmCtxFillSelectSetupOptions(sel, setupOptions, value);
    }
    
    function createRuleFloorSelect(initialValue) {
        const sel = document.createElement('select');
        sel.className = 'pixel-font-14';
        sel.setAttribute('data-bbm-rule-floor', '1');
        sel.style.cssText = bbmCtxStyleMenuSelectCompact('100%', '9px', '3px 3px', ' flex-shrink: 0;');
        for (let i = 0; i <= 15; i++) {
            const optionElement = document.createElement('option');
            optionElement.value = String(i);
            optionElement.textContent = `${t('mods.betterBoostedMaps.floor')} ${i}`;
            sel.appendChild(optionElement);
        }
        sel.value = String(bbmClampRuleFloor(initialValue));
        return sel;
    }
    
    function applyRuleStaminaToggleStyle(btn, on) {
        btn.style.minWidth = '0';
        btn.style.maxWidth = '92px';
        btn.style.padding = '2px 6px';
        btn.style.fontSize = '9px';
        btn.style.fontWeight = 'bold';
        btn.style.borderRadius = '3px';
        btn.style.boxSizing = 'border-box';
        btn.style.flexShrink = '0';
        btn.style.lineHeight = '1.15';
        btn.style.whiteSpace = 'nowrap';
        btn.style.overflow = 'hidden';
        btn.style.textOverflow = 'ellipsis';
        if (on) {
            btn.style.background = '#1b5e20';
            btn.style.color = '#c8e6c9';
            btn.style.border = '1px solid #66bb6a';
        } else {
            btn.style.background = '#7f1d1d';
            btn.style.color = '#fecaca';
            btn.style.border = '1px solid #f87171';
        }
    }
    
    function fillRuleEquipmentTriggerSummary(host, namesSet, opts) {
        const showChevron = !!(opts && opts.showChevron);
        const compact = !!(opts && opts.compact);
        const singleEquipmentRule = !!(opts && opts.singleEquipmentRule);
        host.innerHTML = '';
        let names = Array.from(namesSet).sort((a, b) => a.localeCompare(b));
        if (singleEquipmentRule) {
            names = names.slice(0, 1);
        }
        if (names.length === 0) {
            const ph = document.createElement('span');
            ph.className = 'pixel-font-14';
            ph.textContent = compact
                ? t('mods.betterBoostedMaps.ruleEquipmentDropdownShortPlaceholder')
                : t('mods.betterBoostedMaps.ruleEquipmentDropdownPlaceholder');
            ph.title = t('mods.betterBoostedMaps.ruleEquipmentDropdownPlaceholder');
            ph.style.cssText = compact
                ? 'color: #888; font-size: 9px; font-style: italic; flex: 1; min-width: 0; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
                : 'color: #888; font-size: 11px; font-style: italic; flex: 1; text-align: left;';
            host.appendChild(ph);
        } else {
            const iconStrip = document.createElement('div');
            iconStrip.style.cssText = 'display: flex; flex-direction: row; align-items: center; gap: 2px; flex: 1; min-width: 0; overflow: hidden;';
            const maxIcons = compact || singleEquipmentRule ? 1 : 4;
            const holderPx = 34;
            names.slice(0, maxIcons).forEach(name => {
                const holder = document.createElement('span');
                holder.style.cssText = `display: inline-flex; width: ${holderPx}px; height: ${holderPx}px; flex-shrink: 0; align-items: center; justify-content: center; overflow: visible;`;
                const ib = bbmCreateForgeStyleEquipmentIconButton(name, null);
                ib.style.pointerEvents = 'none';
                holder.appendChild(ib);
                iconStrip.appendChild(holder);
            });
            if (names.length > maxIcons) {
                const more = document.createElement('span');
                more.className = 'pixel-font-14';
                more.textContent = `+${names.length - maxIcons}`;
                more.style.cssText = 'font-size: 9px; color: #aaa; flex-shrink: 0; padding: 0 1px;';
                iconStrip.appendChild(more);
            }
            host.appendChild(iconStrip);
        }
        if (showChevron) {
            const chev = document.createElement('span');
            chev.textContent = '▾';
            chev.style.cssText = 'flex-shrink: 0; font-size: 10px; line-height: 1; color: rgba(255,255,255,0.65); margin-left: 2px;';
            host.appendChild(chev);
        }
    }
    
    const BBM_EQUIP_RULE_DD_Z_OPEN = 100120;
    const BBM_STAT_RULE_DD_Z_OPEN = 100131;
    
    function createRuleEquipmentIconDropdown(draft, onNamesMutated, opts) {
        opts = opts || {};
        const wrap = document.createElement('div');
        wrap.style.cssText = `
            position: relative;
            flex: 0 0 72px;
            width: 72px;
            min-width: 72px;
            max-width: 72px;
            z-index: 1;
        `;
        
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.style.cssText = `
            width: 100%;
            max-width: 72px;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 2px;
            padding: 0 3px;
            min-height: 36px;
            height: 36px;
            box-sizing: border-box;
            background: ${BBM_CTX_COLOR_DARK_GRAY};
            border: 1px solid ${BBM_CTX_COLOR_ACCENT};
            color: ${BBM_CTX_COLOR_WHITE};
            border-radius: 3px;
            cursor: pointer;
            font-family: inherit;
        `;
        
        function syncTrigger() {
            bbmClampEquipmentSetToSingleName(draft.names);
            fillRuleEquipmentTriggerSummary(trigger, draft.names, {
                showChevron: true,
                compact: true,
                singleEquipmentRule: true
            });
        }
        syncTrigger();
        
        const equipmentRuleRowPx = 34;
        const equipmentRuleVisibleRows = 5;
        const equipmentListViewportPx = equipmentRuleRowPx * equipmentRuleVisibleRows;
        const equipmentRulePanelSearchBandPx = 40;
        const equipmentPanelMinWidthPx = 92;
        
        const panel = document.createElement('div');
        panel.setAttribute('data-bbm-equip-dropdown-panel', '1');
        panel.style.cssText = `
            display: none;
            position: absolute;
            left: 0;
            right: 0;
            top: calc(100% + 4px);
            max-height: ${equipmentListViewportPx + equipmentRulePanelSearchBandPx}px;
            overflow: hidden;
            flex-direction: column;
            align-items: stretch;
            background: rgba(22, 22, 28, 0.98);
            border: 1px solid ${BBM_CTX_COLOR_ACCENT};
            border-radius: 4px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.55);
            z-index: 1;
        `;
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = t('mods.betterBoostedMaps.contextMenuSearchEquipment');
        searchInput.className = 'pixel-font-14';
        searchInput.style.cssText = `
            width: 100%;
            box-sizing: border-box;
            padding: 3px 5px;
            font-size: 9px;
            background: rgba(0,0,0,0.45);
            border: none;
            border-bottom: 1px solid rgba(255,255,255,0.12);
            color: ${BBM_CTX_COLOR_WHITE};
            border-radius: 4px 4px 0 0;
            flex-shrink: 0;
        `;
        panel.appendChild(searchInput);
        
        const listScroll = document.createElement('div');
        listScroll.style.cssText = `
            height: ${equipmentListViewportPx}px;
            min-height: ${equipmentListViewportPx}px;
            max-height: ${equipmentListViewportPx}px;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 4px 0;
            box-sizing: border-box;
            flex: 0 0 auto;
            min-width: 0;
        `;
        panel.appendChild(listScroll);
        
        let open = false;
        let docClose = null;
        let panelScrollSync = null;
        
        function positionPanelFixedToTrigger() {
            const r = trigger.getBoundingClientRect();
            const margin = 8;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const panelH = equipmentListViewportPx + equipmentRulePanelSearchBandPx;
            let left = r.left;
            let width = Math.max(r.width, equipmentPanelMinWidthPx);
            if (left + width > vw - margin) {
                left = Math.max(margin, vw - width - margin);
            }
            left = Math.max(margin, left);
            let topPx = r.bottom + 4;
            if (topPx + panelH > vh - margin) {
                const above = r.top - panelH - 4;
                topPx = above >= margin ? above : Math.max(margin, vh - panelH - margin);
            }
            panel.style.position = 'fixed';
            panel.style.left = `${Math.round(left)}px`;
            panel.style.top = `${Math.round(topPx)}px`;
            panel.style.width = `${Math.round(width)}px`;
            panel.style.right = 'auto';
            panel.style.zIndex = '100130';
        }
        
        function bindPanelScrollSync() {
            unbindPanelScrollSync();
            panelScrollSync = () => {
                if (open) {
                    positionPanelFixedToTrigger();
                }
            };
            rulesWrapper.addEventListener('scroll', panelScrollSync, { passive: true });
            window.addEventListener('scroll', panelScrollSync, true);
            window.addEventListener('resize', panelScrollSync, { passive: true });
        }
        
        function unbindPanelScrollSync() {
            if (!panelScrollSync) {
                return;
            }
            rulesWrapper.removeEventListener('scroll', panelScrollSync);
            window.removeEventListener('scroll', panelScrollSync, true);
            window.removeEventListener('resize', panelScrollSync);
            panelScrollSync = null;
        }
        
        function closePanel() {
            open = false;
            unbindPanelScrollSync();
            if (docClose) {
                document.removeEventListener('mousedown', docClose, true);
                document.removeEventListener('click', docClose, true);
                document.removeEventListener('pointerdown', docClose, true);
                docClose = null;
            }
            panel.style.display = 'none';
            wrap.style.zIndex = '1';
            if (panel.parentNode === document.body) {
                try {
                    if (wrap.isConnected) {
                        wrap.appendChild(panel);
                    } else {
                        panel.remove();
                    }
                } catch (_) {
                    panel.remove();
                }
            }
            panel.style.position = '';
            panel.style.left = '';
            panel.style.top = '';
            panel.style.width = '';
            panel.style.right = '';
            panel.style.zIndex = '';
        }
        
        function paintList() {
            listScroll.innerHTML = '';
            let purgedExcluded = false;
            [...draft.names].forEach(n => {
                if (EXCLUDED_EQUIPMENT.includes(n)) {
                    draft.names.delete(n);
                    purgedExcluded = true;
                }
            });
            if (purgedExcluded) {
                syncTrigger();
                queueMicrotask(() => {
                    if (typeof onNamesMutated === 'function') {
                        onNamesMutated();
                    }
                });
            }
            const q = searchInput.value.toLowerCase().trim();
            const filtered = q
                ? equipmentNamesList.filter(n => n.toLowerCase().includes(q))
                : equipmentNamesList;
            if (!filtered.length) {
                const empty = document.createElement('div');
                empty.className = 'pixel-font-14';
                empty.style.cssText = 'color: #888; font-size: 11px; text-align: center; padding: 12px 8px;';
                empty.textContent = t('mods.betterBoostedMaps.noEquipmentAvailable');
                listScroll.appendChild(empty);
                return;
            }
            filtered.forEach(eqName => {
                const excluded = EXCLUDED_EQUIPMENT.includes(eqName);
                const claimedHere = draft.names.has(eqName);
                const blockedClaim =
                    typeof opts.claimedElsewhere === 'function'
                    && opts.claimedElsewhere(eqName)
                    && !claimedHere;
                const blocked = blockedClaim || excluded;
                
                const rowEl = document.createElement('div');
                const wInfoRow = bbmEquipmentRuleWarningInfo(eqName, settings);
                rowEl.title = excluded
                    ? wInfoRow.title
                    : blockedClaim && typeof opts.claimedElsewhereTitle === 'function'
                      ? opts.claimedElsewhereTitle()
                      : eqName;
                rowEl.style.cssText = `
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: flex-start;
                    gap: 2px;
                    padding: 1px 3px;
                    min-height: ${equipmentRuleRowPx}px;
                    box-sizing: border-box;
                    cursor: ${blocked ? 'not-allowed' : 'pointer'};
                    opacity: ${blocked ? '0.42' : '1'};
                `;
                
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = claimedHere;
                cb.disabled = blocked;
                cb.style.cssText = `width: 12px; height: 12px; accent-color: #8BC34A; cursor: ${
                    blocked ? 'not-allowed' : 'pointer'
                }; flex-shrink: 0;`;
                cb.addEventListener('click', e => e.stopPropagation());
                cb.addEventListener('change', () => {
                    if (blocked) return;
                    if (cb.checked) {
                        draft.names.clear();
                        draft.names.add(eqName);
                    } else {
                        draft.names.delete(eqName);
                    }
                    paintList();
                    syncTrigger();
                    if (typeof onNamesMutated === 'function') {
                        onNamesMutated();
                    }
                });
                
                const iconHold = document.createElement('div');
                iconHold.style.cssText = 'width: 34px; height: 34px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: visible;';
                const iconBtn = bbmCreateForgeStyleEquipmentIconButton(eqName, null);
                iconBtn.style.pointerEvents = 'none';
                const wInfo = wInfoRow;
                if (wInfo.warn) {
                    iconBtn.style.boxShadow = draft.names.has(eqName)
                        ? '0 0 0 2px #8BC34A, 0 0 0 4px rgba(255, 193, 7, 0.45)'
                        : '0 0 0 2px rgba(255, 193, 7, 0.65)';
                } else if (draft.names.has(eqName)) {
                    iconBtn.style.boxShadow = '0 0 0 2px #8BC34A';
                }
                iconHold.appendChild(iconBtn);
                
                rowEl.appendChild(cb);
                rowEl.appendChild(iconHold);
                if (wInfo.warn) {
                    const warn = document.createElement('span');
                    warn.textContent = '⚠';
                    warn.style.cssText = 'font-size: 11px; cursor: help; color: #ffc107; flex-shrink: 0;';
                    warn.title = wInfo.title;
                    rowEl.appendChild(warn);
                }
                
                if (!blocked) {
                    rowEl.addEventListener('mouseenter', () => {
                        rowEl.style.background = 'rgba(255,255,255,0.07)';
                    });
                    rowEl.addEventListener('mouseleave', () => {
                        rowEl.style.background = 'transparent';
                    });
                    rowEl.addEventListener('click', () => {
                        if (draft.names.has(eqName) && draft.names.size <= 1) {
                            draft.names.clear();
                        } else {
                            draft.names.clear();
                            draft.names.add(eqName);
                        }
                        paintList();
                        syncTrigger();
                        if (typeof onNamesMutated === 'function') {
                            onNamesMutated();
                        }
                    });
                } else {
                    rowEl.addEventListener('click', e => {
                        e.stopPropagation();
                        e.preventDefault();
                    });
                }
                
                listScroll.appendChild(rowEl);
            });
        }
        
        searchInput.addEventListener('input', () => paintList());
        searchInput.addEventListener('click', e => e.stopPropagation());
        panel.addEventListener('mousedown', e => e.stopPropagation());
        panel.addEventListener('click', e => e.stopPropagation());
        panel.addEventListener('pointerdown', e => e.stopPropagation());
        
        trigger.addEventListener('click', e => {
            e.stopPropagation();
            if (open) {
                closePanel();
            } else {
                equipmentDropdownClosers.forEach(fn => {
                    if (fn !== closePanel) {
                        try {
                            fn();
                        } catch (_) {}
                    }
                });
                open = true;
                wrap.style.zIndex = String(BBM_EQUIP_RULE_DD_Z_OPEN);
                document.body.appendChild(panel);
                positionPanelFixedToTrigger();
                panel.style.display = 'flex';
                paintList();
                bindPanelScrollSync();
                docClose = ev => {
                    if (!wrap.isConnected) {
                        closePanel();
                        return;
                    }
                    const t = ev.target;
                    if (t && (t === panel || panel.contains(t) || t === wrap || wrap.contains(t))) {
                        return;
                    }
                    closePanel();
                };
                document.addEventListener('pointerdown', docClose, true);
                document.addEventListener('mousedown', docClose, true);
                document.addEventListener('click', docClose, true);
            }
        });
        
        wrap.appendChild(trigger);
        wrap.appendChild(panel);
        
        equipmentDropdownClosers.push(closePanel);
        
        function refreshListIfOpen() {
            if (open) {
                paintList();
            }
        }
        
        return { wrap, syncTrigger, closePanel, refreshListIfOpen };
    }
    
    function bbmCloseRuleRowEquipmentDropdown(r) {
        if (typeof r._bbmStatDdClose === 'function') {
            try {
                r._bbmStatDdClose();
            } catch (_) {}
        }
        if (typeof r._bbmEquipmentDdClose === 'function') {
            try {
                r._bbmEquipmentDdClose();
            } catch (_) {}
        }
    }
    
    function bbmRefreshAllRuleEquipmentDropdownLists() {
        rulesWrapper.querySelectorAll('.bbm-equipment-rule').forEach(r => {
            if (typeof r._bbmEquipmentDdRefreshList === 'function') {
                r._bbmEquipmentDdRefreshList();
            }
            if (typeof r._bbmStatDdRefreshSummary === 'function') {
                r._bbmStatDdRefreshSummary();
            }
        });
    }
    
    function dedupeLoadedEquipmentRulesAcrossRows(skipPersist) {
        let anyChange = false;
        let rows = [...rulesWrapper.querySelectorAll('.bbm-equipment-rule')];
        rows.forEach(r => {
            if (!r.isConnected) return;
            const o = r._bbmEqNamesSet;
            if (!o || o.size === 0) return;
            if (o.size > 1) {
                anyChange = true;
                bbmClampEquipmentSetToSingleName(o);
                r._bbmRulePayload.equipmentNames = Array.from(o);
                if (r._bbmEquipmentDdSync) r._bbmEquipmentDdSync();
            }
        });
        const seen = new Set();
        rows = [...rulesWrapper.querySelectorAll('.bbm-equipment-rule')];
        rows.forEach(r => {
            if (!r.isConnected) return;
            const o = r._bbmEqNamesSet;
            if (!o || o.size === 0) return;
            const sole = [...o][0];
            const stKey = bbmEquipmentRuleStatsKey(r._bbmRulePayload?.equipmentStats);
            const dedupeKey = `${sole}\u0000${stKey}`;
            if (seen.has(dedupeKey)) {
                anyChange = true;
                bbmCloseRuleRowEquipmentDropdown(r);
                r.remove();
                return;
            }
            seen.add(dedupeKey);
        });
        if (anyChange) {
            bbmRefreshAllRuleEquipmentDropdownLists();
            bbmRefreshRuleRowHeaderLabels();
            if (!skipPersist) {
                persistMapContextMenuSettings();
            }
        }
    }
    
    function onRuleEquipmentNamesMutated(row) {
        const set = row._bbmEqNamesSet;
        if (!set || set.size === 0) {
            bbmCloseRuleRowEquipmentDropdown(row);
            if (row._bbmRulePayload) {
                row._bbmRulePayload.equipmentNames = [];
            }
            if (row._bbmEquipmentDdSync) {
                row._bbmEquipmentDdSync();
            }
            bbmRefreshAllRuleEquipmentDropdownLists();
            persistMapContextMenuSettings();
            return;
        }
        bbmClampEquipmentSetToSingleName(set);
        row._bbmRulePayload.equipmentNames = Array.from(set).sort((a, b) => a.localeCompare(b));
        if (row._bbmEquipmentDdSync) row._bbmEquipmentDdSync();
        bbmRefreshAllRuleEquipmentDropdownLists();
        persistMapContextMenuSettings();
    }
    
    function bbmGetRuleIndexForRow(row) {
        const rows = [...rulesWrapper.querySelectorAll('.bbm-equipment-rule')];
        const idx = rows.indexOf(row);
        if (idx >= 0) {
            return idx + 1;
        }
        return rows.length + 1;
    }
    
    function bbmRefreshRuleRowHeaderLabels() {
        rulesWrapper.querySelectorAll('.bbm-equipment-rule').forEach((r, i) => {
            const el = r.querySelector('.bbm-rule-title');
            if (el) {
                el.textContent = tReplace('mods.betterBoostedMaps.contextMenuRuleLabel', { n: String(i + 1) });
            }
        });
    }
    
    function renderRuleRow(body, row) {
        const p = row._bbmRulePayload;
        const normalized = bbmNormalizeEquipmentRuleNames(p.equipmentNames || []);
        p.equipmentNames = [...normalized];
        row._bbmEqNamesSet = new Set(normalized);
        
        const bar = document.createElement('div');
        bar.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 5px;
            width: 100%;
            min-width: 0;
        `;
        
        const headerRow = document.createElement('div');
        headerRow.style.cssText = `
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            width: 100%;
            min-width: 0;
        `;
        
        const ifEl = document.createElement('span');
        ifEl.className = 'pixel-font-14 bbm-rule-title';
        ifEl.textContent = tReplace('mods.betterBoostedMaps.contextMenuRuleLabel', { n: String(bbmGetRuleIndexForRow(row)) });
        ifEl.style.cssText = `
            color: ${BBM_CTX_COLOR_ACCENT};
            font-weight: bold;
            font-size: 11px;
            flex-shrink: 0;
        `;
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'pixel-font-14';
        removeBtn.setAttribute('aria-label', t('mods.betterBoostedMaps.contextMenuRemoveRule'));
        removeBtn.title = t('mods.betterBoostedMaps.contextMenuRemoveRule');
        removeBtn.textContent = '\u00D7';
        removeBtn.style.cssText = `
            flex-shrink: 0;
            width: 26px;
            height: 26px;
            min-width: 26px;
            padding: 0;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            line-height: 1;
            cursor: pointer;
            border-radius: 3px;
            border: 1px solid rgba(200, 72, 72, 0.75);
            background: rgba(55, 18, 18, 0.95);
            color: #ff5c5c;
            font-weight: bold;
        `;
        removeBtn.addEventListener('mouseenter', () => {
            removeBtn.style.background = 'rgba(85, 28, 28, 0.98)';
            removeBtn.style.borderColor = 'rgba(255, 120, 120, 0.85)';
        });
        removeBtn.addEventListener('mouseleave', () => {
            removeBtn.style.background = 'rgba(55, 18, 18, 0.95)';
            removeBtn.style.borderColor = 'rgba(200, 72, 72, 0.75)';
        });
        removeBtn.addEventListener('click', () => {
            bbmCloseRuleRowEquipmentDropdown(row);
            row.remove();
            bbmRefreshRuleRowHeaderLabels();
            persistMapContextMenuSettings();
        });
        
        headerRow.appendChild(ifEl);
        headerRow.appendChild(removeBtn);
        bar.appendChild(headerRow);
        
        const strip = document.createElement('div');
        strip.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 3px;
            flex: 1 1 auto;
            min-width: 0;
            width: 100%;
        `;
        
        const equipmentDd = createRuleEquipmentIconDropdown(
            { names: row._bbmEqNamesSet },
            () => onRuleEquipmentNamesMutated(row),
            {
                claimedElsewhere(eqName) {
                    const myStats = p.equipmentStats;
                    const all = rulesWrapper.querySelectorAll('.bbm-equipment-rule');
                    for (let i = 0; i < all.length; i++) {
                        const r = all[i];
                        if (r === row) continue;
                        if (!r._bbmEqNamesSet || !r._bbmEqNamesSet.has(eqName)) continue;
                        if (bbmEquipmentRuleStatsOverlap(myStats, r._bbmRulePayload?.equipmentStats)) {
                            return true;
                        }
                    }
                    return false;
                },
                claimedElsewhereTitle() {
                    return t('mods.betterBoostedMaps.ruleEquipmentClaimedElsewhereTooltip');
                }
            }
        );
        row._bbmEquipmentDdSync = equipmentDd.syncTrigger;
        row._bbmEquipmentDdRefreshList = equipmentDd.refreshListIfOpen;
        row._bbmEquipmentDdClose = equipmentDd.closePanel;
        equipmentDd.wrap.style.cssText = `
            position: relative;
            flex: 3 1 0%;
            min-width: 0;
            width: auto;
            max-width: none;
            z-index: 1;
        `;
        const equipTriggerBtn = equipmentDd.wrap.querySelector('button[type="button"]');
        if (equipTriggerBtn) {
            equipTriggerBtn.style.maxWidth = '100%';
        }
        
        const equipStatRow = document.createElement('div');
        equipStatRow.style.cssText = `
            display: flex;
            flex-direction: row;
            align-items: stretch;
            gap: 6px;
            width: 100%;
            min-width: 0;
        `;
        
        const statWrap = document.createElement('div');
        statWrap.setAttribute('data-bbm-rule-equipment-stats', '1');
        statWrap.style.cssText = `
            position: relative;
            flex: 2 1 0%;
            min-width: 0;
            width: auto;
            max-width: none;
            z-index: 1;
        `;
        
        const statTrigger = document.createElement('button');
        statTrigger.type = 'button';
        statTrigger.title = t('mods.betterBoostedMaps.ruleEquipmentStatTitle');
        statTrigger.style.cssText = `
            width: 100%;
            max-width: 100%;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            gap: 2px;
            padding: 2px 4px;
            min-height: 36px;
            box-sizing: border-box;
            background: ${BBM_CTX_COLOR_DARK_GRAY};
            border: 1px solid ${BBM_CTX_COLOR_ACCENT};
            color: ${BBM_CTX_COLOR_WHITE};
            border-radius: 3px;
            cursor: pointer;
            font-family: inherit;
            font-size: 9px;
            line-height: 1.15;
            overflow: hidden;
        `;
        const statChev = document.createElement('span');
        statChev.textContent = '\u25be';
        statChev.style.cssText = 'flex-shrink: 0; font-size: 9px; line-height: 1; color: rgba(255,255,255,0.65); margin-left: 1px;';
        const statTriggerLabel = document.createElement('span');
        statTriggerLabel.style.cssText = 'flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; text-align: left;';
        statTrigger.appendChild(statTriggerLabel);
        statTrigger.appendChild(statChev);
        
        const statPanel = document.createElement('div');
        statPanel.setAttribute('data-bbm-stat-dropdown-panel', '1');
        statPanel.style.cssText = `
            display: none;
            position: absolute;
            left: 0;
            right: 0;
            top: calc(100% + 4px);
            flex-direction: column;
            align-items: stretch;
            gap: 4px;
            padding: 5px 6px;
            min-width: 72px;
            max-width: 88px;
            width: auto;
            box-sizing: border-box;
            background: rgba(22, 22, 28, 0.98);
            border: 1px solid ${BBM_CTX_COLOR_ACCENT};
            border-radius: 4px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.55);
            z-index: 1;
        `;
        
        function makeStatCheckbox(statId, labelKey) {
            const lab = document.createElement('label');
            lab.style.cssText = `
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 4px;
                cursor: pointer;
                font-size: 8px;
                line-height: 1.1;
                color: rgba(255,255,255,0.92);
                user-select: none;
                min-width: 0;
            `;
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.style.cssText = 'width: 11px; height: 11px; accent-color: #8BC34A; cursor: pointer; margin: 0; flex-shrink: 0;';
            cb.setAttribute('data-bbm-stat', statId);
            lab.appendChild(cb);
            if (statId === 'all') {
                const sp = document.createElement('span');
                sp.textContent = t(`mods.betterBoostedMaps.${labelKey}`);
                sp.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1;';
                lab.appendChild(sp);
            } else {
                const iconUrl = BBM_RULE_STAT_ICON_URL[statId];
                if (iconUrl) {
                    const img = document.createElement('img');
                    img.src = iconUrl;
                    img.alt = t(`mods.betterBoostedMaps.${labelKey}`);
                    img.title = img.alt;
                    img.draggable = false;
                    img.className = 'pixelated';
                    img.style.cssText =
                        'width: 14px; height: 14px; image-rendering: pixelated; flex-shrink: 0; object-fit: contain;';
                    lab.appendChild(img);
                } else {
                    const sp = document.createElement('span');
                    sp.textContent = t(`mods.betterBoostedMaps.${labelKey}`);
                    sp.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1;';
                    lab.appendChild(sp);
                }
            }
            return { lab, cb };
        }
        
        const { lab: labAll, cb: cbAll } = makeStatCheckbox('all', 'ruleEquipmentStatAll');
        const { lab: labAd, cb: cbAd } = makeStatCheckbox('ad', 'ruleEquipmentStatAd');
        const { lab: labAp, cb: cbAp } = makeStatCheckbox('ap', 'ruleEquipmentStatAp');
        const { lab: labHp, cb: cbHp } = makeStatCheckbox('hp', 'ruleEquipmentStatHp');
        
        statPanel.appendChild(labAll);
        statPanel.appendChild(labAd);
        statPanel.appendChild(labAp);
        statPanel.appendChild(labHp);
        
        function syncPayloadToStatCheckboxes() {
            const stats = bbmNormalizeEquipmentRuleStatsArray(p.equipmentStats);
            p.equipmentStats = stats;
            if (stats.includes('all')) {
                cbAll.checked = true;
                cbAd.checked = false;
                cbAp.checked = false;
                cbHp.checked = false;
            } else {
                cbAll.checked = false;
                cbAd.checked = stats.includes('ad');
                cbAp.checked = stats.includes('ap');
                cbHp.checked = stats.includes('hp');
            }
        }
        
        function applyStatCheckboxesToPayload() {
            if (cbAll.checked) {
                p.equipmentStats = ['all'];
            } else {
                const next = [];
                if (cbAd.checked) next.push('ad');
                if (cbAp.checked) next.push('ap');
                if (cbHp.checked) next.push('hp');
                if (next.length === 0) {
                    cbAll.checked = true;
                    p.equipmentStats = ['all'];
                } else if (next.length === 3) {
                    p.equipmentStats = ['all'];
                } else {
                    p.equipmentStats = next.sort((a, b) => a.localeCompare(b));
                }
            }
        }
        
        function refreshStatSummary() {
            syncPayloadToStatCheckboxes();
            const stats = bbmNormalizeEquipmentRuleStatsArray(p.equipmentStats);
            statTriggerLabel.innerHTML = '';
            statTriggerLabel.style.cssText =
                'flex: 1; min-width: 0; overflow: hidden; text-align: left; display: flex; align-items: center; gap: 2px; flex-wrap: nowrap;';
            if (stats.includes('all')) {
                statTriggerLabel.textContent = t('mods.betterBoostedMaps.ruleEquipmentStatAll');
            } else {
                stats.forEach(s => {
                    const id = String(s).toLowerCase();
                    const url = BBM_RULE_STAT_ICON_URL[id];
                    if (url) {
                        const img = document.createElement('img');
                        img.src = url;
                        img.alt = id.toUpperCase();
                        img.title = id.toUpperCase();
                        img.draggable = false;
                        img.className = 'pixelated';
                        img.style.cssText =
                            'width: 12px; height: 12px; image-rendering: pixelated; flex-shrink: 0; object-fit: contain;';
                        statTriggerLabel.appendChild(img);
                    }
                });
            }
        }
        
        row._bbmStatDdRefreshSummary = refreshStatSummary;
        
        function onStatCheckboxChange(changed) {
            if (changed === 'all' && cbAll.checked) {
                cbAd.checked = false;
                cbAp.checked = false;
                cbHp.checked = false;
            } else if (changed !== 'all' && (cbAd.checked || cbAp.checked || cbHp.checked)) {
                cbAll.checked = false;
            }
            applyStatCheckboxesToPayload();
            syncPayloadToStatCheckboxes();
            refreshStatSummary();
            bbmRefreshAllRuleEquipmentDropdownLists();
            persistMapContextMenuSettings();
        }
        
        cbAll.addEventListener('change', () => onStatCheckboxChange('all'));
        cbAd.addEventListener('change', () => onStatCheckboxChange('ad'));
        cbAp.addEventListener('change', () => onStatCheckboxChange('ap'));
        cbHp.addEventListener('change', () => onStatCheckboxChange('hp'));
        
        let statOpen = false;
        let statDocClose = null;
        let statPanelScrollSync = null;
        
        function positionStatPanelFixed() {
            const r = statTrigger.getBoundingClientRect();
            const margin = 8;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const panelW = Math.min(220, Math.max(96, Math.round(r.width)));
            statPanel.style.width = `${panelW}px`;
            statPanel.style.maxWidth = `${panelW}px`;
            statPanel.style.minWidth = `${panelW}px`;
            statPanel.style.right = 'auto';
            const panelH = statPanel.offsetHeight || 152;
            let left = r.left;
            if (left + panelW > vw - margin) {
                left = Math.max(margin, vw - panelW - margin);
            }
            left = Math.max(margin, left);
            let topPx = r.bottom + 4;
            if (topPx + panelH > vh - margin) {
                const above = r.top - panelH - 4;
                topPx = above >= margin ? above : Math.max(margin, vh - panelH - margin);
            }
            statPanel.style.position = 'fixed';
            statPanel.style.left = `${Math.round(left)}px`;
            statPanel.style.top = `${Math.round(topPx)}px`;
            statPanel.style.zIndex = '100131';
        }
        
        function unbindStatPanelScrollSync() {
            if (!statPanelScrollSync) {
                return;
            }
            rulesWrapper.removeEventListener('scroll', statPanelScrollSync);
            window.removeEventListener('scroll', statPanelScrollSync, true);
            window.removeEventListener('resize', statPanelScrollSync);
            statPanelScrollSync = null;
        }
        
        function bindStatPanelScrollSync() {
            unbindStatPanelScrollSync();
            statPanelScrollSync = () => {
                if (statOpen) {
                    positionStatPanelFixed();
                }
            };
            rulesWrapper.addEventListener('scroll', statPanelScrollSync, { passive: true });
            window.addEventListener('scroll', statPanelScrollSync, true);
            window.addEventListener('resize', statPanelScrollSync, { passive: true });
        }
        
        function closeStatPanel() {
            statOpen = false;
            unbindStatPanelScrollSync();
            if (statDocClose) {
                document.removeEventListener('mousedown', statDocClose, true);
                document.removeEventListener('click', statDocClose, true);
                document.removeEventListener('pointerdown', statDocClose, true);
                statDocClose = null;
            }
            statPanel.style.display = 'none';
            statWrap.style.zIndex = '1';
            if (statPanel.parentNode === document.body) {
                try {
                    if (statWrap.isConnected) {
                        statWrap.appendChild(statPanel);
                    } else {
                        statPanel.remove();
                    }
                } catch (_) {
                    statPanel.remove();
                }
            }
            statPanel.style.position = '';
            statPanel.style.left = '';
            statPanel.style.top = '';
            statPanel.style.right = '';
            statPanel.style.width = '';
            statPanel.style.minWidth = '';
            statPanel.style.maxWidth = '';
            statPanel.style.zIndex = '';
        }
        
        statPanel.addEventListener('mousedown', e => e.stopPropagation());
        statPanel.addEventListener('click', e => e.stopPropagation());
        statPanel.addEventListener('pointerdown', e => e.stopPropagation());
        
        statTrigger.addEventListener('click', e => {
            e.stopPropagation();
            if (statOpen) {
                closeStatPanel();
            } else {
                equipmentDropdownClosers.forEach(fn => {
                    if (fn !== closeStatPanel) {
                        try {
                            fn();
                        } catch (_) {}
                    }
                });
                statOpen = true;
                statWrap.style.zIndex = String(BBM_STAT_RULE_DD_Z_OPEN);
                document.body.appendChild(statPanel);
                statPanel.style.right = 'auto';
                statPanel.style.position = 'fixed';
                statPanel.style.left = '-10000px';
                statPanel.style.top = '0';
                statPanel.style.display = 'flex';
                positionStatPanelFixed();
                bindStatPanelScrollSync();
                statDocClose = ev => {
                    if (!statWrap.isConnected) {
                        closeStatPanel();
                        return;
                    }
                    const t = ev.target;
                    if (t && (t === statPanel || statPanel.contains(t) || t === statWrap || statWrap.contains(t))) {
                        return;
                    }
                    closeStatPanel();
                };
                document.addEventListener('pointerdown', statDocClose, true);
                document.addEventListener('mousedown', statDocClose, true);
                document.addEventListener('click', statDocClose, true);
            }
        });
        
        statWrap.appendChild(statTrigger);
        statWrap.appendChild(statPanel);
        row._bbmStatDdClose = closeStatPanel;
        equipmentDropdownClosers.push(closeStatPanel);
        
        refreshStatSummary();
        
        equipStatRow.appendChild(equipmentDd.wrap);
        equipStatRow.appendChild(statWrap);
        strip.appendChild(equipStatRow);
        
        const staminaFloorBlock = document.createElement('div');
        staminaFloorBlock.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 0;
            width: 100%;
            min-width: 0;
        `;
        
        const staminaRow = document.createElement('div');
        staminaRow.style.cssText = `
            display: flex;
            flex-direction: row;
            align-items: center;
            width: 100%;
            min-width: 0;
        `;
        const staminaBtn = document.createElement('button');
        staminaBtn.type = 'button';
        staminaBtn.title = t('mods.betterBoostedMaps.autoRefillStamina');
        function paintStaminaBtn() {
            staminaBtn.textContent = t('mods.betterBoostedMaps.ruleAutostaminaLabel');
            applyRuleStaminaToggleStyle(staminaBtn, !!p.autoRefillStamina);
            staminaBtn.style.width = '100%';
            staminaBtn.style.maxWidth = '100%';
        }
        paintStaminaBtn();
        staminaBtn.addEventListener('click', () => {
            p.autoRefillStamina = !p.autoRefillStamina;
            paintStaminaBtn();
            persistMapContextMenuSettings();
        });
        staminaRow.appendChild(staminaBtn);
        staminaFloorBlock.appendChild(staminaRow);
        
        const floorSetupRow = document.createElement('div');
        floorSetupRow.style.cssText = `
            display: flex;
            flex-direction: row;
            align-items: stretch;
            gap: 6px;
            width: 100%;
            min-width: 0;
        `;
        
        const setupWrap = document.createElement('div');
        setupWrap.style.cssText = `
            position: relative;
            flex: 3 1 0%;
            min-width: 0;
            width: auto;
            max-width: none;
        `;
        const ruleSetupSel = document.createElement('select');
        populateRuleSetupSelect(ruleSetupSel, p.setupMethod);
        p.setupMethod = ruleSetupSel.value;
        ruleSetupSel.style.flexShrink = '0';
        ruleSetupSel.style.width = '100%';
        ruleSetupSel.style.maxWidth = '100%';
        ruleSetupSel.addEventListener('change', () => {
            p.setupMethod = ruleSetupSel.value;
            persistMapContextMenuSettings();
        });
        setupWrap.appendChild(ruleSetupSel);
        
        const floorWrap = document.createElement('div');
        floorWrap.style.cssText = `
            position: relative;
            flex: 2 1 0%;
            min-width: 0;
            width: auto;
            max-width: none;
        `;
        const floorSel = createRuleFloorSelect(p.floor);
        floorSel.style.width = '100%';
        floorSel.style.maxWidth = '100%';
        floorSel.addEventListener('change', () => {
            p.floor = bbmClampRuleFloor(parseInt(floorSel.value, 10));
            persistMapContextMenuSettings();
        });
        floorWrap.appendChild(floorSel);
        
        floorSetupRow.appendChild(setupWrap);
        floorSetupRow.appendChild(floorWrap);
        staminaFloorBlock.appendChild(floorSetupRow);
        strip.appendChild(staminaFloorBlock);
        
        bar.appendChild(strip);
        
        body.appendChild(bar);
    }
    
    function renderRuleRowBody(row) {
        const body = row.querySelector('.bbm-rule-body');
        if (!body) {
            return;
        }
        body.innerHTML = '';
        renderRuleRow(body, row);
    }
    
    function addEquipmentRuleRow(rule) {
        const row = document.createElement('div');
        row.className = 'bbm-equipment-rule';
        row.style.cssText = `
            margin-bottom: 5px;
            padding: 4px 5px;
            border: 1px solid ${BBM_CTX_INSET_BORDER};
            border-radius: 3px;
            background: rgba(0, 0, 0, 0.25);
            min-width: 0;
        `;
        
        const rawNames = rule && Array.isArray(rule.equipmentNames) ? rule.equipmentNames : [];
        const normalizedRuleNames = bbmNormalizeEquipmentRuleNames(rawNames);
        const ruleSetupVal = rule?.setupMethod && setupOptions.includes(rule.setupMethod)
            ? rule.setupMethod
            : (setupOptions.includes(currentSetupMethod) ? currentSetupMethod : setupOptions[0]);
        const mapFloorDefault = settings.mapFloors && settings.mapFloors[mapId] !== undefined
            ? bbmClampRuleFloor(settings.mapFloors[mapId])
            : 0;
        const ruleFloor = rule && rule.hasOwnProperty('floor')
            ? bbmClampRuleFloor(rule.floor)
            : mapFloorDefault;
        
        row._bbmRulePayload = {
            equipmentNames: [...normalizedRuleNames],
            equipmentStats: bbmNormalizeEquipmentRuleStatsFromRule(rule),
            autoRefillStamina: rule && rule.hasOwnProperty('autoRefillStamina')
                ? !!rule.autoRefillStamina
                : false,
            setupMethod: ruleSetupVal,
            floor: ruleFloor
        };
        row._bbmEqNamesSet = new Set(row._bbmRulePayload.equipmentNames);
        
        const body = document.createElement('div');
        body.className = 'bbm-rule-body';
        body.style.minWidth = '0';
        row.appendChild(body);
        
        renderRuleRowBody(row);
        rulesWrapper.appendChild(row);
    }
    
    const addRuleBtn = document.createElement('button');
    addRuleBtn.type = 'button';
    addRuleBtn.className = 'pixel-font-14';
    addRuleBtn.textContent = t('mods.betterBoostedMaps.contextMenuAddEquipmentRule');
    addRuleBtn.style.cssText = `
        width: 100%;
        margin-top: 2px;
        margin-bottom: 0;
        padding: 5px;
        font-size: 11px;
        cursor: pointer;
        background: #1a2a1a;
        color: #8BC34A;
        border: 1px solid #555;
        border-radius: 3px;
    `;
    addRuleBtn.addEventListener('click', () => addEquipmentRuleRow(null));
    
    const otherwiseLabel = document.createElement('div');
    otherwiseLabel.className = 'pixel-font-14';
    otherwiseLabel.textContent = t('mods.betterBoostedMaps.contextMenuOtherwiseMap');
    otherwiseLabel.style.cssText = `
        color: ${BBM_CTX_COLOR_ACCENT};
        font-size: 12px;
        font-weight: bold;
        margin: 0 0 4px 0;
    `;
    
    const staminaContainer = document.createElement('div');
    staminaContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 0;
    `;
    
    const staminaCheckbox = document.createElement('input');
    staminaCheckbox.type = 'checkbox';
    staminaCheckbox.checked = currentAutoRefillStamina;
    staminaCheckbox.id = `bbm-map-stamina-${mapId.replace(/[^a-zA-Z0-9]/g, '-')}`;
    staminaCheckbox.style.cssText = `
        width: 18px;
        height: 18px;
        accent-color: ${BBM_CTX_COLOR_ACCENT};
        cursor: pointer;
    `;
    
    const staminaLabel = document.createElement('label');
    staminaLabel.textContent = t('mods.betterBoostedMaps.autoRefillStamina');
    staminaLabel.className = 'pixel-font-14';
    staminaLabel.setAttribute('for', staminaCheckbox.id);
    staminaLabel.style.cssText = `
        color: ${BBM_CTX_COLOR_WHITE};
        font-size: 13px;
        cursor: pointer;
        flex: 1;
    `;
    staminaContainer.appendChild(staminaCheckbox);
    staminaContainer.appendChild(staminaLabel);
    
    const setupContainer = document.createElement('div');
    setupContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 0;
    `;
    
    const setupLabel = document.createElement('label');
    setupLabel.textContent = 'Setup Method';
    setupLabel.className = 'pixel-font-14';
    setupLabel.style.cssText = `
        color: ${BBM_CTX_COLOR_WHITE};
        font-size: 13px;
        font-weight: bold;
    `;
    setupContainer.appendChild(setupLabel);
    
    const setupSelect = document.createElement('select');
    setupSelect.className = 'pixel-font-14';
    setupSelect.style.cssText = bbmCtxStyleMenuSelectFull();
    bbmCtxFillSelectSetupOptions(setupSelect, setupOptions, currentSetupMethod);
    setupContainer.appendChild(setupSelect);
    
    const columnsRow = document.createElement('div');
    columnsRow.style.cssText = `
        display: flex;
        flex-direction: row;
        align-items: stretch;
        gap: 10px;
        width: 100%;
        flex: 1 1 0%;
        min-height: 0;
    `;
    
    const colIf = document.createElement('div');
    colIf.style.cssText = `
        flex: 1 1 50%;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;
    
    const colOtherwise = document.createElement('div');
    colOtherwise.style.cssText = `
        flex: 1 1 50%;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        box-sizing: border-box;
        border: 1px solid ${BBM_CTX_INSET_BORDER};
        border-radius: 3px;
        background: ${BBM_CTX_INSET_BG};
        overflow-y: auto;
    `;
    
    colIf.appendChild(equipSectionLabel);
    colIf.appendChild(rulesWrapper);
    colIf.appendChild(addRuleBtn);
    
    colOtherwise.appendChild(otherwiseLabel);
    colOtherwise.appendChild(staminaContainer);
    colOtherwise.appendChild(setupContainer);
    
    columnsRow.appendChild(colIf);
    columnsRow.appendChild(colOtherwise);
    contentPanel.appendChild(columnsRow);
    
    let syncResetButtonState = () => {};
    
    persistMapContextMenuSettings = function persistMapContextMenuSettingsImpl() {
        rulesWrapper.querySelectorAll('.bbm-equipment-rule').forEach(r => {
            const set = r._bbmEqNamesSet;
            const pl = r._bbmRulePayload;
            if (set && set.size > 0 && pl) {
                pl.equipmentNames = bbmNormalizeEquipmentRuleNames(Array.from(set));
            }
        });
        dedupeLoadedEquipmentRulesAcrossRows(true);
        const collectedRules = [];
        rulesWrapper.querySelectorAll('.bbm-equipment-rule').forEach(r => {
            const pl = r._bbmRulePayload;
            if (!pl || !Array.isArray(pl.equipmentNames) || pl.equipmentNames.length === 0) {
                return;
            }
            collectedRules.push({
                equipmentNames: bbmNormalizeEquipmentRuleNames(pl.equipmentNames),
                equipmentStats: bbmNormalizeEquipmentRuleStatsArray(pl.equipmentStats),
                autoRefillStamina: !!pl.autoRefillStamina,
                setupMethod: pl.setupMethod,
                floor: bbmClampRuleFloor(pl.floor)
            });
        });
        const s = loadSettings();
        if (!s.mapSettings) {
            s.mapSettings = {};
        }
        const payload = {
            autoRefillStamina: staminaCheckbox.checked,
            setupMethod: setupSelect.value
        };
        if (collectedRules.length > 0) {
            payload.equipmentRules = collectedRules;
        }
        s.mapSettings[mapId] = payload;
        localStorage.setItem('betterBoostedMapsSettings', JSON.stringify(s));
        syncResetButtonState();
    };
    
    staminaCheckbox.addEventListener('change', () => persistMapContextMenuSettings());
    setupSelect.addEventListener('change', () => persistMapContextMenuSettings());
    
    const initialRules = Array.isArray(mapSetting.equipmentRules) ? mapSetting.equipmentRules : [];
    initialRules.forEach(r => addEquipmentRuleRow(r));
    dedupeLoadedEquipmentRulesAcrossRows();
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        flex-shrink: 0;
        gap: 10px;
        justify-content: center;
        margin-top: 0;
    `;
    
    const resetButton = bbmCtxCreateContextMenuFooterButton(
        t('mods.betterBoostedMaps.contextMenuResetMap'),
        'clear'
    );
    resetButton.addEventListener('click', () => {
        if (resetButton.disabled) {
            return;
        }
        const s = loadSettings();
        if (s.mapSettings && s.mapSettings[mapId]) {
            delete s.mapSettings[mapId];
            if (Object.keys(s.mapSettings).length === 0) {
                delete s.mapSettings;
            }
            localStorage.setItem('betterBoostedMapsSettings', JSON.stringify(s));
            console.log(`[Better Boosted Maps] Reset per-map settings for ${mapId}`);
        }
        closeMenu();
    });
    syncResetButtonState = function syncResetButtonStateImpl() {
        const has = hasMapCustomSettings(mapId);
        resetButton.disabled = !has;
        resetButton.style.opacity = has ? '1' : '0.45';
        resetButton.style.cursor = has ? 'pointer' : 'not-allowed';
    };
    syncResetButtonState();
    
    const closeButton = bbmCtxCreateContextMenuFooterButton(
        t('mods.betterBoostedMaps.contextMenuClose'),
        'cancel'
    );
    closeButton.addEventListener('click', closeMenu);
    
    buttonContainer.appendChild(resetButton);
    buttonContainer.appendChild(closeButton);
    menuShell.appendChild(titleEl);
    menuShell.appendChild(contentPanel);
    menuShell.appendChild(buttonContainer);
    menu.appendChild(menuShell);
    
    function closeMenu() {
        equipmentDropdownClosers.forEach(fn => {
            try {
                fn();
            } catch (_) {}
        });
        equipmentDropdownClosers.length = 0;
        overlay.removeEventListener('mousedown', overlayClickHandler);
        overlay.removeEventListener('click', overlayClickHandler);
        document.removeEventListener('keydown', escHandler);
        if (betterBoostedMapsOpenContextMenu && betterBoostedMapsOpenContextMenu.modalClickHandler && betterBoostedMapsOpenContextMenu.modalContent) {
            betterBoostedMapsOpenContextMenu.modalContent.removeEventListener('mousedown', betterBoostedMapsOpenContextMenu.modalClickHandler);
            betterBoostedMapsOpenContextMenu.modalContent.removeEventListener('click', betterBoostedMapsOpenContextMenu.modalClickHandler);
        }
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (menu.parentNode) menu.parentNode.removeChild(menu);
        if (betterBoostedMapsOpenContextMenu && (betterBoostedMapsOpenContextMenu.overlay === overlay || betterBoostedMapsOpenContextMenu.menu === menu)) {
            betterBoostedMapsOpenContextMenu = null;
        }
        if (onClose) onClose();
    }
    
    betterBoostedMapsOpenContextMenu = {
        overlay,
        menu,
        closeMenu
    };
    
    const overlayClickHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
    };
    
    const escHandler = (e) => {
        if (e.key === 'Escape') closeMenu();
    };
    
    document.body.appendChild(overlay);
    document.body.appendChild(menu);
    overlay.addEventListener('mousedown', overlayClickHandler);
    overlay.addEventListener('click', overlayClickHandler);
    document.addEventListener('keydown', escHandler);
    
    const modalContent = document.querySelector('[role="dialog"][data-state="open"]');
    if (modalContent) {
        const modalClickHandler = (e) => {
            if (!menu.contains(e.target)) {
                closeMenu();
                modalContent.removeEventListener('mousedown', modalClickHandler);
                modalContent.removeEventListener('click', modalClickHandler);
            }
        };
        modalContent.addEventListener('mousedown', modalClickHandler);
        modalContent.addEventListener('click', modalClickHandler);
        betterBoostedMapsOpenContextMenu.modalClickHandler = modalClickHandler;
        betterBoostedMapsOpenContextMenu.modalContent = modalContent;
    }
    
    menu.addEventListener('mousedown', (e) => e.stopPropagation());
    menu.addEventListener('click', (e) => e.stopPropagation());
    
    return menu;
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
        background: ${BBM_CTX_PANEL_TEXTURE};
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

function attachSettingsListRowHover(rowEl, isDimmed) {
    if (!rowEl) return;
    rowEl.style.marginBottom = '0';
    rowEl.style.borderRadius = '3px';
    rowEl.style.transition = 'background-color 0.05s ease, box-shadow 0.05s ease';
    rowEl.addEventListener('mouseenter', () => {
        rowEl.style.backgroundColor = isDimmed
            ? 'rgba(255, 255, 255, 0.06)'
            : 'rgba(255, 224, 102, 0.14)';
        rowEl.style.boxShadow = isDimmed
            ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.12)'
            : 'inset 0 0 0 1px rgba(255, 224, 102, 0.4)';
    });
    rowEl.addEventListener('mouseleave', () => {
        rowEl.style.backgroundColor = 'transparent';
        rowEl.style.boxShadow = 'none';
    });
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
            maps.forEach(({ id, name }) => {
                const isDisabled = MAPS_WITHOUT_BOOSTED_EQUIPMENT.includes(name);
                const mapDiv = createCheckboxSetting(
                    `boosted-maps-map-${id}`,
                    name,
                    '',
                    settings.maps?.[id] !== false,
                    '14px',
                    isDisabled
                );
                
                const mapRow = mapDiv.firstElementChild;
                attachSettingsListRowHover(mapRow, isDisabled);
                
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
                    
                    if (mapRow) {
                        mapRow.appendChild(floorSelect);
                    } else {
                        mapDiv.appendChild(floorSelect);
                    }
                    
                    if (mapRow) {
                        mapRow.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            createBoostedMapContextMenu(id, name, e.clientX, e.clientY, () => {
                                updateMapCustomSettingsIndicator(mapDiv, id);
                            });
                        });
                    }
                    updateMapCustomSettingsIndicator(mapDiv, id);
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

function isRaidRoomId(roomId) {
    try {
        return typeof window.mapsDatabase?.isRaid === 'function' && window.mapsDatabase.isRaid(roomId);
    } catch (_) {
        return false;
    }
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
        // No region data - return all non-raid maps unsorted (raids cannot be daily boosted)
        return {
            'All Maps': Object.entries(roomNames)
                .filter(([id]) => !isRaidRoomId(id))
                .map(([id, name]) => ({ id, name }))
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
            if (roomNames[roomCode] && !isRaidRoomId(roomCode)) {
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
        .filter(([id]) => !processedRoomCodes.has(id) && !isRaidRoomId(id))
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
            attachSettingsListRowHover(equipDiv.firstElementChild, isExcluded);
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
    
    // Update coordination system state
    if (window.ModCoordination) {
        window.ModCoordination.updateModState('Better Boosted Maps', { active: false });
    }
    
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
                equipId: boostedData.equipId,
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
        
        // Update coordination system state
        if (window.ModCoordination) {
            window.ModCoordination.updateModState('Better Boosted Maps', { active: true });
        }
        
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
            
            const { floor } = getEffectiveMapAutomationSettings(
                farmCheck.roomId,
                initialSettings,
                farmCheck.equipId
            );
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
        
        // Get user's selected setup method (per-map override when set)
        const setupSettings = loadSettings();
        const { setupMethod, autoRefillStamina: effectiveAutoRefill } = getEffectiveMapAutomationSettings(
            farmCheck.roomId,
            setupSettings,
            farmCheck.equipId
        );
        
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
        
        // Check if Stamina Optimizer would block before enabling autoplay
        if (window.staminaOptimizerWouldBlock && window.staminaOptimizerWouldBlock('Better Boosted Maps')) {
            console.log('[Better Boosted Maps] Stamina Optimizer would block - not enabling autoplay mode');
            cancelBoostedMapFarming('Stamina Optimizer would block autoplay');
            return;
        }
        
        // Enable autoplay mode
        console.log('[Better Boosted Maps] Enabling autoplay mode...');
        globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
        await new Promise(resolve => setTimeout(resolve, AUTOPLAY_SETUP_DELAY));
        
        // Check automation status after enabling autoplay
        if (!checkAutomationEnabled('after enabling autoplay')) return;
        
        // Enable integration features with retry logic
        if (effectiveAutoRefill) {
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
        const roomId = modState.farming.currentMapInfo?.roomId;
        const equipId = modState.farming.currentMapInfo?.equipId;
        const effectiveRefill = roomId
            ? getEffectiveMapAutomationSettings(roomId, settings, equipId).autoRefillStamina
            : !!settings.autoRefillStamina;
        let validationIssues = [];
        
        // Validate Bestiary Automator settings if enabled
        if (effectiveRefill) {
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
                    if (effectiveRefill) {
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
    
    // Register with mod coordination system
    if (window.ModCoordination) {
        window.ModCoordination.registerMod('Better Boosted Maps', {
            priority: 10,
            metadata: { description: 'Automated boosted map farming system' }
        });
        
        // Subscribe to mod state changes instead of polling
        window.ModCoordination.on('modActiveChanged', (data) => {
            if (data.modName === 'Raid Hunter') {
                const wasActive = modState.coordination.isRaidHunterActive;
                modState.coordination.isRaidHunterActive = data.active;
                updateExposedState();
                
                // If Raid Hunter just became inactive and we're enabled, check if we should start farming
                if (wasActive && !data.active && modState.enabled && !modState.farming.isActive) {
                    console.log('[Better Boosted Maps] Raid Hunter became inactive - checking if we should start boosted map farming');
                    setTimeout(() => {
                        checkAndStartBoostedMapFarming();
                    }, 1000); // Small delay to ensure Raid Hunter has fully cleaned up
                }
            } else if (data.modName === 'Better Tasker') {
                const wasActive = modState.coordination.isBetterTaskerActive;
                modState.coordination.isBetterTaskerActive = data.active;
                updateExposedState();
                
                // If Better Tasker just became inactive and we're enabled, check if we should start farming
                if (wasActive && !data.active && modState.enabled && !modState.farming.isActive) {
                    console.log('[Better Boosted Maps] Better Tasker became inactive - checking if we should start boosted map farming');
                    setTimeout(() => {
                        checkAndStartBoostedMapFarming();
                    }, 1000); // Small delay to ensure Better Tasker has fully cleaned up
                }
            } else if (data.modName === 'Board Analyzer' || data.modName === 'Manual Runner') {
                // Check if we can run when these mods change state
                updateExposedState();
                
                // If these blocking mods just became inactive and we're enabled, check if we should start farming
                if (!data.active && modState.enabled && !modState.farming.isActive) {
                    console.log(`[Better Boosted Maps] ${data.modName} became inactive - checking if we should start boosted map farming`);
                    setTimeout(() => {
                        checkAndStartBoostedMapFarming();
                    }, 1000); // Small delay to ensure the mod has fully cleaned up
                }
            }
        });
    }
    
    loadBoostedMapsState();
    monitorQuestLog();
    
    // Update coordination system state
    if (window.ModCoordination) {
        window.ModCoordination.updateModState('Better Boosted Maps', { enabled: modState.enabled });
    }
    
    // Setup daily state monitoring if enabled
    if (modState.enabled) {
        console.log('[Better Boosted Maps] Mod is enabled - setting up daily state monitoring');
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
        
        // Update coordination system state
        if (window.ModCoordination) {
            window.ModCoordination.updateModState('Better Boosted Maps', { active: modState.farming.isActive });
        }
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
        
        // Unregister from coordination system
        if (window.ModCoordination) {
            window.ModCoordination.unregisterMod('Better Boosted Maps');
        }
        
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
