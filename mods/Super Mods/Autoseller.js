// =======================
// 0. Version & Metadata
// =======================

(function() {
    if (window.__autosellerLoaded) return;
    window.__autosellerLoaded = true;
    
    console.log('[Autoseller] Script initialized');

    // =======================
    // 1. Configuration & Constants
    // =======================
    const modName = "Autoseller";
    const modDescription = "Automatically sells and squeezes creatures based on gene thresholds and experience levels. Shiny creatures are protected.";
    
    // Core timing constants
    const AUTOSELLER_MIN_DELAY_MS = 5000;
    const MAX_OBSERVER_ATTEMPTS = 10;
    const OBSERVER_DEBOUNCE_MS = 100;
    
    // Rate limiting constants for all API operations
    const SELL_RATE_LIMIT = {
        MAX_MONSTERS_PER_10S: 15,
        DELAY_BETWEEN_SELLS_MS: 300,
        WINDOW_SIZE_MS: 10000,
        BATCH_SIZE: 5,
        BATCH_DELAY_MS: 1000
    };
    
    // Operation delays for UI settling and processing
    const OPERATION_DELAYS = {
        // Common delay for UI settling before operations (used by sell, squeeze, disenchant, and dragon plant)
        UI_SETTLE_MS: 500,
        BEFORE_DRAGON_PLANT_ACTIVATE_MS: 300,  // Delay for activating Dragon Plant after game end
        AFTER_GAME_END_BEFORE_ACTIVATE_MS: 200, // Delay after game end before checking Dragon Plant
        
        // Delay after operation before removing from local inventory
        BEFORE_REMOVE_FROM_INVENTORY_MS: 100,  // Used for squeeze
        
        // Rate limit retry delay
        RATE_LIMIT_RETRY_MS: 5000
    };
    
    // UI Constants
    const UI_CONSTANTS = {
        MODAL_WIDTH: 530,
        MODAL_HEIGHT: 390,
        MODAL_CONTENT_HEIGHT: 310,
        LEFT_COLUMN_WIDTH: 140,
        RIGHT_COLUMN_WIDTH: 320,
        INPUT_WIDTH: 48,
        INPUT_STEP: 1,
        SQUEEZE_GENE_MIN: 80,
        SQUEEZE_GENE_MAX: 100,
        SELL_GENE_MIN: 5,
        SELL_GENE_MAX: 79,
        MAX_EXP_DEFAULT: 52251,
        // Button colors
        BUTTON_COLORS: {
            ACTIVE_GREEN_BG: '#1a3a1a',
            ACTIVE_RED_BG: '#3a1a1a',
            INACTIVE_BG: '#1a1a1a',
            ACTIVE_GREEN_TEXT: '#4CAF50',
            ACTIVE_RED_TEXT: '#ff6b6b',
            INACTIVE_TEXT: '#888888',
            PRIMARY_TEXT: '#ffe066',
            INPUT_BG: '#2a2a2a',
            BORDER: '#555'
        },
        // Text shadows
        TEXT_SHADOW: {
            GREEN: '0 0 4px rgba(76, 175, 80, 0.5)',
            RED: '0 0 4px rgba(255, 107, 107, 0.5)',
            NONE: 'none'
        },
        // Button sizes
        BUTTON_SIZES: {
            WIDTH: '100px',
            HEIGHT: '28px'
        },
        // Spacing
        SPACING: {
            GAP_SMALL: '4px',
            GAP_MEDIUM: '8px',
            GAP_LARGE: '12px',
            MARGIN_BOTTOM_BUTTON: '10px'
        },
        // Input styles
        INPUT_STYLES: {
            WIDTH_SMALL: '40px',
            WIDTH_MEDIUM: '48px',
            PADDING: '2px 4px',
            FONT_SIZE_SMALL: '12px',
            FONT_SIZE_MEDIUM: '14px',
            BACKGROUND: '#2a2a2a',
            BORDER: '1px solid #555',
            BORDER_RADIUS: '3px'
        },
        // Common styles
        COMMON_STYLES: {
            PIXEL_FONT: 'pixel-font-16',
            PRIMARY_COLOR: '#ffe066',
            SECONDARY_COLOR: '#cccccc',
            BACKGROUND_COLOR: '#232323',
            BORDER_RADIUS: '3px',
            INPUT_BORDER: '1px solid #ffe066'
        },
        // CSS Classes
        CSS_CLASSES: {
            AUTOSELLER_NAV_BTN: 'autoseller-nav-btn',
            AUTOSELLER_WIDGET: 'autoseller-session-widget',
            AUTOSELLER_RESPONSIVE_STYLE: 'autoseller-responsive-style'
        },
        // DOM Selectors
        SELECTORS: {
            CREATURE_SLOTS: '[data-blip]',
            DAYCARE_ICON: 'img[alt="daycare"][src="/assets/icons/atdaycare.png"]',
            CREATURE_IMG: 'img[alt="creature"]'
        }
    };
    
    // API Constants
    const API_CONSTANTS = {
        RETRY_ATTEMPTS: 2,
        RETRY_DELAY_BASE: 1000,
        DUST_PER_CREATURE: 10
    };
    
    // Cleanup references
    let boardSubscription1 = null;
    // Removed boardSubscription2 - all processing now happens at game end
    let playerSubscription = null;
    let debounceTimer = null;
    
    // Store latest serverResults from board subscription
    let latestServerResults = null;
    // Track the last processed serverResults seed to avoid processing the same results twice
    let lastProcessedServerResultsSeed = null;
    
    // Event handler references for cleanup
    let emitNewGameHandler1 = null;
    let emitEndGameHandler1 = null;
    let emitNewGameHandler2 = null; // Separate handler for setupGameEndListener
    
    // Global references for cleanup
    let originalFetch = null;
    let messageListener = null;
    let menuColorObserver = null; // MutationObserver for menu color updates
    let checkboxListeners = []; // Track checkbox event listeners for cleanup
    let dragonPlantDebounceTimer = null; // Debounce timer for dragon plant observer
    let openContextMenu = null; // Track currently open context menu { overlay, menu, closeMenu }
    
    // Timeout tracking for memory leak prevention
    let timeoutIds = []; // Track all setTimeout calls for cleanup
    let isCleaningUp = false; // Flag to prevent execution during cleanup
    let gameEndSubscription = null; // Track game.world.onGameEnd subscription
    
    // Translation helper
    const t = (key) => {
        if (typeof api !== 'undefined' && api.i18n && api.i18n.t) {
            return api.i18n.t(key);
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

    // Dragon Plant Autocollect Constants
    const DRAGON_PLANT_CONFIG = {
        GOLD_THRESHOLD: 100000,        // Collect when >= 100k gold
        ITEM_ID: '37021',              // Dragon Plant item ID
        MAX_COLLECT_ITERATIONS: 100,   // Safety limit for collect loop (can collect up to 10M gold)
        COOLDOWN_MS: 10000,            // 10 seconds cooldown between collections
        TIMINGS: {
            INVENTORY_OPEN: 400,       // Wait for inventory to open
            ITEM_DETAILS_OPEN: 300,    // Wait for item details modal to open
            AFTER_COLLECT: 500,        // Wait after clicking Collect (API rate limit: min 400ms)
            ESC_BETWEEN: 150,          // Wait between ESC key presses
            VERIFY_SUCCESS: 200        // Wait before verifying collection success
        }
    };

    // Default Settings - All features default to disabled (off)
    const DEFAULT_SETTINGS = {
        autoMode: null, // 'autoplant' | 'autosell' | null (OFF - default disabled)
        autoplantAutocollectChecked: false,
        autosqueezeChecked: false, // Default disabled
        autosqueezeGenesMin: UI_CONSTANTS.SQUEEZE_GENE_MIN,
        autosqueezeGenesMax: UI_CONSTANTS.SQUEEZE_GENE_MAX,
        autosqueezeMinCount: 1,
        autosqueezeIgnoreList: [],
        autosqueezeSellList: [],
        autodusterChecked: false, // Default disabled
        autodusterGenesMin: UI_CONSTANTS.SQUEEZE_GENE_MIN,
        autodusterGenesMax: UI_CONSTANTS.SQUEEZE_GENE_MAX,
        autodusterIgnoreList: [],
        autodusterSellList: [],
        // Shared ignore list for both autoplant and autosell
        autoplantIgnoreList: [],
        autoplantSellList: [],
        // Shared gene thresholds for both autoplant and autosell
        autoplantGenesMin: 80,
        autoplantKeepGenesEnabled: true,
        autoplantAlwaysDevourBelow: 49,
        autoplantAlwaysDevourEnabled: false,
        // Per-creature gene ranges to keep (prevents selling/devouring)
        creatureKeepRanges: {} // { "CreatureName": { min: number, max: number } }
    };
    
    // =======================
    // 2. DOM Utilities & Settings
    // =======================
    
    /**
     * Gets button style object based on active state and color type
     * @param {boolean} isActive - Whether the button is active
     * @param {string} colorType - 'green' or 'red'
     * @param {Object} options - Additional style options
     * @returns {Object} Style object
     */
    function getButtonStyles(isActive, colorType = 'green', options = {}) {
        const colors = UI_CONSTANTS.BUTTON_COLORS;
        const shadows = UI_CONSTANTS.TEXT_SHADOW;
        const sizes = UI_CONSTANTS.BUTTON_SIZES;
        
        let backgroundColor, color, textShadow;
        if (isActive) {
            if (colorType === 'red') {
                backgroundColor = colors.ACTIVE_RED_BG;
                color = colors.ACTIVE_RED_TEXT;
                textShadow = shadows.RED;
            } else {
                backgroundColor = colors.ACTIVE_GREEN_BG;
                color = colors.ACTIVE_GREEN_TEXT;
                textShadow = shadows.GREEN;
            }
        } else {
            backgroundColor = colors.INACTIVE_BG;
            color = colors.INACTIVE_TEXT;
            textShadow = shadows.NONE;
        }
        
        return {
            width: sizes.WIDTH,
            height: sizes.HEIGHT,
            border: `2px solid ${colors.BORDER}`,
            borderRadius: '4px',
            backgroundColor: backgroundColor,
            color: color,
            cursor: isActive ? 'default' : 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            transition: 'background-color 0.2s, color 0.2s',
            textAlign: 'center',
            padding: '0',
            textShadow: textShadow,
            ...options
        };
    }
    
    /**
     * Applies button styles to an element
     * @param {HTMLElement} button - Button element
     * @param {boolean} isActive - Whether the button is active
     * @param {string} colorType - 'green' or 'red'
     * @param {Object} options - Additional style options
     */
    function applyButtonStyles(button, isActive, colorType = 'green', options = {}) {
        const styles = getButtonStyles(isActive, colorType, options);
        Object.assign(button.style, styles);
    }
    
    /**
     * Gets settings keys based on summary type
     * @param {string} summaryType - 'Autosqueeze' or 'Autoduster'
     * @returns {Object} Settings keys object
     */
    function getSettingsKeys(summaryType) {
        const isAutoduster = summaryType === 'Autoduster';
        return {
            checked: isAutoduster ? 'autodusterChecked' : 'autosqueezeChecked',
            genesMin: isAutoduster ? 'autodusterGenesMin' : 'autosqueezeGenesMin',
            genesMax: isAutoduster ? 'autodusterGenesMax' : 'autosqueezeGenesMax',
            ignoreList: isAutoduster ? 'autodusterIgnoreList' : 'autosqueezeIgnoreList'
        };
    }
    
    /**
     * Validates and clamps a gene input value
     * @param {number|string} value - Input value
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @param {number} defaultValue - Default value if invalid
     * @returns {number} Validated value
     */
    function validateGeneInput(value, min, max, defaultValue) {
        return Math.max(min, Math.min(max, parseInt(value, 10) || defaultValue));
    }
    
    function queryElement(selector, context = document) {
        return context.querySelector(selector);
    }
    
    function queryAllElements(selector, context = document) {
        return context.querySelectorAll(selector);
    }
    
    function getSettings() {
        try {
            const stored = JSON.parse(localStorage.getItem('autoseller-settings') || '{}');
            const settings = { ...DEFAULT_SETTINGS, ...stored };
            
            // Migration: Convert old autoplantChecked/autosellChecked to autoMode
            // Only migrate if autoMode was never set (not if it's explicitly null)
            if (!('autoMode' in stored)) {
                if (stored.autoplantChecked === true) {
                    settings.autoMode = 'autoplant';
                } else if (stored.autosellChecked === true) {
                    settings.autoMode = 'autosell';
                } else if (stored.lastActiveMode) {
                    // Use lastActiveMode as fallback
                    settings.autoMode = stored.lastActiveMode === 'autoplant' ? 'autoplant' : 'autosell';
                }
                
                // Save migrated settings directly to localStorage to avoid recursion
                if (settings.autoMode !== null && settings.autoMode !== undefined) {
                    const { autoplantChecked, autosellChecked, lastActiveMode, autosellGenesMin, autosellGenesMax, autosellMinCount, autosellMaxExp, ...cleanSettings } = settings;
                    try {
                        localStorage.setItem('autoseller-settings', JSON.stringify({ ...cleanSettings, autoMode: settings.autoMode }));
                    } catch (e) {
                        console.warn(`[${modName}][WARN][getSettings] Failed to save migrated settings`, e);
                    }
                }
            }
            
            return settings;
        } catch (e) { 
            console.warn(`[${modName}][WARN][getSettings] Failed to parse settings from localStorage`, e);
            return { ...DEFAULT_SETTINGS };
        }
    }
    
    function setSettings(newSettings) {
        const oldSettings = getSettings();
        const updatedSettings = { ...oldSettings, ...newSettings };
        
        // Save directly to localStorage (single source of truth)
        try {
            localStorage.setItem('autoseller-settings', JSON.stringify(updatedSettings));
        } catch (e) {
            console.warn(`[${modName}][WARN][setSettings] Failed to save settings to localStorage`, e);
        }
        
        updateAutosellerNavButtonColor();
        
        // Manage widget if any tab setting changed (autoMode, autosqueeze, or autoduster)
        const widgetNeedsUpdate = 
            (newSettings.autoMode !== undefined && newSettings.autoMode !== oldSettings.autoMode) ||
            (newSettings.autosqueezeChecked !== undefined && newSettings.autosqueezeChecked !== oldSettings.autosqueezeChecked) ||
            (newSettings.autodusterChecked !== undefined && newSettings.autodusterChecked !== oldSettings.autodusterChecked);
        
        if (widgetNeedsUpdate) {
            manageAutosellerWidget();
        }
        
        updateAutosellerSessionWidget();
        
        // Update menu item colors if modal is open
        if (typeof window.updateAutosellerMenuItemColors === 'function') {
            window.updateAutosellerMenuItemColors();
        }
    }
    
    // Initialize localStorage with defaults if not exists
    if (!localStorage.getItem('autoseller-settings')) {
        localStorage.setItem('autoseller-settings', JSON.stringify(DEFAULT_SETTINGS));
    }
    
    // =======================
    // Creature Keep Range Helpers
    // =======================
    
    /**
     * Get the keep range for a creature
     * @param {string} creatureName - Name of the creature
     * @returns {Object|null} Keep range { min: number, max: number } or null
     */
    function getCreatureKeepRange(creatureName) {
        const settings = getSettings();
        const ranges = settings.creatureKeepRanges || {};
        return ranges[creatureName] || null;
    }
    
    /**
     * Set the keep range for a creature
     * @param {string} creatureName - Name of the creature
     * @param {number} min - Minimum gene percentage
     * @param {number} max - Maximum gene percentage
     */
    function setCreatureKeepRange(creatureName, min, max) {
        const settings = getSettings();
        const ranges = { ...(settings.creatureKeepRanges || {}) };
        ranges[creatureName] = { min, max };
        setSettings({ creatureKeepRanges: ranges });
    }
    
    /**
     * Clear the keep range for a creature
     * @param {string} creatureName - Name of the creature
     */
    function clearCreatureKeepRange(creatureName) {
        const settings = getSettings();
        const ranges = { ...(settings.creatureKeepRanges || {}) };
        delete ranges[creatureName];
        setSettings({ creatureKeepRanges: ranges });
    }
    
    /**
     * Check if a creature should be kept based on its gene range
     * @param {string} creatureName - Name of the creature
     * @param {number} totalGenes - Total gene percentage
     * @returns {boolean} True if creature should be kept
     */
    function shouldKeepCreatureByRange(creatureName, totalGenes) {
        const keepRange = getCreatureKeepRange(creatureName);
        if (!keepRange) return false;
        return totalGenes >= keepRange.min && totalGenes <= keepRange.max;
    }

    // =======================
    // 3. Core Utility Functions
    // =======================
    
    function getGenes(m) {
        return (m.hp || 0) + (m.ad || 0) + (m.ap || 0) + (m.armor || 0) + (m.magicResist || 0);
    }
    
    // Dragon Plant Helper Functions
    const getPlantGold = () => globalThis.state?.player?.getSnapshot?.()?.context?.questLog?.plant?.gold;
    
    const hasDragonPlant = () => {
        const plant = globalThis.state?.player?.getSnapshot?.()?.context?.questLog?.plant;
        return plant !== undefined && plant !== null;
    };
    
    const sendEscKey = () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { 
            key: 'Escape', 
            code: 'Escape', 
            keyCode: 27, 
            bubbles: true 
        }));
    };
    
    const findButtonByText = (text, selector = 'button') => {
        const buttons = document.querySelectorAll(selector);
        for (const button of buttons) {
            if (button.textContent.includes(text)) {
                return button;
            }
        }
        return null;
    };
    
    const findDragonPlantCollectButton = () => {
        // Find the Collect button with the plant SVG icon (more specific than just text)
        const buttons = document.querySelectorAll('button.surface-green');
        for (const button of buttons) {
            const hasPlantIcon = button.querySelector('svg.lucide-sprout');
            const hasCollectText = button.textContent.includes('Collect') || button.textContent.includes('Coletar');
            const isNotDisabled = !button.hasAttribute('disabled');
            
            if (hasPlantIcon && hasCollectText && isNotDisabled) {
                return button;
            }
        }
        return null;
    };
    
    function createLabel(text, options = {}) {
        return createElement('span', {
            text: text,
            className: UI_CONSTANTS.COMMON_STYLES.PIXEL_FONT,
            styles: {
                color: options.color || UI_CONSTANTS.COMMON_STYLES.SECONDARY_COLOR,
                fontSize: options.fontSize || '14px',
                fontWeight: options.fontWeight || 'bold',
                marginRight: options.marginRight || '6px',
                ...options.styles
            }
        });
    }
    
    // =======================
    // 3.1. Shared serverResults extraction and filtering
    // =======================
    
    /**
     * Extract monsters and their server IDs from serverResults
     * @param {Object} serverResults - The serverResults object from board context
     * @returns {Object} { battleRewardMonsters: Array, rewardMonsterIds: Set }
     */
    function extractMonstersFromServerResults(serverResults) {
        let battleRewardMonsters = [];
        let rewardMonsterIds = new Set();
        
        // Try multiple possible paths to find monsters in serverResults
        if (serverResults.rewardScreen) {
            if (serverResults.rewardScreen.monsterDrop) {
                const monsterDrop = serverResults.rewardScreen.monsterDrop;
                if (Array.isArray(monsterDrop)) {
                    battleRewardMonsters = monsterDrop;
                } else if (monsterDrop && typeof monsterDrop === 'object') {
                    battleRewardMonsters = [monsterDrop];
                }
            }
            
            if (battleRewardMonsters.length === 0 && serverResults.rewardScreen.loot) {
                const loot = serverResults.rewardScreen.loot;
                if (Array.isArray(loot)) {
                    battleRewardMonsters = loot.filter(item => item && (item.type === 'monster' || item.monster || item.id));
                } else if (loot && typeof loot === 'object' && (loot.type === 'monster' || loot.monster || loot.id)) {
                    battleRewardMonsters = [loot];
                }
            }
            
            if (battleRewardMonsters.length === 0 && serverResults.rewardScreen.monsters) {
                battleRewardMonsters = Array.isArray(serverResults.rewardScreen.monsters) 
                    ? serverResults.rewardScreen.monsters 
                    : [serverResults.rewardScreen.monsters];
            }
        }
        
        // Try other paths as fallback
        if (battleRewardMonsters.length === 0) {
            if (serverResults.monsters) {
                battleRewardMonsters = Array.isArray(serverResults.monsters) 
                    ? serverResults.monsters 
                    : [serverResults.monsters];
            } else if (serverResults.rewards && serverResults.rewards.monsters) {
                battleRewardMonsters = Array.isArray(serverResults.rewards.monsters) 
                    ? serverResults.rewards.monsters 
                    : [serverResults.rewards.monsters];
            }
        }
        
        // Extract server IDs from battle reward monsters
        if (battleRewardMonsters && battleRewardMonsters.length > 0) {
            battleRewardMonsters.forEach((m) => {
                if (m && typeof m === 'object') {
                    const monster = m.monster || m;
                    const serverId = monster.id || monster.databaseId;
                    if (serverId) {
                        rewardMonsterIds.add(serverId);
                    }
                    if (m.monsterId) {
                        rewardMonsterIds.add(m.monsterId);
                    }
                }
            });
            // No logging needed - processing logs will show when items are actually processed
        }
        
        return { battleRewardMonsters, rewardMonsterIds };
    }
    
    /**
     * Filter inventory monsters to only include those from serverResults (by server ID match)
     * @param {Array} inventorySnapshot - Full inventory snapshot
     * @param {Set} rewardMonsterIds - Set of server IDs from serverResults
     * @returns {Array} Filtered monsters matching server IDs
     */
    function filterMonstersByServerIds(inventorySnapshot, rewardMonsterIds) {
        if (!rewardMonsterIds || rewardMonsterIds.size === 0) {
            return [];
        }
        
        return inventorySnapshot.filter(invMonster => {
            return rewardMonsterIds.has(invMonster.id);
        });
    }
    
    /**
     * Extract equipment and their server IDs from serverResults
     * @param {Object} serverResults - The serverResults object from board context
     * @returns {Object} { battleRewardEquipment: Array, rewardEquipmentIds: Set }
     */
    function extractEquipmentFromServerResults(serverResults) {
        let battleRewardEquipment = [];
        let rewardEquipmentIds = new Set();
        
        // Equipment only comes from equipDrop, not from droppedItems
        if (serverResults.rewardScreen?.equipDrop) {
            const equipDrop = serverResults.rewardScreen.equipDrop;
            
            if (equipDrop && typeof equipDrop === 'object') {
                battleRewardEquipment = [equipDrop];
            }
        }
        
        // Extract server IDs from battle reward equipment
        if (battleRewardEquipment && battleRewardEquipment.length > 0) {
            battleRewardEquipment.forEach((equip) => {
                if (equip && typeof equip === 'object') {
                    const equipment = equip.equip || equip;
                    const serverId = equipment.id || equipment.databaseId;
                    
                    if (serverId) {
                        rewardEquipmentIds.add(serverId);
                    }
                    if (equip.equipmentId) {
                        rewardEquipmentIds.add(equip.equipmentId);
                    }
                }
            });
            // No logging needed - processing logs will show when items are actually processed
        }
        
        return { battleRewardEquipment, rewardEquipmentIds };
    }
    
    /**
     * Fetch equipment from player's inventory (from local state)
     * @returns {Array} Array of equipment from player's inventory
     */
    async function fetchServerEquipment() {
        try {
            const playerContext = globalThis.state?.player?.getSnapshot?.()?.context;
            if (!playerContext || !playerContext.equips) {
                return [];
            }
            
            const userEquips = playerContext.equips || [];
            return userEquips.filter(equip => equip && equip.id && equip.gameId);
        } catch (error) {
            console.warn(`[${modName}][WARN][fetchServerEquipment] Error fetching equipment:`, error);
            return [];
        }
    }
    
    /**
     * Filter inventory equipment to only include those from serverResults (by server ID match)
     * @param {Array} inventoryEquipment - Full inventory equipment snapshot
     * @param {Set} rewardEquipmentIds - Set of server IDs from serverResults
     * @returns {Array} Filtered equipment matching server IDs
     */
    function filterEquipmentByServerIds(inventoryEquipment, rewardEquipmentIds) {
        if (!rewardEquipmentIds || rewardEquipmentIds.size === 0) {
            return [];
        }
        
        return inventoryEquipment.filter(invEquipment => {
            return rewardEquipmentIds.has(invEquipment.id);
        });
    }
    
    /**
     * Get equipment details from equipment data (similar to Better Exaltation Chest)
     * @param {Object} equipData - Equipment data from inventory or serverResults
     * @returns {Object|null} Equipment details or null
     */
    function getEquipmentDetails(equipData) {
        try {
            if (!equipData || !equipData.gameId) {
                return null;
            }
            
            // Get equipment name from game data
            let equipmentName = `Equipment ID ${equipData.gameId}`;
            try {
                const equipDataFromGame = globalThis.state?.utils?.getEquipment?.(equipData.gameId);
                if (equipDataFromGame && equipDataFromGame.metadata && equipDataFromGame.metadata.name) {
                    equipmentName = equipDataFromGame.metadata.name;
                }
            } catch (e) {
                // Ignore errors
            }
            
            // Calculate total genes (HP + AD + AP + Armor + Magic Resist)
            // Equipment from inventory should have these properties
            const hp = equipData.hp || 0;
            const ad = equipData.ad || 0;
            const ap = equipData.ap || 0;
            const armor = equipData.armor || 0;
            const magicResist = equipData.magicResist || 0;
            const totalGenes = hp + ad + ap + armor + magicResist;
            
            return {
                id: equipData.id,
                name: equipmentName,
                tier: equipData.tier || 1,
                stat: equipData.stat || 'unknown',
                gameId: equipData.gameId,
                hp,
                ad,
                ap,
                armor,
                magicResist,
                totalGenes
            };
        } catch (error) {
            console.warn('[Autoseller] Error getting equipment details:', error);
            return null;
        }
    }
    
    /**
     * Check if equipment should be disenchanted based on autoduster settings
     * @param {Object} equipment - Equipment details
     * @param {Object} settings - Autoseller settings
     * @returns {boolean} True if equipment should be disenchanted
     */
    function shouldDisenchantEquipment(equipment, settings) {
        if (!equipment) {
            return false;
        }
        
        const ignoreList = settings.autodusterIgnoreList || [];
        
        // Check if equipment is in ignore list
        if (equipment.name && ignoreList.includes(equipment.name)) {
            return false;
        }
        
        // Equipment should be dusted (no gene checking for equipment)
        return true;
    }
    
    /**
     * Disenchant equipment
     * @param {string} equipmentId - Equipment server ID
     * @returns {Promise<Object>} Result object with success status and dust gained
     */
    async function disenchantEquipment(equipmentId) {
        try {
            const payload = {
                "0": {
                    "json": equipmentId
                }
            };
            
            const url = 'https://bestiaryarena.com/api/trpc/game.equipToDust?batch=1';
            const result = await apiRequest(url, { method: 'POST', body: payload });
            
            if (!result.success) {
                if (result.status === 404) {
                    return { success: false, status: 404, message: 'Equipment not found' };
                }
                if (result.status === 429) {
                    return { success: false, status: 429, message: 'Rate limited' };
                }
                return { success: false, status: result.status, message: 'API request failed' };
            }
            
            const apiResponse = result.data;
            if (apiResponse && apiResponse[0]?.result?.data?.json?.dustDiff !== undefined) {
                const dustGained = apiResponse[0].result.data.json.dustDiff;
                // Log removed - consolidated with batch result
                return {
                    success: true,
                    dustGained: dustGained
                };
            } else {
                return {
                    success: false,
                    error: 'Invalid response format'
                };
            }
        } catch (error) {
            console.error(`[Autoseller] ❌ Error disenchanting equipment ${equipmentId}:`, error);
            return { success: false, error: error.message };
        }
    }
    
    async function getEligibleMonsters(settings, monsters) {
        if (!Array.isArray(monsters) || monsters.length === 0) {
            return { toSqueeze: [], toSell: [] };
        }
        
        const sellEnabled = settings.autoMode === 'autosell' || settings.autosellChecked;
        const squeezeEnabled = settings.autosqueezeChecked;
        
        if (!sellEnabled && !squeezeEnabled) {
            return { toSqueeze: [], toSell: [] };
        }
        
        const sellMinGenes = settings.autosellGenesMin ?? 5;
        const sellMaxGenes = settings.autosellGenesMax ?? 79;
        const squeezeMinGenes = settings.autosqueezeGenesMin ?? 80;
        const squeezeMaxGenes = settings.autosqueezeGenesMax ?? 100;
        const sellMinCount = settings.autosellMinCount ?? 1;
        const squeezeMinCount = settings.autosqueezeMinCount ?? 1;
        const maxExpThreshold = settings.autosellMaxExp ?? 52251;
        const squeezeIgnoreList = settings.autosqueezeIgnoreList || [];
        
        const toSqueeze = [];
        const toSell = [];
        
        const monsterCount = monsters.length;
        
        const hasDaycare = hasDaycareIconInInventory();
        let daycareMonsterIds = [];
        
        if (hasDaycare && (sellEnabled || squeezeEnabled)) {
            daycareMonsterIds = await fetchDaycareData();
        }
        
        for (let i = 0; i < monsterCount; i++) {
            const monster = monsters[i];
            
            if (monster.locked) {
                continue;
            }
            
            const hp = monster.hp || 0;
            const ad = monster.ad || 0;
            const ap = monster.ap || 0;
            const armor = monster.armor || 0;
            const magicResist = monster.magicResist || 0;
            const genes = hp + ad + ap + armor + magicResist;
            
            if (squeezeEnabled) {
                if (genes >= squeezeMinGenes && genes <= squeezeMaxGenes) {
                    // FAILSAFE: NEVER autosqueeze shiny creatures
                    if (isShinyCreature(monster)) {
                        continue;
                    }
                    if (hasDaycare && daycareMonsterIds.includes(monster.id)) {
                        continue;
                    }
                    
                    // Check ignore list
                    const creatureName = monster.name || (monster.gameId && globalThis.state?.utils?.getMonster?.(monster.gameId)?.metadata?.name);
                    if (creatureName && squeezeIgnoreList.includes(creatureName)) {
                        continue;
                    }
                    
                    toSqueeze.push(monster);
                }
            }
            else if (sellEnabled && genes >= sellMinGenes && genes <= sellMaxGenes) {
                // FAILSAFE: NEVER autosell shiny creatures
                if (isShinyCreature(monster)) {
                    continue;
                }
                
                const exp = monster.exp || 0;
                if (exp < maxExpThreshold) {
                    if (!hasDaycare || !daycareMonsterIds.includes(monster.id)) {
                        toSell.push(monster);
                    }
                }
            }
        }
        
        const finalToSqueeze = toSqueeze.length >= squeezeMinCount ? toSqueeze : [];
        const finalToSell = toSell.length >= sellMinCount ? toSell : [];
        
        return {
            toSqueeze: finalToSqueeze,
            toSell: finalToSell
        };
    }

    // =======================
    // 4. Data Management & Caching
    // =======================
    
    // Mutex for API calls to prevent race conditions
    const apiMutex = {
        daycare: false,
        monsters: false,
        
        async acquire(type) {
            while (this[type]) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            this[type] = true;
        },
        
        release(type) {
            this[type] = false;
        }
    };
    
    // Cache for daycare data to reduce API calls
    const daycareCache = {
        data: null,
        timestamp: 0,
        ttl: 30000,
        
        isValid() {
            return this.data && (Date.now() - this.timestamp) < this.ttl;
        },
        
        set(data) {
            this.data = data;
            this.timestamp = Date.now();
        },
        
        clear() {
            this.data = null;
            this.timestamp = 0;
        }
    };
    
    // Cache for server monsters to reduce API calls
    const serverMonsterCache = {
        data: null,
        timestamp: 0,
        ttl: 5000,
        
        isValid() {
            return this.data && (Date.now() - this.timestamp) < this.ttl;
        },
        
        set(data) {
            this.data = data;
            this.timestamp = Date.now();
        },
        
        clear() {
            this.data = null;
            this.timestamp = 0;
        }
    };
    
    // Shared rate limiter for all API operations
    const apiRateLimiter = {
        requestTimes: [],
        
        canMakeRequest() {
            const now = Date.now();
            this.requestTimes = this.requestTimes.filter(time => now - time < SELL_RATE_LIMIT.WINDOW_SIZE_MS);
            return this.requestTimes.length < SELL_RATE_LIMIT.MAX_MONSTERS_PER_10S;
        },
        
        recordRequest() {
            this.requestTimes.push(Date.now());
        },
        
        async waitForSlot() {
            while (!this.canMakeRequest()) {
                const waitTime = SELL_RATE_LIMIT.WINDOW_SIZE_MS - (Date.now() - Math.min(...this.requestTimes)) + 100;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    };

    // =======================
    // 5. API Utilities
    // =======================
    
    /**
     * Failsafe check to NEVER process shiny creatures
     * @param {Object} monster - Monster object to check
     * @returns {boolean} - true if monster is shiny, false otherwise
     */
    function isShinyCreature(monster) {
        if (!monster) return false;
        // Check shiny property (primary method used across Super Mods)
        if (monster.shiny === true) return true;
        // Additional check: if monster has metadata, check there too
        if (monster.metadata && monster.metadata.shiny === true) return true;
        return false;
    }
    
    async function apiRequest(url, options = {}, retries = API_CONSTANTS.RETRY_ATTEMPTS) {
        const { method = 'GET', body, headers = {} } = options;
        
        // X-Game-Version header is required by the API - without it, requests return HTTP 400
        const baseHeaders = {
            'content-type': 'application/json',
            'X-Game-Version': '1'
        };
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const requestOptions = {
                    method,
                    credentials: 'include',
                    headers: { ...baseHeaders, ...headers },
                    ...(body && { body: JSON.stringify(body) })
                };
                
                const resp = await fetch(url, requestOptions);
                const data = await resp.json().catch(() => null);
                
                if (!resp.ok) {
                    if (resp.status === 404) {
                        return { success: false, status: resp.status, data, isNotFound: true };
                    }
                    
                    if (resp.status >= 500 && attempt < retries) {
                        await new Promise(resolve => setTimeout(resolve, API_CONSTANTS.RETRY_DELAY_BASE * (attempt + 1)));
                        continue;
                    }
                    
                    return { success: false, status: resp.status, data };
                }
                
                return { success: true, status: resp.status, data };
                
            } catch (e) {
                if (attempt === retries) {
                    return { success: false, error: e, data: null };
                }
                await new Promise(resolve => setTimeout(resolve, API_CONSTANTS.RETRY_DELAY_BASE * (attempt + 1)));
            }
        }
    }
    
    async function fetchDaycareData() {
        if (daycareCache.isValid()) {
            return daycareCache.data;
        }
        
        await apiMutex.acquire('daycare');
        
        try {
            const myName = globalThis.state?.player?.getSnapshot?.()?.context?.name;
            if (!myName) {
                console.warn(`[${modName}][WARN][fetchDaycareData] Could not determine player name.`);
                return daycareCache.data || [];
            }
            
            const url = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=${encodeURIComponent(JSON.stringify({"0":{json:myName}}))}`;
            const result = await apiRequest(url);
            
            if (!result.success) {
                stateManager.updateErrorStats('fetchErrors');
                console.warn(`[${modName}][WARN][fetchDaycareData] API request failed, using cached data`);
                return daycareCache.data || [];
            }
            
            const profileData = result.data?.[0]?.result?.data?.json;
            const daycareSlots = profileData?.daycareSlots || [];
            
            const daycareMonsterIds = [];
            daycareSlots.forEach(slot => {
                if (slot.monsterId) {
                    daycareMonsterIds.push(slot.monsterId);
                }
            });
            
            daycareCache.set(daycareMonsterIds);
            
            return daycareMonsterIds;
        } finally {
            apiMutex.release('daycare');
        }
    }
    
    function hasDaycareIconInInventory() {
        try {
            const creatureSlots = queryAllElements(UI_CONSTANTS.SELECTORS.CREATURE_SLOTS);
            
            for (const slot of creatureSlots) {
                const daycareIcon = slot.querySelector(UI_CONSTANTS.SELECTORS.DAYCARE_ICON);
                if (daycareIcon) {
                    return true;
                }
            }
            
            return false;
        } catch (e) {
            console.warn(`[${modName}][WARN][hasDaycareIconInInventory] Error checking for daycare icon in DOM`, e);
            return false;
        }
    }
    
    async function isCreatureInDaycare(monsterId) {
        try {
            const creatureSlots = queryAllElements(UI_CONSTANTS.SELECTORS.CREATURE_SLOTS);
            let foundDaycareIcon = false;
            let foundMonsterInDaycare = false;
            
            for (const slot of creatureSlots) {
                const daycareIcon = slot.querySelector(UI_CONSTANTS.SELECTORS.DAYCARE_ICON);
                if (daycareIcon) {
                    foundDaycareIcon = true;
                    
                    const creatureImg = slot.querySelector(UI_CONSTANTS.SELECTORS.CREATURE_IMG);
                    if (creatureImg) {
                        const srcMatch = creatureImg.src.match(/\/assets\/portraits\/(\d+)\.png$/);
                        if (srcMatch) {
                            const slotMonsterId = parseInt(srcMatch[1]);
                            if (slotMonsterId === monsterId) {
                                foundMonsterInDaycare = true;
                                return true;
                            }
                        }
                    }
                }
            }
            
            if (foundDaycareIcon && !foundMonsterInDaycare) {
                const daycareMonsterIds = await fetchDaycareData();
                const isInDaycare = daycareMonsterIds.includes(monsterId);
                return isInDaycare;
            }
            
            return false;
        } catch (e) {
            console.warn(`[${modName}][WARN][isCreatureInDaycare] Error checking daycare status for monster ${monsterId}`, e);
            return false;
        }
    }
    
    async function fetchServerMonsters() {
        if (serverMonsterCache.isValid()) {
            return serverMonsterCache.data;
        }
        
        await apiMutex.acquire('monsters');
        
        try {
            const myName = globalThis.state?.player?.getSnapshot?.()?.context?.name;
            if (!myName) {
                console.warn(`[${modName}][WARN][fetchServerMonsters] Could not determine player name.`);
                return serverMonsterCache.data || [];
            }
            
            const url = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=${encodeURIComponent(JSON.stringify({"0":{json:myName}}))}`;
            const result = await apiRequest(url);
            
            if (!result.success) {
                stateManager.updateErrorStats('fetchErrors');
                console.warn(`[${modName}][WARN][fetchServerMonsters] API request failed, using cached data`);
                return serverMonsterCache.data || [];
            }
            
            const monsters = result.data?.[0]?.result?.data?.json?.monsters || [];
            
            serverMonsterCache.set(monsters);
            
            return monsters;
        } finally {
            apiMutex.release('monsters');
        }
    }
    
    async function removeMonstersFromLocalInventory(idsToRemove, retryCount = 0, verificationRetryCount = 0) {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 500;
        const VERIFICATION_DELAY = 10; // ms - wait for state to update
        const VERIFICATION_RETRY_DELAYS = [1000, 2000, 4000]; // ms - delays for verification retries
        const MAX_VERIFICATION_RETRIES = 3;
        
        try {
            // Validation
            if (!Array.isArray(idsToRemove) || idsToRemove.length === 0) {
                console.warn(`[${modName}][WARN][removeMonstersFromLocalInventory] Invalid or empty IDs array provided`);
                return { success: false, removed: [] };
            }
            
            // State checks
            if (!globalThis.state?.player) {
                console.warn(`[${modName}][WARN][removeMonstersFromLocalInventory] Player state not available`);
                inventoryUpdateTracker.recordFailure();
                return { success: false, removed: [] };
            }
            
            const player = globalThis.state.player;
            if (typeof player.send !== 'function' || typeof player.getSnapshot !== 'function') {
                console.warn(`[${modName}][WARN][removeMonstersFromLocalInventory] Player methods not available`);
                inventoryUpdateTracker.recordFailure();
                return { success: false, removed: [] };
            }
            
            // Get pre-update state for verification
            const preState = player.getSnapshot();
            if (!preState?.context?.monsters || !Array.isArray(preState.context.monsters)) {
                console.warn(`[${modName}][WARN][removeMonstersFromLocalInventory] Monsters array not available`);
                inventoryUpdateTracker.recordFailure();
                return { success: false, removed: [] };
            }
            
            const preCount = preState.context.monsters.length;
            const idsToRemoveSet = new Set(idsToRemove);
            
            // Removed verbose INFO log - only log on success/error
            
            // Perform state update
            player.send({
                type: "setState",
                fn: (prev) => {
                    if (!prev || !Array.isArray(prev.monsters)) {
                        console.warn(`[${modName}][WARN][removeMonstersFromLocalInventory] Invalid previous state`);
                        return prev;
                    }
                    
                    return {
                        ...prev,
                        monsters: prev.monsters.filter(m => !idsToRemoveSet.has(m.id))
                    };
                },
            });
            
            // Wait for state to update (initial delay)
            await new Promise(resolve => setTimeout(resolve, VERIFICATION_DELAY));
            
            // Verification with retry logic
            let postState = player.getSnapshot();
            let postCount = postState?.context?.monsters?.length ?? preCount;
            let removedCount = preCount - postCount;
            
            // Wait 1000ms before first verification check
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check if removal was successful
            postState = player.getSnapshot();
            if (!postState?.context?.monsters) {
                console.warn(`[${modName}][WARN][removeMonstersFromLocalInventory] Could not verify update - state unavailable`);
                inventoryUpdateTracker.recordFailure();
                
                // Retry if we haven't exceeded max retries
                if (retryCount < MAX_RETRIES) {
                    console.log(`[${modName}][INFO][removeMonstersFromLocalInventory] Retrying (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
                    return removeMonstersFromLocalInventory(idsToRemove, retryCount + 1, 0);
                }
                
                return { success: false, removed: [] };
            }
            
            postCount = postState.context.monsters.length;
            removedCount = preCount - postCount;
            
            // If removal wasn't successful and we haven't exceeded verification retries, retry with increasing delays
            if (removedCount === 0 && verificationRetryCount < MAX_VERIFICATION_RETRIES) {
                const delay = VERIFICATION_RETRY_DELAYS[verificationRetryCount] || VERIFICATION_RETRY_DELAYS[VERIFICATION_RETRY_DELAYS.length - 1];
                console.log(`[${modName}][INFO][removeMonstersFromLocalInventory] Verification failed, retrying verification after ${delay}ms (attempt ${verificationRetryCount + 1}/${MAX_VERIFICATION_RETRIES})...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return removeMonstersFromLocalInventory(idsToRemove, retryCount, verificationRetryCount + 1);
            }
            
            if (removedCount > 0) {
                // Removed verbose success log - inventory updates are implicit in action logs
                inventoryUpdateTracker.recordSuccess(removedCount);
            } else if (verificationRetryCount >= MAX_VERIFICATION_RETRIES) {
                console.warn(`[${modName}][WARN][removeMonstersFromLocalInventory] Verification failed after ${MAX_VERIFICATION_RETRIES} retries. Inventory count unchanged: ${preCount}`);
                inventoryUpdateTracker.recordFailure();
            }
            
            return { 
                success: removedCount > 0, 
                removed: idsToRemove,
                preCount,
                postCount
            };
            
        } catch (e) {
            console.error(`[${modName}][ERROR][removeMonstersFromLocalInventory] Exception during update: ${e.message}`, e);
            inventoryUpdateTracker.recordFailure();
            
            // Retry on exception if we haven't exceeded max retries
            if (retryCount < MAX_RETRIES) {
                console.log(`[${modName}][INFO][removeMonstersFromLocalInventory] Retrying after exception (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
                return removeMonstersFromLocalInventory(idsToRemove, retryCount + 1, 0);
            }
            
            return { success: false, removed: [], error: e.message };
        }
    }
    
    async function removeEquipmentFromLocalInventory(idsToRemove, retryCount = 0, verificationRetryCount = 0) {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 500;
        const VERIFICATION_DELAY = 10; // ms - wait for state to update
        const VERIFICATION_RETRY_DELAYS = [1000, 2000, 4000]; // ms - delays for verification retries
        const MAX_VERIFICATION_RETRIES = 3;
        
        try {
            // Validation
            if (!Array.isArray(idsToRemove) || idsToRemove.length === 0) {
                console.warn(`[${modName}][WARN][removeEquipmentFromLocalInventory] Invalid or empty IDs array provided`);
                return { success: false, removed: [] };
            }
            
            // State checks
            if (!globalThis.state?.player) {
                console.warn(`[${modName}][WARN][removeEquipmentFromLocalInventory] Player state not available`);
                return { success: false, removed: [] };
            }
            
            const player = globalThis.state.player;
            if (typeof player.send !== 'function' || typeof player.getSnapshot !== 'function') {
                console.warn(`[${modName}][WARN][removeEquipmentFromLocalInventory] Player methods not available`);
                return { success: false, removed: [] };
            }
            
            // Get pre-update state for verification
            const preState = player.getSnapshot();
            if (!preState?.context?.equips || !Array.isArray(preState.context.equips)) {
                console.warn(`[${modName}][WARN][removeEquipmentFromLocalInventory] Equipment array not available`);
                return { success: false, removed: [] };
            }
            
            const preCount = preState.context.equips.length;
            const idsToRemoveSet = new Set(idsToRemove);
            
            // Removed verbose INFO log - only log on success/error
            
            // Perform state update
            player.send({
                type: "setState",
                fn: (prev) => {
                    if (!prev) {
                        console.warn(`[${modName}][WARN][removeEquipmentFromLocalInventory] Invalid previous state`);
                        return prev;
                    }
                    
                    // Handle both possible state structures (like Better Forge does)
                    if (prev?.equips && Array.isArray(prev.equips)) {
                        return {
                            ...prev,
                            equips: prev.equips.filter(e => !idsToRemoveSet.has(e.id))
                        };
                    }
                    
                    if (prev?.context?.equips && Array.isArray(prev.context.equips)) {
                        return {
                            ...prev,
                            context: {
                                ...prev.context,
                                equips: prev.context.equips.filter(e => !idsToRemoveSet.has(e.id))
                            }
                        };
                    }
                    
                    console.warn(`[${modName}][WARN][removeEquipmentFromLocalInventory] Equipment array not found in state`);
                    return prev;
                },
            });
            
            // Wait for state to update (initial delay)
            await new Promise(resolve => setTimeout(resolve, VERIFICATION_DELAY));
            
            // Verification with retry logic
            let postState = player.getSnapshot();
            let postCount = (postState?.context?.equips?.length ?? postState?.equips?.length) ?? preCount;
            let removedCount = preCount - postCount;
            
            // Wait 1000ms before first verification check
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check if removal was successful
            postState = player.getSnapshot();
            if (!postState?.context?.equips && !postState?.equips) {
                console.warn(`[${modName}][WARN][removeEquipmentFromLocalInventory] Could not verify update - state unavailable`);
                
                // Retry if we haven't exceeded max retries
                if (retryCount < MAX_RETRIES) {
                    console.log(`[${modName}][INFO][removeEquipmentFromLocalInventory] Retrying (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
                    return removeEquipmentFromLocalInventory(idsToRemove, retryCount + 1, 0);
                }
                
                return { success: false, removed: [] };
            }
            
            postCount = postState.context?.equips?.length ?? postState.equips?.length ?? preCount;
            removedCount = preCount - postCount;
            
            // If removal wasn't successful and we haven't exceeded verification retries, retry with increasing delays
            if (removedCount === 0 && verificationRetryCount < MAX_VERIFICATION_RETRIES) {
                const delay = VERIFICATION_RETRY_DELAYS[verificationRetryCount] || VERIFICATION_RETRY_DELAYS[VERIFICATION_RETRY_DELAYS.length - 1];
                console.log(`[${modName}][INFO][removeEquipmentFromLocalInventory] Verification failed, retrying verification after ${delay}ms (attempt ${verificationRetryCount + 1}/${MAX_VERIFICATION_RETRIES})...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return removeEquipmentFromLocalInventory(idsToRemove, retryCount, verificationRetryCount + 1);
            }
            
            if (removedCount > 0) {
                // Removed verbose success log - inventory updates are implicit in action logs
            } else if (verificationRetryCount >= MAX_VERIFICATION_RETRIES) {
                console.warn(`[${modName}][WARN][removeEquipmentFromLocalInventory] Verification failed after ${MAX_VERIFICATION_RETRIES} retries. Inventory count unchanged: ${preCount}`);
            }
            
            return { 
                success: removedCount > 0, 
                removed: idsToRemove,
                preCount,
                postCount
            };
            
        } catch (e) {
            console.error(`[${modName}][ERROR][removeEquipmentFromLocalInventory] Exception during update: ${e.message}`, e);
            
            // Retry on exception if we haven't exceeded max retries
            if (retryCount < MAX_RETRIES) {
                console.log(`[${modName}][INFO][removeEquipmentFromLocalInventory] Retrying after exception (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
                return removeEquipmentFromLocalInventory(idsToRemove, retryCount + 1, 0);
            }
            
            return { success: false, removed: [], error: e.message };
        }
    }

    // =======================
    // 6. UI Utilities & Components
    // =======================
    
    function createElement(tag, options = {}) {
        const element = document.createElement(tag);
        
        if (options.styles) {
            Object.assign(element.style, options.styles);
        }
        
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        
        if (options.className) {
            element.className = options.className;
        }
        
        if (options.text) {
            element.textContent = options.text;
        }
        
        if (options.html) {
            element.innerHTML = options.html;
        }
        
        if (options.events) {
            Object.entries(options.events).forEach(([event, handler]) => {
                element.addEventListener(event, handler);
            });
        }
        
        if (options.children) {
            options.children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else {
                    element.appendChild(child);
                }
            });
        }
        
        return element;
    }
    
    function createInput(options = {}) {
        const defaultStyles = {
            width: options.width || 'auto',
            marginRight: options.marginRight || '0',
            textAlign: options.textAlign || 'left',
            borderRadius: options.borderRadius || UI_CONSTANTS.COMMON_STYLES.BORDER_RADIUS,
            border: options.border || UI_CONSTANTS.COMMON_STYLES.INPUT_BORDER,
            background: options.background || UI_CONSTANTS.COMMON_STYLES.BACKGROUND_COLOR,
            color: options.color || UI_CONSTANTS.COMMON_STYLES.PRIMARY_COLOR,
            fontWeight: options.fontWeight || 'bold',
            fontSize: options.fontSize || '16px',
            ...options.styles
        };
        
        return createElement('input', {
            attributes: {
                type: options.type || 'text',
                ...(options.min !== undefined && { min: options.min }),
                ...(options.max !== undefined && { max: options.max }),
                ...(options.step !== undefined && { step: options.step }),
                ...(options.id && { id: options.id }),
                ...(options.autocomplete && { autocomplete: options.autocomplete })
            },
            styles: defaultStyles,
            className: options.className || UI_CONSTANTS.COMMON_STYLES.PIXEL_FONT,
            events: options.events || {},
            ...options
        });
    }
    
    function createBox({title, content, icon = null, tabs = null, verticalAlign = 'space-between'}) {
        const box = document.createElement('div');
        box.style.flex = '1 1 0';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.margin = '0';
        box.style.padding = '0';
        box.style.minHeight = '0';
        box.style.height = '100%';
        box.style.background = "url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat";
        box.style.border = '4px solid transparent';
        box.style.borderImage = `url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch`;
        box.style.borderRadius = '6px';
        box.style.overflow = 'hidden';
        
        const titleEl = document.createElement('h2');
        titleEl.className = 'widget-top widget-top-text pixel-font-16';
        titleEl.style.margin = '0';
        titleEl.style.padding = '2px 8px';
        titleEl.style.textAlign = 'center';
        titleEl.style.color = 'rgb(255, 255, 255)';
        
        // If tabs are provided, create tab navigation instead of simple title
        if (tabs && tabs.length > 0) {
            const tabContainer = document.createElement('div');
            tabContainer.style.display = 'flex';
            tabContainer.style.width = '100%';
            tabContainer.style.height = '100%';
            
            tabs.forEach((tab, index) => {
                const tabBtn = document.createElement('button');
                tabBtn.className = 'pixel-font-16';
                tabBtn.style.flex = '1';
                tabBtn.style.margin = '0';
                tabBtn.style.padding = '2px 4px';
                tabBtn.style.textAlign = 'center';
                tabBtn.style.color = 'rgb(255, 255, 255)';
                tabBtn.style.display = 'flex';
                tabBtn.style.alignItems = 'center';
                tabBtn.style.justifyContent = 'center';
                tabBtn.style.gap = '4px';
                tabBtn.style.border = 'none';
                tabBtn.style.background = 'transparent';
                tabBtn.style.cursor = 'pointer';
                tabBtn.style.borderBottom = index === 0 ? '2px solid #ffe066' : '2px solid transparent';
                tabBtn.style.fontSize = '14px';
                tabBtn.style.fontWeight = 'bold';
                
                if (tab.icon) {
                    if (tab.icon.includes('plant.png')) {
                        // Use SVG for plant icon
                        const iconDiv = document.createElement('div');
                        iconDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sprout"><path d="M7 20h10"></path><path d="M10 20c5.5-2.5.8-6.4 3-10"></path><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"></path><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"></path></svg>';
                        iconDiv.style.color = 'currentColor';
                        iconDiv.style.display = 'flex';
                        iconDiv.style.alignItems = 'center';
                        tabBtn.appendChild(iconDiv);
                    } else {
                        // Use regular img for other icons
                        const iconImg = document.createElement('img');
                        iconImg.src = tab.icon;
                        iconImg.alt = 'Icon';
                        iconImg.width = 12;
                        iconImg.height = 12;
                        iconImg.style.verticalAlign = 'middle';
                        tabBtn.appendChild(iconImg);
                    }
                }
                
                const tabText = document.createElement('span');
                tabText.textContent = tab.title;
                tabBtn.appendChild(tabText);
                
                tabBtn.addEventListener('click', () => {
                    // Update tab button styles
                    tabs.forEach((_, i) => {
                        const btn = tabContainer.children[i];
                        btn.style.borderBottom = i === index ? '2px solid #ffe066' : '2px solid transparent';
                        btn.style.color = i === index ? 'rgb(255, 255, 255)' : 'rgb(144, 144, 144)';
                    });
                    
                    // Show/hide tab content
                    const contentWrapper = box.querySelector('.column-content-wrapper');
                    if (contentWrapper) {
                        contentWrapper.innerHTML = '';
                        // Apply tab-specific vertical alignment
                        if (tab.verticalAlign) {
                            contentWrapper.style.justifyContent = tab.verticalAlign;
                        }
                        if (tab.content instanceof HTMLElement) {
                            contentWrapper.appendChild(tab.content);
                        } else if (typeof tab.content === 'string') {
                            contentWrapper.innerHTML = tab.content;
                        }
                    }
                });
                
                tabContainer.appendChild(tabBtn);
            });
            
            titleEl.appendChild(tabContainer);
        } else {
            // Original title logic for non-tabbed boxes
            const p = document.createElement('p');
            p.className = 'pixel-font-16';
            p.style.margin = '0';
            p.style.padding = '0';
            p.style.textAlign = 'center';
            p.style.color = 'rgb(255, 255, 255)';
            p.style.display = 'flex';
            p.style.alignItems = 'center';
            p.style.justifyContent = 'center';
            p.style.gap = '6px';
            
            if (icon) {
                const iconImg = document.createElement('img');
                iconImg.src = icon;
                iconImg.alt = 'Icon';
                iconImg.width = 16;
                iconImg.height = 16;
                iconImg.style.verticalAlign = 'middle';
                p.appendChild(iconImg);
            }
            
            const titleText = document.createElement('span');
            titleText.textContent = title;
            p.appendChild(titleText);
            titleEl.appendChild(p);
        }
        
        box.appendChild(titleEl);
        
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'column-content-wrapper';
        contentWrapper.style.flex = '1 1 0';
        contentWrapper.style.height = '100%';
        contentWrapper.style.minHeight = '0';
        contentWrapper.style.overflowY = 'auto';
        contentWrapper.style.display = 'flex';
        contentWrapper.style.flexDirection = 'column';
        contentWrapper.style.alignItems = 'flex-start';
        contentWrapper.style.justifyContent = verticalAlign;
        contentWrapper.style.padding = '10px';
        
        // Handle content based on whether it's tabbed or not
        if (tabs && tabs.length > 0) {
            // For tabbed content, show the first tab by default
            // Apply first tab's vertical alignment if specified
            if (tabs[0].verticalAlign) {
                contentWrapper.style.justifyContent = tabs[0].verticalAlign;
            }
            if (tabs[0].content instanceof HTMLElement) {
                contentWrapper.appendChild(tabs[0].content);
            } else if (typeof tabs[0].content === 'string') {
                contentWrapper.innerHTML = tabs[0].content;
            }
        } else {
            // Original content logic
            if (content instanceof HTMLElement && content.querySelector && content.querySelector('div[style*="color: #ffe066"]')) {
                const statusArea = content.querySelector('div[style*="flex-direction: column"]');
                const topContent = document.createElement('div');
                Array.from(content.childNodes).forEach(child => {
                    if (child !== statusArea) topContent.appendChild(child.cloneNode(true));
                });
                contentWrapper.appendChild(topContent);
                if (statusArea) contentWrapper.appendChild(statusArea.cloneNode(true));
            } else if (typeof content === 'string') {
                contentWrapper.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                contentWrapper.appendChild(content);
            }
        }
        
        box.appendChild(contentWrapper);
        return box;
    }
    
    function createDescriptionRow(description) {
        return createElement('div', {
            styles: {
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                margin: '6px 0 10px 0'
            },
            children: [
                createLabel(description, { fontSize: '13px' })
            ]
        });
    }
    
    function createWarningRow(warningText, showTooltip = false) {
        // Handle both "ALL" (English) and "TODAS" (Portuguese)
        const allWord = warningText.includes('TODAS') ? 'TODAS' : 'ALL';
        const parts = warningText.split(allWord);
        const beforeAll = parts[0];
        const afterAll = parts[1];
        
        const allSpan = createElement('span', { 
            text: allWord,
            styles: { 
                textDecoration: 'underline',
                color: '#4A90E2',
                cursor: showTooltip ? 'help' : 'default'
            }
        });
        
        if (showTooltip) {
            // Check for both English "sell" and Portuguese "venderá"
            const isAutosell = warningText.includes('sell') || warningText.includes('venderá');
            const tooltipText = isAutosell 
                ? t('mods.autoseller.tooltipSellAll')
                : t('mods.autoseller.tooltipSqueezeAll');
            
            allSpan.title = tooltipText;
            
            allSpan.addEventListener('mouseenter', () => {
                allSpan.style.textDecoration = 'underline double';
                allSpan.style.color = '#87CEEB';
            });
            
            allSpan.addEventListener('mouseleave', () => {
                allSpan.style.textDecoration = 'underline';
                allSpan.style.color = '#4A90E2';
            });
        }
        
        return createElement('div', {
            styles: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                margin: '4px 0 8px 0'
            },
            children: [
                createElement('span', {
                    text: '⚠️',
                    className: 'pixel-font-16',
                    styles: {
                        color: '#ff6b6b',
                        fontSize: '13px',
                        fontWeight: 'bold'
                    }
                }),
                createElement('span', {
                    className: 'pixel-font-16',
                    styles: {
                        color: '#ff6b6b',
                        fontSize: '13px',
                        fontWeight: 'bold'
                    },
                    children: [
                        createElement('span', { text: beforeAll }),
                        allSpan,
                        createElement('span', { text: afterAll })
                    ]
                })
            ]
        });
    }
    
    function createCheckboxRow(persistKey, label, icon = null) {
        const checkbox = createInput({
            type: 'checkbox',
            id: persistKey + '-checkbox',
            styles: {
                marginRight: '8px'
            }
        });
        
        const labelEl = createElement('label', {
            attributes: { htmlFor: checkbox.id },
            className: 'pixel-font-16',
            styles: {
                fontWeight: 'bold',
                fontSize: '14px',
                color: '#ffffff',
                marginRight: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
            }
        });
        
        if (icon) {
            const iconImg = createElement('img', {
                attributes: {
                    src: icon,
                    alt: 'Icon',
                    width: '14',
                    height: '14'
                },
                styles: {
                    verticalAlign: 'middle'
                }
            });
            labelEl.appendChild(iconImg);
        }
        
        const labelText = createElement('span', {
            text: label
        });
        labelEl.appendChild(labelText);
        
        const row = createElement('div', {
            styles: {
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                marginBottom: '10px'
            },
            children: [checkbox, labelEl]
        });
        
        return { row, checkbox, label: labelEl };
    }
    
    function createGeneInputRow(opts) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.width = '100%';
        row.style.marginBottom = '12px';
        
        const inputLabel = document.createElement('span');
        inputLabel.textContent = opts.inputLabel + ': ' + t('mods.autoseller.between');
        inputLabel.className = 'pixel-font-16';
        inputLabel.style.marginRight = '6px';
        inputLabel.style.fontWeight = 'bold';
        inputLabel.style.fontSize = '14px';
        inputLabel.style.color = '#cccccc';
        row.appendChild(inputLabel);
        
        const inputMin = document.createElement('input');
        inputMin.type = 'number';
        inputMin.min = opts.inputMin;
        inputMin.max = opts.inputMax;
        inputMin.value = opts.defaultMin;
        inputMin.className = 'pixel-font-16';
        inputMin.style.width = UI_CONSTANTS.INPUT_WIDTH + 'px';
        inputMin.style.marginRight = '4px';
        inputMin.style.textAlign = 'center';
        inputMin.style.borderRadius = '3px';
        inputMin.style.border = '1px solid #ffe066';
        inputMin.style.background = '#232323';
        inputMin.style.color = '#ffe066';
        inputMin.style.fontWeight = 'bold';
        inputMin.style.fontSize = '16px';
        inputMin.step = UI_CONSTANTS.INPUT_STEP;
        row.appendChild(inputMin);
        
        const andText = document.createElement('span');
        andText.textContent = t('mods.autoseller.and');
        andText.className = 'pixel-font-16';
        andText.style.margin = '0 4px';
        andText.style.color = '#cccccc';
        row.appendChild(andText);
        
        const inputMax = document.createElement('input');
        inputMax.type = 'number';
        inputMax.min = opts.inputMin;
        inputMax.max = opts.inputMax;
        inputMax.value = opts.defaultMax;
        inputMax.className = 'pixel-font-16';
        inputMax.style.width = UI_CONSTANTS.INPUT_WIDTH + 'px';
        inputMax.style.marginRight = '4px';
        inputMax.style.textAlign = 'center';
        inputMax.style.borderRadius = '3px';
        inputMax.style.border = '1px solid #ffe066';
        inputMax.style.background = '#232323';
        inputMax.style.color = '#ffe066';
        inputMax.style.fontWeight = 'bold';
        inputMax.style.fontSize = '16px';
        inputMax.step = UI_CONSTANTS.INPUT_STEP;
        row.appendChild(inputMax);
        
        const percent = document.createElement('span');
        percent.textContent = '%';
        percent.className = 'pixel-font-16';
        percent.style.fontWeight = 'bold';
        percent.style.fontSize = '16px';
        percent.style.color = '#cccccc';
        row.appendChild(percent);
        
        return { row, inputMin, inputMax };
    }
    
    /**
     * Creates a segment container (for autoplant and autosqueeze buttons)
     * @returns {HTMLElement} The segment container element
     */
    function createSegmentContainer() {
        const container = document.createElement('div');
        const colors = UI_CONSTANTS.BUTTON_COLORS;
        const sizes = UI_CONSTANTS.BUTTON_SIZES;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'flex-start';
        container.style.gap = '0';
        container.style.width = '100%';
        container.style.height = sizes.HEIGHT;
        container.style.border = `2px solid ${colors.BORDER}`;
        container.style.borderRadius = '4px';
        container.style.overflow = 'hidden';
        container.style.backgroundColor = colors.INACTIVE_BG;
        container.style.pointerEvents = 'auto';
        container.style.position = 'relative';
        return container;
    }
    
    /**
     * Creates a segment button (for autoplant and autosqueeze)
     * @param {string} text - Button text
     * @param {number} width - Button width in pixels
     * @param {boolean} borderRight - Whether to show right border
     * @returns {HTMLElement} The button element
     */
    function createSegmentButton(text, width, borderRight = true) {
        const button = document.createElement('button');
        button.className = 'pixel-font-14';
        button.textContent = text;
        button.type = 'button';
        
        // Common styles
        Object.assign(button.style, {
            flex: `0 0 ${width}px`,
            flexGrow: '0',
            flexShrink: '0',
            flexBasis: `${width}px`,
            height: '100%',
            width: `${width}px`,
            minWidth: `${width}px`,
            maxWidth: `${width}px`,
            border: 'none',
            borderRight: borderRight ? `1px solid ${UI_CONSTANTS.BUTTON_COLORS.BORDER}` : 'none',
            backgroundColor: UI_CONSTANTS.BUTTON_COLORS.INACTIVE_BG,
            color: UI_CONSTANTS.BUTTON_COLORS.INACTIVE_TEXT,
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            transition: 'background-color 0.2s, color 0.2s, text-shadow 0.2s',
            pointerEvents: 'auto',
            position: 'relative',
            zIndex: '10',
            padding: '0',
            textAlign: 'center',
            userSelect: 'none'
        });
        
        // Store original styles for hover effect
        let isActive = false;
        let originalBg = '#1a1a1a';
        let originalColor = '#888888';
        
        // Add hover effect for inactive buttons
        button.addEventListener('mouseenter', () => {
            if (!isActive) {
                button.style.backgroundColor = '#2a2a2a';
                button.style.color = '#aaaaaa';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            if (!isActive) {
                button.style.backgroundColor = originalBg;
                button.style.color = originalColor;
            }
        });
        
        // Expose method to update active state
        button._updateActiveState = (active, bg, color) => {
            isActive = active;
            originalBg = bg;
            originalColor = color;
        };
        
        return button;
    }
    
    /**
     * Creates a checkbox with label and optional number input row (for autoplant gene settings)
     * @param {Object} options - Configuration options
     * @param {string} options.checkboxId - ID for the checkbox
     * @param {string} options.labelText - Label text
     * @param {boolean} options.checked - Initial checked state
     * @param {Function} options.onCheckboxChange - Callback when checkbox changes
     * @param {Object} options.input - Optional input configuration { min, max, value, onChange, settingKey }
     * @param {string} options.suffixText - Optional suffix text after input
     * @returns {Object} { container, checkbox, label, input, suffix }
     */
    function createCheckboxLabelInputRow({ checkboxId, labelText, checked, onCheckboxChange, input, suffixText }) {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'flex-start';
        container.style.gap = '6px';
        container.style.marginTop = '4px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.checked = checked;
        checkbox.style.cursor = 'pointer';
        if (onCheckboxChange) {
            checkbox.addEventListener('change', onCheckboxChange);
        }
        
        const label = document.createElement('label');
        label.className = 'pixel-font-14';
        label.textContent = labelText;
        const inputStyles = UI_CONSTANTS.INPUT_STYLES;
        const colors = UI_CONSTANTS.BUTTON_COLORS;
        label.style.fontSize = inputStyles.FONT_SIZE_MEDIUM;
        label.style.color = colors.PRIMARY_TEXT;
        label.style.cursor = 'pointer';
        label.htmlFor = checkboxId;
        
        container.appendChild(checkbox);
        container.appendChild(label);
        
        let inputElement = null;
        let suffixElement = null;
        
        if (input) {
            inputElement = document.createElement('input');
            inputElement.type = 'number';
            inputElement.min = input.min;
            inputElement.max = input.max;
            inputElement.step = '1';
            inputElement.value = input.value;
            Object.assign(inputElement.style, {
                width: inputStyles.WIDTH_MEDIUM,
                padding: inputStyles.PADDING,
                fontSize: inputStyles.FONT_SIZE_SMALL,
                textAlign: 'center',
                backgroundColor: inputStyles.BACKGROUND,
                color: colors.PRIMARY_TEXT,
                border: inputStyles.BORDER,
                borderRadius: inputStyles.BORDER_RADIUS
            });
            
            if (input.onChange) {
                inputElement.addEventListener('change', input.onChange);
            }
            
            container.appendChild(inputElement);
            
            if (suffixText) {
                suffixElement = document.createElement('span');
                suffixElement.className = 'pixel-font-14';
                suffixElement.textContent = suffixText;
                suffixElement.style.fontSize = inputStyles.FONT_SIZE_MEDIUM;
                suffixElement.style.color = colors.PRIMARY_TEXT;
                container.appendChild(suffixElement);
            }
        }
        
        return { container, checkbox, label, input: inputElement, suffix: suffixElement };
    }
    
    function createMinCountRow(opts) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.width = '100%';
        row.style.marginBottom = '12px';
        
        const minCountLabel = document.createElement('span');
        minCountLabel.textContent = t('mods.autoseller.triggerWhen');
        minCountLabel.className = 'pixel-font-16';
        minCountLabel.style.marginRight = '6px';
        minCountLabel.style.fontWeight = 'bold';
        minCountLabel.style.fontSize = '14px';
        minCountLabel.style.color = '#cccccc';
        row.appendChild(minCountLabel);
        
        const minCountInput = document.createElement('input');
        minCountInput.type = 'number';
        minCountInput.min = 1;
        minCountInput.max = 20;
        minCountInput.value = opts.defaultMinCount || 1;
        minCountInput.className = 'pixel-font-16';
        minCountInput.style.width = '48px';
        minCountInput.style.marginRight = '4px';
        minCountInput.style.textAlign = 'center';
        minCountInput.style.borderRadius = '3px';
        minCountInput.style.border = '1px solid #ffe066';
        minCountInput.style.background = '#232323';
        minCountInput.style.color = '#ffe066';
        minCountInput.style.fontWeight = 'bold';
        minCountInput.style.fontSize = '16px';
        minCountInput.step = '1';
        
        function validateMinCountInput() {
            const val = Math.max(1, Math.min(20, parseInt(minCountInput.value, 10) || 1));
            minCountInput.value = val;
        }
        
        minCountInput.addEventListener('input', validateMinCountInput);
        minCountInput.addEventListener('blur', validateMinCountInput);
        row.appendChild(minCountInput);
        
        const minCountSuffix = document.createElement('span');
        minCountSuffix.textContent = t('mods.autoseller.creaturesSuffix');
        minCountSuffix.className = 'pixel-font-16';
        minCountSuffix.style.color = '#cccccc';
        row.appendChild(minCountSuffix);
        
        return { row, minCountInput, validateMinCountInput };
    }
    
    function createAutplantPlaceholder() {
        const placeholder = document.createElement('div');
        placeholder.style.display = 'flex';
        placeholder.style.flexDirection = 'column';
        placeholder.style.height = '100%';
        placeholder.style.minHeight = '0';
        
        // Mode selection container
        const modeContainer = document.createElement('div');
        modeContainer.style.display = 'flex';
        modeContainer.style.flexDirection = 'row';
        modeContainer.style.gap = UI_CONSTANTS.SPACING.GAP_MEDIUM;
        modeContainer.style.marginBottom = UI_CONSTANTS.SPACING.MARGIN_BOTTOM_BUTTON;
        modeContainer.style.alignItems = 'flex-start';
        
        // Set initial state from saved settings
        let currentModeSettings = getSettings();
        let currentMode = currentModeSettings.autoMode || null;
        
        // Function to create a toggle button (like autosqueeze/autoduster style)
        const createToggleButton = (text, isActive, onClick, activeColor = 'green') => {
            const button = document.createElement('button');
            button.className = 'pixel-font-14';
            button.type = 'button';
            button.textContent = text;
            
            // Apply button styles using helper function
            applyButtonStyles(button, isActive, activeColor, { marginBottom: '0' });
            
            button.addEventListener('click', onClick);
            
            return button;
        };
        
        // Create individual toggle buttons
        const isAutosellActive = currentMode === 'autosell';
        const isOffActive = currentMode === null;
        const isAutoplantActive = currentMode === 'autoplant';
        const dragonPlantPurchased = hasDragonPlant();
        
        const autosellButton = createToggleButton(
            t('mods.autoseller.autosellLabel'),
            isAutosellActive,
            () => handleModeChange('autosell'),
            'green' // Green when active
        );
        
        const offButton = createToggleButton(
            t('mods.autoseller.off') || 'Off',
            isOffActive,
            () => handleModeChange(null),
            'red' // Red when active
        );
        
        const autoplantButton = createToggleButton(
            t('mods.autoseller.autoplantLabel'),
            isAutoplantActive,
            () => handleModeChange('autoplant'),
            'green' // Green when active
        );
        
        // Disable and grey out autoplant button if dragon plant not purchased
        if (!dragonPlantPurchased) {
            autoplantButton.disabled = true;
            autoplantButton.style.opacity = '0.5';
            autoplantButton.style.cursor = 'not-allowed';
            autoplantButton.title = 'Dragon Plant not purchased';
        }
        
        // Function to update button appearance
        const updateButtons = () => {
            // Refresh current mode from settings
            currentModeSettings = getSettings();
            currentMode = currentModeSettings.autoMode || null;
            
            const isAutosellActive = currentMode === 'autosell';
            const isOffActive = currentMode === null;
            const isAutoplantActive = currentMode === 'autoplant';
            const dragonPlantPurchased = hasDragonPlant();
            
            // If autoplant is enabled but dragon plant not purchased, disable it
            if (isAutoplantActive && !dragonPlantPurchased) {
                setSettings({ autoMode: null });
                currentMode = null;
            }
            
            // Update buttons using helper function
            const buttonConfigs = [
                { button: autosellButton, isActive: isAutosellActive, colorType: 'green' },
                { button: offButton, isActive: currentMode === null, colorType: 'red' },
                { button: autoplantButton, isActive: isAutoplantActive && dragonPlantPurchased, colorType: 'green' }
            ];
            buttonConfigs.forEach(config => applyButtonStyles(config.button, config.isActive, config.colorType, { marginBottom: '0' }));
            
            // Maintain disabled state for autoplant button
            if (!dragonPlantPurchased) {
                autoplantButton.disabled = true;
                autoplantButton.style.opacity = '0.5';
                autoplantButton.style.cursor = 'not-allowed';
                autoplantButton.title = 'Dragon Plant not purchased';
            } else {
                autoplantButton.disabled = false;
                autoplantButton.style.opacity = '1';
                autoplantButton.style.cursor = 'pointer';
                autoplantButton.title = '';
            }
        };
        
        // Function to handle mode change (will be updated after selectedCreatures is defined)
        let handleModeChange = (newMode) => {
            console.log('[Autoseller] handleModeChange called with:', newMode, 'currentMode:', currentMode);
            // Prevent clicking if already active
            if (currentMode === newMode) {
                return;
            }
            
            // Prevent enabling autoplant if dragon plant not purchased
            if (newMode === 'autoplant' && !hasDragonPlant()) {
                console.log('[Autoseller] Cannot enable autoplant - Dragon Plant not purchased');
                return;
            }
            
            setSettings({ autoMode: newMode });
            currentMode = newMode;
            updateButtons();
            
            if (newMode === 'autoplant') {
                applyLocalStorageToGameCheckbox();
            } else if (newMode === 'autosell') {
                removePlantMonsterFilter();
                applyLocalStorageToGameCheckbox();
            } else {
                // newMode is null (OFF)
                removePlantMonsterFilter();
                applyLocalStorageToGameCheckbox();
            }
            
            updateAutosellerNavButtonColor();
            manageAutosellerWidget();
            updateAutosellerSessionWidget();
        };
        
        modeContainer.appendChild(autosellButton);
        modeContainer.appendChild(offButton);
        modeContainer.appendChild(autoplantButton);
        placeholder.appendChild(modeContainer);
        
        // Store references globally for compatibility
        window.autoplantCheckbox = autoplantButton;
        window.autosellCheckbox = autosellButton;

        // Set initial state from saved settings
        const autoplantSettings = getSettings();
        
        // Autocollect Dragon Plant checkbox
        const autocollectRow = createCheckboxLabelInputRow({
            checkboxId: 'autoplant-autocollect-checkbox',
            labelText: t('mods.autoseller.autocollectDragonPlant'),
            checked: autoplantSettings.autoplantAutocollectChecked !== undefined ? autoplantSettings.autoplantAutocollectChecked : false,
            onCheckboxChange: () => {
                setSettings({ autoplantAutocollectChecked: autocollectRow.checkbox.checked });
            }
        });
        autocollectRow.container.style.marginBottom = '4px';
        
        // Disable and grey out autocollect checkbox if dragon plant not purchased
        if (!dragonPlantPurchased) {
            autocollectRow.checkbox.disabled = true;
            autocollectRow.label.style.opacity = '0.5';
            autocollectRow.label.style.cursor = 'not-allowed';
            autocollectRow.container.style.opacity = '0.5';
            autocollectRow.container.title = 'Dragon Plant not purchased';
        }
        
        placeholder.appendChild(autocollectRow.container);

        // Gene threshold inputs container
        const genesMainContainer = document.createElement('div');
        genesMainContainer.style.display = 'flex';
        genesMainContainer.style.flexDirection = 'column';
        genesMainContainer.style.gap = '6px';
        genesMainContainer.style.marginBottom = '4px';

        // Devour grey creatures checkbox (no input, fixed at 49%)
        const devourGreyCreaturesRow = createCheckboxLabelInputRow({
            checkboxId: 'autoplant-devour-grey-checkbox',
            labelText: t('mods.autoseller.sellOrDevourGreyCreatures'),
            checked: autoplantSettings.autoplantAlwaysDevourEnabled !== undefined ? autoplantSettings.autoplantAlwaysDevourEnabled : false,
            onCheckboxChange: () => {
                setSettings({ autoplantAlwaysDevourEnabled: devourGreyCreaturesRow.checkbox.checked });
                updatePlantMonsterFilter(selectedCreatures);
            }
        });

        genesMainContainer.appendChild(devourGreyCreaturesRow.container);
        placeholder.appendChild(genesMainContainer);

        // Add status bar under the columns (create first so we can insert columns before it)
        const statusArea = document.createElement('div');
        statusArea.style.display = 'flex';
        statusArea.style.flexDirection = 'column';
        statusArea.style.width = '100%';
        statusArea.style.flexShrink = '0';

        const separator = document.createElement('div');
        separator.className = 'separator my-2.5';
        separator.setAttribute('role', 'none');
        separator.style.margin = '16px 0px 6px';

        const summary = document.createElement('div');
        summary.className = 'pixel-font-16';
        summary.style.color = '#ffe066';
        summary.style.fontSize = '13px';
        summary.style.margin = '8px 0 0 0';
        summary.id = 'autoplant-status';

        statusArea.appendChild(separator);
        statusArea.appendChild(summary);
        placeholder.appendChild(statusArea);

        // Create creature filter columns using shared function (insert before status area)
        const creatureFilter = createCreatureFilterColumns({
            container: placeholder,
            settingKey: 'autoplantIgnoreList',
            insertBefore: statusArea,
            actionTitle: t('mods.autoseller.actionTitleSell'),
            enableContextMenu: true, // Enable context menu for autoseller
            showKeepRangeLock: true, // Show lock icon for autoseller
            onUpdate: (selectedCreatures) => {
                // Update plant monster filter with new ignore list (for autoplant mode)
                const currentSettings = getSettings();
                if (currentSettings.autoMode === 'autoplant') {
                    updatePlantMonsterFilter(selectedCreatures);
                }
                // For autosell mode, ignore list is applied during processing
                updateAutoplantStatus();
            }
        });
        
        // Get references for compatibility (use let so renderCreatureColumns can be reassigned)
        const selectedCreatures = creatureFilter.selectedCreatures;
        let renderCreatureColumns = creatureFilter.renderCreatureColumns;

        // Store summary element globally for status updates
        window.autoplantStatusSummary = summary;
        
        // Update status function
        function updateAutoplantStatus() {
            const ignoredCount = selectedCreatures.length;
            const settings = getSettings();
            const currentMode = settings.autoMode;
            const isEnabled = currentMode === 'autoplant' || currentMode === 'autosell';
            
            let modeLabel = '';
            if (currentMode === 'autoplant') {
                modeLabel = t('mods.autoseller.autoplantLabel');
            } else if (currentMode === 'autosell') {
                modeLabel = t('mods.autoseller.autosellLabel');
            } else {
                modeLabel = t('mods.autoseller.autoseller') || 'Autoseller';
            }
            
            const statusKey = isEnabled ? 'mods.autoseller.statusEnabled' : 'mods.autoseller.statusDisabled';
            let statusText = tReplace(statusKey, { type: modeLabel });
            
            if (isEnabled && ignoredCount > 0) {
                statusText += ' ' + tReplace('mods.autoseller.statusIgnoring', { count: ignoredCount });
            }
            
            summary.textContent = statusText;
            summary.style.color = isEnabled ? '#4CAF50' : '#ff6b6b'; // Green when enabled, red when disabled
            
            // Update segments if they exist
            if (typeof updateSegments === 'function') {
                updateSegments();
            }
        }
        
        // Store function globally so it can be called from sync logic
        window.updateAutoplantStatus = updateAutoplantStatus;
        
        // Update handleModeChange to include updateAutoplantStatus and selectedCreatures
        const originalHandleModeChange = handleModeChange;
        handleModeChange = (newMode) => {
            originalHandleModeChange(newMode);
            // Now we can safely call updateAutoplantStatus and use selectedCreatures
            updateAutoplantStatus();
            if (newMode === 'autoplant') {
                updatePlantMonsterFilter(selectedCreatures);
            }
        };

        // Update status when creatures are moved
        const originalRender = renderCreatureColumns;
        renderCreatureColumns = function() {
            originalRender();
            updateAutoplantStatus();
        };

        // Initial status update
        updateAutoplantStatus();
        
        // Initialize plant monster filter (only if autoplant mode is enabled and dragon plant is purchased)
        const initialSettings = getSettings();
        if (initialSettings.autoMode === 'autoplant' && hasDragonPlant()) {
            updatePlantMonsterFilter(selectedCreatures);
        } else if (initialSettings.autoMode === 'autoplant' && !hasDragonPlant()) {
            // Disable autoplant if dragon plant not purchased
            setSettings({ autoMode: null });
            currentMode = null;
            updateButtons();
        }
        
        return placeholder;
    }

    // Helper function to get all creatures for Autoplant
    function getAllAutoplantCreatures() {
        return window.creatureDatabase?.ALL_CREATURES || [];
    }

    // Helper function to create creature boxes for Autoplant
    function createAutoplantCreaturesBox({title, items, selectedCreature, onSelectCreature, isIgnoreList = false, enableContextMenu = false, showKeepRangeLock = false}) {
        const box = document.createElement('div');
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.margin = '0';
        box.style.padding = '0';
        box.style.minHeight = '0';
        box.style.height = '100%';
        box.style.background = "url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat";
        box.style.border = '4px solid transparent';
        box.style.borderImage = `url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch`;
        box.style.borderRadius = '6px';
        box.style.overflow = 'hidden';
        
        const titleEl = document.createElement('h2');
        titleEl.className = 'widget-top widget-top-text pixel-font-16';
        titleEl.style.margin = '0';
        titleEl.style.padding = '2px 8px';
        titleEl.style.textAlign = 'center';
        titleEl.style.color = 'rgb(255, 255, 255)';
        
        const p = document.createElement('p');
        p.textContent = title;
        p.className = 'pixel-font-16';
        p.style.margin = '0';
        p.style.padding = '0';
        p.style.textAlign = 'center';
        // Set color based on title: "Sell"/"Squeeze"/"Disenchant" = red, "Keep" = green, otherwise white
        // Check against both English and translated versions for compatibility
        const sellTitle = t('mods.autoseller.actionTitleSell');
        const squeezeTitle = t('mods.autoseller.actionTitleSqueeze');
        const disenchantTitle = t('mods.autoseller.actionTitleDisenchant');
        const keepTitle = t('mods.autoseller.actionTitleKeep');
        if (title === 'Sell' || title === 'Squeeze' || title === 'Disenchant' || 
            title === sellTitle || title === squeezeTitle || title === disenchantTitle) {
            p.style.color = 'rgb(255, 100, 100)'; // Red
        } else if (title === 'Keep' || title === keepTitle) {
            p.style.color = 'rgb(100, 255, 100)'; // Green
        } else {
            p.style.color = 'rgb(255, 255, 255)'; // White (default)
        }
        titleEl.appendChild(p);
        box.appendChild(titleEl);
        
        const scrollContainer = document.createElement('div');
        scrollContainer.style.flex = '1 1 0';
        scrollContainer.style.minHeight = '0';
        scrollContainer.style.overflowY = 'auto';
        scrollContainer.style.padding = '4px';
        
        items.forEach(name => {
            const item = document.createElement('div');
            item.className = 'pixel-font-14 autoplant-creature-item';
            item.style.color = 'rgb(230, 215, 176)';
            item.style.cursor = 'pointer';
            item.style.padding = '2px 4px';
            item.style.borderRadius = '2px';
            item.style.textAlign = 'left';
            item.style.marginBottom = '1px';
            item.style.position = 'relative';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '4px';
            
            // Add visual indicator if creature has a keep range (before the name)
            // Show grey lock when in creatures list (inactive), colored when in ignore list (active)
            // Only show lock for autoseller, not autosqueezer
            if (showKeepRangeLock) {
                const keepRange = getCreatureKeepRange(name);
                if (keepRange) {
                    const indicator = document.createElement('span');
                    indicator.textContent = '🔒';
                    const statusText = isIgnoreList ? 'Active' : 'Inactive';
                    indicator.title = `Keep range: ${keepRange.min}-${keepRange.max}% (${statusText})`;
                    indicator.style.fontSize = '10px';
                    indicator.style.flexShrink = '0';
                    // Grey when inactive (in creatures list), colored when active (in ignore list)
                    if (!isIgnoreList) {
                        indicator.style.opacity = '0.5';
                        indicator.style.filter = 'grayscale(100%)';
                    }
                    item.appendChild(indicator);
                }
            }
            
            // Add creature name text
            const nameText = document.createElement('span');
            nameText.textContent = name;
            item.appendChild(nameText);
            
            const handleMouseEnter = () => {
                item.style.background = 'rgba(255,255,255,0.08)';
            };
            
            const handleMouseLeave = () => {
                item.style.background = 'none';
            };
            
            const handleMouseDown = () => {
                item.style.background = 'rgba(255,255,255,0.18)';
            };
            
            const handleMouseUp = () => {
                item.style.background = 'rgba(255,255,255,0.08)';
            };
            
            const handleClick = () => {
                // Call the onSelectCreature function immediately to move the creature
                if (onSelectCreature) {
                    onSelectCreature(name);
                }
            };
            
            item.addEventListener('mouseenter', handleMouseEnter);
            item.addEventListener('mouseleave', handleMouseLeave);
            item.addEventListener('mousedown', handleMouseDown);
            item.addEventListener('mouseup', handleMouseUp);
            item.addEventListener('click', handleClick);
            
            // Only add context menu for autoseller (autoplant/autosell), not for autosqueeze/autoduster
            if (enableContextMenu) {
                const handleContextMenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Show context menu at cursor position
                    createCreatureContextMenu(name, e.clientX, e.clientY, () => {
                        // Refresh the creature columns to show updated indicators
                        // Find the columns container by traversing up the DOM tree
                        let currentElement = item;
                        let columnsContainer = null;
                        while (currentElement && !columnsContainer) {
                            currentElement = currentElement.parentElement;
                            if (currentElement && currentElement.classList && currentElement.classList.contains('creature-columns-container')) {
                                columnsContainer = currentElement;
                            }
                        }
                        
                        if (columnsContainer) {
                            // Trigger a custom event that the parent can listen to
                            const refreshEvent = new CustomEvent('creatureKeepRangeUpdated', {
                                detail: { creatureName: name }
                            });
                            columnsContainer.dispatchEvent(refreshEvent);
                        }
                    });
                };
                
                item.addEventListener('contextmenu', handleContextMenu);
            }
            
            scrollContainer.appendChild(item);
        });
        
        box.appendChild(scrollContainer);
        return box;
    }
    
    /**
     * Creates a context menu for setting creature keep ranges
     * @param {string} creatureName - Name of the creature
     * @param {number} x - X position for the menu
     * @param {number} y - Y position for the menu
     * @param {Function} onClose - Callback when menu is closed
     * @returns {HTMLElement} The context menu element
     */
    function createCreatureContextMenu(creatureName, x, y, onClose) {
        // Close any existing context menu before opening a new one
        if (openContextMenu && openContextMenu.closeMenu) {
            openContextMenu.closeMenu();
        }
        
        const settings = getSettings();
        const currentRange = getCreatureKeepRange(creatureName);
        
        // Create overlay to close menu on outside click
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
        
        // Create menu container
        const menu = document.createElement('div');
        menu.style.position = 'fixed';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.zIndex = '9999';
        menu.style.minWidth = '200px';
        menu.style.background = "url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat";
        menu.style.border = '4px solid transparent';
        menu.style.borderImage = `url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch`;
        menu.style.borderRadius = '6px';
        menu.style.padding = '12px';
        menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
        
        // Title
        const title = document.createElement('div');
        title.className = 'pixel-font-16';
        title.textContent = creatureName;
        title.style.color = '#ffe066';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '8px';
        title.style.textAlign = 'center';
        menu.appendChild(title);
        
        // Description
        const desc = document.createElement('div');
        desc.className = 'pixel-font-14';
        desc.textContent = t('mods.autoseller.keepRangeDescription') || 'Keep creatures with genes between:';
        desc.style.color = '#cccccc';
        desc.style.fontSize = '12px';
        desc.style.marginBottom = '8px';
        desc.style.textAlign = 'center';
        menu.appendChild(desc);
        
        // Input container
        const inputContainer = document.createElement('div');
        inputContainer.style.display = 'flex';
        inputContainer.style.alignItems = 'center';
        inputContainer.style.gap = '6px';
        inputContainer.style.marginBottom = '12px';
        inputContainer.style.justifyContent = 'center';
        
        // Min input
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.min = '0';
        minInput.max = '100';
        minInput.step = '1';
        minInput.value = currentRange ? currentRange.min : '0';
        minInput.className = 'pixel-font-14';
        Object.assign(minInput.style, {
            width: '50px',
            padding: '4px',
            fontSize: '12px',
            textAlign: 'center',
            backgroundColor: '#2a2a2a',
            color: '#ffe066',
            border: '1px solid #ffe066',
            borderRadius: '3px'
        });
        
        // Between text
        const betweenText = document.createElement('span');
        betweenText.className = 'pixel-font-14';
        betweenText.textContent = t('mods.autoseller.and') || 'and';
        betweenText.style.color = '#cccccc';
        betweenText.style.fontSize = '12px';
        
        // Max input
        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.min = '0';
        maxInput.max = '100';
        maxInput.step = '1';
        maxInput.value = currentRange ? currentRange.max : '100';
        maxInput.className = 'pixel-font-14';
        Object.assign(maxInput.style, {
            width: '50px',
            padding: '4px',
            fontSize: '12px',
            textAlign: 'center',
            backgroundColor: '#2a2a2a',
            color: '#ffe066',
            border: '1px solid #ffe066',
            borderRadius: '3px'
        });
        
        // Percent text
        const percentText = document.createElement('span');
        percentText.className = 'pixel-font-14';
        percentText.textContent = '%';
        percentText.style.color = '#cccccc';
        percentText.style.fontSize = '12px';
        
        inputContainer.appendChild(minInput);
        inputContainer.appendChild(betweenText);
        inputContainer.appendChild(maxInput);
        inputContainer.appendChild(percentText);
        menu.appendChild(inputContainer);
        
        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '6px';
        buttonContainer.style.justifyContent = 'center';
        
        // Save button
        const saveButton = document.createElement('button');
        saveButton.className = 'pixel-font-14';
        saveButton.textContent = t('mods.autoseller.save') || 'Save';
        applyButtonStyles(saveButton, true, 'green', {
            width: '70px',
            height: '24px',
            fontSize: '11px'
        });
        // Add hover effect to Save button (active button)
        saveButton.addEventListener('mouseenter', () => {
            saveButton.style.backgroundColor = '#2a4a2a';
            saveButton.style.borderColor = '#4CAF50';
        });
        saveButton.addEventListener('mouseleave', () => {
            saveButton.style.backgroundColor = UI_CONSTANTS.BUTTON_COLORS.ACTIVE_GREEN_BG;
            saveButton.style.borderColor = UI_CONSTANTS.BUTTON_COLORS.BORDER;
        });
        
        saveButton.addEventListener('click', () => {
            const min = Math.max(0, Math.min(100, parseInt(minInput.value, 10) || 0));
            const max = Math.max(0, Math.min(100, parseInt(maxInput.value, 10) || 100));
            
            // Ensure min <= max
            const finalMin = Math.min(min, max);
            const finalMax = Math.max(min, max);
            
            setCreatureKeepRange(creatureName, finalMin, finalMax);
            closeMenu();
        });
        
        // Clear button
        const clearButton = document.createElement('button');
        clearButton.className = 'pixel-font-14';
        clearButton.textContent = t('mods.autoseller.clear') || 'Clear';
        applyButtonStyles(clearButton, false, 'red', {
            width: '70px',
            height: '24px',
            fontSize: '11px'
        });
        
        // Add hover effect to Clear button (inactive button)
        clearButton.addEventListener('mouseenter', () => {
            clearButton.style.backgroundColor = '#2a2a2a';
            clearButton.style.color = '#ff6b6b';
            clearButton.style.textShadow = UI_CONSTANTS.TEXT_SHADOW.RED;
        });
        clearButton.addEventListener('mouseleave', () => {
            clearButton.style.backgroundColor = UI_CONSTANTS.BUTTON_COLORS.INACTIVE_BG;
            clearButton.style.color = UI_CONSTANTS.BUTTON_COLORS.INACTIVE_TEXT;
            clearButton.style.textShadow = UI_CONSTANTS.TEXT_SHADOW.NONE;
        });
        
        clearButton.addEventListener('click', () => {
            clearCreatureKeepRange(creatureName);
            closeMenu();
        });
        
        // Cancel button
        const cancelButton = document.createElement('button');
        cancelButton.className = 'pixel-font-14';
        cancelButton.textContent = t('mods.autoseller.cancel') || 'Cancel';
        applyButtonStyles(cancelButton, false, 'green', {
            width: '70px',
            height: '24px',
            fontSize: '11px'
        });
        
        // Add hover effect to Cancel button (inactive button)
        cancelButton.addEventListener('mouseenter', () => {
            cancelButton.style.backgroundColor = '#2a2a2a';
            cancelButton.style.color = '#4CAF50';
            cancelButton.style.textShadow = UI_CONSTANTS.TEXT_SHADOW.GREEN;
        });
        cancelButton.addEventListener('mouseleave', () => {
            cancelButton.style.backgroundColor = UI_CONSTANTS.BUTTON_COLORS.INACTIVE_BG;
            cancelButton.style.color = UI_CONSTANTS.BUTTON_COLORS.INACTIVE_TEXT;
            cancelButton.style.textShadow = UI_CONSTANTS.TEXT_SHADOW.NONE;
        });
        
        cancelButton.addEventListener('click', closeMenu);
        
        buttonContainer.appendChild(saveButton);
        if (currentRange) {
            buttonContainer.appendChild(clearButton);
        }
        buttonContainer.appendChild(cancelButton);
        menu.appendChild(buttonContainer);
        
        // Close menu function
        function closeMenu() {
            // Remove event listeners before removing from DOM
            overlay.removeEventListener('mousedown', overlayClickHandler);
            overlay.removeEventListener('click', overlayClickHandler);
            document.removeEventListener('keydown', escHandler);
            
            // Remove modal click handlers if they exist
            if (openContextMenu && openContextMenu.modalClickHandler && openContextMenu.modalContent) {
                openContextMenu.modalContent.removeEventListener('mousedown', openContextMenu.modalClickHandler);
                openContextMenu.modalContent.removeEventListener('click', openContextMenu.modalClickHandler);
            }
            
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            if (menu.parentNode) {
                menu.parentNode.removeChild(menu);
            }
            // Clear the global reference
            if (openContextMenu && (openContextMenu.overlay === overlay || openContextMenu.menu === menu)) {
                openContextMenu = null;
            }
            if (onClose) {
                onClose();
            }
        }
        
        // Store reference to this menu
        openContextMenu = {
            overlay: overlay,
            menu: menu,
            closeMenu: closeMenu
        };
        
        // Close on overlay click/mousedown (use mousedown for better reliability)
        const overlayClickHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeMenu();
        };
        
        // Close on ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeMenu();
            }
        };
        
        // Append to document first (overlay first, then menu on top)
        document.body.appendChild(overlay);
        document.body.appendChild(menu);
        
        // Attach event listeners after elements are in DOM
        overlay.addEventListener('mousedown', overlayClickHandler);
        overlay.addEventListener('click', overlayClickHandler);
        document.addEventListener('keydown', escHandler);
        
        // Also close menu when clicking inside the autoseller modal (but outside the menu)
        const modalContent = document.querySelector('[role="dialog"][data-state="open"]');
        if (modalContent) {
            const modalClickHandler = (e) => {
                // Only close if click is not on the menu itself
                if (!menu.contains(e.target)) {
                    closeMenu();
                    modalContent.removeEventListener('mousedown', modalClickHandler);
                    modalContent.removeEventListener('click', modalClickHandler);
                }
            };
            modalContent.addEventListener('mousedown', modalClickHandler);
            modalContent.addEventListener('click', modalClickHandler);
            
            // Store handler for cleanup
            openContextMenu.modalClickHandler = modalClickHandler;
            openContextMenu.modalContent = modalContent;
        }
        
        // Prevent clicks on menu from closing it (stop propagation to overlay)
        menu.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Adjust position if menu goes off screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${window.innerHeight - rect.height - 10}px`;
        }
        
        // Focus first input
        minInput.focus();
        minInput.select();
        
        return menu;
    }

    // =======================
    // Shared Creature Filter Functions (for both autoplant and autosqueeze)
    // =======================
    
    /**
     * Helper function to load and migrate filter lists (shared between creatures and equipment)
     * @param {string} settingKey - Settings key for ignore list (e.g., 'autoplantIgnoreList')
     * @param {Array} allItems - All available items (creatures or equipment)
     * @returns {Object} { keepList, sellList, sellListKey }
     */
    function loadAndMigrateFilterLists(settingKey, allItems) {
        const sellListKey = settingKey.replace('IgnoreList', 'SellList');
        
        // Simple logic:
        // 1. Fetch all creatures/items (allItems parameter)
        // 2. Read the ignore list (keep list) from settings
        // 3. If item is in ignore list -> keep, otherwise -> sell
        
        // Check if keys exist in localStorage (not just defaults)
        let ignoreListExists = false;
        let sellListExists = false;
        try {
            const stored = JSON.parse(localStorage.getItem('autoseller-settings') || '{}');
            ignoreListExists = settingKey in stored;
            sellListExists = sellListKey in stored;
        } catch (e) {
            // If we can't parse, assume nothing exists
        }
        
        const savedSettings = getSettings();
        const savedIgnoreList = savedSettings[settingKey];
        const savedSellList = savedSettings[sellListKey];
        
        let keepList = [];
        let sellList = [];
        
        // If ignore list was saved, use it (even if empty - means all items should be sold)
        if (ignoreListExists && savedIgnoreList && Array.isArray(savedIgnoreList)) {
            keepList = savedIgnoreList.filter(item => allItems.includes(item));
            sellList = allItems.filter(item => !keepList.includes(item));
        } 
        // Otherwise, if sell list was saved, use it
        else if (sellListExists && savedSellList && Array.isArray(savedSellList)) {
            sellList = savedSellList.filter(item => allItems.includes(item));
            keepList = allItems.filter(item => !sellList.includes(item));
        } 
        // No saved lists: all items default to keep
        else {
            keepList = [...allItems];
            sellList = [];
        }
        
        // Add any new items (not in either list) to keep
        const newItems = allItems.filter(item => 
            !keepList.includes(item) && !sellList.includes(item)
        );
        if (newItems.length > 0) {
            keepList = [...keepList, ...newItems];
        }
        
        // Ensure both lists are sorted alphabetically
        keepList.sort();
        sellList.sort();
        
        return { keepList, sellList, sellListKey };
    }
    
    /**
     * Creates creature filter columns (Creatures and Ignore List) - shared between autoplant and autosqueeze
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.container - Container element to append columns to
     * @param {string} options.settingKey - Settings key for ignore list (e.g., 'autoplantIgnoreList', 'autosqueezeIgnoreList')
     * @param {Function} options.onUpdate - Callback when ignore list is updated
     * @param {HTMLElement} options.insertBefore - Optional element to insert columns before
     * @param {string} options.actionTitle - Title for the action column (e.g., 'Sell', 'Squeeze', 'Disenchant')
     * @param {boolean} options.enableContextMenu - Whether to enable right-click context menu for gene keep ranges
     * @returns {Object} { availableCreatures, selectedCreatures, renderCreatureColumns, saveIgnoreList }
     */
    function createCreatureFilterColumns({ container, settingKey, onUpdate, insertBefore, actionTitle = null, enableContextMenu = false, showKeepRangeLock = false }) {
        // Use translation if actionTitle not provided, otherwise use provided value
        if (!actionTitle) {
            actionTitle = t('mods.autoseller.actionTitleSell');
        }
        // Load and migrate filter lists
        const allCreatures = [...getAllAutoplantCreatures()];
        const { keepList, sellList, sellListKey } = loadAndMigrateFilterLists(settingKey, allCreatures);
        let selectedCreatures = [...keepList];
        let availableCreatures = [...sellList];
        
        // Function to save both lists to settings
        function saveIgnoreList() {
            const settingsUpdate = {};
            settingsUpdate[settingKey] = [...selectedCreatures];
            settingsUpdate[sellListKey] = [...availableCreatures];
            setSettings(settingsUpdate);
            if (onUpdate) {
                onUpdate(selectedCreatures);
            }
        }
        
        // Function to render the creature columns
        function renderCreatureColumns() {
            // Get or create the columns container
            let columnsContainer = container.querySelector('.creature-columns-container');
            
            if (!columnsContainer) {
                columnsContainer = document.createElement('div');
                columnsContainer.className = 'creature-columns-container';
                columnsContainer.style.display = 'flex';
                columnsContainer.style.gap = '8px';
                columnsContainer.style.justifyContent = 'center';
                columnsContainer.style.flex = '1 1 0';
                columnsContainer.style.minHeight = '0';
                columnsContainer.style.width = '100%';
                
                // Insert before specified element if provided, otherwise append
                if (insertBefore && insertBefore.parentElement) {
                    container.insertBefore(columnsContainer, insertBefore);
                } else {
                    container.appendChild(columnsContainer);
                }
                
                // Listen for keep range updates to refresh the display (only add once)
                columnsContainer.addEventListener('creatureKeepRangeUpdated', () => {
                    renderCreatureColumns();
                });
            } else {
                columnsContainer.innerHTML = '';
            }

            // Available creatures column (keep ranges inactive here)
            const availableBox = createAutoplantCreaturesBox({
                title: actionTitle,
                items: availableCreatures,
                selectedCreature: null,
                isIgnoreList: false,
                enableContextMenu: enableContextMenu,
                showKeepRangeLock: showKeepRangeLock,
                onSelectCreature: (creatureName) => {
                    console.log(`[Autoseller] Added to ignore list (${settingKey}):`, creatureName);
                    availableCreatures = availableCreatures.filter(c => c !== creatureName);
                    selectedCreatures.push(creatureName);
                    selectedCreatures.sort();
                    renderCreatureColumns();
                    saveIgnoreList();
                }
            });
            availableBox.style.width = '125px';
            availableBox.style.flex = '1 1 0';
            availableBox.style.minHeight = '0';

            // Selected creatures column (keep ranges active here)
            const selectedBox = createAutoplantCreaturesBox({
                title: t('mods.autoseller.actionTitleKeep'),
                items: selectedCreatures,
                selectedCreature: null,
                isIgnoreList: true,
                enableContextMenu: enableContextMenu,
                showKeepRangeLock: showKeepRangeLock,
                onSelectCreature: (creatureName) => {
                    console.log(`[Autoseller] Removed from ignore list (${settingKey}):`, creatureName);
                    selectedCreatures = selectedCreatures.filter(c => c !== creatureName);
                    availableCreatures.push(creatureName);
                    availableCreatures.sort();
                    renderCreatureColumns();
                    saveIgnoreList();
                }
            });
            selectedBox.style.width = '125px';
            selectedBox.style.flex = '1 1 0';
            selectedBox.style.minHeight = '0';

            columnsContainer.appendChild(selectedBox);
            columnsContainer.appendChild(availableBox);
        }
        
        // Initial render
        renderCreatureColumns();
        
        return {
            availableCreatures,
            selectedCreatures,
            renderCreatureColumns,
            saveIgnoreList
        };
    }

    /**
     * Creates equipment filter columns (Equipment and Ignore List) - for autoduster
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.container - Container element to append columns to
     * @param {string} options.settingKey - Settings key for ignore list (e.g., 'autodusterIgnoreList')
     * @param {Function} options.onUpdate - Callback when ignore list is updated
     * @param {HTMLElement} options.insertBefore - Optional element to insert columns before
     * @param {string} options.actionTitle - Title for the action column (e.g., 'Sell', 'Disenchant')
     * @param {boolean} options.enableContextMenu - Whether to enable right-click context menu for gene keep ranges
     * @returns {Object} { availableEquipment, selectedEquipment, renderEquipmentColumns, saveIgnoreList }
     */
    function createEquipmentFilterColumns({ container, settingKey, onUpdate, insertBefore, actionTitle = null, enableContextMenu = false }) {
        // Use translation if actionTitle not provided, otherwise use provided value
        if (!actionTitle) {
            actionTitle = t('mods.autoseller.actionTitleSell');
        }
        // Get equipment list from equipment database (similar to Better Exaltation Chest)
        function generateEquipmentList() {
            const equipmentDatabase = window.equipmentDatabase;
            if (equipmentDatabase && equipmentDatabase.ALL_EQUIPMENT && equipmentDatabase.ALL_EQUIPMENT.length > 0) {
                return equipmentDatabase.ALL_EQUIPMENT;
            }
            return [];
        }
        
        // Load and migrate filter lists
        const allEquipment = [...generateEquipmentList()];
        const { keepList, sellList, sellListKey } = loadAndMigrateFilterLists(settingKey, allEquipment);
        let selectedEquipment = [...keepList];
        let availableEquipment = [...sellList];
        
        // Function to save both lists to settings
        function saveIgnoreList() {
            const settingsUpdate = {};
            settingsUpdate[settingKey] = [...selectedEquipment];
            settingsUpdate[sellListKey] = [...availableEquipment];
            setSettings(settingsUpdate);
            if (onUpdate) {
                onUpdate(selectedEquipment);
            }
        }
        
        // Function to render the equipment columns
        function renderEquipmentColumns() {
            // Get or create the columns container
            let columnsContainer = container.querySelector('.equipment-columns-container');
            
            if (!columnsContainer) {
                columnsContainer = document.createElement('div');
                columnsContainer.className = 'equipment-columns-container';
                columnsContainer.style.display = 'flex';
                columnsContainer.style.gap = '8px';
                columnsContainer.style.justifyContent = 'center';
                columnsContainer.style.flex = '1 1 0';
                columnsContainer.style.minHeight = '0';
                columnsContainer.style.width = '100%';
                
                // Insert before specified element if provided, otherwise append
                if (insertBefore && insertBefore.parentElement) {
                    container.insertBefore(columnsContainer, insertBefore);
                } else {
                    container.appendChild(columnsContainer);
                }
            } else {
                columnsContainer.innerHTML = '';
            }

            // Available equipment column (keep ranges inactive here)
            const availableBox = createAutoplantCreaturesBox({
                title: actionTitle,
                items: availableEquipment,
                selectedCreature: null,
                isIgnoreList: false,
                enableContextMenu: enableContextMenu,
                onSelectCreature: (equipmentName) => {
                    console.log(`[Autoseller] Added to ignore list (${settingKey}):`, equipmentName);
                    availableEquipment = availableEquipment.filter(e => e !== equipmentName);
                    selectedEquipment.push(equipmentName);
                    selectedEquipment.sort();
                    renderEquipmentColumns();
                    saveIgnoreList();
                }
            });
            availableBox.style.width = '125px';
            availableBox.style.flex = '1 1 0';
            availableBox.style.minHeight = '0';

            // Selected equipment column (keep ranges active here)
            const selectedBox = createAutoplantCreaturesBox({
                title: t('mods.autoseller.actionTitleKeep'),
                items: selectedEquipment,
                selectedCreature: null,
                isIgnoreList: true,
                enableContextMenu: enableContextMenu,
                onSelectCreature: (equipmentName) => {
                    console.log(`[Autoseller] Removed from ignore list (${settingKey}):`, equipmentName);
                    selectedEquipment = selectedEquipment.filter(e => e !== equipmentName);
                    availableEquipment.push(equipmentName);
                    availableEquipment.sort();
                    renderEquipmentColumns();
                    saveIgnoreList();
                }
            });
            selectedBox.style.width = '125px';
            selectedBox.style.flex = '1 1 0';
            selectedBox.style.minHeight = '0';

            columnsContainer.appendChild(selectedBox);
            columnsContainer.appendChild(availableBox);
        }
        
        // Initial render
        renderEquipmentColumns();
        
        return {
            availableEquipment,
            selectedEquipment,
            renderEquipmentColumns,
            saveIgnoreList
        };
    }

    // =======================
    // Plant Monster Filter Functions
    // =======================
    
    function setPlantMonsterFilter(ignoreList) {
        if (!globalThis.state?.clientConfig?.trigger?.setState) {
            console.warn('[Autoseller] clientConfig not available for plantMonsterFilter');
            return;
        }
        
        const settings = getSettings();
        const minGenes = settings.autoplantGenesMin !== undefined ? settings.autoplantGenesMin : 80;
        const keepGenesEnabled = true; // Always enabled - autosqueezer handles 80%+ creatures
        const alwaysDevourBelow = settings.autoplantAlwaysDevourBelow !== undefined ? settings.autoplantAlwaysDevourBelow : 49;
        const alwaysDevourEnabled = settings.autoplantAlwaysDevourEnabled !== undefined ? settings.autoplantAlwaysDevourEnabled : false;
        
        try {
            globalThis.state.clientConfig.trigger.setState({
                fn: (prev) => {
                    return {
                        ...prev,
                        plantMonsterFilter: (monster) => {
                            const monsterName = monster?.metadata?.name || monster?.name;
                            
                            // FAILSAFE: NEVER autoplant shiny creatures
                            if (isShinyCreature(monster)) {
                                return false;
                            }
                            
                            // Always devour creatures below absolute threshold (OVERRIDES keep range and ignore list) - only if enabled
                            if (alwaysDevourEnabled && monster.totalGenes <= alwaysDevourBelow) {
                                return true;
                            }
                            
                            // Keep creatures with minGenes or higher - only if enabled
                            if (keepGenesEnabled && monster.totalGenes >= minGenes) {
                                return false;
                            }
                            
                            // For creatures between thresholds (or all if keep genes disabled), check ignore list
                            if (monsterName && ignoreList.includes(monsterName)) {
                                // Check per-creature keep range ONLY if creature is in ignore list (keep range is only active in ignore list)
                                const keepRange = getCreatureKeepRange(monsterName);
                                if (keepRange) {
                                    // If creature has a keep range, only keep if within range, otherwise devour
                                    if (shouldKeepCreatureByRange(monsterName, monster.totalGenes)) {
                                        return false; // Keep - within range
                                    }
                                    return true; // Devour - outside range
                                }
                                // No keep range set - normal ignore list behavior (keep it)
                                return false;
                            }
                            
                            return true;
                        },
                    };
                },
            });
            // Filter set - no logging needed unless there's an issue
        } catch (error) {
            console.error('[Autoseller] Error setting plantMonsterFilter:', error);
        }
    }
    
    function removePlantMonsterFilter() {
        if (!globalThis.state?.clientConfig?.trigger?.setState) {
            console.warn('[Autoseller] clientConfig not available for plantMonsterFilter');
            return;
        }
        
        globalThis.state.clientConfig.trigger.setState({
            fn: (prev) => ({ ...prev, plantMonsterFilter: undefined }),
        });
        
        console.log('[Autoseller] Plant monster filter removed');
    }
    
    function updatePlantMonsterFilter(selectedCreatures = []) {
        const settings = getSettings();
        
        // Only set filter if autoplant is enabled
        if (settings.autoMode === 'autoplant') {
            // Use provided selectedCreatures, or fall back to saved ignore list from settings
            const ignoreList = selectedCreatures.length > 0 ? selectedCreatures : (settings.autoplantIgnoreList || []);
            setPlantMonsterFilter(ignoreList);
        } else {
            removePlantMonsterFilter();
        }
    }

    function createSettingsSection(opts) {
        const section = document.createElement('div');
        // Make section a flex container to allow content to auto-fit
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.height = '100%';
        section.style.minHeight = '0';
        
        // Skip description and warning for autosqueeze and autoduster
        if (opts.summaryType !== 'Autosqueeze' && opts.summaryType !== 'Autoduster') {
            const descWrapper = createDescriptionRow(opts.desc);
            section.appendChild(descWrapper);
            
            const warningText = opts.summaryType === 'Autosell' 
                ? t('mods.autoseller.warningSellAll')
                : t('mods.autoseller.warningSqueezeAll');
            const warningWrapper = createWarningRow(warningText, true);
            section.appendChild(warningWrapper);
        }
        
        // For autosqueeze and autoduster, use a different layout structure to match autoplant
        let contentArea, checkbox, label, inputMin, inputMax, minCountInput = null;
        
        if (opts.summaryType === 'Autosqueeze' || opts.summaryType === 'Autoduster') {
            // Autosqueeze/Autoduster layout: enable/disable button and gene inputs at top, then creature columns with autofit
            const settings = getSettings();
            const isAutoduster = opts.summaryType === 'Autoduster';
            const settingsKeys = getSettingsKeys(opts.summaryType);
            const checkedKey = settingsKeys.checked;
            const genesMinKey = settingsKeys.genesMin;
            const genesMaxKey = settingsKeys.genesMax;
            const isEnabled = settings[checkedKey] || false;
            
            // Create toggleable button - red when disabled, green when enabled
            const toggleButton = document.createElement('button');
            toggleButton.className = 'pixel-font-14';
            toggleButton.type = 'button';
            toggleButton.textContent = opts.label || (opts.summaryType === 'Autoduster' ? 'Autodust' : 'Autosqueeze');
            
            // Apply button styles using helper function
            applyButtonStyles(toggleButton, isEnabled, 'green', { marginBottom: UI_CONSTANTS.SPACING.MARGIN_BOTTOM_BUTTON });
            
            toggleButton.addEventListener('click', () => {
                const currentSettings = getSettings();
                const newState = !currentSettings[checkedKey];
                const settingsUpdate = {};
                settingsUpdate[checkedKey] = newState;
                setSettings(settingsUpdate);
                
                // Update button appearance using helper function
                applyButtonStyles(toggleButton, newState, 'green', { marginBottom: UI_CONSTANTS.SPACING.MARGIN_BOTTOM_BUTTON });
                
                // Update widget immediately when tab is enabled/disabled
                manageAutosellerWidget();
                updateAutosellerSessionWidget();
                
                // Update summary if it exists
                if (typeof updateSummary === 'function') {
                    updateSummary();
                }
            });
            
            section.appendChild(toggleButton);
            
            // Create a dummy checkbox for compatibility with existing code
            checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = opts.persistKey + '-checkbox';
            checkbox.checked = isEnabled;
            // Sync checkbox with button state
            Object.defineProperty(checkbox, 'checked', {
                get: () => {
                    const settings = getSettings();
                    return settings[checkedKey] || false;
                },
                set: (value) => {
                    const settingsUpdate = {};
                    settingsUpdate[checkedKey] = value;
                    setSettings(settingsUpdate);
                    // Update button appearance using helper function
                    applyButtonStyles(toggleButton, value, 'green', { marginBottom: UI_CONSTANTS.SPACING.MARGIN_BOTTOM_BUTTON });
                    // Update widget immediately when checkbox state changes
                    manageAutosellerWidget();
                    updateAutosellerSessionWidget();
                }
            });
            
            label = null; // No label needed for button
            
            // Create gene input row with same style as autoplant (skip for autoduster)
            if (!isAutoduster) {
                const genesContainer = document.createElement('div');
                genesContainer.style.display = 'flex';
                genesContainer.style.alignItems = 'center';
                genesContainer.style.justifyContent = 'flex-start';
                genesContainer.style.gap = '6px';
                genesContainer.style.marginTop = UI_CONSTANTS.SPACING.GAP_SMALL;
                genesContainer.style.marginBottom = UI_CONSTANTS.SPACING.GAP_SMALL;
                
                const genesLabel = document.createElement('label');
                genesLabel.className = 'pixel-font-14';
                genesLabel.textContent = t('mods.autoseller.squeezeGenesBetween');
                genesLabel.style.fontSize = UI_CONSTANTS.INPUT_STYLES.FONT_SIZE_MEDIUM;
                genesLabel.style.color = UI_CONSTANTS.BUTTON_COLORS.PRIMARY_TEXT;
                
                const inputStyles = UI_CONSTANTS.INPUT_STYLES;
                const colors = UI_CONSTANTS.BUTTON_COLORS;
                
                const genesInputMin = document.createElement('input');
                genesInputMin.type = 'number';
                genesInputMin.min = opts.inputMin || 80;
                genesInputMin.max = opts.inputMax || 100;
                genesInputMin.step = '1';
                genesInputMin.value = settings[genesMinKey] !== undefined ? settings[genesMinKey] : (opts.defaultMin || 80);
                Object.assign(genesInputMin.style, {
                    width: '50px',
                    padding: inputStyles.PADDING,
                    fontSize: inputStyles.FONT_SIZE_SMALL,
                    textAlign: 'center',
                    backgroundColor: inputStyles.BACKGROUND,
                    color: colors.PRIMARY_TEXT,
                    border: inputStyles.BORDER,
                    borderRadius: inputStyles.BORDER_RADIUS
                });
                
                const betweenText = document.createElement('span');
                betweenText.className = 'pixel-font-14';
                betweenText.textContent = 'and';
                betweenText.style.fontSize = inputStyles.FONT_SIZE_MEDIUM;
                betweenText.style.color = colors.PRIMARY_TEXT;
                
                const genesInputMax = document.createElement('input');
                genesInputMax.type = 'number';
                genesInputMax.min = opts.inputMin || 80;
                genesInputMax.max = opts.inputMax || 100;
                genesInputMax.step = '1';
                genesInputMax.value = settings[genesMaxKey] !== undefined ? settings[genesMaxKey] : (opts.defaultMax || 100);
                Object.assign(genesInputMax.style, {
                    width: '50px',
                    padding: inputStyles.PADDING,
                    fontSize: inputStyles.FONT_SIZE_SMALL,
                    textAlign: 'center',
                    backgroundColor: inputStyles.BACKGROUND,
                    color: colors.PRIMARY_TEXT,
                    border: inputStyles.BORDER,
                    borderRadius: inputStyles.BORDER_RADIUS
                });
                
                // Validation function to ensure min <= max
                function validateSqueezeInputs(e) {
                    const inputMin = opts.inputMin || 80;
                    const inputMax = opts.inputMax || 100;
                    const defaultMin = opts.defaultMin || 80;
                    const defaultMax = opts.defaultMax || 100;
                    
                    let minVal = validateGeneInput(genesInputMin.value, inputMin, inputMax, defaultMin);
                    let maxVal = validateGeneInput(genesInputMax.value, inputMin, inputMax, defaultMax);
                    
                    if (e && e.target === genesInputMin && minVal >= maxVal) {
                        maxVal = Math.min(inputMax, minVal + 1);
                    } else if (e && e.target === genesInputMax && maxVal <= minVal) {
                        minVal = Math.max(inputMin, maxVal - 1);
                    }
                    
                    genesInputMin.value = minVal;
                    genesInputMax.value = maxVal;
                    const settingsUpdate = {};
                    settingsUpdate[genesMinKey] = minVal;
                    settingsUpdate[genesMaxKey] = maxVal;
                    setSettings(settingsUpdate);
                }
                
                genesInputMin.addEventListener('input', validateSqueezeInputs);
                genesInputMax.addEventListener('input', validateSqueezeInputs);
                genesInputMin.addEventListener('blur', validateSqueezeInputs);
                genesInputMax.addEventListener('blur', validateSqueezeInputs);
                
                const genesPercent = document.createElement('span');
                genesPercent.className = 'pixel-font-14';
                genesPercent.textContent = '%';
                genesPercent.style.fontSize = inputStyles.FONT_SIZE_MEDIUM;
                genesPercent.style.color = colors.PRIMARY_TEXT;
                
                genesContainer.appendChild(genesLabel);
                genesContainer.appendChild(genesInputMin);
                genesContainer.appendChild(betweenText);
                genesContainer.appendChild(genesInputMax);
                genesContainer.appendChild(genesPercent);
                section.appendChild(genesContainer);
                
                inputMin = genesInputMin;
                inputMax = genesInputMax;
            } else {
                // For autoduster, set inputMin and inputMax to null since we don't have inputs
                inputMin = null;
                inputMax = null;
            }
        } else {
            // Other sections use the original content area layout
            contentArea = document.createElement('div');
            contentArea.style.display = 'flex';
            contentArea.style.flexDirection = 'column';
            contentArea.style.flex = '1 1 0';
            contentArea.style.minHeight = '0';
            contentArea.style.justifyContent = 'center';
            contentArea.style.gap = '12px';
            
            const { row: row1, checkbox: cb, label: lbl } = createCheckboxRow(opts.persistKey, opts.label, opts.icon);
            checkbox = cb;
            label = lbl;
            
            // Store reference to Autosell checkbox globally for mutual exclusivity
            if (opts.persistKey === 'autosell') {
                window.autosellCheckbox = checkbox;
            }
            contentArea.appendChild(row1);
            
            const { row: row2, inputMin: iMin, inputMax: iMax } = createGeneInputRow(opts);
            inputMin = iMin;
            inputMax = iMax;
            contentArea.appendChild(row2);
            
            const { row: row3, minCountInput: minCount } = createMinCountRow(opts);
            contentArea.appendChild(row3);
            minCountInput = minCount;
        }
        
        // Only add validateInputs for sections that have input fields (autosqueeze and autoduster have their own validation or no inputs)
        if (opts.summaryType !== 'Autosqueeze' && opts.summaryType !== 'Autoduster' && inputMin && inputMax) {
            function validateInputs(e) {
                let minVal = Math.max(opts.inputMin, Math.min(opts.inputMax, parseInt(inputMin.value, 10) || opts.inputMin));
                let maxVal = Math.max(opts.inputMin, Math.min(opts.inputMax, parseInt(inputMax.value, 10) || opts.inputMax));
                
                if (e && e.target === inputMin && minVal >= maxVal) {
                    maxVal = Math.min(opts.inputMax, minVal + 1);
                } else if (e && e.target === inputMax && maxVal <= minVal) {
                    minVal = Math.max(opts.inputMin, maxVal - 1);
                }
                
                inputMin.value = minVal;
                inputMax.value = maxVal;
            }
            
            inputMin.addEventListener('input', validateInputs);
            inputMax.addEventListener('input', validateInputs);
            inputMin.addEventListener('blur', validateInputs);
            inputMax.addEventListener('blur', validateInputs);
        }

        const summary = document.createElement('div');
        summary.className = 'pixel-font-16';
        summary.style.color = '#ffe066';
        summary.style.fontSize = '13px';
        summary.style.margin = '8px 0 0 0';
        
        // Layout structure differs for autosqueeze and autoduster vs other sections
        if (opts.summaryType === 'Autosqueeze' || opts.summaryType === 'Autoduster') {
            // Autosqueeze/Autoduster: checkbox and inputs at top, then creature columns with autofit, then status at bottom
            // Status area at bottom (create first so we can insert columns before it)
            const statusArea = document.createElement('div');
            statusArea.style.display = 'flex';
            statusArea.style.flexDirection = 'column';
            statusArea.style.width = '100%';
            statusArea.style.flexShrink = '0';
            
            const separator = document.createElement('div');
            separator.className = 'separator my-2.5';
            separator.setAttribute('role', 'none');
            separator.style.margin = '16px 0px 6px';
            
            statusArea.appendChild(separator);
            statusArea.appendChild(summary);
            section.appendChild(statusArea);
            
            // Add filter columns (insert before status area, with autofit)
            const ignoreListKey = opts.summaryType === 'Autoduster' ? 'autodusterIgnoreList' : 'autosqueezeIgnoreList';
            if (opts.summaryType === 'Autoduster') {
                // Use equipment filter columns for autoduster
                createEquipmentFilterColumns({
                    container: section,
                    settingKey: ignoreListKey,
                    insertBefore: statusArea,
                    actionTitle: t('mods.autoseller.actionTitleDisenchant'),
                    onUpdate: () => {
                        // Ignore list is applied during processing
                        // Update summary to show ignore count
                        if (typeof updateSummary === 'function') {
                            updateSummary();
                        }
                    }
                });
            } else {
                // Use creature filter columns for autosqueeze
                createCreatureFilterColumns({
                    container: section,
                    settingKey: ignoreListKey,
                    insertBefore: statusArea,
                    actionTitle: t('mods.autoseller.actionTitleSqueeze'),
                    showKeepRangeLock: false, // Don't show lock for autosqueeze
                    onUpdate: () => {
                        // Ignore list is applied during processing
                        // Update summary to show ignore count
                        if (typeof updateSummary === 'function') {
                            updateSummary();
                        }
                    }
                });
            }
        } else {
            // Other sections: use original layout with content area
            // First separator
            const separator = document.createElement('div');
            separator.className = 'separator my-2.5';
            separator.setAttribute('role', 'none');
            separator.style.margin = '6px 0px';
            separator.style.flexShrink = '0';
            section.appendChild(separator);
            
            // Add content area between separators
            section.appendChild(contentArea);
            
            // Status area at bottom
            const statusArea = document.createElement('div');
            statusArea.style.display = 'flex';
            statusArea.style.flexDirection = 'column';
            statusArea.style.justifyContent = 'flex-end';
            statusArea.style.flexShrink = '0';
            statusArea.style.marginTop = 'auto';
            const separator2 = document.createElement('div');
            separator2.className = 'separator my-2.5';
            separator2.setAttribute('role', 'none');
            separator2.style.margin = '6px 0px';
            statusArea.appendChild(separator2);
            statusArea.appendChild(summary);
            section.appendChild(statusArea);
        }
        
        checkbox.tabIndex = 1;
        if (label) {
            label.htmlFor = checkbox.id;
        }
        if (inputMin && inputMax) {
            inputMin.tabIndex = 2;
            inputMax.tabIndex = 3;
            inputMin.setAttribute('aria-label', tReplace('mods.autoseller.genesMinThreshold', { label: opts.label }));
            inputMax.setAttribute('aria-label', tReplace('mods.autoseller.genesMaxThreshold', { label: opts.label }));
            inputMin.setAttribute('autocomplete', 'off');
            inputMax.setAttribute('autocomplete', 'off');
        }
        const focusableElements = [checkbox];
        if (inputMin) focusableElements.push(inputMin);
        if (inputMax) focusableElements.push(inputMax);
        focusableElements.forEach(el => {
            el.addEventListener('focus', () => {
                el.style.boxShadow = '0 0 0 2px #ffe066, 0 0 8px #ffe06677';
            });
            el.addEventListener('blur', () => {
                el.style.boxShadow = '';
            });
        });
        focusableElements.forEach(el => {
            el.addEventListener('change', () => {
                el.style.boxShadow = '0 0 0 2px #ffe066, 0 0 8px #ffe06677';
                setTimeout(() => { el.style.boxShadow = ''; }, 400);
            });
        });
        const saved = getSettings();
        if (typeof saved[opts.persistKey + 'Checked'] === 'boolean') checkbox.checked = saved[opts.persistKey + 'Checked'];
        if (inputMin && typeof saved[opts.persistKey + 'GenesMin'] === 'number') inputMin.value = saved[opts.persistKey + 'GenesMin'];
        if (inputMax && typeof saved[opts.persistKey + 'GenesMax'] === 'number') inputMax.value = saved[opts.persistKey + 'GenesMax'];
        if (minCountInput && typeof saved[opts.persistKey + 'MinCount'] === 'number') minCountInput.value = saved[opts.persistKey + 'MinCount'];
        function saveSettings() {
            const settingsUpdate = {
                [opts.persistKey + 'Checked']: checkbox.checked
            };
            
            // Only save gene inputs if they exist (not for autoduster)
            if (inputMin && inputMax) {
                settingsUpdate[opts.persistKey + 'GenesMin'] = parseInt(inputMin.value, 10);
                settingsUpdate[opts.persistKey + 'GenesMax'] = parseInt(inputMax.value, 10);
            }
            
            // Only save minCount if the input exists (not for autosqueeze)
            if (minCountInput) {
                settingsUpdate[opts.persistKey + 'MinCount'] = parseInt(minCountInput.value, 10);
            }
            
            // Track last active mode when autosell is checked
            if (opts.persistKey === 'autosell' && checkbox.checked) {
                settingsUpdate.lastActiveMode = 'autosell';
            }
            
            setSettings(settingsUpdate);
            
            // Update widget visibility when checkbox state changes
            // Don't reset stats when enabling/disabling features - preserve session stats
            manageAutosellerWidget();
            
            // If Autosell is being checked, uncheck Autoplant
            if (opts.persistKey === 'autosell' && checkbox.checked) {
                setTimeout(() => {
                    // Try to find the Autoplant checkbox using stored reference or DOM search
                    let autoplantCheckbox = window.autoplantCheckbox;
                    if (!autoplantCheckbox) {
                        // Fallback to DOM search
                        autoplantCheckbox = document.querySelector('input[id="autoplant-checkbox"]');
                    }
                    
                    if (autoplantCheckbox && autoplantCheckbox.checked) {
                        console.log('[Autoseller] Autosell enabled, disabling Autoplant (mutual exclusivity)');
                        autoplantCheckbox.checked = false;
                        autoplantCheckbox.dispatchEvent(new Event('change'));
                    }
                }, 0);
            }
        }
        const settingsInputs = [checkbox];
        if (inputMin) settingsInputs.push(inputMin);
        if (inputMax) settingsInputs.push(inputMax);
        if (minCountInput) {
            settingsInputs.push(minCountInput);
        }
        settingsInputs.forEach(el => {
            el.addEventListener('change', saveSettings);
        });
        async function safeGetCreatureCount(minThreshold, maxThreshold, enabled, summaryDiv, type) {
            try {
                if (!enabled) return 0;
                
                const monsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters || [];
                if (!Array.isArray(monsters)) throw new Error('Creature list unavailable');
                
                if (type === 'Autosell') {
                    const eligibleMonsters = [];
                    for (const monster of monsters) {
                        if (typeof monster.genes === 'number' && 
                            monster.genes >= minThreshold && 
                            monster.genes <= maxThreshold) {
                            const inDaycare = await isCreatureInDaycare(monster.id);
                            if (!inDaycare) {
                                eligibleMonsters.push(monster);
                            }
                        }
                    }
                    return eligibleMonsters.length;
                } else {
                    return monsters.filter(m => 
                        typeof m.genes === 'number' && 
                        m.genes >= minThreshold && 
                        m.genes <= maxThreshold
                    ).length;
                }
            } catch (e) {
                console.warn(`[${modName}][WARN][safeGetCreatureCount] Error getting creature count for ${type}: ${e?.message || 'Unknown error'}`, e);
                summaryDiv.textContent = `${type} error: ${e?.message || 'Unknown error'}`;
                summaryDiv.style.color = '#ff6b6b';
                return null;
            }
        }
        async function updateSummary() {
            const settings = getSettings();
            
            if (opts.summaryType === 'Autoduster') {
                // Autoduster doesn't have gene inputs, just show enabled/disabled status
                if (checkbox.checked) {
                    let statusText = t('mods.autoseller.summaryDisenchantingSimple') || 'Disenchanting equipment.';
                    const ignoreList = settings.autodusterIgnoreList || [];
                    if (ignoreList.length > 0) {
                        const plural = ignoreList.length === 1 ? '' : 's';
                        statusText += tReplace('mods.autoseller.ignoringEquipment', { count: ignoreList.length, plural });
                    }
                    summary.textContent = statusText;
                } else {
                    summary.textContent = tReplace('mods.autoseller.statusDisabled', { type: opts.summaryType });
                }
                summary.style.color = checkbox.checked ? '#4CAF50' : '#ff6b6b';
                return;
            }
            
            let minVal = inputMin ? parseInt(inputMin.value, 10) : 0;
            let maxVal = inputMax ? parseInt(inputMax.value, 10) : 0;
            let count = await safeGetCreatureCount(minVal, maxVal, checkbox.checked, summary, opts.summaryType);
            if (typeof count === 'number') {
                if (checkbox.checked) {
                    if (opts.summaryType === 'Autosell') {
                        const minCountVal = minCountInput ? parseInt(minCountInput.value, 10) : 1;
                        summary.textContent = tReplace('mods.autoseller.summarySelling', { min: minVal, max: maxVal, minCount: minCountVal });
                    } else if (opts.summaryType === 'Autosqueeze') {
                        // Autosqueeze only processes serverResults, so no min count needed
                        let statusText = tReplace('mods.autoseller.summarySqueezingFromRewards', { min: minVal, max: maxVal });
                        const ignoreList = settings.autosqueezeIgnoreList || [];
                        if (ignoreList.length > 0) {
                            const plural = ignoreList.length === 1 ? '' : 's';
                            statusText += tReplace('mods.autoseller.ignoringCreatures', { count: ignoreList.length, plural });
                        }
                        summary.textContent = statusText;
                    } else {
                        const minCountVal = minCountInput ? parseInt(minCountInput.value, 10) : 1;
                        const plural = count === 1 ? '' : 's';
                        // Portuguese pluralization: "será" (singular) vs "serão" (plural)
                        const plural2 = count === 1 ? '' : 'ão';
                        summary.textContent = tReplace('mods.autoseller.summaryCreatures', { 
                            count: count, 
                            plural: plural,
                            plural2: plural2,
                            type: opts.summaryType.toLowerCase(),
                            minCount: minCountVal
                        });
                    }
                } else {
                    summary.textContent = tReplace('mods.autoseller.statusDisabled', { type: opts.summaryType });
                }
                summary.style.color = checkbox.checked ? '#4CAF50' : '#ff6b6b'; // Green when enabled, red when disabled
            }
        }
        const summaryInputs = [checkbox];
        if (inputMin) summaryInputs.push(inputMin);
        if (inputMax) summaryInputs.push(inputMax);
        if (minCountInput) {
            summaryInputs.push(minCountInput);
        }
        summaryInputs.forEach(el => {
            el.addEventListener('input', () => updateSummary());
            el.addEventListener('change', () => updateSummary());
        });
        updateSummary();
        section._checkbox = checkbox;
        if (inputMin) section._inputMin = inputMin;
        if (inputMax) section._inputMax = inputMax;
        if (minCountInput) {
            section._minCountInput = minCountInput;
        }

        return section;
    }

    // =======================
    // 7. State Management & Processing Logic
    // =======================
    
    // Monitor Dragon Plant API for devoured creatures
    function setupDragonPlantAPIMonitor() {
        if (!window.fetch) return;
        
        originalFetch = window.fetch;
        window.fetch = function(...args) {
            const [url, options] = args;
            
            // Check if this is a Dragon Plant API call
            if (typeof url === 'string' && url.includes('quest.plantEat')) {
                return originalFetch.apply(this, args).then(response => {
                    // Clone the response so we can read it without affecting the original
                    const clonedResponse = response.clone();
                    
                    // Process the response asynchronously
                    clonedResponse.json().then(data => {
                        try {
                            if (data && Array.isArray(data) && data[0]?.result?.data?.json) {
                                const result = data[0].result.data.json;
                                
                                // Check if creatures were devoured and gold was received
                                if (result.goldValue && result.goldValue > 0) {
                                    // Count creatures from the request body
                                    let devouredCount = 1; // Default to 1
                                    try {
                                        const requestBody = JSON.parse(options.body);
                                        if (requestBody[0]?.json?.monsterIds && Array.isArray(requestBody[0].json.monsterIds)) {
                                            devouredCount = requestBody[0].json.monsterIds.length;
                                        }
                                    } catch (e) {
                                        console.warn('[Autoseller] Could not parse request body for creature count');
                                    }
                                    
                                    const goldReceived = result.goldValue;
                                    const currentPlantGold = getPlantGold();
                                    const threshold = DRAGON_PLANT_CONFIG.GOLD_THRESHOLD;
                                    const percentToThreshold = currentPlantGold ? Math.round((currentPlantGold / threshold) * 100) : 0;
                                    
                                    console.log(`[Autoseller] Plant: +${goldReceived}g (${devouredCount} creatures) | Total: ${currentPlantGold}/${threshold} (${percentToThreshold}%)`);
                                    stateManager.updateSessionStats('devoured', devouredCount, goldReceived);
                                    
                                    // Check if we should autocollect now that plant gold has increased
                                    checkDragonPlantAutocollect();
                                }
                            }
                        } catch (e) {
                            console.warn('[Autoseller] Error processing Dragon Plant API response:', e);
                        }
                    }).catch(e => {
                        // Ignore JSON parsing errors
                    });
                    
                    return response;
                });
            }
            
            return originalFetch.apply(this, args);
        };
        
    }
    
    // Inventory update tracker for monitoring local inventory sync
    const inventoryUpdateTracker = {
        successCount: 0,
        failureCount: 0,
        consecutiveFailures: 0,
        lastFailureTime: 0,
        
        reset() {
            this.successCount = 0;
            this.failureCount = 0;
            this.consecutiveFailures = 0;
        },
        
        recordSuccess(count) {
            this.successCount += count;
            this.consecutiveFailures = 0;
        },
        
        recordFailure() {
            this.failureCount++;
            this.consecutiveFailures++;
            this.lastFailureTime = Date.now();
        },
        
        shouldForceRefresh() {
            // Force refresh if 5 consecutive failures
            return this.consecutiveFailures >= 5;
        }
    };
    
    const stateManager = {
        sessionStats: {
            soldCount: 0,
            soldGold: 0,
            devouredCount: 0,
            devouredGold: 0,
            squeezedCount: 0,
            squeezedDust: 0,
            disenchantedCount: 0,
            disenchantedDust: 0
        },
        
        processedIds: new Set(),
        
        pendingEquipmentIds: new Set(),
        
        errorStats: {
            fetchErrors: 0,
            squeezeErrors: 0,
            sellErrors: 0,
            disenchantErrors: 0,
            localStorageErrors: 0
        },
        
        lastRun: 0,
        
        updateSessionStats(type, count, value) {
            if (type === 'sold') {
                this.sessionStats.soldCount += count;
                this.sessionStats.soldGold += value;
            } else if (type === 'devoured') {
                this.sessionStats.devouredCount += count;
                this.sessionStats.devouredGold += value;
            } else if (type === 'squeezed') {
                this.sessionStats.squeezedCount += count;
                this.sessionStats.squeezedDust += value;
            } else if (type === 'disenchanted') {
                this.sessionStats.disenchantedCount += count;
                this.sessionStats.disenchantedDust += value;
            }
            
            this.notifyUIUpdate();
        },
        
        markProcessed(ids) {
            ids.forEach(id => this.processedIds.add(id));
        },
        
        isProcessed(id) {
            return this.processedIds.has(id);
        },
        
        updateErrorStats(type) {
            if (this.errorStats.hasOwnProperty(type)) {
                this.errorStats[type]++;
            }
        },
        
        canRun() {
            const now = Date.now();
            if (now - this.lastRun < AUTOSELLER_MIN_DELAY_MS) {
                return false;
            }
            this.lastRun = now;
            return true;
        },
        
        resetSession() {
            this.sessionStats = {
                soldCount: 0,
                soldGold: 0,
                devouredCount: 0,
                devouredGold: 0,
                squeezedCount: 0,
                squeezedDust: 0,
                disenchantedCount: 0,
                disenchantedDust: 0
            };
            this.processedIds.clear();
            this.pendingEquipmentIds.clear();
            this.notifyUIUpdate();
        },
        
        clearProcessedIds() {
            this.processedIds.clear();
        },
        
        addPendingEquipment(id) {
            if (id) {
                // Safety limit to prevent memory leak (max 100 pending equipment)
                if (this.pendingEquipmentIds.size >= 100) {
                    console.warn('[Autoseller] Pending equipment list reached maximum size (100), clearing oldest entries');
                    // Remove oldest entries (convert to array, remove first half, recreate set)
                    const idsArray = Array.from(this.pendingEquipmentIds);
                    const toKeep = idsArray.slice(Math.floor(idsArray.length / 2));
                    this.pendingEquipmentIds.clear();
                    toKeep.forEach(equipId => this.pendingEquipmentIds.add(equipId));
                }
                this.pendingEquipmentIds.add(id);
            }
        },
        
        removePendingEquipment(id) {
            if (id) {
                this.pendingEquipmentIds.delete(id);
            }
        },
        
        getPendingEquipmentIds() {
            return new Set(this.pendingEquipmentIds);
        },
        
        clearPendingEquipment() {
            this.pendingEquipmentIds.clear();
        },
        
        getSessionStats() {
            return { ...this.sessionStats };
        },
        
        getErrorStats() {
            return { ...this.errorStats };
        },
        
        notifyUIUpdate() {
            updateAutosellerSessionWidget();
        }
    };
    
    async function processEligibleMonsters(monsters, type) {
        try {
            const settings = getSettings();
            
            // Check if the feature is enabled before processing
            if (type === 'sell' && settings.autoMode !== 'autosell') {
                return;
            }
            if (type === 'squeeze' && !settings.autosqueezeChecked) {
                return;
            }
            
            // Check if Monster Squeezer is unlocked before attempting to squeeze
            if (type === 'squeeze') {
                const playerFlags = globalThis.state?.player?.getSnapshot?.()?.context?.flags;
                if (playerFlags !== undefined) {
                    const flags = new globalThis.state.utils.Flags(playerFlags);
                    if (!flags.isSet("monsterSqueezer")) {
                        console.log('[Autoseller] ℹ️ Monster Squeezer not unlocked. Visit the store to unlock it!');
                        return;
                    }
                }
            }
            
            // For autosell and autosqueeze: STRICTLY only process the monsters passed in (from serverResults)
            // Never fetch entire inventory to prevent accidental processing
            if (type === 'sell') {
                if (!Array.isArray(monsters) || monsters.length === 0) {
                    return;
                }
            } else if (type === 'squeeze') {
                if (!Array.isArray(monsters) || monsters.length === 0) {
                    return;
                }
                // CRITICAL SAFETY CHECK: Verify all monsters have valid server IDs
                const invalidMonsters = monsters.filter(m => !m || !m.id);
                if (invalidMonsters.length > 0) {
                    return;
                }
            } else {
                // For legacy/other modes: allow fallback to fetch entire inventory
                if (!monsters) {
                    monsters = await fetchServerMonsters();
                }
            }
            
            if (!Array.isArray(monsters)) {
                console.warn(`[${modName}][WARN][processEligibleMonsters] Could not access monster list.`);
                return;
            }
            
            let toSell = [];
            let toSqueeze = [];
            
            if (type === 'sell' && settings.autoMode === 'autosell') {
                // For autosell mode, monsters are already filtered by battle rewards matching
                // FAILSAFE: Filter out any shiny creatures that might have slipped through
                toSell = monsters.filter(m => !stateManager.isProcessed(m.id) && !isShinyCreature(m));
            } else if (type === 'squeeze' && settings.autosqueezeChecked) {
                // For autosqueeze mode, monsters are already filtered by battle rewards matching
                // FAILSAFE: Filter out any shiny creatures that might have slipped through
                toSqueeze = monsters.filter(m => !stateManager.isProcessed(m.id) && !isShinyCreature(m));
            } else {
                // For legacy/other modes, use getEligibleMonsters
                const result = await getEligibleMonsters(settings, monsters);
                toSqueeze = result.toSqueeze;
                toSell = result.toSell;
                
                if (type === 'sell') {
                    toSell = toSell.filter(m => !stateManager.isProcessed(m.id));
                }
            }
            
            if (type === 'sell') {
                if (!toSell.length) {
                    return;
                }
                
                // Log will be combined with result
                const batchSize = SELL_RATE_LIMIT.BATCH_SIZE;
                for (let i = 0; i < toSell.length; i += batchSize) {
                    const batch = toSell.slice(i, i + batchSize);
                    
                    for (const monster of batch) {
                        // FAILSAFE: NEVER autosell shiny creatures
                        if (isShinyCreature(monster)) {
                            continue;
                        }
                        
                        const id = monster.id;
                        
                        // Check if cleaning up before proceeding
                        if (isCleaningUp) return;
                        
                        // Delay before selling and removing (allows UI to settle)
                        await new Promise(resolve => setTimeout(resolve, OPERATION_DELAYS.UI_SETTLE_MS));
                        if (isCleaningUp) return;
                        
                        await apiRateLimiter.waitForSlot();
                        apiRateLimiter.recordRequest();
                        
                        const url = 'https://bestiaryarena.com/api/trpc/game.sellMonster?batch=1';
                        const body = { "0": { json: id } };
                        const result = await apiRequest(url, { method: 'POST', body });
                    
                        if (!result.success && result.status === 429) {
                            console.warn(`[${modName}][WARN][processEligibleMonsters] Rate limited (429) for monster ${id}, waiting...`);
                            await new Promise(resolve => setTimeout(resolve, OPERATION_DELAYS.RATE_LIMIT_RETRY_MS));
                            if (isCleaningUp) return;
                            continue;
                        }
                        
                        const apiResponse = result.data;
                        
                        if (
                            apiResponse &&
                            Array.isArray(apiResponse) &&
                            apiResponse[0]?.result?.data?.json?.goldValue != null &&
                            !stateManager.isProcessed(id)
                        ) {
                            const goldReceived = apiResponse[0].result.data.json.goldValue;
                            
                            stateManager.updateSessionStats('sold', 1, goldReceived);
                            // Remove from local inventory and verify removal before marking as processed
                            const removalResult = await removeMonstersFromLocalInventory([id]);
                            if (removalResult.success) {
                                // Only mark as processed after successful removal verification
                                stateManager.markProcessed([id]);
                            } else {
                                // Removal failed - log warning but don't mark as processed so it can be retried
                                console.warn(`[${modName}][WARN][processEligibleMonsters] Failed to remove monster ${id} from local inventory after selling. Will retry on next batch.`);
                            }
                        } else if (!result.success && result.status === 404) {
                            // 404 means creature no longer exists on server - always remove from local inventory
                            const removalResult = await removeMonstersFromLocalInventory([id]);
                            if (removalResult.success) {
                                // Only mark as processed after successful removal verification
                                stateManager.markProcessed([id]);
                            } else {
                                // Removal failed - log warning but don't mark as processed so it can be retried
                                console.warn(`[${modName}][WARN][processEligibleMonsters] Failed to remove monster ${id} from local inventory (404). Will retry on next batch.`);
                            }
                        } else if (!result.success) {
                            console.warn(`[${modName}][WARN][processEligibleMonsters] Sell API failed for ID ${id}: HTTP ${result.status}`);
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, SELL_RATE_LIMIT.DELAY_BETWEEN_SELLS_MS));
                        if (isCleaningUp) return;
                    }
                    
                    if (i + batchSize < toSell.length) {
                        await new Promise(resolve => setTimeout(resolve, SELL_RATE_LIMIT.BATCH_DELAY_MS));
                        if (isCleaningUp) return;
                    }
                }
            } else if (type === 'squeeze') {
                if (!toSqueeze.length) {
                    return;
                }
                
                // Log will be combined with result
                for (let i = 0; i < toSqueeze.length; i += SELL_RATE_LIMIT.BATCH_SIZE) {
                    const batch = toSqueeze.slice(i, i + SELL_RATE_LIMIT.BATCH_SIZE);
                    
                    // CRITICAL SAFETY CHECK: Verify all monsters in batch have valid server IDs
                    const invalidMonsters = batch.filter(m => !m || !m.id);
                    if (invalidMonsters.length > 0) {
                        continue;
                    }
                    
                    // FAILSAFE: Filter out any shiny creatures from batch
                    const nonShinyBatch = batch.filter(m => !isShinyCreature(m));
                    if (nonShinyBatch.length === 0) {
                        continue;
                    }
                    
                    // Get IDs from LOCAL state, not server state
                    // Match monsters by finding them in local state using gameId + stats
                    const localState = globalThis.state?.player?.getSnapshot?.()?.context;
                    const localMonsters = localState?.monsters || [];
                    const ids = [];
                    
                    for (const serverMonster of nonShinyBatch) {
                        // CRITICAL SAFETY CHECK: Verify server ID exists before processing
                        if (!serverMonster || !serverMonster.id) {
                            continue;
                        }
                        
                        // Find matching monster in local state by gameId and stats
                        const localMonster = localMonsters.find(m => 
                            m.gameId === serverMonster.gameId &&
                            m.hp === serverMonster.hp &&
                            m.ad === serverMonster.ad &&
                            m.ap === serverMonster.ap &&
                            m.armor === serverMonster.armor &&
                            m.magicResist === serverMonster.magicResist &&
                            !m.locked
                        );
                        
                        if (localMonster && localMonster.id) {
                            ids.push(localMonster.id);
                        } else {
                            // Fallback: try to match by server ID if it exists in local state
                            if (localMonsters.find(m => m.id === serverMonster.id)) {
                                ids.push(serverMonster.id);
                            }
                        }
                    }
                    
                    if (!ids.length) {
                        continue;
                    }
                    
                    // Check if cleaning up before proceeding
                    if (isCleaningUp) return;
                    
                    // Delay before squeezing (allows UI to settle)
                    await new Promise(resolve => setTimeout(resolve, OPERATION_DELAYS.UI_SETTLE_MS));
                    if (isCleaningUp) return;
                    
                    await apiRateLimiter.waitForSlot();
                    apiRateLimiter.recordRequest();
                    
                    const url = 'https://bestiaryarena.com/api/trpc/inventory.monsterSqueezer?batch=1';
                    // Use server IDs for API call (API expects server IDs)
                    // CRITICAL SAFETY CHECK: Filter out any invalid IDs before API call
                    const serverIds = nonShinyBatch.map(m => m?.id).filter(id => id && (typeof id === 'number' || typeof id === 'string'));
                    
                    // Final safety check: Ensure we have valid server IDs
                    if (!serverIds || serverIds.length === 0) {
                        continue;
                    }
                    const body = { "0": { json: serverIds } };
                    
                    const result = await apiRequest(url, { method: 'POST', body });
                    
                    const apiResponse = result.data;
                    
                    if (
                        apiResponse &&
                        Array.isArray(apiResponse) &&
                        apiResponse[0]?.result?.data?.json?.dustDiff != null
                    ) {
                        const dustReceived = apiResponse[0].result.data.json.dustDiff;
                        const squeezedCount = Math.floor(dustReceived / API_CONSTANTS.DUST_PER_CREATURE);
                        
                        if (dustReceived > 0) {
                            console.log(`[Autoseller] Squeezed ${squeezedCount} monsters → ${dustReceived} dust`);
                        }
                        
                        stateManager.updateSessionStats('squeezed', squeezedCount, dustReceived);
                        
                        // Remove using LOCAL state IDs (these are what exist in the UI)
                        if (ids.length > 0) {
                            await new Promise(resolve => setTimeout(resolve, OPERATION_DELAYS.BEFORE_REMOVE_FROM_INVENTORY_MS));
                            // Remove from local inventory and verify removal before marking as processed
                            const removalResult = await removeMonstersFromLocalInventory(ids);
                            if (removalResult.success) {
                                // Only mark as processed after successful removal verification
                                stateManager.markProcessed(serverIds);
                            } else {
                                // Removal failed - log warning but don't mark as processed so it can be retried
                                console.warn(`[${modName}][WARN][processEligibleMonsters] Failed to remove ${ids.length} monsters from local inventory after squeezing. Will retry on next batch.`);
                            }
                        } else {
                            // No local IDs found, but API succeeded - mark as processed anyway
                            stateManager.markProcessed(serverIds);
                        }
                    } else if (!result.success && result.status === 404) {
                        // 404 means creatures no longer exist on server - always remove from local inventory
                        if (ids.length > 0) {
                            const removalResult = await removeMonstersFromLocalInventory(ids);
                            if (removalResult.success) {
                                // Only mark as processed after successful removal verification
                                stateManager.markProcessed(serverIds);
                            } else {
                                // Removal failed - log warning but don't mark as processed so it can be retried
                                console.warn(`[${modName}][WARN][processEligibleMonsters] Failed to remove ${ids.length} monsters from local inventory (404). Will retry on next batch.`);
                            }
                        } else {
                            // No local IDs found, but 404 means they're gone - mark as processed anyway
                            stateManager.markProcessed(serverIds);
                        }
                    } else if (!result.success) {
                        console.warn(`[${modName}][WARN][processEligibleMonsters] Squeeze API failed: HTTP ${result.status}`);
                        continue;
                    } else {
                        console.warn(`[Autoseller] ⚠️ Unexpected squeeze API response structure`);
                    }
                
                    if (i + SELL_RATE_LIMIT.BATCH_SIZE < toSqueeze.length) {
                        await new Promise(res => setTimeout(res, SELL_RATE_LIMIT.BATCH_DELAY_MS));
                        if (isCleaningUp) return;
                    }
                }
            }
        } catch (e) {
            console.error(`[${modName}][ERROR][processEligibleMonsters] Failed to ${type} monsters. Error: ${e.message}`, e);
            stateManager.updateErrorStats(`${type}Errors`);
        }
    }
    
    async function processEligibleEquipment(rewardEquipmentIds, inventoryEquipment) {
        try {
            const settings = getSettings();
            
            // Check if autoduster is enabled
            if (!settings.autodusterChecked) {
                return;
            }
            
            // Helper function to filter equipment that should be disenchanted
            function filterEquipmentForDisenchant(inventoryEquipmentList, settings, rewardEquipmentIds = null, isPending = false) {
                const toDisenchant = [];
                const ignoreList = settings.autodusterIgnoreList || [];
                
                for (const invEquipment of inventoryEquipmentList) {
                    const equipmentId = invEquipment?.id;
                    
                    // Skip if no ID
                    if (!equipmentId) {
                        continue;
                    }
                    
                    // For new equipment: verify it's in rewardEquipmentIds
                    if (rewardEquipmentIds && !rewardEquipmentIds.has(equipmentId)) {
                        continue;
                    }
                    
                    // Skip if already processed
                    if (stateManager.isProcessed(equipmentId)) {
                        if (isPending) {
                            stateManager.removePendingEquipment(equipmentId);
                        }
                        continue;
                    }
                    
                    // Get equipment details
                    const equipment = getEquipmentDetails(invEquipment);
                    if (!equipment) {
                        if (isPending) {
                            // Equipment details unavailable - remove from pending to prevent memory leak
                            stateManager.removePendingEquipment(equipmentId);
                        }
                        continue;
                    }
                    
                    // Check ignore list
                    if (ignoreList.includes(equipment.name)) {
                        if (isPending) {
                            stateManager.removePendingEquipment(equipmentId);
                        }
                        continue;
                    }
                    
                    // Check if equipment should be disenchanted
                    if (!shouldDisenchantEquipment(equipment, settings)) {
                        if (isPending) {
                            stateManager.removePendingEquipment(equipmentId);
                        }
                        continue;
                    }
                    
                    toDisenchant.push(equipment);
                }
                
                return toDisenchant;
            }
            
            // Helper function to process equipment disenchanting
            async function processEquipmentDisenchant(equipmentId, isPending = false) {
                // Delay before disenchanting (allows UI to settle)
                await new Promise(resolve => setTimeout(resolve, OPERATION_DELAYS.UI_SETTLE_MS));
                
                // Wait for rate limiter slot
                await apiRateLimiter.waitForSlot();
                apiRateLimiter.recordRequest();
                
                // Disenchant the equipment
                const result = await disenchantEquipment(equipmentId);
                
                if (result.success) {
                    // Track equipment count (each equipment = 25 dust as per specification)
                    stateManager.updateSessionStats('disenchanted', 1, 1);
                    // Remove from local inventory and verify removal before marking as processed
                    const removalResult = await removeEquipmentFromLocalInventory([equipmentId]);
                    if (removalResult.success) {
                        // Only mark as processed after successful removal verification
                        stateManager.markProcessed([equipmentId]);
                        // Remove from pending list on success
                        stateManager.removePendingEquipment(equipmentId);
                    } else {
                        // Removal failed - log warning but don't mark as processed so it can be retried
                        console.warn(`[Autoseller] Failed to remove equipment ${equipmentId} from local inventory after disenchanting. Will retry on next batch.`);
                        // Keep in pending list for retry
                        if (!isPending) {
                            stateManager.addPendingEquipment(equipmentId);
                        }
                    }
                    // Return result for consolidated logging
                    return { success: true, dustGained: result.dustGained || 0 };
                } else if (result.status === 404) {
                    // 404 means equipment no longer exists on server - always remove from local inventory
                    const removalResult = await removeEquipmentFromLocalInventory([equipmentId]);
                    if (removalResult.success) {
                        // Only mark as processed after successful removal verification
                        stateManager.markProcessed([equipmentId]);
                    } else {
                        // Removal failed - log warning but don't mark as processed so it can be retried
                        console.warn(`[Autoseller] Failed to remove equipment ${equipmentId} from local inventory (404). Will retry on next batch.`);
                    }
                    // Remove from pending list on 404 (equipment doesn't exist)
                    stateManager.removePendingEquipment(equipmentId);
                    return { success: false, status: 404 };
                } else if (result.status === 429) {
                    await new Promise(resolve => setTimeout(resolve, OPERATION_DELAYS.RATE_LIMIT_RETRY_MS));
                    // Keep in pending list for retry
                    if (!isPending) {
                        stateManager.addPendingEquipment(equipmentId);
                    }
                    return { success: false, status: 429 };
                } else {
                    // Other errors - keep in pending list for retry
                    console.warn(`[Autoseller] Failed to disenchant equipment ${equipmentId}, will retry. Status: ${result.status || 'unknown'}`);
                    if (!isPending) {
                        stateManager.addPendingEquipment(equipmentId);
                    }
                    return { success: false, status: result.status };
                }
                
                // Delay between disenchant operations
                await new Promise(resolve => setTimeout(resolve, SELL_RATE_LIMIT.DELAY_BETWEEN_SELLS_MS));
            }
            
            // Process new equipment from serverResults if available
            if (rewardEquipmentIds && rewardEquipmentIds.size > 0) {
                if (!Array.isArray(inventoryEquipment) || inventoryEquipment.length === 0) {
                    // If no inventory, add all equipment IDs to pending for retry when inventory is available
                    for (const equipmentId of rewardEquipmentIds) {
                        if (!stateManager.isProcessed(equipmentId)) {
                            stateManager.addPendingEquipment(equipmentId);
                        }
                    }
                } else {
                    // Match inventory equipment ONLY by exact server ID match
                    const matchedEquipment = filterEquipmentByServerIds(inventoryEquipment, rewardEquipmentIds);
                    
                    // Track which equipment IDs from serverResults are not yet in inventory
                    const matchedIds = new Set(matchedEquipment.map(eq => eq?.id).filter(Boolean));
                    for (const equipmentId of rewardEquipmentIds) {
                        if (!matchedIds.has(equipmentId) && !stateManager.isProcessed(equipmentId)) {
                            // Equipment found in serverResults but not yet in inventory - add to pending for retry
                            stateManager.addPendingEquipment(equipmentId);
                        }
                    }
                    
                    if (matchedEquipment.length > 0) {
                        // CRITICAL SAFETY CHECK: Verify all matched equipment have valid server IDs that are in rewardEquipmentIds
                        const invalidEquipment = matchedEquipment.filter(eq => !eq || !eq.id || !rewardEquipmentIds.has(eq.id));
                        if (invalidEquipment.length === 0) {
                            // Filter equipment that should be disenchanted
                            const toDisenchant = filterEquipmentForDisenchant(matchedEquipment, settings, rewardEquipmentIds, false);
                            
                            if (toDisenchant.length > 0) {
                                let disenchantedCount = 0;
                                let totalDust = 0;
                                
                                // Process each equipment item
                                for (const equipment of toDisenchant) {
                                    const equipmentId = equipment.id;
                                    
                                    // CRITICAL SAFETY CHECK: Final verification before API call
                                    if (!rewardEquipmentIds.has(equipmentId)) {
                                        continue;
                                    }
                                    
                                    // Add to pending list before attempting disenchant
                                    stateManager.addPendingEquipment(equipmentId);
                                    
                                    const result = await processEquipmentDisenchant(equipmentId, false);
                                    if (result && result.success) {
                                        disenchantedCount++;
                                        totalDust += result.dustGained || 0;
                                    }
                                }
                                
                                if (disenchantedCount > 0) {
                                    console.log(`[Autoseller] Disenchanted ${disenchantedCount} equipment → ${totalDust} dust`);
                                }
                            }
                        }
                    }
                }
            }
            
            // Check and retry pending equipment IDs (always check, even if no new equipment)
            const pendingIds = stateManager.getPendingEquipmentIds();
            if (pendingIds.size > 0) {
                // Fetch current inventory
                const currentInventory = await fetchServerEquipment();
                const inventoryIds = new Set((currentInventory || []).map(eq => eq?.id).filter(Boolean));
                
                // Remove pending IDs that are no longer in inventory (memory leak prevention)
                for (const pendingId of pendingIds) {
                    if (!inventoryIds.has(pendingId)) {
                        // Equipment no longer in inventory - remove from pending
                        stateManager.removePendingEquipment(pendingId);
                    }
                }
                
                // Get updated pending list after cleanup
                const remainingPendingIds = stateManager.getPendingEquipmentIds();
                
                if (remainingPendingIds.size > 0 && currentInventory && currentInventory.length > 0) {
                    // Filter inventory to only include pending equipment IDs
                    const pendingEquipment = currentInventory.filter(invEquipment => 
                        invEquipment && invEquipment.id && remainingPendingIds.has(invEquipment.id)
                    );
                    
                    if (pendingEquipment.length > 0) {
                        // Filter equipment that should be disenchanted (with pending cleanup)
                        const toDisenchant = filterEquipmentForDisenchant(pendingEquipment, settings, null, true);
                        
                        if (toDisenchant.length > 0) {
                            let disenchantedCount = 0;
                            let totalDust = 0;
                            
                            for (const equipment of toDisenchant) {
                                const result = await processEquipmentDisenchant(equipment.id, true);
                                if (result && result.success) {
                                    disenchantedCount++;
                                    totalDust += result.dustGained || 0;
                                }
                            }
                            
                            if (disenchantedCount > 0) {
                                console.log(`[Autoseller] Retried ${disenchantedCount} pending equipment → ${totalDust} dust`);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error(`[${modName}][ERROR][processEligibleEquipment] Failed to disenchant equipment. Error: ${e.message}`, e);
            stateManager.updateErrorStats('disenchantErrors');
        }
    }

    // =======================
    // 8. Modal & Settings Management
    // =======================
    
    function openAutosellerModal() {
        if (typeof api !== 'undefined' && api && api.ui && api.ui.components && api.ui.components.createModal) {
            // Create main content container with tabs (Mod Settings style)
            const content = document.createElement('div');
            
            // Apply sizing and layout styles to content
            const contentWidth = UI_CONSTANTS.MODAL_WIDTH - 30;
            Object.assign(content.style, {
                width: '100%',
                height: '100%',
                minWidth: `${contentWidth}px`,
                maxWidth: `${contentWidth}px`,
                minHeight: `${UI_CONSTANTS.MODAL_HEIGHT}px`,
                maxHeight: `${UI_CONSTANTS.MODAL_HEIGHT}px`,
                boxSizing: 'border-box',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                flex: '1 1 0',
                border: '6px solid transparent',
                borderImage: 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill',
                backgroundImage: 'url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png")',
                padding: '8px'
            });
            
            // Create main content container with 2-column layout
            const mainContent = document.createElement('div');
            Object.assign(mainContent.style, {
                display: 'flex',
                flexDirection: 'row',
                gap: '8px',
                height: '100%',
                flex: '1 1 0'
            });
            
            // Left column - Menu items (tabs)
            const leftColumn = document.createElement('div');
            Object.assign(leftColumn.style, {
                width: `${UI_CONSTANTS.LEFT_COLUMN_WIDTH}px`,
                minWidth: `${UI_CONSTANTS.LEFT_COLUMN_WIDTH}px`,
                maxWidth: `${UI_CONSTANTS.LEFT_COLUMN_WIDTH}px`,
                height: '100%',
                flex: `0 0 ${UI_CONSTANTS.LEFT_COLUMN_WIDTH}px`,
                display: 'flex',
                flexDirection: 'column',
                padding: '0px',
                margin: '0px 10px 0px 0px',
                borderRight: '6px solid transparent',
                borderImage: 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill',
                overflowY: 'auto',
                minHeight: '0px'
            });
            
            // Right column - Content
            const rightColumn = document.createElement('div');
            Object.assign(rightColumn.style, {
                width: `${UI_CONSTANTS.RIGHT_COLUMN_WIDTH}px`,
                minWidth: `${UI_CONSTANTS.RIGHT_COLUMN_WIDTH}px`,
                maxWidth: `${UI_CONSTANTS.RIGHT_COLUMN_WIDTH}px`,
                flex: `0 0 ${UI_CONSTANTS.RIGHT_COLUMN_WIDTH}px`,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                overflowY: 'auto',
                padding: '2px'
            });
            
            // Helper function to apply menu item styling
            function applyMenuItemStyle(element, selected, enabled) {
                if (selected) {
                    element.style.border = '6px solid transparent';
                    element.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png") 6 fill';
                    element.style.backgroundColor = 'transparent';
                } else {
                    element.style.border = '6px solid transparent';
                    element.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 6 fill';
                    element.style.backgroundColor = 'transparent';
                }
                
                // Apply color based on enabled/disabled state
                const span = element.querySelector('span');
                if (span) {
                    if (enabled) {
                        span.style.color = '#22c55e'; // Green when enabled
                    } else {
                        span.style.color = '#ef4444'; // Red when disabled
                    }
                }
            }
            
            // Function to update menu item colors based on current settings
            function updateMenuItemColors() {
                const currentSettings = getSettings();
                // Find menu items dynamically from DOM
                const autoplantMenuItem = document.querySelector('[data-category="autoplant"]');
                const autosqueezeMenuItem = document.querySelector('[data-category="autosqueeze"]');
                const autodusterMenuItem = document.querySelector('[data-category="autoduster"]');
                
                if (autoplantMenuItem) {
                    const isEnabled = currentSettings.autoMode === 'autoplant' || currentSettings.autoMode === 'autosell';
                    const span = autoplantMenuItem.querySelector('span');
                    if (span) {
                        span.style.color = isEnabled ? '#22c55e' : '#ef4444';
                    }
                }
                
                if (autosqueezeMenuItem) {
                    const isEnabled = currentSettings.autosqueezeChecked || false;
                    const span = autosqueezeMenuItem.querySelector('span');
                    if (span) {
                        span.style.color = isEnabled ? '#22c55e' : '#ef4444';
                    }
                }
                
                if (autodusterMenuItem) {
                    const isEnabled = currentSettings.autodusterChecked || false;
                    const span = autodusterMenuItem.querySelector('span');
                    if (span) {
                        span.style.color = isEnabled ? '#22c55e' : '#ef4444';
                    }
                }
            }
            
            // Store function globally so it can be called from outside the modal
            window.updateAutosellerMenuItemColors = updateMenuItemColors;
            
            // Get initial settings for enabled state
            const initialSettings = getSettings();
            
            // Create menu items for left column (Auto Mode, Autosqueeze, Autoduster)
            // Note: Autosell is now part of the Auto Mode tab (consolidated with Autoplant)
            const menuItems = [
                { 
                    id: 'autoplant', 
                    label: t('mods.autoseller.autoseller') || 'Autoseller',
                    icon: 'https://bestiaryarena.com/assets/icons/goldpile.png',
                    iconSize: { width: 12, height: 12 },
                    selected: true,
                    enabled: initialSettings.autoMode === 'autoplant' || initialSettings.autoMode === 'autosell'
                },
                { 
                    id: 'autosqueeze', 
                    label: t('mods.autoseller.autosqueezeLabel'),
                    icon: 'https://bestiaryarena.com/assets/icons/enemy.png',
                    iconSize: { width: 11, height: 11 },
                    selected: false,
                    enabled: initialSettings.autosqueezeChecked || false
                },
                { 
                    id: 'autoduster', 
                    label: t('mods.autoseller.autodusterLabel') || 'Autoduster',
                    icon: 'https://bestiaryarena.com/assets/icons/equips.png',
                    iconSize: { width: 9, height: 9 },
                    selected: false,
                    enabled: initialSettings.autodusterChecked || false
                }
            ];
            
            // Function to update right column content based on selected category
            function updateRightColumn(categoryId) {
                rightColumn.innerHTML = '';
                
                let sectionContent = null;
                // Create sections fresh each time to ensure event handlers work correctly
                if (categoryId === 'autoplant') {
                    // Autoplant tab now contains both autoplant and autosell mode selection (radio buttons)
                    sectionContent = createAutplantPlaceholder();
                } else if (categoryId === 'autosqueeze') {
                    sectionContent = createSettingsSection({
                        label: 'Autosqueeze',
                        inputLabel: 'Genes',
                        desc: '', // Description removed
                        tooltip: 'When enabled, creatures with genes at or below the specified percentage will be squeezed automatically.',
                        inputMin: 80,
                        inputMax: 100,
                        defaultMin: 80,
                        defaultMax: 100,
                        summaryType: 'Autosqueeze',
                        persistKey: 'autosqueeze',
                        icon: 'https://bestiaryarena.com/assets/icons/dust.png'
                    });
                } else if (categoryId === 'autoduster') {
                    sectionContent = createSettingsSection({
                        label: 'Autodust',
                        inputLabel: 'Genes',
                        desc: '', // Description removed
                        tooltip: 'When enabled, creatures with genes at or below the specified percentage will be disenchanted automatically.',
                        inputMin: 80,
                        inputMax: 100,
                        defaultMin: 80,
                        defaultMax: 100,
                        summaryType: 'Autoduster',
                        persistKey: 'autoduster',
                        icon: 'https://bestiaryarena.com/assets/icons/dust.png'
                    });
                }
                
                if (sectionContent) {
                    rightColumn.appendChild(sectionContent);
                    
                    // Re-attach event handlers and apply settings
                    setTimeout(() => {
                        // Re-apply localStorage to mod checkbox when switching to autoplant tab
                        if (categoryId === 'autoplant') {
                            applyLocalStorageToModCheckbox();
                        }
                        
                        // Set up checkbox/radio listeners for new content
                        if (content._setupCheckboxListeners) {
                            content._setupCheckboxListeners();
                        }
                        
                        // Update menu item colors after content is rendered
                        updateMenuItemColors();
                    }, 0);
                }
            }
            
            menuItems.forEach(item => {
                const menuItem = document.createElement('div');
                menuItem.className = 'menu-item pixel-font-16';
                menuItem.dataset.category = item.id;
                Object.assign(menuItem.style, {
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    textAlign: 'left',
                    color: 'rgb(255, 255, 255)',
                    background: 'none',
                    filter: 'none'
                });
                
                // Create inner flex container
                const innerDiv = document.createElement('div');
                Object.assign(innerDiv.style, {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                });
                
                // Add icon if available
                if (item.icon) {
                    const iconImg = document.createElement('img');
                    iconImg.src = item.icon;
                    iconImg.alt = item.label;
                    iconImg.className = 'pixelated';
                    Object.assign(iconImg.style, {
                        width: `${item.iconSize?.width || 12}px`,
                        height: `${item.iconSize?.height || 12}px`,
                        display: 'block'
                    });
                    innerDiv.appendChild(iconImg);
                }
                
                const span = document.createElement('span');
                span.textContent = item.label;
                innerDiv.appendChild(span);
                menuItem.appendChild(innerDiv);
                
                applyMenuItemStyle(menuItem, item.selected, item.enabled);
                
                menuItem.addEventListener('click', () => {
                    // Update menu selection
                    menuItems.forEach(mi => {
                        mi.selected = (mi.id === item.id);
                        const miElement = leftColumn.querySelector(`[data-category="${mi.id}"]`);
                        if (miElement) {
                            const currentSettings = getSettings();
                            let isEnabled = false;
                            if (mi.id === 'autoplant') {
                                isEnabled = currentSettings.autoMode === 'autoplant';
                            } else if (mi.id === 'autosell') {
                                isEnabled = currentSettings.autoMode === 'autosell';
                            } else if (mi.id === 'autosqueeze') {
                                isEnabled = currentSettings.autosqueezeChecked || false;
                            } else if (mi.id === 'autoduster') {
                                isEnabled = currentSettings.autodusterChecked || false;
                            }
                            applyMenuItemStyle(miElement, mi.selected, isEnabled);
                        }
                    });
                    
                    // Update right column content
                    updateRightColumn(item.id);
                });
                
                // Add hover effect
                menuItem.addEventListener('mouseenter', () => {
                    const isSelected = menuItem.style.borderImage && menuItem.style.borderImage.includes('pressed');
                    if (!isSelected) {
                        menuItem.style.background = 'rgba(255,255,255,0.08)';
                    }
                });
                menuItem.addEventListener('mouseleave', () => {
                    const isSelected = menuItem.style.borderImage && menuItem.style.borderImage.includes('pressed');
                    if (!isSelected) {
                        menuItem.style.background = 'none';
                    }
                });
                
                leftColumn.appendChild(menuItem);
            });
            
            // Initialize with Autoplant category selected
            updateRightColumn('autoplant');
            
            // Add columns to main content
            mainContent.appendChild(leftColumn);
            mainContent.appendChild(rightColumn);
            
            // Add main content to content
            content.appendChild(mainContent);
            
            // Set up observer to update menu item colors when checkboxes change
            // This observer watches the entire right column for checkbox changes
            // Use global menuColorObserver variable for proper cleanup
            menuColorObserver = new MutationObserver((mutations) => {
                let shouldUpdate = false;
                mutations.forEach(mutation => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'checked') {
                        shouldUpdate = true;
                    } else if (mutation.type === 'childList') {
                        // Check if a checkbox was added
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1) {
                                const checkbox = node.querySelector?.('input[type="checkbox"]');
                                if (checkbox || node.tagName === 'INPUT' && node.type === 'checkbox') {
                                    shouldUpdate = true;
                                }
                            }
                        });
                    }
                });
                if (shouldUpdate) {
                    setTimeout(() => updateMenuItemColors(), 10);
                }
            });
            
            // Observe the right column for checkbox changes
            menuColorObserver.observe(rightColumn, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['checked']
            });
            
            // Also listen to change events on radio buttons and checkboxes directly
            const setupCheckboxListeners = () => {
                // Clean up existing listeners first
                checkboxListeners.forEach(({ element, handler }) => {
                    element.removeEventListener('change', handler);
                });
                checkboxListeners = [];
                
                const allInputs = [
                    'autoplant-radio',
                    'autosell-radio',
                    'auto-none-radio',
                    'autosqueeze-checkbox',
                    'autoduster-checkbox'
                ];
                
                allInputs.forEach(id => {
                    const input = document.querySelector(`input[id="${id}"]`);
                    if (input && !input.dataset.colorListenerAttached) {
                        input.dataset.colorListenerAttached = 'true';
                        const handler = () => {
                            setTimeout(() => updateMenuItemColors(), 10);
                        };
                        input.addEventListener('change', handler);
                        // Track listener for cleanup
                        checkboxListeners.push({ element: input, handler });
                    }
                });
            };
            
            // Set up listeners initially and after content updates
            setTimeout(() => {
                setupCheckboxListeners();
                updateMenuItemColors();
            }, 100);
            
            // Store observer on content for reuse (global reference already set above)
            content._menuColorObserver = menuColorObserver;
            content._setupCheckboxListeners = setupCheckboxListeners;
            
            let modalInstance = api.ui.components.createModal({
                title: t('mods.autoseller.modalTitle'),
                width: UI_CONSTANTS.MODAL_WIDTH,
                height: UI_CONSTANTS.MODAL_HEIGHT,
                content: content,
                buttons: [
                    {
                        text: t('mods.autoseller.closeButton'),
                        primary: true,
                        className: 'diceroller-btn',
                        style: {
                            width: '120px',
                            padding: '6px 28px',
                            margin: '0 4px',
                            boxSizing: 'border-box',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            border: '6px solid transparent',
                            borderColor: '#ffe066',
                            borderImage: 'url(https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png) 6 fill stretch',
                            color: '#e6d7b0',
                            background: 'url(https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png) repeat',
                            borderRadius: '0',
                            fontFamily: "'Trebuchet MS', 'Arial Black', Arial, sans-serif"
                        }
                    }
                ]
            });
            
            if (modalInstance && typeof modalInstance.onClose === 'function') {
                modalInstance.onClose(() => {
                    // Modal cleanup handled automatically
                });
            }
            
            // Set static size for the modal dialog (non-resizable)
            setTimeout(() => {
                const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
                if (dialog) {
                    dialog.style.width = `${UI_CONSTANTS.MODAL_WIDTH}px`;
                    dialog.style.minWidth = `${UI_CONSTANTS.MODAL_WIDTH}px`;
                    dialog.style.maxWidth = `${UI_CONSTANTS.MODAL_WIDTH}px`;
                    dialog.style.height = `${UI_CONSTANTS.MODAL_HEIGHT}px`;
                    dialog.style.minHeight = `${UI_CONSTANTS.MODAL_HEIGHT}px`;
                    dialog.style.maxHeight = `${UI_CONSTANTS.MODAL_HEIGHT}px`;
                    dialog.classList.remove('max-w-[300px]');
                    
                    // Style the content wrapper for proper flexbox layout
                    let contentWrapper = null;
                    const children = Array.from(dialog.children);
                    for (const child of children) {
                        if (child !== dialog.firstChild && child.tagName === 'DIV') {
                            contentWrapper = child;
                            break;
                        }
                    }
                    if (!contentWrapper) {
                        contentWrapper = dialog.querySelector(':scope > div');
                    }
                    if (contentWrapper) {
                        contentWrapper.style.height = '100%';
                        contentWrapper.style.display = 'flex';
                        contentWrapper.style.flexDirection = 'column';
                        contentWrapper.style.flex = '1 1 0';
                    }
                    
                    // Apply localStorage to mod checkbox when modal opens (for autoplant mode)
                    const currentSettings = getSettings();
                    if (currentSettings.autoMode === 'autoplant') {
                        applyLocalStorageToModCheckbox();
                    }
                    
                    // Set up checkbox/radio listeners and update colors on modal open
                    if (content._setupCheckboxListeners) {
                        content._setupCheckboxListeners();
                    }
                    updateMenuItemColors();
                }
            }, 0);
        }
    }

    // =======================
    // 9. Navigation & UI Injection
    // =======================
    
    function addAutosellerNavButton() {
        function tryInsert() {
            const nav = queryElement('nav.shrink-0');
            if (!nav) {
                setTimeout(tryInsert, 500);
                return;
            }
            
            const ul = nav.querySelector('ul.flex.items-center');
            if (!ul) {
                setTimeout(tryInsert, 500);
                return;
            }
            
            if (ul.querySelector(`.${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_NAV_BTN}`)) return;
            
            const li = document.createElement('li');
            li.className = 'hover:text-whiteExp';
            
            const btn = document.createElement('button');
            btn.className = `${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_NAV_BTN} focus-style-visible pixel-font-16 relative my-px flex items-center gap-1.5 border border-solid border-transparent px-1 py-0.5 active:frame-pressed-1 data-[selected="true"]:frame-pressed-1 hover:text-whiteExp data-[selected="true"]:text-whiteExp sm:px-2 sm:py-0.5`;
            btn.setAttribute('data-selected', 'false');
            btn.innerHTML = `<img src="https://bestiaryarena.com/assets/icons/goldpile.png" alt="${t('mods.autoseller.navButton')}" width="12" height="12" class="pixelated"><span class="hidden sm:inline">${t('mods.autoseller.navButton')}</span>`;
            btn.onclick = openAutosellerModal;
            
            li.appendChild(btn);
            ul.appendChild(li);
            
            updateAutosellerNavButtonColor();
        }
        tryInsert();
    }
    
    function updateAutosellerNavButtonColor() {
        const btn = queryElement(`.${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_NAV_BTN}`);
        if (!btn) return;
        
        const settings = getSettings();
        // Green if ANY tabs are enabled (autosell, autoplant, autosqueeze, or autoduster)
        const isActive = settings.autoMode === 'autoplant' || settings.autoMode === 'autosell' || settings.autosqueezeChecked || settings.autodusterChecked;
        
        btn.style.color = isActive ? '#22c55e' : '#ef4444';
    }

    // =======================
    // 10. Session Widget & Display
    // =======================
    
    function injectAutosellerWidgetStyles() {
        if (!document.getElementById('autoseller-widget-css')) {
            const style = document.createElement('style');
            style.id = 'autoseller-widget-css';
            style.textContent = `
            #autoseller-session-widget {
                font-family: 'Satoshi', 'Trebuchet MS', Arial, sans-serif;
                max-width: 360px;
            }
            #autoseller-session-widget .stat-row {
                display: grid;
                grid-template-columns: auto 1fr 1fr;
                gap: 8px;
                align-items: center;
                width: 100%;
                padding: 10px;
                box-sizing: border-box;
            }
            #autoseller-session-widget .stat-row.single-tab {
                padding-top: 12px;
                padding-bottom: 12px;
            }
            #autoseller-session-widget .separator {
                grid-column: 1 / -1;
                height: 1px;
                margin: 2px 0;
                background: #ffe066;
                opacity: 0.35;
            }
            #autoseller-session-widget .stat-label {
                font-family: pixel-font-16, monospace;
                font-size: 13px;
                color: #fff;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: flex-start;
                text-align: left;
                width: 100%;
            }
            #autoseller-session-widget .stat-value {
                font-family: pixel-font-16, monospace;
                font-size: 12px;
                color: #ffe066;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: flex-start;
                text-align: left;
                width: 100%;
                gap: 4px;
            }
            #autoseller-session-widget .stat-icon {
                width: 14px;
                height: 14px;
                vertical-align: middle;
            }
            `;
            document.head.appendChild(style);
        }
    }

    function createAutosellerSessionWidget(resetStats = false) {
        const settings = getSettings();
        const shouldShowWidget = shouldShowAutosellerWidget();
        
        const existingWidget = queryElement(`#${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET}`);
        if (!shouldShowWidget) {
            if (existingWidget && existingWidget.parentNode) {
                existingWidget.parentNode.removeChild(existingWidget);
                // Reset session stats when widget is removed
                stateManager.resetSession();
            }
            return;
        }
        if (existingWidget) {
            return;
        }
        
        // Find the autoplay session container using the helper function
        const autoplayContainer = findAutoplayContainer();
        
        if (!autoplayContainer) {
            return;
        }
        const widget = document.createElement('div');
        widget.className = 'mt-1.5';
        widget.id = UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET;
        
        // Determine which tabs are enabled
        const isAutosellEnabled = settings.autoMode === 'autosell';
        const isAutoplantEnabled = settings.autoMode === 'autoplant';
        const isAutosqueezeEnabled = settings.autosqueezeChecked;
        const isAutodusterEnabled = settings.autodusterChecked;
        
        // Build widget HTML dynamically based on enabled tabs
        const statRows = [];
        const statEls = {};
        let rowIndex = 1;
        
        // Autosell/Autoplant row
        if (isAutosellEnabled || isAutoplantEnabled) {
            const soldLabel = isAutoplantEnabled
                ? t('mods.autoseller.devoured')
                : t('mods.autoseller.sold');
            statRows.push(`
                <div class="stat-label" data-stat="sold">${soldLabel}</div>
                <div class="stat-value" id="autoseller-session-sold-count" data-stat="sold">0</div>
                <div class="stat-value" id="autoseller-session-sold-gold" data-stat="sold">
                    <img src="https://bestiaryarena.com/assets/icons/goldpile.png" alt="Gold" class="stat-icon">
                    <span>0</span>
                </div>
            `);
            statEls.soldLabel = true;
            statEls.soldCount = true;
            statEls.soldGold = true;
            rowIndex++;
        }
        
        // Autosqueeze row
        if (isAutosqueezeEnabled) {
            if (statRows.length > 0) {
                statRows.push('<div class="separator"></div>');
            }
            statRows.push(`
                <div class="stat-label" data-stat="squeezed">${t('mods.autoseller.squeezed')}</div>
                <div class="stat-value" id="autoseller-session-squeezed-count" data-stat="squeezed">0</div>
                <div class="stat-value" id="autoseller-session-squeezed-dust" data-stat="squeezed">
                    <img src="https://bestiaryarena.com/assets/icons/dust.png" alt="Dust" class="stat-icon">
                    <span>0</span>
                </div>
            `);
            statEls.squeezedCount = true;
            statEls.squeezedDust = true;
            rowIndex++;
        }
        
        // Autoduster row
        if (isAutodusterEnabled) {
            if (statRows.length > 0) {
                statRows.push('<div class="separator"></div>');
            }
            statRows.push(`
                <div class="stat-label" data-stat="disenchanted">${t('mods.autoseller.dustingLabel')}</div>
                <div class="stat-value" id="autoseller-session-disenchanted-count" data-stat="disenchanted">0</div>
                <div class="stat-value" id="autoseller-session-disenchanted-dust" data-stat="disenchanted">
                    <img src="https://bestiaryarena.com/assets/icons/dust.png" alt="Dust" class="stat-icon">
                    <span>0</span>
                </div>
            `);
            statEls.disenchantedCount = true;
            statEls.disenchantedDust = true;
        }
        
        // Count enabled tabs for height adjustment
        const enabledTabCount = (isAutosellEnabled || isAutoplantEnabled ? 1 : 0) + 
                                (isAutosqueezeEnabled ? 1 : 0) + 
                                (isAutodusterEnabled ? 1 : 0);
        const isSingleTab = enabledTabCount === 1;
        const statRowClass = isSingleTab ? 'stat-row single-tab' : 'stat-row';
        
        // Build header (match Tick Tracker widget style)
        const header = document.createElement('div');
        header.className = 'widget-top widget-top-text flex items-center gap-1.5';
        const headerIcon = document.createElement('img');
        headerIcon.src = 'https://bestiaryarena.com/assets/icons/goldpile.png';
        headerIcon.style.width = '12px';
        headerIcon.style.height = '12px';
        header.appendChild(headerIcon);
        header.appendChild(document.createTextNode(t('mods.autoseller.widgetTitle')));

        // Clear history/session stats button (matches Tick Tracker style)
        const clearButton = document.createElement('button');
        clearButton.className = 'ml-auto flex h-5 w-5 items-center justify-center rounded-md hover:bg-black/40';
        clearButton.title = 'Clear session stats';
        clearButton.innerHTML = '×';
        clearButton.onclick = () => {
            stateManager.resetSession();
            updateAutosellerSessionWidget();
        };
        header.appendChild(clearButton);

        widget.appendChild(header);

        // Build body with stats
        const body = document.createElement('div');
        body.className = 'widget-bottom p-0';
        const statWrapper = document.createElement('div');
        statWrapper.className = statRowClass;
        statWrapper.innerHTML = statRows.join('');
        body.appendChild(statWrapper);
        widget.appendChild(body);
        
        // Inject styles when widget is actually created
        injectAutosellerWidgetStyles();
        
        // Reset session stats only if explicitly requested (e.g., first creation, not when switching modes)
        if (resetStats) {
            stateManager.resetSession();
        }
        
        // Store references to stat elements for updates
        widget._statEls = {
            soldLabel: widget.querySelector('[data-stat="sold"].stat-label'),
            soldCount: widget.querySelector('#autoseller-session-sold-count'),
            soldGold: widget.querySelector('#autoseller-session-sold-gold'),
            squeezedCount: widget.querySelector('#autoseller-session-squeezed-count'),
            squeezedDust: widget.querySelector('#autoseller-session-squeezed-dust'),
            disenchantedCount: widget.querySelector('#autoseller-session-disenchanted-count'),
            disenchantedDust: widget.querySelector('#autoseller-session-disenchanted-dust')
        };
        
        // Store enabled tabs for update function
        widget._enabledTabs = {
            autosell: isAutosellEnabled,
            autoplant: isAutoplantEnabled,
            autosqueeze: isAutosqueezeEnabled,
            autoduster: isAutodusterEnabled
        };
        
        // Insert widget at the end of the container (after Enable Dragon Plant checkbox)
        autoplayContainer.appendChild(widget);
    }


    
    function updateAutosellerSessionWidget() {
        const widget = queryElement(`#${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET}`);
        if (!widget) return;
        
        const statEls = widget._statEls;
        if (!statEls) return;
        
        const enabledTabs = widget._enabledTabs;
        if (!enabledTabs) return;
        
        const currentValues = stateManager.getSessionStats();
        const settings = getSettings();
        
        // Update autosell/autoplant stats (only if enabled)
        if (enabledTabs.autosell || enabledTabs.autoplant) {
            const isShowingDevoured = enabledTabs.autoplant;
            const soldLabel = isShowingDevoured
                ? t('mods.autoseller.devoured')
                : t('mods.autoseller.sold');
            
            if (statEls.soldLabel) {
                statEls.soldLabel.textContent = soldLabel;
            }
            if (statEls.soldCount) {
                const count = isShowingDevoured ? currentValues.devouredCount : currentValues.soldCount;
                statEls.soldCount.textContent = `${count}`;
            }
            if (statEls.soldGold) {
                const goldText = statEls.soldGold.querySelector('span');
                if (goldText) {
                    const gold = isShowingDevoured ? currentValues.devouredGold : currentValues.soldGold;
                    goldText.textContent = `${gold}`;
                }
            }
        }
        
        // Update autosqueeze stats (only if enabled)
        if (enabledTabs.autosqueeze) {
            if (statEls.squeezedCount) {
                statEls.squeezedCount.textContent = `${currentValues.squeezedCount}`;
            }
            if (statEls.squeezedDust) {
                const dustText = statEls.squeezedDust.querySelector('span');
                if (dustText) {
                    dustText.textContent = `${currentValues.squeezedDust}`;
                }
            }
        }
        
        // Update autoduster stats (only if enabled)
        if (enabledTabs.autoduster) {
            if (statEls.disenchantedCount) {
                statEls.disenchantedCount.textContent = `${currentValues.disenchantedCount}`;
            }
            if (statEls.disenchantedDust) {
                const dustText = statEls.disenchantedDust.querySelector('span');
                if (dustText) {
                    // Each equipment = 25 dust (as per user specification)
                    // disenchantedDust stores the count of equipment, multiply by 25 for total dust
                    const totalDust = currentValues.disenchantedDust * 25;
                    dustText.textContent = `${totalDust}`;
                }
            }
        }
    }

    // =======================
    // 11. Widget Lifecycle Management
    // =======================
    
    // Event-driven widget management using game state API
    function setupAutosellerWidgetObserver() {
        // Listen for autoplay mode changes
        if (globalThis.state && globalThis.state.board) {
            boardSubscription1 = globalThis.state.board.subscribe((state) => {
                const mode = state.context.mode;
                
                // Capture serverResults when available, but only update if it's actually different
                if (state.context?.serverResults) {
                    const newServerResults = state.context.serverResults;
                    const newSeed = newServerResults.seed;
                    const currentSeed = latestServerResults?.seed;
                    
                    // Only update if this is a different serverResults (different seed)
                    if (newSeed !== currentSeed) {
                        latestServerResults = newServerResults;
                    }
                    // If same seed, silently skip (board subscription fires multiple times on state changes)
                }
                
                if (mode === 'autoplay') {
                    // Small delay to ensure autoplay UI is rendered
                    const timeoutId = setTimeout(() => {
                        if (isCleaningUp) return;
                        // Manage widget based on current settings (autosell/autoplant/off)
                        manageAutosellerWidget();
                        updateAutosellerSessionWidget();
                        
                        // Apply localStorage to game checkbox when autoplay starts
                        applyLocalStorageToGameCheckbox();
                    }, 100);
                    timeoutIds.push(timeoutId);
                } else if (mode !== 'autoplay') {
                    // Remove widget when not in autoplay mode
                    const widget = getAutosellerWidget();
                    if (widget && widget.parentNode) {
                        widget.parentNode.removeChild(widget);
                        console.log('[Autoseller] Widget removed - autoplay mode ended');
                    }
                }
            });
            
            // Listen for game start/end events for additional widget updates
            emitNewGameHandler1 = () => {
                if (shouldShowAutosellerWidget()) {
                    const timeoutId = setTimeout(() => {
                        if (isCleaningUp) return;
                        updateAutosellerSessionWidget();
                    }, 100);
                    timeoutIds.push(timeoutId);
                }
            };
            globalThis.state.board.on('emitNewGame', emitNewGameHandler1);
            
            emitEndGameHandler1 = () => {
                if (shouldShowAutosellerWidget()) {
                    const timeoutId = setTimeout(() => {
                        if (isCleaningUp) return;
                        updateAutosellerSessionWidget();
                    }, 100);
                    timeoutIds.push(timeoutId);
                }
            };
            globalThis.state.board.on('emitEndGame', emitEndGameHandler1);
        } else {
            console.warn(`[${modName}][WARN] Game state API not available for widget management`);
        }
    }
    
    // Helper function to check if widget should be shown
    function shouldShowAutosellerWidget() {
        const settings = getSettings();
        // Widget should show when autosell, autoplant, autosqueeze, or autoduster is active
        return settings.autoMode === 'autoplant' || settings.autoMode === 'autosell' || settings.autosqueezeChecked || settings.autodusterChecked;
    }
    
    // Function to manage widget based on current mode
    function manageAutosellerWidget() {
        const shouldShow = shouldShowAutosellerWidget();
        const widget = getAutosellerWidget();
        const autoplayContainer = findAutoplayContainer();
        
        if (!shouldShow) {
            // Remove widget if mode is OFF
            if (widget && widget.parentNode) {
                widget.parentNode.removeChild(widget);
                console.log('[Autoseller] Widget removed - mode is OFF');
                stateManager.resetSession();
            }
            return;
        }
        
        // Check if widget needs to be recreated (settings changed)
        const settings = getSettings();
        const needsRecreate = !widget || !widget._enabledTabs || 
            widget._enabledTabs.autosell !== (settings.autoMode === 'autosell') ||
            widget._enabledTabs.autoplant !== (settings.autoMode === 'autoplant') ||
            widget._enabledTabs.autosqueeze !== (settings.autosqueezeChecked) ||
            widget._enabledTabs.autoduster !== (settings.autodusterChecked);
        
        if (needsRecreate) {
            // Remove old widget if it exists
            if (widget && widget.parentNode) {
                widget.parentNode.removeChild(widget);
            }
            // Create new widget with updated settings (don't reset stats when switching modes)
            if (autoplayContainer) {
                createAutosellerSessionWidget(false);
                updateAutosellerSessionWidget();
            }
        } else if (!widget && autoplayContainer) {
            // Widget doesn't exist, create it (reset stats on first creation)
            createAutosellerSessionWidget(true);
            updateAutosellerSessionWidget();
        }
    }
    
    // Helper function to get existing widget
    function getAutosellerWidget() {
        return queryElement(`#${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET}`);
    }

    // =======================
    // 12. Dragon Plant Checkbox Control
    // =======================
    
    let dragonPlantObserver = null;
    let dragonPlantObserverAttempts = 0;
    
    // Apply localStorage state to game checkbox
    // Helper function to find autoplay container (widget-bottom)
    function findAutoplayContainer() {
        // Try to find by data-autosetup first (old method)
        const autoplaySessions = document.querySelectorAll('div[data-autosetup]');
        for (const session of autoplaySessions) {
            const widgetBottom = session.querySelector('.widget-bottom[data-minimized="false"]');
            if (widgetBottom) return widgetBottom;
        }
        
        // Find by autoplay icon (language-independent)
        const autoplayButtons = Array.from(document.querySelectorAll('button.widget-top, button.widget-top-text'));
        for (const button of autoplayButtons) {
            const autoplayIcon = button.querySelector('img[alt="Autoplay"]');
            if (autoplayIcon) {
                const parent = button.parentElement;
                if (parent) {
                    const widgetBottom = parent.querySelector('.widget-bottom[data-minimized="false"]');
                    if (widgetBottom) return widgetBottom;
                }
            }
        }
        
        // Last resort: find any widget-bottom that has a loot section and is in a container with an autoplay icon
        const allWidgetBottoms = document.querySelectorAll('.widget-bottom[data-minimized="false"]');
        for (const wb of allWidgetBottoms) {
            const hasLoot = wb.querySelector('.widget-top img[alt="loot"]');
            if (hasLoot) {
                let parent = wb.parentElement;
                let foundAutoplay = false;
                while (parent && parent !== document.body) {
                    const buttons = parent.querySelectorAll('button');
                    for (const btn of buttons) {
                        const autoplayIcon = btn.querySelector('img[alt="Autoplay"]');
                        if (autoplayIcon) {
                            foundAutoplay = true;
                            break;
                        }
                    }
                    if (foundAutoplay) return wb;
                    parent = parent.parentElement;
                }
            }
        }
        
        return null;
    }
    
    function applyLocalStorageToGameCheckbox() {
        const settings = getSettings();
        const savedState = settings.autoMode === 'autoplant';
        
        const widgetBottom = findAutoplayContainer();
        if (widgetBottom) {
            const gameCheckbox = widgetBottom.querySelector('button[role="checkbox"]');
            if (gameCheckbox) {
                const isCurrentlyChecked = gameCheckbox.getAttribute('aria-checked') === 'true';
                if (savedState !== isCurrentlyChecked) {
                    console.log(`[${modName}] Applying localStorage (${savedState}) to game checkbox`);
                    // Temporarily disable the click handler to prevent it from overriding our mode change
                    window.__autosellerUpdatingCheckbox = true;
                    gameCheckbox.click();
                    setTimeout(() => {
                        window.__autosellerUpdatingCheckbox = false;
                    }, 100);
                }
            }
        }
    }
    
    // Apply localStorage state to mod slider
    function applyLocalStorageToModCheckbox() {
        // The slider position is updated automatically via updateSliderPosition()
        // which reads from settings. We just need to trigger it if the slider exists.
        const sliderTrack = document.querySelector('#autoseller-slider-track');
        if (sliderTrack && typeof window.updateAutoplantStatus === 'function') {
            // Trigger update by calling updateAutoplantStatus which will refresh the slider
            window.updateAutoplantStatus();
        }
    }
    
    function setupDragonPlantObserver() {
        if (dragonPlantObserver || dragonPlantObserverAttempts >= MAX_OBSERVER_ATTEMPTS) return;
        
        dragonPlantObserverAttempts++;
        
        if (typeof MutationObserver !== 'undefined') {
            // Use global debounceTimer instead of local to allow cleanup
            dragonPlantObserver = new MutationObserver((mutations) => {
                const hasRelevantMutations = mutations.some(mutation => {
                    return mutation.type === 'childList' || 
                           (mutation.type === 'attributes' && 
                            (mutation.attributeName === 'data-state' || 
                             mutation.attributeName === 'aria-checked'));
                });
                
                if (!hasRelevantMutations) return;
                
                if (dragonPlantDebounceTimer) {
                    clearTimeout(dragonPlantDebounceTimer);
                }
                
                dragonPlantDebounceTimer = setTimeout(() => {
                    // When autoplay session appears/changes, apply localStorage to it
                    applyLocalStorageToGameCheckbox();
                }, OBSERVER_DEBOUNCE_MS);
            });
            
            dragonPlantObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['data-state', 'aria-checked']
            });
            
            // Add click event listener for immediate response to user clicks
            document.addEventListener('click', handleDragonPlantClick);
            
        } else {
            console.warn(`[${modName}][WARN][setupDragonPlantObserver] MutationObserver not available`);
        }
    }
    
    function handleDragonPlantClick(event) {
        // Ignore if we're programmatically updating the checkbox
        if (window.__autosellerUpdatingCheckbox) {
            return;
        }
        
        // Check if the clicked element is a Dragon Plant checkbox in autoplay session
        const target = event.target.closest('button[role="checkbox"]');
        if (!target) return;
        
        // Find the autoplay container
        const widgetBottom = findAutoplayContainer();
        if (!widgetBottom || !widgetBottom.contains(target)) return;
        
        // Verify this is the Dragon Plant checkbox by checking if it's in the widget bottom
        // and has a label (Dragon Plant checkbox is the only checkbox in autoplay container)
        const label = widgetBottom.querySelector('label');
        if (!label) return;
        
        console.log(`[${modName}] User clicked Dragon Plant checkbox in autoplay session`);
        
        // Use a small delay to let the game update the checkbox state first
        const timeoutId = setTimeout(() => {
            if (isCleaningUp) return;
            const gameCheckbox = widgetBottom.querySelector('button[role="checkbox"]');
            if (gameCheckbox) {
                const newState = gameCheckbox.getAttribute('aria-checked') === 'true';
                console.log(`[${modName}] Game checkbox clicked, saving to localStorage: ${newState}`);
                
                // Save to localStorage - set autoMode to 'autoplant' if enabled, null if disabled
                if (newState) {
                    setSettings({ autoMode: 'autoplant' });
                } else {
                    setSettings({ autoMode: null });
                }
                
                // Apply to mod radio buttons (if settings modal is open)
                applyLocalStorageToModCheckbox();
                
                // Update filter and widget
                const currentSettings = getSettings();
                if (newState) {
                    updatePlantMonsterFilter(currentSettings.autoplantIgnoreList || []);
                } else {
                    removePlantMonsterFilter();
                }
                // Don't reset stats when enabling/disabling autoplant - preserve session stats
                manageAutosellerWidget();
                updateAutosellerSessionWidget();
            }
        }, 50);
        timeoutIds.push(timeoutId);
    }
    
    function stopDragonPlantObserver() {
        if (dragonPlantObserver) {
            dragonPlantObserver.disconnect();
            dragonPlantObserver = null;
            console.log(`[${modName}] Dragon Plant observer stopped`);
        }
        
        // Clear debounce timer
        if (dragonPlantDebounceTimer) {
            clearTimeout(dragonPlantDebounceTimer);
            dragonPlantDebounceTimer = null;
        }
        
        // Remove click event listener
        document.removeEventListener('click', handleDragonPlantClick);
    }
    
    // =======================
    // 13. Game End Listener for Dragon Plant
    // =======================
    
    // Helper function to get creature name from monster data
    function getCreatureNameFromMonster(invMonster) {
        if (!invMonster?.gameId || !globalThis.state?.utils?.getMonster) {
            return null;
        }
        try {
            const monsterData = globalThis.state.utils.getMonster(invMonster.gameId);
            return monsterData?.metadata?.name || null;
        } catch (e) {
            return null;
        }
    }
    
    // Helper function to calculate total genes from monster stats
    function calculateTotalGenes(invMonster) {
        const hp = invMonster.hp || 0;
        const ad = invMonster.ad || 0;
        const ap = invMonster.ap || 0;
        const armor = invMonster.armor || 0;
        const magicResist = invMonster.magicResist || 0;
        return hp + ad + ap + armor + magicResist;
    }
    
    // Helper function to filter monsters for autosell
    function filterMonstersForAutosell(matchedMonsters, settings) {
        if (settings.autoMode !== 'autosell' || matchedMonsters.length === 0) {
            return [];
        }
        
        const minGenes = settings.autoplantGenesMin ?? 80;
        const keepGenesEnabled = true;
        const alwaysDevourBelow = settings.autoplantAlwaysDevourBelow ?? 49;
        const alwaysDevourEnabled = settings.autoplantAlwaysDevourEnabled !== undefined ? settings.autoplantAlwaysDevourEnabled : false;
        const ignoreList = settings.autoplantIgnoreList || [];
        
        const filteredMonsters = matchedMonsters.filter(invMonster => {
            if (isShinyCreature(invMonster)) return false;
            
            const totalGenes = calculateTotalGenes(invMonster);
            
            // Always sell creatures below absolute threshold (OVERRIDES keep range and ignore list) - only if enabled
            if (alwaysDevourEnabled && totalGenes <= alwaysDevourBelow) {
                return true;
            }
            
            // Keep creatures with minGenes or higher (if enabled) - OVERRIDES ignore list
            if (keepGenesEnabled && totalGenes >= minGenes) {
                return false;
            }
            
            // Get creature name for keep range and ignore list check
            const creatureName = getCreatureNameFromMonster(invMonster);
            
            if (creatureName && ignoreList.includes(creatureName)) {
                // Check per-creature keep range ONLY if creature is in ignore list (keep range is only active in ignore list)
                const keepRange = getCreatureKeepRange(creatureName);
                if (keepRange) {
                    // If creature has a keep range, only keep if within range, otherwise sell
                    return !shouldKeepCreatureByRange(creatureName, totalGenes);
                }
                // No keep range set - normal ignore list behavior (keep it)
                return false;
            }
            
            return true;
        });
        
        return filteredMonsters.slice(0, 1);
    }
    
    // Helper function to filter monsters for autosqueeze
    async function filterMonstersForAutosqueeze(matchedMonsters, settings) {
        if (!settings.autosqueezeChecked || matchedMonsters.length === 0) {
            return [];
        }
        
        const squeezeMinGenes = settings.autosqueezeGenesMin ?? 80;
        const squeezeMaxGenes = settings.autosqueezeGenesMax ?? 100;
        const ignoreList = settings.autosqueezeIgnoreList || [];
        const hasDaycare = hasDaycareIconInInventory();
        let daycareMonsterIds = [];
        
        if (hasDaycare) {
            daycareMonsterIds = await fetchDaycareData();
        }
        
        const filterStats = {
            total: matchedMonsters.length,
            locked: 0,
            shiny: 0,
            inDaycare: 0,
            inIgnoreList: 0,
            geneRange: 0,
            passed: 0
        };
        
        const filteredMonsters = matchedMonsters.filter(invMonster => {
            if (invMonster.locked) {
                filterStats.locked++;
                return false;
            }
            if (isShinyCreature(invMonster)) {
                filterStats.shiny++;
                return false;
            }
            if (hasDaycare && daycareMonsterIds.includes(invMonster.id)) {
                filterStats.inDaycare++;
                return false;
            }
            
            const creatureName = getCreatureNameFromMonster(invMonster);
            if (creatureName && ignoreList.includes(creatureName)) {
                filterStats.inIgnoreList++;
                return false;
            }
            
            const totalGenes = calculateTotalGenes(invMonster);
            if (totalGenes < squeezeMinGenes || totalGenes > squeezeMaxGenes) {
                filterStats.geneRange++;
                return false;
            }
            
            filterStats.passed++;
            return true;
        });
        
        // No verbose logging - only log when processing actually happens
        
        return filteredMonsters;
    }
    
    function setupGameEndListener() {
        if (globalThis.state?.board?.on) {
            // Listen for new game events to access the world object
            // Use separate handler to avoid overwriting emitNewGameHandler1 from setupAutosellerWidgetObserver
            emitNewGameHandler2 = (game) => {
                // Skip during Board Analyzer runs
                if (window.ModCoordination?.isModActive('Board Analyzer')) {
                    return;
                }
                
                // Don't clear latestServerResults here - the board subscription (setupAutosellerWidgetObserver)
                // will automatically update it with the new game's serverResults when available
                
                // Subscribe to world.onGameEnd which fires when battle animation completes
                // This is when inventory is actually updated with new creatures/equipment
                // Note: .once() may not return a cancellable subscription, but we track it for reference
                game.world.onGameEnd.once(async () => {
                    if (isCleaningUp) return;
                    const timeoutId = setTimeout(async () => {
                        if (isCleaningUp || !stateManager.canRun()) {
                            return;
                        }
                        
                        checkAndActivateDragonPlant();
                        
                        // Process creatures and equipment at game end when inventory is actually updated
                        const settings = getSettings();
                        
                        if (!settings.autoMode && !settings.autosqueezeChecked && !settings.autodusterChecked) {
                            return;
                        }
                        
                        // Try to get serverResults from stored value (from board subscription) or from snapshot
                        let serverResults = latestServerResults;
                        let serverResultsSource = 'latestServerResults';
                        if (!serverResults) {
                            const boardState = globalThis.state?.board?.getSnapshot?.();
                            serverResults = boardState?.context?.serverResults;
                            serverResultsSource = 'boardSnapshot';
                        }
                        
                        if (!serverResults) {
                            console.warn('[Autoseller] Game end: No serverResults found - cannot process items');
                            return;
                        }
                        
                        // Check if we've already processed this serverResults (using seed as unique identifier)
                        const currentSeed = serverResults.seed;
                        if (currentSeed === lastProcessedServerResultsSeed) {
                            return; // Already processed, skip silently
                        }
                        
                        // Extract creatures and equipment from serverResults
                        const { rewardMonsterIds } = extractMonstersFromServerResults(serverResults);
                        const { rewardEquipmentIds } = extractEquipmentFromServerResults(serverResults);
                        
                        // Fetch inventory at game end (when it's actually updated)
                        const inventorySnapshot = await fetchServerMonsters();
                        
                        // Process monsters (autosell/autosqueeze)
                        if (rewardMonsterIds.size > 0) {
                            // Match inventory monsters ONLY by exact server ID match (NOT gameId)
                            const matchedMonsters = filterMonstersByServerIds(inventorySnapshot, rewardMonsterIds);
                            
                            if (matchedMonsters.length > 0) {
                                // Process autosell
                                if (settings.autoMode === 'autosell') {
                                    const monstersToSell = filterMonstersForAutosell(matchedMonsters, settings);
                                    if (monstersToSell.length > 0) {
                                        console.log('[Autoseller] Processing autosell for', monstersToSell.length, 'monsters');
                                        await processEligibleMonsters(monstersToSell, 'sell');
                                    }
                                }
                                
                                // Process autosqueeze
                                if (settings.autosqueezeChecked) {
                                    const monstersToSqueeze = await filterMonstersForAutosqueeze(matchedMonsters, settings);
                                    if (monstersToSqueeze.length > 0) {
                                        console.log('[Autoseller] Processing autosqueeze for', monstersToSqueeze.length, 'monsters');
                                        await processEligibleMonsters(monstersToSqueeze, 'squeeze');
                                    }
                                }
                            }
                        }
                        
                        // Process equipment (autoduster)
                        if (settings.autodusterChecked && rewardEquipmentIds.size > 0) {
                            console.log('[Autoseller] Processing autoduster for', rewardEquipmentIds.size, 'equipment');
                            const inventoryEquipment = await fetchServerEquipment();
                            await processEligibleEquipment(rewardEquipmentIds, inventoryEquipment);
                        }
                        
                        // Mark this serverResults as processed (using seed as unique identifier)
                        // Don't clear latestServerResults - let the board subscription overwrite it naturally
                        // when the next game's serverResults arrives
                        lastProcessedServerResultsSeed = currentSeed;
                    }, OPERATION_DELAYS.AFTER_GAME_END_BEFORE_ACTIVATE_MS);
                    timeoutIds.push(timeoutId);
                });
                // Store reference (though .once() may not be cancellable)
                gameEndSubscription = game.world.onGameEnd;
            };
            globalThis.state.board.on('newGame', emitNewGameHandler2);
            
        } else {
            console.warn(`[${modName}] Board state not available for game end listener`);
        }
    }
    
    function clickDragonPlantButton() {
        // Find the autoplay container
        const widgetBottom = findAutoplayContainer();
        if (!widgetBottom) {
            console.log('[Autoseller] Autoplay container not found for dragon plant click');
            return false;
        }
        
        // Find the Dragon Plant button (try Dragon Plant first, then Baby Dragon Plant)
        let dragonPlantButton = null;
        const allButtons = widgetBottom.querySelectorAll('button');
        for (const button of allButtons) {
            const isNotCheckbox = button.getAttribute('role') !== 'checkbox';
            
            // First try Dragon Plant (ID 37022)
            let img = button.querySelector('img[alt="37022"]');
            if (img && isNotCheckbox) {
                dragonPlantButton = button;
                break;
            }
            
            // If Dragon Plant not found, try Baby Dragon Plant (ID 28689)
            if (!dragonPlantButton) {
                img = button.querySelector('img[alt="28689"]');
                if (img && isNotCheckbox) {
                    dragonPlantButton = button;
                    break;
                }
            }
        }
        
        if (!dragonPlantButton) {
            console.log('[Autoseller] Dragon Plant button not found');
            return false;
        }
        
        // Check if button is disabled before clicking
        const isDisabled = dragonPlantButton.hasAttribute('disabled') || dragonPlantButton.getAttribute('data-disabled') === 'true';
        
        if (isDisabled) {
            console.log('[Autoseller] Dragon Plant button is disabled, skipping click');
            return false;
        }
        
        // Click the dragon plant button (game will handle filtering)
        // Use a more reliable click method that simulates user interaction
        try {
            // Scroll button into view if needed
            dragonPlantButton.scrollIntoView({ behavior: 'auto', block: 'center' });
            
            // Dispatch mouse events in sequence to simulate a real click
            const events = ['mousedown', 'mouseup', 'click'];
            events.forEach(eventType => {
                const event = new MouseEvent(eventType, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    buttons: 1
                });
                dragonPlantButton.dispatchEvent(event);
            });
            
            // Also call the native click method as fallback
            dragonPlantButton.click();
            
            console.log(`[Autoseller] Clicked Dragon Plant button after battle`);
            
            return true;
        } catch (error) {
            console.error('[Autoseller] Error clicking Dragon Plant button:', error);
            return false;
        }
    }
    
    function checkAndActivateDragonPlant() {
        const settings = getSettings();
        
        // Only proceed if autoplant is enabled
        if (settings.autoMode !== 'autoplant') return;
        
        // Find the autoplay container
        const widgetBottom = findAutoplayContainer();
        if (!widgetBottom) return;
        
        // Find the Dragon Plant button (try Dragon Plant first, then Baby Dragon Plant)
        let dragonPlantButton = null;
        const allButtons = widgetBottom.querySelectorAll('button');
        for (const button of allButtons) {
            const isNotCheckbox = button.getAttribute('role') !== 'checkbox';
            
            // First try Dragon Plant (ID 37022)
            let img = button.querySelector('img[alt="37022"]');
            if (img && isNotCheckbox) {
                dragonPlantButton = button;
                break;
            }
            
            // If Dragon Plant not found, try Baby Dragon Plant (ID 28689)
            if (!dragonPlantButton) {
                img = button.querySelector('img[alt="28689"]');
                if (img && isNotCheckbox) {
                    dragonPlantButton = button;
                    break;
                }
            }
        }
        
        if (!dragonPlantButton) return;
        
        // Check if Dragon Plant is currently enabled
        const isCurrentlyEnabled = dragonPlantButton.getAttribute('data-state') === 'open' && 
                                 !dragonPlantButton.hasAttribute('disabled');
        
        // Only activate if not already enabled
        if (!isCurrentlyEnabled) {
            setTimeout(() => {
                dragonPlantButton.click();
            }, OPERATION_DELAYS.UI_SETTLE_MS);
        }
    }

    // Dragon Plant Autocollect State
    let lastAutocollectTime = 0;
    let isCollecting = false; // Flag to prevent concurrent collection
    
    function checkDragonPlantAutocollect() {
        const settings = getSettings();
        
        // Only proceed if autocollect is enabled
        if (!settings.autoplantAutocollectChecked) return;
        
        // Skip if already collecting
        if (isCollecting) {
            console.log('[Autoseller] Collection already in progress, skipping');
            return;
        }
        
        // Skip if Board Analyzer is running
        if (window.ModCoordination?.isModActive('Board Analyzer')) {
            console.log('[Autoseller] Board Analyzer is running, skipping autocollect');
            return;
        }
        
        // Check cooldown
        const now = Date.now();
        if (now - lastAutocollectTime < DRAGON_PLANT_CONFIG.COOLDOWN_MS) {
            console.log('[Autoseller] Autocollect on cooldown');
            return;
        }
        
    // Get current plant gold from game state
    const plantGold = getPlantGold();
    
    if (plantGold === undefined || plantGold === null) {
        console.log('[Autoseller] Could not get plant gold from game state');
        return;
    }
        
        // Check if gold is over threshold
        if (plantGold >= DRAGON_PLANT_CONFIG.GOLD_THRESHOLD) {
            console.log(`[Autoseller] Dragon Plant ready to collect: ${plantGold} gold (threshold: ${DRAGON_PLANT_CONFIG.GOLD_THRESHOLD})`);
            collectDragonPlant();
        }
    }
    
    // Helper: Open inventory via API or button click
    const openInventory = () => {
        // Check if inventory is already open
        try {
            const currentMode = globalThis.state?.menu?.getSnapshot?.()?.context?.mode;
            if (currentMode === 'inventory') {
                console.log('[Autoseller] Inventory already open');
                return true;
            }
        } catch (error) {
            // Continue to opening logic
        }
        
        try {
            if (globalThis.state?.menu?.send) {
                console.log('[Autoseller] Opening inventory via Game State API');
                globalThis.state.menu.send({
                    type: 'setState',
                    fn: (prev) => ({ ...prev, mode: 'inventory' })
                });
                return true;
            }
        } catch (error) {
            console.log('[Autoseller] API method failed, using fallback:', error);
        }
        
        // Fallback: Click inventory button
        const inventoryButton = document.querySelector('button[data-selected="false"] img[alt="Inventory"]');
        if (!inventoryButton) {
            console.log('[Autoseller] Inventory button not found');
            return false;
        }
        inventoryButton.closest('button').click();
        return true;
    };
    
    // Helper: Close dialogs with ESC keys
    const closeDialogs = (onComplete) => {
        sendEscKey();
        
        setTimeout(() => {
            sendEscKey();
            if (onComplete) {
                setTimeout(onComplete, DRAGON_PLANT_CONFIG.TIMINGS.VERIFY_SUCCESS);
            }
        }, DRAGON_PLANT_CONFIG.TIMINGS.ESC_BETWEEN);
    };
    
    function collectDragonPlant() {
        // Set collecting flag
        isCollecting = true;
        
        const initialGold = getPlantGold();
        console.log('[Autoseller] Collecting Dragon Plant...', initialGold, 'gold');
        
        // Step 1: Open inventory
        if (!openInventory()) {
            console.log('[Autoseller] Failed to open inventory');
            isCollecting = false; // Reset flag on error
            return;
        }
        
        // Step 2: Wait for inventory to open, then click Dragon Plant
        const timeoutId1 = setTimeout(() => {
            if (isCleaningUp) {
                isCollecting = false;
                return;
            }
            const dragonPlantItem = document.querySelector(`.sprite.item.id-${DRAGON_PLANT_CONFIG.ITEM_ID}`);
            if (!dragonPlantItem) {
                console.log('[Autoseller] Dragon Plant item not found in inventory');
                sendEscKey();
                isCollecting = false; // Reset flag on error
                return;
            }
            
            const itemButton = dragonPlantItem.closest('button');
            if (!itemButton) {
                console.log('[Autoseller] Dragon Plant item button not found');
                sendEscKey();
                isCollecting = false; // Reset flag on error
                return;
            }
            
            itemButton.click();
            
            // Step 3: Wait for item details, then start collect loop
            const timeoutId2 = setTimeout(() => {
                if (isCleaningUp) {
                    isCollecting = false;
                    return;
                }
                let collectCount = 0;
                let retryCount = 0;
                const MAX_RETRIES = 3;
                
                // Recursive function to collect multiple times
                const collectLoop = () => {
                    if (isCleaningUp) {
                        isCollecting = false;
                        return;
                    }
                    // Safety check: prevent infinite loops
                    if (collectCount >= DRAGON_PLANT_CONFIG.MAX_COLLECT_ITERATIONS) {
                        closeDialogs(() => verifyAndUpdateCooldown(initialGold, collectCount));
                        return;
                    }
                    
                    const collectButton = findDragonPlantCollectButton();
                    
                    if (!collectButton) {
                        if (retryCount < MAX_RETRIES) {
                            retryCount++;
                            const timeoutId = setTimeout(collectLoop, 200);
                            timeoutIds.push(timeoutId);
                            return;
                        }
                        closeDialogs(() => verifyAndUpdateCooldown(initialGold, collectCount));
                        return;
                    }
                    
                    // Reset retry count on successful button find
                    retryCount = 0;
                    
                    collectButton.click();
                    collectCount++;
                    
                    // Step 4: Wait then check if we should collect again
                    const timeoutId = setTimeout(() => {
                        if (isCleaningUp) {
                            isCollecting = false;
                            return;
                        }
                        const currentGold = getPlantGold();
                        
                        if (currentGold !== undefined && currentGold !== null && currentGold >= DRAGON_PLANT_CONFIG.GOLD_THRESHOLD) {
                            collectLoop(); // Collect again
                        } else {
                            closeDialogs(() => verifyAndUpdateCooldown(initialGold, collectCount));
                        }
                    }, DRAGON_PLANT_CONFIG.TIMINGS.AFTER_COLLECT);
                    timeoutIds.push(timeoutId);
                };
                
                // Start the collect loop
                collectLoop();
            }, DRAGON_PLANT_CONFIG.TIMINGS.ITEM_DETAILS_OPEN);
            timeoutIds.push(timeoutId2);
        }, DRAGON_PLANT_CONFIG.TIMINGS.INVENTORY_OPEN);
        timeoutIds.push(timeoutId1);
    }
    
    // Helper: Verify collection success and update cooldown
    const verifyAndUpdateCooldown = (initialGold, collectCount) => {
        const finalGold = getPlantGold();
        
        if (finalGold !== undefined && finalGold < initialGold) {
            console.log(`[Autoseller] Collection complete: ${initialGold} → ${finalGold} gold (${collectCount} collections)`);
            lastAutocollectTime = Date.now();
        } else {
            console.log('[Autoseller] Collection may have failed - gold did not decrease');
        }
        
        // Reset collecting flag
        isCollecting = false;
    };

    function setupDragonPlantAutocollect() {
        if (!globalThis.state || !globalThis.state.player || !globalThis.state.player.subscribe) {
            console.log('[Autoseller] Player state not available for autocollect setup');
            return;
        }
        
        // Subscribe to player state changes as a backup check (in case plant gold increases from other sources)
        playerSubscription = globalThis.state.player.subscribe(({ context }) => {
            const settings = getSettings();
            
            // Only proceed if autocollect is enabled
            if (!settings.autoplantAutocollectChecked) return;
            
            // Check if plant data exists
            if (!context.questLog || !context.questLog.plant) return;
            
            const plantGold = context.questLog.plant.gold;
            
            // Check if gold is over threshold
            if (plantGold >= DRAGON_PLANT_CONFIG.GOLD_THRESHOLD) {
                // Use the shared check function which has cooldown logic
                checkDragonPlantAutocollect();
            }
        });
        
    }

    // =======================
    // 14. Initialization & Event Handlers
    // =======================
    
    function initAutoseller() {
        // Defer cleanup until databases are available
        function cleanupIgnoreListsWhenReady() {
            // Check if databases are loaded
            const availableCreatures = window.creatureDatabase?.ALL_CREATURES;
            const availableEquipment = window.equipmentDatabase?.ALL_EQUIPMENT;

            if (!availableCreatures || !availableEquipment) {
                // Databases not ready yet, try again in 1 second
                setTimeout(cleanupIgnoreListsWhenReady, 1000);
                return;
            }

            // Databases are loaded, proceed with cleanup
            try {
                const settings = getSettings();
                let hasChanges = false;

                // Clean autoplant lists
                if (settings.autoplantIgnoreList && Array.isArray(settings.autoplantIgnoreList)) {
                    const originalCount = settings.autoplantIgnoreList.length;
                    settings.autoplantIgnoreList = settings.autoplantIgnoreList.filter(creature =>
                        availableCreatures.includes(creature)
                    );
                    if (settings.autoplantIgnoreList.length !== originalCount) {
                        hasChanges = true;
                        console.log(`[Autoseller] Cleaned autoplant ignore list: ${originalCount} → ${settings.autoplantIgnoreList.length} creatures`);
                    }
                }
                if (settings.autoplantSellList && Array.isArray(settings.autoplantSellList)) {
                    const originalCount = settings.autoplantSellList.length;
                    settings.autoplantSellList = settings.autoplantSellList.filter(creature =>
                        availableCreatures.includes(creature)
                    );
                    if (settings.autoplantSellList.length !== originalCount) {
                        hasChanges = true;
                        console.log(`[Autoseller] Cleaned autoplant sell list: ${originalCount} → ${settings.autoplantSellList.length} creatures`);
                    }
                }

                // Clean autosqueeze lists
                if (settings.autosqueezeIgnoreList && Array.isArray(settings.autosqueezeIgnoreList)) {
                    const originalCount = settings.autosqueezeIgnoreList.length;
                    settings.autosqueezeIgnoreList = settings.autosqueezeIgnoreList.filter(creature =>
                        availableCreatures.includes(creature)
                    );
                    if (settings.autosqueezeIgnoreList.length !== originalCount) {
                        hasChanges = true;
                        console.log(`[Autoseller] Cleaned autosqueeze ignore list: ${originalCount} → ${settings.autosqueezeIgnoreList.length} creatures`);
                    }
                }
                if (settings.autosqueezeSellList && Array.isArray(settings.autosqueezeSellList)) {
                    const originalCount = settings.autosqueezeSellList.length;
                    settings.autosqueezeSellList = settings.autosqueezeSellList.filter(creature =>
                        availableCreatures.includes(creature)
                    );
                    if (settings.autosqueezeSellList.length !== originalCount) {
                        hasChanges = true;
                        console.log(`[Autoseller] Cleaned autosqueeze sell list: ${originalCount} → ${settings.autosqueezeSellList.length} creatures`);
                    }
                }

                // Clean autoduster lists
                if (settings.autodusterIgnoreList && Array.isArray(settings.autodusterIgnoreList)) {
                    const originalCount = settings.autodusterIgnoreList.length;
                    settings.autodusterIgnoreList = settings.autodusterIgnoreList.filter(equipment =>
                        availableEquipment.includes(equipment)
                    );
                    if (settings.autodusterIgnoreList.length !== originalCount) {
                        hasChanges = true;
                        console.log(`[Autoseller] Cleaned autoduster ignore list: ${originalCount} → ${settings.autodusterIgnoreList.length} equipment`);
                    }
                }
                if (settings.autodusterSellList && Array.isArray(settings.autodusterSellList)) {
                    const originalCount = settings.autodusterSellList.length;
                    settings.autodusterSellList = settings.autodusterSellList.filter(equipment =>
                        availableEquipment.includes(equipment)
                    );
                    if (settings.autodusterSellList.length !== originalCount) {
                        hasChanges = true;
                        console.log(`[Autoseller] Cleaned autoduster sell list: ${originalCount} → ${settings.autodusterSellList.length} equipment`);
                    }
                }

                // Save cleaned settings if any changes were made
                if (hasChanges) {
                    const settingsUpdate = {};
                    if (settings.autoplantIgnoreList) settingsUpdate.autoplantIgnoreList = settings.autoplantIgnoreList;
                    if (settings.autoplantSellList) settingsUpdate.autoplantSellList = settings.autoplantSellList;
                    if (settings.autosqueezeIgnoreList) settingsUpdate.autosqueezeIgnoreList = settings.autosqueezeIgnoreList;
                    if (settings.autosqueezeSellList) settingsUpdate.autosqueezeSellList = settings.autosqueezeSellList;
                    if (settings.autodusterIgnoreList) settingsUpdate.autodusterIgnoreList = settings.autodusterIgnoreList;
                    if (settings.autodusterSellList) settingsUpdate.autodusterSellList = settings.autodusterSellList;
                    setSettings(settingsUpdate);
                    console.log('[Autoseller] Lists cleaned and saved');
                } else {
                    console.log('[Autoseller] Lists are already clean');
                }

            } catch (error) {
                console.warn('[Autoseller] Error during ignore list cleanup:', error);
            }
        }

        // Start cleanup process (will retry until databases are available)
        cleanupIgnoreListsWhenReady();

        // Register the mod with the coordination system
        if (window.ModCoordination) {
            window.ModCoordination.registerMod('Autoseller', { priority: 1 });
            window.ModCoordination.updateModState('Autoseller', { enabled: true });
        }
        
        addAutosellerNavButton();
        setupAutosellerWidgetObserver();
        setupDragonPlantObserver();
        setupGameEndListener();
        setupDragonPlantAPIMonitor();
        setupDragonPlantAutocollect();
        
        // Initialize plant monster filter with saved ignore list from localStorage
        // (ignore mod loader config, use localStorage as single source of truth)
        updatePlantMonsterFilter();
        
        const timeoutId = setTimeout(() => {
            if (isCleaningUp) return;
            updateAutosellerNavButtonColor();
        }, 1000);
        timeoutIds.push(timeoutId);
        
        // Removed boardSubscription2 - all processing now happens at game end when inventory is actually updated
        // (see setupGameEndListener for processing logic)
    }
    
    if (typeof window !== 'undefined' && window.registerMod) {
        window.registerMod({
            name: modName,
            description: modDescription,
            init: initAutoseller
        });
    } else {
        initAutoseller();
    }
    
    // Listen for mod disable events
    messageListener = (event) => {
        if (event.data && event.data.message && event.data.message.action === 'updateLocalModState') {
            const modName = event.data.message.name;
            const enabled = event.data.message.enabled;
            
            if (modName === 'Super Mods/Autoseller.js' && !enabled) {
                console.log('[Autoseller] Mod disabled, running cleanup...');
                if (typeof exports !== 'undefined' && exports.cleanup) {
                    exports.cleanup();
                }
            }
        }
    };
    window.addEventListener('message', messageListener);
    
    if (typeof exports !== 'undefined') {
        exports = {
            openSettings: openAutosellerModal,
            getErrorStats: () => stateManager.getErrorStats(),
            getSessionStats: () => stateManager.getSessionStats(),
            resetSession: () => stateManager.resetSession(),
            clearAllCaches: () => {
                serverMonsterCache.clear();
                daycareCache.clear();
                stateManager.clearProcessedIds();
            },
            enableDragonPlant: () => {
                const currentSettings = getSettings();
                
                // Check if already enabled - don't toggle it
                if (currentSettings.autoMode === 'autoplant') {
                    return true;
                }
                
                // Set to autoplant mode
                setSettings({ autoMode: 'autoplant' });
                
                // Apply to game checkbox if in autoplay
                applyLocalStorageToGameCheckbox();
                
                // Update plant monster filter
                updatePlantMonsterFilter(currentSettings.autoplantIgnoreList || []);
                
                return true;
            },
            disableDragonPlant: () => {
                console.log('[Autoseller] disableDragonPlant() called');
                const currentSettings = getSettings();
                
                // Check if already disabled - don't toggle it
                if (currentSettings.autoMode !== 'autoplant') {
                    console.log('[Autoseller] Dragon Plant already disabled, skipping');
                    return true;
                }
                
                console.log('[Autoseller] Disabling Dragon Plant');
                setSettings({ autoMode: null });
                
                // Apply to game checkbox if in autoplay
                applyLocalStorageToGameCheckbox();
                
                // Remove plant monster filter
                removePlantMonsterFilter();
                
                return true;
            },
            cleanup: function() {
                console.log('[Autoseller] Starting cleanup...');
                
                try {
                    // 1. Unsubscribe from board and player subscriptions
                    if (boardSubscription1) {
                        try {
                            boardSubscription1.unsubscribe();
                            boardSubscription1 = null;
                        } catch (error) {
                            console.warn('[Autoseller] Error unsubscribing board1:', error);
                        }
                    }
                    
                    // Removed boardSubscription2 cleanup - no longer used
                    
                    if (playerSubscription) {
                        try {
                            playerSubscription.unsubscribe();
                            playerSubscription = null;
                        } catch (error) {
                            console.warn('[Autoseller] Error unsubscribing player:', error);
                        }
                    }
                    
                    // 2. Set cleanup flag and clear all timers
                    isCleaningUp = true;
                    
                    if (debounceTimer) {
                        clearTimeout(debounceTimer);
                        debounceTimer = null;
                    }
                    
                    // Clear all tracked timeouts
                    timeoutIds.forEach(id => {
                        try {
                            clearTimeout(id);
                        } catch (error) {
                            console.warn('[Autoseller] Error clearing timeout:', error);
                        }
                    });
                    timeoutIds = [];
                    
                    // 3. Remove DOM elements
                    const widget = document.getElementById(UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET);
                    const navBtn = document.querySelector(`.${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_NAV_BTN}`);
                    const responsiveStyle = document.getElementById(UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_RESPONSIVE_STYLE);
                    const widgetStyle = document.getElementById('autoseller-widget-css');
                    
                    if (widget && widget.parentNode) widget.parentNode.removeChild(widget);
                    if (navBtn && navBtn.parentNode) navBtn.parentNode.removeChild(navBtn);
                    if (responsiveStyle && responsiveStyle.parentNode) responsiveStyle.parentNode.removeChild(responsiveStyle);
                    if (widgetStyle && widgetStyle.parentNode) widgetStyle.parentNode.removeChild(widgetStyle);
                    
                    // Close any open context menu
                    if (openContextMenu && openContextMenu.closeMenu) {
                        try {
                            openContextMenu.closeMenu();
                        } catch (error) {
                            console.warn('[Autoseller] Error closing context menu:', error);
                        }
                        openContextMenu = null;
                    }
                    
                    // 4. Stop observers
                    stopDragonPlantObserver();
                    
                    // 4.5. Clean up menu color observer
                    if (menuColorObserver) {
                        try {
                            menuColorObserver.disconnect();
                            menuColorObserver = null;
                        } catch (error) {
                            console.warn('[Autoseller] Error disconnecting menu color observer:', error);
                        }
                    }
                    
                    // 4.6. Clean up checkbox listeners
                    checkboxListeners.forEach(({ element, handler }) => {
                        try {
                            element.removeEventListener('change', handler);
                        } catch (error) {
                            console.warn('[Autoseller] Error removing checkbox listener:', error);
                        }
                    });
                    checkboxListeners = [];
                    
                    // 5. Remove game state event listeners and filters
                    if (globalThis.state?.board?.off) {
                        try {
                            if (emitNewGameHandler1) {
                                globalThis.state.board.off('newGame', emitNewGameHandler1);
                                emitNewGameHandler1 = null;
                            }
                            if (emitNewGameHandler2) {
                                globalThis.state.board.off('newGame', emitNewGameHandler2);
                                emitNewGameHandler2 = null;
                            }
                            if (emitEndGameHandler1) {
                                globalThis.state.board.off('emitEndGame', emitEndGameHandler1);
                                emitEndGameHandler1 = null;
                            }
                        } catch (error) {
                            console.warn('[Autoseller] Error removing game state event listeners:', error);
                        }
                    }
                    
                    // Remove plant monster filter
                    if (globalThis.state?.clientConfig?.trigger?.setState) {
                        try {
                            globalThis.state.clientConfig.trigger.setState({
                                fn: (prev) => ({ ...prev, plantMonsterFilter: undefined })
                            });
                        } catch (error) {
                            console.warn('[Autoseller] Error removing plant monster filter:', error);
                        }
                    }
                    
                    // 6. Clear caches and reset state
                    serverMonsterCache.clear();
                    daycareCache.clear();
                    stateManager.resetSession();
                    
                    // 7. Clear rate limiter state
                    apiRateLimiter.requestTimes = [];
                    
                    // 7.5. Reset autocollect cooldown and flags
                    lastAutocollectTime = 0;
                    isCollecting = false;
                    
                    // 8. Restore global state
                    if (originalFetch) {
                        window.fetch = originalFetch;
                        originalFetch = null;
                    }
                    if (messageListener) {
                        window.removeEventListener('message', messageListener);
                        messageListener = null;
                    }
                    delete window.autoplantCheckbox;
                    delete window.autosellCheckbox;
                    delete window.updateAutoplantStatus;
                    delete window.autoplantStatusSummary;
                    delete window.__autosellerLoaded;
                    
                    // 9. Unregister from mod coordination system
                    if (window.ModCoordination) {
                        try {
                            window.ModCoordination.cleanupMod('Autoseller');
                        } catch (error) {
                            console.warn('[Autoseller] Error unregistering from ModCoordination:', error);
                        }
                    }
                    
                    // 10. Reset cleanup flag
                    isCleaningUp = false;
                    
                    // 11. Verify cleanup was successful
                    const remainingReferences = [
                        boardSubscription1,
                        playerSubscription,
                        debounceTimer,
                        dragonPlantDebounceTimer,
                        dragonPlantObserver,
                        emitNewGameHandler1,
                        emitNewGameHandler2,
                        emitEndGameHandler1,
                        menuColorObserver,
                        gameEndSubscription
                    ].filter(Boolean);
                    
                    if (remainingReferences.length > 0) {
                        console.warn('[Autoseller] Some references were not properly cleaned up:', remainingReferences.length);
                    }
                    
                    console.log('[Autoseller] Cleanup completed');
                    
                } catch (error) {
                    console.error('[Autoseller] Error during cleanup:', error);
                }
            }
        };
        
        // Expose Autoseller API globally for other mods
        window.autoseller = exports;
    }

})();