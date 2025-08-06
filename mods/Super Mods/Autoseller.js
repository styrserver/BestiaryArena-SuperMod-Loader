// =======================
// 0. Version & Metadata
// =======================

(function() {
    if (window.__autosellerLoaded) return;
    window.__autosellerLoaded = true;

    // =======================
    // 1. Configuration & Constants
    // =======================
    /** @const {string} The name of this mod */
    const modName = "Autoseller";
    
    /** @const {string} Description of what this mod does */
    const modDescription = "Automatically sells selected items.";
    
    // =======================
    // 1.1. Constants
    // =======================
    const AUTOSELLER_MIN_DELAY_MS = 5000; // 5 seconds minimum between autoseller runs
    const BATCH_SIZE = 20; // Maximum monsters per API batch
    const BATCH_DELAY_MS = 10000; // 10 seconds delay between batches
    const MAX_OBSERVER_ATTEMPTS = 10; // Maximum attempts to setup widget observer
    const OBSERVER_DEBOUNCE_MS = 100; // Debounce time for mutation observer
    const SETTINGS_SAVE_DELAY_MS = 300; // Debounce time for settings save
    
    // Rate limiting constants for selling
    const SELL_RATE_LIMIT = {
        MAX_MONSTERS_PER_10S: 20, // Reduced from 30 to be more conservative
        DELAY_BETWEEN_SELLS_MS: 200, // Increased from 100ms to 200ms
        WINDOW_SIZE_MS: 10000,
        BATCH_SIZE: 5, // Process monsters in smaller batches for better responsiveness
        BATCH_DELAY_MS: 1000, // 1 second between batches
        // Additional rate limiting constants
        MAX_BACKOFF_TIME_MS: 30000, // Maximum backoff time for exponential backoff
        JITTER_MAX_MS: 1000, // Maximum jitter to add to wait times
        BASE_BACKOFF_MULTIPLIER: 2, // Base for exponential backoff calculation
        CONSECUTIVE_ERROR_RESET_THRESHOLD: 5 // Reset rate limiter after this many consecutive errors
    };
    
    // UI Constants
    const UI_CONSTANTS = {
        MODAL_WIDTH: 650,
        MODAL_HEIGHT: 440,
        MODAL_CONTENT_HEIGHT: 360,
        COLUMN_WIDTH: 240,
        COLUMN_MIN_WIDTH: 220,
        RESPONSIVE_BREAKPOINT: 600,
        INPUT_WIDTH: 48,
        INPUT_STEP: 1,
        MIN_COUNT_MIN: 1,
        MIN_COUNT_MAX: 20,
        GENE_MIN: 5,
        GENE_MAX: 100,
        SQUEEZE_GENE_MIN: 80,
        SQUEEZE_GENE_MAX: 100,
        SELL_GENE_MIN: 5,
        SELL_GENE_MAX: 79,
        MAX_EXP_DEFAULT: 52251,
        // Common styles
        COMMON_STYLES: {
            PIXEL_FONT: 'pixel-font-16',
            PRIMARY_COLOR: '#ffe066',
            SECONDARY_COLOR: '#cccccc',
            BACKGROUND_COLOR: '#232323',
            BORDER_RADIUS: '3px',
            INPUT_BORDER: '1px solid #ffe066'
        },
        // CSS Classes and Selectors
        CSS_CLASSES: {
            AUTOSELLER_NAV_BTN: 'autoseller-nav-btn',
            AUTOSELLER_WIDGET: 'autoseller-session-widget',
            AUTOSELLER_RESPONSIVE_STYLE: 'autoseller-responsive-style',
            WIDGET_TOP: 'widget-top',
            WIDGET_BOTTOM: 'widget-bottom',
            PIXEL_FONT_16: 'pixel-font-16',
            SEPARATOR: 'separator',
            STAT_ROW: 'stat-row',
            STAT_LABEL: 'stat-label',
            STAT_VALUE: 'stat-value',
            STAT_ICON: 'stat-icon',
            MINIMIZE_BTN: 'minimize-btn'
        },
        // DOM Selectors
        SELECTORS: {
            NAV_SHRINK: 'nav.shrink-0',
            NAV_UL: 'ul.flex.items-center',
            AUTOPLAY_CONTAINER: '.widget-bottom[data-minimized="false"]',
            AUTOPLAY_SESSION: 'div[data-autosetup] .widget-bottom[data-minimized="false"]',
            CREATURE_SLOTS: '[data-blip]',
            DAYCARE_ICON: 'img[alt="daycare"][src="/assets/icons/atdaycare.png"]',
            CREATURE_IMG: 'img[alt="creature"]',
            DIALOG_OPEN: 'div[role="dialog"][data-state="open"]'
        }
    };
    
    // API Constants
    const API_CONSTANTS = {
        RETRY_ATTEMPTS: 2,
        RETRY_DELAY_BASE: 1000,
        GAME_VERSION: '1',
        DUST_PER_CREATURE: 10
    };
    
    // Default Settings
    const DEFAULT_SETTINGS = {
        autosellChecked: false,
        autosqueezeChecked: false,
        autosellGenesMin: UI_CONSTANTS.SELL_GENE_MIN,
        autosellGenesMax: UI_CONSTANTS.SELL_GENE_MAX,
        autosqueezeGenesMin: UI_CONSTANTS.SQUEEZE_GENE_MIN,
        autosqueezeGenesMax: UI_CONSTANTS.SQUEEZE_GENE_MAX,
        autosellMinCount: 1,
        autosqueezeMinCount: 1,
        autosellMaxExp: UI_CONSTANTS.MAX_EXP_DEFAULT
    };
    
    // =======================
    // 1.2. Logging & Debugging
    // =======================
    
    const logger = {
        init: (message) => console.log(`[${modName}] ${message}`),
        error: (functionName, message, error = null) => {
            if (error) {
                console.error(`[${modName}][ERROR][${functionName}] ${message}`, error);
            } else {
                console.error(`[${modName}][ERROR][${functionName}] ${message}`);
            }
        },
        warn: (functionName, message, error = null) => {
            if (error) {
                console.warn(`[${modName}][WARN][${functionName}] ${message}`, error);
            } else {
                console.warn(`[${modName}][WARN][${functionName}] ${message}`);
            }
        },
        info: (functionName, message) => console.info(`[${modName}][INFO][${functionName}] ${message}`)
    };
    
    const errorHandler = {
        warn: (functionName, message, error = null) => logger.warn(functionName, message, error),
        error: (functionName, message, error = null) => logger.error(functionName, message, error),
        info: (functionName, message) => logger.info(functionName, message)
    };

    // =======================
    // 1.3. DOM Cache System
    // =======================
    
    const domCache = {
        elements: new Map(),
        lastCleanup: 0,
        cleanupInterval: 30000,
        
        get(selector, context = document) {
            const key = `${selector}:${context === document ? 'doc' : context.id || 'ctx'}`;
            
            const now = Date.now();
            if (now - this.lastCleanup > this.cleanupInterval) {
                this.cleanup();
                this.lastCleanup = now;
            }
            
            if (this.elements.has(key)) {
                const element = this.elements.get(key);
                if (element && document.contains(element)) {
                    return element;
                }
                this.elements.delete(key);
            }
            
            const element = context.querySelector(selector);
            if (element) {
                this.elements.set(key, element);
            }
            
            return element;
        },
        
        getAll(selector, context = document) {
            const now = Date.now();
            if (now - this.lastCleanup > this.cleanupInterval) {
                this.cleanup();
                this.lastCleanup = now;
            }
            
            return context.querySelectorAll(selector);
        },
        
        invalidate(selector) {
            const keysToDelete = [];
            this.elements.forEach((element, key) => {
                if (key.includes(selector)) {
                    keysToDelete.push(key);
                }
            });
            keysToDelete.forEach(key => this.elements.delete(key));
        },
        
        clear() {
            this.elements.clear();
        },
        
        cleanup() {
            const keysToDelete = [];
            this.elements.forEach((element, key) => {
                if (!element || !document.contains(element)) {
                    keysToDelete.push(key);
                }
            });
            keysToDelete.forEach(key => this.elements.delete(key));
        }
    };
    
    let autosellerSettingsCache = null;
    let settingsCacheTimestamp = 0;
    const SETTINGS_CACHE_TTL = 30000; // 30 seconds cache TTL
    let settingsVersion = 0; // Version counter for cache invalidation
    
    function getCachedSettings() {
        const now = Date.now();
        
        // Return cached settings if still valid and version matches
        if (autosellerSettingsCache && 
            (now - settingsCacheTimestamp) < SETTINGS_CACHE_TTL &&
            autosellerSettingsCache._version === settingsVersion) {
            return autosellerSettingsCache;
        }
        
        // Try to get settings from mod loader context first
        if (typeof context !== 'undefined' && context.config && Object.keys(context.config).length > 0) {
            autosellerSettingsCache = { 
                ...DEFAULT_SETTINGS, 
                ...context.config,
                _version: settingsVersion,
                _timestamp: now
            };
            settingsCacheTimestamp = now;
            return autosellerSettingsCache;
        }
        
        // Fallback to localStorage
        try {
            const stored = JSON.parse(localStorage.getItem('autoseller-settings') || '{}');
            autosellerSettingsCache = { 
                ...DEFAULT_SETTINGS, 
                ...stored,
                _version: settingsVersion,
                _timestamp: now
            };
            settingsCacheTimestamp = now;
        } catch (e) { 
            logger.warn('getCachedSettings', 'Failed to parse settings from localStorage', e);
            errorStats.localStorageErrors++;
            autosellerSettingsCache = { 
                ...DEFAULT_SETTINGS,
                _version: settingsVersion,
                _timestamp: now
            }; 
            settingsCacheTimestamp = now;
        }
        
        return autosellerSettingsCache;
    }
    
    function clearSettingsCache() {
        autosellerSettingsCache = null;
        settingsVersion++; // Increment version to force cache refresh
    }
    
    function setCachedSettings(newSettings) {
        // Increment version to invalidate cache
        settingsVersion++;
        
        // Get fresh settings and merge with new ones
        const currentSettings = getCachedSettings();
        autosellerSettingsCache = { 
            ...currentSettings, 
            ...newSettings,
            _version: settingsVersion,
            _timestamp: Date.now()
        };
        
        // Save to localStorage for backward compatibility
        debouncedSaveSettings();
        
        // Update mod loader context if available
        if (typeof api !== 'undefined' && api.service && typeof context !== 'undefined' && context.hash) {
            api.service.updateScriptConfig(context.hash, autosellerSettingsCache);
        }
        
        // Update navigation button color when settings change
        updateAutosellerNavButtonColor();
    }
    function debounce(fn, delay) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }
    const debouncedSaveSettings = debounce(() => {
        try {
            localStorage.setItem('autoseller-settings', JSON.stringify(autosellerSettingsCache));
        } catch (e) {
            logger.warn('debouncedSaveSettings', 'Failed to save settings to localStorage', e);
            errorStats.localStorageErrors++;
        }
    }, SETTINGS_SAVE_DELAY_MS);
    if (!localStorage.getItem('autoseller-settings') && !(typeof context !== 'undefined' && context.config && Object.keys(context.config).length > 0)) {
        autosellerSettingsCache = { ...DEFAULT_SETTINGS };
        localStorage.setItem('autoseller-settings', JSON.stringify(autosellerSettingsCache));
    } else {
        getCachedSettings();
    }

    // =======================
    // 2. Utility Functions
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
        ttl: 30000, // 30 seconds cache TTL
        
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
    
    /**
     * Fetch daycare data from the server
     * @returns {Promise<Array>} Array of monster IDs in daycare
     */
    async function fetchDaycareData() {
        // Return cached data if still valid
        if (daycareCache.isValid()) {
            return daycareCache.data;
        }
        
        // Acquire mutex to prevent concurrent API calls
        await apiMutex.acquire('daycare');
        
        try {
                    const myName = globalThis.state?.player?.getSnapshot?.()?.context?.name;
        if (!myName) {
            logger.warn('fetchDaycareData', 'Could not determine player name.');
            return daycareCache.data || []; // Return cached data if available
        }
            
            const url = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=${encodeURIComponent(JSON.stringify({"0":{json:myName}}))}`;
            const result = await apiRequest(url);
            
            if (!result.success) {
                stateManager.updateErrorStats('fetchErrors');
                logger.warn('fetchDaycareData', 'API request failed, using cached data');
                // Return cached data if available, even if stale, to avoid delays
                return daycareCache.data || [];
            }
            
            // Extract daycare data from the response
            const profileData = result.data?.[0]?.result?.data?.json;
            const daycareSlots = profileData?.daycareSlots || [];
            
            // Extract monster IDs from occupied daycare slots
            const daycareMonsterIds = [];
            daycareSlots.forEach(slot => {
                if (slot.monsterId) {
                    daycareMonsterIds.push(slot.monsterId);
                }
            });
            
            // Cache the successful result
            daycareCache.set(daycareMonsterIds);
            
            return daycareMonsterIds;
        } finally {
            // Always release the mutex
            apiMutex.release('daycare');
        }
    }
    
    /**
     * Check if daycare icon exists in the inventory (DOM only check)
     * @returns {boolean} Whether any daycare icon is found in the inventory
     */
    function hasDaycareIconInInventory() {
        try {
            // Use DOM cache for better performance
            const creatureSlots = domCache.getAll(UI_CONSTANTS.SELECTORS.CREATURE_SLOTS);
            
            for (const slot of creatureSlots) {
                const daycareIcon = slot.querySelector(UI_CONSTANTS.SELECTORS.DAYCARE_ICON);
                if (daycareIcon) {
                    return true;
                }
            }
            
            return false;
        } catch (e) {
            logger.warn('hasDaycareIconInInventory', 'Error checking for daycare icon in DOM', e);
            return false;
        }
    }
    
    /**
     * Check if a creature is in the daycare by checking DOM first, then API
     * @param {string} monsterId - The monster ID to check
     * @returns {Promise<boolean>} Whether the creature is in the daycare
     */
    async function isCreatureInDaycare(monsterId) {
        try {
            // Step 1: Check if the daycare icon exists in the inventory through the DOM
            const creatureSlots = domCache.getAll(UI_CONSTANTS.SELECTORS.CREATURE_SLOTS);
            let foundDaycareIcon = false;
            let foundMonsterInDaycare = false;
            
            for (const slot of creatureSlots) {
                // Check if this slot contains the daycare icon
                const daycareIcon = slot.querySelector(UI_CONSTANTS.SELECTORS.DAYCARE_ICON);
                if (daycareIcon) {
                    foundDaycareIcon = true;
                    
                    // Step 2: If icon exists, check if this slot contains our monster
                    const creatureImg = slot.querySelector(UI_CONSTANTS.SELECTORS.CREATURE_IMG);
                    if (creatureImg) {
                        // Try to extract monster ID from the image src
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
            
            // Step 3: If we found daycare icon but not our specific monster, check API
            if (foundDaycareIcon && !foundMonsterInDaycare) {
                const daycareMonsterIds = await fetchDaycareData();
                const isInDaycare = daycareMonsterIds.includes(monsterId);
                return isInDaycare;
            }
            
            return false;
        } catch (e) {
            logger.warn('isCreatureInDaycare', `Error checking daycare status for monster ${monsterId}`, e);
            return false; // Default to false to avoid blocking sales
        }
    }
    
    // Rate limiter for selling monsters
    const sellRateLimiter = {
        requestTimes: [],
        consecutive429Errors: 0,
        last429Time: 0,
        
        /**
         * Check if we can make a sell request
         * @returns {boolean} Whether a request can be made
         */
        canMakeRequest() {
            const now = Date.now();
            // Remove requests older than 10 seconds
            this.requestTimes = this.requestTimes.filter(time => now - time < SELL_RATE_LIMIT.WINDOW_SIZE_MS);
            
            // If we've had recent 429 errors, be more conservative
            if (this.consecutive429Errors > 0 && now - this.last429Time < 30000) { // 30 seconds
                return this.requestTimes.length < Math.max(5, SELL_RATE_LIMIT.MAX_MONSTERS_PER_10S - this.consecutive429Errors * 5);
            }
            
            return this.requestTimes.length < SELL_RATE_LIMIT.MAX_MONSTERS_PER_10S;
        },
        
        /**
         * Record a sell request
         */
        recordRequest() {
            this.requestTimes.push(Date.now());
        },
        
        /**
         * Record a 429 error and adjust rate limiting
         */
        record429Error() {
            this.consecutive429Errors++;
            this.last429Time = Date.now();
        },
        
        /**
         * Record a successful request (reset 429 counter)
         */
        recordSuccess() {
            if (this.consecutive429Errors > 0) {
                this.consecutive429Errors = Math.max(0, this.consecutive429Errors - 1);
            }
        },
        
        /**
         * Wait for the next available slot
         * @returns {Promise} Promise that resolves when a slot is available
         */
        async waitForSlot() {
            while (!this.canMakeRequest()) {
                // Calculate base wait time
                let waitTime = SELL_RATE_LIMIT.WINDOW_SIZE_MS - (Date.now() - Math.min(...this.requestTimes)) + 100;
                
                // Apply exponential backoff for 429 errors
                if (this.consecutive429Errors > 0) {
                    const backoffTime = Math.min(
                        SELL_RATE_LIMIT.MAX_BACKOFF_TIME_MS, 
                        SELL_RATE_LIMIT.BATCH_DELAY_MS * Math.pow(SELL_RATE_LIMIT.BASE_BACKOFF_MULTIPLIER, this.consecutive429Errors - 1)
                    );
                    waitTime = Math.max(waitTime, backoffTime);
                }
                
                // Add jitter to prevent thundering herd
                const jitter = Math.random() * SELL_RATE_LIMIT.JITTER_MAX_MS;
                waitTime += jitter;
                
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    };
    
    function getGenes(m) {
        return (m.hp || 0) + (m.ad || 0) + (m.ap || 0) + (m.armor || 0) + (m.magicResist || 0);
    }
    
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
    
    async function getEligibleMonsters(settings, monsters) {
        if (!Array.isArray(monsters) || monsters.length === 0) {
            return { toSqueeze: [], toSell: [] };
        }
        
        const sellEnabled = settings['autosellChecked'];
        const squeezeEnabled = settings['autosqueezeChecked'];
        
        if (!sellEnabled && !squeezeEnabled) {
            return { toSqueeze: [], toSell: [] };
        }
        
        const sellMinGenes = settings['autosellGenesMin'] ?? 5;
        const sellMaxGenes = settings['autosellGenesMax'] ?? 79;
        const squeezeMinGenes = settings['autosqueezeGenesMin'] ?? 80;
        const squeezeMaxGenes = settings['autosqueezeGenesMax'] ?? 100;
        const sellMinCount = settings['autosellMinCount'] ?? 1;
        const squeezeMinCount = settings['autosqueezeMinCount'] ?? 1;
        const maxExpThreshold = settings['autosellMaxExp'] ?? 52251;
        
        const toSqueeze = [];
        const toSell = [];
        
        const monsterCount = monsters.length;
        
        const hasDaycare = hasDaycareIconInInventory();
        let daycareMonsterIds = [];
        
        if (hasDaycare && sellEnabled) {
            daycareMonsterIds = await fetchDaycareData();
        }
        
        for (let i = 0; i < monsterCount; i++) {
            const monster = monsters[i];
            
            if (monster.locked) continue;
            
            const hp = monster.hp || 0;
            const ad = monster.ad || 0;
            const ap = monster.ap || 0;
            const armor = monster.armor || 0;
            const magicResist = monster.magicResist || 0;
            const genes = hp + ad + ap + armor + magicResist;
            
            if (squeezeEnabled && genes >= squeezeMinGenes && genes <= squeezeMaxGenes) {
                toSqueeze.push(monster);
            }
            else if (sellEnabled && genes >= sellMinGenes && genes <= sellMaxGenes) {
                const exp = monster.exp || 0;
                if (exp < maxExpThreshold) {
                    if (hasDaycare && daycareMonsterIds.includes(monster.id)) {
                        // Skip daycare creatures
                    } else {
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
    // 3. API Utilities
    // =======================
    async function apiRequest(url, options = {}, retries = API_CONSTANTS.RETRY_ATTEMPTS) {
        const { method = 'GET', body, headers = {} } = options;
        
        const baseHeaders = {
            'content-type': 'application/json',
            'X-Game-Version': API_CONSTANTS.GAME_VERSION
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
                
                let data = null;
                try {
                    data = await resp.json();
                } catch (parseError) {
                    if (attempt === retries) {
                        errorHandler.error('apiRequest', 'Failed to parse response as JSON', parseError);
                        return { success: false, error: parseError, data: null };
                    }
                    errorHandler.warn('apiRequest', `Attempt ${attempt + 1} failed to parse response, retrying...`, parseError);
                    await new Promise(resolve => setTimeout(resolve, API_CONSTANTS.RETRY_DELAY_BASE * (attempt + 1)));
                    continue;
                }
                
                if (!resp.ok) {
                    const errorMsg = `API request failed: HTTP ${resp.status}`;
                    
                    if (resp.status >= 500 && attempt < retries) {
                        errorHandler.warn('apiRequest', `${errorMsg}, attempt ${attempt + 1} failed, retrying...`);
                        await new Promise(resolve => setTimeout(resolve, API_CONSTANTS.RETRY_DELAY_BASE * (attempt + 1)));
                        continue;
                    }
                    
                    if (resp.status === 404 && data && Array.isArray(data) && data[0]?.result?.data?.json) {
                        return { success: true, status: resp.status, data };
                    }
                    
                    if (resp.status === 404) {
                        errorHandler.info('apiRequest', `API request returned 404 (expected for already processed items)`);
                    } else {
                        errorHandler.error('apiRequest', errorMsg);
                    }
                    return { success: false, status: resp.status, data };
                }
                
                return { success: true, status: resp.status, data };
                
            } catch (e) {
                if (attempt === retries) {
                    errorHandler.error('apiRequest', 'Final attempt failed', e);
                    return { success: false, error: e, data: null };
                }
                errorHandler.warn('apiRequest', `Attempt ${attempt + 1} failed, retrying...`, e);
                await new Promise(resolve => setTimeout(resolve, API_CONSTANTS.RETRY_DELAY_BASE * (attempt + 1)));
            }
        }
    }
    
    // =======================
    // 4. Inventory Management
    // =======================
    
    // Cache for server monsters to reduce API calls
    const serverMonsterCache = {
        data: null,
        timestamp: 0,
        ttl: 5000, // 5 seconds cache TTL (reduced for more frequent updates)
        
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
    
        async function fetchServerMonsters() {
        // Return cached data if still valid
        if (serverMonsterCache.isValid()) {
            return serverMonsterCache.data;
        }
        
        // Acquire mutex to prevent concurrent API calls
        await apiMutex.acquire('monsters');
        
        try {
            const myName = globalThis.state?.player?.getSnapshot?.()?.context?.name;
            if (!myName) {
                logger.warn('fetchServerMonsters', 'Could not determine player name.');
                return serverMonsterCache.data || []; // Return cached data if available
            }
            
            const url = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=${encodeURIComponent(JSON.stringify({"0":{json:myName}}))}`;
            const result = await apiRequest(url);
            
            if (!result.success) {
                stateManager.updateErrorStats('fetchErrors');
                logger.warn('fetchServerMonsters', 'API request failed, using cached data');
                // Return cached data if available, even if stale, to avoid delays
                return serverMonsterCache.data || [];
            }
            
            const monsters = result.data?.[0]?.result?.data?.json?.monsters || [];
            
            // Cache the successful result
            serverMonsterCache.set(monsters);
            
            return monsters;
        } finally {
            // Always release the mutex
            apiMutex.release('monsters');
        }
    }
    window.fetchServerMonsters = fetchServerMonsters;
    function removeMonstersFromLocalInventory(idsToRemove) {
        try {
            // Validate input
            if (!Array.isArray(idsToRemove) || idsToRemove.length === 0) {
                logger.warn('removeMonstersFromLocalInventory', 'Invalid or empty IDs array provided');
                return;
            }
            
            // Check if global state exists
            if (!globalThis.state) {
                logger.warn('removeMonstersFromLocalInventory', 'Global state not available');
                return;
            }
            
            const player = globalThis.state.player;
            if (!player) {
                logger.warn('removeMonstersFromLocalInventory', 'Player state not available');
                return;
            }
            
            // Check if player has send method
            if (typeof player.send !== 'function') {
                logger.warn('removeMonstersFromLocalInventory', 'Player send method not available');
                return;
            }
            
            // Validate that monsters array exists in current state
            const currentState = player.getSnapshot?.();
            if (!currentState?.context?.monsters) {
                logger.warn('removeMonstersFromLocalInventory', 'Monsters array not available in current state');
                return;
            }
            
            player.send({
                type: "setState",
                fn: (prev) => {
                    // Additional safety check for prev state
                    if (!prev || !Array.isArray(prev.monsters)) {
                        logger.warn('removeMonstersFromLocalInventory', 'Previous state or monsters array not available');
                        return prev;
                    }
                    
                    return {
                        ...prev,
                        monsters: prev.monsters.filter(m => !idsToRemove.includes(m.id))
                    };
                },
            });
        } catch (e) {
            logger.warn('removeMonstersFromLocalInventory', `Failed to update local inventory for IDs: ${idsToRemove}`, e);
        }
    }

    // =======================
    // 4. UI Utilities
    // =======================
    function createElement(tag, options = {}) {
        const element = document.createElement(tag);
        
        // Apply styles
        if (options.styles) {
            Object.assign(element.style, options.styles);
        }
        
        // Apply attributes
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        
        // Apply classes
        if (options.className) {
            element.className = options.className;
        }
        
        // Set text content
        if (options.text) {
            element.textContent = options.text;
        }
        
        // Set inner HTML
        if (options.html) {
            element.innerHTML = options.html;
        }
        
        // Add event listeners
        if (options.events) {
            Object.entries(options.events).forEach(([event, handler]) => {
                element.addEventListener(event, handler);
            });
        }
        
        // Append children
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
    
    // =======================
    // 5. UI Component Creation
    // =======================
    function createBox({title, content, icon = null}) {
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
        contentWrapper.style.justifyContent = 'space-between';
        contentWrapper.style.padding = '10px';
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
        // Split the text to underline "ALL"
        const parts = warningText.split('ALL');
        const beforeAll = parts[0];
        const afterAll = parts[1];
        
        const allSpan = createElement('span', { 
            text: 'ALL',
            styles: { 
                textDecoration: 'underline',
                cursor: showTooltip ? 'help' : 'default'
            }
        });
        
        if (showTooltip) {
            // Determine if this is for autosell or autosqueeze based on the warning text
            const isAutosell = warningText.includes('sell');
            const tooltipText = isAutosell 
                ? 'The script will sell all creatures in your inventory that are:\n- Unlocked creatures,\n- Level 10 or below (52251 experience),\n- Not in daycare.'
                : 'The script will squeeze all creatures in your inventory that are:\n- Unlocked creatures,\n- Within the specified gene range,\n- Not in daycare.';
            
            allSpan.title = tooltipText;
            
            // Add hover effect
            allSpan.addEventListener('mouseenter', () => {
                allSpan.style.textDecoration = 'underline double';
                allSpan.style.color = '#ff8a8a';
            });
            
            allSpan.addEventListener('mouseleave', () => {
                allSpan.style.textDecoration = 'underline';
                allSpan.style.color = '#ff6b6b';
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
        inputLabel.textContent = opts.inputLabel + ': Between';
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
        andText.textContent = 'and';
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
    
    function createSettingsSection(opts) {
        const section = document.createElement('div');
        
        // Create description row
        const descWrapper = createDescriptionRow(opts.desc);
        section.appendChild(descWrapper);
        
        // Add warning text about inventory
        const warningText = opts.summaryType === 'Autosell' 
            ? 'This will sell ALL creatures from your inventory!'
            : 'This will squeeze ALL creatures from your inventory!';
        const warningWrapper = createWarningRow(warningText, true);
        section.appendChild(warningWrapper);
        
        // Create checkbox row
        const { row: row1, checkbox, label } = createCheckboxRow(opts.persistKey, opts.label, opts.icon);
        section.appendChild(row1);
        // Create gene input row
        const { row: row2, inputMin, inputMax } = createGeneInputRow(opts);
        section.appendChild(row2);
        const row3 = document.createElement('div');
        row3.style.display = 'flex';
        row3.style.alignItems = 'center';
        row3.style.width = '100%';
        row3.style.marginBottom = '12px';
        const minCountLabel = document.createElement('span');
        minCountLabel.textContent = 'Trigger when:';
        minCountLabel.className = 'pixel-font-16';
        minCountLabel.style.marginRight = '6px';
        minCountLabel.style.fontWeight = 'bold';
        minCountLabel.style.fontSize = '14px';
        minCountLabel.style.color = '#cccccc';
        row3.appendChild(minCountLabel);
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
            // Clamp value between 1 and 20
            const val = Math.max(1, Math.min(20, parseInt(minCountInput.value, 10) || 1));
            minCountInput.value = val;
        }
        minCountInput.addEventListener('input', validateMinCountInput);
        minCountInput.addEventListener('blur', validateMinCountInput);
        row3.appendChild(minCountInput);
        const minCountSuffix = document.createElement('span');
        minCountSuffix.textContent = 'creatures';
        minCountSuffix.className = 'pixel-font-16';
        minCountSuffix.style.color = '#cccccc';
        row3.appendChild(minCountSuffix);
        function validateInputs(e) {
            // Parse and validate min/max values
            let minVal = Math.max(opts.inputMin, Math.min(opts.inputMax, parseInt(inputMin.value, 10) || opts.inputMin));
            let maxVal = Math.max(opts.inputMin, Math.min(opts.inputMax, parseInt(inputMax.value, 10) || opts.inputMax));
            
            // Ensure min <= max with smart adjustment
            if (e && e.target === inputMin && minVal >= maxVal) {
                maxVal = Math.min(opts.inputMax, minVal + 1);
            } else if (e && e.target === inputMax && maxVal <= minVal) {
                minVal = Math.max(opts.inputMin, maxVal - 1);
            }
            
            // Update input values
            inputMin.value = minVal;
            inputMax.value = maxVal;
        }
        inputMin.addEventListener('input', validateInputs);
        inputMax.addEventListener('input', validateInputs);
        inputMin.addEventListener('blur', validateInputs);
        inputMax.addEventListener('blur', validateInputs);
        const geneValidationCleanup = () => {
            inputMin.removeEventListener('input', validateInputs);
            inputMax.removeEventListener('input', validateInputs);
            inputMin.removeEventListener('blur', validateInputs);
            inputMax.removeEventListener('blur', validateInputs);
        };
        
        const minCountValidationCleanup = () => {
            minCountInput.removeEventListener('input', validateMinCountInput);
            minCountInput.removeEventListener('blur', validateMinCountInput);
        };
        
        const settingsSaveCleanup = () => {
            [checkbox, inputMin, inputMax, minCountInput].forEach(el => {
                el.removeEventListener('change', saveSettings);
            });
        };
        
        const summaryUpdateCleanup = () => {
            [checkbox, inputMin, inputMax, minCountInput].forEach(el => {
                el.removeEventListener('input', updateSummary);
                el.removeEventListener('change', updateSummary);
            });
        };
        
        const focusCleanup = () => {
            [checkbox, inputMin, inputMax].forEach(el => {
                el.removeEventListener('focus', () => {
                    el.style.boxShadow = '0 0 0 2px #ffe066, 0 0 8px #ffe06677';
                });
                el.removeEventListener('blur', () => {
                    el.style.boxShadow = '';
                });
                el.removeEventListener('change', () => {
                    el.style.boxShadow = '0 0 0 2px #ffe066, 0 0 8px #ffe06677';
                    setTimeout(() => { el.style.boxShadow = ''; }, 400);
                });
            });
        };
        
        // Store cleanup functions for later execution
        const cleanupFns = [
            geneValidationCleanup,
            minCountValidationCleanup,
            settingsSaveCleanup,
            summaryUpdateCleanup,
            focusCleanup
        ];
        

        const summary = document.createElement('div');
        summary.className = 'pixel-font-16';
        summary.style.color = '#ffe066';
        summary.style.fontSize = '13px';
        summary.style.margin = '8px 0 0 0';
        section.appendChild(descWrapper);
        const separator = document.createElement('div');
        separator.className = 'separator my-2.5';
        separator.setAttribute('role', 'none');
        separator.style.margin = '6px 0px';
        section.appendChild(separator);
        section.appendChild(row1);
        section.appendChild(row2);
        section.appendChild(row3);
        const statusArea = document.createElement('div');
        statusArea.style.display = 'flex';
        statusArea.style.flexDirection = 'column';
        statusArea.style.justifyContent = 'flex-end';
        statusArea.style.height = '48px';
        statusArea.style.marginTop = 'auto';
        const separator2 = document.createElement('div');
        separator2.className = 'separator my-2.5';
        separator2.setAttribute('role', 'none');
        separator2.style.margin = '6px 0px';
        statusArea.appendChild(separator2);
        statusArea.appendChild(summary);
        if (summary.parentNode === section) {
            section.removeChild(summary);
        }
        section.appendChild(statusArea);
        checkbox.tabIndex = 1;
        label.htmlFor = checkbox.id;
        inputMin.tabIndex = 2;
        inputMax.tabIndex = 3;
        inputMin.setAttribute('aria-label', opts.label + ' Genes Min Threshold');
        inputMax.setAttribute('aria-label', opts.label + ' Genes Max Threshold');
        inputMin.setAttribute('autocomplete', 'off');
        inputMax.setAttribute('autocomplete', 'off');
        [checkbox, inputMin, inputMax].forEach(el => {
            el.addEventListener('focus', () => {
                el.style.boxShadow = '0 0 0 2px #ffe066, 0 0 8px #ffe06677';
            });
            el.addEventListener('blur', () => {
                el.style.boxShadow = '';
            });
        });
        [checkbox, inputMin, inputMax].forEach(el => {
            el.addEventListener('change', () => {
                el.style.boxShadow = '0 0 0 2px #ffe066, 0 0 8px #ffe06677';
                setTimeout(() => { el.style.boxShadow = ''; }, 400);
            });
        });
        const saved = getCachedSettings();
        if (typeof saved[opts.persistKey + 'Checked'] === 'boolean') checkbox.checked = saved[opts.persistKey + 'Checked'];
        if (typeof saved[opts.persistKey + 'GenesMin'] === 'number') inputMin.value = saved[opts.persistKey + 'GenesMin'];
        if (typeof saved[opts.persistKey + 'GenesMax'] === 'number') inputMax.value = saved[opts.persistKey + 'GenesMax'];
        if (typeof saved[opts.persistKey + 'MinCount'] === 'number') minCountInput.value = saved[opts.persistKey + 'MinCount'];
        function saveSettings() {
            setCachedSettings({
                [opts.persistKey + 'Checked']: checkbox.checked,
                [opts.persistKey + 'GenesMin']: parseInt(inputMin.value, 10),
                [opts.persistKey + 'GenesMax']: parseInt(inputMax.value, 10),
                [opts.persistKey + 'MinCount']: parseInt(minCountInput.value, 10)
            });
        }
        [checkbox, inputMin, inputMax, minCountInput].forEach(el => {
            el.addEventListener('change', saveSettings);
        });
        async function safeGetCreatureCount(minThreshold, maxThreshold, enabled, summaryDiv, type) {
            try {
                if (!enabled) return 0;
                
                // Simplified state access with optional chaining
                const monsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters || [];
                if (!Array.isArray(monsters)) throw new Error('Creature list unavailable');
                
                // For sell type, we need to filter out daycare creatures
                if (type === 'Autosell') {
                    const eligibleMonsters = [];
                    for (const monster of monsters) {
                        if (typeof monster.genes === 'number' && 
                            monster.genes >= minThreshold && 
                            monster.genes <= maxThreshold) {
                            // Check if creature is in daycare
                            const inDaycare = await isCreatureInDaycare(monster.id);
                            if (!inDaycare) {
                                eligibleMonsters.push(monster);
                            }
                        }
                    }
                    return eligibleMonsters.length;
                } else {
                    // For squeeze type, no daycare check needed
                    return monsters.filter(m => 
                        typeof m.genes === 'number' && 
                        m.genes >= minThreshold && 
                        m.genes <= maxThreshold
                    ).length;
                }
            } catch (e) {
                summaryDiv.textContent = `${type} error: ${e?.message || 'Unknown error'}`;
                summaryDiv.style.color = '#ff6b6b';
                return null;
            }
        }
        async function updateSummary() {
            let minVal = parseInt(inputMin.value, 10);
            let maxVal = parseInt(inputMax.value, 10);
            let minCountVal = parseInt(minCountInput.value, 10);
            let count = await safeGetCreatureCount(minVal, maxVal, checkbox.checked, summary, opts.summaryType);
            if (typeof count === 'number') {
                if (checkbox.checked) {
                    if (opts.summaryType === 'Autosell') {
                        summary.textContent = `Selling creatures with genes between ${minVal} and ${maxVal} if count ≥ ${minCountVal}.`;
                    } else if (opts.summaryType === 'Autosqueeze') {
                        summary.textContent = `Squeezing creatures with genes between ${minVal} and ${maxVal} if count ≥ ${minCountVal}.`;
                    } else {
                        summary.textContent = `${count} creature${count === 1 ? '' : 's'} will be auto${opts.summaryType.toLowerCase()} if count ≥ ${minCountVal}.`;
                    }
                } else {
                    summary.textContent = opts.summaryType + ' is disabled.';
                }
                summary.style.color = '#ffe066';
            }
        }
        [checkbox, inputMin, inputMax, minCountInput].forEach(el => {
            el.addEventListener('input', () => updateSummary());
            el.addEventListener('change', () => updateSummary());
        });
        updateSummary();
        section._checkbox = checkbox;
        section._inputMin = inputMin;
        section._inputMax = inputMax;
        section._minCountInput = minCountInput;
        section._cleanupFns = cleanupFns;
        return section;
    }

    // =======================
    // 5. State Management
    // =======================
    
    const stateManager = {
        sessionStats: {
            soldCount: 0,
            soldGold: 0,
            squeezedCount: 0,
            squeezedDust: 0
        },
        
        processedIds: new Set(),
        
        errorStats: {
            fetchErrors: 0,
            squeezeErrors: 0,
            sellErrors: 0,
            localStorageErrors: 0
        },
        
        lastRun: 0,
        
        updateSessionStats(type, count, value) {
            if (type === 'sold') {
                this.sessionStats.soldCount += count;
                this.sessionStats.soldGold += value;
            } else if (type === 'squeezed') {
                this.sessionStats.squeezedCount += count;
                this.sessionStats.squeezedDust += value;
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
                squeezedCount: 0,
                squeezedDust: 0
            };
            this.processedIds.clear();
            this.notifyUIUpdate();
        },
        
        clearProcessedIds() {
            this.processedIds.clear();
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
    async function squeezeEligibleMonsters(monsters) {
        try {
            const settings = getCachedSettings();
            if (!monsters) {
                monsters = await fetchServerMonsters();
            }
            if (!Array.isArray(monsters)) {
                const msg = '[Autoseller][DEBUG] Could not access monster list.';
                console.warn(msg);
                return;
            }
            let { toSqueeze } = await getEligibleMonsters(settings, monsters);
            if (!toSqueeze.length) {
                return;
            }
            
            for (let i = 0; i < toSqueeze.length; i += BATCH_SIZE) {
                const batch = toSqueeze.slice(i, i + BATCH_SIZE);
                const ids = batch.map(m => m.id).filter(Boolean);
                if (!ids.length) {
                    continue;
                }
                
                const url = 'https://bestiaryarena.com/api/trpc/inventory.monsterSqueezer?batch=1';
                const body = { "0": { json: ids } };
                const result = await apiRequest(url, { method: 'POST', body });
                
                const apiResponse = result.data;
                
                if (
                    apiResponse &&
                    Array.isArray(apiResponse) &&
                    apiResponse[0]?.result?.data?.json?.dustDiff != null
                ) {
                    const dustReceived = apiResponse[0].result.data.json.dustDiff;
                    const squeezedCount = Math.floor(dustReceived / API_CONSTANTS.DUST_PER_CREATURE);
                    
                    stateManager.updateSessionStats('squeezed', squeezedCount, dustReceived);
                    stateManager.markProcessed(ids);
                    
                    removeMonstersFromLocalInventory(ids);
                } else if (!result.success && result.status === 404) {
                    // Don't remove from local inventory on 404 to be safe
                } else if (!result.success) {
                    errorHandler.warn('squeezeEligibleMonsters', `Squeeze API failed: HTTP ${result.status}`);
                    continue;
                } else {
                    errorHandler.warn('squeezeEligibleMonsters', 'Unexpected API response format:', apiResponse);
                }
                
                if (i + BATCH_SIZE < toSqueeze.length) {
                    await new Promise(res => setTimeout(res, BATCH_DELAY_MS));
                }
            }
        } catch (e) {
            logger.warn('squeezeEligibleMonsters', 'Error', e);
            stateManager.updateErrorStats('squeezeErrors');
            
            logger.error('squeezeEligibleMonsters', `Failed to squeeze monsters. Error: ${e.message}`, e);
            
            if (monsters && Array.isArray(monsters)) {
                // Operation failed
            }
        }
    }
    async function sellEligibleMonsters(monsters) {
        try {
            const settings = getCachedSettings();
            
            if (!monsters) {
                monsters = await fetchServerMonsters();
            }
            if (!Array.isArray(monsters)) {
                const msg = '[Autoseller][DEBUG] Could not access monster list.';
                console.warn(msg);
                return;
            }
            let { toSell } = await getEligibleMonsters(settings, monsters);
            
            toSell = toSell.filter(m => !stateManager.isProcessed(m.id));
            
            if (!toSell.length) {
                return;
            }
            
            const batchSize = SELL_RATE_LIMIT.BATCH_SIZE;
            for (let i = 0; i < toSell.length; i += batchSize) {
                const batch = toSell.slice(i, i + batchSize);
                
                for (const monster of batch) {
                    const id = monster.id;
                    
                    await sellRateLimiter.waitForSlot();
                    sellRateLimiter.recordRequest();
                    
                    const url = 'https://bestiaryarena.com/api/trpc/game.sellMonster?batch=1';
                    const body = { "0": { json: id } };
                    const result = await apiRequest(url, { method: 'POST', body });
                
                    if (!result.success && result.status === 429) {
                        sellRateLimiter.record429Error();
                        logger.warn('sellEligibleMonsters', `Rate limited (429) for monster ${id}, backing off...`);
                        
                        await new Promise(resolve => setTimeout(resolve, 5000 + (sellRateLimiter.consecutive429Errors * 2000)));
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
                        stateManager.markProcessed([id]);
                        removeMonstersFromLocalInventory([id]);
                        sellRateLimiter.recordSuccess();
                    } else if (!result.success && result.status === 404) {
                        stateManager.markProcessed([id]);
                        sellRateLimiter.recordSuccess();
                    } else if (!result.success) {
                        errorHandler.warn('sellEligibleMonsters', `Sell API failed for ID ${id}: HTTP ${result.status}`);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, SELL_RATE_LIMIT.DELAY_BETWEEN_SELLS_MS));
                }
                
                if (i + batchSize < toSell.length) {
                    await new Promise(resolve => setTimeout(resolve, SELL_RATE_LIMIT.BATCH_DELAY_MS));
                }
            }
        } catch (e) {
            logger.warn('sellEligibleMonsters', 'Error', e);
            stateManager.updateErrorStats('sellErrors');
            
            logger.error('sellEligibleMonsters', `Failed to sell monsters. Error: ${e.message}`, e);
            
            if (monsters && Array.isArray(monsters)) {
                // Operation failed
            }
            
            if (e.message && e.message.includes('rate limit')) {
                sellRateLimiter.consecutive429Errors = 0;
                sellRateLimiter.requestTimes = [];
            } else if (sellRateLimiter.consecutive429Errors >= SELL_RATE_LIMIT.CONSECUTIVE_ERROR_RESET_THRESHOLD) {
                sellRateLimiter.consecutive429Errors = 0;
                sellRateLimiter.requestTimes = [];
            }
        }
    }

    // =======================
    // 6. Modal Management
    // =======================
    function openAutosellerModal() {
        // Force refresh settings cache when modal opens
        clearSettingsCache();
        
        if (typeof api !== 'undefined' && api && api.ui && api.ui.components && api.ui.components.createModal) {
            const autosellContent = document.createElement('div');
            autosellContent.style.display = 'flex';
            autosellContent.style.flexDirection = 'column';
            autosellContent.style.alignItems = 'flex-start';
            autosellContent.style.gap = '10px';
            autosellContent.style.width = '100%';
            const autosellRow1 = document.createElement('div');
            autosellRow1.style.display = 'flex';
            autosellRow1.style.alignItems = 'center';
            autosellRow1.style.width = '100%';
            const autosellCheckbox = document.createElement('input');
            autosellCheckbox.type = 'checkbox';
            autosellCheckbox.id = 'autosell-checkbox';
            autosellCheckbox.style.marginRight = '8px';
            const autosellLabel = document.createElement('label');
            autosellLabel.htmlFor = 'autosell-checkbox';
            autosellLabel.textContent = 'Sell creatures equal or below:';
            autosellLabel.className = 'pixel-font-16';
            autosellLabel.style.fontWeight = 'bold';
            autosellLabel.style.fontSize = '16px';
            autosellLabel.style.color = '#ffffff';
            autosellLabel.style.marginRight = '8px';
            autosellRow1.appendChild(autosellCheckbox);
            autosellRow1.appendChild(autosellLabel);
            autosellContent.appendChild(autosellRow1);
            const autosellRow2 = document.createElement('div');
            autosellRow2.style.display = 'flex';
            autosellRow2.style.alignItems = 'center';
            autosellRow2.style.width = '100%';
            const autosellGenesLabel = document.createElement('span');
            autosellGenesLabel.textContent = 'Genes';
            autosellGenesLabel.className = 'pixel-font-16';
            autosellGenesLabel.style.marginRight = '6px';
            autosellGenesLabel.style.fontWeight = 'bold';
            autosellGenesLabel.style.fontSize = '16px';
            autosellGenesLabel.style.color = '#cccccc';
            autosellRow2.appendChild(autosellGenesLabel);
            const autosellGenesInput = document.createElement('input');
            autosellGenesInput.type = 'number';
            autosellGenesInput.min = '5';
            autosellGenesInput.max = '100';
            autosellGenesInput.value = '100';
            autosellGenesInput.className = 'pixel-font-16';
            autosellGenesInput.style.width = '60px';
            autosellGenesInput.style.marginRight = '4px';
            autosellGenesInput.style.textAlign = 'center';
            autosellGenesInput.style.borderRadius = '3px';
            autosellGenesInput.style.border = '1px solid #ffe066';
            autosellGenesInput.style.background = '#232323';
            autosellGenesInput.style.color = '#ffe066';
            autosellGenesInput.style.fontWeight = 'bold';
            autosellGenesInput.style.fontSize = '16px';
            autosellRow2.appendChild(autosellGenesInput);
            const autosellGenesPercent = document.createElement('span');
            autosellGenesPercent.textContent = '%';
            autosellGenesPercent.className = 'pixel-font-16';
            autosellGenesPercent.style.fontWeight = 'bold';
            autosellGenesPercent.style.fontSize = '16px';
            autosellGenesPercent.style.color = '#cccccc';
            autosellRow2.appendChild(autosellGenesPercent);
            autosellContent.appendChild(autosellRow2);
            const autosqueezeContent = document.createElement('div');
            autosqueezeContent.style.display = 'flex';
            autosqueezeContent.style.flexDirection = 'column';
            autosqueezeContent.style.alignItems = 'flex-start';
            autosqueezeContent.style.gap = '10px';
            autosqueezeContent.style.width = '100%';
            const autosqueezeRow1 = document.createElement('div');
            autosqueezeRow1.style.display = 'flex';
            autosqueezeRow1.style.alignItems = 'center';
            autosqueezeRow1.style.width = '100%';
            const autosqueezeCheckbox = document.createElement('input');
            autosqueezeCheckbox.type = 'checkbox';
            autosqueezeCheckbox.id = 'autosqueeze-checkbox';
            autosqueezeCheckbox.style.marginRight = '8px';
            const autosqueezeLabel = document.createElement('label');
            autosqueezeLabel.htmlFor = 'autosqueeze-checkbox';
            autosqueezeLabel.textContent = 'Squeeze creatures equal or below:';
            autosqueezeLabel.className = 'pixel-font-16';
            autosqueezeLabel.style.fontWeight = 'bold';
            autosqueezeLabel.style.fontSize = '16px';
            autosqueezeLabel.style.color = '#ffffff';
            autosqueezeLabel.style.marginRight = '8px';
            autosqueezeRow1.appendChild(autosqueezeCheckbox);
            autosqueezeRow1.appendChild(autosqueezeLabel);
            autosqueezeContent.appendChild(autosqueezeRow1);
            const autosqueezeRow2 = document.createElement('div');
            autosqueezeRow2.style.display = 'flex';
            autosqueezeRow2.style.alignItems = 'center';
            autosqueezeRow2.style.width = '100%';
            const autosqueezeGenesLabel = document.createElement('span');
            autosqueezeGenesLabel.textContent = 'Genes';
            autosqueezeGenesLabel.className = 'pixel-font-16';
            autosqueezeGenesLabel.style.marginRight = '6px';
            autosqueezeGenesLabel.style.fontWeight = 'bold';
            autosqueezeGenesLabel.style.fontSize = '16px';
            autosqueezeGenesLabel.style.color = '#cccccc';
            autosqueezeRow2.appendChild(autosqueezeGenesLabel);
            const autosqueezeGenesInput = document.createElement('input');
            autosqueezeGenesInput.type = 'number';
            autosqueezeGenesInput.min = '80';
            autosqueezeGenesInput.max = '100';
            autosqueezeGenesInput.value = '100';
            autosqueezeGenesInput.className = 'pixel-font-16';
            autosqueezeGenesInput.style.width = '60px';
            autosqueezeGenesInput.style.marginRight = '4px';
            autosqueezeGenesInput.style.textAlign = 'center';
            autosqueezeGenesInput.style.borderRadius = '3px';
            autosqueezeGenesInput.style.border = '1px solid #ffe066';
            autosqueezeGenesInput.style.background = '#232323';
            autosqueezeGenesInput.style.color = '#ffe066';
            autosqueezeGenesInput.style.fontWeight = 'bold';
            autosqueezeGenesInput.style.fontSize = '16px';
            autosqueezeRow2.appendChild(autosqueezeGenesInput);
            const autosqueezeGenesPercent = document.createElement('span');
            autosqueezeGenesPercent.textContent = '%';
            autosqueezeGenesPercent.className = 'pixel-font-16';
            autosqueezeGenesPercent.style.fontWeight = 'bold';
            autosqueezeGenesPercent.style.fontSize = '16px';
            autosqueezeGenesPercent.style.color = '#cccccc';
            autosqueezeRow2.appendChild(autosqueezeGenesPercent);
            autosqueezeContent.appendChild(autosqueezeRow2);
            const autosellSection = createSettingsSection({
                label: 'Sell creatures equal or below:',
                inputLabel: 'Genes',
                desc: 'Automatically sells creatures below the selected gene threshold.',
                tooltip: 'When enabled, creatures with genes at or below the specified percentage will be sold automatically.',
                inputMin: 5,
                inputMax: 79,
                defaultMin: 5,
                defaultMax: 79,
                summaryType: 'Autosell',
                persistKey: 'autosell',
                icon: 'https://bestiaryarena.com/assets/icons/goldpile.png'
            });
            const autosqueezeSection = createSettingsSection({
                label: 'Squeeze creatures equal or below:',
                inputLabel: 'Genes',
                desc: 'Automatically squeezes creatures below the selected gene threshold.',
                tooltip: 'When enabled, creatures with genes at or below the specified percentage will be squeezed automatically.',
                inputMin: 80,
                inputMax: 100,
                defaultMin: 80,
                defaultMax: 100,
                summaryType: 'Autosqueeze',
                persistKey: 'autosqueeze',
                icon: 'https://bestiaryarena.com/assets/icons/dust.png'
            });
            const col1 = createBox({ title: 'Autosell', content: autosellSection, icon: 'https://bestiaryarena.com/assets/icons/goldpile.png' });
            col1.style.width = '240px';
            col1.style.minWidth = '240px';
            col1.style.maxWidth = '240px';
            col1.style.height = '100%';
            col1.style.flex = '0 0 240px';
            const col2 = createBox({ title: 'Autosqueeze', content: autosqueezeSection, icon: 'https://bestiaryarena.com/assets/icons/dust.png' });
            col2.style.width = '240px';
            col2.style.minWidth = '240px';
            col2.style.maxWidth = '240px';
            col2.style.height = '100%';
            col2.style.flex = '0 0 240px';
            col2.style.borderLeft = '2px solid #ffe066';
            const columnsWrapper = document.createElement('div');
            columnsWrapper.style.display = 'flex';
            columnsWrapper.style.flexDirection = 'row';
            columnsWrapper.style.justifyContent = 'flex-start';
            columnsWrapper.style.alignItems = 'stretch';
            columnsWrapper.style.width = '100%';
            columnsWrapper.style.height = '100%';
            columnsWrapper.appendChild(col1);
            columnsWrapper.appendChild(col2);
            columnsWrapper.style.flexWrap = 'wrap';
            col1.style.width = '100%';
            col1.style.minWidth = '220px';
            col1.style.maxWidth = '100%';
            col1.style.flex = '1 1 220px';
            col2.style.width = '100%';
            col2.style.minWidth = '220px';
            col2.style.maxWidth = '100%';
            col2.style.flex = '1 1 220px';
            col2.style.borderLeft = '2px solid #ffe066';
            col2.style.marginTop = '0';
            if (!document.getElementById(UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_RESPONSIVE_STYLE)) {
                const style = document.createElement('style');
                style.id = UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_RESPONSIVE_STYLE;
                style.textContent = `
                @media (max-width: 600px) {
                    #autoseller-modal-columns { flex-direction: column !important; }
                    #autoseller-modal-columns > div { max-width: 100% !important; min-width: 0 !important; border-left: none !important; margin-top: 12px !important; }
                    #autoseller-modal-columns > div:first-child { margin-top: 0 !important; }
                }
                `;
                document.head.appendChild(style);
            }
            columnsWrapper.id = 'autoseller-modal-columns';
            let modalInstance = api.ui.components.createModal({
                title: 'Autoseller',
                width: UI_CONSTANTS.MODAL_WIDTH,
                height: UI_CONSTANTS.MODAL_HEIGHT,
                content: columnsWrapper,
                buttons: [
                    {
                        text: 'Close',
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
                    // Execute cleanup functions to prevent memory leaks
                    [col1, col2].forEach(col => {
                        if (col && col.firstChild && col.firstChild._cleanupFns) {
                            col.firstChild._cleanupFns.forEach(fn => {
                                try {
                                    fn();
                                } catch (e) {
                                    logger.warn('modalCleanup', 'Error during cleanup', e);
                                }
                            });
                        }
                    });
                    
                    // Clear references to prevent memory leaks
                    cachedWidget = null;
                    cachedStatEls = null;
                });
            }
            setTimeout(() => {
                const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
                if (dialog) {
                    dialog.classList.remove('max-w-[300px]');
                    dialog.style.width = UI_CONSTANTS.MODAL_WIDTH + 'px';
                    dialog.style.minWidth = UI_CONSTANTS.MODAL_WIDTH + 'px';
                    dialog.style.maxWidth = UI_CONSTANTS.MODAL_WIDTH + 'px';
                    dialog.style.height = UI_CONSTANTS.MODAL_HEIGHT + 'px';
                    dialog.style.minHeight = UI_CONSTANTS.MODAL_HEIGHT + 'px';
                    dialog.style.maxHeight = UI_CONSTANTS.MODAL_HEIGHT + 'px';
                    const contentElem = dialog.querySelector('.widget-bottom');
                    if (contentElem) {
                        contentElem.style.height = UI_CONSTANTS.MODAL_CONTENT_HEIGHT + 'px';
                        contentElem.style.display = 'flex';
                        contentElem.style.flexDirection = 'column';
                        contentElem.style.justifyContent = 'flex-start';
                    }
                }
            }, 0);
        }
    }

    // =======================
    // 7. UI Injection
    // =======================
    function addAutosellerNavButton() {
        function tryInsert() {
            // Use DOM cache for better performance
            const nav = domCache.get('nav.shrink-0');
            if (!nav) {
                setTimeout(tryInsert, 500);
                return;
            }
            
            const ul = nav.querySelector('ul.flex.items-center');
            if (!ul) {
                setTimeout(tryInsert, 500);
                return;
            }
            
            // Check if button already exists
            if (ul.querySelector(`.${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_NAV_BTN}`)) return;
            
            const li = document.createElement('li');
            li.className = 'hover:text-whiteExp';
            
            const btn = document.createElement('button');
            btn.className = `${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_NAV_BTN} focus-style-visible pixel-font-16 relative my-px flex items-center gap-1.5 border border-solid border-transparent px-1 py-0.5 active:frame-pressed-1 data-[selected="true"]:frame-pressed-1 hover:text-whiteExp data-[selected="true"]:text-whiteExp sm:px-2 sm:py-0.5`;
            btn.setAttribute('data-selected', 'false');
            btn.innerHTML = `<img src="https://bestiaryarena.com/assets/icons/autoplay.png" alt="Autoseller" width="11" height="11" class="pixelated"><span class="hidden sm:inline">Autoseller</span>`;
            btn.onclick = openAutosellerModal;
            
            li.appendChild(btn);
            ul.appendChild(li);
            
            // Update button color based on active state
            updateAutosellerNavButtonColor();
        }
        tryInsert();
    }
    
    function updateAutosellerNavButtonColor() {
        // Use DOM cache for better performance
        const btn = domCache.get(`.${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_NAV_BTN}`);
        if (!btn) return;
        
        const settings = getCachedSettings();
        const isActive = settings.autosellChecked || settings.autosqueezeChecked;
        
        // Use inline styles to override any existing styles
        btn.style.color = isActive ? '#22c55e' : '#ef4444'; // Green or Red color
    }

    // =======================
    // 8. Autoseller Session Widget
    // =======================
    function injectAutosellerWidgetStyles() {
        if (!document.getElementById('autoseller-widget-css')) {
            const style = document.createElement('style');
            style.id = 'autoseller-widget-css';
            style.textContent = `
            #autoseller-session-widget {
                background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
                border: 6px solid transparent;
                border-image: url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch;
                border-radius: 6px;
                box-shadow: 0 2px 12px 0 #000a;
                min-width: 240px;
                max-width: 320px;
                font-family: 'Satoshi', 'Trebuchet MS', Arial, sans-serif;
                overflow: visible;
                position: relative;
            }
            #autoseller-session-widget .widget-top {
                background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
                font-family: var(--font-filled);
                font-size: 16px;
                line-height: 1;
                letter-spacing: .0625rem;
                word-spacing: -.1875rem;
                padding-left: .25rem;
                padding-right: .25rem;
                color: rgb(144 144 144/var(--tw-text-opacity,1));
                height: 20px;
                min-height: 20px;
                max-height: 20px;
                letter-spacing: 1px;
                display: flex;
                align-items: center;
                border-bottom: none;
                margin-bottom: 0;
                position: relative;
                z-index: 1;
                overflow: visible;
            }
            #autoseller-session-widget .minimize-btn {
                margin-left: auto;
                border: none;
                background: transparent;
                color: rgb(144 144 144/var(--tw-text-opacity,1));
                border-radius: 3px;
                font-family: var(--font-filled);
                font-size: 16px;
                line-height: 1;
                letter-spacing: .0625rem;
                word-spacing: -.1875rem;
                padding-left: .25rem;
                padding-right: .25rem;
                cursor: pointer;
                width: 24px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }
            #autoseller-session-widget .minimize-btn:hover {
                background: #fff2;
            }
            #autoseller-session-widget .stat-row {
                display: grid;
                grid-template-columns: 80px 60px 60px;
                grid-template-rows: 1fr 6px 1fr;
                gap: 0;
                justify-content: center;
                margin: 0;
                align-items: stretch;
                width: 100%;
                background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
                border: none;
                border-radius: 0;
                padding: 0;
                box-sizing: border-box;
                min-height: 70px;
            }
            #autoseller-session-widget .separator {
                grid-column: 1 / -1;
                grid-row: 2;
                height: 6px;
                margin: 0;
                background: transparent;
                border: none;
                opacity: 0.3;
                width: 100%;
                min-width: 100%;
                max-width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #autoseller-session-widget .separator::after {
                content: '';
                width: 100%;
                height: 1px;
                background: #ffe066;
            }
            #autoseller-session-widget .stat-label {
                font-family: pixel-font-16, monospace;
                font-size: 13px;
                color: #fff;
                font-weight: bold;
                margin-bottom: 0;
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
            }
            #autoseller-session-widget .stat-icon {
                width: 14px;
                height: 14px;
                vertical-align: middle;
                margin-right: 3px;
            }
            #autoseller-session-widget .stat-label:nth-child(1) { grid-area: 1 / 1; }
            #autoseller-session-widget .stat-value:nth-child(2) { grid-area: 1 / 2; }
            #autoseller-session-widget .stat-value:nth-child(3) { grid-area: 1 / 3; }
            #autoseller-session-widget .separator:nth-child(4) { grid-area: 2 / 1 / 2 / 4; }
            #autoseller-session-widget .stat-label:nth-child(5) { grid-area: 3 / 1; }
            #autoseller-session-widget .stat-value:nth-child(6) { grid-area: 3 / 2; }
            #autoseller-session-widget .stat-value:nth-child(7) { grid-area: 3 / 3; }
            

            `;
            document.head.appendChild(style);
        }
    }

    function createAutosellerSessionWidget() {
        injectAutosellerWidgetStyles();
        const settings = getCachedSettings();
        const shouldShowWidget = settings.autosellChecked || settings.autosqueezeChecked;
        
        // Use DOM cache for better performance
        const existingWidget = domCache.get(`#${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET}`);
        if (!shouldShowWidget) {
            if (existingWidget && existingWidget.parentNode) {
                existingWidget.parentNode.removeChild(existingWidget);
                domCache.invalidate(`#${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET}`);
                // Reset session stats when widget is removed
                stateManager.resetSession();
            }
            return;
        }
        if (existingWidget) return;
        
        // Find the autoplay session container using the same logic as manual injection
        const autoplaySessions = document.querySelectorAll('div[data-autosetup]');
        let autoplayContainer = null;
        
        for (const session of autoplaySessions) {
            const widgetBottom = session.querySelector('.widget-bottom[data-minimized="false"]');
            if (widgetBottom) {
                autoplayContainer = widgetBottom;
                break;
            }
        }
        
        if (!autoplayContainer) {
            logger.warn('createAutosellerSessionWidget', 'Could not find autoplay session container');
            // Debug: log available containers
            const allWidgetBottoms = document.querySelectorAll('.widget-bottom');
            return;
        }
        const widget = document.createElement('div');
        widget.className = '';
        widget.id = UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET;
        
        // Create widget using the same structure that worked in manual injection
        widget.innerHTML = `
            <div class="widget-top">Autoseller session</div>
            <div class="widget-bottom p-0">
                <div class="stat-row">
                    <div class="stat-label">Sold:</div>
                    <div class="stat-value" id="autoseller-session-sold-count">0</div>
                    <div class="stat-value" id="autoseller-session-sold-gold">
                        <img src="https://bestiaryarena.com/assets/icons/goldpile.png" alt="Gold" class="stat-icon">
                        <span>0</span>
                    </div>
                    <div class="separator"></div>
                    <div class="stat-label">Squeezed:</div>
                    <div class="stat-value" id="autoseller-session-squeezed-count">0</div>
                    <div class="stat-value" id="autoseller-session-squeezed-dust">
                        <img src="https://bestiaryarena.com/assets/icons/dust.png" alt="Dust" class="stat-icon">
                        <span>0</span>
                    </div>
                </div>
            </div>
        `;
        
        // Reset session stats when widget is created
        stateManager.resetSession();
        forceWidgetUpdate = true;
        
        // Store references to stat elements for updates
        widget._statEls = {
            soldCount: widget.querySelector('#autoseller-session-sold-count'),
            soldGold: widget.querySelector('#autoseller-session-sold-gold'),
            squeezedCount: widget.querySelector('#autoseller-session-squeezed-count'),
            squeezedDust: widget.querySelector('#autoseller-session-squeezed-dust')
        };
        
        // Add widget to the autoplay container
        autoplayContainer.appendChild(widget);
    }

    // Cache previous values to avoid unnecessary DOM updates
    let lastUpdateValues = { soldCount: -1, soldGold: -1, squeezedCount: -1, squeezedDust: -1 };
    
    // Flag to force update when widget is recreated
    let forceWidgetUpdate = false;
    
    // Cache DOM elements to reduce queries
    let cachedWidget = null;
    let cachedStatEls = null;
    
    // Batch update queue for better performance
    let updateQueue = [];
    let isUpdateScheduled = false;
    
    function updateAutosellerSessionWidget() {
        // Use cached widget or query once with DOM cache
        if (!cachedWidget) {
            cachedWidget = domCache.get(`#${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET}`);
            if (!cachedWidget) {
                return;
            }
            cachedStatEls = cachedWidget._statEls;
            if (!cachedStatEls) {
                return;
            }
        }
        
        // Verify widget still exists
        if (!document.contains(cachedWidget)) {
            cachedWidget = null;
            cachedStatEls = null;
            domCache.invalidate(`#${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET}`);
            return;
        }
        
        const currentValues = stateManager.getSessionStats();
        
        // Force update if widget was just recreated
        if (forceWidgetUpdate) {
            lastUpdateValues = { soldCount: -1, soldGold: -1, squeezedCount: -1, squeezedDust: -1 };
            forceWidgetUpdate = false;
        }
        
        // Collect all updates that need to be made
        const updates = [];
        
        if (currentValues.soldCount !== lastUpdateValues.soldCount && cachedStatEls.soldCount) {
            updates.push(() => {
                cachedStatEls.soldCount.textContent = `${currentValues.soldCount}`;
                lastUpdateValues.soldCount = currentValues.soldCount;
            });
        }
        
        if (currentValues.soldGold !== lastUpdateValues.soldGold && cachedStatEls.soldGold) {
            updates.push(() => {
                const goldText = cachedStatEls.soldGold.querySelector('span');
                if (goldText) goldText.textContent = `${currentValues.soldGold}`;
                lastUpdateValues.soldGold = currentValues.soldGold;
            });
        }
        
        if (currentValues.squeezedCount !== lastUpdateValues.squeezedCount && cachedStatEls.squeezedCount) {
            updates.push(() => {
                cachedStatEls.squeezedCount.textContent = `${currentValues.squeezedCount}`;
                lastUpdateValues.squeezedCount = currentValues.squeezedCount;
            });
        }
        
        if (currentValues.squeezedDust !== lastUpdateValues.squeezedDust && cachedStatEls.squeezedDust) {
            updates.push(() => {
                const dustText = cachedStatEls.squeezedDust.querySelector('span');
                if (dustText) dustText.textContent = `${currentValues.squeezedDust}`;
                lastUpdateValues.squeezedDust = currentValues.squeezedDust;
            });
        }
        
        // Add updates to queue
        if (updates.length > 0) {
            updateQueue.push(...updates);
        }
        
        // Schedule batch update if not already scheduled
        if (!isUpdateScheduled && updateQueue.length > 0) {
            isUpdateScheduled = true;
            requestAnimationFrame(() => {
                // Process all queued updates
                updateQueue.forEach(update => update());
                updateQueue = [];
                isUpdateScheduled = false;
            });
        }
    }

    // =======================
    // 8. Event Management & Memory Optimization
    // =======================
    
    const eventManager = {
        listeners: new Map(),
        observers: new Set(),
        timers: new Set(),
        
        listenerCount: 0,
        observerCount: 0,
        timerCount: 0,
        
        addListener(element, event, handler, options = {}) {
            const optimizedOptions = {
                passive: true,
                ...options
            };
            
            element.addEventListener(event, handler, optimizedOptions);
            
            const key = `${element.id || 'anonymous'}-${event}`;
            if (!this.listeners.has(key)) {
                this.listeners.set(key, []);
            }
            this.listeners.get(key).push({ element, event, handler, options: optimizedOptions });
            this.listenerCount++;
        },
        
        removeAllListeners() {
            this.listeners.forEach((listeners, key) => {
                listeners.forEach(({ element, event, handler, options }) => {
                    element.removeEventListener(event, handler, options);
                });
            });
            this.listeners.clear();
            this.listenerCount = 0;
        },
        
        addObserver(observer) {
            this.observers.add(observer);
            this.observerCount++;
        },
        
        disconnectAllObservers() {
            this.observers.forEach(observer => {
                if (observer && typeof observer.disconnect === 'function') {
                    observer.disconnect();
                }
            });
            this.observers.clear();
            this.observerCount = 0;
        },
        
        addTimer(timerId) {
            this.timers.add(timerId);
            this.timerCount++;
        },
        
        removeTimer(timerId) {
            if (this.timers.delete(timerId)) {
                this.timerCount--;
            }
        },
        
        clearAllTimers() {
            this.timers.forEach(timerId => {
                clearTimeout(timerId);
                clearInterval(timerId);
            });
            this.timers.clear();
            this.timerCount = 0;
        },
        
        cleanup() {
            this.removeAllListeners();
            this.disconnectAllObservers();
            this.clearAllTimers();
        },
        
        getStats() {
            return {
                listeners: this.listenerCount,
                observers: this.observerCount,
                timers: this.timerCount,
                totalResources: this.listenerCount + this.observerCount + this.timerCount
            };
        }
    };
    
    // Inject the widget when autoplay UI appears
    let autosellerWidgetObserver = null;
    let observerSetupAttempts = 0;
    let isObserverActive = false;
    
    function setupAutosellerWidgetObserver() {
        if (autosellerWidgetObserver || observerSetupAttempts >= MAX_OBSERVER_ATTEMPTS || isObserverActive) return;
        
        observerSetupAttempts++;
        isObserverActive = true;
        
        createAutosellerSessionWidget();
        updateAutosellerSessionWidget();
        
        setTimeout(() => {
            createAutosellerSessionWidget();
            updateAutosellerSessionWidget();
        }, 1000);
        
        if (typeof MutationObserver !== 'undefined') {
            let lastWidgetState = { shouldShow: false, containerExists: false };
            let debounceTimer = null;
            
            autosellerWidgetObserver = new MutationObserver((mutations) => {
                const hasRelevantMutations = mutations.some(mutation => {
                    return mutation.type === 'childList' || 
                           (mutation.type === 'attributes' && mutation.attributeName === 'data-minimized');
                });
                
                if (!hasRelevantMutations) return;
                
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                    eventManager.removeTimer(debounceTimer);
                }
                
                debounceTimer = setTimeout(() => {
                    const autoplaySessions = document.querySelectorAll('div[data-autosetup]');
                    let autoplayContainer = null;
                    
                    for (const session of autoplaySessions) {
                        const widgetBottom = session.querySelector('.widget-bottom[data-minimized="false"]');
                        if (widgetBottom) {
                            autoplayContainer = widgetBottom;
                            break;
                        }
                    }
                    
                    const widget = domCache.get(`#${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET}`);
                    const widgetExists = !!widget;
                    
                    const settings = getCachedSettings();
                    const shouldShowWidget = settings.autosellChecked || settings.autosqueezeChecked;
                    const containerExists = !!autoplayContainer;
                    
                    const currentState = { shouldShow: shouldShowWidget, containerExists };
                    if (JSON.stringify(currentState) === JSON.stringify(lastWidgetState)) {
                        return;
                    }
                    
                    lastWidgetState = currentState;
                    
                    if (containerExists && shouldShowWidget && !widgetExists) {
                        createAutosellerSessionWidget();
                        updateAutosellerSessionWidget();
                    } else if ((!containerExists || !shouldShowWidget) && widgetExists) {
                        if (widget && widget.parentNode) {
                            widget.parentNode.removeChild(widget);
                            lastUpdateValues = { soldCount: -1, soldGold: -1, squeezedCount: -1, squeezedDust: -1 };
                            cachedWidget = null;
                            cachedStatEls = null;
                            forceWidgetUpdate = true;
                        }
                    }
                }, OBSERVER_DEBOUNCE_MS);
                
                eventManager.addTimer(debounceTimer);
            });
            
            eventManager.addObserver(autosellerWidgetObserver);
            
            autosellerWidgetObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['data-minimized', 'data-autosetup']
            });
            
        } else {
            logger.warn('setupAutosellerWidgetObserver', 'MutationObserver not available');
            isObserverActive = false;
        }
    }

    // =======================
    // 9. Initialization & Exports
    // =======================
    function initAutoseller() {
        logger.init('Loaded.');
        addAutosellerNavButton();
        setupAutosellerWidgetObserver();
        
        // Set initial button color after a short delay to ensure DOM is ready
        setTimeout(() => {
            updateAutosellerNavButtonColor();
        }, 1000);
        
        let lastProcessedBattleKey = null;
        if (globalThis.state.board && globalThis.state.board.subscribe) {
            globalThis.state.board.subscribe(async ({ context }) => {
                const serverResults = context.serverResults;
                if (!serverResults || !serverResults.rewardScreen || typeof serverResults.rewardScreen.gameTicks !== 'number') return;
                const seed = serverResults.seed;
                const gameTicks = serverResults.rewardScreen.gameTicks;
                const battleKey = `${seed}:${gameTicks}`;
                if (battleKey === lastProcessedBattleKey) return;
                lastProcessedBattleKey = battleKey;
                const inventorySnapshot = await fetchServerMonsters();
                const waitSeconds = gameTicks / 16;
                setTimeout(async () => {
                    if (!stateManager.canRun()) {
                        return;
                    }
                    
                    const settings = getCachedSettings();
                    
                    if (!settings.autosellChecked && !settings.autosqueezeChecked) {
                        return;
                    }
                    
                    await squeezeEligibleMonsters(inventorySnapshot);
                    await sellEligibleMonsters(inventorySnapshot);
                }, (waitSeconds + 5) * 1000);
            });
        }
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
    


    // Expose public API and cleanup for mod loader
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
                clearSettingsCache();
                console.log('All caches cleared');
            },
            cleanup: function() {
                // Cache DOM queries for cleanup
                const widget = document.getElementById(UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET);
                const navBtn = document.querySelector(`.${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_NAV_BTN}`);
                const style = document.getElementById(UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_RESPONSIVE_STYLE);
                
                // Remove Autoseller session widget
                if (widget && widget.parentNode) widget.parentNode.removeChild(widget);
                
                // Remove nav button
                if (navBtn && navBtn.parentNode) navBtn.parentNode.removeChild(navBtn);
                
                // Remove injected style
                if (style && style.parentNode) style.parentNode.removeChild(style);
                
                // Clean up all tracked resources using event manager
                eventManager.cleanup();
                
                // Clean up widget observer
                if (autosellerWidgetObserver) {
                    autosellerWidgetObserver.disconnect();
                    autosellerWidgetObserver = null;
                }
                isObserverActive = false;
                observerSetupAttempts = 0;
                
                // Clear caches
                serverMonsterCache.clear();
                daycareCache.clear();
                cachedWidget = null;
                cachedStatEls = null;
                lastUpdateValues = { soldCount: -1, soldGold: -1, squeezedCount: -1, squeezedDust: -1 };
                
                // Reset state
                stateManager.resetSession();
            }
        };
    }

})();