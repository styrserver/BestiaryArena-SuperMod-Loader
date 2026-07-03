// Better Tasker - A mod for Bestiary Arena
console.log('[Better Tasker] initializing...');

// ============================================================================
// 1. CONSTANTS
// ============================================================================

const MOD_ID = 'better-tasker';
const TASKER_BUTTON_ID = `${MOD_ID}-settings-button`;
const TASKER_TOGGLE_ID = `${MOD_ID}-toggle-button`;
const TASKER_NEXT_TASK_TIMER_ID = `${MOD_ID}-next-task-timer`;

// Translation helper
const t = (key) => {
    if (typeof api !== 'undefined' && api.i18n && api.i18n.t) {
        return api.i18n.t(key);
    }
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

// Default settings constants
const DEFAULT_TASK_START_DELAY = 3;

// Unobtainable creatures shown disabled in settings (cannot appear in Paw and Fur tasks)
const UNSELECTABLE_CREATURES = [
    'Firestarter',
    'Polar Bear',
    'Swamp Troll',
    'Tortoise',
    'Yeti'
];

function isGazerCreature(creatureName, gameId = null) {
    const db = window.creatureDatabase;
    if (gameId != null && db?.ALL_GAZER_GAME_IDS?.has(Number(gameId))) {
        return true;
    }
    return typeof db?.isGazerCreatureName === 'function' && db.isGazerCreatureName(creatureName);
}

function isEventCreature(creatureName) {
    const db = window.creatureDatabase;
    if (typeof db?.isEventCreatureName === 'function') {
        return db.isEventCreatureName(creatureName);
    }
    const norm = String(creatureName ?? '').trim().toLowerCase();
    return Array.isArray(db?.EVENT_CREATURES) &&
        db.EVENT_CREATURES.some((name) => name.toLowerCase() === norm);
}

function getTaskerPickerCreatures() {
    const db = window.creatureDatabase;
    if (typeof db?.getAutoscrollAutosellerCreaturePickerNames === 'function') {
        return db.getAutoscrollAutosellerCreaturePickerNames();
    }
    return (db?.ALL_CREATURES || []).filter(
        (name) => !isGazerCreature(name) && !isEventCreature(name)
    );
}

// Tasker states
const TASKER_STATES = {
    DISABLED: 'disabled',
    NEW_TASK_ONLY: 'new_task_only',
    ENABLED: 'enabled'
};
const DEFAULT_TASKER_STATE = TASKER_STATES.DISABLED;

/** Vanilla quest nav icon (fallback when originalState was never captured). */
const DEFAULT_QUEST_ICON_SRC = 'https://bestiaryarena.com/assets/icons/quest.png';

// Timing constants
const NAVIGATION_DELAY = 500;
const AUTO_SETUP_DELAY = 800;
const AUTOPLAY_SETUP_DELAY = 500;
const AUTOMATION_CHECK_DELAY = 300;
const BESTIARY_INTEGRATION_DELAY = 300;
const BESTIARY_RETRY_DELAY = 1500;
const BESTIARY_INIT_WAIT = 2000;

// User-configurable delays
const DEFAULT_START_DELAY = 3;         // 3 seconds default (user-configurable 1-10)
const MAX_START_DELAY = 10;            // 10 seconds maximum
const ESC_KEY_DELAY = 50;
const TASK_START_DELAY = 200;
const MANUAL_PLAY_PAUSE_MS = 180000; // 3 minutes — back off after user changes map manually
const PROGRAMMATIC_NAV_GUARD_MS = 5000;

// Stamina constants
const DEFAULT_STAMINA_COST = 30;

// Paw and Fur-style tasks: default kill quota when API does not expose a goal field
const DEFAULT_TASK_KILL_TARGET = 60;

// ============================================================================
// 1.1. DOM UTILITY FUNCTIONS
// ============================================================================

// Utility function to handle control request/release with proper error handling
function withControl(manager, modName, callback, errorContext = 'operation') {
    // Request control
    if (!manager.requestControl(modName)) {
        console.log(`[Better Tasker] Cannot ${errorContext} - controlled by another mod`);
        return false;
    }
    
    try {
        const result = callback();
        return result;
    } catch (error) {
        console.error(`[Better Tasker] Error during ${errorContext}:`, error);
        return false;
    } finally {
        // Always release control
        manager.releaseControl(modName);
    }
}

// Create a styled button with consistent styling
function createStyledButton(id, text, color, onClick) {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = text;
    button.className = `focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-${color} active:frame-pressed-1-${color} surface-${color} gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight`;
    button.style.cssText = `
        padding: 2px 6px;
        height: 20px;
    `;
    button.addEventListener('click', onClick);
    return button;
}

// Create a styled button with custom styling
function createCustomStyledButton(id, text, className, style, onClick) {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = text;
    button.className = className;
    button.style.cssText = style;
    button.addEventListener('click', onClick);
    return button;
}

// Create a styled container div
function createStyledContainer(className, style) {
    const container = document.createElement('div');
    if (className) container.className = className;
    if (style) container.style.cssText = style;
    return container;
}

// Create a styled input element
function createStyledInput(type, id, value, style, attributes = {}) {
    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    if (value !== undefined) input.value = value;
    if (style) input.style.cssText = style;
    
    // Apply additional attributes
    Object.entries(attributes).forEach(([key, val]) => {
        input[key] = val;
    });
    
    return input;
}

// Helper function to add tracked event listeners
function addTrackedListener(element, event, handler) {
    element.addEventListener(event, handler);
    if (!trackedListeners.has(element)) {
        trackedListeners.set(element, []);
    }
    trackedListeners.get(element).push({ event, handler });
}

// Helper function to clear tracked timeouts
function clearTrackedTimeouts() {
    safetyTimeouts.forEach(timeoutId => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    });
    safetyTimeouts = [];
}

// Create a reusable checkbox setting with label and description
function createCheckboxSetting(id, labelText, description, checked = false) {
    const settingDiv = document.createElement('div');
    settingDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    // Container for checkbox and label on same line
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
        accent-color: #ffe066;
    `, { checked });
    // Add auto-save listener with tracking
    addTrackedListener(checkbox, 'change', autoSaveSettings);
    checkboxLabelContainer.appendChild(checkbox);
    
    const label = document.createElement('label');
    label.textContent = labelText;
    label.className = 'pixel-font-16';
    label.style.cssText = `
        font-weight: bold;
        color: #fff;
        cursor: pointer;
    `;
    label.setAttribute('for', id);
    checkboxLabelContainer.appendChild(label);
    
    settingDiv.appendChild(checkboxLabelContainer);
    
    const desc = document.createElement('div');
    desc.textContent = description;
    desc.className = 'pixel-font-16';
    desc.style.cssText = `
        font-size: 11px;
        color: #888;
        font-style: italic;
        margin-top: 2px;
    `;
    settingDiv.appendChild(desc);
    
    return settingDiv;
}

function attachSettingsListRowHover(rowEl, isDimmed) {
    if (!rowEl) return;
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

function getCreatureSettingsKey(creatureName) {
    if (!creatureName) return '';
    return `creature-${String(creatureName).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
}

function getCreatureGameIdByName(creatureName) {
    try {
        if (!creatureName) return null;
        const monster = window.creatureDatabase?.findMonsterByName?.(creatureName);
        const gameId = Number(monster?.gameId);
        return Number.isFinite(gameId) ? gameId : null;
    } catch (_) {
        return null;
    }
}

function getCreatureNameByGameId(creatureId) {
    try {
        const id = Number(creatureId);
        if (!Number.isFinite(id)) return null;
        const monster = window.creatureDatabase?.findMonsterByGameId?.(id)
            ?? globalThis.state?.utils?.getMonster?.(id);
        const name = String(monster?.metadata?.name || '').trim();
        return name || null;
    } catch (_) {
        return null;
    }
}

function getAllMapOptions(creatureName = null) {
    try {
        const roomNameMap = globalThis.state?.utils?.ROOM_NAME;
        if (!roomNameMap || typeof roomNameMap !== 'object') return [];
        const mapsDb = window.mapsDatabase;
        let rows = Object.entries(roomNameMap)
            .map(([id, name]) => ({ id: String(id), name: String(name || '').trim() }))
            .filter((entry) => entry.id && entry.name)
            .sort((a, b) => a.name.localeCompare(b.name));

        // Exclude raid + dynamic event maps from task creature overrides.
        rows = rows.filter((row) => {
            try {
                if (mapsDb && typeof mapsDb.isRaid === 'function' && mapsDb.isRaid(row.id)) {
                    return false;
                }
                if (mapsDb && typeof mapsDb.isDynamicEventMap === 'function' && mapsDb.isDynamicEventMap(row.id)) {
                    return false;
                }
                // Fallback if mapsDatabase is unavailable or incomplete.
                const room = typeof mapsDb?.getMapById === 'function'
                    ? mapsDb.getMapById(row.id)
                    : (globalThis.state?.utils?.ROOMS || []).find((r) => String(r?.id) === row.id);
                if (room?.raid === true) return false;
                return true;
            } catch (_) {
                return true;
            }
        });

        const creatureGameId = getCreatureGameIdByName(creatureName);
        const getBoardMonstersFromRoomId = globalThis.state?.utils?.getBoardMonstersFromRoomId;
        if (creatureGameId != null && typeof getBoardMonstersFromRoomId === 'function') {
            rows = rows.filter((row) => {
                try {
                    const board = getBoardMonstersFromRoomId(row.id);
                    if (!board) return false;
                    const pieces = Array.isArray(board) ? board : Object.values(board);
                    return pieces.some((piece) => Number(piece?.gameId) === creatureGameId);
                } catch (_) {
                    return false;
                }
            });
        }
        return rows;
    } catch (error) {
        console.error('[Better Tasker] Error getting map options:', error);
        return [];
    }
}

let betterTaskerOpenCreatureContextMenu = null;

function getCreatureOverrides(creatureName) {
    try {
        if (!creatureName) return null;
        const settings = loadSettings();
        const key = getCreatureSettingsKey(creatureName);
        return settings.creatureOverrides?.[key] || settings.creatureOverrides?.[creatureName] || null;
    } catch (_) {
        return null;
    }
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
    addTrackedListener(selectElement, 'change', autoSaveSettings);
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

function closeCreatureContextMenu() {
    if (betterTaskerOpenCreatureContextMenu?.closeMenu) {
        betterTaskerOpenCreatureContextMenu.closeMenu();
    }
}

function createCreatureContextMenu(creatureName, x, y, onClose) {
    closeCreatureContextMenu();

    const settings = loadSettings();
    const creatureKey = getCreatureSettingsKey(creatureName);
    const existing = settings.creatureOverrides?.[creatureKey] || {};
    const mapOptions = getAllMapOptions(creatureName);
    const setupOptions = getAvailableSetupOptions();

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; inset: 0; z-index: 9998; background: transparent;';

    const menu = document.createElement('div');
    menu.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: min(250px, 94vw);
        min-width: min(250px, 94vw);
        max-width: min(250px, 94vw);
        height: min(270px, 82vh);
        min-height: min(270px, 82vh);
        max-height: min(270px, 82vh);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 5px;
        border: 1px solid #444;
        background: url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png") repeat;
        color: #fff;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
        box-sizing: border-box;
    `;

    const shell = document.createElement('div');
    shell.style.cssText = `
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        padding: 10px;
        box-sizing: border-box;
        gap: 10px;
        min-height: 0;
    `;

    const title = document.createElement('h3');
    title.className = 'pixel-font-16';
    title.textContent = creatureName;
    title.style.cssText = `
        margin: 0;
        color: #ffe066;
        font-weight: bold;
        text-align: center;
        flex-shrink: 0;
    `;

    const contentPanel = document.createElement('div');
    contentPanel.style.cssText = `
        flex: 1 1 0%;
        min-height: 0;
        overflow: hidden;
        border: 1px solid #444;
        border-radius: 5px;
        background: rgba(0, 0, 0, 0.2);
        padding: 10px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;

    const sectionLabel = document.createElement('div');
    sectionLabel.className = 'pixel-font-14';
    sectionLabel.textContent = t('mods.betterTasker.defaultForCreature');
    sectionLabel.style.cssText = 'color:#ffe066; font-size:12px; font-weight:bold; margin:0 0 2px 0;';

    const mapSelect = document.createElement('select');
    mapSelect.className = 'pixel-font-14';
    mapSelect.style.cssText = 'width:100%; padding:6px; border:1px solid #ffe066; border-radius:3px; background:#2a2a2a; color:#fff; box-sizing:border-box;';

    const refillWrap = document.createElement('label');
    refillWrap.className = 'pixel-font-14';
    refillWrap.style.cssText = 'display:flex; align-items:center; gap:8px; color:#fff; margin:2px 0;';
    const refillCheckbox = document.createElement('input');
    refillCheckbox.type = 'checkbox';
    refillCheckbox.style.cssText = 'width:16px; height:16px; accent-color:#ffe066; cursor:pointer;';
    refillCheckbox.checked = existing.autoRefillStamina !== undefined ? !!existing.autoRefillStamina : !!settings.autoRefillStamina;
    refillWrap.appendChild(refillCheckbox);
    refillWrap.appendChild(document.createTextNode(t('mods.betterTasker.autoRefillStamina')));

    const floorSelect = document.createElement('select');
    floorSelect.className = 'pixel-font-14';
    floorSelect.style.cssText = mapSelect.style.cssText;
    for (let i = 0; i <= 15; i++) {
        const optionElement = document.createElement('option');
        optionElement.value = String(i);
        optionElement.textContent = `Floor ${i}`;
        floorSelect.appendChild(optionElement);
    }
    floorSelect.value = String(existing.floor != null ? Math.max(0, Math.min(15, Number(existing.floor) || 0)) : 0);

    const setupSelect = document.createElement('select');
    setupSelect.className = 'pixel-font-14';
    setupSelect.style.cssText = mapSelect.style.cssText;
    setupOptions.forEach((option) => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        setupSelect.appendChild(optionElement);
    });
    setupSelect.value = setupOptions.includes(existing.setupMethod) ? existing.setupMethod : (settings.setupMethod || setupOptions[0]);

    const rebuildMapOptions = () => {
        const selectedBefore = mapSelect.value;
        mapSelect.innerHTML = '';
        const autoOption = document.createElement('option');
        autoOption.value = '';
        autoOption.textContent = t('mods.betterTasker.useSuggestedMap');
        mapSelect.appendChild(autoOption);

        mapOptions.forEach((mapOption) => {
            const optionElement = document.createElement('option');
            optionElement.value = mapOption.id;
            optionElement.textContent = mapOption.name;
            mapSelect.appendChild(optionElement);
        });

        const initialMapId = existing.mapId != null ? String(existing.mapId) : '';
        const hasSelected = !!selectedBefore && [...mapSelect.options].some((o) => o.value === selectedBefore);
        const hasInitial = [...mapSelect.options].some((o) => o.value === initialMapId);
        mapSelect.value = hasSelected ? selectedBefore : (hasInitial ? initialMapId : '');
        console.log('[Better Tasker] Creature context map select initialized:', {
            creatureName,
            creatureKey,
            selectedBefore,
            initialMapId,
            hasSelected,
            hasInitial,
            resolvedValue: mapSelect.value
        });
        mapSelect.size = 1;
    };
    rebuildMapOptions();

    const persist = (reason = 'unknown') => {
        const latest = loadSettings();
        if (!latest.creatureOverrides || typeof latest.creatureOverrides !== 'object') {
            latest.creatureOverrides = {};
        }
        const nextOverride = {
            mapId: mapSelect.value || null,
            floor: Math.max(0, Math.min(15, Number(floorSelect.value) || 0)),
            setupMethod: setupSelect.value || latest.setupMethod || 'Auto-setup',
            autoRefillStamina: !!refillCheckbox.checked
        };
        latest.creatureOverrides[creatureKey] = nextOverride;
        localStorage.setItem('betterTaskerSettings', JSON.stringify(latest));
        console.log('[Better Tasker] Creature context persisted:', {
            reason,
            creatureName,
            creatureKey,
            override: nextOverride
        });
    };

    [mapSelect, floorSelect, setupSelect, refillCheckbox].forEach((el) => {
        el.addEventListener('change', () => persist('change'));
        // Some environments close custom menus before <select> emits 'change'.
        // Persisting on 'input' improves reliability for map selection.
        el.addEventListener('input', () => persist('input'));
    });

    const resetBtn = createStyledButton('bt-reset-creature-ctx', t('mods.betterTasker.reset'), 'red', () => {
        const latest = loadSettings();
        if (latest.creatureOverrides?.[creatureKey]) {
            delete latest.creatureOverrides[creatureKey];
            localStorage.setItem('betterTaskerSettings', JSON.stringify(latest));
            console.log('[Better Tasker] Creature context reset:', { creatureName, creatureKey });
        }
        rebuildMapOptions();
        mapSelect.value = '';
        floorSelect.value = '0';
        const fallbackSetup = latest.setupMethod || setupOptions[0] || 'Auto-setup';
        setupSelect.value = setupOptions.includes(fallbackSetup) ? fallbackSetup : (setupOptions[0] || 'Auto-setup');
        refillCheckbox.checked = !!latest.autoRefillStamina;
    });
    const closeBtn = createStyledButton('bt-close-creature-ctx', t('mods.betterTasker.close'), 'green', () => closeMenu());
    resetBtn.style.flex = '1';
    closeBtn.style.flex = '1';

    const controls = document.createElement('div');
    controls.style.cssText = `
        display:flex;
        flex-direction:column;
        gap:8px;
        border: 1px solid #555;
        border-radius: 3px;
        background: rgba(0,0,0,0.3);
        padding: 8px;
        box-sizing: border-box;
        overflow-y: auto;
        min-height: 0;
        flex: 1 1 auto;
    `;
    controls.appendChild(sectionLabel);
    controls.appendChild(mapSelect);
    controls.appendChild(refillWrap);
    controls.appendChild(floorSelect);
    controls.appendChild(setupSelect);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex; gap:8px; justify-content:center; flex-shrink:0;';
    footer.appendChild(resetBtn);
    footer.appendChild(closeBtn);

    const handleDocPointerDown = (e) => {
        if (menu.contains(e.target)) return;
        // Native <select> dropdowns often report mousedown targets outside the menu DOM,
        // which would remove the menu before 'change' runs — so the map never persisted.
        setTimeout(() => {
            if (!document.body.contains(menu)) return;
            const active = document.activeElement;
            if (active && menu.contains(active)) return;
            closeMenu();
        }, 0);
    };

    function closeMenu() {
        // Always persist on close so selected creature overrides are not lost
        // when the menu closes before a native <select> change event fires.
        persist('close-menu');
        console.log('[Better Tasker] Creature context menu closed:', { creatureName, creatureKey });
        document.removeEventListener('mousedown', handleDocPointerDown, true);
        overlay.remove();
        menu.remove();
        if (betterTaskerOpenCreatureContextMenu?.overlay === overlay) {
            betterTaskerOpenCreatureContextMenu = null;
        }
        if (typeof onClose === 'function') onClose();
    }

    overlay.addEventListener('mousedown', closeMenu);
    menu.addEventListener('mousedown', (e) => e.stopPropagation());
    document.addEventListener('mousedown', handleDocPointerDown, true);

    contentPanel.appendChild(controls);
    shell.appendChild(title);
    shell.appendChild(contentPanel);
    shell.appendChild(footer);
    menu.appendChild(shell);
    document.body.appendChild(overlay);
    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
    menu.style.left = `${Math.min(Math.max(8, x), maxLeft)}px`;
    menu.style.top = `${Math.min(Math.max(8, y), maxTop)}px`;

    betterTaskerOpenCreatureContextMenu = { overlay, menu, closeMenu };
}

// Sleep function for delays
function sleep(timeout = 1000) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, timeout);
    });
}

// Clear modals by simulating ESC key presses (async version with delays)
async function clearModalsWithEsc(count = 3, delayBetween = ESC_KEY_DELAY) {
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
        if (i < count - 1) {
            await sleep(delayBetween);
        }
    }
}

// Clear modals by simulating ESC key presses (sync version without delays)
function clearModalsWithEscSync(count = 3) {
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

function getQuestLogRootElement() {
    const container = findQuestLogContainer();
    if (!container) {
        return null;
    }
    return container.closest('[role="dialog"]') || container.closest('.widget-bottom') || container;
}

function isQuestLogOpen() {
    return !!findQuestLogContainer();
}

function clickQuestLogCloseButtons() {
    const questLogRoot = getQuestLogRootElement();
    if (!questLogRoot) {
        return false;
    }

    const closeText = t('controls.close');
    let clickedCount = 0;

    for (const button of questLogRoot.querySelectorAll('button')) {
        if (button.textContent.trim() === closeText && isElementVisible(button)) {
            console.log(`[Better Tasker] Clicking quest log close button: "${closeText}"`);
            button.click();
            clickedCount++;
        }
    }

    if (clickedCount > 0) {
        console.log(`[Better Tasker] Clicked ${clickedCount} quest log close button(s)`);
    }

    return clickedCount > 0;
}

async function closeQuestLogIfOpen() {
    if (!isQuestLogOpen()) {
        return false;
    }

    console.log('[Better Tasker] Closing quest log (scoped)...');
    clickQuestLogCloseButtons();

    if (isQuestLogOpen()) {
        await clearModalsWithEsc(1);
        await sleep(50);
        clickQuestLogCloseButtons();
    }

    await sleep(AUTOMATION_CHECK_DELAY);
    return true;
}

async function clearScrollLockIfNeeded() {
    if (document.body?.hasAttribute?.('data-scroll-locked')) {
        await clearModalsWithEsc(1);
        await sleep(100);
        return true;
    }
    return false;
}

function markProgrammaticNavigation() {
    programmaticNavigationUntil = Date.now() + PROGRAMMATIC_NAV_GUARD_MS;
    if (typeof window.markModSettingsProgrammaticNavFloorGuard === 'function') {
        window.markModSettingsProgrammaticNavFloorGuard('better-tasker');
    }
}

function isProgrammaticNavigationActive() {
    return Date.now() < programmaticNavigationUntil;
}

function pauseAutomationForManualPlay(reason) {
    manualPlayPauseUntil = Date.now() + MANUAL_PLAY_PAUSE_MS;
    console.log(
        `[Better Tasker] Manual play pause (${Math.round(MANUAL_PLAY_PAUSE_MS / 1000)}s): ${reason}`
    );
    updateExposedState();
}

function isManualPlayPaused() {
    return Date.now() < manualPlayPauseUntil;
}

function isActiveStateSubscription(subscription) {
    return typeof subscription === 'function'
        || (subscription && typeof subscription.unsubscribe === 'function');
}

function invokeStateSubscription(subscription) {
    if (typeof subscription === 'function') {
        subscription();
        return;
    }
    if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
    }
}

function setupManualPlayDetection() {
    if (isActiveStateSubscription(manualPlayBoardUnsubscribe)) {
        return;
    }

    try {
        if (!globalThis.state?.board?.subscribe) {
            return;
        }

        lastTrackedRoomIdForManualPlay = getCurrentRoomId();
        manualPlayBoardUnsubscribe = globalThis.state.board.subscribe((state) => {
            try {
                if (taskerState !== TASKER_STATES.ENABLED) {
                    return;
                }

                const roomId = state.context?.selectedMap?.selectedRoom?.id;
                if (!roomId || roomId === lastTrackedRoomIdForManualPlay) {
                    return;
                }

                const previousRoomId = lastTrackedRoomIdForManualPlay;
                lastTrackedRoomIdForManualPlay = roomId;

                if (isProgrammaticNavigationActive()) {
                    return;
                }

                if (taskingMapId && roomId !== taskingMapId) {
                    pauseAutomationForManualPlay(`user left tasking map (${previousRoomId} -> ${roomId})`);
                    taskNavigationCompleted = true;
                } else if (!taskHuntingOngoing && !taskOperationInProgress) {
                    pauseAutomationForManualPlay(`manual map selection (${previousRoomId} -> ${roomId})`);
                }
            } catch (error) {
                console.error('[Better Tasker] Error in manual play detection:', error);
            }
        });
    } catch (error) {
        console.error('[Better Tasker] Error setting up manual play detection:', error);
    }
}

function teardownManualPlayDetection() {
    if (isActiveStateSubscription(manualPlayBoardUnsubscribe)) {
        try {
            invokeStateSubscription(manualPlayBoardUnsubscribe);
        } catch (error) {
            console.error('[Better Tasker] Error tearing down manual play detection:', error);
        }
        manualPlayBoardUnsubscribe = null;
    }
    lastTrackedRoomIdForManualPlay = null;
}

function showTaskStartToast() {
    const now = Date.now();
    if (now - lastTaskStartToastAt < TASK_START_TOAST_COOLDOWN_MS) {
        return;
    }
    lastTaskStartToastAt = now;
    showToast('Starting Better Tasker');
}

function claimTaskOperation(operationLabel = 'task operation') {
    if (taskOperationInProgress) {
        return false;
    }
    taskOperationInProgress = true;
    updateExposedState();
    console.log(`[Better Tasker] Task operation claimed: ${operationLabel}`);

    const safetyTimeout = setTimeout(() => {
        if (taskOperationInProgress) {
            console.log('[Better Tasker] Safety timeout: Resetting taskOperationInProgress flag after 30 seconds');
            taskOperationInProgress = false;
            updateExposedState();
        }
    }, 30000);
    safetyTimeouts.push(safetyTimeout);

    return true;
}

function releaseTaskOperation() {
    if (!taskOperationInProgress) {
        return;
    }
    taskOperationInProgress = false;
    updateExposedState();
}

function clearTaskCompletionRetryTimeout() {
    if (taskCompletionRetryTimeout) {
        clearTimeout(taskCompletionRetryTimeout);
        taskCompletionRetryTimeout = null;
    }
}

function releaseTaskCompletionFlow(clearOperation = true) {
    taskCompletionInProgress = false;
    pendingTaskCompletion = false;
    if (clearOperation) {
        taskOperationInProgress = false;
    }
    clearTaskCompletionRetryTimeout();
    updateExposedState();
}

function scheduleTaskCompletionRetry(reason) {
    const taskStillReady = globalThis.state?.player?.getSnapshot?.()?.context?.questLog?.task?.ready;
    if (!taskStillReady) {
        releaseTaskCompletionFlow();
        return;
    }

    console.log(`[Better Tasker] Scheduling task completion retry (${TASK_COMPLETION_RETRY_DELAY_MS}ms): ${reason}`);
    clearTaskCompletionRetryTimeout();
    taskCompletionInProgress = false;
    pendingTaskCompletion = true;
    updateExposedState();

    taskCompletionRetryTimeout = setTimeout(() => {
        taskCompletionRetryTimeout = null;
        void handlePostGameTaskCompletion(false);
    }, TASK_COMPLETION_RETRY_DELAY_MS);
}

// ============================================================================
// 1.2. STAMINA MONITORING FUNCTIONS
// ============================================================================

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
            console.log('[Better Tasker] Stamina element not found');
            return 0;
        }
        
        const staminaElement = elStamina.querySelector('span span');
        if (!staminaElement) {
            console.log('[Better Tasker] Stamina text element not found');
            return 0;
        }
        
        const stamina = Number(staminaElement.textContent);
        return stamina;
    } catch (error) {
        console.error('[Better Tasker] Error reading stamina:', error);
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
        
        return DEFAULT_STAMINA_COST;
    } catch (error) {
        console.error('[Better Tasker] Error getting stamina cost:', error);
        return DEFAULT_STAMINA_COST;
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
        console.log(`[Better Tasker] Tooltip check: Insufficient (needs ${cost})`);
        return { insufficient: true, cost };
    }
    
    // No tooltip = sufficient stamina (trust the game)
    return { insufficient: false, cost };
}

/**
 * Set up hybrid stamina monitoring (tooltip watching + API for progress)
 * Uses tooltip as truth for recovery, API for progress tracking
 * @param {Function} onRecovered - Callback when stamina recovers
 * @param {number} requiredStamina - Stamina cost for this map (optional for continuous monitoring)
 */
function startStaminaTooltipMonitoring(onRecovered, requiredStamina = null) {
    // Clean up any existing monitoring
    if (staminaTooltipObserver) {
        stopStaminaTooltipMonitoring();
    }
    
    staminaRecoveryCallback = onRecovered;
    const staminaTooltipSel =
        '[role="tooltip"] img[alt="stamina"], [data-state="instant-open"] img[alt="stamina"]';
    // Only treat "recovered" after we have actually seen insufficient stamina (tooltip or API).
    // Default true caused false recoveries when stamina was already fine (no tooltip) → bogus Start click + navigation reset.
    let hasStaminaIssue = hasInsufficientStamina().insufficient || !!document.querySelector(staminaTooltipSel);
    
    // PRIMARY METHOD: Interval-based API checking for progress tracking (every 5 seconds)
    const staminaCheckInterval = setInterval(() => {
        const currentStamina = getCurrentStamina();
        
        const tooltipStillExists = !!document.querySelector(staminaTooltipSel);
        
        if (tooltipStillExists) {
            hasStaminaIssue = true;
            if (requiredStamina) {
                const timeRemaining = Math.max(0, requiredStamina - currentStamina);
                console.log(`[Better Tasker] Waiting for stamina (${currentStamina}/${requiredStamina}) - ~${timeRemaining} min remaining`);
            }
        } else if (hasStaminaIssue) {
            console.log(`[Better Tasker] ✅ STAMINA RECOVERED (tooltip gone) - current: ${currentStamina}`);
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
    }, STAMINA_CHECK_INTERVAL_MS);
    
    // Store interval for cleanup
    window.betterTaskerStaminaInterval = staminaCheckInterval;
    
    // BACKUP METHOD: MutationObserver for tooltip removal (instant detection) + appearance (arm recovery)
    staminaTooltipObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && node.querySelector?.(staminaTooltipSel)) {
                    hasStaminaIssue = true;
                }
            });
            mutation.removedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const wasStaminaTooltip = 
                        (node.matches?.('[role="tooltip"]') || node.matches?.('[data-state="instant-open"]')) &&
                        node.querySelector?.('img[alt="stamina"]');
                    
                    if (wasStaminaTooltip && hasStaminaIssue) {
                        const currentStamina = getCurrentStamina();
                        console.log(`[Better Tasker] ✅ STAMINA RECOVERED (tooltip removed) - current: ${currentStamina}`);
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
    
}

/**
 * Stop stamina tooltip monitoring
 */
function stopStaminaTooltipMonitoring() {
    // Clear interval-based API checking
    if (window.betterTaskerStaminaInterval) {
        clearInterval(window.betterTaskerStaminaInterval);
        window.betterTaskerStaminaInterval = null;
    }

    if (window.betterTaskerDepletionInterval) {
        clearInterval(window.betterTaskerDepletionInterval);
        window.betterTaskerDepletionInterval = null;
    }

    // Disconnect MutationObserver
    if (staminaTooltipObserver) {
        staminaTooltipObserver.disconnect();
        staminaTooltipObserver = null;
        staminaRecoveryCallback = null;
    }

    console.log('[Better Tasker] Stamina monitoring stopped');
}

function showToast(message, duration = 5000) {
    try {
        let mainContainer = document.getElementById('better-tasker-toast-container');
        if (!mainContainer) {
            mainContainer = document.createElement('div');
            mainContainer.id = 'better-tasker-toast-container';
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

        // Add icon (task icon for tasks)
        const iconImg = document.createElement('img');
        iconImg.alt = 'task';
        iconImg.src = 'https://bestiaryarena.com/assets/icons/taskrank.png';
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

        console.log(`[Better Tasker] Toast shown: ${message}`);

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
        console.error('[Better Tasker] Error showing toast:', error);
    }
}

// Helper function to check if there's an active task
function hasActiveTask() {
    try {
        const task = globalThis.state?.player?.get()?.context?.questLog?.task;
        return task && task.gameId && !task.ready;
    } catch (error) {
        console.error('[Better Tasker] Error checking for active task:', error);
        return false;
    }
}

function parseTaskKillProgressFromDom() {
    try {
        const section = findPawAndFurSection();
        if (!section) {
            return null;
        }
        const span = section.querySelector('span[data-completed]');
        if (!span || !span.textContent) {
            return null;
        }
        const m = span.textContent.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
        if (!m) {
            return null;
        }
        return {
            current: parseInt(m[1], 10),
            target: parseInt(m[2], 10)
        };
    } catch (e) {
        return null;
    }
}

function getTaskKillProgress() {
    try {
        const task = globalThis.state?.player?.getSnapshot()?.context?.questLog?.task;
        const dom = parseTaskKillProgressFromDom();

        if (!(task && task.gameId != null) && !dom) {
            return null;
        }

        let target = DEFAULT_TASK_KILL_TARGET;
        let current = null;
        const sourceBits = [];

        if (task && task.gameId != null) {
            const kc = Number(task.killCount);
            if (Number.isFinite(kc)) {
                current = kc;
                sourceBits.push('api');
            }
            for (const key of ['killGoal', 'targetKills', 'requiredKills', 'goal', 'maxKills', 'killTarget']) {
                const v = task[key];
                if (Number.isFinite(v) && v > 0) {
                    target = v;
                    sourceBits.push(key);
                    break;
                }
            }
        }

        if (dom) {
            current = dom.current;
            target = dom.target;
            sourceBits.unshift('dom');
        }

        if (current === null || !Number.isFinite(current)) {
            return null;
        }

        return { current, target, source: sourceBits.join('+') };
    } catch (e) {
        console.log('[Better Tasker] [runs-budget] getTaskKillProgress error', e);
        return null;
    }
}

/**
 * Villains on the room default board matching task gameId; killsPerRun is at least 1 for math safety.
 * @returns {{ killsPerRun: number, villainMatches: number }}
 */
function getTaskKillsPerRunFromRoom(roomId, taskGameId) {
    const fallback = { killsPerRun: 1, villainMatches: 0 };
    try {
        if (!roomId || taskGameId == null || !globalThis.state?.utils?.getBoardMonstersFromRoomId) {
            console.log('[Better Tasker] [runs-budget] board scan skipped — kpr=1', { roomId, taskGameId });
            return fallback;
        }
        const board = globalThis.state.utils.getBoardMonstersFromRoomId(roomId);
        if (!Array.isArray(board)) {
            console.log('[Better Tasker] [runs-budget] board scan invalid — kpr=1', { roomId });
            return fallback;
        }
        const tid = Number(taskGameId);
        let villainMatches = 0;
        for (const piece of board) {
            if (!piece || piece.villain !== true) {
                continue;
            }
            if (Number(piece.gameId) === tid) {
                villainMatches++;
            }
        }
        return { killsPerRun: Math.max(1, villainMatches), villainMatches };
    } catch (e) {
        console.log('[Better Tasker] [runs-budget] board scan error — kpr=1', e);
        return fallback;
    }
}

function refreshTaskHuntingRunsBudget(reason) {
    const prog = getTaskKillProgress();
    if (!prog) {
        console.log('[Better Tasker] [runs-budget] refresh skipped (no progress)', reason);
        taskHuntingRunsBudget = null;
        skipRunsBudgetTickOnNextNewGame = false;
        runsBudgetLastKillCountSnap = null;
        finalRunPauseIssued = false;
        return;
    }
    const roomId = taskingMapId || getCurrentRoomId();
    const task = globalThis.state?.player?.getSnapshot()?.context?.questLog?.task;
    const taskGameId = task?.gameId ?? null;
    const { killsPerRun, villainMatches } = getTaskKillsPerRunFromRoom(roomId, taskGameId);
    const remainingKills = Math.max(0, prog.target - prog.current);
    taskHuntingRunsBudget = Math.ceil(remainingKills / killsPerRun);
    console.log(
        '[Better Tasker] [runs-budget] ' +
            reason +
            ': runsLeft=' +
            taskHuntingRunsBudget +
            ' | kill ' +
            prog.current +
            '/' +
            prog.target +
            ' (+' +
            remainingKills +
            ' left) ÷ kpr=' +
            killsPerRun +
            ' (villains ' +
            villainMatches +
            ') | map=' +
            roomId +
            ' | ' +
            prog.source
    );
    if (taskHuntingRunsBudget === 0) {
        console.log('[Better Tasker] [runs-budget] quota already met — pausing autoplay');
        finalRunPauseIssued = false;
        void pauseAutoplay();
    } else {
        skipRunsBudgetTickOnNextNewGame = true;
        runsBudgetLastKillCountSnap = null;
        finalRunPauseIssued = false;
    }
}

function onTaskHuntingAutoplayGameEnded() {
    if (!taskHuntingOngoing) {
        return;
    }

    const prog = getTaskKillProgress();
    if (prog && runsBudgetLastKillCountSnap !== null && prog.current === runsBudgetLastKillCountSnap) {
        return;
    }

    const roomId = taskingMapId || getCurrentRoomId();
    const taskSnap = globalThis.state?.player?.getSnapshot()?.context?.questLog?.task;
    const taskGameId = taskSnap?.gameId ?? null;
    const { killsPerRun, villainMatches } = getTaskKillsPerRunFromRoom(roomId, taskGameId);
    let remainingKills = null;
    let gamesRemainingByProgress = null;
    if (prog) {
        remainingKills = Math.max(0, prog.target - prog.current);
        gamesRemainingByProgress = Math.ceil(remainingKills / killsPerRun);
    }

    const counterBefore = taskHuntingRunsBudget;
    if (taskHuntingRunsBudget !== null) {
        taskHuntingRunsBudget = Math.max(0, taskHuntingRunsBudget - 1);
    }

    let tightened = false;
    if (gamesRemainingByProgress !== null && taskHuntingRunsBudget !== null && gamesRemainingByProgress < taskHuntingRunsBudget) {
        taskHuntingRunsBudget = gamesRemainingByProgress;
        tightened = true;
    }

    const pauseNow =
        (remainingKills !== null && remainingKills <= 0) ||
        (gamesRemainingByProgress !== null && gamesRemainingByProgress <= 0) ||
        (taskHuntingRunsBudget !== null && taskHuntingRunsBudget <= 0);

    if (pauseNow) {
        const counterAfter = taskHuntingRunsBudget;
        console.log(
            '[Better Tasker] [runs-budget] end game → pause | killsLeft=' +
                remainingKills +
                ' gamesByKills=' +
                gamesRemainingByProgress +
                ' counter ' +
                counterBefore +
                '→' +
                counterAfter +
                ' tight=' +
                tightened +
                ' kpr=' +
                killsPerRun +
                '/v' +
                villainMatches
        );
        taskHuntingRunsBudget = null;
        if (prog) {
            runsBudgetLastKillCountSnap = prog.current;
        }
        // Always use final-run handler here so incomplete progress (e.g. 59/60) resumes reliably.
        if (!finalRunPauseIssued) {
            finalRunPauseIssued = true;
            void handleFinalRunPauseWithRetry();
        }
    } else {
        const progStr = prog ? prog.current + '/' + prog.target + ' ' + prog.source : 'no API';
        console.log(
            '[Better Tasker] [runs-budget] end game → continue | runsLeft=' +
                taskHuntingRunsBudget +
                ' | ' +
                progStr +
                ' killsLeft=' +
                remainingKills +
                ' gamesByKills=' +
                gamesRemainingByProgress +
                ' kpr=' +
                killsPerRun +
                '/v' +
                villainMatches +
                (tightened ? ' | tightened' : '')
        );
        if (prog) {
            runsBudgetLastKillCountSnap = prog.current;
        }
    }
}

function onTaskHuntingEmitNewGameGuard() {
    if (!taskHuntingOngoing || taskHuntingRunsBudget === null) {
        return;
    }

    const prog = getTaskKillProgress();
    const apiDone = prog && prog.current >= prog.target;
    const countdownDone = taskHuntingRunsBudget <= 0;

    if (apiDone || countdownDone) {
        console.log(
            '[Better Tasker] [runs-budget] newGame guard → pause | apiDone=' +
                apiDone +
                ' countdownDone=' +
                countdownDone +
                ' counter=' +
                taskHuntingRunsBudget
        );
        taskHuntingRunsBudget = null;
        // Use final-run handler for all terminal countdown pauses, not only runsLeft===1 path.
        if (!finalRunPauseIssued) {
            finalRunPauseIssued = true;
            void handleFinalRunPauseWithRetry();
        }
    }
}

// Create continuous stamina monitoring callback
function createStaminaMonitoringCallback(logPrefix, successMessage) {
    return () => {
        console.log(`[Better Tasker] ${logPrefix}`);

        // Check if there's still an active task (not just if task hunting is ongoing)
        if (!hasActiveTask()) {
            console.log('[Better Tasker] No active task found during stamina recovery');
            stopStaminaTooltipMonitoring();
            return;
        }

        // Check if user is still on correct tasking map
        if (!isOnCorrectTaskingMap()) {
            console.log('[Better Tasker] User changed map - stopping stamina monitoring');
            stopStaminaTooltipMonitoring();
            resetState('navigation');
            return;
        }

        // Check if autoplay session is actually running (not just mode enabled)
        const boardContext = globalThis.state.board.getSnapshot().context;
        const isAutoplayMode = boardContext.mode === 'autoplay';
        const isAutoplaySessionRunning = boardContext.isRunning || boardContext.autoplayRunning;

        if (isAutoplayMode && isAutoplaySessionRunning) {
            // Autoplay session is actually running - just continue monitoring
            console.log('[Better Tasker] Autoplay session running - continuing stamina monitoring');
            const requiredStamina = getCurrentMapStaminaCost();
            const callback = createStaminaMonitoringCallback(logPrefix, successMessage);
            startStaminaTooltipMonitoring(callback, requiredStamina);
        } else {
            // Autoplay session is not running - need to click Start button
            console.log('[Better Tasker] Autoplay session not running - clicking Start button');

            // Find and click Start button
            const startButton = findButtonByText('Start');
            if (!startButton) {
                console.log('[Better Tasker] Start button not found after stamina recovery');
                resetState('navigation');
                return;
            }

            console.log('[Better Tasker] Clicking Start button after stamina recovery...');
            refreshTaskHuntingRunsBudget('stamina-recovery-restart');
            startButton.click();

            // Show success toast if message provided
            if (successMessage) {
                showToast(successMessage);
            }

            // Modify quest button appearance to show tasking state
            modifyQuestButtonForTasking();
            questButtonModifiedForTasking = true;

            // Start quest button validation monitoring for task hunting
            startQuestButtonValidation();

            // Set up stamina depletion monitoring for the new autoplay session
            const handleStaminaDepletion = () => {
                const continuousStaminaMonitoring = createStaminaMonitoringCallback(
                    'Stamina depleted during task - restarting',
                    'Task restarted after stamina recovery'
                );

                const requiredStamina = getCurrentMapStaminaCost();
                startStaminaTooltipMonitoring(continuousStaminaMonitoring, requiredStamina);
            };

            // Start continuous stamina monitoring for depletion during autoplay
            const watchStaminaDepletion = () => {
                const depletionCheckInterval = setInterval(() => {
                    const currentCheck = hasInsufficientStamina();
                    if (currentCheck.insufficient) {
                        console.log('[Better Tasker] Stamina depleted during autoplay - starting recovery monitoring');
                        clearInterval(depletionCheckInterval);
                        handleStaminaDepletion();
                    }
                }, 5000); // Check every 5 seconds

                // Store for cleanup
                window.betterTaskerDepletionInterval = depletionCheckInterval;
            };

            watchStaminaDepletion();

            console.log('[Better Tasker] Autoplay started after stamina recovery');
        }
    };
}

// ============================================================================
// 1.1. BETTER SETUPS INTEGRATION FUNCTIONS
// ============================================================================

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
        console.error('[Better Tasker] Error checking Better Setups availability:', error);
        return false;
    }
}

/**
 * Get available setup options from Better Setups
 * @returns {Array} Array of available setup options
 */
function getAvailableSetupOptions() {
    const options = [t('mods.betterTasker.autoSetup')]; // Always include default with translation
    
    if (isBetterSetupsAvailable()) {
        try {
            const labels = JSON.parse(window.localStorage.getItem('stored-setup-labels') || '[]');
            if (Array.isArray(labels) && labels.length > 0) {
                options.push(...labels);
                console.log('[Better Tasker] Better Setups labels found:', labels);
            }
        } catch (error) {
            console.error('[Better Tasker] Error parsing Better Setups labels:', error);
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
    if (option === t('mods.betterTasker.autoSetup')) {
        return findButtonByText(t('mods.betterTasker.autoSetup'));
    }
    
    // Look for Better Setups buttons with patterns "Setup (LabelName)" or "Save (LabelName)"
    const buttons = Array.from(document.querySelectorAll('button'));
    const setupButton = buttons.find(button => {
        const text = button.textContent.trim();
        return text === `Setup (${option})` || text === `Save (${option})`;
    });
    
    if (setupButton) {
        console.log(`[Better Tasker] Found Better Setups button: ${setupButton.textContent.trim()}`);
        
        // Check if this button has a saved setup
        if (hasSavedSetup(setupButton)) {
            console.log(`[Better Tasker] Button has saved setup (green) - using it`);
            return setupButton;
        } else {
            const autoSetupText = t('mods.betterTasker.autoSetup');
            console.log(`[Better Tasker] Button has no saved setup (grey) - falling back to ${autoSetupText}`);
            // Fallback to Auto-setup if the selected button has no saved setup
            const autoSetupButton = findButtonByText(autoSetupText);
            if (autoSetupButton) {
                console.log(`[Better Tasker] Using ${autoSetupText} as fallback`);
                return autoSetupButton;
            }
        }
    } else {
        console.log(`[Better Tasker] Better Setups button not found for: ${option}`);
    }
    
    return null;
}

// ============================================================================
// 2. STATE MANAGEMENT
// ============================================================================

// UI/Observer State
let questLogObserver = null;
let nextTaskTimerInterval = null;

// ============================================================================
// 2.1. CONTROL MANAGER ACCESS
// ============================================================================
// Control managers are provided by mod-coordination.mjs
// Access them via window.QuestButtonManager, window.AutoplayManager, etc.
// These are initialized by ModCoordination.initializeDefaultManagers()

// Raid Hunter coordination state
let isRaidHunterActive = false;
let raidHunterCoordinationInterval = null;
let lastRaidHunterCheckTime = null; // Track when we first detected raids but no Raid Hunter control
let lastRaidHunterActiveTime = 0; // Track when Raid Hunter was last active to prevent ping-pong
let raidHunterFailureCount = 0; // Track consecutive Raid Hunter failures
let gameStateUnsubscribers = [];
let modCoordinationUnsubscribe = null;
let automationInterval = null;
let automationStartupTimeout = null;
let raidHunterResumeTimeout = null;
let raidHunterSettingsEnableTimeout = null;
let taskCheckTimeout = null;
let creatureFilterCheckTimeout = null;

// Board Analyzer coordination state
let isBoardAnalyzerRunning = false;
let boardAnalyzerCoordinationInterval = null;

// Modal State
let activeTaskerModal = null;
let taskerModalInProgress = false;
let lastModalCall = 0;

// Event listener management
let escKeyListener = null;
let taskerModalLayoutCleanup = null;
let pageVisibilityHandler = null;
let lastPageVisibilityChange = 0;
let lastForegroundTaskRecheck = 0;

// Timeout tracking for cleanup
let safetyTimeouts = [];
let trackedListeners = new Map();

// Automation State
let taskerState = TASKER_STATES.DISABLED;
let taskHuntingOngoing = false;
/** Remaining autoplay games estimated to finish kill quota (synced on each game end). Null when not tracking. */
let taskHuntingRunsBudget = null;
/** After refresh, skip one newGame tick — that event starts the first match, not a completed one. */
let skipRunsBudgetTickOnNextNewGame = false;
/** Last quest killCount applied in onTaskHuntingAutoplayGameEnded (dedupe duplicate newGame). */
let runsBudgetLastKillCountSnap = null;
/** Prevent duplicate pause requests when pausing during final run (runsLeft === 1). */
let finalRunPauseIssued = false;
/** Debounce forced resume calls when UI is briefly unresponsive. */
let lastForcedResumeAt = 0;
const FORCED_RESUME_COOLDOWN_MS = 2500;
let taskNavigationCompleted = false;
let autoplayPausedByTasker = false;
let toggleTaskerInFlight = false;
let pendingTaskCompletion = false;
let taskOperationInProgress = false;

// Session State
let lastGameStateChange = 0;
/** Separate debounce for newGame vs emitEndGame so faster autoplay does not drop end-game (runs-budget) handling. */
let lastNewGameDebounceAt = 0;
let lastEndGameDebounceAt = 0;
let lastNoTaskCheck = 0;
let manualPlayPauseUntil = 0;
let programmaticNavigationUntil = 0;
let manualPlayBoardUnsubscribe = null;
let lastTrackedRoomIdForManualPlay = null;
let lastTaskStartToastAt = 0;
let taskCompletionInProgress = false;
let taskCompletionRetryTimeout = null;
let lastFailsafeTriggerAt = 0;
const TASK_START_TOAST_COOLDOWN_MS = 10000;
const FINISH_BUTTON_INITIAL_WAIT_MS = 1500;
const FINISH_BUTTON_POLL_INTERVAL_MS = 200;
const FINISH_BUTTON_MAX_ATTEMPTS = 20;
const TASK_COMPLETION_RETRY_DELAY_MS = 3000;
const FAILSAFE_DEBOUNCE_MS = 2000;
const PAUSE_VERIFY_ATTEMPTS = 16;
const PAUSE_BUTTON_MAX_RETRIES = 3;
const PAUSE_BUTTON_RETRY_DELAY_MS = 500;
const PAUSE_BUTTON_CLICK_DELAY_MS = 100;
const PAUSE_BUTTON_UPDATE_DELAY_MS = 300;
const NO_TASK_CHECK_DELAY = 30000;
const STAMINA_CHECK_INTERVAL_MS = 10000;
const BACKUP_POLL_INTERVAL_MS = 20000;
const AUTOPLAY_TRANSITION_MAX_ATTEMPTS = 200; // 20s at 100ms intervals
const SCHEDULER_COOLDOWN_CAP_MS = 600000;
const SCHEDULER_ERROR_RETRY_MS = 120000;
const CREATURE_FILTER_CHECK_DEBOUNCE_MS = 300;
/** questLog.task.gameId last validated as allowed; skip repeat filter checks until task or settings change. */
let creatureFilterValidatedGameId = null;
let creatureFilterCheckInFlight = false;

// Loop detection and auto-refresh
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5; // Refresh after 5 consecutive failures
let lastFailureType = null;
const FAILURE_RESET_TIME = 30000; // Reset counter after 30 seconds of no failures

// Task removal retry tracking (prevents endless loops)
let taskRemovalRetryCount = 0;
let lastTaskRemovalAttempt = 0;
const MAX_TASK_REMOVAL_RETRIES = 3; // Max retries before giving up
const TASK_REMOVAL_RETRY_COOLDOWN = 20000; // Cooldown after max retries (backoff already spaces attempts)
const TASK_REMOVAL_RESET_TIME = 30000; // Reset retry counter after quiet period

// Check if it's safe to reload the page (won't interrupt user's active game)
function isSafeToReload() {
    try {
        const boardContext = globalThis.state?.board?.getSnapshot()?.context;
        
        // Don't reload if game state is unavailable
        if (!boardContext) {
            console.log('[Better Tasker] Cannot verify game state - skipping reload for safety');
            return false;
        }
        
        // Don't reload if user is actively playing a game
        if (boardContext.gameStarted) {
            console.log('[Better Tasker] User is in an active game - skipping reload to avoid interruption');
            return false;
        }
        
        // Check if user is in autoplay mode but this mod doesn't have control
        // This means user manually enabled autoplay or another mod is controlling it
        const currentOwner = window.AutoplayManager?.getCurrentOwner();
        
        if (boardContext.mode === 'autoplay' && currentOwner && currentOwner !== 'Better Tasker') {
            console.log(`[Better Tasker] Another mod (${currentOwner}) is autoplaying - skipping reload`);
            return false;
        }
        
        // Safe to reload
        return true;
        
    } catch (error) {
        console.error('[Better Tasker] Error checking if safe to reload:', error);
        return false; // Fail safe - don't reload on error
    }
}

// Centralized state reset function
function resetState(resetType = 'full') {
    try {
        // Common reset groups to eliminate duplication
        const resetCommonFlags = () => {
            autoplayPausedByTasker = false;
            lastForcedResumeAt = 0;
            pendingTaskCompletion = false;
            taskOperationInProgress = false;
            taskCompletionInProgress = false;
            if (taskCompletionRetryTimeout) {
                clearTimeout(taskCompletionRetryTimeout);
                taskCompletionRetryTimeout = null;
            }
            lastNoTaskCheck = 0;
            
            // Stop quest button validation and restore appearance
            stopQuestButtonValidation();
            restoreQuestButtonAppearance();
        };
        
        const resetSessionFlags = () => {
            // Session flags reset (currently no session flags to reset)
        };
        
        const resetTaskHunting = () => {
            clearCreatureFilterCache();
            taskHuntingOngoing = false;
            taskHuntingRunsBudget = null;
            skipRunsBudgetTickOnNextNewGame = false;
            runsBudgetLastKillCountSnap = null;
            finalRunPauseIssued = false;
            lastForcedResumeAt = 0;
            // Clear saved tasking map ID only when task hunting actually stops
            taskingMapId = null;
            // Reset quest button modification flag
            questButtonModifiedForTasking = false;
            // Stop quest button validation and restore appearance when task hunting stops
            stopQuestButtonValidation();
            restoreQuestButtonAppearance();
            console.log('[Better Tasker] Task hunting flag cleared - no longer actively hunting');
        };
        
        const resetNavigation = () => {
            taskNavigationCompleted = false;
            console.log('[Better Tasker] Task navigation flag cleared - ready for new navigation');
        };
        
        // Apply resets based on type
        switch (resetType) {
            case 'session':
                resetSessionFlags();
                // For session resets, only reset common flags if not task hunting
                if (!taskHuntingOngoing) {
                    resetCommonFlags();
                } else {
                    // Reset flags but preserve quest button state and tasking map ID during task hunting
                    autoplayPausedByTasker = false;
                    pendingTaskCompletion = false;
                    taskOperationInProgress = false;
                    lastNoTaskCheck = 0;
                    questButtonModifiedForTasking = false;
                    // Preserve taskingMapId during session reset for map validation
                    console.log('[Better Tasker] Session reset during task hunting - reset quest button modification flag but preserving tasking map ID');
                }
                // Don't reset taskHuntingOngoing during session reset - it should persist until task completion
                console.log('[Better Tasker] Session state reset (preserving task hunting flag)');
                break;
                
            case 'automation':
                resetSessionFlags();
                resetTaskHunting();
                resetCommonFlags();
                console.log('[Better Tasker] Automation state reset');
                break;
                
            case 'navigation':
                resetNavigation();
                resetTaskHunting();
                resetCommonFlags();
                console.log('[Better Tasker] Navigation state reset');
                break;
                
            case 'taskComplete':
                resetNavigation();
                resetTaskHunting();
                resetCommonFlags();
                console.log('[Better Tasker] Task hunting flag reset - task completed');
                break;
                
            case 'full':
            default:
                resetSessionFlags();
                resetTaskHunting();
                resetCommonFlags();
                console.log('[Better Tasker] Full state reset');
                break;
        }
        
        // Always update exposed state after any reset so other mods (like Raid Hunter) can see the changes
        updateExposedState();
    } catch (error) {
        console.error('[Better Tasker] Error during state reset:', error);
    }
}

// Track failures and trigger page refresh if stuck in a loop
function trackFailureAndCheckRefresh(failureType, shouldRefresh = true) {
    try {
        const now = Date.now();
        
        // Reset counter if it's been a while since last failure (successful recovery)
        if (lastFailureType && now - lastGameStateChange > FAILURE_RESET_TIME) {
            console.log('[Better Tasker] Resetting failure counter after successful recovery period');
            consecutiveFailures = 0;
            lastFailureType = null;
        }
        
        // Increment counter for same failure type
        if (lastFailureType === failureType) {
            consecutiveFailures++;
        } else {
            // Different failure type, reset counter
            consecutiveFailures = 1;
            lastFailureType = failureType;
        }
        
        console.log(`[Better Tasker] Failure tracked: ${failureType} (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);
        
        // Check if we should refresh
        if (shouldRefresh && consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.warn(`[Better Tasker] STUCK IN LOOP DETECTED: ${failureType} failed ${consecutiveFailures} times consecutively`);
            console.warn('[Better Tasker] Triggering page refresh in 3 seconds to recover...');
            
            // Give user a moment to see the warning
            setTimeout(() => {
                if (!isSafeToReload()) return;
                // Check if Mod Settings has disabled auto-reload
                if (window.betterUIConfig?.disableAutoReload) {
                    console.log('[Better Tasker] Auto-reload disabled by Mod Settings - skipping page refresh');
                    return;
                }
                console.log('[Better Tasker] Refreshing page to recover from stuck state...');
                location.reload();
            }, 3000);
            
            return true; // Indicates refresh is scheduled
        }
        
        return false; // No refresh needed
    } catch (error) {
        console.error('[Better Tasker] Error tracking failure:', error);
        return false;
    }
}

// Reset failure counter on successful operations
function resetFailureCounter() {
    if (consecutiveFailures > 0) {
        console.log('[Better Tasker] Operation successful - resetting failure counter');
        consecutiveFailures = 0;
        lastFailureType = null;
    }
}

// Centralized cleanup function for task completion failures
function cleanupTaskCompletionFailure(reason = 'unknown') {
    try {
        console.log(`[Better Tasker] Cleaning up after task completion failure: ${reason}`);
        
        // Track this failure
        trackFailureAndCheckRefresh(reason);
        
        // Clear all task-related flags
        resetState('taskComplete');
        
        // Close quest log only (do not dismiss unrelated map/UI modals)
        clickQuestLogCloseButtons();
        if (isQuestLogOpen()) {
            clearModalsWithEscSync(1);
            clickQuestLogCloseButtons();
        }
        
        // Update exposed state for other mods
        updateExposedState();
        
        // Reschedule task check after failure
        scheduleTaskCheck();
        
        console.log('[Better Tasker] Task completion failure cleanup completed');
        
    } catch (error) {
        console.error('[Better Tasker] Error during cleanup:', error);
    }
}

// ============================================================================
// 3. AUTOPLAY CONTROL FUNCTIONS
// ============================================================================

const AUTOPLAY_PAUSE_BUTTON_SELECTORS = [
    'button:has(svg.lucide-pause)',
    'button.frame-1-red[class*="pause"]',
    'button.frame-1-red:has(svg.lucide-pause)',
    'button[class*="surface-red"]:has(svg.lucide-pause)'
];

function findAutoplayPauseButton() {
    let button = AUTOPLAY_PAUSE_BUTTON_SELECTORS.reduce(
        (found, selector) => found || document.querySelector(selector),
        null
    );

    if (!button) {
        for (const flexContainer of document.querySelectorAll('div.flex')) {
            const buttons = flexContainer.querySelectorAll('button');
            if (buttons.length < 2) {
                continue;
            }
            const secondButton = buttons[1];
            if (secondButton.querySelector('svg.lucide-pause')) {
                button = secondButton;
                break;
            }
        }
    }

    return button;
}

function isAutoplayPauseButtonVisible() {
    return !!findAutoplayPauseButton();
}

function isAutoplayIdleInDom() {
    if (isAutoplayPauseButtonVisible()) {
        return false;
    }

    const idleButtonTexts = ['Start', 'Iniciar', 'Resume', 'Retomar'];
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
        const text = button.textContent.trim();
        if (idleButtonTexts.includes(text)) {
            return true;
        }
    }

    return false;
}

function isAutoplaySessionActiveByApi(boardContext) {
    if (!boardContext || boardContext.mode !== 'autoplay') {
        return false;
    }
    return !!(boardContext.gameStarted || boardContext.isRunning || boardContext.autoplayRunning);
}

function isAutoplaySessionActive(boardContext) {
    if (!boardContext || boardContext.mode !== 'autoplay') {
        return false;
    }
    if (isAutoplayPauseButtonVisible()) {
        return true;
    }
    return isAutoplaySessionActiveByApi(boardContext);
}

function isAutoplaySessionStopped(boardContext) {
    if (isAutoplayIdleInDom()) {
        return true;
    }
    if (!isAutoplayPauseButtonVisible()) {
        return true;
    }
    return !isAutoplaySessionActiveByApi(boardContext);
}

// Generic function to control autoplay with button clicks
async function controlAutoplayWithButton(action) {
    try {
        const buttonLabel = action === 'play' ? 'Start' : action;
        console.log(`[Better Tasker] Looking for ${buttonLabel} button...`);

        const button = findAutoplayStartButton();
        if (button) {
            console.log(`[Better Tasker] Found ${buttonLabel} button, clicking to start autoplay...`);

            await closeQuestLogIfOpen();
            await clearScrollLockIfNeeded();

            button.click();

            await sleep(PAUSE_BUTTON_UPDATE_DELAY_MS);
            console.log(`[Better Tasker] ${buttonLabel} button clicked successfully`);

            return true;
        }

        console.log(`[Better Tasker] ${buttonLabel} button not found`);
        return false;
    } catch (error) {
        console.error(`[Better Tasker] Error clicking ${action} button:`, error);
        return false;
    }
}

async function pauseAutoplayWithButton(
    maxRetries = PAUSE_BUTTON_MAX_RETRIES,
    retryDelay = PAUSE_BUTTON_RETRY_DELAY_MS,
    { closeQuestLog = true } = {}
) {
    try {
        console.log('[Better Tasker] Looking for pause button...');

        let button = null;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            button = findAutoplayPauseButton();
            if (button) {
                break;
            }

            if (attempt < maxRetries - 1) {
                console.log(
                    `[Better Tasker] Pause button not found, retrying in ${retryDelay}ms... (attempt ${attempt + 1}/${maxRetries})`
                );
                await sleep(retryDelay);
            }
        }

        if (!button) {
            console.log('[Better Tasker] Pause button not found after retries');
            return false;
        }

        console.log('[Better Tasker] Found pause button, clicking to pause autoplay session...');
        if (closeQuestLog) {
            await closeQuestLogIfOpen();
            clearModalsWithEscSync(1);
        }
        await sleep(PAUSE_BUTTON_CLICK_DELAY_MS);
        button.click();
        await sleep(PAUSE_BUTTON_UPDATE_DELAY_MS);
        console.log('[Better Tasker] Pause button clicked successfully');
        return true;
    } catch (error) {
        console.error('[Better Tasker] Error clicking pause button:', error);
        return false;
    }
}

// Find and click the play button to resume autoplay
async function resumeAutoplayWithButton() {
    return await controlAutoplayWithButton('play');
}

// ============================================================================
// 4. RAID HUNTER COORDINATION
// ============================================================================

// Check if Raid Hunter is actively raiding
function isRaidHunterRaiding() {
    try {
        // Check if Raid Hunter mod is loaded and actively raiding
        if (typeof window !== 'undefined') {
            // Use coordination system if available (primary check)
            if (window.ModCoordination) {
                const isActive = window.ModCoordination.isModActive('Raid Hunter');
                if (isActive) {
                    console.log('[Better Tasker] Raid Hunter is actively raiding (via coordination system)');
                    return true;
                }
            }
            
            // Raid Hunter localStorage / quest-button checks when ModCoordination is unavailable
            const raidHunterEnabled = localStorage.getItem('raidHunterAutomationEnabled');
            if (raidHunterEnabled !== 'true') {
                return false;
            }
            
            // Check if Raid Hunter is actually currently raiding by checking if it has control of the quest button
            // Raid Hunter takes control of the quest button when it's actively processing a raid
            const raidState = globalThis.state?.raids?.getSnapshot?.();
            if (raidState) {
                const currentRaidList = raidState.context?.list || [];
                const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
                
                // Check if Raid Hunter has control of the quest button OR is internally raiding
                const questButtonOwner = window.QuestButtonManager?.getCurrentOwner();
                const isRaidHunterCurrentlyRaiding = questButtonOwner === 'Raid Hunter' ||
                                                     (window.raidHunterIsCurrentlyRaiding && window.raidHunterIsCurrentlyRaiding());
                
                // Priority-based coordination: HIGH priority yields to Raid Hunter, MEDIUM coexists, LOW allows Better Tasker
                if (isRaidHunterCurrentlyRaiding) {
                    // Check if it's a HIGH priority raid - Better Tasker must yield
                    const isHighPriorityRaid = (window.raidHunterIsRaidingHighPriority && window.raidHunterIsRaidingHighPriority());
                    if (isHighPriorityRaid) {
                        console.log('[Better Tasker] Raid Hunter is actively raiding HIGH priority raid - preventing task automation');
                        lastRaidHunterCheckTime = null; // Reset timer since Raid Hunter has control
                        lastRaidHunterActiveTime = Date.now(); // Track when Raid Hunter was last active
                        raidHunterFailureCount = 0; // Reset failure count when Raid Hunter is active
                        return true;
                    }
                    
                    // Check if it's a MEDIUM priority raid - Raid Hunter has control and "never yields to Better Tasker"
                    // Better Tasker should yield to avoid conflicts (Raid Hunter won't give up control)
                    const isMediumPriorityRaid = (window.raidHunterIsRaidingMediumPriority && window.raidHunterIsRaidingMediumPriority());
                    if (isMediumPriorityRaid) {
                        console.log('[Better Tasker] Raid Hunter is raiding MEDIUM priority raid - yielding (Raid Hunter has control and never yields)');
                        return true; // Yield to avoid conflicts - MEDIUM priority raids keep control per tooltip
                    }
                    
                    // LOW priority raid - Better Tasker can proceed
                    console.log('[Better Tasker] Raid Hunter is raiding LOW priority raid - Better Tasker can proceed');
                    return false;
                } else if (currentRaidList.length > 0 && raidHunterEnabled === 'true') {
                    // Check if we're currently tasking - if so, don't interfere with ongoing task
                    if (taskHuntingOngoing) {
                        return false;
                    }
                    
                    // PRIORITY CHECK: Raid_Hunter should process ALL high-priority raids (active AND waiting) before Better Tasker proceeds
                    // Check if Raid Hunter is actively raiding
                    const raidHunterActuallyRaiding = (window.raidHunterIsCurrentlyRaiding && window.raidHunterIsCurrentlyRaiding());
                    if (raidHunterActuallyRaiding) {
                        // HIGH priority: Better Tasker must yield
                        const isHighPriorityRaid = (window.raidHunterIsRaidingHighPriority && window.raidHunterIsRaidingHighPriority());
                        if (isHighPriorityRaid) {
                            console.log('[Better Tasker] Raid Hunter is actively raiding HIGH priority raid - yielding control');
                            return true; // Yield to Raid Hunter even if we have active task (only for HIGH priority raids)
                        }
                        
                        // MEDIUM priority: Raid Hunter has control and "never yields to Better Tasker"
                        // Better Tasker should yield to avoid conflicts
                        const isMediumPriorityRaid = (window.raidHunterIsRaidingMediumPriority && window.raidHunterIsRaidingMediumPriority());
                        if (isMediumPriorityRaid) {
                            console.log('[Better Tasker] Raid Hunter is raiding MEDIUM priority raid - yielding (Raid Hunter keeps control)');
                            return true; // Yield - MEDIUM priority raids keep control per tooltip
                        } else {
                            // LOW priority: Better Tasker can proceed
                            console.log('[Better Tasker] Raid Hunter is raiding LOW priority raid - Better Tasker can proceed with active task');
                            // Continue to check for waiting high-priority raids below
                        }
                    }
                    
                    // Check if there are ANY enabled HIGH priority raids waiting (not just actively being raided)
                    // Raid_Hunter should process ALL high-priority raids in queue before Better Tasker proceeds
                    const hasEnabledHighPriorityRaid = (window.raidHunterHasEnabledHighPriorityRaid && window.raidHunterHasEnabledHighPriorityRaid());
                    if (hasEnabledHighPriorityRaid) {
                        console.log('[Better Tasker] High-priority raids available (active or waiting) - yielding control to let Raid_Hunter process entire queue');
                        // Give Raid Hunter a chance to claim control (especially after foreground transitions)
                        const now = Date.now();
                        if (!lastRaidHunterCheckTime) {
                            lastRaidHunterCheckTime = now;
                            console.log('[Better Tasker] Enabled HIGH priority raids available - waiting for Raid Hunter to claim control...');
                        }
                        
                        const timeSinceFirstCheck = now - lastRaidHunterCheckTime;
                        if (timeSinceFirstCheck < 10000) { // Wait up to 10 seconds
                            console.log(`[Better Tasker] Still waiting for Raid Hunter to claim control... (${Math.round(timeSinceFirstCheck/1000)}s)`);
                            return true; // Continue yielding until Raid_Hunter processes all high-priority raids
                        } else {
                            // Timeout reached - Raid Hunter hasn't claimed control, but still yield for high-priority raids
                            // Don't proceed - high-priority raids take precedence
                            console.log('[Better Tasker] Raid Hunter timeout but high-priority raids still available - continuing to yield');
                            return true;
                        }
                    }
                    
                    // Only proceed if there are NO high-priority raids (only low-priority or no raids at all)
                    // Check if we have an active task in the quest log
                    let hasActiveTask = false;
                    try {
                        const playerContext = globalThis.state?.player?.getSnapshot()?.context;
                        const task = playerContext?.questLog?.task;
                        hasActiveTask = !!(task && task.gameId);
                    } catch (error) {
                        // Ignore errors
                    }
                    
                    if (hasActiveTask) {
                        console.log('[Better Tasker] ✅ Better Tasker has ACTIVE TASK - proceeding (no high-priority raids available)');
                        lastRaidHunterCheckTime = null; // Reset timer
                        return false; // Proceed with task automation
                    }
                    
                    // Track Raid Hunter failures and give it more time when struggling
                    const now = Date.now();
                    const timeSinceLastActive = now - lastRaidHunterActiveTime;
                    
                    // If Raid Hunter was active recently, increment failure count and give it more time
                    if (timeSinceLastActive < 60000) { // 60 second cooldown
                        raidHunterFailureCount++;
                        const extendedCooldown = Math.min(raidHunterFailureCount * 30, 180); // Up to 3 minutes for struggling Raid Hunter
                        
                        if (timeSinceLastActive < extendedCooldown * 1000) {
                            console.log(`[Better Tasker] Raid Hunter struggling (${raidHunterFailureCount} failures, ${Math.round(timeSinceLastActive/1000)}s ago) - extending yield time to ${extendedCooldown}s`);
                            return true;
                        }
                    }
                    
                    // No high-priority raids available and no active task - no blocking conditions
                    // (This handles the case where only low-priority raids exist or no raids at all)
                    lastRaidHunterCheckTime = null; // Reset timer
                    return false; // Proceed - no high-priority raids to wait for
                }
            } else {
                console.log('[Better Tasker] Raid state not available - assuming no active raids');
                lastRaidHunterCheckTime = null; // Reset timer when no raids
            }
        }
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error checking Raid Hunter status:', error);
        return false;
    }
}

// Handle page visibility changes (foreground/background transitions)
// Sync Raid Hunter state when the page becomes visible
function handlePageVisibilityChange() {
    try {
        const now = Date.now();
        
        // Debounce rapid visibility changes
        if (now - lastPageVisibilityChange < 1000) {
            return;
        }
        lastPageVisibilityChange = now;
        
        if (document.visibilityState === 'visible') {
            console.log('[Better Tasker] Page became visible - immediately checking Raid Hunter state');
            
            const wasRaidHunterActive = isRaidHunterActive;
            isRaidHunterActive = isRaidHunterRaiding();
            
            // If Raid Hunter is now active and we're running automation, pause it immediately
            if (isRaidHunterActive && !wasRaidHunterActive && taskerState === TASKER_STATES.ENABLED) {
                console.log('[Better Tasker] Page visible: Raid Hunter detected as active - immediately pausing task automation');
                pauseAutomationDuringRaid();
            }
            
            // If we were paused due to Raid Hunter but it's no longer active, don't resume here
            // Let the coordination interval handle resumption (with proper delay)
            // This prevents race conditions where Raid Hunter might be temporarily undetected
            void scheduleForegroundTaskRecheck();
        } else {
            console.log('[Better Tasker] Page became hidden - maintaining task automation state');
        }
    } catch (error) {
        console.error('[Better Tasker] Error handling page visibility change:', error);
    }
}

async function scheduleForegroundTaskRecheck() {
    try {
        const now = Date.now();
        // Prevent rapid duplicate checks from tab focus/visibility bursts.
        if (now - lastForegroundTaskRecheck < 3000) {
            return;
        }
        lastForegroundTaskRecheck = now;

        if (taskerState !== TASKER_STATES.ENABLED) {
            return;
        }

        // Only run foreground recovery if we are in a task-critical state.
        if (!taskHuntingOngoing && !pendingTaskCompletion && !finalRunPauseIssued) {
            return;
        }

        // Give game state stores one beat to resync after tab returns to foreground.
        await sleep(600);

        const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
        const gameTimerContext = globalThis.state?.gameTimer?.getSnapshot?.()?.context;
        const playerContext = globalThis.state?.player?.getSnapshot?.()?.context;
        const task = playerContext?.questLog?.task;
        const progress = getTaskKillProgress();
        const isGameRunning = !!(boardContext?.gameStarted && gameTimerContext?.state === 'initial');
        const quotaReached = !!(progress && progress.current >= progress.target);
        const taskReady = !!(task && task.ready);

        console.log('[Better Tasker] Foreground task recheck snapshot:', {
            isGameRunning,
            taskHuntingOngoing,
            pendingTaskCompletion,
            finalRunPauseIssued,
            progress: progress ? `${progress.current}/${progress.target}` : 'n/a',
            taskReady
        });

        if (taskOperationInProgress) {
            return;
        }

        if (!isGameRunning && (pendingTaskCompletion || taskReady || quotaReached)) {
            if (taskCompletionInProgress) {
                return;
            }
            console.log('[Better Tasker] Foreground recheck detected completable task state - running post-game completion');
            await handlePostGameTaskCompletion(false);
            return;
        }

        if (!isGameRunning && taskHuntingOngoing) {
            console.log('[Better Tasker] Foreground recheck while task hunting - running task finishing check');
            await handleTaskFinishing();
        }
    } catch (error) {
        console.error('[Better Tasker] Error during foreground task recheck:', error);
    }
}

// Set up page visibility monitoring for foreground/background transitions
function setupPageVisibilityMonitoring() {
    // Remove existing listener if any
    if (pageVisibilityHandler) {
        document.removeEventListener('visibilitychange', pageVisibilityHandler);
        pageVisibilityHandler = null;
    }
    
    // Create new handler
    pageVisibilityHandler = handlePageVisibilityChange;
    
    // Add event listener
    document.addEventListener('visibilitychange', pageVisibilityHandler);
    
    console.log('[Better Tasker] Page visibility monitoring set up');
}

function clearPendingAutomationTimeouts() {
    if (automationStartupTimeout) {
        clearTimeout(automationStartupTimeout);
        automationStartupTimeout = null;
    }
    if (raidHunterResumeTimeout) {
        clearTimeout(raidHunterResumeTimeout);
        raidHunterResumeTimeout = null;
    }
    if (raidHunterSettingsEnableTimeout) {
        clearTimeout(raidHunterSettingsEnableTimeout);
        raidHunterSettingsEnableTimeout = null;
    }
}

async function resumeAutomationAfterRaidEnds() {
    if (!isRaidHunterRaiding() && taskerState === TASKER_STATES.ENABLED) {
        handleRaidHunterStopped();

        const playerContext = globalThis.state?.player?.getSnapshot()?.context;
        const task = playerContext?.questLog?.task;
        const hasActiveTask = !!(task && task.gameId);

        if (hasActiveTask) {
            console.log('[Better Tasker] Active task found after raid - checking current map');

            const currentRoomId = getCurrentRoomId();
            const onCorrectMap = currentRoomId && taskingMapId && currentRoomId === taskingMapId;

            if (onCorrectMap) {
                console.log('[Better Tasker] Already on correct task map - continuing task');
                taskNavigationCompleted = true;
            } else {
                console.log(`[Better Tasker] Not on task map (current: ${currentRoomId}, expected: ${taskingMapId}) - will navigate`);
                taskNavigationCompleted = false;
            }
        }

        startAutomation();
    }
}

function scheduleRaidHunterResumeAfterRaid() {
    if (raidHunterResumeTimeout) {
        clearTimeout(raidHunterResumeTimeout);
    }
    raidHunterResumeTimeout = setTimeout(() => {
        raidHunterResumeTimeout = null;
        void resumeAutomationAfterRaidEnds();
    }, 3000);
}

// Handle Raid Hunter state changes (event-driven)
function handleRaidHunterStateChange(isActive) {
    const wasRaidHunterActive = isRaidHunterActive;
    isRaidHunterActive = isActive;
    
    // If Raid Hunter just became active and we're running automation, pause it (but keep game state monitoring for new tasks)
    if (isRaidHunterActive && !wasRaidHunterActive && taskerState === TASKER_STATES.ENABLED) {
        console.log('[Better Tasker] Raid Hunter started raiding - pausing task automation (keeping game state monitoring for new tasks)');
        pauseAutomationDuringRaid();
    }
    
    // If Raid Hunter stopped raiding and we were enabled, resume automation
    if (!isRaidHunterActive && wasRaidHunterActive && taskerState === TASKER_STATES.ENABLED) {
        console.log('[Better Tasker] Raid Hunter stopped raiding - resuming task automation');
        scheduleRaidHunterResumeAfterRaid();
    }
}

// Monitor Raid Hunter coordination
function setupRaidHunterCoordination() {
    if (raidHunterCoordinationInterval) {
        clearInterval(raidHunterCoordinationInterval);
    }
    
    // Set up page visibility monitoring FIRST - this ensures immediate detection when page becomes visible
    setupPageVisibilityMonitoring();
    
    // Use coordination system if available, otherwise fallback to polling
    if (window.ModCoordination) {
        // Check initial state
        isRaidHunterActive = window.ModCoordination.isModActive('Raid Hunter');
        if (isRaidHunterActive && taskerState === TASKER_STATES.ENABLED) {
            console.log('[Better Tasker] Raid Hunter is actively raiding - automation will be paused');
            pauseAutomationDuringRaid();
        }
        // Events are already subscribed in init()
    } else {
        // Poll Raid Hunter status when ModCoordination is unavailable
        raidHunterCoordinationInterval = setInterval(() => {
            const wasRaidHunterActive = isRaidHunterActive;
            isRaidHunterActive = isRaidHunterRaiding();
            
            // If Raid Hunter just became active and we're running automation, pause it (but keep game state monitoring for new tasks)
            if (isRaidHunterActive && !wasRaidHunterActive && taskerState === TASKER_STATES.ENABLED) {
                console.log('[Better Tasker] Raid Hunter started raiding - pausing task automation (keeping game state monitoring for new tasks)');
                pauseAutomationDuringRaid();
            }
            
            // If Raid Hunter stopped raiding and we were enabled, resume automation
            if (!isRaidHunterActive && wasRaidHunterActive && taskerState === TASKER_STATES.ENABLED) {
                console.log('[Better Tasker] Raid Hunter stopped raiding - resuming task automation');
                scheduleRaidHunterResumeAfterRaid();
            }
        }, 10000);
    }
}

// Handle when Raid Hunter stops raiding
function handleRaidHunterStopped() {
    try {
        console.log('[Better Tasker] Raid Hunter stopped - managing Bestiary Automator settings transition');
        
        // Release Raid Hunter's control of Bestiary Automator settings
        window.BestiaryAutomatorSettingsManager.releaseControl('Raid Hunter');
        
        // Ensure Raid Hunter releases quest button control if it still has it
        if (window.QuestButtonManager.getCurrentOwner() === 'Raid Hunter') {
            console.log('[Better Tasker] Forcing Raid Hunter to release quest button control');
            window.QuestButtonManager.releaseControl('Raid Hunter');
        }
        
        // Disable Raid Hunter's Bestiary Automator settings
        const settings = loadSettings();
        if (settings.autoRefillStamina) {
            console.log('[Better Tasker] Disabling Raid Hunter\'s Bestiary Automator autorefill stamina...');
            disableBestiaryAutomatorStaminaRefill();
        }
        if (settings.fasterAutoplay) {
            console.log('[Better Tasker] Disabling Raid Hunter\'s Bestiary Automator faster autoplay...');
            disableBestiaryAutomatorFasterAutoplay();
        }
        
        // Small delay before enabling our own settings to avoid conflicts
        if (raidHunterSettingsEnableTimeout) {
            clearTimeout(raidHunterSettingsEnableTimeout);
        }
        raidHunterSettingsEnableTimeout = setTimeout(() => {
            raidHunterSettingsEnableTimeout = null;
            if (taskerState !== TASKER_STATES.ENABLED) {
                return;
            }
            console.log('[Better Tasker] Enabling our Bestiary Automator settings...');
            enableBestiaryAutomatorSettings();
        }, 1000);
    } catch (error) {
        console.error('[Better Tasker] Error handling Raid Hunter stop:', error);
    }
}

// Clean up Raid Hunter coordination
function cleanupRaidHunterCoordination() {
    if (raidHunterResumeTimeout) {
        clearTimeout(raidHunterResumeTimeout);
        raidHunterResumeTimeout = null;
    }
    if (raidHunterSettingsEnableTimeout) {
        clearTimeout(raidHunterSettingsEnableTimeout);
        raidHunterSettingsEnableTimeout = null;
    }

    if (raidHunterCoordinationInterval) {
        clearInterval(raidHunterCoordinationInterval);
        raidHunterCoordinationInterval = null;
    }
    
    // Remove page visibility listener
    if (pageVisibilityHandler) {
        document.removeEventListener('visibilitychange', pageVisibilityHandler);
        pageVisibilityHandler = null;
    }
    
    isRaidHunterActive = false;
}

// ============================================================================
// 4.1. BOARD ANALYZER COORDINATION
// ============================================================================

// Check if Board Analyzer is currently running
function isBoardAnalyzerActive() {
    try {
        return window.ModCoordination?.isModActive('Board Analyzer') || false;
    } catch (error) {
        console.error('[Better Tasker] Error checking Board Analyzer status:', error);
        return false;
    }
}

// Handle Board Analyzer coordination - pause Better Tasker when Board Analyzer runs
function handleBoardAnalyzerCoordination() {
    try {
        if (!window.ModCoordination) return;
        
        const boardAnalyzerRunning = window.ModCoordination.isModActive('Board Analyzer');
        const manualRunnerRunning = window.ModCoordination.isModActive('Manual Runner');
        
        if ((boardAnalyzerRunning || manualRunnerRunning) && !isBoardAnalyzerRunning) {
            // Board Analyzer started - pause Better Tasker automation
            console.log('[Better Tasker] Coordination active (Board Analyzer or Manual Runner) - pausing task automation');
            isBoardAnalyzerRunning = true;
            
            if (taskerState === TASKER_STATES.ENABLED) {
                stopAutomation();
            }
        } else if (!boardAnalyzerRunning && !manualRunnerRunning && isBoardAnalyzerRunning) {
            // Board Analyzer finished - resume Better Tasker automation if enabled
            console.log('[Better Tasker] Coordination cleared - checking if automation should resume');
            isBoardAnalyzerRunning = false;
            
            if (taskerState === TASKER_STATES.ENABLED && !isRaidHunterRaiding()) {
                console.log('[Better Tasker] Resuming task automation');
                startAutomation();
            }
        }
    } catch (error) {
        console.error('[Better Tasker] Error in Board Analyzer coordination:', error);
    }
}

// Setup Board Analyzer coordination
function setupBoardAnalyzerCoordination() {
    if (boardAnalyzerCoordinationInterval) {
        clearInterval(boardAnalyzerCoordinationInterval);
        boardAnalyzerCoordinationInterval = null;
    }
    
    // Poll for Board Analyzer state changes every 2 seconds
    boardAnalyzerCoordinationInterval = setInterval(() => {
        handleBoardAnalyzerCoordination();
    }, 2000);
}

// Clean up Board Analyzer coordination
function cleanupBoardAnalyzerCoordination() {
    if (boardAnalyzerCoordinationInterval) {
        clearInterval(boardAnalyzerCoordinationInterval);
        boardAnalyzerCoordinationInterval = null;
    }
    isBoardAnalyzerRunning = false;
}

// ============================================================================
// 5. UI FUNCTIONS
// ============================================================================

// Helper function to find quest log container with optimized selectors
function findQuestLogContainer() {
    const selectors = [
        '.widget-bottom .grid.h-\\[260px\\].items-start.gap-1', // Most specific
        '[data-radix-scroll-area-viewport] .grid.h-\\[260px\\].items-start.gap-1',
        '.grid.h-\\[260px\\].items-start.gap-1',
        '.widget-bottom .grid.items-start.gap-1',
        '[data-radix-scroll-area-viewport] .grid.items-start.gap-1',
        '.grid.items-start.gap-1'
    ];
    
    for (let i = 0; i < selectors.length; i++) {
        const selector = selectors[i];
        const container = document.querySelector(selector);
        
        if (container) {
            return container;
        }
    }
    
    return null;
}

// Find the Paw and Fur Society section
function findPawAndFurSection() {
    const questLogContainer = findQuestLogContainer();
    if (!questLogContainer) return null;
    
    // Look for the Paw and Fur Society section by its text content
    const sections = questLogContainer.querySelectorAll('.frame-1.surface-regular');
    for (const section of sections) {
        const titleElement = section.querySelector('p.text-whiteHighlight');
        if (titleElement && titleElement.textContent?.includes('Paw and Fur Society')) {
            return section;
        }
    }
    
    return null;
}

function formatTaskCooldownTime(msRemaining) {
    const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}h`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}m`;
}

function getTaskCooldownRemainingMs() {
    try {
        const resetAt = globalThis.state?.player?.get?.()?.context?.questLog?.task?.resetAt;
        if (!resetAt) return 0;
        return Math.max(0, Number(resetAt) - Date.now());
    } catch (error) {
        console.warn('[Better Tasker] Failed to read task cooldown timer:', error);
        return 0;
    }
}

function updateNextTaskTimerDisplay() {
    const timerContainer = document.getElementById(TASKER_NEXT_TASK_TIMER_ID);
    if (!timerContainer) return;
    const timerElement = timerContainer.querySelector('.raid-timer');
    if (!timerElement) return;

    const msRemaining = getTaskCooldownRemainingMs();
    if (msRemaining <= 0) {
        timerElement.textContent = 'Ready';
        timerElement.style.color = 'rgb(96, 192, 96)';
        return;
    }

    timerElement.textContent = formatTaskCooldownTime(msRemaining);
    timerElement.style.color = 'rgb(255, 255, 255)';
}

function startNextTaskTimerUpdates() {
    if (nextTaskTimerInterval) return;
    updateNextTaskTimerDisplay();
    nextTaskTimerInterval = setInterval(updateNextTaskTimerDisplay, 1000);
}

function stopNextTaskTimerUpdates() {
    if (nextTaskTimerInterval) {
        clearInterval(nextTaskTimerInterval);
        nextTaskTimerInterval = null;
    }
}

function removeNextTaskTimer() {
    const timerContainer = document.getElementById(TASKER_NEXT_TASK_TIMER_ID);
    if (timerContainer) {
        timerContainer.remove();
    }
    stopNextTaskTimerUpdates();
}

function hasBuiltInTaskTimer(pawAndFurSection) {
    if (!pawAndFurSection) return false;
    const clockIcons = pawAndFurSection.querySelectorAll('svg.lucide-clock');
    for (const icon of clockIcons) {
        if (!icon.closest(`#${TASKER_NEXT_TASK_TIMER_ID}`)) {
            return true;
        }
    }
    return false;
}

function ensureNextTaskTimer(titleElement, pawAndFurSection) {
    if (!titleElement) return null;

    // Never show a custom title timer if the game is already rendering a timer.
    if (hasBuiltInTaskTimer(pawAndFurSection)) {
        removeNextTaskTimer();
        return null;
    }

    titleElement.style.display = 'flex';
    titleElement.style.alignItems = 'center';
    titleElement.style.justifyContent = 'space-between';
    titleElement.style.gap = '8px';
    titleElement.style.width = '100%';

    let timerContainer = document.getElementById(TASKER_NEXT_TASK_TIMER_ID);
    if (!timerContainer) {
        timerContainer = document.createElement('div');
        timerContainer.id = TASKER_NEXT_TASK_TIMER_ID;
        timerContainer.className = 'flex items-center';
        timerContainer.style.cssText = `
            margin-left: auto;
            white-space: nowrap;
            color: rgb(255, 255, 255);
            font-size: 12px;
        `;
        timerContainer.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock mr-1 inline-block size-2 -translate-y-px">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span class="raid-timer" style="color: rgb(255, 255, 255);">0:00m</span>
        `;
        titleElement.appendChild(timerContainer);
    }

    updateNextTaskTimerDisplay();
    startNextTaskTimerUpdates();
    return timerContainer;
}

// Create the settings button
function createSettingsButton() {
    return createStyledButton(TASKER_BUTTON_ID, t('mods.betterTasker.settingsButton'), 'blue', () => {
        console.log('[Better Tasker] Settings button clicked');
        openTaskerSettingsModal();
    });
}

// Create the toggle button
function createToggleButton() {
    return createStyledButton(TASKER_TOGGLE_ID, t('mods.betterTasker.disabled'), 'red', () => {
        console.log('[Better Tasker] Toggle button clicked');
        toggleTasker();
    });
}

// Insert buttons into Paw and Fur Society section
function insertButtons() {
    const pawAndFurSection = findPawAndFurSection();
    if (hasBuiltInTaskTimer(pawAndFurSection)) {
        removeNextTaskTimer();
    }

    const hasSettingsButton = !!document.getElementById(TASKER_BUTTON_ID);
    const hasToggleButton = !!document.getElementById(TASKER_TOGGLE_ID);
    const hasTimer = !!document.getElementById(TASKER_NEXT_TASK_TIMER_ID);

    // Check if buttons and timer already exist
    if (hasSettingsButton && hasToggleButton && hasTimer) {
        console.log('[Better Tasker] Buttons already exist, skipping');
        updateToggleButton();
        startNextTaskTimerUpdates();
        return true; // Success - buttons already exist
    }
    
    if (!pawAndFurSection) {
        console.log('[Better Tasker] Paw and Fur Society section not found');
        return false; // Failed - section not found
    }
    
    
    // Find the title element and its parent container
    const titleElement = pawAndFurSection.querySelector('p.text-whiteHighlight');
    if (titleElement && titleElement.textContent?.includes('Paw and Fur Society')) {
        ensureNextTaskTimer(titleElement, pawAndFurSection);

        if (hasSettingsButton && hasToggleButton) {
            return true;
        }

        // Find the parent container that holds the title
        const titleContainer = titleElement.parentElement;
        
        if (titleContainer) {
            // Create a button container
            const buttonContainer = createStyledContainer(null, `
                display: flex;
                gap: 4px;
                margin-top: 4px;
            `);
            
            // Create the toggle button
            const toggleButton = createToggleButton();
            buttonContainer.appendChild(toggleButton);
            
            // Create the settings button
            const settingsButton = createSettingsButton();
            buttonContainer.appendChild(settingsButton);
            
            // Insert the button container after the title
            titleElement.parentNode.insertBefore(buttonContainer, titleElement.nextSibling);
            
            // Update toggle button state
            updateToggleButton();
            
            return true; // Success - buttons inserted
        } else {
            console.log('[Better Tasker] Could not find title container for buttons');
            return false; // Failed - no container
        }
    } else {
        console.log('[Better Tasker] Could not find Paw and Fur Society title element');
        return false; // Failed - no title element
    }
}

// ============================================================================
// 6. STATE MANAGEMENT FUNCTIONS
// ============================================================================

// Load tasker state from localStorage
function loadTaskerState() {
    const saved = localStorage.getItem('betterTaskerState');
    if (saved !== null) {
        try {
            taskerState = saved;
            console.log('[Better Tasker] Loaded tasker state from localStorage:', taskerState);
        } catch (error) {
            console.error('[Better Tasker] Error parsing tasker state:', error);
            taskerState = TASKER_STATES.DISABLED;
        }
    } else {
        // Try to migrate from old boolean system
        const oldSaved = localStorage.getItem('betterTaskerEnabled');
        if (oldSaved !== null) {
            try {
                const oldState = JSON.parse(oldSaved);
                taskerState = oldState ? TASKER_STATES.ENABLED : TASKER_STATES.DISABLED;
                console.log('[Better Tasker] Migrated from old boolean system:', taskerState);
                // Clean up old key
                localStorage.removeItem('betterTaskerEnabled');
            } catch (error) {
                console.error('[Better Tasker] Error migrating from old system:', error);
                taskerState = TASKER_STATES.DISABLED;
            }
        } else {
            console.log('[Better Tasker] No saved tasker state, using default (disabled)');
            taskerState = TASKER_STATES.DISABLED;
        }
    }
}

// Save tasker state to localStorage
function saveTaskerState() {
    localStorage.setItem('betterTaskerState', taskerState);
    console.log('[Better Tasker] Saved tasker state to localStorage:', taskerState);
}

function applyTaskerToggleUi() {
    saveTaskerState();
    updateToggleButton();
    if (window.ModCoordination) {
        const isEnabled = taskerState === TASKER_STATES.ENABLED || taskerState === TASKER_STATES.NEW_TASK_ONLY;
        window.ModCoordination.updateModState('Better Tasker', { enabled: isEnabled });
    }
    console.log('[Better Tasker] Tasker state changed to:', taskerState);
}

// Toggle tasker through the 3 states
function toggleTasker() {
    void handleToggleTasker();
}

async function handleToggleTasker() {
    if (toggleTaskerInFlight) {
        console.log('[Better Tasker] Toggle already in progress, ignoring duplicate click');
        return;
    }
    toggleTaskerInFlight = true;

    const fromState = taskerState;
    switch (fromState) {
        case TASKER_STATES.DISABLED:
            taskerState = TASKER_STATES.ENABLED;
            break;
        case TASKER_STATES.ENABLED:
            taskerState = TASKER_STATES.NEW_TASK_ONLY;
            break;
        case TASKER_STATES.NEW_TASK_ONLY:
            taskerState = TASKER_STATES.DISABLED;
            break;
    }

    applyTaskerToggleUi();

    try {
        switch (fromState) {
            case TASKER_STATES.DISABLED:
                startAutomation();
                scheduleTaskCheck();
                break;
            case TASKER_STATES.ENABLED:
                await stopAutomation();
                scheduleTaskCheck();
                break;
            case TASKER_STATES.NEW_TASK_ONLY:
                stopNextTaskTimerUpdates();
                await pauseAutoplayForUserStop();
                disableBetterTaskerAutomatorSettings();
                teardownBetterTaskerRuntime();
                cleanupRaidHunterCoordination();
                cleanupBoardAnalyzerCoordination();
                if (taskCheckTimeout) {
                    clearTimeout(taskCheckTimeout);
                    taskCheckTimeout = null;
                }
                resetState('navigation');
                updateExposedState();
                break;
        }
    } catch (error) {
        console.error('[Better Tasker] Error applying tasker state transition:', error);
    } finally {
        toggleTaskerInFlight = false;
    }
}

// Update the toggle button appearance
function updateToggleButton() {
    const toggleButton = document.querySelector(`#${TASKER_TOGGLE_ID}`);
    if (!toggleButton) return;
    
    // Clear any shimmer effect
    toggleButton.style.background = '';
    toggleButton.style.backgroundSize = '';
    toggleButton.style.backgroundClip = '';
    toggleButton.style.webkitBackgroundClip = '';
    toggleButton.style.webkitTextFillColor = '';
    toggleButton.style.animation = '';
    
    switch (taskerState) {
        case TASKER_STATES.DISABLED:
            toggleButton.textContent = t('mods.betterTasker.disabled');
            toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-red active:frame-pressed-1-red surface-red gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
            break;
        case TASKER_STATES.NEW_TASK_ONLY:
            toggleButton.textContent = t('mods.betterTasker.newTaskPlus');
            toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-blue active:frame-pressed-1-blue surface-blue gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
            // Set custom blue background
            toggleButton.style.background = 'url("https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png")';
            toggleButton.style.backgroundSize = 'cover';
            toggleButton.style.backgroundPosition = 'center';
            break;
        case TASKER_STATES.ENABLED:
            toggleButton.textContent = t('mods.betterTasker.enabled');
            toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
            break;
    }
}



// ============================================================================
// 7. QUEST BUTTON MODIFICATION FUNCTIONS
// ============================================================================

// Store original quest button state
let originalQuestButtonState = null;
let questButtonValidationInterval = null;
let boardStateUnsubscribe = null;

// Store the map ID when tasking starts (after Start button click)
let taskingMapId = null;

// Track if quest button has been modified for tasking (only after Start button click)
let questButtonModifiedForTasking = false;

// Function to get current room ID
function getCurrentRoomId() {
    try {
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (boardContext && boardContext.selectedMap && boardContext.selectedMap.selectedRoom) {
            return boardContext.selectedMap.selectedRoom.id;
        }
        return null;
    } catch (error) {
        console.error('[Better Tasker] Error getting current room ID:', error);
        return null;
    }
}

// Function to get room ID for a map name
function getRoomIdForMapName(mapName) {
    try {
        // Get all available maps from the game state
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (boardContext && boardContext.maps) {
            // Look through all maps to find one that matches the name
            for (const map of boardContext.maps) {
                if (map.name === mapName) {
                    // Return the first room ID of this map
                    if (map.rooms && map.rooms.length > 0) {
                        console.log(`[Better Tasker] Found room ID for map "${mapName}": ${map.rooms[0].id}`);
                        return map.rooms[0].id;
                    }
                }
            }
        }
        
        console.log(`[Better Tasker] No room ID found for map: ${mapName}`);
        return null;
    } catch (error) {
        console.error('[Better Tasker] Error getting room ID for map name:', error);
        return null;
    }
}

// Function to check if user is on the correct tasking map
function isOnCorrectTaskingMap() {
    if (!taskOperationInProgress && !taskHuntingOngoing && !hasActiveTask()) {
        return false;
    }
    
    const currentRoomId = getCurrentRoomId();
    if (!currentRoomId) {
        console.log('[Better Tasker] Could not determine current room ID');
        return false;
    }
    
    // If we have a saved tasking map ID, compare with current map
    if (taskingMapId) {
        const isCorrectMap = currentRoomId === taskingMapId;
        console.log(`[Better Tasker] Map validation: current=${currentRoomId}, tasking=${taskingMapId}, correct=${isCorrectMap}`);
        return isCorrectMap;
    }
    
    // Fallback: Get the recommended map for the current task (for initial setup)
    try {
        const playerContext = globalThis.state.player.getSnapshot().context;
        const task = playerContext?.questLog?.task;
        
        if (task) {
            console.log(`[Better Tasker] Task object keys:`, Object.keys(task));
            
            // Game State API doesn't provide suggestedMap - this validation is not possible via API
            console.log('[Better Tasker] Cannot validate map via Game State API - suggestedMap not available');
            return true; // Allow any map since we can't validate
        } else {
            console.log('[Better Tasker] No task found - allowing any map');
            return true;
        }
    } catch (error) {
        console.error('[Better Tasker] Error checking recommended map:', error);
        return true;
    }
}

// Function to find quest button with multiple fallback selectors
function findQuestButton() {
    // First, try to find by quest icon (normal state) - check both selected and unselected
    const questIconButton = document.querySelector('button img[src*="quest.png"]')?.closest('button');
    if (questIconButton) {
        return questIconButton;
    }
    
    // Then, look for any button with "Tasking" text - check both selected and unselected
    const allButtons = document.querySelectorAll('button');
    for (const button of allButtons) {
        const span = button.querySelector('span');
        if (span && span.textContent === 'Tasking') {
            console.log('[Better Tasker] Found quest button by Tasking text');
            return button;
        }
    }
    
    // Fallback: look for any button with quest-related alt text - check both selected and unselected
    const questAltButton = document.querySelector('button img[alt="Quests"]')?.closest('button');
    if (questAltButton) {
        console.log('[Better Tasker] Found quest button by quest alt text');
        return questAltButton;
    }
    
    // Additional fallback: look for any button with "Quests" text
    for (const button of allButtons) {
        const span = button.querySelector('span');
        if (span && span.textContent === 'Quests') {
            console.log('[Better Tasker] Found quest button by Quests text');
            return button;
        }
    }
    
    console.log('[Better Tasker] Quest button not found');
    return null;
}

// Function to modify quest button appearance when tasking is active
function modifyQuestButtonForTasking() {
    return withControl(window.QuestButtonManager, 'Better Tasker', () => {
        // Find the quest button in the header navigation
        const questButton = findQuestButton();
        
        if (!questButton) {
            console.log('[Better Tasker] Quest button not found for modification');
            return false;
        }
        
        // Store original state if not already stored AND quest button is in original state
        if (!window.QuestButtonManager.originalState) {
            const img = questButton.querySelector('img');
            const span = questButton.querySelector('span');
            
            // Only store original state if quest button appears to be in original state
            // Check if it's not already modified by another mod
            const isInOriginalState = img && img.src.includes('quest.png') && span && span.textContent === 'Quests';
            
            if (isInOriginalState) {
                window.QuestButtonManager.originalState = {
                    imgSrc: img ? img.src : null,
                    imgAlt: img ? img.alt : null,
                    imgWidth: img ? img.width : null,
                    imgHeight: img ? img.height : null,
                    imgStyle: img ? img.style.cssText : null,
                    imgClassList: img ? img.className : null,
                    spanText: span ? span.textContent : null,
                    buttonColor: questButton.style.color || ''
                };
            } else {
                console.log('[Better Tasker] Quest button not in original state - not storing originalState');
            }
        }
        
        // Modify the button appearance - replace icon and change text
        const img = questButton.querySelector('img');
        const span = questButton.querySelector('span');
        
        // Replace the icon with taskrank icon
        if (img) {
            img.src = 'https://bestiaryarena.com/assets/icons/taskrank.png';
            img.alt = 'Tasking';
            img.style.display = ''; // Make sure it's visible
        }
        
        // Change text to "Tasking"
        if (span) {
            span.textContent = t('mods.betterTasker.tasking');
            // Add shimmer effect to the text
            span.style.background = 'linear-gradient(45deg, #22c55e, #16a34a, #22c55e, #16a34a)';
            span.style.backgroundSize = '400% 400%';
            span.style.backgroundClip = 'text';
            span.style.webkitBackgroundClip = 'text';
            span.style.webkitTextFillColor = 'transparent';
            span.style.animation = 'taskerShimmer 2s ease-in-out infinite';
        }
        
        // Add CSS keyframes for shimmer animation if not already added
        if (!document.getElementById('taskerShimmerCSS')) {
            const style = document.createElement('style');
            style.id = 'taskerShimmerCSS';
            style.textContent = `
                @keyframes taskerShimmer {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Set green color for the button
        questButton.style.color = '#22c55e'; // Green color
        
        return true;
    }, 'modify quest button');
}

// DOM-only restore (caller must hold Quest Button control via QuestButtonManager).
function applyQuestButtonRestoreDom() {
    const questButton = findQuestButton();

    if (!questButton) {
        console.log('[Better Tasker] Quest button not found for restoration');
        return false;
    }

    const img = questButton.querySelector('img');
    const span = questButton.querySelector('span');
    const state = window.QuestButtonManager.originalState;

    if (state) {
        if (img) {
            img.style.display = '';
            if (state.imgSrc) {
                img.src = state.imgSrc;
                img.alt = state.imgAlt;
            }
            if (state.imgWidth) {
                img.width = state.imgWidth;
            }
            if (state.imgHeight) {
                img.height = state.imgHeight;
            }
            if (state.imgStyle) {
                img.style.cssText = state.imgStyle;
            }
            if (state.imgClassList) {
                img.className = state.imgClassList;
            }
        }

        if (span) {
            if (state.spanText) {
                span.textContent = state.spanText;
            }
            span.style.background = '';
            span.style.backgroundSize = '';
            span.style.backgroundClip = '';
            span.style.webkitBackgroundClip = '';
            span.style.webkitTextFillColor = '';
            span.style.animation = '';
        }

        questButton.style.color = state.buttonColor || '';
    } else {
        console.log('[Better Tasker] No stored original state — resetting quest button to default Quests appearance');
        if (img) {
            img.style.display = '';
            img.src = DEFAULT_QUEST_ICON_SRC;
            img.alt = 'Quests';
        }
        if (span) {
            span.textContent = 'Quests';
            span.style.background = '';
            span.style.backgroundSize = '';
            span.style.backgroundClip = '';
            span.style.webkitBackgroundClip = '';
            span.style.webkitTextFillColor = '';
            span.style.animation = '';
        }
        questButton.style.color = '';
    }

    console.log('[Better Tasker] Quest button appearance restored');
    return true;
}

// Restores quest button; acquires Quest Button control so cleanup runs after task/handovers.
function restoreQuestButtonAppearance() {
    if (!window.QuestButtonManager?.requestControl?.('Better Tasker')) {
        console.log('[Better Tasker] Cannot restore quest button — could not acquire quest button control');
        return false;
    }
    try {
        return applyQuestButtonRestoreDom();
    } catch (error) {
        console.error('[Better Tasker] Error restoring quest button:', error);
        return false;
    } finally {
        window.QuestButtonManager.releaseControl('Better Tasker');
    }
}

// Function to start monitoring quest button validation using real-time board state subscription
function startQuestButtonValidation() {
    // Clear any existing subscription or interval
    if (isActiveStateSubscription(boardStateUnsubscribe)) {
        invokeStateSubscription(boardStateUnsubscribe);
        boardStateUnsubscribe = null;
    }
    if (questButtonValidationInterval) {
        clearInterval(questButtonValidationInterval);
        questButtonValidationInterval = null;
    }
    
    // Only start monitoring if we're currently tasking or hunting
    if (!taskOperationInProgress && !taskHuntingOngoing) {
        return;
    }
    
    try {
        // Subscribe to board state changes for immediate map change detection
        boardStateUnsubscribe = globalThis.state.board.subscribe((state) => {
            try {
                // Check if we're still tasking or hunting
                if (!taskOperationInProgress && !taskHuntingOngoing) {
                    console.log('[Better Tasker] No longer tasking or hunting - stopping quest button validation');
                    stopQuestButtonValidation();
                    return;
                }
                
                // Get current room ID from the state
                const currentRoomId = state.context?.selectedMap?.selectedRoom?.id;
                
                // Check if we're on the correct map for tasking
                if (taskingMapId && currentRoomId !== taskingMapId) {
                    console.log(`[Better Tasker] Map change detected: ${taskingMapId} -> ${currentRoomId} - restoring quest button`);
                    
                    // Request control to restore quest button (don't just check for it)
                    withControl(window.QuestButtonManager, 'Better Tasker', () => {
                        return applyQuestButtonRestoreDom();
                    }, 'restore quest button on map change');
                    
                    // Clear the saved tasking map ID since user switched maps
                    taskingMapId = null;
                    questButtonModifiedForTasking = false;
                    console.log('[Better Tasker] Cleared tasking map ID and quest button modification flag - quest button reset to normal state');
                }
                
            } catch (error) {
                console.error('[Better Tasker] Error in board state subscription:', error);
            }
        });
        
    } catch (error) {
        console.error('[Better Tasker] Error setting up board state subscription:', error);
        console.log('[Better Tasker] Falling back to polling method');
        startQuestButtonValidationPolling();
    }
}

// Poll map changes when board subscription is unavailable
function startQuestButtonValidationPolling() {
    // Clear any existing interval
    if (questButtonValidationInterval) {
        clearInterval(questButtonValidationInterval);
        questButtonValidationInterval = null;
    }
    
    // Only start monitoring if we're currently tasking or hunting
    if (!taskOperationInProgress && !taskHuntingOngoing) {
        return;
    }
    
    console.log('[Better Tasker] Starting quest button validation monitoring (polling fallback)');
    
    questButtonValidationInterval = setInterval(() => {
        try {
            // Check if we're still tasking or hunting
            if (!taskOperationInProgress && !taskHuntingOngoing) {
                console.log('[Better Tasker] No longer tasking or hunting - stopping quest button validation');
                stopQuestButtonValidation();
                return;
            }
            
            // Check if we're on the correct map for tasking
            if (!isOnCorrectTaskingMap()) {
                console.log('[Better Tasker] User navigated away from tasking map - restoring quest button and clearing saved map ID');
                
                // Request control to restore quest button (don't just check for it)
                withControl(window.QuestButtonManager, 'Better Tasker', () => {
                    return applyQuestButtonRestoreDom();
                }, 'restore quest button on map change');
                
                // Clear the saved tasking map ID since user switched maps
                taskingMapId = null;
                questButtonModifiedForTasking = false;
                console.log('[Better Tasker] Cleared tasking map ID and quest button modification flag - quest button reset to normal state');
                // Don't stop the interval - keep monitoring in case they come back
                return;
            }
        } catch (error) {
            console.error('[Better Tasker] Error in quest button validation:', error);
        }
    }, BACKUP_POLL_INTERVAL_MS);
}

// Function to stop monitoring quest button validation
function stopQuestButtonValidation({ clearTaskingMap = true } = {}) {
    // Unsubscribe from board state changes
    if (isActiveStateSubscription(boardStateUnsubscribe)) {
        invokeStateSubscription(boardStateUnsubscribe);
        boardStateUnsubscribe = null;
        console.log('[Better Tasker] Board state subscription stopped');
    }
    
    // Clear polling interval (fallback method)
    if (questButtonValidationInterval) {
        clearInterval(questButtonValidationInterval);
        questButtonValidationInterval = null;
        console.log('[Better Tasker] Quest button validation monitoring stopped');
    }
    
    if (clearTaskingMap && taskingMapId) {
        console.log(`[Better Tasker] Clearing saved tasking map ID: ${taskingMapId}`);
        taskingMapId = null;
    }
}

// ============================================================================
// 8. QUEST LOG MONITORING
// ============================================================================

// Check for quest log content
function checkForQuestLogContent(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }

    const questLogSelector = '.grid.h-\\[260px\\].items-start.gap-1';

    if (node.textContent?.includes('Quest Log') ||
        node.textContent?.includes('Paw and Fur Society')) {
        return true;
    }

    if (node.matches?.(questLogSelector) || node.querySelector?.(questLogSelector)) {
        return true;
    }

    if (node.querySelector?.('*')) {
        return Array.from(node.querySelectorAll('*')).some((el) =>
            el.textContent?.includes('Quest Log') ||
            el.textContent?.includes('Paw and Fur Society')
        );
    }

    return false;
}

// Check for Paw and Fur Society content
function checkForPawAndFurContent(node) {
    return node.textContent?.includes('Paw and Fur Society') || 
           (node.querySelector?.('*') && 
            Array.from(node.querySelectorAll('*')).some(el => 
              el.textContent?.includes('Paw and Fur Society')
            ));
}

// Quest log detection handler - IMMEDIATE button insertion (like Raid Hunter)
function handleQuestLogDetection(mutations) {
    let hasQuestLogContent = false;
    let hasPawAndFurContent = false;
    
    // Process mutations for quest log content
    for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE && !document.getElementById(TASKER_BUTTON_ID)) {
                    hasQuestLogContent = checkForQuestLogContent(node);
                    if (hasQuestLogContent) break;
                }
            }
        }
        if (hasQuestLogContent) break;
    }
    
    // Check for Paw and Fur Society content
    for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE && !document.getElementById(TASKER_BUTTON_ID)) {
                    hasPawAndFurContent = checkForPawAndFurContent(node);
                    if (hasPawAndFurContent) break;
                }
            }
        }
        if (hasPawAndFurContent) break;
    }
    
    // Handle quest log detection - insert buttons immediately
    if (hasQuestLogContent || hasPawAndFurContent) {
        
        // Insert buttons immediately if they don't exist
        if (!document.getElementById(TASKER_BUTTON_ID) || !document.getElementById(TASKER_TOGGLE_ID)) {
            insertButtons();
        }
    }
}

// Task processing handler - DEBOUNCED for batching (like Raid Hunter's fight toast, but with delay)
let mutationProcessTimer = null;
function handleTaskProcessing(mutations) {
    // Debounce task processing to batch rapid mutations
    if (mutationProcessTimer) {
        clearTimeout(mutationProcessTimer);
    }
    
    mutationProcessTimer = setTimeout(() => {
        processMutations(mutations);
        mutationProcessTimer = null;
    }, 100); // 100ms debounce delay for task processing
}

// Consolidated mutation processing (like Raid Hunter)
function processAllMutations(mutations) {
    // Handle quest log detection immediately (button insertion)
    handleQuestLogDetection(mutations);
    
    // Handle task processing with debounce (task logic)
    handleTaskProcessing(mutations);
}

// Actual mutation processing logic
function processMutations(mutations) {
    let hasQuestLogContent = false;
    
    // Process all mutations in one pass
    for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check for quest log content
                    if (!hasQuestLogContent) {
                        hasQuestLogContent = checkForQuestLogContent(node);
                    }
                }
            }
        }
    }
    
    // Handle quest log detection (task processing logic only - buttons already inserted above)
    if (hasQuestLogContent) {
        // Only trigger task completion logic if we're not already processing a task
        // and we're not just inserting UI elements
        if (!taskOperationInProgress && !pendingTaskCompletion && !taskHuntingOngoing) {
            console.log('[Better Tasker] Quest log opened for task processing - checking for tasks...');
            // Small delay to let quest log fully load before checking
            setTimeout(() => {
                scheduleTaskCheck();
            }, 100);
        } else {
            console.log('[Better Tasker] Quest log opened but task operation already in progress - skipping task check');
        }
    }
}

// Monitors quest log visibility
function monitorQuestLogVisibility() {
    // Skip if observer already exists
    if (questLogObserver) {
        console.log('[Better Tasker] Observer already exists, skipping');
        return;
    }
    
    // Consolidated MutationObserver for quest log and Paw and Fur Society detection
    questLogObserver = new MutationObserver(processAllMutations);
    
    questLogObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('[Better Tasker] MutationObserver set up for quest log and Paw and Fur Society detection');
}

// Starts UI monitoring (always runs to insert buttons)
function startUIMonitoring() {
    console.log('[Better Tasker] Starting UI monitoring...');
    
    // Clear any existing UI monitoring first
    
    if (questLogObserver) {
        console.log('[Better Tasker] Disconnecting existing UI observer');
        questLogObserver.disconnect();
        questLogObserver = null;
    }
    
    // Set up MutationObserver for quest log detection (UI only)
    monitorQuestLogVisibility();
}

// Stops quest log monitoring
function stopQuestLogMonitoring() {
    console.log('[Better Tasker] Stopping quest log monitoring...');
    
    // Disconnect mutation observer
    if (questLogObserver) {
        questLogObserver.disconnect();
        questLogObserver = null;
    }
}

// ============================================================================
// 9. SETTINGS MODAL
// ============================================================================

// Cleanup function for modal state
function cleanupTaskerModal() {
    try {
        clearTaskerModalLayoutCleanup();
        // Clear modal reference
        if (activeTaskerModal) {
            activeTaskerModal = null;
        }
        
        // Remove ESC key listener
        if (escKeyListener) {
            document.removeEventListener('keydown', escKeyListener);
            escKeyListener = null;
        }
        
        // Reset modal state
        taskerModalInProgress = false;
        lastModalCall = 0;
        
        console.log('[Better Tasker] Modal cleanup completed');
    } catch (error) {
        console.error('[Better Tasker] Error during modal cleanup:', error);
    }
}

const TASKER_MODAL_CONFIG = {
    width: 700,
    height: 500,
    leftColumnWidth: 200,
    contentInset: 35,
    viewportPadding: 16,
    minWidth: 280,
    minHeight: 280
};

function getTaskerModalDimensions() {
    const pad = TASKER_MODAL_CONFIG.viewportPadding * 2;
    return {
        width: Math.max(
            TASKER_MODAL_CONFIG.minWidth,
            Math.min(TASKER_MODAL_CONFIG.width, window.innerWidth - pad)
        ),
        height: Math.max(
            TASKER_MODAL_CONFIG.minHeight,
            Math.min(TASKER_MODAL_CONFIG.height, window.innerHeight - pad)
        )
    };
}

function getTaskerColumnWidths(modalWidth) {
    const contentWidth = modalWidth - TASKER_MODAL_CONFIG.contentInset;
    if (modalWidth >= TASKER_MODAL_CONFIG.width) {
        return {
            contentWidth: TASKER_MODAL_CONFIG.width - TASKER_MODAL_CONFIG.contentInset,
            leftWidth: TASKER_MODAL_CONFIG.leftColumnWidth
        };
    }
    const leftWidth = Math.min(
        TASKER_MODAL_CONFIG.leftColumnWidth,
        Math.max(90, Math.floor(contentWidth * 0.28))
    );
    return { contentWidth, leftWidth };
}

function getTaskerDialog(modalRef) {
    if (modalRef?.element) return modalRef.element;
    if (modalRef instanceof HTMLElement) return modalRef;
    return document.querySelector('div[role="dialog"][data-state="open"]');
}

function clearTaskerModalLayoutCleanup() {
    if (taskerModalLayoutCleanup) {
        taskerModalLayoutCleanup();
        taskerModalLayoutCleanup = null;
    }
}

function applyTaskerModalLayout(modalRef, contentRoot, dimensions) {
    const dialog = getTaskerDialog(modalRef);
    if (!dialog) return;

    const { width, height } = dimensions;
    const { contentWidth, leftWidth } = getTaskerColumnWidths(width);

    dialog.style.width = `${width}px`;
    dialog.style.minWidth = '0';
    dialog.style.maxWidth = `${width}px`;
    dialog.style.height = `${height}px`;
    dialog.style.minHeight = '0';
    dialog.style.maxHeight = `${height}px`;
    dialog.style.boxSizing = 'border-box';
    dialog.classList.remove('max-w-[300px]');

    const rootWrapper = dialog.querySelector(':scope > div');
    if (rootWrapper) {
        rootWrapper.style.height = '100%';
        rootWrapper.style.display = 'flex';
        rootWrapper.style.flexDirection = 'column';
        rootWrapper.style.flex = '1 1 0';
        rootWrapper.style.minHeight = '0';
    }

    const contentContainer = dialog.querySelector('.widget-bottom');
    if (contentContainer) {
        Object.assign(contentContainer.style, {
            flex: '1 1 auto',
            minHeight: '0',
            overflowY: 'hidden',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        });
    }

    if (contentRoot) {
        Object.assign(contentRoot.style, {
            flex: '1 1 auto',
            minHeight: '0',
            height: '100%',
            maxHeight: 'none',
            minWidth: `${contentWidth}px`,
            maxWidth: `${contentWidth}px`
        });

        const leftColumn = contentRoot.querySelector('.better-tasker-modal-left');
        const rightColumn = contentRoot.querySelector('.better-tasker-modal-right');
        if (leftColumn) {
            Object.assign(leftColumn.style, {
                width: `${leftWidth}px`,
                minWidth: `${leftWidth}px`,
                maxWidth: `${leftWidth}px`,
                flex: `0 0 ${leftWidth}px`,
                minHeight: '0'
            });
        }
        if (rightColumn) {
            Object.assign(rightColumn.style, {
                flex: '1 1 0',
                minWidth: '0',
                minHeight: '0',
                height: 'auto',
                maxHeight: 'none'
            });
        }
    }
}

function setupTaskerModalResponsiveLayout(modalRef, contentRoot) {
    clearTaskerModalLayoutCleanup();
    const apply = () => applyTaskerModalLayout(modalRef, contentRoot, getTaskerModalDimensions());
    requestAnimationFrame(() => apply());
    const onResize = () => apply();
    window.addEventListener('resize', onResize);
    taskerModalLayoutCleanup = () => {
        window.removeEventListener('resize', onResize);
    };
}

// Open Tasker Settings Modal
function openTaskerSettingsModal() {
    try {
        const now = Date.now();
        if (taskerModalInProgress) return;
        if (now - lastModalCall < 1000) return;
        
        lastModalCall = now;
        taskerModalInProgress = true;
        clearTaskerModalLayoutCleanup();
        
        (() => {
            try {
                if (!taskerModalInProgress) return;
                
                // Simulate ESC key to remove scroll lock
                clearModalsWithEscSync(1);
                
                // Small delay to ensure scroll lock is removed
                setTimeout(() => {
                    if (typeof context !== 'undefined' && context.api && context.api.ui) {
                        try {
                            // Create settings content
                            const settingsContent = createSettingsContent();
                            const modalDimensions = getTaskerModalDimensions();

                            activeTaskerModal = context.api.ui.components.createModal({
                                title: t('mods.betterTasker.modalTitle'),
                                width: modalDimensions.width,
                                height: modalDimensions.height,
                                content: settingsContent,
                                buttons: [{ text: t('mods.betterTasker.closeButton'), primary: true }],
                                onClose: () => {
                                    console.log('[Better Tasker] Settings modal closed');
                                    cleanupTaskerModal();
                                }
                            });

                            const originalClose = activeTaskerModal?.close?.bind(activeTaskerModal);
                            if (originalClose) {
                                activeTaskerModal.close = () => {
                                    clearTaskerModalLayoutCleanup();
                                    originalClose();
                                };
                            }
                            
                            // Add ESC key support for closing modal
                            escKeyListener = (event) => {
                                if (event.key === 'Escape' && activeTaskerModal) {
                                    console.log('[Better Tasker] ESC key pressed, closing modal');
                                    cleanupTaskerModal();
                                }
                            };
                            document.addEventListener('keydown', escKeyListener);
                            
                            setupTaskerModalResponsiveLayout(activeTaskerModal, settingsContent);
                            requestAnimationFrame(() => loadAndApplySettings());
                            
                            // Inject auto-save indicator into the existing modal footer
                            setTimeout(() => {
                                const modalElement = document.querySelector('div[role="dialog"][data-state="open"]');
                                if (modalElement) {
                                    const footer = modalElement.querySelector('.flex.justify-end.gap-2');
                                    if (footer) {
                                        // Create auto-save indicator
                                        const autoSaveIndicator = document.createElement('div');
                                        autoSaveIndicator.textContent = t('mods.betterTasker.settingsAutoSave');
                                        autoSaveIndicator.className = 'pixel-font-16';
                                        autoSaveIndicator.style.cssText = `
                                            font-size: 11px;
                                            color: #4ade80;
                                            font-style: italic;
                                            margin-right: auto;
                                        `;
                                        
                                        // Modify footer to use space-between layout
                                        footer.style.cssText = `
                                            display: flex;
                                            justify-content: space-between;
                                            align-items: center;
                                            gap: 2px;
                                        `;
                                        
                                        // Insert auto-save indicator at the beginning
                                        footer.insertBefore(autoSaveIndicator, footer.firstChild);
                                    }
                                }
                            }, 100);
                        } catch (error) {
                            console.error('[Better Tasker] Error creating modal:', error);
                            try {
                                alert('Failed to open settings. Please try again.');
                            } catch (alertError) {
                                console.error('[Better Tasker] Even fallback alert failed:', alertError);
                            }
                        } finally {
                            taskerModalInProgress = false;
                        }
                    } else {
                        console.warn('[Better Tasker] API not available for modal creation');
                        alert('Better Tasker Settings - API not available');
                        taskerModalInProgress = false;
                    }
                }, 100);
            } catch (error) {
                console.error('[Better Tasker] Error in modal creation wrapper:', error);
                taskerModalInProgress = false;
            }
        })();
        
    } catch (error) {
        console.error('[Better Tasker] Error in openTaskerSettingsModal:', error);
        taskerModalInProgress = false;
    }
}

// Create settings content
function createSettingsContent() {
    // Main container with 2-column layout
    const mainContainer = document.createElement('div');
    mainContainer.className = 'better-tasker-modal-root';
    mainContainer.style.cssText = `
        display: flex;
        flex-direction: row;
        width: 100%;
        height: 100%;
        min-width: 0;
        max-width: 100%;
        min-height: 0;
        max-height: none;
        flex: 1 1 auto;
        box-sizing: border-box;
        overflow: hidden;
        background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
        color: #fff;
        font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
        border: 4px solid transparent;
        border-image: url('https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png') 6 fill stretch;
        border-radius: 6px;
    `;
    
    // Left column - Auto-Task Settings
    const leftColumn = document.createElement('div');
    leftColumn.className = 'better-tasker-modal-left';
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
    
    // Right column - Task Settings
    const rightColumn = document.createElement('div');
    rightColumn.className = 'better-tasker-modal-right';
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
    
    // Left column content - Auto-Task Settings
    const leftContent = createGeneralSettings();
    leftColumn.appendChild(leftContent);
    
    // Right column content - Task Settings
    const rightContent = createTaskSettings();
    rightColumn.appendChild(rightContent);
    
    mainContainer.appendChild(leftColumn);
    mainContainer.appendChild(rightColumn);
    
    return mainContainer;
}

// Create Auto-Task Settings section
function createGeneralSettings() {
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
    title.textContent = t('mods.betterTasker.defaultSettings');
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0 0 10px 0;
        color: #ffe066;
        font-weight: bold;
        text-align: center;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    container.appendChild(title);
    
    // Create wrapper for main settings content that will be centered
    const settingsWrapper = document.createElement('div');
    settingsWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex: 1;
        justify-content: center;
    `;
    
    // Task Start Delay setting
    const taskDelayDiv = document.createElement('div');
    taskDelayDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    const taskDelayLabel = document.createElement('label');
    taskDelayLabel.textContent = t('mods.betterTasker.taskStartDelay');
    taskDelayLabel.className = 'pixel-font-16';
    taskDelayLabel.style.cssText = `
        font-weight: bold;
        color: #fff;
        margin-bottom: 4px;
    `;
    taskDelayDiv.appendChild(taskDelayLabel);
    
    const taskDelayInput = createStyledInput('number', 'taskStartDelay', 3, `
        width: 100%;
        padding: 6px;
        background: #333;
        border: 1px solid #ffe066;
        color: #fff;
        border-radius: 3px;
        box-sizing: border-box;
        font-size: 14px;
    `, { 
        min: 0, 
        max: 10, 
        className: 'pixel-font-16' 
    });
    // Add auto-save listener with tracking
    addTrackedListener(taskDelayInput, 'input', autoSaveSettings);
    taskDelayDiv.appendChild(taskDelayInput);
    
    settingsWrapper.appendChild(taskDelayDiv);
    
    // Setup method selection
    const setupMethodDiv = createDropdownSetting(
        'setupMethod',
        t('mods.betterTasker.setupMethod'),
        '',
        loadSettings().setupMethod || t('mods.betterTasker.autoSetup'),
        getAvailableSetupOptions()
    );
    settingsWrapper.appendChild(setupMethodDiv);
    
    // Auto-refill Stamina setting
    const staminaRefillSetting = createCheckboxSetting(
        'autoRefillStamina',
        t('mods.betterTasker.autoRefillStamina'),
        '',
        false
    );
    settingsWrapper.appendChild(staminaRefillSetting);
    
    // Faster Autoplay setting
    const fasterAutoplaySetting = createCheckboxSetting(
        'fasterAutoplay',
        t('mods.betterTasker.fasterAutoplay'),
        '',
        false
    );
    settingsWrapper.appendChild(fasterAutoplaySetting);
    
    // Auto-complete Tasks setting
    const autoCompleteSetting = createCheckboxSetting(
        'autoCompleteTasks',
        t('mods.betterTasker.autocompleteTasks'),
        '',
        true
    );
    settingsWrapper.appendChild(autoCompleteSetting);
    
    // Enable Autoplant setting
    const dragonPlantSetting = createCheckboxSetting(
        'enableDragonPlant',
        t('mods.betterTasker.enableAutoplant'),
        '',
        false
    );
    settingsWrapper.appendChild(dragonPlantSetting);
    
    // Add settings wrapper to container
    container.appendChild(settingsWrapper);
    
    
    return container;
}

// Create Task Settings section
function createTaskSettings() {
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
        flex: 1 1 0;
    `;
    
    // Monster Selection Settings
    const monsterSection = createMonsterSelectionSettings();
    container.appendChild(monsterSection);
    
    return container;
}

// Create Monster Selection Settings section
function createMonsterSelectionSettings() {
    const section = document.createElement('div');
    section.style.cssText = `
        padding: 15px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #444;
        border-radius: 5px;
        margin: 0;
        flex: 1 1 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
    `;
    
    const title = document.createElement('h3');
    title.textContent = t('mods.betterTasker.monsterSelectionTitle');
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0 0 15px 0;
        color: #ffe066;
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        flex-shrink: 0;
    `;
    section.appendChild(title);
    
    // Add warning about active tasks
    const warning = document.createElement('div');
    warning.className = 'pixel-font-14';
    warning.style.cssText = `
        margin-bottom: 15px;
        padding: 8px 12px;
        background: rgba(255, 193, 7, 0.1);
        border: 1px solid rgba(255, 193, 7, 0.3);
        border-radius: 4px;
        color: #ffc107;
        font-weight: bold;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
        flex-shrink: 0;
        display: none;
    `;
    
    // Create monster selection container first
    const monsterContainer = document.createElement('div');
    monsterContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1 1 0;
        min-height: 0;
        max-height: none;
        overflow-y: auto;
        border: 1px solid #555;
        border-radius: 3px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.3);
    `;
    
    // Get creatures from the creature database
    const creatures = getTaskerPickerCreatures();
    const settings = loadSettings();
    
    if (creatures.length === 0) {
        const noCreaturesDiv = document.createElement('div');
        noCreaturesDiv.textContent = t('mods.betterTasker.noCreaturesAvailable');
        noCreaturesDiv.className = 'pixel-font-16';
        noCreaturesDiv.style.cssText = `
            color: #888;
            font-style: italic;
            text-align: center;
            padding: 20px;
        `;
        monsterContainer.appendChild(noCreaturesDiv);
    } else {
        // Create checkboxes for each creature
        creatures.forEach(creatureName => {
            const isUnselectable = UNSELECTABLE_CREATURES.includes(creatureName);
            const creatureKey = getCreatureSettingsKey(creatureName);
            
            const creatureDiv = document.createElement('div');
            creatureDiv.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 2px 0;
                ${isUnselectable ? 'opacity: 0.4;' : ''}
            `;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `creature-${creatureName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
            checkbox.checked = isUnselectable ? false : true; // Unselectable creatures default to unchecked
            checkbox.disabled = isUnselectable; // Disable unselectable creatures
            checkbox.style.cssText = `
                width: 16px;
                height: 16px;
                accent-color: #ffe066;
                ${isUnselectable ? 'cursor: not-allowed;' : ''}
            `;
            
            const label = document.createElement('label');
            label.textContent = creatureName;
            label.className = 'pixel-font-16';
            label.style.cssText = `
                color: ${isUnselectable ? '#666' : '#fff'};
                cursor: ${isUnselectable ? 'not-allowed' : 'pointer'};
                flex: 1;
            `;
            label.setAttribute('for', checkbox.id);
            if (isUnselectable) {
                label.setAttribute('title', t('mods.betterTasker.creatureCannotAppearTooltip'));
            }
            
        // Create warning symbol for unselected creatures
        const warningSymbol = document.createElement('span');
        warningSymbol.className = 'creature-warning-symbol';
        warningSymbol.style.cssText = `
            color: #ffc107;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.2s ease;
            cursor: help;
            width: 14px;
            display: inline-block;
        `;
        
        if (!isUnselectable) {
            warningSymbol.textContent = '⚠️';
            warningSymbol.setAttribute('title', t('mods.betterTasker.warningUnselected'));
        } else {
            // Keep blank space for alignment
            warningSymbol.textContent = '';
        }
            
        // Function to update warning visibility and count
        const updateWarningVisibility = () => {
            if (!isUnselectable) {
                warningSymbol.style.opacity = checkbox.checked ? '0' : '1';
            }
            window.updateWarningText(); // Update the warning count
        };
            
            // Add change listener to checkbox with tracking (skip disabled checkboxes)
            if (!isUnselectable) {
                addTrackedListener(checkbox, 'change', updateWarningVisibility);
            }
            
            const customIndicator = document.createElement('span');
            customIndicator.className = 'pixel-font-14';
            customIndicator.textContent = '⚙';
            customIndicator.title = isUnselectable
                ? ''
                : 'Right-click to set map, stamina, floor, and setup for this creature';
            customIndicator.style.cssText = `
                opacity: ${settings.creatureOverrides?.[creatureKey] ? '1' : '0.3'};
                color: ${settings.creatureOverrides?.[creatureKey] ? '#6ee07a' : '#8a8f98'};
                margin-left: auto;
                margin-right: 4px;
                font-size: 14px;
                font-weight: 700;
                text-shadow: 0 0 2px rgba(0, 0, 0, 0.75);
                cursor: ${isUnselectable ? 'not-allowed' : 'help'};
            `;

            creatureDiv.appendChild(checkbox);
            creatureDiv.appendChild(warningSymbol);
            creatureDiv.appendChild(label);
            creatureDiv.appendChild(customIndicator);
            attachSettingsListRowHover(creatureDiv, isUnselectable);
            if (!isUnselectable) {
                creatureDiv.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    createCreatureContextMenu(creatureName, e.clientX, e.clientY, () => {
                        const hasOverrides = Boolean(getCreatureOverrides(creatureName));
                        customIndicator.style.opacity = hasOverrides ? '1' : '0.3';
                        customIndicator.style.color = hasOverrides ? '#6ee07a' : '#8a8f98';
                    });
                });
            }
            monsterContainer.appendChild(creatureDiv);
        });
    }
    
    // Function to update warning text with count (defined after monsterContainer is created)
    window.updateWarningText = () => {
        const checkboxes = monsterContainer.querySelectorAll('input[type="checkbox"]:not(:disabled)');
        const totalCreatures = checkboxes.length;
        const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        const hasUnselected = totalCreatures > 0 && selectedCount < totalCreatures;
        warning.style.display = hasUnselected ? 'block' : 'none';
        if (hasUnselected) {
            warning.textContent = tReplace('mods.betterTasker.warningUnselectedCreatures', {
                selectedCount: selectedCount,
                totalCreatures: totalCreatures
            });
        }
    };
    
    // Add warning before monster container
    section.appendChild(warning);
    section.appendChild(monsterContainer);
    
    // Set initial warning text AFTER monsterContainer is added to DOM
    window.updateWarningText();
    
    // Add select all/none buttons
    const buttonContainer = createStyledContainer(null, `
        display: flex;
        gap: 10px;
        margin-top: 10px;
        flex-shrink: 0;
    `);
    
    const selectAllBtn = createCustomStyledButton(
        'selectAllBtn',
        'Select All',
        'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 text-whiteHighlight',
        'flex: 1;',
        () => {
            const checkboxes = monsterContainer.querySelectorAll('input[type="checkbox"]:not(:disabled)');
            checkboxes.forEach(cb => {
                cb.checked = true;
                // Hide warning symbol for this checkbox
                const warningSymbol = cb.parentElement.querySelector('.creature-warning-symbol');
                if (warningSymbol) {
                    warningSymbol.style.opacity = '0';
                }
            });
            window.updateWarningText(); // Update the warning count
            autoSaveSettings(); // Auto-save after selecting all
        }
    );
    
    const selectNoneBtn = createCustomStyledButton(
        'selectNoneBtn',
        'Select None',
        'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-red active:frame-pressed-1-red surface-red gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 text-whiteHighlight',
        'flex: 1;',
        () => {
            const checkboxes = monsterContainer.querySelectorAll('input[type="checkbox"]:not(:disabled)');
            checkboxes.forEach(cb => {
                cb.checked = false;
                // Show warning symbol for this checkbox
                const warningSymbol = cb.parentElement.querySelector('.creature-warning-symbol');
                if (warningSymbol) {
                    warningSymbol.style.opacity = '1';
                }
            });
            window.updateWarningText(); // Update the warning count
            autoSaveSettings(); // Auto-save after selecting none
        }
    );
    
    buttonContainer.appendChild(selectAllBtn);
    buttonContainer.appendChild(selectNoneBtn);
    section.appendChild(buttonContainer);
    
    return section;
}

// ============================================================================
// 10. SETTINGS PERSISTENCE
// ============================================================================

// Load settings function
function loadSettings() {
    const defaultSettings = {
        autoCompleteTasks: true,
        autoRefillStamina: false,
        fasterAutoplay: false,
        enableDragonPlant: false,
        setupMethod: 'Auto-setup',  // Default to Auto-setup (translation applied at display time)
        creatureOverrides: {},
        // Default all creatures to enabled, except unselectable ones
        ...Object.fromEntries(
            getTaskerPickerCreatures().map(creature => 
                [`creature-${creature.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`, 
                 !UNSELECTABLE_CREATURES.includes(creature)]
            )
        )
    };
    
    const saved = localStorage.getItem('betterTaskerSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            return { ...defaultSettings, ...parsed };
        } catch (error) {
            console.error('[Better Tasker] Error parsing settings:', error);
        }
    }
    return defaultSettings;
}

// Auto-save settings when changed
function autoSaveSettings() {
    try {
        const settings = loadSettings();
        const inputs = document.querySelectorAll('input, select');
        
        inputs.forEach(input => {
            // Only process inputs that belong to Better Tasker settings
            if (input.id === 'autoCompleteTasks' || input.id === 'autoRefillStamina' || input.id === 'fasterAutoplay' || input.id === 'enableDragonPlant' || input.id === 'taskStartDelay' || input.id === 'setupMethod' || input.id.startsWith('creature-')) {
                // Skip disabled checkboxes (unselectable creatures)
                if (input.disabled) return;
                
                if (input.type === 'checkbox') {
                    settings[input.id] = input.checked;
                } else {
                    settings[input.id] = input.value;
                }
            }
        });
        
        // Save to localStorage
        localStorage.setItem('betterTaskerSettings', JSON.stringify(settings));
        console.log('[Better Tasker] Settings auto-saved:', settings);
        scheduleCreatureFilterCheck();
    } catch (error) {
        console.error('[Better Tasker] Error auto-saving settings:', error);
    }
}

// Load and apply settings to the modal
function loadAndApplySettings() {
    try {
        const settings = loadSettings();
        
        if (settings.autoRefillStamina !== undefined) {
            const checkbox = document.getElementById('autoRefillStamina');
            if (checkbox) {
                checkbox.checked = settings.autoRefillStamina;
                // Event listener already added by createCheckboxSetting
            }
        }
        
        if (settings.fasterAutoplay !== undefined) {
            const checkbox = document.getElementById('fasterAutoplay');
            if (checkbox) {
                checkbox.checked = settings.fasterAutoplay;
                // Event listener already added by createCheckboxSetting
            }
        }
        
        if (settings.autoCompleteTasks !== undefined) {
            const checkbox = document.getElementById('autoCompleteTasks');
            if (checkbox) {
                checkbox.checked = settings.autoCompleteTasks;
                // Event listener already added by createCheckboxSetting
            }
        }
        
        if (settings.enableDragonPlant !== undefined) {
            const checkbox = document.getElementById('enableDragonPlant');
            if (checkbox) {
                checkbox.checked = settings.enableDragonPlant;
                // Event listener already added by createCheckboxSetting
            }
        }
        
        if (settings.taskStartDelay !== undefined) {
            const input = document.getElementById('taskStartDelay');
            if (input) {
                input.value = settings.taskStartDelay;
                // Add auto-save listener with tracking
                addTrackedListener(input, 'input', autoSaveSettings);
            }
        }
        
        // Apply setup method setting
        if (settings.setupMethod !== undefined) {
            const setupMethodSelect = document.getElementById('setupMethod');
            if (setupMethodSelect) {
                setupMethodSelect.value = settings.setupMethod;
                // Add auto-save listener
                setupMethodSelect.addEventListener('change', autoSaveSettings);
            }
        }
        
        // Apply creature selections from individual settings
        const creatures = getTaskerPickerCreatures();
        console.log('[Better Tasker] Loading creature settings:', {
            hasIndividualSettings: Object.keys(settings).some(key => key.startsWith('creature-'))
        });
        
        creatures.forEach(creatureName => {
            const checkboxId = `creature-${creatureName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                // Skip applying settings to disabled checkboxes (unselectable creatures)
                if (!checkbox.disabled) {
                    // Use individual creature setting
                    const individualSetting = settings[checkboxId];
                    checkbox.checked = individualSetting !== undefined ? individualSetting : true;
                }
                
                // Update warning symbol visibility based on checkbox state
                const warningSymbol = checkbox.parentElement.querySelector('.creature-warning-symbol');
                if (warningSymbol) {
                    warningSymbol.style.opacity = checkbox.checked ? '0' : '1';
                }
            }
        });
        
        // Add auto-save listeners to all creature checkboxes (skip disabled ones)
        creatures.forEach(creatureName => {
            const checkboxId = `creature-${creatureName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
            const checkbox = document.getElementById(checkboxId);
            if (checkbox && !checkbox.disabled) {
                addTrackedListener(checkbox, 'change', autoSaveSettings);
            }
        });
        
        // Update warning text count after loading settings
        if (typeof window.updateWarningText === 'function') {
            window.updateWarningText();
        }
        
        console.log('[Better Tasker] Settings applied to modal with auto-save listeners');
    } catch (error) {
        console.error('[Better Tasker] Error applying settings:', error);
    }
}

// ============================================================================
// 11. TASK HANDLING FUNCTIONS
// ============================================================================

// Enable Bestiary Automator settings with retry logic
function enableBestiaryAutomatorSettings(returnSuccess = false, settingsOverride = null) {
    const settings = settingsOverride || loadSettings();
    let anySuccess = false;
    
    if (settings.autoRefillStamina) {
        console.log('[Better Tasker] Auto-refill stamina enabled - enabling Bestiary Automator autorefill...');
        // Add a small delay to ensure Bestiary Automator is fully initialized
        setTimeout(() => {
            const success = enableBestiaryAutomatorStaminaRefill();
            if (success) anySuccess = true;
            if (!success) {
                // If first attempt failed, try again with longer delay for Chrome
                console.log('[Better Tasker] First attempt failed, retrying with longer delay for Chrome...');
                setTimeout(() => {
                    const retrySuccess = enableBestiaryAutomatorStaminaRefill();
                    if (retrySuccess) anySuccess = true;
                }, BESTIARY_RETRY_DELAY);
            }
        }, BESTIARY_INTEGRATION_DELAY);
    } else {
        disableBestiaryAutomatorStaminaRefill();
    }
    
    if (settings.fasterAutoplay) {
        console.log('[Better Tasker] Faster autoplay enabled - enabling Bestiary Automator faster autoplay...');
        // Add a small delay to ensure Bestiary Automator is fully initialized
        setTimeout(() => {
            const success = enableBestiaryAutomatorFasterAutoplay();
            if (success) anySuccess = true;
            if (!success) {
                // If first attempt failed, try again with longer delay for Chrome
                console.log('[Better Tasker] First attempt failed, retrying with longer delay for Chrome...');
                setTimeout(() => {
                    const retrySuccess = enableBestiaryAutomatorFasterAutoplay();
                    if (retrySuccess) anySuccess = true;
                }, BESTIARY_RETRY_DELAY);
            }
        }, BESTIARY_INTEGRATION_DELAY);
    } else {
        disableBestiaryAutomatorFasterAutoplay();
    }
    
    if (settings.enableDragonPlant) {
        console.log('[Better Tasker] Dragon Plant enabled - enabling via Autoseller...');
        enableAutosellerDragonPlant();
    }
    
    // Return success status if requested (for functions that need it)
    if (returnSuccess) {
        return anySuccess;
    }
}

// Handle quest log state - close quest log first, then navigate to suggested map
async function handleQuestLogState(roomId, targetFloor = 0) {
    console.log('[Better Tasker] Closing quest log before navigation...');
    await closeQuestLogIfOpen();
    console.log('[Better Tasker] Quest log close step completed');
    
    // Now navigate to the suggested map
    console.log('[Better Tasker] Navigating to selected map via API...');
    markProgrammaticNavigation();
    globalThis.state.board.send({
        type: 'selectRoomById',
        roomId: roomId
    });
    await sleep(NAVIGATION_DELAY);
    
    // Set floor from override (default 0)
    const resolvedFloor = Math.max(0, Math.min(15, Number(targetFloor) || 0));
    console.log(`[Better Tasker] Setting floor to ${resolvedFloor}`);
    globalThis.state.board.trigger.setState({ fn: (prev) => ({ ...prev, floor: resolvedFloor }) });
    await sleep(100);
    
    // Wait for map to load
    await sleep(AUTOMATION_CHECK_DELAY);
    console.log('[Better Tasker] Navigation to suggested map completed via API');
    
    return true; // Navigation completed, quest log closed
}

// Check if game is active and ready for task operations
function isGameActive() {
    try {
        // Check if Game State API is available
        if (!globalThis.state || !globalThis.state.board) {
            console.log('[Better Tasker] Game State API not available');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('[Better Tasker] Error checking game state:', error);
        return false;
    }
}

// Check if new task is available based on resetAt timestamp
function isQuestBlipAvailable() {
    try {
        const task = globalThis.state.player.get().context.questLog.task;
        
        if (!task) {
            console.log('[Better Tasker] isQuestBlipAvailable: No task object found');
            return false;
        }
        
        // If resetAt is null, a new task is available
        if (!task.resetAt) {
            console.log('[Better Tasker] isQuestBlipAvailable: ✓ New task available (resetAt is null)');
            return true;
        }
        
        // If resetAt is a timestamp, check if it's in the past
        const now = Date.now();
        const resetTime = task.resetAt;
        
        if (now >= resetTime) {
            console.log('[Better Tasker] isQuestBlipAvailable: ✓ Task cooldown expired, new task available');
            return true;
        }
        
        const timeRemaining = Math.ceil((resetTime - now) / 1000);
        console.log(`[Better Tasker] isQuestBlipAvailable: ✗ Task cooldown active, ${timeRemaining}s remaining`);
        return false;
    } catch (error) {
        console.error('[Better Tasker] isQuestBlipAvailable: Error checking task availability:', error);
        return false;
    }
}

function getCurrentTaskGameId() {
    try {
        return globalThis.state?.player?.getSnapshot?.()?.context?.questLog?.task?.gameId
            ?? globalThis.state?.player?.get?.()?.context?.questLog?.task?.gameId
            ?? null;
    } catch (_) {
        return null;
    }
}

function clearCreatureFilterCache() {
    creatureFilterValidatedGameId = null;
}

function markCreatureFilterValidated() {
    creatureFilterValidatedGameId = getCurrentTaskGameId();
}

function isCreatureFilterAlreadyValidated() {
    const gameId = getCurrentTaskGameId();
    return gameId != null && creatureFilterValidatedGameId === gameId;
}

function getActiveTaskCreatureNameFromGameState() {
    try {
        const taskGameId = getCurrentTaskGameId();
        if (taskGameId == null) return null;
        return getCreatureNameByGameId(taskGameId) || null;
    } catch (error) {
        console.error('[Better Tasker] Error resolving task creature from game state:', error);
        return null;
    }
}

function resolveCurrentTaskCreatureName() {
    return getActiveTaskCreatureNameFromGameState() || extractCreatureFromTask();
}

function hasActiveQuestTask() {
    try {
        const activeTask = globalThis.state?.player?.activeTask;
        const taskGameId = globalThis.state?.player?.getSnapshot?.()?.context?.questLog?.task?.gameId;
        return !!(activeTask || taskGameId);
    } catch (_) {
        return false;
    }
}

function resolveBoostedMapsEquipmentRuleSettings(roomId) {
    if (!roomId) return null;
    try {
        if (typeof window.betterBoostedMapsResolveEquipmentRuleSettings === 'function') {
            return window.betterBoostedMapsResolveEquipmentRuleSettings(String(roomId));
        }
    } catch (error) {
        console.error('[Better Tasker] Error using Better Boosted Maps equipment-rule resolver:', error);
    }
    return null;
}

function resolveTaskerAutomationSettingsForRoom(roomId, baseSettings, baseFloor) {
    const fallbackSetupMethod = baseSettings?.setupMethod || 'Auto-setup';
    const fallbackAutoRefill = baseSettings?.autoRefillStamina !== undefined
        ? !!baseSettings.autoRefillStamina
        : false;
    const fallbackFloor = Math.max(0, Math.min(15, Number(baseFloor) || 0));

    const equipmentRuleOverride = resolveBoostedMapsEquipmentRuleSettings(roomId);
    if (!equipmentRuleOverride) {
        return {
            setupMethod: fallbackSetupMethod,
            autoRefillStamina: fallbackAutoRefill,
            floor: fallbackFloor,
            source: 'tasker-default'
        };
    }

    const resolved = {
        setupMethod: equipmentRuleOverride.setupMethod || fallbackSetupMethod,
        // Keep Better Tasker stamina behavior unchanged (no BBM stamina override).
        autoRefillStamina: fallbackAutoRefill,
        floor: equipmentRuleOverride.floor != null
            ? Math.max(0, Math.min(15, Number(equipmentRuleOverride.floor) || 0))
            : fallbackFloor,
        source: 'better-boosted-maps-equipment-rule'
    };
    console.log('[Better Tasker] Using Better Boosted Maps equipment-rule settings for current boosted map:', {
        roomId: String(roomId),
        setupMethod: resolved.setupMethod,
        autoRefillStamina: resolved.autoRefillStamina,
        floor: resolved.floor
    });
    return resolved;
}

// Navigate to suggested map and start autoplay using API
async function navigateToSuggestedMapAndStartAutoplay(suggestedMapElement = null, preferredCreatureName = null) {
    try {
        if (isManualPlayPaused()) {
            console.log('[Better Tasker] Manual play pause active - skipping navigation');
            return false;
        }

        if (isRaidHunterRaiding()) {
            console.log('[Better Tasker] Raid Hunter is actively raiding HIGH priority raid - aborting navigation (HIGH priority raid takes precedence)');
            return false;
        }
        
        const settings = loadSettings();
        const activeCreatureName = preferredCreatureName || getActiveTaskCreatureNameFromGameState() || extractCreatureFromTask();
        const creatureOverride = getCreatureOverrides(activeCreatureName);
        const resolvedSetupMethod = creatureOverride?.setupMethod || settings.setupMethod || 'Auto-setup';
        const resolvedFloor = creatureOverride?.floor != null ? creatureOverride.floor : 0;
        const resolvedAutoRefillStamina = creatureOverride?.autoRefillStamina !== undefined
            ? !!creatureOverride.autoRefillStamina
            : !!settings.autoRefillStamina;
        let runtimeSettings = {
            ...settings,
            setupMethod: resolvedSetupMethod,
            autoRefillStamina: resolvedAutoRefillStamina
        };
        console.log('[Better Tasker] Per-creature override resolution:', {
            preferredCreatureName,
            activeCreatureName,
            hasOverride: !!creatureOverride,
            overrideMapId: creatureOverride?.mapId ?? null,
            resolvedSetupMethod,
            resolvedFloor,
            resolvedAutoRefillStamina
        });

        // First, ensure quest log is open
        const questLogOpened = await openQuestLogDirectly();
        if (!questLogOpened) {
            console.log('[Better Tasker] Failed to open quest log - checking if we can use stored map ID...');
            
            // If quest log cannot be opened (e.g., during autoplay), try to use stored taskingMapId
            if (taskingMapId) {
                console.log(`[Better Tasker] Using stored tasking map ID: ${taskingMapId}`);
                const roomId = (creatureOverride?.mapId != null ? String(creatureOverride.mapId) : null) || taskingMapId;
                console.log('[Better Tasker] Stored-map navigation target:', {
                    overrideMapId: creatureOverride?.mapId ?? null,
                    taskingMapId,
                    selectedRoomId: roomId
                });
                const roomAutomation = resolveTaskerAutomationSettingsForRoom(roomId, runtimeSettings, resolvedFloor);
                runtimeSettings = {
                    ...runtimeSettings,
                    setupMethod: roomAutomation.setupMethod,
                    autoRefillStamina: roomAutomation.autoRefillStamina
                };
                
                // Show toast notification
                showTaskStartToast();
                
                // Handle quest log state and navigation
                const navigationCompleted = await handleQuestLogState(roomId, roomAutomation.floor);
                
                // Set the tasking map ID for future validation (already set, but ensure it's preserved)
                taskingMapId = roomId;
                
                // Continue with setup...
                const setupMethod = roomAutomation.setupMethod || runtimeSettings.setupMethod || 'Auto-setup';
                
                // Find and click the appropriate setup button
                console.log(`[Better Tasker] Looking for ${setupMethod} button...`);
                const setupButton = findSetupButton(setupMethod);
                if (!setupButton) {
                    console.log(`[Better Tasker] ${setupMethod} button not found`);
                    return false;
                }
                
                console.log(`[Better Tasker] Clicking ${setupMethod} button...`);
                setupButton.click();
                await sleep(AUTO_SETUP_DELAY);
                
                // Enable autoplay mode
                console.log('[Better Tasker] Enabling autoplay mode...');
                const autoplayEnabled = ensureAutoplayMode();
                if (!autoplayEnabled) {
                    console.log('[Better Tasker] Autoplay mode could not be enabled (blocked by Stamina Optimizer or other mod) - will still try to click Start button');
                    // Don't return - continue to check stamina and try clicking Start button
                } else {
                    await sleep(AUTOPLAY_SETUP_DELAY);
                }

                // Enable Bestiary Automator settings if configured (moved outside autoplay condition)
                enableBestiaryAutomatorSettings(false, runtimeSettings);

                // Wait for Bestiary Automator to initialize
                console.log('[Better Tasker] Waiting for Bestiary Automator to initialize...');
                await sleep(BESTIARY_INIT_WAIT);
                
                // Post-navigation settings validation
                validateSettingsAfterNavigation();
                
                // Set flag BEFORE checking stamina to prevent rechecking during ongoing task
                taskNavigationCompleted = true;
                console.log('[Better Tasker] Task navigation flag set - will not repeat quest log navigation during ongoing task');
                
                // Check stamina before clicking Start button
                const staminaCheck = hasInsufficientStamina();
                
                if (staminaCheck.insufficient) {
                    console.log(`[Better Tasker] Insufficient stamina (needs ${staminaCheck.cost}) - starting monitoring`);
                    
                    // Start stamina recovery monitoring (tooltip + API for progress) with continuous monitoring
                    const continuousStaminaMonitoring = createStaminaMonitoringCallback(
                        'Stamina recovered - checking autoplay state',
                        'Autoplay started after stamina recovery'
                    );
                    
                    startStaminaTooltipMonitoring(continuousStaminaMonitoring, staminaCheck.cost); // Pass required stamina
                    
                    return true; // Exit - monitoring will handle the rest
                }
                
                // Stamina is sufficient - proceed with Start button
                const startButton = findButtonByText('Start');
                if (!startButton) {
                    console.log('[Better Tasker] Start button not found');
                    return false;
                }
                
                taskHuntingOngoing = true;
                updateExposedState();
                console.log('[Better Tasker] Task hunting flag set - automation disabled until task completion');
                refreshTaskHuntingRunsBudget('navigate-stored-map-initial');
                startButton.click();
                
                // Modify quest button appearance to show tasking state
                modifyQuestButtonForTasking();
                questButtonModifiedForTasking = true;
                
                // Start quest button validation monitoring for task hunting
                startQuestButtonValidation();
                
                // Start continuous stamina monitoring for depletion during autoplay
                const continuousStaminaMonitoring = () => {
                    console.log('[Better Tasker] Stamina recovered - checking autoplay state');
                    
                    // Check if still valid to continue
                    if (!taskHuntingOngoing) {
                        console.log('[Better Tasker] Task no longer active during stamina recovery');
                        stopStaminaTooltipMonitoring();
                        return;
                    }
                    
                    // Check if user is still on correct tasking map
                    if (!isOnCorrectTaskingMap()) {
                        console.log('[Better Tasker] User changed map - stopping stamina monitoring');
                        stopStaminaTooltipMonitoring();
                        return;
                    }
                    
                    // Check if autoplay session is actually running (not just mode enabled)
                    const boardContext = globalThis.state.board.getSnapshot().context;
                    const isAutoplayMode = boardContext.mode === 'autoplay';
                    const isAutoplaySessionRunning = boardContext.isRunning || boardContext.autoplayRunning;
                    
                    if (isAutoplayMode && isAutoplaySessionRunning) {
                        // Autoplay session is actually running - just continue monitoring
                        console.log('[Better Tasker] Autoplay session running - continuing stamina monitoring');
                        startStaminaTooltipMonitoring(continuousStaminaMonitoring);
                    } else {
                        // Autoplay session is not running - need to click Start button
                        console.log('[Better Tasker] Autoplay session not running - clicking Start button');
                        
                        // Find and click Start button
                        const startButton = findButtonByText('Start');
                        if (!startButton) {
                            console.log('[Better Tasker] Start button not found after stamina recovery');
                            resetState('navigation');
                            return;
                        }
                        
                        console.log('[Better Tasker] Clicking Start button after stamina recovery...');
                        refreshTaskHuntingRunsBudget('navigate-stored-map-stamina-recovery');
                        startButton.click();
                        
                        // Continue monitoring for stamina depletion
                        startStaminaTooltipMonitoring(continuousStaminaMonitoring);
                    }
                };
                
                startStaminaTooltipMonitoring(continuousStaminaMonitoring);
                
                return true; // Navigation successful
            } else {
                console.log('[Better Tasker] No stored tasking map ID available - cannot proceed without quest log access');
                return false;
            }
        }
        
        // Wait for quest log to fully load
        await sleep(AUTOMATION_CHECK_DELAY);
        
        // Use provided element or look for the suggested map link
        let suggestedMapLink = suggestedMapElement;
        if (!suggestedMapLink) {
            // Look for the suggested map link only within Paw and Fur Society section
            const pawAndFurSection = findPawAndFurSection();
            if (pawAndFurSection) {
                // Look for suggested map text within this section
                const allParagraphs = pawAndFurSection.querySelectorAll('p.pixel-font-14');
                const suggestedMapText = t('mods.betterTasker.suggestedMap');
                for (const p of allParagraphs) {
                    if (p.textContent && p.textContent.includes(suggestedMapText)) {
                        suggestedMapLink = p.querySelector('span.action-link');
                        break;
                    }
                }
            } else {
                console.log('[Better Tasker] Paw and Fur Society section not found');
            }
            
            // If still no link found in Paw and Fur Society section, don't proceed
            if (!suggestedMapLink) {
                console.log('[Better Tasker] No suggested map found in Paw and Fur Society section');
                return false;
            }
        }
        if (suggestedMapLink) {
            
            // Debug: Log all attributes of the suggested map element
            console.log('[Better Tasker] Suggested map element attributes:', {
                tagName: suggestedMapLink.tagName,
                className: suggestedMapLink.className,
                id: suggestedMapLink.id,
                textContent: suggestedMapLink.textContent.trim(),
                allAttributes: Array.from(suggestedMapLink.attributes).map(attr => `${attr.name}="${attr.value}"`)
            });
            
            // Extract map name from text content
            const mapName = suggestedMapLink.textContent.trim();
            
            // Try to find room ID using game state API
            let roomId = null;
            if (globalThis.state?.utils?.ROOM_NAME) {
                // Find room ID by map name
                for (const [id, name] of Object.entries(globalThis.state.utils.ROOM_NAME)) {
                    if (name === mapName) {
                        roomId = id;
                        break;
                    }
                }
            }
            const overrideMapId = creatureOverride?.mapId != null ? String(creatureOverride.mapId) : null;
            if (overrideMapId) {
                roomId = overrideMapId;
                console.log(`[Better Tasker] Using per-creature override map ID for "${activeCreatureName}": ${roomId}`);
            }
            console.log('[Better Tasker] Suggested-map navigation target:', {
                suggestedMapName: mapName,
                suggestedRoomId: roomId,
                overrideMapId,
                activeCreatureName
            });
            
            if (roomId) {
                const roomAutomation = resolveTaskerAutomationSettingsForRoom(roomId, runtimeSettings, resolvedFloor);
                runtimeSettings = {
                    ...runtimeSettings,
                    setupMethod: roomAutomation.setupMethod,
                    autoRefillStamina: roomAutomation.autoRefillStamina
                };
                showTaskStartToast();
                
                // Handle quest log state and navigation
                const navigationCompleted = await handleQuestLogState(roomId, roomAutomation.floor);
                
                // Set the tasking map ID for future validation
                taskingMapId = roomId;
                
                // Get user's selected setup method
                const setupMethod = roomAutomation.setupMethod || runtimeSettings.setupMethod || 'Auto-setup';
                
                // Find and click the appropriate setup button
                console.log(`[Better Tasker] Looking for ${setupMethod} button...`);
                const setupButton = findSetupButton(setupMethod);
                if (!setupButton) {
                    console.log(`[Better Tasker] ${setupMethod} button not found`);
                    return;
                }
                
                console.log(`[Better Tasker] Clicking ${setupMethod} button...`);
                setupButton.click();
                await sleep(AUTO_SETUP_DELAY);
                
                // Enable autoplay mode
                console.log('[Better Tasker] Enabling autoplay mode...');
                const autoplayEnabled = ensureAutoplayMode();
                if (!autoplayEnabled) {
                    console.log('[Better Tasker] Autoplay mode could not be enabled (blocked by Stamina Optimizer or other mod) - will still try to click Start button');
                    // Don't return - continue to check stamina and try clicking Start button
                } else {
                    await sleep(AUTOPLAY_SETUP_DELAY);
                }
                
                // Enable Bestiary Automator settings if configured (moved outside autoplay condition)
                enableBestiaryAutomatorSettings(false, runtimeSettings);
                
                console.log('[Better Tasker] Waiting for Bestiary Automator to initialize...');
                await sleep(BESTIARY_INIT_WAIT);
                
                // Post-navigation settings validation
                validateSettingsAfterNavigation();
                
                // Set flag BEFORE checking stamina to prevent rechecking during ongoing task
                taskNavigationCompleted = true;
                console.log('[Better Tasker] Task navigation flag set - will not repeat quest log navigation during ongoing task');
                
                // Check stamina before clicking Start button
                const staminaCheck = hasInsufficientStamina();
                
                if (staminaCheck.insufficient) {
                    console.log(`[Better Tasker] Insufficient stamina (needs ${staminaCheck.cost}) - starting monitoring`);
                    
                    // Start stamina recovery monitoring (tooltip + API for progress) with continuous monitoring
                    const continuousStaminaMonitoring = createStaminaMonitoringCallback(
                        'Stamina recovered - checking autoplay state',
                        'Autoplay started after stamina recovery'
                    );
                    
                    startStaminaTooltipMonitoring(continuousStaminaMonitoring, staminaCheck.cost); // Pass required stamina
                    
                    return; // Exit - monitoring will handle the rest
                }
                
                // Stamina is sufficient - proceed with Start button
                const startButton = findButtonByText('Start');
                if (!startButton) {
                    console.log('[Better Tasker] Start button not found');
                    return;
                }
                
                taskHuntingOngoing = true;
                updateExposedState();
                console.log('[Better Tasker] Task hunting flag set - automation disabled until task completion');
                refreshTaskHuntingRunsBudget('navigate-suggested-map-initial');
                startButton.click();
                
                // Save the current map ID for tasking validation
                const currentMapId = getCurrentRoomId();
                if (currentMapId) {
                    taskingMapId = currentMapId;
                    console.log(`[Better Tasker] Saved tasking map ID: ${taskingMapId}`);
                } else {
                    console.log('[Better Tasker] Could not save tasking map ID - map validation may not work properly');
                }
                
                // Reset failure counter on successful task start
                resetFailureCounter();
                
                // Modify quest button appearance to show tasking state (after Start button click, like Raid Hunter)
                modifyQuestButtonForTasking();
                questButtonModifiedForTasking = true;
                
                // Start quest button validation monitoring for task hunting
                startQuestButtonValidation();
                
                // Start continuous stamina monitoring for depletion during autoplay (recursive)
                const continuousStaminaMonitoring = () => {
                    console.log('[Better Tasker] Stamina recovered - checking autoplay state');
                    
                    // Check if still valid to continue
                    if (!taskHuntingOngoing) {
                        console.log('[Better Tasker] Task no longer active during stamina recovery');
                        stopStaminaTooltipMonitoring();
                        return;
                    }
                    
                    // Check if user is still on correct tasking map
                    if (!isOnCorrectTaskingMap()) {
                        console.log('[Better Tasker] User changed map - stopping stamina monitoring');
                        stopStaminaTooltipMonitoring();
                        return;
                    }
                    
                    // Check if autoplay session is actually running (not just mode enabled)
                    const boardContext = globalThis.state.board.getSnapshot().context;
                    const isAutoplayMode = boardContext.mode === 'autoplay';
                    const isAutoplaySessionRunning = boardContext.isRunning || boardContext.autoplayRunning;
                    
                    if (isAutoplayMode && isAutoplaySessionRunning) {
                        // Autoplay session is actually running - just continue monitoring
                        console.log('[Better Tasker] Autoplay session running - continuing stamina monitoring');
                        startStaminaTooltipMonitoring(continuousStaminaMonitoring);
                    } else {
                        // Autoplay session is not running - need to click Start button
                        console.log('[Better Tasker] Autoplay session not running - clicking Start button');
                        
                        // Find and click Start button
                        const startButton = findButtonByText('Start');
                        if (!startButton) {
                            console.log('[Better Tasker] Start button not found after stamina recovery');
                            resetState('navigation');
                            return;
                        }
                        
                        console.log('[Better Tasker] Clicking Start button after stamina recovery...');
                        refreshTaskHuntingRunsBudget('navigate-suggested-map-stamina-recovery');
                        startButton.click();
                        
                        // Continue monitoring for stamina depletion
                        startStaminaTooltipMonitoring(continuousStaminaMonitoring);
                    }
                };
                
                startStaminaTooltipMonitoring(continuousStaminaMonitoring);
                
                await sleep(TASK_START_DELAY);
                
                return true; // Navigation successful
            } else {
                console.log('[Better Tasker] No room ID found for map name:', mapName);
                console.log('[Better Tasker] Available maps:', globalThis.state?.utils?.ROOM_NAME ? Object.values(globalThis.state.utils.ROOM_NAME) : 'Not available');
            }
        }
        
        // If no suggested map found or no room ID extracted, log and return
        console.log('[Better Tasker] No suggested map found or no room ID available for API navigation');
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error navigating to suggested map:', error);
        return false;
    }
}

// Check if autoplay is active and quest log is accessible
function checkIfAutoplayIsActive() {
    try {
        // Look for the autoplay button with the specific pattern that allows quest log access
        const autoplayButton = document.querySelector('button[data-full="false"][data-state="closed"]');
        if (!autoplayButton) return false;
        
        // Check if it has the autoplay text and is disabled (indicating autoplay is running)
        const buttonText = autoplayButton.textContent;
        const isDisabled = autoplayButton.hasAttribute('disabled') || autoplayButton.disabled;
        
        // Check for autoplay text and disabled state
        if (buttonText.includes('Autoplay') && isDisabled) {
            console.log('[Better Tasker] Autoplay button detected as active and quest log accessible');
            return true;
        }
        
        // If we see "Auto" with data-full="true", quest log is not accessible yet
        const autoButton = document.querySelector('button[data-full="true"][data-state="closed"]');
        if (autoButton && autoButton.textContent.includes('Auto') && autoButton.hasAttribute('disabled')) {
            console.log('[Better Tasker] Autoplay button shows "Auto" - quest log not accessible yet');
            return false;
        }
        
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error checking autoplay state:', error);
        return false;
    }
}

// Wait for game to end by continuously checking multiple game state indicators
async function waitForGameToEnd() {
    console.log('[Better Tasker] Starting continuous game state monitoring...');
    
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max wait time (60 * 2 seconds)
    
    while (attempts < maxAttempts) {
        try {
            // Check multiple indicators that game has ended
            const boardContext = globalThis.state.board.getSnapshot().context;
            const gameTimerContext = globalThis.state.gameTimer.getSnapshot().context;
            
            const isGameRunning = boardContext.gameStarted;
            const gameState = gameTimerContext.state; // 'initial', 'victory', 'defeat'
            console.log(`[Better Tasker] Game state check ${attempts + 1}: gameStarted=${isGameRunning}, gameState=${gameState}`);
            
            // Game has ended if any of these conditions are true:
            // 1. board.gameStarted is false
            // 2. gameTimer.state is 'victory' or 'defeat' (not 'initial')
            if (!isGameRunning || (gameState !== 'initial')) {
                console.log(`[Better Tasker] Game ended after ${attempts * 2} seconds - gameStarted: ${isGameRunning}, gameState: ${gameState}`);
                return true;
            }
            
            // Log progress every 10 seconds (every 5 attempts)
            if (attempts % 5 === 0 && attempts > 0) {
                console.log(`[Better Tasker] Still waiting for game to end... (${attempts * 2}s elapsed)`);
            }
            
            await sleep(2000); // Check every 2 seconds
            attempts++;
            
        } catch (error) {
            console.error('[Better Tasker] Error checking game state during wait:', error);
            await sleep(2000);
            attempts++;
        }
    }
    
    console.log('[Better Tasker] Game state monitoring timeout after 2 minutes - proceeding anyway...');
    return false;
}


// ============================================================================
// 12. BESTIARY AUTOMATOR INTEGRATION
// ============================================================================

// Find Bestiary Automator instance using multiple access methods
function findBestiaryAutomator() {
    // Method 1: Check if Bestiary Automator is available in global scope
    if (window.bestiaryAutomator && window.bestiaryAutomator.updateConfig) {
        return window.bestiaryAutomator;
    }
    // Method 2: Check if it's available in context exports
    else if (typeof context !== 'undefined' && context.exports && context.exports.updateConfig) {
        console.log('[Better Tasker] Found Bestiary Automator via context exports');
        return context.exports;
    }
    // Method 3: Try to find it in the mod loader's context
    else if (window.modLoader && window.modLoader.getModContext) {
        const automatorContext = window.modLoader.getModContext('bestiary-automator');
        if (automatorContext && automatorContext.exports && automatorContext.exports.updateConfig) {
            console.log('[Better Tasker] Found Bestiary Automator via mod loader');
            return automatorContext.exports;
        }
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

// Generic function to update Bestiary Automator configuration
function updateBestiaryAutomatorConfig(setting, value, enableRetry = false) {
    try {
        const bestiaryAutomator = findBestiaryAutomator();
        
        if (bestiaryAutomator) {
            console.log(`[Better Tasker] ${value ? 'Enabling' : 'Disabling'} Bestiary Automator ${setting}...`);
            bestiaryAutomator.updateConfig({
                [setting]: value
            });
            console.log(`[Better Tasker] Bestiary Automator ${setting} ${value ? 'enabled' : 'disabled'}`);
            
            // Verification for enable operations
            if (value && enableRetry) {
                setTimeout(() => {
                    if (window.bestiaryAutomator && window.bestiaryAutomator.config) {
                        console.log(`[Better Tasker] Verifying ${setting} setting:`, window.bestiaryAutomator.config[setting]);
                    }
                }, 1000);
            }
            
            return true;
        } else {
            console.log(`[Better Tasker] Bestiary Automator not available for ${setting}`);
            
            // Retry logic for enable operations
            if (value && enableRetry) {
                setTimeout(() => {
                    const retryAutomator = findBestiaryAutomator();
                    if (retryAutomator) {
                        console.log(`[Better Tasker] Retrying Bestiary Automator ${setting}...`);
                        retryAutomator.updateConfig({ [setting]: value });
                        console.log(`[Better Tasker] Bestiary Automator ${setting} enabled (retry)`);
                        
                        setTimeout(() => {
                            if (window.bestiaryAutomator && window.bestiaryAutomator.config) {
                                console.log(`[Better Tasker] Verifying ${setting} setting (retry):`, window.bestiaryAutomator.config[setting]);
                            }
                        }, 1000);
                    } else {
                        console.log(`[Better Tasker] Bestiary Automator still not available - you may need to enable ${setting} manually`);
                    }
                }, 2000);
            }
            return false;
        }
    } catch (error) {
        console.error(`[Better Tasker] Error ${value ? 'enabling' : 'disabling'} Bestiary Automator ${setting}:`, error);
        return false;
    }
}

// Generic function to toggle Bestiary Automator settings
function toggleBestiaryAutomatorSetting(setting, value, enableRetry = false) {
    const isEnabling = value === true;
    const controlMethod = isEnabling ? 'requestControl' : 'hasControl';
    
    if (!window.BestiaryAutomatorSettingsManager[controlMethod]('Better Tasker')) {
        const action = isEnabling ? 'control' : 'disable';
        const reason = isEnabling ? 'controlled by another mod' : 'not controlled by Better Tasker';
        console.log(`[Better Tasker] Cannot ${action} Bestiary Automator settings - ${reason}`);
        return false;
    }
    
    const success = updateBestiaryAutomatorConfig(setting, value, enableRetry);
    if (!success && isEnabling) {
        window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
    } else if (!isEnabling) {
        window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
    }
    return success;
}

// Enable Bestiary Automator's autorefill stamina setting
function enableBestiaryAutomatorStaminaRefill() {
    return toggleBestiaryAutomatorSetting('autoRefillStamina', true, true);
}

// Disable Bestiary Automator's autorefill stamina setting
function disableBestiaryAutomatorStaminaRefill() {
    return toggleBestiaryAutomatorSetting('autoRefillStamina', false);
}

// Enable Bestiary Automator's faster autoplay setting
function enableBestiaryAutomatorFasterAutoplay() {
    return toggleBestiaryAutomatorSetting('fasterAutoplay', true, true);
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
        
        // Validate creature filtering settings
        if (settings.allowedCreatures && settings.allowedCreatures.length === 0) {
            validationIssues.push('No creatures allowed for tasking');
        }
        
        // Log validation results and attempt recovery
        if (validationIssues.length > 0) {
            console.warn('[Better Tasker] Settings validation issues:', validationIssues);
            
            // Attempt automatic recovery for Bestiary Automator issues
            if (validationIssues.some(issue => issue.includes('Bestiary Automator'))) {
                console.log('[Better Tasker] Attempting automatic recovery for Bestiary Automator...');
                const healthCheck = checkBestiaryAutomatorHealth();
                if (!healthCheck.healthy) {
                    console.warn('[Better Tasker] Bestiary Automator health check failed:', healthCheck.reason);
                } else {
                    console.log('[Better Tasker] Bestiary Automator health check passed, attempting to re-enable settings...');
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
            console.log('[Better Tasker] Settings validation passed');
        }
        
        return validationIssues.length === 0;
    } catch (error) {
        console.error('[Better Tasker] Error during settings validation:', error);
        return false;
    }
}

// Disable Bestiary Automator's faster autoplay setting
function disableBestiaryAutomatorFasterAutoplay() {
    return toggleBestiaryAutomatorSetting('fasterAutoplay', false);
}

// Enable Autoseller's Dragon Plant setting
function enableAutosellerDragonPlant() {
    try {
        // Try to find Autoseller's exported function
        let autoseller = null;
        
        // Method 1: Check window scope
        if (window.autoseller && window.autoseller.enableDragonPlant) {
            autoseller = window.autoseller;
        }
        // Method 2: Check context exports
        else if (typeof context !== 'undefined' && context.exports && context.exports.enableDragonPlant) {
            autoseller = context.exports;
            console.log('[Better Tasker] Found Autoseller via context exports');
        }
        // Method 3: Try mod loader
        else if (window.modLoader && window.modLoader.getModContext) {
            const autosellerContext = window.modLoader.getModContext('autoseller');
            if (autosellerContext && autosellerContext.exports && autosellerContext.exports.enableDragonPlant) {
                autoseller = autosellerContext.exports;
                console.log('[Better Tasker] Found Autoseller via mod loader');
            }
        }
        
        if (autoseller) {
            console.log('[Better Tasker] Enabling Dragon Plant via Autoseller...');
            autoseller.enableDragonPlant();
            console.log('[Better Tasker] Dragon Plant enabled');
            return true;
        } else {
            console.log('[Better Tasker] Autoseller not available - trying direct approach');
            // Fallback: try to access via global exports
            if (typeof exports !== 'undefined' && exports.enableDragonPlant) {
                exports.enableDragonPlant();
                console.log('[Better Tasker] Dragon Plant enabled via exports');
                return true;
            }
            return false;
        }
    } catch (error) {
        console.error('[Better Tasker] Error enabling Dragon Plant:', error);
        return false;
    }
}

// Helper to get both language versions of a translation key
function getBothLanguages(key) {
    const current = t(key);
    // Hardcode Portuguese translations for common buttons
    const ptMap = {
        'mods.betterTasker.autoSetup': 'Autoconfigurar',
        'mods.betterTasker.start': 'Iniciar',
        'controls.close': 'Fechar',
        'mods.betterTasker.newTask': 'Nova tarefa',
        'mods.betterTasker.remove': 'Remover',
        'mods.betterTasker.confirm': 'Confirmar',
        'mods.betterTasker.suggestedMap': 'Mapa sugerido:'
    };
    const pt = ptMap[key] || current;
    return current === pt ? [current] : [current, pt];
}

// Finds button by text content - supports both English and Portuguese
function findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll('button'));
    
    // Define text mappings for different languages using translation keys
    const textMappings = {
        'Auto-setup': getBothLanguages('mods.betterTasker.autoSetup'),
        'Start': getBothLanguages('mods.betterTasker.start'),
        'Close': getBothLanguages('controls.close'),
        'New task': getBothLanguages('mods.betterTasker.newTask'),
        'Remove': getBothLanguages('mods.betterTasker.remove'),
        'Remove current task': ['Remove current task', 'Remover tarefa atual'],
        'Remove task': ['Remove task', 'Remover tarefa'],
        'Confirm': getBothLanguages('mods.betterTasker.confirm')
    };
    
    // Get the list of possible texts for the given text key
    const possibleTexts = textMappings[text] || [text];
    
    return buttons.find(button => {
        const buttonText = button.textContent.trim();
        return possibleTexts.includes(buttonText) && isElementVisible(button);
    }) || null;
}

// Finds the autoplay Start button (green "Start" / "Iniciar", not lucide-play icon)
function findAutoplayStartButton() {
    // Autoplay control row: [Start] [Autoplay menu] — most specific match
    for (const flexContainer of document.querySelectorAll('div.flex')) {
        const buttons = flexContainer.querySelectorAll('button');
        if (buttons.length < 2) continue;
        const autoplayMenuBtn = buttons[1];
        if (!autoplayMenuBtn.querySelector('img[alt="Autoplay"], img[src*="autoplay.png"]')) continue;
        const startBtn = buttons[0];
        if (isElementVisible(startBtn)) {
            return startBtn;
        }
    }

    const byText = findButtonByText('Start');
    if (byText) {
        return byText;
    }

    const playSelectors = [
        'button:has(svg.lucide-play)',
        'button.frame-1-green[class*="play"]',
        'button.frame-1-green:has(svg.lucide-play)',
        'button[class*="surface-green"]:has(svg.lucide-play)'
    ];
    const bySelector = playSelectors.reduce((found, selector) =>
        found || document.querySelector(selector), null);
    if (bySelector && isElementVisible(bySelector)) {
        return bySelector;
    }

    return null;
}

// Finds confirmation button for task removal
function findConfirmationButton() {
    const buttons = Array.from(document.querySelectorAll('button'));
    
    // Define confirmation button text mappings using centralized constants
    const confirmationTexts = [
        'Remove current task', 'Remover tarefa atual',
        'Remove task', 'Remover tarefa',
        ...getBothLanguages('mods.betterTasker.confirm')
    ];
    
    return buttons.find(button => {
        if (!isElementVisible(button)) return false;
        const buttonText = button.textContent.trim();
        return confirmationTexts.includes(buttonText);
    }) || null;
}

// Checks element visibility
function isElementVisible(el) {
    if (!el || el.disabled) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

// Ensures autoplay mode is enabled with coordination
function ensureAutoplayMode() {
    // Check if another mod is controlling autoplay
    if (window.AutoplayManager.isControlledByOther('Better Tasker')) {
        console.log('[Better Tasker] Cannot switch to autoplay - controlled by another mod');
        return false;
    }
    
    // NEW: Only check for pending high-priority raids during init phase AND if raids exist
    const INIT_PHASE_DURATION = 20000; // 20 seconds after init
    const timeSinceInit = Date.now() - (window.betterTaskerInitTime || 0);
    
    // Only apply this check during init phase
    if (timeSinceInit < INIT_PHASE_DURATION) {
        const raidHunterEnabled = localStorage.getItem('raidHunterAutomationEnabled');
        
        // Only check if Raid_Hunter is enabled
        if (raidHunterEnabled === 'true') {
            // Check if raids actually exist before applying any delay
            const raidState = globalThis.state?.raids?.getSnapshot?.();
            const hasActiveRaids = raidState?.context?.list?.length > 0;
            
            if (hasActiveRaids) {
                const hasEnabledHighPriorityRaid = (window.raidHunterHasEnabledHighPriorityRaid && 
                                                    window.raidHunterHasEnabledHighPriorityRaid());
                
                // HIGH PRIORITY: High-priority raids take absolute precedence during init phase
                // Even if Better Tasker has an active task, high-priority raids must be allowed to start first
                // Only block if:
                // 1. High-priority raids are available AND actually exist
                // 2. Raid_Hunter hasn't started raiding yet
                if (hasEnabledHighPriorityRaid && 
                    !window.raidHunterIsCurrentlyRaiding?.()) {
                    
                    console.log('[Better Tasker] High-priority raids pending during init - deferring autoplay control (high-priority raids take precedence)');
                    return false; // Don't take control yet - high-priority raids have absolute priority
                }
            }
            // If no raids exist, proceed normally (no delay)
        }
    }
    // After init phase (20s), or if no raids, proceed normally
    
    
    return withControl(window.AutoplayManager, 'Better Tasker', () => {
        const boardContext = globalThis.state.board.getSnapshot().context;
        const currentMode = boardContext.mode;
        
        if (currentMode !== 'autoplay') {
            globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
            console.log('[Better Tasker] Switched to autoplay mode');
            return true;
        }
        return false;
    }, 'switch to autoplay');
}


// Consolidated failsafe function - replaces all duplicated failsafe logic
async function triggerFailsafe(reason) {
    const now = Date.now();
    if (now - lastFailsafeTriggerAt < FAILSAFE_DEBOUNCE_MS) {
        console.log(`[Better Tasker] Failsafe debounced (${reason})`);
        return;
    }
    if (taskCompletionInProgress) {
        console.log(`[Better Tasker] Failsafe skipped - task completion already in progress (${reason})`);
        return;
    }

    lastFailsafeTriggerAt = now;
    taskCompletionInProgress = true;
    pendingTaskCompletion = true;
    updateExposedState();

    console.log(`[Better Tasker] FAILSAFE TRIGGERED: ${reason} - stopping autoplay immediately!`);
    
    // Stop all automations immediately (includes autoplay, Bestiary Automator, Raid Hunter coordination)
    const automationsStopped = await stopAllAutomationsForTaskCompletion();
    if (!automationsStopped) {
        console.warn('[Better Tasker] Failed to stop automations, continuing with task completion anyway');
    }
    
    // Wait for game to end if running, then complete task
    await waitForGameEndAndCompleteTask();
}


// Wait for game to end and complete task
async function waitForGameEndAndCompleteTask() {
    try {
        // Check if a game is currently running
        const boardContext = globalThis.state.board.getSnapshot().context;
        const isGameRunning = boardContext.gameStarted;
        console.log('[Better Tasker] Game running check after failsafe:', isGameRunning);
        
        if (isGameRunning) {
            console.log('[Better Tasker] Game is running, waiting for game to finish before claiming task...');
            pendingTaskCompletion = true;
            updateExposedState(); // Update exposed state for other mods
            console.log('[Better Tasker] Pending task completion flag set - waiting for game to end');
            
            // Start continuous checking for game end
            await waitForGameToEnd();
            
            // Game has ended, proceed with task completion
            console.log('[Better Tasker] Game ended, proceeding with task completion...');
        } else {
            console.log('[Better Tasker] No game running, proceeding with task completion immediately...');
        }
        
        // Complete task regardless of game state
        resetState('taskComplete');
        await handleTaskReadyCompletion();
        
    } catch (error) {
        console.error('[Better Tasker] Error in waitForGameEndAndCompleteTask:', error);
        // Still try to complete the task even if there was an error
        try {
            resetState('taskComplete');
            await handleTaskReadyCompletion();
        } catch (completionError) {
            console.error('[Better Tasker] Error in task completion after error:', completionError);
            cleanupTaskCompletionFailure('error in waitForGameEndAndCompleteTask');
        }
    }
}

// Stop all automations when task is ready to be claimed
async function stopAllAutomationsForTaskCompletion() {
    try {
        console.log('[Better Tasker] Stopping all automations for task completion...');
        
        // 1. Stop autoplay
        const autoplayStopped = await pauseAutoplay();
        
        // 2. Stop Bestiary Automator settings if we have control
        let bestiaryAutomatorStopped = false;
        if (window.BestiaryAutomatorSettingsManager.hasControl('Better Tasker')) {
            console.log('[Better Tasker] Stopping Bestiary Automator settings for task completion...');
            bestiaryAutomatorStopped = disableBestiaryAutomatorStaminaRefill();
            if (bestiaryAutomatorStopped) {
                bestiaryAutomatorStopped = disableBestiaryAutomatorFasterAutoplay();
            }
        }
        
        // 3. Coordinate with Raid Hunter to pause its automation
        let raidHunterPaused = false;
        if (isRaidHunterActive) {
            console.log('[Better Tasker] Coordinating with Raid Hunter to pause automation for task completion...');
            // Update exposed state to signal task completion is in progress
            updateExposedState();
            raidHunterPaused = true;
        }
        
        console.log('[Better Tasker] Automation stopping results:', {
            autoplayStopped,
            bestiaryAutomatorStopped,
            raidHunterPaused
        });
        
        return autoplayStopped;
    } catch (error) {
        console.error('[Better Tasker] Error stopping automations for task completion:', error);
        return false;
    }
}

// Pause autoplay using game state API with coordination
async function pauseAutoplayForUserStop() {
    try {
        if (!globalThis.state?.board) {
            return false;
        }
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (!taskHuntingOngoing && !isAutoplaySessionActive(boardContext)) {
            return true;
        }
        const paused = await pauseAutoplay({ closeQuestLog: false, verifyPause: false });
        if (paused) {
            console.log('[Better Tasker] Autoplay paused after user stopped tasker');
        } else {
            console.log('[Better Tasker] Could not pause autoplay after user stopped tasker');
        }
        return paused;
    } catch (error) {
        console.error('[Better Tasker] Error pausing autoplay on user stop:', error);
        return false;
    }
}

function disableBetterTaskerAutomatorSettings() {
    if (isRaidHunterRaiding()) {
        console.log('[Better Tasker] Raid Hunter is actively raiding - preserving Bestiary Automator settings');
        return;
    }
    const settings = loadSettings();
    if (settings.autoRefillStamina) {
        console.log('[Better Tasker] Automation stopped - disabling Bestiary Automator autorefill stamina...');
        disableBestiaryAutomatorStaminaRefill();
    }
    if (settings.fasterAutoplay) {
        console.log('[Better Tasker] Automation stopped - disabling Bestiary Automator faster autoplay...');
        disableBestiaryAutomatorFasterAutoplay();
    }
}

async function pauseAutoplay({ closeQuestLog = true, verifyPause = true } = {}) {
    console.log('[Better Tasker] Pausing autoplay using state API...');
    
    // Check if another mod is controlling autoplay
    if (window.AutoplayManager.isControlledByOther('Better Tasker')) {
        console.log('[Better Tasker] Cannot pause autoplay - controlled by another mod');
        return false;
    }
    
    // Request control of autoplay
    if (!window.AutoplayManager.requestControl('Better Tasker')) {
        console.log('[Better Tasker] Cannot pause autoplay - control denied');
        return false;
    }
    
    try {
        const boardContext = globalThis.state.board.getSnapshot().context;
        const pauseButtonVisible = isAutoplayPauseButtonVisible();
        const sessionActive = isAutoplaySessionActive(boardContext);

        console.log(
            '[Better Tasker] Current state - gameStarted: ' +
                boardContext.gameStarted +
                ', isRunning: ' +
                boardContext.isRunning +
                ', autoplayRunning: ' +
                boardContext.autoplayRunning +
                ', mode: ' +
                boardContext.mode +
                ', pauseButtonVisible: ' +
                pauseButtonVisible +
                ', sessionActive: ' +
                sessionActive
        );

        if (!sessionActive) {
            console.log('[Better Tasker] Autoplay session not active - no need to pause');
            return true;
        }

        console.log('[Better Tasker] Attempting to pause autoplay...');

        const paused = await pauseAutoplayWithButton(
            PAUSE_BUTTON_MAX_RETRIES,
            PAUSE_BUTTON_RETRY_DELAY_MS,
            { closeQuestLog }
        );
        if (paused) {
            if (!verifyPause) {
                autoplayPausedByTasker = true;
                console.log('[Better Tasker] Autoplay pause requested (user stop, skipping verification)');
                return true;
            }

            await sleep(PAUSE_BUTTON_UPDATE_DELAY_MS);

            let verified = false;
            for (let checkAttempt = 0; checkAttempt < PAUSE_VERIFY_ATTEMPTS; checkAttempt++) {
                const newBoardContext = globalThis.state.board.getSnapshot().context;
                if (isAutoplaySessionStopped(newBoardContext)) {
                    verified = true;
                    autoplayPausedByTasker = true;
                    console.log(
                        `[Better Tasker] Autoplay paused and verified (dom+api, took ${(checkAttempt + 1) * 500}ms)`
                    );
                    return true;
                }

                if (checkAttempt < PAUSE_VERIFY_ATTEMPTS - 1) {
                    await sleep(500);
                }
            }

            console.warn(
                `[Better Tasker] Pause button clicked but autoplay session still active after ${PAUSE_VERIFY_ATTEMPTS * 500}ms`
            );
            autoplayPausedByTasker = false;
            return false;
        }

        console.warn('[Better Tasker] Pause button not found - autoplay session may still be running');
        return false;
    } finally {
        // Release control after operation
        window.AutoplayManager.releaseControl('Better Tasker');
    }
}

async function handleFinalRunPauseWithRetry(retryDepth = 0) {
    try {
        const paused = await pauseAutoplay();
        if (!taskHuntingOngoing) {
            return;
        }

        // Important: wait for the current game to fully end before checking task progress.
        // The final kill is often applied after pause is requested, so checking too early can
        // incorrectly resume autoplay and skip task completion flow.
        const gameEndedAfterPause = await waitForGameToEnd();
        if (!gameEndedAfterPause) {
            console.log('[Better Tasker] [runs-budget] final run wait timed out — continuing with best-effort task check');
        }

        await sleep(300);

        const prog = getTaskKillProgress();
        const playerContext = globalThis.state?.player?.getSnapshot?.()?.context;
        const task = playerContext?.questLog?.task;
        const quotaReached = !!(prog && prog.current >= prog.target);
        const taskReady = !!(task && task.ready);

        if (quotaReached || taskReady) {
            console.log(
                '[Better Tasker] [runs-budget] final run complete (' +
                    (prog ? prog.current + '/' + prog.target : 'no API progress') +
                    ') — opening quest log to finish or verify task state'
            );
            if (taskCompletionInProgress) {
                console.log('[Better Tasker] [runs-budget] task completion already in progress - skipping duplicate final-run handler');
                return;
            }
            await handlePostGameTaskCompletion(false);
            return;
        }

        if (prog && prog.current < prog.target) {
            console.log(
                '[Better Tasker] [runs-budget] final run pause left task incomplete (' +
                    prog.current +
                    '/' +
                    prog.target +
                    ') — resuming autoplay to retry last kill'
            );
            // Re-arm final-run guard so we can pause again once the retry game ends.
            finalRunPauseIssued = false;
            await resumeAutoplay({ force: true, reason: 'final-run-incomplete' });
            return;
        }

        if (!paused) {
            if (retryDepth < 1) {
                console.log('[Better Tasker] [runs-budget] final run pause not verified — retrying pause (no fail-open resume)');
                finalRunPauseIssued = false;
                await sleep(500);
                return handleFinalRunPauseWithRetry(retryDepth + 1);
            }

            console.warn('[Better Tasker] [runs-budget] final run pause failed after retry — not resuming past quota');
            finalRunPauseIssued = false;
            if (isSafeToReload()) {
                location.reload();
            } else {
                cleanupTaskCompletionFailure('final run pause not verified');
            }
            return;
        }

        // Last-resort fallback: paused, but no reliable progress/ready state could be read.
        // Refresh to recover from stale/partial state and avoid getting stuck.
        console.warn('[Better Tasker] [runs-budget] final run state unresolved after pause — refreshing browser fallback');
        if (isSafeToReload()) {
            location.reload();
        } else {
            cleanupTaskCompletionFailure('final run unresolved state after pause');
        }
    } catch (error) {
        console.error('[Better Tasker] [runs-budget] final run handler failed - refreshing fallback', error);
        if (isSafeToReload()) {
            location.reload();
        } else {
            cleanupTaskCompletionFailure('final run handler error');
        }
    }
}

// Verify that task completion was successful before resuming automations
async function verifyTaskCompletion() {
    try {
        console.log('[Better Tasker] Verifying task completion...');
        
        // Wait a moment for the game state to update after task completion
        await sleep(1000);
        
        // Check if Game State API is available
        if (!globalThis.state || !globalThis.state.player) {
            console.log('[Better Tasker] Game State API not available for verification');
            return false;
        }
        
        const playerContext = globalThis.state.player.getSnapshot().context;
        
        // Check if there's still an active task
        if (playerContext.questLog && playerContext.questLog.task) {
            const task = playerContext.questLog.task;
            
            // If task still has gameId and is still ready, it wasn't completed properly
            if (task.gameId && task.ready) {
                console.log('[Better Tasker] Task verification failed - task still active and ready:', {
                    gameId: task.gameId,
                    ready: task.ready,
                    killCount: task.killCount
                });
                return false;
            }
            
            // If task has no gameId, it means it was completed successfully
            if (!task.gameId) {
                console.log('[Better Tasker] Task verification successful - no active task found');
                // Reset task navigation flag to allow future task completions
                taskNavigationCompleted = false;
                console.log('[Better Tasker] Task navigation flag reset - ready for next task');
                return true;
            }
            
            // If task exists but is not ready, it was completed
            if (!task.ready) {
                console.log('[Better Tasker] Task verification successful - task no longer ready');
                // Reset task navigation flag to allow future task completions
                taskNavigationCompleted = false;
                console.log('[Better Tasker] Task navigation flag reset - ready for next task');
                return true;
            }
        } else {
            // No task in quest log means it was completed successfully
            console.log('[Better Tasker] Task verification successful - no task in quest log');
            // Reset task navigation flag to allow future task completions
            taskNavigationCompleted = false;
            console.log('[Better Tasker] Task navigation flag reset - ready for next task');
            return true;
        }
        
        console.log('[Better Tasker] Task verification inconclusive - defaulting to successful');
        // Reset task navigation flag to allow future task completions
        taskNavigationCompleted = false;
        console.log('[Better Tasker] Task navigation flag reset - ready for next task');
        return true;
    } catch (error) {
        console.error('[Better Tasker] Error verifying task completion:', error);
        // Default to successful on error to avoid getting stuck
        return true;
    }
}

// Resume autoplay using game state API with coordination
async function resumeAutoplay(options = {}) {
    try {
        console.log('[Better Tasker] Resuming autoplay using state API...');
        const forceResume = !!options.force;
        const forceReason = options.reason || 'unspecified';
        if (forceResume) {
            const now = Date.now();
            const elapsed = now - lastForcedResumeAt;
            if (elapsed < FORCED_RESUME_COOLDOWN_MS) {
                console.log(
                    `[Better Tasker] Forced resume cooldown active (${FORCED_RESUME_COOLDOWN_MS - elapsed}ms left) - skipping retry (${forceReason})`
                );
                return false;
            }
            lastForcedResumeAt = now;
        }
        
        // Only resume if we previously paused it, unless forced by a guarded recovery path.
        if (autoplayPausedByTasker || forceResume) {
            if (forceResume && !autoplayPausedByTasker) {
                console.log(`[Better Tasker] Forcing autoplay resume despite unverified pause (${forceReason})`);
            }
            // Re-acquire control if needed (pause releases control in finally).
            if (!window.AutoplayManager.hasControl('Better Tasker')) {
                if (!window.AutoplayManager.requestControl('Better Tasker')) {
                    console.log('[Better Tasker] Cannot resume autoplay - control denied');
                    autoplayPausedByTasker = false;
                    return false;
                }
            }
            
            // Use Start button instead of switching to autoplay mode
            const resumed = await resumeAutoplayWithButton();
            autoplayPausedByTasker = false;
            if (resumed) {
                console.log('[Better Tasker] Autoplay resumed successfully using Start button');
            } else {
                // Fallback: ensure autoplay mode, then try Start again (session may stop while mode stays autoplay)
                const wasChanged = ensureAutoplayMode();
                if (wasChanged) {
                    console.log('[Better Tasker] Switched to autoplay mode - clicking Start button...');
                }
                const startRetried = await resumeAutoplayWithButton();
                if (startRetried) {
                    console.log('[Better Tasker] Autoplay resumed successfully using Start button (after mode fallback)');
                } else if (wasChanged) {
                    console.log('[Better Tasker] Switched to autoplay mode but Start button not found');
                } else {
                    console.log('[Better Tasker] Start button not found - could not resume autoplay session');
                }
            }
            window.AutoplayManager.releaseControl('Better Tasker');
            return true;
        } else {
            console.log('[Better Tasker] Autoplay was not paused by tasker - no need to resume');
            return true;
        }
    } catch (error) {
        console.error('[Better Tasker] Error resuming autoplay:', error);
        return false;
    }
}

// Open quest log directly without relying on quest blip
async function openQuestLogDirectly() {
    try {
        if (isRaidHunterRaiding()) {
            console.log('[Better Tasker] Raid Hunter is actively raiding HIGH priority raid - aborting quest log opening');
            return false;
        }

        // Quest blip toggles the log — if it is already open, do not click the blip again
        const alreadyOpenQuestLog = findQuestLogContainer();
        if (alreadyOpenQuestLog) {
            console.log('[Better Tasker] Quest log already open - skipping blip toggle');

            const backButton = Array.from(document.querySelectorAll('button')).find(btn =>
                btn.querySelector('svg.lucide-arrow-left')
            );

            if (backButton && isElementVisible(backButton)) {
                backButton.click();
                await sleep(500);
            }

            return true;
        }
        
        // FIRST: Try to find and click quest blip (most reliable for task completion)
        const questBlipSelectors = [
            '#header-slot img[src*="quest-blip.png"]',
            '#header-slot img[src*="/assets/icons/quest-blip.png"]',
            '#header-slot img[alt="Quests"][src*="quest-blip"]',
            '#header-slot img[alt="Tasking"][src*="quest-blip"]',
            'img[src*="quest-blip.png"]',
            'img[src*="/assets/icons/quest-blip.png"]'
        ];
        
        let questBlip = null;
        for (const selector of questBlipSelectors) {
            questBlip = document.querySelector(selector);
            if (questBlip && questBlip.offsetParent !== null) {
                console.log(`[Better Tasker] Found quest blip with selector: ${selector}`);
                questBlip.click();
                await sleep(300);
                
                // Validate that quest log actually opened
                const questLogContainer = findQuestLogContainer();
                if (questLogContainer) {
                    console.log('[Better Tasker] Quest log opened via quest blip and validated');
                    
                    // Check if we're in a sub-view (like Halloween Quests) and need to go back
                    const backButton = Array.from(document.querySelectorAll('button')).find(btn => 
                        btn.querySelector('svg.lucide-arrow-left')
                    );
                    
                    if (backButton && isElementVisible(backButton)) {
                        backButton.click();
                        await sleep(500); // Wait for transition back to main quest log
                    }
                    
                    return true;
                } else {
                    console.log('[Better Tasker] Quest blip clicked but quest log did not appear');
                }
                break;
            }
        }
        
        // SECOND: Try to find quest log button or icon (fallback)
        const questSelectors = [
            'button[aria-label*="quest"]',
            'button[title*="quest"]',
            '.quest-icon',
            'img[src*="quest.png"]',
            'button:has(svg[data-lucide="book"])',
            'button:has(svg[data-lucide="scroll"])'
        ];
        
        let questButton = null;
        for (const selector of questSelectors) {
            questButton = document.querySelector(selector);
            if (questButton) {
                break;
            }
        }
        
        if (questButton) {
            questButton.click();
            await sleep(300);
            
            // Validate that quest log actually opened
            const questLogContainer = document.querySelector('[class*="quest"], [class*="modal"], [class*="dialog"]');
            if (questLogContainer) {
                
                // Check if we're in a sub-view (like Halloween Quests) and need to go back
                const backButton = Array.from(document.querySelectorAll('button')).find(btn => 
                    btn.querySelector('svg.lucide-arrow-left')
                );
                
                if (backButton && isElementVisible(backButton)) {
                    backButton.click();
                    await sleep(500); // Wait for transition back to main quest log
                }
                
                return true;
            } else {
                console.log('[Better Tasker] Quest log button clicked but UI did not appear');
                return false;
            }
        } else {
            console.log('[Better Tasker] Could not find quest log button, trying fallback...');
            
            // Fallback: try to find any button that might open quest log
            const allButtons = document.querySelectorAll('button');
            const questButtonFallback = Array.from(allButtons).find(btn => 
                btn.textContent.toLowerCase().includes('quest') ||
                btn.getAttribute('aria-label')?.toLowerCase().includes('quest') ||
                btn.getAttribute('title')?.toLowerCase().includes('quest')
            );
            
            if (questButtonFallback) {
                questButtonFallback.click();
                await sleep(300);
                
                // Validate that quest log actually opened
                const questLogContainer = document.querySelector('[class*="quest"], [class*="modal"], [class*="dialog"]');
                if (questLogContainer) {
                    console.log('[Better Tasker] Quest log opened via fallback and validated');
                    
                    // Check if we're in a sub-view (like Halloween Quests) and need to go back
                    const backButton = Array.from(document.querySelectorAll('button')).find(btn => 
                        btn.querySelector('svg.lucide-arrow-left')
                    );
                    
                    if (backButton && isElementVisible(backButton)) {
                        backButton.click();
                        await sleep(500); // Wait for transition back to main quest log
                    }
                    
                    return true;
                } else {
                    console.log('[Better Tasker] Quest log fallback clicked but UI did not appear');
                    return false;
                }
            }
            
            console.log('[Better Tasker] Could not find quest log button with any method');
            return false;
        }
    } catch (error) {
        console.error('[Better Tasker] Error opening quest log directly:', error);
        return false;
    }
}

// Helper: Find Finish button using mutation observer and polling
async function findFinishButton(pollInterval = 1000, maxAttempts = 3, useFallbackSelectors = false) {
    const finishSelectors = [
        'button:has(svg.lucide-check)',
        'button:has(svg.lucide-check-circle)'
    ];
    
    let finishButton = null;
    let attempts = 0;
    
    // Use mutation observer to watch for Finish button changes
    const finishButtonObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') {
                const target = mutation.target;
                if (target.querySelector('svg.lucide-check')) {
                    // Check if button is now enabled
                    if (!target.hasAttribute('disabled') && !target.disabled) {
                        finishButton = target;
                        console.log('[Better Tasker] Finish button enabled via mutation observer');
                    }
                }
            }
        }
    });
    
    // Start observing the document body for button changes
    finishButtonObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled']
    });
    
    // Poll for Finish button
    while (!finishButton && attempts < maxAttempts) {
        await sleep(pollInterval);
        attempts++;
        
        // Search for buttons with SVG check icon (language-independent)
        // Exclude checkboxes and other non-Finish buttons by checking button context
        const allButtons = document.querySelectorAll('button');
        finishButton = Array.from(allButtons).find(btn => {
            // Must have check icon
            if (!btn.querySelector('svg.lucide-check') || btn.hasAttribute('disabled') || btn.disabled) {
                return false;
            }
            
            // Exclude checkboxes and input elements
            if (btn.type === 'checkbox' || btn.tagName === 'INPUT') {
                return false;
            }
            
            // Exclude buttons that are clearly not Finish buttons (like settings checkboxes)
            const buttonText = btn.textContent.trim().toLowerCase();
            if (buttonText.includes('enable') || buttonText.includes('disable') || 
                buttonText.includes('dragon') || buttonText.includes('plant') ||
                buttonText.includes('autoplay') || buttonText.includes('stamina')) {
                return false;
            }
            
            // Prefer buttons that are in quest log context
            const questLogContainer = findQuestLogContainer();
            if (questLogContainer && questLogContainer.contains(btn)) {
                return true;
            }
            
            // If not in quest log, check if it's a proper Finish button by looking for task-related context
            const parentSection = btn.closest('.frame-1.surface-regular');
            if (parentSection) {
                const sectionTitle = parentSection.querySelector('p.text-whiteHighlight');
                if (sectionTitle && sectionTitle.textContent?.includes('Paw and Fur Society')) {
                    return true;
                }
            }
            
            return false;
        });
        
        // If not found and fallback selectors enabled, try CSS selectors
        if (!finishButton && useFallbackSelectors) {
            for (const selector of finishSelectors) {
                try {
                    const buttons = document.querySelectorAll(selector);
                    finishButton = Array.from(buttons).find(btn => {
                        // Must have check icon
                        if (!btn.querySelector('svg.lucide-check') || btn.hasAttribute('disabled') || btn.disabled) {
                            return false;
                        }
                        
                        // Exclude checkboxes and input elements
                        if (btn.type === 'checkbox' || btn.tagName === 'INPUT') {
                            return false;
                        }
                        
                        // Exclude buttons that are clearly not Finish buttons (like settings checkboxes)
                        const buttonText = btn.textContent.trim().toLowerCase();
                        if (buttonText.includes('enable') || buttonText.includes('disable') || 
                            buttonText.includes('dragon') || buttonText.includes('plant') ||
                            buttonText.includes('autoplay') || buttonText.includes('stamina')) {
                            return false;
                        }
                        
                        return true;
                    });
                    
                    if (finishButton) break;
                } catch (error) {
                    // Skip invalid selectors
                    console.log(`[Better Tasker] Skipping invalid selector: ${selector}`);
                }
            }
        }
        
        if (finishButton) {
            console.log('[Better Tasker] Finish button found and ready, attempts:', attempts);
            break;
        }
        
        if (attempts % 2 === 0 && pollInterval >= 1000) { // Log every 2 seconds for slow polling
            console.log(`[Better Tasker] Still looking for Finish button... (${attempts}s)`);
        }
    }
    
    // Stop observing
    finishButtonObserver.disconnect();
    
    return finishButton;
}

// Helper: Click Finish button and verify task completion
async function clickFinishAndVerify(finishButton) {
    console.log('[Better Tasker] Clicking Finish button...');
    finishButton.click();
    await sleep(200);
    console.log('[Better Tasker] Finish button clicked');
    
    // Verify task completion
    await sleep(1000);
    const taskCompleted = await verifyTaskCompletion();
    if (taskCompleted) {
        console.log('[Better Tasker] Task completion verified successfully');
        resetFailureCounter(); // Success - reset failure counter
        
        if (!isSafeToReload()) return false;
        
        // Check if Mod Settings has disabled auto-reload
        if (window.betterUIConfig?.disableAutoReload) {
            console.log('[Better Tasker] Auto-reload disabled by Mod Settings - skipping page refresh');
            // Clear flags manually since we're not reloading
            taskNavigationCompleted = false;
            return true;
        }
        
        // Reload page to refresh DOM and cache (no need to clear flags - reload handles it)
        console.log('[Better Tasker] Reloading page for fresh state...');
        location.reload();
        return true;
    } else {
        console.log('[Better Tasker] Task completion verification failed');
        // Clear flags before cleanup on failure
        taskOperationInProgress = false;
        updateExposedState();
        cleanupTaskCompletionFailure('task completion verification failed');
        return false;
    }
}

// Find and click Finish button with improved detection
async function findAndClickFinishButton() {
    try {
        console.log('[Better Tasker] Looking for Finish button...');
        
        await sleep(FINISH_BUTTON_INITIAL_WAIT_MS);
        
        const finishButton = await findFinishButton(
            FINISH_BUTTON_POLL_INTERVAL_MS,
            FINISH_BUTTON_MAX_ATTEMPTS,
            false
        );
        
        if (finishButton) {
            return await clickFinishAndVerify(finishButton);
        }

        console.log('[Better Tasker] Finish button never became ready');
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error finding and clicking Finish button:', error);
        return false;
    }
}

// Handle task completion when task.ready = true (API state)
async function handleTaskReadyCompletion() {
    try {
        // Check if autocomplete is enabled before claiming rewards
        const settings = loadSettings();
        if (!settings.autoCompleteTasks) {
            console.log('[Better Tasker] Autocomplete tasks disabled, skipping reward claim');
            // Clear flags since we're not completing the task
            taskOperationInProgress = false;
            updateExposedState();
            return;
        }
        
        console.log('[Better Tasker] Handling task ready completion via API state...');
        
        // Set task operation in progress flag to prevent duplicate operations
        taskOperationInProgress = true;
        updateExposedState(); // Update exposed state for other mods
        console.log('[Better Tasker] Task operation in progress flag set - preventing duplicate operations');
        
        // Safety timeout to reset the flag if operation gets stuck (30 seconds)
        const safetyTimeout = setTimeout(() => {
            if (taskOperationInProgress) {
                console.log('[Better Tasker] Safety timeout: Resetting taskOperationInProgress flag after 30 seconds');
                taskOperationInProgress = false;
                updateExposedState();
            }
        }, 30000);
        safetyTimeouts.push(safetyTimeout);
        
        // Start quest button validation monitoring
        startQuestButtonValidation();
        
        await closeQuestLogIfOpen();
        
        // Check if a game is actually running before waiting for it to finish
        const boardContext = globalThis.state.board.getSnapshot().context;
        const gameTimerContext = globalThis.state.gameTimer.getSnapshot().context;
        const isGameStarted = boardContext.gameStarted;
        const gameState = gameTimerContext.state; // 'initial', 'victory', 'defeat'
        const isGameRunning = isGameStarted && gameState === 'initial';
        console.log('[Better Tasker] Game running check:', isGameRunning, '(gameStarted:', isGameStarted, ', gameState:', gameState, ')');
        
        if (isGameRunning) {
            console.log('[Better Tasker] Game is running, waiting for game to finish before completing task...');
        } else {
            console.log('[Better Tasker] No game running, proceeding with task completion...');
            await handlePostGameTaskCompletion(true);
        }
        
    } catch (error) {
        console.error('[Better Tasker] Error in handleTaskReadyCompletion:', error);
        releaseTaskCompletionFlow();
        cleanupTaskCompletionFailure('error in handleTaskReadyCompletion');
    }
}

// Open quest log with retry mechanism - tries 3 times with ESC fallback
async function openQuestLogWithRetry() {
    for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`[Better Tasker] Quest log opening attempt ${attempt}/3...`);
        
        // Try to open quest log directly
        const questLogOpened = await openQuestLogDirectly();
        
        if (questLogOpened) {
            console.log(`[Better Tasker] Quest log opened successfully on attempt ${attempt}`);
            resetFailureCounter(); // Success - reset failure counter
            return true;
        }
        
        // If not the last attempt, try ESC key and retry
        if (attempt < 3) {
            console.log(`[Better Tasker] Quest log opening failed, closing quest log and retrying...`);
            await closeQuestLogIfOpen();
            await sleep(200);
        }
    }
    
    console.log('[Better Tasker] All quest log opening attempts failed');
    
    // Track this failure - will trigger refresh after 3 consecutive failures
    const refreshScheduled = trackFailureAndCheckRefresh('quest_log_opening_failed');
    if (refreshScheduled) {
        console.warn('[Better Tasker] Page refresh scheduled due to repeated quest log opening failures');
    }
    
    return false;
}

// Handle quest log opening and button clicking AFTER game finishes
async function handlePostGameTaskCompletion(fromFailsafeChain = false) {
    try {
        if (!fromFailsafeChain) {
            if (taskCompletionInProgress) {
                console.log('[Better Tasker] Task completion already in progress - skipping duplicate post-game handler');
                return;
            }
            taskCompletionInProgress = true;
            pendingTaskCompletion = true;
            updateExposedState();
        }

        console.log('[Better Tasker] Handling post-game task completion...');
        
        console.log('[Better Tasker] Waiting for game to finish...');
        await sleep(1000);
        
        const playerContext = globalThis.state.player.getSnapshot().context;
        const task = playerContext?.questLog?.task;
        
        if (task && task.ready) {
            const settings = loadSettings();
            if (!settings.autoCompleteTasks) {
                console.log('[Better Tasker] Autocomplete tasks disabled, skipping reward claim');
                releaseTaskCompletionFlow();
                return;
            }
            
            console.log('[Better Tasker] Task is ready, opening quest log for Finish button...');
            
            const questLogOpened = await openQuestLogWithRetry();
            
            if (questLogOpened) {
                const finishSuccess = await findAndClickFinishButton();
                if (!finishSuccess && globalThis.state?.player?.getSnapshot?.()?.context?.questLog?.task?.ready) {
                    scheduleTaskCompletionRetry('finish button not ready');
                    return;
                }
            } else {
                console.log('[Better Tasker] Failed to open quest log after 3 attempts');
                scheduleTaskCompletionRetry('quest log open failed');
                return;
            }
        } else {
            console.log('[Better Tasker] No ready task, checking if new task is available...');
            
            if (isQuestBlipAvailable()) {
                console.log('[Better Tasker] New task available - opening quest log to accept task');
                releaseTaskCompletionFlow(false);
                await openQuestLogAndAcceptTask();
            } else {
                console.log('[Better Tasker] No new task available yet (cooldown active)');
                releaseTaskCompletionFlow();
                cleanupTaskCompletionFailure('no new task available');
            }
            return;
        }
        
        releaseTaskCompletionFlow();
        console.log('[Better Tasker] Task operation completed successfully');
        
    } catch (error) {
        console.error('[Better Tasker] Error in handlePostGameTaskCompletion:', error);
        releaseTaskCompletionFlow();
        cleanupTaskCompletionFailure('error in handlePostGameTaskCompletion');
    }
}

// Handle task finishing - main function for completing tasks
async function handleTaskFinishing() {
    if (taskerState !== TASKER_STATES.ENABLED) {
        console.log('[Better Tasker] Tasker not in enabled state, skipping task completion');
        return;
    }

    if (isManualPlayPaused()) {
        return;
    }
    
    // EARLY CHECK: If no active task and cooldown is active, let scheduler handle it
    try {
        const playerContext = globalThis.state?.player?.getSnapshot?.()?.context;
        const task = playerContext?.questLog?.task;
        
        // If no active task (no gameId) and cooldown is active, skip expensive checks
        if (task && !task.gameId && task.resetAt && task.resetAt > Date.now()) {
            // Cooldown is active, scheduler will handle waking up
            return;
        }
    } catch (error) {
        // If check fails, continue with normal flow
    }
    
    // Don't run task finishing if a task operation is already in progress
    if (taskOperationInProgress) {
        console.log('[Better Tasker] Task operation already in progress, skipping quest log check');
        return;
    }
    
    // Don't run task finishing if pending task completion is already set
    if (pendingTaskCompletion) {
        console.log('[Better Tasker] Pending task completion already set, skipping quest log check');
        return;
    }
    
    // Creature filtering runs before task-hunting/navigation early exits
    const taskRemoved = await removeCurrentTaskIfNotAllowed();
    if (taskRemoved) {
        console.log('[Better Tasker] Task removed due to creature filtering, ending task finishing');
        resetState('taskComplete');
        await pauseAutoplay();
        scheduleTaskCheck();
        return;
    }
    
    // Check if new task is available (based on resetAt timestamp)
    const isQuestBlipReady = isQuestBlipAvailable();
    
    // If task hunting is ongoing, check if task is ready to complete
    if (taskHuntingOngoing) {
        // Check if we have an active task that's ready
        const playerContext = globalThis.state.player.getSnapshot().context;
        const task = playerContext?.questLog?.task;
        
        if (task && task.gameId && task.ready) {
            console.log('[Better Tasker] Task hunting complete - task is ready, proceeding with completion');
            // Don't return - proceed with task completion
        } else {
            console.log('[Better Tasker] Task hunting ongoing, task not ready yet - skipping task completion');
            return;
        }
    }
    
    // Check if task navigation has already been completed for this session
    if (taskNavigationCompleted) {
        console.log('[Better Tasker] Task navigation already completed, skipping quest log check');
        return;
    }
    
    // Load settings (autocomplete check moved to reward claiming functions only)
    const settings = loadSettings();
    
    try {
        // Check if Game State API is available
        if (!globalThis.state || !globalThis.state.player) {
            console.log('[Better Tasker] Game State API not available');
            return;
        }
        
        const playerContext = globalThis.state.player.getSnapshot().context;
        
        // Check if there's a hunting task that's ready
        if (playerContext.questLog && playerContext.questLog.task) {
            const task = playerContext.questLog.task;
            
            // Check if there's an active task by checking for gameId
            if (!task.gameId) {
                console.log('[Better Tasker] No active task (no gameId), checking if new task is available...');
                
                if (isQuestBlipReady) {
                    console.log('[Better Tasker] New task available - opening quest log to start task...');
                    // Continue with quest log opening logic below
                } else {
                    console.log('[Better Tasker] No new task available yet (cooldown active) - letting scheduler handle it');
                    return;
                }
            } else {
                // If we have an active task (gameId exists), we should proceed to check quest log
                // The task might need to be activated even if killCount is 0
                
                // Apply task start delay if configured (only for active tasks)
                const taskStartDelay = settings.taskStartDelay || DEFAULT_TASK_START_DELAY;
                
                if (taskStartDelay > 0) {
                    // Wait for the specified delay before proceeding
                    await new Promise(resolve => setTimeout(resolve, taskStartDelay * 1000));
                    
                    // Check if Board Analyzer started during delay
                    if (isBoardAnalyzerActive()) {
                        console.log('[Better Tasker] Board Analyzer started during task start delay - aborting task operation');
                        return;
                    }
                    
                    // Check if Raid Hunter started raiding during delay (HIGH priority raids take precedence)
                    if (isRaidHunterRaiding()) {
                        console.log('[Better Tasker] Raid Hunter started raiding HIGH priority raid during task start delay - aborting task operation');
                        return;
                    }
                    
                    // Check if tasker is still enabled after delay
                    if (taskerState !== TASKER_STATES.ENABLED) {
                        console.log('[Better Tasker] Tasker disabled during task start delay');
                        return;
                    }
                }
            }
            
            // Quest blip already checked at the beginning of the function
            
            // Check if task is ready OR if autoplay is active
            const isTaskReady = task.gameId ? task.ready : false; // Only check task.ready if there's an active task
            let isAutoplayActive = checkIfAutoplayIsActive();
            
            // If autoplay shows "Auto" state, wait for it to transition to "Autoplay" state
            if (!isTaskReady && !isAutoplayActive) {
                const autoButton = document.querySelector('button[data-full="true"][data-state="closed"]');
                if (autoButton && autoButton.textContent.includes('Auto') && autoButton.hasAttribute('disabled')) {
                    console.log('[Better Tasker] Waiting for autoplay button to transition from "Auto" to "Autoplay" state...');
                    
                    // Wait up to 20 seconds for the transition
                    let waitAttempts = 0;
                    
                    while (!isAutoplayActive && waitAttempts < AUTOPLAY_TRANSITION_MAX_ATTEMPTS) {
                        await sleep(100);
                        waitAttempts++;
                        isAutoplayActive = checkIfAutoplayIsActive();
                        
                        if (waitAttempts % 100 === 0) { // Log every 10 seconds
                            console.log(`[Better Tasker] Still waiting for autoplay transition... (${waitAttempts / 10}s)`);
                        }
                    }
                    
                    if (isAutoplayActive) {
                        console.log('[Better Tasker] Autoplay button transitioned to accessible state');
                    } else {
                        console.log('[Better Tasker] Autoplay button never transitioned, skipping quest log check');
                        return;
                    }
                }
            }
            
            // Only attempt quest log access when necessary
            if (isTaskReady) {
                // Open quest log to check for finish button
                console.log('[Better Tasker] Task is ready, opening quest log to check for finish button...');
                const questLogOpened = await openQuestLogWithRetry();

                if (questLogOpened) {
                    // Wait a moment for the UI to render
                    await sleep(500);

                    // Check if finish button is present and autocomplete is disabled
                    const finishButton = document.querySelector('button:has(svg.lucide-check)');
                    const settings = loadSettings();
                    if (finishButton && !settings.autoCompleteTasks) {
                        console.log('[Better Tasker] Task is ready with finish button present but autocomplete disabled - disabling mod in quest log to let other mods handle task completion');
                        // Disable the mod in quest log
                        taskerState = TASKER_STATES.DISABLED;
                        // Clear scheduler when disabling
                        if (taskCheckTimeout) {
                            clearTimeout(taskCheckTimeout);
                            taskCheckTimeout = null;
                        }
                        resetState('navigation');
                        updateExposedState();
                        // Update coordination system state
                        if (window.ModCoordination) {
                            window.ModCoordination.updateModState('Better Tasker', { enabled: false });
                        }
                    saveTaskerState();
                    updateToggleButton();
                    console.log('[Better Tasker] Tasker disabled in quest log due to ready task with finish button and autocomplete disabled');
                    console.log('[Better Tasker] Refreshing page to allow other mods to handle task completion...');
                    // Refresh the page to reset mod states and allow other mods to handle completion
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000); // Small delay to ensure state is saved
                    return;
                    }
                }

                console.log('[Better Tasker] Task is ready - proceeding with completion');
                await triggerFailsafe('Task is ready');
                return;
                
            } else if (isQuestBlipReady) {
                if (taskOperationInProgress) {
                    console.log('[Better Tasker] Task accept already in progress - skipping duplicate delegate');
                    return;
                }
                console.log('[Better Tasker] New task available - delegating to openQuestLogAndAcceptTask');
                await openQuestLogAndAcceptTask();
                return;
            } else if (task.gameId && !task.ready) {
                // Active task that's not ready yet - check if we need to navigate to the task map
                if (!taskNavigationCompleted) {
                    
                    // First check if we're already on the correct map
                    const currentRoomId = getCurrentRoomId();
                    if (currentRoomId && taskingMapId && currentRoomId === taskingMapId) {
                        taskNavigationCompleted = true;
                        updateExposedState();
                        return;
                    }
                    
                    // If we don't have a taskingMapId, try to get it from quest log
                    if (!taskingMapId) {
                        // Check if Raid Hunter is actively raiding before navigating
                        if (isRaidHunterRaiding()) {
                            console.log('[Better Tasker] Raid Hunter is actively raiding HIGH priority raid - deferring task navigation');
                            return;
                        }
                        console.log(`[Better Tasker] No tasking map ID stored (current: ${currentRoomId}) - opening quest log to get suggested map information...`);
                        const navigationResult = await navigateToSuggestedMapAndStartAutoplay();
                        if (!navigationResult) {
                            console.log('[Better Tasker] Navigation failed - will retry on next check');
                        }
                        return;
                    } else {
                        // Check if Raid Hunter is actively raiding before navigating
                        if (isRaidHunterRaiding()) {
                            console.log('[Better Tasker] Raid Hunter is actively raiding HIGH priority raid - deferring task navigation');
                            return;
                        }
                        console.log(`[Better Tasker] Not on correct map (current: ${currentRoomId}, expected: ${taskingMapId}) - opening quest log to get suggested map information...`);
                        const navigationResult = await navigateToSuggestedMapAndStartAutoplay();
                        if (navigationResult) {
                            console.log('[Better Tasker] Navigation successful');
                        } else {
                            console.log('[Better Tasker] Navigation failed - will retry on next check');
                        }
                        return;
                    }
                } else {
                    console.log('[Better Tasker] Active task in progress (not ready) - already navigated, monitoring kill progress only');
                    return;
                }
                
            } else if (isAutoplayActive) {
                console.log('[Better Tasker] Autoplay is active and quest log accessible, checking...');
            } else {
                // No active task and no new task available
                const now = Date.now();
                
                if (now - lastNoTaskCheck < NO_TASK_CHECK_DELAY) {
                    // Still within the delay period, skip this check
                    return;
                }
                
                // Update the last check time
                lastNoTaskCheck = now;
                console.log('[Better Tasker] No quest blip found and no active task - waiting 30s before next check');
                return;
            }
            
            // 1. Open quest log for other cases (autoplay active, etc.)
            // New tasks are handled via openQuestLogAndAcceptTask() earlier in this function
            console.log('[Better Tasker] Opening quest log for general case...');
            
            // Fallback: Try to open quest log using "Quests" button for active tasks
                console.log('[Better Tasker] No quest blip found, trying Quests button fallback...');
                const questsButton = document.querySelector('button img[src*="quest.png"]');
                if (questsButton) {
                    const questButton = questsButton.closest('button');
                    if (questButton) {
                        console.log('[Better Tasker] Found Quests button, opening quest log...');
                        
                        // Set task operation in progress flag
                        taskOperationInProgress = true;
                        updateExposedState();
                        console.log('[Better Tasker] Task operation in progress flag set - preventing duplicate operations');
                        
                        // Safety timeout to reset the flag if operation gets stuck (30 seconds)
                        const safetyTimeout = setTimeout(() => {
                            if (taskOperationInProgress) {
                                console.log('[Better Tasker] Safety timeout: Resetting taskOperationInProgress flag after 30 seconds');
                                taskOperationInProgress = false;
                                updateExposedState();
                            }
                        }, 30000);
                        safetyTimeouts.push(safetyTimeout);
                        
                        // Start quest button validation monitoring
                        startQuestButtonValidation();
                        
                        await closeQuestLogIfOpen();
                        
                        questButton.click();
                        await sleep(200);
                        console.log('[Better Tasker] Quest log opened via Quests button');
                        
                        // Wait for quest log to fully load
                        await sleep(300);
                        
                        // 1. Find Paw and Fur Society section first (section-first approach)
                        console.log('[Better Tasker] Using section-first approach - finding Paw and Fur Society section...');
                        const pawAndFurSection = findPawAndFurSection();
                        if (!pawAndFurSection) {
                            console.log('[Better Tasker] Paw and Fur Society section not found');
                            taskOperationInProgress = false;
                            updateExposedState();
                            return;
                        }
                        
                        // 2. Extract & validate creature from that specific section
                        console.log('[Better Tasker] Extracting creature from Paw and Fur Society section...');
                        const creatureName = extractCreatureFromSection(pawAndFurSection);
                        console.log('[Better Tasker] Extracted creature name:', creatureName);
                        if (!creatureName || !isCreatureAllowed(creatureName)) {
                            console.log(`[Better Tasker] Task rejected - creature "${creatureName}" is not in allowed list`);
                            
                            // Remove the task directly while quest log is open
                            console.log('[Better Tasker] Removing rejected task directly from quest log...');
                            const taskRemoved = await removeTaskDirectlyFromQuestLog();
                            if (taskRemoved) {
                                console.log('[Better Tasker] Rejected task successfully removed from game');
                            } else {
                                console.log('[Better Tasker] Failed to remove rejected task from game');
                            }
                            
                            // Clear flags and return
                            taskOperationInProgress = false;
                            updateExposedState();
                            return;
                        }
                        
                        // 3. Extract suggested map from that same section
                        console.log('[Better Tasker] Extracting suggested map from Paw and Fur Society section...');
                        const suggestedMapElement = extractSuggestedMapFromSection(pawAndFurSection);
                        
                        if (suggestedMapElement) {
                            // Check if Raid Hunter is actively raiding before navigating
                            if (isRaidHunterRaiding()) {
                                console.log('[Better Tasker] Raid Hunter is actively raiding HIGH priority raid - deferring task navigation');
                                taskOperationInProgress = false;
                                updateExposedState();
                                return;
                            }
                            console.log('[Better Tasker] Suggested map found, navigating...');
                            const navigationResult = await navigateToSuggestedMapAndStartAutoplay(suggestedMapElement, creatureName);
                            taskOperationInProgress = false;
                            updateExposedState();
                            if (!navigationResult) {
                                console.log('[Better Tasker] Navigation/autoplay start failed - will retry on next check');
                            }
                        } else {
                            console.log('[Better Tasker] No suggested map found in Paw and Fur Society section');
                        }
                        
                        return; // Successfully opened quest log, exit early
                    }
                }
                
                // Check if we should wait before re-checking
                const now = Date.now();
                
                if (now - lastNoTaskCheck < NO_TASK_CHECK_DELAY) {
                    // Still within the delay period, skip this check
                    return;
                }
                
                // Update the last check time
                lastNoTaskCheck = now;
                console.log('[Better Tasker] Quest blip not found and Quests button fallback failed - waiting 30s before next check');
                // Clear task operation in progress flag since no quest blip was found
                taskOperationInProgress = false;
                updateExposedState();
                console.log('[Better Tasker] Task completion and progress flags cleared - no quest blip');
                
                // Stop quest button validation and restore appearance
                stopQuestButtonValidation();
                restoreQuestButtonAppearance();
                
                // Restore normal button state
                updateToggleButton();
        } else {
            // Check if we should wait before re-checking
            const now = Date.now();
            
            if (now - lastNoTaskCheck < NO_TASK_CHECK_DELAY) {
                // Still within the delay period, skip this check
                return;
            }
            
            // Update the last check time
            lastNoTaskCheck = now;
            console.log('[Better Tasker] No quest log or task found - waiting 30s before next check');
            // Clear task operation in progress flag since no quest log or task was found
            taskOperationInProgress = false;
            updateExposedState();
            console.log('[Better Tasker] Task completion and progress flags cleared - no quest log or task');
            
            // Stop quest button validation and restore appearance
            stopQuestButtonValidation();
            restoreQuestButtonAppearance();
            
            // Restore normal button state
            updateToggleButton();
        }
    } catch (error) {
        console.error('[Better Tasker] Error handling task finishing:', error);
        cleanupTaskCompletionFailure('error handling task finishing');
    }
}

// ============================================================================
// 13. AUTOMATION LOOP
// ============================================================================

// Add debouncing for game state events
const GAME_STATE_DEBOUNCE_MS = 1000; // 1 second debounce

// Subscribe to board game state changes
function subscribeToGameState() {
    try {
        unsubscribeFromGameState();

        // Subscribe to board state changes for new game detection
        if (globalThis.state && globalThis.state.board) {
            // Consolidated new game handler with debouncing
            const handleNewGame = async (event) => {
                // Skip during Board Analyzer runs
                if (isBoardAnalyzerActive()) {
                    return;
                }
                
                const now = Date.now();
                if (now - lastNewGameDebounceAt < GAME_STATE_DEBOUNCE_MS) {
                    console.log('[Better Tasker] Ignoring rapid new game event (debounced)');
                    return;
                }
                lastNewGameDebounceAt = now;
                lastGameStateChange = now;
                
                // Skip session reset during raids to avoid quest button control conflicts
                // Use cached flag for reliability during game transitions
                if (isRaidHunterActive || isRaidHunterRaiding()) {
                    console.log('[Better Tasker] Raid Hunter is actively raiding - skipping session reset to avoid control conflicts');
                    return;
                }
                
                console.log('[Better Tasker] New game detected via game state API, resetting session flags');
                resetState('session');
                // Don't reset taskNavigationCompleted - it should persist until user manually stops automation

                // Runs budget: emitEndGame is often missing under fast autoplay; tick when a NEW match starts
                // (meaning the previous one finished). Skip once right after refresh — that newGame is the first match, not a completion.
                if (taskHuntingOngoing && taskHuntingRunsBudget !== null) {
                    if (skipRunsBudgetTickOnNextNewGame) {
                        skipRunsBudgetTickOnNextNewGame = false;
                    } else {
                        onTaskHuntingAutoplayGameEnded();
                    }
                }

                // Final-run guard: once runsLeft reaches 1, pause autoplay now so no surplus run chains after this game.
                if (taskHuntingOngoing && taskHuntingRunsBudget === 1 && !finalRunPauseIssued) {
                    finalRunPauseIssued = true;
                    console.log('[Better Tasker] [runs-budget] final run armed (runsLeft=1) — pausing autoplay now');
                    void handleFinalRunPauseWithRetry();
                }
                
                // Log current task status when new game starts
                try {
                    const progNew = getTaskKillProgress();
                    if (progNew) {
                        console.log(`[Better Tasker] Progress: ${progNew.current}/${progNew.target} (${progNew.source})`);
                        if (progNew.current >= progNew.target) {
                            await triggerFailsafe(`${progNew.current}/${progNew.target} task kills (new game)`);
                            return;
                        }
                    }
                } catch (error) {
                    console.error('[Better Tasker] Error logging task status on new game:', error);
                }
            };
            
            // Subscribe to newGame event (primary handler)
            const newGameUnsub = globalThis.state.board.on('newGame', handleNewGame);
            if (isActiveStateSubscription(newGameUnsub)) {
                gameStateUnsubscribers.push(newGameUnsub);
            }
            
            // Consolidated end game handler with debouncing
            const handleEndGame = async (event) => {
                // Skip during Board Analyzer runs
                if (isBoardAnalyzerActive()) {
                    return;
                }
                
                const now = Date.now();
                if (now - lastEndGameDebounceAt < GAME_STATE_DEBOUNCE_MS) {
                    console.log('[Better Tasker] Ignoring rapid end game event (debounced)');
                    return;
                }
                lastEndGameDebounceAt = now;
                lastGameStateChange = now;
                
                // Check for task completion after every game ends (autoplay or manual)
                console.log('[Better Tasker] Game ended, checking for task completion...');

                // Runs budget is driven from newGame (previous game finished) because emitEndGame is unreliable in fast autoplay.
                
                // Log current task status and progress
                try {
                    const progEnd = getTaskKillProgress();
                    if (progEnd) {
                        console.log(`[Better Tasker] Progress: ${progEnd.current}/${progEnd.target} (${progEnd.source})`);
                        if (progEnd.current >= progEnd.target) {
                            await triggerFailsafe(`${progEnd.current}/${progEnd.target} task kills (end game)`);
                            return;
                        }
                    }
                } catch (error) {
                    console.error('[Better Tasker] Error logging task status:', error);
                }
                
                // ALWAYS check for new tasks (even during raids) - this is non-invasive
                console.log('[Better Tasker] Checking if new task is available via game state API...');
                const newTaskAvailable = isQuestBlipAvailable();
                console.log('[Better Tasker] New task available check result:', newTaskAvailable);
                
                if (newTaskAvailable) {
                    // openQuestLogAndAcceptTask() handles raids internally - accepts tasks but blocks navigation
                    console.log('[Better Tasker] New task available - accepting task');
                    await openQuestLogAndAcceptTask();
                    return;
                }
                
                // Check if Raid Hunter is currently raiding - skip task COMPLETION during raids
                // Use cached flag for reliability during game transitions
                const raidActive = isRaidHunterActive || isRaidHunterRaiding();
                console.log('[Better Tasker] Raid Hunter active check:', raidActive);
                
                if (raidActive) {
                    console.log('[Better Tasker] Raid Hunter is actively raiding - skipping task completion (already checked for new tasks)');
                    return;
                }
                
                if (taskCompletionInProgress || pendingTaskCompletion) {
                    console.log('[Better Tasker] Task completion already in progress - skipping duplicate end-game handler');
                    return;
                }

                // Check and finish tasks immediately after game ends (only when not raiding)
                await handlePostGameTaskCompletion(false);
            };
            
            // Subscribe to emitEndGame event
            const endGameUnsub = globalThis.state.board.on('emitEndGame', handleEndGame);
            if (isActiveStateSubscription(endGameUnsub)) {
                gameStateUnsubscribers.push(endGameUnsub);
            }

            const emitNewGameGuardUnsub = globalThis.state.board.on('emitNewGame', onTaskHuntingEmitNewGameGuard);
            if (isActiveStateSubscription(emitNewGameGuardUnsub)) {
                gameStateUnsubscribers.push(emitNewGameGuardUnsub);
            }
        }
        
        console.log('[Better Tasker] Game state monitoring set up');
    } catch (error) {
        console.error('[Better Tasker] Error subscribing to game state:', error);
    }
}

// Unsubscribe from game state changes
function unsubscribeFromGameState() {
    // Clean up game state API subscriptions
    gameStateUnsubscribers.forEach(unsub => {
        if (isActiveStateSubscription(unsub)) {
            try {
                invokeStateSubscription(unsub);
            } catch (error) {
                console.error('[Better Tasker] Error unsubscribing from game state:', error);
            }
        }
    });
    gameStateUnsubscribers = [];
    
    console.log('[Better Tasker] Game state monitoring disconnected');
}

// Main automation loop
function startAutomation() {
    if (automationInterval) return;
    
    console.log('[Better Tasker] Starting automation loop');
    
    // Reset session flags when starting automation
    resetState('automation');
    // Don't reset taskNavigationCompleted - let it persist across automation restarts
    
    // Set up Raid Hunter coordination FIRST (monitoring only, doesn't interfere)
    setupRaidHunterCoordination();
    
    // Set up Board Analyzer coordination (monitoring only)
    setupBoardAnalyzerCoordination();
    
    // Subscribe to game state for task completion (always set up, even during raids for new task acceptance)
    subscribeToGameState();
    setupManualPlayDetection();
    
    // Check if Raid Hunter is actively raiding
    if (isRaidHunterRaiding()) {
        console.log('[Better Tasker] Raid Hunter is actively raiding - game state monitoring active for new tasks, waiting for raid to end for full automation');
        return;
    }
    
    const raidHunterEnabled = localStorage.getItem('raidHunterAutomationEnabled');
    const raidState = globalThis.state?.raids?.getSnapshot?.();
    const hasActiveRaids = raidState?.context?.list?.length > 0;
    
    automationInterval = setInterval(runAutomationTasks, 5000);
    
    if (raidHunterEnabled === 'true' && hasActiveRaids) {
        console.log('[Better Tasker] Raids available at startup - delaying 15 seconds to let Raid Hunter claim priority (extended for init)');
        if (automationStartupTimeout) {
            clearTimeout(automationStartupTimeout);
        }
        automationStartupTimeout = setTimeout(() => {
            automationStartupTimeout = null;
            const canRunAutomation = taskerState === TASKER_STATES.ENABLED;
            const canSchedule = taskerState === TASKER_STATES.ENABLED || taskerState === TASKER_STATES.NEW_TASK_ONLY;
            if (!canRunAutomation && !canSchedule) {
                return;
            }

            // After delay, check if Raid Hunter is now processing raids
            if (isRaidHunterRaiding()) {
                console.log('[Better Tasker] Raid Hunter is now processing raids - skipping full automation but starting scheduler for new tasks');
                if (canSchedule) {
                    scheduleTaskCheck();
                }
                return;
            }

            console.log('[Better Tasker] Raid Hunter did not claim raids - proceeding with full task automation');
            if (canRunAutomation) {
                runAutomationTasks();
            }
            if (canSchedule) {
                scheduleTaskCheck();
            }
        }, 15000); // Increased from 5s to 15s to allow Raid_Hunter time to initialize
    } else {
        // No raids available or Raid Hunter disabled - run immediately
        runAutomationTasks();
        scheduleTaskCheck();
    }
}

// Pause automation during raids (keeps game state monitoring AND scheduler for new tasks)
function pauseAutomationDuringRaid() {
    if (!automationInterval) return;
    
    console.log('[Better Tasker] Pausing automation during raid (keeping game state monitoring and scheduler for new task acceptance)');
    
    // Clear main automation intervals (but keep game state monitoring)
    clearInterval(automationInterval);
    automationInterval = null;

    // DON'T clear task check timeout - we need it to wake up for new tasks during raids
    // DON'T unsubscribe from game state - we need it to accept new tasks during raids
    // DON'T clean up coordinators - they need to keep monitoring
    // DON'T pause autoplay - Raid Hunter is controlling that
    // DON'T touch Bestiary Automator settings - Raid Hunter is controlling those
    
    console.log('[Better Tasker] Automation paused - game state monitoring and scheduler active for new task acceptance');
}

function teardownBetterTaskerRuntime() {
    clearPendingAutomationTimeouts();
    stopQuestButtonValidation({ clearTaskingMap: false });
    unsubscribeFromGameState();
    teardownManualPlayDetection();
    stopStaminaTooltipMonitoring();
    closeCreatureContextMenu();

    if (taskCheckTimeout) {
        clearTimeout(taskCheckTimeout);
        taskCheckTimeout = null;
    }

    if (creatureFilterCheckTimeout) {
        clearTimeout(creatureFilterCheckTimeout);
        creatureFilterCheckTimeout = null;
    }

    if (mutationProcessTimer) {
        clearTimeout(mutationProcessTimer);
        mutationProcessTimer = null;
    }
}

async function stopAutomation() {
    clearPendingAutomationTimeouts();
    teardownBetterTaskerRuntime();

    const hadAutomationLoop = !!automationInterval;
    if (automationInterval) {
        clearInterval(automationInterval);
        automationInterval = null;
    }

    cleanupRaidHunterCoordination();
    cleanupBoardAnalyzerCoordination();

    if (hadAutomationLoop) {
        console.log('[Better Tasker] Stopping automation loop');
    }

    await pauseAutoplayForUserStop();
    disableBetterTaskerAutomatorSettings();
}

function runAutomationTasks() {
    try {
        // Only run if tasker is enabled
        if (taskerState !== TASKER_STATES.ENABLED) {
            return;
        }

        if (isManualPlayPaused()) {
            return;
        }
        
        // Check if Board Analyzer is running
        if (isBoardAnalyzerActive()) {
            console.log('[Better Tasker] Board Analyzer is running, skipping automation');
            return;
        }
        
        // Check if Raid Hunter is actively raiding
        if (isRaidHunterRaiding()) {
            console.log('[Better Tasker] Raid Hunter is actively raiding, skipping automation');
            return;
        }
        
        // Stamina Optimizer blocks only when enabling autoplay in ensureAutoplayMode()
        
        // Creature filter while idle/navigation only; mid-hunt re-checks happen on settings change
        if (!taskHuntingOngoing && isGameActive() && hasActiveQuestTask()) {
            void runCreatureFilterCheck();
        }
        
        // Don't run automation if task hunting is ongoing
        if (taskHuntingOngoing) {
            return;
        }
        
        // Check if game is active
        if (!isGameActive()) {
            return;
        }
        
        // Check and finish tasks proactively
        handleTaskFinishing();
        
    } catch (error) {
        console.error('[Better Tasker] Error in automation tasks:', error);
    }
}

// ============================================================================
// 13.1. CREATURE FILTERING FUNCTIONS
// ============================================================================

function extractCreatureNameFromDescription(root) {
    const scope = root?.querySelectorAll ? root : document;
    const taskDescriptions = scope.querySelectorAll('.pixel-font-14');
    for (const desc of taskDescriptions) {
        const text = desc.textContent;
        if (!text || (!text.includes('kill count') && !text.includes('mortos'))) continue;
        const killCountMatch = text.match(/^(.+?)\s+(?:kill\s+count|mortos?)/i);
        if (killCountMatch) return killCountMatch[1].trim();
    }
    return null;
}

function extractCreatureFromRoot(root, logLabel = 'task') {
    try {
        console.log(`[Better Tasker] Extracting creature from ${logLabel}...`);
        const scope = root?.querySelector ? root : document;
        const creatureSprite = scope.querySelector('.sprite.outfit[class*="id-"]');
        if (creatureSprite) {
            const idClass = Array.from(creatureSprite.classList).find((cls) => cls.startsWith('id-'));
            if (idClass) {
                const creatureId = idClass.replace('id-', '');
                console.log('[Better Tasker] Found creature sprite with ID:', creatureId);
                const creatureName = getCreatureNameByGameId(creatureId);
                if (creatureName) {
                    console.log('[Better Tasker] Mapped creature ID to name:', creatureName);
                    return creatureName;
                }
                const fromSpriteDescription = extractCreatureNameFromDescription(scope);
                if (fromSpriteDescription) {
                    console.log('[Better Tasker] Extracted creature from description:', fromSpriteDescription);
                    return fromSpriteDescription;
                }
            }
        }
        const fromDescription = extractCreatureNameFromDescription(scope);
        if (fromDescription) {
            console.log('[Better Tasker] Extracted creature from description:', fromDescription);
            return fromDescription;
        }
        console.log(`[Better Tasker] Could not extract creature name from ${logLabel}`);
        return null;
    } catch (error) {
        console.error(`[Better Tasker] Error extracting creature from ${logLabel}:`, error);
        return null;
    }
}

function extractCreatureFromTask() {
    return extractCreatureFromRoot(document, 'task');
}

function extractCreatureFromSection(section) {
    return extractCreatureFromRoot(section, 'section');
}

// Extract suggested map from a specific section
function extractSuggestedMapFromSection(section) {
    try {
        console.log('[Better Tasker] Extracting suggested map from section...');
        
        // Look for suggested map text within this section
        const allParagraphs = section.querySelectorAll('p.pixel-font-14');
        const suggestedMapLabels = getBothLanguages('mods.betterTasker.suggestedMap');
        for (const p of allParagraphs) {
            if (p.textContent && suggestedMapLabels.some((label) => p.textContent.includes(label))) {
                const suggestedMapElement = p.querySelector('span.action-link');
                if (suggestedMapElement) {
                    console.log('[Better Tasker] Suggested map element found in section:', suggestedMapElement.textContent.trim());
                    return suggestedMapElement;
                }
            }
        }
        
        console.log('[Better Tasker] No suggested map found in section');
        return null;
    } catch (error) {
        console.error('[Better Tasker] Error extracting suggested map from section:', error);
        return null;
    }
}

// Open quest log specifically for task removal
async function openQuestLogForTaskRemoval() {
    try {
        // First try to find quest blip
        const questBlip = document.querySelector('[data-blip="true"]');
        if (questBlip) {
            console.log('[Better Tasker] Found quest blip, clicking to open quest log...');
            questBlip.click();
            await sleep(500);
            return true;
        }
        
        // Fallback: try Quests button
        const questsButton = document.querySelector('button img[src*="quest.png"]')?.closest('button') ||
                            Array.from(document.querySelectorAll('button')).find(btn => {
                                const span = btn.querySelector('span');
                                return span && (span.textContent === 'Quests' || span.textContent === 'Quest Log');
                            });
        
        if (questsButton) {
            console.log('[Better Tasker] Found Quests button, clicking to open quest log...');
            questsButton.click();
            await sleep(500);
            return true;
        }
        
        console.log('[Better Tasker] No quest blip or Quests button found for task removal');
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error opening quest log for task removal:', error);
        return false;
    }
}

function scheduleCreatureFilterCheck() {
    if (taskerState !== TASKER_STATES.ENABLED) {
        return;
    }
    if (creatureFilterCheckTimeout) {
        clearTimeout(creatureFilterCheckTimeout);
    }
    creatureFilterCheckTimeout = setTimeout(() => {
        creatureFilterCheckTimeout = null;
        void runCreatureFilterCheck({ forceRecheck: true });
    }, CREATURE_FILTER_CHECK_DEBOUNCE_MS);
}

async function runCreatureFilterCheck({ forceRecheck = false } = {}) {
    if (taskerState !== TASKER_STATES.ENABLED) {
        return;
    }
    if (isManualPlayPaused()) {
        return;
    }
    if (taskOperationInProgress || pendingTaskCompletion) {
        return;
    }
    if (window.betterTaskerRemovingTask || creatureFilterCheckInFlight) {
        return;
    }
    if (!isGameActive() || !hasActiveQuestTask()) {
        return;
    }
    if (taskHuntingOngoing && !forceRecheck) {
        return;
    }

    const taskRemoved = await removeCurrentTaskIfNotAllowed({ forceRecheck });
    if (taskRemoved) {
        console.log('[Better Tasker] Task removed due to creature filter');
        resetState('taskComplete');
        await pauseAutoplay();
        scheduleTaskCheck();
    }
}

// Remove current task if creature is not allowed
async function removeCurrentTaskIfNotAllowed({ forceRecheck = false } = {}) {
    if (!forceRecheck && isCreatureFilterAlreadyValidated()) {
        return false;
    }
    if (creatureFilterCheckInFlight) {
        return false;
    }

    creatureFilterCheckInFlight = true;
    try {
        if (!hasActiveQuestTask()) {
            return false;
        }
        
        // Safety check: prevent double-removal by checking if we're already in the middle of removing
        if (window.betterTaskerRemovingTask) {
            console.log('[Better Tasker] Task removal already in progress, skipping to prevent double-removal');
            return false;
        }
        
        // Set flag to prevent double-removal
        window.betterTaskerRemovingTask = true;
        
        const creatureName = resolveCurrentTaskCreatureName();
        if (!creatureName) {
            console.log('[Better Tasker] Could not resolve creature for current task');
            return false;
        }
        
        const taskGameId = getCurrentTaskGameId();
        console.log(`[Better Tasker] Validating task creature: ${creatureName} (gameId ${taskGameId})`);
        const isAllowed = isCreatureAllowed(creatureName);
        if (isAllowed) {
            markCreatureFilterValidated();
            return false;
        }
        
        clearCreatureFilterCache();
        console.log(`[Better Tasker] Current task creature "${creatureName}" is NOT allowed, removing task...`);
        
        // First, make sure quest log is open (Remove button is only visible when quest log is open)
        console.log('[Better Tasker] Opening quest log to access Remove button...');
        const questLogOpened = await openQuestLogForTaskRemoval();
        if (!questLogOpened) {
            console.log('[Better Tasker] Failed to open quest log for task removal');
            return false;
        }
        
        // Wait a moment for quest log to fully load
        await sleep(500);
        
        // Find and click the Remove button (look for button containing trash icon)
        let removeButton = null;
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
            const trashIcon = btn.querySelector('svg.lucide-trash2');
            if (trashIcon && isElementVisible(btn)) {
                // Use centralized function to check for remove button text
                const possibleTexts = getBothLanguages('mods.betterTasker.remove');
                const buttonText = btn.textContent.trim();
                if (possibleTexts.some(text => buttonText.includes(text))) {
                    removeButton = btn;
                    break;
                }
            }
        }
        
        if (!removeButton) {
            console.log('[Better Tasker] Remove button not found');
            return false;
        }
        
        console.log('[Better Tasker] Clicking Remove button...');
        removeButton.click();
        
        // Wait for the confirmation dialog to appear
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Find and click the confirmation button
        const confirmButton = findConfirmationButton();
        if (confirmButton) {
            console.log('[Better Tasker] Clicking confirmation button...');
            confirmButton.click();
            
            // Wait after confirmation click
            await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
            console.log('[Better Tasker] Confirmation button not found');
        }
        
        console.log('[Better Tasker] Task removal completed');
        
        // Close quest log after task removal
        console.log('[Better Tasker] Closing quest log after task removal...');
        await closeQuestLogIfOpen();
        
        return true;
        
    } catch (error) {
        console.error('[Better Tasker] Error removing current task:', error);
        return false;
    } finally {
        window.betterTaskerRemovingTask = false;
        creatureFilterCheckInFlight = false;
    }
}

// Remove task directly from quest log (without closing it first)
async function removeTaskDirectlyFromQuestLog() {
    try {
        console.log('[Better Tasker] Removing task directly from quest log...');
        
        // Wait a moment for quest log to be fully loaded
        await sleep(500);
        
        // Find and click the Remove button (look for button containing trash icon)
        let removeButton = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!removeButton && attempts < maxAttempts) {
            const allButtons = document.querySelectorAll('button');
            for (const btn of allButtons) {
                const trashIcon = btn.querySelector('svg.lucide-trash2');
                if (trashIcon && isElementVisible(btn)) {
                    const text = btn.textContent.trim().toLowerCase();
                    // More specific matching to avoid false positives
                    const possibleTexts = getBothLanguages('mods.betterTasker.remove').map((s) => s.toLowerCase());
                    if (possibleTexts.some(possibleText => 
                        text === possibleText || 
                        text === `${possibleText} task` || 
                        text.includes(`${possibleText} current`))) {
                        removeButton = btn;
                        break;
                    }
                }
            }
            
            if (!removeButton) {
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(`[Better Tasker] Remove button not found, retrying... (${attempts}/${maxAttempts})`);
                    await sleep(500);
                }
            }
        }
        
        if (!removeButton) {
            console.log('[Better Tasker] Remove button not found in quest log after retries');
            return false;
        }
        
        console.log('[Better Tasker] Clicking Remove button...');
        removeButton.click();
        
        // Wait for the confirmation dialog to appear
        await sleep(1000);
        
        // Find and click the confirmation button
        const confirmButton = findConfirmationButton();
        let confirmationClicked = false;
        if (confirmButton) {
            console.log('[Better Tasker] Clicking confirmation button...');
            confirmButton.click();
            confirmationClicked = true;
            
            // Wait after confirmation click
            await sleep(1000);
        } else {
            console.log('[Better Tasker] Confirmation button not found');
        }
        
        if (!confirmationClicked) {
            console.log('[Better Tasker] Confirmation button not found - task removal may be incomplete');
            return false;
        }
        
        console.log('[Better Tasker] Task removal completed directly from quest log');
        return true;
        
    } catch (error) {
        console.error('[Better Tasker] Error removing task directly from quest log:', error);
        return false;
    }
}

// Check if a creature is in the allowed list
function isCreatureAllowed(creatureName) {
    try {
        if (!creatureName) {
            return true; // Allow if we can't determine creature
        }

        if (UNSELECTABLE_CREATURES.includes(creatureName) || isGazerCreature(creatureName) || isEventCreature(creatureName)) {
            return false;
        }
        
        const settings = loadSettings();
        const creatureKey = getCreatureSettingsKey(creatureName);
        const isAllowed = settings[creatureKey] === true;
        if (!isAllowed) {
            console.log(`[Better Tasker] Creature "${creatureName}" is NOT allowed (individual setting: ${settings[creatureKey]})`);
        }
        
        return isAllowed;
    } catch (error) {
        console.error('[Better Tasker] Error checking if creature is allowed:', error);
        return true; // Allow on error to avoid blocking tasks
    }
}

// Schedule next task check based on resetAt timestamp (max 10 minutes between checks)
function scheduleTaskCheck() {
    try {
        // Clear any existing timeout
        if (taskCheckTimeout) {
            clearTimeout(taskCheckTimeout);
            taskCheckTimeout = null;
        }
        
        // Only schedule if tasker is enabled OR in New Task+ mode
        if (taskerState !== TASKER_STATES.ENABLED && taskerState !== TASKER_STATES.NEW_TASK_ONLY) {
            return;
        }
        
        // Don't schedule if task hunting is ongoing
        if (taskHuntingOngoing) {
            return;
        }
        
        // Check if a task operation is already in progress
        if (taskOperationInProgress) {
            return;
        }
        
        // Check if game is active
        if (!isGameActive()) {
            return;
        }
        
        // Get task info from game state
        const playerContext = globalThis.state.player.getSnapshot().context;
        if (!playerContext.questLog || !playerContext.questLog.task) {
            taskCheckTimeout = setTimeout(() => scheduleTaskCheck(), SCHEDULER_COOLDOWN_CAP_MS);
            return;
        }
        
        const task = playerContext.questLog.task;
        
        // Check for active task using both gameId and player.activeTask
        const activeTask = globalThis.state?.player?.activeTask;
        const hasActiveTask = task.gameId || activeTask;
        
        // Only check if there's no active task
        if (hasActiveTask) {
            return;
        }
        
        // Check if new task is available now
        if (!task.resetAt) {
            console.log('[Better Tasker] Scheduler: new task available now - accepting');
            // openQuestLogAndAcceptTask() handles raids internally - accepts tasks but blocks navigation
            openQuestLogAndAcceptTask();
            return;
        }
        
        // Calculate time until task is available
        const timeRemaining = task.resetAt - Date.now();
        
        if (timeRemaining <= 0) {
            console.log('[Better Tasker] Scheduler: task cooldown expired - accepting now');
            // openQuestLogAndAcceptTask() handles raids internally - accepts tasks but blocks navigation
            openQuestLogAndAcceptTask();
            return;
        }
        
        // Cap delay at 10 minutes (600000ms)
        const delay = Math.min(timeRemaining, SCHEDULER_COOLDOWN_CAP_MS);
        // Schedule next check
        taskCheckTimeout = setTimeout(() => {
            scheduleTaskCheck(); // Rechain
        }, delay);
        
    } catch (error) {
        console.error('[Better Tasker] Scheduler: Error during check:', error);
        // Retry in 2 minutes on error
        taskCheckTimeout = setTimeout(() => scheduleTaskCheck(), SCHEDULER_ERROR_RETRY_MS);
    }
}

// Shared function to accept new task (used by both Enabled and New Task+ modes)
async function acceptNewTaskFromQuestLog(skipCreatureFiltering = false) {
    try {
        console.log(`[Better Tasker] Accepting new task (skip filtering: ${skipCreatureFiltering})...`);
        
        // Look for and click "New Task" button
        console.log('[Better Tasker] Looking for New Task button...');
        let newTaskButton = document.querySelector('button:has(svg.lucide-plus)');
        if (!newTaskButton) {
            // Use localization system to find New Task button
            newTaskButton = findButtonByText('New task');
        }
        
        if (!newTaskButton) {
            console.log('[Better Tasker] New Task button not found');
            return false;
        }
        
        console.log('[Better Tasker] New Task button found, clicking...');
        newTaskButton.click();
        await sleep(200);
        console.log('[Better Tasker] New Task button clicked');
        
        // Wait for task selection to load or error to appear
        await sleep(500);
        
        // Check for error message about needing to remove current task
        const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"], .text-red, .text-red-500');
        for (const errorEl of errorElements) {
            const errorText = errorEl.textContent || errorEl.innerText || '';
            if (errorText.toLowerCase().includes('remove') && errorText.toLowerCase().includes('current task')) {
                console.log('[Better Tasker] Error detected: "Remove current task before setting a new one"');
                // Wait a bit for the error to be fully displayed
                await sleep(500);
                return false; // Indicate failure - will trigger retry with task removal
            }
        }
        
        // Check creature filtering if not skipped
        if (!skipCreatureFiltering) {
            console.log('[Better Tasker] Checking creature filtering...');
            const creatureName = resolveCurrentTaskCreatureName();
            console.log('[Better Tasker] Resolved creature name:', creatureName);
            
            if (creatureName && !isCreatureAllowed(creatureName)) {
                console.log(`[Better Tasker] Task rejected - creature "${creatureName}" is not in allowed list`);
                
                // Remove the task directly while quest log is open
                console.log('[Better Tasker] Removing rejected task directly from quest log...');
                const taskRemoved = await removeTaskDirectlyFromQuestLog();
                if (taskRemoved) {
                    console.log('[Better Tasker] Rejected task successfully removed from game');
                } else {
                    console.log('[Better Tasker] Failed to remove rejected task from game');
                }
                
                return false; // Task rejected
            }
        }
        
        console.log('[Better Tasker] Task accepted successfully');
        markCreatureFilterValidated();
        return true; // Task accepted
        
    } catch (error) {
        console.error('[Better Tasker] Error accepting new task:', error);
        return false;
    }
}

// Open quest log and accept new task (extracted from handleTaskFinishing)
async function openQuestLogAndAcceptTask() {
    try {
        console.log('[Better Tasker] === OPEN QUEST LOG AND ACCEPT TASK START ===');

        if (isManualPlayPaused()) {
            console.log('[Better Tasker] Manual play pause active - skipping quest log accept');
            return;
        }

        if (!claimTaskOperation('open quest log and accept task')) {
            console.log('[Better Tasker] Task operation already in progress, skipping duplicate call');
            return;
        }
        
        console.log('[Better Tasker] Current raid state:', {
            isRaidHunterActive: isRaidHunterActive,
            isRaidHunterRaiding: isRaidHunterRaiding()
        });
        
        // Check for active task before proceeding (check both activeTask and gameId)
        const activeTask = globalThis.state?.player?.activeTask;
        const playerContext = globalThis.state?.player?.getSnapshot?.()?.context;
        const taskGameId = playerContext?.questLog?.task?.gameId;
        
        if (activeTask || taskGameId) {
            console.log('[Better Tasker] Active task detected (activeTask:', !!activeTask, ', gameId:', taskGameId, ') - must remove current task before accepting new one');
            
            // Check if we're in cooldown after too many removal failures
            const timeSinceLastAttempt = Date.now() - lastTaskRemovalAttempt;
            if (taskRemovalRetryCount >= MAX_TASK_REMOVAL_RETRIES && timeSinceLastAttempt < TASK_REMOVAL_RETRY_COOLDOWN) {
                const remainingCooldown = Math.ceil((TASK_REMOVAL_RETRY_COOLDOWN - timeSinceLastAttempt) / 1000);
                console.log(`[Better Tasker] Task removal retry limit reached (${taskRemovalRetryCount}/${MAX_TASK_REMOVAL_RETRIES}). Cooldown active: ${remainingCooldown}s remaining. Stopping to prevent loop.`);
                releaseTaskOperation();
                // Schedule next check after cooldown expires
                const cooldownRemaining = TASK_REMOVAL_RETRY_COOLDOWN - timeSinceLastAttempt;
                taskCheckTimeout = setTimeout(() => {
                    // Reset counter after cooldown
                    taskRemovalRetryCount = 0;
                    scheduleTaskCheck();
                }, cooldownRemaining);
                return;
            }
            
            // Reset counter if enough time has passed since last attempt
            if (timeSinceLastAttempt > TASK_REMOVAL_RESET_TIME) {
                taskRemovalRetryCount = 0;
                console.log('[Better Tasker] Task removal retry counter reset (enough time passed)');
            }
            
            lastTaskRemovalAttempt = Date.now();
            
            // First, try to remove the task if creature is not allowed
            let taskRemoved = await removeCurrentTaskIfNotAllowed();
            
            // If that didn't work and there's still an active task, try to remove it directly
            if (!taskRemoved && (activeTask || taskGameId)) {
                console.log('[Better Tasker] Active task still exists - attempting direct removal...');
                const questLogOpened = await openQuestLogForTaskRemoval();
                if (questLogOpened) {
                    await sleep(500);
                    taskRemoved = await removeTaskDirectlyFromQuestLog();
                    if (taskRemoved) {
                        await sleep(1000);
                        await closeQuestLogIfOpen();
                    }
                }
            }
            
            if (!taskRemoved) {
                taskRemovalRetryCount++;
                console.log(`[Better Tasker] Could not remove active task (retry ${taskRemovalRetryCount}/${MAX_TASK_REMOVAL_RETRIES}) - will retry later`);
                releaseTaskOperation();
                
                // Use exponential backoff: 5s, 10s, 20s
                const backoffDelay = Math.min(5000 * Math.pow(2, taskRemovalRetryCount - 1), 20000);
                console.log(`[Better Tasker] Scheduling retry with exponential backoff: ${backoffDelay}ms`);
                taskCheckTimeout = setTimeout(() => scheduleTaskCheck(), backoffDelay);
                return;
            } else {
                // Success - reset counter
                taskRemovalRetryCount = 0;
                console.log('[Better Tasker] Task removal successful - retry counter reset');
            }
            // Wait a bit for the task removal to process and state to update
            await sleep(2000);
        }
        
        // Don't set task operation in progress flag here - only set it when actually processing a task
        // Task acceptance during raids is allowed; navigation is blocked in openQuestLogAndAcceptTask
        console.log('[Better Tasker] Opening quest log to check for tasks...');
        
        await closeQuestLogIfOpen();
        console.log('[Better Tasker] Quest log pre-open cleanup completed');
        
        // Find and click quest blip or use "Quests/Raiding" button as fallback
        let questLogOpened = false;
        
        // Use comprehensive quest blip selectors (like elsewhere in the code)
        const questBlipSelectors = [
            '#header-slot img[src*="quest-blip.png"]',
            '#header-slot img[src*="/assets/icons/quest-blip.png"]',
            '#header-slot img[alt="Quests"][src*="quest-blip"]',
            '#header-slot img[alt="Tasking"][src*="quest-blip"]',
            'img[src*="quest-blip.png"]',  // Fallback
            'img[src*="/assets/icons/quest-blip.png"]'  // Fallback
        ];
        
        let questBlip = null;
        for (const selector of questBlipSelectors) {
            questBlip = document.querySelector(selector);
            if (questBlip) {
                console.log(`[Better Tasker] Found quest blip with selector: ${selector}`);
                break;
            }
        }
        
        if (questBlip) {
            questBlip.click();
            await sleep(200);
            console.log('[Better Tasker] Quest log opened via quest blip');
            questLogOpened = true;
        } else {
            // Fallback: Look for "Quests" button (normal) or "Raiding" button (during raids)
            console.log('[Better Tasker] No quest blip found, looking for Quests/Raiding button...');
            const questsButton = document.querySelector('button img[src*="quest.png"]') ||
                                document.querySelector('button img[src*="enemy.png"]');  // Raiding button during raids
            if (questsButton) {
                const questButton = questsButton.closest('button');
                if (questButton) {
                    questButton.click();
                    await sleep(200);
                    console.log('[Better Tasker] Quest log opened via Quests button');
                    questLogOpened = true;
                }
            } else {
                console.log('[Better Tasker] Neither quest blip nor Quests button found');
            }
        }
        
        if (questLogOpened) {
            // Wait for quest log to fully load
            await sleep(300);
            
            // Check if Raid Hunter is actively raiding OR if in New Task+ mode - both skip creature filtering
            const isRaiding = isRaidHunterRaiding();
            const isNewTaskMode = taskerState === TASKER_STATES.NEW_TASK_ONLY;
            const skipFiltering = isRaiding || isNewTaskMode;
            
            if (skipFiltering) {
                const reason = isNewTaskMode ? 'New Task+ mode' : 'Raid Hunter active';
                console.log(`[Better Tasker] ${reason} - accepting task without filtering`);
            }
            
            // Accept new task using shared function
            const taskAccepted = await acceptNewTaskFromQuestLog(skipFiltering);
            
            if (!taskAccepted) {
                console.log('[Better Tasker] Task not accepted (filtered, not found, or error)');
                
                // Check if there's an active task that needs to be removed
                const activeTaskAfterFailure = globalThis.state?.player?.activeTask;
                const playerContextAfterFailure = globalThis.state?.player?.getSnapshot?.()?.context;
                const taskGameIdAfterFailure = playerContextAfterFailure?.questLog?.task?.gameId;
                
                // Detect stale state: API error but no local active task (likely needs browser refresh)
                const errorDetected = document.querySelector('[class*="error"], [class*="Error"], .text-red, .text-red-500');
                const hasErrorText = errorDetected && (
                    errorDetected.textContent?.toLowerCase().includes('remove') && 
                    errorDetected.textContent?.toLowerCase().includes('current task')
                );
                
                if (hasErrorText && !activeTaskAfterFailure && !taskGameIdAfterFailure) {
                    console.log('[Better Tasker] Stale state detected: API error but no local active task. Browser may need refresh. Stopping retries to prevent loop.');
                    releaseTaskOperation();
                    await closeQuestLogIfOpen();
                    // Reset retry counter and schedule check after longer delay (5 minutes)
                    taskRemovalRetryCount = 0;
                    taskCheckTimeout = setTimeout(() => scheduleTaskCheck(), 300000); // 5 minutes
                    return;
                }
                
                if (activeTaskAfterFailure || taskGameIdAfterFailure) {
                    console.log('[Better Tasker] Active task detected after failure - will retry after removal');
                    releaseTaskOperation();
                    await closeQuestLogIfOpen();
                    // Wait a bit before rescheduling to allow task state to update
                    await sleep(2000);
                    // Re-run the check which will now detect and remove the active task (with retry protection)
                    scheduleTaskCheck();
                    return;
                }
                
                releaseTaskOperation();
                await closeQuestLogIfOpen();
                // Wait a bit before rescheduling to avoid immediate retry
                await sleep(1000);
                scheduleTaskCheck(); // Schedule next task check
                return;
            }
            
            // If in New Task+ mode OR raiding, just close quest log and return (no navigation)
            if (isNewTaskMode || isRaiding) {
                const mode = isNewTaskMode ? 'New Task+ mode' : 'raid active';
                console.log(`[Better Tasker] Task accepted (${mode}) - closing quest log, no navigation`);
                
                // Ensure Bestiary Automator settings are enabled even when not navigating
                enableBestiaryAutomatorSettings();
                
                await closeQuestLogIfOpen();
                releaseTaskOperation();
                // Reset retry counter on success
                taskRemovalRetryCount = 0;
                console.log('[Better Tasker] Task claimed successfully - retry counter reset');
                // Wait a bit before rescheduling to avoid immediate retry and allow task state to update
                await sleep(2000);
                scheduleTaskCheck(); // Schedule next task check
                return;
            }
            
            // Otherwise proceed with full automation (Enabled mode, no raid - navigate to map and start autoplay)
            console.log('[Better Tasker] Enabled mode, no raid - proceeding with navigation and autoplay...');
            const navigationResult = await navigateToSuggestedMapAndStartAutoplay();
            releaseTaskOperation();
            if (!navigationResult) {
                console.log('[Better Tasker] Navigation/autoplay start failed after task accept - will retry');
                await sleep(1000);
                scheduleTaskCheck();
            }
        } else {
            console.log('[Better Tasker] Could not open quest log - neither quest blip nor Quests button found');
            releaseTaskOperation();
        }
        
        console.log('[Better Tasker] === OPEN QUEST LOG AND ACCEPT TASK END ===');
        
    } catch (error) {
        console.error('[Better Tasker] Error opening quest log and accepting task:', error);
        console.log('[Better Tasker] === OPEN QUEST LOG AND ACCEPT TASK END (error) ===');
        releaseTaskOperation();
        // Wait a bit before rescheduling to avoid spamming
        await sleep(2000);
        cleanupTaskCompletionFailure('error opening quest log and accepting task');
    }
}

// ============================================================================
// 14. INITIALIZATION
// ============================================================================

function init() {
    console.log('[Better Tasker] Better Tasker initializing');
    
    // Register with mod coordination system
    if (window.ModCoordination) {
        window.ModCoordination.registerMod('Better Tasker', {
            priority: 90,
            metadata: { description: 'Automated task hunting system' }
        });
        
        // Subscribe to mod state changes instead of polling
        if (modCoordinationUnsubscribe) {
            modCoordinationUnsubscribe();
        }
        modCoordinationUnsubscribe = window.ModCoordination.on('modActiveChanged', (data) => {
            if (data.modName === 'Raid Hunter') {
                handleRaidHunterStateChange(data.active);
            } else if (data.modName === 'Board Analyzer' || data.modName === 'Manual Runner') {
                handleBoardAnalyzerCoordination();
            }
        });
    }
    
    // Track init time for init-phase coordination checks
    window.betterTaskerInitTime = Date.now();
    
    // Load tasker state from localStorage first
    loadTaskerState();
    
    // Update coordination system state
    if (window.ModCoordination) {
        const isEnabled = taskerState === TASKER_STATES.ENABLED || taskerState === TASKER_STATES.NEW_TASK_ONLY;
        window.ModCoordination.updateModState('Better Tasker', { enabled: isEnabled });
    }
    
    // Only set up Raid Hunter coordination if tasker is enabled
    if (taskerState === TASKER_STATES.ENABLED) {
        setupRaidHunterCoordination();
        
        // Check Raid Hunter status immediately on startup
        isRaidHunterActive = isRaidHunterRaiding();
        if (isRaidHunterActive) {
            console.log('[Better Tasker] Raid Hunter is actively raiding - automation will be paused');
        }
        
        // Set up Board Analyzer coordination
        setupBoardAnalyzerCoordination();
        
        // Check Board Analyzer status immediately on startup
        isBoardAnalyzerRunning = isBoardAnalyzerActive();
        if (isBoardAnalyzerRunning) {
            console.log('[Better Tasker] Board Analyzer is running - automation will be paused');
        }
    }
    
    // Expose initial state for other mods
    exposeTaskerState();
    
    // Always start UI monitoring to insert buttons (needed to enable/disable mod)
    startUIMonitoring();
    
    // Start automation if enabled (startAutomation also schedules task checks)
    if (taskerState === TASKER_STATES.ENABLED) {
        startAutomation();
    }
    
    // Start scheduler if in New Task+ mode (uses same logic as Enabled mode for task acceptance)
    if (taskerState === TASKER_STATES.NEW_TASK_ONLY) {
        scheduleTaskCheck();
    }
    
    console.log('[Better Tasker] Better Tasker Mod initialized.');
}

init();

// ============================================================================
// 15. CLEANUP & EXPORTS
// ============================================================================

// Cleanup function for when mod is disabled
function cleanupBetterTasker() {
    try {
        clearPendingAutomationTimeouts();
        stopNextTaskTimerUpdates();

        // Stop automation (runtime teardown + interval/autoplay cleanup)
        stopAutomation();

        // Clean up modal if open
        if (activeTaskerModal) {
            try {
                // Close modal if it has a close method
                if (typeof activeTaskerModal.close === 'function') {
                    activeTaskerModal.close();
                }
            } catch (modalError) {
                console.warn('[Better Tasker] Error closing modal:', modalError);
            }
            cleanupTaskerModal();
        }
        
        // Clean up quest log observer
        stopQuestLogMonitoring();
        
        // Clean up quest button validation and restore appearance
        stopQuestButtonValidation();
        restoreQuestButtonAppearance();

        // Clean up board state subscription
        if (isActiveStateSubscription(boardStateUnsubscribe)) {
            invokeStateSubscription(boardStateUnsubscribe);
            boardStateUnsubscribe = null;
        }
        
        // Release autoplay control
        window.AutoplayManager.releaseControl('Better Tasker');
        
        // Clean up ESC key listener
        if (escKeyListener) {
            document.removeEventListener('keydown', escKeyListener);
            escKeyListener = null;
        }
        
        // Clear all tracked timeouts
        clearTrackedTimeouts();
        
        // Clean up tracked event listeners
        trackedListeners.forEach((listeners, element) => {
            listeners.forEach(({ event, handler }) => {
                element.removeEventListener(event, handler);
            });
        });
        trackedListeners.clear();
        
        // Remove custom CSS
        const shimmerCSS = document.getElementById('taskerShimmerCSS');
        if (shimmerCSS) {
            shimmerCSS.remove();
        }
        
        // Remove buttons if they exist
        const settingsButton = document.getElementById(TASKER_BUTTON_ID);
        if (settingsButton) {
            settingsButton.remove();
        }
        
        const toggleButton = document.getElementById(TASKER_TOGGLE_ID);
        if (toggleButton) {
            toggleButton.remove();
        }
        
        // Remove button containers created by insertButtons()
        const buttonContainers = document.querySelectorAll('div[style*="display: flex"][style*="gap: 4px"][style*="margin-top: 4px"]');
        buttonContainers.forEach(container => {
            // Only remove if it contains our buttons
            if (container.querySelector(`#${TASKER_BUTTON_ID}`) || container.querySelector(`#${TASKER_TOGGLE_ID}`)) {
                container.remove();
            }
        });
        
        // Clean up global state
        if (window.betterTaskerState) {
            delete window.betterTaskerState;
        }
        if (window.cleanupBetterTasker) {
            delete window.cleanupBetterTasker;
        }
        if (window.updateWarningText) {
            delete window.updateWarningText;
        }
        
        // Release control from shared managers and clean up if no other mods need them
        try {
            if (window.QuestButtonManager) {
                window.QuestButtonManager.releaseControl('Better Tasker');
                // Reset original state to prevent memory leaks
                if (window.QuestButtonManager.originalState) {
                    window.QuestButtonManager.originalState = null;
                }
            }
        } catch (managerError) {
            console.warn('[Better Tasker] Error releasing Quest Button Manager control:', managerError);
        }
        
        try {
            if (window.BestiaryAutomatorSettingsManager) {
                window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
            }
        } catch (managerError) {
            console.warn('[Better Tasker] Error releasing Bestiary Automator Settings Manager control:', managerError);
        }
        
        try {
            if (window.AutoplayManager) {
                window.AutoplayManager.releaseControl('Better Tasker');
                // Reset original mode to prevent memory leaks
                if (window.AutoplayManager.originalMode) {
                    window.AutoplayManager.originalMode = null;
                }
            }
        } catch (managerError) {
            console.warn('[Better Tasker] Error releasing Autoplay Manager control:', managerError);
        }
        
        // Reset session flags
        resetState('full');
        // Don't reset taskNavigationCompleted in cleanup - let it persist
        
        // Unregister from coordination system
        if (modCoordinationUnsubscribe) {
            try {
                modCoordinationUnsubscribe();
            } catch (coordError) {
                console.warn('[Better Tasker] Error unsubscribing from ModCoordination:', coordError);
            }
            modCoordinationUnsubscribe = null;
        }
        if (window.ModCoordination) {
            window.ModCoordination.unregisterMod('Better Tasker');
        }

        for (const toastContainerId of ['better-tasker-toast-container', 'bt-toast-container']) {
            const toastContainer = document.getElementById(toastContainerId);
            if (toastContainer) {
                toastContainer.remove();
            }
        }

        if (window.betterTaskerInitTime) {
            delete window.betterTaskerInitTime;
        }
        if (window.betterTaskerRemovingTask) {
            delete window.betterTaskerRemovingTask;
        }

        console.log('[Better Tasker] Mod cleanup completed');
    } catch (error) {
        console.error('[Better Tasker] Error during mod cleanup:', error);
    }
}

// Expose state for other mods to check (like Raid Hunter coordination)
function exposeTaskerState() {
    if (typeof window !== 'undefined') {
        // Check if we have an active (incomplete) task so other mods can coordinate correctly
        let hasActiveTask = false;
        try {
            const playerContext = globalThis.state?.player?.getSnapshot()?.context;
            const task = playerContext?.questLog?.task;
            if (task && task.gameId) {
                const isReady = task.ready === true;
                let killTarget = DEFAULT_TASK_KILL_TARGET;
                for (const key of ['killGoal', 'targetKills', 'requiredKills', 'goal', 'maxKills', 'killTarget']) {
                    const value = Number(task[key]);
                    if (Number.isFinite(value) && value > 0) {
                        killTarget = value;
                        break;
                    }
                }
                const killCount = Number(task.killCount);
                const isCompleteByCount = Number.isFinite(killCount) && killCount >= killTarget;
                hasActiveTask = !isReady && !isCompleteByCount;
            }
        } catch (error) {
            // Ignore errors, hasActiveTask remains false
        }
        
        const isActive = taskOperationInProgress || taskHuntingOngoing || pendingTaskCompletion || hasActiveTask;
        
        window.betterTaskerState = {
            taskOperationInProgress: taskOperationInProgress,
            taskHuntingOngoing: taskHuntingOngoing,
            pendingTaskCompletion: pendingTaskCompletion,
            taskerState: taskerState,
            taskNavigationCompleted: taskNavigationCompleted,
            hasActiveTask: hasActiveTask,
            manualPlayPaused: isManualPlayPaused()
        };
        
        // Update coordination system state
        if (window.ModCoordination) {
            window.ModCoordination.updateModState('Better Tasker', { active: isActive });
        }
    }
}

// Update exposed state whenever it changes
function updateExposedState() {
    exposeTaskerState();
}

// Export functionality for external access
context.exports = {
    cleanup: cleanupBetterTasker,
    toggleTasker: toggleTasker,
    startAutomation: startAutomation,
    stopAutomation: stopAutomation,
    loadSettings: loadSettings,
    autoSaveSettings: autoSaveSettings
};