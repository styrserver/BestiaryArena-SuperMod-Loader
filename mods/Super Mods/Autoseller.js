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
    
    // UI Constants
    const UI_CONSTANTS = {
        MODAL_WIDTH: 600,
        MODAL_HEIGHT: 410,
        MODAL_CONTENT_HEIGHT: 330,
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
        SELL_GENE_MAX: 79
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
        autosqueezeMinCount: 1
    };
    
    // =======================
    // 1.2. Logging & Debugging
    // =======================
    /**
     * Log levels for different types of messages
     * @enum {string}
     */
    const LOG_LEVELS = {
        DEBUG: 'debug',
        INFO: 'info',
        WARN: 'warn',
        ERROR: 'error'
    };
    
    /**
     * Enhanced logging utility with levels and debugging capabilities
     * @type {Object}
     */
    const logger = {
        // Current log level (can be changed via settings)
        level: LOG_LEVELS.INFO,
        
        // Debug mode flag
        debugMode: false,
        
        // Performance tracking
        performance: new Map(),
        
        /**
         * Set the current log level
         * @param {string} level - Log level to set
         */
        setLevel(level) {
            if (Object.values(LOG_LEVELS).includes(level)) {
                this.level = level;
                this.debugMode = level === LOG_LEVELS.DEBUG;
            }
        },
        
        /**
         * Check if a log level should be displayed
         * @param {string} level - Log level to check
         * @returns {boolean} Whether the level should be logged
         */
        shouldLog(level) {
            const levels = Object.values(LOG_LEVELS);
            const currentIndex = levels.indexOf(this.level);
            const messageIndex = levels.indexOf(level);
            return messageIndex >= currentIndex;
        },
        
        /**
         * Format log message with timestamp and context
         * @param {string} level - Log level
         * @param {string} functionName - Function name
         * @param {string} message - Log message
         * @returns {string} Formatted log message
         */
        formatMessage(level, functionName, message) {
            const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
            return `[${timestamp}][${modName}][${level.toUpperCase()}][${functionName}] ${message}`;
        },
        
        /**
         * Log a debug message
         * @param {string} functionName - Function name
         * @param {string} message - Debug message
         * @param {*} [data] - Optional data to log
         */
        debug: (functionName, message, data = null) => {
            if (logger.shouldLog(LOG_LEVELS.DEBUG)) {
                const logMessage = logger.formatMessage(LOG_LEVELS.DEBUG, functionName, message);
                if (data) {
                    console.debug(logMessage, data);
                } else {
                    console.debug(logMessage);
                }
            }
        },
        
        /**
         * Log an info message
         * @param {string} functionName - Function name
         * @param {string} message - Info message
         * @param {*} [data] - Optional data to log
         */
        info: (functionName, message, data = null) => {
            if (logger.shouldLog(LOG_LEVELS.INFO)) {
                const logMessage = logger.formatMessage(LOG_LEVELS.INFO, functionName, message);
                if (data) {
                    console.info(logMessage, data);
                } else {
                    console.info(logMessage);
                }
            }
        },
        
        /**
         * Log a warning message
         * @param {string} functionName - Function name
         * @param {string} message - Warning message
         * @param {Error} [error=null] - Optional error object
         */
        warn: (functionName, message, error = null) => {
            if (logger.shouldLog(LOG_LEVELS.WARN)) {
                const logMessage = logger.formatMessage(LOG_LEVELS.WARN, functionName, message);
                if (error) {
                    console.warn(logMessage, error);
                } else {
                    console.warn(logMessage);
                }
            }
        },
        
        /**
         * Log an error message
         * @param {string} functionName - Function name
         * @param {string} message - Error message
         * @param {Error} [error=null] - Optional error object
         */
        error: (functionName, message, error = null) => {
            if (logger.shouldLog(LOG_LEVELS.ERROR)) {
                const logMessage = logger.formatMessage(LOG_LEVELS.ERROR, functionName, message);
                if (error) {
                    console.error(logMessage, error);
                } else {
                    console.error(logMessage);
                }
            }
        },
        
        /**
         * Start performance timing for a function
         * @param {string} functionName - Function name to time
         */
        startTimer: (functionName) => {
            if (logger.debugMode) {
                logger.performance.set(functionName, performance.now());
            }
        },
        
        /**
         * End performance timing for a function
         * @param {string} functionName - Function name that was timed
         */
        endTimer: (functionName) => {
            if (logger.debugMode) {
                const startTime = logger.performance.get(functionName);
                if (startTime) {
                    const duration = performance.now() - startTime;
                    logger.debug(functionName, `Execution time: ${duration.toFixed(2)}ms`);
                    logger.performance.delete(functionName);
                }
            }
        },
        
        /**
         * Log current state for debugging
         * @param {string} functionName - Function name
         */
        logState: (functionName) => {
            if (logger.debugMode) {
                logger.debug(functionName, 'Current state:', {
                    sessionStats: stateManager.getSessionStats(),
                    errorStats: stateManager.getErrorStats(),
                    settings: getCachedSettings()
                });
            }
        },
        
        /**
         * Get debug information
         * @returns {Object} Debug information object
         */
        getDebugInfo: () => ({
            logLevel: logger.level,
            debugMode: logger.debugMode,
            sessionStats: stateManager.getSessionStats(),
            errorStats: stateManager.getErrorStats(),
            settings: getCachedSettings(),
            performance: Object.fromEntries(logger.performance)
        })
    };
    
    // Backward compatibility - keep the old errorHandler for existing code
    const errorHandler = {
        warn: logger.warn,
        error: logger.error,
        info: logger.info
    };
    
    let autosellerSettingsCache = null;
    
    function getCachedSettings() {
        // Return cached settings if available
        if (autosellerSettingsCache) return autosellerSettingsCache;
        
        // Try to get settings from mod loader context first
        if (typeof context !== 'undefined' && context.config && Object.keys(context.config).length > 0) {
            autosellerSettingsCache = { ...DEFAULT_SETTINGS, ...context.config };
            return autosellerSettingsCache;
        }
        
        // Fallback to localStorage
        try {
            const stored = JSON.parse(localStorage.getItem('autoseller-settings') || '{}');
            autosellerSettingsCache = { ...DEFAULT_SETTINGS, ...stored };
        } catch (e) { 
            errorHandler.warn('getCachedSettings', 'Failed to parse settings from localStorage', e);
            errorStats.localStorageErrors++;
            autosellerSettingsCache = { ...DEFAULT_SETTINGS }; 
        }
        
        return autosellerSettingsCache;
    }
    
    function setCachedSettings(newSettings) {
        autosellerSettingsCache = { ...autosellerSettingsCache, ...newSettings };
        
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
            errorHandler.warn('debouncedSaveSettings', 'Failed to save settings to localStorage', e);
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
    /**
     * Calculate the total gene percentage for a monster
     * @param {Object} m - Monster object
     * @param {number} [m.hp=0] - Health points
     * @param {number} [m.ad=0] - Attack damage
     * @param {number} [m.ap=0] - Ability power
     * @param {number} [m.armor=0] - Armor
     * @param {number} [m.magicResist=0] - Magic resistance
     * @returns {number} Total gene percentage (0-100)
     */
    function getGenes(m) {
        return (m.hp || 0) + (m.ad || 0) + (m.ap || 0) + (m.armor || 0) + (m.magicResist || 0);
    }
    /**
     * Filter monsters based on autosell and autosqueeze settings
     * @param {Object} settings - User settings object
     * @param {boolean} settings.autosellChecked - Whether autosell is enabled
     * @param {number} settings.autosellGenesMin - Minimum genes for selling
     * @param {number} settings.autosellGenesMax - Maximum genes for selling
     * @param {boolean} settings.autosqueezeChecked - Whether autosqueeze is enabled
     * @param {number} settings.autosqueezeGenesMin - Minimum genes for squeezing
     * @param {number} settings.autosqueezeGenesMax - Maximum genes for squeezing
     * @param {number} settings.autosellMinCount - Minimum count to trigger selling
     * @param {number} settings.autosqueezeMinCount - Minimum count to trigger squeezing
     * @param {Array<Object>} monsters - Array of monster objects
     * @returns {Object} Object containing arrays of monsters to squeeze and sell
     * @returns {Array<Object>} returns.toSqueeze - Monsters eligible for squeezing
     * @returns {Array<Object>} returns.toSell - Monsters eligible for selling
     */
    function getEligibleMonsters(settings, monsters) {
        const nonLocked = monsters.filter(m => !m.locked);
        const sellEnabled = settings['autosellChecked'];
        const sellMinGenes = settings['autosellGenesMin'] ?? 5;
        const sellMaxGenes = settings['autosellGenesMax'] ?? 79;
        const squeezeEnabled = settings['autosqueezeChecked'];
        const squeezeMinGenes = settings['autosqueezeGenesMin'] ?? 80;
        const squeezeMaxGenes = settings['autosqueezeGenesMax'] ?? 100;
        const sellMinCount = settings['autosellMinCount'] ?? 1;
        const squeezeMinCount = settings['autosqueezeMinCount'] ?? 1;
        const squeezeEligible = nonLocked.filter(m => squeezeEnabled && getGenes(m) >= squeezeMinGenes && getGenes(m) <= squeezeMaxGenes);
        const sellEligible = nonLocked.filter(m => !squeezeEligible.includes(m) && sellEnabled && getGenes(m) >= sellMinGenes && getGenes(m) <= sellMaxGenes);
        const toSqueeze = squeezeEligible.length >= squeezeMinCount ? squeezeEligible : [];
        const toSell = sellEligible.length >= sellMinCount ? sellEligible : [];
        return { toSqueeze, toSell };
    }

    // =======================
    // 3. API Utilities
    // =======================
    /**
     * Make an API request with retry logic and error handling
     * @param {string} url - The API endpoint URL
     * @param {Object} [options={}] - Request options
     * @param {string} [options.method='GET'] - HTTP method
     * @param {Object} [options.body] - Request body (will be JSON stringified)
     * @param {Object} [options.headers={}] - Additional headers
     * @param {number} [retries=API_CONSTANTS.RETRY_ATTEMPTS] - Number of retry attempts
     * @returns {Promise<Object>} Response object with success status and data
     * @returns {boolean} returns.success - Whether the request was successful
     * @returns {number} [returns.status] - HTTP status code (if available)
     * @returns {*} [returns.data] - Response data (if successful)
     * @returns {Error} [returns.error] - Error object (if failed)
     */
    async function apiRequest(url, options = {}, retries = API_CONSTANTS.RETRY_ATTEMPTS) {
        logger.startTimer('apiRequest');
        const { method = 'GET', body, headers = {} } = options;
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const requestOptions = {
                    method,
                    credentials: 'include',
                    headers: {
                        'content-type': 'application/json',
                        'X-Game-Version': API_CONSTANTS.GAME_VERSION,
                        ...headers
                    },
                    ...(body && { body: JSON.stringify(body) })
                };
                
                const resp = await fetch(url, requestOptions);
                
                // Try to parse response data regardless of status code
                let data = null;
                try {
                    data = await resp.json();
                } catch (parseError) {
                    // If we can't parse JSON, that's a real error
                    if (attempt === retries) {
                        errorHandler.error('apiRequest', 'Failed to parse response as JSON', parseError);
                        logger.endTimer('apiRequest');
                        return { success: false, error: parseError, data: null };
                    }
                    errorHandler.warn('apiRequest', `Attempt ${attempt + 1} failed to parse response, retrying...`, parseError);
                    await new Promise(resolve => setTimeout(resolve, API_CONSTANTS.RETRY_DELAY_BASE * (attempt + 1)));
                    continue;
                }
                
                if (!resp.ok) {
                    const errorMsg = `API request failed: HTTP ${resp.status}`;
                    
                    // Only retry on 5xx server errors, not 4xx client errors
                    if (resp.status >= 500 && attempt < retries) {
                        errorHandler.warn('apiRequest', `${errorMsg}, attempt ${attempt + 1} failed, retrying...`);
                        await new Promise(resolve => setTimeout(resolve, API_CONSTANTS.RETRY_DELAY_BASE * (attempt + 1)));
                        continue;
                    }
                    
                    // For 404 responses, check if we have valid data (this happens with squeeze API)
                    if (resp.status === 404 && data && Array.isArray(data) && data[0]?.result?.data?.json) {
                        logger.endTimer('apiRequest');
                        return { success: true, status: resp.status, data };
                    }
                    
                    // Don't log 404 as error since they're expected for already processed items
                    if (resp.status === 404) {
                        errorHandler.info('apiRequest', `API request returned 404 (expected for already processed items)`);
                    } else {
                        errorHandler.error('apiRequest', errorMsg);
                    }
                    return { success: false, status: resp.status, data };
                }
                
                logger.endTimer('apiRequest');
                return { success: true, status: resp.status, data };
                
            } catch (e) {
                if (attempt === retries) {
                    errorHandler.error('apiRequest', 'Final attempt failed', e);
                    logger.endTimer('apiRequest');
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
    async function fetchServerMonsters() {
        const myName = globalThis.state?.player?.getSnapshot?.()?.context?.name;
        if (!myName) {
            errorHandler.warn('fetchServerMonsters', 'Could not determine player name.');
            return [];
        }
        
        const url = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=${encodeURIComponent(JSON.stringify({"0":{json:myName}}))}`;
        const result = await apiRequest(url);
        
        if (!result.success) {
            errorStats.fetchErrors++;
            return [];
        }
        
        const monsters = result.data?.[0]?.result?.data?.json?.monsters || [];
        return monsters;
    }
    window.fetchServerMonsters = fetchServerMonsters;
    function removeMonstersFromLocalInventory(idsToRemove) {
        try {
            const player = globalThis.state?.player;
            if (!player) return;
            player.send({
                type: "setState",
                fn: (prev) => ({
                    ...prev,
                    monsters: prev.monsters.filter(m => !idsToRemove.includes(m.id))
                }),
            });
        } catch (e) {
            errorHandler.warn('removeMonstersFromLocalInventory', `Failed to update local inventory for IDs: ${idsToRemove}`, e);
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
        return createElement('input', {
            attributes: {
                type: options.type || 'text',
                ...(options.min !== undefined && { min: options.min }),
                ...(options.max !== undefined && { max: options.max }),
                ...(options.step !== undefined && { step: options.step }),
                ...(options.id && { id: options.id }),
                ...(options.autocomplete && { autocomplete: options.autocomplete })
            },
            styles: {
                width: options.width || 'auto',
                marginRight: options.marginRight || '0',
                textAlign: options.textAlign || 'left',
                borderRadius: options.borderRadius || '0',
                border: options.border || 'none',
                background: options.background || 'transparent',
                color: options.color || 'inherit',
                fontWeight: options.fontWeight || 'normal',
                fontSize: options.fontSize || 'inherit',
                ...options.styles
            },
            className: options.className || 'pixel-font-16',
            events: options.events || {},
            ...options
        });
    }
    
    // =======================
    // 5. UI Component Creation
    // =======================
    function createBox({title, content}) {
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
        p.textContent = title;
        p.className = 'pixel-font-16';
        p.style.margin = '0';
        p.style.padding = '0';
        p.style.textAlign = 'center';
        p.style.color = 'rgb(255, 255, 255)';
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
                createElement('span', {
                    text: description,
                    className: 'pixel-font-16',
                    styles: {
                        color: '#cccccc',
                        fontSize: '13px'
                    }
                })
            ]
        });
    }
    
    function createCheckboxRow(persistKey, label) {
        const checkbox = createInput({
            type: 'checkbox',
            id: persistKey + '-checkbox',
            styles: {
                marginRight: '8px'
            }
        });
        
        const labelEl = createElement('label', {
            attributes: { htmlFor: checkbox.id },
            text: label,
            className: 'pixel-font-16',
            styles: {
                fontWeight: 'bold',
                fontSize: '14px',
                color: '#ffffff',
                marginRight: '8px'
            }
        });
        
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
        
        // Create checkbox row
        const { row: row1, checkbox, label } = createCheckboxRow(opts.persistKey, opts.label);
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
        minCountLabel.textContent = 'Min. count to trigger:';
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
        const cleanupFns = [geneValidationCleanup];
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
        function safeGetCreatureCount(minThreshold, maxThreshold, enabled, summaryDiv, type) {
            try {
                if (!enabled) return 0;
                
                // Simplified state access with optional chaining
                const monsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters || [];
                if (!Array.isArray(monsters)) throw new Error('Creature list unavailable');
                
                return monsters.filter(m => 
                    typeof m.genes === 'number' && 
                    m.genes >= minThreshold && 
                    m.genes <= maxThreshold
                ).length;
            } catch (e) {
                summaryDiv.textContent = `${type} error: ${e?.message || 'Unknown error'}`;
                summaryDiv.style.color = '#ff6b6b';
                return null;
            }
        }
        function updateSummary() {
            let minVal = parseInt(inputMin.value, 10);
            let maxVal = parseInt(inputMax.value, 10);
            let minCountVal = parseInt(minCountInput.value, 10);
            let count = safeGetCreatureCount(minVal, maxVal, checkbox.checked, summary, opts.summaryType);
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
            el.addEventListener('input', updateSummary);
            el.addEventListener('change', updateSummary);
        });
        updateSummary();
        section._checkbox = checkbox;
        section._inputMin = inputMin;
        section._inputMax = inputMax;
        section._minCountInput = minCountInput;
        const minCountValidationCleanup = () => {
            minCountInput.removeEventListener('input', validateMinCountInput);
            minCountInput.removeEventListener('blur', validateMinCountInput);
        };
        cleanupFns.push(minCountValidationCleanup);
        section._cleanupFns = cleanupFns;
        return section;
    }

    // =======================
    // 5. State Management
    // =======================
    /**
     * Centralized state manager for the Autoseller mod
     * @type {Object}
     */
    const stateManager = {
        // Session statistics
        sessionStats: {
            soldCount: 0,
            soldGold: 0,
            squeezedCount: 0,
            squeezedDust: 0
        },
        
        // Tracking processed monster IDs to avoid duplicates
        processedIds: new Set(),
        
        // Error tracking for monitoring
        errorStats: {
            fetchErrors: 0,
            squeezeErrors: 0,
            sellErrors: 0,
            localStorageErrors: 0
        },
        
        // Timing controls
        lastRun: 0,
        
        /**
         * Update session statistics
         * @param {string} type - Type of update ('sold' or 'squeezed')
         * @param {number} count - Number of items processed
         * @param {number} value - Value gained (gold or dust)
         */
        updateSessionStats(type, count, value) {
            if (type === 'sold') {
                this.sessionStats.soldCount += count;
                this.sessionStats.soldGold += value;
            } else if (type === 'squeezed') {
                this.sessionStats.squeezedCount += count;
                this.sessionStats.squeezedDust += value;
            }
            
            // Trigger UI update
            this.notifyUIUpdate();
        },
        
        /**
         * Mark monster IDs as processed
         * @param {Array<number>} ids - Array of monster IDs
         */
        markProcessed(ids) {
            ids.forEach(id => this.processedIds.add(id));
        },
        
        /**
         * Check if monster ID has been processed
         * @param {number} id - Monster ID
         * @returns {boolean} Whether the ID has been processed
         */
        isProcessed(id) {
            return this.processedIds.has(id);
        },
        
        /**
         * Update error statistics
         * @param {string} type - Type of error
         */
        updateErrorStats(type) {
            if (this.errorStats.hasOwnProperty(type)) {
                this.errorStats[type]++;
            }
        },
        
        /**
         * Check if enough time has passed since last run
         * @returns {boolean} Whether autoseller can run again
         */
        canRun() {
            const now = Date.now();
            if (now - this.lastRun < AUTOSELLER_MIN_DELAY_MS) {
                return false;
            }
            this.lastRun = now;
            return true;
        },
        
        /**
         * Reset session statistics
         */
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
        
        /**
         * Get current session statistics
         * @returns {Object} Copy of current session stats
         */
        getSessionStats() {
            return { ...this.sessionStats };
        },
        
        /**
         * Get current error statistics
         * @returns {Object} Copy of current error stats
         */
        getErrorStats() {
            return { ...this.errorStats };
        },
        
        /**
         * Notify UI components to update
         */
        notifyUIUpdate() {
            // This will be called whenever state changes
            // UI components can listen for these updates
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
            let { toSqueeze } = getEligibleMonsters(settings, monsters);
            if (!toSqueeze.length) {
                return;
            }
            
            // --- Batching logic: max 20 per 10 seconds ---
            
            for (let i = 0; i < toSqueeze.length; i += BATCH_SIZE) {
                const batch = toSqueeze.slice(i, i + BATCH_SIZE);
                // Process the entire batch at once since the API expects an array
                const ids = batch.map(m => m.id).filter(Boolean);
                if (!ids.length) {
                    continue;
                }
                
                const url = 'https://bestiaryarena.com/api/trpc/inventory.monsterSqueezer?batch=1';
                const body = { "0": { json: ids } };
                const result = await apiRequest(url, { method: 'POST', body });
                
                const apiResponse = result.data;
                
                // Check if we got a valid response with dustDiff
                if (
                    apiResponse &&
                    Array.isArray(apiResponse) &&
                    apiResponse[0]?.result?.data?.json?.dustDiff != null
                ) {
                    const dustReceived = apiResponse[0].result.data.json.dustDiff;
                    const squeezedCount = Math.floor(dustReceived / API_CONSTANTS.DUST_PER_CREATURE);
                    
                    // Update state through state manager
                    stateManager.updateSessionStats('squeezed', squeezedCount, dustReceived);
                    stateManager.markProcessed(ids);
                    
                    removeMonstersFromLocalInventory(ids);
                    errorHandler.info('squeezeEligibleMonsters', `Successfully squeezed ${squeezedCount} creatures for ${dustReceived} dust`);
                } else if (!result.success && result.status === 404) {
                    // For 404 responses without valid data, assume some monsters were already squeezed
                    errorHandler.info('squeezeEligibleMonsters', 'Some monsters in batch may have been already squeezed or don\'t exist (HTTP 404)');
                    // Don't remove from local inventory on 404 to be safe
                } else if (!result.success) {
                    errorHandler.warn('squeezeEligibleMonsters', `Squeeze API failed: HTTP ${result.status}`);
                    continue;
                } else {
                    errorHandler.warn('squeezeEligibleMonsters', 'Unexpected API response format:', apiResponse);
                }
                
                if (i + BATCH_SIZE < toSqueeze.length) {
                    // Wait 10 seconds before next batch
                    await new Promise(res => setTimeout(res, BATCH_DELAY_MS));
                }
            }
        } catch (e) {
            errorHandler.warn('squeezeEligibleMonsters', 'Error', e);
            stateManager.updateErrorStats('squeezeErrors');
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
            let { toSell } = getEligibleMonsters(settings, monsters);
            // Filter out already processed IDs
            toSell = toSell.filter(m => !stateManager.isProcessed(m.id));
            if (!toSell.length) {
                return;
            }
            // --- Session stats update ---
            // (removed old commented-out code)
            // --- End session stats update ---
            // --- Batching logic: max 20 per 10 seconds ---
            for (let i = 0; i < toSell.length; i += BATCH_SIZE) {
                const batch = toSell.slice(i, i + BATCH_SIZE);
                // eslint-disable-next-line no-await-in-loop
                await Promise.all(batch.map(async (m) => {
                    const id = m.id;
                    const url = 'https://bestiaryarena.com/api/trpc/game.sellMonster?batch=1';
                    const body = { "0": { json: id } };
                    const result = await apiRequest(url, { method: 'POST', body });
                    
                    const apiResponse = result.data;
                    
                    // Check if we got a valid response with goldValue
                    if (
                        apiResponse &&
                        Array.isArray(apiResponse) &&
                        apiResponse[0]?.result?.data?.json?.goldValue != null &&
                        !stateManager.isProcessed(id)
                    ) {
                        const goldReceived = apiResponse[0].result.data.json.goldValue;
                        
                        // Update state through state manager
                        stateManager.updateSessionStats('sold', 1, goldReceived);
                        stateManager.markProcessed([id]);
                        
                        // Only remove from local inventory on confirmed success
                        removeMonstersFromLocalInventory([id]);
                    } else if (!result.success && result.status === 404) {
                        // For 404 responses, assume monster was already sold or doesn't exist
                        errorHandler.info('sellEligibleMonsters', `Monster ID ${id} not found on server (already sold or removed).`);
                        stateManager.markProcessed([id]); // Mark as processed even if 404
                    } else if (!result.success) {
                        errorHandler.warn('sellEligibleMonsters', `Sell API failed for ID ${id}: HTTP ${result.status}`);
                    }
                }));
                if (i + BATCH_SIZE < toSell.length) {
                    // Wait 10 seconds before next batch
                    await new Promise(res => setTimeout(res, BATCH_DELAY_MS));
                }
            }
            const player = globalThis.state?.player;
        } catch (e) {
            errorHandler.warn('sellEligibleMonsters', 'Error', e);
            stateManager.updateErrorStats('sellErrors');
        }
    }

    // =======================
    // 6. Modal Management
    // =======================
    function openAutosellerModal() {
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
                persistKey: 'autosell'
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
                persistKey: 'autosqueeze'
            });
            const col1 = createBox({ title: 'Autosell', content: autosellSection });
            col1.style.width = '240px';
            col1.style.minWidth = '240px';
            col1.style.maxWidth = '240px';
            col1.style.height = '100%';
            col1.style.flex = '0 0 240px';
            const col2 = createBox({ title: 'Autosqueeze', content: autosqueezeSection });
            col2.style.width = '220px';
            col2.style.minWidth = '220px';
            col2.style.maxWidth = '220px';
            col2.style.height = '100%';
            col2.style.flex = '0 0 220px';
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
            if (!document.getElementById('autoseller-responsive-style')) {
                const style = document.createElement('style');
                style.id = 'autoseller-responsive-style';
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
                width: 600,
                height: 410,
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
                    [col1, col2].forEach(col => {
                        if (col && col.firstChild && col.firstChild._cleanupFns) {
                            col.firstChild._cleanupFns.forEach(fn => fn());
                        }
                    });
                });
            }
            setTimeout(() => {
                const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
                if (dialog) {
                    dialog.classList.remove('max-w-[300px]');
                    dialog.style.width = '600px';
                    dialog.style.minWidth = '600px';
                    dialog.style.maxWidth = '600px';
                    dialog.style.height = '410px';
                    dialog.style.minHeight = '410px';
                    dialog.style.maxHeight = '410px';
                    const contentElem = dialog.querySelector('.widget-bottom');
                    if (contentElem) {
                        contentElem.style.height = '330px';
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
            const nav = document.querySelector('nav.shrink-0');
            if (!nav) {
                setTimeout(tryInsert, 500);
                return;
            }
            const ul = nav.querySelector('ul.flex.items-center');
            if (!ul) {
                setTimeout(tryInsert, 500);
                return;
            }
            if (ul.querySelector('.autoseller-nav-btn')) return;
            const li = document.createElement('li');
            li.className = 'hover:text-whiteExp';
            const btn = document.createElement('button');
            btn.className = 'autoseller-nav-btn focus-style-visible pixel-font-16 relative my-px flex items-center gap-1.5 border border-solid border-transparent px-1 py-0.5 active:frame-pressed-1 data-[selected="true"]:frame-pressed-1 hover:text-whiteExp data-[selected="true"]:text-whiteExp sm:px-2 sm:py-0.5';
            btn.setAttribute('data-selected', 'false');
            btn.innerHTML = `<img src="https://bestiaryarena.com/assets/icons/autoplay.png" alt="Autoseller" width="11" height="11" class="pixelated"><span class="hidden sm:inline">Autoseller</span>`;
            btn.onclick = openAutosellerModal;
            li.appendChild(btn);
            if (ul) ul.appendChild(li);
            
            // Update button color based on active state
            updateAutosellerNavButtonColor();
        }
        tryInsert();
    }
    
    function updateAutosellerNavButtonColor() {
        const btn = document.querySelector('.autoseller-nav-btn');
        if (!btn) return;
        
        const settings = getCachedSettings();
        const isActive = settings.autosellChecked || settings.autosqueezeChecked;
        
        // Use inline styles to override any existing styles
        if (isActive) {
            btn.style.color = '#22c55e'; // Green color
        } else {
            btn.style.color = '#ef4444'; // Red color
        }
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
        const existingWidget = document.getElementById('autoseller-session-widget');
        if (!shouldShowWidget) {
            if (existingWidget && existingWidget.parentNode) existingWidget.parentNode.removeChild(existingWidget);
            return;
        }
        if (existingWidget) return;
        
        // Cache the autoplay container query
        const autoplayContainer = document.querySelector('.widget-bottom[data-minimized="false"]');
        if (!autoplayContainer) return;
        const widget = document.createElement('div');
        widget.className = '';
        widget.id = 'autoseller-session-widget';
        // Header
        const header = document.createElement('div');
        header.className = 'widget-top';
        header.appendChild(document.createTextNode('Autoseller session'));
        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'minimize-btn';
        minimizeBtn.title = 'Minimize';
        minimizeBtn.innerHTML = '−';
        let minimized = false;
        minimizeBtn.onclick = () => {
            minimized = !minimized;
            if (body) body.style.display = minimized ? 'none' : '';
            minimizeBtn.innerHTML = minimized ? '&#x25B2;' : '−';
        };
        header.appendChild(minimizeBtn);
        widget.appendChild(header);
        // Body
        const body = document.createElement('div');
        body.className = 'widget-bottom p-0';
        body.style.display = 'flex';
        body.style.flexDirection = 'column';
        body.style.justifyContent = 'center';
        body.style.height = '100%';
        // Stat row - using grid layout
        const row = document.createElement('div');
        row.className = 'stat-row';
        
        widget._statEls = {};
        
        // Create grid elements in order: Sold label, Sold count, Sold Gold, Squeezed label, Squeezed count, Squeezed Dust
        
        // Sold label (row 1, col 1)
        const soldLabel = document.createElement('div');
        soldLabel.className = 'stat-label';
        soldLabel.textContent = 'Sold:';
        row.appendChild(soldLabel);
        
        // Sold count (row 1, col 2)
        const soldCount = document.createElement('div');
        soldCount.className = 'stat-value';
        soldCount.id = 'autoseller-session-sold-count';
        soldCount.textContent = '0';
        row.appendChild(soldCount);
        widget._statEls.soldCount = soldCount;
        
        // Helper function to create stat elements with icons
        function createStatWithIcon(id, iconSrc, iconAlt, amount) {
            const statEl = document.createElement('div');
            statEl.className = 'stat-value';
            statEl.id = id;
            
            const icon = document.createElement('img');
            icon.src = iconSrc;
            icon.alt = iconAlt;
            icon.className = 'stat-icon';
            
            const amountEl = document.createElement('span');
            amountEl.textContent = amount;
            
            statEl.appendChild(icon);
            statEl.appendChild(amountEl);
            return statEl;
        }
        
        // Sold Gold (row 1, col 3)
        const soldGold = createStatWithIcon(
            'autoseller-session-sold-gold',
            'https://bestiaryarena.com/assets/icons/goldpile.png',
            'Gold',
            '0'
        );
        row.appendChild(soldGold);
        widget._statEls.soldGold = soldGold;
        
        // Separator (row 2)
        const separator = document.createElement('div');
        separator.className = 'separator my-2.5';
        separator.setAttribute('role', 'none');
        row.appendChild(separator);
        
        // Squeezed label (row 3, col 1)
        const squeezedLabel = document.createElement('div');
        squeezedLabel.className = 'stat-label';
        squeezedLabel.textContent = 'Squeezed:';
        row.appendChild(squeezedLabel);
        
        // Squeezed count (row 3, col 2)
        const squeezedCount = document.createElement('div');
        squeezedCount.className = 'stat-value';
        squeezedCount.id = 'autoseller-session-squeezed-count';
        squeezedCount.textContent = '0';
        row.appendChild(squeezedCount);
        widget._statEls.squeezedCount = squeezedCount;
        
        // Squeezed Dust (row 3, col 3)
        const squeezedDust = createStatWithIcon(
            'autoseller-session-squeezed-dust',
            'https://bestiaryarena.com/assets/icons/dust.png',
            'Dust',
            '0'
        );
        row.appendChild(squeezedDust);
        widget._statEls.squeezedDust = squeezedDust;
        body.appendChild(row);
        widget.appendChild(body);
        if (autoplayContainer) autoplayContainer.appendChild(widget);
    }

    // Cache previous values to avoid unnecessary DOM updates
    let lastUpdateValues = { soldCount: -1, soldGold: -1, squeezedCount: -1, squeezedDust: -1 };
    
    function updateAutosellerSessionWidget() {
        // Cache the widget query
        const widget = document.getElementById('autoseller-session-widget');
        if (!widget || !widget._statEls) return;
        
        const statEls = widget._statEls;
        const currentValues = stateManager.getSessionStats();
        
        // Only update DOM if values have changed
        if (currentValues.soldCount !== lastUpdateValues.soldCount && statEls.soldCount) {
            statEls.soldCount.textContent = `${currentValues.soldCount}`;
            lastUpdateValues.soldCount = currentValues.soldCount;
        }
        
        if (currentValues.soldGold !== lastUpdateValues.soldGold && statEls.soldGold) {
            const goldText = statEls.soldGold.querySelector('span');
            if (goldText) goldText.textContent = `${currentValues.soldGold}`;
            lastUpdateValues.soldGold = currentValues.soldGold;
        }
        
        if (currentValues.squeezedCount !== lastUpdateValues.squeezedCount && statEls.squeezedCount) {
            statEls.squeezedCount.textContent = `${currentValues.squeezedCount}`;
            lastUpdateValues.squeezedCount = currentValues.squeezedCount;
        }
        
        if (currentValues.squeezedDust !== lastUpdateValues.squeezedDust && statEls.squeezedDust) {
            const dustText = statEls.squeezedDust.querySelector('span');
            if (dustText) dustText.textContent = `${currentValues.squeezedDust}`;
            lastUpdateValues.squeezedDust = currentValues.squeezedDust;
        }
    }

    // =======================
    // 8. Event Management
    // =======================
    /**
     * Event manager for handling cleanup and event listeners
     * @type {Object}
     */
    const eventManager = {
        // Track all event listeners for cleanup
        listeners: new Map(),
        
        // Track observers for cleanup
        observers: new Set(),
        
        // Track intervals and timeouts for cleanup
        timers: new Set(),
        
        /**
         * Add an event listener with automatic cleanup tracking
         * @param {Element} element - DOM element to attach listener to
         * @param {string} event - Event type
         * @param {Function} handler - Event handler function
         * @param {Object} options - Event listener options
         */
        addListener(element, event, handler, options = {}) {
            element.addEventListener(event, handler, options);
            
            // Track for cleanup
            const key = `${element.id || 'anonymous'}-${event}`;
            if (!this.listeners.has(key)) {
                this.listeners.set(key, []);
            }
            this.listeners.get(key).push({ element, event, handler, options });
        },
        
        /**
         * Remove all tracked event listeners
         */
        removeAllListeners() {
            this.listeners.forEach((listeners, key) => {
                listeners.forEach(({ element, event, handler, options }) => {
                    element.removeEventListener(event, handler, options);
                });
            });
            this.listeners.clear();
        },
        
        /**
         * Add an observer with automatic cleanup tracking
         * @param {MutationObserver} observer - Observer instance
         */
        addObserver(observer) {
            this.observers.add(observer);
        },
        
        /**
         * Disconnect all tracked observers
         */
        disconnectAllObservers() {
            this.observers.forEach(observer => {
                if (observer && typeof observer.disconnect === 'function') {
                    observer.disconnect();
                }
            });
            this.observers.clear();
        },
        
        /**
         * Add a timer with automatic cleanup tracking
         * @param {number} timerId - Timer ID from setTimeout or setInterval
         */
        addTimer(timerId) {
            this.timers.add(timerId);
        },
        
        /**
         * Clear all tracked timers
         */
        clearAllTimers() {
            this.timers.forEach(timerId => {
                clearTimeout(timerId);
                clearInterval(timerId);
            });
            this.timers.clear();
        },
        
        /**
         * Clean up all tracked resources
         */
        cleanup() {
            this.removeAllListeners();
            this.disconnectAllObservers();
            this.clearAllTimers();
        }
    };
    
    // Inject the widget when autoplay UI appears
    let autosellerWidgetObserver = null;
    let observerSetupAttempts = 0;
    
    function setupAutosellerWidgetObserver() {
        if (autosellerWidgetObserver || observerSetupAttempts >= MAX_OBSERVER_ATTEMPTS) return;
        
        observerSetupAttempts++;
        createAutosellerSessionWidget();
        updateAutosellerSessionWidget();
        
        if (typeof MutationObserver !== 'undefined') {
            // Track the last processed state to avoid unnecessary updates
            let lastWidgetState = { shouldShow: false, containerExists: false };
            
            autosellerWidgetObserver = new MutationObserver((mutations) => {
                // Early exit if no relevant mutations
                const hasRelevantMutations = mutations.some(mutation => {
                    // Check for changes to autoplay container or widget
                    return mutation.type === 'childList' || 
                           (mutation.type === 'attributes' && mutation.attributeName === 'data-minimized');
                });
                
                if (!hasRelevantMutations) return;
                
                // Debounce observer calls to prevent excessive processing
                if (autosellerWidgetObserver._debounceTimer) {
                    clearTimeout(autosellerWidgetObserver._debounceTimer);
                }
                
                const debounceTimer = setTimeout(() => {
                    // Cache DOM queries to avoid repeated lookups
                    const autoplayContainer = document.querySelector('.widget-bottom[data-minimized="false"]');
                    const widget = document.getElementById('autoseller-session-widget');
                    const widgetExists = !!widget;
                    
                    const settings = getCachedSettings();
                    const shouldShowWidget = settings.autosellChecked || settings.autosqueezeChecked;
                    const containerExists = !!autoplayContainer;
                    
                    // Only process if state has actually changed
                    const currentState = { shouldShow: shouldShowWidget, containerExists };
                    if (JSON.stringify(currentState) === JSON.stringify(lastWidgetState)) {
                        return;
                    }
                    
                    lastWidgetState = currentState;
                    
                    if (containerExists && shouldShowWidget && !widgetExists) {
                        createAutosellerSessionWidget();
                        updateAutosellerSessionWidget();
                    } else if ((!containerExists || !shouldShowWidget) && widgetExists) {
                        // Remove widget if it exists and shouldn't be shown
                        if (widget && widget.parentNode) {
                            widget.parentNode.removeChild(widget);
                            // Reset cached values when widget is removed
                            lastUpdateValues = { soldCount: -1, soldGold: -1, squeezedCount: -1, squeezedDust: -1 };
                        }
                    }
                }, OBSERVER_DEBOUNCE_MS); // Observer debounce
                
                // Track the timer for cleanup
                eventManager.addTimer(debounceTimer);
            });
            
            // Track the observer for cleanup
            eventManager.addObserver(autosellerWidgetObserver);
            
            // Optimize observer configuration to only watch relevant elements
            autosellerWidgetObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['data-minimized']
            });
        }
    }

    // =======================
    // 9. Initialization & Exports
    // =======================
    function initAutoseller() {
        console.log(`[${modName}] Loaded.`);
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
            // Debug and logging utilities
            setLogLevel: (level) => logger.setLevel(level),
            getDebugInfo: () => logger.getDebugInfo(),
            logState: () => logger.logState('exports'),
            cleanup: function() {
                // Cache DOM queries for cleanup
                const widget = document.getElementById('autoseller-session-widget');
                const navBtn = document.querySelector('.autoseller-nav-btn');
                const style = document.getElementById('autoseller-responsive-style');
                
                // Remove Autoseller session widget
                if (widget && widget.parentNode) widget.parentNode.removeChild(widget);
                
                // Remove nav button
                if (navBtn && navBtn.parentNode) navBtn.parentNode.removeChild(navBtn);
                
                // Remove injected style
                if (style && style.parentNode) style.parentNode.removeChild(style);
                
                // Clean up all tracked resources using event manager
                eventManager.cleanup();
                
                // Reset state
                stateManager.resetSession();
            }
        };
    }

})();