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
    const modDescription = "Automatically sells selected items. (WIP)";
    let autosellerSettingsCache = null;
    function getCachedSettings() {
        // Prefer context.config if available
        if (typeof context !== 'undefined' && context.config && Object.keys(context.config).length > 0) {
            autosellerSettingsCache = { ...context.config };
            return autosellerSettingsCache;
        }
        if (autosellerSettingsCache) return autosellerSettingsCache;
        try {
            autosellerSettingsCache = JSON.parse(localStorage.getItem('autoseller-settings') || '{}');
        } catch { autosellerSettingsCache = {}; }
        return autosellerSettingsCache;
    }
    function setCachedSettings(newSettings) {
        autosellerSettingsCache = { ...autosellerSettingsCache, ...newSettings };
        // Save to localStorage for backward compatibility
        debouncedSaveSettings();
        // If mod loader API is available, update context.config as well
        if (typeof api !== 'undefined' && api.service && typeof context !== 'undefined' && context.hash) {
            api.service.updateScriptConfig(context.hash, autosellerSettingsCache);
        }
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
        } catch (e) {}
    }, 300);
    if (!localStorage.getItem('autoseller-settings') && !(typeof context !== 'undefined' && context.config && Object.keys(context.config).length > 0)) {
        autosellerSettingsCache = {
            autosellChecked: false,
            autosqueezeChecked: false
        };
        localStorage.setItem('autoseller-settings', JSON.stringify(autosellerSettingsCache));
    } else {
        getCachedSettings();
    }

    // =======================
    // 2. Utility Functions
    // =======================
    function getLevelFromExp(exp) {
        const EXP_TABLE = [
            [5, 11250], [6, 17000], [7, 24000], [8, 32250], [9, 41750], [10, 52250],
            [11, 64250], [12, 77750], [13, 92250], [14, 108500], [15, 126250], [16, 145750],
            [17, 167000], [18, 190000], [19, 215250], [20, 242750], [21, 272750], [22, 305750],
            [23, 342000], [24, 382000], [25, 426250], [26, 475250], [27, 530000], [28, 591500],
            [29, 660500], [30, 738500], [31, 827000], [32, 928000], [33, 1043500], [34, 1176000],
            [35, 1329000], [36, 1505750], [37, 1710500], [38, 1948750], [39, 2226500], [40, 2550500],
            [41, 2929500], [42, 3373500], [43, 3894000], [44, 4504750], [45, 5222500], [46, 6066000],
            [47, 7058000], [48, 8225000], [49, 9598500], [50, 11214750]
        ];
        if (typeof exp !== 'number' || exp < EXP_TABLE[0][1]) {
            return 1;
        }
        for (let i = EXP_TABLE.length - 1; i >= 0; i--) {
            if (exp >= EXP_TABLE[i][1]) {
                return EXP_TABLE[i][0];
            }
        }
        return 1;
    }
    function getRarityFromStats(stats) {
        const statSum = (stats.hp || 0) + (stats.ad || 0) + (stats.ap || 0) + (stats.armor || 0) + (stats.magicResist || 0);
        let rarity = 1;
        if (statSum >= 80) rarity = 5;
        else if (statSum >= 70) rarity = 4;
        else if (statSum >= 60) rarity = 3;
        else if (statSum >= 50) rarity = 2;
        return rarity;
    }
    function getGenes(m) {
        return (m.hp || 0) + (m.ad || 0) + (m.ap || 0) + (m.armor || 0) + (m.magicResist || 0);
    }
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
    // 3. Inventory Management
    // =======================
    async function fetchServerMonsters() {
        try {
            const myName = globalThis.state?.player?.getSnapshot?.().context?.name;
            if (!myName) {
                const msg = '[Autoseller][DEBUG] Could not determine player name.';
                console.warn(msg);
                if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal) {
                    api.ui.components.createModal({
                        title: 'Autoseller Error',
                        content: '<p>Could not determine player name. Please make sure you are logged in.</p>',
                        buttons: [{ text: 'OK', primary: true }]
                    });
                }
                return [];
            }
            const url = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=${encodeURIComponent(JSON.stringify({"0":{json:myName}}))}`;
            const resp = await fetch(url, { credentials: 'include' });
            if (!resp.ok) {
                const msg = `[Autoseller][DEBUG] Error fetching server monsters: HTTP ${resp.status}`;
                console.error(msg);
                if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal) {
                    api.ui.components.createModal({
                        title: 'Autoseller Error',
                        content: `<p>Failed to fetch your monster inventory from the server. (HTTP ${resp.status})</p>`,
                        buttons: [{ text: 'OK', primary: true }]
                    });
                }
                return [];
            }
            const data = await resp.json();
            const monsters = data?.[0]?.result?.data?.json?.monsters || [];
            console.log('[Autoseller][DEBUG] Monsters from server profile API:', monsters);
            return monsters;
        } catch (e) {
            console.error('[Autoseller][DEBUG] Error fetching server monsters:', e);
            if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal) {
                api.ui.components.createModal({
                    title: 'Autoseller Error',
                    content: `<p>Failed to fetch your monster inventory from the server.<br>${e && e.message ? e.message : e}</p>`,
                    buttons: [{ text: 'OK', primary: true }]
                });
            }
            return [];
        }
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
            console.warn('[Autoseller] Failed to update local inventory:', e);
        }
    }
    async function syncLocalInventoryWithServer() {
        const monsters = await fetchServerMonsters();
        try {
            const player = globalThis.state?.player;
            if (!player) return;
            player.send({
                type: "setState",
                fn: (prev) => ({
                    ...prev,
                    monsters: monsters
                }),
            });
        } catch (e) {
            console.warn('[Autoseller] Failed to sync local inventory:', e);
        }
    }

    // =======================
    // 4. UI Component Creation
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
    function createSettingsSection(opts) {
        const section = document.createElement('div');
        const descWrapper = document.createElement('div');
        descWrapper.style.display = 'flex';
        descWrapper.style.alignItems = 'center';
        descWrapper.style.gap = '6px';
        descWrapper.style.margin = '6px 0 10px 0';
        const desc = document.createElement('span');
        desc.textContent = opts.desc;
        desc.className = 'pixel-font-16';
        desc.style.color = '#cccccc';
        desc.style.fontSize = '13px';
        descWrapper.appendChild(desc);
        const tooltip = document.createElement('span');
        tooltip.textContent = 'ⓘ';
        tooltip.style.cursor = 'pointer';
        tooltip.style.fontSize = '15px';
        tooltip.style.color = '#ffe066';
        tooltip.title = opts.tooltip;
        descWrapper.appendChild(tooltip);
        const row1 = document.createElement('div');
        row1.style.display = 'flex';
        row1.style.alignItems = 'center';
        row1.style.width = '100%';
        row1.style.marginBottom = '10px';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = opts.persistKey + '-checkbox';
        checkbox.style.marginRight = '8px';
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = opts.label;
        label.className = 'pixel-font-16';
        label.style.fontWeight = 'bold';
        label.style.fontSize = '16px';
        label.style.color = '#ffffff';
        label.style.marginRight = '8px';
        row1.appendChild(checkbox);
        row1.appendChild(label);
        const row2 = document.createElement('div');
        row2.style.display = 'flex';
        row2.style.alignItems = 'center';
        row2.style.width = '100%';
        row2.style.marginBottom = '12px';
        const inputLabel = document.createElement('span');
        inputLabel.textContent = opts.inputLabel + ': Between';
        inputLabel.className = 'pixel-font-16';
        inputLabel.style.marginRight = '6px';
        inputLabel.style.fontWeight = 'bold';
        inputLabel.style.fontSize = '16px';
        inputLabel.style.color = '#cccccc';
        row2.appendChild(inputLabel);
        const inputMin = document.createElement('input');
        inputMin.type = 'number';
        inputMin.min = opts.inputMin;
        inputMin.max = opts.inputMax;
        inputMin.value = opts.defaultMin;
        inputMin.className = 'pixel-font-16';
        inputMin.style.width = '48px';
        inputMin.style.marginRight = '4px';
        inputMin.style.textAlign = 'center';
        inputMin.style.borderRadius = '3px';
        inputMin.style.border = '1px solid #ffe066';
        inputMin.style.background = '#232323';
        inputMin.style.color = '#ffe066';
        inputMin.style.fontWeight = 'bold';
        inputMin.style.fontSize = '16px';
        inputMin.step = '1';
        row2.appendChild(inputMin);
        const andText = document.createElement('span');
        andText.textContent = 'and';
        andText.className = 'pixel-font-16';
        andText.style.margin = '0 4px';
        andText.style.color = '#cccccc';
        row2.appendChild(andText);
        const inputMax = document.createElement('input');
        inputMax.type = 'number';
        inputMax.min = opts.inputMin;
        inputMax.max = opts.inputMax;
        inputMax.value = opts.defaultMax;
        inputMax.className = 'pixel-font-16';
        inputMax.style.width = '48px';
        inputMax.style.marginRight = '4px';
        inputMax.style.textAlign = 'center';
        inputMax.style.borderRadius = '3px';
        inputMax.style.border = '1px solid #ffe066';
        inputMax.style.background = '#232323';
        inputMax.style.color = '#ffe066';
        inputMax.style.fontWeight = 'bold';
        inputMax.style.fontSize = '16px';
        inputMax.step = '1';
        row2.appendChild(inputMax);
        const percent = document.createElement('span');
        percent.textContent = '%';
        percent.className = 'pixel-font-16';
        percent.style.fontWeight = 'bold';
        percent.style.fontSize = '16px';
        percent.style.color = '#cccccc';
        row2.appendChild(percent);
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
        minCountLabel.style.fontSize = '16px';
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
            let val = parseInt(minCountInput.value, 10);
            if (isNaN(val)) val = 1;
            if (val < 1) val = 1;
            if (val > 20) val = 20;
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
            let minVal = parseInt(inputMin.value, 10);
            let maxVal = parseInt(inputMax.value, 10);
            if (isNaN(minVal)) minVal = opts.inputMin;
            if (isNaN(maxVal)) maxVal = opts.inputMax;
            if (minVal < opts.inputMin) minVal = opts.inputMin;
            if (maxVal > opts.inputMax) maxVal = opts.inputMax;
            if (e && e.target === inputMin) {
                if (minVal === maxVal) {
                    maxVal = minVal + 1;
                    if (maxVal > opts.inputMax) maxVal = opts.inputMax;
                }
            } else if (e && e.target === inputMax) {
                if (maxVal === minVal) {
                    minVal = maxVal - 1;
                    if (minVal < opts.inputMin) minVal = opts.inputMin;
                }
            }
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
                const monsters = (globalThis.state && globalThis.state.player && globalThis.state.player.getSnapshot && globalThis.state.player.getSnapshot().context.monsters) || [];
                if (!Array.isArray(monsters)) throw new Error('Creature list unavailable');
                return monsters.filter(m => typeof m.genes === 'number' && m.genes >= minThreshold && m.genes <= maxThreshold).length;
            } catch (e) {
                summaryDiv.textContent = type + ' error: ' + (e && e.message ? e.message : 'Unknown error');
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
    // 5. Autoseller Session Stats Logic
    // =======================
    const autosellerSessionStats = {
        soldCount: 0,
        soldGold: 0,
        squeezedCount: 0,
        squeezedDust: 0
    };
    const autosellerSoldIds = new Set();
    // Add delay tracking variables
    let lastAutosellerRun = 0;
    const AUTOSELLER_MIN_DELAY_MS = 5000; // 5 seconds
    function updateAutosellerSessionWidget() {
        const widget = document.getElementById('autoseller-session-widget');
        if (!widget || !widget._statEls) return;
        const statEls = widget._statEls;
        if (statEls.soldCount) statEls.soldCount.textContent = `Sold: ${autosellerSessionStats.soldCount}`;
        if (statEls.soldGold) statEls.soldGold.textContent = `Gold: ${autosellerSessionStats.soldGold}`;
        if (statEls.squeezedCount) statEls.squeezedCount.textContent = `Squeezed: ${autosellerSessionStats.squeezedCount}`;
        if (statEls.squeezedDust) statEls.squeezedDust.textContent = `Dust: ${autosellerSessionStats.squeezedDust}`;
    }
    // Patch sell/squeeze logic to update session stats and widget
    async function squeezeEligibleMonsters(monsters) {
        try {
            const settings = getCachedSettings();
            if (!monsters) {
                monsters = await fetchServerMonsters();
            }
            if (!Array.isArray(monsters)) {
                const msg = '[Autoseller][DEBUG] Could not access monster list.';
                console.warn(msg);
                if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal) {
                    api.ui.components.createModal({
                        title: 'Autoseller Error',
                        content: '<p>Could not access your monster list from the server.</p>',
                        buttons: [{ text: 'OK', primary: true }]
                    });
                }
                return;
            }
            const { toSqueeze } = getEligibleMonsters(settings, monsters);
            if (!toSqueeze.length) {
                return;
            }
            // --- Session stats update ---
            autosellerSessionStats.squeezedCount += toSqueeze.length;
            autosellerSessionStats.squeezedDust += toSqueeze.length * 5; // Assume 1 squeezed = 5 dust
            updateAutosellerSessionWidget();
            // --- End session stats update ---
            toSqueeze.forEach(m => {
                console.log(`[Autoseller] SQUEEZE: id=${m.id}, stats total=${getGenes(m)}`);
            });
            const ids = toSqueeze.map(m => m.id).filter(Boolean);
            if (!ids.length) {
                return;
            }
            const url = 'https://bestiaryarena.com/api/trpc/inventory.monsterSqueezer?batch=1';
            const body = JSON.stringify({ "0": { json: ids } });
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'X-Game-Version': '1',
                },
                credentials: 'include',
                body
            });
            if (!resp.ok) {
                const msg = `[Autoseller][DEBUG] Squeeze API failed: HTTP ${resp.status}`;
                console.warn(msg);
                if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal) {
                    api.ui.components.createModal({
                        title: 'Autoseller Error',
                        content: `<p>Squeeze API failed. (HTTP ${resp.status})</p>`,
                        buttons: [{ text: 'OK', primary: true }]
                    });
                }
                return;
            }
            removeMonstersFromLocalInventory(ids);
        } catch (e) {
            console.warn('[Autoseller][DEBUG] Squeeze error:', e);
            if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal) {
                api.ui.components.createModal({
                    title: 'Autoseller Error',
                    content: `<p>Squeeze error:<br>${e && e.message ? e.message : e}</p>`,
                    buttons: [{ text: 'OK', primary: true }]
                });
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
                if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal) {
                    api.ui.components.createModal({
                        title: 'Autoseller Error',
                        content: '<p>Could not access your monster list from the server.</p>',
                        buttons: [{ text: 'OK', primary: true }]
                    });
                }
                return;
            }
            let { toSell } = getEligibleMonsters(settings, monsters);
            // Filter out already processed IDs
            toSell = toSell.filter(m => !autosellerSoldIds.has(m.id));
            if (!toSell.length) {
                return;
            }
            // --- Session stats update ---
            // (removed old commented-out code)
            // --- End session stats update ---
            toSell.forEach(m => {
                console.log(`[Autoseller] SELL: id=${m.id}, stats total=${getGenes(m)}`);
            });
            // --- Batching logic: max 20 per 10 seconds ---
            const BATCH_SIZE = 20;
            const BATCH_DELAY_MS = 10000;
            for (let i = 0; i < toSell.length; i += BATCH_SIZE) {
                const batch = toSell.slice(i, i + BATCH_SIZE);
                // eslint-disable-next-line no-await-in-loop
                await Promise.all(batch.map(async (m) => {
                    const id = m.id;
                    const url = 'https://bestiaryarena.com/api/trpc/game.sellMonster?batch=1';
                    const body = JSON.stringify({ "0": { json: id } });
                    console.log('[Autoseller][DEBUG] Selling monster with ID:', id, 'Payload:', body);
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'content-type': 'application/json',
                            'X-Game-Version': '1',
                        },
                        credentials: 'include',
                        body
                    });
                    if (!resp.ok) {
                        if (resp.status === 404) {
                            console.info(`[Autoseller] Monster ID ${id} not found on server (already sold or removed).`);
                            autosellerSoldIds.add(id); // Mark as processed even if 404
                        } else {
                            const msg = `[Autoseller] Sell API failed for ID ${id}: HTTP ${resp.status}`;
                            console.warn(msg);
                            if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal) {
                                api.ui.components.createModal({
                                    title: 'Autoseller Error',
                                    content: `<p>Sell API failed for ID ${id}. (HTTP ${resp.status})</p>`,
                                    buttons: [{ text: 'OK', primary: true }]
                                });
                            }
                        }
                        return;
                    }
                    let apiResponse;
                    try { apiResponse = await resp.json(); } catch (e) { apiResponse = '[Non-JSON response]'; }
                    // Only increment if we got a valid gold value and haven't processed this ID yet
                    if (
                      apiResponse &&
                      Array.isArray(apiResponse) &&
                      apiResponse[0]?.result?.data?.json?.goldValue != null &&
                      !autosellerSoldIds.has(id)
                    ) {
                        const goldReceived = apiResponse[0].result.data.json.goldValue;
                        autosellerSoldIds.add(id);
                        autosellerSessionStats.soldCount += 1;
                        autosellerSessionStats.soldGold += goldReceived;
                        updateAutosellerSessionWidget();
                    }
                    removeMonstersFromLocalInventory([id]);
                }));
                if (i + BATCH_SIZE < toSell.length) {
                    // Wait 10 seconds before next batch
                    await new Promise(res => setTimeout(res, BATCH_DELAY_MS));
                }
            }
            const player = globalThis.state?.player;
            const before = player?.getSnapshot?.().context?.monsters;
            console.log('[Autoseller][DEBUG] Local monsters before:', before);
            const after = player?.getSnapshot?.().context?.monsters;
            console.log('[Autoseller][DEBUG] Local monsters after:', after);
        } catch (e) {
            console.warn('[Autoseller][DEBUG] Sell error:', e);
            if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal) {
                api.ui.components.createModal({
                    title: 'Autoseller Error',
                    content: `<p>Sell error:<br>${e && e.message ? e.message : e}</p>`,
                    buttons: [{ text: 'OK', primary: true }]
                });
            }
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
                height: 500,
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
                    dialog.style.height = '500px';
                    dialog.style.minHeight = '500px';
                    dialog.style.maxHeight = '500px';
                    const contentElem = dialog.querySelector('.widget-bottom');
                    if (contentElem) {
                        contentElem.style.height = '420px';
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
        }
        tryInsert();
    }

    // =======================
    // 8. Autoseller Session Widget
    // =======================
    function createAutosellerSessionWidget() {
        if (document.getElementById('autoseller-session-widget')) return;
        const autoplayContainer = document.querySelector('.widget-bottom[data-minimized="false"]');
        if (!autoplayContainer) return;
        const widget = document.createElement('div');
        widget.className = 'mt-1.5';
        widget.id = 'autoseller-session-widget';
        const header = document.createElement('div');
        header.className = 'widget-top widget-top-text flex items-center gap-1.5';
        header.appendChild(document.createTextNode('Autoseller Session'));
        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'ml-auto flex h-5 w-5 items-center justify-center rounded-md hover:bg-black/40';
        minimizeBtn.title = 'Minimize';
        minimizeBtn.innerHTML = '−';
        minimizeBtn.style.border = '1px solid #888';
        minimizeBtn.style.background = 'transparent';
        minimizeBtn.style.borderRadius = '0';
        minimizeBtn.style.fontWeight = 'bold';
        minimizeBtn.style.fontSize = '16px';
        minimizeBtn.style.cursor = 'pointer';
        let minimized = false;
        minimizeBtn.onclick = () => {
            minimized = !minimized;
            if (body) body.style.display = minimized ? 'none' : '';
            minimizeBtn.innerHTML = minimized ? '&#x25B2;' : '−';
        };
        header.appendChild(minimizeBtn);
        widget.appendChild(header);
        const body = document.createElement('div');
        body.className = 'widget-bottom p-0';
        body.style.padding = '4px 0 8px 0';
        body.style.display = 'flex';
        body.style.flexDirection = 'column';
        body.style.justifyContent = 'center';
        body.style.height = '100%';
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexDirection = 'row';
        row.style.justifyContent = 'flex-start';
        row.style.alignItems = 'center';
        row.style.gap = '16px';
        row.style.margin = '0';
        const slotData = [
            { type: 'sold', label: 'Sold', value: 0, extra: 'Gold', extraValue: 0 },
            { type: 'squeezed', label: 'Squeezed', value: 0, extra: 'Dust', extraValue: 0 }
        ];
        widget._statEls = {};
        slotData.forEach(evt => {
            const slotDiv = document.createElement('div');
            slotDiv.className = 'container-slot surface-darker';
            slotDiv.style.border = '4px solid transparent';
            slotDiv.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch';
            slotDiv.style.borderRadius = '6px';
            slotDiv.style.width = '100px';
            slotDiv.style.height = '90px';
            slotDiv.style.display = 'flex';
            slotDiv.style.flexDirection = 'column';
            slotDiv.style.alignItems = 'center';
            slotDiv.style.justifyContent = 'center';
            slotDiv.style.padding = '10px 6px';
            slotDiv.style.position = 'relative';
            slotDiv.style.margin = '0 8px';
            const countDiv = document.createElement('div');
            countDiv.style.fontSize = '13px';
            countDiv.style.fontWeight = 'bold';
            countDiv.style.color = '#fff';
            countDiv.style.marginBottom = '12px';
            countDiv.id = `autoseller-session-${evt.type}-count`;
            countDiv.textContent = `${evt.label}: ${evt.value}`;
            slotDiv.appendChild(countDiv);
            const extraDiv = document.createElement('div');
            extraDiv.style.fontSize = '12px';
            extraDiv.style.fontWeight = 'bold';
            extraDiv.style.color = '#fff';
            extraDiv.id = `autoseller-session-${evt.type}-${evt.extra.toLowerCase()}`;
            extraDiv.textContent = `${evt.extra}: ${evt.extraValue}`;
            slotDiv.appendChild(extraDiv);
            row.appendChild(slotDiv);
            widget._statEls[`${evt.type}Count`] = countDiv;
            widget._statEls[`${evt.type}${evt.extra}`] = extraDiv;
        });
        row.style.margin = '24px 0 0 0';
        body.appendChild(row);
        widget.appendChild(body);
        if (autoplayContainer) autoplayContainer.appendChild(widget);
    }

    function updateAutosellerSessionWidget() {
        const widget = document.getElementById('autoseller-session-widget');
        if (!widget || !widget._statEls) return;
        const statEls = widget._statEls;
        if (statEls.soldCount) statEls.soldCount.textContent = `Sold: ${autosellerSessionStats.soldCount}`;
        if (statEls.soldGold) statEls.soldGold.textContent = `Gold: ${autosellerSessionStats.soldGold}`;
        if (statEls.squeezedCount) statEls.squeezedCount.textContent = `Squeezed: ${autosellerSessionStats.squeezedCount}`;
        if (statEls.squeezedDust) statEls.squeezedDust.textContent = `Dust: ${autosellerSessionStats.squeezedDust}`;
    }

    // Inject the widget when autoplay UI appears
    let autosellerWidgetObserver = null;
    function setupAutosellerWidgetObserver() {
        if (autosellerWidgetObserver) return;
        createAutosellerSessionWidget();
        updateAutosellerSessionWidget();
        if (typeof MutationObserver !== 'undefined') {
            autosellerWidgetObserver = new MutationObserver(() => {
                const autoplayContainer = document.querySelector('.widget-bottom[data-minimized="false"]');
                const widgetExists = !!document.getElementById('autoseller-session-widget');
                if (autoplayContainer && !widgetExists) {
                    autosellerWidgetObserver.disconnect();
                    createAutosellerSessionWidget();
                    updateAutosellerSessionWidget();
                    autosellerWidgetObserver.observe(document.body, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['data-minimized']
                    });
                }
            });
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
        setupAutosellerWidgetObserver(); // <--- Inject widget observer
        let lastProcessedBattleKey = null;
        if (globalThis.state.board && globalThis.state.board.subscribe) {
            globalThis.state.board.subscribe(async ({ context }) => {
                const serverResults = context.serverResults;
                if (!serverResults || !serverResults.rewardScreen || typeof serverResults.rewardScreen.gameTicks !== 'number') return;
                const seed = serverResults.seed;
                const gameTicks = serverResults.rewardScreen.gameTicks;
                const battleKey = `${seed}:${gameTicks}`;
                if (battleKey === lastProcessedBattleKey) return; // Already scheduled/processed
                lastProcessedBattleKey = battleKey; // Mark as scheduled
                const inventorySnapshot = await fetchServerMonsters();
                const waitSeconds = gameTicks / 16;
                setTimeout(async () => {
                    const now = Date.now();
                    if (now - lastAutosellerRun < AUTOSELLER_MIN_DELAY_MS) {
                        console.log('[Autoseller] Skipping run: waiting for server to update.');
                        return;
                    }
                    lastAutosellerRun = now;
                    // Clear sold IDs for this session (removed to avoid state conflicts)
                    console.log('[Autoseller] Wait elapsed. Running squeezeEligibleMonsters and sellEligibleMonsters.');
                    const settings = getCachedSettings();
                    if (!settings.autosellChecked && !settings.autosqueezeChecked) {
                        console.log('[Autoseller] Both autosell and autosqueeze are disabled. Skipping execution.');
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
            cleanup: function() {
                // Remove Autoseller session widget
                const widget = document.getElementById('autoseller-session-widget');
                if (widget && widget.parentNode) widget.parentNode.removeChild(widget);
                // Disconnect MutationObserver
                if (autosellerWidgetObserver && typeof autosellerWidgetObserver.disconnect === 'function') {
                    autosellerWidgetObserver.disconnect();
                    autosellerWidgetObserver = null;
                }
                // Remove nav button
                const navBtn = document.querySelector('.autoseller-nav-btn');
                if (navBtn && navBtn.parentNode) navBtn.parentNode.removeChild(navBtn);
                // Remove injected style
                const style = document.getElementById('autoseller-responsive-style');
                if (style && style.parentNode) style.parentNode.removeChild(style);
            }
        };
    }

})(); 