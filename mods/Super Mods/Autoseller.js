// =======================
// 0. Version & Metadata
// =======================

(function() {
    console.log('[Autoseller] Script loading...');
    
    if (window.__autosellerLoaded) return;
    window.__autosellerLoaded = true;
    
    console.log('[Autoseller] Script initialized successfully');

    // =======================
    // 1. Configuration & Constants
    // =======================
    const modName = "Autoseller";
    const modDescription = "Automatically sells and squeezes creatures based on gene thresholds and experience levels. Shiny creatures are protected.";
    
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
        MODAL_HEIGHT: 490,
        MODAL_CONTENT_HEIGHT: 410,
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
    
    // Cleanup references
    let boardSubscription1 = null;
    let boardSubscription2 = null;
    let playerSubscription = null;
    let debounceTimer = null;
    
    // Event handler references for cleanup
    let emitNewGameHandler1 = null;
    let emitEndGameHandler1 = null;
    
    // Global references for cleanup
    let originalFetch = null;
    let messageListener = null;

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

    // Default Settings
    const DEFAULT_SETTINGS = {
        autoplantChecked: false,
        autoplantAutocollectChecked: false,
        autosellChecked: false,
        autosqueezeChecked: false,
        lastActiveMode: 'autosell', // Track last active mode ('autosell' or 'autoplant')
        autosellGenesMin: UI_CONSTANTS.SELL_GENE_MIN,
        autosellGenesMax: UI_CONSTANTS.SELL_GENE_MAX,
        autosqueezeGenesMin: UI_CONSTANTS.SQUEEZE_GENE_MIN,
        autosqueezeGenesMax: UI_CONSTANTS.SQUEEZE_GENE_MAX,
        autosellMinCount: 1,
        autosqueezeMinCount: 1,
        autosellMaxExp: UI_CONSTANTS.MAX_EXP_DEFAULT,
        autoplantIgnoreList: [],
        autoplantGenesMin: 80,
        autoplantKeepGenesEnabled: true,
        autoplantAlwaysDevourBelow: 49,
        autoplantAlwaysDevourEnabled: false
    };
    
    // =======================
    // 2. DOM Utilities & Settings
    // =======================
    
    function queryElement(selector, context = document) {
        return context.querySelector(selector);
    }
    
    function queryAllElements(selector, context = document) {
        return context.querySelectorAll(selector);
    }
    
    function getSettings() {
        try {
            const stored = JSON.parse(localStorage.getItem('autoseller-settings') || '{}');
            return { ...DEFAULT_SETTINGS, ...stored };
        } catch (e) { 
            console.warn(`[${modName}][WARN][getSettings] Failed to parse settings from localStorage`, e);
            return { ...DEFAULT_SETTINGS };
        }
    }
    
    function setSettings(newSettings) {
        const updatedSettings = { ...getSettings(), ...newSettings };
        
        // Save directly to localStorage (single source of truth)
        try {
            localStorage.setItem('autoseller-settings', JSON.stringify(updatedSettings));
        } catch (e) {
            console.warn(`[${modName}][WARN][setSettings] Failed to save settings to localStorage`, e);
        }
        
        updateAutosellerNavButtonColor();
        updateAutosellerSessionWidget();
    }
    
    // Initialize localStorage with defaults if not exists
    if (!localStorage.getItem('autoseller-settings')) {
        localStorage.setItem('autoseller-settings', JSON.stringify(DEFAULT_SETTINGS));
    }

    // =======================
    // 3. Core Utility Functions
    // =======================
    
    function getGenes(m) {
        return (m.hp || 0) + (m.ad || 0) + (m.ap || 0) + (m.armor || 0) + (m.magicResist || 0);
    }
    
    // Dragon Plant Helper Functions
    const getPlantGold = () => globalThis.state?.player?.getSnapshot?.()?.context?.questLog?.plant?.gold;
    
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
                // Never squeeze shiny creatures
                if (monster.shiny === true) {
                    console.log(`[Autoseller] Skipping shiny creature for squeeze: ${monster.name || 'unknown'}`);
                    continue;
                }
                toSqueeze.push(monster);
            }
            else if (sellEnabled && genes >= sellMinGenes && genes <= sellMaxGenes) {
                // Never sell shiny creatures
                if (monster.shiny === true) {
                    console.log(`[Autoseller] Skipping shiny creature for sell: ${monster.name || 'unknown'}`);
                    continue;
                }
                
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
    
    function removeMonstersFromLocalInventory(idsToRemove) {
        try {
            if (!Array.isArray(idsToRemove) || idsToRemove.length === 0) {
                console.warn(`[${modName}][WARN][removeMonstersFromLocalInventory] Invalid or empty IDs array provided`);
                return;
            }
            
            if (!globalThis.state) {
                console.warn(`[${modName}][WARN][removeMonstersFromLocalInventory] Global state not available`);
                return;
            }
            
            const player = globalThis.state.player;
            if (!player) {
                console.warn(`[${modName}][WARN][removeMonstersFromLocalInventory] Player state not available`);
                return;
            }
            
            if (typeof player.send !== 'function') {
                console.warn(`[${modName}][WARN][removeMonstersFromLocalInventory] Player send method not available`);
                return;
            }
            
            const currentState = player.getSnapshot?.();
            if (!currentState?.context?.monsters) {
                console.warn(`[${modName}][WARN][removeMonstersFromLocalInventory] Monsters array not available in current state`);
                return;
            }
            
            player.send({
                type: "setState",
                fn: (prev) => {
                    if (!prev || !Array.isArray(prev.monsters)) {
                        console.warn(`[${modName}][WARN][removeMonstersFromLocalInventory] Previous state or monsters array not available`);
                        return prev;
                    }
                    
                    return {
                        ...prev,
                        monsters: prev.monsters.filter(m => !idsToRemove.includes(m.id))
                    };
                },
            });
        } catch (e) {
            console.warn(`[${modName}][WARN][removeMonstersFromLocalInventory] Failed to update local inventory for IDs: ${idsToRemove.join(', ')}`, e);
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
        const parts = warningText.split('ALL');
        const beforeAll = parts[0];
        const afterAll = parts[1];
        
        const allSpan = createElement('span', { 
            text: 'ALL',
            styles: { 
                textDecoration: 'underline',
                color: '#4A90E2',
                cursor: showTooltip ? 'help' : 'default'
            }
        });
        
        if (showTooltip) {
            const isAutosell = warningText.includes('sell');
            const tooltipText = isAutosell 
                ? 'The script will sell all creatures in your inventory that are:\n- Unlocked creatures,\n- Level 10 or below (52251 experience),\n- Not in daycare,\n- Not shiny.'
                : 'The script will squeeze all creatures in your inventory that are:\n- Unlocked creatures,\n- Within the specified gene range,\n- Not in daycare,\n- Not shiny.';
            
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
    
    function createAutplantPlaceholder() {
        const placeholder = document.createElement('div');
        placeholder.style.display = 'flex';
        placeholder.style.flexDirection = 'column';
        placeholder.style.alignItems = 'flex-start';
        placeholder.style.justifyContent = 'flex-start';
        placeholder.style.height = '100%';
        placeholder.style.padding = '4px';
        placeholder.style.gap = '6px';
        
        // Add the checkbox at the top
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'mt-0.5 px-0.5';
        
        const checkboxLabel = document.createElement('label');
        checkboxLabel.className = 'pixel-font-16 flex text-whiteBrightest items-center gap-1.5';
        checkboxLabel.style.color = '#ffffff';
        checkboxLabel.style.display = 'flex';
        checkboxLabel.style.alignItems = 'center';
        checkboxLabel.style.gap = '6px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'autoplant-checkbox';
        checkbox.className = 'pixel-font-16';
        checkbox.tabIndex = 1;
        checkbox.style.marginRight = '8px';
        
        // Set initial state from saved settings
        const initialSettings = getSettings();
        checkbox.checked = initialSettings.autoplantChecked !== undefined ? initialSettings.autoplantChecked : false;
        
        // Store reference to this checkbox globally for mutual exclusivity
        window.autoplantCheckbox = checkbox;
        
        // Add change handler for localStorage-first approach
        checkbox.addEventListener('change', () => {
            console.log('[Autoplant] Checkbox changed, checked:', checkbox.checked);
            
            // Save to localStorage and track last active mode
            if (checkbox.checked) {
                setSettings({ autoplantChecked: checkbox.checked, lastActiveMode: 'autoplant' });
            } else {
                setSettings({ autoplantChecked: checkbox.checked });
            }
            
            // Update status text
            updateAutoplantStatus();
            
            // Update plant monster filter based on ignore list
            updatePlantMonsterFilter(selectedCreatures);
            
            // Update widget label if it exists
            updateAutosellerSessionWidget();
            
            // Apply localStorage to game checkbox
            applyLocalStorageToGameCheckbox();
            
            // Handle mutual exclusivity
            if (checkbox.checked) {
                console.log('[Autoplant] Being checked, looking for Autosell checkbox...');
                setTimeout(() => {
                    // Try to find the Autosell checkbox using stored reference or DOM search
                    let autosellCheckbox = window.autosellCheckbox;
                    if (!autosellCheckbox) {
                        // Fallback to DOM search
                        autosellCheckbox = document.querySelector('input[id*="autosell"][type="checkbox"]');
                    }
                    console.log('[Autoplant] Found Autosell checkbox:', autosellCheckbox);
                    if (autosellCheckbox) {
                        console.log('[Autoplant] Autosell checkbox checked state:', autosellCheckbox.checked);
                        if (autosellCheckbox.checked) {
                            console.log('[Autoplant] Unchecking Autosell checkbox');
                            autosellCheckbox.checked = false;
                            autosellCheckbox.dispatchEvent(new Event('change'));
                        } else {
                            console.log('[Autoplant] Autosell checkbox already unchecked');
                        }
                    } else {
                        console.log('[Autoplant] Autosell checkbox not found');
                    }
                }, 0);
            } else {
                console.log('[Autoplant] Being unchecked, no action needed');
            }
        });
        
        checkboxLabel.appendChild(checkbox);
        
        const labelText = document.createElement('span');
        labelText.textContent = 'Enable Dragon Plant';
        checkboxLabel.appendChild(labelText);
        
        checkboxContainer.appendChild(checkboxLabel);
        placeholder.appendChild(checkboxContainer);

        // Autocollect Dragon Plant checkbox
        const autocollectCheckboxContainer = document.createElement('div');
        autocollectCheckboxContainer.className = 'mt-0.5 px-0.5';
        
        const autocollectCheckboxLabel = document.createElement('label');
        autocollectCheckboxLabel.className = 'pixel-font-16 flex text-whiteBrightest items-center gap-1.5';
        autocollectCheckboxLabel.style.color = '#ffffff';
        autocollectCheckboxLabel.style.display = 'flex';
        autocollectCheckboxLabel.style.alignItems = 'center';
        autocollectCheckboxLabel.style.gap = '6px';
        
        const autocollectCheckbox = document.createElement('input');
        autocollectCheckbox.type = 'checkbox';
        autocollectCheckbox.id = 'autoplant-autocollect-checkbox';
        autocollectCheckbox.className = 'pixel-font-16';
        autocollectCheckbox.tabIndex = 2;
        autocollectCheckbox.style.marginRight = '8px';
        
        // Set initial state from saved settings
        autocollectCheckbox.checked = initialSettings.autoplantAutocollectChecked !== undefined ? initialSettings.autoplantAutocollectChecked : false;
        
        autocollectCheckbox.addEventListener('change', () => {
            setSettings({ autoplantAutocollectChecked: autocollectCheckbox.checked });
        });
        
        autocollectCheckboxLabel.appendChild(autocollectCheckbox);
        
        const autocollectLabelText = document.createElement('span');
        autocollectLabelText.textContent = 'Autocollect Dragon Plant';
        autocollectCheckboxLabel.appendChild(autocollectLabelText);
        
        autocollectCheckboxContainer.appendChild(autocollectCheckboxLabel);
        placeholder.appendChild(autocollectCheckboxContainer);

        // Creature selection state
        let availableCreatures = [...getAllAutoplantCreatures()];
        let selectedCreatures = [];
        
        // Load ignore list from settings
        const savedSettings = getSettings();
        if (savedSettings.autoplantIgnoreList && Array.isArray(savedSettings.autoplantIgnoreList)) {
            selectedCreatures = [...savedSettings.autoplantIgnoreList];
            // Remove selected creatures from available list
            availableCreatures = availableCreatures.filter(c => !selectedCreatures.includes(c));
        }
        
        // Ensure both lists are sorted alphabetically
        availableCreatures.sort();
        selectedCreatures.sort();
        
        // Function to save ignore list to settings
        function saveIgnoreList() {
            setSettings({ autoplantIgnoreList: [...selectedCreatures] });
        }

        // Function to render the creature columns
        function renderCreatureColumns() {
            // Get or create the columns container
            let columnsContainer = placeholder.querySelector('.creature-columns-container');
            
            if (!columnsContainer) {
                // Create the container only if it doesn't exist
                columnsContainer = document.createElement('div');
                columnsContainer.className = 'creature-columns-container';
                columnsContainer.style.display = 'flex';
                columnsContainer.style.gap = '8px';
                columnsContainer.style.justifyContent = 'center';
                columnsContainer.style.height = '140px';
                columnsContainer.style.minHeight = '140px';
                columnsContainer.style.maxHeight = '140px';
                columnsContainer.style.flexShrink = '0';
                columnsContainer.style.width = '100%';
                
                // Insert before the status area to maintain DOM order (if it exists)
                const statusElement = placeholder.querySelector('#autoplant-status');
                if (statusElement && statusElement.parentElement) {
                    placeholder.insertBefore(columnsContainer, statusElement.parentElement);
                } else {
                    // If status area doesn't exist yet, just append to placeholder
                    placeholder.appendChild(columnsContainer);
                }
            } else {
                // Clear existing content but keep the container
                columnsContainer.innerHTML = '';
            }
            
            // Debug: Log current state
            console.log('[Autoseller] Rendering creature columns - Available:', availableCreatures.length, 'Selected:', selectedCreatures.length);

            // Available creatures column
            const availableBox = createAutoplantCreaturesBox({
                title: 'Creatures',
                items: availableCreatures,
                selectedCreature: null,
                onSelectCreature: (creatureName) => {
                    console.log('[Autoseller] Moving creature to ignore list:', creatureName);
                    console.log('[Autoseller] Before - Available:', availableCreatures.length, 'Selected:', selectedCreatures.length);
                    
                    // Move creature from available to selected
                    availableCreatures = availableCreatures.filter(c => c !== creatureName);
                    selectedCreatures.push(creatureName);
                    
                    // Sort ignore list to maintain alphabetical order
                    selectedCreatures.sort();
                    
                    console.log('[Autoseller] After - Available:', availableCreatures.length, 'Selected:', selectedCreatures.length);
                    
                    renderCreatureColumns();
                    
                    // Save ignore list to settings
                    saveIgnoreList();
                    
                    // Update plant monster filter with new ignore list
                    updatePlantMonsterFilter(selectedCreatures);
                }
            });
            availableBox.style.width = '125px';
            availableBox.style.height = '140px';
            availableBox.style.minHeight = '0';

            // Selected creatures column
            const selectedBox = createAutoplantCreaturesBox({
                title: 'Ignore List',
                items: selectedCreatures,
                selectedCreature: null,
                onSelectCreature: (creatureName) => {
                    console.log('[Autoseller] Moving creature back to available list:', creatureName);
                    console.log('[Autoseller] Before - Available:', availableCreatures.length, 'Selected:', selectedCreatures.length);
                    
                    // Move creature from selected back to available
                    selectedCreatures = selectedCreatures.filter(c => c !== creatureName);
                    availableCreatures.push(creatureName);
                    
                    // Sort available creatures to maintain alphabetical order
                    availableCreatures.sort();
                    
                    console.log('[Autoseller] After - Available:', availableCreatures.length, 'Selected:', selectedCreatures.length);
                    
                    renderCreatureColumns();
                    
                    // Save ignore list to settings
                    saveIgnoreList();
                    
                    // Update plant monster filter with new ignore list
                    updatePlantMonsterFilter(selectedCreatures);
                }
            });
            selectedBox.style.width = '125px';
            selectedBox.style.height = '140px';
            selectedBox.style.minHeight = '0';

            columnsContainer.appendChild(availableBox);
            columnsContainer.appendChild(selectedBox);
        }

        // Initial render
        renderCreatureColumns();

        // Gene threshold inputs container
        const genesMainContainer = document.createElement('div');
        genesMainContainer.style.display = 'flex';
        genesMainContainer.style.flexDirection = 'column';
        genesMainContainer.style.gap = '6px';
        genesMainContainer.style.marginTop = '4px';

        // Min Genes input
        const genesContainer = document.createElement('div');
        genesContainer.style.display = 'flex';
        genesContainer.style.alignItems = 'center';
        genesContainer.style.justifyContent = 'flex-start';
        genesContainer.style.gap = '6px';

        const keepGenesCheckbox = document.createElement('input');
        keepGenesCheckbox.type = 'checkbox';
        keepGenesCheckbox.id = 'autoplant-keep-genes-checkbox';
        keepGenesCheckbox.checked = initialSettings.autoplantKeepGenesEnabled !== undefined ? initialSettings.autoplantKeepGenesEnabled : true;
        keepGenesCheckbox.style.cursor = 'pointer';

        keepGenesCheckbox.addEventListener('change', () => {
            setSettings({ autoplantKeepGenesEnabled: keepGenesCheckbox.checked });
            updatePlantMonsterFilter(selectedCreatures);
        });

        const genesLabel = document.createElement('label');
        genesLabel.className = 'pixel-font-14';
        genesLabel.textContent = 'Keep genes';
        genesLabel.style.fontSize = '12px';
        genesLabel.style.color = '#ffe066';
        genesLabel.style.cursor = 'pointer';
        genesLabel.htmlFor = 'autoplant-keep-genes-checkbox';

        const genesInput = document.createElement('input');
        genesInput.type = 'number';
        genesInput.min = '5';
        genesInput.max = '100';
        genesInput.step = '1';
        genesInput.value = initialSettings.autoplantGenesMin !== undefined ? initialSettings.autoplantGenesMin : 80;
        genesInput.style.width = '48px';
        genesInput.style.padding = '2px 4px';
        genesInput.style.fontSize = '12px';
        genesInput.style.textAlign = 'center';
        genesInput.style.backgroundColor = '#2a2a2a';
        genesInput.style.color = '#ffe066';
        genesInput.style.border = '1px solid #555';
        genesInput.style.borderRadius = '3px';

        genesInput.addEventListener('change', () => {
            const value = parseInt(genesInput.value) || 80;
            const clampedValue = Math.max(5, Math.min(100, value));
            genesInput.value = clampedValue;
            setSettings({ autoplantGenesMin: clampedValue });
            updatePlantMonsterFilter(selectedCreatures);
        });

        const genesPercent = document.createElement('span');
        genesPercent.className = 'pixel-font-14';
        genesPercent.textContent = '% and above.';
        genesPercent.style.fontSize = '12px';
        genesPercent.style.color = '#ffe066';

        genesContainer.appendChild(keepGenesCheckbox);
        genesContainer.appendChild(genesLabel);
        genesContainer.appendChild(genesInput);
        genesContainer.appendChild(genesPercent);

        // Always devour below input
        const devourContainer = document.createElement('div');
        devourContainer.style.display = 'flex';
        devourContainer.style.alignItems = 'center';
        devourContainer.style.justifyContent = 'flex-start';
        devourContainer.style.gap = '6px';

        const devourCheckbox = document.createElement('input');
        devourCheckbox.type = 'checkbox';
        devourCheckbox.id = 'autoplant-devour-checkbox';
        devourCheckbox.checked = initialSettings.autoplantAlwaysDevourEnabled !== undefined ? initialSettings.autoplantAlwaysDevourEnabled : false;
        devourCheckbox.style.cursor = 'pointer';

        devourCheckbox.addEventListener('change', () => {
            setSettings({ autoplantAlwaysDevourEnabled: devourCheckbox.checked });
            updatePlantMonsterFilter(selectedCreatures);
        });

        const devourLabel = document.createElement('label');
        devourLabel.className = 'pixel-font-14';
        devourLabel.textContent = 'Devour genes';
        devourLabel.style.fontSize = '12px';
        devourLabel.style.color = '#ffe066';
        devourLabel.style.cursor = 'pointer';
        devourLabel.htmlFor = 'autoplant-devour-checkbox';

        const devourInput = document.createElement('input');
        devourInput.type = 'number';
        devourInput.min = '5';
        devourInput.max = '79';
        devourInput.step = '1';
        devourInput.value = initialSettings.autoplantAlwaysDevourBelow !== undefined ? initialSettings.autoplantAlwaysDevourBelow : 49;
        devourInput.style.width = '48px';
        devourInput.style.padding = '2px 4px';
        devourInput.style.fontSize = '12px';
        devourInput.style.textAlign = 'center';
        devourInput.style.backgroundColor = '#2a2a2a';
        devourInput.style.color = '#ffe066';
        devourInput.style.border = '1px solid #555';
        devourInput.style.borderRadius = '3px';

        devourInput.addEventListener('change', () => {
            const value = parseInt(devourInput.value) || 49;
            const clampedValue = Math.max(5, Math.min(79, value));
            devourInput.value = clampedValue;
            setSettings({ autoplantAlwaysDevourBelow: clampedValue });
            updatePlantMonsterFilter(selectedCreatures);
        });

        const devourPercent = document.createElement('span');
        devourPercent.className = 'pixel-font-14';
        devourPercent.textContent = '% and below.';
        devourPercent.style.fontSize = '12px';
        devourPercent.style.color = '#ffe066';

        devourContainer.appendChild(devourCheckbox);
        devourContainer.appendChild(devourLabel);
        devourContainer.appendChild(devourInput);
        devourContainer.appendChild(devourPercent);

        genesMainContainer.appendChild(genesContainer);
        genesMainContainer.appendChild(devourContainer);
        placeholder.appendChild(genesMainContainer);

        // Add status bar under the columns
        const statusArea = document.createElement('div');
        statusArea.style.display = 'flex';
        statusArea.style.flexDirection = 'column';
        statusArea.style.justifyContent = 'flex-end';
        statusArea.style.height = '48px';
        statusArea.style.marginTop = 'auto';
        statusArea.style.width = '100%';

        const separator = document.createElement('div');
        separator.className = 'separator my-2.5';
        separator.setAttribute('role', 'none');
        separator.style.margin = '6px 0px';

        const summary = document.createElement('div');
        summary.className = 'pixel-font-16';
        summary.style.color = '#ffe066';
        summary.style.fontSize = '13px';
        summary.style.margin = '2px 0 0 0';
        summary.id = 'autoplant-status';

        statusArea.appendChild(separator);
        statusArea.appendChild(summary);
        placeholder.appendChild(statusArea);

        // Store summary element globally for status updates
        window.autoplantStatusSummary = summary;
        
        // Update status function
        function updateAutoplantStatus() {
            const ignoredCount = selectedCreatures.length;
            const isEnabled = window.autoplantCheckbox ? window.autoplantCheckbox.checked : false;
            
            let statusText = `Autoplant is ${isEnabled ? 'enabled' : 'disabled'}.`;
            
            if (isEnabled && ignoredCount > 0) {
                statusText += ` Ignoring ${ignoredCount} creatures.`;
            }
            
            summary.textContent = statusText;
            summary.style.color = isEnabled ? '#4CAF50' : '#ff6b6b'; // Green when enabled, red when disabled
        }
        
        // Store function globally so it can be called from sync logic
        window.updateAutoplantStatus = updateAutoplantStatus;

        // Update status when creatures are moved
        const originalRender = renderCreatureColumns;
        renderCreatureColumns = function() {
            originalRender();
            updateAutoplantStatus();
        };

        // Initial status update
        updateAutoplantStatus();
        
        // Initialize plant monster filter
        updatePlantMonsterFilter(selectedCreatures);
        
        return placeholder;
    }

    // Helper function to get all creatures for Autoplant
    function     getAllAutoplantCreatures() {
        console.log('[Autoseller] Checking creature database...');
        console.log('[Autoseller] window.creatureDatabase:', window.creatureDatabase);
        console.log('[Autoseller] ALL_CREATURES:', window.creatureDatabase?.ALL_CREATURES);
        return window.creatureDatabase?.ALL_CREATURES || [];
    }

    // Helper function to create creature boxes for Autoplant
    function createAutoplantCreaturesBox({title, items, selectedCreature, onSelectCreature}) {
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
        p.style.color = 'rgb(255, 255, 255)';
        titleEl.appendChild(p);
        box.appendChild(titleEl);
        
        const scrollContainer = document.createElement('div');
        scrollContainer.style.flex = '1 1 0';
        scrollContainer.style.minHeight = '0';
        scrollContainer.style.overflowY = 'auto';
        scrollContainer.style.padding = '4px';
        
        items.forEach(name => {
            const item = document.createElement('div');
            item.textContent = name;
            item.className = 'pixel-font-14 autoplant-creature-item';
            item.style.color = 'rgb(230, 215, 176)';
            item.style.cursor = 'pointer';
            item.style.padding = '2px 4px';
            item.style.borderRadius = '2px';
            item.style.textAlign = 'left';
            item.style.marginBottom = '1px';
            
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
            
            scrollContainer.appendChild(item);
        });
        
        box.appendChild(scrollContainer);
        return box;
    }

    // =======================
    // Plant Monster Filter Functions
    // =======================
    
    function setPlantMonsterFilter(ignoreList) {
        console.log('[Autoseller] Setting plantMonsterFilter with ignore list:', ignoreList);
        console.log('[Autoseller] globalThis.state:', globalThis.state);
        console.log('[Autoseller] clientConfig:', globalThis.state?.clientConfig);
        
        if (!globalThis.state?.clientConfig?.trigger?.setState) {
            console.warn('[Autoseller] clientConfig not available for plantMonsterFilter');
            console.log('[Autoseller] Available state keys:', Object.keys(globalThis.state || {}));
            return;
        }
        
        const settings = getSettings();
        const minGenes = settings.autoplantGenesMin !== undefined ? settings.autoplantGenesMin : 80;
        const keepGenesEnabled = settings.autoplantKeepGenesEnabled !== undefined ? settings.autoplantKeepGenesEnabled : true;
        const alwaysDevourBelow = settings.autoplantAlwaysDevourBelow !== undefined ? settings.autoplantAlwaysDevourBelow : 49;
        const alwaysDevourEnabled = settings.autoplantAlwaysDevourEnabled !== undefined ? settings.autoplantAlwaysDevourEnabled : false;
        
        try {
            globalThis.state.clientConfig.trigger.setState({
                fn: (prev) => {
                    console.log('[Autoseller] Setting plantMonsterFilter in clientConfig, prev state:', prev);
                    return {
                        ...prev,
                        plantMonsterFilter: (monster) => {
                            // if you want to sell the creature, return TRUE
                            // if you want to keep it, return FALSE
                            
                            // Debug: Log monster object structure
                            console.log('[Autoseller] plantMonsterFilter called with monster:', monster);
                            console.log('[Autoseller] Monster name:', monster?.metadata?.name || monster?.name || 'unknown');
                            console.log('[Autoseller] Ignore list:', ignoreList);
                            
                            // Get monster name for logging
                            const monsterName = monster?.metadata?.name || monster?.name;
                            
                            // Never devour shiny creatures
                            if (monster.shiny === true) {
                                console.log('[Autoseller] Keeping monster (shiny):', monsterName);
                                return false; // Keep shiny creatures (DON'T devour them)
                            }
                            
                            // Always devour creatures below absolute threshold (ignores ignore list) - only if enabled
                            if (alwaysDevourEnabled && monster.totalGenes < alwaysDevourBelow) {
                                console.log('[Autoseller] Devouring monster (below absolute threshold):', monsterName, 'genes:', monster.totalGenes, 'threshold:', alwaysDevourBelow);
                                return true; // Devour creatures below absolute threshold
                            }
                            
                            // Keep creatures with minGenes or higher - only if enabled
                            if (keepGenesEnabled && monster.totalGenes >= minGenes) {
                                console.log('[Autoseller] Keeping monster (high genes):', monsterName, 'genes:', monster.totalGenes, 'min:', minGenes);
                                return false; // Keep creatures with genes >= minGenes
                            }
                            
                            // For creatures between thresholds (or all if keep genes disabled), check ignore list
                            if (monsterName && ignoreList.includes(monsterName)) {
                                console.log('[Autoseller] Keeping monster (in ignore list):', monsterName, 'genes:', monster.totalGenes);
                                return false; // Keep creatures in ignore list
                            }
                            
                            console.log('[Autoseller] Devouring monster:', monsterName, 'genes:', monster.totalGenes);
                            return true; // Devour everything else
                        },
                    };
                },
            });
            console.log('[Autoseller] Successfully set plantMonsterFilter');
        } catch (error) {
            console.error('[Autoseller] Error setting plantMonsterFilter:', error);
        }
        
        console.log('[Autoseller] Plant monster filter set with ignore list:', ignoreList);
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
        if (settings.autoplantChecked) {
            // Use provided selectedCreatures, or fall back to saved ignore list from settings
            const ignoreList = selectedCreatures.length > 0 ? selectedCreatures : (settings.autoplantIgnoreList || []);
            setPlantMonsterFilter(ignoreList);
        } else {
            removePlantMonsterFilter();
        }
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
        
        // Store reference to Autosell checkbox globally for mutual exclusivity
        if (opts.persistKey === 'autosell') {
            window.autosellCheckbox = checkbox;
        }
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
            const settingsUpdate = {
                [opts.persistKey + 'Checked']: checkbox.checked,
                [opts.persistKey + 'GenesMin']: parseInt(inputMin.value, 10),
                [opts.persistKey + 'GenesMax']: parseInt(inputMax.value, 10),
                [opts.persistKey + 'MinCount']: parseInt(minCountInput.value, 10)
            };
            
            // Track last active mode when autosell is checked
            if (opts.persistKey === 'autosell' && checkbox.checked) {
                settingsUpdate.lastActiveMode = 'autosell';
            }
            
            setSettings(settingsUpdate);
            
            // Update widget visibility when checkbox state changes
            createAutosellerSessionWidget();
            
            // If Autosell is being checked, uncheck Autoplant
            if (opts.persistKey === 'autosell' && checkbox.checked) {
                console.log('[Autosell] Being checked, looking for Autoplant checkbox...');
                setTimeout(() => {
                    // Try to find the Autoplant checkbox using stored reference or DOM search
                    let autoplantCheckbox = window.autoplantCheckbox;
                    if (!autoplantCheckbox) {
                        // Fallback to DOM search
                        autoplantCheckbox = document.querySelector('input[id="autoplant-checkbox"]');
                    }
                    console.log('[Autosell] Found Autoplant checkbox:', autoplantCheckbox);
                    if (autoplantCheckbox) {
                        console.log('[Autosell] Autoplant checkbox checked state:', autoplantCheckbox.checked);
                        if (autoplantCheckbox.checked) {
                            console.log('[Autosell] Unchecking Autoplant checkbox');
                            autoplantCheckbox.checked = false;
                            autoplantCheckbox.dispatchEvent(new Event('change'));
                        } else {
                            console.log('[Autosell] Autoplant checkbox already unchecked');
                        }
                    } else {
                        console.log('[Autosell] Autoplant checkbox not found');
                    }
                }, 0);
            } else if (opts.persistKey === 'autosell') {
                console.log('[Autosell] Checkbox changed, checked:', checkbox.checked, 'persistKey:', opts.persistKey);
            }
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
                console.warn(`[${modName}][WARN][safeGetCreatureCount] Error getting creature count for ${type}: ${e?.message || 'Unknown error'}`, e);
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
                summary.style.color = checkbox.checked ? '#4CAF50' : '#ff6b6b'; // Green when enabled, red when disabled
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
                console.log('[Autoseller] Dragon Plant API call detected:', url);
                
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
                                    
                                    console.log(`[Autoseller] Dragon Plant devoured ${devouredCount} creatures for ${goldReceived} gold | Plant total: ${currentPlantGold || 'unknown'} gold`);
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
        
        console.log('[Autoseller] Dragon Plant API monitor setup complete');
    }
    
    const stateManager = {
        sessionStats: {
            soldCount: 0,
            soldGold: 0,
            devouredCount: 0,
            devouredGold: 0,
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
            } else if (type === 'devoured') {
                this.sessionStats.devouredCount += count;
                this.sessionStats.devouredGold += value;
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
                devouredCount: 0,
                devouredGold: 0,
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
            
            // Check if the feature is enabled before processing
            if (type === 'sell' && !settings.autosellChecked) {
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
            
            console.log(`[Autoseller] Processing ${type} for ${monsters?.length || 0} monsters...`);
            
            if (!monsters) {
                monsters = await fetchServerMonsters();
            }
            if (!Array.isArray(monsters)) {
                console.warn(`[${modName}][WARN][processEligibleMonsters] Could not access monster list.`);
                return;
            }
            
            let { toSqueeze, toSell } = await getEligibleMonsters(settings, monsters);
            
            if (type === 'sell') {
                toSell = toSell.filter(m => !stateManager.isProcessed(m.id));
                if (!toSell.length) {
                    console.log('[Autoseller] No eligible monsters to sell');
                    return;
                }
                
                console.log(`[Autoseller] Selling ${toSell.length} monsters in batches of ${SELL_RATE_LIMIT.BATCH_SIZE}`);
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
                            console.warn(`[${modName}][WARN][processEligibleMonsters] Rate limited (429) for monster ${id}, waiting...`);
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
                            // 404 means creature no longer exists on server - always remove from local inventory
                            stateManager.markProcessed([id]);
                            removeMonstersFromLocalInventory([id]);
                        } else if (!result.success) {
                            console.warn(`[${modName}][WARN][processEligibleMonsters] Sell API failed for ID ${id}: HTTP ${result.status}`);
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, SELL_RATE_LIMIT.DELAY_BETWEEN_SELLS_MS));
                    }
                    
                    if (i + batchSize < toSell.length) {
                        await new Promise(resolve => setTimeout(resolve, SELL_RATE_LIMIT.BATCH_DELAY_MS));
                    }
                }
            } else if (type === 'squeeze') {
                if (!toSqueeze.length) {
                    console.log('[Autoseller] No eligible monsters to squeeze');
                    return;
                }
                
                console.log(`[Autoseller] Squeezing ${toSqueeze.length} monsters in batches of ${SELL_RATE_LIMIT.BATCH_SIZE}`);
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
                        // 404 means creatures no longer exist on server - always remove from local inventory
                        stateManager.markProcessed(ids);
                        removeMonstersFromLocalInventory(ids);
                    } else if (!result.success) {
                        console.warn(`[${modName}][WARN][processEligibleMonsters] Squeeze API failed: HTTP ${result.status}`);
                        continue;
                    }
                
                    if (i + SELL_RATE_LIMIT.BATCH_SIZE < toSqueeze.length) {
                        await new Promise(res => setTimeout(res, SELL_RATE_LIMIT.BATCH_DELAY_MS));
                    }
                }
            }
        } catch (e) {
            console.error(`[${modName}][ERROR][processEligibleMonsters] Failed to ${type} monsters. Error: ${e.message}`, e);
            stateManager.updateErrorStats(`${type}Errors`);
        }
    }

    // =======================
    // 8. Modal & Settings Management
    // =======================
    
    function openAutosellerModal() {
        console.log('[Autoseller] Opening settings modal...');
        
        // Ensure mutual exclusivity on initialization
        const settings = getSettings();
        if (settings.autoplantChecked && settings.autosellChecked) {
            console.log('[Autoseller] Both Autoplant and Autosell are checked, prioritizing Autoplant');
            setSettings({ autosellChecked: false });
        }
        
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
            
            // Add data attribute to help find the autosell section
            autosellSection.setAttribute('data-autosell-section', 'true');
            
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
                icon: 'https://bestiaryarena.com/assets/icons/goldpile.png',
                tabs: [
                    {
                        title: 'Autoplant',
                        icon: 'https://bestiaryarena.com/assets/icons/plant.png',
                        content: createAutplantPlaceholder(),
                        verticalAlign: 'space-between'
                    },
                    {
                        title: 'Autosell',
                        icon: 'https://bestiaryarena.com/assets/icons/goldpile.png',
                        content: autosellSection,
                        verticalAlign: 'center'
                    }
                ]
            });
            col1.style.width = '240px';
            col1.style.minWidth = '240px';
            col1.style.maxWidth = '240px';
            col1.style.height = '100%';
            col1.style.flex = '0 0 240px';
            
            const col2 = createBox({ 
                title: 'Autosqueeze', 
                content: autosqueezeSection, 
                icon: 'https://bestiaryarena.com/assets/icons/dust.png',
                verticalAlign: 'center'
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
                    
                    // Apply localStorage to mod checkbox when modal opens
                    applyLocalStorageToModCheckbox();
                    
                    // Ensure mutual exclusivity after modal is rendered
                    const currentSettings = getSettings();
                    const autoplantCheckbox = document.querySelector('input[id="autoplant-checkbox"]');
                    const autosellCheckbox = document.querySelector('input[id*="autosell"][type="checkbox"]');
                    
                    if (autoplantCheckbox && autosellCheckbox) {
                        console.log('[Autoseller] Initializing checkbox states - Autoplant:', currentSettings.autoplantChecked, 'Autosell:', currentSettings.autosellChecked);
                        
                        // If both are checked, prioritize Autoplant
                        if (currentSettings.autoplantChecked && currentSettings.autosellChecked) {
                            console.log('[Autoseller] Both checked on init, unchecking Autosell');
                            autosellCheckbox.checked = false;
                            setSettings({ autosellChecked: false });
                        }
                    }
                }
            }, 0);
        }
    }

    // =======================
    // 9. Navigation & UI Injection
    // =======================
    
    function addAutosellerNavButton() {
        console.log('[Autoseller] Adding navigation button...');
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
            
            console.log('[Autoseller] Navigation button added successfully');
            updateAutosellerNavButtonColor();
        }
        tryInsert();
    }
    
    function updateAutosellerNavButtonColor() {
        const btn = queryElement(`.${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_NAV_BTN}`);
        if (!btn) return;
        
        const settings = getSettings();
        const isActive = settings.autoplantChecked || settings.autosellChecked || settings.autosqueezeChecked;
        
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
        const shouldShowWidget = settings.autoplantChecked || settings.autosellChecked || settings.autosqueezeChecked;
        
        console.log(`[Autoseller] Widget creation - autosell: ${settings.autosellChecked}, autosqueeze: ${settings.autosqueezeChecked}`);
        
        const existingWidget = queryElement(`#${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET}`);
        if (!shouldShowWidget) {
            if (existingWidget && existingWidget.parentNode) {
                existingWidget.parentNode.removeChild(existingWidget);
                console.log('[Autoseller] Widget removed - no features enabled');
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
        // Determine label: if autoplant is ON -> 'Devoured', if autosell is ON -> 'Sold', 
        // if both OFF -> use last active mode
        const soldLabel = settings.autoplantChecked 
            ? 'Devoured:' 
            : (settings.autosellChecked 
                ? 'Sold:' 
                : (settings.lastActiveMode === 'autoplant' ? 'Devoured:' : 'Sold:'));
        widget.innerHTML = `
            <div class="widget-top">Autoseller session</div>
            <div class="widget-bottom p-0">
                <div class="stat-row">
                    <div class="stat-label">${soldLabel}</div>
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
        
        // Store references to stat elements for updates
        widget._statEls = {
            soldLabel: widget.querySelector('.stat-label:first-child'),
            soldCount: widget.querySelector('#autoseller-session-sold-count'),
            soldGold: widget.querySelector('#autoseller-session-sold-gold'),
            squeezedCount: widget.querySelector('#autoseller-session-squeezed-count'),
            squeezedDust: widget.querySelector('#autoseller-session-squeezed-dust')
        };
        
        // Add widget to the autoplay container
        autoplayContainer.appendChild(widget);
        console.log('[Autoseller] Session widget created and added to UI');
    }


    
    function updateAutosellerSessionWidget() {
        const widget = queryElement(`#${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET}`);
        if (!widget) return;
        
        const statEls = widget._statEls;
        if (!statEls) return;
        
        const currentValues = stateManager.getSessionStats();
        
        // Update the sold/devoured label based on current or last active mode
        const settings = getSettings();
        // Determine label: if autoplant is ON -> 'Devoured', if autosell is ON -> 'Sold',
        // if both OFF -> use last active mode
        const soldLabel = settings.autoplantChecked 
            ? 'Devoured:' 
            : (settings.autosellChecked 
                ? 'Sold:' 
                : (settings.lastActiveMode === 'autoplant' ? 'Devoured:' : 'Sold:'));
        const isShowingDevoured = soldLabel === 'Devoured:';
        
        if (statEls.soldLabel) {
            statEls.soldLabel.textContent = soldLabel;
        }
        
        // Update stats directly - show devoured stats when showing "Devoured", sold stats when showing "Sold"
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
        if (statEls.squeezedCount) statEls.squeezedCount.textContent = `${currentValues.squeezedCount}`;
        if (statEls.squeezedDust) {
            const dustText = statEls.squeezedDust.querySelector('span');
            if (dustText) dustText.textContent = `${currentValues.squeezedDust}`;
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
                const shouldShowWidget = shouldShowAutosellerWidget();
                
                if (mode === 'autoplay' && shouldShowWidget) {
                    // Small delay to ensure autoplay UI is rendered
                    setTimeout(() => {
                        if (!getAutosellerWidget()) {
                            createAutosellerSessionWidget();
                            updateAutosellerSessionWidget();
                            console.log('[Autoseller] Widget created - autoplay mode started');
                        }
                        
                        // Apply localStorage to game checkbox when autoplay starts
                        applyLocalStorageToGameCheckbox();
                    }, 100);
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
                    setTimeout(() => {
                        updateAutosellerSessionWidget();
                    }, 100);
                }
            };
            globalThis.state.board.on('emitNewGame', emitNewGameHandler1);
            
            emitEndGameHandler1 = () => {
                if (shouldShowAutosellerWidget()) {
                    setTimeout(() => {
                        updateAutosellerSessionWidget();
                    }, 100);
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
        return settings.autoplantChecked || settings.autosellChecked || settings.autosqueezeChecked;
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
    function applyLocalStorageToGameCheckbox() {
        const settings = getSettings();
        const savedState = settings.autoplantChecked;
        
        const autoplaySessions = document.querySelectorAll('div[data-autosetup]');
        for (const session of autoplaySessions) {
            const widgetBottom = session.querySelector('.widget-bottom[data-minimized="false"]');
            if (widgetBottom) {
                const gameCheckbox = widgetBottom.querySelector('button[role="checkbox"]');
                if (gameCheckbox) {
                    const isCurrentlyChecked = gameCheckbox.getAttribute('aria-checked') === 'true';
                    if (savedState !== isCurrentlyChecked) {
                        console.log(`[${modName}] Applying localStorage (${savedState}) to game checkbox`);
                        gameCheckbox.click();
                    }
                    break;
                }
            }
        }
    }
    
    // Apply localStorage state to mod checkbox
    function applyLocalStorageToModCheckbox() {
        const settings = getSettings();
        const savedState = settings.autoplantChecked;
        
        const modCheckbox = document.querySelector('#autoplant-checkbox');
        if (modCheckbox && modCheckbox.checked !== savedState) {
            console.log(`[${modName}] Applying localStorage (${savedState}) to mod checkbox`);
            modCheckbox.checked = savedState;
            window.autoplantCheckbox = modCheckbox;
            
            // Update UI elements
            if (typeof window.updateAutoplantStatus === 'function') {
                window.updateAutoplantStatus();
            }
        }
    }
    
    function setupDragonPlantObserver() {
        if (dragonPlantObserver || dragonPlantObserverAttempts >= MAX_OBSERVER_ATTEMPTS) return;
        
        dragonPlantObserverAttempts++;
        
        if (typeof MutationObserver !== 'undefined') {
            let debounceTimer = null;
            
            dragonPlantObserver = new MutationObserver((mutations) => {
                const hasRelevantMutations = mutations.some(mutation => {
                    return mutation.type === 'childList' || 
                           (mutation.type === 'attributes' && 
                            (mutation.attributeName === 'data-state' || 
                             mutation.attributeName === 'aria-checked'));
                });
                
                if (!hasRelevantMutations) return;
                
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }
                
                debounceTimer = setTimeout(() => {
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
            
            console.log(`[${modName}] Dragon Plant observer setup complete`);
        } else {
            console.warn(`[${modName}][WARN][setupDragonPlantObserver] MutationObserver not available`);
        }
    }
    
    function handleDragonPlantClick(event) {
        // Check if the clicked element is a Dragon Plant checkbox in autoplay session
        const target = event.target.closest('button[role="checkbox"]');
        if (!target) return;
        
        // Check if this is in an autoplay session
        const autoplaySession = target.closest('div[data-autosetup]');
        if (!autoplaySession) return;
        
        // Check if this is the Dragon Plant checkbox (look for the checkbox in widget bottom)
        const widgetBottom = autoplaySession.querySelector('.widget-bottom[data-minimized="false"]');
        if (!widgetBottom || !widgetBottom.contains(target)) return;
        
        console.log(`[${modName}] User clicked Dragon Plant checkbox in autoplay session`);
        
        // Use a small delay to let the game update the checkbox state first
        setTimeout(() => {
            const gameCheckbox = widgetBottom.querySelector('button[role="checkbox"]');
            if (gameCheckbox) {
                const newState = gameCheckbox.getAttribute('aria-checked') === 'true';
                console.log(`[${modName}] Game checkbox clicked, saving to localStorage: ${newState}`);
                
                // Save to localStorage and track last active mode
                if (newState) {
                    setSettings({ autoplantChecked: newState, lastActiveMode: 'autoplant' });
                } else {
                    setSettings({ autoplantChecked: newState });
                }
                
                // Apply to mod checkbox (if settings modal is open)
                applyLocalStorageToModCheckbox();
                
                // Handle mutual exclusivity
                if (newState) {
                    const currentSettings = getSettings();
                    if (currentSettings.autosellChecked) {
                        console.log('[Autoseller] Autoplant enabled, disabling Autosell');
                        setSettings({ autosellChecked: false });
                        
                        const autosellCheckbox = document.querySelector('input[id*="autosell"][type="checkbox"]');
                        if (autosellCheckbox) {
                            autosellCheckbox.checked = false;
                        }
                    }
                }
                
                // Update filter and widget
                updatePlantMonsterFilter(getSettings().autoplantIgnoreList || []);
                createAutosellerSessionWidget();
                updateAutosellerSessionWidget();
            }
        }, 50);
    }
    
    function stopDragonPlantObserver() {
        if (dragonPlantObserver) {
            dragonPlantObserver.disconnect();
            dragonPlantObserver = null;
            console.log(`[${modName}] Dragon Plant observer stopped`);
        }
        
        // Remove click event listener
        document.removeEventListener('click', handleDragonPlantClick);
    }
    
    // =======================
    // 12.1. Game End Listener for Dragon Plant
    // =======================
    
    function setupGameEndListener() {
        if (globalThis.state?.board?.on) {
            // Listen for new game events to access the world object
            emitNewGameHandler1 = (game) => {
                // Skip during Board Analyzer runs
                if (window.__modCoordination?.boardAnalyzerRunning) {
                    return;
                }
                
                // Subscribe to world.onGameEnd which fires when battle animation completes
                game.world.onGameEnd.once(() => {
                    console.log(`[${modName}] Battle animation completed, creatures dropped - checking Dragon Plant...`);
                    // Wait 100ms for UI to settle before activating Dragon Plant
                    setTimeout(() => {
                        checkAndActivateDragonPlant();
                    }, 100);
                });
            };
            globalThis.state.board.on('newGame', emitNewGameHandler1);
            
            console.log(`[${modName}] Game end listener setup complete`);
        } else {
            console.warn(`[${modName}] Board state not available for game end listener`);
        }
    }
    
    function checkAndActivateDragonPlant() {
        const settings = getSettings();
        
        // Only proceed if autoplant is enabled
        if (!settings.autoplantChecked) return;
        
        // Log current plant gold
        const plantGold = getPlantGold();
        if (plantGold !== undefined && plantGold !== null) {
            console.log(`[Autoseller] Dragon Plant current gold: ${plantGold}`);
        }
        
        // Check if we're in an autoplay session
        const autoplaySessions = document.querySelectorAll('div[data-autosetup]');
        if (autoplaySessions.length === 0) return;
        
        // Find the Dragon Plant button (try Dragon Plant first, then Baby Dragon Plant)
        let dragonPlantButton = null;
        for (const session of autoplaySessions) {
            const widgetBottom = session.querySelector('.widget-bottom[data-minimized="false"]');
            if (widgetBottom) {
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
                if (dragonPlantButton) break;
            }
        }
        
        if (!dragonPlantButton) return;
        
        // Check if Dragon Plant is currently enabled
        const isCurrentlyEnabled = dragonPlantButton.getAttribute('data-state') === 'open' && 
                                 !dragonPlantButton.hasAttribute('disabled');
        
        // Only activate if not already enabled
        if (!isCurrentlyEnabled) {
            console.log(`[${modName}] Auto-clicking Dragon Plant on game start`);
            setTimeout(() => {
                dragonPlantButton.click();
            }, 100);
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
        if (window.__modCoordination?.boardAnalyzerRunning) {
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
        } else {
            console.log(`[Autoseller] Dragon Plant gold: ${plantGold} / ${DRAGON_PLANT_CONFIG.GOLD_THRESHOLD} (${Math.round((plantGold / DRAGON_PLANT_CONFIG.GOLD_THRESHOLD) * 100)}% to threshold)`);
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
        console.log('[Autoseller] Pressed ESC to close item details');
        
        setTimeout(() => {
            sendEscKey();
            console.log('[Autoseller] Pressed ESC to close inventory');
            if (onComplete) {
                setTimeout(onComplete, DRAGON_PLANT_CONFIG.TIMINGS.VERIFY_SUCCESS);
            }
        }, DRAGON_PLANT_CONFIG.TIMINGS.ESC_BETWEEN);
    };
    
    function collectDragonPlant() {
        console.log('[Autoseller] Attempting to collect Dragon Plant...');
        
        // Set collecting flag
        isCollecting = true;
        
        const initialGold = getPlantGold();
        
        // Step 1: Open inventory
        if (!openInventory()) {
            console.log('[Autoseller] Failed to open inventory');
            isCollecting = false; // Reset flag on error
            return;
        }
        
        // Step 2: Wait for inventory to open, then click Dragon Plant
        setTimeout(() => {
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
            console.log('[Autoseller] Clicked Dragon Plant item');
            
            // Step 3: Wait for item details, then start collect loop
            setTimeout(() => {
                let collectCount = 0;
                let retryCount = 0;
                const MAX_RETRIES = 3;
                
                // Recursive function to collect multiple times
                const collectLoop = () => {
                    // Safety check: prevent infinite loops
                    if (collectCount >= DRAGON_PLANT_CONFIG.MAX_COLLECT_ITERATIONS) {
                        console.log('[Autoseller] Max collect iterations reached, stopping');
                        closeDialogs(() => verifyAndUpdateCooldown(initialGold));
                        return;
                    }
                    
                    const collectButton = findDragonPlantCollectButton();
                    
                    if (!collectButton) {
                        if (retryCount < MAX_RETRIES) {
                            retryCount++;
                            console.log(`[Autoseller] Collect button not ready (disabled or not found), retrying (${retryCount}/${MAX_RETRIES})...`);
                            setTimeout(collectLoop, 200);
                            return;
                        }
                        console.log('[Autoseller] Collect button not ready after retries');
                        closeDialogs(() => verifyAndUpdateCooldown(initialGold));
                        return;
                    }
                    
                    // Reset retry count on successful button find
                    retryCount = 0;
                    
                    collectButton.click();
                    collectCount++;
                    console.log(`[Autoseller] Clicked Collect button (${collectCount}/${DRAGON_PLANT_CONFIG.MAX_COLLECT_ITERATIONS})`);
                    
                    // Step 4: Wait then check if we should collect again
                    setTimeout(() => {
                        const currentGold = getPlantGold();
                        
                        if (currentGold !== undefined && currentGold !== null && currentGold >= DRAGON_PLANT_CONFIG.GOLD_THRESHOLD) {
                            console.log(`[Autoseller] Plant still has ${currentGold} gold, collecting again...`);
                            collectLoop(); // Collect again
                        } else {
                            console.log(`[Autoseller] Collection complete, final gold: ${currentGold}`);
                            closeDialogs(() => verifyAndUpdateCooldown(initialGold));
                        }
                    }, DRAGON_PLANT_CONFIG.TIMINGS.AFTER_COLLECT);
                };
                
                // Start the collect loop
                collectLoop();
            }, DRAGON_PLANT_CONFIG.TIMINGS.ITEM_DETAILS_OPEN);
        }, DRAGON_PLANT_CONFIG.TIMINGS.INVENTORY_OPEN);
    }
    
    // Helper: Verify collection success and update cooldown
    const verifyAndUpdateCooldown = (initialGold) => {
        const finalGold = getPlantGold();
        
        if (finalGold !== undefined && finalGold < initialGold) {
            console.log(`[Autoseller] Dragon Plant collected successfully! Gold: ${initialGold} → ${finalGold}`);
            lastAutocollectTime = Date.now();
        } else {
            console.log('[Autoseller] Collection may have failed - gold did not decrease');
        }
        
        // Reset collecting flag
        isCollecting = false;
        console.log('[Autoseller] Collection process complete, ready for next collection');
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
        
        console.log('[Autoseller] Dragon Plant autocollect monitoring initialized');
    }

    // =======================
    // 13. Initialization & Event Handlers
    // =======================
    
    function initAutoseller() {
        addAutosellerNavButton();
        setupAutosellerWidgetObserver();
        setupDragonPlantObserver();
        setupGameEndListener();
        setupDragonPlantAPIMonitor();
        setupDragonPlantAutocollect();
        
        // Initialize plant monster filter with saved ignore list from localStorage
        // (ignore mod loader config, use localStorage as single source of truth)
        updatePlantMonsterFilter();
        
        setTimeout(() => {
            updateAutosellerNavButtonColor();
        }, 1000);
        
        let lastProcessedBattleKey = null;
        if (globalThis.state.board && globalThis.state.board.subscribe) {
            console.log('[Autoseller] Setting up board subscription for battle completion...');
            boardSubscription2 = globalThis.state.board.subscribe(async ({ context }) => {
                const serverResults = context.serverResults;
                if (!serverResults || !serverResults.rewardScreen || typeof serverResults.rewardScreen.gameTicks !== 'number') return;
                
                const seed = serverResults.seed;
                const gameTicks = serverResults.rewardScreen.gameTicks;
                const battleKey = `${seed}:${gameTicks}`;
                if (battleKey === lastProcessedBattleKey) return;
                lastProcessedBattleKey = battleKey;
                
                console.log(`[Autoseller] Battle completed (${seed}:${gameTicks}), processing inventory...`);
                const inventorySnapshot = await fetchServerMonsters();
                const waitSeconds = gameTicks / 16;
                
                setTimeout(async () => {
                    if (!stateManager.canRun()) {
                        console.log('[Autoseller] Skipping processing - rate limit active');
                        return;
                    }
                    
                    const settings = getSettings();
                    
                    if (!settings.autoplantChecked && !settings.autosellChecked && !settings.autosqueezeChecked) {
                        console.log('[Autoseller] Skipping processing - no features enabled');
                        return;
                    }
                    
                    console.log('[Autoseller] Processing inventory after battle completion...');
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
                console.log('[Autoseller] enableDragonPlant() called');
                const currentSettings = getSettings();
                
                // Check if already enabled - don't toggle it
                if (currentSettings.autoplantChecked) {
                    console.log('[Autoseller] Dragon Plant already enabled, skipping');
                    return true;
                }
                
                console.log('[Autoseller] Enabling Dragon Plant');
                
                // Handle mutual exclusivity - disable Autosell if enabled
                const settingsUpdate = { autoplantChecked: true, lastActiveMode: 'autoplant' };
                if (currentSettings.autosellChecked) {
                    console.log('[Autoseller] Disabling Autosell to enable Autoplant (mutual exclusivity)');
                    settingsUpdate.autosellChecked = false;
                }
                
                setSettings(settingsUpdate);
                
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
                if (!currentSettings.autoplantChecked) {
                    console.log('[Autoseller] Dragon Plant already disabled, skipping');
                    return true;
                }
                
                console.log('[Autoseller] Disabling Dragon Plant');
                setSettings({ autoplantChecked: false });
                
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
                    
                    if (boardSubscription2) {
                        try {
                            boardSubscription2.unsubscribe();
                            boardSubscription2 = null;
                        } catch (error) {
                            console.warn('[Autoseller] Error unsubscribing board2:', error);
                        }
                    }
                    
                    if (playerSubscription) {
                        try {
                            playerSubscription.unsubscribe();
                            playerSubscription = null;
                        } catch (error) {
                            console.warn('[Autoseller] Error unsubscribing player:', error);
                        }
                    }
                    
                    // 2. Clear timers
                    if (debounceTimer) {
                        clearTimeout(debounceTimer);
                        debounceTimer = null;
                    }
                    
                    // 3. Remove DOM elements
                    const widget = document.getElementById(UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_WIDGET);
                    const navBtn = document.querySelector(`.${UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_NAV_BTN}`);
                    const responsiveStyle = document.getElementById(UI_CONSTANTS.CSS_CLASSES.AUTOSELLER_RESPONSIVE_STYLE);
                    const widgetStyle = document.getElementById('autoseller-widget-css');
                    
                    if (widget && widget.parentNode) widget.parentNode.removeChild(widget);
                    if (navBtn && navBtn.parentNode) navBtn.parentNode.removeChild(navBtn);
                    if (responsiveStyle && responsiveStyle.parentNode) responsiveStyle.parentNode.removeChild(responsiveStyle);
                    if (widgetStyle && widgetStyle.parentNode) widgetStyle.parentNode.removeChild(widgetStyle);
                    
                    // 4. Stop observers
                    stopDragonPlantObserver();
                    
                    // 5. Remove game state event listeners and filters
                    if (globalThis.state?.board?.off) {
                        try {
                            if (emitNewGameHandler1) {
                                globalThis.state.board.off('newGame', emitNewGameHandler1);
                                emitNewGameHandler1 = null;
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
                    
                    // 9. Verify cleanup was successful
                    const remainingReferences = [
                        boardSubscription1,
                        boardSubscription2,
                        playerSubscription,
                        debounceTimer,
                        dragonPlantObserver,
                        emitNewGameHandler1,
                        emitEndGameHandler1
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