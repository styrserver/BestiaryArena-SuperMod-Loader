// =======================
// 0. Version & Metadata
// =======================

(function() {
    if (window.__autosellerLoaded) return;
    window.__autosellerLoaded = true;

    // =======================
    // 1. Configuration & Constants
    // =======================
    const modName = "Autoseller";
    const modDescription = "Automatically sells and squeezes creatures based on gene thresholds and experience levels.";
    
    // Core timing constants
    const AUTOSELLER_MIN_DELAY_MS = 5000;
    const MAX_OBSERVER_ATTEMPTS = 10;
    const OBSERVER_DEBOUNCE_MS = 100;
    const SETTINGS_SAVE_DELAY_MS = 300;
    
    // Rate limiting constants for all API operations
    const SELL_RATE_LIMIT = {
        MAX_MONSTERS_PER_10S: 15,
        DELAY_BETWEEN_SELLS_MS: 300,
        WINDOW_SIZE_MS: 10000,
        BATCH_SIZE: 5,
        BATCH_DELAY_MS: 1000
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
    // 2. Logging & Debugging
    // =======================
    
    const logger = {
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
        info: (functionName, message) => {
            console.info(`[${modName}][INFO][${functionName}] ${message}`);
        }
    };
    
    // =======================
    // 3. DOM Utilities & Settings
    // =======================
    
    function queryElement(selector, context = document) {
        return context.querySelector(selector);
    }
    
    function queryAllElements(selector, context = document) {
        return context.querySelectorAll(selector);
    }
    
    let settingsCache = null;
    
    function getSettings() {
        if (settingsCache) return settingsCache;
        
        if (typeof context !== 'undefined' && context.config && Object.keys(context.config).length > 0) {
            settingsCache = { ...DEFAULT_SETTINGS, ...context.config };
            return settingsCache;
        }
        
        try {
            const stored = JSON.parse(localStorage.getItem('autoseller-settings') || '{}');
            settingsCache = { ...DEFAULT_SETTINGS, ...stored };
        } catch (e) { 
            logger.warn('getSettings', 'Failed to parse settings from localStorage', e);
            settingsCache = { ...DEFAULT_SETTINGS };
        }
        
        return settingsCache;
    }
    
    function clearSettingsCache() {
        settingsCache = null;
    }
    
    function setSettings(newSettings) {
        settingsCache = { ...getSettings(), ...newSettings };
        
        debouncedSaveSettings();
        
        if (typeof api !== 'undefined' && api.service && typeof context !== 'undefined' && context.hash) {
            api.service.updateScriptConfig(context.hash, settingsCache);
        }
        
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
            localStorage.setItem('autoseller-settings', JSON.stringify(settingsCache));
        } catch (e) {
            logger.warn('debouncedSaveSettings', 'Failed to save settings to localStorage', e);
        }
    }, SETTINGS_SAVE_DELAY_MS);
    
    if (!localStorage.getItem('autoseller-settings') && !(typeof context !== 'undefined' && context.config && Object.keys(context.config).length > 0)) {
        settingsCache = { ...DEFAULT_SETTINGS };
        localStorage.setItem('autoseller-settings', JSON.stringify(settingsCache));
    } else {
        getSettings();
    }

    // =======================
    // 4. Utility Functions
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
        
        const sellEnabled = settings.autosellChecked;
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
            
            if (monster.locked) {
                continue;
            }
            
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
    // 5. API Utilities
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
                logger.warn('fetchDaycareData', 'Could not determine player name.');
                return daycareCache.data || [];
            }
            
            const url = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=${encodeURIComponent(JSON.stringify({"0":{json:myName}}))}`;
            const result = await apiRequest(url);
            
            if (!result.success) {
                stateManager.updateErrorStats('fetchErrors');
                logger.warn('fetchDaycareData', 'API request failed, using cached data');
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
            logger.warn('hasDaycareIconInInventory', 'Error checking for daycare icon in DOM', e);
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
            logger.warn('isCreatureInDaycare', `Error checking daycare status for monster ${monsterId}`, e);
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
                logger.warn('fetchServerMonsters', 'Could not determine player name.');
                return serverMonsterCache.data || [];
            }
            
            const url = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=${encodeURIComponent(JSON.stringify({"0":{json:myName}}))}`;
            const result = await apiRequest(url);
            
            if (!result.success) {
                stateManager.updateErrorStats('fetchErrors');
                logger.warn('fetchServerMonsters', 'API request failed, using cached data');
                return serverMonsterCache.data || [];
            }
            
            const monsters = result.data?.[0]?.result?.data?.json?.monsters || [];
            
            serverMonsterCache.set(monsters);
            
            return monsters;
        } finally {
            apiMutex.release('monsters');
        }
    }
    
    function removeMonstersFromLocalInventory(idsToRemove) {
        try {
            if (!Array.isArray(idsToRemove) || idsToRemove.length === 0) {
                logger.warn('removeMonstersFromLocalInventory', 'Invalid or empty IDs array provided');
                return;
            }
            
            if (!globalThis.state) {
                logger.warn('removeMonstersFromLocalInventory', 'Global state not available');
                return;
            }
            
            const player = globalThis.state.player;
            if (!player) {
                logger.warn('removeMonstersFromLocalInventory', 'Player state not available');
                return;
            }
            
            if (typeof player.send !== 'function') {
                logger.warn('removeMonstersFromLocalInventory', 'Player send method not available');
                return;
            }
            
            const currentState = player.getSnapshot?.();
            if (!currentState?.context?.monsters) {
                logger.warn('removeMonstersFromLocalInventory', 'Monsters array not available in current state');
                return;
            }
            
            player.send({
                type: "setState",
                fn: (prev) => {
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
            logger.warn('removeMonstersFromLocalInventory', `Failed to update local inventory for IDs: ${idsToRemove.join(', ')}`, e);
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
            const isAutosell = warningText.includes('sell');
            const tooltipText = isAutosell 
                ? 'The script will sell all creatures in your inventory that are:\n- Unlocked creatures,\n- Level 10 or below (52251 experience),\n- Not in daycare.'
                : 'The script will squeeze all creatures in your inventory that are:\n- Unlocked creatures,\n- Within the specified gene range,\n- Not in daycare.';
            
            allSpan.title = tooltipText;
            
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
    
    function createMinCountRow(opts) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.width = '100%';
        row.style.marginBottom = '12px';
        
        const minCountLabel = document.createElement('span');
        minCountLabel.textContent = 'Trigger when:';
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
        minCountSuffix.textContent = 'creatures';
        minCountSuffix.className = 'pixel-font-16';
        minCountSuffix.style.color = '#cccccc';
        row.appendChild(minCountSuffix);
        
        return { row, minCountInput, validateMinCountInput };
    }
    
    function createSettingsSection(opts) {
        const section = document.createElement('div');
        
        const descWrapper = createDescriptionRow(opts.desc);
        section.appendChild(descWrapper);
        
        const warningText = opts.summaryType === 'Autosell' 
            ? 'This will sell ALL creatures from your inventory!'
            : 'This will squeeze ALL creatures from your inventory!';
        const warningWrapper = createWarningRow(warningText, true);
        section.appendChild(warningWrapper);
        
        const { row: row1, checkbox, label } = createCheckboxRow(opts.persistKey, opts.label, opts.icon);
        section.appendChild(row1);
        
        const { row: row2, inputMin, inputMax } = createGeneInputRow(opts);
        section.appendChild(row2);
        
        const { row: row3, minCountInput } = createMinCountRow(opts);
        section.appendChild(row3);
        
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
        const saved = getSettings();
        if (typeof saved[opts.persistKey + 'Checked'] === 'boolean') checkbox.checked = saved[opts.persistKey + 'Checked'];
        if (typeof saved[opts.persistKey + 'GenesMin'] === 'number') inputMin.value = saved[opts.persistKey + 'GenesMin'];
        if (typeof saved[opts.persistKey + 'GenesMax'] === 'number') inputMax.value = saved[opts.persistKey + 'GenesMax'];
        if (typeof saved[opts.persistKey + 'MinCount'] === 'number') minCountInput.value = saved[opts.persistKey + 'MinCount'];
        function saveSettings() {
            setSettings({
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
                logger.warn('safeGetCreatureCount', `Error getting creature count for ${type}: ${e?.message || 'Unknown error'}`, e);
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

        return section;
    }

    // =======================
    // 7. State Management & Processing
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
    
    async function processEligibleMonsters(monsters, type) {
        try {
            const settings = getSettings();
            
            if (!monsters) {
                monsters = await fetchServerMonsters();
            }
            if (!Array.isArray(monsters)) {
                logger.warn(`processEligibleMonsters`, 'Could not access monster list.');
                return;
            }
            
            let { toSqueeze, toSell } = await getEligibleMonsters(settings, monsters);
            
            if (type === 'sell') {
                toSell = toSell.filter(m => !stateManager.isProcessed(m.id));
                if (!toSell.length) return;
                
                const batchSize = SELL_RATE_LIMIT.BATCH_SIZE;
                for (let i = 0; i < toSell.length; i += batchSize) {
                    const batch = toSell.slice(i, i + batchSize);
                    
                    for (const monster of batch) {
                        const id = monster.id;
                        
                        await apiRateLimiter.waitForSlot();
                        apiRateLimiter.recordRequest();
                        
                        const url = 'https://bestiaryarena.com/api/trpc/game.sellMonster?batch=1';
                        const body = { "0": { json: id } };
                        const result = await apiRequest(url, { method: 'POST', body });
                    
                        if (!result.success && result.status === 429) {
                            logger.warn('processEligibleMonsters', `Rate limited (429) for monster ${id}, waiting...`);
                            await new Promise(resolve => setTimeout(resolve, 5000));
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
                        } else if (!result.success && result.status === 404) {
                            if (result.isNotFound) {
                                stateManager.markProcessed([id]);
                                removeMonstersFromLocalInventory([id]);
                            }
                        } else if (!result.success) {
                            logger.warn('processEligibleMonsters', `Sell API failed for ID ${id}: HTTP ${result.status}`);
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, SELL_RATE_LIMIT.DELAY_BETWEEN_SELLS_MS));
                    }
                    
                    if (i + batchSize < toSell.length) {
                        await new Promise(resolve => setTimeout(resolve, SELL_RATE_LIMIT.BATCH_DELAY_MS));
                    }
                }
            } else if (type === 'squeeze') {
                if (!toSqueeze.length) return;
                
                for (let i = 0; i < toSqueeze.length; i += SELL_RATE_LIMIT.BATCH_SIZE) {
                    const batch = toSqueeze.slice(i, i + SELL_RATE_LIMIT.BATCH_SIZE);
                    const ids = batch.map(m => m.id).filter(Boolean);
                    if (!ids.length) continue;
                    
                    await apiRateLimiter.waitForSlot();
                    apiRateLimiter.recordRequest();
                    
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
                        if (result.isNotFound) {
                            stateManager.markProcessed(ids);
                            removeMonstersFromLocalInventory(ids);
                        }
                    } else if (!result.success) {
                        logger.warn('processEligibleMonsters', `Squeeze API failed: HTTP ${result.status}`);
                        continue;
                    }
                
                    if (i + SELL_RATE_LIMIT.BATCH_SIZE < toSqueeze.length) {
                        await new Promise(res => setTimeout(res, SELL_RATE_LIMIT.BATCH_DELAY_MS));
                    }
                }
            }
        } catch (e) {
            logger.error(`processEligibleMonsters`, `Failed to ${type} monsters. Error: ${e.message}`, e);
            stateManager.updateErrorStats(`${type}Errors`);
        }
    }

    // =======================
    // 8. Modal Management
    // =======================
    
    function openAutosellerModal() {
        clearSettingsCache();
        
        if (typeof api !== 'undefined' && api && api.ui && api.ui.components && api.ui.components.createModal) {
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
            
            const col1 = createBox({ 
                title: 'Autosell', 
                content: autosellSection, 
                icon: 'https://bestiaryarena.com/assets/icons/goldpile.png' 
            });
            col1.style.width = '240px';
            col1.style.minWidth = '240px';
            col1.style.maxWidth = '240px';
            col1.style.height = '100%';
            col1.style.flex = '0 0 240px';
            
            const col2 = createBox({ 
                title: 'Autosqueeze', 
                content: autosqueezeSection, 
                icon: 'https://bestiaryarena.com/assets/icons/dust.png' 
            });
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
                    // Modal cleanup handled automatically
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
    // 9. UI Injection
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
            btn.innerHTML = `<img src="https://bestiaryarena.com/assets/icons/autoplay.png" alt="Autoseller" width="11" height="11" class="pixelated"><span class="hidden sm:inline">Autoseller</span>`;
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
        const isActive = settings.autosellChecked || settings.autosqueezeChecked;
        
        btn.style.color = isActive ? '#22c55e' : '#ef4444';
    }

    // =======================
    // 10. Autoseller Session Widget
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
        const settings = getSettings();
        const shouldShowWidget = settings.autosellChecked || settings.autosqueezeChecked;
        
        const existingWidget = queryElement(`#${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET}`);
        if (!shouldShowWidget) {
            if (existingWidget && existingWidget.parentNode) {
                existingWidget.parentNode.removeChild(existingWidget);
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
            // Don't log warning - this is expected when autoplay is not active
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
        
        // Inject styles when widget is actually created
        injectAutosellerWidgetStyles();
        
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


    
    function updateAutosellerSessionWidget() {
        const widget = queryElement(`#${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET}`);
        if (!widget) return;
        
        const statEls = widget._statEls;
        if (!statEls) return;
        
        const currentValues = stateManager.getSessionStats();
        
        // Update stats directly
        if (statEls.soldCount) statEls.soldCount.textContent = `${currentValues.soldCount}`;
        if (statEls.soldGold) {
            const goldText = statEls.soldGold.querySelector('span');
            if (goldText) goldText.textContent = `${currentValues.soldGold}`;
        }
        if (statEls.squeezedCount) statEls.squeezedCount.textContent = `${currentValues.squeezedCount}`;
        if (statEls.squeezedDust) {
            const dustText = statEls.squeezedDust.querySelector('span');
            if (dustText) dustText.textContent = `${currentValues.squeezedDust}`;
        }
    }

    // =======================
    // 11. Widget Observer
    // =======================
    
    // Inject the widget when autoplay UI appears
    let autosellerWidgetObserver = null;
    let observerSetupAttempts = 0;
    let isObserverActive = false;
    
    function setupAutosellerWidgetObserver() {
        if (autosellerWidgetObserver || observerSetupAttempts >= MAX_OBSERVER_ATTEMPTS || isObserverActive) return;
        
        observerSetupAttempts++;
        isObserverActive = true;
        
        if (typeof MutationObserver !== 'undefined') {
            let debounceTimer = null;
            
            autosellerWidgetObserver = new MutationObserver((mutations) => {
                const hasRelevantMutations = mutations.some(mutation => {
                    return mutation.type === 'childList' || 
                           (mutation.type === 'attributes' && mutation.attributeName === 'data-minimized');
                });
                
                if (!hasRelevantMutations) return;
                
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
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
                    
                    const widget = queryElement(`#${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET}`);
                    const widgetExists = !!widget;
                    
                    const settings = getSettings();
                    const shouldShowWidget = settings.autosellChecked || settings.autosqueezeChecked;
                    const containerExists = !!autoplayContainer;
                    
                    if (containerExists && shouldShowWidget && !widgetExists) {
                        createAutosellerSessionWidget();
                        updateAutosellerSessionWidget();
                    } else if ((!containerExists || !shouldShowWidget) && widgetExists) {
                        if (widget && widget.parentNode) {
                            widget.parentNode.removeChild(widget);
                        }
                    }
                }, OBSERVER_DEBOUNCE_MS);
            });
            
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
    // 12. Initialization & Exports
    // =======================
    
    function initAutoseller() {
        addAutosellerNavButton();
        setupAutosellerWidgetObserver();
        
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
                    
                    const settings = getSettings();
                    
                    if (!settings.autosellChecked && !settings.autosqueezeChecked) {
                        return;
                    }
                    
                    await processEligibleMonsters(inventorySnapshot, 'squeeze');
                    await processEligibleMonsters(inventorySnapshot, 'sell');
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
            },
            cleanup: function() {
                const widget = document.getElementById(UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET);
                const navBtn = document.querySelector(`.${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_NAV_BTN}`);
                const style = document.getElementById(UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_RESPONSIVE_STYLE);
                
                if (widget && widget.parentNode) widget.parentNode.removeChild(widget);
                if (navBtn && navBtn.parentNode) navBtn.parentNode.removeChild(navBtn);
                if (style && style.parentNode) style.parentNode.removeChild(style);
                
                if (autosellerWidgetObserver) {
                    autosellerWidgetObserver.disconnect();
                    autosellerWidgetObserver = null;
                }
                isObserverActive = false;
                observerSetupAttempts = 0;
                
                serverMonsterCache.clear();
                daycareCache.clear();
                stateManager.resetSession();
            }
        };
    }

})();