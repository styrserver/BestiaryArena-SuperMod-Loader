// Awaken Tracker — Standalone mod for Bestiary Arena
// Listens to inject CustomEvents from Autoseller and Manual Runner (`autoseller:inject:skip` / `autoseller:inject:applied`)
// and shows a draggable, resizable floating panel with per-map awaken progress, event log,
// and optional pause-on-cap behavior.

(function () {
    if (window.__awakenTrackerLoaded) return;
    window.__awakenTrackerLoaded = true;

    console.log('[Awaken Tracker] Script initialized');

    // =======================
    // 1. Constants
    // =======================
    const MOD_NAME = 'Awaken Tracker';
    const BUTTON_ID = 'mod-awaken-tracker-button';
    const PANEL_ID = 'mod-awaken-tracker-panel';
    const GRID_ID = 'mod-awaken-tracker-grid';
    const TITLE_ID = 'mod-awaken-tracker-title';

    function t(key, params) {
        let text = key;
        if (typeof api !== 'undefined' && api.i18n?.t) {
            text = api.i18n.t(key);
        } else if (typeof context !== 'undefined' && context.api?.i18n?.t) {
            text = context.api.i18n.t(key);
        }
        if (params && typeof text === 'string') {
            for (const [paramKey, value] of Object.entries(params)) {
                text = text.replaceAll(`{${paramKey}}`, String(value));
            }
        }
        return text;
    }

    function getSkipReasonLabel(reason) {
        const key = `mods.awakenTracker.skipReason.${reason}`;
        const label = t(key);
        if (label !== key) return label;
        return reason || t('mods.awakenTracker.unknown');
    }

    const OVERVIEW_VIEW_OPTIONS = [
        ['all', 'viewAll'],
        ['perfect', 'viewPerfect'],
        ['awakened', 'viewAwakened'],
        ['awakened-not-capped', 'viewAwakenedNotCapped'],
        ['capped', 'viewCapped'],
        ['missing-awaken', 'viewMissingAwaken'],
        ['missing-cap', 'viewMissingCap'],
        ['needs-both', 'viewNeedsBoth']
    ];

    const STORAGE_KEY_DATA = 'awakenTrackerData';
    const STORAGE_KEY_PANEL = 'awakenTrackerPanel';
    const STORAGE_KEY_FARMER = 'awakenTrackerFarmer';

    const LOG_LIMIT = 50;
    const CAP_VALUE = 20;
    const RENDER_DEBOUNCE_MS = 250;
    const PAUSE_DEBOUNCE_MS = 1500;
    const FARMER_MOD_NAME = 'Awaken Farmer';
    const FARMER_TICK_MS = 8000;
    // Fixed start delay — same contract as BBM / Raid Hunter / Better Tasker / Stamina Optimizer
    const DEFAULT_START_DELAY = 3; // seconds
    const DEFAULT_STAMINA_COST = 30;
    const STAMINA_REGEN_MS = 60000;
    const STAMINA_MONITOR_INTERVAL = 5000;
    const COORDINATION_RESUME_DELAY_MS = 1000;
    const MODS_LOADING_GRACE_PERIOD = 5000;
    const MAX_WAIT_FOR_SIGNAL = 15000;
    /** Sealed drops (gene injects) require red floors. */
    const AWAKEN_FARM_MIN_FLOOR = 11;
    const AWAKEN_FARM_MAX_FLOOR = 15;
    /** Just above Stamina Optimizer (5): lowest farming priority except SO is last. */
    const FARMER_PRIORITY = 6;
    const FARMER_YIELD_MODS = [
        'Manual Runner', 'Board Analyzer', 'Better Boosted Maps',
        'Raid Hunter', 'Better Tasker', 'Autoscroller'
    ];
    const FARMER_DEFAULTS = {
        enabled: false,
        autoRefillStamina: false,
        setupLabel: '',
        floor: 0,
        mapSettings: {} // roomId -> { floor?: 11-15, setupLabel?: string, autoRefillStamina?: boolean }
    };

    function getUnobtainableNames() {
        const db = window.creatureDatabase?.UNOBTAINABLE_CREATURES;
        return new Set(Array.isArray(db) ? db.map(n => n.toLowerCase()) : []);
    }

    function getNonAwakenableNames() {
        const db = window.creatureDatabase?.NON_AWAKENABLE_CREATURES;
        return new Set(Array.isArray(db) ? db.map(n => n.toLowerCase()) : []);
    }

    function isNonAwakenableName(lname) {
        return getNonAwakenableNames().has(lname) || lname.includes('gazer');
    }

    function isCreatureEligibleForAwaken(name) {
        if (!name) return false;
        const lname = String(name).toLowerCase();
        return !getUnobtainableNames().has(lname) && !isNonAwakenableName(lname);
    }

    const AWAKEN_TIER = 6;
    const STATS = ['hp', 'ad', 'ap', 'armor', 'magicResist'];
    /** Larger than max gene-sum term (100 * 100) so shiny awakened always ranks above non-shiny awakened. */
    const OVERVIEW_SHINY_AWAKENED_RANK_BOOST = 50_000;

    function overviewMonsterRank(i) {
        return (
            (i.awakened && i.capped && i.level >= 99 ? 10_000_000 : 0)
            + (i.awakened && i.capped ? 1_000_000 : 0)
            + (i.awakened ? 100_000 : 0)
            + (i.awakened && i.shiny ? OVERVIEW_SHINY_AWAKENED_RANK_BOOST : 0)
            + i.sum * 100
            + (i.shiny ? 10 : 0)
            + i.tier
        );
    }

    const PANEL_DEFAULTS = { left: 100, top: 100, width: 380, height: 500, isOpen: false, activeTab: 'tracker', hideRaids: false };
    const PANEL_LAYOUT = {
        // Floor until tabs render; syncPanelMinWidthFromTabs() raises this to fit labels.
        minWidth: 200,
        maxWidth: 1200,
        minHeight: 230,
        maxHeight: 900
    };

    const STAT_LABELS = { hp: 'HP', ad: 'AD', ap: 'AP', armor: 'ARM', magicResist: 'MR' };
    const STAT_ICON_URLS = {
        hp: '/assets/icons/heal.png',
        ad: '/assets/icons/attackdamage.png',
        ap: '/assets/icons/abilitypower.png',
        armor: '/assets/icons/armor.png',
        magicResist: '/assets/icons/magicresist.png'
    };
    const BADGE_ICONS = {
        awakened: '/assets/icons/star-tier-awaken.png',
        capped: '/assets/icons/star-tier-5.png',
        // Shiny perfect: awakened + capped + lvl 99 AND shiny.
        perfect: '/assets/icons/star-tier-shiny.png',
        // Hundo perfect: awakened + capped + lvl 99 AND NOT shiny.
        perfectHundo: '/assets/icons/star-tier-hundo.png',
        shiny: '/assets/icons/shiny-star.png'
    };
    // UI chrome — game assets (aligned with Cyclopedia / Automator)
    const UI_ICONS = {
        pauseOnCap: '/assets/icons/autoplay.png',
        customSettings: '/assets/spells/smith.png',
        drag: '/assets/icons/into.png',
        success: '/assets/icons/yes.png',
        fail: '/assets/icons/no.png',
        info: '/assets/icons/info.png',
        stamina: '/assets/icons/stamina.png',
        map: '/assets/icons/map.png'
    };

    function createUiIcon(src, size = 12, extraStyle = '') {
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.width = size;
        img.height = size;
        img.className = 'pixelated';
        img.style.cssText = `image-rendering:pixelated;width:${size}px;height:${size}px;display:block;flex-shrink:0;${extraStyle}`;
        return img;
    }

    function uiIconHtml(src, size = 12, extraStyle = '') {
        return `<img src="${src}" alt="" width="${size}" height="${size}" class="pixelated" style="image-rendering:pixelated;width:${size}px;height:${size}px;display:inline-block;vertical-align:middle;${extraStyle}" />`;
    }

    function escapeAttr(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function createHelpTip(tooltipText) {
        const tip = document.createElement('span');
        tip.className = 'at-help-tip';
        tip.title = String(tooltipText ?? '');
        tip.appendChild(createUiIcon(UI_ICONS.info, 12));
        return tip;
    }

    function helpTipHtml(tooltipText) {
        return `<span class="at-help-tip" title="${escapeAttr(tooltipText)}">${uiIconHtml(UI_ICONS.info, 12)}</span>`;
    }

    function staminaIconHtml(size = 12) {
        return uiIconHtml(UI_ICONS.stamina, size, 'vertical-align:-2px;');
    }

    // =======================
    // 2. State
    // =======================
    const state = {
        byMap: new Map(),          // roomId -> Map<gameId, entry>
        baselineStats: new Map(),  // String(monsterId) -> stats (global fallback, used for pre-capped detection)
        baselineByMap: new Map(),  // roomId -> Map<String(monsterId), stats> (per-map baseline for +N delta display)
        currentMapEnemies: [],     // [{ gameId, name }]
        currentRoomId: null,
        /**
         * Global pause-on-cap opt-outs (shared by Tracker + Overview).
         * Default is ON for every awakened, non-pre-capped species; unchecking
         * adds the gameId here. Successful pause-on-cap also opts out so it
         * does not re-trigger until the user checks again / Clear resets.
         */
        pauseOnCapOptOut: new Set(), // Set<gameId>
        collapsedOverrides: new Map(), // gameId -> boolean (user override of auto-collapse)
        orderByMap: new Map()      // roomId -> Array<gameId> (custom order per map)
    };

    function isPauseOnCapOptedOut(gameId) {
        return state.pauseOnCapOptOut.has(Number(gameId));
    }

    /** Checkbox / pause logic: default ON unless opted out (or ineligible). */
    function isPausedOnCap(gameId, awakened = null) {
        const id = Number(gameId);
        if (!Number.isFinite(id) || isPauseOnCapOptedOut(id)) return false;
        const mon = awakened || findAwakenedTargetForGameId(id);
        if (!mon) return false;
        if (getCreatureState(mon) === 'pre-capped') return false;
        return true;
    }

    function setPauseOnCap(gameId, enabled) {
        const id = Number(gameId);
        if (!Number.isFinite(id)) return;
        if (enabled) state.pauseOnCapOptOut.delete(id);
        else state.pauseOnCapOptOut.add(id);
    }

    function clearPauseOnCapOptOutsForGameIds(gameIds) {
        let changed = false;
        for (const raw of gameIds || []) {
            const id = Number(raw);
            if (!Number.isFinite(id)) continue;
            if (state.pauseOnCapOptOut.delete(id)) changed = true;
        }
        return changed;
    }

    /** Drop stale opt-ins for pre-capped creatures (pause-on-cap never applies). */
    function ensurePreCappedOptOut(gameId, awakened) {
        if (!awakened || getCreatureState(awakened) !== 'pre-capped') return false;
        const id = Number(gameId);
        if (!Number.isFinite(id) || state.pauseOnCapOptOut.has(id)) return false;
        state.pauseOnCapOptOut.add(id);
        return true;
    }

    let renderDebounceId = null;
    let boardSubscription = null;
    let lastSeenRoomId = null;

    const AWAKEN_ANALYSIS_BLOCKING_MODS = ['Board Analyzer'];
    const AWAKEN_ANALYSIS_HIDDEN_ATTR = 'data-ba-analysis-panel-hidden';
    let awakenPausedForAnalysis = false;
    let awakenAnalysisCoordinationUnsubscribe = null;
    let awakenAnalysisCoordinationSetupTimer = null;

    function isAwakenAnalysisBlockingActive() {
        if (!window.ModCoordination) return false;
        return AWAKEN_ANALYSIS_BLOCKING_MODS.some((name) => window.ModCoordination.isModActive(name));
    }

    function pauseAwakenTrackerForAnalysis() {
        if (awakenPausedForAnalysis) return;
        awakenPausedForAnalysis = true;
        console.log('[Awaken Tracker] Board Analyzer active - pausing subscriptions');
        stopFarmerLoop(true);
        teardownListeners();
        teardownBoardSub();
        teardownPlayerSub();
        const panel = document.getElementById(PANEL_ID);
        if (panel && panel.getAttribute(AWAKEN_ANALYSIS_HIDDEN_ATTR) !== '1') {
            panel.setAttribute(AWAKEN_ANALYSIS_HIDDEN_ATTR, '1');
            panel.style.setProperty('display', 'none', 'important');
        }
    }

    function resumeAwakenTrackerAfterAnalysis() {
        if (!awakenPausedForAnalysis) return;
        awakenPausedForAnalysis = false;
        console.log('[Awaken Tracker] Analysis finished - resuming');
        const panel = document.getElementById(PANEL_ID);
        if (panel?.getAttribute(AWAKEN_ANALYSIS_HIDDEN_ATTR) === '1') {
            panel.style.removeProperty('display');
            panel.removeAttribute(AWAKEN_ANALYSIS_HIDDEN_ATTR);
        }
        setupListeners();
        setupBoardSub();
        setupPlayerSub();
        // Only auto-resume farmer after boot grace (or if user already enabled mid-session).
        if (loadFarmerSettings().enabled && farmerBootGraceDone) startFarmerLoop();
        if (panel) {
            try { scheduleRender(); } catch (_) { /* ignore */ }
        }
    }

    function handleAwakenAnalysisCoordination() {
        try {
            const blocking = isAwakenAnalysisBlockingActive();
            if (blocking && !awakenPausedForAnalysis) {
                pauseAwakenTrackerForAnalysis();
            } else if (!blocking && awakenPausedForAnalysis) {
                resumeAwakenTrackerAfterAnalysis();
            }
        } catch (error) {
            console.error('[Awaken Tracker] Error in Board Analyzer coordination:', error);
        }
    }

    function setupAwakenAnalysisCoordination() {
        if (awakenAnalysisCoordinationUnsubscribe) return;
        if (!window.ModCoordination) {
            if (awakenAnalysisCoordinationSetupTimer) clearTimeout(awakenAnalysisCoordinationSetupTimer);
            awakenAnalysisCoordinationSetupTimer = setTimeout(setupAwakenAnalysisCoordination, 500);
            return;
        }
        awakenAnalysisCoordinationSetupTimer = null;
        try {
            awakenAnalysisCoordinationUnsubscribe = window.ModCoordination.on('modActiveChanged', (data) => {
                if (AWAKEN_ANALYSIS_BLOCKING_MODS.includes(data.modName)) {
                    handleAwakenAnalysisCoordination();
                }
            });
            handleAwakenAnalysisCoordination();
        } catch (error) {
            console.error('[Awaken Tracker] Analysis coordination setup failed:', error);
        }
    }

    function teardownAwakenAnalysisCoordination(options = {}) {
        if (awakenAnalysisCoordinationSetupTimer) {
            clearTimeout(awakenAnalysisCoordinationSetupTimer);
            awakenAnalysisCoordinationSetupTimer = null;
        }
        if (awakenAnalysisCoordinationUnsubscribe) {
            try { awakenAnalysisCoordinationUnsubscribe(); } catch (_) { /* ignore */ }
            awakenAnalysisCoordinationUnsubscribe = null;
        }
        if (options.restore !== false && awakenPausedForAnalysis) {
            resumeAwakenTrackerAfterAnalysis();
        } else {
            awakenPausedForAnalysis = false;
        }
    }
    let lastPauseAttemptMs = 0;
    let isDraggingSlot = false;
    let panelResizeMouseMoveHandler = null;
    let panelResizeMouseUpHandler = null;
    let panelViewportListenerAttached = false;

    const panelResizeState = {
        isResizing: false,
        resizeDir: '',
        resizeStartX: 0,
        resizeStartY: 0,
        startWidth: 0,
        startHeight: 0,
        startLeft: 0,
        startTop: 0,
        reset() {
            this.isResizing = false;
            this.resizeDir = '';
            this.resizeStartX = 0;
            this.resizeStartY = 0;
            this.startWidth = 0;
            this.startHeight = 0;
            this.startLeft = 0;
            this.startTop = 0;
        }
    };

    const activeConfirmButtonResets = new Set();

    function clampPanelSize(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    /** Raise panel min-width so tab labels are never clipped (locale-aware). */
    function syncPanelMinWidthFromTabs(panel) {
        if (!panel) return PANEL_LAYOUT.minWidth;
        const tabBar = panel.querySelector('.at-tab-bar');
        if (!tabBar) return PANEL_LAYOUT.minWidth;

        const buttons = [...tabBar.querySelectorAll('.at-tab-btn')];
        const restores = buttons.map((btn) => ({
            flex: btn.style.flex,
            width: btn.style.width,
            minWidth: btn.style.minWidth
        }));
        for (const btn of buttons) {
            btn.style.flex = '0 0 auto';
            btn.style.width = 'max-content';
            btn.style.minWidth = 'max-content';
        }

        let tabsWidth = 0;
        for (const btn of buttons) {
            tabsWidth += btn.offsetWidth;
        }

        buttons.forEach((btn, i) => {
            btn.style.flex = restores[i].flex;
            btn.style.width = restores[i].width;
            btn.style.minWidth = restores[i].minWidth;
        });

        const frame = panel.querySelector('.at-panel-frame');
        const frameStyle = frame ? getComputedStyle(frame) : null;
        const borderX = frameStyle
            ? (parseFloat(frameStyle.borderLeftWidth) || 0) + (parseFloat(frameStyle.borderRightWidth) || 0)
            : 12;
        const tabBarStyle = getComputedStyle(tabBar);
        const marginX = (parseFloat(tabBarStyle.marginLeft) || 0) + (parseFloat(tabBarStyle.marginRight) || 0);

        const measured = Math.ceil(tabsWidth + borderX + marginX);
        PANEL_LAYOUT.minWidth = Math.max(measured, 1);
        panel.style.minWidth = PANEL_LAYOUT.minWidth + 'px';

        const currentWidth = parseInt(panel.style.width, 10) || panel.offsetWidth || 0;
        if (currentWidth < PANEL_LAYOUT.minWidth) {
            panel.style.width = PANEL_LAYOUT.minWidth + 'px';
        }
        return PANEL_LAYOUT.minWidth;
    }

    // Expose for debugging
    window.AwakenTrackerState = state;

    // =======================
    // 3. Local helpers
    // =======================
    function isAwakenedCreatureLocal(monster) {
        if (!monster) return false;
        const tier = Number(monster.tier ?? monster.metadata?.tier);
        if (tier === 6) return true;
        return monster.awaken === true || monster.awakened === true || monster.isAwakened === true;
    }

    function getMonsterGeneStatsLocal(monster) {
        if (!monster || typeof monster !== 'object') {
            return { hp: 0, ad: 0, ap: 0, armor: 0, magicResist: 0 };
        }
        const genes = monster.genes || monster.stats || {};
        return {
            hp: Number(monster.hp ?? genes.hp ?? 0),
            ad: Number(monster.ad ?? genes.ad ?? 0),
            ap: Number(monster.ap ?? genes.ap ?? 0),
            armor: Number(monster.armor ?? genes.armor ?? 0),
            magicResist: Number(monster.magicResist ?? monster.mr ?? genes.magicResist ?? genes.mr ?? 0)
        };
    }

    function findAwakenedTargetForGameId(gameId) {
        const monsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters || [];
        const matches = monsters.filter(m => {
            if (!m || !isAwakenedCreatureLocal(m)) return false;
            const mid = Number(m?.gameId ?? m?.metadata?.id);
            return Number.isFinite(mid) && mid === Number(gameId);
        });
        if (matches.length === 0) return null;
        return matches.sort((a, b) => {
            const sa = getMonsterGeneStatsLocal(a);
            const sb = getMonsterGeneStatsLocal(b);
            return (sb.hp + sb.ad + sb.ap + sb.armor + sb.magicResist)
                 - (sa.hp + sa.ad + sa.ap + sa.armor + sa.magicResist);
        })[0];
    }

    const nameCache = new Map();
    function resolveName(gameId) {
        if (nameCache.has(gameId)) return nameCache.get(gameId);
        let name = `#${gameId}`;
        try {
            name = globalThis.state?.utils?.getMonster?.(gameId)?.metadata?.name
                || window.creatureDatabase?.findMonsterByGameId?.(gameId)?.name
                || name;
        } catch (_) {}
        nameCache.set(gameId, name);
        return name;
    }

    function isAwakenedCappedStats(stats) {
        if (!stats || typeof stats !== 'object') return false;
        return STATS.every(k => Number(stats[k]) >= CAP_VALUE);
    }

    // 'pre-capped' = came capped from the baseline (not earned in this run)
    // 'capped'     = current stats are capped, but the baseline was not (capped in this run)
    // 'active'     = current stats are not capped
    // 'no-awaken'  = creature has not been awakened yet
    function getCreatureState(awakened) {
        if (!awakened) return 'no-awaken';
        const stats = getMonsterGeneStatsLocal(awakened);
        if (!isAwakenedCappedStats(stats)) return 'active';
        const baseline = state.baselineStats.get(String(awakened.id));
        if (baseline && isAwakenedCappedStats(baseline)) return 'pre-capped';
        return 'capped';
    }

    function isSlotCollapsed(gameId, creatureState) {
        const override = state.collapsedOverrides.get(Number(gameId));
        if (override !== undefined) return override === true;
        // Auto-collapse for pre-capped and capped; expanded for active/no-awaken
        return creatureState === 'pre-capped' || creatureState === 'capped';
    }

    // FLIP animation: snapshot positions before mutation, then animate the delta back to 0
    function flipReorder(container, mutator) {
        const slots = Array.from(container.querySelectorAll('.awaken-tracker-slot'));
        const firstPositions = new Map();
        for (const s of slots) {
            if (s.classList.contains('dragging')) continue;
            firstPositions.set(s, s.getBoundingClientRect().top);
        }
        mutator();
        for (const [s, oldTop] of firstPositions) {
            const newTop = s.getBoundingClientRect().top;
            const dy = oldTop - newTop;
            if (dy === 0) continue;
            s.style.transition = 'none';
            s.style.transform = `translateY(${dy}px)`;
            void s.offsetHeight; // force reflow so transform applies before transition
            requestAnimationFrame(() => {
                s.style.transition = 'transform 180ms ease';
                s.style.transform = '';
            });
        }
    }

    function persistOrderFromDOM() {
        const grid = document.getElementById(GRID_ID);
        if (!grid) return;
        const roomId = state.currentRoomId;
        if (!roomId) return;
        const order = Array.from(grid.querySelectorAll('.awaken-tracker-slot'))
            .map(s => Number(s.dataset.gameId))
            .filter(Number.isFinite);
        if (order.length === 0) return;
        state.orderByMap.set(roomId, order);
        scheduleSave();
    }

    function getOrderedEnemies() {
        const enemies = state.currentMapEnemies || [];
        const roomId = state.currentRoomId;
        if (!roomId) return enemies;
        const order = state.orderByMap.get(roomId);
        if (!Array.isArray(order) || order.length === 0) return enemies;
        const indexMap = new Map();
        order.forEach((gid, i) => indexMap.set(Number(gid), i));
        return [...enemies].sort((a, b) => {
            const ai = indexMap.has(Number(a.gameId)) ? indexMap.get(Number(a.gameId)) : Infinity;
            const bi = indexMap.has(Number(b.gameId)) ? indexMap.get(Number(b.gameId)) : Infinity;
            return ai - bi;
        });
    }

    // =======================
    // 4. Persistence
    // =======================
    function saveData() {
        try {
            const serializedByMap = Array.from(state.byMap.entries()).map(([rid, inner]) => [
                rid,
                inner instanceof Map ? Array.from(inner.entries()) : []
            ]);
            const serializedBaselineByMap = Array.from(state.baselineByMap.entries()).map(([rid, inner]) => [
                rid,
                inner instanceof Map ? Array.from(inner.entries()) : []
            ]);
            const payload = {
                byMap: serializedByMap,
                baselineStats: Array.from(state.baselineStats.entries()),
                baselineByMap: serializedBaselineByMap,
                currentMapEnemies: state.currentMapEnemies,
                currentRoomId: state.currentRoomId,
                pauseOnCapOptOut: Array.from(state.pauseOnCapOptOut),
                collapsedOverrides: Array.from(state.collapsedOverrides.entries()),
                orderByMap: Array.from(state.orderByMap.entries())
            };
            localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(payload));
        } catch (e) {
            console.warn('[Awaken Tracker] saveData failed:', e);
        }
    }

    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_DATA);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.byMap)) {
                state.byMap = new Map();
                for (const [rid, innerArr] of parsed.byMap) {
                    state.byMap.set(rid, new Map(Array.isArray(innerArr) ? innerArr : []));
                }
            }
            if (Array.isArray(parsed.baselineStats)) {
                state.baselineStats = new Map(parsed.baselineStats);
            }
            if (Array.isArray(parsed.baselineByMap)) {
                state.baselineByMap = new Map();
                for (const [rid, innerArr] of parsed.baselineByMap) {
                    state.baselineByMap.set(rid, new Map(Array.isArray(innerArr) ? innerArr : []));
                }
            }
            if (Array.isArray(parsed.currentMapEnemies)) {
                state.currentMapEnemies = parsed.currentMapEnemies;
            }
            if (typeof parsed.currentRoomId === 'string' || parsed.currentRoomId === null) {
                state.currentRoomId = parsed.currentRoomId;
            }
            // Pause-on-cap is global default-ON with opt-outs (shared Tracker + Overview).
            if (Array.isArray(parsed.pauseOnCapOptOut)) {
                state.pauseOnCapOptOut = new Set(parsed.pauseOnCapOptOut.map(Number).filter(Number.isFinite));
            } else if (Array.isArray(parsed.pauseOnCapOptOutByMap)) {
                // Migrate per-map opt-outs → union into global opt-out set
                const merged = new Set();
                for (const [, arr] of parsed.pauseOnCapOptOutByMap) {
                    if (!Array.isArray(arr)) continue;
                    for (const id of arr) {
                        const n = Number(id);
                        if (Number.isFinite(n)) merged.add(n);
                    }
                }
                state.pauseOnCapOptOut = merged;
            } else {
                state.pauseOnCapOptOut = new Set();
            }
            if (Array.isArray(parsed.collapsedOverrides)) {
                state.collapsedOverrides = new Map(parsed.collapsedOverrides);
            }
            if (Array.isArray(parsed.orderByMap)) {
                state.orderByMap = new Map(parsed.orderByMap);
            }
        } catch (e) {
            console.warn('[Awaken Tracker] loadData failed:', e);
        }
    }

    let saveDebounceId = null;
    function scheduleSave() {
        if (saveDebounceId) clearTimeout(saveDebounceId);
        saveDebounceId = setTimeout(() => {
            saveDebounceId = null;
            saveData();
        }, 500);
    }

    function loadPanelSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PANEL);
            if (!raw) return { ...PANEL_DEFAULTS };
            const p = JSON.parse(raw);
            return {
                left: Number.isFinite(Number(p.left)) ? Number(p.left) : PANEL_DEFAULTS.left,
                top: Number.isFinite(Number(p.top)) ? Number(p.top) : PANEL_DEFAULTS.top,
                width: Number.isFinite(Number(p.width)) ? Number(p.width) : PANEL_DEFAULTS.width,
                height: Number.isFinite(Number(p.height)) ? Number(p.height) : PANEL_DEFAULTS.height,
                isOpen: p.isOpen === true,
                activeTab: ['tracker', 'overview', 'farmer'].includes(p.activeTab) ? p.activeTab : 'tracker',
                hideRaids: p.hideRaids === true
            };
        } catch (e) {
            return { ...PANEL_DEFAULTS };
        }
    }

    function savePanelSettings(partial) {
        try {
            const current = loadPanelSettings();
            const next = { ...current, ...partial };
            localStorage.setItem(STORAGE_KEY_PANEL, JSON.stringify(next));
        } catch (e) {}
    }

    // =======================
    // 5. Baseline
    // =======================
    function snapshotBaseline() {
        try {
            const monsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters || [];
            state.baselineStats.clear();
            for (const m of monsters) {
                if (!m || !m.id || !isAwakenedCreatureLocal(m)) continue;
                state.baselineStats.set(String(m.id), getMonsterGeneStatsLocal(m));
            }
            scheduleSave();
        } catch (e) {
            console.warn('[Awaken Tracker] snapshotBaseline failed:', e);
        }
    }

    // Per-map baseline: captures awaken stats for monsters matching current map enemies,
    // only on first visit to the map (or after Clear). Used for +N delta display per map.
    function ensureMapBaseline(roomId) {
        if (!roomId) return;
        if (state.baselineByMap.has(roomId)) return;
        try {
            const enemyIds = new Set((state.currentMapEnemies || [])
                .map(e => Number(e?.gameId))
                .filter(Number.isFinite));
            if (enemyIds.size === 0) return;
            const monsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters || [];
            const inner = new Map();
            for (const m of monsters) {
                if (!m || !m.id || !isAwakenedCreatureLocal(m)) continue;
                const gid = Number(m?.gameId ?? m?.metadata?.id);
                if (!enemyIds.has(gid)) continue;
                inner.set(String(m.id), getMonsterGeneStatsLocal(m));
            }
            state.baselineByMap.set(roomId, inner);
            scheduleSave();
        } catch (e) {
            console.warn('[Awaken Tracker] ensureMapBaseline failed:', e);
        }
    }

    function getBaselineForCurrentMap(monsterId) {
        const rid = state.currentRoomId;
        if (rid) {
            const mapBaseline = state.baselineByMap.get(rid);
            if (mapBaseline && mapBaseline.has(String(monsterId))) {
                return mapBaseline.get(String(monsterId));
            }
        }
        return state.baselineStats.get(String(monsterId)) || null;
    }

    // =======================
    // 6. Event handlers (from Autoseller CustomEvents)
    // =======================
    function ensureEntry(gameId, roomId) {
        const gKey = Number(gameId);
        if (!Number.isFinite(gKey)) return null;
        const rKey = roomId || state.currentRoomId;
        if (!rKey) return null;
        if (!state.byMap.has(rKey)) state.byMap.set(rKey, new Map());
        const inner = state.byMap.get(rKey);
        if (!inner.has(gKey)) {
            inner.set(gKey, { injects: 0, skips: 0, skipReasons: {}, lastEvent: null, eventLog: [] });
        }
        return inner.get(gKey);
    }

    function pushEventLog(entry, eventObj) {
        if (!entry || !eventObj) return;
        if (!Array.isArray(entry.eventLog)) entry.eventLog = [];
        entry.eventLog.unshift(eventObj);
        if (entry.eventLog.length > LOG_LIMIT) entry.eventLog.length = LOG_LIMIT;
    }

    function scheduleRender() {
        if (renderDebounceId) clearTimeout(renderDebounceId);
        renderDebounceId = setTimeout(() => {
            renderDebounceId = null;
            render();
        }, RENDER_DEBOUNCE_MS);
    }

    function onAutosellerSkip(ev) {
        const d = ev?.detail || {};
        const entry = ensureEntry(d.gameId);
        if (!entry) return;
        entry.skips += 1;
        const r = String(d.reason || 'unknown');
        entry.skipReasons[r] = (entry.skipReasons[r] || 0) + 1;
        const eventObj = {
            type: 'skip',
            timestamp: Date.now(),
            reason: r,
            candidateStats: d.candidate?.stats || {}
        };
        entry.lastEvent = eventObj;
        pushEventLog(entry, eventObj);
        checkAndPauseIfCapped(d.gameId, null);
        scheduleRender();
        scheduleSave();
    }

    function onAutosellerApplied(ev) {
        const d = ev?.detail || {};
        const entry = ensureEntry(d.gameId);
        if (!entry) return;
        entry.injects += 1;
        const eventObj = {
            type: 'applied',
            timestamp: Date.now(),
            gains: d.gains || {},
            candidateStats: d.candidate || {}
        };
        entry.lastEvent = eventObj;
        pushEventLog(entry, eventObj);
        checkAndPauseIfCapped(d.gameId, d.after);
        scheduleRender();
        scheduleSave();
    }

    let listenersBound = false;
    function setupListeners() {
        if (listenersBound) return;
        window.addEventListener('autoseller:inject:skip', onAutosellerSkip);
        window.addEventListener('autoseller:inject:applied', onAutosellerApplied);
        listenersBound = true;
    }

    function teardownListeners() {
        if (!listenersBound) return;
        window.removeEventListener('autoseller:inject:skip', onAutosellerSkip);
        window.removeEventListener('autoseller:inject:applied', onAutosellerApplied);
        listenersBound = false;
    }

    // =======================
    // 7. Map subscriber
    // =======================
    function resolveCurrentRoomId() {
        const boardCtx = globalThis.state?.board?.getSnapshot?.()?.context || {};
        const playerCtx = globalThis.state?.player?.getSnapshot?.()?.context || {};
        return (boardCtx.selectedMap && boardCtx.selectedMap.selectedRoom && boardCtx.selectedMap.selectedRoom.id)
            || (boardCtx.selectedMap && boardCtx.selectedMap.id)
            || (boardCtx.area && boardCtx.area.id)
            || playerCtx.currentRoomId
            || null;
    }

    function updateCurrentMapEnemies() {
        try {
            const roomId = resolveCurrentRoomId();
            state.currentRoomId = roomId || null;
            if (!roomId) {
                state.currentMapEnemies = [];
                scheduleRender();
                return;
            }
            const getBoardMonsters = globalThis.state?.utils?.getBoardMonstersFromRoomId;
            if (typeof getBoardMonsters !== 'function') {
                state.currentMapEnemies = [];
                scheduleRender();
                return;
            }
            const monsters = getBoardMonsters(roomId) || [];
            const dedup = new Map();
            for (const piece of monsters) {
                if (!piece || piece.villain !== true) continue;
                const gameId = Number(piece.gameId);
                if (!Number.isFinite(gameId)) continue;
                if (!dedup.has(gameId)) {
                    const name = resolveName(gameId);
                    if (!isCreatureEligibleForAwaken(name)) continue;
                    dedup.set(gameId, { gameId, name });
                }
            }
            state.currentMapEnemies = Array.from(dedup.values());
            ensureMapBaseline(roomId);
            scheduleRender();
            scheduleSave();
        } catch (e) {
            console.warn('[Awaken Tracker] updateCurrentMapEnemies failed:', e);
        }
    }

    function setupBoardSub() {
        if (boardSubscription) return;
        if (awakenPausedForAnalysis || isAwakenAnalysisBlockingActive()) return;
        const board = globalThis.state?.board;
        if (!board || typeof board.subscribe !== 'function') return;
        boardSubscription = board.subscribe(() => {
            if (awakenPausedForAnalysis) return;
            const roomId = resolveCurrentRoomId();
            if (roomId !== lastSeenRoomId) {
                lastSeenRoomId = roomId;
                updateCurrentMapEnemies();
                if (typeof farmerRuntime.uiRefresh === 'function') farmerRuntime.uiRefresh();
            }
        });
        lastSeenRoomId = resolveCurrentRoomId();
        updateCurrentMapEnemies();
    }

    function teardownBoardSub() {
        if (boardSubscription) {
            try { boardSubscription.unsubscribe?.(); } catch (e) {}
            boardSubscription = null;
        }
        lastSeenRoomId = null;
    }

    // Light subscription to player state: re-render with heavy debounce when inventory changes
    // (e.g. user just awakened a creature). Render is skipped when panel is hidden.
    let playerSubscription = null;
    let playerRenderDebounceId = null;
    function setupPlayerSub() {
        if (playerSubscription) return;
        if (awakenPausedForAnalysis || isAwakenAnalysisBlockingActive()) return;
        const player = globalThis.state?.player;
        if (!player || typeof player.subscribe !== 'function') return;
        playerSubscription = player.subscribe(() => {
            if (awakenPausedForAnalysis) return;
            if (playerRenderDebounceId) clearTimeout(playerRenderDebounceId);
            playerRenderDebounceId = setTimeout(() => {
                playerRenderDebounceId = null;
                // Inventory caught up after an inject: retry pause-on-cap in case the
                // earlier event ran before stats were visible or the pause button was missing.
                try {
                    for (const enemy of state.currentMapEnemies || []) {
                        const gid = Number(enemy?.gameId);
                        if (!Number.isFinite(gid) || !isPausedOnCap(gid)) continue;
                        checkAndPauseIfCapped(gid, null);
                        if (!isPausedOnCap(gid)) break; // opted out after successful pause
                    }
                } catch (_) { /* ignore */ }
                if (loadFarmerSettings().enabled && farmerBootGraceDone) {
                    try { farmerRunTick(); } catch (_) { /* ignore */ }
                }
                const panel = document.getElementById(PANEL_ID);
                if (panel && panel.style.display !== 'none') render();
                if (typeof farmerRuntime.uiRefresh === 'function') farmerRuntime.uiRefresh();
            }, 1500);
        });
    }

    function teardownPlayerSub() {
        if (playerSubscription) {
            try { playerSubscription.unsubscribe?.(); } catch (e) {}
            playerSubscription = null;
        }
        if (playerRenderDebounceId) {
            clearTimeout(playerRenderDebounceId);
            playerRenderDebounceId = null;
        }
    }

    // =======================
    // 8. Pause-on-cap
    // =======================
    function tryPauseGameAutoplay() {
        try {
            const selectors = [
                'button:has(svg.lucide-pause)',
                'button.frame-1-red:has(svg.lucide-pause)',
                'button[class*="surface-red"]:has(svg.lucide-pause)'
            ];
            let button = null;
            for (const sel of selectors) {
                try { button = document.querySelector(sel); } catch (e) {}
                if (button) break;
            }
            if (!button) {
                const flexContainers = document.querySelectorAll('div.flex');
                for (const fc of flexContainers) {
                    const btns = fc.querySelectorAll('button');
                    if (btns.length >= 2 && btns[1].querySelector('svg.lucide-pause')) {
                        button = btns[1];
                        break;
                    }
                }
            }
            if (button) {
                button.click();
                console.log('[Awaken Tracker] Pause button clicked (awaken capped)');
                return true;
            }
            console.warn('[Awaken Tracker] Pause button not found');
            return false;
        } catch (e) {
            console.warn('[Awaken Tracker] tryPauseGameAutoplay failed:', e);
            return false;
        }
    }

    function resolveTriggeredCapStats(gameId, statsFromEvent) {
        const triggeredAwaken = findAwakenedTargetForGameId(gameId);
        const liveStats = triggeredAwaken ? getMonsterGeneStatsLocal(triggeredAwaken) : null;
        // Prefer whichever source already shows a full cap. Live inventory can lag the
        // inject event's `after` payload (and vice versa after a local optimistic sync).
        if (isAwakenedCappedStats(liveStats)) return liveStats;
        if (isAwakenedCappedStats(statsFromEvent)) return statsFromEvent;
        return liveStats || statsFromEvent || null;
    }

    function checkAndPauseIfCapped(gameId, statsFromEvent) {
        try {
            const triggeredId = Number(gameId);
            if (!isPausedOnCap(triggeredId)) return;
            const triggeredStats = resolveTriggeredCapStats(triggeredId, statsFromEvent);
            if (!isAwakenedCappedStats(triggeredStats)) return;

            const markedOnMap = (state.currentMapEnemies || [])
                .map(e => Number(e?.gameId))
                .filter(g => Number.isFinite(g) && isPausedOnCap(g));
            if (markedOnMap.length === 0) return;

            const allCapped = markedOnMap.every(g => {
                if (g === triggeredId) return true; // already verified via resolveTriggeredCapStats
                const aw = findAwakenedTargetForGameId(g);
                return aw && isAwakenedCappedStats(getMonsterGeneStatsLocal(aw));
            });
            if (!allCapped) return;

            const now = Date.now();
            if (now - lastPauseAttemptMs < PAUSE_DEBOUNCE_MS) return;
            lastPauseAttemptMs = now;
            console.log('[Awaken Tracker] All marked creatures on map are capped — pausing. Marked:', markedOnMap);
            const paused = tryPauseGameAutoplay();
            // Only consume marks after a successful pause click. If the pause button was
            // missing (e.g. between runs), keep the marks so a later inject/skip can retry.
            // Without consume-on-success, every subsequent autoseller event re-triggers pause.
            if (!paused) return;
            markedOnMap.forEach(g => setPauseOnCap(g, false)); // opt out = consume mark
            scheduleSave();
            scheduleRender();
        } catch (e) {
            console.warn('[Awaken Tracker] checkAndPauseIfCapped failed:', e);
        }
    }

    // =======================
    // 9. UI — slot rendering
    // =======================
    // Color by total gene-sum range (0-100), same tier scale as Hunt Analyzer.
    // 80+ Legendary, 70+ Epic, 60+ Rare, 50+ Uncommon, 5+ Common.
    // Palette is tuned for this dark panel: blue/purple are brighter than the
    // One Dark defaults so they stay readable as text on a darker background.
    function getGeneSumRarity(total) {
        const t = Number(total) || 0;
        if (t >= 80) return { rarity: 5, color: '#E5C07B' }; // Legendary - gold
        if (t >= 70) return { rarity: 4, color: '#C77DFF' }; // Epic - bright violet
        if (t >= 60) return { rarity: 3, color: '#54B9FF' }; // Rare - bright sky blue
        if (t >= 50) return { rarity: 2, color: '#98C379' }; // Uncommon - green
        return { rarity: 1, color: '#ABB2BF' };              // Common - light gray
    }

    function getStatTotalColor(total) {
        return getGeneSumRarity(total).color;
    }

    function renderStatIconHtml(key, size = 12, verticalAlign = 'middle') {
        return `<img src="${STAT_ICON_URLS[key]}" alt="${STAT_LABELS[key]}" title="${STAT_LABELS[key]}" style="width:${size}px;height:${size}px;vertical-align:${verticalAlign};image-rendering:pixelated;" />`;
    }

    function badgeImg(src, alt, active, size = 14) {
        const opacity = active ? '1' : '0.2';
        return `<img src="${src}" alt="${alt}" title="${alt}" style="display:inline !important;width:${size}px;height:${size}px;image-rendering:pixelated;vertical-align:-2px;opacity:${opacity};" />`;
    }

    // Minimal badge: just an X/5 counter
    function buildStateBadge(gameId, stats) {
        const badge = document.createElement('span');
        if (!stats) {
            badge.style.cssText = 'font-size:10px;font-weight:bold;color:#888;background:rgba(80,80,80,0.15);border:1px solid rgba(120,120,120,0.3);border-radius:3px;padding:1px 5px;white-space:nowrap;';
            badge.textContent = '—/5';
            return badge;
        }
        const cappedCount = STATS.filter(k => Number(stats[k]) >= CAP_VALUE).length;
        const isFullyCapped = cappedCount === 5;
        const color  = isFullyCapped ? '#7fde7f' : '#ddd';
        const bg     = isFullyCapped ? 'rgba(127,222,127,0.10)' : 'rgba(255,255,255,0.04)';
        const border = isFullyCapped ? 'rgba(127,222,127,0.30)' : 'rgba(255,255,255,0.15)';
        badge.style.cssText = `font-size:10px;font-weight:bold;color:${color};background:${bg};border:1px solid ${border};border-radius:3px;padding:1px 5px;white-space:nowrap;font-family:monospace;`;
        badge.textContent = `${cappedCount}/5`;
        return badge;
    }

    function buildDragHandle(slot) {
        const handle = document.createElement('span');
        handle.title = t('mods.awakenTracker.dragToReorder');
        handle.style.cssText = 'cursor:grab;padding:0 2px;user-select:none;flex:0 0 auto;display:inline-flex;flex-direction:column;gap:1px;align-items:center;opacity:0.55;';
        handle.appendChild(createUiIcon(UI_ICONS.drag, 5, 'transform:rotate(90deg);'));
        handle.appendChild(createUiIcon(UI_ICONS.drag, 5, 'transform:rotate(90deg);'));
        handle.appendChild(createUiIcon(UI_ICONS.drag, 5, 'transform:rotate(90deg);'));
        handle.addEventListener('mousedown', () => { slot.draggable = true; });
        handle.addEventListener('mouseup', () => { setTimeout(() => { slot.draggable = false; }, 50); });
        handle.addEventListener('mouseenter', () => { handle.style.opacity = '1'; });
        handle.addEventListener('mouseleave', () => { handle.style.opacity = '0.55'; });
        return handle;
    }

    function buildToggleArrow(gameId, isCollapsed) {
        const arrow = document.createElement('span');
        arrow.textContent = isCollapsed ? '▶' : '▼';
        arrow.title = isCollapsed ? t('mods.awakenTracker.expand') : t('mods.awakenTracker.collapse');
        arrow.style.cssText = 'cursor:pointer;color:#aaa;font-size:9px;padding:0 2px;user-select:none;flex:0 0 auto;';
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            state.collapsedOverrides.set(Number(gameId), !isCollapsed);
            scheduleSave();
            render();
        });
        return arrow;
    }

    function buildCapToggleLabel(gameId, awakened, alreadyCapped) {
        const isMarked = isPausedOnCap(gameId, awakened);
        const capToggleLabel = document.createElement('label');
        capToggleLabel.style.cssText = 'display:inline-flex;align-items:center;gap:3px;font-size:11px;flex:0 0 auto;';
        const capToggleInput = document.createElement('input');
        capToggleInput.type = 'checkbox';
        capToggleInput.checked = isMarked;
        capToggleInput.style.cssText = 'margin:0;';
        if (!awakened) {
            capToggleInput.checked = false;
            capToggleInput.disabled = true;
            capToggleLabel.title = t('mods.awakenTracker.awakenFirst');
            capToggleLabel.style.opacity = '0.4';
            capToggleLabel.style.cursor = 'not-allowed';
            capToggleInput.style.cursor = 'not-allowed';
        } else if (alreadyCapped) {
            // Pre-capped (already 5/5 at session baseline): opt out — pause-on-cap
            // was never going to fire for these. Do NOT opt out creatures that capped
            // during this run; that could beat checkAndPauseIfCapped (or wipe the mark
            // after a failed pause click), so autoplay never stopped.
            if (ensurePreCappedOptOut(gameId, awakened)) scheduleSave();
            const stillMarked = isPausedOnCap(gameId, awakened);
            capToggleInput.checked = stillMarked;
            capToggleInput.disabled = true;
            capToggleLabel.title = stillMarked
                ? t('mods.awakenTracker.pauseOnCap')
                : t('mods.awakenTracker.alreadyFullyCapped');
            capToggleLabel.style.opacity = stillMarked ? '1' : '0.4';
            capToggleLabel.style.cursor = 'not-allowed';
            capToggleInput.style.cursor = 'not-allowed';
        } else {
            capToggleLabel.title = t('mods.awakenTracker.pauseOnCap');
            capToggleLabel.style.opacity = isMarked ? '1' : '0.6';
            capToggleLabel.style.cursor = 'pointer';
            capToggleInput.style.cursor = 'pointer';
            capToggleInput.addEventListener('change', (e) => {
                setPauseOnCap(gameId, e.target.checked);
                capToggleLabel.style.opacity = e.target.checked ? '1' : '0.6';
                scheduleSave();
            });
        }
        capToggleLabel.appendChild(capToggleInput);
        capToggleLabel.appendChild(createUiIcon(UI_ICONS.pauseOnCap, 12));
        return capToggleLabel;
    }

    function attachDragDropToSlot(slot, gameId) {
        slot.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(gameId));
            isDraggingSlot = true;
            slot.style.opacity = '0.4';
            // setTimeout so the drag "ghost" (browser snapshot) is captured before the class is applied
            setTimeout(() => slot.classList.add('dragging'), 0);
        });
        slot.addEventListener('dragend', () => {
            isDraggingSlot = false;
            slot.draggable = false;
            slot.classList.remove('dragging');
            slot.style.opacity = '1';
            persistOrderFromDOM();
        });
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const grid = slot.parentNode;
            if (!grid) return;
            const dragging = grid.querySelector('.awaken-tracker-slot.dragging');
            if (!dragging || dragging === slot) return;
            const rect = slot.getBoundingClientRect();
            const middleY = rect.top + rect.height / 2;
            const shouldGoBefore = e.clientY < middleY;
            const targetNext = shouldGoBefore ? slot : slot.nextSibling;
            // Avoid reordering when the dragged item is already at the target position
            if (dragging.nextSibling === targetNext) return;
            flipReorder(grid, () => grid.insertBefore(dragging, targetNext));
        });
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
        });
    }

    function createSlot({ gameId, name }, options = {}) {
        const awakened = findAwakenedTargetForGameId(gameId);
        const stats = awakened ? getMonsterGeneStatsLocal(awakened) : null;
        const alreadyCapped = stats ? isAwakenedCappedStats(stats) : false;
        const creatureState = getCreatureState(awakened);
        const collapsed = isSlotCollapsed(gameId, creatureState);

        const slot = document.createElement('div');
        slot.className = `at-row awaken-tracker-slot state-${creatureState} ${collapsed ? 'collapsed' : 'expanded'}`;
        slot.dataset.gameId = String(gameId);
        attachDragDropToSlot(slot, gameId);

        // ===== Header (sempre presente) =====
        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:6px;';

        header.appendChild(buildDragHandle(slot));
        header.appendChild(buildToggleArrow(gameId, collapsed));

        const portraitSize = collapsed ? 22 : 32;
        const portrait = document.createElement('img');
        portrait.src = `/assets/portraits/${gameId}.png`;
        portrait.alt = name;
        portrait.style.cssText = `width:${portraitSize}px;height:${portraitSize}px;image-rendering:pixelated;flex:0 0 auto;`;
        if (!awakened) portrait.style.filter = 'grayscale(100%) opacity(0.5)';
        header.appendChild(portrait);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        nameSpan.style.cssText = `flex:1 1 auto;font-weight:bold;font-size:${collapsed ? '11px' : '12px'};min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
        header.appendChild(nameSpan);

        header.appendChild(buildStateBadge(gameId, stats));
        header.appendChild(buildCapToggleLabel(gameId, awakened, alreadyCapped));

        slot.appendChild(header);

        // ===== Collapsed mode: stop here =====
        if (collapsed) {
            return slot;
        }

        // ===== Modo expandido: corpo completo =====
        if (!awakened) {
            const noAwaken = document.createElement('div');
            noAwaken.textContent = t('mods.awakenTracker.noAwaken');
            noAwaken.style.cssText = 'opacity:0.6;font-size:12px;padding-left:4px;';
            slot.appendChild(noAwaken);
            return slot;
        }

        const baseline = getBaselineForCurrentMap(awakened.id);

        const renderStatPair = (key) => {
            const cur = stats[key];
            const delta = baseline ? (cur - baseline[key]) : 0;
            const deltaStr = delta > 0 ? ` <span style="color:#7fde7f;font-weight:bold;">+${delta}</span>` : '';
            return `<span style="display:inline-flex;align-items:center;gap:3px;">${renderStatIconHtml(key, 13)} <span style="color:#ffe066;">${cur}</span>${deltaStr}</span>`;
        };

        const statsLine = document.createElement('div');
        statsLine.style.cssText = 'font-family:monospace;font-size:12px;display:flex;flex-wrap:wrap;column-gap:10px;row-gap:2px;padding:2px 0;';
        statsLine.innerHTML = STATS.map(renderStatPair).join('');
        slot.appendChild(statsLine);

        const entry = (state.currentRoomId && state.byMap.get(state.currentRoomId)?.get(Number(gameId))) || null;
        const ev = entry?.lastEvent;
        if (ev) {
            const cs = ev.candidateStats || {};
            const hasStats = Number.isFinite(Number(cs.hp));
            const renderCandidateStat = (key) => {
                const v = cs[key];
                if (v === undefined || v === null) return '';
                const awakenVal = stats[key];
                const isHigher = Number(v) > Number(awakenVal);
                const valueColor = isHigher ? '#7fde7f' : '#ffe066';
                const weight = isHigher ? 'font-weight:bold;' : '';
                return `<span style="display:inline-flex;align-items:center;gap:2px;">${renderStatIconHtml(key, 11)}<span style="color:${valueColor};${weight}">${v}</span></span>`;
            };
            const candidateTotal = hasStats
                ? STATS.reduce((sum, k) => sum + (Number(cs[k]) || 0), 0)
                : 0;
            const candidateLine = hasStats
                ? STATS.map(renderCandidateStat).filter(Boolean).join(' ') +
                  ` <span style="color:${getStatTotalColor(candidateTotal)};font-weight:600;">(${candidateTotal}%)</span>`
                : `<span style="opacity:0.6;">${t('mods.awakenTracker.statsUnavailable')}</span>`;

            const lastLine = document.createElement('div');
            lastLine.style.cssText = 'font-size:11px;line-height:1.6;border-top:1px dashed #444;margin-top:2px;padding-top:3px;';

            if (ev.type === 'applied') {
                const gainPairs = Object.entries(ev.gains || {}).filter(([, v]) => v > 0)
                    .map(([k, v]) => `<span style="display:inline-flex;align-items:center;gap:2px;">${renderStatIconHtml(k, 11)}<span style="color:#7fde7f;font-weight:bold;">+${v}</span></span>`);
                lastLine.innerHTML =
                    `<span style="color:#7fde7f;">${t('mods.awakenTracker.injected')}</span> ${gainPairs.join(' ') || t('mods.awakenTracker.noGain')}` +
                    `<div style="margin-top:2px;"><span style="opacity:0.6;">${t('mods.awakenTracker.sealed')}</span> ${candidateLine}</div>`;
            } else {
                const reasonLabel = getSkipReasonLabel(ev.reason);
                lastLine.innerHTML =
                    `<span style="color:#ff9966;">${t('mods.awakenTracker.skipped')}</span> ${reasonLabel}` +
                    `<div style="margin-top:2px;"><span style="opacity:0.6;">${t('mods.awakenTracker.sealed')}</span> ${candidateLine}</div>`;
            }
            slot.appendChild(lastLine);
        }

        const counter = document.createElement('div');
        counter.style.cssText = 'font-size:11px;color:#9ad;border-top:1px dashed #444;margin-top:2px;padding-top:3px;';
        const injects = entry?.injects || 0;
        const skips = entry?.skips || 0;
        counter.innerHTML = t('mods.awakenTracker.sessionInjectsHtml', { injects, skips });
        slot.appendChild(counter);

        const eventLog = Array.isArray(entry?.eventLog) ? entry.eventLog : [];
        if (eventLog.length > 0) {
            const logDetails = document.createElement('details');
            if (options.logOpen) logDetails.open = true;
            logDetails.style.cssText = 'border-top:1px dashed #444;margin-top:2px;padding-top:3px;';
            const logSummary = document.createElement('summary');
            logSummary.style.cssText = 'cursor:pointer;font-size:11px;color:#9ad;opacity:0.85;';
            logSummary.textContent = t('mods.awakenTracker.viewLog', { count: eventLog.length });
            logDetails.appendChild(logSummary);

            const renderLogStat = (key, v) =>
                `<span style="display:inline-flex;align-items:center;gap:1px;">${renderStatIconHtml(key, 10)}<span style="color:#ffe066;">${v}</span></span>`;

            const logList = document.createElement('div');
            logList.style.cssText = 'margin-top:4px;font-size:10px;line-height:1.5;max-height:200px;overflow-y:auto;';
            for (const logEv of eventLog) {
                const row = document.createElement('div');
                row.style.cssText = 'padding:3px 0;border-bottom:1px dotted #2a2a2a;';
                const time = new Date(logEv.timestamp || 0);
                const hh = String(time.getHours()).padStart(2, '0');
                const mm = String(time.getMinutes()).padStart(2, '0');
                const ss = String(time.getSeconds()).padStart(2, '0');
                const cs = logEv.candidateStats || {};
                const hasStats = Number.isFinite(Number(cs.hp));
                const sealedTotal = hasStats
                    ? STATS.reduce((sum, k) => sum + (Number(cs[k]) || 0), 0)
                    : 0;
                const sealedHtml = hasStats
                    ? STATS.map(k => renderLogStat(k, cs[k])).join(' ') +
                      ` <span style="color:${getStatTotalColor(sealedTotal)};font-weight:600;">(${sealedTotal}%)</span>`
                    : `<span style="opacity:0.6;">${t('mods.awakenTracker.noStats')}</span>`;

                if (logEv.type === 'applied') {
                    const gainPairs = Object.entries(logEv.gains || {}).filter(([, v]) => v > 0)
                        .map(([k, v]) => `<span style="display:inline-flex;align-items:center;gap:1px;">${renderStatIconHtml(k, 10)}<span style="color:#7fde7f;font-weight:bold;">+${v}</span></span>`)
                        .join(' ');
                    row.innerHTML =
                        `<div><span style="opacity:0.5;">${hh}:${mm}:${ss}</span> ${uiIconHtml(UI_ICONS.success, 10)} ${gainPairs || `<span style="opacity:0.6;">${t('mods.awakenTracker.noGain')}</span>`}</div>` +
                        `<div style="opacity:0.7;padding-left:6px;">${t('mods.awakenTracker.sealed')} ${sealedHtml}</div>`;
                } else {
                    const reasonLabel = getSkipReasonLabel(logEv.reason);
                    row.innerHTML =
                        `<div><span style="opacity:0.5;">${hh}:${mm}:${ss}</span> ${uiIconHtml(UI_ICONS.fail, 10)} ${reasonLabel}</div>` +
                        `<div style="opacity:0.7;padding-left:6px;">${t('mods.awakenTracker.sealed')} ${sealedHtml}</div>`;
                }
                logList.appendChild(row);
            }
            logDetails.appendChild(logList);
            slot.appendChild(logDetails);
        }

        return slot;
    }

    // =======================
    // 9b. Awaken Farmer — gene-cap automation for awakened creatures
    // =======================
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function loadFarmerSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_FARMER);
            if (!raw) return { ...FARMER_DEFAULTS, mapSettings: {} };
            const p = JSON.parse(raw);
            const mapSettings = (p.mapSettings && typeof p.mapSettings === 'object' && !Array.isArray(p.mapSettings))
                ? p.mapSettings
                : {};
            return {
                enabled: p.enabled === true,
                autoRefillStamina: p.autoRefillStamina === true,
                setupLabel: typeof p.setupLabel === 'string' ? p.setupLabel : '',
                floor: Number.isFinite(Number(p.floor)) ? Number(p.floor) : 0,
                mapSettings
            };
        } catch (_) {
            return { ...FARMER_DEFAULTS, mapSettings: {} };
        }
    }

    function saveFarmerSettings(partial) {
        try {
            const merged = { ...loadFarmerSettings(), ...partial };
            if (partial && Object.prototype.hasOwnProperty.call(partial, 'mapSettings')) {
                merged.mapSettings = (partial.mapSettings && typeof partial.mapSettings === 'object')
                    ? partial.mapSettings
                    : {};
            }
            delete merged.startDelay;
            localStorage.setItem(STORAGE_KEY_FARMER, JSON.stringify(merged));
            return merged;
        } catch (_) {
            return loadFarmerSettings();
        }
    }

    function getFarmerMapSettings(roomId) {
        if (!roomId) return null;
        const all = loadFarmerSettings().mapSettings || {};
        const entry = all[String(roomId)];
        return entry && typeof entry === 'object' ? entry : null;
    }

    function hasFarmerMapCustomSettings(roomId) {
        const entry = getFarmerMapSettings(roomId);
        if (!entry) return false;
        if (entry.floor != null && Number.isFinite(Number(entry.floor))) return true;
        if (Object.prototype.hasOwnProperty.call(entry, 'setupLabel')) return true;
        if (Object.prototype.hasOwnProperty.call(entry, 'autoRefillStamina')) return true;
        return false;
    }

    function setFarmerMapSettings(roomId, nextEntry) {
        if (!roomId) return loadFarmerSettings();
        const settings = loadFarmerSettings();
        const mapSettings = { ...(settings.mapSettings || {}) };
        const key = String(roomId);
        if (!nextEntry || Object.keys(nextEntry).length === 0) {
            delete mapSettings[key];
        } else {
            mapSettings[key] = nextEntry;
        }
        return saveFarmerSettings({ mapSettings });
    }

    function clearFarmerMapSettings(roomId) {
        return setFarmerMapSettings(roomId, null);
    }

    function getEffectiveFarmerSetupLabel(roomId) {
        const entry = getFarmerMapSettings(roomId);
        if (entry && Object.prototype.hasOwnProperty.call(entry, 'setupLabel')) {
            return typeof entry.setupLabel === 'string' ? entry.setupLabel : '';
        }
        return loadFarmerSettings().setupLabel || '';
    }

    function getEffectiveFarmerAutoRefill(roomId) {
        const entry = getFarmerMapSettings(roomId);
        if (entry && Object.prototype.hasOwnProperty.call(entry, 'autoRefillStamina')) {
            return entry.autoRefillStamina === true;
        }
        return loadFarmerSettings().autoRefillStamina === true;
    }

    /** Species with at least one awaken that is not fully gene-capped (20×5). */
    function collectAwakenedNotCappedTargets() {
        const monsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters || [];
        const byGameId = new Map();
        for (const m of monsters) {
            if (!m || m.gameId == null || !isAwakenedCreatureLocal(m)) continue;
            const gameId = Number(m.gameId);
            if (!Number.isFinite(gameId)) continue;
            const name = resolveName(gameId);
            if (!isCreatureEligibleForAwaken(name)) continue;
            const stats = getMonsterGeneStatsLocal(m);
            const capped = isAwakenedCappedStats(stats);
            let g = byGameId.get(gameId);
            if (!g) {
                g = { gameId, name, anyCapped: false, bestUncapped: null };
                byGameId.set(gameId, g);
            }
            if (capped) g.anyCapped = true;
            else {
                const sum = STATS.reduce((a, k) => a + (Number(stats[k]) || 0), 0);
                if (!g.bestUncapped || sum > g.bestUncapped.sum) {
                    g.bestUncapped = { stats, sum, cappedCount: STATS.filter(k => Number(stats[k]) >= CAP_VALUE).length };
                }
            }
        }
        const targets = [];
        const namesById = new Map();
        for (const g of byGameId.values()) {
            // Injects target the best awaken; once any copy is fully capped, gene farming is done.
            if (g.anyCapped || !g.bestUncapped) continue;
            targets.push(g);
            namesById.set(g.gameId, g.name);
        }
        targets.sort((a, b) => (b.bestUncapped?.sum || 0) - (a.bestUncapped?.sum || 0) || a.name.localeCompare(b.name));
        return { targets, wantedIds: new Set(targets.map(t => t.gameId)), namesById };
    }

    function isRaidRoomId(roomId, room) {
        try {
            if (typeof window.mapsDatabase?.isRaid === 'function') {
                return window.mapsDatabase.isRaid(roomId) === true;
            }
        } catch (_) {}
        return room?.raid === true;
    }

    /** True when this raid room is in the live active-raids list (currently spawnable). */
    function isRaidCurrentlyActive(roomId) {
        if (!roomId) return false;
        try {
            const activeRaids = globalThis.state?.raids?.getSnapshot?.()?.context?.list || [];
            return activeRaids.some((raid) => String(raid?.roomId) === String(roomId));
        } catch (_) {
            return false;
        }
    }

    /** Best completed ascension floor for a room (−1 if never recorded). */
    function getBestCompletedFloorForRoom(roomId) {
        try {
            const roomStats = globalThis.state?.player?.getSnapshot?.()?.context?.rooms?.[roomId];
            const floor = roomStats?.floor;
            if (typeof floor !== 'number' || Number.isNaN(floor)) return -1;
            return Math.max(0, Math.min(AWAKEN_FARM_MAX_FLOOR, Math.floor(floor)));
        } catch (_) {
            return -1;
        }
    }

    /** Highest selectable floor (best completed + 1, capped at 15). */
    function getMaxUnlockedFloorForRoom(roomId) {
        const best = getBestCompletedFloorForRoom(roomId);
        if (best < 0) return 0;
        return Math.min(AWAKEN_FARM_MAX_FLOOR, best + 1);
    }

    function hasAwakenFarmFloorUnlocked(roomId) {
        return getMaxUnlockedFloorForRoom(roomId) >= AWAKEN_FARM_MIN_FLOOR;
    }

    /** Pick a farmable sealed floor in 11–15, or null if none unlocked. Honors per-map override. */
    function pickAwakenFarmFloor(roomId) {
        const maxUnlocked = getMaxUnlockedFloorForRoom(roomId);
        if (maxUnlocked < AWAKEN_FARM_MIN_FLOOR) return null;
        const entry = getFarmerMapSettings(roomId);
        if (entry?.floor != null) {
            const custom = Number(entry.floor);
            if (Number.isFinite(custom)
                && custom >= AWAKEN_FARM_MIN_FLOOR
                && custom <= maxUnlocked) {
                return Math.min(AWAKEN_FARM_MAX_FLOOR, custom);
            }
        }
        return Math.min(AWAKEN_FARM_MAX_FLOOR, maxUnlocked);
    }

    function rankMapsForWantedIds(wantedIds, namesById = new Map(), options = {}) {
        const utils = globalThis.state?.utils;
        if (!utils?.REGIONS || typeof utils.getBoardMonstersFromRoomId !== 'function') {
            return { results: [], error: 'utils' };
        }
        if (!wantedIds || wantedIds.size === 0) {
            return { results: [], error: null };
        }
        const ROOM_NAME = utils.ROOM_NAME || {};
        const regionIdsToNames = utils.regionIdsToNames || {};
        const results = [];
        let orderIdx = 0;
        const requireFarmFloor = options.requireFarmFloor !== false;
        for (const region of utils.REGIONS) {
            if (!region?.id) continue;
            const regionName = regionIdsToNames[region.id] || region.id;
            for (const room of (region.rooms || [])) {
                if (!room?.id) continue;
                const isRaid = isRaidRoomId(room.id, room);
                // Inactive raids are not farmable — only include them while active when farming.
                if (requireFarmFloor && isRaid && !isRaidCurrentlyActive(room.id)) continue;
                // Sealed / awaken gene farming needs at least one unlocked floor in 11–15.
                if (requireFarmFloor && !hasAwakenFarmFloorUnlocked(room.id)) continue;

                let board;
                try { board = utils.getBoardMonstersFromRoomId(room.id); } catch (_) { continue; }
                if (!Array.isArray(board)) continue;
                const villains = board.filter(p => p?.villain === true);
                if (!villains.length) continue;

                const wantedByCreature = new Map();
                const otherByCreature = new Map();
                for (const v of villains) {
                    const id = Number(v.gameId);
                    if (!Number.isFinite(id)) continue;
                    if (wantedIds.has(id)) {
                        const entry = wantedByCreature.get(id) || { count: 0, totalLevel: 0 };
                        entry.count += 1;
                        entry.totalLevel += Number(v.level || 0);
                        wantedByCreature.set(id, entry);
                    } else {
                        const entry = otherByCreature.get(id) || { count: 0, totalLevel: 0 };
                        entry.count += 1;
                        entry.totalLevel += Number(v.level || 0);
                        otherByCreature.set(id, entry);
                    }
                }
                if (wantedByCreature.size === 0) continue;

                const wantedTotal = Array.from(wantedByCreature.values()).reduce((a, b) => a + b.count, 0);
                const uniqueWanted = wantedByCreature.size;
                const totalVillains = villains.length;
                const density = wantedTotal / totalVillains;
                const stamina = Number(room.staminaCost ?? 0);
                const wantedPerStamina = stamina > 0 ? wantedTotal / stamina : wantedTotal;
                const farmFloor = pickAwakenFarmFloor(room.id);

                results.push({
                    roomId: room.id,
                    mapName: ROOM_NAME[room.id] || room.id,
                    regionName, stamina, totalVillains, wantedTotal, uniqueWanted,
                    density, wantedPerStamina, defaultOrder: orderIdx++,
                    isRaid,
                    farmFloor,
                    maxUnlockedFloor: getMaxUnlockedFloorForRoom(room.id),
                    wantedDetails: Array.from(wantedByCreature.entries()).map(([id, info]) => ({
                        id, name: namesById.get(id) || resolveName(id) || `#${id}`,
                        count: info.count, avgLevel: info.totalLevel / info.count
                    })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
                    otherDetails: Array.from(otherByCreature.entries()).map(([id, info]) => ({
                        id, name: resolveName(id),
                        count: info.count, avgLevel: info.totalLevel / info.count
                    })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
                });
            }
        }
        results.sort((a, b) =>
            b.uniqueWanted - a.uniqueWanted
            || b.wantedPerStamina - a.wantedPerStamina
            || a.defaultOrder - b.defaultOrder
        );
        return { results, raidCount: results.filter(r => r.isRaid).length, error: null };
    }

    const farmerRuntime = {
        tickTimer: null,
        resumeTimer: null,
        busy: false,
        wasInitiatedByMod: false,
        currentRoomId: null,
        enabledRefill: false,
        status: 'idle',
        lastBlockReason: null,
        uiRefresh: null
    };

    let farmerStaminaTooltipObserver = null;
    let farmerStaminaRecoveryCallback = null;

    function farmerIsDocumentHidden() {
        return typeof document !== 'undefined' &&
            (document.hidden === true || document.visibilityState === 'hidden');
    }

    function farmerGetStaminaFromGameState() {
        try {
            if (typeof globalThis.state?.utils?.getCurrentStamina === 'function') {
                const fromUtils = Number(globalThis.state.utils.getCurrentStamina());
                if (Number.isFinite(fromUtils)) return fromUtils;
            }
            const playerContext = globalThis.state?.player?.getSnapshot?.()?.context;
            if (!playerContext) return null;
            for (const key of ['stamina', 'currentStamina']) {
                const value = Number(playerContext[key]);
                if (Number.isFinite(value)) return value;
            }
            const willBeFullAt = playerContext.staminaWillBeFullAt;
            const regenMax = Number(playerContext.maxStamina ?? playerContext.staminaMax);
            if (willBeFullAt != null && Number.isFinite(regenMax) && regenMax > 0) {
                const missing = Math.ceil((willBeFullAt - Date.now()) / STAMINA_REGEN_MS);
                const regenStamina = Math.max(0, regenMax - missing);
                const excessMs = Math.max(0, Number(playerContext.staminaExcessMs) || 0);
                return Math.floor(regenStamina + excessMs / STAMINA_REGEN_MS);
            }
        } catch (_) { /* fall through */ }
        return null;
    }

    function farmerGetCurrentStamina() {
        try {
            const fromApi = farmerGetStaminaFromGameState();
            if (fromApi !== null) return fromApi;
            const elStamina = document.querySelector('[title="Stamina"]');
            if (!elStamina) return 0;
            const staminaElement = elStamina.querySelector('span span');
            if (!staminaElement) return 0;
            const stamina = Number(staminaElement.textContent);
            return Number.isFinite(stamina) ? stamina : 0;
        } catch (_) {
            return 0;
        }
    }

    function farmerGetCurrentMapStaminaCost() {
        try {
            const boardContext = globalThis.state?.board?.getSnapshot()?.context;
            const selectedRoom = boardContext?.selectedMap?.selectedRoom;
            if (selectedRoom?.staminaCost) return selectedRoom.staminaCost;
            return DEFAULT_STAMINA_COST;
        } catch (_) {
            return DEFAULT_STAMINA_COST;
        }
    }

    function farmerHasInsufficientStamina() {
        const cost = farmerGetCurrentMapStaminaCost();
        if (farmerIsDocumentHidden()) {
            const current = farmerGetCurrentStamina();
            return { insufficient: current < cost, cost };
        }
        const staminaTooltip = document.querySelector(
            '[role="tooltip"] img[alt="stamina"], [data-state="instant-open"] img[alt="stamina"]'
        );
        if (staminaTooltip) {
            return { insufficient: true, cost };
        }
        return { insufficient: false, cost };
    }

    function farmerIsStaminaRecoveryActive() {
        return !!(window.awakenFarmerStaminaInterval || farmerStaminaTooltipObserver);
    }

    function farmerStopStaminaMonitoring() {
        if (window.awakenFarmerStaminaInterval) {
            clearInterval(window.awakenFarmerStaminaInterval);
            window.awakenFarmerStaminaInterval = null;
        }
        if (window.awakenFarmerDepletionInterval) {
            clearInterval(window.awakenFarmerDepletionInterval);
            window.awakenFarmerDepletionInterval = null;
        }
        if (farmerStaminaTooltipObserver) {
            farmerStaminaTooltipObserver.disconnect();
            farmerStaminaTooltipObserver = null;
            farmerStaminaRecoveryCallback = null;
        }
    }

    function farmerStartStaminaRecoveryMonitoring(onRecovered, requiredStamina) {
        if (farmerStaminaTooltipObserver) farmerStopStaminaMonitoring();

        const staminaCheck = farmerHasInsufficientStamina();
        if (!staminaCheck.insufficient) {
            console.log('[Awaken Farmer] Stamina sufficient - skipping recovery monitoring');
            return;
        }

        console.log('[Awaken Farmer] Starting stamina recovery monitoring...');
        farmerStaminaRecoveryCallback = onRecovered;
        let hasStaminaIssue = true;
        const needed = requiredStamina || DEFAULT_STAMINA_COST;

        const staminaCheckInterval = setInterval(() => {
            const currentStamina = farmerGetCurrentStamina();
            const tooltipStillExists = document.querySelector(
                '[role="tooltip"] img[alt="stamina"], [data-state="instant-open"] img[alt="stamina"]'
            );
            const recovered = farmerIsDocumentHidden()
                ? (currentStamina >= needed)
                : (!tooltipStillExists && hasStaminaIssue);

            if (!recovered) {
                if (hasStaminaIssue) {
                    const timeRemaining = Math.max(0, needed - currentStamina);
                    console.log(`[Awaken Farmer] Waiting for stamina (${currentStamina}/${needed}) - ~${timeRemaining} min remaining`);
                }
                return;
            }

            console.log(`[Awaken Farmer] Stamina recovered (${currentStamina}/${needed})`);
            hasStaminaIssue = false;
            const callback = farmerStaminaRecoveryCallback;
            clearInterval(staminaCheckInterval);
            farmerStopStaminaMonitoring();
            if (typeof callback === 'function') callback();
        }, STAMINA_MONITOR_INTERVAL);

        window.awakenFarmerStaminaInterval = staminaCheckInterval;

        farmerStaminaTooltipObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.removedNodes.forEach((node) => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    const wasStaminaTooltip =
                        (node.matches?.('[role="tooltip"]') || node.matches?.('[data-state="instant-open"]')) &&
                        node.querySelector?.('img[alt="stamina"]');
                    if (!wasStaminaTooltip || !hasStaminaIssue) return;

                    const currentStamina = farmerGetCurrentStamina();
                    console.log(`[Awaken Farmer] Stamina recovered (tooltip removed) - current: ${currentStamina}`);
                    hasStaminaIssue = false;
                    const callback = farmerStaminaRecoveryCallback;
                    clearInterval(staminaCheckInterval);
                    farmerStopStaminaMonitoring();
                    if (typeof callback === 'function') callback();
                });
            }
        });

        farmerStaminaTooltipObserver.observe(document.body, { childList: true, subtree: true });
    }

    function farmerWatchStaminaDepletion(onDepleted) {
        const staminaCheck = farmerHasInsufficientStamina();
        if (staminaCheck.insufficient) {
            console.log('[Awaken Farmer] Stamina already depleted - starting recovery monitoring');
            onDepleted();
            return;
        }

        if (window.awakenFarmerDepletionInterval) {
            clearInterval(window.awakenFarmerDepletionInterval);
            window.awakenFarmerDepletionInterval = null;
        }

        window.awakenFarmerDepletionInterval = setInterval(() => {
            const currentCheck = farmerHasInsufficientStamina();
            if (currentCheck.insufficient) {
                console.log('[Awaken Farmer] Stamina depleted during autoplay - starting recovery monitoring');
                clearInterval(window.awakenFarmerDepletionInterval);
                window.awakenFarmerDepletionInterval = null;
                onDepleted();
            }
        }, STAMINA_MONITOR_INTERVAL);
    }

    function farmerCreateStaminaRecoveryCallback(roomId) {
        return () => {
            console.log('[Awaken Farmer] Stamina recovered - resuming farming');

            if (!loadFarmerSettings().enabled) {
                farmerStopStaminaMonitoring();
                return;
            }
            if (!farmerCanRun()) {
                farmerStopStaminaMonitoring();
                return;
            }
            if (String(farmerGetCurrentMapId() || '') !== String(roomId)) {
                console.log('[Awaken Farmer] Map changed during stamina wait - re-evaluating');
                farmerStopStaminaMonitoring();
                farmerRunTick();
                return;
            }

            const ctx = globalThis.state?.board?.getSnapshot?.()?.context;
            const isAutoplayRunning = ctx?.mode === 'autoplay' && (ctx?.isRunning || ctx?.autoplayRunning);

            if (isAutoplayRunning) {
                farmerRuntime.status = 'farming';
                farmerRuntime.currentRoomId = roomId;
                farmerSetupStaminaDepletionWatch(roomId);
                if (typeof farmerRuntime.uiRefresh === 'function') farmerRuntime.uiRefresh();
                return;
            }

            if (!window.AutoplayManager?.requestControl(FARMER_MOD_NAME)) {
                console.log('[Awaken Farmer] Autoplay control denied after stamina recovery');
                return;
            }
            farmerRuntime.wasInitiatedByMod = true;
            syncFarmerModCoordination();

            const startBtn = farmerFindButtonByText('Start', 'Iniciar');
            if (!startBtn) {
                console.log('[Awaken Farmer] Start button not found after stamina recovery - resuming monitoring');
                window.AutoplayManager?.releaseControl(FARMER_MOD_NAME);
                farmerRuntime.wasInitiatedByMod = false;
                syncFarmerModCoordination();
                farmerStartStaminaRecoveryMonitoring(
                    farmerCreateStaminaRecoveryCallback(roomId),
                    farmerGetCurrentMapStaminaCost()
                );
                return;
            }

            startBtn.click();
            farmerRuntime.status = 'farming';
            farmerRuntime.currentRoomId = roomId;
            syncFarmerModCoordination();
            showFarmerStartingToast();
            farmerSetupStaminaDepletionWatch(roomId);
            if (typeof farmerRuntime.uiRefresh === 'function') farmerRuntime.uiRefresh();
        };
    }

    function farmerSetupStaminaDepletionWatch(roomId) {
        farmerWatchStaminaDepletion(() => {
            const requiredStamina = farmerGetCurrentMapStaminaCost();
            farmerRuntime.status = 'waiting-stamina';
            if (typeof farmerRuntime.uiRefresh === 'function') farmerRuntime.uiRefresh();
            farmerStartStaminaRecoveryMonitoring(
                farmerCreateStaminaRecoveryCallback(roomId),
                requiredStamina
            );
        });
    }

    async function farmerBeginAutoplay(roomId) {
        const staminaCheck = farmerHasInsufficientStamina();
        if (staminaCheck.insufficient) {
            console.log(`[Awaken Farmer] Insufficient stamina (needs ${staminaCheck.cost}) - monitoring recovery`);
            farmerRuntime.status = 'waiting-stamina';
            farmerRuntime.currentRoomId = roomId;
            farmerStartStaminaRecoveryMonitoring(
                farmerCreateStaminaRecoveryCallback(roomId),
                staminaCheck.cost
            );
            if (typeof farmerRuntime.uiRefresh === 'function') farmerRuntime.uiRefresh();
            return false;
        }

        const started = await farmerStartAutoplay();
        if (started) {
            farmerSetupStaminaDepletionWatch(roomId);
        }
        return started;
    }

    let farmerAllModsLoaded = false;
    let farmerBootGraceDone = false;
    let farmerBootGraceTimer = null;
    let farmerBootFallbackTimer = null;
    let farmerBootMessageHandler = null;

    function farmerSleep(ms) { return sleep(ms); }

    function getFarmerSetupLabels() {
        try {
            const labelsStr = localStorage.getItem('stored-setup-labels');
            if (labelsStr) {
                const labels = JSON.parse(labelsStr);
                if (Array.isArray(labels) && labels.length) return labels;
            }
        } catch (_) {}
        return ['Farm', 'Speedrun', 'Rank Points', 'Boosted Map', 'Other'];
    }

    let openFarmerMapContextMenu = null;

    function closeFarmerMapContextMenu() {
        if (openFarmerMapContextMenu?.closeMenu) {
            try { openFarmerMapContextMenu.closeMenu(); } catch (_) {}
        }
        openFarmerMapContextMenu = null;
    }

    /**
     * Per-map Awaken Farmer settings (floor 11–15, setup, auto-refill). Raid Hunter-style smith icon + context menu.
     */
    function createFarmerMapContextMenu(roomId, mapName, x, y, onClose) {
        closeFarmerMapContextMenu();

        const entry = getFarmerMapSettings(roomId) || {};
        const maxUnlocked = getMaxUnlockedFloorForRoom(roomId);
        const currentFloor = (entry.floor != null && Number.isFinite(Number(entry.floor)))
            ? String(Math.round(Number(entry.floor)))
            : 'auto';
        const currentSetup = Object.prototype.hasOwnProperty.call(entry, 'setupLabel')
            ? entry.setupLabel
            : 'default';
        const currentRefill = Object.prototype.hasOwnProperty.call(entry, 'autoRefillStamina')
            ? (entry.autoRefillStamina === true ? 'on' : 'off')
            : 'default';

        const selectCss = [
            'width:100%',
            'padding:4px 6px',
            'box-sizing:border-box',
            'background:#1a1a1a',
            'color:#f0f0f0',
            'border:1px solid #666',
            'border-radius:3px',
            'font-size:11px',
            'cursor:pointer',
            'outline:none',
            'color-scheme:dark'
        ].join(';');

        const optionCss = 'background:#1a1a1a;color:#f0f0f0;';

        function styleSelectOptions(selectEl) {
            for (const opt of selectEl.options) {
                opt.style.cssText = optionCss;
                if (opt.disabled) opt.style.color = '#777';
            }
        }

        function makeField(labelText, control) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin-bottom:8px;';
            const lab = document.createElement('label');
            lab.textContent = labelText;
            lab.style.cssText = 'color:#ccc;font-size:10px;font-weight:bold;';
            wrap.appendChild(lab);
            wrap.appendChild(control);
            return wrap;
        }

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;cursor:default;';

        const menu = document.createElement('div');
        menu.style.cssText = [
            'position:fixed',
            `left:${x}px`,
            `top:${y}px`,
            'z-index:9999',
            'min-width:220px',
            'max-width:260px',
            "background:url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat",
            'border:4px solid transparent',
            'border-image:url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch',
            'border-radius:4px',
            'padding:8px 10px',
            'box-shadow:0 4px 12px rgba(0,0,0,0.5)',
            'color-scheme:dark'
        ].join(';');

        const title = document.createElement('div');
        title.textContent = mapName || roomId;
        title.style.cssText = 'color:#ffe066;font-weight:bold;margin-bottom:8px;text-align:center;font-size:12px;';
        menu.appendChild(title);

        const floorSelect = document.createElement('select');
        floorSelect.style.cssText = selectCss;
        const autoOpt = document.createElement('option');
        autoOpt.value = 'auto';
        autoOpt.textContent = t('mods.awakenTracker.farmerMapFloorAuto');
        floorSelect.appendChild(autoOpt);
        for (let f = AWAKEN_FARM_MIN_FLOOR; f <= AWAKEN_FARM_MAX_FLOOR; f++) {
            const opt = document.createElement('option');
            opt.value = String(f);
            opt.textContent = `${t('mods.awakenTracker.farmerFloor')} ${f}`;
            if (f > maxUnlocked) {
                opt.disabled = true;
                opt.textContent += ` (${t('mods.awakenTracker.farmerFloorLocked')})`;
            }
            floorSelect.appendChild(opt);
        }
        floorSelect.value = (currentFloor !== 'auto' && Number(currentFloor) > maxUnlocked) ? 'auto' : currentFloor;
        styleSelectOptions(floorSelect);
        menu.appendChild(makeField(t('mods.awakenTracker.farmerMapFloor'), floorSelect));

        const setupSelect = document.createElement('select');
        setupSelect.style.cssText = selectCss;
        const defaultSetup = document.createElement('option');
        defaultSetup.value = 'default';
        defaultSetup.textContent = t('mods.awakenTracker.farmerMapSetupDefault');
        setupSelect.appendChild(defaultSetup);
        const autoSetup = document.createElement('option');
        autoSetup.value = '';
        autoSetup.textContent = t('mods.awakenTracker.farmerAutoSetup');
        setupSelect.appendChild(autoSetup);
        for (const label of getFarmerSetupLabels()) {
            const opt = document.createElement('option');
            opt.value = label;
            opt.textContent = label;
            setupSelect.appendChild(opt);
        }
        if (currentSetup === 'default') {
            setupSelect.value = 'default';
        } else if (currentSetup === '') {
            setupSelect.value = '';
        } else {
            setupSelect.value = currentSetup;
            if (setupSelect.value !== currentSetup) {
                const custom = document.createElement('option');
                custom.value = currentSetup;
                custom.textContent = currentSetup;
                setupSelect.appendChild(custom);
                setupSelect.value = currentSetup;
            }
        }
        styleSelectOptions(setupSelect);
        menu.appendChild(makeField(t('mods.awakenTracker.farmerSetupLabel'), setupSelect));

        const refillSelect = document.createElement('select');
        refillSelect.style.cssText = selectCss;
        [
            ['default', t('mods.awakenTracker.farmerMapRefillDefault')],
            ['on', t('mods.awakenTracker.farmerMapRefillOn')],
            ['off', t('mods.awakenTracker.farmerMapRefillOff')]
        ].forEach(([value, text]) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = text;
            refillSelect.appendChild(opt);
        });
        refillSelect.value = currentRefill;
        styleSelectOptions(refillSelect);
        menu.appendChild(makeField(t('mods.awakenTracker.farmerMapRefill'), refillSelect));

        const hint = document.createElement('div');
        hint.textContent = t('mods.awakenTracker.farmerMapSettingsHint');
        hint.style.cssText = 'color:#777;font-size:9px;line-height:1.3;margin:0 0 8px;';
        menu.appendChild(hint);

        const buttons = document.createElement('div');
        buttons.style.cssText = 'display:flex;gap:4px;justify-content:center;flex-wrap:wrap;';

        function closeMenu() {
            try { overlay.remove(); } catch (_) {}
            try { menu.remove(); } catch (_) {}
            if (openFarmerMapContextMenu?.menu === menu) openFarmerMapContextMenu = null;
            document.removeEventListener('keydown', onKey);
        }

        function onKey(e) {
            if (e.key === 'Escape') closeMenu();
        }

        const btnBase = 'min-width:58px;height:24px;border:1px solid #555;border-radius:3px;cursor:pointer;font-size:11px;font-weight:bold;';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.textContent = t('mods.awakenTracker.farmerMapSave');
        saveBtn.style.cssText = `${btnBase}background:#1a3a1a;color:#4CAF50;`;
        saveBtn.addEventListener('click', () => {
            const next = {};
            if (floorSelect.value !== 'auto') {
                const f = Number(floorSelect.value);
                if (Number.isFinite(f) && f >= AWAKEN_FARM_MIN_FLOOR && f <= maxUnlocked) {
                    next.floor = f;
                }
            }
            if (setupSelect.value !== 'default') {
                next.setupLabel = setupSelect.value;
            }
            if (refillSelect.value === 'on') next.autoRefillStamina = true;
            else if (refillSelect.value === 'off') next.autoRefillStamina = false;
            setFarmerMapSettings(roomId, Object.keys(next).length ? next : null);
            console.log(`[Awaken Farmer] Saved map settings for ${roomId}:`, next);
            if (typeof onClose === 'function') onClose();
            closeMenu();
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = t('mods.awakenTracker.farmerMapCancel');
        cancelBtn.style.cssText = `${btnBase}background:#1a1a1a;color:#888;`;
        cancelBtn.addEventListener('click', closeMenu);

        buttons.appendChild(saveBtn);
        if (hasFarmerMapCustomSettings(roomId)) {
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.textContent = t('mods.awakenTracker.farmerMapClear');
            clearBtn.style.cssText = `${btnBase}background:#1a1a1a;color:#888;`;
            clearBtn.addEventListener('mouseenter', () => { clearBtn.style.color = '#ff6b6b'; });
            clearBtn.addEventListener('mouseleave', () => { clearBtn.style.color = '#888'; });
            clearBtn.addEventListener('click', () => {
                clearFarmerMapSettings(roomId);
                console.log(`[Awaken Farmer] Cleared map settings for ${roomId}`);
                if (typeof onClose === 'function') onClose();
                closeMenu();
            });
            buttons.appendChild(clearBtn);
        }
        buttons.appendChild(cancelBtn);
        menu.appendChild(buttons);

        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) closeMenu();
        });
        document.addEventListener('keydown', onKey);

        document.body.appendChild(overlay);
        document.body.appendChild(menu);

        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            let left = x;
            let top = y;
            if (rect.right > window.innerWidth - 8) left = Math.max(8, window.innerWidth - rect.width - 8);
            if (rect.bottom > window.innerHeight - 8) top = Math.max(8, window.innerHeight - rect.height - 8);
            menu.style.left = `${left}px`;
            menu.style.top = `${top}px`;
        });

        openFarmerMapContextMenu = { menu, closeMenu };
        return menu;
    }

    function farmerHasSetupForMap(setupLabel, mapId) {
        if (!setupLabel || !mapId) return false;
        try { return localStorage.getItem(`${setupLabel}-${mapId}`) !== null; } catch (_) { return false; }
    }

    function farmerFindBestiaryAutomator() {
        try {
            if (window.bestiaryAutomator?.updateConfig) return window.bestiaryAutomator;
            if (window.BestiaryAutomatorAPI?.updateConfig) return window.BestiaryAutomatorAPI;
            if (typeof context !== 'undefined' && context.exports?.updateConfig) return context.exports;
            const viaLoader = window.modLoader?.getModContext?.('bestiary-automator');
            if (viaLoader?.exports?.updateConfig) return viaLoader.exports;
        } catch (_) {}
        return null;
    }

    function farmerApplyAutomatorRefill(enabled) {
        try {
            const automator = farmerFindBestiaryAutomator();
            if (!automator?.updateConfig) return false;
            automator.updateConfig({ autoRefillStamina: !!enabled });
            farmerRuntime.enabledRefill = !!enabled;
            return true;
        } catch (e) {
            console.warn('[Awaken Farmer] Automator refill toggle failed:', e);
            return false;
        }
    }

    let farmerModRegistered = false;

    function ensureFarmerModRegistered() {
        if (farmerModRegistered) {
            try { window.ModCoordination?.updateModPriority?.(FARMER_MOD_NAME, FARMER_PRIORITY); } catch (_) {}
            return true;
        }
        if (!window.ModCoordination?.registerMod) return false;
        try {
            window.ModCoordination.registerMod(FARMER_MOD_NAME, {
                priority: FARMER_PRIORITY,
                metadata: { description: 'Farms maps to gene-cap awakened creatures' }
            });
            // Override any stale localStorage priority so we stay just above Stamina Optimizer.
            window.ModCoordination.updateModPriority?.(FARMER_MOD_NAME, FARMER_PRIORITY);
            farmerModRegistered = true;
            return true;
        } catch (e) {
            console.warn('[Awaken Farmer] registerMod failed:', e);
            return false;
        }
    }

    function syncFarmerModCoordination() {
        if (!window.ModCoordination) return;
        if (!ensureFarmerModRegistered()) return;
        const s = loadFarmerSettings();
        window.ModCoordination.updateModState(FARMER_MOD_NAME, {
            enabled: s.enabled === true,
            active: farmerRuntime.wasInitiatedByMod === true
        });
    }

    function isRaidHunterEnabled() {
        try {
            // Prefer Raid Hunter's real automation flag. ModCoordination used to stay
            // enabled:true after RH init even when automation was off, which made
            // Awaken Farmer yield forever whenever any live raids existed.
            const raw = localStorage.getItem('raidHunterAutomationEnabled');
            if (raw !== null) {
                try {
                    const parsed = JSON.parse(raw);
                    return parsed === true || parsed === 'true';
                } catch (_) {
                    return String(raw).toLowerCase() === 'true';
                }
            }
            return window.ModCoordination?.isModEnabled?.('Raid Hunter') === true;
        } catch (_) {
            return false;
        }
    }

    /** True when Raid Hunter is active or has live raids it may claim (do not steal the map first). */
    function isRaidHunterPendingOrActive() {
        try {
            if (window.ModCoordination?.isModActive?.('Raid Hunter')) return true;
            if (typeof window.raidHunterIsCurrentlyRaiding === 'function' && window.raidHunterIsCurrentlyRaiding()) {
                return true;
            }
            // Prefer RH's own filter (enabled maps only). Any live raid used to block forever
            // when RH skipped disabled maps (e.g. Monastery Catacombs) while SO still ran.
            if (typeof window.raidHunterHasClaimableRaids === 'function') {
                return window.raidHunterHasClaimableRaids() === true;
            }
            if (!isRaidHunterEnabled()) return false;
            const list = globalThis.state?.raids?.getSnapshot?.()?.context?.list || [];
            return Array.isArray(list) && list.length > 0;
        } catch (_) {
            return false;
        }
    }

    /** True when farmer loop is armed and still has / may have work (SO / others should yield). */
    function awakenFarmerShouldHoldBoard() {
        try {
            if (!loadFarmerSettings().enabled) return false;
            if (!farmerBootGraceDone) return true; // about to auto-start
            if (!farmerRuntime.tickTimer) return false;
            if (farmerRuntime.status === 'done' || farmerRuntime.status === 'no-maps') return false;
            return true;
        } catch (_) {
            return false;
        }
    }
    window.awakenFarmerShouldHoldBoard = awakenFarmerShouldHoldBoard;

    function farmerBlockedReason() {
        if (!farmerBootGraceDone) return 'boot-grace';
        if (awakenPausedForAnalysis || isAwakenAnalysisBlockingActive()) return 'board-analyzer';
        if (window.ModCoordination?.isModActive?.('Manual Runner')) return 'manual-runner';
        if (window.ModCoordination?.isModActive?.('Board Analyzer')) return 'board-analyzer';
        if (window.ModCoordination?.isModActive?.('Better Boosted Maps')) return 'better-boosted-maps';
        if (isRaidHunterPendingOrActive()) return 'raid-hunter';
        if (window.ModCoordination?.canModRun
            && !window.ModCoordination.canModRun(FARMER_MOD_NAME, FARMER_YIELD_MODS)) {
            return 'mod-coordination';
        }
        return null;
    }

    function farmerCanRun() {
        return farmerBlockedReason() === null;
    }

    let farmerCoordinationUnsubscribe = null;

    function setupFarmerBootGrace() {
        if (farmerBootMessageHandler) return;

        const beginGrace = () => {
            if (farmerBootGraceDone || farmerBootGraceTimer) return;
            console.log(`[Awaken Farmer] Boot grace started — waiting ${MODS_LOADING_GRACE_PERIOD / 1000}s before auto-start`);
            farmerBootGraceTimer = setTimeout(() => {
                farmerBootGraceTimer = null;
                farmerBootGraceDone = true;
                console.log('[Awaken Farmer] Boot grace ended');
                if (loadFarmerSettings().enabled) startFarmerLoop();
            }, MODS_LOADING_GRACE_PERIOD);
        };

        farmerBootMessageHandler = (event) => {
            if (event.source !== window) return;
            if (event.data?.from === 'LOCAL_MODS_LOADER' && event.data?.action === 'allModsLoaded') {
                if (farmerAllModsLoaded) return;
                farmerAllModsLoaded = true;
                console.log('[Awaken Farmer] Received allModsLoaded signal');
                beginGrace();
            }
        };
        window.addEventListener('message', farmerBootMessageHandler);

        farmerBootFallbackTimer = setTimeout(() => {
            farmerBootFallbackTimer = null;
            if (!farmerAllModsLoaded) {
                console.warn('[Awaken Farmer] allModsLoaded not received — starting boot grace anyway');
                farmerAllModsLoaded = true;
                beginGrace();
            }
        }, MAX_WAIT_FOR_SIGNAL);
    }

    function teardownFarmerBootGrace() {
        if (farmerBootMessageHandler) {
            try { window.removeEventListener('message', farmerBootMessageHandler); } catch (_) {}
            farmerBootMessageHandler = null;
        }
        if (farmerBootGraceTimer) {
            clearTimeout(farmerBootGraceTimer);
            farmerBootGraceTimer = null;
        }
        if (farmerBootFallbackTimer) {
            clearTimeout(farmerBootFallbackTimer);
            farmerBootFallbackTimer = null;
        }
    }

    function setupFarmerCoordination() {
        if (farmerCoordinationUnsubscribe || !window.ModCoordination?.on) return;
        farmerCoordinationUnsubscribe = window.ModCoordination.on('modActiveChanged', (data) => {
            if (!data || data.active) return;
            if (!FARMER_YIELD_MODS.includes(data.modName)) return;
            if (!loadFarmerSettings().enabled) return;
            if (farmerRuntime.resumeTimer) {
                clearTimeout(farmerRuntime.resumeTimer);
                farmerRuntime.resumeTimer = null;
            }
            console.log(`[Awaken Farmer] ${data.modName} became inactive — resuming after coordination delay`);
            farmerRuntime.resumeTimer = setTimeout(() => {
                farmerRuntime.resumeTimer = null;
                if (!loadFarmerSettings().enabled || !farmerCanRun()) return;
                farmerRunTick();
            }, COORDINATION_RESUME_DELAY_MS);
        });
    }

    function farmerGetCurrentMapId() {
        try {
            return globalThis.state?.board?.getSnapshot?.()?.context?.selectedMap?.selectedRoom?.id || null;
        } catch (_) { return null; }
    }

    function farmerFindButtonByText(...texts) {
        const wanted = texts.map(t => String(t || '').trim().toLowerCase()).filter(Boolean);
        for (const button of document.querySelectorAll('button')) {
            const label = button.textContent.trim().toLowerCase();
            if (wanted.includes(label)) return button;
        }
        return null;
    }

    async function farmerNavigateToMap(mapId) {
        if (!mapId || !globalThis.state?.board?.send) return false;
        if (String(farmerGetCurrentMapId()) === String(mapId)) return true;
        try {
            if (typeof window.markModSettingsProgrammaticNavFloorGuard === 'function') {
                window.markModSettingsProgrammaticNavFloorGuard('awaken-farmer');
            }
            globalThis.state.board.send({ type: 'selectRoomById', roomId: mapId });
            for (let i = 0; i < 20; i++) {
                await farmerSleep(100);
                if (String(farmerGetCurrentMapId()) === String(mapId)) return true;
            }
            return String(farmerGetCurrentMapId()) === String(mapId);
        } catch (e) {
            console.warn('[Awaken Farmer] navigate failed:', e);
            return false;
        }
    }

    async function farmerSetFloor(floor) {
        try {
            globalThis.state?.board?.trigger?.setState?.({
                fn: (prev) => ({ ...prev, floor: Number(floor) || 0 })
            });
            await farmerSleep(100);
            return true;
        } catch (_) { return false; }
    }

    function farmerHasCreaturesOnBoard() {
        try {
            const cfg = globalThis.state?.board?.getSnapshot?.()?.context?.boardConfig;
            if (!Array.isArray(cfg)) return false;
            return cfg.some(p => p?.type === 'player' || (p?.type === 'custom' && p?.villain === false));
        } catch (_) { return false; }
    }

    async function farmerLoadSetup(setupLabel, mapId) {
        if (!setupLabel) {
            const autoBtn = farmerFindButtonByText('Auto-setup', 'Auto setup', 'Autosetup', 'Autoconfigurar')
                || Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-wand-sparkles'));
            if (!autoBtn) return false;
            autoBtn.click();
            await farmerSleep(1000);
            return farmerHasCreaturesOnBoard();
        }
        if (!farmerHasSetupForMap(setupLabel, mapId)) return false;
        const wanted = String(setupLabel).trim().toLowerCase();
        let setupBtn = null;
        for (const button of document.querySelectorAll('button')) {
            const text = button.textContent.trim();
            const m = text.match(/^Setup\s*\((.+)\)$/i);
            if (!m) continue;
            if (m[1].trim().toLowerCase() !== wanted) continue;
            setupBtn = button;
            break;
        }
        if (!setupBtn) {
            // Already applied: disabled Save (label)
            for (const button of document.querySelectorAll('button')) {
                const text = button.textContent.trim();
                const m = text.match(/^Save\s*\((.+)\)$/i);
                if (m && m[1].trim().toLowerCase() === wanted && button.disabled) return true;
            }
            return false;
        }
        setupBtn.click();
        await farmerSleep(1200);
        return farmerHasCreaturesOnBoard();
    }

    async function farmerEnsureAutoplayMode() {
        try {
            const ctx = globalThis.state?.board?.getSnapshot?.()?.context;
            if (!ctx) return false;
            if (ctx.mode === 'autoplay') return true;
            globalThis.state.board.send({ type: 'setPlayMode', mode: 'autoplay' });
            await farmerSleep(300);
            return globalThis.state.board.getSnapshot()?.context?.mode === 'autoplay';
        } catch (_) { return false; }
    }

    async function farmerStartAutoplay() {
        if (!window.AutoplayManager?.requestControl(FARMER_MOD_NAME)) {
            console.log('[Awaken Farmer] Autoplay control denied');
            return false;
        }
        farmerRuntime.wasInitiatedByMod = true;
        syncFarmerModCoordination();
        if (!(await farmerEnsureAutoplayMode())) {
            window.AutoplayManager?.releaseControl(FARMER_MOD_NAME);
            farmerRuntime.wasInitiatedByMod = false;
            syncFarmerModCoordination();
            return false;
        }
        await farmerSleep(200);
        const startBtn = farmerFindButtonByText('Start', 'Iniciar');
        if (!startBtn) {
            window.AutoplayManager?.releaseControl(FARMER_MOD_NAME);
            farmerRuntime.wasInitiatedByMod = false;
            syncFarmerModCoordination();
            return false;
        }
        startBtn.click();
        farmerRuntime.status = 'farming';
        syncFarmerModCoordination();
        showFarmerStartingToast();
        return true;
    }

    function farmerStopAutoplay() {
        farmerStopStaminaMonitoring();
        tryPauseGameAutoplay();
        farmerRuntime.wasInitiatedByMod = false;
        farmerRuntime.currentRoomId = null;
        farmerRuntime.status = 'idle';
        window.AutoplayManager?.releaseControl(FARMER_MOD_NAME);
        syncFarmerModCoordination();
    }

    function farmerMapStillHasTargets(roomId, wantedIds) {
        if (!roomId || !wantedIds?.size) return false;
        try {
            const board = globalThis.state?.utils?.getBoardMonstersFromRoomId?.(roomId) || [];
            return board.some(p => p?.villain === true && wantedIds.has(Number(p.gameId)));
        } catch (_) { return false; }
    }

    async function farmerRunTick() {
        if (farmerRuntime.busy) return;
        if (!farmerBootGraceDone) return;
        const settings = loadFarmerSettings();
        if (!settings.enabled) return;
        const blocked = farmerBlockedReason();
        if (blocked) {
            farmerStopStaminaMonitoring();
            if (farmerRuntime.status !== 'blocked' || farmerRuntime.lastBlockReason !== blocked) {
                console.log(`[Awaken Farmer] Waiting — blocked by ${blocked}`);
                farmerRuntime.lastBlockReason = blocked;
            }
            farmerRuntime.status = 'blocked';
            if (typeof farmerRuntime.uiRefresh === 'function') farmerRuntime.uiRefresh();
            return;
        }
        farmerRuntime.lastBlockReason = null;

        if (farmerRuntime.status === 'waiting-stamina' && farmerIsStaminaRecoveryActive()) {
            return;
        }

        farmerRuntime.busy = true;
        try {
            const { wantedIds, namesById, targets } = collectAwakenedNotCappedTargets();
            if (wantedIds.size === 0) {
                if (farmerRuntime.status !== 'done') {
                    console.log('[Awaken Farmer] Done — all awakened creatures are gene-capped');
                }
                farmerRuntime.status = 'done';
                if (farmerRuntime.wasInitiatedByMod) farmerStopAutoplay();
                if (typeof farmerRuntime.uiRefresh === 'function') farmerRuntime.uiRefresh();
                return;
            }

            const ranked = rankMapsForWantedIds(wantedIds, namesById);
            const queue = ranked.results || [];
            if (queue.length === 0) {
                if (farmerRuntime.status !== 'no-maps') {
                    console.log('[Awaken Farmer] No eligible maps (need unlocked floor 11–15)');
                }
                farmerRuntime.status = 'no-maps';
                if (farmerRuntime.wasInitiatedByMod) farmerStopAutoplay();
                if (typeof farmerRuntime.uiRefresh === 'function') farmerRuntime.uiRefresh();
                return;
            }

            const currentId = farmerRuntime.currentRoomId || farmerGetCurrentMapId();
            let next = null;
            if (currentId && farmerMapStillHasTargets(currentId, wantedIds)) {
                next = queue.find(r => String(r.roomId) === String(currentId)) || null;
            }
            if (!next) next = queue[0];

            const needSwitch = String(farmerRuntime.currentRoomId || '') !== String(next.roomId)
                || String(farmerGetCurrentMapId() || '') !== String(next.roomId)
                || !farmerRuntime.wasInitiatedByMod;

            if (needSwitch) {
                farmerRuntime.status = 'starting';
                if (typeof farmerRuntime.uiRefresh === 'function') farmerRuntime.uiRefresh();
                console.log(`[Awaken Farmer] Waiting ${DEFAULT_START_DELAY}s before navigation...`);
                await farmerSleep(DEFAULT_START_DELAY * 1000);
                if (!loadFarmerSettings().enabled || !farmerCanRun()) {
                    farmerRuntime.status = loadFarmerSettings().enabled ? 'blocked' : 'idle';
                    return;
                }

                farmerRuntime.status = 'switching';
                if (typeof farmerRuntime.uiRefresh === 'function') farmerRuntime.uiRefresh();
                if (farmerRuntime.wasInitiatedByMod) {
                    tryPauseGameAutoplay();
                    await farmerSleep(400);
                }

                const navigated = await farmerNavigateToMap(next.roomId);
                if (!navigated) {
                    farmerRuntime.status = 'nav-failed';
                    return;
                }
                await farmerSetFloor(pickAwakenFarmFloor(next.roomId) ?? AWAKEN_FARM_MIN_FLOOR);
                await farmerSleep(400);

                if (getEffectiveFarmerAutoRefill(next.roomId)) farmerApplyAutomatorRefill(true);
                else farmerApplyAutomatorRefill(false);

                const setupOk = await farmerLoadSetup(getEffectiveFarmerSetupLabel(next.roomId), next.roomId);
                if (!setupOk && !farmerHasCreaturesOnBoard()) {
                    console.warn('[Awaken Farmer] Setup/board empty for', next.mapName);
                    farmerRuntime.status = 'setup-failed';
                    farmerRuntime.currentRoomId = next.roomId;
                    return;
                }

                const started = await farmerBeginAutoplay(next.roomId);
                if (started) {
                    farmerRuntime.currentRoomId = next.roomId;
                    farmerRuntime.status = 'farming';
                    console.log(`[Awaken Farmer] Farming ${next.mapName} (${targets.length} species left)`);
                } else if (farmerRuntime.status !== 'waiting-stamina') {
                    farmerRuntime.status = 'start-failed';
                }
            } else {
                farmerRuntime.status = 'farming';
                farmerRuntime.currentRoomId = next.roomId;
                if (!farmerIsStaminaRecoveryActive()) {
                    farmerSetupStaminaDepletionWatch(next.roomId);
                }
            }
        } catch (e) {
            console.warn('[Awaken Farmer] tick failed:', e);
            farmerRuntime.status = 'error';
        } finally {
            farmerRuntime.busy = false;
            if (typeof farmerRuntime.uiRefresh === 'function') farmerRuntime.uiRefresh();
        }
    }

    let farmerLastStartToastAt = 0;
    const FARMER_START_TOAST_COOLDOWN_MS = 4000;

    function showFarmerToast(message, duration = 5000) {
        try {
            let mainContainer = document.getElementById('awaken-farmer-toast-container');
            if (!mainContainer) {
                mainContainer = document.createElement('div');
                mainContainer.id = 'awaken-farmer-toast-container';
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
            iconImg.alt = 'awaken';
            iconImg.src = BADGE_ICONS.awakened;
            iconImg.className = 'pixelated';
            iconImg.style.cssText = 'width: 16px; height: 16px; image-rendering: pixelated;';
            widgetBottom.appendChild(iconImg);

            const messageDiv = document.createElement('div');
            messageDiv.className = 'text-left';
            messageDiv.textContent = message;
            widgetBottom.appendChild(messageDiv);

            toast.appendChild(widgetTop);
            toast.appendChild(widgetBottom);
            flexContainer.appendChild(toast);
            mainContainer.appendChild(flexContainer);

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
            console.warn('[Awaken Farmer] Error showing toast:', error);
        }
    }

    function showFarmerStartingToast() {
        const now = Date.now();
        if (now - farmerLastStartToastAt < FARMER_START_TOAST_COOLDOWN_MS) return;
        farmerLastStartToastAt = now;
        showFarmerToast(t('mods.awakenTracker.farmerStartingToast'));
    }

    function startFarmerLoop() {
        if (!farmerBootGraceDone) {
            console.log('[Awaken Farmer] Deferring start until boot grace ends');
            return;
        }
        stopFarmerLoop(false);
        const settings = loadFarmerSettings();
        if (!settings.enabled) return;
        syncFarmerModCoordination();
        if (settings.autoRefillStamina) farmerApplyAutomatorRefill(true);
        farmerRuntime.status = 'starting';
        farmerRuntime.lastBlockReason = null;
        console.log('[Awaken Farmer] Starting farm loop');
        if (typeof farmerRuntime.uiRefresh === 'function') farmerRuntime.uiRefresh();
        // Start delay is applied once inside farmerRunTick before each navigate
        farmerRunTick();
        farmerRuntime.tickTimer = setInterval(() => { farmerRunTick(); }, FARMER_TICK_MS);
    }

    function stopFarmerLoop(releaseControl = true) {
        if (farmerRuntime.resumeTimer) {
            clearTimeout(farmerRuntime.resumeTimer);
            farmerRuntime.resumeTimer = null;
        }
        if (farmerRuntime.tickTimer) {
            clearInterval(farmerRuntime.tickTimer);
            farmerRuntime.tickTimer = null;
        }
        farmerStopStaminaMonitoring();
        if (releaseControl && farmerRuntime.wasInitiatedByMod) {
            farmerStopAutoplay();
        }
        if (farmerRuntime.enabledRefill) {
            // Leave Automator refill as-is if user may want it; only clear our tracking flag.
            farmerRuntime.enabledRefill = false;
        }
        farmerRuntime.status = 'idle';
        syncFarmerModCoordination();
        if (typeof farmerRuntime.uiRefresh === 'function') farmerRuntime.uiRefresh();
    }

    function setFarmerEnabled(enabled) {
        const next = saveFarmerSettings({ enabled: !!enabled });
        if (next.enabled) {
            // Manual enable skips remaining boot wait so the user can start immediately.
            farmerBootGraceDone = true;
            startFarmerLoop();
        } else {
            stopFarmerLoop(true);
        }
        updateAwakenTrackerButton();
        return next;
    }

    function toggleFarmerEnabled() {
        return setFarmerEnabled(!loadFarmerSettings().enabled);
    }

    function applyAwakenTrackerButtonStyling(btn) {
        if (!btn) return;
        const regularBgUrl = 'https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png';
        const greenBgUrl = 'https://bestiaryarena.com/_next/static/media/background-green.be515334.png';
        btn.style.background = '';
        btn.style.backgroundColor = '';
        if (loadFarmerSettings().enabled) {
            btn.style.background = `url('${greenBgUrl}') repeat`;
            btn.style.backgroundSize = 'auto';
        } else {
            btn.style.background = `url('${regularBgUrl}') repeat`;
        }
    }

    function updateAwakenTrackerButton() {
        const btn = document.getElementById(BUTTON_ID);
        if (btn) applyAwakenTrackerButtonStyling(btn);
    }

    // =======================
    // 10. UI — floating panel
    // =======================
    const AT_STYLE_ID = 'awaken-tracker-styles';

    function injectStyles() {
        if (document.getElementById(AT_STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = AT_STYLE_ID;
        style.textContent = `
            #${PANEL_ID} {
                --at-frame-3: url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill;
                --at-frame-1: url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 4 fill;
                --at-frame-1-pressed: url("https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png") 4 fill;
                --at-frame-4: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch;
                --at-bg-panel: url(/_next/static/media/background-dark.95edca67.png);
                --at-bg-header: url(/_next/static/media/background-dark.95edca67.png);
                --at-bg-section: url(/_next/static/media/background-regular.b0337118.png);
                --at-panel-bg: #282C34;
                --at-section-bg: #323234;
                --at-text: #ABB2BF;
                --at-text-gold: #E5C07B;
                --at-text-accent: #E06C75;
                --at-text-stats: #98C379;
                --at-text-info: #61AFEF;
                --at-border: #3A404A;
                --at-border-dark: #2C313A;
                --at-entry-bg: rgba(59,64,72,0.3);
                --at-section-bg-alpha: rgba(40,44,52,0.4);
                position: fixed;
                /* Above Autoseller auto badges (100) and board UI (z-1..z-10),
                   below native game context menus (z-modals = 200). */
                z-index: 150;
                overflow: visible;
                box-sizing: border-box;
                padding: 0;
                margin: 0;
            }
            #${PANEL_ID} > .at-panel-frame {
                width: 100%;
                height: 100%;
                box-sizing: border-box;
                background-image: var(--at-bg-panel);
                background-repeat: repeat;
                background-color: var(--at-panel-bg);
                border: 6px solid transparent;
                border-image: var(--at-frame-3);
                color: var(--at-text);
                padding: 0;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                font-family: Inter, sans-serif;
                box-shadow: 0 0 15px rgba(0,0,0,0.7);
            }
            #${PANEL_ID} .at-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 8px;
                background-image: var(--at-bg-header);
                background-repeat: repeat;
                background-color: var(--at-panel-bg);
                border: 6px solid transparent;
                border-image: var(--at-frame-4);
                margin: 0 2px;
                cursor: move;
                user-select: none;
                flex: 0 0 auto;
            }
            #${PANEL_ID} .at-title {
                font-weight: bold;
                color: var(--at-text-gold);
                font-size: 14px;
                text-shadow: 0 0 5px rgba(229,192,123,0.5);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
                min-width: 0;
            }
            #${PANEL_ID} .at-footer-actions {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 6px;
                flex: 1 1 auto;
                min-width: 0;
                max-width: 100%;
            }
            #${PANEL_ID} .at-styled-btn {
                padding: 2px 10px;
                border: 4px solid transparent;
                border-image: var(--at-frame-1);
                background-image: var(--at-bg-header);
                background-repeat: repeat;
                background-color: var(--at-panel-bg);
                color: var(--at-text);
                font-size: 11px;
                font-weight: 700;
                font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
                text-align: center;
                white-space: nowrap;
                cursor: pointer;
                box-shadow: 0 2px 5px rgba(0,0,0,0.5);
                min-height: 24px;
                line-height: 1.1;
                transition: color 0.2s, filter 0.15s;
                flex: 0 1 auto;
                min-width: 0;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                box-sizing: border-box;
            }
            #${PANEL_ID} .at-styled-btn:hover {
                filter: brightness(1.12);
                color: #fff;
            }
            #${PANEL_ID} .at-styled-btn:active {
                border-image: var(--at-frame-1-pressed);
                filter: brightness(0.95);
            }
            #${PANEL_ID} .at-styled-btn.at-confirm {
                background-color: #8b0000;
                background-image: none;
                color: #fff;
            }
            #${PANEL_ID} .at-icon-btn {
                background: transparent;
                border: 4px solid transparent;
                border-image: var(--at-frame-1);
                color: var(--at-text);
                padding: 0 6px;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
                min-width: 20px;
                min-height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }
            #${PANEL_ID} .at-icon-btn:hover {
                background-color: var(--at-border);
                color: #fff;
            }
            #${PANEL_ID} .at-icon-btn:active {
                border-image: var(--at-frame-1-pressed);
            }
            #${PANEL_ID} .at-tab-bar {
                display: flex;
                margin: 0 2px;
                flex: 0 0 auto;
                min-width: 0;
            }
            #${PANEL_ID} .at-tab-btn {
                flex: 1 1 auto;
                min-width: max-content;
                padding: 5px 8px;
                border: 4px solid transparent;
                border-image: var(--at-frame-1);
                background-image: var(--at-bg-header);
                background-repeat: repeat;
                background-color: var(--at-panel-bg);
                color: #888;
                font-size: 12px;
                font-weight: bold;
                font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
                cursor: pointer;
                transition: color 0.15s, filter 0.15s;
                white-space: nowrap;
                box-sizing: border-box;
            }
            #${PANEL_ID} .at-tab-btn:hover {
                filter: brightness(1.1);
                color: var(--at-text);
            }
            #${PANEL_ID} .at-tab-btn.active {
                color: var(--at-text-gold);
                border-image: var(--at-frame-1-pressed);
                background-image: var(--at-bg-panel);
            }
            #${PANEL_ID} .at-body {
                flex: 1 1 auto;
                overflow-y: auto;
                padding: 6px;
                background-image: var(--at-bg-panel);
                background-repeat: repeat;
                background-color: var(--at-panel-bg);
                border: 6px solid transparent;
                border-image: var(--at-frame-4);
                margin: 0 2px;
            }
            #${PANEL_ID} .at-overview-body {
                flex: 1 1 auto;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            #${PANEL_ID} .at-section {
                padding: 6px 12px;
                background-image: var(--at-bg-section);
                background-repeat: repeat;
                background-color: var(--at-section-bg);
                border: 6px solid transparent;
                border-image: var(--at-frame-4);
                margin: 0 2px;
                flex: 0 0 auto;
            }
            #${PANEL_ID} .at-footer {
                flex: 0 0 auto;
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                gap: 6px 8px;
                padding: 4px 8px;
                background-image: var(--at-bg-header);
                background-repeat: repeat;
                background-color: var(--at-panel-bg);
                border: 6px solid transparent;
                border-image: var(--at-frame-4);
                margin: 0 2px 2px;
                font-size: 10px;
                color: #888;
                min-width: 0;
                box-sizing: border-box;
                overflow: hidden;
            }
            #${PANEL_ID} .at-footer.overview-only {
                justify-content: flex-start;
            }
            #${PANEL_ID} .at-footer-farmer {
                display: flex;
                align-items: center;
                gap: 6px;
                flex: 1 1 auto;
                min-width: 0;
                max-width: 100%;
            }
            #${PANEL_ID} .at-footer-farmer .at-farmer-toggle {
                width: auto;
                flex: 0 1 auto;
                padding: 3px 8px;
                font-size: 11px;
                white-space: nowrap;
                min-width: 0;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #${PANEL_ID} .at-footer-credits {
                flex: 0 1 auto;
                margin-left: auto;
                white-space: nowrap;
                min-width: 0;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #${PANEL_ID} .at-footer a {
                color: var(--at-text-gold);
                text-decoration: none;
            }
            #${PANEL_ID} .at-footer a:hover {
                text-decoration: underline;
            }
            #${PANEL_ID} .at-input {
                background: var(--at-panel-bg);
                color: var(--at-text);
                border: 1px solid var(--at-border);
                border-radius: 3px;
                padding: 4px 8px;
                font-size: 11px;
                outline: none;
            }
            #${PANEL_ID} .at-input:focus {
                border-color: var(--at-text-gold);
            }
            #${PANEL_ID} .at-row {
                padding: 6px 8px;
                background: var(--at-entry-bg);
                border: 4px solid transparent;
                border-image: var(--at-frame-1);
                transition: background 0.15s;
            }
            #${PANEL_ID} .at-row:hover {
                background: rgba(59,64,72,0.5);
            }
            #${PANEL_ID} .awaken-tracker-slot {
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 6px;
            }
            #${PANEL_ID} .awaken-tracker-slot.collapsed {
                padding: 4px 6px;
            }
            #${PANEL_ID} .awaken-overview-row {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 8px;
            }
            #${PANEL_ID} .awaken-farm-row {
                cursor: pointer;
            }
            #${PANEL_ID} .awaken-farm-row.is-raid {
                box-shadow: inset 3px 0 0 #7a1f1f;
            }
            #${PANEL_ID} .awaken-farm-row.is-current {
                outline: 1px solid rgba(127,222,127,0.45);
            }
            #${PANEL_ID} .awaken-farm-custom-indicator {
                margin-left: 4px;
                cursor: help;
                vertical-align: middle;
                display: inline-flex;
                align-items: center;
            }
            #${PANEL_ID} .awaken-farm-custom-indicator img {
                image-rendering: pixelated;
                filter: drop-shadow(0 0 1px #ff4444);
            }
            #${PANEL_ID} .at-farmer-body {
                display: none;
                flex-direction: column;
                flex: 1 1 auto;
                min-height: 0;
                overflow: hidden;
                background-image: var(--at-bg-panel);
                background-repeat: repeat;
                border: 6px solid transparent;
                border-image: var(--at-frame-4);
                margin: 0 2px;
            }
            #${PANEL_ID} .at-farmer-controls {
                display: flex;
                flex-direction: column;
                gap: 6px;
                padding: 8px;
                flex: 0 0 auto;
            }
            #${PANEL_ID} .at-farmer-controls label.at-check {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 11px;
                cursor: pointer;
                user-select: none;
            }
            #${PANEL_ID} .at-farmer-toggle {
                width: 100%;
                flex: 1 1 auto;
                padding: 6px 10px;
                border: 4px solid transparent;
                border-image: var(--at-frame-1);
                font-size: 12px;
                font-weight: bold;
                font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
                color: #fff;
                cursor: pointer;
                text-align: center;
                background-repeat: repeat;
                background-size: auto;
            }
            #${PANEL_ID} .at-farmer-toggle.is-on {
                background-image: url('https://bestiaryarena.com/_next/static/media/background-green.be515334.png');
            }
            #${PANEL_ID} .at-farmer-toggle.is-off {
                background-image: url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png');
                color: var(--at-text);
            }
            #${PANEL_ID} .at-farmer-toggle:hover {
                filter: brightness(1.08);
            }
            #${PANEL_ID} .at-farmer-toggle:active {
                border-image: var(--at-frame-1-pressed);
            }
            #${PANEL_ID} .at-help-tip {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: help;
                flex: 0 0 auto;
                user-select: none;
                opacity: 0.85;
            }
            #${PANEL_ID} .at-help-tip:hover {
                opacity: 1;
            }
            #${PANEL_ID} .at-help-tip img {
                image-rendering: pixelated;
                display: block;
            }
            #${PANEL_ID} .at-farmer-list {
                flex: 1 1 auto;
                overflow-y: auto;
                padding: 6px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
        `;
        document.head.appendChild(style);
    }

    function addResizeHandles(panel) {
        const directions = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'];
        for (const dir of directions) {
            const handle = document.createElement('div');
            handle.className = 'resize-handle resize-handle-' + dir;
            handle.setAttribute('data-dir', dir);
            handle.style.position = 'absolute';
            handle.style.zIndex = '10';
            handle.style.background = 'transparent';
            handle.style.userSelect = 'none';
            handle.setAttribute('aria-label', 'Resize ' + dir);
            if (dir.length === 1) {
                if (dir === 'n' || dir === 's') {
                    handle.style.height = '6px';
                    handle.style.width = '100%';
                    handle.style.cursor = dir + '-resize';
                    handle.style[dir === 'n' ? 'top' : 'bottom'] = '0';
                    handle.style.left = '0';
                } else {
                    handle.style.width = '6px';
                    handle.style.height = '100%';
                    handle.style.cursor = dir + '-resize';
                    handle.style[dir === 'w' ? 'left' : 'right'] = '0';
                    handle.style.top = '0';
                }
            } else {
                handle.style.width = '12px';
                handle.style.height = '12px';
                handle.style.cursor = dir + '-resize';
                handle.style[dir.includes('n') ? 'top' : 'bottom'] = '0';
                handle.style[dir.includes('w') ? 'left' : 'right'] = '0';
            }
            panel.appendChild(handle);
        }
    }

    function onResizeHandleMouseDown(e) {
        const dir = e.target.getAttribute('data-dir');
        if (!dir) return;
        const panel = e.target.parentElement;
        if (!panel || panel.id !== PANEL_ID) return;
        const rect = panel.getBoundingClientRect();
        Object.assign(panelResizeState, {
            isResizing: true,
            resizeDir: dir,
            resizeStartX: e.clientX,
            resizeStartY: e.clientY,
            startWidth: rect.width,
            startHeight: rect.height,
            startLeft: rect.left,
            startTop: rect.top
        });
        panel.classList.add('resizing');
        document.body.style.userSelect = 'none';
        e.preventDefault();
        e.stopPropagation();
    }

    function ensurePanelResizeListeners() {
        if (panelResizeMouseMoveHandler) return;
        panelResizeMouseMoveHandler = (e) => {
            if (!panelResizeState.isResizing) return;
            const panel = document.getElementById(PANEL_ID);
            if (!panel) return;
            const dx = e.clientX - panelResizeState.resizeStartX;
            const dy = e.clientY - panelResizeState.resizeStartY;
            let newWidth = panelResizeState.startWidth;
            let newHeight = panelResizeState.startHeight;
            let newLeft = panelResizeState.startLeft;
            let newTop = panelResizeState.startTop;
            const { minWidth, maxWidth, minHeight, maxHeight } = PANEL_LAYOUT;

            if (panelResizeState.resizeDir.includes('e')) {
                newWidth = clampPanelSize(panelResizeState.startWidth + dx, minWidth, maxWidth);
            }
            if (panelResizeState.resizeDir.includes('w')) {
                const rightEdge = panelResizeState.startLeft + panelResizeState.startWidth;
                newWidth = clampPanelSize(panelResizeState.startWidth - dx, minWidth, maxWidth);
                newLeft = rightEdge - newWidth;
            }
            if (panelResizeState.resizeDir.includes('s')) {
                newHeight = clampPanelSize(panelResizeState.startHeight + dy, minHeight, maxHeight);
            }
            if (panelResizeState.resizeDir.includes('n')) {
                const bottomEdge = panelResizeState.startTop + panelResizeState.startHeight;
                newHeight = clampPanelSize(panelResizeState.startHeight - dy, minHeight, maxHeight);
                newTop = bottomEdge - newHeight;
            }

            panel.style.width = newWidth + 'px';
            panel.style.height = newHeight + 'px';
            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
        };
        panelResizeMouseUpHandler = () => {
            if (!panelResizeState.isResizing) return;
            const panel = document.getElementById(PANEL_ID);
            if (panel) {
                panel.classList.remove('resizing');
                savePanelSettings({
                    left: parseInt(panel.style.left, 10) || 0,
                    top: parseInt(panel.style.top, 10) || 0,
                    width: parseInt(panel.style.width, 10) || PANEL_DEFAULTS.width,
                    height: parseInt(panel.style.height, 10) || PANEL_DEFAULTS.height
                });
            }
            document.body.style.userSelect = '';
            panelResizeState.reset();
        };
        document.addEventListener('mousemove', panelResizeMouseMoveHandler);
        document.addEventListener('mouseup', panelResizeMouseUpHandler);
    }

    function teardownPanelResizeListeners() {
        if (panelResizeMouseMoveHandler) {
            document.removeEventListener('mousemove', panelResizeMouseMoveHandler);
            panelResizeMouseMoveHandler = null;
        }
        if (panelResizeMouseUpHandler) {
            document.removeEventListener('mouseup', panelResizeMouseUpHandler);
            panelResizeMouseUpHandler = null;
        }
        panelResizeState.reset();
        document.body.style.userSelect = '';
    }

    function updatePanelPosition() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.style.display === 'none') return;

        const maxLeft = window.innerWidth - panel.offsetWidth;
        const maxTop = window.innerHeight - panel.offsetHeight;
        const rect = panel.getBoundingClientRect();
        let changed = false;

        if (rect.left < 0) {
            panel.style.left = '0px';
            changed = true;
        } else if (rect.left > maxLeft) {
            panel.style.left = Math.max(0, maxLeft) + 'px';
            changed = true;
        }

        if (rect.top < 0) {
            panel.style.top = '0px';
            changed = true;
        } else if (rect.top > maxTop) {
            panel.style.top = Math.max(0, maxTop) + 'px';
            changed = true;
        }

        if (changed) {
            savePanelSettings({
                left: parseInt(panel.style.left, 10) || 0,
                top: parseInt(panel.style.top, 10) || 0
            });
        }
    }

    function attachPanelViewportListener() {
        if (panelViewportListenerAttached) return;
        window.addEventListener('resize', updatePanelPosition);
        panelViewportListenerAttached = true;
    }

    function detachPanelViewportListener() {
        if (!panelViewportListenerAttached) return;
        window.removeEventListener('resize', updatePanelPosition);
        panelViewportListenerAttached = false;
    }

    function createPanel() {
        injectStyles();
        const s = loadPanelSettings();
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        const clampedWidth = clampPanelSize(s.width, PANEL_LAYOUT.minWidth, PANEL_LAYOUT.maxWidth);
        const clampedHeight = clampPanelSize(s.height, PANEL_LAYOUT.minHeight, PANEL_LAYOUT.maxHeight);
        panel.style.cssText =
            `left:${s.left}px;top:${s.top}px;width:${clampedWidth}px;height:${clampedHeight}px;` +
            `min-width:${PANEL_LAYOUT.minWidth}px;max-width:${PANEL_LAYOUT.maxWidth}px;` +
            `min-height:${PANEL_LAYOUT.minHeight}px;max-height:${PANEL_LAYOUT.maxHeight}px;`;

        const frame = document.createElement('div');
        frame.className = 'at-panel-frame';
        panel.appendChild(frame);
        panel._frame = frame;

        const header = document.createElement('div');
        header.className = 'at-header';
        const titleEl = document.createElement('span');
        titleEl.id = TITLE_ID;
        titleEl.className = 'at-title';
        titleEl.textContent = '';
        header.appendChild(titleEl);

        const makeConfirmButton = (baseLabel, confirmLabel, title, onConfirm) => {
            const b = document.createElement('button');
            b.textContent = baseLabel;
            b.title = title;
            b.className = 'at-styled-btn';

            let armed = false;
            let timeoutId = null;
            let outsideHandler = null;
            const reset = () => {
                activeConfirmButtonResets.delete(reset);
                armed = false;
                b.textContent = baseLabel;
                b.classList.remove('at-confirm');
                if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
                if (outsideHandler) {
                    document.removeEventListener('mousedown', outsideHandler, true);
                    outsideHandler = null;
                }
            };

            b.addEventListener('click', () => {
                if (!armed) {
                    armed = true;
                    b.textContent = confirmLabel;
                    b.classList.add('at-confirm');
                    activeConfirmButtonResets.add(reset);
                    timeoutId = setTimeout(reset, 4000);
                    outsideHandler = (event) => {
                        if (event.target !== b) reset();
                    };
                    document.addEventListener('mousedown', outsideHandler, true);
                    return;
                }
                reset();
                onConfirm();
            });
            return b;
        };

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.title = t('mods.awakenTracker.close');
        closeBtn.className = 'at-icon-btn';
        closeBtn.addEventListener('click', closePanel);
        header.appendChild(closeBtn);
        frame.appendChild(header);

        const footer = document.createElement('div');
        footer.className = 'at-footer';

        const footerActions = document.createElement('div');
        footerActions.className = 'at-footer-actions';

        const clearMapBtn = makeConfirmButton(
            t('mods.awakenTracker.clearMap'),
            t('mods.awakenTracker.confirmClearMap'),
            t('mods.awakenTracker.clearMapTooltip'),
            () => {
            if (!state.currentRoomId) return;
            state.byMap.delete(state.currentRoomId);
            state.baselineByMap.delete(state.currentRoomId);
            clearPauseOnCapOptOutsForGameIds((state.currentMapEnemies || []).map(e => e.gameId));
            ensureMapBaseline(state.currentRoomId);
            render();
            scheduleSave();
        });
        footerActions.appendChild(clearMapBtn);

        const clearAllBtn = makeConfirmButton(
            t('mods.awakenTracker.clearAll'),
            t('mods.awakenTracker.confirm'),
            t('mods.awakenTracker.clearAllTooltip'),
            () => {
            state.byMap.clear();
            state.baselineByMap.clear();
            state.pauseOnCapOptOut.clear();
            snapshotBaseline();
            if (state.currentRoomId) {
                ensureMapBaseline(state.currentRoomId);
            }
            render();
            scheduleSave();
        });
        footerActions.appendChild(clearAllBtn);

        const farmerToggleBtn = document.createElement('button');
        farmerToggleBtn.type = 'button';
        farmerToggleBtn.className = 'at-farmer-toggle is-off';
        farmerToggleBtn.title = t('mods.awakenTracker.farmerEnableAutomation');

        const farmerHelpTip = createHelpTip(t('mods.awakenTracker.farmerHint'));
        const footerFarmer = document.createElement('div');
        footerFarmer.className = 'at-footer-farmer';
        footerFarmer.appendChild(farmerToggleBtn);
        footerFarmer.appendChild(farmerHelpTip);

        const footerCredits = document.createElement('span');
        footerCredits.className = 'at-footer-credits';
        footerCredits.innerHTML = t('mods.awakenTracker.creditsHtml');

        footer.appendChild(footerFarmer);
        footer.appendChild(footerActions);
        footer.appendChild(footerCredits);

        // =======================
        // Tab bar
        // =======================
        const tabBar = document.createElement('div');
        tabBar.className = 'at-tab-bar';

        const tabTrackerBtn = document.createElement('button');
        const tabOverviewBtn = document.createElement('button');
        const tabFarmerBtn = document.createElement('button');
        tabTrackerBtn.className = 'at-tab-btn';
        tabOverviewBtn.className = 'at-tab-btn';
        tabFarmerBtn.className = 'at-tab-btn';

        tabTrackerBtn.textContent = t('mods.awakenTracker.tabTracker');
        tabOverviewBtn.textContent = t('mods.awakenTracker.tabOverview');
        tabFarmerBtn.textContent = t('mods.awakenTracker.tabFarmer');

        const trackerBody = document.createElement('div');
        trackerBody.className = 'at-body';
        const grid = document.createElement('div');
        grid.id = GRID_ID;
        grid.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
        trackerBody.appendChild(grid);

        const overviewBody = document.createElement('div');
        overviewBody.className = 'at-overview-body';

        const farmerBody = document.createElement('div');
        farmerBody.className = 'at-farmer-body';

        function switchTab(tab) {
            const isTracker = tab === 'tracker';
            const isOverview = tab === 'overview';
            const isFarmer = tab === 'farmer';
            trackerBody.style.display = isTracker ? 'block' : 'none';
            overviewBody.style.display = isOverview ? 'flex' : 'none';
            farmerBody.style.display = isFarmer ? 'flex' : 'none';
            footerActions.style.display = isTracker ? 'flex' : 'none';
            footer.classList.toggle('overview-only', !isTracker);
            tabTrackerBtn.classList.toggle('active', isTracker);
            tabOverviewBtn.classList.toggle('active', isOverview);
            tabFarmerBtn.classList.toggle('active', isFarmer);
            if (isTracker) render();
            if (isOverview) renderOverview();
            if (isFarmer) renderFarmerTab();
            savePanelSettings({ activeTab: tab });
        }

        tabTrackerBtn.addEventListener('click', () => switchTab('tracker'));
        tabOverviewBtn.addEventListener('click', () => switchTab('overview'));
        tabFarmerBtn.addEventListener('click', () => switchTab('farmer'));

        tabBar.appendChild(tabTrackerBtn);
        tabBar.appendChild(tabOverviewBtn);
        tabBar.appendChild(tabFarmerBtn);
        frame.appendChild(tabBar);
        frame.appendChild(trackerBody);

        // =======================
        // Overview tab content
        // =======================
        const overviewSummary = document.createElement('div');
        overviewSummary.className = 'at-section';
        overviewSummary.style.cssText = 'font-size:11px;color:#b8b8b8;';

        const overviewFilterBar = document.createElement('div');
        overviewFilterBar.className = 'at-section';
        overviewFilterBar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';

        const overviewFilterInput = document.createElement('input');
        overviewFilterInput.type = 'text';
        overviewFilterInput.placeholder = t('mods.awakenTracker.filterPlaceholder');
        overviewFilterInput.className = 'at-input';
        overviewFilterInput.style.cssText = 'flex:1;min-width:120px;';

        const overviewViewSelect = document.createElement('select');
        overviewViewSelect.className = 'at-input';
        for (const [val, labelKey] of OVERVIEW_VIEW_OPTIONS) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = t(`mods.awakenTracker.${labelKey}`);
            overviewViewSelect.appendChild(opt);
        }

        const farmToggleBtn = document.createElement('button');
        farmToggleBtn.title = t('mods.awakenTracker.farmMapsToggle');
        farmToggleBtn.className = 'at-styled-btn';
        farmToggleBtn.style.cssText = 'flex-basis:100%;display:inline-flex;align-items:center;justify-content:center;gap:6px;';
        farmToggleBtn.appendChild(createUiIcon(UI_ICONS.map, 14));
        const farmToggleLabel = document.createElement('span');
        farmToggleLabel.textContent = t('mods.awakenTracker.farmMaps');
        farmToggleBtn.appendChild(farmToggleLabel);

        overviewFilterBar.appendChild(overviewFilterInput);
        overviewFilterBar.appendChild(overviewViewSelect);
        overviewFilterBar.appendChild(farmToggleBtn);

        const overviewMainArea = document.createElement('div');
        overviewMainArea.style.cssText = 'flex:1;display:flex;flex-direction:row;min-height:0;overflow:hidden;';

        const farmSection = document.createElement('div');
        farmSection.style.cssText = 'display:none;flex-direction:column;width:440px;min-width:340px;border-right:1px solid var(--at-border);overflow:hidden;flex-shrink:0;';

        const farmHeader = document.createElement('div');
        farmHeader.className = 'at-section';
        farmHeader.style.cssText = 'display:flex;align-items:center;gap:6px;';
        farmHeader.innerHTML = `<strong style="color:var(--at-text-gold);font-size:12px;display:inline-flex;align-items:center;gap:6px;">${uiIconHtml(UI_ICONS.map, 14)}${t('mods.awakenTracker.farmMapsTitle')}</strong>`;

        const hideRaidsLabel = document.createElement('label');
        hideRaidsLabel.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#b8b8b8;cursor:pointer;margin-left:auto;';
        hideRaidsLabel.title = t('mods.awakenTracker.hideRaidsTooltip');
        const hideRaidsInput = document.createElement('input');
        hideRaidsInput.type = 'checkbox';
        hideRaidsInput.checked = s.hideRaids === true;
        hideRaidsInput.style.cssText = 'margin:0;cursor:pointer;';
        const hideRaidsText = document.createElement('span');
        hideRaidsText.textContent = t('mods.awakenTracker.hideRaids');
        hideRaidsLabel.appendChild(hideRaidsInput);
        hideRaidsLabel.appendChild(hideRaidsText);
        farmHeader.appendChild(hideRaidsLabel);

        hideRaidsInput.addEventListener('change', () => {
            savePanelSettings({ hideRaids: hideRaidsInput.checked });
            if (farmSection.style.display !== 'none') renderFarmMaps();
        });

        const farmCloseBtn = document.createElement('button');
        farmCloseBtn.textContent = '×';
        farmCloseBtn.title = t('mods.awakenTracker.closeFarmPanel');
        farmCloseBtn.className = 'at-icon-btn';
        farmHeader.appendChild(farmCloseBtn);

        const farmSummaryEl = document.createElement('div');
        farmSummaryEl.className = 'at-section';
        farmSummaryEl.style.cssText = 'font-size:10px;color:#b8b8b8;';

        const farmListEl = document.createElement('div');
        farmListEl.style.cssText = 'flex:1;overflow-y:auto;padding:6px;display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:6px;align-content:start;';

        farmSection.appendChild(farmHeader);
        farmSection.appendChild(farmSummaryEl);
        farmSection.appendChild(farmListEl);

        const overviewGridWrapper = document.createElement('div');
        overviewGridWrapper.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;';

        const overviewVisibleCounter = document.createElement('div');
        overviewVisibleCounter.className = 'at-section';
        overviewVisibleCounter.style.cssText = 'font-size:11px;color:var(--at-text-info);font-weight:bold;text-align:right;';

        const overviewGrid = document.createElement('div');
        overviewGrid.style.cssText = 'flex:1;overflow-y:auto;padding:6px;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:6px;align-content:start;';

        overviewGridWrapper.appendChild(overviewVisibleCounter);
        overviewGridWrapper.appendChild(overviewGrid);
        overviewMainArea.appendChild(farmSection);
        overviewMainArea.appendChild(overviewGridWrapper);

        overviewBody.appendChild(overviewSummary);
        overviewBody.appendChild(overviewFilterBar);
        overviewBody.appendChild(overviewMainArea);
        frame.appendChild(overviewBody);

        // =======================
        // Farmer tab content
        // =======================
        const farmerControls = document.createElement('div');
        farmerControls.className = 'at-section at-farmer-controls';

        const farmerRefillLabel = document.createElement('label');
        farmerRefillLabel.className = 'at-check';
        const farmerRefillInput = document.createElement('input');
        farmerRefillInput.type = 'checkbox';
        farmerRefillLabel.appendChild(farmerRefillInput);
        farmerRefillLabel.appendChild(document.createTextNode(t('mods.awakenTracker.farmerAutoRefill')));

        const farmerSetupRow = document.createElement('div');
        farmerSetupRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
        const farmerSetupLabelEl = document.createElement('span');
        farmerSetupLabelEl.textContent = t('mods.awakenTracker.farmerSetupLabel');
        farmerSetupLabelEl.style.cssText = 'font-size:11px;color:#b8b8b8;';
        const farmerSetupSelect = document.createElement('select');
        farmerSetupSelect.className = 'at-input';
        farmerSetupSelect.style.cssText = 'flex:1;min-width:140px;';
        farmerSetupRow.appendChild(farmerSetupLabelEl);
        farmerSetupRow.appendChild(farmerSetupSelect);

        farmerControls.appendChild(farmerRefillLabel);
        farmerControls.appendChild(farmerSetupRow);

        const farmerSummaryEl = document.createElement('div');
        farmerSummaryEl.className = 'at-section';
        farmerSummaryEl.style.cssText = 'font-size:10px;color:#b8b8b8;';

        const farmerListEl = document.createElement('div');
        farmerListEl.className = 'at-farmer-list';

        farmerBody.appendChild(farmerControls);
        farmerBody.appendChild(farmerSummaryEl);
        farmerBody.appendChild(farmerListEl);
        frame.appendChild(farmerBody);

        function populateFarmerSetupOptions(selected) {
            const labels = getFarmerSetupLabels();
            farmerSetupSelect.innerHTML = '';
            const autoOpt = document.createElement('option');
            autoOpt.value = '';
            autoOpt.textContent = t('mods.awakenTracker.farmerAutoSetup');
            farmerSetupSelect.appendChild(autoOpt);
            for (const label of labels) {
                const opt = document.createElement('option');
                opt.value = label;
                opt.textContent = label;
                farmerSetupSelect.appendChild(opt);
            }
            farmerSetupSelect.value = selected || '';
            if (selected && farmerSetupSelect.value !== selected) {
                const custom = document.createElement('option');
                custom.value = selected;
                custom.textContent = selected;
                farmerSetupSelect.appendChild(custom);
                farmerSetupSelect.value = selected;
            }
        }

        function updateFarmerToggleButton(enabled) {
            const on = enabled === true;
            farmerToggleBtn.classList.toggle('is-on', on);
            farmerToggleBtn.classList.toggle('is-off', !on);
            farmerToggleBtn.textContent = on
                ? t('mods.awakenTracker.farmerAutomationOn')
                : t('mods.awakenTracker.farmerAutomationOff');
        }

        function renderFarmerTab() {
            const settings = loadFarmerSettings();
            updateFarmerToggleButton(settings.enabled);
            farmerRefillInput.checked = settings.autoRefillStamina;
            populateFarmerSetupOptions(settings.setupLabel);

            const { targets, wantedIds, namesById } = collectAwakenedNotCappedTargets();
            const ranked = rankMapsForWantedIds(wantedIds, namesById);
            const queue = ranked.results || [];

            const targetSummary = targets.slice(0, 8).map(x => x.name).join(', ')
                + (targets.length > 8 ? ` … +${targets.length - 8}` : '');
            const farmerDetailsTip = [
                t('mods.awakenTracker.farmTargets', { summary: targetSummary || '—' }),
                t('mods.awakenTracker.farmerSortHint')
            ].join(' · ');
            farmerSummaryEl.innerHTML =
                `<div style="display:flex;align-items:center;gap:6px;">` +
                    `<div style="flex:1;min-width:0;">${t('mods.awakenTracker.farmerSearchingHtml', { creatureCount: targets.length, mapCount: queue.length })}</div>` +
                    helpTipHtml(farmerDetailsTip) +
                `</div>`;

            if (ranked.error === 'utils') {
                farmerListEl.innerHTML = `<div style="padding:12px;color:#d87d7d;text-align:center;">${t('mods.awakenTracker.utilsUnavailable')}</div>`;
                return;
            }
            if (targets.length === 0) {
                farmerListEl.innerHTML = `<div style="padding:12px;color:#888;text-align:center;">${t('mods.awakenTracker.farmerNoTargets')}</div>`;
                return;
            }
            if (queue.length === 0) {
                farmerListEl.innerHTML = `<div style="padding:12px;color:#888;text-align:center;">${t('mods.awakenTracker.noMapsWithCreatures')}</div>`;
                return;
            }

            const currentId = farmerGetCurrentMapId();
            const genesById = new Map(targets.map(t => [Number(t.gameId), t]));
            farmerListEl.innerHTML = queue.slice(0, 40).map((r, idx) => {
                const creatureChips = r.wantedDetails.map(d => {
                    const target = genesById.get(Number(d.id));
                    const stats = target?.bestUncapped?.stats;
                    const cappedCount = target?.bestUncapped?.cappedCount ?? 0;
                    const genesHtml = stats
                        ? STATS.map(s => {
                            const v = Number(stats[s]) || 0;
                            const color = v >= CAP_VALUE ? '#7dd87d' : '#d87d7d';
                            return `<span style="color:${color};display:inline-flex;align-items:center;gap:1px;">${renderStatIconHtml(s, 11, '-2px')}${v}</span>`;
                        }).join('<span style="color:#444;margin:0 2px;">·</span>')
                        : '';
                    return `<span style="display:inline-flex;align-items:center;flex-wrap:wrap;gap:4px;padding:1px 0;">` +
                        `<span style="color:#88c8ff;font-weight:bold;">${d.name}</span>` +
                        `<span style="color:#888;">×${d.count}</span>` +
                        `<span style="color:#aaa;font-family:monospace;font-size:10px;">${cappedCount}/5</span>` +
                        (genesHtml ? `<span style="display:inline-flex;align-items:center;gap:0;font-size:10px;">${genesHtml}</span>` : '') +
                    `</span>`;
                }).join('<span style="color:#555;margin:0 6px;">|</span>');
                const densityPct = Math.round(r.density * 100);
                const densityColor = densityPct >= 70 ? '#7dd87d' : densityPct >= 40 ? '#e0c060' : '#d87d7d';
                const effStr = r.wantedPerStamina.toFixed(2);
                const isCurrent = currentId != null && String(r.roomId) === String(currentId);
                const hasCustom = hasFarmerMapCustomSettings(r.roomId);
                const customIcon = hasCustom
                    ? `<span class="awaken-farm-custom-indicator" title="${t('mods.awakenTracker.farmerCustomSettingsTooltip')}">${uiIconHtml(UI_ICONS.customSettings, 12)}</span>`
                    : '';
                const raidBadge = r.isRaid
                    ? ` <span style="display:inline-block;background:#7a1f1f;color:#ffd6d6;font-size:9px;font-weight:bold;padding:1px 5px;border-radius:3px;">${t('mods.awakenTracker.raidBadge')}</span>`
                    : '';
                return `<div class="at-row awaken-farm-row${r.isRaid ? ' is-raid' : ''}${isCurrent ? ' is-current' : ''}" data-room-id="${r.roomId}" data-map-name="${String(r.mapName).replace(/"/g, '&quot;')}" title="${t('mods.awakenTracker.farmerRowTooltip')}">` +
                    `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:10px;line-height:1.45;">` +
                        `<span style="white-space:nowrap;">` +
                            `<span style="color:#777;">#${idx + 1}</span> ` +
                            `<b style="color:#f0c060;">${r.mapName}</b>${customIcon}${raidBadge}` +
                        `</span>` +
                        `<span style="color:#999;display:inline-flex;align-items:center;gap:4px;flex-wrap:nowrap;white-space:nowrap;">` +
                            `<span style="color:${densityColor};">${r.uniqueWanted} ${t('mods.awakenTracker.creaturesAbbrev')}</span>` +
                            `<span>·</span>` +
                            `<span style="color:${densityColor};">${densityPct}%</span>` +
                            `<span>·</span>` +
                            `<span style="display:inline-flex;align-items:center;gap:1px;">${effStr}/${staminaIconHtml(11)}</span>` +
                            `<span>·</span>` +
                            `<span style="display:inline-flex;align-items:center;gap:1px;">${staminaIconHtml(11)}${r.stamina}</span>` +
                            (r.farmFloor != null ? `<span>·</span><span>F${r.farmFloor}</span>` : '') +
                        `</span>` +
                        `<span style="display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px 0;min-width:0;">${creatureChips}</span>` +
                    `</div>` +
                `</div>`;
            }).join('');

            farmerListEl.querySelectorAll('.awaken-farm-row').forEach(row => {
                row.addEventListener('click', () => {
                    const roomId = row.dataset.roomId;
                    if (roomId) navigateToMapByRoomId(roomId);
                });
                row.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const roomId = row.dataset.roomId;
                    if (!roomId) return;
                    createFarmerMapContextMenu(
                        roomId,
                        row.dataset.mapName || roomId,
                        e.clientX,
                        e.clientY,
                        () => { renderFarmerTab(); }
                    );
                });
            });
        }

        farmerRuntime.uiRefresh = () => {
            if (farmerBody.style.display !== 'none') renderFarmerTab();
        };

        farmerToggleBtn.addEventListener('click', () => {
            const next = toggleFarmerEnabled();
            updateFarmerToggleButton(next.enabled);
            if (farmerBody.style.display !== 'none') renderFarmerTab();
        });
        farmerRefillInput.addEventListener('change', () => {
            saveFarmerSettings({ autoRefillStamina: farmerRefillInput.checked });
            if (loadFarmerSettings().enabled && farmerRefillInput.checked) {
                farmerApplyAutomatorRefill(true);
            }
        });
        farmerSetupSelect.addEventListener('change', () => {
            saveFarmerSettings({ setupLabel: farmerSetupSelect.value });
        });

        // =======================
        // Overview: render inventory scan
        // =======================
        let overviewGroups = [];

        function renderOverview() {
            const monsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters;
            if (!Array.isArray(monsters) || monsters.length === 0) {
                overviewSummary.innerHTML = `<span style="color:#d87d7d;">${t('mods.awakenTracker.noMonstersFound')}</span>`;
                overviewGrid.innerHTML = '';
                return;
            }

            const byGameId = new Map();
            for (const m of monsters) {
                if (!m || m.gameId == null) continue;
                const stats = {};
                let sum = 0;
                let allCapped = true;
                for (const s of STATS) {
                    const v = Number(m[s] ?? 0);
                    stats[s] = v;
                    sum += v;
                    if (v !== CAP_VALUE) allCapped = false;
                }
                const tier = Number(m.tier ?? 0);
                const expToLevel = globalThis.state?.utils?.expToCurrentLevel;
                const level = Number(m.level ?? (typeof expToLevel === 'function' && m.exp ? Math.floor(expToLevel(Number(m.exp))) : 0)) || 0;
                const awakened = tier === AWAKEN_TIER;

                let group = byGameId.get(m.gameId);
                if (!group) {
                    group = {
                        gameId: m.gameId, monsters: [],
                        anyAwakened: false, anyAwakenedShiny: false, anyCapped: false,
                        anyPerfect: false, anyPerfectShiny: false,
                        anyShiny: false, best: null
                    };
                    byGameId.set(m.gameId, group);
                }
                const mon = { id: m.id, tier, level, stats, sum, awakened, capped: allCapped, shiny: m.shiny === true };
                group.monsters.push(mon);
                if (mon.awakened) group.anyAwakened = true;
                if (mon.awakened && mon.shiny) group.anyAwakenedShiny = true;
                if (mon.awakened && mon.capped) group.anyCapped = true;
                if (mon.awakened && mon.capped && mon.level >= 99) {
                    group.anyPerfect = true;
                    if (mon.shiny) group.anyPerfectShiny = true;
                }
                if (mon.shiny) group.anyShiny = true;

                if (!group.best || overviewMonsterRank(mon) > overviewMonsterRank(group.best)) group.best = mon;
            }

            const groups = [];
            let skippedUnobtainable = 0;
            let skippedNonAwakenable = 0;
            for (const g of byGameId.values()) {
                const name = resolveName(g.gameId);
                const lname = String(name).toLowerCase();
                if (getUnobtainableNames().has(lname)) { skippedUnobtainable++; continue; }
                if (isNonAwakenableName(lname)) { skippedNonAwakenable++; continue; }
                groups.push({ ...g, name });
            }

            const categoryRank = (g) => {
                if (g.anyPerfect) return 0;
                if (g.anyAwakened) return 1;
                return 2;
            };
            groups.sort((a, b) => {
                const ca = categoryRank(a), cb = categoryRank(b);
                if (ca !== cb) return ca - cb;
                const la = Number(a.best?.level) || 0;
                const lb = Number(b.best?.level) || 0;
                if (lb !== la) return lb - la;
                if (a.anyAwakened && b.anyAwakened) {
                    const pa = a.anyAwakenedShiny ? 0 : 1;
                    const pb = b.anyAwakenedShiny ? 0 : 1;
                    if (pa !== pb) return pa - pb;
                }
                const ra = a.best ? overviewMonsterRank(a.best) : 0;
                const rb = b.best ? overviewMonsterRank(b.best) : 0;
                if (rb !== ra) return rb - ra;
                return a.name.localeCompare(b.name);
            });

            overviewGroups = groups;

            const totalMonstersObtainable = groups.reduce((acc, g) => acc + g.monsters.length, 0);
            const counts = {
                total: groups.length,
                monsters: totalMonstersObtainable,
                awakened: groups.filter(g => g.anyAwakened).length,
                capped: groups.filter(g => g.anyCapped).length,
                perfect: groups.filter(g => g.anyPerfect).length,
                awakenedNotCapped: groups.filter(g => g.anyAwakened && !g.anyCapped).length,
                missingAwaken: groups.filter(g => !g.anyAwakened).length,
                missingCap: groups.filter(g => !g.anyCapped).length
            };
            const skippedParts = [
                skippedUnobtainable ? t('mods.awakenTracker.skippedUnobtainable', { count: skippedUnobtainable }) : '',
                skippedNonAwakenable ? t('mods.awakenTracker.skippedEventGazer', { count: skippedNonAwakenable }) : ''
            ].filter(Boolean).join(' + ');
            const skippedSuffix = skippedParts
                ? t('mods.awakenTracker.skippedPrefix', { parts: skippedParts })
                : '';

            const smIcon = (src, size = 12) => `<img src="${src}" style="display:inline !important;width:${size}px;height:${size}px;image-rendering:pixelated;vertical-align:-2px;" />`;
            overviewSummary.innerHTML =
                `<div>${smIcon(BADGE_ICONS.awakened)} ${t('mods.awakenTracker.overviewAwakenedLine', { awakened: counts.awakened, missingAwaken: counts.missingAwaken })}</div>` +
                `<div>${smIcon(BADGE_ICONS.capped)} ${t('mods.awakenTracker.overviewCappedLine', { capped: counts.capped, missingCap: counts.missingCap })}</div>` +
                `<div style="color:#c084fc;margin-top:2px;">${smIcon(BADGE_ICONS.perfect)} ${t('mods.awakenTracker.overviewPerfectLine', { perfect: counts.perfect, awakenedNotCapped: counts.awakenedNotCapped })}</div>` +
                `<div style="color:#888;margin-top:2px;">${t('mods.awakenTracker.overviewFooter', { total: counts.total, monsters: counts.monsters, skipped: skippedSuffix })}</div>`;

            overviewGrid.innerHTML = groups.map(renderOverviewCard).join('');
            attachOverviewCapToggles(groups);
            applyOverviewFilter();
        }

        function attachOverviewCapToggles(groups) {
            for (const g of groups) {
                const row = overviewGrid.querySelector(`.awaken-overview-row[data-gameid="${g.gameId}"]`);
                const mount = row?.querySelector('.overview-cap-toggle-mount');
                if (!mount) continue;
                mount.replaceChildren();
                const awakened = findAwakenedTargetForGameId(g.gameId);
                const alreadyCapped = !!g.anyCapped;
                mount.appendChild(buildCapToggleLabel(g.gameId, awakened, alreadyCapped));
            }
        }

        function renderOverviewCard(g) {
            const portraitUrl = `/assets/portraits/${g.gameId}${g.best.shiny ? '-shiny' : ''}.png`;
            const awakeBest = g.monsters.find(m => m.awakened);
            const statsHtml = STATS.map(s => {
                if (!awakeBest) {
                    return `<span title="${STAT_LABELS[s]}" style="color:#666;display:inline-flex;align-items:center;gap:2px;">${renderStatIconHtml(s, 13, '-2px')}?</span>`;
                }
                const v = awakeBest.stats[s];
                const color = v === CAP_VALUE ? '#7dd87d' : '#d87d7d';
                return `<span title="${STAT_LABELS[s]}" style="color:${color};display:inline-flex;align-items:center;gap:2px;">${renderStatIconHtml(s, 13, '-2px')}${v}</span>`;
            }).join('<span style="color:#444;margin:0 4px;">·</span>');

            const awakenBadge = badgeImg(BADGE_ICONS.awakened, g.anyAwakened ? t('mods.awakenTracker.badgeAwakened') : t('mods.awakenTracker.badgeNotAwakened'), g.anyAwakened);
            const capBadge = badgeImg(BADGE_ICONS.capped, g.anyCapped ? t('mods.awakenTracker.badgeAllStatsAt20') : t('mods.awakenTracker.badgeNotCapped'), g.anyCapped);
            // Pick perfect icon based on shiny status of the perfect creature.
            // Shiny perfect -> star-tier-shiny.png (purple), Hundo perfect (non-shiny) -> star-tier-hundo.png (light blue).
            const perfectIconSrc = g.anyPerfectShiny ? BADGE_ICONS.perfect : BADGE_ICONS.perfectHundo;
            const perfectTitle = !g.anyPerfect
                ? t('mods.awakenTracker.badgeNotPerfect')
                : g.anyPerfectShiny
                    ? t('mods.awakenTracker.badgePerfectShiny')
                    : t('mods.awakenTracker.badgePerfectHundo');
            const perfectBadge = badgeImg(perfectIconSrc, perfectTitle, g.anyPerfect);
            const shinyMark = g.anyShiny ? badgeImg(BADGE_ICONS.shiny, t('mods.awakenTracker.badgeHasShiny'), true, 12) : '';
            // Perfect shiny / hundo keep distinct colors; awakened uses orange (darker at lvl 99).
            const level = Number(g.best?.level) || 0;
            const nameColor = g.anyPerfectShiny ? '#c084fc'
                : g.anyPerfect ? '#A4D8FF'
                : g.anyAwakened ? (level >= 99 ? '#E08A20' : '#FFB347')
                : '#9ca3af';
            const levelHtml = level > 0
                ? `<div class="pixel-font-16 absolute bottom-0 left-0 z-1 flex size-full items-end pl-0.5 text-whiteExp" style="line-height:0.8;pointer-events:none;">` +
                    `<span style="line-height:0.9;font-size:14px;color:#fff;text-shadow:1px 0 0 #000,-1px 0 0 #000,0 1px 0 #000,0 -1px 0 #000;">${level}</span>` +
                  `</div>`
                : '';
            let borderHtml;
            if (g.anyPerfectShiny) {
                borderHtml = `<div role="none" class="rarity-shiny absolute inset-0 z-1 opacity-80"></div>`;
            } else if (g.anyPerfect) {
                borderHtml = `<div role="none" class="rarity-hundo absolute inset-0 z-1 opacity-80"></div>`;
            } else if (g.anyAwakened) {
                borderHtml = `<div role="none" class="rarity-awaken absolute inset-0 z-1 opacity-80"></div>`;
            } else {
                const geneSum = Number(g.best?.sum) || 0;
                const rarity = getGeneSumRarity(geneSum).rarity;
                borderHtml = `<div role="none" class="has-rarity absolute inset-0 z-1 opacity-80" data-rarity="${rarity}"></div>`;
            }
            return `<div class="at-row awaken-overview-row" data-gameid="${g.gameId}" data-name="${g.name.toLowerCase().replace(/"/g, '&quot;')}" data-awakened="${g.anyAwakened}" data-capped="${g.anyCapped}" data-perfect="${g.anyPerfect}">` +
                `<div class="container-slot surface-darker relative flex items-center justify-center overflow-hidden" style="width:34px;height:34px;flex-shrink:0;box-sizing:border-box;">` +
                    `${borderHtml}` +
                    `${levelHtml}` +
                    `<img class="pixelated ml-auto" alt="" width="32" height="32" src="${portraitUrl}" style="image-rendering:pixelated;" onerror="this.style.visibility='hidden'" />` +
                `</div>` +
                `<div style="flex:1;min-width:0;">` +
                    `<div style="color:${nameColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">` +
                        `${awakenBadge} ${capBadge} ${perfectBadge} ${shinyMark} ${g.name}` +
                    `</div>` +
                    `<div style="font-family:ui-monospace,Consolas,monospace;font-size:11px;letter-spacing:0.5px;">` +
                        `${statsHtml}` +
                    `</div>` +
                `</div>` +
                `<div class="overview-cap-toggle-mount" style="flex:0 0 auto;margin-left:auto;"></div>` +
            `</div>`;
        }

        // =======================
        // Overview: filter logic
        // =======================
        function applyOverviewFilter() {
            const q = overviewFilterInput.value.trim().toLowerCase();
            const view = overviewViewSelect.value;
            let visible = 0;
            overviewGrid.querySelectorAll('.awaken-overview-row').forEach(row => {
                const name = row.dataset.name;
                const isAwk = row.dataset.awakened === 'true';
                const isCap = row.dataset.capped === 'true';
                const isPerfect = row.dataset.perfect === 'true';
                let show = !q || name.includes(q);
                if (view === 'awakened') show = show && isAwk;
                else if (view === 'missing-awaken') show = show && !isAwk;
                else if (view === 'capped') show = show && isCap;
                else if (view === 'missing-cap') show = show && !isCap;
                else if (view === 'perfect') show = show && isPerfect;
                else if (view === 'awakened-not-capped') show = show && isAwk && !isCap;
                else if (view === 'needs-both') show = show && !isAwk && !isCap;
                row.style.display = show ? '' : 'none';
                if (show) visible++;
            });
            const total = overviewGrid.querySelectorAll('.awaken-overview-row').length;
            const isFiltered = !(view === 'all' && !q);
            overviewVisibleCounter.textContent = isFiltered
                ? t('mods.awakenTracker.visibleCount', { visible, total })
                : t('mods.awakenTracker.totalCount', { total });
            if (farmSection.style.display !== 'none') renderFarmMaps();
        }

        overviewFilterInput.addEventListener('input', applyOverviewFilter);
        overviewViewSelect.addEventListener('change', applyOverviewFilter);

        // =======================
        // Overview: Farm Maps
        // =======================
        function navigateToMapByRoomId(roomId) {
            if (!globalThis.state?.board) return false;
            try {
                globalThis.state.board.send({ type: 'selectRoomById', roomId });
            } catch (e) {
                console.warn('[Awaken Tracker] selectRoomById failed:', e);
                return false;
            }
            const closeBtn = Array.from(document.querySelectorAll('button.pixel-font-14'))
                .find(btn => btn.textContent.trim() === t('common.close'));
            if (closeBtn) closeBtn.click();
            // Board subscribe refreshes the farmer highlight; also nudge immediately for snappy UI.
            if (typeof farmerRuntime.uiRefresh === 'function') {
                setTimeout(() => {
                    try { farmerRuntime.uiRefresh(); } catch (_) { /* ignore */ }
                }, 50);
            }
            return true;
        }

        function renderFarmMaps() {
            const wantedIds = new Set();
            const wantedNamesById = new Map();
            overviewGrid.querySelectorAll('.awaken-overview-row').forEach(row => {
                if (row.style.display === 'none') return;
                const id = Number(row.dataset.gameid);
                if (Number.isFinite(id)) {
                    wantedIds.add(id);
                    wantedNamesById.set(id, resolveName(id));
                }
            });

            if (wantedIds.size === 0) {
                farmSummaryEl.innerHTML = `<span style="color:#888;">${t('mods.awakenTracker.noCreaturesInFilter')}</span>`;
                farmListEl.innerHTML = '';
                return;
            }

            const ranked = rankMapsForWantedIds(wantedIds, wantedNamesById, { requireFarmFloor: false });
            if (ranked.error === 'utils') {
                farmSummaryEl.innerHTML = `<span style="color:#d87d7d;">${t('mods.awakenTracker.utilsUnavailable')}</span>`;
                farmListEl.innerHTML = '';
                return;
            }

            const results = ranked.results || [];

            const hideRaids = hideRaidsInput.checked;
            const raidCount = results.filter(r => r.isRaid).length;
            const visibleResults = hideRaids ? results.filter(r => !r.isRaid) : results;

            const wantedSummary = Array.from(wantedNamesById.values()).slice(0, 8).join(', ')
                + (wantedNamesById.size > 8 ? ` … +${wantedNamesById.size - 8}` : '');

            const raidNote = raidCount > 0
                ? (hideRaids
                    ? t(raidCount > 1 ? 'mods.awakenTracker.manyRaidsHidden' : 'mods.awakenTracker.oneRaidHidden', { count: raidCount })
                    : t(raidCount > 1 ? 'mods.awakenTracker.manyRaidsShown' : 'mods.awakenTracker.oneRaidShown', { count: raidCount }))
                : '';

            farmSummaryEl.innerHTML =
                `<div style="display:flex;align-items:center;gap:6px;">` +
                    `<div style="flex:1;min-width:0;">${t('mods.awakenTracker.farmSearchingHtml', { creatureCount: wantedIds.size, mapCount: visibleResults.length, raidNote })}</div>` +
                    helpTipHtml([
                        t('mods.awakenTracker.farmTargets', { summary: wantedSummary }),
                        t('mods.awakenTracker.farmSortHint')
                    ].join(' · ')) +
                `</div>`;

            if (visibleResults.length === 0) {
                farmListEl.innerHTML = `<div style="grid-column:1/-1;padding:16px;color:#888;text-align:center;">${t('mods.awakenTracker.noMapsWithCreatures')}</div>`;
                return;
            }

            farmListEl.innerHTML = visibleResults.slice(0, 60).map((r, idx) => {
                const details = r.wantedDetails.map(d =>
                    `<span style="color:#88c8ff;font-weight:bold;">${d.name}</span><span style="color:#888;">×${d.count} (${t('mods.awakenTracker.levelAbbrev', { level: Math.round(d.avgLevel) })})</span>`
                ).join(' · ');
                const otherDetails = (r.otherDetails || []).map(d =>
                    `<span style="color:#888;">${d.name}×${d.count}</span>`
                ).join(' · ');
                const densityPct = Math.round(r.density * 100);
                const densityColor = densityPct >= 70 ? '#7dd87d' : densityPct >= 40 ? '#e0c060' : '#d87d7d';
                const effStr = r.wantedPerStamina.toFixed(2);
                const raidBadge = r.isRaid
                    ? ` <span style="display:inline-block;background:#7a1f1f;color:#ffd6d6;font-size:9px;font-weight:bold;padding:1px 5px;border-radius:3px;letter-spacing:0.5px;vertical-align:1px;" title="${t('mods.awakenTracker.raidBadgeTooltip')}">${t('mods.awakenTracker.raidBadge')}</span>`
                    : '';
                const titleAttr = r.isRaid
                    ? t('mods.awakenTracker.raidTitleAttr', { mapName: r.mapName })
                    : t('mods.awakenTracker.clickToNavigate', { mapName: r.mapName });
                return `<div class="at-row awaken-farm-row${r.isRaid ? ' is-raid' : ''}" data-room-id="${r.roomId}" title="${titleAttr}">` +
                    `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">` +
                        `<div style="flex:1;min-width:0;">` +
                            `<span style="color:#777;font-size:10px;">#${idx + 1}</span> ` +
                            `<b style="color:#f0c060;text-decoration:underline;text-decoration-color:#5a4a2a;">${r.mapName}</b>${raidBadge} ` +
                            `<span style="color:#666;font-size:10px;">· ${r.regionName}</span>` +
                        `</div>` +
                        `<div style="font-size:10px;color:#999;display:inline-flex;align-items:center;gap:4px;flex-wrap:nowrap;white-space:nowrap;">` +
                            `<span style="color:${densityColor};">${r.uniqueWanted} ${t('mods.awakenTracker.creaturesAbbrev')} · ${r.wantedTotal}/${r.totalVillains} (${densityPct}%)</span>` +
                            `<span>·</span>` +
                            `<span style="color:#88c8ff;display:inline-flex;align-items:center;gap:1px;">${effStr}/${staminaIconHtml(11)}</span>` +
                            `<span>·</span>` +
                            `<span style="display:inline-flex;align-items:center;gap:1px;">${staminaIconHtml(11)}${r.stamina}</span>` +
                        `</div>` +
                    `</div>` +
                    `<div style="font-size:10px;margin-top:2px;line-height:1.5;">${details}</div>` +
                    (otherDetails ? `<div style="font-size:9px;margin-top:1px;line-height:1.4;color:#666;">${t('mods.awakenTracker.alsoPrefix')} ${otherDetails}</div>` : '') +
                `</div>`;
            }).join('');

            farmListEl.querySelectorAll('.awaken-farm-row').forEach(row => {
                row.addEventListener('click', () => {
                    const roomId = row.dataset.roomId;
                    if (roomId) navigateToMapByRoomId(roomId);
                });
            });
        }

        let farmExpandedFrom = null;

        function closeFarmPanel() {
            farmSection.style.display = 'none';
            farmToggleBtn.style.filter = '';
            if (farmExpandedFrom) {
                panel.style.width = farmExpandedFrom.width + 'px';
                panel.style.left = farmExpandedFrom.left + 'px';
                savePanelSettings({
                    width: farmExpandedFrom.width,
                    left: farmExpandedFrom.left
                });
                farmExpandedFrom = null;
            }
        }

        function toggleFarmPanel() {
            const isHidden = farmSection.style.display === 'none' || !farmSection.style.display;
            if (isHidden) {
                farmSection.style.display = 'flex';
                const desiredMin = 880;
                const currentWidth = panel.offsetWidth;
                if (currentWidth < desiredMin) {
                    const rectBefore = panel.getBoundingClientRect();
                    farmExpandedFrom = {
                        width: currentWidth,
                        left: parseInt(panel.style.left, 10) || rectBefore.left
                    };
                    panel.style.width = Math.min(desiredMin, window.innerWidth - 40) + 'px';
                    const rect = panel.getBoundingClientRect();
                    const overflow = rect.right - window.innerWidth + 10;
                    if (overflow > 0) {
                        panel.style.left = Math.max(10, rect.left - overflow) + 'px';
                    }
                    savePanelSettings({
                        width: parseInt(panel.style.width, 10),
                        left: parseInt(panel.style.left, 10)
                    });
                }
                farmToggleBtn.style.filter = 'brightness(1.15)';
                renderFarmMaps();
            } else {
                closeFarmPanel();
            }
        }

        farmToggleBtn.addEventListener('click', toggleFarmPanel);
        farmCloseBtn.addEventListener('click', closeFarmPanel);

        // Set initial tab from persisted settings
        switchTab(s.activeTab || 'tracker');
        updateFarmerToggleButton(loadFarmerSettings().enabled);

        frame.appendChild(footer);

        addResizeHandles(panel);
        ensurePanelResizeListeners();
        panel.querySelectorAll('.resize-handle').forEach((handle) => {
            handle.addEventListener('mousedown', onResizeHandleMouseDown);
        });

        // Drag (viewport-clamped, same pattern as Hunt Analyzer)
        let isDraggingPanel = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;
        let dragMv = null;
        let dragUp = null;
        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            if (e.target.closest('.resize-handle')) return;
            e.preventDefault();
            isDraggingPanel = true;
            const rect = panel.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            document.body.style.userSelect = 'none';
            dragMv = (ev) => {
                if (!isDraggingPanel) return;
                const nl = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, ev.clientX - dragOffsetX));
                const nt = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, ev.clientY - dragOffsetY));
                panel.style.left = nl + 'px';
                panel.style.top = nt + 'px';
            };
            dragUp = () => {
                if (!isDraggingPanel) return;
                isDraggingPanel = false;
                document.removeEventListener('mousemove', dragMv);
                document.removeEventListener('mouseup', dragUp);
                document.body.style.userSelect = '';
                savePanelSettings({
                    left: parseInt(panel.style.left, 10),
                    top: parseInt(panel.style.top, 10)
                });
            };
            document.addEventListener('mousemove', dragMv);
            document.addEventListener('mouseup', dragUp);
        });

        updatePanelPosition();
        attachPanelViewportListener();

        return panel;
    }

    function openPanel() {
        let panel = document.getElementById(PANEL_ID);
        if (!panel) {
            panel = createPanel();
            document.body.appendChild(panel);
        } else {
            attachPanelViewportListener();
        }
        panel.style.display = 'flex';
        syncPanelMinWidthFromTabs(panel);
        updatePanelPosition();
        savePanelSettings({ isOpen: true });
        render();
    }

    function closePanel() {
        const panel = document.getElementById(PANEL_ID);
        if (panel) panel.style.display = 'none';
        savePanelSettings({ isOpen: false });
    }

    function togglePanel() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.style.display === 'none') openPanel();
        else closePanel();
    }

    // Expose for debugging / external triggers
    window.openAwakenTracker = openPanel;
    window.closeAwakenTracker = closePanel;
    window.toggleAwakenTracker = togglePanel;

    function render() {
        if (isDraggingSlot) return; // don't re-render during drag (would preserve the live DOM order)
        const grid = document.getElementById(GRID_ID);
        const title = document.getElementById(TITLE_ID);
        if (!grid || !title) return;

        // Preserve which slots had their event log expanded
        const openLogGameIds = new Set();
        grid.querySelectorAll('.awaken-tracker-slot').forEach(s => {
            const det = s.querySelector('details');
            if (det && det.open) {
                const gid = Number(s.dataset.gameId);
                if (Number.isFinite(gid)) openLogGameIds.add(gid);
            }
        });

        const enemies = getOrderedEnemies();
        const roomId = state.currentRoomId;
        const roomName = roomId ? (globalThis.state?.utils?.ROOM_NAME?.[roomId] || roomId) : null;
        title.textContent = !roomId
            ? t('mods.awakenTracker.noMapLoaded')
            : `${roomName || t('mods.awakenTracker.currentMap')} (${enemies.length})`;

        grid.innerHTML = '';
        if (enemies.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'opacity:0.6;font-size:12px;padding:8px;text-align:center;';
            empty.textContent = roomId
                ? 'No creature drops on this map.'
                : t('mods.awakenTracker.enterMap');
            grid.appendChild(empty);
            return;
        }
        for (const enemy of enemies) {
            grid.appendChild(createSlot(enemy, { logOpen: openLogGameIds.has(Number(enemy.gameId)) }));
        }
    }

    // =======================
    // 11. Toolbar button
    // =======================
    function createToolbarButton() {
        if (typeof api !== 'undefined' && api && api.ui && api.ui.addButton) {
            api.ui.addButton({
                id: BUTTON_ID,
                text: t('mods.awakenTracker.buttonText'),
                tooltip: t('mods.awakenTracker.buttonTooltip'),
                primary: false,
                onClick: togglePanel
            });
            setTimeout(() => updateAwakenTrackerButton(), 100);
            console.log('[Awaken Tracker] Toolbar button created');
        } else {
            console.warn('[Awaken Tracker] api.ui.addButton not available');
        }
    }

    // =======================
    // 12. Cleanup (mod disable)
    // =======================
    function cleanup() {
        try {
            stopFarmerLoop(true);
            closeFarmerMapContextMenu();
            teardownFarmerBootGrace();
            for (const resetFn of activeConfirmButtonResets) {
                try { resetFn(); } catch (_) {}
            }
            activeConfirmButtonResets.clear();
            if (farmerCoordinationUnsubscribe) {
                try { farmerCoordinationUnsubscribe(); } catch (_) { /* ignore */ }
                farmerCoordinationUnsubscribe = null;
            }
            if (window.ModCoordination?.unregisterMod) {
                try { window.ModCoordination.unregisterMod(FARMER_MOD_NAME); } catch (_) { /* ignore */ }
                farmerModRegistered = false;
            }
            try { delete window.awakenFarmerShouldHoldBoard; } catch (_) { /* ignore */ }
            try { delete window.AwakenTrackerState; } catch (_) { /* ignore */ }
            try { delete window.__awakenTrackerLoaded; } catch (_) { window.__awakenTrackerLoaded = false; }
            if (modDisableHandler) {
                try { window.removeEventListener('message', modDisableHandler); } catch (_) {}
            }
            teardownAwakenAnalysisCoordination({ restore: false });
            detachPanelViewportListener();
            teardownPanelResizeListeners();
            teardownListeners();
            teardownBoardSub();
            teardownPlayerSub();
            if (renderDebounceId) {
                clearTimeout(renderDebounceId);
                renderDebounceId = null;
            }
            if (saveDebounceId) {
                clearTimeout(saveDebounceId);
                saveDebounceId = null;
            }
            const toastContainer = document.getElementById('awaken-farmer-toast-container');
            if (toastContainer) {
                try { toastContainer.remove(); } catch (_) {}
            }
            const panel = document.getElementById(PANEL_ID);
            if (panel) panel.remove();
            console.log('[Awaken Tracker] Cleanup completed');
        } catch (e) {
            console.error('[Awaken Tracker] Cleanup error:', e);
        }
    }

    const modDisableHandler = (event) => {
        if (event.data?.message?.action === 'updateLocalModState') {
            const modPath = event.data.message.name;
            const enabled = event.data.message.enabled;
            if (modPath === 'Super Mods/Awaken Tracker.js' && !enabled) {
                console.log('[Awaken Tracker] Mod disabled, running cleanup...');
                cleanup();
            }
        }
    };
    window.addEventListener('message', modDisableHandler);

    // =======================
    // 13. Bootstrap
    // =======================
    try {
        loadData();

        // Snapshot baseline only if we don't already have one (preserves session deltas across reload)
        if (state.baselineStats.size === 0) snapshotBaseline();

        setupListeners();
        setupBoardSub();
        setupPlayerSub();
        createToolbarButton();
        setupAwakenAnalysisCoordination();
        ensureFarmerModRegistered();
        setupFarmerCoordination();
        syncFarmerModCoordination();
        // Auto-resume after allModsLoaded + 5s boot grace (manual Enable still starts immediately).
        setupFarmerBootGrace();

        // Reopen panel if it was open before reload
        const panelSettings = loadPanelSettings();
        if (panelSettings.isOpen) openPanel();

        console.log('[Awaken Tracker] Initialized. Baseline entries:', state.baselineStats.size);
    } catch (e) {
        console.error('[Awaken Tracker] Init failed:', e);
    }

    // Expose for external integrations (e.g., clear button from Hunt Analyzer)
    if (typeof exports !== 'undefined') {
        exports.openPanel = openPanel;
        exports.closePanel = closePanel;
        exports.togglePanel = togglePanel;
        exports.cleanup = cleanup;
        exports.resetData = () => {
            state.byMap.clear();
            state.baselineByMap.clear();
            snapshotBaseline();
            if (state.currentRoomId) ensureMapBaseline(state.currentRoomId);
            render();
            scheduleSave();
        };
    }
})();
