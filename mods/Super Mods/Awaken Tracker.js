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

    const STORAGE_KEY_DATA = 'awakenTrackerData';
    const STORAGE_KEY_PANEL = 'awakenTrackerPanel';

    const LOG_LIMIT = 50;
    const CAP_VALUE = 20;
    const RENDER_DEBOUNCE_MS = 250;
    const PAUSE_DEBOUNCE_MS = 1500;

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

    const STAT_LABELS = { hp: 'HP', ad: 'AD', ap: 'AP', armor: 'ARM', magicResist: 'MR' };
    const STAT_ICON_URLS = {
        hp: '/assets/icons/heal.png',
        ad: '/assets/icons/attackdamage.png',
        ap: '/assets/icons/abilitypower.png',
        armor: '/assets/icons/armor.png',
        magicResist: '/assets/icons/magicresist.png'
    };
    const BADGE_ICONS = {
        awakened: 'https://bestiaryarena.com/assets/icons/star-tier-awaken.png',
        capped: 'https://bestiaryarena.com/assets/icons/star-tier-5.png',
        // Shiny perfect: awakened + capped + lvl 99 AND shiny.
        perfect: 'https://bestiaryarena.com/assets/icons/star-tier-shiny.png',
        // Hundo perfect: awakened + capped + lvl 99 AND NOT shiny.
        perfectHundo: 'https://bestiaryarena.com/assets/icons/star-tier-hundo.png',
        shiny: 'https://bestiaryarena.com/assets/icons/shiny-star.png'
    };
    const SKIP_REASON_LABELS = {
        'no-higher-gene': 'no higher genes',
        'keep-list': 'in keep list',
        'disabled': 'inject disabled',
        'no-target': 'no matching awaken',
        'same-id': 'same monster (already injected)',
        'on-board': 'awaken in battle'
    };

    // =======================
    // 2. State
    // =======================
    const state = {
        byMap: new Map(),          // roomId -> Map<gameId, entry>
        baselineStats: new Map(),  // String(monsterId) -> stats (global fallback, used for pre-capped detection)
        baselineByMap: new Map(),  // roomId -> Map<String(monsterId), stats> (per-map baseline for +N delta display)
        currentMapEnemies: [],     // [{ gameId, name }]
        currentRoomId: null,
        pauseOnCapByMap: new Map(), // roomId -> Set<gameId> (pause-on-cap marks, scoped per map)
        collapsedOverrides: new Map(), // gameId -> boolean (user override of auto-collapse)
        orderByMap: new Map()      // roomId -> Array<gameId> (custom order per map)
    };

    function getPauseSetForMap(roomId) {
        if (!roomId) return null;
        if (!state.pauseOnCapByMap.has(roomId)) {
            state.pauseOnCapByMap.set(roomId, new Set());
        }
        return state.pauseOnCapByMap.get(roomId);
    }

    function isPausedOnCapInCurrentMap(gameId) {
        const set = state.currentRoomId ? state.pauseOnCapByMap.get(state.currentRoomId) : null;
        return set ? set.has(Number(gameId)) : false;
    }

    let renderDebounceId = null;
    let boardSubscription = null;
    let lastSeenRoomId = null;
    let lastPauseAttemptMs = 0;
    let isDraggingSlot = false;

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
            const serializedPauseByMap = Array.from(state.pauseOnCapByMap.entries()).map(([rid, set]) => [
                rid,
                set instanceof Set ? Array.from(set) : []
            ]);
            const payload = {
                byMap: serializedByMap,
                baselineStats: Array.from(state.baselineStats.entries()),
                baselineByMap: serializedBaselineByMap,
                currentMapEnemies: state.currentMapEnemies,
                currentRoomId: state.currentRoomId,
                pauseOnCapByMap: serializedPauseByMap,
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
            if (Array.isArray(parsed.pauseOnCapByMap)) {
                state.pauseOnCapByMap = new Map();
                for (const [rid, arr] of parsed.pauseOnCapByMap) {
                    state.pauseOnCapByMap.set(rid, new Set(Array.isArray(arr) ? arr.map(Number) : []));
                }
            } else if (Array.isArray(parsed.pauseOnCap) && typeof parsed.currentRoomId === 'string') {
                // Legacy migration: old global marks → marks for the map the user was on
                const set = new Set(parsed.pauseOnCap.map(Number));
                if (set.size > 0) state.pauseOnCapByMap.set(parsed.currentRoomId, set);
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
                activeTab: (p.activeTab === 'overview') ? 'overview' : 'tracker',
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
                    if (getUnobtainableNames().has(String(name).toLowerCase())) continue;
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
        const board = globalThis.state?.board;
        if (!board || typeof board.subscribe !== 'function') return;
        boardSubscription = board.subscribe(() => {
            const roomId = resolveCurrentRoomId();
            if (roomId !== lastSeenRoomId) {
                lastSeenRoomId = roomId;
                updateCurrentMapEnemies();
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
        const player = globalThis.state?.player;
        if (!player || typeof player.subscribe !== 'function') return;
        playerSubscription = player.subscribe(() => {
            if (playerRenderDebounceId) clearTimeout(playerRenderDebounceId);
            playerRenderDebounceId = setTimeout(() => {
                playerRenderDebounceId = null;
                const panel = document.getElementById(PANEL_ID);
                if (panel && panel.style.display !== 'none') render();
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

    function checkAndPauseIfCapped(gameId, statsFromEvent) {
        try {
            const mapSet = state.currentRoomId ? state.pauseOnCapByMap.get(state.currentRoomId) : null;
            if (!mapSet || mapSet.size === 0) return;
            const triggeredId = Number(gameId);
            if (!mapSet.has(triggeredId)) return;
            const triggeredAwaken = findAwakenedTargetForGameId(triggeredId);
            const triggeredStats = triggeredAwaken ? getMonsterGeneStatsLocal(triggeredAwaken) : (statsFromEvent || null);
            if (!isAwakenedCappedStats(triggeredStats)) return;

            const markedOnMap = (state.currentMapEnemies || [])
                .map(e => Number(e?.gameId))
                .filter(g => Number.isFinite(g) && mapSet.has(g));
            if (markedOnMap.length === 0) return;

            const allCapped = markedOnMap.every(g => {
                const aw = findAwakenedTargetForGameId(g);
                return aw && isAwakenedCappedStats(getMonsterGeneStatsLocal(aw));
            });
            if (!allCapped) return;

            const now = Date.now();
            if (now - lastPauseAttemptMs < PAUSE_DEBOUNCE_MS) return;
            lastPauseAttemptMs = now;
            console.log('[Awaken Tracker] All marked creatures on map are capped — pausing. Marked:', markedOnMap);
            tryPauseGameAutoplay();
            // Consume the fulfilled marks: the creature is capped and the pause was delivered.
            // Without this, every subsequent autoseller event re-triggers the pause (infinite loop).
            // Marks for creatures not on the current map are preserved (not yet fulfilled).
            markedOnMap.forEach(g => mapSet.delete(g));
            scheduleSave();
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
    function getStatTotalColor(total) {
        const t = Number(total) || 0;
        let tierLevel;
        if (t >= 80) tierLevel = 5;
        else if (t >= 70) tierLevel = 4;
        else if (t >= 60) tierLevel = 3;
        else if (t >= 50) tierLevel = 2;
        else tierLevel = 1; // Common (readable gray) also covers total < 5
        switch (tierLevel) {
            case 5: return '#E5C07B'; // Legendary - gold
            case 4: return '#C77DFF'; // Epic - bright violet
            case 3: return '#54B9FF'; // Rare - bright sky blue
            case 2: return '#98C379'; // Uncommon - green
            default: return '#ABB2BF'; // Common - light gray
        }
    }

    function renderStatIconHtml(key, size = 12, verticalAlign = 'middle') {
        return `<img src="${STAT_ICON_URLS[key]}" alt="${STAT_LABELS[key]}" title="${STAT_LABELS[key]}" style="width:${size}px;height:${size}px;vertical-align:${verticalAlign};image-rendering:pixelated;" />`;
    }

    function badgeImg(src, alt, active, size = 14) {
        const opacity = active ? '1' : '0.2';
        return `<img src="${src}" alt="${alt}" title="${alt}" style="display:inline !important;width:${size}px;height:${size}px;image-rendering:pixelated;vertical-align:-2px;opacity:${opacity};" />`;
    }

    // Minimal badge: just an X/5 counter + ⏸ N suffix when waiting for peers
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
        handle.textContent = '⋮⋮';
        handle.title = 'Drag to reorder';
        handle.style.cssText = 'cursor:grab;color:#777;font-size:14px;line-height:1;padding:0 2px;user-select:none;letter-spacing:-3px;flex:0 0 auto;';
        handle.addEventListener('mousedown', () => { slot.draggable = true; });
        handle.addEventListener('mouseup', () => { setTimeout(() => { slot.draggable = false; }, 50); });
        handle.addEventListener('mouseenter', () => { handle.style.color = '#bbb'; });
        handle.addEventListener('mouseleave', () => { handle.style.color = '#777'; });
        return handle;
    }

    function buildToggleArrow(gameId, isCollapsed) {
        const arrow = document.createElement('span');
        arrow.textContent = isCollapsed ? '▶' : '▼';
        arrow.title = isCollapsed ? 'Expand' : 'Collapse';
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
        const isMarked = isPausedOnCapInCurrentMap(gameId);
        const capToggleLabel = document.createElement('label');
        capToggleLabel.style.cssText = 'display:inline-flex;align-items:center;gap:3px;font-size:11px;flex:0 0 auto;';
        const capToggleInput = document.createElement('input');
        capToggleInput.type = 'checkbox';
        capToggleInput.checked = isMarked;
        capToggleInput.style.cssText = 'margin:0;';
        if (!awakened) {
            capToggleInput.disabled = true;
            capToggleLabel.title = 'Awaken this creature first';
            capToggleLabel.style.opacity = '0.4';
            capToggleLabel.style.cursor = 'not-allowed';
            capToggleInput.style.cursor = 'not-allowed';
        } else if (alreadyCapped) {
            // Creature already 5/5: pause-on-cap no longer makes sense. Automatically
            // remove any stale mark and keep the checkbox disabled and unchecked.
            if (isMarked) {
                const set = state.currentRoomId ? state.pauseOnCapByMap.get(state.currentRoomId) : null;
                if (set && set.delete(Number(gameId))) scheduleSave();
            }
            capToggleInput.checked = false;
            capToggleInput.disabled = true;
            capToggleLabel.title = 'Already fully capped — pause-on-cap has no effect';
            capToggleLabel.style.opacity = '0.4';
            capToggleLabel.style.cursor = 'not-allowed';
            capToggleInput.style.cursor = 'not-allowed';
        } else {
            capToggleLabel.title = 'Pause game when all 5 stats reach 20';
            capToggleLabel.style.opacity = isMarked ? '1' : '0.6';
            capToggleLabel.style.cursor = 'pointer';
            capToggleInput.style.cursor = 'pointer';
            capToggleInput.addEventListener('change', (e) => {
                const k = Number(gameId);
                const set = getPauseSetForMap(state.currentRoomId);
                if (!set) return;
                if (e.target.checked) set.add(k);
                else set.delete(k);
                capToggleLabel.style.opacity = e.target.checked ? '1' : '0.6';
                scheduleSave();
            });
        }
        capToggleLabel.appendChild(capToggleInput);
        const capIconSpan = document.createElement('span');
        capIconSpan.textContent = '🎯';
        capToggleLabel.appendChild(capIconSpan);
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
            noAwaken.textContent = '— no awaken';
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
                : '<span style="opacity:0.6;">(stats unavailable)</span>';

            const lastLine = document.createElement('div');
            lastLine.style.cssText = 'font-size:11px;line-height:1.6;border-top:1px dashed #444;margin-top:2px;padding-top:3px;';

            if (ev.type === 'applied') {
                const gainPairs = Object.entries(ev.gains || {}).filter(([, v]) => v > 0)
                    .map(([k, v]) => `<span style="display:inline-flex;align-items:center;gap:2px;">${renderStatIconHtml(k, 11)}<span style="color:#7fde7f;font-weight:bold;">+${v}</span></span>`);
                lastLine.innerHTML =
                    `<span style="color:#7fde7f;">✓ injected:</span> ${gainPairs.join(' ') || '(no gain)'}` +
                    `<div style="margin-top:2px;"><span style="opacity:0.6;">sealed:</span> ${candidateLine}</div>`;
            } else {
                const reasonLabel = SKIP_REASON_LABELS[ev.reason] || ev.reason || 'unknown';
                lastLine.innerHTML =
                    `<span style="color:#ff9966;">✗ skipped:</span> ${reasonLabel}` +
                    `<div style="margin-top:2px;"><span style="opacity:0.6;">sealed:</span> ${candidateLine}</div>`;
            }
            slot.appendChild(lastLine);
        }

        const counter = document.createElement('div');
        counter.style.cssText = 'font-size:11px;color:#9ad;border-top:1px dashed #444;margin-top:2px;padding-top:3px;';
        const injects = entry?.injects || 0;
        const skips = entry?.skips || 0;
        counter.innerHTML = `session injects: <span style="color:#7fde7f;">${injects} ✓</span> / <span style="color:#ff9966;">${skips} skipped</span>`;
        slot.appendChild(counter);

        const eventLog = Array.isArray(entry?.eventLog) ? entry.eventLog : [];
        if (eventLog.length > 0) {
            const logDetails = document.createElement('details');
            if (options.logOpen) logDetails.open = true;
            logDetails.style.cssText = 'border-top:1px dashed #444;margin-top:2px;padding-top:3px;';
            const logSummary = document.createElement('summary');
            logSummary.style.cssText = 'cursor:pointer;font-size:11px;color:#9ad;opacity:0.85;';
            logSummary.textContent = `▸ View log (${eventLog.length})`;
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
                    : '<span style="opacity:0.6;">(no stats)</span>';

                if (logEv.type === 'applied') {
                    const gainPairs = Object.entries(logEv.gains || {}).filter(([, v]) => v > 0)
                        .map(([k, v]) => `<span style="display:inline-flex;align-items:center;gap:1px;">${renderStatIconHtml(k, 10)}<span style="color:#7fde7f;font-weight:bold;">+${v}</span></span>`)
                        .join(' ');
                    row.innerHTML =
                        `<div><span style="opacity:0.5;">${hh}:${mm}:${ss}</span> <span style="color:#7fde7f;">✓</span> ${gainPairs || '<span style="opacity:0.6;">(no gain)</span>'}</div>` +
                        `<div style="opacity:0.7;padding-left:6px;">sealed: ${sealedHtml}</div>`;
                } else {
                    const reasonLabel = SKIP_REASON_LABELS[logEv.reason] || logEv.reason || 'skip';
                    row.innerHTML =
                        `<div><span style="opacity:0.5;">${hh}:${mm}:${ss}</span> <span style="color:#ff9966;">✗</span> ${reasonLabel}</div>` +
                        `<div style="opacity:0.7;padding-left:6px;">sealed: ${sealedHtml}</div>`;
                }
                logList.appendChild(row);
            }
            logDetails.appendChild(logList);
            slot.appendChild(logDetails);
        }

        return slot;
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
            }
            #${PANEL_ID} {
                position: fixed;
                background-image: var(--at-bg-panel);
                background-repeat: repeat;
                background-color: var(--at-panel-bg);
                border: 6px solid transparent;
                border-image: var(--at-frame-3);
                color: var(--at-text);
                padding: 0;
                overflow: hidden;
                /* Above the game UI (floor slider/bestiary tooltip use z-1),
                   but below other mod panels (Hunt Analyzer/Raid Hunter/etc. use 9999+)
                   so this panel never covers them. */
                z-index: 3;
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
            #${PANEL_ID} .at-toolbar {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 6px;
                padding: 4px 8px;
                background-image: var(--at-bg-section);
                background-repeat: repeat;
                background-color: var(--at-section-bg);
                border: 6px solid transparent;
                border-image: var(--at-frame-4);
                margin: 0 2px;
                flex: 0 0 auto;
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
            }
            #${PANEL_ID} .at-tab-btn {
                flex: 1;
                padding: 5px 0;
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
                padding: 4px 8px;
                background-image: var(--at-bg-header);
                background-repeat: repeat;
                background-color: var(--at-panel-bg);
                border: 6px solid transparent;
                border-image: var(--at-frame-4);
                margin: 0 2px 2px;
                font-size: 10px;
                color: #888;
                text-align: right;
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
        `;
        document.head.appendChild(style);
    }

    function createPanel() {
        injectStyles();
        const s = loadPanelSettings();
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.cssText = `left:${s.left}px;top:${s.top}px;width:${s.width}px;height:${s.height}px;min-width:260px;min-height:180px;`;

        const header = document.createElement('div');
        header.className = 'at-header';
        const titleEl = document.createElement('span');
        titleEl.id = TITLE_ID;
        titleEl.className = 'at-title';
        titleEl.textContent = 'Awaken Tracker';
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
        closeBtn.title = 'Close';
        closeBtn.className = 'at-icon-btn';
        closeBtn.addEventListener('click', closePanel);
        header.appendChild(closeBtn);
        panel.appendChild(header);

        const toolbar = document.createElement('div');
        toolbar.className = 'at-toolbar';

        const clearMapBtn = makeConfirmButton('Clear Map', 'Confirm clear map', 'Clear this map only, rebaseline its stats and clear its 🎯 marks (preserves other maps)', () => {
            if (!state.currentRoomId) return;
            state.byMap.delete(state.currentRoomId);
            state.baselineByMap.delete(state.currentRoomId);
            state.pauseOnCapByMap.delete(state.currentRoomId);
            ensureMapBaseline(state.currentRoomId);
            render();
            scheduleSave();
        });
        toolbar.appendChild(clearMapBtn);

        const clearAllBtn = makeConfirmButton('Clear All', 'Confirm clear all', 'Clear ALL maps, rebaseline stats and clear ALL 🎯 marks', () => {
            state.byMap.clear();
            state.baselineByMap.clear();
            state.pauseOnCapByMap.clear();
            snapshotBaseline();
            if (state.currentRoomId) ensureMapBaseline(state.currentRoomId);
            render();
            scheduleSave();
        });
        toolbar.appendChild(clearAllBtn);

        // =======================
        // Tab bar
        // =======================
        const tabBar = document.createElement('div');
        tabBar.className = 'at-tab-bar';

        const tabTrackerBtn = document.createElement('button');
        const tabOverviewBtn = document.createElement('button');
        tabTrackerBtn.className = 'at-tab-btn';
        tabOverviewBtn.className = 'at-tab-btn';

        tabTrackerBtn.textContent = 'Tracker';
        tabOverviewBtn.textContent = 'Overview';

        const trackerBody = document.createElement('div');
        trackerBody.className = 'at-body';
        const grid = document.createElement('div');
        grid.id = GRID_ID;
        grid.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
        trackerBody.appendChild(grid);

        const overviewBody = document.createElement('div');
        overviewBody.className = 'at-overview-body';

        function switchTab(tab) {
            if (tab === 'tracker') {
                trackerBody.style.display = 'block';
                overviewBody.style.display = 'none';
                toolbar.style.display = 'flex';
                tabTrackerBtn.classList.add('active');
                tabOverviewBtn.classList.remove('active');
            } else {
                trackerBody.style.display = 'none';
                overviewBody.style.display = 'flex';
                toolbar.style.display = 'none';
                tabTrackerBtn.classList.remove('active');
                tabOverviewBtn.classList.add('active');
                renderOverview();
            }
            savePanelSettings({ activeTab: tab });
        }

        tabTrackerBtn.addEventListener('click', () => switchTab('tracker'));
        tabOverviewBtn.addEventListener('click', () => switchTab('overview'));

        tabBar.appendChild(tabTrackerBtn);
        tabBar.appendChild(tabOverviewBtn);
        panel.appendChild(tabBar);
        panel.appendChild(trackerBody);

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
        overviewFilterInput.placeholder = 'Filter by name…';
        overviewFilterInput.className = 'at-input';
        overviewFilterInput.style.cssText = 'flex:1;min-width:120px;';

        const overviewViewSelect = document.createElement('select');
        overviewViewSelect.className = 'at-input';
        const viewOptions = [
            ['all', 'All'],
            ['perfect', 'Perfect (awakened + capped + lvl 99)'],
            ['awakened', 'Awakened (any monster)'],
            ['awakened-not-capped', 'Awakened, not capped'],
            ['capped', 'Capped (any monster)'],
            ['missing-awaken', 'Missing awaken'],
            ['missing-cap', 'Missing cap'],
            ['needs-both', 'Missing awaken AND cap']
        ];
        for (const [val, label] of viewOptions) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = label;
            overviewViewSelect.appendChild(opt);
        }

        const farmToggleBtn = document.createElement('button');
        farmToggleBtn.textContent = '🎯 Farm maps';
        farmToggleBtn.title = 'Toggle the Farm Maps side panel';
        farmToggleBtn.className = 'at-styled-btn';
        farmToggleBtn.style.cssText = 'flex-basis:100%;';

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
        farmHeader.innerHTML = '<strong style="color:var(--at-text-gold);font-size:12px;">🎯 Farm Maps</strong>';

        const hideRaidsLabel = document.createElement('label');
        hideRaidsLabel.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#b8b8b8;cursor:pointer;margin-left:auto;';
        hideRaidsLabel.title = 'Hide maps that are raids (variable spawn times)';
        const hideRaidsInput = document.createElement('input');
        hideRaidsInput.type = 'checkbox';
        hideRaidsInput.checked = s.hideRaids === true;
        hideRaidsInput.style.cssText = 'margin:0;cursor:pointer;';
        const hideRaidsText = document.createElement('span');
        hideRaidsText.textContent = 'Hide raids';
        hideRaidsLabel.appendChild(hideRaidsInput);
        hideRaidsLabel.appendChild(hideRaidsText);
        farmHeader.appendChild(hideRaidsLabel);

        hideRaidsInput.addEventListener('change', () => {
            savePanelSettings({ hideRaids: hideRaidsInput.checked });
            if (farmSection.style.display !== 'none') renderFarmMaps();
        });

        const farmCloseBtn = document.createElement('button');
        farmCloseBtn.textContent = '×';
        farmCloseBtn.title = 'Close farm panel';
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
        panel.appendChild(overviewBody);

        // =======================
        // Overview: render inventory scan
        // =======================
        let overviewGroups = [];

        function renderOverview() {
            const monsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters;
            if (!Array.isArray(monsters) || monsters.length === 0) {
                overviewSummary.innerHTML = '<span style="color:#d87d7d;">No monsters found. Make sure you are logged in.</span>';
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
                if (g.anyCapped) return 1;
                if (g.anyAwakened) return 2;
                return 3;
            };
            groups.sort((a, b) => {
                const ca = categoryRank(a), cb = categoryRank(b);
                if (ca !== cb) return ca - cb;
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
                skippedUnobtainable ? `${skippedUnobtainable} unobtainable` : '',
                skippedNonAwakenable ? `${skippedNonAwakenable} event/gazer` : ''
            ].filter(Boolean).join(' + ');

            const smIcon = (src, size = 12) => `<img src="${src}" style="display:inline !important;width:${size}px;height:${size}px;image-rendering:pixelated;vertical-align:-2px;" />`;
            overviewSummary.innerHTML =
                `<div>${smIcon(BADGE_ICONS.awakened)} Awakened: <b>${counts.awakened}</b> · missing <b style="color:#d87d7d;">${counts.missingAwaken}</b></div>` +
                `<div>${smIcon(BADGE_ICONS.capped)} Capped: <b>${counts.capped}</b> · missing <b style="color:#d87d7d;">${counts.missingCap}</b></div>` +
                `<div style="color:#c084fc;margin-top:2px;">${smIcon(BADGE_ICONS.perfect)} Perfect (awakened + capped + lvl 99): <b>${counts.perfect}</b> · Awakened, not capped: <b>${counts.awakenedNotCapped}</b></div>` +
                `<div style="color:#888;margin-top:2px;">${counts.total} awakenable creatures · ${counts.monsters} monsters${skippedParts ? ` · skipped: ${skippedParts}` : ''}</div>`;

            overviewGrid.innerHTML = groups.map(renderOverviewCard).join('');
            applyOverviewFilter();
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

            const awakenBadge = badgeImg(BADGE_ICONS.awakened, g.anyAwakened ? 'Awakened (tier 6)' : 'Not awakened', g.anyAwakened);
            const capBadge = badgeImg(BADGE_ICONS.capped, g.anyCapped ? 'All stats at 20' : 'Not capped', g.anyCapped);
            // Pick perfect icon based on shiny status of the perfect creature.
            // Shiny perfect -> star-tier-shiny.png (purple), Hundo perfect (non-shiny) -> star-tier-hundo.png (light blue).
            const perfectIconSrc = g.anyPerfectShiny ? BADGE_ICONS.perfect : BADGE_ICONS.perfectHundo;
            const perfectTitle = !g.anyPerfect
                ? 'Not perfect'
                : g.anyPerfectShiny
                    ? 'Perfect shiny (awakened + capped + lvl 99 + shiny)'
                    : 'Perfect hundo (awakened + capped + lvl 99)';
            const perfectBadge = badgeImg(perfectIconSrc, perfectTitle, g.anyPerfect);
            const shinyMark = g.anyShiny ? badgeImg(BADGE_ICONS.shiny, 'Has shiny', true, 12) : '';
            const nameColor = g.anyPerfectShiny ? '#c084fc'
                : g.anyPerfect ? '#A4D8FF'
                : g.anyCapped ? '#facc15'
                : g.anyAwakened ? '#60a5fa'
                : '#9ca3af';
            return `<div class="at-row awaken-overview-row" data-gameid="${g.gameId}" data-name="${g.name.toLowerCase().replace(/"/g, '&quot;')}" data-awakened="${g.anyAwakened}" data-capped="${g.anyCapped}" data-perfect="${g.anyPerfect}">` +
                `<img src="${portraitUrl}" alt="" style="width:34px;height:34px;image-rendering:pixelated;flex-shrink:0;" onerror="this.style.visibility='hidden'" />` +
                `<div style="flex:1;min-width:0;">` +
                    `<div style="color:${nameColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">` +
                        `${awakenBadge} ${capBadge} ${perfectBadge} ${g.name} ${shinyMark}` +
                    `</div>` +
                    `<div style="font-family:ui-monospace,Consolas,monospace;font-size:11px;letter-spacing:0.5px;">` +
                        `${statsHtml}` +
                    `</div>` +
                `</div>` +
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
                ? `Visible: ${visible} / ${total}`
                : `Total: ${total}`;
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
                .find(btn => btn.textContent.trim() === 'Close');
            if (closeBtn) closeBtn.click();
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
                farmSummaryEl.innerHTML = '<span style="color:#888;">No creatures visible in current filter.</span>';
                farmListEl.innerHTML = '';
                return;
            }

            const utils = globalThis.state?.utils;
            if (!utils?.REGIONS || typeof utils.getBoardMonstersFromRoomId !== 'function') {
                farmSummaryEl.innerHTML = '<span style="color:#d87d7d;">state.utils.REGIONS / getBoardMonstersFromRoomId unavailable.</span>';
                farmListEl.innerHTML = '';
                return;
            }
            const ROOM_NAME = utils.ROOM_NAME || {};
            const regionIdsToNames = utils.regionIdsToNames || {};

            const results = [];
            let orderIdx = 0;
            for (const region of utils.REGIONS) {
                if (!region?.id) continue;
                const regionName = regionIdsToNames[region.id] || region.id;
                for (const room of (region.rooms || [])) {
                    if (!room?.id) continue;
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

                    const isRaidRoom = (() => {
                        try {
                            if (typeof window.mapsDatabase?.isRaid === 'function') {
                                return window.mapsDatabase.isRaid(room.id) === true;
                            }
                        } catch (_) {}
                        return room.raid === true;
                    })();

                    results.push({
                        roomId: room.id, mapName: ROOM_NAME[room.id] || room.id,
                        regionName, stamina, totalVillains, wantedTotal, uniqueWanted,
                        density, wantedPerStamina, defaultOrder: orderIdx++,
                        isRaid: isRaidRoom,
                        wantedDetails: Array.from(wantedByCreature.entries()).map(([id, info]) => ({
                            id, name: wantedNamesById.get(id) || `#${id}`,
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

            const hideRaids = hideRaidsInput.checked;
            const raidCount = results.filter(r => r.isRaid).length;
            const visibleResults = hideRaids ? results.filter(r => !r.isRaid) : results;

            const wantedSummary = Array.from(wantedNamesById.values()).slice(0, 8).join(', ')
                + (wantedNamesById.size > 8 ? ` … +${wantedNamesById.size - 8}` : '');

            const raidNote = raidCount > 0
                ? (hideRaids
                    ? ` · <span style="color:#d87d7d;">${raidCount} raid${raidCount > 1 ? 's' : ''} hidden</span>`
                    : ` · <span style="color:#d87d7d;">${raidCount} raid${raidCount > 1 ? 's' : ''}</span>`)
                : '';

            farmSummaryEl.innerHTML =
                `<div>Searching for <b style="color:#88c8ff;">${wantedIds.size}</b> creatures across <b style="color:#88c8ff;">${visibleResults.length}</b> maps.${raidNote}</div>` +
                `<div style="color:#777;margin-top:2px;">Targets: ${wantedSummary}</div>` +
                `<div style="color:#777;margin-top:2px;">Sorted by variety → stamina efficiency · Click a map to navigate.</div>`;

            if (visibleResults.length === 0) {
                farmListEl.innerHTML = '<div style="grid-column:1/-1;padding:16px;color:#888;text-align:center;">No map contains the filtered creatures.</div>';
                return;
            }

            farmListEl.innerHTML = visibleResults.slice(0, 60).map((r, idx) => {
                const details = r.wantedDetails.map(d =>
                    `<span style="color:#88c8ff;font-weight:bold;">${d.name}</span><span style="color:#888;">×${d.count} (lvl ${Math.round(d.avgLevel)})</span>`
                ).join(' · ');
                const otherDetails = (r.otherDetails || []).map(d =>
                    `<span style="color:#888;">${d.name}×${d.count}</span>`
                ).join(' · ');
                const densityPct = Math.round(r.density * 100);
                const densityColor = densityPct >= 70 ? '#7dd87d' : densityPct >= 40 ? '#e0c060' : '#d87d7d';
                const effStr = r.wantedPerStamina.toFixed(2);
                const raidBadge = r.isRaid
                    ? ` <span style="display:inline-block;background:#7a1f1f;color:#ffd6d6;font-size:9px;font-weight:bold;padding:1px 5px;border-radius:3px;letter-spacing:0.5px;vertical-align:1px;" title="This map is a raid — variable spawn time">RAID</span>`
                    : '';
                const titleAttr = r.isRaid
                    ? `${r.mapName} (RAID — appears at variable times)`
                    : `Click to navigate to ${r.mapName}`;
                return `<div class="at-row awaken-farm-row${r.isRaid ? ' is-raid' : ''}" data-room-id="${r.roomId}" title="${titleAttr}">` +
                    `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">` +
                        `<div style="flex:1;min-width:0;">` +
                            `<span style="color:#777;font-size:10px;">#${idx + 1}</span> ` +
                            `<b style="color:#f0c060;text-decoration:underline;text-decoration-color:#5a4a2a;">${r.mapName}</b>${raidBadge} ` +
                            `<span style="color:#666;font-size:10px;">· ${r.regionName}</span>` +
                        `</div>` +
                        `<div style="font-size:10px;color:#999;white-space:nowrap;">` +
                            `<span style="color:${densityColor};">${r.uniqueWanted} creat · ${r.wantedTotal}/${r.totalVillains} (${densityPct}%)</span>` +
                            ` · <span style="color:#88c8ff;">${effStr}/⚡</span> · ⚡${r.stamina}` +
                        `</div>` +
                    `</div>` +
                    `<div style="font-size:10px;margin-top:2px;line-height:1.5;">${details}</div>` +
                    (otherDetails ? `<div style="font-size:9px;margin-top:1px;line-height:1.4;color:#666;">also: ${otherDetails}</div>` : '') +
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

        panel.appendChild(toolbar);

        const footer = document.createElement('div');
        footer.className = 'at-footer';
        footer.innerHTML = 'Credits: <a href="https://bestiaryarena.com/profile/tinhozin" target="_blank">tinhozin</a>';
        panel.appendChild(footer);

        const resizeHandle = document.createElement('div');
        resizeHandle.title = 'Resize';
        resizeHandle.style.cssText = 'position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;background:linear-gradient(135deg, transparent 50%, var(--at-border) 50%);z-index:1;';
        panel.appendChild(resizeHandle);

        // Drag
        let dragOX = 0, dragOY = 0, dragMv = null, dragUp = null;
        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            e.preventDefault();
            const rect = panel.getBoundingClientRect();
            dragOX = e.clientX - rect.left;
            dragOY = e.clientY - rect.top;
            dragMv = (ev) => {
                const nl = Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - dragOX));
                const nt = Math.max(0, Math.min(window.innerHeight - 30, ev.clientY - dragOY));
                panel.style.left = nl + 'px';
                panel.style.top = nt + 'px';
            };
            dragUp = () => {
                document.removeEventListener('mousemove', dragMv);
                document.removeEventListener('mouseup', dragUp);
                savePanelSettings({
                    left: parseInt(panel.style.left, 10),
                    top: parseInt(panel.style.top, 10)
                });
            };
            document.addEventListener('mousemove', dragMv);
            document.addEventListener('mouseup', dragUp);
        });

        // Resize
        let rsX = 0, rsY = 0, rsW = 0, rsH = 0, rsMv = null, rsUp = null;
        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            rsX = e.clientX; rsY = e.clientY;
            rsW = panel.offsetWidth; rsH = panel.offsetHeight;
            rsMv = (ev) => {
                const nw = Math.max(260, rsW + (ev.clientX - rsX));
                const nh = Math.max(180, rsH + (ev.clientY - rsY));
                panel.style.width = nw + 'px';
                panel.style.height = nh + 'px';
            };
            rsUp = () => {
                document.removeEventListener('mousemove', rsMv);
                document.removeEventListener('mouseup', rsUp);
                savePanelSettings({
                    width: parseInt(panel.style.width, 10),
                    height: parseInt(panel.style.height, 10)
                });
            };
            document.addEventListener('mousemove', rsMv);
            document.addEventListener('mouseup', rsUp);
        });

        return panel;
    }

    function openPanel() {
        let panel = document.getElementById(PANEL_ID);
        if (!panel) {
            panel = createPanel();
            document.body.appendChild(panel);
        }
        panel.style.display = 'flex';
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
        title.textContent = enemies.length === 0
            ? 'Awaken Tracker — no map loaded'
            : `Awaken Tracker — ${roomName || 'current map'} (${enemies.length})`;

        grid.innerHTML = '';
        if (enemies.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'opacity:0.6;font-size:12px;padding:8px;text-align:center;';
            empty.textContent = 'Enter a map to see enemy awakens.';
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
                text: 'Awaken Tracker',
                tooltip: 'Open the Awaken Tracker panel',
                primary: false,
                onClick: togglePanel
            });
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
